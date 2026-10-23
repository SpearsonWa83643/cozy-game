// Theme mounts for Winter and Summer, so every theme has its own default ride:
// a round Snowy Owl in a cosy blue scarf (Winter) and a pink Flamingo (Summer).
// Same frames as the eagle (body 120x64 facing right, wings 48x96 pointing up) so the rider sits the same.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab, mulberry32, rr } from '../art';

// ---------- Snowy Owl ----------
function paintOwlBody(c: Ctx, w: number, h: number) {
  const rng = mulberry32(3301);
  const cy = h * 0.54;
  // Short fan tail, white with grey bars.
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i - 2) * 0.16;
    c.save(); c.translate(32, cy + 2); c.rotate(a);
    dab(c, 11, 0, 11, 4.2, 0, hsl(210, 15, 94 - Math.abs(i - 2) * 3));
    dab(c, 14, 0, 1.2, 3.6, 0, hsl(215, 15, 58, 0.7));
    c.restore();
  }
  // Fluffy feathered feet tucked under.
  for (const dx of [0, 10]) {
    dab(c, 54 + dx, cy + 14, 4.6, 3.6, 0.2, hsl(210, 20, 92));
    c.strokeStyle = hsl(220, 20, 22); c.lineWidth = 1.1;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(52 + dx + k * 2, cy + 17); c.quadraticCurveTo(53 + dx + k * 2, cy + 20, 51 + dx + k * 2, cy + 20.5); c.stroke(); }
  }
  // Round snowy body with soft blue shading underneath.
  const g = c.createLinearGradient(0, cy - 16, 0, cy + 16);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.65, hsl(210, 30, 94)); g.addColorStop(1, hsl(212, 30, 80));
  c.fillStyle = g;
  c.beginPath(); c.ellipse(60, cy, 30, 15, -0.02, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(212, 25, 72); c.lineWidth = 1.2; c.stroke();
  // Little dark chevron speckles.
  c.strokeStyle = hsl(220, 18, 30, 0.75); c.lineWidth = 1.3; c.lineCap = 'round';
  for (let i = 0; i < 18; i++) {
    const x = rr(rng, 38, 80), y = cy + rr(rng, -10, 9);
    c.beginPath(); c.moveTo(x - 2, y - 1); c.lineTo(x, y + 0.8); c.lineTo(x + 2, y - 1); c.stroke();
  }
  // Big round head right on the body (owls have no long neck).
  const hg = c.createRadialGradient(94, cy - 16, 3, 95, cy - 12, 17);
  hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, hsl(210, 25, 88));
  c.fillStyle = hg;
  c.beginPath(); c.ellipse(95, cy - 12, 16, 14, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(212, 25, 72); c.lineWidth = 1.2; c.stroke();
  for (let i = 0; i < 5; i++) { const x = rr(rng, 86, 104), y = cy - 22 + rr(rng, 0, 4); c.strokeStyle = hsl(220, 18, 34, 0.6); c.beginPath(); c.moveTo(x - 1.5, y); c.lineTo(x, y + 1); c.lineTo(x + 1.5, y); c.stroke(); }
  // Facial disc + big golden eyes looking forward.
  dab(c, 100, cy - 13, 10, 9, 0, hsl(210, 30, 97));
  for (const ex of [96, 105]) {
    dab(c, ex, cy - 15, 4.4, 4.4, 0, hsl(46, 100, 56));
    dab(c, ex + 0.5, cy - 15, 2.4, 2.6, 0, hsl(250, 30, 10));
    dab(c, ex + 1.3, cy - 16.2, 0.9, 0.9, 0, '#fff');
  }
  // Tiny dark beak.
  c.fillStyle = hsl(220, 15, 22);
  c.beginPath(); c.moveTo(99.5, cy - 11); c.lineTo(103, cy - 11); c.lineTo(101.5, cy - 6.5); c.closePath(); c.fill();
  // Rosy cheeks.
  dab(c, 92, cy - 9, 2.4, 1.4, 0, hsl(350, 80, 76, 0.6));
  dab(c, 109, cy - 9, 2.2, 1.4, 0, hsl(350, 80, 76, 0.6));
  // Cosy blue scarf with a trailing end.
  c.fillStyle = hsl(205, 75, 52);
  c.beginPath(); c.roundRect(80, cy - 3, 18, 6, 3); c.fill();
  c.beginPath(); c.moveTo(82, cy + 1); c.quadraticCurveTo(74, cy + 6, 70, cy + 12); c.lineTo(76, cy + 13); c.quadraticCurveTo(80, cy + 7, 86, cy + 3); c.closePath(); c.fill();
  c.fillStyle = '#fff'; c.fillRect(84, cy - 3, 2.4, 6); c.fillRect(90, cy - 3, 2.4, 6);
}

