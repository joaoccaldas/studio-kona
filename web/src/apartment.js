// Pack for Kona: the first scene of the game (issue #24). The athlete's apartment is baked in Blender
// (blender/apartment.py); the gear comes from the shared library (blender/gear.py + assets/gear/gear.json).
// Tap an item and it goes into the bike box or the suitcase. Traps stay home. What you forget follows you to Kona.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { addRoomLight, createBursts, createSfx, confetti } from './aptFx.js';

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
    <div class="apt-bags" aria-live="polite"><span id="aptBox">Bike box</span><span id="aptCase">Suitcase</span></div>
    <div class="apt-combo" id="aptCombo" aria-hidden="true"></div>
    <section id="aptCoach" hidden aria-live="polite"></section>
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
  renderer.toneMappingExposure = 1.22;
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.75 : 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc4e6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60);
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x8a6a4a, 1.1);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.1);   // fill; the shadow-casting sun lives in aptFx
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
    bike.traverse(m => { if (m.isMesh) m.castShadow = true; });
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
  // The helmet is the hero item: it rests at the spot nearest the camera, so a first-timer finds it at once.
  {
    const cam0 = wpos(spots.CAM_start), fwd = wpos(spots.CAM_look).sub(cam0).normalize();
    const hero = items.find(i => i.def.cat === 'helmet');
    // Best spot: 1.6–3.2 m away and closest to the middle of the opening view.
    const score = i => { const d = i.mesh.position.clone().sub(cam0), L = d.length(); return L < 1.6 || L > 3.2 ? -2 : d.normalize().dot(fwd); };
    const nearest = items.reduce((a, i) => (score(i) > score(a) ? i : a), items[0]);
    if (hero && nearest && hero !== nearest) {
      const p = hero.mesh.position.clone();
      hero.mesh.position.copy(nearest.mesh.position);
      nearest.mesh.position.copy(p);
      [hero.home, nearest.home] = [hero.mesh.position.clone(), nearest.mesh.position.clone()];
    }
  }
  const fxLight = addRoomLight({ renderer, scene, W, coarse, casters: [bikeBox, suitcase, ...items.map(i => i.mesh)] });
  const bursts = createBursts(scene);
  const sfx = createSfx();
  const bags = { bikebox: bikeBox, suitcase };
  const bounce = new Map();                                    // bag -> time left on its landing bounce
  let combo = 0, lastPack = 0;

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
      coach?.dragged(Math.abs(dx) + Math.abs(dy));
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
    const pool = items.filter(i => i.state === 'loose' && (!coach?.active || coach.allows(i)));   // walkthrough: only the highlighted item
    const hits = ray.intersectObjects(pool.map(i => i.hit), false);
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
  function count() {
    $('#aptCount').textContent = `${needed.filter(i => i.state === 'packed').length} / ${needed.length}`;
    const inBag = k => needed.filter(i => i.def.pack === k);
    const b = inBag('bikebox'), c = inBag('suitcase');
    $('#aptBox').textContent = `Bike box ${b.filter(i => i.state === 'packed').length}/${b.length}`;
    $('#aptCase').textContent = `Suitcase ${c.filter(i => i.state === 'packed').length}/${c.length}`;
  }
  count();

  function tap(e) {
    if (finished) return;
    sfx.unlock();
    const it = pick(e);
    if (!it) return;
    if (coach.active && !coach.allows(it)) return;              // during the walkthrough only the highlighted item
    if (t0 === null && !coach.active) t0 = performance.now();
    lastAct = performance.now();
    if (it.trap) {
      traps++;
      combo = 0;
      it.state = 'left';
      shake(it.mesh);
      sfx.trap();
      tip(`+5 s · ${it.def.note || 'Leave it at home.'}`, 4200);
      return;
    }
    it.state = 'packed';
    const now = performance.now();
    combo = now - lastPack < 2600 ? combo + 1 : 1;
    lastPack = now;
    sfx.pack(combo);
    if (combo >= 2) showCombo(combo);
    const dest = bags[it.def.pack] || suitcase;
    const into = dest.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.35, dest === bikeBox ? 0.55 : 0.12, (Math.random() - 0.5) * 0.25));
    flights.push({ it, from: it.mesh.position.clone(), to: into, t: 0, dest });
    tip(`${it.def.name} → ${dest === bikeBox ? 'bike box' : 'suitcase'}${it.def.note ? '. ' + it.def.note : ''}`, it.def.note ? 3800 : 1800);
    count();
    coach.packed(it);
  }
  let comboT = 0;
  function showCombo(n) {
    const el = $('#aptCombo');
    el.textContent = `Combo ×${n}`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(comboT);
    comboT = setTimeout(() => el.classList.remove('on'), 1100);
  }
  function faceTo(at) {                                        // turn the camera toward a point in the room
    const dir = at.clone().sub(camPos).normalize();
    yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z) - baseYaw, -0.75, 0.75);
    pitch = THREE.MathUtils.clamp(Math.asin(dir.y) - basePitch, -0.35, 0.25);
    aim();
  }

  // ---------------------------------------------------------------- guided onboarding (first visit only, skippable)
  // Welcome → drag to look → tap your glowing helmet → how packing works → traps → start the clock.
  const coach = (() => {
    const el = $('#aptCoach');
    const seen = (player.tutorials || []).includes('apartment');
    const helmetItem = items.find(i => i.def.cat === 'helmet');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 40), new THREE.MeshBasicMaterial({ color: 0xd9785b, transparent: true, depthTest: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 10;
    ring.visible = false;
    scene.add(ring);
    let step = seen || !helmetItem ? -1 : 0, dragged = 0;
    const who = (player.name || 'Athlete').split(' ')[0];
    const STEPS = [
      { title: `Aloha, ${who}`, text: 'Race week in Kona starts in five days. Your bike is ready. Pack everything you need before the flight.', next: 'Show me how' },
      { title: 'Look around', text: 'Drag anywhere on the screen to look around the room.', hand: true, next: 'Next' },
      { title: 'Tap your helmet', text: 'Glowing things are yours to pack. Tap the helmet with the orange ring.' },
      { title: 'Into the bags', text: 'Bike kit flies into the bike box, clothes and race kit into the suitcase. The counters at the top show what is left.', next: 'Got it' },
      { title: 'Watch for traps', text: 'Some things belong at home. Each one you pack adds 5 seconds. Stuck? Tap Hint.', next: 'Start the clock' },
    ];
    function render() {
      if (step < 0 || step >= STEPS.length) { el.hidden = true; ring.visible = false; root.classList.remove('coaching'); return; }
      const st = STEPS[step];
      root.classList.add('coaching');
      el.hidden = false;
      el.innerHTML = `<div class="coach-top"><span class="coach-step">${step + 1} of ${STEPS.length}</span><button type="button" class="coach-skip">Skip</button></div>
        <h3>${st.title}</h3><p>${st.text}</p>${st.hand ? '<div class="coach-hand" aria-hidden="true"></div>' : ''}
        ${st.next ? `<button type="button" class="coach-next">${st.next}</button>` : ''}`;
      el.querySelector('.coach-skip').onclick = end;
      const nx = el.querySelector('.coach-next');
      if (nx) nx.onclick = () => go(step + 1);
      ring.visible = step === 2;
      if (step === 2) { faceTo(helmetItem.mesh.position); helmetItem.pulse = 3; hintAt = performance.now() + 60000; }
      sfx.step();
    }
    function go(n) { step = n; if (step >= STEPS.length) end(); else render(); }
    function end() {
      step = -1;
      render();
      if (!(player.tutorials || []).includes('apartment')) { player.tutorials = [...(player.tutorials || []), 'apartment']; onDone?.('save', player); }
      if (t0 === null) t0 = performance.now();
      tip('Clock is running. Pack everything you need.', 2200);
    }
    render();
    return {
      get active() { return step >= 0; },
      allows: it => step === 2 && it === helmetItem,
      packed: it => { if (step === 2 && it === helmetItem) setTimeout(() => go(3), 900); },
      dragged: d => { if (step !== 1) return; dragged += d; if (dragged > 140) go(2); },
      update: t => { if (ring.visible) { ring.position.copy(helmetItem.mesh.position).add(new THREE.Vector3(0, 0.03, 0)); ring.scale.setScalar(1 + 0.15 * Math.sin(t * 5)); } },
    };
  })();
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
    faceTo(it.mesh.position);
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
    root.classList.add('sheet-open');
    el.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { el.hidden = true; root.classList.remove('sheet-open'); actions[+b.dataset.a].run?.(); }; });
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
    if (complete) { sfx.done(); confetti(root); }
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
    finished = false; t0 = null; traps = 0; combo = 0;
    items.forEach((it, i) => {
      it.state = 'loose';
      it.mesh.visible = true;
      it.mesh.scale.setScalar(1);
      it.mesh.position.copy(it.home || wpos(free[i % free.length]));
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
      if (f.t >= 1) {
        flights.splice(i, 1);
        f.it.mesh.visible = false;
        if (f.dest) { bursts.burst(f.to); bounce.set(f.dest, 0.35); }
      }
    }
    fxLight(now / 1000);
    bursts.update(dt);
    coach.update(now / 1000);
    for (const [bag, left] of bounce) {
      const k = Math.max(0, left - dt);
      bag.scale.set(1 + Math.sin((0.35 - k) / 0.35 * Math.PI) * 0.06, 1 - Math.sin((0.35 - k) / 0.35 * Math.PI) * 0.05, 1 + Math.sin((0.35 - k) / 0.35 * Math.PI) * 0.06);
      if (k <= 0) { bounce.delete(bag); bag.scale.set(1, 1, 1); } else bounce.set(bag, k);
    }
    const glow = 0.18 + 0.12 * Math.sin(now * 0.004);
    for (const it of items) {
      if (it.state !== 'loose') { it.mesh.material.emissiveIntensity = 0; continue; }
      it.mesh.material.emissiveIntensity = it.pulse && now - hintAt < 3000 ? 0.9 * (0.5 + 0.5 * Math.sin(now * 0.012)) : glow * 0.35;
    }
    if (!finished && !coach.active && now - lastAct > 15000 && needed.some(i => i.state === 'loose')) { lastAct = now; tip('Stuck? Tap Hint.'); }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  $('#aptLoad').remove();
  raf = requestAnimationFrame(frame);
  return { finish, restart, items, get coaching() { return coach.active; }, get state() { return { elapsed, traps, packed: needed.filter(i => i.state === 'packed').length, needed: needed.length }; }, camera, scene };
}
