// Hand-painted bumblebee mount: round fuzzy striped body, see-through buzzing wings, plus icon + treasure.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab, mulberry32, rr } from '../art';

const INK = 'hsl(30, 40%, 14%)';

/** Body: 124x80, facing right. Rider sits around (58, 26). */
function paintBeeBody(c: Ctx, w: number, h: number) {
  const rng = mulberry32(4242);
  const cy = h * 0.58;
  // Little stinger (soft and round, not scary).
  c.fillStyle = hsl(35, 30, 30);
  c.beginPath(); c.moveTo(16, cy + 2); c.lineTo(6, cy + 5); c.lineTo(16, cy + 9); c.closePath(); c.fill();
  // Dangling legs.
  c.strokeStyle = INK; c.lineWidth = 2.4; c.lineCap = 'round';
  for (const lx of [46, 60, 74]) { c.beginPath(); c.moveTo(lx, cy + 14); c.quadraticCurveTo(lx - 3, cy + 22, lx - 6, cy + 25); c.stroke(); }
  // Fuzzy round abdomen with stripes.
  c.save();
  c.beginPath(); c.ellipse(52, cy, 38, 21, -0.06, 0, Math.PI * 2); c.clip();
  const g = c.createRadialGradient(46, cy - 10, 4, 52, cy, 40);
  g.addColorStop(0, hsl(50, 100, 72)); g.addColorStop(0.7, hsl(44, 95, 56)); g.addColorStop(1, hsl(38, 90, 44));
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = INK;
  for (const sx of [30, 50, 70]) { c.beginPath(); c.ellipse(sx, cy, 6.5, 24, 0.12, 0, Math.PI * 2); c.fill(); }
  // Fuzz dabs.
  for (let i = 0; i < 70; i++) dab(c, rr(rng, 14, 92), cy + rr(rng, -20, 20), rr(rng, 1, 2.4), rr(rng, 1, 2.4), 0, hsl(rr(rng, 40, 55), 90, rr(rng, 60, 85), 0.45));
  c.restore();
  c.strokeStyle = hsl(30, 50, 22, 0.7); c.lineWidth = 1.4;
  c.beginPath(); c.ellipse(52, cy, 38, 21, -0.06, 0, Math.PI * 2); c.stroke();
  // Head.
  const hg = c.createRadialGradient(96, cy - 8, 2, 98, cy - 4, 18);
  hg.addColorStop(0, hsl(40, 30, 34)); hg.addColorStop(1, hsl(30, 40, 16));
  c.fillStyle = hg; c.beginPath(); c.arc(98, cy - 4, 16, 0, Math.PI * 2); c.fill();
  // Big friendly eye + cheek.
  dab(c, 104, cy - 8, 5.2, 6, 0, '#fff');
  dab(c, 105.5, cy - 7.5, 3, 3.6, 0, hsl(220, 40, 12));
  dab(c, 106.5, cy - 9, 1.1, 1.1, 0, '#fff');
  dab(c, 103, cy + 3, 3.2, 2, 0, hsl(345, 80, 72, 0.8));
  // Smile.
  c.strokeStyle = hsl(40, 80, 75); c.lineWidth = 1.6;
  c.beginPath(); c.arc(106, cy + 1, 4, 0.2, Math.PI - 0.6); c.stroke();
  // Curly antennae with pom tips.
  c.strokeStyle = INK; c.lineWidth = 2;
  c.beginPath(); c.moveTo(96, cy - 18); c.quadraticCurveTo(96, cy - 32, 104, cy - 34); c.stroke();
  c.beginPath(); c.moveTo(102, cy - 17); c.quadraticCurveTo(108, cy - 28, 116, cy - 28); c.stroke();
  dab(c, 104, cy - 34, 3, 3, 0, INK); dab(c, 116, cy - 28, 3, 3, 0, INK);
  // Soft shine.
  dab(c, 42, cy - 12, 10, 4, -0.2, 'rgba(255,255,255,0.35)');
}

