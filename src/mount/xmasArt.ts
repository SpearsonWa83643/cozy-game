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


/** A wrapped present (44x44): a box in the given hue with a contrasting ribbon cross and a big bow. */
function paintPresent(c: Ctx, w: number, h: number, hue: number, rib: number) {
  dab(c, w / 2, h - 3, w * 0.42, 4, 0, hsl(205, 30, 40, 0.25));
  const x0 = 6, y0 = 15, bw = w - 12, bh = h - 19;
  const g = c.createLinearGradient(x0, 0, x0 + bw, 0);
  g.addColorStop(0, hsl(hue, 70, 58)); g.addColorStop(0.65, hsl(hue, 72, 50)); g.addColorStop(1, hsl(hue, 70, 38));
  c.fillStyle = g; c.beginPath(); c.roundRect(x0, y0, bw, bh, 3); c.fill();
  c.strokeStyle = hsl(hue, 60, 26); c.lineWidth = 1.6; c.stroke();
  // Lid.
  c.fillStyle = hsl(hue, 72, 62); c.beginPath(); c.roundRect(x0 - 2, y0 - 4, bw + 4, 8, 2.5); c.fill();
  c.strokeStyle = hsl(hue, 60, 28); c.lineWidth = 1.4; c.stroke();
  // Ribbon.
  c.fillStyle = hsl(rib, 90, 62);
  c.fillRect(w / 2 - 3, y0 - 4, 6, bh + 4);
  c.fillRect(x0, y0 + bh * 0.45, bw, 5);
  c.strokeStyle = hsl(rib, 70, 36); c.lineWidth = 0.9; c.strokeRect(w / 2 - 3, y0 - 4, 6, bh + 4);
  // Bow: two loops and tails.
  for (const s of [-1, 1]) {
    c.save(); c.translate(w / 2, y0 - 4); c.rotate(s * 0.5);
    c.beginPath(); c.ellipse(s * 7, -4, 7, 4.5, 0, 0, Math.PI * 2);
    c.fillStyle = hsl(rib, 92, 62); c.fill(); c.strokeStyle = hsl(rib, 70, 34); c.lineWidth = 1.3; c.stroke();
    c.restore();
  }
  dab(c, w / 2, y0 - 5, 3.2, 3, 0, hsl(rib, 90, 70));
  // Shine.
  c.fillStyle = hsl(0, 0, 100, 0.28); c.fillRect(x0 + 3, y0 + 3, 3, bh - 6);
}

/** A cheerful snowman (56x80): three snowballs, coal eyes and buttons, carrot nose, red scarf, top hat. */
function paintSnowman(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  dab(c, cx, h - 4, w * 0.4, 5, 0, hsl(208, 30, 50, 0.25));
  const ball = (y: number, r: number) => {
    const g = c.createRadialGradient(cx - r * 0.35, y - r * 0.35, r * 0.2, cx, y, r);
    g.addColorStop(0, hsl(0, 0, 100)); g.addColorStop(0.7, hsl(205, 40, 94)); g.addColorStop(1, hsl(208, 34, 80));
    c.fillStyle = g; c.beginPath(); c.arc(cx, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hsl(210, 28, 62); c.lineWidth = 1.4; c.stroke();
  };
  ball(h - 18, 17); ball(h - 44, 13); ball(h - 63, 10);
  // Stick arms.
  c.strokeStyle = hsl(26, 40, 30); c.lineWidth = 2; c.lineCap = 'round';
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * 11, h - 46); c.lineTo(cx + s * 25, h - 56); c.moveTo(cx + s * 20, h - 53); c.lineTo(cx + s * 22, h - 60); c.stroke(); }
  // Buttons + eyes + smile.
  c.fillStyle = hsl(220, 14, 18);
  for (const y of [h - 48, h - 41, h - 22]) { c.beginPath(); c.arc(cx, y, 1.8, 0, Math.PI * 2); c.fill(); }
  for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * 3.6, h - 66, 1.6, 0, Math.PI * 2); c.fill(); }
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(cx + i * 2.4, h - 58.5 + Math.abs(i) * -0.7, 0.9, 0, Math.PI * 2); c.fill(); }
  // Carrot nose.
  c.fillStyle = hsl(26, 96, 56); c.beginPath(); c.moveTo(cx, h - 64); c.lineTo(cx + 10, h - 61.5); c.lineTo(cx, h - 61); c.closePath(); c.fill();
  // Scarf.
  c.fillStyle = hsl(2, 78, 52); c.beginPath(); c.roundRect(cx - 11, h - 55, 22, 5, 2.5); c.fill();
  c.fillRect(cx + 4, h - 53, 5, 12);
  c.fillStyle = hsl(140, 50, 40); c.fillRect(cx - 6, h - 55, 3, 5); c.fillRect(cx + 4, h - 46, 5, 2.5);
  // Top hat.
  c.fillStyle = hsl(220, 16, 16); c.beginPath(); c.roundRect(cx - 11, h - 73, 22, 3.5, 1.5); c.fill();
  c.beginPath(); c.roundRect(cx - 7, h - 87 + 3, 14, 13, 1.5); c.fill();
  c.fillStyle = hsl(2, 78, 50); c.fillRect(cx - 7, h - 75.5, 14, 2.5);
}

