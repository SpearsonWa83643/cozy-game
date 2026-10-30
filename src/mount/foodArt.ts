// 34: three more flying friends from Walker's figurines: a Tamale (ribbed corn-husk body with orange
// filling on top), the golden H-E-Buddy (a shiny gold grocery-bag buddy with a leafy topper, a tiny
// party hat, white gloves and a friendly label stripe; generic art, no real logo) and a Chef Concha
// (pink shell-pattern sweet bread in a white chef's hat). Same layout as funArt.ts: 124x84 body facing
// right (rider sits around (60, 22)), fluffy up wings, a Call Mount icon (i_*) and a treasure icon (ic_*).
import Phaser from 'phaser';
import { Ctx, canvasTex, dab } from '../art';
import { paintWing, face, outline, limb, sparkle } from './funArt';

const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a.toFixed(3)})`;
const INK = hsl(20, 45, 18);

function glove(c: Ctx, x: number, y: number, r: number, rot: number) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = '#ffffff';
  c.beginPath(); c.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2); c.fill(); outline(c, hsl(215, 20, 62), 1.3);
  // Thumb + finger bumps.
  c.beginPath(); c.ellipse(-r * 0.75, r * 0.2, r * 0.42, r * 0.3, 0.6, 0, Math.PI * 2); c.fill(); outline(c, hsl(215, 20, 62), 1.1);
  c.strokeStyle = hsl(215, 18, 70); c.lineWidth = 0.9;
  for (const k of [-0.3, 0.1, 0.5]) { c.beginPath(); c.moveTo(r * k, -r * 0.8); c.lineTo(r * k, -r * 0.2); c.stroke(); }
  c.restore();
}

function foot(c: Ctx, x: number, y: number, col: string, edge: string, rx = 8, ry = 4.6) {
  dab(c, x, y, rx, ry, 0, col); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); outline(c, edge, 1.4);
  dab(c, x - rx * 0.35, y - ry * 0.4, rx * 0.35, ry * 0.25, 0, 'rgba(255,255,255,0.45)');
}

// ------------------------------------------------------------------ Tamale
const TA_Y = hsl(44, 96, 58), TA_YD = hsl(36, 85, 36), TA_YL = hsl(48, 100, 74);

function tamaleShape(c: Ctx, cx: number, top: number, bot: number, wid: number) {
  const r = wid * 0.35;
  c.beginPath();
  c.moveTo(cx - wid, top + r);
  c.quadraticCurveTo(cx - wid, top, cx - wid + r, top);
  c.lineTo(cx + wid - r, top);
  c.quadraticCurveTo(cx + wid, top, cx + wid, top + r);
  c.bezierCurveTo(cx + wid + 1, top + (bot - top) * 0.6, cx + wid * 0.92, bot - 2, cx + wid * 0.6, bot);
  c.lineTo(cx - wid * 0.6, bot);
  c.bezierCurveTo(cx - wid * 0.92, bot - 2, cx - wid - 1, top + (bot - top) * 0.6, cx - wid, top + r);
  c.closePath();
}

function tamale(c: Ctx, cx: number, top: number, bot: number, wid: number, withFace: boolean) {
  // Orange masa filling peeking out of the top, a fluffy bumpy mound.
  const fy = top + 2;
  const fg = c.createLinearGradient(0, fy - 12, 0, fy + 6);
  fg.addColorStop(0, hsl(26, 100, 64)); fg.addColorStop(1, hsl(16, 90, 48));
  c.fillStyle = fg;
  c.beginPath(); c.moveTo(cx - wid * 0.92, fy + 4);
  const bumps = 5;
  for (let i = 0; i < bumps; i++) {
    const x0 = cx - wid * 0.92 + (i * wid * 1.84) / bumps, x1 = x0 + (wid * 1.84) / bumps;
    const h = 9 + Math.sin(i * 1.7) * 2.5 + (i === 2 ? 3 : 0);
    c.quadraticCurveTo((x0 + x1) / 2, fy - h - 4, x1, fy + 1 - (i % 2));
  }
  c.lineTo(cx + wid * 0.92, fy + 6); c.lineTo(cx - wid * 0.92, fy + 6); c.closePath(); c.fill(); outline(c, hsl(14, 80, 34), 1.6);
  for (const [dx, dy] of [[-0.5, -6], [0.05, -9], [0.5, -6]]) dab(c, cx + dx * wid, fy + dy, 4, 1.8, -0.3, 'rgba(255,230,190,0.55)');
  // Corn-husk body with a soft round shading.
  const g = c.createLinearGradient(cx - wid, 0, cx + wid, 0);
  g.addColorStop(0, hsl(40, 90, 46)); g.addColorStop(0.3, TA_YL); g.addColorStop(0.55, TA_Y); g.addColorStop(1, hsl(38, 88, 42));
  tamaleShape(c, cx, top, bot, wid); c.fillStyle = g; c.fill();
  // Ribs: vertical grooves that follow the round body.
  c.save(); tamaleShape(c, cx, top, bot, wid); c.clip();
  const n = 9;
  for (let i = 1; i < n; i++) {
    const u = i / n * 2 - 1, x = cx + u * wid, bend = u * 3;
    c.strokeStyle = hsl(38, 80, 42, 0.7); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, top + 1); c.quadraticCurveTo(x + bend, (top + bot) / 2, x - u * 4, bot + 1); c.stroke();
    c.strokeStyle = hsl(50, 100, 82, 0.55); c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(x + 2.2, top + 1); c.quadraticCurveTo(x + 2.2 + bend, (top + bot) / 2, x + 2.2 - u * 4, bot + 1); c.stroke();
  }
  // Husk lip folding over the filling.
  c.fillStyle = hsl(46, 100, 70, 0.9); c.fillRect(cx - wid, top, wid * 2, 3);
  c.restore();
  tamaleShape(c, cx, top, bot, wid); outline(c, TA_YD, 1.8);
  dab(c, cx - wid * 0.55, top + (bot - top) * 0.35, 2.4, 9, 0.05, 'rgba(255,255,255,0.35)');
  if (withFace) face(c, cx + wid * 0.12, top + (bot - top) * 0.42, wid * 0.62, wid * 0.11, hsl(8, 90, 68, 0.85));
}

function paintTamaleBody(c: Ctx, w: number, h: number) {
  const cx = 62;
  for (const lx of [52, 70]) { limb(c, lx, 64, lx + 1, 73, 8, TA_Y, TA_YD); foot(c, lx + 4, 76, TA_Y, TA_YD); }
  limb(c, cx - 24, 44, cx - 36, 52, 7, TA_Y, TA_YD); dab(c, cx - 37, 53, 4.5, 4.5, 0, TA_Y);
  limb(c, cx + 24, 44, cx + 36, 52, 7, TA_Y, TA_YD); dab(c, cx + 37, 53, 4.5, 4.5, 0, TA_Y);
  tamale(c, cx, 20, 68, 25, true);
  for (const [x, y, r] of [[14, 24, 1.8], [110, 22, 1.6], [104, 70, 1.4]] as [number, number, number][]) sparkle(c, x, y, r, hsl(48, 100, 80));
}

/** Treasure: a curly golden corn husk. */
function huskTreasure(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 2;
  const halo = c.createRadialGradient(cx, cy, 2, cx, cy, 22); halo.addColorStop(0, 'rgba(255,225,120,0.5)'); halo.addColorStop(1, 'rgba(255,225,120,0)');
  c.fillStyle = halo; c.fillRect(0, 0, w, w);
  c.save(); c.translate(cx, cy); c.rotate(-0.5);
  c.beginPath(); c.moveTo(0, -18); c.bezierCurveTo(11, -10, 11, 10, 2, 18); c.quadraticCurveTo(0, 19, -2, 18); c.bezierCurveTo(-11, 10, -11, -10, 0, -18); c.closePath();
  const g = c.createLinearGradient(-10, 0, 10, 0); g.addColorStop(0, hsl(42, 85, 50)); g.addColorStop(0.5, hsl(50, 100, 76)); g.addColorStop(1, hsl(40, 85, 48));
  c.fillStyle = g; c.fill(); outline(c, TA_YD, 1.6);
  c.strokeStyle = hsl(38, 80, 42, 0.8); c.lineWidth = 1;
  for (const k of [-4, 0, 4]) { c.beginPath(); c.moveTo(k * 0.4, -14); c.quadraticCurveTo(k, 0, k * 0.4, 15); c.stroke(); }
  c.restore();
  sparkle(c, w - 9, 11, 2.4); sparkle(c, 9, w - 11, 1.8);
}

// ------------------------------------------------------------------ H-E-Buddy (generic golden bag buddy)
const GOLD_D = hsl(36, 80, 30);

function bagShape(c: Ctx, cx: number, top: number, bot: number, wid: number) {
  // Slightly wider at the bottom, crinkly folded top edge.
  c.beginPath();
  c.moveTo(cx - wid, top + 3);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x0 = cx - wid + (i * wid * 2) / n, x1 = x0 + (wid * 2) / n;
    c.lineTo((x0 + x1) / 2, top - (i % 2 ? 1 : 3)); c.lineTo(x1, top + 3);
  }
  c.lineTo(cx + wid + 2, bot - 4); c.quadraticCurveTo(cx + wid + 2, bot, cx + wid - 2, bot);
  c.lineTo(cx - wid + 2, bot); c.quadraticCurveTo(cx - wid - 2, bot, cx - wid - 2, bot - 4);
  c.closePath();
}

function goldFill(c: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, hsl(44, 95, 62)); g.addColorStop(0.22, hsl(50, 100, 84)); g.addColorStop(0.42, hsl(42, 92, 52));
  g.addColorStop(0.68, hsl(46, 98, 70)); g.addColorStop(1, hsl(36, 85, 38));
  return g;
}

function partyHat(c: Ctx, x: number, y: number, s: number, rot: number) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const cols = [hsl(355, 85, 56), hsl(48, 100, 60), hsl(205, 85, 55), hsl(130, 60, 48)];
  // Tiny round striped cap.
  c.beginPath(); c.ellipse(0, 0, 10, 7, 0, Math.PI, 0); c.closePath(); c.save(); c.clip();
  cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(-10 + i * 5, -8, 5, 9); });
  c.restore();
  c.beginPath(); c.ellipse(0, 0, 10, 7, 0, Math.PI, 0); c.closePath(); outline(c, INK, 1.2);
  dab(c, 0, 0.5, 12, 2.4, 0, hsl(205, 85, 50)); c.beginPath(); c.ellipse(0, 0.5, 12, 2.4, 0, 0, Math.PI * 2); outline(c, INK, 1);
  dab(c, 0, -7.5, 2.4, 2.4, 0, hsl(355, 90, 62));
  c.restore();
}

function buddy(c: Ctx, cx: number, top: number, bot: number, wid: number, withFace: boolean) {
  // Leafy green topper peeking out of the bag (behind the front edge).
  const leaf = (x: number, y: number, rot: number, len: number) => {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = hsl(118, 60, 40); c.beginPath(); c.ellipse(0, -len / 2, len * 0.26, len / 2, 0, 0, Math.PI * 2); c.fill(); outline(c, hsl(120, 60, 20), 1.2);
    c.strokeStyle = hsl(110, 60, 60); c.lineWidth = 0.9; c.beginPath(); c.moveTo(0, -1); c.lineTo(0, -len + 2); c.stroke();
    c.restore();
  };
  leaf(cx - 4, top + 2, -0.7, 15); leaf(cx + 2, top + 2, -0.1, 17); leaf(cx + 8, top + 2, 0.6, 14); leaf(cx - 10, top + 3, -1.1, 11);
  // Shiny gold bag.
  bagShape(c, cx, top, bot, wid); c.fillStyle = goldFill(c, cx - wid, top, cx + wid, bot); c.fill(); outline(c, GOLD_D, 1.8);
  c.save(); bagShape(c, cx, top, bot, wid); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(cx - wid + 4, top); c.lineTo(cx - wid + 10, top); c.lineTo(cx - wid + 6, bot); c.lineTo(cx - wid, bot); c.closePath(); c.fill();
  c.strokeStyle = hsl(40, 80, 40, 0.5); c.lineWidth = 1; c.beginPath(); c.moveTo(cx - wid, top + 7); c.lineTo(cx + wid, top + 7); c.stroke();
  // Friendly label stripe: white panel, blue band with a little star, red ribbon (generic, no logo or words).
  const lx = cx - wid * 0.78, lw = wid * 1.56, ly = top + (bot - top) * 0.62, lh = (bot - top) * 0.3;
  c.fillStyle = '#ffffff'; c.fillRect(lx, ly, lw, lh); c.strokeStyle = hsl(215, 30, 55); c.lineWidth = 1; c.strokeRect(lx, ly, lw, lh);
  c.fillStyle = hsl(215, 80, 42); c.fillRect(lx, ly, lw, lh * 0.36);
  sparkle(c, lx + lw * 0.82, ly + lh * 0.18, lh * 0.08, '#ffffff');
  c.fillStyle = hsl(355, 80, 52); c.fillRect(lx, ly + lh * 0.82, lw, lh * 0.18);
  c.fillStyle = hsl(215, 60, 35); c.fillRect(lx + lw * 0.14, ly + lh * 0.5, lw * 0.6, lh * 0.12);
  c.fillStyle = hsl(215, 25, 70); c.fillRect(lx + lw * 0.2, ly + lh * 0.68, lw * 0.48, lh * 0.06);
  c.restore();
  if (withFace) {
    // Big googly eyes with blue irises and a wide open happy mouth.
    const ey = top + (bot - top) * 0.24, ex = cx + wid * 0.08, gap = wid * 0.62, r = wid * 0.27;
    for (const x of [ex - gap / 2, ex + gap / 2]) {
      dab(c, x, ey, r * 0.9, r, 0, '#ffffff'); c.beginPath(); c.ellipse(x, ey, r * 0.9, r, 0, 0, Math.PI * 2); outline(c, INK, 1.2);
      dab(c, x + r * 0.15, ey + r * 0.15, r * 0.52, r * 0.6, 0, hsl(208, 85, 52));
      dab(c, x + r * 0.18, ey + r * 0.2, r * 0.26, r * 0.3, 0, INK);
      dab(c, x - r * 0.05, ey - r * 0.08, r * 0.17, r * 0.17, 0, '#fff');
      c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); c.arc(x, ey - r * 0.3, r * 1.05, -2.3, -0.85); c.stroke();
    }
    const my = top + (bot - top) * 0.44, mw = wid * 0.5;
    c.beginPath(); c.moveTo(ex - mw, my); c.quadraticCurveTo(ex, my + 2, ex + mw, my); c.quadraticCurveTo(ex + mw * 0.8, my + mw * 0.95, ex, my + mw * 0.95); c.quadraticCurveTo(ex - mw * 0.8, my + mw * 0.95, ex - mw, my); c.closePath();
    c.fillStyle = hsl(352, 60, 32); c.fill(); outline(c, INK, 1.3);
    c.save(); c.clip(); dab(c, ex + 1, my + mw * 0.9, mw * 0.6, mw * 0.42, 0, hsl(352, 85, 70)); c.restore();
    dab(c, ex - gap / 2 - r * 0.9, my - 1, r * 0.45, r * 0.32, 0, hsl(14, 90, 62, 0.45));
    dab(c, ex + gap / 2 + r * 0.9, my - 1, r * 0.45, r * 0.32, 0, hsl(14, 90, 62, 0.45));
  }
}

function paintBuddyBody(c: Ctx, w: number, h: number) {
  const cx = 62, top = 20, bot = 72, wid = 21;
  const halo = c.createRadialGradient(cx, 46, 4, cx, 46, 56); halo.addColorStop(0, 'rgba(255,220,110,0.35)'); halo.addColorStop(1, 'rgba(255,220,110,0)');
  c.fillStyle = halo; c.fillRect(0, 0, w, h);
  const ARM = hsl(44, 92, 56);
  for (const lx of [54, 70]) { limb(c, lx, bot - 2, lx + 1, 76, 6, ARM, GOLD_D); foot(c, lx + 3, 78, ARM, GOLD_D, 6.5, 3.8); }
  // Back arm resting low, front arm waving up high with a white glove.
  limb(c, cx - wid, 46, cx - wid - 12, 56, 4.5, ARM, GOLD_D); glove(c, cx - wid - 14, 58, 5.5, 0.4);
  limb(c, cx + wid, 42, cx + wid + 12, 28, 4.5, ARM, GOLD_D); glove(c, cx + wid + 13, 24, 6, -0.3);
  buddy(c, cx, top, bot, wid, true);
  partyHat(c, cx + 13, top + 1, 0.85, 0.35);
  for (const [x, y, r] of [[14, 22, 2.2], [112, 46, 1.8], [100, 74, 1.6], [24, 66, 1.4]] as [number, number, number][]) sparkle(c, x, y, r, hsl(50, 100, 78));
}

/** Treasure: a tiny shiny golden bag. */
function bagTreasure(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 3;
  const halo = c.createRadialGradient(cx, cy, 2, cx, cy, 22); halo.addColorStop(0, 'rgba(255,220,110,0.55)'); halo.addColorStop(1, 'rgba(255,220,110,0)');
  c.fillStyle = halo; c.fillRect(0, 0, w, w);
  bagShape(c, cx, cy - 13, cy + 14, 11); c.fillStyle = goldFill(c, cx - 11, cy - 13, cx + 11, cy + 14); c.fill(); outline(c, GOLD_D, 1.5);
  c.fillStyle = '#fff'; c.fillRect(cx - 8, cy + 2, 16, 8); c.fillStyle = hsl(215, 80, 42); c.fillRect(cx - 8, cy + 2, 16, 3); c.fillStyle = hsl(355, 80, 52); c.fillRect(cx - 8, cy + 8.5, 16, 1.5);
  dab(c, cx - 6, cy - 6, 1.6, 6, 0.1, 'rgba(255,255,255,0.6)');
  sparkle(c, w - 9, 11, 2.4); sparkle(c, 9, w - 11, 1.8);
}

// ------------------------------------------------------------------ Chef Concha
const PINK_D = hsl(340, 55, 42), FEET = hsl(46, 95, 62), FEET_D = hsl(38, 80, 36);

function chefHat(c: Ctx, x: number, y: number, s: number, rot: number) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const edge = hsl(215, 25, 72);
  // Puffy top: overlapping clouds.
  c.fillStyle = '#ffffff';
  for (const [px, py, r] of [[-11, -14, 9], [0, -18, 11], [11, -14, 9], [-5, -10, 9], [6, -10, 9]] as [number, number, number][]) { c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.arc(-11, -14, 9, Math.PI * 0.6, Math.PI * 1.6); outline(c, edge, 1.3);
  c.beginPath(); c.arc(0, -18, 11, Math.PI * 1.1, Math.PI * 1.9); outline(c, edge, 1.3);
  c.beginPath(); c.arc(11, -14, 9, Math.PI * 1.4, Math.PI * 0.4); outline(c, edge, 1.3);
  dab(c, -4, -21, 4, 2.4, -0.4, hsl(210, 60, 96));
  // Band.
  c.fillStyle = '#fbfdff'; c.beginPath(); c.moveTo(-15, -6); c.lineTo(15, -6); c.lineTo(14, 3); c.quadraticCurveTo(0, 5, -14, 3); c.closePath(); c.fill(); outline(c, edge, 1.3);
  c.strokeStyle = hsl(215, 20, 85); c.lineWidth = 1; for (const k of [-8, 0, 8]) { c.beginPath(); c.moveTo(k, -5); c.lineTo(k, 3); c.stroke(); }
  c.restore();
}

function concha(c: Ctx, cx: number, cy: number, r: number, withFace: boolean) {
  // Golden bread base under the sugar shell.
  dab(c, cx, cy + r * 0.62, r * 0.92, r * 0.36, 0, hsl(36, 80, 66)); c.beginPath(); c.ellipse(cx, cy + r * 0.62, r * 0.92, r * 0.36, 0, 0, Math.PI * 2); outline(c, hsl(30, 60, 40), 1.4);
  // Pink sugar shell.
  const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  g.addColorStop(0, hsl(345, 95, 88)); g.addColorStop(0.6, hsl(342, 82, 74)); g.addColorStop(1, hsl(338, 68, 60));
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
  // Shell pattern: grooves fanning from below, like a scallop shell.
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
  const ox = cx, oy = cy + r * 1.15;
  c.lineCap = 'round';
  for (let k = 1; k <= 4; k++) {
    const rr = r * 0.48 * k;
    c.strokeStyle = hsl(338, 60, 56, 0.85); c.lineWidth = Math.max(1.2, r * 0.07);
    c.beginPath(); c.arc(ox, oy, rr, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.strokeStyle = hsl(345, 100, 92, 0.7); c.lineWidth = Math.max(0.6, r * 0.03);
    c.beginPath(); c.arc(ox, oy - r * 0.05, rr, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  }
  for (let i = -3; i <= 3; i++) {
    const a = -Math.PI / 2 + i * 0.32;
    c.strokeStyle = hsl(338, 60, 56, 0.8); c.lineWidth = Math.max(1.1, r * 0.06);
    c.beginPath(); c.moveTo(ox + Math.cos(a) * r * 0.5, oy + Math.sin(a) * r * 0.5); c.lineTo(ox + Math.cos(a) * r * 2.4, oy + Math.sin(a) * r * 2.4); c.stroke();
  }
  // Sugar sparkle specks.
  for (const [sx, sy] of [[-0.5, -0.3], [0.2, -0.6], [0.55, -0.1], [-0.2, 0.1], [0.3, 0.35], [-0.6, 0.3]]) dab(c, cx + sx * r, cy + sy * r, r * 0.03, r * 0.03, 0, 'rgba(255,255,255,0.9)');
  c.restore();
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); outline(c, PINK_D, 1.8);
  if (withFace) face(c, cx + r * 0.2, cy + r * 0.12, r * 0.5, r * 0.1, hsl(18, 95, 64, 0.9));
}

function paintConchaBody(c: Ctx, w: number, h: number) {
  const cx = 62, cy = 48, r = 28;
  for (const lx of [52, 72]) { limb(c, lx, cy + 22, lx + 1, 73, 8, FEET, FEET_D); foot(c, lx + 4, 76, FEET, FEET_D); }
  limb(c, cx - 26, cy + 4, cx - 38, cy + 12, 7, FEET, FEET_D); dab(c, cx - 39, cy + 13, 4.5, 4.5, 0, FEET);
  limb(c, cx + 26, cy + 4, cx + 38, cy + 10, 7, FEET, FEET_D); dab(c, cx + 39, cy + 11, 4.5, 4.5, 0, FEET);
  concha(c, cx, cy, r, true);
  // Chef's hat sits jauntily on the front of the head (the rider sits behind it).
  chefHat(c, cx + 14, cy - r + 4, 0.82, 0.22);
  for (const [x, y, r2] of [[14, 24, 1.8], [110, 30, 1.6], [104, 72, 1.4]] as [number, number, number][]) sparkle(c, x, y, r2, hsl(340, 100, 92));
}

/** Treasure: a tiny white chef's hat. */
function chefHatTreasure(c: Ctx, w: number) {
  const halo = c.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, 22); halo.addColorStop(0, 'rgba(255,170,200,0.45)'); halo.addColorStop(1, 'rgba(255,170,200,0)');
  c.fillStyle = halo; c.fillRect(0, 0, w, w);
  chefHat(c, w / 2, w / 2 + 12, 0.95, -0.08);
  sparkle(c, w - 9, 11, 2.4); sparkle(c, 9, w - 13, 1.8);
}

/** Call Mount icon: the whole body painted small and centred (no wings). */
const iconOf = (body: (c: Ctx, w: number, h: number) => void, k = 0.56, dy = 0) => (c: Ctx, w: number) => {
  c.save(); c.translate(w / 2 - 62 * k, w / 2 - 46 * k + dy); c.scale(k, k); body(c, 124, 84); c.restore();
};

export const FOOD_PAINTERS = {
  tamale: [paintTamaleBody, iconOf(paintTamaleBody), huskTreasure],
  buddy: [paintBuddyBody, iconOf(paintBuddyBody, 0.54, -1), bagTreasure],
  concha: [paintConchaBody, iconOf(paintConchaBody), chefHatTreasure],
} as const;
const WINGS: Record<string, [number, number, number, string]> = {
  tamale: [46, 90, 72, hsl(38, 75, 38)],
  buddy: [46, 98, 64, GOLD_D],
  concha: [340, 85, 88, hsl(340, 50, 56)],
};
const ENTS: Record<string, { key: string; wing: string; icon: string; treasure: string }> = {
  tamale: { key: 'tamale_body', wing: 'tamale_wing', icon: 'i_tamale', treasure: 'ic_corn_husk' },
  buddy: { key: 'buddy_body', wing: 'buddy_wing', icon: 'i_buddy', treasure: 'ic_golden_bag' },
  concha: { key: 'concha_body', wing: 'concha_wing', icon: 'i_concha', treasure: 'ic_chef_hat' },
};

export function paintFoodMounts(scene: Phaser.Scene) {
  for (const id of Object.keys(ENTS)) {
    const e = ENTS[id], [body, icon, treasure] = FOOD_PAINTERS[id as keyof typeof FOOD_PAINTERS];
    const [h, s, l, edge] = WINGS[id];
    canvasTex(scene, e.key, 124, 84, (c) => body(c, 124, 84));
    canvasTex(scene, e.wing, 48, 96, (c) => paintWing(c, 48, 96, false, h, s, l, edge));
    canvasTex(scene, `${e.wing}_far`, 48, 96, (c) => paintWing(c, 48, 96, true, h, s, l, edge));
    canvasTex(scene, e.icon, 48, 48, (c) => icon(c, 48), 2);
    canvasTex(scene, e.treasure, 48, 48, (c) => treasure(c, 48), 2);
  }
}
