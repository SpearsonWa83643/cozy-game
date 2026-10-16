// Shared touch controls + hero movement for every walkable scene (the glade/areas and the Wild Woods).
// One floating joystick (drag to steer), tap to walk (A* path + tap marker), the same speed,
// the same acceleration blend, the same path following / stuck handling and the same
// slide-along-the-shore water rule. World and Wild both use this, so walking feels identical.
import Phaser from 'phaser';
import { DPR } from './dpr';
import { frameScale } from './art';

export const WALK_SPEED = 175;
/** Drag distance (CSS px) before a press turns into the joystick instead of a tap. */
const DRAG_START = 12;
/** A press shorter than this (ms) that never dragged counts as a tap. */
const TAP_MS = 400;
const STICK_R = 62;

export type Waypoints = { path: [number, number][]; pathStuck: number; pathLastD: number };

/** Joystick vector (magnitude 0..1) -> steering input, with the same dead zone and gentle floor. */
export function stickInput(stick: { x: number; y: number } | null): [number, number, number] {
  if (!stick) return [0, 0, 0];
  const m = Math.min(1, Math.hypot(stick.x, stick.y));
  if (m <= 0.12) return [0, 0, 0];
  const k = Math.min(1, (m - 0.12) / 0.6) * 0.75 + 0.25;
  return [(stick.x / m) * k, (stick.y / m) * k, k];
}

/** Ease the body's velocity toward input * WALK_SPEED (quick start, quicker stop). */
export function steerBody(body: Phaser.Physics.Arcade.Body, ix: number, iy: number, len: number, dt: number) {
  const v = body.velocity;
  const blend = 1 - Math.exp(-dt * (len ? 12 : 16));
  body.setVelocity(v.x + (ix * WALK_SPEED - v.x) * blend, v.y + (iy * WALK_SPEED - v.y) * blend);
}

/**
 * One step of path following. Returns the steering vector and whether the final waypoint was
 * reached this step. Gives up (clears the path) if we stop closing in for ~0.9 s.
 */
export function stepPath(s: Waypoints, fx: number, fy: number, dt: number): { dir: [number, number]; arrived: boolean } {
  for (;;) {
    if (!s.path.length) return { dir: [0, 0], arrived: false };
    const [wx, wy] = s.path[0];
    const dx = wx - fx, dy = wy - fy, d = Math.hypot(dx, dy);
    const last = s.path.length === 1;
    if (d < (last ? 6 : 16)) {
      s.path.shift();
      s.pathLastD = Infinity;
      if (!s.path.length) return { dir: [0, 0], arrived: true };
      continue;
    }
    if (d > s.pathLastD - 0.5) s.pathStuck += dt; else s.pathStuck = Math.max(0, s.pathStuck - dt);
    s.pathLastD = d;
    if (s.pathStuck > 0.9) { s.path = []; return { dir: [0, 0], arrived: false }; }
    const ease = last ? Math.min(1, d / 40 + 0.25) : 1;
    return { dir: [(dx / d) * ease, (dy / d) * ease], arrived: false };
  }
}

/** The ripple that marks where a tap is taking you. */
export function pulseTapMarker(scene: Phaser.Scene, marker: Phaser.GameObjects.Image, x: number, y: number) {
  const fs = frameScale.ripple ?? 1;
  marker.setPosition(x, y).setAlpha(0.8).setScale(0.18 / fs);
  scene.tweens.killTweensOf(marker);
  scene.tweens.add({ targets: marker, scale: 0.6 / fs, alpha: 0, duration: 700, ease: 'Sine.easeOut' });
}

/**
 * Water/pond rule: if the feet ended up in water, slide back along whichever axis is dry
 * (so you glide along the shore instead of stopping dead).
 */
export function slideOutOfWater(feet: { x: number; y: number; setPosition(x: number, y: number): unknown }, lastSafe: [number, number], blocks: (x: number, y: number) => boolean) {
  if (blocks(feet.x, feet.y)) {
    const [lx, ly] = lastSafe;
    if (!blocks(feet.x, ly)) feet.setPosition(feet.x, ly);
    else if (!blocks(lx, feet.y)) feet.setPosition(lx, feet.y);
    else feet.setPosition(lx, ly);
  }
  lastSafe[0] = feet.x; lastSafe[1] = feet.y;
}

