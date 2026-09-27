// KONA — IRONMAN World Championship world (P1: swim + transition). Mobile-first Three.js + WebXR.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { TileStreamer } from './tiles.js';
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const A = 'assets/';
const W = (x, y, z = 0) => new THREE.Vector3(x, z, -y);          // survey (x east, y north, z up) -> three
const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

// ------------------------------------------------------------------ renderer (adaptive)
const renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: !coarse, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.0;
renderer.xr.enabled = true;
let dpr = Math.min(devicePixelRatio, coarse ? 1.25 : 1.75);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, .5, 420000);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .52; controls.maxDistance = 260000;
function resize() { renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
document.body.appendChild(VRButton.createButton(renderer));

// ------------------------------------------------------------------ race-morning sky: 10 Oct 2026 in Kailua-Kona
function sunPosition(lat, lon, hourHST) {
  const d = new Date(Date.UTC(2026, 9, 10, 0, 0, 0) + (hourHST + 10) * 3600e3);
  const jd = (d - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const g = (357.529 + .98560028 * jd) * Math.PI / 180, q = (280.459 + .98564736 * jd);
  const L = (q + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * Math.PI / 180, e = (23.439 - 3.6e-7 * jd) * Math.PI / 180;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * jd) % 24;
  const ha = ((gmst * 15 + lon) % 360) * Math.PI / 180 - ra, la = lat * Math.PI / 180;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  return { el, az };
}
scene.fog = new THREE.FogExp2(0xc9d6df, .000022);
const sky = new Sky(); sky.scale.setScalar(380000); scene.add(sky);
const su = sky.material.uniforms; su.turbidity.value = 4; su.rayleigh.value = 1.4; su.mieCoefficient.value = .005; su.mieDirectionalG.value = .85;
const sun = new THREE.DirectionalLight(0xfff0dd, 3); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a4a38, .8); scene.add(hemi);
const sunDir = new THREE.Vector3();
const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;
let hour = 7.25;
function setHour(h) {
  hour = h;
  const { el, az } = sunPosition(19.6392, -155.9968, h);
  sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  su.sunPosition.value.copy(sunDir);
  const day = THREE.MathUtils.clamp((el * 180 / Math.PI + 3) / 12, 0, 1);
  sun.position.copy(sunDir).multiplyScalar(1000); sun.intensity = 3.4 * day; hemi.intensity = .15 + .75 * day;
  renderer.toneMappingExposure = .75 + .35 * (1 - day);
  scene.fog.color.setRGB(.55 + .25 * day, .62 + .22 * day, .70 + .18 * day);
  // environment from the sky for reflections (cheap: one PMREM per hour change)
  const envScene = new THREE.Scene(); const s2 = new Sky(); s2.scale.setScalar(1000); envScene.add(s2);
  Object.assign(s2.material.uniforms.sunPosition.value, sunDir); for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) s2.material.uniforms[k].value = su[k].value;
  if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene); scene.environment = envRT.texture;
  if (ocean) ocean.material.uniforms.uSun.value.copy(sunDir);
  $('#clock').textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')} HST · 10 Oct 2026`;
}

