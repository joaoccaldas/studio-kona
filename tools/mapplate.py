"""Indexed master map: satellite + OSM overlay + 200 m grid (A1..) and relief/bathymetry panel."""
import json, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, '..', 'data'); OUT = os.path.join(HERE, '..', 'renders')
os.makedirs(OUT, exist_ok=True)
osm = json.load(open(f'{DATA}/osm_index.json'))
meta = json.load(open(f'{DATA}/sat_core.json'))
img = Image.open(f'{DATA}/sat_core.jpg').convert('RGB')
S = 2400
img = img.resize((S, S))
cx, cy, half = meta['center'][0], meta['center'][1], meta['half']
def P(x, y): return ((x - (cx - half)) / (2 * half) * S, ((cy + half) - y) / (2 * half) * S)
ov = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
F = osm['features']
for f in F['building']:
    if f['closed']: d.polygon([P(*p) for p in f['pts']], fill=(255, 200, 80, 70), outline=(255, 210, 90, 220))
for f in F['road']: d.line([P(*p) for p in f['pts']], fill=(255, 255, 255, 170), width=3)
for f in F['path']: d.line([P(*p) for p in f['pts']], fill=(180, 255, 180, 150), width=2)
for f in F['coastline']: d.line([P(*p) for p in f['pts']], fill=(0, 230, 255, 255), width=4)
for f in F['beach']:
    if f['closed']: d.polygon([P(*p) for p in f['pts']], fill=(255, 240, 180, 90), outline=(255, 240, 160, 255))
for f in F['pier']:
    pts = [P(*p) for p in f['pts']]
    (d.polygon(pts, fill=(255, 60, 60, 120), outline=(255, 60, 60, 255)) if f['closed'] else d.line(pts, fill=(255, 60, 60, 255), width=5))
for x, y, *_ in osm['trees']: 
    a, b = P(x, y); d.ellipse((a - 3, b - 3, a + 3, b + 3), outline=(120, 255, 120, 230))
img = Image.alpha_composite(img.convert('RGBA'), ov)
d = ImageDraw.Draw(img)
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 22); big = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)
except Exception: font = big = ImageFont.load_default()
# 200 m index grid: columns A.. (west->east), rows 1.. (north->south)
g = 200.0; x0, y1 = cx - half, cy + half
cols = int(2 * half / g); rows = cols
for i in range(cols + 1):
    a, _ = P(x0 + i * g, 0); d.line([(a, 0), (a, S)], fill=(255, 255, 255, 90), width=1)
for j in range(rows + 1):
    _, b = P(0, y1 - j * g); d.line([(0, b), (S, b)], fill=(255, 255, 255, 90), width=1)
index = {}
for i in range(cols):
    for j in range(rows):
        k = f'{chr(65 + i)}{j + 1}'
        a, b = P(x0 + i * g + 6, y1 - j * g - 6); d.text((a, b), k, fill=(255, 255, 255, 200), font=font)
        index[k] = [x0 + i * g, y1 - (j + 1) * g, x0 + (i + 1) * g, y1 - j * g]
json.dump({'cell_m': g, 'origin': osm['origin'], 'cells': index}, open(f'{DATA}/map_index.json', 'w'))
# key anchors
for name, (x, y) in {'Kailua Pier (origin)': (0, 0), 'Ahuʻena Heiau': (-60.4, -30.3), 'Mokuʻaikaua Church': (325, 50)}.items():
    a, b = P(x, y); d.ellipse((a - 9, b - 9, a + 9, b + 9), outline=(255, 40, 40), width=4); d.text((a + 14, b - 14), name, fill=(255, 255, 255), font=big, stroke_width=3, stroke_fill=(0, 0, 0))
d.text((20, S - 60), 'KONA · Kailua Bay master map · NAIP imagery (public domain) 0.56 m/px · OSM (ODbL) overlay · 200 m index grid', fill=(255, 255, 255), font=big, stroke_width=3, stroke_fill=(0, 0, 0))
img.convert('RGB').save(f'{OUT}/kona_master_map.jpg', quality=88)
# relief + bathymetry panel from the DEM
dem = np.load(f'{DATA}/dem.npy'); dm = json.load(open(f'{DATA}/dem_meta.json'))
z = dem[::-1]                                  # north up
gy, gx = np.gradient(z, dm['res'])
shade = np.clip(.6 + (-gx * .7 + gy * .7) / np.sqrt(1 + gx ** 2 + gy ** 2) * .8, 0, 1)
land = z > 0
rgb = np.zeros(z.shape + (3,))
t = np.clip(z / 900, 0, 1)
rgb[land] = (np.stack([.35 + .3 * t, .32 + .2 * t, .25 + .15 * t], -1))[land]
b = np.clip(-z / 1500, 0, 1)
rgb[~land] = np.stack([.05 + .25 * (1 - b), .25 + .45 * (1 - b), .45 + .45 * (1 - b)], -1)[~land]
rgb *= shade[..., None]
contour = (np.abs(((z / 50) % 1) - .5) > .47) & land
rgb[contour] *= .6
rim = np.abs(z) < 1.5
rgb[rim] = [1, 1, 1]
rel = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).resize((1200, 1200))
dr = ImageDraw.Draw(rel)
cxp = 600; dr.ellipse((cxp - 8, cxp - 8, cxp + 8, cxp + 8), outline=(255, 50, 50), width=3)
dr.text((20, 20), '12 x 12 km relief + bathymetry (AWS Terrain Tiles) · 50 m contours · red = pier', fill=(255, 255, 255), font=font)
rel.save(f'{OUT}/kona_relief.jpg', quality=90)
print('cells', len(index))
