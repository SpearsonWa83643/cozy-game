// Motion Lab soundscapes (temporary, ?motionlab=1). Procedural Web Audio, its own AudioContext so the game's
// `sfx` engine is untouched. Each motion style owns a scape; scapes crossfade on style flips. Musical and
// weather events are scheduled from the motion simulation's clock (MotionEvent.t), so bounces land on the
// beat and the mounts flinch exactly when the thunder arrives.
import { SPRING } from '../soundscapes';

export type MotionEvent = { t: number; k: string; n?: number; s?: number; d?: number };
type Voice = { stop(at: number): void };
type Scape = { beds: Voice[]; ev(e: MotionEvent, at: number): void; idle(now: number): void };

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

export const SCAPE_NAMES: Record<string, string> = {
  gentle: 'Meadow Lullaby', springy: 'Boing Pulse', dreamy: 'Starlit Pond', snappy: 'Toybox Tick-Tock',
  physics: 'Open Sky (nature only)', playful: 'Hop Parade', storm: 'Thunderstorm',
};

export class MotionAudio {
  ctx: AudioContext | null = null;
  an: AnalyserNode | null = null;
  /** Debug: [rms, peak] of the last ~43 ms of output. */
  level() { if (!this.an) return [0, 0]; const d = new Float32Array(this.an.fftSize); this.an.getFloatTimeDomainData(d); let s = 0, p = 0; for (const v of d) { s += v * v; p = Math.max(p, Math.abs(v)); } return [Math.sqrt(s / d.length), p]; }
  master!: GainNode; wet!: ConvolverNode; out!: GainNode;
  private noiseBuf!: AudioBuffer; private brownBuf!: AudioBuffer;
  private cur: { id: string; bus: GainNode; sc: Scape } | null = null;
  private wantId = ''; muted = false;
  private rng = 1;
  get running() { return !!this.ctx && this.ctx.state === 'running' && !this.muted; }
  get latency() { const c = this.ctx as any; return (c?.outputLatency || 0) + (c?.baseLatency || 0); }
  r() { this.rng = (this.rng * 16807) % 2147483647; return this.rng / 2147483647; }

  /** Must run inside a user gesture (iOS). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      const c = (this.ctx = new AC());
      this.out = c.createGain(); this.out.gain.value = 0.8;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
      this.out.connect(comp).connect(c.destination);
      this.an = c.createAnalyser(); this.an.fftSize = 2048; comp.connect(this.an);
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(this.out);
      this.wet = c.createConvolver(); this.wet.buffer = this.impulse(2.6); const wg = c.createGain(); wg.gain.value = 0.45; this.wet.connect(wg).connect(this.master);
      const n = c.sampleRate * 4;
      this.noiseBuf = c.createBuffer(1, n, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.brownBuf = c.createBuffer(1, n, c.sampleRate); const b = this.brownBuf.getChannelData(0); let l = 0;
      for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = l * 3.5; }
      // silent blip so iOS fully unlocks
      const o = c.createOscillator(), g = c.createGain(); g.gain.value = 0; o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.05);
      setInterval(() => this.cur && this.ctx && this.cur.sc.idle(this.ctx.currentTime), 100);
    }
    void this.ctx.resume();
    if (this.wantId && (!this.cur || this.cur.id !== this.wantId)) this.play(this.wantId, 1.2);
  }
  setMuted(m: boolean) {
    this.muted = m; if (!this.ctx) return;
    const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(m ? 0 : 1, t, 0.15);
  }
  /** Crossfade to a style's scape. */
  play(id: string, fade = 2) {
    this.wantId = id; const c = this.ctx; if (!c) return;
    if (this.cur?.id === id) return;
    const t = c.currentTime;
    if (this.cur) {
      const o = this.cur; o.bus.gain.cancelScheduledValues(t); o.bus.gain.setValueAtTime(o.bus.gain.value, t); o.bus.gain.linearRampToValueAtTime(0, t + fade);
      for (const v of o.sc.beds) v.stop(t + fade + 0.1);
      setTimeout(() => o.bus.disconnect(), (fade + 0.5) * 1000);
    }
    const bus = c.createGain(); bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(1, t + fade); bus.connect(this.master);
    const send = c.createGain(); send.gain.value = 1; bus.connect(send).connect(this.wet);
    this.cur = { id, bus, sc: (SCAPES[id] ?? SCAPES.gentle)(this, bus) };
  }
  /** Schedule a motion event at audio time `at`. */
  ev(e: MotionEvent, at: number) { if (this.cur && this.ctx) this.cur.sc.ev(e, Math.max(this.ctx.currentTime + 0.005, at)); }

