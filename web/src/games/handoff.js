// Level 1 · Bottle Hand-off (Timing). Volunteers line the aid station holding out water, gels, sponges and cola.
// A call says what you need; pick the side of the road and press GRAB as your hand meets theirs.
import * as THREE from 'three';
import { LANES, makePerson, pedal, mat } from '../rideKit.js';
import { gearModel } from '../gearModels.js';

const ITEMS = {
  water: { label: 'Water', emoji: '💧' },
  gel: { label: 'Gel', emoji: '⚡' },
  sponge: { label: 'Sponge', emoji: '🧽' },
  cola: { label: 'Cola', emoji: '🥤' },
};
const KINDS = Object.keys(ITEMS);
const ROWS = 16, GAP = 30, SPEED = 10;
const PERFECT = 0.8, GOOD = 2.3;

function itemModel(kind) {
  let m;
  if (kind === 'water') m = gearModel('bottle', 0x3e8ea0);
  else if (kind === 'gel') m = gearModel('nutrition');
  if (m) { m.scale.setScalar(kind === 'gel' ? 3.2 : 2.4); return m; }
  if (kind === 'sponge') { m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), mat(0xf5d442, { roughness: 0.95 })); return m; }
  m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 14), mat(0xc0392b, { metalness: 0.6, roughness: 0.3 }));
  return m;
}

