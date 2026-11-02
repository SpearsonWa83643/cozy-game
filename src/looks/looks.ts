// 47-49 (Walker, Nov 2): "Looks & Moves" — the in-game art style picker, the motion + soundscape
// picker, and the weather auto-match. One small controller shared by the stable's picker (Menu)
// and the flying mount (Mount.draw): it owns the saved choices, the motion simulation clock and the
// paired soundscape, so the mount moves and the music lands on the same beats.
import { sfx } from '../audio';
import type { WeatherKind } from '../village/weather';
import { MOTIONS, MotionSim, motionById, type MotionStyle } from './motion';
import { MotionAudio, SCAPE_NAMES } from './motionAudio';
import { LAB_STYLES } from './styles';
import { fxStats, type ArtStyleId } from './styleFx';

export type MotionId = 'gentle' | 'springy' | 'dreamy' | 'snappy' | 'physics' | 'playful' | 'storm';
export type MotionChoice = 'auto' | MotionId;
export type Weatherish = WeatherKind | 'clear';

/**
 * 49: which motion (and its soundscape) the weather picks while "Auto (weather)" is chosen.
 *   clear      -> gentle   "Gentle Float"        + Meadow Lullaby  (no weather: the calm default)
 *   rain       -> storm    "Storm Jitters"       + Thunderstorm    (Spring rain: jumpy, thunder flinches)
 *   sunshower  -> playful  "Playful Bounce"      + Hop Parade      (Summer sun-shower: happy hops)
 *   wind       -> physics  "Natural Physics"     + Open Sky        (Fall wind: gusts shove you, real inertia)
 *   mist       -> dreamy   "Floaty Dreamy Drift" + Starlit Pond    (Halloween mist: slow, floaty)
 *   snow       -> dreamy   "Floaty Dreamy Drift" + Starlit Pond    (Christmas/Winter snow: soft, drifting)
 * Springy and Snappy are only used when picked by hand.
 */
export const WEATHER_MOTION: Record<Weatherish, MotionId> = {
  clear: 'gentle', rain: 'storm', sunshower: 'playful', wind: 'physics', mist: 'dreamy', snow: 'dreamy',
};
export const WEATHER_NAMES: Record<Weatherish, string> = {
  clear: 'Clear skies', rain: 'Rain', sunshower: 'Sun shower', wind: 'Windy', mist: 'Misty', snow: 'Snow',
};

/** 47: the art styles in picker order: the game's own art first, then the Style Lab's six. */
export const ART_STYLES: { id: ArtStyleId; name: string; blurb: string }[] = [
  { id: 'classic', name: 'Classic Glade', blurb: 'The friends just as they were painted for Willowmere Glade.' },
  ...LAB_STYLES.map((s) => ({ id: (s.id === 'wc' ? 'watercolor' : s.id) as ArtStyleId, name: s.name, blurb: s.blurb })),
];
/** 48: the motion picker's entries: Auto first, then the Motion Lab's seven. */
export const MOTION_CHOICES: MotionChoice[] = ['auto', ...(MOTIONS.map((m) => m.id) as MotionId[])];
export const scapeName = (id: string) => (SCAPE_NAMES[id] ?? '').replace(' (nature only)', '');

const KEY = 'cozy.looks.v1';
type Saved = { art: ArtStyleId; motion: MotionChoice };
function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Saved>;
    return {
      art: ART_STYLES.some((a) => a.id === s.art) ? s.art! : 'classic',
      motion: MOTION_CHOICES.includes(s.motion as MotionChoice) ? (s.motion as MotionChoice) : 'auto',
    };
  } catch { return { art: 'classic', motion: 'auto' }; }
}

type Listener = () => void;

class Looks {
  art: ArtStyleId;
  motion: MotionChoice;
  /** What the main game loop's weather is right now (World feeds this every frame). */
  weather: Weatherish = 'clear';
  /** Flying (ride / travel) right now, and the stable picker open: either plays the soundscape. */
  flying = false; previewing = false;
  sim: MotionSim;
  private simId: MotionId;
  private t0 = performance.now();
  private lastNow = -1;
  private evT = 0;
  private wasAudible = false;
  audio = new MotionAudio();
  private listeners: Listener[] = [];
  /** Test counters. */
  stats = { switches: 0, events: 0, weatherSwitches: 0 };

