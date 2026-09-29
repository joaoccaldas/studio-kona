// Level 3 · Crosswind Gates (Balance). Free steering on the climb to Hāwī while gusts shove you sideways.
// Drag to steer (the further you drag, the harder you lean); ride between the coral flags.
import * as THREE from 'three';
import { pedal, mat } from '../rideKit.js';

const GATES = 24, GAP_M = 26, SPEED = 12, EDGE = 4.4;

export default {
  scene: '3d',
  create(ctx) {
    const { scene, hud, me, sfx, haptic, course } = ctx;
    const S = { x: 0, vx: 0, steer: 0, keys: 0, wind: 0, windTo: 0.6, gustAt: 4, gustDir: 1, warn: 0, dist: 0, passed: 0, missed: 0, combo: 0, gi: 0, done: false, t: 0 };
    let drag = null;

    // Gates: two poles with pennants, width shrinking as you climb.
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), flagGeo = new THREE.PlaneGeometry(0.7, 0.4);
    const gates = [];
    let gx = 0;
    for (let i = 0; i < GATES; i++) {
      const w = 3.1 - (i / GATES) * 0.9;
      gx = Math.max(-EDGE + w / 2 + 0.3, Math.min(EDGE - w / 2 - 0.3, gx + (Math.random() - 0.5) * 5));
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const pole = new THREE.Mesh(poleGeo, mat(0xfbf8f2)); pole.position.set(s * w / 2, 1.3, 0); pole.castShadow = true;
        const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: 0xd9785b, side: THREE.DoubleSide, roughness: 0.7 }));
        flag.position.set(s * w / 2 + 0.35, 2.35, 0);
        g.add(pole, flag);
        g.userData.flags = (g.userData.flags || []).concat(flag);
      }
      const line = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.35), new THREE.MeshBasicMaterial({ color: 0xfbf8f2, transparent: true, opacity: 0.55 }));
      line.rotation.x = -Math.PI / 2; line.position.y = 0.03;
      g.add(line);
      g.position.set(gx, 0, -40 - i * GAP_M);
      scene.add(g);
      gates.push({ g, x: gx, w, z: -40 - i * GAP_M, done: false, line });
    }

    // Wind streaks drifting across the road show the wind's strength and direction.
    const N = 70, pos = new Float32Array(N * 6);
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    scene.add(streaks);
    const sp = Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 30, y: 0.4 + Math.random() * 3, z: -Math.random() * 60 + 5 }));

    return {
      start() { hud.tip('Drag left or right to steer. Lean into the wind!', false, 3500); },
      step(dt) {
        S.t += dt;
        // Wind: a steady breeze that turns into gusts from either side, telegraphed 0.8 s ahead.
        if (S.t >= S.gustAt - 0.8 && !S.warn) { S.warn = 1; S.gustDir = Math.random() < 0.5 ? -1 : 1; hud.banner(S.gustDir < 0 ? '⟵ GUST' : 'GUST ⟶'); haptic(20); }
        if (S.t >= S.gustAt) { S.windTo = S.gustDir * (1.6 + Math.random() * 0.9 + S.gi * 0.03); S.gustAt = S.t + 2.4 + Math.random() * 2; S.warn = 0; setTimeout(() => { S.windTo = S.gustDir * 0.5; }, 900 + Math.random() * 600); }
        S.wind += (S.windTo - S.wind) * Math.min(1, dt * 3);
        const steer = drag ? drag.s : S.keys;
        S.vx += (steer * 10 + S.wind * 3.2 - S.vx * 2.4) * dt;
        S.x += S.vx * dt;
        const off = Math.abs(S.x) > EDGE;
        if (off) { S.x = Math.sign(S.x) * Math.min(Math.abs(S.x), EDGE + 0.6); if (Math.random() < dt * 6) { hud.shake(); haptic(10); } }
        const speed = SPEED * (off ? 0.7 : 1);
        const move = speed * dt;
        S.dist += move;
        course.advance(move, S.t);
        me.position.x = S.x;
        me.rotation.z = -S.vx * 0.06 - S.wind * 0.05;
        pedal(me, S.dist / 7);
        for (const G of gates) {
          G.z += move;
          G.g.position.z = G.z;
          for (const f of G.g.userData.flags) f.rotation.y = Math.sin(S.t * 8 + G.z) * 0.3 + S.wind * 0.35;
          if (!G.done && G.z >= 0) {
            G.done = true; S.gi++;
            const d = Math.abs(S.x - G.x);
            if (d < G.w / 2 - 0.15) { S.passed++; S.combo++; sfx.pack(S.combo); haptic(12); hud.pop(S.combo > 2 ? `Gate ×${S.combo}` : 'Gate', S.combo > 4 ? 'hot' : ''); G.line.material.color.set(0x3fae7a); }
            else { S.missed++; S.combo = 0; sfx.trap(); hud.pop(d < G.w / 2 + 0.35 ? 'Clipped the flag' : 'Missed', 'bad'); if (d < G.w / 2 + 0.35) { S.vx *= -0.4; hud.shake(); haptic(40); } G.line.material.color.set(0xd9785b); }
            hud.score(S.passed);
          }
          if (G.z > 14) G.g.visible = false;
        }
        for (let i = 0; i < N; i++) {
          const p = sp[i];
          p.x += S.wind * 9 * dt; p.z += move;
          if (p.x > 16) p.x -= 32; if (p.x < -16) p.x += 32;
          if (p.z > 8) p.z -= 60;
          const len = Math.min(3, Math.abs(S.wind) * 1.4 + 0.2) * Math.sign(S.wind || 1);
          pos.set([p.x, p.y, p.z, p.x + len, p.y, p.z], i * 6);
        }
        streakGeo.attributes.position.needsUpdate = true;
        streaks.material.opacity = Math.min(0.8, 0.15 + Math.abs(S.wind) * 0.3);
        hud.meter('wind', { label: `Wind ${S.wind < -0.1 ? '⟵' : S.wind > 0.1 ? '⟶' : '·'} ${Math.round(Math.abs(S.wind) * 18)} km/h`, value: 0.5 + S.wind / 5, band: [0.46, 0.54], danger: Math.abs(S.wind) > 1.5 });
        hud.meter('gates', { label: `Gate ${Math.min(S.gi + 1, GATES)} of ${GATES}`, value: S.gi / GATES });
        if (!S.done && S.gi >= GATES) { S.done = true; setTimeout(() => ctx.end(S.passed, { note: `${S.passed} of ${GATES} gates` }), 500); }
        course.chase(S.x * 0.6, 0.35, dt, { height: 4.6, back: 8, look: -20 });
      },
      down(ev) { drag = { x0: ev.clientX, s: 0 }; },
      move(ev) { if (drag) drag.s = Math.max(-1, Math.min(1, (ev.clientX - drag.x0) / 70)); },
      up() { drag = null; },
      key(k, down) {
        if (k === 'arrowleft' || k === 'a') S.keys = down ? -1 : S.keys === -1 ? 0 : S.keys;
        if (k === 'arrowright' || k === 'd') S.keys = down ? 1 : S.keys === 1 ? 0 : S.keys;
      },
      debug: () => ({ ...S, gates: gates.filter(g => !g.done).slice(0, 2).map(g => ({ x: g.x, z: g.z, w: g.w })) }),
      api: { steer: s => { S.keys = s; } },
    };
  },
};
