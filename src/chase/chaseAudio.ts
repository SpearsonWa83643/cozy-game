// 69: Thief Chase sound. A happy, bouncy little loop (C - G - Am - F, 132 bpm) plus the chase
// sound effects, all made on the fly on the game's shared audio context and master bus (so the
// volume button still works). The theme music is ducked while the chase plays.
import { sfx } from '../audio';

const BPM = 132;
const STEP = 60 / BPM / 2; // one eighth note
// Chords as [bass root Hz, arpeggio notes Hz] for each bar.
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392, A4 = 440, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99;
const BARS: [number, number[]][] = [
  [65.41, [C4, E4, G4, C5]],
  [98.0, [B4, D4, G4, D5]],
  [110.0, [A4, C5, E4, E5]],
  [87.31, [F4, A4, C5, A4]],
];
// A cheerful 2-bar tune on top (index into the pentatonic scale, -1 = rest), played over 4 bars.
const SCALE = [C5, D5, E5, G5, A4 * 2];
const TUNE = [0, -1, 2, 3, 2, -1, 0, 1, 2, -1, 3, 4, 3, 2, -1, -1, 4, -1, 3, 2, 1, -1, 2, 0, 1, -1, 2, 1, 0, -1, -1, -1];

class ChaseAudio {
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private next = 0;
  private step = 0;
  playing = false;

  private get ctx() { return sfx.audioCtx as AudioContext | null; }

  private out(): GainNode | null {
    const c = this.ctx, m = sfx.masterBus;
    if (!c || !m) return null;
    if (!this.bus || this.bus.context !== c) { this.bus = c.createGain(); this.bus.gain.value = 0.9; this.bus.connect(m); }
    return this.bus;
  }

  private tone(f: number, at: number, dur: number, vol: number, type: OscillatorType = 'triangle', slideTo?: number, to?: AudioNode) {
    const c = this.ctx, o = to ?? this.out();
    if (!c || !o) return;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g); g.connect(o);
    osc.start(at); osc.stop(at + dur + 0.05);
  }

  private hiss(at: number, dur: number, vol: number, freq: number, type: BiquadFilterType = 'highpass', to?: AudioNode) {
    const c = this.ctx, o = to ?? this.out();
    if (!c || !o) return;
    if (!this.noise) {
      const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f); f.connect(g); g.connect(o);
    src.start(at, Math.random() * 0.5, dur + 0.05);
  }

  private music: GainNode | null = null;
  /** Start the happy chase loop (theme music fades out underneath). */
  start() {
    const c = this.ctx, o = this.out();
    if (!c || !o || this.playing) return;
    this.playing = true;
    sfx.duckMusic(0);
    this.music = c.createGain(); this.music.gain.setValueAtTime(0.0001, c.currentTime); this.music.gain.exponentialRampToValueAtTime(0.55, c.currentTime + 0.8); this.music.connect(o);
    this.next = c.currentTime + 0.1; this.step = 0;
    this.timer = window.setInterval(() => this.pump(), 60);
  }
  private pump() {
    const c = this.ctx, m = this.music;
    if (!c || !m) return;
    while (this.next < c.currentTime + 0.25) {
      const s = this.step, t = this.next;
      const [bass, arp] = BARS[Math.floor(s / 8) % 4];
      // Bouncy bass on the beats, a soft pluck arpeggio on every eighth, a tiny shaker on the off-beats.
      if (s % 2 === 0) this.tone(s % 4 === 0 ? bass : bass * 1.5, t, STEP * 1.6, 0.16, 'triangle', undefined, m);
      this.tone(arp[s % 4], t, STEP * 0.9, 0.035, 'square', undefined, m);
      if (s % 2 === 1) this.hiss(t, 0.05, 0.05, 6000, 'highpass', m);
      if (s % 8 === 4) this.hiss(t, 0.09, 0.07, 1800, 'bandpass', m);
      const n = TUNE[s % TUNE.length];
      if (n >= 0) { this.tone(SCALE[n], t, STEP * 1.7, 0.07, 'sine', undefined, m); this.tone(SCALE[n] * 2, t, STEP * 0.8, 0.015, 'sine', undefined, m); }
      this.step++; this.next += STEP;
    }
  }
  /** Stop the loop and bring the theme music back. */
  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const c = this.ctx, m = this.music;
    if (c && m) { m.gain.cancelScheduledValues(c.currentTime); m.gain.setTargetAtTime(0.0001, c.currentTime, 0.15); setTimeout(() => m.disconnect(), 900); }
    this.music = null;
    if (this.playing) sfx.duckMusic(1);
    this.playing = false;
  }
  pause(on: boolean) {
    const c = this.ctx, m = this.music;
    if (!c || !m) return;
    if (on) { if (this.timer !== null) clearInterval(this.timer); this.timer = null; m.gain.setTargetAtTime(0.0001, c.currentTime, 0.1); }
    else if (this.timer === null) { m.gain.setTargetAtTime(0.55, c.currentTime, 0.2); this.next = c.currentTime + 0.1; this.timer = window.setInterval(() => this.pump(), 60); }
  }

  private now() { return this.ctx?.currentTime ?? 0; }
  /** A soft "fwoop" as a bubble net flies up. */
  throw() { const t = this.now(); this.tone(380, t, 0.16, 0.08, 'sine', 900); this.hiss(t, 0.12, 0.05, 2500, 'bandpass'); }
  /** Boing + twinkle when a net lands on the thief. */
  hit(n: number) { const t = this.now(); this.tone(620, t, 0.28, 0.14, 'triangle', 260); [C5, E5, G5].forEach((f, i) => this.tone(f * (1 + n * 0.06), t + 0.08 + i * 0.06, 0.25, 0.06, 'sine')); }
  star() { const t = this.now(); this.tone(1318.5, t, 0.18, 0.07, 'sine'); this.tone(1760, t + 0.06, 0.25, 0.06, 'sine'); }
  berry() { const t = this.now(); this.tone(420, t, 0.12, 0.1, 'sine', 880); this.tone(990, t + 0.07, 0.12, 0.05, 'triangle'); }
  /** A soft, funny "bwomp" for bumping a cloud or balloon (never scary). */
  bump() { const t = this.now(); this.tone(240, t, 0.3, 0.12, 'sine', 150); this.tone(300, t + 0.05, 0.22, 0.05, 'triangle', 200); this.hiss(t, 0.2, 0.04, 900, 'lowpass'); }
  /** Big happy fanfare for the catch. */
  fanfare() {
    const t = this.now();
    [C4, E4, G4, C5, E5, G5].forEach((f, i) => this.tone(f, t + i * 0.09, 0.4, 0.09, 'triangle'));
    [C5, E5, G5].forEach((f) => this.tone(f, t + 0.6, 1.2, 0.07, 'sine'));
    this.tone(C5 * 2, t + 0.6, 1.4, 0.04, 'sine');
  }
  /** A gentle, not-sad "aww" when the thief gets away. */
  aww() { const t = this.now(); [G4, E4, D4, C4].forEach((f, i) => this.tone(f, t + i * 0.14, 0.35, 0.08, 'sine')); this.tone(C5, t + 0.75, 0.6, 0.05, 'sine'); }
}

export const chaseAudio = new ChaseAudio();
