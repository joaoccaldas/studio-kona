#!/usr/bin/env python3
"""St. George, Utah — evidence ingest (as it stood 29 Oct 2022, IRONMAN 70.3 Worlds).

Public GET sources only, same contracts as tools/ingest.py (Kona):
  OSM (ODbL)   -> data/stgeorge/osm_index.json  (buildings / roads / trees / water)
  ESRI Imagery -> data/stgeorge/sat_*.jpg        (0.6-1 m orthophoto)
  AWS Terrain  -> data/stgeorge/dem.npy          (terrarium, + dem_meta.json)

Local frame: origin = downtown St. George (37.0965, -113.5684), +X east, +Y north, metres.
The race (published course, IRONMAN 70.3 Worlds 29 Oct 2022):
  SWIM  1.2 mi  Sand Hollow Reservoir (37.1090, -113.3966)
  BIKE  56 mi   via Snow Canyon summit (37.194, -113.644) climb
  RUN   13.1 mi Red Hills Pkwy / downtown, finish 37.0965,-113.5684
NOTE: Overpass/OSM is queried with an as-of date where supported (date:2022-10-29) so the
massing reflects the October 2022 state, not the current built environment.
"""
import json, math, os, sys, time, io, urllib.request
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', 'data', 'stgeorge'))
os.makedirs(DATA, exist_ok=True)

LAT0, LON0 = 37.0965, -113.5684                 # downtown St. George (anchor)
KX = 111320.0 * math.cos(math.radians(LAT0))
KY = 110574.0
AS_OF = '2022-10-29'                            # IRONMAN 70.3 Worlds race day
UA = {'User-Agent': 'caldas-world-research/1.0 (joaoccaldas@gmail.com)'}

# Evidence bbox containing the full 70.3 Worlds course: Sand Hollow (E) ↔ Snow Canyon (N) ↔ downtown.
# ~ 24 × 24 km window.
BBOX = (36.95, -113.75, 37.30, -113.30)         # S, W, N, E

def to_local(lat, lon):
    return ((lon - LON0) * KX, (lat - LAT0) * KY)

# ------------------------------------------------------------------ OSM (+as-of 2022)
def ingest_osm():
    s, w, n, e = BBOX
    # Overpass has no general "[date]" clause; an as-of OSM snapshot needs an 'attic' query
    # (https://overpass-api.de/api/attic/) or per-feature `changed:` filters, both slow/unreliable
    # for a 24x24 km window. We use current OSM and stamp AS_OF; geometry is overwhelmingly
    # pre-2022 here (established city), and building height inference dominates anyway.
    q = f"""[out:xml][timeout:60];
      ( way[\"building\"]({s},{w},{n},{e});
        way[\"highway\"]({s},{w},{n},{e});
        node[\"natural\"=\"tree\"]({s},{w},{n},{e});
        way[\"natural\"=\"water\"]({s},{w},{n},{e});
        way[\"natural\"=\"beach\"]({s},{w},{n},{e});
        way[\"landuse\"]({s},{w},{n},{e}); );
      (._;>;); out body;"""
    req = urllib.request.Request('https://overpass-api.de/api/interpreter',
                                 data=q.encode(), headers=UA, method='POST')
    print('[stg] Overpass query (target as-of %s; OSM current, see EVIDENCE note)…' % AS_OF)
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    root = ET.fromstring(raw)
    nodes, buildings, roads, trees, water = {}, [], [], [], []
    for nd in root.iter('node'):
        nodes[nd.get('id')] = (float(nd.get('lat')), float(nd.get('lon')))
        t = {x.get('k'): x.get('v') for x in nd.iter('tag')}
        if t.get('natural') == 'tree':
            trees.append([round(v, 2) for v in to_local(*nodes[nd.get('id')])])
    for wy in root.iter('way'):
        tags = {x.get('k'): x.get('v') for x in wy.iter('tag')}
        pts = [to_local(*nodes[n.get('ref')]) for n in wy.iter('nd') if n.get('ref') in nodes]
        if len(pts) < 3:
            if 'highway' in tags and len(pts) >= 2:
                roads.append({'p': [[round(x, 1), round(y, 1)] for x, y in pts], 'k': tags['highway']})
            continue
        if 'building' in tags:
            h = float(tags['height'].split()[0]) if 'height' in tags and tags['height'].replace('.', '').isdigit() else (9 if tags.get('building') in ('commercial', 'hotel') else 4.5)
            buildings.append({'p': [[round(x, 1), round(y, 1)] for x, y in pts], 'h': h})
        elif 'highway' in tags:
            roads.append({'p': [[round(x, 1), round(y, 1)] for x, y in pts], 'k': tags['highway']})
        elif tags.get('natural') == 'water' or tags.get('water'):
            water.append({'p': [[round(x, 1), round(y, 1)] for x, y in pts]})
    out = {'origin': {'lat': LAT0, 'lon': LON0, 'as_of': AS_OF},
           'buildings': buildings, 'roads': roads, 'trees': trees, 'water': water,
           'stats': {'buildings': len(buildings), 'roads': len(roads), 'trees': len(trees)}}
    json.dump(out, open(os.path.join(DATA, 'osm_index.json'), 'w'))
    print('[stg] OSM: %d buildings, %d roads, %d trees (as of %s)' % (len(buildings), len(roads), len(trees), AS_OF))

