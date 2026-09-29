// Advanced Locomotion & Physics Engine for Kona 3D World
import * as THREE from 'three';
import { playFootstep, playWaterSplash, playJump } from './audio.js';
const DEBUG_BOOST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

export function createLocomotion(ctx) {
  const { camera, renderer, scene, W, grounds, heightAt, toast, onModeRequest } = ctx;

  // ---- Bike model constants (Speedmax CFR AXS, rider + bike ~ 89 kg)
  const MASS = 89, G = 9.81, RHO = 1.18, CRR = 0.0035, WHEEL_R = 0.3395, WHEELBASE = 1.013;
  const RINGS = [50, 37], COGS = [10, 11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 33];
  // Kona trade winds blow from the ENE; they build north along the Queen K toward Kohala/Hāwī.
  function windAt(x, z, t) {
    const north = -z;
    const base = 4.5 + 7 * THREE.MathUtils.smoothstep(north, 2000, 45000);
    const gust = 1 + 0.28 * Math.sin(t * 0.7 + x * 0.0013) + 0.18 * Math.sin(t * 1.9 + north * 0.002);
    const m = base * gust;
    return new THREE.Vector3(-0.9 * m, 0, 0.44 * m); // blowing toward WSW (three: west = -x, south = +z)
  }

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
    stick: new THREE.Vector2(),        // on-screen joystick (touchControls.js)
    fixedStick: false,                 // when the on-screen joystick exists, canvas touches only look around
    cruise: false,                     // bike: keep pedalling without holding the stick
    tuckHold: false,                   // bike: tuck button held
    boostT: 0,                         // seconds of ring boost left
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
    if (e.code === 'Space' && state.active && state.isGrounded && !state.isSwimming && state.mode !== 'bike') {
      state.verticalVelocity = state.mode === 'bike' ? 4.2 : 5.6;
      state.isGrounded = false;
      playJump();
    }
    if (e.code === 'KeyB' && state.active && !state.isSwimming) {
      const next = state.mode === 'walk' ? 'bike' : 'walk';
      // Single source of truth: let the app switch modes so the HUD/buttons stay in sync.
      if (onModeRequest) onModeRequest(next);
      else state.mode = next;
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
      if (t.clientX < w * 0.45 && !touch.activeLeft && !state.fixedStick) {
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
    setStick(x, y) { state.stick.set(x, y); },
    useFixedStick(on) { state.fixedStick = on; },
    setCruise(on) { state.cruise = !!on; return state.cruise; },
    setTuck(on) { state.tuckHold = !!on; },
    boost(sec = 2.5) { state.boostT = Math.max(state.boostT, sec); if (state.bike) state.bike.v = Math.max(state.bike.v, 11); },
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
      if (state.active && state.isGrounded && !state.isSwimming && state.mode !== 'bike') {
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
      if (state.stick.lengthSq() > 0.01) {
        f += state.stick.y;
        r += state.stick.x;
      }
      if (state.cruise && state.mode === 'bike' && f > -0.3) f = Math.max(f, 1);   // cruise pedals; pull back to brake

      state.isSprinting = !!(keys.ShiftLeft || keys.ShiftRight || state.tuckHold);
      state.boostT = Math.max(0, state.boostT - dt);
      const boost = (DEBUG_BOOST && keys.KeyQ) ? 4.5 : 1.0;   // dev-only: ?debug=1

      // 2. Ground elevation & Swimming check
      const currentGround = getGroundHeight(camera.position.x, camera.position.z, camera.position.y);
      const surveyX = camera.position.x;
      const surveyY = -camera.position.z;
      const onPier = (surveyX >= -58 && surveyX <= 28 && surveyY >= -48 && surveyY <= 72);
      state.isSwimming = (currentGround < 0.1 && !onPier && surveyX < 45 && surveyY > -45);

      let speed = 0, bikeRollTarget = 0;
      const fwd = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);

      if (state.mode === 'bike' && !state.isSwimming) {
        // ---- Bicycle dynamics: power in, aero + rolling + gravity + brakes out; steer, don't strafe.
        const b = state.bike || (state.bike = { v: 0, steer: 0, power: 0, ring: 50, cog: 14, t: 0 });
        b.t += dt;
        const pedal = Math.max(0, f), brake = Math.max(0, -f);
        const targetP = pedal * (state.isSprinting ? 420 : 250) * boost * (state.boostT > 0 ? 1.9 : 1);
        b.power += (targetP - b.power) * Math.min(1, dt * 3);
        const wind = windAt(camera.position.x, camera.position.z, b.t);
        const headW = wind.dot(fwd), crossW = wind.dot(right);
        const va = b.v - headW;                                   // airspeed along heading
        const CdA = state.isSprinting ? 0.215 : 0.245;            // tucked vs. relaxed aero position
        const hA = getGroundHeight(camera.position.x + fwd.x * 1.5, camera.position.z + fwd.z * 1.5, camera.position.y);
        const hB = getGroundHeight(camera.position.x - fwd.x * 1.5, camera.position.z - fwd.z * 1.5, camera.position.y);
        const rawSlope = THREE.MathUtils.clamp((hA - hB) / 3, -0.2, 0.2);
        b.slope = (b.slope || 0) + (rawSlope - (b.slope || 0)) * Math.min(1, dt * 2.5);   // smooth DEM/pier-edge spikes
        const slope = b.slope;
        // standing start: riders get out of the saddle below ~30 km/h, so allow extra torque at low speed
        const launch = 1 + 1.6 * Math.max(0, 1 - b.v / 8.5);
        const Fdrive = b.power * launch / Math.max(b.v, 1.5);
        const Faero = 0.5 * RHO * CdA * va * Math.abs(va);
        const Froll = b.v > 0.05 ? CRR * MASS * G : 0;
        const Fgrav = MASS * G * slope / Math.sqrt(1 + slope * slope);
        const Fbrake = brake * 0.6 * MASS * G;
        b.v = Math.max(0, b.v + (Fdrive - Faero - Froll - Fgrav - Fbrake * Math.sign(b.v || 0)) / MASS * dt);
        // steering: lock shrinks with speed; bicycle yaw-rate model
        const maxSteer = 0.5 / (1 + b.v / 5);
        b.steer += (-r * maxSteer - b.steer) * Math.min(1, dt * 6);
        const yawRate = b.v / WHEELBASE * Math.tan(b.steer);
        state.yaw += yawRate * dt;
        // crosswinds nudge the bars and push the rider sideways (strongest toward Hāwī)
        state.yaw += -crossW * 0.0022 * Math.min(b.v, 12) * dt;
        camera.position.addScaledVector(fwd, b.v * dt).addScaledVector(right, crossW * 0.015 * dt);
        speed = b.v;
        // lean into the turn and against the wind
        bikeRollTarget = THREE.MathUtils.clamp(Math.atan(b.v * yawRate / G) + crossW * 0.008, -0.35, 0.35);
        // gearing: pick the ring/cog that keeps cadence nearest 88 rpm
        const wheelRpm = b.v / (2 * Math.PI * WHEEL_R) * 60;
        let best = null;
        for (const ring of RINGS) for (const cog of COGS) {
          const cad = wheelRpm * cog / ring;
          const cost = Math.abs(cad - 88) + (ring === 37 && b.v > 9 ? 25 : 0);
          if (!best || cost < best.cost) best = { cost, ring, cog, cad };
        }
        b.ring = best.ring; b.cog = best.cog;
        state.cadenceRpm = b.power > 5 ? Math.round(best.cad) : 0;
        state.powerW = Math.round(b.power);
        state.crossWind = crossW;
        state.gradePct = Math.round(slope * 1000) / 10;
        if (b.v > 0.3) {
          state.stepTimer += dt;
          if (state.stepTimer >= 0.35) state.stepTimer = 0;
        }
      } else {
        // ---- On foot / swimming: realistic human speeds
        if (state.isSwimming) speed = 1.3;                        // ~1:17 per 100 m, strong age-grouper
        else speed = state.isSprinting ? 4.2 : 1.7;               // run / walk
        speed *= boost;
        if (state.bike) state.bike.v = 0;
        state.cadenceRpm = 0;
        const move = fwd.clone().multiplyScalar(f).add(right.clone().multiplyScalar(r));
        if (move.lengthSq() > 0.001) {
          move.normalize();
          camera.position.addScaledVector(move, speed * dt);

          state.stepTimer += dt;
          const interval = state.isSwimming ? 0.6 : (state.isSprinting ? 0.3 : 0.52);
          if (state.stepTimer >= interval) {
            state.stepTimer = 0;
            if (state.isSwimming) playWaterSplash();
            else if (state.isGrounded) playFootstep(state.isSprinting);
          }
        } else {
          state.stepTimer = 0;
          speed = 0;
        }
      }
      state.speedKmh = Math.round(speed * 3.6);

      // Roll angle banking in bike mode
      const targetRoll = (state.mode === 'bike' && !state.isSwimming) ? bikeRollTarget : 0;
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
          const b = state.bike || { ring: 50, cog: 14 };
          const cw = state.crossWind || 0;
          const wind = Math.abs(cw) < 1 ? '' : ` · ${cw > 0 ? '→' : '←'} crosswind ${Math.abs(cw * 3.6).toFixed(0)} km/h`;
          const grade = state.gradePct ? ` · ${state.gradePct > 0 ? '+' : ''}${state.gradePct}%` : '';
          modeEl.textContent = `${state.isSprinting ? '⚡ Aero tuck' : '🚴 Speedmax'} · ${state.speedKmh} km/h · ${state.cadenceRpm} rpm · ${b.ring}×${b.cog} · ${state.powerW || 0} W${grade}${wind}`;
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
