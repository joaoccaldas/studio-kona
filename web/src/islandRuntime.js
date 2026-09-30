// KONA Island Runtime — world-only renderer.
// No quests, HUD, museum UI, scavenger hunt, game progression, toasts or text overlays.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { TileStreamer } from './tiles.js';
import { WorldZoneStreamer } from './worldZones.js';
import { PlaceWorld } from './placeWorld.js';
import { IslandCoverage } from './islandCoverage.js';
import { CoverageDebug } from './coverageDebug.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const canvas = document.querySelector('#c');
const A = window.__KONA_ASSET_BASE || 'assets/';
const W = (x, y, z = 0) => new THREE.Vector3(x, z, -y);
const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.4, 420000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.maxPolarAngle = Math.PI / 2 - 0.005;
controls.minDistance = 2;
controls.maxDistance = 110000;
controls.screenSpacePanning = true;
controls.enableRotate = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.zoomSpeed = 0.85;
controls.rotateSpeed = 0.55;
controls.panSpeed = 0.7;
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

let dpr = Math.min(devicePixelRatio, coarse ? 1.15 : 1.65);
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener('resize', resize);
resize();

const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.45);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xd8ecff, 0.58));
const hemi = new THREE.HemisphereLight(0xbfe0f4, 0x4a3629, 1.15);
scene.add(hemi);
scene.fog = new THREE.FogExp2(0xa7cbe8, 0.00011);
sky.material.uniforms.turbidity.value = 2.2;
sky.material.uniforms.rayleigh.value = 1.4;
sky.material.uniforms.mieCoefficient.value = 0.005;
sky.material.uniforms.mieDirectionalG.value = 0.82;

function setHour(h = 7.25) {
  const th = (h - 6) / 12 * Math.PI;
  const el = Math.max(0.01, Math.sin(th));
  const az = -Math.cos(th);
  const p = new THREE.Vector3(az * 0.8, el, -0.3).normalize();
  sun.position.copy(p).multiplyScalar(50000);
  sky.material.uniforms.sunPosition.value.copy(p);
  const sunset = Math.exp(-((h - 18) ** 2) / 0.8) + Math.exp(-((h - 6) ** 2) / 0.8);
  sun.color.copy(new THREE.Color(0xfff4e0).lerp(new THREE.Color(0xff8844), sunset * 0.85));
  sun.intensity = Math.max(0.1, el) * (2.8 - sunset * 0.8);
  scene.fog.color.copy(new THREE.Color(0xa7cbe8).lerp(new THREE.Color(0x281c2c), Math.max(0, 1 - el * 2)));
  renderer.toneMappingExposure = 0.85 + Math.sin(th) * 0.35;
}
setHour();

let ocean;
function makeOcean() {
  const g = new THREE.PlaneGeometry(2200, 2200, coarse ? 64 : 120, coarse ? 64 : 120);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: sun.position },
      uSunColor: { value: sun.color },
      uSkyColor: { value: new THREE.Color(0x0e5d7a) },
      uDeepColor: { value: new THREE.Color(0x04243d) }
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      vec3 wave(vec2 d,float a,float w,float s,vec2 p,inout vec3 n){
        float x=dot(d,p)*w+uTime*s; float c=cos(x),si=sin(x);
        n.x-=d.x*w*a*c; n.z-=d.y*w*a*c;
        return vec3(a*d.x*c,a*si,a*d.y*c);
      }
      void main(){
        vec3 p=(modelMatrix*vec4(position,1.)).xyz; vec3 n=vec3(0.,1.,0.);
        p+=wave(normalize(vec2(.8,.3)),.15,.08,1.25,p.xz,n);
        p+=wave(normalize(vec2(-.4,.7)),.08,.16,1.8,p.xz,n);
        vWorldPos=p; vNormal=normalize(n);
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `
      uniform vec3 uSun; uniform vec3 uSunColor; uniform vec3 uSkyColor; uniform vec3 uDeepColor;
      varying vec3 vWorldPos; varying vec3 vNormal;
      void main(){
        vec3 V=normalize(cameraPosition-vWorldPos); vec3 N=normalize(vNormal); vec3 L=normalize(uSun);
        float f=pow(1.-max(0.,dot(V,N)),3.5); vec3 R=reflect(-L,N);
        float sp=pow(max(0.,dot(V,R)),85.)*1.15;
        vec3 col=mix(uDeepColor,uSkyColor,f*.72+.25)+uSunColor*sp;
        gl_FragColor=vec4(col,.9);
      }`,
    transparent: true
  });
  ocean = new THREE.Mesh(g, m);
  ocean.position.y = 0.24;
  scene.add(ocean);
}

const tex = new THREE.TextureLoader();
let man = null;
let isl = null;
let heightAt = () => 0;
let streamer = null;
let worldZones = null;
let placeWorld = null;
let islandCoverage = null;
let coverageDebug = null;

