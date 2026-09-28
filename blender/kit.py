"""Kona living-island asset kit: race-week infrastructure and island life, as one GLB.

Run:  blender -b --factory-startup --python-exit-code 1 -P blender/kit.py
Out:  web/public/assets/kit/kona_kit.glb   (one mesh per asset, vertex colours, metres)
      renders/kit_preview.png              (Cycles contact sheet, when KIT_PREVIEW=1)

Conventions
- Blender: metres, Z up, origin at the asset's ground contact. "Forward" (direction of travel, or the road
  axis an asset sits across) is +X. glTF export turns this into Three.js Y-up with forward still +X.
- One object = one mesh = one material. Colours live in a vertex colour attribute ("Col").
  Pure white (1,1,1) marks the parts the game tints per instance (shirts, canopies, flags, hulls).
- Low poly on purpose: most assets are drawn hundreds of times with InstancedMesh on phones.

Evidence: generic, stylised shapes. The finish arch carries plain "FINISH" text only (no race brand or logo).
"""
import math
import os
import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'web', 'public', 'assets', 'kit', 'kona_kit.glb')

# Linear-ish colours (glTF COLOR_0 is linear; these are picked to read well after sRGB output)
WHITE = (1, 1, 1, 1)          # tint mask
METAL = (0.32, 0.34, 0.36, 1)
DARK = (0.04, 0.045, 0.05, 1)
OCEAN = (0.012, 0.06, 0.16, 1)
GOLD = (0.78, 0.5, 0.08, 1)
SKIN = [(0.42, 0.24, 0.14, 1), (0.62, 0.40, 0.26, 1), (0.25, 0.13, 0.07, 1)]
HAIR = (0.03, 0.02, 0.015, 1)
SHORTS = (0.03, 0.035, 0.05, 1)
WOOD = (0.28, 0.14, 0.06, 1)
THATCH = (0.36, 0.25, 0.1, 1)
SHELL_BROWN = (0.2, 0.14, 0.05, 1)
SHELL_OLIVE = (0.16, 0.18, 0.07, 1)
FLIPPER = (0.28, 0.26, 0.18, 1)
SAND = (0.7, 0.6, 0.42, 1)
CORAL = (0.92, 0.9, 0.84, 1)
FLOWERS = [(0.95, 0.35, 0.55, 1), (0.98, 0.82, 0.25, 1), (0.98, 0.96, 0.9, 1), (0.9, 0.2, 0.2, 1)]


