// ===== BOLA 3D — touch joystick + buttons + keyboard =====
export class Input {
  constructor() {
    this.jx = 0; this.jz = 0;            // -1..1 move vector
    this.sprintHeld = false;
    this.qPass = false; this.qShoot = false; this.qSwitch = false; this.qSlide = false;
    this._joyId = null; this._ox = 0; this._oy = 0;
    this._initTouch(); this._initKeys();
  }
  _initTouch() {
    const zone = document.getElementById('joy-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    const R = 55;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px,${dy}px)`; };
    zone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this._joyId = t.identifier; this._ox = t.clientX; this._oy = t.clientY;
      base.style.left = t.clientX + 'px'; base.style.top = t.clientY + 'px';
      base.style.display = 'block'; setKnob(0, 0);
      e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === this._joyId) {
        let dx = t.clientX - this._ox, dy = t.clientY - this._oy;
        const m = Math.hypot(dx, dy);
        if (m > R) { dx = dx / m * R; dy = dy / m * R; }
        setKnob(dx, dy); this.jx = dx / R; this.jz = dy / R;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this._joyId) {
        this._joyId = null; this.jx = 0; this.jz = 0;
        base.style.display = 'none'; setKnob(0, 0);
      }
    };
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
    const bind = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { down(); e.preventDefault(); }, { passive: false });
      el.addEventListener('touchend', (e) => { if (up) up(); e.preventDefault(); }, { passive: false });
      el.addEventListener('mousedown', down); el.addEventListener('mouseup', () => up && up());
    };
    bind('b-pass', () => this.qPass = true);
    bind('b-shoot', () => this.qShoot = true);
    bind('b-switch', () => this.qSwitch = true);
    bind('b-slide', () => this.qSlide = true);
    bind('b-sprint', () => this.sprintHeld = true, () => this.sprintHeld = false);
  }
  _initKeys() {
    this._keys = {};
    addEventListener('keydown', (e) => {
      if (e.repeat) return; this._keys[e.code] = true;
      if (e.code === 'KeyJ') this.qPass = true;
      if (e.code === 'KeyK') this.qShoot = true;
      if (e.code === 'Space') { this.qSwitch = true; e.preventDefault(); }
      if (e.code === 'KeyL') this.qSlide = true;
    });
    addEventListener('keyup', (e) => { this._keys[e.code] = false; });
  }
  // called each frame by game; returns fresh snapshot, clears edge triggers
  poll() {
    let mx = this.jx, mz = this.jz;
    const k = this._keys || {};
    if (k['KeyA'] || k['ArrowLeft']) mx -= 1;
    if (k['KeyD'] || k['ArrowRight']) mx += 1;
    if (k['KeyW'] || k['ArrowUp']) mz -= 1;
    if (k['KeyS'] || k['ArrowDown']) mz += 1;
    const m = Math.hypot(mx, mz);
    if (m > 1) { mx /= m; mz /= m; }
    const out = {
      mx, mz,
      sprint: this.sprintHeld || !!(k['ShiftLeft'] || k['ShiftRight']),
      pass: this.qPass, shoot: this.qShoot, switch: this.qSwitch, slide: this.qSlide,
    };
    this.qPass = this.qShoot = this.qSwitch = this.qSlide = false;
    return out;
  }
}
