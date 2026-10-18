// Economy and clock invariants. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

class MemStore { constructor() { this.m = new Map(); } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
const save = await import('../src/save.js');
const { createRewards } = await import('../src/rewards.js');
const { hstDay, nextHstMidnight } = await import('../src/clock.js');
function fresh() { globalThis.localStorage = new MemStore(); save._resetForTests(); }

test('the ledger always equals the wallet change, including a golden cowrie', () => {
  fresh();
  const r = createRewards();
  const before = r.state.credits;
  const g = r.grant({ xp: 25, credits: 20, items: ['golden_shell'], reason: 'shell' });
  assert.equal(g.credits, 270, 'the returned grant includes the cowrie value');
  assert.equal(r.state.credits - before, 270);
  assert.equal(r.state.log[0].credits, 270, 'the log entry includes it too');
  r.grant({ xp: 10, credits: 5, items: ['coffee'] });
  const logged = r.state.log.reduce((a, e) => a + e.credits, 0);
  assert.equal(logged, r.state.credits, 'sum of the log = balance');
});

test('one Hawaiʻi clock: the day flips at 10:00 UTC, not at local midnight', () => {
  assert.equal(hstDay(Date.UTC(2026, 9, 10, 9, 59)), '2026-10-09');
  assert.equal(hstDay(Date.UTC(2026, 9, 10, 10, 0)), '2026-10-10');
  assert.equal(nextHstMidnight(Date.UTC(2026, 9, 10, 9, 0)).toISOString(), '2026-10-10T10:00:00.000Z');
  assert.equal(nextHstMidnight(Date.UTC(2026, 9, 10, 12, 0)).toISOString(), '2026-10-11T10:00:00.000Z');
});
