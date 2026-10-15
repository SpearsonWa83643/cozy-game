// Hand-painted cloud puppy mount: soft fluff body + ear-wings, plus Call Mount icon and treasure.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab, mulberry32, rr } from '../art';

/** Body: 120x70, facing right. Soft white cloud with puppy face and floppy ears. */
function paintCloudBody(c: Ctx, w: number, h: number) {
  const rng = mulberry32(707);
  const cy = h * 0.55;
  // Fluffy cloud lumps for the body.
  const lumps: [number, number, number][] = [
    [50, cy, 28], [70, cy - 4, 26], [88, cy + 2, 22], [36, cy + 4, 20], [60, cy + 10, 24], [78, cy + 8, 18],
  ];
  for (const [x, y, r] of lumps) {
    const g = c.createRadialGradient(x - r * 0.2, y - r * 0.3, 2, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, hsl(210, 30, 94)); g.addColorStop(1, hsl(215, 25, 84));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  // Soft outline dabs.
  for (let i = 0; i < 40; i++) dab(c, rr(rng, 28, 100), cy + rr(rng, -18, 18), rr(rng, 3, 6), rr(rng, 2, 4), 0, hsl(210, 20, 98, 0.5));
  // Floppy ears (painted as body parts so they turn with facing).
  c.fillStyle = hsl(340, 45, 78);
  c.beginPath(); c.ellipse(92, cy - 22, 10, 16, -0.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(78, cy - 24, 9, 15, 0.35, 0, Math.PI * 2); c.fill();
  dab(c, 92, cy - 22, 5, 8, -0.5, hsl(350, 50, 88, 0.7));
  dab(c, 78, cy - 24, 4.5, 7, 0.35, hsl(350, 50, 88, 0.7));
  // Face on the front cloud.
  dab(c, 96, cy - 2, 3.2, 3.2, 0, hsl(220, 40, 18)); // eye
  dab(c, 96.8, cy - 2.8, 0.9, 0.9, 0, '#fff');
  dab(c, 86, cy - 1, 2.6, 2.6, 0, hsl(220, 40, 18)); // other eye (peeking)
  dab(c, 86.6, cy - 1.7, 0.7, 0.7, 0, '#fff');
  // Tiny pink nose + smile.
  dab(c, 102, cy + 4, 3.2, 2.4, 0, hsl(350, 60, 72));
  c.strokeStyle = hsl(220, 30, 30); c.lineWidth = 1.4;
  c.beginPath(); c.arc(100, cy + 8, 5, 0.15, Math.PI - 0.15); c.stroke();
  // Little paws tucked under.
  for (const dx of [0, 14]) dab(c, 48 + dx, cy + 18, 6, 4, 0.2, hsl(340, 40, 82));
}

/** Ear-wing: soft pink cloud wing pointing up. */
function paintCloudWing(c: Ctx, w: number, h: number, far: boolean) {
  const sx = w / 2, sy = h - 4;
  const dark = far ? -6 : 0;
  const g = c.createRadialGradient(sx, sy - 40, 4, sx, sy - 36, 40);
  g.addColorStop(0, hsl(340, 50, 92 + dark)); g.addColorStop(0.6, hsl(210, 30, 94 + dark / 2)); g.addColorStop(1, hsl(215, 25, 82 + dark));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(sx - 4, sy);
  c.quadraticCurveTo(sx - 22, sy - 30, sx - 10, sy - 70);
  c.quadraticCurveTo(sx + 8, sy - 82, sx + 16, sy - 50);
  c.quadraticCurveTo(sx + 18, sy - 20, sx + 6, sy);
  c.closePath(); c.fill();
  // Fluff bumps along the leading edge.
  for (let i = 0; i < 5; i++) {
    const y = sy - 10 - i * 14;
    dab(c, sx + 8 - i, y, 7, 6, 0, hsl(340, 40, 90 + dark, 0.7));
  }
}

function paintCloudIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2;
  for (const [x, y, r] of [[cx - 6, cy + 2, 12], [cx + 6, cy, 11], [cx, cy - 6, 10]] as [number, number, number][]) {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = hsl(340, 45, 78);
  c.beginPath(); c.ellipse(cx + 8, cy - 12, 6, 9, -0.4, 0, Math.PI * 2); c.fill();
  dab(c, cx + 4, cy - 2, 2.2, 2.2, 0, hsl(220, 40, 18));
  dab(c, cx + 4.6, cy - 2.6, 0.6, 0.6, 0, '#fff');
  dab(c, cx + 9, cy + 3, 2.4, 1.8, 0, hsl(350, 60, 72));
}

function paintCloudTuft(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2;
  for (const [x, y, r] of [[cx, cy, 14], [cx - 10, cy + 4, 10], [cx + 10, cy + 2, 11], [cx, cy - 10, 9]] as [number, number, number][]) {
    const g = c.createRadialGradient(x - 2, y - 2, 1, x, y, r);
    g.addColorStop(0, '#fff'); g.addColorStop(1, hsl(210, 30, 88));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  dab(c, cx + 2, cy - 2, 2.4, 2.4, 0, hsl(220, 40, 20));
  dab(c, cx + 2.6, cy - 2.6, 0.7, 0.7, 0, '#fff');
  dab(c, cx + 6, cy + 4, 2.6, 2, 0, hsl(350, 60, 72));
  c.fillStyle = hsl(340, 45, 78);
  c.beginPath(); c.ellipse(cx - 6, cy - 12, 5, 8, 0.4, 0, Math.PI * 2); c.fill();
}

export function paintCloudPuppy(scene: Phaser.Scene) {
  canvasTex(scene, 'cloud_body', 120, 70, (c) => paintCloudBody(c, 120, 70));
  canvasTex(scene, 'cloud_wing', 48, 96, (c) => paintCloudWing(c, 48, 96, false));
  canvasTex(scene, 'cloud_wing_far', 48, 96, (c) => paintCloudWing(c, 48, 96, true));
  canvasTex(scene, 'i_cloud', 48, 48, (c) => paintCloudIcon(c, 48), 2);
  canvasTex(scene, 'ic_cloud_tuft', 48, 48, (c) => paintCloudTuft(c, 48), 2);
}
