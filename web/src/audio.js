// Procedural Web Audio API sound effects for Kona 3D World (Zero external asset dependencies)
let ctx = null;

function getAudio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) ctx = new AudioContext();
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => { getAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
}

export function playFootstep(isRun = false) {
  const ac = getAudio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(isRun ? 95 : 75, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.07);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, t);

  gain.gain.setValueAtTime(isRun ? 0.08 : 0.04, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  osc.start(t);
  osc.stop(t + 0.08);
}

export function playWaterSplash() {
  const ac = getAudio();
  if (!ac) return;
  const t = ac.currentTime;

  const bufferSize = Math.floor(ac.sampleRate * 0.2);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (last + (0.05 * white)) / 1.05;
    last = data[i];
  }

  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(180, t + 0.2);
  filter.Q.value = 2.5;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  noise.start(t);
}

export function playJump() {
  const ac = getAudio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(260, t + 0.14);

  gain.gain.setValueAtTime(0.09, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start(t);
  osc.stop(t + 0.15);
}

export function playMemoryChime() {
  const ac = getAudio();
  if (!ac) return;
  const t = ac.currentTime;

  // Shimmering chord (A major 9: A4, C#5, E5, G#5, B5)
  const freqs = [440, 554.37, 659.25, 830.61, 987.77];
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t + i * 0.05);

    gain.gain.setValueAtTime(0.001, t + i * 0.05);
    gain.gain.linearRampToValueAtTime(0.07, t + i * 0.05 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 + i * 0.1);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start(t + i * 0.05);
    osc.stop(t + 1.8);
  });
}

export function playUnlockFanfare() {
  const ac = getAudio();
  if (!ac) return;
  const t = ac.currentTime;

  const notes = [
    { f: 349.23, start: 0.0, dur: 0.18 },
    { f: 440.00, start: 0.15, dur: 0.18 },
    { f: 523.25, start: 0.30, dur: 0.22 },
    { f: 698.46, start: 0.48, dur: 0.85 }
  ];

  notes.forEach(({ f, start, dur }) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t + start);

    gain.gain.setValueAtTime(0.01, t + start);
    gain.gain.linearRampToValueAtTime(0.16, t + start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start(t + start);
    osc.stop(t + start + dur + 0.05);
  });
}

export function playConchChime() {
  const ac = getAudio();
  if (!ac) return;
  const t = ac.currentTime;

  // Hawaiian Pū (conch shell): deep rich brass fundamental with slow acoustic breath swell
  const fund = 220; // A3
  [fund, fund * 1.5, fund * 2.0].forEach((f, idx) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = idx === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.015, t + 0.3);
    osc.frequency.exponentialRampToValueAtTime(f * 0.985, t + 1.8);

    const maxG = idx === 0 ? 0.14 : (idx === 1 ? 0.08 : 0.04);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(maxG, t + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start(t);
    osc.stop(t + 2.3);
  });
}
