import Phaser from 'phaser';
import { IS_TOUCH } from './device';
import {
  WORLD_W, WORLD_H, POND, PATH_MAIN, PATH_NORTH, PATH_EAST, PATH_SOUTH, SHRINE, GARDEN, COTTAGE, PATH_RIVER_W, PATH_RIVERSIDE, PATH_FOREST, PATH_ORCHARD, PATH_ORCHARD_S, PATH_LAKE } from './layout';

/** Supersampling for object textures (texture px per world unit). */
export const S = 3;
/** Supersampling for the big ground texture. */
/** Ground supersampling: a bit lower on touch devices (iPad) to save memory; it is soft anyway. */
export const GS = IS_TOUCH ? 1.5 : 2;

export type Ctx = CanvasRenderingContext2D;
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hsl = (h: number, s: number, l: number, a = 1) =>
  `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a.toFixed(3)})`;

const pot = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));
export const rr = (rng: Rng, a: number, b: number) => a + (b - a) * rng();

/** Key of the single texture atlas every prop/sprite/FX frame is packed into. */
export const ATLAS = 'atlas';

type Pending = { key: string; canvas: HTMLCanvasElement; w: number; h: number; scale: number };
let pending: Pending[] = [];
/** Texture px per world unit for each atlas frame (so sprites can be normalised to world units). */
export const frameScale: Record<string, number> = {};

/**
 * Paints a w×h (world units) image at `scale` px per unit. By default the result is queued
 * for packing into the shared atlas (one texture = one batch, mipmapped). With
 * `standalone` it becomes its own texture (used for the huge ground painting).
 */
export function canvasTex(
  scene: Phaser.Scene, key: string, w: number, h: number,
  draw: (ctx: Ctx) => void, scale = S, standalone = false,
) {
  const cw = Math.ceil(w * scale);
  const ch = Math.ceil(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  ctx.restore();
  if (standalone) uploadCanvas(scene, key, canvas);
  else pending.push({ key, canvas, w: cw, h: ch, scale });
  frameScale[key] = scale;
}

/**
 * Uploads a painted canvas as a plain (non-Canvas) texture, then releases the canvas backing
 * store. Phaser's CanvasTexture keeps an extra ImageData copy, which would double memory;
 * on iPad Safari canvas memory is tight, so we keep only the GPU copy.
 */
function uploadCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement) {
  const tex = scene.textures.addImage(key, canvas as unknown as HTMLImageElement);
  if (!tex) throw new Error('could not create texture ' + key);
  canvas.width = 1;
  canvas.height = 1;
  return tex;
}

/** Shelf-packs every queued canvas into one power-of-two atlas texture. */
export function buildAtlas(scene: Phaser.Scene) {
  const PAD = 8;
  const items = [...pending].sort((a, b) => b.h - a.h);
  const tryPack = (W: number) => {
    const pos: Record<string, [number, number]> = {};
    let x = PAD, y = PAD, rowH = 0;
    for (const it of items) {
      if (x + it.w + PAD > W) { x = PAD; y += rowH + PAD; rowH = 0; }
      pos[it.key] = [x, y];
      x += it.w + PAD;
      rowH = Math.max(rowH, it.h);
    }
    return { pos, H: y + rowH + PAD };
  };
  let W = 2048;
  let packed = tryPack(W);
  while (packed.H > W * 2 && W < 8192) { W *= 2; packed = tryPack(W); }
  const H = pot(packed.H);
  const atlas = document.createElement('canvas');
  atlas.width = W;
  atlas.height = H;
  const ctx = atlas.getContext('2d')!;
  for (const it of items) {
    const [x, y] = packed.pos[it.key];
    ctx.drawImage(it.canvas, x, y);
    it.canvas.width = 1; // free each piece right away (Safari counts canvas memory)
    it.canvas.height = 1;
  }
  const tex = uploadCanvas(scene, ATLAS, atlas);
  for (const it of items) {
    const [x, y] = packed.pos[it.key];
    tex.add(it.key, 0, x, y, it.w, it.h);
  }
  pending = [];
  console.info(`[cozy] atlas ${W}x${H}, ${items.length} frames`);
}

/** Organic, slightly wobbly closed blob path. */
export function blobPath(ctx: Ctx | Path2D, cx: number, cy: number, rx: number, ry: number, rng: Rng, wobble = 0.12, n = 14) {
  const pts: [number, number][] = [];
  const phase = rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const k = 1 + (rng() * 2 - 1) * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  if ('beginPath' in ctx) ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  const p0 = pts[0];
  const p1 = pts[1];
  ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
  ctx.closePath();
}

