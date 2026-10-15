// Hand-painted bald eagle for the mount: a body frame (facing right) and one wing frame that
// is squashed and turned in code every frame, so the flap is smooth instead of flip-book.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab, mulberry32, rr } from '../art';

/** Body: 120x64 world units, facing right. Back (where the rider sits) at about (52, 20). */
function paintEagleBody(c: Ctx, w: number, h: number) {
  const rng = mulberry32(913);
  const cy = h * 0.52;
  // Tail fan (white, bald eagle style) at the left.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i - 3) * 0.13;
    const len = 30 + (3 - Math.abs(i - 3)) * 2;
    c.save(); c.translate(30, cy + 2); c.rotate(a);
    dab(c, len * 0.55, 0, len * 0.55, 4.6, 0, hsl(40, 25, 86 - Math.abs(i - 3) * 2));
    dab(c, len * 0.55, -1.2, len * 0.45, 1.4, 0, hsl(40, 30, 97, 0.8));
    c.restore();
  }
  // Talons tucked under the belly.
  for (const dx of [0, 9]) {
    dab(c, 52 + dx, cy + 15, 4.4, 3.4, 0.3, hsl(44, 85, 52));
    c.strokeStyle = hsl(30, 30, 18); c.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(53 + dx + k * 2 - 2, cy + 17); c.quadraticCurveTo(54 + dx + k * 2, cy + 21, 51 + dx + k * 2, cy + 21.5); c.stroke(); }
  }
  // Body: dark chocolate, lighter on the back, layered feather dabs.
  const g = c.createLinearGradient(0, cy - 16, 0, cy + 16);
  g.addColorStop(0, hsl(26, 38, 34)); g.addColorStop(0.6, hsl(24, 42, 24)); g.addColorStop(1, hsl(22, 40, 17));
  c.fillStyle = g;
  c.beginPath(); c.ellipse(58, cy, 32, 15, -0.04, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 90; i++) {
    const x = rr(rng, 32, 84), y = cy + rr(rng, -12, 12);
    const up = y < cy - 3;
    dab(c, x, y, rr(rng, 2.6, 4.6), rr(rng, 1.2, 2), -0.25 + rr(rng, -0.2, 0.2), up ? hsl(28, 40, rr(rng, 36, 46), 0.7) : hsl(22, 40, rr(rng, 14, 22), 0.7));
  }
  // Belly feather fringe.
  for (let i = 0; i < 8; i++) dab(c, 40 + i * 6, cy + 12 + Math.sin(i) * 1.2, 3.6, 2.2, 0.4, hsl(22, 38, 15, 0.9));
  // Neck ruff then the white head.
  for (let i = 0; i < 9; i++) dab(c, 84 + rr(rng, -2, 4), cy - 8 + i * 2, 4.2, 2.4, 0.5, hsl(40, 25, rr(rng, 88, 96)));
  const hg = c.createRadialGradient(96, cy - 14, 2, 96, cy - 10, 16);
  hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, hsl(40, 18, 84));
  c.fillStyle = hg;
  c.beginPath(); c.ellipse(96, cy - 11, 14, 11, -0.15, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 14; i++) dab(c, 88 + rr(rng, -4, 14), cy - 11 + rr(rng, -8, 8), 2.2, 1, rr(rng, -0.5, 0.5), hsl(40, 15, 90, 0.6));
  // Hooked yellow beak.
  c.fillStyle = hsl(44, 92, 56);
  c.beginPath(); c.moveTo(104, cy - 15); c.quadraticCurveTo(116, cy - 16, 118, cy - 8); c.quadraticCurveTo(117, cy - 4, 113, cy - 5);
  c.quadraticCurveTo(110, cy - 7, 104, cy - 7); c.closePath(); c.fill();
  c.strokeStyle = hsl(36, 70, 36); c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(105, cy - 9.5); c.quadraticCurveTo(111, cy - 9, 115, cy - 7); c.stroke();
  dab(c, 108, cy - 13.5, 3, 1, -0.1, hsl(50, 100, 80, 0.8));
  // Eye with a stern-but-friendly brow and a shine.
  dab(c, 100, cy - 15, 2.6, 2.6, 0, hsl(48, 90, 60));
  dab(c, 100.4, cy - 15, 1.5, 1.7, 0, hsl(250, 30, 10));
  dab(c, 101, cy - 15.8, 0.6, 0.6, 0, '#fff');
  c.strokeStyle = hsl(30, 20, 60); c.lineWidth = 1.3;
  c.beginPath(); c.moveTo(96, cy - 18.5); c.quadraticCurveTo(100, cy - 19.5, 104, cy - 17.5); c.stroke();
}

