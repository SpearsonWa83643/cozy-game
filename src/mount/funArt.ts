// Six more hand-painted flying friends (12.3): the Cowboy Cookie and the Chili in a Poncho (drawn from
// Walker's figurines), a Magic Carpet, a Rubber Duck, a Sky Jellyfish and a Strawberry. Each has a
// 124x84 body facing right (the rider sits on top, around (60, 22)), little wings pointing up, a Call
// Mount icon (i_*) and a treasure icon (ic_*). Bold outlines, flat bright colours, happy faces.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab } from '../art';

const INK = hsl(20, 45, 18);

/** Shared happy face: two dot eyes with a shine, rosy cheeks, a small smile. (x,y) is the centre between the eyes. */
function face(c: Ctx, x: number, y: number, gap: number, r: number, cheek: string) {
  for (const ex of [x - gap / 2, x + gap / 2]) {
    dab(c, ex, y, r, r * 1.15, 0, INK);
    dab(c, ex - r * 0.3, y - r * 0.4, r * 0.38, r * 0.38, 0, '#fff');
  }
  dab(c, x - gap / 2 - r * 1.6, y + r * 1.9, r * 1.2, r * 0.9, 0, cheek);
  dab(c, x + gap / 2 + r * 1.6, y + r * 1.9, r * 1.2, r * 0.9, 0, cheek);
  c.strokeStyle = INK; c.lineWidth = 1.6; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y + r * 1.6, r * 1.6, 0.25, Math.PI - 0.25); c.stroke();
}

function outline(c: Ctx, col: string, w = 1.6) { c.strokeStyle = col; c.lineWidth = w; c.stroke(); }

/** Generic fluffy up-pointing wing: 5 rounded feathers fanned over a soft base. */
function paintWing(c: Ctx, w: number, h: number, far: boolean, hue: number, sat: number, light: number, edge: string) {
  const sx = w / 2, sy = h - 4;
  const l = far ? light - 10 : light;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 - 0.4 + i * 0.2;
    c.save(); c.translate(sx, sy - 22); c.rotate(a);
    dab(c, 23 + i * 1.5, 0, 23 + i * 1.5, 5.6, 0, hsl(hue, sat, l - i * 1.5));
    c.beginPath(); c.ellipse(23 + i * 1.5, 0, 23 + i * 1.5, 5.6, 0, 0, Math.PI * 2); outline(c, edge, 1);
    c.restore();
  }
  c.fillStyle = hsl(hue, sat, l + 2);
  c.beginPath(); c.ellipse(sx, sy - 18, 12, 20, 0, 0, Math.PI * 2); c.fill(); outline(c, edge, 1.2);
}

function sparkle(c: Ctx, x: number, y: number, r: number, col = hsl(48, 100, 66)) {
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x, y - r * 2); c.lineTo(x + r * 0.5, y - r * 0.5); c.lineTo(x + r * 2, y); c.lineTo(x + r * 0.5, y + r * 0.5); c.lineTo(x, y + r * 2); c.lineTo(x - r * 0.5, y + r * 0.5); c.lineTo(x - r * 2, y); c.lineTo(x - r * 0.5, y - r * 0.5); c.closePath(); c.fill();
}

// ------------------------------------------------------------------ Cowboy Cookie
const COOKIE_DARK = hsl(24, 70, 32);

function cookieBody(c: Ctx, cx: number, cy: number, r: number, face_: boolean) {
  // Cookie ball.
  const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, hsl(36, 95, 62)); g.addColorStop(0.7, hsl(32, 90, 52)); g.addColorStop(1, hsl(26, 80, 40));
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); outline(c, hsl(24, 70, 28), 1.8);
  // Chocolate chip spots.
  const spots: [number, number, number][] = [[-0.6, -0.1, 0.14], [-0.2, -0.62, 0.12], [0.55, -0.4, 0.13], [0.7, 0.2, 0.12], [-0.5, 0.5, 0.17], [0.05, 0.72, 0.13], [0.5, 0.62, 0.1], [-0.05, 0.35, 0.09]];
  for (const [sx, sy, sr] of spots) { dab(c, cx + sx * r, cy + sy * r, sr * r, sr * r * 0.9, 0.3, hsl(26, 62, 38)); dab(c, cx + sx * r - 1, cy + sy * r - 1, sr * r * 0.4, sr * r * 0.3, 0.3, hsl(28, 55, 50)); }
  if (face_) face(c, cx + r * 0.22, cy - r * 0.05, r * 0.5, r * 0.1, hsl(8, 85, 70, 0.8));
}

