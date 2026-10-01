// Persistent real-place layer for KONA Studio.
// Geometry is lightweight/procedural; identity and state survive unload/reload.
import * as THREE from 'three';
import { createNaturalMaterials } from './naturalMaterials.js';

const KEY='kona.placeworld.v2';

function loadState(){
  try { return JSON.parse(localStorage.getItem(KEY)||'{}'); } catch { return {}; }
}
function saveState(s){ try { localStorage.setItem(KEY,JSON.stringify(s)); } catch {} }

export class PlaceWorld {
  constructor({scene,W,heightAt,toLocal,coarse=false,base='assets/'}){
    this.scene=scene; this.W=W; this.heightAt=heightAt; this.toLocal=toLocal; this.coarse=coarse; this.base=base;
    this.root=new THREE.Group(); this.root.name='KONA_PLACEWORLD_V2'; scene.add(this.root);
    this.state=loadState();
    this.places=[]; this.t=0; this.current=null;
    this.serviceByPlace=new Map(); this.serviceCount=0;
    this.shared=this.makeShared();
  }
  makeShared(){
    const n=createNaturalMaterials();
    const glass=new THREE.MeshPhysicalMaterial({color:0x6f8d96,roughness:.18,metalness:0,transmission:.18,transparent:true,opacity:.82});
    return {
      wall:n.stucco, roof:n.darkRoof, glass,
      service:n.metal, medical:n.concrete, food:n.wood,
      shop:n.stucco, park:n.pasture, meeting:n.concrete,
      box:new THREE.BoxGeometry(1,1,1), cyl:new THREE.CylinderGeometry(1,1,1,12),
      cone:new THREE.ConeGeometry(1,1,8)
    };
  }
  async init(){
    // places_v2.json is now canonical and already carries verified coordinates.
    // Keep one source of truth and avoid probing a secondary geocode file at runtime.
    const cfg=await fetch(this.base+'places_v2.json').then(r=>{
      if(!r.ok) throw new Error('places_v2.json '+r.status);
      return r.json();
    });
    let serviceCatalog={records:[]};
    try {
      const sr=await fetch(this.base+'athlete_services_v1.json');
      if(sr.ok) serviceCatalog=await sr.json();
    } catch {}
    for(const s of serviceCatalog.records||[]) {
      if(s?.place_id) this.serviceByPlace.set(s.place_id,s);
    }
    this.serviceCount=this.serviceByPlace.size;
    const items=cfg.places||[];
    this.sourceCount=items.length;
    this.geocodedCount=items.filter(p=>typeof p.lat==='number'&&typeof p.lon==='number').length;
    this.unresolvedCount=this.sourceCount-this.geocodedCount;
    for(const p of items){
      if(typeof p.lat!=='number'||typeof p.lon!=='number') continue;
      const [x,y]=this.toLocal(p.lat,p.lon);
      const group=new THREE.Group(); group.name='place_'+p.id; group.visible=false;
      const service=this.serviceByPlace.get(p.id)||null;
      group.position.copy(this.W(x,y,0)); group.userData.place=p; group.userData.service=service; this.root.add(group);
      const semanticOnly=Math.hypot(x,y)<3500;
      group.userData.semanticOnly=semanticOnly;
      if(!semanticOnly) this.buildSection(group,p,x,y);
      this.places.push({p,group,x,y,radius:p.priority==='hero'?2400:p.priority==='high'?1500:900,semanticOnly,service});
    }
  }
  buildKnownPlace(g,p,cx,cy,z){
    if(['kona_hospital','queens_north_hawaii','hilo_benioff'].includes(p.id)){
      this.buildHospitalCampus(g,p,z);
      return true;
    }
    if(['bike_works_waikoloa','bike_works_mauka','hilo_bike_hub'].includes(p.id)){
      this.buildBikeService(g,p,z);
      return true;
    }
    return false;
  }

