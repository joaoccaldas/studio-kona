import { validGarage } from './rushRules.js';
import { validLevels } from './rideLevels.js';
import { validAlmanac } from './lore.js';
// One versioned save for the whole game (issue #6). Every system reads and writes its own section through here.
//   kona-save-v2  { v: 2, player, campaign, rewards, heritage, arena, migratedFrom?, recovered? }
//   kona-fog-v1   the fog-of-war mask (a PNG data URL), kept apart because it is large and can be rebuilt.
// On first run the old stores are migrated and left in place as a backup. A save that cannot be parsed is copied
// aside (kona-save-v2.corrupt-<time>) and play continues from the migrated or empty state; it never blocks the game.
// Sections are validated on read, so a bad value from an old build or a hand-edited store cannot crash play or
// mint progress. Rewards have their own sanitiser in rewards.js.

export const SAVE_KEY = 'kona-save-v2';
export const FOG_KEY = 'kona-fog-v1';
export const OLD_KEYS = {
  player: 'kona-player-v1',
  campaign: 'kona.game.save.v1',
  rewards: 'kona-rewards-v1',
  heritage: 'kona_hawaiian_scavenger_hunt_v1',
};

const HEX = /^#[0-9a-f]{6}$/i;
const HELMETS = ['helmet_longtail', 'helmet_shorttail', 'helmet_aeroroad'];
const BIKES = ['speedmax_cfr', 'open_tri'];
const num = (v, lo = 0, hi = Infinity, d = lo) => (Number.isFinite(v) && v >= lo && v <= hi ? v : d);
const int = (v, lo = 0, hi = Infinity, d = lo) => Math.floor(num(v, lo, hi, d));
const strList = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 500) : []);

export function validPlayer(p) {
  if (!p || typeof p !== 'object' || typeof p.name !== 'string' || p.name.trim().length < 2) return null;
  const look = p.look && typeof p.look === 'object' ? p.look : {};
  const out = {
    name: p.name.trim().slice(0, 24),
    country: /^[A-Z]{2}$/.test(p.country) ? p.country : 'XX',
    visits: int(p.visits, 1, 60, 1),
    firstTime: p.firstTime !== false,
    created: num(p.created, 0, Infinity, Date.now()),
    look: {
      skin: HEX.test(look.skin) ? look.skin : '#b07a52',
      suit: HEX.test(look.suit) ? look.suit : '#1d3557',
      helmet: HELMETS.includes(look.helmet) ? look.helmet : 'helmet_longtail',
      bike: BIKES.includes(look.bike) ? look.bike : 'speedmax_cfr',
      hair: typeof look.hair === 'string' ? look.hair.slice(0, 24) : 'short',
      build: ['lean', 'balanced', 'powerful'].includes(look.build) ? look.build : 'balanced',
    },
  };
  if (p.last && Number.isFinite(p.last.x) && Number.isFinite(p.last.y)) out.last = { x: p.last.x, y: p.last.y };
  out.tutorials = [...new Set(strList(p.tutorials))].slice(0, 20);            // guided onboarding already seen
  // The bike travels in its box and is built at KOA. New athletes carry bikeBuilt: false from creation;
  // saves from before this flag existed that already have a position on the island rode there, so their bike is built.
  if (p.bikeBuilt === true || (p.bikeBuilt === undefined && out.last)) out.bikeBuilt = true;
  else if (p.bikeBuilt === false) out.bikeBuilt = false;
  if (p.packing && typeof p.packing === 'object') {
    const k = p.packing;
    out.packing = {
      packed: strList(k.packed), missing: strList(k.missing), extras: strList(k.extras),
      traps: int(k.traps, 0, 99, 0), secs: num(k.secs, 0, 36000, 0), medal: ['gold', 'silver', 'bronze'].includes(k.medal) ? k.medal : null,
      bestSecs: Number.isFinite(k.bestSecs) && k.bestSecs >= 0 ? k.bestSecs : null, at: num(k.at, 0, Infinity, 0),
    };
  }
  return out;
}

