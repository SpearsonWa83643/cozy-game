// Wilderness HUD: a big Home button (always there), hearts, the swing button and a loot bag count.
import Phaser from 'phaser';
import { ATLAS, frameScale, atlasOf } from '../art';
import { DPR } from '../dpr';
import { safeInsets } from '../device';
import { theme, themeEvents } from '../theme';
import { ATLAS3 } from '../wild/wart';
import { WILD_COMBAT, LUNCHBOX_TINT, type WildScene } from './Wild';
import { TouchStick, ZoomButtons } from '../controls';
import { sfx } from '../audio';

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
  /** The same floating joystick + tap-to-walk as the glade's UI. */
  stick!: TouchStick;
  zoomBtns!: ZoomButtons;

  /** Self-added 12.4: after a little while, a tiny lunchbox bubble at the screen edge points toward
   *  the creature carrying the mount lunchbox (or the dropped box), so younger kids can find it. */
  lbPtr!: Phaser.GameObjects.Container;
  lbArrow!: Phaser.GameObjects.Graphics;
  lbBubble!: Phaser.GameObjects.Container;
  lbT0 = 0;
  lbShown = false;
  static LB_DELAY = 10_000;

  constructor() { super('wildui'); }
  get wild() { return this.scene.get('wild') as WildScene; }

  create() {
    const cam = this.cameras.main;
    cam.setOrigin(0, 0).setZoom(DPR);
    this.rects = {};

    // Walking: tap to go, drag to steer (shared with the glade). HUD buttons keep their taps.
    this.stick = new TouchStick(this, {
      onTap: (px, py) => this.wild.tapScreen(px, py), onStick: (v) => this.wild.setStick(v),
      onPinch: (ph, r, mx, my) => this.wild.zoom?.onPinch(ph, r, mx, my),
    });
    this.zoomBtns = new ZoomButtons(this, (dir) => { if (this.wild.zoom?.step(dir)) sfx.blip(); else sfx.tock(); });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.stick.busy || this.wild.leaving || this.hit(p.x / DPR, p.y / DPR)) return;
      this.stick.begin(p);
    });

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
    this.wild.events.on('newMount', this.newMount, this);

    this.buildLunchboxPointer();

    this.paintButtons();
    if (!WILD_COMBAT) { this.heartsC.setVisible(false); this.atkC.setVisible(false); this.bagC.setVisible(false); }
    this.layout();
    this.scale.on('resize', this.layout, this);
    themeEvents.on('change', this.onTheme);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this); themeEvents.off('change', this.onTheme);
      this.wild.events.off('toast', this.toast, this); this.wild.events.off('newMount', this.newMount, this); this.wild.events.off('hearts', this.setHearts, this); this.wild.events.off('bag', this.setBag, this);
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
    if (WILD_COMBAT) this.rects.attack = { x: ax - 62, y: ay - 62, w: 124, h: 124 };
    this.bagC.setPosition(24 + si.left, this.h - 54 - si.bottom);
    this.rects.bag = { x: 24 + si.left, y: this.h - 84 - si.bottom, w: 200, h: 60 };
    this.zoomBtns.layout(68 + si.left, this.h - 340 - si.bottom); // same spot as the glade: above Call Mount
    [this.rects.zoomIn, this.rects.zoomOut] = this.zoomBtns.rects;
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

  /** Big, friendly "New mount!" card in the middle of the screen. */
  newMountC: Phaser.GameObjects.Container | null = null;
  newMount(m: { name: string; icon: string; treasure: string }) {
    this.newMountC?.destroy();
    const c = this.add.container(this.w / 2, this.h * 0.2).setDepth(60);
    const W = 460, H = 150;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.18).fillRoundedRect(-W / 2, -H / 2 + 6, W, H, 32);
    bg.fillStyle(0xfff6e4, 0.98).fillRoundedRect(-W / 2, -H / 2, W, H, 32);
    bg.lineStyle(6, 0xf2b630, 1).strokeRoundedRect(-W / 2, -H / 2, W, H, 32);
    const glow = this.add.image(-W / 2 + 80, 0, ATLAS, 'glow').setBlendMode('ADD').setTint(0xffd84a).setScale(1.6 / (frameScale.glow ?? 1));
    const ic = this.add.image(-W / 2 + 80, 0, atlasOf(m.icon), m.icon);
    ic.setScale(96 / Math.max(ic.width, ic.height));
    const t1 = this.add.text(-W / 2 + 150, -26, `New mount: ${m.name}!`, { fontFamily: FONT, fontSize: '30px', fontStyle: '900', color: INK }).setOrigin(0, 0.5).setResolution(DPR * 2);
    const t2 = this.add.text(-W / 2 + 150, 24, 'Tap Call Mount to ride.', { fontFamily: FONT, fontSize: '22px', fontStyle: '800', color: '#8a5a20' }).setOrigin(0, 0.5).setResolution(DPR * 2);
    const tw = Math.max(t1.width, t2.width) + 180;
    if (tw > W) { bg.setScale(tw / W, 1); glow.x = ic.x = -tw / 2 + 80; t1.x = t2.x = -tw / 2 + 150; }
    c.add([bg, glow, ic, t1, t2]);
    this.newMountC = c;
    this.rects.newMount = { x: this.w / 2 - Math.max(W, tw) / 2, y: this.h * 0.2 - H / 2, w: Math.max(W, tw), h: H };
    c.setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: ic, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: 5, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: c, alpha: 0, scale: 0.9, delay: 3600, duration: 400, onComplete: () => { c.destroy(); if (this.newMountC === c) { this.newMountC = null; delete this.rects.newMount; } } });
  }

  buildLunchboxPointer() {
    const [top, bot] = LUNCHBOX_TINT[theme.id] ?? LUNCHBOX_TINT.classic;
    this.lbPtr = this.add.container(0, 0).setDepth(40).setVisible(false).setAlpha(0);
    this.lbArrow = this.add.graphics();
    this.lbArrow.fillStyle(0xfff6e4, 1).fillTriangle(30, -15, 30, 15, 52, 0);
    this.lbArrow.lineStyle(3, 0xf2b630, 1).strokeTriangle(30, -15, 30, 15, 52, 0);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.16).fillCircle(0, 4, 32);
    bg.fillStyle(0xfff6e4, 0.96).fillCircle(0, 0, 32);
    bg.lineStyle(4, 0xf2b630, 1).strokeCircle(0, 0, 30);
    const glow = this.add.image(0, 0, ATLAS, 'glow').setBlendMode('ADD').setTint(0xffe27a).setScale(0.9 / (frameScale.glow ?? 1)).setAlpha(0.6);
    const k = 44 / 64; // logical lunchbox (64 px wide) drawn 44 px wide
    const mk = (key: string, y: number) => { const im = this.add.image(0, y, atlasOf(key), key).setOrigin(0.5, 1); im.setScale(k * (im.width ? 64 / im.width : 1)); return im; };
    const bodyY = 16, bodyTop = bodyY - 36 * k;
    const body = mk('lunchbox_body', bodyY).setTint(top, top, bot, bot);
    const lid = mk('lunchbox_lid', bodyTop + 4 * k).setTint(top, top, top, top);
    const latch = mk('lunchbox_latch', bodyTop + 10 * k);
    latch.setScale(body.scaleX);
    lid.setScale(body.scaleX);
    this.lbBubble = this.add.container(0, 0, [glow, bg, body, lid, latch]);
    this.lbPtr.add([this.lbArrow, this.lbBubble]);
    this.tweens.add({ targets: this.lbBubble, scale: { from: 0.94, to: 1.06 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lbT0 = this.time.now;
  }

  /** Where the mount lunchbox is right now (on the carrier's head, or dropped and still shut). */
  lunchboxTarget(): { x: number; y: number } | null {
    const wl = this.wild;
    if (!wl?.ready || wl.leaving) return null;
    if (wl.carrier?.alive && wl.carrierFx) return { x: wl.carrier.x, y: wl.carrier.y - 50 };
    const c = wl.chests.find((ch) => ch.lunchbox && !ch.opened);
    return c ? { x: c.x, y: c.y - 30 } : null;
  }

  /** Screen-space state for tests. */
  get lunchboxPointer() { return { visible: this.lbShown, x: Math.round(this.lbPtr?.x ?? 0), y: Math.round(this.lbPtr?.y ?? 0), angle: this.lbArrow?.rotation ?? 0 }; }

  tickLunchboxPointer() {
    if (!this.lbPtr) return;
    const tgt = this.time.now - this.lbT0 >= WildUIScene.LB_DELAY ? this.lunchboxTarget() : null;
    let show = false;
    if (tgt) {
      const cam = this.wild.cameras.main;
      const sx = (tgt.x - cam.worldView.x) * cam.zoom / DPR, sy = (tgt.y - cam.worldView.y) * cam.zoom / DPR;
      const pad = 24;
      const onScreen = sx > pad && sx < this.w - pad && sy > pad && sy < this.h - pad;
      if (!onScreen) {
        const si = safeInsets();
        const cx = this.w / 2, cy = this.h / 2, dx = sx - cx, dy = sy - cy;
        const mx = this.w / 2 - 64 - Math.max(si.left, si.right), my = this.h / 2 - 64 - Math.max(si.top, si.bottom);
        const t = Math.min(dx ? mx / Math.abs(dx) : Infinity, dy ? my / Math.abs(dy) : Infinity);
        let px = cx + dx * t, py = cy + dy * t;
        // Slide along the edge so it never sits on a HUD button (Home, Bop!, bag, zoom).
        for (let pass = 0; pass < 2; pass++) {
          for (const [key, r] of Object.entries(this.rects)) {
            if (key === 'newMount') continue;
            const m = 40, x0 = r.x - m, x1 = r.x + r.w + m, y0 = r.y - m, y1 = r.y + r.h + m;
            if (px < x0 || px > x1 || py < y0 || py > y1) continue;
            const opts: [number, number][] = [[px, y0], [px, y1], [x0, py], [x1, py]];
            const ok = opts.filter(([ox, oy]) => ox >= 40 && ox <= this.w - 40 && oy >= 40 && oy <= this.h - 40);
            ok.sort((a, b) => Math.hypot(a[0] - px, a[1] - py) - Math.hypot(b[0] - px, b[1] - py));
            if (ok.length) [px, py] = ok[0];
          }
        }
        this.lbPtr.setPosition(px, py);
        this.lbArrow.setRotation(Math.atan2(sy - py, sx - px));
        show = true;
      }
    }
    if (show !== this.lbShown) {
      this.lbShown = show;
      this.tweens.killTweensOf(this.lbPtr);
      if (show) { this.lbPtr.setVisible(true); this.tweens.add({ targets: this.lbPtr, alpha: 1, duration: 300 }); }
      else this.tweens.add({ targets: this.lbPtr, alpha: 0, duration: 200, onComplete: () => { if (!this.lbShown) this.lbPtr.setVisible(false); } });
    }
  }

  update() { this.stick?.update(); this.tickLunchboxPointer(); }
}
