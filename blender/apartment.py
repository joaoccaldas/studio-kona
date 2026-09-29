"""The athlete's apartment, the first scene of the game (issue #24): pack for Kona before the flight.

Run:  blender -b --factory-startup --python-exit-code 1 -P blender/apartment.py
Out:  web/public/assets/apartment/apartment.glb   baked room (vertex colours = lit colour, drawn unlit in the game)
      renders/apartment_preview.jpg                 Cycles still from the game camera (APT_PREVIEW=1)

Lighting is baked with Cycles (diffuse direct + indirect) into a second colour attribute, "Baked", so a phone only
draws coloured triangles. Walls and floor are finely gridded so the sun patch and contact shadows survive in
vertex colour. Named empties tell the game where things go:
  SPOT_bike, SPOT_bikebox, SPOT_suitcase     bike stand, open bike box, open suitcase
  ITEM_xx                                    resting places for gear to pack (on floor, bed, desk, shelf)
  CAM_start, CAM_look                        the opening camera
Everything is invented set dressing (class X): a generic athlete's flat, not a real place.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import Builder, make_material  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'web', 'public', 'assets', 'apartment', 'apartment.glb')

X0, X1, Y0, Y1, H = -3.0, 3.0, -2.5, 2.5, 2.8
WIN = (-2.3, 0.3, 0.75, 2.45)                 # window on the back wall: x0, x1, z0, z1
WALL = (0.88, 0.86, 0.82, 1)
ACCENT = (0.36, 0.45, 0.38, 1)                # sage wall behind the bed
CEIL = (0.92, 0.91, 0.89, 1)
OAK = [(0.46, 0.3, 0.17, 1), (0.52, 0.34, 0.19, 1), (0.42, 0.27, 0.15, 1), (0.5, 0.33, 0.2, 1)]
WOOD = (0.35, 0.21, 0.11, 1)
LINEN = (0.85, 0.84, 0.8, 1)
DUVET = (0.55, 0.62, 0.68, 1)
RUG = [(0.75, 0.68, 0.55, 1), (0.62, 0.45, 0.32, 1), (0.25, 0.3, 0.33, 1)]
BLACK = (0.03, 0.03, 0.035, 1)
TERRACOTTA = (0.6, 0.3, 0.18, 1)
LEAF = [(0.08, 0.3, 0.12, 1), (0.1, 0.36, 0.14, 1), (0.06, 0.24, 0.1, 1)]
METAL = (0.55, 0.56, 0.58, 1)
BOOKS = [(0.7, 0.2, 0.15, 1), (0.15, 0.3, 0.55, 1), (0.85, 0.7, 0.3, 1), (0.2, 0.45, 0.35, 1), (0.9, 0.88, 0.8, 1), (0.3, 0.3, 0.32, 1)]


def grid_quad(b, origin, u, v, nu, nv, color_fn, skip=None):
    """A subdivided rectangle: origin + i/nu*u + j/nv*v. color_fn(s, t) -> RGBA; skip(s, t) -> True leaves a hole."""
    verts = [[b.bm.verts.new(Vector(origin) + Vector(u) * (i / nu) + Vector(v) * (j / nv)) for i in range(nu + 1)] for j in range(nv + 1)]
    faces = []
    for j in range(nv):
        for i in range(nu):
            s, t = (i + 0.5) / nu, (j + 0.5) / nv
            if skip and skip(s, t):
                continue
            f = b.bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
            c = color_fn(s, t)
            for loop in f.loops:
                loop[b.col] = c
            faces.append(f)
    return faces


def room():
    rnd = random.Random(4)
    parts = {}
    # Floor: oak planks 0.16 m wide running along X, 1.2–2.4 m long, 6 cm grid for the sun patch.
    b = Builder()
    plank_len = {}
    def oak(s, t):
        x, y = X0 + s * (X1 - X0), Y0 + t * (Y1 - Y0)
        row = int((y - Y0) / 0.16)
        off = (row * 0.73) % 1.9
        k = int((x - X0 + off) / 1.9)
        c = OAK[(row * 7 + k * 3) % len(OAK)]
        g = 1.0 + 0.04 * math.sin(x * 23 + row)            # faint grain
        return tuple(min(1, ch * g) for ch in c[:3]) + (1,)
    grid_quad(b, (X0, Y0, 0), (X1 - X0, 0, 0), (0, Y1 - Y0, 0), 100, 84, oak)
    parts['floor'] = b.finish('APT_floor')

    b = Builder()
    grid_quad(b, (X0, Y0, H), (0, Y1 - Y0, 0), (X1 - X0, 0, 0), 30, 25, lambda s, t: CEIL)
    parts['ceiling'] = b.finish('APT_ceiling')

    # Back wall (y = Y1) with the window hole, facing -Y.
    b = Builder()
    def in_win(s, t):
        x, z = X0 + s * (X1 - X0), t * H
        return WIN[0] < x < WIN[1] and WIN[2] < z < WIN[3]
    grid_quad(b, (X1, Y1, 0), (X0 - X1, 0, 0), (0, 0, H), 100, 46,
              lambda s, t: WALL, skip=lambda s, t: in_win(1 - s, t))
    parts['back'] = b.finish('APT_wall_back')
    # Left wall (x = X0), sage accent behind the bed, facing +X.
    b = Builder()
    grid_quad(b, (X0, Y1, 0), (0, Y0 - Y1, 0), (0, 0, H), 84, 46, lambda s, t: ACCENT if s < 0.55 else WALL)
    parts['left'] = b.finish('APT_wall_left')
    # Right wall (x = X1) and front wall (y = Y0): behind the camera, coarser.
    b = Builder()
    grid_quad(b, (X1, Y0, 0), (0, Y1 - Y0, 0), (0, 0, H), 42, 23, lambda s, t: WALL)
    grid_quad(b, (X0, Y0, 0), (X1 - X0, 0, 0), (0, 0, H), 50, 23, lambda s, t: WALL)
    parts['rear'] = b.finish('APT_wall_rear')

    # Skirting, window frame and sill.
    b = Builder()
    b.box(((X0 + X1) / 2, Y1 - 0.01, 0.05), (X1 - X0, 0.02, 0.1), WALL)
    b.box((X0 + 0.01, (Y0 + Y1) / 2, 0.05), (0.02, Y1 - Y0, 0.1), WALL)
    wx0, wx1, wz0, wz1 = WIN
    for x in (wx0, (wx0 + wx1) / 2, wx1):
        b.box((x, Y1 - 0.03, (wz0 + wz1) / 2), (0.06, 0.08, wz1 - wz0), BLACK)
    for z in (wz0, wz1, (wz0 + wz1) / 2 + 0.25):
        b.box(((wx0 + wx1) / 2, Y1 - 0.03, z), (wx1 - wx0, 0.08, 0.05), BLACK)
    b.box(((wx0 + wx1) / 2, Y1 - 0.12, wz0 - 0.03), (wx1 - wx0 + 0.2, 0.24, 0.04), (0.8, 0.78, 0.74, 1))
    parts['trim'] = b.finish('APT_trim')

    # Bed against the left wall, head at -X.
    b = Builder()
    bx, by = X0 + 1.05, 1.1
    b.box((bx, by, 0.17), (2.05, 1.6, 0.26), WOOD)
    b.box((bx, by, 0.4), (2.0, 1.55, 0.2), LINEN)
    b.box((bx + 0.25, by, 0.52), (1.45, 1.6, 0.07), DUVET)
    for dy in (-0.38, 0.38):
        b.box((X0 + 0.28, by + dy, 0.58), (0.35, 0.6, 0.14), LINEN)
    b.box((X0 + 0.04, by, 0.65), (0.06, 1.65, 0.9), WOOD)                                  # headboard
    parts['bed'] = b.finish('APT_bed')

    # Desk and chair along the right wall, shelf above.
    b = Builder()
    dx, dy = X1 - 0.4, 0.6
    b.box((dx, dy, 0.745), (0.7, 1.5, 0.04), OAK[1])
    for sx in (-0.3, 0.3):
        for sy in (-0.7, 0.7):
            b.box((dx + sx, dy + sy, 0.37), (0.04, 0.04, 0.74), BLACK)
    b.box((dx - 0.55, dy, 0.45), (0.45, 0.45, 0.05), BLACK)                                 # chair seat
    b.box((dx - 0.76, dy, 0.72), (0.04, 0.42, 0.5), BLACK)
    for sx in (-0.2, 0.2):
        for sy in (-0.2, 0.2):
            b.box((dx - 0.55 + sx, dy + sy, 0.22), (0.03, 0.03, 0.44), BLACK)
    b.box((X1 - 0.13, dy, 1.45), (0.26, 1.6, 0.03), OAK[0])                                 # shelf
    x = dy - 0.72
    for i in range(16):
        w = 0.03 + rnd.random() * 0.03
        h = 0.18 + rnd.random() * 0.1
        b.box((X1 - 0.13, x + w / 2, 1.465 + h / 2), (0.2, w, h), BOOKS[i % len(BOOKS)])
        x += w + 0.004
    b.box((X1 - 0.02, dy + 0.1, 1.2), (0.02, 0.7, 0.5), BLACK)                               # screen on the wall
    parts['desk'] = b.finish('APT_desk')

    # Rug, plant, lamp, poster.
    b = Builder()
    rx, ry = 0.3, -0.2
    def rug(s, t):
        d = max(abs(s - 0.5), abs(t - 0.5))
        return RUG[0] if d < 0.3 else RUG[1] if d < 0.4 else RUG[2]
    grid_quad(b, (rx - 1.2, ry - 0.85, 0.005), (2.4, 0, 0), (0, 1.7, 0), 48, 34, rug)
    px, py = X0 + 0.45, Y1 - 0.45                                                            # plant in the corner
    b.cyl((px, py, 0), (px, py, 0.42), 0.2, 0.24, TERRACOTTA, seg=14)
    for i in range(11):
        a = i / 11 * 2 * math.pi + rnd.random() * 0.3
        tilt = 0.5 + rnd.random() * 0.5
        L = 0.45 + rnd.random() * 0.35
        tip = (px + math.cos(a) * L * tilt, py + math.sin(a) * L * tilt, 0.42 + L * (1.2 - tilt * 0.6))
        b.cyl((px, py, 0.42), tip, 0.008, 0.008, LEAF[2], seg=4)
        b.ball(tip, 1.0, LEAF[i % 3], scale=(0.16, 0.1, 0.03), seg=8, rings=4)
    lx, ly = X1 - 0.35, Y1 - 0.35                                                             # floor lamp
    b.cyl((lx, ly, 0), (lx, ly, 0.03), 0.16, 0.16, BLACK, seg=12)
    b.cyl((lx, ly, 0.03), (lx, ly, 1.55), 0.012, 0.012, BLACK, seg=6)
    b.cyl((lx, ly, 1.45), (lx, ly, 1.72), 0.18, 0.1, LINEN, seg=14)
    b.box((X0 + 0.02, -1.0, 1.55), (0.02, 0.9, 1.2), BLACK)                                  # poster frame
    b.box((X0 + 0.035, -1.0, 1.55), (0.01, 0.8, 1.1), (0.95, 0.78, 0.45, 1))
    b.box((X0 + 0.04, -1.0, 1.2), (0.01, 0.8, 0.35), (0.05, 0.2, 0.3, 1))                   # ocean band
    b.box((X0 + 0.045, -1.0, 1.5), (0.01, 0.55, 0.3), (0.18, 0.12, 0.1, 1))                 # volcano silhouette
    b.box((X0 + 0.045, -0.85, 1.85), (0.01, 0.1, 0.1), (0.98, 0.9, 0.6, 1))                  # sun
    parts['decor'] = b.finish('APT_decor')

    # Bike stand by the window (the game places the chosen bike here).
    b = Builder()
    sx, sy = -0.7, 1.75
    b.box((sx, sy, 0.02), (1.0, 0.08, 0.04), BLACK)
    b.box((sx - 0.35, sy, 0.02), (0.06, 0.5, 0.04), BLACK)
    b.box((sx + 0.35, sy, 0.02), (0.06, 0.5, 0.04), BLACK)
    parts['stand'] = b.finish('APT_stand')
    return parts


def outside():
    """View through the window: morning sky and a line of rooftops. Not baked; drawn as-is in the game."""
    b = Builder()
    def sky(s, t):
        return (0.55 + 0.3 * t, 0.72 + 0.18 * t, 0.92, 1)
    grid_quad(b, (X1 + 2, Y1 + 4, -1), (X0 - X1 - 4, 0, 0), (0, 0, 5.5), 10, 12, sky)
    rnd = random.Random(9)
    x = X0 - 2
    while x < X1 + 2:
        w = 0.8 + rnd.random() * 1.5
        h = 0.6 + rnd.random() * 1.6
        b.box((x + w / 2, Y1 + 3.5, h / 2 - 0.3), (w, 0.2, h), (0.5 + rnd.random() * 0.15, 0.52, 0.55, 1))
        x += w + 0.1
    return b.finish('APT_outside')


def empties():
    def e(name, loc, rot_z=0.0):
        o = bpy.data.objects.new(name, None)
        o.location = loc
        o.rotation_euler = (0, 0, rot_z)
        bpy.context.scene.collection.objects.link(o)
    e('SPOT_bike', (-0.7, 1.75, 0.0), 0.0)
    e('SPOT_bikebox', (1.2, 1.55, 0.0), math.pi)
    e('SPOT_suitcase', (0.25, -0.35, 0.01), 0.3)
    e('CAM_start', (2.35, -2.15, 1.5))
    e('CAM_look', (-0.4, 0.9, 0.55))
    spots = [  # (x, y, z) resting places for loose gear
        (-2.3, 0.75, 0.56), (-1.9, 1.35, 0.56), (-1.4, 0.85, 0.56), (-1.0, 1.4, 0.56), (-0.6, 0.9, 0.56),   # bed
        (2.6, 0.1, 0.77), (2.6, 0.55, 0.77), (2.6, 1.0, 0.77), (2.55, 1.25, 0.77),                          # desk
        (-0.9, -0.7, 0.01), (-0.2, -1.0, 0.01), (0.9, -0.9, 0.01), (1.4, -0.2, 0.01), (-1.3, -0.1, 0.01),   # floor / rug
        (1.5, 0.6, 0.01), (-0.1, 0.6, 0.01), (0.7, 0.35, 0.01), (-1.9, -1.4, 0.01), (1.9, -1.5, 0.01),
        (-1.0, 2.3, 0.73), (-1.8, 2.3, 0.73), (-0.2, 2.3, 0.73),                                            # window sill
        (2.1, 1.9, 0.01), (0.3, 1.2, 0.01),
    ]
    for i, p in enumerate(spots):
        e(f'ITEM_{i:02d}', p, random.Random(i).random() * 6.28)


def bake(meshes):
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.samples = int(os.environ.get('BAKE_SPP', 96))
    scn.cycles.device = 'CPU'
    w = bpy.data.worlds.new('sky')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.7, 0.95, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2
    scn.world = w
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 5.5
    sun.angle = math.radians(1.5)
    sun.color = (1.0, 0.93, 0.82)
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = (math.radians(58), 0, math.radians(200))   # low morning sun through the back window
    scn.collection.objects.link(so)
    lamp = bpy.data.lights.new('lamp', 'POINT')
    lamp.energy = 40
    lamp.color = (1.0, 0.8, 0.6)
    lamp.shadow_soft_size = 0.2
    lo = bpy.data.objects.new('lamp', lamp)
    lo.location = (X1 - 0.35, Y1 - 0.35, 1.6)
    scn.collection.objects.link(lo)
    fill = bpy.data.lights.new('fill', 'AREA')
    fill.energy = 60
    fill.size = 3
    fo = bpy.data.objects.new('fill', fill)
    fo.location = (0, -1.0, H - 0.05)
    scn.collection.objects.link(fo)
    for ob in meshes:
        me = ob.data
        if 'Baked' not in me.color_attributes:
            me.color_attributes.new('Baked', 'FLOAT_COLOR', 'CORNER')
        me.color_attributes.active_color = me.color_attributes['Baked']
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    scn.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, target='VERTEX_COLORS')
    for ob in meshes:
        me = ob.data
        me.color_attributes.render_color_index = me.color_attributes.find('Baked')
    return so, lo, fo


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    make_material()
    parts = room()
    out = outside()
    empties()
    meshes = list(parts.values())
    out.hide_render = True            # the backdrop must not shade the sun during the bake
    lights = bake(meshes)
    out.hide_render = False
    # Export: room meshes carry "Baked" as the active colour; the outside keeps its own colours.
    for ob in meshes:
        me = ob.data
        base = me.color_attributes.get('Col')
        if base:
            me.color_attributes.remove(base)
    for o in lights:
        bpy.data.objects.remove(o)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    kw = dict(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_yup=True)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
    tris = sum(len(o.data.polygons) for o in meshes + [out])
    print(f'apartment: {tris} faces -> {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)')


if __name__ == '__main__':
    build()
