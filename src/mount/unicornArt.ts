// Hand-painted flying unicorn mount: white body, rainbow mane + tail, golden horn, pastel wings.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab, mulberry32, rr } from '../art';

const RAINBOW = [350, 28, 50, 140, 200, 270];

/** Body: 130x76, facing right. Rider sits around (60, 24). */
function paintUnicornBody(c: Ctx, w: number, h: number) {
  const rng = mulberry32(1203);
  const cy = h * 0.56;
  // Rainbow tail streaming back.
  RAINBOW.forEach((hue, i) => {
    c.strokeStyle = hsl(hue, 80, 68); c.lineWidth = 3.4;
    c.beginPath(); c.moveTo(30, cy - 4 + i * 1.6);
    c.bezierCurveTo(18, cy - 10 + i * 2, 10, cy + 2 + i * 2, 4, cy + 8 + i * 2.4); c.stroke();
  });
  // Legs tucked (galloping in the air).
  const leg = (x: number, a: number) => {
    c.save(); c.translate(x, cy + 10); c.rotate(a);
    dab(c, 0, 8, 4, 9, 0, hsl(230, 20, 94));
    dab(c, 0, 17, 4, 2.6, 0, hsl(45, 80, 62)); // golden hoof
    c.restore();
  };
  leg(40, 0.7); leg(50, 0.4); leg(76, -0.5); leg(86, -0.8);
  // Body.
  const g = c.createLinearGradient(0, cy - 16, 0, cy + 16);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, hsl(230, 25, 95)); g.addColorStop(1, hsl(240, 20, 84));
  c.fillStyle = g;
  c.beginPath(); c.ellipse(62, cy, 34, 15, -0.04, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(250, 20, 70, 0.6); c.lineWidth = 1.2; c.stroke();
  // Neck + head.
  c.fillStyle = hsl(230, 25, 96);
  c.beginPath(); c.moveTo(84, cy - 8); c.quadraticCurveTo(96, cy - 26, 102, cy - 30); c.lineTo(110, cy - 20); c.quadraticCurveTo(100, cy - 6, 92, cy + 4); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(110, cy - 24, 12, 8, 0.35, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(250, 20, 70, 0.6); c.lineWidth = 1.1; c.stroke();
  // Snout + nostril + blush.
  dab(c, 119, cy - 19, 5, 4, 0.4, hsl(340, 50, 90));
  dab(c, 121, cy - 19, 0.9, 0.9, 0, hsl(330, 30, 50));
  dab(c, 108, cy - 19, 3, 2, 0, hsl(345, 80, 80, 0.7));
  // Eye with long lashes.
  dab(c, 108, cy - 27, 2.4, 2.8, 0, hsl(260, 45, 22));
  dab(c, 108.7, cy - 27.9, 0.8, 0.8, 0, '#fff');
  c.strokeStyle = hsl(260, 45, 22); c.lineWidth = 0.9;
  for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(106 + k * 1.5, cy - 30); c.lineTo(105 + k * 1.8, cy - 32.5); c.stroke(); }
  // Ear.
  c.fillStyle = hsl(230, 25, 96);
  c.beginPath(); c.moveTo(102, cy - 30); c.lineTo(103, cy - 39); c.lineTo(107, cy - 31); c.fill();
  dab(c, 103.8, cy - 33, 1.2, 2.6, 0, hsl(340, 60, 82));
  // Golden spiral horn.
  const hx = 111, hy = cy - 32;
  const hg = c.createLinearGradient(hx, hy, hx + 8, hy - 18);
  hg.addColorStop(0, hsl(42, 90, 58)); hg.addColorStop(1, hsl(50, 100, 82));
  c.fillStyle = hg;
  c.beginPath(); c.moveTo(hx - 3, hy + 1); c.lineTo(hx + 9, hy - 18); c.lineTo(hx + 3, hy + 2); c.closePath(); c.fill();
  c.strokeStyle = hsl(36, 70, 45, 0.8); c.lineWidth = 0.8;
  for (let k = 0; k < 4; k++) { const t = k / 4; c.beginPath(); c.moveTo(hx - 2 + t * 9, hy + 1 - t * 15); c.lineTo(hx + 2 + t * 7, hy + 1 - t * 15 - 2); c.stroke(); }
  // Rainbow mane along the neck.
  RAINBOW.forEach((hue, i) => {
    for (let k = 0; k < 4; k++) dab(c, 98 - k * 4 - i * 0.6, cy - 30 + k * 6 + i * 0.8, 3.4, 2.2, 0.8, hsl(hue, 80, 70, 0.95));
  });
  // Sparkle freckles.
  for (let i = 0; i < 10; i++) dab(c, rr(rng, 40, 84), cy + rr(rng, -10, 8), 1.1, 1.1, 0, hsl(rr(rng, 260, 330), 80, 85, 0.8));
}

