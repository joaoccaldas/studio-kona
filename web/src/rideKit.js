// Shared ride scene for Kona Rush and the ride mini-games: sky, road, shoulders, ocean, volcanoes, roadside props,
// palettes per part of the course, and the low-poly riders, cones and pickups. One place to make every ride look good.
import * as THREE from 'three';
import { gearModel } from './gearModels.js';
import { weatherNow, effects } from './weather.js';

export const LANES = [-3, 0, 3];
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const PALETTE = {
  queenk: { sky: 0x3f8fd0, fog: 0xcfe6f2, ground: 0x2c2624, prop: 'rock' },
  hawi: { sky: 0x5a9fc4, fog: 0xd9ebe6, ground: 0x5f7f45, prop: 'bush' },
  energylab: { sky: 0xd99a5a, fog: 0xf6e0b8, ground: 0xb99462, prop: 'rock' },
  alii: { sky: 0xd0705a, fog: 0xf8d2b0, ground: 0x4f7a47, prop: 'crowd' },
  coast: { sky: 0x2f86c8, fog: 0xd3ecf4, ground: 0x6d8a4a, prop: 'palm' },
  kohala: { sky: 0x4d93c2, fog: 0xdcebe0, ground: 0x7a9a4e, prop: 'bush' },
};

// ------------------------------------------------------------------ textures
export function roadTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = '#3b3d42'; c.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 2600; i++) { const g = 50 + Math.random() * 30; c.fillStyle = `rgba(${g},${g},${g + 4},.55)`; c.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
  c.fillStyle = '#f4efe4';
  c.fillRect(6, 0, 6, 512); c.fillRect(244, 0, 6, 512);                 // edge lines
  c.fillStyle = '#e8c35a';
  for (const x of [256 / 3, 512 / 3]) for (let y = 0; y < 512; y += 128) c.fillRect(x - 3, y, 6, 64);   // lane dashes
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function groundTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const k = 150 + Math.random() * 105; c.fillStyle = `rgb(${k},${k},${k})`; c.beginPath(); c.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 5, 0, 7); c.fill(); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function bannerTexture(text) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = '#13293D'; c.fillRect(0, 0, 1024, 160);
  c.fillStyle = '#D9785B'; c.fillRect(0, 140, 1024, 20);
  c.fillStyle = '#FBF8F2'; c.font = '900 96px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 512, 72);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ models (shared geometry, a few cached materials)
const mats = new Map();
export const mat = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o }));
  return mats.get(k);
};
export const G = {
  wheel: new THREE.TorusGeometry(0.34, 0.035, 8, 28),
  disc: new THREE.CylinderGeometry(0.33, 0.33, 0.03, 24),
  tube: new THREE.CylinderGeometry(0.025, 0.025, 1, 6),
  torso: new THREE.CapsuleGeometry(0.17, 0.5, 4, 10),
  limb: new THREE.CapsuleGeometry(0.06, 0.45, 3, 8),
  head: new THREE.SphereGeometry(0.12, 12, 10),
  helmet: new THREE.SphereGeometry(0.15, 14, 10),
  cone: new THREE.ConeGeometry(0.32, 0.8, 14),
  coneBase: new THREE.BoxGeometry(0.62, 0.06, 0.62),
  rock: new THREE.DodecahedronGeometry(1, 0),
  bush: new THREE.IcosahedronGeometry(1, 1),
  trunk: new THREE.CylinderGeometry(0.12, 0.2, 5, 6),
  frond: new THREE.ConeGeometry(1.8, 1.2, 7, 1, true),
  person: new THREE.CapsuleGeometry(0.25, 0.9, 3, 8),
  ring: new THREE.TorusGeometry(1.25, 0.12, 10, 36),
  halo: new THREE.CircleGeometry(0.9, 24),
};

