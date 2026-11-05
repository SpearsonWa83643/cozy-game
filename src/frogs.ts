// 83: Pond frogs on lily pads. A few cute frogs sit on pads in the glade pond. They bob and blink
// while idle; tap one for a hop, croak and splash ripples. They hop to a nearby pad now and then.
// Fixed pool of 4, culled off-screen, hidden in snowy themes. Kid-friendly, uncluttered.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { POND } from './layout';
import { pondValue } from './art';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const TW = 56, TH = 48;
export const FROG = { size: 1.05, hopMs: 420, idleHopMin: 4.5, idleHopMax: 9 };
type Pad = { x: number; y: number };
type Frog = {
  img: Phaser.GameObjects.Image; pad: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse;
  x: number; y: number; padI: number; base: number; ph: number;
  blink: number; hop: number; hopFrom: Pad; hopTo: Pad; rest: number;
  on: boolean; eyes: number;
};

function lily(c: Ctx, tint: string) {
  c.fillStyle = tint; c.strokeStyle = 'rgba(40,90,50,0.7)'; c.lineWidth = 2.2;
  c.beginPath(); c.ellipse(28, 26, 24, 16, -0.1, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(30,70,40,0.45)'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(28, 26); c.lineTo(10, 18); c.moveTo(28, 26); c.lineTo(42, 16); c.moveTo(28, 26); c.lineTo(40, 34); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.ellipse(18, 20, 7, 3, -0.4, 0, Math.PI * 2); c.fill();
  // Notch.
  c.globalCompositeOperation = 'destination-out';
  c.beginPath(); c.moveTo(28, 26); c.arc(28, 26, 26, -0.25, 0.25); c.closePath(); c.fill();
  c.globalCompositeOperation = 'source-over';
}

function frog(c: Ctx, blink: boolean) {
  const green = '#6fcf6a', dark = '#2f7a3a', belly = '#d8f5b8';
  // Back legs tucked.
  c.fillStyle = dark; c.strokeStyle = '#1f5a28'; c.lineWidth = 1.8;
  for (const s of [-1, 1]) {
    c.beginPath(); c.ellipse(28 + s * 16, 34, 10, 5, s * 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  // Body.
  c.fillStyle = green; c.strokeStyle = dark; c.lineWidth = 2.2;
  c.beginPath(); c.ellipse(28, 28, 16, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = belly; c.beginPath(); c.ellipse(28, 31, 9, 6, 0, 0, Math.PI * 2); c.fill();
  // Front feet.
  c.fillStyle = dark;
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(28 + s * 10, 38, 5, 3, 0, 0, Math.PI * 2); c.fill(); }
  // Eyes on top.
  for (const s of [-1, 1]) {
    c.fillStyle = green; c.strokeStyle = dark; c.lineWidth = 2;
    c.beginPath(); c.arc(28 + s * 8, 16, 7, 0, Math.PI * 2); c.fill(); c.stroke();
    if (blink) {
      c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); c.moveTo(28 + s * 8 - 4, 16); c.lineTo(28 + s * 8 + 4, 16); c.stroke();
    } else {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(28 + s * 8, 16, 4.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a2a14'; c.beginPath(); c.arc(28 + s * 8 + 0.6, 16.4, 2.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(28 + s * 8 + 1.6, 15.2, 0.9, 0, Math.PI * 2); c.fill();
    }
  }
  // Smile.
  c.strokeStyle = dark; c.lineWidth = 1.6;
  c.beginPath(); c.arc(28, 30, 5, 0.25, Math.PI - 0.25); c.stroke();
  // Cheek blush.
  c.fillStyle = 'rgba(255,140,160,0.45)';
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(28 + s * 12, 26, 3, 2, 0, 0, Math.PI * 2); c.fill(); }
}

export class Frogs {
  frogs: Frog[] = [];
  pads: Pad[] = [];
  /** Test hooks. */
  taps = 0;
  hops = 0;
  shown = true;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('frog')) {
      canvasTex(w, 'frog', TW, TH, (c) => frog(c, false), S, true);
      canvasTex(w, 'frog_blink', TW, TH, (c) => frog(c, true), S, true);
      canvasTex(w, 'frogpad', 56, 48, (c) => lily(c, '#5cb86a'), S, true);
      canvasTex(w, 'frogpad2', 56, 48, (c) => lily(c, '#7ccf78'), S, true);
    }
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private onWater(x: number, y: number) {
    const v = pondValue(x, y);
    return v > 0.15 && v < 0.85;
  }

  private place() {
    const w = this.w;
    const spots: Pad[] = [];
    // Prefer existing lily pads when they sit on open water.
    for (const l of w.lilies) {
      if (this.onWater(l.x, l.y) && spots.every((s) => Math.hypot(s.x - l.x, s.y - l.y) > 70)) {
        spots.push({ x: l.x, y: l.y });
      }
      if (spots.length >= 7) break;
    }
    // Fill with fresh pads around the pond if needed.
    const angles = [0.4, 1.1, 2.0, 2.8, 3.6, 4.4, 5.2, 5.9];
    for (const a of angles) {
      if (spots.length >= 7) break;
      for (const k of [0.55, 0.42, 0.68]) {
        const x = POND.x + Math.cos(a) * POND.rx * k;
        const y = POND.y + Math.sin(a) * POND.ry * k * 0.95;
        if (!this.onWater(x, y)) continue;
        if (spots.some((s) => Math.hypot(s.x - x, s.y - y) < 70)) continue;
        spots.push({ x, y });
        break;
      }
    }
    this.pads = spots.slice(0, 7);
    // Draw dedicated pads for spots that aren't sitting on an existing lily.
    const used = new Set<number>();
    const nFrogs = Math.min(4, this.pads.length);
    for (let i = 0; i < nFrogs; i++) {
      const padI = i;
      used.add(padI);
      const p = this.pads[padI];
      const padImg = w.add.image(p.x, p.y, i % 2 ? 'frogpad2' : 'frogpad')
        .setScale(1.15 / (frameScale.frogpad ?? S)).setDepth(-390).setRotation((i * 0.7) % 1.2 - 0.6);
      const shadow = w.add.ellipse(p.x, p.y + 6, 28, 8, 0x1a3a20, 0.22).setDepth(-385);
      const base = FROG.size / (frameScale.frog ?? S);
      const img = w.add.image(p.x, p.y - 10, 'frog').setOrigin(0.5, 0.85).setScale(base).setDepth(p.y);
      const f: Frog = {
        img, pad: padImg, shadow, x: p.x, y: p.y, padI, base, ph: i * 1.7,
        blink: 0, hop: 0, hopFrom: { ...p }, hopTo: { ...p }, rest: FROG.idleHopMin + i * 1.2,
        on: false, eyes: 0,
      };
      this.frogs.push(f);
      w.tappables.push({
        x: () => f.x, y: () => f.y - 14, r: 40,
        enabled: () => f.on && this.shown,
        tap: () => this.tap(f),
      });
    }
  }

  private freePad(except: number) {
    const taken = new Set(this.frogs.map((f) => f.padI));
    const free = this.pads.map((_, i) => i).filter((i) => i !== except && !taken.has(i));
    if (!free.length) return except;
    return free[Math.floor(Math.random() * free.length)];
  }

  private startHop(f: Frog, toI: number, tapped: boolean) {
    if (f.hop > 0) return;
    const to = this.pads[toI];
    f.hopFrom = { x: f.x, y: f.y };
    f.hopTo = { ...to };
    f.padI = toI;
    f.hop = 1;
    f.rest = FROG.idleHopMin + Math.random() * (FROG.idleHopMax - FROG.idleHopMin);
    this.hops++;
    sfx.croak();
    if (tapped) { sfx.splash(false); this.w.burst(f.x, f.y + 4, 0xbfe8ff, 8, 'spark'); }
    else this.w.burst(f.x, f.y + 2, 0xbfe8ff, 4, 'spark');
    // Ripple ring via the tap marker style if available, else a soft burst.
    const ripple = this.w.add.circle(f.x, f.y + 4, 8, 0xffffff, 0.35).setDepth(-380).setBlendMode('ADD');
    this.w.tweens.add({
      targets: ripple, scaleX: 4, scaleY: 2.2, alpha: 0, duration: 520, ease: 'Quad.easeOut',
      onComplete: () => ripple.destroy(),
    });
  }

  tap(f: Frog) {
    if (!this.shown || f.hop > 0) return;
    this.taps++;
    const to = this.freePad(f.padI);
    this.startHop(f, to, true);
    if (this.w.life) this.w.life.reactions++;
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    if (!this.shown) {
      for (const f of this.frogs) {
        f.on = false;
        f.img.setVisible(false);
        f.pad.setVisible(false);
        f.shadow.setVisible(false);
      }
    } else {
      for (const f of this.frogs) { f.pad.setVisible(true); f.shadow.setVisible(true); }
    }
  }

  update(dt: number) {
    if (!this.shown) return;
    const w = this.w, v = w.cameras.main.worldView, now = w.time.now / 1000;
    for (const f of this.frogs) {
      const vis = f.x > v.x - 80 && f.x < v.right + 80 && f.y > v.y - 80 && f.y < v.bottom + 80;
      if (!vis) {
        if (f.on) { f.on = false; f.img.setVisible(false); }
        // Still advance hop/rest offscreen so they settle.
      } else if (!f.on) {
        f.on = true; f.img.setVisible(true);
      }

      if (f.hop > 0) {
        f.hop -= dt * (1000 / FROG.hopMs);
        const t = Math.max(0, Math.min(1, 1 - f.hop));
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        f.x = f.hopFrom.x + (f.hopTo.x - f.hopFrom.x) * ease;
        f.y = f.hopFrom.y + (f.hopTo.y - f.hopFrom.y) * ease;
        const lift = Math.sin(t * Math.PI) * 36;
        const squash = t < 0.15 || t > 0.85 ? 0.92 : 1.08;
        f.img.setPosition(f.x, f.y - 10 - lift).setScale(f.base * (2 - squash), f.base * squash).setDepth(f.y);
        f.pad.setPosition(f.hopTo.x, f.hopTo.y);
        f.shadow.setPosition(f.x, f.y + 6).setAlpha(0.12);
        if (f.hop <= 0) {
          f.hop = 0; f.x = f.hopTo.x; f.y = f.hopTo.y;
          f.img.setPosition(f.x, f.y - 10).setScale(f.base);
          f.shadow.setPosition(f.x, f.y + 6).setAlpha(0.22);
          sfx.plip();
        }
        continue;
      }

      // Idle bob + blink; occasional hop.
      f.rest -= dt;
      if (f.rest <= 0 && vis) this.startHop(f, this.freePad(f.padI), false);
      if (f.blink > 0) f.blink -= dt;
      else if (Math.random() < dt * 0.35) f.blink = 0.12;
      const key = f.blink > 0 ? 'frog_blink' : 'frog';
      if (f.img.texture.key !== key) f.img.setTexture(key);
      const bob = Math.sin(now * 2.2 + f.ph) * 2.2;
      f.img.setPosition(f.x, f.y - 10 + bob).setRotation(Math.sin(now * 1.4 + f.ph) * 0.04).setDepth(f.y);
      f.pad.setPosition(f.x, f.y + Math.sin(now * 1.1 + f.ph) * 0.4);
      f.shadow.setPosition(f.x, f.y + 6);
    }
  }

  stats() {
    return {
      taps: this.taps, hops: this.hops, shown: this.shown,
      pads: this.pads.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
      list: this.frogs.map((f) => ({
        x: Math.round(f.x), y: Math.round(f.y), on: f.on, hopping: f.hop > 0,
        padI: f.padI, tex: f.img.texture.key, visible: f.img.visible,
      })),
    };
  }
}
