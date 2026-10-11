// ===== BOLA 3D — boot & UI wiring =====
import * as THREE from './vendor/three.module.js';
import { TEAMS } from './config.js';
import { buildWorld } from './world.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { SoundKit } from './audio.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);

const renderer = new THREE.WebGLRenderer({ canvas: $('c3d'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 600);
camera.position.set(0, 30, 48);
buildWorld(scene);

const sfx = new SoundKit();
const game = new Game(scene, sfx);
game.attachCamera(camera);
const input = new Input();
window.__game = game; // debug hook

// ---- menu wiring ----
let selHome = 0, selAway = 1, selHalf = 4;
function renderTeams() {
  const mk = (el, sel, cb) => {
    el.innerHTML = '';
    TEAMS.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'team' + (i === sel ? ' on' : '');
      b.innerHTML = `<span class="dot" style="background:#${t.color.toString(16).padStart(6, '0')}"></span>${t.short}`;
      b.onclick = () => { sfx.ensure(); sfx.click(); cb(i); };
      el.appendChild(b);
    });
  };
  mk($('home-pick'), selHome, (i) => { if (i !== selAway) selHome = i; renderTeams(); });
  mk($('away-pick'), selAway, (i) => { if (i !== selHome) selAway = i; renderTeams(); });
  document.querySelectorAll('#half-pick button').forEach(b => {
    b.classList.toggle('on', +b.dataset.m === selHalf);
    b.onclick = () => { sfx.ensure(); sfx.click(); selHalf = +b.dataset.m; renderTeams(); };
  });
}
renderTeams();
$('kickoff-btn').onclick = () => { sfx.ensure(); game.start(selHome, selAway, selHalf); };
$('pause-btn').onclick = () => {
  if (game.state !== 'play') return;
  game.state = 'paused'; $('pause-menu').style.display = 'flex'; sfx.click();
};
$('resume-btn').onclick = () => { game.state = 'play'; $('pause-menu').style.display = 'none'; sfx.click(); };
$('quit-btn').onclick = () => location.reload();
$('rematch-btn').onclick = () => location.reload();
$('ft-menu-btn').onclick = () => location.reload();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// demo / attract mode for testing: ?demo=1 -> AI vs AI auto start
if (qs.get('demo') === '1') {
  game.start(0, 1, 2, true);
}

// PWA
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// ---- main loop (fixed timestep) ----
let last = performance.now(), acc = 0, frames = 0;
const STEP = 1 / 60;

const warm = parseInt(qs.get('warm') || '0', 10);
if (warm > 0) {
  // headless test: fast-forward the simulation, then enter the normal render loop
  for (let i = 0; i < warm; i++) {
    if (game.state !== 'menu' && game.state !== 'paused' && game.state !== 'fulltime') game.update(STEP, input.poll());
    else break;
  }
  document.title = `warm=${warm} st=${game.state} clk=${game.clock.toFixed(1)} score=${game.scoreText()} shots=${game.stats.shots} deads=${game.stats.deads}`;
}
requestAnimationFrame(frame);
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  frames++;
  if (frames % 60 === 0) document.title = `f=${frames} dt=${dt.toFixed(4)} st=${game.state} clk=${game.clock.toFixed(1)}`;
  acc += dt;
  while (acc >= STEP) {
    if (game.state !== 'menu' && game.state !== 'paused' && game.state !== 'fulltime') {
      const inp = input.poll();
      game.update(STEP, inp);
    } else input.poll();
    acc -= STEP;
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
