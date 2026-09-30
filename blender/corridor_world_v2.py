"""Generate Ring-2 race corridor geometry from canonical route data.

This is deliberately separate from blender/p1.py (Kailua hero core).
Inputs:
  data/routes.json
  data/island_world_v2.json
Outputs are intended to be split/optimized into streamed GLBs.

Evidence:
  P/M = route/geocode/DEM-derived
  I   = procedural roadside dressing until measured land-cover data replaces it
"""
import bpy, json, math, os, random
from mathutils import Vector

HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..'))
ROUTES=json.load(open(os.path.join(ROOT,'data','routes.json'),encoding='utf8'))
WORLD=json.load(open(os.path.join(ROOT,'data','island_world_v2.json'),encoding='utf8'))
ORIGIN=WORLD['origin']
KX=111320*math.cos(math.radians(ORIGIN['lat']))
KY=110574.0

def xy(lat,lon):
    return ((lon-ORIGIN['lon'])*KX,(lat-ORIGIN['lat'])*KY)

def mat(name,color,rough=.85,metal=0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    return m

M={
 'asphalt':mat('R2_Asphalt',(0.055,0.055,0.052),.92),
 'edge':mat('R2_EdgeLine',(0.82,0.8,0.72),.65),
 'lava':mat('R2_Basalt',(0.045,0.04,0.035),.97),
 'dry':mat('R2_DryScrub',(0.24,0.27,0.12),.94),
 'green':mat('R2_KohalaGreen',(0.12,0.28,0.08),.9),
 'industrial':mat('R2_Industrial',(0.46,0.49,0.50),.72,metal=.15),
}

def ensure_coll(name):
    c=bpy.data.collections.get(name)
    if not c:
        c=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    return c

def curve_polyline(name,pts,width,material,coll,z=0.18):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=1
    cu.bevel_depth=width/2; cu.bevel_resolution=0
    sp=cu.splines.new('POLY'); sp.points.add(len(pts)-1)
    for i,(x,y) in enumerate(pts): sp.points[i].co=(x,y,z,1)
    o=bpy.data.objects.new(name,cu); coll.objects.link(o); o.data.materials.append(material)
    o['evidence']='P/M route spine; vertical terrain conformance applied at export/runtime'
    return o

def cube(name,loc,scale,material,coll):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(material)
    for c in list(o.users_collection): c.objects.unlink(o)
    coll.objects.link(o); return o

def rock(name,loc,s,coll):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=s,location=loc)
    o=bpy.context.object; o.name=name; o.scale=(1.3,.9,.65); o.data.materials.append(M['lava'])
    for c in list(o.users_collection): c.objects.unlink(o)
    coll.objects.link(o); o['evidence']='I roadside dressing'; return o

def shrub(name,loc,s,material,coll):
    bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=s,radius2=.15*s,depth=1.6*s,location=(loc[0],loc[1],loc[2]+.8*s))
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    for c in list(o.users_collection): c.objects.unlink(o)
    coll.objects.link(o); o['evidence']='I until land-cover instancing pass'; return o

def sample_route(route,step_m=90):
    raw=[xy(lat,lon) for lon,lat in route]
    if not raw: return []
    out=[raw[0]]; acc=0.; prev=raw[0]
    for p in raw[1:]:
        d=math.hypot(p[0]-prev[0],p[1]-prev[1]); acc+=d
        if acc>=step_m:
            out.append(p); acc=0.
        prev=p
    if out[-1]!=raw[-1]: out.append(raw[-1])
    return out

def corridor_chunks(points,chunk_m=2000):
    if not points:return []
    chunks=[]; cur=[points[0]]; length=0.
    for a,b in zip(points,points[1:]):
        d=math.hypot(b[0]-a[0],b[1]-a[1]); length+=d; cur.append(b)
        if length>=chunk_m:
            chunks.append(cur); cur=[b]; length=0.
    if len(cur)>1: chunks.append(cur)
    return chunks

def dress_chunk(idx,pts,coll):
    rng=random.Random(1000+idx)
    if len(pts)<2:return
    # climate transition: approximate northward greening as the course approaches Kohala/Hawi.
    avg_y=sum(p[1] for p in pts)/len(pts)
    green=max(0,min(1,(avg_y-25000)/38000))
    veg=M['green'] if green>.5 else M['dry']
    for i,p in enumerate(pts[::2]):
        j=min(len(pts)-1,i*2+1); q=pts[j]
        dx=q[0]-p[0]; dy=q[1]-p[1]; L=max(1,math.hypot(dx,dy)); nx=dy/L; ny=-dx/L
        for side in (-1,1):
            for k in range(2):
                off=side*rng.uniform(12,55)
                px=p[0]+nx*off+rng.uniform(-12,12); py=p[1]+ny*off+rng.uniform(-12,12)
                if rng.random() < (0.72-0.35*green):
                    rock(f'R2_{idx:02d}_rock_{i}_{side}_{k}',(px,py,rng.uniform(.4,1.2)),rng.uniform(.6,2.1),coll)
                elif rng.random() < .72:
                    shrub(f'R2_{idx:02d}_shrub_{i}_{side}_{k}',(px,py,0),rng.uniform(.5,1.5),veg,coll)

def add_nelha(coll):
    z=next(z for z in WORLD['zones'] if z['id']=='nelha'); x,y=xy(z['lat'],z['lon'])
    # Industrial massing only. Exact tenant/building geometry remains a future measured pass.
    rng=random.Random(42)
    for i in range(18):
        px=x+rng.uniform(-620,620); py=y+rng.uniform(-520,520)
        w=rng.uniform(16,55); d=rng.uniform(14,70); h=rng.uniform(5,16)
        o=cube(f'NELHA_massing_{i:02d}',(px,py,h/2),(w/2,d/2,h/2),M['industrial'],coll)
        o['evidence']='I massing; anchor is measured geocode'
    # Three visually-important seawater pipeline traces as explicit proxies.
    for i,off in enumerate((-22,0,22)):
        pts=[(x+off,y-900),(x+off,y+850)]
        o=curve_polyline(f'NELHA_pipeline_proxy_{i}',pts,3.2,M['industrial'],coll,z=.7)
        o['evidence']='P concept / I alignment'

def main():
    root=ensure_coll('R2_RACE_CORRIDOR')
    # clean generated objects only in this collection
    for o in list(root.objects): bpy.data.objects.remove(o,do_unlink=True)
    pts=sample_route(ROUTES.get('bike',[]),90)
    chunks=corridor_chunks(pts,2000)
    for i,ch in enumerate(chunks):
        c=ensure_coll(f'R2_QK_{i:02d}')
        for o in list(c.objects): bpy.data.objects.remove(o,do_unlink=True)
        road=curve_polyline(f'QueenK_{i:02d}',ch,13.6,M['asphalt'],c)
        road['chunk_index']=i
        dress_chunk(i,ch,c)
    add_nelha(ensure_coll('R2_NELHA'))
    bpy.context.scene['ring2_chunks']=len(chunks)
    bpy.context.scene['ring2_route_source']='data/routes.json'
    bpy.context.scene['ring2_world_source']='data/island_world_v2.json'
    print('R2 corridor chunks',len(chunks),'samples',len(pts))

if __name__=='__main__':
    main()
