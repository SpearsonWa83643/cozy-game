// 67: the counting board for young kids. A big card of things to count (red apples in the grove,
// round stones in the hills) shows a sum like 2 + 3 or 5 - 1; for "take away" the extra ones float
// off and fade. Four huge number buttons below: tap the answer. Tap any apple to count it (a little
// number pops up). A wrong tap just wiggles; then everything counts itself out loud-free, one bounce
// at a time, and the right number starts to glow. No typing, no voice, no fail state. Three sums
// fill three stars; then a chest appears beside the board in the world.
import Phaser from 'phaser';
import { atlasOf } from '../art';
import { sfx } from '../audio';
import { save } from '../save';
import { COUNT_THING, FREE_THINGS, THING_NAMES, type CountThing } from './sites';
import type { VillageUIScene as VillageUI } from '../scenes/VillageUI';

const INK = '#3d2c20';
const BTN_COLORS: [number, number][] = [[0xffb3c1, 0xd9707f], [0xffe08a, 0xd0a23a], [0xa8e6a3, 0x5fa75a], [0x9fd8ff, 0x4f93c4], [0xd9b8ff, 0x9372c8], [0xffc89a, 0xd08550]];

type Prob = { a: number; b: number; op: '+' | '-'; ans: number };
type Choice = { c: Phaser.GameObjects.Container; n: number; hx: number; hy: number; glow: Phaser.GameObjects.Graphics; i: number; dim: boolean };
type Item = { img: Phaser.GameObjects.Image; x: number; y: number; leaving: boolean; base: number };

const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const parseProb = (p: string): Prob => {
  const m = /^(\d)([+-])(\d)$/.exec(p);
  if (!m) return { a: 1, b: 1, op: '+', ans: 2 };
  const a = +m[1], b = +m[3], op = m[2] as '+' | '-';
  return { a, b, op, ans: op === '+' ? a + b : a - b };
};
/** Three fresh little sums for free play (answers 1-9, never more than 8 things to count). */
const randomProbs = () => Array.from({ length: 3 }, () => {
  if (Math.random() < 0.5) { const a = 1 + Math.floor(Math.random() * 5), b = 1 + Math.floor(Math.random() * Math.min(4, 8 - a)); return `${a}+${b}`; }
  const a = 2 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * (a - 1)); return `${a}-${b}`;
});

export class NumberPanel {
  open = false;
  id = '';
  free = false;
  probs: string[] = [];
  /** 76: what each round counts (free play picks a surprise thing per round). */
  things: CountThing[] = [];
  pi = 0;
  wrong = 0;
  busy = false;
  gen = 0;
  shows = 0;
  closes = 0;
  hints = 0;
  lastCount = 0;
  root?: Phaser.GameObjects.Container;
  choices: Choice[] = [];
  items: Item[] = [];
  stars: Phaser.GameObjects.Graphics[] = [];
  ansText?: Phaser.GameObjects.Text;
  hintText?: Phaser.GameObjects.Text;
  idle?: Phaser.Time.TimerEvent;
  k = 1;

  constructor(private ui: VillageUI) {
    (window as any).__cozyNum = () => this.state();
    // 76 (tests/photos): count a chosen thing on the open board.
    (window as any).__cozyNumThing = (t: CountThing, p?: string) => { if (!this.open) return false; this.things = [t]; this.probs = [p ?? this.probs[this.pi]]; this.pi = 0; this.build(); return true; };
  }

  get prob() { return parseProb(this.probs[this.pi] ?? '1+1'); }

