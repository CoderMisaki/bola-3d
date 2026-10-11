// ===== BOLA 3D — players & ball =====
import * as THREE from './vendor/three.module.js';
import { BALL_R, HX, HZ, WALK, SPRINT, GK_SPD } from './config.js';
import { blobTex as _b } from './world.js';

const SKIN = [0xd9a066, 0xc68642, 0x8d5524, 0xe8b88a];

export class Player {
  constructor(scene, team, idx, role, home) {
    this.team = team; this.idx = idx; this.role = role;
    this.home = home;                       // {x,z} anchor (world coords)
    this.pos = new THREE.Vector3(home.x, 0, home.z);
    this.vel = new THREE.Vector3();
    this.face = team.attackDir > 0 ? 0 : Math.PI;  // facing angle
    this.speed = 0; this.animT = Math.random() * 10;
    this.controlled = false;
    this.tackleCD = 0; this.slowT = 0; this.slideT = 0; this.kickCD = 0;
    this.aiMove = new THREE.Vector2(); this.aiSprint = false;
    this.hasBallW = 0;                       // time holding ball (GK)
    const g = new THREE.Group();
    const cMat = new THREE.MeshLambertMaterial({ color: team.info.color });
    const tMat = new THREE.MeshLambertMaterial({ color: team.info.trim });
    const sMat = new THREE.MeshLambertMaterial({ color: SKIN[idx % SKIN.length] });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const bodyH = role === 'GK' ? 1.15 : 1.05;
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, bodyH, 4, 10), role === 'GK' ? new THREE.MeshLambertMaterial({ color: 0x222831 }) : cMat);
    this.body.position.y = 0.95; g.add(this.body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), sMat);
    head.position.y = 1.78; g.add(head);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), dark);
    this.legR = this.legL.clone();
    this.legL.position.set(-0.14, 0.36, 0); this.legR.position.set(0.14, 0.36, 0);
    this.legL.geometry.translate(0, 0, 0); g.add(this.legL); g.add(this.legR);
    // control ring
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.03; this.ring.visible = false; g.add(this.ring);
    // blob shadow
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: _b, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
    g.position.copy(this.pos); scene.add(g);
    this.mesh = g;
  }
  setControlled(v) { this.controlled = v; this.ring.visible = v; }
  get x() { return this.pos.x; } get z() { return this.pos.z; }
  moveDir(dx, dz, sprint, dt) {
    const sp = (this.role === 'GK' ? GK_SPD : sprint ? SPRINT : WALK) * (this.slowT > 0 ? 0.45 : 1);
    const m = Math.hypot(dx, dz);
    if (m > 0.01) {
      const nx = dx / Math.max(1, m), nz = dz / Math.max(1, m);
      const k = Math.min(1, m);
      this.pos.x += nx * sp * k * dt; this.pos.z += nz * sp * k * dt;
      this.face = Math.atan2(nx, nz);
      this.speed = sp * k;
    } else this.speed *= 0.85;
    this.pos.x = Math.max(-HX - 3, Math.min(HX + 3, this.pos.x));
    this.pos.z = Math.max(-HZ - 3, Math.min(HZ + 3, this.pos.z));
  }
  update(dt) {
    this.animT += dt * (2 + this.speed * 1.6);
    const sw = Math.sin(this.animT * 6) * Math.min(0.7, this.speed * 0.09);
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.face;
    this.body.position.y = 0.95 + Math.abs(Math.sin(this.animT * 6)) * Math.min(0.08, this.speed * 0.012);
    if (this.tackleCD > 0) this.tackleCD -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.slideT > 0) this.slideT -= dt;
    if (this.kickCD > 0) this.kickCD -= dt;
  }
}

export class Ball {
  constructor(scene) {
    this.pos = new THREE.Vector3(0, BALL_R, 0);
    this.vel = new THREE.Vector3();
    this.owner = null; this.lastTouch = -1; this.passTarget = null;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#f5f5f5'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#222';
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(16 + (i * 37) % 112, 16 + (i * 53) % 112, 11, 0, 7); g.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 18, 14),
      new THREE.MeshLambertMaterial({ map: tex }));
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.MeshBasicMaterial({ map: _b, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; this.shadow = sh; scene.add(sh);
    scene.add(this.mesh);
    this.spin = new THREE.Vector3();
  }
  kick(dirx, dirz, power, up, teamIdx) {
    const m = Math.hypot(dirx, dirz) || 1;
    this.owner = null;
    this.vel.set(dirx / m * power, up, dirz / m * power);
    this.lastTouch = teamIdx;
    this.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  }
  update(dt, GRAV) {
    if (this.owner) {
      const o = this.owner;
      const fx = Math.sin(o.face), fz = Math.cos(o.face);
      const d = o.speed > 8.4 ? 1.4 : 0.95;   // push ball further when sprinting
      this.pos.set(o.pos.x + fx * d, BALL_R, o.pos.z + fz * d);
      this.vel.set(0, 0, 0);
    } else {
      this.vel.y -= GRAV * dt;
      // air drag / ground friction
      const drag = this.pos.y <= BALL_R + 0.02 ? 2.6 : 0.14;
      const f = Math.max(0, 1 - drag * dt);
      this.vel.x *= f; this.vel.z *= f; this.vel.y *= Math.max(0, 1 - 0.05 * dt);
      this.pos.addScaledVector(this.vel, dt);
      if (this.pos.y < BALL_R) {
        this.pos.y = BALL_R;
        if (this.vel.y < -2) this.vel.y *= -0.55; else this.vel.y = 0;
      }
      // soft walls handled by game (out of bounds); keep inside extended area
      this.pos.x = Math.max(-HX - 8, Math.min(HX + 8, this.pos.x));
      this.pos.z = Math.max(-HZ - 8, Math.min(HZ + 8, this.pos.z));
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.x += this.vel.z * dt * 2; this.mesh.rotation.z -= this.vel.x * dt * 2;
    this.shadow.position.set(this.pos.x, 0.02, this.pos.z);
    const s = Math.max(0.4, 1 - this.pos.y * 0.12);
    this.shadow.scale.set(s, s, 1);
  }
}
