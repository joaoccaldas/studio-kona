// Level 5 · Honu Spotter (Observation). An easy spin along the Kawaihae coast. Sea life surfaces for a moment:
// tap it to take its photo. Rocks and logs that look like turtles cost points. Whales and golden honu are rare.
import * as THREE from 'three';
import { pedal, mat } from '../rideKit.js';

const DURATION = 60, SPEED = 8;
const KINDS = {
  honu: { pts: 2, w: 30, label: 'Honu', life: 3.2 },
  dolphin: { pts: 3, w: 20, label: 'Spinner dolphin', life: 1.5 },
  manta: { pts: 3, w: 12, label: 'Manta ray', life: 3 },
  whale: { pts: 6, w: 7, label: 'Humpback breach', life: 2.6 },
  golden: { pts: 10, w: 3, label: 'Golden honu!', life: 2 },
  rock: { pts: -2, w: 18, label: 'Just a rock', life: 4, decoy: true },
  log: { pts: -2, w: 10, label: 'Driftwood', life: 4, decoy: true },
};

function turtle(shell, spots) {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(shell, { roughness: 0.6 }));
  s.scale.set(1, 0.55, 1.3);
  g.add(s);
  for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.14, 6), mat(spots)); d.rotation.x = -Math.PI / 2 + 0.3; d.position.set((i % 2 - 0.5) * 0.4, 0.28, (i - 2) * 0.22); g.add(d); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat(0x6f7a45)); head.position.set(0, 0.08, -0.85);
  g.add(head);
  for (const [x, z] of [[-0.55, -0.35], [0.55, -0.35], [-0.4, 0.55], [0.4, 0.55]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.18), mat(0x6f7a45)); f.position.set(x, 0.02, z); f.rotation.y = x * 0.8; g.add(f); }
  return g;
}
function build(kind) {
  let g;
  if (kind === 'honu') g = turtle(0x5d6b34, 0x3f4a20);
  else if (kind === 'golden') { g = turtle(0xe8b93c, 0xb8852a); g.children[0].material = new THREE.MeshStandardMaterial({ color: 0xffcf5c, emissive: 0xb07a10, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 }); }
  else if (kind === 'rock') { g = new THREE.Group(); const r = new THREE.Mesh(new THREE.SphereGeometry(0.62, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x4a4540, { flatShading: true, roughness: 1 })); r.scale.set(1, 0.6, 1.25); g.add(r); }
  else if (kind === 'log') { g = new THREE.Group(); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.2, 8), mat(0x7a5a3a, { roughness: 1 })); l.rotation.z = Math.PI / 2; l.rotation.y = 0.5; g.add(l); }
  else if (kind === 'dolphin') {
    g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.4, 6, 12), mat(0x7b8a96, { roughness: 0.35 })); b.rotation.x = Math.PI / 2; g.add(b);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 4), mat(0x6b7a86)); fin.position.set(0, 0.35, 0.1); g.add(fin);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.22), mat(0x6b7a86)); tail.position.z = 1.05; g.add(tail);
  } else if (kind === 'manta') {
    g = new THREE.Group();
    const shape = new THREE.Shape(); shape.moveTo(0, -0.9); shape.lineTo(1.6, 0.2); shape.lineTo(0, 0.6); shape.lineTo(-1.6, 0.2); shape.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: 0x1b2a33, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; g.add(m);
  } else {
    g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 5, 8, 16), mat(0x2b3440, { roughness: 0.5 })); b.rotation.x = Math.PI / 2; g.add(b);
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 4, 6, 12), mat(0xe3e6e8)); belly.rotation.x = Math.PI / 2; belly.position.y = -0.5; belly.scale.set(1, 1, 0.9); g.add(belly);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 0.8), mat(0x2b3440)); fin.position.set(0, -0.3, -1); g.add(fin);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export default {
  scene: '3d',
  shoreX: -9,
  create(ctx) {
    const { scene, hud, me, sfx, haptic, course, camera } = ctx;
    const S = { t: 0, score: 0, shots: 0, album: [], nextSpawn: 1.2, cool: 0, done: false, dist: 0 };
    const live = [];
    const hits = [];
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const splashGeo = new THREE.SphereGeometry(0.12, 6, 4), splashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const splashes = [];
    const splash = (p, n = 12, big = 1) => { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(splashGeo, splashMat); m.position.copy(p); m.scale.setScalar(big); scene.add(m); splashes.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 3 * big, 3 + Math.random() * 3 * big, (Math.random() - 0.5) * 3 * big), t: 0 }); } };

    function pickKind() {
      const tot = Object.values(KINDS).reduce((a, k) => a + k.w, 0);
      let r = Math.random() * tot;
      for (const [id, k] of Object.entries(KINDS)) { if ((r -= k.w) < 0) return id; }
      return 'honu';
    }
    function spawn() {
      const kind = pickKind(), k = KINDS[kind];
      const onShore = kind === 'honu' || kind === 'golden' || kind === 'rock';
      const z = -16 - Math.random() * 22;
      const x = kind === 'whale' ? -44 - Math.random() * 12 : onShore ? -10.5 - Math.random() * 4 : -17 - Math.random() * 9;
      const g = build(kind);
      if (kind !== 'whale') g.scale.setScalar(1.6);
      g.position.set(x, onShore ? -0.4 : -0.2, z);
      g.rotation.y = onShore ? Math.random() * 6 : kind === 'dolphin' || kind === 'whale' ? Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1) : Math.random() * 6;
      scene.add(g);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(kind === 'whale' ? 4.5 : 1.6, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      g.add(hit);
      const o = { kind, g, hit, age: 0, life: k.life, x, z, onShore, snapped: false, base: g.position.y };
      hit.userData.o = o;
      live.push(o); hits.push(hit);
      if (kind === 'dolphin' && Math.random() < 0.6) setTimeout(() => { if (!S.done) { const d = spawnAt('dolphin', x + 2, z - 3); d.age = -0.25; } }, 10);
    }
    function spawnAt(kind, x, z) {
      const g = build(kind);
      g.scale.setScalar(1.6);
      g.position.set(x, -0.2, z); g.rotation.y = Math.PI / 2;
      scene.add(g);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      g.add(hit);
      const o = { kind, g, hit, age: 0, life: KINDS[kind].life, x, z, onShore: false, snapped: false, base: -0.2 };
      hit.userData.o = o; live.push(o); hits.push(hit);
      return o;
    }
    function remove(o) {
      scene.remove(o.g);
      live.splice(live.indexOf(o), 1);
      hits.splice(hits.indexOf(o.hit), 1);
    }
    function snap(ev) {
      if (S.cool > 0) return;
      S.cool = 0.35;
      hud.flash('#ffffff');
      sfx.step();
      ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const h = ray.intersectObjects(hits, false)[0];
      S.shots++;
      if (!h) return;
      const o = h.object.userData.o;
      if (o.snapped) return;
      o.snapped = true;
      const k = KINDS[o.kind];
      S.score = Math.max(0, S.score + k.pts);
      if (k.decoy) { hud.pop(`${k.label} ${k.pts}`, 'bad', ev.clientX, ev.clientY); sfx.trap(); haptic([30, 30]); }
      else { S.album.push(o.kind); hud.pop(`📸 ${k.label} +${k.pts}`, k.pts >= 6 ? 'hot' : '', ev.clientX, ev.clientY); sfx.pack(Math.min(8, k.pts)); haptic(k.pts >= 6 ? [10, 30, 10, 30] : 14); }
      hud.score(S.score);
    }

    return {
      start() { hud.tip('Tap animals to photograph them. Rocks and logs are decoys!', false, 3500); },
      step(dt) {
        S.t += dt;
        S.cool = Math.max(0, S.cool - dt);
        const move = SPEED * dt;
        S.dist += move;
        course.advance(move, S.t);
        pedal(me, S.dist / 7);
        me.position.x = -3;
        S.nextSpawn -= dt;
        if (S.nextSpawn <= 0 && S.t < DURATION - 2) { spawn(); S.nextSpawn = 0.9 + Math.random() * 1.3; }
        for (const o of [...live]) {
          o.age += dt;
          o.z += move * 0.35;                                         // the coast slides by slower than the road
          const a = Math.max(0, o.age), u = a / o.life;
          const g = o.g;
          g.position.z = o.z;
          if (o.kind === 'dolphin') { g.position.y = -0.4 + Math.sin(Math.min(1, u) * Math.PI) * 2.6; g.rotation.x = (u - 0.5) * 1.6; }
          else if (o.kind === 'whale') { g.position.y = -4 + Math.sin(Math.min(1, u) * Math.PI) * 6.5; g.rotation.x = -0.9 + u * 0.6; if (!o.splashed && u > 0.1) { o.splashed = 1; splash(g.position.clone().setY(0), 26, 2.5); } if (!o.fell && u > 0.9) { o.fell = 1; splash(g.position.clone().setY(0), 30, 3); } }
          else if (o.kind === 'manta') { g.position.y = -0.15 + Math.sin(S.t * 2) * 0.05; g.position.x = o.x + Math.sin(a * 1.2) * 2; g.children[0].scale.y = 1 + Math.sin(a * 6) * 0.25; }
          else if (o.onShore) { const up = Math.min(1, a * 2, (o.life - a) * 2); g.position.y = -0.45 + up * 0.55 + (o.kind !== 'rock' ? Math.sin(a * 3) * 0.03 : 0); if (o.kind !== 'rock' && g.children[6]) g.children[6].position.z = -0.85 - Math.max(0, Math.sin(a * 2)) * 0.12; }
          else g.position.y = -0.12 + Math.sin(a * 2) * 0.05;
          if (o.snapped && !KINDS[o.kind].decoy) g.traverse(m => { if (m.isMesh && m.material.emissive && !m.userData.lit) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0x335577); m.material.emissiveIntensity = 0.4; m.userData.lit = 1; } });
          if (a > o.life || o.z > 12) remove(o);
        }
        for (let i = splashes.length - 1; i >= 0; i--) { const p = splashes[i]; p.t += dt; p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt); if (p.t > 1.1) { scene.remove(p.m); splashes.splice(i, 1); } }
        hud.meter('time', { label: `${Math.max(0, DURATION - S.t).toFixed(0)} s of coast left · album ${S.album.length}`, value: 1 - S.t / DURATION });
        if (!S.done && S.t >= DURATION) { S.done = true; ctx.end(S.score, { note: `${S.album.length} photos · ${S.album.filter(k => k === 'whale' || k === 'golden').length} rare` }); }
        // Camera looks out over the water on the left.
        camera.position.lerp(new THREE.Vector3(-0.5, 4.2, 7.5), Math.min(1, dt * 3));
        course.sky.position.copy(camera.position);
        camera.lookAt(-11, 0.2, -26);
      },
      idle() { camera.position.set(-0.5, 4.2, 7.5); course.sky.position.copy(camera.position); camera.lookAt(-11, 0.2, -26); },
      down: snap,
      key(k, down) { if (down && k === ' ') { const o = live.find(x => !x.snapped); if (o) { const v = o.g.position.clone().project(camera); snap({ clientX: (v.x + 1) / 2 * innerWidth, clientY: (1 - v.y) / 2 * innerHeight }); } } },
      debug: () => ({ ...S, live: live.map(o => { const v = o.g.position.clone().project(camera); return { kind: o.kind, snapped: o.snapped, sx: (v.x + 1) / 2 * innerWidth, sy: (1 - v.y) / 2 * innerHeight, age: o.age, y: o.g.position.y }; }) }),
      api: { snapAt: (x, y) => snap({ clientX: x, clientY: y }) },
    };
  },
};
