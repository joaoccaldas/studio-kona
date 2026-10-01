import * as THREE from 'three';

const PROFILES={
  hilo:{ground:'wetForest',accent:'pasture',density:1.35,wet:true},
  hilo_bay:{ground:'wetForest',accent:'pasture',density:1.25,wet:true},
  hamakua:{ground:'wetForest',accent:'pasture',density:1.45,wet:true},
  akaka:{ground:'wetForest',accent:'pasture',density:1.55,wet:true},
  puna:{ground:'wetForest',accent:'aaLava',density:1.35,wet:true},
  waimea:{ground:'pasture',accent:'dryGrass',density:.9,wet:false},
  hawi:{ground:'pasture',accent:'dryGrass',density:1.0,wet:false},
  waikoloa:{ground:'lava',accent:'dryGrass',density:.55,wet:false},
  kawaihae:{ground:'lava',accent:'dryGrass',density:.45,wet:false},
  nelha:{ground:'lava',accent:'dryGrass',density:.4,wet:false},
  airport:{ground:'lava',accent:'dryGrass',density:.35,wet:false},
  old_airport:{ground:'lava',accent:'dryGrass',density:.45,wet:false},
  kahaluu:{ground:'lava',accent:'pasture',density:.8,wet:false},
  keauhou:{ground:'lava',accent:'pasture',density:.8,wet:false},
  south_kona_slope:{ground:'drySoil',accent:'pasture',density:1.05,wet:false},
  kau:{ground:'aaLava',accent:'dryGrass',density:.55,wet:false},
  punaluu:{ground:'lava',accent:'dryGrass',density:.55,wet:false},
  south_point:{ground:'dryGrass',accent:'lava',density:.55,wet:false}
};

function material(shared,key){ return shared[key]||shared.dryGrass||shared.lava; }

export function applyRegionalGrammar({group,z,shared,coarse=false,heightAt,cx,cy}){
  const p=PROFILES[z.id];
  if(!p) return {profile:null,accentCount:0};
  group.userData.regionalProfile=p;
  const count=Math.max(6,Math.round((coarse?9:18)*p.density));
  const geo=new THREE.DodecahedronGeometry(1,0);
  const mat=material(shared,p.accent);
  const accents=new THREE.InstancedMesh(geo,mat,count);
  accents.name=z.id+'_regional_accents';
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3();
  for(let i=0;i<count;i++){
    const a=i*2.3999632297;
    const rr=z.radius_m*(.18+.62*((i*37%101)/101));
    const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
    const h=Math.max(0,heightAt(cx+x,cy+y));
    const size=p.wet?1.3+(i%5)*.35:1.7+(i%6)*.5;
    q.setFromAxisAngle(new THREE.Vector3(0,1,0),a*.37);
    s.set(size*(1+(i%3)*.18),p.wet?size*1.6:size*.7,size*(.8+(i%4)*.12));
    m.compose(new THREE.Vector3(x,h+size*.45,-y),q,s);
    accents.setMatrixAt(i,m);
  }
  accents.instanceMatrix.needsUpdate=true;
  accents.userData.evidence='regional visual grammar overlay; not landmark geometry';
  group.add(accents);
  return {profile:p,accentCount:count};
}

export function regionalProfileFor(id){ return PROFILES[id]||null; }
