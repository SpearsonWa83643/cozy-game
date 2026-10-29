// 31: rain puddles. On rainy days (Spring rain, Summer sun shower) little puddles fill up around the
// glade and village; walk through one for a splash. When the rain stops they slowly dry up. Visual only.
import Phaser from 'phaser';
import { atlasOf, frameScale, mulberry32, pathDist } from './art';
import { sfx } from './audio';
import { waterAt } from './geo';
import type { WorldScene } from './scenes/World';

/** Seconds to fill while it rains, and to dry after it stops (tests shorten drying). */
export const PUDDLE_FILL_S = 6, PUDDLE_DRY_S = 30;
const WET = new Set(['rain', 'sunshower']);
type Puddle = { img: Phaser.GameObjects.Image; x: number; y: number; rx: number; ry: number; level: number; cool: number; base: number };

export class Puddles {
  puddles: Puddle[] = [];
  /** Splashes so far (test hook). */
  splashes = 0;
  dryS = PUDDLE_DRY_S;
  drops: Phaser.GameObjects.Particles.ParticleEmitter;
  private rainGap = 0;
  private lx = 0; private ly = 0;
  constructor(private w: WorldScene) {
    this.drops = w.add.particles(0, 0, atlasOf('p_drop'), {
      frame: 'p_drop', emitting: false, lifespan: { min: 380, max: 560 },
      speed: { min: 70, max: 150 }, angle: { min: 200, max: 340 }, gravityY: 520,
      scale: { start: 0.55, end: 0.3 }, alpha: { start: 0.9, end: 0 }, tint: [0xbfe4ff, 0xe8f6ff, 0x9fd0f2],
    } as any).setDepth(9300);
    this.place();
    this.lx = w.feet.x; this.ly = w.feet.y;
  }

  /** Open ground near the paths in the glade and village (not in the pond, not by doors or under trees). */
  private place() {
    const w = this.w, nav = w.nav, rng = mulberry32(3131);
    const spots: [number, number][] = [];
    for (let tries = 0; tries < 2000 && spots.length < 12; tries++) {
      const x = 180 + rng() * 2700, y = 420 + rng() * 1900;
      if (pathDist(x, y) > 90) continue; // by the paths, where you walk
      if (waterAt(x, y, -60)) continue;
      let blocked = false;
      for (const [dx, dy] of [[0, 0], [-30, 0], [30, 0], [0, -14], [0, 14]]) { const [c, r] = nav.cellOf(x + dx, y + dy); if (nav.isBlocked(c, r)) blocked = true; }
      if (blocked) continue;
      if (w.interactables.some((it) => Math.hypot(it.x - x, it.y - y) < 100)) continue;
      if (w.canopies.some((c) => { const b = c.getBounds(); return x > b.x && x < b.right && y > b.y && y < b.bottom + 20; })) continue;
      if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 220)) continue;
      spots.push([x, y]);
    }
    for (const [x, y] of spots) {
      const base = (0.9 + rng() * 0.5) / (frameScale.puddle ?? 1) * 1.5;
      const img = w.add.image(x, y, atlasOf('puddle'), 'puddle').setDepth(-290).setAlpha(0).setScale(base * 0.3).setVisible(false)
        .setFlipX(rng() < 0.5);
      this.puddles.push({ img, x, y, rx: 34 * base * (frameScale.puddle ?? 1) / 1.5, ry: 14 * base * (frameScale.puddle ?? 1) / 1.5, level: 0, cool: 0, base });
    }
  }

  get wet() { const v = this.w.village; return !!v && v.rain > 0 && WET.has(v.weather.kind ?? ''); }

  splash(p: Puddle) {
    const w = this.w;
    p.cool = 0.55;
    this.splashes++;
    this.drops.emitParticleAt(w.feet.x, w.feet.y - 2, 10);
    w.life?.ripple(w.feet.x, w.feet.y, 0.25, 0.7, 0.55, 600, true);
    sfx.splash(false);
  }

  update(dt: number) {
    const w = this.w, wet = this.wet;
    const fx = w.feet.x, fy = w.feet.y;
    const moved = Math.hypot(fx - this.lx, fy - this.ly) / Math.max(dt, 1e-3);
    this.lx = fx; this.ly = fy;
    const onFoot = !w.mount?.riding && !w.mount?.carrying && !w.boat?.active && !w.boat?.hopping;
    const view = w.cameras.main.worldView;
    if (wet) {
      this.rainGap -= dt;
    }
    for (const p of this.puddles) {
      const target = wet ? 1 : 0;
      if (p.level !== target) {
        p.level = wet ? Math.min(1, p.level + dt / PUDDLE_FILL_S) : Math.max(0, p.level - dt / this.dryS);
        const show = p.level > 0.01;
        p.img.setVisible(show);
        if (show) p.img.setAlpha(0.85 * Math.min(1, p.level * 1.6)).setScale(p.base * (0.3 + 0.7 * p.level), p.base * (0.3 + 0.7 * p.level));
      }
      p.cool = Math.max(0, p.cool - dt);
      if (p.level < 0.4) continue;
      // Raindrops plink rings on the puddles you can see.
      if (wet && this.rainGap <= 0 && view.contains(p.x, p.y) && Math.random() < 0.25) {
        w.life?.ripple(p.x + (Math.random() - 0.5) * p.rx, p.y + (Math.random() - 0.5) * p.ry, 0.08, 0.3, 0.45, 700, true);
      }
      if (!onFoot || p.cool > 0 || moved < 30) continue;
      const nx = (fx - p.x) / (p.rx * p.level), ny = (fy - p.y) / (p.ry * p.level + 4);
      if (nx * nx + ny * ny <= 1) this.splash(p);
    }
    if (wet && this.rainGap <= 0) this.rainGap = 0.18;
  }
}
