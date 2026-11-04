// 81: Tide-pool starfish in Seashell Bay. Five starfish lie around a little tide pool on the beach.
// Tap them one by one: each does a twirl, a big number pops up above it (1, 2, 3, 4, 5) and a
// happy note plays, higher each time, so little ones count to five. When all five are counted they
// twirl together and cheer "5 starfish!", then the numbers fade and you can count again.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { BAY, WORLD_W, WORLD_H } from './layout';
import { lakeValue } from './geo';
import { DPR } from './dpr';
import type { WorldScene } from './scenes/World';

const N = 5;
const COLORS = ['#ff8a5c', '#ffb84d', '#ff7aa8', '#b98cff', '#5cc8ff'];
const TW = 56, TH = 56;
export const STARS = { ring: 82, resetMs: 4500, size: 1 };
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
type Star = { img: Phaser.GameObjects.Image; num: Phaser.GameObjects.Text; x: number; y: number; n: number; spin: number; base: number; ph: number };

function star(c: Ctx, col: string) {
  const cx = TW / 2, cy = TH / 2;
  c.fillStyle = col; c.strokeStyle = 'rgba(90,40,30,0.75)'; c.lineWidth = 2.2; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 24, t = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r); }
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 5; i++) { const t = -Math.PI / 2 + i * Math.PI * 2 / 5; for (const k of [7, 13, 18]) { c.beginPath(); c.arc(cx + Math.cos(t) * k, cy + Math.sin(t) * k, 1.4, 0, Math.PI * 2); c.fill(); } }
  // A sleepy smile.
  c.strokeStyle = 'rgba(70,30,20,0.85)'; c.lineWidth = 1.6;
  for (const ex of [-4, 4]) { c.beginPath(); c.arc(cx + ex, cy - 2, 1.8, Math.PI * 0.1, Math.PI * 0.9); c.stroke(); }
  c.beginPath(); c.arc(cx, cy + 2, 3, 0.2, Math.PI - 0.2); c.stroke();
}
function pool(c: Ctx) {
  c.fillStyle = 'rgba(120,200,225,0.75)'; c.strokeStyle = 'rgba(200,170,120,0.9)'; c.lineWidth = 4;
  c.beginPath(); c.ellipse(60, 30, 54, 24, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(44, 22, 16, 5, -0.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#9aa59a'; for (const [x, y, r] of [[20, 34, 4], [92, 26, 5], [74, 40, 3]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
}

export class Starfish {
  stars: Star[] = [];
  /** Test hooks. */
  count = 0; rounds = 0; taps = 0; cx = 0; cy = 0;
  private resetAt = 0;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('sfish0')) {
      COLORS.forEach((col, i) => canvasTex(w, `sfish${i}`, TW, TH, (c) => star(c, col), S, true));
      canvasTex(w, 'tidepool', 120, 60, pool, S, true);
    }
    this.place();
  }

  private sand(x: number, y: number) { return x > 150 && x < WORLD_W - 150 && y > 150 && y < WORLD_H - 100 && lakeValue(x, y) > 1.06; }

  /** A tide pool on the west beach of the bay with five starfish around it. */
  private place() {
    const w = this.w;
    let cx = BAY.x - BAY.rx * 1.25, cy = BAY.y, found = false;
    for (const a of [Math.PI * 0.97, Math.PI * 0.9, Math.PI * 1.05, Math.PI * 0.82, Math.PI * 0.75, -0.25, 0]) {
      for (const k of [1.2, 1.25, 1.3, 1.35]) {
        const x = BAY.x + Math.cos(a) * BAY.rx * k, y = BAY.y + Math.sin(a) * BAY.ry * k;
        const ok = this.sand(x, y) && [0, 1, 2, 3, 4].every((i) => { const t = -Math.PI / 2 + i * Math.PI * 2 / N; return this.sand(x + Math.cos(t) * (STARS.ring + 30), y + Math.sin(t) * (STARS.ring * 0.6 + 30)); });
        if (ok) { cx = x; cy = y; found = true; break; }
      }
      if (found) break;
    }
    this.cx = Math.round(cx); this.cy = Math.round(cy);
    w.add.image(cx, cy, 'tidepool').setScale(1 / (frameScale.tidepool ?? S)).setDepth(cy - 40);
    for (let i = 0; i < N; i++) {
      const t = -Math.PI / 2 + i * Math.PI * 2 / N + 0.3;
      const x = cx + Math.cos(t) * STARS.ring, y = cy + Math.sin(t) * STARS.ring * 0.62;
      const base = STARS.size / (frameScale[`sfish${i}`] ?? S);
      const img = w.add.image(x, y, `sfish${i}`).setScale(base).setRotation(i * 0.7).setDepth(y - 20);
      const num = w.add.text(x, y - 34, '', { fontFamily: 'Nunito, sans-serif', fontSize: '30px', color: '#ffffff', fontStyle: '900', stroke: '#5a3a8a', strokeThickness: 6, resolution: Math.max(2, DPR * 1.5) } as any)
        .setOrigin(0.5).setDepth(9500).setVisible(false);
      const s: Star = { img, num, x, y, n: 0, spin: 0, base, ph: i * 1.1 };
      this.stars.push(s);
      w.tappables.push({ x: () => s.x, y: () => s.y, r: 40, soft: true, tap: () => this.tap(s) });
    }
  }

  tap(s: Star) {
    this.taps++;
    const w = this.w;
    s.spin = 1;
    if (s.n > 0 || this.count >= N) { sfx.tock(); return; }
    this.count++; s.n = this.count;
    s.num.setText(String(s.n)).setVisible(true).setAlpha(1).setScale(0.3);
    w.tweens.add({ targets: s.num, scale: 1, duration: 320, ease: 'Back.easeOut' });
    sfx.bell([523.25, 587.33, 659.25, 783.99, 880][s.n - 1], 0, 0.14, 1.4);
    w.burst(s.x, s.y - 10, 0xfff0a0, 6, 'spark');
    if (this.count === N) {
      this.rounds++;
      w.time.delayedCall(450, () => {
        for (const q of this.stars) q.spin = 1.6;
        w.floatText(this.cx, this.cy - 90, '5 starfish! Great counting!', '#ffe08a');
        sfx.sparkle();
        w.burst(this.cx, this.cy - 30, 0xff9fc4, 16, 'spark');
      });
      this.resetAt = w.time.now + STARS.resetMs;
    }
  }

  private reset() {
    this.count = 0; this.resetAt = 0;
    for (const s of this.stars) { s.n = 0; this.w.tweens.add({ targets: s.num, alpha: 0, duration: 500, onComplete: () => s.num.setVisible(false) }); }
  }

  update(dt: number) {
    const w = this.w, v = w.cameras.main.worldView;
    if (this.resetAt && w.time.now > this.resetAt) this.reset();
    if (this.cx < v.x - 200 || this.cx > v.right + 200 || this.cy < v.y - 200 || this.cy > v.bottom + 200) return;
    const now = w.time.now / 1000, rm = reduceMotion();
    for (const s of this.stars) {
      let r = s.img.rotation, sc = 1;
      if (s.spin > 0) { s.spin -= dt; if (!rm) r += dt * 9; sc = 1 + Math.sin(Math.max(0, s.spin) * Math.PI) * 0.25; }
      else if (!rm) r += Math.sin(now * 0.8 + s.ph) * dt * 0.08;
      s.img.setRotation(r).setScale(s.base * sc);
      if (s.num.visible && !rm) s.num.setY(s.y - 34 + Math.sin(now * 3 + s.ph) * 3);
    }
  }

  stats() {
    return { count: this.count, rounds: this.rounds, taps: this.taps, cx: this.cx, cy: this.cy, list: this.stars.map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), n: s.n, num: s.num.visible ? s.num.text : '' })) };
  }
}
