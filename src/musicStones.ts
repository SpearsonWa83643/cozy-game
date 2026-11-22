// 155: Glade music stones. Five rainbow stones in a little arc on the grass near the start of the glade.
// Tap one = it bounces and plays its own woody note (C-D-E-G-A pentatonic, so any order sounds nice) and a
// music note floats up in its color. Tap all five colors within a few seconds = the stones light up in turn
// and play a little tune with rainbow sparkles. Snow caps in snowy themes. Culled off-screen.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S, pathDist } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { PLAYER_START, POND, SIGN } from './layout';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const TW = 40, TH = 30;
export const STONES = {
  size: 1.25, gap: 46, tapR: 30,
  /** Seconds the five colors may take to count as a song. */
  songWindow: 12, songS: 2.6, bounceS: 0.4,
};
const COLORS = ['#ff6b6b', '#ffa94d', '#ffd84d', '#69db7c', '#5c9dff'];
const TINTS = [0xff6b6b, 0xffa94d, 0xffd84d, 0x69db7c, 0x5c9dff];
const NOTES = [523.25, 587.33, 659.25, 783.99, 880];
/** The little song played when all five are found: up, then a happy turn back home. */
const SONG = [0, 1, 2, 3, 4, 3, 4];
type Stone = { img: Phaser.GameObjects.Image; cap: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; x: number; y: number; b: number; lit: number };

