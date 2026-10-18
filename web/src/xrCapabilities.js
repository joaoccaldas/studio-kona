/**
 * Capability discovery only. This module never requests an immersive session.
 * Calling requestSession must remain behind an explicit user gesture.
 * A successful isSessionSupported check does not mean hardware QA has passed.
 */
export async function probeXRSupport(env = globalThis) {
  const nav = env.navigator;
  const result = {
    secureContext: env.isSecureContext === true,
    xrAvailable: Boolean(nav?.xr),
    immersiveVR: false,
    immersiveAR: false,
    errors: []
  };
  if (!result.secureContext) {
    result.errors.push('WebXR requires a secure context (HTTPS or supported localhost).');
  }
  if (!nav?.xr || typeof nav.xr.isSessionSupported !== 'function') {
    return result;
  }
  for (const [mode, field] of [
    ['immersive-vr', 'immersiveVR'],
    ['immersive-ar', 'immersiveAR']
  ]) {
    try {
      result[field] = Boolean(await nav.xr.isSessionSupported(mode));
    } catch (error) {
      result.errors.push(mode + ': ' + String(error?.message || error));
    }
  }
  return result;
}
