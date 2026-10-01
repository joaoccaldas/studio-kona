import { FidsBoardRenderer } from './live/liveFids.js';
import * as THREE from 'three';

// Realistic 3D model of Ellison Onizuka Kona International Airport at Keāhole (KOA).
// Features true open-air Polynesian pavilion architecture, runway 17/35 with precision markings,
// parallel Taxiway Alpha, commercial apron, parked airliners (Hawaiian B717 & United B737) with
// mobile airstairs (no jetbridges in Kona), air traffic control tower, open-air baggage claim with
// triathlete bike box staging, and the authentic central courtyard concessions:
// Kona Brewing Co. Airport Pub, Laniakea Market, Big Island Candies, Lei Stand, Starbucks,
// Honolulu Cookie Co, Big Island Surf Co, and the rental car center.

export function buildKonaAirport({ group: g, z, cx, cy, shared, coarse = false, heightAt }) {
  const base = Math.max(1, heightAt(cx, cy)) + 0.15;

  // Dedicated authentic materials
  const asphalt = shared.asphalt || new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.92 });
  const concrete = shared.concrete || new THREE.MeshStandardMaterial({ color: 0xb5b0a4, roughness: 0.88 });
  const darkAsphalt = new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.94 });
  const apronConcrete = new THREE.MeshStandardMaterial({ color: 0xc8c3b7, roughness: 0.82 });
  const lavaRock = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.96 });
  const polynesianWood = new THREE.MeshStandardMaterial({ color: 0x422a18, roughness: 0.76 });
  const thatchRoof = new THREE.MeshStandardMaterial({ color: 0x5a4832, roughness: 0.94 });
  const bronzeMetal = new THREE.MeshStandardMaterial({ color: 0x362f2b, roughness: 0.45, metalness: 0.7 });
  const paintedSteel = new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.35, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x6e929d, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.75 });
  const greenGlass = new THREE.MeshStandardMaterial({ color: 0x3a6b58, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.8 });
  const runwayWhite = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.7 });
  const taxiYellow = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.65 });
  const redHazard = new THREE.MeshStandardMaterial({ color: 0xba1c1c, roughness: 0.7 });
  const hawaiianPurple = new THREE.MeshStandardMaterial({ color: 0x3c1053, roughness: 0.38, metalness: 0.25 });
  const hawaiianMagenta = new THREE.MeshStandardMaterial({ color: 0xc71585, roughness: 0.4 });
  const unitedBlue = new THREE.MeshStandardMaterial({ color: 0x0033a0, roughness: 0.4 });
  const aircraftSilver = new THREE.MeshStandardMaterial({ color: 0xdde2e6, roughness: 0.28, metalness: 0.8 });
  const rubberTire = new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.9 });
  const signGreen = new THREE.MeshStandardMaterial({ color: 0x085f36, roughness: 0.6 });
  const signGold = new THREE.MeshStandardMaterial({ color: 0xd49b1a, roughness: 0.5 });
  const signKonaBrewing = new THREE.MeshStandardMaterial({ color: 0xb87d16, roughness: 0.55 });
  const signCandies = new THREE.MeshStandardMaterial({ color: 0x631a24, roughness: 0.5 });
  const leiOrchid = new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.85 });
  const leiPlumeria = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.85 });
  const bikeBoxScicon = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const bikeBoxEvoc = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 });
  const bikeBoxCardboard = new THREE.MeshStandardMaterial({ color: 0xb48a56, roughness: 0.9 });
  const palmGreen = shared.pasture || new THREE.MeshStandardMaterial({ color: 0x2d532b, roughness: 0.85 });

  // Antialiasing and Z-fighting depth offsets for markings and apron
  runwayWhite.polygonOffset = true;
  runwayWhite.polygonOffsetFactor = -1.0;
  runwayWhite.polygonOffsetUnits = -4.0;

  taxiYellow.polygonOffset = true;
  taxiYellow.polygonOffsetFactor = -1.0;
  taxiYellow.polygonOffsetUnits = -4.0;

  redHazard.polygonOffset = true;
  redHazard.polygonOffsetFactor = -1.0;
  redHazard.polygonOffsetUnits = -4.0;

  apronConcrete.polygonOffset = true;
  apronConcrete.polygonOffsetFactor = -0.5;
  apronConcrete.polygonOffsetUnits = -2.0;

  // Geometry helpers
  function box(mat, name, x, y, z, sx, sy, sz, rx=0, ry=0, rz=0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.name = name;
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  }

  function cyl(mat, name, x, y, z, rTop, rBot, h, segs=12, rx=0, ry=0, rz=0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat);
    m.name = name;
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  }

  function hipRoof(mat, name, x, y, z, w, d, h) {
    const roofGeo = new THREE.CylinderGeometry(Math.min(w, d) * 0.08, Math.max(w, d) * 0.72, h, 4);
    const m = new THREE.Mesh(roofGeo, mat);
    m.name = name;
    m.position.set(x, y + h * 0.5, z);
    m.rotation.y = Math.PI / 4;
    m.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    g.add(m);
    return m;
  }

  function signBanner(bgMat, name, x, y, z, w, h, d=0.18, rx=0, ry=0, rz=0) {
    return box(bgMat, name, x, y, z, w, h, d, rx, ry, rz);
  }

  // =========================================================================
  // 1. RUNWAY 17/35 & PARALLEL TAXIWAY ALPHA
  // Aligned 353° / 173° (-7° rotation = -0.122 rad). Center offset: x=-285, z=540.
  // =========================================================================
  const rwX = -285, rwZ = 540, rwHeading = -0.122;
  const rwLen = 3350, rwW = 46;

  // Main Asphalt Runway Slab
  box(darkAsphalt, 'koa_runway_17_35', rwX, base + 0.12, rwZ, rwW, 0.24, rwLen, 0, rwHeading, 0);

  // Runway Markings (instanced / grouped on runway)
  const rwCos = Math.cos(rwHeading), rwSin = Math.sin(rwHeading);
  function rwPos(localLateral, localAlong) {
    return [
      rwX + localLateral * rwCos - localAlong * rwSin,
      base + 0.26,
      rwZ + localLateral * rwSin + localAlong * rwCos
    ];
  }

  // Threshold Bars ("Piano Keys") at Runway 35 (South, along = +1600) and Runway 17 (North, along = -1600)
  for (const endSign of [-1, 1]) {
    const alongEnd = endSign * 1610;
    // 8 piano key stripes
    for (let i = -3.5; i <= 3.5; i++) {
      const p = rwPos(i * 4.8, alongEnd - endSign * 18);
      box(runwayWhite, `koa_threshold_${endSign}_${i}`, p[0], p[1], p[2], 2.2, 0.05, 34, 0, rwHeading, 0);
    }
    // Aiming point big solid blocks
    for (const side of [-12, 12]) {
      const ap = rwPos(side, alongEnd - endSign * 340);
      box(runwayWhite, `koa_aiming_${endSign}_${side}`, ap[0], ap[1], ap[2], 6.5, 0.05, 45, 0, rwHeading, 0);
    }
  }

  // Dashed Centerline along entire 3.3 km runway (InstancedMesh for draw call reduction)
  const step = coarse ? 140 : 80;
  const clDashes = [];
  for (let s = -1500; s <= 1500; s += step) {
    clDashes.push(s);
  }
  const clGeo = new THREE.BoxGeometry(1.8, 0.05, 32);
  const clMesh = new THREE.InstancedMesh(clGeo, runwayWhite, clDashes.length);
  clMesh.name = 'koa_runway_centerline';
  const dummy = new THREE.Object3D();
  clDashes.forEach((s, idx) => {
    const cp = rwPos(0, s);
    dummy.position.set(cp[0], cp[1], cp[2]);
    dummy.rotation.set(0, rwHeading, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    clMesh.setMatrixAt(idx, dummy.matrix);
  });
  clMesh.instanceMatrix.needsUpdate = true;
  g.add(clMesh);

  // Parallel Taxiway Alpha (22m wide, located 130m east of runway)
  const twX = rwX + 130 * rwCos, twZ = rwZ + 130 * rwSin;
  box(darkAsphalt, 'koa_taxiway_alpha', twX, base + 0.1, twZ, 23, 0.2, rwLen * 0.88, 0, rwHeading, 0);

  // High-Speed Exit Taxiways connecting Runway to Taxiway Alpha (A1 to A5)
  for (const exitDist of [-900, -450, 0, 450, 900]) {
    const midPos = rwPos(65, exitDist);
    box(darkAsphalt, `koa_exit_taxiway_${exitDist}`, midPos[0], base + 0.11, midPos[2], 110, 0.2, 22, 0, rwHeading + 0.55, 0);
    box(taxiYellow, `koa_exit_line_${exitDist}`, midPos[0], base + 0.23, midPos[2], 108, 0.04, 0.6, 0, rwHeading + 0.55, 0);
  }

  // Windsock Station (FAA standard segmented circle + 360° rotating wind cone tracking live METAR wind vector)
  const wsPos = rwPos(95, 300);
  cyl(concrete, 'koa_windsock_base', wsPos[0], base + 0.3, wsPos[2], 9, 9, 0.25, 16);

  // Segmented white marker circle around wind cone station
  for (let ci = 0; ci < 12; ci++) {
    const ca = (ci / 12) * Math.PI * 2;
    box(runwayWhite, `koa_windsock_seg_${ci}`, wsPos[0] + Math.cos(ca) * 11.5, base + 0.18, wsPos[2] + Math.sin(ca) * 11.5, 1.2, 0.08, 3.2, 0, -ca, 0);
  }

  // Steel mast & obstruction beacon
  cyl(paintedSteel, 'koa_windsock_pole', wsPos[0], base + 4.5, wsPos[2], 0.12, 0.14, 8.5, 8);
  const beacon = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), redHazard);
  beacon.position.set(wsPos[0], base + 8.95, wsPos[2]);
  g.add(beacon);

  // Rotating Swivel Collar (Rotates freely with live wind direction)
  const windsockSwivel = new THREE.Group();
  windsockSwivel.name = 'koa_windsock_swivel';
  windsockSwivel.position.set(wsPos[0], base + 8.55, wsPos[2]);

  // Throat mounting hoop & pivot bearing
  const throatHoop = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.04, 8, 16), paintedSteel);
  throatHoop.rotation.y = Math.PI / 2;
  windsockSwivel.add(throatHoop);

  // Articulated Cone Arm (Tilts with wind speed / droop)
  const coneArm = new THREE.Group();
  coneArm.name = 'koa_windsock_cone_arm';

  // 5 alternating segments: International Orange & FAA White
  const segMats = [redHazard, runwayWhite, redHazard, runwayWhite, redHazard];
  const segLen = 0.72;
  for (let si = 0; si < 5; si++) {
    const r1 = 0.72 - si * 0.088;
    const r2 = 0.72 - (si + 1) * 0.088;
    const segGeo = new THREE.CylinderGeometry(r2, r1, segLen, 12, 1, true);
    const seg = new THREE.Mesh(segGeo, segMats[si]);
    seg.rotation.z = Math.PI / 2;
    seg.position.x = (si + 0.5) * segLen;
    coneArm.add(seg);
  }
  coneArm.rotation.z = -0.6;
  windsockSwivel.add(coneArm);
  g.add(windsockSwivel);

  // =========================================================================
  // 2. COMMERCIAL PASSENGER APRON (RAMP) & GATE STANDS 1 - 10
  // Spans x = -130 to 10, z = 360 to 820.
  // =========================================================================
  const apronCenterX = -60, apronCenterZ = 590, apronW = 150, apronL = 480;
  box(apronConcrete, 'koa_commercial_apron', apronCenterX, base + 0.14, apronCenterZ, apronW, 0.24, apronL, 0, rwHeading, 0);

  // Tarmac Gate Lead-in Lines & Aircraft Stop Bars (Gates 1 to 10)
  for (let gNum = 1; gNum <= 10; gNum++) {
    const zOffset = 390 + (gNum - 1) * 44;
    const gateLeadX = -60, gateLeadZ = zOffset;
    box(taxiYellow, `koa_gate_line_${gNum}`, gateLeadX - 18, base + 0.27, gateLeadZ, 42, 0.04, 0.55, 0, rwHeading, 0);
    box(redHazard, `koa_gate_box_${gNum}`, gateLeadX + 12, base + 0.27, gateLeadZ, 26, 0.04, 28, 0, rwHeading, 0);
    box(runwayWhite, `koa_stop_bar_${gNum}`, gateLeadX - 4, base + 0.28, gateLeadZ, 1.2, 0.04, 8, 0, rwHeading, 0);
  }

  // Apron Stadium Floodlight Masts (4 tall multi-lamp towers illuminating the ramp)
  for (const mastZ of [420, 530, 650, 770]) {
    const mastX = -5;
    cyl(paintedSteel, `koa_ramp_light_mast_${mastZ}`, mastX, base + 14, mastZ, 0.45, 0.8, 28, 8);
    box(paintedSteel, `koa_ramp_light_cross_${mastZ}`, mastX - 1.5, base + 27.5, mastZ, 6.5, 0.45, 1.2);
    box(runwayWhite, `koa_ramp_lamps_${mastZ}`, mastX - 2.2, base + 27.2, mastZ, 5.8, 0.9, 0.6, 0.25, 0, 0);
  }

  // =========================================================================
  // 3. PARKED COMMERCIAL AIRLINERS (HAWAIIAN B717 & UNITED B737)
  // With authentic mobile passenger airstairs (no jetbridges in Kona!)
  // =========================================================================
  function buildAirliner({ x, z, heading, airline, gate }) {
    const planeGrp = new THREE.Group();
    planeGrp.name = `koa_plane_${airline}_gate_${gate}`;
    planeGrp.position.set(x, base + 3.2, z);
    planeGrp.rotation.y = heading;

    const bodyMat = aircraftSilver;
    const liveryMat = airline === 'hawaiian' ? hawaiianPurple : unitedBlue;

    // Fuselage Tube
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 36, 16), bodyMat);
    fuselage.rotation.z = Math.PI / 2;
    planeGrp.add(fuselage);

    // Nose Cone
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.9, 5.5, 16), bodyMat);
    nose.position.x = -20.5;
    nose.rotation.z = Math.PI / 2;
    planeGrp.add(nose);

    // Tail Fin (Vertical Stabilizer) with signature airline branding
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(4.8, 7.5, 0.35), liveryMat);
    tailFin.position.set(15.5, 4.2, 0);
    tailFin.rotation.z = -0.32;
    planeGrp.add(tailFin);

    if (airline === 'hawaiian') {
      const pualani = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.4, 16), hawaiianMagenta);
      pualani.rotation.x = Math.PI / 2;
      pualani.position.set(15.2, 5.0, 0);
      planeGrp.add(pualani);
      const belly = new THREE.Mesh(new THREE.BoxGeometry(34, 1.2, 3.8), hawaiianPurple);
      belly.position.set(0, -1.2, 0);
      planeGrp.add(belly);
    } else {
      const globe = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.4, 16), paintedSteel);
      globe.rotation.x = Math.PI / 2;
      globe.position.set(15.2, 5.0, 0);
      planeGrp.add(globe);
    }

    // Horizontal Tail Stabilizers
    for (const side of [-1, 1]) {
      const hStab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 5.5), bodyMat);
      hStab.position.set(16.2, 6.8, side * 3.2);
      hStab.rotation.y = side * 0.2;
      planeGrp.add(hStab);
    }

    // Wings
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.35, 14.5), bodyMat);
      wing.position.set(-2, -0.4, side * 8.2);
      wing.rotation.y = -side * 0.38;
      wing.rotation.z = -side * 0.08;
      planeGrp.add(wing);

      const winglet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.18), liveryMat);
      winglet.position.set(-1.2, 0.9, side * 15.2);
      planeGrp.add(winglet);

      const engX = airline === 'hawaiian' ? 12 : -3.5;
      const engY = airline === 'hawaiian' ? 0.8 : -1.8;
      const engZ = airline === 'hawaiian' ? side * 2.8 : side * 5.8;
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.05, 5.2, 14), paintedSteel);
      eng.rotation.z = Math.PI / 2;
      eng.position.set(engX, engY, engZ);
      planeGrp.add(eng);

      const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.4, 12), rubberTire);
      intake.rotation.z = Math.PI / 2;
      intake.position.set(engX - 2.6, engY, engZ);
      planeGrp.add(intake);
    }

    // Landing Gear Legs & Rubber Tires
    const noseGear = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), paintedSteel);
    noseGear.position.set(-16.5, -1.8, 0);
    planeGrp.add(noseGear);
    for (const offZ of [-0.35, 0.35]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12), rubberTire);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(-16.5, -3.0, offZ);
      planeGrp.add(tire);
    }
    for (const side of [-1, 1]) {
      const mainGear = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.2, 8), paintedSteel);
      mainGear.position.set(0, -1.8, side * 3.0);
      planeGrp.add(mainGear);
      for (const tZ of [-0.4, 0.4]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12), rubberTire);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(0, -3.0, side * 3.0 + tZ);
        planeGrp.add(tire);
      }
    }

    // Mobile Passenger Airstairs (The hallmark of Kona International Airport)
    const stairX = -13.5, stairZ = 3.6;
    const stairs = new THREE.Group();
    stairs.name = 'kona_mobile_airstairs';
    stairs.position.set(stairX, -3.1, stairZ);

    const truck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.1, 2.4), paintedSteel);
    truck.position.set(0, 0.55, 0);
    stairs.add(truck);
    for (const wx of [-1.8, 1.8]) {
      for (const wz of [-1.3, 1.3]) {
        const wt = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10), rubberTire);
        wt.rotation.x = Math.PI / 2;
        wt.position.set(wx, 0.38, wz);
        stairs.add(wt);
      }
    }
    const flight = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, 1.6), liveryMat);
    flight.position.set(1.6, 2.1, 0);
    flight.rotation.z = -0.68;
    stairs.add(flight);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 1.8), paintedSteel);
    platform.position.set(3.4, 3.5, 0);
    stairs.add(platform);
    for (const rz of [-0.85, 0.85]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.08, 0.08), paintedSteel);
      rail.position.set(1.6, 3.1, rz);
      rail.rotation.z = -0.68;
      stairs.add(rail);
    }
    planeGrp.add(stairs);

    g.add(planeGrp);
  }

  // Hawaiian Airlines Boeing 717 parked at Gate 3
  buildAirliner({ x: -45, z: 478, heading: rwHeading + Math.PI * 0.52, airline: 'hawaiian', gate: 3 });

  // United Airlines Boeing 737 parked at Gate 8
  buildAirliner({ x: -48, z: 698, heading: rwHeading + Math.PI * 0.52, airline: 'united', gate: 8 });

  // Ground Support Equipment (GSE) Trains on the Apron
  const tugX = -28, tugZ = 530;
  box(signGold, 'koa_baggage_tug', tugX, base + 0.9, tugZ, 3.4, 1.3, 1.8);
  box(rubberTire, 'koa_tug_cab', tugX - 0.4, base + 1.8, tugZ, 1.6, 0.8, 1.6);
  for (let cIdx = 1; cIdx <= 3; cIdx++) {
    const cartX = tugX + cIdx * 4.2;
    box(paintedSteel, `koa_baggage_cart_${cIdx}`, cartX, base + 0.65, tugZ, 3.2, 0.5, 1.9);
    const boxMat = cIdx === 1 ? bikeBoxScicon : cIdx === 2 ? bikeBoxEvoc : bikeBoxCardboard;
    box(boxMat, `koa_triathlete_bike_box_${cIdx}`, cartX, base + 1.25, tugZ, 1.6, 1.1, 0.7);
    box(signGreen, `koa_luggage_${cIdx}_a`, cartX - 0.8, base + 1.05, tugZ - 0.35, 0.9, 0.5, 0.6);
    box(signCandies, `koa_luggage_${cIdx}_b`, cartX + 0.8, base + 1.05, tugZ + 0.35, 0.9, 0.5, 0.6);
  }

  // Pushback Tractor near Gate 8
  box(taxiYellow, 'koa_pushback_tractor', -72, base + 0.85, 715, 6.2, 1.5, 3.2);

  // =========================================================================
  // 4. POLYNESIAN OPEN-AIR TERMINAL PODS (GATES 1-5 & GATES 6-10)
  // Authentic timber-post & lava-column open-air pavilions with steep hipped roofs
  // =========================================================================
  const pavilionPillars = [];
  const pavilionPosts = [];

  function buildOpenAirPavilion({ id, name, x, z, w, d, h, roofH, isSouth = true }) {
    const pGrp = new THREE.Group();
    pGrp.name = id;
    pGrp.position.set(x, base, z);

    box(concrete, `${id}_slab`, x, base + 0.3, z, w + 1.2, 0.6, d + 1.2);

    const colsX = Math.floor(w / 7), colsZ = Math.floor(d / 7);
    for (let ix = 0; ix <= colsX; ix++) {
      for (let iz = 0; iz <= colsZ; iz++) {
        if (ix === 0 || ix === colsX || iz === 0 || iz === colsZ) {
          const cx_ = x - w * 0.5 + ix * (w / colsX);
          const cz_ = z - d * 0.5 + iz * (d / colsZ);
          pavilionPillars.push([cx_, base + 1.1, cz_]);
          pavilionPosts.push([cx_, base + 2.8 + h * 0.4, cz_, h - 0.5]);
        }
      }
    }

    box(polynesianWood, `${id}_timber_beam`, x, base + h + 0.5, z, w * 0.96, 0.45, d * 0.96);
    hipRoof(thatchRoof, `${id}_thatched_roof`, x, base + h + 0.6, z, w * 1.18, d * 1.18, roofH);

    for (let bi = -2; bi <= 2; bi++) {
      box(polynesianWood, `${id}_bench_${bi}`, x + bi * (w * 0.16), base + 0.85, z, w * 0.12, 0.45, 1.8);
      box(polynesianWood, `${id}_bench_back_${bi}`, x + bi * (w * 0.16), base + 1.35, z + 0.8, w * 0.12, 0.55, 0.15);
    }

    const bannerMat = isSouth ? hawaiianPurple : unitedBlue;
    signBanner(bannerMat, `${id}_gate_banner`, x - w * 0.45, base + h - 0.2, z, 5.5, 1.2, 0.3, 0, Math.PI / 2, 0);

    g.add(pGrp);
  }

  // South Terminal Pods (Gates 1 - 5: Hawaiian Airlines & Mokulele)
  buildOpenAirPavilion({ id: 'koa_gate_1_2', name: 'Gates 1 & 2', x: 2, z: 430, w: 24, d: 38, h: 4.5, roofH: 5.2, isSouth: true });
  buildOpenAirPavilion({ id: 'koa_gate_3_4', name: 'Gates 3 & 4', x: 2, z: 485, w: 24, d: 42, h: 4.5, roofH: 5.4, isSouth: true });
  buildOpenAirPavilion({ id: 'koa_gate_5', name: 'Gate 5', x: 2, z: 540, w: 22, d: 34, h: 4.5, roofH: 5.0, isSouth: true });

  // North Terminal Pods (Gates 6 - 10: United, American, Delta, Alaska, Southwest)
  buildOpenAirPavilion({ id: 'koa_gate_6_7', name: 'Gates 6 & 7', x: -18, z: 645, w: 24, d: 40, h: 4.5, roofH: 5.2, isSouth: false });
  buildOpenAirPavilion({ id: 'koa_gate_8_9', name: 'Gates 8 & 9', x: -18, z: 705, w: 24, d: 42, h: 4.5, roofH: 5.4, isSouth: false });
  buildOpenAirPavilion({ id: 'koa_gate_10', name: 'Gate 10', x: -18, z: 760, w: 22, d: 36, h: 4.5, roofH: 5.0, isSouth: false });

  // Batch all pavilion perimeter lava pillars & timber posts into InstancedMeshes (removes 238 draw calls)
  if (pavilionPillars.length) {
    const pilGeo = new THREE.CylinderGeometry(0.55, 0.65, 1.6, 8);
    const pilMesh = new THREE.InstancedMesh(pilGeo, lavaRock, pavilionPillars.length);
    pilMesh.name = 'koa_pavilion_pillars_instanced';
    const dPil = new THREE.Object3D();
    pavilionPillars.forEach((p, idx) => {
      dPil.position.set(p[0], p[1], p[2]);
      dPil.updateMatrix();
      pilMesh.setMatrixAt(idx, dPil.matrix);
    });
    pilMesh.instanceMatrix.needsUpdate = true;
    g.add(pilMesh);
  }

  if (pavilionPosts.length) {
    const postGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.0, 8);
    const postMesh = new THREE.InstancedMesh(postGeo, polynesianWood, pavilionPosts.length);
    postMesh.name = 'koa_pavilion_posts_instanced';
    const dPost = new THREE.Object3D();
    pavilionPosts.forEach((p, idx) => {
      dPost.position.set(p[0], p[1], p[2]);
      dPost.scale.set(1, p[3], 1);
      dPost.updateMatrix();
      postMesh.setMatrixAt(idx, dPost.matrix);
    });
    postMesh.instanceMatrix.needsUpdate = true;
    g.add(postMesh);
  }

  // Connecting Open-Air Covered Walkways between Pavilions
  for (const walkZ of [458, 512, 675, 732]) {
    const walkX = walkZ < 600 ? 2 : -18;
    box(concrete, `koa_walkway_slab_${walkZ}`, walkX, base + 0.25, walkZ, 7, 0.4, 18);
    hipRoof(thatchRoof, `koa_walkway_canopy_${walkZ}`, walkX, base + 3.8, walkZ, 8.5, 19, 2.8);
  }

  // =========================================================================
  // 5. CENTRAL CONCESSIONS PLAZA & GARDEN LANAI
  // The heart of KOA Airport between North and South Terminals (z = 560 to 625).
  // Contains the authentic stores in their true airport positions!
  // =========================================================================
  const plazaCenterX = 15, plazaCenterZ = 590;

  // Central Tropical Garden Plinth with Lava Rock Planters
  box(concrete, 'koa_central_plaza_slab', plazaCenterX, base + 0.3, plazaCenterZ, 56, 0.5, 65);

  // STORE 1: KONA BREWING CO. AIRPORT PUB & LANAI BAR
  const kbcX = 4, kbcZ = 575;
  box(polynesianWood, 'koa_store_kbc_counter', kbcX, base + 1.35, kbcZ, 14, 1.2, 4.2);
  for (let si = -2; si <= 2; si++) {
    cyl(bronzeMetal, `koa_kbc_stool_${si}`, kbcX + si * 2.4, base + 0.9, kbcZ - 2.8, 0.38, 0.38, 0.7, 8);
  }
  box(bronzeMetal, 'koa_kbc_tap_tower', kbcX, base + 2.1, kbcZ + 0.4, 3.8, 0.45, 0.35);
  for (let ti = -3; ti <= 3; ti++) {
    cyl(signKonaBrewing, `koa_kbc_tap_handle_${ti}`, kbcX + ti * 0.48, base + 2.5, kbcZ + 0.4, 0.05, 0.05, 0.55, 6);
  }
  for (const bx of [-6, 6]) {
    cyl(polynesianWood, `koa_kbc_post_${bx}`, kbcX + bx, base + 2.8, kbcZ, 0.3, 0.3, 4.8, 8);
  }
  hipRoof(thatchRoof, 'koa_kbc_thatched_roof', kbcX, base + 4.8, kbcZ, 17, 9.5, 3.8);
  signBanner(signKonaBrewing, 'koa_sign_kona_brewing', kbcX, base + 4.6, kbcZ - 4.4, 12, 1.1, 0.25);
  for (let ui = -1; ui <= 1; ui++) {
    const utX = kbcX + ui * 5.2, utZ = kbcZ - 7.5;
    cyl(polynesianWood, `koa_kbc_table_${ui}`, utX, base + 1.1, utZ, 1.1, 1.1, 0.8, 10);
    cyl(bronzeMetal, `koa_kbc_umbrella_pole_${ui}`, utX, base + 2.4, utZ, 0.06, 0.06, 2.6, 6);
    cyl(signGold, `koa_kbc_umbrella_${ui}`, utX, base + 3.8, utZ, 0.2, 2.6, 1.2, 12);
  }

  // STORE 2: LANIAKEA MARKET & ISLAND DELI (Grab & go poke, bento, spam musubi)
  const lmX = 26, lmZ = 572;
  box(polynesianWood, 'koa_store_laniakea_shell', lmX, base + 2.4, lmZ, 16, 4.2, 9);
  box(glass, 'koa_laniakea_poke_case_1', lmX - 3.5, base + 1.3, lmZ - 2.8, 6.5, 1.3, 1.8);
  box(glass, 'koa_laniakea_poke_case_2', lmX + 3.5, base + 1.3, lmZ - 2.8, 6.5, 1.3, 1.8);
  box(signGold, 'koa_laniakea_shelves', lmX, base + 2.1, lmZ + 2.2, 12, 2.4, 0.9);
  hipRoof(thatchRoof, 'koa_laniakea_roof', lmX, base + 4.5, lmZ, 18.5, 11.5, 3.9);
  signBanner(signGreen, 'koa_sign_laniakea_market', lmX, base + 4.4, lmZ - 4.6, 13.5, 1.05, 0.22);

  // STORE 3: BIG ISLAND CANDIES BOUTIQUE (Macadamia shortbread & chocolates)
  const bicX = 26, bicZ = 595;
  box(polynesianWood, 'koa_store_candies_shell', bicX, base + 2.4, bicZ, 15, 4.2, 8.5);
  box(glass, 'koa_candies_display_case', bicX, base + 1.4, bicZ - 2.4, 11, 1.2, 1.8);
  for (let bi = -2; bi <= 2; bi++) {
    box(signCandies, `koa_candies_gift_boxes_${bi}`, bicX + bi * 2.2, base + 1.85, bicZ - 2.4, 1.4, 0.45, 1.1);
  }
  hipRoof(thatchRoof, 'koa_candies_roof', bicX, base + 4.5, bicZ, 17.5, 10.8, 3.8);
  signBanner(signCandies, 'koa_sign_big_island_candies', bicX, base + 4.4, bicZ - 4.4, 13, 1.05, 0.22);

  // STORE 4: ALOHA FRESH FLOWER LEI STAND (Center of the open-air garden)
  const leiX = 14, leiZ = 592;
  box(polynesianWood, 'koa_lei_stand_counter', leiX, base + 1.25, leiZ, 7.5, 1.2, 4.2);
  box(glass, 'koa_lei_glass_case', leiX, base + 2.1, leiZ, 6.8, 0.85, 3.6);
  for (let li = -2; li <= 2; li++) {
    const lMat = Math.abs(li) % 2 === 0 ? leiOrchid : leiPlumeria;
    cyl(lMat, `koa_lei_garland_${li}`, leiX + li * 1.2, base + 2.1, leiZ, 0.18, 0.18, 0.7, 8);
  }
  cyl(polynesianWood, 'koa_lei_pole', leiX, base + 2.8, leiZ, 0.14, 0.14, 4.8, 8);
  hipRoof(thatchRoof, 'koa_lei_roof', leiX, base + 4.2, leiZ, 9.5, 6.5, 2.8);
  signBanner(hawaiianMagenta, 'koa_sign_fresh_leis', leiX, base + 3.8, leiZ - 2.2, 5.8, 0.65, 0.18);

  // STORE 5: STARBUCKS & 100% KONA COFFEE KIOSK (South-Central path)
  const sbX = 14, sbZ = 612;
  box(polynesianWood, 'koa_store_starbucks_counter', sbX, base + 1.25, sbZ, 8.5, 1.2, 4.2);
  box(paintedSteel, 'koa_starbucks_espresso_machine', sbX - 1.8, base + 2.05, sbZ, 1.8, 0.7, 0.9);
  box(bronzeMetal, 'koa_starbucks_grinders', sbX + 1.8, base + 2.15, sbZ, 1.4, 0.85, 0.7);
  hipRoof(thatchRoof, 'koa_starbucks_roof', sbX, base + 4.2, sbZ, 10.5, 6.8, 2.9);
  signBanner(signGreen, 'koa_sign_starbucks_kona_coffee', sbX, base + 3.8, sbZ - 2.2, 7.5, 0.75, 0.18);

  // STORE 6: HONOLULU COOKIE COMPANY (North Corridor, z = 638)
  const hccX = -4, hccZ = 638;
  box(polynesianWood, 'koa_store_honolulu_cookie_counter', hccX, base + 1.3, hccZ, 10.5, 1.2, 3.8);
  box(glass, 'koa_honolulu_cookie_vitrine', hccX, base + 2.1, hccZ, 9.8, 0.75, 3.2);
  const seafoamGreen = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 });
  for (let ci = -2; ci <= 2; ci++) {
    cyl(seafoamGreen, `koa_cookie_tin_${ci}`, hccX + ci * 1.8, base + 2.1, hccZ, 0.35, 0.35, 0.45, 8);
  }
  signBanner(seafoamGreen, 'koa_sign_honolulu_cookie', hccX, base + 3.8, hccZ - 2.1, 9.2, 0.75, 0.18);

  // STORE 7: BIG ISLAND SURF CO. (North Terminal arcade, z = 660)
  const srfX = 32, srfZ = 660;
  box(polynesianWood, 'koa_store_surf_co_shell', srfX, base + 2.2, srfZ, 12, 3.8, 7.5);
  for (let si = -1; si <= 1; si++) {
    box(signGold, `koa_display_surfboard_${si}`, srfX - 4.5, base + 2.5, srfZ + si * 1.4, 0.12, 4.2, 0.85, 0, 0, 0.18);
  }
  hipRoof(thatchRoof, 'koa_surf_co_roof', srfX, base + 4.2, srfZ, 14, 9.5, 3.2);
  signBanner(signGreen, 'koa_sign_big_island_surf', srfX, base + 4.0, srfZ - 3.8, 10.5, 0.85, 0.18);

  // =========================================================================
  // 6. OPEN-AIR BAGGAGE CLAIM & TRIATHLETE OVERSIZED BIKE CLAIM
  // Roadside/East side of terminal: Baggage Claim A (z=505) and B (z=710)
  // =========================================================================
  for (const [bcName, bcZ, isB] of [['A', 505, false], ['B', 710, true]]) {
    const bcX = 35;
    box(concrete, `koa_baggage_${bcName}_slab`, bcX, base + 0.3, bcZ, 26, 0.5, 36);
    hipRoof(thatchRoof, `koa_baggage_${bcName}_roof`, bcX, base + 4.5, bcZ, 29, 39, 4.8);
    const carouMat = bronzeMetal;
    box(carouMat, `koa_carousel_${bcName}_belt`, bcX, base + 0.9, bcZ, 16, 0.65, 24);
    box(concrete, `koa_carousel_${bcName}_core`, bcX, base + 1.15, bcZ, 10, 0.85, 18);
    for (let li = 0; li < (coarse ? 6 : 14); li++) {
      const a = (li / (coarse ? 6 : 14)) * Math.PI * 2;
      const lx = bcX + Math.cos(a) * 6.5, lz = bcZ + Math.sin(a) * 10;
      box(li % 2 === 0 ? signGreen : signCandies, `koa_carousel_bag_${bcName}_${li}`, lx, base + 1.4, lz, 0.9, 0.5, 0.65, 0, a, 0);
    }
    signBanner(signGreen, `koa_sign_baggage_${bcName}`, bcX, base + 4.1, bcZ - 18.2, 16, 0.95, 0.2);

    if (isB) {
      // TRIATHLETE OVERSIZED BAGGAGE & BIKE BOX CLAIM AREA
      const bikeClaimX = bcX + 18, bikeClaimZ = bcZ;
      box(concrete, 'koa_bike_claim_pad', bikeClaimX, base + 0.25, bikeClaimZ, 14, 0.4, 28);
      signBanner(hawaiianMagenta, 'koa_sign_triathlon_bike_claim', bikeClaimX, base + 3.2, bikeClaimZ - 14.1, 12, 0.9, 0.2);

      for (let bi = 0; bi < (coarse ? 6 : 14); bi++) {
        const row = Math.floor(bi / 4), col = bi % 4;
        const bX = bikeClaimX - 4 + col * 2.6;
        const bZ = bikeClaimZ - 10 + row * 6.5;
        const bMat = bi % 3 === 0 ? bikeBoxScicon : bi % 3 === 1 ? bikeBoxEvoc : bikeBoxCardboard;
        box(bMat, `koa_claim_bike_box_${bi}`, bX, base + 1.1, bZ, 1.8, 1.3, 0.75, 0, (bi % 2) * 0.15, 0);
      }
      for (let ti = 0; ti < 4; ti++) {
        box(paintedSteel, `koa_luggage_trolley_${ti}`, bikeClaimX - 3 + ti * 2.4, base + 0.75, bikeClaimZ + 11, 1.1, 0.85, 1.4);
      }
    }
  }

  // =========================================================================
  // 7. CURBSIDE CHECK-IN, TICKETING & DROP-OFF ROADWAY
  // =========================================================================
  const curbX = 68, curbZ = 600, curbLen = 320;
  box(asphalt, 'koa_curbside_drive', curbX + 16, base + 0.1, curbZ, 26, 0.18, curbLen);
  box(concrete, 'koa_curbside_walk', curbX, base + 0.28, curbZ, 12, 0.35, curbLen * 0.92);
  for (const [airline, tZ] of [['Hawaiian', 480], ['United', 620], ['Southwest', 680], ['Delta_Alaska', 740]]) {
    box(polynesianWood, `koa_ticket_counter_${airline}`, curbX, base + 1.3, tZ, 8, 1.2, 28);
    hipRoof(thatchRoof, `koa_ticket_roof_${airline}`, curbX, base + 4.2, tZ, 10.5, 30, 3.2);
    signBanner(signGreen, `koa_sign_ticketing_${airline}`, curbX, base + 3.8, tZ - 14.1, 8.5, 0.85, 0.18);
  }

  // =========================================================================
  // 8. AIR TRAFFIC CONTROL TOWER (ATC)
  // Distinctive modernist white tower with green-tinted cab at x = -125, z = 320
  // =========================================================================
  const atcX = -125, atcZ = 320;
  box(concrete, 'koa_atc_base_building', atcX, base + 2.5, atcZ, 22, 5.0, 18);
  cyl(paintedSteel, 'koa_atc_shaft', atcX, base + 16.5, atcZ, 3.2, 4.2, 24, 8);
  cyl(paintedSteel, 'koa_atc_balcony', atcX, base + 28.5, atcZ, 5.8, 5.0, 1.2, 8);
  cyl(greenGlass, 'koa_atc_glass_cab', atcX, base + 31.0, atcZ, 5.4, 4.8, 3.8, 8);
  cyl(paintedSteel, 'koa_atc_roof', atcX, base + 33.2, atcZ, 5.8, 5.8, 0.6, 8);
  const radome = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 1), paintedSteel);
  radome.name = 'koa_atc_radome';
  radome.position.set(atcX, base + 35.2, atcZ);
  g.add(radome);
  cyl(paintedSteel, 'koa_atc_antenna_mast', atcX + 2.2, base + 36.5, atcZ + 1.2, 0.08, 0.12, 6.5, 6);

  // =========================================================================
  // 9. CAR RENTAL CENTER & SHUTTLES (Across Keahole Airport Road)
  // Centered at x = 220, z = 630
  // =========================================================================
  const rentX = 220, rentZ = 630;
  const rentalWheels = [];
  box(asphalt, 'koa_rental_car_lot', rentX, base + 0.12, rentZ, 160, 0.22, 190);
  box(concrete, 'koa_rental_office', rentX - 45, base + 2.2, rentZ, 18, 4.2, 54);
  hipRoof(thatchRoof, 'koa_rental_roof', rentX - 45, base + 4.4, rentZ, 21, 58, 3.6);
  signBanner(signGold, 'koa_sign_rental_cars', rentX - 45, base + 4.1, rentZ - 27.2, 16, 1.1, 0.25);

  const carColors = [0xd97706, 0x2563eb, 0xdc2626, 0x16a34a, 0x475569, 0xf8fafc];
  const numCars = coarse ? 12 : 28;
  for (let ci = 0; ci < numCars; ci++) {
    const row = Math.floor(ci / 7), col = ci % 7;
    const cX = rentX - 18 + row * 24;
    const cZ = rentZ - 70 + col * 20;
    const cMat = new THREE.MeshStandardMaterial({ color: carColors[ci % carColors.length], roughness: 0.35, metalness: 0.3 });
    box(cMat, `koa_rental_car_body_${ci}`, cX, base + 1.1, cZ, 4.8, 1.4, 2.2);
    box(glass, `koa_rental_car_cabin_${ci}`, cX - 0.3, base + 2.1, cZ, 2.8, 0.85, 2.0);
    for (const wx of [-1.5, 1.5]) {
      for (const wz of [-1.15, 1.15]) {
        rentalWheels.push([cX + wx, base + 0.42, cZ + wz]);
      }
    }
  }

  if (rentalWheels.length) {
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
    const wheelMesh = new THREE.InstancedMesh(wheelGeo, rubberTire, rentalWheels.length);
    wheelMesh.name = 'koa_rental_car_wheels_instanced';
    const dWheel = new THREE.Object3D();
    rentalWheels.forEach((w, idx) => {
      dWheel.position.set(w[0], w[1], w[2]);
      dWheel.rotation.set(Math.PI / 2, 0, 0);
      dWheel.scale.set(1, 1, 1);
      dWheel.updateMatrix();
      wheelMesh.setMatrixAt(idx, dWheel.matrix);
    });
    wheelMesh.instanceMatrix.needsUpdate = true;
    g.add(wheelMesh);
  }

  const shutX = curbX + 18, shutZ = 580;
  box(paintedSteel, 'koa_shuttle_bus_body', shutX, base + 1.8, shutZ, 3.2, 2.4, 11);
  box(signGreen, 'koa_shuttle_bus_stripe', shutX, base + 1.6, shutZ, 3.25, 0.5, 10.8);
  box(glass, 'koa_shuttle_bus_windows', shutX, base + 2.3, shutZ, 3.24, 0.9, 9.5);

  // =========================================================================
  // 10. TROPICAL GARDEN PALMS & SURROUNDING VOLCANIC LAVA OASIS
  // =========================================================================
  const palmCount = coarse ? 14 : 32;
  const palmTrunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 1.0, 7);
  const palmCrownGeo = new THREE.DodecahedronGeometry(2.4, 1);
  const palmTrunksMesh = new THREE.InstancedMesh(palmTrunkGeo, polynesianWood, palmCount);
  palmTrunksMesh.name = 'koa_palms_trunks_instanced';
  const palmCrownsMesh = new THREE.InstancedMesh(palmCrownGeo, palmGreen, palmCount);
  palmCrownsMesh.name = 'koa_palms_crowns_instanced';

  const dTrunk = new THREE.Object3D();
  const dCrown = new THREE.Object3D();

  for (let pi = 0; pi < palmCount; pi++) {
    const angle = (pi / palmCount) * Math.PI * 2;
    const pDist = 12 + (pi % 5) * 6;
    const px = plazaCenterX + Math.cos(angle) * pDist;
    const pz = plazaCenterZ + Math.sin(angle) * pDist;
    const trunkH = 8.5 + (pi % 4) * 1.5;

    dTrunk.position.set(px, base + trunkH * 0.5, pz);
    dTrunk.rotation.set(0, 0, Math.sin(angle) * 0.12);
    dTrunk.scale.set(1, trunkH, 1);
    dTrunk.updateMatrix();
    palmTrunksMesh.setMatrixAt(pi, dTrunk.matrix);

    dCrown.position.set(px + Math.sin(angle) * 0.8, base + trunkH + 0.6, pz);
    dCrown.rotation.set(0, 0, 0);
    dCrown.scale.set(1.9, 0.9, 1.9);
    dCrown.updateMatrix();
    palmCrownsMesh.setMatrixAt(pi, dCrown.matrix);
  }
  palmTrunksMesh.instanceMatrix.needsUpdate = true;
  palmCrownsMesh.instanceMatrix.needsUpdate = true;
  g.add(palmTrunksMesh);
  g.add(palmCrownsMesh);

  const rockPositions = [];
  const rockCount = coarse ? 22 : 55;
  for (let ri = 0; ri < rockCount; ri++) {
    const rDist = 280 + (ri % 8) * 90;
    const rAngle = (ri / rockCount) * Math.PI * 2;
    const rx = Math.cos(rAngle) * rDist;
    const rz = Math.sin(rAngle) * rDist * 0.7;
    // Exclude airfield, runway, commercial apron, terminal pavilions, and parking
    if (rx > -380 && rx < 340 && rz > 100 && rz < 900) continue;
    const rSize = 6 + (ri % 5) * 4;
    rockPositions.push({
      x: rx,
      y: base + rSize * 0.35,
      z: rz,
      size: rSize,
      rot: [(ri % 3) * 0.4, (ri % 7) * 0.9, (ri % 5) * 0.3]
    });
  }
  if (rockPositions.length) {
    const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
    const rocksMesh = new THREE.InstancedMesh(rockGeo, lavaRock, rockPositions.length);
    rocksMesh.name = 'koa_lava_rocks_instanced';
    const dRock = new THREE.Object3D();
    rockPositions.forEach((rp, idx) => {
      dRock.position.set(rp.x, rp.y, rp.z);
      dRock.rotation.set(rp.rot[0], rp.rot[1], rp.rot[2]);
      dRock.scale.set(rp.size * 1.3, rp.size * 0.6, rp.size * 1.1);
      dRock.updateMatrix();
      rocksMesh.setMatrixAt(idx, dRock.matrix);
    });
    rocksMesh.instanceMatrix.needsUpdate = true;
    g.add(rocksMesh);
  }
}
