import * as THREE from 'three';

function box(g,mat,name,x,y,z,sx,sy,sz,evidence){
  const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);
  m.name=name; m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.userData.evidence=evidence; g.add(m); return m;
}

export function addHeroVisualProfile({group:g,place:p,z,shared}){
  if(!p.visual_profile) return false;

  if(p.visual_profile==='historic_plantation_storefront'){
    const green=new THREE.MeshStandardMaterial({color:0x71866a,roughness:.9,metalness:0});
    const trim=new THREE.MeshStandardMaterial({color:0xd8d1bd,roughness:.88,metalness:0});
    box(g,green,p.id+'_historic_body',0,z+4.1,0,24,4.1,11,'official source: restored historic plantation building; form remains simplified');
    box(g,trim,p.id+'_historic_porch',0,z+1.7,-13,25,.3,3.3,'official source supports historic plantation storefront; porch depth inferred');
    for(let i=-4;i<=4;i++) box(g,trim,p.id+'_historic_post_'+(i+4),i*5.2,z+3.5,-15.5,.18,3.5,.18,'historic storefront porch rhythm inferred from building type');
    const roof=new THREE.Mesh(new THREE.CylinderGeometry(17,19,2.2,4),shared.roof);
    roof.name=p.id+'_historic_roof'; roof.rotation.y=Math.PI/4; roof.scale.set(1,.55,.72); roof.position.set(0,z+9,0);
    roof.userData.evidence='historic roof form simplified from official visual reference';
    g.add(roof);
    g.userData.visualEvidence=p.visual_evidence;
    return true;
  }

  if(p.visual_profile==='garden_courtyard_hospital'){
    const roofBlue=new THREE.MeshStandardMaterial({color:0x8da9b5,roughness:.82,metalness:0});
    const wingMat=shared.medical;
    const offsets=[[-28,0,30,8,18],[0,10,28,9,22],[30,-2,26,8,17]];
    offsets.forEach((o,i)=>{
      const [x,zz,w,h,d]=o;
      box(g,wingMat,p.id+'_courtyard_wing_'+i,x,z+h*.5,zz,w,h*.5,d,'official source confirms hospital campus; wing footprint simplified');
      box(g,roofBlue,p.id+'_blue_roof_'+i,x,z+h+.45,zz,w*1.04,.35,d*1.04,'official source: light blue roof');
    });
    const garden=new THREE.Mesh(new THREE.CircleGeometry(18,32),shared.pasture);
    garden.name=p.id+'_garden_courtyard'; garden.rotation.x=-Math.PI/2; garden.position.set(0,z+.22,-15);
    garden.userData.evidence='official source: courtyard landscaping/garden context';
    g.add(garden);
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      const shrub=new THREE.Mesh(new THREE.DodecahedronGeometry(1.2,0),shared.pasture);
      shrub.position.set(Math.cos(a)*14,z+1.1,-15+Math.sin(a)*9); shrub.scale.set(1.4,1,.9); g.add(shrub);
    }
    g.userData.visualEvidence=p.visual_evidence;
    return true;
  }
  return false;
}
