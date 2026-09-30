# Full-Island Rendering Strategy

Goal: a visually continuous 3D Hawaiʻi Island before race day, without forcing every square meter into expensive hero geometry.

## Rule

Full 3D is used where shape and interaction matter. Hybrid rendering is used where perception matters more than geometry.

### Full 3D
Use for:
- race landmarks and transition spaces
- dense pedestrian areas
- famous landmarks
- hospitals / critical services that users may navigate to
- bike shops / maintenance points
- selected restaurants, shops and meeting points
- airports, harbors and other unmistakable silhouettes

### Hybrid 3D
Use OSM/GIS footprints + procedural facades + roof generators + vegetation instancing for:
- town centers
- commercial corridors
- residential areas near roads
- industrial areas
- resort districts

### Terrain-first
Use DEM displacement + geology/land-cover textures + instancing for:
- volcanoes
- lava fields
- forest
- pasture
- agricultural slopes
- remote coast
- undeveloped interior

### Distant rendering
Use:
- low-poly terrain LODs
- baked albedo/normal maps
- tree/building impostors
- atmospheric haze
- cloud layers

The user should never encounter a visually empty region merely because it lacks hero geometry.

## Coverage target

Before race day:
1. 100% island terrain coverage.
2. 100% major-road corridor coverage.
3. 100% named important-place representation.
4. Hero treatment for race-critical and high-value places.
5. No direct dependency on live external APIs for base world rendering.
6. Persistent user state is independent from streamed geometry.