// ------------------------------------------------------------------ ocean (Gerstner waves, fresnel, clear-water tint)
let ocean;
function makeOcean() {
  const g = new THREE.PlaneGeometry(9000, 9000, coarse ? 160 : 320, coarse ? 160 : 320); g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uEnv: { value: null }, uCam: { value: new THREE.Vector3() } },
    vertexShader: `
      uniform float uTime; varying vec3 vW; varying vec3 vN;
      vec3 wave(vec2 d, float A, float L, float sp, vec2 p, inout vec3 t, inout vec3 b){
        float k = 6.2831/L; float f = k*(dot(d,p) - sp*uTime); float Q = .35;
        t += vec3(-Q*d.x*d.x*A*k*sin(f), d.x*A*k*cos(f), -Q*d.x*d.y*A*k*sin(f));
        b += vec3(-Q*d.x*d.y*A*k*sin(f), d.y*A*k*cos(f), -Q*d.y*d.y*A*k*sin(f));
        return vec3(Q*A*d.x*cos(f), A*sin(f), Q*A*d.y*cos(f)); }
      void main(){
        vec3 p = (modelMatrix*vec4(position,1.)).xyz; vec3 t = vec3(1,0,0), b = vec3(0,0,1);
        float fade = 1. - smoothstep(600., 2500., length(p.xz - cameraPosition.xz));
        vec3 off = wave(normalize(vec2(.6,.8)), .35, 42., 5.2, p.xz, t, b) + wave(normalize(vec2(-.3,1.)), .22, 23., 4.1, p.xz, t, b)
                 + wave(normalize(vec2(1.,.2)), .12, 11., 3.0, p.xz, t, b) + wave(normalize(vec2(.2,-1.)), .06, 6., 2.2, p.xz, t, b);
        p += off * fade; vW = p; vN = normalize(cross(b, t));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSun; varying vec3 vW; varying vec3 vN;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec2 q = vW.xz*.35; float t = uTime*.6;
        float camd = length(cameraPosition - vW);
        float near = 1. - smoothstep(150., 1800., camd);
        vec2 dn = vec2(n(q+t)-n(q-vec2(.5,t)), n(q*1.7-t)-n(q*1.3+vec2(t,.3))) * .25 * near;
        vec3 N = normalize(vN + vec3(dn.x, 0., dn.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = .02 + .98 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N);
        float up = clamp(R.y, 0., 1.);
        vec3 skyc = mix(vec3(.75,.82,.9), vec3(.25,.5,.85), pow(up, .5)) * (.35 + .65*clamp(uSun.y*3.,0.,1.));
        float spec = pow(max(dot(R, normalize(uSun)), 0.), mix(60., 600., near)) * mix(1.5, 60., near) * step(0., uSun.y);
        vec3 deep = vec3(.0,.09,.17), shallow = vec3(.05,.42,.47);
        float dist = length(cameraPosition - vW);
        vec3 body = mix(shallow, deep, clamp(dist/400., 0., 1.)) * (.4 + .6*clamp(uSun.y*3.,0.,1.));
        vec3 col = mix(body, skyc, fres) + spec;
        float alpha = mix(.55, .97, clamp(fres*1.4 + dist/900., 0., 1.));
        col = mix(col, vec3(.10,.28,.42) * (.4 + .6*clamp(uSun.y*3.,0.,1.)), 1. - near);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  ocean = new THREE.Mesh(g, m); ocean.renderOrder = 10; ocean.frustumCulled = false; scene.add(ocean);
  const far = new THREE.Mesh(new THREE.RingGeometry(4300, 400000, 64, 1).rotateX(-Math.PI / 2), m); far.renderOrder = 9; far.frustumCulled = false;
  ocean.add(far);
}

// ------------------------------------------------------------------ land + seabed shading from the orthophoto
const tex = new THREE.TextureLoader();
function orthoMaterial(file, meta, seabed) {
  const t = tex.load(A + file); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: .9 });
  if (seabed) m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      vec4 tc = texture2D(map, vMapUv); float l = dot(tc.rgb, vec3(.3,.59,.11));
      vec3 basalt = vec3(.10,.10,.085), algae = vec3(.28,.30,.22), sand = vec3(.78,.72,.56);
      vec3 c = l < .27 ? mix(basalt, algae, smoothstep(.16,.27,l)) : mix(algae, sand, smoothstep(.27,.42,l));
      diffuseColor.rgb *= c;`);
  };
  return m;
}

