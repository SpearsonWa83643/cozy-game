// 156: Drifting hot-air balloon. Now and then a striped hot-air balloon with a little bunny pilot drifts slowly
// across the sky over you (high above the world, with a soft shadow far below). Tap it = a burner whoosh, the
// envelope puffs up and the balloon bobs higher, the bunny waves + hearts. Stripes follow the theme (red and
// green in snowy themes, orange and purple at Halloween, rainbow otherwise). Purely ambient: no HUD, no reward.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import type { WorldScene } from './scenes/World';

const BW = 64, BH = 104;
export const BALLOON = {
  size: 1.5, speed: 38, first: 14, every: [40, 75] as [number, number], tapR: 70,
  puffS: 1.6, shadowDy: 210,
};
const PALETTES: Record<string, string[]> = {
  rainbow: ['#ff6b6b', '#ffa94d', '#ffd84d', '#69db7c', '#5c9dff', '#b197fc'],
  snowy: ['#e03131', '#ffffff', '#2f9e44', '#ffffff', '#e03131', '#2f9e44'],
  halloween: ['#ff922b', '#7048e8', '#ff922b', '#7048e8', '#ff922b', '#7048e8'],
};
const palOf = (id: string) => (id === 'christmas' || id === 'winter' ? 'snowy' : id === 'halloween' ? 'halloween' : 'rainbow');
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function balloonTex(c: Ctx, cols: string[], wave: boolean, flame: boolean) {
  const cx = BW / 2, top = 4, r = 27, ey = top + r;
  // envelope: stripes clipped to a rounded balloon shape
  c.save();
  c.beginPath(); c.arc(cx, ey, r, Math.PI * 0.85, Math.PI * 2.15); c.quadraticCurveTo(cx + r * 0.75, ey + r * 1.05, cx + 7, ey + r * 1.45); c.lineTo(cx - 7, ey + r * 1.45); c.quadraticCurveTo(cx - r * 0.75, ey + r * 1.05, cx - r * Math.cos(Math.PI * 0.15), ey + r * Math.sin(Math.PI * 0.15)); c.closePath();
  c.clip();
  const n = cols.length, sw = (2 * r) / n;
  cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(cx - r + i * sw, 0, sw + 0.5, BH); });
  const g = c.createRadialGradient(cx - 9, ey - 10, 3, cx, ey, r * 1.4);
  g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,30,0.25)');
  c.fillStyle = g; c.fillRect(0, 0, BW, BH);
  c.restore();
  c.strokeStyle = '#4a3a5a'; c.lineWidth = 1.6;
  c.beginPath(); c.arc(cx, ey, r, Math.PI * 0.85, Math.PI * 2.15); c.quadraticCurveTo(cx + r * 0.75, ey + r * 1.05, cx + 7, ey + r * 1.45); c.lineTo(cx - 7, ey + r * 1.45); c.quadraticCurveTo(cx - r * 0.75, ey + r * 1.05, cx - r * Math.cos(Math.PI * 0.15), ey + r * Math.sin(Math.PI * 0.15)); c.closePath(); c.stroke();
  // ropes
  const by = ey + r * 1.45, ky = by + 15;
  c.strokeStyle = '#6a5040'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(cx - 7, by); c.lineTo(cx - 9, ky); c.moveTo(cx + 7, by); c.lineTo(cx + 9, ky); c.moveTo(cx - 2, by); c.lineTo(cx - 3, ky); c.moveTo(cx + 2, by); c.lineTo(cx + 3, ky); c.stroke();
  if (flame) {
    c.fillStyle = 'rgba(255,170,40,0.95)'; c.beginPath(); c.moveTo(cx - 4, ky - 1); c.quadraticCurveTo(cx, by - 14, cx + 4, ky - 1); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,240,140,0.95)'; c.beginPath(); c.moveTo(cx - 2, ky - 1); c.quadraticCurveTo(cx, by - 6, cx + 2, ky - 1); c.closePath(); c.fill();
  }
  // bunny pilot peeking over the basket
  const hx = cx + 1, hy = ky - 3;
  c.fillStyle = '#f4ece4'; c.strokeStyle = '#8a7a70'; c.lineWidth = 1;
  for (const [ex, a] of [[-3, -0.2], [3, 0.25]] as [number, number][]) { c.save(); c.translate(hx + ex, hy - 4); c.rotate(a); c.beginPath(); c.ellipse(0, -5, 1.9, 5, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#ffb8c8'; c.beginPath(); c.ellipse(0, -5, 0.9, 3.4, 0, 0, Math.PI * 2); c.fill(); c.restore(); c.fillStyle = '#f4ece4'; }
  c.beginPath(); c.arc(hx, hy, 5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(hx - 2, hy - 0.5, 0.9, 0, Math.PI * 2); c.arc(hx + 2, hy - 0.5, 0.9, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ff8aa8'; c.beginPath(); c.arc(hx, hy + 1.6, 0.9, 0, Math.PI * 2); c.fill();
  if (wave) {
    c.fillStyle = '#f4ece4'; c.strokeStyle = '#8a7a70';
    c.beginPath(); c.ellipse(hx + 9, hy - 5, 1.8, 4, 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  // wicker basket
  c.fillStyle = '#c8894a'; c.strokeStyle = '#6a4220'; c.lineWidth = 1.3;
  c.beginPath(); c.roundRect(cx - 10, ky, 20, 13, 2.5); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(106,66,32,0.55)'; c.lineWidth = 0.8;
  for (const y of [ky + 4.5, ky + 8.5]) { c.beginPath(); c.moveTo(cx - 9, y); c.lineTo(cx + 9, y); c.stroke(); }
  c.fillStyle = '#8a5a2a'; c.beginPath(); c.roundRect(cx - 11, ky - 1, 22, 3, 1.5); c.fill();
}

export class Balloon {
  img!: Phaser.GameObjects.Image;
  shadow!: Phaser.GameObjects.Ellipse;
  x = 0; y = 0; vx = 0;
  /** Test hooks. */
  taps = 0; passes = 0; flying = false; puff = 0;
  private wait = BALLOON.first;
  private t = 0; private rise = 0; private pal = 'rainbow';
  constructor(private w: WorldScene) {
    for (const [k, cols] of Object.entries(PALETTES)) {
      if (w.textures.exists(`balloon_${k}`)) continue;
      canvasTex(w, `balloon_${k}`, BW, BH, (c) => balloonTex(c, cols, false, false), S, true);
      canvasTex(w, `balloon_${k}_whoosh`, BW, BH, (c) => balloonTex(c, cols, true, true), S, true);
    }
    this.shadow = w.add.ellipse(0, 0, 70, 18, 0x1a2a10, 0.13).setDepth(-450).setVisible(false);
    this.img = w.add.image(0, 0, 'balloon_rainbow').setOrigin(0.5, 1).setDepth(8990).setVisible(false);
    w.tappables.push({ x: () => this.x, y: () => this.y - 70 * BALLOON.size, r: BALLOON.tapR, enabled: () => this.flying, tap: () => this.tap() });
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private key() { return `balloon_${this.pal}${this.puff > BALLOON.puffS * 0.35 ? '_whoosh' : ''}`; }
  private retheme() { this.pal = palOf(theme.id); this.img.setTexture(this.key()); }

  /** Start a pass across the current view (from the left or right edge, in its upper half). */
  launch(fromLeft = Math.random() < 0.5, frac = 0.3 + Math.random() * 0.25) {
    const v = this.w.cameras.main.worldView;
    this.vx = (fromLeft ? 1 : -1) * BALLOON.speed;
    this.x = fromLeft ? v.x - 80 : v.right + 80;
    this.y = v.y + v.height * frac + 70 * BALLOON.size;
    this.t = 0; this.rise = 0; this.puff = 0;
    this.flying = true; this.passes++;
    this.img.setVisible(true).setTexture(this.key()).setFlipX(!fromLeft);
    this.shadow.setVisible(true);
    return this.stats();
  }

  /** Test hook: put the balloon right where you can see (and tap) it. */
  showAt(x: number, y: number) { this.launch(true); this.x = x; this.y = y; return this.stats(); }

  tap() {
    if (!this.flying || this.puff > 0) return false;
    this.taps++;
    this.puff = BALLOON.puffS;
    sfx.balloonWhoosh();
    const top = this.y - 70 * BALLOON.size - this.rise;
    this.w.burst(this.x, this.y - 22 * BALLOON.size - this.rise, 0xffc040, 6, 'spark');
    this.w.burst(this.x + 10, top + 30, 0xff9ab0, 6, 'heart');
    if (this.w.life) this.w.life.reactions++;
    return true;
  }

  update(dt: number) {
    if (!this.flying) {
      this.wait -= dt;
      if (this.wait <= 0) { this.wait = BALLOON.every[0] + Math.random() * (BALLOON.every[1] - BALLOON.every[0]); this.launch(); }
      return;
    }
    this.t += dt;
    this.x += this.vx * dt;
    if (this.puff > 0) { this.puff = Math.max(0, this.puff - dt); this.rise += dt * 34 * (this.puff / BALLOON.puffS); }
    else if (this.rise > 0) this.rise = Math.max(0, this.rise - dt * 6);
    const calm = reduceMotion();
    const bob = calm ? 0 : Math.sin(this.t * 0.9) * 6;
    const p = this.puff / BALLOON.puffS;
    const sw = calm ? 1 : 1 + Math.sin((1 - p) * Math.PI) * 0.1 * (p > 0 ? 1 : 0);
    const base = BALLOON.size / (frameScale[this.key()] ?? S);
    const key = this.key();
    if (this.img.texture.key !== key) this.img.setTexture(key);
    this.img.setPosition(this.x, this.y - this.rise + bob).setScale(base * sw, base * (2 - sw) * (sw > 1 ? 1.04 : 1)).setRotation(calm ? 0 : Math.sin(this.t * 0.6) * 0.04);
    this.shadow.setPosition(this.x, this.y + BALLOON.shadowDy).setScale(1 - Math.min(0.4, this.rise / 200)).setAlpha(0.13);
    // Done when it has drifted well past the far edge of the view (or after a long while).
    const v = this.w.cameras.main.worldView;
    const gone = (this.vx > 0 && this.x > v.right + 200) || (this.vx < 0 && this.x < v.x - 200) || this.t > 90;
    if (gone) this.land();
  }

  land() { this.flying = false; this.puff = 0; this.img.setVisible(false); this.shadow.setVisible(false); }

  stats() {
    return {
      taps: this.taps, passes: this.passes, next: +this.wait.toFixed(2), flying: this.flying, puffing: this.puff > 0, pal: this.pal,
      x: Math.round(this.x), y: Math.round(this.y - 70 * BALLOON.size - this.rise), visible: this.img.visible, key: this.img.texture.key,
    };
  }
}
