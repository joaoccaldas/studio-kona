# Paused worlds: St. George and Las Vegas (paused 2026-09-28)

Owner decision: focus on Kona. These places return later as worlds unlocked by play
(proposal: St. George after finishing Kona race day or reaching level 20; Las Vegas after St. George).
Tracked in issue #22.

## St. George, Utah — IRONMAN 70.3 World Championship, 29 Oct 2022

| What | Where |
|---|---|
| Place module | `web/src/stgeorge.js` on branch `feat/aero-lab-rider` (1774a74, PR #2) |
| Registry, atlas projection, distance tests | branch `feat/world-atlas-st-george-2022` (568d814) |
| Ingest and packing | `tools/stgeorge/ingest_stgeorge.py`, `tools/stgeorge/pack_stgeorge.py` |
| Data | `data/stgeorge/`: DEM (AWS terrarium), OSM index, `sat_core.jpg`, `sat_course.jpg` |
| Web assets | `web/public/assets/stgeorge/`: 200² terrain, 159 building tiles (2 km), index files |
| Anchor | 37.0965, −113.5684; 180.5 km from the Bellagio, 4,534.6 km from Kailua Pier (`~/Downloads/WORLD/world.json`) |

State: aerial flyover from the Kona world switcher only. Missing: Sand Hollow swim, Snow Canyon
bike and run course lines, any gameplay. Imagery is Esri (development-only): swap before release.

## Las Vegas — Bellagio, Luxor and the Strip (30 Oct 2022)

| What | Where |
|---|---|
| Project | `~/Downloads/BELLAGIO_source` (**not in git**, local only) |
| Viewer | `web/src/{main,fountains,places}.js`, served on :8793 from `web/dist` (24 MB assets) |
| Blender | `blender/*.py`: tower, grounds, interiors, invented penthouse, Luxor, city massing, lightmap bake (`build.py`) |
| Docs | `HANDOVER.md` (self-score ≈45%), `EVIDENCE.md` (M/P/F/I/X ledger) |

State: best-looking asset because of the baked lighting; fog and exposure wash it out in the browser.
Kona should reuse `blender/build.py` now for its pier and town core (issue #14).

**Backup risk:** `BELLAGIO_source` exists only on this Mac. Import it into `places/vegas/` (or a private repo)
before further work (issue #21).
