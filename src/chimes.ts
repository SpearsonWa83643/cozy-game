// 91: Village wind chimes. A little set of hanging chimes on a wooden post by the village path
// (clear of the birdbath and bubble wand). The tubes sway gently; tap for a cascade of soft notes
// and sparkles while they swing. Culled off-screen. Hidden in snowy themes.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { VILLAGE_ENTRY, VILLAGE_SIGN, VILLAGE_BOARD } from './layout';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const PW = 64, PH = 120;
const TUBE_W = 10, TUBE_H = 44;
export const CHIME = { size: 1.1, n: 5, ringS: 1.6 };
const TUBE_COLORS = ['#9ad0ff', '#ffb0d0', '#b8f0a0', '#ffe08a', '#c8b0ff'];
const NOTES = [1568, 1760, 1975.5, 2349.3, 2637];
type Tube = { img: Phaser.GameObjects.Image; ox: number; oy: number; len: number; ph: number };

function postTex(c: Ctx) {
  // Wooden post with a little crossbar and a leaf on top.
  c.fillStyle = '#9a6a3e'; c.strokeStyle = '#5a3a1e'; c.lineWidth = 2;
  c.beginPath(); c.roundRect(28, 14, 8, 104, 3); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(6, 14, 52, 7, 3); c.fill(); c.stroke();
  c.fillStyle = '#7ac860'; c.strokeStyle = '#3a7a30';
  c.beginPath(); c.ellipse(32, 8, 9, 5, -0.3, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(30, 22, 2, 90);
}

function tubeTex(c: Ctx, col: string) {
  c.strokeStyle = 'rgba(80,60,40,0.7)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(5, 0); c.lineTo(5, 6); c.stroke();
  c.fillStyle = col; c.strokeStyle = '#4a5a70'; c.lineWidth = 1.4;
  c.beginPath(); c.roundRect(1.5, 6, 7, TUBE_H - 8, 3); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(3, 9, 1.6, TUBE_H - 16);
}

export class Chimes {
  post!: Phaser.GameObjects.Image;
  tubes: Tube[] = [];
  x = 0; y = 0;
  /** Test hooks. */
  taps = 0; rings = 0; shown = true; on = false;
  ring = 0;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('chimepost')) {
      canvasTex(w, 'chimepost', PW, PH, postTex, S, true);
      TUBE_COLORS.forEach((col, i) => canvasTex(w, `chimetube${i}`, TUBE_W, TUBE_H, (c) => tubeTex(c, col), S, true));
    }
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private place() {
    const w = this.w;
    // North-east of the sign, between the sign and the notice board (birdbath is west, wand east/south).
    const candidates: [number, number][] = [
      [VILLAGE_SIGN.x + 60, VILLAGE_SIGN.y - 70],
      [VILLAGE_BOARD.x + 90, VILLAGE_BOARD.y - 40],
      [VILLAGE_ENTRY.x + 200, VILLAGE_ENTRY.y - 10],
      [VILLAGE_SIGN.x - 10, VILLAGE_SIGN.y - 110],
      [VILLAGE_BOARD.x + 60, VILLAGE_BOARD.y + 110],
    ];
    const busy = [...w.interactables.map((it) => [it.x, it.y]), ...w.tappables.map((t) => [t.x(), t.y()])];
    let x = candidates[0][0], y = candidates[0][1];
    for (const [cx, cy] of candidates) {
      const [c, r] = w.nav.cellOf(cx, cy);
      if (!w.nav.isBlocked(c, r) && busy.every(([bx, by]) => Math.hypot(bx - cx, by - cy) > 95)) { x = cx; y = cy; break; }
    }
    this.x = x; this.y = y;
    const ps = CHIME.size / (frameScale.chimepost ?? S);
    this.post = w.add.image(x, y, 'chimepost').setOrigin(0.5, 1).setScale(ps).setDepth(y);
    // Crossbar sits ~104 art px above the foot.
    const barY = y - (PH - 18) * CHIME.size;
    for (let i = 0; i < CHIME.n; i++) {
      const ox = (-20 + i * 10) * CHIME.size;
      const len = 0.75 + ((i * 3) % 5) * 0.08;
      const img = w.add.image(x + ox, barY, `chimetube${i}`).setOrigin(0.5, 0)
        .setScale(CHIME.size / (frameScale[`chimetube${i}`] ?? S), len * CHIME.size / (frameScale[`chimetube${i}`] ?? S)).setDepth(y + 1);
      this.tubes.push({ img, ox, oy: barY - y, len, ph: i * 1.3 });
    }
    w.tappables.push({
      x: () => this.x, y: () => this.y - 70, r: 56,
      enabled: () => this.shown && this.on,
      tap: () => this.tap(),
    });
  }

  tap() {
    if (!this.shown) return;
    this.taps++; this.rings++;
    this.ring = CHIME.ringS;
    const order = Math.random() < 0.5 ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
    order.forEach((n, k) => sfx.bell(NOTES[n] * (0.98 + Math.random() * 0.04), k * 0.11, 0.05, 2.2));
    const w = this.w;
    this.tubes.forEach((t, k) => w.time.delayedCall(k * 110, () => { if (this.shown) w.burst(this.x + t.ox, this.y + t.oy + 40, 0xfff0b0, 3, 'spark'); }));
    if (w.life) w.life.reactions++;
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    if (!this.shown) { this.on = false; this.post.setVisible(false); for (const t of this.tubes) t.img.setVisible(false); }
  }

  update(dt: number) {
    if (!this.shown) return;
    const v = this.w.cameras.main.worldView;
    const vis = this.x > v.x - 120 && this.x < v.right + 120 && this.y > v.y - 40 && this.y - 160 < v.bottom + 40;
    if (!vis) {
      if (this.on) { this.on = false; this.post.setVisible(false); for (const t of this.tubes) t.img.setVisible(false); }
      return;
    }
    if (!this.on) { this.on = true; this.post.setVisible(true); for (const t of this.tubes) t.img.setVisible(true); }
    if (this.ring > 0) this.ring = Math.max(0, this.ring - dt);
    const now = this.w.time.now / 1000;
    const k = this.ring / CHIME.ringS;
    for (const t of this.tubes) {
      const idle = Math.sin(now * 1.3 + t.ph) * 0.06;
      const swing = Math.sin(now * 9 + t.ph * 2) * 0.35 * k;
      t.img.setRotation(idle + swing);
    }
  }

  stats() {
    return {
      taps: this.taps, rings: this.rings, shown: this.shown, on: this.on, ringing: this.ring > 0,
      x: Math.round(this.x), y: Math.round(this.y), visible: this.post.visible,
      tubes: this.tubes.map((t) => +t.img.rotation.toFixed(2)),
    };
  }
}