export function makeRider(suit, helmetColor, disc = false) {
  const g = new THREE.Group();
  const frame = mat(0x1a1d22, { metalness: 0.4, roughness: 0.35 });
  const w1 = new THREE.Mesh(G.wheel, frame), w2 = new THREE.Mesh(G.wheel, frame);
  w1.rotation.y = w2.rotation.y = Math.PI / 2;
  w1.position.set(0, 0.36, -0.52); w2.position.set(0, 0.36, 0.52);
  g.add(w1, w2);
  if (disc) { const d = new THREE.Mesh(G.disc, mat(0x2b2f36, { metalness: 0.5, roughness: 0.3 })); d.rotation.z = Math.PI / 2; d.position.copy(w2.position); g.add(d); }
  const bar = (x1, y1, z1, x2, y2, z2) => {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2), m = new THREE.Mesh(G.tube, frame);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.y = a.distanceTo(b);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    g.add(m);
  };
  bar(0, 0.36, 0.52, 0, 0.95, 0.1); bar(0, 0.95, 0.1, 0, 0.9, -0.42); bar(0, 0.9, -0.42, 0, 0.36, -0.52); bar(0, 0.36, 0.52, 0, 0.5, 0.05); bar(0, 0.5, 0.05, 0, 0.95, 0.1);
  const body = new THREE.Group();                                        // leans forward; tucks lower
  body.position.set(0, 1.02, 0.12);
  const skin = mat(0xb07a52), kit = mat(suit), lid = mat(helmetColor, { roughness: 0.25, metalness: 0.2 });
  const torso = new THREE.Mesh(G.torso, kit);
  torso.rotation.x = -1.15; torso.position.set(0, 0.2, -0.22); torso.scale.set(1.45, 1, 1.15);
  const head = new THREE.Mesh(G.head, skin); head.position.set(0, 0.42, -0.58);
  const hel = new THREE.Mesh(G.helmet, lid); hel.scale.set(0.95, 0.8, 1.5); hel.position.set(0, 0.47, -0.52);
  const armL = new THREE.Mesh(G.limb, kit), armR = new THREE.Mesh(G.limb, kit);
  for (const [a, x] of [[armL, -0.13], [armR, 0.13]]) { a.rotation.x = -0.35; a.position.set(x, 0.05, -0.6); body.add(a); }
  const legL = new THREE.Mesh(G.limb, kit), legR = new THREE.Mesh(G.limb, kit);
  for (const [l, x] of [[legL, -0.12], [legR, 0.12]]) { l.position.set(x, -0.3, 0.05); g.add(l); }
  body.add(torso, head, hel);
  g.add(body);
  g.userData = { body, legs: [legL, legR], wheels: [w1, w2] };
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function pedal(r, t) {
  const { legs, wheels } = r.userData;
  legs.forEach((l, i) => { const a = t * 9 + i * Math.PI; l.position.set(i ? 0.12 : -0.12, 0.62 + Math.sin(a) * 0.12, 0.08 + Math.cos(a) * 0.12); l.rotation.x = 0.35 + Math.cos(a) * 0.35; });
  wheels.forEach(w => { w.rotation.x = -t * 20; });
}
export function makeCone() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(G.cone, mat(0xff7a3d, { roughness: 0.5 }));
  c.position.y = 0.43;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.14, 14), mat(0xfbf8f2));
  band.position.y = 0.5;
  g.add(c, band, new THREE.Mesh(G.coneBase, mat(0x222222)));
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function makePickup(kind) {
  const g = new THREE.Group();
  const halo = new THREE.Mesh(G.halo, new THREE.MeshBasicMaterial({ color: kind === 'bottle' ? 0x7fd3e6 : kind === 'shell' ? 0xffd36b : 0xf3d9a4, transparent: true, opacity: 0.45, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03;
  g.add(halo);
  let model;
  if (kind === 'ring') {
    model = new THREE.Mesh(G.ring, new THREE.MeshStandardMaterial({ color: 0x3e8ea0, emissive: 0x2e6f73, emissiveIntensity: 0.9, roughness: 0.3 }));
    model.position.y = 1.35;
    halo.visible = false;
  } else if (kind === 'shell') {
    model = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffcf5c, emissive: 0xc98a1c, emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.25 }));
    model.scale.set(1, 0.7, 1.35);
    model.position.y = 0.9;
  } else {
    model = gearModel(kind === 'gel' ? 'nutrition' : 'bottle', 0x3e8ea0) || new THREE.Mesh(G.head, mat(0xd9785b));
    model.scale.setScalar(kind === 'gel' ? 5 : 3.6);
    model.position.y = 0.8;
  }
  g.add(model);
  g.userData.model = model;
  return g;
}
export function makeProp() {
  // One recyclable roadside slot holding every look; the zone decides which child shows.
  const g = new THREE.Group();
  const rock = new THREE.Mesh(G.rock, mat(0x1e1a19, { roughness: 0.95, flatShading: true }));
  const bush = new THREE.Mesh(G.bush, mat(0x587a3a, { roughness: 0.9, flatShading: true }));
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(G.trunk, mat(0x8a6a48, { roughness: 0.9 })); trunk.position.y = 2.5; trunk.rotation.z = 0.08;
  const frond = new THREE.Mesh(G.frond, mat(0x3f7a3a, { roughness: 0.8, side: THREE.DoubleSide, flatShading: true })); frond.position.y = 5.1; frond.scale.y = -1;
  palm.add(trunk, frond);
  const crowd = new THREE.Group();
  const cols = [0xd9785b, 0x2e6f73, 0xf3d9a4, 0x13293d, 0xe8c35a, 0xfbf8f2];
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(G.person, mat(cols[(Math.random() * cols.length) | 0])); p.position.set((i % 2) * 0.7 - 0.35, 0.7, i * 0.9 - 1.3); crowd.add(p); }
  g.add(rock, bush, palm, crowd);
  g.userData = { rock, bush, palm, crowd };
  return g;
}
export function setPropKind(p, kind) {
  const u = p.userData;
  const k = kind === 'palm' ? (Math.random() < 0.5 ? 'palm' : 'bush') : kind === 'rock' && Math.random() < 0.15 ? 'bush' : kind === 'crowd' && Math.random() < 0.35 ? 'palm' : kind === 'bush' && Math.random() < 0.3 ? 'rock' : kind;
  for (const n of ['rock', 'bush', 'palm', 'crowd']) u[n].visible = n === k;
  const s = 0.5 + Math.random() * 1.1;
  u.rock.scale.set(s * 1.3, s * 0.7, s);
  u.bush.scale.set(s, s * 0.8, s);
  u.kind = k;
}


