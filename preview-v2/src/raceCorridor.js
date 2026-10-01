import * as THREE from 'three';

function sampleRoute(route,max=90){
  if(!route?.length) return [];
  const step=Math.max(1,Math.floor(route.length/max));
  const out=[];
  for(let i=0;i<route.length;i+=step) out.push(route[i]);
  if(out[out.length-1]!==route[route.length-1]) out.push(route[route.length-1]);
  return out;
}

export function buildRaceCorridorContext({scene,W,toLocal,heightAt,shared,coarse=false,route=[]}){
  const root=new THREE.Group();
  root.name='KONA_RACE_CORRIDOR_CONTEXT';
  root.userData.role='context-only; Queen K road geometry remains owned by WorldZoneStreamer';
  scene.add(root);

  const pts=sampleRoute(route,coarse?48:86);
  if(!pts.length) return {root,count:0};

  const markerGeo=new THREE.BoxGeometry(1,1,1);
  const markerMat=shared.concrete||shared.stucco;
  const markers=new THREE.InstancedMesh(markerGeo,markerMat,pts.length);
  markers.name='queen_k_reflector_context';

  const shoulderGeo=new THREE.DodecahedronGeometry(1,0);
  const shoulderMat=shared.lava||shared.aaLava;
  const shoulders=new THREE.InstancedMesh(shoulderGeo,shoulderMat,pts.length*2);
  shoulders.name='queen_k_lava_shoulder_context';

  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3();
  let si=0;
  pts.forEach((ll,i)=>{
    const [lon,lat]=ll;
    const [x,y]=toLocal(lat,lon);
    const h=Math.max(0,heightAt(x,y));
    const prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)];
    const [px,py]=toLocal(prev[1],prev[0]),[nx,ny]=toLocal(next[1],next[0]);
    const dx=nx-px,dy=ny-py,len=Math.hypot(dx,dy)||1;
    const ox=-dy/len,oy=dx/len;
    const heading=Math.atan2(dx,dy);
    q.setFromAxisAngle(new THREE.Vector3(0,1,0),heading);

    const pos=W(x+ox*7.5,y+oy*7.5,h+.55);
    s.set(.18,1.1,.18); m.compose(pos,q,s); markers.setMatrixAt(i,m);

    for(const side of [-1,1]){
      const spread=11+(i%4)*3;
      const rp=W(x+ox*spread*side,y+oy*spread*side,h+.35);
      const rs=1.1+(i%5)*.34;
      s.set(rs*1.7,rs*.55,rs); m.compose(rp,q,s); shoulders.setMatrixAt(si++,m);
    }
  });
  markers.instanceMatrix.needsUpdate=true;
  shoulders.instanceMatrix.needsUpdate=true;
  markers.userData.evidence='race-corridor context markers, not surveyed roadside objects';
  shoulders.userData.evidence='procedural lava shoulder rhythm following verified route';
  root.add(markers,shoulders);

  return {root,count:pts.length};
}