export function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string | CanvasGradient, rng: Rng, wobble = 0.12) {
  blobPath(ctx, cx, cy, rx, ry, rng, wobble);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function softCircle(ctx: Ctx, x: number, y: number, r: number, color: [number, number, number], a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  const [h, s, l] = color;
  g.addColorStop(0, hsl(h, s, l, a));
  g.addColorStop(1, hsl(h, s, l, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function dab(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, fill: string) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Catmull-Rom sampler for path centre lines. */
export function sampleSpline(pts: [number, number][], step = 6): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(len / step));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function distToPaths(x: number, y: number, paths: [number, number][][]) {
  if (paths === ALL_PATHS) return pathDist(x, y);
  let best = Infinity;
  for (const p of paths) for (const [px, py] of p) best = Math.min(best, Math.hypot(px - x, py - y));
  return best;
}

export const ALL_PATHS = [PATH_MAIN, PATH_NORTH, PATH_EAST, PATH_SOUTH, PATH_RIVER_W, PATH_RIVERSIDE, PATH_FOREST, PATH_ORCHARD, PATH_ORCHARD_S, PATH_LAKE].map((p) => sampleSpline(p, 10));

// Spatial buckets so path-distance queries stay cheap on the big map.
const PB = 64;
const pathBuckets = new Map<number, [number, number][]>();
for (const p of ALL_PATHS) for (const pt of p) {
  const bx0 = Math.floor((pt[0] - 120) / PB), bx1 = Math.floor((pt[0] + 120) / PB);
  const by0 = Math.floor((pt[1] - 120) / PB), by1 = Math.floor((pt[1] + 120) / PB);
  for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
    const k = by * 1000 + bx;
    let a = pathBuckets.get(k);
    if (!a) pathBuckets.set(k, (a = []));
    a.push(pt);
  }
}
/** Distance to the nearest path centre line (capped at ~120). */
export function pathDist(x: number, y: number) {
  const a = pathBuckets.get(Math.floor(y / PB) * 1000 + Math.floor(x / PB));
  if (!a) return 999;
  let best = 1e9;
  for (const [px, py] of a) { const d = (px - x) ** 2 + (py - y) ** 2; if (d < best) best = d; }
  return Math.sqrt(best);
}

export function pondValue(x: number, y: number, pad = 0) {
  const dx = (x - POND.x) / (POND.rx + pad);
  const dy = (y - POND.y) / (POND.ry + pad);
  return dx * dx + dy * dy;
}

let pondHitCtx: Ctx | null = null;
let pondHitPath: Path2D | null = null;
/** True if (x, y) is in the pond's walkable-limit shape (the painted shoreline, inset a little). */
export function pondHit(x: number, y: number) {
  if (!pondHitCtx) {
    pondHitCtx = document.createElement('canvas').getContext('2d')!;
    pondHitPath = new Path2D();
    blobPath(pondHitPath, POND.x, POND.y, POND.rx - 12, POND.ry - 10, mulberry32(77), 0.08);
  }
  return pondHitCtx.isPointInPath(pondHitPath!, x, y);
}

// ---------------------------------------------------------------- ground

// ---------------------------------------------------------------- props

export type TreeKind = 'oak' | 'blossom' | 'amber' | 'teal' | 'apple' | 'pear';
const TREE_PALETTES: Record<TreeKind, { h: number; s: number; dark: number; mid: number; light: number; hi: [number, number, number] }> = {
  oak: { h: 100, s: 45, dark: 24, mid: 38, light: 52, hi: [70, 70, 70] },
  teal: { h: 150, s: 38, dark: 20, mid: 32, light: 45, hi: [95, 55, 62] },
  blossom: { h: 340, s: 55, dark: 52, mid: 70, light: 82, hi: [20, 90, 92] },
  amber: { h: 32, s: 75, dark: 38, mid: 52, light: 64, hi: [48, 95, 75] },
  apple: { h: 92, s: 48, dark: 28, mid: 42, light: 56, hi: [65, 75, 72] },
  pear: { h: 78, s: 50, dark: 30, mid: 44, light: 58, hi: [58, 80, 74] },
};

export function paintTree(ctx: Ctx, w: number, h: number, kind: TreeKind, seed: number) {
  const rng = mulberry32(seed);
  const pal = TREE_PALETTES[kind];
  const cx = w / 2;
  const base = h - 8;
  const canopyY = h * 0.4;
  const R = w * 0.4;

  // Trunk.
  const tw = w * 0.085;
  const tg = ctx.createLinearGradient(cx - tw, 0, cx + tw, 0);
  tg.addColorStop(0, hsl(28, 35, 46));
  tg.addColorStop(1, hsl(22, 38, 26));
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(cx - tw * 1.9, base);
  ctx.quadraticCurveTo(cx - tw * 0.8, base - 10, cx - tw * 0.7, canopyY + R * 0.4);
  ctx.lineTo(cx + tw * 0.7, canopyY + R * 0.4);
  ctx.quadraticCurveTo(cx + tw * 0.8, base - 10, cx + tw * 1.9, base);
  ctx.quadraticCurveTo(cx, base + 4, cx - tw * 1.9, base);
  ctx.fill();
  ctx.strokeStyle = hsl(22, 30, 22, 0.5);
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const x = cx + rr(rng, -tw * 0.5, tw * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, base - rr(rng, 4, 10));
    ctx.lineTo(x + rr(rng, -2, 2), base - rr(rng, 22, 40));
    ctx.stroke();
  }

  // Canopy blob layout.
  const blobs: [number, number, number][] = [[cx, canopyY, R * 0.62]];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rr(rng, -0.2, 0.2);
    blobs.push([cx + Math.cos(a) * R * 0.52, canopyY + Math.sin(a) * R * 0.42, R * rr(rng, 0.38, 0.5)]);
  }
  // Shadow side / silhouette.
  for (const [x, y, r] of blobs) blob(ctx, x, y + 3, r * 1.05, r, hsl(pal.h, pal.s, pal.dark), rng, 0.1);
  // Mid tone, shifted towards the sun (top-left).
  for (const [x, y, r] of blobs) blob(ctx, x - r * 0.12, y - r * 0.16, r * 0.86, r * 0.8, hsl(pal.h - 4, pal.s + 5, pal.mid), rng, 0.12);
  // Lit tops.
  for (const [x, y, r] of blobs) {
    if (y > canopyY + R * 0.2) continue;
    blob(ctx, x - r * 0.25, y - r * 0.32, r * 0.55, r * 0.45, hsl(pal.h - 10, pal.s + 8, pal.light), rng, 0.15);
  }
  // Leaf dabs: lighter towards top-left.
  for (let i = 0; i < 520; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * R * 0.95;
    const x = cx + Math.cos(a) * d;
    const y = canopyY + Math.sin(a) * d * 0.82;
    const lit = (-(x - cx) - (y - canopyY)) / (R * 1.4); // -1..1
    const l = pal.mid + lit * (pal.light - pal.dark) * 0.6 + rr(rng, -5, 5);
    dab(ctx, x, y, rr(rng, 2.2, 5), rr(rng, 1.4, 3), rng() * Math.PI, hsl(pal.h + rr(rng, -10, 10), pal.s + rr(rng, -5, 10), l, rr(rng, 0.45, 0.85)));
  }
  // Rim light.
  for (let i = 0; i < 40; i++) {
    const a = rr(rng, Math.PI * 1.05, Math.PI * 1.6);
    const x = cx + Math.cos(a) * R * rr(rng, 0.7, 0.95);
    const y = canopyY + Math.sin(a) * R * rr(rng, 0.6, 0.8);
    dab(ctx, x, y, rr(rng, 1.5, 3.5), rr(rng, 1, 2), rng() * 3, hsl(pal.hi[0], pal.hi[1], pal.hi[2], 0.8));
  }
  if (kind === 'apple' || kind === 'pear') {
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * R * 0.85;
      const x = cx + Math.cos(a) * d;
      const y = canopyY + Math.sin(a) * d * 0.8 + 4;
      const fh = kind === 'apple' ? 4 : 52;
      dab(ctx, x, y + 0.8, 3.4, 3.4, 0, hsl(fh, 60, 32, 0.6));
      dab(ctx, x, y, 3.1, kind === 'pear' ? 3.6 : 3.1, 0, hsl(fh, kind === 'apple' ? 72 : 70, kind === 'apple' ? 52 : 60));
      dab(ctx, x - 1, y - 1, 1.1, 1.1, 0, hsl(fh, 80, 86));
    }
  }
  if (kind === 'oak' || kind === 'teal') {
    // A few fruits / blossoms for colour.
    const fruitH = kind === 'oak' ? 5 : 330;
    for (let i = 0; i < (kind === 'oak' ? 7 : 4); i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * R * 0.8;
      const x = cx + Math.cos(a) * d;
      const y = canopyY + Math.sin(a) * d * 0.8;
      dab(ctx, x, y, 2.4, 2.4, 0, hsl(fruitH, 70, 55));
      dab(ctx, x - 0.7, y - 0.7, 0.9, 0.9, 0, hsl(fruitH, 80, 85));
    }
  }
}

function paintPine(ctx: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  const cx = w / 2;
  const base = h - 8;
  ctx.fillStyle = hsl(24, 35, 28);
  ctx.fillRect(cx - 5, base - 30, 10, 30);
  const tiers = 5;
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const ty = base - 22 - k * (h - 50);
    const tw = w * (0.48 - k * 0.32);
    const th = h * 0.28;
    const light = 22 + k * 10;
    ctx.beginPath();
    ctx.moveTo(cx - tw, ty);
    for (let i = 0; i <= 6; i++) {
      const x = cx - tw + (i / 6) * tw * 2;
      ctx.quadraticCurveTo(x - tw / 6, ty + 6, x, ty + rr(rng, -2, 3));
    }
    ctx.lineTo(cx, ty - th);
    ctx.closePath();
    ctx.fillStyle = hsl(160, 35, light);
    ctx.fill();
    // Lit left edge.
    ctx.beginPath();
    ctx.moveTo(cx - tw * 0.9, ty - 2);
    ctx.lineTo(cx, ty - th + 4);
    ctx.lineTo(cx - tw * 0.15, ty - 2);
    ctx.closePath();
    ctx.fillStyle = hsl(140, 35, light + 12, 0.7);
    ctx.fill();
    for (let i = 0; i < 40; i++) {
      const x = cx + rr(rng, -tw * 0.8, tw * 0.6);
      const y = ty - rr(rng, 2, th * 0.7) * (1 - Math.abs(x - cx) / tw);
      dab(ctx, x, y, rr(rng, 1.5, 3), 1, rr(rng, -0.5, 0.5), hsl(rr(rng, 130, 165), 40, light + rr(rng, -4, 16), 0.7));
    }
  }
}

