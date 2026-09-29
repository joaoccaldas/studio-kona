// Level 8 · Aliʻi High-Fives (Rhythm). The crowd holds out hands on the beat. Tap the left or right side as a hand
// reaches you (both sides together when both are out). Perfect timing and a long chain make the crowd roar.
import * as THREE from 'three';
import { makePerson, pedal, makeArch } from '../rideKit.js';

const BPM = 100, BEAT = 60 / BPM, SPEED = 9, LEAD = 4;
const PERFECT = 0.075, GOOD = 0.16;

// The chart: 8-beat phrases that get busier toward the finish.
function chart() {
  const phrases = [
    ['L', '', 'R', '', 'L', '', 'R', ''],
    ['L', '', 'R', '', 'L', 'L', 'R', ''],
    ['B', '', 'L', 'R', 'L', '', 'B', ''],
    ['L', 'R', 'L', 'R', 'B', '', 'B', ''],
    ['L', 'l', 'R', 'r', 'L', 'R', 'B', ''],
    ['R', 'r', 'L', 'l', 'B', 'L', 'R', 'B'],
  ];
  const notes = [];
  let beat = LEAD;
  for (const ph of phrases) {
    ph.forEach((n, i) => {
      if (!n) return;
      const at = (beat + i + (n === 'l' || n === 'r' ? 0.5 : 0)) * BEAT;
      const sides = n === 'B' ? [-1, 1] : n.toUpperCase() === 'L' ? [-1] : [1];
      for (const s of sides) notes.push({ side: s, at, both: n === 'B', judged: false });
    });
    beat += 8;
  }
  return { notes, end: (beat + 2) * BEAT };
}

