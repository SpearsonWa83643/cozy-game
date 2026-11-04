// 80: Sky rings for flying friends. While you ride, a trail of five glowing star rings floats
// ahead of you. Fly through one for a chime and sparkles ("2 of 5!"); all five gives a happy
// cheer and confetti, then a fresh trail appears ahead a little later. Rings are a fixed pool
// (back half drawn behind the mount, front half in front, so you really fly through them).
// No steering skill needed: a ring gently pulls you in when you're close, and rings left far
// behind come back ahead of you. Visual and sound only.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { WORLD_W, WORLD_H } from './layout';
import type { WorldScene } from './scenes/World';

const N = 5;
const TW = 120, TH = 96;
/** Hit radius (drawn px, around the mount body), magnet radius, spacing ahead, respawn delay. */
export const RINGS = { hit: 62, magnet: 150, pull: 90, gap: 230, first: 260, again: 4.5, lost: 1300, size: 1 };
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
type Ring = { back: Phaser.GameObjects.Image; front: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; x: number; y: number; on: boolean; got: boolean; pop: number; ph: number };

function ring(c: Ctx, half: 'back' | 'front' | 'glow') {
  const cx = TW / 2, cy = TH / 2, rx = 44, ry = 38;
  if (half === 'glow') {
    const g = c.createRadialGradient(cx, cy, 10, cx, cy, 56);
    g.addColorStop(0, 'rgba(255,240,170,0)'); g.addColorStop(0.62, 'rgba(255,230,140,0.35)'); g.addColorStop(1, 'rgba(255,220,120,0)');
    c.fillStyle = g; c.fillRect(0, 0, TW, TH); return;
  }
  const a0 = half === 'back' ? Math.PI : 0, a1 = half === 'back' ? Math.PI * 2 : Math.PI;
  c.lineCap = 'round';
  c.strokeStyle = '#b87a16'; c.lineWidth = 13; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, a0, a1); c.stroke();
  c.strokeStyle = '#ffd34d'; c.lineWidth = 9; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, a0, a1); c.stroke();
  c.strokeStyle = 'rgba(255,255,230,0.9)'; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, cy - 2, rx - 1, ry - 1, 0, a0 + 0.25, a1 - 0.25); c.stroke();
  if (half === 'back') {
    // A little star on top.
    const sx = cx, sy = cy - ry - 2;
    c.fillStyle = '#fff3a8'; c.strokeStyle = '#c98a1c'; c.lineWidth = 2;
    c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 10, t = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(sx + Math.cos(t) * r, sy + Math.sin(t) * r); } c.closePath(); c.fill(); c.stroke();
  }
}

