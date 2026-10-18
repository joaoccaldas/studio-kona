// Level 2 · Legal Gap (Pace control). A rider ahead surges and eases; hold to push, let go to ease off,
// and keep 12–20 m back. Closer than 10 m is drafting: stay there and you collect cards (three and you are out).
import * as THREE from 'three';
import { makeRider, pedal } from '../rideKit.js';

const DURATION = 50, LO = 12, HI = 20, DRAFT = 10, CARD_T = 1.5;

export default {
  scene: '3d',
  create(ctx) {
    const { scene, hud, me, sfx, haptic, course } = ctx;
    const pacer = makeRider(0xe8c35a, 0x13293d, true);
    pacer.scale.setScalar(1.15);
    scene.add(pacer);
    // Painted guides behind the pacer: red draft zone, then the green legal band.
    const zone = (len, from, color, op) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, len), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.03, from + len / 2);
      pacer.add(m);
      return m;
    };
    const red = zone(DRAFT / 1.15 - 0.9, 0.9, 0xd9785b, 0.28);
    const green = zone((HI - LO) / 1.15, LO / 1.15, 0x3fae7a, 0.3);   // the pacer group is scaled 1.15
    // Other riders flow past in the outside lane for company.
    const others = Array.from({ length: 3 }, (_, i) => { const r = makeRider([0x13293d, 0xd9785b, 0x6b4ea0][i], 0xfbf8f2); r.position.set(3, 0, -40 - i * 50); scene.add(r); return r; });

    const S = { v: 12, vp: 12, target: 12, d: 16, t: 0, inBand: 0, draftT: 0, grace: 0, cards: 0, hold: false, nextChange: 3, tele: 0, teleTo: 12, dist: 0, pd: 0, done: false, pct: 0 };
    const plan = [15, 10, 13, 17, 11, 16, 9, 14, 17, 12, 10, 15];
    let pi = 0;

    function pctNow() { return S.t > 0 ? (S.inBand / S.t) * 100 : 0; }
    return {
      start() { hud.tip('Hold anywhere to push harder, let go to ease off. Stay in the green', false, 3500); },
      step(dt) {
        S.t += dt;
        // The pacer's plan: a telegraph (standing on the pedals or sitting up) 1 s before each change.
        if (!S.tele && S.t >= S.nextChange - 1) { S.teleTo = plan[pi++ % plan.length]; S.tele = 1; hud.banner(S.teleTo > S.target ? 'Surge!' : 'Easing off', S.teleTo > S.target ? 'They are standing on the pedals' : 'They sat up'); }
        if (S.tele && S.t >= S.nextChange) { S.target = S.teleTo; S.tele = 0; S.nextChange = S.t + 3 + Math.random() * 2.5; }
        S.vp += Math.sign(S.target - S.vp) * Math.min(Math.abs(S.target - S.vp), 1.6 * dt);
        S.v += (S.hold ? 2.8 : -2.6) * dt;
        S.v = Math.max(7, Math.min(19, S.v));
        S.d = Math.max(0.5, Math.min(60, S.d + (S.vp - S.v) * dt));
        S.grace = Math.max(0, S.grace - dt);
        const inBand = S.d >= LO && S.d <= HI;
        if (inBand) S.inBand += dt;
        if (S.d < DRAFT && S.grace <= 0) {
          S.draftT += dt;
          if (S.draftT >= CARD_T) {
            S.cards++; S.draftT = 0; S.grace = 2;
            hud.banner(`Drafting card ${S.cards}/3`, S.cards >= 3 ? 'Disqualified' : 'Drop back behind the red');
            sfx.trap(); haptic([40, 40, 40]); hud.shake();
            if (S.cards >= 3 && !S.done) { S.done = true; ctx.end(0, { failed: true, title: 'Disqualified', note: 'Three drafting cards' }); }
          }
        } else S.draftT = Math.max(0, S.draftT - dt * 2);
        red.material.opacity = S.d < DRAFT ? 0.55 + 0.2 * Math.sin(S.t * 14) : 0.28;
        green.material.opacity = inBand ? 0.5 : 0.25;
        if (S.d > 30 && Math.random() < dt) hud.tip('Dropped! Hold to close the gap', true, 1500);

        // World motion at your speed; the pacer sits d metres ahead.
        const move = S.v * dt;
        S.dist += move; S.pd += S.vp * dt;
        course.advance(move, S.t);
        pacer.position.set(0, 0, -S.d);
        const standing = S.tele && S.teleTo > S.target;
        pacer.userData.body.position.y += ((standing ? 1.2 : S.tele ? 1.1 : 1.02) - pacer.userData.body.position.y) * Math.min(1, dt * 8);
        pacer.rotation.z = standing ? Math.sin(S.t * 10) * 0.08 : 0;
        pedal(pacer, S.pd / 7);
        pedal(me, S.dist / 7);
        me.position.x = 0;
        me.userData.body.position.y += ((S.hold ? 0.95 : 1.02) - me.userData.body.position.y) * Math.min(1, dt * 8);
        for (const o of others) { o.position.z += (S.v - 17) * dt; if (o.position.z < -150) o.position.z = 12; if (o.position.z > 12) o.position.z = -150; pedal(o, S.t * 2.4); }

        S.pct = pctNow();
        hud.score(Math.round(S.pct) + '%');
        hud.meter('gap', { label: `Gap ${S.d.toFixed(0)} m`, value: Math.min(1, S.d / 32), band: [LO / 32, HI / 32], danger: S.d < DRAFT });
        hud.meter('time', { label: `${Math.max(0, DURATION - S.t).toFixed(0)} s left`, value: 1 - S.t / DURATION });
        hud.meter('cards', { label: `Cards ${S.cards}/3`, value: S.draftT / CARD_T, danger: S.draftT > 0 });
        if (!S.done && S.t >= DURATION) { S.done = true; ctx.end(S.pct, { note: `${Math.round(S.inBand)} s of ${DURATION} in the legal band · ${S.cards} card${S.cards === 1 ? '' : 's'}` }); }
        course.chase(0, S.v / 30, dt, { height: 5.2, back: 8.5, look: -22 });
      },
      down() { S.hold = true; },
      up() { S.hold = false; },
      key(k, down) { if (k === ' ' || k === 'arrowup' || k === 'w') S.hold = down; },
      debug: () => ({ ...S }),
      api: { hold: on => { S.hold = on; } },
    };
  },
};
