// Contact-constrained model. Lengths cm, angles degrees; world metres, X forward/Y up.
export const FIT_SOURCE='https://pubmed.ncbi.nlm.nih.gov/32022807/';
export const CANYON_FIT_SOURCE='https://www.canyon.com/en-se/about/innovation/aeroid/';
export const DEFAULT_FIT={height:178,inseam:83,thigh:45.65,shin:45.65,torso:56,upperArm:32,forearm:27,shoulders:40,hipWidth:19,foot:26,saddle:75.1,setback:13,saddleTilt:-2,padReach:55.5,padStack:69.5,padWidth:12,cockpitTilt:12,extension:30,gripWidth:6,gripAngle:20,crank:16.5,cleat:7,footAngle:-8,hipLimit:40};
export const FIT_LIMITS={saddle:[70.8,83.8],setback:[7,19],saddleTilt:[-8,5],padReach:[47,63],padStack:[68,81],padWidth:[8.4,20],cockpitTilt:[0,25],extension:[24,37],gripWidth:[4,12],gripAngle:[0,45],crank:[15.5,17.5],cleat:[4,10],footAngle:[-20,5]};
const rad=x=>x*Math.PI/180,dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const angle3=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,i)=>s+v*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)))))*180/Math.PI;
export function joint(a,b,l1,l2,side=1){const d=dist(a,b);if(!Number.isFinite(l1+l2)||d>=l1+l2||d<=Math.abs(l1-l2)||d===0)return null;const t=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-t*t)),dx=(b[0]-a[0])/d,dy=(b[1]-a[1])/d;return [a[0]+dx*t-side*dy*h,a[1]+dy*t+side*dx*h];}
export function pose(f,phase=-12*Math.PI/180){
 const vertical=Math.sqrt((f.saddle/100)**2-(f.setback/100)**2);if(!Number.isFinite(vertical))return null;
 const seat=[-f.setback/100,.2645+vertical],hip=[seat[0]+.03,seat[1]+.055];
 const a=rad(f.cockpitTilt),dir=[Math.cos(a),Math.sin(a)],normal=[-dir[1],dir[0]],pad=[f.padReach/100,.2645+f.padStack/100],elbowZ=f.padWidth/200,wristZ=f.gripWidth/200;
 const grip=[pad[0]+dir[0]*f.extension/100+normal[0]*.012,pad[1]+dir[1]*f.extension/100+normal[1]*.012];
 const wrist=[grip[0]-dir[0]*.045+normal[0]*.02,grip[1]-dir[1]*.045+normal[1]*.02];
 const lower=Math.sqrt((f.forearm/100)**2-(elbowZ-wristZ)**2);if(!Number.isFinite(lower))return null;
 const elbow=[wrist[0]-dir[0]*lower,wrist[1]-dir[1]*lower];
 const padOffset=(elbow[0]-pad[0])*dir[0]+(elbow[1]-pad[1])*dir[1];
 if(Math.abs(padOffset)>.061)return null; // 142 mm pad minus a support margin
 const upper=Math.sqrt((f.upperArm/100)**2-(f.shoulders/200-elbowZ)**2);
 const shoulder=joint(hip,elbow,f.torso/100,upper,1);if(!shoulder)return null;
 const back=Math.atan2(shoulder[1]-hip[1],shoulder[0]-hip[0])*180/Math.PI;
 const neck=[shoulder[0]+.065,shoulder[1]+.010],head=[neck[0]+.080,neck[1]+.035];
 const legs=[];const hipZ=f.hipWidth/200,ankleZ=.095,kneeZ=(hipZ+ankleZ)/2,fa=rad(f.footAngle),footDir=[Math.cos(fa),Math.sin(fa)],footN=[-footDir[1],footDir[0]];
 for(let i=0;i<2;i++){const t=phase+i*Math.PI,pedal=[f.crank/100*Math.cos(t),.2645+f.crank/100*Math.sin(t)];
 const ankle=[pedal[0]-footDir[0]*f.cleat/100+footN[0]*.07,pedal[1]-footDir[1]*f.cleat/100+footN[1]*.07];
 const thigh=Math.sqrt((f.thigh/100)**2-(hipZ-kneeZ)**2),shin=Math.sqrt((f.shin/100)**2-(ankleZ-kneeZ)**2),knee=joint(hip,ankle,thigh,shin,1);if(!knee)return null;
 const angle=angle3([hip[0]-knee[0],hip[1]-knee[1],hipZ-kneeZ],[ankle[0]-knee[0],ankle[1]-knee[1],ankleZ-kneeZ]);
 legs.push({pedal,ankle,knee,angle,flex:180-angle,hipAngle:angle3([shoulder[0]-hip[0],shoulder[1]-hip[1],0],[knee[0]-hip[0],knee[1]-hip[1],kneeZ-hipZ])});}
 const elbowAngle=angle3([shoulder[0]-elbow[0],shoulder[1]-elbow[1],f.shoulders/200-elbowZ],[wrist[0]-elbow[0],wrist[1]-elbow[1],wristZ-elbowZ]);
 return {seat,hip,pad,grip,elbow,wrist,shoulder,neck,head,legs,back,padOffset,elbowAngle,dir,normal,footDir,footN,hipZ,kneeZ,ankleZ,elbowZ,wristZ};
}
export function assess(f){let minK=180,maxK=0,minHip=180;
 for(let i=0;i<36;i++){const p=pose(f,i*Math.PI/18);if(!p)return {valid:false,reachable:false,reason:'Contact reach is impossible, or the elbow falls outside the pad. Adjust extension reach, body measurements or saddle.'};for(const l of p.legs){minK=Math.min(minK,l.angle);maxK=Math.max(maxK,l.angle);minHip=Math.min(minHip,l.hipAngle);}}
 const p=pose(f),bdc=pose(f,-Math.PI/2).legs[0].flex,hardware=Object.entries(FIT_LIMITS).every(([k,[a,b]])=>f[k]>=a&&f[k]<=b);
 const kneeInRange=bdc>=25&&bdc<=35,hipInRange=minHip>=f.hipLimit;
 return {valid:hardware&&kneeInRange&&hipInRange&&p.back>=5&&p.back<=45,reachable:true,hardware,kneeInRange,hipInRange,kneeBDC:bdc,minK,maxK,minHip,back:p.back,elbow:p.elbowAngle,reason:'Static knee-flexion reference: 25–35° at bottom dead centre. Hip opening limit is user-selected. Most cockpit ranges are bounded previews, not verified factory travel.'};
}
export function frontalArea(f,phase=0){const p=pose(f,phase);if(!p)return null;const shapes=[],circle=(z,y,rz,ry)=>shapes.push({z,y,rz,ry});
 const capsule=(a,b,r)=>{for(let i=0;i<=10;i++)circle(a[0]+(b[0]-a[0])*i/10,a[1]+(b[1]-a[1])*i/10,r,r);};
 const width=f.shoulders/200;circle(0,(p.hip[1]+p.shoulder[1])/2,width*.84,Math.abs(p.shoulder[1]-p.hip[1])/2+.10);circle(0,p.hip[1],.13,.10);circle(0,p.head[1],.095,.12);
 for(const [i,s] of [[0,1],[1,-1]]){capsule([s*width,p.shoulder[1]],[s*p.elbowZ,p.elbow[1]],.046);capsule([s*p.elbowZ,p.elbow[1]],[s*p.wristZ,p.wrist[1]],.034);const l=p.legs[i];capsule([s*p.hipZ,p.hip[1]],[s*p.kneeZ,l.knee[1]],.067);capsule([s*p.kneeZ,l.knee[1]],[s*p.ankleZ,l.ankle[1]],.042);circle(s*p.ankleZ,l.pedal[1]+.035,.045,.05);}
 let count=0;const step=.008;for(let z=-.4;z<.4;z+=step)for(let y=.05;y<2;y+=step)if(shapes.some(s=>((z-s.z)/s.rz)**2+((y-s.y)/s.ry)**2<=1))count++;return count*step*step;
}
export function cycleArea(f){const a=[0,Math.PI/2,Math.PI,3*Math.PI/2].map(x=>frontalArea(f,x));return a.every(x=>x!==null)?a.reduce((x,y)=>x+y,0)/4:null;}
export function fitSaddle(f){let best=null;for(let h=70.8;h<=83.8;h+=.1){const c={...f,saddle:+h.toFixed(1)},check=assess(c);if(!check.reachable)continue;const score=Math.abs(check.kneeBDC-30);if(!best||score<best.score)best={fit:c,score,check};}return best;}
export function searchFit(f){let best=null,checked=0,valid=0;
 for(const stack of [-3,0,3])for(const reach of [-2,0,2])for(const angle of [-4,0,4]){const c={...f,padStack:f.padStack+stack,padReach:f.padReach+reach,cockpitTilt:f.cockpitTilt+angle};checked++;const check=assess(c);if(!check.valid)continue;valid++;const area=cycleArea(c);if(area!==null&&(!best||area<best.area))best={fit:c,area,check};}
 return {best,checked,valid};
}
