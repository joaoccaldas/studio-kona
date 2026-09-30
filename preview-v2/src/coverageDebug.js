// Visual coverage diagnostic for Island World V2.
// Only enabled explicitly; never shown in normal player experience.
import * as THREE from 'three';

export class CoverageDebug {
  constructor({scene,W,heightAt,toLocal,base='assets/'}){
    this.scene=scene; this.W=W; this.heightAt=heightAt; this.toLocal=toLocal; this.base=base;
    this.root=new THREE.Group(); this.root.name='KONA_COVERAGE_DEBUG'; this.root.visible=false; scene.add(this.root);
    this.items=[];
  }
  async init(){
    const cfg=await fetch(this.base+'island_world_v2.json').then(r=>r.json());
    const palette={hero:0x36d399,high:0x22d3ee,medium:0xfbbf24};
    for(const z of cfg.zones||[]){
      const [x,y]=this.toLocal(z.lat,z.lon);
      const r=Math.max(650,Math.min(z.radius_m||1200, z.lod==='hero'?18000:7000));
      const mat=new THREE.MeshBasicMaterial({
        color:palette[z.lod]||0x94a3b8,transparent:true,opacity:z.lod==='hero'?.22:.16,
        depthWrite:false,side:THREE.DoubleSide
      });
      const geo=new THREE.RingGeometry(r*.58,r,64);
      geo.rotateX(-Math.PI/2);
      const h=Math.max(0,this.heightAt(x,y))+60;
      const mesh=new THREE.Mesh(geo,mat);
      mesh.position.copy(this.W(x,y,h));
      mesh.name='coverage_'+z.id;
      mesh.renderOrder=30;
      mesh.userData={zone:z.id,lod:z.lod};
      this.root.add(mesh);
      this.items.push(mesh);
    }
  }
  setVisible(v=true){ this.root.visible=!!v; }
  toggle(){ this.setVisible(!this.root.visible); return this.root.visible; }
  summary(){
    return this.items.reduce((a,m)=>{const k=m.userData.lod||'other';a[k]=(a[k]||0)+1;return a;},{});
  }
}