/** A small decorated Christmas tree (64x92) on a little snow drift; string lights are a separate glow overlay. */
function paintLitTree(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  dab(c, cx, h - 5, w * 0.42, 6, 0, hsl(208, 30, 50, 0.22));
  dab(c, cx, h - 7, w * 0.34, 5, 0, hsl(205, 32, 94));
  c.fillStyle = hsl(26, 46, 32); c.fillRect(cx - 4, h - 20, 8, 12);
  const tiers: [number, number, number][] = [[h - 16, w * 0.46, 26], [h - 34, w * 0.37, 24], [h - 52, w * 0.27, 22]];
  for (const [base, half, ht] of tiers) {
    const g = c.createLinearGradient(cx - half, 0, cx + half, 0);
    g.addColorStop(0, hsl(144, 48, 40)); g.addColorStop(1, hsl(150, 52, 24));
    c.beginPath(); c.moveTo(cx - half, base); c.lineTo(cx, base - ht - 8); c.lineTo(cx + half, base); c.closePath();
    c.fillStyle = g; c.fill(); c.strokeStyle = hsl(150, 56, 18); c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = hsl(205, 40, 96); c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx - half + 3, base - 1); c.quadraticCurveTo(cx, base - 5, cx + half - 3, base - 1); c.stroke();
  }
  // Light wire.
  c.strokeStyle = hsl(140, 30, 14, 0.8); c.lineWidth = 0.9;
  for (const [y, half] of [[h - 24, w * 0.38], [h - 42, w * 0.3], [h - 60, w * 0.2]] as [number, number][]) { c.beginPath(); c.moveTo(cx - half, y - 3); c.quadraticCurveTo(cx, y + 4, cx + half, y - 3); c.stroke(); }
  // Star.
  c.save(); c.translate(cx, h - 84); c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 === 0 ? 7 : 3; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); c.fillStyle = hsl(46, 100, 60); c.fill(); c.strokeStyle = hsl(40, 80, 36); c.lineWidth = 1.1; c.stroke(); c.restore();
}

/** Bulb positions on the lit tree (64x92 frame space), shared by the art and the twinkle overlay. */
export const TREE_BULBS: [number, number][] = (() => {
  const out: [number, number][] = [];
  const h = 92, cx = 32;
  for (const [y, half, n] of [[h - 24, 64 * 0.38, 6], [h - 42, 64 * 0.3, 5], [h - 60, 64 * 0.2, 3]] as [number, number, number][]) {
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = cx - half + t * half * 2; out.push([x, y - 3 + (1 - Math.pow(2 * t - 1, 2)) * 3.5]); }
  }
  return out;
})();

/** A single bulb (10x12): white so tints give red, green, gold and blue. */
function paintBulb(c: Ctx, w: number, h: number) {
  dab(c, w / 2, h * 0.58, w * 0.36, h * 0.38, 0, hsl(0, 0, 96));
  dab(c, w / 2 - 1, h * 0.5, 1.2, 1.6, 0, hsl(0, 0, 100));
  c.fillStyle = hsl(0, 0, 55); c.fillRect(w / 2 - 1.5, 0.5, 3, 2.4);
}

