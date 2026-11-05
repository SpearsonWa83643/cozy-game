// 86: Beach sandcastle. One sandcastle spot on the Seashell Bay beach (clear of crabs/starfish/
// shell pickups). Tap to build stages 1→2→3 with scoop sounds; at full a little flag waves. The
// tide gradually washes it back down after a while; rebuildable. Visual only, kid-simple.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { BAY, WORLD_W, WORLD_H } from './layout';
import { lakeValue } from './geo';
import type { WorldScene } from './scenes/World';

const TW = 96, TH = 78;
/** Seconds the castle stays full before the tide starts nibbling; wash stage length. */
export const CASTLE = { hold: 18, wash: 5, size: 1.2 };
/** Tests may shorten hold/wash timings. */
export const castleTiming = { hold: CASTLE.hold, wash: CASTLE.wash };
type Stage = 0 | 1 | 2 | 3;

function paint(c: Ctx, stage: Stage, flagWave = 0) {
  // Sand base mound always.
  c.fillStyle = '#e8c98a'; c.strokeStyle = '#b8894a'; c.lineWidth = 2.2;
  c.beginPath(); c.ellipse(48, 66, 40, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  if (stage < 1) {
    // Just a scooped dent / empty spot hint.
    c.fillStyle = 'rgba(180,140,80,0.35)';
    c.beginPath(); c.ellipse(48, 64, 18, 5, 0, 0, Math.PI * 2); c.fill();
    return;
  }
  // Main keep.
  c.fillStyle = '#f0d29a'; c.strokeStyle = '#b8894a'; c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(32, 34); c.lineTo(64, 34); c.lineTo(68, 38); c.lineTo(68, 66); c.lineTo(28, 66); c.lineTo(28, 38); c.closePath();
  c.fill(); c.stroke();
  // Battlements.
  c.fillStyle = '#e8c98a';
  for (const x of [28, 40, 52, 60]) { c.fillRect(x, 28, 8, 8); c.strokeRect(x, 28, 8, 8); }
  // Door.
  c.fillStyle = '#c99555'; c.beginPath(); c.arc(48, 66, 7, Math.PI, 0); c.fill();
  if (stage >= 2) {
    // Side towers.
    for (const sx of [14, 70]) {
      c.fillStyle = '#f0d29a'; c.strokeStyle = '#b8894a';
      c.fillRect(sx, 40, 14, 26); c.strokeRect(sx, 40, 14, 26);
      c.fillRect(sx - 1, 34, 16, 8); c.strokeRect(sx - 1, 34, 16, 8);
    }
  }
  if (stage >= 3) {
    // Flag pole + waving flag.
    c.strokeStyle = '#8b5a2b'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(48, 28); c.lineTo(48, 8); c.stroke();
    const wave = Math.sin(flagWave) * 3;
    c.fillStyle = '#ff6b8a'; c.strokeStyle = '#c43a5a'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(48, 8); c.lineTo(68 + wave, 12); c.lineTo(48, 18); c.closePath(); c.fill(); c.stroke();
    // Tiny heart on flag.
    c.fillStyle = '#fff'; c.beginPath(); c.arc(56 + wave * 0.4, 12.5, 1.6, 0, Math.PI * 2); c.fill();
  }
  // Shell decoration.
  if (stage >= 2) {
    c.fillStyle = '#fff0e0'; c.beginPath(); c.ellipse(38, 50, 4, 3, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(58, 52, 3.5, 2.5, 0.2, 0, Math.PI * 2); c.fill();
  }
}

export class Sandcastle {
  img!: Phaser.GameObjects.Image;
  x = 0; y = 0;
  stage: Stage = 0;
  /** Test hooks. */
  taps = 0; builds = 0; washes = 0;
  /** Time left at full before wash; wash progress 0..1 when eroding. */
  hold = 0; wash = 0;
  private flagPh = 0;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('scastle0')) {
      for (const s of [0, 1, 2, 3] as Stage[]) {
        canvasTex(w, `scastle${s}`, TW, TH, (c) => paint(c, s, 0), S, true);
      }
      // Extra waving-flag frames for stage 3.
      canvasTex(w, 'scastle3a', TW, TH, (c) => paint(c, 3, 1.2), S, true);
      canvasTex(w, 'scastle3b', TW, TH, (c) => paint(c, 3, 2.4), S, true);
    }
    this.place();
    const base = CASTLE.size / (frameScale.scastle0 ?? S);
    this.img = w.add.image(this.x, this.y, 'scastle0').setOrigin(0.5, 1).setScale(base).setDepth(this.y);
    w.tappables.push({
      x: () => this.x, y: () => this.y - 28, r: 50,
      tap: () => this.tap(),
    });
  }

  private sand(x: number, y: number) {
    return x > 150 && x < WORLD_W - 150 && y > 150 && y < WORLD_H - 100 && lakeValue(x, y) > 1.08;
  }

  private place() {
    const w = this.w;
    const busy: [number, number][] = [
      ...w.interactables.map((it) => [it.x, it.y] as [number, number]),
      ...w.tappables.map((t) => [t.x(), t.y()] as [number, number]),
    ];
    if (w.crabs) for (const c of w.crabs.crabs) busy.push([c.x, c.y]);
    if (w.starfish) {
      busy.push([w.starfish.cx, w.starfish.cy]);
      for (const s of w.starfish.stars) busy.push([s.x, s.y]);
    }
    const clear = (x: number, y: number) => busy.every(([bx, by]) => Math.hypot(bx - x, by - y) > 220);
    // Prefer the south-east beach arc (away from north crabs and east starfish ring).
    const tries: [number, number][] = [];
    for (const a of [0.55, 0.7, 0.4, 0.85, 0.25, 1.0, 0.15, 1.15, -0.1]) {
      for (const k of [1.18, 1.24, 1.12, 1.3]) {
        tries.push([BAY.x + Math.cos(a) * BAY.rx * k, BAY.y + Math.sin(a) * BAY.ry * k]);
      }
    }
    let found = false;
    for (const [x, y] of tries) {
      if (this.sand(x, y) && clear(x, y)) { this.x = x; this.y = y; found = true; break; }
    }
    if (!found) { this.x = BAY.x + BAY.rx * 0.55; this.y = BAY.y + BAY.ry * 1.15; }
    this.x = Math.round(this.x); this.y = Math.round(this.y);
  }

  tap() {
    this.taps++;
    if (this.wash > 0) {
      // Scoop while washing rebuilds a bit.
      this.wash = 0; this.hold = castleTiming.hold * 0.4;
      sfx.dig(); sfx.plip();
      this.w.burst(this.x, this.y - 20, 0xf0d29a, 6, 'spark');
      return;
    }
    if (this.stage >= 3) {
      // Happy pat on the finished castle.
      sfx.tock(); sfx.giggleSoft(1.5);
      this.w.burst(this.x, this.y - 50, 0xff9ec8, 8, 'spark');
      this.flagPh += 2;
      return;
    }
    this.stage = (this.stage + 1) as Stage;
    this.builds++;
    this.img.setTexture(`scastle${this.stage}`);
    sfx.dig();
    if (this.stage === 3) {
      this.hold = castleTiming.hold;
      sfx.sparkle(); sfx.bell(988, 0, 0.08, 1.2);
      this.w.floatText(this.x, this.y - 90, 'Sandcastle!', '#ffe08a');
      this.w.burst(this.x, this.y - 40, 0xffe08a, 14, 'spark');
    } else {
      sfx.plip();
      this.w.burst(this.x, this.y - 24, 0xf0d29a, 8, 'spark');
    }
    const sx = this.img.scaleX, sy = this.img.scaleY;
    this.img.setScale(sx * 1.12, sy * 0.88);
    this.w.tweens.add({ targets: this.img, scaleX: sx, scaleY: sy, duration: 280, ease: 'Back.easeOut' });
    if (this.w.life) this.w.life.reactions++;
  }

  update(dt: number) {
    const w = this.w, v = w.cameras.main.worldView;
    const vis = this.x > v.x - 100 && this.x < v.right + 100 && this.y > v.y - 100 && this.y < v.bottom + 100;
    this.img.setVisible(vis);
    if (!vis) return;
    this.flagPh += dt;
    if (this.stage === 3 && this.wash <= 0) {
      const frame = Math.sin(this.flagPh * 4) > 0 ? 'scastle3a' : 'scastle3b';
      if (this.img.texture.key !== frame) this.img.setTexture(frame);
    }
    if (this.stage === 3 && this.wash <= 0) {
      this.hold -= dt;
      if (this.hold <= 0) { this.wash = castleTiming.wash; }
    }
    if (this.wash > 0) {
      this.wash -= dt;
      const t = 1 - Math.max(0, this.wash) / castleTiming.wash;
      // Shrink through stages as the tide washes.
      const want: Stage = t > 0.75 ? 0 : t > 0.45 ? 1 : t > 0.2 ? 2 : 3;
      if (want !== this.stage) {
        this.stage = want;
        this.img.setTexture(`scastle${this.stage}`);
        sfx.splash(false);
        this.w.burst(this.x, this.y - 10, 0xbfe8ff, 5, 'spark');
      }
      if (this.wash <= 0) {
        this.wash = 0; this.stage = 0; this.img.setTexture('scastle0');
        this.washes++;
        sfx.splash(true);
        this.w.burst(this.x, this.y - 8, 0xbfe8ff, 10, 'spark');
      }
    }
    this.img.setDepth(this.y);
  }


  stats() {
    return {
      taps: this.taps, builds: this.builds, washes: this.washes,
      stage: this.stage, hold: +this.hold.toFixed(2), wash: +this.wash.toFixed(2),
      x: Math.round(this.x), y: Math.round(this.y),
      tex: this.img.texture.key, visible: this.img.visible,
    };
  }
}
