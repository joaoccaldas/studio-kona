// Live Kona conditions from Open-Meteo (free, no key): air and sea on the course right now, at Kailua (swim and
// town), the Energy Lab and Hāwī. Cached for 20 minutes; if the network is down it falls back to typical October
// weather so the game never waits. Everything downstream reads a single normalised object.

const SPOTS = { kailua: [19.6392, -155.9968], lab: [19.7175, -156.0381], hawi: [20.2390, -155.8315] };
const KEY = 'kona-weather-v1', TTL = 20 * 60 * 1000;

// WMO weather codes → words and an icon.
const CODES = [
  [[0], 'Clear', '☀️', '🌙'], [[1], 'Mostly clear', '🌤️', '🌙'], [[2], 'Partly cloudy', '⛅', '☁️'], [[3], 'Overcast', '☁️', '☁️'],
  [[45, 48], 'Fog', '🌫️', '🌫️'], [[51, 53, 55, 56, 57], 'Drizzle', '🌦️', '🌧️'], [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain showers', '🌧️', '🌧️'],
  [[71, 73, 75, 77, 85, 86], 'Snow (on Mauna Kea!)', '🌨️', '🌨️'], [[95, 96, 99], 'Thunderstorm', '⛈️', '⛈️'],
];
export function describe(code, day = true) { const c = CODES.find(([k]) => k.includes(code)) || CODES[1]; return { text: c[1], icon: day ? c[2] : c[3] }; }
const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = deg => DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

// Typical October conditions, by Hawaiʻi hour, when offline.
export function typical(now = new Date()) {
  const h = (now.getUTCHours() + 14) % 24;                     // HST = UTC-10
  const day = h >= 6 && h < 18.5, warm = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
  const base = { tempC: 24 + warm * 6, feelsC: 26 + warm * 8, humidity: 70, windKmh: 12 + warm * 14, gustKmh: 20 + warm * 18, windDir: 60, cloud: 35, rainMm: 0, code: 1, isDay: day, uv: day ? Math.round(warm * 11) : 0 };
  return normalise({ kailua: base, lab: { ...base, tempC: base.tempC + 2, feelsC: base.feelsC + 3 }, hawi: { ...base, windKmh: base.windKmh + 12, gustKmh: base.gustKmh + 18 }, sea: { waveM: 0.8, seaC: 27.5 }, sunrise: '06:18', sunset: '18:05', live: false, at: Date.now() });
}

function normalise(w) {
  const k = w.kailua;
  const d = describe(k.code, k.isDay);
  return { ...w, desc: d.text, icon: d.icon, windLabel: `${Math.round(k.windKmh)} km/h ${compass(k.windDir)}` };
}

async function fetchLive() {
  const lat = Object.values(SPOTS).map(s => s[0]).join(','), lon = Object.values(SPOTS).map(s => s[1]).join(',');
  const cur = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day,weather_code,uv_index';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${cur}&daily=sunrise,sunset&timezone=Pacific%2FHonolulu&forecast_days=1`;
  const marine = `https://marine-api.open-meteo.com/v1/marine?latitude=19.64&longitude=-156.0&current=wave_height,sea_surface_temperature&timezone=Pacific%2FHonolulu`;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const [a, m] = await Promise.all([fetch(url, { signal: ctl.signal }).then(r => r.json()), fetch(marine, { signal: ctl.signal }).then(r => r.json()).catch(() => null)]);
    const arr = Array.isArray(a) ? a : [a];
    const pick = i => { const c = arr[i]?.current; if (!c) return null; return { tempC: c.temperature_2m, feelsC: c.apparent_temperature, humidity: c.relative_humidity_2m, windKmh: c.wind_speed_10m, gustKmh: c.wind_gusts_10m, windDir: c.wind_direction_10m, cloud: c.cloud_cover, rainMm: c.precipitation, code: c.weather_code, isDay: !!c.is_day, uv: c.uv_index }; };
    const kailua = pick(0);
    if (!kailua) throw new Error('no data');
    const hhmm = s => (s || '').slice(11, 16);
    return normalise({
      kailua, lab: pick(1) || kailua, hawi: pick(2) || kailua,
      sea: { waveM: m?.current?.wave_height ?? 0.8, seaC: m?.current?.sea_surface_temperature ?? 27.5 },
      sunrise: hhmm(arr[0]?.daily?.sunrise?.[0]) || '06:18', sunset: hhmm(arr[0]?.daily?.sunset?.[0]) || '18:05',
      time: arr[0]?.current?.time, live: true, at: Date.now(),
    });
  } finally { clearTimeout(t); }
}

