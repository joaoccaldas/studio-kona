// KONA — IRONMAN World Championship Living Memory & 3D Game World
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { TileStreamer } from './tiles.js';
import { createLocomotion } from './locomotion.js';
import { RACE_WEEK_QUESTS, loadGameSave, saveGameProgress } from './gameQuests.js';
import { applyOfficialWeek, courseOpen } from './weekCampaign.js';
import { createEchoMarkers } from './echoMarkers.js';
import { createPierMuseumStudio } from './pierMuseumStudio.js';
import { createHawaiianScavengerHunt } from './hawaiianScavengerHunt.js';
import { playMemoryChime, playUnlockFanfare } from './audio.js';
import { createProgress } from './progress.js';
import { initMuseumDrawer } from './museumDrawer.js';
import { initArtifactModal } from './artifactModal.js';
import { KOA, loadPlayer, savePlayer, createExplorer, buildAirport } from './explore.js';
import { mountFlights } from './flights.js';
import { createWinnersHall } from './winnersHall.js';
import { createIslandLife, PHASES } from './islandLife.js';
import { createRewards, XP_FOR, CREDITS_FOR } from './rewards.js';
import { createLifeHud } from './lifeHud.js';
import { runApartment } from './apartment.js';
import { runTransitionTangle, TRANSITION } from './transitionTangle.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
// Hosts that don't serve .glb (e.g. a Claude artifact) get the same models as embedded glTF JSON: the host page sets
// window.KONA_GLB_SUFFIX = '.json' and every loader asks for "<model>.glb.json" instead. Off by default.
if (typeof window !== 'undefined' && window.KONA_GLB_SUFFIX) {
  THREE.DefaultLoadingManager.setURLModifier(u => (/\.glb(\?|$)/.test(u) ? u.replace(/\.glb(?=\?|$)/, '.glb' + window.KONA_GLB_SUFFIX) : u));
}
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const A = 'assets/';
const W = (x, y, z = 0) => new THREE.Vector3(x, z, -y); // survey (x east, y north, z up) -> Three.js
const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

// ------------------------------------------------------------------ Renderer
const renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: !coarse, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.xr.enabled = false;
let dpr = Math.min(devicePixelRatio, coarse ? 1.25 : 1.75);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.4, 420000);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.01;
controls.minDistance = 2;
controls.maxDistance = 80000;

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ Sky & Sun
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
sun.castShadow = false;
scene.add(sun);
const amb = new THREE.AmbientLight(0xd8ecff, 0.85);
scene.add(amb);
scene.fog = new THREE.FogExp2(0xa7cbe8, 0.00011);

const skyU = sky.material.uniforms;
skyU.turbidity.value = 2.2;
skyU.rayleigh.value = 1.4;
skyU.mieCoefficient.value = 0.005;
skyU.mieDirectionalG.value = 0.82;

let hour = 7.25;
function setHour(h) {
  hour = h;
  const th = (h - 6) / 12 * Math.PI;
  const el = Math.max(0.01, Math.sin(th));
  const az = -Math.cos(th);
  const p = new THREE.Vector3(az * 0.8, el, -0.3).normalize();
  sun.position.copy(p).multiplyScalar(50000);
  skyU.sunPosition.value.copy(p);
  const sunset = Math.exp(-((h - 18) ** 2) / 0.8) + Math.exp(-((h - 6) ** 2) / 0.8);
  const warm = new THREE.Color(0xfff4e0).lerp(new THREE.Color(0xff8844), sunset * 0.85);
  sun.color.copy(warm);
  sun.intensity = Math.max(0.1, el) * (2.8 - sunset * 0.8);
  const fogC = new THREE.Color(0xa7cbe8).lerp(new THREE.Color(0x281c2c), Math.max(0, 1 - el * 2));
  scene.fog.color.copy(fogC);
  renderer.toneMappingExposure = 0.85 + Math.sin(th) * 0.35;

  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const clockEl = $('#clock');
  if (clockEl) clockEl.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} HST`;
}

// ------------------------------------------------------------------ Gerstner Ocean
let ocean;
function makeOcean() {
  const g = new THREE.PlaneGeometry(1800, 1800, coarse ? 90 : 160, coarse ? 90 : 160);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: sun.position },
      uSunColor: { value: sun.color },
      uSkyColor: { value: new THREE.Color(0x0e5d7a) },
      uDeepColor: { value: new THREE.Color(0x04243d) },
      uFoamColor: { value: new THREE.Color(0xeef9fc) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vWave;

      vec3 gerstner(vec2 dir, float a, float w, float phi, float q, vec2 p, inout vec3 n) {
        float x = dot(dir, p) * w + uTime * phi;
        float c = cos(x), s = sin(x);
        n.x -= dir.x * w * a * c;
        n.z -= dir.y * w * a * c;
        n.y -= q * w * a * s;
        return vec3(q * a * dir.x * c, a * s, q * a * dir.y * c);
      }

      void main() {
        vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 n = vec3(0.0, 1.0, 0.0);
        vec3 d = vec3(0.0);
        d += gerstner(normalize(vec2(0.8, 0.3)), 0.16, 0.08, 1.3, 0.4, p.xz, n);
        d += gerstner(normalize(vec2(-0.4, 0.7)), 0.09, 0.16, 1.9, 0.35, p.xz, n);
        d += gerstner(normalize(vec2(0.2, 0.9)), 0.04, 0.35, 2.7, 0.25, p.xz, n);
        p += d;
        vWave = d.y;
        vNormal = normalize(n);
        vWorldPos = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSun;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform vec3 uDeepColor;
      uniform vec3 uFoamColor;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vWave;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSun);
        float fresnel = pow(1.0 - max(0.0, dot(V, N)), 3.5);
        vec3 R = reflect(-L, N);
        float spec = pow(max(0.0, dot(V, R)), 85.0) * 1.2;
        vec3 col = mix(uDeepColor, uSkyColor, fresnel * 0.75 + 0.25);
        float crest = smoothstep(0.32, 0.46, vWave);
        col = mix(col, uFoamColor, crest * 0.14);
        col += uSunColor * spec;
        gl_FragColor = vec4(col, 0.88);
      }
    `,
    transparent: true,
  });
  ocean = new THREE.Mesh(g, m);
  ocean.position.y = 0.25;
  scene.add(ocean);
}

// ------------------------------------------------------------------ Materials & Helpers
const grounds = new Set();
let farIsland = null;
let highwayStart = null;
let highwayAim = null;
const briefings = [];
function addGround(m) {
  if (!m || !m.isMesh) return;
  m.geometry.computeBoundsTree();
  grounds.add(m);
}

