// ===== BOLA 3D — match engine =====
import * as THREE from './vendor/three.module.js';
import { PITCH, HX, HZ, GOAL_W, GOAL_H, BALL_R, GRAV, TEAMS, FORMATIONS, ROLES, COMMENTARY, pick } from './config.js';
import { Player, Ball } from './entities.js';
import { TeamAI } from './ai.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  constructor(scene, sfx) {
    this.scene = scene; this.sfx = sfx;
    this.ball = new Ball(scene);
    this.teams = [];
    this.state = 'menu';
    this.userTeam = 0; this.controlled = null; this.aiControlsUser = false;
    this.half = 1; this.clock = 0; this.halfLen = 240;
    this.deadT = 0; this.goalT = 0; this.aiT = 0;
    this.kickoffTeam = 0;
    this.camera = null; this.camPos = new THREE.Vector3(0, 30, 48); this.camLook = new THREE.Vector3();
    this.stats = { shots: 0, passes: 0, tackles: 0, steals: 0, maxBX: 0, deads: 0 };
    this.radar = $('radar').getContext('2d');
    this._cmtT = 0;
  }

  attachCamera(cam) { this.camera = cam; }

  buildTeams(hi, ai2) {
    // clear old
    for (const t of this.teams) for (const p of t.players) this.scene.remove(p.mesh);
    this.teams = [];
    [hi, ai2].forEach((ti, idx) => {
      const info = TEAMS[ti];
      const team = { idx, info, attackDir: idx === 0 ? 1 : -1, players: [], score: 0, ai: null };
      const f = FORMATIONS[info.form];
      for (let i = 0; i < 11; i++) {
        const home = { x: f[i][0] * HX * team.attackDir, z: f[i][1] * HZ };
        const p = new Player(this.scene, team, i, ROLES[i], home);
        p.pos.set(home.x, 0, home.z);
        team.players.push(p);
      }
      team.ai = new TeamAI(team, this);
      this.teams.push(team);
    });
  }

  start(hi, ai2, halfMin, aiUser = false) {
    this.buildTeams(hi, ai2);
    this.userTeam = 0; this.aiControlsUser = aiUser;
    this.half = 1; this.clock = 0; this.halfLen = halfMin * 60;
    this.teams.forEach(t => t.score = 0);
    this.kickoffTeam = 0;
    this.kickoff(0);
    this.sfx.ensure();
    $('menu').style.display = 'none'; $('fulltime').style.display = 'none';
    $('hud').style.display = 'flex'; $('touch').style.display = 'block';
    this.commentary(pick(COMMENTARY.kickoff));
    this.sfx.whistle(1);
    this.updateHUD();
  }

  placeAll() {
    for (const t of this.teams) for (const p of t.players) {
      p.pos.set(p.home.x + (Math.random() - 0.5) * 1.5, 0, p.home.z + (Math.random() - 0.5) * 1.5);
      p.vel.set(0, 0, 0); p.face = t.attackDir > 0 ? 0 : Math.PI;
      p.tackleCD = p.slowT = p.slideT = p.kickCD = 0; p.hasBallW = 0;
    }
  }

  kickoff(teamIdx) {
    this.placeAll();
    const t = this.teams[teamIdx];
    const kicker = t.players[6];
    this.ball.pos.set(0, BALL_R, 0); this.ball.vel.set(0, 0, 0);
    this.setOwner(kicker, true);
    this.ball.lastTouch = teamIdx;
    this.state = 'kickoff'; this.deadT = 1.2;
    this.autoSwitch();
  }

  setOwner(p, silent) {
    if (this.controlled) this.controlled.setControlled(false);
    this.ball.owner = p;
    this.ball.passTarget = null;
    if (p) {
      this.ball.lastTouch = p.team.idx;
      p.hasBallW = 0;
      if (p.team.idx === this.userTeam && !this.aiControlsUser && p.role !== 'GK' && !silent) {
        this.controlled = p; p.setControlled(true);
      } else if (p.team.idx === this.userTeam && !this.aiControlsUser && p.role === 'GK') {
        // keep current outfield control
      }
    }
    if (!silent && p && p.team.idx === this.userTeam && !this.aiControlsUser && p.role !== 'GK') {
      this.controlled = p; p.setControlled(true);
    }
  }

  autoSwitch() {
    if (this.aiControlsUser) return;
    const T = this.teams[this.userTeam];
    let best = null, bd = 1e9;
    for (const p of T.players) {
      if (p.role === 'GK') continue;
      const d = Math.hypot(p.x - this.ball.pos.x, p.z - this.ball.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best && best !== this.controlled) {
      if (this.controlled) this.controlled.setControlled(false);
      this.controlled = best; best.setControlled(true);
    }
  }

  switchControl() {
    if (this.aiControlsUser || this.state !== 'play') return;
    this.autoSwitch(); this.sfx.click();
  }

  // ---- kicking ----
  bestMate(p, dirx, dirz) {
    const dir = p.team.attackDir;
    const mates = p.team.players.filter(q => q !== p && q.role !== 'GK');
    let best = null, bs = -1e9;
    for (const q of mates) {
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      const align = (dirx || dirz) ? (dx * dirx + dz * dirz) / (d || 1) : 0;
      const fwd = (q.x - p.x) * dir;   // + = ahead of carrier
      let open = 99;
      for (const o of this.teams[1 - p.team.idx].players) open = Math.min(open, Math.hypot(q.x - o.x, q.z - o.z));
      const s = align * 2 + fwd * 0.14 + Math.min(8, open) * 0.3 - d * 0.02;
      if (s > bs) { bs = s; best = q; }
    }
    return best;
  }

  aiKick(p, act) {
    if (this.state !== 'play' || this.ball.owner !== p || p.kickCD > 0) return;
    const dir = p.team.attackDir;
    if (act === 'pass' || act === 'gkpass') {
      const mate = this.bestMate(p, 0, 0);
      if (!mate) return;
      // lead the receiver slightly
      const mv = Math.hypot(mate.aiMove.x, mate.aiMove.y);
      const lx = mv > 0.5 ? mate.aiMove.x / mv * 2.5 : 0, lz = mv > 0.5 ? mate.aiMove.y / mv * 2.5 : 0;
      const dx = (mate.x + lx) - p.x, dz = (mate.z + lz) - p.z, d = Math.hypot(dx, dz);
      this.ball.kick(dx, dz, Math.min(24, 13 + d * 0.45), 1.6, p.team.idx);
      this.ball.passTarget = mate;
      p.kickCD = 0.5; this.sfx.kick(0.5); this.stats.passes++;
    } else if (act === 'shoot') {
      const gx = HX * dir, gz = (Math.random() - 0.5) * 5.2;
      const d = Math.hypot(gx - p.x, gz - p.z);
      this.ball.kick(gx - p.x, gz - p.z, Math.min(34, 24 + d * 0.3), d > 19 ? 5.5 : 2.2, p.team.idx);
      p.kickCD = 0.9; this.sfx.kick(1); this.stats.shots++;
    }
  }

  userKick(kind, mx, mz) {
    const p = this.controlled;
    if (!p || this.state !== 'play' || this.ball.owner !== p || p.kickCD > 0) return;
    const dir = p.team.attackDir;
    if (kind === 'pass') {
      const m = Math.hypot(mx, mz);
      const mate = this.bestMate(p, m > 0.2 ? mx / m : 0, m > 0.2 ? mz / m : 0);
      if (!mate) return;
      const dx = mate.x - p.x, dz = mate.z - p.z, d = Math.hypot(dx, dz);
      this.ball.kick(dx, dz, Math.min(25, 14 + d * 0.45), 1.6, p.team.idx);
      this.ball.passTarget = mate;
      p.kickCD = 0.45; this.sfx.kick(0.55);
    } else {
      const gx = HX * dir, gz = (Math.random() - 0.5) * 5.4;
      const d = Math.hypot(gx - p.x, gz - p.z);
      this.ball.kick(gx - p.x, gz - p.z, Math.min(34, 25 + d * 0.28), d > 19 ? 5.5 : 2.4, p.team.idx);
      p.kickCD = 0.8; this.sfx.kick(1);
    }
  }

  userSlide() {
    const p = this.controlled;
    if (!p || this.state !== 'play' || p.tackleCD > 0 || this.ball.owner === p) return;
    const bx = this.ball.pos.x - p.x, bz = this.ball.pos.z - p.z;
    const m = Math.hypot(bx, bz) || 1;
    p.slideT = 0.45; p.tackleCD = 1.6;
    p.pos.x += bx / m * 3.2; p.pos.z += bz / m * 3.2;
    p.face = Math.atan2(bx, bz); p.speed = 10;
    const c = this.ball.owner;
    if (c && c.team !== p.team && Math.hypot(this.ball.pos.x - p.x, this.ball.pos.z - p.z) < 1.6) {
      this.setOwner(p); this.sfx.kick(0.5);
    } else p.slowT = Math.max(p.slowT, 0.55);
  }

  // ---- set pieces / goals ----
  dead(sec, label) {
    this.state = 'dead'; this.deadT = sec; this.stats.deads++;
    if (label) this.commentary(label);
  }

  giveToNearest(teamIdx, x, z, skipGK = true) {
    const T = this.teams[teamIdx];
    let best = null, bd = 1e9;
    for (const p of T.players) {
      if (skipGK && p.role === 'GK') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    best.pos.set(x, 0, z);
    this.setOwner(best, true);
    this.ball.lastTouch = teamIdx;
    if (teamIdx === this.userTeam && !this.aiControlsUser && this.controlled) {
      this.controlled.setControlled(false); this.controlled = best; best.setControlled(true);
    }
  }

  checkLines() {
    if (this.state !== 'play') return;
    const b = this.ball.pos;
    // goal?
    if (Math.abs(b.x) > HX && Math.abs(b.z) < GOAL_W / 2 && b.y < GOAL_H) {
      const scored = this.teams.find(t => (b.x > 0 ? t.attackDir > 0 : t.attackDir < 0));
      this.onGoal(scored.idx); return;
    }
    if (Math.abs(b.z) > HZ + BALL_R) {
      const team = 1 - this.ball.lastTouch;
      this.ball.pos.z = Math.sign(b.z) * (HZ - 0.7);
      this.ball.pos.x = clamp(b.x, -HX + 2, HX - 2); this.ball.vel.set(0, 0, 0);
      this.giveToNearest(team, this.ball.pos.x, this.ball.pos.z);
      this.dead(1.1, 'Lemparan ke dalam');
    } else if (Math.abs(b.x) > HX + BALL_R) {
      const s = Math.sign(b.x);
      const atkDir = s; // team attacking toward +s
      const atk = this.teams.find(t => t.attackDir === atkDir);
      const def = this.teams.find(t => t.attackDir !== atkDir);
      if (this.ball.lastTouch === atk.idx) {
        // goal kick
        const gk = def.players[0];
        this.ball.pos.set(-def.attackDir * (HX - 9), BALL_R, 0); this.ball.vel.set(0, 0, 0);
        this.setOwner(gk, true); this.ball.lastTouch = def.idx;
        this.dead(1.1, 'Tendangan gawang');
      } else {
        // corner
        const cx = s * (HX - 1), cz = Math.sign(b.z || 1) * (HZ - 1);
        this.ball.pos.set(cx, BALL_R, cz); this.ball.vel.set(0, 0, 0);
        this.giveToNearest(atk.idx, cx, cz);
        this.dead(1.4, 'Tendangan sudut!');
      }
    }
  }

  onGoal(teamIdx) {
    const t = this.teams[teamIdx];
    t.score++; this.updateHUD();
    this._scoredIdx = teamIdx;
    this.state = 'goal'; this.goalT = 3.2;
    this.ball.vel.multiplyScalar(0.25);
    $('banner').textContent = 'GOOOL!';
    $('banner').style.display = 'block';
    this.commentary(pick(COMMENTARY.goal) + ` ${t.info.name}!`);
    this.sfx.cheer();
    setTimeout(() => $('banner').style.display = 'none', 3000);
  }

  endHalf() {
    if (this.half === 1) {
      this.half = 2; this.clock = 0;
      this.teams.forEach(t => t.attackDir *= -1);
      this.teams.forEach(t => t.players.forEach((p, i) => {
        const f = FORMATIONS[t.info.form][i];
        p.home = { x: f[0] * HX * t.attackDir, z: f[1] * HZ };
      }));
      this.commentary(COMMENTARY.halftime[0] + this.scoreText());
      this.sfx.whistle(1);
      this.kickoff(1);
    } else this.fulltime();
  }

  fulltime() {
    this.state = 'fulltime';
    this.sfx.whistle(2);
    const [a, b] = this.teams;
    let msg = `${a.info.name} ${a.score} - ${b.score} ${b.info.name}. `;
    msg += a.score === b.score ? 'Berakhir imbang!' : `Pemenang: ${a.score > b.score ? a.info.name : b.info.name}!`;
    $('ft-score').textContent = `${a.info.short} ${a.score} - ${b.score} ${b.info.short}`;
    $('ft-msg').textContent = pick(COMMENTARY.fulltime) + ' ' + msg;
    $('fulltime').style.display = 'flex';
    $('touch').style.display = 'none';
  }

  scoreText() { const [a, b] = this.teams; return `${a.info.short} ${a.score} - ${b.score} ${b.info.short}`; }

  updateHUD() {
    $('score').textContent = this.scoreText();
    const t = Math.floor(this.clock);
    $('clock').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    $('half').textContent = this.half === 1 ? '1ST' : '2ND';
  }

  commentary(txt) {
    const el = $('commentary');
    el.textContent = txt; el.style.opacity = 1;
    clearTimeout(this._cmtTo);
    this._cmtTo = setTimeout(() => el.style.opacity = 0, 3200);
  }

  // ---- per-frame ----
  update(dt, inp) {
    // timers
    if (this.state === 'play') {
      this.clock += dt; this.updateHUD();
      if (this.clock >= this.halfLen) { this.endHalf(); return; }
    } else if (this.state === 'kickoff' || this.state === 'dead') {
      this.deadT -= dt;
      if (this.deadT <= 0) this.state = 'play';
    } else if (this.state === 'goal') {
      this.goalT -= dt;
      if (this.goalT <= 0) this.kickoff(1 - (this._scoredIdx ?? 0));
    }
    // AI brains
    this.aiT += dt;
    if (this.aiT > 0.12 && (this.state === 'play' || this.state === 'dead')) {
      this.aiT = 0;
      this.teams[0].ai.decide(); this.teams[1].ai.decide();
    }
    // human input
    if (this.state === 'play' && !this.aiControlsUser && this.controlled) {
      const p = this.controlled;
      p.moveDir(inp.mx, inp.mz, inp.sprint, dt);
      p.aiSprint = inp.sprint;
      if (inp.pass) { this.ball.owner === p ? this.userKick('pass', inp.mx, inp.mz) : this.userSlide(); }
      if (inp.shoot && this.ball.owner === p) this.userKick('shoot');
      if (inp.slide) this.userSlide();
      if (inp.switch) this.switchControl();
      // auto-switch when our team gains ball via others
      if (this.ball.owner && this.ball.owner.team.idx === this.userTeam && this.ball.owner !== p && this.ball.owner.role !== 'GK') {
        p.setControlled(false); this.controlled = this.ball.owner; this.controlled.setControlled(true);
      }
    }
    // move AI-driven players
    for (const t of this.teams) for (const p of t.players) {
      const human = (t.idx === this.userTeam && !this.aiControlsUser && p === this.controlled);
      if (!human) p.moveDir(p.aiMove.x, p.aiMove.y, p.aiSprint, dt);
      p.update(dt);
    }
    // loose ball pickup
    const B = this.ball;
    if (!B.owner && this.state === 'play' && B.pos.y < 1.2 && B.vel.length() < 9.5) {
      for (const t of this.teams) for (const p of t.players) {
        if (Math.hypot(p.x - B.pos.x, p.z - B.pos.z) < 1.05) { this.setOwner(p); break; }
      }
    }
    B.update(dt, GRAV);
    if (B.passTarget && !B.owner && B.vel.length() < 4) B.passTarget = null;  // pass died out
    const axb = Math.abs(B.pos.x);
    if (axb > this.stats.maxBX) this.stats.maxBX = axb;
    this.checkLines();
    this.updateCamera(dt);
    this.drawRadar();
  }

  lastScored() { return this._scoredIdx ?? 0; }

  updateCamera(dt) {
    if (!this.camera) return;
    const b = this.ball.pos;
    const tx = b.x * 0.82, tz = 48;
    this.camPos.x += (tx - this.camPos.x) * Math.min(1, dt * 2.2);
    this.camPos.z += (tz - this.camPos.z) * Math.min(1, dt * 2.2);
    this.camPos.y += (30 - this.camPos.y) * Math.min(1, dt * 2.2);
    this.camera.position.copy(this.camPos);
    this.camLook.set(b.x * 0.88, 0, 10);
    this.camera.lookAt(this.camLook);
  }

  drawRadar() {
    const g = this.radar, W = 150, H = 100;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(10,20,12,0.78)'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.strokeRect(4, 4, W - 8, H - 8);
    const sx = (W - 8) / PITCH.L, sz = (H - 8) / PITCH.W;
    const X = (x) => 4 + (x + HX) * sx, Z = (z) => 4 + (z + HZ) * sz;
    for (const t of this.teams) {
      g.fillStyle = '#' + t.info.color.toString(16).padStart(6, '0');
      for (const p of t.players) { g.beginPath(); g.arc(X(p.x), Z(p.z), 2.6, 0, 7); g.fill(); }
    }
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(X(this.ball.pos.x), Z(this.ball.pos.z), 2.2, 0, 7); g.fill();
  }
}
