// 64: painted props for the new regions (Sunflower Meadow, Pinecone Hills, Glowcap Grove, Seashell Bay).
// Same soft-dab style as art.ts; everything packs into the shared atlas.
import Phaser from 'phaser';
import { canvasTex, dab, hsl, mulberry32, rr, type Ctx } from './art';

function sunflower(c: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  const cx = w / 2, top = 18 + rng() * 6;
  // Stem with a gentle bend + two leaves.
  c.strokeStyle = hsl(100, 45, 34); c.lineWidth = 3.2;
  c.beginPath(); c.moveTo(cx, h - 1); c.quadraticCurveTo(cx + rr(rng, -5, 5), (h + top) / 2, cx + rr(rng, -2, 2), top + 6); c.stroke();
  for (const s of [-1, 1]) {
    const ly = top + (h - top) * (s < 0 ? 0.45 : 0.62);
    dab(c, cx + s * 8, ly, 8, 3.6, s * 0.5, hsl(100, 48, 38));
    dab(c, cx + s * 7, ly - 1, 5, 1.6, s * 0.5, hsl(95, 55, 52));
  }
  // Head: two rings of petals around a seedy disc.
  const hx = cx, hy = top, R = 11;
  for (let ring = 0; ring < 2; ring++) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.22;
      dab(c, hx + Math.cos(a) * R * 0.95, hy + Math.sin(a) * R * 0.85, 5.6, 2.4, a, hsl(ring ? 46 : 40, 92, ring ? 62 : 54));
    }
  }
  dab(c, hx, hy, 7.5, 7, 0, hsl(25, 55, 24));
  dab(c, hx - 1.5, hy - 1.5, 4.5, 4, 0, hsl(30, 55, 32));
  for (let i = 0; i < 10; i++) dab(c, hx + rr(rng, -5, 5), hy + rr(rng, -5, 5), 0.8, 0.8, 0, hsl(40, 60, 50, 0.8));
}

function beehive(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  // Little wooden stand.
  c.fillStyle = hsl(28, 40, 30); c.fillRect(cx - 18, h - 12, 4, 12); c.fillRect(cx + 14, h - 12, 4, 12);
  c.fillStyle = hsl(28, 40, 40); c.fillRect(cx - 22, h - 16, 44, 6);
  // Straw skep: stacked coils, widest at the bottom.
  const coils = 6;
  for (let i = 0; i < coils; i++) {
    const t = i / (coils - 1);
    const y = h - 20 - i * 7.2, rx = 21 - t * t * 15;
    dab(c, cx, y + 1.5, rx + 1, 4.6, 0, hsl(35, 45, 38));
    dab(c, cx, y, rx, 4.4, 0, hsl(42, 62, 58 + (i % 2) * 6));
    dab(c, cx - rx * 0.35, y - 1.6, rx * 0.4, 1.3, 0, hsl(48, 80, 78, 0.8));
  }
  // Door.
  dab(c, cx, h - 22, 4.6, 3.4, 0, hsl(25, 40, 14));
}

function bee(c: Ctx) {
  dab(c, 5, 3, 3, 2.2, -0.4, 'rgba(255,255,255,0.75)');
  dab(c, 8, 3, 3, 2.2, 0.4, 'rgba(255,255,255,0.75)');
  dab(c, 6.5, 6, 4.4, 3, 0, hsl(46, 95, 55));
  c.fillStyle = hsl(30, 40, 15); c.fillRect(5.2, 3.4, 1.4, 5); c.fillRect(7.8, 3.6, 1.4, 4.8);
}

function haybale(c: Ctx, w: number, h: number) {
  const rng = mulberry32(911);
  dab(c, w / 2, h - 6, w / 2 - 2, 5, 0, 'rgba(60,40,10,0.25)');
  // Round bale lying on its side: body + spiral end.
  c.fillStyle = hsl(44, 60, 56);
  c.beginPath(); c.ellipse(w / 2 + 6, h / 2 + 2, w / 2 - 8, h / 2 - 4, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 40; i++) {
    c.strokeStyle = hsl(rr(rng, 38, 50), 60, rr(rng, 50, 72), 0.8); c.lineWidth = 1;
    const x = rr(rng, 16, w - 6), y = rr(rng, 6, h - 6);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + rr(rng, 4, 9), y + rr(rng, -1, 1)); c.stroke();
  }
  const ex = 16, ey = h / 2 + 2;
  c.fillStyle = hsl(46, 62, 64); c.beginPath(); c.ellipse(ex, ey, 13, h / 2 - 4, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(38, 55, 44); c.lineWidth = 1.3;
  c.beginPath();
  for (let a = 0; a < Math.PI * 7; a += 0.2) { const r = a / (Math.PI * 7); c.lineTo(ex + Math.cos(a) * 12 * r, ey + Math.sin(a) * (h / 2 - 5) * r); }
  c.stroke();
}

