// The Ride Map: eight bike mini-games along the Kona course, each a different skill, each scored to 3 stars.
// Pure data and rules (no DOM, no three.js), unit-tested. Stars unlock the next level and pay once.

// better: 'high' → more is better; 'low' → less is better (times). stars are the 1/2/3-star thresholds.
export const LEVELS = [
  { id: 'handoff', n: 1, name: 'Bottle Hand-off', where: 'Aid station · Queen K', zone: 'queenk', skill: 'Timing', icon: '🥤',
    blurb: 'Volunteers hold out bottles, gels and sponges. Grab exactly what you called for, right as your hand meets theirs.',
    how: ['Tap left or right to pick your side of the road', 'Press GRAB when the marker hits the green', 'Only grab what the call says'],
    unit: 'pts', better: 'high', stars: [18, 30, 40] },
  { id: 'gap', n: 2, name: 'Legal Gap', where: 'Queen K · the long drag', zone: 'queenk', skill: 'Pace control', icon: '📏',
    blurb: 'No drafting in Kona. Hold the legal gap to the rider ahead while they surge and ease off.',
    how: ['Hold anywhere to push harder, let go to ease off', 'Stay in the green band: 12–20 m back', 'The red zone is drafting: three cards and you are out'],
    unit: '%', better: 'high', stars: [55, 72, 86] },
  { id: 'crosswind', n: 3, name: 'Crosswind Gates', where: 'Hāwī climb', zone: 'hawi', skill: 'Balance', icon: '🌬️',
    blurb: 'The Hāwī winds shove you sideways. Steer through the flag gates without getting blown off line.',
    how: ['Drag left or right to steer (arrow keys on a keyboard)', 'Watch the wind arrow and lean into it', 'Ride between the coral flags'],
    unit: 'gates', better: 'high', stars: [12, 18, 22] },
  { id: 'descent', n: 4, name: 'Hāwī Descent', where: 'Kohala mountain road', zone: 'kohala', skill: 'Braking', icon: '⛰️',
    blurb: 'Downhill at 70 km/h. Brake late, carry the most speed into every corner, but never over its limit.',
    how: ['Hold anywhere to brake, let go to let the bike run', 'Enter each corner at or just under its limit', 'Too fast and you run wide'],
    unit: 'pts', better: 'high', stars: [560, 760, 880] },
  { id: 'honu', n: 5, name: 'Honu Spotter', where: 'Kawaihae coast', zone: 'coast', skill: 'Observation', icon: '🐢',
    blurb: 'An easy spin along the coast. Snap the sea life before it slips away, but not the rocks pretending to be turtles.',
    how: ['Tap an animal to take its photo', 'Whales and golden honu are rare and worth the most', 'Rocks and logs cost points'],
    unit: 'pts', better: 'high', stars: [14, 24, 34] },
  { id: 'flatfix', n: 6, name: 'Flat Fix', where: 'Energy Lab road', zone: 'energylab', skill: 'Hands', icon: '🔧',
    blurb: 'Pssssst. Rear flat. Change the tube against the clock, and find the thorn or it flats again.',
    how: ['Follow the steps: lever, wheel, tyre, thorn, tube, air', 'Hold the CO₂ and let go in the green', 'Find the thorn before the new tube goes in'],
    unit: 's', better: 'low', stars: [60, 42, 30] },
  { id: 'heat', n: 7, name: 'Energy Lab Heat', where: 'Natural Energy Lab', zone: 'energylab', skill: 'Management', icon: '🌡️',
    blurb: 'The hottest place on the course. Keep your core cool and your tank full through the Energy Lab.',
    how: ['Tap left or right to change lanes', 'Ice and sponges cool you, gels and cola refuel you', 'Keep both meters in the green'],
    unit: 's', better: 'high', stars: [28, 42, 54] },
  { id: 'highfive', n: 8, name: 'Aliʻi High-Fives', where: 'Aliʻi Drive finish chute', zone: 'alii', skill: 'Rhythm', icon: '🙌',
    blurb: 'The whole town is out. Hit every high-five on the beat all the way to the finish line.',
    how: ['Tap the left or right side as a hand reaches you', 'Both hands out? Tap both sides together', 'Keep the chain for the crowd roar'],
    unit: 'pts', better: 'high', stars: [60, 90, 112] },
];
export const levelById = id => LEVELS.find(l => l.id === id) || null;
export const MAX_STARS = LEVELS.length * 3;

export function starsFor(level, score) {
  if (!level || !Number.isFinite(score)) return 0;
  const [a, b, c] = level.stars;
  const ok = t => (level.better === 'low' ? score <= t : score >= t);
  return ok(c) ? 3 : ok(b) ? 2 : ok(a) ? 1 : 0;
}

// Level 1 is always open; each later level opens once the one before it has at least one star.
export function isUnlocked(levels, id) {
  const l = levelById(id);
  if (!l) return false;
  if (l.n === 1) return true;
  const prev = LEVELS[l.n - 2];
  return (levels?.[prev.id]?.stars || 0) >= 1;
}
export const totalStars = levels => LEVELS.reduce((a, l) => a + (levels?.[l.id]?.stars || 0), 0);
// Where "Play" takes you: the first open level without a star, else the first open level short of three stars.
export function nextLevel(levels) {
  const open = LEVELS.filter(l => isUnlocked(levels, l.id));
  return open.find(l => !(levels?.[l.id]?.stars)) || open.find(l => (levels?.[l.id]?.stars || 0) < 3) || open[open.length - 1];
}

// Fold a finished attempt into the record. Returns the new record plus the stars earned for the first time.
export function recordLevel(levels, id, score) {
  const l = levelById(id);
  const prev = levels?.[id] || { stars: 0, best: null, plays: 0 };
  const stars = starsFor(l, score);
  const better = prev.best == null || (l.better === 'low' ? score < prev.best : score > prev.best);
  const rec = { stars: Math.max(prev.stars, stars), best: better ? score : prev.best, plays: prev.plays + 1 };
  const newStars = [];
  for (let k = prev.stars + 1; k <= stars; k++) newStars.push(k);
  return { levels: { ...levels, [id]: rec }, stars, newStars, pb: better && prev.best != null, first: prev.plays === 0 };
}
// Credits and XP paid the first time each star of a level is reached (grantOnce keys make it pay once).
export const STAR_REWARD = { 1: { credits: 30, xp: 40 }, 2: { credits: 40, xp: 60 }, 3: { credits: 70, xp: 100 } };
export const starKey = (id, k) => `level:${id}:star${k}`;

export function validLevels(v) {
  const out = {};
  if (!v || typeof v !== 'object') return out;
  for (const l of LEVELS) {
    const r = v[l.id];
    if (!r || typeof r !== 'object') continue;
    const stars = Math.min(3, Math.max(0, Math.floor(Number(r.stars) || 0)));
    const best = Number.isFinite(r.best) && r.best >= 0 ? r.best : null;
    out[l.id] = { stars, best, plays: Math.max(0, Math.floor(Number(r.plays) || 0)) };
  }
  return out;
}
