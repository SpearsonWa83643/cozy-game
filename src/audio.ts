// Tiny WebAudio synth: bell chimes, fizzles and sparkles. No audio files needed.
export type VolumeLevel = 'on' | 'quiet' | 'off';
const LEVELS: Record<VolumeLevel, number> = { on: 0.6, quiet: 0.26, off: 0 };

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class Synth {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private out!: GainNode; // SFX bus
  private music!: GainNode; // music bus
  private wet!: GainNode;
  private padFilter!: BiquadFilterNode;
  muted = false;
  level: VolumeLevel = 'on';
  private musicTimer: number | null = null;
  private nextChordAt = 0;
  private chordIdx = 0;
  private lastMelody = 72;

  constructor() {
    try {
      const saved = localStorage.getItem('cozy.vol') as VolumeLevel | null;
      if (saved && saved in LEVELS) this.level = saved;
    } catch { /* storage unavailable */ }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  /** Must be called from a user gesture (touchend/keydown/click) — required by iOS Safari. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      // Play through the iPad's mute switch like a music app would (Safari 17+).
      try { if ((navigator as any).audioSession) (navigator as any).audioSession.type = 'playback'; } catch { /* ignore */ }
      this.ctx = new AC();
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = LEVELS[this.level];
      this.master.connect(ctx.destination);
      this.out = ctx.createGain();
      this.out.gain.value = 0.9;
      this.out.connect(this.master);
      this.music = ctx.createGain();
      this.music.gain.value = 0;
      this.music.connect(this.master);
      // Generated reverb impulse for a dreamy tail.
      const len = Math.floor(ctx.sampleRate * 3.2);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      }
      const conv = ctx.createConvolver();
      conv.buffer = buf;
      this.wet = ctx.createGain();
      this.wet.gain.value = 0.4;
      this.wet.connect(conv);
      conv.connect(this.master);
      // Warm, slowly breathing low-pass for the pads.
      this.padFilter = ctx.createBiquadFilter();
      this.padFilter.type = 'lowpass';
      this.padFilter.frequency.value = 950;
      this.padFilter.Q.value = 0.4;
      const lfo = ctx.createOscillator();
      const lfoAmt = ctx.createGain();
      lfo.frequency.value = 0.045;
      lfoAmt.gain.value = 320;
      lfo.connect(lfoAmt);
      lfoAmt.connect(this.padFilter.frequency);
      lfo.start();
      this.padFilter.connect(this.music);
      this.padFilter.connect(this.wet);
      // iOS needs a sound started inside the gesture to fully unlock.
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.05);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
    this.startMusic();
  }

  get unlocked() { return !!this.ctx; }

  setLevel(level: VolumeLevel) {
    this.level = level;
    try { localStorage.setItem('cozy.vol', level); } catch { /* ignore */ }
    if (this.ctx) this.master.gain.setTargetAtTime(LEVELS[level], this.ctx.currentTime, 0.15);
  }

  cycleLevel(): VolumeLevel {
    const order: VolumeLevel[] = ['on', 'quiet', 'off'];
    this.setLevel(order[(order.indexOf(this.level) + 1) % order.length]);
    return this.level;
  }

  // ------------------------------------------------------------ generative ambient music
  private static CHORDS = [
    // [bass, pad notes, melody pool] — F major, slow and open.
    { bass: 41, pad: [53, 57, 60, 64, 67], mel: [72, 74, 76, 79, 81, 84] },          // Fmaj9
    { bass: 38, pad: [50, 53, 57, 60, 64], mel: [72, 74, 77, 79, 81] },              // Dm9
    { bass: 46, pad: [50, 53, 57, 62, 64], mel: [74, 76, 77, 81, 82] },              // Bbmaj7(9)
    { bass: 36, pad: [48, 52, 55, 57, 62], mel: [72, 74, 76, 79, 84] },              // C6/9
    { bass: 45, pad: [52, 57, 60, 64, 67], mel: [72, 76, 79, 81, 84] },              // Am7
    { bass: 46, pad: [50, 53, 57, 60, 65], mel: [72, 74, 77, 81] },                  // Bbmaj9
    { bass: 43, pad: [50, 55, 58, 62, 65], mel: [74, 77, 79, 82] },                  // Gm9
    { bass: 36, pad: [48, 53, 55, 58, 62], mel: [72, 74, 77, 79] },                  // C9sus
  ];
  private static CHORD_LEN = 8.5;
  /** Per-area mood: transposition (semitones), melody density and pad brightness. */
  private static MOODS: Record<string, { tr: number; dens: number; cut: number }> = {
    glade: { tr: 0, dens: 0.3, cut: 950 }, river: { tr: 0, dens: 0.36, cut: 1200 },
    forest: { tr: -3, dens: 0.2, cut: 700 }, orchard: { tr: 2, dens: 0.42, cut: 1350 }, lake: { tr: -1, dens: 0.26, cut: 850 },
  };
  private mood = Synth.MOODS.glade;
  area = 'glade';
  setArea(a: string) {
    this.area = a;
    this.mood = Synth.MOODS[a] ?? Synth.MOODS.glade;
    if (this.ctx && this.padFilter) this.padFilter.frequency.linearRampToValueAtTime(this.mood.cut, this.ctx.currentTime + 4);
  }

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.music.gain.setValueAtTime(0, this.ctx.currentTime);
    this.music.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 6);
    this.nextChordAt = this.ctx.currentTime + 0.3;
    const tick = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      while (this.nextChordAt < this.ctx.currentTime + 2) {
        this.scheduleChord(this.nextChordAt);
        this.nextChordAt += Synth.CHORD_LEN;
      }
    };
    tick();
    this.musicTimer = window.setInterval(tick, 400);
  }

  private scheduleChord(t: number) {
    const ctx = this.ctx!;
    const base = Synth.CHORDS[this.chordIdx % Synth.CHORDS.length];
    const tr = this.mood.tr;
    const chord = { bass: base.bass + tr, pad: base.pad.map((n) => n + tr), mel: base.mel.map((n) => n + tr) };
    this.chordIdx++;
    const L = Synth.CHORD_LEN;
    // Pad: two slightly detuned voices per note, long swells overlapping the next chord.
    chord.pad.forEach((n, k) => {
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = det < 0 ? 'sine' : 'triangle';
        o.frequency.value = midi(n);
        o.detune.value = det + (Math.random() * 4 - 2);
        const g = ctx.createGain();
        const peak = (det < 0 ? 0.03 : 0.014) * (k === 0 ? 1.1 : 1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 2.8 + k * 0.25);
        g.gain.setValueAtTime(peak, t + L - 0.5);
        g.gain.linearRampToValueAtTime(0.0001, t + L + 3.5);
        o.connect(g); g.connect(this.padFilter);
        o.start(t); o.stop(t + L + 3.7);
      }
    });
    // Soft bass.
    {
      const o = ctx.createOscillator();
      o.frequency.value = midi(chord.bass);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07, t + 1.6);
      g.gain.linearRampToValueAtTime(0.0001, t + L + 1.5);
      o.connect(g); g.connect(this.music);
      o.start(t); o.stop(t + L + 1.6);
    }
    // Sparse kalimba melody on a 0.71 s grid, mostly stepwise.
    const beat = L / 12;
    for (let i = 1; i < 12; i++) {
      if (Math.random() > this.mood.dens) continue;
      const pool = chord.mel;
      const near = pool.filter((p) => Math.abs(p - this.lastMelody) <= 5);
      const src = near.length && Math.random() < 0.8 ? near : pool;
      const n = src[Math.floor(Math.random() * src.length)];
      this.lastMelody = n;
      this.kalimba(midi(n), t + i * beat + (Math.random() * 0.06), 0.035 + Math.random() * 0.035);
      if (Math.random() < 0.15) this.kalimba(midi(n + 12), t + i * beat + 0.18, 0.015);
    }
  }

  private kalimba(freq: number, t: number, vol: number) {
    const ctx = this.ctx!;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 0.8 - 0.4;
    const dest: AudioNode = pan ?? this.music;
    if (pan) { pan.connect(this.music); pan.connect(this.wet); }
    for (const [m, a, d] of [[1, 1, 1.8], [3.0, 0.1, 0.35], [5.4, 0.05, 0.18]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = freq * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * a, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + d + 0.05);
    }
  }

  // ------------------------------------------------------------ critter + ambience SFX
  private noise(dur: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  wind(strength = 1) {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = this.noise(4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(900, t + 1.6);
    f.frequency.linearRampToValueAtTime(350, t + 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 * strength, t + 1.4);
    g.gain.linearRampToValueAtTime(0.0001, t + 4);
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t);
  }

  purr() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = this.noise(1.8);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0;
    const am = ctx.createOscillator();
    const amG = ctx.createGain();
    am.frequency.value = 24;
    amG.gain.value = 0.06;
    am.connect(amG); amG.connect(g.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + 0.25);
    env.gain.linearRampToValueAtTime(0.0001, t + 1.7);
    src.connect(f); f.connect(g); g.connect(env); env.connect(this.out);
    src.start(t); am.start(t); am.stop(t + 1.8);
    this.bell(1318.5, 0.05, 0.05, 1.2);
  }

  croak() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    for (let k = 0; k < 2; k++) {
      const t = ctx.currentTime + k * 0.16;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.03, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(f); f.connect(g); g.connect(this.out);
      o.start(t); o.stop(t + 0.13);
    }
  }

  plip() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(380, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(this.out); g.connect(this.wet);
    o.start(t); o.stop(t + 0.15);
  }

  quack() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420, t);
    o.frequency.linearRampToValueAtTime(300, t + 0.14);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.025, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(f); f.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + 0.18);
  }

  private noiseBurst(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'bandpass', when = 0, sweep = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const src = this.noise(dur);
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t); src.stop(t + dur + 0.02);
  }
  rustle() { if (!this.ready) return; this.noiseBurst(0.35, 2600, 0.8, 0.05); this.noiseBurst(0.25, 4200, 1.2, 0.025, 'bandpass', 0.12); }
  tock() { if (!this.ready) return; this.voice(320, 0, 0.06, 0.12, 'triangle'); this.noiseBurst(0.06, 900, 2, 0.04); }
  pickup() { if (!this.ready) return; this.bell(1318.5, 0, 0.07, 0.6); this.bell(1760, 0.07, 0.06, 0.8); }
  chimes() { if (!this.ready) return; [1568, 1975.5, 2349.3, 1760, 2637].forEach((f, i) => this.bell(f, i * 0.09 + Math.random() * 0.04, 0.06, 2.4)); }
  creak() {
    if (!this.ready) return;
    const ctx = this.ctx!, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t); o.frequency.linearRampToValueAtTime(150, t + 0.5); o.frequency.linearRampToValueAtTime(95, t + 0.9);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    o.connect(f); f.connect(g); g.connect(this.out); o.start(t); o.stop(t + 1);
    this.noiseBurst(1.2, 500, 0.6, 0.04, 'lowpass');
  }
  unlockGate() { if (!this.ready) return; this.tock(); this.voice(220, 0.12, 0.08, 0.2, 'triangle'); this.solve(); }
  hoot() { if (!this.ready) return; for (const [w, d] of [[0, 0.35], [0.5, 0.25], [0.8, 0.6]]) { this.voice(392, w, 0.07, d, 'sine', 0.06); this.voice(370, w + 0.02, 0.03, d, 'triangle', 0.06); } }
  thump() { if (!this.ready) return; this.voice(90, 0, 0.12, 0.12, 'sine'); this.voice(70, 0.11, 0.1, 0.1, 'sine'); }
  splash(big = false) { if (!this.ready) return; this.noiseBurst(big ? 0.6 : 0.35, 1400, 0.7, big ? 0.09 : 0.05, 'bandpass', 0, 0.4); this.plip(); }
  bite() { if (!this.ready) return; this.plip(); this.noiseBurst(0.2, 1800, 1, 0.05, 'bandpass', 0.05, 0.5); this.voice(880, 0.02, 0.05, 0.25, 'triangle'); }
  reel(ok: boolean) { if (!this.ready) return; if (ok) { this.voice(1046.5, 0, 0.08, 0.25, 'triangle'); this.voice(1568, 0.06, 0.05, 0.3, 'triangle'); } else { this.voice(220, 0, 0.06, 0.25, 'triangle'); this.voice(207.6, 0.08, 0.05, 0.3, 'triangle'); } }
  cast() { if (!this.ready) return; this.noiseBurst(0.3, 3000, 2, 0.03, 'bandpass', 0, 0.3); }
  caught(rare = false) { if (!this.ready) return; const arp = rare ? [784, 988, 1175, 1568, 1976] : [784, 988, 1175, 1568]; arp.forEach((f, i) => this.bell(f, i * 0.09, 0.12, 2)); }
  dig() { if (!this.ready) return; this.noiseBurst(0.25, 700, 0.8, 0.08, 'lowpass'); this.noiseBurst(0.2, 1500, 1, 0.04, 'bandpass', 0.18); }
  /** Bell-puzzle pitches (also sung by the songbird an octave higher). */
  bellNote(i: number, bird = false) {
    if (!this.ready) return;
    const notes = [659.25, 783.99, 880, 1046.5];
    const f = notes[i % 4] * (bird ? 2 : 1);
    if (bird) { this.voice(f, 0, 0.06, 0.18, 'sine', 0.02); this.voice(f * 1.12, 0.07, 0.04, 0.12, 'sine', 0.01); }
    else this.bell(f, 0, 0.16, 2.6);
  }
  softFail() { if (!this.ready) return; this.voice(330, 0, 0.06, 0.4, 'triangle'); this.voice(311, 0.12, 0.05, 0.5, 'triangle'); }

  private get ready() {
    return !!this.ctx && !this.muted && this.level !== 'off' && this.ctx.state === 'running';
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
