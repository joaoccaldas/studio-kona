import * as THREE from 'three';
import { addHeroVisualProfile } from './heroPlaceDetails.js';

function addBox(g,geo,mat,name,x,y,z,sx,sy,sz,evidence='procedural approximation'){
  const m=new THREE.Mesh(geo,mat);
  m.name=name; m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.userData.evidence=evidence; g.add(m); return m;
}
function addRoof(g,shared,id,z,sx,sy,sz){
  const roofGeo=new THREE.CylinderGeometry(Math.max(sx,sz)*.78,Math.max(sx,sz)*.88,1.4,4);
  const roof=new THREE.Mesh(roofGeo,shared.roof);
  roof.rotation.y=Math.PI/4; roof.scale.set(1,.7,.72); roof.name=id+'_roof'; roof.position.y=z+sy*2+.7;
  roof.userData.evidence='procedural roof proportion; replace with measured footprint/roofline';
  g.add(roof);
}
function addRetailFront(g,shared,id,z,sx,sy,sz,{awning=true,windows=3}={}){
  if(awning) addBox(g,shared.box,shared.roof,id+'_awning',0,z+sy*1.45,-sz-1.1,sx*.9,.22,2.2,'procedural facade cue');
  const glass=addBox(g,shared.box,shared.glass,id+'_glass',0,z+sy*.95,-sz-.28,sx*.76,sy*.42,.16,'procedural glazing band');
  for(let i=0;i<windows;i++){
    const x=(i-(windows-1)/2)*(sx*1.25/windows);
    addBox(g,shared.box,shared.shop,id+'_bay_'+i,x,z+1.1,-sz-.55,sx*.18,1.1,.32,'procedural storefront bay');
  }
  return glass;
}
function addWaterfrontRestaurant(g,shared,p,z,sx,sy,sz){
  addBox(g,shared.box,shared.food,p.id+'_deck',0,z+.4,-sz*1.15,sx*1.25,.25,sz*.55,'procedural waterfront deck');
  for(let i=-2;i<=2;i++){
    const t=new THREE.Mesh(shared.cyl,shared.shop); t.name=p.id+'_table_'+(i+2); t.scale.set(.9,.45,.9); t.position.set(i*4,z+1,-sz*1.2); g.add(t);
  }
  addRetailFront(g,shared,p.id,z,sx,sy,sz,{awning:false,windows:4});
}
function addBikeShop(g,shared,p,z,sx,sy,sz){
  addRetailFront(g,shared,p.id,z,sx,sy,sz,{awning:true,windows:4});
  for(let i=-2;i<=2;i++){
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(1.15,.08,8,20),shared.service);
    wheel.name=p.id+'_wheel_'+(i+2); wheel.rotation.y=Math.PI/2; wheel.position.set(i*3.2,z+2.2,-sz-1.5); g.add(wheel);
  }
}
function addHistoricStorefront(g,shared,p,z,sx,sy,sz){
  addRetailFront(g,shared,p.id,z,sx,sy,sz,{awning:true,windows:5});
  const porch=addBox(g,shared.box,shared.food,p.id+'_porch',0,z+.35,-sz-2.2,sx*1.08,.28,2.4,'procedural porch cue');
  for(let i=-3;i<=3;i++){
    addBox(g,shared.box,shared.food,p.id+'_post_'+(i+3),i*(sx*.28),z+sy*.72,-sz-2.7,.16,sy*.72,.16,'procedural porch post');
  }
  return porch;
}
function addHospitalCampus(g,shared,p,z,sx,sy,sz){
  for(let i=0;i<3;i++){
    addBox(g,shared.box,shared.medical,p.id+'_wing_'+i,(i-1)*sx*1.25,z+sy*.7,(i%2?1:-1)*sz*.9,sx*(.7+i*.15),sy*.7,sz*.35,'procedural campus wing');
  }
  const helipad=new THREE.Mesh(new THREE.CylinderGeometry(6,6,.25,32),shared.meeting);
  helipad.name=p.id+'_helipad'; helipad.position.set(sx*1.8,z+.4,0); helipad.userData.evidence='procedural medical-campus cue, not surveyed geometry'; g.add(helipad);
}
function addRunwayPark(g,shared,p,z){
  addBox(g,shared.box,shared.service,p.id+'_runway',0,z+.25,0,12,.15,220,'runway-scale proxy');
}
function addParkCampus(g,shared,p,z,coarse){
  const n=coarse?8:16;
  for(let i=0;i<n;i++){
    const tree=new THREE.Mesh(shared.cone,shared.park); const a=i/n*Math.PI*2;
    tree.name=p.id+'_tree_'+i; tree.scale.set(2,5,2); tree.position.set(Math.cos(a)*35,z+5,Math.sin(a)*35); g.add(tree);
  }
}
function addRestaurant(g,shared,p,z,sx,sy,sz){
  addRetailFront(g,shared,p.id,z,sx,sy,sz,{awning:true,windows:4});
  addBox(g,shared.box,shared.food,p.id+'_patio',0,z+.28,-sz-3.4,sx*.9,.18,3.2,'procedural patio cue');
}
function addRetailCenter(g,shared,p,z,sx,sy,sz){
  for(let i=0;i<3;i++){
    const x=(i-1)*sx*1.6;
    addBox(g,shared.box,shared.shop,p.id+'_block_'+i,x,z+sy*.8,0,sx*1.25,sy*.8,sz*.72,'procedural retail-center block');
    addRetailFront(g,shared,p.id+'_block_'+i,z,sx*1.25,sy*.8,sz*.72,{awning:true,windows:3});
  }
}
function addMedicalCenter(g,shared,p,z,sx,sy,sz){
  addBox(g,shared.box,shared.medical,p.id+'_clinic',0,z+sy*.85,0,sx*1.1,sy*.85,sz*.8,'procedural clinic massing');
  addRetailFront(g,shared,p.id,z,sx,sy,sz,{awning:false,windows:3});
}
function addServiceShop(g,shared,p,z,sx,sy,sz){
  addBox(g,shared.box,shared.service,p.id+'_bay',0,z+sy*.7,0,sx*1.2,sy*.7,sz*.9,'procedural service-bay massing');
  for(let i=-1;i<=1;i++) addBox(g,shared.box,shared.glass,p.id+'_door_'+(i+1),i*sx*.55,z+sy*.62,-sz*.92,sx*.32,sy*.42,.12,'procedural service door');
}
function addWaterfrontLandmark(g,shared,p,z,sx,sy,sz){
  addBox(g,shared.box,shared.meeting,p.id+'_pier',0,z+.55,-sz*1.7,sx*.8,.35,sz*1.3,'landmark-scale pier proxy');
  for(let i=-2;i<=2;i++) addBox(g,shared.box,shared.meeting,p.id+'_pile_'+(i+2),i*sx*.28,z-1,-sz*1.7,.24,2.4,.24,'pier pile proxy');
}
function addHistoricShops(g,shared,p,z,sx,sy,sz){
  for(let i=-1;i<=1;i++){
    const sub={...p,id:p.id+'_unit_'+(i+1)};
    addBox(g,shared.box,shared.shop,sub.id+'_shell',i*sx*1.4,z+sy*.82,0,sx*1.15,sy*.82,sz*.78,'procedural historic retail unit');
    addHistoricStorefront(g,shared,sub,z,sx*1.15,sy*.82,sz*.78);
  }
}


