# Kona: project description and roadmap

Updated 28 Sep 2026. Race week opens Fri 2 Oct; race day is Sat 10 Oct 2026 (pros 06:25 HST).
Owner: João Caldas. Repository: `joaoccaldas/studio-kona` (public).

## 1. What this is

A mobile-first 3D game of Kailua-Kona for triathletes, built around the IRONMAN World Championship week. You land at
Kona airport, ride into town, and live race week day by day. You swim Kailua Bay, ride the Queen K, run Aliʻi Drive, find
Hawaiian heritage sites, and meet the history of the race: champions, records and bikes. The island changes as the week
goes on. It starts quiet, the town builds up, race day fills the course, and then it winds down. Rewards bring you back
each day.

It is built on real data, not an invented island. Terrain, coastline, roads, buildings and courses come from public
sources, and every element carries an evidence class (M measured, P published, F photographed, I inferred, X invented).
That truthfulness is the product's edge. Nobody else offers a Kona you can ride that matches the real one.

Kona is the only active world. St. George (70.3 Worlds 2022) and Las Vegas (Bellagio) are built in part and paused.
They return later as worlds unlocked by play (`docs/PAUSED_WORLDS.md`).

## 2. What has been done, and why

| When | What | Why |
|---|---|---|
| 27 Sep | Evidence base for the bay: imagery, OSM, DEM + bathymetry, swim axis, routed bike and run courses, 25 geocoded places | Everything else is placed on this data |
| 27 Sep | Blender core tile (pier, transition, heiau, buoys, 954 OSM buildings), whole-island mesh, 79 streamed tiles | One pipeline: Python survey → Blender → glTF → Three.js |
| 27–28 Sep | Walk, ride and swim; Canyon bike museum on the pier; Hawaiian heritage hunt; winners hall with 48 sourced champions | Things to do and learn on the island |
| 28 Sep a.m. | Landing gate (name, Kona visits), KOA airport arrival, persistent fog of war, flights board, real-date race week (2–12 Oct) | The arrival fantasy, and a reason to explore |
| 28 Sep | **Audit** (`docs/AUDIT_2026-09-28.md`): ≈35% ready; public site 404; newest work uncommitted; no economy; phone HUD unusable | Establish the truth before building more |
| 28 Sep | Committed and pushed all local work; milestones + issues #3–#22; `PROGRESS.md`; St. George and Vegas documented and paused | GitHub is the source of truth; nothing lives only on this Mac |
| 28 Sep p.m. | **Living island**: Blender asset kit (22 assets, 0.63 MB); five phases that change the island with the race-week day | "Make the island come alive and evolve" |
| 28 Sep p.m. | **Rewards**: XP/levels, Credits, streak (up to ×1.5), rare items, 5 daily shells, honu etiquette, Fast-forward tickets, one new day per day played | Reasons to come back tomorrow, and to progress faster |
| 28 Sep p.m. | Fixes: terrain file name, ordinal text, desktop HUD overlap, phone speed bar and toasts, route ribbons hiding athletes | Found in screenshot review |

Screenshots of the current build: `renders/life/` (phone 390×844 and desktop 1440×900, 60 fps in headless Chrome on
this Mac). Kit previews: `renders/kit_preview_big.jpg`, `renders/kit_preview_life.jpg`. Visual audit with earlier
screenshots: https://claude.ai/artifact/T2ydZ5fq5L1ykDungHibNy (private).

## 3. How it is built

```
Public data ──► tools/*.py (ingest, tiles, island) ──► blender/*.py (headless build) ──► glTF + JSON + JPG
   OSM, NAIP/Esri, AWS terrain, Commons refs           p1.py core tile, kit.py assets      web/public/assets/
                                                                                              │
web/src/*.js (Three.js 0.186, esbuild) ──► web/public/index.html (single bundle) ──► static hosting (GitHub Pages)
```

- **Geometry and look**: Blender builds everything procedurally from Python, so it is reproducible and versioned.
  The Bellagio project adds baked lighting (Cycles lightmaps); porting that to Kona is the biggest visual upgrade still open.
