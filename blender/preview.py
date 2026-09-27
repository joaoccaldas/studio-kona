import sys, os, math, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
import p1, survey as S
OUT = os.environ.get('OUT', os.path.join(os.path.dirname(__file__), '..', 'renders'))
SPP = int(os.environ.get('SPP', 48)); RES = [int(v) for v in os.environ.get('RES', '1280x720').split('x')]
HOUR = float(os.environ.get('HOUR', 7.25))
sc = bpy.context.scene; sc.render.engine = 'CYCLES'
pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
for d in pr.devices: d.use = d.type == 'METAL'
sc.cycles.device = 'GPU'; sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
sc.view_settings.exposure = float(os.environ.get('EXPOSURE', -.6))
coll = bpy.data.collections.new('KONA'); sc.collection.children.link(coll)
objs, protos, bikes, trees = p1.build_all(coll)
p1.ocean(coll)
# instance racked bikes and palms (the browser uses InstancedMesh)
inst = bpy.data.collections.new('INST'); coll.children.link(inst)
for b in bikes:
    o = bpy.data.objects.new('bike', protos['bike'].data); o.location = (b['x'], b['y'], p1.PIER_DECK); o.rotation_euler = (0, 0, b['rot'])
    o.material_slots[0].link = 'OBJECT'; o.material_slots[0].material = p1.MAT[f"bike{b['c']}"]
    inst.objects.link(o)
for t in trees:
    z = max(.4, S.dem_at(t['x'], t['y']))
    o = bpy.data.objects.new('palm', protos['palm'].data); o.location = (t['x'], t['y'], z); o.rotation_euler = (0, 0, (t['x'] * 7.1) % 6.28)
    o.scale = [.85 + (abs(t['y']) * 13.7 % 1) * .3] * 3; inst.objects.link(o)
for p in protos.values(): p.location.z = -500
# race-morning sun (10 Oct 2026) + physical sky
el, az = p1.sun_position(19.6392, -155.9968, 2026, 10, 10, HOUR)
print('SUN', HOUR, 'elev', round(el, 1), 'az', round(az, 1))
w = bpy.data.worlds.new('W'); sc.world = w; nt = w.node_tree
sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'MULTIPLE_SCATTERING'; sky.sun_disc = False; sky.altitude = 10
sky.sun_elevation = math.radians(max(el, .5)); sky.sun_rotation = math.radians(90 - az) + math.pi / 2
sky.air_density = 1.0; sky.aerosol_density = 1.4
nt.links.new(sky.outputs[0], nt.nodes['Background'].inputs[0]); nt.nodes['Background'].inputs[1].default_value = .4
sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = 3.6 * max(0, math.sin(math.radians(el))) ** .5; sd.angle = math.radians(.55); sd.color = (1, .9, .78)
so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so)
vec = Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)), math.cos(math.radians(az)) * math.cos(math.radians(el)), math.sin(math.radians(el))))
so.rotation_euler = vec.to_track_quat('Z', 'Y').to_euler()
def cam(n, loc, tgt, lens):
    c = bpy.data.objects.new(n, bpy.data.cameras.new(n)); sc.collection.objects.link(c); c.location = loc
    c.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); c.data.lens = lens; c.data.clip_end = 20000
    return c
T = S.START + S.DIRV * S.OUT_LEN
views = {
  'aerial': cam('aerial', (560, -520, 260), (0, -300, 0), 24),
  'swim_start': cam('swim_start', (52, -48, .35), (float(T[0]), float(T[1]), 0), 30),
  'pier_transition': cam('pier_transition', (-18, 30, 7.5), (-10, -40, 2.2), 20),
  'heiau': cam('heiau', (-20, -60, 1.7), (-62, -28, 4), 24),
  'turn_boats': cam('turn_boats', (float(T[0] + S.RIGHT[0] * 120), float(T[1] + S.RIGHT[1] * 120 - 30), 1.2), (60, -40, 30), 28),
  'dig_me': cam('dig_me', (-45, -5, 1.7), (80, -120, 1), 24),
}
sc.cycles.samples = SPP; sc.cycles.use_denoising = True; sc.render.resolution_x, sc.render.resolution_y = RES
sc.cycles.volume_step_rate = 2.0
for n in os.environ.get('VIEWS', ','.join(views)).split(','):
    sc.camera = views[n]; sc.render.filepath = f'{OUT}/kona_{n}.png'
    t = time.time(); bpy.ops.render.render(write_still=True); print('RENDER', n, round(time.time() - t, 1))
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/kona_preview.blend')
