# KONA — IRONMAN World Championship world (plan)

Goal: an immersive, evidence-based 3D world of Kailua-Kona for the **IRONMAN World Championship, Saturday 10 Oct 2026**
(men and women racing together again; pros start 06:25 HST), explorable on phones, laptops and in VR (WebXR).
It is one module of a larger triathlon app, and it lives in the shared `WORLD` next to the Bellagio (4,369.6 km away, unbuilt between).

## 1. Race facts (evidence)

| Leg | Fact | Class | Source |
|---|---|---|---|
| Swim | 2.4 mi / 3.8 km clockwise out-and-back in Kailua Bay, deep-water start east of Kailua Pier (Dig Me Beach), parallel to the Ali'i Drive coast | P | IRONMAN course notes via Big Island Guide, 220 Triathlon, Quintana Roo |
| Swim | turn at the Body Glove and Jack's Diving boats after **1,840 m**; **1,970 m** back to the pier | P | 220 Triathlon, Quintana Roo |
| Swim | buoys yellow and orange (one colour out, the other back), red at turns; all buoys on the right | P | same |
| Swim | Royal Kona Resort ("large white tiered building") on the left ≈ 1,000 m out | F | Quintana Roo; OSM puts it 1,030 m from the pier (361 m left of the fitted axis) |
| T1/T2 | transition on Kailua Pier; 2026 layout being redesigned for more athletes | P | Big Island Guide |
| Bike | pier → Palani Rd → Makala Blvd / Kuakini Hwy → Queen Ka'ahumanu Hwy → Hāwī and back (112 mi) | P | Big Island Guide, Wikipedia |
| Run | pier → Palani → Kuakini → Hualālai Rd → Ali'i Dr → Queen K → Energy Lab (NELHA) → finish on Ali'i Dr | P | Big Island Guide |
| Records | Lange 7:35:53 (2024), Charles-Barclay 8:24:31 (2023) | P | Wikipedia |

## 2. Map, mapped and indexed

- Frame: origin = Kailua Pier (19.639162, −155.996808), metres, +X east, +Y north.
- `data/map_index.json`: 200 m cells **A1…I9** over the 1.8 km detailed frame (A = west, 1 = north). Master plate `renders/kona_master_map.jpg`.
- Layers: `sat_core.jpg` (0.56 m/px, 1.8 km), `sat_bay.jpg` (4.5 m/px, 6 km), `osm_index.json` (883 buildings, 961 roads, 181 paths, coastline, beaches, pier, 195 trees, 292 POIs), `dem.npy` (12 × 12 km, 10 m grid, land + bathymetry).
- `data/swim_axis.json`: course axis fitted to the OSM coastline, bearing 161.3°, start (40, −35), turn (631, −1778).

| Zone | Cells | Contents | Phase |
|---|---|---|---|
| Z1 Swim & Kailua Bay | E2–I9 + south strip | ocean, reef and sand floor from bathymetry, buoy lines, turn boats, marine life | **P1** |
| Z2 Kailua Pier / transition | F2–G2 | pier deck, swim exit stairs, change tents, bike racks, bike-out ramp, arches | **P1** |
| Z3 Dig Me Beach / Kamakahonu / Ahuʻena Heiau | E2–F2 | beach, heiau platform and thatched hale, King Kamehameha hotel | **P1** |
| Z4 Ali'i Drive seawall + finish line | G2–H3 | seawall spectator line, finish chute and arch | P2 |
| Z5 Palani Rd | F1–H1 | climb out of town (bike out / run) | P2 |
| Z6 Kailua Village | G1–I4 | Hulihe'e Palace, Moku'aikaua Church, shops, banyans | P2 |
| Z7 Ali'i Drive south | I4 → Keauhou | run course along the ocean | P4 |
| Z8 Kuakini / Makala / Queen K town section | north-east | bike and run connectors | P3 |
| Z9 Queen K lava corridor → Hāwī | 90 km | streamed 1 km tiles, lava fields, wind, heat haze | P3 |
| Z10 Energy Lab (NELHA) | ~10 km north | run turnaround | P4 |
| Z11 Hāwī | ~90 km north | bike turnaround | P3 |

## 3. Build phases

- **P0 Evidence + index** — done (this folder).
- **P1 Swim + transition (now)**: terrain and seafloor from DEM + coastline; physically based ocean; reef; buoy course from the fitted axis; turn boats; Kailua Pier with a transition layout; Dig Me Beach; Ahuʻena Heiau; shoreline buildings from OSM; trees; race-morning sky (sunrise behind Hualālai).
- P2 Ali'i Drive finish, Palani, Kailua Village.
- P3 Bike course corridor (streamed), Hāwī.
- P4 Run course, Energy Lab.
- P5 Athlete layer for the app: GPS-track ghosts, splits, live tracking hook (data supplied by the app; no scraping).
- P6 VR comfort and device QA.

## 4. Performance: phones and ordinary laptops first

| Tier | Target devices | Budget | Techniques |
|---|---|---|---|
| **L** | mid phones, old iGPU | ≤ 150 draw calls, ≤ 350k tris, DPR ≤ 1.25, first load ≤ 12 MB | baked lightmaps (KTX2/ETC1S 2k), ocean = analytic normal waves + env reflection, no post |
| **M** | laptops (Intel/Apple iGPU) | ≤ 400 draws, ≤ 900k tris | 2k–4k lightmaps, Gerstner ocean, FXAA, light bloom |
| **H** | desktop GPU, Quest/PC VR | ≤ 1.5M tris, 72–90 fps VR | 4k lightmaps, planar-ish reflections, underwater caustics, MSAA |

- Auto-tier: GPU string + a 2 s warm-up benchmark, then **dynamic resolution** to hold 60 fps (72/90 in XR).
- Streaming: 200 m cells (the map index) as glTF chunks with LOD0/LOD1; distant cells use the 4.5 m/px imagery drape.
- Lighting is baked in Cycles (no real-time shadows); dynamic items (water, flags, athletes) use cheap shading.
- Textures: KTX2 (Basis) via `gltf-transform`; geometry meshopt + quantisation (`gltfpack`).

## 5. VR (WebXR)

Enter VR from any viewpoint; teleport + optional smooth locomotion; comfort vignette; seated "boat" and "swim" rides
(the swim ride follows the buoy line at race pace, head at water level with above/below-water split view).

## 6. App integration

- Ships as an ES module + web component `<kona-world>` with a small API: `goTo(place)`, `setTime(iso)`,
  `setAthletes(tracks)`, `onSelect(cb)`; also works in an iframe.
- Coordinates in and out are WGS84; the component converts to the local frame.

## 7. Evidence rules

Same classes as the Bellagio (M/P/F/I/X), recorded in `EVIDENCE.md`. The 2026 transition layout is not published yet,
so it is modelled from prior-year photos and marked **I** until IRONMAN releases the athlete guide.
