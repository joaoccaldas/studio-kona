// Ring 2 world streamer: lightweight long-range island detail.
// Complements (does not replace) the Ring 1 500 m TileStreamer.
import * as THREE from 'three';
import { createNaturalMaterials, varyInstanceColors } from './naturalMaterials.js';
import { applyRegionalGrammar, regionalProfileFor } from './regionalGrammar.js';
import { buildRaceCorridorContext } from './raceCorridor.js';
import { buildKonaAirport } from './konaAirport.js';

function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export class WorldZoneStreamer {
  constructor({ scene, W, heightAt, toLocal, coarse = false, base = 'assets/' }) {
    this.scene = scene;
    this.W = W;
    this.heightAt = heightAt;
    this.toLocal = toLocal;
    this.coarse = coarse;
    this.base = base;
    this.root = new THREE.Group();
    this.root.name = 'KONA_WORLD_RING2';
    this.scene.add(this.root);
    this.zones = [];
    this.t = 0;
    this.raceCorridor = null;
    this.regionalGrammarStats = {};
    this.shared = this.makeShared();
  }

  makeShared() {
    const n = createNaturalMaterials();
    const roadGeo = new THREE.BoxGeometry(1, 1, 1);
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const shrubGeo = new THREE.ConeGeometry(1, 1.6, 7);
    const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
    const treeTrunkGeo = new THREE.CylinderGeometry(.22,.36,1,7);
    const treeCrownGeo = new THREE.DodecahedronGeometry(1,1);
    return {
      ...n,
      lavaMat:n.lava, cinderMat:n.cinder, scrubMat:n.dryGrass, pastureMat:n.pasture,
      urbanMat:n.stucco, roofMat:n.darkRoof, asphaltMat:n.asphalt,
      roadGeo, rockGeo, shrubGeo, bldgGeo, treeTrunkGeo, treeCrownGeo
    };
  }

  addTreeInstances(g,specs,crownMat,name='trees'){
    if(!specs.length) return;
    const trunks=new THREE.InstancedMesh(this.shared.treeTrunkGeo,this.shared.wood,specs.length);
    const crowns=new THREE.InstancedMesh(this.shared.treeCrownGeo,crownMat,specs.length);
    trunks.name=name+'_trunks'; crowns.name=name+'_crowns';
    const m=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(), p=new THREE.Vector3();
    specs.forEach((t,i)=>{
      p.set(t.x,t.y+t.trunkH*.5,t.z);
      q.setFromEuler(new THREE.Euler(0,t.rot||0,t.tilt||0));
      s.set(t.trunkR||1,t.trunkH||6,t.trunkR||1);
      m.compose(p,q,s); trunks.setMatrixAt(i,m);

      p.set(t.x+(t.dx||0),t.y+t.trunkH+(t.crownY||2.2),t.z+(t.dz||0));
      q.setFromEuler(new THREE.Euler(0,t.rot||0,0));
      const cs=t.crownScale||[2,1.6,2];
      s.set(cs[0],cs[1],cs[2]);
      m.compose(p,q,s); crowns.setMatrixAt(i,m);
    });
    trunks.instanceMatrix.needsUpdate=true;
    crowns.instanceMatrix.needsUpdate=true;
    varyInstanceColors(crowns,specs.length,crownMat===this.shared.wetForest?0x315d39:0x66814c,.1,hashString(name));
    g.add(trunks,crowns);
  }

  async init() {
    const [cfg, routes] = await Promise.all([
      fetch(this.base + 'island_world_v2.json').then(r => r.json()),
      fetch(this.base + 'routes.json').then(r => r.json())
    ]);
    this.cfg = cfg;
    this.routes = routes;
    this.buildZones();
    this.buildQueenK(routes.bike || []);
    this.raceCorridor = buildRaceCorridorContext({scene:this.scene,W:this.W,toLocal:this.toLocal,heightAt:this.heightAt,shared:this.shared,coarse:this.coarse,route:routes.bike||[]});
  }

  buildZones() {
    for (const z of this.cfg.zones) {
      if (z.id === 'kailua_core') continue; // Ring 0/1 already owns Kailua.
      const [x, y] = this.toLocal(z.lat, z.lon);
      const g = new THREE.Group();
      g.name = 'ring2_' + z.id;
      g.userData.zone = z;
      g.position.copy(this.W(x, y, 0));
      g.visible = false;
      this.root.add(g);
      // Keep the full zone registry immediately available, but defer geometry construction
      // until the camera approaches. This is the main mobile startup optimization.
      const profile=regionalProfileFor(z.id);
      this.regionalGrammarStats[z.id]={profile,accentCount:0,lazy:true};
      const activation = z.lod === 'hero' ? Math.max(22000, z.radius_m * 1.6)
        : z.lod === 'high' ? Math.max(11000, z.radius_m * 1.8)
          : Math.max(8000, z.radius_m * 1.5);
      this.zones.push({ cfg: z, group: g, x, y, activation, built:false, building:false });
    }
  }

  populateZone(g, z, cx, cy) {
    const random = rng(hashString(z.id));
    const hero = z.lod === 'hero';
    const high = z.lod === 'high';
    const rockN = this.coarse ? (hero ? 90 : high ? 55 : 32) : (hero ? 220 : high ? 130 : 75);
    const shrubN = this.coarse ? (hero ? 55 : high ? 75 : 55) : (hero ? 120 : high ? 180 : 110);
    const bldgN = /hawi|hilo|waimea|waikoloa|kawaihae|keauhou|nelha|old_airport/.test(z.id)
      ? (this.coarse ? (high ? 22 : 14) : (high ? 48 : 30)) : 0;

    const rock = new THREE.InstancedMesh(this.shared.rockGeo, this.shared.lavaMat, rockN);
    rock.name = z.id + '_lava_instances';
    const shrubMat = /hawi|hilo|waimea/.test(z.id) ? this.shared.pastureMat : this.shared.scrubMat;
    const shrubs = new THREE.InstancedMesh(this.shared.shrubGeo, shrubMat, shrubN);
    shrubs.name = z.id + '_vegetation_instances';
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();

    for (let i = 0; i < rockN; i++) {
      const a = random() * Math.PI * 2, rr = z.radius_m * (.08 + .78 * Math.sqrt(random()));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (z.id === 'airport' && x > -380 && x < 340 && y > -900 && y < -100) continue;
      const wz = Math.max(0, this.heightAt(cx + x, cy + y));
      const p = this.W(x, y, wz + .35 + random() * 1.1);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2);
      const s = .8 + random() * (hero ? 4.2 : 2.8);
      sc.set(s * (.7 + random()), s * (.45 + random() * .6), s * (.7 + random()));
      m.compose(p, q, sc); rock.setMatrixAt(i, m);
    }
    rock.instanceMatrix.needsUpdate = true;
    varyInstanceColors(rock, rockN, /hilo|waimea|hawi/.test(z.id)?0x4b443c:0x2e2824, .14, hashString(z.id));
    g.add(rock);

    for (let i = 0; i < shrubN; i++) {
      const a = random() * Math.PI * 2, rr = z.radius_m * (.06 + .88 * Math.sqrt(random()));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      const wz = Math.max(0, this.heightAt(cx + x, cy + y));
      pos.copy(this.W(x, y, wz + .4));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2);
      const s = .55 + random() * 2.2;
      sc.set(s, s * (1 + random()), s);
      m.compose(pos, q, sc); shrubs.setMatrixAt(i, m);
    }
    shrubs.instanceMatrix.needsUpdate = true;
    varyInstanceColors(shrubs, shrubN, /hilo/.test(z.id)?0x335d39:(/hawi|waimea/.test(z.id)?0x637c48:0x6f6c3f), .13, hashString(z.id+'veg'));
    g.add(shrubs);

    if (bldgN) {
      const buildings = new THREE.InstancedMesh(this.shared.bldgGeo, this.shared.urbanMat, bldgN);
      buildings.name = z.id + '_massing';
      for (let i = 0; i < bldgN; i++) {
        const a = random() * Math.PI * 2, rr = z.radius_m * (.03 + .42 * Math.sqrt(random()));
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        const wz = Math.max(0, this.heightAt(cx + x, cy + y));
        const sx = 7 + random() * 18, sy = 4 + random() * 10, sz = 8 + random() * 24;
        // world mapping is X=east, Y=up, Z=-north
        pos.copy(this.W(x, y, wz + sy * .5));
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2);
        sc.set(sx, sy, sz);
        m.compose(pos, q, sc); buildings.setMatrixAt(i, m);
      }
      buildings.instanceMatrix.needsUpdate = true;
      varyInstanceColors(buildings,bldgN,/hilo/.test(z.id)?0x9e9a90:(/hawi|waimea/.test(z.id)?0xb4a98f:0xb9b0a0),.08,hashString(z.id+'buildings'));
      g.add(buildings);
    }

    this.regionalGrammarStats[z.id]=applyRegionalGrammar({group:g,z,shared:this.shared,coarse:this.coarse,heightAt:this.heightAt,cx,cy});
    this.addRegionalLandmark(g, z, cx, cy);
    if (z.id === 'kahaluu') this.addKahaluu(g, z, cx, cy);
    if (z.id === 'keauhou') this.addKeauhou(g, z, cx, cy);
    if (z.id === 'south_kona_slope') this.addSouthKonaSlope(g, z, cx, cy);
    if (z.id === 'hawi') this.addHawiTown(g, z, cx, cy);
    if (z.id === 'nelha') this.addNELHA(g, z, cx, cy);
    if (z.id === 'airport') this.addKonaAirport(g, z, cx, cy);
    if (z.id === 'old_airport') this.addOldAirport(g, z, cx, cy);
    if (z.id === 'hilo') this.addHiloCity(g, z, cx, cy);
    if (z.id === 'waikoloa') this.addWaikoloa(g, z, cx, cy);
    if (z.id === 'waimea') this.addWaimea(g, z, cx, cy);
    if (z.id === 'hamakua') this.addHamakua(g, z, cx, cy);
    if (z.id === 'puna') this.addPuna(g, z, cx, cy);
    if (z.id === 'kau') this.addKau(g, z, cx, cy);
    if (z.id === 'kawaihae') this.addKawaihae(g, z, cx, cy);
    if (z.id === 'puuhonua') this.addPuuhonua(g, z, cx, cy);
    if (z.id === 'puukohola') this.addPuukohola(g, z, cx, cy);
    if (z.id === 'kaloko_honokohau') this.addKaloko(g, z, cx, cy);
    if (z.id === 'pololu' || z.id === 'waipio') this.addValley(g, z, cx, cy);

    // Major volcano shape comes from the real whole-island DEM.
    // Add only summit-scale detail here; never duplicate the mountain with a primitive cone.
    if (z.id === 'mauna_kea') this.addMaunaKeaSummit(g, z, cx, cy);
    if (z.id === 'kilauea') this.addKilaueaSummit(g, z, cx, cy);

    if (z.id === 'old_airport') {
      const runway = new THREE.Mesh(this.shared.roadGeo, this.shared.asphaltMat);
      runway.name = z.id + '_runway_proxy';
      const length = 1100;
      runway.scale.set(34, .18, length);
      runway.position.y = Math.max(1, this.heightAt(cx, cy)) + .18;
      g.add(runway);
    }
  }

  addKeauhou(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const asphalt=this.shared.asphalt;
    const stucco=this.shared.stucco;
    const roof=this.shared.darkRoof;
    const lava=this.shared.lava;
    const green=this.shared.pasture;
    const water=new THREE.MeshPhysicalMaterial({color:0x377787,roughness:.18,transparent:true,opacity:.78});

    // Keauhou Bay itself.
    const bay=new THREE.Mesh(new THREE.CircleGeometry(520,56),water);
    bay.rotation.x=-Math.PI/2; bay.scale.set(1.45,1,.78);
    bay.position.set(0,base+.18,-120); bay.name='keauhou_bay_proxy';
    bay.userData.evidence='P bay identity / I simplified shoreline';
    g.add(bay);

    // Ali'i Drive / local access road relationship.
    const road=new THREE.Mesh(new THREE.BoxGeometry(1100,.2,9.5),asphalt);
    road.position.set(0,base+.2,340); road.rotation.y=.11;
    road.name='keauhou_alii_corridor'; g.add(road);

    // Low resort / neighborhood massing set back from coast.
    const blocks=[
      [-360,470,58,28,8],[-240,520,46,24,7],[-110,455,66,30,9],
      [60,500,54,26,8],[210,440,72,32,9],[360,500,48,24,7],
      [-280,650,42,22,6],[0,640,60,28,8],[280,650,44,22,6]
    ];
    blocks.forEach((b,i)=>{
      const [x,zp,w,d,h]=b;
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),stucco);
      body.position.set(x,base+h*.5,zp);
      body.userData.evidence='procedural Keauhou massing pending measured footprint replacement';
      g.add(body);
      const r=new THREE.Mesh(new THREE.CylinderGeometry(Math.max(w,d)*.54,Math.max(w,d)*.62,1.9,4),roof);
      r.rotation.y=Math.PI/4+.08; r.scale.z=.62; r.position.set(x,base+h+.9,zp); g.add(r);
    });

    // Lava headlands and pocket greenery.
    for(let i=0;i<18;i++){
      const a=i*2.03, rr=300+(i%5)*90;
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),lava);
      rock.scale.set(14+(i%4)*6,4+(i%3)*2,11+(i%5)*5);
      rock.position.set(Math.cos(a)*rr,base+4,-40+Math.sin(a)*rr*.6); g.add(rock);
    }

    const trees=this.coarse?14:30;
    for(let i=0;i<trees;i++){
      const a=i*2.399, rr=220+(i%6)*55;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.34,6.5,7),this.shared.wood);
      trunk.position.set(Math.cos(a)*rr,base+3.25,420+Math.sin(a)*rr*.55); g.add(trunk);
      const crown=new THREE.Mesh(new THREE.DodecahedronGeometry(1.45,1),green);
      crown.scale.set(2.0,1.6,1.9); crown.position.copy(trunk.position); crown.position.y+=4.8; g.add(crown);
    }
  }

  addKahaluu(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const water=new THREE.MeshPhysicalMaterial({color:0x3f8390,roughness:.2,transparent:true,opacity:.76});
    const sand=this.shared.drySoil;
    const lava=this.shared.lava;
    const stucco=this.shared.stucco;
    const roof=this.shared.darkRoof;

    const bay=new THREE.Mesh(new THREE.CircleGeometry(420,48),water);
    bay.rotation.x=-Math.PI/2; bay.scale.set(1.45,1,.72); bay.position.set(0,base+.18,-120);
    bay.name='kahaluu_bay_proxy'; bay.userData.evidence='P bay identity / I simplified shoreline';
    g.add(bay);

    const beach=new THREE.Mesh(new THREE.CircleGeometry(260,36),sand);
    beach.rotation.x=-Math.PI/2; beach.scale.set(1.3,1,.34); beach.position.set(40,base+.24,80);
    g.add(beach);

    for(let i=0;i<10;i++){
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),lava);
      rock.scale.set(18+(i%3)*8,5+(i%2)*2,14+(i%4)*6);
      rock.position.set(-360+i*78,base+3,-10+(i%2)*22); g.add(rock);
    }

    const houses=this.coarse?8:15;
    for(let i=0;i<houses;i++){
      const x=-430+(i%5)*205, zp=300+Math.floor(i/5)*120;
      const w=30+(i%3)*8, d=22+(i%2)*7, h=5.5+(i%3)*1.2;
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),stucco);
      body.position.set(x,base+h*.5,zp); body.userData.evidence='procedural neighborhood massing';
      g.add(body);
      const r=new THREE.Mesh(new THREE.CylinderGeometry(Math.max(w,d)*.52,Math.max(w,d)*.6,1.7,4),roof);
      r.rotation.y=Math.PI/4; r.scale.z=.62; r.position.set(x,base+h+.8,zp); g.add(r);
    }
  }

  addSouthKonaSlope(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const soil=this.shared.drySoil;
    const green=this.shared.pasture;
    const wood=this.shared.wood;

    // Stepped agricultural bands climbing the volcanic slope.
    for(let row=0;row<7;row++){
      const field=new THREE.Mesh(new THREE.PlaneGeometry(2600,420,1,1),row%2?green:soil);
      field.rotation.x=-Math.PI/2+.05;
      field.position.set(0,base+row*18,-1250+row*430);
      field.rotation.z=(row%3-1)*.015;
      field.userData.evidence='procedural agricultural slope proxy';
      g.add(field);
    }

    // Coffee-tree rows: visually dense, but instanced for mobile efficiency.
    const count=this.coarse?60:130;
    const coffeeTrees=[];
    for(let i=0;i<count;i++){
      const col=i%26, row=Math.floor(i/26);
      const x=-1250+col*100+(row%2)*20;
      const zp=-1000+row*430+(col%2)*10;
      coffeeTrees.push({x,y:base+row*18,z:zp,trunkH:2.1,trunkR:.55,crownY:.75,crownScale:[1.5,1.1,1.4],rot:(i%5)*.2});
    }
    this.addTreeInstances(g,coffeeTrees,green,'south_kona_coffee');
  }

  addRegionalLandmark(g,z,cx,cy){
    if(z.id==='punaluu'||z.id==='hapuna') this.addBeach(g,z,cx,cy,z.id==='punaluu');
    if(z.id==='south_point') this.addSouthPoint(g,z,cx,cy);
    if(z.id==='akaka') this.addWetGorge(g,z,cx,cy);
    if(z.id==='kealakekua') this.addKealakekua(g,z,cx,cy);
    if(z.id==='hilo_bay') this.addHiloBay(g,z,cx,cy);
  }

  addBeach(g,z,cx,cy,black=false){
    const base=Math.max(0,this.heightAt(cx,cy));
    const mat=black?this.shared.lava:this.shared.drySoil;
    const shore=new THREE.Mesh(new THREE.CircleGeometry(900,64),mat);
    shore.rotation.x=-Math.PI/2; shore.scale.set(1.7,1,.42);
    shore.position.set(0,base+.25,0); shore.name=z.id+'_shore_proxy';
    shore.userData.evidence='P place identity / I simplified shoreline'; g.add(shore);
    const headland=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),this.shared.lava);
    headland.scale.set(700,90,380); headland.position.set(850,base+45,120); g.add(headland);
    const count=this.coarse?12:28;
    for(let i=0;i<count;i++){
      const a=i/count*Math.PI*2, rr=430+(i%5)*38;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.25,.38,7,7),this.shared.wood);
      trunk.position.set(Math.cos(a)*rr,base+3.5,Math.sin(a)*rr*.4);
      trunk.rotation.z=(i%3-1)*.05; g.add(trunk);
      const crown=new THREE.Mesh(new THREE.ConeGeometry(3.8,5.5,7),this.shared.pasture);
      crown.position.copy(trunk.position); crown.position.y+=5.7; g.add(crown);
    }
  }

  addSouthPoint(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const cliff=this.shared.cliff;
    for(let i=0;i<7;i++){
      const p=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),cliff);
      p.scale.set(420+80*(i%2),55+18*(i%3),260+60*((i+1)%3));
      p.position.set(-900+i*300,base+30+8*(i%2),(i%2?120:-90));
      p.userData.evidence='P coastal cliff context / I silhouette'; g.add(p);
    }
    const grass=new THREE.Mesh(new THREE.PlaneGeometry(2600,1400,6,4),this.shared.dryGrass);
    grass.rotation.x=-Math.PI/2; grass.position.y=base+5; g.add(grass);
  }

  addWetGorge(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    for(const side of [-1,1]){
      const wall=new THREE.Mesh(new THREE.CylinderGeometry(520,700,620,14,4),this.shared.cliff);
      wall.scale.z=.55; wall.position.set(side*620,base+290,0); wall.rotation.z=side*.12;
      wall.userData.evidence='P wet gorge / I simplified form'; g.add(wall);
    }
    const waterMat=new THREE.MeshPhysicalMaterial({color:0x8fc5dc,roughness:.15,metalness:0,transparent:true,opacity:.82});
    const fall=new THREE.Mesh(new THREE.PlaneGeometry(34,430,1,8),waterMat);
    fall.position.set(0,base+310,-60); g.add(fall);
    const pool=new THREE.Mesh(new THREE.CircleGeometry(170,40),waterMat);
    pool.rotation.x=-Math.PI/2; pool.position.set(0,base+4,-60); g.add(pool);
  }

  addKealakekua(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    for(let i=0;i<5;i++){
      const ridge=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),this.shared.cliff);
      ridge.scale.set(480,170+i*18,330); ridge.position.set(-900+i*390,base+120+i*18,220+i*45);
      ridge.userData.evidence='P bay cliffs / I silhouette'; g.add(ridge);
    }
    const slope=new THREE.Mesh(new THREE.PlaneGeometry(2600,1900,10,8),this.shared.pasture);
    slope.rotation.x=-Math.PI/2+.12; slope.position.set(0,base+120,900); g.add(slope);
  }

  addHiloBay(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const bay=new THREE.Mesh(new THREE.CircleGeometry(1500,64),new THREE.MeshPhysicalMaterial({color:0x2d6b77,roughness:.28,transparent:true,opacity:.74}));
    bay.rotation.x=-Math.PI/2; bay.scale.set(1.35,1,.75); bay.position.set(0,Math.max(.2,base+.15),0); g.add(bay);
    const pierMat=this.shared.concrete;
    for(let i=0;i<3;i++){
      const pier=new THREE.Mesh(new THREE.BoxGeometry(280,4,28),pierMat);
      pier.position.set(-250+i*260,base+2,-720+i*80); pier.rotation.y=.15; g.add(pier);
    }
  }

  addMaunaKeaSummit(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    // Small cinder-cone cluster only. Real mountain form remains DEM-driven.
    for(let i=0;i<9;i++){
      const a=i*2.399, rr=260+(i%4)*170;
      const h=45+(i%5)*18, r=70+(i%3)*25;
      const cone=new THREE.Mesh(new THREE.ConeGeometry(r,h,18,4),this.shared.cinder);
      cone.position.set(Math.cos(a)*rr,base+h*.5,Math.sin(a)*rr);
      cone.rotation.y=a*.3;
      cone.userData.evidence='summit-scale cinder proxy on DEM';
      g.add(cone);
    }
    // Observatory silhouettes, intentionally minimal at current LOD.
    for(let i=0;i<5;i++){
      const dome=new THREE.Mesh(new THREE.SphereGeometry(12+(i%2)*3,18,10,0,Math.PI*2,0,Math.PI/2),this.shared.concrete);
      dome.position.set(-130+i*65,base+12,120+(i%2)*35);
      g.add(dome);
      const baseBox=new THREE.Mesh(new THREE.BoxGeometry(24,9,24),this.shared.concrete);
      baseBox.position.set(dome.position.x,base+4.5,dome.position.z);
      g.add(baseBox);
    }
  }

  addKilaueaSummit(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    // Caldera rim cue only; actual elevation/depression comes from DEM.
    const rim=new THREE.Mesh(new THREE.TorusGeometry(560,18,10,72),this.shared.cinder);
    rim.rotation.x=Math.PI/2;
    rim.scale.set(1.35,.86,1);
    rim.position.y=base+8;
    rim.userData.evidence='caldera rim cue / DEM remains authoritative';
    g.add(rim);
  }

  addPuna(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const wet=this.shared.wetForest;
    const aa=this.shared.aaLava;
    const lava=this.shared.lava;
    const asphalt=this.shared.asphalt;

    // Young lava sheets interleaved with wet forest islands.
    for(let i=0;i<10;i++){
      const patch=new THREE.Mesh(new THREE.CircleGeometry(520+(i%4)*130,40),i%2?aa:lava);
      patch.rotation.x=-Math.PI/2;
      patch.scale.set(1.5,1,.55+(i%3)*.08);
      patch.position.set(-1700+i*360,base+.2,-300+(i%4)*380);
      patch.rotation.z=(i%5)*.17;
      patch.userData.evidence='young-lava landscape proxy on DEM';
      g.add(patch);
    }

    // Rainforest survives in islands between flows, rendered as two draw calls.
    const treeCount=this.coarse?55:120;
    const punaTrees=[];
    for(let i=0;i<treeCount;i++){
      const x=-2100+(i%24)*185+(i%3)*17;
      const zp=-1450+Math.floor(i/24)*620+(i%7)*35;
      const flowGap=((i*37)%11)<4;
      if(flowGap) continue;
      punaTrees.push({x,y:base,z:zp,trunkH:7.5,trunkR:1.05,crownScale:[2.1,2.8,2.0],rot:i*.37});
    }
    this.addTreeInstances(g,punaTrees,wet,'puna_forest');

    // Puna road cue cutting across the lava/forest mosaic.
    const road=new THREE.Mesh(new THREE.BoxGeometry(3600,.2,9.5),asphalt);
    road.position.set(0,base+.22,180); road.rotation.y=.035;
    road.name='puna_road_proxy'; road.userData.evidence='context road / I dimensions';
    g.add(road);
  }

  addKau(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const lava=this.shared.lava;
    const aa=this.shared.aaLava;
    const dry=this.shared.dryGrass;
    const cinder=this.shared.cinder;

    // Broad lava tongues descending Mauna Loa toward the coast.
    for(let i=0;i<8;i++){
      const tongue=new THREE.Mesh(new THREE.PlaneGeometry(520,2200,1,1),i%2?aa:lava);
      tongue.rotation.x=-Math.PI/2;
      tongue.rotation.z=(-.22+i*.065);
      tongue.position.set(-1500+i*430,base+.24,-200+(i%3)*260);
      tongue.scale.x=.75+(i%3)*.16;
      tongue.userData.evidence='procedural lava-flow cue on DEM';
      g.add(tongue);
    }

    // Dry grass shelves between flows.
    for(let i=0;i<7;i++){
      const field=new THREE.Mesh(new THREE.CircleGeometry(420+(i%3)*90,28),dry);
      field.rotation.x=-Math.PI/2;
      field.scale.set(1.6,1,.7);
      field.position.set(-1450+i*470,base+.28,850+(i%2)*220);
      g.add(field);
    }

    // Small cinder cones, never replacing the DEM mountain mass.
    for(let i=0;i<6;i++){
      const h=55+(i%3)*22, r=95+(i%2)*25;
      const cone=new THREE.Mesh(new THREE.ConeGeometry(r,h,18,4),cinder);
      cone.position.set(-1100+i*430,base+h*.5,-1050+(i%2)*250);
      cone.rotation.y=i*.41;
      cone.userData.evidence='minor cinder cone proxy on DEM';
      g.add(cone);
    }
  }

  addWaimea(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const pasture=this.shared.pasture;
    const wood=this.shared.wood;
    const roof=this.shared.darkRoof;
    const stucco=this.shared.stucco;
    const asphalt=this.shared.asphalt;

    // Main town road and quieter cross streets.
    const road=new THREE.Mesh(new THREE.BoxGeometry(880,.22,11),asphalt);
    road.position.set(0,base+.2,0); road.rotation.y=-.06;
    road.name='waimea_main_road_proxy'; road.userData.evidence='P town corridor / I dimensions';
    g.add(road);

    for(let j=-1;j<=1;j++){
      const cross=new THREE.Mesh(new THREE.BoxGeometry(8,.18,420),asphalt);
      cross.position.set(j*210,base+.18,80); cross.rotation.y=.03;
      g.add(cross);
    }

    // Low town fabric: broad roofs and modest heights.
    const blocks=[];
    for(let i=-5;i<=5;i++){
      const x=i*66+(i%2?8:-6), zp=(i%2?58:-62);
      const w=32+(i+7)%4*9, d=22+(i+5)%3*7, h=5.5+((i+10)%3)*1.5;
      blocks.push([x,zp,w,d,h]);
    }
    blocks.forEach((b,i)=>{
      const [x,zp,w,d,h]=b;
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),i%4===0?wood:stucco);
      body.position.set(x,base+h*.5,zp); body.rotation.y=-.06;
      body.userData.evidence='procedural Waimea town massing pending measured footprint replacement';
      g.add(body);
      const rg=new THREE.CylinderGeometry(Math.max(w,d)*.55,Math.max(w,d)*.63,1.8,4);
      const r=new THREE.Mesh(rg,roof); r.rotation.y=Math.PI/4-.06; r.scale.z=.64;
      r.position.set(x,base+h+.85,zp); g.add(r);
    });

    // Pasture paddocks with fence lines, visually characteristic of Waimea.
    for(let p=0;p<6;p++){
      const px=-520+(p%3)*520, pz=260+Math.floor(p/3)*420;
      const field=new THREE.Mesh(new THREE.PlaneGeometry(420,280,1,1),pasture);
      field.rotation.x=-Math.PI/2; field.position.set(px,base+.25,pz);
      g.add(field);
      const fenceMat=this.shared.wood;
      for(const side of [-1,1]){
        const rail=new THREE.Mesh(new THREE.BoxGeometry(420,.18,.18),fenceMat);
        rail.position.set(px,base+1.05,pz+side*140); g.add(rail);
      }
      for(let k=-2;k<=2;k++){
        const rail=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,280),fenceMat);
        rail.position.set(px+k*105,base+1.05,pz); g.add(rail);
      }
    }

    // Windbreak rows, instanced to keep draw calls low.
    const count=this.coarse?24:52;
    const windbreak=[];
    for(let i=0;i<count;i++){
      const x=-650+(i%26)*52, zp=520+Math.floor(i/26)*90;
      windbreak.push({x,y:base,z:zp,trunkH:7,trunkR:1.05,crownY:1.5,crownScale:[1.8,2.8,1.6],rot:i*.11});
    }
    this.addTreeInstances(g,windbreak,pasture,'waimea_windbreak');
  }

  addHamakua(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const wet=this.shared.wetForest;
    const cliff=this.shared.cliff;
    const pasture=this.shared.pasture;
    const waterMat=new THREE.MeshPhysicalMaterial({color:0x6aa8b8,roughness:.22,transparent:true,opacity:.82});

    // Repeating but irregular gulches running toward the ocean.
    const gulches=this.coarse?5:9;
    for(let i=0;i<gulches;i++){
      const x=-1800+i*(3600/(gulches-1));
      const depth=260+(i%4)*70, width=130+(i%3)*45, len=1200+(i%5)*180;
      for(const side of [-1,1]){
        const wall=new THREE.Mesh(new THREE.BoxGeometry(width,depth,len),cliff);
        wall.position.set(x+side*width*.62,base+depth*.35,-150+i*45);
        wall.rotation.z=side*.12; wall.rotation.y=.04*(i%3-1);
        wall.userData.evidence='procedural gulch silhouette on DEM';
        g.add(wall);
      }
      const stream=new THREE.Mesh(new THREE.PlaneGeometry(width*.7,len*.8),waterMat);
      stream.rotation.x=-Math.PI/2; stream.position.set(x,base+1,-150+i*45); g.add(stream);
    }

    // Wet pasture shelves between gulches.
    for(let i=0;i<7;i++){
      const field=new THREE.Mesh(new THREE.PlaneGeometry(460,320,1,1),i%2?pasture:wet);
      field.rotation.x=-Math.PI/2;
      field.position.set(-1500+i*500,base+.35,620+(i%2)*240);
      field.rotation.z=(i%3-1)*.02;
      g.add(field);
    }

    // Dense tree belts near gulch edges, instanced into two meshes.
    const count=this.coarse?45:95;
    const hamakuaTrees=[];
    for(let i=0;i<count;i++){
      const x=-1900+(i%19)*210+(i%3)*21;
      const zp=-900+Math.floor(i/19)*420+(i%5)*24;
      hamakuaTrees.push({x,y:base,z:zp,trunkH:8,trunkR:1.15,crownScale:[2.1,2.6,2.0],rot:i*.23});
    }
    this.addTreeInstances(g,hamakuaTrees,wet,'hamakua_tree_belts');
  }

  addWaikoloa(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const lava=this.shared.lava;
    const dry=this.shared.dryGrass;
    const stucco=this.shared.stucco;
    const roof=this.shared.darkRoof;
    const asphalt=this.shared.asphalt;

    // Resort-road spine and lava-field islands.
    const road=new THREE.Mesh(new THREE.BoxGeometry(920,.22,12),asphalt);
    road.position.set(0,base+.18,20); road.rotation.y=.16;
    road.name='waikoloa_resort_road_proxy'; road.userData.evidence='P corridor context / I dimensions';
    g.add(road);

    for(let i=0;i<16;i++){
      const a=(i*2.17)%6.283, rr=180+(i%6)*95;
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),lava);
      rock.scale.set(26+(i%4)*11,6+(i%3)*3,18+(i%5)*8);
      rock.position.set(Math.cos(a)*rr,base+4,Math.sin(a)*rr*.7);
      g.add(rock);
    }

    // Low, broad resort massing with courtyards instead of towers.
    const blocks=[
      [-250,-120,100,34,10],[-110,-150,92,30,9],[45,-135,105,36,11],
      [190,-105,88,32,9],[-190,145,82,28,8],[-40,155,94,30,9],[120,150,108,34,10]
    ];
    blocks.forEach((b,i)=>{
      const [x,zp,w,d,h]=b;
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),stucco);
      body.position.set(x,base+h*.5,zp); body.rotation.y=.08;
      body.userData.evidence='procedural resort massing pending measured footprints';
      g.add(body);
      const r=new THREE.Mesh(new THREE.BoxGeometry(w*1.02,.5,d*1.02),roof);
      r.position.set(x,base+h+.3,zp); r.rotation.y=.08; g.add(r);
    });

    // Golf / irrigated green ribbons constrained to near resort massing.
    for(let i=0;i<5;i++){
      const green=new THREE.Mesh(new THREE.CircleGeometry(90+i*8,32),dry);
      green.rotation.x=-Math.PI/2; green.scale.set(1.7,1,.55);
      green.position.set(-250+i*125,base+.3,290+(i%2)*80);
      g.add(green);
    }
  }

  addKawaihae(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const concrete=this.shared.concrete;
    const asphalt=this.shared.asphalt;
    const metal=this.shared.metal;
    const lava=this.shared.lava;

    // Harbor basin edge and industrial apron.
    const apron=new THREE.Mesh(new THREE.BoxGeometry(760,.3,260),asphalt);
    apron.position.set(0,base+.16,80); apron.rotation.y=-.08;
    apron.name='kawaihae_harbor_apron_proxy'; g.add(apron);

    for(let i=0;i<4;i++){
      const pier=new THREE.Mesh(new THREE.BoxGeometry(220,3,24),concrete);
      pier.position.set(-260+i*175,base+1.5,-130-i*22); pier.rotation.y=-.05;
      g.add(pier);
    }
    for(let i=0;i<9;i++){
      const w=38+(i%3)*18, d=28+(i%4)*10, h=8+(i%2)*3;
      const shed=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),metal);
      shed.position.set(-290+(i%5)*145,base+h*.5,120+Math.floor(i/5)*90);
      shed.userData.evidence='procedural harbor massing pending measured footprint replacement';
      g.add(shed);
    }

    // Dry basalt breakwater gives Kawaihae its strong coastal silhouette.
    for(let i=0;i<18;i++){
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),lava);
      rock.scale.set(14+(i%4)*5,8+(i%3)*3,12+(i%5)*4);
      rock.position.set(-390+i*46,base+5,-240+(i%2)*5);
      rock.rotation.y=i*.31;
      g.add(rock);
    }
  }

  addHiloCity(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const stucco=this.shared.stucco;
    const roof=this.shared.darkRoof;
    const concrete=this.shared.concrete;
    const wet=this.shared.wetForest;
    const asphalt=this.shared.asphalt;

    // Bayfront road / urban edge, simplified from the real shoreline-city relationship.
    const road=new THREE.Mesh(new THREE.BoxGeometry(780,.22,11),asphalt);
    road.position.set(0,base+.18,40); road.rotation.y=.08;
    road.name='hilo_bayfront_road_proxy'; road.userData.evidence='P urban bayfront relation / I dimensions';
    g.add(road);

    const blocks=[];
    for(let row=0;row<3;row++){
      for(let i=-5;i<=5;i++){
        const x=i*58+(row%2?20:0), zp=95+row*52+(i%3)*4;
        const w=28+(i+7)%4*7, d=24+(i+3)%5*4, h=7+((i+row+20)%4)*2.2;
        blocks.push([x,zp,w,d,h]);
      }
    }
    blocks.forEach((b,i)=>{
      const [x,zp,w,d,h]=b;
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),i%5===0?concrete:stucco);
      body.position.set(x,base+h*.5,zp); body.rotation.y=.08;
      body.name='hilo_urban_block_'+i; body.userData.evidence='procedural urban massing pending OSM footprint replacement';
      g.add(body);
      const r=new THREE.Mesh(new THREE.BoxGeometry(w*1.02,.5,d*1.02),roof);
      r.position.set(x,base+h+.28,zp); r.rotation.y=.08; g.add(r);
    });

    // Banyan-drive / tropical canopy cue. Broad irregular crowns, not cones.
    const treeCount=this.coarse?18:38;
    for(let i=0;i<treeCount;i++){
      const x=-430+(i%19)*48, zp=-40+Math.floor(i/19)*34;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.35,.55,7.5,8),this.shared.wood);
      trunk.position.set(x,base+3.75,zp); g.add(trunk);
      const crown=new THREE.Mesh(new THREE.DodecahedronGeometry(1.8,1),wet);
      crown.scale.set(2.7,1.7,2.5); crown.position.set(x+(i%2?1.4:-.9),base+9,zp);
      g.add(crown);
    }

    // Harbor breakwater / piers for silhouette.
    for(let i=0;i<3;i++){
      const pier=new THREE.Mesh(new THREE.BoxGeometry(180,2.2,18),concrete);
      pier.position.set(-180+i*190,base+1.2,-260-i*24); pier.rotation.y=.12; g.add(pier);
    }
  }

  addNELHA(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const asphalt=this.shared.asphalt;
    const concrete=this.shared.concrete;
    const metal=this.shared.metal;
    const lava=this.shared.lava;
    const dry=this.shared.dryGrass;

    // Energy Lab road entering the campus through open lava fields.
    const access=new THREE.Mesh(new THREE.BoxGeometry(1500,.22,10),asphalt);
    access.position.set(0,base+.18,120); access.rotation.y=.025;
    access.name='nelha_energy_lab_road';
    access.userData.evidence='P corridor identity / I dimensions';
    g.add(access);

    // Low research / industrial campus, arranged in separated pads rather than one block.
    const campus=[
      [-420,-140,68,34,9],[-260,-80,54,30,8],[-80,-135,72,36,10],
      [120,-70,58,30,8],[300,-135,82,38,10],[430,-40,48,28,7],
      [-320,90,46,26,7],[-110,70,60,32,8],[120,100,52,30,8],[340,85,70,34,9]
    ];
    campus.forEach((b,i)=>{
      const [x,zp,w,d,h]=b;
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),i%3===0?metal:concrete);
      body.position.set(x,base+h*.5,zp);
      body.userData.evidence='procedural HOST campus massing pending measured footprints';
      g.add(body);

      const roof=new THREE.Mesh(new THREE.BoxGeometry(w*1.03,.45,d*1.03),i%3===0?metal:this.shared.darkRoof);
      roof.position.set(x,base+h+.24,zp); g.add(roof);

      if(i%2===0){
        const tank=new THREE.Mesh(new THREE.CylinderGeometry(6,6,9,18),metal);
        tank.position.set(x+w*.42,base+4.5,zp-d*.36); g.add(tank);
      }
    });

    // Seawater pipeline cues running toward the coast.
    for(const x of [-42,0,42]){
      const pipe=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,1050,14),metal);
      pipe.rotation.x=Math.PI/2;
      pipe.position.set(x,base+1.4,-720);
      pipe.name='nelha_seawater_pipeline_proxy';
      pipe.userData.evidence='P pipeline-system presence / I simplified alignment';
      g.add(pipe);
    }

    // Solar / utility field using instancing for mobile efficiency.
    const panelMat=new THREE.MeshStandardMaterial({color:0x263b48,roughness:.42,metalness:.18});
    const panelGeo=new THREE.BoxGeometry(4,.18,2.2);
    const rows=this.coarse?28:56;
    const panels=new THREE.InstancedMesh(panelGeo,panelMat,rows);
    const m=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(1,1,1);
    for(let i=0;i<rows;i++){
      const col=i%14, row=Math.floor(i/14);
      const p=this.W(-430+col*64, 420+row*48, base+.9);
      q.setFromEuler(new THREE.Euler(-.25,0,.05));
      m.compose(p,q,s); panels.setMatrixAt(i,m);
    }
    panels.instanceMatrix.needsUpdate=true; g.add(panels);

    // Keep surrounding lava dominant.
    for(let i=0;i<(this.coarse?24:52);i++){
      const a=i*2.17, rr=420+(i%8)*110;
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),lava);
      rock.scale.set(8+(i%5)*5,3+(i%3)*1.6,7+(i%4)*4);
      rock.position.set(Math.cos(a)*rr,base+3,Math.sin(a)*rr*.6);
      g.add(rock);
    }
  }

  addKonaAirport(g,z,cx,cy){
    buildKonaAirport({ group: g, z, cx, cy, shared: this.shared, coarse: this.coarse, heightAt: this.heightAt });
  }

  addOldAirport(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const asphalt=this.shared.asphalt;
    const green=this.shared.pasture;
    const lava=this.shared.lava;

    // Old runway remains recognizable, but softened by park use and coastal vegetation.
    const runway=new THREE.Mesh(new THREE.BoxGeometry(34,.18,1120),asphalt);
    runway.position.set(0,base+.2,0); runway.name='old_airport_runway';
    g.add(runway);

    const park=new THREE.Mesh(new THREE.PlaneGeometry(520,760,1,1),green);
    park.rotation.x=-Math.PI/2; park.position.set(260,base+.25,40); g.add(park);

    const count=this.coarse?18:36;
    for(let i=0;i<count;i++){
      const a=i*2.399, rr=180+(i%7)*55;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.34,6.5,7),this.shared.wood);
      trunk.position.set(260+Math.cos(a)*rr,base+3.25,Math.sin(a)*rr*.7); g.add(trunk);
      const crown=new THREE.Mesh(new THREE.DodecahedronGeometry(1.5,1),green);
      crown.scale.set(2.2,1.6,2.0); crown.position.copy(trunk.position); crown.position.y+=5;
      g.add(crown);
    }

    for(let i=0;i<14;i++){
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),lava);
      rock.scale.set(9+(i%4)*4,3+(i%2)*1.4,7+(i%5)*3);
      rock.position.set(-180+(i%7)*58,base+3,-480+Math.floor(i/7)*940);
      g.add(rock);
    }
  }

  addHawiTown(g,z,cx,cy){
    const base=Math.max(0,this.heightAt(cx,cy));
    const asphalt=this.shared.asphalt;
    const stucco=this.shared.stucco;
    const roof=this.shared.darkRoof;
    const wood=this.shared.wood;
    const green=this.shared.pasture;

    // Akoni Pule Highway proxy spine through town.
    const road=new THREE.Mesh(new THREE.BoxGeometry(520,0.25,10),asphalt);
    road.position.set(0,base+.22,0); road.rotation.y=-.12;
    road.name='hawi_main_street_proxy';
    road.userData.evidence='P town street orientation / I local dimensions';
    g.add(road);

    // Low-rise storefront rhythm with restrained variation.
    const stores=[
      [-180,-18,36,15,6],[-120,18,28,14,5.5],[-68,-17,30,16,6],
      [-12,17,34,14,5.8],[52,-16,38,16,6.5],[118,18,30,14,5.5],[178,-18,34,15,6]
    ];
    stores.forEach((s,i)=>{
      const [x,zp,w,d,h]=s;
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),i%3===0?wood:stucco);
      body.position.set(x,base+h*.5,zp);
      body.rotation.y=-.12;
      body.name='hawi_storefront_'+i;
      body.userData.evidence='procedural town massing pending measured footprint replacement';
      g.add(body);

      const rg=new THREE.CylinderGeometry(Math.max(w,d)*.56,Math.max(w,d)*.63,2.1,4);
      const r=new THREE.Mesh(rg,roof);
      r.rotation.y=Math.PI/4-.12;
      r.scale.z=.58;
      r.position.set(x,base+h+1.0,zp);
      g.add(r);

      // Covered lanai / awning gives human-scale street depth.
      const awn=new THREE.Mesh(new THREE.BoxGeometry(w*.72,.22,3.2),roof);
      awn.position.set(x,base+h*.62,zp-(d*.52+1.4));
      awn.rotation.y=-.12;
      g.add(awn);
    });

    // Utility poles along road.
    for(let i=-5;i<=5;i++){
      const x=i*46;
      for(const side of [-1,1]){
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,8,7),wood);
        pole.position.set(x,base+4,side*11.5);
        pole.rotation.z=(i%2?-.012:.012);
        g.add(pole);
      }
    }

    // Wind-shaped roadside vegetation and pasture clumps.
    const count=this.coarse?20:42;
    for(let i=0;i<count;i++){
      const a=(i*2.399)%6.283;
      const rr=90+(i%9)*28;
      const tree=new THREE.Mesh(new THREE.ConeGeometry(2.2+(i%3)*.4,5+(i%4),7),green);
      tree.position.set(Math.cos(a)*rr,base+2.5,Math.sin(a)*rr*.62);
      tree.scale.x=1.25; tree.rotation.z=(i%2?-.08:.06);
      g.add(tree);
    }
  }

  addPuuhonua(g, z, cx, cy) {
    const base = Math.max(0, this.heightAt(cx, cy));
    const wallMat = this.shared.lava;
    const woodMat = this.shared.wood;
    const thatch = this.shared.dryGrass;

    // Great Wall: stepped basalt courses instead of one smooth slab.
    for(let layer=0;layer<3;layer++){
      const wall = new THREE.Mesh(new THREE.BoxGeometry(156-layer*3, 1.9, 7.5-layer*.4), wallMat);
      wall.position.set(0, base + 1.0 + layer*1.75, 15);
      wall.rotation.y = -.18;
      wall.name = 'puuhonua_great_wall_course_'+layer;
      wall.userData.evidence = 'P historic wall form / I simplified dimensions';
      g.add(wall);
    }
    const ret = new THREE.Mesh(new THREE.BoxGeometry(60, 4.8, 6.2), wallMat);
    ret.position.set(-68, base + 2.4, -9); ret.rotation.y = 1.25; g.add(ret);

    // Hale cluster with pitched thatch roofs and shaded lanais.
    const hale=[[-38,-30,13,8],[-18,-42,11,7],[7,-31,14,8],[31,-44,12,7],[52,-29,13,8]];
    hale.forEach((h,i)=>{
      const [x,zp,w,d]=h;
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,3.4,d),woodMat);
      body.position.set(x,base+1.7,zp); g.add(body);

      const roof=new THREE.Mesh(new THREE.CylinderGeometry(Math.max(w,d)*.58,Math.max(w,d)*.72,3.4,4),thatch);
      roof.rotation.y=Math.PI/4;
      roof.scale.z=.62;
      roof.position.set(x,base+4.8,zp);
      g.add(roof);

      const lanai=new THREE.Mesh(new THREE.BoxGeometry(w*.8,.18,2.4),woodMat);
      lanai.position.set(x,base+.7,zp-d*.68);
      g.add(lanai);
    });

    // Coastal fishpond / royal-ground water cue.
    const pondMat=new THREE.MeshPhysicalMaterial({color:0x467b7f,roughness:.28,transparent:true,opacity:.72});
    const pond=new THREE.Mesh(new THREE.CircleGeometry(74,36),pondMat);
    pond.rotation.x=-Math.PI/2; pond.scale.set(1.5,1,.72);
    pond.position.set(92,base+.15,-72); g.add(pond);

    // Coconut / coastal planting.
    const trees=this.coarse?10:20;
    for(let i=0;i<trees;i++){
      const a=i*2.399, rr=95+(i%5)*22;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,6.8,7),woodMat);
      trunk.position.set(58+Math.cos(a)*rr,base+3.4,-35+Math.sin(a)*rr*.7);
      trunk.rotation.z=(i%2?-.06:.05); g.add(trunk);
      const crown=new THREE.Mesh(new THREE.DodecahedronGeometry(1.4,1),this.shared.pasture);
      crown.scale.set(2.2,1.2,2.0); crown.position.copy(trunk.position); crown.position.y+=5.1;
      g.add(crown);
    }
  }

  addPuukohola(g, z, cx, cy) {
    const base = Math.max(0, this.heightAt(cx, cy));
    const stone = this.shared.lava;
    const levels = [[0,0,118,72,5.5],[1,1,96,58,4.8],[4,4,72,42,4.0]];
    levels.forEach(([x,zp,w,d,h],i)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),stone);
      m.position.set(x,base+h/2+i*4.2,zp);
      m.name='puukohola_terrace_'+i;
      m.userData.evidence='P stepped-heiau form / I simplified dimensions';
      g.add(m);
      // Slightly irregular basalt cap course.
      for(let k=0;k<Math.max(4,10-i*2);k++){
        const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),stone);
        rock.scale.set(3+(k%3),1.2+(k%2)*.5,2.4+(k%4)*.4);
        rock.position.set(x-w*.38+k*(w*.76/Math.max(1,(9-i*2))),base+i*4.2+h+.8,zp-d*.38+(k%2)*d*.75);
        rock.rotation.y=k*.37;
        g.add(rock);
      }
    });

    // Dry coastal trail and scrub context around the heiau.
    const trail=new THREE.Mesh(new THREE.BoxGeometry(330,.14,3.2),this.shared.drySoil);
    trail.position.set(-40,base+.18,95); trail.rotation.y=.28; g.add(trail);

    for(let i=0;i<(this.coarse?12:26);i++){
      const a=i*2.17, rr=120+(i%6)*45;
      const shrub=new THREE.Mesh(new THREE.ConeGeometry(1.4+(i%3)*.3,2.5+(i%4)*.35,7),this.shared.dryGrass);
      shrub.position.set(Math.cos(a)*rr,base+1.2,Math.sin(a)*rr*.7);
      shrub.rotation.z=(i%2?-.04:.03); g.add(shrub);
    }
  }

  addKaloko(g, z, cx, cy) {
    const base = Math.max(0, this.heightAt(cx, cy));
    const water = new THREE.MeshPhysicalMaterial({ color: 0x356f78, roughness:.28, transparent:true, opacity:.72 });
    const stone = this.shared.lava;
    const wet = this.shared.wetForest;
    const dry = this.shared.dryGrass;

    // Main Kaloko fishpond.
    const pond = new THREE.Mesh(new THREE.CircleGeometry(230, 56), water);
    pond.rotation.x=-Math.PI/2; pond.scale.set(1.6,1,.82); pond.position.set(0,base+.28,0);
    pond.name='kaloko_fishpond_proxy'; pond.userData.evidence='P fishpond identity / I simplified shoreline';
    g.add(pond);

    // Stone kuapā wall broken into segments instead of one perfect torus.
    for(let i=0;i<28;i++){
      const a=(i/28)*Math.PI*2;
      const rx=Math.cos(a)*350, rz=Math.sin(a)*180;
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),stone);
      rock.scale.set(7+(i%4)*2,2.4+(i%3)*.6,5+(i%5));
      rock.position.set(rx,base+2.1,rz);
      rock.rotation.y=a+.2*(i%3);
      g.add(rock);
    }

    // Secondary wetland / marsh patches.
    for(let i=0;i<5;i++){
      const marsh=new THREE.Mesh(new THREE.CircleGeometry(55+(i%3)*18,28),water);
      marsh.rotation.x=-Math.PI/2; marsh.scale.set(1.3,1,.7);
      marsh.position.set(-420+i*190,base+.24,260+(i%2)*90);
      g.add(marsh);
    }

    // Lava shoreline and low coastal vegetation.
    for(let i=0;i<(this.coarse?24:52);i++){
      const a=i*2.21, rr=300+(i%9)*55;
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),stone);
      rock.scale.set(8+(i%4)*4,3+(i%3)*1.2,7+(i%5)*3);
      rock.position.set(Math.cos(a)*rr,base+3,-180+Math.sin(a)*rr*.58);
      g.add(rock);
    }

    const veg=this.coarse?20:42;
    for(let i=0;i<veg;i++){
      const a=i*2.399, rr=260+(i%6)*45;
      const shrub=new THREE.Mesh(new THREE.DodecahedronGeometry(1.1,1),i%3===0?wet:dry);
      shrub.scale.set(1.8,1.2,1.6);
      shrub.position.set(Math.cos(a)*rr,base+1.2,180+Math.sin(a)*rr*.62);
      g.add(shrub);
    }

    // Simple walking-trail cue through the cultural landscape.
    const trail=new THREE.Mesh(new THREE.BoxGeometry(620,.12,2.6),this.shared.drySoil);
    trail.position.set(60,base+.22,320); trail.rotation.y=.18; g.add(trail);
  }

  addValley(g, z, cx, cy) {
    const base=Math.max(0,this.heightAt(cx,cy));
    const wet=this.shared.wetForest;
    const water=new THREE.MeshPhysicalMaterial({color:0x86b8c6,roughness:.18,transparent:true,opacity:.82});
    const isWaipio=z.id==='waipio';

    // Real valley form remains DEM-driven. Add only local hydrology and vegetation cues.
    const stream=new THREE.Mesh(new THREE.PlaneGeometry(isWaipio?1700:1050,isWaipio?38:28),water);
    stream.rotation.x=-Math.PI/2;
    stream.rotation.z=isWaipio?.18:-.12;
    stream.position.set(0,base+1.2,isWaipio?-150:40);
    stream.name=z.id+'_valley_stream_proxy';
    stream.userData.evidence='hydrology cue on DEM / simplified alignment';
    g.add(stream);

    const fallCount=isWaipio?3:1;
    for(let i=0;i<fallCount;i++){
      const fall=new THREE.Mesh(new THREE.PlaneGeometry(isWaipio?22:18,isWaipio?260:180,1,6),water);
      fall.position.set((i-(fallCount-1)/2)*(isWaipio?280:0),base+(isWaipio?360:260),isWaipio?760:520);
      fall.rotation.y=(i-(fallCount-1)/2)*.09;
      fall.name=z.id+'_waterfall_'+i;
      fall.userData.evidence='visual waterfall cue / DEM remains authoritative';
      g.add(fall);
    }

    const count=this.coarse?(isWaipio?42:28):(isWaipio?90:58);
    const trees=[];
    for(let i=0;i<count;i++){
      const a=i*2.399, rr=(isWaipio?420:300)+(i%10)*(isWaipio?90:65);
      const x=Math.cos(a)*rr;
      const zp=(isWaipio?180:80)+Math.sin(a)*rr*.55;
      const slopeBias=(i%4===0)?1.25:1;
      trees.push({
        x,y:base,z:zp,trunkH:(isWaipio?9:8)*slopeBias,trunkR:1.1,
        crownScale:[2.2*slopeBias,2.8*slopeBias,2.1*slopeBias],rot:i*.31
      });
    }
    this.addTreeInstances(g,trees,wet,z.id+'_forest');

    // Small lookout platform cue only, never a giant landmark primitive.
    const lookout=new THREE.Mesh(new THREE.BoxGeometry(isWaipio?18:14,.35,isWaipio?9:7),this.shared.wood);
    lookout.position.set(isWaipio?-520:-360,base+2.2,isWaipio?620:420);
    lookout.userData.evidence='lookout cue / simplified dimensions';
    g.add(lookout);
  }

  buildQueenK(bikeLonLat) {
    if (!bikeLonLat.length) return;
    // Use the real routed bike course as the spine; sample enough points to keep mobile cheap.
    const step = this.coarse ? 18 : 10;
    const samples = [];
    for (let i = 0; i < bikeLonLat.length; i += step) {
      const [lon, lat] = bikeLonLat[i];
      const [x, y] = this.toLocal(lat, lon);
      // skip dense Kailua core, owned by Ring 0/1
      if (Math.hypot(x, y) < 2600) continue;
      samples.push({ x, y });
    }
    const n = samples.length;
    if (!n) return;
    const road = new THREE.InstancedMesh(this.shared.roadGeo, this.shared.asphaltMat, n);
    road.name = 'queen_k_route_segments';
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xe4e1d7, roughness: .78 });
    const lines = new THREE.InstancedMesh(this.shared.roadGeo, lineMat, n * 2);
    lines.name = 'queen_k_edge_lines';
    const rocks = new THREE.InstancedMesh(this.shared.rockGeo, this.shared.lavaMat, n * 3);
    rocks.name = 'queen_k_lava_edge';
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let ri = 0, li = 0;
    for (let i = 0; i < n; i++) {
      const a = samples[i], b = samples[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.max(10, Math.hypot(dx, dy));
      const z = Math.max(0, this.heightAt(a.x, a.y));
      const p = this.W(a.x, a.y, z + .35);
      q.setFromAxisAngle(up, Math.atan2(dx, dy));
      sc.set(6.8, .22, len * .62);
      m.compose(p, q, sc); road.setMatrixAt(i, m);

      // Low-profile edge lines. Slightly above asphalt to avoid z-fighting.
      for (const side of [-1, 1]) {
        const lp = this.W(a.x, a.y, z + .49);
        const localSide = new THREE.Vector3(side * 5.9, 0, 0).applyQuaternion(q);
        lp.add(localSide);
        sc.set(.12, .04, len * .60);
        m.compose(lp, q, sc); lines.setMatrixAt(li++, m);
      }

      const random = rng(hashString('qk' + i));
      const nx = dy / len, ny = -dx / len;
      for (const side of [-1, 1, sideJitter(random)]) {
        const off = (10 + random() * 42) * Math.sign(side || 1);
        const rx = a.x + nx * off + (random() - .5) * 20;
        const ry = a.y + ny * off + (random() - .5) * 20;
        const rz = Math.max(0, this.heightAt(rx, ry));
        const rp = this.W(rx, ry, rz + .5);
        q.setFromAxisAngle(up, random() * Math.PI * 2);
        const s = .8 + random() * 2.8; sc.set(s, s * (.45 + random() * .5), s);
        m.compose(rp, q, sc); rocks.setMatrixAt(ri++, m);
      }
    }
    road.instanceMatrix.needsUpdate = true;
    lines.count = li; lines.instanceMatrix.needsUpdate = true;
    rocks.count = ri; rocks.instanceMatrix.needsUpdate = true;
    road.visible = false; lines.visible = false; rocks.visible = false;
    this.root.add(road, lines, rocks);
    this.corridor = { road, lines, rocks, samples, activation: 9000 };
  }

  update(dt, camera) {
    this.t += dt;
    if (this.t < .45) return;
    this.t = 0;
    const cx = camera.position.x, cy = -camera.position.z;
    const altitude = Math.max(0, camera.position.y);
    const overview = altitude > 45000;
    for (const z of this.zones) {
      const d = Math.hypot(z.x - cx, z.y - cy);
      const shouldShow = !overview && d < z.activation;
      if (shouldShow && !z.built && !z.building) {
        z.building=true;
        // Build one approached zone synchronously at the coarse update cadence. All other
        // invisible zones remain metadata-only until visited.
        this.populateZone(z.group, z.cfg, z.x, z.y);
        z.built=true;
        z.building=false;
      }
      z.group.visible = shouldShow && z.built;
    }
    if (this.corridor) {
      let near = false;
      // sparse proximity test avoids scanning the complete original route.
      for (let i = 0; i < this.corridor.samples.length; i += 3) {
        const p = this.corridor.samples[i];
        if (Math.hypot(p.x - cx, p.y - cy) < this.corridor.activation) { near = true; break; }
      }
      this.corridor.road.visible = !overview && near;
      this.corridor.lines.visible = !overview && near;
      this.corridor.rocks.visible = !overview && near;
    }
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse(o => {
      if (o.geometry && !Object.values(this.shared).includes(o.geometry)) o.geometry.dispose?.();
      if (o.material && !Object.values(this.shared).includes(o.material)) o.material.dispose?.();
    });
  }
}
function sideJitter(random) { return random() > .5 ? 1 : -1; }