  constructor() {
    const s = load();
    this.art = s.art; this.motion = s.motion;
    this.simId = this.effective;
    this.sim = new MotionSim(motionById(this.simId));
  }

  /** The motion actually in use: the weather's pick under Auto, else the hand pick. */
  get effective(): MotionId { return this.motion === 'auto' ? WEATHER_MOTION[this.weather] : this.motion; }
  get style(): MotionStyle { return this.sim.ms; }
  on(f: Listener) { this.listeners.push(f); return () => { this.listeners = this.listeners.filter((g) => g !== f); }; }
  private emit() { for (const f of this.listeners) f(); }
  private persist() { try { localStorage.setItem(KEY, JSON.stringify({ art: this.art, motion: this.motion })); } catch { /* private mode */ } }

  setArt(id: ArtStyleId) { if (id === this.art) return; this.art = id; this.persist(); this.emit(); }
  setMotion(m: MotionChoice) { if (m === this.motion) return; this.motion = m; this.persist(); this.sync(); this.emit(); }
  cycleArt(dir: number) { const i = ART_STYLES.findIndex((a) => a.id === this.art); this.setArt(ART_STYLES[(i + dir + ART_STYLES.length) % ART_STYLES.length].id); }
  cycleMotion(dir: number) { const i = MOTION_CHOICES.indexOf(this.motion); this.setMotion(MOTION_CHOICES[(i + dir + MOTION_CHOICES.length) % MOTION_CHOICES.length]); }

  /** Fed by the World every frame. Under Auto a weather change crossfades to its motion. */
  setWeather(k: Weatherish) {
    if (k === this.weather) return;
    this.weather = k;
    if (this.motion === 'auto') { this.stats.weatherSwitches++; this.sync(); this.emit(); }
  }

  /** Swap the simulation to the effective motion (keeps the clock, so the beat carries on). */
  private sync() {
    const id = this.effective;
    if (id === this.simId) return;
    this.simId = id; this.stats.switches++;
    const t = this.sim.t;
    this.sim = new MotionSim(motionById(id));
    this.sim.t = t; this.evT = t;
    if (this.wasAudible) this.audio.play(id, 1.6);
  }

  /**
   * Advance the motion clock to now and drive the soundscape. Safe to call from several places in
   * one frame (only the first call per timestamp does work).
   */
  frame(now = performance.now()) {
    if (now === this.lastNow) return this.sim;
    this.lastNow = now;
    const active = this.flying || this.previewing;
    const t = (now - this.t0) / 1000;
    if (!active) { this.sim.t = t; this.evT = t; }
    else this.sim.stepTo(t);
    this.sound(active);
    return this.sim;
  }

  private sound(audible: boolean) {
    const ctx = sfx.audioCtx, bus = sfx.masterBus;
    if (audible && ctx && bus) {
      this.audio.attach(ctx, bus);
      if (!this.wasAudible) { this.wasAudible = true; this.evT = this.sim.t; this.audio.play(this.simId, 1.6); sfx.duckMusic(0); }
      if (this.audio.playing !== this.simId) this.audio.play(this.simId, 1.6);
      if (ctx.state === 'running') {
        // Schedule the sound-sync events (beats, chords, gusts, thunder) 0.3 s ahead on the sim clock.
        const ahead = this.sim.t + 0.3, base = ctx.currentTime - this.sim.t - this.audio.latency;
        if (ahead - this.evT > 1) this.evT = this.sim.t; // came back from a hidden tab: don't burst
        if (ahead > this.evT) {
          for (const e of this.sim.ms.events(this.evT, ahead)) { this.audio.ev(e, base + e.t); this.stats.events++; }
          this.evT = ahead;
        }
      }
    } else if (!audible && this.wasAudible) {
      this.wasAudible = false; this.audio.stop(1.8); sfx.duckMusic(1);
    }
  }

  /** Test/debug snapshot. */
  snapshot() {
    return {
      art: this.art, motion: this.motion, effective: this.effective, weather: this.weather,
      scape: scapeName(this.effective), playing: this.audio.playing, flying: this.flying, previewing: this.previewing,
      simT: +this.sim.t.toFixed(2), ...this.stats, fx: { ...fxStats }, saved: localStorage.getItem(KEY),
    };
  }
}

export const looks = new Looks();