function cowboyHat(c: Ctx, x: number, y: number, s: number, rot: number) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const felt = hsl(210, 6, 36), feltDark = hsl(210, 6, 26), band = hsl(28, 70, 62);
  // Crown (pinched top).
  c.fillStyle = felt;
  c.beginPath(); c.moveTo(-15, 0); c.quadraticCurveTo(-17, -16, -9, -21); c.quadraticCurveTo(0, -17, 9, -21); c.quadraticCurveTo(17, -16, 15, 0); c.closePath(); c.fill(); outline(c, feltDark, 1.5);
  dab(c, 0, -17, 9, 1.6, 0, feltDark);
  // Brim: wide with turned-up sides.
  c.fillStyle = felt;
  c.beginPath(); c.moveTo(-34, -6); c.quadraticCurveTo(-30, 6, 0, 6); c.quadraticCurveTo(30, 6, 34, -6); c.quadraticCurveTo(26, 1, 0, 1); c.quadraticCurveTo(-26, 1, -34, -6); c.closePath(); c.fill(); outline(c, feltDark, 1.5);
  // Tan band.
  c.fillStyle = band; c.beginPath(); c.moveTo(-15.5, -3); c.quadraticCurveTo(0, 1.5, 15.5, -3); c.lineTo(15, -8); c.quadraticCurveTo(0, -4, -15, -8); c.closePath(); c.fill(); outline(c, hsl(28, 60, 42), 1);
  dab(c, -8, -12, 3, 1.2, -0.5, 'rgba(255,255,255,0.22)');
  c.restore();
}

function limb(c: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, col: string, edge: string) {
  c.strokeStyle = edge; c.lineWidth = w + 2.4; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
}

function paintCookieBody(c: Ctx, w: number, h: number) {
  const cx = 62, cy = 46;
  // Little legs dangling underneath, feet pointing forward.
  for (const lx of [50, 76]) {
    limb(c, lx, cy + 22, lx + 1, 72, 8, hsl(26, 62, 44), hsl(24, 60, 26));
    dab(c, lx + 4, 75, 8, 4.6, 0, hsl(26, 62, 40)); c.beginPath(); c.ellipse(lx + 4, 75, 8, 4.6, 0, 0, Math.PI * 2); outline(c, hsl(24, 60, 26), 1.4);
  }
  // Arms out to the sides.
  limb(c, cx - 28, cy + 4, cx - 40, cy + 14, 7, hsl(26, 62, 44), hsl(24, 60, 26));
  limb(c, cx + 28, cy + 4, cx + 40, cy + 12, 7, hsl(26, 62, 44), hsl(24, 60, 26));
  cookieBody(c, cx, cy, 31, true);
  // The cowboy hat sits jauntily on the front of the head (the rider sits behind it).
  cowboyHat(c, cx + 20, cy - 25, 0.9, 0.2);
}

function cookieIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 3;
  limb(c, cx - 6, cy + 11, cx - 6, cy + 18, 5, hsl(26, 62, 44), hsl(24, 60, 26));
  limb(c, cx + 8, cy + 11, cx + 8, cy + 18, 5, hsl(26, 62, 44), hsl(24, 60, 26));
  cookieBody(c, cx, cy, 15.5, true);
  cowboyHat(c, cx + 3, cy - 12, 0.5, 0.15);
}

/** Treasure: a little gray cowboy hat. */
function hatTreasure(c: Ctx, w: number) {
  cowboyHat(c, w / 2, w / 2 + 6, 0.62, -0.08);
  sparkle(c, w - 9, 11, 2.4); sparkle(c, 9, w - 13, 1.8);
}

// ------------------------------------------------------------------ Chili in a Poncho
const CH_G = hsl(128, 52, 42), CH_GD = hsl(130, 55, 24);

function chiliShape(c: Ctx, cx: number, top: number, bot: number, wid: number) {
  c.beginPath();
  c.moveTo(cx - wid, top + 14);
  c.bezierCurveTo(cx - wid, top - 4, cx + wid, top - 4, cx + wid, top + 14);
  c.bezierCurveTo(cx + wid, top + (bot - top) * 0.78, cx + 13, bot, cx, bot);
  c.bezierCurveTo(cx - 13, bot, cx - wid, top + (bot - top) * 0.78, cx - wid, top + 14);
  c.closePath();
}

