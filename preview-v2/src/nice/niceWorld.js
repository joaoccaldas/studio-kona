// Procedural 3D World Generation for Nice, France
// Ironman 70.3 World Championships (September 2026)
// Models the Baie des Anges, Promenade des Anglais, Hôtel Negresco, Castle Hill,
// Vieux Nice, Place Masséna, Port Lympia, Nice Airport (NCE), and the complete Ironman race venue.

import * as THREE from 'three';

export function buildNiceWorld({ scene, W, toLocal, heightAt = () => 6.0, coarse = false }) {
  const root = new THREE.Group();
  root.name = 'NICE_3D_WORLD_ROOT';

  // Dedicated Mediterranean color palette & authentic materials
  const seaAzure = new THREE.MeshStandardMaterial({ color: 0x007799, roughness: 0.15, metalness: 0.12, transparent: true, opacity: 0.88 });
  const seaTurquoise = new THREE.MeshStandardMaterial({ color: 0x16b0b0, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.78 });
  const pebbleBeach = new THREE.MeshStandardMaterial({ color: 0xbeb4a5, roughness: 0.95 });
  const promenadeStone = new THREE.MeshStandardMaterial({ color: 0xd6d9de, roughness: 0.82 });
  const asphaltRoad = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.9 });
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4231, roughness: 0.85 });
  const palmFrondMat = new THREE.MeshStandardMaterial({ color: 0x205528, roughness: 0.8 });
  const negrescoWhite = new THREE.MeshStandardMaterial({ color: 0xfcfcf9, roughness: 0.45 });
  const negrescoPink = new THREE.MeshStandardMaterial({ color: 0xda6d82, roughness: 0.4, metalness: 0.1 });
  const hotelGold = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.35, metalness: 0.6 });
  const castleLimestone = new THREE.MeshStandardMaterial({ color: 0x9c9082, roughness: 0.96 });
  const castleFoliage = new THREE.MeshStandardMaterial({ color: 0x284724, roughness: 0.88 });
  const vieuxNiceOchre = new THREE.MeshStandardMaterial({ color: 0xd99548, roughness: 0.85 });
  const vieuxNiceTerracotta = new THREE.MeshStandardMaterial({ color: 0xba5432, roughness: 0.88 });
  const massenaRed = new THREE.MeshStandardMaterial({ color: 0x9b2c2c, roughness: 0.6 });
  const checkerboardDark = new THREE.MeshStandardMaterial({ color: 0x242426, roughness: 0.7 });
  const chaisesBleuesMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
  const ironmanRed = new THREE.MeshStandardMaterial({ color: 0xd91c1c, roughness: 0.65 });
  const ironmanBlack = new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.7 });
  const steelWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const glassAzure = new THREE.MeshStandardMaterial({ color: 0x7eb8cc, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.75 });
  const airportAsphalt = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.92 });
  const markingWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const markingYellow = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
  const buoysOrange = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
  const carbonBike = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3, metalness: 0.8 });
  const airFranceBlue = new THREE.MeshStandardMaterial({ color: 0x002157, roughness: 0.4 });

  // Antialiasing and Z-fighting depth offsets for markings and promenade carpets
  ironmanRed.polygonOffset = true;
  ironmanRed.polygonOffsetFactor = -1.0;
  ironmanRed.polygonOffsetUnits = -4.0;

  promenadeStone.polygonOffset = true;
  promenadeStone.polygonOffsetFactor = -0.5;
  promenadeStone.polygonOffsetUnits = -2.0;

  markingWhite.polygonOffset = true;
  markingWhite.polygonOffsetFactor = -1.0;
  markingWhite.polygonOffsetUnits = -4.0;

  // Geometry helpers
  function box(mat, name, x, y, z, sx, sy, sz, rx=0, ry=0, rz=0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.name = name;
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    root.add(m);
    return m;
  }

  function cyl(mat, name, x, y, z, rTop, rBot, h, segs=12, rx=0, ry=0, rz=0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat);
    m.name = name;
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    root.add(m);
    return m;
  }

  function dome(mat, name, x, y, z, r, segs=16) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, segs, Math.round(segs * 0.75), 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
    m.name = name;
    m.position.set(x, y, z);
    root.add(m);
    return m;
  }

  // =========================================================================
  // 1. MEDITERRANEAN SEA & BAIE DES ANGES CURVED SHORELINE
  // The Bay curves smoothly from Castle Hill (+X = 900) southwest toward Airport (-X = -4500)
  // =========================================================================
  const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(12000, 6000, 16, 16), seaAzure);
  seaMesh.name = 'nice_mediterranean_sea';
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.set(-1500, 0, 2200);
  root.add(seaMesh);

  // Turquoise shallow waters hugging the pebble beach
  const shallowsMesh = new THREE.Mesh(new THREE.PlaneGeometry(8000, 350, 32, 2), seaTurquoise);
  shallowsMesh.name = 'nice_shallows_sea';
  shallowsMesh.rotation.x = -Math.PI / 2;
  shallowsMesh.position.set(-1400, 0.4, 280);
  root.add(shallowsMesh);

  // Pebble Beach (Plage des Galets)
  // Curves between z = 40 and z = 240 along the Promenade
  box(pebbleBeach, 'nice_pebble_beach_strip', -1400, 2.8, 140, 7800, 5.2, 190);

  // Stone breakwaters (épis de galets) protecting the beach
  for (let bi = -4; bi <= 2; bi++) {
    const bx = bi * 950 + 200;
    box(castleLimestone, 'nice_breakwater_' + bi, bx, 1.8, 220, 16, 3.4, 110, 0, -0.15, 0);
  }

  // =========================================================================
  // 2. PROMENADE DES ANGLAIS & SEASIDE BOULEVARD
  // 7 km sweeping boulevard with pedestrian promenade, cycle lane, and palm alleys
  // =========================================================================
  // Main wide pedestrian esplanade
  box(promenadeStone, 'nice_promenade_esplanade', -1400, 6.1, 10, 7800, 0.4, 38);
  // Dual carriageway avenue
  box(asphaltRoad, 'nice_promenade_roadway', -1400, 5.9, -24, 7800, 0.35, 28);
  // North urban sidewalk
  box(promenadeStone, 'nice_promenade_north_walk', -1400, 6.05, -46, 7800, 0.38, 14);

  // Signature White Arched Pergolas along the promenade
  for (let pi = -6; pi <= 3; pi++) {
    const px = pi * 520 - 150;
    const perg = new THREE.Group();
    perg.name = 'nice_pergola_' + pi;
    perg.position.set(px, 6.3, 22);
    // 4 pillars
    for (const sx of [-4, 4]) {
      for (const sz of [-2.5, 2.5]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.6, 8), steelWhite);
        pillar.position.set(sx, 1.8, sz);
        perg.add(pillar);
      }
    }
    // Curved arched canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.3, 5.8), steelWhite);
    canopy.position.set(0, 3.7, 0);
    perg.add(canopy);
    root.add(perg);
  }

  // Les Chaises Bleues (The Famous Riviera Blue Chairs) InstancedMesh
  const chairPositions = [];
  for (let ci = -18; ci <= 14; ci++) {
    const cx = ci * 65 - 120;
    for (let cRow = 0; cRow < 2; cRow++) {
      chairPositions.push([cx + cRow * 1.8, 6.4, 25 + cRow * 2.2]);
    }
  }
  const chairSeatGeo = new THREE.BoxGeometry(0.85, 0.1, 0.85);
  const chaisesMesh = new THREE.InstancedMesh(chairSeatGeo, chaisesBleuesMat, chairPositions.length);
  chaisesMesh.name = 'nice_chaises_bleues_instanced';
  const dChair = new THREE.Object3D();
  chairPositions.forEach((cp, idx) => {
    dChair.position.set(cp[0], cp[1], cp[2]);
    dChair.rotation.set(0, 0.05, 0);
    dChair.updateMatrix();
    chaisesMesh.setMatrixAt(idx, dChair.matrix);
  });
  chaisesMesh.instanceMatrix.needsUpdate = true;
  root.add(chaisesMesh);

  // Palm Trees Alleys (Phoenix Canariensis & Washingtonia) InstancedMesh
  const palmCount = coarse ? 40 : 120;
  const palmTrunkGeo = new THREE.CylinderGeometry(0.32, 0.48, 1.0, 8);
  const palmCrownGeo = new THREE.DodecahedronGeometry(2.8, 1);
  const palmTrunksMesh = new THREE.InstancedMesh(palmTrunkGeo, palmTrunkMat, palmCount * 2);
  palmTrunksMesh.name = 'nice_palm_trunks_instanced';
  const palmCrownsMesh = new THREE.InstancedMesh(palmCrownGeo, palmFrondMat, palmCount * 2);
  palmCrownsMesh.name = 'nice_palm_crowns_instanced';

  const dTrunk = new THREE.Object3D();
  const dCrown = new THREE.Object3D();
  let palmIdx = 0;

  for (let pi = 0; pi < palmCount; pi++) {
    const px = -3500 + pi * (4800 / palmCount);
    // Two rows: one seaside along promenade, one median along roadway
    for (const pz of [2, -10]) {
      const trunkH = 8.5 + (pi % 3) * 1.5;
      dTrunk.position.set(px, 6.2 + trunkH * 0.5, pz);
      dTrunk.scale.set(1, trunkH, 1);
      dTrunk.rotation.set((pi % 5) * 0.02, 0, (pi % 3) * 0.03);
      dTrunk.updateMatrix();
      palmTrunksMesh.setMatrixAt(palmIdx, dTrunk.matrix);

      dCrown.position.set(px, 6.2 + trunkH + 0.8, pz);
      dCrown.scale.set(1.8, 0.9, 1.8);
      dCrown.updateMatrix();
      palmCrownsMesh.setMatrixAt(palmIdx, dCrown.matrix);

      palmIdx++;
    }
  }
  palmTrunksMesh.instanceMatrix.needsUpdate = true;
  palmCrownsMesh.instanceMatrix.needsUpdate = true;
  root.add(palmTrunksMesh);
  root.add(palmCrownsMesh);

  // =========================================================================
  // 3. IRONMAN 70.3 WORLD CHAMPIONSHIP FINISH CHUTE & ARENA
  // Positioned on Promenade des Anglais near Jardin Albert 1er (x = -120, z = 12)
  // =========================================================================
  const finishX = -120, finishZ = 12;

  // 150-meter Official Red Carpet Finish Chute
  box(ironmanRed, 'nice_ironman_finish_carpet', finishX - 35, 6.32, finishZ, 150, 0.06, 6.8);
  // Black border runners
  for (const bSide of [-3.5, 3.5]) {
    box(ironmanBlack, 'nice_carpet_border_' + bSide, finishX - 35, 6.33, finishZ + bSide, 150, 0.08, 0.6);
  }

  // Official Ironman M-Dot Finish Gantry Arch
  const archX = finishX + 38;
  const archGrp = new THREE.Group();
  archGrp.name = 'nice_ironman_finish_arch';
  archGrp.position.set(archX, 6.3, finishZ);

  // Dual upright truss towers
  cyl(ironmanBlack, 'arch_tower_left', 0, 4.0, -3.8, 0.35, 0.35, 8.0, 6);
  cyl(ironmanBlack, 'arch_tower_right', 0, 4.0, 3.8, 0.35, 0.35, 8.0, 6);
  // Cross overhead beam
  box(ironmanBlack, 'arch_cross_beam', 0, 7.8, 0, 1.4, 1.2, 8.8);
  // Top header banner (IRONMAN 70.3 WORLD CHAMPIONSHIP NICE 2026)
  box(ironmanRed, 'arch_header_banner', 0.2, 8.8, 0, 0.8, 1.5, 8.5);
  // Red Ironman M-Dot icon
  cyl(ironmanRed, 'arch_mdot_head', 0.35, 9.9, 0, 0.45, 0.45, 0.25, 12, 0, 0, Math.PI / 2);
  box(ironmanRed, 'arch_mdot_legs', 0.35, 9.2, 0, 0.22, 0.9, 1.1);

  // Digital LED Race Timing Clock
  box(ironmanBlack, 'arch_timing_clock', 0.4, 7.6, 0, 0.35, 0.75, 3.6);
  box(markingYellow, 'arch_timing_digits', 0.58, 7.6, 0, 0.05, 0.45, 2.8);

  root.add(archGrp);

  // Dual Multi-Tier Spectator Grandstands (North & South of Chute)
  for (const [gsName, gsZ, isNorth] of [['South', finishZ + 8.5, false], ['North', finishZ - 8.5, true]]) {
    const gs = new THREE.Group();
    gs.name = 'nice_grandstand_' + gsName;
    gs.position.set(finishX - 35, 6.3, gsZ);

    // Multi-tier stepped seating structure
    for (let tier = 0; tier < 6; tier++) {
      const tierY = 0.5 + tier * 0.75;
      const zOffset = isNorth ? -tier * 0.9 : tier * 0.9;
      box(steelWhite, 'gs_tier_' + tier, 0, tierY, zOffset, 140, 0.7, 1.2);
      // Blue spectator seats
      box(chaisesBleuesMat, 'gs_seats_' + tier, 0, tierY + 0.4, zOffset, 138, 0.12, 0.9);
    }
    // Sponsor banner wrap along grandstand base
    box(ironmanBlack, 'gs_sponsor_skirt', 0, 1.2, isNorth ? 3.5 : -3.5, 142, 2.4, 0.3);
    box(ironmanRed, 'gs_sponsor_logo_stripe', 0, 1.2, isNorth ? 3.7 : -3.7, 138, 0.8, 0.1);

    // Flagpoles with French and international flags atop grandstands
    for (let fi = -4; fi <= 4; fi++) {
      const fx = fi * 15;
      const poleZ = isNorth ? -5.5 : 5.5;
      cyl(steelWhite, 'flagpole_' + fi, fx, 6.5, poleZ, 0.06, 0.06, 5.0, 6);
      const flagMat = fi % 2 === 0 ? ironmanRed : airFranceBlue;
      box(flagMat, 'flag_' + fi, fx + 0.8, 8.2, poleZ, 1.4, 0.9, 0.08);
    }

    root.add(gs);
  }

  // =========================================================================
  // 4. TRANSITION ZONE (T1 / T2) & SWIM START PONTOON
  // Quai des États-Unis and Plage des Ponchettes (x = 100 to 450, z = 20 to 140)
  // =========================================================================
  const transX = 260, transZ = 45;

  // Transition Secure Turf / Flooring
  box(asphaltRoad, 'nice_transition_deck', transX, 5.9, transZ, 320, 0.25, 48);

  // 12 Parallel Rows of Pro & Age-Group Bike Racks
  const bikeRackCount = coarse ? 6 : 12;
  for (let ri = 0; ri < bikeRackCount; ri++) {
    const rZ = transZ - 20 + ri * 3.6;
    // Steel horizontal rack rail
    box(steelWhite, 'nice_bike_rail_' + ri, transX, 7.1, rZ, 290, 0.08, 0.08);
    // Vertical rack A-frames
    for (let st = -3; st <= 3; st++) {
      cyl(steelWhite, 'nice_rack_support_' + ri + '_' + st, transX + st * 45, 6.5, rZ, 0.05, 0.08, 1.2, 6);
    }
    // High-end triathlon bikes hanging by saddle on the rack
    const bikesInRow = coarse ? 8 : 24;
    for (let bi = 0; bi < bikesInRow; bi++) {
      const bx = transX - 135 + bi * (270 / bikesInRow);
      // Diamond aero frame & wheels
      box(carbonBike, 'bike_frame_' + ri + '_' + bi, bx, 6.6, rZ + 0.35, 1.2, 0.75, 0.18, 0, (bi % 2) * 0.12, 0);
      cyl(carbonBike, 'bike_disc_rear_' + ri + '_' + bi, bx - 0.45, 6.45, rZ + 0.35, 0.38, 0.38, 0.08, 12, Math.PI / 2, 0, 0);
      cyl(carbonBike, 'bike_wheel_front_' + ri + '_' + bi, bx + 0.45, 6.45, rZ + 0.35, 0.38, 0.38, 0.08, 12, Math.PI / 2, 0, 0);
    }
  }

  // Swim Start & Australian Exit (Plage des Ponchettes, x = 420, z = 120)
  const swimX = 420, swimZ = 120;
  // Rolling start pontoon ramp extending into the turquoise water
  box(steelWhite, 'nice_swim_ramp', swimX, 2.2, swimZ + 25, 18, 0.4, 55, 0.12, 0, 0);
  box(ironmanRed, 'nice_swim_carpet', swimX, 2.45, swimZ + 25, 14, 0.08, 54, 0.12, 0, 0);
  // Timing mats at water's edge
  box(ironmanBlack, 'nice_swim_timing_mat', swimX, 1.2, swimZ + 50, 16, 0.12, 2.5);

  // Swim Course Tetrahedral Marker Buoys (Orange & Yellow in Baie des Anges)
  const buoyCoords = [
    [swimX - 150, 450], [swimX + 150, 480], [swimX + 450, 850],
    [swimX + 100, 920], [swimX - 250, 900], [swimX - 550, 750]
  ];
  buoyCoords.forEach(([bx, bz], idx) => {
    const buoy = new THREE.Mesh(new THREE.ConeGeometry(2.4, 4.5, 4), idx % 2 === 0 ? buoysOrange : markingYellow);
    buoy.name = 'nice_swim_buoy_' + idx;
    buoy.position.set(bx, 1.8, bz);
    root.add(buoy);
  });

  // =========================================================================
  // 5. HÔTEL LE NEGRESCO & BELLE ÉPOQUE PALACES
  // Dominates the Promenade des Anglais at x = -650, z = -65
  // =========================================================================
  const negX = -650, negZ = -65;
  const negWidth = 110, negHeight = 32, negDepth = 48;

  // Main 6-story Neoclassical Palace Body
  box(negrescoWhite, 'nice_negresco_facade', negX, 6.0 + negHeight * 0.5, negZ, negWidth, negHeight, negDepth);

  // Belle Époque Cornice Balustrades & Classical Arcades
  for (let fl = 1; fl <= 5; fl++) {
    box(negrescoWhite, 'negresco_balcony_floor_' + fl, negX, 6.0 + fl * 5.2, negZ + negDepth * 0.5 + 0.6, negWidth * 0.96, 0.5, 1.4);
  }

  // Arched Windows Rows
  for (let wx = -5; wx <= 5; wx++) {
    for (let wy = 1; wy <= 5; wy++) {
      box(glassAzure, 'negresco_win_' + wx + '_' + wy, negX + wx * 9.2, 6.0 + wy * 5.2 + 2.2, negZ + negDepth * 0.5 + 0.8, 4.2, 3.2, 0.3);
    }
  }

  // The World-Famous Pink Dome (Designed by Édouard Niermans)
  const domeRadius = 14.5;
  const domeBaseY = 6.0 + negHeight;
  cyl(negrescoWhite, 'negresco_dome_drum', negX, domeBaseY + 2.5, negZ + 6, domeRadius * 0.95, domeRadius, 5.0, 16);
  const pinkDome = dome(negrescoPink, 'nice_negresco_pink_dome', negX, domeBaseY + 5.0, negZ + 6, domeRadius, 20);
  pinkDome.scale.set(1.0, 1.35, 1.0);

  // Lantern Cupola atop the pink dome
  cyl(hotelGold, 'negresco_lantern', negX, domeBaseY + 5.0 + domeRadius * 1.35 + 2.2, negZ + 6, 1.8, 2.2, 4.5, 10);
  // Golden spire with French Tricolor Flag
  cyl(hotelGold, 'negresco_spire', negX, domeBaseY + 5.0 + domeRadius * 1.35 + 6.0, negZ + 6, 0.08, 0.16, 4.0, 6);
  box(airFranceBlue, 'negresco_tricolor_blue', negX - 0.8, domeBaseY + 5.0 + domeRadius * 1.35 + 7.2, negZ + 6, 0.6, 0.9, 0.06);
  box(steelWhite, 'negresco_tricolor_white', negX - 0.2, domeBaseY + 5.0 + domeRadius * 1.35 + 7.2, negZ + 6, 0.6, 0.9, 0.06);
  box(ironmanRed, 'negresco_tricolor_red', negX + 0.4, domeBaseY + 5.0 + domeRadius * 1.35 + 7.2, negZ + 6, 0.6, 0.9, 0.06);

  // Flanking corner cupolas on east and west wings
  for (const cSide of [-1, 1]) {
    const cX = negX + cSide * (negWidth * 0.46);
    cyl(negrescoWhite, 'negresco_corner_turret_' + cSide, cX, domeBaseY + 2.0, negZ + 6, 5.2, 5.5, 4.0, 12);
    dome(negrescoPink, 'negresco_corner_dome_' + cSide, cX, domeBaseY + 4.0, negZ + 6, 5.2, 14);
  }

  // Golden lettering banner "HOTEL NEGRESCO"
  box(hotelGold, 'negresco_lettering_banner', negX, domeBaseY + 0.8, negZ + negDepth * 0.5 + 1.2, 38, 1.4, 0.4);

  // Palais de la Méditerranée (Art Deco Palace at x = -245, z = -65)
  const palX = -245, palZ = -65;
  box(steelWhite, 'nice_palais_mediterranee_facade', palX, 6.0 + 15, palZ, 85, 30, 42);
  // Nine-bay monumental Art Deco arcade
  for (let bay = -4; bay <= 4; bay++) {
    box(glassAzure, 'palais_med_window_' + bay, palX + bay * 8.8, 6.0 + 14, palZ + 21.5, 5.8, 18, 0.4);
    cyl(steelWhite, 'palais_med_column_' + bay, palX + bay * 8.8 + 4.4, 6.0 + 14, palZ + 21.8, 0.6, 0.6, 22, 8);
  }

  // =========================================================================
  // 6. COLLINE DU CHÂTEAU (CASTLE HILL) & TOUR BELLANDA
  // Massive 93-meter limestone headland rising over the eastern end of the bay
  // =========================================================================
  const chateauX = 920, chateauZ = 220;

  // Tiered Limestone Massif
  const hillHeights = [18, 38, 62, 88];
  hillHeights.forEach((hVal, idx) => {
    const wVal = 380 - idx * 55;
    const dVal = 440 - idx * 60;
    box(castleLimestone, 'nice_castle_hill_tier_' + idx, chateauX, 6.0 + hVal * 0.5, chateauZ, wVal, hVal, dVal);
    // Mediterranean pine and cypress forest crowning the terraces
    box(castleFoliage, 'nice_castle_forest_' + idx, chateauX + (idx % 2) * 15, 6.0 + hVal + 1.2, chateauZ - 10, wVal * 0.92, 2.4, dVal * 0.92);
  });

  // Tour Bellanda (The Iconic Cylindrical Tower overlooking the Bay)
  // Perched on the southwest cliff edge (x = 760, z = 100, elevation = 38m)
  const bellX = 760, bellZ = 100;
  cyl(castleLimestone, 'nice_tour_bellanda_body', bellX, 6.0 + 20, bellZ, 12, 13.5, 28, 16);
  cyl(vieuxNiceTerracotta, 'nice_tour_bellanda_parapet', bellX, 6.0 + 34.5, bellZ, 13.2, 12.5, 2.2, 16);
  cyl(negrescoWhite, 'nice_tour_bellanda_rotunda', bellX, 6.0 + 37, bellZ, 6.5, 6.5, 4.0, 12);
  dome(vieuxNiceTerracotta, 'nice_tour_bellanda_roof', bellX, 6.0 + 39, bellZ, 6.5, 14);

  // Cascade du Château (Iconic Cliffside Waterfall)
  box(glassAzure, 'nice_cascade_waterfall', chateauX - 120, 6.0 + 44, chateauZ - 180, 18, 48, 4.5);
  box(castleLimestone, 'nice_cascade_basin', chateauX - 120, 6.0 + 18, chateauZ - 170, 26, 4.0, 18);

  // =========================================================================
  // 7. VIEUX NICE (OLD TOWN) & COURS SALEYA MARKET
  // Dense Mediterranean urban quarter with ochre facades & terracotta roofs
  // =========================================================================
  const oldX = 640, oldZ = -140;

  // Grid of picturesque Niçois 5-story blocks
  for (let ix = -3; ix <= 2; ix++) {
    for (let iz = -2; iz <= 1; iz++) {
      const bX = oldX + ix * 58;
      const bZ = oldZ + iz * 68;
      const bH = 16 + ((Math.abs(ix) + Math.abs(iz)) % 3) * 3;
      const fMat = (ix + iz) % 2 === 0 ? vieuxNiceOchre : vieuxNiceTerracotta;
      // Building shell
      box(fMat, 'vieux_nice_block_' + ix + '_' + iz, bX, 6.0 + bH * 0.5, bZ, 46, bH, 52);
      // Traditional Mediterranean terracotta hipped roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(36, 6.5, 4), vieuxNiceTerracotta);
      roof.name = 'vieux_nice_roof_' + ix + '_' + iz;
      roof.rotation.y = Math.PI / 4;
      roof.position.set(bX, 6.0 + bH + 3.2, bZ);
      root.add(roof);
    }
  }

  // Cours Saleya Pedestrian Market Avenue (Between Old Town and Sea)
  const csX = 620, csZ = -40;
  box(promenadeStone, 'nice_cours_saleya_paving', csX, 6.1, csZ, 340, 0.25, 26);
  // Striped Provencal Market Canopies (Red/White & Yellow/White)
  for (let mi = -6; mi <= 6; mi++) {
    const mx = csX + mi * 24;
    const canMat = mi % 2 === 0 ? ironmanRed : markingYellow;
    box(steelWhite, 'market_stall_legs_' + mi, mx, 7.3, csZ, 14, 2.2, 8.5);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(9.5, 2.2, 4), canMat);
    canopy.name = 'market_canopy_' + mi;
    canopy.rotation.y = Math.PI / 4;
    canopy.position.set(mx, 8.8, csZ);
    root.add(canopy);
  }

  // =========================================================================
  // 8. PLACE MASSÉNA & PROMENADE DU PAILLON
  // Neoclassical red arcades & black/white checkerboard plaza (x = 360, z = -240)
  // =========================================================================
  const masX = 360, masZ = -240;

  // Checkerboard Pavers Plaza
  box(checkerboardDark, 'nice_place_massena_paving', masX, 6.1, masZ, 190, 0.25, 140);
  for (let cki = -4; cki <= 4; cki++) {
    for (let ckj = -3; ckj <= 3; ckj++) {
      if ((cki + ckj) % 2 === 0) {
        box(markingWhite, 'massena_checker_' + cki + '_' + ckj, masX + cki * 20, 6.24, masZ + ckj * 18, 19, 0.05, 17);
      }
    }
  }

  // Red Italianate Arcaded Facades enclosing Place Masséna
  box(massenaRed, 'massena_north_arcade', masX, 6.0 + 14, masZ - 72, 190, 28, 24);
  box(massenaRed, 'massena_east_arcade', masX + 98, 6.0 + 14, masZ, 22, 28, 140);
  box(massenaRed, 'massena_west_arcade', masX - 98, 6.0 + 14, masZ, 22, 28, 140);

  // Fontaine du Soleil & Apollo Marble Statue
  cyl(steelWhite, 'nice_fontaine_soleil_basin', masX, 6.8, masZ + 35, 14, 15, 1.4, 16);
  cyl(steelWhite, 'nice_fontaine_apollo_plinth', masX, 8.5, masZ + 35, 2.2, 2.6, 2.4, 12);
  cyl(negrescoWhite, 'nice_apollo_statue', masX, 11.2, masZ + 35, 0.6, 0.8, 4.2, 8);

  // =========================================================================
  // 9. PORT LYMPIA (HISTORIC PORT OF NICE) & CAFÉ DU CYCLISTE
  // East of Castle Hill at x = 1580, z = 180
  // =========================================================================
  const portX = 1580, portZ = 180;

  // Deep Port Basin
  box(portWater, 'nice_port_lympia_water', portX, 1.5, portZ, 260, 3.0, 360);
  // Stone Quays surrounding harbor (Quai des Deux Emmanuels, Quai Lunel)
  box(castleLimestone, 'port_quay_west', portX - 145, 4.2, portZ, 32, 4.5, 380);
  box(castleLimestone, 'port_quay_east', portX + 145, 4.2, portZ, 32, 4.5, 380);
  box(castleLimestone, 'port_quay_north', portX, 4.2, portZ - 195, 320, 4.5, 32);

  // Neoclassical Italianate Quayside Buildings
  box(vieuxNiceOchre, 'port_facade_east', portX + 180, 6.0 + 12, portZ, 38, 24, 340);
  box(vieuxNiceTerracotta, 'port_facade_west', portX - 180, 6.0 + 12, portZ, 38, 24, 340);

  // Café du Cycliste Clubhouse on the Port
  const cdcX = portX - 150, cdcZ = portZ - 40;
  box(ironmanBlack, 'nice_cafe_du_cycliste_store', cdcX, 6.0 + 6, cdcZ, 26, 12, 38);
  box(hotelGold, 'nice_cdc_sign', cdcX + 13.2, 6.0 + 9.5, cdcZ, 0.4, 1.8, 18);
  box(steelWhite, 'nice_cdc_espresso_terrace', cdcX + 18, 4.4, cdcZ, 14, 0.3, 26);

  // Moored Luxury Yachts & Traditional Provençal Pointu Boats
  for (let yi = -3; yi <= 3; yi++) {
    const yz = portZ + yi * 44;
    // Luxury yacht
    box(steelWhite, 'nice_yacht_hull_' + yi, portX - 45, 2.2, yz, 28, 3.2, 8.5);
    box(glassAzure, 'nice_yacht_cabin_' + yi, portX - 42, 4.8, yz, 16, 2.4, 7.0);
    // Pointu fishing boat
    const pMat = yi % 2 === 0 ? ironmanRed : markingYellow;
    box(pMat, 'nice_pointu_boat_' + yi, portX + 55, 1.8, yz, 9.5, 1.8, 4.2);
  }

  // =========================================================================
  // 10. NICE CÔTE D'AZUR AIRPORT (NCE / LFMN)
  // Reclaimed offshore runway peninsula jutting into Mediterranean (x = -4100, z = 850)
  // =========================================================================
  const nceX = -4100, nceZ = 850;
  const nceAngle = 0.38; // 044° runway alignment (Runways 04L / 04R)

  // Reclaimed Airport Island Base Slab
  box(airportAsphalt, 'nice_airport_peninsula_slab', nceX, 3.2, nceZ, 1450, 4.5, 3400, 0, nceAngle, 0);

  // Parallel Runway 04R / 22L (2,960m long x 45m wide)
  box(airportAsphalt, 'nice_runway_04R_22L', nceX + 60, 4.6, nceZ, 48, 0.2, 2960, 0, nceAngle, 0);
  // Parallel Runway 04L / 22R (2,570m long x 45m wide)
  box(airportAsphalt, 'nice_runway_04L_22R', nceX - 180, 4.6, nceZ, 48, 0.2, 2570, 0, nceAngle, 0);

  // Runway Centerlines
  for (const rwOffset of [60, -180]) {
    box(markingWhite, 'nice_rw_centerline_' + rwOffset, nceX + rwOffset, 4.75, nceZ, 1.8, 0.08, 2400, 0, nceAngle, 0);
  }

  // Terminal 1 and Terminal 2 Modernist Concourses
  box(steelWhite, 'nice_airport_terminal_1', nceX - 320, 4.5 + 8, nceZ - 450, 110, 16, 220, 0, nceAngle, 0);
  box(glassAzure, 'nice_airport_t1_glass', nceX - 315, 4.5 + 9, nceZ - 450, 112, 12, 210, 0, nceAngle, 0);

  box(steelWhite, 'nice_airport_terminal_2', nceX - 360, 4.5 + 9, nceZ + 350, 140, 18, 310, 0, nceAngle, 0);
  box(glassAzure, 'nice_airport_t2_glass', nceX - 355, 4.5 + 10, nceZ + 350, 142, 14, 300, 0, nceAngle, 0);

  // Air Traffic Control Tower (distinctive red and white cab)
  cyl(steelWhite, 'nice_atc_shaft', nceX - 260, 4.5 + 24, nceZ - 100, 3.8, 4.8, 48, 12);
  cyl(glassAzure, 'nice_atc_cab', nceX - 260, 4.5 + 49, nceZ - 100, 7.2, 5.8, 5.0, 12);

  // Parked Air France & British Airways A320s at gates
  for (const [planeName, pX, pZ, isAF] of [['AF_1', nceX - 250, nceZ + 240, true], ['BA_1', nceX - 250, nceZ + 380, false]]) {
    const plane = new THREE.Group();
    plane.name = 'nice_airliner_' + planeName;
    plane.position.set(pX, 7.2, pZ);
    plane.rotation.y = nceAngle + Math.PI / 2;
    // Fuselage
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 36, 14), steelWhite);
    fuse.rotation.z = Math.PI / 2;
    plane.add(fuse);
    // Tail fin
    const tailMat = isAF ? airFranceBlue : ironmanRed;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(4.5, 7.2, 0.35), tailMat);
    fin.position.set(15.5, 4.2, 0);
    fin.rotation.z = -0.32;
    plane.add(fin);
    // Wings
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.35, 14.0), steelWhite);
      wing.position.set(-2, -0.4, side * 8.2);
      wing.rotation.y = -side * 0.35;
      plane.add(wing);
    }
    root.add(plane);
  }

  // =========================================================================
  // 11. COL DE VENCE & MARITIME ALPS HINTERLAND BIKE CLIMB
  // Mountain gateway rising to the northwest (x = -3200 to -6500, z = -2500 to -5500)
  // =========================================================================
  const alpX = -4500, alpZ = -3800;

  // Mountain Massifs
  for (let mi = 0; mi < 5; mi++) {
    const mAngle = (mi / 5) * Math.PI;
    const mDist = 600 + mi * 280;
    const mx = alpX + Math.cos(mAngle) * mDist;
    const mz = alpZ + Math.sin(mAngle) * mDist;
    const mH = 420 + mi * 130;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(520, mH, 6), castleLimestone);
    mountain.name = 'nice_alps_peak_' + mi;
    mountain.position.set(mx, mH * 0.5, mz);
    mountain.rotation.y = mi * 0.4;
    root.add(mountain);
  }

  // Winding Switchback Road (Col de Vence Bike Route)
  const hairpins = [
    [alpX + 350, alpZ + 450, 45],
    [alpX + 150, alpZ + 200, 110],
    [alpX + 420, alpZ - 50, 180],
    [alpX + 220, alpZ - 320, 260],
    [alpX + 510, alpZ - 580, 350],
    [alpX + 310, alpZ - 850, 440]
  ];
  hairpins.forEach(([hx, hz, hy], idx) => {
    box(asphaltRoad, 'col_de_vence_hairpin_' + idx, hx, hy, hz, 38, 1.2, 140, 0.08, idx * 0.8, 0.05);
    // White safety barriers lining the cliff edge
    box(steelWhite, 'col_de_vence_guardrail_' + idx, hx + 18, hy + 0.8, hz, 1.2, 0.9, 138, 0.08, idx * 0.8, 0.05);
    // Ironman 70.3 course banner
    if (idx % 2 === 0) {
      box(ironmanRed, 'col_de_vence_banner_' + idx, hx + 18.5, hy + 0.9, hz, 0.4, 0.75, 45, 0.08, idx * 0.8, 0.05);
    }
  });

  scene.add(root);
  return root;
}
