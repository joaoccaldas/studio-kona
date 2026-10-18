import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.template.html', import.meta.url), 'utf8');

test('large Kona world uses depth precision protection', () => {
  assert.match(main, /logarithmicDepthBuffer:\s*true/);
  assert.match(main, /PerspectiveCamera\(55,[\s\S]*420000\)/);
});

test('mobile adaptive resolution is capped for stable play', () => {
  assert.match(main, /const maxDpr = Math\.min\(devicePixelRatio, coarse \? 1\.35 : 2\)/);
  assert.match(main, /dpr = Math\.min\(maxDpr, dpr \+ \(coarse \? 0\.05 : 0\.1\)\)/);
});

test('mobile active play hides nonessential navigation chrome', () => {
  assert.match(html, /body\.walking #navWrap,[\s\S]*body\.walking #flightBtn,[\s\S]*body\.walking #winnersBtn\{display:none!important\}/);
  assert.match(html, /body\.walking #questCard[\s\S]*right:78px/);
  assert.match(html, /body\.walking #actionPrompt[\s\S]*bottom:calc\(78px/);
});
