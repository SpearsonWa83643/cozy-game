// 96: Pond ducks. A few cute ducks paddle on the glade pond (clear of the frog lily pads). They
// bob and paddle while idle; tap one for a quack, splash and a paddle away, then it swims home.
// Culled off-screen. Hidden in snowy themes (the pond ices over).
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S, pondValue } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { POND } from './layout';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const TW = 48, TH = 36;
export const DUCK = { size: 1.1, n: 4, swimS: 1.15, bob: 3.5 };
const BODIES = ['#f4e8a0', '#fff6e8', '#e8c070', '#f0d8b0'];
type Duck = {
  img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse;
  hx: number; hy: number; x: number; y: number; fromX: number; fromY: number; toX: number; toY: number;
  swim: number; away: boolean; rest: number; ph: number; base: number; on: boolean; tint: number;
};

function duckTex(c: Ctx, body: string) {
  // Body.
  c.fillStyle = body; c.strokeStyle = '#6a5a30'; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(22, 22, 16, 10, -0.05, 0, Math.PI * 2); c.fill(); c.stroke();
  // Wing.
  c.fillStyle = body; c.beginPath(); c.ellipse(18, 22, 8, 5, 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
  // Head.
  c.beginPath(); c.arc(36, 14, 7, 0, Math.PI * 2); c.fill(); c.stroke();
  // Beak.
  c.fillStyle = '#f09030'; c.beginPath(); c.moveTo(42, 14); c.lineTo(50, 16); c.lineTo(42, 18); c.closePath(); c.fill();
  // Eye.
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(38, 12.5, 1.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(38.4, 12, 0.5, 0, Math.PI * 2); c.fill();
  // Cheek.
  c.fillStyle = 'rgba(255,140,160,0.4)'; c.beginPath(); c.arc(36, 16.5, 2, 0, Math.PI * 2); c.fill();
  // Tail flick.
  c.fillStyle = body; c.strokeStyle = '#6a5a30';
  c.beginPath(); c.moveTo(8, 20); c.lineTo(2, 16); c.lineTo(6, 24); c.closePath(); c.fill(); c.stroke();
}

export class Ducks {
  ducks: Duck[] = [];
  /** Test hooks. */
  taps = 0; swims = 0; returns = 0; shown = true;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('duck0')) BODIES.forEach((b, i) => canvasTex(w, `duck${i}`, TW, TH, (c) => duckTex(c, b), S, true));
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private onWater(x: number, y: number) {
    const v = pondValue(x, y);
    return v > 0.12 && v < 0.88;
  }

  private place() {
    const w = this.w;
    const pads = ((w as any).frogs?.pads ?? []) as { x: number; y: number }[];
    const clear = (x: number, y: number, d = 48) => pads.every((p) => Math.hypot(p.x - x, p.y - y) > d);
    const homes: [number, number][] = [];
    const trySpot = (x: number, y: number, gap: number, padD: number) => {
      if (!this.onWater(x, y) || !clear(x, y, padD)) return false;
      if (homes.some(([hx, hy]) => Math.hypot(hx - x, hy - y) < gap)) return false;
      homes.push([x, y]); return true;
    };
    // Sweep the pond ellipse, preferring open water away from lily pads.
    for (let i = 0; i < 36 && homes.length < DUCK.n; i++) {
      const a = (i * 2.3) + 0.35;
      for (const k of [0.58, 0.48, 0.68, 0.38, 0.72, 0.3]) {
        if (trySpot(POND.x + Math.cos(a) * POND.rx * k, POND.y + Math.sin(a) * POND.ry * k, 58, 48)) break;
      }
    }
    // Fallback: relax spacing so we always get a little flock.
    for (let i = 0; i < 24 && homes.length < DUCK.n; i++) {
      const a = i * 0.28;
      trySpot(POND.x + Math.cos(a) * POND.rx * 0.5, POND.y + Math.sin(a) * POND.ry * 0.5, 40, 36);
    }
    homes.forEach(([x, y], i) => {
      const key = `duck${i % BODIES.length}`;
      const base = DUCK.size / (frameScale[key] ?? S);
      const shadow = w.add.ellipse(x, y + 6, 28, 8, 0x1a3a50, 0.18).setDepth(-380).setVisible(false);
      const img = w.add.image(x, y, key).setOrigin(0.5, 0.75).setScale(base).setFlipX(i % 2 === 1).setDepth(y).setVisible(false);
      const d: Duck = { img, shadow, hx: x, hy: y, x, y, fromX: x, fromY: y, toX: x, toY: y, swim: 0, away: false, rest: 0, ph: i * 1.5, base, on: false, tint: i };
      this.ducks.push(d);
      w.tappables.push({ x: () => d.x, y: () => d.y - 8, r: 38, soft: true, enabled: () => d.on && d.swim <= 0, tap: () => this.tap(d) });
    });
  }

  tap(d: Duck) {
    if (!this.shown || d.swim > 0) return;
    this.taps++;
    sfx.quack(); sfx.splash(false);
    this.w.burst(d.x, d.y - 8, 0xb0e0ff, 8, 'spark');
    // Paddle to another open-water spot, then home later.
    const ang = Math.atan2(d.y - POND.y, d.x - POND.x) + (Math.random() < 0.5 ? 1.1 : -1.1);
    let tx = d.hx, ty = d.hy;
    for (const k of [0.58, 0.46, 0.68, 0.38]) {
      const x = POND.x + Math.cos(ang) * POND.rx * k;
      const y = POND.y + Math.sin(ang) * POND.ry * k;
      if (this.onWater(x, y) && Math.hypot(x - d.x, y - d.y) > 40) { tx = x; ty = y; break; }
    }
    this.startSwim(d, tx, ty, true);
    if (this.w.life) this.w.life.reactions++;
  }

  private startSwim(d: Duck, tx: number, ty: number, away: boolean) {
    d.fromX = d.x; d.fromY = d.y; d.toX = tx; d.toY = ty; d.swim = 1; d.away = away;
    d.rest = away ? 0.45 : 0;
    if (Math.abs(tx - d.x) > 2) d.img.setFlipX(tx < d.x);
    if (away) this.swims++;
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    if (!this.shown) for (const d of this.ducks) { d.on = false; d.img.setVisible(false); d.shadow.setVisible(false); }
  }

  update(dt: number) {
    if (!this.shown) return;
    const w = this.w, v = w.cameras.main.worldView, now = w.time.now / 1000;
    for (const d of this.ducks) {
      const vis = d.x > v.x - 80 && d.x < v.right + 80 && d.y > v.y - 40 && d.y - 40 < v.bottom + 40;
      if (!vis && d.swim <= 0) {
        if (d.on) { d.on = false; d.img.setVisible(false); d.shadow.setVisible(false); }
        if (d.away) { d.away = false; d.x = d.hx; d.y = d.hy; this.returns++; }
        continue;
      }
      if (!d.on) { d.on = true; d.img.setVisible(true); d.shadow.setVisible(true); }
      let bob = Math.sin(now * 2.2 + d.ph) * DUCK.bob;
      if (d.swim > 0) {
        d.swim = Math.max(0, d.swim - dt / DUCK.swimS);
        const p = 1 - d.swim;
        d.x = d.fromX + (d.toX - d.fromX) * p;
        d.y = d.fromY + (d.toY - d.fromY) * p;
        bob += Math.sin(p * Math.PI * 3) * 2;
        if (d.swim <= 0) { d.x = d.toX; d.y = d.toY; }
      } else if (d.away) {
        d.rest -= dt;
        if (d.rest <= 0) { this.startSwim(d, d.hx, d.hy, false); this.returns++; }
      } else if (!d.away) {
        // Idle paddle: a tiny figure-eight around home, kept on water.
        const ox = Math.sin(now * 0.55 + d.ph) * 14;
        const oy = Math.sin(now * 1.1 + d.ph) * 7;
        const nx = d.hx + ox, ny = d.hy + oy;
        if (this.onWater(nx, ny)) { d.x = nx; d.y = ny; }
        if (Math.abs(ox) > 2) d.img.setFlipX(ox < 0);
      }
      d.img.setPosition(d.x, d.y - bob).setDepth(d.y);
      d.shadow.setPosition(d.x, d.y + 6);
    }
  }

  stats() {
    return {
      taps: this.taps, swims: this.swims, returns: this.returns, shown: this.shown,
      list: this.ducks.map((d) => ({
        x: Math.round(d.x), y: Math.round(d.y), hx: Math.round(d.hx), hy: Math.round(d.hy),
        away: d.away, swimming: d.swim > 0, on: d.on, visible: d.img.visible,
      })),
    };
  }
}
