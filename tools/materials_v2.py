"""Generate lightweight procedural terrain texture atlases for KONA Studio.

These are neutral fallback materials, not documentary imagery. They guarantee that
every biome has a coherent texture before higher-quality CC0/public materials are
baked in. Outputs are deterministic and safe for redistribution.

Outputs:
  web/public/assets/materials/kona_biomes_*.jpg
  web/public/assets/materials/kona_biomes_manifest.json
"""
import os, json, math, random
from PIL import Image, ImageDraw, ImageFilter

HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..'))
OUT=os.path.join(ROOT,'web','public','assets','materials')
os.makedirs(OUT,exist_ok=True)

BIOMES={
 'lava':((35,32,30),(66,57,50),.72),
 'cinder':((70,38,28),(110,68,48),.82),
 'dry':((112,96,68),(155,136,91),.58),
 'grass':((78,102,60),(130,150,89),.48),
 'wet':((35,67,43),(70,111,66),.55),
 'sand':((143,126,91),(196,174,125),.34),
 'rock':((65,58,53),(104,95,84),.66),
 'urban':((105,104,99),(156,152,143),.22)
}

def lerp(a,b,t): return tuple(int(a[i]*(1-t)+b[i]*t) for i in range(3))

def make(name,a,b,rough,seed=1,n=512):
    rng=random.Random(seed)
    im=Image.new('RGB',(n,n),a); px=im.load()
    # multi-scale deterministic noise
    for y in range(n):
        for x in range(n):
            v=.5
            v += .18*math.sin(x*.035+rng.random()*.02)*math.sin(y*.041)
            v += .11*math.sin(x*.12+y*.07)
            v += .06*math.sin(x*.42-y*.31)
            v=max(0,min(1,v))
            px[x,y]=lerp(a,b,v)
    d=ImageDraw.Draw(im,'RGBA')
    # biome-specific readable structure
    count=280 if name in ('lava','rock','cinder') else 140
    for i in range(count):
        x=rng.randrange(n); y=rng.randrange(n); r=rng.randint(1,9)
        if name in ('lava','rock','cinder'):
            col=(15,12,10,rng.randint(25,85))
            d.ellipse((x-r,y-r,x+r*2,y+r),fill=col)
        elif name in ('grass','wet','dry'):
            col=(30,65,25,rng.randint(15,50))
            d.line((x,y,x+rng.randint(-3,3),y-rng.randint(2,12)),fill=col,width=1)
    im=im.filter(ImageFilter.GaussianBlur(.35))
    path=os.path.join(OUT,f'kona_biome_{name}.jpg')
    im.save(path,quality=86,optimize=True)
    return {'file':f'materials/kona_biome_{name}.jpg','roughness':rough,'generated':True,'evidence':'procedural fallback'}

manifest={'version':1,'materials':{}}
for i,(name,(a,b,r)) in enumerate(BIOMES.items()):
    manifest['materials'][name]=make(name,a,b,r,100+i)
json.dump(manifest,open(os.path.join(OUT,'kona_biomes_manifest.json'),'w'),indent=2)
print('generated',len(manifest['materials']),'biome textures')
