// Wilderness HUD: a big Home button (always there), hearts, the swing button and a loot bag count.
import Phaser from 'phaser';
import { ATLAS, frameScale, atlasOf } from '../art';
import { DPR } from '../dpr';
import { safeInsets } from '../device';
import { theme, themeEvents } from '../theme';
import { ATLAS3 } from '../wild/wart';
import type { WildScene } from './Wild';

const FONT = 'Nunito, "Trebuchet MS", sans-serif';
const INK = '#4a3426';

export class WildUIScene extends Phaser.Scene {
  w = 0; h = 0;
  homeC!: Phaser.GameObjects.Container;
  homeBg!: Phaser.GameObjects.Graphics;
  toastC!: Phaser.GameObjects.Container;
  toastBg!: Phaser.GameObjects.Graphics;
  toastText!: Phaser.GameObjects.Text;
  /** Screen-space hit rects for tests. */
  rects: Record<string, { x: number; y: number; w: number; h: number }> = {};
  onTheme = () => this.paintButtons();
  heartsC!: Phaser.GameObjects.Container;
  heartImgs: Phaser.GameObjects.Image[] = [];
  atkC!: Phaser.GameObjects.Container;
  atkBg!: Phaser.GameObjects.Graphics;
  bagC!: Phaser.GameObjects.Container;
  bagTexts: Record<string, Phaser.GameObjects.Text> = {};

  constructor() { super('wildui'); }
  get wild() { return this.scene.get('wild') as WildScene; }

