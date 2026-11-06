// 88: Village birdbath. A small stone birdbath by the village path (near the bubble wand, not
// overlapping). 2–3 little birds splash and chirp when you approach or tap the bath; they fly a
// short hop and return. Hidden in snowy themes.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { VILLAGE_ENTRY, VILLAGE_SIGN } from './layout';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const BW = 72, BH = 56;
const BRDW = 36, BRDH = 32;
export const BATH = { size: 1.15, near: 160, far: 240, birds: 3 };
type Bird = {
  img: Phaser.GameObjects.Image; slot: number;
  x: number; y: number; homeX: number; homeY: number;
  ph: number; splash: number; hop: number; hopFrom: { x: number; y: number }; hopTo: { x: number; y: number };
  base: number; on: boolean;
};

function bathTex(c: Ctx) {
  // Pedestal.
  c.fillStyle = '#9aa3b0'; c.strokeStyle = '#5a6570'; c.lineWidth = 2.2;
  c.beginPath(); c.roundRect(28, 34, 16, 18, 3); c.fill(); c.stroke();
  // Basin.
  c.fillStyle = '#b8c0cc'; c.beginPath(); c.ellipse(36, 32, 28, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  // Water.
  c.fillStyle = 'rgba(140,200,230,0.75)';
  c.beginPath(); c.ellipse(36, 30, 22, 8, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.beginPath(); c.ellipse(28, 27, 8, 3, -0.3, 0, Math.PI * 2); c.fill();
  // Rim highlight.
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(36, 32, 27, 11, 0, -0.4, 2.2); c.stroke();
}

function birdTex(c: Ctx, tint: string) {
  // Body.
  c.fillStyle = tint; c.strokeStyle = '#3a3a3a'; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(18, 18, 10, 7, -0.2, 0, Math.PI * 2); c.fill(); c.stroke();
  // Head.
  c.beginPath(); c.arc(26, 12, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
  // Beak.
  c.fillStyle = '#f0a040'; c.beginPath(); c.moveTo(31, 12); c.lineTo(36, 13); c.lineTo(31, 15); c.closePath(); c.fill();
  // Eye.
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(27, 11, 1.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(27.4, 10.6, 0.5, 0, Math.PI * 2); c.fill();
  // Wing.
  c.fillStyle = tint; c.strokeStyle = '#3a3a3a';
  c.beginPath(); c.ellipse(14, 18, 6, 4, 0.4, 0, Math.PI * 2); c.fill(); c.stroke();
  // Tail.
  c.beginPath(); c.moveTo(8, 18); c.lineTo(2, 14); c.lineTo(4, 20); c.closePath(); c.fill(); c.stroke();
}

export class Birdbath {
  bath!: Phaser.GameObjects.Image;
  bathX = 0; bathY = 0;
  birds: Bird[] = [];
  /** Test hooks. */
  taps = 0; splashes = 0; approaches = 0; shown = true;
  private nearLatch = false;
  private cool = 0;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('birdbath')) {
      canvasTex(w, 'birdbath', BW, BH, bathTex, S, true);
      canvasTex(w, 'bbird0', BRDW, BRDH, (c) => birdTex(c, '#6eb5ff'), S, true);
      canvasTex(w, 'bbird1', BRDW, BRDH, (c) => birdTex(c, '#ff9a6e'), S, true);
      canvasTex(w, 'bbird2', BRDW, BRDH, (c) => birdTex(c, '#9ad86a'), S, true);
    }
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private place() {
    const w = this.w;
    // West of the bubble wand / village entry — keep clear of wand candidates.
    const candidates: [number, number][] = [
      [VILLAGE_ENTRY.x - 90, VILLAGE_ENTRY.y - 20],
      [VILLAGE_ENTRY.x - 130, VILLAGE_ENTRY.y + 30],
      [VILLAGE_SIGN.x - 40, VILLAGE_SIGN.y + 70],
      [VILLAGE_ENTRY.x - 60, VILLAGE_ENTRY.y + 60],
    ];
    let x = candidates[0][0], y = candidates[0][1];
    for (const [cx, cy] of candidates) {
      const [c, r] = w.nav.cellOf(cx, cy);
      if (!w.nav.isBlocked(c, r) && !w.interactables.some((it) => Math.hypot(it.x - cx, it.y - cy) < 90)) {
        x = cx; y = cy; break;
      }
    }
    this.bathX = x; this.bathY = y;
    this.bath = w.add.image(x, y, 'birdbath').setOrigin(0.5, 0.85)
      .setScale(BATH.size / (frameScale.birdbath ?? S)).setDepth(y);
    const offsets: [number, number][] = [[-14, -18], [12, -20], [0, -10]];
    for (let i = 0; i < BATH.birds; i++) {
      const [ox, oy] = offsets[i];
      const hx = x + ox, hy = y + oy;
      const base = 0.95 / (frameScale[`bbird${i}`] ?? S);
      const img = w.add.image(hx, hy, `bbird${i}`).setOrigin(0.5, 0.9).setScale(base).setDepth(hy + 1);
      const b: Bird = {
        img, slot: i, x: hx, y: hy, homeX: hx, homeY: hy,
        ph: i * 1.9, splash: 0, hop: 0, hopFrom: { x: hx, y: hy }, hopTo: { x: hx, y: hy },
        base, on: true,
      };
      this.birds.push(b);
    }
    w.tappables.push({
      x: () => this.bathX, y: () => this.bathY - 20, r: 48,
      enabled: () => this.shown && this.bath.visible,
      tap: () => this.tap(),
    });
  }

  tap() {
    if (!this.shown) return;
    this.taps++;
    this.splashAll(true);
  }

  private splashAll(fromTap: boolean) {
    // Cool only gates auto-approach so kids can keep tapping the bath.
    this.cool = fromTap ? 0.35 : 1.4;
    this.splashes++;
    if (!fromTap) this.approaches++;
    sfx.splash(false);
    sfx.ambience('birds');
    this.w.burst(this.bathX, this.bathY - 22, 0xbfe8ff, 8, 'spark');
    for (const b of this.birds) {
      if (b.hop > 0) continue;
      const a = (b.slot * 2.1) + Math.random() * 0.6;
      const dist = 55 + Math.random() * 35;
      b.hopFrom = { x: b.x, y: b.y };
      b.hopTo = { x: this.bathX + Math.cos(a) * dist, y: this.bathY - 30 + Math.sin(a) * dist * 0.55 };
      b.hop = 1;
      b.splash = 0.5;
    }
    if (this.w.life) this.w.life.reactions++;
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    this.bath.setVisible(this.shown);
    for (const b of this.birds) {
      b.on = this.shown;
      b.img.setVisible(this.shown);
    }
  }

  update(dt: number) {
    if (this.cool > 0) this.cool -= dt;
    if (!this.shown) return;
    const w = this.w, fx = w.feet.x, fy = w.feet.y, now = w.time.now / 1000;
    const d = Math.hypot(fx - this.bathX, fy - this.bathY);
    if (d < BATH.near && !this.nearLatch && this.cool <= 0) {
      this.nearLatch = true;
      this.splashAll(false);
    } else if (d > BATH.far) {
      this.nearLatch = false;
    }

    for (const b of this.birds) {
      if (b.hop > 0) {
        b.hop -= dt * 1.6;
        const t = Math.max(0, Math.min(1, 1 - b.hop));
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        b.x = b.hopFrom.x + (b.hopTo.x - b.hopFrom.x) * ease;
        b.y = b.hopFrom.y + (b.hopTo.y - b.hopFrom.y) * ease;
        const lift = Math.sin(t * Math.PI) * 40;
        b.img.setPosition(b.x, b.y - lift).setRotation(Math.sin(t * Math.PI) * 0.35)
          .setScale(b.base * (t < 0.5 ? 1.05 : 0.95)).setDepth(b.y + 2);
        if (b.hop <= 0) {
          // Glide home.
          b.hopFrom = { x: b.x, y: b.y };
          b.hopTo = { x: b.homeX, y: b.homeY };
          // Second half: return — reuse hop as negative marker via splash timer.
          b.splash = 1.4; // return delay
          b.hop = 0;
          b.img.setRotation(0);
        }
        continue;
      }
      if (b.splash > 0) {
        b.splash -= dt;
        if (b.splash <= 0 && (Math.hypot(b.x - b.homeX, b.y - b.homeY) > 4)) {
          // Start return hop.
          b.hopFrom = { x: b.x, y: b.y };
          b.hopTo = { x: b.homeX, y: b.homeY };
          b.hop = 1;
          continue;
        }
      }
      // Idle perch bob.
      const bob = Math.sin(now * 3.2 + b.ph) * 1.4;
      b.x = b.homeX; b.y = b.homeY;
      b.img.setPosition(b.x, b.y + bob).setRotation(Math.sin(now * 2 + b.ph) * 0.05)
        .setScale(b.base).setDepth(b.y + 2);
    }
  }

  stats() {
    return {
      taps: this.taps, splashes: this.splashes, approaches: this.approaches, shown: this.shown,
      bath: { x: Math.round(this.bathX), y: Math.round(this.bathY), visible: this.bath.visible },
      list: this.birds.map((b) => ({
        x: Math.round(b.x), y: Math.round(b.y), on: b.on, hopping: b.hop > 0,
        tex: b.img.texture.key, visible: b.img.visible,
      })),
    };
  }
}
