import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, COSMETICS, blankProgress, unlockedCards, unlockedCosmetics, met, hint, validAlmanac, DEFAULT_LOOK, CATEGORIES } from '../src/lore.js';

test('catalog is well formed', () => {
  assert.ok(CARDS.length >= 40);
  assert.equal(new Set(CARDS.map(c => c.id)).size, CARDS.length);
  for (const c of CARDS) assert.ok(CATEGORIES[c.cat], c.id);
  for (const slot of Object.keys(DEFAULT_LOOK)) assert.ok(COSMETICS.some(c => c.id === DEFAULT_LOOK[slot] && c.slot === slot));
});

test('a brand new player starts with a few cards and the default look', () => {
  const p = blankProgress();
  const cards = unlockedCards(p);
  assert.ok(cards.includes('course') && cards.includes('w_aloha'));
  assert.ok(cards.length < 5);
  const cos = unlockedCosmetics(p);
  for (const id of Object.values(DEFAULT_LOOK)) assert.ok(cos.includes(id), id);
});

test('rules: places, eggs, levels, distances, stars', () => {
  const p = { ...blankProgress(), places: ['nelha', 'ahuena'], eggs: ['underpants'], levels: { gap: { stars: 2 }, handoff: { stars: 3 } }, walkKm: 3.2, rideKm: 11 };
  const cards = unlockedCards(p);
  for (const id of ['energylab', 'heiau', 'underpants', 'draft', 'aid', 'w_kokua', 'palani', 'fuel', 'queenk']) assert.ok(cards.includes(id), id);
  assert.ok(!cards.includes('pele'));
  assert.ok(met({ stars: 5 }, p) && !met({ stars: 6 }, p));
  assert.ok(unlockedCosmetics(p).includes('suit_underpants'));
});

test('card-count rules resolve after the rest', () => {
  const lots = { ...blankProgress(), days: 9, streak: 9, walkKm: 9, rideKm: 20, swimM: 500 };
  assert.ok(unlockedCards(lots).includes('w_okina'));
});

test('hints read well and the save validates', () => {
  assert.equal(hint({ walk: 3 }), 'Walk 3 km on the island');
  assert.equal(hint({ place: 'nelha' }, { places: { nelha: 'the Energy Lab' } }), 'Discover the Energy Lab');
  const v = validAlmanac({ eggs: ['underpants', 5, 'underpants'], walkM: -3, look: { suit: 'suit_lava', helmet: 'nope' } });
  assert.deepEqual(v.eggs, ['underpants']);
  assert.equal(v.walkM, 0);
  assert.equal(v.look.suit, 'suit_lava');
  assert.equal(v.look.helmet, DEFAULT_LOOK.helmet);
});
