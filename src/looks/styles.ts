// Mount Style Lab (temporary): six distinct art styles, each rendering the same mount parts.
import { type Part, type Pt, TAU, rng, trace, densify, bbox, centroid, scaleAbout, shift, css, mix, rgb, shade, light, lum, type RGB } from './geo';

type C = CanvasRenderingContext2D;
export type LabStyle = {
  id: string;
  name: string;
  blurb: string;
  /** Paint the panel backdrop (device pixels). */
  backdrop: (c: C, w: number, h: number) => void;
  /** Paint the mount in local 512-unit space (context already scaled). */
  render: (c: C, parts: Part[]) => void;
  /** Render at low resolution and upscale with hard pixels. */
  pixel?: number;
};

const isLine = (p: Part) => p.role === 'line';
const sm = (p: Part) => p.smooth !== false;
const cl = (p: Part) => p.closed !== false && !isLine(p);
const path = (c: C, p: Part, pts: Pt[] = p.pts) => trace(c, pts, sm(p), cl(p));
const LIGHT: Pt = [-0.6, -0.8];

function noiseTile(seed: string, size: number, dots: number, col: (r: () => number) => string, rmax = 1.4): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  const r = rng(seed);
  for (let i = 0; i < dots; i++) { c.fillStyle = col(r); c.beginPath(); c.arc(r() * size, r() * size, 0.3 + r() * rmax, 0, TAU); c.fill(); }
  return cv;
}
let paperTile: HTMLCanvasElement | null = null;
const paper = () => paperTile ??= noiseTile('paper', 256, 5000, (r) => r() < 0.5 ? `rgba(120,95,60,${0.03 + r() * 0.05})` : `rgba(255,255,255,${0.1 + r() * 0.2})`, 1.2);
let fiberTile: HTMLCanvasElement | null = null;
function fibers(): HTMLCanvasElement {
  if (fiberTile) return fiberTile;
  const cv = document.createElement('canvas'); cv.width = cv.height = 384;
  const c = cv.getContext('2d')!; const r = rng('fiber');
  for (let i = 0; i < 260; i++) {
    c.strokeStyle = `rgba(110,90,60,${0.05 + r() * 0.08})`; c.lineWidth = 0.6 + r();
    const x = r() * 384, y = r() * 384, a = r() * TAU, l = 10 + r() * 40;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
  return (fiberTile = cv);
}
function tile(c: C, t: HTMLCanvasElement, w: number, h: number, alpha = 1) {
  c.save(); c.globalAlpha = alpha; c.fillStyle = c.createPattern(t, 'repeat')!; c.fillRect(0, 0, w, h); c.restore();
}
function vignette(c: C, w: number, h: number, inner: string, outer: string) {
  const g = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
function jitter(pts: Pt[], amp: number, r: () => number): Pt[] { return pts.map(([x, y]) => [x + (r() - 0.5) * amp, y + (r() - 0.5) * amp]); }
/** A soft-edged elliptical stain (radial gradient), in-bounds so no browser culls it. */
function softBlob(c: C, x: number, y: number, rx: number, ry: number, col: string) {
  c.save(); c.translate(x, y); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, col); g.addColorStop(0.55, col.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.6})`)); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
  c.fillStyle = g; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore();
}
const lightOffset = (k: number): [number, number] => [LIGHT[0] * k, LIGHT[1] * k];


// Classic chunky cel (kept for the 160px pixel style, where fine detail would turn to mush).
function celBasic(c: C, parts: Part[]) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const p of parts) {
      if (isLine(p)) { c.strokeStyle = p.color === '#f0bf4c' ? p.color : INK; c.lineWidth = (p.width ?? 4) * 1.5; path(c, p); c.stroke(); continue; }
      if (p.role === 'glint') { c.fillStyle = '#fff'; path(c, p); c.fill(); continue; }
      if (p.role === 'blush') { c.fillStyle = css(rgb(p.color), 0.75); path(c, p); c.fill(); continue; }
      c.fillStyle = css(shade(p.color, 0.38)); path(c, p); c.fill();
      if (p.role !== 'eye') {
        const b = bbox(p.pts); const k = Math.max(6, Math.min(b.w, b.h) * 0.14);
        c.save(); path(c, p); c.clip();
        c.fillStyle = p.color; path(c, p, shift(scaleAbout(p.pts, b.cx, b.cy, 0.98), ...lightOffset(k))); c.fill();
        if (p.role === 'major') {
          c.fillStyle = css(light(p.color, 0.45));
          const hx = b.x0 + b.w * 0.3, hy = b.y0 + b.h * 0.24;
          c.beginPath(); c.ellipse(hx, hy, b.w * 0.12, b.h * 0.07, -0.6, 0, TAU); c.fill();
        }
        c.restore();
      }
      c.strokeStyle = INK; c.lineWidth = p.role === 'major' ? 7 : 4.5; path(c, p); c.stroke();
    }
}

// Fine cel (Walker, Oct 29): bold OUTER silhouette only, thin tapered interior linework, 3-step cel
// shading with crisp shadow shapes, a small rim light, fine hatching in the shade and per-part detail.
const INTERIOR = /^(chip\d|cape-lining|band|covert|iris|dent)$/;
const pathOf = (p: Part, pts: Pt[] = p.pts) => { const P2 = new Path2D(); trace({ beginPath() {}, moveTo: P2.moveTo.bind(P2), lineTo: P2.lineTo.bind(P2), bezierCurveTo: P2.bezierCurveTo.bind(P2), closePath: P2.closePath.bind(P2) } as unknown as C, pts, sm(p), cl(p)); return P2; };
/** Tapered stroke: thick in the middle, hair-thin at both ends (or from w0 to w1). */
function taper(c: C, pts: Pt[], w: number, col: string, smooth = true, ends: [number, number] = [0.15, 0.15]) {
  const d = pts.length > 2 || smooth ? densify(pts, smooth, false, 6) : densify(pts, false, false, 10);
  c.strokeStyle = col; c.lineCap = 'round';
  for (let i = 1; i < d.length; i++) {
    const u = i / (d.length - 1);
    const k = Math.min(1, u / Math.max(ends[0], 1e-3), (1 - u) / Math.max(ends[1], 1e-3) + (ends[1] === 0 ? 1 : 0));
    c.lineWidth = Math.max(0.35, w * (0.25 + 0.75 * Math.min(1, k)));
    c.beginPath(); c.moveTo(d[i - 1][0], d[i - 1][1]); c.lineTo(d[i][0], d[i][1]); c.stroke();
  }
}
function hatch(c: C, b: ReturnType<typeof bbox>, gap: number, col: string, w: number) {
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath();
  for (let x = b.x0 - b.h; x < b.x1 + b.h; x += gap) { c.moveTo(x, b.y1 + 2); c.lineTo(x + b.h * 0.7, b.y0 - 2); }
  c.stroke();
}
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// Ink and Wash pen layer (Walker, Oct 29 11:43 PM: "a bit more pen lines around, subtle pen shading balanced
// and with taste"). Fine, slightly irregular nib strokes: hatching (cross-hatch in the deepest core) only in the
// shadow crescent away from the top-left light, a thin broken second contour on the shadow side, and a few
// form-following detail marks. Restrained so the wash still breathes; no outline texture.
function penLine(c: C, a: Pt, b: Pt, bow: number, w: number, alpha: number) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  c.strokeStyle = `rgba(22,19,26,${alpha})`; c.lineWidth = w;
  c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(mx - dy / L * bow, my + dx / L * bow, b[0], b[1]); c.stroke();
}
function shadowClip(c: C, p: Part, b: ReturnType<typeof bbox>, k: number) {
  // Everything inside the part but outside a copy nudged toward the light = a crescent on the shadow side.
  const d = densify(p.pts, sm(p), true, 6);
  c.beginPath(); c.rect(b.x0 - 60, b.y0 - 60, b.w + 120, b.h + 120);
  d.forEach(([x, y], i) => (i ? c.lineTo : c.moveTo).call(c, x - b.w * k, y - b.h * k * 1.2));
  c.closePath(); c.clip('evenodd');
}
function hatchSet(c: C, b: ReturnType<typeof bbox>, ang: number, gap: number, alpha: number, r: () => number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, R = Math.hypot(b.w, b.h) / 2 + 4;
  for (let o = -R; o <= R; o += gap * (0.85 + r() * 0.3)) {
    if (r() < 0.12) continue; // a few missing strokes keep it hand-made
    const j = (r() - 0.5) * 0.08, cx = b.cx + nx * o, cy = b.cy + ny * o;
    const a: Pt = [cx - (ux - j) * R, cy - (uy + j) * R], e: Pt = [cx + (ux + j) * R, cy + (uy - j) * R];
    penLine(c, a, e, R * (0.05 + r() * 0.04), 0.55 + r() * 0.45, alpha * (0.8 + r() * 0.4));
  }
}
function inkPen(c: C, p: Part) {
  const b = bbox(p.pts), size = Math.min(b.w, b.h);
  if (size < 12 || p.role === 'blush') return;
  const r = rng('pen' + p.id), major = p.role === 'major', dark = lum(p.color) < 90;
  c.save(); path(c, p); c.clip();
  c.save(); shadowClip(c, p, b, major ? 0.11 : 0.17);
  hatchSet(c, b, -1.05, major ? 4.8 : 3.8, dark ? 0.26 : 0.28, r);
  if (major) { c.restore(); c.save(); shadowClip(c, p, b, 0.045); hatchSet(c, b, 0.35, 5.5, 0.17, r); }
  if (p.color === '#d9944b') {
    // Cookie dough: a light stipple in the shadow to hint at the baked surface.
    c.fillStyle = 'rgba(22,19,26,.5)';
    for (let i = 0; i < 90; i++) { c.beginPath(); c.arc(b.x0 + r() * b.w, b.y0 + r() * b.h, 0.6 + r() * 0.6, 0, TAU); c.fill(); }
  }
  c.restore();
  // Form marks, sparse and inside the part.
  if (p.id === 'body' && p.color !== '#d9944b') {
    for (let i = 0; i < 9; i++) {
      const x = b.x0 + b.w * (0.2 + r() * 0.65), y = b.y0 + b.h * (0.3 + r() * 0.55), w = 5 + r() * 4;
      penLine(c, [x - w, y - w * 0.35], [x + w * 0.2, y + w * 0.25], -2, 0.8, 0.5);
    }
  } else if (p.id === 'head') {
    for (let i = 0; i < 4; i++) { const y = b.y0 + b.h * (0.62 + i * 0.08), x = b.x0 + b.w * (0.08 + r() * 0.12); penLine(c, [x, y], [x + 12 + r() * 8, y + 3], -1.5, 0.6, 0.35); }
  } else if (p.id === 'body') {
    for (let i = 0; i < 5; i++) { const x = b.x0 + b.w * (0.15 + r() * 0.7), y = b.y0 + b.h * (0.15 + r() * 0.7); penLine(c, [x, y], [x + 3 + r() * 4, y + (r() - 0.5) * 4], 1, 0.65, 0.4); }
  } else if (p.id === 'cape') {
    for (let i = 0; i < 3; i++) { const x = b.x0 + b.w * (0.3 + i * 0.18 + r() * 0.05); penLine(c, [x, b.y0 + b.h * 0.2], [x - b.w * 0.12, b.y1 - b.h * 0.15], 4 + r() * 4, 0.7, 0.3); }
  }
  c.restore();
  if (!major) return;
  // Second, thinner broken contour hugging the shadow side, just inside the main brush line.
  const d = densify(p.pts, sm(p), true, 10), ph = r() * TAU;
  for (let i = 0; i < d.length; i++) {
    const a = d[i], e = d[(i + 1) % d.length], vx = a[0] - b.cx, vy = a[1] - b.cy, L = Math.hypot(vx, vy) || 1;
    const facing = (vx * 0.55 + vy * 0.83) / L;
    if (facing < 0.25 || Math.sin(i * 0.21 + ph) > 0.55) continue;
    const ins = 3.2 + Math.sin(i * 0.37 + ph) * 0.8;
    penLine(c, [a[0] - vx / L * ins, a[1] - vy / L * ins], [e[0] - vx / L * ins, e[1] - vy / L * ins], 0, 0.6 + facing * 0.6, 0.5);
  }
}
function celFine(c: C, parts: Part[]) {
  c.lineJoin = 'round'; c.lineCap = 'round';
  // 1. Bold outer silhouette: every outline part, fattened, behind everything.
  c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 11;
  for (const p of parts) if (!isLine(p) && !INTERIOR.test(p.id) && !['eye', 'glint', 'blush'].includes(p.role)) { const P2 = pathOf(p); c.fill(P2); c.stroke(P2); }
  for (const p of parts) if (isLine(p) && p.id === 'cape-trim') { c.lineWidth = (p.width ?? 4) + 9; c.strokeStyle = INK; c.stroke(pathOf(p)); }
  for (const p of parts) {
    const P2 = pathOf(p), id = p.id;
    if (isLine(p)) {
      if (id === 'cape-trim') { c.strokeStyle = p.color; c.lineWidth = p.width ?? 4; c.stroke(P2); c.strokeStyle = css(light(p.color, 0.6)); c.lineWidth = 1.2; c.stroke(pathOf(p, shift(p.pts, -1, -2))); continue; }
      if (id === 'smile') { taper(c, p.pts, 5.5, INK, true, [0.25, 0.25]); continue; }
      const col = /^feather/.test(id) ? '#24150c' : /^tail-l/.test(id) ? '#a69d8c' : css(shade(p.color, 0.3));
      taper(c, p.pts, Math.max(1.4, (p.width ?? 4) * 0.55), col, sm(p), [0.1, 0.45]);
      if (/^feather/.test(id)) { // barbs: fine angled ticks off the shaft
        const d = densify(p.pts, false, false, 9);
        for (let i = 2; i < d.length - 1; i += 2) { const [x, y] = d[i], u = i / d.length; taper(c, [[x, y], [x - 6 * (1 - u * 0.5), y + 5]], 0.8, 'rgba(36,21,12,.45)', false, [0, 0.7]); taper(c, [[x, y], [x + 5 * (1 - u * 0.5), y + 6]], 0.7, 'rgba(255,220,180,.25)', false, [0, 0.7]); }
      }
      continue;
    }
    if (p.role === 'glint') { c.fillStyle = '#fff'; c.fill(P2); continue; }
    if (p.role === 'blush') {
      c.fillStyle = css(rgb(p.color), 0.7); c.fill(P2);
      const b = bbox(p.pts); c.strokeStyle = 'rgba(200,80,70,.45)'; c.lineWidth = 1.1;
      for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(b.cx + k * 7 - 3, b.cy + 4); c.lineTo(b.cx + k * 7 + 3, b.cy - 4); c.stroke(); }
      continue;
    }
    const b = bbox(p.pts), k = Math.max(5, Math.min(b.w, b.h) * 0.13), r = rng('cel-' + id);
    // Three tone steps: deep shade, core shade, lit base.
    c.fillStyle = css(shade(p.color, 0.42)); c.fill(P2);
    if (p.role === 'eye') {
      c.save(); c.clip(P2); c.fillStyle = css(mix(p.color, '#5a3a2a', 0.5)); c.beginPath(); c.ellipse(b.cx + 1, b.y1 - b.h * 0.18, b.w * 0.42, b.h * 0.2, 0, 0, TAU); c.fill(); c.restore();
      c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke(P2);
      if (id.startsWith('eye-')) taper(c, [[b.x0 - 1, b.y0 + 3], [b.cx, b.y0 - 3], [b.x1 + 2, b.y0 + 1]], 1.8, INK, true, [0.3, 0.1]); // upper lid
      continue;
    }
    const lit = pathOf(p, shift(scaleAbout(p.pts, b.cx, b.cy, 0.98), ...lightOffset(k)));
    const lit2 = pathOf(p, shift(scaleAbout(p.pts, b.cx, b.cy, 0.97), ...lightOffset(k * 0.45)));
    c.save(); c.clip(P2);
    c.fillStyle = css(shade(p.color, 0.2)); c.fill(lit2);
    c.fillStyle = p.color; c.fill(lit);
    // Fine hatching only in the shaded crescent.
    if (p.role === 'major' && b.w > 40) {
      c.save(); const sh = new Path2D(); sh.addPath(P2); sh.addPath(lit2); c.clip(sh, 'evenodd');
      hatch(c, b, 5, css(shade(p.color, 0.6), 0.5), 0.8); c.restore();
    }
    // Lit-side highlight + a crisp secondary highlight dot.
    if (p.role === 'major' && !/wing/.test(id)) {
      c.fillStyle = css(light(p.color, 0.4), 0.8);
      c.beginPath(); c.ellipse(b.x0 + b.w * 0.3, b.y0 + b.h * 0.24, b.w * 0.11, b.h * 0.065, -0.6, 0, TAU); c.fill();
      c.fillStyle = css(light(p.color, 0.75)); c.beginPath(); c.ellipse(b.x0 + b.w * 0.2, b.y0 + b.h * 0.33, b.w * 0.025, b.h * 0.02, -0.6, 0, TAU); c.fill();
    }
    // Small rim light hugging the shadow-side edge.
    if (p.role === 'major' || id === 'knot') {
      c.save(); const rim = new Path2D(); rim.addPath(P2); rim.addPath(pathOf(p, shift(p.pts, -2.2, -2.6))); c.clip(rim, 'evenodd');
      c.fillStyle = css(mix(mix(p.color, '#bfe8ff', 0.35), '#fff6de', 0.55), 0.85); c.fill(P2); c.restore();
    }
    detail(c, p, b, r);
    c.restore();
    // Thin interior contour (the bold one is the silhouette pass).
    c.strokeStyle = INTERIOR.test(id) ? css(shade(p.color, 0.55)) : INK;
    c.lineWidth = INTERIOR.test(id) ? 1.3 : p.role === 'major' ? 2.4 : 1.8; c.stroke(P2);
  }
}
/** Per-part fine detail, drawn clipped inside the part. */
function detail(c: C, p: Part, b: ReturnType<typeof bbox>, r: () => number) {
  const id = p.id, ink = (a: number) => `rgba(42,26,34,${a})`;
  if (id === 'cookie-body' || (id === 'body' && p.color === '#d9944b')) {
    for (let i = 0; i < 70; i++) { // crumbs and baked pores
      const a = r() * TAU, d = Math.sqrt(r()) * 0.9, x = b.cx + Math.cos(a) * b.w * 0.5 * d, y = b.cy + Math.sin(a) * b.h * 0.5 * d;
      c.fillStyle = r() < 0.6 ? 'rgba(120,64,24,.45)' : 'rgba(255,226,170,.6)'; c.beginPath(); c.ellipse(x, y, 0.8 + r() * 1.6, 0.6 + r(), r() * 3, 0, TAU); c.fill();
    }
    for (let i = 0; i < 7; i++) { // hairline bake cracks
      const a = r() * TAU, d = 0.35 + r() * 0.5, x = b.cx + Math.cos(a) * b.w * 0.5 * d, y = b.cy + Math.sin(a) * b.h * 0.5 * d, l = 8 + r() * 12, q = r() * TAU;
      taper(c, [[x, y], [x + Math.cos(q) * l * 0.5 + 3, y + Math.sin(q) * l * 0.5], [x + Math.cos(q) * l, y + Math.sin(q) * l]], 1.3, 'rgba(110,58,20,.55)', true, [0.2, 0.5]);
    }
  } else if (/^chip\d/.test(id)) {
    c.fillStyle = 'rgba(255,220,180,.5)'; c.beginPath(); c.ellipse(b.x0 + b.w * 0.33, b.y0 + b.h * 0.3, b.w * 0.14, b.h * 0.09, -0.5, 0, TAU); c.fill();
  } else if (id === 'cape') {
    const P = p.pts; // fold lines from the tie toward the rippling hem, plus fine shadow folds
    const top = [P[2], P[3], P[4], P[5]], hem = [P[13], P[11], P[9], P[7]];
    for (let i = 0; i < 4; i++) for (const t of [0.0, 0.5]) {
      const a = lerpPt(top[i], top[Math.min(3, i + 1)], t), z = lerpPt(hem[i], hem[Math.min(3, i + 1)], t), m = lerpPt(a, z, 0.5);
      taper(c, [lerpPt(a, z, 0.12), [m[0] + 6, m[1] + 4], lerpPt(a, z, 0.86)], t ? 1.0 : 1.6, t ? ink(0.35) : ink(0.6), true, [0.5, 0.3]);
      if (!t) taper(c, [lerpPt(a, z, 0.2), [m[0] + 9, m[1] + 6], lerpPt(a, z, 0.75)], 1.4, 'rgba(255,170,150,.45)', true, [0.5, 0.4]);
    }
  } else if (id === 'cape-lining') {
    for (let i = 0; i < 5; i++) { const x = b.x0 + b.w * (0.15 + i * 0.17); taper(c, [[x, b.y0 + 4], [x - 6, b.y1 - 2]], 1, ink(0.4), false); }
  } else if (id === 'crown') {
    const d = densify(p.pts, true, true, 4).filter(([, y]) => y < b.y1 - 16);
    c.fillStyle = ink(0.5); for (let i = 0; i < d.length; i += 2) { c.beginPath(); c.arc(d[i][0] * 0.94 + b.cx * 0.06, d[i][1] * 0.94 + b.cy * 0.06, 0.9, 0, TAU); c.fill(); }
    for (let i = 0; i < 14; i++) { const x = b.x0 + r() * b.w, y = b.y0 + r() * b.h; taper(c, [[x, y], [x + 3, y + 5]], 0.8, 'rgba(255,255,255,.25)', false); }
  } else if (id === 'band') {
    c.setLineDash([4, 3]); c.strokeStyle = 'rgba(240,200,140,.75)'; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(b.x0 + 4, b.cy - 1 - b.h * 0.05); c.quadraticCurveTo(b.cx, b.cy + 4, b.x1 - 4, b.cy - 2 - b.h * 0.1); c.stroke(); c.setLineDash([]);
  } else if (id === 'brim') {
    const d = densify(p.pts, true, true, 4);
    c.setLineDash([3.5, 3]); c.strokeStyle = ink(0.5); c.lineWidth = 1;
    c.beginPath(); d.forEach(([x, y], i) => { const X = b.cx + (x - b.cx) * 0.9, Y = b.cy + (y - b.cy) * 0.78; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.stroke(); c.setLineDash([]);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4; c.beginPath(); d.slice(0, Math.floor(d.length * 0.5)).forEach(([x, y], i) => (i ? c.lineTo(x + 1, y + 2.2) : c.moveTo(x + 1, y + 2.2))); c.stroke();
  } else if (id === 'arm-back' || id === 'arm-front' || id === 'leg-l' || id === 'leg-r') {
    for (let i = 0; i < 10; i++) { c.fillStyle = 'rgba(110,58,20,.45)'; c.beginPath(); c.arc(b.x0 + r() * b.w, b.y0 + r() * b.h, 0.7 + r(), 0, TAU); c.fill(); }
  } else if (id === 'body' || id === 'far-wing') { // eagle body: layered scallop feathers
    const col = id === 'body' ? 'rgba(30,16,8,.55)' : 'rgba(20,10,4,.45)';
    for (let row = 0; row < 7; row++) for (let i = 0; i < 12; i++) {
      const x = b.x0 + (i + (row % 2) * 0.5) * (b.w / 11), y = b.y0 + 14 + row * (b.h / 7);
      taper(c, [[x - 9, y - 2], [x, y + 5], [x + 9, y - 2]], 1.1, col, true, [0.4, 0.4]);
      if (row % 2 === 0 && i % 3 === 0) taper(c, [[x - 4, y - 4], [x + 1, y + 1]], 0.8, 'rgba(255,220,170,.35)', false);
    }
  } else if (id === 'near-wing') {
    for (let row = 0; row < 6; row++) for (let i = 0; i < 6; i++) { // layered covert/secondary rows
      const x = b.x0 + 16 + i * (b.w / 6) + row * 3, y = b.y1 - 20 - row * (b.h / 7);
      taper(c, [[x - 8, y - 3], [x, y + 4], [x + 7, y - 4]], 1.0, 'rgba(25,14,6,.5)', true, [0.4, 0.4]);
    }
  } else if (id === 'covert') {
    for (let row = 0; row < 4; row++) for (let i = 0; i < 5; i++) { const x = b.x0 + 8 + i * (b.w / 5) + row * 4, y = b.y1 - 10 - row * (b.h / 4.5); taper(c, [[x - 6, y - 2], [x, y + 3], [x + 6, y - 3]], 0.9, 'rgba(40,20,8,.5)', true, [0.4, 0.4]); }
  } else if (id === 'head') {
    for (let i = 0; i < 16; i++) { // white neck ruff: fine tapered feather tips toward the body + grey shade strokes
      const u = i / 15, x = lerpPt([318, 262], [366, 280], u)[0], y = lerpPt([318, 262], [366, 280], u)[1];
      taper(c, [[x + 10, y - 12], [x + 2, y - 2]], 1.1, 'rgba(120,110,100,.6)', false, [0.6, 0.0]);
    }
    for (let i = 0; i < 10; i++) { const x = b.x0 + 20 + r() * b.w * 0.7, y = b.y0 + 10 + r() * b.h * 0.6; taper(c, [[x, y], [x - 6, y + 4]], 0.7, 'rgba(150,140,128,.5)', false); }
  } else if (id === 'tail') {
    for (let i = 0; i < 7; i++) { const y = b.y0 + 8 + i * (b.h - 16) / 6; taper(c, [[b.x1, b.cy + (y - b.cy) * 0.3], [b.x0 + 10, y]], 0.8, 'rgba(120,112,100,.6)', false, [0.0, 0.5]); }
  } else if (id === 'beak') {
    taper(c, [[b.x0 + 8, b.y0 + 8], [b.cx + 6, b.y0 + 4], [b.x1 - 10, b.cy]], 1.3, 'rgba(255,245,200,.8)', true, [0.3, 0.5]);
    c.fillStyle = ink(0.8); c.beginPath(); c.ellipse(b.x0 + 18, b.y0 + 10, 2.2, 1.4, 0.2, 0, TAU); c.fill(); // nostril
  } else if (/^talon/.test(id)) {
    for (let i = 1; i < 4; i++) taper(c, [[b.x0 + 2, b.y0 + i * b.h / 4], [b.x1 - 2, b.y0 + i * b.h / 4 + 2]], 0.8, ink(0.45), false);
  } else if (id === 'iris') {
    c.strokeStyle = 'rgba(160,100,10,.6)'; c.lineWidth = 0.8; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.beginPath(); c.moveTo(b.cx + Math.cos(a) * 8, b.cy + Math.sin(a) * 8); c.lineTo(b.cx + Math.cos(a) * 11.5, b.cy + Math.sin(a) * 11.5); c.stroke(); }
  }
}

// ================================================================== 1. Bold cel-shaded
const INK = '#2a1a22';
const cel: LabStyle = {
  id: 'cel', name: 'Bold Cel-Shaded', blurb: 'Comic-book punch: bold outer silhouette, fine tapered inner linework, layered cel shading with rim light and hatching.',
  backdrop(c, w, h) {
    c.fillStyle = '#bfe3df'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d7efe9'; c.beginPath(); c.arc(w / 2, h * 0.46, Math.min(w, h) * 0.38, 0, TAU); c.fill();
    const s = Math.max(10, Math.round(Math.min(w, h) / 40));
    c.fillStyle = 'rgba(70,140,140,0.16)';
    for (let y = 0; y < h; y += s) for (let x = (y / s) % 2 ? s / 2 : 0; x < w; x += s) {
      const d = Math.hypot(x - w / 2, y - h * 0.46) / Math.max(w, h);
      const r = Math.max(0, d - 0.2) * s * 0.9;
      if (r > 0.4) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    }
  },
  render(c, parts) { celFine(c, parts); },
};

// ================================================================== 2. Storybook watercolour
const wc: LabStyle = {
  id: 'watercolor', name: 'Storybook Watercolor', blurb: 'Soft pigment washes that bloom past a sketchy pencil line, on textured paper.',
  backdrop(c, w, h) {
    c.fillStyle = '#f7f0e1'; c.fillRect(0, 0, w, h);
    const r = rng('wc-bg');
    for (let i = 0; i < 7; i++) {
      const g = c.createRadialGradient(w * (0.2 + r() * 0.6), h * (0.2 + r() * 0.6), 0, w * 0.5, h * 0.5, Math.max(w, h) * (0.35 + r() * 0.3));
      g.addColorStop(0, `rgba(${[150, 190, 200][i % 3]},${[180, 200, 170][i % 3]},${[200, 170, 190][i % 3]},0.10)`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    tile(c, paper(), w, h, 1);
  },
  render(c, parts) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const p of parts) {
      const r = rng('wc' + p.id);
      if (isLine(p)) {
        c.strokeStyle = css(mix(p.color, '#3b2a20', 0.4), 0.75); c.lineWidth = (p.width ?? 4) * 0.8;
        path(c, p, jitter(p.pts, 3, r)); c.stroke(); continue;
      }
      if (p.role === 'glint') { c.fillStyle = 'rgba(255,255,255,0.95)'; path(c, p); c.fill(); continue; }
      if (p.role === 'eye') { c.fillStyle = css(rgb(p.color), 0.88); path(c, p); c.fill(); continue; }
      const b = bbox(p.pts);
      // Knock out what is behind (paper white), then glaze.
      c.fillStyle = '#fbf6ea'; path(c, p); c.fill();
      const layers = p.role === 'blush' ? 2 : 4;
      for (let i = 0; i < layers; i++) {
        c.fillStyle = css(rgb(p.color), p.role === 'blush' ? 0.22 : 0.3);
        path(c, p, jitter(p.pts, Math.min(14, b.w * 0.06), r)); c.fill();
      }
      if (p.role === 'blush') continue;
      c.save(); path(c, p); c.clip();
      // Wet-in-wet shadow pooling bottom-right + lifted highlight top-left.
      softBlob(c, b.cx + b.w * 0.32, b.cy + b.h * 0.34, b.w * 0.55, b.h * 0.46, css(shade(p.color, 0.45), 0.6));
      softBlob(c, b.cx - b.w * 0.24, b.cy - b.h * 0.26, b.w * 0.26, b.h * 0.2, 'rgba(255,252,240,0.7)');
      // Granulation.
      for (let i = 0; i < (b.w * b.h) / 120; i++) {
        c.fillStyle = css(shade(p.color, 0.5), 0.12 + r() * 0.1);
        c.beginPath(); c.arc(b.x0 + r() * b.w, b.y0 + r() * b.h, 0.6 + r() * 1.4, 0, TAU); c.fill();
      }
      c.restore();
      // Pigment pooling at the edge + pencil underdrawing.
      c.strokeStyle = css(shade(p.color, 0.3), 0.4); c.lineWidth = 2.4; path(c, p, jitter(p.pts, 4, r)); c.stroke();
      c.strokeStyle = 'rgba(70,52,40,0.55)'; c.lineWidth = 1.4;
      path(c, p, shift(jitter(p.pts, 5, r), 1.5, -1)); c.stroke();
    }
  },
};

// ================================================================== 3. Painterly gouache
const gouache: LabStyle = {
  id: 'gouache', name: 'Painterly Gouache', blurb: 'Thick, matte, visible brushstrokes that sculpt the form, like a picture-book painting.',
  backdrop(c, w, h) {
    c.fillStyle = '#d8d2bd'; c.fillRect(0, 0, w, h);
    const r = rng('gq-bg'); c.lineCap = 'round';
    const s = Math.min(w, h) / 512;
    for (let i = 0; i < 520; i++) {
      const x = r() * w, y = r() * h, a = -0.35 + (r() - 0.5) * 0.4, l = (30 + r() * 70) * s;
      const t = y / h;
      c.strokeStyle = css(mix(mix('#e9e1c6', '#a9b79a', t * 0.9), r() < 0.5 ? '#f5efd9' : '#9aa88d', r() * 0.35), 0.55);
      c.lineWidth = (10 + r() * 16) * s;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
  },
  render(c, parts) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const p of parts) {
      const r = rng('gq' + p.id);
      if (isLine(p)) { c.strokeStyle = css(mix(p.color, '#2a1c14', 0.25)); c.lineWidth = (p.width ?? 4) * 1.2; path(c, p, jitter(p.pts, 2, r)); c.stroke(); continue; }
      if (p.role === 'glint') { c.fillStyle = '#fffaf0'; path(c, p); c.fill(); continue; }
      if (p.role === 'eye') { c.fillStyle = '#1d1410'; path(c, p); c.fill(); continue; }
      const base = mix(p.color, '#b8ad96', 0.12);
      c.fillStyle = css(shade(css(base), 0.18)); path(c, p); c.fill();
      if (p.role === 'blush') { c.fillStyle = css(rgb(p.color), 0.45); path(c, p); c.fill(); continue; }
      const b = bbox(p.pts); const [cx, cy] = centroid(p.pts);
      c.save(); path(c, p); c.clip();
      const step = p.role === 'major' ? 8 : 5;
      for (let y = b.y0 - step; y < b.y1 + step; y += step) for (let x = b.x0 - step; x < b.x1 + step; x += step) {
        const jx = x + (r() - 0.5) * step, jy = y + (r() - 0.5) * step;
        const nx = (jx - cx) / (b.w / 2 + 1), ny = (jy - cy) / (b.h / 2 + 1);
        const d = Math.min(1, Math.hypot(nx, ny));
        const lit = -(nx * LIGHT[0] + ny * LIGHT[1]) * 0.8 + (0.35 - d * 0.5);
        const col: RGB = lit > 0 ? mix(base, light(p.color, 0.55), Math.min(1, lit)) : mix(base, shade(p.color, 0.5), Math.min(0.8, -lit));
        const jc = (r() - 0.5) * 18;
        c.strokeStyle = css([col[0] + jc, col[1] + jc * 0.8, col[2] + jc * 0.6], 0.82);
        c.lineWidth = step * (0.9 + r() * 0.7);
        const a = Math.atan2(ny, nx) + Math.PI / 2 + (r() - 0.5) * 0.6; // strokes wrap around the form
        const l = step * (1 + r() * 1.3);
        c.beginPath(); c.moveTo(jx - Math.cos(a) * l / 2, jy - Math.sin(a) * l / 2); c.lineTo(jx + Math.cos(a) * l / 2, jy + Math.sin(a) * l / 2); c.stroke();
      }
      c.restore();
      c.strokeStyle = css(shade(p.color, 0.55), 0.6); c.lineWidth = 2.6; path(c, p, jitter(p.pts, 2.5, r)); c.stroke();
    }
  },
};

// ================================================================== 4. Soft 3D clay
const clay: LabStyle = {
  id: 'clay', name: 'Soft 3D Clay', blurb: 'Squishy stop-motion clay figures: round volumes, soft studio light, tiny fingerprints.',
  backdrop(c, w, h) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f3e6dc'); g.addColorStop(0.62, '#ead6c8'); g.addColorStop(1, '#dcc2b0');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const f = c.createRadialGradient(w / 2, h * 0.88, 0, w / 2, h * 0.88, w * 0.32);
    f.addColorStop(0, 'rgba(90,55,40,0.28)'); f.addColorStop(1, 'rgba(90,55,40,0)');
    c.save(); c.translate(0, h * 0.88); c.scale(1, 0.18); c.translate(0, -h * 0.88);
    c.fillStyle = f; c.fillRect(0, 0, w, h); c.restore();
  },
  render(c, parts) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const p of parts) {
      const r = rng('clay' + p.id);
      c.save();
      const k = c.getTransform().a;
      c.shadowColor = 'rgba(60,30,20,0.28)'; c.shadowBlur = (p.role === 'major' ? 18 : 8) * k; c.shadowOffsetX = 4 * k; c.shadowOffsetY = 8 * k;
      if (isLine(p)) {
        c.strokeStyle = css(shade(p.color, 0.15)); c.lineWidth = (p.width ?? 4) * 1.6; path(c, p); c.stroke();
        c.shadowColor = 'transparent';
        c.strokeStyle = css(light(p.color, 0.35), 0.7); c.lineWidth = (p.width ?? 4) * 0.5; path(c, p, shift(p.pts, -1, -1.5)); c.stroke();
        c.restore(); continue;
      }
      const b = bbox(p.pts);
      const rr = Math.max(b.w, b.h) * 0.75;
      const g = c.createRadialGradient(b.cx - b.w * 0.22, b.cy - b.h * 0.28, rr * 0.05, b.cx, b.cy, rr);
      if (p.role === 'glint') { c.shadowColor = 'transparent'; c.fillStyle = 'rgba(255,255,255,0.95)'; path(c, p); c.fill(); c.restore(); continue; }
      g.addColorStop(0, css(light(p.color, p.role === 'eye' ? 0.25 : 0.42)));
      g.addColorStop(0.45, p.color);
      g.addColorStop(1, css(shade(p.color, 0.5)));
      c.fillStyle = g; if (p.role === 'blush') c.globalAlpha = 0.7;
      path(c, p); c.fill();
      c.restore();
      if (p.role === 'blush') continue;
      c.save(); path(c, p); c.clip();
      // Bounce light along the lower edge + soft specular.
      c.strokeStyle = css(light(p.color, 0.3), 0.35); c.lineWidth = 6; path(c, p, shift(p.pts, -3, -4)); c.stroke();
      if (p.role !== 'eye') {
        for (let i = 0; i < (b.w * b.h) / 260; i++) { // fingerprint dimples
          c.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(60,30,20,0.07)'; c.lineWidth = 1;
          const x = b.x0 + r() * b.w, y = b.y0 + r() * b.h;
          c.beginPath(); c.arc(x, y, 2 + r() * 5, r() * TAU, r() * TAU + 1.5); c.stroke();
        }
      }
      const s = c.createRadialGradient(b.x0 + b.w * 0.32, b.y0 + b.h * 0.26, 0, b.x0 + b.w * 0.32, b.y0 + b.h * 0.26, Math.min(b.w, b.h) * 0.22);
      s.addColorStop(0, 'rgba(255,255,255,0.6)'); s.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = s; c.fillRect(b.x0, b.y0, b.w, b.h);
      c.restore();
    }
  },
};

// ================================================================== 5. Ink & wash
const ink: LabStyle = {
  id: 'ink', name: 'Ink and Wash', blurb: 'Sumi-e brush ink with grey washes on rice paper, one splash of colour.',
  backdrop(c, w, h) {
    c.fillStyle = '#efe8d8'; c.fillRect(0, 0, w, h);
    tile(c, fibers(), w, h, 1); tile(c, paper(), w, h, 0.6);
    const s = Math.min(w, h) / 512;
    c.fillStyle = 'rgba(80,80,90,0.07)';
    c.beginPath(); c.ellipse(w * 0.5, h * 0.84, w * 0.42, 22 * s, 0, 0, TAU); c.fill();
    // Red seal.
    const x = w - 70 * s, y = h - 92 * s;
    c.fillStyle = '#b8352b'; c.fillRect(x, y, 44 * s, 44 * s);
    c.fillStyle = '#efe8d8'; c.font = `800 ${17 * s}px Nunito, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('WG', x + 22 * s, y + 23 * s);
  },
  render(c, parts) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const p of parts) {
      const r = rng('ink' + p.id);
      if (p.role === 'glint') { c.fillStyle = '#f7f2e6'; path(c, p); c.fill(); continue; }
      if (p.role === 'eye') { c.fillStyle = '#16131a'; path(c, p); c.fill(); continue; }
      if (!isLine(p)) {
        const v = 255 - (255 - lum(p.color)) * 0.6;
        const wash: RGB = p.accent ? mix(p.color, '#efe8d8', 0.15) : [v + 2, v - 4, v - 14];
        c.fillStyle = '#efe8d8'; path(c, p); c.fill();
        c.save(); path(c, p); c.clip();
        const b = bbox(p.pts);
        const k = c.getTransform().a;
        c.shadowColor = css(wash, p.role === 'blush' ? 0.5 : 0.95); c.shadowBlur = 14 * k;
        c.fillStyle = css(wash, p.role === 'blush' ? 0.5 : 0.95);
        path(c, p, shift(scaleAbout(p.pts, b.cx, b.cy, 0.9), 4, 6)); c.fill();
        c.shadowColor = 'transparent';
        softBlob(c, b.cx + b.w * 0.28, b.cy + b.h * 0.32, b.w * 0.46, b.h * 0.34, css(mix(wash, '#2a2833', 0.35), 0.5));
        c.restore();
        if (p.role === 'blush') continue;
        inkPen(c, p);
      }
      // Calligraphic ink line: pressure swells and the occasional dry-brush gap.
      const dense = densify(p.pts, sm(p), cl(p), 10);
      const baseW = isLine(p) ? (p.width ?? 4) * 1.1 : p.role === 'major' ? 5.5 : 3.2;
      const ph = r() * TAU, fq = 2 + r() * 3;
      for (let i = 0; i < dense.length - (cl(p) ? 0 : 1); i++) {
        const a = dense[i], b2 = dense[(i + 1) % dense.length];
        const t = i / dense.length;
        if (!isLine(p) && Math.sin(t * TAU * 1.3 + ph * 2) > 0.86) continue;
        const press = 0.35 + 0.65 * Math.abs(Math.sin(t * Math.PI * fq + ph));
        c.strokeStyle = `rgba(22,19,26,${0.78 + r() * 0.2})`;
        c.lineWidth = baseW * press;
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b2[0], b2[1]); c.stroke();
      }
    }
  },
};

