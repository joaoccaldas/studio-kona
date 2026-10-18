// Level 4 · Hāwī Descent (Braking). Gravity pulls you faster; hold to brake. Each corner has a limit.
// Enter at or just under it to score the most; over the limit and you run wide into the gravel.
import * as THREE from 'three';
import { pedal, mat } from '../rideKit.js';

const CORNERS = [
  { limit: 55, dir: -1 }, { limit: 45, dir: 1 }, { limit: 60, dir: 1 }, { limit: 38, dir: -1 }, { limit: 50, dir: 1 },
  { limit: 42, dir: -1 }, { limit: 62, dir: -1 }, { limit: 35, dir: 1 }, { limit: 48, dir: 1 }, { limit: 40, dir: -1 },
];
const GAP = 130, KMH = 3.6, CORNER_LEN = 34;

function signTexture(limit, dir) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#f2c230'; c.save(); c.translate(128, 128); c.rotate(Math.PI / 4); c.fillRect(-88, -88, 176, 176); c.restore();
  c.strokeStyle = '#13293D'; c.lineWidth = 10; c.save(); c.translate(128, 128); c.rotate(Math.PI / 4); c.strokeRect(-80, -80, 160, 160); c.restore();
  c.fillStyle = '#13293D'; c.font = '900 64px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(dir < 0 ? '↰' : '↱', 128, 100); c.font = '900 50px system-ui'; c.fillText(String(limit), 128, 162);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function chevronTexture(dir) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 96;
  const c = cv.getContext('2d');
  c.fillStyle = '#13293D'; c.fillRect(0, 0, 128, 96);
  c.fillStyle = '#f2c230'; c.beginPath();
  if (dir < 0) { c.moveTo(90, 10); c.lineTo(40, 48); c.lineTo(90, 86); c.lineTo(70, 86); c.lineTo(20, 48); c.lineTo(70, 10); }
  else { c.moveTo(38, 10); c.lineTo(88, 48); c.lineTo(38, 86); c.lineTo(58, 86); c.lineTo(108, 48); c.lineTo(58, 10); }
  c.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default {
  scene: '3d',
  create(ctx) {
    const { scene, hud, me, sfx, haptic, course } = ctx;
    const S = { v: 14, brake: false, dist: 0, score: 0, ci: 0, in: null, bend: 0, wide: 0, clean: 0, t: 0, done: false, results: [] };
    const corners = CORNERS.map((c, i) => {
      const z = -70 - i * GAP;
      const g = new THREE.Group();
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: signTexture(c.limit, c.dir), transparent: true }));
      sign.position.set(5.4, 2.4, 0);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8), mat(0x9aa0a6)); post.position.set(5.4, 0.9, 0.02);
      g.add(sign, post);
      // Chevron boards along the outside of the bend, and a brake marker 40 m before.
      const chev = chevronTexture(c.dir);
      for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshBasicMaterial({ map: chev })); b.position.set(-c.dir * 5.6, 1.1, -45 - k * 8); g.add(b); }
      for (const d of [40, 25, 10]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.12), new THREE.MeshBasicMaterial({ color: 0xfbf8f2 })); m.rotation.x = -Math.PI / 2; m.position.set(-4.5, 0.03, -45 + d); m.scale.x = d / 10; g.add(m); }
      g.position.z = z;
      scene.add(g);
      return { ...c, z, g, entry: -45 };                          // the corner starts 45 m past the sign
    });

    const kmh = () => S.v * KMH;
    return {
      start() { hud.tip('Hold to brake. Hit each corner at its limit, not over', false, 3500); },
      step(dt) {
        S.t += dt;
        // Downhill: gravity adds speed, air drag caps it around 85 km/h; brakes bite hard.
        S.v += (2.9 - 0.0052 * S.v * S.v - (S.brake ? 9 : 0) - (S.wide > 0 ? 6 : 0)) * dt;
        S.v = Math.max(5, S.v);
        S.wide = Math.max(0, S.wide - dt);
        const move = S.v * dt;
        S.dist += move;
        course.advance(move, S.t);
        let bendTo = 0;
        for (const c of corners) {
          c.z += move;
          c.g.position.z = c.z;
          const start = c.z + c.entry;                            // world z of the corner entry
          if (!c.judged && start >= 0) {
            c.judged = true; S.ci++;
            const over = kmh() / c.limit;
            let pts;
            if (over > 1.05) { pts = 0; S.wide = 1.2; hud.banner('Too hot!', `${Math.round(kmh())} into a ${c.limit}`); sfx.trap(); haptic([60, 30, 60]); hud.shake(); }
            else { pts = Math.round(100 * Math.min(1, over) ** 2); S.clean++; hud.pop(`${pts >= 90 ? 'On the limit!' : pts >= 70 ? 'Smooth' : 'Too cautious'} +${pts}`, pts >= 90 ? 'hot' : pts >= 70 ? '' : 'bad'); sfx.pack(Math.max(1, Math.round(pts / 20))); haptic(12); }
            S.score += pts;
            S.results.push({ limit: c.limit, kmh: Math.round(kmh()), pts });
            hud.score(S.score);
          }
          if (start >= 0 && start < CORNER_LEN) bendTo = c.dir;
          if (c.z > 80) c.g.visible = false;
        }
        // The bend: camera and rider lean into it, the verge swings; running wide drifts you to the outside.
        S.bend += (bendTo - S.bend) * Math.min(1, dt * 3);
        me.position.x = S.wide > 0 ? -S.bend * 2.8 * Math.min(1, S.wide) : S.bend * 1.2;
        me.rotation.z = -S.bend * 0.45 * Math.min(1, S.v / 18);
        me.userData.body.position.y += ((S.brake ? 1.08 : 0.9) - me.userData.body.position.y) * Math.min(1, dt * 8);
        pedal(me, S.brake ? S.dist / 20 : S.dist / 7);
        // Upcoming corner: speed vs limit.
        const next = corners.find(c => !c.judged);
        if (next) {
          const toGo = -(next.z + next.entry);
          hud.meter('speed', { label: `${Math.round(kmh())} km/h · next ${next.dir < 0 ? '↰' : '↱'} ${next.limit} in ${Math.max(0, Math.round(toGo))} m`, value: Math.min(1, kmh() / 90), band: [next.limit * 0.85 / 90, next.limit / 90], danger: kmh() > next.limit * 1.05 && toGo < 60 });
        }
        hud.meter('corner', { label: `Corner ${Math.min(S.ci + 1, corners.length)} of ${corners.length}`, value: S.ci / corners.length });
        if (!S.done && S.ci >= corners.length) { S.done = true; setTimeout(() => ctx.end(S.score, { note: `${S.clean} clean corners of ${corners.length}` }), 900); }
        course.chase(me.position.x * 0.5, Math.min(1, S.v / 22), dt, { height: 3.8, back: 7, look: -22 });
        course.camera.rotation.z += -S.bend * 0.12;
        course.camera.position.x += S.bend * 1.5;
      },
      down() { S.brake = true; },
      up() { S.brake = false; },
      key(k, down) { if (k === ' ' || k === 'arrowdown' || k === 's' || k === 'b') S.brake = down; },
      debug: () => { const n = corners.find(c => !c.judged); return { ...S, results: undefined, kmh: kmh(), next: n && { limit: n.limit, toGo: -(n.z + n.entry) } }; },
      api: { brake: on => { S.brake = on; } },
    };
  },
};
