// 90: Meadow dragonflies. A few colorful dragonflies zip along the Sunflower Meadow paths. Idle
// hover + dart; tap one for a loop-de-loop and a soft wing chime. Culled off-screen. Hidden in
// snowy themes.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { HUBS, PATH_MEADOW } from './layout';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const TW = 56, TH = 40;
export const DFLY = { size: 1.05, n: 4, loopMs: 700 };
type Fly = {
  img: Phaser.GameObjects.Image;
  x: number; y: number; hx: number; hy: number;
  ph: number; sp: number; base: number; tintI: number;
  on: boolean; loop: number; dart: number; cool: number;
  pathI: number;
};

const TINTS = ['#5ad0ff', '#ff7ab0', '#a0e060', '#ffc04a'];

function flyTex(c: Ctx, body: string) {
  // Wings (four, translucent).
  c.fillStyle = 'rgba(220,245,255,0.55)'; c.strokeStyle = 'rgba(120,180,200,0.6)'; c.lineWidth = 1.2;
  for (const [ox, oy, rot] of [[18, 12, -0.4], [18, 20, 0.35], [30, 12, 0.4], [30, 20, -0.35]] as const) {
    c.save();
    c.translate(ox, oy); c.rotate(rot);
    c.beginPath(); c.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
  }
  // Body.
  c.fillStyle = body; c.strokeStyle = '#2a4a3a'; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(28, 20, 14, 4.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  // Segments.
  c.strokeStyle = 'rgba(40,70,50,0.45)'; c.lineWidth = 1;
  for (const x of [22, 28, 34]) { c.beginPath(); c.moveTo(x, 16); c.lineTo(x, 24); c.stroke(); }
  // Head + eyes.
  c.fillStyle = body;
  c.beginPath(); c.arc(40, 20, 5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#1a2a20';
  c.beginPath(); c.arc(42, 18, 1.6, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(42, 22, 1.6, 0, Math.PI * 2); c.fill();
  // Highlight.
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.beginPath(); c.ellipse(24, 17, 4, 1.5, -0.2, 0, Math.PI * 2); c.fill();
}

export class Dragonflies {
  flies: Fly[] = [];
  /** Test hooks. */
  taps = 0; loops = 0; shown = true;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('dfly0')) {
      TINTS.forEach((t, i) => canvasTex(w, `dfly${i}`, TW, TH, (c) => flyTex(c, t), S, true));
    }
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private place() {
    const w = this.w;
    const path = PATH_MEADOW;
    for (let i = 0; i < DFLY.n; i++) {
      const pi = 1 + i * Math.floor((path.length - 2) / DFLY.n);
      const [px, py] = path[Math.min(pi, path.length - 1)];
      const hx = px + ((i % 2) ? 40 : -30);
      const hy = py - 40 - (i % 3) * 18;
      const tintI = i % TINTS.length;
      const base = DFLY.size / (frameScale[`dfly${tintI}`] ?? S);
      const img = w.add.image(hx, hy, `dfly${tintI}`).setOrigin(0.5, 0.5).setScale(base)
        .setDepth(9200).setVisible(false);
      const f: Fly = {
        img, x: hx, y: hy, hx, hy, ph: i * 1.7, sp: 0.7 + i * 0.15,
        base, tintI, on: false, loop: 0, dart: 1.5 + i * 0.8, cool: 0, pathI: pi,
      };
      this.flies.push(f);
      w.tappables.push({
        x: () => f.x, y: () => f.y, r: 40,
        soft: true, enabled: () => f.on && this.shown && f.cool <= 0,
        tap: () => this.tap(f),
      });
    }
  }

  tap(f: Fly) {
    if (!this.shown || !f.on || f.cool > 0 || f.loop > 0) return;
    this.taps++;
    this.loops++;
    f.loop = 1;
    f.cool = 1.5;
    f.dart = 2 + Math.random();
    sfx.bell(2093 + Math.random() * 300, 0, 0.05, 0.7);
    sfx.swish();
    this.w.burst(f.x, f.y, 0xc8f0ff, 8, 'spark');
    if (this.w.life) this.w.life.reactions++;
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    if (!this.shown) {
      for (const f of this.flies) { f.on = false; f.img.setVisible(false); }
    }
  }

  update(dt: number) {
    if (!this.shown) return;
    const w = this.w, v = w.cameras.main.worldView, now = w.time.now / 1000;
    for (const f of this.flies) {
      if (f.cool > 0) f.cool -= dt;
      const vis = f.hx > v.x - 120 && f.hx < v.right + 120 && f.hy > v.y - 120 && f.hy < v.bottom + 120;

      if (f.loop > 0) {
        f.loop -= dt * (1000 / DFLY.loopMs);
        const t = Math.max(0, Math.min(1, 1 - f.loop));
        const ang = t * Math.PI * 2;
        const r = 36;
        f.x = f.hx + Math.cos(ang) * r;
        f.y = f.hy + Math.sin(ang) * r * 0.7;
        f.img.setPosition(f.x, f.y).setRotation(ang + Math.PI / 2)
          .setScale(f.base * (1 + Math.sin(t * Math.PI) * 0.15)).setVisible(true).setDepth(9200);
        f.on = true;
        if (f.loop <= 0) {
          f.loop = 0;
          f.img.setRotation(0);
        }
        continue;
      }

      if (!vis) {
        if (f.on) { f.on = false; f.img.setVisible(false); }
        f.ph += dt * f.sp;
        continue;
      }
      if (!f.on) { f.on = true; f.img.setVisible(true); }

      // Idle hover + occasional dart to a nearby path point.
      f.dart -= dt;
      if (f.dart <= 0) {
        const path = PATH_MEADOW;
        f.pathI = Math.max(0, Math.min(path.length - 1, f.pathI + (Math.random() < 0.5 ? 1 : -1)));
        const [px, py] = path[f.pathI] ?? [HUBS.meadow.x, HUBS.meadow.y];
        f.hx = px + (Math.random() - 0.5) * 80;
        f.hy = py - 50 - Math.random() * 40;
        f.dart = 2.2 + Math.random() * 2.5;
      }
      f.ph += dt * f.sp;
      // Ease toward home.
      f.x += (f.hx + Math.sin(f.ph * 2.1) * 18 - f.x) * Math.min(1, dt * 2.4);
      f.y += (f.hy + Math.cos(f.ph * 1.7) * 10 - f.y) * Math.min(1, dt * 2.4);
      const wing = 0.95 + Math.sin(now * 28 + f.ph) * 0.08;
      f.img.setPosition(f.x, f.y)
        .setRotation(Math.sin(f.ph * 1.2) * 0.12)
        .setScale(f.base * wing, f.base)
        .setDepth(9200);
    }
  }

  stats() {
    return {
      taps: this.taps, loops: this.loops, shown: this.shown,
      list: this.flies.map((f) => ({
        x: Math.round(f.x), y: Math.round(f.y), on: f.on, looping: f.loop > 0,
        tex: f.img.texture.key, visible: f.img.visible,
      })),
    };
  }
}