function paintBush(ctx: Ctx, w: number, h: number, seed: number, berry: number | null) {
  const rng = mulberry32(seed);
  const cx = w / 2;
  const cy = h * 0.58;
  const R = w * 0.42;
  const parts: [number, number, number][] = [];
  for (let i = 0; i < 6; i++) parts.push([cx + rr(rng, -R * 0.55, R * 0.55), cy + rr(rng, -R * 0.25, R * 0.2), R * rr(rng, 0.42, 0.58)]);
  for (const [x, y, r] of parts) blob(ctx, x, y + 2, r, r * 0.85, hsl(125, 40, 24), rng);
  for (const [x, y, r] of parts) blob(ctx, x - r * 0.12, y - r * 0.15, r * 0.8, r * 0.66, hsl(110, 45, 38), rng);
  for (const [x, y, r] of parts) blob(ctx, x - r * 0.25, y - r * 0.3, r * 0.42, r * 0.32, hsl(88, 55, 54), rng);
  for (let i = 0; i < 120; i++) {
    const x = cx + rr(rng, -R, R);
    const y = cy + rr(rng, -R * 0.7, R * 0.5);
    if (Math.hypot((x - cx) / R, (y - cy) / (R * 0.75)) > 0.95) continue;
    dab(ctx, x, y, rr(rng, 1.5, 3), rr(rng, 1, 2), rng() * 3, hsl(rr(rng, 85, 125), 45, rr(rng, 30, 60), 0.7));
  }
  if (berry !== null) {
    for (let i = 0; i < 12; i++) {
      const x = cx + rr(rng, -R * 0.8, R * 0.8);
      const y = cy + rr(rng, -R * 0.55, R * 0.35);
      dab(ctx, x, y, 2.2, 2.2, 0, hsl(berry, 70, 62));
      dab(ctx, x - 0.6, y - 0.6, 0.8, 0.8, 0, hsl(berry, 80, 90));
    }
  }
}

function paintFlowers(ctx: Ctx, w: number, h: number, seed: number, hue: number, sat: number, lig: number) {
  const rng = mulberry32(seed);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = w / 2 + rr(rng, -w * 0.32, w * 0.32);
    const top = rr(rng, h * 0.15, h * 0.5);
    ctx.strokeStyle = hsl(105, 45, 32);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w / 2 + rr(rng, -3, 3), h - 2);
    ctx.quadraticCurveTo(x, (top + h) / 2, x, top);
    ctx.stroke();
    dab(ctx, x + 2.5, (top + h) / 2, 3, 1.3, -0.6, hsl(100, 50, 40));
    const pr = rr(rng, 2.4, 3.4);
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      dab(ctx, x + Math.cos(a) * pr, top + Math.sin(a) * pr * 0.8, pr * 0.8, pr * 0.55, a, hsl(hue + rr(rng, -6, 6), sat, lig + rr(rng, -4, 4)));
    }
    dab(ctx, x, top, 1.4, 1.4, 0, hsl(48, 95, 62));
  }
}

function paintTuft(ctx: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  for (let i = 0; i < 14; i++) {
    const x = w / 2 + rr(rng, -w * 0.3, w * 0.3);
    const lean = rr(rng, -w * 0.25, w * 0.25);
    const top = rr(rng, 0, h * 0.5);
    const l = rr(rng, 34, 62);
    ctx.fillStyle = hsl(rr(rng, 80, 120), 50, l);
    ctx.beginPath();
    ctx.moveTo(x - 2, h);
    ctx.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top);
    ctx.quadraticCurveTo(x + lean * 0.3 + 1, (h + top) / 2, x + 2, h);
    ctx.fill();
  }
}

function paintReeds(ctx: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  for (let i = 0; i < 7; i++) {
    const x = w / 2 + rr(rng, -w * 0.3, w * 0.3);
    const lean = rr(rng, -5, 5);
    const top = rr(rng, 2, h * 0.35);
    ctx.strokeStyle = hsl(rr(rng, 85, 110), 40, rr(rng, 36, 52));
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.quadraticCurveTo(x, (h + top) / 2, x + lean, top);
    ctx.stroke();
    if (rng() < 0.55) {
      dab(ctx, x + lean, top + 5, 2.2, 5.5, lean * 0.03, hsl(22, 50, 32));
      dab(ctx, x + lean - 0.7, top + 3.5, 0.8, 2.5, 0, hsl(28, 50, 50));
    }
  }
}

function paintRock(ctx: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  const cx = w / 2;
  const cy = h * 0.6;
  blob(ctx, cx, cy + 2, w * 0.45, h * 0.36, hsl(220, 12, 38), rng, 0.08);
  blob(ctx, cx - 2, cy - 2, w * 0.4, h * 0.3, hsl(215, 12, 58), rng, 0.08);
  blob(ctx, cx - w * 0.12, cy - h * 0.14, w * 0.22, h * 0.13, hsl(210, 15, 74), rng, 0.15);
  // Moss cap.
  for (let i = 0; i < 40; i++) {
    const x = cx + rr(rng, -w * 0.3, w * 0.25);
    const y = cy - h * 0.22 + rr(rng, -3, 5);
    dab(ctx, x, y, rr(rng, 1.5, 3.5), rr(rng, 1, 2), rng() * 3, hsl(rr(rng, 80, 110), 50, rr(rng, 38, 56), 0.85));
  }
}

function paintLilyPad(ctx: Ctx, w: number, h: number, seed: number, flower: boolean) {
  const rng = mulberry32(seed);
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.42;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const notch = rng() * Math.PI * 2;
  ctx.ellipse(cx, cy, r, r * 0.7, 0, notch + 0.35, notch + Math.PI * 2 - 0.05);
  ctx.closePath();
  ctx.fillStyle = hsl(110, 45, 40);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - 2, cy - 1.5, r * 0.6, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fillStyle = hsl(95, 50, 52, 0.6);
  ctx.fill();
  if (flower) {
    for (let p = 0; p < 7; p++) {
      const a = (p / 7) * Math.PI * 2;
      dab(ctx, cx + 3 + Math.cos(a) * 3.5, cy - 3 + Math.sin(a) * 2.2, 3.2, 1.8, a, hsl(335, 70, 82));
    }
    dab(ctx, cx + 3, cy - 3, 1.8, 1.5, 0, hsl(48, 95, 65));
  }
}

function paintMushrooms(ctx: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  for (let i = 0; i < 3; i++) {
    const x = w * (0.25 + i * 0.25) + rr(rng, -2, 2);
    const s = rr(rng, 0.7, 1.1);
    const top = h - 12 * s;
    ctx.fillStyle = hsl(40, 40, 90);
    ctx.fillRect(x - 2 * s, top, 4 * s, 12 * s - 1);
    dab(ctx, x, top, 7 * s, 4.5 * s, 0, hsl(6, 70, 52));
    dab(ctx, x - 2 * s, top - 1.5 * s, 3.5 * s, 1.8 * s, 0, hsl(10, 80, 66));
    for (let d = 0; d < 3; d++) dab(ctx, x + rr(rng, -4, 4) * s, top + rr(rng, -2.5, 1) * s, 0.9 * s, 0.7 * s, 0, hsl(40, 60, 95));
  }
}

