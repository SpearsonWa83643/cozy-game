// Boats (9.35): a little rowboat moored on the pond and the lake. Walk up and tap it to climb in,
// steer with the same drag / tap-to-go controls as walking, tap the shore to hop out.
import Phaser from 'phaser';
import { sfx } from './audio';
import { waterAt, waterBlocks, type WaterId } from './geo';
import { POND, PIER } from './layout';
import { pulseTapMarker } from './controls';
import type { WorldScene, Interactable } from './scenes/World';
import { theme, themeEvents } from './theme';
import type { ThemeId } from './save';

type BoatWater = Extract<WaterId, 'pond' | 'lake'>;
export type Boat = {
  water: BoatWater; x: number; y: number; flip: boolean;
  back: Phaser.GameObjects.Image; front: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse;
  it: Interactable; dock: [number, number];
};

/** How far in from the shoreline the boat keeps its middle. */
export const BOAT_INSET = 22;
const W = 132, H = 64;
const INK = '#3d2c20';

function hullPath(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(8, 18); g.lineTo(W - 4, 12);
  g.quadraticCurveTo(W - 14, H - 10, W - 40, H - 6);
  g.lineTo(34, H - 6);
  g.quadraticCurveTo(10, H - 14, 8, 18);
  g.closePath();
}
/** Back layer: the inside of the hull and seat (behind the rider). Front: the planked side (hides the legs). */
export function ensureBoatArt(scene: Phaser.Scene) {
  if (scene.textures.exists('boat_back')) return;
  const back = scene.textures.createCanvas('boat_back', W, H)!;
  let g = back.getContext();
  g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = INK;
  g.fillStyle = '#8a5a34'; g.beginPath(); g.ellipse(W / 2 + 2, 20, W / 2 - 8, 13, -0.04, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#6e4426'; g.beginPath(); g.ellipse(W / 2 + 2, 22, W / 2 - 18, 8, -0.04, 0, Math.PI * 2); g.fill();
  back.refresh();
  for (const id of Object.keys(SKINS) as ThemeId[]) paintFront(scene, id);
}

/** Each theme gets its own boat paint: hull colour, stripe, and a little picture on the bow. */
const SKINS: Record<ThemeId, { hull: string; stripe: string; rim: string; badge: 'flower' | 'leaf' | 'pumpkin' | 'star' }> = {
  spring: { hull: '#d9604c', stripe: '#fbe3c0', rim: '#ffd9a0', badge: 'flower' },
  fall: { hull: '#c9772f', stripe: '#ffe0a0', rim: '#ffd27a', badge: 'leaf' },
  halloween: { hull: '#6b4a8c', stripe: '#ff9a3c', rim: '#c9a6f0', badge: 'pumpkin' },
  christmas: { hull: '#2f8a4e', stripe: '#ffffff', rim: '#b8f0c8', badge: 'star' },
  winter: { hull: '#3f7fc0', stripe: '#ffffff', rim: '#cfe8ff', badge: 'star' },
};
export const boatFrontKey = (id: ThemeId) => `boat_front_${id}`;

function paintFront(scene: Phaser.Scene, id: ThemeId) {
  const k = SKINS[id];
  const front = scene.textures.createCanvas(boatFrontKey(id), W, H)!;
  const g = front.getContext();
  g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = INK;
  g.save(); hullPath(g); g.clip();
  g.fillStyle = k.hull; g.fillRect(0, 0, W, H);
  g.fillStyle = k.stripe; g.fillRect(0, 24, W, 9);
  if (id === 'christmas') { g.fillStyle = '#d93a3a'; for (let x = -6; x < W; x += 16) { g.beginPath(); g.moveTo(x, 33); g.lineTo(x + 8, 33); g.lineTo(x + 14, 24); g.lineTo(x + 6, 24); g.closePath(); g.fill(); } }
  g.fillStyle = 'rgba(61,44,32,0.18)'; g.fillRect(0, H - 22, W, 22);
  g.restore();
  hullPath(g); g.stroke();
  // Rim highlight and a little picture on the bow.
  g.strokeStyle = k.rim; g.lineWidth = 3; g.beginPath(); g.moveTo(14, 21); g.lineTo(W - 12, 15); g.stroke();
  const cx = W - 34, cy = 42;
  g.strokeStyle = INK; g.lineWidth = 2.5;
  if (k.badge === 'star') {
    g.fillStyle = '#ffe27a'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 9; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
  } else if (k.badge === 'flower') {
    g.fillStyle = '#ffe9f0';
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; g.beginPath(); g.arc(cx + Math.cos(a) * 5.5, cy + Math.sin(a) * 5.5, 4.2, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(cx, cy, 3.6, 0, Math.PI * 2); g.fill(); g.stroke();
  } else if (k.badge === 'leaf') {
    g.fillStyle = '#ffcf4a'; g.beginPath(); g.ellipse(cx, cy, 10, 6, -0.6, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx - 9, cy + 7); g.lineTo(cx + 6, cy - 4); g.stroke();
  } else {
    g.fillStyle = '#ff8a2a'; g.beginPath(); g.ellipse(cx, cy + 1, 10, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx - 3, cy - 6); g.quadraticCurveTo(cx, cy + 1, cx - 3, cy + 8); g.moveTo(cx + 3, cy - 6); g.quadraticCurveTo(cx, cy + 1, cx + 3, cy + 8); g.stroke();
    g.fillStyle = '#4f8a3a'; g.fillRect(cx - 1.5, cy - 11, 3, 5); g.strokeRect(cx - 1.5, cy - 11, 3, 5);
  }
  front.refresh();
}

export class Boats {
  boats: Boat[] = [];
  /** The boat you're sitting in, or null on foot. */
  riding: Boat | null = null;
  hopping = false;
  boards = 0; hops = 0;
  wakeT = 0;

  constructor(private w: WorldScene) {
    ensureBoatArt(w);
    this.add('pond', [POND.x, POND.y + POND.ry + 60], [0, -1]);
    // Beside the pier's shore end, not its deep tip: easy to walk up to.
    this.add('lake', [PIER.x + 120, PIER.y0], [0, 1]);
    // Repaint with the theme's boat skin when the look changes.
    const onTheme = () => { for (const b of this.boats) b.front.setTexture(boatFrontKey(theme.id)); };
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
  }

  get active() { return !!this.riding; }

  /** Moor a boat in the water next to a shore spot, marching from it in a direction until the water is deep enough. */
  add(water: BoatWater, stand: [number, number], dir: [number, number]) {
    const w = this.w;
    const d = Math.hypot(dir[0], dir[1]);
    let x = stand[0], y = stand[1];
    for (let k = 0; k < 80; k++) {
      x += dir[0] / d * 6; y += dir[1] / d * 6;
      if (waterAt(x, y, BOAT_INSET + 6) === water && waterAt(x, y, BOAT_INSET + 6) && !waterBlocksDeck(x, y)) break;
    }
    const back = w.add.image(x, y, 'boat_back').setOrigin(0.5, 0.75);
    const front = w.add.image(x, y, boatFrontKey(theme.id)).setOrigin(0.5, 0.75);
    const shadow = w.add.ellipse(x, y + 6, W * 0.9, 22, 0x1e4a63, 0.28).setDepth(-380);
    const b: Boat = {
      water, x, y, flip: dir[0] < 0, back, front, shadow, dock: stand,
      it: {
        x, y, r: 120, label: 'Boat', promptY: 70, approach: [stand[0] - x, stand[1] - y],
        enabled: () => !this.riding && !this.hopping && !w.inWild && !w.mount.carrying && !w.village?.building,
        action: () => this.board(b),
      },
    };
    w.interactables.push(b.it);
    this.boats.push(b);
    this.place(b, x, y, 0);
    return b;
  }

  place(b: Boat, x: number, y: number, bob: number) {
    b.x = x; b.y = y;
    b.it.x = x; b.it.y = y;
    // Keep the "stand here to climb in" spot on the nearest dry, walkable land.
    if (!this.riding || this.riding !== b) { const s = this.shoreNear(x, y) ?? b.dock; b.it.approach = [s[0] - x, s[1] - y]; }
    b.back.setPosition(x, y + bob).setFlipX(b.flip).setDepth(y - 2);
    b.front.setPosition(x, y + bob).setFlipX(b.flip).setDepth(y + 8);
    b.shadow.setPosition(x, y + 6);
  }

  /** Nearest dry walkable spot to a water point (a little way up the bank). */
  shoreNear(x: number, y: number, max = 160): [number, number] | null {
    const nav = this.w.nav;
    if (!nav) return null;
    let best: [number, number] | null = null, bd = Infinity;
    for (let r = 20; r <= max; r += 10) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (waterAt(px, py, -14) || nav.isBlocked(...nav.cellOf(px, py))) continue;
        const d = Math.hypot(px - x, py - y);
        if (d < bd) { bd = d; best = [px, py]; }
      }
      if (best) return best;
    }
    return null;
  }

  inside(b: Boat, x: number, y: number) { return waterAt(x, y, BOAT_INSET) === b.water && !waterBlocksDeck(x, y); }
  /** The movement rule while boating: everything but this boat's water blocks. */
  blocks = (x: number, y: number) => !this.riding || !this.inside(this.riding, x, y);

  board(b: Boat) {
    if (this.riding || this.hopping) return;
    const w = this.w;
    w.path = []; w.pathTarget = null; w.stick = null; w.body.setVelocity(0, 0);
    this.hopping = true;
    const from = [w.feet.x, w.feet.y];
    sfx.blip();
    w.tweens.addCounter({
      from: 0, to: 1, duration: 420, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        w.feet.setPosition(from[0] + (b.x - from[0]) * p, from[1] + (b.y - from[1]) * p);
        w.playerImg.setPosition(w.feet.x, w.feet.y + 6 - Math.sin(p * Math.PI) * 26);
      },
      onComplete: () => {
        this.hopping = false;
        this.riding = b;
        w.feet.setPosition(b.x, b.y); w.body.reset(b.x, b.y);
        w.lastSafe = [b.x, b.y];
        this.boards++;
        sfx.thump();
        this.splash(b.x, b.y);
        w.game.events.emit('boat', true);
        w.game.events.emit('toast', 'All aboard! Drag or tap the water to row. Tap your boat to fish. Tap the shore to hop out.');
      },
    });
  }

  /** A tap while in the boat: row to water taps; tap the shore to row over and hop out there. */
  tap(wx: number, wy: number) {
    const b = this.riding;
    if (!b || this.hopping) return;
    const w = this.w;
    w.stick = null;
    if (this.inside(b, wx, wy)) {
      w.path = [[wx, wy]]; w.pathTarget = null; w.pathArrive = null; w.pathLastD = Infinity; w.pathStuck = 0;
      pulseTapMarker(w, w.tapMarker, wx, wy);
      return;
    }
    // Shore (or far water): the last boat-able point on the way to the tap.
    let sx = wx, sy = wy;
    const d = Math.hypot(b.x - wx, b.y - wy) || 1;
    for (let k = 0; k < 400 && !this.inside(b, sx, sy); k++) { sx += (b.x - wx) / d * 8; sy += (b.y - wy) / d * 8; }
    if (!this.inside(b, sx, sy)) { sx = b.x; sy = b.y; }
    const land = waterAt(wx, wy) ? null : this.landingFrom(sx, sy, wx, wy);
    pulseTapMarker(w, w.tapMarker, wx, wy);
    if (!land) { w.path = [[sx, sy]]; w.pathTarget = null; w.pathArrive = null; w.pathLastD = Infinity; w.pathStuck = 0; return; }
    w.path = [[sx, sy]]; w.pathTarget = null; w.pathLastD = Infinity; w.pathStuck = 0;
    w.pathArrive = () => this.hopOut(land);
  }

  /** Where to step ashore going from water point (sx, sy) toward a land tap (wx, wy). */
  landingFrom(sx: number, sy: number, wx: number, wy: number): [number, number] | null {
    const nav = this.w.nav;
    const d = Math.hypot(wx - sx, wy - sy) || 1;
    for (let s = 10; s <= Math.min(d + 10, 180); s += 6) {
      const px = sx + (wx - sx) / d * s, py = sy + (wy - sy) / d * s;
      if (!waterBlocks(px, py) && !waterAt(px, py, -10) && !nav.isBlocked(...nav.cellOf(px, py))) return [px, py];
    }
    return this.shoreNear(sx, sy, 140);
  }

  /** Climb out onto the bank; the boat stays moored where you left it. */
  hopOut(land: [number, number]) {
    const b = this.riding;
    if (!b || this.hopping) return;
    const w = this.w;
    if (Math.hypot(land[0] - b.x, land[1] - b.y) > 200) { const s = this.shoreNear(b.x, b.y, 200); if (!s) return; land = s; }
    this.hopping = true;
    w.path = []; w.pathTarget = null; w.pathArrive = null; w.stick = null; w.body.setVelocity(0, 0);
    const from = [b.x, b.y];
    sfx.blip();
    w.tweens.addCounter({
      from: 0, to: 1, duration: 420, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        w.feet.setPosition(from[0] + (land[0] - from[0]) * p, from[1] + (land[1] - from[1]) * p);
        w.playerImg.setPosition(w.feet.x, w.feet.y + 6 - Math.sin(p * Math.PI) * 26);
      },
      onComplete: () => {
        this.hopping = false;
        this.riding = null;
        w.feet.setPosition(land[0], land[1]); w.body.reset(land[0], land[1]);
        w.lastSafe = [land[0], land[1]];
        this.hops++;
        sfx.thump();
        w.dust.emitParticleAt(land[0], land[1] + 4, 6);
        this.place(b, b.x, b.y, 0);
        w.game.events.emit('boat', false);
      },
    });
  }

  /** Out right away (Wild Woods, build mode, teleport): onto the nearest bank. */
  forceOut() {
    const b = this.riding;
    if (!b) return;
    const s = this.shoreNear(b.x, b.y, 260) ?? b.dock;
    this.riding = null; this.hopping = false;
    this.w.feet.setPosition(s[0], s[1]); this.w.body.reset(s[0], s[1]);
    this.w.lastSafe = [s[0], s[1]];
    this.w.path = []; this.w.pathArrive = null;
    this.place(b, b.x, b.y, 0);
    this.w.game.events.emit('boat', false);
  }

  splash(x: number, y: number) {
    for (let i = 0; i < 2; i++) {
      const r = this.w.fx(x + (i ? 30 : -30), y + 4, 'ripple', 0.25).setDepth(-385).setAlpha(0.7).setBlendMode('ADD');
      this.w.tweens.add({ targets: r, scale: r.scale * 4, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => r.destroy() });
    }
  }

  /** Per frame, after the player moved: the boat carries the rider and bobs. */
  update(time: number, dt: number, speed: number, vx: number) {
    for (const b of this.boats) {
      if (b === this.riding && !this.hopping) {
        if (vx > 20) b.flip = false; else if (vx < -20) b.flip = true;
        const bob = Math.sin(time / 520) * 1.6;
        this.place(b, this.w.feet.x, this.w.feet.y, bob);
        if (speed > 40) {
          this.wakeT -= dt;
          if (this.wakeT <= 0) {
            this.wakeT = 0.22;
            const r = this.w.fx(b.x + (b.flip ? 46 : -46), b.y + 6, 'ripple', 0.16).setDepth(-385).setAlpha(0.6).setBlendMode('ADD');
            this.w.tweens.add({ targets: r, scale: r.scale * 3.4, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => r.destroy() });
          }
        }
      } else {
        const bob = Math.sin(time / 700 + b.x) * 1.2;
        b.back.setY(b.y + bob); b.front.setY(b.y + bob);
      }
    }
  }

  /** Where to cast from the boat: open water out in front (or anywhere around), clear of the hull. */
  castSpot(): [number, number] | null {
    const b = this.riding;
    if (!b || this.hopping) return null;
    const fx = this.w.feet.x, fy = this.w.feet.y;
    const front = b.flip ? Math.PI : 0;
    for (const r of [130, 110, 90, 75]) {
      for (let k = 0; k < 16; k++) {
        const a = front + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
        const x = fx + Math.cos(a) * r, y = fy + Math.sin(a) * r * 0.75;
        if (waterAt(x, y, 12) === b.water && !waterBlocksDeck(x, y)) return [x, y];
      }
    }
    return null;
  }

  /** Did this tap land on your own boat (tap the boat to fish)? */
  hitsBoat(wx: number, wy: number) {
    const b = this.riding;
    return !!b && Math.abs(wx - b.x) < 62 && wy > b.y - 90 && wy < b.y + 22;
  }

  snapshot() {
    const r = this.riding;
    return {
      active: !!r, water: r?.water ?? null, skin: this.boats[0]?.front.texture.key ?? null, castSpot: this.castSpot()?.map(Math.round) ?? null, hopping: this.hopping, boards: this.boards, hops: this.hops,
      boats: this.boats.map((b) => ({ water: b.water, x: Math.round(b.x), y: Math.round(b.y), stand: [Math.round(b.x + (b.it.approach?.[0] ?? 0)), Math.round(b.y + (b.it.approach?.[1] ?? 0))] })),
    };
  }
}

/** The pier deck counts as dry: the boat stays off it. */
function waterBlocksDeck(x: number, y: number) {
  return Math.abs(x - PIER.x) < PIER.w + 40 && y > PIER.y0 - 30 && y < PIER.y1 + 30;
}
