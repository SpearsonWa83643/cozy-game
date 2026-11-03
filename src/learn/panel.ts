// 66: the spelling board for young kids. A big picture (a cat, the sun...) and three empty letter
// slots; six huge letter tiles below. Tap a tile, or drag it up, to fill the next slot. A wrong
// letter just wiggles home and the right one starts to bounce and glow (its ghost shows in the slot).
// No typing, no voice, no fail state. Three words fill three stars; then a chest appears in the world.
import Phaser from 'phaser';
import { atlasOf } from '../art';
import { sfx } from '../audio';
import { save } from '../save';
import { BONUS_WORDS } from './sites';
import type { VillageUIScene as VillageUI } from '../scenes/VillageUI';

const INK = '#3d2c20';
const TILE_COLORS: [number, number][] = [[0xffb3c1, 0xd9707f], [0xffe08a, 0xd0a23a], [0xa8e6a3, 0x5fa75a], [0x9fd8ff, 0x4f93c4], [0xd9b8ff, 0x9372c8], [0xffc89a, 0xd08550]];
const DISTRACT = 'ABDEFGHIKLMNOPRSTUW';

type Tile = { c: Phaser.GameObjects.Container; letter: string; hx: number; hy: number; used: boolean; glow: Phaser.GameObjects.Graphics; i: number };
type Slot = { x: number; y: number; w: number; h: number; ghost: Phaser.GameObjects.Text };

