# KONA world — handover (2026-09-27)

Immersive, evidence-based 3D world of Kailua-Kona for the **IRONMAN World Championship, Sat 10 Oct 2026**
(men + women together again, pros 06:25 HST). One module of a larger triathlon app; lives in the shared
`~/Downloads/WORLD` next to the paused Bellagio (4,369.6 km away, unbuilt between — see `../README.md`, `../world.json`).
Plan: `PLAN.md`. Must run on phones and integrated-GPU laptops; WebXR as an enhancement.

## State in one paragraph

Evidence base complete for the bay (imagery, OSM, DEM/bathymetry, indexed master map). A hand-built core tile
(pier + transition, Ahuʻena Heiau, buoy course, turn boats, 171 buildings, reef seabed) exports from Blender to a GLB.
A Three.js viewer shows the **whole island** (DEM + imagery), all three race courses routed on real roads, 21 labelled
main points, race-morning sky computed for 10 Oct 2026, an ocean shader, a swim ride, and a "Day Before" itinerary.
79 Ring-1 tile packs (500 m, 0.56 m imagery, terrain, OSM buildings) and a first-person walk/swim mode with the
Coffee Boat objective are **built but not yet tested in the browser**.

## Folder map

| Path | What |
|---|---|
| `data/` | Evidence: `osm_*.osm` → `osm_index.json` (954 buildings, 1,160 roads, 228 trees, 310 POIs; ODbL), `sat_core.jpg` (0.56 m/px, 1.8 km), `sat_bay.jpg` (4.5 m/px, 6 km), `dem.npy` (12 × 12 km, 10 m, land + bathymetry), `map_index.json` (200 m cells A1–I9), `swim_axis.json`, `geocodes.json` (25 main points), `routes.json` (bike 186.7 km, run 42.6 km via OSRM), `ref/` (22 Commons photos + `sources.json`). |
| `tools/ingest.py` | OSM → local metres, ESRI imagery (export + tile stitching), terrarium DEM. Origin: Kailua Pier 19.639162, −155.9968082. |
| `tools/mapplate.py` | Indexed master map + relief plate → `renders/`. |
| `tools/island.py` | Whole island: 159 km square, 2048² height (packed PNG) + imagery → `web/public/assets/island_*`. |
| `tools/tiles.py` | Ring-1 tile packs → `web/public/assets/tiles/` (`index.json`, `t_i_j.json`, `img_i_j.jpg`). |
| `blender/survey.py` | Loads evidence; coastline signed distance; buoys, turn boats, swim line (fitted axis bearing 161.3°, 1,840 m out / 1,970 m back). |
| `blender/p1.py` | Core tile: terrain + seabed, OSM buildings (roof colour sampled from imagery), pier + transition (580 racked bikes, tents, carpet), heiau, buoys, boats, canoes, palms, solar position. |
| `blender/preview.py`, `blender/export.py` | Cycles previews; GLB export → `web/public/assets/kona_p1.glb` + `kona_manifest.json`. |
| `web/src/main.js`, `tiles.js`, `index.template.html`, `build.mjs` | Viewer (node_modules symlinked from the Bellagio project). `node build.mjs` → `web/public/index.html`. |
| `renders/` | `kona_master_map.jpg`, `kona_relief.jpg`, `ref_contact.jpg`. |

## Run

```bash
cd ~/Downloads/WORLD/kona
blender -b --python blender/export.py            # core GLB + manifest (~30 s)
python3 tools/tiles.py                           # Ring-1 tiles (~3 min, needs network)
cd web && node build.mjs && cd public && python3 -m http.server 8791 --bind 127.0.0.1
# open http://localhost:8791   (port 8766 is used by another local service — leave it)
```

## Verified vs not

- **Verified in the browser** (screenshots taken): core tile with orthophoto, buildings, pier, racks; whole island with
  correct relief; bike/run/swim courses visible from altitude; labels; itinerary panel; 60 fps at 1.45–2× DPR on this Mac.
- **Built, not yet run**: tile streaming (`tiles.js`), walk/run/swim mode, Coffee Boat objective, touch stick.
- **Not tested at all**: real phones, low-end iGPUs, WebXR on a headset.

## Evidence notes (see `PLAN.md` §1)

- Swim geometry: published leg lengths (1,840 / 1,970 m), clockwise, buoy colours; axis fitted to the OSM coast and
  cross-checked with the Royal Kona Resort (≈1,000 m, on the left). Buoy spacing, lane gap, boat positions: inferred.
- Transition layout is **inferred** from prior years (2026 redesign not published). Only 580 bikes fit my rack pattern; the real field is ~2,000+.
- Building heights: 33 tagged, the rest inferred by type. Roof colours: measured from imagery.
- Routes: OSRM on OSM roads through course waypoints; in-town turns and the Ali'i run turnaround are inferred (run 42.6 vs 42.2 km, bike 186.7 vs 180.2 km).
- Race-week schedule (Underpants Run, Parade of Nations, opening ceremony, check-ins) was **not yet verified for 2026** — search started, sources: Big Island Guide, SportPlan, IRONMAN pages.

## Licensing — must resolve before public launch

- ESRI World Imagery is used for development only; a public/commercial app needs a licensed source (ArcGIS account, Mapbox, or public-domain USGS imagery). Keep imagery swappable (`tools/*`).
- OpenStreetMap: ODbL — show "© OpenStreetMap contributors"; share-alike applies to derived databases.
- AWS Terrain Tiles: attribution per the dataset's terms. Wikimedia photos: reference only, not shipped.
- "IRONMAN" is a trademark: no logos used; confirm the app's rights before using the name in UI.

## Next steps (in order)

1. Load the page, fix tile streaming + walk/swim; take screenshots (add a tiny POST `/snap` endpoint so screenshots save to `renders/` and can be shared).
2. Verify the 2026 race-week schedule; turn the itinerary into a **race-week game**: practice swims + Coffee Boat, athlete check-in, IRONMAN Village, Parade of Nations, Underpants Run (Ali'i Drive), opening ceremony, bike + gear-bag check-in on the pier, race morning.
3. Ring 2 corridor: Queen K road surface and lava fields, Energy Lab, Hāwī; Ali'i Drive seawall and shops (photo evidence in `data/ref`).
4. Performance: KTX2 textures, gltfpack quantisation, tile LOD, device QA on a phone.
5. Bake lighting for the core (reuse the Bellagio `build.py` approach) for higher quality at the same cost.

## Known issues

- Core-tile far terrain (`KONA_far`) is hidden in favour of the island mesh; the DEM coastline outside the core tile is coarse.
- Ocean is a single shader (no reflections of buildings); underwater view not implemented.
- Everything north of the tile ring is the 76 m island mesh only.
- Background server on 8791 may still be running from this session.
