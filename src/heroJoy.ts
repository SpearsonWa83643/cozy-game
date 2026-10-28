// 26: tap your own hero for a little moment of joy: a happy hop, a twirl, or a hop with hearts
// (they take turns), with sparkles and a giggle. Visual only: no save, needs or movement change.
import { sfx } from './audio';
import type { WorldScene } from './scenes/World';

export type JoyKind = 'hop' | 'twirl' | 'hearts';
const KINDS: JoyKind[] = ['hop', 'twirl', 'hearts'];
const DUR: Record<JoyKind, number> = { hop: 0.55, twirl: 0.7, hearts: 0.6 };

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
