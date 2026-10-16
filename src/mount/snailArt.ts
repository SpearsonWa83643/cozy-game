// Hand-painted lantern-shell snail mount: soft green snail whose spiral shell glows like a paper lantern,
// carried by little leaf wings. Plus Call Mount icon and treasure (Glow Pearl).
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab, mulberry32, rr } from '../art';

const INK = 'hsl(150, 30%, 16%)';

function lanternShell(c: Ctx, x: number, y: number, r: number) {
  // Warm glow halo.
  const halo = c.createRadialGradient(x, y, r * 0.2, x, y, r * 1.5);
  halo.addColorStop(0, 'rgba(255,220,120,0.55)'); halo.addColorStop(1, 'rgba(255,200,90,0)');
  c.fillStyle = halo; c.beginPath(); c.arc(x, y, r * 1.5, 0, Math.PI * 2); c.fill();
  // Shell body.
  const g = c.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, hsl(50, 100, 88)); g.addColorStop(0.55, hsl(38, 100, 66)); g.addColorStop(1, hsl(18, 85, 48));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(18, 70, 32, 0.9); c.lineWidth = 1.6; c.stroke();
  // Spiral line.
  c.strokeStyle = hsl(20, 70, 36, 0.85); c.lineWidth = 1.8;
  c.beginPath();
  for (let t = 0; t <= 1; t += 0.02) { const a = t * Math.PI * 4.2, rad = r * (0.9 - 0.82 * t); const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; if (t) c.lineTo(px, py); else c.moveTo(px, py); }
  c.stroke();
  // Lantern ribs + little cap and tassel.
  c.strokeStyle = 'rgba(160,70,30,0.35)'; c.lineWidth = 1;
  for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.ellipse(x, y, r * Math.abs(Math.cos(k * 1.4)) * 0.95 + 0.5, r * 0.98, 0, 0, Math.PI * 2); c.stroke(); }
  dab(c, x, y - r - 2, r * 0.35, 3, 0, hsl(350, 60, 40));
  dab(c, x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.12, -0.6, 'rgba(255,255,255,0.7)');
}

/** Body: 128x84, facing right. Rider sits on the shell top around (56, 22). */
function paintSnailBody(c: Ctx, w: number, h: number) {
  const rng = mulberry32(9090);
  const by = h * 0.78;
  // Foot / body.
  const g = c.createLinearGradient(0, by - 14, 0, by + 8);
  g.addColorStop(0, hsl(110, 50, 70)); g.addColorStop(1, hsl(120, 40, 50));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(12, by + 6);
  c.quadraticCurveTo(10, by - 4, 30, by - 6);
  c.lineTo(92, by - 8);
  c.quadraticCurveTo(104, by - 30, 112, by - 34);
  c.quadraticCurveTo(124, by - 30, 120, by - 14);
  c.quadraticCurveTo(116, by + 4, 96, by + 6);
  c.closePath(); c.fill();
  c.strokeStyle = hsl(130, 30, 34, 0.8); c.lineWidth = 1.4; c.stroke();
  for (let i = 0; i < 24; i++) dab(c, rr(rng, 20, 112), by + rr(rng, -6, 3), rr(rng, 1, 2), rr(rng, 1, 2), 0, hsl(100, 60, 82, 0.5));
  // Eye stalks with glowing tips.
  c.strokeStyle = hsl(115, 45, 58); c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(112, by - 32); c.quadraticCurveTo(112, by - 44, 108, by - 50); c.stroke();
  c.beginPath(); c.moveTo(116, by - 30); c.quadraticCurveTo(122, by - 42, 124, by - 48); c.stroke();
  for (const [ex, ey] of [[108, by - 52], [124, by - 50]] as [number, number][]) {
    dab(c, ex, ey, 4.4, 4.4, 0, '#fff'); dab(c, ex + 1, ey + 0.5, 2.4, 2.6, 0, INK); dab(c, ex + 1.6, ey - 0.6, 0.8, 0.8, 0, '#fff');
  }
  // Smile + blush.
  c.strokeStyle = INK; c.lineWidth = 1.4;
  c.beginPath(); c.arc(116, by - 22, 3.6, 0.3, Math.PI - 0.4); c.stroke();
  dab(c, 110, by - 20, 3, 1.8, 0, hsl(345, 80, 75, 0.8));
  // The lantern shell.
  lanternShell(c, 58, by - 30, 28);
}