function addSpecificHospital(g,shared,p,z){
  const cfg={
    kona_hospital:{w:46,d:28,h:10,wings:4},
    queens_north_hawaii:{w:52,d:30,h:10,wings:4},
    hilo_benioff:{w:58,d:34,h:12,wings:5}
  }[p.id];
  if(!cfg) return false;
  addBox(g,shared.box,shared.medical,p.id+'_core',0,z+cfg.h*.5,0,cfg.w,cfg.h,cfg.d,'place-specific hospital campus proxy');
  for(let i=0;i<cfg.wings;i++){
    const a=i/cfg.wings*Math.PI*2;
    const wing=addBox(g,shared.box,shared.medical,p.id+'_wing_'+i,Math.cos(a)*cfg.w*.62,z+cfg.h*.36,Math.sin(a)*cfg.d*.78,cfg.w*.56,cfg.h*.72,cfg.d*.42,'place-specific hospital wing proxy');
    wing.rotation.y=-a+.2;
  }
  addBox(g,shared.box,shared.roof,p.id+'_roof',0,z+cfg.h+.3,0,cfg.w*1.03,.55,cfg.d*1.03,'hospital roof proxy');
  const parking=new THREE.Mesh(new THREE.PlaneGeometry(cfg.w*3.2,cfg.d*2.2),shared.service);
  parking.rotation.x=-Math.PI/2; parking.position.set(cfg.w*.85,z+.18,cfg.d*1.1); parking.name=p.id+'_parking'; g.add(parking);
  const helipad=new THREE.Mesh(new THREE.CylinderGeometry(8,8,.25,32),shared.meeting);
  helipad.position.set(-cfg.w*.95,z+.24,-cfg.d*.95); helipad.name=p.id+'_helipad'; g.add(helipad);
  return true;
}
function addSpecificBikeService(g,shared,p,z){
  if(!['bike_works_waikoloa','bike_works_mauka','hilo_bike_hub'].includes(p.id)) return false;
  const w=34,d=22,h=7;
  addBox(g,shared.box,shared.wall,p.id+'_shell',0,z+h*.5,0,w,h,d,'place-specific bike-service storefront proxy');
  addBox(g,shared.box,shared.roof,p.id+'_roof',0,z+h+.22,0,w*1.04,.42,d*1.04,'bike-service roof proxy');
  addBox(g,shared.box,shared.glass,p.id+'_glass',0,z+h*.54,-d*.51,w*.7,h*.46,.18,'bike-service glazing proxy');
  addBox(g,shared.box,shared.roof,p.id+'_awning',0,z+h*.78,-d*.62,w*.74,.18,3.1,'bike-service awning proxy');
  for(let i=-2;i<=2;i++){
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(1.05,.075,8,20),shared.service);
    wheel.rotation.y=Math.PI/2; wheel.position.set(i*3.4,z+2,-d*.58); wheel.name=p.id+'_wheel_'+(i+2); g.add(wheel);
  }
  return true;
}

