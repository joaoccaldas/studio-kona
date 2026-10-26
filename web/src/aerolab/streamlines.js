import * as THREE from 'three';

// Obstacle proxies for a Speedmax-style tri bike in bike space (metres; x forward, y up, z lateral).
// [x, y, z, radius]. Tuned to the size-M asset: head tube, downtube, BB, seat mast, saddle, AeroShield, ...
export const BIKE_OBSTACLES = [[.47, .72, 0, .09], [.25, .5, 0, .07], [.02, .3, 0, .08], [-.1, .62, 0, .07], [-.16, .99, 0, .1],
  [.62, .98, 0, .15], [.4, .95, 0, .1], [-.33, 1.05, 0, .1], [.6, .34, 0, .05], [-.41, .34, 0, .06], [.14, .74, 0, .06]];

// Rider proxies from a fit pose (fit.mjs pose(): head / shoulder / hip in bike space).
export function riderObstacles(pose) {
  if (!pose) return [];
  return [[pose.head[0], pose.head[1], 0, .13], [pose.shoulder[0], pose.shoulder[1], 0, .17], [pose.hip[0], pose.hip[1], 0, .15]];
}

const rand = n => ((Math.sin(n * 127.1 + 41.7) * 43758.5453) % 1 + 1) % 1;   // deterministic, so rebuilds don't flicker

/**
 * Illustrative smoke streamlines deflected around obstacle proxies. Not CFD.
 * @param {object} [o]
 * @param {number} [o.lines=64]        number of streamlines (use ~32 on phones)
 * @param {number} [o.segments=90]
 * @param {number} [o.length=4.8]      streamline length in metres (x from +L/2 to -L/2)
 * @param {THREE.ColorRepresentation} [o.color=0xbfe9ff]
 * @param {number} [o.opacity=0.075]
 * @returns {{group:THREE.Group, rebuild:(obstacles:number[][])=>void, setYaw:(rad:number)=>void, update:(dt:number, airSpeed?:number)=>void, dispose:()=>void}}
 */
export function createStreamlines({ lines = 64, segments = 90, length = 4.8, color = 0xbfe9ff, opacity = 0.075 } = {}) {
  const group = new THREE.Group();
  group.name = 'Illustrative streamlines';
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, col: { value: new THREE.Color(color) }, alpha: { value: opacity } },
    vertexShader: 'attribute float along; attribute float seed; varying float va; varying float vs; void main(){ va=along; vs=seed; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float t; uniform vec3 col; uniform float alpha; varying float va; varying float vs; void main(){ float p=fract(va*3.0 - t*0.55 + vs*7.0); float a=smoothstep(0.,.25,p)*smoothstep(1.,.55,p); float edge=smoothstep(0.,.08,va)*smoothstep(1.,.9,va); gl_FragColor=vec4(col, a*edge*alpha); }',
  });
  let mesh = null, clock = 0;

  function rebuild(obstacles = BIKE_OBSTACLES) {
    if (mesh) { mesh.geometry.dispose(); group.remove(mesh); }
    const pos = [], along = [], seed = [], idx = [];
    for (let k = 0; k < lines; k++) {
      const y0 = .08 + rand(k + 1) * 1.75, z0 = (rand(k + 211) - .5) * .85, sd = rand(k + 731);
      for (let i = 0; i < segments; i++) {
        const x = length / 2 - length * i / (segments - 1);
        let y = y0, z = z0;
        for (const [cx, cy, cz, r] of obstacles) {
          const dy = y0 - cy, dz = z0 - cz, q = Math.hypot(dy, dz * 2.2) + 1e-4;
          if (q < r * 2.2) {
            const g = Math.exp(-Math.pow((x - cx) / (r * 2.4), 2));
            const push = (r * 2.2 - q) * .55 * g;
            y += dy / q * push; z += dz / q * push * 1.4 + Math.sign(dz || .01) * push * .5;
          }
        }
        pos.push(x, y, z); along.push(i / (segments - 1)); seed.push(sd);
      }
      for (let i = 0; i < segments - 1; i++) idx.push(k * segments + i, k * segments + i + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
    g.setIndex(idx);
    mesh = new THREE.LineSegments(g, material);
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  rebuild();
  return {
    group,
    rebuild,
    /** Apparent-wind yaw (radians, from aero.mjs compare/forces). Rotates the flow about the vertical axis. */
    setYaw(rad) { group.rotation.y = -rad; },
    /** Advance the smoke; airSpeed in m/s scales the animation relative to 40 km/h. */
    update(dt, airSpeed = 40 / 3.6) { clock += dt * airSpeed / (40 / 3.6); material.uniforms.t.value = clock; },
    dispose() { if (mesh) mesh.geometry.dispose(); material.dispose(); },
  };
}