/**
 * Floating joystick + tap detection for a UI scene (screen space, camera zoom = DPR).
 * Call begin(p) from the scene's pointerdown once the press is known to be for walking.
 */
export class TouchStick {
  pointer: Phaser.Input.Pointer | null = null;
  active = false;
  private origin = { x: 0, y: 0 };
  private start = { x: 0, y: 0 };
  private downAt = 0;
  private base: Phaser.GameObjects.Graphics;
  private knob: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, private cb: { onTap: (px: number, py: number) => void; onStick: (v: { x: number; y: number } | null) => void }) {
    scene.input.addPointer(2);
    this.base = scene.add.graphics().setVisible(false);
    this.base.fillStyle(0xfff6e2, 0.16); this.base.fillCircle(0, 0, STICK_R);
    this.base.lineStyle(3, 0xfff6e2, 0.55); this.base.strokeCircle(0, 0, STICK_R);
    this.knob = scene.add.graphics().setVisible(false);
    this.knob.fillStyle(0x2f2219, 0.25); this.knob.fillCircle(0, 3, 28);
    this.knob.fillStyle(0xfff3d6, 0.9); this.knob.fillCircle(0, 0, 27);
    this.knob.lineStyle(3, 0xf2a93b, 1); this.knob.strokeCircle(0, 0, 27);
    scene.input.on('pointermove', this.move, this);
    scene.input.on('pointerup', this.release, this);
    scene.input.on('pointerupoutside', this.release, this);
    // Some browsers report a touch lift as leaving the game: treat it as a normal release.
    scene.input.on('gameout', () => { if (this.pointer) this.release(this.pointer); });
  }

  begin(p: Phaser.Input.Pointer) {
    this.pointer = p;
    this.start = { x: p.x / DPR, y: p.y / DPR };
    this.origin = { ...this.start };
    this.downAt = this.scene.time.now;
    this.active = false;
  }

  private move(p: Phaser.Input.Pointer) {
    if (p !== this.pointer || !p.isDown) return;
    const x = p.x / DPR, y = p.y / DPR;
    let dx = x - this.origin.x, dy = y - this.origin.y, d = Math.hypot(dx, dy);
    if (!this.active && Math.hypot(x - this.start.x, y - this.start.y) > DRAG_START) {
      this.active = true;
      this.base.setVisible(true).setAlpha(0);
      this.knob.setVisible(true).setAlpha(0);
      this.scene.tweens.add({ targets: [this.base, this.knob], alpha: 1, duration: 120 });
    }
    if (!this.active) return;
    if (d > STICK_R) {
      // Floating stick: the base follows the thumb so it never runs out of travel.
      this.origin.x += (dx / d) * (d - STICK_R);
      this.origin.y += (dy / d) * (d - STICK_R);
      dx = x - this.origin.x; dy = y - this.origin.y; d = STICK_R;
    }
    this.base.setPosition(this.origin.x, this.origin.y);
    this.knob.setPosition(this.origin.x + dx, this.origin.y + dy);
    this.cb.onStick({ x: dx / STICK_R, y: dy / STICK_R });
  }

  private release(p: Phaser.Input.Pointer) {
    if (p !== this.pointer) return;
    if (!this.active && this.scene.time.now - this.downAt < TAP_MS) this.cb.onTap(p.x, p.y);
    this.reset();
  }

  /** Drop the stick without a tap (focus lost, scene leaving). */
  cancel() { if (this.pointer) this.reset(); }

  private reset() {
    this.pointer = null;
    this.active = false;
    this.cb.onStick(null);
    this.scene.tweens.add({ targets: [this.base, this.knob], alpha: 0, duration: 160, onComplete: () => { this.base.setVisible(false); this.knob.setVisible(false); } });
  }

  /** Safety net: a pointer that is no longer down but never sent pointerup. */
  update() { if (this.pointer && !this.pointer.isDown) this.release(this.pointer); }
}
