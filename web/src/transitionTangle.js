// Transition Tangle: the first replayable challenge (issue #26), T1 on Kailua Pier, swim → bike.
// Find your rack row, gear up in a legal order, unrack, run to the mount line and mount inside the zone.
// Mistakes cost time and must be recovered from (buckle the helmet, go back behind the line); nothing ends the run.
// The loop, scoring, PBs and rewards come from challenge.js; this file is only the gameplay and the scene.
// Gear comes from the shared library (assets/gear), runners and riders from the island kit (assets/kit).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gearModel, setGlow } from './gearModels.js';
import { defineChallenge, submitRun, recordFor, dailySeed, rng, fmt, MEDAL_LABEL, shareText, deepLink } from './challenge.js';

export const TRANSITION = defineChallenge({
  id: 'transition_tangle',
  name: 'Transition Tangle',
  where: 'T1 · Kailua Pier',
  medals: { gold: 13, silver: 20, bronze: 32 },               // game seconds, elapsed + penalties (clean human run ≈ 10–13 s)
  rewards: {
    first: { xp: 150, credits: 60, items: ['wristband'] },
    bronze: { xp: 30, credits: 10 },
    silver: { xp: 60, credits: 20 },
    gold: { xp: 120, credits: 40, items: ['ticket'] },
  },
});

const P = {                                                   // penalties, seconds
  wrongRow: 3, t2Gear: 2, unbuckled: 5, noShoes: 2, early: 4, late: 2, noGels: 3,
};
const ROWS = 4, PER_ROW = 450;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Vertex colours carry the paint; pure white parts take a tint (same rule as the gear library and the island kit).
function tintMaterial(tint = 0xffffff) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, emissive: 0xffc46b, emissiveIntensity: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTint = { value: new THREE.Color(tint) };
    sh.vertexShader = 'uniform vec3 uTint;\n' + sh.vertexShader.replace('#include <color_vertex>',
      '#include <color_vertex>\n vColor.xyz = mix(vColor.xyz, vColor.xyz * uTint, step(2.9, vColor.x + vColor.y + vColor.z));');
  };
  return m;
}

