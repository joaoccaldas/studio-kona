// Adaptive island coverage renderer.
// Provides visual continuity between hero 3D sections using lightweight biome surfaces and instancing.
import * as THREE from 'three';

function hash2(x,y){ const s=Math.sin(x*12.9898+y*78.233)*43758.5453; return s-Math.floor(s); }

export class IslandCoverage {
  constructor({scene,W,heightAt,coarse=false}){
    this.scene=scene; this.W=W; this.heightAt=heightAt; this.coarse=coarse;
    this.root=new THREE.Group(); this.root.name='KONA_ISLAND_COVERAGE'; scene.add(this.root);
    this.tiles=[]; this.t=0;
    this.materials=this.makeMaterials();
    this.shared={
      rock:new THREE.IcosahedronGeometry(1,1),
      shrub:new THREE.ConeGeometry(1,1.5,6),
      tree:new THREE.CylinderGeometry(.18,.3,1,6),
      crown:new THREE.ConeGeometry(1.2,2.5,7)
    };
  }
  makeMaterials(){
    const m=(c,r=.9)=>new THREE.MeshStandardMaterial({color:c,roughness:r});
    return {
      lava:m(0x24211f,.97), cinder:m(0x4a2b1f,.95), dry:m(0x716349,.95),
      grass:m(0x61764a,.94), wet:m(0x29482f,.93), urban:m(0x7f7d75,.88),
      sand:m(0x8d8067,.98), rock:m(0x403a35,.96)
    };
  }
  classify(x,y,z){
    // Heuristic first pass. Replace progressively with public land-cover / rainfall / geology rasters.
    const north=y>32000, east=x>42000, south=y<-28000, high=z>1800;
    if(high) return z>3000?'cinder':'rock';
    if(east) return z<450?'wet':'grass';
    if(north) return z<900?'grass':'wet';
    if(south) return z<700?'lava':'dry';
    return z<500?'lava':'dry';
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
    const mat=this.materials[biome].clone();
    mat.polygonOffset=true; mat.polygonOffsetFactor=-1; mat.polygonOffsetUnits=-1;
    const mesh=new THREE.Mesh(g,mat);
    mesh.position.set(cx,.22,-cy);
    mesh.name='coverage_'+Math.round(cx)+'_'+Math.round(cy);
    mesh.userData.biome=biome;
    this.root.add(mesh);

    const density=this.coarse?22:48;
    const geo=biome==='wet'?this.shared.crown:this.shared.shrub;
    const mat=biome==='wet'?this.materials.wet:(biome==='grass'?this.materials.grass:this.materials.dry);
    const inst=new THREE.InstancedMesh(geo,mat,density);
    const m=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(), pos=new THREE.Vector3();
    for(let i=0;i<density;i++){
      const rx=(hash2(i,cx)-.5)*size*.92, ry=(hash2(i,cy)-.5)*size*.92;
      const x=cx+rx, y=cy+ry, h=Math.max(0,this.heightAt(x,y));
      pos.copy(this.W(x,y,h+(biome==='wet'?2.5:.6)));
      q.setFromAxisAngle(new THREE.Vector3(0,1,0),hash2(i*3,cx+cy)*Math.PI*2);
      const k=.8+hash2(i*7,cy)*2.2; s.set(k,k,k);
      m.compose(pos,q,s); inst.setMatrixAt(i,m);
    }
    inst.instanceMatrix.needsUpdate=true; inst.name=mesh.name+'_scatter'; this.root.add(inst);
    this.tiles.push({mesh,inst,cx,cy,size});
  }
  buildGrid({x0,y0,x1,y1,step=12000}){
    for(let y=y0;y<=y1;y+=step) for(let x=x0;x<=x1;x+=step) this.buildTile(x,y,step);
  }
  update(dt,camera){
    this.t+=dt;if(this.t<1)return;this.t=0;
    const cx=camera.position.x,cy=-camera.position.z;
    for(const t of this.tiles){
      const d=Math.hypot(t.cx-cx,t.cy-cy);
      const visible=d<(this.coarse?24000:36000);
      t.mesh.visible=visible; t.inst.visible=visible&&d<18000;
    }
  }
}
