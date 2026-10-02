# St. George place (data + viewer pack)

As it stood race weekend, 29 Oct 2022 (IRONMAN 70.3 World Championship).

- tools/stgeorge/ingest_stgeorge.py  : OSM (ODbL) + ESRI imagery + AWS terrarium DEM -> data/stgeorge/
- tools/stgeorge/pack_stgeorge.py    : compacts to viewer pack -> web/public/assets/stgeorge/
- web/src/stgeorge.js               : STG terrain (200x200 decimetre heightgrid) + 2 km OSM-massing tiles, streamed
- web/public/assets/stgeorge/        : st_terrain.json, st_b_i_j.json x159, sat_core/sat_course.jpg, dem.npy, *_meta.json

Anchor 37.0965, -113.5684 (downtown finish). Race: Sand Hollow swim -> Snow Canyon bike -> downtown run.
Local frame +X east +Y north metres; mounts at its own local origin in the kona viewer (per WORLD/manifesto).
