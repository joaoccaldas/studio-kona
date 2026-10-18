// Third-person play on the island, Roblox/Brawl Stars style: a chunky blocky athlete with a name tag, a camera
// that follows from behind and orbits when you drag, walk/run/jump/swim animations, a bike when riding, and emotes.
// The locomotion engine still moves the (hidden) first-person camera as the player's body; just before each render
// the camera is swung out behind the avatar and put back afterwards, so all the game logic that reads
// camera.position (quests, prompts, rings, tiles) keeps working unchanged.
import * as THREE from 'three';
import { makeAthlete, makeBike, pose } from './athlete.js';

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

export function createThirdPerson({ scene, camera, locomotion, heightAt, player, grounds, look: gear = {} }) {
  const look = player?.look || {};
  const bibNo = player?.bib || 1 + [...(player?.name || 'A')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2400, 7);
  let athlete, bike;
  const root = new THREE.Group();
  function dress(g) {
    if (athlete) { root.remove(athlete, bike); }
    athlete = makeAthlete({ skin: look.skin || '#b07a52', suit: look.suit || '#1d3557', bib: bibNo, look: g });
    bike = makeBike(g);
    root.add(athlete, bike);
  }
  dress(gear);
  const flag = /^[A-Z]{2}$/.test(player?.country || '') && player.country !== 'XX' ? String.fromCodePoint(...[...player.country].map(c => 127397 + c.charCodeAt(0))) + ' ' : '';
  const tag = tagSprite(`${flag}${player?.name || 'Athlete'} · #${bibNo}`);
  const emoji = emojiSprite();
  root.add(tag, emoji);
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
    else if (moved >= 5 || !hasLast) { st.facing = s.yaw + Math.PI; st.yaw = st.facing; snapCam = true; }   // just teleported or first frame: face away from the camera
    else if (s.mode === 'bike') st.facing = s.yaw + Math.PI;
    last.copy(f); hasLast = true;
    st.dist += moved;
    root.position.copy(f);
    // Turn smoothly toward the direction of travel.
    let d = st.facing - (st.yaw || 0);
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const yaw = st.yaw = (st.yaw || 0) + d * Math.min(1, dt * 10);

    const biking = s.mode === 'bike' && !s.isSwimming;
    bike.visible = biking;
    bike.rotation.y = yaw;
    bike.rotation.z = biking ? -s.roll * 1.2 : 0;
    tag.position.set(0, biking ? 2.35 : 2.55, 0);
    emoji.position.set(0, biking ? 3.05 : 3.25, 0);
    if (!biking) { st.walk += dt * (4 + st.speed * 1.6); }
    if (biking) {
      bike.userData.front.rotation.x = bike.userData.rear.rotation.x = -st.dist / 0.34;
      // The athlete rides in the bike's frame of reference.
      if (athlete.parent !== bike) { root.remove(athlete); bike.add(athlete); }
      athlete.rotation.y = 0;
    } else if (athlete.parent !== root) { bike.remove(athlete); root.add(athlete); }
    if (biking && st.emote) { st.emote = null; emoji.visible = false; }
    if (st.emote) st.emoteT += dt;
    pose(athlete, { mode: biking ? 'bike' : s.isSwimming ? 'swim' : 'walk', t: st.t, walk: st.walk, speed: st.speed, airborne: !s.isGrounded, emote: biking ? null : st.emote, emoteT: st.emoteT, pedal: st.dist / 0.55 });
    if (!biking) athlete.rotation.y = yaw;
    if (st.emote) {
      emoji.visible = true;
      emoji.scale.setScalar(0.9 + Math.sin(Math.min(1, st.emoteT * 4) * Math.PI) * 0.3);
      if (st.emoteT > 2.6 || (st.speed > 1.5 && st.emoteT > 0.4)) { st.emote = null; emoji.visible = false; }
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
    dress(g) { const wasOnBike = athlete.parent === bike; dress(g); if (wasOnBike) { root.remove(athlete); bike.add(athlete); } },
  };
}