function paintCottage(ctx: Ctx, w: number, h: number) {
  const rng = mulberry32(42);
  const cx = w / 2;
  const groundY = h - 6;
  const wallTop = h - 100;
  const wallL = 28;
  const wallR = w - 28;

  // Stone foundation.
  ctx.fillStyle = hsl(215, 10, 48);
  ctx.fillRect(wallL - 4, groundY - 18, wallR - wallL + 8, 18);
  for (let x = wallL - 2; x < wallR; x += 14) {
    dab(ctx, x + 6, groundY - 9, 7, 5.5, 0, hsl(rr(rng, 205, 225), 10, rr(rng, 58, 70)));
  }
  // Walls: warm plaster.
  const wg = ctx.createLinearGradient(wallL, 0, wallR, 0);
  wg.addColorStop(0, hsl(42, 65, 90));
  wg.addColorStop(1, hsl(35, 45, 76));
  ctx.fillStyle = wg;
  ctx.fillRect(wallL, wallTop, wallR - wallL, groundY - 18 - wallTop);
  for (let i = 0; i < 90; i++) dab(ctx, rr(rng, wallL, wallR), rr(rng, wallTop, groundY - 20), rr(rng, 2, 6), rr(rng, 1, 3), rng(), hsl(38, 40, rr(rng, 74, 92), 0.35));
  // Timber frame.
  ctx.strokeStyle = hsl(22, 40, 30);
  ctx.lineWidth = 5;
  ctx.strokeRect(wallL, wallTop + 2, wallR - wallL, groundY - 20 - wallTop);
  for (const x of [wallL + 62, wallR - 62]) {
    ctx.beginPath(); ctx.moveTo(x, wallTop); ctx.lineTo(x, groundY - 18); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(wallL, wallTop + 40); ctx.lineTo(wallL + 62, wallTop + 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wallR - 62, wallTop + 40); ctx.lineTo(wallR, wallTop + 40); ctx.stroke();

  // Windows with warm light + flower boxes.
  for (const x of [wallL + 31, wallR - 31]) {
    const wy = wallTop + 22;
    ctx.fillStyle = hsl(22, 40, 26);
    ctx.fillRect(x - 17, wy - 2, 34, 34);
    const lg = ctx.createRadialGradient(x, wy + 18, 2, x, wy + 15, 22);
    lg.addColorStop(0, hsl(48, 100, 82));
    lg.addColorStop(1, hsl(30, 90, 58));
    ctx.fillStyle = lg;
    ctx.fillRect(x - 14, wy + 1, 28, 28);
    ctx.strokeStyle = hsl(22, 40, 30);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, wy); ctx.lineTo(x, wy + 30); ctx.moveTo(x - 15, wy + 15); ctx.lineTo(x + 15, wy + 15); ctx.stroke();
    // Flower box.
    ctx.fillStyle = hsl(18, 45, 36);
    ctx.fillRect(x - 20, wy + 32, 40, 8);
    for (let i = 0; i < 14; i++) {
      dab(ctx, x - 17 + i * 2.6, wy + 31 - rr(rng, 0, 4), 2.6, 2.2, 0, hsl(105, 45, rr(rng, 32, 45)));
    }
    for (let i = 0; i < 8; i++) {
      dab(ctx, x - 16 + rr(rng, 0, 32), wy + 28 - rr(rng, 0, 5), 2, 2, 0, i % 2 ? hsl(340, 75, 70) : hsl(48, 90, 66));
    }
  }
  // Door.
  {
    const dw = 34;
    const dh = 56;
    const dy = groundY - 18 - dh;
    ctx.fillStyle = hsl(22, 40, 24);
    ctx.beginPath();
    ctx.moveTo(cx - dw / 2 - 3, groundY - 16);
    ctx.lineTo(cx - dw / 2 - 3, dy + 14);
    ctx.arc(cx, dy + 14, dw / 2 + 3, Math.PI, 0);
    ctx.lineTo(cx + dw / 2 + 3, groundY - 16);
    ctx.fill();
    const dg = ctx.createLinearGradient(cx - dw / 2, 0, cx + dw / 2, 0);
    dg.addColorStop(0, hsl(15, 50, 46));
    dg.addColorStop(1, hsl(12, 50, 34));
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.moveTo(cx - dw / 2, groundY - 16);
    ctx.lineTo(cx - dw / 2, dy + 14);
    ctx.arc(cx, dy + 14, dw / 2, Math.PI, 0);
    ctx.lineTo(cx + dw / 2, groundY - 16);
    ctx.fill();
    ctx.strokeStyle = hsl(15, 40, 26, 0.6);
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 9, dy + 4); ctx.lineTo(cx + i * 9, groundY - 17); ctx.stroke(); }
    dab(ctx, cx + 10, dy + 34, 2.2, 2.2, 0, hsl(45, 80, 60));
  }

  // Roof (seen from above at a 3/4 angle): big overhanging thatch-tile shape.
  const roofBottom = wallTop + 8;
  const roofTop = 26;
  const ovh = 22;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wallL - ovh, roofBottom);
  ctx.quadraticCurveTo(cx, roofBottom + 10, wallR + ovh, roofBottom);
  ctx.lineTo(wallR - 18, roofTop + 10);
  ctx.quadraticCurveTo(cx, roofTop - 8, wallL + 18, roofTop + 10);
  ctx.closePath();
  ctx.shadowColor = hsl(20, 40, 15, 0.45);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 6;
  const rg = ctx.createLinearGradient(0, roofTop, 0, roofBottom);
  rg.addColorStop(0, hsl(14, 62, 62));
  rg.addColorStop(1, hsl(8, 55, 42));
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wallL - ovh, roofBottom);
  ctx.quadraticCurveTo(cx, roofBottom + 10, wallR + ovh, roofBottom);
  ctx.lineTo(wallR - 18, roofTop + 10);
  ctx.quadraticCurveTo(cx, roofTop - 8, wallL + 18, roofTop + 10);
  ctx.closePath();
  ctx.clip();
  // Scalloped shingle rows.
  for (let row = 0; row < 9; row++) {
    const y = roofTop + 6 + row * ((roofBottom - roofTop) / 8.5);
    for (let x = wallL - ovh - 10 + (row % 2) * 8; x < wallR + ovh + 10; x += 16) {
      ctx.beginPath();
      ctx.arc(x, y, 8.5, 0, Math.PI);
      ctx.fillStyle = hsl(12 + rr(rng, -4, 4), 55 + rr(rng, -5, 5), 48 + row * 1.2 + rr(rng, -4, 4), 0.55);
      ctx.fill();
      ctx.strokeStyle = hsl(8, 50, 30, 0.5);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  // Sunlit ridge and moss.
  softCircle(ctx, cx - 50, roofTop + 30, 90, [40, 90, 80], 0.35);
  for (let i = 0; i < 60; i++) {
    const x = rr(rng, wallL, wallR);
    const y = rr(rng, roofTop + 20, roofBottom - 5);
    if (rng() < 0.7) continue;
    dab(ctx, x, y, rr(rng, 3, 7), rr(rng, 2, 3), rng(), hsl(rr(rng, 80, 100), 45, rr(rng, 40, 52), 0.8));
  }
  ctx.restore();
  // Ridge line.
  ctx.strokeStyle = hsl(10, 40, 30);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(wallL + 18, roofTop + 10);
  ctx.quadraticCurveTo(cx, roofTop - 8, wallR - 18, roofTop + 10);
  ctx.stroke();
  // Chimney.
  {
    const x = wallR - 60;
    const y = roofTop - 4;
    ctx.fillStyle = hsl(215, 10, 42);
    ctx.fillRect(x - 12, y, 24, 34);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) dab(ctx, x - 6 + c * 12 + (r % 2) * 3, y + 5 + r * 8, 5.5, 3.5, 0, hsl(rr(rng, 205, 225), 10, rr(rng, 55, 68)));
    ctx.fillStyle = hsl(215, 12, 30);
    ctx.fillRect(x - 14, y - 4, 28, 6);
  }
}

