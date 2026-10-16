// Hand-painted flying teacup mount: a big porcelain teacup with a saucer, rosy pattern, steam curls,
// and little cloud-white wings. Plus Call Mount icon and treasure (Sugar Cube).
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab } from '../art';

/** Body: 124x84, facing right. The rider sits inside the cup around (60, 30). */
function paintTeacupBody(c: Ctx, w: number, h: number) {
  const cx = 60, rimY = h * 0.42, botY = h * 0.82;
  // Saucer.
  const sg = c.createLinearGradient(0, botY - 4, 0, botY + 8);
  sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, hsl(200, 25, 82));
  c.fillStyle = sg; c.beginPath(); c.ellipse(cx, botY + 2, 50, 8, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(200, 40, 60); c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = hsl(205, 70, 62); c.lineWidth = 2; c.beginPath(); c.ellipse(cx, botY + 2, 44, 5.5, 0, 0, Math.PI * 2); c.stroke();
  // Handle (on the back side, left).
  c.strokeStyle = '#fff'; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.arc(cx - 40, rimY + 18, 11, Math.PI * 0.45, Math.PI * 1.55); c.stroke();
  c.strokeStyle = hsl(200, 40, 60); c.lineWidth = 1.2;
  c.beginPath(); c.arc(cx - 40, rimY + 18, 14.5, Math.PI * 0.45, Math.PI * 1.55); c.stroke();
  // Cup body.
  const g = c.createLinearGradient(cx - 38, 0, cx + 38, 0);
  g.addColorStop(0, hsl(200, 25, 86)); g.addColorStop(0.35, '#ffffff'); g.addColorStop(1, hsl(205, 25, 80));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(cx - 38, rimY);
  c.bezierCurveTo(cx - 38, rimY + 30, cx - 22, botY, cx, botY);
  c.bezierCurveTo(cx + 22, botY, cx + 38, rimY + 30, cx + 38, rimY);
  c.closePath(); c.fill();
  c.strokeStyle = hsl(200, 40, 60); c.lineWidth = 1.4; c.stroke();
  // Blue band + pink roses.
  c.strokeStyle = hsl(205, 70, 62); c.lineWidth = 3;
  c.beginPath(); c.moveTo(cx - 36, rimY + 8); c.quadraticCurveTo(cx, rimY + 14, cx + 36, rimY + 8); c.stroke();
  for (const [rx, ry] of [[cx - 18, rimY + 24], [cx + 6, rimY + 27], [cx + 26, rimY + 20]] as [number, number][]) {
    dab(c, rx, ry, 5, 4.4, 0, hsl(345, 75, 74)); dab(c, rx, ry, 2.4, 2.1, 0, hsl(345, 70, 60));
    dab(c, rx - 6, ry + 2, 3, 1.6, -0.5, hsl(120, 45, 55)); dab(c, rx + 6, ry + 2, 3, 1.6, 0.5, hsl(120, 45, 55));
  }
  // Rim and the tea inside.
  c.fillStyle = hsl(28, 60, 42); c.beginPath(); c.ellipse(cx, rimY, 36, 6.5, 0, 0, Math.PI * 2); c.fill();
  dab(c, cx - 10, rimY - 1.5, 10, 2, 0, hsl(30, 60, 60, 0.7));
  c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, rimY, 37.5, 7.5, 0, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = hsl(46, 90, 58); c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx, rimY, 39.5, 8.8, 0, 0, Math.PI * 2); c.stroke();
  // Shine.
  dab(c, cx - 24, rimY + 22, 3, 10, 0.25, 'rgba(255,255,255,0.8)');
  // Steam curls (front, right).
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2.2;
  for (const sx of [cx + 30, cx + 40]) { c.beginPath(); c.moveTo(sx, rimY - 6); c.bezierCurveTo(sx + 6, rimY - 14, sx - 6, rimY - 20, sx + 2, rimY - 28); c.stroke(); }
  // Sweet face on the cup.
  dab(c, cx + 14, rimY + 34, 2.4, 2.8, 0, hsl(220, 40, 20)); dab(c, cx + 28, rimY + 30, 2.2, 2.6, 0, hsl(220, 40, 20));
  c.strokeStyle = hsl(220, 40, 20); c.lineWidth = 1.4; c.beginPath(); c.arc(cx + 21, rimY + 35, 3.6, 0.3, Math.PI - 0.3); c.stroke();
}

/** Small fluffy white wing pointing up. */
function paintTeacupWing(c: Ctx, w: number, h: number, far: boolean) {
  const sx = w / 2, sy = h - 4;
  const shade = far ? 86 : 97;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 - 0.36 + i * 0.16;
    c.save(); c.translate(sx, sy - 22); c.rotate(a);
    dab(c, 22 + i * 1.5, 0, 22 + i * 1.5, 5.4, 0, hsl(200, 30, shade - i * 1.5));
    c.restore();
  }
  c.fillStyle = hsl(200, 30, shade);
  c.beginPath(); c.ellipse(sx, sy - 18, 12, 20, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(205, 30, far ? 62 : 70, 0.9); c.lineWidth = 1.2; c.stroke();
}

