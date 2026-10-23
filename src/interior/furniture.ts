// 9.4 Building interiors: the furniture and decor you can put in a room.
// Bold, chunky Canvas2D art (thick outlines, soft gradients) drawn at device resolution.
import Phaser from 'phaser';

export type Layer = 'floor' | 'wall' | 'rug';
export type FurnDef = { id: string; name: string; layer: Layer; w: number; h: number; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void };

const OUT = '#4a3022';
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}
function fillOut(c: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 4) {
  c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke();
}
function vgrad(c: CanvasRenderingContext2D, y0: number, y1: number, a: string, b: string) {
  const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g;
}
function shadow(c: CanvasRenderingContext2D, cx: number, y: number, rx: number) {
  c.fillStyle = 'rgba(60,35,20,0.22)'; c.beginPath(); c.ellipse(cx, y, rx, rx * 0.16, 0, 0, Math.PI * 2); c.fill();
}

export const FURNITURE: FurnDef[] = [
  { id: 'bed', name: 'Bed', layer: 'floor', w: 200, h: 130, draw: (c, w, h) => {
    shadow(c, w / 2, h - 6, w * 0.46);
    rr(c, 8, 10, 34, h - 18, 10); fillOut(c, vgrad(c, 10, h, '#c98a55', '#9a6238'));           // headboard
    rr(c, 20, 52, w - 32, 44, 12); fillOut(c, vgrad(c, 52, 96, '#fdf6ea', '#e9dcc6'));          // mattress
    rr(c, 30, 40, 52, 30, 14); fillOut(c, '#ffffff');                                            // pillow
    rr(c, 74, 46, w - 92, 50, 14); fillOut(c, vgrad(c, 46, 96, '#6fb8e8', '#3f8fc6'));           // quilt
    c.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) { rr(c, 82 + i * ((w - 108) / 4), 52 + j * 21, (w - 108) / 4 - 4, 18, 5); c.fill(); }
    rr(c, 22, 94, w - 34, 16, 6); fillOut(c, '#b8794a', 3.5);                                     // frame
    rr(c, 24, 104, 14, h - 110, 4); fillOut(c, '#9a6238', 3); rr(c, w - 30, 104, 14, h - 110, 4); fillOut(c, '#9a6238', 3);
  } },
  { id: 'rug', name: 'Rug', layer: 'rug', w: 230, h: 76, draw: (c, w, h) => {
    c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, Math.PI * 2); fillOut(c, '#e8604c');
    c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 20, h / 2 - 14, 0, 0, Math.PI * 2); c.fillStyle = '#f6c453'; c.fill();
    c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 40, h / 2 - 24, 0, 0, Math.PI * 2); c.fillStyle = '#7cc463'; c.fill();
    c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 62, h / 2 - 31, 0, 0, Math.PI * 2); c.fillStyle = '#fff1d6'; c.fill();
  } },
  { id: 'table', name: 'Table', layer: 'floor', w: 140, h: 100, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.42);
    rr(c, 22, 40, 14, h - 46, 5); fillOut(c, '#a8693c', 3.5); rr(c, w - 36, 40, 14, h - 46, 5); fillOut(c, '#a8693c', 3.5);
    rr(c, 6, 26, w - 12, 22, 10); fillOut(c, vgrad(c, 26, 48, '#e2a466', '#b8794a'));
    rr(c, 46, 6, 24, 24, 6); fillOut(c, '#ffffff', 3); c.beginPath(); c.arc(73, 18, 7, -1.2, 1.2); c.lineWidth = 3.5; c.strokeStyle = OUT; c.stroke(); // mug
    c.beginPath(); c.ellipse(96, 24, 18, 6, 0, 0, Math.PI * 2); fillOut(c, '#fdf6ea', 3);        // plate
    c.beginPath(); c.arc(96, 18, 8, Math.PI, 0); fillOut(c, '#e0a050', 3);                       // bun
  } },
  { id: 'chair', name: 'Chair', layer: 'floor', w: 74, h: 110, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.4);
    rr(c, 12, 6, w - 24, 52, 12); fillOut(c, vgrad(c, 6, 58, '#7cc463', '#4e9a3c'));
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(w / 2, 30, 8, 0, Math.PI * 2); c.fill();
    rr(c, 14, 64, 10, h - 70, 4); fillOut(c, '#a8693c', 3); rr(c, w - 24, 64, 10, h - 70, 4); fillOut(c, '#a8693c', 3);
    rr(c, 6, 54, w - 12, 16, 7); fillOut(c, '#c98a55', 3.5);
  } },
  { id: 'lamp', name: 'Lamp', layer: 'floor', w: 64, h: 150, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.4);
    rr(c, w / 2 - 4, 46, 8, h - 60, 3); fillOut(c, '#8a6a50', 3);
    c.beginPath(); c.ellipse(w / 2, h - 12, 22, 8, 0, 0, Math.PI * 2); fillOut(c, '#8a6a50', 3.5);
    c.beginPath(); c.moveTo(14, 52); c.lineTo(w - 14, 52); c.lineTo(w - 4, 6); c.lineTo(4, 6); c.closePath(); c.closePath();
    c.beginPath(); c.moveTo(4, 52); c.lineTo(w - 4, 52); c.lineTo(w - 14, 8); c.lineTo(14, 8); c.closePath(); fillOut(c, vgrad(c, 8, 52, '#ffe9a8', '#f6b84a'));
  } },
  { id: 'plant', name: 'Plant', layer: 'floor', w: 80, h: 120, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.36);
    const leaf = (x: number, y: number, a: number, s: number) => { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.ellipse(0, -s, s * 0.42, s, 0, 0, Math.PI * 2); fillOut(c, '#5fb45a', 3.5); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -s * 1.6); c.lineWidth = 2; c.strokeStyle = 'rgba(40,80,30,0.5)'; c.stroke(); c.restore(); };
    leaf(w / 2, 74, -0.75, 26); leaf(w / 2, 74, 0.75, 26); leaf(w / 2, 72, -0.25, 32); leaf(w / 2, 72, 0.3, 30);
    c.beginPath(); c.moveTo(16, 70); c.lineTo(w - 16, 70); c.lineTo(w - 22, h - 8); c.lineTo(22, h - 8); c.closePath(); fillOut(c, vgrad(c, 70, h, '#e8845c', '#c0563a'));
    rr(c, 12, 64, w - 24, 14, 5); fillOut(c, '#f09a70', 3.5);
  } },
  { id: 'shelf', name: 'Bookshelf', layer: 'floor', w: 116, h: 170, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.44);
    rr(c, 6, 6, w - 12, h - 14, 8); fillOut(c, vgrad(c, 6, h, '#c98a55', '#9a6238'));
    const cols = ['#e8604c', '#6fb8e8', '#f6c453', '#7cc463', '#b58ae0', '#ff9fb2'];
    for (let s = 0; s < 3; s++) {
      const y = 16 + s * ((h - 30) / 3), sh = (h - 30) / 3 - 10;
      rr(c, 14, y, w - 28, sh, 4); c.fillStyle = '#6b4226'; c.fill();
      let x = 18;
      for (let b = 0; x < w - 26; b++) { const bw = 9 + ((b * 7 + s * 3) % 6); const bh = sh - 4 - ((b * 5 + s) % 3) * 5; rr(c, x, y + sh - bh, bw, bh, 2); fillOut(c, cols[(b + s * 2) % cols.length], 2); x += bw + 2; }
    }
  } },
  { id: 'teddy', name: 'Teddy', layer: 'floor', w: 76, h: 86, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.36);
    const br = '#c98a55';
    c.beginPath(); c.arc(16, 22, 10, 0, Math.PI * 2); fillOut(c, br, 3.5); c.beginPath(); c.arc(w - 16, 22, 10, 0, Math.PI * 2); fillOut(c, br, 3.5);
    c.beginPath(); c.ellipse(w / 2, 62, 26, 22, 0, 0, Math.PI * 2); fillOut(c, br);
    c.beginPath(); c.ellipse(w / 2, 64, 13, 11, 0, 0, Math.PI * 2); c.fillStyle = '#f3d2a8'; c.fill();
    c.beginPath(); c.arc(w / 2, 32, 22, 0, Math.PI * 2); fillOut(c, br);
    c.beginPath(); c.ellipse(w / 2, 38, 10, 8, 0, 0, Math.PI * 2); c.fillStyle = '#f3d2a8'; c.fill();
    c.fillStyle = OUT; c.beginPath(); c.arc(w / 2 - 8, 28, 3, 0, Math.PI * 2); c.arc(w / 2 + 8, 28, 3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(w / 2, 35, 4, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8604c'; c.beginPath(); c.moveTo(w / 2, 50); c.lineTo(w / 2 - 12, 44); c.lineTo(w / 2 - 12, 56); c.closePath(); c.moveTo(w / 2, 50); c.lineTo(w / 2 + 12, 44); c.lineTo(w / 2 + 12, 56); c.closePath(); c.fill();
  } },
  { id: 'painting', name: 'Painting', layer: 'wall', w: 120, h: 92, draw: (c, w, h) => {
    rr(c, 4, 4, w - 8, h - 8, 6); fillOut(c, vgrad(c, 4, h, '#f2c14e', '#c9932a'), 4.5);
    rr(c, 16, 16, w - 32, h - 32, 3); c.fillStyle = vgrad(c, 16, h - 16, '#9fd6f5', '#d8f0ff'); c.fill();
    c.fillStyle = '#7cc463'; c.beginPath(); c.moveTo(16, h - 16); c.quadraticCurveTo(w * 0.35, h * 0.42, w * 0.6, h - 16); c.fill();
    c.fillStyle = '#5fa84c'; c.beginPath(); c.moveTo(w * 0.4, h - 16); c.quadraticCurveTo(w * 0.7, h * 0.36, w - 16, h - 16); c.fill();
    c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(w - 34, 32, 9, 0, Math.PI * 2); c.fill();
  } },
  { id: 'clock', name: 'Clock', layer: 'wall', w: 76, h: 76, draw: (c, w, h) => {
    c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); fillOut(c, '#b8794a', 4.5);
    c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 13, 0, Math.PI * 2); c.fillStyle = '#fffaf0'; c.fill();
    c.fillStyle = OUT;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.arc(w / 2 + Math.cos(a) * (w / 2 - 19), h / 2 + Math.sin(a) * (w / 2 - 19), i % 3 ? 1.6 : 3, 0, Math.PI * 2); c.fill(); }
    c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2, h / 2 - 18); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 13, h / 2 + 4); c.stroke();
    c.fillStyle = '#e8604c'; c.beginPath(); c.arc(w / 2, h / 2, 4, 0, Math.PI * 2); c.fill();
  } },
];
export const FURN: Record<string, FurnDef> = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));

/** Make (once) a crisp texture for a furniture piece. Image scale = 1 / res. */
export function furnTexture(scene: Phaser.Scene, id: string, res: number) {
  const key = `furn-${id}`;
  if (!scene.textures.exists(key)) {
    const d = FURN[id];
    const t = scene.textures.createCanvas(key, Math.ceil(d.w * res), Math.ceil(d.h * res))!;
    const c = t.getContext();
    c.scale(res, res);
    d.draw(c, d.w, d.h);
    t.refresh();
  }
  return key;
}

/** A fresh home's starting layout (x: 0..1 across the room; y: 0..1 floor depth for floor things, wall height for wall things). */
export const HOME_START = [
  { k: 'rug', x: 0.5, y: 0.55 }, { k: 'bed', x: 0.22, y: 0.42 }, { k: 'table', x: 0.62, y: 0.6 },
  { k: 'chair', x: 0.76, y: 0.62 }, { k: 'lamp', x: 0.9, y: 0.3 }, { k: 'plant', x: 0.08, y: 0.85 },
  { k: 'painting', x: 0.6, y: 0.4 },
];
