import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, starsFor, isUnlocked, nextLevel, recordLevel, validLevels, totalStars, levelById } from '../src/rideLevels.js';

test('eight levels, each a different skill, thresholds ordered by direction', () => {
  assert.equal(LEVELS.length, 8);
  assert.equal(new Set(LEVELS.map(l => l.skill)).size, 8);
  for (const l of LEVELS) {
    const [a, b, c] = l.stars;
    assert.ok(l.better === 'low' ? a > b && b > c : a < b && b < c, l.id);
  }
});

test('stars for high and low scoring', () => {
  const hi = levelById('gap'), lo = levelById('flatfix');
  assert.equal(starsFor(hi, 10), 0);
  assert.equal(starsFor(hi, 55), 1);
  assert.equal(starsFor(hi, 99), 3);
  assert.equal(starsFor(lo, 90), 0);
  assert.equal(starsFor(lo, 41), 2);
  assert.equal(starsFor(lo, 20), 3);
});

test('unlocking follows the previous level', () => {
  assert.ok(isUnlocked({}, 'handoff'));
  assert.ok(!isUnlocked({}, 'gap'));
  assert.ok(isUnlocked({ handoff: { stars: 1 } }, 'gap'));
  assert.equal(nextLevel({}).id, 'handoff');
  assert.equal(nextLevel({ handoff: { stars: 2 } }).id, 'gap');
});

test('recording keeps the best, pays each star once', () => {
  let r = recordLevel({}, 'handoff', 31);
  assert.deepEqual(r.newStars, [1, 2]);
  r = recordLevel(r.levels, 'handoff', 20);
  assert.deepEqual(r.newStars, []);
  assert.equal(r.levels.handoff.best, 31);
  assert.equal(r.levels.handoff.stars, 2);
  r = recordLevel(r.levels, 'handoff', 45);
  assert.deepEqual(r.newStars, [3]);
  assert.ok(r.pb);
  assert.equal(totalStars(r.levels), 3);
  const t = recordLevel({}, 'flatfix', 50);
  assert.equal(recordLevel(t.levels, 'flatfix', 35).levels.flatfix.best, 35);
});

test('validation drops junk', () => {
  assert.deepEqual(validLevels({ handoff: { stars: 9, best: -1, plays: 2 }, nope: { stars: 3 } }), { handoff: { stars: 3, best: null, plays: 2 } });
  assert.deepEqual(validLevels(null), {});
});
