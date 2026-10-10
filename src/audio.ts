// Tiny WebAudio synth: bell chimes, fizzles and sparkles. No audio files needed.
class Synth {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private wet!: GainNode;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const ctx = this.ctx;
      this.out = ctx.createGain();
      this.out.gain.value = 0.55;
      this.out.connect(ctx.destination);
      // Generated reverb impulse for a dreamy tail.
      const len = ctx.sampleRate * 2.6;
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      const conv = ctx.createConvolver();
      conv.buffer = buf;
      this.wet = ctx.createGain();
      this.wet.gain.value = 0.4;
      this.wet.connect(conv);
      conv.connect(this.out);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private get ready() {
    return !!this.ctx && !this.muted && this.ctx.state === 'running';
  }

  private voice(freq: number, when: number, vol: number, dur: number, type: OscillatorType = 'sine', attack = 0.005) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.out);
    g.connect(this.wet);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  bell(freq: number, when = 0, vol = 0.18, dur = 2.4) {
    if (!this.ready) return;
    const partials: [number, number, number][] = [[1, 1, 1], [2.0, 0.35, 0.7], [2.76, 0.22, 0.5], [5.4, 0.08, 0.3]];
    for (const [m, a, d] of partials) this.voice(freq * m, when, vol * a, dur * d);
  }

  /** Lantern lit: rising notes on a pentatonic scale. */
  lantern(step: number) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    this.bell(notes[step % notes.length], 0, 0.2);
    this.bell(notes[step % notes.length] * 1.5, 0.08, 0.06, 1.5);
  }

  fizzle() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.5);
    const g = ctx.createGain();
    g.gain.value = 0.12;
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t);
    this.bell(392, 0.05, 0.12, 1.2);
    this.bell(311.1, 0.2, 0.12, 1.4);
  }

  solve() {
    if (!this.ready) return;
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    arp.forEach((f, i) => this.bell(f, i * 0.11, 0.16, 2.8));
    // Warm pad underneath.
    for (const f of [261.63, 329.63, 392]) this.voice(f, 0, 0.05, 3.2, 'triangle', 0.6);
  }

  sparkle() {
    if (!this.ready) return;
    const arp = [1046.5, 1318.5, 1568, 2093, 2637];
    arp.forEach((f, i) => this.bell(f, i * 0.06, 0.08, 1.4));
    [523.25, 783.99, 1046.5].forEach((f, i) => this.bell(f, 0.45 + i * 0.18, 0.14, 3));
  }

  blip() {
    if (!this.ready) return;
    this.voice(880, 0, 0.03, 0.12, 'triangle');
  }

  chirp() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const base = 2600 + Math.random() * 900;
    for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) {
      const t = ctx.currentTime + k * 0.13;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.07);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.025, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(this.out); g.connect(this.wet);
      o.start(t); o.stop(t + 0.12);
    }
  }
}

export const sfx = new Synth();
