// The satchel: map, wardrobe (cosmetics), treasures and the fish journal. Touch-first, big tiles.
import Phaser from 'phaser';
import { ATLAS, atlasOf, frameScale, S, ALL_PATHS } from '../art';
import { theme, setTheme, THEMES, THEME_ORDER } from '../theme';
import { DPR } from '../dpr';
import { safeInsets } from '../device';
import { sfx } from '../audio';
import { save, persist, resetSave, Look } from '../save';
import { COSMETICS, Cosmetic, isUnlocked, isEquipped, equip, TREASURES, MINORS, SPECIES, RARITY_STARS } from '../catalog';
import { buildPreviewSheet, HERO_W, HERO_H } from '../hero';
import { WORLD_W, WORLD_H, AREA_NAMES, AreaId, COTTAGE, SHRINE, WINDMILL, BRIDGES, PIER, POT_CHEST, BELL_CHEST, TILES, DIG, POND } from '../layout';
import { areaAt, waterAt } from '../geo';
import type { WorldScene } from './World';
import { buildWardrobeItems, isNoneItem } from '../wardrobeArt';

const INK = '#3d2c20';
const FONT = 'Nunito';
export type Tab = 'map' | 'wardrobe' | 'treasures' | 'fish';
const TABS: [Tab, string][] = [['map', 'Map'], ['wardrobe', 'Wardrobe'], ['treasures', 'Treasures'], ['fish', 'Fish']];

const iw0 = (ww: number) => ww - 28;

export class MenuScene extends Phaser.Scene {
  root!: Phaser.GameObjects.Container;
  content!: Phaser.GameObjects.Container;
  tab: Tab = 'map';
  open = false;
  w = 0; h = 0;
  box = { x: 0, y: 0, w: 0, h: 0 };
  heroDir = 0;
  heroImg: Phaser.GameObjects.Image | null = null;
  /** 9.36 slice 2: the item being dragged (a floating copy that springs after your finger). */
  drag: null | {
    c: Cosmetic; ghost: Phaser.GameObjects.Image; src: Phaser.GameObjects.Image | null;
    home: { x: number; y: number; s: number }; tx: number; ty: number; vx: number;
    fromHero: boolean; live: boolean; done: boolean;
  } = null;
  private stageGlow: Phaser.GameObjects.Graphics | null = null;
  /** 9.36 slice 3: squash & stretch for the hero's reactions (update() applies it on top of the breathing). */
  heroSquash = { x: 1, y: 1 };
  private heroBase = 1;
  /** Last reaction played, for tests: 'hat' | 'scarf' | 'outfit' | 'extras' | 'off'. */
  lastReaction = '';
  /** 9.36 slice 4: items unlocked since your last look in the wardrobe (they glow "new" this visit). */
  newIds: Set<string> | null = null;
  /** The theme the wardrobe was last dressed for (for tests). */
  wardrobeTheme = '';
  private reactChain: Phaser.Tweens.TweenChain | null = null;
  playerDot: Phaser.GameObjects.Graphics | null = null;
  mapGeom = { x: 0, y: 0, s: 1 };
  resetArmed = 0;
  hintText: Phaser.GameObjects.Text | null = null;
  /** Screen rects (CSS px) of tappable things, for tests. */
  rects: Record<string, { x: number; y: number; w: number; h: number }> = {};

  constructor() { super('menu'); }

  get world() { return this.scene.get('world') as WorldScene; }