const tex = new THREE.TextureLoader();
function orthoMaterial(file, meta, seabed) {
  const t = tex.load(A + file);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  if (seabed) {
    m.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
        vec4 tc = texture2D(map, vMapUv);
        float l = dot(tc.rgb, vec3(.3,.59,.11));
        diffuseColor.rgb = mix(vec3(.03,.11,.16), vec3(.08,.24,.32), l);
      `);
    };
  }
  return m;
}

// ------------------------------------------------------------------ Game Systems
let locomotion = null;
let echoMarkers = null;
let pierMuseumStudio = null;
let hawaiianHunt = null;
let progress = null, drawer = null, artifactViewer = null;
let saveData = loadGameSave();
let currentDay = RACE_WEEK_QUESTS[0];
let currentStep = currentDay.steps[0];
let pierBikesMesh = null;
let living = null, rewards = null, lifeHud = null, geocodes = {}, raceWeekData = null, roaming = false;
let streamer = null;
let man = null;
let explorer = null;

// ------------------------------------------------------------------ Load Assets
async function load() {
  console.log('[Kona] Starting load()...');
  man = await (await fetch(A + 'kona_manifest.json')).json();
  console.log('[Kona] Loaded manifest, loading kona_p1.glb...');
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(
    A + 'kona_p1.glb',
    e => { if (e.total) $('#bar').style.width = (e.loaded / e.total * 100) + '%'; }
  );
  console.log('[Kona] Loaded kona_p1.glb, parsing scene...');

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
    if (o.name.startsWith('KONA_roofs')) o.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    if (o.name.startsWith('PROTO_')) { protos[o.name.slice(6)] = o; o.visible = false; }
  });
  scene.add(gltf.scene);

  // Racked bikes on Kailua Pier (all 580 transition bikes)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const cols = [0xd81b1b, 0x111111, 0xeeeeee, 0x1b4fd8, 0xf29a0c, 0x1a9a4d, 0x00e5ff].map(c => new THREE.Color(c));

  if (protos.bike && man.bikes && man.bikes.length) {
    pierBikesMesh = new THREE.InstancedMesh(
      protos.bike.geometry,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.25 }),
      man.bikes.length
    );
    man.bikes.forEach((b, i) => {
      q.setFromAxisAngle(up, b.rot);
      m4.compose(W(b.x, b.y, man.pier_deck || 2.15), q, s);
      pierBikesMesh.setMatrixAt(i, m4);
      pierBikesMesh.setColorAt(i, cols[b.c % cols.length]);
    });
    pierBikesMesh.instanceMatrix.needsUpdate = true;
    if (pierBikesMesh.instanceColor) pierBikesMesh.instanceColor.needsUpdate = true;
    scene.add(pierBikesMesh);
  }

  // Palms
  if (protos.palm && man.trees) {
    const im = new THREE.InstancedMesh(protos.palm.geometry, protos.palm.material, man.trees.length);
    man.trees.forEach((t, i) => {
      q.setFromAxisAngle(up, (t.x * 7.1) % 6.28);
      const k = 0.85 + ((Math.abs(t.y) * 13.7) % 1) * 0.3;
      m4.compose(W(t.x, t.y, t.z), q, new THREE.Vector3(k, k, k));
      im.setMatrixAt(i, m4);
    });
    scene.add(im);
  }

  gltf.scene.traverse(o => {
    if (o.name === 'KONA_far') {
      o.visible = true;
      o.renderOrder = -1;
    }
  });
  // Whole-island DEM must exist before anything samples heightAt (routes, POIs, locomotion, markers).
  console.log('[Kona] Loading island DEM...');
  await island().catch(e => console.warn('Island DEM load error; terrain falls back to sea level:', e));
  console.log('[Kona] Loading routes and pois...');
  routes();
  pois();

  gltf.scene.traverse(o => {
    if (o.isMesh && /KONA_(terrain|pier|heiau_platform|breakwater)/.test(o.name)) addGround(o);
  });

  console.log('[Kona] Initializing TileStreamer...');
  streamer = new TileStreamer({
    scene,
    W,
    base: A + 'tiles/',
    radius: (coarse || matchMedia('(pointer: coarse)').matches) ? 1000 : 1600,
    palm: protos.palm,
    onGround: (g, add) => g.traverse(o => { if (o.userData.ground) add ? addGround(o) : grounds.delete(o); })
  });
  await streamer.init().catch(e => { console.warn('TileStreamer init error:', e); streamer = null; });

  console.log('[Kona] Building ocean, coffee boat, systems...');
  coffeeBoat();
  makeOcean();
  setHour(hour);

  // Initialize Locomotion, Echo Markers, Canyon Studio Pier Museum & Hawaiian Heritage Hunt
  locomotion = createLocomotion({ camera, renderer, scene, W, grounds, heightAt, toast, onModeRequest: m => setLocomotionMode(m) });
  echoMarkers = createEchoMarkers({ scene, W, heightAt });
  pierMuseumStudio = createPierMuseumStudio({ scene, camera, W, heightAt, toast, progress: () => progress });
  createWinnersHall({ scene, W, heightAt, addGround, progress: () => progress, base: A, explorer, grounds }).then(hall => { window.__winners = hall; }).catch(e => console.warn('Winners hall failed', e));
  hawaiianHunt = createHawaiianScavengerHunt({ scene, camera, W, heightAt, toast });
  progress = createProgress(saveData, { heritage: () => hawaiianHunt?.progress, save: () => saveGameProgress(saveData), toast, quests: RACE_WEEK_QUESTS });
  artifactViewer = initArtifactModal(() => saveGameProgress(saveData));
  drawer = initMuseumDrawer(art => artifactViewer.show(art, false), idx => jumpToDay(idx));

  console.log('[Kona] Loading the official race week...');
  raceWeekData = await applyOfficialWeek(RACE_WEEK_QUESTS, A).catch(e => { console.warn('Official week failed; scripted days remain.', e); return null; });
  console.log('[Kona] Initializing game loop...');
  initGameLoop();

  console.log('[Kona] Bringing the island to life...');
  await initIslandLife().catch(e => console.warn('Island life failed', e));

  console.log('[Kona] Load completed successfully!');
  const reveal = () => { $('#loading').classList.add('done'); document.body.classList.remove('flying'); arrive(); };
  const wait = flightUntil ? Math.max(0, flightUntil - performance.now()) : 0;
  if (wait) setTimeout(reveal, wait); else reveal();
}

function arrive() {
  const player = loadPlayer();
  const koa = toLocal(KOA.lat, KOA.lon);
  const airport = buildAirport(scene, W, heightAt, koa);
  koaStand = airport.stand;
  // First arrival: on foot at the terminal curb with a bike box to collect. Returning: where you left off.
  const boxed = !bikeReady();
  const sx = player?.last?.x ?? (boxed ? airport.stand[0] : highwayStart?.[0] ?? airport.stand[0]);
  const sy = player?.last?.y ?? (boxed ? airport.stand[1] : highwayStart?.[1] ?? airport.stand[1]);
  const face = player?.last ? [0, 0] : boxed ? airport.look : (highwayAim || airport.look);
  explorer?.stamp(koa[0], koa[1], 2800);
  explorer?.stamp(sx, sy, 800);
  const h = Math.max(heightAt(sx, sy), airport.h, 0);
  const look = W(face[0], face[1], h);
  const here = W(sx, sy, h);
  const yaw = Math.atan2(-(look.x - here.x), -(look.z - here.z));
  setLocomotionMode(player?.last || boxed ? 'walk' : 'bike');
  locomotion.teleport(here.x, h + 1.7, here.z, yaw, -0.15);
  const who = player?.name ? player.name : 'Athlete';
  const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
  const times = player?.visits > 1 ? `${ord(player.visits)} time in Kona` : 'first time in Kona';
  if (player?.last) toast(`${who}, welcome back. Ride south. The island opens as you go.`);
  else if (boxed) setTimeout(() => toast(`Aloha, ${who}. Your bike box is at baggage claim.`), 900);
  $('#cap').innerHTML = boxed ? `<b>${KOA.short}</b><span>Baggage claim. Collect your bike box and build your bike.</span>`
    : `<b>${KOA.short}</b><span>${KOA.name}. Ride toward Kailua-Kona.</span>`;
  const sub = document.querySelector('.top-sub');
  if (sub && player?.name) sub.textContent = `${player.name} · ${times}`;
  arrived = true;
  mountFlights({ open: false });
  if (rewards) setTimeout(() => welcomeDispatch(), player?.last ? 600 : 2400);
}

// ------------------------------------------------------------------ Living island + rewards
async function initIslandLife() {
  rewards = rewards || createRewards({ onChange: () => lifeHud?.wallet() });
  lifeHud = createLifeHud({ rewards });
  geocodes = await (await fetch(A + 'geocodes.json')).json().catch(() => ({}));
  const player = loadPlayer();
  living = await createIslandLife({
    scene, W, heightAt, man, toLocal, coarse,
    places: raceWeekData?.places || {},
    playerName: player?.name,
    setPierBikes: v => { if (pierBikesMesh) pierBikesMesh.visible = v; },
    base: A,
  });
  window.__island = living;
  const rr = await (await fetch(A + 'routes.json')).json();
  const run = rr.run.map(([lon, lat]) => toLocal(lat, lon));
  runLocal = d => { let acc = 0; for (let i = 1; i < run.length; i++) { const l = Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]); if (acc + l >= d) { const t = (d - acc) / l; return [run[i - 1][0] + (run[i][0] - run[i - 1][0]) * t, run[i - 1][1] + (run[i][1] - run[i - 1][1]) * t]; } acc += l; } return null; };
  placeShells();
}

// Shells sit on open ground: beaches, the seawall, the lot, the finish and Aliʻi Drive itself (never inside buildings).
let runLocal = null;
function shellSpots() {
  const P = raceWeekData?.places || {};
  const spots = [];
  const add = (name, xy, spread = 12) => { if (xy) spots.push({ name, x: xy[0], y: xy[1], spread }); };
  add('Kamakahonu beach', P.kamakahonu && [P.kamakahonu.x, P.kamakahonu.y], 20);
  add('the Aliʻi seawall', P.hale && [P.hale.x, P.hale.y], 8);
  add('the King Kamehameha lot', P.kbr_lot && [P.kbr_lot.x, P.kbr_lot.y], 16);
  add('the Underpants Run turn', P.upr_turn && [P.upr_turn.x, P.upr_turn.y], 4);
  if (living) add('the finish line', [living.finish.x, living.finish.y], 6);
  const g = geocodes.kahaluu;
  if (g) add('Kahaluʻu Beach', toLocal(g.lat, g.lon), 30);
  for (const km of [2.5, 4, 5.5, 7, 9]) {
    const p = runLocal?.(km * 1000);
    if (p) add(`Aliʻi Drive, run km ${km}`, p, 3);
  }
  return spots.filter(s => heightAt(s.x, s.y) > 0.3);
}
function placeShells() {
  if (!living || !rewards) return;
  const list = rewards.todaysShells(shellSpots()).map(sh => {
    if (heightAt(sh.x, sh.y) > 0.3) return sh;
    const spot = shellSpots().find(s => s.name === sh.where);
    return spot ? { ...sh, x: spot.x, y: spot.y } : sh;
  });
  living.setShells(list);
}

// Apply the island state for the day being played. Shows what changed when the phase moves on.
function syncIsland(extraGrant = null, eyebrow = null) {
  if (!living) return;
  const r = living.setDay(saveData.currentDayIndex || 0, saveData.completedDays);
  const phaseGrant = r.changed ? rewards.seePhase(r.phase) : null;
  if (r.changed && (phaseGrant || extraGrant)) {
    const merged = mergeGrants(extraGrant, phaseGrant);
    lifeHud.dispatch({
      eyebrow: eyebrow || `Race week · ${currentDay.title}`,
      title: r.info.name,
      news: r.info.news,
      grant: merged,
      note: r.phase === 'quiet' ? 'The island changes with every race-week day you play. Come back tomorrow to open the next one.' : '',
    });
    return true;
  }
  return false;
}
function mergeGrants(a, b) {
  if (!a) return b;
  if (!b) return a;
  return { xp: a.xp + b.xp, credits: a.credits + b.credits, items: [...(a.items || []), ...(b.items || [])], levelUp: Math.max(a.levelUp || 0, b.levelUp || 0) };
}
function welcomeDispatch() {
  const gift = rewards.checkIn();
  resumePendingDay();
  const shown = syncIsland(gift, gift?.first ? 'Welcome to Kona' : gift ? `Day ${gift.streak} in a row` : null);
  if (!shown && gift) {
    lifeHud.dispatch({
      eyebrow: gift.streak > 1 ? `Day ${gift.streak} in a row · ×${rewards.multiplier.toFixed(1)} on everything you earn` : 'Welcome back',
      title: `Today on the island: ${PHASES[living?.phase || 'quiet'].name}`,
      news: ['Five new shells are hidden on beaches and in town.', ...PHASES[living?.phase || 'quiet'].news.slice(0, 2)],
      grant: gift,
    });
  }
  if (!gift) syncIsland();
  if (saveData.pendingDay != null) enterFreeRoam();
}
// A day finished earlier opens once rewards.daysOpen allows it.
function resumePendingDay() {
  const next = saveData.pendingDay;
  if (next == null || !rewards) return false;
  if (next >= rewards.daysOpen(RACE_WEEK_QUESTS.length)) return false;
  saveData.pendingDay = null;
  roaming = false;
  saveData.currentDayIndex = next;
  saveData.currentStepIndex = 0;
  currentDay = RACE_WEEK_QUESTS[next];
  currentStep = currentDay.steps[0];
  saveGameProgress(saveData);
  setHour(currentDay.startHour || 7.25);
  $('#hour').value = currentDay.startHour || 7.25;
  setupActiveStep();
  updateHUD();
  return true;
}
// While the next day is closed: free roam, with the compass on the nearest shell of the day.
function enterFreeRoam() {
  roaming = true;
  const next = RACE_WEEK_QUESTS[saveData.pendingDay];
  $('#questDayNum').textContent = `DAY ${currentDay.dayNumber} · DONE`;
  $('#questDayTitle').textContent = next ? `${next.title} opens tomorrow` : 'Race week complete';
  $('#questDayDesc').textContent = 'Free roam: find today’s shells, spot honu from 3 m away, ride the Queen K. The island changes with the next day.';
  $('#questStepCount').textContent = `SHELLS ${rewards.shellsFoundToday()} / 5`;
  $('#questChecklist').innerHTML = '';
  $('#questProgressFill').style.width = '100%';
  aimAtShell();
}
function aimAtShell() {
  if (!living || !echoMarkers) return;
  const px = camera.position.x, py = -camera.position.z;
  const left = living.shells.filter(s => s.g.visible);
  if (!left.length) { $('#compassLabel').textContent = 'All of today’s shells found'; return; }
  left.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
  const s = left[0];
  echoMarkers.setTarget([s.x, s.y], `🐚 Shell · ${s.where}`, 0, false, 0xffd166);
  $('#compassLabel').textContent = `Shell near ${s.where}`;
}

let lifeT = 0, honuWarnT = 0;
function lifeTick(dt) {
  if (!living || !rewards) return;
  lifeT += dt;
  if (lifeT < 0.25) return;
  lifeT = 0;
  const px = camera.position.x, py = -camera.position.z;
  const onFoot = locomotion?.getState().active;
  for (const sh of living.shells) {
    if (!sh.g.visible) continue;
    const d = Math.hypot(sh.x - px, sh.y - py);
    if (d < (onFoot ? 4 : 0)) {
      living.hideShell(sh.id);
      const g = rewards.pickShell(sh);
      lifeHud.pop(g, sh.golden ? 'Golden cowrie!' : `Shell found · ${rewards.shellsFoundToday()}/5`);
      if (roaming) { $('#questStepCount').textContent = `SHELLS ${rewards.shellsFoundToday()} / 5`; aimAtShell(); }
    }
  }
  const h = onFoot ? living.nearestHonu(px, py) : null;
  if (h && h.dist < 3 && performance.now() - honuWarnT > 15000) {
    honuWarnT = performance.now();
    toast('Too close. Give honu at least 3 m (10 ft) of space: it is the rule on Hawaiʻi beaches.');
  } else if (h && h.dist < 15 && h.dist >= 3) {
    const g = rewards.spotHonu(h.id);
    if (g) lifeHud.pop(g, 'Honu spotted');
  }
}

// ------------------------------------------------------------------ Quest & Progression Engine
function initGameLoop() {
  if ((saveData.completedDays || []).some(id => String(id).startsWith('day'))) {
    saveData.completedDays = [];
    saveData.currentDayIndex = 0;
    saveData.currentStepIndex = 0;
    saveGameProgress(saveData);
  }
  const dayIdx = Math.min(saveData.currentDayIndex || 0, RACE_WEEK_QUESTS.length - 1);
  currentDay = RACE_WEEK_QUESTS[dayIdx];
  const stepIdx = Math.min(saveData.currentStepIndex || 0, currentDay.steps.length - 1);
  currentStep = currentDay.steps[stepIdx];

  setupActiveStep();
  updateHUD();
  if (coarse) {
    const card = $('#questCard');
    card?.addEventListener('click', ev => {
      if (ev.target.closest('button')) return;
      card.classList.toggle('open');
    });
  }

  // Mode Toggle Button (Cycles Walk -> Bike -> Drone Fly)
  const modeBtn = $('#btnModeToggle');
  if (modeBtn) {
    modeBtn.onclick = () => {
      const state = locomotion ? locomotion.getState() : { active: false, mode: 'walk' };
      if (!state.active) {
        setLocomotionMode('walk');
      } else if (state.mode === 'walk') {
        setLocomotionMode('bike');
      } else {
        setLocomotionMode('fly');
      }
    };
  }

  // Key shortcuts for modes
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') {
      const state = locomotion ? locomotion.getState() : { active: false };
      setLocomotionMode(state.active ? 'fly' : 'walk');
    }
  });

  // Teleport Step Button
  const teleBtn = $('#btnTeleportStep');
  if (teleBtn) {
    teleBtn.onclick = () => teleportToActiveStep();
  }

  // Top Museum Button -> Opens Canyon 3D Studio Heritage Museum
  const musBtn = $('#topMuseumBtn');
  if (musBtn) {
    musBtn.onclick = () => {
      if (pierMuseumStudio) pierMuseumStudio.open(); // opens on the latest bike you have unlocked
    };
  }

  const myBtn = $('#topMyKonaBtn');
  if (myBtn) myBtn.onclick = () => openMyKona();

  // Top Heritage Button -> Opens Hawaiian Scavenger Hunt Lore Codex
  const herBtn = $('#topHeritageBtn');
  if (herBtn) {
    herBtn.onclick = () => {
      if (hawaiianHunt) hawaiianHunt.open();
    };
  }

  // INTERACT: one semantic action for keyboard (E) and touch (the on-screen action button).
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyE' || e.repeat) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
    runInteraction();
  });
  const actBtn = $('#actionPrompt');
  if (actBtn) actBtn.onclick = () => runInteraction();

  // Jump Button (Mobile)
  const jumpBtn = $('#jumpBtn');
  if (jumpBtn) {
    jumpBtn.onclick = () => locomotion.jump();
  }

  // Start player immersed on foot at Kailua Pier
  setLocomotionMode('walk');
  if (locomotion) {
    locomotion.teleport(2, 2.15, 8, 0, 0);
  }
}

function setLocomotionMode(targetMode) {
  let mode = targetMode;
  if (typeof targetMode === 'boolean') {
    mode = targetMode ? 'walk' : 'fly';
  }

  if (mode === 'bike' && !bikeReady()) {
    toast('Your bike is still in its box. Build it at KOA baggage claim first.');
    if (locomotion?.getState().mode === 'bike') return;
    mode = locomotion?.getState().active ? 'walk' : mode === 'bike' ? 'walk' : mode;
  }
  document.body.dataset.mode = mode;
  const modeIcon = $('#modeIcon');
  const modeLabel = $('#modeLabel');
  const hint = $('#walkHint');

  if (mode === 'walk') {
    if (locomotion) {
      locomotion.setActive(true);
      locomotion.setMode('walk');
    }
    controls.enabled = false;
    if (modeIcon) modeIcon.textContent = '🚶';
    if (modeLabel) modeLabel.textContent = 'Walk';
    if (hint) {
      hint.textContent = 'WASD Move · Drag/Click Look · Shift Sprint · Space Jump · [B] Ride Bike';
      hint.style.display = 'block';
    }
    toast(bikeReady() ? 'Walk Mode: Explore Kona on foot · [B] Ride Bike' : 'On foot. Your bike is still in its box.');
  } else if (mode === 'bike') {
    if (locomotion) {
      locomotion.setActive(true);
      locomotion.setMode('bike');
    }
    controls.enabled = false;
    if (modeIcon) modeIcon.textContent = '🚴';
    if (modeLabel) modeLabel.textContent = 'Bike';
    if (hint) {
      hint.textContent = 'WASD pedal and steer · Shift tuck · B dismount';
      hint.style.display = 'block';
    }
    toast('On the bike. Pedal with W. Shift is the tuck.');
  } else {
    // fly
    if (locomotion) {
      locomotion.setActive(false);
    }
    controls.enabled = true;
    if (modeIcon) modeIcon.textContent = '✈';
    if (modeLabel) modeLabel.textContent = 'Drone Fly';
    if (hint) hint.style.display = 'none';
    toast('Drone Fly Mode: Drag to Orbit · Scroll to Zoom');
  }
}

function setupActiveStep() {
  if (!currentStep) return;

  const isEcho = !!currentStep.isEcho;
  const label = isEcho ? `✦ Memory Echo: ${currentStep.echoYear}` : `⌖ ${currentStep.text}`;
  const color = currentStep.beaconColor || (isEcho ? 0xff3366 : 0xffcc33);

  echoMarkers.setTarget(currentStep.target, label, currentStep.radius || 15, isEcho, color);

  $('#questDayNum').textContent = `DAY ${currentDay.dayNumber} · ${currentDay.subtitle.toUpperCase()}`;
  $('#questDayTitle').textContent = currentDay.title;
  $('#questDayDesc').textContent = currentDay.description;
  $('#questStepCount').textContent = `ACTION ${(saveData.currentStepIndex || 0) + 1} / ${currentDay.steps.length}`;

  const pct = (((saveData.currentStepIndex || 0)) / currentDay.steps.length) * 100;
  $('#questProgressFill').style.width = `${pct}%`;
  $('#compassLabel').textContent = currentStep.text;

  progress?.beginDay(currentDay.id);
  renderChecklist();
  renderChallenge();
}

function renderChecklist() {
  const container = $('#questChecklist');
  if (!container) return;

  const currentIdx = saveData.currentStepIndex || 0;

  container.innerHTML = currentDay.steps.map((st, i) => {
    let stateClass = 'pending';
    let icon = '○';

    if (i < currentIdx) {
      stateClass = 'done';
      icon = '✓';
    } else if (i === currentIdx) {
      stateClass = 'active';
      icon = st.isEcho ? '✦' : '⌖';
    }

    return `
      <div class="quest-check-item ${stateClass}" data-step="${i}">
        <span class="check-icon">${icon}</span>
        <span>${st.text}</span>
      </div>
    `;
  }).join('');
}

function teleportToActiveStep() {
  if (!currentStep || !currentStep.target) return;
  const [tx, ty] = currentStep.target;
  const away = Math.hypot(camera.position.x - tx, -camera.position.z - ty);
  if (away > 1600) {
    toast(`Ride the highway. Still ${(away / 1000).toFixed(1)} km.`);
    return;
  }

  const spawnX = tx - 4;
  const spawnY = ty + 4;
  let groundZ = Math.max(heightAt ? heightAt(spawnX, spawnY) : 0, 0.2);

  if (spawnX >= -58 && spawnX <= 28 && spawnY >= -48 && spawnY <= 72) {
    groundZ = 2.15; // Pier deck
  }

  const wPos = W(spawnX, spawnY, groundZ);

  if (locomotion.getState().active) {
    locomotion.teleport(wPos.x, wPos.y, wPos.z, -Math.PI / 4, 0.15);
  } else {
    camera.position.set(wPos.x - 12, wPos.y + 6, wPos.z + 12);
    controls.target.copy(wPos);
  }
  explorer?.stamp(spawnX, spawnY, 700);
  toast(`📍 ${currentStep.text}. Take it in, then press [E] when you're ready.`);
}

function completeCurrentStep() {
  if (!currentStep) return;

  const isEcho = !!currentStep.isEcho;

  if (isEcho && currentStep.artifact) {
    playMemoryChime();

    const originalExposure = renderer.toneMappingExposure;
    renderer.toneMappingExposure = 1.6;
    setTimeout(() => { renderer.toneMappingExposure = originalExposure; }, 1200);

    toast(`✦ Memory Echo Discovered: ${currentStep.echoYear} ${currentStep.echoAthlete}`);

    if (!saveData.discoveredMemories.includes(currentStep.echoYear)) {
      saveData.discoveredMemories.push(currentStep.echoYear);
    }
    if (!saveData.unlockedArtifacts.some(a => a.id === currentStep.artifact.id)) {
      saveData.unlockedArtifacts.push(currentStep.artifact);
    }

    if (pierMuseumStudio) {
      const yearIdx = pierMuseumStudio.getBikes().findIndex(b => b.year.includes(currentStep.echoYear));
      // A memory reveals its exhibit if the museum has one; otherwise its artifact in the viewer.
      if (yearIdx >= 0) pierMuseumStudio.open(yearIdx);
      else if (artifactViewer) artifactViewer.show(currentStep.artifact, true);
    }

    saveGameProgress(saveData);
    advanceStep();
  } else {
    playUnlockFanfare();
    const g = rewards?.grantOnce(`step:${currentDay.id}:${currentStep.id}`, { xp: XP_FOR.step, credits: CREDITS_FOR.step, reason: currentStep.text });
    toast(`✓ ${currentStep.text}${g ? ` · +${g.xp} XP · +${g.credits} Credits` : ''}`);

    advanceStep();
  }
}

// Next step within the day, or the next day when this was the last step (echo or not).
function advanceStep() {
  const nextStepIdx = (saveData.currentStepIndex || 0) + 1;
  if (nextStepIdx < currentDay.steps.length) {
    saveData.currentStepIndex = nextStepIdx;
    currentStep = currentDay.steps[nextStepIdx];
    saveGameProgress(saveData);
    setupActiveStep();
    updateHUD();
  } else {
    advanceToNextDayOrFinish();
  }
}

// ------------------------------------------------------------------ Interactions
// Arriving means "you found something", never "done": the player chooses to act.
let currentInteraction = null;
function stepVerb(st) {
  if (st.action) return st.action;
  return st.isEcho ? 'Enter the memory' : 'Interact';
}
// ------------------------------------------------------------------ KOA: collect the bike box, build the bike, first ride
// The bike flew in its box (Pack for Kona). It is built at baggage claim before the first ride; what you forgot to pack
// is sorted out here: forgotten pedals are bought (Credits) or borrowed from the mechanic.
let koaStand = null;
function bikeReady() { return !!loadPlayer()?.bikeBuilt || !loadPlayer(); }
function buildBike() {
  if (!lifeHud) return;
  const player = loadPlayer();
  const noPedals = (player?.packing?.missing || []).includes('pedals');
  const steps = [
    { id: 'pedals', title: noPedals ? 'No pedals in the box' : 'Fit your pedals',
      text: noPedals ? 'You left them at home. The mechanic by the carousel has a pair.' : 'They came off to fit the bike in the box. Left pedal threads the other way.' },
    { id: 'cockpit', title: 'Bars and seatpost', text: 'Aero bars back on, seatpost to your marked height. Torque to spec.' },
    { id: 'tyres', title: 'Pump the tyres', text: 'Air pressure drops on the flight. Back up to race pressure.' },
  ];
  let i = 0;
  const next = () => {
    const s = steps[i];
    if (!s) return done();
    const actions = [];
    if (s.id === 'pedals' && noPedals) {
      const afford = (rewards?.state.credits || 0) >= 40;
      actions.push({ label: afford ? 'Buy a pair · 40 Credits' : 'Buy a pair · need 40 Credits', primary: afford, disabled: !afford,
        run: () => { if (rewards?.spend(40, 'Pedals at KOA')) { toast('Pedals bought. −40 Credits.'); i++; setTimeout(next, 250); } } });
      actions.push({ label: 'Borrow his old ones', primary: !afford, run: () => { toast('Borrowed pedals. Bring them back after the race.'); i++; setTimeout(next, 250); } });
    } else {
      actions.push({ label: 'Done', primary: true, run: () => { i++; setTimeout(next, 250); } });
    }
    lifeHud.sheet(`<div class="d-eyebrow">Build your bike · ${i + 1} / ${steps.length}</div><h2 id="dTitle">${s.title}</h2><p class="d-note">${s.text}</p>`, actions);
  };
  const done = () => {
    savePlayer({ ...loadPlayer(), bikeBuilt: true });
    const g = rewards?.grantOnce('arrival:bike_built', { xp: 60, credits: 20, reason: 'Built your bike at KOA' });
    currentInteraction = null;
    $('#actionPrompt')?.classList.remove('on');
    if (highwayStart && locomotion) {
      const h = Math.max(heightAt(highwayStart[0], highwayStart[1]), 0.4);
      const here = W(highwayStart[0], highwayStart[1], h), look = W(...(highwayAim || [0, 0]), h);
      locomotion.teleport(here.x, h + 1.7, here.z, Math.atan2(-(look.x - here.x), -(look.z - here.z)), -0.1);
    }
    setLocomotionMode('bike');
    $('#cap').innerHTML = `<b>${KOA.short}</b><span>${KOA.name}. Ride toward Kailua-Kona.</span>`;
    lifeHud.pop(g, 'Bike built');
    setTimeout(() => toast('First ride: south on the Queen K to Kailua-Kona. W to pedal, Shift to tuck.'), 1600);
  };
  next();
}

// ------------------------------------------------------------------ Challenges (challenge.js + one file per activity)
const T1 = [4, 18];                                          // transition on Kailua Pier (raceweek places)
function openChallenge(id, after) {
  if (document.body.classList.contains('in-challenge')) return;
  const run = { [TRANSITION.id]: runTransitionTangle }[id];
  if (!run) { after?.(); return; }
  rewards = rewards || createRewards({ onChange: () => lifeHud?.wallet() });
  run({ player: loadPlayer(), rewards, base: A, onExit: () => { lifeHud?.wallet(); after?.(); } })
    .then(api => { window.__challenge = api; })
    .catch(e => { console.error('Challenge failed', e); document.body.classList.remove('in-challenge'); document.getElementById('tt')?.remove(); after?.(); });
}

function refreshInteraction(questReached) {
  let it = null;
  if (arrived && !bikeReady() && koaStand && locomotion?.getState().active && Math.hypot(camera.position.x - koaStand[0], -camera.position.z - koaStand[1]) < 40) {
    it = { key: 'koa:bikebox', label: 'Build your bike', sub: 'Bike box · baggage claim', run: () => buildBike() };
  } else if (questReached && currentStep) {
    it = { key: 'quest:' + currentStep.id, label: stepVerb(currentStep), sub: currentStep.text, run: () => completeCurrentStep() };
  } else if (locomotion?.getState().active && !locomotion.getState().isSwimming && Math.hypot(camera.position.x - T1[0], -camera.position.z - T1[1]) < 22) {
    it = { key: 'challenge:transition', label: 'Play Transition Tangle', sub: 'T1 · beat your best', run: () => openChallenge(TRANSITION.id) };
  } else if (locomotion?.getState().active && pierMuseumStudio) {
    pierMuseumStudio.checkProximity(camera.position, (idx, bike) => {
      it = { key: 'bike:' + idx, label: 'Inspect bike', sub: `${bike.year} · ${bike.name}`, run: () => pierMuseumStudio.open(idx) };
    });
  }
  const el = $('#actionPrompt');
  if ((it && it.key) !== (currentInteraction && currentInteraction.key) && el) {
    if (it) {
      el.innerHTML = `<kbd>E</kbd><b>${it.label}</b><small>${it.sub}</small>`;
      el.classList.add('on');
    } else el.classList.remove('on');
  }
  currentInteraction = it;
}
function runInteraction() {
  if (!currentInteraction) return;
  const it = currentInteraction;
  currentInteraction = null;
  $('#actionPrompt')?.classList.remove('on');
  it.run();
}

function advanceToNextDayOrFinish() {
  if (!saveData.completedDays.includes(currentDay.id)) {
    saveData.completedDays.push(currentDay.id);
  }
  toast(currentDay.lesson ? currentDay.lesson : `Day ${currentDay.dayNumber} complete.`);

  const nextDayIdx = saveData.currentDayIndex + 1;
  const dayGrant = rewards?.grantOnce(`day:${currentDay.id}`, { xp: XP_FOR.day, credits: CREDITS_FOR.day, reason: `Finished ${currentDay.title}` });
  if (rewards && nextDayIdx < RACE_WEEK_QUESTS.length && nextDayIdx >= rewards.daysOpen(RACE_WEEK_QUESTS.length)) {
    saveData.pendingDay = nextDayIdx;
    saveGameProgress(saveData);
    lifeHud.pop(dayGrant, `${currentDay.title} complete`);
    enterFreeRoam();
    setTimeout(() => lifeHud.gate({
      nextTitle: RACE_WEEK_QUESTS[nextDayIdx].title,
      opensAt: rewards.nextOpening().getTime(),
      onTicket: () => { if (resumePendingDay()) { syncIsland(null, 'Fast-forward'); toast(`${currentDay.title} is open.`); } },
    }), 1400);
    return;
  }
  if (nextDayIdx < RACE_WEEK_QUESTS.length) {
    saveData.currentDayIndex = nextDayIdx;
    saveData.currentStepIndex = 0;
    currentDay = RACE_WEEK_QUESTS[nextDayIdx];
    currentStep = currentDay.steps[0];
    setHour(currentDay.startHour || 7.25);
    $('#hour').value = currentDay.startHour || 7.25;
    if (currentDay.cameraStart) go(currentDay.cameraStart);
  } else {
    toast('🌺 You have completed the Road to Kona 2026! Champion of Kailua Bay.');
  }

  saveGameProgress(saveData);
  setupActiveStep();
  updateHUD();
  if (!syncIsland(dayGrant)) lifeHud?.pop(dayGrant, 'Day complete');
}

function jumpToDay(dayIdx) {
  if (dayIdx < 0 || dayIdx >= RACE_WEEK_QUESTS.length) return;
  if (dayIdx > (saveData.currentDayIndex || 0)) {
    toast('Finish this day first. Later places stay closed.');
    return;
  }
  saveData.currentDayIndex = dayIdx;
  saveData.currentStepIndex = 0;
  currentDay = RACE_WEEK_QUESTS[dayIdx];
  currentStep = currentDay.steps[0];
  saveGameProgress(saveData);

  setHour(currentDay.startHour || 7.25);
  $('#hour').value = currentDay.startHour || 7.25;
  if (currentDay.cameraStart) go(currentDay.cameraStart);

  roaming = false;
  setupActiveStep();
  updateHUD();
  living?.setDay(dayIdx, saveData.completedDays);
  toast(`Switched to Day ${currentDay.dayNumber}: ${currentDay.title}`);
}

function updateHUD() {
  renderChecklist();
  renderChallenge();
}

function renderChallenge() {
  const el = $('#questChallenge');
  if (!el || !progress || !currentDay) return;
  const c = progress.challengeFor(currentDay.id);
  if (!c) { el.style.display = 'none'; return; }
  el.style.display = '';
  const km = c.metric !== 'heritage' && c.target >= 1000;
  const unit = c.metric === 'heritage' ? '' : (km ? ' km' : ' m');
  const shown = km ? (c.value / 1000).toFixed(1) : Math.round(c.value);
  const goal = km ? (c.target / 1000).toFixed(0) : c.target;
  const pct = Math.round(c.value / c.target * 100);
  el.classList.toggle('done', c.done);
  el.innerHTML = `<div class="qc-top"><span>${c.done ? 'Done' : 'Challenge'}</span><em>${shown}${unit} / ${goal}${unit}</em></div>
    <div class="qc-text">${c.text}</div><div class="qc-bar"><i style="width:${pct}%"></i></div><div class="qc-reward">Unlocks ${c.reward}</div>`;
  pierMuseumStudio?.refresh?.();
  window.__winners?.refresh?.();
}

function openMyKona() {
  if (!drawer) return;
  drawer.open(saveData, RACE_WEEK_QUESTS);
  const sm = progress.summary();
  const bikes = pierMuseumStudio ? pierMuseumStudio.getBikes() : [];
  const unlocked = bikes.filter(b => progress.isBikeUnlocked(b)).length;
  $('#statMemories').textContent = `${sm.memories} / ${sm.totalMemories}`;
  $('#statBikes').textContent = `${unlocked} / ${bikes.length}`;
  const extra = $('#drawerExtraStats') || (() => { const d = document.createElement('div'); d.id = 'drawerExtraStats'; d.className = 'drawer-stats'; $('#museumDrawer .drawer-stats').after(d); return d; })();
  extra.innerHTML = `<div class="stat-pill"><b>${sm.heritage} / ${sm.totalHeritage}</b><span>Heritage</span></div>
    <div class="stat-pill"><b>${sm.challenges} / ${sm.totalChallenges}</b><span>Challenges</span></div>
    <div class="stat-pill"><b>${((sm.stats.walk_m + sm.stats.ride_m + sm.stats.swim_m) / 1000).toFixed(1)} km</b><span>Explored</span></div>`;
}

// ------------------------------------------------------------------ Coffee Boat
let coffee;
function coffeeBoat() {
  const [sx, sy] = man.start, [dx, dy] = man.dir, rx = dy, ry = -dx;
  const xy = [sx + dx * 420 - rx * 40, sy + dy * 420 - ry * 40];
  const g = new THREE.Group();
  g.position.copy(W(xy[0], xy[1], 0));

  const hullGeo = new THREE.BoxGeometry(6.8, 1.4, 2.8);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1a4060, roughness: 0.4 });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = 0.5;
  g.add(hull);

  const canGeo = new THREE.BoxGeometry(6.4, 0.08, 2.6);
  const canMat = new THREE.MeshStandardMaterial({ color: 0xffcc33, roughness: 0.6 });
  const can = new THREE.Mesh(canGeo, canMat);
  can.position.y = 2.4;
  g.add(can);

  for (let i = 0; i < 4; i++) {
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.9, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
    const p = new THREE.Mesh(poleGeo, poleMat);
    p.position.set((i < 2 ? -2.8 : 2.8), 1.45, (i % 2 === 0 ? -1.1 : 1.1));
    g.add(p);
  }

  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffcc33';
  c.fillRect(0, 0, 512, 128);
  c.font = 'bold 44px sans-serif';
  c.fillStyle = '#081420';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('☕ LIVE ALOHA COFFEE BOAT', 256, 64);

  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, sizeAttenuation: false }));
  sp.scale.set(0.18, 0.034, 1);
  sp.center.set(0, 0);
  sp.position.y = 5;
  sp.renderOrder = 20;
  g.add(sp);
  scene.add(g);
  coffee = g;
}

