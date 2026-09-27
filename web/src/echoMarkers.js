// 3D Spatial Beacon, Memory Echo & HUD Compass Navigation System
import * as THREE from 'three';

export function createEchoMarkers(ctx) {
  const { scene, W, heightAt } = ctx;

  const beaconGroup = new THREE.Group();
  scene.add(beaconGroup);

  // 1. Shimmering light cylinder beam
  const beamGeo = new THREE.CylinderGeometry(0.8, 1.8, 65, 16, 1, true);
  beamGeo.translate(0, 32.5, 0);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffcc33,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beaconGroup.add(beam);

  // 2. Pulsing ground rings
  const ringGeo = new THREE.RingGeometry(1.5, 2.8, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffcc33,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.1;
  beaconGroup.add(ring);

  // 3. Floating glowing core orb
  const orbGeo = new THREE.IcosahedronGeometry(0.7, 3);
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xffdd44,
    emissive: 0xffaa00,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.5
  });
  const orb = new THREE.Mesh(orbGeo, orbMat);
  orb.position.y = 1.8;
  beaconGroup.add(orb);

  // 4. Floating 3D Text Label
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const labelCtx = labelCanvas.getContext('2d');
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture,
    depthTest: false,
    sizeAttenuation: false,
    fog: false
  }));
  labelSprite.scale.set(0.24, 0.06, 1);
  labelSprite.position.y = 3.6;
  labelSprite.renderOrder = 30;
  beaconGroup.add(labelSprite);

  function updateLabel(title, isEcho) {
    labelCtx.clearRect(0, 0, 512, 128);
    labelCtx.fillStyle = isEcho ? 'rgba(255, 30, 80, 0.88)' : 'rgba(10, 25, 40, 0.88)';
    labelCtx.strokeStyle = isEcho ? '#ff99bb' : '#ffcc33';
    labelCtx.lineWidth = 4;
    labelCtx.beginPath();
    labelCtx.roundRect(10, 14, 492, 100, 20);
    labelCtx.fill();
    labelCtx.stroke();

    labelCtx.font = 'bold 34px system-ui, sans-serif';
    labelCtx.fillStyle = '#ffffff';
    labelCtx.textAlign = 'center';
    labelCtx.textBaseline = 'middle';
    labelCtx.fillText(title, 256, 64);
    labelTexture.needsUpdate = true;
  }

  let activeTarget = null;
  let activeRadius = 15;
  let isCurrentEcho = false;
  let beaconWorldPos = new THREE.Vector3();

  return {
    setTarget(targetXY, label, radius = 15, isEcho = false, color = 0xffcc33) {
      if (!targetXY) {
        beaconGroup.visible = false;
        activeTarget = null;
        return;
      }

      activeTarget = targetXY;
      activeRadius = radius;
      isCurrentEcho = isEcho;
      beaconGroup.visible = true;

      const [x, y] = targetXY;
      let groundZ = Math.max(heightAt ? heightAt(x, y) : 0, 0.2);

      // Kailua Pier deck clamp
      if (x >= -58 && x <= 28 && y >= -48 && y <= 72) {
        groundZ = 2.15;
      }

      beaconWorldPos = W(x, y, groundZ);
      beaconGroup.position.copy(beaconWorldPos);

      // Color adjustments
      beamMat.color.setHex(color);
      ringMat.color.setHex(color);
      orbMat.color.setHex(color);
      orbMat.emissive.setHex(color);

      updateLabel(label, isEcho);
    },

    getBeaconPosition() {
      return beaconWorldPos.clone();
    },

    update(dt, camera) {
      if (!beaconGroup.visible || !activeTarget) return { distance: 9999, reached: false, angleDeg: 0 };

      // Floating animation
      const t = Date.now() * 0.003;
      orb.position.y = 1.8 + Math.sin(t * 1.5) * 0.25;
      ring.scale.setScalar(1.0 + Math.sin(t * 2.0) * 0.18);
      ring.rotation.z += dt * 0.5;
      beam.rotation.y += dt * 0.3;

      // Distance check in survey space
      const camX = camera.position.x;
      const camY = -camera.position.z;
      const dist = Math.hypot(camX - activeTarget[0], camY - activeTarget[1]);

      // Angle calculation for compass HUD
      const dx = activeTarget[0] - camX;
      const dy = activeTarget[1] - camY;
      const targetAngle = Math.atan2(dx, dy); // 0 = North

      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      const camAngle = Math.atan2(camDir.x, -camDir.z);

      let relAngle = (targetAngle - camAngle);
      while (relAngle > Math.PI) relAngle -= Math.PI * 2;
      while (relAngle < -Math.PI) relAngle += Math.PI * 2;
      const angleDeg = relAngle * (180 / Math.PI);

      return {
        distance: dist,
        reached: dist <= activeRadius,
        angleDeg,
        isEcho: isCurrentEcho
      };
    }
  };
}