export class SkyRings {
  rings: Ring[] = [];
  /** Test hooks. */
  got = 0; sets = 0; spawns = 0; total = 0;
  private wait = 0; private was = false;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('skyring_b')) {
      canvasTex(w, 'skyring_b', TW, TH, (c) => ring(c, 'back'), S, true);
      canvasTex(w, 'skyring_f', TW, TH, (c) => ring(c, 'front'), S, true);
      canvasTex(w, 'skyring_g', TW, TH, (c) => ring(c, 'glow'), S, true);
    }
    const sc = RINGS.size / (frameScale.skyring_b ?? S);
    for (let i = 0; i < N; i++) {
      const glow = w.add.image(0, 0, 'skyring_g').setScale(sc).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
      const back = w.add.image(0, 0, 'skyring_b').setScale(sc).setVisible(false);
      const front = w.add.image(0, 0, 'skyring_f').setScale(sc).setVisible(false);
      this.rings.push({ back, front, glow, x: 0, y: 0, on: false, got: false, pop: 0, ph: i * 1.3 });
    }
  }

  get flying() { const p = this.w.mount?.phase; return p === 'ride'; }
  get left() { return this.rings.filter((r) => r.on && !r.got).length; }

  /** Lay a fresh gentle wave of rings ahead of the mount (drawn positions, at its height). */
  spawn() {
    const m = this.w.mount; let h = m.heading;
    if (!Number.isFinite(h)) h = 0;
    const ux = Math.cos(h), uy = Math.sin(h) * 0.7, len = Math.hypot(ux, uy) || 1, dx = ux / len, dy = uy / len;
    const side = Math.random() < 0.5 ? 1 : -1;
    this.got = 0; this.spawns++;
    this.rings.forEach((r, i) => {
      const d = RINGS.first + i * RINGS.gap, wob = Math.sin(i * 1.2) * 80 * side;
      let x = m.ex + dx * d - dy * wob, y = m.ey + dy * d + dx * wob;
      x = Phaser.Math.Clamp(x, 160, WORLD_W - 160); y = Phaser.Math.Clamp(y, 160, WORLD_H - 160);
      Object.assign(r, { x, y, on: true, got: false, pop: 0 });
      for (const o of [r.back, r.front, r.glow]) o.setVisible(true).setAlpha(0);
      this.w.tweens.add({ targets: [r.back, r.front, r.glow], alpha: 1, duration: 400, delay: i * 120 });
    });
  }

  hideAll() { for (const r of this.rings) { r.on = false; for (const o of [r.back, r.front, r.glow]) o.setVisible(false); } }

  private take(r: Ring) {
    r.got = true; r.pop = 1; this.got++; this.total++;
    const w = this.w;
    w.burst(r.x, r.y, 0xffe08a, 14, 'spark');
    sfx.bell(1046.5 + this.got * 130, 0, 0.12, 1.2); sfx.bell(1568 + this.got * 160, 0.06, 0.08, 1);
    if (this.got >= N) {
      this.sets++;
      w.floatText(r.x, r.y - 50, 'All 5! Hooray!', '#ffe08a');
      sfx.sparkle(); sfx.mountHappy(w.mount.def.id);
      const colors = [0xff7a9c, 0xffd34d, 0x7fd0ff, 0x8fe07a, 0xc59bff];
      colors.forEach((c, i) => w.time.delayedCall(i * 90, () => w.burst(w.mount.ex + (i - 2) * 30, w.mount.ey - 20, c, 10, 'spark')));
      this.wait = RINGS.again;
    } else w.floatText(r.x, r.y - 50, `${this.got} of ${N}!`, '#fff3c2');
  }

  update(dt: number) {
    const fly = this.flying;
    if (!fly) { if (this.was) { this.hideAll(); this.was = false; } return; }
    const m = this.w.mount;
    if (!this.was) { this.was = true; this.wait = 1.2; }
    if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0) this.spawn(); }
    const now = this.w.time.now / 1000, rm = reduceMotion();
    let nearest = Infinity;
    for (const r of this.rings) {
      if (!r.on) continue;
      if (r.got) {
        r.pop -= dt * 2.2;
        const s = 1 + (1 - Math.max(0, r.pop)) * 0.6, a = Math.max(0, r.pop);
        for (const o of [r.back, r.front, r.glow]) o.setAlpha(a).setScale(s * RINGS.size / (frameScale.skyring_b ?? S));
        if (r.pop <= 0) { r.on = false; for (const o of [r.back, r.front, r.glow]) o.setVisible(false); }
      } else {
        const d = Math.hypot(m.ex - r.x, m.ey - r.y);
        nearest = Math.min(nearest, d);
        // Gentle magnet so little hands don't have to aim exactly.
        if (d < RINGS.magnet && d > 1) { const k = Math.min(1, RINGS.pull * dt / d); r.x += (m.ex - r.x) * k; r.y += (m.ey - r.y) * k; }
        if (Math.hypot(m.ex - r.x, m.ey - r.y) < RINGS.hit) this.take(r);
      }
      const bob = rm ? 0 : Math.sin(now * 2 + r.ph) * 5, sp = rm ? 0 : Math.sin(now * 1.4 + r.ph) * 0.05;
      r.glow.setPosition(r.x, r.y + bob).setDepth(9280);
      r.back.setPosition(r.x, r.y + bob).setRotation(sp).setDepth(9290);
      r.front.setPosition(r.x, r.y + bob).setRotation(sp).setDepth(9320);
    }
    // Rings left far behind (or none left after a set): bring a fresh trail ahead.
    if (this.wait <= 0 && this.left > 0 && nearest > RINGS.lost) { this.hideAll(); this.wait = 0.6; }
    else if (this.wait <= 0 && this.left === 0 && !this.rings.some((r) => r.on)) this.wait = RINGS.again;
  }

  stats() {
    return {
      flying: this.flying, got: this.got, sets: this.sets, spawns: this.spawns, total: this.total, left: this.left, wait: +this.wait.toFixed(2),
      list: this.rings.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), on: r.on, got: r.got })),
    };
  }
}
