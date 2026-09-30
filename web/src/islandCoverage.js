// Adaptive island coverage renderer.
// Provides visual continuity between hero 3D sections using lightweight biome surfaces and instancing.
import * as THREE from 'three';
import { createNaturalMaterials, varyInstanceColors } from './naturalMaterials.js';

function hash2(x,y){ const s=Math.sin(x*12.9898+y*78.233)*43758.5453; return s-Math.floor(s); }

export class IslandCoverage {
  constructor({scene,W,heightAt,coarse=false}){
    this.scene=scene; this.W=W; this.heightAt=heightAt; this.coarse=coarse;
    this.root=new THREE.Group(); this.root.name='KONA_ISLAND_COVERAGE'; scene.add(this.root);
    this.tiles=[]; this.t=0;
    this.materials=createNaturalMaterials();
    this.shared={
      rock:new THREE.IcosahedronGeometry(1,1),
      shrub:new THREE.ConeGeometry(1,1.5,6),
      tree:new THREE.CylinderGeometry(.18,.3,1,6),
      crown:new THREE.ConeGeometry(1.2,2.5,7)
    };
  }
  classify(x,y,z){
    // Heuristic first pass. Replace progressively with public land-cover / rainfall / geology rasters.
    const north=y>32000, east=x>42000, south=y<-28000, high=z>1800;
    if(high) return z>3000?'cinder':'cliff';
    if(east) return z<450?'wetForest':'pasture';
    if(north) return z<900?'pasture':'wetForest';
    if(south) return z<700?'aaLava':'drySoil';
    return z<500?'lava':'dryGrass';
  }
  buildTile(cx,cy,size=6000){
    const seg=this.coarse?20:32;
    const g=new THREE.PlaneGeometry(size,size,seg,seg);
    g.rotateX(-Math.PI/2);
    const p=g.attributes.position;
    let biomeCount={};
    for(let i=0;i<p.count;i++){
      const lx=p.getX(i), lz=p.getZ(i);
      const x=cx+lx, y=cy-lz, h=Math.max(-50,this.heightAt(x,y));
      p.setY(i,h);
      const b=this.classify(x,y,h); biomeCount[b]=(biomeCount[b]||0)+1;
    }
    g.computeVertexNormals();
    const centerH=Math.max(0,this.heightAt(cx,cy));
    const biome=this.classify(cx,cy,centerH);
    const mat=(this.materials[biome]||this.materials.drySoil).clone();
    mat.polygonOffset=true; mat.polygonOffsetFactor=-1; mat.polygonOffsetUnits=-1;
    const mesh=new THREE.Mesh(g,mat);
    mesh.position.set(cx,.22,-cy);
    mesh.name='coverage_'+Math.round(cx)+'_'+Math.round(cy);
    mesh.userData.biome=biome;
    this.root.add(mesh);

    const density=this.coarse?22:48;
    const wet=biome==='wetForest', pasture=biome==='pasture';
    const geo=wet?this.shared.crown:this.shared.shrub;
    const scatterMat=wet?this.materials.wetForest:(pasture?this.materials.pasture:this.materials.dryGrass);
    const inst=new THREE.InstancedMesh(geo,scatterMat,density);
    const m=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(), pos=new THREE.Vector3();
    for(let i=0;i<density;i++){
      const rx=(hash2(i,cx)-.5)*size*.92, ry=(hash2(i,cy)-.5)*size*.92;
      const x=cx+rx, y=cy+ry, h=Math.max(0,this.heightAt(x,y));
      pos.copy(this.W(x,y,h+(wet?2.5:.6)));
      q.setFromAxisAngle(new THREE.Vector3(0,1,0),hash2(i*3,cx+cy)*Math.PI*2);
      const k=.8+hash2(i*7,cy)*2.2; s.set(k,k,k);
      m.compose(pos,q,s); inst.setMatrixAt(i,m);
    }
    inst.instanceMatrix.needsUpdate=true;
    varyInstanceColors(inst,density,wet?0x315c38:(pasture?0x6b824d:0x84784a),.12,Math.round(cx+cy));
    inst.name=mesh.name+'_scatter'; this.root.add(inst);
    this.tiles.push({mesh,inst,cx,cy,size});
  }
  buildGrid({x0,y0,x1,y1,step=12000}){
    for(let y=y0;y<=y1;y+=step) for(let x=x0;x<=x1;x+=step) this.buildTile(x,y,step);
  }
  update(dt,camera){
    this.t+=dt;if(this.t<1)return;this.t=0;
    const cx=camera.position.x,cy=-camera.position.z;
    const overview=camera.position.y>45000;
    for(const t of this.tiles){
      const d=Math.hypot(t.cx-cx,t.cy-cy);
      const visible=!overview && d<(this.coarse?24000:36000);
      t.mesh.visible=visible;
      t.inst.visible=visible&&d<18000;
    }
  }
}
