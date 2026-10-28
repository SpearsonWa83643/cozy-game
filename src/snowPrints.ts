// 29: in the snowy themes (Christmas, Winter) your hero leaves little footprints that slowly fade.
// Visual only: a small pool of print images is recycled, so long walks never pile up.
import Phaser from 'phaser';
import { atlasOf, frameScale } from './art';
import { theme, themeEvents } from './theme';
import { waterAt } from './geo';
import type { WorldScene } from './scenes/World';

export const PRINT_FADE_MS = 10000;
const MAX = 48;
const SNOWY = new Set(['christmas', 'winter']);

export class SnowPrints {
  pool: Phaser.GameObjects.Image[] = [];
  next = 0;
  left = false;
  /** Prints made so far (test hook). */
  made = 0;
  constructor(private w: WorldScene) {
    const off = () => { if (!this.snowy) this.clear(); };
    themeEvents.on('change', off);
    w.events.once('shutdown', () => themeEvents.off('change', off));
  }

  get snowy() { return SNOWY.has(theme.id); }

  /** Called on each footstep with the walking direction (radians). */
  step(x: number, y: number, dir: number) {
    if (!this.snowy || waterAt(x, y)) return;
    let img = this.pool[this.next];
    if (!img) {
      img = this.w.add.image(0, 0, atlasOf('sprint'), 'sprint').setDepth(-280);
      this.pool[this.next] = img;
    }
    this.next = (this.next + 1) % MAX;
    this.left = !this.left;
    const side = this.left ? -6 : 6;
    const px = x + Math.cos(dir + Math.PI / 2) * side, py = y + 2 + Math.sin(dir + Math.PI / 2) * side;
    const s = 1.9 / (frameScale.sprint ?? 1);
    this.w.tweens.killTweensOf(img);
    img.setPosition(px, py).setRotation(dir + Math.PI / 2).setScale(s).setAlpha(0.8).setVisible(true)
      .setTint(theme.id === 'christmas' ? 0x7a90b0 : 0x6c84a6);
    this.w.tweens.add({ targets: img, alpha: 0, delay: PRINT_FADE_MS * 0.5, duration: PRINT_FADE_MS * 0.5, onComplete: () => img.setVisible(false) });
    this.made++;
  }

  /** Visible prints right now (test hook). */
  visible() { return this.pool.filter((p) => p.visible && p.alpha > 0.02).length; }

  /** Theme switched away from snow: clear prints. */
  clear() { for (const p of this.pool) { this.w.tweens.killTweensOf(p); p.setVisible(false); } }
}