function chili(c: Ctx, cx: number, top: number, bot: number, wid: number, withFace: boolean, k = 1) {
  // Body with a soft highlight.
  const g = c.createLinearGradient(cx - wid, 0, cx + wid, 0);
  g.addColorStop(0, hsl(128, 52, 34)); g.addColorStop(0.35, hsl(126, 55, 50)); g.addColorStop(1, hsl(130, 52, 32));
  chiliShape(c, cx, top, bot, wid); c.fillStyle = g; c.fill();
  // Poncho: striped band wrapped diagonally across the middle (red / orange / yellow stripes).
  c.save(); chiliShape(c, cx, top, bot, wid); c.clip();
  const py = top + (bot - top) * 0.52, ph = (bot - top) * 0.42;
  const stripe = (y: number, hh: number, col: string) => {
    c.fillStyle = col; c.beginPath();
    c.moveTo(cx - wid - 2, y + 4 * k); c.quadraticCurveTo(cx, y + 10 * k, cx + wid + 2, y - 4 * k);
    c.lineTo(cx + wid + 2, y - 4 * k + hh); c.quadraticCurveTo(cx, y + 10 * k + hh, cx - wid - 2, y + 4 * k + hh); c.closePath(); c.fill();
  };
  stripe(py, ph * 0.36, hsl(8, 78, 48));
  stripe(py + ph * 0.36, ph * 0.22, hsl(46, 95, 66));
  stripe(py + ph * 0.58, ph * 0.42, hsl(18, 82, 52));
  // Front flap over the shoulder going up-left (like the figurine's diagonal wrap).
  c.fillStyle = hsl(10, 80, 50); c.beginPath(); c.moveTo(cx - wid - 2, py + 2 * k); c.lineTo(cx + wid + 2, py - 13 * k); c.lineTo(cx + wid + 2, py - 4 * k); c.quadraticCurveTo(cx, py + 10 * k, cx - wid - 2, py + 4 * k); c.closePath(); c.fill();
  c.strokeStyle = hsl(46, 95, 66); c.lineWidth = 2.2 * k; c.beginPath(); c.moveTo(cx - wid, py + 0 * k); c.lineTo(cx + wid, py - 8 * k); c.stroke();
  c.restore();
  chiliShape(c, cx, top, bot, wid); outline(c, CH_GD, 1.8);
  // Snowy white cap with drips + curly stem.
  const capY = top + 1;
  c.fillStyle = '#fbfdff';
  c.beginPath(); c.moveTo(cx - wid + 1, capY + 15); c.bezierCurveTo(cx - wid - 1, capY - 4, cx + wid + 1, capY - 4, cx + wid - 1, capY + 15);
  c.quadraticCurveTo(cx + wid * 0.5, capY + 9, cx + wid * 0.2, capY + 14); c.quadraticCurveTo(cx - wid * 0.1, capY + 9, cx - wid * 0.4, capY + 14); c.quadraticCurveTo(cx - wid * 0.7, capY + 9, cx - wid + 1, capY + 15); c.closePath(); c.fill(); outline(c, hsl(205, 35, 66), 1.2);
  c.strokeStyle = CH_GD; c.lineWidth = 5 * k; c.beginPath(); c.moveTo(cx - 1, capY + 1); c.bezierCurveTo(cx - 1, capY - 10 * k, cx - 12 * k, capY - 10 * k, cx - 9 * k, capY - 1 * k); c.stroke();
  c.strokeStyle = CH_G; c.lineWidth = 3 * k; c.stroke();
  if (withFace) face(c, cx + wid * 0.08, top + (bot - top) * 0.26, wid * 0.62, wid * 0.11, hsl(24, 95, 66, 0.9));
}

function paintChiliBody(c: Ctx, w: number, h: number) {
  const cx = 62;
  for (const lx of [53, 71]) {
    limb(c, lx, 62, lx + 1, 73, 8, CH_G, CH_GD);
    dab(c, lx + 4, 76, 8, 4.6, 0, CH_G); c.beginPath(); c.ellipse(lx + 4, 76, 8, 4.6, 0, 0, Math.PI * 2); outline(c, CH_GD, 1.4);
  }
  limb(c, cx - 22, 38, cx - 38, 30, 7, CH_G, CH_GD);
  limb(c, cx + 22, 38, cx + 38, 31, 7, CH_G, CH_GD);
  chili(c, cx, 14, 68, 24, true);
}

function chiliIcon(c: Ctx, w: number) {
  const cx = w / 2;
  for (const lx of [cx - 5, cx + 5]) limb(c, lx, 34, lx, 41, 5, CH_G, CH_GD);
  chili(c, cx, 6, 38, 14, true, 0.6);
}