// ------------------------------------------------------------------ load
let man;
const clock = new THREE.Clock();
async function load() {
  man = await (await fetch(A + 'kona_manifest.json')).json();
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(A + 'kona_p1.glb', e => { if (e.total) $('#bar').style.width = (e.loaded / e.total * 100) + '%'; });
  const core = await (await fetch(A + 'sat_core.json')).json();
  const protos = {};
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      if (m.name === 'land_ortho') mats[i] = orthoMaterial('sat_core.jpg', core, false);
      else if (m.name === 'seabed') mats[i] = orthoMaterial('sat_core.jpg', core, true);
      else if (m.name === 'far_ortho') mats[i] = orthoMaterial('sat_bay.jpg', null, false);
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
    if (o.name.startsWith('KONA_roofs')) o.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75 });
    if (o.name.startsWith('PROTO_')) { protos[o.name.slice(6)] = o; o.visible = false; }
  });
  scene.add(gltf.scene);
  // racked bikes and palms as instances
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const cols = [0xd81b1b, 0x111111, 0xeeeeee, 0x1b4fd8, 0xf29a0c, 0x1a9a4d].map(c => new THREE.Color(c));
  if (protos.bike) {
    const im = new THREE.InstancedMesh(protos.bike.geometry, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35, metalness: .3 }), man.bikes.length);
    man.bikes.forEach((b, i) => { q.setFromAxisAngle(up, b.rot); m4.compose(W(b.x, b.y, man.pier_deck), q, s); im.setMatrixAt(i, m4); im.setColorAt(i, cols[b.c]); });
    scene.add(im);
  }
  if (protos.palm) {
    const im = new THREE.InstancedMesh(protos.palm.geometry, protos.palm.material, man.trees.length);
    man.trees.forEach((t, i) => { q.setFromAxisAngle(up, (t.x * 7.1) % 6.28); const k = .85 + ((Math.abs(t.y) * 13.7) % 1) * .3; m4.compose(W(t.x, t.y, t.z), q, new THREE.Vector3(k, k, k)); im.setMatrixAt(i, m4); });
    scene.add(im);
  }
  gltf.scene.traverse(o => { if (o.name === 'KONA_far') o.visible = false; });
  await island(); routes(); pois();
  gltf.scene.traverse(o => { if (o.isMesh && /KONA_(terrain|pier|heiau_platform|breakwater)/.test(o.name)) addGround(o); });
  streamer = new TileStreamer({ scene, W, base: A + 'tiles/', radius: coarse ? 1200 : 1800, palm: protos.palm,
    onGround: (g, add) => g.traverse(o => { if (o.userData.ground) add ? addGround(o) : grounds.delete(o); }) });
  await streamer.init().catch(() => { streamer = null; });
  coffeeBoat();
  makeOcean(); setHour(hour);
  $('#loading').classList.add('done');
  go('aerial', 0);
}

// ------------------------------------------------------------------ ground (BVH) for walking and swimming
let streamer = null; const grounds = new Set();
function addGround(o) { o.updateMatrixWorld(true); if (!o.geometry.boundsTree) o.geometry.computeBoundsTree(); grounds.add(o); }
const down = new THREE.Raycaster(); down.firstHitOnly = true;
function groundAt(x3, z3, fromY) {
  down.set(new THREE.Vector3(x3, fromY, z3), new THREE.Vector3(0, -1, 0)); down.far = fromY + 100;
  const h = down.intersectObjects([...grounds], false)[0];
  return h ? h.point.y : null;
}

// the Coffee Boat: a race-week tradition, anchored off the course during morning practice swims (position inferred)
let coffee;
function coffeeBoat() {
  const [sx, sy] = man.start, [dx, dy] = man.dir, rx = dy, ry = -dx;
  const xy = [sx + dx * 420 - rx * 40, sy + dy * 420 - ry * 40];
  const g = new THREE.Group(); g.position.copy(W(xy[0], xy[1], 0));
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 7, 6, 12).rotateZ(Math.PI / 2).scale(1, .55, 1), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: .4 }));
  hull.position.y = .3; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.5, .2, 2.4), new THREE.MeshStandardMaterial({ color: 0x8a5a33 })); deck.position.y = .8; g.add(deck);
  const umb = new THREE.Mesh(new THREE.ConeGeometry(2.2, .8, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xc8102e, side: THREE.DoubleSide })); umb.position.y = 3.1; g.add(umb);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.4), new THREE.MeshStandardMaterial({ color: 0xdddddd })); pole.position.y = 1.9; g.add(pole);
  g.rotation.y = Math.atan2(dx, dy);
  scene.add(g); coffee = { g, xy };
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d');
  c.font = '600 40px system-ui'; c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,.7)'; c.fillStyle = '#ffd9a0'; c.strokeText('\u2615 Coffee Boat', 10, 60); c.fillText('\u2615 Coffee Boat', 10, 60);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, sizeAttenuation: false })); sp.scale.set(.18, .034, 1); sp.center.set(0, 0); sp.position.y = 5; sp.renderOrder = 20; g.add(sp);
}

