// 92: Glowcap puff mushrooms. Five bouncy mushrooms sit around the Glowcap Grove fairy ring (on
// the rim, never the ring centre). Tap one: it squashes, bounces back with a spore puff and a soft
// pop, then settles. All themes (the grove glows year-round). Culled off-screen.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { GROVE_RING } from './layout';
import type { WorldScene } from './scenes/World';

const TW = 56, TH = 56;
export const PUFF = { size: 1.35, n: 5, bounceS: 0.9 };
const CAPS = ['#ff7a9a', '#b98cff', '#5cc8ff', '#ffb84d', '#7ad87a'];
type Shroom = {
  img: Phaser.GameObjects.Image; x: number; y: number; base: number;
  bounce: number; ph: number; on: boolean; cool: number;
};

function shroomTex(c: Ctx, cap: string) {
  // Stem.
  c.fillStyle = '#fff4e0'; c.strokeStyle = '#8a6a50'; c.lineWidth = 1.8;
  c.beginPath(); c.roundRect(21, 28, 14, 24, 6); c.fill(); c.stroke();
  // Cap.
  c.fillStyle = cap; c.strokeStyle = '#5a3a5a'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(28, 28, 24, 16, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
  // Spots.
  c.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, r] of [[18, 20, 3.5], [30, 15, 4], [40, 22, 3], [26, 24, 2.2]] as const) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  // Cute face.
  c.fillStyle = '#3a2a30';
  c.beginPath(); c.arc(25, 38, 1.6, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(31, 38, 1.6, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#3a2a30'; c.lineWidth = 1.2;
  c.beginPath(); c.arc(28, 41, 2.2, 0.2, Math.PI - 0.2); c.stroke();
  c.fillStyle = 'rgba(255,140,160,0.5)';
  c.beginPath(); c.arc(22, 41, 2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(34, 41, 2, 0, Math.PI * 2); c.fill();
}

export class Puffshrooms {
  shrooms: Shroom[] = [];
  /** Test hooks. */
  taps = 0; puffs = 0; shown = true;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('puffshroom0')) CAPS.forEach((cap, i) => canvasTex(w, `puffshroom${i}`, TW, TH, (c) => shroomTex(c, cap), S, true));
    this.place();
  }

  private place() {
    const w = this.w;
    const busy = [...w.interactables.map((it) => [it.x, it.y]), ...w.tappables.map((t) => [t.x(), t.y()])];
    const homes: [number, number][] = [];
    for (let i = 0; i < 120 && homes.length < PUFF.n; i++) {
      const a = 0.4 + i * 2.39996;
      const k = 1.08 + ((i * 7) % 6) * 0.07;
      const x = GROVE_RING.x + Math.cos(a) * GROVE_RING.r * k;
      const y = GROVE_RING.y + Math.sin(a) * GROVE_RING.r * k * 0.75;
      const [c, r] = w.nav.cellOf(x, y);
      if (w.nav.isBlocked(c, r)) continue;
      if (!busy.every(([bx, by]) => Math.hypot(bx - x, by - y) > 70)) continue;
      if (homes.some(([hx, hy]) => Math.hypot(hx - x, hy - y) < 95)) continue;
      homes.push([x, y]);
    }
    homes.forEach(([x, y], i) => {
      const key = `puffshroom${i % CAPS.length}`;
      const base = PUFF.size / (frameScale[key] ?? S);
      const img = w.add.image(x, y, key).setOrigin(0.5, 0.95).setScale(base).setDepth(y).setVisible(false);
      const s: Shroom = { img, x, y, base, bounce: 0, ph: i * 1.3, on: false, cool: 0 };
      this.shrooms.push(s);
      w.tappables.push({ x: () => s.x, y: () => s.y - 24, r: 40, soft: true, enabled: () => s.on, tap: () => this.tap(s) });
    });
  }

  tap(s: Shroom) {
    if (s.cool > 0) return;
    this.taps++; this.puffs++;
    s.bounce = 1; s.cool = 0.35;
    sfx.plip(); sfx.blip();
    const tint = [0xffb0c8, 0xd8c0ff, 0xb0e8ff, 0xffe0a0, 0xc0f0b0][this.shrooms.indexOf(s) % 5];
    this.w.burst(s.x, s.y - 40, tint, 10, 'spark');
    if (this.w.life) this.w.life.reactions++;
  }

  update(dt: number) {
    const v = this.w.cameras.main.worldView, now = this.w.time.now / 1000;
    for (const s of this.shrooms) {
      if (s.cool > 0) s.cool -= dt;
      const vis = s.x > v.x - 80 && s.x < v.right + 80 && s.y > v.y - 40 && s.y - 60 < v.bottom;
      if (!vis) { if (s.on) { s.on = false; s.img.setVisible(false); } continue; }
      if (!s.on) { s.on = true; s.img.setVisible(true); }
      let sx = 1, sy = 1;
      if (s.bounce > 0) {
        s.bounce = Math.max(0, s.bounce - dt / PUFF.bounceS);
        const t = 1 - s.bounce;
        // Squash first, then a springy wobble that settles.
        const q = t < 0.18 ? -Math.sin((t / 0.18) * Math.PI / 2) * 0.35 : Math.sin((t - 0.18) * 14) * 0.25 * (1 - t);
        sy = 1 + q; sx = 1 - q * 0.6;
      } else {
        const breathe = Math.sin(now * 1.6 + s.ph) * 0.02;
        sy = 1 + breathe; sx = 1 - breathe * 0.5;
      }
      s.img.setScale(s.base * sx, s.base * sy);
    }
  }

  stats() {
    return {
      taps: this.taps, puffs: this.puffs, shown: this.shown,
      list: this.shrooms.map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), on: s.on, bouncing: s.bounce > 0, visible: s.img.visible, ringD: Math.round(Math.hypot(s.x - GROVE_RING.x, s.y - GROVE_RING.y)) })),
    };
  }
}
