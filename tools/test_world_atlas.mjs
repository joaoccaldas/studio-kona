import assert from 'node:assert/strict';
import fs from 'node:fs';
import { enrichPlaces, haversineKm } from '../web/src/worldAtlas.js';

const registry = JSON.parse(fs.readFileSync(new URL('../data/world_places.json', import.meta.url), 'utf8'));
const places = enrichPlaces(registry);
const byId = id => places.find(p => p.id === id);

assert.equal(registry.coordinateSystem, 'WGS84');
assert.equal(byId('st-george-utah').snapshot, '2022-10');
assert.equal(byId('bellagio-las-vegas').state, 'local_unpushed');

const vegasToStGeorge = haversineKm(byId('bellagio-las-vegas'), byId('st-george-utah'));
assert.ok(vegasToStGeorge > 175 && vegasToStGeorge < 185, `Bellagio→St George = ${vegasToStGeorge}`);

const vegasToKona = haversineKm(byId('bellagio-las-vegas'), byId('kailua-kona'));
assert.ok(vegasToKona > 4350 && vegasToKona < 4390, `Bellagio→Kona = ${vegasToKona}`);

const st = byId('st-george-utah');
assert.ok(st.local.east > 130 && st.local.east < 150, `St George east = ${st.local.east}`);
assert.ok(st.local.north > 100 && st.local.north < 115, `St George north = ${st.local.north}`);

console.log('world atlas smoke: PASS');
console.log({
  vegasToStGeorgeKm: Number(vegasToStGeorge.toFixed(1)),
  vegasToKonaKm: Number(vegasToKona.toFixed(1)),
  stGeorgeLocalKm: {
    east: Number(st.local.east.toFixed(1)),
    north: Number(st.local.north.toFixed(1))
  }
});