- **Runtime**: one static page. No server is required except the optional flights proxy in `web/serve.py`.
- **Progress**: stored on the device for now (`kona-player-v1`, the quest save, `kona-rewards-v1`). Accounts come next (#13).

### Key source files (repo paths)

| File | Role |
|---|---|
| `web/src/main.js` | App shell: renderer, load, quests, HUD, frame loop, wiring of every module |
| `web/src/islandLife.js` | Living island: places kit assets on real data, phase changes, moving athletes, shells, honu |
| `web/src/rewards.js` | XP, Credits, streak, items, daily shells, day gating (`kona-rewards-v1`) |
| `web/src/lifeHud.js` | Wallet chip, island dispatch, bag, next-day gate |
| `web/src/explore.js` | Landing gate data, KOA arrival, fog-of-war mask |
| `web/src/weekCampaign.js` | Race week 2–12 Oct from `data/raceweek.json` |
| `web/src/progress.js`, `gameQuests.js`, `raceweek.js` | Challenges and older quest scripts (to be merged, #5) |
| `web/src/locomotion.js` | Walk, bike, swim, touch stick |
| `web/src/pierMuseumStudio.js`, `winnersHall.js`, `hawaiianScavengerHunt.js` | Museum, champions, heritage |
| `web/src/tiles.js`, `flights.js` | Tile streaming; KOA flights board |
| `web/index.template.html`, `web/build.mjs` | HTML/CSS template; build → `web/public/index.html` |
| `blender/kit.py` | Living-island asset kit → `web/public/assets/kit/kona_kit.glb` |
| `blender/p1.py`, `survey.py`, `export.py`, `preview.py` | Core tile build, survey, GLB export, Cycles previews |
| `tools/ingest.py`, `tiles.py`, `island.py`, `imagery.py`, `mapplate.py` | Data ingest, tiles, island mesh, open imagery, map plates |
| `data/` | Evidence: OSM, DEM, routes, geocodes, race week, reference photo sources |
| `docs/` | `PROJECT.md` (this), `AUDIT_2026-09-28.md`, `ISLAND_LIFE.md`, `PAUSED_WORLDS.md` |
| `PROGRESS.md`, `HANDOVER.md`, `PLAN.md` | Tracker, older handover, original plan |

## 4. Where everything is

### On this Mac

| Path | What | Git |
|---|---|---|
| `~/Developer/studio-kona-live` | **The active game.** Branch `feat/raceweek-live` | Clean, pushed |
| `~/Downloads/WORLD/kona` | Older checkout on `feat/aero-lab-rider` (St. George + aero lab). Its local server on :8791 serves this older build | Clean, pushed |
| `~/Downloads/WORLD/world.json`, `README.md` | Shared world registry (Kona, St. George, Vegas anchors and distances) | **Not in git** |
| `~/Downloads/BELLAGIO_source` | Las Vegas (Bellagio, Luxor, Strip), paused; server on :8793 | **Not in git: only copy** |
| `~/Developer/speedmax-cfr-3d` | Canyon museum (7 exhibits), MakeHuman CC0 rider avatar, fit and aero lab | **Not in git** |
| `~/Developer/trek-tri-museum-3d` | Trek museum; Speed Concept SLR gen 3 mesh; contains copyrighted reference photos | **Not in git; must stay private** |
| `~/Developer/triatlas` | TriAtlas EN + PT-BR SEO site (48 champions, bios, feeds) | Initialised, 0 commits |
| `~/Projects/performance-os` | Phoenix: PKCE OAuth + JWT + Postgres pattern (reference for accounts) | Separate project |
| `/tmp/konashots/` | Earlier screenshot run (temporary; lost on reboot) | — |

The web build uses `web/node_modules`, a local link to `~/Downloads/BELLAGIO_source/web/node_modules`. It is no longer
tracked in git (it broke GitHub Pages). CI must run `npm ci` instead (#3).

### On GitHub (`joaoccaldas/studio-kona`)

| Ref | What |
|---|---|
| `main` (0f34a7b) | Old; what Pages serves. Pages has returned 404 since 27 Sep because of the tracked symlink |
| `feat/raceweek-live` | **Newest**: everything above. Draft **PR #23** into main |
| `p0/truth-and-terrain` | Draft PR #1 (included in #23) |
| `feat/aero-lab-rider` | Draft PR #2: aero lab, rider fit, St. George place (paused) |
| `feat/world-atlas-st-george-2022` | St. George registry and tests (paused) |
| Issues #3–#22, 5 milestones | The roadmap below, with evidence and "done when" on each issue |

## 5. Roadmap: next steps and why

Ordered by what makes the game playable and fun before race week, then deeper.

| # | Step | Issue | Why now |
|---|---|---|---|
| 1 | Review and merge PR #23; add a GitHub Actions build (`npm ci`, `node build.mjs`) and deploy `web/public` | #3 | Nobody can play today: the public URL is 404. Merging is the owner's call because it goes live |
| 2 | Test on a real iPhone and Android phone; fix what breaks | #4, #8 | Everything so far is headless Chrome on a Mac. Phones are the main audience |
| 3 | Kona town shop + locker: spend Credits on paint, kit, helmet, wheels, coffee and shave-ice boosts | #12 | Credits have nothing to buy yet, so rewards feel hollow without somewhere to spend them |
| 4 | Pack for Kona (level 0), with consequences at check-in | #9 | A strong first 90 seconds that is useful to real athletes (it exports a real checklist) |
| 5 | Pier racks fill with sourced museum bikes, by brand and era | #11 | The visible collection on the pier is the reason to come back |
| 6 | One quest system and one versioned save | #5, #6 | Two calendars confuse players, and split saves block accounts |
| 7 | Accounts: guest play → magic link / Google / Apple (Supabase), server-checked rewards ledger | #13, #10 | Progress and streaks need to survive a phone change; rewards need to be trustworthy before leaderboards |
| 8 | Race-day live mode, Sat 10 Oct 06:25 HST: compressed race on the real courses, champion ghost, share card | #16 | The biggest moment of the year for the audience |
| 9 | Ground and buildings: bake lighting (from the Bellagio pipeline), façade atlases, lower route ribbons further or fade them at street level | #14, #19 | Street level is the weakest part of the look |
| 10 | Commit the open-imagery swap and rebuild tiles | #18 | Esri imagery is development-only and must not ship publicly |
| 11 | Back up `BELLAGIO_source`, `speedmax-cfr-3d`, `trek-tri-museum-3d`, `triatlas` to **private** repos | #21 | They exist only on this Mac; the Trek folder must never be public |
| 12 | Launch TriAtlas (EN + PT-BR) and link it to the game | — | Search traffic from "Kona 2026 start time", "who won Kona", and champion names brings players |
| 13 | After Kona: new regions (South Kona, beaches, Volcano, Maunakea), avatar customisation, PWA then app stores | #20, #21 | Depth for players who stay after race week |
| 14 | 2027: St. George and Las Vegas as unlockable worlds; race-pack format for Roth, Nice, T100 | #22 | Growth beyond one race, on the same engine |

## 6. Decisions waiting on the owner

1. Merge PR #23 into `main` (puts the site live once CI is added).
2. Which Supabase project to use for accounts (recommended: a new one for the game only).
3. Currency name ("Credits" for now; a Hawaiian word needs a cultural review first).
4. Brand names and photos on the pier racks in a public repo.
5. Private GitHub repos for the four folders that are not backed up.

## 7. How to run locally

```bash
cd ~/Developer/studio-kona-live
blender -b --factory-startup --python-exit-code 1 -P blender/kit.py      # asset kit (seconds)
cd web && node build.mjs                                                  # bundle -> public/index.html
cd public && python3 -m http.server 8796 --bind 127.0.0.1                # open http://127.0.0.1:8796/
```
