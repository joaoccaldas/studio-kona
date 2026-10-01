// Modular Flight Information Display System (FIDS) for KOA & Airport Worlds
// Renders dynamic, glowing flight arrival/departure boards onto Three.js CanvasTextures.

export function generateKoaFlightSchedule(baseTime = new Date()) {
  const hstHours = (baseTime.getUTCHours() - 10 + 24) % 24;
  const hstMins = baseTime.getUTCMinutes();

  const flightTemplates = [
    { num: 'HA 128', airline: 'Hawaiian', from: 'Honolulu (HNL)', gate: '03', offsetMin: -25, status: 'LANDED' },
    { num: 'UA 1724', airline: 'United', from: 'San Francisco (SFO)', gate: '08', offsetMin: -10, status: 'LANDED' },
    { num: 'WN 1845', airline: 'Southwest', from: 'Oakland (OAK)', gate: '06', offsetMin: 5, status: 'ON TIME' },
    { num: 'AA 247', airline: 'American', from: 'Los Angeles (LAX)', gate: '09', offsetMin: 18, status: 'ON TIME' },
    { num: 'DL 588', airline: 'Delta', from: 'Seattle (SEA)', gate: '07', offsetMin: 32, status: 'ON TIME' },
    { num: 'HA 244', airline: 'Hawaiian', from: 'Kahului (OGG)', gate: '02', offsetMin: 45, status: 'ON TIME' },
    { num: 'AS 839', airline: 'Alaska', from: 'San Jose (SJC)', gate: '10', offsetMin: 60, status: 'ON TIME' },
    { num: '5X 2462', airline: 'UPS Cargo', from: 'Honolulu (HNL)', gate: 'CARGO', offsetMin: -40, status: 'LANDED' }
  ];

  return flightTemplates.map(f => {
    let m = hstMins + f.offsetMin;
    let h = (hstHours + Math.floor(m / 60) + 24) % 24;
    m = ((m % 60) + 60) % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    let status = f.status;
    if (f.offsetMin < -15) status = 'LANDED';
    else if (f.offsetMin <= 0) status = 'ARRIVED';
    else if (f.offsetMin <= 15) status = 'FINAL';
    else status = 'ON TIME';
    return { ...f, time: timeStr, status };
  });
}

export class FidsBoardRenderer {
  constructor({ width = 1024, height = 512, title = 'ELLISON ONIZUKA KONA INTERNATIONAL (KOA)' } = {}) {
    this.width = width;
    this.height = height;
    this.title = title;
    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d');
    }
    this.texture = null;
    this.flights = generateKoaFlightSchedule();
  }

  getTexture(THREE) {
    if (!this.canvas) return null;
    if (!this.texture && THREE) {
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.anisotropy = 4;
    }
    this.render();
    return this.texture;
  }

  updateFlights(newFlights) {
    if (Array.isArray(newFlights) && newFlights.length) {
      this.flights = newFlights;
    } else {
      this.flights = generateKoaFlightSchedule();
    }
    this.render();
    if (this.texture) this.texture.needsUpdate = true;
  }

  render() {
    if (!this.ctx) return;
    const { ctx, width: W, height: H } = this;

    // Dark charcoal aviation FIDS background
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(0, 0, W, H);

    // Deep forest green Hawaiian title banner
    ctx.fillStyle = '#093a23';
    ctx.fillRect(0, 0, W, 58);

    // Top gold accent line
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 56, W, 3);

    // Title text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.letterSpacing = '0.08em';
    ctx.fillText(this.title, 24, 38);

    // Clock
    const now = new Date();
    const hstHours = (now.getUTCHours() - 10 + 24) % 24;
    const timeStr = `${String(hstHours).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} HST`;
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(timeStr, W - 140, 38);

    // Subheader
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 59, W, 34);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('FLIGHT', 24, 82);
    ctx.fillText('AIRLINE', 140, 82);
    ctx.fillText('ORIGIN', 310, 82);
    ctx.fillText('TIME', 590, 82);
    ctx.fillText('GATE', 690, 82);
    ctx.fillText('STATUS', 790, 82);

    // Table rows
    const startY = 118;
    const rowHeight = 44;

    this.flights.forEach((f, i) => {
      const y = startY + i * rowHeight;
      // Alternate row shading
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent';
      ctx.fillRect(12, y - 26, W - 24, 38);

      // Flight num (bright amber LED matrix tone)
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(f.num, 24, y);

      // Airline
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '500 16px system-ui, sans-serif';
      ctx.fillText(f.airline, 140, y);

      // Origin
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(f.from, 310, y);

      // Time
      ctx.fillStyle = '#fbbf24';
      ctx.font = '600 17px monospace';
      ctx.fillText(f.time, 590, y);

      // Gate
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 17px monospace';
      ctx.fillText(f.gate, 700, y);

      // Status badge
      let badgeColor = '#10b981'; // green for landed
      if (f.status === 'ON TIME') badgeColor = '#f59e0b'; // amber
      else if (f.status === 'FINAL') badgeColor = '#06b6d4'; // cyan
      else if (f.status === 'DELAYED') badgeColor = '#ef4444'; // red

      ctx.fillStyle = badgeColor;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(f.status, 790, y);
    });

    // Bottom status bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('LIVE KOA AIRSPACE RADAR FEED · ADS-B EQUIPPED AIRCRAFT · 100% MOBILE PASSENGER AIRSTAIRS', 24, H - 10);
  }

  createTotemMesh({ THREE, x = 0, y = 0, z = 0, height = 4.2 } = {}) {
    if (!THREE) return null;
    const g = new THREE.Group();
    g.name = 'KOA_FIDS_TOTEM';
    g.position.set(x, z, -y);

    const tex = this.getTexture(THREE);
    const screenMat = new THREE.MeshBasicMaterial({ map: tex });
    const casingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.7 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.8 });

    // Dual support posts
    for (const px of [-1.8, 1.8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, height, 0.18), postMat);
      post.position.set(px, height * 0.5, 0);
      g.add(post);
    }

    // Outer screen enclosure
    const w = 4.2, h = 2.1, d = 0.28;
    const casing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, h + 0.15, d), casingMat);
    casing.position.set(0, height - h * 0.5 - 0.2, 0);
    g.add(casing);

    // Front display face
    const screenFront = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screenFront.position.set(0, height - h * 0.5 - 0.2, d * 0.5 + 0.01);
    g.add(screenFront);

    // Back display face
    const screenBack = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screenBack.rotation.y = Math.PI;
    screenBack.position.set(0, height - h * 0.5 - 0.2, -d * 0.5 - 0.01);
    g.add(screenBack);

    return g;
  }
}
