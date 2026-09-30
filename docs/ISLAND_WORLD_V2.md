# Island World V2

This branch keeps **Studio Kona** independent from CanyonMuseum. No CanyonMuseum state, runtime modules, commerce, museum UI, or app data are imported.

## What this adds

The existing repository already has a strong Kailua core and a 159 km whole-island DEM shell. V2 introduces a progressive-detail island registry and a Blender generation layer for the rest of Hawaiʻi Island.

### Detail hierarchy

- **Hero**: Kailua-Kona, Mauna Kea, Mauna Loa, Kīlauea.
- **High**: Hualālai, Hāwī, Kona airport, NELHA/Energy Lab, Keauhou, Old Kona Airport.
- **Medium**: Waikoloa, Kawaihae, Waimea, Hilo.
- **Corridor streaming**: Queen K, Aliʻi Drive, Palani, Energy Lab and Hāwī course approaches.

The rule is simple: the player should never see an empty island, but expensive geometry exists only where proximity, race relevance, or narrative importance justifies it.

## Source policy

Production should prefer public/open sources:

- Hawaiʻi Statewide GIS / open-data layers for imagery, hillshade, LiDAR and public GIS where available.
- USGS 3DEP / USGS volcano products for terrain and geological reference.
- OpenStreetMap for roads, buildings and POIs, with required ODbL attribution.
- Poly Haven CC0 PBR materials for basalt/rock/ground references.

The current ESRI imagery path remains development-only and swappable.

## Blender

Run:

```bash
blender -b existing_scene.blend --python blender/island_world_v2.py
```

The script reads `data/island_world_v2.json`, creates geographically positioned collections and low-cost scene proxies, and tags inferred objects with evidence metadata. These proxies are designed to be replaced zone-by-zone with measured geometry, not frozen as final art.

## Next geometry passes

1. Replace Kailua town proxies with the existing core model and extend the high-detail coastline south through Keauhou.
2. Build the Queen K corridor as streamed 1 km chunks: asphalt, shoulders, utility poles, lava fields, sparse vegetation, heat-haze markers.
3. Build Hāwī turnaround and Kohala vegetation/weather transition.
4. Replace volcano proxies using higher-resolution public DEM/LiDAR and geological masks.
5. Add Hilo, Waimea and Waikoloa urban/vegetation instancing from OSM + land-cover data.
6. Bake materials and lightmaps, then meshopt/KTX2 per device tier.

## Performance target

The island remains a layered world, not one huge GLB:

- Ring 3: whole-island terrain shell.
- Ring 2: race corridors + major towns/volcanoes.
- Ring 1: local 500 m tiles.
- Ring 0: hero micro-scenes such as Kailua Pier.

This preserves the existing mobile-first performance budget while allowing much more visual density.
