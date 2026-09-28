// Rewards that bring you back: XP (your level), Credits (spent later in town and the locker), a daily streak
// that makes progress faster, rare items, and five shells hidden around town each day.
// Race-week days open one per day you play (or on their real Hawaiʻi date); a Fast-forward ticket opens one early.
// Saved on this device under one versioned key, shaped so it can sync to an account later.

const KEY = 'kona-rewards-v1';
const WEEK_START = '2026-10-02'; // Hawaiʻi dates of the playable week: 2–12 October 2026

export const RARITY = {
  common: { label: 'Common', color: '#9fb3bd' },
  rare: { label: 'Rare', color: '#4fc1e9' },
  epic: { label: 'Epic', color: '#b57bff' },
  legendary: { label: 'Legendary', color: '#ffc83d' },
};

export const ITEMS = {
  coffee: { name: 'Cup of Kona coffee', rarity: 'common', icon: '☕', text: 'Kona coffee grows on the slopes of Hualālai and Mauna Loa.' },
  shave_ice: { name: 'Shave ice', rarity: 'common', icon: '🍧', text: 'The post-ride treat on Aliʻi Drive.' },
  plumeria: { name: 'Plumeria blossom', rarity: 'common', icon: '🌸', text: 'Worn behind the ear, and strung into leis.' },
  wristband: { name: 'Race-week wristband', rarity: 'common', icon: '🎗️', text: 'Proof you were in town for race week.' },
  ticket: { name: 'Fast-forward ticket', rarity: 'rare', icon: '⏩', text: 'Opens the next race-week day early.', usable: true },
  coral: { name: 'Coral message stone', rarity: 'rare', icon: '🪨', text: 'Fans spell messages in white coral on the black lava beside the Queen K.' },
  lei: { name: 'Flower lei', rarity: 'rare', icon: '💐', text: 'Given at arrivals, finishes and farewells.' },
  honu_badge: { name: 'Honu sighting', rarity: 'epic', icon: '🐢', text: 'Green sea turtles rest on Kona beaches. Stay 3 m (10 ft) away.' },
  sunrise: { name: 'Pier sunrise print', rarity: 'epic', icon: '🌅', text: 'Race morning: the sun comes up behind Hualālai.' },
  golden_shell: { name: 'Golden cowrie', rarity: 'legendary', icon: '🐚', text: 'A rare find on the Kona coast. Worth 250 Credits.' },
  crawl: { name: 'The Crawl, 1982', rarity: 'legendary', icon: '🏅', text: 'In February 1982 Julie Moss crawled to the finish on Aliʻi Drive.' },
};
const POOL = {
  common: ['coffee', 'shave_ice', 'plumeria', 'wristband'],
  rare: ['ticket', 'coral', 'lei'],
  epic: ['honu_badge', 'sunrise'],
  legendary: ['golden_shell', 'crawl'],
};

export const XP_FOR = { step: 40, day: 150, shell: 25, honu: 30, challenge: 120 };
export const CREDITS_FOR = { step: 10, day: 50, challenge: 40 };

const pad = n => String(n).padStart(2, '0');
export function localDate(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function hawaiiDate(now = Date.now()) { return new Date(now - 10 * 3600e3).toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3); }
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

export function levelFor(xp) {
  const level = Math.floor(Math.sqrt(xp / 120)) + 1;
  const cur = 120 * (level - 1) ** 2, next = 120 * level ** 2;
  return { level, into: xp - cur, need: next - cur };
}

function blank() {
  return { v: 1, xp: 0, credits: 0, items: {}, streak: 0, lastDay: null, days: [], ticketsUsed: 0, shells: {}, honu: {}, seenPhases: [], claimed: {}, log: [] };
}

// A save from an older build, another tab or a hand-edited store must never break play or mint Credits.
function sanitize(raw) {
  const b = blank();
  if (!raw || typeof raw !== 'object') return b;
  const num = (v, d = 0) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  const dateList = v => (Array.isArray(v) ? v.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : []);
  const items = {};
  if (raw.items && typeof raw.items === 'object') for (const [k, v] of Object.entries(raw.items)) if (ITEMS[k]) items[k] = num(v);
  return {
    ...b,
    xp: num(raw.xp), credits: num(raw.credits), items,
    streak: num(raw.streak), lastDay: /^\d{4}-\d{2}-\d{2}$/.test(raw.lastDay) ? raw.lastDay : null,
    days: [...new Set(dateList(raw.days))], ticketsUsed: num(raw.ticketsUsed),
    shells: raw.shells && typeof raw.shells === 'object' ? raw.shells : {},
    honu: raw.honu && typeof raw.honu === 'object' ? raw.honu : {},
    seenPhases: Array.isArray(raw.seenPhases) ? raw.seenPhases.filter(x => typeof x === 'string') : [],
    claimed: raw.claimed && typeof raw.claimed === 'object' ? raw.claimed : {},
    log: Array.isArray(raw.log) ? raw.log.slice(0, 40) : [],
  };
}

