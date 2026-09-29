"""Ring 1 tile packs: 500 m tiles around the hand-built core, streamed by the browser.

Per tile t_<i>_<j>.json: terrain heights (decimetres, 5 m grid, crisp OSM coastline), buildings (OSM footprint,
height (tag or type-inferred), roof colour sampled from imagery), trees. Imagery img_<i>_<j>.jpg (z18, 0.56 m/px) from tools/imagery.py: NAIP (public domain) by default.
Evidence: M (OSM, imagery, DEM); building heights without tags are I (inferred by type).
"""
import os, sys, json, io, math, base64, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'blender'))
from ingest import to_geo, tile_xy, UA
import imagery as IMG
import survey as S

OUT = os.path.join(HERE, '..', 'web', 'public', 'assets', 'tiles')
os.makedirs(OUT, exist_ok=True)
T = 500.0
GRID = 101
RING = (-2000.0, -3000.0, 2000.0, 2500.0)       # x0, y0, x1, y1 (metres from the pier)
CORE = S.TILE
HEIGHT_BY_TYPE = {'apartments': 12.0, 'hotel': 18.0, 'house': 5.5, 'retail': 6.5, 'commercial': 7.5, 'garage': 3.2, 'roof': 4.2,
                  'warehouse': 7.0, 'office': 9.0, 'church': 9.0, 'school': 7.0, 'toilets': 3.2, 'industrial': 8.0, 'yes': 6.0}


def fetch(url):
    for a in range(5):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
        except Exception:
            time.sleep(1 + a)
    return None


def imagery(x0, y0, x1, y1, z=18, px=1024):
    la0, lo0 = to_geo(x0, y0)
    la1, lo1 = to_geo(x1, y1)
    fx0, fy1 = tile_xy(la0, lo0, z)
    fx1, fy0 = tile_xy(la1, lo1, z)
    tx0, tx1, ty0, ty1 = int(fx0), int(fx1), int(fy0), int(fy1)
    mos = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    cells = [(tx, ty) for tx in range(tx0, tx1 + 1) for ty in range(ty0, ty1 + 1)]
    with ThreadPoolExecutor(8) as ex:
        for (tx, ty), im in zip(cells, ex.map(lambda c: IMG.tile(z, *c), cells)):
            if im:
                mos.paste(im, ((tx - tx0) * 256, (ty - ty0) * 256))
    box = ((fx0 - tx0) * 256, (fy0 - ty0) * 256, (fx1 - tx0) * 256, (fy1 - ty0) * 256)
    return mos.crop(tuple(int(round(v)) for v in box)).resize((px, px), Image.LANCZOS)


def heights(x0, y0, segs):
    xs, ys = np.meshgrid(np.linspace(x0, x0 + T, GRID), np.linspace(y0, y0 + T, GRID))
    sd = S.signed_coast_distance(xs, ys, segs)
    dem = S.dem_grid(xs, ys)
    land = np.maximum(.45 + .09 * np.clip(sd, 0, 25), dem)
    sea = -np.minimum(.25 + .11 * np.abs(sd) + .00004 * np.abs(sd) ** 2, np.maximum(-dem, .25 + .11 * np.abs(sd) * .5))
    return np.where(sd >= 0, land, sea)


def main():
    segs = S.coast_segments()
    blds = []
    for f in S.F['building']:
        if not f['closed'] or len(f['pts']) < 4:
            continue
        pts = f['pts'][:-1]
        cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        blds.append((cx, cy, f))
    index = []
    nx, ny = int((RING[2] - RING[0]) / T), int((RING[3] - RING[1]) / T)
    t0 = time.time()
    for i in range(nx):
        for j in range(ny):
            x0, y0 = RING[0] + i * T, RING[1] + j * T
            x1, y1 = x0 + T, y0 + T
            if x0 >= CORE[0] and x1 <= CORE[2] and y0 >= CORE[1] and y1 <= CORE[3]:
                continue                                   # fully inside the hand-built core
            key = f'{i}_{j}'
            z = heights(x0, y0, segs)
            land_frac = float((z > 0).mean())
            img = imagery(x0, y0, x1, y1)
            img.save(os.path.join(OUT, f'img_{key}.jpg'), quality=80)
            a = np.asarray(img).astype(np.float64)
            out_b = []
            for cx, cy, f in blds:
                if not (x0 <= cx < x1 and y0 <= cy < y1):
                    continue
                if CORE[0] < cx < CORE[2] and CORE[1] < cy < CORE[3]:
                    continue                               # the core GLB already has it
                pts = f['pts'][:-1]
                kind = f['tags'].get('building', 'yes')
                h = f.get('h') or HEIGHT_BY_TYPE.get(kind, 6.0)
                px_ = [int((p[0] - x0) / T * 1023) for p in pts]
                py_ = [int((y1 - p[1]) / T * 1023) for p in pts]
                sx = np.clip(np.array([sum(px_) // len(px_)] + px_), 0, 1023)
                sy = np.clip(np.array([sum(py_) // len(py_)] + py_), 0, 1023)
                rc = (a[sy, sx].mean(0) / 255).round(3).tolist()
                out_b.append({'p': [[round(p[0] - x0, 1), round(p[1] - y0, 1)] for p in pts], 'h': round(h, 1), 'c': rc,
                              'n': f['tags'].get('name', ''), 'k': kind})
            trees = [[round(t[0] - x0, 1), round(t[1] - y0, 1)] for t in S.OSM['trees'] if x0 <= t[0] < x1 and y0 <= t[1] < y1]
            hz = np.clip(np.round(z * 10), -32000, 32000).astype('<i2')
            pack = {'x0': x0, 'y0': y0, 'size': T, 'grid': GRID, 'h': base64.b64encode(hz.tobytes()).decode(), 'b': out_b, 't': trees}
            json.dump(pack, open(os.path.join(OUT, f't_{key}.json'), 'w'), separators=(',', ':'))
            index.append({'k': key, 'x0': x0, 'y0': y0, 'land': round(land_frac, 2), 'nb': len(out_b)})
            print(key, f'land {land_frac:.2f}', len(out_b), 'bldg', round(time.time() - t0), 's', flush=True)
    json.dump({'size': T, 'ring': RING, 'core': CORE, 'imagery': IMG.credits(), 'tiles': index}, open(os.path.join(OUT, 'index.json'), 'w'))
    print('TILES', len(index))


if __name__ == '__main__':
    main()