const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class LearnPanel {
  open = false;
  id = '';
  free = false;
  words: string[] = [];
  wi = 0;
  li = 0;
  wrong = 0;
  busy = false;
  root?: Phaser.GameObjects.Container;
  tiles: Tile[] = [];
  slots: Slot[] = [];
  stars: Phaser.GameObjects.Graphics[] = [];
  pic?: Phaser.GameObjects.Image;
  picBox = { x: 0, y: 0, s: 0 };
  hintText?: Phaser.GameObjects.Text;
  idle?: Phaser.Time.TimerEvent;
  k = 1;
  /** Bumped on every show/close so stale timers from an earlier board do nothing. */
  gen = 0;
  shows = 0;
  closes = 0;

  constructor(private ui: VillageUI) {
    (window as any).__cozyLearn = () => this.state();
  }

  state() {
    return {
      open: this.open, ready: this.open && !this.busy, shows: this.shows, closes: this.closes, id: this.id, free: this.free, words: this.words, word: this.words[this.wi] ?? '', wordIndex: this.wi, letter: this.li, wrong: this.wrong,
      tiles: this.tiles.map((t) => ({ letter: t.letter, used: t.used, x: t.c.x, y: t.c.y, hint: t.glow.alpha > 0.05 })),
      ghost: this.slots.map((s) => s.ghost.alpha > 0.05),
      rects: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(this.ui.rects).filter(([k]) => k.startsWith('learn:'))))),
    };
  }

  show(id: string) {
    const learn = this.ui.world.learn;
    const def = learn.def(id);
    if (!def) return;
    this.id = id;
    this.free = !!save.puzzles[id];
    this.words = this.free ? shuffle(BONUS_WORDS).slice(0, 3) : def.words;
    this.wi = this.free ? 0 : Math.min(learn.progress(id), def.words.length - 1);
    this.open = true; this.gen++; this.shows++;
    this.ui.registry.set('vcard', true);
    sfx.blip();
    this.build(true);
  }

  close() {
    if (!this.root) return;
    const r = this.root; this.root = undefined;
    this.open = false; this.gen++; this.closes++;
    this.idle?.remove(); this.idle = undefined;
    for (const k of Object.keys(this.ui.rects)) if (k.startsWith('learn:')) delete this.ui.rects[k];
    r.each((o: any) => o.disableInteractive?.());
    this.ui.tweens.add({ targets: r, alpha: 0, duration: 160, onComplete: () => r.destroy() });
    this.ui.time.delayedCall(60, () => { if (!this.open && !(this.ui as any).card && !(this.ui as any).numPanel?.open) this.ui.registry.set('vcard', false); });
  }

  /** Lay out the board for the current word. */
  private build(fade = false) {
    const ui = this.ui;
    this.root?.destroy();
    for (const k of Object.keys(ui.rects)) if (k.startsWith('learn:')) delete ui.rects[k];
    this.tiles = []; this.slots = []; this.stars = [];
    this.li = 0; this.wrong = 0; this.busy = false;
    const word = this.words[this.wi].toUpperCase();
    const tall = ui.h > ui.w * 1.1;
    const BW = tall ? 520 : 860, BH = tall ? 860 : 600;
    const k = this.k = Math.min(1.15, (ui.w - 20) / BW, (ui.h - 20) / BH);
    const s = (n: number) => Math.round(n * k);
    const W = s(BW), H = s(BH);
    const x0 = (ui.w - W) / 2, y0 = (ui.h - H) / 2;
    const c = ui.add.container(0, 0).setDepth(40);
    this.root = c;
    // A dim backdrop that swallows taps (it does not close the board: little hands miss a lot).
    const dim = ui.add.rectangle(0, 0, ui.w, ui.h, 0x1d1510, 0.45).setOrigin(0, 0).setInteractive();
    const g = ui.add.graphics();
    g.fillStyle(0x2a1d14, 0.3); g.fillRoundedRect(x0 + 4, y0 + 9, W, H, s(34));
    g.fillStyle(0xc98b5a, 1); g.fillRoundedRect(x0, y0, W, H, s(34));
    g.fillStyle(0xfbf1dc, 0.99); g.fillRoundedRect(x0 + s(14), y0 + s(14), W - s(28), H - s(28), s(26));
    g.lineStyle(3, 0x8a5a3c, 1); g.strokeRoundedRect(x0 + 1.5, y0 + 1.5, W - 3, H - 3, s(34));
    c.add([dim, g]);
    // Three progress stars along the top.
    for (let i = 0; i < 3; i++) {
      const st = ui.add.graphics();
      st.setPosition(x0 + W / 2 + (i - 1) * s(62), y0 + s(54));
      this.drawStar(st, s(24), i < this.wi);
      c.add(st); this.stars.push(st);
    }
    // Big round close button (top right).
    const cr = s(36), cx = x0 + W - s(24) - cr, cy = y0 + s(24) + cr;
    const cb = ui.add.graphics();
    cb.fillStyle(0xf0e2c6, 1); cb.fillCircle(cx, cy, cr); cb.lineStyle(4, 0xd9b98f, 1); cb.strokeCircle(cx, cy, cr - 2);
    cb.lineStyle(Math.max(5, s(8)), 0x8a5a3c, 1); cb.beginPath();
    cb.moveTo(cx - cr * 0.36, cy - cr * 0.36); cb.lineTo(cx + cr * 0.36, cy + cr * 0.36); cb.moveTo(cx + cr * 0.36, cy - cr * 0.36); cb.lineTo(cx - cr * 0.36, cy + cr * 0.36); cb.strokePath();
    const cz = ui.add.zone(cx, cy, cr * 2, cr * 2).setInteractive();
    cz.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 30) { sfx.blip(); this.close(); } });
    ui.rects['learn:close'] = { x: cx - cr, y: cy - cr, w: cr * 2, h: cr * 2 };
    c.add([cb, cz]);

    // Picture card + slots.
    const P = s(tall ? 230 : 236), SW = s(tall ? 132 : 140), SH = s(tall ? 150 : 160), SG = s(tall ? 16 : 22);
    let px: number, py: number, sx0: number, sy: number;
    if (tall) {
      px = x0 + (W - P) / 2; py = y0 + s(100);
      sx0 = x0 + (W - (3 * SW + 2 * SG)) / 2; sy = py + P + s(26);
    } else {
      const rowW = P + s(56) + 3 * SW + 2 * SG;
      px = x0 + (W - rowW) / 2; py = y0 + s(104);
      sx0 = px + P + s(56); sy = py + (P - SH) / 2;
    }
    g.fillStyle(0x2a1d14, 0.15); g.fillRoundedRect(px + 2, py + 6, P, P, s(26));
    g.fillStyle(0xffffff, 1); g.fillRoundedRect(px, py, P, P, s(26));
    g.lineStyle(4, 0xe6cfa6, 1); g.strokeRoundedRect(px + 2, py + 2, P - 4, P - 4, s(24));
    const key = `lw_${this.words[this.wi]}`;
    const pic = ui.add.image(px + P / 2, py + P / 2, key).setDisplaySize(P * 0.86, P * 0.86);
    this.pic = pic; this.picBox = { x: px + P / 2, y: py + P / 2, s: P * 0.86 };
    ui.tweens.add({ targets: pic, angle: { from: -3, to: 3 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    c.add(pic);
    ui.rects['learn:picture'] = { x: px, y: py, w: P, h: P };
    for (let i = 0; i < word.length; i++) {
      const x = sx0 + i * (SW + SG);
      g.fillStyle(0xfff8ea, 1); g.fillRoundedRect(x, sy, SW, SH, s(22));
      g.lineStyle(4, 0xd9b98f, 1); g.strokeRoundedRect(x + 2, sy + 2, SW - 4, SH - 4, s(20));
      g.fillStyle(0xd9b98f, 1); g.fillRoundedRect(x + SW * 0.18, sy + SH - s(30), SW * 0.64, s(8), s(4));
      const ghost = ui.text(x + SW / 2, sy + SH / 2 - s(6), word[i], Math.max(40, s(96)), '#c9a77f', 900).setOrigin(0.5).setAlpha(0);
      c.add(ghost);
      this.slots.push({ x: x + SW / 2, y: sy + SH / 2 - s(6), w: SW, h: SH, ghost });
      ui.rects[`learn:slot:${i}`] = { x, y: sy, w: SW, h: SH };
    }
    // A tiny line for grown-ups reading along; the bouncing tile is the real hint.
    const hy = tall ? sy + SH + s(34) : py + P + s(36);
    this.hintText = ui.text(x0 + W / 2, hy, this.free ? 'Just for fun: spell the picture!' : 'Spell the picture!', Math.max(16, s(24)), '#8a6a50', 900).setOrigin(0.5);
    c.add(this.hintText);

    // Letter tiles: the word's letters plus three others, shuffled.
    const pool = DISTRACT.split('').filter((l) => !word.includes(l));
    const extra = shuffle(pool).slice(0, 6 - word.length);
    const letters = shuffle([...word.split(''), ...extra]);
    const T = s(tall ? 132 : 122), TG = s(tall ? 22 : 16);
    const cols = tall ? 3 : 6;
    const rowsY = tall ? [hy + s(40), hy + s(40) + T + TG] : [hy + s(38)];
    const tx0 = x0 + (W - (cols * T + (cols - 1) * TG)) / 2;
    const colors = shuffle(TILE_COLORS);
    letters.forEach((l, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const hx = tx0 + col * (T + TG) + T / 2, hyy = rowsY[row] + T / 2;
      const glow = ui.add.graphics();
      glow.fillStyle(0xfff0a0, 0.9); glow.fillRoundedRect(-T / 2 - s(12), -T / 2 - s(12), T + s(24), T + s(24), s(32));
      glow.setAlpha(0);
      const tg = ui.add.graphics();
      const [fill, edge] = colors[i % colors.length];
      tg.fillStyle(0x2a1d14, 0.22); tg.fillRoundedRect(-T / 2 + 2, -T / 2 + 7, T, T, s(24));
      tg.fillStyle(fill, 1); tg.fillRoundedRect(-T / 2, -T / 2, T, T, s(24));
      tg.fillStyle(0xffffff, 0.35); tg.fillRoundedRect(-T / 2 + s(10), -T / 2 + s(8), T - s(20), s(18), s(9));
      tg.lineStyle(4, edge, 1); tg.strokeRoundedRect(-T / 2 + 2, -T / 2 + 2, T - 4, T - 4, s(22));
      const tx = ui.text(0, -s(2), l, Math.max(40, s(88)), INK, 900).setOrigin(0.5);
      const tc = ui.add.container(hx, hyy, [glow, tg, tx]);
      tc.setSize(T + s(10), T + s(10)).setInteractive({ draggable: true });
      const tile: Tile = { c: tc, letter: l, hx, hy: hyy, used: false, glow, i };
      this.tiles.push(tile);
      c.add(tc);
      ui.rects[`learn:tile:${i}`] = { x: hx - T / 2, y: hyy - T / 2, w: T, h: T };
      tc.on('dragstart', () => { if (tile.used || this.busy) return; c.bringToTop(tc); ui.tweens.add({ targets: tc, scale: 1.1, duration: 90 }); });
      tc.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => { if (tile.used || this.busy) return; tc.setPosition(dx, dy); });
      tc.on('dragend', () => {
        if (tile.used) return;
        if (this.busy) { this.home(tile); return; }
        const moved = Math.hypot(tc.x - hx, tc.y - hyy);
        const sl = this.slots[this.li];
        const near = sl && this.slots.some((q) => Math.abs(tc.x - q.x) < q.w * 0.75 && Math.abs(tc.y - q.y) < q.h * 0.75);
        if (moved < s(26) || near) this.attempt(tile);
        else this.home(tile);
      });
    });
    c.setAlpha(fade ? 0 : 1);
    if (fade) ui.tweens.add({ targets: c, alpha: 1, duration: 180 });
    this.armIdle();
  }

  private drawStar(g: Phaser.GameObjects.Graphics, r: number, on: boolean) {
    g.clear();
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.48 : r; pts.push(new Phaser.Math.Vector2(Math.cos(a) * rr, Math.sin(a) * rr)); }
    g.fillStyle(on ? 0xffd84d : 0xeadcc2, 1); g.fillPoints(pts, true);
    g.lineStyle(3, on ? 0xd0a23a : 0xd9c6a4, 1); g.strokePoints(pts, true);
  }

  private home(t: Tile) {
    this.ui.tweens.add({ targets: t.c, x: t.hx, y: t.hy, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  /** No tap for a while? Nudge the right tile. */
  private armIdle() {
    this.idle?.remove();
    this.idle = this.ui.time.delayedCall(9000, () => { if (this.open && !this.busy) this.hint(false); });
  }

  private attempt(t: Tile) {
    if (this.busy || t.used || !this.open) return;
    const word = this.words[this.wi].toUpperCase();
    const need = word[this.li];
    const ui = this.ui;
    if (t.letter === need) {
      t.used = true;
      t.c.disableInteractive();
      delete ui.rects[`learn:tile:${t.i}`];
      const sl = this.slots[this.li];
      ui.tweens.killTweensOf(t.c);
      t.glow.setAlpha(0);
      ui.tweens.killTweensOf(sl.ghost);
      sl.ghost.setAlpha(0);
      const sc = Math.min(1, (sl.w - 14 * this.k) / t.c.width);
      ui.tweens.add({ targets: t.c, x: sl.x, y: sl.y + 6 * this.k, scale: sc, angle: 0, duration: 280, ease: 'Back.easeOut' });
      this.sparkle(sl.x, sl.y, 6);
      sfx.bellNote(Math.min(3, this.li));
      for (const o of this.tiles) if (!o.used) { ui.tweens.killTweensOf(o.glow); o.glow.setAlpha(0); ui.tweens.killTweensOf(o.c); o.c.setPosition(o.hx, o.hy).setScale(1).setAngle(0); }
      this.li++;
      if (this.li >= word.length) this.wordDone();
      else this.armIdle();
      return;
    }
    // A gentle "not that one": wiggle, slide home, then show which one to try.
    this.wrong++;
    sfx.tock();
    ui.tweens.killTweensOf(t.c);
    ui.tweens.add({ targets: t.c, x: t.hx, y: t.hy, scale: 1, duration: 220, ease: 'Sine.easeOut' });
    ui.tweens.add({ targets: t.c, angle: { from: -12, to: 12 }, duration: 80, yoyo: true, repeat: 2, onComplete: () => t.c.setAngle(0) });
    this.hint(true);
  }

  /** Light up the next right tile and show its ghost letter in the slot. */
  private hint(wrong: boolean) {
    const word = this.words[this.wi].toUpperCase();
    const need = word[this.li];
    const t = this.tiles.find((o) => !o.used && o.letter === need);
    if (!t) return;
    const ui = this.ui;
    if (this.hintText) this.hintText.setText(wrong ? 'Almost! Try the bouncy one.' : 'Try the bouncy one!');
    const sl = this.slots[this.li];
    ui.tweens.killTweensOf(sl.ghost);
    sl.ghost.setAlpha(0.35);
    ui.tweens.add({ targets: sl.ghost, alpha: { from: 0.2, to: 0.55 }, duration: 700, yoyo: true, repeat: -1 });
    ui.tweens.killTweensOf(t.glow);
    t.glow.setAlpha(0.9);
    ui.tweens.add({ targets: t.glow, alpha: { from: 0.95, to: 0.4 }, duration: 520, yoyo: true, repeat: -1 });
    ui.time.delayedCall(wrong ? 700 : 0, () => {
      if (t.used || !this.open) return;
      ui.tweens.add({ targets: t.c, y: t.hy - 16 * this.k, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  private sparkle(x: number, y: number, n: number) {
    const ui = this.ui;
    if (!this.root) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = ui.add.image(x, y, atlasOf('spark'), 'spark').setScale(0.5 * this.k).setTint([0xffd84d, 0xff9ab8, 0x9fd8ff, 0xa8e6a3][i % 4]);
      this.root.add(sp);
      const d = (70 + Math.random() * 60) * this.k;
      ui.tweens.add({ targets: sp, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.1, duration: 700 + Math.random() * 300, ease: 'Cubic.easeOut', onComplete: () => sp.destroy() });
    }
  }

  private wordDone() {
    const ui = this.ui;
    this.busy = true;
    this.idle?.remove();
    sfx.chimes();
    const st = this.stars[this.wi];
    if (st) { this.drawStar(st, Math.round(24 * this.k), true); ui.tweens.add({ targets: st, scale: { from: 1.8, to: 1 }, angle: { from: -40, to: 0 }, duration: 520, ease: 'Back.easeOut' }); this.sparkle(st.x, st.y, 8); }
    if (this.pic) ui.tweens.add({ targets: this.pic, scale: this.pic.scale * 1.15, duration: 240, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    this.sparkle(this.picBox.x, this.picBox.y, 14);
    for (const t of this.tiles) if (t.used) ui.tweens.add({ targets: t.c, y: t.c.y - 20 * this.k, duration: 180, yoyo: true, delay: this.slots.findIndex((q) => Math.abs(q.x - t.c.x) < 2) * 120 });
    this.hintText?.setText(['Yay!', 'Super!', 'Hooray!'][this.wi % 3]).setFontSize(Math.max(22, Math.round(36 * this.k))).setColor('#e8604c');
    this.wi++;
    if (!this.free) ui.world.learn.setProgress(this.id, Math.min(this.wi, this.words.length));
    const gen = this.gen;
    ui.time.delayedCall(1500, () => {
      if (!this.open || gen !== this.gen) return;
      if (this.wi < this.words.length) { this.build(); return; }
      this.finish();
    });
  }

  private finish() {
    const ui = this.ui;
    sfx.solve();
    if (this.root) {
      const big = ui.add.graphics().setPosition(ui.w / 2, ui.h / 2);
      this.drawStar(big, Math.round(110 * this.k), true);
      const t = ui.text(ui.w / 2, ui.h / 2 + 150 * this.k, 'You did it!', Math.max(30, Math.round(54 * this.k)), '#fffaf0', 900).setOrigin(0.5).setStroke('#8a5a3c', 8);
      this.root.add([big, t]);
      ui.tweens.add({ targets: big, scale: { from: 0, to: 1 }, angle: { from: -90, to: 0 }, duration: 600, ease: 'Back.easeOut' });
      this.sparkle(ui.w / 2, ui.h / 2, 20);
    }
    const id = this.id, free = this.free, gen = this.gen;
    ui.time.delayedCall(1800, () => {
      if (gen === this.gen) this.close();
      if (free) ui.game.events.emit('toast', 'Wonderful spelling!');
      else ui.world.learn.solve(id);
    });
  }
}
