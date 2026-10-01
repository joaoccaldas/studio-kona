// Ring 2 world streamer: lightweight long-range island detail.
// Complements (does not replace) the Ring 1 500 m TileStreamer.
import * as THREE from 'three';
import { createNaturalMaterials, varyInstanceColors } from './naturalMaterials.js';

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
    this.shared = this.makeShared();
  }

  makeShared() {
    const n = createNaturalMaterials();
    const roadGeo = new THREE.BoxGeometry(1, 1, 1);
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const shrubGeo = new THREE.ConeGeometry(1, 1.6, 7);
    const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
    return {
      ...n,
      lavaMat:n.lava, cinderMat:n.cinder, scrubMat:n.dryGrass, pastureMat:n.pasture,
      urbanMat:n.stucco, roofMat:n.darkRoof, asphaltMat:n.asphalt,
      roadGeo, rockGeo, shrubGeo, bldgGeo
    };
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
      this.populateZone(g, z, x, y);
      const activation = z.lod === 'hero' ? Math.max(22000, z.radius_m * 1.6)
        : z.lod === 'high' ? Math.max(11000, z.radius_m * 1.8)
          : Math.max(8000, z.radius_m * 1.5);
      this.zones.push({ cfg: z, group: g, x, y, activation });
    }
  }

  populateZone(g, z, cx, cy) {
    const random = rng(hashString(z.id));
    const hero = z.lod === 'hero';
    const high = z.lod === 'high';
    const rockN = this.coarse ? (hero ? 90 : high ? 55 : 32) : (hero ? 220 : high ? 130 : 75);
    const shrubN = this.coarse ? (hero ? 55 : high ? 75 : 55) : (hero ? 120 : high ? 180 : 110);
    const bldgN = /hawi|hilo|waimea|waikoloa|kawaihae|keauhou|nelha|airport|old_airport/.test(z.id)
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

    this.addRegionalLandmark(g, z, cx, cy);
    if (z.id === 'hawi') this.addHawiTown(g, z, cx, cy);
    if (z.id === 'hilo') this.addHiloCity(g, z, cx, cy);
    if (z.id === 'waikoloa') this.addWaikoloa(g, z, cx, cy);
    if (z.id === 'kawaihae') this.addKawaihae(g, z, cx, cy);
    if (z.id === 'puuhonua') this.addPuuhonua(g, z, cx, cy);
    if (z.id === 'puukohola') this.addPuukohola(g, z, cx, cy);
    if (z.id === 'kaloko_honokohau') this.addKaloko(g, z, cx, cy);
    if (z.id === 'pololu' || z.id === 'waipio') this.addValley(g, z, cx, cy);

    // Major volcano shape comes from the real whole-island DEM.
    // Add only summit-scale detail here; never duplicate the mountain with a primitive cone.
    if (z.id === 'mauna_kea') this.addMaunaKeaSummit(g, z, cx, cy);
    if (z.id === 'kilauea') this.addKilaueaSummit(g, z, cx, cy);

    if (/airport|old_airport/.test(z.id)) {
      const runway = new THREE.Mesh(this.shared.roadGeo, this.shared.asphaltMat);
      runway.name = z.id + '_runway_proxy';
      const length = z.id === 'airport' ? 3350 : 1100;
      runway.scale.set(34, .18, length);
      runway.position.y = Math.max(1, this.heightAt(cx, cy)) + .18;
      g.add(runway);
    }
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
    // Great Wall proxy: long basalt mass with a short return. Evidence tag keeps this replaceable.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(155, 5.5, 7), wallMat);
    wall.position.set(0, base + 2.75, 15); wall.rotation.y = -.18;
    wall.name = 'puuhonua_great_wall_proxy'; wall.userData.evidence = 'P silhouette / I dimensions';
    g.add(wall);
    const ret = new THREE.Mesh(new THREE.BoxGeometry(58, 4.5, 6), wallMat);
    ret.position.set(-68, base + 2.25, -9); ret.rotation.y = 1.25; g.add(ret);
    // Compact hale cluster, deliberately low-poly.
    for (let i = 0; i < 5; i++) {
      const house = new THREE.Mesh(new THREE.BoxGeometry(10 + i % 2 * 4, 4.5, 7), woodMat);
      house.position.set(-35 + i * 18, base + 2.25, -28 - (i % 2) * 10); g.add(house);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 3.8, 4), this.shared.cinderMat);
      roof.rotation.y = Math.PI / 4; roof.position.copy(house.position); roof.position.y += 4.2; roof.scale.z=.65; g.add(roof);
    }
  }

  addPuukohola(g, z, cx, cy) {
    const base = Math.max(0, this.heightAt(cx, cy));
    const stone = this.shared.lava;
    const levels = [
      [0,0,115,70,6], [0,2,92,54,5], [4,5,68,38,4]
    ];
    levels.forEach(([x,zp,w,d,h],i)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),stone);
      m.position.set(x,base+h/2+i*4,zp); m.name='puukohola_terrace_'+i;
      m.userData.evidence='P stepped-heiau form / I dimensions'; g.add(m);
    });
  }

  addKaloko(g, z, cx, cy) {
    const base = Math.max(0, this.heightAt(cx, cy));
    const water = new THREE.MeshStandardMaterial({ color: 0x2b6870, roughness:.38, transparent:true, opacity:.72 });
    const stone = this.shared.lava;
    const pond = new THREE.Mesh(new THREE.CircleGeometry(210, 48), water);
    pond.rotation.x=-Math.PI/2; pond.scale.set(1.55,1,.78); pond.position.set(0,base+.35,0);
    pond.name='kaloko_fishpond_proxy'; pond.userData.evidence='P feature / I simplified shoreline'; g.add(pond);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(215,4.5,8,64),stone);
    ring.rotation.x=Math.PI/2; ring.scale.set(1.55,.78,1); ring.position.y=base+1.1; g.add(ring);
  }

  addValley(g, z, cx, cy) {
    const base = Math.max(0, this.heightAt(cx, cy));
    const wet = this.shared.wetForest;
    const cliff = this.shared.cliff;
    const isWaipio=z.id==='waipio';
    const span=isWaipio?5200:3600, depth=isWaipio?4800:3000, h=isWaipio?950:720;
    for (const side of [-1,1]) {
      const ridgeGeo=new THREE.CylinderGeometry(span*.22,span*.34,h,18,4);
      const ridge=new THREE.Mesh(ridgeGeo,cliff);
      ridge.position.set(side*span*.32,base+h*.48,0);
      ridge.rotation.z=side*.16; ridge.name=z.id+'_cliff_proxy_'+side;
      ridge.userData.evidence='terrain proxy; replace with high-resolution DEM'; g.add(ridge);
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(span*.23,span*.27,42,18),wet);
      cap.position.set(side*span*.32,base+h+10,0); cap.rotation.z=side*.16; cap.scale.z=.7; g.add(cap);
    }
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(span*.55,depth*.92,1,1),wet);
    floor.rotation.x=-Math.PI/2; floor.position.y=base+4; floor.name=z.id+'_valley_floor_proxy'; g.add(floor);
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
      // At whole-island altitude, hero/proxy geometry should not punch through the overview.
      // The Ring-3 terrain owns the view; Ring-2 activates only once the camera descends.
      z.group.visible = !overview && d < z.activation;
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