// ------------------------------------------------------------------ the course: renderer, scene, chase camera, scrolling road
// The athlete stays near z = 0 and the world moves toward +z. `advance(move)` scrolls everything by `move` metres.
export function createCourse({ canvas, zone = 'queenk', shoreX = -36, weather = effects(weatherNow()) }) {
  const FX = weather;
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  const scene = new THREE.Scene();
  const pal0 = PALETTE[zone] || PALETTE.queenk;
  const fogCol = new THREE.Color(pal0.fog);
  scene.background = fogCol.clone();
  scene.fog = new THREE.Fog(fogCol.clone(), 60, 190);
  // Gradient sky with a soft sun: zenith colour down to the fog colour at the horizon.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(pal0.sky) }, bottom: { value: fogCol.clone() }, sunDir: { value: new THREE.Vector3(0.35, 0.28, -1).normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y * 2.2, 0.0, 1.0); vec3 c = mix(bottom, top, pow(h, 0.7));
        float s = max(dot(normalize(vDir), sunDir), 0.0); c += vec3(1.0, 0.9, 0.7) * (pow(s, 400.0) * 1.2 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), skyMat);
  scene.add(sky);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x6b5846, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
  sun.position.set(-8, 14, 6);
  sun.target.position.set(0, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 14, bottom: -14, near: 1, far: 40 });
  scene.add(sun, sun.target);

  const course = { renderer, scene, camera, sky, coarse, baseFov: 60, zone };
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    course.baseFov = camera.aspect < 0.8 ? 74 : 58;
    camera.fov = course.baseFov;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // Road, ground, ocean and far volcanoes.
  const roadTex = roadTexture();
  roadTex.repeat.set(1, 40);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 400), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, -180);
  road.receiveShadow = true;
  const gTex = groundTexture();
  gTex.repeat.set(30, 30);
  const groundMat = new THREE.MeshStandardMaterial({ map: gTex, color: new THREE.Color(pal0.ground), roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(shoreX + 206, 0, -180);    // the ocean shows on the left, west of the road
  ground.receiveShadow = true;
  const waterN = waterNormals();
  waterN.repeat.set(60, 60);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x14688f, roughness: 0.12, metalness: 0.35, normalMap: waterN, normalScale: new THREE.Vector2(0.9 + FX.surf * 0.6, 0.9 + FX.surf * 0.6) }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(shoreX - 444, -0.3, -200);
  const shore = new THREE.Mesh(new THREE.PlaneGeometry(14, 400), new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 1 }));
  shore.rotation.x = -Math.PI / 2; shore.position.set(shoreX, -0.05, -180);
  scene.add(road, ground, ocean, shore);
  // Surf line along the shore.
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(3, 400), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(shoreX - 7.5, -0.12, -180);
  scene.add(foam);
  // Roadside reflector posts every 25 m: they stream past and sell the speed.
  const postGeo = new THREE.BoxGeometry(0.12, 0.9, 0.12); postGeo.translate(0, 0.45, 0);
  const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: 0xfbf8f2 }), 32);
  const refl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.16, 0.13), new THREE.MeshBasicMaterial({ color: 0xff8a3d }), 32);
  const postZ = Array.from({ length: 16 }, (_, i) => -i * 25);
  const m4 = new THREE.Matrix4();
  function placePosts() { postZ.forEach((z, i) => { for (const [k, x] of [[0, -5.4], [1, 5.4]]) { m4.makeTranslation(x, 0, z); posts.setMatrixAt(i * 2 + k, m4); m4.makeTranslation(x, 0.75, z); refl.setMatrixAt(i * 2 + k, m4); } }); posts.instanceMatrix.needsUpdate = refl.instanceMatrix.needsUpdate = true; }
  placePosts();
  scene.add(posts, refl);
  // Clouds: soft billboards, more and greyer with the real cloud cover.
  const cloudTex = softBlob();
  const clouds = [];
  const nClouds = Math.round(4 + FX.cloud * 14);
  for (let i = 0; i < nClouds; i++) {
    const grey = 1 - FX.cloud * 0.35 - FX.rain * 0.25;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color(grey, grey, grey * 1.02), transparent: true, opacity: 0.55 + FX.cloud * 0.35, depthWrite: false, fog: false }));
    sp.scale.set(90 + Math.random() * 120, 30 + Math.random() * 30, 1);
    sp.position.set((Math.random() - 0.5) * 700, 70 + Math.random() * 60, -150 - Math.random() * 350);
    scene.add(sp); clouds.push(sp);
  }
  // Rain, when it is really raining in Kona.
  const RAIN = Math.round(FX.rain * 900);
  let rain = null;
  if (RAIN > 20) {
    const pos = new Float32Array(RAIN * 6);
    for (let i = 0; i < RAIN; i++) { const x = (Math.random() - 0.5) * 40, y = Math.random() * 20, z = -Math.random() * 60 + 8; pos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.45 }));
    scene.add(rain);
  }
  // Sun glare.
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: softBlob(true), color: 0xfff1d0, transparent: true, opacity: 0.7 * (1 - FX.cloud * 0.7), depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  glare.scale.setScalar(160); glare.position.set(170, 130, -420);
  scene.add(glare);
  // Speed streaks close to the camera.
  const NS = 60, spos = new Float32Array(NS * 6);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  const sp = Array.from({ length: NS }, () => ({ x: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 6), y: 0.3 + Math.random() * 4, z: -Math.random() * 40 }));
  scene.add(streaks);
  const hills = new THREE.Group();
  for (const [x, z, r, h] of [[140, -420, 140, 70], [60, -520, 170, 95], [240, -360, 90, 40], [-40, -560, 120, 45]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24), new THREE.MeshBasicMaterial({ color: 0x7d8e99, fog: false }));
    m.position.set(x, h / 2 - 2, z);
    hills.add(m);
  }
  scene.add(hills);

  // Recycled roadside props on both shoulders.
  const props = [];
  const sideX = right => (right ? 1 : -1) * (course.zone === 'alii' ? 6.4 + Math.random() * 3 : 7.5 + Math.random() * (right ? 18 : Math.max(4, Math.min(14, -shoreX - 12))));
  for (let i = 0; i < 34; i++) {
    const p = makeProp();
    p.position.set(sideX(i % 2), 0, -i * 11 - Math.random() * 6);
    setPropKind(p, pal0.prop);
    scene.add(p);
    props.push(p);
  }

  // Palette changes glide over ~1.6 s.
  let palFrom = null, palT = 1;
  const palTo = { sky: new THREE.Color(), fog: new THREE.Color(), ground: new THREE.Color() };
  const tint = (hex, isSky) => { const c = new THREE.Color(hex); const g = FX.cloud * 0.35 + FX.rain * 0.3; const grey = new THREE.Color(isSky ? 0x8d9aa3 : 0xc9cfd3); return c.lerp(grey, Math.min(0.6, g)); };
  function setZone(id, instant) {
    const p0 = PALETTE[id] || PALETTE.queenk;
    const p = { ...p0, sky: tint(p0.sky, true), fog: tint(p0.fog, false) };
    course.zone = id;
    palFrom = { sky: skyMat.uniforms.top.value.clone(), fog: scene.fog.color.clone(), ground: groundMat.color.clone() };
    palTo.sky.set(p.sky); palTo.fog.set(p.fog); palTo.ground.set(p.ground);
    palT = instant ? 1 : 0;
    if (instant) { skyMat.uniforms.top.value.copy(palTo.sky); scene.fog.color.copy(palTo.fog); groundMat.color.copy(palTo.ground); }
    skyMat.uniforms.bottom.value.copy(scene.fog.color); scene.background.copy(scene.fog.color);
    for (const q of props) if (q.position.z < -50) setPropKind(q, p.prop);     // the new zone is already visible ahead
  }
  function tick(dt) {
    if (palT >= 1) return;
    palT = Math.min(1, palT + dt / 1.6);
    skyMat.uniforms.top.value.copy(palFrom.sky).lerp(palTo.sky, palT);
    scene.fog.color.copy(palFrom.fog).lerp(palTo.fog, palT);
    skyMat.uniforms.bottom.value.copy(scene.fog.color); scene.background.copy(scene.fog.color);
    groundMat.color.copy(palFrom.ground).lerp(palTo.ground, palT);
  }
  let wt = 0, speedNow = 0;
  function advance(move, t = 0) {
    wt += 1 / 60;
    waterN.offset.set(wt * 0.012, -wt * 0.02 - move * 0);
    foam.material.opacity = 0.35 + 0.25 * Math.sin(wt * 0.8) * FX.surf;
    for (let i = 0; i < postZ.length; i++) { postZ[i] += move; if (postZ[i] > 12) postZ[i] -= 16 * 25; }
    placePosts();
    for (const c of clouds) { c.position.x += (FX.wind * 0.6) * (1 / 60) * 8; if (c.position.x > 380) c.position.x -= 760; }
    if (rain) { rain.position.z = (rain.position.z + move + 0.4) % 20; rain.position.y = -((wt * 26) % 20); }
    if (move > 0) speedNow = move * 60;
    const k = Math.max(0, Math.min(1, (speedNow - 18) / 18));
    streaks.material.opacity = k * 0.35;
    if (k > 0) for (let i = 0; i < NS; i++) { const q = sp[i]; q.z += move * 1.6; if (q.z > 6) { q.z = -40; q.x = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 6); } spos.set([q.x, q.y, q.z, q.x, q.y, q.z - 1.5 - k * 3], i * 6); }
    sg.attributes.position.needsUpdate = k > 0;
    roadTex.offset.y += move / 10;
    gTex.offset.y += (move / 400) * 30;
    for (const p of props) {
      p.position.z += move;
      if (p.position.z > 12) {
        p.position.z -= 34 * 11;
        p.position.x = sideX(p.position.x > 0);
        setPropKind(p, (PALETTE[course.zone] || PALETTE.queenk).prop);
      }
      if (p.userData.kind === 'crowd') p.userData.crowd.children.forEach((c, i) => { c.position.y = 0.7 + Math.max(0, Math.sin(t * 9 + i + p.position.z)) * 0.18; });
    }
  }
  // Chase camera behind and above the athlete at lateral position px; sp is 0..1 speed.
  const camPos = new THREE.Vector3(0, 4.3, 7.6), camLook = new THREE.Vector3(0, 0.4, -20);
  const tmp = new THREE.Vector3();
  function chase(px, sp, dt, { tuck = false, shake = 0, fovKick = 0, height = 4.3, back = 7.6, look = -20 } = {}) {
    camPos.lerp(tmp.set(px * 0.85, height - sp * 0.5 + (tuck ? -0.25 : 0), back - sp * 0.8), Math.min(1, dt * 5));
    camLook.lerp(tmp.set(px * 0.6, 0.4, look), Math.min(1, dt * 6));
    camera.position.copy(camPos);
    sky.position.copy(camPos);
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.8; camera.position.y += (Math.random() - 0.5) * shake * 0.5; }
    camera.lookAt(camLook);
    const fov = course.baseFov + sp * 10 + fovKick;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  }
  function render() { renderer.render(scene, camera); }
  function dispose() { removeEventListener('resize', resize); renderer.dispose(); renderer.forceContextLoss?.(); }
  return Object.assign(course, { setZone, tick, advance, chase, render, dispose, props, road, groundMat, skyMat, get speedNow() { return speedNow; } });
}

