// Kona Rush: the core arcade mode. Ride the Queen K from the lava fields to Aliʻi Drive in about three minutes.
// Swipe or tap to change lanes, hold to tuck. Pass slower riders but never sit in their draft zone (the coral wedge
// behind every rider): stay in it too long and you get a card, three cards and you are out. Gels and bottles keep the
// energy tank up; run it dry and you bonk. Hāwī brings crosswind gusts (tuck to hold your line), the Energy Lab burns
// energy faster, Aliʻi Drive has the crowds and the finish arch. Credits from every run buy upgrades you feel next run.
// Rules and numbers live in rushRules.js (unit-tested); this file is the scene, the input and the loop.
import * as THREE from 'three';
import { gearModel } from './gearModels.js';
import { haptic } from './appShell.js';
import { createSfx, confetti } from './aptFx.js';
import { readSection, writeSection } from './save.js';
import { hstDay } from './clock.js';
import { statsFor, zoneAt, ZONES, MEDALS, medalFor, scoreRun, creditsFor, applyRunToMissions, validGarage } from './rushRules.js';

const LANES = [-3, 0, 3];
const KM_PER_M = 2.6 / 1000;                 // course compression: ~2.5 km of course every ~40 s of riding
const FINISH_KM = MEDALS.finish;
const SPAWN_Z = -170;
const DRAFT_LEN = 10, DRAFT_CARD = 1.5;      // metres of draft zone behind a rider; seconds in it before a card
const MEDAL_TXT = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', finish: 'Finisher' };
const MEDAL_BONUS = { bronze: 40, silver: 80, gold: 150, finish: 300 };
const PALETTE = {
  queenk: { sky: 0x3f8fd0, fog: 0xcfe6f2, ground: 0x2c2624, prop: 'rock' },
  hawi: { sky: 0x5a9fc4, fog: 0xd9ebe6, ground: 0x5f7f45, prop: 'bush' },
  energylab: { sky: 0xd99a5a, fog: 0xf6e0b8, ground: 0xb99462, prop: 'rock' },
  alii: { sky: 0xd0705a, fog: 0xf8d2b0, ground: 0x4f7a47, prop: 'crowd' },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ textures
function roadTexture() {
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
function groundTexture() {
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
function bannerTexture(text) {
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
const mat = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o }));
  return mats.get(k);
};
const G = {
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

function makeRider(suit, helmetColor, disc = false) {
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
function pedal(r, t) {
  const { legs, wheels } = r.userData;
  legs.forEach((l, i) => { const a = t * 9 + i * Math.PI; l.position.set(i ? 0.12 : -0.12, 0.62 + Math.sin(a) * 0.12, 0.08 + Math.cos(a) * 0.12); l.rotation.x = 0.35 + Math.cos(a) * 0.35; });
  wheels.forEach(w => { w.rotation.x = -t * 20; });
}
function makeCone() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(G.cone, mat(0xff7a3d, { roughness: 0.5 }));
  c.position.y = 0.43;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.14, 14), mat(0xfbf8f2));
  band.position.y = 0.5;
  g.add(c, band, new THREE.Mesh(G.coneBase, mat(0x222222)));
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makePickup(kind) {
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
function makeProp() {
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
function setPropKind(p, kind) {
  const u = p.userData;
  const k = kind === 'rock' && Math.random() < 0.15 ? 'bush' : kind === 'crowd' && Math.random() < 0.35 ? 'palm' : kind === 'bush' && Math.random() < 0.3 ? 'rock' : kind;
  for (const n of ['rock', 'bush', 'palm', 'crowd']) u[n].visible = n === k;
  const s = 0.5 + Math.random() * 1.1;
  u.rock.scale.set(s * 1.3, s * 0.7, s);
  u.bush.scale.set(s, s * 0.8, s);
  u.kind = k;
}

// ------------------------------------------------------------------ the run
export async function runRush({ player, rewards, onExit, onGarage }) {
  const look = player?.look || {};
  const suit = look.suit || '#2E6F73', lid = 0xfbf8f2;
  const root = document.createElement('div');
  root.id = 'rush';
  root.innerHTML = `
    <canvas id="rushCanvas"></canvas>
    <div class="rs-top">
      <div class="rs-dist"><b id="rsKm">0.00</b><span>km</span><em id="rsZone">Queen K lava fields</em></div>
      <div class="rs-right"><div class="rs-score" id="rsScore">0</div><button type="button" class="rs-pause" id="rsPause" aria-label="Pause">II</button></div>
    </div>
    <div class="rs-track"><i id="rsProg"></i>${ZONES.slice(1).map(z => `<s style="left:${(z.from / FINISH_KM) * 100}%"></s>`).join('')}<u style="left:100%"></u></div>
    <div class="rs-combo" id="rsCombo"></div>
    <div class="rs-banner" id="rsBanner"></div>
    <div class="rs-tip" id="rsTip"></div>
    <div class="rs-count" id="rsCount"></div>
    <div class="rs-gust" id="rsGust"></div>
    <div class="rs-bottom">
      <div class="rs-cards" id="rsCards" aria-label="Drafting cards"><i></i><i></i><i></i></div>
      <div class="rs-energy"><span>Energy</span><div><i id="rsEnergy"></i></div></div>
      <div class="rs-speed"><b id="rsSpeed">0</b><span>km/h</span></div>
    </div>
    <div class="rs-draft" id="rsDraft"><span>DRAFT ZONE</span><div><i id="rsDraftBar"></i></div></div>
    <div class="rs-pops" id="rsPops"></div>
    <section class="rs-sheet" id="rsSheet" hidden role="dialog" aria-modal="true"></section>`;
  document.body.appendChild(root);
  document.body.classList.add('in-challenge');
  const $ = s => root.querySelector(s);

  // ---------------------------------------------------------------- renderer, scene, light
  const canvas = $('#rushCanvas');
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  const scene = new THREE.Scene();
  const skyCol = new THREE.Color(PALETTE.queenk.sky), fogCol = new THREE.Color(PALETTE.queenk.fog), groundCol = new THREE.Color(PALETTE.queenk.ground);
  scene.background = fogCol.clone();
  scene.fog = new THREE.Fog(fogCol.clone(), 60, 190);
  // Gradient sky with a soft sun: zenith colour down to the fog colour at the horizon.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: skyCol.clone() }, bottom: { value: fogCol.clone() }, sunDir: { value: new THREE.Vector3(0.35, 0.28, -1).normalize() } },
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

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    baseFov = camera.aspect < 0.8 ? 74 : 58;
    camera.updateProjectionMatrix();
  }
  let baseFov = 60;
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
  const groundMat = new THREE.MeshStandardMaterial({ map: gTex, color: groundCol.clone(), roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(170, 0, -180);    // the ocean shows on the left, west of the Queen K
  ground.receiveShadow = true;
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x1b6f95, roughness: 0.2, metalness: 0.2 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-480, -0.3, -200);
  const shore = new THREE.Mesh(new THREE.PlaneGeometry(14, 400), new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 1 }));
  shore.rotation.x = -Math.PI / 2; shore.position.set(-36, -0.05, -180);
  scene.add(road, ground, ocean, shore);
  const hills = new THREE.Group();
  for (const [x, z, r, h] of [[140, -420, 140, 70], [60, -520, 170, 95], [240, -360, 90, 40], [-40, -560, 120, 45]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24), new THREE.MeshBasicMaterial({ color: 0x7d8e99, fog: false }));
    m.position.set(x, h / 2 - 2, z);
    hills.add(m);
  }
  scene.add(hills);

  // Recycled roadside props on both shoulders.
  const props = [];
  for (let i = 0; i < 34; i++) {
    const p = makeProp();
    p.position.set((i % 2 ? 1 : -1) * (7.5 + Math.random() * 14), 0, -i * 11 - Math.random() * 6);
    setPropKind(p, 'rock');
    scene.add(p);
    props.push(p);
  }

  // The finish arch appears on Aliʻi Drive when you are close.
  const arch = new THREE.Group();
  for (const x of [-5.4, 5.4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), mat(0x13293d)); post.position.set(x, 3, 0); arch.add(post); }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(11.3, 1.8), new THREE.MeshBasicMaterial({ map: bannerTexture('FINISH · KONA'), side: THREE.DoubleSide }));
  banner.position.set(0, 5.4, 0);
  arch.add(banner);
  arch.visible = false;
  scene.add(arch);

  // The athlete.
  const me = makeRider(suit, lid, true);
  me.scale.setScalar(1.15);
  scene.add(me);

  // Pools.
  const riderCols = [0xd9785b, 0x13293d, 0xe8c35a, 0x6b4ea0, 0xc0392b, 0x2a9d8f, 0x111418, 0xf1faee];
  const draftGeo = new THREE.PlaneGeometry(2.4, DRAFT_LEN);
  const riders = Array.from({ length: 9 }, (_, i) => {
    const m = makeRider(riderCols[i % riderCols.length], riderCols[(i + 3) % riderCols.length]);
    const zone = new THREE.Mesh(draftGeo, new THREE.MeshBasicMaterial({ color: 0xd9785b, transparent: true, opacity: 0.2, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2; zone.position.set(0, 0.03, DRAFT_LEN / 2 + 0.9);
    m.add(zone);
    m.visible = false;
    scene.add(m);
    return { mesh: m, zone, live: false };
  });
  const cones = Array.from({ length: 12 }, () => { const m = makeCone(); m.visible = false; scene.add(m); return { mesh: m, live: false }; });
  const pickups = [];
  for (const [kind, n] of [['gel', 6], ['bottle', 5], ['ring', 8], ['shell', 2]]) for (let i = 0; i < n; i++) { const m = makePickup(kind); m.visible = false; scene.add(m); pickups.push({ kind, mesh: m, live: false }); }

  const sfx = createSfx();
  const garage0 = validGarage(readSection('garage'));
  const stats = statsFor(garage0.levels);

  // ---------------------------------------------------------------- state
  let S;
  function reset() {
    S = {
      phase: 'count', t: 0, countT: 3.2, km: 0, dist: 0, lane: 1, px: 0, speed: 0, energy: 100 * stats.tank, tank: 100 * stats.tank,
      tuck: false, boost: 0, cards: 0, passes: 0, rings: 0, shells: 0, combo: 0, comboT: 0, bestCombo: 0, crashes: 0,
      invuln: 0, draftT: 0, grace: 0, nextSpawn: 40, zone: 'queenk', gust: null, nextGust: 0, shake: 0, lean: 0, bonus: 0,
      tips: new Set(), over: null, paused: false,
    };
    for (const r of riders) { r.live = false; r.mesh.visible = false; }
    for (const c of cones) { c.live = false; c.mesh.visible = false; }
    for (const p of pickups) { p.live = false; p.mesh.visible = false; }
    arch.visible = false;
    $('#rsSheet').hidden = true;
    root.classList.remove('over', 'low', 'drafting');
    $('#rsZone').textContent = ZONES[0].name;
    applyPalette('queenk', 1);
    hud(true);
  }

  // ---------------------------------------------------------------- spawning (a new row every ~20–34 m, at least one lane always open)
  const take = list => list.find(o => !o.live);
  function spawnRider(lane, z, ratio) {
    const r = take(riders);
    if (!r) return;
    Object.assign(r, { live: true, lane, x: LANES[lane], z, ratio, passed: false, hit: false, bob: Math.random() * 6 });
    r.mesh.position.set(r.x, 0, z);
    r.mesh.visible = true;
  }
  function spawnCone(lane, z) {
    const c = take(cones);
    if (!c) return;
    Object.assign(c, { live: true, lane, z, hit: false });
    c.mesh.position.set(LANES[lane], 0, z);
    c.mesh.rotation.set(0, 0, 0);
    c.mesh.visible = true;
  }
  function spawnPickup(kind, lane, z) {
    const p = pickups.find(o => !o.live && o.kind === kind);
    if (!p) return;
    Object.assign(p, { live: true, lane, z, spin: Math.random() * 6, got: false });
    p.mesh.position.set(LANES[lane], 0, z);
    p.mesh.scale.setScalar(1);
    p.mesh.visible = true;
  }
  const pick = a => a[(Math.random() * a.length) | 0];
  function spawnRow() {
    const d = Math.min(1, S.km / 8);                                    // difficulty 0 → 1 over the course
    const first = garage0.runs === 0 && S.km < 0.6;
    const free = [0, 1, 2].sort(() => Math.random() - 0.5);
    const z = SPAWN_Z;
    const x = Math.random();
    const heat = S.zone === 'energylab';
    const fuelOdds = (heat ? 0.3 : 0.22) - d * 0.05;
    if (x < fuelOdds) {
      spawnPickup(heat && Math.random() < 0.6 ? 'bottle' : Math.random() < 0.55 ? 'gel' : 'bottle', free[0], z);
      if (Math.random() < 0.5) spawnCone(free[1], z);
    } else if (x < fuelOdds + 0.14) {
      const lane = free[0];                                            // a line of rings in one lane
      for (let i = 0; i < 3; i++) spawnPickup('ring', lane, z - i * 9);
      if (Math.random() < 0.5 + d * 0.3) spawnRider(free[1], z - 8, 0.55 + Math.random() * 0.15);
    } else if (x < fuelOdds + 0.2 && S.km > 1) {
      spawnPickup('shell', free[0], z);
      spawnCone(free[1], z); if (d > 0.4) spawnCone(free[2], z);   // shells sit behind a gap you have to thread
      spawnCone(free[1], z - 6);
    } else if (x < fuelOdds + 0.5) {
      const n = first ? 1 : Math.random() < 0.35 + d * 0.4 ? 2 : 1;   // riders, some nearly as fast as you
      for (let i = 0; i < n; i++) spawnRider(free[i], z - i * 5, 0.5 + Math.random() * (0.25 + d * 0.2));
    } else {
      const n = first ? 1 : Math.random() < 0.3 + d * 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) spawnCone(free[i], z);
      if (!first && d > 0.3 && Math.random() < d * 0.6) spawnCone(free[n] ?? free[0], z - 14);
    }
    S.nextSpawn = (first ? 38 : 34 - d * 12) + Math.random() * 8;
  }

  // ---------------------------------------------------------------- feedback
  let popN = 0;
  function pop(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'rs-pop ' + cls;
    el.textContent = text;
    el.style.left = `${46 + ((popN++ % 3) - 1) * 12}%`;
    $('#rsPops').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  let tipTimer = 0;
  function tip(key, text, bad = false, ms = 2600) {
    if (key && S.tips.has(key)) return;
    if (key) S.tips.add(key);
    const el = $('#rsTip');
    el.textContent = text;
    el.classList.toggle('bad', bad);
    el.classList.add('on');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => el.classList.remove('on'), ms);
  }
  let bannerTimer = 0;
  function bannerMsg(title, sub) {
    const el = $('#rsBanner');
    el.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }
  function addCombo(pts, label) {
    S.combo += 1; S.comboT = 3.5;
    S.bestCombo = Math.max(S.bestCombo, S.combo);
    S.bonus += pts * Math.min(S.combo, 10);
    pop(`${label}${S.combo > 1 ? ` ×${S.combo}` : ''}`, S.combo >= 5 ? 'hot' : '');
    sfx.pack(S.combo);
  }
  const tutorial = garage0.runs < 2;

  // ---------------------------------------------------------------- input: tap or swipe to change lanes, hold to tuck
  function steer(dir) {
    if (S.phase !== 'ride') return;
    const n = Math.max(0, Math.min(2, S.lane + dir));
    if (n === S.lane) { S.lean = dir * 0.2; return; }
    S.lane = n;
    S.lean = dir * 0.35;
    haptic(8);
  }
  const setTuck = on => { S.tuck = !!on && S.phase === 'ride'; };
  let touch = null;
  canvas.addEventListener('pointerdown', ev => {
    sfx.unlock();
    touch = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: performance.now(), swiped: false, held: false };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', ev => {
    if (!touch || ev.pointerId !== touch.id || touch.swiped) return;
    const dx = ev.clientX - touch.x;
    if (Math.abs(dx) > 28) { touch.swiped = true; steer(Math.sign(dx)); touch.x = ev.clientX; }
  });
  const up = ev => {
    if (!touch || ev.pointerId !== touch.id) return;
    if (!touch.swiped && !touch.held) steer(ev.clientX < innerWidth / 2 ? -1 : 1);
    touch = null;
    setTuck(false);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  const keysDown = new Set();
  function onKey(ev) {
    const k = ev.key.toLowerCase();
    if (ev.type === 'keydown') {
      if (keysDown.has(k)) return;
      keysDown.add(k);
      if (k === 'arrowleft' || k === 'a') steer(-1);
      else if (k === 'arrowright' || k === 'd') steer(1);
      else if (k === ' ' || k === 'shift' || k === 'arrowdown' || k === 's') setTuck(true);
      else if (k === 'escape' || k === 'p') togglePause();
      else if (k === 'enter' && S.phase === 'over') again();
    } else {
      keysDown.delete(k);
      if (k === ' ' || k === 'shift' || k === 'arrowdown' || k === 's') setTuck(false);
    }
  }
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);

  function togglePause(force) {
    if (S.phase !== 'ride' && S.phase !== 'count') return;
    S.paused = force ?? !S.paused;
    const sh = $('#rsSheet');
    if (!S.paused) { sh.hidden = true; return; }
    sh.innerHTML = `<h2>Paused</h2><p>${S.km.toFixed(2)} km · ${S.passes} passed</p>
      <div class="rs-row"><button type="button" class="rs-primary" data-a="resume">Resume</button></div>
      <div class="rs-row"><button type="button" class="rs-ghost" data-a="retry">Restart</button><button type="button" class="rs-ghost" data-a="home">Home</button></div>`;
    sh.hidden = false;
  }
  $('#rsPause').addEventListener('click', () => togglePause());
  document.addEventListener('visibilitychange', onHide);
  function onHide() { if (document.hidden && S.phase === 'ride') togglePause(true); }
  $('#rsSheet').addEventListener('click', ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a;
    if (a === 'resume') togglePause(false);
    else if (a === 'retry') again();
    else if (a === 'home') exit();
    else if (a === 'garage') exit('garage');
    else if (a === 'share') share();
    else if (a?.startsWith('claim:')) claimMission(a.slice(6), ev.target);
  });

  // ---------------------------------------------------------------- zones
  let palFrom = null, palT = 1;
  const palTo = { sky: new THREE.Color(), fog: new THREE.Color(), ground: new THREE.Color() };
  function applyPalette(id, instant) {
    const p = PALETTE[id];
    palFrom = { sky: skyMat.uniforms.top.value.clone(), fog: scene.fog.color.clone(), ground: groundMat.color.clone() };
    palTo.sky.set(p.sky); palTo.fog.set(p.fog); palTo.ground.set(p.ground);
    palT = instant ? 1 : 0;
    if (instant) { skyMat.uniforms.top.value.copy(palTo.sky); scene.fog.color.copy(palTo.fog); groundMat.color.copy(palTo.ground); }
    skyMat.uniforms.bottom.value.copy(scene.fog.color); scene.background.copy(scene.fog.color);
  }
  function enterZone(z) {
    S.zone = z.id;
    applyPalette(z.id);
    $('#rsZone').textContent = z.name;
    const sub = { hawi: 'Crosswinds · tuck to hold your line', energylab: 'Heat · energy burns faster, grab bottles', alii: 'The crowds · the finish is close' }[z.id];
    bannerMsg(z.name.split(' · ')[0], sub);
    haptic([10, 40, 10]);
    sfx.step();
    if (z.id === 'hawi') S.nextGust = S.t + 2.5;
    for (const p of props) if (p.position.z < -50) setPropKind(p, PALETTE[z.id].prop);    // the new zone is already visible ahead
    const medal = medalFor(S.km);
    if (medal) pop(`${MEDAL_TXT[medal]} medal reached`, 'medal');
  }

  // ---------------------------------------------------------------- end of run
  let lastResult = null;
  function end(kind) {
    if (S.over) return;
    S.over = kind;
    S.phase = 'over';
    S.tuck = false;
    root.classList.add('over');
    const km = Math.min(FINISH_KM, Math.round(S.km * 100) / 100);
    const run = { km, passes: S.passes, rings: S.rings, bestCombo: S.bestCombo, cards: S.cards, shells: S.shells };
    const score = scoreRun(run) + Math.round(S.bonus / 5);
    const medal = medalFor(km);
    // Save progress: garage stats and today's missions.
    const g = validGarage(readSection('garage'));
    const pb = score > g.best;
    const day = hstDay();
    const missionsBefore = g.missions && g.missions.day === day ? g.missions.list : null;
    const next = {
      ...g, runs: g.runs + 1, best: Math.max(g.best, score), bestPasses: Math.max(g.bestPasses, S.passes),
      totalKm: Math.round((g.totalKm + km) * 100) / 100, zonesSeen: Math.max(g.zonesSeen, ZONES.filter(z => km >= z.from).length),
      missions: applyRunToMissions(g.missions, run, day),
    };
    writeSection('garage', next);
    // Pay: Credits for the run, plus a one-off bonus the first time each medal is reached.
    const paid = rewards?.grant({ xp: Math.round(score / 15), credits: creditsFor(run), reason: `Kona Rush · ${km.toFixed(1)} km` });
    const medalPaid = medal ? rewards?.grantOnce(`rush:medal:${medal}`, { xp: MEDAL_BONUS[medal], credits: MEDAL_BONUS[medal], reason: `Kona Rush ${MEDAL_TXT[medal]} medal` }) : null;
    const newlyDone = next.missions.list.filter(m => m.done && !(missionsBefore || []).find(o => o.id === m.id && o.done));
    lastResult = { kind, run, score, medal, pb, credits: (paid?.credits || 0) + (medalPaid?.credits || 0), medalFirst: !!medalPaid, missions: next.missions.list, newlyDone, best: next.best };
    if (kind === 'finish' || pb) { confetti(root); sfx.done(); haptic([20, 60, 20, 60, 40]); } else haptic(80);
    setTimeout(() => showResult(lastResult), kind === 'finish' ? 1400 : 900);
  }
  function showResult(r) {
    const title = { finish: 'FINISHER!', bonk: 'Bonk!', dq: 'Disqualified', quit: 'Run over' }[r.kind];
    const why = { finish: 'You rode all the way to Aliʻi Drive.', bonk: 'Out of energy. Grab more gels and bottles next time.', dq: 'Three drafting cards. Pass quickly and stay out of the coral zones.', quit: '' }[r.kind];
    const nextMedal = ['bronze', 'silver', 'gold', 'finish'].find(m => r.run.km < MEDALS[m]);
    const toGo = nextMedal ? `${(MEDALS[nextMedal] - r.run.km).toFixed(1)} km to ${MEDAL_TXT[nextMedal]}` : 'Every medal won';
    const sh = $('#rsSheet');
    sh.innerHTML = `
      <p class="rs-eyebrow">${esc(why)}</p>
      <h2>${title}</h2>
      <div class="rs-medal ${r.medal || 'none'}"><b>${r.medal ? MEDAL_TXT[r.medal] : 'No medal yet'}</b><span>${esc(toGo)}</span></div>
      <div class="rs-score-big"><b>${r.score.toLocaleString()}</b>${r.pb ? '<em>New best!</em>' : `<span>Best ${r.best.toLocaleString()}</span>`}</div>
      <div class="rs-stats">
        <div><b>${r.run.km.toFixed(2)}</b><span>km</span></div>
        <div><b>${r.run.passes}</b><span>passed</span></div>
        <div><b>${r.run.rings}</b><span>rings</span></div>
        <div><b>×${r.run.bestCombo}</b><span>combo</span></div>
      </div>
      <p class="rs-earn">+${r.credits} Credits${r.medalFirst ? ' · first-time medal bonus' : ''}</p>
      ${missionHtml(r.missions)}
      <div class="rs-row"><button type="button" class="rs-primary" data-a="retry" autofocus>Ride again</button></div>
      <div class="rs-row"><button type="button" class="rs-ghost" data-a="garage">Garage</button><button type="button" class="rs-ghost" data-a="share">Share</button><button type="button" class="rs-ghost" data-a="home">Home</button></div>`;
    sh.hidden = false;
  }
  function missionHtml(list) {
    if (!list?.length) return '';
    return `<ul class="rs-missions">${list.map(m => `<li class="${m.done ? 'done' : ''}"><span>${esc(m.text)}</span>
      <div class="bar"><i style="width:${Math.min(100, (m.progress / m.target) * 100)}%"></i></div>
      ${m.done && !m.claimed ? `<button type="button" data-a="claim:${esc(m.id)}">Claim +${m.reward}</button>` : m.claimed ? '<em>Claimed</em>' : `<em>${fmtN(m.progress)}/${fmtN(m.target)}</em>`}</li>`).join('')}</ul>`;
  }
  const fmtN = n => (Number.isInteger(n) ? n : n.toFixed(1));
  function claimMission(id, btn) {
    const paid = claimRushMission(id, rewards);
    if (!paid) return;
    if (btn) btn.outerHTML = `<em>+${paid.credits} Credits</em>`;
    haptic(20); sfx.done();
  }
  async function share() {
    const r = lastResult;
    if (!r) return;
    const url = location.origin + location.pathname + '?c=rush';
    const text = `Kona Rush: ${r.score.toLocaleString()} points, ${r.run.km.toFixed(2)} km on the Queen K${r.medal ? ` (${MEDAL_TXT[r.medal]})` : ''}. Beat that: ${url}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); pop('Copied'); } } catch { /* dismissed */ }
  }
  function again() { reset(); }

  // ---------------------------------------------------------------- the loop
  let raf = 0, last = performance.now(), alive = true;
  const camPos = new THREE.Vector3(0, 3.4, 7), camLook = new THREE.Vector3(0, 1.1, -10);
  function hud(force) {
    $('#rsKm').textContent = S.km.toFixed(2);
    $('#rsScore').textContent = (scoreRun(S) + Math.round(S.bonus / 5)).toLocaleString();
    $('#rsProg').style.width = `${Math.min(100, (S.km / FINISH_KM) * 100)}%`;
    const e = Math.max(0, S.energy / S.tank);
    $('#rsEnergy').style.width = `${e * 100}%`;
    root.classList.toggle('low', e < 0.25 && S.phase === 'ride');
    $('#rsSpeed').textContent = Math.round(S.speed * 1.75);
    const cards = $('#rsCards').children;
    for (let i = 0; i < 3; i++) cards[i].classList.toggle('on', i < S.cards);
    $('#rsCombo').textContent = S.combo > 1 ? `×${S.combo}` : '';
    $('#rsCombo').classList.toggle('hot', S.combo >= 5);
    $('#rsDraftBar').style.width = `${Math.min(100, (S.draftT / DRAFT_CARD) * 100)}%`;
    if (force) $('#rsCount').textContent = '';
  }

  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!S.paused) step(dt);
    render(dt);
    raf = requestAnimationFrame(frame);
  }

  function step(dt) {
    S.t += dt;
    if (palT < 1) {
      palT = Math.min(1, palT + dt / 1.6);
      skyMat.uniforms.top.value.copy(palFrom.sky).lerp(palTo.sky, palT);
      scene.fog.color.copy(palFrom.fog).lerp(palTo.fog, palT);
      skyMat.uniforms.bottom.value.copy(scene.fog.color); scene.background.copy(scene.fog.color);
      groundMat.color.copy(palFrom.ground).lerp(palTo.ground, palT);
    }
    if (S.phase === 'count') {
      S.countT -= dt;
      const n = Math.ceil(S.countT - 0.2);
      const el = $('#rsCount');
      const txt = n > 0 ? String(n) : 'GO!';
      if (el.textContent !== txt) { el.textContent = txt; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); sfx.step(); }
      S.speed = Math.max(S.speed, 4);
      if (S.countT <= 0) {
        S.phase = 'ride';
        setTimeout(() => { if (el.textContent === 'GO!') el.textContent = ''; }, 500);
        if (tutorial) tip('lanes', coarse ? 'Tap left or right (or swipe) to change lanes · hold to tuck' : '← → to change lanes · hold Space to tuck', false, 4200);
      }
    }
    const riding = S.phase === 'ride';
    if (touch && !touch.swiped && !touch.held && performance.now() - touch.t > 170) { touch.held = true; setTuck(true); }
    // Speed: cruising speed rises along the course; tuck, boost and slipstream stack on top.
    const base = (21 + Math.min(S.km, 10) * 1.1) * stats.topSpeed;
    let target = riding ? base * (S.tuck ? 1.28 : 1) * (S.boost > 0 ? 1.4 : 1) * (S.draftT > 0 ? 1.05 : 1) : S.phase === 'over' ? 0 : 4;
    if (S.over === 'finish') target = 9;
    S.speed += (target - S.speed) * Math.min(1, dt * (target < S.speed ? 2.2 : 1.1));
    S.boost = Math.max(0, S.boost - dt);
    S.invuln = Math.max(0, S.invuln - dt);
    S.grace = Math.max(0, S.grace - dt);
    const move = S.speed * dt;
    S.dist += move;
    if (riding) S.km += move * KM_PER_M;
    roadTex.offset.y += move / 10;
    gTex.offset.y += (move / 400) * 30;

    if (riding) {
      // Energy: steady burn, more in the heat, a lot more when tucked, less in a slipstream.
      const drain = (0.85 * (S.zone === 'energylab' ? 1.8 : 1) + (S.tuck ? 3.2 * stats.tuckCost : 0)) * (S.draftT > 0 ? 0.6 : 1);
      S.energy -= drain * dt;
      if (S.energy < S.tank * 0.3 && tutorial) tip('fuel', 'Energy is low: ride through gels and bottles', true);
      if (S.energy <= 0) { S.energy = 0; end('bonk'); bannerMsg('Bonk', 'Out of energy'); }
      const z = zoneAt(S.km);
      if (z.id !== S.zone) enterZone(z);
      if (S.km >= FINISH_KM) { end('finish'); bannerMsg('FINISH', 'You are an IRONMAN… of the Queen K'); }
      S.comboT -= dt;
      if (S.comboT <= 0 && S.combo) S.combo = 0;
      S.nextSpawn -= move;
      if (S.nextSpawn <= 0 && S.km < FINISH_KM - 0.25) { spawnRow(); S.rows = (S.rows || 0) + 1; }
      // Hāwī crosswinds: a warning, then a gust that pushes you a lane unless you are tucked.
      if (S.zone === 'hawi') {
        if (!S.gust && S.t >= S.nextGust) { S.gust = { dir: Math.random() < 0.5 ? -1 : 1, at: S.t + 1.3 }; tip('gust', 'Gust coming: hold to tuck and keep your line', false, 2000); }
        if (S.gust) {
          $('#rsGust').textContent = S.gust.dir < 0 ? '⟵ GUST' : 'GUST ⟶';
          $('#rsGust').classList.add('on');
          if (S.t >= S.gust.at) {
            if (S.tuck) { addCombo(20, 'Held the line'); }
            else { const n = Math.max(0, Math.min(2, S.lane + S.gust.dir)); if (n !== S.lane) { S.lane = n; S.lean = S.gust.dir * 0.5; } else S.energy -= 6; S.shake = 0.25; haptic(30); pop('Blown sideways', 'bad'); }
            S.gust = null;
            S.nextGust = S.t + 4 + Math.random() * 3.5;
            $('#rsGust').classList.remove('on');
          }
        }
      } else if (S.gust) { S.gust = null; $('#rsGust').classList.remove('on'); }
    }

    // The athlete: glide to the lane, lean into the move, tuck lower.
    S.px += (LANES[S.lane] - S.px) * Math.min(1, dt * 11);
    S.lean *= Math.pow(0.02, dt);
    me.position.set(S.px, 0, 0);
    me.rotation.z = -S.lean - (LANES[S.lane] - S.px) * 0.06;
    const body = me.userData.body;
    body.position.y += ((S.tuck ? 0.9 : 1.02) - body.position.y) * Math.min(1, dt * 10);
    body.rotation.x += ((S.tuck ? -0.18 : 0) - body.rotation.x) * Math.min(1, dt * 10);
    pedal(me, S.dist / 7);
    me.visible = S.invuln <= 0 || Math.floor(S.t * 14) % 2 === 0;

    // Riders: slower than you, pedal, avoid cones, and carry a draft zone behind them.
    let inDraft = false;
    for (const r of riders) {
      if (!r.live) continue;
      const rz0 = r.z;
      r.z += S.speed * (1 - r.ratio) * dt;
      if (r.z > 14) { r.live = false; r.mesh.visible = false; continue; }
      const blocked = cones.some(c => c.live && c.lane === r.lane && c.z < r.z && c.z > r.z - 10);
      if (blocked) {
        const alt = [r.lane - 1, r.lane + 1].filter(l => l >= 0 && l <= 2 && !cones.some(c => c.live && c.lane === l && Math.abs(c.z - r.z) < 12));
        if (alt.length) r.lane = alt[0];
      }
      r.x += (LANES[r.lane] - r.x) * Math.min(1, dt * 3);
      r.bob += dt;
      r.mesh.position.set(r.x, 0, r.z);
      r.mesh.rotation.z = (r.x - LANES[r.lane]) * 0.08;
      pedal(r.mesh, S.dist * r.ratio / 7 + r.bob);
      const sameLane = Math.abs(r.x - S.px) < 1.25;
      const behind = r.z < -0.9 && r.z > -0.9 - DRAFT_LEN;
      const here = riding && sameLane && behind && !r.hit;
      r.zone.material.opacity = here ? 0.5 : 0.18;
      if (here) inDraft = true;
      if (riding && !r.hit && sameLane && r.z > -1.5 && rz0 < 1.0 && S.invuln <= 0) crash(r);
      if (!r.passed && r.z > 1.2 && riding) { r.passed = true; if (!r.hit) { S.passes++; addCombo(10, 'Pass'); } }
    }
    if (inDraft && S.grace <= 0) {
      S.draftT += dt;
      if (tutorial) tip('draft', 'Coral zone = drafting. Change lane and pass or you get a card', true);
      if (S.draftT >= DRAFT_CARD) {
        S.cards++; S.draftT = 0; S.grace = 2; S.combo = 0;
        bannerMsg(S.cards >= 3 ? 'Third card' : `Drafting card ${S.cards}/3`, S.cards >= 3 ? 'Disqualified' : 'Stay out of the coral zones');
        haptic([40, 40, 40]); sfx.trap();
        if (S.cards >= 3) end('dq');
      }
    } else S.draftT = Math.max(0, S.draftT - dt * 1.5);
    root.classList.toggle('drafting', inDraft && riding);

    // Cones. Hits are swept over the frame's movement so nothing tunnels through at low frame rates.
    for (const c of cones) {
      if (!c.live) continue;
      c.z += move;
      if (c.z > 14) { c.live = false; c.mesh.visible = false; continue; }
      c.mesh.position.z = c.z;
      if (c.hit) { c.mesh.rotation.x += dt * 8; c.mesh.position.y = Math.max(0, c.mesh.position.y + c.vy * dt); c.vy -= 20 * dt; c.mesh.position.x += c.vx * dt; }
      else if (riding && Math.abs(LANES[c.lane] - S.px) < 1.1 && c.z > -0.7 && c.z - move < 0.7 && S.invuln <= 0) { c.hit = true; c.vy = 6; c.vx = (Math.random() - 0.5) * 6; crash(null); }
    }
    // Pickups.
    for (const p of pickups) {
      if (!p.live) continue;
      p.z += move;
      if (p.z > 14) { p.live = false; p.mesh.visible = false; continue; }
      p.spin += dt;
      const m = p.mesh.userData.model;
      p.mesh.position.z = p.z;
      if (p.kind === 'ring') m.rotation.y = 0; else { m.rotation.y = p.spin * 2.4; m.position.y = 0.85 + Math.sin(p.spin * 4) * 0.12; }
      if (riding && !p.got && Math.abs(LANES[p.lane] - S.px) < 1.3 && p.z > -0.8 && p.z - move < 0.8) collect(p);
      if (p.got) { p.mesh.scale.multiplyScalar(1 - dt * 6); p.mesh.position.y += dt * 4; if (p.mesh.scale.x < 0.05) { p.live = false; p.mesh.visible = false; } }
    }
    // Props and the finish arch.
    for (const p of props) {
      p.position.z += move;
      if (p.position.z > 12) {
        p.position.z -= 34 * 11;
        p.position.x = (p.position.x > 0 ? 1 : -1) * (S.zone === 'alii' ? 6.4 + Math.random() * 3 : 7.5 + Math.random() * (p.position.x > 0 ? 18 : 14));
        setPropKind(p, PALETTE[S.zone].prop);
      }
      if (p.userData.kind === 'crowd') p.userData.crowd.children.forEach((c, i) => { c.position.y = 0.7 + Math.max(0, Math.sin(S.t * 9 + i + p.position.z)) * 0.18; });
    }
    if (S.km > FINISH_KM - 0.5 || S.over === 'finish') {
      arch.visible = true;
      if (S.over !== 'finish') arch.position.z = -(FINISH_KM - S.km) / KM_PER_M;
      else arch.position.z += move;
    }
    if (S.phase === 'ride' || S.phase === 'over') hud();
  }

  function crash(r) {
    S.crashes++;
    S.speed *= 0.45;
    S.energy -= 10;
    S.combo = 0;
    S.invuln = 1.3;
    S.grace = 2;
    S.shake = 0.45;
    if (r) { r.hit = true; r.lane = [r.lane - 1, r.lane + 1].find(l => l >= 0 && l <= 2) ?? r.lane; }
    pop('Crash! −10 energy', 'bad');
    haptic([60, 30, 60]);
    sfx.trap();
    root.classList.remove('hurt'); void root.offsetWidth; root.classList.add('hurt');
    if (tutorial) tip('crash', 'Swerve around riders and cones: tap the side you want to go', true);
  }
  function collect(p) {
    p.got = true;
    const e0 = S.energy;
    if (p.kind === 'gel' || p.kind === 'bottle') S.fuel = (S.fuel || 0) + 1;
    if (p.kind === 'gel') { S.energy = Math.min(S.tank, S.energy + 32); pop(`Gel +${Math.round(S.energy - e0)}`, 'fuel'); sfx.step(); }
    else if (p.kind === 'bottle') { S.energy = Math.min(S.tank, S.energy + (S.zone === 'energylab' ? 26 : 16)); pop(`Bottle +${Math.round(S.energy - e0)}`, 'fuel'); sfx.step(); }
    else if (p.kind === 'ring') { S.rings++; S.boost = 1.4; addCombo(15, 'Ring · boost'); }
    else if (p.kind === 'shell') { S.shells++; S.bonus += 150; pop('Golden shell +5', 'medal'); sfx.done(); }
    haptic(12);
  }

  function render(dt) {
    // Chase camera: behind and above, drifting with the lane; wider and lower as speed builds.
    const sp = Math.min(1, S.speed / 45);
    camPos.lerp(new THREE.Vector3(S.px * 0.85, 4.3 - sp * 0.5 + (S.tuck ? -0.25 : 0), 7.6 - sp * 0.8), Math.min(1, dt * 5));
    camLook.lerp(new THREE.Vector3(S.px * 0.6, 0.4, -20), Math.min(1, dt * 6));
    camera.position.copy(camPos);
    sky.position.copy(camPos);
    if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt); camera.position.x += (Math.random() - 0.5) * S.shake * 0.8; camera.position.y += (Math.random() - 0.5) * S.shake * 0.5; }
    camera.lookAt(camLook);
    const fov = baseFov + sp * 10 + (S.boost > 0 ? 6 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
    scene.fog.near = S.zone === 'energylab' ? 40 : 60;
    renderer.render(scene, camera);
  }

  function exit(to) {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onHide);
    renderer.dispose();
    root.remove();
    document.body.classList.remove('in-challenge');
    if (to === 'garage') onGarage?.(); else onExit?.();
  }

  reset();
  raf = requestAnimationFrame(frame);
  // Handles for automated play-tests.
  return {
    get state() { const { tips, ...rest } = S; return { ...rest, riders: riders.filter(r => r.live).map(r => ({ lane: r.lane, z: r.z, hit: !!r.hit })), cones: cones.filter(c => c.live && !c.hit).map(c => ({ lane: c.lane, z: c.z })), pickups: pickups.filter(q => q.live && !q.got).map(q => ({ kind: q.kind, lane: q.lane, z: q.z })) }; },
    left: () => steer(-1), right: () => steer(1), tuck: setTuck, pause: togglePause, again, exit,
    skip(km) { S.km = km; },
    get result() { return lastResult; },
    get drawCalls() { return renderer.info.render.calls; },
  };
}

// Claim a finished daily mission (also used by the home screen). Returns what was paid, or null.
export function claimRushMission(id, rewards) {
  const g = validGarage(readSection('garage'));
  const m = g.missions?.day === hstDay() ? g.missions.list.find(x => x.id === id) : null;
  if (!m || !m.done || m.claimed) return null;
  const paid = rewards?.grantOnce(`rush:mission:${g.missions.day}:${id}`, { xp: m.reward, credits: m.reward, reason: `Mission: ${m.text}` });
  m.claimed = true;
  writeSection('garage', g);
  return paid || { credits: 0 };
}
