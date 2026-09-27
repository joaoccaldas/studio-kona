"""Kona evidence ingest -> data/.  Public GET sources only.

  OSM  (ODbL, © OpenStreetMap contributors): data/osm_kailua.osm  -> data/osm_index.json (local metres)
  ESRI World Imagery export: data/sat_core.jpg (1.6 km), data/sat_bay.jpg (6 km)
  AWS Terrain Tiles (terrarium, public dataset, includes bathymetry): data/dem.npy (+ dem_meta.json)

Local frame: origin = Kailua Pier (OSM node search), +X east, +Y north, metres (local tangent plane).
"""
import json, math, os, sys, io, urllib.request, time
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
LAT0, LON0 = 19.6391620, -155.9968082          # Kailua Pier (Nominatim, OSM)
KX = 111320.0 * math.cos(math.radians(LAT0))
KY = 110574.0
UA = {'User-Agent': 'caldas-world-research/1.0 (joaoccaldas@gmail.com)'}


def to_local(lat, lon):
    return ((lon - LON0) * KX, (lat - LAT0) * KY)


def to_geo(x, y):
    return (LAT0 + y / KY, LON0 + x / KX)


# ------------------------------------------------------------------ OSM
CATS = [
    ('building', lambda t: 'building' in t),
    ('pier', lambda t: t.get('man_made') in ('pier', 'breakwater', 'groyne') or t.get('man_made') == 'quay'),
    ('coastline', lambda t: t.get('natural') == 'coastline'),
    ('beach', lambda t: t.get('natural') == 'beach'),
    ('water', lambda t: t.get('natural') == 'water' or t.get('water') is not None),
    ('rock', lambda t: t.get('natural') in ('bare_rock', 'rock', 'scree', 'stone')),
    ('tree_row', lambda t: t.get('natural') == 'tree_row'),
    ('wood', lambda t: t.get('natural') in ('wood', 'scrub') or t.get('landuse') == 'forest'),
    ('grass', lambda t: t.get('landuse') in ('grass', 'meadow') or t.get('leisure') in ('park', 'garden') or t.get('natural') == 'grassland'),
    ('road', lambda t: t.get('highway') in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'trunk', 'service', 'living_street')),
    ('path', lambda t: t.get('highway') in ('footway', 'path', 'pedestrian', 'steps', 'cycleway')),
    ('parking', lambda t: t.get('amenity') == 'parking'),
    ('landuse', lambda t: 'landuse' in t),
    ('wall', lambda t: t.get('barrier') in ('wall', 'retaining_wall', 'fence') or t.get('man_made') == 'embankment'),
    ('amenity', lambda t: 'amenity' in t or 'tourism' in t or 'historic' in t),
]


def ingest_osm():
    roots = [ET.parse(os.path.join(DATA, f)).getroot() for f in ('osm_kailua.osm', 'osm_north.osm', 'osm_south.osm') if os.path.exists(os.path.join(DATA, f))]
    nodes = {}
    seen_w = set()
    trees, pois = [], []
    for n in (n for r in roots for n in r.iter('node')):
        lat, lon = float(n.get('lat')), float(n.get('lon'))
        nodes[n.get('id')] = to_local(lat, lon)
        tags = {t.get('k'): t.get('v') for t in n.iter('tag')}
        if tags.get('natural') == 'tree':
            trees.append([round(v, 2) for v in nodes[n.get('id')]] + [tags.get('species') or tags.get('genus') or tags.get('leaf_type', '')])
        elif tags.get('name') or 'amenity' in tags or 'tourism' in tags or 'historic' in tags:
            pois.append({'id': 'n' + n.get('id'), 'xy': [round(v, 2) for v in nodes[n.get('id')]], 'tags': tags})
    feats = {c: [] for c, _ in CATS}
    feats['other'] = []
    for w in (w for r in roots for w in r.iter('way')):
        if w.get('id') in seen_w:
            continue
        seen_w.add(w.get('id'))
        tags = {t.get('k'): t.get('v') for t in w.iter('tag')}
        refs = [nd.get('ref') for nd in w.iter('nd')]
        pts = [nodes[r] for r in refs if r in nodes]
        if len(pts) < 2:
            continue
        cat = next((c for c, f in CATS if f(tags)), 'other')
        closed = refs[0] == refs[-1]
        f = {'id': 'w' + w.get('id'), 'closed': closed, 'pts': [[round(x, 2), round(y, 2)] for x, y in pts], 'tags': tags}
        if cat == 'building':
            lv = tags.get('building:levels')
            h = tags.get('height')
            try:
                f['h'] = float(h) if h else (float(lv) * 3.2 + 1 if lv else None)
            except ValueError:
                f['h'] = None
        feats[cat].append(f)
    out = {'origin': {'lat': LAT0, 'lon': LON0, 'name': 'Kailua Pier'}, 'license': 'ODbL © OpenStreetMap contributors',
           'features': feats, 'trees': trees, 'pois': pois}
    json.dump(out, open(os.path.join(DATA, 'osm_index.json'), 'w'))
    print('OSM', {k: len(v) for k, v in feats.items() if v}, 'trees', len(trees), 'pois', len(pois))
    return out