// ------------------------------------------------------------------ Island DEM
let isl, heightAt = () => 0;
async function island() {
  isl = await (await fetch(A + 'island.json')).json();
  const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = A + 'island_height.png'; });
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, img.width, img.height).data, N = img.width;
  const H = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) H[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 6 - 6000;

  heightAt = (x, y) => {
    const u = (x - isl.x0) / isl.size * N - 0.5, v = (1 - (y - isl.y0) / isl.size) * N - 0.5;
    const i = Math.max(0, Math.min(N - 2, Math.floor(u))), j = Math.max(0, Math.min(N - 2, Math.floor(v))), a = u - i, b = v - j;
    return H[j * N + i] * (1 - a) * (1 - b) + H[j * N + i + 1] * a * (1 - b) + H[(j + 1) * N + i] * (1 - a) * b + H[(j + 1) * N + i + 1] * a * b;
  };

  const G = coarse ? 400 : 800, [tx0, ty0, tx1, ty1] = man.tile;
  // The whole-island mesh is a ~200 m far-field backdrop. Near Kailua the detailed core tile and the 500 m
  // streamed ring must always win, so sink the backdrop under that whole zone with a smooth ramp. A hard
  // clamp at one edge left a vertical cliff (visible from Aliʻi Drive) that poked through the detail.
  let rects = [[tx0, ty0, tx1, ty1]];
  try {
    const ti = await (await fetch(A + 'tiles/index.json')).json();
    rects = rects.concat(ti.tiles.map(t => [t.x0, t.y0, t.x0 + ti.size, t.y0 + ti.size]));
  } catch (_) { }
  const distToDetail = (x, y) => {
    let d = Infinity;
    for (const [a, b, c, e] of rects) d = Math.min(d, Math.hypot(Math.max(a - x, 0, x - c), Math.max(b - y, 0, y - e)));
    return d;
  };
  const SINK = 22, RAMP = 700;
  const g = new THREE.PlaneGeometry(1, 1, G, G), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i), v = uv.getY(i), x = isl.x0 + u * isl.size, y = isl.y0 + v * isl.size;
    let h = heightAt(x, y);
    const d = distToDetail(x, y);
    if (d < RAMP) { const k = Math.min(1, d / RAMP); h -= SINK * (1 - k * k * (3 - 2 * k)); }
    const w = W(x, y, h);
    p.setXYZ(i, w.x, w.y, w.z);
  }
  // PlaneGeometry winding is already correct after W() (x, y, z) -> (x, z, -y); the old index swap
  // flipped every face so all normals pointed down (inverted lighting, invisible from above).
  g.computeVertexNormals();

  const t = tex.load(A + 'island_color.jpg');
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0.05 });
  const mesh = new THREE.Mesh(g, m);
  scene.add(mesh);
  farIsland = mesh;
  explorer = createExplorer(isl);
  explorer.apply(m);
}

