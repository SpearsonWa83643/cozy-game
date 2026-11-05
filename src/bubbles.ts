// 84: Village bubble wand. A soap-bubble wand stands by the village path. Tap it to blow a short
// burst of floating iridescent bubbles; tap or walk into a bubble to pop it with a soft chime and
// tiny sparkles. Bubbles drift and fade. One wand, limited concurrent bubbles. Hidden only in snow
// if art would clash — we hide in snowy themes to match other meadow props.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { VILLAGE_ENTRY, VILLAGE_SIGN } from './layout';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const TW = 48, TH = 90;
export const BUB = { max: 10, burst: 5, life: 5.5, popR: 28, walkR: 26, size: 1.15 };
type Bubble = {
  img: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number;
  life: number; r: number; base: number; ph: number; alive: boolean;
};

function wand(c: Ctx) {
  // Stick.
  c.strokeStyle = '#8b5a2b'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(24, 86); c.lineTo(24, 28); c.stroke();
  // Wand ring.
  c.strokeStyle = '#c9a26a'; c.lineWidth = 3.5;
  c.beginPath(); c.arc(24, 18, 12, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = 'rgba(180,220,255,0.55)'; c.lineWidth = 2;
  c.beginPath(); c.arc(24, 18, 8, 0.2, Math.PI * 1.6); c.stroke();
  // Soft soap film highlight.
  c.strokeStyle = 'rgba(255,180,220,0.5)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(24, 18, 8, Math.PI * 1.1, Math.PI * 1.7); c.stroke();
  // Grip ribbon.
  c.fillStyle = '#ff8ec8'; c.beginPath(); c.roundRect(18, 50, 12, 10, 3); c.fill();
}

function bubbleTex(c: Ctx) {
  const cx = 32, cy = 32, r = 26;
  const g = c.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.35, 'rgba(200,240,255,0.28)');
  g.addColorStop(0.7, 'rgba(255,180,220,0.22)');
  g.addColorStop(1, 'rgba(160,220,255,0.08)');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2.2;
  c.beginPath(); c.arc(cx, cy, r - 1, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = 'rgba(180,255,220,0.55)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(cx, cy, r - 3, 0.4, 2.2); c.stroke();
  c.strokeStyle = 'rgba(255,160,200,0.45)'; c.beginPath(); c.arc(cx, cy, r - 3, 3.2, 5.0); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(cx - 8, cy - 10, 5, 3, -0.5, 0, Math.PI * 2); c.fill();
}

export class Bubbles {
  wand!: Phaser.GameObjects.Image;
  wandX = 0; wandY = 0;
  pool: Bubble[] = [];
  /** Test hooks. */
  blows = 0; pops = 0; walkPops = 0; shown = true;
  private cool = 0;
  private lastX = 0; private lastY = 0;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('bwand')) {
      canvasTex(w, 'bwand', TW, TH, wand, S, true);
      canvasTex(w, 'bubble', 64, 64, bubbleTex, S, true);
    }
    this.place();
    for (let i = 0; i < BUB.max; i++) {
      const img = w.add.image(0, 0, 'bubble').setVisible(false).setDepth(9200).setBlendMode('ADD');
      this.pool.push({ img, x: 0, y: 0, vx: 0, vy: 0, life: 0, r: 18, base: 1, ph: i * 1.3, alive: false });
    }
    w.tappables.push({
      x: () => this.wandX, y: () => this.wandY - 40, r: 42,
      enabled: () => this.shown && this.wand.visible,
      tap: () => this.blow(),
    });
    // Bubbles themselves are popped in update (tap via soft hit or walk).
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
    this.lastX = w.feet.x; this.lastY = w.feet.y;
  }

  private place() {
    const w = this.w;
    // Just east of the village entry on the grass by the path.
    const candidates: [number, number][] = [
      [VILLAGE_ENTRY.x + 70, VILLAGE_ENTRY.y - 30],
      [VILLAGE_SIGN.x + 110, VILLAGE_SIGN.y + 40],
      [VILLAGE_ENTRY.x + 120, VILLAGE_ENTRY.y + 20],
      [VILLAGE_SIGN.x + 60, VILLAGE_SIGN.y + 90],
    ];
    let x = candidates[0][0], y = candidates[0][1];
    for (const [cx, cy] of candidates) {
      const [c, r] = w.nav.cellOf(cx, cy);
      if (!w.nav.isBlocked(c, r) && !w.interactables.some((it) => Math.hypot(it.x - cx, it.y - cy) < 90)) {
        x = cx; y = cy; break;
      }
    }
    this.wandX = x; this.wandY = y;
    this.wand = w.add.image(x, y, 'bwand').setOrigin(0.5, 1).setScale(BUB.size / (frameScale.bwand ?? S)).setDepth(y);
  }

  blow() {
    if (!this.shown || this.cool > 0) return;
    this.cool = 0.55;
    this.blows++;
    sfx.swish(); sfx.plip();
    this.w.burst(this.wandX, this.wandY - 70, 0xc8f0ff, 6, 'spark');
    let n = 0;
    for (const b of this.pool) {
      if (b.alive) continue;
      this.spawn(b, this.wandX + (Math.random() - 0.5) * 16, this.wandY - 70 - Math.random() * 10);
      n++;
      if (n >= BUB.burst) break;
    }
    // Soft wand wiggle.
    const sx = this.wand.scaleX, sy = this.wand.scaleY;
    this.w.tweens.add({ targets: this.wand, scaleX: sx * 1.08, scaleY: sy * 0.94, angle: -8, duration: 120, yoyo: true, onComplete: () => this.wand.setScale(sx, sy).setAngle(0) });
    if (this.w.life) this.w.life.reactions++;
  }

  private spawn(b: Bubble, x: number, y: number) {
    b.alive = true; b.x = x; b.y = y;
    b.vx = 18 + Math.random() * 28; b.vy = -22 - Math.random() * 30;
    b.life = BUB.life * (0.75 + Math.random() * 0.4);
    b.r = 14 + Math.random() * 12;
    b.base = (b.r / 26) / (frameScale.bubble ?? S);
    b.img.setVisible(true).setPosition(x, y).setScale(b.base * 0.3).setAlpha(0.95).setDepth(9200 + b.y * 0.001);
    this.w.tweens.add({ targets: b.img, scaleX: b.base, scaleY: b.base, duration: 280, ease: 'Back.easeOut' });
  }

  pop(b: Bubble, walked: boolean) {
    if (!b.alive) return;
    b.alive = false;
    this.pops++;
    if (walked) this.walkPops++;
    sfx.bell(1200 + Math.random() * 400, 0, 0.05, 0.7);
    sfx.plip();
    this.w.burst(b.x, b.y, 0xffe8f8, 7, 'spark');
    this.w.tweens.killTweensOf(b.img);
    this.w.tweens.add({
      targets: b.img, scaleX: b.base * 1.5, scaleY: b.base * 1.5, alpha: 0, duration: 160,
      onComplete: () => b.img.setVisible(false).setAlpha(1),
    });
    if (this.w.life) this.w.life.reactions++;
  }

  /** Test / soft: pop the nearest live bubble to (x,y), or any. */
  popAt(x?: number, y?: number) {
    let best: Bubble | null = null, bd = Infinity;
    for (const b of this.pool) {
      if (!b.alive) continue;
      const d = x == null ? 0 : Math.hypot(b.x - x, b.y - (y ?? 0));
      if (d < bd) { bd = d; best = b; }
    }
    if (best) this.pop(best, false);
    return !!best;
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    this.wand.setVisible(this.shown);
    if (!this.shown) for (const b of this.pool) if (b.alive) { b.alive = false; b.img.setVisible(false); }
  }

  update(dt: number) {
    if (this.cool > 0) this.cool -= dt;
    if (!this.shown) return;
    const w = this.w, fx = w.feet.x, fy = w.feet.y, now = w.time.now / 1000;
    const moving = Math.hypot(fx - this.lastX, fy - this.lastY) > 0.4;
    this.lastX = fx; this.lastY = fy;

    // Soft tap on a bubble: use pointer world via nearest tappable-like check in update
    // by registering ephemeral hits — walk-into handles most kid play; also check a tap
    // near a bubble when the hero is still (handled via a dedicated tappable per live bubble
    // would churn; instead scan on pointer via world tip). Simpler: each live bubble is
    // poppable by walking into it, and by calling popAt from a shared soft zone.
    for (const b of this.pool) {
      if (!b.alive) continue;
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vx *= Math.exp(-0.15 * dt); b.vy += -6 * dt; // gentle lift
      b.vy += Math.sin(now * 1.7 + b.ph) * 4 * dt;
      b.vx += Math.cos(now * 1.3 + b.ph) * 3 * dt;
      const fade = b.life < 1.2 ? Math.max(0, b.life / 1.2) : 1;
      b.img.setPosition(b.x, b.y).setAlpha(0.95 * fade)
        .setScale(b.base * (0.95 + Math.sin(now * 3 + b.ph) * 0.05))
        .setDepth(9200);
      if (b.life <= 0 || fade <= 0) { b.alive = false; b.img.setVisible(false); continue; }
      // Walk / ride into bubble.
      if (moving && Math.hypot(fx - b.x, fy - 20 - b.y) < BUB.walkR + b.r * 0.35) this.pop(b, true);
    }
  }

  /** Real touch helper used by tests and a lightweight tap scan from World (optional). */
  tryTap(wx: number, wy: number) {
    for (const b of this.pool) {
      if (!b.alive) continue;
      if (Math.hypot(b.x - wx, b.y - wy) < BUB.popR + b.r * 0.2) { this.pop(b, false); return true; }
    }
    return false;
  }

  stats() {
    return {
      blows: this.blows, pops: this.pops, walkPops: this.walkPops, shown: this.shown,
      wand: { x: Math.round(this.wandX), y: Math.round(this.wandY), visible: this.wand.visible },
      live: this.pool.filter((b) => b.alive).map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.r) })),
      alive: this.pool.filter((b) => b.alive).length,
    };
  }
}
