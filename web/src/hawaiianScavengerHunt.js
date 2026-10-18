// Hawaiian Heritage & Scavenger Hunt Museum with Canyon Studio Architecture
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { playConchChime, playMemoryChime } from './audio.js';
import { readSection, writeSection } from './save.js';

export const HAWAIIAN_HERITAGE_DISCOVERIES = [
  {
    id: 'pele_creation',
    epochOrder: 1,
    epoch: 'Deep Geological Time · ~500,000 BP',
    hawaiianName: 'Ka Huakaʻi o Pele & Ka Pōhaku Pāhoehoe',
    title: 'The Sacred Basalt of Madame Pele',
    shortYear: '~500k BP',
    coords: [-28, -85],
    heightOffset: 2.2,
    icon: '🌋',
    color: '#ff6b35',
    beaconColor: 0xff6b35,
    riddle: 'Before fish or human stepped upon this shore, molten blood rose 18,000 feet from the seafloor. Seek the ancient ropy pāhoehoe basalt where the volcanic mantle of Hualālai met the Pacific surf.',
    quote: '“He aliʻi ka ʻāina; he kauwā ke kanaka.” — The land is a chief; man is its servant.',
    story: 'The Island of Hawaiʻi was born over a deep mantle volcanic hotspot. Over hundreds of thousands of years, basaltic lava welled up from the abyssal plain. Hualālai, the volcano rising directly behind Kailua-Kona, shaped this leeward shoreline with black pāhoehoe (smooth ropey) and ʻaʻā (rough jagged) lava flows. Ancient Hawaiians recognized the living presence of Madame Pele in every volcanic fissure.',
    archaeology: 'Volcanic basalt provided the foundational toolset for Hawaiian civilization: dense adze blades (koʻi) for carving voyaging canoes, porous lava stone for building agricultural terraces, and natural subterranean lava tubes that provided freshwater catchment and royal shelter.',
    sacred: true,
    badge: 'Flame of Pele',
    badgeIcon: '🔥',
    modelType: 'basalt'
  },
  {
    id: 'wayfinder_stars',
    epochOrder: 2,
    epoch: 'Polynesian Voyaging Era · ~800 CE',
    hawaiianName: 'Ka Huakaʻi a ka Waʻa Kaulua',
    title: 'The Wayfinder Star Compass',
    shortYear: '~800 CE',
    coords: [-32, -32],
    heightOffset: 2.0,
    icon: '🛶',
    color: '#00d2ff',
    beaconColor: 0x00d2ff,
    riddle: 'Guided by the migratory flight of the Kōlea (golden plover) and the zenith star Hōkūleʻa (Arcturus), double-hulled voyaging canoes navigated 2,500 miles across open ocean without instruments. Seek the celestial wayfinder stones resting on the sands of Kamakahonu.',
    quote: '“I ulu no ka lālā i ke kumu.” — The branches grow because of the trunk.',
    story: 'Polynesian navigators crossed the vast Pacific in double-hulled waʻa kaulua canoes using non-instrument navigation. They aligned their hulls with celestial houses, memorized the rising and setting points of constellations, read ocean swell interference patterns, and followed seabirds returning to land at dusk.',
    archaeology: 'Kamakahonu (Eye of the Turtle) was revered by voyagers as one of the finest natural harbors in the archipelago, protected from heavy Pacific swells by the natural coral reef and breakwater.',
    badge: 'Navigator of the Horizon',
    badgeIcon: '🧭',
    modelType: 'canoe'
  },
  {
    id: 'ahupuaa_watershed',
    epochOrder: 2,
    epoch: 'Traditional Land Stewardship',
    hawaiianName: 'Ke Kahawai Mauka a Makai',
    title: 'The Sacred Ahupuaʻa Watershed',
    shortYear: 'Traditional',
    coords: [160, 40],
    heightOffset: 12.0,
    icon: '🌿',
    color: '#2ec4b6',
    beaconColor: 0x2ec4b6,
    riddle: 'From the mountain rainclouds down to the outer coral reef, the ancient Hawaiian people carved no fences. Seek the mountain-to-sea marker where cloud mist meets volcanic slope.',
    quote: '“E mālama i ka ʻāina, a e mālama ka ʻāina iā ʻoe.” — Care for the land, and the land will care for you.',
    story: 'The Hawaiian Ahupuaʻa was an extraordinary model of sustainable watershed stewardship. Each wedge-shaped district stretched from the upland mountain cloud-forest (wao akua), through fertile stone-walled farming zones (kula), to coastal reef fisheries (kai), ensuring self-sufficiency for all community members without depletion.',
    archaeology: 'The Kona Field System (Kaluulu) was an intensive stone-terraced dryland breadfruit and sweet potato belt spanning over 60 square kilometers across the lower slopes of Hualālai.',
    sacred: true,
    badge: 'Guardian of the Watershed',
    badgeIcon: '🌱',
    modelType: 'stone'
  },
  {
    id: 'ahuena_heiau',
    epochOrder: 3,
    epoch: 'The Royal Hawaiian Kingdom · 1812',
    hawaiianName: 'Ahuʻena Heiau & Ka Hale o Lono',
    title: 'Ahuʻena Heiau: Sanctuary of Peace',
    shortYear: '1812',
    coords: [-20, -62],
    heightOffset: 2.8,
    icon: '🗿',
    color: '#e76f51',
    beaconColor: 0xe76f51,
    riddle: 'Upon this stone platform, King Kamehameha the Great established the final royal capital of the unified Hawaiian Kingdom, dedicating this sacred temple not to war, but to Lono—god of peace, rain, and agriculture.',
    quote: '“Imua e nā pōkiʻi a inu i ka wai ʻawaʻawa.” — Forward, my brothers, and drink the bitter waters; there is no turning back.',
    story: 'After uniting all eight Hawaiian islands in 1810, King Kamehameha I returned to Kamakahonu to spend his final golden years. Here he governed with wisdom, promoted farming, and gathered his high council. Restored hand-carved Kiʻi wooden temple images stand watch over the tranquil bay.',
    archaeology: 'Ahuʻena Heiau is a National Historic Landmark, restored in the 1970s using native ʻōhiʻa timber, sacred basalt boulders, and traditional loulu palm leaf thatching.',
    sacred: true,
    badge: 'Royal Heiau Guardian',
    badgeIcon: '👑',
    modelType: 'heiau'
  },
  {
    id: 'kapu_abolition',
    epochOrder: 3,
    epoch: 'The Cultural Turning Point · 1819',
    hawaiianName: 'Ka ʻAi Noa o Kamakahonu',
    title: 'The Great Feast of ʻAi Noa',
    shortYear: '1819',
    coords: [-4, -30],
    heightOffset: 2.5,
    icon: '⚖️',
    color: '#ffb703',
    beaconColor: 0xffb703,
    riddle: 'Six months after King Kamehameha passed into eternity, King Liholiho sat beside Queen Kaʻahumanu and ate forbidden food before his people, dissolving the thousand-year religious kapu without violence.',
    quote: '“Ua haki ke kapu.” — The sacred law is broken.',
    story: 'For centuries, Hawaiian law strictly separated men and women during meals and forbade women from eating bananas, pork, and coconuts under pain of death. In November 1819, Queen Kaʻahumanu orchestrated the historic ʻAi Noa feast right here at Kamakahonu, courageously transforming Hawaiian society from within.',
    archaeology: 'This monumental cultural revolution occurred months before Christian missionaries arrived in Hawaii, proving that indigenous leaders independently spearheaded their own modernization.',
    badge: 'Sovereign Peacemaker',
    badgeIcon: '🕊️',
    modelType: 'table'
  },
  {
    id: 'moku_aikaua',
    epochOrder: 4,
    epoch: 'Early Kingdom & Stone Architecture · 1820',
    hawaiianName: 'Ka Hale Pule o Mokuʻaikaua',
    title: 'Mokuʻaikaua: Coral & Basalt Sanctuary',
    shortYear: '1820',
    coords: [110, -32],
    heightOffset: 4.5,
    icon: '⛪',
    color: '#f4a261',
    beaconColor: 0xf4a261,
    riddle: 'Look across Aliʻi Drive where a 112-foot spire pierces the tropical sky. The thick walls were constructed by divers who submerged into the Pacific reef to cut coral heads, burning them into mortar to bond raw volcanic rock.',
    quote: '“Built of living stone from mountain and sea.”',
    story: 'Founded in 1820, Mokuʻaikaua is the oldest Christian church in Hawaii. High Chief John Adams Kuakini directed local builders to combine black volcanic basalt boulders with coral mortar harvested from the ocean depths, framed with massive hand-adzed ʻōhiʻa timber hauled down from the volcano.',
    archaeology: 'The interior preserves rare native Koa wood pews and pulpit that have endured tropical storms, volcanic tremors, and tsunamis for over two centuries.',
    badge: 'Master of Coral & Stone',
    badgeIcon: '🏛️',
    modelType: 'spire'
  },
  {
    id: 'hulihee_palace',
    epochOrder: 4,
    epoch: 'Royal Retreat of the Monarchy · 1838',
    hawaiianName: 'Ka Hale Aliʻi o Huliheʻe',
    title: 'Huliheʻe Palace: Oceanfront Royal Residence',
    shortYear: '1838',
    coords: [88, -75],
    heightOffset: 3.5,
    icon: '🏰',
    color: '#9d4edd',
    beaconColor: 0x9d4edd,
    riddle: 'Where Princess Ruth Keʻelikōlani stood as an immovable pillar of Hawaiian sovereignty and King Kalākaua held banquets beside the Pacific tides. Seek the royal crest overlooking Kailua Bay.',
    quote: '“Aloha kekahi i kekahi.” — Love one another.',
    story: 'Huliheʻe Palace was constructed in 1838 as an oceanfront retreat for Hawaiian monarchs. Kings, queens, and high chiefs gathered here for ocean canoe regattas, musical compositions, and royal diplomacy under swaying coconut palms.',
    archaeology: 'The palace houses precious heirlooms including King Kamehameha I’s personal war spears, intricate feather capes (ʻahuʻula), and grand furniture carved from solid native Koa trees.',
    badge: 'Koa Palace Scholar',
    badgeIcon: '📜',
    modelType: 'crest'
  },
  {
    id: 'swimming_cattle',
    epochOrder: 4,
    epoch: 'Paniolo & Maritime Heritage · 1890s',
    hawaiianName: 'Nā Paniolo & Nā Pipi Kau Lani',
    title: 'The Swimming Cattle of Kailua Pier',
    shortYear: '1890s',
    coords: [16, 26],
    heightOffset: 2.3,
    icon: '🐎',
    color: '#8338ec',
    beaconColor: 0x8338ec,
    riddle: 'Decades before triathletes racked carbon fiber bikes upon this pier, fearless Hawaiian cowboys (Paniolo) drove wild cattle into the crashing surf, tethering them to longboats to swim out to offshore steamships.',
    quote: '“He Paniolo nō au.” — Truly, I am a cowboy.',
    story: 'Cattle ranching was a pillar of Hawaiian economy. Because steamships could not cross the shallow coral reef into the pier, Hawaiian cowboys lassoed cattle, jumped into the waves on horseback, and lashed the horns to whaleboats to row them out to the steamer Humuʻula.',
    archaeology: 'Original heavy iron mooring rings embedded into the basalt foundations of Kailua Pier remain preserved today where cattle ropes were once secured.',
    badge: 'Paniolo of Kailua Pier',
    badgeIcon: '🤠',
    modelType: 'ring'
  },
  {
    id: 'kona_coffee',
    epochOrder: 4,
    epoch: 'The Coffee Belt Revolution · 1892',
    hawaiianName: 'Ke Kope Kaulana o Kona',
    title: 'The Legendary Kona Typica Coffee',
    shortYear: '1892',
    coords: [240, 160],
    heightOffset: 24.0,
    icon: '☕',
    color: '#6f4e37',
    beaconColor: 0x8d5b4c,
    riddle: 'Ascend the slopes of Hualālai into the misty afternoon cloud belt. Discover the dark volcanic soil where Brazilian heirloom Typica cherries produce one of the rarest, smoothest coffees on Earth.',
    quote: '“He ʻono, he kope maikaʻi loa.” — The finest coffee.',
    story: 'Kona coffee grows exclusively in an 8-by-30-mile strip along the volcanic slopes of Hualālai and Mauna Loa. The unique microclimate features bright morning sunshine, gentle afternoon cloud shade that shields delicate leaves, and porous volcanic soil rich in minerals.',
    archaeology: 'Generations of Hawaiian, Japanese, and Filipino smallholder families hand-cultivated and wet-milled the beans on family estates, establishing a world-renowned agricultural heritage.',
    badge: 'Volcanic Coffee Connoisseur',
    badgeIcon: '☕',
    modelType: 'bean'
  },
  {
    id: 'ironman_genesis',
    epochOrder: 5,
    epoch: 'The Birth of Ironman · 1978–1981',
    hawaiianName: 'Ka Huakaʻi o ke Kanaka Mekala',
    title: 'The Collins Challenge Stone',
    shortYear: '1978',
    coords: [-10, -18],
    heightOffset: 1.5,
    icon: '🏊',
    color: '#ffcc33',
    beaconColor: 0xffcc33,
    riddle: 'Stand at Dig Me Beach where 15 pioneers stepped into the ocean in 1978 after John Collins declared: "Swim 2.4 miles, bike 112 miles, run 26.2 miles, brag for the rest of your life!" Seek the bronze commemorative mark on the pier apron.',
    quote: '“Anything is Possible.” — The Ironman Creed.',
    story: 'Moved from Oahu to Kona in 1981, the Ironman World Championship found its true spiritual home amidst the raw volcanic lava fields and fierce crosswinds of the Big Island, testing human resilience against nature.',
    archaeology: 'In 1981, 326 athletes lined up at Kailua Pier. The race pioneered modern long-distance triathlon equipment, hydration pacing, and nutritional endurance science.',
    badge: 'Ironman Pioneer',
    badgeIcon: '🏅',
    modelType: 'trophy'
  },
  {
    id: 'iron_war_1989',
    epochOrder: 5,
    epoch: 'The Iron War · 1989',
    hawaiianName: 'Ke Kaua Mekala o Dave Scott & Mark Allen',
    title: 'The Iron War 1989 Monument',
    shortYear: '1989',
    coords: [219, 8],
    heightOffset: 6.5,
    icon: '⚔️',
    color: '#e63946',
    beaconColor: 0xe63946,
    riddle: 'Along the lonely Queen K Highway, two titans ran side by side for eight blistering hours without saying a word, breaking the world record by 19 minutes in the greatest endurance race ever run.',
    quote: '“We were pushing each other into a realm neither of us had ever been before.”',
    story: 'Dave Scott and Mark Allen ran shoulder-to-shoulder through the punishing volcanic heat of the marathon. On the final uphill surge out of the Natural Energy Lab, Allen pulled away to victory in 8:09:15, shattering the record and redefining endurance limits.',
    archaeology: 'The duel triggered the aero revolution: clip-on aero bars, composite disc wheels, and wind-tunnel frame design.',
    badge: 'Iron War Veteran',
    badgeIcon: '🔥',
    modelType: 'monument'
  },
  {
    id: 'nextgen_superbike',
    epochOrder: 5,
    epoch: 'The Modern Era & Sub-7:36 Peak · 2024–2027',
    hawaiianName: 'Ka Makani Uila o ka Moku',
    title: 'The Patrick Lange 7:35:53 Pinnacle',
    shortYear: '2024',
    coords: [4, 18],
    heightOffset: 2.5,
    icon: '⚡',
    color: '#00f5d4',
    beaconColor: 0x00f5d4,
    riddle: 'The pier is where the 2024 men’s race ended in 7:35:53.',
    quote: 'Course record 7:35:53. The race bike used a prototype cockpit, so any model here is a stand-in, not a replica.',
    story: 'In October 2024, Patrick Lange combined a 4:06:22 bike split with a blistering 2:37:34 marathon to establish the current world championship record of 7:35:53 on his custom Canyon Speedmax CFR superbike.',
    archaeology: 'This superbike represents 45 years of continuous aerodynamic and material evolution, from 1982 lugged steel to monocoque Toray carbon fiber and wireless AXS electronics.',
    badge: 'Superbike Master',
    badgeIcon: '🏆',
    modelType: 'superbike'
  }
];

