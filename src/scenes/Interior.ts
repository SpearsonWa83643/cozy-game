// 9.4 Building interiors: step inside a building. Tap things to play with them; tap Decorate to
// add, drag and put away furniture. Each building keeps its own room (saved).
import Phaser from 'phaser';
import { DPR } from '../dpr';
import { safeInsets } from '../device';
import { sfx } from '../audio';
import { save, persist } from '../save';
import { theme } from '../theme';
import { FURN, furnTexture, roomOf, RECIPES, type FurnDef } from '../interior/furniture';
import { react as propReact, type Prop } from '../interior/props';
import { paintRoom, paintDoor, type RoomArt } from '../interior/art';
import { openToolPicker, type ToolState } from '../interior/toolgame';
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
  meals = 0;
  coffees = 0;
  cookStage = 0;
  recipe: 'pancakes' | 'eggs' = 'pancakes';
  private pan: Phaser.GameObjects.Graphics | null = null;
  private brewing = false;
  crafted = 0;
  /** Workshop: what the bench is building, and how many hammer taps so far (3 to finish). */
  craft: null | { id: string; taps: number } = null;
  pickerOpen = false;
  /** 12.2 tool games: the open tool picker / station (null when none) and how many of each were finished this visit. */
  tool: ToolState | null = null;
  toolsDone: Record<string, number> = {};
  /** Garden: pot growth steps and flowers picked; fishing hut: fish caught (cosmetic). */
  grown = 0;
  picked = 0;
  caught = 0;
  private fishing = false;
  private ghost: Phaser.GameObjects.Image | null = null;
  rects: Record<string, Rect> = {};
  room: Rect = { x: 0, y: 0, w: 0, h: 0 };
  floorTop = 0;
  w = 0; h = 0;
  private res = 2;
  private dark: Phaser.GameObjects.Rectangle | null = null;
  private glow: Phaser.GameObjects.Graphics | null = null;
  private ambient: Phaser.Time.TimerEvent[] = [];
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
    if (!r) { r = all[String(this.bid)] = { items: roomOf(this.btype).start.map((s) => ({ ...s })), lampOn: true }; persist(); }
    return r;
  }
  store() {
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
    sfx.roomAmbience(b.type);
    this.render();
    this.cameras.main.fadeIn(260, 40, 26, 18);
    this.game.events.emit('interior-opened', b.type);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.drag = null; this.craft = null; this.pickerOpen = false;
    sfx.creak();
    sfx.roomAmbience(null);
    this.store();
    this.cameras.main.fadeOut(200, 40, 26, 18);
    this.cameras.main.once('camerafadeoutcomplete', () => { if (!this.open) { this.clear(); this.cameras.main.resetFX(); } });
    this.time.delayedCall(120, () => this.registry.set('menuOpen', false));
    this.game.events.emit('interior-closed');
  }

  private clear() {
    this.tweens.killAll();
    // NB: DisplayList.removeAll(true) only SKIPS the remove-callback (it never destroys), which left the full-screen
    // 'swallow taps' rectangle registered in this scene's input list after exit, so it kept eating every tap/drag.
    for (const c of this.children.list.slice()) c.destroy();
    this.items = []; this.rects = {}; this.dark = null; this.glow = null; this.pan = null; this.cookStage = 0; this.brewing = false; this.art = null; for (const e of this.ambient) e.remove(false); this.ambient = []; this.bin = null; this.hint = null; this.ghost = null; this.pickerOpen = false; this.tool = null; this.fishing = false;
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
    const [bgA, bgB] = ({ home: [0x6b4226, 0x845232], kitchen: [0x23706a, 0x2d8a82], workshop: [0x2e2218, 0x3d2e20], garden: [0x3a7a3a, 0x4a9248], fishhut: [0x1f4258, 0x2a566f] } as Record<string, number[]>)[this.btype] ?? [0x6b4226, 0x845232];
    bg.fillStyle(bgA, 1); bg.fillRect(0, 0, this.w, this.h);
    bg.fillStyle(bgB, 1); for (let y = 0; y < this.h; y += 26) bg.fillRect(0, y, this.w, 12);
    this.add.rectangle(0, 0, this.w, this.h, 0, 0).setOrigin(0).setInteractive().setDepth(-11); // swallow taps
    this.drawRoom(room);
    // Items.
    for (const s of this.roomSave().items) if (FURN[s.k]) this.spawn(s.k, s.x, s.y, false);
    if (this.craft) this.showGhost();
    this.drawLight();
    this.startAmbient();
    this.drawTopBar(T, L, Rr);
    this.drawBottom(B - 100, L, Rr, 100);
  }

  private art: RoomArt | null = null;
  props: Prop[] = [];
  propLog: string[] = [];
  private propTap(p: Prop) {
    this.propLog.push(p.id);
    const msg = propReact(this, p);
    this.lastAction = 'prop:' + p.id;
    this.hint?.setText(msg);
  }
  private drawRoom(r: Rect) {
    const ft = this.floorTop;
    // 12.6: each building type paints its own room (see interior/art.ts); the exit door sits in the same spot in all of them.
    const art = paintRoom(this, this.btype, r, ft, this.lampOn);
    this.art = art;
    this.rects.window = art.window ?? { x: -999, y: -999, w: 0, h: 0 };
    const fg = this.add.graphics().setDepth(0.65);
    fg.lineStyle(8, art.frame, 1); fg.strokeRoundedRect(r.x, r.y, r.w, r.h, 12);
    // Door on the left: tap it to go back outside.
    const dw = Math.min(96, r.w * 0.1), dh = Math.min(ft - r.y - 24, 200);
    const dx = r.x + 26, dy = ft - dh + 4;
    paintDoor(this, this.btype, dx, dy, dw, dh);
    const arrow = this.text(dx + dw / 2, dy - 22, 'Out', 18, '#fffaf0', 900).setOrigin(0.5).setStroke('#4a3022', 5).setDepth(0.8);
    this.tweens.add({ targets: arrow, y: arrow.y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.rects.door = { x: dx, y: dy, w: dw, h: dh };
    // 12.8: tappable props (fireplace, kettle, clock, lantern, net).
    this.props = art.props; this.propLog = [];
    art.props.forEach((p, i) => {
      this.rects['prop' + i] = { x: p.x, y: p.y, w: p.w, h: p.h };
      this.tapZone(p, () => { if (!this.decorating) this.propTap(p); }, 0.9);
    });
    this.tapZone(this.rects.door, () => { if (!this.decorating) this.close(); }, 0.9);
  }

  /** Gentle living-room motion that depends on the furniture: kitchen steam over the stove, coffee maker and any simmering pot. */
  private startAmbient() {
    if (this.btype === 'kitchen') {
      this.ambient.push(this.time.addEvent({ delay: 700, loop: true, callback: () => {
        for (const it of this.items) if (it.k === 'stove' || it.k === 'coffee') {
          const x = it.img.x + (Math.random() - 0.5) * 18, y = it.img.y - FURN[it.k].h * it.sc * 0.8;
          const p = this.add.ellipse(x, y, 12, 9, 0xffffff, 0.7).setDepth(30);
          this.tweens.add({ targets: p, y: y - 46, x: x + (Math.random() - 0.5) * 24, scale: 2.2, alpha: 0, duration: 1700, onComplete: () => p.destroy() });
        }
      } }));
    }
  }

  private drawWindow() { this.art?.redraw(!this.lampOn); }

  private drawLight() {
    const r = this.room;
    this.dark = this.add.rectangle(r.x, r.y, r.w, r.h, 0x14183a, this.lampOn ? 0 : 0.38).setOrigin(0).setDepth(500);
    this.glow = this.add.graphics().setDepth(501).setBlendMode(Phaser.BlendModes.ADD);
    this.updateGlow();
  }
  updateGlow() {
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
    if (this.btype === 'kitchen') {
      // A steaming mug.
      hg.fillStyle(0xffffff, 1); hg.fillRoundedRect(L + 22, T + 20, 26, 26, 5); hg.lineStyle(2.5, 0x4a3022, 1); hg.strokeRoundedRect(L + 22, T + 20, 26, 26, 5);
      hg.strokeCircle(L + 52, T + 32, 6); hg.fillStyle(0x8a5430, 1); hg.fillRect(L + 25, T + 23, 20, 6);
      hg.lineStyle(2.5, 0xb8b0a8, 1); hg.lineBetween(L + 30, T + 16, L + 32, T + 8); hg.lineBetween(L + 40, T + 16, L + 38, T + 8);
    } else if (this.btype === 'workshop') {
      // A hammer.
      hg.fillStyle(0xc98a55, 1); hg.fillRoundedRect(L + 34, T + 20, 8, 28, 3); hg.lineStyle(2.5, 0x4a3022, 1); hg.strokeRoundedRect(L + 34, T + 20, 8, 28, 3);
      hg.fillStyle(0x9aa6b2, 1); hg.fillRoundedRect(L + 22, T + 10, 32, 13, 3); hg.strokeRoundedRect(L + 22, T + 10, 32, 13, 3);
    } else if (this.btype === 'garden') {
      // A flower.
      hg.lineStyle(4, 0x4e9a3c, 1); hg.lineBetween(L + 38, T + 30, L + 38, T + 48);
      hg.fillStyle(0xff9fb2, 1); for (let i = 0; i < 6; i++) hg.fillCircle(L + 38 + Math.cos(i * 1.047) * 9, T + 24 + Math.sin(i * 1.047) * 9, 6.5);
      hg.fillStyle(0xffd34d, 1); hg.fillCircle(L + 38, T + 24, 6); hg.lineStyle(2.5, 0x4a3022, 1); hg.strokeCircle(L + 38, T + 24, 6);
    } else if (this.btype === 'fishhut') {
      // A fish.
      hg.fillStyle(0x6fb8e8, 1); hg.fillEllipse(L + 34, T + 28, 34, 18); hg.fillTriangle(L + 48, T + 28, L + 60, T + 18, L + 60, T + 38);
      hg.lineStyle(2.5, 0x4a3022, 1); hg.strokeEllipse(L + 34, T + 28, 34, 18); hg.strokeTriangle(L + 48, T + 28, L + 60, T + 18, L + 60, T + 38);
      hg.fillStyle(0x4a3022, 1); hg.fillCircle(L + 26, T + 26, 2.5);
    } else {
      hg.fillStyle(0xe8604c, 1); hg.fillTriangle(L + 18, T + 30, L + 38, T + 12, L + 58, T + 30);
      hg.fillStyle(0xfff1d6, 1); hg.fillRect(L + 23, T + 29, 30, 17); hg.fillStyle(0x9a5b3a, 1); hg.fillRect(L + 34, T + 34, 9, 12);
      hg.lineStyle(2.5, 0x4a3022, 1); hg.strokeTriangle(L + 18, T + 30, L + 38, T + 12, L + 58, T + 30); hg.strokeRect(L + 23, T + 29, 30, 17);
    }
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

  workshopHint() { return `Tap the workbench to build things! Tap the tool wall to wrench, hammer, saw and paint. You have ${save.village.res.wood} wood and ${save.village.res.stone} stone.`; }
  refreshHint() { if (this.hint && this.btype === 'workshop') this.hint.setText(this.workshopHint()); }

  private drawBottom(y: number, L: number, R: number, H: number) {
    const g = this.add.graphics().setDepth(1000);
    g.fillStyle(0x2a1d14, 0.25); g.fillRoundedRect(L + 2, y + 6, R - L, H, 24);
    g.fillStyle(0xfbf1dc, 1); g.fillRoundedRect(L, y, R - L, H, 24);
    g.lineStyle(3, 0xd9b98f, 1); g.strokeRoundedRect(L + 4, y + 4, R - L - 8, H - 8, 20);
    if (!this.decorating) {
      this.hint = this.text((L + R) / 2, y + H / 2, this.btype === 'kitchen' ? 'Tap the stove to cook breakfast! Tap the coffee maker for coffee. Tap Decorate to move things.'
      : this.btype === 'workshop' ? this.workshopHint() : this.btype === 'garden' ? 'Tap a flower pot to help it grow! Tap the watering can to water them all. Tap Decorate to move things.'
      : this.btype === 'fishhut' ? 'Tap the fishing hole to cast your line! Tap Decorate to move things.'
      : 'Tap things to play with them!  Tap Decorate to move things around.', 21, '#6b4f3a', 800)
        .setOrigin(0.5).setDepth(1001).setWordWrapWidth(R - L - 40).setAlign('center');
      this.bin = null;
      return;
    }
    // Furniture tray: tap a piece to add it to the room.
    const tray = roomOf(this.btype).tray.map((k) => FURN[k]).filter(Boolean);
    const n = tray.length, gap = 8;
    const sw = Math.min(92, (R - L - 24 - gap * (n - 1)) / n), sh = H - 20;
    const x0 = (L + R) / 2 - (n * sw + (n - 1) * gap) / 2;
    tray.forEach((f, i) => {
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

  spawn(k: string, x: number, y: number, fresh: boolean) {
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
    const { x, y } = this.emptiest(f);
    this.spawn(f.id, x, y, true);
    sfx.pickup();
    this.lastAction = `add:${f.id}`;
    this.store(); this.updateGlow();
  }

  /** The emptiest spot on a thing's layer, so new things don't hide behind old ones. */
  emptiest(f: FurnDef) {
    let x = 0.5, y = 0.5, best = -1;
    const same = this.items.filter((i) => FURN[i.k].layer === f.layer || (f.layer !== 'wall' && FURN[i.k].layer !== 'wall'));
    for (let t = 0; t < 24; t++) {
      const cx = 0.12 + Math.random() * 0.76, cy = f.layer === 'wall' ? 0.15 + Math.random() * 0.6 : 0.2 + Math.random() * 0.75;
      const dmin = same.reduce((m, i) => Math.min(m, Math.hypot(i.x - cx, (i.y - cy) * 0.6)), 9);
      if (dmin > best) { best = dmin; x = cx; y = cy; }
    }
    return { x, y };
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
    const k0 = it.k;
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
      case 'stove': act = this.cook(it); break;
      case 'coffee': act = this.brew(it); break;
      case 'fridge': {
        act = 'open'; sfx.creak();
        const fw = d.w * it.sc, fx = img.x - fw / 2 + 8 * it.sc, fy = img.y - d.h * it.sc + 64 * it.sc, fhh = 100 * it.sc;
        const og = this.add.graphics().setDepth(img.depth + 0.2);
        og.fillStyle(0xf4fbff, 1); og.fillRoundedRect(fx, fy, fw - 16 * it.sc, fhh, 6); og.lineStyle(3, 0x4a3022, 1); og.strokeRoundedRect(fx, fy, fw - 16 * it.sc, fhh, 6);
        og.lineStyle(2.5, 0x9fb4c4, 1); og.lineBetween(fx + 4, fy + fhh * 0.5, fx + fw - 20 * it.sc, fy + fhh * 0.5);
        const foods: [number, number, number][] = [[0.2, 0.36, 0xe8604c], [0.45, 0.36, 0xf6c453], [0.7, 0.36, 0x7cc463], [0.3, 0.85, 0xfffaf0], [0.62, 0.85, 0xff9fb2]];
        for (const [a, b, col] of foods) { og.fillStyle(col, 1); og.fillCircle(fx + (fw - 16 * it.sc) * a, fy + fhh * b, 7 * it.sc); og.lineStyle(2, 0x4a3022, 1); og.strokeCircle(fx + (fw - 16 * it.sc) * a, fy + fhh * b, 7 * it.sc); }
        og.setAlpha(0); this.tweens.add({ targets: og, alpha: 1, duration: 120, yoyo: true, hold: 1100, onComplete: () => og.destroy() });
        this.say(Phaser.Utils.Array.GetRandom(['Milk and apples!', 'Cheese and berries!', 'Brrr, so cold!', 'Yummy snacks inside!']), cx, top - 16);
        break;
      }
      case 'sink':
        act = 'wash'; sfx.plip(); this.time.delayedCall(140, () => sfx.plip()); this.time.delayedCall(300, () => sfx.plip());
        for (let i = 0; i < 9; i++) {
          const bb = this.add.circle(cx + Phaser.Math.Between(-30, 30) * it.sc, top + 40 * it.sc, Phaser.Math.Between(5, 10), 0xe8f6ff, 0.9).setStrokeStyle(2, 0x6fb8e8).setDepth(950);
          this.tweens.add({ targets: bb, y: bb.y - 50 - Math.random() * 40, x: bb.x + Phaser.Math.Between(-16, 16), alpha: 0, duration: 900, delay: i * 70, ease: 'Sine.easeOut', onComplete: () => bb.destroy() });
        }
        this.say('Splish splash! All clean!', cx, top - 16);
        break;
      case 'workbench': act = this.craft ? this.hammer(it) : this.openPicker(); break;
      case 'lumber': {
        act = 'count'; sfx.rustle(); wiggle();
        const r = save.village.res;
        this.say(`${r.wood} wood and ${r.stone} stone!`, cx, top - 16);
        break;
      }
      case 'toolwall': act = 'tools'; sfx.tock(); wiggle(); this.say('Pick a tool!', cx, top - 16); openToolPicker(this); break;
      case 'toyboat':
        act = 'sail'; sfx.plip();
        this.tweens.add({ targets: img, angle: { from: -9, to: 9 }, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => img.setAngle(0) });
        this.say('Toot toot! Ahoy!', cx, top - 16);
        break;
      case 'birdhouse': {
        act = 'tweet'; [1568, 1760, 1568].forEach((f, i) => sfx.bell(f, i * 0.12, 0.05, 0.3));
        const bird = this.add.ellipse(cx, img.y + 8 * it.sc, 18, 15, 0x6fb8e8).setStrokeStyle(2.5, 0x4a3022).setDepth(img.depth + 0.5).setScale(0.2);
        this.tweens.add({ targets: bird, scale: 1, y: bird.y - 34, duration: 300, ease: 'Back.easeOut', yoyo: true, hold: 600, onComplete: () => bird.destroy() });
        this.say('Tweet tweet!', cx, top - 16);
        break;
      }
      case 'stonefrog':
        act = 'ribbit'; sfx.bell(196, 0, 0.09, 0.25); sfx.bell(165, 0.14, 0.09, 0.25);
        this.tweens.add({ targets: img, y: img.y - 30, duration: 180, yoyo: true, ease: 'Quad.easeOut', onComplete: squash });
        this.say('Ribbit!', cx, top - 16);
        break;
      case 'rockinghorse':
        act = 'rock'; sfx.creak(); sfx.giggle();
        this.tweens.add({ targets: img, angle: { from: -8, to: 8 }, duration: 320, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => img.setAngle(0) });
        this.say('Giddy up!', cx, top - 16);
        break;
      case 'cog': act = 'spin'; sfx.clank(); this.tweens.add({ targets: img, angle: 360, duration: 900, ease: 'Cubic.easeOut', onComplete: () => img.setAngle(0) }); this.say('Whirr, clank!', cx, top - 16); break;
      case 'sign': act = 'swing'; sfx.tock(); this.tweens.add({ targets: img, angle: { from: -7, to: 7 }, duration: 240, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => img.setAngle(0) }); this.say('Welcome!', cx, top - 16); break;
      case 'musicbox': {
        act = 'play';
        [659.25, 783.99, 880, 1046.5, 880, 783.99].forEach((f, i) => sfx.bell(f, i * 0.28, 0.07, 1.2));
        squash();
        for (let i = 0; i < 3; i++) {
          const n = this.text(cx - 18 + i * 18, top + 4, '\u266A', 30, '#e0608a', 900).setStroke('#fffaf0', 5).setOrigin(0.5).setDepth(img.depth + 1);
          this.tweens.add({ targets: n, y: n.y - 56, x: n.x + (i - 1) * 16, alpha: { from: 1, to: 0 }, duration: 1100, delay: i * 280, ease: 'Sine.easeOut', onComplete: () => n.destroy() });
        }
        break;
      }
      case 'stool': act = 'sit'; sfx.creak(); squash(); this.say('Sturdy!', cx, top - 16); break;
      case 'paintedhouse': {
        act = 'tweet'; [1760, 1976, 1760].forEach((f, i) => sfx.bell(f, i * 0.12, 0.05, 0.3));
        const bird = this.add.ellipse(cx, img.y - 72 * it.sc, 18, 15, 0xff8fb4).setStrokeStyle(2.5, 0x4a3022).setDepth(img.depth + 0.5).setScale(0.2);
        this.tweens.add({ targets: bird, scale: 1, y: bird.y - 30, duration: 300, ease: 'Back.easeOut', yoyo: true, hold: 600, onComplete: () => bird.destroy() });
        this.say('Tweet tweet!', cx, top - 16);
        break;
      }
      case 'pot': case 'pot_1': case 'pot_2': act = this.grow(it, true) ? 'grow' : 'wait'; break;
      case 'pot_3': {
        act = 'pick'; this.picked++; sfx.pickup(); squash();
        this.setK(it, 'pot');
        this.hearts(cx, top + 20, 5); this.sparkles(cx, top + 20, 10, 0xff9fb2);
        this.say(Phaser.Utils.Array.GetRandom(['A flower for you!', 'So pretty! Plant another!', 'Smells sweet!']), cx, top - 16);
        this.store();
        break;
      }
      case 'wateringcan': {
        const pots = this.items.filter((i) => i.k === 'pot' || i.k === 'pot_1' || i.k === 'pot_2');
        this.tweens.add({ targets: img, angle: { from: 0, to: 24 }, duration: 220, yoyo: true, hold: 500, ease: 'Sine.easeOut', onComplete: () => img.setAngle(0) });
        if (!pots.length) { act = 'none'; sfx.softFail(); this.say(this.items.some((i) => i.k === 'pot_3') ? 'Pick the flowers first!' : 'Add a flower pot to water!', cx, top - 16); break; }
        act = 'water'; pots.forEach((p) => this.grow(p, false));
        this.say(pots.length > 1 ? 'Splish! Everyone got a drink!' : 'Splish! Grow, little plant!', cx, top - 16);
        this.store();
        break;
      }
      case 'seedrack': act = 'seeds'; sfx.rustle(); wiggle(); this.say(Phaser.Utils.Array.GetRandom(['Sunflower seeds!', 'Tulip seeds!', 'Carrot seeds!', 'Pumpkin seeds!']), cx, top - 16); break;
      case 'veggiebasket': {
        act = 'count'; sfx.rustle(); squash();
        const f = save.village.res.food;
        this.say(f ? `${f} food for the village! Yum!` : 'Empty! Gardeners grow more.', cx, top - 16);
        break;
      }
      case 'fishhole': act = this.castLine(it); break;
      case 'rodrack': act = 'rods'; sfx.tock(); wiggle(); this.say(Phaser.Utils.Array.GetRandom(['Red, yellow and green rods!', 'Gone fishing!', 'Cast, wait, splash!']), cx, top - 16); break;
      case 'fishbarrel': {
        act = 'count'; sfx.splash(); wiggle();
        const n = Object.keys(save.fish).filter((k) => k !== 'old_boot').length;
        this.say(n ? `You know ${n} kind${n > 1 ? 's' : ''} of fish!` : 'Go catch your first fish!', cx, top - 16);
        break;
      }
      case 'lifering': act = 'spin'; sfx.blip(); this.tweens.add({ targets: img, angle: 360, duration: 700, ease: 'Cubic.easeOut', onComplete: () => img.setAngle(0) }); this.say('Safety first!', cx, top - 16); break;
      case 'chair': act = 'sit'; sfx.creak(); squash(); break;
      case 'rug': act = 'squish'; sfx.rustle(); squash(); break;
      case 'painting': act = 'look'; sfx.sparkle(); wiggle(); this.sparkles(cx, img.y, 8, 0xfff1c4); break;
      default: wiggle();
    }
    this.lastAction = `${k0}:${act}`;
  }

  /** Swap what a placed thing is (a pot growing), keeping its spot. */
  private setK(it: Item, k: string) {
    it.k = k; it.img.setTexture(furnTexture(this, k, this.res));
  }

  /** Garden: water a pot so it grows one step (soil → sprout → bud → bloom). */
  private grow(it: Item, solo: boolean): boolean {
    const stage = it.k === 'pot' ? 0 : +it.k.slice(4);
    if (stage >= 3) return false;
    const next = stage + 1, img = it.img, d = FURN.pot, top = img.y - d.h * it.sc, cx = img.x;
    sfx.plip(); this.time.delayedCall(140, () => sfx.plip());
    for (let i = 0; i < 6; i++) {
      const dr = this.add.ellipse(cx + Phaser.Math.Between(-18, 18), top - 10 - Math.random() * 20, 7, 11, 0x6fb8e8).setStrokeStyle(2, 0x3f7fb0).setDepth(950);
      this.tweens.add({ targets: dr, y: top + 60 * it.sc, alpha: 0, duration: 480, delay: i * 50, ease: 'Quad.easeIn', onComplete: () => dr.destroy() });
    }
    this.time.delayedCall(380, () => {
      if (!this.open || !img.active) return;
      const s = it.sc / this.res;
      img.setTexture(furnTexture(this, next ? `pot_${next}` : 'pot', this.res));
      this.tweens.add({ targets: img, scaleY: { from: s * 0.82, to: s }, scaleX: { from: s * 1.1, to: s }, duration: 360, ease: 'Back.easeOut' });
      this.sparkles(cx, top + 20, next === 3 ? 12 : 6, next === 3 ? 0xff9fb2 : 0xc8f0a0);
      if (next === 3) sfx.chimes();
    });
    it.k = `pot_${next}`; this.grown++;
    if (solo) { this.say(next === 1 ? 'A tiny sprout! Tap again!' : next === 2 ? 'A flower bud! One more!' : 'It bloomed! Tap to pick it!', cx, top - 16); this.store(); }
    return true;
  }

  /** Fishing hut: drop a line in the hole, wait for a nibble, and a fish hops out (then back in). */
  private castLine(it: Item): string {
    const img = it.img, cx = img.x, cy = img.y + 2;
    if (this.fishing) { this.say('Shh... wait for a nibble!', cx, cy - 70); return 'wait'; }
    this.fishing = true; sfx.cast();
    const bob = this.add.container(cx, cy - 140).setDepth(img.depth + 0.5);
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1); bg.fillCircle(0, 0, 9); bg.fillStyle(0xe8604c, 1); bg.slice(0, 0, 9, Math.PI, 0, false); bg.fillPath();
    bg.lineStyle(3, 0x4a3022, 1); bg.strokeCircle(0, 0, 9); bg.lineStyle(1.5, 0x4a3022, 0.7); bg.lineBetween(0, -9, 0, -200);
    bob.add(bg);
    this.tweens.add({ targets: bob, y: cy, duration: 380, ease: 'Quad.easeIn', onComplete: () => {
      sfx.plip();
      this.tweens.add({ targets: bob, y: cy + 5, duration: 160, yoyo: true, repeat: 2, delay: 260 });
    } });
    this.say('Plop! Waiting...', cx, cy - 70);
    this.time.delayedCall(1250, () => {
      if (!this.open) return;
      bob.destroy(); sfx.splash(); sfx.caught();
      this.fishing = false; this.caught++;
      const kinds: [string, number][] = [['minnow', 0xa9bccf], ['sunfish', 0xff9a3c], ['little trout', 0x9ad46b], ['bluegill', 0x6fb8e8]];
      const [name, col] = kinds[this.caught % kinds.length];
      const fish = this.add.container(cx, cy).setDepth(950);
      const fg = this.add.graphics();
      fg.fillStyle(col, 1); fg.fillEllipse(0, 0, 44, 22); fg.fillTriangle(18, 0, 34, -12, 34, 12);
      fg.lineStyle(3, 0x4a3022, 1); fg.strokeEllipse(0, 0, 44, 22); fg.strokeTriangle(18, 0, 34, -12, 34, 12);
      fg.fillStyle(0x4a3022, 1); fg.fillCircle(-12, -3, 3);
      fish.add(fg);
      this.tweens.add({ targets: fish, y: cy - 110, angle: -20, duration: 420, ease: 'Quad.easeOut', yoyo: true, hold: 700, onYoyo: () => { this.hearts(cx, cy - 120, 3); }, onComplete: () => { fish.destroy(); sfx.plip(); } });
      for (let i = 0; i < 6; i++) {
        const dr = this.add.circle(cx, cy, 5, 0xbfe6f8).setStrokeStyle(2, 0x3f7fb0).setDepth(951);
        this.tweens.add({ targets: dr, x: cx + Phaser.Math.Between(-60, 60), y: cy - 30 - Math.random() * 40, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => dr.destroy() });
      }
      this.say(`You caught a ${name}! Splash, back it goes!`, cx, cy - 150);
      this.lastAction = 'fishhole:caught';
    });
    return 'cast';
  }

  /** Breakfast in three taps: Pour/Crack, Flip, then it hops onto a plate. */
  private cook(it: Item): string {
    const img = it.img, d = FURN.stove, sc = it.sc;
    const bx = img.x + (d.w * 0.3 - d.w / 2) * sc, by = img.y - d.h * sc + 14 * sc;
    const drawPan = (stage: number) => {
      const g = (this.pan ??= this.add.graphics());
      g.setDepth(img.depth + 0.3).setPosition(bx, by).clear();
      g.fillStyle(0x2f353c, 1); g.fillRoundedRect(22 * sc, -4 * sc, 36 * sc, 8 * sc, 4);
      g.fillEllipse(0, 0, 50 * sc, 18 * sc); g.lineStyle(3, 0x1a1d22, 1); g.strokeEllipse(0, 0, 50 * sc, 18 * sc);
      if (stage === 0) return;
      if (this.recipe === 'pancakes') {
        g.fillStyle(stage === 1 ? 0xf6e2a8 : 0xd9953e, 1); g.fillEllipse(0, -3 * sc, 36 * sc, 12 * sc);
        if (stage === 2) { g.fillStyle(0xb8732a, 1); g.fillEllipse(-5 * sc, -4 * sc, 8 * sc, 3 * sc); g.fillEllipse(6 * sc, -2 * sc, 6 * sc, 2 * sc); }
      } else {
        g.fillStyle(0xffffff, 1); g.fillEllipse(-2 * sc, -3 * sc, 34 * sc, 12 * sc);
        g.fillStyle(stage === 1 ? 0xffd34d : 0xf6a623, 1); g.fillCircle(0, -5 * sc, 6 * sc);
      }
    };
    const steam = () => {
      for (let i = 0; i < 3; i++) {
        const st = this.add.circle(bx - 8 + i * 8, by - 8, 6, 0xffffff, 0.8).setDepth(950);
        this.tweens.add({ targets: st, y: st.y - 50, scale: 2, alpha: 0, duration: 900, delay: i * 150, ease: 'Sine.easeOut', onComplete: () => st.destroy() });
      }
    };
    const pc = this.recipe === 'pancakes';
    if (this.cookStage === 0) {
      this.cookStage = 1; drawPan(1); sfx.plip(); steam();
      this.say(pc ? 'Pour the batter! Tap again to flip.' : 'Crack an egg! Tap again to cook.', img.x, by - 40);
      return pc ? 'pour' : 'crack';
    }
    if (this.cookStage === 1) {
      this.cookStage = 2; sfx.tock(); steam();
      const pan = this.pan!;
      this.tweens.add({ targets: pan, y: by - 26, duration: 160, yoyo: true, ease: 'Quad.easeOut', onYoyo: () => drawPan(2) });
      this.say(pc ? 'Flip! Tap once more!' : 'Sizzle! Tap once more!', img.x, by - 40);
      return pc ? 'flip' : 'sizzle';
    }
    // Done: food hops onto a plate on the nearest table (or above the stove).
    this.cookStage = 0; drawPan(0);
    this.meals++;
    const tables = this.items.filter((i) => i.k === 'table');
    const tb = tables.sort((a, b) => Phaser.Math.Distance.Between(a.img.x, a.img.y, img.x, img.y) - Phaser.Math.Distance.Between(b.img.x, b.img.y, img.x, img.y))[0];
    const tx = tb ? tb.img.x - 10 * tb.sc : img.x, ty = tb ? tb.img.y - FURN.table.h * tb.sc + 18 * tb.sc : by - 60;
    const plate = this.add.container(bx, by).setDepth(Math.max(img.depth, tb ? tb.img.depth : 0) + 0.5);
    const pg = this.add.graphics();
    pg.fillStyle(0xfdf6ea, 1); pg.fillEllipse(0, 0, 46 * sc, 14 * sc); pg.lineStyle(2.5, 0x4a3022, 1); pg.strokeEllipse(0, 0, 46 * sc, 14 * sc);
    if (pc) { for (let i = 0; i < 3; i++) { pg.fillStyle(0xd9953e, 1); pg.fillEllipse(0, (-4 - i * 5) * sc, 32 * sc, 9 * sc); pg.lineStyle(2, 0x8a5430, 1); pg.strokeEllipse(0, (-4 - i * 5) * sc, 32 * sc, 9 * sc); }
      pg.fillStyle(0xfff6c8, 1); pg.fillRoundedRect(-5 * sc, -22 * sc, 10 * sc, 6 * sc, 2); }
    else { pg.fillStyle(0xffffff, 1); pg.fillEllipse(-6 * sc, -3 * sc, 22 * sc, 9 * sc); pg.fillEllipse(8 * sc, -3 * sc, 20 * sc, 8 * sc); pg.fillStyle(0xf6a623, 1); pg.fillCircle(-6 * sc, -5 * sc, 4.5 * sc); pg.fillCircle(8 * sc, -5 * sc, 4 * sc); }
    plate.add(pg);
    this.tweens.add({ targets: plate, x: tx, duration: 520, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: plate, y: { from: by, to: ty }, duration: 520, ease: 'Back.easeOut' });
    this.time.delayedCall(540, () => { this.sparkles(tx, ty - 10, 10, 0xfff1c4); this.hearts(tx, ty - 20, 4); sfx.chimes(); });
    this.tweens.add({ targets: plate, alpha: 0, delay: 3200, duration: 400, onComplete: () => plate.destroy() });
    this.say(pc ? 'Pancakes for breakfast! Yum!' : 'Eggs for breakfast! Yum!', tx, ty - 50);
    this.recipe = pc ? 'eggs' : 'pancakes';
    return 'breakfast';
  }

  /** Coffee: the mug fills up drip by drip, then steams. */
  private brew(it: Item): string {
    if (this.brewing) { this.say('Almost ready...', it.img.x, it.img.y - FURN.coffee.h * it.sc - 10); return 'wait'; }
    this.brewing = true;
    const img = it.img, d = FURN.coffee, sc = it.sc;
    const left = img.x - (d.w / 2) * sc, top = img.y - d.h * sc;
    const mx = left + 44 * sc, my = top + 30 * sc, mw = 18 * sc, mh = 16 * sc;
    const fill = this.add.graphics().setDepth(img.depth + 0.3);
    const drops: Phaser.GameObjects.Arc[] = [];
    sfx.plip();
    const st = { f: 0 };
    this.tweens.add({ targets: st, f: 1, duration: 1300, ease: 'Linear', onUpdate: () => {
      fill.clear(); fill.fillStyle(0x8a5430, 1); const h = (mh - 5) * st.f; fill.fillRect(mx + 2.5, my + mh - 2.5 - h, mw - 5, h);
    } });
    for (let i = 0; i < 6; i++) this.time.delayedCall(i * 200, () => {
      const dr = this.add.circle(mx + mw / 2, top + 24 * sc, 2.5 * sc, 0x6b3f22).setDepth(img.depth + 0.4); drops.push(dr);
      this.tweens.add({ targets: dr, y: my + 4 * sc, duration: 180, onComplete: () => dr.destroy() });
      if (i % 2) sfx.plip();
    });
    this.time.delayedCall(1350, () => {
      this.brewing = false; this.coffees++;
      for (let i = 0; i < 3; i++) {
        const s2 = this.add.circle(mx + mw / 2 - 6 + i * 6, my - 4, 5, 0xffffff, 0.85).setDepth(950);
        this.tweens.add({ targets: s2, y: s2.y - 54, scale: 2, alpha: 0, duration: 1000, delay: i * 180, ease: 'Sine.easeOut', onComplete: () => s2.destroy() });
      }
      sfx.chimes(); this.sparkles(mx + mw / 2, my, 8, 0xfff1c4);
      this.say('Coffee is ready! Sip sip!', img.x, top - 16);
      this.tweens.add({ targets: fill, alpha: 0, delay: 2200, duration: 400, onComplete: () => fill.destroy() });
    });
    return 'brew';
  }

  // ------------------------------------------------------------------ workshop (build things)
  private canPay(cost: { wood?: number; stone?: number }) {
    const r = save.village.res; return r.wood >= (cost.wood ?? 0) && r.stone >= (cost.stone ?? 0);
  }
  private costText(cost: { wood?: number; stone?: number }) {
    return [cost.wood ? `${cost.wood} wood` : '', cost.stone ? `${cost.stone} stone` : ''].filter(Boolean).join(' + ');
  }
  /** Tap the workbench: a big friendly card of things to build. */
  openPicker(): string {
    if (this.pickerOpen) return 'pick';
    this.pickerOpen = true;
    const rm = this.room, objs: Phaser.GameObjects.GameObject[] = [];
    const closeP = () => { objs.forEach((o) => o.destroy()); this.pickerOpen = false; for (const k of Object.keys(this.rects)) if (k.startsWith('craft:') || k === 'pick-close') delete this.rects[k]; };
    const dim = this.add.rectangle(0, 0, this.w, this.h, 0x2a1d14, 0.35).setOrigin(0).setDepth(1100).setInteractive();
    dim.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 24) { sfx.blip(); closeP(); } });
    objs.push(dim);
    const n = RECIPES.length, cw = Math.min(170, (rm.w - 80) / n - 14), ch = cw + 70;
    const pw = n * cw + (n - 1) * 14 + 48, ph = ch + 120;
    const px = rm.x + rm.w / 2 - pw / 2, py = Math.max(rm.y + 10, rm.y + rm.h / 2 - ph / 2);
    const g = this.add.graphics().setDepth(1101);
    g.fillStyle(0x2a1d14, 0.25); g.fillRoundedRect(px + 2, py + 6, pw, ph, 26);
    g.fillStyle(0xfbf1dc, 1); g.fillRoundedRect(px, py, pw, ph, 26);
    g.lineStyle(4, 0xd9b98f, 1); g.strokeRoundedRect(px + 5, py + 5, pw - 10, ph - 10, 22);
    objs.push(g);
    const blocker = this.add.zone(px, py, pw, ph).setOrigin(0).setInteractive().setDepth(1101); objs.push(blocker);
    objs.push(this.text(px + pw / 2, py + 36, 'What shall we build?', 28, INK, 900).setOrigin(0.5).setDepth(1102));
    const r = save.village.res;
    objs.push(this.text(px + pw / 2, py + ph - 30, `You have ${r.wood} wood and ${r.stone} stone.`, 19, '#6b4f3a', 800).setOrigin(0.5).setDepth(1102));
    RECIPES.forEach((rc, i) => {
      const d = FURN[rc.id], ok = this.canPay(rc.cost);
      const cr = { x: px + 24 + i * (cw + 14), y: py + 64, w: cw, h: ch };
      const cg = this.add.graphics().setDepth(1102);
      cg.fillStyle(0x2a1d14, 0.18); cg.fillRoundedRect(cr.x + 1, cr.y + 4, cr.w, cr.h, 18);
      cg.fillStyle(ok ? 0xfffaf0 : 0xeee4d2, 1); cg.fillRoundedRect(cr.x, cr.y, cr.w, cr.h, 18);
      cg.lineStyle(3.5, ok ? theme.ui.accent : 0xd2c2a8, 1); cg.strokeRoundedRect(cr.x + 2, cr.y + 2, cr.w - 4, cr.h - 4, 16);
      objs.push(cg);
      const im = this.add.image(cr.x + cr.w / 2, cr.y + cw / 2 + 6, furnTexture(this, rc.id, this.res)).setDepth(1103);
      im.setScale(Math.min((cw - 30) / d.w, (cw - 30) / d.h) / this.res).setAlpha(ok ? 1 : 0.55);
      objs.push(im);
      objs.push(this.text(cr.x + cr.w / 2, cr.y + cw + 14, d.name, 20, INK, 900).setOrigin(0.5).setDepth(1103));
      objs.push(this.text(cr.x + cr.w / 2, cr.y + cw + 42, this.costText(rc.cost), 17, ok ? '#4e9a3c' : '#b0503c', 900).setOrigin(0.5).setDepth(1103));
      this.rects[`craft:${rc.id}`] = cr;
      const z = this.add.zone(cr.x, cr.y, cr.w, cr.h).setOrigin(0).setInteractive().setDepth(1104); objs.push(z);
      z.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.getDistance() >= 24) return;
        if (!this.canPay(rc.cost)) {
          sfx.softFail(); this.lastAction = `need:${rc.id}`;
          this.tweens.add({ targets: [im], angle: { from: -8, to: 8 }, duration: 80, yoyo: true, repeat: 2, onComplete: () => im.setAngle(0) });
          this.say(`Need ${this.costText(rc.cost)}. Workshop friends can make more!`);
          return;
        }
        if (this.items.length >= MAX_ITEMS) { sfx.softFail(); closeP(); this.say('The room is full! Put something in the bin first.'); return; }
        sfx.pickup(); closeP();
        this.craft = { id: rc.id, taps: 0 };
        this.showGhost();
        const wb = this.items.find((i) => i.k === 'workbench');
        this.say('Tap the workbench to hammer! Bonk bonk bonk!', wb?.img.x, wb ? wb.img.y - FURN.workbench.h * wb.sc - 40 : undefined);
        this.lastAction = `workbench:start:${rc.id}`;
      });
    });
    const cx = px + pw - 54, cy = py + 12;
    this.button({ x: cx, y: cy, w: 42, h: 42 }, 0xf3e6cc, 0xd9b98f, 'pick-close', () => closeP(), 21).setDepth(1104);
    const zx = this.add.graphics().setDepth(1105); zx.lineStyle(4.5, 0x6b4a33, 1);
    zx.lineBetween(cx + 13, cy + 13, cx + 29, cy + 29); zx.lineBetween(cx + 29, cy + 13, cx + 13, cy + 29);
    objs.push(zx);
    // The button helper adds a graphic + zone at fixed depths; lift and track them.
    const last = this.children.list.slice(-3) as any[];
    for (const o of last) { if (o !== zx) { o.setDepth?.(o.type === 'Zone' ? 1106 : 1104); objs.push(o); } }
    return 'pick';
  }
  /** The thing being built, faint on the bench; it fills in with each hammer tap. */
  private showGhost() {
    const wb = this.items.find((i) => i.k === 'workbench');
    if (!this.craft || !wb) return;
    this.ghost?.destroy();
    const d = FURN[this.craft.id];
    const gy = wb.img.y - FURN.workbench.h * wb.sc + 34 * wb.sc;
    this.ghost = this.add.image(wb.img.x - 20 * wb.sc, gy, furnTexture(this, this.craft.id, this.res)).setOrigin(0.5, 1).setDepth(wb.img.depth + 0.4)
      .setScale((wb.sc * 0.7) / this.res).setAlpha(0.3 + this.craft.taps * 0.22).setTint(this.craft.taps ? 0xffffff : 0xd8c8b0);
    void d;
  }
  private hammer(it: Item): string {
    const c = this.craft!; c.taps++;
    const img = it.img, sc = it.sc;
    const hx = img.x + 30 * sc, hy = img.y - FURN.workbench.h * sc + 20 * sc;
    sfx.thump(); this.time.delayedCall(60, () => sfx.tock());
    this.tweens.add({ targets: img, scaleY: { from: (sc * 0.94) / this.res, to: sc / this.res }, duration: 200, ease: 'Back.easeOut' });
    for (let i = 0; i < 6; i++) {
      const ch = this.add.rectangle(hx, hy, 7, 4, i % 2 ? 0xf0c48a : 0xc4ccd4).setStrokeStyle(1.5, 0x4a3022).setDepth(960).setAngle(Math.random() * 180);
      this.tweens.add({ targets: ch, x: hx + Phaser.Math.Between(-50, 50), y: hy - 20 - Math.random() * 40, angle: ch.angle + 200, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => ch.destroy() });
    }
    const bonk = this.text(hx, hy - 20, 'Bonk!', 26, '#fffaf0', 900).setStroke('#4a3022', 6).setOrigin(0.5).setDepth(970).setScale(0.5);
    this.tweens.add({ targets: bonk, scale: 1.1, y: bonk.y - 30, alpha: { from: 1, to: 0 }, duration: 600, ease: 'Back.easeOut', onComplete: () => bonk.destroy() });
    if (c.taps < 3) { this.showGhost(); return `hammer${c.taps}`; }
    // Done: pay, and the new thing hops into the room.
    const rc = RECIPES.find((r) => r.id === c.id)!;
    this.craft = null; this.ghost?.destroy(); this.ghost = null;
    if (!this.canPay(rc.cost)) { sfx.softFail(); this.say(`Oh no, need ${this.costText(rc.cost)}!`); return 'need'; }
    const r = save.village.res; r.wood -= rc.cost.wood ?? 0; r.stone -= rc.cost.stone ?? 0;
    this.game.events.emit('res', null, 0);
    const f = FURN[rc.id];
    const { x, y } = this.emptiest(f);
    const made = this.spawn(rc.id, x, y, true);
    this.crafted++;
    sfx.chimes();
    this.hearts(made.img.x, made.img.y - f.h * made.sc * (f.layer === 'floor' ? 1 : 0.5), 5);
    this.say(`You built a ${f.name}!`, made.img.x, made.img.y - f.h * made.sc - 20);
    this.store(); this.updateGlow();
    this.refreshHint();
    return 'built';
  }

  sparkles(x: number, y: number, n: number, color: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = 30 + Math.random() * 30;
      const s = this.add.star(x, y, 4, 3, 8, color).setStrokeStyle(1.5, 0x4a3022, 0.6).setDepth(960);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0, angle: 90, duration: 600, ease: 'Quad.easeOut', onComplete: () => s.destroy() });
    }
  }
  hearts(x: number, y: number, n: number) {
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
