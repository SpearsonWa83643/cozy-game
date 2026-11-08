// 97: Hills squirrels. A few squirrels sit just off the Pinecone Hills path (north of the tumbling
// pinecones). They nibble and flick their tails; walk up and they scamper away, then come home
// when you're far. Tap one for a stand-up chatter. Culled off-screen. Hidden in snowy themes.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { PATH_HILLS } from './layout';
import type { WorldScene } from './scenes/World';

const SNOWY = new Set(['christmas', 'winter']);
const TW = 48, TH = 48;
export const SQU = { size: 1.08, n: 4, near: 130, far: 320, hopS: 0.38, flee: 140 };
const FURS = ['#d89050', '#c07038', '#e8b878', '#a86838'];
type Squ = {
  img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse;
  hx: number; hy: number; x: number; y: number; fromX: number; fromY: number; toX: number; toY: number;
  hop: number; hops: number; away: boolean; nib: number; chat: number; ph: number; base: number; on: boolean;
};

function squTex(c: Ctx, fur: string) {
  const dark = '#5a3a20';
  // Bushy tail (behind).
  c.fillStyle = fur; c.strokeStyle = dark; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(16, 30); c.quadraticCurveTo(4, 28, 6, 14); c.quadraticCurveTo(10, 4, 20, 10);
  c.quadraticCurveTo(14, 18, 18, 28); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,230,180,0.35)'; c.beginPath(); c.ellipse(12, 16, 4, 7, -0.5, 0, Math.PI * 2); c.fill();
  // Body.
  c.fillStyle = fur; c.beginPath(); c.ellipse(26, 32, 11, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  // Belly.
  c.fillStyle = '#f4e0c0'; c.beginPath(); c.ellipse(28, 34, 6, 6, 0, 0, Math.PI * 2); c.fill();
  // Head.
  c.fillStyle = fur; c.beginPath(); c.arc(34, 20, 8, 0, Math.PI * 2); c.fill(); c.stroke();
  // Ear.
  c.beginPath(); c.moveTo(30, 14); c.lineTo(28, 6); c.lineTo(35, 12); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ffb0c0'; c.beginPath(); c.moveTo(30.5, 13); c.lineTo(29.5, 8); c.lineTo(33, 12); c.closePath(); c.fill();
  // Face.
  c.fillStyle = '#2a1a1a'; c.beginPath(); c.arc(37, 19, 1.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(37.4, 18.6, 0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(41, 22, 1.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,140,160,0.45)'; c.beginPath(); c.arc(34, 23, 2, 0, Math.PI * 2); c.fill();
  // Front paws.
  c.fillStyle = fur; c.beginPath(); c.ellipse(32, 38, 4, 2.6, 0, 0, Math.PI * 2); c.fill(); c.stroke();
}

export class Squirrels {
  squad: Squ[] = [];
  /** Test hooks. */
  taps = 0; flees = 0; returns = 0; chats = 0; shown = true;
  constructor(private w: WorldScene) {
    if (!w.textures.exists('squirrel0')) FURS.forEach((f, i) => canvasTex(w, `squirrel${i}`, TW, TH, (c) => squTex(c, f), S, true));
    this.place();
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private free(x: number, y: number) { const [c, r] = this.w.nav.cellOf(x, y); return !this.w.nav.isBlocked(c, r); }

  private place() {
    const w = this.w, path = PATH_HILLS;
    const cones = ((w as any).pinecones?.cones ?? []) as { homeX: number; homeY: number }[];
    const busy = [
      ...w.interactables.map((it) => [it.x, it.y]),
      ...w.tappables.map((t) => [t.x(), t.y()]),
      ...cones.map((c) => [c.homeX, c.homeY]),
    ];
    const homes: [number, number][] = [];
    // Midpoints a little north of the path (pinecones sit south / downhill).
    for (let i = 0; i < path.length - 1 && homes.length < SQU.n; i++) {
      const seg = (i * 2 + 1) % (path.length - 1);
      const [ax, ay] = path[seg], [bx, by] = path[seg + 1];
      const tries: [number, number][] = [];
      for (const dy of [-80, -100, -70, -120, -55, -150]) for (const t of [0.5, 0.35, 0.65, 0.25]) tries.push([t, dy]);
      for (const [t, dy] of tries) {
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t + dy;
        if (!this.free(x, y) || !busy.every(([qx, qy]) => Math.hypot(qx - x, qy - y) > 85)) continue;
        if (homes.some(([hx, hy]) => Math.hypot(hx - x, hy - y) < 260)) continue;
        homes.push([x, y]); break;
      }
    }
    homes.forEach(([x, y], i) => {
      const key = `squirrel${i % FURS.length}`;
      const base = SQU.size / (frameScale[key] ?? S);
      const shadow = w.add.ellipse(x, y, 26, 8, 0x2a3a1a, 0.18).setDepth(y - 2).setVisible(false);
      const img = w.add.image(x, y, key).setOrigin(0.5, 0.95).setScale(base).setFlipX(i % 2 === 1).setDepth(y).setVisible(false);
      const s: Squ = { img, shadow, hx: x, hy: y, x, y, fromX: x, fromY: y, toX: x, toY: y, hop: 0, hops: 0, away: false, nib: i * 0.7, chat: 0, ph: i * 1.2, base, on: false };
      this.squad.push(s);
      w.tappables.push({ x: () => s.x, y: () => s.y - 22, r: 40, soft: true, enabled: () => s.on && s.hop <= 0, tap: () => this.tap(s) });
    });
  }

  tap(s: Squ) {
    if (!this.shown || s.hop > 0) return;
    this.taps++; this.chats++;
    s.chat = 0.85;
    sfx.chirp(); sfx.giggleSoft(1.5);
    this.w.burst(s.x, s.y - 34, 0xffd0a0, 6, 'spark');
    if (this.w.life) this.w.life.reactions++;
  }

  private startHop(s: Squ, tx: number, ty: number, hops: number) {
    s.fromX = s.x; s.fromY = s.y; s.toX = tx; s.toY = ty; s.hops = hops; s.hop = hops;
    if (Math.abs(tx - s.x) > 2) s.img.setFlipX(tx < s.x);
  }

  private retheme() {
    this.shown = !SNOWY.has(theme.id);
    if (!this.shown) for (const s of this.squad) { s.on = false; s.img.setVisible(false); s.shadow.setVisible(false); }
  }

  update(dt: number) {
    if (!this.shown) return;
    const w = this.w, v = w.cameras.main.worldView, fx = w.feet.x, fy = w.feet.y, now = w.time.now / 1000;
    for (const s of this.squad) {
      const vis = s.x > v.x - 100 && s.x < v.right + 100 && s.y > v.y - 60 && s.y - 60 < v.bottom + 60;
      if (!vis && s.hop <= 0) {
        if (s.on) { s.on = false; s.img.setVisible(false); s.shadow.setVisible(false); }
        if (s.away && Math.hypot(fx - s.hx, fy - s.hy) > SQU.far) { s.away = false; s.x = s.hx; s.y = s.hy; this.returns++; }
        continue;
      }
      if (!s.on) { s.on = true; s.img.setVisible(true); s.shadow.setVisible(true); }
      const d = Math.hypot(fx - s.x, fy - s.y);
      if (s.hop <= 0) {
        if (d < SQU.near) {
          let ax = s.x - fx, ay = s.y - fy; const n = Math.hypot(ax, ay) || 1; ax /= n; ay /= n;
          let tx = s.x + ax * SQU.flee, ty = s.y + ay * SQU.flee * 0.7;
          for (let k = 0; k < 6 && !this.free(tx, ty); k++) {
            const r = (k + 1) * 0.5 * (k % 2 ? -1 : 1);
            tx = s.x + (ax * Math.cos(r) - ay * Math.sin(r)) * SQU.flee;
            ty = s.y + (ax * Math.sin(r) + ay * Math.cos(r)) * SQU.flee * 0.7;
          }
          if (this.free(tx, ty)) { this.flees++; s.away = true; s.chat = 0; this.startHop(s, tx, ty, 3); sfx.tiptoe(); }
        } else if (s.away && Math.hypot(fx - s.hx, fy - s.hy) > SQU.far) {
          s.away = false; this.returns++;
          this.startHop(s, s.hx, s.hy, 3);
        }
      }
      let lift = 0, sx = 1, sy = 1, rot = 0;
      if (s.hop > 0) {
        s.hop = Math.max(0, s.hop - dt / SQU.hopS);
        const done = s.hops - s.hop, p = done / s.hops;
        s.x = s.fromX + (s.toX - s.fromX) * p; s.y = s.fromY + (s.toY - s.fromY) * p;
        const f = done % 1;
        lift = Math.sin(f * Math.PI) * 16;
        sy = 1 + Math.sin(f * Math.PI) * 0.1; sx = 1 - Math.sin(f * Math.PI) * 0.06;
        if (s.hop <= 0) { s.x = s.toX; s.y = s.toY; }
      } else if (s.chat > 0) {
        s.chat = Math.max(0, s.chat - dt);
        const q = Math.sin((1 - s.chat / 0.85) * Math.PI);
        sy = 1 + q * 0.18; sx = 1 - q * 0.08;
        rot = Math.sin(now * 14) * 0.12 * (s.chat / 0.85);
        lift = q * 4;
      } else {
        s.nib -= dt;
        if (s.nib < -0.8) s.nib = 1.8 + Math.random() * 2.5;
        if (s.nib < 0) { const q = Math.abs(Math.sin(now * 16)) * 0.06; sy = 1 - q; sx = 1 + q * 0.5; }
        else { sy = 1 + Math.sin(now * 2 + s.ph) * 0.015; rot = Math.sin(now * 3 + s.ph) * 0.04; }
      }
      s.img.setPosition(s.x, s.y - lift).setScale(s.base * sx, s.base * sy).setRotation(rot).setDepth(s.y);
      s.shadow.setPosition(s.x, s.y).setScale(1 - lift / 60);
    }
  }

  stats() {
    return {
      taps: this.taps, flees: this.flees, returns: this.returns, chats: this.chats, shown: this.shown,
      list: this.squad.map((s) => ({
        x: Math.round(s.x), y: Math.round(s.y), hx: Math.round(s.hx), hy: Math.round(s.hy),
        away: s.away, hopping: s.hop > 0, chatting: s.chat > 0, on: s.on, visible: s.img.visible,
      })),
    };
  }
}
