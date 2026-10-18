// Level 6 · Flat Fix (Hands). A roadside tube change against the clock, drawn as a clean 2D close-up.
// Lever → wheel out → tyre levers → find the thorn → new tube → CO₂ (let go in the green) → wheel in.
// Score is seconds (lower is better); mistakes add seconds. Too much CO₂ bursts the tube and you fit another.

const STEPS = [
  { id: 'lever', text: 'Tap the quick-release lever to open it' },
  { id: 'out', text: 'Drag the wheel down and out of the frame' },
  { id: 'tyre', text: 'Tap both tyre-lever spots on the rim' },
  { id: 'thorn', text: 'Drag to spin the tyre and tap the thorn' },
  { id: 'tube', text: 'Drag the new tube onto the wheel' },
  { id: 'air', text: 'Hold CO₂, let go in the green (7–9 bar)' },
  { id: 'in', text: 'Drag the wheel back up into the frame' },
  { id: 'close', text: 'Tap the lever to close it. Go!' },
];

export default {
  scene: '2d',
  create(ctx) {
    const { canvas, hud, sfx, haptic } = ctx;
    const c = canvas.getContext('2d');
    const S = { step: 0, t: 0, pen: 0, done: false, wheelY: 0, spin: 0, thornA: 0, taps: [], pressure: 0, air: false, tube: null, burst: 0, drag: null, shake: 0 };
    let W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;
    function size() {
      dpr = Math.min(devicePixelRatio, 2);
      W = innerWidth; H = innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(W * 0.36, H * 0.24);
      cx = W / 2; cy = H * 0.46;
    }
    size();
    addEventListener('resize', size);

    const leverSpots = () => [0.25, 0.75].map(f => ({ a: -Math.PI / 2 + (f - 0.5) * 1.4 }));
    function setStep(n) {
      S.step = n;
      if (n < STEPS.length) hud.call(`<span>Step ${n + 1} of ${STEPS.length}</span><b>${STEPS[n].text}</b>`);
      if (STEPS[n]?.id === 'thorn') { S.thornA = Math.random() * Math.PI * 2; }
      if (STEPS[n]?.id === 'tyre') S.taps = [];
      if (STEPS[n]?.id === 'tube') S.tube = { x: W * 0.78, y: H * 0.84, home: true };
      sfx.step(); haptic(10);
    }
    const penalty = (s, why) => { S.pen += s; hud.pop(`+${s} s · ${why}`, 'bad'); sfx.trap(); haptic([30, 30]); S.shake = 0.3; };
    const hubY = () => cy + S.wheelY;
    const leverPos = () => ({ x: cx + R * 0.34, y: hubY() - R * 0.02 });
    const near = (x, y, p, r) => Math.hypot(x - p.x, y - p.y) < r;

    // CO₂ button
    const co2 = hud.button('co2', 'Hold CO₂', {
      down: () => { if (STEPS[S.step]?.id === 'air') S.air = true; },
      up: () => {
        if (STEPS[S.step]?.id !== 'air' || !S.air) return;
        S.air = false;
        if (S.pressure >= 7 && S.pressure <= 9) { hud.pop(`${S.pressure.toFixed(1)} bar · perfect`, 'hot'); setStep(S.step + 1); }
        else if (S.pressure < 7) hud.pop(`${S.pressure.toFixed(1)} bar · more!`, 'bad');
        else hud.pop(`${S.pressure.toFixed(1)} bar · too hard, let some out`, 'bad'), S.pressure = 6;
      },
      cls: 'big',
    });
    co2.hidden = true;

    function down(ev) {
      const x = ev.clientX, y = ev.clientY, id = STEPS[S.step]?.id;
      if (id === 'lever' || id === 'close') {
        if (near(x, y, leverPos(), 46)) setStep(S.step + 1);
        else penalty(1, 'that is not the lever');
      } else if (id === 'out' || id === 'in') S.drag = { y0: y, w0: S.wheelY };
      else if (id === 'tyre') {
        const spots = leverSpots();
        const k = S.taps.length, a = spots[k].a;
        const p = { x: cx + Math.cos(a) * R, y: hubY() + Math.sin(a) * R };
        if (near(x, y, p, 40)) { S.taps.push(k); sfx.pack(k + 1); haptic(12); if (S.taps.length === 2) setStep(S.step + 1); }
        else penalty(1, 'missed the rim');
      } else if (id === 'thorn') {
        const a = S.thornA + S.spin, p = { x: cx + Math.cos(a) * (R + 9), y: hubY() + Math.sin(a) * (R + 9) };
        if (Math.sin(a) < 0.2 && near(x, y, p, 34)) { hud.pop('Found it! Thorn out', 'hot'); setStep(S.step + 1); }
        else S.drag = { x0: x, s0: S.spin, tapX: x, tapY: y, moved: false };
      } else if (id === 'tube' && S.tube && near(x, y, S.tube, 60)) S.drag = { tube: true };
    }
    function move(ev) {
      const d = S.drag, id = STEPS[S.step]?.id;
      if (!d) return;
      if (id === 'out' || id === 'in') S.wheelY = Math.max(0, Math.min(H * 0.34, d.w0 + (ev.clientY - d.y0)));
      else if (id === 'thorn') { S.spin = d.s0 + (ev.clientX - d.x0) / R; if (Math.abs(ev.clientX - d.x0) > 8) d.moved = true; }
      else if (d.tube) { S.tube.x = ev.clientX; S.tube.y = ev.clientY; }
    }
    function up() {
      const d = S.drag, id = STEPS[S.step]?.id;
      S.drag = null;
      if (!d) return;
      if (id === 'out') { if (S.wheelY > H * 0.22) { S.wheelY = H * 0.28; setStep(S.step + 1); } else S.wheelY = 0; }
      else if (id === 'in') { if (S.wheelY < H * 0.06) { S.wheelY = 0; setStep(S.step + 1); } else S.wheelY = H * 0.28; }
      else if (id === 'thorn' && !d.moved) penalty(1, 'no thorn there');
      else if (d.tube) {
        if (near(S.tube.x, S.tube.y, { x: cx, y: hubY() }, R * 1.1)) { S.tube = null; setStep(S.step + 1); co2.hidden = false; S.pressure = 0; }
        else { S.tube.x = W * 0.78; S.tube.y = H * 0.84; }
      }
    }

    function draw() {
      const sh = S.shake > 0 ? (Math.random() - 0.5) * 10 * S.shake : 0;
      c.save();
      c.translate(sh, 0);
      // Energy Lab verge: sky, lava, road edge.
      const sky = c.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, '#d99a5a'); sky.addColorStop(1, '#f6e0b8');
      c.fillStyle = sky; c.fillRect(-20, 0, W + 40, H);
      c.fillStyle = '#2c2624'; c.fillRect(-20, H * 0.55, W + 40, H * 0.45);
      c.fillStyle = '#3b3d42'; c.fillRect(-20, H * 0.72, W + 40, H * 0.28);
      c.fillStyle = '#f4efe4'; c.fillRect(-20, H * 0.72, W + 40, 5);
      // Frame: rear triangle, dropout and lever.
      const hy = hubY();
      c.strokeStyle = '#13293D'; c.lineWidth = 14; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - R * 1.35, cy - R * 1.05); c.moveTo(cx, cy); c.lineTo(cx - R * 1.5, cy + R * 0.2); c.stroke();
      c.lineWidth = 10; c.strokeStyle = '#2E6F73'; c.beginPath(); c.moveTo(cx - R * 1.35, cy - R * 1.05); c.lineTo(cx - R * 1.5, cy + R * 0.2); c.stroke();
      // Wheel.
      const flat = S.step < 5;
      c.save();
      c.translate(cx, hy);
      c.strokeStyle = '#1a1d22'; c.lineWidth = flat ? 14 : 18;
      c.beginPath(); c.ellipse(0, flat ? 4 : 0, R, flat ? R * 0.97 : R, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#9aa0a6'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, R - 12, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(19,41,61,.45)'; c.lineWidth = 1.5;
      for (let i = 0; i < 20; i++) { const a = S.spin + i * Math.PI / 10; c.beginPath(); c.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); c.lineTo(Math.cos(a) * (R - 14), Math.sin(a) * (R - 14)); c.stroke(); }
      c.fillStyle = '#13293D'; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill();
      c.restore();
      // Lever on the hub.
      const lp = leverPos(), open = S.step >= 1 && S.step < 7;
      c.save(); c.translate(lp.x, lp.y); c.rotate(open ? 0.9 : -0.2);
      c.fillStyle = '#D9785B'; c.beginPath(); c.roundRect(-8, -8, 64, 16, 8); c.fill(); c.restore();
      const id = STEPS[S.step]?.id;
      const pulse = 0.5 + 0.5 * Math.sin(ctx.t * 7);
      const ring = (x, y, r) => { c.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`; c.lineWidth = 4; c.beginPath(); c.arc(x, y, r + pulse * 6, 0, Math.PI * 2); c.stroke(); };
      if (id === 'lever' || id === 'close') ring(lp.x + 20, lp.y, 30);
      if (id === 'out' || id === 'in') { c.fillStyle = 'rgba(251,248,242,.9)'; c.font = '800 34px system-ui'; c.textAlign = 'center'; c.fillText(id === 'out' ? '↓' : '↑', cx, hy + (id === 'out' ? R + 50 : -R - 20)); }
      if (id === 'tyre') leverSpots().forEach((s, k) => { const x = cx + Math.cos(s.a) * R, y = hy + Math.sin(s.a) * R; if (S.taps.includes(k)) { c.fillStyle = '#e8c35a'; c.fillRect(x - 4, y - 26, 8, 30); } else if (k === S.taps.length) ring(x, y, 18); });
      if (id === 'thorn') {
        const a = S.thornA + S.spin, x = cx + Math.cos(a) * (R + 9), y = hy + Math.sin(a) * (R + 9);
        // Only a small glint, and only while it faces up toward the light.
        if (Math.sin(a) < 0.2) { c.fillStyle = `rgba(255,245,200,${0.55 + pulse * 0.45})`; c.beginPath(); c.arc(x, y, 3.5 + pulse * 2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#6a4a2a'; c.fillRect(x - 1.5, y - 7, 3, 7); }
        c.fillStyle = 'rgba(251,248,242,.85)'; c.font = '700 14px system-ui'; c.textAlign = 'center'; c.fillText('⟵ drag to spin ⟶', cx, hy + R + 44);
      }
      if (S.tube) { c.strokeStyle = '#c0392b'; c.lineWidth = 9; c.beginPath(); c.ellipse(S.tube.x, S.tube.y, 42, 30, 0.3, 0, Math.PI * 2); c.stroke(); if (!S.drag) ring(S.tube.x, S.tube.y, 50); }
      if (id === 'air') {
        // Pressure gauge.
        const gx = cx, gy = H * 0.12 + 40, gr = 44;
        c.lineWidth = 10;
        c.strokeStyle = 'rgba(19,41,61,.25)'; c.beginPath(); c.arc(gx, gy, gr, Math.PI, 0); c.stroke();
        c.strokeStyle = '#3fae7a'; c.beginPath(); c.arc(gx, gy, gr, Math.PI + (7 / 12) * Math.PI, Math.PI + (9 / 12) * Math.PI); c.stroke();
        c.strokeStyle = '#D9785B'; c.beginPath(); c.arc(gx, gy, gr, Math.PI + (11 / 12) * Math.PI, 2 * Math.PI); c.stroke();
        const na = Math.PI + Math.min(1, S.pressure / 12) * Math.PI;
        c.strokeStyle = '#13293D'; c.lineWidth = 4; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(na) * (gr - 6), gy + Math.sin(na) * (gr - 6)); c.stroke();
        c.fillStyle = '#13293D'; c.font = '800 16px system-ui'; c.textAlign = 'center'; c.fillText(`${S.pressure.toFixed(1)} bar`, gx, gy + 22);
      }
      if (S.burst > 0) { c.fillStyle = `rgba(255,255,255,${S.burst})`; c.fillRect(0, 0, W, H); c.fillStyle = `rgba(217,120,91,${S.burst})`; c.font = '900 64px system-ui'; c.textAlign = 'center'; c.fillText('BANG!', cx, cy); }
      c.restore();
    }

    setStep(0);
    return {
      start() { hud.tip('Pssst… rear flat! Follow the steps, fast.', false, 2500); },
      step(dt, rdt = dt) {
        S.t += rdt;
        S.shake = Math.max(0, S.shake - dt);
        S.burst = Math.max(0, S.burst - dt * 1.5);
        if (S.air) {
          S.pressure += dt * 5.5;
          if (S.pressure > 11) { S.air = false; S.pressure = 0; S.burst = 1; penalty(6, 'tube burst, fit another'); co2.hidden = true; setStep(4); }
        }
        if (STEPS[S.step]?.id !== 'air') co2.hidden = true;
        const total = S.t + S.pen;
        hud.score(`${total.toFixed(1)} s`);
        if (!S.done && S.step >= STEPS.length) { S.done = true; hud.call(''); ctx.end(total, { note: `${S.t.toFixed(1)} s + ${S.pen} s penalties` }); }
      },
      idle() {},
      render() { draw(); },
      down, move, up,
      key(k, down) { if (k === ' ' && STEPS[S.step]?.id === 'air') { if (down) S.air = true; else co2.dispatchEvent(new PointerEvent('pointerup')); } },
      dispose() { removeEventListener('resize', size); },
      debug: () => ({ step: S.step, id: STEPS[S.step]?.id, t: S.t, pen: S.pen, pressure: S.pressure, wheelY: S.wheelY, H, W, R, cx, cy: hubY(), lever: leverPos(), spots: leverSpots().map(s => ({ x: cx + Math.cos(s.a) * R, y: hubY() + Math.sin(s.a) * R })), thorn: (() => { const a = S.thornA + S.spin; return { x: cx + Math.cos(a) * (R + 9), y: hubY() + Math.sin(a) * (R + 9), up: Math.sin(a) < 0.2 }; })(), tube: S.tube }),
    };
  },
};
