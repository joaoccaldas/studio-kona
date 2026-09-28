# WORLD atlas — St. George October 2022 continuation

Status: **scaffolded on `feat/world-atlas-st-george-2022`** from the tested `p0/truth-and-terrain` branch.

## Why this branch exists

The local IDE session reports Bellagio exterior+interiors, Luxor exterior, and Las Vegas Strip block massing, but those changes are not present in GitHub yet. Editing the same renderer blindly from GitHub would risk overwriting local work.

This branch therefore adds the shared geospatial layer only. It can be merged or cherry-picked into the richer local WORLD viewer without touching Bellagio geometry, Kona terrain, locomotion, progression, museum, or the Aero Lab branch.

## Registry

`data/world_places.json` is the single registry for current world nodes:

| Node | Snapshot | GitHub state |
|---|---|---|
| Bellagio | Oct 2022 | local/unpushed geometry |
| Luxor | Oct 2022 | local/unpushed exterior |
| St. George, Utah | Oct 2022 | atlas node scaffolded |
| Kailua-Kona | 10 Oct 2026 | implemented |

St. George is approximately **180.5 km** geodesic distance from the Bellagio anchor. Kona is approximately **4,369.5 km** from Bellagio.

## Integration contract

`web/src/worldAtlas.js` is deliberately renderer-agnostic.

- `haversineKm(a,b)`: truth-preserving geographic distance.
- `localKm(place, anchor)`: regional east/north kilometres for the Las Vegas → St. George map.
- `enrichPlaces(registry)`: resolves local positions and anchor distances.
- `getPlace(registry,id)`: strict lookup.

The Las Vegas → St. George placement is regional. Kona must remain a separate streamed world origin or use a globe/portal layer, rather than forcing thousands of kilometres into the same Three.js floating-point scene.

## Next reconstruction pass

1. Pull the local Bellagio/Luxor viewer changes into this branch or rebase this atlas layer onto the IDE branch.
2. Render St. George first as an evidence-labelled regional node at the correct geographic location.
3. Build an October 2022 evidence pack before detailed reconstruction: dated aerial/street imagery, OSM historical diffs where available, roads, downtown massing, terrain/DEM, key venues and the route relevant to the 2022 memory timeline.
4. Keep every reconstructed feature classified as measured/published/fitted/inferred/unknown, matching the existing evidence rules.
5. Only after the evidence pack passes review, replace the St. George node with streamed terrain and detailed tiles.

## Verification

Run:

```bash
node tools/test_world_atlas.mjs
```

Expected: `world atlas smoke: PASS`.