  create() {
    const cam = this.cameras.main;
    cam.setOrigin(0, 0).setZoom(DPR);
    this.rects = {};

    // Home button: big, round, top-left.
    this.homeC = this.add.container(0, 0);
    this.homeBg = this.add.graphics();
    const icon = this.add.image(0, -6, ATLAS3, 'w_home').setScale(0.62 / (frameScale.w_home ?? 3));
    const lbl = this.add.text(0, 30, 'Home', { fontFamily: FONT, fontSize: '17px', fontStyle: '800', color: INK }).setOrigin(0.5).setResolution(DPR * 2);
    this.homeC.add([this.homeBg, icon, lbl]);
    const hz = this.add.zone(0, 0, 104, 104).setInteractive();
    this.homeC.add(hz);
    hz.on('pointerdown', (p: Phaser.Input.Pointer) => { p.event?.stopPropagation?.(); this.tweens.add({ targets: this.homeC, scale: 0.9, duration: 80, yoyo: true }); });
    hz.on('pointerup', () => this.wild.goHome('button'));

    // Hearts.
    this.heartsC = this.add.container(0, 0);
    const pill = this.add.graphics();
    pill.fillStyle(0xfff6e4, 0.92).fillRoundedRect(-14, -26, 3 * 46 + 18, 52, 26);
    this.heartsC.add(pill);
    this.heartImgs = [];
    for (let i = 0; i < 3; i++) {
      const h = this.add.image(10 + i * 46, 0, ATLAS, 'heart').setScale(36 / (12 * (frameScale.heart ?? 3)));
      this.heartImgs.push(h); this.heartsC.add(h);
    }
    this.setHearts(this.wild.hearts, false);
    this.wild.events.on('hearts', this.setHearts, this);

    // Swing button: big, round, bottom-right.
    this.atkC = this.add.container(0, 0);
    this.atkBg = this.add.graphics();
    const wand = this.add.image(0, -8, ATLAS3, 'w_wand').setScale(0.95 / (frameScale.w_wand ?? 3));
    const al = this.add.text(0, 36, 'Bop!', { fontFamily: FONT, fontSize: '19px', fontStyle: '800', color: INK }).setOrigin(0.5).setResolution(DPR * 2);
    this.atkC.add([this.atkBg, wand, al]);
    const az = this.add.zone(0, 0, 130, 130).setInteractive();
    this.atkC.add(az);
    az.on('pointerdown', () => { this.wild.swing(); this.tweens.add({ targets: this.atkC, scale: 0.88, duration: 70, yoyo: true }); });

    // Trip bag: what you found this trip (it all comes home with you).
    this.bagC = this.add.container(0, 0);
    const bp = this.add.graphics();
    bp.fillStyle(0xfff6e4, 0.94).fillRoundedRect(0, -30, 200, 60, 30).lineStyle(3, 0xd9b98f, 1).strokeRoundedRect(0, -30, 200, 60, 30);
    this.bagC.add(bp);
    this.bagTexts = {};
    ['glowmoss', 'starshard'].forEach((k, i) => {
      const f = `l_${k}`;
      const ic = this.add.image(32 + i * 96, 0, atlasOf(f), f).setDisplaySize(40, 40);
      const t = this.add.text(56 + i * 96, 0, '0', { fontFamily: FONT, fontSize: '24px', fontStyle: '900', color: INK }).setOrigin(0, 0.5).setResolution(DPR * 2);
      this.bagTexts[k] = t;
      this.bagC.add([ic, t]);
    });
    this.wild.events.on('bag', this.setBag, this);

    // Toast.
    this.toastC = this.add.container(0, 0).setAlpha(0).setDepth(50);
    this.toastBg = this.add.graphics();
    this.toastText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '20px', fontStyle: '800', color: INK }).setOrigin(0.5).setResolution(DPR * 2);
    this.toastC.add([this.toastBg, this.toastText]);
    this.wild.events.on('toast', this.toast, this);

    this.paintButtons();
    this.layout();
    this.scale.on('resize', this.layout, this);
    themeEvents.on('change', this.onTheme);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this); themeEvents.off('change', this.onTheme);
      this.wild.events.off('toast', this.toast, this); this.wild.events.off('hearts', this.setHearts, this); this.wild.events.off('bag', this.setBag, this);
    });
    this.cameras.main.fadeIn(500);
    this.time.delayedCall(700, () => this.toast(theme.id === 'halloween' ? 'Spooky woods! Stay cozy.' : 'The Wild Woods! Explore!'));
  }

  setBag(bag: Record<string, number>) {
    for (const k of Object.keys(this.bagTexts)) {
      const t = this.bagTexts[k]; const v = `${bag[k] ?? 0}`;
      if (t.text !== v) { t.setText(v); this.tweens.add({ targets: t, scale: { from: 1.5, to: 1 }, duration: 300, ease: 'Back.easeOut' }); }
    }
  }

  setHearts(n: number, animate = true) {
    this.heartImgs.forEach((h, i) => {
      const full = i < n;
      if (full) h.clearTint().setAlpha(1); else h.setTint(0x8a7f86).setAlpha(0.45);
      if (animate && i === n) this.tweens.add({ targets: h, scale: { from: h.scale * 1.6, to: h.scale }, duration: 300, ease: 'Back.easeOut' });
    });
  }

  paintButtons() {
    const a = this.atkBg; a.clear();
    a.fillStyle(0x000000, 0.2); a.fillCircle(0, 6, 62);
    a.fillStyle(theme.ui.accent, 1); a.fillCircle(0, 0, 62);
    a.fillStyle(0xffffff, 0.25); a.fillCircle(-14, -18, 34);
    a.lineStyle(5, 0xfff6e4, 1); a.strokeCircle(0, 0, 58);
    const g = this.homeBg; g.clear();
    g.fillStyle(0x000000, 0.18); g.fillCircle(0, 5, 50);
    g.fillStyle(0xfff6e4, 1); g.fillCircle(0, 0, 50);
    g.lineStyle(5, theme.ui.accent, 1); g.strokeCircle(0, 0, 47);
  }

  layout() {
    this.w = this.scale.width / DPR; this.h = this.scale.height / DPR;
    this.cameras.main.setZoom(DPR);
    const si = safeInsets();
    const hx = 70 + si.left, hy = 70 + si.top;
    this.homeC.setPosition(hx, hy);
    this.rects.home = { x: hx - 50, y: hy - 50, w: 100, h: 100 };
    this.toastC.setPosition(this.w / 2, 60 + si.top);
    this.heartsC.setPosition(hx + 80, hy - 18);
    const ax = this.w - 92 - si.right, ay = this.h - 100 - si.bottom;
    this.atkC.setPosition(ax, ay);
    this.rects.attack = { x: ax - 62, y: ay - 62, w: 124, h: 124 };
    this.bagC.setPosition(24 + si.left, this.h - 54 - si.bottom);
    this.rects.bag = { x: 24 + si.left, y: this.h - 84 - si.bottom, w: 200, h: 60 };
  }

  hit(x: number, y: number) {
    return Object.values(this.rects).some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  toast(msg: string) {
    this.toastText.setText(msg);
    const tw = this.toastText.width + 44;
    this.toastBg.clear().fillStyle(0xfff6e4, 0.96).fillRoundedRect(-tw / 2, -24, tw, 48, 24).lineStyle(3, theme.ui.accent, 1).strokeRoundedRect(-tw / 2, -24, tw, 48, 24);
    this.tweens.killTweensOf(this.toastC);
    this.toastC.setAlpha(0).setY(48 + safeInsets().top);
    this.tweens.add({ targets: this.toastC, alpha: 1, y: 60 + safeInsets().top, duration: 220 });
    this.tweens.add({ targets: this.toastC, alpha: 0, delay: 2200, duration: 400 });
  }
}
