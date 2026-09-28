// Invariants for the save and reward layer. Run: node --test web/test/
import test from 'node:test';
import assert from 'node:assert/strict';

class MemStore {
  constructor(init = {}) { this.m = new Map(Object.entries(init)); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  keys() { return [...this.m.keys()]; }
}
const save = await import('../src/save.js');
const { createRewards, sanitize } = await import('../src/rewards.js');
function fresh(init) { globalThis.localStorage = new MemStore(init); save._resetForTests(); return globalThis.localStorage; }

test('migrates the old stores into one v2 save and leaves them as a backup', () => {
  const ls = fresh({
    'kona-player-v1': JSON.stringify({ name: 'Aina', visits: 3, mask: 'data:image/png;base64,AAAA', last: { x: 1, y: 2 } }),
    'kona.game.save.v1': JSON.stringify({ currentDayIndex: 2, completedDays: ['fri2', 'sat3'], unlockedArtifacts: [], discoveredMemories: ['1982'] }),
    'kona-rewards-v1': JSON.stringify({ v: 1, xp: 500, credits: 120, items: { ticket: 1 }, days: ['2026-09-27'] }),
    'kona_hawaiian_scavenger_hunt_v1': JSON.stringify(['heiau']),
  });
  assert.equal(save.readSection('player').name, 'Aina');
  assert.deepEqual(save.readSection('player').last, { x: 1, y: 2 });
  assert.equal(save.readSection('player').mask, undefined, 'the mask moves out of the player');
  assert.equal(save.readFog(), 'data:image/png;base64,AAAA');
  assert.equal(save.readSection('campaign').currentDayIndex, 2);
  assert.deepEqual(save.readSection('heritage'), ['heiau']);
  assert.equal(sanitize(save.readSection('rewards')).credits, 120);
  const doc = JSON.parse(ls.getItem(save.SAVE_KEY));
  assert.equal(doc.v, 2);
  assert.equal(doc.migratedFrom.length, 4);
  assert.ok(ls.getItem('kona-player-v1'), 'old store kept');
});

test('a corrupt v2 save is copied aside and play continues', () => {
  const ls = fresh({ 'kona-save-v2': '{not json', 'kona.game.save.v1': JSON.stringify({ currentDayIndex: 1 }) });
  assert.equal(save.readSection('campaign').currentDayIndex, 1);
  assert.ok(ls.keys().some(k => k.startsWith('kona-save-v2.corrupt-')));
  assert.ok(JSON.parse(ls.getItem('kona-save-v2')).recovered);
});

test('invalid values are corrected on read', () => {
  fresh();
  save.writeSection('player', { name: 'A' });
  assert.equal(save.readSection('player'), null, 'a 1-letter name is not a player');
  save.writeSection('player', { name: 'Aina', visits: -3, country: 'nope', look: { helmet: 'hat', suit: 'red', bike: 'trek_sc_slr' } });
  const p = save.readSection('player');
  assert.equal(p.visits, 1);
  assert.equal(p.country, 'XX');
  assert.equal(p.look.helmet, 'helmet_longtail');
  assert.equal(p.look.suit, '#1d3557');
  assert.equal(p.look.bike, 'speedmax_cfr', 'an unfinished bike cannot be selected');
  save.writeSection('campaign', { currentDayIndex: 'x', completedDays: ['fri2', 'fri2', 3], pendingDay: 99, stats: { ride_m: -5 } });
  const c = save.readSection('campaign');
  assert.equal(c.currentDayIndex, 0);
  assert.deepEqual(c.completedDays, ['fri2']);
  assert.equal(c.pendingDay, null);
  assert.equal(c.stats.ride_m, 0);
  const r = sanitize({ xp: NaN, credits: -50, items: { ticket: 2, fake_item: 9 }, days: ['2026-09-28', 'bad'] });
  assert.equal(r.xp, 0);
  assert.equal(r.credits, 0);
  assert.deepEqual(r.items, { ticket: 2 });
  assert.deepEqual(r.days, ['2026-09-28']);
});

test('first-completion rewards pay exactly once, also across reloads', () => {
  fresh();
  const r1 = createRewards();
  const g = r1.grantOnce('pack:first', { xp: 200, credits: 80 });
  assert.ok(g);
  assert.equal(r1.grantOnce('pack:first', { xp: 200, credits: 80 }), null, 'a replay pays nothing');
  const credits = r1.state.credits;
  save._resetForTests();                       // simulate a reload from storage
  const r2 = createRewards();
  assert.equal(r2.grantOnce('pack:first', { xp: 200, credits: 80 }), null, 'a reload pays nothing');
  assert.equal(r2.state.credits, credits);
  assert.ok(r2.grantOnce('pack:medal:gold', { xp: 150, credits: 20 }), 'a better medal is a separate, one-time claim');
  assert.equal(r2.grantOnce('pack:medal:gold', { xp: 150, credits: 20 }), null);
});

test('daily check-in happens once per day and race-week days open one per day played', () => {
  fresh();
  const r = createRewards();
  assert.ok(r.checkIn(), 'first check-in of the day pays');
  assert.equal(r.checkIn(), null, 'second check-in the same day does not');
  const total = 11;
  const open = r.daysOpen(total);
  assert.ok(open >= 1 && open <= total);
  r.state.items.ticket = 1;
  assert.ok(r.useTicket());
  assert.equal(r.daysOpen(total), Math.min(total, open + 1));
  assert.equal(r.useTicket(), false, 'no ticket, no skip');
});
