// Christmas theme mount: a little flying Reindeer (Christmas's default mount) with a glowing red
// nose, a red harness and gold jingle bell, carried by frosty sparkle wings. Plus its Call Mount icon.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab, mulberry32, rr } from '../art';

/** Branching antler from (x, y), growing up and slightly back (dir = -1) or forward (dir = 1). */
function antler(c: Ctx, x: number, y: number, s: number, dir: number, light: number) {
  c.strokeStyle = hsl(32, 40, light); c.lineCap = 'round'; c.lineWidth = 2.6 * s;
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + dir * 3 * s, y - 7 * s, x + dir * 1 * s, y - 13 * s); c.stroke();
  c.lineWidth = 2 * s;
  for (const [t, len, a] of [[0.35, 5, 1], [0.65, 4.5, 1], [0.6, 4, -1]] as [number, number, number][]) {
    const bx = x + dir * 2.4 * s * t, by = y - 13 * s * t;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + a * dir * len * s, by - len * 0.8 * s); c.stroke();
  }
}

/** Body: 120x64 world units, facing right (same frame as the eagle so the rider sits the same). */
function paintReindeerBody(c: Ctx, w: number, h: number) {
  const rng = mulberry32(2512);
  const cy = h * 0.56;
  const fur = (l: number, a = 1) => hsl(26, 42, l, a);
  // Legs in a flying leap: hind legs stretched back, front legs tucked forward. Dark hooves.
  c.lineCap = 'round';
  for (const [x0, y0, x1, y1, x2, y2] of [[38, cy + 6, 26, cy + 12, 18, cy + 15], [44, cy + 8, 34, cy + 15, 27, cy + 19], [74, cy + 7, 84, cy + 13, 80, cy + 20], [80, cy + 6, 91, cy + 10, 88, cy + 17]]) {
    c.strokeStyle = fur(30); c.lineWidth = 5;
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x1, y1, x2, y2); c.stroke();
    dab(c, x2, y2, 2.6, 2, 0.3, hsl(24, 30, 14));
  }
  // Fluffy white tail.
  dab(c, 29, cy - 5, 6, 4.4, -0.5, hsl(36, 30, 96));
  // Body: warm brown with a creamy belly.
  const g = c.createLinearGradient(0, cy - 14, 0, cy + 13);
  g.addColorStop(0, fur(36)); g.addColorStop(0.6, fur(46)); g.addColorStop(1, hsl(34, 40, 78));
  c.fillStyle = g;
  c.beginPath(); c.ellipse(58, cy, 29, 13, -0.03, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 60; i++) {
    const x = rr(rng, 34, 82), y = cy + rr(rng, -10, 6);
    dab(c, x, y, rr(rng, 2.2, 3.6), rr(rng, 1, 1.6), -0.3, y < cy - 2 ? fur(rr(rng, 30, 38), 0.55) : fur(rr(rng, 48, 58), 0.5));
  }
  // Neck up to the head.
  c.fillStyle = fur(42);
  c.beginPath(); c.moveTo(76, cy - 9); c.quadraticCurveTo(88, cy - 14, 92, cy - 22); c.lineTo(100, cy - 17); c.quadraticCurveTo(92, cy - 2, 82, cy + 4); c.closePath(); c.fill();
  dab(c, 88, cy - 6, 5, 7, -0.6, hsl(34, 40, 82, 0.9)); // creamy chest
  // Antlers behind the head.
  antler(c, 93, cy - 27, 1.15, -1, 52);
  antler(c, 99, cy - 27, 1.15, 1, 60);
  // Head with a soft muzzle.
  c.fillStyle = fur(44);
  c.beginPath(); c.ellipse(99, cy - 22, 9, 7, 0.15, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(107, cy - 18.5, 6.4, 4.8, 0.25, 0, Math.PI * 2); c.fill();
  dab(c, 106, cy - 16, 4.6, 2.6, 0.2, hsl(34, 40, 80, 0.9));
  // Ears.
  dab(c, 91.5, cy - 26, 4.6, 2, -0.6, fur(36));
  dab(c, 91.8, cy - 26, 2.6, 1, -0.6, hsl(350, 50, 76));
  // Glowing red nose.
  dab(c, 113, cy - 20, 6, 6, 0, hsl(0, 100, 60, 0.3));
  dab(c, 113, cy - 20, 3.3, 3, 0, hsl(0, 90, 52));
  dab(c, 112.2, cy - 21, 1, 0.9, 0, '#fff');
  // Happy closed-smile eye and a rosy cheek.
  c.strokeStyle = hsl(24, 40, 12); c.lineWidth = 1.5;
  c.beginPath(); c.arc(101, cy - 23, 2.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  dab(c, 103, cy - 18.5, 2.2, 1.4, 0, hsl(350, 80, 70, 0.6));
  // Red harness strap round the chest with a big gold jingle bell.
  c.strokeStyle = hsl(356, 72, 44); c.lineWidth = 4;
  c.beginPath(); c.moveTo(78, cy - 11); c.quadraticCurveTo(84, cy - 2, 81, cy + 8); c.stroke();
  c.strokeStyle = hsl(46, 90, 62); c.lineWidth = 1;
  for (let i = 0; i < 4; i++) dab(c, 79.5 + i * 0.8, cy - 8 + i * 4.6, 0.9, 0.9, 0, hsl(46, 90, 66));
  dab(c, 84, cy + 2, 4, 4, 0, hsl(44, 90, 52));
  dab(c, 83, cy + 0.8, 1.4, 1.2, 0, hsl(50, 100, 88));
  c.fillStyle = hsl(36, 70, 26); c.fillRect(82.6, cy + 3.2, 2.8, 1.1);
  // Red saddle blanket with a white fluffy trim under the rider.
  c.fillStyle = hsl(356, 70, 46);
  c.beginPath(); c.moveTo(48, cy - 12); c.quadraticCurveTo(60, cy - 15, 70, cy - 12); c.lineTo(68, cy - 1); c.quadraticCurveTo(58, cy + 2, 50, cy - 1); c.closePath(); c.fill();
  c.strokeStyle = hsl(0, 0, 98); c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(50, cy - 1); c.quadraticCurveTo(58, cy + 2, 68, cy - 1); c.stroke();
}

/** One frosty sparkle wing, painted pointing straight up; shoulder at the bottom centre. */
function paintFrostWing(c: Ctx, w: number, h: number, far: boolean) {
  const rng = mulberry32(far ? 2513 : 2514);
  const sx = w / 2, sy = h - 4, dk = far ? -10 : 0;
  // Long feathers fanning out, icy blue to white.
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 - 0.36 + i * 0.13, len = 42 + (i % 3) * 6 + i * 2;
    c.save(); c.translate(sx - 4 + i * 1.6, sy - 22); c.rotate(a);
    dab(c, len * 0.5, 0, len * 0.5, 5, 0, hsl(200, 60, 82 + dk - i, 0.9));
    dab(c, len * 0.55, -1, len * 0.4, 1.6, 0, hsl(200, 60, 96 + dk, 0.8));
    c.restore();
  }
  // Soft inner shoulder.
  c.fillStyle = hsl(205, 50, 90 + dk, 0.95);
  c.beginPath(); c.moveTo(sx - 9, sy); c.quadraticCurveTo(sx - 16, sy - 26, sx - 6, sy - 40); c.quadraticCurveTo(sx + 10, sy - 36, sx + 10, sy); c.closePath(); c.fill();
  c.strokeStyle = hsl(205, 40, 70 + dk, 0.8); c.lineWidth = 1.2; c.stroke();
  // Gold and white sparkles.
  for (let i = 0; i < 10; i++) {
    const x = sx + rr(rng, -14, 14), y = sy - rr(rng, 10, 76);
    const r = rr(rng, 1, 2.3), col = rng() < 0.5 ? hsl(46, 100, 70) : '#fff';
    c.strokeStyle = col; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(x - r * 1.6, y); c.lineTo(x + r * 1.6, y); c.moveTo(x, y - r * 1.6); c.lineTo(x, y + r * 1.6); c.stroke();
  }
}

