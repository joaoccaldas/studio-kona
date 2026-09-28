// Pack for Kona: the first scene of the game (issue #24). The athlete's apartment is baked in Blender
// (blender/apartment.py); the gear comes from the shared library (blender/gear.py + assets/gear/gear.json).
// Tap an item and it goes into the bike box or the suitcase. Traps stay home. What you forget follows you to Kona.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const W = (x, y, z = 0) => new THREE.Vector3(x, z, -y); // Blender (x, y, z-up) -> Three.js
const MEDALS = [{ id: 'gold', label: 'Gold', t: 45 }, { id: 'silver', label: 'Silver', t: 75 }, { id: 'bronze', label: 'Bronze', t: Infinity }];
export const BIKES = [
  { id: 'speedmax_cfr', name: 'Canyon Speedmax CFR', year: 'MY2027', file: 'speedmax_2027_cfr.glb', ready: true,
    note: 'Photo-calibrated reconstruction from Canyon studio images and published size-M geometry.' },
  { id: 'trek_sc_slr', name: 'Trek Speed Concept SLR', year: 'Gen 3', ready: false, note: 'In the workshop: the web model is not finished yet.' },
];

function kitMaterial(tint) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, emissive: 0xffc46b, emissiveIntensity: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTint = { value: new THREE.Color(tint) };
    sh.vertexShader = 'uniform vec3 uTint;\n' + sh.vertexShader.replace('#include <color_vertex>',
      '#include <color_vertex>\n vColor.xyz = mix(vColor.xyz, vColor.xyz * uTint, step(2.9, vColor.x + vColor.y + vColor.z));');
  };
  return m;
}

