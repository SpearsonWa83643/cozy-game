// 89: Pinecone tumble. A handful of tappable pinecones rest on the Pinecone Hills slopes. Tap one
// and it tumbles/rolls downhill with soft knocks, then respawns after a few seconds. Culled
// off-screen. Shown in every theme.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { HUBS, PATH_HILLS } from './layout';
import type { WorldScene } from './scenes/World';

const TW = 40, TH = 44;
export const CONE = { size: 1.1, n: 5, tumbleMs: 1100, respawn: 3.2 };
type Cone = {
  img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse;
  x: number; y: number; homeX: number; homeY: number;
  base: number; on: boolean; tumble: number; wait: number; rot: number; vx: number; vy: number;
};

function coneTex(c: Ctx) {
  // Body scales.
  c.fillStyle = '#c48a4a'; c.strokeStyle = '#7a4a22'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(20, 4); c.bezierCurveTo(34, 10, 36, 30, 20, 40); c.bezierCurveTo(4, 30, 6, 10, 20, 4);
  c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#8a5530'; c.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const y = 10 + i * 5.5;
    c.beginPath(); c.moveTo(10, y); c.quadraticCurveTo(20, y + 3, 30, y); c.stroke();
  }
  // Tip highlight.
  c.fillStyle = 'rgba(255,230,180,0.45)';
  c.beginPath(); c.ellipse(18, 12, 5, 4, -0.3, 0, Math.PI * 2); c.fill();
}

export class Pinecones {
  cones: Cone[] = [];
  /** Test hooks. */
  taps = 0; tumbles = 0; shown = true;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('pcone')) {
      canvasTex(w, 'pcone', TW, TH, coneTex, S, true);
    }
    this.place();
  }

  private place() {
    const w = this.w;
    // Spread along the hills path slopes, a bit downhill of the trail.
    const spots: [number, number][] = [];
    const path = PATH_HILLS;
    for (let i = 1; i < path.length - 1 && spots.length < CONE.n; i++) {
      const [px, py] = path[i];
      // Offset south/downslope a bit.
      const ox = ((i % 2) ? 55 : -50) + (i * 7) % 30;
      const oy = 70 + (i % 3) * 25;
      const x = px + ox, y = py + oy;
      if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 90)) continue;
      spots.push([x, y]);
    }
    // Fallback around hub if path sampling was thin.
    while (spots.length < CONE.n) {
      const a = spots.length * 1.3;
      spots.push([HUBS.hills.x + Math.cos(a) * 160, HUBS.hills.y + 80 + Math.sin(a) * 90]);
    }
    spots.slice(0, CONE.n).forEach(([x, y], i) => {
      const base = CONE.size / (frameScale.pcone ?? S);
      const shadow = w.add.ellipse(x, y + 8, 22, 8, 0x3a2a1a, 0.2).setDepth(y - 2).setVisible(false);
      const img = w.add.image(x, y, 'pcone').setOrigin(0.5, 0.85).setScale(base).setDepth(y).setVisible(false);
      const c: Cone = {
        img, shadow, x, y, homeX: x, homeY: y, base, on: false,
        tumble: 0, wait: 0, rot: (i * 0.4) % 1, vx: 0, vy: 0,
      };
      this.cones.push(c);
      w.tappables.push({
        x: () => c.x, y: () => c.y - 10, r: 38,
        soft: true, enabled: () => c.on && c.tumble <= 0 && c.wait <= 0,
        tap: () => this.tap(c),
      });
    });
  }

  tap(c: Cone) {
    if (!c.on || c.tumble > 0 || c.wait > 0) return;
    this.taps++;
    this.tumbles++;
    c.tumble = 1;
    c.vx = 40 + Math.random() * 50;
    c.vy = 110 + Math.random() * 70;
    c.rot = 0;
    sfx.tock();
    sfx.rustle();
    this.w.burst(c.x, c.y - 8, 0xd4a574, 6, 'spark');
    if (this.w.life) this.w.life.reactions++;
  }

  update(dt: number) {
    const w = this.w, v = w.cameras.main.worldView;
    for (const c of this.cones) {
      // Respawn wait (hidden).
      if (c.wait > 0) {
        c.wait -= dt;
        if (c.wait <= 0) {
          c.x = c.homeX; c.y = c.homeY; c.rot = Math.random();
          c.img.setPosition(c.x, c.y).setRotation(c.rot).setAlpha(0).setVisible(true);
          c.shadow.setPosition(c.x, c.y + 8).setVisible(true).setAlpha(0);
          w.tweens.add({ targets: [c.img, c.shadow], alpha: 1, duration: 280 });
          c.on = true;
        }
        continue;
      }

      const vis = c.x > v.x - 80 && c.x < v.right + 80 && c.y > v.y - 80 && c.y < v.bottom + 80;
      if (c.tumble <= 0) {
        if (!vis) {
          if (c.on) { c.on = false; c.img.setVisible(false); c.shadow.setVisible(false); }
          continue;
        }
        if (!c.on) { c.on = true; c.img.setVisible(true); c.shadow.setVisible(true); }
        // Idle tiny wobble.
        c.img.setPosition(c.x, c.y).setRotation(c.rot + Math.sin(w.time.now / 900 + c.homeX) * 0.03)
          .setDepth(c.y);
        c.shadow.setPosition(c.x, c.y + 8).setDepth(c.y - 2);
        continue;
      }

      // Tumbling downhill.
      c.tumble -= dt * (1000 / CONE.tumbleMs);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 40 * dt;
      c.rot += dt * 8;
      const a = Math.max(0, Math.min(1, c.tumble));
      c.img.setPosition(c.x, c.y).setRotation(c.rot).setAlpha(0.4 + a * 0.6).setDepth(c.y);
      c.shadow.setPosition(c.x, c.y + 8).setAlpha(0.1 + a * 0.1);
      // Occasional knock mid-roll.
      if (Math.random() < dt * 2.2) sfx.tock();
      if (c.tumble <= 0) {
        c.tumble = 0;
        c.on = false;
        c.img.setVisible(false);
        c.shadow.setVisible(false);
        c.wait = CONE.respawn;
        sfx.plip();
      }
    }
  }

  stats() {
    return {
      taps: this.taps, tumbles: this.tumbles, shown: this.shown,
      list: this.cones.map((c) => ({
        x: Math.round(c.x), y: Math.round(c.y), homeX: Math.round(c.homeX), homeY: Math.round(c.homeY),
        on: c.on, tumbling: c.tumble > 0, waiting: c.wait > 0,
        tex: c.img.texture.key, visible: c.img.visible,
      })),
    };
  }
}
