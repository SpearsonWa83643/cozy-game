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
const lightOffset = (k: number): [number, number] => [LIGHT[0] * k, LIGHT[1] * k];

// ================================================================== 1. Bold cel-shaded
const INK = '#2a1a22';
const cel: LabStyle = {
  id: 'cel', name: 'Bold Cel-Shaded', blurb: 'Comic-book punch: flat colour, hard-edged shadow, thick ink outline.',
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
  render(c, parts) {
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
  },
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
      const k = c.getTransform().a;
      c.shadowColor = css(shade(p.color, 0.45), 0.55); c.shadowBlur = 26 * k; c.shadowOffsetX = 2000 * k;
      c.fillStyle = '#000';
      c.beginPath(); c.ellipse(b.cx + b.w * 0.32 - 2000, b.cy + b.h * 0.34, b.w * 0.5, b.h * 0.42, 0, 0, TAU); c.fill();
      c.shadowColor = 'rgba(255,252,240,0.65)';
      c.beginPath(); c.ellipse(b.cx - b.w * 0.24 - 2000, b.cy - b.h * 0.26, b.w * 0.22, b.h * 0.16, -0.5, 0, TAU); c.fill();
      c.shadowColor = 'transparent'; c.shadowOffsetX = 0;
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
        c.shadowColor = css(wash, p.role === 'blush' ? 0.5 : 0.95); c.shadowBlur = 14 * k; c.shadowOffsetX = 3000 * k;
        c.fillStyle = '#000';
        path(c, p, shift(scaleAbout(p.pts, b.cx, b.cy, 0.9), -3000 + 4, 6)); c.fill();
        c.shadowColor = css(mix(wash, '#2a2833', 0.35), 0.5); c.shadowBlur = 22 * k;
        c.beginPath(); c.ellipse(b.cx + b.w * 0.28 - 3000, b.cy + b.h * 0.32, b.w * 0.42, b.h * 0.3, 0, 0, TAU); c.fill();
        c.restore();
        if (p.role === 'blush') continue;
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
  render(c, parts) { cel.render(c, parts.map((p) => ({ ...p, width: (p.width ?? 4) * 0.8 }))); },
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