function stoneTex(c: Ctx, col: string) {
  c.fillStyle = 'rgba(40,50,30,0.22)'; c.beginPath(); c.ellipse(20, 25, 17, 4.5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#a8a29a'; c.strokeStyle = '#5e5850'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(4, 22); c.quadraticCurveTo(3, 9, 14, 6); c.quadraticCurveTo(22, 3, 30, 7); c.quadraticCurveTo(38, 11, 36, 22); c.quadraticCurveTo(20, 28, 4, 22); c.closePath(); c.fill(); c.stroke();
  // painted top
  c.fillStyle = col; c.beginPath(); c.ellipse(20, 12.5, 12, 5.5, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1; c.stroke();
  // a little white music note painted on it
  c.fillStyle = '#ffffff'; c.strokeStyle = '#ffffff'; c.lineWidth = 1.3;
  c.beginPath(); c.ellipse(18, 14, 2.2, 1.6, -0.3, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(20, 13.5); c.lineTo(20, 8); c.quadraticCurveTo(22.5, 9, 23.5, 10.5); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(11, 16, 2.5, 4, 0.5, 0, Math.PI * 2); c.fill();
}
function capTex(c: Ctx) {
  c.fillStyle = '#ffffff'; c.strokeStyle = '#c8d6e6'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(7, 12); c.quadraticCurveTo(9, 5, 20, 4.5); c.quadraticCurveTo(31, 5, 33, 12);
  c.quadraticCurveTo(29, 14, 27, 12.5); c.quadraticCurveTo(24, 15, 20, 13); c.quadraticCurveTo(15, 15, 12, 12.5); c.quadraticCurveTo(9, 14, 7, 12); c.closePath(); c.fill(); c.stroke();
}
function glowTex(c: Ctx) {
  const g = c.createRadialGradient(20, 14, 2, 20, 14, 19);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(255,255,220,0.45)'); g.addColorStop(1, 'rgba(255,255,200,0)');
  c.fillStyle = g; c.fillRect(0, 0, TW, TH);
}

export class MusicStones {
  stones: Stone[] = [];
  x = 0; y = 0;
  /** Test hooks. */
  taps = 0; songs = 0; on = false; snow = false;
  private recent: { i: number; t: number }[] = [];
  private song = 0;
  /** Countdown to the song after the fifth color, and the song's next step (driven by update, culling-safe). */
  private cue = 0;
  private step = 0; private stepT = 0;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('mstone0')) {
      COLORS.forEach((col, i) => canvasTex(w, `mstone${i}`, TW, TH, (c) => stoneTex(c, col), S, true));
      canvasTex(w, 'mstone_cap', TW, TH, capTex, S, true);
      canvasTex(w, 'mstone_glow', TW, TH, glowTex, S, true);
    }
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private offsets(): [number, number][] {
    const g = STONES.gap;
    return [[-2 * g, 0], [-g, -12], [0, -16], [g, -12], [2 * g, 0]];
  }

  private place() {
    const w = this.w;
    const P = PLAYER_START;
    // Open glade grass near the start, off the dirt paths and clear of the pond, the sign and anything tappable.
    const cands: [number, number][] = [
      [P.x - 260, P.y - 120], [P.x + 260, P.y - 120], [P.x - 300, P.y - 260], [P.x + 300, P.y - 260],
      [P.x - 220, P.y - 380], [P.x + 220, P.y - 400], [P.x - 380, P.y - 40], [P.x + 380, P.y - 40],
      [P.x - 420, P.y - 200], [P.x + 420, P.y - 200], [P.x - 160, P.y - 520], [P.x + 160, P.y - 520],
      [P.x - 520, P.y - 320], [P.x + 520, P.y - 320], [P.x - 600, P.y - 120], [P.x + 600, P.y - 120],
    ];
    const busy = [...w.interactables.map((it) => [it.x, it.y]), ...w.tappables.map((t) => [t.x(), t.y()])];
    const ws = w as any;
    for (const k of ['chimes', 'birdbath']) if (ws[k]?.x) busy.push([ws[k].x, ws[k].y]);
    const land = (x: number, y: number) => { const [c, r] = w.nav.cellOf(x, y); return !w.nav.isBlocked(c, r); };
    const ok = (cx: number, cy: number) => this.offsets().every(([ox, oy]) => {
      const x = cx + ox, y = cy + oy;
      return land(x, y) && land(x, y - 20) && pathDist(x, y) > 60 && busy.every(([bx, by]) => Math.hypot(bx - x, by - y) > 80);
    }) && Math.hypot((cx - POND.x) / (POND.rx + 160), (cy - POND.y) / (POND.ry + 140)) > 1 && Math.hypot(cx - SIGN.x, cy - SIGN.y) > 160;
    let [x, y] = cands[0];
    for (const [cx, cy] of cands) if (ok(cx, cy)) { x = cx; y = cy; break; }
    this.x = x; this.y = y;
    this.offsets().forEach(([ox, oy], i) => {
      const sx = x + ox, sy = y + oy;
      const sc = STONES.size / (frameScale[`mstone${i}`] ?? S);
      const img = w.add.image(sx, sy, `mstone${i}`).setOrigin(0.5, 0.85).setScale(sc).setDepth(sy);
      const cap = w.add.image(sx, sy, 'mstone_cap').setOrigin(0.5, 0.85).setScale(sc).setDepth(sy + 0.5).setVisible(false);
      const glow = w.add.image(sx, sy, 'mstone_glow').setOrigin(0.5, 0.85).setScale(sc * 1.6).setDepth(sy + 1).setTint(TINTS[i]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setVisible(false);
      const s: Stone = { img, cap, glow, x: sx, y: sy, b: 0, lit: 0 };
      this.stones.push(s);
      w.tappables.push({ x: () => sx, y: () => sy - 12, r: STONES.tapR, enabled: () => this.on, tap: () => this.tap(i) });
    });
  }

  /** Tap stone i (0..4). Returns false while the song is playing. */
  tap(i: number) {
    const s = this.stones[i];
    if (!s || this.song > 0) return false;
    this.taps++;
    s.b = STONES.bounceS; s.lit = 0.5;
    sfx.stoneNote(NOTES[i]);
    this.w.burst(s.x, s.y - 30, TINTS[i], 2, 'note');
    if (this.snow) this.w.burst(s.x, s.y - 18, 0xffffff, 4, 'spark');
    const now = this.w.time.now / 1000;
    this.recent = this.recent.filter((r) => now - r.t < STONES.songWindow && r.i !== i);
    this.recent.push({ i, t: now });
    if (this.recent.length >= 5) { this.recent = []; this.cue = 0.42; }
    if (this.w.life) this.w.life.reactions++;
    return true;
  }

  playSong() {
    if (this.song > 0) return;
    this.songs++;
    this.song = STONES.songS;
    this.step = 0; this.stepT = 0;
  }

  /** Advance the song: one stone per step, then a happy rainbow finish. */
  private songTick(dt: number) {
    const stepS = (STONES.songS - 0.5) / SONG.length;
    this.stepT -= dt;
    while (this.stepT <= 0 && this.step <= SONG.length) {
      if (this.step < SONG.length) {
        const n = SONG[this.step], s = this.stones[n];
        sfx.stoneNote(NOTES[n]);
        s.b = STONES.bounceS; s.lit = 0.6;
        if (this.on) this.w.burst(s.x, s.y - 34, TINTS[n], 3, 'spark');
      } else {
        sfx.stoneNote(NOTES[0] * 2); sfx.stoneNote(NOTES[2] * 2, 0.02);
        if (this.on) TINTS.forEach((t, i) => this.w.burst(this.x + (i - 2) * STONES.gap, this.y - 60, t, 4, 'spark'));
      }
      this.step++; this.stepT += stepS;
    }
  }

  private retheme() {
    this.snow = SNOWY.has(theme.id);
    for (const s of this.stones) s.cap.setVisible(this.on && this.snow);
  }

  update(dt: number) {
    const v = this.w.cameras.main.worldView;
    const g2 = STONES.gap * 2 + 60;
    const vis = this.x > v.x - g2 && this.x < v.right + g2 && this.y > v.y - 40 && this.y - 80 < v.bottom;
    if (!vis) {
      if (this.on) { this.on = false; for (const s of this.stones) { s.img.setVisible(false); s.cap.setVisible(false); s.glow.setVisible(false); } }
      this.cue = 0; this.song = 0;
      return;
    }
    if (!this.on) { this.on = true; for (const s of this.stones) { s.img.setVisible(true); s.cap.setVisible(this.snow); } }
    if (this.cue > 0) { this.cue -= dt; if (this.cue <= 0) { this.cue = 0; this.playSong(); } }
    if (this.song > 0) { this.song = Math.max(0, this.song - dt); this.songTick(dt); }
    for (const s of this.stones) {
      let sx = 1, sy = 1, lift = 0;
      if (s.b > 0) {
        s.b = Math.max(0, s.b - dt);
        const p = 1 - s.b / STONES.bounceS;
        if (p < 0.2) { sy = 1 - p * 0.9; sx = 1 + p * 0.6; } else { const q = (p - 0.2) / 0.8; lift = Math.sin(q * Math.PI) * 9; sy = 1 + Math.sin(q * Math.PI) * 0.06; sx = 1 / sy; }
      }
      if (s.lit > 0) s.lit = Math.max(0, s.lit - dt);
      const base = STONES.size / (frameScale[s.img.texture.key] ?? S);
      s.img.setPosition(s.x, s.y - lift).setScale(base * sx, base * sy);
      s.cap.setPosition(s.x, s.y - lift).setScale(base * sx, base * sy);
      s.glow.setVisible(s.lit > 0).setAlpha(Math.min(1, s.lit * 2.5)).setPosition(s.x, s.y - lift + 4);
    }
  }

  stats() {
    return {
      taps: this.taps, songs: this.songs, on: this.on, snow: this.snow, singing: this.song > 0,
      x: Math.round(this.x), y: Math.round(this.y),
      stones: this.stones.map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), visible: s.img.visible, cap: s.cap.visible, bouncing: s.b > 0, lit: s.lit > 0 })),
    };
  }
}