/** One wing, painted pointing straight up; shoulder at the bottom centre (24, 92). */
function paintEagleWing(c: Ctx, w: number, h: number, far: boolean) {
  const rng = mulberry32(far ? 77 : 78);
  const sx = w / 2, sy = h - 4;
  const dark = far ? -8 : 0;
  // Fingered primaries fanning out at the tip, swept a little back (to the left).
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 - 0.45 + i * 0.12;
    const len = 46 + i * 3;
    c.save(); c.translate(sx - 6 + i * 1.5, sy - 40); c.rotate(a);
    dab(c, len * 0.5, 0, len * 0.5, 4.4, 0, hsl(24, 35, 16 + dark + i));
    dab(c, len * 0.45, -1.4, len * 0.36, 1.2, 0, hsl(28, 30, 32 + dark, 0.7));
    c.restore();
  }
  // Main wing: broad, rounded leading edge.
  const g = c.createLinearGradient(sx - 20, 0, sx + 20, 0);
  g.addColorStop(0, hsl(24, 40, 24 + dark)); g.addColorStop(0.6, hsl(27, 42, 36 + dark)); g.addColorStop(1, hsl(30, 40, 46 + dark));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(sx - 9, sy);
  c.quadraticCurveTo(sx - 24, sy - 30, sx - 18, sy - 58);
  c.quadraticCurveTo(sx - 6, sy - 72, sx + 8, sy - 60);
  c.quadraticCurveTo(sx + 18, sy - 34, sx + 10, sy);
  c.closePath(); c.fill();
  c.strokeStyle = hsl(22, 40, 11, 0.85); c.lineWidth = 1.5; c.stroke();
  // Coverts: rows of painterly feather dabs, lit along the leading edge.
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i < 5; i++) {
      const y = sy - 8 - row * 11 - rr(rng, 0, 3);
      const x = sx - 10 + i * 5 + rr(rng, -1, 1) - row * 0.8;
      dab(c, x, y, 3.4, 5.2, -0.15, hsl(27, 40, rr(rng, 28, 46) + dark, 0.75));
    }
  }
  c.strokeStyle = hsl(36, 45, 64 + dark, 0.8); c.lineWidth = 1.8;
  c.beginPath(); c.moveTo(sx + 9, sy - 4); c.quadraticCurveTo(sx + 16, sy - 34, sx + 6, sy - 60); c.stroke();
}

/** The Call Mount button icon: the eagle's white head in profile. */
function paintEagleIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2;
  dab(c, cx - 4, cy + 10, 15, 8, -0.3, hsl(24, 42, 26));
  for (let i = 0; i < 6; i++) dab(c, cx - 8 + i * 3, cy + 4 + (i % 2), 3, 2, 0.5, hsl(40, 25, 92));
  c.fillStyle = '#fbfaf6'; c.beginPath(); c.ellipse(cx - 1, cy - 3, 13, 11, -0.15, 0, Math.PI * 2); c.fill();
  c.fillStyle = hsl(44, 92, 56);
  c.beginPath(); c.moveTo(cx + 7, cy - 7); c.quadraticCurveTo(cx + 20, cy - 8, cx + 21, cy + 1); c.quadraticCurveTo(cx + 19, cy + 4, cx + 15, cy + 2);
  c.quadraticCurveTo(cx + 12, cy, cx + 7, cy); c.closePath(); c.fill();
  dab(c, cx + 3, cy - 7, 2.6, 2.6, 0, hsl(48, 90, 60)); dab(c, cx + 3.4, cy - 7, 1.5, 1.7, 0, hsl(250, 30, 10)); dab(c, cx + 4, cy - 7.8, 0.6, 0.6, 0, '#fff');
  c.strokeStyle = hsl(30, 20, 55); c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(cx - 1, cy - 10.5); c.quadraticCurveTo(cx + 3, cy - 11.5, cx + 8, cy - 9.5); c.stroke();
}

export function paintEagle(scene: Phaser.Scene) {
  canvasTex(scene, 'eagle_body', 120, 64, (c) => paintEagleBody(c, 120, 64));
  canvasTex(scene, 'eagle_wing', 48, 96, (c) => paintEagleWing(c, 48, 96, false));
  canvasTex(scene, 'eagle_wing_far', 48, 96, (c) => paintEagleWing(c, 48, 96, true));
  canvasTex(scene, 'i_eagle', 48, 48, (c) => paintEagleIcon(c, 48), 2);
}
