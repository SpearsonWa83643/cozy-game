// Mounts: call a bald eagle, it swoops in, picks you up and wanders the map with you on its
// back. Tap the ground to hop off near there; tap the eagle for a few seconds of whoosh.
// The eagle only ever sets you down on ground you could already walk to (no skipping gates).
import Phaser from 'phaser';
import { atlasOf, frameScale, S } from '../art';
import { WORLD_W, WORLD_H } from '../layout';
import { sfx } from '../audio';
import { theme, themeEvents } from '../theme';
import type { WorldScene } from '../scenes/World';

export type MountPhase = 'off' | 'arrive' | 'ride' | 'land' | 'hop' | 'leave';

const RIDE_ALT = 72;
const SPEED = 150;
const FAST_SPEED = 360;
const FAST_MS = 3500;
const COOLDOWN_MS = 4000; // after fast mode ends
const DEPTH = 9300;
const SCALE = 0.85;
const EDGE = 70;

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

type Seg = { x0: number; y0: number; vx0: number; vy0: number; x1: number; y1: number; vx1: number; vy1: number; a0: number; a1: number; T: number; t: number; altEase: (t: number) => number };

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
  hopT = 0;
  hopFrom: [number, number] = [0, 0];
  riderOn = false;

  constructor(private w: WorldScene) {
    const sc = (k: string) => SCALE / (frameScale[k] ?? S);
    this.shadow = w.add.image(0, 0, atlasOf('shadow'), 'shadow').setDepth(-480).setVisible(false);
    this.wingFar = w.add.image(0, 0, atlasOf('eagle_wing_far'), 'eagle_wing_far').setOrigin(0.5, 0.96).setScale(sc('eagle_wing_far')).setDepth(DEPTH - 1).setVisible(false);
    this.body = w.add.image(0, 0, atlasOf('eagle_body'), 'eagle_body').setOrigin(0.5, 0.52).setScale(sc('eagle_body')).setDepth(DEPTH).setVisible(false);
    this.wing = w.add.image(0, 0, atlasOf('eagle_wing'), 'eagle_wing').setOrigin(0.5, 0.96).setScale(sc('eagle_wing')).setDepth(DEPTH + 2).setVisible(false);
    this.trail = w.add.particles(0, 0, atlasOf('spark'), {
      frame: 'spark', lifespan: 520, speed: { min: 4, max: 20 }, scale: { start: 0.5, end: 0 }, alpha: { start: 0.85, end: 0 },
      tint: [0xffffff, 0xdff3ff, 0xfff1c4], blendMode: 'ADD', frequency: 22, quantity: 2, emitting: false,
    }).setDepth(DEPTH - 2);
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

  /** Eagle is on screen at all. */
  get active() { return this.phase !== 'off'; }
  /** The eagle (not the walk code) moves the player. */
  get carrying() { return this.phase === 'arrive' || this.phase === 'ride' || this.phase === 'land' || this.phase === 'hop'; }
  get riding() { return this.phase === 'ride'; }
  /** Where the eagle is drawn (its body centre). */
  get ex() { return this.gx; }
  get ey() { return this.gy - this.alt; }

  /** Can the Call Mount button be used right now? */
  canCall() {
    const w = this.w;
    return this.phase === 'off' && !w.inWild && !w.locked && !w.village?.building && !w.buildView && !w.fishing?.active
      && !w.registry.get('dialogOpen') && !w.registry.get('menuOpen');
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
  call() {
    if (!this.canCall()) return false;
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
    this.target = this.pickWaypoint(); this.targetTime = 0;
    w.game.events.emit('mount', this.phase);
    w.game.events.emit('toast', 'Wheee! Tap the ground to hop off.');
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

  // ------------------------------------------------------------ per-frame
  stepSeg(dt: number) {
    const s = this.seg!;
    s.t = Math.min(1, s.t + dt / s.T);
    const t = s.t;
    const nx = hermite(s.x0, s.vx0, s.x1, s.vx1, t), ny = hermite(s.y0, s.vy0, s.y1, s.vy1, t);
    const dx = hermiteD(s.x0, s.vx0, s.x1, s.vx1, t) / s.T, dy = hermiteD(s.y0, s.vy0, s.y1, s.vy1, t) / s.T;
    this.gx = nx; this.gy = ny;
    this.alt = s.a0 + (s.a1 - s.a0) * s.altEase(t);
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
          this.steer(dt);
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
          if (this.stepSeg(dt)) { this.phase = 'off'; this.show(false); this.trail.stop(); w.game.events.emit('mount', 'off'); return; }
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
    const rate = this.phase === 'hop' ? 3.4 : fast ? 3.0 : this.phase === 'arrive' ? 1.2 : this.phase === 'leave' ? 2.4 : 1.7;
    if (this.phase === 'ride' && !fast && !paused) {
      this.nextGlide -= dt;
      if (this.nextGlide <= 0 && this.glide <= 0) { this.glide = 1.4 + Math.random(); this.nextGlide = 4 + Math.random() * 4; }
    }
    if (this.glide > 0) this.glide -= dt;
    const gTarget = this.glide > 0 || this.phase === 'arrive' && (this.seg?.t ?? 0) < 0.55 ? 1 : 0;
    this.glideAmt += (gTarget - this.glideAmt) * (1 - Math.exp(-dt * 4));
    this.flap += dt * Math.PI * 2 * rate * (1 - this.glideAmt * 0.85);
    const c = Math.cos(this.flap);
    const lift = c * (1 - this.glideAmt) + 0.6 * this.glideAmt; // glide: wings held up in a soaring V // 1 up, -1 down; glide holds wings level-ish
    const bob = Math.sin(this.flap) * 3.2 * (1 - this.glideAmt) + Math.sin(time / 600) * 1.5;
    const d = this.dir;
    const x = this.ex, y = this.ey + bob;
    const vy = Math.sin(this.heading) * this.speed;
    const tilt = Phaser.Math.Clamp(vy / 900, -0.14, 0.14) * d + (this.phase === 'hop' ? -0.12 * d : 0);
    const bs = SCALE / (frameScale.eagle_body ?? S);
    this.body.setPosition(x, y).setFlipX(d < 0).setRotation(tilt).setScale(bs);
    const ws = SCALE / (frameScale.eagle_wing ?? S);
    const sy = ws * (lift >= 0 ? 0.35 + 0.65 * lift : 0.35 + 0.95 * lift); // through 0 the wing flips to point down
    const sweep = d * (0.32 + 0.08 * Math.sin(this.flap));
    const cos = Math.cos(tilt), sin = Math.sin(tilt);
    const at = (ox: number, oy: number) => [x + (ox * d) * cos - oy * sin, y + (ox * d) * sin + oy * cos];
    const [nx, ny] = at(2 * SCALE, -7 * SCALE);
    this.wing.setPosition(nx, ny).setScale(ws, sy).setRotation(-sweep + tilt).setFlipX(d < 0);
    const [fx, fy] = at(9 * SCALE, -10 * SCALE);
    this.wingFar.setPosition(fx, fy).setScale(ws * 0.9, sy * 0.88).setRotation(-sweep * 1.15 + tilt).setFlipX(d < 0);
    // Shadow shrinks and fades with height.
    const k = 1 / (1 + this.alt / 140);
    this.shadow.setPosition(this.gx, this.gy + 4).setScale((96 * k / 64) / (frameScale.shadow ?? 1)).setAlpha((0.35 + 0.5 * k) * this.body.alpha);
    // Whoosh trail from the tail.
    const [tx, ty] = at(-48 * SCALE, 2);
    this.trail.setPosition(tx, ty);
    if (fast && !this.trail.emitting) this.trail.start(); else if (!fast && this.trail.emitting) this.trail.stop();
    // Rider sits on the eagle's back (legs tucked into the feathers).
    if (this.riderOn || this.phase === 'arrive' || this.phase === 'hop') this.drawRider(at, d, time);
  }

  drawRider(at: (ox: number, oy: number) => number[], d: number, time: number) {
    const w = this.w;
    const img = w.playerImg;
    const fw = img.frame.realWidth, fh = img.frame.realHeight;
    if (this.phase === 'arrive') return; // still standing on the ground, waiting
    const [bx, by] = at(-6 * SCALE, -10 * SCALE);
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
      phase: this.phase, riding: this.riding, carrying: this.carrying, riderOn: this.riderOn,
      fast: this.fastMs > 0, cooldown: Math.max(0, Math.round(this.cooldownMs)), ground: [Math.round(this.gx), Math.round(this.gy)],
      eagle: [Math.round(this.ex), Math.round(this.ey)], alt: Math.round(this.alt), speed: Math.round(this.speed),
      boosts: this.boosts, rides: this.rides, landings: this.landings, dropAt: this.dropAt ? this.dropAt.map(Math.round) : null,
      canCall: this.canCall(), reachable: this.reachList.length, seg: this.seg ? +this.seg.t.toFixed(2) : null,
      reachableHere: this.reach ? this.isReachable(this.w.feet.x, this.w.feet.y) : null,
    };
  }
}