// A finish-style arch with a banner (the Rush finish, mini-game start and finish lines).
export function makeArch(text, color = 0x13293d) {
  const arch = new THREE.Group();
  for (const x of [-5.4, 5.4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), mat(color)); post.position.set(x, 3, 0); arch.add(post); }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(11.3, 1.8), new THREE.MeshBasicMaterial({ map: bannerTexture(text), side: THREE.DoubleSide }));
  banner.position.set(0, 5.4, 0);
  arch.add(banner);
  return arch;
}

// A chunky, blocky person (volunteers, crowd, spectators), the same toy-like style as the island avatar.
// armOut: -1 reaches the left arm out, 1 the right arm, 0 both down. userData.hand is where a held item sits.
const BOX = new THREE.BoxGeometry(1, 1, 1);
export function makePerson({ shirt = 0xd9785b, skin = 0xb07a52, pants = 0x13293d, hat = null, armOut = 0 } = {}) {
  const g = new THREE.Group();
  const part = (m, sx, sy, sz, x, y, z) => { const b = new THREE.Mesh(BOX, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  const ms = mat(shirt), mk = mat(skin), mp = mat(pants);
  part(mp, 0.22, 0.8, 0.26, -0.13, 0.4, 0); part(mp, 0.22, 0.8, 0.26, 0.13, 0.4, 0);
  part(ms, 0.56, 0.62, 0.3, 0, 1.12, 0);
  part(mk, 0.4, 0.4, 0.4, 0, 1.66, 0);
  if (hat != null) part(mat(hat), 0.44, 0.12, 0.5, 0, 1.9, 0.04);
  const arm = side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.36, 1.38, 0);
    const a = new THREE.Mesh(BOX, ms); a.scale.set(0.16, 0.62, 0.18); a.position.y = -0.28; a.castShadow = true;
    const h = new THREE.Mesh(BOX, mk); h.scale.set(0.15, 0.15, 0.15); h.position.y = -0.62;
    pivot.add(a, h);
    g.add(pivot);
    return pivot;
  };
  const L = arm(-1), R = arm(1);
  const hand = new THREE.Object3D();
  if (armOut) {
    const p = armOut < 0 ? L : R;
    p.rotation.z = armOut * 1.45;                    // arm straight out to the side (+x for 1, -x for -1)
    hand.position.set(0, -0.72, 0);
    p.add(hand);
  } else g.add(hand);
  g.userData = { armL: L, armR: R, hand };
  return g;
}

// Tileable water ripples as a normal map (cheap animated ocean with sun glitter).
function waterNormals() {
  const n = 128, cv = document.createElement('canvas'); cv.width = cv.height = n;
  const c = cv.getContext('2d'), img = c.createImageData(n, n);
  const h = (x, y) => Math.sin((x / n) * Math.PI * 2 * 3 + Math.sin((y / n) * Math.PI * 2 * 2)) * 0.5 + Math.sin((y / n) * Math.PI * 2 * 5 + (x / n) * Math.PI * 2 * 2) * 0.35 + Math.sin(((x + y) / n) * Math.PI * 2 * 7) * 0.15;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
    const i = (y * n + x) * 4; img.data[i] = 128 - dx * 90; img.data[i + 1] = 128 - dy * 90; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// A soft round blob (clouds) or a bright core with a halo (sun glare).
function softBlob(sun = false) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  if (sun) { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.12, 'rgba(255,240,200,.8)'); g.addColorStop(0.4, 'rgba(255,220,160,.18)'); g.addColorStop(1, 'rgba(255,220,160,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }
  else for (let i = 0; i < 7; i++) { const x = 30 + Math.random() * 68, y = 50 + Math.random() * 28, r = 22 + Math.random() * 20; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
