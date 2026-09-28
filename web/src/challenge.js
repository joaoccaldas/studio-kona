// Short-session challenge framework (issue #26). One loop for every activity:
//   start → meaningful input → mistakes / recovery → finish → score → PB delta → Retry
// Scores are "lower is better" game seconds (elapsed + penalties). Rewards pay on the FIRST valid finish and once per
// medal tier ever reached; replays only improve the personal best. Results live in the versioned save ("arena").
// Pure logic here (no DOM, no three.js) so every rule is unit-tested; each activity supplies only its own gameplay.
import { readSection, writeSection, validArena } from './save.js';
import { hstDay } from './clock.js';
export { validArena };

export const MEDALS = ['gold', 'silver', 'bronze'];
export const MEDAL_LABEL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

const DEFS = new Map();

// def: { id, name, where, medals: { gold, silver, bronze } (max score in s), rewards: { first, gold, silver, bronze } }
export function defineChallenge(def) {
  if (!def?.id || !def.medals) throw new Error('challenge needs id and medals');
  const m = def.medals;
  if (!(m.gold < m.silver && m.silver < m.bronze)) throw new Error(`${def.id}: medal thresholds must rise gold < silver < bronze`);
  DEFS.set(def.id, def);
  return def;
}
export const getChallenge = id => DEFS.get(id);
export const allChallenges = () => [...DEFS.values()];

export function medalFor(def, score) {
  if (!Number.isFinite(score) || score < 0) return null;
  return MEDALS.find(m => score <= def.medals[m]) || null;
}
const rank = m => (m ? 3 - MEDALS.indexOf(m) : 0);                 // gold 3, silver 2, bronze 1, none 0

// A run is valid when it was finished, lasted a plausible time and its penalties add up.
export function validRun(run) {
  return !!run && run.finished === true && Number.isFinite(run.elapsed) && run.elapsed >= 1 && run.elapsed < 3600
    && Array.isArray(run.penalties) && run.penalties.every(p => Number.isFinite(p.s) && p.s >= 0 && typeof p.why === 'string');
}
export const scoreOf = run => Math.round((run.elapsed + run.penalties.reduce((a, p) => a + p.s, 0)) * 100) / 100;

// Pure: fold one run into the stored record. Returns the new record and what changed, without side effects.
export function recordRun(prev, def, run) {
  const rec = { best: null, bestMedal: null, runs: 0, finishes: 0, firstAt: null, last: null, ...(prev || {}) };
  rec.runs += 1;
  if (!validRun(run)) return { record: rec, valid: false };
  const score = scoreOf(run);
  const medal = medalFor(def, score);
  const first = rec.finishes === 0;
  const delta = rec.best == null ? null : Math.round((score - rec.best) * 100) / 100;
  const pb = rec.best == null || score < rec.best;
  const newMedal = rank(medal) > rank(rec.bestMedal);
  rec.finishes += 1;
  if (first) rec.firstAt = run.at || Date.now();
  if (pb) rec.best = score;
  if (newMedal) rec.bestMedal = medal;
  rec.last = { score, medal, at: run.at || Date.now(), mistakes: run.penalties.length };
  return { record: rec, valid: true, score, medal, first, pb, delta, newMedal };
}

// Every medal tier up to the one earned pays once (a first gold also pays silver and bronze), plus the first finish.
export function rewardKeys(def, outcome) {
  if (!outcome?.valid) return [];
  const keys = [];
  if (def.rewards?.first) keys.push([`ch:${def.id}:first`, def.rewards.first]);
  const r = rank(outcome.medal);
  for (const m of [...MEDALS].reverse()) if (rank(m) <= r && def.rewards?.[m]) keys.push([`ch:${def.id}:medal:${m}`, def.rewards[m]]);
  return keys;
}

// Stateful wrapper used by the game: stores the record and pays rewards through rewards.grantOnce.
export function submitRun(id, run, { rewards } = {}) {
  const def = DEFS.get(id);
  if (!def) throw new Error('unknown challenge ' + id);
  const arena = readSection('arena');
  const outcome = recordRun(arena[id], def, run);
  arena[id] = outcome.record;
  writeSection('arena', arena);
  const grants = [];
  for (const [key, reward] of rewardKeys(def, outcome)) {
    const g = rewards?.grantOnce(key, { ...reward, reason: `${def.name}: ${key.split(':').pop()}` });
    if (g) grants.push(g);
  }
  return { ...outcome, grants };
}
export const recordFor = id => readSection('arena')[id] || null;

// Deterministic per-day seed, the same for everyone on that date (fair comparisons, later async ghosts).
export function dailySeed(id, date = new Date()) {
  const day = hstDay(date.getTime());                        // Hawaiʻi day (clock.js)
  let h = 2166136261;
  for (const c of id + ':' + day) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

export const fmt = s => (s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)} s`);
export function deepLink(id, origin = globalThis.location?.origin + globalThis.location?.pathname) {
  return `${origin || ''}?c=${encodeURIComponent(id)}`;
}
export function shareText(def, { name, score, medal }) {
  return `${name || 'I'} · ${def.name} · ${fmt(score)}${medal ? ` · ${MEDAL_LABEL[medal]}` : ''}. Can you beat it?`;
}