export default {
  scene: '3d',
  create(ctx) {
    const { scene, hud, me, sfx, haptic, course, root } = ctx;
    const { notes, end } = chart();
    const S = { t: -0.3, score: 0, combo: 0, best: 0, perfect: 0, good: 0, miss: 0, beat: -1, done: false, dist: 0, roar: 0 };
    const shirts = [0xd9785b, 0x2e6f73, 0xe8c35a, 0x3e8ea0, 0xfbf8f2, 0x6b4ea0, 0xc0392b];
    const skins = [0xf1d3bf, 0xd9a882, 0xb07a52, 0x7a4a2c, 0x4a2a17];
    const r = a => a[(Math.random() * a.length) | 0];
    // One fan per note, arm out toward the road, placed so their hand reaches you exactly on the beat.
    for (const n of notes) {
      const p = makePerson({ shirt: r(shirts), skin: r(skins), hat: Math.random() < 0.4 ? r([0xfbf8f2, 0xe8c35a, 0x13293d]) : null, armOut: n.side < 0 ? 1 : -1 });
      p.position.set(n.side * 3.2, 0, -999);
      p.scale.setScalar(1.05);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.85 }));
      p.userData.hand.add(glow);
      n.p = p; n.glow = glow;
      scene.add(p);
    }
    const arch = makeArch('FINISH · KONA');
    arch.position.z = -SPEED * end;
    scene.add(arch);
    // Barriers and a carpet: the finish chute.
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 400), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.9 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.02, -180);
    scene.add(carpet);

    // Approach rings: two targets at the bottom corners; a ring closes in on each for the next hand on that side.
    const targets = document.createElement('div');
    targets.className = 'hf-targets';
    targets.innerHTML = '<div class="hf-t l"><i></i><b>L</b></div><div class="hf-t r"><i></i><b>R</b></div>';
    root.appendChild(targets);
    const ringEl = { [-1]: targets.querySelector('.l i'), 1: targets.querySelector('.r i') };
    const padEl = { [-1]: targets.querySelector('.l'), 1: targets.querySelector('.r') };

    // A tiny drum machine on the shared audio context.
    function drum(kind) {
      const ac = sfx.unlock();
      if (!ac) return;
      const t0 = ac.currentTime, g = ac.createGain();
      g.connect(ac.destination);
      if (kind === 'kick') {
        const o = ac.createOscillator(); o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.14);
        g.gain.setValueAtTime(0.25, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2); o.connect(g); o.start(t0); o.stop(t0 + 0.22);
      } else {
        const b = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
        g.gain.value = 0.06; s.connect(f).connect(g); s.start(t0);
      }
    }

    function hit(side) {
      padEl[side].classList.remove('hit'); void padEl[side].offsetWidth; padEl[side].classList.add('hit');
      let best = null;
      for (const n of notes) if (!n.judged && n.side === side && Math.abs(n.at - S.t) < GOOD) if (!best || Math.abs(n.at - S.t) < Math.abs(best.at - S.t)) best = n;
      if (!best) { S.combo = 0; hud.pop('Early!', 'bad'); return; }
      best.judged = true;
      const err = Math.abs(best.at - S.t), perfect = err < PERFECT;
      S.combo++; S.best = Math.max(S.best, S.combo);
      const pts = (perfect ? 3 : 1) + (S.combo >= 10 ? 1 : 0);
      S.score += pts; perfect ? S.perfect++ : S.good++;
      S.roar = Math.min(1, S.roar + 0.08);
      best.glow.visible = false;
      best.p.userData[side < 0 ? 'armR' : 'armL'].rotation.z = side < 0 ? 2.6 : -2.6;
      hud.pop(`${perfect ? 'Perfect' : 'Good'}${S.combo >= 5 ? ` ×${S.combo}` : ''}`, perfect ? 'hot' : '', side < 0 ? innerWidth * 0.25 : innerWidth * 0.75, innerHeight * 0.55);
      sfx.pack(Math.min(8, 1 + (S.combo % 8)));
      haptic(perfect ? 16 : 8);
      hud.score(S.score);
    }
    const pending = new Map();                                     // pointerId → side, for two-thumb taps

    return {
      start() { hud.tip('Tap the side as each hand reaches you. Both out? Tap both!', false, 3000); },
      step(dt) {
        S.t += dt;
        const move = SPEED * dt;
        S.dist += move;
        course.advance(move, S.t);
        arch.position.z += move;
        pedal(me, S.dist / 7);
        me.position.x = 0;
        const b = Math.floor(S.t / BEAT);
        if (b > S.beat) { S.beat = b; drum(b % 2 ? 'hat' : 'kick'); if (b % 4 === 0) root.classList.toggle('beat'); }
        for (const side of [-1, 1]) {
          const nx = notes.find(n => !n.judged && n.side === side && n.at - S.t > -GOOD);
          const lead = nx ? nx.at - S.t : 9;
          const el = ringEl[side];
          el.style.opacity = lead < 1.3 ? String(Math.min(1, (1.3 - lead) * 2)) : '0';
          el.style.transform = `scale(${1 + Math.max(0, lead) * 1.6})`;
          el.classList.toggle('both', !!nx?.both);
        }
        for (const n of notes) {
          n.p.position.z = -(n.at - S.t) * SPEED;
          if (!n.judged && S.t - n.at > GOOD) { n.judged = true; S.miss++; S.combo = 0; S.roar = Math.max(0, S.roar - 0.2); hud.pop('Miss', 'bad', n.side < 0 ? innerWidth * 0.25 : innerWidth * 0.75, innerHeight * 0.55); }
          n.p.visible = n.p.position.z > -170 && n.p.position.z < 14;
          if (n.glow.visible) n.glow.scale.setScalar(1 + Math.max(0, 1 - Math.abs(n.at - S.t) * 3) * 0.8);
        }
        S.roar = Math.max(0, S.roar - dt * 0.05);
        hud.meter('roar', { label: `Crowd roar${S.combo >= 10 ? ` · ×${S.combo} chain` : ''}`, value: S.roar, color: '#D9785B' });
        if (!S.done && S.t >= end) { S.done = true; targets.remove(); ctx.end(S.score, { note: `${S.perfect} perfect · ${S.good} good · ${S.miss} missed · best chain ${S.best}` }); }
        course.chase(0, 0.3, dt, { height: 3.4, back: 6.5, look: -16 });
      },
      down(ev) { const side = ev.clientX < innerWidth / 2 ? -1 : 1; pending.set(ev.pointerId, side); hit(side); },
      up(ev) { pending.delete(ev.pointerId); },
      key(k, down) { if (!down) return; if (k === 'arrowleft' || k === 'a' || k === 'f') hit(-1); else if (k === 'arrowright' || k === 'd' || k === 'j') hit(1); },
      dispose() { targets.remove(); },
      debug: () => ({ ...S, next: notes.filter(n => !n.judged).slice(0, 3).map(n => ({ side: n.side, at: n.at })), total: notes.length }),
      api: { hit },
    };
  },
};
