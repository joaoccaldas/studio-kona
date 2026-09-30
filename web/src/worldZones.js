// Ring 2 world streamer: lightweight long-range island detail.
// Complements (does not replace) the Ring 1 500 m TileStreamer.
import * as THREE from 'three';

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
    const lavaMat = new THREE.MeshStandardMaterial({ color: 0x171514, roughness: .96 });
    const cinderMat = new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: .94 });
    const scrubMat = new THREE.MeshStandardMaterial({ color: 0x415b2b, roughness: .9 });
    const pastureMat = new THREE.MeshStandardMaterial({ color: 0x667a48, roughness: .92 });
    const urbanMat = new THREE.MeshStandardMaterial({ color: 0xaaa69b, roughness: .84 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x47423d, roughness: .82 });
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x252627, roughness: .9 });
    const roadGeo = new THREE.BoxGeometry(1, 1, 1);
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const shrubGeo = new THREE.ConeGeometry(1, 1.6, 6);
    const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
    return { lavaMat, cinderMat, scrubMat, pastureMat, urbanMat, roofMat, asphaltMat, roadGeo, rockGeo, shrubGeo, bldgGeo };
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
      g.add(buildings);
    }

    if (/mauna_kea|mauna_loa|hualalai|kilauea/.test(z.id)) {
      const r = Math.min(z.radius_m * .48, z.id === 'mauna_loa' ? 14000 : 8500);
      const h = z.id === 'mauna_kea' ? 4205 : z.id === 'mauna_loa' ? 4169 : z.id === 'hualalai' ? 2521 : 950;
      const geo = new THREE.ConeGeometry(r, h * .92, hero ? 96 : 64, 8);
      geo.translate(0, h * .46, 0);
      const massif = new THREE.Mesh(geo, z.id === 'kilauea' ? this.shared.lavaMat : this.shared.cinderMat);
      massif.name = z.id + '_proxy_massif';
      massif.userData.evidence = 'proxy; replace with public DEM terrain';
      g.add(massif);
    }

    if (/airport|old_airport/.test(z.id)) {
      const runway = new THREE.Mesh(this.shared.roadGeo, this.shared.asphaltMat);
      runway.name = z.id + '_runway_proxy';
      const length = z.id === 'airport' ? 3350 : 1100;
      runway.scale.set(34, .18, length);
      runway.position.y = Math.max(1, this.heightAt(cx, cy)) + .18;
      g.add(runway);
    }
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
    const rocks = new THREE.InstancedMesh(this.shared.rockGeo, this.shared.lavaMat, n * 3);
    rocks.name = 'queen_k_lava_edge';
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let ri = 0;
    for (let i = 0; i < n; i++) {
      const a = samples[i], b = samples[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.max(10, Math.hypot(dx, dy));
      const z = Math.max(0, this.heightAt(a.x, a.y));
      const p = this.W(a.x, a.y, z + .35);
      q.setFromAxisAngle(up, Math.atan2(dx, dy));
      sc.set(6.8, .22, len * .62);
      m.compose(p, q, sc); road.setMatrixAt(i, m);

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
    rocks.count = ri; rocks.instanceMatrix.needsUpdate = true;
    road.visible = false; rocks.visible = false;
    this.root.add(road, rocks);
    this.corridor = { road, rocks, samples, activation: 9000 };
  }

  update(dt, camera) {
    this.t += dt;
    if (this.t < .45) return;
    this.t = 0;
    const cx = camera.position.x, cy = -camera.position.z;
    for (const z of this.zones) {
      const d = Math.hypot(z.x - cx, z.y - cy);
      z.group.visible = d < z.activation;
    }
    if (this.corridor) {
      let near = false;
      // sparse proximity test avoids scanning the complete original route.
      for (let i = 0; i < this.corridor.samples.length; i += 3) {
        const p = this.corridor.samples[i];
        if (Math.hypot(p.x - cx, p.y - cy) < this.corridor.activation) { near = true; break; }
      }
      this.corridor.road.visible = near;
      this.corridor.rocks.visible = near;
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