/** See-through wing pointing up. */
function paintBeeWing(c: Ctx, w: number, h: number, far: boolean) {
  const sx = w / 2, sy = h - 4;
  const a = far ? 0.5 : 0.62;
  const g = c.createLinearGradient(sx, sy, sx, sy - 70);
  g.addColorStop(0, `rgba(215,240,255,${a})`); g.addColorStop(1, `rgba(255,255,255,${a * 0.75})`);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(sx - 4, sy);
  c.bezierCurveTo(sx - 24, sy - 30, sx - 18, sy - 70, sx, sy - 72);
  c.bezierCurveTo(sx + 18, sy - 70, sx + 20, sy - 30, sx + 4, sy); c.closePath(); c.fill();
  c.strokeStyle = far ? 'rgba(90,110,140,0.45)' : 'rgba(90,110,140,0.7)'; c.lineWidth = 1.4; c.stroke();
  // Veins.
  c.lineWidth = 0.9;
  for (const k of [-8, 0, 8]) { c.beginPath(); c.moveTo(sx, sy - 2); c.quadraticCurveTo(sx + k * 1.4, sy - 36, sx + k, sy - 62); c.stroke(); }
  // Rainbow sheen.
  dab(c, sx - 6, sy - 40, 4, 14, 0.2, 'rgba(255,220,250,0.35)');
  dab(c, sx + 5, sy - 30, 3, 10, -0.2, 'rgba(200,255,230,0.3)');
}

function paintBeeIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 3;
  dab(c, cx - 5, cy - 12, 6, 9, -0.4, 'rgba(210,235,255,0.9)');
  dab(c, cx + 3, cy - 13, 6, 9, 0.3, 'rgba(225,245,255,0.9)');
  c.save(); c.beginPath(); c.ellipse(cx - 2, cy, 13, 10, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = hsl(46, 95, 58); c.fillRect(0, 0, w, w);
  c.fillStyle = INK; for (const sx of [-9, -1, 7]) c.fillRect(cx - 2 + sx - 2, 0, 4, w);
  c.restore();
  c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx - 2, cy, 13, 10, 0, 0, Math.PI * 2); c.stroke();
  dab(c, cx + 13, cy - 2, 6.5, 6.5, 0, hsl(30, 40, 18));
  dab(c, cx + 15, cy - 4, 2.2, 2.6, 0, '#fff');
}

/** Golden honeycomb treasure. */
function paintHoneycomb(c: Ctx, w: number) {
  const r = 7.2, cx = w / 2, cy = w / 2 + 1;
  const hex = (x: number, y: number) => {
    c.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
    c.closePath();
    const g = c.createRadialGradient(x - 2, y - 2, 1, x, y, r);
    g.addColorStop(0, hsl(50, 100, 75)); g.addColorStop(1, hsl(38, 95, 50));
    c.fillStyle = g; c.fill(); c.strokeStyle = hsl(32, 80, 36); c.lineWidth = 1.6; c.stroke();
  };
  const dx = r * Math.sqrt(3), dy = r * 1.5;
  for (const [ox, oy] of [[0, 0], [-dx, 0], [dx, 0], [-dx / 2, -dy], [dx / 2, -dy], [-dx / 2, dy], [dx / 2, dy]]) hex(cx + ox, cy + oy);
  // Honey drip.
  dab(c, cx + dx / 2, cy + dy + 8, 2.6, 4, 0, hsl(42, 100, 55));
  dab(c, cx - 4, cy - 4, 2.4, 1.3, -0.4, 'rgba(255,255,255,0.8)');
}

export function paintBee(scene: Phaser.Scene) {
  canvasTex(scene, 'bee_body', 124, 80, (c) => paintBeeBody(c, 124, 80));
  canvasTex(scene, 'bee_wing', 48, 96, (c) => paintBeeWing(c, 48, 96, false));
  canvasTex(scene, 'bee_wing_far', 48, 96, (c) => paintBeeWing(c, 48, 96, true));
  canvasTex(scene, 'i_bee', 48, 48, (c) => paintBeeIcon(c, 48), 2);
  canvasTex(scene, 'ic_honeycomb', 48, 48, (c) => paintHoneycomb(c, 48), 2);
}