const toLocal = (lat, lon) => {
  if (!man) return [0, 0];
  const kx = 111320 * Math.cos(man.origin.lat * Math.PI / 180);
  return [(lon - man.origin.lon) * kx, (lat - man.origin.lat) * 110574];
};

async function loadIsland() {
  isl = await fetch(A + 'island.json').then(r => r.json());
  const img = await new Promise((resolve, reject) => {
    const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = A + 'island_height.png';
  });
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, img.width, img.height).data;
  const N = img.width, H = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) H[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 6 - 6000;
  heightAt = (x, y) => {
    const u = (x - isl.x0) / isl.size * N - .5, v = (1 - (y - isl.y0) / isl.size) * N - .5;
    const ix = Math.max(0, Math.min(N - 2, Math.floor(u))), iy = Math.max(0, Math.min(N - 2, Math.floor(v)));
    const a = u - ix, b = v - iy;
    return H[iy*N+ix]*(1-a)*(1-b)+H[iy*N+ix+1]*a*(1-b)+H[(iy+1)*N+ix]*(1-a)*b+H[(iy+1)*N+ix+1]*a*b;
  };

  const G = coarse ? 360 : 720;
  const g = new THREE.PlaneGeometry(1, 1, G, G);
  const p = g.attributes.position, uv = g.attributes.uv;
  const [tx0,ty0,tx1,ty1] = man.tile;
  for (let i=0;i<p.count;i++) {
    const u=uv.getX(i), v=uv.getY(i), x=isl.x0+u*isl.size, y=isl.y0+v*isl.size;
    let h=heightAt(x,y);
    if (x>tx0+30&&x<tx1-30&&y>ty0+30&&y<ty1-30) h=Math.min(h,-80);
    const q=W(x,y,h); p.setXYZ(i,q.x,q.y,q.z);
  }
  const idx=g.index.array;
  for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}
  g.computeVertexNormals();
  const color=tex.load(A+'island_color.jpg'); color.colorSpace=THREE.SRGBColorSpace; color.anisotropy=4;
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:color,roughness:.92,metalness:.03}));
  mesh.name='KONA_ISLAND_RING3';
  scene.add(mesh);
}

function orthoMaterial(file, seabed=false) {
  const t=tex.load(A+file); t.flipY=false; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  const m=new THREE.MeshStandardMaterial({map:t,roughness:.9});
  if(seabed) m.color.set(0x6b8892);
  return m;
}

async function loadCore() {
  man = await fetch(A+'kona_manifest.json').then(r=>r.json());
  const islandPromise = loadIsland();
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(A+'kona_p1.glb');
  const protos={};
  gltf.scene.traverse(o=>{
    if(!o.isMesh) return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    mats.forEach((m,i)=>{
      if(m.name==='land_ortho') mats[i]=orthoMaterial('sat_core.jpg');
      else if(m.name==='seabed') mats[i]=orthoMaterial('sat_core.jpg',true);
      else if(m.name==='far_ortho') mats[i]=orthoMaterial('sat_bay.jpg');
    });
    o.material=Array.isArray(o.material)?mats:mats[0];
    if(o.name.startsWith('PROTO_')){protos[o.name.slice(6)]=o;o.visible=false;}
  });
  scene.add(gltf.scene);

  if(protos.bike && man.bikes?.length){
    const im=new THREE.InstancedMesh(protos.bike.geometry,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.38,metalness:.22}),man.bikes.length);
    const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(1,1,1),up=new THREE.Vector3(0,1,0);
    man.bikes.forEach((b,i)=>{q.setFromAxisAngle(up,b.rot);m4.compose(W(b.x,b.y,man.pier_deck||2.15),q,s);im.setMatrixAt(i,m4);});
    im.instanceMatrix.needsUpdate=true; scene.add(im);
  }
  if(protos.palm && man.trees?.length){
    const im=new THREE.InstancedMesh(protos.palm.geometry,protos.palm.material,man.trees.length);
    const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
    man.trees.forEach((t,i)=>{q.setFromAxisAngle(up,(t.x*7.1)%6.28);const k=.85+((Math.abs(t.y)*13.7)%1)*.3;m4.compose(W(t.x,t.y,t.z),q,new THREE.Vector3(k,k,k));im.setMatrixAt(i,m4);});
    im.instanceMatrix.needsUpdate=true; scene.add(im);
  }

  await islandPromise;
  streamer=new TileStreamer({scene,W,base:A+'tiles/',radius:coarse?900:1500,palm:protos.palm,onGround:()=>{}});
  await streamer.init().catch(e=>{console.warn('TileStreamer',e);streamer=null;});
  worldZones=new WorldZoneStreamer({scene,W,heightAt,toLocal,coarse,base:A});
  await worldZones.init().catch(e=>{console.warn('WorldZoneStreamer',e);worldZones=null;});
  placeWorld=new PlaceWorld({scene,W,heightAt,toLocal,coarse,base:A});
  await placeWorld.init().catch(e=>{console.warn('PlaceWorld',e);placeWorld=null;});
  islandCoverage=new IslandCoverage({scene,W,heightAt,coarse});
  if(isl){
    const step=coarse?16000:12000;
    islandCoverage.buildGrid({x0:isl.x0+step*.5,y0:isl.y0+step*.5,x1:isl.x0+isl.size-step*.5,y1:isl.y0+isl.size-step*.5,step});
  }
  coverageDebug=new CoverageDebug({scene,W,heightAt,toLocal,base:A});
  await coverageDebug.init().catch(()=>{coverageDebug=null;});
  if(new URLSearchParams(location.search).get('coverage')==='1') coverageDebug?.setVisible(true);
  makeOcean();
}

