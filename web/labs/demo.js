// Standalone harness for the aero lab + rider modules. Not part of the Kona world build.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createStreamlines, BIKE_OBSTACLES, riderObstacles, makeChamber, makeLab, makeRider, fit } from '../src/aerolab/index.js';

const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1a1d);
scene.fog = new THREE.Fog(0x0a1a1d, 3, 10);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .5;
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1.4, 3.2, 2.2); key.castShadow = true; scene.add(key);
const camera = new THREE.PerspectiveCamera(32, 1, .02, 60);
camera.position.set(1.9, 1.1, 3.1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(.08, .7, 0); controls.enableDamping = true;
const VIEWS = { riderSide: [[.1, .8, 3.4], [.1, .75, 0]], hero: [[1.9, 1.1, 3.1], [.08, .7, 0]] };
const flyTo = v => { const [p, t] = VIEWS[v] || VIEWS.hero; camera.position.set(...p); controls.target.set(...t); };
const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); };

scene.add(makeChamber());
const flow = createStreamlines({ lines: coarse ? 32 : 64 });
scene.add(flow.group);
let air = 40 / 3.6;

const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('../assets/bikes/speedmax_2027_cfr.glb');
scene.add(gltf.scene);
const parts = {};
gltf.scene.traverse(o => { if (o.userData?.part) parts[o.userData.part] = o; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

const cfg = { rearDisc: false, shield: true, aerofuel: true, frontBottle: false, rearBottles: false, riderEnabled: true };
const show = (id, v) => { if (parts[id]) parts[id].visible = v; };
function applyCfg() {
  show('aeroshield', cfg.shield); show('arm_pads', cfg.shield);
  show('aerofuel_front', cfg.shield && cfg.aerofuel); show('bottle_front', cfg.shield && cfg.aerofuel && cfg.frontBottle);
  show('bottles_rear', cfg.rearBottles); show('bottle_cages_rear', cfg.rearBottles);
}
applyCfg();

const lab = makeLab({
  getCfg: () => cfg, setCfg: p => { Object.assign(cfg, p); applyCfg(); lab.refresh(); }, download, bikeMassKg: 9.1,
  onResult: r => { if (r) { air = r.air || air; flow.setYaw(r.yaw || 0); } },
});
const rider = makeRider({
  scene, parts, flyTo, download,
  onChange: r => { flow.rebuild(r.enabled ? [...BIKE_OBSTACLES, ...riderObstacles(fit.pose(r.fit))] : BIKE_OBSTACLES); lab.refresh(); },
});
rider.enable(true);
lab.setVisible(true);
lab.refresh();
document.querySelector('#openLab').onclick = () => lab.open();
document.querySelector('#openRider').onclick = () => rider.open();
window.__aerolab = { scene, lab, rider, flow, parts, cfg };

const crank = parts.crankset;
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let last = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  flow.update(dt, air);
  if (crank) crank.rotation.z -= dt * Math.PI * 3;             // 90 rpm
  if (rider.enabled) rider.draw(crank ? crank.rotation.z - 12 * Math.PI / 180 : 0);
  controls.update();
  renderer.render(scene, camera);
});
document.body.classList.add('ready');