export function createHawaiianScavengerHunt(ctx) {
  const { scene, camera, W, heightAt, toast } = ctx;

  let discoveredIds = new Set(readSection('heritage'));

  let activeIndex = 0;
  let studioScene, studioCamera, studioRenderer, studioControls;
  let currentArtifactMesh = null;

  // In-World 3D Beacon Group
  const beaconsGroup = new THREE.Group();
  beaconsGroup.name = 'HawaiianScavengerBeacons';
  scene.add(beaconsGroup);

  const beacons = [];

  // Create subtle in-world markers (clean, refined, NO noisy billboards!)
  HAWAIIAN_HERITAGE_DISCOVERIES.forEach(d => {
    const [x, y] = d.coords;
    const baseZ = Math.max(heightAt ? heightAt(x, y) : 0, 0);
    const z = baseZ + (d.heightOffset || 2.0);
    const pos = W(x, y, z);

    const group = new THREE.Group();
    group.position.copy(pos);
    group.userData = { discovery: d };

    // 1. Subtle glowing ground ring
    const ringGeo = new THREE.RingGeometry(0.9, 1.2, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(d.beaconColor),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -(d.heightOffset - 0.2);
    group.add(ring);

    // 2. Vertical sacred light beam
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.35, 10, 16, 1, true);
    beamGeo.translate(0, 5, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(d.beaconColor),
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    group.add(beam);

    // 3. Floating sacred orb
    const orbGeo = new THREE.IcosahedronGeometry(0.42, 2);
    const orbMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(d.beaconColor),
      emissive: new THREE.Color(d.beaconColor),
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    group.add(orb);

    // 4. Subtle distance-attenuated 3D sprite label (depthTest: true, sizeAttenuation: true)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 120;
    const cx = canvas.getContext('2d');
    cx.fillStyle = 'rgba(7, 18, 30, 0.88)';
    cx.roundRect(12, 12, 488, 96, 20);
    cx.fill();
    cx.strokeStyle = d.color;
    cx.lineWidth = 4;
    cx.roundRect(12, 12, 488, 96, 20);
    cx.stroke();

    cx.font = 'bold 38px system-ui, sans-serif';
    cx.fillStyle = '#ffffff';
    cx.fillText(`${d.icon} ${d.title.split(':')[0]}`, 32, 72);

    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      sizeAttenuation: true
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.2, 0.75, 1);
    sprite.position.y = 1.4;
    sprite.visible = false; // Only shown when player approaches within 40m!
    group.add(sprite);

    beaconsGroup.add(group);
    beacons.push({
      data: d,
      group,
      pos,
      orb,
      beam,
      ring,
      sprite,
      discovered: discoveredIds.has(d.id)
    });
  });

  // Setup DOM for Canyon-style Heritage Studio
  setupHeritageStudioDOM();

  function saveProgress() {
    writeSection('heritage', [...discoveredIds]);
    updateProgressHUD();
  }

  function setupHeritageStudioDOM() {
    let overlay = document.querySelector('#heritageStudioOverlay');
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'heritageStudioOverlay';
    overlay.className = 'canyon-studio-overlay';
    overlay.innerHTML = `
      <!-- Fullscreen 3D Canvas Stage -->
      <canvas id="heritage3DCanvas" class="canyon-canvas-stage"></canvas>

      <!-- Top Header (Left-aligned) -->
      <header class="canyon-top">
        <div class="canyon-title">
          <button type="button" class="canyon-back" id="herCloseBtn">← Return to Kona Odyssey</button>
          <div class="eyebrow" id="herEyebrow" style="color:#f4a261;">HAWAIIAN HERITAGE · ~500K BP · MILESTONE 1</div>
          <h1 id="herStudioTitle">Ka Huakaʻi o Pele<br><span>The Sacred Basalt of Madame Pele</span></h1>
          <p id="herStudioSubtitle">The Royal Kingdom · Kamakahonu</p>
        </div>
      </header>

      <!-- Right-side Floating Frosted Glass Panel -->
      <aside class="canyon-panel" id="herPanel">
        <div class="canyon-tabs" role="tablist">
          <button role="tab" aria-selected="true" data-tab="lore">Moʻolelo</button>
          <button role="tab" aria-selected="false" data-tab="arch">Archaeology</button>
          <button role="tab" aria-selected="false" data-tab="clue">Scavenger Clue</button>
        </div>

        <!-- Tab 1: Moʻolelo & Lore -->
        <section class="canyon-pane" data-pane="lore" id="herPanelLore">
          <div class="canyon-athlete-card" style="border-color:rgba(244,162,97,0.25);">
            <div class="canyon-athlete-avatar" id="herBadgeIcon" style="background:rgba(244,162,97,0.12);border-color:rgba(244,162,97,0.3);color:#f4a261;">🔥</div>
            <div class="canyon-athlete-info">
              <b id="herBadgeName">Flame of Pele</b>
              <small id="herHawaiianName" style="color:#f4a261;">Ka Huakaʻi o Pele</small>
              <div class="canyon-athlete-credit">Heritage Discovery</div>
            </div>
          </div>

          <h2>Proverb & Wisdom</h2>
          <div style="border-left:3px solid #f4a261;padding-left:12px;font-style:italic;color:#ffeaa7;font-size:12.5px;line-height:1.55;" id="herProverb">...</div>

          <h2>Living History</h2>
          <p id="herStoryText" style="color:#94a2ad;margin:0 0 6px;font-size:12.5px;line-height:1.6;">...</p>
        </section>

        <!-- Tab 2: Archaeology & Material Culture -->
        <section class="canyon-pane" data-pane="arch" id="herPanelArch" hidden>
          <h2>Material Culture & Evidence</h2>
          <p id="herArchText" style="color:#94a2ad;margin:0 0 12px;font-size:12.5px;line-height:1.6;">...</p>

          <h2>Sacred Coordinates</h2>
          <dl class="canyon-kv">
            <dt>Location</dt>
            <dd id="herCoordsText">Kailua Shoreline</dd>
            <dt>Elevation</dt>
            <dd id="herElevText">Sea Level · 0m</dd>
            <dt>Status</dt>
            <dd id="herStatusText" style="color:#2a9d8f;">Uncovered in Atlas</dd>
          </dl>
        </section>

        <!-- Tab 3: Scavenger Clue & Teleport -->
        <section class="canyon-pane" data-pane="clue" id="herPanelClue" hidden>
          <h2>Island Riddle</h2>
          <p id="herRiddleText" style="color:#ffeaa7;font-style:italic;font-size:12.5px;line-height:1.6;margin-bottom:16px;">...</p>

          <button type="button" class="sc-tp-btn" id="herTpBtn" style="width:100%;justify-content:center;">
            <span>⚡</span>
            <span>Teleport to In-World Site</span>
          </button>
        </section>
      </aside>

      <!-- Bottom Floating Control Dock -->
      <nav class="canyon-dock" aria-label="View controls">
        <button type="button" class="canyon-chip active" data-preset="hero">Hero 3/4</button>
        <button type="button" class="canyon-chip" data-preset="close">Close-up</button>
        <button type="button" class="canyon-chip" data-preset="side">Side</button>
        <button type="button" class="canyon-chip" data-preset="top">Top</button>
        <button type="button" class="canyon-chip" id="herSpinBtn">Turntable</button>
        <div class="canyon-dock-sep"></div>
        <div class="canyon-timeline-strip" id="herTimelineYearsBar"></div>
      </nav>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#herCloseBtn').onclick = () => closeHeritageStudio();

    // Tab buttons
    overlay.querySelectorAll('.canyon-tabs button').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('.canyon-tabs button').forEach(b => b.setAttribute('aria-selected', 'false'));
        overlay.querySelectorAll('.canyon-pane').forEach(p => p.hidden = true);
        btn.setAttribute('aria-selected', 'true');
        const tab = btn.dataset.tab;
        if (tab === 'lore') overlay.querySelector('#herPanelLore').hidden = false;
        if (tab === 'arch') overlay.querySelector('#herPanelArch').hidden = false;
        if (tab === 'clue') overlay.querySelector('#herPanelClue').hidden = false;
      };
    });

    // Camera presets
    overlay.querySelectorAll('.canyon-chip[data-preset]').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('.canyon-chip[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setCameraPreset(btn.dataset.preset);
      };
    });

    // Turntable spin toggle
    let spinOn = false;
    const spinBtn = overlay.querySelector('#herSpinBtn');
    if (spinBtn) {
      spinBtn.onclick = () => {
        spinOn = !spinOn;
        spinBtn.classList.toggle('active', spinOn);
        if (studioControls) studioControls.autoRotate = spinOn;
      };
    }

    // Teleport button
    overlay.querySelector('#herTpBtn').onclick = () => {
      const d = HAWAIIAN_HERITAGE_DISCOVERIES[activeIndex];
      if (d) {
        const [x, y] = d.coords;
        const baseZ = Math.max(heightAt ? heightAt(x, y) : 0, 0);
        const targetPos = W(x, y, baseZ + 1.8);
        camera.position.set(targetPos.x, targetPos.y + 0.5, targetPos.z);
        closeHeritageStudio();
        toast(`🌺 Arrived at ${d.hawaiianName}`);
      }
    };

    renderTimelineBar();
    initHeritage3DCanvas();
  }

  function renderTimelineBar() {
    const bar = document.querySelector('#herTimelineYearsBar');
    if (!bar) return;

    bar.innerHTML = HAWAIIAN_HERITAGE_DISCOVERIES.map((d, i) => `
      <button type="button" class="canyon-year-chip ${i === activeIndex ? 'active' : ''}" data-idx="${i}">
        ${d.shortYear || d.icon}
      </button>
    `).join('');

    bar.querySelectorAll('.canyon-year-chip').forEach(chip => {
      chip.onclick = () => {
        const idx = parseInt(chip.dataset.idx, 10);
        selectDiscovery(idx);
      };
    });
  }

  function initHeritage3DCanvas() {
    const canvas = document.querySelector('#heritage3DCanvas');
    if (!canvas) return;

    studioRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    studioRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    studioRenderer.outputColorSpace = THREE.SRGBColorSpace;
    studioRenderer.toneMapping = THREE.AgXToneMapping;
    studioRenderer.toneMappingExposure = 1.15;
    studioRenderer.shadowMap.enabled = true;
    studioRenderer.shadowMap.type = THREE.PCFShadowMap;

    studioScene = new THREE.Scene();
    studioScene.background = new THREE.Color('#10151b');
    studioScene.fog = new THREE.Fog('#10151b', 4.5, 9);

    studioCamera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
    studioCamera.position.set(1.9, 0.75, 2.3);

    studioControls = new OrbitControls(studioCamera, canvas);
    studioControls.enableDamping = true;
    studioControls.dampingFactor = 0.08;
    studioControls.autoRotate = false;
    studioControls.autoRotateSpeed = 1.0;
    studioControls.minDistance = 0.7;
    studioControls.maxDistance = 5.0;
    studioControls.target.set(0, 0.1, 0);

    const amb = new THREE.AmbientLight(0xd8ecff, 1.4);
    studioScene.add(amb);

    const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
    sun.position.set(3, 4, 3);
    sun.castShadow = true;
    studioScene.add(sun);

    const fill = new THREE.DirectionalLight(0x00d2ff, 1.0);
    fill.position.set(-3, -1, -2);
    studioScene.add(fill);

    // Floor and glowing plinth ring
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4, 96),
      new THREE.MeshStandardMaterial({ color: '#080b0e', roughness: 0.82, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    studioScene.add(floor);

    const plinth = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 0.92, 128),
      new THREE.MeshBasicMaterial({ color: '#f4a261', transparent: true, opacity: 0.4 })
    );
    plinth.rotation.x = -Math.PI / 2;
    plinth.position.y = 0.001;
    studioScene.add(plinth);

    function resizeHeritage() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!studioRenderer || !studioCamera) return;
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
    window.addEventListener('resize', resizeHeritage);
    resizeHeritage();
  }

  function setCameraPreset(preset) {
    if (!studioCamera || !studioControls) return;
    const target = new THREE.Vector3(0, 0.1, 0);
    studioControls.target.copy(target);

    if (preset === 'hero') {
      studioCamera.position.set(1.9, 0.75, 2.3);
    } else if (preset === 'close') {
      studioCamera.position.set(1.0, 0.5, 1.2);
    } else if (preset === 'side') {
      studioCamera.position.set(2.4, 0.4, 0.0);
    } else if (preset === 'top') {
      studioCamera.position.set(0.01, 2.6, 0.01);
    }
    studioControls.update();
  }

  function buildArtifactModel(d) {
    const group = new THREE.Group();
    const color = new THREE.Color(d.beaconColor);

    if (d.modelType === 'basalt') {
      // Procedural volcanic basalt formation
      const geo = new THREE.DodecahedronGeometry(0.38, 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.multiplyScalar(0.85 + Math.sin(v.x * 5) * 0.15 + Math.cos(v.y * 6) * 0.12);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.1
      });
      const rockMesh = new THREE.Mesh(geo, mat);
      rockMesh.position.y = 0.15;
      group.add(rockMesh);

      // Glowing lava vein
      const veinGeo = new THREE.TorusGeometry(0.30, 0.02, 8, 24);
      const veinMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
      const veinMesh = new THREE.Mesh(veinGeo, veinMat);
      veinMesh.position.y = 0.15;
      veinMesh.rotation.x = Math.PI / 4;
      group.add(veinMesh);
    } else if (d.modelType === 'canoe') {
      // Double-hulled Hawaiian waʻa canoe hulls
      for (const offset of [-0.22, 0.22]) {
        const hullGeo = new THREE.CylinderGeometry(0.05, 0.09, 1.1, 12);
        hullGeo.rotateZ(Math.PI / 2);
        const hullMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.5 });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.position.set(0, 0.12, offset);
        group.add(hull);
      }
      // Crossbeams (ʻiako)
      const beamGeo = new THREE.BoxGeometry(0.03, 0.03, 0.6);
      const beamMat = new THREE.MeshStandardMaterial({ color: 0xdeb887 });
      for (const x of [-0.3, 0.0, 0.3]) {
        const b = new THREE.Mesh(beamGeo, beamMat);
        b.position.set(x, 0.18, 0);
        group.add(b);
      }
    } else if (d.modelType === 'heiau') {
      // Stone temple terrace with Kiʻi statues
      const terr1 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.75), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 }));
      terr1.position.y = 0.06;
      const terr2 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.55), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }));
      terr2.position.y = 0.18;
      group.add(terr1, terr2);

      // Kiʻi guardian statue
      const kii = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.38, 8), new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.7 }));
      kii.position.set(0, 0.43, 0);
      group.add(kii);
    } else {
      // Refined ceremonial sacred emblem
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.42, 2),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.4,
          roughness: 0.3,
          metalness: 0.8
        })
      );
      orb.position.y = 0.38;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.02, 12, 32),
        new THREE.MeshBasicMaterial({ color, wireframe: true })
      );
      ring.position.y = 0.38;
      group.add(orb, ring);
    }

    return group;
  }

  function selectDiscovery(idx) {
    if (idx < 0 || idx >= HAWAIIAN_HERITAGE_DISCOVERIES.length) return;
    activeIndex = idx;
    const d = HAWAIIAN_HERITAGE_DISCOVERIES[idx];

    // Update DOM
    const eyebrow = document.querySelector('#herEyebrow');
    const title = document.querySelector('#herStudioTitle');
    const sub = document.querySelector('#herStudioSubtitle');
    const hawaiian = document.querySelector('#herHawaiianName');
    const proverb = document.querySelector('#herProverb');
    const story = document.querySelector('#herStoryText');
    const arch = document.querySelector('#herArchText');
    const riddle = document.querySelector('#herRiddleText');
    const badgeName = document.querySelector('#herBadgeName');
    const badgeIcon = document.querySelector('#herBadgeIcon');
    const coordsText = document.querySelector('#herCoordsText');
    const elevText = document.querySelector('#herElevText');

    if (eyebrow) eyebrow.textContent = `HAWAIIAN HERITAGE · ${d.shortYear} · DISCOVERY ${idx + 1}`;
    if (title) title.innerHTML = `${d.hawaiianName.split('&')[0]}<br><span>${d.title}</span>`;
    if (sub) sub.textContent = `${d.epoch} · Sacred Landmark`;
    if (hawaiian) hawaiian.textContent = d.hawaiianName;
    if (proverb) proverb.textContent = `“${d.quote}”`;
    if (story) story.textContent = d.story;
    if (arch) arch.textContent = d.archaeology;
    if (riddle) riddle.textContent = `“${d.riddle}”`;
    if (badgeName) badgeName.textContent = d.badge;
    if (badgeIcon) badgeIcon.textContent = d.badgeIcon;
    if (coordsText) coordsText.textContent = `[${Math.round(d.coords[0])}, ${Math.round(d.coords[1])}] · Kailua District`;
    if (elevText) elevText.textContent = `${Math.round(d.heightOffset || 2)}m Elevation`;

    // Timeline chips active state
    document.querySelectorAll('#herTimelineYearsBar .canyon-year-chip').forEach((chip, i) => {
      chip.classList.toggle('active', i === idx);
    });

    // Swap 3D model
    if (studioScene) {
      if (currentArtifactMesh) {
        studioScene.remove(currentArtifactMesh);
        currentArtifactMesh = null;
      }
      currentArtifactMesh = buildArtifactModel(d);
      studioScene.add(currentArtifactMesh);
    }
  }

  function openHeritageStudio(discoveryId = null) {
    const overlay = document.querySelector('#heritageStudioOverlay');
    if (!overlay) return;

    overlay.classList.add('active');

    // Close Canyon Bike Studio if open to prevent stacking
    const bikeModal = document.querySelector('#canyonStudioModal');
    if (bikeModal) bikeModal.classList.remove('active');

    if (discoveryId) {
      const idx = HAWAIIAN_HERITAGE_DISCOVERIES.findIndex(d => d.id === discoveryId);
      if (idx !== -1) selectDiscovery(idx);
      else selectDiscovery(activeIndex);
    } else {
      selectDiscovery(activeIndex);
    }

    startStudioLoop();
    playConchChime();
  }

  function closeHeritageStudio() {
    const overlay = document.querySelector('#heritageStudioOverlay');
    if (overlay) overlay.classList.remove('active');
    stopStudioLoop();
  }

  function startStudioLoop() {
    if (studioRenderer && studioScene && studioCamera) {
      const canvas = document.querySelector('#heritage3DCanvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        studioRenderer.setSize(rect.width, rect.height, false);
        studioCamera.aspect = rect.width / (rect.height || 1);
        studioCamera.updateProjectionMatrix();
      }

      function loop() {
        if (!document.querySelector('#heritageStudioOverlay')?.classList.contains('active')) return;
        studioControls?.update();
        if (currentArtifactMesh) currentArtifactMesh.rotation.y += 0.008;
        studioRenderer.render(studioScene, studioCamera);
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    }
  }

  function stopStudioLoop() {}

  function updateProgressHUD() {
    const count = [...discoveredIds].filter(id => !HAWAIIAN_HERITAGE_DISCOVERIES.find(d => d.id === id && d.sacred)).length;
    const total = HAWAIIAN_HERITAGE_DISCOVERIES.filter(d => !d.sacred).length;
    const badge = document.querySelector('#topHeritageBadge');
    if (badge) badge.textContent = `${count} / ${total}`;
  }

  function unlockDiscovery(d) {
    if (d.sacred) {
      toast(`${d.title}. This place is not a prize.`);
      return;
    }
    if (discoveredIds.has(d.id)) return;
    discoveredIds.add(d.id);
    saveProgress();

    playConchChime();
    setTimeout(playMemoryChime, 600);
    toast(`🌺 NEW HERITAGE DISCOVERY: ${d.title}! Tap [Heritage] to inspect artifact`);
    updateProgressHUD();

    // In-world beacon glow animation
    const b = beacons.find(item => item.data.id === d.id);
    if (b) {
      b.discovered = true;
      b.orb.material.emissiveIntensity = 1.4;
    }
  }

  updateProgressHUD();

  return {
    beacons,
    open: openHeritageStudio,
    close: closeHeritageStudio,
    unlock: unlockDiscovery,
    get progress() {
      return {
        found: discoveredIds.size,
        total: HAWAIIAN_HERITAGE_DISCOVERIES.length,
        items: [...discoveredIds]
      };
    },
    update(dt, playerCam) {
      if (!playerCam) return;
      const p = playerCam.position;

      // Animate in-world beacons and show title label ONLY when nearby (< 40m)
      const time = performance.now() * 0.002;
      for (const b of beacons) {
        b.orb.position.y = Math.sin(time * 2 + b.data.coords[0]) * 0.2;
        b.orb.rotation.y += dt * 1.2;
        b.ring.rotation.z += dt * 0.5;

        const dist = Math.hypot(p.x - b.pos.x, p.z - b.pos.z);
        if (b.sprite) {
          b.sprite.visible = dist < 40.0;
        }

        // Proximity detection (12 meters) to unlock
        if (dist < 12.0 && !b.discovered) {
          unlockDiscovery(b.data);
        }
      }
    }
  };
}
