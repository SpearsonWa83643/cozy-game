// Fall theme art: the Canada Goose mount (Fall's default mount; geese fly south in autumn),
// plus the maple-leaf theme icon and the little drifting maple-leaf particle.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab, mulberry32, rr } from '../art';

/** Body: 120x64 world units, facing right (same frame as the eagle so the rider sits the same). */
function paintGooseBody(c: Ctx, w: number, h: number) {
  const rng = mulberry32(4411);
  const cy = h * 0.54;
  // Short dark tail with a white band under it.
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i - 2) * 0.14;
    c.save(); c.translate(30, cy + 1); c.rotate(a);
    dab(c, 9, 0, 10, 4.2, 0, hsl(30, 12, 14 + Math.abs(i - 2) * 2));
    c.restore();
  }
  dab(c, 32, cy + 6, 7, 3.4, 0.2, hsl(40, 20, 95));
  // Orange-brown feet tucked under (cozy fall colour, not the real black, so they read on kids' screens).
  for (const dx of [0, 9]) dab(c, 52 + dx, cy + 15, 4.2, 2.8, 0.2, hsl(24, 30, 22));
  // Body: soft grey-brown back, pale cream breast, scalloped feather dabs.
  const g = c.createLinearGradient(0, cy - 16, 0, cy + 16);
  g.addColorStop(0, hsl(30, 22, 42)); g.addColorStop(0.55, hsl(32, 22, 56)); g.addColorStop(1, hsl(38, 30, 82));
  c.fillStyle = g;
  c.beginPath(); c.ellipse(58, cy, 32, 15, -0.04, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 80; i++) {
    const x = rr(rng, 32, 84), y = cy + rr(rng, -12, 8);
    const up = y < cy - 2;
    dab(c, x, y, rr(rng, 2.6, 4.2), rr(rng, 1.2, 1.9), -0.2 + rr(rng, -0.2, 0.2), up ? hsl(30, 18, rr(rng, 30, 40), 0.6) : hsl(34, 22, rr(rng, 62, 74), 0.55));
  }
  // Pale scallop edges on the back feathers.
  c.strokeStyle = hsl(36, 30, 78, 0.55); c.lineWidth = 1;
  for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(40 + i * 6.5, cy - 7 + (i % 2), 3.4, 0.2, Math.PI - 0.2); c.stroke(); }
  // Long black neck curving up to the head.
  c.strokeStyle = hsl(30, 10, 12); c.lineCap = 'round'; c.lineWidth = 9;
  c.beginPath(); c.moveTo(82, cy - 2); c.quadraticCurveTo(94, cy - 6, 98, cy - 20); c.stroke();
  // Black head.
  c.fillStyle = hsl(30, 10, 11);
  c.beginPath(); c.ellipse(101, cy - 23, 9, 6.6, -0.2, 0, Math.PI * 2); c.fill();
  // White chin strap (the goose's famous cheek patch).
  c.fillStyle = '#fbf8f0';
  c.beginPath(); c.ellipse(98.5, cy - 20.5, 4.6, 3, -0.6, 0, Math.PI * 2); c.fill();
  // Dark rounded beak.
  c.fillStyle = hsl(30, 8, 18);
  c.beginPath(); c.moveTo(108, cy - 26); c.quadraticCurveTo(117, cy - 25, 118, cy - 21); c.quadraticCurveTo(113, cy - 19, 108, cy - 20.5); c.closePath(); c.fill();
  // Friendly eye with a shine.
  dab(c, 104, cy - 25, 1.8, 1.9, 0, hsl(30, 40, 30));
  dab(c, 104.6, cy - 25.7, 0.6, 0.6, 0, '#fff');
  // A tiny orange maple leaf tucked behind the head, just for fun.
  leaf(c, 92, cy - 30, 5, 0.5, hsl(22, 90, 56), hsl(14, 70, 38));
}