/** Pastel feathered wing pointing up. */
function paintUnicornWing(c: Ctx, w: number, h: number, far: boolean) {
  const sx = w / 2, sy = h - 4;
  const dark = far ? -8 : 0;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 - 0.42 + i * 0.12;
    const len = 40 + i * 3;
    c.save(); c.translate(sx - 6 + i * 1.4, sy - 34); c.rotate(a);
    dab(c, len * 0.5, 0, len * 0.5, 4.2, 0, hsl(RAINBOW[i], 70, 86 + dark));
    c.restore();
  }
  const g = c.createLinearGradient(sx - 18, 0, sx + 18, 0);
  g.addColorStop(0, hsl(270, 40, 88 + dark)); g.addColorStop(1, '#ffffff');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(sx - 8, sy);
  c.quadraticCurveTo(sx - 22, sy - 28, sx - 14, sy - 54);
  c.quadraticCurveTo(sx - 2, sy - 66, sx + 10, sy - 52);
  c.quadraticCurveTo(sx + 16, sy - 28, sx + 8, sy); c.closePath(); c.fill();
  c.strokeStyle = hsl(260, 30, 70 + dark, 0.8); c.lineWidth = 1.3; c.stroke();
  for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) dab(c, sx - 8 + i * 5 - r, sy - 8 - r * 11, 3, 4.6, -0.15, hsl(280, 30, 95 + dark, 0.8));
}

function paintUnicornIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 3;
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx, cy, 13, 10, 0.3, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(250, 20, 70); c.lineWidth = 1.2; c.stroke();
  dab(c, cx + 9, cy + 4, 5, 3.5, 0.4, hsl(340, 50, 90));
  RAINBOW.forEach((hue, i) => dab(c, cx - 10 + i * 0.4, cy - 8 + i * 3, 3.4, 2.2, 0.8, hsl(hue, 80, 70)));
  c.fillStyle = hsl(46, 95, 62);
  c.beginPath(); c.moveTo(cx - 1, cy - 8); c.lineTo(cx + 7, cy - 22); c.lineTo(cx + 4, cy - 7); c.closePath(); c.fill();
  dab(c, cx + 1, cy - 2, 2, 2.4, 0, hsl(260, 45, 22));
}

/** Rainbow horseshoe treasure. */
function paintHorseshoe(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 2;
  RAINBOW.forEach((hue, i) => {
    c.strokeStyle = hsl(hue, 80, 64); c.lineWidth = 2.6;
    c.beginPath(); c.arc(cx, cy, 16 - i * 2.4, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
  });
  c.strokeStyle = hsl(46, 95, 58); c.lineWidth = 3;
  c.beginPath(); c.arc(cx, cy, 17.5, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
  for (const sx of [-15, 15]) { dab(c, cx + sx, cy + 6, 3.4, 4.4, 0, hsl(46, 95, 58)); }
  dab(c, cx - 6, cy - 12, 3, 1.6, -0.4, 'rgba(255,255,255,0.8)');
}

export function paintUnicorn(scene: Phaser.Scene) {
  canvasTex(scene, 'uni_body', 130, 76, (c) => paintUnicornBody(c, 130, 76));
  canvasTex(scene, 'uni_wing', 48, 96, (c) => paintUnicornWing(c, 48, 96, false));
  canvasTex(scene, 'uni_wing_far', 48, 96, (c) => paintUnicornWing(c, 48, 96, true));
  canvasTex(scene, 'i_unicorn', 48, 48, (c) => paintUnicornIcon(c, 48), 2);
  canvasTex(scene, 'ic_horseshoe', 48, 48, (c) => paintHorseshoe(c, 48), 2);
}