  state() {
    return {
      open: this.open, ready: this.open && !this.busy, shows: this.shows, closes: this.closes, id: this.id, free: this.free,
      probs: this.probs, things: [...this.things], thing: this.things[this.pi] ?? '', prob: this.probs[this.pi] ?? '', index: this.pi, wrong: this.wrong, answer: this.prob.ans, hints: this.hints, lastCount: this.lastCount,
      choices: this.choices.map((c) => ({ n: c.n, hint: c.glow.alpha > 0.05, dim: c.dim })),
      items: this.items.length, leaving: this.items.filter((i) => i.leaving).length,
      rects: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(this.ui.rects).filter(([k]) => k.startsWith('learn:'))))),
    };
  }

  show(id: string) {
    const learn = this.ui.world.learn;
    const def = learn.def(id);
    if (!def) return;
    this.id = id;
    this.free = !!save.puzzles[id];
    this.probs = this.free ? randomProbs() : def.words;
    const home = COUNT_THING[id] ?? 'apple';
    this.things = this.free ? shuffle(FREE_THINGS).slice(0, this.probs.length) : this.probs.map(() => home);
    this.pi = this.free ? 0 : Math.min(learn.progress(id), def.words.length - 1);
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
    this.ui.time.delayedCall(60, () => { if (!this.open && !(this.ui as any).card && !(this.ui as any).learnPanel?.open) this.ui.registry.set('vcard', false); });
  }

  private build(fade = false) {
    const ui = this.ui;
    this.root?.destroy();
    for (const k of Object.keys(ui.rects)) if (k.startsWith('learn:')) delete ui.rects[k];
    this.choices = []; this.items = []; this.stars = [];
    this.wrong = 0; this.busy = false; this.lastCount = 0;
    const P = this.prob;
    const tall = ui.h > ui.w * 1.1;
    const BW = tall ? 520 : 860, BH = tall ? 860 : 600;
    const k = this.k = Math.min(1.15, (ui.w - 20) / BW, (ui.h - 20) / BH);
    const s = (n: number) => Math.round(n * k);
    const W = s(BW), H = s(BH);
    const x0 = (ui.w - W) / 2, y0 = (ui.h - H) / 2;
    const c = ui.add.container(0, 0).setDepth(40);
    this.root = c;
    // Dim backdrop swallows taps but never closes the board (little hands miss a lot).
    const dim = ui.add.rectangle(0, 0, ui.w, ui.h, 0x1d1510, 0.45).setOrigin(0, 0).setInteractive();
    const g = ui.add.graphics();
    g.fillStyle(0x2a1d14, 0.3); g.fillRoundedRect(x0 + 4, y0 + 9, W, H, s(34));
    g.fillStyle(0xc98b5a, 1); g.fillRoundedRect(x0, y0, W, H, s(34));
    g.fillStyle(0xfbf1dc, 0.99); g.fillRoundedRect(x0 + s(14), y0 + s(14), W - s(28), H - s(28), s(26));
    g.lineStyle(3, 0x8a5a3c, 1); g.strokeRoundedRect(x0 + 1.5, y0 + 1.5, W - 3, H - 3, s(34));
    c.add([dim, g]);
    for (let i = 0; i < 3; i++) {
      const st = ui.add.graphics();
      st.setPosition(x0 + W / 2 + (i - 1) * s(62), y0 + s(54));
      this.drawStar(st, s(24), i < this.pi);
      c.add(st); this.stars.push(st);
    }
    const cr = s(36), cx = x0 + W - s(24) - cr, cy = y0 + s(24) + cr;
    const cb = ui.add.graphics();
    cb.fillStyle(0xf0e2c6, 1); cb.fillCircle(cx, cy, cr); cb.lineStyle(4, 0xd9b98f, 1); cb.strokeCircle(cx, cy, cr - 2);
    cb.lineStyle(Math.max(5, s(8)), 0x8a5a3c, 1); cb.beginPath();
    cb.moveTo(cx - cr * 0.36, cy - cr * 0.36); cb.lineTo(cx + cr * 0.36, cy + cr * 0.36); cb.moveTo(cx + cr * 0.36, cy - cr * 0.36); cb.lineTo(cx - cr * 0.36, cy + cr * 0.36); cb.strokePath();
    const cz = ui.add.zone(cx, cy, cr * 2, cr * 2).setInteractive();
    cz.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 30) { sfx.blip(); this.close(); } });
    ui.rects['learn:close'] = { x: cx - cr, y: cy - cr, w: cr * 2, h: cr * 2 };
    c.add([cb, cz]);

    // The counting card.
    const CX = x0 + s(40), CY = y0 + s(100), CW = W - s(80), CH = s(tall ? 330 : 230);
    g.fillStyle(0x2a1d14, 0.15); g.fillRoundedRect(CX + 2, CY + 6, CW, CH, s(26));
    g.fillStyle(0xffffff, 1); g.fillRoundedRect(CX, CY, CW, CH, s(26));
    g.lineStyle(4, 0xe6cfa6, 1); g.strokeRoundedRect(CX + 2, CY + 2, CW - 4, CH - 4, s(24));
    ui.rects['learn:num:card'] = { x: CX, y: CY, w: CW, h: CH };
    // Tokens: a things, then "+" and b things (add), or a things with the last b floating off (take away).
    const tokens: ('item' | 'plus')[] = P.op === '+' ? [...Array(P.a).fill('item'), 'plus', ...Array(P.b).fill('item')] : Array(P.a).fill('item');
    const perRow = tall ? 5 : 10;
    const rows: (typeof tokens)[] = [];
    if (tall && P.op === '+') { rows.push(tokens.slice(0, P.a + 1)); rows.push(tokens.slice(P.a + 1)); }
    else for (let i = 0; i < tokens.length; i += perRow) rows.push(tokens.slice(i, i + perRow));
    const maxRow = Math.max(...rows.map((r) => r.length));
    const I = Math.min(s(96), (CW - s(40)) / (maxRow * 1.08), (CH - s(30)) / (rows.length * 1.08));
    const thing = this.things[this.pi] ?? COUNT_THING[this.id] ?? 'apple';
    let n = 0;
    rows.forEach((row, ri) => {
      const rw = row.length * I * 1.08;
      const ry = CY + CH / 2 + (ri - (rows.length - 1) / 2) * I * 1.12 + (P.op === '-' ? s(10) : 0);
      row.forEach((t, ti) => {
        const tx = CX + CW / 2 - rw / 2 + (ti + 0.5) * I * 1.08;
        if (t === 'plus') { c.add(ui.text(tx, ry, '+', Math.max(36, Math.round(I * 0.9)), '#e8604c', 900).setOrigin(0.5)); return; }
        const idx = n++;
        const leaving = P.op === '-' && idx >= P.a - P.b;
        const img = ui.add.image(tx, ry, `lc_${thing}`).setDisplaySize(I * 0.95, I * 0.95);
        const it: Item = { img, x: tx, y: ry, leaving, base: img.scale };
        this.items.push(it);
        c.add(img);
        ui.rects[`learn:num:item:${idx}`] = { x: tx - I / 2, y: ry - I / 2, w: I, h: I };
        img.setInteractive();
        img.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 30) this.tapItem(it); });
        // Gentle idle wobble so the card feels alive.
        ui.tweens.add({ targets: img, angle: { from: -4, to: 4 }, duration: 1300 + idx * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (leaving) ui.tweens.add({ targets: img, y: ry - s(26), alpha: 0.28, delay: 700 + (idx - (P.a - P.b)) * 160, duration: 700, ease: 'Sine.easeOut', onComplete: () => { it.y = ry - s(26); } });
      });
    });

    // "2 + 3 = ?" in big friendly numbers.
    const ey = CY + CH + s(48);
    const eq = ui.text(0, ey, `${P.a} ${P.op === '+' ? '+' : '\u2212'} ${P.b} =`, Math.max(34, s(60)), INK, 900).setOrigin(1, 0.5);
    const ans = ui.text(0, ey, '?', Math.max(34, s(60)), '#c9a77f', 900).setOrigin(0, 0.5);
    const tw = eq.width + s(18) + s(60);
    eq.setX(x0 + W / 2 - tw / 2 + eq.width); ans.setX(eq.x + s(18));
    this.ansText = ans;
    c.add([eq, ans]);
    const hy = ey + s(46);
    this.hintText = ui.text(x0 + W / 2, hy, this.free ? `Just for fun: how many ${THING_NAMES[this.things[this.pi] ?? 'apple']}?` : (P.op === '+' ? 'How many in all?' : 'How many are left?'), Math.max(16, s(24)), '#8a6a50', 900).setOrigin(0.5);
    c.add(this.hintText);

    // Four huge number buttons: the answer and three near misses.
    const near = shuffle([P.ans - 2, P.ans - 1, P.ans + 1, P.ans + 2, P.ans + 3].filter((v) => v >= 0 && v <= 9 && v !== P.ans)).slice(0, 3);
    const nums = shuffle([P.ans, ...near]);
    const T = s(tall ? 150 : 124), TG = s(tall ? 30 : 28);
    const cols = tall ? 2 : 4;
    const by0 = hy + s(tall ? 40 : 26);
    const bx0 = x0 + (W - (cols * T + (cols - 1) * TG)) / 2;
    const colors = shuffle(BTN_COLORS);
    nums.forEach((v, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const hx = bx0 + col * (T + TG) + T / 2, hyy = by0 + row * (T + TG) + T / 2;
      const glow = ui.add.graphics();
      glow.fillStyle(0xfff0a0, 0.9); glow.fillRoundedRect(-T / 2 - s(12), -T / 2 - s(12), T + s(24), T + s(24), s(36));
      glow.setAlpha(0);
      const bg = ui.add.graphics();
      const [fill, edge] = colors[i % colors.length];
      bg.fillStyle(0x2a1d14, 0.22); bg.fillCircle(2, 7, T / 2);
      bg.fillStyle(fill, 1); bg.fillCircle(0, 0, T / 2);
      bg.fillStyle(0xffffff, 0.35); bg.fillEllipse(0, -T * 0.3, T * 0.55, T * 0.16);
      bg.lineStyle(4, edge, 1); bg.strokeCircle(0, 0, T / 2 - 2);
      const tx = ui.text(0, -s(2), String(v), Math.max(44, s(92)), INK, 900).setOrigin(0.5);
      const bc = ui.add.container(hx, hyy, [glow, bg, tx]);
      bc.setSize(T + s(10), T + s(10)).setInteractive();
      const ch: Choice = { c: bc, n: v, hx, hy: hyy, glow, i, dim: false };
      this.choices.push(ch);
      c.add(bc);
      ui.rects[`learn:num:choice:${i}`] = { x: hx - T / 2, y: hyy - T / 2, w: T, h: T };
      bc.on('pointerdown', () => { if (!this.busy) ui.tweens.add({ targets: bc, scale: 0.92, duration: 70, yoyo: true }); });
      bc.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 30) this.attempt(ch); });
    });
    c.setAlpha(fade ? 0 : 1);
    if (fade) ui.tweens.add({ targets: c, alpha: 1, duration: 180 });
    this.armIdle();
  }

  /** Tap a thing to count it: it hops and its number pops up above it. */
  private tapItem(it: Item) {
    if (!this.open || !this.root) return;
    const ui = this.ui;
    ui.tweens.killTweensOf(it.img);
    it.img.setAngle(0).setY(it.y);
    if (it.leaving) { ui.tweens.add({ targets: it.img, angle: { from: -14, to: 14 }, duration: 90, yoyo: true, repeat: 1, onComplete: () => it.img.setAngle(0) }); sfx.tock(); return; }
    const n = this.items.filter((i) => !i.leaving).indexOf(it) + 1;
    this.lastCount = n;
    this.badge(it, n);
    sfx.bellNote(Math.min(3, (n - 1) % 4));
  }

  private badge(it: Item, n: number) {
    const ui = this.ui;
    if (!this.root) return;
    ui.tweens.add({ targets: it.img, y: it.y - 18 * this.k, duration: 150, yoyo: true, ease: 'Sine.easeOut' });
    const t = ui.text(it.x, it.y - it.img.displayHeight * 0.55, String(n), Math.max(22, Math.round(40 * this.k)), '#ffffff', 900).setOrigin(0.5).setStroke('#e8604c', 7);
    this.root.add(t);
    ui.tweens.add({ targets: t, y: t.y - 26 * this.k, alpha: { from: 1, to: 0 }, delay: 700, duration: 600, onComplete: () => t.destroy() });
  }

  private armIdle() {
    this.idle?.remove();
    this.idle = this.ui.time.delayedCall(10000, () => { if (this.open && !this.busy) this.hint(false); });
  }

  private attempt(ch: Choice) {
    if (this.busy || !this.open) return;
    const ui = this.ui;
    const P = this.prob;
    if (ch.n === P.ans) {
      this.busy = true;
      this.idle?.remove();
      for (const o of this.choices) { ui.tweens.killTweensOf(o.glow); o.glow.setAlpha(0); }
      ui.tweens.killTweensOf(ch.c);
      ch.c.setPosition(ch.hx, ch.hy).setAlpha(1);
      ui.tweens.add({ targets: ch.c, scale: { from: 1.25, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      this.ansText?.setText(String(P.ans)).setColor('#3f9a4a');
      if (this.ansText) ui.tweens.add({ targets: this.ansText, scale: { from: 1.5, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      this.sparkle(ch.hx, ch.hy, 10);
      sfx.bellNote(3);
      this.wordDone();
      return;
    }
    // A gentle "not that one": wiggle, go a little pale, then count together.
    this.wrong++;
    sfx.tock();
    ch.dim = true;
    ui.tweens.add({ targets: ch.c, alpha: 0.55, duration: 200 });
    ui.tweens.add({ targets: ch.c, angle: { from: -12, to: 12 }, duration: 80, yoyo: true, repeat: 2, onComplete: () => ch.c.setAngle(0) });
    this.hint(true);
  }

  /** Count the things one by one (each hops with its number), then make the right button glow. */
  private hint(wrong: boolean) {
    const ui = this.ui;
    const P = this.prob;
    this.hints++;
    const gen = this.gen, pi = this.pi;
    this.hintText?.setText(wrong ? "Almost! Let's count together." : "Let's count together!");
    const keep = this.items.filter((i) => !i.leaving);
    keep.forEach((it, i) => ui.time.delayedCall(450 + i * 420, () => { if (this.open && gen === this.gen && pi === this.pi && !this.busy) { this.badge(it, i + 1); sfx.bellNote(Math.min(3, i % 4)); } }));
    ui.time.delayedCall(450 + keep.length * 420 + 200, () => {
      if (!this.open || gen !== this.gen || pi !== this.pi || this.busy) return;
      const ch = this.choices.find((o) => o.n === P.ans);
      if (!ch) return;
      this.hintText?.setText('Tap the bouncy number!');
      ui.tweens.killTweensOf(ch.glow);
      ch.glow.setAlpha(0.9);
      ui.tweens.add({ targets: ch.glow, alpha: { from: 0.95, to: 0.4 }, duration: 520, yoyo: true, repeat: -1 });
      ui.tweens.add({ targets: ch.c, y: ch.hy - 12 * this.k, duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.armIdle();
    });
  }

  private wordDone() {
    const ui = this.ui;
    sfx.chimes();
    const st = this.stars[this.pi];
    if (st) { this.drawStar(st, Math.round(24 * this.k), true); ui.tweens.add({ targets: st, scale: { from: 1.8, to: 1 }, angle: { from: -40, to: 0 }, duration: 520, ease: 'Back.easeOut' }); this.sparkle(st.x, st.y, 8); }
    this.items.filter((i) => !i.leaving).forEach((it, i) => ui.tweens.add({ targets: it.img, y: it.y - 20 * this.k, duration: 160, yoyo: true, delay: i * 90 }));
    this.hintText?.setText(['Yay!', 'Super!', 'Hooray!'][this.pi % 3]).setFontSize(Math.max(22, Math.round(36 * this.k))).setColor('#e8604c');
    this.pi++;
    if (!this.free) ui.world.learn.setProgress(this.id, Math.min(this.pi, this.probs.length));
    const gen = this.gen;
    ui.time.delayedCall(1500, () => {
      if (!this.open || gen !== this.gen) return;
      if (this.pi < this.probs.length) { this.build(); return; }
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
      if (free) ui.game.events.emit('toast', 'Wonderful counting!');
      else ui.world.learn.solve(id);
    });
  }

  private drawStar(g: Phaser.GameObjects.Graphics, r: number, on: boolean) {
    g.clear();
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.48 : r; pts.push(new Phaser.Math.Vector2(Math.cos(a) * rr, Math.sin(a) * rr)); }
    g.fillStyle(on ? 0xffd84d : 0xeadcc2, 1); g.fillPoints(pts, true);
    g.lineStyle(3, on ? 0xd0a23a : 0xd9c6a4, 1); g.strokePoints(pts, true);
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
}
