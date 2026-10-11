// ===== BOLA 3D — team AI =====
import { HX, HZ, GOAL_W } from './config.js';

const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export class TeamAI {
  constructor(team, game) { this.team = team; this.game = game; }
  get dir() { return this.team.attackDir; }
  get ball() { return this.game.ball; }
  oppPlayers() { return this.game.teams[1 - this.team.idx].players; }

  nearestOpp(p, maxD = 999) {
    let best = null, bd = maxD;
    for (const o of this.oppPlayers()) {
      const d = dist2(p.x, p.z, o.x, o.z);
      if (d < bd) { bd = d; best = o; }
    }
    return { p: best, d: bd };
  }

  anchor(p) {
    const b = this.ball.pos, dir = this.dir;
    let shift = Math.max(-12, Math.min(12, b.x * 0.28));
    const o = this.ball.owner;
    if (o && o.team === this.team) shift += 9 * dir;
    else if (o) shift -= 7 * dir;
    return { x: p.home.x + shift, z: p.home.z };
  }

  decide() {
    const T = this.team, B = this.ball, dir = this.dir, G = this.game;
    const canKick = G.state === 'play';
    const myBall = B.owner && B.owner.team === T;
    const theirBall = B.owner && B.owner.team !== T;
    const carrier = B.owner;
    const humanDrives = (T.idx === G.userTeam && !G.aiControlsUser);
    const out = T.players.filter(p => p.role !== 'GK');
    const byDist = [...out].sort((a, b) => dist2(a.x, a.z, B.pos.x, B.pos.z) - dist2(b.x, b.z, B.pos.x, B.pos.z));

    for (const p of T.players) {
      if (humanDrives && p === G.controlled) continue;
      if (p.role === 'GK') { this.decideGK(p, canKick); continue; }
      let tx = p.x, tz = p.z, sprint = false, act = null;

      if (carrier === p && canKick) {
        const gx = HX * dir;
        const dGoal = dist2(p.x, p.z, gx, 0);
        const nd = this.nearestOpp(p);
        const attackingHalf = (p.x * dir) > 0;
        if (dGoal < 28 && p.kickCD <= 0 && (nd.d > 2.2 || Math.random() < 0.5)) act = 'shoot';
        else if (p.kickCD <= 0 && (nd.d < 2.8 || this.throughBall(p))) act = 'pass';
        else {
          tx = gx; tz = p.z * (attackingHalf ? 0.35 : 0.55);
          if (nd.p && nd.d < 7) tz += (p.z >= nd.p.z ? 1 : -1) * 4;
          sprint = nd.d > 3 || attackingHalf;
        }
      } else if (myBall) {
        const a = this.anchor(p); tx = a.x; tz = a.z;
        if (p.role === 'FW') tx += 6 * dir;   // stretch the defense
      } else if (theirBall) {
        const rank = byDist.indexOf(p);
        const ownGoalX = -HX * dir;
        if (rank === 0) {
          tx = carrier.x; tz = carrier.z; sprint = false;   // contain at run pace; sprint only for loose balls
          if (canKick && dist2(p.x, p.z, carrier.x, carrier.z) < 1.7 && p.tackleCD <= 0) this.tryTackle(p, carrier);
        } else if (rank === 1) {
          // contain: stay goal-side instead of diving in
          tx = carrier.x * 0.55 + ownGoalX * 0.45; tz = carrier.z * 0.6; sprint = false;
        } else { const a = this.anchor(p); tx = a.x; tz = a.z; }
      } else {
        // loose ball: intended receiver meets the pass; otherwise nearest chase
        if (B.passTarget === p) {
          tx = B.pos.x + B.vel.x * 0.35; tz = B.pos.z + B.vel.z * 0.35; sprint = true;
        } else {
          const rank = byDist.indexOf(p);
          if (rank < 2 && canKick) { tx = B.pos.x; tz = B.pos.z; sprint = true; }
          else { const a = this.anchor(p); tx = a.x; tz = a.z; }
        }
      }
      // clamp inside pitch
      p.aiMove.set(tx - p.x, tz - p.z);
      p.aiSprint = sprint;
      if (act) G.aiKick(p, act);
    }
  }

  // is there an open teammate ahead worth a through ball? (sets up aiKick target)
  throughBall(p) {
    const dir = this.dir;
    let ok = false;
    for (const q of this.team.players) {
      if (q === p || q.role === 'GK') continue;
      const ahead = (q.x - p.x) * dir;
      if (ahead < 7) continue;
      const nd = this.nearestOpp(q);
      if (nd.d > 4) { ok = true; break; }
    }
    return ok && Math.random() < 0.6;
  }

  tryTackle(p, carrier) {
    p.tackleCD = 1.3;
    this.game.stats.tackles++;
    if (Math.random() < 0.32) {
      this.game.stats.steals++;
      this.game.setOwner(p);
      this.game.sfx.kick(0.4);
    } else p.slowT = 0.7;
  }

  decideGK(p, canKick) {
    const B = this.ball, dir = this.dir, G = this.game;
    const goalX = -HX * dir;
    const gx = goalX + dir * 1.6;
    let tx = gx, tz = Math.max(-3, Math.min(3, B.pos.z * 0.32)), sprint = false;

    if (B.owner === p) {
      p.hasBallW += 0.12; tx = gx; tz = p.z;
      if (canKick && p.hasBallW > 1.4 && p.kickCD <= 0) { G.aiKick(p, 'gkpass'); p.hasBallW = 0; }
    } else {
      p.hasBallW = 0;
      const bd = dist2(p.x, p.z, B.pos.x, B.pos.z);
      // shot coming at goal -> dive to intercept
      if (canKick && !B.owner && B.vel.x * dir < -7 && bd < 18) {
        const tHit = (goalX - B.pos.x) / B.vel.x;
        if (tHit > 0 && tHit < 1.1) {
          const iz = B.pos.z + B.vel.z * tHit;
          const dx = (goalX + dir * 0.9) - p.x, dz = iz - p.z;
          const m = Math.hypot(dx, dz) || 1;
          p.pos.x += dx / m * 12 * 0.12; p.pos.z += dz / m * 12 * 0.12;
          p.face = Math.atan2(dx, dz); p.speed = 9;
          if (dist2(p.x, p.z, B.pos.x, B.pos.z) < 1.4 && B.pos.y < 1.7) G.setOwner(p);
          p.aiMove.set(0, 0); return;
        }
      }
      // collect slow balls nearby
      if (canKick && !B.owner && bd < 6 && B.vel.length() < 7) {
        tx = B.pos.x; tz = B.pos.z; sprint = true;
        if (bd < 1.3 && B.pos.y < 1.3) G.setOwner(p);
      }
    }
    p.aiMove.set(tx - p.x, tz - p.z); p.aiSprint = sprint;
  }
}