/** Treasure: a tiny striped poncho. */
function ponchoTreasure(c: Ctx, w: number) {
  const cx = w / 2, top = 10, bot = 38;
  c.beginPath(); c.moveTo(cx, top); c.lineTo(cx + 17, bot - 3); c.quadraticCurveTo(cx, bot + 2, cx - 17, bot - 3); c.closePath();
  c.save(); c.clip();
  c.fillStyle = hsl(8, 78, 48); c.fillRect(0, 0, w, 20);
  c.fillStyle = hsl(46, 95, 66); c.fillRect(0, 20, w, 6);
  c.fillStyle = hsl(18, 82, 52); c.fillRect(0, 26, w, 6);
  c.fillStyle = hsl(46, 95, 66); c.fillRect(0, 32, w, 3);
  c.restore();
  c.beginPath(); c.moveTo(cx, top); c.lineTo(cx + 17, bot - 3); c.quadraticCurveTo(cx, bot + 2, cx - 17, bot - 3); c.closePath(); outline(c, hsl(8, 60, 28), 1.4);
  dab(c, cx, top + 1, 5, 2.4, 0, hsl(8, 60, 30)); dab(c, cx, top + 1, 3, 1.2, 0, hsl(20, 60, 12));
  sparkle(c, w - 9, 11, 2.4); sparkle(c, 9, 14, 1.8);
}

// ------------------------------------------------------------------ Magic Carpet
function paintCarpetBody(c: Ctx, w: number, h: number) {
  const y0 = 54;
  // Soft glow under it.
  const glow = c.createRadialGradient(62, 70, 4, 62, 70, 52);
  glow.addColorStop(0, 'rgba(180,120,255,0.35)'); glow.addColorStop(1, 'rgba(180,120,255,0)');
  c.fillStyle = glow; c.fillRect(0, 30, w, 54);
  // Carpet: a wavy rectangle in perspective (a parallelogram with curved ends).
  c.beginPath();
  c.moveTo(10, y0 + 8); c.quadraticCurveTo(8, y0 - 6, 22, y0 - 10);
  c.quadraticCurveTo(62, y0 - 22, 104, y0 - 10); c.quadraticCurveTo(118, y0 - 6, 114, y0 + 8);
  c.quadraticCurveTo(110, y0 + 24, 98, y0 + 22); c.quadraticCurveTo(62, y0 + 32, 26, y0 + 22); c.quadraticCurveTo(12, y0 + 22, 10, y0 + 8); c.closePath();
  const g = c.createLinearGradient(0, y0 - 20, 0, y0 + 30);
  g.addColorStop(0, hsl(285, 62, 52)); g.addColorStop(1, hsl(270, 58, 36));
  c.fillStyle = g; c.fill(); outline(c, hsl(270, 50, 20), 1.8);
  // Gold border and diamond pattern.
  c.save(); c.translate(0, 0);
  c.strokeStyle = hsl(46, 95, 62); c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(16, y0 + 8); c.quadraticCurveTo(15, y0 - 2, 25, y0 - 5); c.quadraticCurveTo(62, y0 - 16, 100, y0 - 5); c.quadraticCurveTo(110, y0 - 2, 108, y0 + 8); c.quadraticCurveTo(105, y0 + 18, 96, y0 + 17); c.quadraticCurveTo(62, y0 + 26, 28, y0 + 17); c.quadraticCurveTo(17, y0 + 17, 16, y0 + 8); c.stroke();
  c.restore();
  for (let i = 0; i < 4; i++) {
    const dx = 34 + i * 18, dy = y0 + 4 + Math.sin(i * 1.3) * 1.5;
    c.fillStyle = hsl(46, 95, 66); c.beginPath(); c.moveTo(dx, dy - 6); c.lineTo(dx + 6, dy); c.lineTo(dx, dy + 6); c.lineTo(dx - 6, dy); c.closePath(); c.fill();
    dab(c, dx, dy, 2, 2, 0, hsl(345, 80, 62));
  }
  // Tassels (front corners) and fringe.
  for (const [tx, ty] of [[12, y0 + 12], [112, y0 + 12], [100, y0 + 24], [26, y0 + 24]] as [number, number][]) {
    c.strokeStyle = hsl(46, 95, 60); c.lineWidth = 1.8;
    for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(tx + k * 2, ty); c.quadraticCurveTo(tx + k * 3, ty + 6, tx + k * 4, ty + 10); c.stroke(); }
  }
  // Sleepy-sweet face on the front edge.
  face(c, 86, y0 + 12, 12, 2.4, hsl(345, 80, 74, 0.8));
  for (const [x, y, r] of [[8, 30, 2], [112, 36, 1.8], [18, 68, 1.6]] as [number, number, number][]) sparkle(c, x, y, r, hsl(50, 100, 78));
}
function carpetIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 6;
  c.beginPath(); c.moveTo(cx - 20, cy + 4); c.quadraticCurveTo(cx - 22, cy - 8, cx - 8, cy - 10); c.quadraticCurveTo(cx + 4, cy - 14, cx + 18, cy - 8); c.quadraticCurveTo(cx + 24, cy - 2, cx + 20, cy + 6); c.quadraticCurveTo(cx + 4, cy + 14, cx - 14, cy + 11); c.quadraticCurveTo(cx - 20, cy + 10, cx - 20, cy + 4); c.closePath();
  c.fillStyle = hsl(280, 60, 48); c.fill(); outline(c, hsl(270, 50, 20), 1.4);
  c.strokeStyle = hsl(46, 95, 62); c.lineWidth = 1.8; c.beginPath(); c.moveTo(cx - 14, cy + 3); c.quadraticCurveTo(cx, cy - 7, cx + 15, cy - 1); c.stroke();
  for (const tx of [cx - 17, cx + 19]) { c.strokeStyle = hsl(46, 95, 60); c.lineWidth = 1.4; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(tx + k * 1.6, cy + 7); c.lineTo(tx + k * 2.6, cy + 13); c.stroke(); } }
  face(c, cx + 5, cy + 2, 8, 1.7, hsl(345, 80, 74, 0.8));
}
/** Treasure: a golden tassel. */
function tasselTreasure(c: Ctx, w: number) {
  const cx = w / 2;
  c.strokeStyle = hsl(345, 70, 50); c.lineWidth = 2.4; c.beginPath(); c.arc(cx, 11, 6, 0, Math.PI * 2); c.stroke();
  c.fillStyle = hsl(46, 95, 56); c.beginPath(); c.arc(cx, 21, 5.5, 0, Math.PI * 2); c.fill(); outline(c, hsl(36, 80, 34), 1.2);
  c.beginPath(); c.moveTo(cx - 8, 24); c.quadraticCurveTo(cx, 20, cx + 8, 24); c.lineTo(cx + 11, 42); c.quadraticCurveTo(cx, 46, cx - 11, 42); c.closePath(); c.fillStyle = hsl(46, 95, 62); c.fill(); outline(c, hsl(36, 80, 34), 1.2);
  c.strokeStyle = hsl(36, 80, 40); c.lineWidth = 1;
  for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(cx + k * 3, 27); c.lineTo(cx + k * 3.6, 43); c.stroke(); }
  sparkle(c, w - 9, 12, 2.4); sparkle(c, 9, 36, 1.8);
}