/** Call Mount icon: the reindeer's face with antlers and its glowing red nose. */
function paintReindeerIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 5;
  antler(c, cx - 8, cy - 9, 1.2, -1, 52);
  antler(c, cx + 8, cy - 9, 1.2, 1, 58);
  dab(c, cx - 13, cy - 5, 5, 2.4, -0.5, hsl(26, 42, 36));
  dab(c, cx + 13, cy - 5, 5, 2.4, 0.5, hsl(26, 42, 36));
  c.fillStyle = hsl(26, 42, 44); c.beginPath(); c.ellipse(cx, cy, 11, 10, 0, 0, Math.PI * 2); c.fill();
  dab(c, cx, cy + 6, 7, 5, 0, hsl(34, 40, 80));
  c.strokeStyle = hsl(24, 40, 12); c.lineWidth = 1.6;
  for (const ex of [-5, 5]) { c.beginPath(); c.arc(cx + ex, cy - 1, 2.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  dab(c, cx, cy + 4, 6.5, 6, 0, hsl(0, 100, 60, 0.3));
  dab(c, cx, cy + 4, 4, 3.6, 0, hsl(0, 90, 52));
  dab(c, cx - 1.2, cy + 2.8, 1.2, 1, 0, '#fff');
}

export function paintReindeer(scene: Phaser.Scene) {
  canvasTex(scene, 'deer_body', 120, 64, (c) => paintReindeerBody(c, 120, 64));
  canvasTex(scene, 'deer_wing', 48, 96, (c) => paintFrostWing(c, 48, 96, false));
  canvasTex(scene, 'deer_wing_far', 48, 96, (c) => paintFrostWing(c, 48, 96, true));
  canvasTex(scene, 'i_reindeer', 48, 48, (c) => paintReindeerIcon(c, 48), 2);
}
