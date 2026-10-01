// Standalone 3D Runtime for Nice, France · Ironman 70.3 World Championships
// Implements logarithmic depth buffer, ACES filmic tone mapping, OrbitControls,
// live LFMN Mediterranean meteorology, and smooth camera transitions across 10 iconic viewpoints.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildNiceWorld } from './niceWorld.js';
import { LiveWeatherService } from '../live/liveWeather.js';

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  logarithmicDepthBuffer: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8bc3da); // Riviera azure morning sky
scene.fog = new THREE.FogExp2(0x9bc8dc, 0.00012);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 1.0, 65000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495; // Don't go below horizon
controls.minDistance = 2.0;
controls.maxDistance = 22000;

// Mediterranean Lighting: Warm Riviera Sun + Azure Sky Ambient
const hemiLight = new THREE.HemisphereLight(0xd4edfc, 0x4a483a, 1.4);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff7e6, 2.6);
sunLight.position.set(-1500, 3200, 2200);
scene.add(sunLight);

// Build procedural 3D World of Nice
const worldRoot = buildNiceWorld({ scene, W: (x, y, z) => new THREE.Vector3(x, z, y), toLocal: p => p, coarse: false });

// 10 Iconic Panoramic & Street-Level Viewpoints
const views = {
  overview: {
    name: 'Baie des Anges Aerial Panorama',
    pos: new THREE.Vector3(1250, 480, 750),
    look: new THREE.Vector3(-450, 10, -50),
    desc: 'Breathtaking bird\'s-eye view looking west over the sweeping Baie des Anges, Promenade des Anglais, and race course.'
  },
  finish_chute: {
    name: 'Ironman 70.3 Finish Arena',
    pos: new THREE.Vector3(-80, 14, 45),
    look: new THREE.Vector3(-140, 9, 12),
    desc: 'The official 150m red carpet finish chute, M-Dot gantry arch, and spectator grandstands.'
  },
  negresco: {
    name: 'Hôtel Le Negresco Palace',
    pos: new THREE.Vector3(-650, 16, 55),
    look: new THREE.Vector3(-650, 28, -65),
    desc: 'The iconic Belle Époque white palace and its world-famous pink dome designed by Édouard Niermans.'
  },
  transition: {
    name: 'Transition Area (T1 / T2)',
    pos: new THREE.Vector3(260, 45, 125),
    look: new THREE.Vector3(260, 6, 45),
    desc: '2,500 bike racks for Pro and Age-Group time-trial bikes on Quai des États-Unis.'
  },
  swim_start: {
    name: 'Baie des Anges Swim Start',
    pos: new THREE.Vector3(420, 18, 65),
    look: new THREE.Vector3(420, 2, 280),
    desc: 'Plage des Ponchettes rolling swim start pontoon and 1.9km buoy circuit in crystal turquoise water.'
  },
  chateau: {
    name: 'Tour Bellanda & Castle Hill',
    pos: new THREE.Vector3(720, 45, 135),
    look: new THREE.Vector3(760, 35, 100),
    desc: 'Historic stone cylindrical tower and observation terrace overlooking the entire bay.'
  },
  cours_saleya: {
    name: 'Cours Saleya Market (Vieux Nice)',
    pos: new THREE.Vector3(560, 16, -40),
    look: new THREE.Vector3(680, 8, -40),
    desc: 'Vibrant pedestrian marketplace with striped canopies, fresh flowers, and authentic Niçois socca.'
  },
  place_massena: {
    name: 'Place Masséna & Apollo Fountain',
    pos: new THREE.Vector3(360, 20, -180),
    look: new THREE.Vector3(360, 10, -250),
    desc: 'Black-and-white checkerboard plaza, red Italianate arcades, and Fontaine du Soleil.'
  },
  port_lympia: {
    name: 'Port Lympia & Café du Cycliste',
    pos: new THREE.Vector3(1580, 35, 340),
    look: new THREE.Vector3(1580, 6, 180),
    desc: 'The historic Old Port with moored yachts, colorful pointu boats, and cycling clubhouse.'
  },
  airport_nce: {
    name: 'Nice Côte d\'Azur Airport (NCE/LFMN)',
    pos: new THREE.Vector3(-4100, 120, 1750),
    look: new THREE.Vector3(-4100, 10, 850),
    desc: 'France\'s 2nd busiest international gateway with reclaimed offshore parallel runways.'
  },
  col_de_vence: {
    name: 'Col de Vence Bike Climb',
    pos: new THREE.Vector3(-4150, 420, -3200),
    look: new THREE.Vector3(-4500, 320, -3800),
    desc: 'The legendary mountain pass climb with limestone hairpins looking out over the Mediterranean Sea.'
  }
};

let currentViewId = 'overview';

function goTo(viewId, durationSec = 1.6) {
  const target = views[viewId] || views.overview;
  currentViewId = viewId;

  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const endPos = target.pos.clone();
  const endTarget = target.look.clone();

  const startTime = performance.now();
  const durMs = durationSec * 1000;

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1.0, elapsed / durMs);
    // Smooth cubic ease out
    const ease = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(startPos, endPos, ease);
    controls.target.lerpVectors(startTarget, endTarget, ease);
    controls.update();

    if (progress < 1.0) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);

  // Update UI badge if present
  const badge = document.querySelector('#view-badge');
  if (badge) badge.textContent = target.name;
}

// Live Weather integration with Nice Airport (LFMN)
const weatherService = new LiveWeatherService({
  station: 'LFMN',
  pollIntervalMs: 60000,
  onUpdate: data => {
    const el = document.querySelector('#weather-hud');
    if (el && data) {
      el.textContent = `${data.station} ${data.tempC}°C · Wind ${data.windDirectionDeg}° at ${data.windSpeedKnots}kt · Active Runway ${data.activeRunway}`;
    }
  }
});
weatherService.start();

// Initial camera placement
camera.position.copy(views.overview.pos);
controls.target.copy(views.overview.look);
controls.update();

// Energy-saving render loop with idle throttling
let lastTime = performance.now();
const lastCamPos = new THREE.Vector3();
const lastCamRot = new THREE.Quaternion();
let idleSeconds = 0;
let frames = 0;

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  controls.update();

  const camMoved = lastCamPos.distanceToSquared(camera.position) > 0.001 ||
                   lastCamRot.angleTo(camera.quaternion) > 0.001;
  if (camMoved) {
    lastCamPos.copy(camera.position);
    lastCamRot.copy(camera.quaternion);
    idleSeconds = 0;
  } else {
    idleSeconds += dt;
  }

  // If stationary > 3s, render every other frame to conserve GPU
  const isIdle = idleSeconds > 3.0;
  if (!isIdle || frames % 2 === 0) {
    renderer.render(scene, camera);
  }
  frames++;
});

// Window resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Expose public API on window.__nice
window.__nice = {
  scene,
  camera,
  renderer,
  controls,
  worldRoot,
  weather: weatherService,
  views,
  get currentView() { return currentViewId; },
  goTo,
  ready: true
};

document.documentElement.dataset.niceReady = 'true';
const loader = document.querySelector('#loading');
if (loader) loader.remove();