// ================================================================== 6. Hi-res pixel art
const pixel: LabStyle = {
  id: 'pixel', name: 'Hi-Res Pixel Art', blurb: 'Crisp 160px sprite with a limited palette, banded shading and a 1-pixel outline.',
  pixel: 160,
  backdrop(c, w, h) {
    const px = Math.max(4, Math.round(Math.min(w, h) / 120));
    const bands = ['#8fd3f0', '#a6dcf2', '#bbe5f3', '#cdebf2', '#ddf0ef', '#eaf4ea'];
    for (let y = 0; y < h; y += px) {
      const i = Math.min(bands.length - 1, Math.floor((y / h) * bands.length));
      c.fillStyle = bands[i]; c.fillRect(0, y, w, px);
    }
    const r = rng('px-cloud'); c.fillStyle = '#ffffff';
    for (let k = 0; k < 4; k++) {
      const cx = Math.round((r() * w) / px) * px, cy = Math.round((h * (0.12 + r() * 0.7)) / px) * px;
      for (let i = 0; i < 6; i++) c.fillRect(cx + (i - 3) * px * 3, cy - (i % 3) * px, px * 4, px * 2 + (i % 2) * px);
    }
  },
  render(c, parts) { celBasic(c, parts.map((p) => ({ ...p, width: (p.width ?? 4) * 0.8 }))); },
};

export const LAB_STYLES: LabStyle[] = [wc, cel, gouache, clay, ink, pixel];

/** Snap a low-res sprite to hard pixels: binary alpha, posterised colour, 1px dark outline. */
export function pixelate(src: HTMLCanvasElement) {
  const c = src.getContext('2d')!;
  const { width: w, height: h } = src;
  const img = c.getImageData(0, 0, w, h); const d = img.data;
  const q = (v: number) => Math.round(v / 36) * 36;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    d[i] = Math.min(255, q(d[i])); d[i + 1] = Math.min(255, q(d[i + 1])); d[i + 2] = Math.min(255, q(d[i + 2])); d[i + 3] = 255;
  }
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3]) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < w && Y < h && d[(Y * w + X) * 4 + 3] > 0; });
    if (n) { out[i] = 34; out[i + 1] = 24; out[i + 2] = 40; out[i + 3] = 255; }
  }
  img.data.set(out); c.putImageData(img, 0, 0);
}