const CAPS: [number, number, number][] = [[178, 70, 52], [275, 55, 60], [330, 65, 66]];
function glowcap(c: Ctx, w: number, h: number, v: number, seed: number) {
  const rng = mulberry32(seed);
  const [hh, ss, ll] = CAPS[v % 3];
  const n = v === 1 ? 1 : v === 0 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 1 : i === 0 ? 1 : 0.55 + rng() * 0.2;
    const x = n === 1 ? w / 2 : w * (i === 0 ? 0.42 : i === 1 ? 0.78 : 0.16);
    const capW = w * 0.42 * s, capH = h * 0.26 * s, top = h - h * 0.62 * s;
    // Stem.
    c.fillStyle = hsl(50, 40, 88);
    c.beginPath(); c.moveTo(x - capW * 0.22, h - 1); c.quadraticCurveTo(x - capW * 0.12, top + capH, x - capW * 0.14, top + capH * 0.6);
    c.lineTo(x + capW * 0.14, top + capH * 0.6); c.quadraticCurveTo(x + capW * 0.12, top + capH, x + capW * 0.24, h - 1); c.fill();
    dab(c, x + capW * 0.08, (top + h) / 2 + capH * 0.3, capW * 0.06, (h - top) * 0.3, 0, hsl(40, 25, 72, 0.7));
    // Cap (dome) with a soft rim + glowing spots.
    dab(c, x, top + capH * 0.62, capW * 1.02, capH * 0.42, 0, hsl(hh, ss - 10, ll - 22));
    c.fillStyle = hsl(hh, ss, ll);
    c.beginPath(); c.ellipse(x, top + capH * 0.55, capW, capH, 0, Math.PI, 0); c.fill();
    dab(c, x - capW * 0.3, top + capH * 0.05, capW * 0.42, capH * 0.28, -0.2, hsl(hh, ss + 10, ll + 18, 0.8));
    for (let d = 0; d < 6; d++) {
      const dx = rr(rng, -0.75, 0.75) * capW, dy = top + capH * rr(rng, 0, 0.45);
      dab(c, x + dx, dy, 2.6 * s, 2 * s, 0, hsl(hh + 20, 90, 88, 0.95));
    }
  }
}