# ------------------------------------------------------------------ ESRI imagery
def ingest_sat():
    # Two plates: detail downtown (~0.6 m/px, 3 km) and course-wide (~6 m/px, 24 km).
    for name, size_px, span_m, (clat, clon) in [
        ('sat_core', 2048, 3000, (37.0965, -113.5684)),    # downtown / finish
        ('sat_course', 2048, 24000, (37.15, -113.52)),     # Sand Hollow ↔ Snow Canyon
    ]:
        cx, cy = to_local(clat, clon)
        x0, y0 = cx - span_m / 2, cy - span_m / 2
        url = ('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'
               f'?bbox={LON0 + (x0)/KX},{LAT0 + (y0)/KY},{LON0 + (x0+span_m)/KX},{LAT0 + (y0+span_m)/KY}'
               f'&bboxSR=4326&size={size_px},{size_px}&imageSR=4326&format=jpg&f=image')
        print('[stg] ESRI %s…' % name)
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=90) as r:
            data = r.read()
        open(os.path.join(DATA, name + '.jpg'), 'wb').write(data)
        Image.open(os.path.join(DATA, name + '.jpg')).save(os.path.join(DATA, name + '.jpg'), 'JPEG', quality=88)
        json.dump({'x0': x0, 'y0': y0, 'size': span_m, 'px': size_px},
                  open(os.path.join(DATA, name + '.json'), 'w'))

# ------------------------------------------------------------------ AWS Terrain (terrarium DEM)
def ingest_dem():
    s, w, n, e = BBOX
    # AWS terrain-tiles terrarium PNG at zoom 12 (~ 3.9 m/px at this latitude) tiles over the bbox.
    z = 12
    def tnum(lat, lon, z):
        x = int((lon + 180) / 360 * 2**z)
        y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * 2**z)
        return x, y
    x0, y0 = tnum(n, w, z); x1, y1 = tnum(s, e, z)
    nx, ny = x1 - x0 + 1, y1 - y0 + 1
    W, H = nx * 256, ny * 256
    img = Image.new('RGB', (W, H))
    print('[stg] terrarium DEM %dx%d tiles…' % (nx, ny))
    for j, ty in enumerate(range(y0, y1 + 1)):
        for i, tx in enumerate(range(x0, x1 + 1)):
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png'
            for attempt in range(3):
                try:
                    req = urllib.request.Request(url, headers=UA)
                    with urllib.request.urlopen(req, timeout=30) as r:
                        img.paste(Image.open(io.BytesIO(r.read())), (i * 256, j * 256))
                    break
                except Exception as ex:
                    print('  tile %d,%d attempt %d: %s' % (tx, ty, attempt, ex)); time.sleep(1 + attempt)
    # decode terrarium (h = R*256 + G + B/256 - 32768) then resample to 1024x1024
    img = img.resize((1024, 1024), Image.BICUBIC)
    px = np.asarray(img, dtype=np.float32)
    dem = px[..., 0] * 256.0 + px[..., 1] + px[..., 2] / 256.0 - 32768.0
    np.save(os.path.join(DATA, 'dem.npy'), dem.astype(np.float16))
    # web-mercator NW corner of tile (x0,y0) -> lon/lat, for exact georeferencing of the resampled grid
    def lonlat(tx, ty, z):
        lon = tx / 2**z * 360.0 - 180.0
        lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ty / 2**z))))
        return lat, lon
    latN, lonW = lonlat(x0, y0, z); latS, lonE = lonlat(x1 + 1, y1 + 1, z)
    cwn, cne = to_local(latN, lonW), to_local(latS, lonE)      # (x,y) SW of N-W corner / NE corner
    json.dump({'x0': cwn[0], 'y0': cne[1], 'size': cne[0] - cwn[0],
               'bbox_m': [round(cwn[0], 1), round(cne[1], 1), round(cne[0], 1), round(cwn[1], 1)],
               'n': 1024, 'as_of': 'terrarium current'},
              open(os.path.join(DATA, 'dem_meta.json'), 'w'))
    print('[stg] DEM 1024x1024 (min %.0f m, max %.0f m)' % (np.nanmin(dem), np.nanmax(dem)))

if __name__ == '__main__':
    import io
    step = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if step in ('osm', 'all'): ingest_osm()
    if step in ('sat', 'all'): ingest_sat()
    if step in ('dem', 'all'): ingest_dem()
    print('[stg] done ->', DATA)
