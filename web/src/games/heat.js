// Level 7 · Energy Lab Heat (Management). Two meters: core temperature climbs in the sun and energy drains.
// Change lanes to collect ice and sponges (cool), gels and cola (fuel), water (a bit of both); dodge the
// shimmering hot tarmac. Score is the seconds both meters stay in the green.
import * as THREE from 'three';
import { LANES, pedal, mat } from '../rideKit.js';
import { gearModel } from '../gearModels.js';

const DURATION = 70, SPEED = 11, GAP = 14;
const ITEM = {
  ice: { heat: -34, energy: 0, label: 'Ice', cls: 'fuel' },
  sponge: { heat: -20, energy: 0, label: 'Sponge', cls: 'fuel' },
  water: { heat: -8, energy: 6, label: 'Water', cls: 'fuel' },
  gel: { heat: 0, energy: 28, label: 'Gel', cls: '' },
  cola: { heat: 4, energy: 18, label: 'Cola', cls: '' },
};
const HOT_OK = 65, LOW_OK = 30;

function model(kind) {
  const g = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: kind === 'ice' || kind === 'sponge' || kind === 'water' ? 0x9fe3f0 : 0xf3d9a4, transparent: true, opacity: 0.5, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03;
  g.add(halo);
  let m;
  if (kind === 'ice') { m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshPhysicalMaterial({ color: 0xdff6ff, transmission: 0.6, roughness: 0.1, thickness: 0.5, transparent: true, opacity: 0.85 })); }
  else if (kind === 'sponge') m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.4), mat(0xf5d442, { roughness: 1 }));
  else if (kind === 'water') { m = gearModel('bottle', 0x3e8ea0); m?.scale.setScalar(3.4); }
  else if (kind === 'gel') { m = gearModel('nutrition'); m?.scale.setScalar(5); }
  else m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.55, 16), mat(0xc0392b, { metalness: 0.6, roughness: 0.3 }));
  m = m || new THREE.Mesh(new THREE.SphereGeometry(0.3), mat(0xd9785b));
  m.position.y = 0.8;
  g.add(m);
  g.userData.m = m;
  return g;
}

