// Christmas theme art: the little Christmas-tree theme icon and the falling snowflake particle.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab } from '../art';

/** Theme toggle icon: a small decorated Christmas tree with a gold star and red/gold/blue baubles. */
function paintXmasIcon(c: Ctx, w: number) {
  const cx = w / 2;
  dab(c, cx, w - 6, w * 0.3, 3, 0, hsl(200, 30, 30, 0.2));
  c.fillStyle = hsl(26, 46, 34); c.fillRect(cx - 3, w - 13, 6, 8); // trunk
  // Three stacked tiers of soft green with a snowy rim.
  const tiers: [number, number, number][] = [[w - 12, w * 0.4, 13], [w - 21, w * 0.32, 12], [w - 29, w * 0.23, 11]];
  for (const [base, half, ht] of tiers) {
    c.beginPath(); c.moveTo(cx - half, base); c.lineTo(cx, base - ht - 6); c.lineTo(cx + half, base); c.closePath();
    c.fillStyle = hsl(142, 46, 36); c.fill();
    c.strokeStyle = hsl(146, 52, 22); c.lineWidth = 1.4; c.stroke();
    c.strokeStyle = hsl(200, 40, 96); c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(cx - half + 2, base - 1); c.quadraticCurveTo(cx, base - 4, cx + half - 2, base - 1); c.stroke();
  }
  // Baubles.
  for (const [x, y, hue] of [[cx - 8, w - 16, 2], [cx + 7, w - 19, 46], [cx - 3, w - 26, 205], [cx + 4, w - 32, 2]] as [number, number, number][]) {
    c.fillStyle = hsl(hue, 90, 58); c.beginPath(); c.arc(x, y, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = hsl(0, 0, 100, 0.8); c.beginPath(); c.arc(x - 0.8, y - 0.8, 0.8, 0, Math.PI * 2); c.fill();
  }
  // Gold star on top.
  c.save(); c.translate(cx, 7); c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 === 0 ? 6 : 2.6; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); c.fillStyle = hsl(46, 100, 60); c.fill(); c.strokeStyle = hsl(40, 80, 38); c.lineWidth = 1; c.stroke();
  c.restore();
}

/** A soft six-armed snowflake (painted white; per-particle tints give white and icy blue). */
function paintSnowflake(c: Ctx, w: number) {
  const cx = w / 2, r = w * 0.42;
  dab(c, cx, cx, r * 0.55, r * 0.55, 0, hsl(0, 0, 100, 0.55));
  c.strokeStyle = hsl(0, 0, 100); c.lineWidth = 1.1;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3, ex = cx + Math.cos(a) * r, ey = cx + Math.sin(a) * r;
    c.beginPath(); c.moveTo(cx, cx); c.lineTo(ex, ey); c.stroke();
    const mx = cx + Math.cos(a) * r * 0.6, my = cx + Math.sin(a) * r * 0.6;
    for (const s of [-1, 1]) { const b = a + s * 0.7; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + Math.cos(b) * r * 0.3, my + Math.sin(b) * r * 0.3); c.stroke(); }
  }
}

export function paintChristmasArt(scene: Phaser.Scene) {
  canvasTex(scene, 'i_xmas', 48, 48, (c) => paintXmasIcon(c, 48), 2);
  canvasTex(scene, 'p_snow', 12, 12, (c) => paintSnowflake(c, 12), 3);
}
