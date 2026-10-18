import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// The source is authored for esbuild ESM. Use a data: URL so tests do not
// depend on whether the parent repository declares "type": "module".
const source = await readFile(new URL('../web/src/xrCapabilities.js', import.meta.url), 'utf8');
const { probeXRSupport } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('unsupported XR reports disabled modes without exceptions', async () => {
  const r = await probeXRSupport({ isSecureContext: true, navigator: {} });
  assert.equal(r.xrAvailable, false);
  assert.equal(r.immersiveVR, false);
  assert.equal(r.immersiveAR, false);
});
test('insecure context explains the block', async () => {
  const r = await probeXRSupport({ isSecureContext: false, navigator: {} });
  assert.match(r.errors.join(' '), /secure context/);
});
test('VR-only support does not imply AR', async () => {
  const r = await probeXRSupport({ isSecureContext: true,
    navigator: { xr: { isSessionSupported: async mode => mode === 'immersive-vr' } } });
  assert.equal(r.immersiveVR, true);
  assert.equal(r.immersiveAR, false);
});
test('AR-only and dual-mode report independently', async () => {
  const xr = supported => ({ isSecureContext: true,
    navigator: { xr: { isSessionSupported: async mode => supported.includes(mode) } } });
  const ar = await probeXRSupport(xr(['immersive-ar']));
  assert.equal(ar.immersiveVR, false); assert.equal(ar.immersiveAR, true);
  const both = await probeXRSupport(xr(['immersive-vr', 'immersive-ar']));
  assert.equal(both.immersiveVR, true); assert.equal(both.immersiveAR, true);
});
test('rejected support query is recorded rather than thrown', async () => {
  const r = await probeXRSupport({ isSecureContext: true,
    navigator: { xr: { isSessionSupported: async mode => {
      if (mode === 'immersive-vr') throw new Error('blocked');
      return true;
    } } } });
  assert.equal(r.immersiveVR, false);
  assert.equal(r.immersiveAR, true);
  assert.match(r.errors.join(' '), /blocked/);
});
test('probe does not request an immersive session', async () => {
  let requests = 0;
  await probeXRSupport({ isSecureContext: true,
    navigator: { xr: { isSessionSupported: async () => true,
      requestSession: async () => { requests++; } } } });
  assert.equal(requests, 0);
});
