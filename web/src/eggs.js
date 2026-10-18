// Hidden surprises about Kona and its culture. No pins: you find them by exploring (a small twinkle shows when
// you are close). Each one opens an Almanac card, sometimes a Locker item, and pays a little the first time.
import * as THREE from 'three';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const lam = c => new THREE.MeshLambertMaterial({ color: c });
function box(p, m, sx, sy, sz, x, y, z) { const b = new THREE.Mesh(BOX, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.castShadow = true; p.add(b); return b; }

// 5x5 block font for coral graffiti.
const FONT = { A: ['01110', '10001', '11111', '10001', '10001'], L: ['10000', '10000', '10000', '10000', '11111'], O: ['01110', '10001', '10001', '10001', '01110'], H: ['10001', '10001', '11111', '10001', '10001'] };

export const EGGS = [
  { id: 'underpants', name: 'The Underpants flag', hint: 'Something red flutters high over Kailua Pier.', at: c => ({ x: -18, y: 60, z: 2.15 }),
    build: () => { const g = new THREE.Group(); box(g, lam(0xdddddd), 0.08, 5, 0.08, 0, 2.5, 0); const f = new THREE.Group(); f.position.set(0.45, 4.6, 0); g.add(f); box(f, lam(0xe63946), 0.8, 0.35, 0.05, 0, 0.15, 0); box(f, lam(0xe63946), 0.3, 0.3, 0.05, -0.25, -0.15, 0); box(f, lam(0xe63946), 0.3, 0.3, 0.05, 0.25, -0.15, 0); box(f, lam(0xfbf8f2), 0.82, 0.08, 0.06, 0, 0.3, 0); g.userData.tick = t => { f.rotation.y = Math.sin(t * 3) * 0.4; }; return g; } },
  { id: 'mug', name: 'A mug from the coffee boat', hint: 'Swim out to the coffee boat on the swim course. Something is floating nearby.', r: 6, at: c => ({ x: c.coffee[0] + 8, y: c.coffee[1] + 4, z: 0.1 }),
    build: () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.6, 16), lam(0xfbf8f2)); m.position.y = 0.3; g.add(m); const h = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 12), lam(0xfbf8f2)); h.position.set(0.38, 0.3, 0); g.add(h); const cof = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), lam(0x5a3a20)); cof.rotation.x = -Math.PI / 2; cof.position.y = 0.55; g.add(cof); g.userData.tick = t => { g.position.y = Math.sin(t * 1.8) * 0.1; g.rotation.y = t * 0.3; }; return g; } },
  { id: 'gecko', name: 'The church gecko', hint: 'A little green friend suns itself on a lava-rock wall by the oldest church in Hawaiʻi.', at: c => c.near('mokuaikaua', -14, 6, 0),
    build: () => { const g = new THREE.Group(); box(g, new THREE.MeshLambertMaterial({ color: 0x4a4540 }), 2.4, 1, 0.6, 0, 0.5, 0); const k = new THREE.Group(); k.position.set(0, 1.03, 0); g.add(k); box(k, lam(0x5bbf3a), 0.18, 0.06, 0.5, 0, 0, 0); box(k, lam(0x5bbf3a), 0.14, 0.06, 0.18, 0, 0, 0.32); box(k, lam(0x5bbf3a), 0.06, 0.04, 0.4, 0, 0, -0.42).rotation.y = 0.4; for (const [x, z] of [[-0.14, 0.15], [0.14, 0.15], [-0.14, -0.15], [0.14, -0.15]]) box(k, lam(0x5bbf3a), 0.12, 0.04, 0.05, x, 0, z); g.userData.tick = t => { k.position.x = Math.sin(t * 0.7) * 0.8; k.rotation.y = Math.cos(t * 0.7) > 0 ? Math.PI / 2 : -Math.PI / 2; }; return g; } },
  { id: 'menehune', name: 'A menehune', hint: 'Legend says the little people work at night. One is resting in the roots of the banyan by the finish.', at: c => c.near('finish', 20, 20, 0, true),
    build: () => { const g = new THREE.Group(); g.scale.setScalar(0.45); box(g, lam(0x6b4a2a), 0.5, 0.6, 0.35, 0, 0.3, 0); box(g, lam(0xb07a52), 0.5, 0.5, 0.5, 0, 0.85, 0); box(g, lam(0x2f5d2a), 0.6, 0.12, 0.6, 0, 1.15, 0); box(g, lam(0x8a6a48), 0.08, 1.2, 0.08, 0.4, 0.6, 0); return g; } },
  { id: 'coral', name: 'ALOHA in coral', hint: 'Out on the Queen K lava, someone spelled a word in white coral. Ride and look makai.', r: 14, at: c => c.highway(0.35, 26),
    build: () => { const g = new THREE.Group(); const m = lam(0xf4f2ec); 'ALOHA'.split('').forEach((ch, i) => FONT[ch].forEach((row, r) => [...row].forEach((v, k) => { if (v === '1') { const b = box(g, m, 0.55, 0.22, 0.55, (i * 6 + k) * 0.6 - 8.5, 0.1, r * 0.6 - 1.5); b.rotation.y = (i + r + k) * 0.3; } }))); return g; } },
  { id: 'rocks', name: 'Pele’s rocks, returned', hint: 'At the airport, a box of lava rocks waits to go home. Someone was worried about Pele.', at: c => c.near('koa', 30, -20, 0),
    build: () => { const g = new THREE.Group(); box(g, lam(0xb99468), 1, 0.5, 0.7, 0, 0.25, 0); for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), lam(0x2a2624)); r.position.set(-0.3 + i * 0.15, 0.55, (i % 2) * 0.15 - 0.07); g.add(r); } const note = box(g, lam(0xfbf8f2), 0.4, 0.02, 0.3, 0.2, 0.52, 0.1); note.rotation.y = 0.3; return g; } },
  { id: 'petroglyph', name: 'A petroglyph', hint: 'Near Waikoloa, the old coastal trail crosses lava with carvings in it.', at: c => c.ll(19.9252, -155.8820, 25, 10),
    build: () => { const g = new THREE.Group(); const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#3a3430'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#8a7e70'; x.lineWidth = 5; x.beginPath(); x.arc(64, 30, 10, 0, 7); x.moveTo(64, 40); x.lineTo(64, 80); x.moveTo(40, 55); x.lineTo(88, 55); x.moveTo(64, 80); x.lineTo(46, 108); x.moveTo(64, 80); x.lineTo(82, 108); x.stroke(); x.beginPath(); x.arc(100, 100, 12, 0, 7); x.stroke(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 2.4), [lam(0x3a3430), lam(0x3a3430), new THREE.MeshLambertMaterial({ map: t }), lam(0x3a3430), lam(0x3a3430), lam(0x3a3430)]); m.position.y = 0.15; g.add(m); return g; } },
  { id: 'snowman', name: 'A Mauna Kea snowman', hint: 'Yes, it snows in Hawaiʻi. Somebody built something up by the telescopes.', at: c => c.near('maunakea', 40, 30, 0),
    build: () => { const g = new THREE.Group(); const w = lam(0xffffff); [[0.8, 0.8], [0.6, 1.9], [0.42, 2.7]].forEach(([r, y]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), w); s.position.y = y; g.add(s); }); box(g, lam(0xd9785b), 0.08, 0.08, 0.4, 0, 2.7, 0.5); box(g, lam(0x13293d), 0.5, 0.35, 0.5, 0, 3.2, 0); box(g, lam(0xd9785b), 0.9, 0.14, 0.6, 0, 2.3, 0); return g; } },
  { id: 'nene', name: 'Nēnē geese', hint: 'The state bird likes the grassy slopes. Try the coffee farm above Kailua.', at: c => c.near('holualoa', -30, 18, 0),
    build: () => { const g = new THREE.Group(); for (const dx of [0, 1.3]) { const b = new THREE.Group(); b.position.x = dx; b.rotation.y = dx; g.add(b); box(b, lam(0x8a7a66), 0.5, 0.4, 0.8, 0, 0.55, 0); box(b, lam(0x1a1a1a), 0.14, 0.6, 0.14, 0, 0.95, 0.35); box(b, lam(0x1a1a1a), 0.2, 0.18, 0.3, 0, 1.25, 0.45); box(b, lam(0x1a1a1a), 0.08, 0.35, 0.08, -0.1, 0.18, 0); box(b, lam(0x1a1a1a), 0.08, 0.35, 0.08, 0.1, 0.18, 0); } return g; } },
  { id: 'shaveice', name: 'Rainbow shave ice', hint: 'Hot day? There is a shave ice stand by the Kona Inn lawn.', at: c => c.near('konainn', 12, -8, 0),
    build: () => { const g = new THREE.Group(); box(g, lam(0xfbf8f2), 1.6, 1, 1, 0, 0.5, 0); box(g, lam(0xd9785b), 1.8, 0.1, 1.2, 0, 2.2, 0); for (const x of [-0.75, 0.75]) box(g, lam(0xfbf8f2), 0.06, 1.2, 0.06, x, 1.6, 0.5); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 10), lam(0xfbf8f2)); cone.rotation.x = Math.PI; cone.position.set(0, 1.15, 0.2); g.add(cone); ['#e63946', '#e8c35a', '#3e8ea0'].forEach((c, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2 / 3 * 1.02, 0, Math.PI / 2), lam(c)); s.rotation.y = i * Math.PI * 2 / 3; s.position.set(0, 1.3, 0.2); g.add(s); }); return g; } },
  { id: 'surfboard', name: 'A surfboard at Banyans', hint: 'South along Aliʻi Drive, surfers leave boards at the famous break called Banyans.', at: c => ({ x: 690, y: -690 }),
    build: () => { const g = new THREE.Group(); const b = box(g, lam(0xe8c35a), 0.55, 2.3, 0.1, 0, 1.1, 0); b.rotation.z = 0.12; box(g, lam(0xd9785b), 0.08, 2.3, 0.11, 0.1, 1.1, 0).rotation.z = 0.12; return g; } },
  { id: 'dolphin', name: 'A spinner dolphin', hint: 'In Kealakekua Bay, below the monument, dolphins rest in the mornings. Swim out, gently.', r: 9, at: c => c.near('cook', -40, 10, 0.1),
    build: () => { const g = new THREE.Group(); const d = new THREE.Group(); g.add(d); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.4, 6, 12), lam(0x7b8a96)); body.rotation.x = Math.PI / 2; d.add(body); box(d, lam(0x6b7a86), 0.08, 0.45, 0.3, 0, 0.4, 0); g.userData.tick = t => { const a = t * 0.8; d.position.set(Math.cos(a) * 4, Math.max(-0.3, Math.sin(t * 2.4) * 1.2), Math.sin(a) * 4); d.rotation.y = -a; d.rotation.x = Math.cos(t * 2.4) * 0.6; }; return g; } },
  { id: 'pelehair', name: 'Pele’s hair', hint: 'On the rim of Halemaʻumaʻu, the wind leaves golden threads of volcanic glass.', at: c => c.near('kilauea', 30, 205, 0),
    build: () => { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0xd9b25a, metalness: 0.6, roughness: 0.3, emissive: 0x3a2a08 }); for (let i = 0; i < 24; i++) { const s = box(g, m, 0.02, 0.02, 0.8 + (i % 5) * 0.2, (i % 6) * 0.15 - 0.4, 0.05 + (i % 3) * 0.03, Math.floor(i / 6) * 0.15 - 0.2); s.rotation.y = i * 0.7; } return g; } },
  { id: 'bottle', name: 'A lost bike bottle', hint: 'Someone dropped a bottle at the Hāwī turnaround. It happens every year.', at: c => c.near('hawi', 14, 8, 0),
    build: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 12), lam(0x3e8ea0)); b.rotation.z = Math.PI / 2; b.position.y = 0.1; g.add(b); box(g, lam(0x13293d), 0.12, 0.06, 0.06, 0.2, 0.1, 0); return g; } },
];

