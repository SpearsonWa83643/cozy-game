// 28: dandelion clocks in the glade meadow. Tap one to blow its seeds away on the breeze; it grows
// a new fluffy head after a while. Hidden in the snowy themes (Christmas, Winter). Visual only.
import Phaser from 'phaser';
import { atlasOf, frameScale, mulberry32, pathDist } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import type { WorldScene } from './scenes/World';

export const DANDELION_REGROW_MS = 25_000;
type Puff = { img: Phaser.GameObjects.Image; full: boolean; at: number };
const SNOWY = new Set(['christmas', 'winter']);

export class Dandelions {
  puffs: Puff[] = [];
  /** Seed clouds blown so far (test hook). */
  blown = 0;
  regrowMs = DANDELION_REGROW_MS;
  seeds: Phaser.GameObjects.Particles.ParticleEmitter;
  constructor(private w: WorldScene) {
    this.seeds = w.add.particles(0, 0, atlasOf('dseed'), {
      frame: 'dseed', emitting: false,
      lifespan: { min: 2600, max: 4200 },
      speedX: { min: 25, max: 85 }, speedY: { min: -55, max: -15 },
      gravityY: -6, rotate: { min: -25, max: 25 },
      scale: { start: 1.9 / (frameScale.dseed ?? 1), end: 1.5 / (frameScale.dseed ?? 1) },
      alpha: { values: [1, 1, 0.8, 0] } as any,
    } as any).setDepth(9300);
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  /** A handful of open grassy spots in the glade (off the paths, away from doors, trees and water). */
  private place() {
    const w = this.w, rng = mulberry32(2810);
    const spots: [number, number][] = [];
    for (let tries = 0; tries < 600 && spots.length < 9; tries++) {
      const x = 160 + rng() * 1700, y = 480 + rng() * 950;
      if (!this.open(x, y)) continue;
      if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 150)) continue;
      spots.push([x, y]);
    }
    for (const [x, y] of spots) {
      const img = w.add.image(x, y, atlasOf('dandelion'), 'dandelion').setOrigin(0.5, 1).setScale(1.6 / (frameScale.dandelion ?? 1)).setDepth(y);
      w.sway(img, 0.05, 0.9 + rng() * 0.4);
      const p: Puff = { img, full: true, at: 0 };
      this.puffs.push(p);
      w.tappables.push({
        x: () => img.x, y: () => img.y - 34, r: 30, soft: true,
        enabled: () => img.visible,
        tap: () => this.blow(p),
      });
    }
  }

  private open(x: number, y: number) {
    const w = this.w, nav = w.nav;
    if (pathDist(x, y) < 45) return false;
    for (const [dx, dy] of [[0, 0], [-25, 0], [25, 0], [0, -25], [0, 25]]) {
      const [c, r] = nav.cellOf(x + dx, y + dy);
      if (nav.isBlocked(c, r)) return false;
    }
    if (w.interactables.some((it) => Math.hypot(it.x - x, it.y - y) < 110)) return false;
    if (w.canopies.some((c) => { const b = c.getBounds(); return x > b.x - 10 && x < b.right + 10 && y > b.y - 10 && y < b.bottom + 30; })) return false;
    return true;
  }

  blow(p: Puff) {
    const w = this.w, img = p.img;
    const sw = w.swayerOf.get(img);
    if (sw) sw.kick = 1;
    if (!p.full) {
      // Just a stem: a little wiggle.
      const sx = img.scaleX;
      w.tweens.add({ targets: img, scaleX: sx * 1.15, duration: 120, yoyo: true, onComplete: () => img.setScale(sx, img.scaleY) });
      sfx.blip();
      return;
    }
    p.full = false; p.at = w.time.now + this.regrowMs;
    img.setTexture(atlasOf('dandelion_bare'), 'dandelion_bare');
    this.seeds.emitParticleAt(img.x, img.y - 34, 18);
    this.blown++;
    sfx.rustle(); sfx.sparkle();
    if (w.life) w.life.reactions++;
  }

  private retheme() {
    const show = !SNOWY.has(theme.id);
    for (const p of this.puffs) p.img.setVisible(show).setTint(theme.id === 'halloween' ? 0xd8c8ec : 0xffffff);
  }

  update() {
    const now = this.w.time.now;
    for (const p of this.puffs) {
      if (p.full || now < p.at) continue;
      p.full = true;
      const img = p.img, s = img.scaleX;
      img.setTexture(atlasOf('dandelion'), 'dandelion').setScale(s * 0.4);
      this.w.tweens.add({ targets: img, scaleX: s, scaleY: s, duration: 500, ease: 'Back.easeOut' });
    }
  }
}
