// Apartment atmosphere and feedback: sunlight with soft contact shadows, a light shaft with drifting dust,
// landing bursts, combo pops, small synth sounds and confetti. Everything is cheap enough for a phone.
import * as THREE from 'three';

// ---------------------------------------------------------------- light
export function addRoomLight({ renderer, scene, W, coarse, casters }) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const sun = new THREE.DirectionalLight(0xffe7c2, 2.2);
  sun.position.copy(W(-2.2, 7, 5.4));                        // low morning sun through the back window
  sun.target.position.copy(W(0.2, 0, 0));
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  // The room itself is baked (unlit), so shadows land on an invisible catcher laid on the floor.
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), new THREE.ShadowMaterial({ opacity: 0.26 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.004;
  catcher.receiveShadow = true;
  scene.add(catcher);
  for (const o of casters) o.traverse?.(m => { if (m.isMesh) m.castShadow = true; });

  // Light shaft from the window toward the floor, brightest near the glass.
  const win = W(-1.0, 2.45, 1.6), floorHit = W(-0.2, 0.2, 0);
  const dir = floorHit.clone().sub(win);
  const len = dir.length();
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    // Faded by the view angle so the cone never shows a hard outline, and along its length toward the floor.
    vertexShader: `varying vec2 vUv; varying float vFacing;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec2 vUv; varying float vFacing; uniform float uTime;
      void main(){ float along = pow(vUv.y, 1.4);
        float a = along * pow(vFacing, 2.5) * (0.07 + 0.015 * sin(uTime * 0.7 + vUv.x * 6.0));
        gl_FragColor = vec4(1.0, 0.86, 0.62, a); }`,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.25, len, 12, 1, true), shaftMat);
  shaft.position.copy(win.clone().add(dir.clone().multiplyScalar(0.5)));
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  shaft.renderOrder = 5;
  scene.add(shaft);

  // Dust motes drifting inside the shaft.
  const N = coarse ? 90 : 180, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < N; i++) {
    const t = rnd(), r = 0.9 * Math.sqrt(rnd()), a = rnd() * Math.PI * 2;
    const p = win.clone().add(dir.clone().multiplyScalar(t));
    pos.set([p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.6, p.z + Math.sin(a) * r], i * 3);
    seed[i] = rnd() * 100;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const base = pos.slice();
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff1d8, size: 0.012, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  return function update(t) {
    shaftMat.uniforms.uTime.value = t;
    for (let i = 0; i < N; i++) {
      const s = seed[i];
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.21 + s) * 0.06;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.13 + s * 2) * 0.08;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.17 + s) * 0.06;
    }
    dustGeo.attributes.position.needsUpdate = true;
  };
}

// ---------------------------------------------------------------- bursts (a ring of little sparks where an item lands)
export function createBursts(scene) {
  const live = [];
  const geo = new THREE.SphereGeometry(0.018, 6, 4);
  const colors = [0x2e6f73, 0xd9785b, 0xf3d9a4, 0x3e8ea0];
  function burst(at, n = 12) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
      const a = (i / n) * Math.PI * 2;
      m.position.copy(at);
      scene.add(m);
      live.push({ m, v: new THREE.Vector3(Math.cos(a) * 0.9, 1.1 + Math.random() * 0.6, Math.sin(a) * 0.9), t: 0 });
    }
  }
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.t += dt;
      p.v.y -= 3.2 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.material.opacity = Math.max(0, 1 - p.t / 0.6);
      if (p.t > 0.6) { scene.remove(p.m); p.m.material.dispose(); live.splice(i, 1); }
    }
  }
  return { burst, update };
}

// ---------------------------------------------------------------- sound: tiny synth cues, started on the first tap
export function createSfx() {
  let ctx = null;
  const on = () => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch { ctx = null; } return ctx; };
  function tone(freq, dur = 0.12, type = 'sine', gain = 0.06, slide = 0) {
    const c = on();
    if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  return {
    unlock: on,
    pack: combo => tone(520 * Math.pow(1.122, Math.min(combo - 1, 8)), 0.14, 'triangle', 0.07, 1.25),
    trap: () => tone(180, 0.22, 'square', 0.035, 0.6),
    step: () => tone(740, 0.09, 'sine', 0.04),
    done: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.06), i * 110)),
  };
}

// ---------------------------------------------------------------- confetti over the page (2D, short, reduced-motion aware)
export function confetti(host) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'apt-confetti';
  cv.width = innerWidth * devicePixelRatio;
  cv.height = innerHeight * devicePixelRatio;
  host.appendChild(cv);
  const c = cv.getContext('2d');
  c.scale(devicePixelRatio, devicePixelRatio);
  const cols = ['#2E6F73', '#D9785B', '#F3D9A4', '#3E8EA0', '#13293D'];
  const bits = Array.from({ length: 90 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 9, vy: -6 - Math.random() * 7, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, c: cols[(Math.random() * cols.length) | 0], w: 5 + Math.random() * 5 }));
  const t0 = performance.now();
  (function step(now) {
    const t = (now - t0) / 1000;
    c.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.28; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vx *= 0.99;
      c.save(); c.translate(b.x, b.y); c.rotate(b.r); c.globalAlpha = Math.max(0, 1 - t / 2.2);
      c.fillStyle = b.c; c.fillRect(-b.w / 2, -b.w / 4, b.w, b.w / 2); c.restore();
    }
    if (t < 2.2) requestAnimationFrame(step); else cv.remove();
  })(t0);
}
