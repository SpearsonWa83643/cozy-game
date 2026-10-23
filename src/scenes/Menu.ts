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
import { LANDMARKS, ensureLandmarkIcons } from '../landmarks';
import { MOUNTS, isMountUnlocked, currentPick, type MountDef } from '../mount/defs';

const INK = '#3d2c20';
const FONT = 'Nunito';
export type Tab = 'map' | 'wardrobe' | 'treasures' | 'fish' | 'stable';
const TABS: [Tab, string][] = [['map', 'Map'], ['wardrobe', 'Wardrobe'], ['treasures', 'Treasures'], ['fish', 'Fish'], ['stable', 'Stable']];

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
    this.heroImg = null; this.playerDot = null; this.hintText = null; this.hintBg = null; this.stageGlow = null; this.tankFx = null; this.tankFish = []; this.stablePets = [];
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
    const themeLeft = bx + bw - 22 - 56 - 18 - THEME_ORDER.length * ((THEME_ORDER.length > 3 ? 56 : 64) + 8);
    const tabW = Math.min(170, (themeLeft - bx - 22 - 10) / TABS.length - 8), tabH = 54;
    TABS.forEach(([id, label], i) => {
      const tx = bx + 22 + i * (tabW + 8), ty = by + 16;
      const on = id === this.tab;
      const [bg, z] = this.btn(tx, ty, tabW, tabH, () => { if (this.tab !== id) { this.tab = id; sfx.blip(); this.render(); } }, on ? theme.ui.tabOn : theme.ui.tab, on ? theme.ui.accentDark : 0xd9b98f);
      this.rects[`tab:${id}`] = this.lastRect;
      const t = this.text(tx + tabW / 2, ty + tabH / 2, label, tabW < 105 ? 15 : tabW < 120 ? 17 : 20, on ? '#fffaf0' : INK, 800).setOrigin(0.5);
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
    else if (this.tab === 'fish') this.renderFish(area);
    else this.renderStable(area);
  }

  private hint(msg: string) {
    if (!this.hintText) {
      this.hintBg = this.add.graphics();
      this.hintText = this.text(this.box.x + this.box.w / 2, this.box.y + this.box.h - 30, '', 17, '#5a3d28', 800).setOrigin(0.5, 1);
      this.root.add([this.hintBg, this.hintText]);
    }
    this.hintText.setText(msg).setAlpha(1);
    // A little paper note behind the words so they read over any scene.
    const t = this.hintText, g = this.hintBg!, w = t.width + 36, h = t.height + 14;
    g.clear().setAlpha(1);
    g.fillStyle(0x2a1a0e, 0.25); g.fillRoundedRect(t.x - w / 2 + 2, t.y - h + 6, w, h, h / 2);
    g.fillStyle(0xfff6e0, 1); g.fillRoundedRect(t.x - w / 2, t.y - h + 3, w, h, h / 2);
    g.lineStyle(2, 0xd9b98f, 1); g.strokeRoundedRect(t.x - w / 2, t.y - h + 3, w, h, h / 2);
    this.tweens.killTweensOf([this.hintText, g]);
    this.tweens.add({ targets: [this.hintText, g], alpha: 0, delay: 2600, duration: 600 });
  }
  private hintBg: Phaser.GameObjects.Graphics | null = null;

  // ------------------------------------------------------------ map
  renderMap(a: { x: number; y: number; w: number; h: number }) {
    // 9.37 slice 1: an old paper map spread on a wooden table, with wooden pins, ribbon labels and a compass.
    this.mapPins = {};
    const desk = this.add.graphics();
    {
      // Warm table planks under everything.
      desk.fillStyle(0x9a6a40, 1); desk.fillRoundedRect(a.x - 6, a.y - 6, a.w + 12, a.h + 12, 18);
      const pl = 46;
      for (let y = a.y - 6, i = 0; y < a.y + a.h + 6; y += pl, i++) {
        const hh = Math.min(pl, a.y + a.h + 6 - y);
        desk.fillStyle(i % 2 ? 0xa4744a : 0x93633b, 1); desk.fillRect(a.x - 6 + (i === 0 ? 0 : 0), y, a.w + 12, hh);
        desk.lineStyle(2, 0x6e4526, 0.55); desk.lineBetween(a.x - 6, y, a.x + a.w + 6, y);
        desk.lineStyle(1.5, 0x7a4d2b, 0.35);
        for (let k = 0; k < 3; k++) { const gy = y + 10 + k * 12; if (gy < y + hh - 4) desk.lineBetween(a.x + 10 + ((i * 97 + k * 53) % 120), gy, a.x + a.w - 10 - ((i * 61 + k * 31) % 140), gy + ((k + i) % 2 ? 1 : -1)); }
        // A knot here and there.
        const kx = a.x + 80 + ((i * 263) % Math.max(1, a.w - 160));
        if (hh > 30) { desk.lineStyle(1.5, 0x6e4526, 0.5); desk.strokeEllipse(kx, y + hh / 2, 16, 8); }
      }
      desk.lineStyle(3, 0x5e3a1f, 1); desk.strokeRoundedRect(a.x - 6, a.y - 6, a.w + 12, a.h + 12, 18);
    }
    this.content.add(desk);
    const pad = 22, legendH = 0;
    const s = Math.min((a.w - pad * 2) / WORLD_W, (a.h - pad * 2 - legendH) / WORLD_H);
    const mw = WORLD_W * s, mh = WORLD_H * s;
    const mx = a.x + (a.w - mw) / 2, my = a.y + (a.h - legendH - mh) / 2;
    this.mapGeom = { x: mx, y: my, s };
    const key = 'minimap';
    const px = Math.ceil(mw * DPR), ph = Math.ceil(mh * DPR);
    const canvas = document.createElement('canvas');
    canvas.width = px; canvas.height = ph;
    const c = canvas.getContext('2d')!;
    const k = px / WORLD_W;
    const cols: Record<AreaId, string> = { glade: '#a3c26e', river: '#9cc47f', forest: '#83a57c', orchard: '#c8c477', lake: '#a9c77e', village: '#b3cf7c' };
    // Sample the world coarsely into a tiny canvas, then upscale with smoothing for soft painted edges.
    const cell = 25;
    const cw = Math.ceil(WORLD_W / cell), chh = Math.ceil(WORLD_H / cell);
    const lo = document.createElement('canvas'); lo.width = cw; lo.height = chh;
    const lc = lo.getContext('2d')!;
    const fog = document.createElement('canvas'); fog.width = cw; fog.height = chh;
    const fc = fog.getContext('2d')!;
    fc.fillStyle = 'rgba(236,220,186,0.94)';
    for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
      const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
      const ar = areaAt(cx, cy);
      const wa = waterAt(cx, cy);
      const lake = ar === 'lake' && !wa ? Math.hypot((cx - 1050) / 700, (cy - 2480) / 330) : 9;
      lc.fillStyle = wa ? '#6fb0c8' : lake < 1.3 ? '#e8d6a6' : cols[ar];
      lc.fillRect(i, j, 1, 1);
      if (!save.visited.includes(ar)) fc.fillRect(i, j, 1, 1);
    }
    // Parchment base so the painted land sits on paper.
    c.fillStyle = '#efdfb8'; c.fillRect(0, 0, px, ph);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    const blur = Math.max(2, Math.round((cell * k) / 2.2));
    c.filter = `blur(${blur}px)`; c.globalAlpha = 0.92; c.drawImage(lo, 0, 0, px, ph); c.globalAlpha = 1; c.filter = 'none';
    // Inked coast lines: a darker halo just inside the water.
    c.strokeStyle = '#e9d3a6'; c.lineWidth = 26 * k; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const p of ALL_PATHS) { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k))); c.stroke(); }
    // Dotted trail ink down the middle of each path.
    c.strokeStyle = 'rgba(122,82,48,0.55)'; c.lineWidth = Math.max(1.5, 5 * k); c.setLineDash([10 * k * 2, 14 * k * 2]);
    for (const p of ALL_PATHS) { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k))); c.stroke(); }
    c.setLineDash([]);
    c.fillStyle = '#9b7146';
    for (const b of Object.values(BRIDGES)) c.fillRect((b.x - b.half) * k, (b.y - 20) * k, b.half * 2 * k, 40 * k);
    c.fillRect((PIER.x - 20) * k, PIER.y0 * k, 40 * k, (PIER.y1 - PIER.y0) * k);
    // Little inked trees in the forest and orchard, waves on the water (deterministic scatter).
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 900; n++) {
      const wx = rnd() * WORLD_W, wy = rnd() * WORLD_H, ar = areaAt(wx, wy);
      if (!save.visited.includes(ar)) continue;
      if (waterAt(wx, wy)) {
        if (rnd() < 0.25) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = Math.max(1.2, 4 * k); c.beginPath(); c.arc(wx * k, wy * k, 14 * k * 2, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
      } else if ((ar === 'forest' && rnd() < 0.5) || (ar === 'orchard' && rnd() < 0.18)) {
        const r = (ar === 'forest' ? 26 : 20) * k * 2;
        c.fillStyle = ar === 'forest' ? 'rgba(74,112,72,0.75)' : 'rgba(150,150,70,0.7)';
        c.beginPath(); c.arc(wx * k, wy * k, r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(70,50,32,0.5)'; c.lineWidth = Math.max(1, 2.5 * k); c.stroke();
      }
    }
    // Unvisited areas stay misty.
    c.filter = `blur(${blur}px)`; c.drawImage(fog, 0, 0, px, ph); c.filter = 'none';
    // Aged paper: burnt, darker edges.
    const vg = c.createRadialGradient(px / 2, ph / 2, Math.min(px, ph) * 0.35, px / 2, ph / 2, Math.hypot(px, ph) * 0.56);
    vg.addColorStop(0, 'rgba(120,80,40,0)'); vg.addColorStop(1, 'rgba(120,76,36,0.42)');
    c.fillStyle = vg; c.fillRect(0, 0, px, ph);
    lo.width = lo.height = fog.width = fog.height = 1;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addImage(key, canvas as unknown as HTMLImageElement);
    canvas.width = 1; canvas.height = 1;
    // The paper sheet: a soft shadow on the table, then a deckled (torn) edge just outside the map.
    const paper = this.add.graphics();
    const deckle = (ox: number, oy: number, e: number) => {
      const pts: Phaser.Math.Vector2[] = [];
      let sd = 3; const r = () => ((sd = (sd * 48271) % 2147483647) / 2147483647);
      const x0 = mx - e + ox, y0 = my - e + oy, x1 = mx + mw + e + ox, y1 = my + mh + e + oy, st = 14;
      for (let x = x0; x < x1; x += st) pts.push(new Phaser.Math.Vector2(x, y0 + r() * 4));
      for (let y = y0; y < y1; y += st) pts.push(new Phaser.Math.Vector2(x1 - r() * 4, y));
      for (let x = x1; x > x0; x -= st) pts.push(new Phaser.Math.Vector2(x, y1 - r() * 4));
      for (let y = y1; y > y0; y -= st) pts.push(new Phaser.Math.Vector2(x0 + r() * 4, y));
      return pts;
    };
    paper.fillStyle(0x2a1a0e, 0.35); paper.fillPoints(deckle(5, 9, 12), true);
    paper.fillStyle(0xf4e6c4, 1); paper.fillPoints(deckle(0, 0, 12), true);
    paper.lineStyle(1.5, 0xb89564, 0.8); paper.strokePoints(deckle(0, 0, 12), true);
    const img = this.add.image(mx, my, key).setOrigin(0, 0).setScale(1 / DPR);
    const frame = this.add.graphics();
    // A thin double ink border like an old chart.
    frame.lineStyle(2.5, 0x7a5434, 0.9); frame.strokeRect(mx, my, mw, mh);
    frame.lineStyle(1, 0x7a5434, 0.6); frame.strokeRect(mx + 5, my + 5, mw - 10, mh - 10);
    // Curled corners: a lighter fold with a shadow.
    for (const [cx0, cy0, sx, sy] of [[mx + mw + 12, my + mh + 12, -1, -1], [mx - 12, my - 12, 1, 1]] as const) {
      frame.fillStyle(0x2a1a0e, 0.18); frame.fillTriangle(cx0, cy0 + sy * 4, cx0 + sx * 30, cy0 + sy * 4, cx0, cy0 + sy * 34);
      frame.fillStyle(0xe2cc9c, 1); frame.fillTriangle(cx0 + sx * 26, cy0, cx0, cy0 + sy * 26, cx0 + sx * 22, cy0 + sy * 22);
      frame.lineStyle(1.5, 0xb89564, 1); frame.strokeTriangle(cx0 + sx * 26, cy0, cx0, cy0 + sy * 26, cx0 + sx * 22, cy0 + sy * 22);
    }
    this.content.add([paper, img, frame]);
    this.drawCompass(mx + mw - 58, my + 62, Math.min(46, mh * 0.09));
    // Area names on little ribbon banners.
    const centers: Record<AreaId, [number, number]> = { glade: [900, 760], river: [2120, 1150], forest: [3400, 380], orchard: [3200, 2250], lake: [700, 2250], village: [470, 1760] };
    for (const [id, [x, y]] of Object.entries(centers) as [AreaId, [number, number]][]) {
      this.ribbon(mx + x * s, my + y * s, save.visited.includes(id) ? AREA_NAMES[id] : '? ? ?', save.visited.includes(id));
    }
    // Puzzle spots: wax seals (orange = still a puzzle, green = solved).
    const mark = (wx: number, wy: number, done: boolean, area: AreaId) => {
      if (!save.visited.includes(area)) return;
      const gg = this.add.graphics();
      const x = mx + wx * s, y = my + wy * s;
      gg.fillStyle(0x2a1a0e, 0.3); gg.fillCircle(x + 1.5, y + 3, 12);
      const col = done ? 0x5fae4a : 0xd8732c, dark = done ? 0x3f7f30 : 0xa2501c;
      gg.fillStyle(col, 1);
      for (let q = 0; q < 8; q++) { const an = (q / 8) * Math.PI * 2; gg.fillCircle(x + Math.cos(an) * 8, y + Math.sin(an) * 8, 5); }
      gg.fillCircle(x, y, 10); gg.lineStyle(2, dark, 1); gg.strokeCircle(x, y, 7);
      this.content.add([gg, this.text(x, y, done ? '\u2713' : '?', 12, '#fffaf0', 900).setOrigin(0.5)]);
    };
    mark(SHRINE.x, SHRINE.y, !!save.puzzles.lanterns, 'glade');
    mark(POT_CHEST.x, POT_CHEST.y - 40, !!save.puzzles.pots, 'glade');
    mark(BELL_CHEST.x, BELL_CHEST.y, !!save.puzzles.bells, 'orchard');
    mark(TILES.x, TILES.y, !!save.puzzles.tiles, 'forest');
    mark(DIG.x, DIG.y, !!save.puzzles.dig, 'lake');
    if (save.visited.includes('orchard')) this.content.add(this.text(mx + (WINDMILL.x + 10) * s, my + (WINDMILL.y - 60) * s, '\u2738', 18, '#6b4a33', 800).setOrigin(0.5));
    // Landmarks: wooden pins pushed into the paper, with their big icons. Tap one to hear about it.
    ensureLandmarkIcons(this);
    const pinR = Math.max(20, Math.min(28, mw * 0.022));
    for (const lm of LANDMARKS) {
      const ar = areaAt(lm.x, lm.y);
      if (!save.visited.includes(ar) && lm.id !== 'wild') continue;
      if (lm.id === 'wild' && !save.visited.includes('orchard')) continue;
      const x = mx + lm.x * s, y = my + lm.y * s - pinR * 0.9;
      const sh = this.add.ellipse(x + 4, my + lm.y * s + 3, pinR * 1.1, pinR * 0.42, 0x2a1a0e, 0.3);
      const g = this.add.graphics();
      g.fillStyle(0x7a5434, 1); g.fillTriangle(-5, pinR * 0.7, 5, pinR * 0.7, 0, pinR * 1.55);
      g.fillStyle(0x5a3d28, 0.35); g.fillCircle(2, 3, pinR + 1);
      g.fillStyle(0xfff6e0, 1); g.fillCircle(0, 0, pinR);
      g.lineStyle(3.5, theme.ui.accent, 1); g.strokeCircle(0, 0, pinR - 1.5);
      const ic = this.add.image(0, -1, lm.icon).setDisplaySize(pinR * 1.6, pinR * 1.6);
      const pin = this.add.container(x, y, [g, ic]);
      this.content.add([sh, pin]);
      const r = pinR + 8;
      this.rects[`pin:${lm.id}`] = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
      this.mapPins[lm.id] = pin;
      const z = this.add.zone(x, y, r * 2, r * 2).setInteractive();
      z.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.getDistance() >= 24) return;
        sfx.blip();
        this.lastPin = lm.id;
        this.tweens.killTweensOf(pin);
        pin.setScale(1).setY(y);
        this.tweens.add({ targets: pin, y: y - 12, scale: 1.18, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
        this.hint(`${lm.name}! Ride your mount and tap ${lm.name} to fly here.`);
      });
      this.content.add(z);
    }
    // You are here: a red pin that bobs (drawn every frame in update()).
    this.playerDot = this.add.graphics();
    this.content.add(this.playerDot);
    // Legend on a paper tag pinned to the corner.
    const lx = mx + 16, ly = my + mh - 46;
    const tag = this.add.graphics();
    tag.fillStyle(0x2a1a0e, 0.25); tag.fillRoundedRect(lx + 3, ly + 4, 236, 36, 8);
    tag.fillStyle(0xfff6e0, 1); tag.fillRoundedRect(lx, ly, 236, 36, 8);
    tag.lineStyle(1.5, 0xb89564, 1); tag.strokeRoundedRect(lx, ly, 236, 36, 8);
    tag.fillStyle(0xd8732c, 1); tag.fillCircle(lx + 18, ly + 18, 7);
    tag.fillStyle(0x5fae4a, 1); tag.fillCircle(lx + 116, ly + 18, 7);
    this.content.add([tag, this.text(lx + 30, ly + 18, 'Puzzle', 14, '#6b4a33', 800).setOrigin(0, 0.5), this.text(lx + 128, ly + 18, 'Solved!', 14, '#6b4a33', 800).setOrigin(0, 0.5)]);
    // Unfold: the paper settles onto the table.
    for (const o of [paper, img, frame]) { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 260, ease: 'Quad.easeOut' }); }
  }

  mapPins: Record<string, Phaser.GameObjects.Container> = {};
  treasureImgs: Record<string, Phaser.GameObjects.Image> = {};
  /** Last treasure tapped on the shelf (for tests). */
  lastTreasure = '';
  /** Last landmark pin tapped on the map (for tests). */
  lastPin = '';

  /** A hand-inked compass rose. */
  private drawCompass(x: number, y: number, r: number) {
    const g = this.add.graphics();
    g.fillStyle(0xfff6e0, 0.85); g.fillCircle(x, y, r * 0.78);
    g.lineStyle(2, 0x7a5434, 1); g.strokeCircle(x, y, r * 0.78); g.strokeCircle(x, y, r * 0.66);
    const star = (len: number, wid: number, rot: number, c1: number, c2: number) => {
      for (let q = 0; q < 4; q++) {
        const an = rot + (q * Math.PI) / 2, ca = Math.cos(an), sa = Math.sin(an), cb = Math.cos(an + Math.PI / 2), sb = Math.sin(an + Math.PI / 2);
        g.fillStyle(c1, 1); g.fillTriangle(x, y, x + ca * len, y + sa * len, x + cb * wid, y + sb * wid);
        g.fillStyle(c2, 1); g.fillTriangle(x, y, x + ca * len, y + sa * len, x - cb * wid, y - sb * wid);
      }
    };
    star(r * 0.62, r * 0.14, Math.PI / 4, 0xc9a777, 0x9b7146);
    star(r * 1.0, r * 0.2, -Math.PI / 2, theme.ui.accent, theme.ui.accentDark);
    g.fillStyle(0xfff6e0, 1); g.fillCircle(x, y, r * 0.1);
    this.content.add([g, this.text(x, y - r * 1.0 - 10, 'N', 16, '#6b4a33', 900).setOrigin(0.5)]);
  }

  /** An area name on a little cloth ribbon with folded tails. */
  private ribbon(x: number, y: number, label: string, known: boolean) {
    const t = this.text(x, y, label, 15, known ? '#fffaf0' : '#8a6a50', 900).setOrigin(0.5);
    const w = t.width + 26, h = 26;
    const g = this.add.graphics();
    const col = known ? theme.ui.accent : 0xe2d2b0, dark = known ? theme.ui.accentDark : 0xbfa982;
    // Tails.
    g.fillStyle(dark, 1);
    g.fillTriangle(x - w / 2 - 14, y - h / 2 + 6, x - w / 2 + 4, y - h / 2 + 6, x - w / 2 + 4, y + h / 2 + 6);
    g.fillTriangle(x - w / 2 - 14, y + h / 2 + 6, x - w / 2 + 4, y + h / 2 + 6, x - w / 2 - 6, y + 6);
    g.fillTriangle(x + w / 2 + 14, y - h / 2 + 6, x + w / 2 - 4, y - h / 2 + 6, x + w / 2 - 4, y + h / 2 + 6);
    g.fillTriangle(x + w / 2 + 14, y + h / 2 + 6, x + w / 2 - 4, y + h / 2 + 6, x + w / 2 + 6, y + 6);
    g.fillStyle(0x2a1a0e, 0.22); g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 3, w, h, 5);
    g.fillStyle(col, 1); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 5);
    g.lineStyle(1.5, 0xfff6e0, 0.6); g.strokeRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, 3);
    this.content.add([g, t]);
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
    // 9.37 slice 2: a wooden display cabinet. Found treasures sit on cushions under glass domes;
    // ones still out there are dark silhouettes on an empty stand. Little finds fill glass jars below.
    this.treasureImgs = {};
    const n = TREASURES.length;
    const got = TREASURES.filter((t) => save.treasures.includes(t.id)).length;
    const cols = n > 7 ? Math.ceil(n / 2) : n;
    const rows = Math.ceil(n / cols);
    const capH = 40, jarsH = 112, footH = 58;
    const cx0 = a.x, cy0 = a.y, cw = a.w, ch = a.h - jarsH - footH;
    const g = this.add.graphics();
    // Cabinet body: a dark wood frame, a lighter back panel with vertical boards, a crown on top.
    g.fillStyle(0x2a1a0e, 0.3); g.fillRoundedRect(cx0 + 4, cy0 + 8, cw, ch, 16);
    g.fillStyle(0x8a5a34, 1); g.fillRoundedRect(cx0, cy0, cw, ch, 16);
    g.lineStyle(3, 0x5a3a20, 1); g.strokeRoundedRect(cx0, cy0, cw, ch, 16);
    const ix = cx0 + 14, iy = cy0 + capH, iw = cw - 28, ih = ch - capH - 14;
    g.fillStyle(0x5e3c26, 1); g.fillRect(ix, iy, iw, ih);
    g.lineStyle(1.5, 0x4a2e1c, 0.8);
    for (let x = ix + 34; x < ix + iw - 6; x += 38) g.lineBetween(x, iy + 2, x, iy + ih - 2);
    // Soft light from the top of each shelf bay.
    const bayH = ih / rows;
    for (let r = 0; r < rows; r++) {
      g.fillStyle(0xffe6b0, 0.1); g.fillRect(ix, iy + r * bayH, iw, bayH * 0.45);
      // The shelf board with a lit front edge.
      const sy = iy + (r + 1) * bayH - 12;
      g.fillStyle(0x2a1a0e, 0.35); g.fillRect(ix, sy - 4, iw, 4);
      g.fillStyle(0xa8743f, 1); g.fillRect(ix - 4, sy, iw + 8, 12);
      g.fillStyle(0xc99158, 1); g.fillRect(ix - 4, sy, iw + 8, 3);
    }
    this.content.add(g);
    // A brass plaque with the count on the crown.
    const plq = `Treasures found: ${got} / ${n}`;
    const pt = this.text(cx0 + cw / 2, cy0 + capH / 2 + 1, plq, 18, '#5a3d14', 900).setOrigin(0.5);
    const pw = pt.width + 40;
    const pg = this.add.graphics();
    pg.fillStyle(0x2a1a0e, 0.3); pg.fillRoundedRect(cx0 + cw / 2 - pw / 2 + 2, cy0 + 7, pw, 28, 8);
    pg.fillStyle(0xe8c25a, 1); pg.fillRoundedRect(cx0 + cw / 2 - pw / 2, cy0 + 5, pw, 28, 8);
    pg.lineStyle(2, 0xa87b22, 1); pg.strokeRoundedRect(cx0 + cw / 2 - pw / 2 + 3, cy0 + 8, pw - 6, 22, 6);
    pg.fillStyle(0xa87b22, 1); pg.fillCircle(cx0 + cw / 2 - pw / 2 + 9, cy0 + 19, 2.5); pg.fillCircle(cx0 + cw / 2 + pw / 2 - 9, cy0 + 19, 2.5);
    this.content.add([pg, pt]);
    const cellW = iw / cols;
    TREASURES.forEach((t, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const x = ix + cellW * (c + 0.5), shelfY = iy + (r + 1) * bayH - 12;
      const found = save.treasures.includes(t.id);
      const sz = Math.min(cellW * 0.62, bayH * 0.42);
      const iyc = shelfY - 26 - sz / 2;
      const sg = this.add.graphics();
      // Stand: a small turned-wood base; found treasures get a red velvet cushion.
      sg.fillStyle(0x2a1a0e, 0.3); sg.fillEllipse(x + 2, shelfY - 2, cellW * 0.72, 9);
      sg.fillStyle(0x6e4526, 1); sg.fillRoundedRect(x - cellW * 0.3, shelfY - 12, cellW * 0.6, 10, 4);
      sg.fillStyle(0x9b6a3c, 1); sg.fillRoundedRect(x - cellW * 0.26, shelfY - 16, cellW * 0.52, 6, 3);
      if (found) { sg.fillStyle(0xb8323a, 1); sg.fillEllipse(x, shelfY - 19, cellW * 0.54, 12); sg.fillStyle(0xd85a5a, 1); sg.fillEllipse(x - 3, shelfY - 21, cellW * 0.3, 5); }
      this.content.add(sg);
      let img: Phaser.GameObjects.Image;
      if (found) {
        const glow = this.add.image(x, iyc, ATLAS, 'glow').setBlendMode('ADD').setTint(0xffd27a).setAlpha(0.4).setScale(sz / 170);
        img = this.add.image(x, iyc, atlasOf(t.icon), t.icon);
        img.setScale(Math.min(sz / img.width, sz / img.height));
        this.content.add([glow, img]);
        // Glass dome: a pale outline with a highlight streak.
        const dome = this.add.graphics();
        const dw = Math.min(cellW * 0.6, sz * 1.25), dh = sz * 1.35, dy = shelfY - 18;
        dome.fillStyle(0xdff4ff, 0.12); dome.fillRoundedRect(x - dw / 2, dy - dh, dw, dh, { tl: dw / 2, tr: dw / 2, bl: 2, br: 2 });
        dome.lineStyle(2, 0xeaf8ff, 0.55); dome.strokeRoundedRect(x - dw / 2, dy - dh, dw, dh, { tl: dw / 2, tr: dw / 2, bl: 2, br: 2 });
        dome.lineStyle(3, 0xffffff, 0.5); dome.beginPath(); dome.arc(x, dy - dh + dw / 2, dw / 2 - 6, Math.PI * 1.08, Math.PI * 1.38); dome.strokePath();
        dome.fillStyle(0xe8c25a, 1); dome.fillCircle(x, dy - dh - 3, 3.5);
        this.content.add(dome);
      } else {
        img = this.add.image(x, iyc, atlasOf(t.icon), t.icon).setTint(0x1d130c).setAlpha(0.55);
        img.setScale(Math.min(sz / img.width, sz / img.height));
        this.content.add([img, this.text(x, iyc, '?', Math.round(sz * 0.42), '#e8d6b0', 900).setOrigin(0.5).setAlpha(0.8)]);
      }
      this.treasureImgs[t.id] = img;
      // Name plaque on the shelf edge.
      const nm = found ? t.name : '???';
      const tt = this.text(x, shelfY + 6, nm, cellW < 90 ? 11 : 13, found ? '#4a3010' : '#d8c4a0', 800).setOrigin(0.5).setWordWrapWidth(cellW - 6).setAlign('center');
      if (found) { const lg = this.add.graphics(); const lw = Math.min(cellW - 6, tt.width + 12); lg.fillStyle(0xe8c25a, 1); lg.fillRoundedRect(x - lw / 2, shelfY, lw, 13, 3); this.content.add(lg); tt.setFontSize(10); }
      this.content.add(tt);
      const hit = { x: x - cellW / 2, y: shelfY - bayH + 14, w: cellW, h: bayH - 2 };
      this.rects[`treasure:${t.id}`] = hit;
      const z = this.add.zone(hit.x, hit.y, hit.w, hit.h).setOrigin(0, 0).setInteractive();
      z.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.getDistance() >= 24) return;
        this.lastTreasure = t.id;
        this.tweens.killTweensOf(img);
        img.setY(iyc).setAngle(0);
        if (found) {
          sfx.sparkle();
          this.tweens.add({ targets: img, y: iyc - 14, angle: { from: -8, to: 8 }, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.easeInOut', onComplete: () => img.setAngle(0) });
          this.sparkles(x, iyc, sz * 0.8);
          this.hint(t.blurb);
        } else {
          sfx.blip();
          this.tweens.add({ targets: img, x: { from: x - 4, to: x + 4 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => img.setX(x) });
          this.hint(`Hint: ${t.hint}`);
        }
      });
      this.content.add(z);
    });
    // Little finds: glass jars on a low shelf, filled with what you've gathered.
    const jy = cy0 + ch + 10;
    const jg = this.add.graphics();
    jg.fillStyle(0xa8743f, 1); jg.fillRoundedRect(a.x, jy + jarsH - 22, a.w * 0.62, 12, 4);
    jg.fillStyle(0xc99158, 1); jg.fillRect(a.x + 4, jy + jarsH - 22, a.w * 0.62 - 8, 3);
    this.content.add(jg);
    const jw = Math.min(86, (a.w * 0.62 - 10) / MINORS.length);
    MINORS.forEach((m, i) => {
      const x = a.x + 8 + jw * (i + 0.5), bot = jy + jarsH - 22, jh = 62, jwd = jw * 0.72;
      const cnt = save.minor[m.id] ?? 0;
      const fill = Math.min(1, cnt / 20);
      const g2 = this.add.graphics();
      // Contents first (a warm tint rising with the count), then the glass over it.
      if (fill > 0) { g2.fillStyle(0xf2d38a, 0.55); g2.fillRoundedRect(x - jwd / 2 + 3, bot - 4 - (jh - 14) * fill, jwd - 6, (jh - 14) * fill, 6); }
      this.content.add(g2);
      const ic = this.add.image(x, bot - jh * 0.42, atlasOf(m.icon), m.icon);
      ic.setScale(Math.min(30 / ic.width, 30 / ic.height)).setAlpha(cnt ? 1 : 0.35);
      const glass = this.add.graphics();
      glass.fillStyle(0xdff4ff, 0.18); glass.fillRoundedRect(x - jwd / 2, bot - jh, jwd, jh, 10);
      glass.lineStyle(2, 0xeaf8ff, 0.8); glass.strokeRoundedRect(x - jwd / 2, bot - jh, jwd, jh, 10);
      glass.fillStyle(0xffffff, 0.45); glass.fillRoundedRect(x - jwd / 2 + 5, bot - jh + 10, 4, jh - 22, 2);
      glass.fillStyle(0x9b6a3c, 1); glass.fillRoundedRect(x - jwd / 2 - 2, bot - jh - 8, jwd + 4, 10, 3);
      this.content.add([ic, glass]);
      // Count on a little paper label.
      const lab = this.add.graphics(); lab.fillStyle(0xfff6e0, 1); lab.fillRoundedRect(x - 16, bot - 22, 32, 18, 5); lab.lineStyle(1, 0xb89564, 1); lab.strokeRoundedRect(x - 16, bot - 22, 32, 18, 5);
      this.content.add([lab, this.text(x, bot - 13, `${cnt}`, 13, INK, 900).setOrigin(0.5)]);
      this.content.add(this.text(x, bot + 8, m.name, 11, '#8a6a50', 800).setOrigin(0.5, 0).setWordWrapWidth(jw).setAlign('center'));
      const hz = { x: x - jw / 2, y: bot - jh - 8, w: jw, h: jh + 26 };
      this.rects[`minor:${m.id}`] = hz;
      const z = this.add.zone(hz.x, hz.y, hz.w, hz.h).setOrigin(0, 0).setInteractive();
      z.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 24) { sfx.blip(); this.tweens.add({ targets: ic, y: ic.y - 8, duration: 120, yoyo: true }); this.hint(`${m.name}: ${cnt}`); } });
      this.content.add(z);
    });
    const goals = COSMETICS.filter((c) => c.unlock?.minor).map((c) => `${c.name}: ${Math.min(save.minor[c.unlock!.minor![0]] ?? 0, c.unlock!.minor![1])}/${c.unlock!.minor![1]} ${c.unlock!.minor![0]}s`);
    this.content.add(this.text(a.x + a.w * 0.64, jy + 8, 'Collect to unlock', 15, '#8a6a50', 900));
    this.content.add(this.text(a.x + a.w * 0.64, jy + 30, goals.join('\n'), 13, '#8a6a50', 700).setLineSpacing(2));
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

  // ------------------------------------------------------------ fish aquarium + journal
  /** 9.37 slice 3: fish you have caught swim in a glass tank; the journal cards below list every species. */
  tankFish: { id: string; img: Phaser.GameObjects.Image; x: number; y: number; vx: number; by: number; ph: number; dart: number; s: number; boot: boolean }[] = [];
  private tankFx: Phaser.GameObjects.Graphics | null = null;
  private tankBox = { x: 0, y: 0, w: 0, h: 0, sand: 0 };
  private bubbles: { x: number; y: number; r: number; v: number }[] = [];
  lastFish = '';

  private pokeFish(id: string) {
    const sp = SPECIES.find((s) => s.id === id)!;
    const f = this.tankFish.find((t) => t.id === id);
    this.lastFish = id;
    if (!f) { sfx.tock(); this.hint(`Not caught yet. Look in the ${sp.where}. ${sp.rarity === 'rare' ? 'Rare!' : ''}`.trim()); return; }
    sfx.blip();
    this.hint(`${sp.name}! ${sp.blurb}`);
    if (f.boot) { this.tweens.add({ targets: f.img, angle: { from: -14, to: 14 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => f.img.setAngle(0) }); return; }
    f.dart = 700; f.vx = (f.vx >= 0 ? 1 : -1) * Math.max(Math.abs(f.vx), 30);
    this.tweens.add({ targets: f.img, scaleX: f.s * 1.25, scaleY: f.s * 0.8, duration: 110, yoyo: true });
    if (sp.rarity === 'rare' || sp.rarity === 'uncommon') this.sparkles(f.x, f.y, 34);
    for (let i = 0; i < 4; i++) this.bubbles.push({ x: f.x + (f.vx > 0 ? 20 : -20), y: f.y - 4, r: 3 + Math.random() * 3, v: 30 + Math.random() * 25 });
  }

  renderFish(a: { x: number; y: number; w: number; h: number }) {
    this.tankFish = []; this.bubbles = [];
    const caught = SPECIES.filter((s) => save.fish[s.id]);
    const cols = 6, rowsN = Math.ceil(SPECIES.length / cols), gap = 10, cardH = 74;
    const jH = rowsN * cardH + (rowsN - 1) * gap;
    const tx = a.x, ty = a.y, tw = a.w, th = a.h - jH - 16;
    const g = this.add.graphics();
    // Wooden stand + tank frame.
    g.fillStyle(0x2a1a0e, 0.3); g.fillRoundedRect(tx + 4, ty + 8, tw, th, 18);
    g.fillStyle(0x7a4e2c, 1); g.fillRoundedRect(tx, ty, tw, th, 18);
    g.lineStyle(3, 0x4f321c, 1); g.strokeRoundedRect(tx, ty, tw, th, 18);
    const wx = tx + 14, wy = ty + 14, ww = tw - 28, wh = th - 28, sandH = Math.min(46, wh * 0.18);
    // Water: deep blue at the bottom, light at the top.
    g.fillGradientStyle(0x9fdcf0, 0x9fdcf0, 0x2f7fae, 0x2f7fae, 1); g.fillRect(wx, wy, ww, wh);
    // Light rays from the top.
    for (let i = 0; i < 5; i++) {
      const rx = wx + ww * (0.1 + i * 0.2);
      g.fillStyle(0xffffff, 0.08); g.fillTriangle(rx - 18, wy, rx + 22, wy, rx + 70 - i * 10, wy + wh - sandH);
    }
    // Sand with pebbles, rocks and a little castle.
    const sy = wy + wh - sandH;
    g.fillStyle(0xe8cf98, 1); g.fillRect(wx, sy, ww, sandH);
    g.fillStyle(0xf5e2b6, 1); g.fillRect(wx, sy, ww, 4);
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 60; i++) { g.fillStyle([0xc9a46a, 0xb08850, 0xd8b98a, 0xa0c4c0][i % 4], 1); g.fillCircle(wx + rnd() * ww, sy + 8 + rnd() * (sandH - 12), 2 + rnd() * 3); }
    g.fillStyle(0x8f949a, 1); g.fillEllipse(wx + ww * 0.82, sy + 4, 90, 44); g.fillStyle(0xa9aeb4, 1); g.fillEllipse(wx + ww * 0.8, sy - 2, 60, 30);
    g.fillStyle(0x7d8288, 1); g.fillEllipse(wx + ww * 0.12, sy + 6, 64, 30);
    // Castle.
    const kx = wx + ww * 0.62, kb = sy + 10;
    g.fillStyle(0xd88a5a, 1); g.fillRect(kx - 30, kb - 52, 60, 52); g.fillRect(kx - 40, kb - 70, 20, 70); g.fillRect(kx + 20, kb - 70, 20, 70);
    g.fillStyle(0xb86a3e, 1); for (const cx of [kx - 40, kx + 20]) for (let j = 0; j < 3; j++) g.fillRect(cx + j * 7, kb - 76, 5, 6);
    g.fillStyle(0x2a3b52, 1); g.fillRoundedRect(kx - 10, kb - 26, 20, 26, { tl: 10, tr: 10, bl: 0, br: 0 }); g.fillCircle(kx - 30, kb - 52, 0);
    g.fillStyle(0x2a3b52, 0.9); g.fillRect(kx - 34, kb - 58, 8, 10); g.fillRect(kx + 26, kb - 58, 8, 10);
    // Water plants (simple wavy strands).
    const plant = (px: number, hgt: number, col: number) => {
      g.lineStyle(7, col, 1);
      g.beginPath(); g.moveTo(px, sy + 6);
      for (let k = 1; k <= 8; k++) g.lineTo(px + Math.sin(k * 1.1) * 9, sy + 6 - (hgt * k) / 8);
      g.strokePath();
    };
    [[0.05, 0.6, 0x3f9a5a], [0.08, 0.42, 0x58b56c], [0.3, 0.5, 0x3f9a5a], [0.33, 0.34, 0x6cc47a], [0.93, 0.55, 0x3f9a5a], [0.96, 0.38, 0x58b56c], [0.72, 0.3, 0x6cc47a]].forEach(([f, hh, c]) => plant(wx + ww * f, wh * hh, c));
    // Glass shine + water surface line.
    g.fillStyle(0xffffff, 0.35); g.fillRect(wx, wy, ww, 6);
    g.fillStyle(0xffffff, 0.16); g.fillRect(wx + 18, wy + 14, 10, wh - sandH - 30); g.fillRect(wx + 34, wy + 14, 4, wh - sandH - 30);
    this.content.add(g);
    this.tankBox = { x: wx, y: wy, w: ww, h: wh, sand: sy };
    // Count plaque on the frame.
    const plq = this.text(tx + tw / 2, ty + 7, `Fish caught: ${caught.length} / ${SPECIES.length}`, 16, '#5a3d14', 900).setOrigin(0.5, 0);
    const pg = this.add.graphics();
    pg.fillStyle(0xe8c46a, 1); pg.fillRoundedRect(plq.x - plq.width / 2 - 14, ty + 2, plq.width + 28, plq.height + 10, 8);
    pg.lineStyle(2, 0xa0782c, 1); pg.strokeRoundedRect(plq.x - plq.width / 2 - 14, ty + 2, plq.width + 28, plq.height + 10, 8);
    this.content.add([pg, plq]);
    // Fish.
    const top = wy + 30, bot = sy - 20;
    caught.forEach((sp, i) => {
      const boot = sp.rarity === 'junk';
      const img = this.add.image(0, 0, ATLAS, 'fishicon').setTint(sp.tint);
      const wpx = boot ? 54 : Phaser.Math.Clamp(48 + (sp.size[0] + sp.size[1]) * 0.5, 50, 120);
      const s = wpx / img.width; img.setScale(s);
      const x = boot ? wx + ww * 0.45 : wx + 60 + ((i * 0.37) % 1) * (ww - 120);
      const by = boot ? sy + sandH * 0.35 : top + ((i * 0.61 + 0.2) % 1) * (bot - top);
      const vx = boot ? 0 : (12 + (i % 3) * 7) * (i % 2 ? 1 : -1);
      if (boot) img.setAngle(-20);
      img.setPosition(x, by).setFlipX(vx > 0);
      img.setInteractive(new Phaser.Geom.Rectangle(-10, -14, img.width + 20, img.height + 28), Phaser.Geom.Rectangle.Contains);
      img.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 24) this.pokeFish(sp.id); });
      this.content.add(img);
      this.tankFish.push({ id: sp.id, img, x, y: by, vx, by, ph: i * 1.7, dart: 0, s, boot });
    });
    if (!caught.length) this.content.add(this.text(wx + ww / 2, wy + (wh - sandH) / 2, 'Your tank is empty.\nTap water to fish!', 22, '#ffffff', 900).setOrigin(0.5).setAlign('center').setShadow(0, 2, '#1f4f70', 4, false, true));
    this.tankFx = this.add.graphics();
    this.content.add(this.tankFx);
    // Journal cards.
    const cw = (a.w - (cols - 1) * gap) / cols, jy = ty + th + 16;
    SPECIES.forEach((sp, i) => {
      const x = a.x + (i % cols) * (cw + gap), y = jy + Math.floor(i / cols) * (cardH + gap);
      const rec = save.fish[sp.id];
      const [bg, z] = this.btn(x, y, cw, cardH, () => this.pokeFish(sp.id), rec ? 0xfff4d6 : 0xe6dccb, rec ? (sp.rarity === 'rare' ? 0xb48cff : 0xf2a93b) : 0xd9b98f, 14);
      this.rects[`fishcard:${sp.id}`] = this.lastRect;
      this.content.add([bg, z]);
      const ic = this.add.image(x + 34, y + cardH / 2 - 4, ATLAS, 'fishicon').setTint(rec ? sp.tint : 0x4a3e34).setAlpha(rec ? 1 : 0.4);
      ic.setScale(50 / ic.width);
      this.content.add(ic);
      const stars = '\u2605'.repeat(RARITY_STARS[sp.rarity]) || '\u00B7';
      this.content.add(this.text(x + 34, y + cardH - 14, stars, 12, sp.rarity === 'rare' ? '#9b6cf0' : '#e2a23b', 900).setOrigin(0.5));
      const nm = this.text(x + 66, y + 14, rec ? sp.name : '???', 15, rec ? INK : '#9a8a78', 800);
      if (nm.width > cw - 72) nm.setScale((cw - 72) / nm.width);
      this.content.add(nm);
      const sub = this.text(x + 66, y + 38, rec ? `\u00D7${rec.n} \u00B7 ${rec.best} cm` : `in the ${sp.where}`, 13, '#8a6a50', 700);
      if (sub.width > cw - 72) sub.setScale((cw - 72) / sub.width);
      this.content.add(sub);
    });
  }

  private tickTank(time: number, delta: number) {
    const fx = this.tankFx; if (!fx || !fx.active) return;
    const dt = Math.min(delta, 100) / 1000, B = this.tankBox;
    for (const f of this.tankFish) {
      if (f.boot) continue;
      const sp = f.dart > 0 ? 4 : 1;
      f.dart = Math.max(0, f.dart - delta);
      f.x += f.vx * sp * dt;
      const half = (f.img.displayWidth || 60) / 2;
      if (f.x < B.x + half + 6) { f.x = B.x + half + 6; f.vx = Math.abs(f.vx); }
      if (f.x > B.x + B.w - half - 6) { f.x = B.x + B.w - half - 6; f.vx = -Math.abs(f.vx); }
      f.y = f.by + Math.sin(time / 700 + f.ph) * 7;
      f.img.setPosition(f.x, f.y).setFlipX(f.vx > 0).setAngle(Math.cos(time / 700 + f.ph) * 6 * (f.vx > 0 ? 1 : -1));
      if (Math.random() < dt * 0.25) this.bubbles.push({ x: f.x + (f.vx > 0 ? half * 0.8 : -half * 0.8), y: f.y - 4, r: 2 + Math.random() * 2.5, v: 25 + Math.random() * 20 });
    }
    // The bubbler by the castle.
    if (Math.random() < dt * 3) this.bubbles.push({ x: B.x + B.w * 0.62 + (Math.random() - 0.5) * 8, y: B.sand - 70, r: 2 + Math.random() * 4, v: 40 + Math.random() * 30 });
    fx.clear();
    this.bubbles = this.bubbles.filter((b) => b.y > B.y + 8);
    for (const b of this.bubbles) {
      b.y -= b.v * dt; b.x += Math.sin((b.y + time / 10) / 14) * 0.4;
      fx.lineStyle(1.5, 0xffffff, 0.8); fx.strokeCircle(b.x, b.y, b.r);
      fx.fillStyle(0xffffff, 0.6); fx.fillCircle(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3);
    }
  }

  // ------------------------------------------------------------ mount stable
  /** 9.38: a barn with a stall for every mount. Unlocked friends flap and bob; locked ones are silhouettes. */
  stablePets: { id: string; c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Image; wing: Phaser.GameObjects.Image; wingFar: Phaser.GameObjects.Image; m: MountDef; flap: number; ph: number; on: boolean; k: number; idleAt?: number }[] = [];
  lastMount = '';
  /** Last petting reaction, for tests: which mount, tap or stroke, and the running heart count. */
  lastPet: { id: string; kind: 'tap' | 'stroke'; hearts: number } | null = null;
  petHearts = 0;
  idleCount = 0;
  lastIdle = '';
  private rideBtn: Phaser.GameObjects.Container | null = null;

  /** Slice 3: a big Ride! button on the friend you just petted. */
  private showRide(m: MountDef) {
    this.rideBtn?.destroy(); this.rideBtn = null;
    for (const k of Object.keys(this.rects)) if (k.startsWith('ride:')) delete this.rects[k];
    const r = this.rects[`stall:${m.id}`];
    if (!r) return;
    const bw = Math.min(r.w - 20, 140), bh = 48;
    const x = r.x + (r.w - bw) / 2, y = r.y + r.h - 64 - bh - 6;
    const c = this.add.container(0, 0);
    const [bg, z] = this.btn(x, y, bw, bh, () => this.rideMount(m), theme.ui.accent, theme.ui.accentDark, 24);
    const label = this.text(x + bw / 2, y + bh / 2, m.id === currentPick() ? 'Ride now!' : 'Ride!', 20, '#ffffff', 900).setOrigin(0.5).setStroke('#' + theme.ui.accentDark.toString(16).padStart(6, '0'), 4);
    c.add([bg, z, label]);
    this.content.add(c);
    c.setScale(0.6).setAlpha(0);
    c.setPosition((x + bw / 2) * 0.4, (y + bh / 2) * 0.4);
    this.tweens.add({ targets: c, scale: 1, x: 0, y: 0, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.rideBtn = c;
    this.rects[`ride:${m.id}`] = { x, y, w: bw, h: bh };
  }

  /** Pick this friend as your ride, close the satchel and call it in. */
  rideMount(m: MountDef) {
    save.mountPick = m.id; persist();
    sfx.sparkle();
    this.close();
    this.time.delayedCall(180, () => { const mt = this.world.mount; if (mt?.canCall()) mt.call(m.id); });
  }
  private petSoundAt = 0;

  /** Pop a few hearts up out of a stall. */
  private hearts(x: number, y: number, n: number) {
    if (!this.textures.exists('stable-heart')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xff5c8a, 1); g.fillCircle(9, 9, 8); g.fillCircle(23, 9, 8); g.fillTriangle(1.5, 12, 30.5, 12, 16, 30);
      g.fillStyle(0xffffff, 0.7); g.fillCircle(7, 6, 3);
      g.generateTexture('stable-heart', 32, 32); g.destroy();
    }
    for (let i = 0; i < n; i++) {
      const h = this.add.image(x + Phaser.Math.Between(-24, 24), y + Phaser.Math.Between(-6, 10), 'stable-heart').setScale(0.4).setAlpha(0);
      this.content.add(h);
      this.petHearts++;
      const dur = 1000 + i * 90;
      this.tweens.add({ targets: h, scale: { from: 0.8, to: 1.3 + Math.random() * 0.4 }, y: h.y - 70 - Math.random() * 40, x: h.x + Phaser.Math.Between(-24, 24), duration: dur, delay: i * 70, ease: 'Sine.easeOut', onStart: () => h.setAlpha(1), onComplete: () => h.destroy() });
      this.tweens.add({ targets: h, alpha: 0, duration: dur * 0.4, delay: i * 70 + dur * 0.6 });
    }
  }

  /** Petting: tap = hop + hearts + its happy sound; stroke = wiggle + a trail of hearts. */
  private pet(p: { id: string; c: Phaser.GameObjects.Container; m: MountDef }, kind: 'tap' | 'stroke', px: number, py: number) {
    const now = this.time.now;
    if (kind === 'tap' || now - this.petSoundAt > 450) { sfx.mountHappy(p.m.id); this.petSoundAt = now; }
    const y0 = p.c.getData('y0') as number, k0 = p.c.getData('k0') as number;
    if (kind === 'tap') {
      this.tweens.killTweensOf(p.c);
      p.c.y = y0; p.c.setScale(k0); p.c.rotation = 0;
      this.tweens.add({ targets: p.c, y: y0 - 16, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: p.c, scaleX: k0 * 1.12, scaleY: k0 * 0.9, duration: 90, yoyo: true, delay: 300 });
      this.hearts(p.c.x, y0 - 20, 6);
    } else {
      if (!this.tweens.isTweening(p.c)) this.tweens.add({ targets: p.c, rotation: { from: -0.08, to: 0.08 }, duration: 110, yoyo: true, repeat: 1, onComplete: () => { p.c.rotation = 0; } });
      this.hearts(px, py - 10, 2);
    }
    this.lastPet = { id: p.m.id, kind, hearts: this.petHearts };
  }

  private puppet(m: MountDef, x: number, y: number, targetW: number, on: boolean) {
    const SC = m.scale, prop = m.style === 'prop';
    const sc = (key: string) => SC / (frameScale[key] ?? S);
    const wingFar = this.add.image(prop ? m.propAt![0] * SC : 3 * SC, prop ? m.propAt![1] * SC : -10 * SC, atlasOf(m.wingFar), m.wingFar).setOrigin(0.5, prop ? 0.5 : 0.96).setScale(sc(m.wingFar) * 0.9);
    const body = this.add.image(0, 0, atlasOf(m.body), m.body).setOrigin(0.5, 0.52).setScale(sc(m.body));
    const wing = this.add.image(prop ? m.propAt![0] * SC : -4 * SC, prop ? m.propAt![1] * SC : -7 * SC, atlasOf(m.wing), m.wing).setOrigin(0.5, prop ? 0.5 : 0.96).setScale(sc(m.wing));
    const parts = prop ? [body, wingFar, wing] : [wingFar, body, wing];
    if (!on) for (const o of parts) o.setTint(0x2e2219);
    const c = this.add.container(x, y, parts);
    const k = targetW / Math.max(1, body.width * sc(m.body));
    c.setScale(k).setAlpha(on ? 1 : 0.8);
    return { c, body, wing, wingFar, k };
  }

  private mountHint(m: MountDef) {
    if (!m.treasure) return `${m.name} is always free!`;
    const t = TREASURES.find((x) => x.id === m.treasure);
    if (t) return `Find the ${t.name} to meet the ${m.name}. Hint: ${t.hint}`;
    if (m.id === 'goose') return 'The Canada Goose comes to ride in Fall. Tap the leaf button to try Fall!';
    if (m.id === 'reindeer') return 'The Reindeer comes to ride at Christmas. Tap the tree button to try Christmas!';
    if (m.id === 'pumpkin') return 'The Pumpkin rides along at Halloween!';
    return `Keep exploring to meet the ${m.name}!`;
  }

  private tapStall(m: MountDef) {
    const p = this.stablePets.find((q) => q.id === m.id);
    this.lastMount = m.id;
    if (!p) return;
    if (!p.on) {
      sfx.tock();
      this.hint(this.mountHint(m));
      this.tweens.add({ targets: p.c, x: p.c.x + 5, duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    this.hint(`${m.name}! ${m.blurb} Stroke me for more hearts!`);
    this.pet(p, 'tap', p.c.x, p.c.y);
    this.showRide(m);
  }

  renderStable(a: { x: number; y: number; w: number; h: number }) {
    this.stablePets = []; this.rideBtn = null;
    const list = MOUNTS;
    const got = list.filter(isMountUnlocked).length;
    const cols = Math.ceil(list.length / 2), rows = 2;
    const g = this.add.graphics();
    // Barn: red plank walls under a roof beam, with a hay loft glow.
    g.fillStyle(0x2a1a0e, 0.3); g.fillRoundedRect(a.x + 4, a.y + 8, a.w, a.h, 16);
    g.fillStyle(0xa8432f, 1); g.fillRoundedRect(a.x, a.y, a.w, a.h, 16);
    g.lineStyle(2, 0x7f2c1e, 0.7);
    for (let x = a.x + 30; x < a.x + a.w - 10; x += 34) g.lineBetween(x, a.y + 40, x, a.y + a.h - 4);
    g.fillStyle(0x6a3a22, 1); g.fillRoundedRect(a.x, a.y, a.w, 40, { tl: 16, tr: 16, bl: 0, br: 0 });
    g.fillStyle(0x8a5434, 1); g.fillRect(a.x, a.y + 34, a.w, 6);
    this.content.add(g);
    // Sign on the beam.
    const sign = this.text(a.x + a.w / 2, a.y + 20, `Your stable: ${got} / ${list.length} friends`, 18, '#fff3d6', 900).setOrigin(0.5).setStroke('#4a2a16', 4);
    this.content.add(sign);
    const top = a.y + 56, gap = 10;
    const sw = (a.w - 24 - (cols - 1) * gap) / cols, sh = (a.h - (top - a.y) - 12 - (rows - 1) * gap) / rows;
    list.forEach((m, i) => {
      const on = isMountUnlocked(m);
      const col = i % cols, row = Math.floor(i / cols);
      const x = a.x + 12 + col * (sw + gap), y = top + row * (sh + gap);
      const sg = this.add.graphics();
      // Stall: arched opening, shadowy inside, hay floor, a half-door rail, a name board.
      sg.fillStyle(0x5a2a1a, 1); sg.fillRoundedRect(x - 4, y - 4, sw + 8, sh + 8, { tl: sw / 2, tr: sw / 2, bl: 8, br: 8 });
      sg.fillStyle(0x4a2e1c, 1); sg.fillRoundedRect(x, y, sw, sh, { tl: sw / 2 - 4, tr: sw / 2 - 4, bl: 6, br: 6 });
      sg.fillStyle(0x5e3c26, 1); sg.fillRect(x, y + sh * 0.45, sw, sh * 0.55 - 6);
      sg.fillStyle(0xffe6b0, on ? 0.12 : 0.05); sg.fillEllipse(x + sw / 2, y + sh * 0.5, sw * 0.9, sh * 0.6);
      sg.fillStyle(0xe8c26a, 1); sg.fillRect(x, y + sh - 34, sw, 28);
      sg.fillStyle(0xd4a94e, 1);
      for (let k = 0; k < 9; k++) sg.fillTriangle(x + (k / 9) * sw, y + sh - 34, x + ((k + 0.5) / 9) * sw, y + sh - 44 - (k % 3) * 3, x + ((k + 1) / 9) * sw, y + sh - 34);
      sg.fillStyle(0x8a5434, 1); sg.fillRect(x, y + sh - 60, sw, 7);
      sg.fillStyle(0x6a3a22, 1); sg.fillRect(x + 6, y + sh - 60, 6, 54); sg.fillRect(x + sw - 12, y + sh - 60, 6, 54);
      // Name board.
      sg.fillStyle(on ? 0xf3dfae : 0x8a7560, 1); sg.fillRoundedRect(x + 8, y + sh - 26, sw - 16, 22, 6);
      sg.lineStyle(2, 0x6a3a22, 1); sg.strokeRoundedRect(x + 8, y + sh - 26, sw - 16, 22, 6);
      this.content.add(sg);
      const nm = this.text(x + sw / 2, y + sh - 15, on ? m.name : '???', 13, on ? '#4a2a16' : '#e8dccb', 900).setOrigin(0.5);
      if (nm.width > sw - 22) nm.setScale((sw - 22) / nm.width);
      this.content.add(nm);
      const py = y + sh * 0.46;
      const pp = this.puppet(m, x + sw / 2, py, Math.min(sw * 0.82, 130), on);
      pp.c.setData('y0', py); pp.c.setData('k0', pp.k);
      this.content.add(pp.c);
      if (!on) this.content.add(this.text(x + sw / 2, py - 4, '?', 30, '#f3dfae', 900).setOrigin(0.5).setStroke('#2e2219', 5));
      if (on && m.id === currentPick()) {
        // Your current ride wears a rosette.
        const rg = this.add.graphics();
        rg.fillStyle(theme.ui.accent, 1); rg.fillCircle(x + sw - 20, y + 22, 13);
        rg.fillStyle(0xffffff, 1); rg.fillCircle(x + sw - 20, y + 22, 6);
        rg.fillStyle(theme.ui.accent, 1); rg.fillTriangle(x + sw - 28, y + 30, x + sw - 22, y + 30, x + sw - 30, y + 46); rg.fillTriangle(x + sw - 18, y + 30, x + sw - 12, y + 30, x + sw - 10, y + 46);
        this.content.add(rg);
      }
      this.stablePets.push({ id: m.id, ...pp, m, flap: i * 0.9, ph: i * 1.3, on });
      const z = this.add.zone(x, y, sw, sh).setOrigin(0, 0).setInteractive();
      // Stroking: every ~40 px of finger travel over a friend is one pet. A stroke that ends where it began is not a tap.
      let lastX = 0, lastY = 0, run = 0, moved = 0;
      z.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 24 && moved < 30) this.tapStall(m); });
      z.on('pointerdown', (p: Phaser.Input.Pointer) => { lastX = p.worldX; lastY = p.worldY; run = 0; moved = 0; });
      z.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.isDown) return;
        if (!on) { moved += Math.hypot(p.worldX - lastX, p.worldY - lastY); lastX = p.worldX; lastY = p.worldY; return; }
        { const dd = Math.hypot(p.worldX - lastX, p.worldY - lastY); run += dd; moved += dd; } lastX = p.worldX; lastY = p.worldY;
        if (run >= 40) { run = 0; const q = this.stablePets.find((s) => s.id === m.id); if (q) { this.pet(q, 'stroke', p.worldX - this.content.x, p.worldY - this.content.y); } }
      });
      this.content.add(z);
      this.rects[`stall:${m.id}`] = { x, y, w: sw, h: sh };
    });
    for (let i = list.length; i < cols * rows; i++) this.barnCorner(a.x + 12 + (i % cols) * (sw + gap), top + Math.floor(i / cols) * (sh + gap), sw, sh);
  }

  /** Hay bales and a water trough for the spare corner of the barn. */
  private barnCorner(x: number, y: number, w: number, h: number) {
    const g = this.add.graphics();
    const by = y + h - 8;
    const bale = (bx: number, bb: number, bw: number, bh: number) => {
      g.fillStyle(0xd9ae52, 1); g.fillRoundedRect(bx, bb - bh, bw, bh, 8);
      g.lineStyle(2, 0xb08838, 1); for (let k = 1; k < 4; k++) g.lineBetween(bx + 6, bb - bh + (bh * k) / 4, bx + bw - 6, bb - bh + (bh * k) / 4);
      g.lineStyle(4, 0x8a5434, 1); g.lineBetween(bx + bw * 0.3, bb - bh, bx + bw * 0.3, bb); g.lineBetween(bx + bw * 0.7, bb - bh, bx + bw * 0.7, bb);
    };
    bale(x + 4, by, w * 0.55, h * 0.26); bale(x + w * 0.45, by, w * 0.52, h * 0.26); bale(x + w * 0.2, by - h * 0.26, w * 0.55, h * 0.24);
    // Trough.
    const tx = x + 8, ty = by - h * 0.62, tw = w - 16;
    g.fillStyle(0x6a3a22, 1); g.fillRoundedRect(tx, ty, tw, 30, 6);
    g.fillStyle(0x7fc4e0, 1); g.fillRoundedRect(tx + 5, ty + 4, tw - 10, 10, 4);
    g.fillStyle(0xffffff, 0.6); g.fillRect(tx + 14, ty + 6, 20, 3);
    g.fillStyle(0x4a2a16, 1); g.fillRect(tx + 8, ty + 30, 8, 16); g.fillRect(tx + tw - 16, ty + 30, 8, 16);
    this.content.add(g);
  }

  private tickStable(time: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    for (const p of this.stablePets) {
      if (!p.on || !p.c.active) continue;
      const m = p.m, SC = m.scale;
      p.flap += dt * Math.PI * 2 * 0.7 * (m.flapRate ?? 1);
      const ws = SC / (frameScale[m.wing] ?? S);
      if (m.style === 'prop') {
        p.wing.setScale(ws * 0.6, ws * (0.15 + 0.85 * Math.abs(Math.cos(time / 40))));
      } else {
        const lift = Math.cos(p.flap);
        const sy = ws * (lift >= 0 ? 0.35 + 0.65 * lift : 0.35 + 0.95 * lift);
        const sweep = 0.32 + 0.08 * Math.sin(p.flap);
        p.wing.setScale(ws, sy).setRotation(-sweep);
        p.wingFar.setScale(ws * 0.9, sy * 0.88).setRotation(-sweep * 1.15);
      }
      p.body.y = Math.sin(time / 600 + p.ph) * 2.5 / p.k;
      // Idle life: now and then a friend looks around, hops, wiggles or dozes.
      if (p.idleAt === undefined) p.idleAt = time + 1200 + Math.random() * 3000;
      if (time >= p.idleAt) { p.idleAt = time + 3500 + Math.random() * 4500; if (!this.tweens.isTweening(p.c)) this.idle(p); }
    }
  }

  private idle(p: { c: Phaser.GameObjects.Container; m: MountDef }) {
    const y0 = p.c.getData('y0') as number, k0 = p.c.getData('k0') as number;
    const kinds = ['look', 'hop', 'wiggle', 'doze'] as const;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    this.idleCount++; this.lastIdle = `${p.m.id}:${kind}`;
    if (kind === 'look') this.tweens.add({ targets: p.c, scaleX: -k0, duration: 160, yoyo: true, hold: 900, onComplete: () => p.c.setScale(k0) });
    else if (kind === 'hop') this.tweens.add({ targets: p.c, y: y0 - 10, duration: 140, yoyo: true, repeat: 1, ease: 'Quad.easeOut', onComplete: () => { p.c.y = y0; } });
    else if (kind === 'wiggle') this.tweens.add({ targets: p.c, rotation: { from: -0.1, to: 0.1 }, duration: 120, yoyo: true, repeat: 2, onComplete: () => { p.c.rotation = 0; } });
    else {
      this.tweens.add({ targets: p.c, scaleY: k0 * 0.93, duration: 500, yoyo: true, hold: 900, onComplete: () => p.c.setScale(k0) });
      for (let i = 0; i < 3; i++) {
        const z = this.text(p.c.x + 20 + i * 8, y0 - 24, 'z', 16 + i * 4, '#fff3d6', 900).setOrigin(0.5).setStroke('#4a2a16', 4).setAlpha(0);
        this.content.add(z);
        this.tweens.add({ targets: z, alpha: { from: 1, to: 0 }, y: z.y - 34, x: z.x + 12, duration: 1100, delay: i * 300, onComplete: () => z.destroy() });
      }
    }
  }

  update(time: number, delta = 16) {
    if (!this.open) return;
    if (this.tankFx) this.tickTank(time, delta);
    if (this.stablePets.length) this.tickStable(time, delta);
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
      // A red "you are here" pin that bobs over a pulsing ring.
      const bob = Math.abs(Math.sin(time / 300)) * 6;
      g.lineStyle(2.5, 0xe85d3a, 0.55); g.strokeEllipse(px, py, 26 + Math.sin(time / 200) * 6, 11 + Math.sin(time / 200) * 2.5);
      g.fillStyle(0x2a1a0e, 0.3); g.fillEllipse(px + 2, py + 1, 14 - bob * 0.6, 6 - bob * 0.2);
      g.fillStyle(0xb8402a, 1); g.fillTriangle(px - 6, py - 14 - bob, px + 6, py - 14 - bob, px, py - bob);
      g.fillStyle(0xe85d3a, 1); g.fillCircle(px, py - 20 - bob, 10);
      g.lineStyle(2.5, 0xffffff, 1); g.strokeCircle(px, py - 20 - bob, 10);
      g.fillStyle(0xffffff, 0.8); g.fillCircle(px - 3, py - 23 - bob, 3);
    }
  }
}
