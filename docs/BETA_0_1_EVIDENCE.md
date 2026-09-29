# Kona Beta 0.1 visual / flow evidence

Updated 29 Sep 2026.

This branch deliberately improves **existing play** rather than adding geography.

## Changes in this pass

1. **Mobile depth stability**
   - Three.js renderer now uses `logarithmicDepthBuffer: true`.
   - Reason: Kona mixes close bike/road surfaces with a very large world/camera range, which is a classic precision condition for z-fighting. The symptom reported on mobile was floor/surface blinking while moving.
   - Regression test: `web/test/beta_visual_contract.test.mjs`.

2. **Frame-rate-first mobile rendering**
   - Mobile starts at 1.15 DPR and is capped at 1.35 DPR.
   - Existing adaptive resolution remains, but can no longer rise to 2 DPR on coarse/mobile devices after a short high-FPS window.
   - Thresholds use 47 fps to step down and 59 fps to step up conservatively.
   - Product rule: stable motion beats extra pixels during interactive 3D play.

3. **World-first phone HUD**
   - While locomotion is active, secondary navigation (viewpoint bar, Flights, Winners) is hidden.
   - Objective collapses to a small state strip.
   - Context action and movement control remain available.
   - Non-play screens retain the broader navigation.

## Evidence standard

A change is not called improved only because it looks plausible in source. The branch must pass:

- `npm test`
- `npm run check:data`
- `npm run build`
- CI on the integration PR
- then a real Android smoke test before Beta 0.1 is considered release-green.

The existing branch already contains headless gameplay screenshots and metrics under `renders/`. This pass adds automated regression checks specifically for the reported depth/phone-UI problems.
