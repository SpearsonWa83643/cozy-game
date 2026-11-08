// 95: Village clothesline. Colorful laundry on a line near the village (clear of the chimes,
// birdbath and bubble wand). The clothes sway in the breeze; tap for a flutter, rustle and
// sparkles. Culled off-screen. Hidden in snowy themes.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { VILLAGE_ENTRY, VILLAGE_SIGN, VILLAGE_BOARD } from './layout';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const FW = 168, FH = 110;
const GW = 32, GH = 40;
export const LINE = { size: 1.15, n: 4, flutterS: 1.5 };
const PEGS = [-48, -18, 14, 44];
type Garment = { img: Phaser.GameObjects.Image; ox: number; ph: number };

function frameTex(c: Ctx) {
  // Two wooden posts and a taut line.
  c.fillStyle = '#9a6a3e'; c.strokeStyle = '#5a3a1e'; c.lineWidth = 2;
  for (const x of [14, 146]) {
    c.beginPath(); c.roundRect(x, 8, 9, 98, 3); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x + 2, 14, 2, 86);
    c.fillStyle = '#9a6a3e';
  }
  c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.8;
  c.beginPath(); c.moveTo(18, 18); c.lineTo(150, 18); c.stroke();
  // Little grass tuft at each foot.
  c.strokeStyle = '#5a9a40'; c.lineWidth = 1.6;
  for (const x of [18, 150]) {
    c.beginPath(); c.moveTo(x, 106); c.lineTo(x - 5, 98); c.moveTo(x, 106); c.lineTo(x + 5, 98); c.stroke();
  }
}

function shirtTex(c: Ctx) {
  c.fillStyle = '#7ec8ff'; c.strokeStyle = '#3a6a90'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(6, 8); c.lineTo(4, 14); c.lineTo(8, 16); c.lineTo(8, 36); c.lineTo(24, 36); c.lineTo(24, 16); c.lineTo(28, 14); c.lineTo(26, 8);
  c.lineTo(20, 12); c.lineTo(12, 12); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(11, 14, 3, 16);
  // Peg.
  c.fillStyle = '#d8a050'; c.fillRect(14, 2, 4, 8);
}