// ------------------------------------------------------------------ Race courses
const toLocal = (lat, lon) => {
  const o = man.origin, kx = 111320 * Math.cos(o.lat * Math.PI / 180);
  return [(lon - o.lon) * kx, (lat - o.lat) * 110574];
};

function ribbon(pts, width, color, lift) {
  const pos = [], side = [], tan = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const z = Math.max(0, heightAt(pts[i][0], pts[i][1])) + lift;
    const w = W(pts[i][0], pts[i][1], z), ta = W(b[0] - a[0], b[1] - a[1], 0).normalize();
    for (const s of [-1, 1]) { pos.push(w.x, w.y, w.z); side.push(s); tan.push(ta.x, ta.y, ta.z); }
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k + 1, k - 2, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('tan', new THREE.Float32BufferAttribute(tan, 3));
  g.setIndex(idx);

  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uWidth: { value: width } },
    vertexShader: `
      uniform float uWidth;
      attribute float side;
      attribute vec3 tan;
      void main() {
        vec3 norm = normalize(cross(tan, vec3(0.0, 1.0, 0.0)));
        vec3 p = position + norm * side * (uWidth * 0.5);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 0.42); }
    `,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 4;
  scene.add(mesh);
}

function routes() {
  const [sx, sy] = man.start, [dx, dy] = man.dir, rx = dy, ry = -dx;
  const swimPts = [[sx, sy]];
  for (let s = 100; s <= 1840; s += 50) swimPts.push([sx + dx * s - rx * 6, sy + dy * s - ry * 6]);
  swimPts.push([sx + dx * 1870, sy + dy * 1870]);
  for (let s = 1840; s >= 0; s -= 50) swimPts.push([sx + dx * s + rx * 6, sy + dy * s + ry * 6]);
  ribbon(swimPts, 2.5, 0xf4a261, 0.25);

  const kx = 111320 * Math.cos(man.origin.lat * Math.PI / 180);
  const ky = 110574;
  fetch(A + 'routes.json').then(r => r.json()).then(data => {
    if (data.bike && data.bike.length) {
      const pts = data.bike.map(([lon, lat]) => [(lon - man.origin.lon) * kx, (lat - man.origin.lat) * ky]);
      ribbon(pts, 3.2, 0x2a9d8f, 0.2); // low, so riders on the course stay visible
    }
    if (data.run && data.run.length) {
      const pts = data.run.map(([lon, lat]) => [(lon - man.origin.lon) * kx, (lat - man.origin.lat) * ky]);
      ribbon(pts, 2.4, 0xe76f51, 0.15);
    }
  }).catch(e => console.warn('routes.json load err', e));
  queenK();
}

