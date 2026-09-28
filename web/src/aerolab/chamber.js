import * as THREE from 'three';

/** Open-frame test chamber with lit uprights and a floor grid (illustrative set dressing). */
export function makeChamber(){
 const g=new THREE.Group();g.name='Aerodynamics chamber';
 const frame=new THREE.MeshStandardMaterial({color:0x17232b,metalness:.65,roughness:.4}),light=new THREE.MeshBasicMaterial({color:0x58b9c0});
 for(const x of [-2.8,-1.65,1.65,2.8]){
  for(const z of [-1.25,1.25]){const m=new THREE.Mesh(new THREE.BoxGeometry(.045,2.65,.045),frame);m.position.set(x,1.325,z);g.add(m);const l=new THREE.Mesh(new THREE.BoxGeometry(.008,2.4,.008),light);l.position.set(x+.024,1.3,z+.025);g.add(l);}
  const m=new THREE.Mesh(new THREE.BoxGeometry(.045,.045,2.55),frame);m.position.set(x,2.65,0);g.add(m);
 }
 const grid=new THREE.GridHelper(10,40,0x28626c,0x193039);grid.position.y=.002;grid.material.transparent=true;grid.material.opacity=.55;g.add(grid);
 return g;
}
