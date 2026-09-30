"""KONA Studio Island World V2 procedural detail layer.

Run inside Blender after the coarse whole-island mesh exists.
Creates lightweight, editable landmark/biome proxies positioned from WGS84.
The goal is progressive replacement: blockout -> evidence-backed geometry -> baked/optimized GLB.
"""
import bpy, json, math, os, random
from mathutils import Vector

HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..'))
DATA=os.path.join(ROOT,'data','island_world_v2.json')
LAT0=19.639162
LON0=-155.9968082
M_PER_DEG_LAT=111132.92

def local_xy(lat, lon):
    x=(lon-LON0)*(111412.84*math.cos(math.radians(LAT0)))
    y=(lat-LAT0)*M_PER_DEG_LAT
    return x,y

def mat(name,color,rough=.8,metal=0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    return m

MATS={
 'lava':mat('V2_Lava',(0.045,0.04,0.035),.96),
 'cinder':mat('V2_Cinder',(0.12,0.07,0.045),.94),
 'dry':mat('V2_DryGround',(0.28,0.22,0.14),.92),
 'green':mat('V2_Green',(0.08,0.18,0.055),.9),
 'urban':mat('V2_Urban',(0.50,0.50,0.48),.85),
 'roof':mat('V2_Roof',(0.18,0.16,0.14),.8),
 'water':mat('V2_Water',(0.02,0.24,0.34),.35),
 'road':mat('V2_Road',(0.055,0.055,0.052),.88)
}

def coll(name):
    c=bpy.data.collections.get(name)
    if not c:
        c=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    return c

def move_to(obj,c):
    for cc in list(obj.users_collection): cc.objects.unlink(obj)
    c.objects.link(obj)

def cube(name,loc,scale,material,collection):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    o.data.materials.append(material); move_to(o,collection); return o

def cone(name,loc,r1,r2,depth,material,collection,verts=48):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=depth,location=loc)
    o=bpy.context.object; o.name=name; o.data.materials.append(material); move_to(o,collection); return o

def uv_sphere(name,loc,scale,material,collection):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(material); move_to(o,collection); return o

def town_cluster(zone,x,y,c,rng):
    n={'hero':90,'high':55,'medium':28}.get(zone['lod'],20)
    for i in range(n):
        a=rng.random()*math.tau; rr=zone['radius_m']*(0.08+0.55*math.sqrt(rng.random()))
        px=x+math.cos(a)*rr; py=y+math.sin(a)*rr
        w=rng.uniform(8,28); d=rng.uniform(8,34); h=rng.uniform(4,13)
        o=cube(f"{zone['id']}_bld_{i:03d}",(px,py,h/2),(w/2,d/2,h/2),MATS['urban'],c)
        o['evidence']='I'; o['zone']=zone['id']

def runway(zone,x,y,c):
    length=3350 if zone['id']=='airport' else 1100
    width=26 if zone['id']=='airport' else 18
    o=cube(f"{zone['id']}_runway",(x,y,.15),(width/2,length/2,.15),MATS['road'],c)
    o['evidence']='P/I'

def volcano(zone,x,y,c):
    radii={'mauna_kea':16000,'mauna_loa':26000,'hualalai':13500,'kilauea':9000}
    heights={'mauna_kea':4205,'mauna_loa':4169,'hualalai':2521,'kilauea':950}
    r=radii.get(zone['id'],9000); h=heights.get(zone['id'],1800)
    base=cone(f"{zone['id']}_massif",(x,y,h*.45),r, max(1200,r*.12),h*.9,MATS['cinder'],c,verts=96)
    base['evidence']='M/P proxy'
    rng=random.Random(zone['id'])
    for i in range(18 if zone['lod']=='hero' else 8):
        a=rng.random()*math.tau; rr=rng.uniform(r*.1,r*.75)
        cr=rng.uniform(140,520)
        z=max(30,h*(1-rr/r)*rng.uniform(.35,.7))
        cone(f"{zone['id']}_cone_{i:02d}",(x+math.cos(a)*rr,y+math.sin(a)*rr,z*.45),cr,cr*.25,z,MATS['lava'],c,verts=24)
    if zone['id']=='kilauea':
        bpy.ops.mesh.primitive_torus_add(major_radius=2600,minor_radius=320,major_segments=96,minor_segments=12,location=(x,y,120))
        o=bpy.context.object; o.name='kilauea_caldera_rim'; o.data.materials.append(MATS['lava']); move_to(o,c)

def coast_marker(zone,x,y,c):
    uv_sphere(f"{zone['id']}_coast_anchor",(x,y,8),(40,40,8),MATS['water'],c)

def main():
    cfg=json.load(open(DATA,encoding='utf8'))
    root=coll('KONA_ISLAND_V2')
    for old in list(root.objects): bpy.data.objects.remove(old,do_unlink=True)
    for zone in cfg['zones']:
        x,y=local_xy(zone['lat'],zone['lon'])
        c=coll('V2_'+zone['id'].upper())
        rng=random.Random(zone['id'])
        empty=bpy.data.objects.new('ANCHOR_'+zone['id'],None); empty.location=(x,y,0); c.objects.link(empty)
        empty['lat']=zone['lat']; empty['lon']=zone['lon']; empty['lod']=zone['lod']; empty['features']=','.join(zone['features'])
        if zone['id'] in {'mauna_kea','mauna_loa','hualalai','kilauea'}: volcano(zone,x,y,c)
        elif zone['id'] in {'airport','old_airport'}:
            runway(zone,x,y,c); town_cluster(zone,x,y,c,rng)
        elif zone['id'] in {'kailua_core','hilo','waimea','hawi','waikoloa','kawaihae','keauhou','nelha'}:
            town_cluster(zone,x,y,c,rng); coast_marker(zone,x,y,c)
        # low-poly landmark halo used by streaming/debug tools
        for i in range(24 if zone['lod']=='hero' else 12):
            a=i/(24 if zone['lod']=='hero' else 12)*math.tau
            rr=zone['radius_m']*.72
            uv_sphere(f"{zone['id']}_lodpt_{i:02d}",(x+math.cos(a)*rr,y+math.sin(a)*rr,2),(2.5,2.5,2.5),MATS['lava'],c)
    bpy.context.scene['kona_world_v2']='progressive-island-detail'
    bpy.context.scene['source_policy']='public-domain/open-data preferred; inferred geometry tagged'
    print('KONA Island V2 zones built:',len(cfg['zones']))

if __name__=='__main__':
    main()
