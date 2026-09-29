// Reads everything the player has done (days, streak, distances, places, surprises, stars, Rush, T1) into one
// snapshot, works out which Almanac cards and Locker items are open, and announces anything new with a toast.
import { readSection, writeSection } from './save.js';
import { CARDS, COSMETICS, blankProgress, unlockedCards, unlockedCosmetics, validAlmanac } from './lore.js';
import { haptic } from './appShell.js';

export function progressSnapshot(rewards) {
  const p = blankProgress();
  const alm = validAlmanac(readSection('almanac'));
  const st = rewards?.state;
  p.days = st?.days?.length || 0;
  p.streak = st?.streak || 0;
  p.walkKm = alm.walkM / 1000; p.rideKm = alm.rideM / 1000; p.swimM = alm.swimM;
  try { p.places = JSON.parse(localStorage.getItem('kona-passport') || '[]'); } catch { p.places = []; }
  p.eggs = alm.eggs;
  p.levels = readSection('levels') || {};
  const claimed = k => !!rewards?.claimed?.(k);
  p.rushKm = claimed('rush:medal:finish') ? 10 : claimed('rush:medal:gold') ? 7.5 : claimed('rush:medal:silver') ? 5 : claimed('rush:medal:bronze') ? 2.5 : 0;
  p.t1 = !!(readSection('arena') || {}).transition_tangle;
  return p;
}

// Returns what just opened (and remembers it so each thing is announced once).
export function checkUnlocks(rewards, { announce = true } = {}) {
  const p = progressSnapshot(rewards);
  const cards = unlockedCards(p), cos = unlockedCosmetics(p);
  const alm = validAlmanac(readSection('almanac'));
  const seen = new Set(alm.seen);
  const first = seen.size === 0;
  const newCards = cards.filter(id => !seen.has(id)), newCos = cos.filter(id => !seen.has(id));
  if (!newCards.length && !newCos.length) return { cards: [], cosmetics: [], p };
  alm.seen = [...seen, ...newCards, ...newCos];
  writeSection('almanac', alm);
  // The starting set is not news; everything after it is.
  if (announce && !first) {
    for (const id of newCards) { const c = CARDS.find(x => x.id === id); toast(`<b>📖 New Almanac card</b><span>${c.title}</span>`, 'card'); }
    for (const id of newCos) { const c = COSMETICS.find(x => x.id === id); toast(`<b>👕 New in your Locker</b><span>${c.name}</span>`, 'gear'); }
  }
  return { cards: newCards, cosmetics: newCos, p };
}

// Counters for movement on the island, flushed to the save now and then.
let pending = { walkM: 0, rideM: 0, swimM: 0 }, flushAt = 0;
export function addDistance(kind, m) {
  if (!(m > 0)) return;
  pending[kind] = (pending[kind] || 0) + m;
  const now = performance.now();
  if (now > flushAt) { flushAt = now + 5000; flushDistance(); }
}
export function flushDistance() {
  if (!pending.walkM && !pending.rideM && !pending.swimM) return;
  const alm = validAlmanac(readSection('almanac'));
  alm.walkM += pending.walkM; alm.rideM += pending.rideM; alm.swimM += pending.swimM;
  pending = { walkM: 0, rideM: 0, swimM: 0 };
  writeSection('almanac', alm);
}
export function foundEgg(id) {
  const alm = validAlmanac(readSection('almanac'));
  if (alm.eggs.includes(id)) return false;
  alm.eggs.push(id);
  writeSection('almanac', alm);
  return true;
}
export const lookNow = () => validAlmanac(readSection('almanac')).look;
export function saveLook(look) { const alm = validAlmanac(readSection('almanac')); alm.look = { ...alm.look, ...look }; writeSection('almanac', alm); }

// Toasts that stack at the top of the screen and work over any screen.
let host = null;
export function toast(html, kind = '') {
  if (!host || !document.body.contains(host)) { host = document.createElement('div'); host.id = 'unlockToasts'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = `ut ${kind}`;
  el.innerHTML = html;
  host.appendChild(el);
  haptic(10);
  setTimeout(() => el.classList.add('out'), 3800);
  setTimeout(() => el.remove(), 4300);
}
