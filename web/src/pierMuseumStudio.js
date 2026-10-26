import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { rimTexture, tyreTexture } from './tex.js';

// Heritage bikes database with 3D model references and pro athlete records
export const PIER_HERITAGE_BIKES = [
  {
    year: '1982',
    name: 'Vintage Steel Road Bike & Bib #185',
    category: 'Pioneer Era',
    proAthlete: 'Julie Moss & Kathleen McCartney',
    splitTime: '11:10:09',
    bikeTime: '5:53:00',
    modelFile: 'speedmax_2005.glb',
    brand: 'Custom Lugged Steel',
    colorPreset: '#991122',
    finish: 'gloss',
    summary: 'The race that ignited modern triathlon. Julie Moss collapsed 15 feet from the line, crawling to the finish while ABC broadcast the drama globally.',
    specs: {
      frame: 'Lugged Columbus SL Steel Tube',
      drivetrain: 'Campagnolo Super Record 6-speed down-tube friction',
      wheels: '36-Spoke Mavic Monthlery Pro Box Rims',
      aerobars: 'Traditional drop bars with toe-clips (pre-aerobar era)',
      weight: '10.8 kg'
    },
    proWinner: {
      male: { name: 'Scott Tinley', country: 'USA', time: '9:19:41' },
      female: { name: 'Kathleen McCartney', country: 'USA', time: '11:09:40' }
    }
  },
  {
    year: '1989',
    name: 'Centurion Iron War Special',
    category: 'The Iron War',
    proAthlete: 'Dave Scott & Mark Allen',
    splitTime: '8:09:15 (Course Record)',
    bikeTime: '4:37:52',
    modelFile: 'trek_equinox_2004.glb',
    brand: 'Centurion / Scott DH',
    colorPreset: '#e62233',
    finish: 'gloss',
    summary: 'The greatest duel in endurance history. Dave Scott and Mark Allen ran shoulder-to-shoulder for 139 miles, shattering the course record by 19 minutes.',
    specs: {
      frame: 'Tange Prestige Double-Butted Chromoly / Aluminum',
      drivetrain: 'Shimano Dura-Ace 7400 7-Speed SIS',
      wheels: 'Aero 32-spoke radial front, disc rear',
      aerobars: 'Original Scott DH Clip-On Aero Extensions',
      weight: '9.4 kg'
    },
    proWinner: {
      male: { name: 'Mark Allen', country: 'USA', time: '8:09:15' },
      female: { name: 'Paula Newby-Fraser', country: 'ZIM', time: '9:01:01' }
    }
  },
  {
    year: '2004',
    name: 'Trek Equinox 9 TT',
    category: 'Carbon Aerodynamic Revolution',
    proAthlete: 'Normann Stadler & Tim DeBoom era',
    splitTime: '8:33:29',
    bikeTime: '4:37:58',
    modelFile: 'trek_equinox_2004.glb',
    brand: 'Trek OCLV Carbon',
    colorPreset: '#111111',
    finish: 'gloss',
    summary: 'The start of the extreme aero bike split era. Normann Stadler "The Normannator" dominated the Queen K crosswinds on carbon aero tubes.',
    specs: {
      frame: 'OCLV 120 Carbon Aerodynamic Monocoque',
      drivetrain: 'Shimano Dura-Ace 7800 10-Speed Bar-End',
      wheels: 'Bontrager Aeolus 6.5 Carbon Clinchers',
      aerobars: 'Bontrager Race X Lite Integrated Aerobars',
      weight: '8.6 kg'
    },
    proWinner: {
      male: { name: 'Normann Stadler', country: 'GER', time: '8:33:29' },
      female: { name: 'Natascha Badmann', country: 'SUI', time: '9:50:04' }
    }
  },
  {
    year: '2005',
    name: 'Canyon Speedmax Three',
    category: 'Canyon Heritage Debut',
    proAthlete: 'Faris Al-Sultan Era',
    splitTime: '8:14:17',
    bikeTime: '4:25:24',
    modelFile: 'speedmax_2005.glb',
    brand: 'Canyon Bicycles Koblenz',
    colorPreset: '#2a4468',
    finish: 'gloss',
    summary: 'Canyon enters the global triathlon pantheon with precision engineered German aluminum aero tubing and wind tunnel optimized tube profiles.',
    specs: {
      frame: 'Ultralight 7005 Aluminum Aero Aerofoil',
      drivetrain: 'Campagnolo Record 10-Speed TT',
      wheels: 'Mavic Cosmic Carbone Deep Section',
      aerobars: 'Syntace C2 Clip-On Aero Bar System',
      weight: '8.5 kg'
    },
    proWinner: {
      male: { name: 'Faris Al-Sultan', country: 'GER', time: '8:14:17' },
      female: { name: 'Natascha Badmann', country: 'SUI', time: '9:54:02' }
    }
  },
  {
    year: '2007',
    name: 'Canyon Speedmax CF 2007',
    category: 'Carbon Monocoque Generation',
    proAthlete: 'Chris McCormack & Chrissie Wellington',
    splitTime: '8:15:34',
    bikeTime: '4:37:32',
    modelFile: 'speedmax_2007.glb',
    brand: 'Canyon Bicycles',
    colorPreset: '#ffffff',
    finish: 'matte',
    summary: 'Full high-modulus carbon frame with integrated seat mast and horizontal rear dropouts to hug the rear tire aerodynamic boundary layer.',
    specs: {
      frame: 'Canyon High Modulus Carbon Monocoque',
      drivetrain: 'SRAM Red 10-Speed DoubleTap',
      wheels: 'Zipp 808 Firecrest Carbon Tubular',
      aerobars: 'Profile Design Carbon X Aerobar Cockpit',
      weight: '8.1 kg'
    },
    proWinner: {
      male: { name: 'Chris McCormack', country: 'AUS', time: '8:15:34' },
      female: { name: 'Chrissie Wellington', country: 'GBR', time: '9:08:45' }
    }
  },
  {
    year: '2011',
    name: 'Canyon Speedmax AL / CF 2011',
    category: 'Course Record Benchmark',
    proAthlete: 'Craig Alexander (Crowie)',
    splitTime: '8:03:56 (Historic Record)',
    bikeTime: '4:24:05',
    modelFile: 'speedmax_2011_cf.glb',
    brand: 'Canyon Bicycles',
    colorPreset: '#181818',
    finish: 'gloss',
    summary: 'Craig Alexander becomes the first man to break 8:04 in Kona, pairing aerodynamic low stack geometry with blistering speed on the Queen K.',
    specs: {
      frame: 'Full Carbon Aero Modular Platform',
      drivetrain: 'Shimano Dura-Ace Di2 7970 Electronic TT',
      wheels: 'Shimano Dura-Ace C75 Front / Pro Disc Rear',
      aerobars: 'Integrated Canyon Stealth Aero Cockpit',
      weight: '7.9 kg'
    },
    proWinner: {
      male: { name: 'Craig Alexander', country: 'AUS', time: '8:03:56' },
      female: { name: 'Chrissie Wellington', country: 'GBR', time: '8:55:08' }
    }
  },
  {
    year: '2018',
    name: 'Patrick Lange Sub-8 Superbike',
    category: 'Sub-8 Hour Barrier',
    proAthlete: 'Patrick Lange',
    splitTime: '7:52:39 (World Record)',
    bikeTime: '4:16:05',
    modelFile: 'speedmax_2019_slx.glb',
    brand: 'Canyon Speedmax / Custom Pro',
    colorPreset: '#d8a010',
    finish: 'matte',
    summary: 'The historic day the 8-hour barrier was breached. Patrick Lange rode 4:16:05 and ran a 2:41:27 marathon to set the world ablaze.',
    specs: {
      frame: 'Canyon Speedmax CF SLX Carbon Aero',
      drivetrain: 'Shimano Dura-Ace Di2 9150 11-Speed Electronic',
      wheels: 'DT Swiss ARC 1100 Dicut 80mm Carbon',
      aerobars: 'Custom 3D-Printed Titanium Forearm Armrests',
      weight: '8.2 kg'
    },
    proWinner: {
      male: { name: 'Patrick Lange', country: 'GER', time: '7:52:39' },
      female: { name: 'Daniela Ryf', country: 'SUI', time: '8:26:18' }
    }
  },
  {
    year: '2019',
    name: 'Jan Frodeno · Canyon Speedmax (XL)',
    category: 'Course record 7:51:13',
    proAthlete: 'Jan Frodeno',
    splitTime: '7:51:13 (course record at the time)',
    bikeTime: '4:16:02',
    modelFile: 'speedmax_2019_slx.glb',
    brand: 'Canyon Bicycles',
    colorPreset: '#0a101d',
    finish: 'matte',
    frameSize: 'XL',
    rearWheel: 'spoked',
    confidence: 'sourced',
    summary: 'Frodeno swam 47:31, rode 4:16:02 and ran 2:42:43 to win his third world title with a new course record. He raced a size-XL Speedmax with Zipp 858 wheels front and rear, not a disc.',
    specs: {
      frame: 'Canyon Speedmax, size XL',
      drivetrain: 'SRAM Red eTap AXS 1x, Quarq power meter',
      wheels: 'Zipp 858 NSW front and rear',
      tyres: 'Continental Grand Prix 5000 TL',
      aerobars: 'Canyon custom cockpit',
      weight: 'not published'
    },
    sources: [
      'https://www.slowtwitch.com/news/kona-2019-top-15-men-bike-gear/',
      'https://en.wikipedia.org/wiki/2019_Ironman_World_Championship'
    ],
    proWinner: {
      male: { name: 'Jan Frodeno', country: 'GER', time: '7:51:13', race: 'Kona' },
      female: { name: 'Anne Haug', country: 'GER', time: '8:40:10', race: 'Kona' }
    }
  },
  {
    year: '2023',
    name: 'Speedmax CFR · 2023 platform',
    category: 'Kona hosted the women’s race only',
    proAthlete: null,
    splitTime: null,
    bikeTime: null,
    modelFile: 'speedmax_2027_cfr.glb',
    brand: 'Canyon Bicycles CFR',
    colorPreset: '#00d2ff',
    finish: 'gloss',
    rearWheel: 'spoked',
    confidence: 'partial',
    summary: 'In 2023 the world championship split: the women raced in Kona and the men in Nice. Lucy Charles-Barclay won Kona in a course-record 8:24:31 with the fastest bike split (4:32:29) — on a CUBE Aerium C:68X, not a Canyon. She belongs in the Bikes of Kona hall, not the Canyon wing.',
    specs: {
      frame: 'Canyon Speedmax CFR (platform shown for reference)',
      drivetrain: 'varies by athlete',
      wheels: 'varies by athlete',
      aerobars: 'varies by athlete',
      weight: 'not published'
    },
    sources: [
      'https://www.triathlete.com/gallery/2023-hawaii-ironman-world-championship-bike-lucy-charles-barclays-cube-aerium-c68x/'
    ],
    proWinner: {
      female: { name: 'Lucy Charles-Barclay', country: 'GBR', time: '8:24:31', race: 'Kona', bike: 'CUBE Aerium C:68X (not Canyon)' }
    }
  },
  {
    year: '2024',
    name: 'Patrick Lange · Canyon Speedmax CFR (S)',
    category: 'Course record 7:35:53',
    proAthlete: 'Patrick Lange',
    splitTime: '7:35:53 (course record)',
    bikeTime: '4:06:22',
    modelFile: 'speedmax_2027_cfr.glb',
    brand: 'Canyon Bicycles CFR',
    colorPreset: '#ffcc33',
    finish: 'matte',
    frameSize: 'S',
    rearWheel: 'spoked',
    confidence: 'partial',
    summary: 'Lange was 13th off the bike, 9:06 down, then ran 2:37:34 to take his third title in a course-record 7:35:53. His race bike used a prototype monocoque Canyon cockpit, so the consumer CFR model shown here is a stand-in until that cockpit is reconstructed.',
    specs: {
      frame: 'Canyon Speedmax CFR, size S, custom paint',
      drivetrain: 'Shimano Dura-Ace Di2 12-speed, SRM PM9 165 mm with a single 60T ring, 11-30, CeramicSpeed OSPW',
      wheels: 'Swiss Side Hadron Ultimate 800 front and rear',
      tyres: 'Schwalbe Pro One Aero, 26 mm front / 28 mm rear',
      aerobars: 'Prototype Canyon monocoque cockpit (pro-only)',
      weight: 'not published'
    },
    sources: [
      'https://www.triathlete.com/ironman-world-championship-2024-kona/patrick-lange-ironman-kona-bike-2024/',
      'https://www.triathlete.com/ironman-world-championship-2024-kona/patrick-lange-wins-ironman-world-championship-kona-2024-course-record/'
    ],
    proWinner: {
      male: { name: 'Patrick Lange', country: 'GER', time: '7:35:53', race: 'Kona' }
    }
  }
];

