import Phaser from 'phaser';
import { THEMES, THEME_ORDER, theme, setTheme, themeEvents } from './theme';
import type { ThemeId } from './save';
import { atlasOf } from './art';
import { sfx } from './audio';

type Rect = { x: number; y: number; w: number; h: number };
const R = 28; // button radius (56 px), touch zone 68 px
const GAP = 66; // centre-to-centre spacing of the fanned-out choices

/**
 * HUD theme picker: one round button that shows the current theme. Tap it and the other themes
 * fan out to the right as big round buttons; tap one to switch, or tap anywhere else to fold them away.
 */
export class ThemePicker {
  readonly zones: Phaser.GameObjects.Zone[] = [];
  open = false;
  rects: { btn?: Rect } & Partial<Record<ThemeId, Rect>> = {};
  private main: Phaser.GameObjects.Container;
  private mainIcon: Phaser.GameObjects.Image;
  private mainZone: Phaser.GameObjects.Zone;
  private opts: { id: ThemeId; c: Phaser.GameObjects.Container; z: Phaser.GameObjects.Zone }[] = [];
  private x = 0; private y = 0;

  constructor(private scene: Phaser.Scene, private canUse: () => boolean = () => true) {
    const bg = scene.add.graphics();
    this.mainIcon = scene.add.image(0, 0, atlasOf(theme.icon), theme.icon);
    this.main = scene.add.container(0, 0, [bg, this.mainIcon]).setDepth(41);
    this.mainZone = scene.add.zone(0, 0, 68, 68).setInteractive(new Phaser.Geom.Circle(34, 34, 34), Phaser.Geom.Circle.Contains).setDepth(41);
    this.mainZone.on('pointerdown', () => {
      if (!this.canUse()) return;
      sfx.unlock();
      this.tweenPop(this.main);
      if (this.open) { this.close(); sfx.tock(); } else { this.show(); sfx.blip(); }
    });
    this.zones.push(this.mainZone);
    for (const id of THEME_ORDER) {
      const g = scene.add.graphics();
      const ic = scene.add.image(0, 0, atlasOf(THEMES[id].icon), THEMES[id].icon);
      const c = scene.add.container(0, 0, [g, ic]).setDepth(42).setVisible(false);
      const z = scene.add.zone(0, 0, 68, 68).setInteractive(new Phaser.Geom.Circle(34, 34, 34), Phaser.Geom.Circle.Contains).setDepth(42);
      z.input!.enabled = false;
      z.on('pointerdown', () => {
        if (!this.open) return;
        sfx.unlock();
        this.close();
        if (theme.id !== id) { setTheme(id); sfx.sparkle(); }
      });
      this.opts.push({ id, c, z });
      this.zones.push(z);
    }
    themeEvents.on('change', this.onTheme);
    scene.events.once('shutdown', () => themeEvents.off('change', this.onTheme));
    this.draw();
  }

  private onTheme = () => { this.draw(); if (this.open) this.layoutOpts(false); };

  private paint(g: Phaser.GameObjects.Graphics, id: ThemeId, big: boolean) {
    const t = THEMES[id], r = big ? R : R - 2;
    g.clear();
    g.fillStyle(0x2c2420, 0.3); g.fillCircle(0, 3, r + 1);
    g.fillStyle(big ? 0xf3e6cc : t.ui.tabOn, 0.96); g.fillCircle(0, 0, r);
    g.lineStyle(3.5, big ? t.ui.accentDark : 0xfffaf0, 1); g.strokeCircle(0, 0, r - 1);
  }

  private draw() {
    this.paint(this.main.list[0] as Phaser.GameObjects.Graphics, theme.id, true);
    this.mainIcon.setTexture(atlasOf(theme.icon), theme.icon).setDisplaySize(36, 36);
    for (const o of this.opts) {
      this.paint(o.c.list[0] as Phaser.GameObjects.Graphics, o.id, false);
      (o.c.list[1] as Phaser.GameObjects.Image).setDisplaySize(34, 34);
    }
  }

  private tweenPop(t: Phaser.GameObjects.Container) {
    this.scene.tweens.add({ targets: t, scale: { from: 0.85, to: 1 }, duration: 220, ease: 'Back.easeOut' });
  }

  /** The choices other than the current theme, fanned out to the right of the main button. */
  private layoutOpts(animate: boolean) {
    let i = 0;
    for (const k of THEME_ORDER) delete this.rects[k];
    for (const o of this.opts) {
      const on = o.id !== theme.id && this.open;
      o.c.setVisible(on); o.z.input!.enabled = on;
      if (!on) continue;
      i++;
      const ox = this.x + i * GAP, oy = this.y;
      o.z.setPosition(ox, oy);
      this.rects[o.id] = { x: ox - 34, y: oy - 34, w: 68, h: 68 };
      this.scene.tweens.killTweensOf(o.c);
      if (animate) {
        o.c.setPosition(this.x, oy).setScale(0.4).setAlpha(0);
        this.scene.tweens.add({ targets: o.c, x: ox, scale: 1, alpha: 1, duration: 200, delay: (i - 1) * 40, ease: 'Back.easeOut' });
      } else o.c.setPosition(ox, oy).setScale(1).setAlpha(1);
    }
  }

  show() { this.open = true; this.layoutOpts(true); }
  close() { this.open = false; this.layoutOpts(false); }

  layout(x: number, y: number) {
    this.x = x; this.y = y;
    this.main.setPosition(x, y); this.mainZone.setPosition(x, y);
    this.rects.btn = { x: x - 34, y: y - 34, w: 68, h: 68 };
    if (this.open) this.layoutOpts(false);
  }

  setVisible(v: boolean) {
    this.main.setVisible(v); this.mainZone.input!.enabled = v;
    if (!v && this.open) this.close();
  }
}
