// Hand-painted pterodactyl mount: body + wing frames (same layout as the eagle so Mount can
// swap art) plus a Call Mount icon and the egg treasure icon.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab, mulberry32, rr } from '../art';

/** Body: 130x70 world units, facing right. Rider sits near (58, 22). */
function paintPteroBody(c: Ctx, w: number, h: number) {
  const rng = mulberry32(421);
  const cy = h * 0.55;
  // Long tapering tail with a little diamond tip.
  for (let i = 0; i < 8; i++) {
    const x = 18 + i * 4, y = cy + 4 + Math.sin(i * 0.4) * 2;
    dab(c, x, y, 5.5 - i * 0.3, 2.4, 0.15, hsl(168, 28, 28 - i));
  }
  dab(c, 14, cy + 6, 5, 3.5, 0.2, hsl(165, 35, 38));
  // Hind legs tucked.
  for (const dx of [0, 10]) {
    dab(c, 48 + dx, cy + 16, 4, 3.2, 0.4, hsl(170, 25, 32));
    c.strokeStyle = hsl(30, 40, 20); c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(48 + dx, cy + 18); c.lineTo(46 + dx, cy + 24); c.stroke();
  }
  // Torso: dusty teal-green, lighter on the back.
  const g = c.createLinearGradient(0, cy - 18, 0, cy + 18);
  g.addColorStop(0, hsl(168, 32, 42)); g.addColorStop(0.55, hsl(170, 34, 30)); g.addColorStop(1, hsl(172, 36, 20));
  c.fillStyle = g;
  c.beginPath(); c.ellipse(62, cy, 34, 16, -0.06, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 70; i++) {
    const x = rr(rng, 36, 90), y = cy + rr(rng, -13, 13);
    const up = y < cy - 2;
    dab(c, x, y, rr(rng, 2.4, 4.2), rr(rng, 1.1, 1.9), -0.2, up ? hsl(165, 30, rr(rng, 44, 54), 0.65) : hsl(172, 34, rr(rng, 16, 24), 0.65));
  }
  // Soft belly.
  dab(c, 62, cy + 8, 22, 8, 0, hsl(40, 30, 72, 0.55));
  // Long neck into a head with a tall crest.
  for (let i = 0; i < 7; i++) dab(c, 88 + i * 2.2, cy - 6 - i * 1.4, 4.5, 3.2, 0.35, hsl(168, 30, 36 + i));
  // Head oval.
  const hg = c.createRadialGradient(108, cy - 18, 2, 108, cy - 14, 16);
  hg.addColorStop(0, hsl(165, 28, 48)); hg.addColorStop(1, hsl(170, 32, 30));
  c.fillStyle = hg;
  c.beginPath(); c.ellipse(108, cy - 16, 13, 10, -0.2, 0, Math.PI * 2); c.fill();
  // Crest sail.
  c.fillStyle = hsl(348, 55, 52);
  c.beginPath(); c.moveTo(100, cy - 24); c.quadraticCurveTo(108, cy - 42, 118, cy - 22); c.quadraticCurveTo(110, cy - 26, 100, cy - 24); c.fill();
  dab(c, 110, cy - 30, 4, 2, -0.4, hsl(350, 60, 68, 0.7));
  // Long pointed beak.
  c.fillStyle = hsl(42, 55, 62);
  c.beginPath(); c.moveTo(116, cy - 20); c.lineTo(142, cy - 14); c.lineTo(116, cy - 8); c.closePath(); c.fill();
  c.strokeStyle = hsl(30, 40, 35); c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(118, cy - 14); c.lineTo(136, cy - 13); c.stroke();
  // Friendly eye.
  dab(c, 112, cy - 18, 2.8, 2.8, 0, hsl(48, 90, 62));
  dab(c, 112.5, cy - 18, 1.6, 1.7, 0, hsl(220, 40, 12));
  dab(c, 113.2, cy - 18.8, 0.6, 0.6, 0, '#fff');
}

