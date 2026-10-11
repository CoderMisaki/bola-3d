// ===== BOLA 3D — synthetic audio (no assets) =====
export class SoundKit {
  constructor() { this.ctx = null; this.crowdGain = null; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // looping crowd: filtered noise
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
    this.crowdGain = this.ctx.createGain(); this.crowdGain.gain.value = 0.05;
    src.connect(filt).connect(this.crowdGain).connect(this.ctx.destination);
    src.start();
  }
  kick(power = 0.7) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5 * power + 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.16);
  }
  whistle(n = 1) {
    if (!this.ctx) return;
    for (let k = 0; k < n; k++) {
      const t = this.ctx.currentTime + k * 0.35, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(2350, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
      g.gain.setValueAtTime(0.12, t + 0.22); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.32);
    }
  }
  cheer() {
    if (!this.ctx || !this.crowdGain) return;
    const t = this.ctx.currentTime;
    this.crowdGain.gain.cancelScheduledValues(t);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
    this.crowdGain.gain.linearRampToValueAtTime(0.4, t + 0.25);
    this.crowdGain.gain.exponentialRampToValueAtTime(0.05, t + 3.2);
  }
  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 660;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.08);
  }
}