function paintLantern(ctx: Ctx, w: number, h: number, lit: boolean) {
  const rng = mulberry32(7);
  const cx = w / 2;
  const stone = (l: number) => hsl(210, 8, l);
  // Base.
  dab(ctx, cx, h - 7, 17, 6, 0, stone(42));
  dab(ctx, cx, h - 9, 15, 5, 0, stone(62));
  // Pillar.
  const pg = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0);
  pg.addColorStop(0, stone(72));
  pg.addColorStop(1, stone(46));
  ctx.fillStyle = pg;
  ctx.fillRect(cx - 7, h - 44, 14, 36);
  // Light box.
  ctx.fillStyle = stone(50);
  ctx.fillRect(cx - 14, h - 50, 28, 6);
  ctx.fillStyle = pg;
  ctx.fillRect(cx - 12, h - 74, 24, 25);
  if (lit) {
    const lg = ctx.createRadialGradient(cx, h - 62, 1, cx, h - 62, 12);
    lg.addColorStop(0, hsl(52, 100, 92));
    lg.addColorStop(0.5, hsl(40, 100, 66));
    lg.addColorStop(1, hsl(22, 95, 50));
    ctx.fillStyle = lg;
  } else {
    ctx.fillStyle = hsl(220, 20, 18);
  }
  ctx.fillRect(cx - 7, h - 70, 14, 16);
  // Roof cap.
  ctx.beginPath();
  ctx.moveTo(cx - 21, h - 72);
  ctx.quadraticCurveTo(cx, h - 78, cx + 21, h - 72);
  ctx.lineTo(cx + 6, h - 88);
  ctx.lineTo(cx - 6, h - 88);
  ctx.closePath();
  ctx.fillStyle = stone(56);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 21, h - 72);
  ctx.lineTo(cx - 6, h - 88);
  ctx.lineTo(cx, h - 88);
  ctx.lineTo(cx - 4, h - 74);
  ctx.closePath();
  ctx.fillStyle = stone(74);
  ctx.fill();
  dab(ctx, cx, h - 90, 4, 3.5, 0, stone(62));
  // Moss.
  for (let i = 0; i < 26; i++) dab(ctx, cx + rr(rng, -18, 18), h - 74 + rr(rng, -3, 2), rr(rng, 1.5, 3), rr(rng, 1, 2), rng(), hsl(rr(rng, 85, 110), 45, rr(rng, 36, 50), 0.85));
  for (let i = 0; i < 14; i++) dab(ctx, cx + rr(rng, -14, 14), h - 10 + rr(rng, -3, 2), rr(rng, 1.5, 3), rr(rng, 1, 2), rng(), hsl(rr(rng, 85, 110), 45, rr(rng, 36, 50), 0.85));
}

export function paintSymbol(ctx: Ctx, cx: number, cy: number, r: number, id: 'dawn' | 'noon' | 'dusk', color: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.16;
  if (id === 'dawn') {
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.3, r * 0.5, Math.PI, 0);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - r, cy + r * 0.38); ctx.lineTo(cx + r, cy + r * 0.38); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = Math.PI + (i + 1) * (Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.68, cy + r * 0.3 + Math.sin(a) * r * 0.68);
      ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + r * 0.3 + Math.sin(a) * r * 0.95);
      ctx.stroke();
    }
  } else if (id === 'noon') {
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
      ctx.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
      ctx.stroke();
    }
  } else {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.3, cy - r * 0.18, r * 0.52, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.restore();
    dab(ctx, cx + r * 0.6, cy + r * 0.45, r * 0.09, r * 0.09, 0, color);
    dab(ctx, cx + r * 0.75, cy - r * 0.7, r * 0.07, r * 0.07, 0, color);
  }
}

function paintGatePillar(ctx: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  const cx = w / 2;
  dab(ctx, cx, h - 7, w * 0.46, 7, 0, hsl(210, 10, 36));
  const pg = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
  pg.addColorStop(0, hsl(205, 10, 72));
  pg.addColorStop(1, hsl(215, 12, 44));
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(cx - 15, h - 8);
  ctx.lineTo(cx - 13, 22);
  ctx.lineTo(cx + 13, 22);
  ctx.lineTo(cx + 15, h - 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hsl(215, 12, 36, 0.6);
  ctx.lineWidth = 1;
  for (let y = 36; y < h - 10; y += 16) { ctx.beginPath(); ctx.moveTo(cx - 14, y); ctx.lineTo(cx + 14, y + rr(rng, -1, 1)); ctx.stroke(); }
  dab(ctx, cx, 20, 19, 7, 0, hsl(210, 10, 52));
  dab(ctx, cx - 3, 17, 13, 4, 0, hsl(205, 10, 74));
  // Carved glyph.
  ctx.strokeStyle = hsl(190, 60, 70, 0.8);
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(cx, 52, 6, 0, Math.PI * 2); ctx.moveTo(cx, 42); ctx.lineTo(cx, 62); ctx.stroke();
  // Ivy.
  for (let i = 0; i < 50; i++) {
    const t = rng();
    const y = 24 + t * (h - 36);
    const x = cx + Math.sin(t * 9 + seed) * 12;
    dab(ctx, x, y, rr(rng, 2, 3.5), rr(rng, 1.4, 2.4), rng() * 3, hsl(rr(rng, 90, 125), 45, rr(rng, 30, 50)));
  }
}

function paintBrambles(ctx: Ctx, w: number, h: number) {
  const rng = mulberry32(99);
  for (let i = 0; i < 26; i++) {
    const x0 = rr(rng, 0, w);
    const y0 = h - rr(rng, 0, 8);
    const x1 = rr(rng, 0, w);
    const y1 = rr(rng, 4, h * 0.5);
    ctx.strokeStyle = hsl(rr(rng, 20, 40), 35, rr(rng, 22, 34));
    ctx.lineWidth = rr(rng, 2.5, 4.5);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + rr(rng, -40, 40), rr(rng, 0, h), x1 + rr(rng, -40, 40), rr(rng, 0, h), x1, y1);
    ctx.stroke();
    // Thorns.
    for (let t = 0; t < 4; t++) {
      const tx = x0 + (x1 - x0) * rng();
      const ty = y0 + (y1 - y0) * rng();
      ctx.fillStyle = hsl(30, 30, 20);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 3, ty - 4); ctx.lineTo(tx + 1, ty + 1); ctx.fill();
    }
  }
  for (let i = 0; i < 90; i++) {
    dab(ctx, rr(rng, 4, w - 4), rr(rng, 6, h - 4), rr(rng, 2, 4), rr(rng, 1.4, 2.4), rng() * 3, hsl(rr(rng, 95, 140), 45, rr(rng, 26, 46)));
  }
  // Glowing violet buds (the magic seal).
  for (let i = 0; i < 12; i++) {
    const x = rr(rng, 10, w - 10);
    const y = rr(rng, 10, h - 12);
    softCircle(ctx, x, y, 7, [275, 90, 75], 0.55);
    dab(ctx, x, y, 2.2, 2.2, 0, hsl(280, 80, 85));
  }
}