/** Wing pointing up; shoulder at bottom centre. Leathery membrane + finger bones. */
function paintPteroWing(c: Ctx, w: number, h: number, far: boolean) {
  const rng = mulberry32(far ? 91 : 92);
  const sx = w / 2, sy = h - 4;
  const dark = far ? -10 : 0;
  // Membrane fill (big sail).
  const g = c.createLinearGradient(sx - 22, 0, sx + 18, 0);
  g.addColorStop(0, hsl(168, 30, 22 + dark)); g.addColorStop(0.5, hsl(165, 28, 38 + dark)); g.addColorStop(1, hsl(160, 25, 48 + dark));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(sx - 6, sy);
  c.quadraticCurveTo(sx - 28, sy - 36, sx - 20, sy - 70);
  c.quadraticCurveTo(sx - 4, sy - 88, sx + 14, sy - 64);
  c.quadraticCurveTo(sx + 20, sy - 30, sx + 8, sy);
  c.closePath(); c.fill();
  c.strokeStyle = hsl(170, 35, 14, 0.9); c.lineWidth = 1.6; c.stroke();
  // Finger bone arcs.
  c.strokeStyle = hsl(40, 25, 55 + dark, 0.85); c.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    c.beginPath();
    c.moveTo(sx - 2, sy - 4);
    c.quadraticCurveTo(sx - 18 + t * 10, sy - 40 - t * 8, sx - 8 + t * 16, sy - 72 - t * 4);
    c.stroke();
  }
  // Finger tips.
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 - 0.35 + i * 0.18;
    c.save(); c.translate(sx - 4 + i * 3, sy - 68); c.rotate(a);
    dab(c, 10, 0, 10, 1.6, 0, hsl(40, 30, 50 + dark));
    c.restore();
  }
  // Soft speckles on the membrane.
  for (let i = 0; i < 18; i++) dab(c, sx + rr(rng, -16, 10), sy - rr(rng, 12, 70), 2, 1.4, 0, hsl(165, 20, rr(rng, 30, 50) + dark, 0.4));
}

function paintPteroIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2;
  // Wing hint.
  dab(c, cx - 10, cy + 4, 12, 6, -0.5, hsl(168, 30, 34));
  dab(c, cx + 8, cy + 2, 10, 5, 0.4, hsl(168, 28, 38));
  // Head + crest.
  dab(c, cx, cy - 2, 11, 9, -0.15, hsl(168, 30, 40));
  c.fillStyle = hsl(348, 55, 52);
  c.beginPath(); c.moveTo(cx - 4, cy - 10); c.quadraticCurveTo(cx + 2, cy - 22, cx + 10, cy - 8); c.fill();
  c.fillStyle = hsl(42, 55, 62);
  c.beginPath(); c.moveTo(cx + 6, cy - 4); c.lineTo(cx + 20, cy); c.lineTo(cx + 6, cy + 4); c.fill();
  dab(c, cx + 2, cy - 4, 2.4, 2.4, 0, hsl(48, 90, 62));
  dab(c, cx + 2.4, cy - 4, 1.3, 1.4, 0, hsl(220, 40, 12));
}

/** Speckled teal egg treasure. */
function paintPteroEgg(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 2;
  const g = c.createRadialGradient(cx - 4, cy - 8, 2, cx, cy, 18);
  g.addColorStop(0, hsl(165, 35, 72)); g.addColorStop(0.7, hsl(170, 32, 48)); g.addColorStop(1, hsl(172, 36, 32));
  c.fillStyle = g;
  c.beginPath(); c.ellipse(cx, cy, 14, 18, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(170, 30, 22); c.lineWidth = 1.4; c.stroke();
  const rng = mulberry32(55);
  for (let i = 0; i < 10; i++) dab(c, cx + rr(rng, -8, 8), cy + rr(rng, -12, 12), 2.2, 1.6, rr(rng, -0.4, 0.4), hsl(348, 50, 55, 0.7));
  dab(c, cx - 5, cy - 10, 4, 2.5, -0.3, hsl(50, 40, 90, 0.55));
}

export function paintPtero(scene: Phaser.Scene) {
  canvasTex(scene, 'ptero_body', 130, 70, (c) => paintPteroBody(c, 130, 70));
  canvasTex(scene, 'ptero_wing', 52, 100, (c) => paintPteroWing(c, 52, 100, false));
  canvasTex(scene, 'ptero_wing_far', 52, 100, (c) => paintPteroWing(c, 52, 100, true));
  canvasTex(scene, 'i_ptero', 48, 48, (c) => paintPteroIcon(c, 48), 2);
  canvasTex(scene, 'ic_ptero_egg', 48, 48, (c) => paintPteroEgg(c, 48), 2);
}
