"""Whole-island base layer (Ring 3): Hawaiʻi Island DEM (terrarium z11) + imagery (tools/imagery.py, public domain) in the local frame.
Outputs web/public/assets/island_height.png (16-bit elevation packed in RG: (h+11000)*? see meta) + island_color.jpg + island.json"""
import sys, os, io, json, math, urllib.request, time
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest import to_local, to_geo, tile_xy, UA, DATA
import imagery as IMG
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'public', 'assets')
LAT0, LAT1, LON0, LON1 = 18.86, 20.30, -156.10, -154.78          # whole island + Alenuihāhā channel margin
Z_DEM, Z_IMG = 11, 11
N = 2048                                                          # output grid / texture size


def fetch(url):
    for a in range(5):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except Exception:
            time.sleep(1 + a)
    raise RuntimeError(url)


def mosaic(z, kind):
    x0, y1 = tile_xy(LAT0, LON0, z)
    x1, y0 = tile_xy(LAT1, LON1, z)
    tx0, tx1, ty0, ty1 = int(x0), int(x1), int(y0), int(y1)
    W, H = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256
    img = Image.new('RGB', (W, H))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            if kind == 'dem':
                im = Image.open(io.BytesIO(fetch(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png'))).convert('RGB')
            else:
                im = IMG.tile(z, tx, ty) or Image.new('RGB', (256, 256), IMG.OCEAN)
            img.paste(im, ((tx - tx0) * 256, (ty - ty0) * 256))
    return img, (tx0, ty0)


def sample(img, origin, z, lat, lon):
    """Bilinear sample of a mercator mosaic at lat/lon arrays."""
    a = np.asarray(img).astype(np.float64)
    fx, fy = tile_xy_arr(lat, lon, z)
    px = (fx - origin[0]) * 256 - .5
    py = (fy - origin[1]) * 256 - .5
    x0 = np.clip(np.floor(px).astype(int), 0, a.shape[1] - 2)
    y0 = np.clip(np.floor(py).astype(int), 0, a.shape[0] - 2)
    ax, ay = (px - x0)[..., None], (py - y0)[..., None]
    return a[y0, x0] * (1 - ax) * (1 - ay) + a[y0, x0 + 1] * ax * (1 - ay) + a[y0 + 1, x0] * (1 - ax) * ay + a[y0 + 1, x0 + 1] * ax * ay


def tile_xy_arr(lat, lon, z):
    n = 2 ** z
    return (lon + 180) / 360 * n, (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n


if __name__ == '__main__':
    x0, y0 = to_local(LAT0, LON0)
    x1, y1 = to_local(LAT1, LON1)
    size = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    X0, Y0 = cx - size / 2, cy - size / 2
    xs = X0 + (np.arange(N) + .5) / N * size
    ys = Y0 + (np.arange(N) + .5) / N * size
    XX, YY = np.meshgrid(xs, ys[::-1])                     # row 0 = north
    LAT, LON = to_geo(XX, YY)
    t = time.time()
    dem_img, o1 = mosaic(Z_DEM, 'dem')
    print('dem mosaic', dem_img.size, round(time.time() - t, 1), 's')
    rgb = sample(dem_img, o1, Z_DEM, LAT, LON)
    h = rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768
    # pack height (metres, -6000..4300) into 16 bits: v = (h + 6000) * 6  -> 0.167 m steps
    v = np.clip((h + 6000) * 6, 0, 65535).astype(np.uint32)
    packed = np.stack([(v >> 8) & 255, v & 255, np.zeros_like(v)], -1).astype(np.uint8)
    Image.fromarray(packed).save(os.path.join(OUT, 'island_height.png'))
    t = time.time()
    col_img, o2 = mosaic(Z_IMG, 'img')
    print('img mosaic', col_img.size, round(time.time() - t, 1), 's')
    col = sample(col_img, o2, Z_IMG, LAT, LON)
    Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'island_color.jpg'), quality=86)
    meta = {'x0': X0, 'y0': Y0, 'size': size, 'n': N, 'enc': 'h = (R*256+G)/6 - 6000', 'hmin': float(h.min()), 'hmax': float(h.max()),
            'sources': ['AWS Terrain Tiles (terrarium) z11', *[c + ' z11' for c in IMG.credits()]]}
    json.dump(meta, open(os.path.join(OUT, 'island.json'), 'w'))
    print('ISLAND', round(size / 1000, 1), 'km square', f"h {h.min():.0f}..{h.max():.0f} m")
