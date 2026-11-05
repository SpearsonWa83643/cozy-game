// 85: Meadow petal swirl. In Spring (and Summer), walking or riding through wildflower patches
// kicks up a short swirl of colored petals that drift and fade — like Fall leaf piles, but petals
// and lighter. Separate from Fall leaf piles. No new HUD icons.
import Phaser from 'phaser';
import { atlasOf, frameScale, mulberry32, pathDist } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { waterAt } from './geo';
import { VILLAGE_SIGN, POND, PLAYER_START, MEADOW_EDGE_Y } from './layout';
import type { WorldScene } from './scenes/World';

const ACTIVE = new Set(['spring', 'summer']);
export const PETAL = { near: 48, cool: 2.8, burst: 14 };
type Patch = {
  x: number; y: number; marker: Phaser.GameObjects.Image;
  cool: number; near: boolean; tint: number;
};

const TINTS = [0xff9ec8, 0xffe08a, 0xffffff, 0xc9a0ff, 0xffb070, 0xa8e8ff];

export class PetalSwirl {
  patches: Patch[] = [];
  /** Test hooks. */
  swirls = 0;
  shown = true;
  private lastX = 0; private lastY = 0;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  constructor(private w: WorldScene) {
    // Dedicated short swirl emitter using the existing petal frame.
    const tex = atlasOf('petal');
    this.emitter = w.add.particles(0, 0, tex, {
      frame: 'petal', emitting: false,
      lifespan: { min: 900, max: 1600 },
      speedX: { min: -55, max: 55 }, speedY: { min: -90, max: -25 },
      gravityY: 35, rotate: { min: -40, max: 40 },
      scale: { start: 2.2 / (frameScale.petal ?? 3), end: 1.1 / (frameScale.petal ?? 3) },
      alpha: { values: [1, 1, 0.7, 0] } as any,
      tint: TINTS,
    } as any).setDepth(9250);
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
    this.lastX = w.feet.x; this.lastY = w.feet.y;
  }

  private place() {
    const w = this.w, rng = mulberry32(8505);
    const seeds: [number, number][] = [
      [PLAYER_START.x + 160, PLAYER_START.y + 80],
      [PLAYER_START.x - 140, PLAYER_START.y + 40],
      [POND.x - 220, POND.y + 200],
      [POND.x + 240, POND.y + 160],
      [VILLAGE_SIGN.x + 160, VILLAGE_SIGN.y - 40],
      [VILLAGE_SIGN.x - 100, VILLAGE_SIGN.y + 120],
      [1100, 1400], [1500, 1280], [700, 1500],
      // A couple in the near meadow fringe (still reachable early).
      [2100, Math.min(MEADOW_EDGE_Y - 40, 1480)],
      [2400, 1350],
    ];
    const spots: [number, number][] = [];
    for (const [sx, sy] of seeds) {
      if (!this.open(sx, sy)) continue;
      if (spots.some(([x, y]) => Math.hypot(x - sx, y - sy) < 160)) continue;
      spots.push([sx, sy]);
    }
    // Fill a few more random grassy spots by paths in the glade/village.
    for (let tries = 0; tries < 800 && spots.length < 14; tries++) {
      const x = 200 + rng() * 2400, y = 450 + rng() * 1400;
      if (pathDist(x, y) < 50 || pathDist(x, y) > 110) continue;
      if (!this.open(x, y)) continue;
      if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 170)) continue;
      spots.push([x, y]);
    }
    spots.forEach(([x, y], i) => {
      // Tiny flower-cluster marker (reuses painted flower feel via a soft tinted spark-like image).
      const marker = w.add.image(x, y, atlasOf('petal'), 'petal')
        .setOrigin(0.5, 1).setScale(2.8 / (frameScale.petal ?? 3))
        .setTint(TINTS[i % TINTS.length]).setDepth(y - 2).setAlpha(0.95);
      // A couple sibling petals for a clump look.
      const a = w.add.image(x - 10, y + 2, atlasOf('petal'), 'petal').setOrigin(0.5, 1)
        .setScale(2.2 / (frameScale.petal ?? 3)).setTint(TINTS[(i + 2) % TINTS.length]).setDepth(y - 3).setAlpha(0.9);
      const b = w.add.image(x + 11, y + 1, atlasOf('petal'), 'petal').setOrigin(0.5, 1)
        .setScale(2.0 / (frameScale.petal ?? 3)).setTint(TINTS[(i + 4) % TINTS.length]).setDepth(y - 3).setAlpha(0.9);
      (marker as any)._sibs = [a, b];
      const p: Patch = { x, y, marker, cool: 0, near: false, tint: TINTS[i % TINTS.length] };
      this.patches.push(p);
    });
  }

  private open(x: number, y: number) {
    const w = this.w, nav = w.nav;
    if (waterAt(x, y, 20)) return false;
    for (const [dx, dy] of [[0, 0], [-20, 0], [20, 0], [0, -20]]) {
      const [c, r] = nav.cellOf(x + dx, y + dy);
      if (nav.isBlocked(c, r)) return false;
    }
    if (w.interactables.some((it) => Math.hypot(it.x - x, it.y - y) < 100)) return false;
    if (w.canopies.some((c) => { const b = c.getBounds(); return x > b.x - 8 && x < b.right + 8 && y > b.y - 8 && y < b.bottom + 24; })) return false;
    return true;
  }

  private swirl(p: Patch) {
    p.cool = PETAL.cool;
    this.swirls++;
    sfx.rustle(); sfx.swish();
    this.emitter.setParticleTint(p.tint);
    this.emitter.emitParticleAt(p.x, p.y - 8, PETAL.burst);
    // Extra multi-color bursts via World.burst for variety.
    this.w.burst(p.x, p.y - 10, p.tint, 8, 'petal');
    this.w.burst(p.x + 6, p.y - 14, TINTS[(this.swirls + 2) % TINTS.length], 6, 'petal');
    const sx = p.marker.scaleX, sy = p.marker.scaleY;
    this.w.tweens.add({ targets: p.marker, scaleX: sx * 1.2, scaleY: sy * 0.75, duration: 160, yoyo: true });
    if (this.w.life) this.w.life.reactions++;
  }

  private retheme() {
    this.shown = ACTIVE.has(theme.id);
    for (const p of this.patches) {
      p.marker.setVisible(this.shown);
      const sibs: Phaser.GameObjects.Image[] = (p.marker as any)._sibs ?? [];
      for (const s of sibs) s.setVisible(this.shown);
    }
  }

  update(dt: number) {
    if (!this.shown) return;
    const w = this.w, fx = w.feet.x, fy = w.feet.y;
    const moving = Math.hypot(fx - this.lastX, fy - this.lastY) > 0.5;
    this.lastX = fx; this.lastY = fy;
    for (const p of this.patches) {
      if (p.cool > 0) p.cool -= dt;
      const dx = fx - p.x, dy = (fy - (p.y - 6)) * 1.4;
      if (Math.abs(dx) > 140) { p.near = false; continue; }
      const near = Math.hypot(dx, dy) < PETAL.near;
      if (near && !p.near && moving && p.cool <= 0) this.swirl(p);
      p.near = near;
      // Gentle idle sway.
      if (p.marker.visible) p.marker.setRotation(Math.sin(w.time.now / 700 + p.x) * 0.08);
    }
  }

  stats() {
    return {
      swirls: this.swirls, shown: this.shown, theme: theme.id,
      list: this.patches.map((p) => ({
        x: Math.round(p.x), y: Math.round(p.y), cool: +p.cool.toFixed(2),
        visible: p.marker.visible,
      })),
    };
  }
}