export function buildPlaceRecipe({group:g,place:p,z,shared,coarse=false,material}){
  const hero=p.priority==='hero';
  const sx=hero?22:14, sz=hero?28:18, sy=hero?8:6;
  const baseMat=material||shared.shop;
  if(addHeroVisualProfile({group:g,place:p,z,shared})) return;
  if(addSpecificHospital(g,shared,p,z)) return;
  if(addSpecificBikeService(g,shared,p,z)) return;
  addBox(g,shared.box,baseMat,p.id+'_shell',0,z+sy,0,sx,sy,sz,'procedural shell; identity/location verified, geometry inferred');
  addRoof(g,shared,p.id,z,sx,sy,sz);

  switch(p.recipe){
    case 'waterfront_restaurant': addWaterfrontRestaurant(g,shared,p,z,sx,sy,sz); break;
    case 'running_shop': addRetailFront(g,shared,p.id,z,sx,sy,sz,{awning:true,windows:4}); break;
    case 'bike_shop': addBikeShop(g,shared,p,z,sx,sy,sz); break;
    case 'hospital_campus': addHospitalCampus(g,shared,p,z,sx,sy,sz); break;
    case 'park_runway': addRunwayPark(g,shared,p,z); break;
    case 'park_campus':
    case 'pavilion': addParkCampus(g,shared,p,z,coarse); break;
    case 'historic_storefront': addHistoricStorefront(g,shared,p,z,sx,sy,sz); break;
    case 'restaurant':
    case 'cafe': addRestaurant(g,shared,p,z,sx,sy,sz); break;
    case 'retail_center':
    case 'grocery': addRetailCenter(g,shared,p,z,sx,sy,sz); break;
    case 'medical_center': addMedicalCenter(g,shared,p,z,sx,sy,sz); break;
    case 'service_shop':
    case 'small_shop': addServiceShop(g,shared,p,z,sx,sy,sz); break;
    case 'waterfront_landmark': addWaterfrontLandmark(g,shared,p,z,sx,sy,sz); break;
    case 'historic_shops': addHistoricShops(g,shared,p,z,sx,sy,sz); break;
  }
}