// ------------------------------------------------------------------ live the day: walk, run, swim (first person)
const walk = { on: false, yaw: 0, pitch: 0, keys: {}, stick: { x: 0, y: 0 }, swim: false };
addEventListener('keydown', e => { walk.keys[e.code] = true; });
addEventListener('keyup', e => { walk.keys[e.code] = false; });
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => { if (walk.on && e.target === renderer.domElement) drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (!walk.on || !drag) return; walk.yaw -= (e.clientX - drag.x) * .004; walk.pitch = THREE.MathUtils.clamp(walk.pitch - (e.clientY - drag.y) * .004, -1.3, 1.3); drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { drag = null; });
function setWalk(on) {
  walk.on = on; controls.enabled = !on; document.body.classList.toggle('walking', on);
  $('#walkBtn').textContent = on ? 'Fly' : 'Walk';
  if (on) { const d = new THREE.Vector3(); camera.getWorldDirection(d); walk.yaw = Math.atan2(-d.x, -d.z); walk.pitch = 0;
    const g = groundAt(camera.position.x, camera.position.z, 400); camera.position.y = Math.max(g ?? 0, 0) + 1.7; }
}
function stepWalk(dt) {
  const k = walk.keys, f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + walk.stick.y, r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + walk.stick.x;
  const g = groundAt(camera.position.x, camera.position.z, camera.position.y + 30);
  walk.swim = g === null || g < -.6;
  const speed = walk.swim ? 1.55 : (k.ShiftLeft || k.ShiftRight ? 4.2 : 1.45);          // pro swim pace / easy run / walk (m/s)
  const fwd = new THREE.Vector3(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const mv = fwd.multiplyScalar(f).add(right.multiplyScalar(r));
  if (mv.lengthSq() > 0) camera.position.addScaledVector(mv.normalize(), speed * dt * (k.KeyQ ? 6 : 1));
  const eye = walk.swim ? .28 + Math.sin(clock.elapsedTime * 2.2) * .05 : (g ?? 0) + 1.7;
  camera.position.y += (eye - camera.position.y) * Math.min(1, dt * 8);
  const look = new THREE.Vector3(-Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), -Math.cos(walk.yaw) * Math.cos(walk.pitch));
  camera.lookAt(camera.position.clone().add(look)); controls.target.copy(camera.position).add(look.multiplyScalar(5));
  $('#mode').textContent = walk.swim ? 'Swimming' : (k.ShiftLeft || k.ShiftRight ? 'Running' : 'Walking');
  if (coffee && !DAY_DONE.coffee) { const d = camera.position.distanceTo(coffee.g.position); if (d < 12) { DAY_DONE.coffee = true; toast('\u2615 You made it to the Coffee Boat. Espresso, then swim back.'); markDay(0); } }
}
const DAY_DONE = {};
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 5000); }
function markDay(i) { const li = $$('#day li')[i]; li && li.classList.add('done'); }

// ------------------------------------------------------------------ Ring 3: the whole island
let isl, heightAt = () => 0;
async function island() {
  isl = await (await fetch(A + 'island.json')).json();
  const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = A + 'island_height.png'; });
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, img.width, img.height).data, N = img.width;
  const H = new Float32Array(N * N); for (let i = 0; i < N * N; i++) H[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 6 - 6000;
  heightAt = (x, y) => {                                         // survey metres -> terrain height (bilinear)
    const u = (x - isl.x0) / isl.size * N - .5, v = (1 - (y - isl.y0) / isl.size) * N - .5;
    const i = Math.max(0, Math.min(N - 2, Math.floor(u))), j = Math.max(0, Math.min(N - 2, Math.floor(v))), a = u - i, b = v - j;
    return H[j * N + i] * (1 - a) * (1 - b) + H[j * N + i + 1] * a * (1 - b) + H[(j + 1) * N + i] * (1 - a) * b + H[(j + 1) * N + i + 1] * a * b;
  };
  const G = coarse ? 400 : 800, [tx0, ty0, tx1, ty1] = man.tile;
  const g = new THREE.PlaneGeometry(1, 1, G, G), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i), v = uv.getY(i), x = isl.x0 + u * isl.size, y = isl.y0 + v * isl.size;
    let h = heightAt(x, y);
    if (x > tx0 + 30 && x < tx1 - 30 && y > ty0 + 30 && y < ty1 - 30) h = Math.min(h, -80);   // the detailed tile lives here
    const w = W(x, y, h); p.setXYZ(i, w.x, w.y, w.z);
  }
  const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const a = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = a; }
  g.computeVertexNormals();
  const t = tex.load(A + 'island_color.jpg'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: .95, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.name = 'ISLAND'; scene.add(mesh);
}

