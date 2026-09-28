"""Gear Asset Pack V1 (issue #25): one reusable library for the avatar, Pack for Kona, Garage, shop and rewards.

Run:  blender -b --factory-startup --python-exit-code 1 -P blender/gear.py
Out:  web/public/assets/gear/gear.glb   objects GEAR_<id>_LOD0 / _LOD1 / _LOD2
      web/public/assets/gear/gear.json  manifest (the single source for names, slots, packing rules, provenance)
      renders/gear_preview.jpg          when GEAR_PREVIEW=1

Conventions (same as kit.py): metres, Z up, origin at the resting contact point, forward +X. One mesh and one
vertex-colour material per LOD. Pure white parts take the player's chosen colour in the game.
All shapes are ORIGINAL ARCHETYPES (a long-tail aero helmet, a plated run shoe…), not copies of commercial products.
Branded variants need their own provenance manifest and are out of scope here.
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import Builder, WHITE, DARK, METAL, GOLD, CORAL, SHORTS, make_material  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'web', 'public', 'assets', 'gear')
CARBON = (0.02, 0.022, 0.025, 1)
RUBBER = (0.015, 0.015, 0.015, 1)
VISOR = (0.03, 0.08, 0.12, 1)
FOAM = (0.85, 0.86, 0.82, 1)
NEOPRENE = (0.01, 0.012, 0.014, 1)
ORANGE = (0.9, 0.35, 0.03, 1)
BLUE = (0.05, 0.22, 0.65, 1)
CLEAR = (0.55, 0.7, 0.75, 1)
PAPER = (0.93, 0.92, 0.88, 1)
RED = (0.75, 0.05, 0.05, 1)
NAVY = (0.02, 0.05, 0.15, 1)


def shell(b, c, size, color, seg=14, rings=8):
    b.ball(c, 1.0, color, scale=size, seg=seg, rings=rings)


# ------------------------------------------------------------------ helmets (origin at the rim, forward +X)
def helmet_longtail():
    b = Builder()
    shell(b, (0.03, 0, 0.1), (0.17, 0.11, 0.12), WHITE)
    b.cyl((-0.08, 0, 0.13), (-0.3, 0, 0.1), 0.085, 0.012, WHITE, seg=10)          # long tail
    b.ball((0.14, 0, 0.07), 1.0, VISOR, scale=(0.05, 0.1, 0.06), seg=12, rings=6)  # wrap visor
    return b


def helmet_shorttail():
    b = Builder()
    shell(b, (0.02, 0, 0.1), (0.16, 0.11, 0.12), WHITE)
    b.cyl((-0.08, 0, 0.13), (-0.19, 0, 0.12), 0.08, 0.02, WHITE, seg=10)
    b.ball((0.13, 0, 0.07), 1.0, VISOR, scale=(0.05, 0.1, 0.06), seg=12, rings=6)
    return b


def helmet_aeroroad():
    b = Builder()
    shell(b, (0.0, 0, 0.08), (0.15, 0.11, 0.12), WHITE)
    for i in range(3):                                                             # vents
        b.box((0.06 - i * 0.07, 0, 0.19), (0.04, 0.12, 0.02), DARK)
    return b


# ------------------------------------------------------------------ shoes (single shoe, toe +X)
def shoe(sole_h, rocker, upper_color=WHITE, sole=CARBON, straps=0, dials=0, heel_loop=False, name=''):
    b = Builder()
    L = 0.29
    b.box((0, 0, sole_h / 2), (L, 0.1, sole_h), sole)                             # sole / midsole
    if rocker:
        b.cyl((L / 2 - 0.01, 0, sole_h * 0.6), (L / 2 + 0.02, 0, sole_h * 0.9), sole_h * 0.5, 0.01, sole, seg=6)
    b.ball((0.02, 0, sole_h + 0.035), 1.0, upper_color, scale=(0.15, 0.052, 0.05), seg=12, rings=6)
    b.ball((-0.09, 0, sole_h + 0.06), 1.0, upper_color, scale=(0.06, 0.05, 0.06), seg=10, rings=6)  # heel counter
    for i in range(straps):
        b.box((0.0 - i * 0.05, 0, sole_h + 0.075), (0.03, 0.11, 0.012), DARK)
    for i in range(dials):
        b.cyl((0.02 - i * 0.07, 0.03, sole_h + 0.08), (0.02 - i * 0.07, 0.03, sole_h + 0.095), 0.018, 0.018, METAL, seg=10)
    if heel_loop:
        b.box((-0.145, 0, sole_h + 0.09), (0.012, 0.03, 0.05), ORANGE)
    return b


# ------------------------------------------------------------------ apparel (folded, as packed or on a shelf)
def folded(color_main, stripe=None, thick=0.03, size=(0.3, 0.24)):
    b = Builder()
    b.box((0, 0, thick / 2), (size[0], size[1], thick), color_main)
    b.box((0, 0, thick + 0.004), (size[0] * 0.96, size[1] * 0.05, 0.004), DARK)  # fold line
    if stripe:
        b.box((0, size[1] * 0.3, thick + 0.003), (size[0] * 0.96, size[1] * 0.12, 0.006), stripe)
    return b


# ------------------------------------------------------------------ small kit
def goggles():
    b = Builder()
    for s in (-1, 1):
        b.ball((0, s * 0.035, 0.02), 1.0, VISOR, scale=(0.018, 0.028, 0.02), seg=10, rings=5)
    b.box((0, 0, 0.02), (0.01, 0.02, 0.008), WHITE)
    b.cyl((0, -0.06, 0.02), (0, 0.06, 0.02), 0.004, 0.004, WHITE, seg=4)
    return b


def sunglasses():
    b = Builder()
    b.box((0.0, 0, 0.025), (0.012, 0.15, 0.045), VISOR)
    b.box((0.0, 0, 0.05), (0.014, 0.15, 0.008), WHITE)
    for s in (-1, 1):
        b.box((-0.065, s * 0.072, 0.045), (0.13, 0.006, 0.008), WHITE)
    return b


def watch():
    b = Builder()
    b.cyl((0, 0, 0.0), (0, 0, 0.013), 0.024, 0.024, DARK, seg=16)
    b.cyl((0, 0, 0.013), (0, 0, 0.015), 0.021, 0.021, VISOR, seg=16)
    b.box((0, 0, 0.004), (0.11, 0.022, 0.006), WHITE)
    return b


def race_belt():
    b = Builder()
    b.box((0, 0, 0.004), (0.34, 0.022, 0.008), WHITE)
    b.box((0, 0, 0.012), (0.2, 0.16, 0.003), PAPER)
    b.box((0, 0.05, 0.015), (0.16, 0.02, 0.002), RED)
    return b


def bottle():
    b = Builder()
    b.cyl((0, 0, 0), (0, 0, 0.19), 0.036, 0.036, WHITE, seg=14)
    b.cyl((0, 0, 0.19), (0, 0, 0.22), 0.03, 0.012, DARK, seg=10)
    return b


def nutrition():
    b = Builder()
    for i, c in enumerate([ORANGE, RED, (0.2, 0.6, 0.15, 1)]):
        b.box((i * 0.05 - 0.05, 0, 0.004 + i * 0.006), (0.045, 0.1, 0.008), c)
    b.box((0.0, 0.1, 0.01), (0.13, 0.035, 0.018), GOLD)                              # bar
    return b


def pedals():
    b = Builder()
    for s in (-1, 1):
        b.box((0, s * 0.06, 0.012), (0.09, 0.07, 0.022), CARBON)
        b.cyl((0, s * 0.06 + s * 0.035, 0.012), (0, s * 0.06 + s * 0.09, 0.012), 0.008, 0.008, METAL, seg=6)
    return b


def pump():
    b = Builder()
    b.box((0, 0, 0.012), (0.24, 0.07, 0.024), DARK)
    b.cyl((0, 0, 0.02), (0, 0, 0.62), 0.03, 0.03, WHITE, seg=12)
    b.cyl((0, 0, 0.62), (0, 0, 0.66), 0.006, 0.006, METAL, seg=5)
    b.box((0, 0, 0.67), (0.03, 0.26, 0.025), DARK)
    b.cyl((0.03, 0, 0.1), (0.05, 0, 0.5), 0.005, 0.005, RUBBER, seg=4)
    return b


def tools():
    b = Builder()
    b.box((0, 0, 0.01), (0.09, 0.03, 0.02), METAL)
    b.cyl((0.0, 0.05, 0.012), (0.09, 0.05, 0.012), 0.011, 0.011, METAL, seg=10)      # CO2 cartridge
    b.box((0.0, -0.05, 0.004), (0.12, 0.018, 0.006), BLUE)                            # tyre lever
    b.cyl((-0.08, 0.0, 0.012), (-0.08, 0.0, 0.03), 0.04, 0.04, DARK, seg=12)         # spare tube coil
    return b


def charger():
    b = Builder()
    b.box((0, 0, 0.012), (0.05, 0.05, 0.024), WHITE)
    n = 12
    for i in range(n):
        a0, a1 = i / n * 2 * math.pi, (i + 1) / n * 2 * math.pi
        b.cyl((0.1 + 0.05 * math.cos(a0), 0.05 * math.sin(a0), 0.004), (0.1 + 0.05 * math.cos(a1), 0.05 * math.sin(a1), 0.004), 0.003, 0.003, DARK, seg=4)
    return b


def sunscreen():
    b = Builder()
    b.box((0, 0, 0.07), (0.05, 0.03, 0.14), (0.95, 0.75, 0.1, 1))
    b.cyl((0, 0, 0.14), (0, 0, 0.16), 0.012, 0.012, WHITE, seg=8)
    return b


def passport():
    b = Builder()
    b.box((0, 0, 0.004), (0.125, 0.088, 0.008), NAVY)
    b.box((0.0, 0.0, 0.0085), (0.03, 0.03, 0.001), GOLD)
    return b


def wetsuit():
    b = folded(NEOPRENE, stripe=None, thick=0.07, size=(0.36, 0.3))
    return b


def swimskin():
    return folded(WHITE, stripe=DARK, thick=0.012, size=(0.3, 0.22))


def glass_bottle():
    b = Builder()
    b.cyl((0, 0, 0), (0, 0, 0.2), 0.035, 0.035, (0.2, 0.45, 0.25, 1), seg=12)
    b.cyl((0, 0, 0.2), (0, 0, 0.27), 0.03, 0.012, (0.2, 0.45, 0.25, 1), seg=10)
    return b


def bike_box():
    """Hard bike case, 1.2 × 0.3 × 0.85 m standing on its long edge, lid open toward +Y."""
    b = Builder()
    L, D, H = 1.2, 0.26, 0.85
    b.box((0, 0, H / 2), (L, D, H), DARK)
    b.box((0, 0.0, H / 2), (L - 0.06, D - 0.06, H - 0.06), FOAM)                   # interior foam visible when open
    for x in (-0.45, 0.45):
        b.cyl((x, -D / 2 - 0.01, 0.06), (x, D / 2 + 0.01, 0.06), 0.05, 0.05, RUBBER, seg=10)  # wheels
    b.box((0, -D / 2 - 0.015, H - 0.08), (0.25, 0.03, 0.04), METAL)                # handle
    # open lid, hinged at the bottom back edge and lying almost flat
    lid = Builder()
    lid.box((0, 0.0, 0.0), (L, H, 0.05), DARK)
    lid.box((0, 0.0, 0.03), (L - 0.06, H - 0.06, 0.02), FOAM)
    return b, lid, (0, D / 2 + H / 2 + 0.02, 0.025)


def suitcase():
    """Open suitcase lying flat: base and lid side by side."""
    b = Builder()
    L, W, H = 0.7, 0.45, 0.13
    for y, c in ((0, WHITE), (W + 0.02, WHITE)):
        b.box((0, y, H / 2), (L, W, H), c)
        b.box((0, y, H / 2 + 0.01), (L - 0.04, W - 0.04, H - 0.01), (0.14, 0.2, 0.26, 1))  # lining
    b.box((0, -W / 2 - 0.01, H / 2), (0.16, 0.02, 0.03), DARK)                     # handle
    return b


# ------------------------------------------------------------------ manifest
# slot: where it goes on the athlete (head/eyes/wrist/feet/body) or None.
# pack: 'bikebox' | 'suitcase' | 'trap' | None (not in the packing challenge). needed: required to race.
GEAR = [
    dict(id='helmet_longtail', name='Long-tail aero helmet', cat='helmet', slot='head', pack='bikebox', needed=True, build=helmet_longtail,
         note='Rules require an approved, fastened helmet the whole bike leg.'),
    dict(id='helmet_shorttail', name='Short-tail aero helmet', cat='helmet', slot='head', pack='bikebox', needed=True, build=helmet_shorttail),
    dict(id='helmet_aeroroad', name='Aero road helmet', cat='helmet', slot='head', pack='bikebox', needed=True, build=helmet_aeroroad),
    dict(id='shoe_tri', name='Tri cycling shoes', cat='shoes', slot='feet', pack='bikebox', needed=True,
         build=lambda: shoe(0.012, False, straps=1, heel_loop=True), note='One strap and a heel loop for a fast transition.'),
    dict(id='shoe_road', name='Road cycling shoes', cat='shoes', slot='feet', pack='bikebox', needed=False,
         build=lambda: shoe(0.012, False, dials=2)),
    dict(id='shoe_plated', name='Plated racing run shoes', cat='shoes', slot='feet', pack='suitcase', needed=True,
         build=lambda: shoe(0.045, True, sole=(0.95, 0.95, 0.9, 1), heel_loop=True), note='Race day on the Queen K.'),
    dict(id='shoe_trainer', name='Lightweight trainers', cat='shoes', slot='feet', pack='suitcase', needed=False,
         build=lambda: shoe(0.03, False, sole=(0.9, 0.9, 0.88, 1))),
    dict(id='suit_sleeved', name='Sleeved aero tri suit', cat='apparel', slot='body', pack='suitcase', needed=True,
         build=lambda: folded(WHITE, stripe=DARK), note='Sleeves are allowed and faster in the Kona sun.'),
    dict(id='suit_sleeveless', name='Sleeveless tri suit', cat='apparel', slot='body', pack='suitcase', needed=False, build=lambda: folded(WHITE, stripe=GOLD)),
    dict(id='kit_training', name='Two-piece training kit', cat='apparel', slot='body', pack='suitcase', needed=False, build=lambda: folded(WHITE, stripe=BLUE, thick=0.05)),
    dict(id='kit_casual', name='Finisher shirt and shorts', cat='apparel', slot='body', pack=None, needed=False, build=lambda: folded(WHITE, stripe=RED, thick=0.05)),
    dict(id='swimskin', name='Swimskin', cat='apparel', slot='body', pack='suitcase', needed=True, build=swimskin,
         note='Kailua Bay is usually about 26–27 °C in October: above the 24.5 °C age-group wetsuit cut-off.'),
    dict(id='goggles', name='Goggles (tinted)', cat='kit', slot='eyes', pack='suitcase', needed=True, build=goggles, note='Tinted for the morning sun on the way back to the pier.'),
    dict(id='sunglasses', name='Sunglasses', cat='kit', slot='eyes', pack='bikebox', needed=False, build=sunglasses),
    dict(id='watch', name='GPS watch', cat='kit', slot='wrist', pack='suitcase', needed=False, build=watch),
    dict(id='race_belt', name='Race belt and number', cat='kit', slot='body', pack='suitcase', needed=True, build=race_belt),
    dict(id='bottle', name='Bottles', cat='kit', slot=None, pack='bikebox', needed=True, build=bottle),
    dict(id='nutrition', name='Gels and bars', cat='kit', slot=None, pack='suitcase', needed=True, build=nutrition, note='Practise race-day fuelling before you fly.'),
    dict(id='pedals', name='Pedals', cat='kit', slot=None, pack='bikebox', needed=True, build=pedals, note='Taken off to fit the bike in the box. Easy to forget.'),
    dict(id='pump', name='Floor pump', cat='kit', slot=None, pack=None, needed=False, build=pump),
    dict(id='tools', name='Tools, CO₂ and tube', cat='kit', slot=None, pack='bikebox', needed=True, build=tools),
    dict(id='charger', name='Chargers', cat='kit', slot=None, pack='suitcase', needed=False, build=charger),
    dict(id='sunscreen', name='Reef-safe sunscreen', cat='kit', slot=None, pack='suitcase', needed=True, build=sunscreen,
         note='Hawaiʻi bans sunscreens with oxybenzone and octinoxate to protect the reefs.'),
    dict(id='passport', name='Passport and race licence', cat='kit', slot=None, pack='suitcase', needed=True, build=passport),
    dict(id='wetsuit', name='Wetsuit', cat='trap', slot=None, pack='trap', needed=False, build=wetsuit,
         note='Leave it: Kona is almost always non-wetsuit for age-groupers. Pack a swimskin.'),
    dict(id='glass_bottle', name='Glass bottle', cat='trap', slot=None, pack='trap', needed=False, build=glass_bottle,
         note='Leave it: glass has no place on the course or on the beach.'),
    dict(id='bike_box', name='Bike box', cat='luggage', slot=None, pack=None, needed=False, build=None),
    dict(id='suitcase', name='Suitcase', cat='luggage', slot=None, pack=None, needed=False, build=suitcase),
]


def lods(ob):
    """LOD1/LOD2 by collapse decimation; tiny meshes reuse fewer steps. Returns objects [LOD0, LOD1, LOD2]."""
    out = [ob]
    for i, ratio in ((1, 0.5), (2, 0.22)):
        me = ob.data.copy()
        lo = bpy.data.objects.new(ob.name.replace('_LOD0', f'_LOD{i}'), me)
        bpy.context.scene.collection.objects.link(lo)
        if len(me.polygons) > 120:
            mod = lo.modifiers.new('dec', 'DECIMATE')
            mod.ratio = ratio
            bpy.context.view_layer.objects.active = lo
            lo.select_set(True)
            bpy.ops.object.modifier_apply(modifier='dec')
            lo.select_set(False)
        me.validate(clean_customdata=False)
        out.append(lo)
    return out


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    make_material()
    manifest, objs = [], []
    for g in GEAR:
        if g['id'] == 'bike_box':
            base, lid, lid_at = bike_box()
            ob = base.finish('GEAR_bike_box_LOD0')
            lo = lid.finish('GEAR_bike_box_lid_LOD0')
            lo.location = lid_at
            bpy.context.view_layer.objects.active = ob
            ob.select_set(True); lo.select_set(True)
            bpy.ops.object.transform_apply(location=True)
            bpy.ops.object.join()
            ob.select_set(False)
        else:
            ob = g['build']().finish(f"GEAR_{g['id']}_LOD0")
        for o in lods(ob):
            objs.append(o)
        d = ob.dimensions
        manifest.append({k: v for k, v in g.items() if k != 'build'} | {
            'faces': [len(o.data.polygons) for o in objs[-3:]],
            'size_m': [round(d.x, 3), round(d.y, 3), round(d.z, 3)],
            'tint': True,
            'source': 'original archetype (Caldas Studio), not a commercial product',
        })
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, 'gear.glb')
    kw = dict(filepath=path, export_format='GLB', use_selection=False, export_apply=True, export_yup=True)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
    with open(os.path.join(OUT_DIR, 'gear.json'), 'w') as f:
        json.dump({'version': 1, 'units': 'metres', 'items': manifest}, f, indent=1, ensure_ascii=False)
    for m in manifest:
        print(f"{m['id']:18s} {str(m['faces']):18s} {m['size_m']}")
    print(f"TOTAL {sum(m['faces'][0] for m in manifest)} faces LOD0 -> {path} ({os.path.getsize(path) / 1e6:.2f} MB)")
    if os.environ.get('GEAR_PREVIEW') == '1':
        preview([o for o in objs if o.name.endswith('_LOD0')])


def preview(objs):
    scn = bpy.context.scene
    cols = 7
    for i, o in enumerate(objs):
        o.location = ((i % cols) * 0.9, -(i // cols) * 0.9, 0)
    for o in scn.collection.objects:
        if o.type == 'MESH' and not o.name.endswith('_LOD0'):
            o.hide_render = True
    rows = (len(objs) + cols - 1) // cols
    scn.render.engine = 'CYCLES'
    scn.cycles.samples = 32
    scn.render.resolution_x, scn.render.resolution_y = 1800, 1100
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.8, 0.82, 0.85, 1)
    scn.world = w
    bpy.ops.mesh.primitive_plane_add(size=40, location=(3, -1.5, 0))
    sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 3
    so = bpy.data.objects.new('s', sun); so.rotation_euler = (math.radians(40), 0, math.radians(30)); scn.collection.objects.link(so)
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = cols * 0.9 + 0.6
    co = bpy.data.objects.new('c', cam)
    co.location = ((cols - 1) * 0.45 + 4, -(rows - 1) * 0.45 - 6, 6)
    co.rotation_euler = (math.radians(55), 0, math.radians(34))
    scn.collection.objects.link(co); scn.camera = co
    out = os.path.join(ROOT, 'renders', 'gear_preview.png')
    scn.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('preview ->', out)


if __name__ == '__main__':
    build()
