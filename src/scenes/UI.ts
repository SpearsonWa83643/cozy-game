import Phaser from 'phaser';
import { S, ATLAS, frameScale } from '../art';
import { DPR } from '../dpr';
import { LANTERN_ORDER, LanternId } from '../layout';
import { sfx, VolumeLevel } from '../audio';
import { IS_TOUCH, safeInsets } from '../device';
import type { WorldScene } from './World';

const FONT = 'Nunito, "Trebuchet MS", sans-serif';
const INK = '#4a3426';

export class UIScene extends Phaser.Scene {
  w = 0;
  h = 0;
  sunGlow!: Phaser.GameObjects.Image;
  vignette!: Phaser.GameObjects.Image;
  dayTint!: Phaser.GameObjects.Image;
  insets = { top: 0, right: 0, bottom: 0, left: 0 };
  touchMode = IS_TOUCH;
  // Floating joystick.
  stickBase!: Phaser.GameObjects.Graphics;
  stickKnob!: Phaser.GameObjects.Graphics;
  stickPointer: Phaser.Input.Pointer | null = null;
  stickOrigin = { x: 0, y: 0 };
  stickStart = { x: 0, y: 0 };
  stickDownAt = 0;
  stickActive = false;
  // Action button.
  actionC!: Phaser.GameObjects.Container;
  actionBg!: Phaser.GameObjects.Graphics;
  actionLabel!: Phaser.GameObjects.Text;
  actionZone!: Phaser.GameObjects.Zone;
  actionShown = false;
  // Volume button.
  volC!: Phaser.GameObjects.Container;
  volIcon!: Phaser.GameObjects.Graphics;
  volZone!: Phaser.GameObjects.Zone;
  dialogBox = { x: 0, y: 0, w: 0, h: 0 };
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

    // Slow colour drift of the light over a few minutes (golden -> rosy -> soft lavender).
    this.dayTint = this.add.image(0, 0, ATLAS, 'white').setOrigin(0, 0).setBlendMode('MULTIPLY');
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

    this.controls = this.text(0, 0, '', 14, '#fff8ea', 700).setOrigin(1, 1).setAlpha(0.85).setShadow(0, 1, 'rgba(40,30,20,0.6)', 4);
    this.tweens.add({ targets: this.controls, alpha: 0, delay: 16000, duration: 1500 });

    this.buildTouchControls();
    this.buildVolumeButton();
    this.applyTouchMode();

    this.fpsText = this.text(0, 0, 'FPS --', 12, '#fff8ea', 700).setOrigin(1, 0).setAlpha(0.8)
      .setShadow(0, 1, 'rgba(30,20,15,0.7)', 3).setDepth(1000);
    let fpsPref: string | null = null;
    try { fpsPref = localStorage.getItem('cozy.fps'); } catch { /* storage unavailable */ }
    this.fpsText.setVisible(fpsPref !== '0');
    this.input.keyboard!.on('keydown-M', () => this.cycleVolume());
    this.input.keyboard!.on('keydown', () => { if (this.touchMode) { this.touchMode = false; this.applyTouchMode(); } });
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
    this.insets = safeInsets();
    const si = this.insets;
    this.dayTint.setPosition(-8, -8).setDisplaySize(this.w + 16, this.h + 16);
    this.vignette.setDisplaySize(this.w, this.h);
    this.hudC.setPosition(22 + si.left, 22 + si.top);
    this.sunGlow.setPosition(this.w * 0.08, this.h * 0.02).setScale(Math.max(this.w, this.h) * 1.1 / 256);
    this.fpsText.setPosition(this.w - 14 - si.right, 8 + si.top);
    this.volC.setPosition(this.w - 44 - si.right, 58 + si.top);
    this.volZone.setPosition(this.volC.x, this.volC.y);
    const abx = this.w - 74 - si.right;
    const aby = this.h - 78 - si.bottom;
    this.actionC.setPosition(abx, aby);
    this.actionZone.setPosition(abx, aby);
    this.controls.setPosition(this.touchMode ? abx - 70 : this.w - 18 - si.right, this.h - 14 - si.bottom);
    // Dialog panel geometry (lifted above the action button on narrow screens).
    const pw = Math.min(680, this.w - 32 - si.left - si.right);
    const ph = 132;
    const px = (this.w - pw) / 2;
    let py = this.h - ph - 22 - si.bottom;
    if (this.touchMode && px + pw > abx - 56) py -= 112;
    this.dialogBox = { x: px, y: py, w: pw, h: ph };
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
  // -------------------------------------------------------------- touch controls
  get world() { return this.scene.get('world') as WorldScene; }