// ------------------------------------------------------------------ race courses draped on the island
const toLocal = (lat, lon) => { const o = man.origin, kx = 111320 * Math.cos(o.lat * Math.PI / 180); return [(lon - o.lon) * kx, (lat - o.lat) * 110574]; };
function ribbon(pts, width, color, lift) {
  // centre-line + side attribute; the vertex shader widens the strip to >= ~2.5 px on screen at any altitude
  const pos = [], side = [], tan = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const z = Math.max(0, heightAt(pts[i][0], pts[i][1])) + lift;
    const w = W(pts[i][0], pts[i][1], z), ta = W(b[0] - a[0], b[1] - a[1], 0).normalize();
    for (const s of [-1, 1]) { pos.push(w.x, w.y, w.z); side.push(s); tan.push(ta.x, ta.y, ta.z); }
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k + 1, k - 2, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('tan', new THREE.Float32BufferAttribute(tan, 3)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uW: { value: width }, uPx: { value: 2.5 / innerHeight } },
    vertexShader: `attribute float side; attribute vec3 tan; uniform float uW, uPx; varying float vS;
      void main(){ vec3 p = position; float d = length(cameraPosition - p);
        vec3 n = normalize(cross(tan, vec3(0.,1.,0.)));
        float w = max(uW, d * uPx * 1.2);                      // metres: at least ~2.5 px wide
        p += n * side * w; p.y += d * .0015;                   // float slightly above terrain at distance
        vS = side; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: `uniform vec3 uColor; varying float vS; void main(){ gl_FragColor = vec4(uColor, .9 * (1. - smoothstep(.6, 1., abs(vS)))); }` });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 11; mesh.frustumCulled = false; scene.add(mesh); return mesh;
}
let courses = {};
async function routes() {
  const r = await (await fetch(A + 'routes.json')).json();
  courses.bike = ribbon(r.bike.map(([lon, lat]) => toLocal(lat, lon)), 6, 0xff7a1a, 3);
  courses.run = ribbon(r.run.map(([lon, lat]) => toLocal(lat, lon)), 4, 0x2fe07a, 4);
  courses.swim = ribbon(man.swim_path, 2.5, 0xffd400, .6);
}

// ------------------------------------------------------------------ main points (labels, fly-to)
const POI = [];
async function pois() {
  const g = await (await fetch(A + 'geocodes.json')).json();
  const L = (k) => g[k] && toLocal(g[k].lat, g[k].lon);
  const list = [
    ['race', 'Swim start · Dig Me Beach', [52, -48]], ['race', 'T1 / T2 · Kailua Pier', [-15, 5]], ['race', 'Finish · Ali\u02bbi Drive', toLocal(19.63920, -155.99560)],
    ['race', 'Bike turnaround · H\u0101w\u012b', L('hawi')], ['race', 'Run turnaround · Energy Lab (NELHA)', L('nelha')], ['race', 'Run turnaround · Ali\u02bbi Drive', toLocal(19.595, -155.9738)],
    ['place', 'Kona International Airport', L('airport')], ['place', 'Kawaihae', L('kawaihae')], ['place', 'Waikoloa', L('waikoloa')], ['place', 'Waimea', L('waimea')],
    ['place', 'Hilo', L('hilo')], ['place', 'Hulihe\u02bbe Palace', [303, 35]], ['place', 'Moku\u02bbaikaua Church', L('mokuaikaua')], ['place', 'Royal Kona Resort', L('royal_kona')],
    ['place', 'Kahalu\u02bbu Beach', L('kahaluu')], ['place', 'Keauhou Bay', L('keauhou')], ['place', 'Old Kona Airport Park', L('old_airport')],
    ['peak', 'Mauna Kea · 4,207 m', L('mauna_kea')], ['peak', 'Mauna Loa · 4,169 m', L('mauna_loa')], ['peak', 'Hual\u0101lai · 2,521 m', L('hualalai')], ['peak', 'K\u012blauea · Halema\u02bbuma\u02bbu', L('kilauea')],
  ];
  const col = { race: '#ffcc33', place: '#ffffff', peak: '#9fe3ff' };
  for (const [kind, name, xy] of list) {
    if (!xy) continue;
    const z = Math.max(heightAt(xy[0], xy[1]), 0) + (kind === 'peak' ? 60 : 12);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d');
    c.font = '600 38px system-ui, sans-serif'; c.fillStyle = col[kind]; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 8;
    c.strokeText(name, 12, 60); c.fillText(name, 12, 60);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, sizeAttenuation: false, fog: false }));
    sp.scale.set(.2, .0375, 1); sp.center.set(0, 0); sp.position.copy(W(xy[0], xy[1], z)); sp.renderOrder = 20; scene.add(sp);
    POI.push({ kind, name, xy, z, sp });
  }
}

// ------------------------------------------------------------------ places + swim ride
const T = () => { const [sx, sy] = man.start, [dx, dy] = man.dir; return [sx + dx * 1840, sy + dy * 1840]; };
const PLACES = {
  aerial: () => ({ pos: W(560, -520, 260), look: W(0, -300, 0), name: 'Kailua Bay', note: 'The swim course runs 1,840 m out along the Aliʻi Drive coast to the turn boats.' }),
  start: () => ({ pos: W(52, -48, 1.2), look: W(...T(), 0), name: 'Swim start · Dig Me Beach', note: 'Deep-water start east of Kailua Pier. Pros go at 06:25.' }),
  transition: () => ({ pos: W(-18, 30, 7.5), look: W(-10, -40, 2.2), name: 'Transition · Kailua Pier', note: 'Racked bikes, change tents, blue carpet. 2026 layout: modelled on prior years (inferred).' }),
  heiau: () => ({ pos: W(-20, -62, 1.8), look: W(-62, -28, 4), name: 'Ahuʻena Heiau', note: 'Restored temple of Kamehameha I on its lava-rock platform in Kamakahonu Bay.' }),
  turn: () => { const t = T(); return { pos: W(t[0] + 90, t[1] - 60, 2), look: W(60, -40, 25), name: 'Turn boats', note: 'Body Glove and Jack’s Diving mark the halfway point.' }; },
  island: () => ({ pos: W(-60000, -70000, 55000), look: W(30000, 10000, 0), name: 'Hawai\u02bbi Island', note: 'Bike (orange) to H\u0101w\u012b, run (green) to the Energy Lab, swim (yellow) in Kailua Bay.' }),
  hawi: () => { const p = POI.find(q => q.name.includes('H\u0101w\u012b')).xy; return { pos: W(p[0] - 2500, p[1] - 3000, 900), look: W(p[0], p[1], 150), name: 'H\u0101w\u012b turnaround', note: 'Halfway on the bike: 90 km of Queen K and Akoni Pule Highway behind you, often into the Kohala crosswinds.' }; },
  energylab: () => { const p = POI.find(q => q.name.includes('Energy Lab')).xy; return { pos: W(p[0] + 1500, p[1] - 1200, 350), look: W(p[0], p[1], 5), name: 'Energy Lab', note: 'The hottest, loneliest stretch of the marathon, down to the ocean and back up to the Queen K.' }; },
  finish: () => ({ pos: W(160, -40, 18), look: W(40, 10, 2), name: 'Finish line \u00b7 Ali\u02bbi Drive', note: 'The most famous finish in endurance sport, by the pier where the day began.' }),
};
let tween = null;
function go(k, dur = 2.5) {
  const p = PLACES[k](); ride = null;
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  dur = Math.max(dur, .001);
  tween = { t: 0, dur, f: e => { camera.position.lerpVectors(p0, p.pos, e); controls.target.lerpVectors(t0, p.look, e); } };
  $('#cap').innerHTML = `<b>${p.name}</b><span>${p.note}</span>`;
}
let ride = null;
function swimRide() {
  const pts = man.swim_path.map(([x, y]) => W(x, y, .35));
  const curve = new THREE.CatmullRomCurve3(pts);
  ride = { curve, t: 0, len: curve.getLength() };
  $('#cap').innerHTML = `<b>Swim the course</b><span>3.8 km at a pro's pace (~1:05 per 100 m), 30× time-lapse.</span>`;
}

