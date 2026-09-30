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
    this.sourceCount=0; this.geocodedCount=0; this.unresolvedCount=0;
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
    // places_v2.json is the canonical place catalog shipped with the preview.
    // Do not probe a non-existent geocode cache first: that produced a noisy 404
    // on every healthy page load and made browser evidence look worse than reality.
    const res=await fetch(this.base+'places_v2.json');
    if(!res.ok) throw new Error('places_v2.json HTTP '+res.status);
    const cfg=await res.json();
    const items=cfg.places||[];
    this.sourceCount=items.length;
    for(const p of items){
      if(typeof p.lat!=='number'||typeof p.lon!=='number') continue;
      this.geocodedCount++;
      const [x,y]=this.toLocal(p.lat,p.lon);
      const group=new THREE.Group(); group.name='place_'+p.id; group.visible=false;
      group.position.copy(this.W(x,y,0)); group.userData.place=p; this.root.add(group);
      this.buildSection(group,p,x,y);
      this.places.push({p,group,x,y,radius:p.priority==='hero'?2400:p.priority==='high'?1500:900});
    }
    this.unresolvedCount=Math.max(0,this.sourceCount-this.geocodedCount);
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
      item.group.visible=!overview&&d<item.radius;
      if(d<nd){nd=d;nearest=item;}
      if(d<55&&!this.state[item.p.id]?.visited) this.setVisited(item.p.id);
    }
    this.current=nearest&&nd<2500?nearest:null;
  }
  find(id){return this.places.find(x=>x.p.id===id)||null;}
  list(category=null){return this.places.filter(x=>!category||x.p.category===category).map(x=>({...x.p,state:this.getState(x.p.id)}));}
}