export async function runApartment({ player, rewards, base = 'assets/', onDone }) {
  const look = player.look || {};
  const root = document.createElement('div');
  root.id = 'apt';
  root.innerHTML = `
    <canvas id="aptCanvas"></canvas>
    <div class="apt-top">
      <div class="apt-chip"><b>Pack for Kona</b><span id="aptCount">0 / 0</span></div>
      <div class="apt-chip apt-time"><span id="aptTime">0:00</span></div>
    </div>
    <div class="apt-tip" id="aptTip">Tap what you need for race week. It goes into the bike box or the suitcase.</div>
    <div class="apt-bottom">
      <button type="button" id="aptHint" class="apt-ghost">Hint</button>
      <button type="button" id="aptClose" class="apt-primary">Close the bike box</button>
    </div>
    <section id="aptSheet" hidden></section>
    <div id="aptLoad"><div><b>Your apartment</b><span>Getting your bike ready…</span></div></div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);

  const canvas = $('#aptCanvas');
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.75 : 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc4e6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60);
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x8a6a4a, 1.1);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.copy(W(-2.9, 8, 5.3));
  scene.add(hemi, sun);

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 74 : 58;                       // portrait phones need a wider view
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- load the room, the gear and the bike
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [roomG, gearG, manifest] = await Promise.all([
    loader.loadAsync(base + 'apartment/apartment.glb'),
    loader.loadAsync(base + 'gear/gear.glb'),
    fetch(base + 'gear/gear.json').then(r => r.json()),
  ]);
  const spots = {}, itemSpots = [];
  roomG.scene.traverse(o => {
    if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }); // walls are single planes
    if (/^(SPOT|CAM)_/.test(o.name)) spots[o.name] = o;
    if (/^ITEM_/.test(o.name)) itemSpots.push(o);
  });
  scene.add(roomG.scene);
  roomG.scene.updateMatrixWorld(true);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.12, depthWrite: false }));
  glass.position.copy(W(-1.0, 2.49, 1.6));
  scene.add(glass);

  const geo = {};
  gearG.scene.traverse(o => { if (o.isMesh && o.name.endsWith('_LOD0')) geo[o.name.slice(5, -5)] = o.geometry; });
  const byId = Object.fromEntries(manifest.items.map(i => [i.id, i]));
  const wpos = o => o.getWorldPosition(new THREE.Vector3());

  const bikeBox = new THREE.Mesh(geo.bike_box, kitMaterial(0xffffff));
  bikeBox.position.copy(wpos(spots.SPOT_bikebox));
  bikeBox.rotation.y = spots.SPOT_bikebox.rotation.y;
  const suitcase = new THREE.Mesh(geo.suitcase, kitMaterial(look.suit || 0x2a9d8f));
  suitcase.position.copy(wpos(spots.SPOT_suitcase));
  suitcase.rotation.y = spots.SPOT_suitcase.rotation.y;
  scene.add(bikeBox, suitcase);

  const bikeDef = BIKES.find(b => b.id === look.bike && b.ready) || BIKES[0];
  loader.loadAsync(base + 'bikes/' + bikeDef.file).then(g => {
    const bike = g.scene;
    const box = new THREE.Box3().setFromObject(bike);
    bike.position.copy(wpos(spots.SPOT_bike));
    bike.position.y -= box.min.y;
    bike.position.x -= (box.min.x + box.max.x) / 2;
    scene.add(bike);
  }).catch(e => console.warn('bike model', e));

  // The packing list: your chosen helmet, race kit, the essentials, some optional extras and two traps.
  const helmet = byId[look.helmet] ? look.helmet : 'helmet_longtail';
  const wanted = [helmet, 'shoe_tri', 'shoe_plated', 'suit_sleeved', 'swimskin', 'goggles', 'race_belt', 'bottle', 'nutrition',
    'pedals', 'tools', 'sunscreen', 'passport', 'sunglasses', 'watch', 'charger', 'shoe_trainer', 'wetsuit', 'glass_bottle'];
  const rnd = (() => { let s = 20261010; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); })();
  const free = itemSpots.slice().sort(() => rnd() - 0.5);
  const items = wanted.filter(id => geo[id] && byId[id]).map((id, i) => {
    const def = byId[id];
    const tint = def.cat === 'apparel' || def.cat === 'helmet' ? (look.suit || 0xffffff) : 0xffffff;
    const mesh = new THREE.Mesh(geo[id], kitMaterial(tint));
    const spot = free[i % free.length];
    mesh.position.copy(wpos(spot));
    mesh.rotation.y = spot.rotation.y;
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.16, size.length() * 0.6), 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = size.y / 2;
    mesh.add(hit);
    scene.add(mesh);
    const it = { id, def, mesh, hit, state: 'loose', trap: def.pack === 'trap', needed: !!def.needed };
    hit.userData.item = it;
    return it;
  });
  const needed = items.filter(i => i.needed);

  // ---------------------------------------------------------------- camera: look around by dragging, tap to pack
  const camPos = wpos(spots.CAM_start), look0 = wpos(spots.CAM_look);
  camera.position.copy(camPos);
  const baseDir = look0.clone().sub(camPos).normalize();
  const baseYaw = Math.atan2(baseDir.x, baseDir.z), basePitch = Math.asin(baseDir.y);
  let yaw = 0, pitch = 0, drag = null, moved = 0;
  const aim = () => {
    const y = baseYaw + yaw, p = basePitch + pitch;
    camera.lookAt(camPos.clone().add(new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p))));
  };
  aim();
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      moved += Math.abs(dx) + Math.abs(dy);
      yaw = THREE.MathUtils.clamp(yaw + dx * 0.004, -0.75, 0.75);
      pitch = THREE.MathUtils.clamp(pitch - dy * 0.003, -0.35, 0.25);
      drag = { x: e.clientX, y: e.clientY };
      aim();
    } else hover(e);
  });
  canvas.addEventListener('pointerup', e => { if (drag && moved < 8) tap(e); drag = null; });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(items.filter(i => i.state === 'loose').map(i => i.hit), false);
    return hits[0]?.object.userData.item || null;
  }
  let hovered = null;
  function hover(e) {
    const it = pick(e);
    if (it === hovered) return;
    if (hovered) hovered.mesh.scale.setScalar(1);
    hovered = it;
    canvas.style.cursor = it ? 'pointer' : 'grab';
    if (it) { it.mesh.scale.setScalar(1.12); tip(it.def.name); }
  }

  // ---------------------------------------------------------------- game state
  let t0 = null, elapsed = 0, traps = 0, finished = false, hintAt = 0, lastAct = performance.now();
  const flights = [];
  const tipEl = $('#aptTip');
  let tipT = 0;
  function tip(text, ms = 2600) {
    tipEl.textContent = text;
    tipEl.classList.add('on');
    clearTimeout(tipT);
    tipT = setTimeout(() => tipEl.classList.remove('on'), ms);
  }
  function count() { $('#aptCount').textContent = `${needed.filter(i => i.state === 'packed').length} / ${needed.length}`; }
  count();

  function tap(e) {
    if (finished) return;
    const it = pick(e);
    if (!it) return;
    if (t0 === null) t0 = performance.now();
    lastAct = performance.now();
    if (it.trap) {
      traps++;
      it.state = 'left';
      shake(it.mesh);
      tip(it.def.note || 'Leave it at home.', 4200);
      return;
    }
    it.state = 'packed';
    const dest = it.def.pack === 'bikebox' ? bikeBox : suitcase;
    const into = dest.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.35, dest === bikeBox ? 0.55 : 0.12, (Math.random() - 0.5) * 0.25));
    flights.push({ it, from: it.mesh.position.clone(), to: into, t: 0 });
    tip(`${it.def.name} → ${dest === bikeBox ? 'bike box' : 'suitcase'}${it.def.note ? '. ' + it.def.note : ''}`, it.def.note ? 3800 : 1800);
    count();
  }
  function shake(mesh) {
    const x = mesh.position.x;
    let k = 0;
    const id = setInterval(() => { mesh.position.x = x + Math.sin(k++ * 2.2) * 0.03; if (k > 12) { clearInterval(id); mesh.position.x = x; mesh.visible = false; } }, 30);
  }
  $('#aptHint').onclick = () => {
    const left = needed.filter(i => i.state === 'loose');
    if (!left.length) return tip('Everything you need is packed.');
    hintAt = performance.now();
    const it = left[0];
    tip(`Look for: ${it.def.name}`);
    const dir = it.mesh.position.clone().sub(camPos).normalize();
    yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z) - baseYaw, -0.75, 0.75);
    pitch = THREE.MathUtils.clamp(Math.asin(dir.y) - basePitch, -0.35, 0.25);
    aim();
    it.pulse = 3;
  };
  $('#aptClose').onclick = () => {
    const missing = needed.filter(i => i.state !== 'packed');
    if (missing.length && !finished) {
      sheet(`<div class="d-eyebrow">Not everything is packed</div><h2>Leave without ${missing.length} item${missing.length > 1 ? 's' : ''}?</h2>
        <ul>${missing.map(i => `<li>${i.def.name}</li>`).join('')}</ul>
        <p class="d-note">You can still race, but you will have to find replacements in Kailua with Credits.</p>`,
      [{ label: 'Keep packing', primary: true }, { label: 'Close it anyway', run: finish }]);
      return;
    }
    finish();
  };

  function sheet(html, actions) {
    const el = $('#aptSheet');
    el.innerHTML = html + `<div class="d-actions">${actions.map((a, i) => `<button type="button" data-a="${i}" class="${a.primary ? 'primary' : ''}">${a.label}</button>`).join('')}</div>`;
    el.hidden = false;
    el.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { el.hidden = true; actions[+b.dataset.a].run?.(); }; });
  }

  function finish() {
    if (finished) return;
    finished = true;
    const secs = t0 === null ? 0 : (performance.now() - t0) / 1000;
    const packed = needed.filter(i => i.state === 'packed');
    const missing = needed.filter(i => i.state !== 'packed').map(i => i.id);
    const extras = items.filter(i => !i.needed && !i.trap && i.state === 'packed').map(i => i.id);
    const complete = missing.length === 0;
    const medal = complete ? MEDALS.find(m => secs <= m.t + traps * 5) : null;
    const prev = player.packing;
    const best = prev?.bestSecs && complete ? Math.min(prev.bestSecs, secs) : complete ? secs : prev?.bestSecs ?? null;
    const reward = rewards?.grantOnce('pack:first', { xp: 200, credits: 80, items: ['wristband'], reason: 'Packed for Kona' });
    const medalReward = medal ? rewards?.grantOnce(`pack:medal:${medal.id}`, { xp: medal.id === 'gold' ? 150 : medal.id === 'silver' ? 80 : 40, credits: 20, reason: `Packing ${medal.label}` }) : null;
    player.packing = { packed: packed.map(i => i.id), missing, extras, traps, secs: Math.round(secs * 10) / 10, medal: medal?.id || null, bestSecs: best, at: Date.now() };
    onDone?.('save', player);
    const delta = prev?.bestSecs && complete ? secs - prev.bestSecs : null;
    const chips = [];
    for (const g of [reward, medalReward]) if (g) { chips.push(`<span class="chip">+${g.xp} XP</span>`, `<span class="chip">+${g.credits} Credits</span>`); }
    sheet(`<div class="d-eyebrow">${medal ? medal.label + ' medal' : complete ? 'Packed' : 'Packed, with gaps'}</div>
      <h2>${complete ? 'Ready for Kona' : `${missing.length} thing${missing.length > 1 ? 's' : ''} left behind`}</h2>
      <p class="d-note">${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}${traps ? ` · ${traps} trap${traps > 1 ? 's' : ''} (+${traps * 5} s)` : ''}${delta !== null ? ` · ${delta <= 0 ? 'new best by ' + Math.abs(delta).toFixed(1) + ' s' : '+' + delta.toFixed(1) + ' s on your best'}` : ''}. Gold is under 45 s with everything packed.</p>
      ${missing.length ? `<ul>${missing.map(id => `<li>${byId[id].name}: you will need to sort this out in Kona</li>`).join('')}</ul>` : ''}
      ${chips.length ? `<div class="d-rewards">${chips.join('')}</div>` : ''}`,
    [{ label: 'Fly to Kona', primary: true, run: () => depart() }, { label: 'Pack again', run: () => restart() }]);
  }
  function restart() {
    finished = false; t0 = null; traps = 0;
    items.forEach((it, i) => {
      it.state = 'loose';
      it.mesh.visible = true;
      it.mesh.scale.setScalar(1);
      const spot = free[i % free.length];
      it.mesh.position.copy(wpos(spot));
    });
    count();
    tip('Again: everything you need, as fast as you can.');
  }
  let raf = 0, alive = true;
  function depart() {
    alive = false;
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    renderer.dispose();
    root.remove();
    onDone?.('depart', player);
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (t0 !== null && !finished) {
      elapsed = (now - t0) / 1000;
      $('#aptTime').textContent = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t = Math.min(1, f.t + dt * 1.8);
      const e = f.t * f.t * (3 - 2 * f.t);
      f.it.mesh.position.lerpVectors(f.from, f.to, e);
      f.it.mesh.position.y += Math.sin(e * Math.PI) * 0.6;
      f.it.mesh.rotation.y += dt * 6;
      f.it.mesh.scale.setScalar(1 - e * 0.35);
      if (f.t >= 1) flights.splice(i, 1);
    }
    const glow = 0.18 + 0.12 * Math.sin(now * 0.004);
    for (const it of items) {
      if (it.state !== 'loose') { it.mesh.material.emissiveIntensity = 0; continue; }
      it.mesh.material.emissiveIntensity = it.pulse && now - hintAt < 3000 ? 0.9 * (0.5 + 0.5 * Math.sin(now * 0.012)) : glow * 0.35;
    }
    if (!finished && now - lastAct > 15000 && needed.some(i => i.state === 'loose')) { lastAct = now; tip('Stuck? Tap Hint.'); }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  $('#aptLoad').remove();
  raf = requestAnimationFrame(frame);
  return { finish, restart, items, get state() { return { elapsed, traps, packed: needed.filter(i => i.state === 'packed').length, needed: needed.length }; }, camera, scene };
}
