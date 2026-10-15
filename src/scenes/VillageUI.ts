// Village HUD: resource bar, build button + tray, and the tiny cards (villager, guest,
// building, merchant). Big icons, few words, few numbers.
import Phaser from 'phaser';
import { atlasOf } from '../art';
import { DPR } from '../dpr';
import { safeInsets } from '../device';
import { sfx } from '../audio';
import { save, BuildingType, Res } from '../save';
import { theme, themeEvents } from '../theme';
import { BUILD, BUILD_ORDER, isUnlockedB, canAfford, Village, Villager, Building, ResId, Alert } from '../village/village';
import type { WorldScene } from './World';
import { unlockedMounts, type MountDef } from '../mount/defs';

const INK = '#3d2c20';
const FONT = 'Nunito, "Trebuchet MS", sans-serif';
const RES: ResId[] = ['food', 'wood', 'stone'];
const RES_ICON: Record<ResId, string> = { food: 'i_food', wood: 'i_wood', stone: 'i_stone' };

type CardBtn = { label: string; icon?: string; ok: boolean; tap: () => void; id: string };

export class VillageUIScene extends Phaser.Scene {
  w = 0; h = 0;
  bar!: Phaser.GameObjects.Container;
  barBg!: Phaser.GameObjects.Graphics;
  counts: Record<ResId, Phaser.GameObjects.Text> = {} as any;
  icons: Record<ResId, Phaser.GameObjects.Image> = {} as any;
  buildC!: Phaser.GameObjects.Container;
  buildBg!: Phaser.GameObjects.Graphics;
  buildIcon!: Phaser.GameObjects.Image;
  buildLabel!: Phaser.GameObjects.Text;
  mountC!: Phaser.GameObjects.Container;
  mountBg!: Phaser.GameObjects.Graphics;
  mountIcon!: Phaser.GameObjects.Image;
  mountLabel!: Phaser.GameObjects.Text;
  mountState = '';
  mountPicker: Phaser.GameObjects.Container | null = null;
  tray: Phaser.GameObjects.Container | null = null;
  card: Phaser.GameObjects.Container | null = null;
  cardData: any = null;
  /** Screen rects (CSS px) of tappable things, for tests. */
  rects: Record<string, { x: number; y: number; w: number; h: number }> = {};

  constructor() { super('vui'); }
  get world() { return this.scene.get('world') as WorldScene; }
  get village(): Village { return this.world.village; }

