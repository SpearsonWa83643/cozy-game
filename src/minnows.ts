// 98: Bay minnows. A sparkly school of little colorful fish swim in the Seashell Bay shallows
// (clear of crabs, starfish, the sandcastle and the seagulls). Idle they mill as a school; tap
// (or walk close) and they scatter, then swim back together. Culled off-screen. Hidden in snow.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { BAY } from './layout';
import { lakeValue } from './geo';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const TW = 28, TH = 16;
export const FISH = { size: 0.95, n: 7, near: 120, outS: 0.7, backS: 1.1 };
const COLS = ['#5ec8e8', '#ffb040', '#ff80b0', '#80e070', '#c0a0ff', '#ffe060', '#ff9080'];
type Phase = 'idle' | 'out' | 'back';
type Minnow = {
  img: Phaser.GameObjects.Image;
  ox: number; oy: number; x: number; y: number;
  fromX: number; fromY: number; toX: number; toY: number;
  ph: number; base: number; phase: Phase; t: number; on: boolean; col: number;
};

function fishTex(c: Ctx, col: string) {
  c.fillStyle = col; c.strokeStyle = '#3a5a60'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(16, 8, 10, 5.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  // Tail.
  c.beginPath(); c.moveTo(7, 8); c.lineTo(1, 3); c.lineTo(2, 8); c.lineTo(1, 13); c.closePath(); c.fill(); c.stroke();
  // Stripe + eye.
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(18, 6, 4, 2, -0.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(23, 7.5, 1.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(23.4, 7.1, 0.4, 0, Math.PI * 2); c.fill();
}

export class Minnows {
  fish: Minnow[] = [];
  cx = 0; cy = 0;
  /** Test hooks. */
  taps = 0; scatters = 0; approaches = 0; shown = true;
  private latch = false;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('minnow0')) COLS.forEach((col, i) => canvasTex(w, `minnow${i}`, TW, TH, (c) => fishTex(c, col), S, true));
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private inWater(x: number, y: number) { return lakeValue(x, y) < 0.88; }

  private place() {
    const w = this.w;
    const busy: number[][] = [...w.interactables.map((it) => [it.x, it.y]), ...w.tappables.map((t) => [t.x(), t.y()])];
    const ws = w as any;
    if (ws.sandcastle) busy.push([ws.sandcastle.x, ws.sandcastle.y]);
    if (ws.starfish) busy.push([ws.starfish.cx, ws.starfish.cy]);
    if (ws.seagulls) busy.push([ws.seagulls.cx, ws.seagulls.cy]);
    const clear = (x: number, y: number, d: number) => busy.every(([bx, by]) => Math.hypot(bx - x, by - y) > d);
    let fx = BAY.x - BAY.rx * 0.45, fy = BAY.y + 20, found = false;
    // Prefer western / north-western shallows (gulls south, crabs north beach, starfish east, castle SE).
    for (const a of [3.15, 2.85, 3.45, 2.55, 3.75, 4.0, 2.3, 0.4, 5.9]) {
      for (const k of [0.55, 0.48, 0.62, 0.4, 0.7]) {
        const x = BAY.x + Math.cos(a) * BAY.rx * k, y = BAY.y + Math.sin(a) * BAY.ry * k;
        if (this.inWater(x, y) && clear(x, y, 260)) { fx = x; fy = y; found = true; break; }
      }
      if (found) break;
    }
    this.cx = fx; this.cy = fy;
    for (let i = 0; i < FISH.n; i++) {
      const ang = (i / FISH.n) * Math.PI * 2;
      const ox = Math.cos(ang) * 28 + ((i * 7) % 9) - 4;
      const oy = Math.sin(ang) * 16;
      const key = `minnow${i % COLS.length}`;
      const base = FISH.size / (frameScale[key] ?? S);
      const img = w.add.image(fx + ox, fy + oy, key).setOrigin(0.5, 0.5).setScale(base).setDepth(fy).setVisible(false);
      const m: Minnow = {
        img, ox, oy, x: fx + ox, y: fy + oy, fromX: fx + ox, fromY: fy + oy, toX: fx + ox, toY: fy + oy,
        ph: i * 0.9, base, phase: 'idle', t: 0, on: false, col: i,
      };
      this.fish.push(m);
      w.tappables.push({ x: () => m.x, y: () => m.y, r: 36, soft: true, enabled: () => m.on && m.phase === 'idle', tap: () => this.tap() });
    }
  }

  tap() {
    if (!this.shown || this.fish.some((m) => m.phase !== 'idle')) return false;
    this.taps++;
    this.scatter();
    sfx.plip(); sfx.splash(false);
    this.w.burst(this.cx, this.cy, 0xb0f0ff, 10, 'spark');
    if (this.w.life) this.w.life.reactions++;
    return true;
  }

  private scatter() {
    this.scatters++;
    for (const m of this.fish) {
      const ang = Math.atan2(m.oy, m.ox) + (Math.random() - 0.5) * 0.8;
      const dist = 70 + Math.random() * 40;
      let tx = this.cx + Math.cos(ang) * dist, ty = this.cy + Math.sin(ang) * dist;
      if (!this.inWater(tx, ty)) { tx = this.cx + Math.cos(ang) * 50; ty = this.cy + Math.sin(ang) * 30; }
      m.fromX = m.x; m.fromY = m.y; m.toX = tx; m.toY = ty; m.phase = 'out'; m.t = 0;
      if (Math.abs(tx - m.x) > 1) m.img.setFlipX(tx < m.x);
    }
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    if (!this.shown) for (const m of this.fish) { m.on = false; m.img.setVisible(false); }
  }

  update(dt: number) {
    if (!this.shown) return;
    const w = this.w, v = w.cameras.main.worldView, now = w.time.now / 1000;
    const vis = this.cx > v.x - 120 && this.cx < v.right + 120 && this.cy > v.y - 80 && this.cy < v.bottom + 80;
    if (!vis) {
      for (const m of this.fish) {
        if (m.on) { m.on = false; m.img.setVisible(false); }
        if (m.phase !== 'idle') { m.phase = 'idle'; m.t = 0; m.x = this.cx + m.ox; m.y = this.cy + m.oy; }
      }
      this.latch = false;
      return;
    }
    const fx = w.feet.x, fy = w.feet.y;
    const near = Math.hypot(fx - this.cx, fy - this.cy) < FISH.near;
    if (near && !this.latch && this.fish.every((m) => m.phase === 'idle')) {
      this.latch = true; this.approaches++; this.scatter(); sfx.plip();
    }
    if (!near) this.latch = false;

    for (const m of this.fish) {
      if (!m.on) { m.on = true; m.img.setVisible(true); }
      if (m.phase === 'out') {
        m.t = Math.min(1, m.t + dt / FISH.outS);
        const p = m.t * m.t * (3 - 2 * m.t);
        m.x = m.fromX + (m.toX - m.fromX) * p; m.y = m.fromY + (m.toY - m.fromY) * p;
        if (m.t >= 1) { m.phase = 'back'; m.t = 0; m.fromX = m.x; m.fromY = m.y; }
      } else if (m.phase === 'back') {
        m.t = Math.min(1, m.t + dt / FISH.backS);
        const p = m.t * m.t * (3 - 2 * m.t);
        const hx = this.cx + m.ox, hy = this.cy + m.oy;
        m.x = m.fromX + (hx - m.fromX) * p; m.y = m.fromY + (hy - m.fromY) * p;
        if (Math.abs(hx - m.fromX) > 1) m.img.setFlipX(hx < m.fromX);
        if (m.t >= 1) { m.phase = 'idle'; m.t = 0; m.x = hx; m.y = hy; }
      } else {
        // Idle mill: each fish weaves around its slot.
        m.x = this.cx + m.ox + Math.sin(now * 1.6 + m.ph) * 10;
        m.y = this.cy + m.oy + Math.sin(now * 2.1 + m.ph * 1.3) * 6;
        m.img.setFlipX(Math.sin(now * 1.6 + m.ph) < 0);
      }
      const wag = 1 + Math.sin(now * 8 + m.ph) * 0.06;
      m.img.setPosition(m.x, m.y).setScale(m.base * wag, m.base).setDepth(m.y);
    }
  }

  stats() {
    return {
      taps: this.taps, scatters: this.scatters, approaches: this.approaches, shown: this.shown,
      school: { x: Math.round(this.cx), y: Math.round(this.cy) },
      list: this.fish.map((m) => ({ x: Math.round(m.x), y: Math.round(m.y), phase: m.phase, on: m.on, visible: m.img.visible })),
    };
  }
}