  buildTouchControls() {
    this.input.addPointer(2);
    this.stickBase = this.add.graphics().setVisible(false);
    this.stickBase.fillStyle(0xfff6e2, 0.16);
    this.stickBase.fillCircle(0, 0, 62);
    this.stickBase.lineStyle(3, 0xfff6e2, 0.55);
    this.stickBase.strokeCircle(0, 0, 62);
    this.stickKnob = this.add.graphics().setVisible(false);
    this.stickKnob.fillStyle(0x2f2219, 0.25);
    this.stickKnob.fillCircle(0, 3, 28);
    this.stickKnob.fillStyle(0xfff3d6, 0.9);
    this.stickKnob.fillCircle(0, 0, 27);
    this.stickKnob.lineStyle(3, 0xf2a93b, 1);
    this.stickKnob.strokeCircle(0, 0, 27);

    // Big contextual action button (96 px), bottom-right inside the safe area.
    this.actionBg = this.add.graphics();
    this.actionBg.fillStyle(0x2a1d14, 0.3);
    this.actionBg.fillCircle(0, 5, 48);
    this.actionBg.fillStyle(0xfbf1dc, 0.96);
    this.actionBg.fillCircle(0, 0, 48);
    this.actionBg.lineStyle(4, 0xf2a93b, 1);
    this.actionBg.strokeCircle(0, 0, 43);
    this.actionLabel = this.text(0, 0, '', 19, INK, 800).setOrigin(0.5);
    this.actionC = this.add.container(0, 0, [this.actionBg, this.actionLabel]).setAlpha(0);
    this.actionZone = this.add.zone(0, 0, 112, 112).setInteractive(new Phaser.Geom.Circle(56, 56, 56), Phaser.Geom.Circle.Contains);
    this.actionZone.on('pointerdown', () => {
      if (!this.actionShown) return;
      this.tweens.add({ targets: this.actionC, scale: { from: 0.88, to: 1 }, duration: 220, ease: 'Back.easeOut' });
      this.world.tryInteract();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (p.wasTouch && !this.touchMode) { this.touchMode = true; this.applyTouchMode(); }
      if (over.some((o) => o === this.volZone || (o === this.actionZone && this.actionShown))) return;
      if (this.registry.get('dialogOpen')) { this.world.tryInteract(); return; }
      if (this.stickPointer) return;
      this.stickPointer = p;
      this.stickStart = { x: p.x / DPR, y: p.y / DPR };
      this.stickOrigin = { ...this.stickStart };
      this.stickDownAt = this.time.now;
      this.stickActive = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p !== this.stickPointer || !p.isDown) return;
      const x = p.x / DPR;
      const y = p.y / DPR;
      let dx = x - this.stickOrigin.x;
      let dy = y - this.stickOrigin.y;
      let d = Math.hypot(dx, dy);
      if (!this.stickActive && Math.hypot(x - this.stickStart.x, y - this.stickStart.y) > 12) {
        this.stickActive = true;
        this.stickBase.setVisible(true).setAlpha(0);
        this.stickKnob.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: [this.stickBase, this.stickKnob], alpha: 1, duration: 120 });
      }
      if (!this.stickActive) return;
      const R = 62;
      if (d > R) {
        // Floating stick: the base follows the thumb so it never runs out of travel.
        this.stickOrigin.x += (dx / d) * (d - R);
        this.stickOrigin.y += (dy / d) * (d - R);
        dx = x - this.stickOrigin.x; dy = y - this.stickOrigin.y; d = R;
      }
      this.stickBase.setPosition(this.stickOrigin.x, this.stickOrigin.y);
      this.stickKnob.setPosition(this.stickOrigin.x + dx, this.stickOrigin.y + dy);
      this.world.setStick({ x: dx / R, y: dy / R });
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p !== this.stickPointer) return;
      if (!this.stickActive && this.time.now - this.stickDownAt < 400) this.world.tapScreen(p.x, p.y);
      this.stickPointer = null;
      this.stickActive = false;
      this.world.setStick(null);
      this.tweens.add({ targets: [this.stickBase, this.stickKnob], alpha: 0, duration: 160, onComplete: () => { this.stickBase.setVisible(false); this.stickKnob.setVisible(false); } });
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => { if (this.stickPointer) release(this.stickPointer); });
  }

  buildVolumeButton() {
    const bg = this.add.graphics();
    bg.fillStyle(0x2c2420, 0.3);
    bg.fillCircle(0, 2, 25);
    bg.fillStyle(0xf3e6cc, 0.92);
    bg.fillCircle(0, 0, 24);
    bg.lineStyle(2.5, 0xb59b7c, 1);
    bg.strokeCircle(0, 0, 24);
    this.volIcon = this.add.graphics();
    this.volC = this.add.container(0, 0, [bg, this.volIcon]);
    this.volZone = this.add.zone(0, 0, 64, 64).setInteractive(new Phaser.Geom.Circle(32, 32, 32), Phaser.Geom.Circle.Contains);
    this.volZone.on('pointerdown', () => this.cycleVolume());
    this.drawVolIcon(sfx.level);
  }

  cycleVolume() {
    sfx.unlock();
    const lvl = sfx.cycleLevel();
    this.drawVolIcon(lvl);
    this.tweens.add({ targets: this.volC, scale: { from: 0.85, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    this.toast(lvl === 'on' ? 'Music & sounds: on' : lvl === 'quiet' ? 'Music & sounds: quiet' : 'Music & sounds: off');
  }

  drawVolIcon(lvl: VolumeLevel) {
    const g = this.volIcon;
    g.clear();
    g.fillStyle(0x6b4a33, 1);
    g.fillRect(-11, -4, 6, 8);
    g.fillTriangle(-6, -4, 2, -10, 2, 10);
    g.fillTriangle(-6, -4, 2, 10, -6, 4);
    g.lineStyle(2.4, 0x6b4a33, 1);
    if (lvl === 'off') {
      g.lineStyle(2.6, 0xc0563a, 1);
      g.lineBetween(6, -6, 14, 6);
      g.lineBetween(14, -6, 6, 6);
      return;
    }
    g.beginPath(); g.arc(3, 0, 6, -0.9, 0.9); g.strokePath();
    if (lvl === 'on') { g.beginPath(); g.arc(3, 0, 11, -0.9, 0.9); g.strokePath(); }
  }

  applyTouchMode() {
    this.registry.set('touchMode', this.touchMode);
    this.controls.setText(this.touchMode
      ? 'Drag anywhere to walk   \u00B7   Tap a spot to go there   \u00B7   Tap things to use them'
      : 'WASD / Arrows to wander   \u00B7   E / Space to interact   \u00B7   M: sound   \u00B7   F: FPS');
    this.dialogHint.setText(this.touchMode ? 'tap \u25B8' : 'E \u25B8');
    this.promptLabelText = '';
    if (this.w) this.layout();
  }

  updateTouchUI(time: number) {
    const world = this.world;
    const dialog = !!this.registry.get('dialogOpen');
    const label = dialog
      ? (this.typing ? '\u2026' : this.page < this.pages.length - 1 ? 'Next' : 'Close')
      : world?.prompt?.label ?? '';
    const show = this.touchMode && !!label && !world?.locked;
    if (show && this.actionLabel.text !== label) this.actionLabel.setText(label);
    if (show !== this.actionShown) {
      this.actionShown = show;
      this.tweens.killTweensOf(this.actionC);
      this.tweens.add({ targets: this.actionC, alpha: show ? 1 : 0, scale: show ? { from: 0.7, to: 1 } : 0.85, duration: show ? 260 : 160, ease: show ? 'Back.easeOut' : 'Sine.easeIn' });
    }
    if (show) this.actionLabel.setScale(1 + Math.sin(time / 260) * 0.03);
  }

  updateDayTint(time: number) {
    // ~4 minute loop through gentle colour grades; multiply blend keeps it subtle.
    const keys = [0xffffff, 0xfff2de, 0xffe7dc, 0xf3ecff, 0xfff6e6];
    const t = (time / 240000) % 1 * keys.length;
    const i = Math.floor(t);
    const f = t - i;
    const ease = f * f * (3 - 2 * f);
    const a = Phaser.Display.Color.IntegerToColor(keys[i]);
    const b = Phaser.Display.Color.IntegerToColor(keys[(i + 1) % keys.length]);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 1000, ease * 1000);
    this.dayTint.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    this.sunGlow.setAlpha(0.3 + 0.07 * Math.sin(time / 38000));
  }

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
    this.updateTouchUI(time);
    this.updateDayTint(time);
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
    this.dialogHint.setY(this.dialogBox.y + this.dialogBox.h - 14 + Math.sin(time / 250) * 2);

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
        const key = !this.touchMode;
        this.promptKey.setVisible(key);
        const tw = (key ? 34 : 18) + lw + 16;
        const g = this.promptBg;
        g.clear();
        g.fillStyle(0x2f2219, 0.25);
        g.fillRoundedRect(-tw / 2 + 1, -14 + 3, tw, 30, 15);
        g.fillStyle(0x3d2c20, 0.82);
        g.fillRoundedRect(-tw / 2, -15, tw, 30, 15);
        if (key) {
          g.fillStyle(0xf2a93b, 1);
          g.fillRoundedRect(-tw / 2 + 4, -11, 22, 22, 7);
        } else {
          g.fillStyle(0xf2a93b, 1);
          g.fillCircle(-tw / 2 + 13, 0, 5);
        }
        g.fillStyle(0x3d2c20, 0.82);
        g.fillTriangle(-6, 15, 6, 15, 0, 22);
        this.promptKey.setPosition(-tw / 2 + 15, 0);
        this.promptLabel.setPosition(-tw / 2 + (key ? 32 : 24), 0);
      }
      this.promptC.setPosition(sx, sy - 6 + Math.sin(time / 300) * 3);
      this.promptC.setAlpha(Math.min(1, this.promptC.alpha + delta / 150));
    } else {
      this.promptC.setAlpha(Math.max(0, this.promptC.alpha - delta / 150));
      if (this.promptC.alpha === 0) this.promptLabelText = '';
    }
  }
}
