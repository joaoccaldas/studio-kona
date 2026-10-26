// Unit tests for the pure physics/fit modules in web/src/aerolab (node, no browser).
import assert from 'node:assert/strict';
import * as aero from '../web/src/aerolab/aero.mjs';
import * as fit from '../web/src/aerolab/fit.mjs';
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('PASS', name); };
const model = { base: .23, deltas: { rearDisc: -.004, shield: 0, aerofuel: 0, frontBottle: 0, rearBottles: 0 } };

t('air density at ISA sea level ~1.22 kg/m3', () => { const r = aero.density(15, 1013.25, 0); assert.ok(r > 1.21 && r < 1.23, r); });
t('humid air is lighter than dry air', () => assert.ok(aero.density(30, 1013.25, 90) < aero.density(30, 1013.25, 0)));
t('drag grows with the square of air speed', () => {
  const a = aero.forces({ ...aero.DEFAULT_AIR, speed: 20 }, model, aero.STOCK).drag, b = aero.forces({ ...aero.DEFAULT_AIR, speed: 40 }, model, aero.STOCK).drag;
  assert.ok(Math.abs(b / a - 4) < 1e-9, b / a);
});
t('250 W on the flat at CdA 0.23 solves to ~41 km/h', () => { const v = aero.solveSpeed(aero.DEFAULT_AIR, model, aero.STOCK); assert.ok(v > 39 && v < 43, v); });
t('a rear disc (assumed -0.004 m2) saves watts and time', () => {
  const r = aero.compare(aero.DEFAULT_AIR, model, model, { ...aero.STOCK, rearDisc: true }, aero.STOCK);
  assert.ok(r.wattsSaved > 0 && r.timeSaved > 0, JSON.stringify(r));
});
t('yaw outside the assumed +-25 deg range returns no result', () => assert.equal(aero.forces({ ...aero.DEFAULT_AIR, speed: 10, crosswind: 30 }, model, aero.STOCK), null));
t('CSV parser rejects a bad header', () => assert.throws(() => aero.parseCurve('yaw,cda\n0,0.2\n5,0.21')));
t('CSV parser sorts rows and interpolates', () => { const c = aero.parseCurve('yaw_deg,cda_m2\n10,0.24\n0,0.22'); assert.ok(Math.abs(aero.interpolate(c, 5) - 0.23) < 1e-12); });
t('default fit is reachable with a static BDC knee angle of 25-35 deg', () => { const a = fit.assess(fit.DEFAULT_FIT); assert.ok(a.reachable, JSON.stringify(a)); assert.ok(a.kneeBDC >= 25 && a.kneeBDC <= 35, a.kneeBDC); });
t('saddle solver targets ~30 deg knee flexion inside the published M range', () => {
  const r = fit.fitSaddle(fit.DEFAULT_FIT); assert.ok(r && Math.abs(r.check.kneeBDC - 30) < 1.5, JSON.stringify(r && r.check));
  assert.ok(r.fit.saddle >= 70.8 && r.fit.saddle <= 83.8);
});
t('projected frontal area is positive and plausible (0.2-0.6 m2)', () => { const a = fit.cycleArea(fit.DEFAULT_FIT); assert.ok(a > .2 && a < .6, a); });
console.log(`\n${n} passed`);
