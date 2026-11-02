// 47 (Walker, Nov 2): the in-game art styles. The Style Lab paints its two sample mounts from vector
// "parts" (styles.ts); the live game's 22 friends are painted straight onto canvases, so here each
// style is a pixel pass over a friend's own painting (body, wings, cape) that gives it that style's
// look: bold cel bands + ink outline, watercolour bleed + pigment edges, matte gouache brushwork, soft
// lit clay, sumi-e ink wash with one splash of colour, or chunky hi-res pixels. Hand-made per-mount art
// in each style is task 38; until then these passes are the in-game look. Results are cached per
// (style, frame) and uploaded as their own small textures on first use.
import Phaser from 'phaser';
import { atlasOf, frameScale, repaint, texSource, uploadTex } from '../art';

export type ArtStyleId = 'classic' | 'watercolor' | 'cel' | 'gouache' | 'clay' | 'ink' | 'pixel';

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** Smooth value noise in [0,1). */
function vnoise(x: number, y: number, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Separable box blur of a single channel (r px), repeated `n` times (~gaussian). */
function blur(src: Float32Array, w: number, h: number, r: number, n = 2) {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  r = Math.max(1, Math.round(r));
  const k = 1 / (2 * r + 1);
  for (let pass = 0; pass < n; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0; const row = y * w;
      for (let x = -r; x <= r; x++) acc += a[row + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) { b[row + x] = acc * k; acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { a[y * w + x] = acc * k; acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]; }
    }
  }
  return a;
}
function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

type Px = { w: number; h: number; d: Uint8ClampedArray; A: Float32Array; k: number };

/** Pad the canvas so outlines and bleeds have room past the painting's edge. */
function load(src: HTMLCanvasElement, pad: number): { cv: HTMLCanvasElement; px: Px } {
  const cv = document.createElement('canvas');
  cv.width = src.width + pad * 2; cv.height = src.height + pad * 2;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(src, pad, pad);
  const img = c.getImageData(0, 0, cv.width, cv.height), d = img.data;
  const A = new Float32Array(cv.width * cv.height);
  for (let i = 0; i < A.length; i++) A[i] = d[i * 4 + 3] / 255;
  return { cv, px: { w: cv.width, h: cv.height, d, A, k: 1 } };
}
function store(cv: HTMLCanvasElement, px: Px) {
  const c = cv.getContext('2d')!;
  c.putImageData(new ImageData(px.d as unknown as Uint8ClampedArray<ArrayBuffer>, px.w, px.h), 0, 0);
}

/** Per-pixel colour map on opaque pixels (rgb in 0..1). */
function mapColor(px: Px, f: (r: number, g: number, b: number, x: number, y: number, i: number) => [number, number, number]) {
  const { w, d, A } = px;
  for (let i = 0; i < A.length; i++) {
    if (A[i] <= 0.004) continue;
    const o = i * 4, x = i % w, y = (i / w) | 0;
    const [r, g, b] = f(d[o] / 255, d[o + 1] / 255, d[o + 2] / 255, x, y, i);
    d[o] = clamp(r) * 255; d[o + 1] = clamp(g) * 255; d[o + 2] = clamp(b) * 255;
  }
}
/** Paint an outline of colour `col` (0..1 rgb) and strength `a` around the silhouette, `r` px wide. */
function outline(px: Px, r: number, col: [number, number, number] | null, a = 1, rough = 0) {
  const { w, h, d, A } = px;
  const g = blur(A, w, h, Math.max(1, r * 0.55), 2);
  for (let i = 0; i < A.length; i++) {
    const o = i * 4;
    // Outer ring: blurred alpha past the edge -> ink; inner rim: pixels with a transparent neighbour nearby.
    const edge = clamp((g[i] - 0.04) * 4) * (1 - A[i]) + clamp((1 - g[i]) * 2.2) * A[i] * 0.9;
    let e = edge * a;
    if (rough) e *= 1 - rough * clamp(vnoise((i % w) / 6, ((i / w) | 0) / 6, 7) * 1.6 - 0.5);
    if (e <= 0.01) continue;
    const base = A[i];
    const cr = col ? col[0] : (d[o] / 255) * 0.35, cg = col ? col[1] : (d[o + 1] / 255) * 0.3, cb = col ? col[2] : (d[o + 2] / 255) * 0.35;
    const na = clamp(base + e * (1 - base));
    const t = na > 0 ? e / na : 0;
    d[o] = ((d[o] / 255) * (1 - t) + cr * t) * 255;
    d[o + 1] = ((d[o + 1] / 255) * (1 - t) + cg * t) * 255;
    d[o + 2] = ((d[o + 2] / 255) * (1 - t) + cb * t) * 255;
    d[o + 3] = na * 255; A[i] = na;
  }
}

