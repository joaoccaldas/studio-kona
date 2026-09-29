// Third-person play on the island, Roblox/Brawl Stars style: a chunky blocky athlete with a name tag, a camera
// that follows from behind and orbits when you drag, walk/run/jump/swim animations, a bike when riding, and emotes.
// The locomotion engine still moves the (hidden) first-person camera as the player's body; just before each render
// the camera is swung out behind the avatar and put back afterwards, so all the game logic that reads
// camera.position (quests, prompts, rings, tiles) keeps working unchanged.
import * as THREE from 'three';
import { makeRider, pedal } from './rideKit.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const lambert = c => new THREE.MeshLambertMaterial({ color: c });

function faceTexture(skin) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = skin; c.fillRect(0, 0, 128, 128);
  c.fillStyle = '#13293D';
  c.fillRect(34, 46, 14, 20); c.fillRect(80, 46, 14, 20);             // eyes
  c.fillStyle = '#fff'; c.fillRect(38, 48, 5, 6); c.fillRect(84, 48, 5, 6);
  c.strokeStyle = '#13293D'; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.arc(64, 78, 20, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();   // smile
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}
function bibTexture(n) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 96;
  const c = cv.getContext('2d');
  c.fillStyle = '#FBF8F2'; c.fillRect(0, 0, 128, 96);
  c.fillStyle = '#D9785B'; c.fillRect(0, 0, 128, 16);
  c.fillStyle = '#13293D'; c.font = '900 50px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(n), 64, 58);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function tagSprite(text) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d');
  c.font = '800 60px system-ui';
  const w = Math.min(500, c.measureText(text).width + 60);
  c.fillStyle = 'rgba(19,41,61,.72)';
  c.beginPath(); c.roundRect((512 - w) / 2, 22, w, 84, 42); c.fill();
  c.fillStyle = '#FBF8F2'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2, 0.5, 1);
  s.renderOrder = 10;
  return s;
}
function emojiSprite() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const t = new THREE.CanvasTexture(cv);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.setScalar(0.9);
  s.renderOrder = 11;
  s.visible = false;
  s.userData.set = e => { const c = cv.getContext('2d'); c.clearRect(0, 0, 128, 128); c.font = '96px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 64, 70); t.needsUpdate = true; };
  return s;
}

// The blocky athlete. Parts pivot at the joints so walking, waving and swimming are simple rotations.
export function makeBlockyAthlete({ skin = '#b07a52', suit = '#1d3557', bib = 1 } = {}) {
  const g = new THREE.Group();
  const mSkin = lambert(skin), mSuit = lambert(suit), mShoe = lambert(0xfbf8f2), mDark = lambert(0x13293d);
  const box = (m, sx, sy, sz, x, y, z, parent = g) => { const b = new THREE.Mesh(BOX, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.castShadow = true; parent.add(b); return b; };
  const joint = (x, y, z, parent = g) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const hips = joint(0, 0.86, 0);
  const legL = joint(-0.17, 0, 0, hips), legR = joint(0.17, 0, 0, hips);
  for (const l of [legL, legR]) { box(mSkin, 0.3, 0.52, 0.32, 0, -0.26, 0, l); box(mSuit, 0.32, 0.26, 0.34, 0, -0.08, 0, l); box(mShoe, 0.32, 0.14, 0.44, 0, -0.8, 0.05, l); box(mSkin, 0.28, 0.2, 0.3, 0, -0.64, 0, l); }
  const chest = joint(0, 0, 0, hips);
  box(mSuit, 0.72, 0.8, 0.4, 0, 0.4, 0, chest);
  const bibM = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshLambertMaterial({ map: bibTexture(bib) }));
  bibM.position.set(0, 0.34, 0.205); chest.add(bibM);
  const armL = joint(-0.47, 0.72, 0, chest), armR = joint(0.47, 0.72, 0, chest);
  for (const a of [armL, armR]) { box(mSuit, 0.24, 0.3, 0.3, 0, -0.1, 0, a); box(mSkin, 0.22, 0.52, 0.26, 0, -0.48, 0, a); }
  const neck = joint(0, 0.82, 0, chest);
  const faceMats = [mSkin, mSkin, mSkin, mSkin, new THREE.MeshLambertMaterial({ map: faceTexture(skin) }), mSkin];
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56), faceMats);
  head.position.y = 0.3; head.castShadow = true; neck.add(head);
  box(mDark, 0.6, 0.12, 0.62, 0, 0.62, 0, neck);                                  // visor cap
  box(mDark, 0.6, 0.04, 0.3, 0, 0.58, 0.38, neck);
  box(mDark, 0.5, 0.09, 0.03, 0, 0.36, 0.29, neck);                               // sunglasses
  g.userData = { hips, chest, legL, legR, armL, armR, neck };
  return g;
}

