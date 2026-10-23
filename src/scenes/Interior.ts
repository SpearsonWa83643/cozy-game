// 9.4 Building interiors: step inside a building. Tap things to play with them; tap Decorate to
// add, drag and put away furniture. Each building keeps its own room (saved).
import Phaser from 'phaser';
import { DPR } from '../dpr';
import { safeInsets } from '../device';
import { sfx } from '../audio';
import { save, persist } from '../save';
import { theme } from '../theme';
import { FURNITURE, FURN, furnTexture, HOME_START, type FurnDef } from '../interior/furniture';
import type { WorldScene } from './World';

const INK = '#3d2c20';
const FONT = 'Nunito';
const MAX_ITEMS = 24;
type Item = { k: string; x: number; y: number; img: Phaser.GameObjects.Image; sc: number };
export type RoomSave = { items: { k: string; x: number; y: number }[]; lampOn?: boolean };
type Rect = { x: number; y: number; w: number; h: number };
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export class InteriorScene extends Phaser.Scene {
  open = false;
  bid = -1;
  btype = '';
  title = '';
  decorating = false;
  lampOn = true;
  items: Item[] = [];
  lastAction = '';
  actions = 0;
  rects: Record<string, Rect> = {};
  room: Rect = { x: 0, y: 0, w: 0, h: 0 };
  floorTop = 0;
  w = 0; h = 0;
  private res = 2;
  private dark: Phaser.GameObjects.Rectangle | null = null;
  private glow: Phaser.GameObjects.Graphics | null = null;
  private winG: Phaser.GameObjects.Graphics | null = null;
  private bin: Phaser.GameObjects.Container | null = null;
  private hint: Phaser.GameObjects.Text | null = null;
  private drag: null | { it: Item; dx: number; dy: number; sx: number; sy: number; moved: boolean; overBin: boolean } = null;

  constructor() { super('interior'); }
  get world() { return this.scene.get('world') as WorldScene; }

  text(x: number, y: number, str: string, size: number, color = INK, weight = 800) {
    return this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: `${weight}`, resolution: Math.max(2, DPR * 1.5) } as any);
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(DPR);
    this.res = Math.max(2, Math.ceil(DPR));
    this.scale.on('resize', () => { if (this.open) this.render(); });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.game.events.on('interior', (b: { id: number; type: string; name: string }) => this.show(b));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    (window as any).__interior = this;
  }

  roomSave(): RoomSave {
    const all = (save.interiors ??= {});
    let r = all[String(this.bid)];
    if (!r) { r = all[String(this.bid)] = { items: this.btype === 'home' ? HOME_START.map((s) => ({ ...s })) : [], lampOn: true }; persist(); }
    return r;
  }
  private store() {
    const r = this.roomSave();
    r.items = this.items.map((i) => ({ k: i.k, x: +i.x.toFixed(3), y: +i.y.toFixed(3) }));
    r.lampOn = this.lampOn;
    persist();
  }

  show(b: { id: number; type: string; name: string }) {
    if (this.open || this.registry.get('menuOpen')) return;
    this.bid = b.id; this.btype = b.type; this.title = b.name;
    this.open = true; this.decorating = false;
    this.registry.set('menuOpen', true);
    this.world.path = [];
    this.world.setStick(null);
    this.lampOn = this.roomSave().lampOn !== false;
    sfx.creak();
    this.render();
    this.cameras.main.fadeIn(260, 40, 26, 18);
    this.game.events.emit('interior-opened', b.type);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.drag = null;
    sfx.creak();
    this.store();
    this.cameras.main.fadeOut(200, 40, 26, 18);
    this.cameras.main.once('camerafadeoutcomplete', () => { if (!this.open) { this.clear(); this.cameras.main.resetFX(); } });
    this.time.delayedCall(120, () => this.registry.set('menuOpen', false));
    this.game.events.emit('interior-closed');
  }

  private clear() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.items = []; this.rects = {}; this.dark = null; this.glow = null; this.winG = null; this.bin = null; this.hint = null;
  }

  // ------------------------------------------------------------------ layout + drawing
  render() {
    this.clear();
    this.w = this.scale.width / DPR; this.h = this.scale.height / DPR;
    const si = safeInsets();
    const L = si.left + 12, T = si.top + 10, Rr = this.w - si.right - 12, B = this.h - si.bottom - 10;
    const room = { x: L, y: T + 70, w: Rr - L, h: B - 112 - (T + 70) };
    this.room = room;
    this.floorTop = room.y + Math.round(room.h * 0.5);
    // Backdrop (outside the room: warm wood frame).
    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(0x6b4226, 1); bg.fillRect(0, 0, this.w, this.h);
    bg.fillStyle(0x845232, 1); for (let y = 0; y < this.h; y += 26) bg.fillRect(0, y, this.w, 12);
    this.add.rectangle(0, 0, this.w, this.h, 0, 0).setOrigin(0).setInteractive().setDepth(-11); // swallow taps
    this.drawRoom(room);
    // Items.
    for (const s of this.roomSave().items) if (FURN[s.k]) this.spawn(s.k, s.x, s.y, false);
    this.drawLight();
    this.drawTopBar(T, L, Rr);
    this.drawBottom(B - 100, L, Rr, 100);
  }

  private drawRoom(r: Rect) {
    const g = this.add.graphics().setDepth(0);
    const ft = this.floorTop;
    // Wallpaper: cream with soft stripes and little dots.
    g.fillStyle(0xfbe9cf, 1); g.fillRoundedRect(r.x, r.y, r.w, ft - r.y + 20, { tl: 22, tr: 22, bl: 0, br: 0 });
    g.fillStyle(0xf5dcb8, 1);
    for (let x = r.x + 18; x < r.x + r.w - 10; x += 56) g.fillRect(x, r.y + 6, 22, ft - r.y - 6);
    g.fillStyle(0xf0c9a0, 1);
    for (let x = r.x + 46; x < r.x + r.w - 10; x += 56) for (let y = r.y + 30; y < ft - 40; y += 48) g.fillCircle(x, y, 3);
    // Wainscot.
    g.fillStyle(0xc98a55, 1); g.fillRect(r.x, ft - 46, r.w, 46);
    g.fillStyle(0xb8794a, 1); for (let x = r.x + 10; x < r.x + r.w - 40; x += 64) g.fillRoundedRect(x, ft - 38, 54, 30, 5);
    g.fillStyle(0xe2a466, 1); g.fillRect(r.x, ft - 50, r.w, 8);
    // Floor: planks with a gradient toward the front.
    const fh = r.y + r.h - ft;
    g.fillGradientStyle(0xd09060, 0xd09060, 0xa8693c, 0xa8693c, 1); g.fillRect(r.x, ft, r.w, fh - 22);
    g.fillStyle(0xa8693c, 1); g.fillRoundedRect(r.x, r.y + r.h - 40, r.w, 40, { tl: 0, tr: 0, bl: 22, br: 22 });
    g.lineStyle(2, 0x8a5430, 0.55);
    const rows = 6;
    for (let i = 1; i <= rows; i++) { const y = ft + (fh * i) / (rows + 0.5); g.lineBetween(r.x, y, r.x + r.w, y); }
    for (let i = 0; i <= rows; i++) {
      const y0 = ft + (fh * i) / (rows + 0.5), y1 = ft + (fh * (i + 1)) / (rows + 0.5);
      for (let x = r.x + ((i * 97) % 160) + 40; x < r.x + r.w; x += 190) g.lineBetween(x, y0, x, Math.min(y1, r.y + r.h - 4));
    }
    g.fillStyle(0x6b4226, 1); g.fillRect(r.x, ft, r.w, 6); // baseboard shadow
    // Frame.
    g.lineStyle(6, 0x4a3022, 1); g.strokeRoundedRect(r.x, r.y, r.w, r.h, 22);
    // Window (center-ish), with curtains.
    const ww = Math.min(200, r.w * 0.22), wh = Math.min(140, (ft - r.y) * 0.62);
    const wx = r.x + r.w * 0.4 - ww / 2, wy = r.y + (ft - 50 - r.y - wh) / 2 + 4;
    this.rects.window = { x: wx, y: wy, w: ww, h: wh };
    this.winG = this.add.graphics().setDepth(0.5);
    this.drawWindow();
    const cg = this.add.graphics().setDepth(0.6);
    cg.fillStyle(0xe8604c, 1);
    cg.fillRoundedRect(wx - 26, wy - 14, 34, wh + 28, 12); cg.fillRoundedRect(wx + ww - 8, wy - 14, 34, wh + 28, 12);
    cg.fillStyle(0xffffff, 0.25); cg.fillRect(wx - 18, wy - 10, 6, wh + 20); cg.fillRect(wx + ww, wy - 10, 6, wh + 20);
    cg.lineStyle(3.5, 0x4a3022, 1); cg.strokeRoundedRect(wx - 26, wy - 14, 34, wh + 28, 12); cg.strokeRoundedRect(wx + ww - 8, wy - 14, 34, wh + 28, 12);
    cg.fillStyle(0x9a6238, 1); cg.fillRoundedRect(wx - 36, wy - 22, ww + 72, 12, 6); cg.strokeRoundedRect(wx - 36, wy - 22, ww + 72, 12, 6);
    // Door on the left: tap it to go back outside.
    const dw = Math.min(96, r.w * 0.1), dh = Math.min(ft - r.y - 24, 200);
    const dx = r.x + 26, dy = ft - dh + 4;
    const dg = this.add.graphics().setDepth(0.7);
    dg.fillStyle(0x4a3022, 1); dg.fillRoundedRect(dx - 7, dy - 7, dw + 14, dh + 7, { tl: 48, tr: 48, bl: 0, br: 0 });
    dg.fillGradientStyle(0x7cc463, 0x7cc463, 0x4e9a3c, 0x4e9a3c, 1); dg.fillRoundedRect(dx, dy, dw, dh, { tl: 42, tr: 42, bl: 0, br: 0 });
    dg.lineStyle(3, 0x3d7a2f, 1); dg.strokeRoundedRect(dx + 12, dy + 22, dw - 24, dh * 0.34, 14); dg.strokeRoundedRect(dx + 12, dy + dh * 0.5, dw - 24, dh * 0.4, 8);
    dg.fillStyle(0xf2c14e, 1); dg.fillCircle(dx + dw - 16, dy + dh * 0.55, 6); dg.lineStyle(2.5, 0x4a3022, 1); dg.strokeCircle(dx + dw - 16, dy + dh * 0.55, 6);
    const arrow = this.text(dx + dw / 2, dy - 22, 'Out', 18, '#fffaf0', 900).setOrigin(0.5).setStroke('#4a3022', 5).setDepth(0.8);
    this.tweens.add({ targets: arrow, y: arrow.y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.rects.door = { x: dx, y: dy, w: dw, h: dh };
    this.tapZone(this.rects.door, () => { if (!this.decorating) this.close(); }, 0.9);
  }

  private drawWindow() {
    const g = this.winG!, r = this.rects.window, night = !this.lampOn;
    g.clear();
    g.fillGradientStyle(night ? 0x1d2b5a : 0x8fd0f5, night ? 0x1d2b5a : 0x8fd0f5, night ? 0x3a4a85 : 0xd8f0ff, night ? 0x3a4a85 : 0xd8f0ff, 1);
    g.fillRect(r.x, r.y, r.w, r.h);
    if (night) {
      g.fillStyle(0xfff6c8, 1); g.fillCircle(r.x + r.w * 0.72, r.y + r.h * 0.3, 14);
      g.fillStyle(0x1d2b5a, 1); g.fillCircle(r.x + r.w * 0.72 + 7, r.y + r.h * 0.3 - 4, 12);
      g.fillStyle(0xffffff, 0.9); for (const [a, b] of [[0.2, 0.25], [0.4, 0.15], [0.3, 0.55], [0.55, 0.4], [0.85, 0.65]]) g.fillCircle(r.x + r.w * a, r.y + r.h * b, 2);
    } else {
      g.fillStyle(0xffd34d, 1); g.fillCircle(r.x + r.w * 0.78, r.y + r.h * 0.28, 15);
      g.fillStyle(0xffffff, 0.95); g.fillEllipse(r.x + r.w * 0.3, r.y + r.h * 0.35, 54, 20); g.fillEllipse(r.x + r.w * 0.38, r.y + r.h * 0.3, 34, 22);
      g.fillStyle(0x7cc463, 1); g.fillEllipse(r.x + r.w * 0.3, r.y + r.h, r.w * 0.9, r.h * 0.5); g.fillStyle(0x5fa84c, 1); g.fillEllipse(r.x + r.w * 0.85, r.y + r.h, r.w * 0.7, r.h * 0.4);
    }
    g.lineStyle(7, 0xfffaf0, 1); g.strokeRect(r.x, r.y, r.w, r.h); g.lineBetween(r.x + r.w / 2, r.y, r.x + r.w / 2, r.y + r.h); g.lineBetween(r.x, r.y + r.h / 2, r.x + r.w, r.y + r.h / 2);
    g.lineStyle(3, 0x4a3022, 1); g.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
  }

  private drawLight() {
    const r = this.room;
    this.dark = this.add.rectangle(r.x, r.y, r.w, r.h, 0x14183a, this.lampOn ? 0 : 0.38).setOrigin(0).setDepth(500);
    this.glow = this.add.graphics().setDepth(501).setBlendMode(Phaser.BlendModes.ADD);
    this.updateGlow();
  }
  private updateGlow() {
    const g = this.glow; if (!g) return;
    g.clear();
    if (!this.lampOn) return;
    for (const it of this.items) if (it.k === 'lamp') {
      const cx = it.img.x, cy = it.img.y - FURN.lamp.h * it.sc * 0.78;
      for (let i = 5; i >= 1; i--) { g.fillStyle(0xffd27a, 0.035); g.fillCircle(cx, cy, 34 * i); }
    }
  }

  private drawTopBar(T: number, L: number, R: number) {
    // Title pill.
    const tg = this.add.graphics().setDepth(1000);
    const tw = Math.max(170, this.title.length * 18 + 80);
    tg.fillStyle(0x2a1d14, 0.25); tg.fillRoundedRect(L + 2, T + 5, tw, 56, 28);
    tg.fillStyle(0xfbf1dc, 1); tg.fillRoundedRect(L, T, tw, 56, 28);
    tg.lineStyle(3.5, theme.ui.accent, 1); tg.strokeRoundedRect(L + 4, T + 4, tw - 8, 48, 24);
    const hg = this.add.graphics().setDepth(1001);
    hg.fillStyle(0xe8604c, 1); hg.fillTriangle(L + 18, T + 30, L + 38, T + 12, L + 58, T + 30);
    hg.fillStyle(0xfff1d6, 1); hg.fillRect(L + 23, T + 29, 30, 17); hg.fillStyle(0x9a5b3a, 1); hg.fillRect(L + 34, T + 34, 9, 12);
    hg.lineStyle(2.5, 0x4a3022, 1); hg.strokeTriangle(L + 18, T + 30, L + 38, T + 12, L + 58, T + 30); hg.strokeRect(L + 23, T + 29, 30, 17);
    this.text(L + 70, T + 28, this.title, 26, INK, 900).setOrigin(0, 0.5).setDepth(1001);
    // Close (X), same look as the satchel's.
    const cx = R - 56;
    this.button({ x: cx, y: T + 2, w: 52, h: 52 }, 0xf3e6cc, 0xd9b98f, 'close', () => this.close(), 26);
    const xg = this.add.graphics().setDepth(1002); xg.lineStyle(5, 0x6b4a33, 1);
    xg.lineBetween(cx + 16, T + 18, cx + 36, T + 38); xg.lineBetween(cx + 36, T + 18, cx + 16, T + 38);
    // Decorate / Done.
    const dw = 176, dx = cx - dw - 14;
    const on = this.decorating;
    this.button({ x: dx, y: T, w: dw, h: 56 }, on ? 0xfff2b0 : theme.ui.accent, on ? 0xd9a520 : theme.ui.accentDark, 'decorate', () => this.setDecorating(!this.decorating), 28);
    const bx = dx + 30, by = T + 28;
    const pg = this.add.graphics().setDepth(1002); // paintbrush icon
    pg.fillStyle(0x9a6238, 1); pg.fillRoundedRect(bx - 4, by - 2, 8, 20, 3);
    pg.fillStyle(0xd0d0d0, 1); pg.fillRect(bx - 5, by - 8, 10, 7);
    pg.fillStyle(on ? 0x7cc463 : 0xe8604c, 1); pg.fillRoundedRect(bx - 6, by - 20, 12, 13, { tl: 6, tr: 6, bl: 1, br: 1 });
    pg.lineStyle(2.5, 0x4a3022, 1); pg.strokeRoundedRect(bx - 6, by - 20, 12, 13, { tl: 6, tr: 6, bl: 1, br: 1 }); pg.strokeRoundedRect(bx - 4, by - 2, 8, 20, 3);
    this.text(dx + dw / 2 + 14, T + 28, on ? 'Done!' : 'Decorate', 24, on ? INK : '#fffaf0', 900).setOrigin(0.5).setStroke(on ? '#fff2b0' : hex(theme.ui.accentDark), on ? 0 : 5).setDepth(1002);
  }

  private drawBottom(y: number, L: number, R: number, H: number) {
    const g = this.add.graphics().setDepth(1000);
    g.fillStyle(0x2a1d14, 0.25); g.fillRoundedRect(L + 2, y + 6, R - L, H, 24);
    g.fillStyle(0xfbf1dc, 1); g.fillRoundedRect(L, y, R - L, H, 24);
    g.lineStyle(3, 0xd9b98f, 1); g.strokeRoundedRect(L + 4, y + 4, R - L - 8, H - 8, 20);
    if (!this.decorating) {
      this.hint = this.text((L + R) / 2, y + H / 2, 'Tap things to play with them!  Tap Decorate to move things around.', 21, '#6b4f3a', 800)
        .setOrigin(0.5).setDepth(1001).setWordWrapWidth(R - L - 40).setAlign('center');
      this.bin = null;
      return;
    }
    // Furniture tray: tap a piece to add it to the room.
    const n = FURNITURE.length, gap = 8;
    const sw = Math.min(92, (R - L - 24 - gap * (n - 1)) / n), sh = H - 20;
    const x0 = (L + R) / 2 - (n * sw + (n - 1) * gap) / 2;
    FURNITURE.forEach((f, i) => {
      const r = { x: x0 + i * (sw + gap), y: y + 10, w: sw, h: sh };
      this.button(r, 0xfffaf0, 0xe2c9a0, `tray:${f.id}`, () => this.add1(f), 16);
      const im = this.add.image(r.x + r.w / 2, r.y + r.h / 2 - 8, furnTexture(this, f.id, this.res)).setDepth(1002);
      im.setScale(Math.min((sw - 14) / f.w, (sh - 34) / f.h, 1) / this.res);
      this.text(r.x + r.w / 2, r.y + r.h - 12, f.name, 13, '#6b4f3a', 900).setOrigin(0.5).setDepth(1002);
    });
    // Bin (drop things here to put them away), bottom-right of the room.
    const rm = this.room;
    const bx = rm.x + rm.w - 64, by = rm.y + rm.h - 66;
    const c = this.add.container(bx, by).setDepth(900);
    const bg = this.add.graphics();
    bg.fillStyle(0x2a1d14, 0.25); bg.fillEllipse(0, 34, 70, 16);
    bg.fillStyle(0x8fa3b8, 1); bg.fillRoundedRect(-26, -16, 52, 52, { tl: 4, tr: 4, bl: 14, br: 14 });
    bg.fillStyle(0xa9bccf, 1); bg.fillRoundedRect(-32, -28, 64, 14, 6); bg.fillRoundedRect(-8, -36, 16, 10, 4);
    bg.lineStyle(3.5, 0x4a3022, 1); bg.strokeRoundedRect(-26, -16, 52, 52, { tl: 4, tr: 4, bl: 14, br: 14 }); bg.strokeRoundedRect(-32, -28, 64, 14, 6);
    bg.lineStyle(3, 0x6b7f94, 1); for (const lx of [-12, 0, 12]) bg.lineBetween(lx, -6, lx, 26);
    c.add(bg);
    this.bin = c;
    this.rects.bin = { x: bx - 40, y: by - 44, w: 80, h: 88 };
    this.hint = this.text(rm.x + rm.w / 2, rm.y + 22, 'Tap a thing below to add it. Drag to move. Drag to the bin to put away.', 18, '#fffaf0', 900)
      .setOrigin(0.5, 0).setDepth(1001).setStroke('#4a3022', 5).setAlign('center').setWordWrapWidth(rm.w - 160);
  }

  private button(r: Rect, fill: number, edge: number, id: string, onTap: () => void, rad = 16) {
    const g = this.add.graphics().setDepth(1001);
    g.fillStyle(0x2a1d14, 0.2); g.fillRoundedRect(r.x + 1, r.y + 4, r.w, r.h, rad);
    g.fillStyle(fill, 1); g.fillRoundedRect(r.x, r.y, r.w, r.h, rad);
    g.lineStyle(3, edge, 1); g.strokeRoundedRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, rad - 1);
    this.rects[id] = r;
    this.tapZone(r, () => { sfx.blip(); onTap(); }, 1003);
    return g;
  }
  private tapZone(r: Rect, onTap: () => void, depth: number) {
    const z = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive().setDepth(depth);
    z.on('pointerup', (p: Phaser.Input.Pointer) => { if (!this.drag && p.getDistance() < 24) onTap(); });
    return z;
  }

  // ------------------------------------------------------------------ items
  /** Screen spot for a stored (x, y). Floor things: y = depth across the floor (feet). Wall things: y = height on the wall (center). */
  private place(d: FurnDef, x: number, y: number) {
    const r = this.room, ft = this.floorTop;
    const px = r.x + 40 + x * (r.w - 80);
    if (d.layer === 'wall') return { px, py: r.y + 30 + d.h / 2 + y * Math.max(1, ft - 60 - r.y - 30 - d.h) };
    return { px, py: ft + 24 + y * Math.max(1, r.y + r.h - 12 - ft - 24) };
  }
  private unplace(d: FurnDef, px: number, py: number) {
    const r = this.room, ft = this.floorTop;
    const x = Phaser.Math.Clamp((px - r.x - 40) / (r.w - 80), 0, 1);
    const y = d.layer === 'wall' ? (py - (r.y + 30 + d.h / 2)) / Math.max(1, ft - 60 - r.y - 30 - d.h) : (py - ft - 24) / Math.max(1, r.y + r.h - 12 - ft - 24);
    return { x, y: Phaser.Math.Clamp(y, 0, 1) };
  }
  private depthOf(d: FurnDef, py: number) { return d.layer === 'rug' ? 1 : d.layer === 'wall' ? 2 : 10 + py / 10; }

  private spawn(k: string, x: number, y: number, fresh: boolean) {
    const d = FURN[k];
    const { px, py } = this.place(d, x, y);
    const sc = Phaser.Math.Clamp(this.room.h / 470, 0.75, 1.25);
    const img = this.add.image(px, py, furnTexture(this, k, this.res)).setOrigin(0.5, d.layer === 'wall' ? 0.5 : d.layer === 'rug' ? 0.5 : 1).setDepth(this.depthOf(d, py));
    img.setScale(sc / this.res).setInteractive();
    const it: Item = { k, x, y, img, sc };
    img.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(it, p));
    this.items.push(it);
    if (fresh) {
      img.setScale(0.2 * sc / this.res);
      this.tweens.add({ targets: img, scale: sc / this.res, duration: 420, ease: 'Back.easeOut' });
      this.sparkles(px, d.layer === 'floor' ? py - d.h * sc * 0.5 : py, 10, 0xfff1c4);
    }
    return it;
  }

  private add1(f: FurnDef) {
    if (this.items.length >= MAX_ITEMS) { this.say('The room is full! Put something in the bin first.'); sfx.softFail(); return; }
    // Find the emptiest spot on its layer so new things don't hide behind old ones.
    let x = 0.5, y = 0.5, best = -1;
    const same = this.items.filter((i) => FURN[i.k].layer === f.layer || (f.layer !== 'wall' && FURN[i.k].layer !== 'wall'));
    for (let t = 0; t < 24; t++) {
      const cx = 0.12 + Math.random() * 0.76, cy = f.layer === 'wall' ? 0.15 + Math.random() * 0.6 : 0.2 + Math.random() * 0.75;
      const dmin = same.reduce((m, i) => Math.min(m, Math.hypot(i.x - cx, (i.y - cy) * 0.6)), 9);
      if (dmin > best) { best = dmin; x = cx; y = cy; }
    }
    this.spawn(f.id, x, y, true);
    sfx.pickup();
    this.lastAction = `add:${f.id}`;
    this.store(); this.updateGlow();
  }

  private onDown(it: Item, p: Phaser.Input.Pointer) {
    if (!this.open || this.drag) return;
    const px = p.x / DPR, py = p.y / DPR;
    this.drag = { it, dx: it.img.x - px, dy: it.img.y - py, sx: px, sy: py, moved: false, overBin: false };
  }
  private onMove(p: Phaser.Input.Pointer) {
    const d = this.drag; if (!d || !p.isDown) return;
    const px = p.x / DPR, py = p.y / DPR;
    if (!d.moved && Math.hypot(px - d.sx, py - d.sy) < 10) return;
    if (!this.decorating) return; // only decorate mode moves things
    if (!d.moved) { d.moved = true; d.it.img.setDepth(800); this.tweens.add({ targets: d.it.img, scale: (d.it.sc * 1.1) / this.res, duration: 120 }); sfx.blip(); }
    const def = FURN[d.it.k], r = this.room;
    const nx = Phaser.Math.Clamp(px + d.dx, r.x + 30, r.x + r.w - 30);
    const ny = def.layer === 'wall' ? Phaser.Math.Clamp(py + d.dy, r.y + 20 + def.h / 2, this.floorTop - 50 - def.h / 2 + 10)
      : Phaser.Math.Clamp(py + d.dy, this.floorTop + 20, r.y + r.h - 6);
    d.it.img.setPosition(nx, ny);
    const b = this.rects.bin;
    const over = !!b && px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h;
    if (over !== d.overBin) { d.overBin = over; this.bin?.setScale(over ? 1.2 : 1); d.it.img.setAlpha(over ? 0.6 : 1); }
  }
  private onUp(p: Phaser.Input.Pointer) {
    const d = this.drag; if (!d) return;
    this.drag = null;
    const it = d.it, def = FURN[it.k];
    if (!d.moved) {
      if (p.getDistance() < 24) this.play(it);
      return;
    }
    if (d.overBin) {
      this.bin?.setScale(1);
      this.sparkles(it.img.x, it.img.y - 20, 12, 0xd9e4ef);
      this.tweens.add({ targets: it.img, scale: 0, alpha: 0, duration: 220, ease: 'Back.easeIn', onComplete: () => it.img.destroy() });
      this.items = this.items.filter((i) => i !== it);
      if (this.bin) this.tweens.add({ targets: this.bin, angle: { from: -8, to: 8 }, duration: 80, yoyo: true, repeat: 2, onComplete: () => this.bin?.setAngle(0) });
      sfx.thump();
      this.lastAction = `bin:${it.k}`;
    } else {
      const u = this.unplace(def, it.img.x, it.img.y);
      it.x = u.x; it.y = u.y;
      it.img.setDepth(this.depthOf(def, it.img.y));
      this.tweens.add({ targets: it.img, scaleX: { from: (it.sc * 1.18) / this.res, to: it.sc / this.res }, scaleY: { from: (it.sc * 0.86) / this.res, to: it.sc / this.res }, duration: 260, ease: 'Back.easeOut' });
      sfx.tock();
      this.lastAction = `move:${it.k}`;
    }
    this.store(); this.updateGlow();
  }

  setDecorating(on: boolean) {
    this.decorating = on;
    this.lastAction = on ? 'decorate' : 'done';
    this.store();
    this.render();
  }

  // ------------------------------------------------------------------ play (tap a thing)
  play(it: Item) {
    const img = it.img, s = it.sc / this.res, d = FURN[it.k];
    const top = d.layer === 'floor' ? img.y - d.h * it.sc : img.y - (d.h * it.sc) / 2;
    const cx = img.x;
    this.actions++;
    if (this.tweens.isTweening(img)) this.tweens.killTweensOf(img);
    img.setScale(s).setAngle(0);
    const wiggle = () => this.tweens.add({ targets: img, angle: { from: -5, to: 5 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => img.setAngle(0) });
    const squash = () => this.tweens.add({ targets: img, scaleX: { from: s * 1.12, to: s }, scaleY: { from: s * 0.88, to: s }, duration: 320, ease: 'Back.easeOut' });
    let act = 'wiggle';
    if (this.decorating) { wiggle(); this.lastAction = `${it.k}:wiggle`; return; }
    switch (it.k) {
      case 'lamp':
        this.lampOn = !this.lampOn; act = this.lampOn ? 'on' : 'off';
        sfx.tock(); squash();
        this.tweens.add({ targets: this.dark, fillAlpha: this.lampOn ? 0 : 0.38, duration: 260 });
        this.drawWindow(); this.updateGlow(); this.store();
        break;
      case 'bed':
        act = 'sleep'; squash();
        [988, 784, 659].forEach((f, i) => sfx.bell(f, i * 0.28, 0.07, 1.6));
        for (let i = 0; i < 3; i++) {
          const z = this.text(cx + 30 + i * 14, top + 10, 'z', 26 + i * 6, '#fffaf0', 900).setStroke('#4a3022', 5).setDepth(950).setAlpha(0);
          this.tweens.add({ targets: z, alpha: { from: 1, to: 0 }, y: z.y - 70, x: z.x + 24, duration: 1500, delay: i * 320, ease: 'Sine.easeOut', onComplete: () => z.destroy() });
        }
        break;
      case 'plant':
        act = 'water'; sfx.plip(); this.time.delayedCall(160, () => sfx.plip());
        for (let i = 0; i < 7; i++) {
          const dr = this.add.ellipse(cx + Phaser.Math.Between(-22, 22), top - 30 - Math.random() * 20, 7, 11, 0x6fb8e8).setStrokeStyle(2, 0x3f7fb0).setDepth(950);
          this.tweens.add({ targets: dr, y: top + 30, alpha: 0, duration: 520, delay: i * 60, ease: 'Quad.easeIn', onComplete: () => dr.destroy() });
        }
        this.tweens.add({ targets: img, scaleY: { from: s, to: s * 1.18 }, scaleX: { from: s, to: s * 0.94 }, duration: 260, delay: 420, yoyo: true, ease: 'Sine.easeOut', onComplete: () => this.sparkles(cx, top + 10, 8, 0xffe08a) });
        break;
      case 'teddy':
        act = 'hug'; sfx.giggle();
        this.tweens.add({ targets: img, y: img.y - 26, duration: 180, yoyo: true, ease: 'Quad.easeOut', onComplete: squash });
        this.hearts(cx, top, 5);
        break;
      case 'clock':
        act = 'tick'; sfx.tock(); this.time.delayedCall(260, () => sfx.tock()); this.time.delayedCall(560, () => sfx.chimes());
        this.tweens.add({ targets: img, angle: { from: -10, to: 10 }, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => img.setAngle(0) });
        break;
      case 'table':
        act = 'snack'; sfx.pickup(); squash();
        for (let i = 0; i < 3; i++) {
          const st = this.add.circle(cx - 10 + i * 6, top + 8, 7, 0xffffff, 0.85).setDepth(950);
          this.tweens.add({ targets: st, y: st.y - 60, scale: 2, alpha: 0, duration: 1100, delay: i * 200, ease: 'Sine.easeOut', onComplete: () => st.destroy() });
        }
        this.say('Yum! Snack time!', cx, top - 20);
        break;
      case 'shelf':
        act = 'story'; sfx.rustle(); wiggle();
        this.say(Phaser.Utils.Array.GetRandom(['Once upon a time...', 'A book about frogs!', 'The Moon Fox story!', 'A map of the stars!']), cx, top - 16);
        break;
      case 'chair': act = 'sit'; sfx.creak(); squash(); break;
      case 'rug': act = 'squish'; sfx.rustle(); squash(); break;
      case 'painting': act = 'look'; sfx.sparkle(); wiggle(); this.sparkles(cx, img.y, 8, 0xfff1c4); break;
      default: wiggle();
    }
    this.lastAction = `${it.k}:${act}`;
  }

  private sparkles(x: number, y: number, n: number, color: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = 30 + Math.random() * 30;
      const s = this.add.star(x, y, 4, 3, 8, color).setStrokeStyle(1.5, 0x4a3022, 0.6).setDepth(960);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0, angle: 90, duration: 600, ease: 'Quad.easeOut', onComplete: () => s.destroy() });
    }
  }
  private hearts(x: number, y: number, n: number) {
    if (!this.textures.exists('stable-heart')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xff5c8a, 1); g.fillCircle(9, 9, 8); g.fillCircle(23, 9, 8); g.fillTriangle(1.5, 12, 30.5, 12, 16, 30);
      g.fillStyle(0xffffff, 0.7); g.fillCircle(7, 6, 3);
      g.generateTexture('stable-heart', 32, 32); g.destroy();
    }
    for (let i = 0; i < n; i++) {
      const h = this.add.image(x + Phaser.Math.Between(-20, 20), y, 'stable-heart').setScale(0.9).setDepth(960);
      this.tweens.add({ targets: h, y: h.y - 70 - Math.random() * 30, x: h.x + Phaser.Math.Between(-20, 20), alpha: { from: 1, to: 0 }, duration: 1100, delay: i * 80, ease: 'Sine.easeOut', onComplete: () => h.destroy() });
    }
  }
  private sayText: Phaser.GameObjects.Container | null = null;
  say(msg: string, x = this.room.x + this.room.w / 2, y = this.room.y + 70) {
    this.sayText?.destroy();
    const t = this.text(0, 0, msg, 20, INK, 900).setOrigin(0.5);
    const w = t.width + 30, h = 42;
    const g = this.add.graphics();
    g.fillStyle(0x2a1d14, 0.2); g.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 20);
    g.fillStyle(0xfffaf0, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 20); g.lineStyle(3, 0x4a3022, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
    const bx = Phaser.Math.Clamp(x, this.room.x + w / 2 + 6, this.room.x + this.room.w - w / 2 - 6);
    const c = this.add.container(bx, Math.max(this.room.y + 30, y), [g, t]).setDepth(990).setScale(0.6);
    this.sayText = c;
    this.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1800, duration: 300, onComplete: () => { c.destroy(); if (this.sayText === c) this.sayText = null; } });
  }

  /** Test hook: screen rect of the i-th item of a kind. */
  itemRect(k: string, n = 0): Rect | null {
    const it = this.items.filter((i) => i.k === k)[n]; if (!it) return null;
    const b = it.img.getBounds();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }
}
