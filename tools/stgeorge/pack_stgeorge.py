#!/usr/bin/env python3
"""St. George 70.3 Worlds place pack: terrain (DEM heightgrid) + building massing -> a compact
viewer pack, in the kona Ring-1 tile format so the existing TileStreamer can load it.

Output -> web/public/assets/stgeorge/
  st_terrain.json : {"x0","y0","size","grid","h"} heights in decimetres, b64 little-endian int16
  st_buildings.json : [{"p":[[x,y],...],"h":m}, ...] (local metres, height tag or type-inferred)
  st_index.json   : {"x0","y0","size","origin","as_of","files"}

Heights: terrarium DEM (evidence M). Building heights w/o OSM tag are I (inferred by type).
"""
import os, json, base64, math
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', 'data', 'stgeorge'))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'web', 'public', 'assets', 'stgeorge'))
os.makedirs(OUT, exist_ok=True)

GRID = 200  # 200x200 vertices over the course window (~ 46.8 km -> ~ 235 m cells, good for desert relief)

HEIGHT_BY_TYPE = {'apartments': 12.0, 'hotel': 18.0, 'house': 5.5, 'retail': 6.5, 'commercial': 7.5,
                  'garage': 3.2, 'roof': 4.2, 'warehouse': 7.0, 'office': 9.0, 'church': 9.0,
                  'school': 7.0, 'industrial': 8.0, 'yes': 4.5}

def pack_terrain():
    meta = json.load(open(os.path.join(DATA, 'dem_meta.json')))
    dem = np.load(os.path.join(DATA, 'dem.npy')).astype(np.float32)   # 1024x1024 terrarium metres
    n = meta['n']; x0, y0, size = meta['x0'], meta['y0'], meta['size']
    # resample 1024 -> GRID bilinear (cell size grows outward; N is up/row 0 = max lat = max y)
    idx = np.linspace(0, n - 1, GRID).astype(int)
    sub = dem[np.ix_(idx, idx)]
    # row 0 of terrarium = north = +y -> we keep row order so row j maps to y0 + j*cell
    h = (sub * 10).round().astype('<i2')                              # decimetres, little-endian
    b64 = base64.b64encode(h.tobytes()).decode()
    json.dump({'x0': x0, 'y0': y0, 'size': size, 'grid': GRID, 'h': b64},
              open(os.path.join(OUT, 'st_terrain.json'), 'w'))
    print('[stg] terrain packed %dx%d (%.0f m cells, x0=%.0f y0=%.0f)' % (GRID, GRID, size / (GRID - 1), x0, y0))

def pack_buildings():
    osm = json.load(open(os.path.join(DATA, 'osm_index.json')))
    bs = osm['buildings']
    T = 2000.0                                     # 2 km streaming tiles
    tiles = {}                                     # key -> [buildings]
    dropped = 0
    for b in bs:
        h = b.get('h') or 4.5
        h = max(3.0, min(float(h), 80.0))
        pts = [[round(x, 1), round(y, 1)] for x, y in b['p']]
        if len(pts) < 3:
            dropped += 1
            continue
        mx = sum(p[0] for p in pts) / len(pts)
        my = sum(p[1] for p in pts) / len(pts)
        k = (int(math.floor(mx / T)), int(math.floor(my / T)))
        tiles.setdefault(k, []).append({'p': pts, 'h': round(h, 1)})
    manifest = []
    for (i, j), bl in tiles.items():
        name = 'st_b_%d_%d.json' % (i, j)
        json.dump({'x0': i * T, 'y0': j * T, 'size': T, 'b': bl},
                  open(os.path.join(OUT, name), 'w'), separators=(',', ':'))
        manifest.append({'k': '%d_%d' % (i, j), 'x0': i * T, 'y0': j * T, 'n': len(bl)})
    json.dump({'tiles': manifest, 'size': T}, open(os.path.join(OUT, 'st_buildings_index.json'), 'w'))
    sz = sum(os.path.getsize(os.path.join(OUT, 'st_b_%d_%d.json' % (i, j))) for (i, j) in tiles)
    print('[stg] %d buildings in %d tiles (%.1f MB, dropped %d)' % (len(bs) - dropped, len(tiles), sz / 1e6, dropped))

if __name__ == '__main__':
    pack_terrain()
    pack_buildings()
    json.dump({'origin': {'lat': 37.0965, 'lon': -113.5684}, 'as_of': '2022-10-29',
               'files': ['st_terrain.json', 'st_buildings.json']},
              open(os.path.join(OUT, 'st_index.json'), 'w'))
    print('[stg] pack ->' + OUT)
