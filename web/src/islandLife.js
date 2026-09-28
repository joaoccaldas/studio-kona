// The living island. Kona changes with the race week you are playing: quiet on arrival, the town builds up,
// race day fills the course, then it winds down. Every asset comes from blender/kit.py (assets/kit/kona_kit.glb).
// Positions come from real data: the run route ends at the Aliʻi Drive finish, aid stations sit on the routed
// bike and run courses, expo tents on the King Kamehameha lot, honu on Kamakahonu and Kahaluʻu beaches.
// Spacing of aid stations, flags and barriers is inferred (evidence class I).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Race-week days: 0 fri2 … 6 thu8 (Underpants Run), 7 fri9 (bike check-in), 8 sat10 (race), 9 sun11, 10 mon12.
export const PHASES = {
  quiet: {
    name: 'The quiet island',
    news: ['Locals, paddlers and honu have the bay to themselves.', 'The finish line on Aliʻi Drive is just a street for now.'],
  },
  build: {
    name: 'Race week builds',
    news: ['Scaffolding for the finish arch is going up on Aliʻi Drive.', 'Expo tents open on the King Kamehameha lot.',
      'Athletes are training on Aliʻi Drive, the Queen K and in the bay.', 'White coral messages are appearing on the lava along the Queen K.'],
  },
  final: {
    name: 'Final days',
    news: ['The finish arch is complete.', 'Barriers and grandstands line the finishing stretch.',
      'Crowds gather on Aliʻi Drive.', 'Bike check-in fills the racks on Kailua Pier.'],
  },
  race: {
    name: 'Race day',
    news: ['Swimmers fill Kailua Bay.', 'The field is out on the Queen K and aid stations line the course.',
      'Aliʻi Drive is packed from the seawall to the finish.', 'Someone wrote a message for you on the lava.'],
  },
  after: {
    name: 'After the race',
    news: ['Leis are laid at the finish line.', 'The barriers are coming down and the town is quiet again.', 'The honu are back on the beach.'],
  },
};

export function phaseFor(dayIdx, completedDays) {
  const started = (completedDays || []).length > 0 || dayIdx > 0;
  if (!started) return 'quiet';
  if (dayIdx <= 5) return 'build';
  if (dayIdx <= 7) return 'final';
  if (dayIdx === 8) return 'race';
  return 'after';
}

const MESSAGES = ['ALOHA', 'GO MOM', 'MAHALO', 'GO DAD', 'BELIEVE', 'KONA', 'SWIM BIKE RUN', 'NEVER QUIT', 'GO GO GO', 'ALOHA KONA', 'GO TEAM'];

// ------------------------------------------------------------------ geometry helpers (survey metres, +x east, +y north)
function cumulative(pts) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return d;
}
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}
class Path {
  constructor(pts, heightAt, lift = 0.05, water = false) {
    this.p = densify(pts, 8);
    this.d = cumulative(this.p);
    this.len = this.d[this.d.length - 1];
    this.h = this.p.map(([x, y]) => water ? 0 : Math.max(heightAt(x, y), 0.4) + lift);
  }
  // Position, height and heading at distance s. Offset is to the left of travel (metres).
  at(s, off = 0, out = {}) {
    s = ((s % this.len) + this.len) % this.len;
    let lo = 0, hi = this.d.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.d[m] <= s) lo = m; else hi = m; }
    const t = (s - this.d[lo]) / Math.max(1e-6, this.d[hi] - this.d[lo]);
    const [ax, ay] = this.p[lo], [bx, by] = this.p[hi];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    out.x = ax + dx * t - dy / L * off;
    out.y = ay + dy * t + dx / L * off;
    out.z = this.h[lo] + (this.h[hi] - this.h[lo]) * t;
    out.yaw = Math.atan2(dy, dx);
    return out;
  }
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