  text(x: number, y: number, str: string, size: number, color = INK, weight = 800) {
    return this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: `${weight}`, resolution: Math.max(2, DPR * 1.5) } as any);
  }
  icon(x: number, y: number, frame: string, px: number) {
    return this.add.image(x, y, atlasOf(frame), frame).setDisplaySize(px, px);
  }
  /** A tappable rounded button. Fires on release so drags don't trigger it. */
  button(x: number, y: number, w: number, h: number, fill: number, stroke: number, onTap: () => void, r = 18, id?: string) {
    const g = this.add.graphics();
    g.fillStyle(0x2a1d14, 0.22); g.fillRoundedRect(x + 1, y + 4, w, h, r);
    g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(3, stroke, 1); g.strokeRoundedRect(x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
    const z = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive();
    z.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 30) { sfx.unlock(); onTap(); } });
    if (id) this.rects[id] = { x, y, w, h };
    return [g, z] as const;
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(DPR);
    // Resource bar.
    this.barBg = this.add.graphics();
    this.bar = this.add.container(0, 0, [this.barBg]);
    RES.forEach((id, i) => {
      const x = 26 + i * 104;
      const ic = this.icon(x, 26, RES_ICON[id], 38);
      const t = this.text(x + 24, 26, '0', 24).setOrigin(0, 0.5);
      this.icons[id] = ic; this.counts[id] = t;
      this.bar.add([ic, t]);
    });
    const bz = this.add.zone(0, 0, 312, 52).setOrigin(0, 0).setInteractive();
    bz.on('pointerup', () => this.game.events.emit('toast', 'Food, wood and stone. Build and grow!'));
    this.bar.add(bz);
    // Build button.
    this.buildBg = this.add.graphics();
    this.buildIcon = this.icon(0, -4, 'i_hammer', 46);
    this.buildLabel = this.text(0, 30, 'Build', 15, '#fffaf0', 900).setOrigin(0.5).setStroke('#5a3d28', 4);
    this.buildC = this.add.container(0, 0, [this.buildBg, this.buildIcon, this.buildLabel]);
    const zb = this.add.zone(0, 0, 92, 92).setOrigin(0, 0).setInteractive(new Phaser.Geom.Circle(46, 46, 46), Phaser.Geom.Circle.Contains);
    zb.on('pointerdown', () => {
      if (this.registry.get('menuOpen') || this.card) return;
      sfx.unlock(); sfx.blip();
      this.tweens.add({ targets: this.buildC, scale: { from: 0.85, to: 1 }, duration: 220, ease: 'Back.easeOut' });
      if (this.village.building) this.village.exitBuild(); else this.village.enterBuild();
    });
    this.buildC.setData('zone', zb);
    this.drawBuildBtn();
    // Call Mount button (above Build): call the eagle; while riding it says Land.
    this.mountBg = this.add.graphics();
    this.mountIcon = this.icon(0, -6, 'i_eagle', 50);
    this.mountLabel = this.text(0, 29, 'Call Mount', 13, '#fffaf0', 900).setOrigin(0.5).setStroke('#5a3d28', 4);
    this.mountC = this.add.container(0, 0, [this.mountBg, this.mountIcon, this.mountLabel]);
    const zm = this.add.zone(0, 0, 92, 92).setOrigin(0, 0).setInteractive(new Phaser.Geom.Circle(46, 46, 46), Phaser.Geom.Circle.Contains);
    zm.on('pointerdown', () => {
      if (this.registry.get('menuOpen') || this.card || this.mountPicker) return;
      sfx.unlock();
      const m = this.world.mount;
      if (m.riding) {
        sfx.blip();
        this.tweens.add({ targets: this.mountC, scale: { from: 0.85, to: 1 }, duration: 220, ease: 'Back.easeOut' });
        m.landAt(m.gx + Math.cos(m.heading) * 90, m.gy + Math.sin(m.heading) * 90);
        return;
      }
      if (!m.canCall()) { this.tweens.add({ targets: this.mountC, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 1, onComplete: () => this.mountC.setAngle(0) }); return; }
      sfx.blip();
      this.tweens.add({ targets: this.mountC, scale: { from: 0.85, to: 1 }, duration: 220, ease: 'Back.easeOut' });
      const list = unlockedMounts();
      if (list.length <= 1) m.call(list[0]?.id ?? 'eagle');
      else this.openMountPicker(list);
    });
    this.mountC.setData('zone', zm);
    this.drawMountBtn();

    this.layout();
    this.scale.on('resize', this.layout, this);
    const ev = this.game.events;
    ev.on('res', this.onRes, this);
    ev.on('build-mode', (on: boolean) => { this.drawBuildBtn(); if (on) this.openTray(); else this.closeTray(); });
    ev.on('built', () => this.openTray());
    ev.on('card', this.openCard, this);
    ev.on('build-pick', (t: BuildingType) => { if (this.village.building) this.pick(t); });
    ev.on('alert', (a: Alert | null) => this.showAlert(a));
    ev.on('undo', (u: { label: string; run: () => void }) => this.showUndo(u));
    ev.on('snacks', () => this.drawSnacks(true));
    ev.on('build-mode', () => this.showAlert(this.village.alert));
    themeEvents.on('change', () => { this.drawBar(); this.drawBuildBtn(); this.mountState = ''; this.drawMountBtn(); if (this.tray) this.openTray(); });
    this.refresh();
    (window as any).__vui = this;
  }

  layout() {
    this.w = this.scale.width / DPR; this.h = this.scale.height / DPR;
    this.cameras.main.setZoom(DPR);
    const si = safeInsets();
    this.bar.setPosition(this.w / 2 - 156, 14 + si.top);
    this.drawBar();
    const bx = 22 + si.left + 46, by = this.h - 22 - si.bottom - 46;
    this.buildC.setPosition(bx, by);
    const z = this.buildC.getData('zone') as Phaser.GameObjects.Zone;
    z.setPosition(bx - 46, by - 46);
    this.rects.build = { x: bx - 46, y: by - 46, w: 92, h: 92 };
    const my = by - 112;
    this.mountC.setPosition(bx, my);
    (this.mountC.getData('zone') as Phaser.GameObjects.Zone).setPosition(bx - 46, my - 46);
    this.rects.mount = { x: bx - 46, y: my - 46, w: 92, h: 92 };
    this.rects.bar = { x: this.bar.x, y: this.bar.y, w: 312, h: 52 };
    if (this.tray) this.openTray();
    if (this.card) this.openCard(this.cardData);
    this.drawSnacks(false);
    if (this.alertC) this.showAlert(this.alertData);
  }

  // ------------------------------------------------------------ fruit basket, alerts, undo
  snackC: Phaser.GameObjects.Container | null = null;
  drawSnacks(bump: boolean) {
    this.snackC?.destroy(); this.snackC = null; delete this.rects.snacks;
    if (save.snacks <= 0) return;
    const x = this.bar.x + 312 + 12, y = this.bar.y;
    const g = this.add.graphics();
    g.fillStyle(0x2a1d14, 0.25); g.fillRoundedRect(2, 5, 92, 52, 26);
    g.fillStyle(0xfbf1dc, 0.95); g.fillRoundedRect(0, 0, 92, 52, 26);
    g.lineStyle(3, 0xe8604c, 1); g.strokeRoundedRect(1.5, 1.5, 89, 49, 25);
    const ic = this.add.image(28, 26, atlasOf('apple'), 'apple'); ic.setScale(34 / Math.max(ic.width, ic.height));
    const t = this.text(52, 26, `${save.snacks}`, 24).setOrigin(0, 0.5);
    const z = this.add.zone(0, 0, 92, 52).setOrigin(0, 0).setInteractive();
    z.on('pointerup', () => this.game.events.emit('toast', 'Fruit! Tap an animal to feed it.'));
    this.snackC = this.add.container(x, y, [g, ic, t, z]);
    this.rects.snacks = { x, y, w: 92, h: 52 };
    if (bump) this.tweens.add({ targets: this.snackC, scale: { from: 1.2, to: 1 }, duration: 300, ease: 'Back.easeOut' });
  }
  alertC: Phaser.GameObjects.Container | null = null;
  alertData: Alert | null = null;
  showAlert(a: Alert | null) {
    this.alertC?.destroy(); this.alertC = null; this.alertData = a;
    delete this.rects.alert; delete this.rects['alert:fix'];
    if (!a || this.village?.building) return;
    const msg = this.text(0, 0, a.text, 20, INK, 900);
    const ft = this.text(0, 0, a.fix, 19, '#fffaf0', 900).setOrigin(0, 0.5).setStroke('#2f6b24', 4);
    const bw = 58 + ft.width, W = 64 + msg.width + 20 + bw + 12, H = 60;
    const x0 = this.w / 2 - W / 2, y0 = this.bar.y + 66;
    const g = this.add.graphics();
    g.fillStyle(0x2a1d14, 0.25); g.fillRoundedRect(2, 5, W, H, 29);
    g.fillStyle(a.urgent ? 0xfff0e6 : 0xfbf1dc, 0.97); g.fillRoundedRect(0, 0, W, H, 29);
    g.lineStyle(3, a.urgent ? 0xe8604c : theme.ui.accent, 1); g.strokeRoundedRect(1.5, 1.5, W - 3, H - 3, 28);
    const ic = this.add.image(34, H / 2, atlasOf(a.icon), a.icon); ic.setScale(38 / Math.max(ic.width, ic.height));
    msg.setPosition(62, H / 2).setOrigin(0, 0.5);
    const c = this.add.container(x0, y0, [g, ic, msg]);
    const bx = W - bw - 10;
    const [bg, z] = this.button(x0 + bx, y0 + 8, bw, H - 16, 0x7cc463, 0x4f9a3c, () => { a.run(); this.showAlert(null); }, 22, 'alert:fix');
    const fic = this.icon(x0 + bx + 24, y0 + H / 2, a.fixIcon, 28);
    ft.setPosition(x0 + bx + 44, y0 + H / 2);
    const btn = this.add.container(0, 0, [bg, z, fic, ft]);
    const all = this.add.container(0, 0, [c, btn]);
    this.alertC = all;
    this.rects.alert = { x: x0, y: y0, w: W, h: H };
    all.setAlpha(0); this.tweens.add({ targets: all, alpha: 1, duration: 220 });
    if (a.urgent) this.tweens.add({ targets: ic, angle: { from: -10, to: 10 }, duration: 260, yoyo: true, repeat: 3 });
  }
  undoC: Phaser.GameObjects.Container | null = null;
  undoTimer: Phaser.Time.TimerEvent | null = null;
  showUndo(u: { label: string; run: () => void } | null) {
    this.undoC?.destroy(); this.undoC = null; this.undoTimer?.remove(); this.undoTimer = null; delete this.rects.undo;
    if (!u) return;
    const si = safeInsets();
    const W = 150, H = 56, x0 = this.w / 2 - W / 2, y0 = this.h - H - 28 - si.bottom;
    const [bg, z] = this.button(x0, y0, W, H, 0xfbf1dc, theme.ui.accent, () => { u.run(); this.showUndo(null); }, 28, 'undo');
    const g = this.add.graphics();
    g.lineStyle(4, 0x6b4a33, 1); g.beginPath(); g.arc(x0 + 36, y0 + H / 2 + 2, 11, Math.PI * 1.1, Math.PI * 2.4); g.strokePath();
    g.fillStyle(0x6b4a33, 1); g.fillTriangle(x0 + 20, y0 + H / 2 - 9, x0 + 30, y0 + H / 2 - 2, x0 + 20, y0 + H / 2 + 3);
    const t = this.text(x0 + 58, y0 + H / 2, u.label, 22, INK, 900).setOrigin(0, 0.5);
    this.undoC = this.add.container(0, 0, [bg, z, g, t]);
    this.undoTimer = this.time.delayedCall(7000, () => this.showUndo(null));
  }
  drawBar() {
    const g = this.barBg; g.clear();
    g.fillStyle(0x2a1d14, 0.25); g.fillRoundedRect(2, 5, 312, 52, 26);
    g.fillStyle(0xfbf1dc, 0.95); g.fillRoundedRect(0, 0, 312, 52, 26);
    g.lineStyle(3, theme.ui.accent, 1); g.strokeRoundedRect(1.5, 1.5, 309, 49, 25);
  }
  drawBuildBtn() {
    const g = this.buildBg; g.clear();
    const on = !!this.world?.village?.building;
    g.fillStyle(0x2a1d14, 0.3); g.fillCircle(0, 4, 44);
    g.fillStyle(on ? theme.ui.accent : 0xfbf1dc, 0.97); g.fillCircle(0, 0, 44);
    g.lineStyle(4, on ? theme.ui.accentDark : theme.ui.accent, 1); g.strokeCircle(0, 0, 40);
    this.buildLabel.setText(on ? 'Done' : 'Build');
  }
  // ------------------------------------------------------------ mount picker
  /** Big touch tiles for every unlocked mount. One mount: Call Mount skips this. */
  openMountPicker(list: MountDef[]) {
    this.closeMountPicker(true);
    this.registry.set('mountPicker', true);
    const si = safeInsets();
    const tile = 150, gap = 16;
    const n = list.length;
    const cols = Math.min(n, 3);
    const rows = Math.ceil(n / cols);
    const tw = cols * (tile + gap) - gap + 40;
    const th = rows * (tile + gap) - gap + 78;
    const tx = (this.w - tw) / 2, ty = Math.max(si.top + 60, (this.h - th) / 2 - 20);
    const c = this.add.container(0, 0).setDepth(50);
    // Dim the world so kids focus on the tiles; tap outside to close.
    const dim = this.add.graphics();
    dim.fillStyle(0x2a1d14, 0.45); dim.fillRect(0, 0, this.w, this.h);
    const dimZ = this.add.zone(0, 0, this.w, this.h).setOrigin(0, 0).setInteractive();
    dimZ.on('pointerup', () => this.closeMountPicker());
    const g = this.add.graphics();
    g.fillStyle(0x2a1d14, 0.35); g.fillRoundedRect(tx + 3, ty + 6, tw, th, 26);
    g.fillStyle(0xfbf1dc, 0.98); g.fillRoundedRect(tx, ty, tw, th, 26);
    g.lineStyle(4, theme.ui.accent, 1); g.strokeRoundedRect(tx + 5, ty + 5, tw - 10, th - 10, 22);
    const block = this.add.zone(tx, ty, tw, th).setOrigin(0, 0).setInteractive();
    const title = this.text(tx + tw / 2, ty + 26, 'Pick a mount!', 24, INK, 900).setOrigin(0.5);
    c.add([dim, dimZ, g, block, title]);
    list.forEach((m, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = tx + 20 + col * (tile + gap), y = ty + 56 + row * (tile + gap);
      const [bg, z] = this.button(x, y, tile, tile, 0xfff4d6, theme.ui.accent, () => {
        sfx.blip();
        this.closeMountPicker(true);
        this.world.mount.call(m.id);
      }, 20, `mountPick:${m.id}`);
      c.add([bg, z]);
      const ic = this.icon(x + tile / 2, y + tile * 0.42, m.icon, 80);
      const name = this.text(x + tile / 2, y + tile - 24, m.name, 17, INK, 900).setOrigin(0.5);
      c.add([ic, name]);
    });
    this.mountPicker = c;
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 160 });
  }
  closeMountPicker(instant = false) {
    if (!this.mountPicker) return;
    const c = this.mountPicker; this.mountPicker = null;
    this.registry.set('mountPicker', false);
    for (const k of Object.keys(this.rects)) if (k.startsWith('mountPick:')) delete this.rects[k];
    if (instant) c.destroy(); else this.tweens.add({ targets: c, alpha: 0, duration: 140, onComplete: () => c.destroy() });
  }

  /** Riding: accent fill + 'Land'. Can't call right now: faded. */
  drawMountBtn() {
    const m = this.world?.mount;
    const riding = !!m?.carrying;
    const ok = riding || !!m?.canCall();
    const st = `${riding}|${ok}`;
    if (st === this.mountState) return;
    this.mountState = st;
    const g = this.mountBg; g.clear();
    g.fillStyle(0x2a1d14, 0.3); g.fillCircle(0, 4, 44);
    g.fillStyle(riding ? theme.ui.accent : 0xfbf1dc, 0.97); g.fillCircle(0, 0, 44);
    g.lineStyle(4, riding ? theme.ui.accentDark : theme.ui.accent, 1); g.strokeCircle(0, 0, 40);
    this.mountLabel.setText(riding ? 'Land' : 'Call Mount').setFontSize(riding ? 15 : 13);
    const ik = riding && m ? m.def.icon : 'i_eagle';
    if (this.mountIcon.frame.name !== ik) this.mountIcon.setTexture(atlasOf(ik), ik).setDisplaySize(50, 50);
    this.mountC.setAlpha(ok ? 1 : 0.5);
  }
  refresh() {
    for (const id of RES) this.counts[id].setText(String(save.village.res[id]));
  }
  onRes(id: ResId | null, n: number, wx?: number, wy?: number) {
    if (!id || wx === undefined || wy === undefined) { this.refresh(); return; }
    // Fly an icon from the world spot to the bar, then bump the count.
    const cam = this.world.cameras.main;
    const sx = (wx - cam.worldView.x) * cam.zoom / DPR, sy = (wy - cam.worldView.y) * cam.zoom / DPR;
    const target = this.icons[id];
    const tx = this.bar.x + target.x, ty = this.bar.y + target.y;
    const fly = this.icon(sx, sy, RES_ICON[id], 40);
    const plus = this.text(sx, sy - 30, `+${n}`, 22, '#fffaf0', 900).setOrigin(0.5).setStroke('#5a3d28', 5);
    this.tweens.add({ targets: plus, y: sy - 60, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => plus.destroy() });
    this.tweens.add({
      targets: fly, x: tx, y: ty, duration: 700, delay: 150, ease: 'Sine.easeIn', onComplete: () => {
        fly.destroy();
        this.refresh();
        // Bump the count and the icon (the icon keeps its own base scale so it never balloons).
        target.setDisplaySize(38, 38);
        const base = target.scaleX;
        this.tweens.killTweensOf([this.counts[id], target]);
        this.counts[id].setScale(1);
        this.tweens.add({ targets: this.counts[id], scale: { from: 1.4, to: 1 }, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: target, scale: { from: base * 1.4, to: base }, duration: 300, ease: 'Back.easeOut', onComplete: () => target.setDisplaySize(38, 38) });
      },
    });
  }

  // ------------------------------------------------------------ build tray
  openTray() {
    this.closeTray(true);
    const v = this.village;
    const si = safeInsets();
    const cw = 108, ch = 128, gap = 10;
    const avail = this.w - 40 - si.left - si.right - 120;
    const cols = Math.max(4, Math.floor((avail + gap) / (cw + gap)));
    const rows = Math.ceil(BUILD_ORDER.length / cols);
    const tw = Math.min(BUILD_ORDER.length, cols) * (cw + gap) - gap + 36;
    const th = rows * (ch + gap) - gap + 58;
    const tx = (this.w - tw) / 2 + 50, ty = this.h - th - 14 - si.bottom;
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x2a1d14, 0.3); g.fillRoundedRect(tx + 2, ty + 6, tw, th, 24);
    g.fillStyle(0xfbf1dc, 0.97); g.fillRoundedRect(tx, ty, tw, th, 24);
    g.lineStyle(3, theme.ui.accent, 1); g.strokeRoundedRect(tx + 6, ty + 6, tw - 12, th - 12, 19);
    const block = this.add.zone(tx, ty, tw, th).setOrigin(0, 0).setInteractive();
    const tip = v.selected ? 'Tap a spot. Then tap the green check!' : 'Pick something to build!';
    const title = this.text(tx + 22, ty + 14, tip, 18, INK, 800);
    c.add([g, block, title]);
    BUILD_ORDER.forEach((t, i) => {
      const d = BUILD[t];
      const x = tx + 18 + (i % cols) * (cw + gap), y = ty + 46 + Math.floor(i / cols) * (ch + gap);
      const unlocked = isUnlockedB(t), afford = canAfford(d.cost), sel = v.selected === t;
      const [bg, z] = this.button(x, y, cw, ch, sel ? 0xfff2b0 : 0xf6ead2, sel ? theme.ui.accentDark : 0xd9b98f, () => this.pick(t), 16, `tray:${t}`);
      c.add([bg, z]);
      const im = this.add.image(x + cw / 2, y + 74, atlasOf(d.frame), d.frame).setOrigin(0.5, 1);
      const sc = Math.min((cw - 18) / im.width, 66 / im.height);
      im.setScale(sc);
      if (!unlocked) im.setTint(0x6f6a72).setAlpha(0.6);
      c.add(im);
      c.add(this.text(x + cw / 2, y + 88, d.name, 14, INK, 800).setOrigin(0.5));
      if (unlocked) {
        const keys = Object.keys(d.cost) as ResId[];
        keys.forEach((k, j) => {
          const cx = x + cw / 2 + (j - (keys.length - 1) / 2) * 46;
          const ok = save.village.res[k] >= (d.cost[k] ?? 0);
          c.add(this.icon(cx - 9, y + 112, RES_ICON[k], 22).setAlpha(ok ? 1 : 0.5));
          c.add(this.text(cx + 4, y + 112, String(d.cost[k]), 16, ok ? INK : '#c0563a', 900).setOrigin(0, 0.5));
        });
        if (!afford) { const dim = this.add.graphics(); dim.fillStyle(0xffffff, 0.35); dim.fillRoundedRect(x, y, cw, ch, 16); c.add(dim); }
      } else {
        // Padlock.
        const lg = this.add.graphics();
        lg.lineStyle(4, 0x6b5a50, 1); lg.beginPath(); lg.arc(x + cw / 2, y + 44, 9, Math.PI, 0); lg.strokePath();
        lg.fillStyle(0x8a7a70, 1); lg.fillRoundedRect(x + cw / 2 - 13, y + 44, 26, 20, 5);
        c.add(lg);
        c.add(this.text(x + cw / 2, y + 112, 'Locked', 13, '#8a6a50', 800).setOrigin(0.5));
      }
    });
    this.tray = c;
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 160 });
  }
  closeTray(instant = false) {
    if (!this.tray) return;
    const t = this.tray; this.tray = null;
    for (const k of Object.keys(this.rects)) if (k.startsWith('tray:')) delete this.rects[k];
    if (instant) t.destroy(); else this.tweens.add({ targets: t, alpha: 0, duration: 140, onComplete: () => t.destroy() });
  }
  pick(t: BuildingType) {
    const d = BUILD[t];
    if (!isUnlockedB(t)) { this.game.events.emit('toast', d.hint); sfx.softFail(); return; }
    if (!canAfford(d.cost)) { this.game.events.emit('toast', 'Not enough yet. Gather more!'); sfx.softFail(); return; }
    sfx.blip();
    this.village.select(this.village.selected === t ? null : t);
    this.openTray();
  }

  // ------------------------------------------------------------ cards
  openCard(data: any) {
    this.closeCard(true);
    if (!data) return;
    this.cardData = data;
    this.registry.set('vcard', true);
    const v = this.village;
    let title = '', portrait = '', lines: string[] = [], btns: CardBtn[] = [], needs: Villager | null = null;
    if (data.kind === 'villager' || data.kind === 'guest') {
      const vl: Villager = data.v;
      title = vl.data.name; portrait = `vil${vl.data.kind}_0`;
      lines = [vl.data.trait + '.'];
      if (data.kind === 'guest') {
        const room = save.village.villagers.length < v.beds();
        lines.push(room ? 'Can I live here?' : 'I need a home first!');
        btns = room ? [{ id: 'invite', label: 'Invite!', icon: 'i_heart', ok: true, tap: () => { if (v.invite()) { this.closeCard(); this.game.events.emit('toast', `${vl.data.name} moved in!`); } } }]
          : [{ id: 'build-home', label: 'Build a Home', icon: 'i_hammer', ok: true, tap: () => { this.closeCard(); v.enterBuild(); this.pick('home'); } }];
      } else {
        needs = vl;
        const job = vl.data.job !== null ? v.buildings.find((b) => b.data.id === vl.data.job) : null;
        lines.push(job ? `Job: ${BUILD[job.data.type].job}` : 'No job yet. Drag me to a building!');
      }
    } else if (data.kind === 'building') {
      const b: Building = data.b, d = BUILD[b.data.type];
      title = d.name; portrait = d.frame; lines = [d.blurb];
      if (d.job) lines.push(b.worker ? `${b.worker.data.name} works here.` : `Drag a friend here to be the ${d.job}!`);
      if (d.beds) lines.push(`${save.village.villagers.length} friends, ${v.beds()} beds.`);
    } else if (data.kind === 'merchant') {
      title = 'Merchant'; portrait = 'v_cart'; lines = ['Want to trade?'];
      btns = Village.TRADES.map((t, i) => ({ id: `trade:${i}`, label: '', ok: canAfford(t.give), tap: () => { if (v.trade(i)) this.openCard(data); else { sfx.softFail(); this.game.events.emit('toast', 'Not enough yet!'); } } }));
    }
    const W = Math.min(420, this.w - 40), H = 176 + (needs ? 70 : 0) + (btns.length ? (data.kind === 'merchant' ? btns.length * 66 : 74) : 0);
    const x0 = (this.w - W) / 2, y0 = Math.max(20, (this.h - H) / 2 - 20);
    const c = this.add.container(0, 0);
    const dim = this.add.rectangle(0, 0, this.w, this.h, 0x1d1510, 0.35).setOrigin(0, 0).setInteractive();
    dim.on('pointerup', () => this.closeCard());
    const g = this.add.graphics();
    g.fillStyle(0x2a1d14, 0.3); g.fillRoundedRect(x0 + 3, y0 + 8, W, H, 26);
    g.fillStyle(0xfbf1dc, 0.99); g.fillRoundedRect(x0, y0, W, H, 26);
    g.lineStyle(3.5, theme.ui.accent, 1); g.strokeRoundedRect(x0 + 7, y0 + 7, W - 14, H - 14, 20);
    const panelZone = this.add.zone(x0, y0, W, H).setOrigin(0, 0).setInteractive();
    c.add([dim, g, panelZone]);
    // Portrait in a round frame.
    g.fillStyle(0xf3e1bf, 1); g.fillCircle(x0 + 74, y0 + 84, 54);
    g.lineStyle(3, 0xd9b98f, 1); g.strokeCircle(x0 + 74, y0 + 84, 54);
    const im = this.add.image(x0 + 74, y0 + 84, atlasOf(portrait), portrait);
    im.setScale(Math.min(92 / im.width, 92 / im.height));
    c.add(im);
    if (needs) c.add(this.icon(x0 + 116, y0 + 44, needs.mood(), 40));
    c.add(this.text(x0 + 146, y0 + 40, title, 30, INK, 900));
    c.add(this.text(x0 + 146, y0 + 84, lines.join('\n'), 18, '#6b4f3a', 700).setWordWrapWidth(W - 170).setLineSpacing(4));
    let y = y0 + 160;
    if (needs) {
      const d = needs.data;
      ([['i_food', d.food], ['i_sleep', d.sleep], ['i_fun', d.fun]] as [string, number][]).forEach(([f, val], i) => {
        const x = x0 + 30 + i * ((W - 60) / 3);
        c.add(this.icon(x + 18, y + 22, f, 36));
        const bg = this.add.graphics();
        const bw = (W - 60) / 3 - 56;
        bg.fillStyle(0xe6d6b8, 1); bg.fillRoundedRect(x + 42, y + 14, bw, 16, 8);
        bg.fillStyle(val > 0.55 ? 0x7cc463 : val > 0.25 ? 0xf2c14e : 0x9fc3e8, 1); bg.fillRoundedRect(x + 42, y + 14, Math.max(16, bw * val), 16, 8);
        c.add(bg);
      });
      y += 70;
    }
    if (data.kind === 'merchant') {
      Village.TRADES.forEach((t, i) => {
        const b = btns[i];
        const [bg, z] = this.button(x0 + 30, y, W - 60, 56, b.ok ? 0xfff2b0 : 0xeee2cc, b.ok ? theme.ui.accent : 0xd9b98f, b.tap, 16, `card:${b.id}`);
        c.add([bg, z]);
        const give = Object.keys(t.give)[0] as ResId, get = Object.keys(t.get)[0] as ResId;
        const cx = x0 + W / 2;
        c.add(this.icon(cx - 80, y + 28, RES_ICON[give], 34)); c.add(this.text(cx - 58, y + 28, String(t.give[give]), 22, INK, 900).setOrigin(0, 0.5));
        c.add(this.text(cx, y + 28, '\u2192', 28, '#8a6a50', 900).setOrigin(0.5));
        c.add(this.icon(cx + 44, y + 28, RES_ICON[get], 34)); c.add(this.text(cx + 66, y + 28, String(t.get[get]), 22, INK, 900).setOrigin(0, 0.5));
        y += 66;
      });
    } else if (btns.length) {
      const b = btns[0];
      const bw = Math.min(260, W - 60);
      const [bg, z] = this.button(x0 + (W - bw) / 2, y, bw, 60, theme.ui.accent, theme.ui.accentDark, b.tap, 30, `card:${b.id}`);
      c.add([bg, z]);
      if (b.icon) c.add(this.icon(x0 + (W - bw) / 2 + 34, y + 30, b.icon, 36));
      c.add(this.text(x0 + W / 2 + 14, y + 30, b.label, 24, '#fffaf0', 900).setOrigin(0.5).setStroke('#5a3d28', 4));
    }
    // Close button.
    const [xb, xz] = this.button(x0 + W - 62, y0 + 14, 46, 46, 0xf3e6cc, 0xd9b98f, () => this.closeCard(), 23, 'card:close');
    const xg = this.add.graphics(); xg.lineStyle(4, 0x6b4a33, 1); xg.lineBetween(x0 + W - 52, y0 + 24 + 4, x0 + W - 30, y0 + 46 + 4 - 4); xg.lineBetween(x0 + W - 30, y0 + 24 + 4, x0 + W - 52, y0 + 46);
    c.add([xb, xz, xg]);
    this.card = c;
    this.rects.card = { x: x0, y: y0, w: W, h: H };
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 180 });
    sfx.blip();
    this.game.events.emit('card-opened', data.kind);
  }
  closeCard(instant = false) {
    if (!this.card) return;
    const c = this.card; this.card = null; this.cardData = null;
    for (const k of Object.keys(this.rects)) if (k.startsWith('card')) delete this.rects[k];
    if (instant) c.destroy(); else this.tweens.add({ targets: c, alpha: 0, duration: 140, onComplete: () => c.destroy() });
    this.time.delayedCall(60, () => this.registry.set('vcard', false));
  }

  update() {
    // Keep the build button out of the way while the satchel is open.
    const hide = !!this.registry.get('menuOpen');
    this.buildC.setVisible(!hide); this.bar.setVisible(!hide);
    this.snackC?.setVisible(!hide); this.alertC?.setVisible(!hide && !this.card); this.undoC?.setVisible(!hide);
    (this.buildC.getData('zone') as Phaser.GameObjects.Zone).input!.enabled = !hide;
    // Call Mount hides in build mode (and with the satchel open).
    const mh = hide || !!this.village?.building;
    if (mh && this.mountPicker) this.closeMountPicker(true);
    this.mountC.setVisible(!mh);
    (this.mountC.getData('zone') as Phaser.GameObjects.Zone).input!.enabled = !mh;
    if (!mh) this.drawMountBtn();
  }
}
export type { Res };
