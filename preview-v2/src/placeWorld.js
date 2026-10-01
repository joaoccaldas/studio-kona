// Persistent real-place layer for KONA Studio.
// Geometry is lightweight/procedural; identity and state survive unload/reload.
import * as THREE from 'three';
import { createNaturalMaterials } from './naturalMaterials.js';
import { buildPlaceRecipe } from './placeRecipes.js';

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
      const semanticOnly = Math.hypot(x,y) < 3500 && !p.visual_profile && p.priority !== 'hero';
      group.userData.semanticOnly=semanticOnly;
      this.places.push({
        p,group,x,y,
        radius:p.priority==='hero'?2400:p.priority==='high'?1500:900,
        semanticOnly,service,
        built:false,
        building:false
      });
    }
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
    buildPlaceRecipe({
      group:g,
      place:p,
      z,
      shared:this.shared,
      coarse:this.coarse,
      material:this.matFor(p)
    });
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
      const shouldShow=!overview&&!item.semanticOnly&&d<item.radius;
      if(shouldShow&&!item.built&&!item.building){
        item.building=true;
        this.buildSection(item.group,item.p,item.x,item.y);
        item.built=true;
        item.building=false;
      }
      item.group.visible=shouldShow&&item.built;
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
    return {place:item.p,state:this.getState(id),service:item.service||null,semanticOnly:item.semanticOnly,built:item.built};
  }
  currentSelection(){return this.current?this.describe(this.current.p.id):null;}
  list(category=null){return this.places.filter(x=>!category||x.p.category===category).map(x=>({...x.p,state:this.getState(x.p.id),service:this.serviceFor(x.p.id)}));}
}
