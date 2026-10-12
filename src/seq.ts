// Sequence helpers for the ordered puzzles (lanterns, flower pots, bells): big bold symbol
// icons with thick outlines, and numbered badges (1, 2, 3...) that light up with a check when
// each step is done. Fixed high-contrast palette so they read in every theme.
import Phaser from 'phaser';
import { Ctx, canvasTex, atlasOf } from './art';

export const SEQ_INK = '#2e2230';
const INK_N = 0x2e2230;
export const POT_COLORS = [0xff9ec4, 0x8fc8ff, 0xffd75e, 0xffffff, 0xc59bff];
export const POT_NAMES = ['pink', 'blue', 'yellow', 'white', 'purple'];
export const RIBBONS = [0xe85d5d, 0xf2c14e, 0x7cc463, 0x6fa8ff];
export const RIBBON_NAMES = ['red', 'yellow', 'green', 'blue'];
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function fo(c: Ctx, fill: string, lw: number) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = SEQ_INK; c.stroke(); }

function paintDawn(c: Ctx) {
  // Half sun rising over a hill line, with chunky rays.
  const cx = 28, cy = 36;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 5);
    c.save(); c.translate(cx + Math.cos(a) * 19, cy + Math.sin(a) * 19); c.rotate(a + Math.PI / 2);
    c.beginPath(); c.moveTo(-4, 2); c.lineTo(0, -8); c.lineTo(4, 2); c.closePath(); fo(c, '#ff8a3d', 2.6); c.restore();
  }
  c.beginPath(); c.arc(cx, cy, 13, Math.PI, 0); c.closePath(); fo(c, '#ffb03b', 3.2);
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(cx - 5, cy - 7, 4, 2.4, -0.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(4, cy + 1); c.quadraticCurveTo(28, cy - 3, 52, cy + 1); c.lineTo(52, cy + 9); c.quadraticCurveTo(28, cy + 6, 4, cy + 9); c.closePath(); fo(c, '#7cc463', 3);
}
function paintNoon(c: Ctx) {
  const cx = 28, cy = 28;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c.save(); c.translate(cx + Math.cos(a) * 19, cy + Math.sin(a) * 19); c.rotate(a + Math.PI / 2);
    c.beginPath(); c.moveTo(-4.5, 3); c.lineTo(0, -7); c.lineTo(4.5, 3); c.closePath(); fo(c, '#ffb03b', 2.6); c.restore();
  }
  c.beginPath(); c.arc(cx, cy, 13.5, 0, Math.PI * 2); fo(c, '#ffd84d', 3.2);
  c.fillStyle = SEQ_INK; c.beginPath(); c.arc(cx - 4.5, cy - 1.5, 1.8, 0, Math.PI * 2); c.arc(cx + 4.5, cy - 1.5, 1.8, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(cx, cy + 2, 5, 0.2, Math.PI - 0.2); c.lineWidth = 2.2; c.strokeStyle = SEQ_INK; c.stroke();
}
function star(c: Ctx, x: number, y: number, r: number, fill: string) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); fo(c, fill, 2.2);
}
function paintDusk(c: Ctx) {
  // A fat crescent moon and two stars.
  c.beginPath(); c.arc(25, 30, 17, 0.55 * Math.PI, 1.95 * Math.PI, false); c.arc(33, 23, 13, 1.82 * Math.PI, 0.68 * Math.PI, true); c.closePath(); fo(c, '#a48cff', 3.2);
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(16, 24, 2.5, 5, 0.3, 0, Math.PI * 2); c.fill();
  star(c, 43, 34, 7, '#ffd84d'); star(c, 44, 12, 5, '#ffd84d');
}
function paintFlower(color: number) {
  return (c: Ctx) => {
    const cx = 28, cy = 28;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      c.beginPath(); c.ellipse(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 10, 8.5, a, 0, Math.PI * 2); fo(c, hex(color), 3);
    }
    c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI * 2); fo(c, color === 0xffd75e ? '#ff9a3c' : '#ffd84d', 3);
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(cx - 2.5, cy - 2.5, 2.2, 0, Math.PI * 2); c.fill();
  };
}
function paintBell(color: number) {
  return (c: Ctx) => {
    const cx = 28;
    c.beginPath(); c.arc(cx, 9, 4, 0, Math.PI * 2); fo(c, '#c9a24a', 2.6);
    c.beginPath(); c.moveTo(cx - 8, 15); c.quadraticCurveTo(cx - 13, 22, cx - 14, 34); c.quadraticCurveTo(cx - 17, 40, cx - 20, 42);
    c.lineTo(cx + 20, 42); c.quadraticCurveTo(cx + 17, 40, cx + 14, 34); c.quadraticCurveTo(cx + 13, 22, cx + 8, 15); c.quadraticCurveTo(cx, 10, cx - 8, 15); c.closePath();
    fo(c, '#ffd84d', 3.2);
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(cx - 6, 25, 2.6, 6, 0.15, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx, 45, 4.5, 0, Math.PI * 2); fo(c, '#c9a24a', 2.6);
    // Ribbon band in the bell's colour.
    c.beginPath(); c.roundRect(cx - 17, 32, 34, 7, 3); fo(c, hex(color), 2.6);
  };
}

