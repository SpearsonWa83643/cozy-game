// Christmas theme art: the little Christmas-tree theme icon and the falling snowflake particle.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab, mulberry32, rr } from '../art';

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

/** A lumpy snow cap (100x60) that sits on top of a round canopy: bright white heaps on top, soft
 *  blue-grey shade underneath and a few drips hanging over the leaves. */
function paintSnowCap(c: Ctx, w: number, h: number) {
  const rng = mulberry32(7741);
  // Under-shade first (peeks out below the white).
  for (let i = 0; i < 12; i++) { const x = rr(rng, w * 0.14, w * 0.86); dab(c, x, h * 0.62 + rr(rng, -3, 3), rr(rng, 8, 13), rr(rng, 5, 8), 0, hsl(205, 36, 82)); }
  // Drips hanging over the edge.
  for (let i = 0; i < 7; i++) { const x = rr(rng, w * 0.18, w * 0.82); dab(c, x, h * 0.7 + rr(rng, 0, 6), rr(rng, 2.4, 4), rr(rng, 4, 8), 0, hsl(205, 30, 90)); }
  // Main heaps: a dome of overlapping round lumps, brighter toward the top.
  for (let i = 0; i < 26; i++) {
    const t = i / 26, x = w / 2 + rr(rng, -1, 1) * w * 0.4 * (1 - t * 0.5);
    const top = h * 0.24 + Math.pow((x - w / 2) / (w * 0.46), 2) * h * 0.3;
    const y = rr(rng, top, h * 0.58);
    dab(c, x, y, rr(rng, 9, 15), rr(rng, 6, 10), 0, hsl(205, 30, 93 + t * 6));
  }
  // Sparkly highlights.
  for (let i = 0; i < 9; i++) dab(c, rr(rng, w * 0.25, w * 0.75), rr(rng, h * 0.25, h * 0.45), rr(rng, 3, 6), rr(rng, 1.6, 3), 0, hsl(0, 0, 100));
}

/** A frosty meadow tuft (24x20, same footprint as tuft0-2): pale icy blades poking out of a soft
 *  snow drift, with little clumps of snow caught on the blade tips and a glint or two. */
function paintSnowTuft(c: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  // Frosted blades (cool sage to icy blue-white), drawn first so the drift hides their roots.
  const tips: [number, number][] = [];
  for (let i = 0; i < 11; i++) {
    const x = w / 2 + rr(rng, -w * 0.3, w * 0.3);
    const lean = rr(rng, -w * 0.22, w * 0.22);
    const top = rr(rng, 1, h * 0.5);
    c.fillStyle = hsl(rr(rng, 150, 196), rr(rng, 18, 32), rr(rng, 58, 80));
    c.beginPath();
    c.moveTo(x - 2, h);
    c.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top);
    c.quadraticCurveTo(x + lean * 0.3 + 1, (h + top) / 2, x + 2, h);
    c.fill();
    if (rng() < 0.55) tips.push([x + lean, top + 1.4]);
  }
  // Snow caught on some tips.
  for (const [x, y] of tips) dab(c, x, y, rr(rng, 1.3, 2.1), rr(rng, 1, 1.5), 0, hsl(205, 40, 97));
  // The little drift the tuft pokes out of: blue-grey underside, bright lumpy top.
  dab(c, w / 2, h - 2.2, w * 0.4, 3.4, 0, hsl(208, 30, 80));
  for (let i = 0; i < 5; i++) dab(c, w / 2 + rr(rng, -w * 0.3, w * 0.3), h - 3.4 + rr(rng, -0.8, 0.8), rr(rng, 3.4, 5.2), rr(rng, 2, 2.8), 0, hsl(205, 32, 95));
  // A couple of sparkly glints.
  for (let i = 0; i < 2; i++) dab(c, w / 2 + rr(rng, -w * 0.25, w * 0.25), h - 4.4, 1, 0.8, 0, hsl(0, 0, 100));
}

export function paintChristmasArt(scene: Phaser.Scene) {
  for (let i = 0; i < 3; i++) canvasTex(scene, `x_tuft${i}`, 24, 20, (c) => paintSnowTuft(c, 24, 20, 50 + i));
  canvasTex(scene, 'x_snowcap', 100, 60, (c) => paintSnowCap(c, 100, 60));
  canvasTex(scene, 'i_xmas', 48, 48, (c) => paintXmasIcon(c, 48), 2);
  canvasTex(scene, 'p_snow', 12, 12, (c) => paintSnowflake(c, 12), 3);
}
