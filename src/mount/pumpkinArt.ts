// Hand-painted Halloween pumpkin mount: a round, friendly jack-o'-lantern with a curly vine and a warm glow,
// carried by little bat wings. Plus Call Mount icon and treasure (Magic Pumpkin Seed).
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab } from '../art';

function pumpkin(c: Ctx, cx: number, cy: number, rx: number, ry: number, face: boolean) {
  // Ribbed lobes, back to front.
  const lobes = [-0.75, 0.75, -0.4, 0.4, 0];
  for (const k of lobes) {
    const lx = cx + k * rx * 0.62, lw = rx * (0.5 - Math.abs(k) * 0.1);
    const g = c.createLinearGradient(lx - lw, cy - ry, lx + lw, cy + ry);
    g.addColorStop(0, hsl(32, 100, 64)); g.addColorStop(0.6, hsl(24, 95, 52)); g.addColorStop(1, hsl(18, 85, 38));
    c.fillStyle = g; c.beginPath(); c.ellipse(lx, cy, lw, ry, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hsl(18, 80, 32, 0.6); c.lineWidth = 1.1; c.stroke();
  }
  // Stem + curly vine + leaf.
  c.fillStyle = hsl(95, 40, 32);
  c.beginPath(); c.moveTo(cx - 3, cy - ry + 3); c.lineTo(cx - 1, cy - ry - 9); c.lineTo(cx + 5, cy - ry - 10); c.lineTo(cx + 4, cy - ry + 3); c.closePath(); c.fill();
  c.strokeStyle = hsl(100, 45, 38); c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(cx + 4, cy - ry - 6);
  c.bezierCurveTo(cx + 14, cy - ry - 16, cx + 20, cy - ry - 4, cx + 14, cy - ry - 2); c.stroke();
  dab(c, cx - 9, cy - ry - 4, 6, 3, -0.4, hsl(105, 45, 42));
  if (!face) return;
  // Friendly carved face with a warm glow.
  const glow = (pts: [number, number][]) => {
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    c.fillStyle = hsl(48, 100, 66); c.fill(); c.strokeStyle = hsl(30, 90, 40); c.lineWidth = 1; c.stroke();
  };
  const ex = rx * 0.3, ey = cy - ry * 0.2;
  glow([[cx + ex - 5, ey + 4], [cx + ex, ey - 6], [cx + ex + 5, ey + 4]]);
  glow([[cx + ex + 12, ey + 4], [cx + ex + 17, ey - 6], [cx + ex + 22, ey + 4]]);
  // Smile with one tooth.
  c.beginPath();
  c.moveTo(cx + ex - 6, cy + ry * 0.2);
  c.quadraticCurveTo(cx + ex + 8, cy + ry * 0.75, cx + ex + 24, cy + ry * 0.2);
  c.quadraticCurveTo(cx + ex + 8, cy + ry * 0.45, cx + ex - 6, cy + ry * 0.2);
  c.fillStyle = hsl(48, 100, 66); c.fill(); c.strokeStyle = hsl(30, 90, 40); c.lineWidth = 1; c.stroke();
  c.fillStyle = hsl(24, 95, 52); c.fillRect(cx + ex + 6, cy + ry * 0.28, 4, 4);
}

/** Body: 124x84, facing right. Rider sits on top around (60, 22). */
function paintPumpkinBody(c: Ctx, w: number, h: number) {
  const cx = 60, cy = h * 0.6;
  const halo = c.createRadialGradient(cx, cy, 6, cx, cy, 52);
  halo.addColorStop(0, 'rgba(255,190,90,0.35)'); halo.addColorStop(1, 'rgba(255,160,60,0)');
  c.fillStyle = halo; c.fillRect(0, 0, w, h);
  pumpkin(c, cx, cy, 44, 28, true);
  // Tiny sparkle stars.
  for (const [x, y] of [[16, 20], [108, 26], [100, 74]] as [number, number][]) dab(c, x, y, 1.6, 1.6, 0, hsl(50, 100, 80, 0.9));
}

/** Little bat wing pointing up. */
function paintBatWing(c: Ctx, w: number, h: number, far: boolean) {
  const sx = w / 2, sy = h - 4;
  const l = far ? 18 : 26;
  c.fillStyle = hsl(270, 30, l);
  c.beginPath(); c.moveTo(sx - 4, sy);
  c.quadraticCurveTo(sx - 20, sy - 40, sx - 6, sy - 74);
  c.quadraticCurveTo(sx + 2, sy - 62, sx + 4, sy - 66);
  c.quadraticCurveTo(sx + 8, sy - 50, sx + 14, sy - 52);
  c.quadraticCurveTo(sx + 14, sy - 34, sx + 20, sy - 30);
  c.quadraticCurveTo(sx + 10, sy - 14, sx + 4, sy); c.closePath(); c.fill();
  c.strokeStyle = hsl(270, 25, far ? 34 : 44); c.lineWidth = 1.3;
  c.beginPath(); c.moveTo(sx, sy - 2); c.lineTo(sx - 6, sy - 72); c.moveTo(sx, sy - 2); c.lineTo(sx + 4, sy - 64); c.moveTo(sx, sy - 2); c.lineTo(sx + 14, sy - 50); c.stroke();
  dab(c, sx - 2, sy - 30, 3, 10, 0.1, hsl(280, 40, far ? 26 : 40, 0.5));
}

function paintPumpkinIcon(c: Ctx, w: number) {
  pumpkin(c, w / 2 - 4, w / 2 + 5, 15, 11, false);
  const cx = w / 2 - 4, cy = w / 2 + 5;
  c.fillStyle = hsl(48, 100, 66);
  c.beginPath(); c.moveTo(cx - 6, cy); c.lineTo(cx - 3, cy - 5); c.lineTo(cx, cy); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(cx + 3, cy); c.lineTo(cx + 6, cy - 5); c.lineTo(cx + 9, cy); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(cx - 6, cy + 4); c.quadraticCurveTo(cx + 2, cy + 9, cx + 10, cy + 4); c.closePath(); c.fill();
}

/** Magic Pumpkin Seed treasure: a big glowing seed with sparkles. */
function paintPumpkinSeed(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 2;
  const halo = c.createRadialGradient(cx, cy, 2, cx, cy, 20);
  halo.addColorStop(0, 'rgba(255,190,90,0.8)'); halo.addColorStop(1, 'rgba(255,160,60,0)');
  c.fillStyle = halo; c.beginPath(); c.arc(cx, cy, 20, 0, Math.PI * 2); c.fill();
  c.fillStyle = hsl(44, 70, 86);
  c.beginPath(); c.moveTo(cx, cy - 15); c.bezierCurveTo(cx + 13, cy - 8, cx + 10, cy + 12, cx, cy + 15); c.bezierCurveTo(cx - 10, cy + 12, cx - 13, cy - 8, cx, cy - 15); c.fill();
  c.strokeStyle = hsl(34, 60, 54); c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.moveTo(cx, cy - 11); c.bezierCurveTo(cx + 7, cy - 5, cx + 6, cy + 9, cx, cy + 11); c.lineWidth = 1; c.stroke();
  dab(c, cx - 4, cy - 5, 2, 4, 0.3, 'rgba(255,255,255,0.8)');
  for (const [x, y] of [[cx - 15, cy - 12], [cx + 15, cy - 8], [cx + 13, cy + 14]] as [number, number][]) dab(c, x, y, 2, 2, 0, hsl(50, 100, 70));
}

export function paintPumpkinMount(scene: Phaser.Scene) {
  canvasTex(scene, 'pump_body', 124, 84, (c) => paintPumpkinBody(c, 124, 84));
  canvasTex(scene, 'pump_wing', 48, 96, (c) => paintBatWing(c, 48, 96, false));
  canvasTex(scene, 'pump_wing_far', 48, 96, (c) => paintBatWing(c, 48, 96, true));
  canvasTex(scene, 'i_pumpkin', 48, 48, (c) => paintPumpkinIcon(c, 48), 2);
  canvasTex(scene, 'ic_pumpkin_seed', 48, 48, (c) => paintPumpkinSeed(c, 48), 2);
}