const PASSES: Record<Exclude<ArtStyleId, 'classic'>, { pad: number; run: (px: Px) => void; nearest?: boolean }> = {
  // Bold cel: flat bands of colour (3 light steps per hue), a touch more saturation, a thick dark ink line.
  cel: {
    pad: 6,
    run(px) {
      mapColor(px, (r, g, b) => {
        const [h, s, l] = rgb2hsl(r, g, b);
        const band = l < 0.3 ? 0.22 : l < 0.55 ? 0.45 : l < 0.8 ? 0.68 : 0.9;
        return hsl2rgb(h, clamp(s * 1.18), band * 0.7 + l * 0.3);
      });
      outline(px, 5, [0.16, 0.1, 0.16], 1);
    },
  },
  // Watercolour: paler pigment on paper, darker pooled edges, granulation, a soft bleed past the line
  // and a faint pencil sketch line.
  watercolor: {
    pad: 6,
    run(px) {
      const { w, h, d, A } = px;
      const g = blur(A, w, h, 4, 2);
      mapColor(px, (r, gg, b, x, y, i) => {
        const [hh, s, l] = rgb2hsl(r, gg, b);
        const pool = clamp((1 - g[i]) * 2.4) * 0.22;
        const gran = (vnoise(x / 3, y / 3, 1) - 0.5) * 0.1 + (vnoise(x / 14, y / 14, 2) - 0.5) * 0.08;
        return hsl2rgb(hh, s * 0.85, clamp(l * 0.86 + 0.14 - pool + gran));
      });
      // Bleed: a pale wash just outside the shape.
      const bl = blur(A, w, h, 3, 2);
      for (let i = 0; i < A.length; i++) {
        if (A[i] > 0.5 || bl[i] < 0.02) continue;
        let j = i, best = 0;
        for (const off of [-3, 3, -3 * w, 3 * w]) { const q = i + off; if (q >= 0 && q < A.length && A[q] > best) { best = A[q]; j = q; } }
        if (!best) continue;
        const o = i * 4, s = j * 4, na = Math.max(A[i], bl[i] * 0.4);
        d[o] = d[s]; d[o + 1] = d[s + 1]; d[o + 2] = d[s + 2]; d[o + 3] = na * 255;
      }
      for (let i = 0; i < A.length; i++) A[i] = d[i * 4 + 3] / 255;
      outline(px, 2, [0.35, 0.27, 0.22], 0.45, 0.8);
    },
  },
  // Gouache: thick matte paint. Softer highlights, a few colour steps, visible brush strokes, warm soft line.
  gouache: {
    pad: 4,
    run(px) {
      mapColor(px, (r, g, b, x, y) => {
        const [h, s, l] = rgb2hsl(r, g, b);
        const stroke = (vnoise(x / 3 + y / 9, y / 2.2, 3) - 0.5) * 0.12;
        const ll = Math.round(clamp(l * 0.9 + 0.04) * 6) / 6 * 0.6 + l * 0.4;
        return hsl2rgb(h + stroke * 0.04, clamp(s * 0.92 + 0.04), clamp(Math.min(ll, 0.86) + stroke));
      });
      outline(px, 3, null, 0.75, 0.4);
    },
  },
  // Soft 3D clay: smoothed colour, lit from the top-left off a height map of the silhouette, a waxy sheen.
  clay: {
    pad: 4,
    run(px) {
      const { w, h, d, A } = px;
      const H = blur(A, w, h, 7, 3);
      const cr = blur(Float32Array.from(A, (_, i) => d[i * 4] / 255 * A[i]), w, h, 1, 1);
      const cg = blur(Float32Array.from(A, (_, i) => d[i * 4 + 1] / 255 * A[i]), w, h, 1, 1);
      const cb = blur(Float32Array.from(A, (_, i) => d[i * 4 + 2] / 255 * A[i]), w, h, 1, 1);
      const ca = blur(A, w, h, 1, 1);
      mapColor(px, (_r, _g, _b, x, y, i) => {
        const a = Math.max(0.001, ca[i]);
        let r = cr[i] / a, g = cg[i] / a, b = cb[i] / a;
        const xm = Math.max(0, x - 2), xp = Math.min(w - 1, x + 2), ym = Math.max(0, y - 2), yp = Math.min(h - 1, y + 2);
        const nx = H[y * w + xm] - H[y * w + xp], ny = H[ym * w + x] - H[yp * w + x];
        const lit = clamp(0.5 + (nx * 0.7 + ny * 0.9) * 2.6, 0, 1);
        const shade = 0.78 + lit * 0.36, spec = Math.pow(lit, 6) * 0.35;
        const [hh, s, l] = rgb2hsl(r, g, b);
        [r, g, b] = hsl2rgb(hh, clamp(s * 1.08), clamp(l * shade + spec));
        return [r, g, b];
      });
      for (let i = 0; i < A.length; i++) { const v = Math.min(A[i], clamp((H[i] - 0.18) * 3)); d[i * 4 + 3] = Math.max(v, A[i] > 0.9 ? A[i] * 0.85 : v) * 255; }
    },
  },
  // Ink and wash: warm grey washes on rice paper; the warm reds, oranges and golds stay as the one
  // splash of colour; a calligraphic black brush line with dry-brush gaps.
  ink: {
    pad: 5,
    run(px) {
      mapColor(px, (r, g, b, x, y) => {
        const [h, s, l] = rgb2hsl(r, g, b);
        const warm = (h < 0.13 || h > 0.94) && s > 0.45 && l > 0.25 && l < 0.8;
        const wash = (vnoise(x / 10, y / 10, 5) - 0.5) * 0.08;
        if (warm) return hsl2rgb(h, s * 0.85, clamp(l * 0.95 + 0.05 + wash));
        const v = clamp(1 - (1 - l) * 0.62 + wash);
        return [v * 0.99, v * 0.96, v * 0.9];
      });
      outline(px, 4, [0.09, 0.07, 0.1], 0.95, 1);
    },
  },
  // Hi-res pixel art: chunky 4-px pixels, a limited palette, hard alpha and a 1-pixel dark outline.
  pixel: {
    pad: 8,
    nearest: true,
    run(px) {
      const { w, h, d } = px, B = 4, W = Math.ceil(w / B), Hh = Math.ceil(h / B);
      const lo = new Float32Array(W * Hh * 4);
      for (let by = 0; by < Hh; by++) for (let bx = 0; bx < W; bx++) {
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let y = by * B; y < Math.min(h, by * B + B); y++) for (let x = bx * B; x < Math.min(w, bx * B + B); x++) {
          const o = (y * w + x) * 4, al = d[o + 3] / 255; r += d[o] * al; g += d[o + 1] * al; b += d[o + 2] * al; a += al; n++;
        }
        const q = (v: number) => Math.min(255, Math.round(v / 36) * 36), j = (by * W + bx) * 4, cov = a / n;
        if (cov < 0.45) continue;
        lo[j] = q(r / a); lo[j + 1] = q(g / a); lo[j + 2] = q(b / a); lo[j + 3] = 255;
      }
      const out = Float32Array.from(lo);
      for (let by = 0; by < Hh; by++) for (let bx = 0; bx < W; bx++) {
        const j = (by * W + bx) * 4; if (lo[j + 3]) continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = bx + dx, Y = by + dy; return X >= 0 && Y >= 0 && X < W && Y < Hh && lo[(Y * W + X) * 4 + 3] > 0; });
        if (nb) { out[j] = 34; out[j + 1] = 24; out[j + 2] = 40; out[j + 3] = 255; }
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4, j = (((y / B) | 0) * W + ((x / B) | 0)) * 4;
        d[o] = out[j]; d[o + 1] = out[j + 1]; d[o + 2] = out[j + 2]; d[o + 3] = out[j + 3];
      }
    },
  },
};