function paintChest(ctx: Ctx, w: number, h: number, open: boolean) {
  const cx = w / 2;
  const bodyTop = h - 30;
  dab(ctx, cx, h - 4, w * 0.45, 5, 0, hsl(30, 30, 15, 0.35));
  const bg = ctx.createLinearGradient(0, bodyTop, 0, h);
  bg.addColorStop(0, hsl(24, 55, 44));
  bg.addColorStop(1, hsl(18, 50, 28));
  ctx.fillStyle = bg;
  ctx.fillRect(cx - 24, bodyTop, 48, 26);
  ctx.fillStyle = hsl(45, 75, 58);
  ctx.fillRect(cx - 24, bodyTop + 2, 48, 4);
  ctx.fillRect(cx - 18, bodyTop, 5, 26);
  ctx.fillRect(cx + 13, bodyTop, 5, 26);
  if (open) {
    // Inside glow + raised lid behind.
    ctx.fillStyle = hsl(22, 50, 22);
    ctx.fillRect(cx - 24, bodyTop - 22, 48, 20);
    ctx.fillStyle = hsl(45, 75, 58);
    ctx.fillRect(cx - 24, bodyTop - 22, 48, 3);
    const gg = ctx.createRadialGradient(cx, bodyTop, 1, cx, bodyTop, 26);
    gg.addColorStop(0, hsl(50, 100, 90));
    gg.addColorStop(1, hsl(40, 100, 60, 0));
    ctx.fillStyle = gg;
    ctx.fillRect(cx - 26, bodyTop - 20, 52, 26);
    ctx.fillStyle = hsl(18, 45, 20);
    ctx.fillRect(cx - 22, bodyTop - 2, 44, 5);
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 25, bodyTop + 1);
    ctx.quadraticCurveTo(cx, bodyTop - 20, cx + 25, bodyTop + 1);
    ctx.closePath();
    const lg = ctx.createLinearGradient(0, bodyTop - 18, 0, bodyTop);
    lg.addColorStop(0, hsl(26, 55, 54));
    lg.addColorStop(1, hsl(20, 50, 38));
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.fillStyle = hsl(45, 75, 58);
    ctx.fillRect(cx - 18, bodyTop - 12, 5, 13);
    ctx.fillRect(cx + 13, bodyTop - 12, 5, 13);
    dab(ctx, cx, bodyTop + 4, 4, 5, 0, hsl(48, 85, 66));
    dab(ctx, cx, bodyTop + 5, 1.2, 2, 0, hsl(30, 40, 20));
  }
}

function paintFeather(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  ctx.save();
  ctx.translate(cx, h / 2);
  ctx.rotate(-0.5);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, hsl(52, 100, 80));
  g.addColorStop(1, hsl(36, 95, 55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.45);
  ctx.bezierCurveTo(w * 0.42, -h * 0.25, w * 0.3, h * 0.2, 0, h * 0.32);
  ctx.bezierCurveTo(-w * 0.3, h * 0.2, -w * 0.42, -h * 0.25, 0, -h * 0.45);
  ctx.fill();
  ctx.strokeStyle = hsl(40, 80, 92);
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, -h * 0.42); ctx.lineTo(0, h * 0.46); ctx.stroke();
  ctx.strokeStyle = hsl(36, 80, 45, 0.6);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 8; i++) {
    const y = -h * 0.3 + i * h * 0.075;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w * 0.25, y - 4); ctx.moveTo(0, y); ctx.lineTo(-w * 0.25, y - 4); ctx.stroke();
  }
  ctx.restore();
}

function paintSign(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  ctx.fillStyle = hsl(24, 35, 30);
  ctx.fillRect(cx - 3.5, 22, 7, h - 24);
  ctx.save();
  ctx.shadowColor = hsl(20, 40, 15, 0.4);
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = hsl(30, 45, 50);
  ctx.beginPath();
  ctx.roundRect(cx - 24, 6, 48, 28, 4);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = hsl(34, 50, 62);
  ctx.fillRect(cx - 22, 8, 44, 3);
  ctx.strokeStyle = hsl(24, 40, 32, 0.7);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx - 16, 15 + i * 6); ctx.lineTo(cx + 16 - (i === 2 ? 10 : 0), 15 + i * 6); ctx.stroke(); }
  dab(ctx, cx, h - 2, 8, 2.5, 0, hsl(110, 40, 30, 0.6));
}

function paintFence(ctx: Ctx, w: number, h: number) {
  const post = (x: number) => {
    ctx.fillStyle = hsl(26, 35, 34);
    ctx.fillRect(x - 3, 4, 6, h - 6);
    ctx.fillStyle = hsl(30, 40, 52);
    ctx.fillRect(x - 3, 4, 2.5, h - 6);
  };
  ctx.fillStyle = hsl(28, 38, 44);
  ctx.fillRect(2, 10, w - 4, 4);
  ctx.fillRect(2, 20, w - 4, 4);
  ctx.fillStyle = hsl(32, 45, 58);
  ctx.fillRect(2, 10, w - 4, 1.5);
  ctx.fillRect(2, 20, w - 4, 1.5);
  post(4);
  post(w - 4);
}

