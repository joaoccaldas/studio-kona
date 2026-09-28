// Advanced Locomotion & Physics Engine for Kona 3D World
import * as THREE from 'three';
import { playFootstep, playWaterSplash, playJump } from './audio.js';
const DEBUG_BOOST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

export function createLocomotion(ctx) {
  const { camera, renderer, scene, W, grounds, heightAt, toast } = ctx;

  const state = {
    active: false,
    mode: 'walk', // 'walk' | 'bike'
    yaw: 0,
    pitch: 0,
    roll: 0,
    velocity: new THREE.Vector3(),
    verticalVelocity: 0,
    isGrounded: true,
    isSwimming: false,
    isSprinting: false,
    moveInput: new THREE.Vector2(),
    stepTimer: 0,
    pointerLocked: false,
    lastValidGroundY: 2.15,
    speedKmh: 0,
    cadenceRpm: 0,
  };

  const keys = {};
  let isMouseDown = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  const touch = {
    activeLeft: false,
    leftId: null,
    leftOrigin: { x: 0, y: 0 },
    leftCurrent: { x: 0, y: 0 },
    activeRight: false,
    rightId: null,
    rightLast: { x: 0, y: 0 },
  };

  // Keyboard events
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space' && state.active && state.isGrounded && !state.isSwimming) {
      state.verticalVelocity = state.mode === 'bike' ? 4.2 : 5.6;
      state.isGrounded = false;
      playJump();
    }
    if (e.code === 'KeyB' && state.active && !state.isSwimming) {
      state.mode = state.mode === 'walk' ? 'bike' : 'walk';
      if (toast) {
        toast(state.mode === 'bike' ? '🚴 Mounted Speedmax CFR: Aero Cruise (Shift to Sprint)' : '🚶 Dismounted: Walking on foot');
      }
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.code] = false;
  });

  // Desktop Mouse Look: Supports BOTH Pointer Lock AND Drag-to-Look
  const canvas = renderer.domElement;

  canvas.addEventListener('mousedown', e => {
    if (!state.active) return;
    isMouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    // Optional pointer lock request on primary click
    if (!state.pointerLocked && e.button === 0 && document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock?.();
      } catch (err) {}
    }
  });

  window.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  document.addEventListener('pointerlockchange', () => {
    state.pointerLocked = document.pointerLockElement === canvas;
    const hint = document.querySelector('#walkHint');
    if (hint) {
      hint.style.display = state.active && !state.pointerLocked ? 'block' : 'none';
    }
  });

  window.addEventListener('mousemove', e => {
    if (!state.active) return;
    const sens = 0.0024;

    if (state.pointerLocked) {
      state.yaw -= e.movementX * sens;
      state.pitch = THREE.MathUtils.clamp(state.pitch - e.movementY * sens, -1.35, 1.35);
    } else if (isMouseDown) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      state.yaw -= dx * sens;
      state.pitch = THREE.MathUtils.clamp(state.pitch - dy * sens, -1.35, 1.35);
    }
  });

  // Mobile Dual Touch Controls
  canvas.addEventListener('touchstart', e => {
    if (!state.active) return;
    const w = window.innerWidth;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < w * 0.45 && !touch.activeLeft) {
        touch.activeLeft = true;
        touch.leftId = t.identifier;
        touch.leftOrigin = { x: t.clientX, y: t.clientY };
        touch.leftCurrent = { x: t.clientX, y: t.clientY };
        updateStickUI(true, t.clientX, t.clientY, 0, 0);
      } else if (t.clientX >= w * 0.45 && !touch.activeRight) {
        touch.activeRight = true;
        touch.rightId = t.identifier;
        touch.rightLast = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    if (!state.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (touch.activeLeft && t.identifier === touch.leftId) {
        touch.leftCurrent = { x: t.clientX, y: t.clientY };
        const dx = touch.leftCurrent.x - touch.leftOrigin.x;
        const dy = touch.leftCurrent.y - touch.leftOrigin.y;
        const maxR = 45;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, maxR);
        const angle = Math.atan2(dy, dx);
        const stickX = Math.cos(angle) * (clampedDist / maxR);
        const stickY = -Math.sin(angle) * (clampedDist / maxR);
        state.moveInput.set(stickX, stickY);
        updateStickUI(true, touch.leftOrigin.x, touch.leftOrigin.y, dx, dy);
      } else if (touch.activeRight && t.identifier === touch.rightId) {
        const dx = t.clientX - touch.rightLast.x;
        const dy = t.clientY - touch.rightLast.y;
        touch.rightLast = { x: t.clientX, y: t.clientY };
        const sens = 0.0045;
        state.yaw -= dx * sens;
        state.pitch = THREE.MathUtils.clamp(state.pitch - dy * sens, -1.3, 1.3);
      }
    }
    e.preventDefault();
  }, { passive: false });

  const endTouch = e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (touch.activeLeft && t.identifier === touch.leftId) {
        touch.activeLeft = false;
        touch.leftId = null;
        state.moveInput.set(0, 0);
        updateStickUI(false);
      } else if (touch.activeRight && t.identifier === touch.rightId) {
        touch.activeRight = false;
        touch.rightId = null;
      }
    }
  };
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  function updateStickUI(show, originX = 0, originY = 0, dx = 0, dy = 0) {
    const base = document.querySelector('#touchJoyBase');
    const knob = document.querySelector('#touchJoyKnob');
    if (!base || !knob) return;
    if (!show) {
      base.style.display = 'none';
      return;
    }
    base.style.display = 'block';
    base.style.left = `${originX - 45}px`;
    base.style.top = `${originY - 45}px`;
    const dist = Math.hypot(dx, dy);
    const maxR = 36;
    const clampedR = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedR;
    const ky = Math.sin(angle) * clampedR;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
  }

  // Downward raycaster with BVH acceleration
  const ray = new THREE.Raycaster();
  ray.firstHitOnly = true;

  function getGroundHeight(x, z, fromY = 2.0) {
    const surveyX = x;
    const surveyY = -z;

    // 1. Pier special boundary check (Kailua Pier deck is solid at ~2.15m)
    // Survey x in [-60, 30], survey y in [-50, 75]
    if (surveyX >= -58 && surveyX <= 28 && surveyY >= -48 && surveyY <= 72) {
      state.lastValidGroundY = 2.15;
      return 2.15;
    }

    // 2. Raycast against ground meshes (terrain, pier, heiau, roads)
    const validGrounds = [...grounds].filter(g => g && g.isMesh);
    if (validGrounds.length > 0) {
      const rayOriginY = Math.max(fromY + 30, 40);
      ray.set(new THREE.Vector3(x, rayOriginY, z), new THREE.Vector3(0, -1, 0));
      ray.far = 120;
      const hits = ray.intersectObjects(validGrounds, false);
      if (hits.length > 0) {
        hits.sort((a, b) => b.point.y - a.point.y);
        for (const h of hits) {
          if (h.point && h.point.y >= -1.0) {
            state.lastValidGroundY = h.point.y;
            return h.point.y;
          }
        }
      }
    }

    // 3. Fallback to island DEM elevation grid
    let demH = heightAt ? heightAt(surveyX, surveyY) : 0;
    if (Number.isFinite(demH) && demH > -10) {
      state.lastValidGroundY = Math.max(demH, 0);
      return Math.max(demH, 0);
    }

    return state.lastValidGroundY;
  }

  return {
    setActive(on) {
      state.active = on;
      document.body.classList.toggle('walking', on);
      const hint = document.querySelector('#walkHint');
      if (hint) hint.style.display = on && !state.pointerLocked ? 'block' : 'none';

      if (on) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        state.yaw = Math.atan2(-dir.x, -dir.z);
        state.pitch = Math.asin(dir.y);
        state.verticalVelocity = 0;

        // Ground clamping
        const gh = getGroundHeight(camera.position.x, camera.position.z, camera.position.y);
        camera.position.y = Math.max(gh ?? 0, 0.4) + 1.7;
      } else {
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock?.();
        }
      }
    },

    teleport(x, y, z, yaw = null, pitch = null) {
      camera.position.set(x, y, z);
      state.verticalVelocity = 0;
      state.isGrounded = true;
      if (yaw !== null) state.yaw = yaw;
      if (pitch !== null) state.pitch = pitch;
      const gh = getGroundHeight(x, z, y);
      camera.position.y = Math.max(gh ?? 0, 0.4) + 1.7;
    },

    setPosition(x, y, z) {
      camera.position.set(x, y, z);
      state.verticalVelocity = 0;
      state.isGrounded = true;
    },

    setRotation(pitch, yaw) {
      state.pitch = pitch;
      state.yaw = yaw;
    },

    jump() {
      if (state.active && state.isGrounded && !state.isSwimming) {
        state.verticalVelocity = 5.6;
        state.isGrounded = false;
        playJump();
      }
    },

    update(dt) {
      if (!state.active) return;

      // 1. Input direction
      let f = 0, r = 0;
      if (keys.KeyW || keys.ArrowUp) f += 1;
      if (keys.KeyS || keys.ArrowDown) f -= 1;
      if (keys.KeyD || keys.ArrowRight) r += 1;
      if (keys.KeyA || keys.ArrowLeft) r -= 1;

      if (state.moveInput.lengthSq() > 0.01) {
        f += state.moveInput.y;
        r += state.moveInput.x;
      }

      state.isSprinting = !!(keys.ShiftLeft || keys.ShiftRight);
      const boost = (DEBUG_BOOST && keys.KeyQ) ? 4.5 : 1.0;   // dev-only: ?debug=1

      // 2. Ground elevation & Swimming check
      const currentGround = getGroundHeight(camera.position.x, camera.position.z, camera.position.y);
      const surveyX = camera.position.x;
      const surveyY = -camera.position.z;
      const onPier = (surveyX >= -58 && surveyX <= 28 && surveyY >= -48 && surveyY <= 72);
      state.isSwimming = (currentGround < 0.1 && !onPier && surveyX < 45 && surveyY > -45);

      let speed = 2.4;
      if (state.isSwimming) {
        speed = 2.0;
      } else if (state.mode === 'bike') {
        speed = state.isSprinting ? 18.5 : 12.0;
      } else {
        speed = state.isSprinting ? 5.2 : 2.4;
      }
      speed *= boost;

      state.speedKmh = Math.round(speed * 3.6);
      state.cadenceRpm = Math.round(state.speedKmh * 2.2);

      // 3. Horizontal movement
      const fwd = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const move = fwd.multiplyScalar(f).add(right.multiplyScalar(r));

      if (move.lengthSq() > 0.001) {
        move.normalize();
        camera.position.addScaledVector(move, speed * dt);

        state.stepTimer += dt;
        const interval = state.isSwimming ? 0.6 : (state.mode === 'bike' ? 0.35 : (state.isSprinting ? 0.26 : 0.4));
        if (state.stepTimer >= interval) {
          state.stepTimer = 0;
          if (state.isSwimming) {
            playWaterSplash();
          } else if (state.isGrounded && state.mode === 'walk') {
            playFootstep(state.isSprinting);
          }
        }
      } else {
        state.stepTimer = 0;
      }

      // Roll angle banking in bike mode
      const targetRoll = (state.mode === 'bike' && !state.isSwimming) ? THREE.MathUtils.clamp(-r * 0.12, -0.22, 0.22) : 0;
      state.roll = THREE.MathUtils.lerp(state.roll, targetRoll, Math.min(1, dt * 9));

      // 4. Vertical physics
      const gh = getGroundHeight(camera.position.x, camera.position.z, camera.position.y);

      if (state.isSwimming) {
        // Water surface bobbing
        const waterSurface = 0.35;
        const bob = Math.sin(Date.now() * 0.003) * 0.08;
        const targetY = waterSurface + bob;
        camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 7);
        state.verticalVelocity = 0;
        state.isGrounded = false;
      } else {
        const eyeOffset = state.mode === 'bike' ? (state.isSprinting ? 1.35 : 1.5) : 1.7;
        const targetEyeY = (gh ?? 0) + eyeOffset;

        if (!state.isGrounded) {
          state.verticalVelocity -= 17.0 * dt;
          camera.position.y += state.verticalVelocity * dt;

          if (camera.position.y <= targetEyeY) {
            camera.position.y = targetEyeY;
            state.verticalVelocity = 0;
            state.isGrounded = true;
          }
        } else {
          // Smooth terrain hugging
          camera.position.y += (targetEyeY - camera.position.y) * Math.min(1, dt * 14);
        }
      }

      // 5. Camera orientation with pitch, yaw, and banking roll
      camera.rotation.set(0, 0, 0);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = state.yaw;
      camera.rotation.x = state.pitch;
      camera.rotation.z = state.roll;

      // HUD Mode label
      const modeEl = document.querySelector('#mode');
      if (modeEl) {
        if (state.isSwimming) {
          modeEl.textContent = '🏊 Swimming in Kailua Bay';
        } else if (state.mode === 'bike') {
          const kmh = Math.round(speed * 3.6);
          const rpm = Math.round(kmh * 2.2);
          modeEl.textContent = state.isSprinting
            ? `⚡ Aero Sprint · ${kmh} km/h · ${rpm} RPM · 54x11`
            : `🚴 Speedmax Ride · ${kmh} km/h · ${rpm} RPM · 54x14`;
        } else {
          modeEl.textContent = state.isSprinting ? '⚡ Sprinting' : '🚶 Athlete Walking';
        }
      }
    },

    setMode(mode) {
      if (['walk', 'bike'].includes(mode)) {
        state.mode = mode;
      }
    },

    getState() {
      return state;
    },

    getPosition() {
      return camera.position.clone();
    }
  };
}