function lighthouse(c: Ctx, w: number, h: number) {
  const cx = w / 2, base = h - 14, top = 52;
  // Rocky base.
  for (const [dx, r] of [[-26, 14], [24, 16], [-8, 12], [10, 13]] as const) dab(c, cx + dx, base + 4, r, 8, 0, hsl(30, 10, 44));
  dab(c, cx, base + 2, 34, 6, 0, hsl(30, 12, 56));
  // Tapering striped tower.
  const bw = 26, tw = 15;
  const xAt = (y: number, s: number) => cx + s * (tw + (bw - tw) * ((y - top) / (base - top)));
  c.save();
  c.beginPath(); c.moveTo(xAt(top, -1), top); c.lineTo(xAt(top, 1), top); c.lineTo(xAt(base, 1), base); c.lineTo(xAt(base, -1), base); c.closePath();
  c.clip();
  const bands = 5, bh = (base - top) / bands;
  for (let i = 0; i < bands; i++) { c.fillStyle = i % 2 ? hsl(4, 70, 52) : hsl(40, 30, 96); c.fillRect(0, top + i * bh, w, bh + 1); }
  // Round shading: light left, shadow right.
  const g = c.createLinearGradient(cx - bw, 0, cx + bw, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(40,20,30,0.3)');
  c.fillStyle = g; c.fillRect(0, top, w, base - top);
  c.restore();
  // Door + two windows.
  c.fillStyle = hsl(25, 40, 26); c.beginPath(); c.roundRect(cx - 6, base - 22, 12, 22, [6, 6, 0, 0]); c.fill();
  for (const y of [top + 40, top + 90]) { c.fillStyle = hsl(210, 40, 24); c.beginPath(); c.roundRect(cx - 3.5, y, 7, 10, 3.5); c.fill(); }
  // Gallery + lamp room + roof.
  c.fillStyle = hsl(220, 15, 22); c.fillRect(cx - tw - 7, top - 4, (tw + 7) * 2, 6);
  c.fillStyle = hsl(48, 95, 70); c.fillRect(cx - tw + 3, top - 26, (tw - 3) * 2, 22);
  dab(c, cx, top - 15, 8, 8, 0, hsl(52, 100, 90));
  c.strokeStyle = hsl(220, 15, 22); c.lineWidth = 2;
  for (const dx of [-6, 0, 6]) { c.beginPath(); c.moveTo(cx + dx, top - 26); c.lineTo(cx + dx, top - 4); c.stroke(); }
  c.fillStyle = hsl(4, 60, 40);
  c.beginPath(); c.moveTo(cx - tw - 2, top - 25); c.lineTo(cx, top - 46); c.lineTo(cx + tw + 2, top - 25); c.closePath(); c.fill();
  dab(c, cx, top - 47, 3, 3, 0, hsl(220, 15, 22));
}

function cairn(c: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  dab(c, w / 2, h - 4, w / 2 - 3, 4, 0, 'rgba(40,30,20,0.25)');
  let y = h - 9, r = w / 2 - 5;
  for (let i = 0; i < 4; i++) {
    const x = w / 2 + rr(rng, -2.5, 2.5);
    const hue = rr(rng, 25, 210), l = rr(rng, 52, 68);
    dab(c, x, y + 1.5, r, r * 0.52, rr(rng, -0.1, 0.1), hsl(hue, 8, l - 18));
    dab(c, x, y, r, r * 0.5, rr(rng, -0.1, 0.1), hsl(hue, 10, l));
    dab(c, x - r * 0.3, y - r * 0.2, r * 0.4, r * 0.15, 0, hsl(hue, 10, l + 16, 0.8));
    y -= r * 0.85; r *= 0.74;
  }
}

function sailboat(c: Ctx, w: number, h: number) {
  const cx = w / 2, wl = h - 12;
  dab(c, cx, wl + 5, w * 0.42, 3, 0, 'rgba(255,255,255,0.45)');
  c.fillStyle = hsl(18, 50, 40);
  c.beginPath(); c.moveTo(cx - 26, wl - 8); c.lineTo(cx + 28, wl - 8); c.quadraticCurveTo(cx + 18, wl + 4, cx - 18, wl + 3); c.closePath(); c.fill();
  c.fillStyle = hsl(18, 40, 58); c.fillRect(cx - 24, wl - 9, 50, 3);
  c.strokeStyle = hsl(25, 40, 28); c.lineWidth = 2; c.beginPath(); c.moveTo(cx, wl - 8); c.lineTo(cx, 4); c.stroke();
  c.fillStyle = hsl(40, 40, 97); c.beginPath(); c.moveTo(cx + 2, 6); c.quadraticCurveTo(cx + 26, wl - 30, cx + 24, wl - 12); c.lineTo(cx + 2, wl - 12); c.closePath(); c.fill();
  c.fillStyle = hsl(195, 60, 62); c.beginPath(); c.moveTo(cx - 2, 14); c.lineTo(cx - 2, wl - 12); c.lineTo(cx - 20, wl - 12); c.closePath(); c.fill();
  c.fillStyle = hsl(4, 75, 56); c.beginPath(); c.moveTo(cx, 4); c.lineTo(cx + 10, 7); c.lineTo(cx, 10); c.fill();
}

function gull(c: Ctx) {
  c.strokeStyle = hsl(210, 10, 96); c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(1, 6); c.quadraticCurveTo(5, 1, 9, 6); c.quadraticCurveTo(13, 1, 17, 6); c.stroke();
  c.strokeStyle = 'rgba(60,70,80,0.5)'; c.lineWidth = 0.8; c.stroke();
}

export function paintRegionArt(scene: Phaser.Scene) {
  for (let i = 0; i < 2; i++) canvasTex(scene, `sunflower${i}`, 34, 80 + i * 14, (c) => sunflower(c, 34, 80 + i * 14, 1200 + i), 2.5);
  canvasTex(scene, 'beehive', 50, 64, (c) => beehive(c, 50, 64), 2.5);
  canvasTex(scene, 'honeybee', 13, 10, (c) => bee(c), 3);
  canvasTex(scene, 'haybale', 70, 46, (c) => haybale(c, 70, 46), 2.5);
  canvasTex(scene, 'glowcap0', 64, 70, (c) => glowcap(c, 64, 70, 0, 1301), 2.5);
  canvasTex(scene, 'glowcap1', 70, 96, (c) => glowcap(c, 70, 96, 1, 1302), 2.5);
  canvasTex(scene, 'glowcap2', 60, 52, (c) => glowcap(c, 60, 52, 2, 1303), 2.5);
  canvasTex(scene, 'lighthouse', 96, 236, (c) => lighthouse(c, 96, 236), 2);
  for (let i = 0; i < 2; i++) canvasTex(scene, `cairn${i}`, 46, 58, (c) => cairn(c, 46, 58, 1400 + i), 2.5);
  canvasTex(scene, 'sailboat', 70, 78, (c) => sailboat(c, 70, 78), 2.5);
  canvasTex(scene, 'gull', 18, 8, (c) => gull(c), 3);
}
