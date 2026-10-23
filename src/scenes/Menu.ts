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

const INK = '#3d2c20';
const FONT = 'Nunito';
export type Tab = 'map' | 'wardrobe' | 'treasures' | 'fish';
const TABS: [Tab, string][] = [['map', 'Map'], ['wardrobe', 'Wardrobe'], ['treasures', 'Treasures'], ['fish', 'Fish']];

export class MenuScene extends Phaser.Scene {
  root!: Phaser.GameObjects.Container;
  content!: Phaser.GameObjects.Container;
  tab: Tab = 'map';
  open = false;
  w = 0; h = 0;
  box = { x: 0, y: 0, w: 0, h: 0 };
  heroDir = 0;
  heroImg: Phaser.GameObjects.Image | null = null;
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
    this.heroImg = null; this.playerDot = null; this.hintText = null;
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
  renderWardrobe(a: { x: number; y: number; w: number; h: number }) {
    const looks = COSMETICS.map((c) => {
      const l: Look = { ...save.look };
      if (c.slot === 'feather' || c.slot === 'shells') (l as any)[c.slot] = true;
      else (l as any)[c.slot] = c.value;
      return { id: c.id, look: l };
    });
    buildPreviewSheet(this, 'previews', looks, 2);
    const narrow = a.w < 860;
    const pw = narrow ? 170 : 260;
    // Character preview.
    const pg = this.add.graphics();
    pg.fillStyle(0xf3e6cc, 1); pg.fillRoundedRect(a.x, a.y, pw, a.h - 30, 20);
    pg.lineStyle(2.5, 0xd9b98f, 1); pg.strokeRoundedRect(a.x, a.y, pw, a.h - 30, 20);
    pg.fillStyle(0x2a1d14, 0.12); pg.fillEllipse(a.x + pw / 2, a.y + (a.h - 30) * 0.72, pw * 0.42, 22);
    this.content.add(pg);
    const key = this.world.heroKey;
    const sc = (narrow ? 2.0 : 3.0) / S;
    this.heroImg = this.add.image(a.x + pw / 2, a.y + (a.h - 30) * 0.72, key, `${this.heroDir}_0`).setOrigin(0.5, 1).setScale(sc);
    this.content.add(this.heroImg);
    const turn = this.add.zone(a.x, a.y, pw, a.h - 30).setOrigin(0, 0).setInteractive();
    turn.on('pointerup', () => { this.heroDir = (this.heroDir + 1) % 5; this.heroImg?.setFrame(`${this.heroDir}_0`); sfx.blip(); });
    this.content.add([turn, this.text(a.x + pw / 2, a.y + a.h - 50, 'tap to turn', 14, '#8a6a50', 700).setOrigin(0.5)]);
    // Tiles by slot.
    const rows: [string, Cosmetic[]][] = [
      ['Hats', COSMETICS.filter((c) => c.slot === 'hat')],
      ['Scarves', COSMETICS.filter((c) => c.slot === 'scarf')],
      ['Outfits', COSMETICS.filter((c) => c.slot === 'outfit')],
      ['Back & extras', COSMETICS.filter((c) => c.slot === 'back' || c.slot === 'feather' || c.slot === 'shells')],
    ];
    const gx = a.x + pw + 22, gw = a.w - pw - 22;
    const maxCols = Math.max(...rows.map((r) => r[1].length));
    const tile = Math.max(64, Math.min(104, (gw - 8 * (maxCols - 1)) / maxCols, (a.h - 30 - rows.length * 26) / rows.length - 10));
    let y = a.y;
    for (const [name, list] of rows) {
      this.content.add(this.text(gx, y, name, 16, '#8a6a50', 800));
      y += 22;
      list.forEach((c, i) => this.cosTile(gx + i * (tile + 8), y, tile, c));
      y += tile + 12;
    }
  }

  private cosTile(x: number, y: number, size: number, c: Cosmetic) {
    const unlocked = isUnlocked(c);
    const on = unlocked && isEquipped(c, save.look);
    const [bg, z] = this.btn(x, y, size, size, () => {
      if (!unlocked) { sfx.tock(); this.hint(`Locked \u2014 ${c.hint}`); return; }
      equip(c, save.look);
      persist();
      sfx.pickup();
      this.world.refreshHero();
      this.game.events.emit('equipped', c.id);
      this.render();
    }, on ? 0xfff4d6 : unlocked ? 0xf7ead0 : 0xe6dccb, on ? 0xf2a93b : 0xd9b98f, 16);
    this.content.add([bg, z]);
    this.rects[c.id] = this.lastRect;
    const img = this.add.image(x + size / 2, y + size - 18, 'previews', c.id).setOrigin(0.5, 1);
    img.setScale(Math.min((size - 14) / (HERO_W * 2), (size - 24) / (HERO_H * 2)) * 1.25);
    if (!unlocked) img.setTint(0x5a4a3c).setAlpha(0.35);
    this.content.add(img);
    this.content.add(this.text(x + size / 2, y + size - 4, unlocked ? c.name : '???', size < 86 ? 11 : 12, unlocked ? INK : '#9a8a78', 800).setOrigin(0.5, 1));
    if (on) {
      const g = this.add.graphics();
      g.fillStyle(0xf2a93b, 1); g.fillCircle(x + size - 12, y + 12, 10);
      this.content.add([g, this.text(x + size - 12, y + 12, '\u2713', 13, '#fffaf0', 900).setOrigin(0.5)]);
    }
    if (!unlocked) {
      const g = this.add.graphics();
      const lx = x + size / 2, ly = y + size / 2 - 8;
      g.lineStyle(3.5, 0x8a6a50, 0.9); g.beginPath(); g.arc(lx, ly - 4, 7, Math.PI, 0); g.strokePath();
      g.fillStyle(0x8a6a50, 0.9); g.fillRoundedRect(lx - 11, ly - 4, 22, 17, 4);
      g.fillStyle(0xf3e6cc, 1); g.fillCircle(lx, ly + 3, 2.6);
      this.content.add(g);
    }
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

  update(time: number) {
    if (!this.open) return;
    if (this.heroImg) this.heroImg.setScale(this.heroImg.scaleX, this.heroImg.scaleX * (1 + Math.sin(time / 420) * 0.018));
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
