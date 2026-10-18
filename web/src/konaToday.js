// "Kona right now": live conditions on the course, the race countdown, what is on today in race week, advice from
// the numbers, and today's live challenge (a Ride Map level chosen by the real weather, with a bonus).
import { weatherNow, refreshWeather, tips } from './weather.js';
import { hstDay, daysBetween } from './clock.js';
import { levelById } from './rideLevels.js';

const RACE_DAY = '2026-10-10';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Which level the real conditions pick today.
export function liveChallenge(w = weatherNow()) {
  if (w.hawi.gustKmh >= 35 || w.hawi.windKmh >= 22) return { id: 'crosswind', why: `Real gusts of ${Math.round(w.hawi.gustKmh)} km/h at Hāwī` };
  if (w.lab.feelsC >= 31) return { id: 'heat', why: `It feels like ${Math.round(w.lab.feelsC)} °C in the Energy Lab` };
  if (w.sea.waveM >= 1.2) return { id: 'honu', why: `${w.sea.waveM.toFixed(1)} m surf on the coast` };
  if (w.kailua.rainMm > 0.2) return { id: 'descent', why: 'Wet roads: brake early on the descent' };
  return { id: 'gap', why: 'Calm conditions: a day for pacing' };
}
export const liveKey = () => `live:${hstDay()}`;

let schedule = null;
async function loadSchedule(base) {
  if (schedule) return schedule;
  try { schedule = (await (await fetch(base + 'raceweek.json')).json()).days || []; } catch { schedule = []; }
  return schedule;
}

export function mountKonaToday(host, { base = 'assets/', rewards, onLevel }) {
  const el = document.createElement('section');
  el.className = 'hm-card kt';
  host.appendChild(el);
  let open = false;
  async function render() {
    const w = weatherNow(), k = w.kailua, today = hstDay();
    const toRace = daysBetween(today, RACE_DAY);
    const days = await loadSchedule(base);
    const d = days.find(x => x.date === today);
    const next = days.find(x => x.date > today);
    const on = d ? [...(d.play || []).map(p => `${p.title} · ${p.where}`), ...(d.also || [])] : [];
    const lc = liveChallenge(w), lv = levelById(lc.id);
    const done = rewards?.claimed?.(liveKey());
    const hhmm = w.time ? w.time.slice(11, 16) : '';
    el.innerHTML = `
      <div class="kt-head">
        <div class="kt-now"><span class="kt-ico">${w.icon}</span><div><b>${Math.round(k.tempC)}°C</b><span>${esc(w.desc)} · feels ${Math.round(k.feelsC)}°</span></div></div>
        <div class="kt-badge ${w.live ? 'live' : ''}">${w.live ? `LIVE ${hhmm} HST` : 'Typical'}</div>
      </div>
      <div class="kt-grid">
        <div><span>Wind</span><b>${esc(w.windLabel)}</b></div>
        <div><span>Hāwī gusts</span><b>${Math.round(w.hawi.gustKmh)} km/h</b></div>
        <div><span>Energy Lab</span><b>${Math.round(w.lab.feelsC)}° feels</b></div>
        <div><span>Bay</span><b>${w.sea.seaC.toFixed(1)}° · ${w.sea.waveM.toFixed(1)} m</b></div>
        <div><span>Sunrise</span><b>${esc(w.sunrise)}</b></div>
        <div><span>Sunset</span><b>${esc(w.sunset)}</b></div>
      </div>
      <p class="kt-count">${toRace > 0 ? `<b>${toRace}</b> day${toRace === 1 ? '' : 's'} to race day in Kona` : toRace === 0 ? '<b>Race day!</b> The swim starts at 6:25' : 'Race week is over. Mahalo!'}</p>
      <button type="button" class="kt-live ${done ? 'done' : ''}"><span>${done ? '✓ Today’s live challenge done' : 'Today’s live challenge · +40 Credits'}</span><b>${lv.icon} ${esc(lv.name)}</b><em>${esc(lc.why)}</em></button>
      <button type="button" class="kt-more">${open ? 'Less' : 'What’s on today · coach tips'}</button>
      ${open ? `<div class="kt-detail">
        <h3>${d ? `Race week · ${esc(d.short)}` : next ? `Next in race week · ${esc(next.short)}` : 'Race week'}</h3>
        <ul>${(on.length ? on : (next ? [...(next.play || []).map(p => `${p.title} · ${p.where}`), ...(next.also || [])] : ['Training on the island'])).slice(0, 5).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <h3>Coach says</h3><ul>${tips(w).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="kt-src">${w.live ? 'Live data: Open-Meteo, Kailua-Kona, the Energy Lab and Hāwī.' : 'Offline: showing typical October weather.'}</p>
      </div>` : ''}`;
    el.querySelector('.kt-live').onclick = () => onLevel?.(lc.id);
    el.querySelector('.kt-more').onclick = () => { open = !open; render(); };
  }
  render();
  refreshWeather().then(render);
  return { render };
}
