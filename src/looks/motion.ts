// 48 (Walker, Nov 2): the Motion Lab's seven whole-body motion styles, ported for the live game.
// Each style is a root pose (512-unit lab space; the mount scales it down), a wingbeat rule, a cape
// ripple rate and a stream of sound-sync events (beats, chords, gusts, thunder) on the motion clock, so
// the paired soundscape (motionAudio.ts) lands on the same beats the mount moves to. Ported from the
// stylelab branch (src/stylelab/motion.ts @ dc1a656); the lab-only layers (eyes, hat, beats) stay there.
import type { MotionEvent } from './motionAudio';

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, v: number) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const frac = (v: number) => v - Math.floor(v);
const backOut = (x: number, s = 1.9) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;
const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

export type Pose = { x: number; y: number; r: number; sx: number; sy: number; fy?: number };
const P0 = (): Pose => ({ x: 0, y: 0, r: 0, sx: 1, sy: 1 });

type Ease = 'soft' | 'snappy' | 'springy';
export type MCtx = { t: number; ph: number; vy: number; i: number; g: number; fl: number };
type Flap = { hz: number; glide: number; lock?: number };
export type MotionStyle = {
  id: string; name: string; blurb: string;
  root: (c: MCtx) => Pose;          // root pose target (512 units / radians)
  inertia?: number;                // root itself follows the target through a spring (rad/s)
  flap: (c: MCtx) => Flap;          // eagle wingbeat
  cape: number;                    // cape ripple Hz at rest
  breathe: [number, number];       // amplitude, Hz
  follow: [number, number];        // secondary spring: natural freq (rad/s), damping ratio
  bank: number;                    // tilt per unit/s of velocity
  beats: [number, number];         // seconds between personality beats
  ease: Ease;
  amp?: number;                    // secondary-motion (limbs, hat, tail) amplitude
  alert?: boolean;                 // darting glances
  extra?: string[][];              // extra beat kinds per mount
  events: (t0: number, t1: number) => MotionEvent[]; // sound sync events in (t0, t1], sim time
};

const hop = (u: number) => 4 * u * (1 - u);
/** Grid events every `dt` seconds of sim time; n is the grid index (0 at t = 0). */
const grid = (dt: number, k = 'beat') => (t0: number, t1: number) => {
  const out: MotionEvent[] = [];
  for (let n = Math.floor(t0 / dt + 1e-6) + 1; n * dt <= t1 + 1e-9; n++) if (n * dt > t0) out.push({ t: n * dt, k, n });
  return out;
};
const both = (...fs: ((a: number, b: number) => MotionEvent[])[]) => (a: number, b: number) => fs.flatMap((f) => f(a, b)).sort((x, y) => x.t - y.t);

// Deterministic weather for the physics (gusts) and storm (gusts + thunder) styles: the motion and the sound
// read the same timeline, so the wind you hear is the wind that pushes, and the flinch lands on the thunder.
type Weather = { th: { tf: number; ts: number; s: number }[]; gu: { t: number; d: number; s: number }[] };
function makeWeather(seed: number, thunder: boolean, calmGaps: number): Weather {
  const r = rnd(seed), th: Weather['th'] = [], gu: Weather['gu'] = [];
  for (let t = 2.2, k = 0; thunder && t < 1200; k++) { const s = k === 0 || r() < 0.55 ? 1 : 0.45 + r() * 0.2; th.push({ tf: t, ts: t + (s > 0.7 ? 0.18 : 0.9), s }); t += 5 + r() * 5; }
  for (let t = 1, k = 0; t < 1200; k++) { const d = 2.4 + r() * 2.2; gu.push({ t, d, s: 0.55 + r() * 0.45 }); t += d + calmGaps + r() * 4; }
  return { th, gu };
}
const WX: Record<string, Weather> = { physics: makeWeather(777, false, 2.5), storm: makeWeather(4242, true, 0.8) };
const gustAt = (w: Weather, t: number) => { for (const g of w.gu) { if (g.t > t) break; const u = (t - g.t) / g.d; if (u < 1) return g.s * Math.sin(Math.PI * u) ** 2; } return 0; };
const flinchAt = (w: Weather, t: number) => {
  let v = 0; for (const h of w.th) { if (h.ts > t) break; const u = t - h.ts; if (u < 3) v = Math.max(v, h.s * Math.min(1, u / 0.05) * Math.exp(-u * 2.6)); }
  return v;
};
const flashAt = (w: Weather, t: number) => {
  let v = 0; for (const h of w.th) { if (h.tf > t) break; const u = t - h.tf; if (u < 1) v = Math.max(v, h.s * (Math.exp(-u * 16) + (u > 0.12 ? 0.7 * Math.exp(-(u - 0.12) * 11) : 0))); }
  return Math.min(1, v);
};
const wxEvents = (w: Weather) => (t0: number, t1: number) => {
  const out: MotionEvent[] = [];
  for (const g of w.gu) { if (g.t > t1) break; if (g.t > t0) out.push({ t: g.t, k: 'gust', d: g.d, s: g.s }); }
  for (const h of w.th) { if (h.ts > t1) break; if (h.ts > t0) out.push({ t: h.ts, k: 'thunder', s: h.s }); }
  return out;
};