export function createEggs({ scene, W, groundAt, toLocal, landmarks, highwayPts, coffee, isFound, onFind }) {
  const lm = id => landmarks?.list.find(l => l.id === id);
  const ctx = {
    coffee: coffee || [80, -400],
    // Offset (dx, dy) in the landmark's own frame when it is built (so it follows its rotation), else in survey metres.
    near(id, dx, dy, z = null, local = false) {
      const l = lm(id);
      if (!l) return null;
      if (local && l.built) { const p = new THREE.Vector3(dx, 0, dy).applyMatrix4(l.built.matrixWorld); return { x: p.x, y: -p.z, z }; }
      return { x: l.x + dx, y: l.y + dy, z };
    },
    ll(lat, lon, dx = 0, dy = 0) { const [x, y] = toLocal(lat, lon); return { x: x + dx, y: y + dy }; },
    highway(f, side) {
      const pts = highwayPts; if (!pts?.length) return null;
      const i = Math.max(1, Math.floor(pts.length * f)), [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
      return { x: bx - (dy / d) * side, y: by + (dx / d) * side };   // left of the direction of travel: makai heading north
    },
  };
  const list = [];
  let t = 0;
  const twinkle = () => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,245,200,1)'); g.addColorStop(0.3, 'rgba(255,220,120,.6)'); g.addColorStop(1, 'rgba(255,220,120,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    const tx = new THREE.CanvasTexture(cv);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  };
  function place(e) {
    const p = e.at(ctx);
    if (!p) return false;
    const g = e.build();
    const h = p.z != null ? p.z : Math.max(0, groundAt(p.x, p.y));
    g.position.copy(W(p.x, p.y, h));
    g.rotation.y = (p.x * 13.7) % 6.28;
    const tw = twinkle(); tw.position.set(0, 1.6, 0); tw.scale.setScalar(1.4); g.add(tw);
    scene.add(g);
    Object.assign(e, { g, tw, x: p.x, y: p.y, placed: true });
    return true;
  }
  for (const e of EGGS) list.push({ ...e, found: isFound(e.id), placed: false });

  function update(dt, camera) {
    t += dt;
    const px = camera.position.x, py = -camera.position.z;
    for (const e of list) {
      if (!e.placed) {
        const guess = e.at(ctx);
        if (guess && Math.hypot(px - guess.x, py - guess.y) < 1500) place(e);
        continue;
      }
      const d = Math.hypot(px - e.x, py - e.y);
      e.g.visible = d < 1500;
      if (!e.g.visible) continue;
      e.g.userData.tick?.(t);
      e.tw.visible = !e.found && d < 45;
      if (e.tw.visible) { e.tw.material.opacity = 0.5 + Math.sin(t * 5) * 0.4; e.tw.position.y = 1.6 + Math.sin(t * 2) * 0.3; }
      if (!e.found && d < (e.r || 4)) { e.found = true; onFind?.(e); }
    }
  }
  return { list, update, get found() { return list.filter(e => e.found).length; } };
}