/** Leaf-shaped wing pointing up. */
function paintSnailWing(c: Ctx, w: number, h: number, far: boolean) {
  const sx = w / 2, sy = h - 4;
  const l = far ? 52 : 62;
  const g = c.createLinearGradient(sx - 16, 0, sx + 16, 0);
  g.addColorStop(0, hsl(95, 55, l - 8)); g.addColorStop(1, hsl(80, 65, l + 8));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(sx, sy);
  c.bezierCurveTo(sx - 26, sy - 26, sx - 16, sy - 64, sx + 2, sy - 76);
  c.bezierCurveTo(sx + 18, sy - 60, sx + 22, sy - 24, sx, sy); c.closePath(); c.fill();
  c.strokeStyle = hsl(110, 40, far ? 30 : 36); c.lineWidth = 1.4; c.stroke();
  c.lineWidth = 1.2; c.beginPath(); c.moveTo(sx, sy - 2); c.quadraticCurveTo(sx - 2, sy - 40, sx + 2, sy - 72); c.stroke();
  for (let i = 1; i < 5; i++) { const y = sy - i * 14; c.beginPath(); c.moveTo(sx - 1, y); c.lineTo(sx - 10, y - 8); c.moveTo(sx, y); c.lineTo(sx + 9, y - 8); c.stroke(); }
}

function paintSnailIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 4;
  c.fillStyle = hsl(115, 50, 62);
  c.beginPath(); c.ellipse(cx + 2, cy + 9, 18, 5, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(115, 45, 52); c.lineWidth = 2.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx + 15, cy + 6); c.lineTo(cx + 17, cy - 6); c.stroke();
  dab(c, cx + 17, cy - 7, 2.4, 2.4, 0, INK);
  lanternShell(c, cx - 3, cy - 2, 12);
}

/** Glow Pearl treasure: a softly glowing amber pearl in a little shell. */
function paintGlowPearl(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 3;
  c.fillStyle = hsl(25, 60, 80);
  c.beginPath(); c.moveTo(cx - 18, cy + 4); c.quadraticCurveTo(cx, cy + 20, cx + 18, cy + 4); c.closePath(); c.fill();
  c.strokeStyle = hsl(20, 50, 55); c.lineWidth = 1.4; c.stroke();
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(cx + i * 6, cy + 5); c.lineTo(cx + i * 3, cy + 13); c.stroke(); }
  const halo = c.createRadialGradient(cx, cy - 4, 2, cx, cy - 4, 18);
  halo.addColorStop(0, 'rgba(255,225,130,0.9)'); halo.addColorStop(1, 'rgba(255,200,90,0)');
  c.fillStyle = halo; c.beginPath(); c.arc(cx, cy - 4, 18, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(cx - 3, cy - 8, 1, cx, cy - 4, 10);
  g.addColorStop(0, '#fffbe6'); g.addColorStop(1, hsl(40, 100, 62));
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy - 4, 9, 0, Math.PI * 2); c.fill();
  dab(c, cx - 3, cy - 8, 2.4, 1.6, -0.4, '#fff');
}

export function paintSnail(scene: Phaser.Scene) {
  canvasTex(scene, 'snail_body', 128, 84, (c) => paintSnailBody(c, 128, 84));
  canvasTex(scene, 'snail_wing', 48, 96, (c) => paintSnailWing(c, 48, 96, false));
  canvasTex(scene, 'snail_wing_far', 48, 96, (c) => paintSnailWing(c, 48, 96, true));
  canvasTex(scene, 'i_snail', 48, 48, (c) => paintSnailIcon(c, 48), 2);
  canvasTex(scene, 'ic_glow_pearl', 48, 48, (c) => paintGlowPearl(c, 48), 2);
}