function surfaceY(x, yNorth) {
  let h = Math.max(0.4, heightAt(x, yNorth));
  if (farIsland) {
    const w = W(x, yNorth, 0);
    const ray = new THREE.Raycaster(new THREE.Vector3(w.x, 900, w.z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(farIsland, false)[0];
    if (hit) h = Math.max(h, hit.point.y);
  }
  return h;
}

let roadMap = null;
function roadTexture() {
  if (roadMap) return roadMap;
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#6e767e';
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    c.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
    c.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  c.fillStyle = '#f4f7f8';
  c.fillRect(0, 6, 256, 14);
  c.fillRect(0, 236, 256, 14);
  c.fillStyle = '#f0c14a';
  for (let x = 10; x < 256; x += 52) c.fillRect(x, 116, 30, 22);
  roadMap = new THREE.CanvasTexture(cv);
  roadMap.wrapS = THREE.RepeatWrapping;
  roadMap.wrapT = THREE.ClampToEdgeWrapping;
  roadMap.colorSpace = THREE.SRGBColorSpace;
  roadMap.anisotropy = 8;
  return roadMap;
}

function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function solidRoad(pts, width, lift) {
  const pos = [], uv = [], idx = [];
  let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) dist += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const z = surfaceY(pts[i][0], pts[i][1]) + lift;
    const w = W(pts[i][0], pts[i][1], z);
    const ta = W(b[0] - a[0], b[1] - a[1], 0);
    ta.y = 0;
    if (ta.lengthSq() < 1e-6) ta.set(0, 0, 1);
    ta.normalize();
    const side = new THREE.Vector3(-ta.z, 0, ta.x);
    for (const s of [-1, 1]) pos.push(w.x + side.x * s * width * 0.5, w.y, w.z + side.z * s * width * 0.5);
    const u = dist / 18;
    uv.push(u, 0, u, 1);
    if (i) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k + 1, k - 2, k + 1, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: roadTexture(), side: THREE.DoubleSide }));
  mesh.userData.ground = true;
  mesh.renderOrder = 2;
  scene.add(mesh);
  addGround(mesh);
  return mesh;
}