export default {
  scene: '3d',
  create(ctx) {
    const { scene, hud, me, sfx, haptic, course } = ctx;
    const shirts = [0xd9785b, 0x2e6f73, 0xe8c35a, 0x3e8ea0, 0xfbf8f2];
    const skins = [0xf1d3bf, 0xd9a882, 0xb07a52, 0x7a4a2c];
    const rnd = () => Math.random();
    const S = { lane: 1, px: 0, dist: 0, score: 0, combo: 0, row: 0, rows: [], call: 'water', cool: 0, done: false, perfect: 0, good: 0, wrong: 0, miss: 0, lean: 0 };
    const flying = [];

    // A table and a tent at the start sell "aid station".
    const tent = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.4, 4), mat(0x2e6f73));
    roof.position.y = 3.1; roof.rotation.y = Math.PI / 4;
    tent.add(roof);
    for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6), mat(0xdddddd)); p.position.set(x, 1.3, z); tent.add(p); }
    const tents = [-1, 1].map(side => { const t = tent.clone(); t.position.set(side * 9, 0, -60); scene.add(t); return t; });

    function spawnRow(i) {
      const z = -60 - i * GAP;
      const side = rnd() < 0.5 ? -1 : 1;
      const list = [{ side, kind: null, target: true }];
      if (i >= 2 && rnd() < 0.7) list.push({ side: -side, kind: null, target: false });
      if (i >= 8 && rnd() < 0.35) list.push({ side, kind: null, target: false, dz: -7 });   // a decoy just before, same side
      const row = { z, vols: [] };
      for (const v of list) {
        const p = makePerson({ shirt: shirts[(rnd() * shirts.length) | 0], skin: skins[(rnd() * skins.length) | 0], hat: rnd() < 0.5 ? 0xfbf8f2 : null, armOut: v.side < 0 ? 1 : -1 });
        p.position.set(v.side * 5.2, 0, z + (v.dz || 0));
        scene.add(p);
        row.vols.push({ ...v, mesh: p, z: z + (v.dz || 0), item: null, state: 'wait' });
      }
      S.rows.push(row);
    }
    for (let i = 0; i < ROWS; i++) spawnRow(i);
    // Items are assigned just in time so the target always carries the current call.
    function arm(row) {
      for (const v of row.vols) {
        if (v.item) continue;
        v.kind = v.target ? S.call : KINDS.filter(k => k !== S.call)[(rnd() * 3) | 0];
        v.item = itemModel(v.kind);
        v.mesh.userData.hand.add(v.item);
        v.item.position.set(0, -0.12, 0.05);
      }
    }
    function newCall() {
      const prev = S.call;
      S.call = rnd() < 0.35 ? prev : KINDS.filter(k => k !== prev)[(rnd() * 3) | 0];
      hud.call(`<span>Grab</span><b>${ITEMS[S.call].emoji} ${ITEMS[S.call].label}</b>`);
    }

    const steer = dir => { const n = Math.max(0, Math.min(2, S.lane + dir)); if (n !== S.lane) { S.lane = n; S.lean = dir * 0.35; haptic(8); } };
    const side = () => (S.lane === 0 ? -1 : S.lane === 2 ? 1 : 0);
    function grab() {
      if (S.cool > 0) return;
      S.cool = 0.35;
      const sd = side();
      if (!sd) { hud.pop('Move to the side to reach', 'bad'); return; }
      let best = null;
      for (const r of S.rows) for (const v of r.vols) if (v.state === 'wait' && v.side === sd && v.z > -GOOD - 0.8 && v.z < GOOD) if (!best || Math.abs(v.z) < Math.abs(best.z)) best = v;
      if (!best) { hud.pop('Too early', 'bad'); sfx.trap(); S.combo = 0; return; }
      best.state = 'taken';
      const err = Math.abs(best.z);
      if (best.kind !== S.call) { S.score = Math.max(0, S.score - 1); S.wrong++; S.combo = 0; hud.pop(`Wrong: that's ${ITEMS[best.kind].label.toLowerCase()}`, 'bad'); sfx.trap(); haptic([30, 30, 30]); }
      else {
        const perfect = err < PERFECT;
        S.combo++;
        const pts = (perfect ? 3 : 2) + (S.combo >= 3 ? 1 : 0);
        S.score += pts;
        perfect ? S.perfect++ : S.good++;
        hud.pop(`${perfect ? 'Perfect' : 'Good'} +${pts}${S.combo >= 3 ? ` · ×${S.combo}` : ''}`, perfect ? 'hot' : '');
        sfx.pack(S.combo); haptic(perfect ? [10, 20, 30] : 12);
      }
      // The item flies into your hand; the volunteer cheers.
      const wp = best.item.getWorldPosition(new THREE.Vector3());
      scene.attach(best.item);
      best.item.position.copy(wp);
      flying.push({ m: best.item, t: 0, from: wp.clone() });
      best.mesh.userData[best.side < 0 ? 'armR' : 'armL'].rotation.z = best.side < 0 ? 2.8 : -2.8;
      hud.score(S.score);
    }

    hud.button('grab', 'GRAB', { down: grab, cls: 'big' });
    hud.score(0);
    newCall();

    return {
      start() { hud.tip('Pick a side, then GRAB as the marker fills to the green', false, 3500); },
      step(dt) {
        const move = SPEED * dt;
        S.dist += move;
        S.cool = Math.max(0, S.cool - dt);
        course.advance(move, ctx.t);
        for (const t of tents) t.position.z += move;
        S.px += (LANES[S.lane] - S.px) * Math.min(1, dt * 10);
        S.lean *= Math.pow(0.02, dt);
        me.position.x = S.px;
        me.rotation.z = -S.lean;
        pedal(me, S.dist / 7);
        let nearest = null;
        for (const r of S.rows) {
          r.z += move;
          if (r.z > -45 && r === S.rows.find(x => !x.called)) arm(r);   // only the current row carries the current call
          for (const v of r.vols) {
            v.z += move;
            v.mesh.position.z = v.z;
            if (v.state === 'wait' && v.z > GOOD + 0.5) {
              v.state = 'gone';
              if (v.target) { S.miss++; S.combo = 0; hud.pop('Missed', 'bad'); }
            }
            if (v.state === 'wait' && v.side === side() && v.z < GOOD && (!nearest || v.z > nearest.z)) nearest = v;
            if (v.z > 16) v.mesh.visible = false;
          }
          if (!r.called && r.vols.every(v => v.state !== 'wait')) { r.called = true; S.row++; if (S.row < ROWS) newCall(); }
        }
        // The reach meter fills as the nearest hand on your side comes to you; press in the green.
        const z = nearest ? nearest.z : -30;
        hud.meter('reach', { label: nearest ? `Reach · ${ITEMS[nearest.kind || S.call].emoji}` : 'Reach', value: (z + 24) / (24 + GOOD + 0.5), band: [(24 - GOOD) / (24 + GOOD + 0.5), (24 + GOOD) / (24 + GOOD + 0.5)] });
        for (let i = flying.length - 1; i >= 0; i--) {
          const f = flying[i];
          f.t += dt * 3.2;
          const to = new THREE.Vector3(S.px, 1.5, 0);
          f.m.position.lerpVectors(f.from, to, Math.min(1, f.t)).y += Math.sin(Math.min(1, f.t) * Math.PI) * 0.8;
          f.m.scale.multiplyScalar(1 - dt * 1.5);
          if (f.t >= 1) { scene.remove(f.m); flying.splice(i, 1); }
        }
        if (!S.done && S.row >= ROWS) { S.done = true; hud.call(''); setTimeout(() => ctx.end(S.score, { note: `${S.perfect} perfect · ${S.good} good · ${S.wrong} wrong · ${S.miss} missed` }), 600); }
        course.chase(S.px, 0.3, dt, { height: 3.6, back: 7.2, look: -18 });
      },
      down(ev) { steer(ev.clientX < innerWidth / 2 ? -1 : 1); },
      key(k, down) {
        if (!down) return;
        if (k === 'arrowleft' || k === 'a') steer(-1);
        else if (k === 'arrowright' || k === 'd') steer(1);
        else if (k === ' ' || k === 'arrowup' || k === 'w' || k === 'g') grab();
      },
      debug: () => ({ ...S, rows: undefined, targets: S.rows.flatMap(r => r.vols.filter(v => v.state === 'wait').map(v => ({ side: v.side, z: v.z, kind: v.kind, target: v.target }))) }),
      api: { grab, steer },
    };
  },
};