  text(x: number, y: number, str: string, size: number, color = INK, weight = 700) {
    return this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: `${weight}`, resolution: Math.max(2, DPR * 1.5) } as any);
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(DPR);
    this.root = this.add.container(0, 0).setVisible(false);
    this.scale.on('resize', () => { if (this.open) this.render(); });
    this.input.keyboard!.on('keydown-ESC', () => this.close());
    this.game.events.on('menu', (tab?: Tab) => (this.open && (!tab || tab === this.tab) ? this.close() : this.show(tab ?? this.tab)));
    (window as any).__menu = this;
  }

  show(tab: Tab) {
    this.tab = tab;
    this.open = true;
    this.registry.set('menuOpen', true);
    this.world.path = [];
    this.world.setStick(null);
    sfx.blip();
    this.render();
    this.root.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.root, alpha: 1, duration: 200, ease: 'Sine.easeOut' });
    this.game.events.emit('menu-opened');
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.newIds = null;
    sfx.blip();
    this.tweens.add({ targets: this.root, alpha: 0, duration: 160, onComplete: () => { this.root.setVisible(false); this.root.removeAll(true); } });
    // Release on a later frame so the closing tap doesn't reach the world.
    this.time.delayedCall(80, () => this.registry.set('menuOpen', false));
  }

  private btn(x: number, y: number, w: number, h: number, onTap: () => void, fill = 0xfbf1dc, stroke = 0xd9b98f, r = 16) {
    const g = this.add.graphics();
    g.fillStyle(0x2a1d14, 0.18); g.fillRoundedRect(x + 1, y + 4, w, h, r);
    g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(2.5, stroke, 1); g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, r - 1);
    const z = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive();
    this.lastRect = { x, y, w, h };
    z.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 24) onTap(); });
    return [g, z] as const;
  }

  lastRect = { x: 0, y: 0, w: 0, h: 0 };
  render() {
    this.rects = {};
    this.root.removeAll(true);
    this.cancelDrag();
    if (this.tab !== 'wardrobe') this.newIds = null;
    this.heroImg = null; this.playerDot = null; this.hintText = null; this.stageGlow = null;
    this.w = this.scale.width / DPR; this.h = this.scale.height / DPR;
    const si = safeInsets();
    const m = 18;
    const bx = m + si.left, by = m + si.top, bw = this.w - m * 2 - si.left - si.right, bh = this.h - m * 2 - si.top - si.bottom;
    this.box = { x: bx, y: by, w: bw, h: bh };
    // Dim + parchment panel.
    const dim = this.add.rectangle(0, 0, this.w, this.h, 0x1d1510, 0.55).setOrigin(0, 0).setInteractive();
    const g = this.add.graphics();
    g.fillStyle(0x2a1d14, 0.3); g.fillRoundedRect(bx + 3, by + 8, bw, bh, 26);
    g.fillStyle(0xfbf1dc, 0.98); g.fillRoundedRect(bx, by, bw, bh, 26);
    g.lineStyle(3, 0xd9b98f, 1); g.strokeRoundedRect(bx + 8, by + 8, bw - 16, bh - 16, 20);
    this.root.add([dim, g]);
    // Tabs.
    const tabW = Math.min(170, (bw - 120 - 170) / 4 - 8), tabH = 54;
    TABS.forEach(([id, label], i) => {
      const tx = bx + 22 + i * (tabW + 8), ty = by + 16;
      const on = id === this.tab;
      const [bg, z] = this.btn(tx, ty, tabW, tabH, () => { if (this.tab !== id) { this.tab = id; sfx.blip(); this.render(); } }, on ? theme.ui.tabOn : theme.ui.tab, on ? theme.ui.accentDark : 0xd9b98f);
      this.rects[`tab:${id}`] = this.lastRect;
      const t = this.text(tx + tabW / 2, ty + tabH / 2, label, tabW < 120 ? 17 : 20, on ? '#fffaf0' : INK, 800).setOrigin(0.5);
      this.root.add([bg, z, t]);
    });
    // Theme toggle: one big icon per theme, the active one lit up.
    {
      const n = THEME_ORDER.length, tw = n > 3 ? 56 : 64, ty = by + 15; // 4+ themes: slimmer buttons so they clear the tabs on iPad mini
      const tx0 = bx + bw - 22 - 56 - 18 - n * (tw + 8);
      THEME_ORDER.forEach((id, i) => {
        const on = theme.id === id;
        const x = tx0 + i * (tw + 8);
        const [bg, z] = this.btn(x, ty, tw, 56, () => { if (theme.id !== id) { setTheme(id); sfx.sparkle(); this.render(); } }, on ? THEMES[id].ui.tabOn : 0xf3e6cc, on ? THEMES[id].ui.accentDark : 0xd9b98f, 18);
        this.rects[`theme:${id}`] = this.lastRect;
        const ic = this.add.image(x + tw / 2, ty + 28, atlasOf(THEMES[id].icon), THEMES[id].icon).setScale(40 / 48 / 2.5 * 2.5 / 2.5);
        ic.setDisplaySize(40, 40).setAlpha(on ? 1 : 0.75);
        this.root.add([bg, z, ic]);
      });
    }
    // Close.
    const cx = bx + bw - 22 - 56, cy = by + 15;
    const [cbg, cz] = this.btn(cx, cy, 56, 56, () => this.close(), 0xf3e6cc, 0xd9b98f, 28);
    this.rects.close = this.lastRect;
    const xg = this.add.graphics(); xg.lineStyle(4, 0x6b4a33, 1); xg.lineBetween(cx + 19, cy + 19, cx + 37, cy + 37); xg.lineBetween(cx + 37, cy + 19, cx + 19, cy + 37);
    this.root.add([cbg, cz, xg]);
    this.content = this.add.container(0, 0);
    this.root.add(this.content);
    const area = { x: bx + 24, y: by + 86, w: bw - 48, h: bh - 106 };
    if (this.tab === 'map') this.renderMap(area);
    else if (this.tab === 'wardrobe') this.renderWardrobe(area);
    else if (this.tab === 'treasures') this.renderTreasures(area);
    else this.renderFish(area);
  }

  private hint(msg: string) {
    if (!this.hintText) {
      this.hintText = this.text(this.box.x + this.box.w / 2, this.box.y + this.box.h - 26, '', 16, '#8a6a50', 700).setOrigin(0.5, 1);
      this.root.add(this.hintText);
    }
    this.hintText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.hintText);
    this.tweens.add({ targets: this.hintText, alpha: 0, delay: 2600, duration: 600 });
  }

  // ------------------------------------------------------------ map
  renderMap(a: { x: number; y: number; w: number; h: number }) {
    const s = Math.min(a.w / WORLD_W, (a.h - 34) / WORLD_H);
    const mw = WORLD_W * s, mh = WORLD_H * s;
    const mx = a.x + (a.w - mw) / 2, my = a.y + (a.h - 34 - mh) / 2;
    this.mapGeom = { x: mx, y: my, s };
    const key = 'minimap';
    const px = Math.ceil(mw * DPR), ph = Math.ceil(mh * DPR);
    const canvas = document.createElement('canvas');
    canvas.width = px; canvas.height = ph;
    const c = canvas.getContext('2d')!;
    const k = px / WORLD_W;
    const cols: Record<AreaId, string> = { glade: '#8fbf63', river: '#86c27a', forest: '#6f9e7a', orchard: '#c2c46a', lake: '#98c574', village: '#a6cf72' };
    // Sample the world coarsely into a tiny canvas, then upscale with smoothing for soft painted edges.
    const cell = 25;
    const cw = Math.ceil(WORLD_W / cell), chh = Math.ceil(WORLD_H / cell);
    const lo = document.createElement('canvas'); lo.width = cw; lo.height = chh;
    const lc = lo.getContext('2d')!;
    const fog = document.createElement('canvas'); fog.width = cw; fog.height = chh;
    const fc = fog.getContext('2d')!;
    fc.fillStyle = 'rgba(243,230,204,0.93)';
    for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
      const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
      const ar = areaAt(cx, cy);
      const wa = waterAt(cx, cy);
      const lake = ar === 'lake' && !wa ? Math.hypot((cx - 1050) / 700, (cy - 2480) / 330) : 9;
      lc.fillStyle = wa ? '#5aa6c8' : lake < 1.3 ? '#e8d6a6' : cols[ar];
      lc.fillRect(i, j, 1, 1);
      if (!save.visited.includes(ar)) fc.fillRect(i, j, 1, 1);
    }
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(lo, 0, 0, px, ph);
    c.strokeStyle = '#e9d3a6'; c.lineWidth = 26 * k; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const p of ALL_PATHS) { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k))); c.stroke(); }
    c.fillStyle = '#9b7146';
    for (const b of Object.values(BRIDGES)) c.fillRect((b.x - b.half) * k, (b.y - 20) * k, b.half * 2 * k, 40 * k);
    c.fillRect((PIER.x - 20) * k, PIER.y0 * k, 40 * k, (PIER.y1 - PIER.y0) * k);
    // Unvisited areas stay misty.
    c.drawImage(fog, 0, 0, px, ph);
    lo.width = lo.height = fog.width = fog.height = 1;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addImage(key, canvas as unknown as HTMLImageElement);
    canvas.width = 1; canvas.height = 1;
    const img = this.add.image(mx, my, key).setOrigin(0, 0).setScale(1 / DPR);
    const frame = this.add.graphics();
    frame.lineStyle(3, 0xb59b7c, 1); frame.strokeRoundedRect(mx - 2, my - 2, mw + 4, mh + 4, 10);
    this.content.add([img, frame]);
    // Labels + landmarks.
    const label = (wx: number, wy: number, t: string, size = 15) => this.content.add(this.text(mx + wx * s, my + wy * s, t, size, '#4a3626', 800).setOrigin(0.5).setShadow(0, 0, 'rgba(255,248,230,0.9)', 4, true, true));
    const centers: Record<AreaId, [number, number]> = { glade: [900, 760], river: [2120, 1150], forest: [3400, 380], orchard: [3200, 2250], lake: [700, 2250], village: [470, 1760] };
    for (const [id, [x, y]] of Object.entries(centers) as [AreaId, [number, number]][]) {
      label(x, y, save.visited.includes(id) ? AREA_NAMES[id] : '? ? ?', 15);
    }
    const mark = (wx: number, wy: number, done: boolean, area: AreaId) => {
      if (!save.visited.includes(area)) return;
      const gg = this.add.graphics();
      const x = mx + wx * s, y = my + wy * s;
      gg.fillStyle(done ? 0x7cc463 : 0xf2a93b, 1); gg.fillCircle(x, y, 9);
      gg.lineStyle(2, 0xfffaf0, 1); gg.strokeCircle(x, y, 9);
      this.content.add([gg, this.text(x, y, done ? '\u2713' : '?', 12, '#fffaf0', 900).setOrigin(0.5)]);
    };
    mark(SHRINE.x, SHRINE.y, !!save.puzzles.lanterns, 'glade');
    mark(POT_CHEST.x, POT_CHEST.y - 40, !!save.puzzles.pots, 'glade');
    mark(BELL_CHEST.x, BELL_CHEST.y, !!save.puzzles.bells, 'orchard');
    mark(TILES.x, TILES.y, !!save.puzzles.tiles, 'forest');
    mark(DIG.x, DIG.y, !!save.puzzles.dig, 'lake');
    const icon = (wx: number, wy: number, t: string) => this.content.add(this.text(mx + wx * s, my + wy * s, t, 13, '#6b4a33', 800).setOrigin(0.5));
    icon(COTTAGE.x, COTTAGE.y - 40, '\u2302 home');
    if (save.visited.includes('orchard')) icon(WINDMILL.x + 10, WINDMILL.y - 60, '\u2738 windmill');
    icon(POND.x, POND.y, 'pond');
    this.playerDot = this.add.graphics();
    this.content.add(this.playerDot);
    const legend = this.text(a.x + 4, a.y + a.h, 'Orange: puzzle   \u00B7   Green: done!', 14, '#8a6a50', 700).setOrigin(0, 1);
    this.content.add(legend);
  }

  // ------------------------------------------------------------ wardrobe
  /** 9.36 slice 1: a big character on the left and an illustrated wardrobe with open doors on the right:
   *  hats on the shelf, scarves on hooks, outfits on hangers, extras in the drawer. Tap an item to wear it. */
  renderWardrobe(a: { x: number; y: number; w: number; h: number }) {
    buildWardrobeItems(this, 'wardrobe-items');
    if (!this.newIds) {
      // Anything unlocked since last time is "new" for this visit; first visit ever: nothing is new.
      const unlocked = COSMETICS.filter((c) => isUnlocked(c)).map((c) => c.id);
      const seen = save.seenWardrobe;
      this.newIds = new Set(seen ? unlocked.filter((id) => !seen.includes(id)) : []);
      save.seenWardrobe = unlocked;
      persist();
    }
    const narrow = a.w < 860;
    const ph = a.h - 30;
    const pw = Math.round(a.w * (narrow ? 0.34 : 0.37));
    // --- Character stage: soft spotlight, rug, and a big hero.
    const pg = this.add.graphics();
    pg.fillStyle(0xf3e6cc, 1); pg.fillRoundedRect(a.x, a.y, pw, ph, 22);
    pg.fillStyle(0xfff8e6, 1); pg.fillEllipse(a.x + pw / 2, a.y + ph * 0.48, pw * 0.92, ph * 0.86);
    pg.lineStyle(2.5, 0xd9b98f, 1); pg.strokeRoundedRect(a.x, a.y, pw, ph, 22);
    const floorY = a.y + ph * 0.86;
    pg.fillStyle(theme.ui.accent ?? 0xf2a93b, 0.22); pg.fillEllipse(a.x + pw / 2, floorY, pw * 0.78, 42);
    pg.lineStyle(3, theme.ui.accentDark ?? 0xc9822a, 0.35); pg.strokeEllipse(a.x + pw / 2, floorY, pw * 0.78, 42);
    pg.fillStyle(0x2a1d14, 0.14); pg.fillEllipse(a.x + pw / 2, floorY, pw * 0.36, 18);
    this.content.add(pg);
    // Lights up while you drag something over the character ("let go to wear it").
    this.stageGlow = this.add.graphics().setAlpha(0);
    this.stageGlow.fillStyle(0xffe27a, 0.35); this.stageGlow.fillEllipse(a.x + pw / 2, a.y + ph * 0.5, pw * 0.86, ph * 0.8);
    this.stageGlow.lineStyle(5, 0xf2a93b, 0.7); this.stageGlow.strokeEllipse(a.x + pw / 2, a.y + ph * 0.5, pw * 0.86, ph * 0.8);
    this.content.add(this.stageGlow);
    const key = this.world.heroKey;
    const sc = Math.min((ph * 0.8) / (HERO_H * S), (pw * 0.95) / (HERO_W * S));
    this.heroImg = this.add.image(a.x + pw / 2, floorY + 8, key, `${this.heroDir}_0`).setOrigin(0.5, 1).setScale(sc);
    this.heroBase = sc; this.heroSquash.x = 1; this.heroSquash.y = 1;
    this.content.add(this.heroImg);
    this.rects.hero = { x: a.x, y: a.y, w: pw, h: ph };
    const turn = this.add.zone(a.x, a.y, pw, ph).setOrigin(0, 0).setInteractive();
    turn.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() >= 14) return; this.heroDir = (this.heroDir + 1) % 5; this.heroImg?.setFrame(`${this.heroDir}_0`); sfx.blip(); });
    // Drag something off the character to take it off: head = hat, neck = scarf, body = back / extras.
    turn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const h = this.heroImg; if (!h) return;
      const top = h.y - h.displayHeight, f = (p.y - top) / h.displayHeight;
      const look = save.look as any;
      let c: Cosmetic | undefined;
      if (f < 0.38) c = COSMETICS.find((k) => k.slot === 'hat' && k.value === look.hat && !isNoneItem(k));
      else if (f < 0.58) c = COSMETICS.find((k) => k.slot === 'scarf' && k.value === look.scarf && !isNoneItem(k));
      else if (f < 1.05) c = COSMETICS.find((k) => k.slot === 'back' && k.value === look.back && !isNoneItem(k))
        ?? COSMETICS.find((k) => (k.slot === 'shells' || k.slot === 'feather') && look[k.slot]);
      if (c) this.armDrag(c, null, p, true);
    });
    this.content.add([turn, this.text(a.x + pw / 2, a.y + ph - 14, 'tap to turn', 14, '#8a6a50', 700).setOrigin(0.5, 1)]);

    // --- The wardrobe.
    const gx = a.x + pw + 20, gw = a.w - pw - 20;
    const dw = Math.min(54, gw * 0.08);              // open doors, one each side
    const wx = gx + dw, ww = gw - dw * 2, wy = a.y + 12, wh = ph - 12;
    const g = this.add.graphics();
    const WOOD = 0xc08a58, WOOD_D = 0x8f5f38, LINE = 0x6b4a33, BACK = 0x7a5034, BOARD = 0xd8a872;
    // Doors (swung open, in perspective).
    const door = (x0: number, x1: number, sign: number) => {
      g.fillStyle(WOOD, 1); g.lineStyle(3, LINE, 1);
      g.beginPath(); g.moveTo(x1, wy + 4); g.lineTo(x0, wy + 22); g.lineTo(x0, wy + wh - 18); g.lineTo(x1, wy + wh - 4); g.closePath(); g.fillPath(); g.strokePath();
      const ix0 = x0 + sign * 10, ix1 = x1 - sign * 8;
      g.fillStyle(WOOD_D, 0.35);
      for (const [t0, t1] of [[0.08, 0.46], [0.54, 0.92]]) {
        g.beginPath();
        g.moveTo(ix1, wy + 4 + (wh - 8) * t0 + 6); g.lineTo(ix0, wy + 22 + (wh - 40) * t0 + 6);
        g.lineTo(ix0, wy + 22 + (wh - 40) * t1 - 6); g.lineTo(ix1, wy + 4 + (wh - 8) * t1 - 6); g.closePath(); g.fillPath();
      }
      g.fillStyle(0xf2c45a, 1); g.fillCircle((x0 + x1) / 2 + sign * 6, wy + wh * 0.5, 5); g.lineStyle(2, LINE, 1); g.strokeCircle((x0 + x1) / 2 + sign * 6, wy + wh * 0.5, 5);
    };
    door(gx, wx, 1); door(gx + gw, wx + ww, -1);
    // Body with a little crown on top.
    g.fillStyle(0x2a1d14, 0.18); g.fillRoundedRect(wx + 3, wy + 8, ww, wh, 16);
    g.fillStyle(WOOD, 1); g.fillRoundedRect(wx, wy, ww, wh, 16);
    g.lineStyle(3, LINE, 1); g.strokeRoundedRect(wx, wy, ww, wh, 16);
    g.fillStyle(WOOD_D, 1); g.fillRoundedRect(wx - 6, wy - 10, ww + 12, 18, 8); g.lineStyle(3, LINE, 1); g.strokeRoundedRect(wx - 6, wy - 10, ww + 12, 18, 8);
    const ix = wx + 14, iw = ww - 28, iy = wy + 18, ih = wh - 30;
    g.fillStyle(BACK, 1); g.fillRoundedRect(ix, iy, iw, ih, 10);
    g.lineStyle(1.5, 0x6a4329, 0.7);
    for (let px = ix + 26; px < ix + iw - 10; px += 34) g.lineBetween(px, iy + 4, px, iy + ih - 4);
    this.content.add(g);
    this.dressWardrobe(wx, wy, ww, ix, iy);

    type Row = { slot: string; list: Cosmetic[]; h: number };
    const rows: Row[] = [
      { slot: 'hat', list: COSMETICS.filter((c) => c.slot === 'hat'), h: 0.25 },
      { slot: 'scarf', list: COSMETICS.filter((c) => c.slot === 'scarf'), h: 0.24 },
      { slot: 'outfit', list: COSMETICS.filter((c) => c.slot === 'outfit'), h: 0.29 },
      { slot: 'extras', list: COSMETICS.filter((c) => c.slot === 'back' || c.slot === 'feather' || c.slot === 'shells'), h: 0.22 },
    ];
    let y = iy;
    const deco = this.add.graphics();
    const fg = this.add.graphics();
    this.content.add(deco);
    for (const r of rows) {
      const rh = ih * r.h, n = r.list.length, cw = iw / n;
      // Furniture for this row.
      if (r.slot === 'hat') {
        deco.fillStyle(BOARD, 1); deco.fillRect(ix, y + rh - 12, iw, 10); deco.fillStyle(0x2a1d14, 0.25); deco.fillRect(ix, y + rh - 2, iw, 4);
      } else if (r.slot === 'scarf') {
        deco.fillStyle(BOARD, 1); deco.fillRoundedRect(ix + 6, y + 8, iw - 12, 9, 4);
        r.list.forEach((_, i) => { const px = ix + cw * (i + 0.5); deco.fillStyle(0xe8c48c, 1); deco.fillCircle(px, y + 13, 5); deco.lineStyle(2, LINE, 1); deco.strokeCircle(px, y + 13, 5); });
      } else if (r.slot === 'outfit') {
        deco.lineStyle(5, 0xe0cfae, 1); deco.lineBetween(ix + 4, y + 10, ix + iw - 4, y + 10);
        deco.lineStyle(2, LINE, 0.8); deco.lineBetween(ix + 4, y + 12.5, ix + iw - 4, y + 12.5);
        r.list.forEach((_, i) => {
          const px = ix + cw * (i + 0.5), hw = Math.min(cw * 0.36, 30);
          deco.lineStyle(3, 0xa77b4f, 1); deco.beginPath(); deco.arc(px, y + 14, 5, Math.PI, Math.PI * 2.2); deco.strokePath();
          deco.lineBetween(px, y + 19, px - hw, y + 30); deco.lineBetween(px, y + 19, px + hw, y + 30); deco.lineBetween(px - hw, y + 30, px + hw, y + 30);
        });
      } else {
        // An open drawer along the bottom.
        const dy = y + rh * 0.8;
        fg.fillStyle(0xcf9a64, 1); fg.fillRoundedRect(ix - 6, dy, iw + 12, y + rh - dy + 4, 8);
        fg.lineStyle(3, LINE, 1); fg.strokeRoundedRect(ix - 6, dy, iw + 12, y + rh - dy + 4, 8);
        fg.fillStyle(0xf2c45a, 1); fg.fillRoundedRect(ix + iw / 2 - 22, dy + (y + rh - dy) / 2 - 3, 44, 9, 4); fg.lineStyle(2, LINE, 1); fg.strokeRoundedRect(ix + iw / 2 - 22, dy + (y + rh - dy) / 2 - 3, 44, 9, 4);
        deco.fillStyle(0x5e3c26, 1); deco.fillRect(ix, dy - 12, iw, 14);
      }
      r.list.forEach((c, i) => this.wardrobeItem(c, r.slot, ix + cw * i, y, cw, rh));
      y += rh;
    }
    this.content.add(fg);
    this.content.bringToTop(fg);
  }

  private itemImgs: Record<string, Phaser.GameObjects.Image> = {};

  /** Put it on (or, for the on/off extras, toggle it), save, and let the hero show it off. */
  private wear(c: Cosmetic) {
    this.newIds?.delete(c.id);
    equip(c, save.look);
    persist();
    sfx.pickup();
    this.world.refreshHero();
    this.game.events.emit('equipped', c.id);
    this.render();
    // A little hop for the hero, and the name of what you picked.
    const on = isEquipped(c, save.look) && !isNoneItem(c);
    this.react(on ? c.slot : 'off');
    this.hint(on || isEquipped(c, save.look) ? c.name : `${c.name} off`);
  }

  /** The hero reacts to a change: a happy hop + sparkles + a sound for everything, plus a pose per category:
   *  hat = a proud stretch, scarf = a wiggle, outfit = a twirl all the way round, extras = a double bounce. */
  private react(kind: string) {
    const h = this.heroImg; if (!h) return;
    this.lastReaction = kind === 'back' || kind === 'feather' || kind === 'shells' ? 'extras' : kind;
    const k = this.lastReaction, hy = h.y, sq = this.heroSquash;
    this.tweens.killTweensOf([h, sq]); this.reactChain?.stop(); this.reactChain = null;
    h.setAngle(0); sq.x = 1; sq.y = 1;
    if (k === 'off') {
      // A little shrug: squash down and back.
      sfx.blip();
      this.tweens.add({ targets: sq, x: 1.08, y: 0.9, duration: 120, yoyo: true, ease: 'Sine.easeOut', onComplete: () => { sq.x = 1; sq.y = 1; } });
      return;
    }
    sfx.sparkle();
    this.sparkles(h.x, hy - h.displayHeight * 0.55, h.displayWidth * 0.55);
    // Anticipation squash, then a hop with a stretch.
    this.reactChain = this.tweens.chain({ targets: sq, tweens: [
      { x: 1.12, y: 0.86, duration: 90, ease: 'Quad.easeOut' },
      { x: 0.92, y: k === 'hat' ? 1.18 : 1.1, duration: k === 'hat' ? 220 : 140, ease: 'Quad.easeOut' },
      { x: 1, y: 1, duration: 220, ease: 'Back.easeOut' },
    ], onComplete: () => { sq.x = 1; sq.y = 1; } });
    this.tweens.add({ targets: h, y: hy - (k === 'hat' ? 30 : 22), duration: 170, delay: 90, yoyo: true, ease: 'Sine.easeOut',
      repeat: k === 'extras' ? 1 : 0, onComplete: () => h.setY(hy) });
    if (k === 'scarf') {
      this.tweens.add({ targets: h, angle: { from: -7, to: 7 }, duration: 110, yoyo: true, repeat: 2, delay: 120, ease: 'Sine.easeInOut', onComplete: () => h.setAngle(0) });
    } else if (k === 'outfit') {
      // Twirl: spin through every facing and back to the front.
      const order = [1, 2, 3, 4, 0];
      order.forEach((dir, i) => this.time.delayedCall(110 + i * 85, () => { if (this.heroImg === h) { h.setFrame(`${dir}_0`); if (i === order.length - 1) this.heroDir = 0; } }));
    }
  }

  /** A burst of little four-point stars around the hero. */
  private sparkles(x: number, y: number, rad: number) {
    const colors = [0xffe27a, 0xfff6c8, 0xf2a93b, theme.ui.accent ?? 0x9ad07a];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4, d = rad * (0.7 + Math.random() * 0.6), sz = 5 + Math.random() * 6;
      const g = this.add.graphics({ x, y });
      g.fillStyle(colors[i % colors.length], 1);
      g.fillTriangle(-sz * 0.3, 0, sz * 0.3, 0, 0, -sz); g.fillTriangle(-sz * 0.3, 0, sz * 0.3, 0, 0, sz);
      g.fillTriangle(0, -sz * 0.3, 0, sz * 0.3, -sz, 0); g.fillTriangle(0, -sz * 0.3, 0, sz * 0.3, sz, 0);
      g.setScale(0.3);
      this.content.add(g);
      this.tweens.add({ targets: g, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 1.2, scale: 1, angle: 90, duration: 380 + Math.random() * 160, ease: 'Quad.easeOut',
        onComplete: () => this.tweens.add({ targets: g, alpha: 0, scale: 0.2, duration: 260, onComplete: () => g.destroy() }) });
    }
  }

  /** Finger down on an item: it becomes a drag once the finger travels a little (a short press stays a tap). */
  private armDrag(c: Cosmetic, src: Phaser.GameObjects.Image | null, p: Phaser.Input.Pointer, fromHero: boolean) {
    if (this.drag) return;
    const tex = this.textures.get('wardrobe-items');
    if (!tex || !tex.has(c.id)) return;
    let home = { x: p.x, y: p.y, s: 1.2 };
    if (src) { const b = src.getBounds(); home = { x: b.centerX, y: b.centerY, s: src.scaleX }; }
    else if (this.heroImg) home.s = Math.max(0.8, this.heroImg.scaleX / 2.2);
    const ghost = this.add.image(home.x, home.y, 'wardrobe-items', c.id).setScale(home.s).setVisible(false).setDepth(50);
    this.drag = { c, ghost, src, home, tx: home.x, ty: home.y, vx: 0, fromHero, live: false, done: false };
    const sx = p.x, sy = p.y;
    const move = (q: Phaser.Input.Pointer) => {
      const d = this.drag; if (!d || d.done) return;
      if (!d.live && Math.hypot(q.x - sx, q.y - sy) >= 14) {
        d.live = true; d.ghost.setVisible(true);
        this.tweens.add({ targets: d.ghost, scale: d.home.s * 1.5, duration: 160, ease: 'Back.easeOut' });
        if (d.src) d.src.setAlpha(0.25);
        sfx.blip();
      }
      if (d.live) { d.tx = q.x; d.ty = q.y - 10; this.stageGlow?.setAlpha(this.overStage(q.x, q.y) && !d.fromHero ? 1 : 0); }
    };
    const up = (q: Phaser.Input.Pointer) => {
      this.input.off('pointermove', move); this.input.off('pointerup', up); this.input.off('gameout', up);
      const d = this.drag; if (!d) return;
      if (!d.live) { d.ghost.destroy(); this.drag = null; return; }
      this.drop(d, q?.x ?? d.tx, q?.y ?? d.ty);
    };
    this.input.on('pointermove', move); this.input.on('pointerup', up); this.input.on('gameout', up);
    this.dragOff = () => { this.input.off('pointermove', move); this.input.off('pointerup', up); this.input.off('gameout', up); };
  }
  private dragOff: (() => void) | null = null;

  private overStage(x: number, y: number) {
    const r = this.rects.hero; return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  /** Let go: on the character = wear it; a worn item dropped anywhere off the character = take it off; else it springs home. */
  private drop(d: NonNullable<MenuScene['drag']>, x: number, y: number) {
    d.done = true; this.stageGlow?.setAlpha(0); this.tweens.killTweensOf(d.ghost);
    const finish = () => { d.ghost.destroy(); if (this.drag === d) this.drag = null; this.dragOff = null; };
    const onStage = this.overStage(x, y);
    if (!d.fromHero && onStage && this.heroImg) {
      // Fly into the character and pop on.
      const h = this.heroImg, ty = h.y - h.displayHeight * (d.c.slot === 'hat' ? 0.78 : d.c.slot === 'scarf' ? 0.5 : 0.35);
      this.tweens.add({ targets: d.ghost, x: h.x, y: ty, scale: d.home.s * 0.6, alpha: 0.2, duration: 180, ease: 'Quad.easeIn',
        onComplete: () => {
          finish();
          if (!isEquipped(d.c, save.look)) { this.wear(d.c); return; }
          // Already wearing it: just a happy hop.
          this.render(); this.hint(d.c.name);
          this.react(d.c.slot);
        } });
      return;
    }
    if (d.fromHero && !onStage) {
      // Take it off: it flies back to its spot in the wardrobe.
      const off = d.c.slot === 'feather' || d.c.slot === 'shells' ? d.c : COSMETICS.find((k) => k.slot === d.c.slot && isNoneItem(k));
      const r = this.rects[d.c.id];
      const tx = r ? r.x + r.w / 2 : x, ty = r ? r.y + r.h / 2 : y;
      this.tweens.add({ targets: d.ghost, x: tx, y: ty, scale: d.home.s, duration: 240, ease: 'Back.easeOut',
        onComplete: () => { finish(); if (off) this.wear(off); } });
      return;
    }
    // Spring back home with a little wobble.
    sfx.tock();
    this.tweens.add({ targets: d.ghost, x: d.home.x, y: d.home.y, scale: d.home.s, angle: 0, duration: 320, ease: 'Back.easeOut',
      onComplete: () => { d.src?.setAlpha(1); finish(); } });
  }

  private cancelDrag() {
    this.dragOff?.(); this.dragOff = null;
    if (this.drag) { this.drag.ghost.destroy(); this.drag = null; }
    this.itemImgs = {};
  }

  /** Seasonal touches on the wardrobe for the active theme. */
  private dressWardrobe(wx: number, wy: number, ww: number, ix: number, iy: number) {
    const t = theme.id; this.wardrobeTheme = t;
    const g = this.add.graphics();
    const LINE = 0x6b4a33;
    const flower = (x: number, y: number, r: number, c: number) => {
      g.fillStyle(c, 1); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.fillCircle(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55); }
      g.fillStyle(0xf7d046, 1); g.fillCircle(x, y, r * 0.38);
    };
    const leaf = (x: number, y: number, r: number, c: number, rot: number) => {
      const ca = Math.cos(rot), sa = Math.sin(rot), P = (u: number, v: number) => [x + u * ca - v * sa, y + u * sa + v * ca] as const;
      const [ax, ay] = P(-r, 0), [bx, by] = P(0, -r * 0.55), [cx2, cy2] = P(r, 0), [dx, dy] = P(0, r * 0.55);
      g.fillStyle(c, 1); g.fillTriangle(ax, ay, bx, by, cx2, cy2); g.fillTriangle(ax, ay, dx, dy, cx2, cy2);
      g.lineStyle(1.5, 0x7a3b1c, 0.6); g.lineBetween(ax, ay, cx2, cy2);
    };
    if (t === 'spring') {
      // A flower garland along the crown.
      g.lineStyle(3, 0x6aa84f, 1); g.lineBetween(wx - 4, wy - 1, wx + ww + 4, wy - 1);
      const cols = [0xf7a8c4, 0xffffff, 0xf48fb1, 0xfff0a8];
      let i = 0; for (let x = wx + 8; x < wx + ww - 4; x += 30, i++) { leaf(x + 14, wy + 2, 7, 0x6aa84f, 0.5); flower(x, wy - 2, 9, cols[i % cols.length]); }
    } else if (t === 'fall') {
      const cols = [0xe0701e, 0xc8452b, 0xe8b13a, 0xa8551e];
      let i = 0; for (let x = wx + 6; x < wx + ww; x += 22, i++) leaf(x, wy - 2 + (i % 2) * 4, 11, cols[i % cols.length], (i % 3 - 1) * 0.6);
      // Two leaves drifting down the doors.
      leaf(wx - 22, wy + 120, 10, 0xe0701e, 0.9); leaf(wx + ww + 24, wy + 220, 10, 0xc8452b, -0.7);
      g.fillStyle(0x8f5f38, 1); g.fillEllipse(wx + 40, wy - 16, 16, 18); g.fillStyle(0x5e3c26, 1); g.fillEllipse(wx + 40, wy - 23, 20, 9);
    } else if (t === 'halloween') {
      // A cobweb in the corner and a pumpkin on top.
      const cx = ix + 2, cy = iy + 2, R = 64;
      g.lineStyle(1.5, 0xf3ecdf, 0.65);
      for (let k = 0; k <= 4; k++) { const a = (k / 4) * (Math.PI / 2); g.lineBetween(cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
      for (const rr of [18, 34, 50]) { g.beginPath(); for (let k = 0; k <= 4; k++) { const a = (k / 4) * (Math.PI / 2); const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; if (k) g.lineTo(px, py); else g.moveTo(px, py); } g.strokePath(); }
      const px = wx + 84, py = wy - 14;
      g.fillStyle(0xe8771e, 1); g.fillEllipse(px - 8, py, 18, 22); g.fillEllipse(px + 8, py, 18, 22); g.fillEllipse(px, py, 20, 24);
      g.lineStyle(2, LINE, 1); g.strokeEllipse(px, py, 34, 24);
      g.fillStyle(0x2a1d14, 1); g.fillTriangle(px - 9, py - 3, px - 3, py - 3, px - 6, py - 8); g.fillTriangle(px + 3, py - 3, px + 9, py - 3, px + 6, py - 8);
      g.fillTriangle(px - 8, py + 3, px + 8, py + 3, px, py + 8);
      g.fillStyle(0x4f7a2a, 1); g.fillRect(px - 2, py - 16, 4, 6);
      // A little bat on the left of the crown.
      const bx = wx + 34, by = wy - 18;
      g.fillStyle(0x3b2b4f, 1); g.fillEllipse(bx, by, 12, 10);
      g.fillTriangle(bx - 4, by, bx - 20, by - 7, bx - 14, by + 5); g.fillTriangle(bx + 4, by, bx + 20, by - 7, bx + 14, by + 5);
    } else if (t === 'christmas') {
      // Snow on the crown, a drooping string of lights, and a star on top.
      g.fillStyle(0xffffff, 1); g.fillRoundedRect(wx - 8, wy - 16, ww + 16, 10, 5);
      for (let x = wx + 10; x < wx + ww - 6; x += 38) g.fillEllipse(x, wy - 6, 14, 10);
      const n = Math.max(4, Math.floor(ww / 70)), cols = [0xe53935, 0xfbc02d, 0x43a047, 0x1e88e5];
      g.lineStyle(2, 0x2e5e2e, 1);
      for (let k = 0; k < n; k++) {
        const x0 = ix + (iw0(ww) * k) / n, x1 = ix + (iw0(ww) * (k + 1)) / n;
        g.beginPath(); for (let u = 0; u <= 8; u++) { const x = x0 + ((x1 - x0) * u) / 8, y = iy + 4 + Math.sin((u / 8) * Math.PI) * 14; if (u) g.lineTo(x, y); else g.moveTo(x, y); } g.strokePath();
        for (let u = 1; u < 4; u++) { const x = x0 + ((x1 - x0) * u) / 4, y = iy + 4 + Math.sin((u / 4) * Math.PI) * 14; g.fillStyle(cols[(k * 3 + u) % 4], 1); g.fillEllipse(x, y + 5, 7, 10); }
      }
      const sx = wx + ww / 2, sy = wy - 24;
      g.fillStyle(0xf7d046, 1); g.lineStyle(2, 0xc9822a, 1); g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 6 : 14; const x = sx + Math.cos(a) * rr, y = sy + Math.sin(a) * rr; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
      g.closePath(); g.fillPath(); g.strokePath();
    }
    this.content.add(g);
  }

  /** One item in its place in the wardrobe; the whole cell is the tap target. */
  private wardrobeItem(c: Cosmetic, slot: string, x: number, y: number, w: number, h: number) {
    const unlocked = isUnlocked(c);
    const on = unlocked && isEquipped(c, save.look);
    const cx = x + w / 2;
    // Where it sits: on the shelf, hanging from a hook / hanger, or peeking out of the drawer.
    const anchorY = slot === 'hat' ? y + h - 12 : slot === 'scarf' ? y + 16 : slot === 'outfit' ? y + 22 : y + h * 0.86;
    const originY = slot === 'hat' || slot === 'extras' ? 1 : 0;
    const maxW = w * 0.84, maxH = (slot === 'hat' ? h - 20 : slot === 'extras' ? h * 0.66 : h - 24);
    // Worn: a warm glow behind it (sized once we know how big the item is drawn).
    const glow = on ? this.add.graphics() : null;
    if (glow) this.content.add(glow);
    const glowAt = (gx: number, gy: number, gw: number, gh: number) => {
      if (!glow) return;
      glow.fillStyle(0xffe27a, 0.28); glow.fillEllipse(gx, gy, gw + 30, gh + 26);
      glow.fillStyle(0xffe27a, 0.4); glow.fillEllipse(gx, gy, gw + 12, gh + 10);
    };
    // Newly unlocked: a gentle pulsing glow and a little "new" tag (this visit only).
    if (unlocked && !on && this.newIds?.has(c.id)) {
      const ng = this.add.graphics();
      ng.fillStyle(0xfff2a8, 0.5); ng.fillEllipse(cx, originY ? anchorY - maxH * 0.42 : anchorY + maxH * 0.42, w * 0.95, maxH * 0.95);
      this.content.add(ng);
      this.tweens.add({ targets: ng, alpha: { from: 0.35, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const tg = this.add.graphics();
      tg.fillStyle(0xe85d3a, 1); tg.fillRoundedRect(x + 4, y + 4, 40, 18, 9);
      this.content.add([tg, this.text(x + 24, y + 13, 'new', 12, '#fffaf0', 900).setOrigin(0.5)]);
    }
    let img: Phaser.GameObjects.Image | null = null;
    if (isNoneItem(c)) {
      // "Take it off": a dashed empty spot with a little cross.
      const g = this.add.graphics();
      const r = Math.min(w, maxH) * 0.28, my = originY ? anchorY - r - 6 : anchorY + r + 8;
      glowAt(cx, my, r * 2, r * 2);
      g.lineStyle(3, 0xf3e6cc, on ? 0.95 : 0.6);
      for (let k = 0; k < 12; k += 2) { g.beginPath(); g.arc(cx, my, r, (k * Math.PI) / 6, ((k + 1) * Math.PI) / 6); g.strokePath(); }
      g.lineBetween(cx - r * 0.4, my - r * 0.4, cx + r * 0.4, my + r * 0.4); g.lineBetween(cx + r * 0.4, my - r * 0.4, cx - r * 0.4, my + r * 0.4);
      this.content.add(g);
    } else {
      img = this.add.image(cx, anchorY, 'wardrobe-items', c.id).setOrigin(0.5, originY);
      const s = Math.min(maxW / img.width, maxH / img.height, 1.6);
      img.setScale(s);
      glowAt(cx, originY ? anchorY - img.displayHeight / 2 : anchorY + img.displayHeight / 2, img.displayWidth, img.displayHeight);
      if (!unlocked) img.setTint(0x3a2a20).setTintMode(Phaser.TintModes.FILL).setAlpha(0.5);
      this.content.add(img);
    }
    if (!unlocked) {
      const g = this.add.graphics();
      const lx = cx, ly = originY ? anchorY - maxH * 0.45 : anchorY + maxH * 0.45;
      g.lineStyle(3.5, 0xf3e6cc, 0.95); g.beginPath(); g.arc(lx, ly - 4, 7, Math.PI, 0); g.strokePath();
      g.fillStyle(0xf3e6cc, 0.95); g.fillRoundedRect(lx - 11, ly - 4, 22, 17, 4);
      g.fillStyle(0x6b4a33, 1); g.fillCircle(lx, ly + 3, 2.6);
      this.content.add(g);
    }
    if (on) {
      const g = this.add.graphics();
      const bx = x + w - 14, by = y + 14;
      g.fillStyle(0xf2a93b, 1); g.fillCircle(bx, by, 11); g.lineStyle(2, 0xfffaf0, 1); g.strokeCircle(bx, by, 11);
      this.content.add([g, this.text(bx, by, '\u2713', 14, '#fffaf0', 900).setOrigin(0.5)]);
    }
    const z = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive();
    this.rects[c.id] = { x, y, w, h };
    if (img) this.itemImgs[c.id] = img;
    z.on('pointerdown', (p: Phaser.Input.Pointer) => { if (unlocked && img) this.armDrag(c, img, p, false); });
    z.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.getDistance() >= 14 || this.drag?.live) return;
      if (!unlocked) { sfx.tock(); this.hint(`Locked \u2014 ${c.hint}`); if (img) this.tweens.add({ targets: img, x: cx + 4, duration: 50, yoyo: true, repeat: 2 }); return; }
      this.wear(c);
    });
    this.content.add(z);
  }

  // ------------------------------------------------------------ treasures
  renderTreasures(a: { x: number; y: number; w: number; h: number }) {
    const n = TREASURES.length;
    // Big tiles: wrap into two rows once there are lots of treasures (mounts add more).
    const cols = n > 7 ? Math.ceil(n / 2) : n;
    const rows = Math.ceil(n / cols);
    const tile = Math.min(rows > 1 ? 118 : 170, (a.w - (cols - 1) * 14) / cols);
    this.content.add(this.text(a.x, a.y, `Treasures found: ${TREASURES.filter((t) => save.treasures.includes(t.id)).length} / ${n}`, 20, INK, 800));
    TREASURES.forEach((t, i) => {
      const x = a.x + (i % cols) * (tile + 14), y = a.y + 36 + Math.floor(i / cols) * (tile + 52);
      const found = save.treasures.includes(t.id);
      const [bg, z] = this.btn(x, y, tile, tile + 40, () => { sfx.blip(); this.hint(found ? t.blurb : `Hint: ${t.hint}`); }, found ? 0xfff4d6 : 0xe6dccb, found ? 0xf2a93b : 0xd9b98f, 18);
      this.content.add([bg, z]);
      if (found) {
        const ic = this.add.image(x + tile / 2, y + tile * 0.48, atlasOf(t.icon), t.icon);
        ic.setScale(Math.min(tile * 0.55 / ic.width, tile * 0.55 / ic.height));
        const glow = this.add.image(x + tile / 2, y + tile * 0.48, ATLAS, 'glow').setBlendMode('ADD').setTint(0xffd27a).setAlpha(0.35).setScale(tile / 300);
        this.content.add([glow, ic]);
      } else {
        this.content.add(this.text(x + tile / 2, y + tile * 0.48, '?', 54, '#b8a690', 900).setOrigin(0.5));
      }
      this.content.add(this.text(x + tile / 2, y + tile + 18, found ? t.name : 'Not found yet', 15, found ? INK : '#9a8a78', 800).setOrigin(0.5).setWordWrapWidth(tile - 10).setAlign('center'));
    });
    // Minor collectibles.
    let y = a.y + 36 + (rows - 1) * (tile + 52) + tile + 64;
    this.content.add(this.text(a.x, y, 'Little finds', 18, '#8a6a50', 800));
    y += 30;
    const mw = Math.min(190, (a.w - (MINORS.length - 1) * 10) / MINORS.length);
    MINORS.forEach((m, i) => {
      const x = a.x + i * (mw + 10);
      const g = this.add.graphics();
      g.fillStyle(0xf3e6cc, 1); g.fillRoundedRect(x, y, mw, 64, 14);
      const ic = this.add.image(x + 32, y + 32, atlasOf(m.icon), m.icon);
      ic.setScale(Math.min(34 / ic.width, 34 / ic.height));
      this.content.add([g, ic, this.text(x + 60, y + 14, m.name, 14, '#8a6a50', 700), this.text(x + 60, y + 32, `${save.minor[m.id] ?? 0}`, 20, INK, 900)]);
    });
    y += 82;
    const goals = COSMETICS.filter((c) => c.unlock?.minor).map((c) => `${c.name}: ${Math.min(save.minor[c.unlock!.minor![0]] ?? 0, c.unlock!.minor![1])}/${c.unlock!.minor![1]} ${c.unlock!.minor![0]}s`);
    this.content.add(this.text(a.x, y, `Collect to unlock \u2014 ${goals.join('   \u00B7   ')}`, 15, '#8a6a50', 700));
    // Reset (gentle, two taps).
    const rw = 210, rh = 50, rx = a.x + a.w - rw, ry = a.y + a.h - rh;
    const armed = this.time.now < this.resetArmed;
    const [rbg, rz] = this.btn(rx, ry, rw, rh, () => {
      if (this.time.now < this.resetArmed) { resetSave(); location.reload(); return; }
      this.resetArmed = this.time.now + 4000;
      sfx.tock();
      this.render();
      this.time.delayedCall(4100, () => { if (this.open && this.tab === 'treasures') this.render(); });
    }, armed ? 0xf6d2c4 : 0xf3e6cc, armed ? 0xc0563a : 0xd9b98f, 14);
    this.content.add([rbg, rz, this.text(rx + rw / 2, ry + rh / 2, armed ? 'Tap again to start over' : 'Reset progress\u2026', 16, armed ? '#a2402a' : '#8a6a50', 800).setOrigin(0.5)]);
  }

  // ------------------------------------------------------------ fish journal
  renderFish(a: { x: number; y: number; w: number; h: number }) {
    const caught = SPECIES.filter((s) => save.fish[s.id]).length;
    this.content.add(this.text(a.x, a.y, `Fish journal: ${caught} / ${SPECIES.length}`, 20, INK, 800));
    this.content.add(this.text(a.x + a.w, a.y + 4, 'Tap water to fish. Each place has new fish.', 14, '#8a6a50', 700).setOrigin(1, 0));
    const cols = 6, rowsN = 2;
    const tw = (a.w - (cols - 1) * 12) / cols, th = Math.min(200, (a.h - 50 - (rowsN - 1) * 12) / rowsN);
    SPECIES.forEach((sp, i) => {
      const x = a.x + (i % cols) * (tw + 12), y = a.y + 40 + Math.floor(i / cols) * (th + 12);
      const rec = save.fish[sp.id];
      const [bg, z] = this.btn(x, y, tw, th, () => { sfx.blip(); this.hint(rec ? sp.blurb : `Found in the ${sp.where}. ${sp.rarity === 'rare' ? 'Rare!' : ''}`); }, rec ? 0xfff4d6 : 0xe6dccb, rec ? (sp.rarity === 'rare' ? 0xb48cff : 0xf2a93b) : 0xd9b98f, 16);
      this.content.add([bg, z]);
      const ic = this.add.image(x + tw / 2, y + th * 0.36, ATLAS, 'fishicon').setTint(rec ? sp.tint : 0x4a3e34).setAlpha(rec ? 1 : 0.35);
      ic.setScale((tw * (sp.rarity === 'junk' ? 0.4 : 0.55)) / ic.width);
      this.content.add(ic);
      const stars = '\u2605'.repeat(RARITY_STARS[sp.rarity]) || '\u00B7';
      this.content.add(this.text(x + tw / 2, y + th * 0.62, rec ? sp.name : '???', 15, rec ? INK : '#9a8a78', 800).setOrigin(0.5));
      this.content.add(this.text(x + tw / 2, y + th * 0.62 + 20, rec ? `\u00D7${rec.n}  \u00B7  best ${rec.best} cm` : sp.where, 13, '#8a6a50', 700).setOrigin(0.5));
      this.content.add(this.text(x + tw / 2, y + th - 16, stars, 14, sp.rarity === 'rare' ? '#9b6cf0' : '#e2a23b', 900).setOrigin(0.5));
    });
  }

  update(time: number, delta = 16) {
    if (!this.open) return;
    const d = this.drag;
    if (d && d.live && !d.done) {
      // Springy follow: catches up fast but not instantly, and tilts with the swing.
      const k = 1 - Math.exp(-Math.min(delta, 100) / 55);
      const nx = d.ghost.x + (d.tx - d.ghost.x) * k;
      d.vx = d.vx * 0.6 + (nx - d.ghost.x) * 0.4;
      d.ghost.setPosition(nx, d.ghost.y + (d.ty - d.ghost.y) * k).setAngle(Phaser.Math.Clamp(d.vx * 1.6, -22, 22));
    }
    if (this.heroImg) this.heroImg.setScale(this.heroBase * this.heroSquash.x, this.heroBase * this.heroSquash.y * (1 + Math.sin(time / 420) * 0.018));
    if (this.playerDot) {
      const { x, y, s } = this.mapGeom;
      const px = x + this.world.feet.x * s, py = y + this.world.feet.y * s;
      const g = this.playerDot;
      g.clear();
      g.fillStyle(0xffffff, 0.5); g.fillCircle(px, py, 11 + Math.sin(time / 200) * 3);
      g.fillStyle(0xe85d3a, 1); g.fillCircle(px, py, 7);
      g.lineStyle(2, 0xffffff, 1); g.strokeCircle(px, py, 7);
    }
  }
}