// ------------------------------------------------------------------ UI + loop
for (const [k, label] of [['island', 'Island'], ['aerial', 'Bay'], ['start', 'Swim start'], ['transition', 'Transition'], ['turn', 'Turn boats'], ['hawi', 'H\u0101w\u012b'], ['energylab', 'Energy Lab'], ['finish', 'Finish'], ['heiau', 'Heiau']]) {
  const b = document.createElement('button'); b.textContent = label; b.onclick = () => go(k); $('#nav').appendChild(b);
}
const sb = document.createElement('button'); sb.textContent = 'Swim ride'; sb.onclick = swimRide; $('#nav').appendChild(sb);
const wb = document.createElement('button'); wb.id = 'walkBtn'; wb.textContent = 'Walk'; wb.onclick = () => setWalk(!walk.on); $('#nav').appendChild(wb);
{ const st = $('#stick'); let sid = null, c0 = null;
  st.addEventListener('pointerdown', e => { sid = e.pointerId; c0 = { x: e.clientX, y: e.clientY }; st.setPointerCapture(sid); e.stopPropagation(); });
  st.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; walk.stick.x = THREE.MathUtils.clamp((e.clientX - c0.x) / 45, -1, 1); walk.stick.y = THREE.MathUtils.clamp(-(e.clientY - c0.y) / 45, -1, 1); });
  st.addEventListener('pointerup', () => { sid = null; walk.stick.x = walk.stick.y = 0; }); }
