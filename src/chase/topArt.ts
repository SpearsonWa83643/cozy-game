// 74 (Walker, Nov 3): top-down art for the Thief Chase. Every mount gets its own bird's-eye picture
// (nose up the screen) with your hero riding on its back, seen from above (hat, scarf, outfit and arms
// holding on), plus its own way of flying: flapping wings (left wing painted, right = flipped), a
// streaming cape, a spinning propeller, a rippling carpet or a pulsing jelly bell.
// Painted procedurally at 2x like the rest of the chase art, and only for the mount you fly (lazy).
import Phaser from 'phaser';
import { uploadTex } from '../art';
import { OUTFITS, SCARVES } from '../hero';
import { CAPE } from '../mount/cape';
import type { Look } from '../save';

const R = 2;
type C = CanvasRenderingContext2D;
type HSL = [number, number, number];
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${Math.max(0, Math.min(100, l))}%,${a})`;
const hs = (c: HSL, dl = 0, a = 1) => hsl(c[0], c[1], c[2] + dl, a);

/** Body canvas (design px); the mount's centre is (BW/2, BH/2), nose towards y = 0. */
export const BW = 220, BH = 280;
/** Wing canvas: a LEFT wing, its root at the right edge (WW, WY). */
export const WW = 190, WH = 130, WY = 40;
export const CAPE_TW = 200, CAPE_TH = 220;

export type Fly = 'wings' | 'bee' | 'membrane' | 'cape' | 'prop' | 'carpet' | 'jelly';
export type TopSpec = {
  fly: Fly;
  /** Wing root on the body (design px from the body centre; left side, mirrored for the right). */
  wingAt?: [number, number];
  /** Wing beat speed (flaps per second). */
  beat?: number;
  /** Cape attach (y from the body centre) and tint. */
  capeAt?: number; cape?: number;
  /** Where the rider sits (y from the body centre) and how big (1 = default). */
  riderY: number; riderS?: number;
  /** Wing-tip / tail contrail points (x, y from centre; left side, mirrored). */
  tips?: [number, number];
};

// ---------- small paint helpers ----------
function shade(c: C, x: number, y: number, rx: number, ry: number, col: HSL, rot = 0, line = 2.6) {
  c.save(); c.translate(x, y); c.rotate(rot);
  const g = c.createRadialGradient(-rx * 0.35, -ry * 0.4, Math.min(rx, ry) * 0.1, 0, 0, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, hs(col, 14)); g.addColorStop(0.55, hs(col)); g.addColorStop(1, hs(col, -12));
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.fill();
  if (line) { c.strokeStyle = hs(col, -30, 0.9); c.lineWidth = line; c.stroke(); }
  c.restore();
}
function shapeFill(c: C, path: () => void, col: HSL, line = 2.6, cx = BW / 2, cy = BH / 2, r = 90) {
  const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, hs(col, 14)); g.addColorStop(0.55, hs(col)); g.addColorStop(1, hs(col, -12));
  c.fillStyle = g; c.beginPath(); path(); c.fill();
  if (line) { c.strokeStyle = hs(col, -30, 0.9); c.lineWidth = line; c.stroke(); }
}
function dot(c: C, x: number, y: number, r: number, fill: string) { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function eye(c: C, x: number, y: number, r = 4.2) { dot(c, x, y, r, '#1d1a24'); dot(c, x - r * 0.35, y - r * 0.4, r * 0.38, '#fff'); }
function shine(c: C, x: number, y: number, rx: number, ry: number, rot = -0.5, a = 0.45) { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
function tri(c: C, a: [number, number], b: [number, number], d: [number, number], fill: string, stroke?: string) {
  c.fillStyle = fill; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.closePath(); c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
}
/** Tucked legs (seen from above: little ovals by the body). */
function legs(c: C, col: HSL, pts: [number, number][], rx = 9, ry = 15) { for (const [x, y] of pts) { shade(c, BW / 2 + x, BH / 2 + y, rx, ry, col, x < 0 ? 0.35 : -0.35, 2); shade(c, BW / 2 - x, BH / 2 + y, rx, ry, col, x < 0 ? -0.35 : 0.35, 2); } }

// ---------- the rider (seen from above) ----------
export function paintRider(c: C, x: number, y: number, s: number, look: Look) {
  const o = OUTFITS[look.outfit] ?? OUTFITS.teal;
  c.save(); c.translate(x, y); c.scale(s, s);
  // soft shadow on the mount
  c.fillStyle = 'rgba(20,30,40,.18)'; c.beginPath(); c.ellipse(3, 8, 30, 26, 0, 0, Math.PI * 2); c.fill();
  // backpack / staff on the back
  if (look.back === 'backpack') { c.fillStyle = hsl(18, 60, 44); c.beginPath(); c.roundRect(-14, 6, 28, 22, 7); c.fill(); c.fillStyle = hsl(22, 70, 56); c.beginPath(); c.roundRect(-11, 8, 22, 9, 4); c.fill(); }
  if (look.back === 'staff') { c.strokeStyle = hsl(28, 45, 36); c.lineWidth = 3.4; c.beginPath(); c.moveTo(-20, 30); c.lineTo(18, -26); c.stroke(); dot(c, 19, -28, 5.5, hsl(48, 95, 66)); dot(c, 19, -28, 9, hsl(48, 95, 70, 0.35)); }
  // arms reaching forward to hold on
  for (const sx of [-1, 1]) {
    c.strokeStyle = hs(o.arm, -18); c.lineWidth = 11; c.beginPath(); c.moveTo(sx * 17, -2); c.quadraticCurveTo(sx * 22, -18, sx * 12, -30); c.stroke();
    c.strokeStyle = hs(o.arm); c.lineWidth = 8; c.beginPath(); c.moveTo(sx * 17, -2); c.quadraticCurveTo(sx * 22, -18, sx * 12, -30); c.stroke();
    dot(c, sx * 12, -31, 5, hsl(28, 60, 74)); dot(c, sx * 12, -31, 5, 'rgba(0,0,0,0)');
  }
  // body / shoulders (tunic)
  const g = c.createRadialGradient(-6, -6, 2, 0, 2, 26);
  g.addColorStop(0, hs(o.a, 12)); g.addColorStop(0.6, hs(o.a)); g.addColorStop(1, hs(o.b));
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 4, 21, 15, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hs(o.b, -12, 0.9); c.lineWidth = 2; c.stroke();
  // scarf: a band round the neck and two tails streaming back in the wind
  const sc = SCARVES[look.scarf];
  if (sc) {
    c.fillStyle = hsl(...sc[0]);
    c.beginPath(); c.moveTo(4, 2); c.quadraticCurveTo(14, 18, 8, 40); c.quadraticCurveTo(18, 30, 13, 46); c.quadraticCurveTo(26, 22, 11, 0); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(0, -3, 13, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = hsl(...sc[1], 0.85); c.beginPath(); c.ellipse(-3, -5, 8, 3, 0, 0, Math.PI * 2); c.fill();
  }
  // head / hat
  const hy = -6;
  if (look.hat === 'straw') {
    c.fillStyle = 'rgba(30,20,0,.18)'; c.beginPath(); c.arc(2, hy + 3, 24, 0, Math.PI * 2); c.fill();
    const hg = c.createRadialGradient(-6, hy - 6, 2, 0, hy, 24); hg.addColorStop(0, hsl(50, 85, 84)); hg.addColorStop(0.7, hsl(46, 70, 68)); hg.addColorStop(1, hsl(38, 55, 50));
    c.fillStyle = hg; c.beginPath(); c.arc(0, hy, 23, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hsl(36, 50, 44, 0.5); c.lineWidth = 1;
    for (let r = 17; r < 23; r += 2.5) { c.beginPath(); c.arc(0, hy, r, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = hsl(8, 70, 52); c.lineWidth = 3.6; c.beginPath(); c.arc(0, hy, 12.5, 0, Math.PI * 2); c.stroke();
    const cg = c.createRadialGradient(-4, hy - 4, 1, 0, hy, 12); cg.addColorStop(0, hsl(52, 85, 86)); cg.addColorStop(1, hsl(44, 65, 62));
    c.fillStyle = cg; c.beginPath(); c.arc(0, hy, 10.5, 0, Math.PI * 2); c.fill();
    dot(c, 9, hy + 9, 3, hsl(340, 80, 78));
  } else if (look.hat === 'acorn') {
    shade(c, 0, hy, 15, 15, [28, 50, 36], 0, 1.6);
    c.strokeStyle = hsl(30, 45, 52, 0.6); c.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 5 - 8, hy - 10); c.lineTo(i * 5 + 8, hy + 10); c.moveTo(i * 5 + 8, hy - 10); c.lineTo(i * 5 - 8, hy + 10); c.stroke(); }
    c.fillStyle = hsl(26, 45, 28); c.fillRect(-2, hy - 3, 4, 6);
  } else if (look.hat === 'foxhood') {
    shade(c, 0, hy, 15, 15, [22, 75, 54], 0, 1.6);
    for (const sx of [-1, 1]) { tri(c, [sx * 5, hy - 10], [sx * 14, hy - 22], [sx * 15, hy - 6], hsl(22, 75, 50)); tri(c, [sx * 8, hy - 11], [sx * 13, hy - 18], [sx * 13, hy - 9], hsl(30, 40, 92)); }
  } else {
    // hair (and a flower crown)
    shade(c, 0, hy, 14, 14, [25, 45, 34], 0, 1.4);
    shine(c, -4, hy - 5, 6, 2.6, -0.4, 0.3);
    if (look.hat === 'crown') for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const hue = [340, 48, 0, 270, 20][i % 5]; dot(c, Math.cos(a) * 13, hy + Math.sin(a) * 13, 3.6, hsl(hue, hue === 0 ? 0 : 80, hue === 0 ? 97 : 74)); dot(c, Math.cos(a) * 13, hy + Math.sin(a) * 13, 1.2, hsl(50, 90, 66)); }
  }
  if (look.feather) { c.save(); c.translate(14, hy + 4); c.rotate(2.4); c.fillStyle = hsl(46, 95, 66); c.beginPath(); c.moveTo(0, 4); c.quadraticCurveTo(-4.5, -4, 0, -15); c.quadraticCurveTo(4.5, -4, 0, 4); c.fill(); c.restore(); }
  c.restore();
}

// ---------- wings ----------
/** A feathered LEFT wing: root at (WW, WY), coverts then long primaries fanning out to the tip. */
function featherWing(c: C, base: HSL, tip: HSL, span = 1, under?: HSL) {
  const rx = WW, ry = WY;
  const L = 170 * span;
  // primaries / secondaries (back row)
  const n = 9;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const fx = rx - L * (0.25 + 0.75 * k), fy = ry + 18 + 46 * (1 - Math.abs(k - 0.75) * 1.4) * 0.8 + (k > 0.8 ? -10 * (k - 0.8) * 5 : 0);
    const len = 30 + 26 * k;
    c.save(); c.translate(fx, fy); c.rotate(-0.25 - k * 0.6);
    c.fillStyle = hs(k > 0.6 ? tip : base, -8); c.beginPath(); c.ellipse(0, len * 0.35, 10 + 3 * k, len * 0.6, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hs(base, -30, 0.7); c.lineWidth = 1.6; c.stroke();
    c.restore();
  }
  // the arm of the wing (coverts)
  c.beginPath();
  c.moveTo(rx, ry - 14);
  c.quadraticCurveTo(rx - L * 0.5, ry - 30, rx - L, ry + 4);
  c.quadraticCurveTo(rx - L * 0.55, ry + 30, rx, ry + 26);
  c.closePath();
  const g = c.createLinearGradient(rx - L, ry - 20, rx, ry + 20); g.addColorStop(0, hs(tip, 6)); g.addColorStop(0.45, hs(base, 10)); g.addColorStop(1, hs(base, -4));
  c.fillStyle = g; c.fill(); c.strokeStyle = hs(base, -30, 0.9); c.lineWidth = 2.4; c.stroke();
  // little covert scallops
  c.strokeStyle = hs(base, -18, 0.5); c.lineWidth = 1.4;
  for (let i = 1; i < 6; i++) { const x = rx - L * i * 0.15; c.beginPath(); c.arc(x, ry + 8, 9, 0.2, Math.PI - 0.2); c.stroke(); }
  if (under) { c.fillStyle = hs(under, 0, 0.5); c.beginPath(); c.ellipse(rx - L * 0.3, ry - 4, L * 0.22, 6, -0.12, 0, Math.PI * 2); c.fill(); }
  shine(c, rx - L * 0.35, ry - 10, L * 0.2, 4, -0.15, 0.35);
}
function membraneWing(c: C, col: HSL) {
  const rx = WW, ry = WY, L = 175;
  c.beginPath(); c.moveTo(rx, ry - 12);
  c.quadraticCurveTo(rx - L * 0.5, ry - 34, rx - L, ry - 8);
  // scalloped trailing edge
  const pts = [[rx - L * 0.78, ry + 30], [rx - L * 0.52, ry + 40], [rx - L * 0.26, ry + 44], [rx, ry + 34]];
  let px = rx - L, py = ry - 8;
  for (const [x, y] of pts) { c.quadraticCurveTo((px + x) / 2, (py + y) / 2 - 16, x, y); px = x; py = y; }
  c.closePath();
  const g = c.createLinearGradient(rx - L, ry, rx, ry); g.addColorStop(0, hs(col, 10)); g.addColorStop(1, hs(col, -6));
  c.fillStyle = g; c.fill(); c.strokeStyle = hs(col, -32); c.lineWidth = 2.4; c.stroke();
  c.strokeStyle = hs(col, -22, 0.7); c.lineWidth = 2.2;
  for (const [x, y] of pts.slice(0, 3)) { c.beginPath(); c.moveTo(rx - L * 0.9, ry - 10); c.lineTo(x, y - 6); c.stroke(); }
  dot(c, rx - L * 0.92, ry - 10, 4, hs(col, -30));
}
function beeWing(c: C) {
  const rx = WW, ry = WY;
  for (const [l, rot, w, dy] of [[120, -0.25, 34, -6], [86, 0.3, 26, 22]] as const) {
    c.save(); c.translate(rx - 10, ry + dy); c.rotate(rot);
    c.fillStyle = 'rgba(225,245,255,.62)'; c.beginPath(); c.ellipse(-l / 2, 0, l / 2, w / 2, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(90,120,150,.75)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(90,120,150,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-l * 0.9, -4); c.moveTo(-l * 0.3, 0); c.lineTo(-l * 0.7, w * 0.3); c.stroke();
    shine(c, -l * 0.45, -w * 0.15, l * 0.25, 4, 0, 0.5);
    c.restore();
  }
}
/** Fluffy food-friend wings ("cute little wings", like the side art) */
function puffWing(c: C, col: HSL) {
  const rx = WW, ry = WY;
  for (let i = 4; i >= 0; i--) {
    const k = i / 4;
    shade(c, rx - 30 - 95 * k, ry + 8 + 12 * k, 26 - 6 * k, 18 - 2 * k, i % 2 ? [col[0], col[1], col[2] + 4] : col, -0.2, 2);
  }
  shine(c, rx - 70, ry - 2, 40, 5, -0.1, 0.4);
}

// ---------- bodies ----------
type Painter = (c: C) => void;
const cx = BW / 2, cy = BH / 2;
function bird(c: C, o: { body: HSL; head: HSL; beak: HSL; tail: HSL; neck?: number; beakLen?: number; headR?: number; bodyR?: [number, number]; extra?: Painter }) {
  const [brx, bry] = o.bodyR ?? [44, 74];
  // tail fan
  for (let i = -3; i <= 3; i++) { c.save(); c.translate(cx, cy + bry * 0.6); c.rotate(i * 0.16); shade(c, 0, 48, 11, 30, o.tail, 0, 1.8); c.restore(); }
  shade(c, cx, cy + 8, brx, bry, o.body);
  shine(c, cx - brx * 0.35, cy - bry * 0.25, brx * 0.3, bry * 0.4, 0.2, 0.25);
  const neck = o.neck ?? 0, hr = o.headR ?? 28, hy = cy - bry + 6 - neck;
  if (neck) { c.strokeStyle = hs(o.head, -30); c.lineWidth = 22; c.beginPath(); c.moveTo(cx, cy - bry + 30); c.quadraticCurveTo(cx + 10, hy + neck * 0.5, cx, hy); c.stroke(); c.strokeStyle = hs(o.head); c.lineWidth = 17; c.stroke(); }
  // beak, pointing up the screen
  const bl = o.beakLen ?? 22;
  c.fillStyle = hs(o.beak); c.strokeStyle = hs(o.beak, -28); c.lineWidth = 2;
  c.beginPath(); c.moveTo(cx - 9, hy - hr + 8); c.quadraticCurveTo(cx, hy - hr - bl * 1.1, cx + 9, hy - hr + 8); c.closePath(); c.fill(); c.stroke();
  shade(c, cx, hy, hr, hr * 0.95, o.head);
  eye(c, cx - hr * 0.55, hy - hr * 0.35); eye(c, cx + hr * 0.55, hy - hr * 0.35);
  shine(c, cx - hr * 0.3, hy - hr * 0.45, hr * 0.35, hr * 0.16, -0.3, 0.4);
  o.extra?.(c);
}
function capeFriendFace(c: C, x: number, y: number, s = 1) {
  eye(c, x - 12 * s, y, 4.4 * s); eye(c, x + 12 * s, y, 4.4 * s);
  c.strokeStyle = '#3a1f1a'; c.lineWidth = 2.4 * s; c.beginPath(); c.arc(x, y + 6 * s, 6 * s, 0.2, Math.PI - 0.2); c.stroke();
  dot(c, x - 20 * s, y + 6 * s, 4 * s, 'rgba(255,120,140,.45)'); dot(c, x + 20 * s, y + 6 * s, 4 * s, 'rgba(255,120,140,.45)');
}
function stubArms(c: C, col: HSL, y: number, x: number) { for (const sx of [-1, 1]) shade(c, cx + sx * x, cy + y, 10, 8, col, 0, 1.8); }

const BODY: Record<string, Painter> = {
  eagle: (c) => bird(c, { body: [25, 45, 30], head: [40, 20, 96], beak: [44, 95, 55], tail: [40, 15, 94] }),
  pterodactyl: (c) => bird(c, { body: [170, 35, 38], head: [168, 38, 44], beak: [42, 70, 62], tail: [170, 35, 34], beakLen: 42, bodyR: [36, 70],
    extra: (c) => { tri(c, [cx - 6, cy - 82], [cx + 6, cy - 82], [cx, cy - 30], hsl(8, 70, 56), hsl(8, 70, 36)); } }),
  goose: (c) => bird(c, { body: [30, 18, 52], head: [0, 0, 16], beak: [0, 0, 12], tail: [0, 0, 20], neck: 30, headR: 20, bodyR: [44, 72],
    extra: (c) => { c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy - 72 - 30 + 6, 15, 0.3, Math.PI - 0.3); c.stroke(); } }),
  snowy_owl: (c) => bird(c, { body: [210, 10, 95], head: [210, 8, 96], beak: [30, 20, 30], tail: [210, 10, 92], beakLen: 8, headR: 36, bodyR: [52, 66],
    extra: (c) => { const r = (() => { let s = 5; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })(); for (let i = 0; i < 26; i++) dot(c, cx + (r() - 0.5) * 80, cy - 10 + r() * 80, 2.2, 'rgba(40,40,50,.6)'); dot(c, cx - 19, cy - 80, 8, hsl(48, 95, 55)); dot(c, cx + 19, cy - 80, 8, hsl(48, 95, 55)); eye(c, cx - 19, cy - 80, 4); eye(c, cx + 19, cy - 80, 4); } }),
  flamingo: (c) => bird(c, { body: [345, 75, 72], head: [345, 75, 76], beak: [0, 0, 18], tail: [345, 70, 66], neck: 40, headR: 19, beakLen: 18 }),
  rubber_duck: (c) => bird(c, { body: [50, 100, 58], head: [50, 100, 60], beak: [24, 100, 56], tail: [50, 100, 54], beakLen: 16, headR: 32, bodyR: [56, 70],
    extra: (c) => { dot(c, cx + 22, cy - 98, 7, hsl(340, 80, 66)); dot(c, cx + 34, cy - 98, 7, hsl(340, 80, 66)); dot(c, cx + 28, cy - 98, 4, hsl(340, 80, 50)); } }),
  bumblebee: (c) => {
    shade(c, cx, cy + 10, 50, 76, [48, 100, 52]);
    c.save(); c.beginPath(); c.ellipse(cx, cy + 10, 50, 76, 0, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(30,24,20,.9)'; for (const y of [-30, 12, 54]) c.fillRect(cx - 60, cy + y, 120, 20);
    c.restore();
    tri(c, [cx - 6, cy + 84], [cx + 6, cy + 84], [cx, cy + 100], '#2a2420');
    shade(c, cx, cy - 72, 30, 26, [30, 20, 18]);
    eye(c, cx - 16, cy - 82, 6); eye(c, cx + 16, cy - 82, 6);
    c.strokeStyle = '#2a2420'; c.lineWidth = 3; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(cx + sx * 8, cy - 94); c.quadraticCurveTo(cx + sx * 14, cy - 116, cx + sx * 26, cy - 120); c.stroke(); dot(c, cx + sx * 26, cy - 120, 4.5, '#2a2420'); }
    shine(c, cx - 18, cy - 20, 14, 30, 0.2, 0.3);
  },
  unicorn: (c) => {
    // rainbow tail
    const rb = [0, 30, 50, 140, 200, 270];
    rb.forEach((h, i) => { c.strokeStyle = hsl(h, 80, 70); c.lineWidth = 7; c.beginPath(); c.moveTo(cx - 12 + i * 5, cy + 66); c.quadraticCurveTo(cx - 20 + i * 6, cy + 100, cx - 6 + i * 4, cy + 128); c.stroke(); });
    legs(c, [280, 15, 92], [[-30, -40], [-30, 50]]);
    shade(c, cx, cy + 10, 38, 68, [280, 15, 97]);
    shade(c, cx, cy - 60, 17, 30, [280, 15, 97]);
    shade(c, cx, cy - 96, 18, 28, [280, 15, 98]);
    rb.forEach((h, i) => dot(c, cx + (i % 2 ? 3 : -3), cy - 74 + i * 9, 6.5, hsl(h, 80, 72)));
    for (const sx of [-1, 1]) tri(c, [cx + sx * 8, cy - 112], [cx + sx * 18, cy - 126], [cx + sx * 17, cy - 104], hsl(330, 40, 90), hsl(280, 10, 60));
    c.fillStyle = hsl(46, 90, 62); c.strokeStyle = hsl(40, 80, 40); c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 6, cy - 118); c.lineTo(cx, cy - 152); c.lineTo(cx + 6, cy - 118); c.closePath(); c.fill(); c.stroke();
    eye(c, cx - 15, cy - 104, 4); eye(c, cx + 15, cy - 104, 4);
    dot(c, cx - 6, cy - 72, 2.6, 'rgba(255,160,200,.8)'); dot(c, cx + 6, cy - 72, 2.6, 'rgba(255,160,200,.8)');
  },
  reindeer: (c) => {
    shade(c, cx, cy + 92, 10, 12, [30, 30, 90]);
    legs(c, [25, 40, 28], [[-30, -36], [-30, 50]]);
    shade(c, cx, cy + 10, 40, 70, [26, 45, 42]);
    shade(c, cx, cy + 14, 22, 46, [30, 35, 70], 0, 0);
    shade(c, cx, cy - 76, 22, 30, [26, 45, 44]);
    c.strokeStyle = hsl(30, 40, 30); c.lineWidth = 5;
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(cx + sx * 12, cy - 84); c.quadraticCurveTo(cx + sx * 40, cy - 100, cx + sx * 54, cy - 126); c.moveTo(cx + sx * 34, cy - 98); c.lineTo(cx + sx * 30, cy - 124); c.moveTo(cx + sx * 46, cy - 110); c.lineTo(cx + sx * 64, cy - 112); c.stroke(); }
    dot(c, cx, cy - 106, 9, hsl(0, 85, 54)); shine(c, cx - 3, cy - 109, 3, 2, 0, 0.7);
    eye(c, cx - 14, cy - 84, 4); eye(c, cx + 14, cy - 84, 4);
  },
  cloud_puppy: (c) => {
    const puffs: [number, number, number][] = [[0, 10, 52], [-34, -20, 30], [34, -20, 30], [-38, 34, 30], [38, 34, 30], [0, 62, 34], [-20, -44, 26], [20, -44, 26]];
    for (const [x, y, r] of puffs) shade(c, cx + x, cy + y, r, r, [210, 60, 97], 0, 0);
    for (const [x, y, r] of puffs) { c.strokeStyle = 'rgba(120,160,210,.5)'; c.lineWidth = 2; c.beginPath(); c.arc(cx + x, cy + y, r, 0, Math.PI * 2); c.stroke(); }
    for (const [x, y, r] of puffs) shade(c, cx + x, cy + y, r - 2, r - 2, [210, 60, 97], 0, 0);
    shade(c, cx, cy - 82, 30, 28, [210, 40, 98]);
    for (const sx of [-1, 1]) shade(c, cx + sx * 30, cy - 72, 11, 22, [340, 60, 84], sx * 0.4, 1.8);
    dot(c, cx, cy - 108, 6, '#2a2430');
    eye(c, cx - 13, cy - 92, 4.5); eye(c, cx + 13, cy - 92, 4.5);
  },
  snail: (c) => {
    c.fillStyle = 'rgba(160,240,220,.35)'; c.beginPath(); c.ellipse(cx, cy + 10, 50, 108, 0, 0, Math.PI * 2); c.fill();
    shade(c, cx, cy - 10, 34, 96, [140, 45, 58]);
    for (const sx of [-1, 1]) { c.strokeStyle = hsl(140, 40, 42); c.lineWidth = 5; c.beginPath(); c.moveTo(cx + sx * 10, cy - 96); c.lineTo(cx + sx * 20, cy - 128); c.stroke(); eye(c, cx + sx * 20, cy - 130, 6); }
    shade(c, cx, cy + 22, 58, 58, [32, 85, 56]);
    c.strokeStyle = hsl(24, 70, 36); c.lineWidth = 4; c.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.15) { const r = 50 - a * 3; const x = cx + Math.cos(a) * r, y = cy + 22 + Math.sin(a) * r; if (a === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.stroke();
    const lg = c.createRadialGradient(cx, cy + 22, 2, cx, cy + 22, 26); lg.addColorStop(0, 'rgba(255,240,150,.9)'); lg.addColorStop(1, 'rgba(255,220,120,0)'); c.fillStyle = lg; c.beginPath(); c.arc(cx, cy + 22, 26, 0, Math.PI * 2); c.fill();
  },
  teacup: (c) => {
    shade(c, cx, cy, 98, 98, [200, 40, 90]);
    c.strokeStyle = hsl(330, 70, 72); c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 88, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 12; c.strokeStyle = '#fff'; c.beginPath(); c.arc(cx + 72, cy, 18, -1.3, 1.3); c.stroke();
    c.strokeStyle = hsl(210, 20, 70); c.lineWidth = 3; c.stroke();
    shade(c, cx, cy, 70, 70, [0, 0, 99]);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; dot(c, cx + Math.cos(a) * 62, cy + Math.sin(a) * 62, 6, hsl(340, 80, 74)); dot(c, cx + Math.cos(a) * 62, cy + Math.sin(a) * 62, 2.4, hsl(48, 95, 62)); }
    const tg = c.createRadialGradient(cx - 14, cy - 14, 4, cx, cy, 54); tg.addColorStop(0, hsl(28, 60, 54)); tg.addColorStop(1, hsl(22, 60, 30));
    c.fillStyle = tg; c.beginPath(); c.arc(cx, cy, 52, 0, Math.PI * 2); c.fill();
    shine(c, cx - 22, cy - 26, 16, 6, -0.6, 0.35);
  },
  airplane: (c) => {
    // tailplane, wing, fuselage, cockpit
    c.fillStyle = hsl(40, 60, 92); c.strokeStyle = hsl(0, 60, 36); c.lineWidth = 2.6;
    c.beginPath(); c.roundRect(cx - 50, cy + 82, 100, 22, 10); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(cx - 106, cy - 46, 212, 44, 18); c.fill(); c.stroke();
    c.fillStyle = hsl(0, 75, 54); for (const sx of [-1, 1]) { c.beginPath(); c.roundRect(cx + (sx < 0 ? -106 : 72), cy - 46, 34, 44, 14); c.fill(); }
    dot(c, cx - 70, cy - 24, 10, '#fff'); dot(c, cx - 70, cy - 24, 6, hsl(0, 75, 54)); dot(c, cx + 70, cy - 24, 10, '#fff'); dot(c, cx + 70, cy - 24, 6, hsl(210, 70, 50));
    shapeFill(c, () => { c.moveTo(cx, cy - 116); c.quadraticCurveTo(cx + 30, cy - 104, cx + 26, cy - 40); c.lineTo(cx + 12, cy + 108); c.quadraticCurveTo(cx, cy + 116, cx - 12, cy + 108); c.lineTo(cx - 26, cy - 40); c.quadraticCurveTo(cx - 30, cy - 104, cx, cy - 116); }, [0, 75, 52]);
    c.fillStyle = hsl(200, 60, 80); c.beginPath(); c.ellipse(cx, cy - 38, 16, 12, 0, 0, Math.PI * 2); c.fill();
    shade(c, cx, cy - 112, 10, 8, [40, 15, 70]);
    shine(c, cx - 10, cy - 70, 5, 26, 0, 0.4);
  },
  pumpkin: (c) => {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; shade(c, cx + Math.cos(a) * 40, cy + Math.sin(a) * 40, 50, 30, [28, 92, 52], a, 2); }
    shade(c, cx, cy, 70, 70, [28, 92, 54], 0, 0);
    c.strokeStyle = hsl(24, 80, 38, 0.6); c.lineWidth = 2.6; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.35; c.beginPath(); c.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18); c.lineTo(cx + Math.cos(a) * 82, cy + Math.sin(a) * 82); c.stroke(); }
    c.strokeStyle = hsl(100, 45, 34); c.lineWidth = 9; c.beginPath(); c.moveTo(cx, cy - 76); c.quadraticCurveTo(cx + 8, cy - 98, cx - 6, cy - 108); c.stroke();
    tri(c, [cx - 34, cy - 70], [cx - 24, cy - 84], [cx - 14, cy - 70], hsl(48, 100, 62)); tri(c, [cx + 14, cy - 70], [cx + 24, cy - 84], [cx + 34, cy - 70], hsl(48, 100, 62));
  },
  cowboy_cookie: (c) => {
    stubArms(c, [32, 60, 52], -10, 72);
    shade(c, cx, cy, 76, 76, [34, 62, 58]);
    const r = (() => { let s = 11; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();
    for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = 18 + r() * 48; shade(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 7, 6, [20, 40, 20], a, 0); }
    shade(c, cx, cy - 76, 44, 18, [28, 40, 34]); shade(c, cx, cy - 76, 22, 12, [28, 40, 28]);
    c.strokeStyle = hsl(5, 70, 50); c.lineWidth = 3; c.beginPath(); c.ellipse(cx, cy - 76, 22, 12, 0, 0, Math.PI * 2); c.stroke();
  },
  chili_poncho: (c) => {
    shapeFill(c, () => { c.moveTo(cx, cy - 102); c.bezierCurveTo(cx + 56, cy - 94, cx + 52, cy + 30, cx + 6, cy + 120); c.quadraticCurveTo(cx, cy + 128, cx - 6, cy + 116); c.bezierCurveTo(cx - 52, cy + 30, cx - 56, cy - 94, cx, cy - 102); }, [2, 82, 50]);
    c.strokeStyle = hsl(110, 55, 38); c.lineWidth = 9; c.beginPath(); c.moveTo(cx, cy - 98); c.quadraticCurveTo(cx - 6, cy - 120, cx + 12, cy - 128); c.stroke();
    for (const sx of [-1, 1]) shade(c, cx + sx * 16, cy - 104, 16, 8, [110, 55, 40], sx * 0.4, 1.6);
    // the poncho: stripes across the middle
    c.save(); c.beginPath(); c.ellipse(cx, cy - 6, 58, 44, 0, 0, Math.PI * 2); c.clip();
    ['#f7d046', '#2fae7a', '#ffffff', '#e8452c', '#7a3fb0', '#f7d046', '#2fae7a'].forEach((col, i) => { c.fillStyle = col; c.fillRect(cx - 60, cy - 50 + i * 13, 120, 13); });
    c.restore(); c.strokeStyle = 'rgba(80,20,10,.6)'; c.lineWidth = 2.4; c.beginPath(); c.ellipse(cx, cy - 6, 58, 44, 0, 0, Math.PI * 2); c.stroke();
    for (let i = -5; i <= 5; i++) { c.strokeStyle = '#f7d046'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(cx + i * 10, cy + 36); c.lineTo(cx + i * 10, cy + 46); c.stroke(); }
    capeFriendFace(c, cx, cy - 72, 0.9);
  },
  magic_carpet: (c) => {
    const w = 150, h = 218, x = cx - w / 2, y = cy - h / 2;
    c.fillStyle = hsl(275, 55, 40); c.strokeStyle = hsl(275, 55, 22); c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 12); c.fill(); c.stroke();
    c.strokeStyle = hsl(46, 90, 60); c.lineWidth = 6; c.beginPath(); c.roundRect(x + 10, y + 10, w - 20, h - 20, 8); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.roundRect(x + 20, y + 20, w - 40, h - 40, 6); c.stroke();
    for (let i = 0; i < 4; i++) { const yy = y + 40 + i * 46; c.fillStyle = i % 2 ? hsl(330, 70, 66) : hsl(46, 90, 62); c.beginPath(); c.moveTo(cx, yy - 16); c.lineTo(cx + 22, yy); c.lineTo(cx, yy + 16); c.lineTo(cx - 22, yy); c.closePath(); c.fill(); }
    for (const [tx, ty] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { dot(c, tx, ty, 7, hsl(46, 90, 60)); c.strokeStyle = hsl(46, 90, 60); c.lineWidth = 3; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + (tx < cx ? -8 : 8), ty + (ty < cy ? -12 : 12)); c.stroke(); }
    for (let i = 0; i < 9; i++) { c.strokeStyle = hsl(46, 90, 60); c.lineWidth = 2; c.beginPath(); c.moveTo(x + 10 + i * 16.2, y + h); c.lineTo(x + 10 + i * 16.2, y + h + 9); c.stroke(); }
  },
  sky_jelly: (c) => {
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const x0 = cx - 48 + i * 16; c.strokeStyle = hsl(320, 70, 78, 0.85); c.lineWidth = 7; c.beginPath(); c.moveTo(x0, cy + 20); c.bezierCurveTo(x0 + 14, cy + 60, x0 - 14, cy + 90, x0 + 6, cy + 128); c.stroke(); }
    const g = c.createRadialGradient(cx - 22, cy - 30, 6, cx, cy - 10, 86); g.addColorStop(0, 'rgba(255,220,245,.98)'); g.addColorStop(0.6, 'rgba(250,150,220,.92)'); g.addColorStop(1, 'rgba(210,90,190,.9)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy - 10, 78, 0, Math.PI * 2); c.fill(); c.strokeStyle = hsl(310, 55, 50); c.lineWidth = 2.6; c.stroke();
    for (const [x, y, r] of [[-40, -40, 9], [36, -46, 7], [46, 10, 8], [-46, 18, 6], [8, -64, 6], [-14, 40, 7]]) dot(c, cx + x, cy + y, r, 'rgba(255,255,255,.55)');
    capeFriendFace(c, cx, cy - 70, 0.8);
    shine(c, cx - 30, cy - 50, 24, 10, -0.6, 0.45);
  },
  strawberry: (c) => {
    shapeFill(c, () => { c.moveTo(cx, cy + 110); c.bezierCurveTo(cx - 90, cy + 40, cx - 86, cy - 90, cx, cy - 92); c.bezierCurveTo(cx + 86, cy - 90, cx + 90, cy + 40, cx, cy + 110); }, [356, 82, 52]);
    const r = (() => { let s = 3; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();
    for (let i = 0; i < 30; i++) { const x = cx + (r() - 0.5) * 120, y = cy - 60 + r() * 140; if (Math.abs(x - cx) > 60 - (y - cy) * 0.35) continue; c.fillStyle = hsl(48, 90, 70); c.beginPath(); c.ellipse(x, y, 2, 3.4, 0, 0, Math.PI * 2); c.fill(); }
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.42; c.save(); c.translate(cx, cy - 86); c.rotate(a + Math.PI / 2); shade(c, 0, -18, 9, 22, [115, 55, 42], 0, 1.6); c.restore(); }
    capeFriendFace(c, cx, cy - 56, 0.9);
  },
  tamale: (c) => {
    shapeFill(c, () => { c.moveTo(cx, cy - 116); c.bezierCurveTo(cx + 70, cy - 70, cx + 66, cy + 70, cx, cy + 124); c.bezierCurveTo(cx - 66, cy + 70, cx - 70, cy - 70, cx, cy - 116); }, [46, 60, 72]);
    c.strokeStyle = hsl(40, 45, 50, 0.6); c.lineWidth = 1.8; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(cx + i * 6, cy - 110); c.quadraticCurveTo(cx + i * 16, cy, cx + i * 6, cy + 118); c.stroke(); }
    shade(c, cx, cy - 34, 40, 30, [44, 85, 66]); c.fillStyle = hsl(10, 70, 50); c.beginPath(); c.ellipse(cx, cy - 34, 22, 14, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hsl(30, 40, 40); c.lineWidth = 5; c.beginPath(); c.moveTo(cx - 50, cy + 40); c.quadraticCurveTo(cx, cy + 52, cx + 50, cy + 40); c.stroke();
    capeFriendFace(c, cx, cy - 76, 0.85);
  },
  he_buddy: (c) => {
    stubArms(c, [44, 80, 62], -10, 62);
    c.fillStyle = hsl(44, 85, 60); c.strokeStyle = hsl(36, 70, 34); c.lineWidth = 3; c.beginPath(); c.roundRect(cx - 56, cy - 96, 112, 196, 22); c.fill(); c.stroke();
    c.fillStyle = hsl(46, 95, 74); c.beginPath(); c.roundRect(cx - 46, cy - 86, 40, 176, 16); c.fill();
    c.fillStyle = hsl(2, 80, 50); c.fillRect(cx - 56, cy + 22, 112, 18); c.fillStyle = '#fff'; c.fillRect(cx - 56, cy + 40, 112, 6); c.fillStyle = hsl(214, 70, 46); c.fillRect(cx - 56, cy + 46, 112, 10);
    for (const sx of [-1, 1]) shade(c, cx + sx * 20, cy - 100, 10, 14, [44, 85, 62], 0, 1.6);
    capeFriendFace(c, cx, cy - 70, 0.95);
  },
  concha: (c) => {
    shade(c, cx, cy, 84, 80, [36, 70, 70]);
    shade(c, cx, cy, 72, 68, [340, 72, 80], 0, 0);
    c.strokeStyle = hsl(36, 70, 62); c.lineWidth = 3.4;
    for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(cx, cy + 66); c.quadraticCurveTo(cx + i * 22, cy, cx + i * 14, cy - 66); c.stroke(); }
    for (let r = 20; r < 70; r += 16) { c.beginPath(); c.arc(cx, cy + 66, r + 30, -Math.PI * 0.85, -Math.PI * 0.15); c.stroke(); }
    // chef hat at the front
    shade(c, cx, cy - 86, 30, 20, [0, 0, 99]); for (const sx of [-1, 0, 1]) shade(c, cx + sx * 18, cy - 98, 14, 13, [0, 0, 99], 0, 1.6);
  },
  sushi: (c) => {
    shade(c, cx, cy, 82, 82, [160, 30, 18]);
    shade(c, cx, cy, 70, 70, [40, 30, 97], 0, 0);
    const r = (() => { let s = 9; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();
    for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = 44 + r() * 24; c.fillStyle = 'rgba(200,200,190,.6)'; c.beginPath(); c.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 4, 2.4, a, 0, Math.PI * 2); c.fill(); }
    shade(c, cx, cy, 44, 44, [14, 85, 62], 0, 0);
    dot(c, cx - 16, cy - 12, 14, hsl(130, 50, 46)); dot(c, cx + 18, cy + 10, 13, hsl(80, 50, 58));
    for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = r() * 40; dot(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3.4, hsl(24, 100, 58)); }
    capeFriendFace(c, cx, cy - 64, 0.8);
  },
};

export const TOP: Record<string, TopSpec> = {
  eagle: { fly: 'wings', wingAt: [-30, -14], beat: 1.6, riderY: 6, tips: [-170, 20] },
  pterodactyl: { fly: 'membrane', wingAt: [-26, -12], beat: 1.4, riderY: 8, tips: [-170, 10] },
  goose: { fly: 'wings', wingAt: [-30, -12], beat: 1.8, riderY: 10, tips: [-170, 20] },
  snowy_owl: { fly: 'wings', wingAt: [-36, -4], beat: 1.3, riderY: 20, tips: [-170, 20] },
  flamingo: { fly: 'wings', wingAt: [-30, -10], beat: 1.6, riderY: 10, tips: [-170, 20] },
  rubber_duck: { fly: 'wings', wingAt: [-40, -4], beat: 2.4, riderY: 14, riderS: 1.05, tips: [-120, 20] },
  bumblebee: { fly: 'bee', wingAt: [-26, -28], beat: 9, riderY: 4, tips: [-110, 10] },
  unicorn: { fly: 'wings', wingAt: [-28, -20], beat: 1.5, riderY: 12, tips: [-170, 20] },
  reindeer: { fly: 'cape', capeAt: -20, riderY: 10, tips: [-40, 90] },
  cloud_puppy: { fly: 'cape', capeAt: -24, riderY: 10, tips: [-60, 80] },
  snail: { fly: 'cape', capeAt: -14, riderY: 20, tips: [-50, 80] },
  teacup: { fly: 'cape', capeAt: -10, riderY: 4, riderS: 1.05, tips: [-90, 40] },
  airplane: { fly: 'prop', riderY: -30, riderS: 0.9, tips: [-106, -24] },
  pumpkin: { fly: 'cape', capeAt: -10, riderY: 4, tips: [-70, 60] },
  cowboy_cookie: { fly: 'cape', capeAt: -10, riderY: 8, tips: [-70, 60] },
  chili_poncho: { fly: 'cape', capeAt: -10, riderY: 0, tips: [-50, 90] },
  magic_carpet: { fly: 'carpet', riderY: 0, riderS: 1.05, tips: [-75, 109] },
  sky_jelly: { fly: 'jelly', riderY: -4, tips: [-48, 120] },
  strawberry: { fly: 'cape', capeAt: -20, riderY: 10, tips: [-60, 80] },
  tamale: { fly: 'cape', capeAt: -10, riderY: 10, tips: [-50, 100] },
  he_buddy: { fly: 'cape', capeAt: -10, riderY: 0, tips: [-56, 96] },
  concha: { fly: 'cape', capeAt: -10, riderY: 10, tips: [-70, 60] },
  sushi: { fly: 'cape', capeAt: -10, riderY: 8, tips: [-70, 60] },
};
const WINGCOL: Record<string, [HSL, HSL, HSL?]> = {
  eagle: [[25, 45, 32], [25, 40, 20]],
  goose: [[30, 15, 50], [30, 10, 30], [0, 0, 96]],
  snowy_owl: [[210, 10, 95], [210, 10, 84]],
  flamingo: [[345, 75, 72], [0, 0, 18]],
  rubber_duck: [[50, 100, 58], [46, 100, 52]],
  unicorn: [[280, 15, 97], [200, 70, 86], [330, 60, 90]],
};
export const topSpec = (id: string) => TOP[id] ?? TOP.eagle;
export const topKey = (id: string, look: Look) => `td_${TOP[id] ? id : 'eagle'}_${look.hat}_${look.outfit}_${look.scarf}_${look.back}_${look.feather ? 1 : 0}`;

function canvas(w: number, h: number, draw: (c: C) => void) {
  const cv = document.createElement('canvas'); cv.width = Math.ceil(w * R); cv.height = Math.ceil(h * R);
  const c = cv.getContext('2d')!; c.scale(R, R); c.lineCap = 'round'; c.lineJoin = 'round';
  draw(c);
  return cv;
}

/** Paint (once) the top-down textures for a mount + the rider's look. Returns the keys. */
export function paintTop(scene: Phaser.Scene, id: string, look: Look) {
  const spec = topSpec(id), mid = TOP[id] ? id : 'eagle';
  const key = topKey(id, look);
  const keys = { body: key, wing: `td_wing_${mid}`, cape: 'td_cape', prop: 'td_prop', carpet: [key, `${key}_r1`, `${key}_r2`] };
  if (!scene.textures.exists(key)) {
    const bodyCv = canvas(BW, BH, (c) => { BODY[mid](c); paintRider(c, cx, cy + spec.riderY, spec.riderS ?? 1, look); });
    uploadTex(scene, key, bodyCv);
    if (spec.fly === 'carpet') {
      // two more ripple frames: the rug waves in slices from front to back
      for (const [n, ph] of [[1, 2.1], [2, 4.2]] as const) {
        const cv = document.createElement('canvas'); cv.width = bodyCv.width; cv.height = bodyCv.height;
        const c = cv.getContext('2d')!; const sl = 8 * R;
        for (let y = 0; y < bodyCv.height; y += sl) { const k = y / bodyCv.height, dx = Math.sin(k * 7 + ph) * 5 * R * k, s = 1 + Math.sin(k * 7 + ph + 1) * 0.04 * k; c.drawImage(bodyCv, 0, y, bodyCv.width, sl, dx + (bodyCv.width * (1 - s)) / 2, y, bodyCv.width * s, sl); }
        uploadTex(scene, `${key}_r${n}`, cv);
      }
    }
  }
  if ((spec.fly === 'wings' || spec.fly === 'bee' || spec.fly === 'membrane') && !scene.textures.exists(keys.wing)) {
    uploadTex(scene, keys.wing, canvas(WW, WH, (c) => {
      if (spec.fly === 'bee') beeWing(c);
      else if (spec.fly === 'membrane') membraneWing(c, [168, 40, 50]);
      else { const w = WINGCOL[mid]; if (w) featherWing(c, w[0], w[1], 1, w[2]); else puffWing(c, [0, 0, 98]); }
    }));
  }
  if (spec.fly === 'cape' && !scene.textures.exists('td_cape0')) {
    for (let f = 0; f < 3; f++) uploadTex(scene, `td_cape${f}`, canvas(CAPE_TW, CAPE_TH, (c) => {
      // a white cape (tinted per mount) streaming back from the shoulders, its hem rippling
      const top = 10, w0 = 70, w1 = 96, L = CAPE_TH - 26;
      c.beginPath(); c.moveTo(CAPE_TW / 2 - w0 / 2, top);
      c.quadraticCurveTo(CAPE_TW / 2 - w1 + Math.sin(f * 2.1) * 8, L * 0.5, CAPE_TW / 2 - w1 + 6, top + L);
      for (let i = 0; i <= 6; i++) { const x = CAPE_TW / 2 - w1 + 6 + ((2 * w1 - 12) * i) / 6, y = top + L + Math.sin(i * 1.6 + f * 2.1) * 9; c.lineTo(x, y); }
      c.quadraticCurveTo(CAPE_TW / 2 + w1 - Math.sin(f * 2.1 + 1) * 8, L * 0.5, CAPE_TW / 2 + w0 / 2, top);
      c.closePath();
      const g = c.createLinearGradient(0, top, 0, top + L); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8d8d8');
      c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(60,60,60,.55)'; c.lineWidth = 2.4; c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 6;
      for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(CAPE_TW / 2 + k * w0 * 0.6, top + 16); c.quadraticCurveTo(CAPE_TW / 2 + k * w1 * 1.1 + Math.sin(f * 2 + k * 3) * 10, top + L * 0.6, CAPE_TW / 2 + k * w1 * 1.3, top + L - 6); c.stroke(); }
    }));
  }
  if (spec.fly === 'prop' && !scene.textures.exists(keys.prop)) {
    uploadTex(scene, keys.prop, canvas(110, 24, (c) => {
      const g = c.createLinearGradient(0, 0, 110, 0); g.addColorStop(0, 'rgba(90,70,60,0)'); g.addColorStop(0.2, 'rgba(90,70,60,.55)'); g.addColorStop(0.5, 'rgba(90,70,60,.25)'); g.addColorStop(0.8, 'rgba(90,70,60,.55)'); g.addColorStop(1, 'rgba(90,70,60,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(55, 12, 54, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(120,90,70,.95)'; c.beginPath(); c.ellipse(55, 12, 46, 5, 0, 0, Math.PI * 2); c.fill();
    }));
  }
  return keys;
}
export const capeTint = (id: string) => CAPE[id] ?? 0xd8402f;
export const TOP_IDS = Object.keys(TOP);
