// Kona Rush rules. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
class MemStore { constructor() { this.m = new Map(); } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
const save = await import('../src/save.js');
const R = await import('../src/rushRules.js');
const { createRewards } = await import('../src/rewards.js');
function fresh() { globalThis.localStorage = new MemStore(); save._resetForTests(); }

test('upgrades change stats and cost Credits through the ledger', () => {
  fresh();
  const rewards = createRewards();
  rewards.grant({ credits: 200 });
  let g = R.blankGarage();
  assert.equal(R.statsFor(g.levels).topSpeed, 1);
  g = R.buy(g, 'wheels', rewards);
  assert.equal(g.levels.wheels, 1);
  assert.equal(rewards.state.credits, 50);
  assert.ok(R.statsFor(g.levels).topSpeed > 1);
  assert.equal(R.buy(g, 'wheels', rewards), null, 'level 2 costs 400: cannot afford');
  assert.equal(rewards.state.log[0].credits, -150, 'spend is in the ledger');
  g.levels.fuel = R.MAX_LEVEL;
  assert.equal(R.nextCost('fuel', g.levels.fuel), null, 'maxed out');
});

test('zones, medals and score', () => {
  assert.equal(R.zoneAt(0).id, 'queenk');
  assert.equal(R.zoneAt(3).id, 'hawi');
  assert.equal(R.zoneAt(9.9).id, 'alii');
  assert.equal(R.medalFor(1), null);
  assert.equal(R.medalFor(5.2), 'silver');
  assert.equal(R.medalFor(10), 'finish');
  assert.ok(R.scoreRun({ km: 3, passes: 10 }) > R.scoreRun({ km: 3, passes: 10, cards: 2 }));
  assert.ok(R.creditsFor({ km: 4, passes: 20, rings: 10 }) >= 60);
});

test('daily missions: three per day, same for everyone, progress and completion', () => {
  const a = R.missionsFor('2026-10-03'), b = R.missionsFor('2026-10-03'), c = R.missionsFor('2026-10-04');
  assert.equal(a.list.length, 3);
  assert.deepEqual(a.list.map(x => x.id), b.list.map(x => x.id));
  assert.notDeepEqual(a.list.map(x => x.id), c.list.map(x => x.id));
  assert.equal(new Set(a.list.map(x => x.stat)).size, 3, 'one mission per stat');
  let m = a;
  for (let i = 0; i < 20; i++) m = R.applyRunToMissions(m, { km: 3, passes: 20, rings: 15, bestCombo: 16, cards: 0 }, '2026-10-03');
  assert.ok(m.list.every(x => x.done), JSON.stringify(m.list));
  const next = R.applyRunToMissions(m, { km: 1, passes: 1, rings: 1, bestCombo: 1, cards: 1 }, '2026-10-04');
  assert.equal(next.day, '2026-10-04');
  assert.ok(next.list.every(x => !x.claimed), 'a new day starts fresh');
});

test('garage is validated on read', () => {
  fresh();
  save.writeSection('garage', { levels: { wheels: 99, helmet: -2, fuel: 'x' }, best: -5, runs: 3.7, missions: { day: 1 } });
  const g = save.readSection('garage');
  assert.deepEqual(g.levels, { wheels: R.MAX_LEVEL, helmet: 0, fuel: 0 });
  assert.equal(g.best, 0);
  assert.equal(g.runs, 3);
  assert.equal(g.missions, null);
});