function signBoard(title, body) {
  const cv = document.createElement('canvas');
  cv.width = 640;
  cv.height = 360;
  const c = cv.getContext('2d');
  c.fillStyle = '#101820';
  c.fillRect(0, 0, 640, 360);
  c.fillStyle = '#f9c74f';
  c.fillRect(0, 0, 640, 12);
  c.font = '700 42px sans-serif';
  c.fillText(title, 28, 72);
  c.fillStyle = '#f1f5f9';
  c.font = '400 26px sans-serif';
  const words = body.split(' ');
  let line = '', y = 130;
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (c.measureText(next).width > 580) { c.fillText(line, 28, y); y += 36; line = word; }
    else line = next;
  }
  if (line) c.fillText(line, 28, y);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function placeBoard(survey, aim, id, title, body) {
  const z = surfaceY(survey[0], survey[1]) + 1.6;
  const here = W(survey[0], survey[1], z);
  const there = W(aim[0], aim[1], z);
  const side = new THREE.Vector3().subVectors(there, here);
  side.y = 0;
  if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
  side.normalize();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.9), new THREE.MeshBasicMaterial({ map: signBoard(title, body), side: THREE.DoubleSide }));
  board.position.copy(here).add(new THREE.Vector3(-side.z, 0, side.x).multiplyScalar(14));
  board.lookAt(here.x, board.position.y, here.z);
  scene.add(board);
  briefings.push({ id, title, body, x: survey[0], y: survey[1] });
}

function queenK() {
  if (farIsland && !farIsland.geometry.boundsTree) farIsland.geometry.computeBoundsTree();
  // Terminal curb is east of runway 17/35. The line then runs south along the coast to the pier.
  // These are a rideable corridor, not a surveyed centerline of Queen Kaʻahumanu Highway.
  const wps = [
    [19.73855, -156.04235],
    [19.7310, -156.0412],
    [19.722, -156.0435],
    [19.700, -156.040],
    [19.678, -156.028],
    [19.662, -156.012],
    [19.651, -156.001],
    [19.643, -155.997],
    [19.6392, -155.9968],
  ];
  const pts = densify(wps.map(([lat, lon]) => toLocal(lat, lon)), 80);
  solidRoad(pts, 22, 0.45);
  const along = 0.4;
  highwayStart = [
    pts[0][0] + (pts[1][0] - pts[0][0]) * along,
    pts[0][1] + (pts[1][1] - pts[0][1]) * along,
  ];
  highwayAim = pts[Math.min(3, pts.length - 1)];
  let dist = 0, nextPost = 1000;
  const postMat = new THREE.MeshBasicMaterial({ color: 0xf9c74f });
  for (let i = 1; i < pts.length; i++) {
    dist += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (dist < nextPost) continue;
    const z = surfaceY(pts[i][0], pts[i][1]);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.4, 0.12), postMat);
    p.position.copy(W(pts[i][0], pts[i][1], z + 1.2));
    scene.add(p);
    nextPost += 1000;
  }
  const facts = [
    ['b1978', '1978 · Oʻahu', 'The first Ironman was on Oʻahu on 18 February 1978: 15 starters, 12 finishers. This race has been in Kailua-Kona since 1981.'],
    ['b1974', '1974 · San Diego', 'Triathlon began at Mission Bay, San Diego, on 25 September 1974. It was not born on this road.'],
    ['b1982', '1982 · Aliʻi Drive', 'Julie Moss collapsed near the finish and crawled home 29 seconds behind Kathleen McCartney.'],
    ['brecords', 'Course records', 'Women: Lucy Charles-Barclay, 8:24:31 in 2023. Men: Patrick Lange, 7:35:53 in 2024.'],
  ];
  facts.forEach((f, i) => {
    const at = pointAlong(pts, 0.12 + i * 0.24);
    placeBoard(at.pos, at.aim, f[0], f[1], f[2]);
  });
  for (let i = 0; i < pts.length; i += 4) explorer?.stamp(pts[i][0], pts[i][1], 700);
}

