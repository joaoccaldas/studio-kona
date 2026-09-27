// Interactive 3D Artifact & Bike Inspection Modal
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { playUnlockFanfare } from './audio.js';

let modalEl = null;
let viewerScene, viewerCamera, viewerRenderer, viewerControls;
let currentLoadedMesh = null;
let animReq = null;

export function initArtifactModal(onSaveCallback) {
  // Create Modal DOM if not present
  if (!document.querySelector('#artifactModal')) {
    const div = document.createElement('div');
    div.id = 'artifactModal';
    div.className = 'artifact-overlay';
    div.innerHTML = `
      <div class="artifact-card">
        <button type="button" class="artifact-close" id="artifactCloseBtn" aria-label="Close">✕</button>
        <div class="artifact-badge" id="artifactBadge">★ HISTORICAL ARTIFACT UNLOCKED</div>
        <div class="artifact-grid">
          <div class="artifact-3d-wrap">
            <canvas id="artifactCanvas"></canvas>
            <div class="artifact-3d-hint">Drag to rotate 360° · Scroll to inspect details</div>
          </div>
          <div class="artifact-info">
            <div class="artifact-meta" id="artifactYear">1989 · KAILUA-KONA</div>
            <h2 id="artifactTitle">Dave Scott Centurion Iron War Special</h2>
            <div class="artifact-athlete" id="artifactAthlete">Athlete: Dave Scott · 8:09:15</div>
            <div class="artifact-story" id="artifactStory">...</div>

            <div class="artifact-specs">
              <h3>Technical Specifications & Lineage</h3>
              <div id="artifactSpecsList"></div>
            </div>

            <div class="artifact-actions">
              <button type="button" class="btn-collect" id="artifactCollectBtn">★ Collect into My Museum</button>
              <a href="#" target="_blank" class="btn-portal" id="artifactPortalBtn">Explore Story in TriAtlas Portal ↗</a>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  modalEl = document.querySelector('#artifactModal');
  const closeBtn = document.querySelector('#artifactCloseBtn');
  const collectBtn = document.querySelector('#artifactCollectBtn');

  closeBtn.onclick = () => closeArtifactModal();

  // Initialize dedicated 3D viewer inside modal
  const canvas = document.querySelector('#artifactCanvas');
  viewerRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  viewerRenderer.outputColorSpace = THREE.SRGBColorSpace;
  viewerRenderer.toneMapping = THREE.AgXToneMapping;
  viewerRenderer.toneMappingExposure = 1.1;

  viewerScene = new THREE.Scene();
  viewerCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  viewerCamera.position.set(1.5, 0.6, 2.2);

  viewerControls = new OrbitControls(viewerCamera, canvas);
  viewerControls.enableDamping = true;
  viewerControls.dampingFactor = 0.08;
  viewerControls.autoRotate = true;
  viewerControls.autoRotateSpeed = 1.5;
  viewerControls.minDistance = 0.8;
  viewerControls.maxDistance = 5.0;

  // Studio lighting
  const amb = new THREE.AmbientLight(0xffffff, 1.2);
  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(3, 4, 3);
  const fill = new THREE.DirectionalLight(0x90c5ff, 1.4);
  fill.position.set(-3, 2, -2);
  const rim = new THREE.DirectionalLight(0xffcc44, 2.0);
  rim.position.set(0, 3, -4);
  viewerScene.add(amb, key, fill, rim);

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight || 340;
    viewerRenderer.setSize(w, h, false);
    viewerCamera.aspect = w / h;
    viewerCamera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  setTimeout(resize, 50);

  function renderLoop() {
    viewerControls.update();
    viewerRenderer.render(viewerScene, viewerCamera);
    animReq = requestAnimationFrame(renderLoop);
  }
  renderLoop();

  return {
    show(artifact, isNewUnlock = true, onSave = null) {
      if (!artifact) return;
      playUnlockFanfare();

      modalEl.classList.add('active');
      document.querySelector('#artifactBadge').textContent = isNewUnlock ? '★ HISTORICAL ARTIFACT UNLOCKED' : '✦ MUSEUM EXHIBIT';
      document.querySelector('#artifactYear').textContent = `${artifact.year} · KAILUA-KONA`;
      document.querySelector('#artifactTitle').textContent = artifact.name;
      document.querySelector('#artifactAthlete').textContent = `Athlete: ${artifact.athlete} · ${artifact.split}`;
      document.querySelector('#artifactStory').textContent = artifact.story;

      const portalBtn = document.querySelector('#artifactPortalBtn');
      if (portalBtn && artifact.portalUrl) {
        portalBtn.href = artifact.portalUrl;
        portalBtn.style.display = 'inline-flex';
      }

      // Specs list
      const specsList = document.querySelector('#artifactSpecsList');
      specsList.innerHTML = '';
      if (artifact.specs) {
        for (const [k, v] of Object.entries(artifact.specs)) {
          const item = document.createElement('div');
          item.className = 'spec-row';
          item.innerHTML = `<span class="spec-k">${k.toUpperCase()}:</span> <span class="spec-v">${v}</span>`;
          specsList.appendChild(item);
        }
      }

      collectBtn.onclick = () => {
        collectBtn.textContent = '✓ Saved in My Museum';
        collectBtn.classList.add('saved');
        if (onSave) onSave(artifact);
        if (onSaveCallback) onSaveCallback(artifact);
      };

      // Load 3D model into viewer
      if (currentLoadedMesh) {
        viewerScene.remove(currentLoadedMesh);
        currentLoadedMesh = null;
      }

      const modelPath = 'assets/bikes/' + (artifact.modelFile || 'speedmax_2019_slx.glb');
      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(modelPath, gltf => {
        currentLoadedMesh = gltf.scene;

        // Auto center and scale
        const box = new THREE.Box3().setFromObject(currentLoadedMesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.6 / (maxDim || 1);

        currentLoadedMesh.scale.setScalar(scale);
        currentLoadedMesh.position.sub(center.clone().multiplyScalar(scale));
        currentLoadedMesh.position.y += 0.1;

        viewerScene.add(currentLoadedMesh);
        viewerControls.reset();
        viewerCamera.position.set(1.5, 0.6, 2.2);
        viewerControls.target.set(0, 0, 0);
      });
    },

    close() {
      closeArtifactModal();
    }
  };
}

function closeArtifactModal() {
  if (modalEl) modalEl.classList.remove('active');
}
