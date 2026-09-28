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
import { createEchoMarkers } from './echoMarkers.js';
import { createPierMuseumStudio } from './pierMuseumStudio.js';
import { createHawaiianScavengerHunt } from './hawaiianScavengerHunt.js';
import { playMemoryChime, playUnlockFanfare } from './audio.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
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
let saveData = loadGameSave();
let currentDay = RACE_WEEK_QUESTS[0];
let currentStep = currentDay.steps[0];
let pierBikesMesh = null;
let streamer = null;
let man = null;

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
  locomotion = createLocomotion({ camera, renderer, scene, W, grounds, heightAt, toast });
  echoMarkers = createEchoMarkers({ scene, W, heightAt });
  pierMuseumStudio = createPierMuseumStudio({ scene, camera, W, heightAt });
  hawaiianHunt = createHawaiianScavengerHunt({ scene, camera, W, heightAt, toast });

  console.log('[Kona] Initializing game loop...');
  initGameLoop();

  console.log('[Kona] Load completed successfully!');
  $('#loading').classList.add('done');
  go('pier', 0);
}

// ------------------------------------------------------------------ Quest & Progression Engine
function initGameLoop() {
  const dayIdx = Math.min(saveData.currentDayIndex || 0, RACE_WEEK_QUESTS.length - 1);
  currentDay = RACE_WEEK_QUESTS[dayIdx];
  const stepIdx = Math.min(saveData.currentStepIndex || 0, currentDay.steps.length - 1);
  currentStep = currentDay.steps[stepIdx];

  setupActiveStep();
  updateHUD();

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
      if (pierMuseumStudio) pierMuseumStudio.open(7); // Open with Frodeno 2019
    };
  }

  // Top Heritage Button -> Opens Hawaiian Scavenger Hunt Lore Codex
  const herBtn = $('#topHeritageBtn');
  if (herBtn) {
    herBtn.onclick = () => {
      if (hawaiianHunt) hawaiianHunt.open();
    };
  }

  // Key E handler for opening museum when near a pedestal
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyE') {
      if (locomotion && pierMuseumStudio) {
        pierMuseumStudio.checkProximity(camera.position, (idx, bike) => {
          pierMuseumStudio.open(idx);
        });
      }
    }
  });

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
    toast('Walk Mode: Explore Kona on foot · [B] Ride Bike');
  } else if (mode === 'bike') {
    if (locomotion) {
      locomotion.setActive(true);
      locomotion.setMode('bike');
    }
    controls.enabled = false;
    if (modeIcon) modeIcon.textContent = '🚴';
    if (modeLabel) modeLabel.textContent = 'Bike';
    if (hint) {
      hint.textContent = 'WASD Pedal & Steer · Shift Sprint (65 km/h) · [B] Dismount · [E] 3D Studio';
      hint.style.display = 'block';
    }
    toast('🚴 Speedmax CFR Ride: 43–66 km/h Aero Cruise');
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

  renderChecklist();
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
  toast(`Teleported to: ${currentStep.text}`);
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
      pierMuseumStudio.open(yearIdx >= 0 ? yearIdx : 7);
    }

    saveGameProgress(saveData);
    advanceToNextDayOrFinish();
  } else {
    playUnlockFanfare();
    toast(`✓ Objective Complete: ${currentStep.text}`);

    let nextStepIdx = (saveData.currentStepIndex || 0) + 1;
    if (nextStepIdx < currentDay.steps.length) {
      saveData.currentStepIndex = nextStepIdx;
      currentStep = currentDay.steps[nextStepIdx];
      saveGameProgress(saveData);
      setupActiveStep();
      updateHUD();
    }
  }
}

function advanceToNextDayOrFinish() {
  if (!saveData.completedDays.includes(currentDay.id)) {
    saveData.completedDays.push(currentDay.id);
  }
  toast(`🏆 Day ${currentDay.dayNumber} Completed! Chapter Unlocked.`);

  const nextDayIdx = saveData.currentDayIndex + 1;
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
}

function jumpToDay(dayIdx) {
  if (dayIdx < 0 || dayIdx >= RACE_WEEK_QUESTS.length) return;
  saveData.currentDayIndex = dayIdx;
  saveData.currentStepIndex = 0;
  currentDay = RACE_WEEK_QUESTS[dayIdx];
  currentStep = currentDay.steps[0];
  saveGameProgress(saveData);

  setHour(currentDay.startHour || 7.25);
  $('#hour').value = currentDay.startHour || 7.25;
  if (currentDay.cameraStart) go(currentDay.cameraStart);

  setupActiveStep();
  updateHUD();
  toast(`Switched to Day ${currentDay.dayNumber}: ${currentDay.title}`);
}