let current = null, pending = null;
const listeners = new Set();
export function weatherNow() {
  if (current) return current;
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.kailua) current = normalise(c); } catch { /* storage blocked */ }
  return current || (current = typical());
}
// Ask for fresh conditions (no-op while the cache is fresh). Resolves to the latest conditions.
export function refreshWeather(force = false) {
  const w = weatherNow();
  if (!force && w.live && Date.now() - w.at < TTL) return Promise.resolve(w);
  if (pending) return pending;
  pending = fetchLive().then(n => {
    current = n;
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* storage full */ }
    for (const f of listeners) f(n);
    return n;
  }).catch(() => w).finally(() => { pending = null; });
  return pending;
}
export function onWeather(f) { listeners.add(f); return () => listeners.delete(f); }

// Game-facing numbers: how windy (0 calm .. 1.6 howling), how hot (0 mild .. 1.5 brutal), how wet (0..1), how cloudy.
export function effects(w = weatherNow()) {
  return {
    wind: Math.min(1.6, Math.max(0.35, w.hawi.windKmh / 25 + (w.hawi.gustKmh - w.hawi.windKmh) / 60)),
    windDir: w.kailua.windDir,
    heat: Math.min(1.5, Math.max(0.6, (w.lab.feelsC - 22) / 10)),
    rain: Math.min(1, (w.kailua.rainMm || 0) / 1.5 + ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95].includes(w.kailua.code) ? 0.35 : 0)),
    cloud: (w.kailua.cloud ?? 30) / 100,
    surf: Math.min(1.5, (w.sea.waveM || 0.8) / 1.2),
    night: !w.kailua.isDay,
  };
}

// A few lines of advice for athletes, written from the numbers.
export function tips(w = weatherNow()) {
  const out = [];
  const lab = w.lab, hawi = w.hawi, k = w.kailua;
  if (lab.feelsC >= 34) out.push(`Energy Lab feels like ${Math.round(lab.feelsC)} °C: ice in the suit, sponges at every aid station.`);
  else if (lab.feelsC >= 29) out.push(`Warm out at the Energy Lab (${Math.round(lab.feelsC)} °C feels-like). Drink before you are thirsty.`);
  else out.push(`Mild for Kona at the Energy Lab (${Math.round(lab.feelsC)} °C). A good day for a long run.`);
  if (hawi.gustKmh >= 45) out.push(`Hāwī gusts to ${Math.round(hawi.gustKmh)} km/h: stay low on the bars and hold the line on the descent.`);
  else if (hawi.windKmh >= 20) out.push(`Steady ${Math.round(hawi.windKmh)} km/h wind at Hāwī: expect a slow climb and a fast way back.`);
  else out.push(`Light winds at Hāwī today (${Math.round(hawi.windKmh)} km/h). Rare, enjoy the climb.`);
  if (w.sea.waveM >= 1.5) out.push(`Surf around ${w.sea.waveM.toFixed(1)} m: sight often and swim wide of the pier.`);
  else out.push(`Kailua Bay ${w.sea.seaC.toFixed(1)} °C, waves ${w.sea.waveM.toFixed(1)} m: no wetsuits in Kona (too warm).`);
  if (k.uv >= 8) out.push(`UV ${Math.round(k.uv)}: reef-safe sunscreen and a visor.`);
  return out;
}