export function createThirdPerson({ scene, camera, locomotion, heightAt, player, grounds }) {
  const look = player?.look || {};
  const athlete = makeBlockyAthlete({ skin: look.skin || '#b07a52', suit: look.suit || '#1d3557', bib: player?.bib || 1 });
  const bike = makeRider(look.suit || '#1d3557', 0xfbf8f2, true);
  const tag = tagSprite(player?.name || 'Athlete');
  const emoji = emojiSprite();
  const root = new THREE.Group();
  root.add(athlete, bike, tag, emoji);
  root.visible = false;
  scene.add(root);

  let enabled = true;
  try { enabled = localStorage.getItem('kona-view') !== 'first'; } catch { /* storage blocked */ }
  const st = { t: 0, walk: 0, speed: 0, facing: 0, emote: null, emoteT: 0, dist: 0 };
  const last = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let hasLast = false, snapCam = true;
  const saved = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const tmp = new THREE.Vector3(), target = new THREE.Vector3();
  const ray = new THREE.Raycaster(), dir = new THREE.Vector3();

  function feet() {
    const s = locomotion.getState();
    const p = camera.position;
    const off = s.isSwimming ? 0.35 : s.mode === 'bike' ? (s.isSprinting ? 1.35 : 1.5) : 1.7;
    return tmp.set(p.x, p.y - off, p.z);
  }

  function update(dt) {
    const s = locomotion.getState();
    root.visible = enabled && s.active;
    if (!root.visible) { hasLast = false; snapCam = true; return; }
    st.t += dt;
    const f = feet();
    const moved = hasLast ? Math.hypot(f.x - last.x, f.z - last.z) : 0;
    st.speed += ((dt > 0 ? moved / dt : 0) - st.speed) * Math.min(1, dt * 8);
    if (moved > 0.02 && moved < 5) st.facing = Math.atan2(f.x - last.x, f.z - last.z);
    else if (s.mode === 'bike' || moved >= 5 || !hasLast) { st.facing = s.yaw + Math.PI; athlete.rotation.y = st.facing; snapCam = true; }   // riding, just teleported, or first frame: face away from the camera
    last.copy(f); hasLast = true;
    st.dist += moved;
    root.position.copy(f);
    // Turn smoothly toward the direction of travel.
    let d = st.facing - athlete.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const yaw = athlete.rotation.y + d * Math.min(1, dt * 10);
    athlete.rotation.y = bike.rotation.y = yaw;

    const biking = s.mode === 'bike' && !s.isSwimming;
    athlete.visible = !biking;
    bike.visible = biking;
    tag.position.set(0, biking ? 2.35 : 2.55, 0);
    emoji.position.set(0, biking ? 3.05 : 3.25, 0);
    const u = athlete.userData;
    if (biking) {
      bike.rotation.z = -s.roll * 1.2;
      pedal(bike, st.dist / 7);
      bike.userData.body.position.y = s.isSprinting ? 0.9 : 1.02;
    } else if (s.isSwimming) {
      athlete.rotation.x = Math.PI / 2 * 0.92;
      athlete.position.y = 0.1;
      const a = st.t * 5;
      u.armL.rotation.x = a % (Math.PI * 2); u.armR.rotation.x = (a + Math.PI) % (Math.PI * 2);
      u.legL.rotation.x = Math.sin(a * 2) * 0.35; u.legR.rotation.x = -Math.sin(a * 2) * 0.35;
    } else {
      athlete.rotation.x = 0;
      athlete.position.y = 0;
      const run = Math.min(1, st.speed / 6);
      st.walk += dt * (4 + st.speed * 1.6);
      const sw = Math.sin(st.walk) * (0.25 + run * 0.75) * (st.speed > 0.3 ? 1 : 0);
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
      const airborne = !s.isGrounded;
      u.armL.rotation.x = airborne ? -2.6 : -sw * 0.9; u.armR.rotation.x = airborne ? -2.6 : sw * 0.9;
      u.armL.rotation.z = u.armR.rotation.z = 0;
      u.chest.rotation.x = run * 0.15;
      u.hips.position.y = 0.86 + (st.speed > 0.3 ? Math.abs(Math.cos(st.walk)) * 0.06 * (0.5 + run) : Math.sin(st.t * 2) * 0.01);
      if (st.emote) {
        st.emoteT += dt;
        if (st.emote === '👋') { u.armR.rotation.x = -2.9; u.armR.rotation.z = 0.35 + Math.sin(st.emoteT * 14) * 0.35; }
        else if (st.emote === '🤙') { u.armR.rotation.x = -1.6; u.armR.rotation.z = Math.sin(st.emoteT * 10) * 0.25; }
        else if (st.emote === '💃') { u.hips.rotation.y = Math.sin(st.emoteT * 8) * 0.5; u.armL.rotation.z = -1.2 + Math.sin(st.emoteT * 8) * 0.5; u.armR.rotation.z = 1.2 + Math.sin(st.emoteT * 8) * 0.5; u.hips.position.y = 0.86 + Math.abs(Math.sin(st.emoteT * 8)) * 0.12; }
        else if (st.emote === '🏆') { u.armL.rotation.x = u.armR.rotation.x = -2.9; u.hips.position.y = 0.86 + Math.abs(Math.sin(st.emoteT * 7)) * 0.25; }
      } else u.hips.rotation.y = 0;
    }
    if (st.emote) {
      st.emoteT = st.emoteT || 0;
      emoji.visible = true;
      emoji.scale.setScalar(0.9 + Math.sin(Math.min(1, st.emoteT * 4) * Math.PI) * 0.3);
      if (st.emoteT > 2.4 || (st.speed > 1.5 && st.emoteT > 0.4)) { st.emote = null; emoji.visible = false; u.hips.rotation.y = 0; }
    }
  }

  // Swing the camera out behind the athlete for this frame's render; returns a function that puts it back.
  function apply(dt) {
    const s = locomotion.getState();
    if (!enabled || !s.active) return null;
    saved.pos.copy(camera.position);
    saved.quat.copy(camera.quaternion);
    const biking = s.mode === 'bike';
    const dist = biking ? 7.5 + Math.min(2.5, st.speed * 0.1) : 7;
    const elev = THREE.MathUtils.clamp(0.24 - s.pitch * 0.5, 0.05, 1.0);    // drag down to look from above
    const yaw = s.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    target.copy(root.position).add(tmp.set(0, biking ? 1.3 : 1.5, 0));
    const aim = target.clone().add(tmp.set(fx * 5, 0.6, fz * 5));            // look past the athlete, at the world ahead
    const want = new THREE.Vector3(target.x - fx * dist * Math.cos(elev), target.y + dist * Math.sin(elev) + 0.4, target.z - fz * dist * Math.cos(elev));
    // Never below the ground.
    const gh = heightAt ? heightAt(want.x, -want.z) : null;
    if (Number.isFinite(gh)) want.y = Math.max(want.y, gh + 0.6);
    // Walls and roofs between the athlete and the camera pull the camera in (like any third-person game).
    if (grounds) {
      dir.copy(want).sub(target);
      const len = dir.length();
      dir.divideScalar(len || 1);
      ray.set(target, dir);
      ray.far = len;
      // Only walls and roofs count: a floor or hillside under the camera is handled by the ground clamp above.
      const hit = ray.intersectObjects([...grounds].filter(g => g?.isMesh), false).find(h => !h.face || Math.abs(h.face.normal.clone().transformDirection(h.object.matrixWorld).y) < 0.6);
      if (hit) want.copy(target).addScaledVector(dir, Math.max(0.8, hit.distance - 0.35));
    }
    if (snapCam) { camPos.copy(want); camLook.copy(aim); snapCam = false; }
    camPos.lerp(want, Math.min(1, dt * 10));
    camLook.lerp(aim, Math.min(1, dt * 14));
    camera.position.copy(camPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(camLook);
    return () => { camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat); };
  }

  return {
    update, apply, athlete,
    get enabled() { return enabled; },
    toggle() { enabled = !enabled; snapCam = true; try { localStorage.setItem('kona-view', enabled ? 'third' : 'first'); } catch { /* storage blocked */ } return enabled; },
    emote(e) { st.emote = e; st.emoteT = 0; emoji.userData.set(e); emoji.visible = true; },
    rename(name) { const t = tagSprite(name); tag.material = t.material; },
  };
}