  buildHospitalCampus(g,p,z){
    const concrete=this.shared.medical;
    const roof=this.shared.roof;
    const asphalt=this.shared.service;
    const green=this.shared.park;

    const cfg={
      kona_hospital:{w:46,d:28,h:10,wings:4},
      queens_north_hawaii:{w:52,d:30,h:10,wings:4},
      hilo_benioff:{w:58,d:34,h:12,wings:5}
    }[p.id]||{w:48,d:30,h:10,wings:4};

    const core=new THREE.Mesh(new THREE.BoxGeometry(cfg.w,cfg.h,cfg.d),concrete);
    core.position.set(0,z+cfg.h*.5,0);
    core.userData.evidence='place-specific hospital campus proxy pending measured footprints';
    g.add(core);

    for(let i=0;i<cfg.wings;i++){
      const a=i/cfg.wings*Math.PI*2;
      const wing=new THREE.Mesh(new THREE.BoxGeometry(cfg.w*.56,cfg.h*.72,cfg.d*.42),concrete);
      wing.position.set(Math.cos(a)*cfg.w*.62,z+cfg.h*.36,Math.sin(a)*cfg.d*.78);
      wing.rotation.y=-a+.2;
      g.add(wing);
    }

    const r=new THREE.Mesh(new THREE.BoxGeometry(cfg.w*1.03,.55,cfg.d*1.03),roof);
    r.position.set(0,z+cfg.h+.3,0); g.add(r);

    const parking=new THREE.Mesh(new THREE.PlaneGeometry(cfg.w*3.2,cfg.d*2.2),asphalt);
    parking.rotation.x=-Math.PI/2; parking.position.set(cfg.w*.85,z+.18,cfg.d*1.1); g.add(parking);

    const helipad=new THREE.Mesh(new THREE.CylinderGeometry(8,8,.25,32),this.shared.meeting);
    helipad.position.set(-cfg.w*.95,z+.24,-cfg.d*.95); g.add(helipad);

    for(let i=0;i<(this.coarse?10:20);i++){
      const a=i*2.399, rr=cfg.w*1.25+(i%4)*6;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,5.5,7),this.shared.food);
      trunk.position.set(Math.cos(a)*rr,z+2.75,Math.sin(a)*rr*.7); g.add(trunk);
      const crown=new THREE.Mesh(new THREE.DodecahedronGeometry(1.3,1),green);
      crown.scale.set(1.8,1.4,1.7); crown.position.copy(trunk.position); crown.position.y+=4.1;
      g.add(crown);
    }
  }

  buildBikeService(g,p,z){
    const wall=this.shared.wall, roof=this.shared.roof, glass=this.shared.glass, service=this.shared.service;
    const w=34,d=22,h=7;
    const shell=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wall);
    shell.position.set(0,z+h*.5,0);
    shell.userData.evidence='place-specific bike-service proxy pending measured storefront geometry';
    g.add(shell);

    const r=new THREE.Mesh(new THREE.BoxGeometry(w*1.04,.42,d*1.04),roof);
    r.position.set(0,z+h+.22,0); g.add(r);

    const front=new THREE.Mesh(new THREE.BoxGeometry(w*.7,h*.46,.18),glass);
    front.position.set(0,z+h*.54,-d*.51); g.add(front);

    const awning=new THREE.Mesh(new THREE.BoxGeometry(w*.74,.18,3.1),roof);
    awning.position.set(0,z+h*.78,-d*.62); g.add(awning);

    for(let i=-2;i<=2;i++){
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(1.05,.075,8,20),service);
      wheel.rotation.y=Math.PI/2; wheel.position.set(i*3.4,z+2,-d*.58); g.add(wheel);
    }

    const apron=new THREE.Mesh(new THREE.PlaneGeometry(48,30),this.shared.service);
    apron.rotation.x=-Math.PI/2; apron.position.set(0,z+.12,18); g.add(apron);
  }

  matFor(p){
    if(p.category==='hospital'||p.category==='medical') return this.shared.medical;
    if(p.category==='restaurant'||p.category==='cafe'||p.category==='grocery') return this.shared.food;
    if(p.category==='bike_service'||p.category==='bike_rental'||p.category==='vehicle_service') return this.shared.service;
    if(p.category==='park') return this.shared.park;
    if(p.category==='meeting_point') return this.shared.meeting;
    return this.shared.shop;
  }
  buildSection(g,p,cx,cy){
    const z=Math.max(0,this.heightAt(cx,cy));
    if(this.buildKnownPlace(g,p,cx,cy,z)) return;
    const m=this.matFor(p);
    const hero=p.priority==='hero';
    const sx=hero?22:14, sz=hero?28:18, sy=hero?8:6;
    const main=new THREE.Mesh(this.shared.box,m);
    main.name=p.id+'_shell'; main.scale.set(sx,sy,sz); main.position.y=z+sy;
    main.userData.evidence='procedural shell until OSM/official/photo-specific geometry replaces it';
    g.add(main);
    const roofGeo=new THREE.CylinderGeometry(Math.max(sx,sz)*.78,Math.max(sx,sz)*.88,1.4,4);
    const roof=new THREE.Mesh(roofGeo,this.shared.roof);
    roof.rotation.y=Math.PI/4;
    roof.scale.set(1,.7,.72);
    roof.name=p.id+'_roof'; roof.position.y=z+sy*2+.7; g.add(roof);

    if(p.recipe==='waterfront_restaurant'){
      const deck=new THREE.Mesh(this.shared.box,this.shared.food);
      deck.scale.set(sx*1.25,.25,sz*.55); deck.position.set(0,z+.4,-sz*1.15); g.add(deck);
      for(let i=-2;i<=2;i++){
        const t=new THREE.Mesh(this.shared.cyl,this.shared.shop); t.scale.set(.9,.45,.9); t.position.set(i*4,z+1,-sz*1.2); g.add(t);
      }
    }
    if(p.recipe==='running_shop'){
      const awning=new THREE.Mesh(this.shared.box,this.shared.darkRoof||this.shared.roof);
      awning.scale.set(sx*.9,.22,2.2); awning.position.set(0,z+sy*1.45,-sz-1.1); g.add(awning);
      const glass=new THREE.Mesh(this.shared.box,this.shared.glass);
      glass.scale.set(sx*.76,sy*.42,.16); glass.position.set(0,z+sy*.95,-sz-.25); g.add(glass);
    }
    if(p.recipe==='bike_shop'){
      for(let i=-2;i<=2;i++){
        const wheel=new THREE.Mesh(new THREE.TorusGeometry(1.15,.08,8,20),this.shared.service);
        wheel.rotation.y=Math.PI/2; wheel.position.set(i*3.2,z+2.2,-sz-1.5); g.add(wheel);
      }
    }
    if(p.recipe==='hospital_campus'){
      for(let i=0;i<3;i++){
        const wing=new THREE.Mesh(this.shared.box,this.shared.medical);
        wing.scale.set(sx*(.7+i*.15),sy*.7,sz*.35);
        wing.position.set((i-1)*sx*1.25,z+sy*.7,(i%2?1:-1)*sz*.9); g.add(wing);
      }
      const helipad=new THREE.Mesh(new THREE.CylinderGeometry(6,6,.25,32),this.shared.meeting);
      helipad.position.set(sx*1.8,z+.4,0); g.add(helipad);
    }
    if(p.recipe==='park_runway'){
      const runway=new THREE.Mesh(this.shared.box,this.shared.service);
      runway.scale.set(12,.15,220); runway.position.y=z+.25; g.add(runway);
    }
    if(p.recipe==='park_campus'||p.recipe==='pavilion'){
      for(let i=0;i<(this.coarse?8:16);i++){
        const tree=new THREE.Mesh(this.shared.cone,this.shared.park);
        const a=i/(this.coarse?8:16)*Math.PI*2;
        tree.scale.set(2,5,2); tree.position.set(Math.cos(a)*35,z+5,Math.sin(a)*35); g.add(tree);
      }
    }

  }
  setVisited(id){
    const s=this.state[id]||(this.state[id]={});
    s.visited=true; s.lastVisited=new Date().toISOString(); saveState(this.state);
  }
  setFavorite(id,value=true){
    const s=this.state[id]||(this.state[id]={});
    s.favorite=value; saveState(this.state);
  }
  getState(id){ return this.state[id]||{}; }
  update(dt,camera){
    this.t+=dt; if(this.t<.5)return; this.t=0;
    const cx=camera.position.x, cy=-camera.position.z;
    const overview=camera.position.y>18000;
    let nearest=null, nd=Infinity;
    for(const item of this.places){
      const d=Math.hypot(item.x-cx,item.y-cy);
      item.group.visible=!overview&&!item.semanticOnly&&d<item.radius;
      if(d<nd){nd=d;nearest=item;}
      if(d<55&&!this.state[item.p.id]?.visited) this.setVisited(item.p.id);
    }
    this.current=nearest&&nd<2500?nearest:null;
  }
  find(id){return this.places.find(x=>x.p.id===id)||null;}
  serviceFor(id){return this.serviceByPlace.get(id)||null;}
  describe(id){
    const item=this.find(id);
    if(!item) return null;
    return {place:item.p,state:this.getState(id),service:item.service||null,semanticOnly:item.semanticOnly};
  }
  currentSelection(){return this.current?this.describe(this.current.p.id):null;}
  list(category=null){return this.places.filter(x=>!category||x.p.category===category).map(x=>({...x.p,state:this.getState(x.p.id),service:this.serviceFor(x.p.id)}));}
}