// Vertex colours carry the asset's paint; pure white parts take the per-instance tint (shirts, canopies, hulls).
function kitMaterial(extra = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02, ...extra });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('vColor.xyz *= instanceColor.xyz;',
      'vColor.xyz = mix(vColor.xyz, vColor.xyz * instanceColor.xyz, step(2.9, vColor.x + vColor.y + vColor.z));');
  };
  return m;
}
function flagMaterial(uTime) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
        transformed.z += sin(transformed.x * 3.2 - uTime * 5.0 + ph) * 0.13 * transformed.x;`);
  };
  return m;
}

const TINTS = {
  shirts: [0xffffff, 0xe63946, 0xf4a261, 0x2a9d8f, 0x1d3557, 0xffd166, 0x06d6a0, 0xef476f, 0x118ab2, 0xf1faee].map(c => new THREE.Color(c)),
  canopy: [0xffffff, 0xf2f2f2, 0x1d6fb8, 0xe9c46a].map(c => new THREE.Color(c)),
  flags: [0xe63946, 0x1d3557, 0xffd166, 0x2a9d8f, 0xf4a261, 0x118ab2, 0x8338ec, 0x06d6a0, 0xffffff, 0xd62828].map(c => new THREE.Color(c)),
  hulls: [0xc1121f, 0xffd166, 0xfdf0d5, 0x1d6fb8].map(c => new THREE.Color(c)),
};

export async function createIslandLife({ scene, W, heightAt, man, places, toLocal, coarse, playerName, setPierBikes, base = 'assets/' }) {
  const gltf = await new GLTFLoader().loadAsync(base + 'kit/kona_kit.glb');
  const geo = {};
  gltf.scene.traverse(o => { if (o.isMesh && o.name.startsWith('KIT_')) geo[o.name.slice(4)] = o.geometry; });

  const routes = await (await fetch(base + 'routes.json')).json();
  const toXY = ([lon, lat]) => toLocal(lat, lon);
  const runPath = new Path(routes.run.map(toXY), heightAt);
  const bikePath = new Path(routes.bike.map(toXY), heightAt);
  const [sx, sy] = man.start, [dx, dy] = man.dir, rx = dy, ry = -dx;
  const swimPts = [[sx, sy]];
  for (let s = 100; s <= 1840; s += 50) swimPts.push([sx + dx * s - rx * 6, sy + dy * s - ry * 6]);
  for (let s = 1840; s >= 0; s -= 50) swimPts.push([sx + dx * s + rx * 6, sy + dy * s + ry * 6]);
  const swimPath = new Path(swimPts, heightAt, 0, true);

  const scale = coarse ? 0.5 : 1;
  const root = new THREE.Group();
  root.name = 'ISLAND_LIFE';
  scene.add(root);
  const uTime = { value: 0 };
  const mat = kitMaterial();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
  const layers = {};
  const onLand = (x, y) => heightAt(x, y) > 0.3;
  const gz = (x, y) => Math.max(heightAt(x, y), 0.4);   // ground height at the item itself, not the road
  const isPier = (x, y) => x >= -58 && x <= 28 && y >= -48 && y <= 72;

  // A static layer: instances are ordered so the first `count` are the ones that should appear first.
  function layer(name, geomName, items, { material = mat, tint = null, cast = true } = {}) {
    const g = geo[geomName];
    if (!g || !items.length) return null;
    const im = new THREE.InstancedMesh(g, material, items.length);
    items.forEach((it, i) => {
      q.setFromAxisAngle(UP, it.yaw || 0);
      sc.setScalar(it.s || 1);
      m4.compose(W(it.x, it.y, it.z), q, sc);
      im.setMatrixAt(i, m4);
      if (tint) im.setColorAt(i, it.c || tint[i % tint.length]);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = cast;
    im.count = 0;
    im.name = 'LIFE_' + name;
    root.add(im);
    layers[name] = { mesh: im, total: items.length, target: 0, shown: 0, items };
    return layers[name];
  }

  const xyAt = (s, off) => { const o = runPath.at(s, off); return [o.x, o.y]; };
  // ---------------------------------------------------------------- the finishing stretch on Aliʻi Drive
  const fin = runPath.at(runPath.len - 0.01);
  const finItems = [{ x: fin.x, y: fin.y, z: fin.z - 0.05, yaw: fin.yaw }];
  layer('arch_frame', 'arch_frame', finItems);
  layer('arch_final', 'arch_final', finItems);

  const barrierItems = [];
  for (let s = 6; s < 360; s += 2.5) {
    for (const side of [-1, 1]) {
      const p = runPath.at(runPath.len - s, side * 6.2);
      barrierItems.push({ x: p.x, y: p.y, z: gz(p.x, p.y) - 0.05, yaw: p.yaw, c: TINTS.canopy[(s / 2.5 | 0) % 4] });
    }
  }
  layer('barriers', 'barrier', barrierItems, { tint: TINTS.canopy });

  const standItems = [];
  // One grandstand, on the inland side of Aliʻi Drive (the other side is the seawall).
  // Probe 60 m out on both sides: the ocean side is at or below sea level.
  const inland = [-1, 1].sort((a, b) => heightAt(...xyAt(runPath.len - 22, b * 60)) - heightAt(...xyAt(runPath.len - 22, a * 60)))[0];
  for (const side of [inland]) {
    const p = runPath.at(runPath.len - 22, side * 13);
    if (!onLand(p.x, p.y)) continue;
    p.z = gz(p.x, p.y);
    // Seats rise toward local −Y, so local +Y must point back at the road.
    const toRoad = Math.atan2(-side * Math.cos(p.yaw), side * Math.sin(p.yaw));
    standItems.push({ x: p.x, y: p.y, z: p.z - 0.05, yaw: toRoad - Math.PI / 2, c: TINTS.shirts[1 + side] });
  }
  layer('grandstands', 'grandstand', standItems, { tint: TINTS.shirts });

  const wind = Math.atan2(-0.6, -1); // trade winds push flags toward the south-west
  const poleItems = [], flagItems = [];
  for (let s = 10, i = 0; s < 620; s += 12, i++) {
    for (const side of [-1, 1]) {
      const p = runPath.at(runPath.len - s, side * 8.5);
      if (!onLand(p.x, p.y)) continue;
      const z = gz(p.x, p.y);
      poleItems.push({ x: p.x, y: p.y, z: z - 0.1, yaw: 0 });
      flagItems.push({ x: p.x, y: p.y, z: z + 5.85, yaw: wind, c: TINTS.flags[(i * 2 + (side > 0)) % TINTS.flags.length] });
    }
  }
  layer('poles', 'flagpole', poleItems);
  layer('flags', 'flag', flagItems, { material: flagMaterial(uTime), tint: TINTS.flags, cast: false });

  // ---------------------------------------------------------------- expo on the King Kamehameha lot
  const lot = places.kbr_lot || { x: 40, y: 168 };
  const expoItems = [], popItems = [];
  for (let i = 0; i < 6; i++) {
    const x = lot.x - 14 + (i % 3) * 14, y = lot.y - 6 + Math.floor(i / 3) * 10;
    if (onLand(x, y)) expoItems.push({ x, y, z: Math.max(heightAt(x, y), 0.4) - 0.05, yaw: 0 });
  }
  for (let i = 0; i < 10; i++) {
    const x = lot.x - 22 + i * 4.4, y = lot.y + 14;
    if (onLand(x, y)) popItems.push({ x, y, z: Math.max(heightAt(x, y), 0.4) - 0.05, yaw: 0, c: TINTS.canopy[i % 4] });
  }
  layer('expo', 'expo_tent', expoItems);
  layer('popups', 'tent', popItems, { tint: TINTS.canopy });

  // ---------------------------------------------------------------- aid stations on race day
  const aidItems = [];
  for (let km = 10; km < bikePath.len / 1000 - 8; km += 16) {
    const p = bikePath.at(km * 1000, -9);
    aidItems.push({ x: p.x, y: p.y, z: gz(p.x, p.y) - 0.05, yaw: p.yaw });
  }
  for (let km = 1.6; km < runPath.len / 1000 - 1; km += 1.6) {
    const p = runPath.at(km * 1000, -6);
    if (!isPier(p.x, p.y) && onLand(p.x, p.y)) aidItems.push({ x: p.x, y: p.y, z: gz(p.x, p.y) - 0.05, yaw: p.yaw });
  }
  layer('aid', 'aid', aidItems);

  // ---------------------------------------------------------------- spectators along the finishing stretch
  const r = rng(1010);
  const crowdA = [], crowdB = [];
  for (let s = 4; s < 500; s += 1.4) {
    for (const side of [-1, 1]) {
      const p = runPath.at(runPath.len - s, side * (7.1 + r() * 2.2));
      if (!onLand(p.x, p.y)) continue;
      const it = { x: p.x, y: p.y, z: gz(p.x, p.y) - 0.05, yaw: p.yaw - side * Math.PI / 2 + (r() - 0.5) * 0.8, s: 0.92 + r() * 0.16, c: TINTS.shirts[(r() * 10) | 0] };
      (r() < 0.45 ? crowdB : crowdA).push(it);
    }
  }
  layer('crowd', 'person', crowdA, { tint: TINTS.shirts });
  layer('cheer', 'person_cheer', crowdB, { tint: TINTS.shirts });

  // ---------------------------------------------------------------- beaches: honu, umbrellas, boards, shave ice, leis
  const beachSpots = [];
  const addBeach = (cx, cy, n, spread, seed) => {
    const rr = rng(seed);
    let tries = 0;
    while (beachSpots.length < 400 && n > 0 && tries++ < n * 40) {
      const x = cx + (rr() - 0.5) * spread, y = cy + (rr() - 0.5) * spread;
      const h = heightAt(x, y);
      if (h > 0.25 && h < 4 && !isPier(x, y)) { beachSpots.push({ x, y, z: h, yaw: rr() * 6.28 }); n--; }
    }
  };
  const kam = places.kamakahonu || { x: -30, y: -22 };
  const kah = toLocal(19.5792921, -155.966673); // Kahaluʻu Beach Park (geocodes.json)
  addBeach(kam.x, kam.y, 6, 70, 11);
  addBeach(kah[0], kah[1], 8, 120, 12);
  const honuItems = beachSpots.slice(0, 7).map(b => ({ ...b, z: b.z + 0.02 }));
  const umbItems = beachSpots.slice(7).map((b, i) => ({ ...b, c: TINTS.canopy[i % 4] }));
  layer('honu', 'honu', honuItems);
  layer('umbrellas', 'umbrella', umbItems, { tint: TINTS.canopy });
  layer('boards', 'surfboard', umbItems.map((b, i) => ({ ...b, x: b.x + 2.5, yaw: b.yaw + 1.2, c: TINTS.hulls[i % 4] })), { tint: TINTS.hulls });
  const inn = toLocal(19.6382065, -155.9935801); // Kona Inn Shopping Village
  const iceItems = [];
  for (let k = 0; k < 12 && !iceItems.length; k++) {
    const x = inn[0] + (k % 4 - 1.5) * 12, y = inn[1] + (Math.floor(k / 4) - 1) * 12;
    if (onLand(x, y)) iceItems.push({ x, y, z: heightAt(x, y) - 0.05, yaw: fin.yaw });
  }
  layer('shave_ice', 'shave_ice', iceItems);
  const leiItems = [];
  for (let i = 0; i < 40; i++) {
    const p = runPath.at(runPath.len - 1 - (i % 10) * 0.6, ((i / 10 | 0) - 1.5) * 1.6 + (r() - 0.5));
    leiItems.push({ x: p.x, y: p.y, z: gz(p.x, p.y) + 0.02, yaw: r() * 6.28 });
  }
  layer('leis', 'lei', leiItems);

  // ---------------------------------------------------------------- coral messages on the Queen K lava
  function messageStones(text, at, yaw, seed) {
    const cv = document.createElement('canvas');
    cv.width = 360; cv.height = 64;
    const cx = cv.getContext('2d');
    cx.font = '900 46px Arial, sans-serif';
    cx.textBaseline = 'middle';
    const w = Math.min(356, cx.measureText(text).width);
    cx.fillText(text, (360 - w) / 2, 34, 356);
    const px = cx.getImageData(0, 0, 360, 64).data;
    const out = [], rr = rng(seed), k = 0.16, c = Math.cos(yaw), s = Math.sin(yaw);
    for (let j = 0; j < 64; j += 3) for (let i = 0; i < 360; i += 3) {
      if (px[(j * 360 + i) * 4 + 3] < 128) continue;
      const u = (i - 180) * k, v = (32 - j) * k;              // u along the text, v up the letters
      const x = at.x - u * c + v * s, y = at.y - u * s - v * c; // readable from the road, tops away from it
      out.push({ x, y, z: Math.max(heightAt(x, y), 0.3) + 0.02, yaw: rr() * 6.28, s: 0.8 + rr() * 0.5 });
    }
    return out;
  }
  const coralGroups = [];
  const nMsg = coarse ? 7 : MESSAGES.length;
  for (let i = 0; i <= nMsg; i++) {
    const km = 7 + i * 1.3;                                    // out of town, on the lava
    const p = bikePath.at(km * 1000, -16);
    const text = i === nMsg ? `GO ${(playerName || 'ATHLETE').toUpperCase().slice(0, 12)}` : MESSAGES[i];
    coralGroups.push(messageStones(text, p, p.yaw, 50 + i));
  }
  const coralItems = coralGroups.flat();
  const coralEnds = []; // cumulative stone count per message, so `count` reveals whole messages
  coralGroups.reduce((a, g) => { coralEnds.push(a + g.length); return a + g.length; }, 0);
  layer('coral', 'coral_stone', coralItems, { cast: false });
  const nameMessageAt = bikePath.at((7 + nMsg * 1.3) * 1000, -16);

  // ---------------------------------------------------------------- moving life
  const movers = [];
  // range: [from, to] in metres along the path; agents loop inside it so the field stays where players can see it.
  function mover(name, geomName, path, n, { speed, spread, lane, tint, lift = 0, bob = 0, range = [0, path.len] }) {
    const g = geo[geomName];
    if (!g || n <= 0) return;
    const im = new THREE.InstancedMesh(g, mat, n);
    im.frustumCulled = false;
    im.count = 0;
    im.name = 'LIFE_' + name;
    const rr = rng(name.length * 977 + n);
    const agents = [];
    for (let i = 0; i < n; i++) {
      agents.push({ s: range[0] + rr() * (range[1] - range[0]), v: speed[0] + rr() * (speed[1] - speed[0]), off: lane + (rr() - 0.5) * spread, ph: rr() * 6.28 });
      if (tint) im.setColorAt(i, tint[(rr() * tint.length) | 0]);
    }
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    root.add(im);
    const L = { mesh: im, path, agents, lift, bob, range, total: n, target: 0, shown: 0 };
    movers.push(L);
    layers[name] = L;
  }
  mover('runners', 'runner', runPath, Math.round(260 * scale), { speed: [2.9, 4.4], spread: 4, lane: 1.8, tint: TINTS.shirts, bob: 0.06 });
  mover('cyclists', 'cyclist', bikePath, Math.round(280 * scale), { speed: [9, 12.5], spread: 3, lane: 2.2, tint: TINTS.shirts, range: [1500, 42000] });
  mover('finishers', 'runner', runPath, Math.round(90 * scale), { speed: [3.0, 4.2], spread: 3, lane: 0.5, tint: TINTS.shirts, bob: 0.06, range: [runPath.len - 3000, runPath.len] });
  mover('swimmers', 'swimmer', swimPath, Math.round(180 * scale), { speed: [1.1, 1.7], spread: 8, lane: 0, tint: [new THREE.Color(0xff5a36), new THREE.Color(0xffd23f), new THREE.Color(0xffffff), new THREE.Color(0x3a86ff)], lift: -0.02 });

  // Canoes paddle loops in the bay; a few honu swim near the pier.
  const bayLoops = [];
  const canoes = new THREE.InstancedMesh(geo.canoe, mat, 5);
  canoes.frustumCulled = false; canoes.count = 0; canoes.name = 'LIFE_canoes';
  for (let i = 0; i < 5; i++) {
    bayLoops.push({ cx: -120 - i * 60, cy: -260 - i * 90, R: 140 + i * 45, w: 0.012 + i * 0.002, ph: i * 1.3 });
    canoes.setColorAt(i, TINTS.hulls[i % 4]);
  }
  canoes.instanceColor.needsUpdate = true;
  root.add(canoes);
  layers.canoes = { mesh: canoes, total: 5, target: 0, shown: 0 };

  // ---------------------------------------------------------------- daily shells (positions supplied by rewards.js)
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc46b, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.1 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb000, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.6 });
  const shellGroup = new THREE.Group();
  shellGroup.name = 'LIFE_shells';
  root.add(shellGroup);
  const shellBeam = new THREE.CylinderGeometry(0.05, 0.4, 14, 8, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  let shells = [];
  function setShells(list) {
    shellGroup.clear();
    shells = list.map(sh => {
      const g = new THREE.Group();
      const z = Math.max(heightAt(sh.x, sh.y), 0.3);
      g.position.copy(W(sh.x, sh.y, z + 0.35));
      const m = new THREE.Mesh(geo.shell, sh.golden ? goldMat : shellMat);
      m.scale.setScalar(2.2);
      const beam = new THREE.Mesh(shellBeam, beamMat);
      beam.position.y = 7;
      g.add(m, beam);
      g.visible = !sh.found;
      shellGroup.add(g);
      return { ...sh, g, m };
    });
  }

  // ---------------------------------------------------------------- phases
  const TARGETS = {
    quiet: { honu: 1, umbrellas: 1, boards: 1, shave_ice: 1, canoes: 0.6, runners: 0.03, cyclists: 0.02, swimmers: 0.04, crowd: 0.02 },
    build: { arch_frame: 1, expo: 1, popups: 1, poles: 1, flags: 0.35, honu: 1, umbrellas: 1, boards: 1, shave_ice: 1, canoes: 1,
      runners: 0.12, cyclists: 0.1, swimmers: 0.14, crowd: 0.06, coral: 0.3 },
    final: { finishers: 0.1, arch_final: 1, barriers: 1, grandstands: 1, expo: 1, popups: 1, poles: 1, flags: 1, honu: 0.8, umbrellas: 1, boards: 1,
      shave_ice: 1, canoes: 1, runners: 0.14, cyclists: 0.12, swimmers: 0.12, crowd: 0.35, cheer: 0.3, coral: 0.8 },
    race: { finishers: 1, arch_final: 1, barriers: 1, grandstands: 1, expo: 1, popups: 1, poles: 1, flags: 1, aid: 1, shave_ice: 1, canoes: 0.4,
      runners: 1, cyclists: 1, swimmers: 1, crowd: 1, cheer: 1, coral: 1, honu: 0.5 },
    after: { finishers: 0.05, arch_final: 1, barriers: 0.35, poles: 1, flags: 1, leis: 1, expo: 0.5, honu: 1, umbrellas: 1, boards: 1, shave_ice: 1,
      canoes: 1, runners: 0.05, cyclists: 0.04, swimmers: 0.05, crowd: 0.1, coral: 1 },
  };
  let phase = null, dayIdx = -1;

  function setDay(idx, completedDays) {
    const next = phaseFor(idx, completedDays);
    const t = { ...TARGETS[next] };
    if (next === 'build') {                                  // the week visibly grows day by day
      const k = Math.max(1, idx) / 5;
      t.flags = 0.2 + 0.8 * k * 0.7;
      t.coral = 0.15 + 0.6 * k;
      t.runners = 0.08 + 0.08 * k;
    }
    if (idx === 6) t.crowd = 0.7;                            // Underpants Run morning on Aliʻi
    for (const [name, L] of Object.entries(layers)) {
      let n = Math.round((t[name] || 0) * L.total);
      if (name === 'coral') {                                // reveal whole messages; the named one only from race day
        const k = Math.round((t.coral || 0) * (coralEnds.length - 1));
        const withName = next === 'race' || next === 'after';
        n = k <= 0 ? 0 : coralEnds[Math.min(k, coralEnds.length - 1) - 1];
        if (withName) n = coralEnds[coralEnds.length - 1];
      }
      L.target = n;
    }
    setPierBikes?.(idx >= 7);                                // bike check-in on Fri 9 fills the pier racks
    const changed = next !== phase;
    const prevDay = dayIdx;
    phase = next;
    dayIdx = idx;
    return { phase: next, changed, dayChanged: prevDay !== idx, info: PHASES[next] };
  }

  // ---------------------------------------------------------------- per-frame
  const tmp = {}, qq = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  let time = 0;
  function update(dt, camera) {
    time += dt;
    uTime.value = time;
    // Instances appear in a short wave rather than all at once.
    for (const L of Object.values(layers)) {
      if (L.shown !== L.target) {
        const step = Math.max(1, Math.ceil(L.total * dt * 0.8));
        L.shown = L.shown < L.target ? Math.min(L.target, L.shown + step) : Math.max(L.target, L.shown - step);
        L.mesh.count = L.shown;
      }
    }
    const cam = camera.position;
    for (const L of movers) {
      const n = L.mesh.count;
      if (!n) continue;
      for (let i = 0; i < n; i++) {
        const a = L.agents[i];
        a.s += a.v * dt;
        if (a.s > L.range[1]) a.s = L.range[0] + (a.s - L.range[1]);
        L.path.at(a.s, a.off, tmp);
        const bob = L.bob ? Math.abs(Math.sin(time * a.v * 2.6 + a.ph)) * L.bob : 0;
        qq.setFromAxisAngle(UP, tmp.yaw);
        m4.compose(W(tmp.x, tmp.y, tmp.z + L.lift + bob), qq, s1);
        L.mesh.setMatrixAt(i, m4);
      }
      L.mesh.instanceMatrix.needsUpdate = true;
    }
    if (canoes.count) {
      for (let i = 0; i < canoes.count; i++) {
        const c = bayLoops[i], a = c.ph + time * c.w;
        const x = c.cx + Math.cos(a) * c.R, y = c.cy + Math.sin(a) * c.R * 0.6;
        qq.setFromAxisAngle(UP, Math.atan2(Math.cos(a) * c.R * 0.6, -Math.sin(a) * c.R));
        m4.compose(W(x, y, Math.sin(time * 1.3 + i) * 0.08), qq, s1);
        canoes.setMatrixAt(i, m4);
      }
      canoes.instanceMatrix.needsUpdate = true;
    }
    const cheer = layers.cheer;
    if (cheer && cheer.mesh.count && phase === 'race' && Math.hypot(cam.x - fin.x, -cam.z - fin.y) < 700) {
      for (let i = 0; i < cheer.mesh.count; i++) {
        const it = cheer.items[i];
        q.setFromAxisAngle(UP, it.yaw);
        sc.setScalar(it.s || 1);
        m4.compose(W(it.x, it.y, it.z + Math.max(0, Math.sin(time * 7 + i * 1.7)) * 0.18), q, sc);
        cheer.mesh.setMatrixAt(i, m4);
      }
      cheer.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const sh of shells) {
      if (!sh.g.visible) continue;
      sh.m.rotation.y = time * 1.5;
      sh.m.position.y = Math.sin(time * 2 + sh.x) * 0.12;
    }
  }

  // Honu etiquette: within 15 m you have spotted one; closer than 3 m (10 ft) is too close.
  function nearestHonu(x, y) {
    let best = null, bd = 1e9;
    const n = layers.honu ? layers.honu.mesh.count : 0;
    for (let i = 0; i < n; i++) {
      const h = honuItems[i], d = Math.hypot(h.x - x, h.y - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best === null ? null : { id: 'honu' + best, dist: bd };
  }

  return {
    setDay,
    update,
    setShells,
    hideShell(id) { const s = shells.find(z => z.id === id); if (s) s.g.visible = false; },
    get shells() { return shells; },
    nearestHonu,
    get phase() { return phase; },
    finish: { x: fin.x, y: fin.y, z: fin.z, yaw: fin.yaw },
    nameMessage: { x: nameMessageAt.x, y: nameMessageAt.y, yaw: nameMessageAt.yaw },
    stats: () => Object.fromEntries(Object.entries(layers).map(([k, L]) => [k, `${L.mesh.count}/${L.total}`])),
    root,
  };
}
