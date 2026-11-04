// 78: Seashell Bay hermit crabs. A few little crabs scuttle sideways along the beach, duck into
// their shells when you walk right up, and wave their claws when tapped. Fixed pool of 4, culled
// off-screen, hidden in the snowy themes. Visual only.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { BAY, WORLD_W, WORLD_H } from './layout';
import { lakeValue } from './geo';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const TW = 70, TH = 60;
/** Hide when you come closer than `near`, peek out again past `far`; sideways speed (px/s). */
export const CRAB = { near: 150, far: 230, speed: 46, size: 1.15 };
type Crab = {
  img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse;
  a0: number; a: number; k: number; dir: number; walk: number; rest: number;
  hide: number; wave: number; x: number; y: number; on: boolean; base: number; ph: number;
};

function shell(c: Ctx, x: number, y: number) {
  c.fillStyle = '#f2c79a'; c.strokeStyle = '#a8673d'; c.lineWidth = 2.5;
  c.beginPath(); c.ellipse(x, y, 22, 18, -0.15, 0, Math.PI * 2); c.fill(); c.stroke();
  c.lineWidth = 2.2; c.strokeStyle = '#c47e4d';
  c.beginPath(); for (let t = 0; t < 9; t += 0.2) { const r = 3 + t * 1.9, px = x + 2 + Math.cos(t) * r, py = y - 1 + Math.sin(t) * r * 0.82; if (t) c.lineTo(px, py); else c.moveTo(px, py); } c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(x - 9, y - 9, 5, 3, -0.6, 0, Math.PI * 2); c.fill();
}
function crab(c: Ctx, wave: boolean) {
  const red = '#ef6a4c', dark = '#b8432c';
  // Legs.
  c.strokeStyle = dark; c.lineWidth = 3;
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(35 + s * 10, 46); c.lineTo(35 + s * (18 + i * 4), 50 + i * 2); c.lineTo(35 + s * (21 + i * 5), 57); c.stroke(); }
  shell(c, 40, 26);
  // Body peeking out the front.
  c.fillStyle = red; c.strokeStyle = dark; c.lineWidth = 2.5;
  c.beginPath(); c.ellipse(32, 44, 15, 9, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  // Eye stalks.
  for (const ex of [26, 38]) {
    c.strokeStyle = dark; c.lineWidth = 2.5; c.beginPath(); c.moveTo(ex, 40); c.lineTo(ex, 30); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, 29, 4.2, 0, Math.PI * 2); c.fill(); c.strokeStyle = dark; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#2a1d14'; c.beginPath(); c.arc(ex + 0.6, 29.4, 2.2, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = dark; c.lineWidth = 1.8; c.beginPath(); c.arc(32, 45, 4, 0.2, Math.PI - 0.2); c.stroke();
  // Claws: down by the sides, or up high waving hello.
  for (const s of [-1, 1]) {
    const cx = 32 + s * 20, cy = wave ? 22 : 46;
    c.strokeStyle = dark; c.lineWidth = 3.2; c.beginPath(); c.moveTo(32 + s * 12, 44); c.lineTo(cx, cy + (wave ? 8 : 0)); c.stroke();
    c.fillStyle = red; c.strokeStyle = dark; c.lineWidth = 2.2;
    c.beginPath(); c.ellipse(cx, cy, 6.5, 5, s * (wave ? -0.6 : 0.3), 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(cx + s * 2, cy - 4); c.lineTo(cx + s * 7, cy - 7); c.stroke();
  }
}

export class Crabs {
  crabs: Crab[] = [];
  /** Test hooks. */
  taps = 0;
  hides = 0;
  shown = true;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('hcrab')) {
      canvasTex(w, 'hcrab', TW, TH, (c) => crab(c, false), S, true);
      canvasTex(w, 'hcrab_wave', TW, TH, (c) => crab(c, true), S, true);
      canvasTex(w, 'hcrab_in', TW, TH, (c) => shell(c, 36, 38), S, true);
    }
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private pos(a: number, k: number): [number, number] { return [BAY.x + Math.cos(a) * BAY.rx * k, BAY.y + Math.sin(a) * BAY.ry * k]; }
  private sand(x: number, y: number) { return x > 120 && x < WORLD_W - 120 && y > 120 && y < WORLD_H - 80 && lakeValue(x, y) > 1.05; }

  /** Four spread-out spots on the north beach (where sideways means left and right). */
  private place() {
    const w = this.w, homes: number[] = [];
    for (let i = 0; i < 60 && homes.length < 4; i++) {
      const a = -2.55 + ((i * 0.618) % 1) * 2.0;
      const [x, y] = this.pos(a, 1.12);
      if (!this.sand(x, y) || !this.sand(...this.pos(a + 0.1, 1.12)) || !this.sand(...this.pos(a - 0.1, 1.12))) continue;
      if (homes.some((h) => Math.abs(Math.atan2(Math.sin(h - a), Math.cos(h - a))) < 0.42)) continue;
      homes.push(a);
    }
    homes.forEach((a0, i) => {
      const k = 1.1 + (i % 2) * 0.05;
      const shadow = w.add.ellipse(0, 0, 40, 10, 0x3a2a1a, 0.18).setVisible(false);
      const base = CRAB.size / (frameScale.hcrab ?? S);
      const img = w.add.image(0, 0, 'hcrab').setOrigin(0.5, 0.95).setScale(base).setVisible(false);
      const cr: Crab = { img, shadow, a0, a: a0, k, dir: i % 2 ? 1 : -1, walk: 1 + i * 0.4, rest: 0, hide: 0, wave: 0, x: 0, y: 0, on: false, base, ph: i * 1.7 };
      [cr.x, cr.y] = this.pos(a0, k);
      this.crabs.push(cr);
      w.tappables.push({ x: () => cr.x, y: () => cr.y - 22, r: 46, soft: true, enabled: () => cr.on, tap: () => this.tap(cr) });
    });
  }

  tap(cr: Crab) {
    this.taps++;
    cr.hide = 0; cr.wave = 1.4; cr.rest = Math.max(cr.rest, 1.4);
    sfx.tock(); sfx.giggleSoft(1.6);
    this.w.burst(cr.x, cr.y - 40, 0xffe08a, 7, 'spark');
    if (this.w.life) this.w.life.reactions++;
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    if (!this.shown) for (const cr of this.crabs) { cr.on = false; cr.img.setVisible(false); cr.shadow.setVisible(false); }
  }

  update(dt: number) {
    if (!this.shown) return;
    const w = this.w, v = w.cameras.main.worldView, fx = w.feet.x, fy = w.feet.y, now = w.time.now / 1000;
    for (const cr of this.crabs) {
      const vis = cr.x > v.x - 80 && cr.x < v.right + 80 && cr.y > v.y - 80 && cr.y < v.bottom + 80;
      if (!vis) { if (cr.on) { cr.on = false; cr.img.setVisible(false); cr.shadow.setVisible(false); } continue; }
      if (!cr.on) { cr.on = true; cr.img.setVisible(true); cr.shadow.setVisible(true); }
      const d = Math.hypot(fx - cr.x, fy - cr.y);
      // Shy: duck into the shell when you walk right up (not while waving hello).
      if (cr.wave <= 0 && d < CRAB.near) { if (cr.hide <= 0) this.hides++; cr.hide = 1.2; }
      else if (cr.hide > 0 && d > CRAB.far) cr.hide -= dt;
      let key = 'hcrab', bob = 0, rot = 0;
      if (cr.wave > 0) {
        cr.wave -= dt; key = 'hcrab_wave';
        rot = Math.sin(now * 14) * 0.12; bob = Math.abs(Math.sin(now * 9)) * 5;
      } else if (cr.hide > 0) {
        key = 'hcrab_in'; rot = Math.sin(now * 2 + cr.ph) * 0.03;
      } else if (cr.rest > 0) {
        cr.rest -= dt; rot = Math.sin(now * 3 + cr.ph) * 0.04;
      } else {
        // Scuttle sideways along the sand, then stop for a look around.
        const na = cr.a + cr.dir * CRAB.speed * dt / BAY.rx;
        const [nx, ny] = this.pos(na, cr.k);
        if (Math.abs(na - cr.a0) > 0.11 || !this.sand(nx, ny)) cr.dir *= -1;
        else { cr.a = na; cr.x = nx; cr.y = ny; }
        cr.walk -= dt;
        rot = Math.sin(now * 22 + cr.ph) * 0.09; bob = Math.abs(Math.sin(now * 22 + cr.ph)) * 2.5;
        if (cr.walk <= 0) { cr.walk = 1.2 + Math.random() * 1.8; cr.rest = 0.8 + Math.random() * 1.6; if (Math.random() < 0.5) cr.dir *= -1; }
      }
      if (cr.img.texture.key !== key) cr.img.setTexture(key);
      const sq = key === 'hcrab_in' ? 0.96 : 1;
      cr.img.setPosition(cr.x, cr.y - bob).setRotation(rot).setScale(cr.base, cr.base * sq).setDepth(cr.y);
      cr.shadow.setPosition(cr.x, cr.y + 1).setDepth(cr.y - 2);
    }
  }

  stats() {
    return {
      taps: this.taps, hides: this.hides, shown: this.shown,
      list: this.crabs.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), on: c.on, state: c.wave > 0 ? 'wave' : c.hide > 0 ? 'in' : c.rest > 0 ? 'rest' : 'walk', tex: c.img.texture.key })),
    };
  }
}