function labelTexture(lines, { w = 512, h = 256, bg = '#FBF8F2', fg = '#2E6F73', sub = '#13293D' } = {}) {   // Kona palette
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.strokeStyle = fg; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = fg; c.font = '800 44px system-ui, sans-serif'; c.fillText(lines[0], w / 2, h * 0.34);
  c.fillStyle = sub; c.font = '900 76px system-ui, sans-serif'; c.fillText(lines[1], w / 2, h * 0.68);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function deckTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const c = cv.getContext('2d');
  const r = rng(7);
  for (let y = 0; y < 512; y += 32) {
    for (let x = -((y * 7) % 200); x < 512; x += 200) {
      const k = 0.82 + r() * 0.18;
      c.fillStyle = `rgb(${Math.round(150 * k)},${Math.round(128 * k)},${Math.round(104 * k)})`;
      c.fillRect(x, y, 198, 30);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function runTransitionTangle({ player, rewards, base = 'assets/', onExit }) {
  const look = player?.look || {};
  const name = player?.name || 'Athlete';
  const missing = player?.packing?.missing || [];
  const root = document.createElement('div');
  root.id = 'tt';
  root.innerHTML = `
    <canvas id="ttCanvas"></canvas>
    <div class="tt-top">
      <div class="tt-chip"><b>T1</b><span id="ttStep">Find your row</span></div>
      <div class="tt-chip"><span id="ttTime">0.0</span><em id="ttPen"></em></div>
    </div>
    <div class="tt-tip" id="ttTip"></div>
    <div class="tt-bottom">
      <button type="button" id="ttQuit" class="tt-ghost">Quit</button>
      <button type="button" id="ttAct" class="tt-primary" hidden></button>
    </div>
    <section id="ttSheet" hidden role="dialog" aria-labelledby="ttTitle"></section>
    <div id="ttLoad"><div><b>T1 · Kailua Pier</b><span>Setting up transition…</span></div></div>`;
  document.body.appendChild(root);
  document.body.classList.add('in-challenge');
  const $ = s => root.querySelector(s);

  // ---------------------------------------------------------------- renderer and scene
  const canvas = $('#ttCanvas');
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = !coarse;
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc6ec);
  scene.fog = new THREE.Fog(0x8fc6ec, 40, 140);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 400);
  scene.add(new THREE.HemisphereLight(0xe4f1ff, 0x7a6448, 1.3));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(-12, 18, 8);                               // morning sun over Hualālai (east = -x here)
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20 });
  scene.add(sun);

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 72 : 52;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // Pier deck, ocean and the mount-line lane (x runs from the racks toward the pier exit).
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.9 }));
  deck.rotation.x = -Math.PI / 2;
  deck.receiveShadow = true;
  scene.add(deck);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x0b5f8a, roughness: 0.25, metalness: 0.1 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -1.2;
  scene.add(ocean);
  const LANE_Z = 9, LINE_X = 16, ZONE = 3.2, START_X = 6;
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(26, 3), new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.85 }));
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(12, 0.01, LANE_Z);
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(ZONE, 3), new THREE.MeshBasicMaterial({ color: 0x2fbf71, transparent: true, opacity: 0.55 }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.set(LINE_X + ZONE / 2, 0.02, LANE_Z);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  line.rotation.x = -Math.PI / 2;
  line.position.set(LINE_X, 0.03, LANE_Z);
  const mountSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: labelTexture(['BIKE', 'MOUNT LINE']) }));
  mountSign.position.set(LINE_X, 2.4, LANE_Z - 2.2);
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8), new THREE.MeshStandardMaterial({ color: 0x333a40 }));
  signPost.position.set(LINE_X, 0.9, LANE_Z - 2.2);
  scene.add(lane, zone, line, mountSign, signPost);

  // ---------------------------------------------------------------- assets
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [gearG, kitG, bikeG] = await Promise.all([
    loader.loadAsync(base + 'gear/gear.glb'),
    loader.loadAsync(base + 'kit/kona_kit.glb'),
    loader.loadAsync(base + 'bikes/speedmax_2027_cfr.glb').catch(() => null),
  ]);
  const gearGeo = {}, kitGeo = {};
  gearG.scene.traverse(o => { if (o.isMesh && /_LOD0$/.test(o.name)) gearGeo[o.name.slice(5, -5)] = o.geometry; });
  kitG.scene.traverse(o => { if (o.isMesh && o.name.startsWith('KIT_')) kitGeo[o.name.slice(4)] = o.geometry; });

  // A bike ready to rack: standing on the deck, frame along x.
  function makeBike() {
    let bike;
    if (bikeG) {
      bike = bikeG.scene.clone(true);
      const box = new THREE.Box3().setFromObject(bike), size = box.getSize(new THREE.Vector3());
      if (size.z > size.x) bike.rotation.y = Math.PI / 2;
      const b2 = new THREE.Box3().setFromObject(bike), c = b2.getCenter(new THREE.Vector3());
      const holder = new THREE.Group();
      bike.position.set(-c.x, -b2.min.y, -c.z);
      holder.add(bike);
      holder.traverse(o => { if (o.isMesh) o.castShadow = true; });
      return holder;
    }
    const g = new THREE.Group();                                // fallback if the model is unavailable
    const m = new THREE.MeshStandardMaterial({ color: 0x15181b });
    for (const x of [-0.5, 0.5]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 24), m); w.position.set(x, 0.34, 0); g.add(w); }
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.04), m); f.position.set(0, 0.7, 0); g.add(f);
    return g;
  }

  // The rest of the field: one instanced low-poly tri bike (a single draw call for every racked bike on the pier).
  // Only your own bike is the full reconstructed model. Frame along x, wheels on the deck, like makeBike().
  function fieldBikeGeometry() {
    const parts = [];
    const add = (g, x, y, z, rx = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); parts.push(g); };
    for (const x of [-0.5, 0.5]) add(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 20), x, 0.34, 0, Math.PI / 2);   // disc-like wheels
    const tube = (ax, ay, bx, by, r = 0.022) => {
      const len = Math.hypot(bx - ax, by - ay);
      add(new THREE.CylinderGeometry(r, r, len, 6), (ax + bx) / 2, (ay + by) / 2, 0, 0, Math.atan2(bx - ax, by - ay) * -1);
    };
    tube(-0.5, 0.34, 0.0, 0.3); tube(0, 0.3, 0.34, 0.72, 0.03); tube(-0.14, 0.8, 0, 0.3); tube(-0.14, 0.8, 0.34, 0.74, 0.03);
    tube(0.34, 0.74, 0.5, 0.34); tube(-0.5, 0.34, -0.14, 0.8);
    add(new THREE.BoxGeometry(0.26, 0.04, 0.08), -0.18, 0.84, 0);                                                  // saddle
    add(new THREE.BoxGeometry(0.34, 0.03, 0.16), 0.52, 0.84, 0);                                                   // aero bars
    return mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
  }

  // ---------------------------------------------------------------- the day's layout (same for everyone today)
  const seed = dailySeed(TRANSITION.id);
  const r0 = rng(seed);
  const bib = 1 + Math.floor(r0() * ROWS * PER_ROW);
  const myRow = Math.floor((bib - 1) / PER_ROW);
  const rowZ = i => -6 + i * 3.4;                               // rows run along x, spaced in z
  const signs = [];
  for (let i = 0; i < ROWS; i++) {
    const from = i * PER_ROW + 1, to = (i + 1) * PER_ROW;
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 14, 8), new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.6, roughness: 0.35 }));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 1.12, rowZ(i));
    scene.add(rail);
    for (const x of [-7, 7]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.12, 6), rail.material);
      leg.position.set(x, 0.56, rowZ(i));
      scene.add(leg);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: labelTexture([`ROW ${String.fromCharCode(65 + i)}`, `${from}–${to}`]) }));
    sign.position.set(-8.6, 2.1, rowZ(i));
    sign.rotation.y = -Math.PI / 2 + 0.35;
    sign.userData.row = i;
    scene.add(sign);
    signs.push(sign);
  }
  // Other athletes' bikes, spaced along the rails. Your place is kept free in your row.
  const mySlotX = -3 + Math.floor(r0() * 5) * 1.5;
  const slots = [];
  for (let i = 0; i < ROWS; i++) {
    for (let x = -6; x <= 6; x += 1.5) {
      if (i === myRow && Math.abs(x - mySlotX) < 0.1) continue;
      if (r0() < 0.35) continue;                                // a few already gone: faster athletes
      slots.push([x, rowZ(i), r0() < 0.5 ? 1 : -1]);
    }
  }
  const FRAME = [0x15181b, 0xeeeeee, 0xd81b1b, 0x1b4fd8, 0xf29a0c, 0x1a9a4d, 0x00b4d8].map(c => new THREE.Color(c));
  const field = new THREE.InstancedMesh(fieldBikeGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2 }), slots.length);
  const m4 = new THREE.Matrix4(), rq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  slots.forEach(([x, z, side], i) => {
    rq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI / 2 * side);
    field.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0, z), rq, one));
    field.setColorAt(i, FRAME[Math.floor(r0() * FRAME.length)]);
  });
  field.castShadow = true;
  scene.add(field);
  const myBike = makeBike();
  myBike.rotation.y = Math.PI / 2;
  const bikeHome = new THREE.Vector3(mySlotX, 0, rowZ(myRow));
  myBike.position.copy(bikeHome);
  scene.add(myBike);

  // Your towel and gear beside the bike. Missing items from packing arrive as borrowed kit (grey, with a note).
  const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshStandardMaterial({ color: new THREE.Color(look.suit || '#1d3557'), roughness: 0.95 }));
  towel.rotation.x = -Math.PI / 2;
  const towelAt = new THREE.Vector3(mySlotX, 0.012, rowZ(myRow) + 1.0);
  towel.position.copy(towelAt);
  towel.receiveShadow = true;
  scene.add(towel);
  const helmetId = ['helmet_longtail', 'helmet_shorttail', 'helmet_aeroroad'].includes(look.helmet) ? look.helmet : 'helmet_longtail';
  const GEAR = [
    { id: helmetId, kind: 'helmet', label: 'Helmet' },
    { id: 'shoe_tri', kind: 'shoes', label: 'Bike shoes' },
    { id: 'nutrition', kind: 'gels', label: 'Gels' },
    { id: 'sunglasses', kind: 'optional', label: 'Sunglasses', note: 'Eyes protected for the Queen K glare.' },
    { id: 'race_belt', kind: 'optional', label: 'Race belt', note: 'Allowed on the bike, required on the run.' },
    { id: 'shoe_plated', kind: 't2', label: 'Run shoes' },
  ];
  const towelSpots = [[-0.36, -0.2], [0.0, -0.2], [0.36, -0.2], [-0.36, 0.18], [0.0, 0.18], [0.36, 0.18]];
  const order = GEAR.map((g, i) => i).sort(() => r0() - 0.5);
  const items = GEAR.filter(g => gearGeo[g.id]).map((g, i) => {
    const borrowed = missing.includes(g.id);
    const tint = borrowed ? 0x8a9096 : g.kind === 'helmet' ? (look.suit || 0xffffff) : 0xffffff;
    const mesh = gearModel(g.id, tint) || new THREE.Mesh(gearGeo[g.id], tintMaterial(tint));
    const [dx, dz] = towelSpots[order[i] % towelSpots.length];
    mesh.position.set(towelAt.x + dx, 0.02, towelAt.z + dz);
    mesh.rotation.y = r0() * Math.PI * 2;
    mesh.scale.setScalar(1.35);                                  // readable from the camera on a phone
    mesh.castShadow = true;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.06;
    mesh.add(hit);
    scene.add(mesh);
    const it = { ...g, mesh, hit, home: mesh.position.clone(), borrowed, taken: false };
    hit.userData.item = it;
    return it;
  });
  const bikeHit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
  bikeHit.position.set(0, 0.6, 0);
  myBike.add(bikeHit);

  // You: a runner pushing the bike to the line, then a rider rolling out (island kit, shirt in your suit colour).
  const runner = new THREE.Mesh(kitGeo.runner, tintMaterial(look.suit || 0x1d3557));
  const rider = new THREE.Mesh(kitGeo.cyclist, tintMaterial(look.suit || 0x1d3557));
  for (const m of [runner, rider]) { m.visible = false; m.castShadow = true; scene.add(m); }

  // ---------------------------------------------------------------- camera
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), toPos: new THREE.Vector3(), toLook: new THREE.Vector3(), k: 1 };
  function shot(pos, lookAt, snap = false) {
    cam.toPos.copy(pos); cam.toLook.copy(lookAt);
    if (snap) { cam.pos.copy(pos); cam.look.copy(lookAt); }
  }
  const portrait = () => innerWidth / innerHeight < 0.8;
  const SHOTS = {
    // All four row signs must fit: portrait phones step back until the sign line (~12.5 m wide) fills the view.
    rows: () => portrait() ? [new THREE.Vector3(-27, 6.5, -0.9), new THREE.Vector3(-8.6, 1.4, -0.9)] : [new THREE.Vector3(-17, 4.2, 0.5), new THREE.Vector3(-7, 1.2, -0.8)],
    towel: () => [new THREE.Vector3(towelAt.x - (portrait() ? 0.4 : 1.6), portrait() ? 3.0 : 2.4, towelAt.z + (portrait() ? 1.9 : 2.2)), new THREE.Vector3(towelAt.x + 0.15, 0.2, towelAt.z - 0.35)],
    lane: () => [new THREE.Vector3(LINE_X - 3, 3.2, LANE_Z + (portrait() ? 10 : 8)), new THREE.Vector3(LINE_X - 1, 0.6, LANE_Z)],
  };

  // ---------------------------------------------------------------- state
  let phase = 'intro', t0 = 0, elapsed = 0, penalties = [], helmetOn = false, buckled = false, shoesOn = false, gels = false;
  let pushX = 0, rolling = false, finishedAt = 0;
  const tipEl = $('#ttTip');
  let tipT = 0;
  function tip(text, ms = 2600, bad = false) {
    tipEl.textContent = text;
    tipEl.classList.toggle('bad', bad);
    tipEl.classList.add('on');
    clearTimeout(tipT);
    tipT = setTimeout(() => tipEl.classList.remove('on'), ms);
  }
  function penalty(s, why) {
    penalties.push({ s, why });
    $('#ttPen').textContent = ` +${penalties.reduce((a, p) => a + p.s, 0)} s`;
    tip(`+${s} s · ${why}`, 3000, true);
    root.classList.remove('hurt'); void root.offsetWidth; root.classList.add('hurt');
  }
  function step(label) { $('#ttStep').textContent = label; }
  function action(label, fn) {
    const b = $('#ttAct');
    if (!label) { b.hidden = true; b.onclick = null; return; }
    b.hidden = false; b.textContent = label; b.onclick = fn;
  }

  function reset() {
    phase = 'intro'; elapsed = 0; penalties = []; helmetOn = buckled = shoesOn = gels = false; pushX = 0; rolling = false;
    $('#ttPen').textContent = ''; $('#ttTime').textContent = '0.0';
    for (const it of items) { it.taken = false; it.mesh.visible = true; it.mesh.position.copy(it.home); it.mesh.scale.setScalar(1.35); }
    myBike.visible = true; myBike.position.copy(bikeHome); myBike.rotation.set(0, Math.PI / 2, 0);
    runner.visible = rider.visible = false;
    shot(...SHOTS.rows(), true);
    step('Ready');
    action(null);
    intro();
  }

  function intro() {
    const rec = recordFor(TRANSITION.id);
    sheet(`<div class="d-eyebrow">Challenge · ${esc(TRANSITION.where)}</div>
      <h2 id="ttTitle">Transition Tangle</h2>
      <p class="d-note">You just ran up the steps from Kailua Bay. Your number is <b class="bib">${bib}</b>.
      Find your row, gear up, unrack and mount after the line.</p>
      <ul><li>Helmet on <b>and buckled</b> before you touch your bike</li><li>Run shoes stay for T2</li><li>Mount inside the green zone, never before the white line</li></ul>
      <p class="d-note">Gold ${TRANSITION.medals.gold} s · Silver ${TRANSITION.medals.silver} s · Bronze ${TRANSITION.medals.bronze} s${rec?.best != null ? ` · Your best ${fmt(rec.best)}${rec.bestMedal ? ' (' + MEDAL_LABEL[rec.bestMedal] + ')' : ''}` : ''}</p>
      ${missing.length && items.some(i => i.borrowed) ? `<p class="d-note warn">You left ${items.filter(i => i.borrowed).map(i => i.label.toLowerCase()).join(' and ')} at home. A volunteer lent you one (grey on your towel).</p>` : ''}`,
    [{ label: 'Start', primary: true, run: go }, { label: 'Back to Kona', run: exit }]);
  }

  function go() {
    phase = 'rows';
    t0 = performance.now();
    step('Find your row');
    tip(`Number ${bib}: tap your row sign.`, 3200);
  }

  function toTowel() {
    phase = 'gear';
    shot(...SHOTS.towel());
    step('Gear up');
    tip('Tap your gear, then your bike.', 2400);
  }

  function takeItem(it) {
    if (it.taken) return;
    if (it.kind === 't2') {
      penalty(P.t2Gear, 'Run shoes belong in T2. Put them back.');
      shake(it.mesh);
      return;
    }
    it.taken = true;
    fly(it.mesh);
    if (it.kind === 'helmet') { helmetOn = true; action('Buckle helmet', () => { buckled = true; action(null); tip('Buckled. Now the bike.', 1500); }); tip(it.borrowed ? 'Borrowed helmet on. Buckle it.' : 'Helmet on. Buckle it.', 2000); }
    else if (it.kind === 'shoes') { shoesOn = true; tip(it.borrowed ? 'Borrowed shoes on. Half a size big.' : 'Bike shoes on.', 1400); }
    else if (it.kind === 'gels') { gels = true; tip('Gels in your pocket.', 1400); }
    else tip(`${it.label} on. ${it.note || ''}`, 1800);
  }

  function touchBike() {
    if (!helmetOn || !buckled) {
      penalty(P.unbuckled, helmetOn ? 'Official: buckle your helmet before you touch your bike.' : 'Official: helmet on and buckled before you touch your bike.');
      return;
    }
    if (!shoesOn) { penalty(P.noShoes, 'No bike shoes. Back to the towel.'); return; }
    phase = 'push';
    myBike.visible = false;
    runner.visible = true;
    pushX = START_X;
    shot(...SHOTS.lane());
    step('Mount line');
    action('MOUNT', mount);
    rolling = true;
    tip('Run it out. Mount inside the green, after the white line.', 2600);
  }

  function mount() {
    if (phase !== 'push') return;
    if (pushX < LINE_X) {
      penalty(P.early, 'Mounted before the line. Back behind it and go again.');
      pushX = Math.max(START_X, LINE_X - 5);
      return;
    }
    finish(false);
  }

  function finish(late) {
    if (late) penalty(P.late, 'You ran past the zone. Hop on.');
    if (!gels) penalties.push({ s: P.noGels, why: 'No gels: the Queen K will hurt' });
    phase = 'done';
    rolling = false;
    finishedAt = performance.now();
    elapsed = (finishedAt - t0) / 1000;
    runner.visible = false;
    rider.visible = true;
    rider.position.set(pushX, 0, LANE_Z);
    action(null);
    step('Out on course');
    const out = submitRun(TRANSITION.id, { finished: true, elapsed, penalties, at: Date.now() }, { rewards });
    setTimeout(() => results(out), 900);
  }

  function results(out) {
    const chips = [];
    for (const g of out.grants || []) {
      if (g.xp) chips.push(`<span class="chip">+${g.xp} XP</span>`);
      if (g.credits) chips.push(`<span class="chip">+${g.credits} Credits</span>`);
      for (const id of g.items || []) chips.push(`<span class="chip">${id === 'ticket' ? '⏩ Fast-forward ticket' : id === 'wristband' ? '🎗️ Race-week wristband' : esc(id)}</span>`);
    }
    const delta = out.delta == null ? 'First finish' : out.delta < 0 ? `New best by ${Math.abs(out.delta).toFixed(1)} s` : `+${out.delta.toFixed(1)} s on your best`;
    const next = { gold: null, silver: 'gold', bronze: 'silver' }[out.medal] ?? (out.medal ? null : 'bronze');
    const gap = next ? (out.score - TRANSITION.medals[next]).toFixed(1) : null;
    const text = shareText(TRANSITION, { name, score: out.score, medal: out.medal });
    sheet(`<div class="d-eyebrow medal-${out.medal || 'none'}">${out.medal ? MEDAL_LABEL[out.medal] + ' medal' : 'Finished'} · ${esc(delta)}</div>
      <h2 id="ttTitle">${fmt(out.score)}</h2>
      <p class="d-note">${elapsed.toFixed(1)} s moving${penalties.length ? ` + ${penalties.reduce((a, p) => a + p.s, 0)} s in penalties` : ', clean transition'}.
      ${next ? `${gap} s from ${MEDAL_LABEL[next]}.` : 'That is Gold.'}</p>
      ${penalties.length ? `<ul>${penalties.map(p => `<li>+${p.s} s · ${esc(p.why)}</li>`).join('')}</ul>` : ''}
      ${chips.length ? `<div class="d-rewards">${chips.join('')}</div>` : '<p class="d-note">Replays improve your best; rewards came with your first finish and each new medal.</p>'}`,
    [{ label: 'Retry', primary: true, run: () => { reset(); } },
      { label: 'Share', keep: true, run: () => share(text) },
      { label: 'Back to Kona', run: exit }]);
    if (!out.valid) tip('That run did not count.', 2000, true);
  }

  async function share(text) {
    const url = deepLink(TRANSITION.id);
    try {
      if (navigator.share) await navigator.share({ title: TRANSITION.name, text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); tip('Copied. Paste it anywhere.', 1800); }
    } catch { /* cancelled */ }
  }

  function sheet(html, actions) {
    const el = $('#ttSheet');
    el.innerHTML = html + `<div class="d-actions">${actions.map((a, i) => `<button type="button" data-a="${i}" class="${a.primary ? 'primary' : ''}">${esc(a.label)}</button>`).join('')}</div>`;
    el.hidden = false;
    root.classList.add('sheet-open');
    el.querySelectorAll('[data-a]').forEach(b => {
      b.onclick = () => { const a = actions[+b.dataset.a]; if (!a.keep) { el.hidden = true; root.classList.remove('sheet-open'); } a.run?.(); };
    });
    el.querySelector('button.primary')?.focus({ preventScroll: true });
  }

  const anims = [];
  function fly(mesh) { anims.push({ mesh, from: mesh.position.clone(), t: 0 }); }
  function shake(mesh) { anims.push({ mesh, from: mesh.position.clone(), t: 0, shake: true }); }

  // ---------------------------------------------------------------- input: tap only (the camera is directed)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function targets() {
    if (phase === 'rows') return signs;
    if (phase === 'gear') return [...items.filter(i => !i.taken).map(i => i.hit), bikeHit];
    return [];
  }
  canvas.addEventListener('pointerup', e => {
    if (!$('#ttSheet').hidden) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(targets(), false)[0]?.object;
    if (!hit) return;
    if (phase === 'rows') {
      if (hit.userData.row === myRow) toTowel();
      else penalty(P.wrongRow, `Row ${String.fromCharCode(65 + hit.userData.row)} is not yours. Your number is ${bib}.`);
    } else if (phase === 'gear') {
      if (hit === bikeHit) touchBike(); else if (hit.userData.item) takeItem(hit.userData.item);
    }
  });
  const onKey = e => {
    if (e.code === 'Space' || e.code === 'Enter') { const b = $('#ttAct'); if (!b.hidden && $('#ttSheet').hidden) { e.preventDefault(); b.click(); } }
    if (e.code === 'Escape' && $('#ttSheet').hidden) exit();
  };
  addEventListener('keydown', onKey);
  $('#ttQuit').onclick = () => {
    if (phase === 'intro' || phase === 'done') return exit();
    submitRun(TRANSITION.id, { finished: false, elapsed: 0, penalties: [] }, { rewards });   // counted, pays nothing
    exit();
  };

  // ---------------------------------------------------------------- loop
  let raf = 0, alive = true, last = performance.now();
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.12, (now - last) / 1000);           // the clock is wall time, so motion must be too (slow phones)
    last = now;
    if (phase !== 'intro' && phase !== 'done') $('#ttTime').textContent = ((now - t0) / 1000).toFixed(1);
    const k = 1 - Math.pow(0.0015, dt);
    cam.pos.lerp(cam.toPos, k); cam.look.lerp(cam.toLook, k);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    if (rolling) {
      pushX += dt * 3.6;
      // Track the runner side-on so the runner, the bike, the white line and the green zone share the frame.
      const ahead = Math.min(pushX + 2.5, LINE_X + 1);
      cam.toPos.set(ahead - 1, 2.6, LANE_Z + (portrait() ? 8.5 : 7));
      cam.toLook.set(ahead, 0.8, LANE_Z);
      runner.position.set(pushX, 0, LANE_Z - 0.55);
      myBike.position.set(pushX + 0.4, 0, LANE_Z);
      myBike.visible = true;
      myBike.rotation.set(0, 0, 0);
      if (pushX > LINE_X + ZONE) finish(true);
    }
    if (phase === 'done' && rider.visible) rider.position.x += dt * (6 + (now - finishedAt) / 250);
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      a.t += dt * (a.shake ? 3 : 2.4);
      if (a.shake) {
        a.mesh.position.x = a.from.x + Math.sin(a.t * 40) * 0.03 * (1 - Math.min(1, a.t));
        if (a.t >= 1) { a.mesh.position.copy(a.from); anims.splice(i, 1); }
      } else {
        const e = Math.min(1, a.t);
        a.mesh.position.set(a.from.x, a.from.y + Math.sin(e * Math.PI) * 0.5 + e * 1.2, a.from.z);
        a.mesh.scale.setScalar(1.35 * (1 - e));
        if (e >= 1) { a.mesh.visible = false; anims.splice(i, 1); }
      }
    }
    const glow = phase === 'gear' ? 0.25 + 0.2 * Math.sin(now * 0.006) : 0;
    for (const it of items) setGlow(it.mesh, it.taken ? 0 : glow);
    for (const s of signs) s.scale.setScalar(phase === 'rows' ? 1 + Math.sin(now * 0.005 + s.userData.row) * 0.03 : 1);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function exit() {
    alive = false;
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    removeEventListener('keydown', onKey);
    renderer.dispose();
    root.remove();
    document.body.classList.remove('in-challenge');
    onExit?.();
  }

  $('#ttLoad').remove();
  reset();
  raf = requestAnimationFrame(frame);
  // Handles for automated play-tests.
  return {
    get state() { return { phase, bib, myRow, penalties: penalties.slice(), helmetOn, buckled, shoesOn, gels, pushX, elapsed }; },
    project(obj) { const v = obj.getWorldPosition(new THREE.Vector3()).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
    signs, items, bikeHit, LINE_X, ZONE, exit, get drawCalls() { return renderer.info.render.calls; },
  };
}
