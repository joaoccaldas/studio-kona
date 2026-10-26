# XR foundation / first release gate

Status: **capability probe drafted; no production XR integration or physical headset certification**.
This document complements existing PLAN.md §5 and HANDOVER.md; it does not supersede them.

## Evidence and current state (2026-10-18)
- `web/src/main.js` explicitly sets `renderer.xr.enabled = false`; existing first-person, swim and orbit modes use desktop-oriented inputs.
- PLAN.md describes future WebXR teleport, optional smooth movement, comfort vignette and seated modes. These are **requirements**, not passed tests.
- HANDOVER.md explicitly reports that real phones, low-end iGPUs and headsets were not tested at the time of writing.
- `web/src/xrCapabilities.js` is a side-effect-free browser capability probe. It is intentionally **not wired** into the production renderer. First audit every render loop and input controller.
- Commercial use: ESRI imagery, OSM attribution/share-alike and sports marks require separate legal review (HANDOVER.md).

## Product scenarios (shared spatial core, separate delivery profiles)
| Benchmark | Source | Browser acceptance | XR acceptance | Business hypothesis |
|---|---|---|---|---|
| Architecture | licensed room/building | correct scale, material changes, navigation | teleport, no unintended camera motion, stable frames | faster stakeholder approval |
| Furniture | licensed furniture/room | configuration, bounding dimensions, responsive UI | real-world scale, supported AR placement; browser fallback | higher product understanding |
| Premium product | licensed bike | rotate, recolor, inspect, enter room | inspect at scale, safe interaction distances | more engaged qualified buyers |

A visually pleasing scene does NOT establish physically valid daylight, engineering, energy, wind, safety or accessibility simulation.

## Required architecture contracts
1. Canonical scene records contain asset ID, source hash, owner/license, source coordinate system, meters-per-unit, bounds, transforms, materials, interactions, semantic tags, variants and dependency hashes.
2. Keep canonical scene data independent of WebGL/Three.js, Godot/OpenXR and offline-rendering adapters. glTF/GLB is a delivery format; evaluate OpenUSD composition on one scene before migration.
3. Render configurations are per runtime/device class, not silent edits to canonical assets.
4. Preserve meaningful interaction verbs (select, inspect, configure, teleport, annotate) separate from controller/button bindings.
5. Never upload restricted customer, mapping or personal spatial data into cross-customer knowledge graphs.

## Work order / gates
**G0. Inventory before build.** Locate existing XR adapters, camera loops, rig transforms, controllers, teleport mechanics, session events, benchmark scripts, and relevant projects. Produce references to source code and versions. The canonical spatial-platform repository may differ from this repository.

**G1. Preserve desktop.** Establish baseline screenshots, navigation, keyboard/touch, build and performance metrics at 375/768/1280/1920 widths. Resolve existing spatial-studio desktop QA failures separately; do not treat Kona tests as substitutes.

**G2. Probe and prototype.** Test capability probing for secure/no-XR, VR-only, AR-only, both and rejected promise cases. Only then integrate a **user-initiated** enter/exit VR control behind feature detection. Three.js requires `renderer.xr.enabled = true` and `renderer.setAnimationLoop`; never run a competing `requestAnimationFrame` loop during XR. Preserve one canonical simulation update.

**G3. XR transforms.** Verify coordinate-system conversion (survey east/north/up -> Three.js), world scale, floor height, player rig, near/far planes, seated/standing reset and teleport destinations against measured fixtures.

**G4. Comfort and accessibility.** Teleport first; snap turn; seated/standing options; usable controller rays; readable text; clear exit and recovery; no mandatory smooth locomotion. No guaranteed comfort claims.

**G5. Performance.** Capture device identifier/mode (with privacy controls), refresh rate, frame-time percentiles, GPU/CPU timing when available, memory proxy, draws, triangles, texture bytes, startup time and failure modes. Target stable native refresh on the reference device; record actual measured numbers rather than assumed 72/90 FPS.

**G6. Physical hardware.** Test entry/exit, controllers, recenter, floor level, simulator differences, low-light tracking, browser fallback and long-session stability on an actual headset. Failure = no public VR launch.

**G7. Asset portability.** Use one licensed architectural scene to test Blender source -> glTF/GLB -> WebGL/XR, then a Godot/OpenXR import if customers require it. Record geometry/material/animation/metadata parity and manual repair hours.

**G8. Buyer test.** At least five relevant buyers across architecture/furniture/product categories; record use-case, decision maker, baseline workflow, willingness to pay and pilot follow-up. Blind-rater evidence should be analyzed separately from willingness-to-pay evidence.

## Release evidence contract
Each benchmark run stores: scene hash, source commit, renderer version, device/OS/browser, input method, resolution, runtime flags, timestamp, measured results, test protocol, screenshots with rights metadata, reviewer, anomalies, pass/fail and confidence.

No release can claim 'XR-ready' from the probe alone. Require automated checks, manual headset test evidence, cleared critical failures and commercial asset permission.

References:
- https://threejs.org/docs/pages/WebXRManager.html
- https://threejs.org/manual/pages/webxr-basics.html
- https://registry.khronos.org/OpenXR/
- https://registry.khronos.org/glTF/