export function createPierMuseumStudio(ctx) {
  const { scene, camera, W, heightAt, toast } = ctx;
  const prog = () => (ctx.progress ? ctx.progress() : null);
  const bikeOpen = b => !prog() || prog().isBikeUnlocked(b);
  const silhouetteMat = new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 0.9, metalness: 0 });

  let activeBikeIndex = 7; // Jan Frodeno 2019 default
  let studioScene, studioCamera, studioRenderer, studioControls;
  let studioAnimId = null;
  let currentStudioMesh = null;
  let currentMaterialClones = [];
  let isTurntableActive = false;

  // 1. Setup in-world 3D pedestals on Kailua Pier
  const pedestalGroup = new THREE.Group();
  pedestalGroup.name = 'PierMuseumPedestals';
  scene.add(pedestalGroup);

  const pierAnchorX = -6.0;
  const pierAnchorY = 6.0;
  const pierZ = 2.25;

  PIER_HERITAGE_BIKES.forEach((bike, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const posX = pierAnchorX + (col - 2) * 5.2;
    const posY = pierAnchorY + (row * 6.5) - 4.0;
    const posZ = pierZ;

    const g = new THREE.Group();
    g.position.copy(W(posX, posY, posZ));

    // Octagonal base plinth
    const plinthGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.28, 8);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x14202e,
      roughness: 0.35,
      metalness: 0.85
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.14;
    g.add(plinth);

    // Glowing accent ring
    const ringGeo = new THREE.RingGeometry(1.4, 1.55, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xbde9d9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.29;
    g.add(ring);

    // Miniature display bike placeholder
    const previewBikeGeo = new THREE.BoxGeometry(1.8, 0.9, 0.25);
    const previewBikeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bike.colorPreset),
      roughness: 0.4,
      metalness: 0.6
    });
    const pMesh = new THREE.Mesh(previewBikeGeo, previewBikeMat);
    pMesh.position.y = 0.8;
    g.add(pMesh);

    // Billboard title badge (Distance-attenuated, only visible when near pier)
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 140;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(16, 21, 27, 0.92)';
    c.roundRect(10, 10, 492, 120, 18);
    c.fill();
    c.strokeStyle = '#bde9d9';
    c.lineWidth = 4;
    c.roundRect(10, 10, 492, 120, 18);
    c.stroke();

    c.font = 'bold 36px system-ui, sans-serif';
    c.fillStyle = '#bde9d9';
    c.fillText(`${bike.year} · ${bike.brand.split('/')[0]}`, 28, 54);

    c.font = '28px system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.fillText(`${bike.name.slice(0, 24)}`, 28, 98);

    const spMat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv),
      depthTest: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95
    });
    const sp = new THREE.Sprite(spMat);
    sp.position.set(0, 2.5, 0);
    sp.scale.set(3.4, 0.95, 1);
    sp.renderOrder = 10;
    sp.visible = false;
    g.add(sp);

    g.userData = {
      isBikePedestal: true,
      bikeIndex: i,
      bike,
      sprite: sp
    };

    pedestalGroup.add(g);
  });

  setupStudioDOM();

  function setupStudioDOM() {
    if (document.querySelector('#canyonStudioModal')) return;

    const modal = document.createElement('div');
    modal.id = 'canyonStudioModal';
    modal.className = 'canyon-studio-overlay';
    modal.innerHTML = `
      <!-- Fullscreen 3D Canvas Stage -->
      <canvas id="studio3DCanvas" class="canyon-canvas-stage"></canvas>

      <!-- Top Header (Left-aligned) -->
      <header class="canyon-top">
        <div class="canyon-title">
          <button type="button" class="canyon-back" id="studioCloseBtn">← Return to Kailua Pier</button>
          <div class="eyebrow" id="studioEyebrow">CANYON MUSEUM · 2019 · EXHIBIT 8</div>
          <h1 id="studioBikeTitle">Jan Frodeno<br><span>Canyon Speedmax CF SLX</span></h1>
          <p id="studioProTag">Course Record: 7:51:13 · 4:16:03 Bike Split · Kailua-Kona, Hawaiʻi</p>
        </div>
      </header>

      <!-- Right-side Floating Frosted Glass Panel -->
      <aside class="canyon-panel" id="studioPanel">
        <div class="canyon-tabs" role="tablist">
          <button role="tab" aria-selected="true" data-tab="exhibit">Exhibit</button>
          <button role="tab" aria-selected="false" data-tab="custom">Customise</button>
          <button role="tab" aria-selected="false" data-tab="specs">Specs</button>
          <button role="tab" aria-selected="false" data-tab="pros">Champions</button>
        </div>

        <!-- Tab 1: Exhibit Details -->
        <section class="canyon-pane" data-pane="exhibit" id="panelExhibit">
          <div class="canyon-athlete-card" id="studioAthleteCard">
            <div class="canyon-athlete-avatar">🏆</div>
            <div class="canyon-athlete-info">
              <b id="studioAthleteName">Jan Frodeno</b>
              <small id="studioAthleteSplit">Kona Split: 7:51:13 (Course Record)</small>
              <div class="canyon-athlete-credit">Kailua Pier Legend</div>
            </div>
          </div>

          <div class="canyon-stat-grid">
            <div class="canyon-stat-box"><b id="statWeight">8.1 kg</b><small>Weight</small></div>
            <div class="canyon-stat-box"><b id="statBikeTime">4:16:03</b><small>Bike Split</small></div>
            <div class="canyon-stat-box"><b id="statTotalTime">7:51:13</b><small>Total Time</small></div>
          </div>

          <h2>Generation Story</h2>
          <p id="studioStoryBox" style="color:#94a2ad;margin:0 0 4px;font-size:12.5px;line-height:1.6;">...</p>

          <h2>Key Components</h2>
          <dl class="canyon-kv" id="studioQuickSpecs"></dl>
        </section>

        <!-- Tab 2: Customization -->
        <section class="canyon-pane" data-pane="custom" id="panelCustom" hidden>
          <h2>Frame Finish & Paint Color</h2>
          <div class="canyon-swatches" id="colorPalette">
            <button type="button" class="canyon-swatch active" style="--c:#ffcc33" data-col="#ffcc33" title="Kona Gold"></button>
            <button type="button" class="canyon-swatch" style="--c:#0a101d" data-col="#0a101d" title="Stealth Carbon"></button>
            <button type="button" class="canyon-swatch" style="--c:#e62233" data-col="#e62233" title="Flash Coral"></button>
            <button type="button" class="canyon-swatch" style="--c:#00d2ff" data-col="#00d2ff" title="Pacific Cyan"></button>
            <button type="button" class="canyon-swatch" style="--c:#ffffff" data-col="#ffffff" title="Arctic White"></button>
            <button type="button" class="canyon-swatch" style="--c:#bde9d9" data-col="#bde9d9" title="Canyon Mint"></button>
            <button type="button" class="canyon-swatch" style="--c:#2a9d8f" data-col="#2a9d8f" title="Island Sage"></button>
          </div>

          <h2>Surface Texture</h2>
          <div class="canyon-toggles">
            <button type="button" class="canyon-toggle-btn active" data-finish="matte">Matte Carbon</button>
            <button type="button" class="canyon-toggle-btn" data-finish="gloss">High Gloss</button>
          </div>

          <h2>Aero Wheelset Setup</h2>
          <div class="canyon-toggles">
            <button type="button" class="canyon-toggle-btn active" data-wheel="disc">DT Swiss ARC 1100 Disc</button>
            <button type="button" class="canyon-toggle-btn" data-wheel="dual80">Dual 80mm Deep Aero</button>
            <button type="button" class="canyon-toggle-btn" data-wheel="trispoke">Carbon Tri-Spoke Special</button>
          </div>
        </section>

        <!-- Tab 3: Detailed Specifications -->
        <section class="canyon-pane" data-pane="specs" id="panelSpecs" hidden>
          <h2>Complete Technical Spec</h2>
          <dl class="canyon-kv" id="studioSpecsTable"></dl>
        </section>

        <!-- Tab 4: Champions Per Year -->
        <section class="canyon-pane" data-pane="pros" id="panelPros" hidden>
          <h2>Kona World Champions</h2>
          <div id="studioProWinnersCard" style="display:flex;flex-direction:column;gap:12px;"></div>
        </section>
      </aside>

      <!-- Bottom Floating Control Dock -->
      <nav class="canyon-dock" aria-label="View controls">
        <button type="button" class="canyon-chip active" data-preset="hero">Three-quarter</button>
        <button type="button" class="canyon-chip" data-preset="side">Side</button>
        <button type="button" class="canyon-chip" data-preset="cockpit">Cockpit</button>
        <button type="button" class="canyon-chip" data-preset="drivetrain">Drivetrain</button>
        <button type="button" class="canyon-chip" id="studioSpinBtn" data-turntable="true">Turntable</button>
        <div class="canyon-dock-sep"></div>
        <div class="canyon-timeline-strip" id="timelineYearsBar"></div>
      </nav>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.querySelector('#studioCloseBtn');
    if (closeBtn) closeBtn.onclick = () => closeStudio();

    // Tab switching
    modal.querySelectorAll('.canyon-tabs button').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('.canyon-tabs button').forEach(b => b.setAttribute('aria-selected', 'false'));
        modal.querySelectorAll('.canyon-pane').forEach(p => p.hidden = true);
        btn.setAttribute('aria-selected', 'true');
        const tab = btn.dataset.tab;
        if (tab === 'exhibit') modal.querySelector('#panelExhibit').hidden = false;
        if (tab === 'custom') modal.querySelector('#panelCustom').hidden = false;
        if (tab === 'specs') modal.querySelector('#panelSpecs').hidden = false;
        if (tab === 'pros') modal.querySelector('#panelPros').hidden = false;
      };
    });

    // View presets
    modal.querySelectorAll('.canyon-chip[data-preset]').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('.canyon-chip[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setCameraPreset(btn.dataset.preset);
      };
    });

    // Turntable spin toggle
    const spinBtn = modal.querySelector('#studioSpinBtn');
    if (spinBtn) {
      spinBtn.onclick = () => {
        isTurntableActive = !isTurntableActive;
        spinBtn.classList.toggle('active', isTurntableActive);
        if (studioControls) studioControls.autoRotate = isTurntableActive;
      };
    }

    // Color Swatches
    modal.querySelectorAll('.canyon-swatch').forEach(dot => {
      dot.onclick = () => {
        const p = prog();
        if (p && !p.isColourUnlocked(dot.dataset.col)) {
          toast && toast(`🔒 ${dot.title}: ${p.colourHint(dot.dataset.col)}`);
          return;
        }
        modal.querySelectorAll('.canyon-swatch').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        applyFrameColor(dot.dataset.col);
      };
    });

    // Finish Toggles
    modal.querySelectorAll('.canyon-toggle-btn[data-finish]').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('.canyon-toggle-btn[data-finish]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFinish(btn.dataset.finish);
      };
    });

    // Aero Wheelset Toggles
    modal.querySelectorAll('.canyon-toggle-btn[data-wheel]').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('.canyon-toggle-btn[data-wheel]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyWheelset(btn.dataset.wheel);
      };
    });

    renderTimelineBar();
    initStudio3DCanvas();
  }

  function renderTimelineBar() {
    const bar = document.querySelector('#timelineYearsBar');
    if (!bar) return;

    bar.innerHTML = PIER_HERITAGE_BIKES.map((b, i) => `
      <button type="button" class="canyon-year-chip ${i === activeBikeIndex ? 'active' : ''} ${bikeOpen(b) ? '' : 'locked'}" data-idx="${i}"
        title="${bikeOpen(b) ? b.name : 'Locked · ' + (prog() ? prog().bikeHint(b) : '')}">
        ${bikeOpen(b) ? '' : '🔒 '}${b.year}
      </button>
    `).join('');

    bar.querySelectorAll('.canyon-year-chip').forEach(chip => {
      chip.onclick = () => {
        const idx = parseInt(chip.dataset.idx, 10);
        selectBike(idx);
      };
    });
  }

  function initStudio3DCanvas() {
    const canvas = document.querySelector('#studio3DCanvas');
    if (!canvas) return;

    studioRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    studioRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    studioRenderer.outputColorSpace = THREE.SRGBColorSpace;
    studioRenderer.toneMapping = THREE.AgXToneMapping;
    studioRenderer.toneMappingExposure = 1.1;
    studioRenderer.shadowMap.enabled = true;
    studioRenderer.shadowMap.type = THREE.PCFShadowMap;

    studioScene = new THREE.Scene();
    studioScene.background = new THREE.Color('#10151b');
    studioScene.fog = new THREE.Fog('#10151b', 4.5, 9);

    // PMREM Room Environment for authentic studio reflections
    try {
      const pmrem = new THREE.PMREMGenerator(studioRenderer);
      studioScene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      studioScene.environmentIntensity = 0.85;
    } catch (e) {
      console.warn('RoomEnvironment init fallback:', e);
    }

    studioCamera = new THREE.PerspectiveCamera(32, 1, 0.02, 60);
    studioCamera.position.set(1.4, 0.65, 2.2);

    studioControls = new OrbitControls(studioCamera, canvas);
    studioControls.enableDamping = true;
    studioControls.dampingFactor = 0.08;
    studioControls.autoRotate = false;
    studioControls.autoRotateSpeed = 1.0;
    studioControls.minDistance = 0.7;
    studioControls.maxDistance = 5.0;
    studioControls.maxPolarAngle = Math.PI * 0.52;
    studioControls.target.set(0, 0, 0);

    // Studio Lighting
    const key = new THREE.DirectionalLight('#fff4e6', 2.4);
    key.position.set(1.4, 3.4, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5 });
    key.shadow.bias = -0.0004;

    const hemi = new THREE.HemisphereLight('#c9dcf0', '#1a2027', 0.6);
    studioScene.add(key, hemi);

    // Floor & Plinth Ring
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4, 96),
      new THREE.MeshStandardMaterial({ color: '#080b0e', roughness: 0.82, metalness: 0.05, envMapIntensity: 0.25 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    studioScene.add(floor);

    const plinth = new THREE.Mesh(
      new THREE.RingGeometry(1.25, 1.28, 128),
      new THREE.MeshBasicMaterial({ color: '#bde9d9', transparent: true, opacity: 0.35 })
    );
    plinth.rotation.x = -Math.PI / 2;
    plinth.position.y = 0.001;
    studioScene.add(plinth);

    function resizeStudio() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!studioRenderer || !studioCamera) return;
      studioRenderer.setSize(w, h, false);
      studioCamera.aspect = w / h;
      studioCamera.fov = w < 820 ? 42 : 32;

      // Golden ratio desktop shift: centers the bike in the space left of the 360px panel
      if (w >= 820) {
        studioCamera.setViewOffset(w, h, 180, 0, w, h);
      } else {
        studioCamera.clearViewOffset();
      }
      studioCamera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resizeStudio);
    resizeStudio();

    function renderStudio() {
      if (document.querySelector('#canyonStudioModal')?.classList.contains('active')) {
        studioControls.update();
        studioRenderer.render(studioScene, studioCamera);
      }
      studioAnimId = requestAnimationFrame(renderStudio);
    }
    renderStudio();
  }

  function setCameraPreset(preset) {
    if (!studioControls || !studioCamera) return;

    const targets = {
      hero: { pos: [1.8, 0.75, 1.9], target: [0, 0.45, 0] },
      side: { pos: [0.0, 0.65, 2.5], target: [0, 0.45, 0] },
      cockpit: { pos: [0.75, 1.0, 0.85], target: [0.25, 0.78, 0] },
      drivetrain: { pos: [0.55, 0.42, 1.25], target: [0.0, 0.35, 0] },
      rear: { pos: [-1.8, 0.75, 1.2], target: [-0.1, 0.45, 0] }
    };

    const cfg = targets[preset] || targets.hero;
    studioCamera.position.set(...cfg.pos);
    studioControls.target.set(...cfg.target);
  }

  function selectBike(index) {
    activeBikeIndex = index;
    const bike = PIER_HERITAGE_BIKES[index];
    if (!bike) return;

    // Update Eyebrow & Title
    const eyebrow = document.querySelector('#studioEyebrow');
    if (eyebrow) eyebrow.textContent = `CANYON MUSEUM · ${bike.year} · EXHIBIT ${index + 1}`;

    const titleEl = document.querySelector('#studioBikeTitle');
    if (titleEl) {
      const parts = bike.name.split(' ');
      const hero = parts.slice(0, 2).join(' ');
      const sub = parts.slice(2).join(' ') || bike.category;
      titleEl.innerHTML = `${hero}<br><span>${sub}</span>`;
    }

    const proTag = document.querySelector('#studioProTag');
    if (proTag) proTag.textContent = [bike.category, bike.proAthlete && `Athlete: ${bike.proAthlete}`, bike.splitTime && `Finish: ${bike.splitTime}`].filter(Boolean).join(' · ');

    // Update Athlete Card
    const athName = document.querySelector('#studioAthleteName');
    const athSplit = document.querySelector('#studioAthleteSplit');
    if (athName) athName.textContent = bike.proAthlete || 'No Canyon champion at Kona';
    if (athSplit) athSplit.textContent = bike.splitTime ? `Kona finish: ${bike.splitTime}` : '';

    // Update Stats Grid
    const stW = document.querySelector('#statWeight');
    const stB = document.querySelector('#statBikeTime');
    const stT = document.querySelector('#statTotalTime');
    if (stW) stW.textContent = bike.specs?.weight || '8.2 kg';
    if (stB) stB.textContent = bike.bikeTime || '—';
    if (stT) stT.textContent = bike.splitTime ? bike.splitTime.split(' ')[0] : '—';

    // Update Story
    const storyBox = document.querySelector('#studioStoryBox');
    if (storyBox) {
      storyBox.textContent = bike.summary;
      const conf = { sourced: 'Sourced', partial: 'Partly sourced', unverified: 'Not yet verified' }[bike.confidence || 'unverified'];
      const meta = document.createElement('small');
      meta.className = 'canyon-source-note';
      meta.style.cssText = 'display:block;margin-top:8px;opacity:.7';
      meta.textContent = conf + (bike.sources && bike.sources.length ? ` · ${bike.sources.length} source${bike.sources.length > 1 ? 's' : ''}` : '');
      if (bike.sources) meta.title = bike.sources.join('\n');
      storyBox.appendChild(meta);
    }

    // Update Quick Specs & Full Specs
    const quickSpecs = document.querySelector('#studioQuickSpecs');
    const specsTable = document.querySelector('#studioSpecsTable');
    if (bike.specs) {
      const specHtml = Object.entries(bike.specs).map(([k, v]) => `
        <dt>${k}</dt>
        <dd>${v}</dd>
      `).join('');
      if (quickSpecs) quickSpecs.innerHTML = specHtml;
      if (specsTable) specsTable.innerHTML = specHtml;
    }

    // Update Champions
    const proCard = document.querySelector('#studioProWinnersCard');
    if (proCard && bike.proWinner) {
      const card = (w, label) => w ? `
        <div class="canyon-athlete-card">
          <div class="canyon-athlete-avatar">🥇</div>
          <div class="canyon-athlete-info">
            <b>${w.name} (${w.country})</b>
            <small>${label} · ${w.race || 'Kona'} · ${w.time}${w.bike ? ` · ${w.bike}` : ''}</small>
          </div>
        </div>` : '';
      proCard.innerHTML = card(bike.proWinner.male, 'Men’s Kona champion') + card(bike.proWinner.female, 'Women’s Kona champion');
    }

    // Update Timeline Chips
    document.querySelectorAll('.canyon-year-chip').forEach((c, i) => {
      c.classList.toggle('active', i === index);
    });

    loadStudioModel(bike);
  }

  let cachedRimTex = null;
  let cachedTyreTex = null;

  function getRimTexture() {
    if (!cachedRimTex) {
      cachedRimTex = rimTexture('#d9d9d9', '#0b0b0c', true);
    }
    return cachedRimTex;
  }

  function getTyreTexture() {
    if (!cachedTyreTex) {
      cachedTyreTex = tyreTexture('GP 5000 S TR', '28 MM', '#888888');
    }
    return cachedTyreTex;
  }

  function buildDiscMesh() {
    const prof = [];
    for (let i = 0; i <= 24; i++) {
      const r = 0.018 + (0.239 - 0.018) * i / 24;
      prof.push(new THREE.Vector2(r, 0.0115 * Math.cos(i / 24 * Math.PI / 2) + 0.0035));
    }
    const half = new THREE.LatheGeometry(prof, 128);
    half.rotateX(Math.PI / 2);
    const g = new THREE.Group();
    const discMat = new THREE.MeshPhysicalMaterial({
      color: 0x0c0c0d,
      roughness: 0.38,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
      envMapIntensity: 0.8
    });
    const a = new THREE.Mesh(half, discMat);
    const b = new THREE.Mesh(half, discMat);
    b.rotation.y = Math.PI;
    a.castShadow = b.castShadow = true;
    g.add(a, b);
    return g;
  }

  let currentPaintMaterial = null;
  let currentDiscGroup = null;

  function mapMaterial(m, mesh, bike) {
    const name = m.name || '';
    if (name === 'paint_frame') {
      const isMatte = bike.finish === 'matte';
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(bike.colorPreset || '#1a2228'),
        roughness: isMatte ? 0.62 : 0.28,
        metalness: isMatte ? 0.05 : 0.08,
        clearcoat: isMatte ? 0.1 : 1.0,
        clearcoatRoughness: 0.04,
        iridescence: 0.8,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [140, 420]
      });
      mat.name = 'paint_frame';
      currentPaintMaterial = mat;
      return mat;
    }
    if (name === 'decal_dark') {
      return new THREE.MeshPhysicalMaterial({
        color: 0x111113,
        roughness: 0.38,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });
    }
    if (name === 'decal_light') {
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.45,
        clearcoat: 0.6,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });
    }
    if (name === 'carbon_cockpit') {
      return new THREE.MeshPhysicalMaterial({
        color: 0x121214,
        roughness: 0.42,
        metalness: 0.1,
        clearcoat: 0.7,
        clearcoatRoughness: 0.18
      });
    }
    if (name === 'carbon_crank') {
      return new THREE.MeshPhysicalMaterial({
        color: 0x18181b,
        roughness: 0.32,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08
      });
    }
    if (name === 'carbon_rim') {
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.5,
        clearcoat: 0.45,
        clearcoatRoughness: 0.25,
        envMapIntensity: 0.7,
        map: getRimTexture()
      });
    }
    if (name === 'rubber_tyre') {
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.78,
        envMapIntensity: 0.45,
        map: getTyreTexture()
      });
    }
    if (name === 'bottle_smoke') {
      return new THREE.MeshPhysicalMaterial({
        color: 0x2a2c30,
        roughness: 0.12,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        side: THREE.DoubleSide,
        clearcoat: 1.0
      });
    }
    if (name === 'alu_dark') {
      return new THREE.MeshStandardMaterial({
        color: 0x222225,
        roughness: 0.32,
        metalness: 0.85
      });
    }
    if (name === 'alu_black') {
      return new THREE.MeshStandardMaterial({
        color: 0x141416,
        roughness: 0.42,
        metalness: 0.7
      });
    }
    if (name === 'alu_silver') {
      return new THREE.MeshStandardMaterial({
        color: 0xd0d2d6,
        roughness: 0.22,
        metalness: 0.92
      });
    }
    if (name === 'steel_chain') {
      return new THREE.MeshStandardMaterial({
        color: 0xc8cad0,
        roughness: 0.18,
        metalness: 0.96
      });
    }
    if (name === 'steel_cassette') {
      return new THREE.MeshStandardMaterial({
        color: 0xd8dadf,
        roughness: 0.2,
        metalness: 0.94
      });
    }
    if (name === 'steel_rotor') {
      return new THREE.MeshStandardMaterial({
        color: 0xd2d5db,
        roughness: 0.25,
        metalness: 0.92
      });
    }
    if (name === 'steel_spoke') {
      return new THREE.MeshStandardMaterial({
        color: 0x1b1c1e,
        roughness: 0.3,
        metalness: 0.85
      });
    }
    if (name === 'led_green') {
      return new THREE.MeshBasicMaterial({
        color: 0x00ff66
      });
    }
    if (name === 'pad_foam') {
      return new THREE.MeshStandardMaterial({
        color: 0x1c1c1f,
        roughness: 0.92,
        metalness: 0.0
      });
    }
    if (name === 'rubber_grip') {
      return new THREE.MeshStandardMaterial({
        color: 0x111112,
        roughness: 0.85,
        metalness: 0.02
      });
    }
    if (name === 'plastic_black') {
      return new THREE.MeshStandardMaterial({
        color: 0x161618,
        roughness: 0.55,
        metalness: 0.1
      });
    }
    if (name === 'alu_hub') {
      return new THREE.MeshStandardMaterial({
        color: 0x1a1a1c,
        roughness: 0.28,
        metalness: 0.9
      });
    }

    const clone = m.clone();
    if (clone.roughness !== undefined) clone.roughness = 0.35;
    return clone;
  }

  function loadStudioModel(bike) {
    if (!studioScene) return;

    if (currentStudioMesh) {
      studioScene.remove(currentStudioMesh);
      currentStudioMesh = null;
    }
    currentPaintMaterial = null;
    currentDiscGroup = null;

    const modelPath = 'assets/bikes/' + (bike.modelFile || 'speedmax_2019_slx.glb');
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(modelPath, gltf => {
      currentStudioMesh = gltf.scene;
      let rearWheelNode = null;

      currentStudioMesh.traverse(o => {
        if (o.name === 'wheel_rear') rearWheelNode = o;
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.material) {
            o.material = mapMaterial(o.material, o, bike);
          }
        }
      });

      // Calculate natural scaling and ground cleanly on floor plane y=0
      currentStudioMesh.scale.setScalar(1.0);
      currentStudioMesh.position.set(0, 0, 0);
      currentStudioMesh.updateMatrixWorld(true);

      const initialBox = new THREE.Box3().setFromObject(currentStudioMesh);
      const size = initialBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.65 / (maxDim || 1);
      currentStudioMesh.scale.setScalar(scale);
      currentStudioMesh.updateMatrixWorld(true);

      const scaledBox = new THREE.Box3().setFromObject(currentStudioMesh);
      // Center horizontally in X and Z
      currentStudioMesh.position.x = -((scaledBox.min.x + scaledBox.max.x) * 0.5);
      currentStudioMesh.position.z = -((scaledBox.min.z + scaledBox.max.z) * 0.5);
      // Ground tires precisely at y = 0
      currentStudioMesh.position.y = -scaledBox.min.y;

      // Optional Rear Disc Wheel
      if (rearWheelNode) {
        currentDiscGroup = buildDiscMesh();
        rearWheelNode.add(currentDiscGroup);
        const wantsDisc = bike.rearWheel === 'disc';   // explicit per exhibit; never inferred from year
        currentDiscGroup.visible = wantsDisc;
        const discBtn = document.querySelector('.canyon-toggle-btn[data-wheel="disc"]');
        const dualBtn = document.querySelector('.canyon-toggle-btn[data-wheel="dual80"]');
        if (discBtn && dualBtn) {
          discBtn.classList.toggle('active', wantsDisc);
          dualBtn.classList.toggle('active', !wantsDisc);
        }
      }

      studioScene.add(currentStudioMesh);
      setCameraPreset('hero');

      if (!bikeOpen(bike)) {
        // Not yet lived through: show the outline only, and how to earn it.
        currentStudioMesh.traverse(o => { if (o.isMesh) o.material = silhouetteMat; });
        const storyBox = document.querySelector('#studioStoryBox');
        if (storyBox) storyBox.textContent = `🔒 This exhibit opens when you ${prog().bikeHint(bike).replace(/^./, c => c.toLowerCase())}.`;
      } else if (bike.colorPreset) {
        applyFrameColor(bike.colorPreset);
      }
      refreshSwatchLocks();
    });
  }

  function applyFrameColor(hex) {
    const col = new THREE.Color(hex);
    if (currentPaintMaterial) {
      currentPaintMaterial.color.copy(col);
    }
  }

  function applyFinish(type) {
    const isMatte = type === 'matte';
    if (currentPaintMaterial) {
      currentPaintMaterial.roughness = isMatte ? 0.62 : 0.24;
      currentPaintMaterial.clearcoat = isMatte ? 0.1 : 1.0;
      currentPaintMaterial.metalness = isMatte ? 0.05 : 0.08;
    }
  }

  function applyWheelset(wheel) {
    if (currentDiscGroup) {
      currentDiscGroup.visible = (wheel === 'disc');
    }
  }

  function refreshSwatchLocks() {
    const p = prog();
    document.querySelectorAll('.canyon-swatch').forEach(d => {
      const locked = p && !p.isColourUnlocked(d.dataset.col);
      d.classList.toggle('locked', !!locked);
      d.setAttribute('aria-label', locked ? `${d.title} (locked)` : d.title);
    });
  }

  function latestUnlockedIndex() {
    for (let i = PIER_HERITAGE_BIKES.length - 1; i >= 0; i--) if (bikeOpen(PIER_HERITAGE_BIKES[i])) return i;
    return PIER_HERITAGE_BIKES.length - 1;
  }

  function openStudio(index) {
    if (index === undefined || index === null) index = latestUnlockedIndex();
    const modal = document.querySelector('#canyonStudioModal');
    if (!modal) return;
    modal.classList.add('active');

    // Close Heritage Studio if open
    const herOverlay = document.querySelector('#heritageStudioOverlay');
    if (herOverlay) herOverlay.classList.remove('active');

    selectBike(index);

    setTimeout(() => {
      const canvas = document.querySelector('#studio3DCanvas');
      if (canvas && studioRenderer && studioCamera) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        studioRenderer.setSize(w, h, false);
        studioCamera.aspect = w / h;
        studioCamera.fov = w < 820 ? 42 : 32;
        if (w >= 820) {
          studioCamera.setViewOffset(w, h, 180, 0, w, h);
        } else {
          studioCamera.clearViewOffset();
        }
        studioCamera.updateProjectionMatrix();
      }
    }, 80);
  }

  function closeStudio() {
    const modal = document.querySelector('#canyonStudioModal');
    if (modal) modal.classList.remove('active');
  }

  return {
    open: openStudio,
    close: closeStudio,
    selectBike,
    pedestals: pedestalGroup,
    getBikes: () => PIER_HERITAGE_BIKES,
    update(dt, camera) {
      if (!camera) return;
      const isNearPier = Math.hypot(camera.position.x - (-6), camera.position.z) < 55.0;
      for (const p of pedestalGroup.children) {
        if (p.userData.sprite) p.userData.sprite.visible = isNearPier;
      }
    },
    checkProximity(playerPos, onProximityHit) {
      if (!playerPos) return false;
      const isNearPier = Math.hypot(playerPos.x - (-6), playerPos.z) < 55.0;
      for (const p of pedestalGroup.children) {
        if (p.userData.sprite) p.userData.sprite.visible = isNearPier;
        const dist = playerPos.distanceTo(p.position);
        if (dist < 4.5 && onProximityHit) {
          onProximityHit(p.userData.bikeIndex, p.userData.bike);
          return true;
        }
      }
      return false;
    }
  };
}