function paintOwlWing(c: Ctx, w: number, h: number, far: boolean) {
  const rng = mulberry32(far ? 3302 : 3303);
  const sx = w / 2, sy = h - 4, dk = far ? -9 : 0;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 - 0.42 + i * 0.12, len = 42 + i * 3;
    c.save(); c.translate(sx - 6 + i * 1.5, sy - 38); c.rotate(a);
    dab(c, len * 0.5, 0, len * 0.5, 4.6, 0, hsl(210, 18, 95 + dk - i));
    dab(c, len * 0.8, 0, 2, 4, 0, hsl(218, 15, 50 + dk, 0.7));
    c.restore();
  }
  c.fillStyle = hsl(210, 25, 97 + dk);
  c.beginPath(); c.moveTo(sx - 9, sy); c.quadraticCurveTo(sx - 24, sy - 30, sx - 17, sy - 56); c.quadraticCurveTo(sx - 5, sy - 70, sx + 8, sy - 58); c.quadraticCurveTo(sx + 18, sy - 32, sx + 10, sy); c.closePath(); c.fill();
  c.strokeStyle = hsl(212, 25, 66 + dk); c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = hsl(220, 18, 34 + dk, 0.6); c.lineWidth = 1.3; c.lineCap = 'round';
  for (let i = 0; i < 10; i++) { const x = sx + rr(rng, -10, 8), y = sy - rr(rng, 8, 58); c.beginPath(); c.moveTo(x - 2, y - 1); c.lineTo(x, y + 0.8); c.lineTo(x + 2, y - 1); c.stroke(); }
}

function paintOwlIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 2;
  c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(cx, cy, 16, 15, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(212, 25, 66); c.lineWidth = 1.5; c.stroke();
  for (const s of [-1, 1]) {
    dab(c, cx + s * 6, cy - 2, 5, 5, 0, hsl(46, 100, 56));
    dab(c, cx + s * 6 + 0.5, cy - 2, 2.8, 3, 0, hsl(250, 30, 10));
    dab(c, cx + s * 6 + 1.4, cy - 3.3, 1, 1, 0, '#fff');
  }
  c.fillStyle = hsl(220, 15, 22); c.beginPath(); c.moveTo(cx - 2, cy + 3); c.lineTo(cx + 2, cy + 3); c.lineTo(cx, cy + 7); c.closePath(); c.fill();
  c.fillStyle = hsl(205, 75, 52); c.beginPath(); c.roundRect(cx - 12, cy + 10, 24, 6, 3); c.fill();
}

// ---------- Flamingo ----------
function paintFlamingoBody(c: Ctx, w: number, h: number) {
  const rng = mulberry32(3401);
  const cy = h * 0.56;
  const pink = (l: number, a = 1) => hsl(345, 85, l, a);
  // Long legs trailing straight back (that's how flamingos fly), knobbly knees.
  c.lineCap = 'round'; c.strokeStyle = pink(62); c.lineWidth = 2.4;
  for (const dy of [0, 4]) { c.beginPath(); c.moveTo(44, cy + 6 + dy); c.lineTo(22, cy + 10 + dy); c.lineTo(4, cy + 12 + dy); c.stroke(); dab(c, 22, cy + 10 + dy, 2, 1.8, 0, pink(56)); }
  // Fluffy tail.
  for (let i = 0; i < 4; i++) dab(c, 34 - i * 2, cy - 2 + i * 2, 6, 3, -0.3, pink(72 - i * 3));
  // Body.
  const g = c.createLinearGradient(0, cy - 13, 0, cy + 13);
  g.addColorStop(0, pink(80)); g.addColorStop(0.6, pink(70)); g.addColorStop(1, pink(60));
  c.fillStyle = g;
  c.beginPath(); c.ellipse(58, cy, 27, 12.5, -0.04, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 40; i++) { const x = rr(rng, 38, 80), y = cy + rr(rng, -9, 8); dab(c, x, y, rr(rng, 2.4, 3.6), rr(rng, 1, 1.6), -0.3, pink(rr(rng, 64, 84), 0.5)); }
  // Long S-curved neck reaching forward.
  c.strokeStyle = pink(74); c.lineWidth = 6;
  c.beginPath(); c.moveTo(80, cy - 4); c.bezierCurveTo(92, cy - 2, 90, cy - 22, 100, cy - 22); c.stroke();
  c.strokeStyle = pink(84, 0.7); c.lineWidth = 2;
  c.beginPath(); c.moveTo(81, cy - 6); c.bezierCurveTo(91, cy - 5, 89, cy - 23, 99, cy - 24); c.stroke();
  // Head.
  c.fillStyle = pink(76); c.beginPath(); c.ellipse(102, cy - 23, 6.5, 5.6, 0, 0, Math.PI * 2); c.fill();
  // Bent beak: pale with a black tip.
  c.fillStyle = hsl(40, 40, 92);
  c.beginPath(); c.moveTo(106, cy - 26); c.quadraticCurveTo(114, cy - 26, 116, cy - 20); c.lineTo(112, cy - 18); c.quadraticCurveTo(110, cy - 21, 106, cy - 20); c.closePath(); c.fill();
  c.fillStyle = hsl(220, 15, 16);
  c.beginPath(); c.moveTo(113, cy - 24.5); c.quadraticCurveTo(116, cy - 23, 116, cy - 20); c.lineTo(112, cy - 18); c.quadraticCurveTo(112.5, cy - 21, 113, cy - 24.5); c.closePath(); c.fill();
  // Happy eye and cheek.
  c.strokeStyle = hsl(250, 30, 12); c.lineWidth = 1.4;
  c.beginPath(); c.arc(102.5, cy - 24, 1.9, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  dab(c, 101, cy - 20.5, 2, 1.2, 0, hsl(0, 90, 70, 0.6));
  // A little flower behind the ear for summer.
  for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5; dab(c, 97.5 + Math.cos(a) * 2.6, cy - 28 + Math.sin(a) * 2.6, 2, 2, 0, hsl(48, 100, 62)); }
  dab(c, 97.5, cy - 28, 1.5, 1.5, 0, hsl(28, 90, 52));
}

