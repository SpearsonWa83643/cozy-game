// Wilderness art: cute monsters, portals, HUD icons. Painted once, on the first trip, into its
// own small atlas (atlas3) so the main game never pays for it in texture memory.
import Phaser from 'phaser';
import { Ctx, canvasTex, atlasTarget, buildAtlas, ATLAS, mulberry32, rr } from '../art';

export const ATLAS3 = 'atlas3';
const INK = '#3b2a22';
let painted = false;

function fo(c: Ctx, fill: string | CanvasGradient, lw = 2.4) {
  c.fillStyle = fill; c.fill();
  c.strokeStyle = INK; c.lineWidth = lw; c.stroke();
}
function eyes(c: Ctx, x: number, y: number, gap: number, r: number, happy = false) {
  for (const s of [-1, 1]) {
    c.beginPath(); c.ellipse(x + s * gap, y, r, r * 1.2, 0, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
    c.beginPath(); c.arc(x + s * gap - r * 0.3, y - r * 0.45, r * 0.38, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
  }
  c.strokeStyle = INK; c.lineWidth = 1.8;
  c.beginPath(); if (happy) c.arc(x, y + r * 1.4, r * 0.9, 0.15 * Math.PI, 0.85 * Math.PI); else { c.moveTo(x - 3, y + r * 2); c.quadraticCurveTo(x, y + r * 2.8, x + 3, y + r * 2); } c.stroke();
}
function blush(c: Ctx, x: number, y: number, gap: number) {
  c.fillStyle = 'rgba(255,120,140,0.45)';
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(x + s * gap, y, 4, 2.4, 0, 0, Math.PI * 2); c.fill(); }
}

/** A jelly slime. squash 0/1 for the bounce. */
function slime(c: Ctx, body: string, light: string, squash: number, hat: boolean) {
  const w = 64, h = 56, cx = w / 2, by = h - 6;
  const sx = squash ? 1.12 : 0.96, sy = squash ? 0.86 : 1.06;
  c.save(); c.translate(cx, by); c.scale(sx, sy);
  c.beginPath(); c.moveTo(-24, 0); c.bezierCurveTo(-27, -22, -13, -36, 0, -36); c.bezierCurveTo(13, -36, 27, -22, 24, 0); c.quadraticCurveTo(0, 5, -24, 0); c.closePath();
  const g = c.createLinearGradient(0, -36, 0, 0); g.addColorStop(0, light); g.addColorStop(1, body);
  fo(c, g, 2.8);
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(-11, -24, 4, 6.5, -0.5, 0, Math.PI * 2); c.fill();
  eyes(c, 0, -17, 7, 3.4, true); blush(c, 0, -11, 13);
  if (hat) {
    c.beginPath(); c.moveTo(-14, -33); c.lineTo(14, -33); c.lineTo(3, -54); c.quadraticCurveTo(8, -56, 11, -52); c.lineTo(4, -55); c.closePath(); fo(c, '#4a3a6a', 2.2);
    c.beginPath(); c.ellipse(0, -33, 17, 4, 0, 0, Math.PI * 2); fo(c, '#5a4880', 2.2);
    c.fillStyle = '#ffb347'; c.fillRect(-7, -38, 14, 3);
  }
  c.restore();
}
/** A round bramble critter: a leafy, thorny puff with stubby feet. */
function bramble(c: Ctx, body: string, light: string, leaf: string, step: number, pumpkin: boolean) {
  const w = 64, h = 60, cx = w / 2, cy = h - 26;
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 9 + (step ? s * 2 : 0), h - 6 - (step && s > 0 ? 2 : 0), 6, 4, 0, 0, Math.PI * 2); fo(c, '#6b4a30', 2); }
  if (pumpkin) {
    c.beginPath(); c.ellipse(cx, cy, 23, 19, 0, 0, Math.PI * 2);
    const g = c.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 24); g.addColorStop(0, light); g.addColorStop(1, body); fo(c, g, 2.8);
    c.strokeStyle = 'rgba(120,50,10,0.55)'; c.lineWidth = 1.8;
    for (const dx of [-9, 0, 9]) { c.beginPath(); c.ellipse(cx + dx, cy, 6, 18, 0, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(cx, cy - 18); c.quadraticCurveTo(cx + 2, cy - 27, cx + 7, cy - 28); c.lineWidth = 4; c.strokeStyle = '#4c6a2a'; c.stroke();
    c.beginPath(); c.ellipse(cx - 8, cy - 22, 7, 3.5, -0.5, 0, Math.PI * 2); fo(c, leaf, 1.6);
  } else {
    const rng = mulberry32(77);
    c.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2, rr2 = i % 2 ? 19 : 24 + rr(rng, -1, 1);
      const x = cx + Math.cos(a) * rr2, y = cy + Math.sin(a) * rr2 * 0.9;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
    const g = c.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 24); g.addColorStop(0, light); g.addColorStop(1, body); fo(c, g, 2.6);
    for (const [dx, dy, a] of [[-12, -18, -0.6], [10, -20, 0.5]] as const) { c.beginPath(); c.ellipse(cx + dx, cy + dy, 7, 3.6, a, 0, Math.PI * 2); fo(c, leaf, 1.6); }
    c.fillStyle = '#ff6b8a'; c.beginPath(); c.arc(cx + 15, cy - 9, 3.2, 0, Math.PI * 2); c.fill();
  }
  eyes(c, cx, cy - 1, 7, 3.2, true); blush(c, cx, cy + 6, 13);
}

