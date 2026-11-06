// 87: Glowcap fireflies. Soft glowing fireflies drift and blink around the Glowcap Grove fairy
// ring. Tap one for a bright flash, soft chime and sparkles — then it wanders off. Fixed pool of
// 6–7, culled off-screen. Shown in every theme (the grove is always lit). Kid-friendly, uncluttered.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { GROVE_RING } from './layout';
import type { WorldScene } from './scenes/World';

const TW = 40, TH = 40;
export const FFLY = { size: 1.05, flashMs: 380, n: 7 };
type Bug = {
  img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image;
  x: number; y: number; hx: number; hy: number; ph: number; sp: number;
  base: number; on: boolean; flash: number; cool: number;
};

function bugTex(c: Ctx, bright: boolean) {
  const cx = 20, cy = 20;
  // Soft outer glow.
  const g = c.createRadialGradient(cx, cy, 2, cx, cy, bright ? 18 : 14);
  g.addColorStop(0, bright ? 'rgba(255,255,200,0.95)' : 'rgba(220,255,140,0.75)');
  g.addColorStop(0.45, bright ? 'rgba(255,240,120,0.55)' : 'rgba(180,255,100,0.35)');
  g.addColorStop(1, 'rgba(140,220,80,0)');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, bright ? 18 : 14, 0, Math.PI * 2); c.fill();
  // Tiny body.
  c.fillStyle = bright ? '#fff8c8' : '#d8ff8a';
  c.beginPath(); c.ellipse(cx, cy, 4.5, 3.2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.beginPath(); c.arc(cx - 1.5, cy - 1.2, 1.4, 0, Math.PI * 2); c.fill();
}

export class Fireflies {
  bugs: Bug[] = [];
  /** Test hooks. */
  taps = 0; flashes = 0; shown = true;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('gfly')) {
      canvasTex(w, 'gfly', TW, TH, (c) => bugTex(c, false), S, true);
      canvasTex(w, 'gfly_flash', TW, TH, (c) => bugTex(c, true), S, true);
    }
    this.place();
  }

  private place() {
    const w = this.w;
    const n = FFLY.n;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      const r = GROVE_RING.r * (0.35 + (i % 3) * 0.22);
      const hx = GROVE_RING.x + Math.cos(a) * r;
      const hy = GROVE_RING.y + Math.sin(a) * r * 0.72;
      const base = FFLY.size / (frameScale.gfly ?? S);
      const glow = w.add.image(hx, hy, 'gfly').setBlendMode('ADD').setScale(base * 1.6).setAlpha(0.35).setDepth(8150).setVisible(false);
      const img = w.add.image(hx, hy, 'gfly').setBlendMode('ADD').setScale(base).setDepth(8160).setVisible(false);
      const b: Bug = {
        img, glow, x: hx, y: hy, hx, hy, ph: i * 1.4, sp: 0.55 + (i % 4) * 0.12,
        base, on: false, flash: 0, cool: 0,
      };
      this.bugs.push(b);
      w.tappables.push({
        x: () => b.x, y: () => b.y, r: 36,
        soft: true, enabled: () => b.on && b.cool <= 0,
        tap: () => this.tap(b),
      });
    }
  }

  tap(b: Bug) {
    if (!b.on || b.cool > 0) return;
    this.taps++;
    this.flashes++;
    b.flash = 1;
    b.cool = 1.8;
    // Wander home a bit farther so it drifts off after the flash.
    const a = Math.random() * Math.PI * 2;
    b.hx += Math.cos(a) * 90;
    b.hy += Math.sin(a) * 60;
    // Keep loosely near the ring.
    const dx = b.hx - GROVE_RING.x, dy = b.hy - GROVE_RING.y;
    const d = Math.hypot(dx, dy);
    if (d > GROVE_RING.r * 1.35) {
      b.hx = GROVE_RING.x + (dx / d) * GROVE_RING.r * 1.1;
      b.hy = GROVE_RING.y + (dy / d) * GROVE_RING.r * 0.85;
    }
    sfx.bell(1760 + Math.random() * 400, 0, 0.06, 0.9);
    sfx.sparkle();
    this.w.burst(b.x, b.y, 0xfff0a0, 10, 'spark');
    if (this.w.life) this.w.life.reactions++;
  }

  update(dt: number) {
    const w = this.w, v = w.cameras.main.worldView, now = w.time.now / 1000;
    for (const b of this.bugs) {
      const vis = b.hx > v.x - 100 && b.hx < v.right + 100 && b.hy > v.y - 100 && b.hy < v.bottom + 100;
      if (!vis) {
        if (b.on) { b.on = false; b.img.setVisible(false); b.glow.setVisible(false); }
        // Still drift a little so homes stay fresh.
        b.ph += dt * b.sp;
        continue;
      }
      if (!b.on) { b.on = true; b.img.setVisible(true); b.glow.setVisible(true); }
      if (b.cool > 0) b.cool -= dt;
      if (b.flash > 0) b.flash -= dt * (1000 / FFLY.flashMs);

      b.ph += dt * b.sp;
      b.x = b.hx + Math.sin(b.ph * 1.4) * 55 + Math.sin(b.ph * 2.7) * 12;
      b.y = b.hy + Math.cos(b.ph * 1.1) * 32 - Math.abs(Math.sin(b.ph * 0.6)) * 18;
      const blink = Math.max(0, Math.sin(b.ph * 2.4 + b.sp));
      const flashing = b.flash > 0;
      const key = flashing ? 'gfly_flash' : 'gfly';
      if (b.img.texture.key !== key) b.img.setTexture(key);
      const glowA = flashing ? 0.95 : 0.25 + blink * 0.55;
      const sc = flashing ? b.base * 1.55 : b.base * (0.85 + blink * 0.4);
      b.img.setPosition(b.x, b.y).setAlpha(0.55 + blink * 0.45).setScale(sc).setDepth(8160);
      b.glow.setPosition(b.x, b.y).setAlpha(glowA * 0.5).setScale(sc * 1.8).setDepth(8150);
      // Soft idle bob for depth sorting feel.
      void now;
    }
  }

  stats() {
    return {
      taps: this.taps, flashes: this.flashes, shown: this.shown,
      list: this.bugs.map((b) => ({
        x: Math.round(b.x), y: Math.round(b.y), on: b.on, flash: b.flash > 0,
        cool: b.cool > 0, tex: b.img.texture.key, visible: b.img.visible,
      })),
    };
  }
}
