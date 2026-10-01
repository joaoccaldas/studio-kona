// Modular Live Flight Tracking & Approach Simulation for KOA Airport
// Integrates with OpenSky Network ADS-B transponders and animates 3D aircraft approaches.

export async function fetchKoaAirspaceTransponders() {
  // Bounding box for West Hawaii / Kona airspace
  const url = 'https://opensky-network.org/api/states/all?lamin=19.4&lomin=-156.3&lamax=20.2&lomax=-155.7';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.states)) return [];

    return data.states.map(s => ({
      icao24: s[0],
      callsign: (s[1] || '').trim(),
      country: s[2],
      lon: s[5],
      lat: s[6],
      baroAltitudeM: s[7],
      onGround: s[8] === true,
      velocityMps: s[9],
      headingDeg: s[10],
      verticalRateMps: s[11]
    })).filter(s => s.lat != null && s.lon != null);
  } catch (err) {
    // OpenSky can be rate-limited (HTTP 429) or offline. Return empty array to trigger smooth fallback.
    return [];
  }
}

export class LiveFlightController {
  constructor({ scene, THREE, W, toLocal, heightAt, pollIntervalMs = 30000, onFlightStateChange = null }) {
    this.scene = scene;
    this.THREE = THREE;
    this.W = W;
    this.toLocal = toLocal;
    this.heightAt = heightAt;
    this.pollIntervalMs = pollIntervalMs;
    this.onFlightStateChange = onFlightStateChange;

    this.activeFlights = new Map();
    this.timer = null;
    this.simulatedApproach = null;
    this.simT = 0;

    // Materials for 3D approach aircraft
    this.fuselageMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.2 });
    this.hawaiianPurple = new THREE.MeshStandardMaterial({ color: 0x3c1053, roughness: 0.35 });
    this.hawaiianMagenta = new THREE.MeshStandardMaterial({ color: 0xc71585, roughness: 0.4 });
    this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    this.navGreen = new THREE.MeshBasicMaterial({ color: 0x10b981 });

    // Airport center in local coordinates
    this.koaX = -4769;
    this.koaY = 11582;
  }

  start() {
    this.poll();
    if (typeof window !== 'undefined') {
      this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.simulatedApproach?.mesh) {
      this.scene.remove(this.simulatedApproach.mesh);
      this.simulatedApproach = null;
    }
  }

  async poll() {
    const liveStates = await fetchKoaAirspaceTransponders();
    if (liveStates.length) {
      this.syncLiveAirspace(liveStates);
    } else if (!this.simulatedApproach) {
      this.initContinuousApproachSim();
    }
  }

  syncLiveAirspace(states) {
    if (typeof this.onFlightStateChange === 'function') {
      this.onFlightStateChange({ mode: 'live_adsb', count: states.length, states });
    }
    // If an aircraft is within 20km of KOA, attach or update approach simulation
    const nearby = states.find(s => !s.onGround && Math.hypot(s.lat - 19.7388, s.lon - (-156.0456)) < 0.25);
    if (nearby && !this.simulatedApproach) {
      this.spawnApproachAircraft(nearby.callsign || 'HA 128');
    }
  }

  initContinuousApproachSim() {
    // Continuously simulate authentic Hawaiian Airlines B717 arrival loop
    this.spawnApproachAircraft('HA 128 (Honolulu → Kona)');
  }

  spawnApproachAircraft(callsign) {
    if (this.simulatedApproach?.mesh) {
      this.scene.remove(this.simulatedApproach.mesh);
    }

    const THREE = this.THREE;
    const g = new THREE.Group();
    g.name = 'LIVE_APPROACH_AIRCRAFT';

    // 1:1 scale twinjet airliner (Boeing 717 / Airbus A220 class)
    // Fuselage length 38m, wingspan 28m
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 36, 16), this.fuselageMat);
    body.rotation.x = Math.PI / 2;
    g.add(body);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5.5, 16), this.fuselageMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -20.5;
    g.add(nose);

    // Main wings
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.28, 4.5), this.fuselageMat);
    wingL.position.set(-8, -0.2, 1);
    wingL.rotation.y = 0.22;
    g.add(wingL);

    const wingR = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.28, 4.5), this.fuselageMat);
    wingR.position.set(8, -0.2, 1);
    wingR.rotation.y = -0.22;
    g.add(wingR);

    // T-Tail empennage with Hawaiian Airlines Purple & Magenta
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.5, 4.5), this.hawaiianPurple);
    fin.position.set(0, 3.8, 15);
    fin.rotation.x = -0.25;
    g.add(fin);

    const pualaniFlower = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 2.2), this.hawaiianMagenta);
    pualaniFlower.position.set(0, 5.2, 15.5);
    g.add(pualaniFlower);

    const hStab = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.22, 2.8), this.fuselageMat);
    hStab.position.set(0, 6.8, 16.5);
    g.add(hStab);

    // Navigation wingtip lights
    const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), this.beaconMat);
    redLight.position.set(-14.5, -0.2, 2);
    g.add(redLight);

    const grnLight = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), this.navGreen);
    grnLight.position.set(14.5, -0.2, 2);
    g.add(grnLight);

    this.scene.add(g);

    this.simulatedApproach = {
      mesh: g,
      callsign,
      progress: 0, // 0 = 6 miles out, 0.7 = touchdown, 1.0 = turned off runway
      speed: 0.012 // progress per second
    };
  }

  update(dt, activeRunway = '17') {
    if (!this.simulatedApproach?.mesh) return;

    const s = this.simulatedApproach;
    s.progress += s.speed * dt;
    if (s.progress > 1.25) {
      s.progress = 0; // restart approach cycle
    }

    const is17 = activeRunway === '17';
    // Runway 17 approach comes from the North (cy + 7500 down to cy)
    // Runway 35 approach comes from the South (cy - 7500 up to cy)
    const startY = is17 ? this.koaY + 8000 : this.koaY - 8000;
    const touchY = is17 ? this.koaY + 600 : this.koaY - 600;
    const endY = is17 ? this.koaY - 800 : this.koaY + 800;

    let curX = this.koaX - 55; // Runway 17/35 centerline offset
    let curY, curAlt, pitch = 0, yaw = is17 ? Math.PI : 0;

    if (s.progress < 0.7) {
      // Final approach along 3-degree glide slope
      const t = s.progress / 0.7;
      curY = startY + (touchY - startY) * t;
      curAlt = 420 * (1 - t) + 18.5; // descends to runway threshold elevation ~18.5m
      pitch = -0.052; // 3 degree nose-up descent attitude
    } else if (s.progress < 0.95) {
      // Ground rollout on runway
      const t = (s.progress - 0.7) / 0.25;
      curY = touchY + (endY - touchY) * t;
      curAlt = 18.5;
      pitch = 0;
    } else {
      // Turn off runway onto high-speed exit taxiway
      const t = (s.progress - 0.95) / 0.3;
      curY = endY + (is17 ? -150 : 150) * t;
      curX = (this.koaX - 55) + 65 * Math.sin(t * Math.PI * 0.5);
      curAlt = 18.5;
      yaw += (is17 ? -0.45 : 0.45) * t;
    }

    const pos = this.W(curX, curY, curAlt);
    s.mesh.position.copy(pos);
    s.mesh.rotation.set(pitch, yaw, 0);
  }
}