const views={
  island:()=>({
    // Whole-island overhead default. ~165 km altitude fits the 159 km island at 55° FOV.
    // Slight south/east offset preserves terrain relief without cropping the coasts.
    pos:W(9000,-3000,168000),
    look:W(0,5000,1100)
  }),
  pier:()=>({pos:W(18,-45,14),look:W(0,10,2.2)}),
  hawi:()=>{const [x,y]=toLocal(20.239006,-155.831451);return{pos:W(x-850,y-900,520),look:W(x,y,Math.max(0,heightAt(x,y)))}} ,
  energylab:()=>{const [x,y]=toLocal(19.7174904,-156.0380702);return{pos:W(x-480,y-520,250),look:W(x,y,Math.max(0,heightAt(x,y)))}}
};
function goTo(id='island'){
  const v=(views[id]||views.island)();
  camera.position.copy(v.pos); controls.target.copy(v.look); controls.update();
}

function updateRegionalAtmosphere(){
  if(!isl) return;
  const x=camera.position.x, y=-camera.position.z, alt=Math.max(0,camera.position.y);
  // East/windward half trends wetter and softer; west/leeward drier with longer visibility.
  const east=THREE.MathUtils.smoothstep(x,26000,65000);
  const north=THREE.MathUtils.smoothstep(y,26000,62000);
  const alpine=THREE.MathUtils.smoothstep(alt,1500,3800);
  const humid=Math.max(east,north*.35)*(1-alpine);
  const dry=1-humid;
  const baseFog=THREE.MathUtils.lerp(.000075,.00017,humid);
  scene.fog.density=baseFog/(1+alt/650);
  const fogDry=new THREE.Color(0xb8d1dd);
  const fogWet=new THREE.Color(0x9bbec4);
  const fogHigh=new THREE.Color(0xc8d5dc);
  scene.fog.color.copy(fogDry).lerp(fogWet,humid).lerp(fogHigh,alpine*.8);
  hemi.color.copy(new THREE.Color(0xc8e4f2).lerp(new THREE.Color(0xb3d7d1),humid));
  hemi.groundColor.copy(new THREE.Color(0x4a382b).lerp(new THREE.Color(0x324b35),humid));
  sun.intensity=THREE.MathUtils.lerp(2.55,2.05,humid)*(1-alpine*.12);
  renderer.toneMappingExposure=THREE.MathUtils.lerp(1.08,.94,humid);
}

let last=performance.now(),fpsT=0,frames=0;
renderer.setAnimationLoop(()=>{
  const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
  controls.update();
  streamer?.update(dt,camera);
  worldZones?.update(dt,camera);
  placeWorld?.update(dt,camera);
  islandCoverage?.update(dt,camera);
  if(ocean){ocean.material.uniforms.uTime.value+=dt;ocean.position.set(Math.round(camera.position.x/80)*80,0,Math.round(camera.position.z/80)*80);}
  updateRegionalAtmosphere();
  renderer.render(scene,camera);
  frames++;fpsT+=dt;
  if(fpsT>2){
    const fps=frames/fpsT;frames=0;fpsT=0;
    if(fps<43&&dpr>.72){dpr=Math.max(.72,dpr-.12);resize();}
    else if(fps>58&&dpr<Math.min(devicePixelRatio,1.8)){dpr=Math.min(devicePixelRatio,1.8,dpr+.08);resize();}
  }
});

window.__kona={
  mode:'world-only',
  ready:false,
  scene,camera,THREE,
  get worldZones(){ return worldZones; },
  get placeWorld(){ return placeWorld; },
  get islandCoverage(){ return islandCoverage; },
  get coverageDebug(){ return coverageDebug; },
  go:goTo,goTo,setHour,
  setCoverageDebug:(v=true)=>coverageDebug?.setVisible(v),
  toggleCoverageDebug:()=>coverageDebug?.toggle()
};

loadCore().then(()=>{
  goTo(new URLSearchParams(location.search).get('view')||'island');
  controls.enabled=true;
  controls.update();
  window.__kona.ready=true;
  document.documentElement.dataset.worldReady='true';
  document.querySelector('#loading')?.remove();
}).catch(e=>{
  console.error(e);
  const l=document.querySelector('#loading');
  if(l) l.textContent='Unable to load island';
});
