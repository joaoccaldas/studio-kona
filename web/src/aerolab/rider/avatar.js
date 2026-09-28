import * as THREE from 'three';
import data from './avatar-data.json';
const V=a=>new THREE.Vector3(...a),up=new THREE.Vector3(0,1,0),lateral=new THREE.Vector3(0,0,1);
function rotation(a,b){const y=b.clone().sub(a).normalize(),x=y.clone().cross(lateral).normalize(),z=x.clone().cross(y).normalize();return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));}
export function makeAvatar(parent){
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data.position,3));geo.setIndex(data.index);geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.skinIndex,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.skinWeight,4));geo.computeVertexNormals();
 const colors=new Float32Array(data.clothing.length*3);geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
 const mat=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.94,clearcoat:0,specularIntensity:.2,envMapIntensity:.17});const mesh=new THREE.SkinnedMesh(geo,mat);mesh.name='MakeHuman CC0 fitted surface';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 const bones=data.bones.map(([name,a,b])=>{const bone=new THREE.Bone();bone.name=name;bone.position.copy(V(a));bone.quaternion.copy(rotation(V(a),V(b)));mesh.add(bone);return bone;});mesh.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(bones));parent.add(mesh);
 let tone='#bd8e70',kit='#174951',build=1;
 function appearance(skin=tone,suit=kit,volume=build){tone=skin;kit=suit;build=volume;const a=new THREE.Color(tone),b=new THREE.Color(kit);for(let i=0;i<data.clothing.length;i++){const c=a.clone().lerp(b,THREE.MathUtils.smoothstep(data.clothing[i],.2,.8));if(data.skinIndex.slice(i*4,i*4+4).some((idx,j)=>data.bones[idx][0].startsWith('foot')&&data.skinWeight[i*4+j]>.4))c.set('#e6edeb');colors.set(c.toArray(),i*3);}geo.attributes.color.needsUpdate=true;}
 const B=(name,a,b,width=1,depth=width)=>{const i=data.bones.findIndex(x=>x[0]===name),bone=bones[i],rest=data.bones[i];bone.position.copy(V(a));bone.quaternion.copy(rotation(V(a),V(b)));bone.scale.set(depth,V(a).distanceTo(V(b))/V(rest[1]).distanceTo(V(rest[2])),width);};
 function draw(p,f){const A=(a,z=0)=>[a[0],a[1],z],hip=A(p.hip),shoulder=A(p.shoulder);B('pelvis',hip,[hip[0],hip[1]+.10,0],f.hipWidth/22,build);B('torso',hip,shoulder,f.shoulders/33.54,build);B('neck',shoulder,[p.head[0]-.015,p.head[1]-.06,0],1,1);B('head',[p.head[0]-.015,p.head[1]-.06,0],[p.head[0]+.010,p.head[1]+.082,0],f.height/178,f.height/178);
 for(const [i,s,side] of [[0,1,'R'],[1,-1,'L']]){const l=p.legs[i];B('thigh.'+side,A(p.hip,s*p.hipZ),A(l.knee,s*p.kneeZ),build,build);B('shin.'+side,A(l.knee,s*p.kneeZ),A(l.ankle,s*p.ankleZ),build,build);B('foot.'+side,A(l.ankle,s*p.ankleZ),[l.ankle[0]+p.footDir[0]*.18,l.ankle[1]+p.footDir[1]*.18-.03,s*p.ankleZ],.85,.85);B('upperarm.'+side,A(p.shoulder,s*f.shoulders/200),A(p.elbow,s*p.elbowZ),build,build);B('forearm.'+side,A(p.elbow,s*p.elbowZ),A(p.wrist,s*p.wristZ),build,build);B('hand.'+side,A(p.wrist,s*p.wristZ),[p.grip[0]+.025,p.grip[1]-.035,s*p.wristZ],.9,.9);}
 }
 appearance();return {mesh,draw,appearance};
}