export default {
  scene: '3d',
  create(ctx) {
    const { scene, hud, me, sfx, haptic, course } = ctx;
    const S = { t: 0, lane: 1, px: 0, heat: 28, energy: 75, green: 0, dist: 0, next: 10, done: false, lean: 0, got: 0, hot: 0 };
    const items = [], patches = [];
    const patchMat = new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.35, depthWrite: false });
    const shadeMat = new THREE.MeshBasicMaterial({ color: 0x13293d, transparent: true, opacity: 0.35, depthWrite: false });
    // Solar arrays line the Energy Lab road.
    const panels = [];
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 2.2), mat(0x1d3557, { metalness: 0.5, roughness: 0.25 }));
      p.rotation.x = -0.5; p.position.set(i % 2 ? 11 : 15, 1.2, -i * 22);
      scene.add(p);
      panels.push(p);
    }
    const pick = a => a[(Math.random() * a.length) | 0];
    function spawnRow() {
      const z = -150, lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
      const late = S.t / DURATION;
      const cool = S.heat > 50 ? 0.65 : 0.45;
      const k1 = Math.random() < cool ? pick(['ice', 'sponge', 'sponge', 'water']) : pick(['gel', 'cola', 'water', 'gel']);
      add(k1, lanes[0], z);
      if (Math.random() < 0.45) add(Math.random() < 0.5 ? pick(['gel', 'cola']) : pick(['sponge', 'water']), lanes[1], z - 6);
      if (Math.random() < 0.35 + late * 0.35) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 9), patchMat); m.rotation.x = -Math.PI / 2; m.position.set(LANES[lanes[2]], 0.025, z); scene.add(m); patches.push({ m, lane: lanes[2], z, len: 9, hot: true }); }
      else if (Math.random() < 0.2) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 7), shadeMat); m.rotation.x = -Math.PI / 2; m.position.set(LANES[lanes[2]], 0.025, z); scene.add(m); patches.push({ m, lane: lanes[2], z, len: 7, hot: false }); }
    }
    function add(kind, lane, z) { const g = model(kind); g.position.set(LANES[lane], 0, z); scene.add(g); items.push({ kind, lane, z, g, got: false }); }
    const steer = dir => { const n = Math.max(0, Math.min(2, S.lane + dir)); if (n !== S.lane) { S.lane = n; S.lean = dir * 0.35; haptic(8); } };

    return {
      start() { hud.tip('Blue items cool you, gold ones fuel you. Keep both meters green', false, 3500); },
      step(dt) {
        S.t += dt;
        const move = SPEED * dt;
        S.dist += move;
        course.advance(move, S.t);
        S.px += (LANES[S.lane] - S.px) * Math.min(1, dt * 11);
        S.lean *= Math.pow(0.02, dt);
        me.position.x = S.px; me.rotation.z = -S.lean;
        pedal(me, S.dist / 7);
        S.next -= move;
        if (S.next <= 0 && S.t < DURATION - 3) { spawnRow(); S.next = GAP + Math.random() * 6; }
        // The body: heat builds faster as the day goes on; energy burns steadily.
        let heatRate = 1.8 + (S.t / DURATION) * 1.4, inShade = false, onHot = false;
        for (const p of patches) {
          p.z += move; p.m.position.z = p.z;
          if (p.lane === S.lane && Math.abs(p.z) < p.len / 2) { if (p.hot) onHot = true; else inShade = true; }
          if (p.z > 20) { scene.remove(p.m); p.dead = true; }
        }
        for (let i = patches.length - 1; i >= 0; i--) if (patches[i].dead) patches.splice(i, 1);
        if (onHot) { heatRate += 10; if (!S.hot) { S.hot = 1; hud.pop('Hot tarmac!', 'bad'); haptic(20); } } else S.hot = 0;
        if (inShade) heatRate -= 9;
        S.heat = Math.max(0, Math.min(100, S.heat + heatRate * dt));
        S.energy = Math.max(0, Math.min(100, S.energy - 1.8 * dt));
        for (const it of items) {
          if (it.got) continue;
          it.z += move; it.g.position.z = it.z;
          it.g.userData.m.rotation.y += dt * 2.4;
          if (it.lane === S.lane && it.z > -0.9 && it.z - move < 0.9) {
            it.got = true; S.got++;
            const k = ITEM[it.kind];
            S.heat = Math.max(0, Math.min(100, S.heat + k.heat));
            S.energy = Math.max(0, Math.min(100, S.energy + k.energy));
            hud.pop(`${k.label}${k.heat < 0 ? ` ${k.heat}°` : ''}${k.energy ? ` +${k.energy}⚡` : ''}`, k.cls);
            sfx.step(); haptic(12);
            scene.remove(it.g);
          }
          if (it.z > 16) { it.got = true; scene.remove(it.g); }
        }
        const ok = S.heat < HOT_OK && S.energy > LOW_OK;
        if (ok) S.green += dt;
        hud.score(`${Math.floor(S.green)} s`);
        hud.meter('heat', { label: `Core temp ${S.heat > 80 ? '· overheating!' : ''}`, value: S.heat / 100, band: [0, HOT_OK / 100], danger: S.heat >= HOT_OK, color: S.heat >= HOT_OK ? '#D9785B' : '#3e8ea0' });
        hud.meter('energy', { label: `Energy ${S.energy < 20 ? '· bonking!' : ''}`, value: S.energy / 100, band: [LOW_OK / 100, 1], danger: S.energy <= LOW_OK, color: S.energy <= LOW_OK ? '#D9785B' : '#e8c35a' });
        hud.meter('time', { label: `${Math.max(0, DURATION - S.t).toFixed(0)} s to the Lab exit`, value: 1 - S.t / DURATION });
        for (const p of panels) { p.position.z += move; if (p.position.z > 15) p.position.z -= 220; }
        ctx.scene.fog.near = 30 + Math.max(0, 40 - S.heat * 0.4);
        if (!S.done && (S.heat >= 100 || S.energy <= 0)) { S.done = true; ctx.end(S.green, { title: S.heat >= 100 ? 'Heatstroke' : 'Bonk', note: `You made it ${Math.round(S.t)} s into the Energy Lab` }); }
        if (!S.done && S.t >= DURATION) { S.done = true; ctx.end(S.green, { note: `${Math.round(S.green)} of ${DURATION} s in the green · ${S.got} aid items` }); }
        course.chase(S.px, 0.35, dt, { height: 4.4, back: 7.8, look: -20 });
      },
      down(ev) { steer(ev.clientX < innerWidth / 2 ? -1 : 1); },
      key(k, down) { if (!down) return; if (k === 'arrowleft' || k === 'a') steer(-1); else if (k === 'arrowright' || k === 'd') steer(1); },
      debug: () => ({ ...S, items: items.filter(i => !i.got).map(i => ({ kind: i.kind, lane: i.lane, z: i.z })), patches: patches.map(p => ({ lane: p.lane, z: p.z, hot: p.hot })) }),
      api: { steer },
    };
  },
};
