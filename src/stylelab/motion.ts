// Mount Motion Lab (temporary, ?motionlab=1): the Cowboy Cookie and the Bald Eagle side by side in one
// skin, flipping between whole-body animation styles. Every layer is alive: breathing, blinks, glances,
// head tilts, hat lag, cape follow-through + ripple, tail/talon sway, banking, personality beats and a
// rider-weight dip, all on offset timings and spring-damper secondary motion. 60fps: sprites are
// rendered once per skin (rig.ts) and only composited per frame.
import '../style.css';
import { LAB_CSS } from './lab';
import { LAB_STYLES } from './styles';
import { RIGS, rigJobs, type LayerSprites } from './rig';
import { TAU } from './geo';

const DPR = Math.min(2, window.devicePixelRatio || 1);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, v: number) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const frac = (v: number) => v - Math.floor(v);
const backOut = (x: number, s = 1.9) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;
const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

// ---------------------------------------------------------------- tiny 2D affine (canvas order a b c d e f)
type M = [number, number, number, number, number, number];
const mul = (m: M, n: M): M => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const T = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const Rz = (r: number): M => { const c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
const S = (x: number, y: number): M => [x, 0, 0, y, 0, 0];
const chain = (...ms: M[]) => ms.reduce(mul);

type Pose = { x: number; y: number; r: number; sx: number; sy: number; fy?: number };
const P0 = (): Pose => ({ x: 0, y: 0, r: 0, sx: 1, sy: 1 });

// ---------------------------------------------------------------- motion styles
type Ease = 'soft' | 'snappy' | 'springy';
type Ctx = { t: number; ph: number; vy: number; i: number };
type Flap = { hz: number; glide: number; lock?: number };
type MotionStyle = {
  id: string; name: string; blurb: string;
  root: (c: Ctx) => Pose;          // root pose target (512 units / radians)
  inertia?: number;                // root itself follows the target through a spring (rad/s)
  flap: (c: Ctx) => Flap;          // eagle wingbeat
  cape: number;                    // cape ripple Hz at rest
  breathe: [number, number];       // amplitude, Hz
  follow: [number, number];        // secondary spring: natural freq (rad/s), damping ratio
  bank: number;                    // tilt per unit/s of velocity
  beats: [number, number];         // seconds between personality beats
  ease: Ease;
  extra?: string[][];              // extra beat kinds per mount
};

const hop = (u: number) => 4 * u * (1 - u);
const MOTIONS: MotionStyle[] = [
  {
    id: 'gentle', name: 'Gentle Float', blurb: 'Soft sine bob and slow breathing; the eagle glides between lazy wingbeats.',
    root: ({ t, ph }) => ({ x: Math.sin(0.5 * t + ph) * 4, y: Math.sin(TAU * 0.3 * t + ph) * 7, r: Math.sin(TAU * 0.19 * t + ph) * 0.03, sx: 1, sy: 1 }),
    flap: ({ t, ph }) => ({ hz: 0.85, glide: smooth(0.35, 0.8, Math.sin(0.23 * t + ph)) }),
    cape: 0.45, breathe: [0.02, 0.27], follow: [5, 0.55], bank: 0.002, beats: [4, 7], ease: 'soft',
  },
  {
    id: 'springy', name: 'Springy Squash & Stretch', blurb: 'Bounces on an invisible cushion: squash on contact, stretch on the rise, wobbly hat.',
    root: ({ t, ph }) => {
      const u = frac(t / 1.5 + ph / TAU), c = Math.exp(-((Math.min(u, 1 - u) / 0.07) ** 2)), st = Math.abs(1 - 2 * u) * (1 - c);
      return { x: Math.sin(0.4 * t + ph) * 5, y: 9 - 20 * hop(u), r: Math.sin(TAU * u) * 0.03, sx: 1 + 0.13 * c - 0.05 * st, sy: 1 - 0.13 * c + 0.07 * st };
    },
    flap: ({ t, ph }) => ({ hz: 1 / 1.5, glide: 0, lock: TAU * frac(t / 1.5 + ph / TAU) }),
    cape: 0.7, breathe: [0.015, 0.3], follow: [8, 0.28], bank: 0.002, beats: [4, 6.5], ease: 'springy',
  },
  {
    id: 'dreamy', name: 'Floaty Dreamy Drift', blurb: 'A slow figure-8 glide that banks into each turn; long soaring glides, cape streaming.',
    root: ({ t, ph }) => { const w = TAU / 10; return { x: Math.sin(w * t + ph) * 24, y: Math.sin(2 * w * t + 2 * ph) * 11 + Math.sin(0.6 * t) * 2, r: 0, sx: 1, sy: 1 }; },
    flap: ({ t, ph }) => ({ hz: 0.55, glide: 0.55 + 0.45 * smooth(-0.3, 0.3, Math.sin((TAU / 10) * t + ph)) }),
    cape: 0.32, breathe: [0.022, 0.2], follow: [2.8, 0.75], bank: 0.006, beats: [5, 9], ease: 'soft',
  },
  {
    id: 'snappy', name: 'Snappy Cartoon', blurb: 'Pose-to-pose: anticipation dip, quick pop with overshoot, then a crisp hold.',
    root: ({ t, ph }) => {
      const K = [[-9, 2, -0.06], [8, -9, 0.07], [0, -2, -0.02], [-4, -10, 0.05]];
      const s = t / 2 + ph / TAU, k = Math.floor(s), u = frac(s);
      const A = K[((k % 4) + 4) % 4], B = K[(((k + 1) % 4) + 4) % 4];
      const v = clamp((u - 0.14) / 0.22, 0, 1), ant = u < 0.14 ? Math.sin((Math.PI / 2) * (u / 0.14)) : 1 - v;
      const p = u < 0.14 ? -0.14 * ant : backOut(v) * 1.14 - 0.14;
      const at = (j: number) => A[j] + (B[j] - A[j]) * p;
      const str = Math.sin(Math.PI * v) * (v < 1 ? 1 : 0);
      return { x: at(0), y: at(1) + 3 * ant, r: at(2), sx: 1 + 0.06 * ant - 0.04 * str, sy: 1 - 0.08 * ant + 0.07 * str };
    },
    flap: ({ t, ph }) => { const u = frac(t / 2 + ph / TAU); return { hz: 1.7, glide: u > 0.15 && u < 0.5 ? 0 : 0.8 }; },
    cape: 0.6, breathe: [0.016, 0.33], follow: [10, 0.32], bank: 0.002, beats: [3.5, 6], ease: 'snappy',
  },
  {
    id: 'physics', name: 'Natural Physics', blurb: 'Wanders with real inertia; every part lags and settles on spring-dampers. Flaps to climb, glides to sink.',
    root: ({ t, ph }) => ({
      x: 14 * (Math.sin(0.31 * t + ph) * 0.6 + Math.sin(0.73 * t + 1.3 * ph) * 0.4),
      y: 11 * (Math.sin(0.47 * t + ph) * 0.6 + Math.sin(1.13 * t + 2 + ph) * 0.4), r: 0, sx: 1, sy: 1,
    }),
    inertia: 1.8,
    flap: ({ vy }) => ({ hz: 0.7 + clamp(-vy * 0.05, 0, 0.9), glide: smooth(1.5, 6, vy) }),
    cape: 0.4, breathe: [0.018, 0.25], follow: [4.2, 0.35], bank: 0.004, beats: [5, 8], ease: 'soft',
  },
  {
    id: 'playful', name: 'Playful Bounce', blurb: 'Hop, hop, BIG hop, with wobbles and the odd celebratory spin or barrel roll.',
    root: ({ t, ph }) => {
      const u = frac(t / 2.4 + ph / TAU);
      const [a, b, h] = u < 0.3 ? [0, 0.3, 8] : u < 0.6 ? [0.3, 0.6, 8] : [0.6, 1, 18];
      const v = (u - a) / (b - a), land = Math.exp(-((Math.min(v, 1 - v) / 0.08) ** 2));
      return { x: Math.sin(0.9 * t + ph) * 6, y: 6 - h * hop(v), r: Math.sin(TAU * 2 * u) * 0.05, sx: 1 + 0.08 * land, sy: 1 - 0.09 * land };
    },
    flap: ({ t, ph }) => { const u = frac(t / 2.4 + ph / TAU); const [a, b] = u < 0.3 ? [0, 0.3] : u < 0.6 ? [0.3, 0.6] : [0.6, 1]; return { hz: 1.2, glide: 0, lock: TAU * ((u - a) / (b - a)) }; },
    cape: 0.8, breathe: [0.016, 0.32], follow: [6, 0.3], bank: 0.003, beats: [3.5, 5.5], ease: 'springy', extra: [['spin'], ['roll']],
  },
];

const BEATS = [['look', 'hatTip', 'wiggle', 'wave', 'dip'], ['tilt', 'look', 'power', 'tailFan', 'shake', 'dip']];
const BEAT_LEN: Record<string, number> = { look: 2.4, hatTip: 1.7, wiggle: 1.2, wave: 1.7, dip: 1.5, tilt: 2, power: 1.5, tailFan: 1.4, shake: 0.7, spin: 1.3, roll: 1.5 };
const CALM_BEATS = new Set(['look', 'tilt', 'dip', 'wave', 'tailFan']);

function env(u: number, e: Ease) {
  if (u <= 0 || u >= 1) return 0;
  if (e === 'soft') return Math.sin(Math.PI * u) ** 2;
  if (e === 'snappy') return u < 0.18 ? backOut(u / 0.18, 2.2) : u < 0.8 ? 1 : 1 - easeIO((u - 0.8) / 0.2);
  const a = clamp(u / 0.45, 0, 1); // springy: damped overshoot in, smooth out
  return (1 - Math.exp(-5 * a) * Math.cos(9 * a)) * (1 - smooth(0.72, 1, u));
}

// mulberry32: well-mixed PRNG (the old LCG's consecutive draws were correlated -> repeating beat pairs)
function rnd(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- per-mount simulation
class Mover {
  t = 0; r: () => number;
  root = P0(); rv = [0, 0, 0]; prev = [0, 0, 0]; vel = [0, 0, 0];
  f = [0, 0, 0]; fv = [0, 0, 0];               // secondary follower (x, y, r)
  wing = 0; capePh = 0; glide = 0;
  blinkAt = 1.5; blinkT0 = -9; blinks = 1;
  gaze = [0, 0]; gv = [0, 0]; gt = [0, 0]; gazeAt = 1;
  beat: { k: string; t0: number; d: number } | null = null; beatAt: number; bag: string[] = []; lastK = '';
  constructor(public i: number, public ms: MotionStyle, public calm: boolean) {
    this.r = rnd(97 + i * 7919);
    this.beatAt = 1.8 + i * 1.7;
    this.blinkAt = 0.8 + i * 1.3;
    const c0 = this.ctx(); const p = ms.root(c0);
    this.root = { ...p }; this.prev = [p.x, p.y, p.r]; this.f = [p.x, p.y, p.r];
  }
  ctx(): Ctx { return { t: this.t, ph: this.i * 1.9, vy: this.vel[1], i: this.i }; }
  e(k: string) { const b = this.beat; return b && b.k === k ? env((this.t - b.t0) / b.d, this.ms.ease) : 0; }
  bu(k: string) { const b = this.beat; return b && b.k === k ? clamp((this.t - b.t0) / b.d, 0, 1) : -1; }
  step(dt: number) {
    const ms = this.ms, m = this.calm ? 0.35 : 1, t = (this.t += dt);
    // Root target, optionally through an inertial spring, then beats on top.
    const tg = ms.root(this.ctx());
    const sc = (p: Pose): Pose => ({ x: p.x * m, y: p.y * m, r: p.r * m, sx: 1 + (p.sx - 1) * m, sy: 1 + (p.sy - 1) * m });
    let p = sc(tg);
    if (ms.inertia) {
      const w = ms.inertia, z = 0.6, cur = this.root;
      const k = [p.x, p.y, p.r], c = [cur.x, cur.y, cur.r];
      for (let j = 0; j < 3; j++) { this.rv[j] += (w * w * (k[j] - c[j]) - 2 * z * w * this.rv[j]) * dt; c[j] += this.rv[j] * dt; }
      p = { ...p, x: c[0], y: c[1], r: c[2] };
    }
    this.root = p;
    // Velocity (for banking, cape speed and flap effort).
    for (let j = 0; j < 3; j++) { const v = ([p.x, p.y, p.r][j] - this.prev[j]) / dt; this.vel[j] = lerp(this.vel[j], v, 0.15); }
    this.prev = [p.x, p.y, p.r];
    // Secondary follower spring.
    const [w, z] = ms.follow, tgt = [p.x, p.y, p.r];
    for (let j = 0; j < 3; j++) { this.fv[j] += (w * w * (tgt[j] - this.f[j]) - 2 * z * w * this.fv[j]) * dt; this.f[j] += this.fv[j] * dt; }
    // Wings (eagle) and cape (cookie).
    const fl = ms.flap(this.ctx());
    const power = this.e('power');
    const hz = (this.calm ? 0.75 : 1) * fl.hz * (1 + power);
    const gl = this.calm ? Math.max(fl.glide, 0.35) : fl.glide;
    this.glide = lerp(this.glide, power > 0.05 ? 0 : gl, 1 - Math.exp(-dt * 3));
    if (fl.lock !== undefined && !this.calm && power < 0.05) { // phase-locked to the hop rhythm (shortest way round)
      let d = ((fl.lock - this.wing) % TAU + TAU * 1.5) % TAU - Math.PI;
      this.wing += clamp(d, -hz * TAU * dt * 2.5, hz * TAU * dt * 2.5);
    } else this.wing += hz * TAU * dt * (1 - 0.85 * this.glide);
    const speed = Math.hypot(this.vel[0], this.vel[1]);
    this.capePh += TAU * dt * (ms.cape * (this.calm ? 0.7 : 1) + clamp(speed * 0.012, 0, 0.6));
    // Blinks, gaze and personality beats on their own clocks.
    if (t > this.blinkAt) { this.blinkT0 = t; this.blinks = this.r() < 0.15 ? 2 : 1; this.blinkAt = t + 2 + this.r() * 3.5; }
    if (t > this.gazeAt) {
      this.gt = this.r() < 0.5 ? [0, 0] : [this.r() * 2 - 1, this.r() * 0.9 - 0.5];
      this.gazeAt = t + 1.2 + this.r() * 2.4;
    }
    const lk = this.bu('look');
    const gt = lk >= 0 && lk < 0.92 ? [lk < 0.45 ? -1 : 1, -0.2] : this.bu('tilt') >= 0 ? [0.6, -0.5] : this.gt;
    const gw = ms.ease === 'snappy' ? 22 : 15, gz = ms.ease === 'snappy' ? 0.62 : 0.85;
    for (let j = 0; j < 2; j++) { this.gv[j] += (gw * gw * (gt[j] - this.gaze[j]) - 2 * gz * gw * this.gv[j]) * dt; this.gaze[j] += this.gv[j] * dt; }
    if (this.beat && t > this.beat.t0 + this.beat.d) this.beat = null;
    if (!this.beat && t > this.beatAt) {
      let kinds = [...BEATS[this.i], ...(ms.extra?.[this.i] ?? [])];
      if (this.calm) kinds = kinds.filter((k) => CALM_BEATS.has(k));
      // shuffled bag: every beat plays once per cycle, never the same one twice in a row
      this.bag = this.bag.filter((x) => kinds.includes(x));
      if (!this.bag.length) {
        this.bag = [...kinds];
        for (let j = this.bag.length - 1; j > 0; j--) { const q = Math.floor(this.r() * (j + 1)); [this.bag[j], this.bag[q]] = [this.bag[q], this.bag[j]]; }
        if (this.bag.length > 1 && this.bag[this.bag.length - 1] === this.lastK) this.bag.unshift(this.bag.pop()!);
      }
      const k = this.bag.pop()!; this.lastK = k;
      this.beat = { k, t0: t, d: BEAT_LEN[k] * (this.calm ? 1.3 : 1) };
      const [a, b] = ms.beats; this.beatAt = t + BEAT_LEN[k] + a + this.r() * (b - a);
    }
  }
  blink() {
    const u = (this.t - this.blinkT0) / 0.15;
    if (u < 0 || u > this.blinks * 1.6) return 0;
    const v = u % 1.6; return v < 1 ? Math.sin(Math.PI * v) : 0;
  }
  /** Final poses: root plus a local pose per layer id. */
  pose(): { root: Pose; L: Record<string, Pose>; capePh: number } {
    const { t, ms, root, i } = this, m = this.calm ? 0.4 : 1, ph = i * 1.9;
    const lag = [this.f[0] - root.x, this.f[1] - root.y, this.f[2] - root.r];
    const [vx, vy] = this.vel;
    const R: Pose = { ...root };
    R.r += clamp((vx + vy) * ms.bank, -0.22, 0.22);
    const dip = this.e('dip'); R.y += 8 * dip * m; R.sy -= 0.03 * dip;
    const spin = this.bu('spin'); if (spin >= 0) { R.r += TAU * easeIO(spin); R.y -= Math.sin(Math.PI * spin) * 10; }
    const roll = this.bu('roll'); if (roll >= 0) { R.fy = Math.cos(TAU * easeIO(roll)); R.y -= Math.sin(Math.PI * roll) * 12; }
    const pw = this.e('power'); R.y -= 7 * pw;
    const [bA, bHz] = ms.breathe, br = bA * Math.sin(TAU * bHz * t + ph) * (this.calm ? 0.7 : 1);
    const L: Record<string, Pose> = {};
    const body = (L.body = P0()); body.sx = 1 - 0.6 * br; body.sy = 1 + br;
    const blink = this.blink(), [gx, gy] = this.gaze;
    if (i === 0) {
      body.r = Math.sin(t * 16) * 0.07 * this.e('wiggle');
      L.eyes = { x: gx * 5, y: gy * 3, r: 0, sx: 1, sy: 1 - 0.92 * blink };
      const tip = this.e('hatTip');
      L.hat = {
        x: clamp(lag[0] * 0.5, -8, 8) - 4 * tip, y: clamp(lag[1] * 0.6, -12, 3) - 16 * tip,
        r: clamp(lag[0] * 0.006 + lag[2] * 0.7, -0.3, 0.3) + Math.sin(t * 1.9 + ph) * 0.015 * m - 0.32 * tip, sx: 1, sy: 1,
      };
      const speed = Math.hypot(vx, vy);
      L.cape = { x: 0, y: 0, r: clamp(-lag[1] * 0.006 + lag[0] * 0.004 + lag[2] * 0.5, -0.25, 0.25) + Math.sin(t * 0.9 + ph) * 0.03 * m, sx: 1 + clamp(speed * 0.0015, 0, 0.12), sy: 1 };
      const wave = Math.max(this.e('wave'), tip * 0.8);
      L.armF = { x: 0, y: 0, r: Math.sin(t * 1.7 + ph) * 0.1 * m + clamp(lag[1] * 0.004, -0.1, 0.1) + wave * (-0.45 + 0.3 * Math.sin(t * 13)), sx: 1, sy: 1 };
      L.armB = { x: 0, y: 0, r: Math.sin(t * 1.5 + ph + 1) * 0.09 * m - clamp(lag[1] * 0.004, -0.1, 0.1), sx: 1, sy: 1 };
      L.legL = { x: 0, y: 0, r: clamp(lag[0] * 0.012, -0.3, 0.3) + Math.sin(t * 1.25 + ph) * 0.08 * m, sx: 1, sy: 1 };
      L.legR = { x: 0, y: 0, r: clamp(lag[0] * 0.012, -0.3, 0.3) + Math.sin(t * 1.25 + ph + 1.1) * 0.08 * m, sx: 1, sy: 1 };
    } else {
      const g = this.glide, fs = 1 - g;
      R.y += Math.cos(this.wing) * 2.5 * fs * m; // body lifts on each downstroke
      const ws = (off: number) => {
        const s = lerp(Math.cos(this.wing - off), 0.35 + 0.05 * Math.sin(t * 1.1 + ph), g);
        return { x: 0, y: 0, r: Math.sin(this.wing - off) * 0.06 * fs, sx: 0.92 + 0.08 * Math.abs(s), sy: 0.12 + 0.88 * s };
      };
      L.nearWing = ws(0); L.farWing = ws(0.25);
      const shake = this.e('shake'), tilt = this.e('tilt');
      L.head = {
        x: Math.sin(this.wing + 1) * 1.2 * fs, y: Math.cos(this.wing + 1) * 0.8 * fs,
        r: clamp(-R.r * 0.6, -0.2, 0.2) + gx * 0.05 + gy * 0.04 - 0.3 * tilt + Math.sin(t * 34) * 0.09 * shake + Math.sin(t * 0.7 + ph) * 0.03 * m, sx: 1, sy: 1,
      };
      L.eye = { x: gx * 2.2, y: gy * 1.5, r: 0, sx: 1, sy: 1 - 0.9 * blink };
      const fan = this.e('tailFan');
      L.tail = { x: 0, y: 0, r: Math.sin(t * 1.9 + ph) * 0.05 * m + clamp(lag[1] * 0.01, -0.2, 0.2) - 0.12 * fan, sx: 1, sy: 1 + 0.35 * fan };
      L.talons = { x: 0, y: 0, r: clamp(lag[0] * 0.01, -0.25, 0.25) + Math.sin(t * 1.3 + ph) * 0.05 * m, sx: 1, sy: 1 };
    }
    return { root: R, L, capePh: this.capePh };
  }
}

// ---------------------------------------------------------------- UI
const extraCss = `
#lab .skins { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; flex: 1; }
#lab .skins b { font-size: 12px; opacity: .6; align-self: center; letter-spacing: .08em; text-transform: uppercase; }
#lab .chip { width: auto; height: 34px; padding: 0 12px; border-radius: 999px; font: 800 13px Nunito, sans-serif; background: rgba(255,255,255,.12);
  color: #f6efdc; box-shadow: none; }
#lab .chip.on { background: #f3c35a; color: #3a2a10; }
#lab .chip:active { transform: none; box-shadow: none; }
#lab .panel canvas.fg { inset: 0; width: 100%; height: 100%; }
`;

type Panel = { el: HTMLDivElement; bg: HTMLCanvasElement; fg: HTMLCanvasElement; sprites: LayerSprites[]; scale: number; ox: number; oy: number; R: number; mover: Mover };

export function startMotionLab() {
  document.getElementById('loading')?.remove();
  document.getElementById('game')?.remove();
  const st = document.createElement('style'); st.textContent = LAB_CSS + extraCss; document.head.appendChild(st);
  const q = new URLSearchParams(location.search);
  const root = document.createElement('div'); root.id = 'lab';
  root.innerHTML = `
    <header><span class="tag">Mount Motion Lab · temporary</span><div class="skins"></div><span class="count"></span></header>
    <div class="stage"></div>
    <footer>
      <button class="prev" aria-label="Previous motion">‹</button>
      <div class="label"><div class="style"></div><div class="blurb"></div><div class="dots"></div></div>
      <button class="next" aria-label="Next motion">›</button>
    </footer>`;
  document.body.appendChild(root);
  const stage = root.querySelector('.stage') as HTMLDivElement;
  const pick = <T extends { id: string }>(list: T[], v: string | null, d: number) => {
    if (v && /^\d+$/.test(v)) return clamp(Number(v) - 1, 0, list.length - 1);
    const k = list.findIndex((s) => s.id === v); return k < 0 ? d : k;
  };
  let idx = pick(MOTIONS, q.get('m'), 0);
  let skin = pick(LAB_STYLES, q.get('skin'), LAB_STYLES.findIndex((s) => s.id === 'cel'));
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let calm = q.get('calm') === '1' || (q.get('calm') !== '0' && !!mq?.matches);

  const skins = root.querySelector('.skins') as HTMLDivElement;
  skins.innerHTML = `<b>Skin</b>` + LAB_STYLES.map((s, i) => `<button class="chip" data-i="${i}">${({ watercolor: 'Watercolor', cel: 'Cel', gouache: 'Gouache', clay: 'Clay', ink: 'Ink', pixel: 'Pixel' } as Record<string, string>)[s.id] ?? s.name}</button>`).join('') + `<button class="chip calm" title="Preview the reduced-motion fallback">Calm</button>`;
  skins.querySelectorAll<HTMLButtonElement>('.chip[data-i]').forEach((b) => b.addEventListener('click', () => { skin = Number(b.dataset.i); build(); }));
  skins.querySelector('.calm')!.addEventListener('click', () => { calm = !calm; reset(); ui(); });
  mq?.addEventListener?.('change', () => { calm = mq.matches; reset(); ui(); });

  const panels: Panel[] = RIGS.map((rig, i) => {
    const el = document.createElement('div'); el.className = 'panel';
    const bg = document.createElement('canvas'); bg.className = 'bg';
    const fg = document.createElement('canvas'); fg.className = 'fg';
    const name = document.createElement('div'); name.className = 'name'; name.textContent = ['Cowboy Cookie', 'Bald Eagle'][rig.mount];
    el.append(bg, fg, name); stage.appendChild(el);
    return { el, bg, fg, sprites: [], scale: 1, ox: 0, oy: 0, R: 1, mover: new Mover(i, MOTIONS[idx], calm) };
  });
  const dots = root.querySelector('.dots') as HTMLDivElement;
  dots.innerHTML = MOTIONS.map(() => '<i></i>').join('');

  function ui() {
    const ms = MOTIONS[idx];
    (root.querySelector('.style') as HTMLElement).textContent = ms.name;
    (root.querySelector('.blurb') as HTMLElement).textContent = ms.blurb + (calm ? ' (Calm: reduced-motion fallback.)' : '');
    (root.querySelector('.count') as HTMLElement).textContent = `Motion ${idx + 1} of ${MOTIONS.length}`;
    dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === idx));
    skins.querySelectorAll<HTMLButtonElement>('.chip[data-i]').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === skin));
    skins.querySelector('.calm')!.classList.toggle('on', calm);
    const u = new URL(location.href); u.searchParams.set('m', ms.id); u.searchParams.set('skin', LAB_STYLES[skin].id);
    if (calm !== !!mq?.matches) u.searchParams.set('calm', calm ? '1' : '0'); else u.searchParams.delete('calm');
    history.replaceState(null, '', u);
  }
  function reset() { for (const p of panels) p.mover = new Mover(p.mover.i, MOTIONS[idx], calm); simT = 0; }

  let token = 0, jobs: (() => void)[] = [];
  function build() {
    const style = LAB_STYLES[skin], my = ++token;
    jobs = []; const later: (() => void)[] = [];
    for (const p of panels) {
      const r = p.el.getBoundingClientRect();
      for (const cv of [p.bg, p.fg]) { cv.width = Math.round(r.width * DPR); cv.height = Math.round(r.height * DPR); }
      const bc = p.bg.getContext('2d')!; style.backdrop(bc, p.bg.width, p.bg.height);
      const size = Math.min(r.width * 0.96, r.height * 0.88) * DPR;
      p.scale = (size / 512) * 0.9; p.ox = p.fg.width / 2; p.oy = p.fg.height / 2 - r.height * 0.03 * DPR;
      p.R = style.pixel ? (style.pixel / 512) * 0.9 : Math.min(2, p.scale);
      p.sprites = [];
      const [f, l] = rigJobs(RIGS[p.mover.i], style, p.R, p.sprites);
      jobs.push(...f); later.push(...l);
    }
    // Static layers first (both mounts), then the cape frames; ~10ms of work per animation frame.
    jobs.push(...later);
    const run = () => {
      if (my !== token) return;
      const t0 = performance.now();
      while (jobs.length && performance.now() - t0 < 10) jobs.shift()!();
      if (jobs.length) requestAnimationFrame(run);
    };
    run();
    ui();
  }

  function draw(p: Panel) {
    const c = p.fg.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, p.fg.width, p.fg.height);
    c.imageSmoothingEnabled = !LAB_STYLES[skin].pixel;
    const rig = RIGS[p.mover.i], { root: R, L, capePh } = p.mover.pose();
    const [cx, cy] = rig.center;
    const base: M = chain(T(p.ox, p.oy), S(p.scale, p.scale), T(-256, -256));
    const rootM = chain(base, T(cx + R.x, cy + R.y), Rz(R.r), S(1, R.fy ?? 1), T(0, 100), S(R.sx, R.sy), T(0, -100), T(-cx, -cy));
    const world: Record<string, M> = {};
    const local = (id: string, pv: [number, number]): M => { const l = L[id] ?? P0(); return chain(T(pv[0] + l.x, pv[1] + l.y), Rz(l.r), S(l.sx, l.sy), T(-pv[0], -pv[1])); };
    for (const d of rig.layers) if (!d.parent) world[d.id] = mul(rootM, local(d.id, d.pivot));
    for (let pass = 0; pass < 2; pass++) for (const d of rig.layers) if (d.parent && world[d.parent] && !world[d.id]) world[d.id] = mul(world[d.parent], local(d.id, d.pivot));
    for (const ls of p.sprites) {
      const m = world[ls.def.id]; if (!m) continue;
      c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      if (ls.def.frames) {
        const n = ls.def.frames, f = (((capePh / TAU) * n) % n + n) % n, a = Math.floor(f), b = (a + 1) % n, k = f - a;
        const A = ls.frames[a] ?? ls.frames[0], B = ls.frames[b];
        if (A) c.drawImage(A.cv, A.x, A.y, A.w, A.h);
        if (B && B !== A && k > 0.02) { c.globalAlpha = k; c.drawImage(B.cv, B.x, B.y, B.w, B.h); c.globalAlpha = 1; }
      } else { const s = ls.frames[0]; if (s) c.drawImage(s.cv, s.x, s.y, s.w, s.h); }
    }
  }

  const go = (d: number) => { idx = (idx + d + MOTIONS.length) % MOTIONS.length; reset(); ui(); };
  (root.querySelector('.prev') as HTMLButtonElement).addEventListener('click', () => go(-1));
  (root.querySelector('.next') as HTMLButtonElement).addEventListener('click', () => go(1));
  window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
  let sx = 0, sy = 0;
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  stage.addEventListener('pointerup', (e) => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(build, 150); });

  // Fixed-step simulation (1/120 s) for jitter-free springs; render every animation frame.
  const STEP = 1 / 120;
  let simT = 0, last = performance.now(), paused = false, acc = 0, frames = 0, fpsT = performance.now(), fps = 0;
  const advance = (dt: number) => { acc += Math.min(dt, 0.1); while (acc >= STEP) { for (const p of panels) p.mover.step(STEP); simT += STEP; acc -= STEP; } };
  const tick = (now: number) => {
    if (!paused) advance((now - last) / 1000);
    last = now;
    for (const p of panels) draw(p);
    frames++; if (now - fpsT > 1000) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; }
    requestAnimationFrame(tick);
  };
  build();
  if (q.has('t')) { paused = true; advance(0); const target = Number(q.get('t')); while (simT < target) advance(0.05); }
  requestAnimationFrame(tick);
  (window as any).__motionlab = {
    go, count: MOTIONS.length, ids: MOTIONS.map((m) => m.id), skins: LAB_STYLES.map((s) => s.id),
    skin: (id: string) => { skin = Math.max(0, LAB_STYLES.findIndex((s) => s.id === id)); build(); },
    seek: (t: number) => { reset(); paused = true; while (simT < t) advance(0.05); },
    stepBy: (dt: number) => new Promise((res) => { advance(dt); requestAnimationFrame(() => requestAnimationFrame(res)); }),
    play: () => { paused = false; last = performance.now(); },
    ready: () => jobs.length === 0 && panels.every((p) => p.sprites.length > 0 && p.sprites.every((s) => s.frames.length && s.frames.every(Boolean))),
    fps: () => fps,
    beats: () => panels.map((p) => p.mover.beat && { k: p.mover.beat.k, u: (p.mover.t - p.mover.beat.t0) / p.mover.beat.d }),
  };
}