function paintTeacupIcon(c: Ctx, w: number) {
  const cx = w / 2 - 1, cy = w / 2;
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx, cy + 14, 19, 4, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(200, 40, 60); c.lineWidth = 1; c.stroke();
  c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.arc(cx + 15, cy + 2, 6, -Math.PI * 0.55, Math.PI * 0.55); c.stroke();
  c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(cx - 15, cy - 6); c.bezierCurveTo(cx - 15, cy + 8, cx - 8, cy + 13, cx, cy + 13); c.bezierCurveTo(cx + 8, cy + 13, cx + 15, cy + 8, cx + 15, cy - 6); c.closePath(); c.fill();
  c.strokeStyle = hsl(200, 40, 60); c.lineWidth = 1.2; c.stroke();
  c.fillStyle = hsl(28, 60, 42); c.beginPath(); c.ellipse(cx, cy - 6, 14, 3, 0, 0, Math.PI * 2); c.fill();
  dab(c, cx - 4, cy + 3, 3.4, 3, 0, hsl(345, 75, 70)); dab(c, cx + 5, cy + 5, 2.6, 2.4, 0, hsl(345, 75, 70));
  c.strokeStyle = hsl(205, 70, 62); c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx - 14, cy - 2); c.quadraticCurveTo(cx, cy + 1, cx + 14, cy - 2); c.stroke();
}

/** Sugar Cube treasure: a sparkly sugar cube. */
function paintSugarCube(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 2, s = 13;
  c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(cx - s, cy - s * 0.4); c.lineTo(cx, cy - s); c.lineTo(cx + s, cy - s * 0.4); c.lineTo(cx, cy + s * 0.2); c.closePath(); c.fill();
  c.fillStyle = hsl(210, 25, 90); c.beginPath(); c.moveTo(cx - s, cy - s * 0.4); c.lineTo(cx, cy + s * 0.2); c.lineTo(cx, cy + s * 1.2); c.lineTo(cx - s, cy + s * 0.6); c.closePath(); c.fill();
  c.fillStyle = hsl(210, 25, 82); c.beginPath(); c.moveTo(cx + s, cy - s * 0.4); c.lineTo(cx, cy + s * 0.2); c.lineTo(cx, cy + s * 1.2); c.lineTo(cx + s, cy + s * 0.6); c.closePath(); c.fill();
  c.strokeStyle = hsl(210, 30, 62); c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(cx - s, cy - s * 0.4); c.lineTo(cx, cy - s); c.lineTo(cx + s, cy - s * 0.4); c.lineTo(cx + s, cy + s * 0.6); c.lineTo(cx, cy + s * 1.2); c.lineTo(cx - s, cy + s * 0.6); c.closePath(); c.stroke();
  c.beginPath(); c.moveTo(cx - s, cy - s * 0.4); c.lineTo(cx, cy + s * 0.2); c.lineTo(cx + s, cy - s * 0.4); c.moveTo(cx, cy + s * 0.2); c.lineTo(cx, cy + s * 1.2); c.stroke();
  // Sparkles.
  for (const [x, y, r] of [[cx - 15, cy - 14, 3], [cx + 15, cy - 12, 2.4], [cx + 12, cy + 14, 2]] as [number, number, number][]) {
    c.fillStyle = hsl(48, 100, 66);
    c.beginPath(); c.moveTo(x, y - r * 2); c.lineTo(x + r * 0.5, y - r * 0.5); c.lineTo(x + r * 2, y); c.lineTo(x + r * 0.5, y + r * 0.5); c.lineTo(x, y + r * 2); c.lineTo(x - r * 0.5, y + r * 0.5); c.lineTo(x - r * 2, y); c.lineTo(x - r * 0.5, y - r * 0.5); c.closePath(); c.fill();
  }
}

export function paintTeacup(scene: Phaser.Scene) {
  canvasTex(scene, 'cup_body', 124, 84, (c) => paintTeacupBody(c, 124, 84));
  canvasTex(scene, 'cup_wing', 48, 96, (c) => paintTeacupWing(c, 48, 96, false));
  canvasTex(scene, 'cup_wing_far', 48, 96, (c) => paintTeacupWing(c, 48, 96, true));
  canvasTex(scene, 'i_teacup', 48, 48, (c) => paintTeacupIcon(c, 48), 2);
  canvasTex(scene, 'ic_sugar_cube', 48, 48, (c) => paintSugarCube(c, 48), 2);
}