function portal(c: Ctx) {
  const w = 120, h = 150, cx = w / 2;
  // Stone arch.
  c.beginPath(); c.moveTo(cx - 52, h - 6); c.lineTo(cx - 52, 62); c.arc(cx, 62, 52, Math.PI, 0); c.lineTo(cx + 52, h - 6);
  c.lineTo(cx + 34, h - 6); c.lineTo(cx + 34, 64); c.arc(cx, 64, 34, 0, Math.PI, true); c.lineTo(cx - 34, h - 6); c.closePath();
  const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#8b8f9a'); g.addColorStop(0.5, '#c6c9cf'); g.addColorStop(1, '#7c808a');
  fo(c, g, 3);
  c.strokeStyle = 'rgba(59,42,34,0.45)'; c.lineWidth = 1.8;
  for (const a of [0.15, 0.38, 0.62, 0.85]) { const t = Math.PI + a * Math.PI; c.beginPath(); c.moveTo(cx + Math.cos(t) * 34, 64 + Math.sin(t) * 34); c.lineTo(cx + Math.cos(t) * 52, 62 + Math.sin(t) * 52); c.stroke(); }
  for (const y of [92, 120]) for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * 34, y); c.lineTo(cx + s * 52, y); c.stroke(); }
  // Moss + a little star keystone.
  c.fillStyle = '#7bbf5a'; for (const [x, y] of [[cx - 48, 70], [cx + 44, 100], [cx - 20, 14]]) { c.beginPath(); c.ellipse(x, y, 8, 4, 0.3, 0, Math.PI * 2); c.fill(); }
  star(c, cx, 18, 9, '#ffd84a');
}
function star(c: Ctx, x: number, y: number, r: number, fill: string) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr2 = i % 2 ? r * 0.48 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  c.closePath(); fo(c, fill, 2);
}
function swirl(c: Ctx) {
  const cx = 40, cy = 40;
  const g = c.createRadialGradient(cx, cy, 2, cx, cy, 38); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(170,230,255,0.85)'); g.addColorStop(1, 'rgba(120,160,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 38, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 3;
  for (let k = 0; k < 3; k++) { c.beginPath(); for (let t = 0; t < 1; t += 0.05) { const a = k * 2.09 + t * 4.2, r = 4 + t * 30; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.stroke(); }
}
function home(c: Ctx) {
  c.beginPath(); c.moveTo(8, 30); c.lineTo(32, 9); c.lineTo(56, 30); c.lineTo(50, 30); c.lineTo(50, 54); c.lineTo(14, 54); c.lineTo(14, 30); c.closePath(); fo(c, '#fff4dd', 3.2);
  c.beginPath(); c.moveTo(4, 32); c.lineTo(32, 7); c.lineTo(60, 32); c.strokeStyle = '#d0573a'; c.lineWidth = 7; c.stroke();
  c.beginPath(); c.roundRect(26, 36, 12, 18, 3); fo(c, '#b07a4a', 2.4);
  c.fillStyle = '#ff7a9a'; c.beginPath(); c.moveTo(32, 30); c.bezierCurveTo(26, 24, 26, 19, 32, 22); c.bezierCurveTo(38, 19, 38, 24, 32, 30); c.fill();
}
function wand(c: Ctx) {
  c.save(); c.translate(32, 32); c.rotate(-0.7);
  c.beginPath(); c.roundRect(-4, -6, 8, 34, 4); fo(c, '#a8743f', 2.4);
  c.restore();
  star(c, 40, 20, 15, '#ffd84a');
  c.fillStyle = '#fff'; for (const [x, y] of [[14, 12], [54, 40], [22, 6]]) { c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill(); }
}
function swoosh(c: Ctx) {
  const cx = 60, cy = 60;
  for (let i = 0; i < 3; i++) {
    c.beginPath(); c.arc(cx, cy, 52 - i * 9, -Math.PI * 0.85, -Math.PI * 0.15);
    c.strokeStyle = `rgba(255,255,255,${0.9 - i * 0.25})`; c.lineWidth = 9 - i * 2; c.stroke();
  }
}
function trailSign(c: Ctx) {
  c.fillStyle = '#7a5434'; c.fillRect(27, 30, 7, 50); c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(27, 30, 7, 50);
  c.beginPath(); c.moveTo(4, 14); c.lineTo(48, 14); c.lineTo(58, 26); c.lineTo(48, 38); c.lineTo(4, 38); c.closePath(); fo(c, '#c99a62', 2.6);
  star(c, 18, 26, 7, '#ffd84a');
  c.fillStyle = '#4c7a3a'; for (const x of [32, 42]) { c.beginPath(); c.moveTo(x, 34); c.lineTo(x + 5, 20); c.lineTo(x + 10, 34); c.closePath(); c.fill(); }
}
/** Ground tile (standalone, repeats). */
function groundTile(c: Ctx, base: [number, number, number], seed: number) {
  const N = 128;
  c.fillStyle = `hsl(${base[0]},${base[1]}%,${base[2]}%)`; c.fillRect(0, 0, N, N);
  const rng = mulberry32(seed);
  for (let i = 0; i < 160; i++) {
    const x = rng() * N, y = rng() * N, l = base[2] + rr(rng, -6, 7);
    c.fillStyle = `hsla(${base[0] + rr(rng, -8, 8)},${base[1]}%,${l}%,0.55)`;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { c.beginPath(); c.ellipse(x + ox, y + oy, rr(rng, 3, 9), rr(rng, 2, 5), rng() * 3, 0, Math.PI * 2); c.fill(); }
  }
  c.strokeStyle = `hsla(${base[0]},${base[1] + 10}%,${base[2] - 12}%,0.7)`; c.lineWidth = 1.4;
  for (let i = 0; i < 40; i++) { const x = rng() * (N - 8) + 4, y = rng() * (N - 10) + 8; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 6); c.moveTo(x + 2, y); c.lineTo(x + 3, y - 5); c.stroke(); }
}

export function paintWildArt(scene: Phaser.Scene) {
  if (painted) return;
  painted = true;
  atlasTarget(ATLAS3);
  for (const f of [0, 1]) {
    canvasTex(scene, `m_slime_c${f}`, 64, 56, (c) => slime(c, '#4fc98a', '#b8f5c8', f, false));
    canvasTex(scene, `m_slime_h${f}`, 64, 60, (c) => { c.translate(0, 4); slime(c, '#9a6ad8', '#e4ccff', f, true); });
    canvasTex(scene, `m_bram_c${f}`, 64, 60, (c) => bramble(c, '#6a9a3a', '#b8e07a', '#4f8a32', f, false));
    canvasTex(scene, `m_bram_h${f}`, 64, 60, (c) => bramble(c, '#e8761e', '#ffc06a', '#4f8a32', f, true));
  }
  canvasTex(scene, 'w_portal', 120, 150, portal);
  canvasTex(scene, 'w_swirl', 80, 80, swirl);
  canvasTex(scene, 'w_home', 64, 60, home);
  canvasTex(scene, 'w_wand', 64, 64, wand);
  canvasTex(scene, 'w_swoosh', 120, 70, swoosh);
  canvasTex(scene, 'w_trail', 64, 82, trailSign);
  canvasTex(scene, 'w_star', 24, 24, (c) => star(c, 12, 12, 10, '#ffe27a'));
  atlasTarget(ATLAS);
  buildAtlas(scene, ATLAS3);
  canvasTex(scene, 'wg_classic', 128, 128, (c) => groundTile(c, [96, 42, 52], 5), 2, true);
  canvasTex(scene, 'wg_halloween', 128, 128, (c) => groundTile(c, [170, 22, 36], 6), 2, true);
  canvasTex(scene, 'wg_snow', 128, 128, (c) => groundTile(c, [206, 26, 88], 7), 2, true); // Christmas: soft blue-white snow
}
