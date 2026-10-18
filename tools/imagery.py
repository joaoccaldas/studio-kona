"""Aerial imagery for every Kona build step, from openly licensed sources.

  z >= 13  USDA NAIP 2022, 0.6 m, public domain, via Microsoft Planetary Computer (item tiler, STAC search).
  z <  13  USGS The National Map "USGSImageryOnly", public domain.
  KONA_IMAGERY=esri  ESRI World Imagery, development only: its terms do not allow shipping it in a public app.

tile(z, tx, ty) -> 256 px RGB PIL image (web-mercator XYZ), or None if no source has data.
"""
import io, json, math, os, time, threading, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '..', 'data', 'naip_items.json')
UA = {'User-Agent': 'caldas-world-research/1.0 (joaoccaldas@gmail.com)'}
PC = 'https://planetarycomputer.microsoft.com/api'
USGS = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'
ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
OCEAN = (27, 58, 84)                       # fill for USGS no-data over open ocean
SOURCE = os.environ.get('KONA_IMAGERY', 'open')

CREDITS = {
    'naip': 'USDA NAIP 2022 imagery (public domain), via Microsoft Planetary Computer',
    'usgs': 'USGS The National Map orthoimagery (public domain)',
    'esri': 'ESRI World Imagery (development only, not licensed for release)',
}

_lock = threading.Lock()
_items = None
_parents = {}


def credits():
    return [CREDITS['esri']] if SOURCE == 'esri' else [CREDITS['naip'], CREDITS['usgs']]


def _get(url, timeout=60, tries=5):
    for a in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                return None
            time.sleep(1 + a)
        except Exception:
            time.sleep(1 + a)
    return None


def tile_bounds(z, tx, ty):
    n = 2 ** z
    lon0, lon1 = tx / n * 360 - 180, (tx + 1) / n * 360 - 180
    lat = lambda y: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon0, lat(ty + 1), lon1, lat(ty)


def naip_items(bbox=(-156.10, 19.45, -155.85, 19.80)):
    """NAIP scenes over the Kona build area, newest first. Cached so rebuilds are reproducible."""
    global _items
    if _items is not None:
        return _items
    if os.path.exists(CACHE):
        _items = json.load(open(CACHE))['items']
        return _items
    body = json.dumps({'collections': ['naip'], 'bbox': list(bbox), 'limit': 100}).encode()
    req = urllib.request.Request(PC + '/stac/v1/search', data=body, headers={**UA, 'content-type': 'application/json'})
    feats = json.load(urllib.request.urlopen(req, timeout=60))['features']
    newest = max(f['properties']['datetime'][:4] for f in feats)
    _items = sorted(({'id': f['id'], 'bbox': f['bbox'], 'date': f['properties']['datetime'][:10]}
                     for f in feats if f['properties']['datetime'][:4] == newest), key=lambda i: i['id'])
    json.dump({'source': CREDITS['naip'], 'search_bbox': list(bbox), 'items': _items}, open(CACHE, 'w'), indent=1)
    return _items


def _naip_parent(z, tx, ty):
    """One 512 px tile at zoom z (the @2x tile) = the four z+1 tiles below it. NAIP scenes composited by alpha."""
    key = (z, tx, ty)
    with _lock:
        if key in _parents:
            return _parents[key]
    lo0, la0, lo1, la1 = tile_bounds(z, tx, ty)
    out = None
    for it in naip_items():
        b = it['bbox']
        if b[0] > lo1 or b[2] < lo0 or b[1] > la1 or b[3] < la0:
            continue
        raw = _get(f"{PC}/data/v1/item/tiles/WebMercatorQuad/{z}/{tx}/{ty}@2x.png?collection=naip&item={it['id']}"
                   "&assets=image&asset_bidx=image%7C1%2C2%2C3&nodata=0")
        if not raw:
            continue
        im = Image.open(io.BytesIO(raw)).convert('RGBA')
        out = im if out is None else Image.alpha_composite(im, out)   # earlier scene wins where both have data
    with _lock:
        if len(_parents) > 4096:
            _parents.clear()
        _parents[key] = out
    return out


def _usgs(z, tx, ty):
    raw = _get(USGS.format(z=z, x=tx, y=ty))
    if not raw:
        return None
    im = Image.open(io.BytesIO(raw)).convert('RGBA')
    lo = min(e[0] for e in im.convert('RGB').getextrema())
    if lo >= 250:                                   # blank "no imagery" tile over open ocean
        return Image.new('RGB', im.size, OCEAN)
    bg = Image.new('RGBA', im.size, OCEAN + (255,))
    return Image.alpha_composite(bg, im).convert('RGB')


def tile(z, tx, ty):
    if SOURCE == 'esri':
        raw = _get(ESRI.format(z=z, x=tx, y=ty))
        return Image.open(io.BytesIO(raw)).convert('RGB') if raw else None
    if z >= 13:
        p = _naip_parent(z - 1, tx // 2, ty // 2)
        if p is not None:
            ox, oy = (tx % 2) * 256, (ty % 2) * 256
            q = p.crop((ox, oy, ox + 256, oy + 256))
            if q.getchannel('A').getextrema()[1] > 0:
                bg = _usgs_upsampled(z, tx, ty)
                return Image.alpha_composite(bg.convert('RGBA'), q).convert('RGB') if bg else q.convert('RGB')
        return _usgs_upsampled(z, tx, ty)
    return _usgs(z, tx, ty)


def _usgs_upsampled(z, tx, ty, zmax=16):
    """USGS where NAIP has no data (open ocean, scene gaps), upsampled from its deepest reliable zoom."""
    if z <= zmax:
        return _usgs(z, tx, ty)
    d = z - zmax
    p = _usgs(zmax, tx >> d, ty >> d)
    if p is None:
        return None
    s = 256 >> d
    ox, oy = (tx % (1 << d)) * s, (ty % (1 << d)) * s
    return p.crop((ox, oy, ox + s, oy + s)).resize((256, 256), Image.BICUBIC)