export const MOTIONS: MotionStyle[] = [
  {
    id: 'gentle', name: 'Gentle Float', blurb: 'Big, slow, peaceful swells: a long rise-and-fall bob with lazy sway; the eagle glides down every swell.',
    root: ({ t, ph }) => {
      const b = TAU * t / 4 + ph;
      return { x: Math.sin(TAU * t / 8 + ph) * 12, y: Math.sin(b) * 14, r: Math.sin(TAU * t / 8 + ph + 1) * 0.075, sx: 1 - 0.015 * Math.cos(b), sy: 1 + 0.02 * Math.cos(b) };
    },
    flap: ({ t, ph }) => ({ hz: 0.8, glide: smooth(-0.2, 0.6, Math.cos(TAU * t / 4 + ph)) }),
    cape: 0.38, breathe: [0.03, 0.25], follow: [3.6, 0.5], bank: 0.003, beats: [4, 7], ease: 'soft', amp: 1.1,
    events: grid(8, 'chord'),
  },
  {
    id: 'springy', name: 'Springy Squash & Stretch', blurb: 'Boing! Deep squash on every landing, long stretch on the launch; the two mounts bounce in call-and-response, on the beat.',
    root: ({ t, i }) => {
      const u = frac(t + i * 0.5), c = Math.exp(-((Math.min(u, 1 - u) / 0.06) ** 2)), st = Math.abs(1 - 2 * u) * (1 - c);
      return { x: Math.sin(TAU * t / 8 + i) * 8, y: 16 - 46 * hop(u), r: Math.sin(TAU * u) * 0.06, sx: 1 + 0.24 * c - 0.09 * st, sy: 1 - 0.22 * c + 0.14 * st };
    },
    flap: ({ t, i }) => ({ hz: 1, glide: 0, lock: TAU * frac(t + i * 0.5) }),
    cape: 0.9, breathe: [0.015, 0.3], follow: [9, 0.2], bank: 0.002, beats: [4, 6.5], ease: 'springy', amp: 1.4,
    events: grid(0.25),
  },
  {
    id: 'dreamy', name: 'Floaty Dreamy Drift', blurb: 'Wide, slow figure-8 loops, banking deep into every turn; long soaring glides and a streaming cape.',
    root: ({ t, ph }) => { const w = TAU / 12; return { x: Math.sin(w * t + ph) * 40, y: Math.sin(2 * w * t + 2 * ph) * 18 + Math.sin(0.6 * t) * 3, r: 0, sx: 1, sy: 1 }; },
    flap: ({ t, ph }) => ({ hz: 0.5, glide: 0.6 + 0.4 * smooth(-0.3, 0.3, Math.sin((TAU / 12) * t + ph)) }),
    cape: 0.28, breathe: [0.022, 0.2], follow: [2.2, 0.8], bank: 0.011, beats: [5, 9], ease: 'soft', amp: 1.2,
    events: both(grid(6, 'chord'), grid(0.75)),
  },
  {
    id: 'snappy', name: 'Snappy Cartoon', blurb: 'Pose-to-pose on a ticking clock: wind-up, POP with overshoot, crisp hold. Big leaning poses, every snap on the beat.',
    root: ({ t, i }) => {
      const K = [[-20, 4, -0.13], [18, -18, 0.14], [0, -5, -0.05], [-12, -20, 0.11]];
      const s = t + i * 0.5, k = Math.floor(s), u = frac(s);
      const A = K[((k % 4) + 4) % 4], B = K[(((k + 1) % 4) + 4) % 4];
      const v = clamp((u - 0.125) / 0.2, 0, 1), ant = u < 0.125 ? Math.sin((Math.PI / 2) * (u / 0.125)) : 1 - v;
      const p = u < 0.125 ? -0.18 * ant : backOut(v, 2.4) * 1.18 - 0.18;
      const at = (j: number) => A[j] + (B[j] - A[j]) * p;
      const str = Math.sin(Math.PI * v) * (v < 1 ? 1 : 0);
      return { x: at(0), y: at(1) + 6 * ant, r: at(2), sx: 1 + 0.12 * ant - 0.07 * str, sy: 1 - 0.14 * ant + 0.13 * str };
    },
    flap: ({ t, i }) => { const u = frac(t + i * 0.5); return { hz: 2.4, glide: u > 0.1 && u < 0.4 ? 0 : 0.85 }; },
    cape: 0.6, breathe: [0.016, 0.33], follow: [11, 0.3], bank: 0.002, beats: [3.5, 6], ease: 'snappy', amp: 1.3,
    events: grid(0.125),
  },
  {
    id: 'physics', name: 'Natural Physics', blurb: 'Drifts on the breeze with real inertia; wind gusts shove both mounts back, the cape whips and everything settles on springs.',
    root: ({ t, ph, g }) => ({
      x: 22 * (Math.sin(0.31 * t + ph) * 0.6 + Math.sin(0.73 * t + 1.3 * ph) * 0.4) - 30 * g,
      y: 16 * (Math.sin(0.47 * t + ph) * 0.6 + Math.sin(1.13 * t + 2 + ph) * 0.4) - 8 * g, r: -0.1 * g, sx: 1, sy: 1,
    }),
    inertia: 1.6,
    flap: ({ vy, g }) => ({ hz: 0.7 + clamp(-vy * 0.05, 0, 1) + g * 0.8, glide: smooth(1.5, 6, vy) * (1 - g) }),
    cape: 0.4, breathe: [0.018, 0.25], follow: [3.8, 0.3], bank: 0.005, beats: [5, 8], ease: 'soft', amp: 1.2,
    events: wxEvents(WX.physics),
  },
  {
    id: 'playful', name: 'Playful Bounce', blurb: 'Hop, hop, BIG hop! Bouncy landings in a parade rhythm, with the odd celebratory spin or barrel roll.',
    root: ({ t, i }) => {
      const u = frac(t / 2 + i * 0.5);
      const [a, b, h] = u < 0.25 ? [0, 0.25, 16] : u < 0.5 ? [0.25, 0.5, 16] : [0.5, 1, 50];
      const v = (u - a) / (b - a), land = Math.exp(-((Math.min(v, 1 - v) / 0.07) ** 2)), big = h > 20;
      return { x: Math.sin(TAU * t / 4 + i) * 10, y: 10 - h * hop(v), r: Math.sin(TAU * 2 * u) * 0.07 - (big ? 0.12 * Math.sin(TAU * v) : 0), sx: 1 + 0.17 * land, sy: 1 - 0.18 * land + (big ? 0.08 * Math.sin(Math.PI * v) : 0) };
    },
    flap: ({ t, i }) => { const u = frac(t / 2 + i * 0.5); const [a, b] = u < 0.25 ? [0, 0.25] : u < 0.5 ? [0.25, 0.5] : [0.5, 1]; return { hz: 1.5, glide: 0, lock: TAU * ((u - a) / (b - a)) }; },
    cape: 0.8, breathe: [0.016, 0.32], follow: [6, 0.25], bank: 0.003, beats: [3.5, 5.5], ease: 'springy', amp: 1.5, extra: [['spin'], ['roll']],
    events: grid(0.25),
  },
  {
    id: 'storm', name: 'Storm Jitters', blurb: 'Jumpy and on high alert: a tense little tremble, darting glances, buffeted by gusts, and a big startled flinch at every thunderclap.',
    root: ({ t, ph, g, fl }) => {
      const tr = (Math.sin(t * 21 + ph) * 0.6 + Math.sin(t * 33 + 2 * ph) * 0.4) * 1.6 * (0.6 + g);
      return {
        x: Math.sin(TAU * t / 3.1 + ph) * 7 + tr - 18 * g - 10 * fl, y: Math.sin(TAU * t / 2.3 + ph) * 7 + Math.sin(t * 27 + ph) * 0.9 - 30 * fl,
        r: -0.08 * g - 0.14 * fl + Math.sin(t * 19 + ph) * 0.012, sx: 1.03 - 0.1 * fl, sy: 0.97 + 0.14 * fl,
      };
    },
    flap: ({ g, fl }) => ({ hz: 1.5 + g * 1.2 + fl * 2, glide: 0 }),
    cape: 0.8, breathe: [0.02, 0.6], follow: [7, 0.35], bank: 0.003, beats: [2.5, 4.5], ease: 'snappy', amp: 1, alert: true,
    events: wxEvents(WX.storm),
  },
];