function pointAlong(pts, frac) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(d);
    total += d;
  }
  let want = Math.min(0.98, Math.max(0.02, frac)) * total;
  for (let i = 1; i < pts.length; i++) {
    if (want > lens[i - 1]) { want -= lens[i - 1]; continue; }
    const t = lens[i - 1] ? want / lens[i - 1] : 0;
    return {
      pos: [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t],
      aim: pts[Math.min(pts.length - 1, i + 1)],
    };
  }
  return { pos: pts[pts.length - 1], aim: pts[pts.length - 1] };
}

function readNearbyBriefing() {
  if (!saveData) return;
  saveData.briefingsRead = saveData.briefingsRead || [];
  const x = camera.position.x, y = -camera.position.z;
  for (const b of briefings) {
    if (saveData.briefingsRead.includes(b.id)) continue;
    if (Math.hypot(x - b.x, y - b.y) > 28) continue;
    saveData.briefingsRead.push(b.id);
    saveGameProgress(saveData);
    const el = $('#briefCard');
    if (!el) return;
    el.hidden = false;
    el.innerHTML = `<b>${b.title}</b><p>${b.body}</p>`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 9000);
    return;
  }
}

function pois() {
  const list = [
    ['race', 'Dig Me Beach · Swim Start', [-10, -18]],
    ['race', 'T1 / T2 · Kailua Pier', [4, 18]],
    ['race', 'Finish · Aliʻi Drive', [148, -48]],
    ['place', 'Coffee Boat', [80, -400]],
    ['place', 'Ahuʻena Heiau', [-20, -62]],
  ];
  const col = { race: '#ffcc33', place: '#ffffff', peak: '#9fe3ff' };

  for (const [kind, name, xy] of list) {
    if (!xy) continue;
    const z = Math.max(heightAt(xy[0], xy[1]), 0) + 12;
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 96;
    const c = cv.getContext('2d');
    c.font = '600 38px system-ui, sans-serif';
    c.fillStyle = col[kind];
    c.strokeStyle = 'rgba(0,0,0,.75)';
    c.lineWidth = 8;
    c.strokeText(name, 12, 60);
    c.fillText(name, 12, 60);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv),
      depthTest: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85
    }));
    sp.position.copy(W(xy[0], xy[1], z));
    sp.scale.set(4.5, 0.85, 1);
    sp.center.set(0.5, 0.5);
    scene.add(sp);
  }
}

// ------------------------------------------------------------------ Viewpoints
const PLACES = {
  bay: () => ({ pos: W(40, -450, 220), look: W(30, 20, 0), ground: W(22, 10, 2.2), name: 'Kailua Bay', note: 'The swim course runs 1,840 m out along the Aliʻi Drive coast.' }),
  pier: () => ({ pos: W(18, -45, 14), look: W(0, 10, 2.2), ground: W(4, 10, 2.2), name: 'Kailua Pier · Transition', note: 'The racks start empty. A bike appears only when that model is sourced and unlocked.' }),
  winners: () => ({ pos: W(70, 6, 8), look: W(70, -12, 3), ground: W(70, -8, 2.4), name: 'Winners hall', note: 'Every year’s result. A bike or a statue appears only when that asset exists.' }),
  start: () => ({ pos: W(-45, -35, 4), look: W(50, -220, 1), ground: W(-45, -35, 1.2), name: 'Dig Me Beach · Swim Start', note: '6:25 AM cannon blast echoes across the volcanic amphitheater.' }),
  finish: () => ({ pos: W(40, -190, 70), look: W(125, -20, 4), ground: W(175, -55, 3.5), name: 'Finish line · Aliʻi Drive', note: 'The most famous finish line in endurance sport.' }),
  hawi: () => {
    const xy = toLocal(20.0545, -155.8306);
    return { aerial: true, pos: W(xy[0] - 600, xy[1] - 800, 450), look: W(xy[0], xy[1], Math.max(heightAt(xy[0], xy[1]), 0)), ground: W(xy[0] - 70, xy[1] - 90, 0), name: 'Hāwī Turnaround', note: 'Mile 56 turnaround in the Kohala mountain crosswinds.' };
  },
  energylab: () => {
    const xy = toLocal(19.7042, -156.0392);
    return { aerial: true, pos: W(xy[0] - 350, xy[1] - 400, 180), look: W(xy[0], xy[1], Math.max(heightAt(xy[0], xy[1]), 0)), ground: W(xy[0] + 40, xy[1] - 120, 0), name: 'Natural Energy Lab (NELHA)', note: 'Crushing heat and total isolation on the marathon.' };
  },
  island: () => ({ aerial: true, pos: W(24000, 18000, 24000), look: W(-2000, 4000, 1200), ground: W(4, 10, 2.2), name: 'Island of Hawaiʻi', note: '159 km from south to north, dominated by Mauna Kea and Mauna Loa.' }),
};

let tween = null;
function go(k, dur = 2.5) {
  const p = PLACES[k]();
  ride = null;
  if ((k === 'hawi' || k === 'energylab') && !courseOpen(saveData.completedDays)) {
    toast('Hāwī and the Energy Lab open after bike check-in on Friday 9 October.');
    return;
  }
  if (explorer && k !== 'island') {
    const g = p.ground || p.look;
    if (!explorer.seen(g.x, -g.z)) {
      toast('That part of the island is still closed. Ride there and the map opens.');
      return;
    }
  }

  if (locomotion && locomotion.getState().active && p.aerial) {
    // Aerial-only viewpoints (whole island) make no sense on foot: lift off into fly mode, then glide there.
    setLocomotionMode('fly');
  } else if (locomotion && locomotion.getState().active) {
    // Player is walking or riding a bike on the ground: teleport them to ground level at this landmark,
    // facing the thing the viewpoint is about (was always yaw 0, e.g. staring out to sea at Energy Lab).
    const target = p.ground || p.look;
    const targetGround = heightAt ? heightAt(target.x, -target.z) : 2.0;
    const groundY = Math.max(targetGround, 1.8);
    const dx = p.look.x - target.x, dz = p.look.z - target.z;
    const yaw = (Math.abs(dx) + Math.abs(dz) > 1) ? Math.atan2(-dx, -dz) : 0;
    locomotion.teleport(target.x, groundY, target.z, yaw, 0);
    toast(`📍 Arrived at ${p.name}: ${p.note}`);
    $('#cap').innerHTML = `<b>${p.name}</b><span>${p.note}</span>`;
    $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.k === k));
    return;
  }

  // Otherwise in Drone Fly mode, smoothly animate aerial camera
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  dur = Math.max(dur, 0.001);
  tween = {
    t: 0,
    dur,
    f: e => {
      camera.position.lerpVectors(p0, p.pos, e);
      controls.target.lerpVectors(t0, p.look, e);
    }
  };
  $('#cap').innerHTML = `<b>${p.name}</b><span>${p.note}</span>`;
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.k === k));
}

let ride = null;
function swimRide() {
  const [sx, sy] = man.start, [dx, dy] = man.dir, rx = dy, ry = -dx;
  const pts = [];
  for (let s = 0; s <= 1840; s += 60) pts.push(W(sx + dx * s - rx * 6, sy + dy * s - ry * 6, 0.35));
  pts.push(W(sx + dx * 1870, sy + dy * 1870, 0.35));
  for (let s = 1840; s >= 0; s -= 60) pts.push(W(sx + dx * s + rx * 6, sy + dy * s + ry * 6, 0.35));

  const curve = new THREE.CatmullRomCurve3(pts, true);
  ride = { curve, t: 0, len: curve.getLength() };
  controls.enabled = false;
  toast('Swimming the 3.8 km Kailua Bay course...');
}

// ------------------------------------------------------------------ Nav UI
const navList = [
  ['bay', 'Kailua Bay'],
  ['pier', 'Transition Pier'],
  ['start', 'Swim start'],
  ['finish', 'Finish line'],
  ['hawi', 'Hāwī'],
  ['energylab', 'Energy Lab'],
  ['island', 'Island'],
  ['winners', 'Winners']
];

navList.forEach(([k, label]) => {
  const b = document.createElement('button');
  b.dataset.k = k;
  b.textContent = label;
  b.onclick = () => go(k);
  $('#nav').appendChild(b);
});

const sb = document.createElement('button');
sb.textContent = '🏊 Swim ride';
sb.onclick = swimRide;
$('#nav').appendChild(sb);

$('#hour').oninput = e => setHour(+e.target.value);

function toast(t) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = t;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 4000);
}

