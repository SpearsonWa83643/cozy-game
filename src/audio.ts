// Tiny WebAudio synth: bell chimes, fizzles and sparkles. No audio files needed.
export type VolumeLevel = 'on' | 'quiet' | 'off';
const LEVELS: Record<VolumeLevel, number> = { on: 0.6, quiet: 0.26, off: 0 };

import { SPRING, HALLOWEEN, type Soundscape, type Extra } from './soundscapes';
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class Synth {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private out!: GainNode; // SFX bus
  private music!: GainNode; // music bus
  private wet!: GainNode;
  private padLfo!: GainNode;
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
      // Slowly breathing low-pass LFO for the pads (each soundscape layer has its own filter).
      const lfo = ctx.createOscillator();
      this.padLfo = ctx.createGain();
      lfo.frequency.value = 0.045;
      this.padLfo.gain.value = 320;
      lfo.connect(this.padLfo);
      lfo.start();
      this.buildLayer(0);
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
  // ------------------------------------------------------------ theme soundscapes
  /** Active soundscape; each has its own layer (gain + pad filter) so a switch crossfades. */
  private scape: Soundscape = SPRING;
  private layer: { gain: GainNode; pad: BiquadFilterNode; windSrc?: AudioBufferSourceNode } | null = null;
  private extraAt: number[] = [];
  festival = false;
  get soundscape() { return this.scape.id; }
  setSoundscape(sc: Soundscape) {
    if (sc === this.scape && this.layer) return;
    this.scape = sc;
    if (!this.ctx) return; // built on unlock
    this.buildLayer(3);
  }
  private buildLayer(fade: number) {
    const ctx = this.ctx!, t = ctx.currentTime, sc = this.scape;
    const old = this.layer;
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0.0001, t + fade);
      window.setTimeout(() => { try { old.windSrc?.stop(); old.gain.disconnect(); old.pad.disconnect(); } catch { /* already gone */ } }, (fade + 12) * 1000);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(1, t + (old ? fade : 0.05));
    gain.connect(this.music);
    const pad = ctx.createBiquadFilter();
    pad.type = 'lowpass'; pad.Q.value = 0.4;
    pad.frequency.value = this.mood.cut * sc.bright;
    this.padLfo.connect(pad.frequency);
    pad.connect(gain); pad.connect(this.wet);
    const layer: { gain: GainNode; pad: BiquadFilterNode; windSrc?: AudioBufferSourceNode } = { gain, pad };
    if (sc.wind > 0) {
      // Soft, slowly breathing wind bed: looped noise through a wandering band-pass.
      const src = this.noise(6); src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.9;
      const fl = ctx.createOscillator(); fl.frequency.value = 0.07;
      const fa = ctx.createGain(); fa.gain.value = 220; fl.connect(fa); fa.connect(f.frequency);
      const g = ctx.createGain(); g.gain.value = 0.016 * sc.wind;
      const gl = ctx.createOscillator(); gl.frequency.value = 0.11;
      const ga = ctx.createGain(); ga.gain.value = 0.009 * sc.wind; gl.connect(ga); ga.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(gain);
      src.start(t); fl.start(t); gl.start(t);
      src.onended = () => { try { fl.stop(); gl.stop(); } catch { /* */ } };
      layer.windSrc = src;
    }
    this.layer = layer;
    this.extraAt = sc.extras.map((e) => t + 4 + Math.random() * e.every[0]);
    // Start the new music right away; the old chord rings out on the fading layer.
    if (old) this.nextChordAt = t + 0.2;
  }
  private playExtra(e: Extra, at: number) {
    const v = e.vol, ctx = this.ctx!;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5);
    const dest: AudioNode = pan ?? this.layer!.gain;
    if (pan) { pan.connect(this.layer!.gain); pan.connect(this.wet); }
    const tone = (f0: number, f1: number, w: number, d: number, vol: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, at + w); o.frequency.linearRampToValueAtTime(f1, at + w + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at + w);
      g.gain.linearRampToValueAtTime(vol, at + w + Math.min(0.08, d * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, at + w + d);
      o.connect(g); g.connect(dest); o.start(at + w); o.stop(at + w + d + 0.05);
    };
    if (e.kind === 'owl') {
      // Distant, soft "hoo... hoo-hoo".
      for (const [w, d] of [[0, 0.42], [0.62, 0.22], [0.9, 0.5]]) { tone(400, 372, w, d, 0.022 * v); tone(800, 744, w, d, 0.004 * v, 'triangle'); }
    } else if (e.kind === 'creak') {
      // A friendly old-gate creak, filtered and quiet.
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(130, at); o.frequency.linearRampToValueAtTime(175, at + 0.45); o.frequency.linearRampToValueAtTime(120, at + 0.9);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 5;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.014 * v, at + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.95);
      o.connect(f); f.connect(g); g.connect(dest); o.start(at); o.stop(at + 1);
    } else if (e.kind === 'birds') {
      // A little songbird: a few quick chirps, sometimes a trill (soft, high, sweeping).
      const base = 2600 + Math.random() * 1400, n = 2 + Math.floor(Math.random() * 4);
      let w = 0;
      for (let i = 0; i < n; i++) {
        const up = Math.random() < 0.6, d = 0.06 + Math.random() * 0.07, f = base * (0.9 + Math.random() * 0.25);
        tone(up ? f * 0.8 : f * 1.15, up ? f * 1.2 : f * 0.85, w, d, 0.011 * v);
        w += d + 0.03 + Math.random() * 0.06;
      }
      if (Math.random() < 0.4) for (let i = 0; i < 6; i++) tone(base * 1.1, base * 1.25, w + 0.1 + i * 0.045, 0.04, 0.007 * v); // trill
    } else if (e.kind === 'cuckoo') {
      // Far-off cuckoo: two soft falling notes (a major third), muffled.
      for (const [w, f] of [[0, 760], [0.42, 604]]) { tone(f, f * 0.98, w, 0.34, 0.018 * v); tone(f * 2, f * 1.96, w, 0.2, 0.002 * v, 'triangle'); }
    } else if (e.kind === 'drops') {
      // A few fresh raindrops dripping off leaves: tiny quick downward plinks.
      const k = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < k; i++) { const f = 1300 + Math.random() * 900; tone(f, f * 0.55, i * (0.18 + Math.random() * 0.3), 0.07, 0.012 * v); }
    } else if (e.kind === 'geese') {
      // A far-off V of geese: a few soft, nasal "honk"s at slightly different pitches.
      const k = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < k; i++) {
        const f = 330 + Math.random() * 70, w = i * (0.32 + Math.random() * 0.22);
        tone(f, f * 0.9, w, 0.16, 0.012 * v, 'triangle'); tone(f * 2, f * 1.8, w, 0.12, 0.003 * v, 'square');
      }
    } else if (e.kind === 'crackle') {
      // A cozy fireside crackle: a quick run of tiny, quiet pops.
      const k = 5 + Math.floor(Math.random() * 7);
      let w = 0;
      for (let i = 0; i < k; i++) { const f = 900 + Math.random() * 2200; tone(f, f * 0.4, w, 0.018 + Math.random() * 0.02, 0.008 * v, 'square'); w += 0.04 + Math.random() * 0.16; }
    } else if (e.kind === 'sleighbells') {
      // Sleigh bells jingling past: a soft shaken run of bright little bell tings, swelling and fading.
      const k = 10 + Math.floor(Math.random() * 8);
      let w = 0;
      for (let i = 0; i < k; i++) {
        const sw = Math.sin((i / (k - 1)) * Math.PI), f = 2600 + Math.random() * 1500;
        tone(f, f * 0.97, w, 0.09, (0.004 + 0.008 * sw) * v, 'triangle'); tone(f * 1.5, f * 1.46, w + 0.01, 0.05, 0.002 * sw * v);
        w += 0.06 + Math.random() * 0.07;
      }
    } else {
      // Tiny wind chimes in D minor.
      const ns = [86, 89, 93, 88, 91];
      for (let i = 0; i < 4; i++) this.musicbox(midi(ns[Math.floor(Math.random() * ns.length)]), at + i * (0.16 + Math.random() * 0.1), 0.012 * v, dest);
    }
  }
  /** Music box / celesta: bright sine with a soft octave-and-a-bit shimmer, quick bloom, long fade. */
  private musicbox(freq: number, t: number, vol: number, dest?: AudioNode) {
    const ctx = this.ctx!;
    let out = dest;
    if (!out) {
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) { pan.pan.value = Math.random() * 0.8 - 0.4; pan.connect(this.layer!.gain); pan.connect(this.wet); }
      out = pan ?? this.layer!.gain;
    }
    for (const [m, a, d] of [[1, 1, 1.5], [2, 0.18, 0.6], [4.07, 0.08, 0.22]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = freq * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * a, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + d + 0.05);
    }
  }
  /** Back-compat for older callers. */
  setTheme(t: 'classic' | 'spring' | 'spooky') { this.setSoundscape(t === 'spooky' ? HALLOWEEN : SPRING); }
  private static CHORD_LEN = 8.5;
  /** Per-area mood: transposition (semitones), melody density and pad brightness. */
  private static MOODS: Record<string, { tr: number; dens: number; cut: number }> = {
    glade: { tr: 0, dens: 0.3, cut: 950 }, river: { tr: 0, dens: 0.36, cut: 1200 },
    forest: { tr: -3, dens: 0.2, cut: 700 }, orchard: { tr: 2, dens: 0.42, cut: 1350 }, lake: { tr: -1, dens: 0.26, cut: 850 },
    village: { tr: 2, dens: 0.4, cut: 1250 },
  };
  private mood = Synth.MOODS.glade;
  area = 'glade';
  setArea(a: string) {
    this.area = a;
    this.mood = Synth.MOODS[a] ?? Synth.MOODS.glade;
    if (this.ctx && this.layer) this.layer.pad.frequency.linearRampToValueAtTime(this.mood.cut * this.scape.bright, this.ctx.currentTime + 4);
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
      // Occasional ambient extras (owls, creaks, chimes) for this soundscape.
      const now = this.ctx.currentTime;
      this.scape.extras.forEach((e, i) => {
        if (this.extraAt[i] === undefined || now < this.extraAt[i]) return;
        this.playExtra(e, now + 0.1);
        this.extraAt[i] = now + e.every[0] + Math.random() * (e.every[1] - e.every[0]);
      });
    };
    tick();
    this.musicTimer = window.setInterval(tick, 400);
  }

  private scheduleChord(t: number) {
    const ctx = this.ctx!;
    const sc = this.scape, set = sc.chords, layer = this.layer!;
    const base = set[this.chordIdx % set.length];
    const tr = this.mood.tr + (this.festival ? 2 : 0);
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
        const peak = (det < 0 ? 0.03 : 0.014) * (k === 0 ? 1.1 : 1) * sc.pad;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 2.8 + k * 0.25);
        g.gain.setValueAtTime(peak, t + L - 0.5);
        g.gain.linearRampToValueAtTime(0.0001, t + L + 3.5);
        o.connect(g); g.connect(layer.pad);
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
      o.connect(g); g.connect(layer.gain);
      o.start(t); o.stop(t + L + 1.6);
    }
    // Sparse kalimba melody on a 0.71 s grid, mostly stepwise.
    const beat = L / 12;
    for (let i = 1; i < 12; i++) {
      if (Math.random() > (this.festival ? 0.75 : Math.min(0.8, this.mood.dens * sc.dens))) continue;
      const pool = chord.mel;
      const near = pool.filter((p) => Math.abs(p - this.lastMelody) <= 5);
      const src = near.length && Math.random() < 0.8 ? near : pool;
      const n = src[Math.floor(Math.random() * src.length)];
      this.lastMelody = n;
      if (sc.lead === 'flute') {
        this.flute(midi(n), t + i * beat + (Math.random() * 0.05), 0.02 + Math.random() * 0.014, beat * (Math.random() < 0.3 ? 2.2 : 1.3));
      } else if (sc.lead === 'musicbox') {
        this.musicbox(midi(n + 12), t + i * beat + (Math.random() * 0.05), 0.022 + Math.random() * 0.02);
        if (Math.random() < 0.2) this.musicbox(midi(n + 7), t + i * beat + 0.12, 0.01);
      } else {
        this.kalimba(midi(n), t + i * beat + (Math.random() * 0.06), 0.035 + Math.random() * 0.035);
        if (Math.random() < 0.15) this.kalimba(midi(n + 12), t + i * beat + 0.18, 0.015);
      }
    }
  }

  /** Airy little flute (Spring): soft sine + a breath of octave, gentle swell and a light vibrato. */
  private flute(freq: number, t: number, vol: number, len: number) {
    const ctx = this.ctx!;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 0.6 - 0.3;
    const dest: AudioNode = pan ?? this.layer!.gain;
    if (pan) { pan.connect(this.layer!.gain); pan.connect(this.wet); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4.8 + Math.random();
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(freq * 0.006, t + len * 0.6);
    lfo.connect(lg);
    for (const [m, a] of [[1, 1], [2, 0.12], [3, 0.03]] as const) {
      const o = ctx.createOscillator(); o.frequency.value = freq * m; lg.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * a, t + 0.09);
      g.gain.setValueAtTime(vol * a * 0.85, t + len * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.35);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + len + 0.4);
    }
    lfo.start(t); lfo.stop(t + len + 0.4);
  }

  private kalimba(freq: number, t: number, vol: number) {
    const ctx = this.ctx!;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 0.8 - 0.4;
    const dest: AudioNode = pan ?? this.layer!.gain;
    if (pan) { pan.connect(this.layer!.gain); pan.connect(this.wet); }
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
  /** 11.5b: a crisp little chip at the ice (a click of noise over a short glassy tick). */
  iceChip() {
    if (!this.ready) return;
    const p = 0.92 + Math.random() * 0.16;
    this.noiseBurst(0.07, 5200 * p, 2.5, 0.06, 'highpass');
    this.noiseBurst(0.05, 1800 * p, 4, 0.04, 'bandpass', 0.005);
    this.voice(2400 * p, 0, 0.025, 0.06, 'triangle', 0.002);
  }
  /** 11.5b: the hole opens: a bright, icy plink with a soft water blip under it. */
  icePlink() {
    if (!this.ready) return;
    this.voice(1760, 0, 0.05, 0.5, 'sine', 0.002);
    this.voice(2637, 0.06, 0.035, 0.45, 'sine', 0.002);
    this.voice(3520, 0.12, 0.02, 0.35, 'sine', 0.002);
    this.plip();
  }
  // ------------------------------------------------------------ 12.6 room ambience (each interior has its own quiet bed)
  private roomTimer: ReturnType<typeof setTimeout> | null = null;
  roomKind = '';
  /** Start (or stop, with null) a sparse, gentle ambience for the room you are standing in. */
  roomAmbience(type: string | null) {
    if (this.roomTimer) { clearTimeout(this.roomTimer); this.roomTimer = null; }
    this.roomKind = type ?? '';
    if (!type) return;
    const tick = () => {
      if (this.roomKind !== type) return;
      if (this.ready) this.roomTick(type);
      this.roomTimer = setTimeout(tick, 900 + Math.random() * 1900);
    };
    this.roomTimer = setTimeout(tick, 400);
  }
  private roomTick(type: string) {
    const r = Math.random();
    switch (type) {
      case 'home': // fireplace: soft crackles, now and then a clock tick
        for (let i = 0; i < 2 + Math.floor(r * 3); i++) this.noiseBurst(0.04 + Math.random() * 0.05, 2200 + Math.random() * 2600, 1.5, 0.03, 'highpass', i * (0.05 + Math.random() * 0.1));
        if (r > 0.8) this.voice(1100, 0.1, 0.03, 0.05, 'triangle');
        break;
      case 'kitchen': // a simmering pot: tiny bubbles, a kettle-ish hush
        for (let i = 0; i < 3; i++) this.voice(500 + Math.random() * 500, i * 0.11, 0.018, 0.06, 'sine', 0.01);
        if (r > 0.6) this.noiseBurst(0.7, 5200, 1, 0.012, 'highpass');
        break;
      case 'workshop': // wood ticking, a far-off tap, a gentle saw hiss
        if (r < 0.5) { this.voice(240, 0, 0.04, 0.08, 'triangle'); this.noiseBurst(0.05, 1400, 3, 0.03); }
        else if (r < 0.8) this.noiseBurst(0.35, 1700, 1.5, 0.014, 'bandpass', 0, 0.5);
        else this.bell(880, 0, 0.03, 0.6);
        break;
      case 'garden': // birds, a breeze through leaves
        if (r < 0.6) { const f = 2200 + Math.random() * 1400; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) { this.voice(f, i * 0.09, 0.025, 0.07, 'sine', 0.01); this.voice(f * 1.18, i * 0.09 + 0.04, 0.02, 0.05, 'sine', 0.01); } }
        else this.noiseBurst(1.2, 2400, 0.5, 0.015, 'bandpass', 0, 0.6);
        break;
      case 'fishhut': // water lapping at the pier, a creak of rope
        this.noiseBurst(1.1, 520, 0.8, 0.035, 'lowpass', 0, 0.5);
        if (r > 0.7) this.noiseBurst(0.9, 330, 3, 0.02, 'bandpass', 0.5, 1.4);
        break;
    }
  }
  rustle() { if (!this.ready) return; this.noiseBurst(0.35, 2600, 0.8, 0.05); this.noiseBurst(0.25, 4200, 1.2, 0.025, 'bandpass', 0.12); }
  /** 12.8 room props: fire crackle, kettle whistle, cuckoo, lantern ting. */
  crackle() { if (!this.ready) return; for (let i = 0; i < 6; i++) this.noiseBurst(0.04, 2400 + Math.random() * 2400, 3, 0.05, 'highpass', i * 0.07 + Math.random() * 0.04); this.noiseBurst(0.5, 260, 0.7, 0.05, 'lowpass'); }
  whistle() { if (!this.ready) return; this.voice(1320, 0, 0.05, 0.5, 'sine', 0.06); this.voice(1980, 0.02, 0.025, 0.45, 'sine', 0.06); this.voice(1480, 0.5, 0.035, 0.3, 'sine', 0.03); this.noiseBurst(0.7, 3800, 1.5, 0.02, 'bandpass', 0, 0.3); }
  cuckoo() { if (!this.ready) return; this.tock(); for (const w of [0.25, 0.6]) { this.voice(880, w, 0.08, 0.22, 'sine', 0.02); this.voice(698, w + 0.2, 0.07, 0.25, 'sine', 0.02); } }
  ting() { if (!this.ready) return; this.bell(1568, 0, 0.07, 1.2); this.creak(); }
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
  /** 12.2 workshop tools: a metal clank, a ratchet click, a saw rasp and a soft brush swish (built from the same voices). */
  clank() { if (!this.ready) return; this.bell(740, 0, 0.09, 0.4); this.voice(180, 0, 0.1, 0.12, 'square'); this.noiseBurst(0.06, 3200, 3, 0.05, 'highpass'); }
  ratchet() { if (!this.ready) return; for (let i = 0; i < 3; i++) { this.voice(1400 + i * 120, i * 0.05, 0.035, 0.04, 'square'); this.noiseBurst(0.03, 2600, 3, 0.03, 'bandpass', i * 0.05); } }
  saw() { if (!this.ready) return; this.noiseBurst(0.22, 1800, 1.5, 0.07, 'bandpass', 0, 0.35); this.noiseBurst(0.22, 2400, 1.5, 0.05, 'bandpass', 0.24, 2.8); }
  swish() { if (!this.ready) return; this.noiseBurst(0.3, 1600, 0.8, 0.04, 'bandpass', 0, 0.5); this.plip(); }
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

  /** A tiny "hee-hee-hee" for jack-o'-lanterns and peekaboo ghosts. */
  giggle() {
    if (!this.ready) return;
    const base = 740 + Math.random() * 120;
    [1, 1.12, 1.26, 1.19].forEach((m, i) => { this.voice(base * m, i * 0.085, 0.045, 0.09, 'triangle', 0.01); this.voice(base * m * 2, i * 0.085, 0.012, 0.07, 'sine', 0.01); });
  }

  /** 9.38: a happy little sound for each mount when you pet it in the stable. */
  mountHappy(id: string) {
    if (!this.ready) return;
    const v = (f: number, w: number, vol: number, d: number, ty: OscillatorType = 'triangle') => this.voice(f, w, vol, d, ty, 0.01);
    switch (id) {
      case 'eagle': this.chirp(); break;
      case 'pterodactyl': [330, 392, 494].forEach((f, i) => v(f, i * 0.1, 0.07, 0.16, 'sawtooth')); break;
      case 'cloud_puppy': [880, 988].forEach((f, i) => v(f, i * 0.16, 0.08, 0.12)); break;
      case 'unicorn': [1318.5, 1568, 2093].forEach((f, i) => this.bell(f, i * 0.07, 0.07, 1.2)); break;
      case 'bumblebee': for (let i = 0; i < 6; i++) v(220 + (i % 2) * 18, i * 0.05, 0.05, 0.07, 'sawtooth'); break;
      case 'snail': [523, 659, 784].forEach((f, i) => v(f, i * 0.14, 0.06, 0.2, 'sine')); break;
      case 'teacup': [2093, 2637].forEach((f, i) => this.bell(f, i * 0.12, 0.06, 1)); break;
      case 'airplane': for (let i = 0; i < 8; i++) v(140 + i * 22, i * 0.04, 0.05, 0.06, 'square'); break;
      case 'pumpkin': this.giggle(); break;
      case 'goose': this.quack(); break;
      case 'reindeer': [2349, 2637, 2349, 2637].forEach((f, i) => this.bell(f, i * 0.08, 0.05, 0.5)); break;
      case 'snowy_owl': [392, 330].forEach((f, i) => v(f, i * 0.28, 0.08, 0.24, 'sine')); break;
      case 'flamingo': [523, 659, 523].forEach((f, i) => v(f, i * 0.09, 0.06, 0.1, 'square')); break;
      default: this.sparkle();
    }
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
