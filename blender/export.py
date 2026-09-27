"""Export the P1 scene for the browser (real-time lit preview; the baked build comes later)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
import p1, survey as S
OUT = os.path.join(os.path.dirname(__file__), '..', 'web', 'public', 'assets')
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
coll = bpy.data.collections.new('KONA'); sc.collection.children.link(coll)
objs, protos, bikes, trees = p1.build_all(coll)
for o in bpy.data.objects: o.select_set(o.type == 'MESH')
bpy.ops.export_scene.gltf(filepath=f'{OUT}/kona_p1.glb', export_format='GLB', use_selection=True, export_apply=True, export_extras=True,
    export_yup=True, export_image_format='JPEG', export_jpeg_quality=85, export_materials='EXPORT', export_vertex_color='ACTIVE', export_meshopt_compression_enable=True)
man = {'origin': S.OSM['origin'], 'buoys': S.buoys(), 'boats': S.turn_boats(), 'swim_path': S.swim_path(), 'start': S.START.tolist(),
       'dir': S.DIRV.tolist(), 'bikes': bikes, 'trees': [{'x': t['x'], 'y': t['y'], 'z': max(.4, S.dem_at(t['x'], t['y']))} for t in trees],
       'pier_deck': p1.PIER_DECK, 'tile': S.TILE}
json.dump(man, open(f'{OUT}/kona_manifest.json', 'w'))
print('EXPORTED', os.path.getsize(f'{OUT}/kona_p1.glb') / 1e6, 'MB')
