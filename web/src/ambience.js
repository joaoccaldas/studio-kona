// The sound of Kona, generated live (no audio files): trade-wind breeze that gusts with the real wind, surf that
// swells with the real waves, birds by day and coquí frogs at night, crowds on Aliʻi Drive, rain, and the rush
// of air when you ride fast. One shared engine; each scene sets the mix, changes glide smoothly.

let eng = null;
const KEY = 'kona-sound';

function make() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  // Noise sources (white and a brown-ish one), looped.
  const buf = (brown) => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  };
  const white = buf(false), brown = buf(true);
  const loop = (b) => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.start(0, Math.random() * 3); return s; };
  const chain = (src, ...nodes) => { let n = src; for (const x of nodes) { n.connect(x); n = x; } return n; };
  const filt = (type, f, q = 0.7) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
  const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };

  const L = {};
  // Breeze: band-passed noise; a second whistle band for strong gusts.
  L.breeze = gain(0); chain(loop(white), L.breezeF = filt('bandpass', 500, 0.6), L.breeze, master);
  L.whistle = gain(0); chain(loop(white), filt('bandpass', 1900, 6), L.whistle, master);
  // Surf: low rumble with swells, plus a hiss on each break.
  L.surf = gain(0); chain(loop(brown), filt('lowpass', 420), L.surf, master);
  L.hiss = gain(0); chain(loop(white), filt('highpass', 2600), L.hiss, master);
  // Rain.
  L.rain = gain(0); chain(loop(white), filt('highpass', 3500), filt('lowpass', 9000), L.rain, master);
  // Crowd murmur.
  L.crowd = gain(0); chain(loop(white), filt('bandpass', 900, 0.9), L.crowd, master);
  // Riding: air rushing past the helmet.
  L.speed = gain(0); chain(loop(brown), L.speedF = filt('lowpass', 300), L.speed, master);

  const mix = { wind: 0.5, surf: 0.5, birds: 0.5, crowd: 0, rain: 0, speed: 0, night: false, volume: 0.9 };
  const ramp = (p, v, s = 0.8) => p.setTargetAtTime(v, ctx.currentTime, s);
  let gustT = 0, swellT = 0, nextChirp = 0, nextCoqui = 0, nextCheer = 0;

  // Little synthesized voices.
  function tone(f0, f1, dur, vol, type = 'sine', at = ctx.currentTime) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.02);
  }
  function bird() { const t = ctx.currentTime, n = 2 + (Math.random() * 3 | 0), f = 2600 + Math.random() * 1800; for (let i = 0; i < n; i++) tone(f, f * (1.2 + Math.random() * 0.4), 0.09, 0.025 * mix.birds, 'sine', t + i * 0.13); }
  function coqui() { const t = ctx.currentTime; tone(1150, 1100, 0.09, 0.03, 'sine', t); tone(1900, 2150, 0.16, 0.03, 'sine', t + 0.14); }
  function cheer() {
    const t = ctx.currentTime;
    for (let i = 0; i < 6; i++) { const f = 500 + Math.random() * 500; tone(f, f * 1.5, 0.5 + Math.random() * 0.4, 0.012 * mix.crowd, 'sawtooth', t + Math.random() * 0.3); }
    for (let i = 0; i < 14; i++) { const s = ctx.createBufferSource(); s.buffer = white; const g = gain(0), f = filt('bandpass', 1800 + Math.random() * 1200, 2); s.connect(f).connect(g).connect(master); const at = t + Math.random() * 1.2; g.gain.setValueAtTime(0.05 * mix.crowd, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05); s.start(at, Math.random() * 3, 0.06); }
  }

  function tick(dt) {
    gustT += dt * (0.25 + mix.wind * 0.3); swellT += dt;
    const gust = 0.55 + 0.45 * Math.sin(gustT) * Math.sin(gustT * 0.37 + 1.3);
    ramp(L.breeze.gain, 0.05 * mix.wind * (0.4 + gust), 0.4);
    ramp(L.breezeF.frequency, 350 + 500 * gust * mix.wind, 0.5);
    ramp(L.whistle.gain, Math.max(0, mix.wind - 0.9) * 0.012 * gust, 0.4);
    const period = 7.5, ph = (swellT % period) / period, swell = Math.pow(Math.sin(ph * Math.PI), 3);
    ramp(L.surf.gain, 0.11 * mix.surf * (0.35 + swell), 0.3);
    ramp(L.hiss.gain, 0.02 * mix.surf * Math.max(0, swell - 0.6), 0.25);
    ramp(L.rain.gain, 0.05 * mix.rain, 1);
    ramp(L.crowd.gain, 0.03 * mix.crowd, 1);
    ramp(L.speed.gain, 0.09 * Math.min(1, mix.speed), 0.3);
    ramp(L.speedF.frequency, 200 + 1200 * Math.min(1, mix.speed), 0.3);
    const now = ctx.currentTime;
    if (!mix.night && mix.birds > 0.05 && now > nextChirp) { bird(); nextChirp = now + 2 + Math.random() * 6 / mix.birds; }
    if (mix.night && mix.birds > 0.05 && now > nextCoqui) { coqui(); nextCoqui = now + 0.9 + Math.random() * 2.5; }
    if (mix.crowd > 0.2 && now > nextCheer) { cheer(); nextCheer = now + 2.5 + Math.random() * 5 / mix.crowd; }
  }
  let last = performance.now();
  setInterval(() => { if (ctx.state !== 'running') return; const n = performance.now(); tick(Math.min(0.5, (n - last) / 1000)); last = n; }, 120);

  let muted = false;
  try { muted = localStorage.getItem(KEY) === 'off'; } catch { /* storage blocked */ }
  const apply = () => ramp(master.gain, muted ? 0 : mix.volume, 0.6);
  document.addEventListener('visibilitychange', () => { if (document.hidden) master.gain.setTargetAtTime(0, ctx.currentTime, 0.1); else apply(); });
  return {
    ctx,
    start() { if (ctx.state === 'suspended') ctx.resume(); apply(); },
    set(m) { Object.assign(mix, m); },
    cheer: () => !muted && cheer(),
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch { /* storage blocked */ } apply(); return !muted; },
  };
}

// The shared engine, created lazily and started on the first tap (browsers need a gesture for sound).
export function ambience() {
  if (!eng) {
    eng = make() || { start() {}, set() {}, cheer() {}, muted: true, toggle: () => false };
    const go = () => eng.start();
    addEventListener('pointerdown', go, { passive: true });
    addEventListener('keydown', go);
  }
  return eng;
}
