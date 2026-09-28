// Kona Rush rules: upgrades, rider stats, daily missions, run rewards. Pure logic (no DOM, no three.js), unit-tested.
import { hstDay } from './clock.js';

// Upgrades bought with Credits. Each level changes a stat the player can feel in the next run.
export const UPGRADES = {
  wheels: { name: 'Deep wheels', what: 'Top speed', levels: [0, 150, 400, 900, 1800], per: 0.07 },
  helmet: { name: 'Aero helmet', what: 'Tuck costs less energy', levels: [0, 120, 350, 800, 1600], per: 0.12 },
  fuel: { name: 'Race nutrition', what: 'Bigger energy tank', levels: [0, 100, 300, 700, 1400], per: 0.15 },
};
export const MAX_LEVEL = 4;

export function blankGarage() {
  return { levels: { wheels: 0, helmet: 0, fuel: 0 }, best: 0, bestPasses: 0, runs: 0, totalKm: 0, missions: null, zonesSeen: 0 };
}

export function statsFor(levels = {}) {
  const l = k => Math.min(MAX_LEVEL, Math.max(0, levels[k] | 0));
  return {
    topSpeed: 1 + UPGRADES.wheels.per * l('wheels'),          // multiplier on base cruising speed
    tuckCost: 1 - UPGRADES.helmet.per * l('helmet'),          // multiplier on energy used while tucked
    tank: 1 + UPGRADES.fuel.per * l('fuel'),                  // multiplier on energy capacity
  };
}

export function nextCost(key, level) {
  const u = UPGRADES[key];
  return u && level < MAX_LEVEL ? u.levels[level + 1] : null;
}

// Buying: returns the new garage or null when it cannot be afforded / is maxed. Spending goes through rewards.spend().
export function buy(garage, key, rewards) {
  const lvl = garage.levels[key] | 0, cost = nextCost(key, lvl);
  if (cost == null || !rewards?.spend(cost, `${UPGRADES[key].name} level ${lvl + 1}`)) return null;
  return { ...garage, levels: { ...garage.levels, [key]: lvl + 1 } };
}

// Course zones every 2.5 km within a run: the look, the wind and the heat change as you go.
export const ZONES = [
  { id: 'queenk', name: 'Queen K lava fields', from: 0 },
  { id: 'hawi', name: 'Hāwī climb · crosswinds', from: 2.5 },
  { id: 'energylab', name: 'Energy Lab heat', from: 5 },
  { id: 'alii', name: 'Aliʻi Drive finish', from: 7.5 },
];
export const zoneAt = km => ZONES.reduce((z, cur) => (km >= cur.from ? cur : z), ZONES[0]);

// Medals by distance (km) in one run.
export const MEDALS = { bronze: 2.5, silver: 5, gold: 7.5, finish: 10 };
export function medalFor(km) {
  return km >= MEDALS.finish ? 'finish' : km >= MEDALS.gold ? 'gold' : km >= MEDALS.silver ? 'silver' : km >= MEDALS.bronze ? 'bronze' : null;
}

// Score: distance matters most; clean passes and rings add; penalties cost.
export function scoreRun({ km = 0, passes = 0, rings = 0, bestCombo = 0, cards = 0 }) {
  return Math.max(0, Math.round(km * 100 + passes * 10 + rings * 15 + bestCombo * 20 - cards * 50));
}
// Credits earned for a run (the spendable currency). Rough target: a decent run ≈ 60–120 Credits.
export function creditsFor(run) {
  return Math.max(0, Math.round(run.km * 8 + run.passes * 1 + run.rings * 2 + (run.shells || 0) * 5));
}

// Three missions per Hawaiʻi day, the same for everyone on that date.
const MISSION_POOL = [
  { id: 'ride', text: n => `Ride ${n} km in total`, stat: 'km', amounts: [5, 8, 12], reward: 60 },
  { id: 'pass', text: n => `Pass ${n} riders`, stat: 'passes', amounts: [25, 40, 60], reward: 50 },
  { id: 'rings', text: n => `Fly through ${n} Aloha rings`, stat: 'rings', amounts: [15, 25, 40], reward: 50 },
  { id: 'clean', text: n => `Finish ${n} run${n > 1 ? 's' : ''} with no drafting card`, stat: 'cleanRuns', amounts: [1, 2, 3], reward: 60 },
  { id: 'combo', text: n => `Reach a ×${n} combo`, stat: 'maxCombo', amounts: [6, 10, 15], reward: 70, max: true },
  { id: 'hawi', text: () => 'Reach the Hāwī climb', stat: 'maxKm', amounts: [2.5], reward: 40, max: true },
  { id: 'lab', text: () => 'Reach the Energy Lab', stat: 'maxKm', amounts: [5], reward: 80, max: true },
];
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function missionsFor(day = hstDay()) {
  const pool = MISSION_POOL.slice();
  let h = hash('rush:' + day);
  const out = [];
  while (out.length < 3 && pool.length) {
    const m = pool.splice(h % pool.length, 1)[0];
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
    const n = m.amounts[h % m.amounts.length];
    if (out.some(o => o.stat === m.stat)) continue;             // one mission per stat
    out.push({ id: `${m.id}:${n}`, text: m.text(n), stat: m.stat, target: n, reward: m.reward, max: !!m.max, progress: 0, done: false, claimed: false });
  }
  return { day, list: out };
}

// Fold one finished run into today's missions (a new day starts a fresh set).
export function applyRunToMissions(missions, run, day = hstDay()) {
  const m = missions && missions.day === day ? missions : missionsFor(day);
  const add = { km: run.km, passes: run.passes, rings: run.rings, cleanRuns: run.cards === 0 ? 1 : 0 };
  const top = { maxCombo: run.bestCombo, maxKm: run.km };
  const list = m.list.map(x => {
    if (x.done) return x;
    const progress = x.max ? Math.max(x.progress, top[x.stat] || 0) : x.progress + (add[x.stat] || 0);
    return { ...x, progress: Math.round(progress * 100) / 100, done: progress >= x.target };
  });
  return { day: m.day, list };
}

export function validGarage(g) {
  const b = blankGarage();
  if (!g || typeof g !== 'object') return b;
  const lv = g.levels && typeof g.levels === 'object' ? g.levels : {};
  const n = v => (Number.isFinite(v) && v >= 0 ? v : 0);
  const levels = {};
  for (const k of Object.keys(UPGRADES)) levels[k] = Math.min(MAX_LEVEL, Math.floor(n(lv[k])));
  const ms = g.missions && typeof g.missions === 'object' && typeof g.missions.day === 'string' && Array.isArray(g.missions.list) ? g.missions : null;
  return { ...b, levels, best: n(g.best), bestPasses: Math.floor(n(g.bestPasses)), runs: Math.floor(n(g.runs)), totalKm: n(g.totalKm), missions: ms, zonesSeen: Math.min(ZONES.length, Math.floor(n(g.zonesSeen))) };
}