$('#hour').oninput = e => setHour(+e.target.value);
const DAY = [   // Friday 9 Oct 2026 — typical Kona race-week routine (verify against the 2026 athlete guide)
  [6.5, 'Practice swim out to the Coffee Boat', 'start'], [8.0, 'Breakfast on Ali\u02bbi Drive', 'finish'], [9.5, 'Shake-out ride on the Queen K', 'energylab'],
  [13.0, 'Bike + gear bag check-in on the pier', 'transition'], [15.0, 'Visit Ahu\u02bbena Heiau', 'heiau'], [18.1, 'Sunset from the pier', 'aerial']];
for (const [h, label, place] of DAY) {
  const li = document.createElement('li'); li.innerHTML = `<i>${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round(h % 1 * 60)).padStart(2, '0')}</i> ${label}`;
  li.onclick = () => { setHour(h); $('#hour').value = h; go(place); if (place === 'start') setTimeout(() => { setWalk(true); toast('Swim to the Coffee Boat \u2615 (W / stick). It is out along the course, just inshore of the yellow buoys.'); }, 2700); else li.classList.add('done'); };
  $('#day ol').appendChild(li);
}
let fpsT = 0, frames = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .05);
  if (tween) { tween.t += dt; const k = Math.min(1, tween.t / tween.dur), e = k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2; tween.f(e); if (k >= 1) tween = null; }
  if (ride) {
    ride.t += dt * 1.54 * 30 / ride.len;                       // 1.54 m/s ≈ 1:05 /100 m, ×30
    if (ride.t >= 1) ride = null; else {
      const p = ride.curve.getPointAt(ride.t), a = ride.curve.getPointAt(Math.min(1, ride.t + .004));
      camera.position.copy(p).add(new THREE.Vector3(0, .25 + Math.sin(clock.elapsedTime * 3) * .08, 0)); controls.target.copy(a).add(new THREE.Vector3(0, .2, 0));
    }
  }
  if (walk.on && !tween && !ride) stepWalk(dt); else if (!renderer.xr.isPresenting) controls.update();
  streamer?.update(dt, camera);
  scene.fog.density = .00011 / (1 + Math.max(0, camera.position.y) / 150);
  const alt = Math.abs(camera.position.y) + 1, nearWanted = THREE.MathUtils.clamp(alt * .004, .15, 80);   // depth precision scales with altitude
  if (Math.abs(camera.near - nearWanted) > camera.near * .2) { camera.near = nearWanted; camera.updateProjectionMatrix(); }
  if (ocean) { ocean.material.uniforms.uTime.value += dt; ocean.position.set(Math.round(camera.position.x / 60) * 60, 0, Math.round(camera.position.z / 60) * 60); }
  renderer.render(scene, camera);
  // adaptive resolution: hold ~55+ fps on phones and integrated GPUs
  frames++; fpsT += dt;
  if (fpsT > 2) { const fps = frames / fpsT; frames = 0; fpsT = 0;
    if (fps < 45 && dpr > .75) { dpr = Math.max(.75, dpr - .15); resize(); } else if (fps > 58 && dpr < Math.min(devicePixelRatio, 2)) { dpr = Math.min(devicePixelRatio, dpr + .1); resize(); }
    $('#fps').textContent = `${fps.toFixed(0)} fps · ${dpr.toFixed(2)}x`; }
});
window.__kona = { scene, camera, THREE };
load().catch(e => { $('#loading p').textContent = 'Load failed: ' + e.message; console.error(e); });