  // ------------------------------------------------------------ building blocks
  private impulse(sec: number) {
    const c = this.ctx!, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3; }
    return b;
  }
  env(g: AudioParam, at: number, peak: number, a: number, d: number) {
    g.setValueAtTime(0.0001, at); g.linearRampToValueAtTime(peak, at + a); g.exponentialRampToValueAtTime(0.0001, at + a + d);
  }
  pan(dest: AudioNode, p: number) { const c = this.ctx!; if (!c.createStereoPanner) return dest; const s = c.createStereoPanner(); s.pan.value = p; s.connect(dest); return s; }
  tone(dest: AudioNode, at: number, f: number, type: OscillatorType, peak: number, a: number, d: number, f2?: number, p = 0) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + a + d * 0.6);
    this.env(g.gain, at, peak, a, d); o.connect(g).connect(this.pan(dest, p)); o.start(at); o.stop(at + a + d + 0.05);
    return o;
  }
  noise(dest: AudioNode, at: number, peak: number, a: number, d: number, type: BiquadFilterType, f: number, q = 1, f2?: number, p = 0, brown = false) {
    const c = this.ctx!, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, at); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, at + a + d);
    this.env(g.gain, at, peak, a, d); s.connect(fl).connect(g).connect(this.pan(dest, p));
    s.start(at, this.r() * 3); s.stop(at + a + d + 0.05);
  }
  /** Continuous filtered-noise bed; returns its gain so callers can swell it. */
  bed(dest: AudioNode, vol: number, type: BiquadFilterType, f: number, q = 0.7, brown = false, lfo = 0, lfoDepth = 0) {
    const c = this.ctx!, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vol;
    s.connect(fl).connect(g).connect(dest); s.start(c.currentTime, this.r() * 3);
    let o: OscillatorNode | null = null;
    if (lfo) { o = c.createOscillator(); const og = c.createGain(); o.frequency.value = lfo; og.gain.value = lfoDepth; o.connect(og).connect(g.gain); o.start(); }
    return { g, fl, stop: (at: number) => { s.stop(at); o?.stop(at); } };
  }
  pad(dest: AudioNode, at: number, notes: number[], dur: number, vol: number, bright = 900) {
    const c = this.ctx!, fl = c.createBiquadFilter(), g = c.createGain(); fl.type = 'lowpass'; fl.frequency.value = bright; fl.connect(g).connect(dest);
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + dur * 0.35); g.gain.linearRampToValueAtTime(vol * 0.8, at + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, at + dur + 1.5);
    for (const m of notes) for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = det; o.connect(fl); o.start(at); o.stop(at + dur + 1.6); }
  }
  pluck(dest: AudioNode, at: number, m: number, vol: number, kind: 'kalimba' | 'musicbox' | 'marimba' | 'xylo' | 'glock', p = 0) {
    const f = mtof(m);
    if (kind === 'kalimba') { this.tone(dest, at, f, 'sine', vol, 0.004, 1.1, undefined, p); this.tone(dest, at, f * 5.4, 'sine', vol * 0.18, 0.002, 0.15, undefined, p); }
    else if (kind === 'musicbox') { this.tone(dest, at, f * 2, 'sine', vol, 0.002, 1.6, undefined, p); this.tone(dest, at, f * 6, 'sine', vol * 0.12, 0.001, 0.4, undefined, p); }
    else if (kind === 'marimba') { this.tone(dest, at, f, 'sine', vol, 0.003, 0.45, undefined, p); this.tone(dest, at, f * 4, 'sine', vol * 0.25, 0.002, 0.08, undefined, p); }
    else if (kind === 'xylo') { this.tone(dest, at, f, 'triangle', vol, 0.002, 0.28, undefined, p); this.tone(dest, at, f * 3.9, 'sine', vol * 0.3, 0.001, 0.06, undefined, p); }
    else { this.tone(dest, at, f * 2, 'sine', vol, 0.002, 0.9, undefined, p); this.tone(dest, at, f * 5.04, 'sine', vol * 0.2, 0.001, 0.3, undefined, p); }
  }
  flute(dest: AudioNode, at: number, m: number, dur: number, vol: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), v = c.createOscillator(), vg = c.createGain();
    o.type = 'sine'; o.frequency.value = mtof(m); v.frequency.value = 5; vg.gain.value = mtof(m) * 0.006; v.connect(vg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.12); g.gain.linearRampToValueAtTime(vol * 0.7, at + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(dest); o.start(at); v.start(at); o.stop(at + dur + 0.05); v.stop(at + dur + 0.05);
    this.noise(dest, at, vol * 0.15, 0.03, 0.15, 'bandpass', mtof(m) * 2, 2);
  }
  kick(dest: AudioNode, at: number, vol: number, p = 0) { this.tone(dest, at, 130, 'sine', vol, 0.003, 0.32, 48, p); }
  tom(dest: AudioNode, at: number, vol: number, f = 180, p = 0) { this.tone(dest, at, f, 'sine', vol, 0.003, 0.22, f * 0.6, p); }
  shaker(dest: AudioNode, at: number, vol: number, p = 0) { this.noise(dest, at, vol, 0.012, 0.06, 'highpass', 6500, 0.8, undefined, p); }
  clap(dest: AudioNode, at: number, vol: number, p = 0) { for (const o of [0, 0.011, 0.022]) this.noise(dest, at + o, vol, 0.002, o === 0.022 ? 0.13 : 0.02, 'bandpass', 1300, 1.4, undefined, p); }
  wood(dest: AudioNode, at: number, vol: number, f = 900, p = 0) { this.tone(dest, at, f, 'sine', vol, 0.001, 0.07, undefined, p); this.tone(dest, at, f * 2.7, 'sine', vol * 0.3, 0.001, 0.03, undefined, p); }
  tamb(dest: AudioNode, at: number, vol: number, p = 0) { this.noise(dest, at, vol, 0.004, 0.25, 'highpass', 7500, 1, undefined, p); for (const f of [5200, 6900]) this.tone(dest, at, f, 'sine', vol * 0.15, 0.002, 0.2, undefined, p); }
  boing(dest: AudioNode, at: number, vol: number, p = 0) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), v = c.createOscillator(), vg = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(170, at); o.frequency.exponentialRampToValueAtTime(420, at + 0.45);
    v.frequency.setValueAtTime(14, at); v.frequency.linearRampToValueAtTime(7, at + 0.5); vg.gain.value = 30; v.connect(vg).connect(o.frequency);
    this.env(g.gain, at, vol, 0.01, 0.55); o.connect(g).connect(this.pan(dest, p)); o.start(at); v.start(at); o.stop(at + 0.6); v.stop(at + 0.6);
  }
  whistle(dest: AudioNode, at: number, dur: number, f0: number, f1: number, vol: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.5); o.frequency.exponentialRampToValueAtTime(f0 * 1.1, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.05); g.gain.linearRampToValueAtTime(vol * 0.6, at + dur * 0.9); g.gain.linearRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.05);
  }
  bird(dest: AudioNode, at: number, vol: number) {
    const p = this.r() * 1.4 - 0.7, base = 2600 + this.r() * 1800, n = 2 + Math.floor(this.r() * 4);
    for (let i = 0; i < n; i++) { const t = at + i * (0.09 + this.r() * 0.06); this.tone(dest, t, base * (1 + this.r() * 0.3), 'sine', vol, 0.01, 0.07, base * (0.75 + this.r() * 0.7), p); }
  }
  rustle(dest: AudioNode, at: number, dur: number, vol: number) {
    const p = this.r() * 1.2 - 0.6;
    for (let i = 0; i < dur * 22; i++) this.noise(dest, at + this.r() * dur, vol * (0.4 + this.r() * 0.6), 0.005, 0.03 + this.r() * 0.05, 'bandpass', 2500 + this.r() * 3500, 1.5, undefined, p);
  }
  drip(dest: AudioNode, at: number, vol: number) { const f = 900 + this.r() * 1300; this.tone(dest, at, f, 'sine', vol, 0.002, 0.09, f * 1.9, this.r() * 1.6 - 0.8); }
  thunder(dest: AudioNode, at: number, s: number) {
    const near = s > 0.7;
    if (near) { this.noise(dest, at, 0.5 * s, 0.004, 0.35, 'highpass', 1800, 0.7); this.noise(dest, at + 0.03, 0.55 * s, 0.01, 0.6, 'lowpass', 1400, 0.7, 300); }
    for (let i = 0; i < 4; i++) this.noise(dest, at + (near ? 0.12 : 0) + i * (0.28 + this.r() * 0.4), (near ? 0.75 : 0.5) * s * (1 - i * 0.18), 0.12, 1.6 + this.r() * 1.5, 'lowpass', near ? 260 : 150, 0.9, 60, 0, true);
  }
}