function updateHUD() {
  renderChecklist();
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
  const g = new THREE.PlaneGeometry(1, 1, G, G), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i), v = uv.getY(i), x = isl.x0 + u * isl.size, y = isl.y0 + v * isl.size;
    let h = heightAt(x, y);
    if (x > tx0 + 30 && x < tx1 - 30 && y > ty0 + 30 && y < ty1 - 30) h = Math.min(h, -80);
    const w = W(x, y, h);
    p.setXYZ(i, w.x, w.y, w.z);
  }
  const ix = g.index.array;
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i + 1];
    ix[i + 1] = ix[i + 2];
    ix[i + 2] = a;
  }
  g.computeVertexNormals();

  const t = tex.load(A + 'island_color.jpg');
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0.05 });
  const mesh = new THREE.Mesh(g, m);
  scene.add(mesh);
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
      ribbon(pts, 3.2, 0x2a9d8f, 1.2);
    }
    if (data.run && data.run.length) {
      const pts = data.run.map(([lon, lat]) => [(lon - man.origin.lon) * kx, (lat - man.origin.lat) * ky]);
      ribbon(pts, 2.4, 0xe76f51, 0.9);
    }
  }).catch(e => console.warn('routes.json load err', e));
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
  pier: () => ({ pos: W(18, -45, 14), look: W(0, 10, 2.2), ground: W(4, 10, 2.2), name: 'Kailua Pier · Transition', note: 'The spiritual heart of Ironman. All 580 bikes racked here.' }),
  start: () => ({ pos: W(-45, -35, 4), look: W(50, -220, 1), ground: W(-45, -35, 1.2), name: 'Dig Me Beach · Swim Start', note: '6:25 AM cannon blast echoes across the volcanic amphitheater.' }),
  finish: () => ({ pos: W(175, -55, 12), look: W(125, -20, 2), ground: W(175, -55, 3.5), name: 'Finish line · Aliʻi Drive', note: 'The most famous finish line in endurance sport.' }),
  hawi: () => {
    const xy = toLocal(20.0545, -155.8306);
    return { pos: W(xy[0] - 600, xy[1] - 800, 450), look: W(xy[0], xy[1], Math.max(heightAt(xy[0], xy[1]), 0)), ground: W(xy[0], xy[1], Math.max(heightAt(xy[0], xy[1]), 0)), name: 'Hāwī Turnaround', note: 'Mile 56 turnaround in the Kohala mountain crosswinds.' };
  },
  energylab: () => {
    const xy = toLocal(19.7042, -156.0392);
    return { pos: W(xy[0] - 350, xy[1] - 400, 180), look: W(xy[0], xy[1], Math.max(heightAt(xy[0], xy[1]), 0)), ground: W(xy[0], xy[1], Math.max(heightAt(xy[0], xy[1]), 0)), name: 'Natural Energy Lab (NELHA)', note: 'Crushing heat and total isolation on the marathon.' };
  },
  island: () => ({ pos: W(24000, 18000, 24000), look: W(-2000, 4000, 1200), ground: W(4, 10, 2.2), name: 'Island of Hawaiʻi', note: '159 km from south to north, dominated by Mauna Kea and Mauna Loa.' }),
};

let tween = null;
function go(k, dur = 2.5) {
  const p = PLACES[k]();
  ride = null;

  if (locomotion && locomotion.getState().active) {
    // Player is walking or riding a bike on the ground: teleport them to ground level at this landmark!
    const target = p.ground || p.look;
    const targetGround = heightAt ? heightAt(target.x, -target.z) : 2.0;
    const groundY = Math.max(targetGround, 1.8);
    locomotion.teleport(target.x, groundY, target.z, 0, 0);
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
  ['island', 'Island']
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
let lastPedestalPrompt = 0;
let lastFrameTime = performance.now();

renderer.setAnimationLoop(() => {
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

    if (navState.reached && Date.now() - lastReachCheck > 3000) {
      lastReachCheck = Date.now();
      completeCurrentStep();
    }
  }

  // Check proximity to Pier Heritage Pedestals while walking
  if (locomotion?.getState().active && pierMuseumStudio && Date.now() - lastPedestalPrompt > 2500) {
    pierMuseumStudio.checkProximity(camera.position, (idx, bike) => {
      lastPedestalPrompt = Date.now();
      toast(`🚲 ${bike.year} ${bike.name}: Press [E] or Click to Enter 3D Studio`);
    });
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
  locomotion,
  echoMarkers,
  pierMuseumStudio,
  hawaiianHunt,
  saveData,
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
  toast
};

load().catch(e => {
  $('#loading p').textContent = 'Load failed: ' + e.message;
  console.error(e);
});
