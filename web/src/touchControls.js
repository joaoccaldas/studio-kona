// Phone controls: a fixed, always-visible joystick bottom-left that owns its own touches (so HUD panels can never
// swallow them), look-around by dragging anywhere else, and big contextual buttons on the right:
// walking → Jump; riding → Cruise (keeps pedalling), Tuck (hold for the aero position).
export function mountTouchControls({ locomotion, onModeToggle }) {
  const root = document.createElement('div');
  root.id = 'tc';
  root.innerHTML = `
    <div class="tc-stick" role="application" aria-label="Move: drag the joystick"><div class="tc-ring"></div><div class="tc-knob"></div></div>
    <div class="tc-buttons">
      <button type="button" class="tc-btn tc-walk" id="tcJump" aria-label="Jump">Jump</button>
      <button type="button" class="tc-btn tc-bike" id="tcTuck" aria-label="Hold to tuck">Tuck</button>
      <button type="button" class="tc-btn tc-bike tc-toggle" id="tcCruise" aria-pressed="false" aria-label="Cruise">Cruise</button>
      <button type="button" class="tc-btn tc-small" id="tcMode" aria-label="Walk or ride">Ride</button>
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add('touch-ui');
  locomotion.useFixedStick(true);

  const stick = root.querySelector('.tc-stick'), knob = root.querySelector('.tc-knob');
  const R = 52;
  let id = null, cx = 0, cy = 0;
  const set = (dx, dy) => {
    const d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const x = dx / R, y = -dy / R;
    // A small dead zone, then a gentle curve so small moves are precise and full tilt is full speed.
    const m = Math.hypot(x, y), e = m < 0.12 ? 0 : Math.pow((m - 0.12) / 0.88, 1.3) / (m || 1);
    locomotion.setStick(x * e, y * e);
  };
  stick.addEventListener('pointerdown', ev => {
    id = ev.pointerId;
    stick.setPointerCapture(id);
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    stick.classList.add('on');
    set(ev.clientX - cx, ev.clientY - cy);
    ev.preventDefault();
  });
  stick.addEventListener('pointermove', ev => { if (ev.pointerId === id) set(ev.clientX - cx, ev.clientY - cy); });
  const end = ev => { if (ev.pointerId !== id) return; id = null; stick.classList.remove('on'); set(0, 0); };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);

  const jump = root.querySelector('#tcJump');
  jump.addEventListener('pointerdown', ev => { ev.preventDefault(); locomotion.jump?.(); });
  const tuck = root.querySelector('#tcTuck');
  tuck.addEventListener('pointerdown', ev => { ev.preventDefault(); tuck.setPointerCapture(ev.pointerId); tuck.classList.add('held'); locomotion.setTuck(true); });
  const untuck = () => { tuck.classList.remove('held'); locomotion.setTuck(false); };
  tuck.addEventListener('pointerup', untuck);
  tuck.addEventListener('pointercancel', untuck);
  const cruise = root.querySelector('#tcCruise');
  cruise.addEventListener('click', () => {
    const on = locomotion.setCruise(cruise.getAttribute('aria-pressed') !== 'true');
    cruise.setAttribute('aria-pressed', String(on));
  });
  const mode = root.querySelector('#tcMode');
  mode.addEventListener('click', () => onModeToggle?.());

  return {
    // Keep the buttons in step with the current mode (called from setLocomotionMode).
    sync(m) {
      mode.textContent = m === 'bike' ? 'Walk' : 'Ride';
      if (m !== 'bike') { locomotion.setCruise(false); cruise.setAttribute('aria-pressed', 'false'); untuck(); }
    },
  };
}