function paintReset(c: Ctx) {
  // A fat circular arrow.
  const cx = 28, cy = 29, r = 15;
  c.beginPath(); c.arc(cx, cy, r + 5, -Math.PI * 0.35, Math.PI * 1.25, false); c.arc(cx, cy, r - 5, Math.PI * 1.25, -Math.PI * 0.35, true); c.closePath(); fo(c, '#5fb8ff', 3.2);
  const a = -Math.PI * 0.35, hx = cx + Math.cos(a) * r, hy = cy + Math.sin(a) * r;
  c.beginPath(); c.moveTo(hx - 12, hy - 4); c.lineTo(hx + 9, hy - 9); c.lineTo(hx + 4, hy + 12); c.closePath(); fo(c, '#5fb8ff', 3.2);
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(cx - 13, cy - 4, 2.4, 5, 0.4, 0, Math.PI * 2); c.fill();
}

export function paintSeqArt(scene: Phaser.Scene) {
  canvasTex(scene, 'q_reset', 56, 56, paintReset, 3);
  const T = (k: string, fn: (c: Ctx) => void) => canvasTex(scene, k, 56, 56, fn, 3);
  T('q_dawn', paintDawn); T('q_noon', paintNoon); T('q_dusk', paintDusk);
  POT_COLORS.forEach((col, i) => T(`q_flower${i}`, paintFlower(col)));
  RIBBONS.forEach((col, i) => T(`q_bell${i}`, paintBell(col)));
}

export type BadgeState = 'todo' | 'done' | 'wrong';

/** A big round number badge. Turns green with a check when its step is done. */
export class NumBadge {
  c: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  t: Phaser.GameObjects.Text;
  check: Phaser.GameObjects.Image;
  state: BadgeState = 'todo';
  constructor(private scene: Phaser.Scene, x: number, y: number, public n: number, public r = 14, res = 4) {
    this.g = scene.add.graphics();
    this.t = scene.add.text(0, 1, String(n), { fontFamily: 'Nunito, "Trebuchet MS", sans-serif', fontSize: `${Math.round(r * 1.45)}px`, color: '#2e2230', fontStyle: '900', resolution: res } as any).setOrigin(0.5);
    this.check = scene.add.image(r * 0.78, -r * 0.78, atlasOf('i_check'), 'i_check').setDisplaySize(r * 1.05, r * 1.05).setVisible(false);
    this.c = scene.add.container(x, y, [this.g, this.t, this.check]);
    this.draw();
  }
  private draw() {
    const g = this.g, r = this.r, s = this.state;
    g.clear();
    g.fillStyle(0x1d1418, 0.3); g.fillCircle(1, r * 0.18, r + 1);
    g.fillStyle(s === 'done' ? 0x5fbf4a : s === 'wrong' ? 0xf08a7a : 0xffffff, 1); g.fillCircle(0, 0, r);
    g.lineStyle(Math.max(3, r * 0.22), INK_N, 1); g.strokeCircle(0, 0, r - Math.max(1.5, r * 0.11));
    this.t.setColor(s === 'done' ? '#ffffff' : '#2e2230').setStroke(s === 'done' ? '#2f6b24' : '#ffffff', s === 'done' ? Math.max(3, r * 0.22) : 0);
    this.check.setVisible(s === 'done');
  }
  set(s: BadgeState, animate = true) {
    if (s === this.state) return;
    this.state = s;
    this.draw();
    if (!animate) return;
    const sc = this.c.scale;
    this.scene.tweens.killTweensOf(this.c);
    this.c.setScale(1);
    if (s === 'done') this.scene.tweens.add({ targets: this.c, scale: { from: 1.6 * sc, to: 1 }, duration: 420, ease: 'Back.easeOut' });
    if (s === 'wrong') this.scene.tweens.add({ targets: this.c, x: this.c.x + 3, duration: 50, yoyo: true, repeat: 3 });
  }
  pulse() { this.scene.tweens.add({ targets: this.c, scale: { from: 1.5, to: 1 }, duration: 380, ease: 'Back.easeOut' }); }
  setDepth(d: number) { this.c.setDepth(d); return this; }
}

/** A round white plate holding a big symbol icon (on puzzle objects). */
export function plate(scene: Phaser.Scene, x: number, y: number, frame: string, r: number) {
  const g = scene.add.graphics();
  g.fillStyle(0x1d1418, 0.28); g.fillCircle(1, r * 0.16, r + 1);
  g.fillStyle(0xfffaf0, 1); g.fillCircle(0, 0, r);
  g.lineStyle(Math.max(3, r * 0.17), INK_N, 1); g.strokeCircle(0, 0, r - 1.5);
  const im = scene.add.image(0, 0, atlasOf(frame), frame).setDisplaySize(r * 1.62, r * 1.62);
  const c = scene.add.container(x, y, [g, im]);
  return { c, im, setFrame(f: string) { im.setTexture(atlasOf(f), f).setDisplaySize(r * 1.62, r * 1.62); } };
}

/** A clue card shown with a sign: big number + big icon + one short word. */
export type SeqCard = { n: number; icon: string; label: string; done?: boolean };
