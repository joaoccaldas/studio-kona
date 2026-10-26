# Studio-Kona 3D Scale Baseline R1

Status: research-only branch.

## Purpose
Turn Studio-Kona into the canonical outdoor/world-scale benchmark for the unified 3D program.

## Baseline scene requirements
Use one deterministic route/camera path that exercises:
- >=1 km traversable path where current world extent permits;
- terrain;
- road;
- water;
- vegetation;
- multiple landmarks;
- walking and cycling;
- near/mid/far detail;
- at least one lighting/weather state.

## Capture protocol
Record:
- commit SHA;
- browser/runtime;
- device;
- viewport;
- DPR;
- quality tier;
- cache state;
- warm-up;
- fixed camera/path.

Measure:
- FPS mean;
- frame time p50/p95/p99;
- draw calls;
- triangles;
- transferred bytes;
- time to first useful frame;
- memory where observable;
- traversal stalls;
- renderer/context errors;
- visual pop / LOD artifacts.

## Do not optimize yet
First capture a trustworthy baseline.

## Follow-on experiments
1. distance-banded quality;
2. chunk/world partitioning;
3. route-ahead prefetch;
4. unload hysteresis;
5. vegetation instancing/HLOD;
6. landmark HERO override;
7. weather/light quality tiers.

## Success criterion
The world must become visually richer while frame stability and memory behavior improve or remain within target budgets.