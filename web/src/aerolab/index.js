// Aero lab + rider fit: standalone modules extracted from the Speedmax museum.
// Deliberately NOT imported by the Kona world (web/src/main.js). See README.md in this folder.
export { createStreamlines, BIKE_OBSTACLES, riderObstacles } from './streamlines.js';
export { makeChamber } from './chamber.js';
export { makeLab } from './labPanel.js';
export { makeRider } from './rider/rider.js';
export * as aero from './aero.mjs';
export * as fit from './fit.mjs';