class Builder:
    """Accumulates primitives into one bmesh with per-face colours."""

    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new('Col')

    def _paint(self, faces, color):
        for f in faces:
            for loop in f.loops:
                loop[self.col] = color

    def _new_faces(self, verts):
        faces = set()
        for v in verts:
            faces.update(v.link_faces)
        return faces

    def box(self, center, size, color, rot_z=0.0, rot_y=0.0):
        m = Matrix.Translation(center) @ Matrix.Rotation(rot_z, 4, 'Z') @ Matrix.Rotation(rot_y, 4, 'Y') \
            @ Matrix.Diagonal((size[0], size[1], size[2], 1))
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        self._paint(self._new_faces(r['verts']), color)

    def cyl(self, a, b, r1, r2, color, seg=8, cap=True):
        """Cylinder or cone from point a to point b."""
        a, b = Vector(a), Vector(b)
        d = b - a
        length = d.length
        rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        m = Matrix.Translation((a + b) / 2) @ rot
        r = bmesh.ops.create_cone(self.bm, cap_ends=cap, cap_tris=False, segments=seg,
                                  radius1=r1, radius2=r2, depth=length, matrix=m)
        self._paint(self._new_faces(r['verts']), color)

    def ball(self, center, radius, color, scale=(1, 1, 1), seg=8, rings=5):
        m = Matrix.Translation(center) @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1))
        r = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=radius, matrix=m)
        self._paint(self._new_faces(r['verts']), color)

    def grid(self, x0, x1, z0, z1, nx, nz, color, y=0.0):
        """Vertical subdivided sheet in the XZ plane (flags, banners). Double-sided in the game."""
        verts = []
        for j in range(nz + 1):
            row = []
            for i in range(nx + 1):
                row.append(self.bm.verts.new((x0 + (x1 - x0) * i / nx, y, z0 + (z1 - z0) * j / nz)))
            verts.append(row)
        faces = []
        for j in range(nz):
            for i in range(nx):
                faces.append(self.bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i])))
        self._paint(faces, color)

    def text(self, body, center, height, color, depth=0.04, facing=1):
        """Extruded text in the YZ plane, readable from +X (facing=1) or -X (facing=-1)."""
        cu = bpy.data.curves.new('t', 'FONT')
        cu.body = body
        cu.align_x = 'CENTER'
        cu.align_y = 'CENTER'
        cu.extrude = depth / 2
        cu.size = height
        ob = bpy.data.objects.new('t', cu)
        bpy.context.scene.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        # Text lies in XY facing +Z. Stand it up to face +X (or -X).
        rot = Matrix.Rotation(math.pi / 2, 4, 'Y') @ Matrix.Rotation(math.pi / 2, 4, 'Z')
        if facing < 0:
            rot = Matrix.Rotation(math.pi, 4, 'Z') @ rot
        me.transform(Matrix.Translation(center) @ rot)
        before = len(self.bm.faces)
        self.bm.from_mesh(me)
        self.bm.faces.ensure_lookup_table()
        self._paint(self.bm.faces[before:], color)
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
        bpy.data.meshes.remove(me)

    def finish(self, name):
        me = bpy.data.meshes.new(name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(me)
        self.bm.free()
        if me.color_attributes:
            me.color_attributes.active_color = me.color_attributes[0]
            me.color_attributes.render_color_index = 0
        mat = bpy.data.materials.get('kit_vc') or make_material()
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def make_material():
    mat = bpy.data.materials.new('kit_vc')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.7
    return mat


# ------------------------------------------------------------------ Race infrastructure

def truss(b, x, y0, y1, z0, z1, w, color):
    """Square truss column/beam as four chords plus ladder rungs (cheap, reads as scaffolding)."""
    h = w / 2
    vertical = abs(z1 - z0) > abs(y1 - y0)
    for sx in (-h, h):
        for s2 in (-h, h):
            if vertical:
                b.cyl((x + sx, y0 + s2, z0), (x + sx, y0 + s2, z1), 0.035, 0.035, color, seg=5)
            else:
                b.cyl((x + sx, y0, z0 + s2), (x + sx, y1, z0 + s2), 0.035, 0.035, color, seg=5)
    n = int((abs(z1 - z0) if vertical else abs(y1 - y0)) / 0.7)
    for i in range(n + 1):
        t = i / max(n, 1)
        if vertical:
            z = z0 + (z1 - z0) * t
            b.box((x, y0, z), (w, 0.04, 0.04), color)
            b.box((x, y0, z), (0.04, w, 0.04), color)
        else:
            y = y0 + (y1 - y0) * t
            b.box((x, y, z0), (w, 0.04, 0.04), color)
            b.box((x, y, z0), (0.04, 0.04, w), color)


def arch(finished):
    """Finish arch spanning a 12 m road (road runs along X). Frame first, then banners on race days."""
    b = Builder()
    span, top, w = 6.3, 7.2, 0.7
    for y in (-span, span):
        truss(b, 0, y, y, 0, top, w, METAL)
        b.box((0, y, 0.08), (1.4, 1.4, 0.16), DARK)   # ballast feet
    truss(b, 0, -span, span, top, top, w, METAL)
    if finished:
        for y in (-span, span):
            b.box((0, y, top / 2), (0.9, 0.9, top), OCEAN)
            b.box((0, y, 0.6), (0.94, 0.94, 0.12), GOLD)
        b.box((0, 0, top + 0.1), (0.95, 2 * span + 0.95, 1.9), OCEAN)
        b.box((0, 0, top - 0.8), (0.97, 2 * span + 0.97, 0.12), GOLD)
        b.box((0, 0, top + 1.0), (0.97, 2 * span + 0.97, 0.12), GOLD)
        b.text('FINISH', (0.5, 0, top + 0.1), 1.25, CORAL, facing=1)
        b.text('FINISH', (-0.5, 0, top + 0.1), 1.25, CORAL, facing=-1)
    return b.finish('KIT_arch_final' if finished else 'KIT_arch_frame')


def tent():
    b = Builder()
    for sx in (-1.45, 1.45):
        for sy in (-1.45, 1.45):
            b.cyl((sx, sy, 0), (sx, sy, 2.4), 0.03, 0.03, METAL, seg=5)
    b.box((0, 0, 2.4), (3.0, 3.0, 0.22), WHITE)                     # valance
    b.cyl((0, 0, 2.5), (0, 0, 3.2), 2.12, 0.05, WHITE, seg=4)       # pyramid roof
    return b.finish('KIT_tent')


def expo_tent():
    b = Builder()
    L, Wd, H = 10.0, 6.0, 3.0
    for x in (-L / 2, 0, L / 2):
        for y in (-Wd / 2, Wd / 2):
            b.cyl((x, y, 0), (x, y, H), 0.05, 0.05, METAL, seg=5)
    b.box((0, -Wd / 2, H - 0.6), (L, 0.05, 1.2), WHITE)
    b.box((0, Wd / 2, H - 0.6), (L, 0.05, 1.2), WHITE)
    for s in (-1, 1):  # roof as two tilted slopes
        cx, cy, cz = 0, s * Wd / 4, H + 0.55
        bm_before = len(b.bm.verts)
        b.box((cx, cy, cz), (L + 0.3, Wd / 2 / math.cos(0.36) + 0.3, 0.06), WHITE)
        b.bm.verts.ensure_lookup_table()
        rot = Matrix.Rotation(-s * 0.36, 4, 'X')
        for v in b.bm.verts[bm_before:]:
            p = v.co - Vector((cx, cy, cz))
            v.co = Vector((cx, cy, cz)) + (rot @ p.to_4d()).to_3d()
    b.box((L / 2, 0, H / 2), (0.05, Wd, H), WHITE)                  # back wall
    return b.finish('KIT_expo_tent')


def barrier():
    """2.5 m crowd barrier with a tintable banner panel, running along X."""
    b = Builder()
    for x in (-1.2, 1.2):
        b.box((x, 0, 0.55), (0.05, 0.05, 1.1), METAL)
        b.box((x, 0, 0.02), (0.08, 0.7, 0.04), METAL)
    b.box((0, 0, 1.08), (2.45, 0.05, 0.05), METAL)
    b.box((0, 0, 0.2), (2.45, 0.05, 0.05), METAL)
    b.box((0, 0.03, 0.66), (2.35, 0.02, 0.8), WHITE)
    return b.finish('KIT_barrier')


def grandstand():
    b = Builder()
    L = 12.0
    for i in range(6):
        z = 0.45 * (i + 1)
        y = -i * 0.8
        b.box((0, y, z / 2), (L, 0.8, z), METAL)
        b.box((0, y + 0.2, z + 0.05), (L - 0.2, 0.35, 0.1), WHITE)   # seats
    b.box((0, -5.0, 1.8), (L, 0.06, 3.6), METAL)                     # back
    return b.finish('KIT_grandstand')


def flagpole():
    b = Builder()
    b.cyl((0, 0, 0), (0, 0, 6.0), 0.045, 0.03, METAL, seg=6)
    b.ball((0, 0, 6.05), 0.07, GOLD, seg=6, rings=4)
    b.box((0, 0, 0.04), (0.5, 0.5, 0.08), DARK)
    return b.finish('KIT_flagpole')


def flag():
    """Flag cloth, 1.8 x 1.1 m, hinge at x=0. Placed at the pole top by the game; waves in a shader."""
    b = Builder()
    b.grid(0.0, 1.8, -1.1, 0.0, 9, 4, WHITE)
    return b.finish('KIT_flag')


def aid_station():
    b = Builder()
    for x in (-1.1, 1.1):
        for y in (-0.35, 0.35):
            b.box((x, y, 0.38), (0.05, 0.05, 0.76), METAL)
    b.box((0, 0, 0.78), (2.4, 0.8, 0.05), CORAL)
    import random
    rnd = random.Random(7)
    for i in range(18):
        x = -1.05 + (i % 9) * 0.26
        y = -0.2 if i < 9 else 0.15
        c = [WHITE, (0.1, 0.35, 0.8, 1), (0.9, 0.55, 0.05, 1)][rnd.randrange(3)]
        b.cyl((x, y, 0.8), (x, y, 1.0), 0.035, 0.035, c, seg=5)
    for sx in (-1.45, 1.45):
        for sy in (-1.45, 1.45):
            b.cyl((sx, sy, 0), (sx, sy, 2.4), 0.03, 0.03, METAL, seg=5)
    b.box((0, 0, 2.4), (3.0, 3.0, 0.2), WHITE)
    b.cyl((0, 0, 2.5), (0, 0, 3.1), 2.12, 0.05, WHITE, seg=4)
    for i in range(4):                                             # water jugs and cooler
        b.cyl((-0.9 + i * 0.6, -0.9, 0), (-0.9 + i * 0.6, -0.9, 0.5), 0.2, 0.2, (0.1, 0.3, 0.75, 1), seg=8)
    return b.finish('KIT_aid')


# ------------------------------------------------------------------ People

def person(pose, skin):
    """Stylised human, ~1.75 m. White = clothing tinted per instance. pose: stand | run | cheer."""
    b = Builder()
    hip = 0.92
    if pose == 'run':
        b.cyl((0.0, 0.1, hip), (0.28, 0.1, 0.5), 0.075, 0.06, SHORTS, seg=6)      # front thigh
        b.cyl((0.28, 0.1, 0.5), (0.2, 0.1, 0.06), 0.055, 0.045, skin, seg=6)
        b.cyl((0.0, -0.1, hip), (-0.22, -0.1, 0.52), 0.075, 0.06, SHORTS, seg=6)  # back thigh
        b.cyl((-0.22, -0.1, 0.52), (-0.48, -0.1, 0.28), 0.055, 0.045, skin, seg=6)
        b.box((0.26, 0.1, 0.04), (0.26, 0.1, 0.08), WHITE)
        b.box((-0.5, -0.1, 0.26), (0.26, 0.1, 0.08), WHITE)
        lean = 0.12
    else:
        for y in (-0.1, 0.1):
            b.cyl((0, y, hip), (0, y, 0.5), 0.075, 0.06, SHORTS, seg=6)
            b.cyl((0, y, 0.5), (0, y, 0.06), 0.055, 0.045, skin, seg=6)
            b.box((0.06, y, 0.04), (0.26, 0.1, 0.08), DARK)
        lean = 0.0
    top = (lean, 0, 1.45)
    b.cyl((0, 0, hip - 0.05), top, 0.17, 0.2, WHITE, seg=8)                        # torso (shirt)
    b.cyl(top, (lean * 1.1, 0, 1.53), 0.05, 0.05, skin, seg=6)                     # neck
    b.ball((lean * 1.15, 0, 1.64), 0.11, skin, scale=(1, 0.9, 1.1), seg=8, rings=6)
    b.ball((lean * 1.15 - 0.02, 0, 1.7), 0.112, HAIR, scale=(1, 0.95, 0.6), seg=8, rings=4)
    for s in (-1, 1):
        sh = (lean, s * 0.22, 1.4)
        if pose == 'cheer':
            b.cyl(sh, (lean, s * 0.3, 1.75), 0.045, 0.04, skin, seg=5)
            b.cyl((lean, s * 0.3, 1.75), (lean + 0.05, s * 0.33, 2.02), 0.04, 0.035, skin, seg=5)
        elif pose == 'run':
            el = (lean + 0.12 * s, s * 0.24, 1.14)
            b.cyl(sh, el, 0.045, 0.04, skin, seg=5)
            b.cyl(el, (lean + 0.3 * s, s * 0.22, 1.22), 0.04, 0.035, skin, seg=5)
        else:
            b.cyl(sh, (lean, s * 0.25, 1.1), 0.045, 0.04, skin, seg=5)
            b.cyl((lean, s * 0.25, 1.1), (lean + 0.05, s * 0.25, 0.82), 0.04, 0.035, skin, seg=5)
    return b


def cyclist():
    """Athlete in aero position on a stylised tri bike, moving along +X. Frame is tinted per instance."""
    b = Builder()
    skin = SKIN[1]
    wr = 0.34
    for x in (-0.5, 0.5):
        b.cyl((x, -0.012, wr), (x, 0.012, wr), wr, wr, DARK, seg=14)               # wheels (discs read at distance)
        b.cyl((x, -0.02, wr), (x, 0.02, wr), 0.29, 0.29, METAL, seg=14)
    bb = (0.0, 0, 0.3)
    for a, c in [((-0.5, 0, wr), bb), (bb, (0.34, 0, 0.72)), ((-0.14, 0, 0.8), bb), ((-0.14, 0, 0.8), (0.34, 0, 0.74)),
                 ((0.34, 0, 0.74), (0.5, 0, wr)), ((-0.5, 0, wr), (-0.14, 0, 0.8))]:
        b.cyl(a, c, 0.028, 0.028, WHITE, seg=5)
    b.box((-0.18, 0, 0.84), (0.26, 0.1, 0.04), DARK)                                 # saddle
    b.box((0.52, 0, 0.84), (0.34, 0.2, 0.03), DARK)                                  # aero bars
    hip = (-0.16, 0, 0.92)
    sh = (0.36, 0, 1.12)
    b.cyl(hip, sh, 0.16, 0.14, WHITE, seg=8)                                         # torso flat
    b.ball((0.52, 0, 1.2), 0.1, WHITE, scale=(1.5, 0.95, 0.85), seg=8, rings=5)    # aero helmet
    for s in (-1, 1):
        b.cyl((sh[0], s * 0.14, 1.06), (0.44, s * 0.1, 0.9), 0.045, 0.04, skin, seg=5)
        b.cyl((0.44, s * 0.1, 0.9), (0.66, s * 0.08, 0.88), 0.04, 0.035, skin, seg=5)
        knee = (0.2, s * 0.12, 0.62 + 0.08 * s)
        foot = (0.02 + 0.12 * s, s * 0.12, 0.24 + 0.08 * s)
        b.cyl((hip[0], s * 0.1, hip[2]), knee, 0.07, 0.055, SHORTS, seg=6)
        b.cyl(knee, foot, 0.05, 0.04, skin, seg=6)
    return b.finish('KIT_cyclist')


def swimmer():
    b = Builder()
    b.ball((0, 0, 0.05), 0.12, WHITE, scale=(1.1, 1, 0.9), seg=8, rings=5)          # cap, at the water line
    b.cyl((0.02, 0.18, 0.05), (0.5, 0.25, 0.35), 0.045, 0.04, SKIN[0], seg=5)       # recovering arm
    b.ball((-0.5, 0, -0.05), 0.22, SHORTS, scale=(2.2, 1, 0.4), seg=8, rings=4)     # body just under the surface
    return b.finish('KIT_swimmer')


# ------------------------------------------------------------------ Island life

def honu():
    """Green sea turtle (honu), ~1 m, resting on sand. Keep 3 m (10 ft) away in the game, as on the island."""
    b = Builder()
    b.ball((0, 0, 0.14), 0.5, SHELL_BROWN, scale=(1.0, 0.8, 0.3), seg=12, rings=6)
    b.ball((0, 0, 0.2), 0.42, SHELL_OLIVE, scale=(1.0, 0.8, 0.3), seg=10, rings=5)
    b.ball((0.56, 0, 0.12), 0.13, FLIPPER, scale=(1.3, 0.9, 0.8), seg=8, rings=5)
    for s in (-1, 1):
        b.ball((0.2, s * 0.42, 0.07), 0.12, FLIPPER, scale=(1.6, 2.4, 0.3), seg=8, rings=4)
        b.ball((-0.38, s * 0.26, 0.06), 0.08, FLIPPER, scale=(1.5, 1.6, 0.3), seg=6, rings=4)
    return b.finish('KIT_honu')


def canoe():
    """Outrigger canoe (waʻa) with ama float on the left (−Y), 7 m, two paddlers. Hull tinted per instance."""
    b = Builder()
    b.ball((0, 0, 0.25), 0.4, WHITE, scale=(9.0, 0.75, 0.75), seg=12, rings=6)
    b.box((0, 0, 0.5), (6.2, 0.46, 0.06), WOOD)
    b.ball((0, -2.1, 0.12), 0.16, WOOD, scale=(12, 1, 1), seg=8, rings=4)
    for x in (-1.0, 1.1):
        b.cyl((x, 0, 0.55), (x, -2.1, 0.3), 0.05, 0.05, WOOD, seg=5)
    for x, sk in ((1.4, SKIN[0]), (-0.8, SKIN[2])):
        b.cyl((x, 0, 0.5), (x, 0, 0.95), 0.14, 0.16, (0.9, 0.45, 0.05, 1), seg=6)
        b.ball((x, 0, 1.08), 0.1, sk, seg=6, rings=4)
        b.cyl((x + 0.3, 0.25, 1.2), (x - 0.3, 0.35, 0.0), 0.02, 0.02, WOOD, seg=4)
    return b.finish('KIT_canoe')


def umbrella():
    b = Builder()
    b.cyl((0, 0, 0), (0.1, 0, 2.2), 0.025, 0.025, CORAL, seg=5)
    b.cyl((0.1, 0, 1.95), (0.1, 0, 2.35), 1.1, 0.04, WHITE, seg=8)
    b.box((0.9, 0.5, 0.02), (1.7, 0.7, 0.03), (0.1, 0.45, 0.6, 1))               # towel
    return b.finish('KIT_umbrella')


def surfboard():
    b = Builder()
    b.ball((0, 0, 0.05), 1.0, WHITE, scale=(1.05, 0.26, 0.04), seg=12, rings=4)
    return b.finish('KIT_surfboard')


def shave_ice():
    b = Builder()
    b.box((0, 0, 0.55), (2.2, 1.4, 1.1), CORAL)
    stripes = [(0.9, 0.1, 0.1, 1), (0.95, 0.6, 0.05, 1), (0.95, 0.9, 0.2, 1), (0.1, 0.6, 0.3, 1), (0.1, 0.35, 0.85, 1)]
    for i, c in enumerate(stripes):
        b.box((0.0, 0.71, 0.2 + i * 0.18), (2.2, 0.02, 0.17), c)
    for sx in (-1.0, 1.0):
        b.box((sx, 0.6, 1.6), (0.06, 0.06, 1.0), WOOD)
    b.box((0, 0.2, 2.15), (2.6, 2.0, 0.1), THATCH)
    b.cyl((0.4, 0.6, 1.1), (0.4, 0.6, 1.35), 0.09, 0.13, (0.95, 0.3, 0.45, 1), seg=6)
    return b.finish('KIT_shave_ice')


def lei():
    """Flower lei, 0.5 m across, lying flat: laid at the finish line after the race and as a reward icon."""
    b = Builder()
    n = 26
    for i in range(n):
        a = i / n * 2 * math.pi
        b.ball((0.25 * math.cos(a), 0.25 * math.sin(a), 0.04), 0.045, FLOWERS[i % len(FLOWERS)], seg=6, rings=4)
    return b.finish('KIT_lei')


def shell():
    """Cowrie shell collectible, 0.3 m (oversized so it can be found). Emissive glow is added in the game."""
    b = Builder()
    b.ball((0, 0, 0.09), 0.15, WHITE, scale=(1.0, 0.65, 0.55), seg=12, rings=8)
    b.box((0, 0, 0.02), (0.22, 0.03, 0.02), DARK)
    return b.finish('KIT_shell')


def coral_stone():
    """One white coral piece. The game lays hundreds on the lava to spell messages, as fans do on the Queen K."""
    b = Builder()
    r = bmesh.ops.create_icosphere(b.bm, subdivisions=1, radius=0.16)
    import random
    rnd = random.Random(3)
    for v in r['verts']:
        v.co *= 0.8 + rnd.random() * 0.4
        v.co.z = max(v.co.z * 0.55, -0.02) + 0.05
    b._paint(b._new_faces(r['verts']), CORAL)
    return b.finish('KIT_coral_stone')


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = [
        arch(False), arch(True), tent(), expo_tent(), barrier(), grandstand(), flagpole(), flag(), aid_station(),
        person('stand', SKIN[0]).finish('KIT_person'), person('cheer', SKIN[1]).finish('KIT_person_cheer'),
        person('run', SKIN[2]).finish('KIT_runner'), cyclist(), swimmer(),
        honu(), canoe(), umbrella(), surfboard(), shave_ice(), lei(), shell(), coral_stone(),
    ]
    stats = [(ob.name, len(ob.data.polygons), tuple(round(d, 2) for d in ob.dimensions)) for ob in objs]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    kw = dict(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_yup=True)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
    for name, polys, dims in stats:
        print(f'{name:22s} {polys:6d} faces  {dims}')
    print(f'TOTAL {sum(s[1] for s in stats)} faces -> {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)')
    if os.environ.get('KIT_PREVIEW') == '1':
        by = {o.name: o for o in objs}
        big = ['KIT_arch_frame', 'KIT_arch_final', 'KIT_grandstand', 'KIT_expo_tent', 'KIT_aid', 'KIT_tent', 'KIT_barrier', 'KIT_flagpole']
        small = ['KIT_person', 'KIT_person_cheer', 'KIT_runner', 'KIT_cyclist', 'KIT_swimmer', 'KIT_honu', 'KIT_canoe',
                 'KIT_umbrella', 'KIT_surfboard', 'KIT_shave_ice', 'KIT_lei', 'KIT_shell', 'KIT_coral_stone']
        preview(objs, [by[n] for n in big], 'kit_preview_big.png', 4)
        preview(objs, [by[n] for n in small], 'kit_preview_life.png', 5)


def preview(all_objs, show, name, cols):
    """Three-quarter Cycles view of a grid of assets (the others hidden). White parts get sample tints."""
    scn = bpy.context.scene
    for o in list(scn.collection.objects):
        if o.type != 'MESH' or o not in all_objs:
            bpy.data.objects.remove(o)
    for o in all_objs:
        o.hide_render = o not in show
    cell = max(max(o.dimensions.x, o.dimensions.y) for o in show) + 2.0
    for i, o in enumerate(show):
        o.location = ((i % cols) * cell, -(i // cols) * cell, 0)
    rows = (len(show) + cols - 1) // cols
    scn.render.engine = 'CYCLES'
    scn.cycles.samples = int(os.environ.get('SPP', 32))
    scn.render.resolution_x, scn.render.resolution_y = 1800, 1000
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.72, 0.9, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    scn.world = world
    cx, cy = (cols - 1) * cell / 2, -(rows - 1) * cell / 2
    bpy.ops.mesh.primitive_plane_add(size=1, location=(cx, cy, 0))
    ground = bpy.context.active_object
    ground.scale = (cols * cell * 3, rows * cell * 3, 1)
    gm = bpy.data.materials.new('g')
    gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = SAND
    ground.data.materials.append(gm)
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 4.0
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = (math.radians(45), math.radians(15), math.radians(30))
    scn.collection.objects.link(so)
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = max(cols, rows * 1.8) * cell * 1.05
    co = bpy.data.objects.new('cam', cam)
    d = cols * cell * 2
    co.location = (cx + d * 0.55, cy - d * 0.75, d * 0.62)
    co.rotation_euler = (math.radians(58), 0, math.radians(36))
    scn.collection.objects.link(co)
    scn.camera = co
    out = os.path.join(ROOT, 'renders', name)
    scn.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('preview ->', out)
    for o in (ground, so, co):
        bpy.data.objects.remove(o)


if __name__ == '__main__':
    build()
