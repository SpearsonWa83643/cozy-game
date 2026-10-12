import Phaser from 'phaser';
import { S, ATLAS, frameScale, atlasOf } from '../art';
import { NumBadge, SeqCard } from '../seq';
import { DPR } from '../dpr';
import { LANTERN_ORDER, LanternId } from '../layout';
import { sfx, VolumeLevel } from '../audio';
import { IS_TOUCH, safeInsets } from '../device';
import type { WorldScene } from './World';
import type { Species } from '../catalog';
import { RARITY_STARS } from '../catalog';

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
  hudIcons: { id: LanternId; ring: Phaser.GameObjects.Graphics; sym: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; badge: NumBadge }[] = [];
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
      const sym = this.add.image(x + 18, 18, atlasOf(`q_${id}`), `q_${id}`).setDisplaySize(30, 30).setAlpha(0.75);
      const badge = new NumBadge(this, x + 33, 33, i + 1, 9, Math.max(3, DPR * 2));
      this.hudC.add([glow, ring, sym, badge.c]);
      this.hudIcons.push({ id, ring, sym, glow, badge });
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
    this.buildMenuButtons();
    this.buildFishUI();
    this.applyTouchMode();

    this.fpsText = this.text(0, 0, 'FPS --', 12, '#fff8ea', 700).setOrigin(1, 0).setAlpha(0.8)
      .setShadow(0, 1, 'rgba(30,20,15,0.7)', 3).setDepth(1000);
    let fpsPref: string | null = null;
    try { fpsPref = localStorage.getItem('cozy.fps'); } catch { /* storage unavailable */ }
    this.fpsText.setVisible(fpsPref !== '0');
    this.input.keyboard!.on('keydown-V', () => this.cycleVolume());
    this.input.keyboard!.on('keydown-M', () => this.game.events.emit('menu', 'map'));
    this.input.keyboard!.on('keydown-B', () => this.game.events.emit('menu', 'wardrobe'));
    this.input.keyboard!.on('keydown-I', () => this.game.events.emit('menu', 'treasures'));
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
    this.mapC.setPosition(this.w - 108 - si.right, 58 + si.top);
    this.mapZone.setPosition(this.mapC.x, this.mapC.y);
    this.bagC.setPosition(this.w - 172 - si.right, 58 + si.top);
    this.bagZone.setPosition(this.bagC.x, this.bagC.y);
    this.layoutFishUI();
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
    if (this.seqC) this.drawSeqCards();
  }

  // -------------------------------------------------------------- dialog
  /** Clue cards (big number + big icon + one word) shown above the dialog for ordered puzzles. */
  seqC: Phaser.GameObjects.Container | null = null;
  seqCards: SeqCard[] | null = null;
  rects: Record<string, { x: number; y: number; w: number; h: number }> = {};
  drawSeqCards() {
    this.seqC?.destroy(); this.seqC = null;
    for (const k of Object.keys(this.rects)) if (k.startsWith('seq')) delete this.rects[k];
    const cards = this.seqCards;
    if (!cards || !cards.length) return;
    const cw = Math.min(118, (this.dialogBox.w - 24) / cards.length - 14), ch = cw * 1.12, gap = 14;
    const tw = cards.length * cw + (cards.length - 1) * gap;
    const x0 = this.dialogBox.x + (this.dialogBox.w - tw) / 2, y0 = this.dialogBox.y - ch - 18;
    const c = this.add.container(0, 0);
    cards.forEach((cd, i) => {
      const x = x0 + i * (cw + gap), y = y0;
      const g = this.add.graphics();
      g.fillStyle(0x1d1418, 0.3); g.fillRoundedRect(x + 2, y + 6, cw, ch, 20);
      g.fillStyle(cd.done ? 0xeaf7df : 0xfffaf0, 1); g.fillRoundedRect(x, y, cw, ch, 20);
      g.lineStyle(5, cd.done ? 0x3f8f2f : 0x2e2230, 1); g.strokeRoundedRect(x + 2.5, y + 2.5, cw - 5, ch - 5, 18);
      const im = this.add.image(x + cw / 2, y + ch * 0.47, atlasOf(cd.icon), cd.icon).setDisplaySize(cw * 0.66, cw * 0.66);
      const lab = this.text(x + cw / 2, y + ch - 17, cd.label, Math.round(cw * 0.17), '#2e2230', 900).setOrigin(0.5);
      const b = new NumBadge(this, x + 6, y + 6, cd.n, cw * 0.22, Math.max(3, DPR * 2));
      if (cd.done) b.set('done', false);
      c.add([g, im, lab, b.c]);
      this.rects[`seq${i}`] = { x, y, w: cw, h: ch };
    });
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, y: { from: 14, to: 0 }, duration: 280, ease: 'Back.easeOut' });
    this.seqC = c;
  }

  openDialog(pages: string[], cards?: SeqCard[]) {
    this.seqCards = cards ?? null;
    this.drawSeqCards();
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
      targets: [this.dialogC, ...(this.seqC ? [this.seqC] : [])], alpha: 0, duration: 180, onComplete: () => {
        this.dialogC.setVisible(false);
        this.seqC?.destroy(); this.seqC = null; this.seqCards = null;
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
    this.toastC.setPosition(this.w / 2, title ? this.h * 0.24 : 172);
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
      ic.sym.setAlpha(on ? 1 : 0.75);
      ic.badge.set(on ? 'done' : 'todo');
      this.tweens.add({ targets: ic.glow, alpha: on ? 0.8 : 0, duration: 400 });
      if (on && lit[lit.length - 1] === ic.id) {
        ic.sym.setDisplaySize(30, 30);
        const base = ic.sym.scaleX;
        this.tweens.add({ targets: ic.sym, scale: { from: base * 1.6, to: base }, duration: 500, ease: 'Back.easeOut' });
      }
    });
  }

  // -------------------------------------------------------------- satchel + map buttons
  mapC!: Phaser.GameObjects.Container; mapZone!: Phaser.GameObjects.Zone;
  bagC!: Phaser.GameObjects.Container; bagZone!: Phaser.GameObjects.Zone;
  badge!: Phaser.GameObjects.Graphics;
  roundButton(draw: (g: Phaser.GameObjects.Graphics) => void, onTap: () => void) {
    const bg = this.add.graphics();
    bg.fillStyle(0x2c2420, 0.3); bg.fillCircle(0, 2, 25);
    bg.fillStyle(0xf3e6cc, 0.92); bg.fillCircle(0, 0, 24);
    bg.lineStyle(2.5, 0xb59b7c, 1); bg.strokeCircle(0, 0, 24);
    const icon = this.add.graphics();
    draw(icon);
    const c = this.add.container(0, 0, [bg, icon]);
    const z = this.add.zone(0, 0, 64, 64).setInteractive(new Phaser.Geom.Circle(32, 32, 32), Phaser.Geom.Circle.Contains);
    z.on('pointerdown', () => { if (this.registry.get('menuOpen')) return; sfx.unlock(); this.tweens.add({ targets: c, scale: { from: 0.85, to: 1 }, duration: 220, ease: 'Back.easeOut' }); onTap(); });
    return [c, z] as const;
  }
  buildMenuButtons() {
    [this.mapC, this.mapZone] = this.roundButton((g) => {
      g.fillStyle(0xe9d3a6, 1); g.lineStyle(2, 0x6b4a33, 1);
      g.beginPath(); g.moveTo(-12, -8); g.lineTo(-4, -11); g.lineTo(4, -8); g.lineTo(12, -11); g.lineTo(12, 9); g.lineTo(4, 12); g.lineTo(-4, 9); g.lineTo(-12, 12); g.closePath(); g.fillPath(); g.strokePath();
      g.lineBetween(-4, -11, -4, 9); g.lineBetween(4, -8, 4, 12);
      g.fillStyle(0xe85d3a, 1); g.fillCircle(7, -1, 2.6);
    }, () => this.game.events.emit('menu', 'map'));
    [this.bagC, this.bagZone] = this.roundButton((g) => {
      g.fillStyle(0xa8743f, 1); g.fillRoundedRect(-11, -6, 22, 17, 5);
      g.lineStyle(2.4, 0x6b4a33, 1); g.strokeRoundedRect(-11, -6, 22, 17, 5);
      g.beginPath(); g.arc(0, -6, 6, Math.PI, 0); g.strokePath();
      g.fillStyle(0xc98f52, 1); g.fillRoundedRect(-11, -6, 22, 7, 4);
      g.fillStyle(0xf2c14e, 1); g.fillCircle(0, 1, 2.4);
    }, () => this.game.events.emit('menu', 'wardrobe'));
    this.badge = this.add.graphics().setVisible(false);
    this.badge.fillStyle(0xe85d3a, 1); this.badge.fillCircle(17, -17, 7); this.badge.lineStyle(2, 0xfffaf0, 1); this.badge.strokeCircle(17, -17, 7);
    this.bagC.add(this.badge);
    const ev = this.game.events;
    const ping = () => { this.badge.setVisible(true); this.tweens.add({ targets: this.bagC, scale: { from: 1.25, to: 1 }, duration: 500, ease: 'Back.easeOut' }); };
    ev.on('treasure', ping);
    ev.on('fish-caught', (d: { isNew: boolean; unlocked: string[] }) => { if (d.isNew || d.unlocked.length) ping(); });
    ev.on('minor', () => { /* counts only */ });
    ev.on('menu-opened', () => this.badge.setVisible(false));
  }

  // -------------------------------------------------------------- fishing UI
  reelC!: Phaser.GameObjects.Container; reelG!: Phaser.GameObjects.Graphics; reelText!: Phaser.GameObjects.Text;
  biteText!: Phaser.GameObjects.Text;
  cardC!: Phaser.GameObjects.Container; cardG!: Phaser.GameObjects.Graphics; cardFish!: Phaser.GameObjects.Image;
  cardTitle!: Phaser.GameObjects.Text; cardSub!: Phaser.GameObjects.Text; cardNew!: Phaser.GameObjects.Text;
  cardOpen = false;
  cardTimer: Phaser.Time.TimerEvent | null = null;
  reelBox = { x: 0, y: 0, w: 0, h: 0 };
  buildFishUI() {
    this.reelG = this.add.graphics();
    this.reelText = this.text(0, 0, '', 18, '#fff8ea', 800).setOrigin(0.5, 1).setShadow(0, 2, 'rgba(40,25,15,0.7)', 5);
    this.reelC = this.add.container(0, 0, [this.reelG, this.reelText]).setVisible(false);
    this.biteText = this.text(0, 0, 'A bite! Tap!', 34, '#fff3d6', 900).setOrigin(0.5).setStroke('#6b4326', 6).setShadow(0, 3, 'rgba(40,25,15,0.6)', 8, true, true).setAlpha(0);
    this.cardG = this.add.graphics();
    this.cardFish = this.add.image(0, 0, ATLAS, 'fishicon');
    this.cardTitle = this.text(0, 0, '', 24, INK, 900).setOrigin(0.5);
    this.cardSub = this.text(0, 0, '', 16, '#8a6a50', 700).setOrigin(0.5).setAlign('center');
    this.cardNew = this.text(0, 0, 'NEW!', 16, '#fffaf0', 900).setOrigin(0.5);
    this.cardC = this.add.container(0, 0, [this.cardG, this.cardFish, this.cardTitle, this.cardSub, this.cardNew]).setVisible(false);
    const ev = this.game.events;
    ev.on('fish-state', (st: string) => {
      this.reelC.setVisible(st === 'reel');
      if (st === 'bite') {
        this.tweens.killTweensOf(this.biteText);
        this.biteText.setAlpha(1).setScale(0.6);
        this.tweens.add({ targets: this.biteText, scale: 1, duration: 300, ease: 'Back.easeOut' });
      } else this.tweens.add({ targets: this.biteText, alpha: 0, duration: 150 });
    });
    ev.on('fish-caught', (d: { species: Species; size: number; isNew: boolean; unlocked: string[] }) => this.showCard(d));
  }
  layoutFishUI() {
    if (!this.reelG) return;
    const w = Math.min(460, this.w - 80), h = 56;
    this.reelBox = { x: (this.w - w) / 2, y: this.h * 0.68, w, h };
    this.biteText.setPosition(this.w / 2, this.h * 0.32);
    this.cardC.setPosition(this.w / 2, this.h * 0.42);
  }
  updateFishUI(time: number) {
    if (!this.reelC.visible) return;
    const f = this.world.fishing;
    const r = f.reel;
    if (!r) return;
    const { x, y, w, h } = this.reelBox;
    const g = this.reelG;
    g.clear();
    g.fillStyle(0x2a1d14, 0.35); g.fillRoundedRect(x - 8, y - 6, w + 16, h + 22, 22);
    g.fillStyle(0xfbf1dc, 0.97); g.fillRoundedRect(x, y, w, h, 18);
    // Target zone.
    const zx = x + 12 + (w - 24) * (r.zone - r.width / 2), zw = (w - 24) * r.width;
    g.fillStyle(0x9be07a, 0.9); g.fillRoundedRect(zx, y + 10, zw, h - 20, 10);
    g.lineStyle(2, 0x5ea845, 1); g.strokeRoundedRect(zx, y + 10, zw, h - 20, 10);
    // Marker.
    const mx = x + 12 + (w - 24) * f.markerPos();
    g.fillStyle(r.flash > 0 ? (r.flashOk ? 0x5ea845 : 0xc0563a) : 0x3d2c20, 1);
    g.fillRoundedRect(mx - 4, y + 4, 8, h - 8, 4);
    g.fillTriangle(mx - 9, y - 2, mx + 9, y - 2, mx, y + 8);
    // Progress pips.
    for (let i = 0; i < r.need; i++) {
      g.fillStyle(i < r.hits ? 0xf2a93b : 0xd9c7a8, 1);
      g.fillCircle(x + w / 2 + (i - (r.need - 1) / 2) * 24, y + h + 8, 7);
    }
    for (let i = 0; i < 3; i++) {
      g.fillStyle(i < r.misses ? 0xc0563a : 0xe6dccb, 1);
      g.fillCircle(x + w - 14 - i * 16, y - 16, 5);
    }
    this.reelText.setPosition(x + w / 2, y - 10).setText(r.flash > 0 ? (r.flashOk ? 'Nice!' : 'Oops!') : 'Tap in the green!');
    void time;
  }
  showCard(d: { species: Species; size: number; isNew: boolean; unlocked: string[] }) {
    const g = this.cardG;
    const w = 380, h = d.unlocked.length ? 250 : 220;
    g.clear();
    g.fillStyle(0x2a1d14, 0.3); g.fillRoundedRect(-w / 2 + 3, -h / 2 + 8, w, h, 24);
    g.fillStyle(0xfbf1dc, 0.98); g.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    g.lineStyle(3, d.species.rarity === 'rare' ? 0xb48cff : 0xf2a93b, 1); g.strokeRoundedRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14, 18);
    if (d.isNew) { g.fillStyle(0xe85d3a, 1); g.fillRoundedRect(w / 2 - 82, -h / 2 + 16, 64, 28, 14); }
    this.cardNew.setPosition(w / 2 - 50, -h / 2 + 30).setVisible(d.isNew);
    this.cardFish.setTint(d.species.tint).setPosition(0, -h / 2 + 64);
    this.cardFish.setScale(Math.min(150, 70 + d.size) / this.cardFish.width);
    const stars = '\u2605'.repeat(RARITY_STARS[d.species.rarity]);
    this.cardTitle.setText(d.species.name).setPosition(0, -h / 2 + 118);
    const lines = [`${d.size} cm   ${stars}`, d.species.blurb];
    if (d.unlocked.length) lines.push(`Unlocked: ${d.unlocked.join(', ')}!`);
    this.cardSub.setText(lines.join('\n')).setPosition(0, -h / 2 + 168).setWordWrapWidth(w - 50);
    this.cardC.setVisible(true).setAlpha(0).setScale(0.7);
    this.tweens.add({ targets: this.cardC, alpha: 1, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.cardOpen = true;
    this.cardTimer?.remove();
    this.cardTimer = this.time.delayedCall(4200, () => this.closeCard());
  }
  closeCard() {
    if (!this.cardOpen) return;
    this.cardOpen = false;
    this.cardTimer?.remove();
    this.tweens.add({ targets: this.cardC, alpha: 0, scale: 0.9, duration: 180, onComplete: () => this.cardC.setVisible(false) });
  }

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
      if (this.registry.get('menuOpen') || this.registry.get('vcard')) return;
      if (over.some((o) => o === this.volZone || o === this.mapZone || o === this.bagZone || (o === this.actionZone && this.actionShown))) return;
      if (this.cardOpen) { this.closeCard(); return; }
      if (this.registry.get('dialogOpen')) { this.world.tryInteract(); return; }
      const fs = this.world.fishing?.state;
      if (fs === 'bite' || fs === 'reel') { this.world.fishing.tap(p.downTime); return; }
      if (this.stickPointer || this.dragP) return;
      // Press on a villager: drag them onto a building (or just tap for their card).
      const vg = this.world.village;
      if (vg && !vg.building && !this.world.fishing.active) {
        const wp = this.world.cameras.main.getWorldPoint(p.x, p.y);
        const v = vg.villagerAt(wp.x, wp.y);
        if (v) { this.dragP = p; this.dragV = v; this.dragOn = false; this.stickStart = { x: p.x / DPR, y: p.y / DPR }; this.stickDownAt = this.time.now; return; }
      }
      if (vg?.building) { this.dragP = p; this.dragV = null; this.dragOn = false; this.stickStart = { x: p.x / DPR, y: p.y / DPR }; this.stickDownAt = this.time.now; return; }
      this.stickPointer = p;
      this.stickStart = { x: p.x / DPR, y: p.y / DPR };
      this.stickOrigin = { ...this.stickStart };
      this.stickDownAt = this.time.now;
      this.stickActive = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p === this.dragP && p.isDown) {
        const vg = this.world.village;
        const wp = this.world.cameras.main.getWorldPoint(p.x, p.y);
        if (!this.dragOn && Math.hypot(p.x / DPR - this.stickStart.x, p.y / DPR - this.stickStart.y) > 12) {
          this.dragOn = true;
          if (this.dragV) vg.startDrag(this.dragV);
        }
        if (this.dragOn) { if (this.dragV) vg.dragTo(this.dragV, wp.x, wp.y); else vg.dragGhost(wp.x, wp.y); }
        return;
      }
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
      if (p === this.dragP) {
        const vg = this.world.village;
        if (this.dragOn && this.dragV) { const wp = this.world.cameras.main.getWorldPoint(p.x, p.y); vg.drop(this.dragV, wp.x, wp.y); }
        else if (!this.dragOn) this.world.tapScreen(p.x, p.y);
        this.dragP = null; this.dragV = null; this.dragOn = false;
        return;
      }
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
      ? 'Drag to walk   \u00B7   Tap to go   \u00B7   Tap animals and water'
      : 'WASD / Arrows   \u00B7   E / Space: interact & fish   \u00B7   B: bag   \u00B7   M: map   \u00B7   V: sound   \u00B7   F: FPS');
    this.dialogHint.setText(this.touchMode ? 'tap \u25B8' : 'E \u25B8');
    this.promptLabelText = '';
    if (this.w) this.layout();
  }

  updateTouchUI(time: number) {
    const world = this.world;
    const dialog = !!this.registry.get('dialogOpen');
    const fs = world?.fishing?.state ?? 'idle';
    const fishLabel = fs === 'bite' ? 'Hook!' : fs === 'reel' ? 'Reel!' : fs === 'wait' ? 'Reel in' : '';
    const label = dialog
      ? (this.typing ? '\u2026' : this.page < this.pages.length - 1 ? 'Next' : 'Close')
      : fishLabel || (world?.prompt?.label ?? '');
    const show = this.touchMode && !!label && !world?.locked && !this.registry.get('menuOpen');
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

  dragP: Phaser.Input.Pointer | null = null;
  dragV: import('../village/village').Villager | null = null;
  dragOn = false;
  update(time: number, delta: number) {
    // A release can be swallowed by an overlay scene; never leave the stick or a drag stuck.
    if (this.stickPointer && !this.stickPointer.isDown) this.input.emit('pointerup', this.stickPointer);
    if (this.dragP && !this.dragP.isDown) this.input.emit('pointerup', this.dragP);
    this.updateFps(time);
    this.updateFishUI(time);
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