/** Restyle a canvas in place-ish: returns a new (padded) canvas and the pad used. */
export function stylize(src: HTMLCanvasElement, style: ArtStyleId): { cv: HTMLCanvasElement; pad: number } {
  if (style === 'classic') return { cv: src, pad: 0 };
  const P = PASSES[style];
  const { cv, px } = load(src, P.pad);
  P.run(px);
  store(cv, px);
  return { cv, pad: P.pad };
}

/** Stats for tests: how many styled textures were made and how long they took. */
export const fxStats = { made: 0, ms: 0 };

/**
 * Texture + frame to draw atlas frame `key` in `style` (made on first use). Also returns the extra
 * origin shift the padding needs: callers keep their origin by using `origin()` below.
 */
export function styledTex(scene: Phaser.Scene, key: string, style: ArtStyleId): [string, string] {
  if (style === 'classic' || !texSource[key]) return [atlasOf(key), key];
  const tk = `look:${style}:${key}`;
  if (!scene.textures.exists(tk)) {
    const t0 = performance.now();
    const src = repaint(key);
    if (!src) return [atlasOf(key), key];
    const { cv, pad } = stylize(src, style);
    const tex = uploadTex(scene, tk, cv);
    if (PASSES[style as Exclude<ArtStyleId, 'classic'>].nearest) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    frameScale[tk] = texSource[key].scale;
    padOf[tk] = pad;
    fxStats.made++; fxStats.ms += performance.now() - t0;
  }
  return [tk, '__BASE'];
}
/** Padding (texture px) added around a styled frame. */
export const padOf: Record<string, number> = {};

/**
 * Set an image to frame `key` in `style`, keeping the same on-screen size and anchor: the styled
 * texture is padded, so the origin is remapped onto the original frame's (ox, oy).
 */
export function setStyled(img: Phaser.GameObjects.Image, scene: Phaser.Scene, key: string, style: ArtStyleId, ox: number, oy: number) {
  const [tk, fr] = styledTex(scene, key, style);
  img.setTexture(tk, fr);
  const pad = padOf[tk] ?? 0;
  if (pad) {
    const W = img.frame.realWidth, H = img.frame.realHeight, w0 = W - pad * 2, h0 = H - pad * 2;
    img.setOrigin((pad + ox * w0) / W, (pad + oy * h0) / H);
  } else img.setOrigin(ox, oy);
  return img;
}