// The little traveller: dir 0=front, 1=front¾, 2=side, 3=back¾, 4=back. step 0..2.
export function paintSoft(ctx: Ctx, size: number, inner = 1, falloff = 1) {
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `rgba(255,255,255,${inner})`);
  g.addColorStop(0.35 * falloff, `rgba(255,255,255,${inner * 0.55})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}


// ---------------------------------------------------------------- critters

function paintButterfly(ctx: Ctx, w: number, h: number) {
  // Light wings so per-instance tints read well; darker rims and dots for detail.
  const cx = w / 2;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx, h / 2);
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.ellipse(4, -2.5, 4.6, 3.6, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = hsl(45, 30, 96);
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = hsl(30, 30, 35, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(3.2, 2.6, 3, 2.4, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = hsl(45, 30, 90);
    ctx.fill();
    ctx.stroke();
    dab(ctx, 5, -3, 1.1, 1.1, 0, hsl(30, 40, 30, 0.6));
    ctx.restore();
  }
  ctx.strokeStyle = hsl(25, 30, 20);
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(cx, h / 2 - 3.5); ctx.lineTo(cx, h / 2 + 4); ctx.stroke();
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(cx, h / 2 - 3.5); ctx.lineTo(cx - 2, h / 2 - 6.5); ctx.moveTo(cx, h / 2 - 3.5); ctx.lineTo(cx + 2, h / 2 - 6.5); ctx.stroke();
}

function paintBird(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = hsl(25, 30, 30);
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 1);
  ctx.quadraticCurveTo(cx - 5, cy - 6, cx, cy - 1);
  ctx.quadraticCurveTo(cx + 5, cy - 6, cx + 10, cy - 1);
  ctx.quadraticCurveTo(cx + 5, cy - 2, cx, cy + 2);
  ctx.quadraticCurveTo(cx - 5, cy - 2, cx - 10, cy - 1);
  ctx.fill();
  dab(ctx, cx, cy + 0.5, 2, 3.4, 0, hsl(25, 30, 26));
  dab(ctx, cx, cy - 2.6, 1.6, 1.6, 0, hsl(20, 35, 36));
  dab(ctx, cx, cy - 4.2, 0.6, 0.9, 0, hsl(40, 80, 55));
}

function paintFrog(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const by = h - 3;
  dab(ctx, cx - 7, by - 1, 4, 2.4, 0.3, hsl(100, 45, 34)); // back legs
  dab(ctx, cx + 7, by - 1, 4, 2.4, -0.3, hsl(100, 45, 34));
  dab(ctx, cx, by - 6, 8.5, 6.5, 0, hsl(98, 48, 42));
  dab(ctx, cx - 1.5, by - 8, 5, 3, 0, hsl(85, 55, 58, 0.8));
  dab(ctx, cx, by - 3.2, 5.5, 2.6, 0, hsl(70, 50, 76));
  for (const sx of [-1, 1]) {
    dab(ctx, cx + sx * 4.2, by - 12, 3.1, 3.1, 0, hsl(98, 48, 44));
    dab(ctx, cx + sx * 4.2, by - 12.2, 2, 2, 0, hsl(45, 30, 96));
    dab(ctx, cx + sx * 4.4, by - 12, 1.1, 1.3, 0, hsl(250, 30, 15));
    dab(ctx, cx + sx * 3.2, by - 6.2, 1.5, 0.9, 0, hsl(350, 70, 70, 0.6));
  }
  ctx.strokeStyle = hsl(100, 40, 22);
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(cx, by - 8, 2.4, 0.3, Math.PI - 0.3); ctx.stroke();
  dab(ctx, cx - 4, by - 0.5, 2, 1.2, 0, hsl(100, 45, 36));
  dab(ctx, cx + 4, by - 0.5, 2, 1.2, 0, hsl(100, 45, 36));
}

function paintDuck(ctx: Ctx, w: number, h: number, baby: boolean) {
  const cx = w / 2 - 2;
  const cy = h * 0.62;
  if (baby) {
    dab(ctx, cx, cy, 6.5, 4.5, 0, hsl(48, 90, 66));
    dab(ctx, cx - 1.5, cy - 1.5, 3.5, 2, 0, hsl(52, 100, 82, 0.8));
    dab(ctx, cx + 5, cy - 4.5, 3.6, 3.4, 0, hsl(48, 90, 64));
    dab(ctx, cx + 8.6, cy - 4, 1.8, 1, 0, hsl(28, 90, 58));
    dab(ctx, cx + 6, cy - 5.4, 0.8, 0.9, 0, hsl(250, 30, 15));
    return;
  }
  dab(ctx, cx, cy, 11, 6.5, 0, hsl(30, 35, 52));
  dab(ctx, cx - 2, cy - 2, 7, 3.2, 0, hsl(32, 35, 66, 0.8));
  dab(ctx, cx - 3, cy + 0.5, 6, 3, 0.1, hsl(28, 30, 40)); // wing
  dab(ctx, cx - 1, cy + 0.6, 1.8, 1.4, 0, hsl(220, 70, 55)); // speculum
  ctx.fillStyle = hsl(25, 25, 25);
  ctx.beginPath(); ctx.moveTo(cx - 10, cy - 2); ctx.lineTo(cx - 14, cy - 4.5); ctx.lineTo(cx - 10.5, cy + 0.5); ctx.fill();
  dab(ctx, cx + 8, cy - 3.5, 2.6, 3.6, 0, hsl(0, 0, 96)); // neck ring area
  dab(ctx, cx + 9, cy - 7.5, 4.4, 4, 0, hsl(150, 55, 32));
  dab(ctx, cx + 8, cy - 8.8, 2, 1.2, 0, hsl(150, 50, 55, 0.6));
  dab(ctx, cx + 13.8, cy - 6.8, 2.8, 1.3, 0, hsl(46, 90, 58));
  dab(ctx, cx + 10, cy - 8.2, 0.9, 1, 0, hsl(250, 30, 12));
}

function paintCat(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const by = h - 3;
  const fur = hsl(28, 75, 60);
  const furDark = hsl(24, 70, 46);
  dab(ctx, cx, by - 8, 11, 8.5, 0, fur); // body loaf
  dab(ctx, cx - 3, by - 11, 6, 4, 0, hsl(32, 85, 72, 0.7));
  ctx.strokeStyle = furDark;
  ctx.lineWidth = 1.4;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(cx + i * 4.5, by - 4, 6, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke(); }
  dab(ctx, cx, by - 4, 5, 3.4, 0, hsl(35, 40, 94)); // chest
  dab(ctx, cx - 3.6, by - 0.8, 2.6, 1.6, 0, hsl(35, 40, 94)); // paws
  dab(ctx, cx + 3.6, by - 0.8, 2.6, 1.6, 0, hsl(35, 40, 94));
  // Head.
  const hy = by - 17;
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.moveTo(cx - 7.5, hy - 2); ctx.lineTo(cx - 6, hy - 10); ctx.lineTo(cx - 1.5, hy - 5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 7.5, hy - 2); ctx.lineTo(cx + 6, hy - 10); ctx.lineTo(cx + 1.5, hy - 5); ctx.fill();
  dab(ctx, cx - 5.5, hy - 6, 1.3, 2, -0.3, hsl(350, 60, 78));
  dab(ctx, cx + 5.5, hy - 6, 1.3, 2, 0.3, hsl(350, 60, 78));
  dab(ctx, cx, hy, 8, 6.6, 0, fur);
  dab(ctx, cx - 2.5, hy - 2.5, 3.5, 2, 0, hsl(32, 85, 72, 0.7));
  ctx.strokeStyle = furDark;
  ctx.lineWidth = 1.2;
  for (const dx of [-2, 0, 2]) { ctx.beginPath(); ctx.moveTo(cx + dx, hy - 6); ctx.lineTo(cx + dx, hy - 3.6); ctx.stroke(); }
  dab(ctx, cx, hy + 2.6, 3.4, 2.2, 0, hsl(35, 40, 94));
  // Happy closed eyes.
  ctx.strokeStyle = hsl(25, 40, 18);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx - 3.2, hy + 0.6, 1.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + 3.2, hy + 0.6, 1.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  dab(ctx, cx, hy + 2, 0.9, 0.6, 0, hsl(350, 60, 65));
  dab(ctx, cx - 5, hy + 2.6, 1.6, 1, 0, hsl(350, 80, 75, 0.6));
  dab(ctx, cx + 5, hy + 2.6, 1.6, 1, 0, hsl(350, 80, 75, 0.6));
}

function paintCatTail(ctx: Ctx, w: number, h: number) {
  ctx.strokeStyle = hsl(28, 75, 58);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(2, h - 3);
  ctx.quadraticCurveTo(w * 0.6, h - 2, w - 3, 4);
  ctx.stroke();
  ctx.strokeStyle = hsl(24, 70, 46);
  ctx.lineWidth = 4.2;
  ctx.beginPath(); ctx.moveTo(w * 0.62, h * 0.55); ctx.lineTo(w * 0.7, h * 0.42); ctx.stroke();
  ctx.strokeStyle = hsl(35, 40, 94);
  ctx.beginPath(); ctx.moveTo(w - 4, 6); ctx.lineTo(w - 3, 4); ctx.stroke();
}

function paintFish(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = 'rgba(20,40,60,1)';
  ctx.beginPath();
  ctx.ellipse(w * 0.45, h / 2, w * 0.33, h * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.75, h / 2);
  ctx.lineTo(w - 1, h * 0.15);
  ctx.lineTo(w - 1, h * 0.85);
  ctx.closePath();
  ctx.fill();
}

function paintHeart(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = hsl(350, 85, 70);
  ctx.beginPath();
  ctx.moveTo(w / 2, h - 1);
  ctx.bezierCurveTo(-1, h * 0.45, w * 0.2, -1, w / 2, h * 0.3);
  ctx.bezierCurveTo(w * 0.8, -1, w + 1, h * 0.45, w / 2, h - 1);
  ctx.fill();
  dab(ctx, w * 0.32, h * 0.32, 1.2, 0.8, -0.5, 'rgba(255,255,255,0.8)');
}

function paintLeafBig(ctx: Ctx, w: number, h: number) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(0.4);
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, 0);
  ctx.quadraticCurveTo(0, -h * 0.55, w * 0.42, 0);
  ctx.quadraticCurveTo(0, h * 0.55, -w * 0.42, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(-w * 0.4, 0); ctx.lineTo(w * 0.4, 0); ctx.stroke();
  ctx.restore();
}

import { paintAll2 } from './art2';

export function paintAll(scene: Phaser.Scene) {

  const trees: [TreeKind, number][] = [['oak', 1], ['oak', 2], ['teal', 3], ['blossom', 4], ['amber', 5], ['teal', 6]];
  trees.forEach(([k, seed], i) => canvasTex(scene, `tree${i}`, 170, 210, (c) => paintTree(c, 170, 210, k, seed)));
  for (let i = 0; i < 2; i++) canvasTex(scene, `pine${i}`, 110, 190, (c) => paintPine(c, 110, 190, 20 + i));
  canvasTex(scene, 'bush0', 70, 56, (c) => paintBush(c, 70, 56, 31, null));
  canvasTex(scene, 'bush1', 70, 56, (c) => paintBush(c, 70, 56, 32, 350));
  canvasTex(scene, 'bush2', 70, 56, (c) => paintBush(c, 70, 56, 33, 210));
  const flowers: [number, number, number][] = [[340, 75, 76], [48, 90, 64], [270, 55, 76], [0, 0, 96], [18, 85, 66]];
  flowers.forEach(([h, s, l], i) => canvasTex(scene, `flower${i}`, 30, 34, (c) => paintFlowers(c, 30, 34, 40 + i, h, s, l)));
  for (let i = 0; i < 3; i++) canvasTex(scene, `tuft${i}`, 24, 20, (c) => paintTuft(c, 24, 20, 50 + i));
  for (let i = 0; i < 2; i++) canvasTex(scene, `reeds${i}`, 30, 52, (c) => paintReeds(c, 30, 52, 60 + i));
  for (let i = 0; i < 3; i++) canvasTex(scene, `rock${i}`, 48 + i * 10, 36 + i * 6, (c) => paintRock(c, 48 + i * 10, 36 + i * 6, 70 + i));
  for (let i = 0; i < 3; i++) canvasTex(scene, `lily${i}`, 30, 24, (c) => paintLilyPad(c, 30, 24, 80 + i, i === 0));
  canvasTex(scene, 'mushrooms', 34, 22, (c) => paintMushrooms(c, 34, 22, 90));
  canvasTex(scene, 'cottage', 280, 250, (c) => paintCottage(c, 280, 250));
  canvasTex(scene, 'lantern_off', 50, 96, (c) => paintLantern(c, 50, 96, false));
  canvasTex(scene, 'lantern_on', 50, 96, (c) => paintLantern(c, 50, 96, true));
  for (const id of ['dawn', 'noon', 'dusk'] as const) {
    canvasTex(scene, `sym_${id}`, 32, 32, (c) => paintSymbol(c, 16, 16, 13, id, '#ffffff'));
  }
  canvasTex(scene, 'pillar0', 44, 120, (c) => paintGatePillar(c, 44, 120, 1));
  canvasTex(scene, 'pillar1', 44, 120, (c) => paintGatePillar(c, 44, 120, 2));
  canvasTex(scene, 'brambles', 130, 96, (c) => paintBrambles(c, 130, 96));
  canvasTex(scene, 'chest_closed', 60, 50, (c) => paintChest(c, 60, 50, false));
  canvasTex(scene, 'chest_open', 60, 50, (c) => paintChest(c, 60, 50, true));
  canvasTex(scene, 'feather', 30, 44, (c) => paintFeather(c, 30, 44));
  canvasTex(scene, 'sign', 56, 64, (c) => paintSign(c, 56, 64));
  canvasTex(scene, 'fence', 52, 34, (c) => paintFence(c, 52, 34));

  // FX textures.
  canvasTex(scene, 'soft', 64, 64, (c) => paintSoft(c, 64), 1);
  canvasTex(scene, 'dot', 16, 16, (c) => paintSoft(c, 16, 1, 0.6), 2);
  canvasTex(scene, 'glow', 256, 256, (c) => paintSoft(c, 256, 0.9, 0.7), 1);
  canvasTex(scene, 'shadow', 64, 32, (c) => {
    const g = c.createRadialGradient(32, 16, 0, 32, 16, 32);
    g.addColorStop(0, 'rgba(25,35,30,0.55)');
    g.addColorStop(0.6, 'rgba(25,35,30,0.3)');
    g.addColorStop(1, 'rgba(25,35,30,0)');
    c.save(); c.scale(1, 0.5); c.fillStyle = g; c.fillRect(0, 0, 64, 64); c.restore();
  }, 2);
  canvasTex(scene, 'spark', 24, 24, (c) => {
    c.fillStyle = '#fff';
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 ? 2.2 : 11;
      c.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
    }
    c.fill();
    paintSoft(c, 24, 0.8, 0.4);
  }, 2);
  canvasTex(scene, 'leaf', 12, 8, (c) => { dab(c, 6, 4, 5, 2.5, 0.3, hsl(95, 55, 50)); dab(c, 5, 3.4, 3, 1, 0.3, hsl(80, 60, 70)); }, 3);
  canvasTex(scene, 'petal', 10, 8, (c) => { dab(c, 5, 4, 4, 2.4, 0.4, hsl(340, 75, 85)); dab(c, 4.4, 3.4, 2, 1, 0.4, '#fff'); }, 3);
  canvasTex(scene, 'smoke', 64, 64, (c) => paintSoft(c, 64, 0.7, 1.2), 1);
  canvasTex(scene, 'ray', 64, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,240,200,0)');
    g.addColorStop(0.5, 'rgba(255,240,200,1)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 512);
    const v = c.createLinearGradient(0, 0, 0, 512);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.3, 'rgba(0,0,0,1)');
    v.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = v;
    c.fillRect(0, 0, 64, 512);
  }, 1);
  canvasTex(scene, 'cloud', 256, 256, (c) => {
    const rng = mulberry32(5);
    for (let i = 0; i < 9; i++) softCircle(c, rr(rng, 80, 176), rr(rng, 100, 156), rr(rng, 40, 72), [0, 0, 0], 0.5);
  }, 1);
  canvasTex(scene, 'ripple', 64, 32, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(32, 16, 28, 13, 0, 0, Math.PI * 2); c.stroke();
  }, 2);
  canvasTex(scene, 'vignette', 256, 256, (c) => {
    const g = c.createRadialGradient(128, 118, 60, 128, 128, 182);
    g.addColorStop(0, 'rgba(40,24,48,0)');
    g.addColorStop(0.55, 'rgba(40,24,48,0.10)');
    g.addColorStop(1, 'rgba(40,24,48,0.55)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  }, 1);
  canvasTex(scene, 'butterfly', 18, 16, (c) => paintButterfly(c, 18, 16));
  canvasTex(scene, 'bird', 22, 14, (c) => paintBird(c, 22, 14));
  canvasTex(scene, 'frog', 24, 20, (c) => paintFrog(c, 24, 20));
  canvasTex(scene, 'duck', 34, 24, (c) => paintDuck(c, 34, 24, false));
  canvasTex(scene, 'duckling', 22, 14, (c) => paintDuck(c, 22, 14, true));
  canvasTex(scene, 'cat', 30, 34, (c) => paintCat(c, 30, 34));
  canvasTex(scene, 'cattail', 18, 16, (c) => paintCatTail(c, 18, 16));
  canvasTex(scene, 'fish', 26, 10, (c) => paintFish(c, 26, 10));
  canvasTex(scene, 'heart', 12, 11, (c) => paintHeart(c, 12, 11));
  canvasTex(scene, 'leafw', 14, 9, (c) => paintLeafBig(c, 14, 9), 3);
  canvasTex(scene, 'white', 4, 4, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); }, 2);
  paintAll2(scene);
  buildAtlas(scene);
}