function dressTex(c: Ctx) {
  c.fillStyle = '#ff9ac8'; c.strokeStyle = '#a05070'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(11, 10); c.lineTo(8, 16); c.lineTo(5, 38); c.lineTo(27, 38); c.lineTo(24, 16); c.lineTo(21, 10); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(12, 20, 3, 5, -0.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d8a050'; c.fillRect(14, 2, 4, 8);
}

function shortsTex(c: Ctx) {
  c.fillStyle = '#b8e070'; c.strokeStyle = '#5a7a30'; c.lineWidth = 1.5;
  c.beginPath(); c.roundRect(8, 10, 16, 12, 3); c.fill(); c.stroke();
  c.fillRect(8, 20, 7, 14); c.strokeRect(8, 20, 7, 14);
  c.fillRect(17, 20, 7, 14); c.strokeRect(17, 20, 7, 14);
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(10, 12, 3, 8);
  c.fillStyle = '#d8a050'; c.fillRect(14, 2, 4, 8);
}

function socksTex(c: Ctx) {
  c.fillStyle = '#ffe08a'; c.strokeStyle = '#b09040'; c.lineWidth = 1.4;
  for (const x of [8, 18]) {
    c.beginPath(); c.roundRect(x, 12, 6, 22, 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(x + 1, 32, 5, 3.5, 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.fillStyle = '#ff8aa0'; c.fillRect(8, 14, 6, 3); c.fillRect(18, 14, 6, 3);
  c.fillStyle = '#d8a050'; c.fillRect(10, 2, 4, 8); c.fillRect(20, 2, 4, 8);
}

const DRAW = [shirtTex, dressTex, shortsTex, socksTex];

export class Clothesline {
  frame!: Phaser.GameObjects.Image;
  clothes: Garment[] = [];
  x = 0; y = 0;
  /** Test hooks. */
  taps = 0; flutters = 0; shown = true; on = false;
  flutter = 0;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('clframe')) {
      canvasTex(w, 'clframe', FW, FH, frameTex, S, true);
      DRAW.forEach((fn, i) => canvasTex(w, `clothe${i}`, GW, GH, fn, S, true));
    }
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private place() {
    const w = this.w;
    const extras: number[][] = [];
    const ws = w as any;
    if (ws.birdbath) extras.push([ws.birdbath.bathX, ws.birdbath.bathY]);
    if (ws.bubbles) extras.push([ws.bubbles.wandX, ws.bubbles.wandY]);
    if (ws.chimes) extras.push([ws.chimes.x, ws.chimes.y]);
    const busy = [...w.interactables.map((it) => [it.x, it.y]), ...w.tappables.map((t) => [t.x(), t.y()]), ...extras];
    const candidates: [number, number][] = [
      [VILLAGE_ENTRY.x - 260, VILLAGE_ENTRY.y + 30],
      [VILLAGE_ENTRY.x - 200, VILLAGE_ENTRY.y + 110],
      [VILLAGE_SIGN.x - 240, VILLAGE_SIGN.y + 90],
      [600, 1780],
      [540, 1840],
      [VILLAGE_BOARD.x - 380, VILLAGE_BOARD.y + 140],
      [700, 1910],
    ];
    let x = candidates[0][0], y = candidates[0][1];
    for (const [cx, cy] of candidates) {
      const [c, r] = w.nav.cellOf(cx, cy);
      if (!w.nav.isBlocked(c, r) && busy.every(([bx, by]) => Math.hypot(bx - cx, by - cy) > 150)) { x = cx; y = cy; break; }
    }
    this.x = x; this.y = y;
    const fs = LINE.size / (frameScale.clframe ?? S);
    this.frame = w.add.image(x, y, 'clframe').setOrigin(0.5, 1).setScale(fs).setDepth(y);
    const barY = y - (FH - 20) * LINE.size;
    PEGS.forEach((ox0, i) => {
      const ox = ox0 * LINE.size;
      const img = w.add.image(x + ox, barY, `clothe${i}`).setOrigin(0.5, 0)
        .setScale(LINE.size / (frameScale[`clothe${i}`] ?? S)).setDepth(y + 1);
      this.clothes.push({ img, ox, ph: i * 1.4 });
    });
    w.tappables.push({
      x: () => this.x, y: () => this.y - 55, r: 72,
      enabled: () => this.shown && this.on,
      tap: () => this.tap(),
    });
  }

  tap() {
    if (!this.shown) return;
    this.taps++; this.flutters++;
    this.flutter = LINE.flutterS;
    sfx.swish(); sfx.rustle();
    const w = this.w;
    this.clothes.forEach((g, k) => w.time.delayedCall(k * 80, () => { if (this.shown) w.burst(this.x + g.ox, this.y - 70, 0xfff0c0, 3, 'spark'); }));
    if (w.life) w.life.reactions++;
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    if (!this.shown) { this.on = false; this.frame.setVisible(false); for (const g of this.clothes) g.img.setVisible(false); }
  }

  update(dt: number) {
    if (!this.shown) return;
    const v = this.w.cameras.main.worldView;
    const vis = this.x > v.x - 140 && this.x < v.right + 140 && this.y > v.y - 40 && this.y - 130 < v.bottom + 40;
    if (!vis) {
      if (this.on) { this.on = false; this.frame.setVisible(false); for (const g of this.clothes) g.img.setVisible(false); }
      return;
    }
    if (!this.on) { this.on = true; this.frame.setVisible(true); for (const g of this.clothes) g.img.setVisible(true); }
    if (this.flutter > 0) this.flutter = Math.max(0, this.flutter - dt);
    const now = this.w.time.now / 1000;
    const k = this.flutter / LINE.flutterS;
    for (const g of this.clothes) {
      const idle = Math.sin(now * 1.2 + g.ph) * 0.08;
      const swing = Math.sin(now * 10 + g.ph * 2) * 0.4 * k;
      g.img.setRotation(idle + swing);
    }
  }

  stats() {
    return {
      taps: this.taps, flutters: this.flutters, shown: this.shown, on: this.on, fluttering: this.flutter > 0,
      x: Math.round(this.x), y: Math.round(this.y), visible: this.frame.visible,
      clothes: this.clothes.map((g) => +g.img.rotation.toFixed(2)),
    };
  }
}
