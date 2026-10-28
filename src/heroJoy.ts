// 26: tap your own hero for a little moment of joy: a happy hop, a twirl, or a hop with hearts
// (they take turns), with sparkles and a giggle. Visual only: no save, needs or movement change.
// 27: stand still for a while and your hero hums: little music notes float up (stops when you move).
import Phaser from 'phaser';
import { sfx } from './audio';
import { atlasOf, frameScale } from './art';
import type { WorldScene } from './scenes/World';

export type JoyKind = 'hop' | 'twirl' | 'hearts';
const KINDS: JoyKind[] = ['hop', 'twirl', 'hearts'];
const DUR: Record<JoyKind, number> = { hop: 0.55, twirl: 0.7, hearts: 0.6 };
/** 27: seconds standing still before the hum starts, and the gap between notes. */
export const HUM_AFTER = 8, HUM_GAP = 0.85;
const NOTE_TINTS = [0xffd36e, 0xff9ccf, 0x9fd8ff, 0xb9f29a, 0xd7b8ff];

export class HeroJoy {
  /** Joy moments so far (test hook). */
  joys = 0;
  kind: JoyKind | null = null;
  t = 0;
  next = 0;
  /** Offsets the hero sprite takes this frame (World.update applies them). */
  dy = 0; angle = 0; sx = 1; sy = 1;
  constructor(private w: WorldScene) {
    w.tappables.push({
      x: () => w.feet.x, y: () => w.feet.y - 30, r: 30,
      enabled: () => this.canJoy(),
      tap: () => this.start(),
    });
  }

  /** Only while standing still on foot, and never in the way of a door / sign right next to you. */
  canJoy() {
    const w = this.w;
    if (w.mount?.carrying || w.boat?.active || w.boat?.hopping || w.village?.building || w.fishing?.active || w.locked) return false;
    if (w.path.length || w.stick) return false;
    return !w.nearestInteractable();
  }

  start(kind?: JoyKind) {
    if (this.kind && this.t < DUR[this.kind] * 0.7) return; // let the last one mostly finish
    const k = kind ?? KINDS[this.next++ % KINDS.length];
    this.kind = k; this.t = 0; this.joys++;
    const w = this.w, x = w.feet.x, y = w.feet.y - 40;
    sfx.giggle();
    if (k === 'hearts') w.burst(x, y - 10, 0xff8fbf, 8, 'heart');
    else w.burst(x, y, k === 'twirl' ? 0xc9b6ff : 0xffe08a, 12, 'spark');
    if (w.life) w.life.reactions++;
  }

  /** 27: idle time so far (s), notes floated, and the live notes. */
  idle = 0; notes = 0; humGap = 0;
  live: Phaser.GameObjects.Image[] = [];
  get humming() { return this.idle >= HUM_AFTER; }

  /** Called every frame: busy = walking, riding, boating, fishing, a dialog, etc. */
  hum(dt: number, still: boolean) {
    if (!still) { this.idle = 0; this.humGap = 0; return; }
    this.idle += dt;
    if (!this.humming) return;
    this.humGap -= dt;
    if (this.humGap > 0) return;
    this.humGap = HUM_GAP;
    this.note();
  }

  private note() {
    const w = this.w;
    const side = this.notes % 2 ? 1 : -1;
    const x = w.feet.x + side * 10, y = w.feet.y - 66;
    const img = w.add.image(x, y, atlasOf('note'), 'note').setScale(1 / (frameScale.note ?? 1) * (1.4 + Math.random() * 0.3))
      .setTint(NOTE_TINTS[this.notes % NOTE_TINTS.length]).setDepth(9400).setAlpha(0);
    this.notes++;
    this.live.push(img);
    const drift = side * (14 + Math.random() * 12);
    w.tweens.add({ targets: img, y: y - 46, duration: 1900, ease: 'Sine.easeOut' });
    w.tweens.add({ targets: img, x: x + drift, angle: side * 14, duration: 1900, ease: 'Sine.easeInOut' });
    w.tweens.add({ targets: img, alpha: { from: 0, to: 1 }, duration: 350, yoyo: true, hold: 1100, onComplete: () => { img.destroy(); this.live = this.live.filter((q) => q !== img); } });
  }

  update(dt: number) {
    this.dy = 0; this.angle = 0; this.sx = 1; this.sy = 1;
    if (!this.kind) return;
    this.t += dt;
    const d = DUR[this.kind];
    const p = Math.min(1, this.t / d);
    if (this.kind === 'twirl') {
      // Spin on the spot (two turns, like a ballerina) with a tiny lift.
      const c = Math.cos(p * Math.PI * 4);
      this.sx = Math.sign(c || 1) * Math.max(0.18, Math.abs(c));
      this.angle = Math.sin(p * Math.PI * 2) * 6;
      this.dy = Math.sin(p * Math.PI) * 10;
    } else {
      const h = this.kind === 'hop' ? 24 : 14;
      // Little crouch, jump, then a squash on landing.
      if (p < 0.15) { const q = p / 0.15; this.sx = 1 + 0.12 * q; this.sy = 1 - 0.12 * q; }
      else if (p < 0.85) { const q = (p - 0.15) / 0.7; this.dy = Math.sin(q * Math.PI) * h; this.sx = 0.94; this.sy = 1.08; }
      else { const q = (p - 0.85) / 0.15; this.sx = 1 + 0.1 * (1 - q); this.sy = 1 - 0.1 * (1 - q); }
    }
    if (p >= 1) { this.kind = null; this.dy = 0; this.angle = 0; this.sx = 1; this.sy = 1; }
  }
}
