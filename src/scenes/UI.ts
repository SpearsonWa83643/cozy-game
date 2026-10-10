import Phaser from 'phaser';
import { S, ATLAS, frameScale } from '../art';
import { DPR } from '../dpr';
import { LANTERN_ORDER, LanternId } from '../layout';
import { sfx } from '../audio';
import type { WorldScene } from './World';

const FONT = 'Nunito, "Trebuchet MS", sans-serif';
const INK = '#4a3426';

export class UIScene extends Phaser.Scene {
  w = 0;
  h = 0;
  sunGlow!: Phaser.GameObjects.Image;
  vignette!: Phaser.GameObjects.Image;
  // Prompt.
  promptC!: Phaser.GameObjects.Container;
  promptBg!: Phaser.GameObjects.Graphics;
  promptKey!: Phaser.GameObjects.Text;
  promptLabel!: Phaser.GameObjects.Text;
  promptLabelText = '';
  // Dialog.
  dialogC!: Phaser.GameObjects.Container;
  dialogBg!: Phaser.GameObjects.Graphics;
  dialogText!: Phaser.GameObjects.Text;
  dialogHint!: Phaser.GameObjects.Text;
  pages: string[] = [];
  page = 0;
  shown = 0;
  typing = false;
  // HUD.
  hudC!: Phaser.GameObjects.Container;
  hudIcons: { id: LanternId; ring: Phaser.GameObjects.Graphics; sym: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[] = [];
  feather!: Phaser.GameObjects.Image;
  // Toast.
  toastC!: Phaser.GameObjects.Container;
  toastBg!: Phaser.GameObjects.Graphics;
  toastText!: Phaser.GameObjects.Text;
  toastTween?: Phaser.Tweens.TweenChain | Phaser.Tweens.Tween;
  controls!: Phaser.GameObjects.Text;
  // FPS readout (toggle with F).
  fpsText!: Phaser.GameObjects.Text;
  fpsFrames: number[] = [];   // frame deltas in the last ~10 s (ms)
  fpsSum = 0;
  fpsAccum = 0;
  fpsCount = 0;
  fpsCurrent = 0;
  fpsNextUpdate = 0;
  lastFrameAt = 0;

  constructor() { super('ui'); }

  text(x: number, y: number, str: string, size: number, color = INK, weight = 700) {
    return this.add.text(x, y, str, {
      fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: `${weight}`, resolution: Math.max(2, DPR * 1.5),
    } as any);
  }

  create() {
    const cam = this.cameras.main;
    cam.setOrigin(0, 0);
    cam.setZoom(DPR);
    this.registry.set('dialogOpen', false);

    this.vignette = this.add.image(0, 0, ATLAS, 'vignette').setOrigin(0, 0);
    // Warm late-afternoon light leaking in from the top-left.
    this.sunGlow = this.add.image(0, 0, ATLAS, 'glow').setBlendMode('ADD').setTint(0xffc879).setAlpha(0.32);

    // HUD: three lantern sigils + feather slot.
    this.hudC = this.add.container(22, 22);
    LANTERN_ORDER.forEach((id, i) => {
      const x = i * 46;
      const glow = this.add.image(x + 18, 18, ATLAS, 'glow').setScale(0.22).setBlendMode('ADD').setTint(0xffc560).setAlpha(0);
      const ring = this.add.graphics();
      this.drawRing(ring, x + 18, 18, false);
      const sym = this.add.image(x + 18, 18, ATLAS, `sym_${id}`).setScale(0.62 / S * 1.2).setTint(0x8b7d6b);
      this.hudC.add([glow, ring, sym]);
      this.hudIcons.push({ id, ring, sym, glow });
    });
    this.feather = this.add.image(3 * 46 + 26, 18, ATLAS, 'feather').setScale(0.75 / S).setAlpha(0).setAngle(-10);
    this.hudC.add(this.feather);

    // Prompt bubble.
    this.promptBg = this.add.graphics();
    this.promptKey = this.text(0, 0, 'E', 15, '#fff8ea', 800).setOrigin(0.5);
    this.promptLabel = this.text(0, 0, '', 15, '#fff8ea', 700).setOrigin(0, 0.5);
    this.promptC = this.add.container(0, 0, [this.promptBg, this.promptKey, this.promptLabel]).setAlpha(0);

    // Dialog panel.
    this.dialogBg = this.add.graphics();
    this.dialogText = this.text(0, 0, '', 19, INK, 600).setLineSpacing(6);
    this.dialogHint = this.text(0, 0, 'E \u25B8', 14, '#a0806a', 800).setOrigin(1, 1);
    this.dialogC = this.add.container(0, 0, [this.dialogBg, this.dialogText, this.dialogHint]).setAlpha(0).setVisible(false);

    // Toast.
    this.toastBg = this.add.graphics();
    this.toastText = this.text(0, 0, '', 18, '#fff8ea', 700).setOrigin(0.5);
    this.toastC = this.add.container(0, 0, [this.toastBg, this.toastText]).setAlpha(0);

    this.controls = this.text(0, 0, 'WASD / Arrows to wander   \u00B7   E / Space to interact   \u00B7   F: FPS', 14, '#fff8ea', 700).setOrigin(1, 1).setAlpha(0.85).setShadow(0, 1, 'rgba(40,30,20,0.6)', 4);
    this.tweens.add({ targets: this.controls, alpha: 0, delay: 14000, duration: 1500 });

    this.fpsText = this.text(0, 0, 'FPS --', 12, '#fff8ea', 700).setOrigin(1, 0).setAlpha(0.8)
      .setShadow(0, 1, 'rgba(30,20,15,0.7)', 3).setDepth(1000);
    let fpsPref: string | null = null;
    try { fpsPref = localStorage.getItem('cozy.fps'); } catch { /* storage unavailable */ }
    this.fpsText.setVisible(fpsPref !== '0');
    this.input.keyboard!.on('keydown-F', () => {
      this.fpsText.setVisible(!this.fpsText.visible);
      try { localStorage.setItem('cozy.fps', this.fpsText.visible ? '1' : '0'); } catch { /* file:// may block */ }
    });

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    const ev = this.game.events;
    ev.on('dialog', this.openDialog, this);
    ev.on('dialog-advance', this.advanceDialog, this);
    ev.on('toast', this.toast, this);
    ev.on('lanterns', this.updateLanterns, this);
    ev.on('feather', () => {
      this.tweens.add({ targets: this.feather, alpha: 1, scale: { from: 1.6 / S, to: 0.75 / S }, duration: 700, ease: 'Back.easeOut' });
    });
    this.events.once('shutdown', () => {
      ev.off('dialog', this.openDialog, this); ev.off('dialog-advance', this.advanceDialog, this);
      ev.off('toast', this.toast, this); ev.off('lanterns', this.updateLanterns, this);
    });
  }

  drawRing(g: Phaser.GameObjects.Graphics, x: number, y: number, lit: boolean) {
    g.clear();
    g.fillStyle(0x2c2420, 0.35);
    g.fillCircle(x, y + 2, 19);
    g.fillStyle(lit ? 0xfff1cf : 0xf3e6cc, lit ? 1 : 0.85);
    g.fillCircle(x, y, 18);
    g.lineStyle(2.5, lit ? 0xf2a93b : 0xb59b7c, 1);
    g.strokeCircle(x, y, 18);
  }

  layout() {
    this.w = this.scale.width / DPR;
    this.h = this.scale.height / DPR;
    this.cameras.main.setZoom(DPR);
    this.vignette.setDisplaySize(this.w, this.h);
    this.sunGlow.setPosition(this.w * 0.08, this.h * 0.02).setScale(Math.max(this.w, this.h) * 1.1 / 256);
    this.controls.setPosition(this.w - 18, this.h - 14);
    this.fpsText.setPosition(this.w - 12, 10);
    // Dialog panel geometry.
    const pw = Math.min(680, this.w - 32);
    const ph = 132;
    const px = (this.w - pw) / 2;
    const py = this.h - ph - 22;
    const g = this.dialogBg;
    g.clear();
    g.fillStyle(0x2a1d14, 0.28);
    g.fillRoundedRect(px + 2, py + 6, pw, ph, 18);
    g.fillStyle(0xfbf1dc, 0.97);
    g.fillRoundedRect(px, py, pw, ph, 18);
    g.lineStyle(3, 0xd9b98f, 1);
    g.strokeRoundedRect(px + 6, py + 6, pw - 12, ph - 12, 13);
    g.fillStyle(0xf2a93b, 1);
    g.fillCircle(px + 6, py + 6, 4);
    g.fillCircle(px + pw - 6, py + 6, 4);
    this.dialogText.setPosition(px + 26, py + 22).setWordWrapWidth(pw - 52, true);
    this.dialogHint.setPosition(px + pw - 20, py + ph - 14);
  }

  // -------------------------------------------------------------- dialog
  openDialog(pages: string[]) {
    this.pages = pages;
    this.page = 0;
    this.registry.set('dialogOpen', true);
    this.dialogC.setVisible(true);
    this.tweens.add({ targets: this.dialogC, alpha: 1, y: { from: 16, to: 0 }, duration: 260, ease: 'Sine.easeOut' });
    this.showPage();
  }

  showPage() {
    this.shown = 0;
    this.typing = true;
    this.dialogText.setText('');
    this.dialogHint.setAlpha(0);
  }

  advanceDialog() {
    if (!this.registry.get('dialogOpen')) return;
    sfx.blip();
    if (this.typing) {
      this.shown = this.pages[this.page].length;
      return;
    }
    this.page++;
    if (this.page < this.pages.length) { this.showPage(); return; }
    this.tweens.add({
      targets: this.dialogC, alpha: 0, duration: 180, onComplete: () => {
        this.dialogC.setVisible(false);
        // Release on the next frame so the closing key press doesn't re-trigger an interaction.
        this.time.delayedCall(60, () => this.registry.set('dialogOpen', false));
      },
    });
  }

  // -------------------------------------------------------------- toast
  toast(msg: string, kind?: string) {
    const title = kind === 'title';
    this.toastText.setText(msg).setFontSize(title ? 46 : 18).setColor(title ? '#fff3d6' : '#fff8ea');
    this.toastText.setStroke('#6b4326', title ? 7 : 0);
    this.toastText.setShadow(0, 3, 'rgba(40,25,15,0.6)', title ? 12 : 4, true, true);
    const tw = this.toastText.width + 44;
    const th = this.toastText.height + 18;
    this.toastBg.clear();
    if (!title) {
      this.toastBg.fillStyle(0x2f2219, 0.55);
      this.toastBg.fillRoundedRect(-tw / 2, -th / 2, tw, th, th / 2);
    }
    this.toastC.setPosition(this.w / 2, title ? this.h * 0.24 : 64);
    this.toastTween?.stop();
    this.toastC.setAlpha(0);
    this.toastTween = this.tweens.chain({
      targets: this.toastC,
      tweens: [
        { alpha: 1, duration: title ? 1200 : 350, ease: 'Sine.easeOut' },
        { alpha: 1, duration: title ? 2600 : 3200 },
        { alpha: 0, duration: title ? 1500 : 600, ease: 'Sine.easeIn' },
      ],
    });
  }

  updateLanterns(lit: LanternId[]) {
    this.hudIcons.forEach((ic, i) => {
      const on = lit.includes(ic.id);
      this.drawRing(ic.ring, i * 46 + 18, 18, on);
      ic.sym.setTint(on ? 0xf29a2e : 0x8b7d6b);
      this.tweens.add({ targets: ic.glow, alpha: on ? 0.8 : 0, duration: 400 });
      if (on && lit[lit.length - 1] === ic.id) {
        this.tweens.add({ targets: ic.sym, scale: { from: (0.62 / S) * 1.9, to: (0.62 / S) * 1.2 }, duration: 500, ease: 'Back.easeOut' });
      }
    });
  }

  // -------------------------------------------------------------- update
  updateFps(time: number) {
    // Use real wall-clock frame times (Phaser's delta is smoothed).
    const now = performance.now();
    const d = this.lastFrameAt ? now - this.lastFrameAt : 16.7;
    this.lastFrameAt = now;
    // Skip hitches over 1 s (startup texture painting, background tabs) so stats stay meaningful.
    if (d > 1000) return;
    this.fpsFrames.push(d);
    this.fpsSum += d;
    while (this.fpsSum > 10_000 && this.fpsFrames.length > 1) this.fpsSum -= this.fpsFrames.shift()!;
    this.fpsAccum += d;
    this.fpsCount++;
    if (time >= this.fpsNextUpdate && this.fpsAccum > 0) {
      this.fpsCurrent = (this.fpsCount * 1000) / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsCount = 0;
      this.fpsNextUpdate = time + 250;
      const avg = (this.fpsFrames.length * 1000) / this.fpsSum;
      const worst = 1000 / Math.max(...this.fpsFrames.slice(-120));
      this.fpsText.setText(`FPS ${this.fpsCurrent.toFixed(0)}  \u00B7  avg ${avg.toFixed(0)} (10s)  \u00B7  low ${worst.toFixed(0)}`);
      (window as any).__fps = { current: this.fpsCurrent, avg10s: avg, low: worst };
    }
  }

  update(time: number, delta: number) {
    this.updateFps(time);
    // Typewriter.
    if (this.registry.get('dialogOpen') && this.typing) {
      const full = this.pages[this.page];
      this.shown = Math.min(full.length, this.shown + delta * 0.05);
      this.dialogText.setText(full.slice(0, Math.floor(this.shown)));
      if (this.shown >= full.length) {
        this.typing = false;
        this.tweens.add({ targets: this.dialogHint, alpha: 1, duration: 300 });
      }
    }
    this.dialogHint.setY(this.h - 22 - 14 + Math.sin(time / 250) * 2);

    // Interaction prompt follows its world target.
    const world = this.scene.get('world') as WorldScene;
    const p = world?.prompt;
    if (p) {
      const cam = world.cameras.main;
      const sx = (p.x - cam.worldView.x) * cam.zoom / DPR;
      const sy = (p.y - cam.worldView.y) * cam.zoom / DPR;
      if (p.label !== this.promptLabelText) {
        this.promptLabelText = p.label;
        this.promptLabel.setText(p.label);
        const lw = this.promptLabel.width;
        const tw = 34 + lw + 16;
        const g = this.promptBg;
        g.clear();
        g.fillStyle(0x2f2219, 0.25);
        g.fillRoundedRect(-tw / 2 + 1, -14 + 3, tw, 30, 15);
        g.fillStyle(0x3d2c20, 0.82);
        g.fillRoundedRect(-tw / 2, -15, tw, 30, 15);
        g.fillStyle(0xf2a93b, 1);
        g.fillRoundedRect(-tw / 2 + 4, -11, 22, 22, 7);
        g.fillStyle(0x3d2c20, 0.82);
        g.fillTriangle(-6, 15, 6, 15, 0, 22);
        this.promptKey.setPosition(-tw / 2 + 15, 0);
        this.promptLabel.setPosition(-tw / 2 + 32, 0);
      }
      this.promptC.setPosition(sx, sy - 6 + Math.sin(time / 300) * 3);
      this.promptC.setAlpha(Math.min(1, this.promptC.alpha + delta / 150));
    } else {
      this.promptC.setAlpha(Math.max(0, this.promptC.alpha - delta / 150));
      if (this.promptC.alpha === 0) this.promptLabelText = '';
    }
  }
}
