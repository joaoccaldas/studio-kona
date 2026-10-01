// Lightweight deterministic natural materials for KONA.
// No network dependency. These procedural maps are visual fallback only, never evidence.
import * as THREE from 'three';

function fract(x){ return x-Math.floor(x); }
function hash(x,y,s=0){ return fract(Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453123); }
function smooth(t){ return t*t*(3-2*t); }
function valueNoise(x,y,seed=0){
  const ix=Math.floor(x), iy=Math.floor(y), fx=smooth(x-ix), fy=smooth(y-iy);
  const a=hash(ix,iy,seed), b=hash(ix+1,iy,seed), c=hash(ix,iy+1,seed), d=hash(ix+1,iy+1,seed);
  return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
}
function fbm(x,y,seed=0){
  let v=0, amp=.5, f=1, sum=0;
  for(let o=0;o<5;o++){ v+=valueNoise(x*f,y*f,seed+o*13)*amp; sum+=amp; amp*=.5; f*=2.03; }
  return v/sum;
}

function canvasTexture({base=[80,80,80], variation=24, grain=0.45, seed=1, streak=0, size=256}) {
  const c=document.createElement('canvas'); c.width=c.height=size;
  const ctx=c.getContext('2d'); const im=ctx.createImageData(size,size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const n=(fbm(x/42,y/42,seed)-.5)*2;
    const fine=(fbm(x/9,y/9,seed+31)-.5)*2;
    const st=streak?Math.sin((x+y*.17)*streak)*.12:0;
    const v=n*(1-grain*.35)+fine*(grain*.35)+st;
    im.data[i]=Math.max(0,Math.min(255,base[0]+v*variation));
    im.data[i+1]=Math.max(0,Math.min(255,base[1]+v*variation));
    im.data[i+2]=Math.max(0,Math.min(255,base[2]+v*variation));
    im.data[i+3]=255;
  }
  ctx.putImageData(im,0,0);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=4;
  return t;
}

function roughnessTexture({base=.8,variation=.16,seed=10,size=128}) {
  const c=document.createElement('canvas'); c.width=c.height=size;
  const ctx=c.getContext('2d'); const im=ctx.createImageData(size,size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const n=(fbm(x/28,y/28,seed)-.5)*2;
    const fine=(fbm(x/7,y/7,seed+17)-.5)*2;
    const r=Math.max(0,Math.min(1,base+n*variation*.7+fine*variation*.3));
    const v=Math.round(r*255);
    im.data[i]=im.data[i+1]=im.data[i+2]=v; im.data[i+3]=255;
  }
  ctx.putImageData(im,0,0);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}

function material(name, opts){
  const map=canvasTexture(opts.albedo);
  const roughnessMap=roughnessTexture(opts.roughnessMap);
  map.repeat.set(opts.repeat??3,opts.repeat??3);
  roughnessMap.repeat.copy(map.repeat);
  const m=new THREE.MeshStandardMaterial({
    name,
    map,
    roughnessMap,
    roughness:opts.roughness??.9,
    metalness:opts.metalness??0,
    color:0xffffff
  });
  m.userData.generatedFallback=true;
  return m;
}

export function createNaturalMaterials(){
  return {
    lava:material('KONA_Basalt',{
      albedo:{base:[40,36,33],variation:29,grain:.66,seed:11,streak:.11},
      roughnessMap:{base:.94,variation:.08,seed:71},roughness:.95,repeat:18
    }),
    aaLava:material('KONA_Aa_Lava',{
      albedo:{base:[48,40,34],variation:38,grain:.8,seed:13,streak:.19},
      roughnessMap:{base:.97,variation:.05,seed:73},roughness:.98,repeat:22
    }),
    cinder:material('KONA_Cinder',{
      albedo:{base:[77,48,37],variation:35,grain:.72,seed:17},
      roughnessMap:{base:.92,variation:.1,seed:77},roughness:.94,repeat:15
    }),
    drySoil:material('KONA_Dry_Soil',{
      albedo:{base:[119,101,71],variation:31,grain:.4,seed:19},
      roughnessMap:{base:.91,variation:.09,seed:79},roughness:.93,repeat:14
    }),
    dryGrass:material('KONA_Dry_Grass',{
      albedo:{base:[112,111,63],variation:42,grain:.28,seed:23,streak:.07},
      roughnessMap:{base:.93,variation:.07,seed:83},roughness:.94,repeat:17
    }),
    pasture:material('KONA_Pasture',{
      albedo:{base:[83,113,61],variation:46,grain:.3,seed:29},
      roughnessMap:{base:.9,variation:.1,seed:89},roughness:.92,repeat:19
    }),
    wetForest:material('KONA_Wet_Forest',{
      albedo:{base:[36,77,47],variation:48,grain:.36,seed:31},
      roughnessMap:{base:.88,variation:.12,seed:91},roughness:.9,repeat:20
    }),
    cliff:material('KONA_Wet_Cliff',{
      albedo:{base:[57,54,48],variation:33,grain:.7,seed:37,streak:.09},
      roughnessMap:{base:.88,variation:.15,seed:97},roughness:.9,repeat:16
    }),
    asphalt:material('KONA_Asphalt',{
      albedo:{base:[52,53,52],variation:15,grain:.84,seed:41},
      roughnessMap:{base:.79,variation:.12,seed:101},roughness:.82,repeat:24
    }),
    concrete:material('KONA_Concrete',{
      albedo:{base:[161,157,148],variation:24,grain:.63,seed:43},
      roughnessMap:{base:.82,variation:.12,seed:103},roughness:.84,repeat:12
    }),
    stucco:material('KONA_Stucco',{
      albedo:{base:[192,183,163],variation:18,grain:.5,seed:47},
      roughnessMap:{base:.84,variation:.1,seed:107},roughness:.86,repeat:10
    }),
    wood:material('KONA_Wood',{
      albedo:{base:[101,68,42],variation:35,grain:.24,seed:53,streak:.18},
      roughnessMap:{base:.74,variation:.12,seed:109},roughness:.78,repeat:11
    }),
    darkRoof:material('KONA_Dark_Roof',{
      albedo:{base:[67,65,61],variation:20,grain:.68,seed:59},
      roughnessMap:{base:.73,variation:.13,seed:113},roughness:.78,repeat:12
    }),
    metal:material('KONA_Weathered_Metal',{
      albedo:{base:[119,126,126],variation:25,grain:.58,seed:61,streak:.1},
      roughnessMap:{base:.6,variation:.18,seed:127},roughness:.65,metalness:.28,repeat:10
    })
  };
}

export function varyInstanceColors(mesh, count, baseHex, spread=.08, seed=1){
  const base=new THREE.Color(baseHex);
  for(let i=0;i<count;i++){
    const n=(hash(i,seed,seed+5)-.5)*spread;
    const c=base.clone().offsetHSL(n*.08,n*.1,n);
    mesh.setColorAt(i,c);
  }
  if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
}