/** Winter theme icon: a bold white snowflake on an icy-blue disc. */
function paintWinterIcon(c: Ctx, w: number) {
  const cx = w / 2, r = w * 0.44;
  dab(c, cx, w - 4, w * 0.32, 3, 0, hsl(210, 30, 30, 0.2));
  c.fillStyle = hsl(206, 64, 57); c.beginPath(); c.arc(cx, cx, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(210, 56, 36); c.lineWidth = 2; c.stroke();
  c.fillStyle = hsl(200, 80, 80, 0.5); c.beginPath(); c.ellipse(cx - r * 0.3, cx - r * 0.4, r * 0.4, r * 0.22, -0.5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#ffffff'; c.lineCap = 'round'; c.lineWidth = 3;
  const a0 = r * 0.78;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3, ex = cx + Math.cos(a) * a0, ey = cx + Math.sin(a) * a0;
    c.beginPath(); c.moveTo(cx, cx); c.lineTo(ex, ey); c.stroke();
    const mx = cx + Math.cos(a) * a0 * 0.6, my = cx + Math.sin(a) * a0 * 0.6;
    c.lineWidth = 2.2;
    for (const s of [-1, 1]) { const b = a + s * 0.75; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + Math.cos(b) * a0 * 0.32, my + Math.sin(b) * a0 * 0.32); c.stroke(); }
    c.lineWidth = 3;
  }
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx, cx, 3, 0, Math.PI * 2); c.fill();
}

/** Summer theme icon: a bold, smiling-free sun with chunky rays. */
function paintSummerIcon(c: Ctx, w: number) {
  const cx = w / 2, r = w * 0.24;
  dab(c, cx, w - 4, w * 0.32, 3, 0, hsl(30, 40, 30, 0.2));
  c.strokeStyle = hsl(36, 90, 54); c.lineCap = 'round'; c.lineWidth = 4;
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; c.beginPath(); c.moveTo(cx + Math.cos(a) * r * 1.45, cx + Math.sin(a) * r * 1.45); c.lineTo(cx + Math.cos(a) * r * 1.9, cx + Math.sin(a) * r * 1.9); c.stroke(); }
  c.fillStyle = hsl(46, 100, 62); c.beginPath(); c.arc(cx, cx, r * 1.15, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(32, 80, 44); c.lineWidth = 2.2; c.stroke();
  c.fillStyle = hsl(52, 100, 86, 0.7); c.beginPath(); c.ellipse(cx - r * 0.35, cx - r * 0.4, r * 0.45, r * 0.26, -0.5, 0, Math.PI * 2); c.fill();
}

export function paintChristmasArt(scene: Phaser.Scene) {
  canvasTex(scene, 'i_winter', 48, 48, (c) => paintWinterIcon(c, 48), 2);
  canvasTex(scene, 'i_summer', 48, 48, (c) => paintSummerIcon(c, 48), 2);
  ([['xm_present0', 2, 46], ['xm_present1', 142, 2], ['xm_present2', 212, 46], ['xm_present3', 46, 2]] as [string, number, number][])
    .forEach(([k, hue, rib]) => canvasTex(scene, k, 44, 44, (c) => paintPresent(c, 44, 44, hue, rib)));
  canvasTex(scene, 'xm_snowman', 56, 90, (c) => paintSnowman(c, 56, 90));
  canvasTex(scene, 'xm_tree', 64, 92, (c) => paintLitTree(c, 64, 92));
  canvasTex(scene, 'xm_bulb', 10, 12, (c) => paintBulb(c, 10, 12), 3);
  for (let i = 0; i < 3; i++) canvasTex(scene, `x_tuft${i}`, 24, 20, (c) => paintSnowTuft(c, 24, 20, 50 + i));
  canvasTex(scene, 'x_snowcap', 100, 60, (c) => paintSnowCap(c, 100, 60));
  canvasTex(scene, 'i_xmas', 48, 48, (c) => paintXmasIcon(c, 48), 2);
  canvasTex(scene, 'p_snow', 12, 12, (c) => paintSnowflake(c, 12), 3);
}
