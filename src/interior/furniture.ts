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

/** A flower pot at each growth stage: 0 soil, 1 sprout, 2 bud, 3 bloom. */
function drawPot(c: CanvasRenderingContext2D, w: number, h: number, stage: number) {
  shadow(c, w / 2, h - 5, w * 0.36);
  const py = h - 46;
  if (stage >= 1) {
    const top = stage === 1 ? py - 16 : stage === 2 ? py - 40 : py - 52;
    c.lineCap = 'round'; c.lineWidth = 7; c.strokeStyle = OUT; c.beginPath(); c.moveTo(w / 2, py + 4); c.lineTo(w / 2, top); c.stroke();
    c.lineWidth = 3.5; c.strokeStyle = '#4e9a3c'; c.stroke();
    const leaf = (x: number, y: number, a: number, s: number) => { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.ellipse(s, 0, s, s * 0.5, 0, 0, Math.PI * 2); fillOut(c, '#7cc463', 3); c.restore(); };
    leaf(w / 2, top + (stage === 1 ? 4 : 18), -0.5, stage === 1 ? 8 : 12); leaf(w / 2, top + (stage === 1 ? 4 : 24), Math.PI + 0.5, stage === 1 ? 8 : 12);
    if (stage === 2) { c.beginPath(); c.ellipse(w / 2, top - 4, 8, 11, 0, 0, Math.PI * 2); fillOut(c, '#ff9fb2', 3); c.fillStyle = '#7cc463'; c.beginPath(); c.moveTo(w / 2 - 8, top); c.lineTo(w / 2, top + 6); c.lineTo(w / 2 + 8, top); c.fill(); }
    if (stage === 3) {
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.ellipse(w / 2 + Math.cos(a) * 13, top + Math.sin(a) * 13, 10, 7, a, 0, Math.PI * 2); fillOut(c, i % 2 ? '#ff7fa0' : '#ff9fb2', 3); }
      c.beginPath(); c.arc(w / 2, top, 8, 0, Math.PI * 2); fillOut(c, '#ffd34d', 3);
    }
  }
  c.beginPath(); c.moveTo(12, py); c.lineTo(w - 12, py); c.lineTo(w - 20, h - 8); c.lineTo(20, h - 8); c.closePath(); fillOut(c, vgrad(c, py, h, '#e8875c', '#c0603a'));
  rr(c, 8, py - 6, w - 16, 14, 5); fillOut(c, '#e8875c', 3.5);
  c.fillStyle = '#6b4226'; c.beginPath(); c.ellipse(w / 2, py - 1, w / 2 - 14, 4, 0, 0, Math.PI * 2); c.fill();
  if (stage === 0) { c.fillStyle = '#f6e2a8'; for (const x of [-8, 2, 10]) { c.beginPath(); c.ellipse(w / 2 + x, py - 2, 2.5, 1.6, 0, 0, Math.PI * 2); c.fill(); } }
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
  // ---- Kitchen (9.4 slice 2)
  { id: 'stove', name: 'Stove', layer: 'floor', w: 124, h: 132, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.44);
    rr(c, 6, 22, w - 12, h - 30, 10); fillOut(c, vgrad(c, 22, h, '#f2f2f0', '#cfd6dc'));
    rr(c, 2, 12, w - 4, 18, 7); fillOut(c, '#5a6470', 3.5);
    c.fillStyle = '#2f353c'; for (const x of [w * 0.3, w * 0.7]) { c.beginPath(); c.ellipse(x, 19, 18, 5, 0, 0, Math.PI * 2); c.fill(); }
    rr(c, 18, 50, w - 36, h - 70, 8); fillOut(c, vgrad(c, 50, h - 20, '#3a4048', '#22262c'), 3.5);
    rr(c, 26, 58, w - 52, 26, 5); c.fillStyle = 'rgba(255,170,80,0.55)'; c.fill();
    rr(c, 30, 40, w - 60, 6, 3); fillOut(c, '#c0c6cc', 2.5);
    c.fillStyle = '#e8604c'; for (const x of [16, 28, w - 28, w - 16]) { c.beginPath(); c.arc(x, 40, 4, 0, Math.PI * 2); c.fill(); }
  } },
  { id: 'coffee', name: 'Coffee', layer: 'floor', w: 118, h: 128, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.44);
    rr(c, 6, 56, w - 12, h - 62, 8); fillOut(c, vgrad(c, 56, h, '#9fd6c4', '#6fb39e'));
    rr(c, 14, 70, (w - 36) / 2, h - 86, 5); fillOut(c, '#8fc9b6', 3); rr(c, w / 2 + 4, 70, (w - 36) / 2, h - 86, 5); fillOut(c, '#8fc9b6', 3);
    rr(c, 2, 48, w - 4, 12, 5); fillOut(c, '#e2a466', 3.5);
    rr(c, 24, 6, 58, 44, 10); fillOut(c, vgrad(c, 6, 50, '#e8604c', '#b8402e'));
    rr(c, 30, 24, 46, 22, 4); c.fillStyle = '#2f353c'; c.fill();
    rr(c, 44, 30, 18, 16, 3); fillOut(c, '#ffffff', 2.5);
    c.fillStyle = '#fff1c4'; c.beginPath(); c.arc(36, 15, 3.5, 0, Math.PI * 2); c.fill();
    rr(c, 88, 28, 18, 22, 4); fillOut(c, '#f6c453', 3);
  } },
  { id: 'fridge', name: 'Fridge', layer: 'floor', w: 92, h: 176, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.44);
    rr(c, 6, 6, w - 12, h - 14, 14); fillOut(c, vgrad(c, 6, h, '#bfe6fb', '#86c4e8'));
    c.lineWidth = 3.5; c.strokeStyle = OUT; c.beginPath(); c.moveTo(8, 62); c.lineTo(w - 8, 62); c.stroke();
    rr(c, w - 24, 24, 7, 26, 3); fillOut(c, '#e8f4fb', 2.5); rr(c, w - 24, 76, 7, 40, 3); fillOut(c, '#e8f4fb', 2.5);
    c.fillStyle = '#ff9fb2'; c.beginPath(); c.arc(26, 90, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f6c453'; c.beginPath(); c.arc(38, 108, 6, 0, Math.PI * 2); c.fill();
    rr(c, 18, 120, 30, 24, 3); fillOut(c, '#fffaf0', 2); c.fillStyle = '#7cc463'; c.fillRect(24, 128, 18, 3); c.fillRect(24, 135, 12, 3);
  } },
  { id: 'sink', name: 'Sink', layer: 'floor', w: 124, h: 120, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.44);
    rr(c, 6, 44, w - 12, h - 50, 8); fillOut(c, vgrad(c, 44, h, '#f6d38a', '#e0a850'));
    rr(c, 16, 58, (w - 40) / 2, h - 74, 5); fillOut(c, '#f9e0a8', 3); rr(c, w / 2 + 4, 58, (w - 40) / 2, h - 74, 5); fillOut(c, '#f9e0a8', 3);
    rr(c, 2, 36, w - 4, 12, 5); fillOut(c, '#e8f4fb', 3.5);
    c.beginPath(); c.ellipse(w / 2, 40, 30, 4, 0, 0, Math.PI * 2); c.fillStyle = '#9fb4c4'; c.fill();
    c.lineCap = 'round';
    c.lineWidth = 8; c.strokeStyle = OUT; c.beginPath(); c.moveTo(w / 2 - 20, 36); c.lineTo(w / 2 - 20, 12); c.quadraticCurveTo(w / 2 - 20, 4, w / 2 - 8, 6); c.lineTo(w / 2, 14); c.stroke();
    c.lineWidth = 4; c.strokeStyle = '#d6dde2'; c.beginPath(); c.moveTo(w / 2 - 20, 36); c.lineTo(w / 2 - 20, 12); c.quadraticCurveTo(w / 2 - 20, 4, w / 2 - 8, 6); c.lineTo(w / 2, 14); c.stroke();
  } },
  // ---- Workshop (9.4 slice 3)
  { id: 'workbench', name: 'Workbench', layer: 'floor', w: 176, h: 118, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.46);
    rr(c, 16, 44, 16, h - 50, 5); fillOut(c, '#9a6238', 3.5); rr(c, w - 32, 44, 16, h - 50, 5); fillOut(c, '#9a6238', 3.5);
    rr(c, 20, 82, w - 40, 10, 4); fillOut(c, '#b8794a', 3);
    rr(c, 4, 32, w - 8, 20, 6); fillOut(c, vgrad(c, 32, 52, '#e2a466', '#b8794a'));
    c.strokeStyle = 'rgba(90,50,25,0.45)'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 42); c.lineTo(w - 14, 42); c.stroke();
    rr(c, 22, 18, 64, 14, 4); fillOut(c, '#f0c48a', 3);                                                 // a plank
    c.save(); c.translate(118, 22); c.rotate(-0.35);                                                    // hammer
    rr(c, -3, -4, 40, 7, 3); fillOut(c, '#c98a55', 3); rr(c, 32, -12, 12, 22, 3); fillOut(c, '#9aa6b2', 3); c.restore();
    c.fillStyle = '#7d8a96'; for (const x of [96, 104, 150]) { c.beginPath(); c.arc(x, 28, 2.5, 0, Math.PI * 2); c.fill(); } // nails
  } },
  { id: 'lumber', name: 'Supplies', layer: 'floor', w: 128, h: 96, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.44);
    const log = (x: number, y: number) => { rr(c, x, y, 62, 22, 11); fillOut(c, vgrad(c, y, y + 22, '#d29a62', '#a8693c'), 3); c.beginPath(); c.ellipse(x + 56, y + 11, 8, 10, 0, 0, Math.PI * 2); fillOut(c, '#f0c48a', 3); c.beginPath(); c.ellipse(x + 56, y + 11, 3, 4, 0, 0, Math.PI * 2); c.strokeStyle = '#b8794a'; c.lineWidth = 1.5; c.stroke(); };
    log(6, h - 32); log(6, h - 54); log(30, h - 76);
    const rock = (x: number, y: number, r: number) => { c.beginPath(); c.ellipse(x, y, r, r * 0.78, 0, 0, Math.PI * 2); fillOut(c, vgrad(c, y - r, y + r, '#c4ccd4', '#8f9ba6'), 3); c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.3, r * 0.25, 0, Math.PI * 2); c.fill(); };
    rock(94, h - 18, 16); rock(116, h - 16, 11); rock(104, h - 38, 12);
  } },
  { id: 'toolwall', name: 'Tools', layer: 'wall', w: 140, h: 92, draw: (c, w, h) => {
    rr(c, 4, 4, w - 8, h - 8, 8); fillOut(c, vgrad(c, 4, h, '#e9c79a', '#d4a978'), 4.5);
    c.fillStyle = 'rgba(90,50,25,0.3)'; for (let x = 16; x < w - 10; x += 14) for (let y = 16; y < h - 10; y += 14) { c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill(); }
    rr(c, 20, 20, 8, 46, 3); fillOut(c, '#c98a55', 2.5); rr(c, 12, 14, 24, 12, 3); fillOut(c, '#9aa6b2', 2.5);          // hammer
    c.beginPath(); c.moveTo(50, 18); c.lineTo(72, 18); c.lineTo(72, 64); c.lineTo(50, 70); c.closePath(); fillOut(c, '#c4ccd4', 2.5); // saw
    rr(c, 46, 14, 10, 18, 3); fillOut(c, '#e8604c', 2.5);
    rr(c, 86, 22, 8, 44, 3); fillOut(c, '#9aa6b2', 2.5); c.beginPath(); c.arc(90, 20, 9, 0, Math.PI * 2); fillOut(c, '#9aa6b2', 2.5); // wrench
    c.fillStyle = '#e9c79a'; c.fillRect(86, 9, 8, 9);
    rr(c, 108, 16, 18, 52, 4); fillOut(c, '#f6c453', 2.5); c.fillStyle = OUT; for (let y = 22; y < 64; y += 8) c.fillRect(108, y, 6, 2); // ruler
  } },
  { id: 'toyboat', name: 'Toy Boat', layer: 'floor', w: 96, h: 82, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.4);
    rr(c, w / 2 - 2, 8, 5, 50, 2); fillOut(c, '#9a6238', 2.5);
    c.beginPath(); c.moveTo(w / 2 + 4, 10); c.lineTo(w / 2 + 34, 46); c.lineTo(w / 2 + 4, 46); c.closePath(); fillOut(c, '#fffaf0', 3);
    c.beginPath(); c.moveTo(w / 2 - 6, 18); c.lineTo(w / 2 - 6, 46); c.lineTo(w / 2 - 28, 46); c.closePath(); fillOut(c, '#e8604c', 3);
    c.beginPath(); c.moveTo(6, 50); c.lineTo(w - 6, 50); c.lineTo(w - 18, h - 10); c.lineTo(18, h - 10); c.closePath(); fillOut(c, vgrad(c, 50, h, '#6fb8e8', '#3f8fc6'));
    c.fillStyle = '#fffaf0'; for (const x of [32, 48, 64]) { c.beginPath(); c.arc(x, 60, 3.5, 0, Math.PI * 2); c.fill(); }
  } },
  { id: 'birdhouse', name: 'Birdhouse', layer: 'wall', w: 80, h: 100, draw: (c, w, h) => {
    rr(c, 14, 36, w - 28, h - 44, 6); fillOut(c, vgrad(c, 36, h, '#f6c453', '#e0a030'));
    c.beginPath(); c.moveTo(4, 42); c.lineTo(w / 2, 6); c.lineTo(w - 4, 42); c.closePath(); fillOut(c, '#e8604c');
    c.beginPath(); c.arc(w / 2, 58, 11, 0, Math.PI * 2); fillOut(c, '#4a3022', 3);
    rr(c, w / 2 - 12, 78, 24, 5, 2); fillOut(c, '#9a6238', 2.5);
  } },
  { id: 'stonefrog', name: 'Stone Frog', layer: 'floor', w: 84, h: 70, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.4);
    c.beginPath(); c.ellipse(w / 2, h - 24, 34, 20, 0, 0, Math.PI * 2); fillOut(c, vgrad(c, h - 44, h - 4, '#c4ccd4', '#8f9ba6'));
    for (const x of [w / 2 - 16, w / 2 + 16]) { c.beginPath(); c.arc(x, h - 46, 11, 0, Math.PI * 2); fillOut(c, '#b4bec8', 3.5); c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(x, h - 47, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = OUT; c.beginPath(); c.arc(x + 1, h - 46, 3, 0, Math.PI * 2); c.fill(); }
    c.lineWidth = 3; c.strokeStyle = OUT; c.lineCap = 'round'; c.beginPath(); c.arc(w / 2, h - 30, 12, 0.3, Math.PI - 0.3); c.stroke();
    c.fillStyle = 'rgba(255,140,160,0.5)'; for (const x of [w / 2 - 22, w / 2 + 22]) { c.beginPath(); c.arc(x, h - 28, 4, 0, Math.PI * 2); c.fill(); }
  } },
  { id: 'rockinghorse', name: 'Horsey', layer: 'floor', w: 124, h: 108, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.44);
    c.beginPath(); c.moveTo(10, h - 22); c.quadraticCurveTo(w / 2, h + 2, w - 10, h - 22); c.lineWidth = 12; c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#e8604c'; c.stroke();
    for (const x of [34, w - 34]) { rr(c, x - 5, 56, 10, h - 72, 4); fillOut(c, '#b8794a', 3); }
    rr(c, 22, 40, w - 48, 26, 13); fillOut(c, vgrad(c, 40, 66, '#e2a466', '#b8794a'));
    c.beginPath(); c.moveTo(w - 40, 46); c.lineTo(w - 26, 10); c.lineTo(w - 6, 18); c.lineTo(w - 14, 34); c.lineTo(w - 26, 52); c.closePath(); fillOut(c, '#e2a466');
    c.fillStyle = OUT; c.beginPath(); c.arc(w - 18, 20, 2.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(w - 30, 12); c.quadraticCurveTo(w - 44, 20, w - 42, 44); c.lineWidth = 7; c.strokeStyle = '#7a4a2a'; c.stroke();
    rr(c, 50, 34, 26, 10, 4); fillOut(c, '#e8604c', 2.5);
    c.beginPath(); c.moveTo(24, 48); c.quadraticCurveTo(8, 50, 10, 68); c.lineWidth = 6; c.strokeStyle = '#7a4a2a'; c.stroke();
  } },
  // ---- 9.4 slice 4: Garden shed + Fishing hut ----
  ...[0, 1, 2, 3].map((stage): FurnDef => ({ id: stage ? `pot_${stage}` : 'pot', name: 'Flower Pot', layer: 'floor', w: 80, h: 116, draw: (c, w, h) => drawPot(c, w, h, stage) })),
  { id: 'wateringcan', name: 'Watering Can', layer: 'floor', w: 104, h: 78, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.4);
    c.beginPath(); c.moveTo(w - 40, h - 34); c.lineTo(w - 6, h - 62); c.lineTo(w - 2, h - 56); c.lineTo(w - 32, h - 22); c.closePath(); fillOut(c, '#4fa3d8', 3.5); // spout
    rr(c, w - 12, h - 70, 12, 14, 4); fillOut(c, '#3f8fc6', 3);
    c.beginPath(); c.arc(32, 22, 18, Math.PI, 0); c.lineWidth = 9; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#3f8fc6'; c.stroke(); // handle
    rr(c, 10, 22, 56, h - 30, 12); fillOut(c, vgrad(c, 22, h, '#6fc0ec', '#3f8fc6'));
    c.fillStyle = 'rgba(255,255,255,0.45)'; rr(c, 18, 28, 8, h - 46, 4); c.fill();
    c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(40, h - 30, 7, 0, Math.PI * 2); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  } },
  { id: 'seedrack', name: 'Seeds', layer: 'wall', w: 124, h: 92, draw: (c, w, h) => {
    rr(c, 4, 4, w - 8, h - 8, 8); fillOut(c, vgrad(c, 4, h, '#e2a466', '#b8794a'));
    const cols = ['#f6c453', '#e8604c', '#ff9fb2', '#7cc463', '#b48ae0', '#ff9a3c'];
    for (let i = 0; i < 6; i++) {
      const x = 14 + (i % 3) * 34, y = 12 + Math.floor(i / 3) * 38;
      rr(c, x, y, 28, 32, 4); fillOut(c, '#fffaf0', 3);
      c.fillStyle = cols[i]; c.beginPath(); c.arc(x + 14, y + 14, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4e9a3c'; c.fillRect(x + 13, y + 20, 2.5, 8);
    }
  } },
  { id: 'veggiebasket', name: 'Veggies', layer: 'floor', w: 116, h: 84, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.44);
    for (const [x, col] of [[30, '#ff9a3c'], [52, '#e8604c'], [76, '#9ad46b'], [92, '#e8604c']] as [number, string][]) {
      c.beginPath(); c.arc(x, 34, 15, 0, Math.PI * 2); fillOut(c, col, 3.5);
      c.fillStyle = '#4e9a3c'; c.beginPath(); c.ellipse(x, 20, 6, 3, 0, 0, Math.PI * 2); c.fill();
    }
    c.beginPath(); c.moveTo(6, 38); c.lineTo(w - 6, 38); c.lineTo(w - 16, h - 8); c.lineTo(16, h - 8); c.closePath(); fillOut(c, vgrad(c, 38, h, '#e2b066', '#b8794a'));
    c.lineWidth = 2.5; c.strokeStyle = 'rgba(74,48,34,0.55)';
    for (let y = 50; y < h - 10; y += 10) { c.beginPath(); c.moveTo(14, y); c.lineTo(w - 14, y); c.stroke(); }
  } },
  { id: 'fishhole', name: 'Fishing Hole', layer: 'rug', w: 190, h: 82, draw: (c, w, h) => {
    c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, Math.PI * 2); fillOut(c, '#a8693c');
    c.fillStyle = 'rgba(74,48,34,0.35)'; for (let x = 30; x < w - 20; x += 26) c.fillRect(x, 8, 2.5, h - 16);
    c.beginPath(); c.ellipse(w / 2, h / 2 + 2, w / 2 - 26, h / 2 - 16, 0, 0, Math.PI * 2);
    const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2 - 26); g.addColorStop(0, '#5ec2e8'); g.addColorStop(1, '#2a6f9e');
    fillOut(c, g, 3.5);
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(w / 2 - 14, h / 2, 22, 6, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(w / 2 + 24, h / 2 + 6, 12, 3.5, 0, 0, Math.PI * 2); c.stroke();
  } },
  { id: 'rodrack', name: 'Rods', layer: 'wall', w: 134, h: 104, draw: (c, w, h) => {
    rr(c, 6, 14, w - 12, 16, 6); fillOut(c, '#9a6238', 3.5); rr(c, 6, h - 30, w - 12, 16, 6); fillOut(c, '#9a6238', 3.5);
    for (const [x, col] of [[30, '#e8604c'], [66, '#f6c453'], [102, '#7cc463']] as [number, string][]) {
      c.lineCap = 'round'; c.lineWidth = 7; c.strokeStyle = OUT; c.beginPath(); c.moveTo(x, h - 6); c.lineTo(x + 8, 4); c.stroke();
      c.lineWidth = 3.5; c.strokeStyle = col; c.stroke();
      c.beginPath(); c.arc(x - 6, h - 32, 8, 0, Math.PI * 2); fillOut(c, '#d0d6dc', 3);
      c.lineWidth = 1.5; c.strokeStyle = 'rgba(74,48,34,0.6)'; c.beginPath(); c.moveTo(x + 8, 4); c.quadraticCurveTo(x + 16, 40, x + 12, 70); c.stroke();
    }
  } },
  { id: 'fishbarrel', name: 'Fish Barrel', layer: 'floor', w: 100, h: 118, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.42);
    for (const [x, col, a] of [[34, '#ff9a3c', -0.4], [62, '#6fb8e8', 0.35]] as [number, string, number][]) {
      c.save(); c.translate(x, 24); c.rotate(a);
      c.beginPath(); c.moveTo(0, 10); c.lineTo(-12, -14); c.lineTo(12, -14); c.closePath(); fillOut(c, col, 3); c.restore();
    }
    c.beginPath(); c.moveTo(12, 28); c.quadraticCurveTo(2, h / 2 + 10, 14, h - 10); c.lineTo(w - 14, h - 10); c.quadraticCurveTo(w - 2, h / 2 + 10, w - 12, 28); c.closePath();
    fillOut(c, vgrad(c, 28, h, '#c98a55', '#9a6238'));
    c.lineWidth = 5; c.strokeStyle = '#6b7f94';
    for (const y of [44, h - 26]) { c.beginPath(); c.moveTo(8, y); c.lineTo(w - 8, y); c.stroke(); }
    c.beginPath(); c.ellipse(w / 2, 28, w / 2 - 12, 8, 0, 0, Math.PI * 2); fillOut(c, '#3f6f8f', 3.5);
  } },
  { id: 'lifering', name: 'Life Ring', layer: 'wall', w: 86, h: 86, draw: (c, w, h) => {
    const r = w / 2 - 6;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(w / 2, h / 2, r, i * Math.PI / 2, (i + 1) * Math.PI / 2); c.arc(w / 2, h / 2, r * 0.52, (i + 1) * Math.PI / 2, i * Math.PI / 2, true); c.closePath(); c.fillStyle = i % 2 ? '#fffaf0' : '#e8604c'; c.fill(); }
    c.lineWidth = 4; c.strokeStyle = OUT; c.beginPath(); c.arc(w / 2, h / 2, r, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(w / 2, h / 2, r * 0.52, 0, Math.PI * 2); c.stroke();
  } },
  // ---- Workshop tools (12.2): things you make with the tool wall's wrench, hammer, screwdriver, saw and paintbrush
  { id: 'cog', name: 'Golden Cog', layer: 'wall', w: 96, h: 96, draw: (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, a2 = a + Math.PI / 8; c.lineTo(cx + Math.cos(a - 0.17) * 36, cy + Math.sin(a - 0.17) * 36); c.lineTo(cx + Math.cos(a - 0.12) * 46, cy + Math.sin(a - 0.12) * 46); c.lineTo(cx + Math.cos(a + 0.12) * 46, cy + Math.sin(a + 0.12) * 46); c.lineTo(cx + Math.cos(a + 0.17) * 36, cy + Math.sin(a + 0.17) * 36); void a2; }
    c.closePath(); fillOut(c, vgrad(c, 4, h, '#ffe27a', '#e0a020'), 4);
    c.beginPath(); c.arc(cx, cy, 28, 0, Math.PI * 2); fillOut(c, vgrad(c, 20, 76, '#ffd34d', '#f0b030'), 3.5);
    c.beginPath(); c.arc(cx, cy, 11, 0, Math.PI * 2); fillOut(c, '#fff1c4', 3.5);
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(cx - 12, cy - 14, 5, 0, Math.PI * 2); c.fill();
  } },
  { id: 'sign', name: 'Welcome Sign', layer: 'wall', w: 138, h: 80, draw: (c, w, h) => {
    c.lineWidth = 3; c.strokeStyle = OUT; c.beginPath(); c.moveTo(34, 8); c.lineTo(34, 22); c.moveTo(w - 34, 8); c.lineTo(w - 34, 22); c.stroke();
    rr(c, 6, 20, w - 12, h - 28, 10); fillOut(c, vgrad(c, 20, h, '#e9b676', '#c98a55'), 4);
    c.strokeStyle = 'rgba(90,50,25,0.4)'; c.lineWidth = 2; for (const y of [38, 52]) { c.beginPath(); c.moveTo(14, y); c.lineTo(w - 14, y); c.stroke(); }
    c.fillStyle = '#7d8a96'; for (const [x, y] of [[16, 30], [w - 16, 30], [16, h - 18], [w - 16, h - 18]]) { c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.moveTo(w / 2, 52); c.bezierCurveTo(w / 2 - 22, 36, w / 2 - 10, 28, w / 2, 40); c.bezierCurveTo(w / 2 + 10, 28, w / 2 + 22, 36, w / 2, 52); fillOut(c, '#e8604c', 3);
  } },
  { id: 'musicbox', name: 'Music Box', layer: 'floor', w: 104, h: 92, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.42);
    rr(c, 10, 34, w - 20, h - 42, 10); fillOut(c, vgrad(c, 34, h, '#d98aa8', '#b8607f'), 4);
    rr(c, 4, 22, w - 8, 20, 8); fillOut(c, vgrad(c, 22, 42, '#f6b8cc', '#e08aa8'), 4);
    rr(c, 18, 50, w - 36, 18, 6); fillOut(c, '#fff1d6', 3);
    c.fillStyle = '#4a3022'; for (let i = 0; i < 5; i++) c.fillRect(24 + i * 11, 54, 3, 10);
    c.lineWidth = 3; c.strokeStyle = OUT; c.beginPath(); c.arc(w / 2, 14, 7, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(w / 2, 14, 7, 0, Math.PI * 2); c.fillStyle = '#ffd34d'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(w / 2, 21); c.lineTo(w / 2, 26); c.stroke();
  } },
  { id: 'stool', name: 'Wooden Stool', layer: 'floor', w: 90, h: 84, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.4);
    c.lineCap = 'round';
    for (const [x0, x1] of [[20, 14], [w - 20, w - 14], [w / 2, w / 2]] as [number, number][]) { c.lineWidth = 12; c.strokeStyle = OUT; c.beginPath(); c.moveTo(x0, 40); c.lineTo(x1, h - 10); c.stroke(); c.lineWidth = 6; c.strokeStyle = '#a8693c'; c.stroke(); }
    c.beginPath(); c.ellipse(w / 2, 34, w / 2 - 6, 18, 0, 0, Math.PI * 2); fillOut(c, vgrad(c, 16, 52, '#f0c48a', '#d29a62'), 4);
    c.strokeStyle = 'rgba(120,70,30,0.5)'; c.lineWidth = 2; c.beginPath(); c.ellipse(w / 2, 34, 22, 8, 0, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.ellipse(w / 2, 34, 9, 3, 0, 0, Math.PI * 2); c.stroke();
  } },
  { id: 'paintedhouse', name: 'Painted Birdhouse', layer: 'floor', w: 96, h: 134, draw: (c, w, h) => {
    shadow(c, w / 2, h - 5, w * 0.3);
    rr(c, w / 2 - 6, 70, 12, h - 76, 4); fillOut(c, '#9a6238', 3.5);
    rr(c, 14, 36, w - 28, 54, 7); fillOut(c, vgrad(c, 36, 90, '#7fd1e8', '#4aa8d0'), 4);
    c.beginPath(); c.moveTo(4, 42); c.lineTo(w / 2, 4); c.lineTo(w - 4, 42); c.closePath(); fillOut(c, '#ff6f8f', 4);
    c.fillStyle = '#ffd34d'; for (const x of [28, 48, 68]) { c.beginPath(); c.arc(x, 34, 4, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(w / 2, 62, 12, 0, Math.PI * 2); fillOut(c, '#4a3022', 3.5);
    c.beginPath(); c.arc(w / 2, 62, 17, 0, Math.PI * 2); c.lineWidth = 5; c.strokeStyle = '#ffd34d'; c.stroke(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    rr(c, w / 2 - 14, 86, 28, 6, 3); fillOut(c, '#7cc463', 2.5);
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

/** A fresh kitchen's starting layout. */
export const KITCHEN_START = [
  { k: 'fridge', x: 0.2, y: 0.12 }, { k: 'stove', x: 0.38, y: 0.14 }, { k: 'sink', x: 0.56, y: 0.14 }, { k: 'coffee', x: 0.74, y: 0.14 },
  { k: 'table', x: 0.52, y: 0.78 }, { k: 'chair', x: 0.38, y: 0.8 }, { k: 'chair', x: 0.66, y: 0.8 }, { k: 'plant', x: 0.94, y: 0.85 },
  { k: 'clock', x: 0.88, y: 0.35 },
];

/** A fresh workshop's starting layout. */
export const WORKSHOP_START = [
  { k: 'workbench', x: 0.42, y: 0.3 }, { k: 'lumber', x: 0.16, y: 0.36 }, { k: 'toolwall', x: 0.7, y: 0.45 },
  { k: 'lamp', x: 0.9, y: 0.3 }, { k: 'rug', x: 0.58, y: 0.8 }, { k: 'toyboat', x: 0.66, y: 0.75 }, { k: 'plant', x: 0.06, y: 0.9 },
];

/** A fresh garden shed's starting layout. */
export const GARDEN_START = [
  { k: 'pot', x: 0.56, y: 0.2 }, { k: 'pot_1', x: 0.68, y: 0.22 }, { k: 'pot_2', x: 0.8, y: 0.2 }, { k: 'seedrack', x: 0.72, y: 0.42 },
  { k: 'wateringcan', x: 0.5, y: 0.62 }, { k: 'veggiebasket', x: 0.22, y: 0.78 }, { k: 'plant', x: 0.94, y: 0.85 }, { k: 'rug', x: 0.66, y: 0.84 },
];

/** A fresh fishing hut's starting layout. */
export const FISHHUT_START = [
  { k: 'fishhole', x: 0.55, y: 0.62 }, { k: 'rodrack', x: 0.72, y: 0.45 }, { k: 'fishbarrel', x: 0.2, y: 0.4 }, { k: 'lifering', x: 0.9, y: 0.35 },
  { k: 'chair', x: 0.8, y: 0.72 }, { k: 'plant', x: 0.94, y: 0.9 },
];

/** Things the workbench can build, and what they cost (village wood and stone). */
export const RECIPES: { id: string; cost: { wood?: number; stone?: number } }[] = [
  { id: 'toyboat', cost: { wood: 1 } }, { id: 'birdhouse', cost: { wood: 2 } }, { id: 'stonefrog', cost: { stone: 2 } }, { id: 'rockinghorse', cost: { wood: 2, stone: 1 } },
];

/** Room look + the tray of things you can add, per building type. */
export type RoomStyle = { wall: number; stripe: number; dot: number; wains: number; wainsDark: number; wainsTop: number; floorA: number; floorB: number; line: number; tiles?: boolean; checker?: boolean };
export const ROOMS: Record<string, { start: { k: string; x: number; y: number }[]; tray: string[]; style: RoomStyle }> = {
  home: { start: HOME_START, tray: ['bed', 'rug', 'table', 'chair', 'lamp', 'plant', 'shelf', 'teddy', 'painting', 'clock'],
    style: { wall: 0xfbe9cf, stripe: 0xf5dcb8, dot: 0xf0c9a0, wains: 0xc98a55, wainsDark: 0xb8794a, wainsTop: 0xe2a466, floorA: 0xd09060, floorB: 0xa8693c, line: 0x8a5430 } },
  kitchen: { start: KITCHEN_START, tray: ['stove', 'coffee', 'fridge', 'sink', 'table', 'chair', 'plant', 'rug', 'clock', 'painting'],
    style: { wall: 0xe6f5ee, stripe: 0xd2ebdf, dot: 0xb5dccb, wains: 0x6fb39e, wainsDark: 0x5c9f8a, wainsTop: 0x9fd6c4, floorA: 0xfaf0dc, floorB: 0xe08a6e, line: 0xb8705a, tiles: true, checker: true } },
  workshop: { start: WORKSHOP_START, tray: ['workbench', 'lumber', 'toolwall', 'lamp', 'rug', 'chair', 'plant', 'shelf', 'clock', 'painting'],
    style: { wall: 0xeedcbf, stripe: 0xe3cca8, dot: 0xd8b98e, wains: 0x8a9aa8, wainsDark: 0x75868f, wainsTop: 0xaab8c4, floorA: 0xc79868, floorB: 0x9e6c42, line: 0x7d5232 } },
  garden: { start: GARDEN_START, tray: ['pot', 'wateringcan', 'seedrack', 'veggiebasket', 'plant', 'rug', 'chair', 'lamp', 'clock', 'painting'],
    style: { wall: 0xe9f5dc, stripe: 0xd9edc4, dot: 0xbfe0a4, wains: 0x9a6238, wainsDark: 0x86532e, wainsTop: 0xc98a55, floorA: 0xd9906a, floorB: 0xae6646, line: 0x844a30 } },
  fishhut: { start: FISHHUT_START, tray: ['fishhole', 'rodrack', 'fishbarrel', 'lifering', 'chair', 'lamp', 'rug', 'plant', 'clock', 'painting'],
    style: { wall: 0xdcecf5, stripe: 0xc9e1ee, dot: 0xa9cde0, wains: 0x3f6f8f, wainsDark: 0x335e7a, wainsTop: 0x6f9fbf, floorA: 0xbfa588, floorB: 0x8e7358, line: 0x6a5040 } },
};
export const roomOf = (type: string) => ROOMS[type] ?? ROOMS.home;
