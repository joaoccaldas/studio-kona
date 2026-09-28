// Shared WORLD atlas helpers.
// Intentionally renderer-agnostic so Bellagio/Luxor and Kona can consume one geospatial registry.

const EARTH_RADIUS_KM = 6371.0088;

const rad = d => d * Math.PI / 180;

export function haversineKm(a, b) {
  const lat1 = rad(a.lat), lat2 = rad(b.lat);
  const dLat = lat2 - lat1;
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Stable local projection for regional world-map scenes.
// Returns kilometres east/north from anchor. Suitable for Las Vegas <-> St. George.
// Do not use this as a global terrain projection for Kona.
export function localKm(place, anchor) {
  const meanLat = rad((place.lat + anchor.lat) / 2);
  const north = rad(place.lat - anchor.lat) * EARTH_RADIUS_KM;
  const east = rad(place.lon - anchor.lon) * EARTH_RADIUS_KM * Math.cos(meanLat);
  return { east, north };
}

export function enrichPlaces(registry) {
  const anchor = registry.places.find(p => p.id === registry.anchor);
  if (!anchor) throw new Error(`World atlas anchor not found: ${registry.anchor}`);

  return registry.places.map(place => ({
    ...place,
    distanceFromAnchorKm: haversineKm(anchor, place),
    local: localKm(place, anchor)
  }));
}

export function getPlace(registry, id) {
  const place = registry.places.find(p => p.id === id);
  if (!place) throw new Error(`Unknown world place: ${id}`);
  return place;
}
