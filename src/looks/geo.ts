// Mount Style Lab (temporary): shared geometry + colour helpers.
// Mounts are described once as ordered "parts" (point outlines in a 512x512 local space);
// each art style renders the same parts its own way, so a style can be judged across mounts.
export type Pt = [number, number];
export type Role = 'major' | 'minor' | 'eye' | 'glint' | 'blush' | 'line';
export type Part = {
  id: string;
  pts: Pt[];
  color: string;
  role: Role;
  smooth?: boolean; // default true
  closed?: boolean; // default true (lines are open)
  width?: number; // line width (local units) for role 'line'
  accent?: boolean; // keeps its colour in the ink style
};
export type MountArt = { id: string; name: string; parts: (phase: number) => Part[] };

export const TAU = Math.PI * 2;

export function rng(seed: string | number): () => number {
  let h = typeof seed === 'number' ? seed >>> 0 : 2166136261;
  if (typeof seed === 'string') for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 20, rot = 0, lump = 0, seed = 'e'): Pt[] {
  const r = rng(seed);
  const out: Pt[] = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + (lump ? (r() - 0.5) * lump : 0);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

export function capsule(x0: number, y0: number, x1: number, y1: number, r: number): Pt[] {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const len = Math.hypot(x1 - x0, y1 - y0) / 2 + r;
  return ellipse(cx, cy, len, r, 16, Math.atan2(y1 - y0, x1 - x0));
}

export function xform(pts: Pt[], f: (p: Pt) => Pt): Pt[] { return pts.map(f); }
export function rotAbout(pts: Pt[], ox: number, oy: number, a: number): Pt[] {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c]);
}
export function scaleAbout(pts: Pt[], ox: number, oy: number, k: number, ky = k): Pt[] {
  return pts.map(([x, y]) => [ox + (x - ox) * k, oy + (y - oy) * ky]);
}
export function shift(pts: Pt[], dx: number, dy: number): Pt[] { return pts.map(([x, y]) => [x + dx, y + dy]); }
export function centroid(pts: Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}
export function bbox(pts: Pt[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Trace a part outline on the context (Catmull-Rom when smooth). Does not fill/stroke. */
export function trace(c: CanvasRenderingContext2D, pts: Pt[], smooth = true, closed = true) {
  const n = pts.length;
  c.beginPath();
  if (n < 2) return;
  c.moveTo(pts[0][0], pts[0][1]);
  if (!smooth) {
    for (let i = 1; i < n; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (closed) c.closePath();
    return;
  }
  const get = (i: number): Pt => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) c.closePath();
}

/** Dense polyline along the (smoothed) outline, for brush-style strokes. */
export function densify(pts: Pt[], smooth = true, closed = true, per = 8): Pt[] {
  const n = pts.length;
  if (!smooth) {
    const out: Pt[] = [];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      for (let k = 0; k < per; k++) out.push([a[0] + (b[0] - a[0]) * k / per, a[1] + (b[1] - a[1]) * k / per]);
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  const get = (i: number): Pt => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const out: Pt[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

// ------------------------------------------------------------------ colour
export type RGB = [number, number, number];
export function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function css([r, g, b]: RGB, a = 1) { return a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
export function mix(a: string | RGB, b: string | RGB, t: number): RGB {
  const A = typeof a === 'string' ? rgb(a) : a, B = typeof b === 'string' ? rgb(b) : b;
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}
/** Cool, slightly purple shadows and warm highlights read richer than plain black/white. */
export const shade = (c: string, t = 0.32) => mix(c, '#2a1f3d', t);
export const light = (c: string, t = 0.3) => mix(c, '#fff6de', t);
export const lum = (c: string) => { const [r, g, b] = rgb(c); return 0.299 * r + 0.587 * g + 0.114 * b; };
