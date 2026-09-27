"""Kona survey: loads the evidence layers into the local frame (origin Kailua Pier, metres, +X east, +Y north)."""
import json, math, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')

OSM = json.load(open(os.path.join(DATA, 'osm_index.json')))
F = OSM['features']
AXIS = json.load(open(os.path.join(DATA, 'swim_axis.json')))
DEM = np.load(os.path.join(DATA, 'dem.npy'))
DEM_META = json.load(open(os.path.join(DATA, 'dem_meta.json')))
SAT_CORE = json.load(open(os.path.join(DATA, 'sat_core.json')))
SAT_BAY = json.load(open(os.path.join(DATA, 'sat_bay.json')))

# detailed tile (the 1.8 km core frame) and its world bounds
CORE_C = SAT_CORE['center']
CORE_H = SAT_CORE['half']
TILE = (CORE_C[0] - CORE_H, CORE_C[1] - CORE_H, CORE_C[0] + CORE_H, CORE_C[1] + CORE_H)

# swim course (fitted to the OSM coastline; published leg lengths)
START = np.array(AXIS['start'])
DIRV = np.array(AXIS['dir'])
RIGHT = np.array([DIRV[1], -DIRV[0]])                  # seaward for the SSE heading
OUT_LEN, BACK_LEN = 1840.0, 1970.0
LANE_GAP = 100.0                                       # out and back buoy lines (inferred)


def dem_at(x, y):
    """Bilinear DEM sample (metres; negative = bathymetry)."""
    h, r = DEM_META['half'], DEM_META['res']
    fx, fy = (x + h) / r, (y + h) / r
    i0, j0 = int(np.clip(math.floor(fx), 0, DEM.shape[1] - 2)), int(np.clip(math.floor(fy), 0, DEM.shape[0] - 2))
    ax, ay = fx - i0, fy - j0
    return float(DEM[j0, i0] * (1 - ax) * (1 - ay) + DEM[j0, i0 + 1] * ax * (1 - ay) + DEM[j0 + 1, i0] * (1 - ax) * ay + DEM[j0 + 1, i0 + 1] * ax * ay)


def dem_grid(xs, ys):
    h, r = DEM_META['half'], DEM_META['res']
    fx, fy = (xs + h) / r, (ys + h) / r
    i0 = np.clip(np.floor(fx).astype(int), 0, DEM.shape[1] - 2)
    j0 = np.clip(np.floor(fy).astype(int), 0, DEM.shape[0] - 2)
    ax, ay = fx - i0, fy - j0
    return DEM[j0, i0] * (1 - ax) * (1 - ay) + DEM[j0, i0 + 1] * ax * (1 - ay) + DEM[j0 + 1, i0] * (1 - ax) * ay + DEM[j0 + 1, i0 + 1] * ax * ay


def coast_segments():
    segs = []
    for f in F['coastline']:
        p = np.array(f['pts'])
        segs.append(np.stack([p[:-1], p[1:]], 1))
    return np.concatenate(segs, 0)                         # (n, 2, 2)


def signed_coast_distance(xs, ys, segs=None):
    """Signed distance to the OSM coastline: + on land (left of the way), − at sea. Vectorised over a grid."""
    segs = coast_segments() if segs is None else segs
    P = np.stack([xs.ravel(), ys.ravel()], 1)
    best = np.full(len(P), 1e9)
    side = np.zeros(len(P))
    A, B = segs[:, 0], segs[:, 1]
    AB = B - A
    L2 = (AB ** 2).sum(1) + 1e-9
    for k in range(0, len(P), 4096):
        p = P[k:k + 4096][:, None, :]
        t = np.clip(((p - A[None]) * AB[None]).sum(-1) / L2[None], 0, 1)
        q = A[None] + AB[None] * t[..., None]
        d = np.sqrt(((p - q) ** 2).sum(-1))
        i = d.argmin(1)
        best[k:k + 4096] = d[np.arange(len(i)), i]
        ab = AB[i]
        ap = P[k:k + 4096] - A[i]
        side[k:k + 4096] = np.sign(ab[:, 0] * ap[:, 1] - ab[:, 1] * ap[:, 0])
    return (best * side).reshape(xs.shape)


def buoys():
    """Clockwise, buoys on the swimmer's right: outbound swimmers (SSE) are inshore of the yellow line,
    returning swimmers (NNW) seaward of the orange line. ~every 100 m (spacing inferred), red at the turn."""
    out = []
    for k in range(1, 19):
        out.append({'xy': (START + DIRV * (k * 100.0) + RIGHT * 30).tolist(), 'c': 'yellow', 'leg': 'out'})
        out.append({'xy': (START + DIRV * (k * 100.0) + RIGHT * 60).tolist(), 'c': 'orange', 'leg': 'back'})
    for off in (30, 60):
        out.append({'xy': (START + DIRV * OUT_LEN + RIGHT * off).tolist(), 'c': 'red', 'leg': 'turn'})
    return out


def turn_boats():
    t = START + DIRV * (OUT_LEN + 25)
    return [{'name': 'Body Glove (catamaran)', 'xy': (t + RIGHT * 28).tolist(), 'len': 20.0, 'kind': 'cat'},
            {'name': "Jack's Diving (dive boat)", 'xy': (t + RIGHT * 62).tolist(), 'len': 13.0, 'kind': 'dive'}]


def swim_path():
    """Centre line a swimmer follows (clockwise): out on the inshore side, around the boats, back seaward."""
    pts = [START + DIRV * s + RIGHT * 12 for s in np.linspace(0, OUT_LEN, 40)]
    t = START + DIRV * (OUT_LEN + 45)
    pts += [t + RIGHT * 12, t + RIGHT * 78]
    pts += [START + DIRV * s + RIGHT * 78 for s in np.linspace(OUT_LEN, -30, 40)]
    return [p.tolist() for p in pts]