/** One wing, painted pointing straight up; shoulder at the bottom centre. */
function paintGooseWing(c: Ctx, w: number, h: number, far: boolean) {
  const rng = mulberry32(far ? 91 : 92);
  const sx = w / 2, sy = h - 4;
  const dark = far ? -8 : 0;
  // Dark flight feathers at the tip.
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 - 0.4 + i * 0.11;
    const len = 44 + i * 3;
    c.save(); c.translate(sx - 6 + i * 1.5, sy - 40); c.rotate(a);
    dab(c, len * 0.5, 0, len * 0.5, 4.2, 0, hsl(30, 10, 18 + dark + i));
    c.restore();
  }
  const g = c.createLinearGradient(sx - 20, 0, sx + 20, 0);
  g.addColorStop(0, hsl(30, 18, 34 + dark)); g.addColorStop(0.6, hsl(32, 20, 46 + dark)); g.addColorStop(1, hsl(34, 22, 58 + dark));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(sx - 9, sy);
  c.quadraticCurveTo(sx - 24, sy - 30, sx - 18, sy - 58);
  c.quadraticCurveTo(sx - 6, sy - 72, sx + 8, sy - 60);
  c.quadraticCurveTo(sx + 18, sy - 34, sx + 10, sy);
  c.closePath(); c.fill();
  c.strokeStyle = hsl(30, 14, 18, 0.85); c.lineWidth = 1.5; c.stroke();
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i < 5; i++) {
      const y = sy - 8 - row * 11 - rr(rng, 0, 3);
      const x = sx - 10 + i * 5 + rr(rng, -1, 1) - row * 0.8;
      dab(c, x, y, 3.4, 5, -0.15, hsl(32, 20, rr(rng, 36, 54) + dark, 0.7));
    }
  }
  c.strokeStyle = hsl(38, 30, 80 + dark, 0.7); c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(sx + 9, sy - 4); c.quadraticCurveTo(sx + 16, sy - 34, sx + 6, sy - 60); c.stroke();
}

/** Call Mount icon: the goose's black head with its white chin strap. */
function paintGooseIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2;
  dab(c, cx - 6, cy + 12, 14, 7, -0.2, hsl(32, 22, 50));
  c.strokeStyle = hsl(30, 10, 12); c.lineCap = 'round'; c.lineWidth = 8;
  c.beginPath(); c.moveTo(cx - 6, cy + 10); c.quadraticCurveTo(cx - 4, cy, cx, cy - 4); c.stroke();
  c.fillStyle = hsl(30, 10, 11); c.beginPath(); c.ellipse(cx + 2, cy - 7, 11, 8, -0.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fbf8f0'; c.beginPath(); c.ellipse(cx - 1, cy - 3.5, 5.5, 3.6, -0.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = hsl(30, 8, 20);
  c.beginPath(); c.moveTo(cx + 11, cy - 11); c.quadraticCurveTo(cx + 21, cy - 10, cx + 21, cy - 5); c.quadraticCurveTo(cx + 16, cy - 3, cx + 11, cy - 4.5); c.closePath(); c.fill();
  dab(c, cx + 6, cy - 10, 2, 2, 0, hsl(30, 40, 30)); dab(c, cx + 6.6, cy - 10.8, 0.7, 0.7, 0, '#fff');
}

/** A simple 5-point maple leaf centred at (x, y), radius r. */
function leaf(c: Ctx, x: number, y: number, r: number, rot: number, fill: string, edge: string) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath();
  const pts = 5;
  for (let i = 0; i <= pts * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / pts;
    const rad = i % 2 === 0 ? r : r * 0.48;
    const px = Math.cos(a) * rad, py = Math.sin(a) * rad * (i % 2 === 0 && i > 2 && i < 8 ? 0.85 : 1);
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fillStyle = fill; c.fill();
  c.strokeStyle = edge; c.lineWidth = Math.max(0.6, r * 0.12); c.stroke();
  // Stem.
  c.beginPath(); c.moveTo(0, r * 0.3); c.lineTo(0, r * 1.15); c.stroke();
  c.restore();
}

/** Theme toggle icon: a big orange maple leaf. */
function paintMapleIcon(c: Ctx, w: number) {
  leaf(c, w / 2, w / 2 - 2, w * 0.4, 0.15, hsl(24, 92, 56), hsl(12, 70, 36));
  c.strokeStyle = hsl(14, 70, 40, 0.8); c.lineWidth = 1.2;
  for (const a of [-Math.PI / 2, -0.4, Math.PI + 0.4]) { c.beginPath(); c.moveTo(w / 2, w / 2); c.lineTo(w / 2 + Math.cos(a) * w * 0.3, w / 2 - 2 + Math.sin(a) * w * 0.3); c.stroke(); }
}

export function paintFallArt(scene: Phaser.Scene) {
  canvasTex(scene, 'goose_body', 120, 64, (c) => paintGooseBody(c, 120, 64));
  canvasTex(scene, 'goose_wing', 48, 96, (c) => paintGooseWing(c, 48, 96, false));
  canvasTex(scene, 'goose_wing_far', 48, 96, (c) => paintGooseWing(c, 48, 96, true));
  canvasTex(scene, 'i_goose', 48, 48, (c) => paintGooseIcon(c, 48), 2);
  canvasTex(scene, 'i_maple', 48, 48, (c) => paintMapleIcon(c, 48), 2);
  // Drifting leaf particle: painted white-ish so per-particle tints give red, orange and gold leaves.
  canvasTex(scene, 'p_maple', 12, 12, (c) => leaf(c, 6, 5.6, 5, 0, hsl(40, 60, 92), hsl(30, 40, 70)), 3);
}
