// ===== BOLA 3D — stadium world =====
import * as THREE from './vendor/three.module.js';
import { PITCH, HX, HZ, GOAL_W, GOAL_H } from './config.js';

function pitchTexture() {
  const W = 2048, H = Math.round(2048 * PITCH.W / PITCH.L);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const sx = W / PITCH.L, sz = H / PITCH.W;
  const X = (m) => (m + PITCH.L / 2) * sx, Z = (m) => (m + PITCH.W / 2) * sz;
  // mow stripes
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#3d9e4d' : '#359245'; g.fillRect(i * W / 14, 0, W / 14 + 1, H); }
  // lines
  g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 5;
  const line = (x1, z1, x2, z2) => { g.beginPath(); g.moveTo(X(x1), Z(z1)); g.lineTo(X(x2), Z(z2)); g.stroke(); };
  g.strokeRect(X(-HX), Z(-HZ), PITCH.L * sx, PITCH.W * sz);
  line(0, -HZ, 0, HZ); // halfway
  g.beginPath(); g.arc(X(0), Z(0), 9.15 * sx, 0, Math.PI * 2); g.stroke(); // center circle
  g.fillStyle = '#fff'; g.beginPath(); g.arc(X(0), Z(0), 7, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    const gx = s * HX;
    // penalty box 40.32 x 16.5
    g.strokeRect(Math.min(X(gx), X(gx - s * 16.5)), Z(-20.16), 16.5 * sx, 40.32 * sz);
    // 6-yard 18.32 x 5.5
    g.strokeRect(Math.min(X(gx), X(gx - s * 5.5)), Z(-9.16), 5.5 * sx, 18.32 * sz);
    // penalty spot
    g.beginPath(); g.arc(X(gx - s * 11), Z(0), 7, 0, Math.PI * 2); g.fill();
    // arc
    g.beginPath(); g.arc(X(gx - s * 11), Z(0), 9.15 * sx, s > 0 ? Math.PI * 0.72 : -Math.PI * 0.28, s > 0 ? Math.PI * 1.28 : Math.PI * 0.28); g.stroke();
    // corner arcs
    for (const zs of [-1, 1]) { g.beginPath(); g.arc(X(gx), Z(zs * HZ), 1 * sx, 0, Math.PI * 2); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function netTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3);
  return t;
}

function crowdTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#141821'; g.fillRect(0, 0, 512, 128);
  const cols = ['#d62828', '#1d4ed8', '#f5b301', '#e8e8e8', '#15803d', '#8888aa'];
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = cols[(Math.random() * cols.length) | 0];
    g.fillRect(Math.random() * 512, Math.random() * 128, 3, 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function blobShadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
export const blobTex = blobShadowTexture();

function makeGoal(s, netTex) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const post = (x, z, h) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, h, 10), mat);
    m.position.set(x, h / 2, z); grp.add(m);
  };
  const hw = GOAL_W / 2;
  post(0, -hw, GOAL_H); post(0, hw, GOAL_H);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, GOAL_W + 0.18, 10), mat);
  bar.rotation.x = Math.PI / 2; bar.position.set(0, GOAL_H, 0); grp.add(bar);
  const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, GOAL_H), netMat);
  back.position.set(-s * 1.1, GOAL_H / 2, 0); back.rotation.y = Math.PI / 2; grp.add(back);
  for (const zs of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(1.1, GOAL_H), netMat);
    side.position.set(-s * 0.55, GOAL_H / 2, zs * hw); grp.add(side);
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, 1.1), netMat);
  top.rotation.x = Math.PI / 2; top.position.set(-s * 0.55, GOAL_H, 0); grp.add(top);
  grp.position.set(s * HX, 0, 0);
  return grp;
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x0a0e1a);
  scene.fog = new THREE.Fog(0x0a0e1a, 130, 300);
  // lights
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1c2b1a, 0.95));
  const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
  sun.position.set(60, 90, 30); scene.add(sun);
  for (const [lx, lz] of [[-70, -50], [70, -50], [-70, 50], [70, 50]]) {
    const pl = new THREE.PointLight(0xfff6d8, 900, 160, 1.9); pl.position.set(lx, 34, lz); scene.add(pl);
  }
  // ground apron
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(320, 260),
    new THREE.MeshLambertMaterial({ color: 0x1d3320 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.05; scene.add(apron);
  // pitch
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(PITCH.L, PITCH.W),
    new THREE.MeshLambertMaterial({ map: pitchTexture() }));
  pitch.rotation.x = -Math.PI / 2; scene.add(pitch);
  // goals + nets
  const netTex = netTexture();
  scene.add(makeGoal(1, netTex)); scene.add(makeGoal(-1, netTex));
  // stands: 4 dark banks with crowd texture
  const crowd = crowdTexture();
  const standMat = new THREE.MeshBasicMaterial({ map: crowd });
  const mk = (w, h, d, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), standMat);
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  };
  mk(150, 16, 10, 0, 8, -52); mk(150, 16, 10, 0, 8, 52);
  mk(10, 16, 96, -72, 8, 0); mk(10, 16, 96, 72, 8, 0);
  // floodlight poles
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x39404d });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  for (const [lx, lz] of [[-70, -50], [70, -50], [-70, 50], [70, 50]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 34, 8), poleMat);
    pole.position.set(lx, 17, lz); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), lampMat);
    lamp.position.set(lx, 34.5, lz); scene.add(lamp);
  }
}
