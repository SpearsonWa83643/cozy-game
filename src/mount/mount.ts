// Mounts: call a flying friend, it swoops in, picks you up and wanders the map with you on its
// back. Drag (or hold) to steer it yourself; after ~2 s with no input it tours on its own again.
// Tap the ground to hop off near there; tap the mount for a few seconds of whoosh.
// Drop-off only on ground you could already walk to (no skipping gates). Art is data-driven
// (see defs.ts) so Call Mount can pick among unlocked mounts.
import Phaser from 'phaser';
import { atlasOf, frameScale, S } from '../art';
import { WORLD_W, WORLD_H } from '../layout';
import { sfx } from '../audio';
import { theme, themeEvents } from '../theme';
import type { WorldScene } from '../scenes/World';
import { MountDef, mountById } from './defs';
import { stickInput } from '../controls';
import type { TouchStick } from '../controls';

export type MountPhase = 'off' | 'arrive' | 'ride' | 'travel' | 'land' | 'hop' | 'leave';

const RIDE_ALT = 72;
const SPEED = 150;
const FAST_SPEED = 360;
const FAST_MS = 3500;
const COOLDOWN_MS = 4000; // after fast mode ends
const DEPTH = 9300;
const EDGE = 70;
/** After this long with no steering input, the mount drifts back to its own tour. */
const IDLE_TOUR_MS = 2000;
const TRAVEL_NEAR = 220;
const STEER_SPEED = 190;