export function createRewards({ onChange } = {}) {
  let st;
  try { st = sanitize(JSON.parse(localStorage.getItem(KEY))); } catch { st = blank(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode: play on */ } onChange?.(api); };

  const multiplier = () => 1 + 0.1 * Math.min(Math.max(st.streak - 1, 0), 5);  // up to ×1.5 on a 6-day streak

  function addItem(id) { st.items[id] = (st.items[id] || 0) + 1; }
  function roll(luck = 0, r = Math.random) {
    const x = r();
    const tier = x < 0.01 + luck * 0.01 ? 'legendary' : x < 0.07 + luck * 0.03 ? 'epic' : x < 0.28 + luck * 0.05 ? 'rare' : 'common';
    const list = POOL[tier];
    return list[(r() * list.length) | 0];
  }

  // Grant XP/Credits (streak multiplier applies) and optional items. Returns what was actually given.
  function grant({ xp = 0, credits = 0, items = [], reason = '' }) {
    const k = multiplier();
    const gx = Math.round(xp * k), gc = Math.round(credits * k);
    const before = levelFor(st.xp).level;
    st.xp += gx;
    st.credits += gc;
    for (const id of items) {
      addItem(id);
      if (id === 'golden_shell') st.credits += 250;
    }
    st.log.unshift({ t: Date.now(), reason, xp: gx, credits: gc, items });
    st.log.length = Math.min(st.log.length, 40);
    save();
    const after = levelFor(st.xp).level;
    return { xp: gx, credits: gc, items, levelUp: after > before ? after : 0, multiplier: k };
  }

  // First completion pays; replays (going back to an earlier day, a second tap) do not.
  function grantOnce(key, reward) {
    if (st.claimed[key]) return null;
    st.claimed[key] = Date.now();
    return grant({ ...reward, reason: reward.reason || key });
  }
  const claimed = key => !!st.claimed[key];

  // Once per calendar day: streak, a daily gift and today's shells.
  function checkIn() {
    const today = localDate();
    if (st.lastDay === today) return null;
    const gap = st.lastDay ? daysBetween(st.lastDay, today) : null;
    st.streak = gap === 1 ? st.streak + 1 : 1;
    st.lastDay = today;
    if (!st.days.includes(today)) st.days.push(today);
    const first = st.days.length === 1;
    const items = [roll(Math.min(st.streak - 1, 4))];
    if (first) items.push('ticket', 'lei');                    // welcome gift
    if (st.streak >= 3 && st.streak % 3 === 0) items.push('ticket');
    const g = grant({ xp: 60 + 10 * Math.min(st.streak, 7), credits: 25 + 5 * Math.min(st.streak, 7), items, reason: first ? 'Welcome to Kona' : `Day ${st.streak} streak` });
    return { ...g, streak: st.streak, first };
  }

  // Race-week days that are open: one per distinct day played, at least up to today's Hawaiʻi date, plus tickets.
  function daysOpen(total) {
    const idx = daysBetween(WEEK_START, hawaiiDate());
    const real = idx > total ? total : idx + 1;
    return Math.max(1, Math.min(total, Math.max(st.days.length, real) + st.ticketsUsed));
  }
  function useTicket() {
    if (!(st.items.ticket > 0)) return false;
    st.items.ticket -= 1;
    st.ticketsUsed += 1;
    save();
    return true;
  }
  function nextOpening() {
    const t = new Date();
    t.setHours(24, 0, 0, 0);
    return t;
  }

  // Five shells a day at real town and beach spots, the same for everyone on that date.
  function todaysShells(spots) {
    const today = localDate();
    const r = rng(hashStr('shells' + today));
    const pool = spots.slice();
    const out = [];
    for (let i = 0; i < 5 && pool.length; i++) {
      const s = pool.splice((r() * pool.length) | 0, 1)[0];
      const id = `${today}:${i}`;
      out.push({ id, x: s.x + (r() - 0.5) * (s.spread || 20), y: s.y + (r() - 0.5) * (s.spread || 20), where: s.name, golden: r() < 0.08, found: (st.shells[today] || []).includes(id) });
    }
    return out;
  }
  function pickShell(sh) {
    const today = localDate();
    st.shells = { [today]: st.shells[today] || [] };           // keep only today's list
    if (st.shells[today].includes(sh.id)) return null;
    st.shells[today].push(sh.id);
    const items = sh.golden ? ['golden_shell'] : (Math.random() < 0.18 ? [roll(1)] : []);
    return grant({ xp: XP_FOR.shell, credits: 15 + Math.round(Math.random() * 20), items, reason: `Shell at ${sh.where}` });
  }
  function spotHonu(id) {
    if (st.honu[id]) return null;
    st.honu[id] = Date.now();
    const first = Object.keys(st.honu).length === 1;
    return grant({ xp: XP_FOR.honu, credits: 10, items: first ? ['honu_badge'] : [], reason: 'Honu sighting' });
  }
  function seePhase(id) {
    if (st.seenPhases.includes(id)) return null;
    st.seenPhases.push(id);
    const bonus = { build: ['coffee'], final: ['lei'], race: ['sunrise'], after: ['crawl'] }[id] || [];
    return grant({ xp: 80, credits: 30, items: bonus, reason: 'The island changed' });
  }

  const api = {
    get state() { return st; },
    get level() { return levelFor(st.xp); },
    get multiplier() { return multiplier(); },
    grant, grantOnce, claimed, checkIn, daysOpen, useTicket, nextOpening, todaysShells, pickShell, spotHonu, seePhase, roll,
    shellsFoundToday: () => (st.shells[localDate()] || []).length,
  };
  return api;
}