export function validCampaign(c) {
  const d = { currentDayIndex: 0, currentStepIndex: 0, completedDays: [], unlockedArtifacts: [], discoveredMemories: [], pendingDay: null };
  if (!c || typeof c !== 'object') return d;
  const stats = c.stats && typeof c.stats === 'object' ? c.stats : {};
  return {
    ...c,                                        // keep fields other systems own (challenges, colours…)
    currentDayIndex: int(c.currentDayIndex, 0, 40, 0),
    currentStepIndex: int(c.currentStepIndex, 0, 40, 0),
    completedDays: [...new Set(strList(c.completedDays))],
    unlockedArtifacts: Array.isArray(c.unlockedArtifacts) ? c.unlockedArtifacts.filter(a => a && typeof a === 'object' && typeof a.id === 'string') : [],
    discoveredMemories: [...new Set(strList(c.discoveredMemories))],
    pendingDay: Number.isInteger(c.pendingDay) && c.pendingDay >= 0 && c.pendingDay < 40 ? c.pendingDay : null,
    stats: { walk_m: num(stats.walk_m), ride_m: num(stats.ride_m), swim_m: num(stats.swim_m) },
    challenges: c.challenges && typeof c.challenges === 'object' ? c.challenges : {},
  };
}

const ARENA_MEDALS = ['gold', 'silver', 'bronze'];
// Challenge records (challenge.js), validated storage: { [challengeId]: record }.
export function validArena(a) {
  const out = {};
  if (!a || typeof a !== 'object') return out;
  for (const [id, r] of Object.entries(a)) {
    if (!/^[a-z0-9_]{2,40}$/.test(id) || !r || typeof r !== 'object') continue;
    const n = v => (Number.isFinite(v) && v >= 0 ? v : 0);
    out[id] = {
      best: Number.isFinite(r.best) && r.best >= 0 ? r.best : null,
      bestMedal: ARENA_MEDALS.includes(r.bestMedal) ? r.bestMedal : null,
      runs: Math.floor(n(r.runs)), finishes: Math.floor(n(r.finishes)),
      firstAt: Number.isFinite(r.firstAt) ? r.firstAt : null,
      last: r.last && Number.isFinite(r.last.score) ? { score: r.last.score, medal: ARENA_MEDALS.includes(r.last.medal) ? r.last.medal : null, at: n(r.last.at), mistakes: Math.floor(n(r.last.mistakes)) } : null,
    };
    if (out[id].best == null) out[id].bestMedal = null;
  }
  return out;
}


const VALIDATE = { player: validPlayer, campaign: validCampaign, rewards: x => x ?? null, heritage: x => [...new Set(strList(x))], arena: validArena, garage: validGarage, levels: validLevels, almanac: validAlmanac };

function store() { return globalThis.localStorage; }
function readJSON(key) {
  try { const raw = store()?.getItem(key); return raw == null ? undefined : JSON.parse(raw); } catch { return undefined; }
}

let doc = null;

function migrate() {
  const d = { v: 2, player: null, campaign: null, rewards: null, heritage: [], migratedFrom: [] };
  const old = key => { const v = readJSON(OLD_KEYS[key]); if (v !== undefined) d.migratedFrom.push(OLD_KEYS[key]); return v; };
  const p = old('player');
  if (p && typeof p === 'object') {
    if (typeof p.mask === 'string' && !readJSON(FOG_KEY) && p.mask.startsWith('data:image/')) {
      try { store()?.setItem(FOG_KEY, JSON.stringify(p.mask)); } catch { /* quota: the fog is rebuilt by exploring */ }
    }
    const { mask, ...rest } = p;
    d.player = rest;
  }
  d.campaign = old('campaign') ?? null;
  d.rewards = old('rewards') ?? null;
  d.heritage = old('heritage') ?? [];
  return d;
}

export function loadDoc() {
  if (doc) return doc;
  let raw;
  try { raw = store()?.getItem(SAVE_KEY); } catch { raw = null; }
  if (raw != null) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 2) { doc = parsed; return doc; }
      throw new Error('unknown save version');
    } catch {
      try { store()?.setItem(`${SAVE_KEY}.corrupt-${Date.now()}`, raw); } catch { /* ignore */ }
      doc = migrate();
      doc.recovered = Date.now();
      flush();
      return doc;
    }
  }
  doc = migrate();
  flush();
  return doc;
}

function flush() {
  try { store()?.setItem(SAVE_KEY, JSON.stringify(doc)); } catch { /* private mode or quota: keep playing in memory */ }
}

export function readSection(name) {
  const d = loadDoc();
  return VALIDATE[name] ? VALIDATE[name](d[name]) : d[name];
}

export function writeSection(name, value) {
  const d = loadDoc();
  d[name] = VALIDATE[name] ? VALIDATE[name](value) : value;
  flush();
  return d[name];
}

export function readFog() { const v = readJSON(FOG_KEY); return typeof v === 'string' ? v : null; }
export function writeFog(dataUrl) { try { store()?.setItem(FOG_KEY, JSON.stringify(dataUrl)); } catch { /* quota */ } }

// Tests only: forget the in-memory copy so the next read goes back to storage.
export function _resetForTests() { doc = null; }