// mulberry32: well-mixed PRNG (the old LCG's consecutive draws were correlated -> repeating beat pairs)
function rnd(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const motionById = (id: string) => MOTIONS.find((m) => m.id === id) ?? MOTIONS[0];

/**
 * One mount's motion simulation (the lab Mover, root + wings + cape only). `calm` is the reduced-motion
 * fallback: smaller swings and no phase-locked hops. Step it with the shared motion clock so the
 * sound events (ms.events on the same clock) stay in sync with what the mount does.
 */
export class MotionSim {
  t = 0;
  root = P0(); rv = [0, 0, 0]; prev = [0, 0, 0]; vel = [0, 0, 0];
  wing = 0; capePh = 0; glide = 0; g = 0; fl = 0;
  wx?: Weather;
  constructor(public ms: MotionStyle, public i = 0, public calm = false) {
    this.wx = WX[ms.id];
    const p = ms.root(this.ctx());
    this.root = { ...p }; this.prev = [p.x, p.y, p.r];
  }
  ctx(): MCtx {
    const w = this.wx, t = this.t;
    return { t, ph: this.i * 1.9, vy: this.vel[1], i: this.i, g: w ? gustAt(w, t - this.i * 0.25) : 0, fl: w ? flinchAt(w, t - this.i * 0.07) : 0 };
  }
  /** Lightning flash strength right now (storm only), 0..1. */
  flash() { return this.wx && this.wx.th.length ? flashAt(this.wx, this.t) : 0; }
  /** Advance to absolute motion-clock time `t` (seconds). */
  stepTo(t: number) {
    const dt = Math.max(0, Math.min(0.1, t - this.t));
    this.t = t;
    if (dt <= 0) return;
    const ms = this.ms, m = this.calm ? 0.35 : 1;
    const cx = this.ctx(); this.g = cx.g; this.fl = cx.fl;
    const tg = ms.root(cx);
    let p: Pose = { x: tg.x * m, y: tg.y * m, r: tg.r * m, sx: 1 + (tg.sx - 1) * m, sy: 1 + (tg.sy - 1) * m };
    if (ms.inertia) {
      const w = ms.inertia, z = 0.6, cur = this.root;
      const k = [p.x, p.y, p.r], c = [cur.x, cur.y, cur.r];
      for (let j = 0; j < 3; j++) { this.rv[j] += (w * w * (k[j] - c[j]) - 2 * z * w * this.rv[j]) * dt; c[j] += this.rv[j] * dt; }
      p = { ...p, x: c[0], y: c[1], r: c[2] };
    }
    this.root = p;
    for (let j = 0; j < 3; j++) { const v = ([p.x, p.y, p.r][j] - this.prev[j]) / dt; this.vel[j] = lerp(this.vel[j], v, 0.15); }
    this.prev = [p.x, p.y, p.r];
    const f = ms.flap(this.ctx());
    const power = this.fl * 0.9;
    const hz = (this.calm ? 0.75 : 1) * f.hz * (1 + power);
    const gl = this.calm ? Math.max(f.glide, 0.35) : f.glide;
    this.glide = lerp(this.glide, power > 0.05 ? 0 : gl, 1 - Math.exp(-dt * 3));
    if (f.lock !== undefined && !this.calm && power < 0.05) {
      const d = ((f.lock - this.wing) % TAU + TAU * 1.5) % TAU - Math.PI;
      this.wing += clamp(d, -hz * TAU * dt * 2.5, hz * TAU * dt * 2.5);
    } else this.wing += hz * TAU * dt * (1 - 0.85 * this.glide);
    const speed = Math.hypot(this.vel[0], this.vel[1]);
    this.capePh += TAU * dt * (ms.cape * (this.calm ? 0.7 : 1) + clamp(speed * 0.012, 0, 0.6) + this.g * 1.4 + this.fl * 1.5);
  }
  /** Final root pose with banking (lab units / radians). */
  pose(): Pose {
    const R = { ...this.root };
    R.r += clamp((this.vel[0] + this.vel[1]) * this.ms.bank, -0.26, 0.26);
    return R;
  }
}
