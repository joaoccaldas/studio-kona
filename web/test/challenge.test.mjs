// Invariants for the challenge framework (issue #26). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

class MemStore {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
const save = await import('../src/save.js');
const ch = await import('../src/challenge.js');
const { createRewards } = await import('../src/rewards.js');
function fresh() { globalThis.localStorage = new MemStore(); save._resetForTests(); }

const def = ch.defineChallenge({
  id: 'test_tangle', name: 'Test Tangle', medals: { gold: 20, silver: 30, bronze: 45 },
  rewards: { first: { xp: 100, credits: 40 }, bronze: { xp: 20, credits: 5 }, silver: { xp: 40, credits: 10 }, gold: { xp: 80, credits: 20 } },
});
const run = (elapsed, penalties = []) => ({ finished: true, elapsed, penalties, at: 1 });

test('medal thresholds must rise gold < silver < bronze', () => {
  assert.throws(() => ch.defineChallenge({ id: 'bad', medals: { gold: 30, silver: 20, bronze: 40 } }));
  assert.equal(ch.medalFor(def, 19.9), 'gold');
  assert.equal(ch.medalFor(def, 30), 'silver');
  assert.equal(ch.medalFor(def, 45.01), null);
});

test('score is elapsed plus penalties; unfinished or implausible runs are not valid', () => {
  assert.equal(ch.scoreOf(run(18, [{ s: 5, why: 'helmet' }])), 23);
  assert.equal(ch.validRun({ ...run(10), finished: false }), false);
  assert.equal(ch.validRun(run(0.2)), false, 'too fast to be real');
  assert.equal(ch.validRun(run(10, [{ s: -5, why: 'x' }])), false, 'negative penalties cannot buy time');
});

test('PB and delta: a slower replay keeps the best, a faster one improves it', () => {
  let r = ch.recordRun(null, def, run(28));
  assert.equal(r.first, true); assert.equal(r.pb, true); assert.equal(r.delta, null); assert.equal(r.medal, 'silver');
  r = ch.recordRun(r.record, def, run(31));
  assert.equal(r.first, false); assert.equal(r.pb, false); assert.equal(r.delta, 3); assert.equal(r.record.best, 28);
  r = ch.recordRun(r.record, def, run(19));
  assert.equal(r.pb, true); assert.equal(r.delta, -9); assert.equal(r.record.bestMedal, 'gold'); assert.equal(r.newMedal, true);
  assert.equal(r.record.runs, 3); assert.equal(r.record.finishes, 3);
});

test('rewards: first finish and each medal tier pay once; replays never farm', () => {
  fresh();
  const rewards = createRewards();
  const a = ch.submitRun('test_tangle', run(40), { rewards });          // bronze
  assert.deepEqual(a.grants.map(g => g.xp), [100, 20]);
  const b = ch.submitRun('test_tangle', run(40), { rewards });          // same again
  assert.equal(b.grants.length, 0, 'identical replay pays nothing');
  const c = ch.submitRun('test_tangle', run(15), { rewards });          // first gold also opens silver
  assert.deepEqual(c.grants.map(g => g.xp), [40, 80]);
  const credits = rewards.state.credits;
  save._resetForTests();                                                  // reload
  const d = ch.submitRun('test_tangle', run(12), { rewards: createRewards() });
  assert.equal(d.grants.length, 0, 'nothing after a reload either');
  assert.equal(createRewards().state.credits, credits);
  assert.equal(ch.recordFor('test_tangle').best, 12);
  const e = ch.submitRun('test_tangle', { finished: false, elapsed: 5, penalties: [] }, { rewards: createRewards() });
  assert.equal(e.valid, false); assert.equal(e.grants?.length ?? 0, 0);
  assert.equal(ch.recordFor('test_tangle').runs, 5, 'abandoned runs are counted but pay nothing');
});

test('arena records are validated on read', () => {
  fresh();
  save.writeSection('arena', { test_tangle: { best: -3, bestMedal: 'platinum', runs: 'x' }, 'BAD ID!': { best: 1 } });
  const a = save.readSection('arena');
  assert.deepEqual(Object.keys(a), ['test_tangle']);
  assert.equal(a.test_tangle.best, null);
  assert.equal(a.test_tangle.bestMedal, null);
  assert.equal(a.test_tangle.runs, 0);
});

test('daily seed is the same for everyone on a date and differs across days', () => {
  // Hawaiʻi days: 3 Oct HST runs from 10:00 UTC on the 3rd to 10:00 UTC on the 4th.
  const d1 = new Date(Date.UTC(2026, 9, 3, 11)), d1b = new Date(Date.UTC(2026, 9, 4, 9)), d2 = new Date(Date.UTC(2026, 9, 4, 11));
  assert.equal(ch.dailySeed('x', d1), ch.dailySeed('x', d1b));
  assert.notEqual(ch.dailySeed('x', d1), ch.dailySeed('x', d2));
  const r1 = ch.rng(42), r2 = ch.rng(42);
  assert.equal(r1(), r2());
});