# ------------------------------------------------------------------ imagery
def esri(name, cx, cy, half, px):
    la0, lo0 = to_geo(cx - half, cy - half)
    la1, lo1 = to_geo(cx + half, cy + half)
    url = (f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox={lo0},{la0},{lo1},{la1}"
           f"&bboxSR=4326&imageSR=3857&size={px},{px}&format=jpg&f=image")
    b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
    open(os.path.join(DATA, name + '.jpg'), 'wb').write(b)
    meta = {'center': [cx, cy], 'half': half, 'px': px, 'mpp': 2 * half / px, 'url': url}
    json.dump(meta, open(os.path.join(DATA, name + '.json'), 'w'))
    print('IMG', name, f'{2 * half:.0f} m @ {2 * half / px:.3f} m/px')


# ------------------------------------------------------------------ terrain + bathymetry
def tile_xy(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def dem(half=6000.0, z=13, res=10.0):
    """Sample terrarium tiles onto a local grid (res metres) of +-half metres around the pier."""
    cache = {}

    def tile(tx, ty):
        k = (tx, ty)
        if k not in cache:
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png'
            im = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())).convert('RGB')
            a = np.asarray(im).astype(np.float64)
            cache[k] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
        return cache[k]
    n = int(2 * half / res) + 1
    grid = np.zeros((n, n), dtype=np.float32)
    for j in range(n):
        y = -half + j * res
        for i in range(n):
            x = -half + i * res
            lat, lon = to_geo(x, y)
            fx, fy = tile_xy(lat, lon, z)
            tx, ty = int(fx), int(fy)
            px, py = (fx - tx) * 256, (fy - ty) * 256
            t = tile(tx, ty)
            x0, y0 = int(px), int(py)
            x1, y1 = min(255, x0 + 1), min(255, y0 + 1)
            ax, ay = px - x0, py - y0
            grid[j, i] = (t[y0, x0] * (1 - ax) * (1 - ay) + t[y0, x1] * ax * (1 - ay) + t[y1, x0] * (1 - ax) * ay + t[y1, x1] * ax * ay)
    np.save(os.path.join(DATA, 'dem.npy'), grid)
    json.dump({'half': half, 'res': res, 'n': n, 'zoom': z, 'source': 'AWS Terrain Tiles (terrarium)', 'rows': 'south->north', 'cols': 'west->east'},
              open(os.path.join(DATA, 'dem_meta.json'), 'w'))
    print('DEM', n, 'x', n, f'min {grid.min():.0f} m max {grid.max():.0f} m', len(cache), 'tiles')


if __name__ == '__main__':
    what = sys.argv[1:] or ['osm', 'img', 'dem']
    if 'osm' in what:
        ingest_osm()
    if 'img' in what:
        esri('sat_core', -250.0, -600.0, 900.0, 4096)       # pier, transition, Dig Me Beach, the whole swim course
        esri('sat_bay', 0.0, -1500.0, 3000.0, 2048)          # Kailua Bay + town context
    if 'dem' in what:
        dem()


def esri_tiles(name, cx, cy, half, z):
    """Stitch ESRI World Imagery tiles (web mercator) covering the square, then resample to the local frame."""
    la0, lo0 = to_geo(cx - half, cy - half)
    la1, lo1 = to_geo(cx + half, cy + half)
    fx0, fy1 = tile_xy(la0, lo0, z)
    fx1, fy0 = tile_xy(la1, lo1, z)
    tx0, tx1, ty0, ty1 = int(fx0), int(fx1), int(fy0), int(fy1)
    W, H = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256
    mosaic = Image.new('RGB', (W, H))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            url = f'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{ty}/{tx}'
            for attempt in range(4):
                try:
                    b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
                    mosaic.paste(Image.open(io.BytesIO(b)).convert('RGB'), ((tx - tx0) * 256, (ty - ty0) * 256))
                    break
                except Exception:
                    time.sleep(1 + attempt)
    # crop to the exact square (mercator is locally conformal; tiny N-S scale variance over 2 km is < 0.1%)
    px = lambda f, t0: (f - t0) * 256
    box = (px(fx0, tx0), px(fy0, ty0), px(fx1, tx0), px(fy1, ty0))
    img = mosaic.crop(tuple(int(round(v)) for v in box))
    img.save(os.path.join(DATA, name + '.jpg'), quality=92)
    meta = {'center': [cx, cy], 'half': half, 'px': img.size[0], 'mpp': 2 * half / img.size[0], 'zoom': z, 'source': 'ESRI World Imagery tiles'}
    json.dump(meta, open(os.path.join(DATA, name + '.json'), 'w'))
    print('IMG', name, img.size, f"{meta['mpp']:.3f} m/px")


if __name__ == '__main__' and 'tiles' in sys.argv:
    esri_tiles('sat_core', -250.0, -600.0, 900.0, 18)
    esri_tiles('sat_bay', 0.0, -1500.0, 3000.0, 15)
