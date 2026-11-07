// 93: Seashell Bay seagulls. A little flock of 4 gulls stands on the bay shore (clear of the crabs,
// starfish pool and sandcastle). They bob and peck; walk up or tap one and the flock flaps away,
// circles, then glides back to the sand. Culled off-screen. Hidden in snowy themes.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { BAY, WORLD_W, WORLD_H } from './layout';
import { lakeValue } from './geo';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const TW = 48, TH = 40;
export const GULL = { size: 1.05, n: 4, near: 150, far: 300, flyS: 1.1, awayS: 1.6, backS: 1.6 };
type Phase = 'idle' | 'up' | 'away' | 'back';
type Gull = {
  img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse;
  hx: number; hy: number; x: number; y: number; lift: number;
  ph: number; base: number; phase: Phase; t: number;
  fromX: number; fromY: number; toX: number; toY: number; peck: number; on: boolean;
};

function gullTex(c: Ctx, flap: boolean) {
  // Legs.
  if (!flap) { c.strokeStyle = '#e8a040'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(22, 30); c.lineTo(21, 38); c.moveTo(27, 30); c.lineTo(28, 38); c.stroke(); }
  // Body.
  c.fillStyle = '#ffffff'; c.strokeStyle = '#5a6a7a'; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(24, 24, 13, 8, -0.1, 0, Math.PI * 2); c.fill(); c.stroke();
  // Wing(s).
  c.fillStyle = '#b8c4d0';
  if (flap) {
    c.beginPath(); c.moveTo(16, 20); c.quadraticCurveTo(8, 4, 2, 6); c.quadraticCurveTo(12, 14, 22, 22); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(28, 20); c.quadraticCurveTo(38, 4, 46, 6); c.quadraticCurveTo(36, 14, 28, 23); c.closePath(); c.fill(); c.stroke();
  } else {
    c.beginPath(); c.ellipse(20, 23, 10, 5, 0.15, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#3a4a5a'; c.beginPath(); c.moveTo(10, 22); c.lineTo(4, 20); c.lineTo(9, 26); c.closePath(); c.fill();
  }
  // Head + beak + eye.
  c.fillStyle = '#ffffff'; c.strokeStyle = '#5a6a7a';
  c.beginPath(); c.arc(35, 15, 6, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#ffb030'; c.beginPath(); c.moveTo(40, 14); c.lineTo(47, 16); c.lineTo(40, 18); c.closePath(); c.fill();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(36.5, 13.5, 1.4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(37, 13, 0.5, 0, Math.PI * 2); c.fill();
}

export class Seagulls {
  gulls: Gull[] = [];
  cx = 0; cy = 0;
  /** Test hooks. */
  taps = 0; flights = 0; approaches = 0; shown = true;
  private latch = false;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('gull')) {
      canvasTex(w, 'gull', TW, TH, (c) => gullTex(c, false), S, true);
      canvasTex(w, 'gull_flap', TW, TH, (c) => gullTex(c, true), S, true);
    }
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private sand(x: number, y: number) { return x > 150 && x < WORLD_W - 150 && y > 150 && y < WORLD_H - 100 && lakeValue(x, y) > 1.05; }

  private place() {
    const w = this.w;
    const busy: number[][] = [...w.interactables.map((it) => [it.x, it.y]), ...w.tappables.map((t) => [t.x(), t.y()])];
    const ws = w as any;
    if (ws.sandcastle) busy.push([ws.sandcastle.x, ws.sandcastle.y]);
    if (ws.starfish) busy.push([ws.starfish.cx, ws.starfish.cy]);
    const clear = (x: number, y: number, d: number) => busy.every(([bx, by]) => Math.hypot(bx - x, by - y) > d);
    const offs: [number, number][] = [[-60, -10], [-15, 18], [35, -12], [75, 14]];
    let fx = BAY.x - BAY.rx * 0.4, fy = BAY.y + BAY.ry * 1.15, found = false;
    // South / south-west beach first (crabs walk the north arc, starfish west, castle south-east).
    for (const a of [1.75, 1.95, 1.55, 2.15, 2.35, 1.35, 2.55, -0.25, 0.0]) {
      for (const k of [1.14, 1.2, 1.26, 1.32]) {
        const x = BAY.x + Math.cos(a) * BAY.rx * k, y = BAY.y + Math.sin(a) * BAY.ry * k;
        if (offs.every(([ox, oy]) => this.sand(x + ox, y + oy)) && clear(x, y, 230)) { fx = x; fy = y; found = true; break; }
      }
      if (found) break;
    }
    this.cx = Math.round(fx); this.cy = Math.round(fy);
    for (let i = 0; i < GULL.n; i++) {
      const [ox, oy] = offs[i];
      const hx = fx + ox, hy = fy + oy;
      const base = GULL.size / (frameScale.gull ?? S);
      const shadow = w.add.ellipse(hx, hy, 30, 8, 0x3a2a1a, 0.16).setDepth(hy - 2).setVisible(false);
      const img = w.add.image(hx, hy, 'gull').setOrigin(0.5, 0.95).setScale(base).setFlipX(i % 2 === 1).setDepth(hy).setVisible(false);
      const g: Gull = { img, shadow, hx, hy, x: hx, y: hy, lift: 0, ph: i * 1.7, base, phase: 'idle', t: 0, fromX: hx, fromY: hy, toX: hx, toY: hy, peck: 1 + i * 0.7, on: false };
      this.gulls.push(g);
      w.tappables.push({ x: () => g.x, y: () => g.y - g.lift - 18, r: 40, soft: true, enabled: () => g.on && g.phase === 'idle', tap: () => this.tap(g) });
    }
  }

  tap(g?: Gull) {
    if (!this.shown) return;
    this.taps++;
    this.scatter();
    if (g) this.w.burst(g.x, g.y - 24, 0xffffff, 6, 'spark');
  }

  private scatter() {
    const any = this.gulls.some((g) => g.phase === 'idle');
    if (!any) return;
    this.flights++;
    sfx.ambience('gull'); sfx.swish();
    for (const g of this.gulls) {
      if (g.phase !== 'idle') continue;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      g.phase = 'up'; g.t = 0;
      g.fromX = g.x; g.fromY = g.y;
      g.toX = g.hx + Math.cos(a) * 160 + (g.hx - this.cx) * 1.5; g.toY = g.hy + Math.sin(a) * 50;
      g.img.setTexture('gull_flap').setFlipX(g.toX < g.x);
    }
    if (this.w.life) this.w.life.reactions++;
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    if (!this.shown) for (const g of this.gulls) { g.on = false; g.img.setVisible(false); g.shadow.setVisible(false); }
  }

  update(dt: number) {
    if (!this.shown) return;
    const w = this.w, v = w.cameras.main.worldView, now = w.time.now / 1000;
    const d = Math.hypot(w.feet.x - this.cx, w.feet.y - this.cy);
    if (d < GULL.near + 60 && !this.latch && this.gulls.some((g) => g.phase === 'idle')) {
      const close = this.gulls.some((g) => Math.hypot(w.feet.x - g.x, w.feet.y - g.y) < GULL.near);
      if (close) { this.latch = true; this.approaches++; this.scatter(); }
    } else if (d > GULL.far) this.latch = false;

    for (const g of this.gulls) {
      const vis = g.hx > v.x - 300 && g.hx < v.right + 300 && g.hy > v.y - 300 && g.hy < v.bottom + 300;
      if (!vis && g.phase === 'idle') { if (g.on) { g.on = false; g.img.setVisible(false); g.shadow.setVisible(false); } continue; }
      if (!g.on) { g.on = true; g.img.setVisible(true); g.shadow.setVisible(true); }
      let flap = false, rot = 0;
      if (g.phase === 'up') {
        g.t += dt / GULL.flyS;
        const e = Math.min(1, g.t), ease = 1 - (1 - e) * (1 - e);
        g.x = g.fromX + (g.toX - g.fromX) * ease; g.y = g.fromY + (g.toY - g.fromY) * ease;
        g.lift = 140 * ease; flap = true;
        if (g.t >= 1) { g.phase = 'away'; g.t = 0; }
      } else if (g.phase === 'away') {
        g.t += dt / GULL.awayS;
        g.x = g.toX + Math.sin(g.t * Math.PI * 2) * 40; g.lift = 140 + Math.sin(g.t * Math.PI * 4 + g.ph) * 10;
        flap = Math.sin(now * 10 + g.ph) > -0.2; rot = Math.sin(g.t * Math.PI * 2) * 0.1;
        if (g.t >= 1) { g.phase = 'back'; g.t = 0; g.fromX = g.x; g.fromY = g.y; g.img.setFlipX(g.hx < g.x); }
      } else if (g.phase === 'back') {
        g.t += dt / GULL.backS;
        const e = Math.min(1, g.t), ease = e * e * (3 - 2 * e);
        g.x = g.fromX + (g.hx - g.fromX) * ease; g.y = g.fromY + (g.hy - g.fromY) * ease;
        g.lift = 140 * (1 - ease); flap = e > 0.8 || Math.sin(now * 6 + g.ph) > 0.6; rot = 0.08;
        if (g.t >= 1) { g.phase = 'idle'; g.x = g.hx; g.y = g.hy; g.lift = 0; }
      } else {
        g.peck -= dt;
        if (g.peck < -0.35) g.peck = 1.5 + Math.random() * 2.5;
        rot = g.peck < 0 ? (g.img.flipX ? -0.35 : 0.35) : Math.sin(now * 2 + g.ph) * 0.04;
      }
      const bob = g.phase === 'idle' ? Math.abs(Math.sin(now * 2.4 + g.ph)) * 1.5 : 0;
      g.img.setTexture(flap ? 'gull_flap' : 'gull').setPosition(g.x, g.y - g.lift - bob).setRotation(rot)
        .setDepth(g.lift > 20 ? 9150 : g.y);
      g.shadow.setPosition(g.x, g.y).setScale(1 - Math.min(0.6, g.lift / 300)).setAlpha(1 - Math.min(0.7, g.lift / 220));
    }
  }

  stats() {
    return {
      taps: this.taps, flights: this.flights, approaches: this.approaches, shown: this.shown,
      flock: { x: this.cx, y: this.cy },
      list: this.gulls.map((g) => ({ x: Math.round(g.x), y: Math.round(g.y), hx: Math.round(g.hx), hy: Math.round(g.hy), phase: g.phase, on: g.on, visible: g.img.visible, lift: Math.round(g.lift) })),
    };
  }
}
