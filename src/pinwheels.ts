// 33: garden pinwheels. A few colorful pinwheels stand by the glade paths and turn in the breeze.
// Tap one (or walk right past it) and it whirls fast, then slowly settles. Faster on windy days.
// Hidden in the snowy themes (Christmas, Winter). Visual only.
import Phaser from 'phaser';
import { atlasOf, frameScale, mulberry32, pathDist } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
/** Resting spin (rad/s), extra on windy days, tap kick, walk-past kick, and how fast a kick fades. */
export const PW = { base: 1.4, windy: 4, tap: 12, walk: 7, max: 22, fade: 0.7, near: 70 };
type Wheel = { stick: Phaser.GameObjects.Image; head: Phaser.GameObjects.Image; boost: number; near: boolean; spin: number };

export class Pinwheels {
  wheels: Wheel[] = [];
  /** Taps and walk-past whirls so far (test hooks). */
  taps = 0;
  whooshes = 0;
  private lastX = 0; private lastY = 0;
  constructor(private w: WorldScene) {
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
    this.lastX = w.feet.x; this.lastY = w.feet.y;
  }

  /** A few grassy spots right beside the glade paths. */
  private place() {
    const w = this.w, rng = mulberry32(3333);
    const spots: [number, number][] = [];
    for (let tries = 0; tries < 2000 && spots.length < 6; tries++) {
      const x = 180 + rng() * 1680, y = 480 + rng() * 950;
      const pd = pathDist(x, y);
      if (pd < 42 || pd > 85 || !this.open(x, y)) continue;
      if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 220)) continue;
      spots.push([x, y]);
    }
    const tints = [0xffffff, 0xffe0f0, 0xe0f4ff, 0xfff4c8, 0xe8ffe0, 0xf4e8ff];
    spots.forEach(([x, y], i) => {
      const stick = w.add.image(x, y, atlasOf('pwstick'), 'pwstick').setOrigin(0.5, 1).setScale(1.9 / (frameScale.pwstick ?? 1)).setDepth(y);
      const head = w.add.image(x, y - 70, atlasOf('pwhead'), 'pwhead').setScale(2.1 / (frameScale.pwhead ?? 1)).setDepth(y + 0.5)
        .setTint(tints[i % tints.length]).setRotation(rng() * Math.PI * 2);
      const wh: Wheel = { stick, head, boost: 0, near: false, spin: 0 };
      this.wheels.push(wh);
      w.tappables.push({
        x: () => head.x, y: () => head.y + 10, r: 34, soft: true,
        enabled: () => head.visible,
        tap: () => this.whirl(wh),
      });
    });
  }

  private open(x: number, y: number) {
    const w = this.w, nav = w.nav;
    for (const [dx, dy] of [[0, 0], [-15, 0], [15, 0], [0, -20]]) {
      const [c, r] = nav.cellOf(x + dx, y + dy);
      if (nav.isBlocked(c, r)) return false;
    }
    if (w.interactables.some((it) => Math.hypot(it.x - x, it.y - y) < 120)) return false;
    if (w.canopies.some((c) => { const b = c.getBounds(); return x > b.x - 10 && x < b.right + 10 && y - 70 > b.y - 10 && y - 70 < b.bottom + 30; })) return false;
    const d = this.w.dandelions;
    if (d && d.puffs.some((p) => Math.hypot(p.img.x - x, p.img.y - y) < 90)) return false;
    return true;
  }

  whirl(wh: Wheel) {
    wh.boost = Math.min(PW.max, wh.boost + PW.tap);
    this.taps++;
    sfx.swish(); sfx.sparkle();
    this.w.burst(wh.head.x, wh.head.y, 0xfff2b0, 8, 'spark');
    if (this.w.life) this.w.life.reactions++;
  }

  get windy() { const v = this.w.village; return !!v && v.rain > 0 && v.weather.kind === 'wind'; }

  private retheme() {
    const show = !SNOWY.has(theme.id);
    for (const wh of this.wheels) { wh.stick.setVisible(show); wh.head.setVisible(show); }
  }

  update(dt: number) {
    const w = this.w, fx = w.feet.x, fy = w.feet.y;
    const moving = Math.hypot(fx - this.lastX, fy - this.lastY) > 0.5;
    this.lastX = fx; this.lastY = fy;
    const breeze = PW.base + (this.windy ? PW.windy : 0);
    for (const wh of this.wheels) {
      if (!wh.head.visible) continue;
      // Walking right past gives it a whoosh (once per pass).
      const near = Math.hypot(fx - wh.stick.x, fy - wh.stick.y) < PW.near;
      if (near && !wh.near && moving) { wh.boost = Math.max(wh.boost, PW.walk); this.whooshes++; }
      wh.near = near;
      wh.boost *= Math.exp(-PW.fade * dt);
      if (wh.boost < 0.05) wh.boost = 0;
      wh.spin = breeze + wh.boost + Math.sin(w.time.now / 900 + wh.stick.x) * 0.4;
      wh.head.rotation += wh.spin * dt;
    }
  }
}