// ------------------------------------------------------------------ Rubber Duck
function duck(c: Ctx, cx: number, cy: number, s: number, f: boolean) {
  c.save(); c.translate(cx, cy); c.scale(s, s);
  const Y = hsl(50, 100, 60), YD = hsl(42, 90, 40);
  // Tail flick.
  c.fillStyle = Y; c.beginPath(); c.moveTo(-34, -2); c.quadraticCurveTo(-52, -16, -48, -4); c.quadraticCurveTo(-44, 6, -32, 8); c.closePath(); c.fill(); outline(c, YD, 1.6);
  // Round body.
  const g = c.createRadialGradient(-8, -12, 4, 0, 0, 44); g.addColorStop(0, hsl(54, 100, 72)); g.addColorStop(0.7, Y); g.addColorStop(1, hsl(44, 95, 50));
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 4, 40, 24, 0, 0, Math.PI * 2); c.fill(); outline(c, YD, 1.8);
  // Head.
  c.fillStyle = g; c.beginPath(); c.arc(22, -16, 17, 0, Math.PI * 2); c.fill(); outline(c, YD, 1.8);
  // Beak.
  c.fillStyle = hsl(26, 100, 58); c.beginPath(); c.ellipse(41, -11, 10, 5.6, 0.1, 0, Math.PI * 2); c.fill(); outline(c, hsl(20, 80, 36), 1.4);
  c.strokeStyle = hsl(20, 80, 36); c.lineWidth = 1.2; c.beginPath(); c.moveTo(33, -11); c.lineTo(49, -10.5); c.stroke();
  if (f) { dab(c, 27, -22, 2.5, 3, 0, INK); dab(c, 26, -23.5, 0.9, 0.9, 0, '#fff'); dab(c, 24, -12, 3.4, 2.4, 0, hsl(8, 85, 70, 0.8)); }
  // Little wing on the side.
  c.fillStyle = hsl(48, 100, 52); c.beginPath(); c.ellipse(-8, 8, 17, 10, -0.25, 0, Math.PI * 2); c.fill(); outline(c, YD, 1.4);
  dab(c, -22, -10, 5, 2.2, -0.5, 'rgba(255,255,255,0.5)');
  c.restore();
}
function paintDuckBody(c: Ctx, w: number, h: number) {
  // A little ripple under the duck.
  dab(c, 60, 76, 44, 4, 0, 'rgba(120,190,255,0.35)');
  duck(c, 56, 48, 0.95, true);
  // Bow tie: a classic bath-time touch.
  c.fillStyle = hsl(350, 80, 56); c.beginPath(); c.moveTo(80, 26); c.lineTo(88, 22); c.lineTo(88, 34); c.closePath(); c.fill(); c.beginPath(); c.moveTo(80, 28); c.lineTo(72, 24); c.lineTo(72, 36); c.closePath(); c.fill();
}
function duckIcon(c: Ctx, w: number) { duck(c, w / 2 - 2, w / 2 + 5, 0.42, true); }
/** Treasure: a squeaky mini duck with a sparkle. */
function duckTreasure(c: Ctx, w: number) { duck(c, w / 2 - 2, w / 2 + 6, 0.38, true); sparkle(c, w - 8, 10, 2.4, hsl(200, 100, 78)); }