function paintFlamingoWing(c: Ctx, w: number, h: number, far: boolean) {
  const sx = w / 2, sy = h - 4, dk = far ? -9 : 0;
  // Black flight feathers at the tip.
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 - 0.42 + i * 0.12, len = 44 + i * 3;
    c.save(); c.translate(sx - 6 + i * 1.5, sy - 40); c.rotate(a);
    dab(c, len * 0.5, 0, len * 0.5, 4.2, 0, hsl(220, 15, 14 + i + dk / 2));
    c.restore();
  }
  const g = c.createLinearGradient(sx - 20, 0, sx + 20, 0);
  g.addColorStop(0, hsl(350, 80, 58 + dk)); g.addColorStop(1, hsl(345, 85, 76 + dk));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(sx - 9, sy); c.quadraticCurveTo(sx - 24, sy - 30, sx - 17, sy - 56); c.quadraticCurveTo(sx - 5, sy - 70, sx + 8, sy - 58); c.quadraticCurveTo(sx + 18, sy - 32, sx + 10, sy); c.closePath(); c.fill();
  c.strokeStyle = hsl(350, 60, 44 + dk, 0.8); c.lineWidth = 1.4; c.stroke();
  for (let row = 0; row < 4; row++) for (let i = 0; i < 4; i++) dab(c, sx - 8 + i * 5 - row, sy - 10 - row * 12, 3.2, 5, -0.15, hsl(345, 85, 70 + dk + (i % 2) * 6, 0.7));
}

function paintFlamingoIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2;
  c.strokeStyle = hsl(345, 85, 72); c.lineWidth = 6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx - 6, cy + 18); c.bezierCurveTo(cx - 16, cy + 4, cx + 6, cy - 2, cx - 4, cy - 10); c.stroke();
  c.fillStyle = hsl(345, 85, 76); c.beginPath(); c.ellipse(cx - 2, cy - 12, 8, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = hsl(40, 40, 92);
  c.beginPath(); c.moveTo(cx + 4, cy - 16); c.quadraticCurveTo(cx + 14, cy - 15, cx + 15, cy - 7); c.lineTo(cx + 10, cy - 6); c.quadraticCurveTo(cx + 9, cy - 10, cx + 4, cy - 9); c.closePath(); c.fill();
  c.fillStyle = hsl(220, 15, 16);
  c.beginPath(); c.moveTo(cx + 12, cy - 13); c.quadraticCurveTo(cx + 15, cy - 11, cx + 15, cy - 7); c.lineTo(cx + 10, cy - 6); c.closePath(); c.fill();
  c.strokeStyle = hsl(250, 30, 12); c.lineWidth = 1.6; c.beginPath(); c.arc(cx, cy - 13, 2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
}

export function paintSeasonBirds(scene: Phaser.Scene) {
  canvasTex(scene, 'owl_body', 120, 64, (c) => paintOwlBody(c, 120, 64));
  canvasTex(scene, 'owl_wing', 48, 96, (c) => paintOwlWing(c, 48, 96, false));
  canvasTex(scene, 'owl_wing_far', 48, 96, (c) => paintOwlWing(c, 48, 96, true));
  canvasTex(scene, 'i_owl', 48, 48, (c) => paintOwlIcon(c, 48), 2);
  canvasTex(scene, 'flam_body', 120, 64, (c) => paintFlamingoBody(c, 120, 64));
  canvasTex(scene, 'flam_wing', 48, 96, (c) => paintFlamingoWing(c, 48, 96, false));
  canvasTex(scene, 'flam_wing_far', 48, 96, (c) => paintFlamingoWing(c, 48, 96, true));
  canvasTex(scene, 'i_flamingo', 48, 48, (c) => paintFlamingoIcon(c, 48), 2);
}