// ------------------------------------------------------------------ Main Animation Loop
let fpsT = 0, frames = 0;
let lastReachCheck = 0;
const lastPos = new THREE.Vector3(); let hasLastPos = false, challengeUiT = 0;
// Distance you actually travel (on foot, by bike, swimming) counts toward the day's challenge.
let lastSeen = null, arrived = false;
addEventListener('pagehide', () => { if (explorer && lastSeen && loadPlayer()) explorer.persist({ last: lastSeen }, true); });
function trackExploration(dt) {
  if (!progress || !currentDay || !arrived) return;
  const st = locomotion.getState();
  const p = camera.position;
  if (st.active && hasLastPos) {
    const d = Math.hypot(p.x - lastPos.x, p.z - lastPos.z);
    if (d < 40 * Math.max(dt, 0.016)) {                   // ignore teleports / "Take me there"
      progress.track(st.isSwimming ? 'swim_m' : (st.mode === 'bike' ? 'ride_m' : 'walk_m'), d, currentDay.id);
    }
  }
  lastPos.copy(p); hasLastPos = st.active;
  if (explorer && st.active) {
    explorer.stamp(p.x, -p.z, st.mode === 'bike' ? 1600 : 900);
    lastSeen = { x: p.x, y: -p.z };
    explorer.persist(loadPlayer() ? { last: lastSeen } : null);
  }
  const speedEl = $('#rideSpeed'), distEl = $('#rideDist');
  if (speedEl) speedEl.textContent = String(st.speedKmh || 0);
  if (distEl && saveData?.stats) distEl.textContent = ((saveData.stats.ride_m || 0) / 1000).toFixed(1);
  challengeUiT += dt;
  if (challengeUiT > 0.5) {
    challengeUiT = 0;
    progress.checkHeritage(currentDay.id);
    renderChallenge();
    readNearbyBriefing();
  }
}
let lastPedestalPrompt = 0;
let lastFrameTime = performance.now();

renderer.setAnimationLoop(() => {
  if (document.body.classList.contains('in-challenge')) { lastFrameTime = performance.now(); return; }
  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;

  // Camera tween
  if (tween) {
    tween.t += dt;
    const k = Math.min(1, tween.t / tween.dur);
    const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
    tween.f(e);
    if (k >= 1) tween = null;
  }

  // Swim Ride
  if (ride) {
    ride.t += dt * 1.54 * 30 / ride.len;
    if (ride.t >= 1) {
      ride = null;
      controls.enabled = true;
    } else {
      const p = ride.curve.getPointAt(ride.t);
      const a = ride.curve.getPointAt(Math.min(1, ride.t + 0.004));
      camera.position.copy(p).add(new THREE.Vector3(0, 0.25 + Math.sin(now * 0.003) * 0.08, 0));
      controls.target.copy(a).add(new THREE.Vector3(0, 0.2, 0));
    }
  }

  // Locomotion update
  if (locomotion) {
    locomotion.update(dt);
    trackExploration(dt);
  }

  if (!locomotion?.getState().active && !tween && !ride) {
    controls.update();
  }

  // Tile streamer update
  streamer?.update(dt, camera);

  // Hawaiian Heritage Scavenger Hunt beacons update
  hawaiianHunt?.update(dt, camera);

  // Pier Bike Museum update
  pierMuseumStudio?.update(dt, camera);

  // Living island: crowds, athletes, canoes, flags, shells, honu
  living?.update(dt, camera);
  lifeTick(dt);

  // Fog & depth scaling
  scene.fog.density = 0.00011 / (1 + Math.max(0, camera.position.y) / 150);
  const alt = Math.abs(camera.position.y) + 1;
  const nearWanted = THREE.MathUtils.clamp(alt * 0.004, 0.15, 80);
  if (Math.abs(camera.near - nearWanted) > camera.near * 0.2) {
    camera.near = nearWanted;
    camera.updateProjectionMatrix();
  }

  // Ocean update
  if (ocean) {
    ocean.material.uniforms.uTime.value += dt;
    ocean.position.set(Math.round(camera.position.x / 60) * 60, 0, Math.round(camera.position.z / 60) * 60);
  }

  // Objective Beacon & Compass update
  if (echoMarkers) {
    const navState = echoMarkers.update(dt, camera);

    const arrow = $('#compassArrow');
    const distEl = $('#compassDist');
    if (arrow && distEl) {
      arrow.style.transform = `rotate(${navState.angleDeg || 0}deg)`;
      distEl.textContent = navState.distance < 9000 ? `${Math.round(navState.distance)} m` : '-- m';
    }

    if (Date.now() - lastReachCheck > 150) {
      lastReachCheck = Date.now();
      refreshInteraction(navState.reached);
    }
  }

  renderer.render(scene, camera);

  // Dynamic Resolution (FPS holding)
  frames++;
  fpsT += dt;
  if (fpsT > 2) {
    const fps = frames / fpsT;
    frames = 0;
    fpsT = 0;
    if (fps < 45 && dpr > 0.75) {
      dpr = Math.max(0.75, dpr - 0.15);
      resize();
    } else if (fps > 58 && dpr < Math.min(devicePixelRatio, 2)) {
      dpr = Math.min(devicePixelRatio, dpr + 0.1);
      resize();
    }
  }
});

// Expose on window for inspection & debug
window.__kona = {
  scene,
  camera,
  THREE,
  get locomotion() { return locomotion; },
  get echoMarkers() { return echoMarkers; },
  get pierMuseumStudio() { return pierMuseumStudio; },
  get hawaiianHunt() { return hawaiianHunt; },
  saveData,
  get progress() { return progress; },
  openMyKona: () => openMyKona(),
  get currentDay() { return currentDay; },
  get currentStep() { return currentStep; },
  get pierBikes() { return man?.bikes; },
  jumpToDay,
  completeCurrentStep,
  teleportToActiveStep,
  setLocomotionMode,
  openBikeMuseum: (idx = 7) => pierMuseumStudio?.open(idx),
  openHeritageHunt: (id = null) => hawaiianHunt?.open(id),
  go,
  setHour,
  toast,
  get island() { return living; },
  controls,
  W,
  heightAt: (x, y) => heightAt(x, y),
  get explorer() { return explorer; },
  get rewards() { return rewards; },
  get lifeHud() { return lifeHud; },
  syncIsland: () => syncIsland(),
};

function startWorld() {
  $('#gate').hidden = true;
  $('#loading').classList.remove('done');
  load().catch(e => {
    console.error(e);
    const p = $('#loading p');
    if (p) {
      p.innerHTML = 'Kona did not load. Check your connection and try again.';
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Try again';
      b.className = 'load-retry';
      b.onclick = () => location.reload();
      p.after(b);
    }
  });
}

// ------------------------------------------------------------------ First session: athlete → apartment → flight → KOA
// New athletes create themselves, pack in their apartment, then fly. Anyone who has been on the island goes straight there.
let flightUntil = 0;
function beginJourney() {
  const p = loadPlayer();
  if (!p || p.last || p.packing) { startWorld(); return; }
  $('#gate').hidden = true;
  $('#loading').classList.add('done');
  rewards = rewards || createRewards({ onChange: () => lifeHud?.wallet() });
  runApartment({
    player: p, rewards, base: A,
    onDone: (what, pl) => {
      savePlayer(pl);
      if (what === 'depart') { document.body.classList.add('flying'); flightUntil = performance.now() + 4500; startWorld(); }
    },
  }).then(api => { window.__apt = api; }).catch(e => { console.error('Apartment failed', e); startWorld(); });
}

// ?c=<challenge> opens that challenge straight away, no account and no setup: the link a result card shares.
// Also as a bare #anchor (#transition_tangle): some hosts pass the hash but not the query string.
const deepChallenge = new URLSearchParams(location.search).get('c') || (/^#[a-z0-9_]{2,40}$/.test(location.hash) ? location.hash.slice(1) : null);
function boot() {
const gate = $('#gate');
const known = loadPlayer();
if (known) {
  beginJourney();
} else if (gate) {
  $('#loading').classList.add('done');
  gate.hidden = false;
  const step = n => gate.querySelectorAll('.gstep').forEach(el => { el.hidden = el.dataset.step !== String(n); });
  const nameOk = () => ($('#gateName').value || '').trim().length >= 2;
  $('#gateNext').onclick = () => {
    $('#gateErr').hidden = nameOk();
    if (nameOk()) { step(2); gate.scrollTop = 0; }
    else $('#gateName').focus();
  };
  $('#gateBack').onclick = () => step(1);
  $('#gateForm').addEventListener('submit', ev => {
    ev.preventDefault();
    if (!nameOk()) { step(1); $('#gateErr').hidden = false; return; }
    const f = new FormData($('#gateForm'));
    const first = f.get('visit') !== 'return';
    const visits = first ? 1 : Math.max(2, Number(f.get('count')) || 2);
    savePlayer({
      name: String(f.get('name')).trim().slice(0, 24), country: f.get('country'), visits, firstTime: first, created: Date.now(),
      look: { skin: f.get('skin'), suit: f.get('suit'), helmet: f.get('helmet'), bike: f.get('bike') },
      bikeBuilt: false,
    });
    beginJourney();
  });
  const syncCount = () => { $('#gateCount').hidden = gate.querySelector('input[value=return]')?.checked !== true; };
  gate.querySelectorAll('input[name=visit]').forEach(r => r.addEventListener('change', syncCount));
  syncCount();
} else {
  startWorld();
}
}
if (deepChallenge) {
  $('#loading').classList.add('done');
  openChallenge(deepChallenge, () => { try { history.replaceState(null, '', location.pathname); } catch { /* sandboxed host */ } boot(); });
} else boot();
