"""Kona P1: Kailua Bay swim + Kailua Pier transition.  Run inside Blender.

Evidence classes are noted inline: M measured (imagery/OSM/DEM), P published, F photographed, I inferred.
"""
import sys, os, math, json, random, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'shared'))
import bpy, bmesh
import numpy as np
from mathutils import Vector, noise
import survey as S
from geo import MB, extrude_poly, sweep_profile, balustrade, ccw, hip_roof, v2, circle_pts

TAU = math.tau
rnd = random.Random(10)
DATA = S.DATA


# ------------------------------------------------------------------ materials
MAT = {}


def pm(name, color, rough=.6, metal=0., emit=None, strength=0., trans=0., sheen=0., coat=0.):
    m = bpy.data.materials.new(name)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Transmission Weight'].default_value = trans
    b.inputs['Sheen Weight'].default_value = sheen
    b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    MAT[name] = m
    return m


def node(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        if k in n.inputs:
            n.inputs[k].default_value = v
        else:
            setattr(n, k, v)
    return n


def ortho_material(name, sat_file, tile, seabed=False):
    """Land: orthophoto albedo.  Seabed: orthophoto luminance -> sand (bright) / basalt & coral (dark)."""
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    uv = node(nt, 'ShaderNodeUVMap', uv_map='UVMap')
    t = node(nt, 'ShaderNodeTexImage')
    t.image = bpy.data.images.load(os.path.join(DATA, sat_file), check_existing=True)
    t.extension = 'EXTEND'
    nt.links.new(uv.outputs['UV'], t.inputs['Vector'])
    if not seabed:
        cc = node(nt, 'ShaderNodeBrightContrast', Bright=0.02, Contrast=0.05)
        nt.links.new(t.outputs['Color'], cc.inputs['Color'])
        nt.links.new(cc.outputs['Color'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = .85
    else:
        bw = node(nt, 'ShaderNodeRGBToBW')
        nt.links.new(t.outputs['Color'], bw.inputs['Color'])
        ramp = node(nt, 'ShaderNodeValToRGB')
        e = ramp.color_ramp.elements
        e[0].position, e[0].color = .16, (.10, .10, .085, 1)       # basalt / coral heads
        e[1].position, e[1].color = .42, (.78, .72, .56, 1)        # white carbonate sand
        e.new(.27).color = (.28, .30, .22, 1)                       # algae-covered rubble
        nt.links.new(bw.outputs['Val'], ramp.inputs['Fac'])
        nz = node(nt, 'ShaderNodeTexNoise', Scale=1.5, Detail=8.0)
        tc = node(nt, 'ShaderNodeTexCoord')
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        mix = node(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY', Factor=.35)
        nt.links.new(ramp.outputs['Color'], mix.inputs['A'])
        nt.links.new(nz.outputs['Color'], mix.inputs['B'])
        nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = .9
        bump = node(nt, 'ShaderNodeBump', Strength=.4)
        nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def water_material():
    """Ocean for Cycles: glassy surface with wind ripples + absorption/scatter volume (clear Kona water)."""
    m = bpy.data.materials.new('ocean')
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (1, 1, 1, 1)
    b.inputs['Roughness'].default_value = .02
    b.inputs['IOR'].default_value = 1.333
    b.inputs['Transmission Weight'].default_value = 1.0
    tc = node(nt, 'ShaderNodeTexCoord')
    mp = node(nt, 'ShaderNodeMapping', Scale=(.9, .6, 1.0))
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    w1 = node(nt, 'ShaderNodeTexNoise', Scale=.35, Detail=10.0, Roughness=.55)
    nt.links.new(mp.outputs['Vector'], w1.inputs['Vector'])
    bump = node(nt, 'ShaderNodeBump', Strength=.35, Distance=.08)
    nt.links.new(w1.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    vol = node(nt, 'ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (.35, .85, .9, 1)
    vol.inputs['Density'].default_value = .018
    vol.inputs['Absorption Color'].default_value = (.35, .78, .82, 1)
    nt.links.new(vol.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    MAT['ocean'] = m
    return m


def build_mats():
    pm('stucco_w', (.78, .76, .70), .8); pm('stucco_t', (.62, .52, .40), .8); pm('stucco_g', (.55, .56, .52), .8)
    pm('concrete', (.52, .50, .47), .85); pm('pier_side', (.36, .35, .33), .9)
    pm('basalt', (.07, .065, .06), .9); pm('thatch', (.36, .27, .15), .95, sheen=.3)
    pm('wood', (.28, .18, .10), .75); pm('kapa', (.92, .92, .88), .9)
    pm('steel', (.55, .56, .58), .35, metal=1.); pm('black', (.02, .02, .02), .5); pm('rubber', (.015, .015, .015), .7)
    pm('tent', (.93, .93, .92), .7, trans=.0, sheen=.4); pm('carpet_blue', (.03, .10, .32), .9)
    pm('yellow_buoy', (.95, .72, .02), .35, coat=.4); pm('orange_buoy', (.95, .32, .02), .35, coat=.4); pm('red_buoy', (.75, .03, .02), .35, coat=.4)
    pm('hull_white', (.86, .87, .86), .3, coat=.5); pm('hull_blue', (.03, .12, .35), .3, coat=.5); pm('canvas', (.05, .15, .35), .8)
    pm('glass_b', (.05, .08, .09), .05); pm('palm_leaf', (.10, .20, .05), .8); pm('palm_trunk', (.30, .24, .17), .9)
    pm('canopy', (.05, .12, .04), .85); pm('sand', (.80, .72, .56), .95)
    pm('canoe_red', (.65, .06, .03), .4, coat=.4); pm('canoe_yel', (.9, .65, .05), .4, coat=.4)
    for i, c in enumerate([(.85, .1, .1), (.05, .05, .05), (.9, .9, .9), (.1, .3, .8), (.95, .6, .05), (.1, .6, .3)]):
        pm(f'bike{i}', c, .35, metal=.3, coat=.6)
    water_material()


# ------------------------------------------------------------------ terrain + seabed (one grid, two materials)
def terrain(coll, step=4.0):
    x0, y0, x1, y1 = S.TILE
    nx, ny = int((x1 - x0) / step) + 1, int((y1 - y0) / step) + 1
    xs, ys = np.meshgrid(np.linspace(x0, x1, nx), np.linspace(y0, y1, ny))
    t = time.time()
    sd = S.signed_coast_distance(xs, ys)
    dem = S.dem_grid(xs, ys)
    print('coast SDF', round(time.time() - t, 1), 's')
    rng = np.random.default_rng(3)
    land = np.maximum(.45 + .09 * np.clip(sd, 0, 25), dem)
    sea = -np.minimum(.25 + .11 * np.abs(sd) + .00004 * np.abs(sd) ** 2, np.maximum(-dem, .25 + .11 * np.abs(sd) * .5))
    z = np.where(sd >= 0, land, sea)
    # reef micro-relief (seabed) and lava roughness at the waterline
    bumps = np.zeros_like(z)
    for sc, a in ((.09, .6), (.3, .25), (1.1, .08)):
        ph = rng.random(2) * 100
        bumps += a * np.sin(xs * sc + ph[0] + 2 * np.sin(ys * sc * .7)) * np.sin(ys * sc * 1.1 + ph[1] + 1.5 * np.sin(xs * sc * .6))
    z += np.where(sd < 0, bumps * np.clip(np.abs(sd) / 30, 0, 1), np.where(sd < 6, bumps * .5, 0))
    verts = np.stack([xs, ys, z], -1).reshape(-1, 3)
    faces = []
    mats = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))
            mats.append(0 if (sd[j, i] + sd[j + 1, i + 1]) > 0 else 1)
    me = bpy.data.meshes.new('KONA_terrain')
    me.from_pydata(verts.tolist(), [], faces)
    me.polygons.foreach_set('material_index', mats)
    uv = me.uv_layers.new(name='UVMap')
    # uv from world xy over the core frame
    lx, ly = verts[:, 0], verts[:, 1]
    u = (lx - x0) / (x1 - x0)
    v = (ly - y0) / (y1 - y0)
    loop_v = np.zeros(len(me.loops), dtype=np.int64)
    me.loops.foreach_get('vertex_index', loop_v)
    uvs = np.stack([u[loop_v], v[loop_v]], 1).ravel()
    uv.data.foreach_set('uv', uvs)
    me.materials.append(ortho_material('land_ortho', 'sat_core.jpg', S.TILE))
    me.materials.append(ortho_material('seabed', 'sat_core.jpg', S.TILE, seabed=True))
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new('KONA_terrain', me)
    coll.objects.link(o)
    json.dump({'nx': nx, 'ny': ny, 'step': step, 'tile': S.TILE}, open(os.path.join(DATA, 'terrain_meta.json'), 'w'))
    return o, sd, xs, ys


def ocean(coll):
    """Closed water volume (top at 0) for Cycles previews; the browser uses its own ocean shader."""
    mb = MB('WATER_ocean', [MAT['ocean']])
    x0, y0, x1, y1 = -3000, -4000, 3000, 2000
    top = [(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)]
    bot = [(x, y, -80) for x, y, _ in top]
    mb.poly(top, 0)
    mb.poly(list(reversed(bot)), 0)
    for i in range(4):
        a, b = top[i], top[(i + 1) % 4]
        mb.quad(bot[i], bot[(i + 1) % 4], b, a, 0)
    return mb.build(coll, props={'nobake': 1})


def far_terrain(coll):
    """12 km of DEM around the tile at 40 m with the 4.5 m/px bay imagery: Hualālai's slopes for the horizon."""
    step, half = 40.0, 5800.0
    n = int(2 * half / step) + 1
    xs, ys = np.meshgrid(np.linspace(-half, half, n), np.linspace(-half, half, n))
    z = S.dem_grid(xs, ys).astype(np.float64)
    z = np.where(z > 0, z + .5, np.minimum(z, -8))
    # sink under the detailed tile
    x0, y0, x1, y1 = S.TILE
    inside = (xs > x0 + 2) & (xs < x1 - 2) & (ys > y0 + 2) & (ys < y1 - 2)
    verts = np.stack([xs, ys, z], -1).reshape(-1, 3)
    ins = inside.ravel()
    faces = [(j * n + i, j * n + i + 1, (j + 1) * n + i + 1, (j + 1) * n + i) for j in range(n - 1) for i in range(n - 1)
             if not (ins[j * n + i] and ins[j * n + i + 1] and ins[(j + 1) * n + i] and ins[(j + 1) * n + i + 1])]
    me = bpy.data.meshes.new('KONA_far')
    me.from_pydata(verts.tolist(), [], faces)
    uv = me.uv_layers.new(name='UVMap')
    c, h = S.SAT_BAY['center'], S.SAT_BAY['half']
    loop_v = np.zeros(len(me.loops), dtype=np.int64)
    me.loops.foreach_get('vertex_index', loop_v)
    uvs = np.stack([(verts[loop_v, 0] - (c[0] - h)) / (2 * h), (verts[loop_v, 1] - (c[1] - h)) / (2 * h)], 1).ravel()
    uv.data.foreach_set('uv', uvs)
    m = ortho_material('far_ortho', 'sat_bay.jpg', None)
    me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new('KONA_far', me)
    coll.objects.link(o)
    return o


# ------------------------------------------------------------------ buildings (OSM footprints)
HEIGHT_BY_TYPE = {'apartments': 12.0, 'hotel': 18.0, 'house': 5.5, 'retail': 6.5, 'commercial': 7.5, 'garage': 3.2,
                  'roof': 4.2, 'warehouse': 7.0, 'office': 9.0, 'church': 9.0, 'school': 7.0, 'toilets': 3.2, 'yes': 6.0}
KNOWN_HEIGHT = {'Courtyard by Marriott King Kamehameha': 20.0}      # F: photo #21 shows 6 storeys


def roof_color(img, pts):
    """Average orthophoto colour inside the footprint (the real roof)."""
    x0, y0, x1, y1 = S.TILE
    W, H = img.shape[1], img.shape[0]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    samples = []
    for k in range(9):
        fx = cx + (rnd.random() - .5) * (max(xs) - min(xs)) * .5
        fy = cy + (rnd.random() - .5) * (max(ys) - min(ys)) * .5
        i = int((fx - x0) / (x1 - x0) * (W - 1))
        j = int((y1 - fy) / (y1 - y0) * (H - 1))
        if 0 <= i < W and 0 <= j < H:
            samples.append(img[j, i])
    if not samples:
        return (.5, .45, .4)
    c = np.mean(samples, 0) / 255.0
    return tuple((c ** 2.2).tolist())


def buildings(coll):
    im = bpy.data.images.load(os.path.join(DATA, 'sat_core.jpg'), check_existing=True)
    W, H = im.size
    px = np.empty(W * H * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    img = (px.reshape(H, W, 4)[::-1, :, :3] * 255.0)          # Blender stores bottom-up; flip to top-down
    walls = MB('KONA_buildings', [MAT['stucco_w'], MAT['stucco_t'], MAT['stucco_g']])
    roofs = {}
    x0, y0, x1, y1 = S.TILE
    count = 0
    for f in S.F['building']:
        if not f['closed'] or len(f['pts']) < 4:
            continue
        pts = [tuple(p) for p in f['pts'][:-1]]
        if not all(x0 < p[0] < x1 and y0 < p[1] < y1 for p in pts):
            continue
        kind = f['tags'].get('building', 'yes')
        h = f.get('h') or HEIGHT_BY_TYPE.get(kind, 6.0)
        name = f['tags'].get('name', '')
        for k, v in KNOWN_HEIGHT.items():
            if k.lower() in name.lower():
                h = v
        area = abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))) / 2
        if kind == 'yes' and area > 900:
            h = max(h, 9.0)
        base = max(.3, S.dem_at(*pts[0]))
        rc = roof_color(img, pts)
        poly = ccw(pts)
        extrude_poly(walls, poly, base, base + h, rnd.randrange(3), top=False)
        roofmb = ROOFS.setdefault('all', MB('KONA_roofs', [ROOF_MAT()]))
        n0 = len(roofmb.f)
        if len(poly) == 4 and area < 700 and kind in ('house', 'yes', 'retail', 'commercial'):
            hip_roof(roofmb, poly, base + h, 22, 0, eave=.6)
        else:
            roofmb.poly([(p[0], p[1], base + h) for p in poly], 0)
            sweep_profile(walls, poly, base + h - .02, [(0, 0), (.1, 0), (.1, .6), (0, .6)], 0)   # parapet
        ROOF_COLS.extend([rc] * (len(roofmb.f) - n0))
        count += 1
    out = [walls.build(coll)]
    ro = ROOFS['all'].build(coll)
    ca = ro.data.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for pi, poly_ in enumerate(ro.data.polygons):
        c = ROOF_COLS[pi]
        for li in poly_.loop_indices:
            ca.data[li].color = (*c, 1)
    ro.data.color_attributes.active_color = ca
    out.append(ro)
    print('buildings', count, 'roof colours', len(roofs))
    return [o for o in out if o]


ROOFS = {}
ROOF_COLS = []


def ROOF_MAT():
    """Roofs: base colour = sampled orthophoto colour per face (vertex colour)."""
    if 'roof_vc' in MAT:
        return MAT['roof_vc']
    m = pm('roof_vc', (1, 1, 1), .7)
    nt = m.node_tree
    a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'
    nt.links.new(a.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    return m


# ------------------------------------------------------------------ Kailua Pier + transition
PIER_DECK = 2.2           # I: deck ~2 m above MSL (photos)


def pier(coll):
    f = next(f for f in S.F['pier'] if f['tags'].get('name') == 'Kailua Pier')
    poly = ccw([tuple(p) for p in f['pts'][:-1]])
    mb = MB('KONA_pier', [MAT['concrete'], MAT['pier_side'], MAT['black'], MAT['steel'], MAT['carpet_blue']])
    extrude_poly(mb, poly, -4.0, PIER_DECK, 1, 0)
    sweep_profile(mb, poly, PIER_DECK - .05, [(0, 0), (.15, 0), (.15, .35), (0, .35)], 0)        # curb
    # bollards every ~8 m on the seaward edges, light poles every ~25 m
    n = len(poly)
    for i in range(n):
        a, b = v2(poly[i]), v2(poly[(i + 1) % n])
        L = (b - a).length
        d = (b - a) / max(L, 1e-6)
        nrm = Vector((d.y, -d.x))
        for k in range(int(L / 8)):
            p = a + d * (k * 8 + 4) - nrm * .5
            mb.cylinder((p.x, p.y, PIER_DECK), .18, .55, n=10, m=2)
        for k in range(int(L / 25)):
            p = a + d * (k * 25 + 12) - nrm * 1.0
            mb.cylinder((p.x, p.y, PIER_DECK), .08, 7.0, n=8, m=3)
    breaks = [f for f in S.F['pier'] if f['tags'].get('man_made') == 'breakwater']
    rock = MB('KONA_breakwater', [MAT['basalt']])
    for f2 in breaks:
        extrude_poly(rock, ccw([tuple(p) for p in f2['pts'][:-1]]), -3.0, 1.4, 0, 0)
    return poly, [mb.build(coll), rock.build(coll)]


def pier_frame(poly):
    """Principal axes of the pier deck: long axis direction, centre, extents."""
    P = np.array(poly)
    c = P.mean(0)
    u, s, vt = np.linalg.svd(P - c)
    ax = vt[0]
    if ax[1] < 0:
        ax = -ax
    pr = (P - c) @ ax
    pn = (P - c) @ np.array([-ax[1], ax[0]])
    return c, ax, (pr.min(), pr.max()), (pn.min(), pn.max())


def transition(coll, poly):
    """T1/T2 on the pier (I: modelled on prior-year photos; the 2026 layout is not published yet).
    Rows of racks across the deck, two change tents by the swim exit, blue carpet path, swim-exit stairs."""
    c, ax, (a0, a1), (b0, b1) = pier_frame(poly)
    nrm = np.array([-ax[1], ax[0]])
    inside = lambda p: point_in(poly, p)
    racks = MB('KONA_racks', [MAT['steel']])
    tents = MB('KONA_tents', [MAT['tent'], MAT['steel']])
    carpet = MB('KONA_carpet', [MAT['carpet_blue']])
    bikes = []
    # racks: rows perpendicular to the pier's long axis every 2.4 m, leaving a 4 m central aisle
    s = a0 + 14
    while s < a1 - 8:
        for side in (-1, 1):
            t0, t1 = (2.0, b1 - 1.5) if side > 0 else (b0 + 1.5, -2.0)
            if t1 - t0 < 3:
                continue
            p0 = c + ax * s + nrm * t0
            p1 = c + ax * s + nrm * t1
            if not (inside(p0) and inside(p1)):
                continue
            z = PIER_DECK + 1.25
            racks.box_between((p0[0], p0[1], z), (p1[0], p1[1], z), .06, .06, 0)
            for tt in np.arange(t0, t1, 3.0):
                q = c + ax * s + nrm * tt
                racks.box_between((q[0], q[1], PIER_DECK), (q[0], q[1], z), .05, .05, 0)
            for k, tt in enumerate(np.arange(t0 + .3, t1 - .3, .55)):
                q = c + ax * s + nrm * tt
                face = 1 if k % 2 else -1                       # alternate front/back
                bikes.append({'x': round(float(q[0]), 2), 'y': round(float(q[1]), 2), 'rot': round(math.atan2(ax[1], ax[0]) + (0 if face > 0 else math.pi), 3),
                              'c': rnd.randrange(6)})
        s += 2.4
    # change tents near the landward end (swim exit side), and the carpet path from the stairs
    for k, off in enumerate((-5.5, 5.5)):
        q = c + ax * (a0 + 7) + nrm * off
        tent(tents, (q[0], q[1]), math.atan2(ax[1], ax[0]), 10.0, 8.0)
    p0 = c + ax * (a0 + 2) + nrm * (b0 + .5)
    p1 = c + ax * (a1 - 4)
    carpet.box(((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, PIER_DECK + .01), (np.linalg.norm(p1 - p0), 2.4, .02), 0,
               rot=math.atan2(p1[1] - p0[1], p1[0] - p0[0]))
    json.dump(bikes, open(os.path.join(DATA, 'bikes.json'), 'w'))
    print('bikes racked', len(bikes))
    return bikes, [racks.build(coll), tents.build(coll, smooth=True, sharp=40), carpet.build(coll)]


def point_in(poly, p):
    x, y = p
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1:
            c = not c
    return c


def tent(mb, c, rot, L, W, h=3.0, peak=4.6):
    co, si = math.cos(rot), math.sin(rot)
    P = lambda x, y, z: (c[0] + x * co - y * si, c[1] + x * si + y * co, PIER_DECK + z)
    for sx in (-1, 1):
        for sy in (-1, 1):
            mb.box_between(P(sx * L / 2, sy * W / 2, 0), P(sx * L / 2, sy * W / 2, h), .08, .08, 1)
    A, B, C, D = P(-L / 2, -W / 2, h), P(L / 2, -W / 2, h), P(L / 2, W / 2, h), P(-L / 2, W / 2, h)
    R0, R1 = P(-L / 2 + W / 2, 0, peak), P(L / 2 - W / 2, 0, peak)
    mb.quad(A, B, R1, R0, 0); mb.quad(C, D, R0, R1, 0); mb.tri(B, C, R1, 0); mb.tri(D, A, R0, 0)
    for (x0_, y0_), (x1_, y1_) in (((-1, -1), (1, -1)), ((1, 1), (-1, 1))):       # side walls (valance)
        mb.quad(P(x0_ * L / 2, y0_ * W / 2, h - .6), P(x1_ * L / 2, y1_ * W / 2, h - .6), P(x1_ * L / 2, y1_ * W / 2, h), P(x0_ * L / 2, y0_ * W / 2, h), 0)


def bike_proto(coll):
    """Racked TT bike (hung by the saddle nose): disc rear wheel, deep front wheel, aero frame, base bar + extensions."""
    mb = MB('PROTO_bike', [MAT['bike0'], MAT['rubber'], MAT['black'], MAT['steel']])
    R = .34
    for x, disc in ((-.5, True), (.5, False)):
        ring = [(x + R * math.cos(a), 0, .36 + R * math.sin(a)) for a in [i / 24 * TAU for i in range(24)]]
        for p, q in zip(ring, ring[1:] + ring[:1]):
            mb.box_between(p, q, .025, .03, 1)
        if disc:
            mb.poly(ring, 2)
        else:
            inner = [(x + R * .72 * math.cos(a), 0, .36 + R * .72 * math.sin(a)) for a in [i / 24 * TAU for i in range(24)]]
            for i in range(24):
                mb.quad(ring[i], ring[(i + 1) % 24], inner[(i + 1) % 24], inner[i], 2)
    bb, seat, head = (0, 0, .30), (-.18, 0, .95), (.42, 0, .88)
    for a, b, w in ((bb, seat, .05), (bb, head, .06), (seat, head, .04), (bb, (-.5, 0, .36), .03), (seat, (-.5, 0, .36), .025), (head, (.5, 0, .36), .035)):
        mb.box_between(a, b, w, w * 1.6, 0)
    mb.box_between((-.12, 0, 1.0), (-.32, 0, 1.0), .1, .04, 2)                 # saddle
    mb.box_between((.42, -.2, .92), (.42, .2, .92), .03, .03, 2)              # base bar
    mb.box_between((.42, -.05, .97), (.72, -.05, .98), .02, .02, 2)
    mb.box_between((.42, .05, .97), (.72, .05, .98), .02, .02, 2)
    o = mb.build(coll, props={'nobake': 1, 'proto': 'bike'})
    return o


# ------------------------------------------------------------------ Ahuʻena Heiau (on its lava-rock platform)
def heiau(coll):
    c = Vector((-60.4, -30.3))          # M: OSM node
    rot = math.radians(-18)             # I: aligned with the platform edges in the imagery
    co, si = math.cos(rot), math.sin(rot)
    P = lambda x, y, z: (c.x + x * co - y * si, c.y + x * si + y * co, z)
    rock = MB('KONA_heiau_platform', [MAT['basalt']])
    wood = MB('KONA_heiau_wood', [MAT['wood'], MAT['thatch'], MAT['kapa']])
    L, W, H = 28.0, 16.0, 1.9           # F: long low platform (photos 08, 13)
    q = [P(-L / 2, -W / 2, 0)[:2], P(L / 2, -W / 2, 0)[:2], P(L / 2, W / 2, 0)[:2], P(-L / 2, W / 2, 0)[:2]]
    extrude_poly(rock, ccw(q), -2.0, H, 0, 0)
    for k in range(260):                # individual boulders on the faces (dry-stacked lava)
        e = rnd.randrange(4)
        a, b = Vector(q[e]), Vector(q[(e + 1) % 4])
        t = rnd.random()
        p = a.lerp(b, t)
        n = Vector(((b - a).y, -(b - a).x)).normalized() if ccw(q) == q else -Vector(((b - a).y, -(b - a).x)).normalized()
        rock.box((p.x, p.y, rnd.uniform(-.8, H - .2)), (rnd.uniform(.4, .9), rnd.uniform(.3, .7), rnd.uniform(.3, .6)), 0, rot=rnd.random() * 3)
    # hale (thatched house): steep A-frame
    hx, hy, hl, hw, hh, ridge = -4.0, 0.0, 9.0, 5.5, 2.0, 6.4
    for sx in (-1, 1):
        for sy in (-1, 1):
            wood.box_between(P(hx + sx * hl / 2, hy + sy * hw / 2, H), P(hx + sx * hl / 2, hy + sy * hw / 2, H + hh), .2, .2, 0)
    A, B, Cc, D = P(hx - hl / 2 - .3, hy - hw / 2 - .4, H + hh - .2), P(hx + hl / 2 + .3, hy - hw / 2 - .4, H + hh - .2), P(hx + hl / 2 + .3, hy + hw / 2 + .4, H + hh - .2), P(hx - hl / 2 - .3, hy + hw / 2 + .4, H + hh - .2)
    R0, R1 = P(hx - hl / 2 - .3, hy, H + ridge), P(hx + hl / 2 + .3, hy, H + ridge)
    wood.quad(A, B, R1, R0, 1); wood.quad(Cc, D, R0, R1, 1); wood.tri(B, Cc, R1, 1); wood.tri(D, A, R0, 1)
    for sx in (-1, 1):                  # thatched walls
        wood.quad(P(hx + sx * hl / 2, hy - hw / 2, H), P(hx + sx * hl / 2, hy + hw / 2, H), P(hx + sx * hl / 2, hy + hw / 2, H + hh), P(hx + sx * hl / 2, hy - hw / 2, H + hh), 1)
    # ʻanuʻu (oracle tower): white kapa-wrapped lattice, ~9 m
    tx, ty = 8.0, -2.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            wood.box_between(P(tx + sx * 1.3, ty + sy * 1.3, H), P(tx + sx * .9, ty + sy * .9, H + 9.0), .15, .15, 0)
    for zz in np.arange(H + 1.0, H + 9.0, 1.1):
        k = 1.3 - (zz - H) / 9 * .4
        wood.quad(P(tx - k, ty - k, zz), P(tx + k, ty - k, zz), P(tx + k, ty - k, zz + .8), P(tx - k, ty - k, zz + .8), 2)
        wood.quad(P(tx - k, ty + k, zz + .8), P(tx + k, ty + k, zz + .8), P(tx + k, ty + k, zz), P(tx - k, ty + k, zz), 2)
    # kiʻi (carved figures) along the seaward edge + lashed pole fence
    for k in range(9):
        x = -L / 2 + 2 + k * (L - 4) / 8
        wood.cylinder(P(x, W / 2 - 1.0, H), .28, 2.6 + (k % 3) * .5, n=8, m=0, r_top=.22)
        wood.dome(P(x, W / 2 - 1.0, 0), .3, .4, n=8, rings=3, m=0, z0=H + 2.6 + (k % 3) * .5)
    for k in range(40):
        x = -L / 2 + .5 + k * (L - 1) / 39
        wood.box_between(P(x, -W / 2 + .5, H), P(x, -W / 2 + .5, H + 1.2), .07, .07, 0)
    wood.box_between(P(-L / 2 + .5, -W / 2 + .5, H + 1.1), P(L / 2 - .5, -W / 2 + .5, H + 1.1), .06, .06, 0)
    return [rock.build(coll), wood.build(coll)]


# ------------------------------------------------------------------ swim course: buoys + turn boats
def course(coll):
    by = MB('KONA_buoys', [MAT['yellow_buoy'], MAT['orange_buoy'], MAT['red_buoy'], MAT['black']])
    for b in S.buoys():
        x, y = b['xy']
        m = {'yellow': 0, 'orange': 1, 'red': 2}[b['c']]
        big = b['c'] == 'red'
        r, h = (1.0, 2.4) if big else (.6, 1.6)
        by.cylinder((x, y, -.5), r, h, n=16, m=m, r_top=r * .75)
        by.dome((x, y, 0), r * .75, r * .5, n=16, rings=4, m=m, z0=h - .5)
    boats = MB('KONA_boats', [MAT['hull_white'], MAT['hull_blue'], MAT['canvas'], MAT['glass_b'], MAT['steel']])
    for bt in S.turn_boats():
        x, y = bt['xy']
        rot = math.atan2(S.DIRV[1], S.DIRV[0]) + math.pi / 2
        if bt['kind'] == 'cat':
            catamaran(boats, (x, y), rot, bt['len'])
        else:
            dive_boat(boats, (x, y), rot, bt['len'])
    return [by.build(coll, smooth=True, sharp=50), boats.build(coll, smooth=True, sharp=40)]


def hull(mb, c, rot, L, W, H, m, dy=0.0, n=12):
    co, si = math.cos(rot), math.sin(rot)
    P = lambda x, y, z: (c[0] + x * co - (y + dy) * si, c[1] + x * si + (y + dy) * co, z)
    rings = []
    for i in range(n + 1):
        t = i / n
        x = -L / 2 + L * t
        bow = max(0.0, (t - .72) / .28)
        w = W / 2 * (1 - bow ** 1.6)
        keel = -.7 * H + .5 * H * bow
        rings.append([P(x, -w, .6 * H), P(x, -w * .8, keel * .6), P(x, 0, keel), P(x, w * .8, keel * .6), P(x, w, .6 * H)])
    for i in range(n):
        for k in range(4):
            mb.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1], m)
    mb.poly(list(reversed(rings[0])), m)
    return P


def catamaran(mb, c, rot, L):
    for dy in (-3.2, 3.2):
        hull(mb, c, rot, L, 1.8, 1.6, 0, dy)
    co, si = math.cos(rot), math.sin(rot)
    P = lambda x, y, z: (c[0] + x * co - y * si, c[1] + x * si + y * co, z)
    mb.box(P(-1, 0, 1.25), (L * .8, 8.0, .35), 0, rot=rot)
    mb.box(P(-2.5, 0, 2.6), (7.0, 6.0, 2.4), 0, rot=rot)
    mb.box(P(-2.5, 0, 3.9), (7.5, 6.6, .2), 1, rot=rot)
    mb.box(P(1.2, 0, 2.6), (.1, 5.4, 1.2), 3, rot=rot)
    mb.box(P(-2.5, 0, 4.6), (5.0, 5.0, .08), 2, rot=rot)                     # sun canopy
    for sx in (-1, 1):
        for sy in (-1, 1):
            mb.box_between(P(-2.5 + sx * 2.4, sy * 2.4, 4.0), P(-2.5 + sx * 2.4, sy * 2.4, 4.6), .06, .06, 4)


def dive_boat(mb, c, rot, L):
    P = hull(mb, c, rot, L, 4.2, 1.8, 1)
    co, si = math.cos(rot), math.sin(rot)
    Q = lambda x, y, z: (c[0] + x * co - y * si, c[1] + x * si + y * co, z)
    mb.box(Q(-.5, 0, 1.2), (L * .75, 3.8, .2), 0, rot=rot)
    mb.box(Q(1.2, 0, 2.1), (3.0, 2.8, 1.8), 0, rot=rot)
    mb.box(Q(2.6, 0, 2.3), (.1, 2.4, .8), 3, rot=rot)
    mb.box(Q(-2.5, 0, 3.4), (4.5, 3.6, .08), 2, rot=rot)
    for sx in (-1, 1):
        for sy in (-1, 1):
            mb.box_between(Q(-2.5 + sx * 2.0, sy * 1.6, 1.3), Q(-2.5 + sx * 2.0, sy * 1.6, 3.4), .05, .05, 4)


# ------------------------------------------------------------------ palms, canoes
def palm_proto(coll):
    mb = MB('PROTO_palm', [MAT['palm_trunk'], MAT['palm_leaf']])
    pts = [(.35 * (z / 12) ** 2, 0, z) for z in np.linspace(0, 12, 13)]
    for i, (p, q) in enumerate(zip(pts, pts[1:])):
        mb.cylinder(p, .24 - i * .006, 1.0, n=8, m=0, r_top=.23 - i * .006, cap=False)
    top = Vector(pts[-1])
    for i in range(16):
        a = i / 16 * TAU
        d = Vector((math.cos(a), math.sin(a), 0))
        droop = .25 + .35 * (i % 3) / 2
        prev = top
        for k in range(1, 7):
            t = k / 6
            p = top + d * (4.6 * t) + Vector((0, 0, 1.3 * t - droop * 5 * t * t))
            side = d.cross(Vector((0, 0, 1))) * (.62 * math.sin(math.pi * t ** .8) + .05)
            mb.quad(prev - side * .85, p - side, p + side, prev + side * .85, 1)
            mb.quad(prev + side * .85, p + side, p - side, prev - side * .85, 1)
            prev = p
    return mb.build(coll, smooth=True, sharp=80, props={'nobake': 1, 'proto': 'palm'})


def canoes(coll):
    mb = MB('KONA_canoes', [MAT['canoe_red'], MAT['canoe_yel'], MAT['wood']])
    for k, (x, y, r, m) in enumerate(((-38, -8, 1.3, 0), (-41, -12, 1.25, 1), (-35, -15, 1.4, 0))):   # F: photo 19 (Kamakahonu)
        hull(mb, (x, y), r, 12.0, .7, .7, m)
        co, si = math.cos(r), math.sin(r)
        for ix in (-2.5, 2.5):
            mb.box_between((x + ix * co, y + ix * si, .75), (x + ix * co - 2.4 * si, y + ix * si + 2.4 * co, .75), .08, .08, 2)
        mb.box_between((x - 3 * co - 2.4 * si, y - 3 * si + 2.4 * co, .5), (x + 3 * co - 2.4 * si, y + 3 * si + 2.4 * co, .5), .15, .15, 2)
    return [mb.build(coll, smooth=True, sharp=50)]


def trees():
    """OSM trees (M) + coconut palms lining the beaches/seawall where the imagery shows crowns (I species)."""
    out = [{'x': t[0], 'y': t[1], 'k': 'palm', 's': 1.0} for t in S.OSM['trees']]
    return out


# ------------------------------------------------------------------ race-morning sun
def sun_position(lat, lon, y, mo, d, h_local, tz=-10):
    """NOAA-style solar position (degrees): elevation, azimuth (from north, clockwise)."""
    import datetime
    dt = datetime.datetime(y, mo, d) + datetime.timedelta(hours=h_local - tz)
    jd = (dt - datetime.datetime(2000, 1, 1, 12)).total_seconds() / 86400
    g = math.radians((357.529 + .98560028 * jd) % 360)
    q = (280.459 + .98564736 * jd) % 360
    L = math.radians((q + 1.915 * math.sin(g) + .020 * math.sin(2 * g)) % 360)
    e = math.radians(23.439 - .00000036 * jd)
    ra = math.atan2(math.cos(e) * math.sin(L), math.cos(L))
    dec = math.asin(math.sin(e) * math.sin(L))
    gmst = (18.697374558 + 24.06570982441908 * jd) % 24
    ha = math.radians((gmst * 15 + lon) % 360) - ra
    la = math.radians(lat)
    el = math.asin(math.sin(la) * math.sin(dec) + math.cos(la) * math.cos(dec) * math.cos(ha))
    az = math.atan2(-math.sin(ha), math.tan(dec) * math.cos(la) - math.sin(la) * math.cos(ha))
    return math.degrees(el), math.degrees(az) % 360


def build_all(coll):
    build_mats()
    t = time.time()
    objs = []
    ter, *_ = terrain(coll)
    objs.append(ter)
    objs.append(far_terrain(coll))
    objs += buildings(coll)
    poly, po = pier(coll)
    objs += po
    bikes, to = transition(coll, poly)
    objs += to
    objs += heiau(coll)
    objs += course(coll)
    objs += canoes(coll)
    protos = {'bike': bike_proto(coll), 'palm': palm_proto(coll)}
    print('P1 built', round(time.time() - t, 1), 's')
    return objs, protos, bikes, trees()