// ------------------------------------------------------------ the scapes
const S = SPRING.chords;
const NIGHT = [
  { bass: 41, pad: [53, 57, 60, 64, 67], mel: [72, 74, 76, 79, 81] }, { bass: 38, pad: [50, 53, 57, 60, 64], mel: [72, 74, 77, 79, 81] },
  { bass: 46, pad: [53, 58, 62, 65, 69], mel: [70, 72, 74, 77, 81] }, { bass: 36, pad: [52, 55, 60, 62, 67], mel: [72, 74, 76, 79, 84] },
];
const BOUNCE = [36, 36, 43, 41, 36, 36, 45, 43];   // bass roots per bar (C, C, G, F, C, C, A, G)
const DORIAN = [60, 62, 64, 67, 69, 72, 74, 76];

const SCAPES: Record<string, (a: MotionAudio, out: GainNode) => Scape> = {
  // Gentle Float: the game's default spring palette. Pad + flute on SPRING chords, songbirds, a soft breeze.
  gentle: (a, out) => {
    const breeze = a.bed(out, 0.06, 'bandpass', 500, 0.6, false, 0.07, 0.03);
    let nextBird = a.ctx!.currentTime + 2;
    return {
      beds: [breeze],
      ev(e, at) {
        if (e.k !== 'chord') return;
        const ch = S[(e.n ?? 0) % S.length];
        a.pad(out, at, ch.pad, 8, 0.09, 1200); a.pluck(out, at, ch.bass + 12, 0.12, 'kalimba');
        const mel = ch.mel; let tt = 0.5;
        while (tt < 7.2) { if (a.r() < 0.55) a.flute(out, at + tt, mel[Math.floor(a.r() * mel.length)], 0.9 + a.r() * 0.8, 0.08); else a.pluck(out, at + tt, mel[Math.floor(a.r() * mel.length)], 0.1, 'kalimba', a.r() - 0.5); tt += 1 + Math.floor(a.r() * 2); }
      },
      idle(now) { if (now > nextBird) { a.bird(out, now + 0.05, 0.05); nextBird = now + 4 + a.r() * 8; } },
    };
  },
  // Springy: soft kick on every cookie landing, a tom on every eagle landing, shaker on the offbeats, marimba bass.
  springy: (a, out) => ({
    beds: [],
    ev(e, at) {
      if (e.k !== 'beat') return;
      const n = e.n ?? 0, q = ((n % 4) + 4) % 4, bar = Math.floor(n / 4), root = BOUNCE[((bar % 8) + 8) % 8];
      if (q === 0) { a.kick(out, at, 0.32, -0.35); a.pluck(out, at, root + 12, 0.11, 'marimba', -0.2); if (bar % 4 === 0) a.boing(out, at, 0.05, -0.4); }
      if (q === 2) { a.tom(out, at, 0.17, 210, 0.4); a.pluck(out, at, root + 19, 0.07, 'marimba', 0.3); }
      if (q === 1 || q === 3) a.shaker(out, at, 0.035, q === 1 ? -0.2 : 0.2);
      if (q === 3 && a.r() < 0.5) a.pluck(out, at, root + 24 + [0, 4, 7][Math.floor(a.r() * 3)], 0.05, 'marimba', 0.1);
      if (q === 0 && bar % 2 === 0) a.pad(out, at, [root + 24, root + 28, root + 31], 2, 0.012, 800);
    },
    idle() {},
  }),
  // Dreamy: night-time music box over a slow pad, crickets and water lapping at a pond's edge.
  dreamy: (a, out) => {
    const water = a.bed(out, 0.022, 'lowpass', 420, 0.8, true, 0.18, 0.015);
    const crick = a.bed(out, 0.0, 'bandpass', 4600, 18, false, 0, 0);
    const c = a.ctx!, lfo = c.createOscillator(), lg = c.createGain(); lfo.type = 'square'; lfo.frequency.value = 9; lg.gain.value = 0.006; lfo.connect(lg).connect(crick.g.gain); lfo.start();
    return {
      beds: [water, crick, { stop: (t: number) => lfo.stop(t) }],
      ev(e, at) {
        if (e.k === 'chord') { const ch = NIGHT[(e.n ?? 0) % NIGHT.length]; a.pad(out, at, ch.pad.map((m) => m - 12), 6, 0.03, 700); }
        if (e.k === 'beat') { const ch = NIGHT[Math.floor((e.n ?? 0) / 8) % NIGHT.length]; if (a.r() < 0.4) a.pluck(out, at, ch.mel[Math.floor(a.r() * ch.mel.length)] - 12, 0.04, 'musicbox', a.r() * 0.8 - 0.4); }
      },
      idle() {},
    };
  },
  // Snappy: a woodblock tick on each anticipation, a xylophone pop on each snap (cookie), temple block + glock (eagle).
  snappy: (a, out) => ({
    beds: [],
    ev(e, at) {
      if (e.k !== 'beat') return;
      const n = e.n ?? 0, q = ((n % 8) + 8) % 8, seg = Math.floor(n / 8), pose = ((seg % 4) + 4) % 4;
      if (q === 0) a.wood(out, at, 0.11, 1000, -0.35);
      if (q === 1) a.pluck(out, at, DORIAN[[0, 2, 4, 3][pose]] + 12, 0.13, 'xylo', -0.35);
      if (q === 4) a.wood(out, at, 0.09, 700, 0.4);
      if (q === 5) a.pluck(out, at, DORIAN[[4, 5, 7, 6][pose]] + 12, 0.07, 'glock', 0.4);
      if (q === 2 || q === 6) a.shaker(out, at, 0.022);
      if (q === 0 && pose === 0) a.pluck(out, at, 36 + [0, 5, 7, 0][((Math.floor(seg / 4) % 4) + 4) % 4], 0.13, 'marimba');
      if (q === 0 && seg % 8 === 7) a.whistle(out, at + 0.05, 0.4, 700, 1500, 0.02);
    },
    idle() {},
  }),
  // Physics: nature only. Wind whose gusts are the same ones pushing the mounts, rustling leaves, birds, a brook.
  physics: (a, out) => {
    const wind = a.bed(out, 0.09, 'bandpass', 420, 0.5);
    const brook = a.bed(out, 0.035, 'bandpass', 1800, 0.9, false, 0.6, 0.015);
    let nextBird = a.ctx!.currentTime + 1.5;
    return {
      beds: [wind, brook],
      ev(e, at) {
        if (e.k !== 'gust') return;
        const d = e.d ?? 3, s = e.s ?? 1, g = wind.g.gain, f = wind.fl.frequency;
        g.setTargetAtTime(0.09 + 0.2 * s, at, d * 0.22); g.setTargetAtTime(0.09, at + d * 0.55, d * 0.22);
        f.setTargetAtTime(420 + 500 * s, at, d * 0.25); f.setTargetAtTime(420, at + d * 0.55, d * 0.25);
        a.rustle(out, at + d * 0.25, d * 0.5, 0.08 * s);
      },
      idle(now) { if (now > nextBird) { a.bird(out, now + 0.05, 0.045 + a.r() * 0.03); nextBird = now + 2.5 + a.r() * 6; } },
    };
  },
  // Playful: hop (snap) - hop (clap) - BIG hop (kick + tambourine on landing, slide whistle over the top), kalimba riff.
  playful: (a, out) => ({
    beds: [],
    ev(e, at) {
      if (e.k !== 'beat') return;
      const n = e.n ?? 0, q = ((n % 8) + 8) % 8, cyc = Math.floor(n / 8), root = BOUNCE[((cyc % 8) + 8) % 8] + 12;
      if (q === 0) { a.kick(out, at, 0.3, -0.3); a.tamb(out, at, 0.06, -0.3); a.pluck(out, at, root, 0.12, 'marimba'); }
      if (q === 2) { a.clap(out, at, 0.12, -0.3); }
      if (q === 4) { a.clap(out, at, 0.14, -0.3); a.whistle(out, at + 0.02, 0.95, 520, 1250, 0.022); a.wood(out, at, 0.08, 800, 0.4); }
      if (q === 6) a.wood(out, at, 0.08, 1000, 0.4);
      const riff = [0, 7, 12, 7, 16, 12, 19, 14]; a.pluck(out, at, root + 12 + riff[q], q % 2 ? 0.03 : 0.05, 'kalimba', 0.15);
    },
    idle() {},
  }),
  // Storm: rain bed + drips, gusty wind, thunder (near cracks and far rumbles), and a faint warm pad so it stays cozy.
  storm: (a, out) => {
    const rain = a.bed(out, 0.06, 'highpass', 1400, 0.5, false, 0.3, 0.012);
    const rainLow = a.bed(out, 0.07, 'lowpass', 900, 0.6);
    const wind = a.bed(out, 0.04, 'bandpass', 350, 0.6);
    let nextDrip = 0, nextPad = 0;
    return {
      beds: [rain, rainLow, wind],
      ev(e, at) {
        if (e.k === 'thunder') a.thunder(out, at, e.s ?? 1);
        if (e.k === 'gust') {
          const d = e.d ?? 3, s = e.s ?? 1;
          wind.g.gain.setTargetAtTime(0.04 + 0.14 * s, at, d * 0.2); wind.g.gain.setTargetAtTime(0.04, at + d * 0.55, d * 0.25);
          wind.fl.frequency.setTargetAtTime(350 + 450 * s, at, d * 0.25); wind.fl.frequency.setTargetAtTime(350, at + d * 0.55, d * 0.25);
          rain.g.gain.setTargetAtTime(0.06 + 0.05 * s, at, d * 0.2); rain.g.gain.setTargetAtTime(0.06, at + d * 0.6, d * 0.3);
        }
      },
      idle(now) {
        if (now > nextDrip) { a.drip(out, now + 0.05, 0.02 + a.r() * 0.02); nextDrip = now + 0.08 + a.r() * 0.35; }
        if (now > nextPad) { a.pad(out, now + 0.1, [45, 52, 57, 60], 9, 0.016, 500); nextPad = now + 9; }
      },
    };
  },
};
