// 82: Fall leaf piles. In Fall (and Halloween) a few crunchy leaf piles sit beside the glade paths.
// Walk through one or tap it and the leaves burst up with a crunch and flutter down, the pile goes
// flat, then it gently heaps back up a little later. Hidden in the other themes. Visual only.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, mulberry32, pathDist, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import type { WorldScene } from './scenes/World';

const AUTUMN = new Set(['fall', 'halloween']);
const COLS = ['#e8732c', '#d9452b', '#f2b636', '#b8572a', '#f08a3c'];
export const LEAVES = { near: 48, regrow: 7, size: 1.05 };
type Pile = { img: Phaser.GameObjects.Image; x: number; y: number; flat: number; near: boolean; base: number };

function mound(c: Ctx) {
  const rng = mulberry32(82);
  c.fillStyle = 'rgba(60,35,15,0.18)'; c.beginPath(); c.ellipse(60, 50, 54, 11, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 70; i++) {
    const t = rng(), u = rng();
    const x = 60 + (t - 0.5) * 100 * (1 - u * 0.55), y = 50 - u * 34 - rng() * 4;
    leaf(c, x, y, 6 + rng() * 4, rng() * Math.PI * 2, COLS[Math.floor(rng() * COLS.length)]);
  }
}
function leaf(c: Ctx, x: number, y: number, r: number, a: number, col: string) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = col; c.strokeStyle = 'rgba(90,40,15,0.55)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(0, -r * 0.8, r, 0); c.quadraticCurveTo(0, r * 0.8, -r, 0); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-r * 0.8, 0); c.lineTo(r * 0.8, 0); c.stroke();
  c.restore();
}

export class LeafPiles {
  piles: Pile[] = [];
  shown = false;
  /** Test hooks. */
  scatters = 0; taps = 0; walks = 0;
  private bits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastX = 0; private lastY = 0;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('leafpile')) {
      canvasTex(w, 'leafpile', 120, 60, mound, S, true);
      canvasTex(w, 'leafbit', 20, 14, (c) => leaf(c, 10, 7, 8, 0, '#ffffff'), S, true);
    }
    const bs = 1 / (frameScale.leafbit ?? S);
    this.bits = w.add.particles(0, 0, 'leafbit', {
      emitting: false, lifespan: { min: 1400, max: 2400 },
      speedX: { min: -120, max: 120 }, speedY: { min: -230, max: -90 }, gravityY: 210,
      rotate: { start: 0, end: { min: -540, max: 540 } } as any,
      scale: { min: bs * 0.8, max: bs * 1.3 },
      alpha: { values: [1, 1, 1, 0] } as any,
      tint: [0xe8732c, 0xd9452b, 0xf2b636, 0xb8572a, 0xf08a3c],
    } as any).setDepth(9300);
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
    this.lastX = w.feet.x; this.lastY = w.feet.y;
  }

  /** Four grassy spots right beside the glade paths, clear of pinwheels, dandelions and puzzles. */
  private place() {
    const w = this.w, rng = mulberry32(8282), spots: [number, number][] = [];
    for (let tries = 0; tries < 3000 && spots.length < 4; tries++) {
      const x = 200 + rng() * 1640, y = 500 + rng() * 930;
      const pd = pathDist(x, y);
      if (pd < 50 || pd > 95 || !this.open(x, y)) continue;
      if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 260)) continue;
      spots.push([x, y]);
    }
    for (const [x, y] of spots) {
      const base = LEAVES.size / (frameScale.leafpile ?? S);
      const img = w.add.image(x, y, 'leafpile').setOrigin(0.5, 0.85).setScale(base).setDepth(y - 6).setVisible(false);
      const p: Pile = { img, x, y, flat: 0, near: false, base };
      this.piles.push(p);
      w.tappables.push({ x: () => x, y: () => y - 14, r: 46, soft: true, enabled: () => this.shown && p.flat <= 0, tap: () => { this.taps++; this.scatter(p); } });
    }
  }

  private open(x: number, y: number) {
    const w = this.w, nav = w.nav;
    for (const [dx, dy] of [[0, 0], [-30, 0], [30, 0], [0, -15]]) { const [c, r] = nav.cellOf(x + dx, y + dy); if (nav.isBlocked(c, r)) return false; }
    if (w.interactables.some((it) => Math.hypot(it.x - x, it.y - y) < 130)) return false;
    if (w.tappables.some((t) => Math.hypot(t.x() - x, t.y() - y) < 110)) return false;
    if (w.canopies.some((c) => { const b = c.getBounds(); return x > b.x - 20 && x < b.right + 20 && y > b.y - 10 && y < b.bottom + 40; })) return false;
    return true;
  }

  scatter(p: Pile) {
    if (p.flat > 0) return;
    this.scatters++;
    p.flat = LEAVES.regrow;
    this.bits.emitParticleAt(p.x, p.y - 16, 22);
    sfx.crackle(); sfx.leafRustle(1.4);
    const w = this.w;
    w.tweens.killTweensOf(p.img);
    w.tweens.add({ targets: p.img, scaleY: p.base * 0.28, scaleX: p.base * 1.12, alpha: 0.55, duration: 220, ease: 'Quad.easeOut' });
  }

  private retheme() {
    this.shown = AUTUMN.has(theme.id);
    for (const p of this.piles) p.img.setVisible(this.shown);
  }

  update(dt: number) {
    const w = this.w, fx = w.feet.x, fy = w.feet.y;
    const moving = Math.hypot(fx - this.lastX, fy - this.lastY) > 0.5;
    this.lastX = fx; this.lastY = fy;
    if (!this.shown) return;
    for (const p of this.piles) {
      if (p.flat > 0) {
        p.flat -= dt;
        if (p.flat <= 0) { p.flat = 0; w.tweens.add({ targets: p.img, scaleY: p.base, scaleX: p.base, alpha: 1, duration: 900, ease: 'Back.easeOut' }); }
      }
      const near = Math.hypot(fx - p.x, (fy - p.y) * 1.4) < LEAVES.near;
      if (near && !p.near && moving && p.flat <= 0) { this.walks++; this.scatter(p); }
      p.near = near;
    }
  }

  stats() {
    return { shown: this.shown, scatters: this.scatters, taps: this.taps, walks: this.walks, list: this.piles.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), flat: p.flat > 0, visible: p.img.visible })) };
  }
}
