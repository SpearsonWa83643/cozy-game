// 94: Meadow bunnies. A few soft bunnies sit just off the Sunflower Meadow path (below the
// dragonflies). They nibble and do little hops; walk up and they hop away to a safe spot, then
// hop back home when you're far. Tap one for a happy hop. Culled off-screen. Hidden in snowy themes.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { PATH_MEADOW } from './layout';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const TW = 44, TH = 44;
export const BUN = { size: 1.05, n: 4, near: 130, far: 320, hopS: 0.42, flee: 130 };
const FURS = ['#f4ece0', '#d8b894', '#c8c0c8', '#f0d8c8'];
type Bun = {
  img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse;
  hx: number; hy: number; x: number; y: number; fromX: number; fromY: number; toX: number; toY: number;
  hop: number; hops: number; away: boolean; nib: number; ph: number; base: number; on: boolean; fur: number;
};

function bunTex(c: Ctx, fur: string) {
  c.fillStyle = fur; c.strokeStyle = '#6a5a50'; c.lineWidth = 1.6;
  // Ears.
  for (const [x, r] of [[25, -0.15], [32, 0.2]] as const) {
    c.save(); c.translate(x, 14); c.rotate(r);
    c.beginPath(); c.ellipse(0, -6, 3.6, 9, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#ffb8c8'; c.beginPath(); c.ellipse(0, -6, 1.6, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = fur; c.restore();
  }
  // Body.
  c.beginPath(); c.ellipse(20, 32, 13, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  // Tail.
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(8, 30, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
  // Head.
  c.fillStyle = fur; c.beginPath(); c.arc(30, 24, 8, 0, Math.PI * 2); c.fill(); c.stroke();
  // Face.
  c.fillStyle = '#2a1a1a'; c.beginPath(); c.arc(32.5, 22.5, 1.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(33, 22, 0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ff8aa0'; c.beginPath(); c.arc(37.5, 25.5, 1.4, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,140,160,0.45)'; c.beginPath(); c.arc(31, 28, 2.2, 0, Math.PI * 2); c.fill();
  // Front paw.
  c.fillStyle = fur; c.beginPath(); c.ellipse(28, 40, 4, 2.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
}

export class Bunnies {
  buns: Bun[] = [];
  /** Test hooks. */
  taps = 0; flees = 0; returns = 0; shown = true;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('bunny0')) FURS.forEach((f, i) => canvasTex(w, `bunny${i}`, TW, TH, (c) => bunTex(c, f), S, true));
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private free(x: number, y: number) { const [c, r] = this.w.nav.cellOf(x, y); return !this.w.nav.isBlocked(c, r); }

  private place() {
    const w = this.w, path = PATH_MEADOW;
    const busy = [...w.interactables.map((it) => [it.x, it.y]), ...w.tappables.map((t) => [t.x(), t.y()])];
    const homes: [number, number][] = [];
    // Midpoints between path points, a little south of the path (dragonflies hover north of it).
    for (let i = 0; i < path.length - 1 && homes.length < BUN.n; i++) {
      const seg = (i * 3 + 1) % (path.length - 1);
      const [ax, ay] = path[seg], [bx, by] = path[seg + 1];
      const tries: [number, number][] = [];
      for (const dy of [80, 100, 120, 60, 150, 180]) for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) tries.push([t, dy]);
      for (const [t, dy] of tries) {
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t + dy;
        if (!this.free(x, y) || !busy.every(([qx, qy]) => Math.hypot(qx - x, qy - y) > 80)) continue;
        if (homes.some(([hx, hy]) => Math.hypot(hx - x, hy - y) < 260)) continue;
        homes.push([x, y]); break;
      }
    }
    homes.forEach(([x, y], i) => {
      const key = `bunny${i % FURS.length}`;
      const base = BUN.size / (frameScale[key] ?? S);
      const shadow = w.add.ellipse(x, y, 30, 8, 0x2a3a1a, 0.18).setDepth(y - 2).setVisible(false);
      const img = w.add.image(x, y, key).setOrigin(0.5, 0.95).setScale(base).setFlipX(i % 2 === 1).setDepth(y).setVisible(false);
      const b: Bun = { img, shadow, hx: x, hy: y, x, y, fromX: x, fromY: y, toX: x, toY: y, hop: 0, hops: 0, away: false, nib: i * 0.8, ph: i * 1.3, base, on: false, fur: i };
      this.buns.push(b);
      w.tappables.push({ x: () => b.x, y: () => b.y - 20, r: 40, soft: true, enabled: () => b.on && b.hop <= 0, tap: () => this.tap(b) });
    });
  }

  tap(b: Bun) {
    if (!this.shown || b.hop > 0) return;
    this.taps++;
    this.startHop(b, b.x, b.y, 1, 1.6);
    sfx.giggleSoft(1.8);
    this.w.burst(b.x, b.y - 30, 0xffc0d8, 6, 'spark');
    if (this.w.life) this.w.life.reactions++;
  }

  private startHop(b: Bun, tx: number, ty: number, hops: number, height = 1) {
    b.fromX = b.x; b.fromY = b.y; b.toX = tx; b.toY = ty; b.hops = hops; b.hop = hops;
    (b as any).h = height;
    if (Math.abs(tx - b.x) > 2) b.img.setFlipX(tx < b.x);
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    if (!this.shown) for (const b of this.buns) { b.on = false; b.img.setVisible(false); b.shadow.setVisible(false); }
  }

  update(dt: number) {
    if (!this.shown) return;
    const w = this.w, v = w.cameras.main.worldView, fx = w.feet.x, fy = w.feet.y, now = w.time.now / 1000;
    for (const b of this.buns) {
      const vis = b.x > v.x - 100 && b.x < v.right + 100 && b.y > v.y - 60 && b.y - 60 < v.bottom + 60;
      if (!vis && b.hop <= 0) {
        if (b.on) { b.on = false; b.img.setVisible(false); b.shadow.setVisible(false); }
        // Off-screen and away: quietly go home.
        if (b.away && Math.hypot(fx - b.hx, fy - b.hy) > BUN.far) { b.away = false; b.x = b.hx; b.y = b.hy; this.returns++; }
        continue;
      }
      if (!b.on) { b.on = true; b.img.setVisible(true); b.shadow.setVisible(true); }
      const d = Math.hypot(fx - b.x, fy - b.y);
      if (b.hop <= 0) {
        if (d < BUN.near) {
          // Hop away from you (three quick hops), to an open spot.
          let ax = b.x - fx, ay = b.y - fy; const n = Math.hypot(ax, ay) || 1; ax /= n; ay /= n;
          let tx = b.x + ax * BUN.flee, ty = b.y + ay * BUN.flee * 0.7;
          for (let k = 0; k < 6 && !this.free(tx, ty); k++) {
            const r = (k + 1) * 0.5 * (k % 2 ? -1 : 1);
            tx = b.x + (ax * Math.cos(r) - ay * Math.sin(r)) * BUN.flee; ty = b.y + (ax * Math.sin(r) + ay * Math.cos(r)) * BUN.flee * 0.7;
          }
          if (this.free(tx, ty)) { this.flees++; b.away = true; this.startHop(b, tx, ty, 3); sfx.tiptoe(); }
        } else if (b.away && Math.hypot(fx - b.hx, fy - b.hy) > BUN.far) {
          b.away = false; this.returns++;
          this.startHop(b, b.hx, b.hy, 3);
        }
      }
      let lift = 0, sx = 1, sy = 1;
      if (b.hop > 0) {
        b.hop = Math.max(0, b.hop - dt / BUN.hopS);
        const done = b.hops - b.hop, p = done / b.hops;
        b.x = b.fromX + (b.toX - b.fromX) * p; b.y = b.fromY + (b.toY - b.fromY) * p;
        const f = done % 1;
        lift = Math.sin(f * Math.PI) * 18 * ((b as any).h ?? 1);
        sy = 1 + Math.sin(f * Math.PI) * 0.1; sx = 1 - Math.sin(f * Math.PI) * 0.06;
        if (b.hop <= 0) { b.x = b.toX; b.y = b.toY; }
      } else {
        // Nibble: quick little head-dips (squash), then a pause.
        b.nib -= dt;
        if (b.nib < -0.8) b.nib = 1.8 + Math.random() * 2.5;
        if (b.nib < 0) { const q = Math.abs(Math.sin(now * 16)) * 0.06; sy = 1 - q; sx = 1 + q * 0.5; }
        else sy = 1 + Math.sin(now * 2 + b.ph) * 0.015;
      }
      b.img.setPosition(b.x, b.y - lift).setScale(b.base * sx, b.base * sy).setDepth(b.y);
      b.shadow.setPosition(b.x, b.y).setScale(1 - lift / 60);
    }
  }

  stats() {
    return {
      taps: this.taps, flees: this.flees, returns: this.returns, shown: this.shown,
      list: this.buns.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), hx: Math.round(b.hx), hy: Math.round(b.hy), away: b.away, hopping: b.hop > 0, on: b.on, visible: b.img.visible })),
    };
  }
}