/** Cubic Hermite between two points with start/end velocities (already scaled by duration). */
function hermite(p0: number, v0: number, p1: number, v1: number, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * v0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * v1;
}
function hermiteD(p0: number, v0: number, p1: number, v1: number, t: number) {
  const t2 = t * t;
  return (6 * t2 - 6 * t) * p0 + (3 * t2 - 4 * t + 1) * v0 + (-6 * t2 + 6 * t) * p1 + (3 * t2 - 2 * t) * v1;
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

type Seg = { x0: number; y0: number; vx0: number; vy0: number; x1: number; y1: number; vx1: number; vy1: number; a0: number; a1: number; T: number; t: number; altEase: (t: number) => number; arc?: number };

/** 13: a tiny unique ride effect per fun mount (cookie crumbs, chili sparks, carpet glitter, duck bubbles, jelly glow, berry seeds) + an idle wobble. */
type Fx = { tint: number[]; add: boolean; life: number; vx: [number, number]; vy: [number, number]; gy: number; sc: number; every: number; at: [number, number] };
const FX: Record<string, Fx> = {
  cowboy_cookie: { tint: [0x6b3f1d, 0xa8692e, 0xd9a05a], add: false, life: 700, vx: [-30, 0], vy: [-10, 20], gy: 380, sc: 0.42, every: 80, at: [-22, 8] },
  chili_poncho: { tint: [0xff3b1f, 0xff9a1f, 0xffd23a], add: true, life: 520, vx: [-70, -20], vy: [-60, -10], gy: -40, sc: 0.5, every: 60, at: [-40, -2] },
  magic_carpet: { tint: [0xffd34d, 0xfff1a0, 0xffffff], add: true, life: 800, vx: [-40, -8], vy: [-10, 14], gy: 30, sc: 0.4, every: 90, at: [-44, 10] },
  rubber_duck: { tint: [0xffffff, 0xcdeeff, 0x9fdcf5], add: false, life: 1100, vx: [-16, 6], vy: [-45, -20], gy: -20, sc: 0.5, every: 130, at: [-10, -14] },
  sky_jelly: { tint: [0xff8fd0, 0xc99bff, 0xffd0f0], add: true, life: 1000, vx: [-14, 14], vy: [10, 40], gy: 20, sc: 0.55, every: 100, at: [0, 16] },
  strawberry: { tint: [0x3fae49, 0xe8384f, 0xfff1a0], add: false, life: 800, vx: [-26, 0], vy: [-5, 20], gy: 300, sc: 0.36, every: 110, at: [-24, 8] },
};
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class Mount {
  phase: MountPhase = 'off';
  /** Ground point under the eagle (the shadow), its height above it, heading and speed. */
  gx = 0; gy = 0; alt = 0; heading = 0; speed = 0;
  dir = 1;
  flap = 0; glide = 0; glideAmt = 0; nextGlide = 3;
  fastMs = 0; cooldownMs = 0;
  boosts = 0; rides = 0; landings = 0;
  target: [number, number] | null = null;
  targetTime = 0;
  seg: Seg | null = null;
  reach: Uint8Array | null = null;
  reachList: number[] = [];
  dropAt: [number, number] | null = null;
  body!: Phaser.GameObjects.Image;
  wing!: Phaser.GameObjects.Image;
  wingFar!: Phaser.GameObjects.Image;
  shadow!: Phaser.GameObjects.Image;
  trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  fx?: Phaser.GameObjects.Particles.ParticleEmitter; fxId = '';
  hopT = 0;
  hopFrom: [number, number] = [0, 0];
  riderOn = false;
  /** Player steering: stick vector from the UI (null when released). */
  steerIn: { x: number; y: number } | null = null;
  /** Manual control: true while steering and for IDLE_TOUR_MS after the last input. */
  manual = false;
  idleMs = 0;
  /** Fast travel: where we're flying, and counts for tests. */
  travelName = ''; travelTarget: [number, number] | null = null; travels = 0; arrivals = 0;
  vx = 0; vy = 0;
  steers = 0; tours = 0;
  def: MountDef = mountById('eagle');
  get SCALE() { return this.def.scale; }

  constructor(private w: WorldScene) {
    this.shadow = w.add.image(0, 0, atlasOf('shadow'), 'shadow').setDepth(-480).setVisible(false);
    this.wingFar = w.add.image(0, 0, atlasOf('eagle_wing_far'), 'eagle_wing_far').setOrigin(0.5, 0.96).setDepth(DEPTH - 1).setVisible(false);
    this.body = w.add.image(0, 0, atlasOf('eagle_body'), 'eagle_body').setOrigin(0.5, 0.52).setDepth(DEPTH).setVisible(false);
    this.wing = w.add.image(0, 0, atlasOf('eagle_wing'), 'eagle_wing').setOrigin(0.5, 0.96).setDepth(DEPTH + 0.5).setVisible(false);
    this.applyDef(this.def);
    this.trail = w.add.particles(0, 0, atlasOf('spark'), {
      frame: 'spark', lifespan: 520, speed: { min: 4, max: 20 }, scale: { start: 0.5, end: 0 }, alpha: { start: 0.85, end: 0 },
      tint: [0xffffff, 0xdff3ff, 0xfff1c4], blendMode: 'ADD', frequency: 22, quantity: 2, emitting: false,
    }).setDepth(DEPTH - 2);
    this.buildFx();
    this.applyTheme();
    const onTheme = () => this.applyTheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
  }

  /** Halloween: a subtle moonlit tint. Classic: natural colours. */
  applyTheme() {
    const t = theme.id === 'halloween' ? 0xd8ccff : 0xffffff;
    for (const o of [this.body, this.wing, this.wingFar]) { if (t === 0xffffff) o.clearTint(); else o.setTint(t); }
  }

  /** Swap body/wing textures to the chosen mount. */
  applyDef(def: MountDef) {
    this.def = def;
    const sc = (k: string) => this.SCALE / (frameScale[k] ?? S);
    this.body.setTexture(atlasOf(def.body), def.body).setScale(sc(def.body));
    this.wing.setTexture(atlasOf(def.wing), def.wing).setScale(sc(def.wing));
    this.wingFar.setTexture(atlasOf(def.wingFar), def.wingFar).setScale(sc(def.wingFar));
    const prop = def.style === 'prop';
    this.wing.setOrigin(0.5, prop ? 0.5 : 0.96).setDepth(prop ? DEPTH + 0.2 : DEPTH + 0.5);
    this.wingFar.setOrigin(0.5, prop ? 0.5 : 0.96);
    this.applyTheme();
    if (this.trail) this.buildFx();
  }

  /** (Re)build the little ride-effect emitter for the current mount. Capped, tiny, off until riding. */
  buildFx() {
    this.fx?.destroy(); this.fx = undefined; this.fxId = '';
    const f = FX[this.def.id];
    if (!f) return;
    this.fxId = this.def.id;
    this.fx = this.w.add.particles(0, 0, atlasOf('spark'), {
      frame: 'spark', lifespan: f.life, speedX: { min: f.vx[0], max: f.vx[1] }, speedY: { min: f.vy[0], max: f.vy[1] }, gravityY: f.gy,
      scale: { start: f.sc, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: f.tint, blendMode: f.add ? 'ADD' : 'NORMAL',
      frequency: f.every, quantity: 1, maxParticles: 0, emitting: false,
    }).setDepth(DEPTH + 0.1);
  }

  /** Eagle is on screen at all. */
  get active() { return this.phase !== 'off'; }
  /** The eagle (not the walk code) moves the player. */
  get carrying() { return this.phase === 'arrive' || this.phase === 'ride' || this.phase === 'travel' || this.phase === 'land' || this.phase === 'hop'; }
  get riding() { return this.phase === 'ride'; }
  /** Where the eagle is drawn (its body centre). */
  get ex() { return this.gx; }
  get ey() { return this.gy - this.alt; }

  /** Can the Call Mount button be used right now? */
  canCall() {
    const w = this.w;
    return this.phase === 'off' && !w.inWild && !w.locked && !w.village?.building && !w.buildView && !w.fishing?.active && !w.boat?.active && !w.boat?.hopping
      && !w.registry.get('dialogOpen') && !w.registry.get('menuOpen') && !w.registry.get('mountPicker');
  }

  // ------------------------------------------------------------ reachability
  /** Flood fill the walk grid from the player: only these cells are allowed drop-off spots. */
  computeReach() {
    const nav = this.w.nav;
    const reach = new Uint8Array(nav.cols * nav.rows);
    const list: number[] = [];
    const start = nav.nearestFree(this.w.feet.x, this.w.feet.y, 6);
    if (start) {
      const q = [nav.idx(start[0], start[1])];
      reach[q[0]] = 1;
      while (q.length) {
        const i = q.pop()!;
        list.push(i);
        const c = i % nav.cols, r = (i / nav.cols) | 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc, nr = r + dr;
          if (nav.isBlocked(nc, nr)) continue;
          const j = nav.idx(nc, nr);
          if (!reach[j]) { reach[j] = 1; q.push(j); }
        }
      }
    }
    this.reach = reach; this.reachList = list;
  }
  isReachable(x: number, y: number) {
    const nav = this.w.nav;
    const [c, r] = nav.cellOf(x, y);
    return !!this.reach?.[nav.idx(c, r)];
  }
  /** Nearest walkable, reachable spot to a world point (searching outward). */
  nearestReachable(x: number, y: number): [number, number] {
    const nav = this.w.nav;
    const [c0, r0] = nav.cellOf(x, y);
    for (let k = 0; k <= 60; k++) {
      let best: [number, number] | null = null, bestD = Infinity;
      for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
        const c = c0 + dc, r = r0 + dr;
        if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows || !this.reach?.[nav.idx(c, r)]) continue;
        // Prefer cells with walkable neighbours (not a 1-cell nook).
        const [cx, cy] = nav.center(c, r);
        const d = Math.hypot(cx - x, cy - y) + (nav.isBlocked(c + 1, r) || nav.isBlocked(c - 1, r) || nav.isBlocked(c, r + 1) || nav.isBlocked(c, r - 1) ? 15 : 0);
        if (d < bestD) { bestD = d; best = [cx, cy]; }
      }
      if (best) return best;
    }
    return [this.w.feet.x, this.w.feet.y];
  }
  pickWaypoint(): [number, number] {
    const nav = this.w.nav;
    for (let i = 0; i < 60; i++) {
      const idx = this.reachList[(Math.random() * this.reachList.length) | 0];
      if (idx === undefined) break;
      const [x, y] = nav.center(idx % nav.cols, (idx / nav.cols) | 0);
      if (x < EDGE + 40 || y < EDGE + 40 || x > WORLD_W - EDGE - 40 || y > WORLD_H - EDGE - 40) continue;
      const d = Math.hypot(x - this.gx, y - this.gy);
      // Not straight behind us: keeps the wander smooth instead of U-turning.
      const turn = Math.abs(wrap(Math.atan2(y - this.gy, x - this.gx) - this.heading));
      if (d > 260 && d < 720 && (turn < 2.0 || i > 40)) return [x, y];
    }
    return this.nearestReachable(this.gx + Math.cos(this.heading) * 300, this.gy + Math.sin(this.heading) * 300);
  }

  // ------------------------------------------------------------ calling + riding
  call(mountId?: string) {
    if (!this.canCall()) return false;
    this.applyDef(mountById(mountId ?? 'eagle'));
    const w = this.w;
    this.computeReach();
    w.path = []; w.pathTarget = null; w.stick = null;
    w.body.setVelocity(0, 0);
    const px = w.feet.x, py = w.feet.y;
    // Swoop in from the side of the map with more room.
    const side = px < WORLD_W / 2 ? 1 : -1;
    const fromX = px + side * 560, fromY = py - 120;
    this.dir = -side;
    this.gx = fromX; this.gy = fromY; this.alt = 300;
    this.heading = Math.atan2(py - fromY, px - fromX);
    const v = 260;
    this.seg = {
      x0: fromX, y0: fromY, vx0: Math.cos(this.heading) * v, vy0: Math.sin(this.heading) * v,
      x1: px, y1: py, vx1: this.dir * 120, vy1: 0, a0: 300, a1: 26, T: 1.5, t: 0,
      altEase: (t) => 1 - (1 - t) * (1 - t) * (1 - t),
    };
    this.phase = 'arrive';
    this.fastMs = 0; this.cooldownMs = 0;
    this.show(true);
    sfx.unlock(); sfx.wind(0.8); sfx.chirp();
    w.game.events.emit('mount', this.phase);
    return true;
  }

  show(on: boolean) {
    for (const o of [this.body, this.wing, this.wingFar, this.shadow]) o.setVisible(on).setAlpha(1);
  }

  pickUp() {
    const w = this.w;
    this.riderOn = true;
    this.rides++;
    w.body.setVelocity(0, 0);
    w.body.enable = false;
    w.playerShadow.setVisible(false);
    w.burst(w.feet.x, w.feet.y - 20, 0xfff1c4, 12, 'spark');
    sfx.pickup();
    this.phase = 'ride';
    this.speed = 140; this.heading = this.dir > 0 ? 0 : Math.PI;
    this.manual = false; this.idleMs = 0; this.steerIn = null;
    this.target = this.pickWaypoint(); this.targetTime = 0;
    w.game.events.emit('mount', this.phase);
    w.game.events.emit('toast', `Wheee! Riding the ${this.def.name}! Tap the ground to hop off.`);
  }

  // ------------------------------------------------------------ fast travel (9.3)
  /** Where a fast-travel flight to (x, y) would end, or null if you haven't found the way there on foot yet. */
  travelSpot(x: number, y: number): [number, number] | null {
    if (!this.reach) this.computeReach();
    const spot = this.nearestReachable(x, y);
    return Math.hypot(spot[0] - x, spot[1] - y) <= TRAVEL_NEAR ? spot : null;
  }
  /** While riding: fly smoothly to a landmark, then hover there and carry on riding. */
  travelTo(x: number, y: number, name: string) {
    if (this.phase !== 'ride' && this.phase !== 'travel') return false;
    const spot = this.travelSpot(x, y);
    if (!spot) return false;
    const d = Math.hypot(spot[0] - this.gx, spot[1] - this.gy);
    const T = Phaser.Math.Clamp(1.3 + d / 650, 1.6, 6.5);
    const ang = Math.atan2(spot[1] - this.gy, spot[0] - this.gx);
    // Leave along the current heading (no snap), arrive gliding gently in the travel direction.
    const sp0 = Math.min(this.speed, 260) * T * 0.5;
    const vx0 = Math.cos(this.heading) * sp0, vy0 = Math.sin(this.heading) * sp0;
    const vx1 = Math.cos(ang) * 50 * T, vy1 = Math.sin(ang) * 50 * T;
    this.seg = { x0: this.gx, y0: this.gy, vx0, vy0, x1: spot[0], y1: spot[1], vx1, vy1, a0: this.alt, a1: RIDE_ALT, T, t: 0,
      altEase: (t) => t * t * (3 - 2 * t), arc: Math.min(150, 50 + d / 20) };
    this.fastMs = 0; this.glide = 0;
    this.manual = false; this.steerIn = null;
    this.phase = 'travel';
    this.travelName = name; this.travelTarget = spot; this.travels++;
    sfx.wind(1.2); sfx.sparkle();
    this.w.burst(this.ex, this.ey, 0xffffff, 12, 'spark');
    this.w.game.events.emit('mount', this.phase);
    this.w.game.events.emit('toast', `Off to ${name}!`);
    return true;
  }
  arrive() {
    this.phase = 'ride';
    // Hover a moment at the landmark (coasting), then the usual tour picks up from here.
    this.manual = true; this.vx = Math.cos(this.heading) * 40; this.vy = Math.sin(this.heading) * 40;
    this.idleMs = -3000; this.steerIn = null;
    this.arrivals++;
    sfx.sparkle();
    this.w.burst(this.ex, this.ey, 0xfff1c4, 14, 'spark');
    this.w.game.events.emit('mount', this.phase);
    this.w.game.events.emit('toast', `Here we are: ${this.travelName}! Tap the ground to hop off.`);
  }

  /** Fly down to the nearest reachable spot near (x, y) and let the rider off there. */
  landAt(x: number, y: number) {
    if (this.phase !== 'ride') return false;
    const spot = this.nearestReachable(x, y);
    this.dropAt = spot;
    const d = Math.hypot(spot[0] - this.gx, spot[1] - this.gy);
    const T = Math.min(3.2, 0.7 + d / 240);
    const vx0 = Math.cos(this.heading) * this.speed * T * 0.6, vy0 = Math.sin(this.heading) * this.speed * T * 0.6;
    this.seg = { x0: this.gx, y0: this.gy, vx0, vy0, x1: spot[0], y1: spot[1], vx1: 0, vy1: 0, a0: this.alt, a1: 16, T, t: 0, altEase: (t) => t * t * (3 - 2 * t) };
    this.fastMs = 0;
    this.manual = false; this.steerIn = null;
    this.phase = 'land';
    this.w.tapMarker.setPosition(spot[0], spot[1]).setAlpha(0.9).setScale(0.2 / frameScale.ripple);
    this.w.tweens.killTweensOf(this.w.tapMarker);
    this.w.tweens.add({ targets: this.w.tapMarker, scale: 0.7 / frameScale.ripple, alpha: 0, duration: 900, ease: 'Sine.easeOut' });
    this.w.game.events.emit('mount', this.phase);
    return true;
  }

  /** Land right away (e.g. build mode opened): rider set down under the eagle. */
  dropNow() {
    if (!this.carrying) return;
    const spot = this.riderOn ? this.nearestReachable(this.gx, this.gy) : [this.w.feet.x, this.w.feet.y] as [number, number];
    this.setRiderDown(spot[0], spot[1]);
    this.startLeave();
  }

  /** Tap the eagle while riding: a few seconds of whoosh, then a short rest. */
  boost() {
    if (this.phase !== 'ride') return false;
    if (this.cooldownMs > 0 || this.fastMs > 0) {
      this.w.tweens.add({ targets: this.body, angle: { from: -6 * this.dir, to: 6 * this.dir }, duration: 120, yoyo: true, repeat: 1 });
      this.w.floatText(this.ex, this.ey - 50, 'Resting...');
      return false;
    }
    this.fastMs = FAST_MS;
    this.cooldownMs = FAST_MS + COOLDOWN_MS;
    this.boosts++;
    this.glideAmt = 0; this.glide = 0;
    sfx.wind(1.4); sfx.sparkle();
    this.w.floatText(this.ex, this.ey - 50, 'Whoosh!', '#fff1c4');
    this.w.burst(this.ex, this.ey, 0xffffff, 14, 'spark');
    this.w.game.events.emit('mount', 'fast');
    return true;
  }

  /** A tap while the eagle is about. Returns true when the tap was used by the mount. */
  onTap(wx: number, wy: number) {
    if (!this.carrying) return false;
    if (this.phase !== 'ride') return true; // swooping or landing: ignore taps
    if (this.hitEagle(wx, wy)) { this.boost(); return true; }
    this.landAt(wx, wy);
    return true;
  }
  hitEagle(wx: number, wy: number) {
    const dx = (wx - this.ex) / 70, dy = (wy - (this.ey - 10)) / 55;
    return dx * dx + dy * dy < 1;
  }

  setRiderDown(x: number, y: number) {
    const w = this.w;
    this.riderOn = false;
    w.playerImg.setCrop();
    w.feet.setPosition(x, y);
    w.body.enable = true;
    w.body.reset(x, y);
    w.lastSafe = [x, y];
    w.path = []; w.pathTarget = null;
    w.playerShadow.setVisible(true);
    this.landings++;
  }

  startLeave() {
    this.phase = 'leave';
    const ang = -Math.PI / 2 + this.dir * 0.9;
    this.seg = {
      x0: this.gx, y0: this.gy, vx0: 0, vy0: 0, x1: this.gx + Math.cos(ang) * 420, y1: this.gy - 140,
      vx1: this.dir * 600, vy1: -100, a0: this.alt, a1: 320, T: 1.7, t: 0, altEase: (t) => t * t,
    };
    this.fastMs = 0;
    this.w.game.events.emit('mount', this.phase);
  }

  setSteer(v: { x: number; y: number } | null) { this.steerIn = v; }

  /** Current steering input: drag (stick direction) or a still hold (fly toward the finger). */
  steerInput(): [number, number, number] {
    if (this.steerIn) return stickInput(this.steerIn);
    const ui = this.w.scene.get('ui') as unknown as { stick?: TouchStick } | null;
    const h = ui?.stick?.held?.();
    if (!h) return [0, 0, 0];
    const wp = this.w.cameras.main.getWorldPoint(h.x, h.y);
    // The finger is on the sky picture; aim at the ground under it.
    const dx = wp.x - this.gx, dy = wp.y + this.alt - this.gy, d = Math.hypot(dx, dy);
    if (d < 24) return [0, 0, 0];
    const k = Math.min(1, d / 160) * 0.75 + 0.25;
    return [dx / d * k, dy / d * k, k];
  }

  /** Player override: ease velocity toward input * speed (same blend idea as walking). */
  steerManual(dt: number, ix: number, iy: number, len: number) {
    const fast = this.fastMs > 0;
    if (!this.manual) { this.manual = true; this.steers++; this.vx = Math.cos(this.heading) * this.speed; this.vy = Math.sin(this.heading) * this.speed; }
    const vs = fast ? FAST_SPEED : STEER_SPEED;
    // With input: respond quickly. Coasting (no input yet, still manual): glide on and slow a little.
    const tx = len ? ix * vs : this.vx * 0.6, ty = len ? iy * vs : this.vy * 0.6;
    const blend = 1 - Math.exp(-dt * (len ? 5 : 0.8));
    this.vx += (tx - this.vx) * blend; this.vy += (ty - this.vy) * blend;
    this.gx += this.vx * dt; this.gy += this.vy * dt;
    const cx = Phaser.Math.Clamp(this.gx, EDGE, WORLD_W - EDGE), cy = Phaser.Math.Clamp(this.gy, EDGE, WORLD_H - EDGE);
    if (cx !== this.gx) { this.gx = cx; this.vx = 0; }
    if (cy !== this.gy) { this.gy = cy; this.vy = 0; }
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 12) this.heading = Math.atan2(this.vy, this.vx);
    this.speed = sp;
    this.alt += (RIDE_ALT + Math.sin(this.w.time.now / 1400) * 6 - this.alt) * (1 - Math.exp(-dt * 1.5));
  }

  /** Ride step: player steering wins; after a quiet moment, back to the tour from right here. */
  ride(dt: number) {
    const [ix, iy, len] = this.steerInput();
    if (len > 0) { this.idleMs = 0; this.steerManual(dt, ix, iy, len); return; }
    if (this.manual) {
      this.idleMs += dt * 1000;
      if (this.idleMs < IDLE_TOUR_MS) { this.steerManual(dt, 0, 0, 0); return; }
      // Resume touring: keep current position, heading and speed (steer() turns/accelerates smoothly).
      this.manual = false; this.tours++;
      this.target = this.pickWaypoint(); this.targetTime = 0;
    }
    this.steer(dt);
  }

  // ------------------------------------------------------------ per-frame
  stepSeg(dt: number) {
    const s = this.seg!;
    s.t = Math.min(1, s.t + dt / s.T);
    const t = s.t;
    const nx = hermite(s.x0, s.vx0, s.x1, s.vx1, t), ny = hermite(s.y0, s.vy0, s.y1, s.vy1, t);
    const dx = hermiteD(s.x0, s.vx0, s.x1, s.vx1, t) / s.T, dy = hermiteD(s.y0, s.vy0, s.y1, s.vy1, t) / s.T;
    this.gx = nx; this.gy = ny;
    this.alt = s.a0 + (s.a1 - s.a0) * s.altEase(t) + (s.arc ?? 0) * Math.sin(Math.PI * t);
    const sp = Math.hypot(dx, dy);
    if (sp > 20) this.heading = Math.atan2(dy, dx);
    this.speed = sp;
    return t >= 1;
  }

  steer(dt: number) {
    const fast = this.fastMs > 0;
    if (!this.target || Math.hypot(this.target[0] - this.gx, this.target[1] - this.gy) < 80 || (this.targetTime += dt) > 10) {
      this.target = this.pickWaypoint(); this.targetTime = 0;
    }
    const want = Math.atan2(this.target[1] - this.gy, this.target[0] - this.gx);
    const turn = (fast ? 1.5 : 1.15) * dt;
    this.heading += Phaser.Math.Clamp(wrap(want - this.heading), -turn, turn);
    const vs = fast ? FAST_SPEED : SPEED;
    this.speed += (vs - this.speed) * (1 - Math.exp(-dt * (fast ? 4 : 1.6)));
    this.gx += Math.cos(this.heading) * this.speed * dt;
    this.gy += Math.sin(this.heading) * this.speed * dt * 0.85;
    const cx = Phaser.Math.Clamp(this.gx, EDGE, WORLD_W - EDGE), cy = Phaser.Math.Clamp(this.gy, EDGE, WORLD_H - EDGE);
    if (cx !== this.gx || cy !== this.gy) { this.gx = cx; this.gy = cy; this.target = this.pickWaypoint(); }
    this.alt += (RIDE_ALT + Math.sin(this.w.time.now / 1400) * 6 - this.alt) * (1 - Math.exp(-dt * 1.5));
  }

  /** Called from WorldScene.update every frame. `paused`: dialog/menu open. */
  update(time: number, dt: number, paused: boolean) {
    if (this.phase === 'off') return;
    const w = this.w;
    if (!paused) {
      if (this.cooldownMs > 0) this.cooldownMs -= dt * 1000;
      if (this.fastMs > 0) this.fastMs -= dt * 1000;
      switch (this.phase) {
        case 'arrive':
          if (this.stepSeg(dt)) this.pickUp();
          break;
        case 'ride':
          this.ride(dt);
          break;
        case 'travel':
          if (this.stepSeg(dt)) this.arrive();
          break;
        case 'land':
          if (this.stepSeg(dt)) { this.phase = 'hop'; this.hopT = 0; this.hopFrom = [w.playerImg.x, w.playerImg.y]; sfx.blip(); }
          break;
        case 'hop': {
          this.hopT += dt / 0.42;
          this.alt += (12 - this.alt) * (1 - Math.exp(-dt * 6));
          if (this.hopT >= 1) {
            const [x, y] = this.dropAt ?? [this.gx, this.gy];
            this.setRiderDown(x, y);
            w.burst(x, y - 4, 0xe9d8b4, 8, 'spark');
            w.dust.emitParticleAt(x, y + 4, 6);
            sfx.thump();
            this.startLeave();
          }
          break;
        }
        case 'leave':
          if (this.stepSeg(dt)) { this.phase = 'off'; this.show(false); this.trail.stop(); this.fx?.stop(); w.game.events.emit('mount', 'off'); return; }
          if (this.seg!.t > 0.6) { const a = 1 - (this.seg!.t - 0.6) / 0.4; for (const o of [this.body, this.wing, this.wingFar, this.shadow]) o.setAlpha(a); }
          break;
      }
    }
    // Facing with a little hysteresis.
    const vx = Math.cos(this.heading) * this.speed;
    if (vx > 15) this.dir = 1; else if (vx < -15) this.dir = -1;
    this.draw(time, dt, paused);
    if (this.riderOn) {
      w.feet.setPosition(this.gx, this.gy);
      w.lastSafe = [this.gx, this.gy];
    }
  }

  draw(time: number, dt: number, paused: boolean) {
    const w = this.w;
    const fast = this.fastMs > 0;
    // Wings: beat faster when climbing, landing or whooshing; glide now and then on a ride.
    const rate = this.phase === 'hop' ? 3.4 : fast ? 3.0 : this.phase === 'arrive' ? 1.2 : this.phase === 'leave' || this.phase === 'travel' ? 2.4 : 1.7;
    if (this.phase === 'ride' && !fast && !paused) {
      this.nextGlide -= dt;
      if (this.nextGlide <= 0 && this.glide <= 0) { this.glide = 1.4 + Math.random(); this.nextGlide = 4 + Math.random() * 4; }
    }
    if (this.glide > 0) this.glide -= dt;
    const gTarget = this.glide > 0 || this.phase === 'arrive' && (this.seg?.t ?? 0) < 0.55 ? 1 : 0;
    this.glideAmt += (gTarget - this.glideAmt) * (1 - Math.exp(-dt * 4));
    this.flap += dt * Math.PI * 2 * rate * (this.def.flapRate ?? 1) * (1 - this.glideAmt * 0.85);
    const c = Math.cos(this.flap);
    const lift = c * (1 - this.glideAmt) + 0.6 * this.glideAmt; // glide: wings held up in a soaring V // 1 up, -1 down; glide holds wings level-ish
    const bob = Math.sin(this.flap) * 3.2 * (1 - this.glideAmt) + Math.sin(time / 600) * 1.5;
    const d = this.dir;
    const x = this.ex, y = this.ey + bob;
    const vy = Math.sin(this.heading) * this.speed;
    let tilt = Phaser.Math.Clamp(vy / 900, -0.14, 0.14) * d + (this.phase === 'hop' ? -0.12 * d : 0);
    const bs = this.SCALE / (frameScale[this.def.body] ?? S);
    // Idle wobble per mount (skipped for reduced motion): carpet sways, jelly pulses, duck waddles, chili shivers, berry squishes.
    let bsx = 1, bsy = 1;
    if (!reduceMotion()) switch (this.def.id) {
      case 'magic_carpet': tilt += Math.sin(time / 380) * 0.06; break;
      case 'sky_jelly': bsy = 1 + Math.sin(time / 240) * 0.05; bsx = 1 - Math.sin(time / 240) * 0.04; break;
      case 'rubber_duck': tilt += Math.sin(time / 260) * 0.045 * d; break;
      case 'chili_poncho': tilt += Math.sin(time / 90) * 0.015; break;
      case 'strawberry': bsy = 1 + Math.sin(time / 300) * 0.035; bsx = 1 - Math.sin(time / 300) * 0.03; break;
      case 'cowboy_cookie': tilt += Math.sin(time / 420) * 0.03 * d; break;
    }
    this.body.setPosition(x, y).setFlipX(d < 0).setRotation(tilt).setScale(bs * bsx, bs * bsy);
    const ws = this.SCALE / (frameScale[this.def.wing] ?? S);
    const sy = ws * (lift >= 0 ? 0.35 + 0.65 * lift : 0.35 + 0.95 * lift); // through 0 the wing flips to point down
    const sweep = d * (0.32 + 0.08 * Math.sin(this.flap));
    const cos = Math.cos(tilt), sin = Math.sin(tilt);
    const at = (ox: number, oy: number) => [x + (ox * d) * cos - oy * sin, y + (ox * d) * sin + oy * cos];
    const [nx, ny] = at(-4 * this.SCALE, -7 * this.SCALE); // shoulder just behind the rider, who sits in front
    this.wing.setPosition(nx, ny).setScale(ws, sy).setRotation(-sweep + tilt).setFlipX(d < 0);
    const [fx, fy] = at(3 * this.SCALE, -10 * this.SCALE);
    this.wingFar.setPosition(fx, fy).setScale(ws * 0.9, sy * 0.88).setRotation(-sweep * 1.15 + tilt).setFlipX(d < 0);
    if (this.def.style === 'prop') {
      // Propeller at the nose: spins by squashing its height; a faint blur disc sits behind it.
      const [pa, pb] = this.def.propAt ?? [60, 0];
      const [px, py] = at(pa * this.SCALE, pb * this.SCALE);
      const spin = time / (fast ? 18 : 30);
      this.wing.setPosition(px, py).setScale(ws * 0.6, ws * (0.15 + 0.85 * Math.abs(Math.cos(spin)))).setRotation(tilt).setFlipX(d < 0);
      this.wingFar.setPosition(px, py).setScale(ws * 0.9, ws).setRotation(tilt).setFlipX(d < 0);
    }
    // Shadow shrinks and fades with height.
    const k = 1 / (1 + this.alt / 140);
    this.shadow.setPosition(this.gx, this.gy + 4).setScale((96 * k / 64) / (frameScale.shadow ?? 1)).setAlpha((0.35 + 0.5 * k) * this.body.alpha);
    // Whoosh trail from the tail.
    const [tx, ty] = at(-48 * this.SCALE, 2);
    this.trail.setPosition(tx, ty);
    if (fast && !this.trail.emitting) this.trail.start(); else if (!fast && this.trail.emitting) this.trail.stop();
    // Ride effect: only while a rider is aboard and flying.
    if (this.fx) {
      const [ox, oy] = FX[this.fxId].at;
      const [fx0, fy0] = at(ox * this.SCALE, oy * this.SCALE);
      this.fx.setPosition(fx0, fy0);
      const on = this.riderOn && (this.phase === 'ride' || this.phase === 'travel' || this.phase === 'leave') && !paused && !reduceMotion();
      if (on && !this.fx.emitting) this.fx.start(); else if (!on && this.fx.emitting) this.fx.stop();
    }
    // Rider sits on the eagle's back (legs tucked into the feathers).
    if (this.riderOn || this.phase === 'arrive' || this.phase === 'hop') this.drawRider(at, d, time);
  }

  drawRider(at: (ox: number, oy: number) => number[], d: number, time: number) {
    const w = this.w;
    const img = w.playerImg;
    const fw = img.frame.realWidth, fh = img.frame.realHeight;
    if (this.phase === 'arrive') return; // still standing on the ground, waiting
    const [bx, by] = at(4 * this.SCALE, -10 * this.SCALE);
    img.setTexture(w.heroKey, '2_0').setFlipX(d < 0).setScale(1 / S);
    if (this.phase === 'hop') {
      const [sx, sy] = [bx, by + 12];
      const [ex, ey] = this.dropAt ?? [this.gx, this.gy];
      const t = Math.min(1, this.hopT);
      const hx = sx + (ex - sx) * t, hy = sy + (ey + 6 - sy) * t - Math.sin(t * Math.PI) * 30;
      img.setCrop().setPosition(hx, hy).setDepth(DEPTH + 3);
      return;
    }
    img.setCrop(0, 0, fw, fh - 15 * S).setPosition(bx, by + 12 + Math.sin(time / 300) * 0.6).setDepth(DEPTH + 1);
  }

  /** Test/debug snapshot. */
  snapshot() {
    return {
      id: this.def.id, name: this.def.name,
      phase: this.phase, riding: this.riding, carrying: this.carrying, riderOn: this.riderOn,
      fast: this.fastMs > 0, cooldown: Math.max(0, Math.round(this.cooldownMs)), ground: [Math.round(this.gx), Math.round(this.gy)],
      eagle: [Math.round(this.ex), Math.round(this.ey)], alt: Math.round(this.alt), speed: Math.round(this.speed),
      steering: this.manual, idleMs: Math.round(this.idleMs), steers: this.steers, tours: this.tours, heading: +this.heading.toFixed(2),
      boosts: this.boosts, rides: this.rides, landings: this.landings, dropAt: this.dropAt ? this.dropAt.map(Math.round) : null,
      canCall: this.canCall(), reachable: this.reachList.length, seg: this.seg ? +this.seg.t.toFixed(2) : null,
      travels: this.travels, arrivals: this.arrivals, travelName: this.travelName, travelTarget: this.travelTarget ? this.travelTarget.map(Math.round) : null,
      fx: this.fxId, fxOn: !!this.fx?.emitting, fxAlive: this.fx?.getAliveParticleCount() ?? 0,
      reachableHere: this.reach ? this.isReachable(this.w.feet.x, this.w.feet.y) : null,
    };
  }
}
