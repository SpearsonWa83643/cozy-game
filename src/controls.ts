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
export const TAP_MS = 400;
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
  downAt = 0;
  private base: Phaser.GameObjects.Graphics;
  private knob: Phaser.GameObjects.Graphics;

  /** Two-finger pinch in progress (both pointers + starting finger distance in canvas px). */
  private pinch: { a: Phaser.Input.Pointer; b: Phaser.Input.Pointer; d0: number } | null = null;

  constructor(private scene: Phaser.Scene, private cb: { onTap: (px: number, py: number) => void; onStick: (v: { x: number; y: number } | null) => void; onPinch?: PinchCb }) {
    scene.input.addPointer(2);
    // Registered before the scene's own pointerdown so a second finger turns the walk press into a pinch first.
    scene.input.on('pointerdown', this.down, this);
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

  /** True while a walk press or a pinch owns the touch (a new press should not start anything). */
  get busy() { return !!this.pointer || !!this.pinch; }
  get pinching() { return !!this.pinch; }

  private down(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[] = []) {
    const a = this.pointer;
    if (!this.cb.onPinch || this.pinch || !a || a === p || !a.isDown || over.length) return;
    // Second finger while walking: no tap, no joystick; it's a pinch now.
    this.reset();
    this.pinch = { a, b: p, d0: Math.max(8, Math.hypot(a.x - p.x, a.y - p.y)) };
    this.cb.onPinch('start', 1, (a.x + p.x) / 2, (a.y + p.y) / 2);
  }

  private pinchMove() {
    const pi = this.pinch!;
    const { a, b } = pi;
    this.cb.onPinch?.('move', Math.hypot(a.x - b.x, a.y - b.y) / pi.d0, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  private endPinch() {
    if (!this.pinch) return;
    this.pinch = null;
    this.cb.onPinch?.('end', 1, 0, 0);
  }

  begin(p: Phaser.Input.Pointer) {
    if (this.pinch) return;
    this.pointer = p;
    this.start = { x: p.x / DPR, y: p.y / DPR };
    this.origin = { ...this.start };
    this.downAt = this.scene.time.now;
    this.active = false;
  }

  private move(p: Phaser.Input.Pointer) {
    if (this.pinch && (p === this.pinch.a || p === this.pinch.b)) { this.pinchMove(); return; }
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
    if (this.pinch && (p === this.pinch.a || p === this.pinch.b)) { this.endPinch(); return; }
    if (p !== this.pointer) return;
    if (!this.active && this.scene.time.now - this.downAt < TAP_MS) this.cb.onTap(p.x, p.y);
    this.reset();
  }

  /** A press held still past the tap window (not a tap, not a drag): canvas px, else null. */
  held(): { x: number; y: number } | null {
    const p = this.pointer;
    return p && p.isDown && !this.active && this.scene.time.now - this.downAt >= TAP_MS ? { x: p.x, y: p.y } : null;
  }

  /** Drop the stick without a tap (focus lost, scene leaving). */
  cancel() { if (this.pointer) this.reset(); this.endPinch(); }

  private reset() {
    this.pointer = null;
    this.active = false;
    this.cb.onStick(null);
    this.scene.tweens.add({ targets: [this.base, this.knob], alpha: 0, duration: 160, onComplete: () => { this.base.setVisible(false); this.knob.setVisible(false); } });
  }

  /** Safety net: a pointer that is no longer down but never sent pointerup. */
  update() {
    if (this.pointer && !this.pointer.isDown) this.release(this.pointer);
    if (this.pinch && (!this.pinch.a.isDown || !this.pinch.b.isDown)) this.endPinch();
  }
}

// ------------------------------------------------------------------ zoom (shared by the glade and the Wild Woods)
export type PinchCb = (phase: 'start' | 'move' | 'end', ratio: number, midX: number, midY: number) => void;

/** Player zoom on top of each scene's base zoom: one setting shared everywhere this session. */
export const ZOOM = { mul: 1, min: 0.7, max: 1.8, step: 1.25 };

/**
 * Pinch / +/- zoom for a camera that normally follows the hero. The final zoom is base * ZOOM.mul,
 * clamped so the view never shows past the map edges. Pinch zooms about the hero (the camera keeps following
 * the whole time), so the hero stays centred and nothing re-centres on release.
 */
export class CamZoom {
  private pinchMul = 1;
  private pinchOn = false;
  constructor(private cam: Phaser.Cameras.Scene2D.Camera, private o: { base: () => number; worldW: number; worldH: number; follow: () => void; allowed?: () => boolean }) {}

  /** Lowest zoom (canvas px per world unit) that still fits inside the map. */
  private floor() { return Math.max(this.cam.width / this.o.worldW, this.cam.height / this.o.worldH); }
  /** The zoom the camera should sit at for a given multiplier. */
  zoomFor(mul = ZOOM.mul) { return Math.max(this.o.base() * Phaser.Math.Clamp(mul, ZOOM.min, ZOOM.max), this.floor()); }

  private lerp: [number, number] | null = null;
  private ramp: Phaser.Tweens.Tween | null = null;

  /** Ease the follow lerp toward `to` (so tightening or relaxing the follow never makes the view jump). */
  private rampLerp(to: [number, number], ms: number, done?: () => void) {
    this.ramp?.stop(); this.ramp = null;
    const from: [number, number] = [this.cam.lerp.x, this.cam.lerp.y];
    const sc = (this.cam as any).scene as Phaser.Scene | undefined;
    if (!sc || ms <= 0) { this.cam.setLerp(to[0], to[1]); done?.(); return; }
    this.ramp = sc.tweens.addCounter({
      from: 0, to: 1, duration: ms, ease: 'Sine.easeInOut',
      onUpdate: (t) => { const k = t.getValue() ?? 1; this.cam.setLerp(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k); },
      onComplete: () => { this.ramp = null; this.cam.setLerp(to[0], to[1]); done?.(); },
    });
  }

  onPinch: PinchCb = (phase, ratio) => {
    // The hero stays dead centre the whole time: the camera never lets go of its follow target and zooms about
    // its own centre (no pivot about the fingers), so there is no drift while pinching and nothing to
    // re-centre on release. Near a map edge the camera's own bounds clamp it, continuously with the zoom.
    if (phase === 'start') {
      if (this.o.allowed && !this.o.allowed()) return;
      this.pinchOn = true; this.pinchMul = ZOOM.mul;
      this.cam.zoomEffect?.reset?.();
      if (!(this.cam as any)._follow) this.o.follow();
      // Lock the follow tight while the fingers are down (eased in, never a snap), relax it again on release.
      if (!this.lerp) this.lerp = [this.cam.lerp.x, this.cam.lerp.y];
      this.rampLerp([1, 1], 160);
    } else if (phase === 'move') {
      if (!this.pinchOn) return;
      ZOOM.mul = Phaser.Math.Clamp(this.pinchMul * ratio, ZOOM.min, ZOOM.max);
      this.cam.zoomTo(this.zoomFor(), 90, 'Sine.easeOut', true);
    } else if (this.pinchOn) {
      this.pinchOn = false;
      const back = this.lerp ?? [this.cam.lerp.x, this.cam.lerp.y];
      this.lerp = null;
      this.rampLerp([back[0], back[1]], 450);
      if (!(this.cam as any)._follow) this.o.follow();
    }
  };

  /** +/- buttons: one step in or out around the hero, with a quick ease. */
  step(dir: 1 | -1) {
    if (this.o.allowed && !this.o.allowed()) return false;
    const before = ZOOM.mul;
    ZOOM.mul = Phaser.Math.Clamp(ZOOM.mul * (dir > 0 ? ZOOM.step : 1 / ZOOM.step), ZOOM.min, ZOOM.max);
    if (Math.abs(ZOOM.mul - before) < 1e-3) return false;
    this.cam.zoomTo(this.zoomFor(), 220, 'Sine.easeOut', true);
    return true;
  }

  /** Re-apply after a resize or when the scene (re)enters. */
  fit() { this.cam.setZoom(this.zoomFor()); }
}

/** The big round + / - pair (same look and place in every scene): left column, above Call Mount / Build. */
export class ZoomButtons {
  zones: Phaser.GameObjects.Zone[] = [];
  rects: { x: number; y: number; w: number; h: number }[] = [];
  private cs: Phaser.GameObjects.Container[] = [];
  constructor(private scene: Phaser.Scene, onZoom: (dir: 1 | -1) => void) {
    for (const dir of [1, -1] as const) {
      const g = scene.add.graphics();
      g.fillStyle(0x2c2420, 0.3); g.fillCircle(0, 3, 29);
      g.fillStyle(0xf3e6cc, 0.94); g.fillCircle(0, 0, 28);
      g.lineStyle(3, 0xb59b7c, 1); g.strokeCircle(0, 0, 28);
      g.fillStyle(0x6b4a33, 1); g.fillRoundedRect(-12, -3.5, 24, 7, 3.5);
      if (dir > 0) g.fillRoundedRect(-3.5, -12, 7, 24, 3.5);
      const c = scene.add.container(0, 0, [g]).setDepth(40);
      const z = scene.add.zone(0, 0, 68, 68).setInteractive(new Phaser.Geom.Circle(34, 34, 34), Phaser.Geom.Circle.Contains).setDepth(40);
      z.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation?.();
        scene.tweens.add({ targets: c, scale: { from: 0.85, to: 1 }, duration: 200, ease: 'Back.easeOut' });
        onZoom(dir);
      });
      this.cs.push(c); this.zones.push(z);
    }
  }
  /** Stack the pair at (x, y) top (CSS px). */
  layout(x: number, y: number) {
    this.rects = [];
    this.cs.forEach((c, i) => {
      const cy = y + i * 66;
      c.setPosition(x, cy); this.zones[i].setPosition(x, cy);
      this.rects.push({ x: x - 34, y: cy - 34, w: 68, h: 68 });
    });
  }
  setVisible(v: boolean) { this.cs.forEach((c) => c.setVisible(v)); this.zones.forEach((z) => (z.input!.enabled = v)); }
}