// ------------------------------------------------------------------ Sky Jellyfish
function jelly(c: Ctx, cx: number, cy: number, rx: number, ry: number, tent: number, f: boolean) {
  // Tentacles first (wavy ribbons).
  for (let i = 0; i < 5; i++) {
    const tx = cx - rx * 0.7 + (i / 4) * rx * 1.4;
    c.strokeStyle = hsl(318, 70, i % 2 ? 78 : 70); c.lineWidth = Math.max(2, rx * 0.09); c.lineCap = 'round';
    c.beginPath(); c.moveTo(tx, cy + ry * 0.4);
    c.bezierCurveTo(tx - 8, cy + ry * 0.4 + tent * 0.35, tx + 8, cy + ry * 0.4 + tent * 0.7, tx - 2, cy + ry * 0.4 + tent); c.stroke();
  }
  // Dome.
  const g = c.createLinearGradient(0, cy - ry, 0, cy + ry * 0.5);
  g.addColorStop(0, hsl(322, 85, 80)); g.addColorStop(1, hsl(300, 70, 66));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(cx - rx, cy + ry * 0.4); c.bezierCurveTo(cx - rx, cy - ry * 1.5, cx + rx, cy - ry * 1.5, cx + rx, cy + ry * 0.4);
  c.quadraticCurveTo(cx + rx * 0.5, cy + ry * 0.2, cx + rx * 0.3, cy + ry * 0.55); c.quadraticCurveTo(cx, cy + ry * 0.25, cx - rx * 0.3, cy + ry * 0.55); c.quadraticCurveTo(cx - rx * 0.5, cy + ry * 0.2, cx - rx, cy + ry * 0.4); c.closePath(); c.fill(); outline(c, hsl(310, 55, 42), 1.8);
  // Spots + shine.
  for (const [sx, sy] of [[-0.55, -0.35], [0.1, -0.7], [0.62, -0.3], [-0.2, -0.2]] as [number, number][]) dab(c, cx + sx * rx, cy + sy * ry, rx * 0.1, rx * 0.09, 0, hsl(330, 90, 88, 0.85));
  dab(c, cx - rx * 0.5, cy - ry * 0.75, rx * 0.16, rx * 0.06, -0.6, 'rgba(255,255,255,0.8)');
  if (f) face(c, cx + rx * 0.2, cy - ry * 0.02, rx * 0.5, rx * 0.09, hsl(340, 90, 70, 0.8));
}
function paintJellyBody(c: Ctx, w: number, h: number) {
  const g = c.createRadialGradient(62, 40, 4, 62, 40, 56); g.addColorStop(0, 'rgba(255,150,230,0.3)'); g.addColorStop(1, 'rgba(255,150,230,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  jelly(c, 62, 44, 44, 26, 34, true);
  for (const [x, y, r] of [[12, 22, 1.8], [112, 30, 1.6], [104, 74, 1.4]] as [number, number, number][]) sparkle(c, x, y, r, hsl(190, 100, 86));
}
function jellyIcon(c: Ctx, w: number) { jelly(c, w / 2, w / 2 - 4, 18, 10, 17, true); }
/** Treasure: a glowing pink jelly gem. */
function jellyTreasure(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 2;
  const halo = c.createRadialGradient(cx, cy, 2, cx, cy, 22); halo.addColorStop(0, 'rgba(255,170,240,0.5)'); halo.addColorStop(1, 'rgba(255,170,240,0)');
  c.fillStyle = halo; c.fillRect(0, 0, w, w);
  c.beginPath(); c.moveTo(cx, cy - 15); c.bezierCurveTo(cx + 18, cy - 12, cx + 18, cy + 10, cx, cy + 16); c.bezierCurveTo(cx - 18, cy + 10, cx - 18, cy - 12, cx, cy - 15); c.closePath();
  const g = c.createLinearGradient(cx - 14, cy - 14, cx + 14, cy + 16); g.addColorStop(0, hsl(330, 95, 86)); g.addColorStop(1, hsl(300, 75, 60));
  c.fillStyle = g; c.fill(); outline(c, hsl(310, 55, 40), 1.6);
  dab(c, cx - 6, cy - 6, 3, 6, 0.5, 'rgba(255,255,255,0.8)');
  sparkle(c, w - 9, 11, 2.4); sparkle(c, 9, w - 11, 1.8);
}

// ------------------------------------------------------------------ Strawberry
function berry(c: Ctx, cx: number, cy: number, rx: number, ry: number, f: boolean) {
  const g = c.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 2, cx, cy, rx * 1.1);
  g.addColorStop(0, hsl(356, 90, 66)); g.addColorStop(0.7, hsl(352, 82, 50)); g.addColorStop(1, hsl(348, 72, 38));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(cx - rx, cy - ry * 0.35);
  c.bezierCurveTo(cx - rx, cy - ry * 1.1, cx + rx, cy - ry * 1.1, cx + rx, cy - ry * 0.35);
  c.bezierCurveTo(cx + rx, cy + ry * 0.55, cx + rx * 0.35, cy + ry, cx, cy + ry);
  c.bezierCurveTo(cx - rx * 0.35, cy + ry, cx - rx, cy + ry * 0.55, cx - rx, cy - ry * 0.35); c.closePath(); c.fill(); outline(c, hsl(348, 65, 26), 1.8);
  // Seeds.
  const seeds: [number, number][] = [[-0.62, -0.1], [-0.3, 0.2], [0.05, 0.45], [0.4, 0.15], [0.62, -0.15], [-0.45, -0.45], [0, -0.05], [0.3, -0.5], [-0.12, 0.7], [0.2, 0.7]];
  for (const [sx, sy] of seeds) dab(c, cx + sx * rx, cy + sy * ry, rx * 0.045, rx * 0.07, 0.2, hsl(48, 90, 74));
  // Leafy cap + stem.
  c.fillStyle = hsl(112, 50, 40);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.62;
    c.save(); c.translate(cx, cy - ry * 0.82); c.rotate(a);
    c.beginPath(); c.ellipse(0, -rx * 0.22, rx * 0.12, rx * 0.34, 0, 0, Math.PI * 2); c.fill(); outline(c, hsl(115, 55, 22), 1.2);
    c.restore();
  }
  c.strokeStyle = hsl(112, 50, 30); c.lineWidth = Math.max(2, rx * 0.1); c.beginPath(); c.moveTo(cx, cy - ry * 0.85); c.quadraticCurveTo(cx + 3, cy - ry * 1.1, cx + rx * 0.2, cy - ry * 1.18); c.stroke();
  dab(c, cx - rx * 0.5, cy - ry * 0.5, rx * 0.11, rx * 0.2, 0.6, 'rgba(255,255,255,0.45)');
  if (f) face(c, cx + rx * 0.22, cy + ry * 0.08, rx * 0.55, rx * 0.075, hsl(14, 95, 78, 0.85));
}
function paintBerryBody(c: Ctx, w: number, h: number) {
  const g = c.createRadialGradient(62, 46, 4, 62, 46, 54); g.addColorStop(0, 'rgba(255,120,130,0.3)'); g.addColorStop(1, 'rgba(255,120,130,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  berry(c, 60, 46, 38, 32, true);
  for (const [x, y, r] of [[12, 20, 1.8], [110, 26, 1.6], [104, 72, 1.4]] as [number, number, number][]) sparkle(c, x, y, r, hsl(50, 100, 82));
}
function berryIcon(c: Ctx, w: number) { berry(c, w / 2, w / 2 + 3, 15, 15, true); }
/** Treasure: a golden strawberry seed. */
function berrySeedTreasure(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 2;
  const halo = c.createRadialGradient(cx, cy, 2, cx, cy, 22); halo.addColorStop(0, 'rgba(255,230,120,0.5)'); halo.addColorStop(1, 'rgba(255,230,120,0)');
  c.fillStyle = halo; c.fillRect(0, 0, w, w);
  c.beginPath(); c.moveTo(cx, cy - 16); c.bezierCurveTo(cx + 13, cy - 8, cx + 11, cy + 10, cx, cy + 16); c.bezierCurveTo(cx - 11, cy + 10, cx - 13, cy - 8, cx, cy - 16); c.closePath();
  const g = c.createLinearGradient(cx - 10, cy - 14, cx + 10, cy + 14); g.addColorStop(0, hsl(52, 100, 74)); g.addColorStop(1, hsl(40, 92, 50));
  c.fillStyle = g; c.fill(); outline(c, hsl(34, 80, 30), 1.6);
  dab(c, cx - 4, cy - 5, 2.2, 5, 0.3, 'rgba(255,255,255,0.75)');
  // Tiny strawberry-pink bud on top.
  dab(c, cx, cy - 14, 3.4, 2.4, 0, hsl(352, 82, 56));
  sparkle(c, w - 9, 11, 2.4); sparkle(c, 9, w - 11, 1.8);
}

/** Raw painters, so a preview page can draw them without a Phaser scene. */
export const FUN_PAINTERS = {
  cookie: [paintCookieBody, cookieIcon, hatTreasure],
  chili: [paintChiliBody, chiliIcon, ponchoTreasure],
  carpet: [paintCarpetBody, carpetIcon, tasselTreasure],
  duck: [paintDuckBody, duckIcon, duckTreasure],
  jelly: [paintJellyBody, jellyIcon, jellyTreasure],
  berry: [paintBerryBody, berryIcon, berrySeedTreasure],
} as const;
export const FUN_WINGS: Record<string, [number, number, number, string]> = {
  cookie: [40, 55, 92, hsl(32, 50, 55)],
  chili: [120, 50, 52, CH_GD],
  carpet: [270, 60, 74, hsl(270, 50, 30)],
  duck: [50, 100, 66, hsl(42, 90, 40)],
  jelly: [320, 85, 84, hsl(310, 55, 50)],
  berry: [0, 0, 98, hsl(352, 40, 60)],
};

type Ent = { key: string; wing: string; icon: string; treasure: string };
const ENTS: Record<string, Ent> = {
  cookie: { key: 'cookie_body', wing: 'cookie_wing', icon: 'i_cookie', treasure: 'ic_cowboy_hat' },
  chili: { key: 'chili_body', wing: 'chili_wing', icon: 'i_chili', treasure: 'ic_chili_poncho' },
  carpet: { key: 'carpet_body', wing: 'carpet_wing', icon: 'i_carpet', treasure: 'ic_magic_tassel' },
  duck: { key: 'duck_body', wing: 'duck_wing', icon: 'i_duck', treasure: 'ic_duck_squeak' },
  jelly: { key: 'jelly_body', wing: 'jelly_wing', icon: 'i_jelly', treasure: 'ic_jelly_gem' },
  berry: { key: 'berry_body', wing: 'berry_wing', icon: 'i_berry', treasure: 'ic_berry_seed' },
};

export function paintFunMounts(scene: Phaser.Scene) {
  for (const id of Object.keys(ENTS)) {
    const e = ENTS[id], [body, icon, treasure] = FUN_PAINTERS[id as keyof typeof FUN_PAINTERS];
    const [h, s, l, edge] = FUN_WINGS[id];
    canvasTex(scene, e.key, 124, 84, (c) => body(c, 124, 84));
    canvasTex(scene, e.wing, 48, 96, (c) => paintWing(c, 48, 96, false, h, s, l, edge));
    canvasTex(scene, `${e.wing}_far`, 48, 96, (c) => paintWing(c, 48, 96, true, h, s, l, edge));
    canvasTex(scene, e.icon, 48, 48, (c) => icon(c, 48), 2);
    canvasTex(scene, e.treasure, 48, 48, (c) => treasure(c, 48), 2);
  }
}
export { paintWing };
