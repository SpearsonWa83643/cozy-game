// Hand-painted toy biplane mount: rounded red body, cream wings, round windows, smiley nose,
// and a separate spinning propeller (drawn as the "wing" image, spun by the mount code).
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, dab } from '../art';

/** Body: 136x76, facing right. Rider sits in the open cockpit around (62, 26). */
function paintPlaneBody(c: Ctx, w: number, h: number) {
  const cy = h * 0.58;
  // Far (top) wing behind the body.
  c.fillStyle = hsl(40, 60, 80);
  c.beginPath(); c.ellipse(70, cy - 22, 30, 5, -0.05, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(30, 40, 50); c.lineWidth = 1.2; c.stroke();
  // Struts.
  c.strokeStyle = hsl(25, 40, 38); c.lineWidth = 2;
  for (const sx of [52, 88]) { c.beginPath(); c.moveTo(sx, cy - 20); c.lineTo(sx + 2, cy + 4); c.stroke(); }
  // Tail fin + tail wing.
  c.fillStyle = hsl(4, 75, 54);
  c.beginPath(); c.moveTo(14, cy - 2); c.lineTo(8, cy - 24); c.quadraticCurveTo(16, cy - 26, 24, cy - 6); c.closePath(); c.fill();
  c.fillStyle = hsl(40, 60, 80); c.beginPath(); c.ellipse(16, cy + 2, 12, 3.4, 0, 0, Math.PI * 2); c.fill();
  // Body (fuselage).
  const g = c.createLinearGradient(0, cy - 14, 0, cy + 14);
  g.addColorStop(0, hsl(6, 85, 66)); g.addColorStop(0.55, hsl(4, 78, 54)); g.addColorStop(1, hsl(358, 70, 40));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(14, cy - 4);
  c.quadraticCurveTo(40, cy - 16, 92, cy - 14);
  c.quadraticCurveTo(120, cy - 12, 122, cy);
  c.quadraticCurveTo(120, cy + 13, 92, cy + 14);
  c.quadraticCurveTo(40, cy + 14, 14, cy + 4);
  c.closePath(); c.fill();
  c.strokeStyle = hsl(358, 60, 32, 0.8); c.lineWidth = 1.4; c.stroke();
  // Cream stripe + windows.
  c.strokeStyle = hsl(42, 70, 86); c.lineWidth = 3.2;
  c.beginPath(); c.moveTo(20, cy + 2); c.quadraticCurveTo(70, cy + 6, 118, cy + 3); c.stroke();
  for (const wx of [34, 46]) { dab(c, wx, cy - 3, 3.6, 3.6, 0, hsl(200, 60, 80)); dab(c, wx - 1, cy - 4, 1.2, 1.2, 0, '#fff'); }
  // Open cockpit rim.
  c.fillStyle = hsl(358, 50, 28); c.beginPath(); c.ellipse(64, cy - 13, 13, 3.6, 0, 0, Math.PI * 2); c.fill();
  // Little windscreen.
  c.fillStyle = 'rgba(200,235,255,0.75)';
  c.beginPath(); c.moveTo(78, cy - 13); c.lineTo(82, cy - 24); c.lineTo(88, cy - 13); c.closePath(); c.fill();
  // Nose cone (silver) + smiley face on the side.
  const ng = c.createRadialGradient(124, cy - 3, 1, 124, cy, 9);
  ng.addColorStop(0, '#ffffff'); ng.addColorStop(1, hsl(210, 10, 62));
  c.fillStyle = ng; c.beginPath(); c.ellipse(124, cy, 7, 9, 0, 0, Math.PI * 2); c.fill();
  dab(c, 104, cy - 5, 2.4, 2.8, 0, hsl(220, 40, 16)); dab(c, 104.8, cy - 5.8, 0.8, 0.8, 0, '#fff');
  c.strokeStyle = hsl(220, 40, 16); c.lineWidth = 1.4; c.beginPath(); c.arc(108, cy + 1, 4, 0.3, Math.PI - 0.5); c.stroke();
  dab(c, 100, cy + 2, 3, 1.8, 0, hsl(345, 80, 78, 0.8));
  // Near (bottom) wing in front.
  const wg = c.createLinearGradient(0, cy + 4, 0, cy + 14);
  wg.addColorStop(0, hsl(42, 70, 90)); wg.addColorStop(1, hsl(36, 55, 72));
  c.fillStyle = wg; c.beginPath(); c.ellipse(72, cy + 9, 34, 6, 0.04, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hsl(30, 40, 50); c.lineWidth = 1.2; c.stroke();
  dab(c, 72, cy + 9, 6, 4, 0, hsl(4, 78, 56)); // roundel
  dab(c, 72, cy + 9, 2.6, 1.8, 0, '#fff');
  // Little wheels.
  c.strokeStyle = hsl(25, 30, 30); c.lineWidth = 2;
  c.beginPath(); c.moveTo(80, cy + 13); c.lineTo(84, cy + 22); c.stroke();
  dab(c, 84, cy + 24, 4, 4, 0, hsl(220, 15, 25)); dab(c, 84, cy + 24, 1.6, 1.6, 0, hsl(220, 10, 70));
}

/** Propeller blade pair, vertical (spun by squashing its height). */
function paintProp(c: Ctx, w: number, h: number, far: boolean) {
  const cx = w / 2, cy = h / 2;
  const col = far ? 'rgba(120,90,60,0.25)' : hsl(28, 50, 40);
  c.fillStyle = col;
  c.beginPath(); c.ellipse(cx, cy - h * 0.25, 4, h * 0.24, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(cx, cy + h * 0.25, 4, h * 0.24, 0, 0, Math.PI * 2); c.fill();
  if (!far) { dab(c, cx, cy - h * 0.46, 3.4, 2.4, 0, hsl(4, 78, 56)); dab(c, cx, cy + h * 0.46, 3.4, 2.4, 0, hsl(4, 78, 56)); }
  dab(c, cx, cy, 3.6, 3.6, 0, far ? 'rgba(0,0,0,0)' : hsl(210, 10, 70));
}

function paintPlaneIcon(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2 + 2;
  c.fillStyle = hsl(40, 60, 82); c.beginPath(); c.ellipse(cx + 2, cy - 7, 14, 3, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = hsl(4, 78, 56);
  c.beginPath(); c.moveTo(cx - 18, cy - 2); c.quadraticCurveTo(cx - 4, cy - 9, cx + 14, cy - 6); c.quadraticCurveTo(cx + 19, cy, cx + 14, cy + 6); c.quadraticCurveTo(cx - 4, cy + 7, cx - 18, cy + 2); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(cx - 17, cy - 1); c.lineTo(cx - 20, cy - 12); c.lineTo(cx - 12, cy - 3); c.closePath(); c.fill();
  c.fillStyle = hsl(42, 70, 90); c.beginPath(); c.ellipse(cx + 2, cy + 4, 15, 3, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = hsl(28, 50, 40); c.fillRect(cx + 18, cy - 9, 2.4, 18);
  dab(c, cx + 8, cy - 2, 1.6, 1.8, 0, hsl(220, 40, 16));
}

/** Toy Propeller treasure: a little wooden propeller with a red tip. */
function paintToyProp(c: Ctx, w: number) {
  const cx = w / 2, cy = w / 2;
  c.save(); c.translate(cx, cy); c.rotate(-0.6);
  for (const s of [-1, 1]) {
    const g = c.createLinearGradient(0, 0, 0, s * 20);
    g.addColorStop(0, hsl(30, 55, 52)); g.addColorStop(1, hsl(26, 50, 38));
    c.fillStyle = g; c.beginPath(); c.ellipse(0, s * 10, 5.4, 11, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hsl(24, 50, 28); c.lineWidth = 1.2; c.stroke();
    dab(c, 0, s * 18, 4.4, 3, 0, hsl(4, 78, 56));
  }
  dab(c, 0, 0, 5, 5, 0, hsl(210, 10, 72)); dab(c, -1.4, -1.4, 1.6, 1.6, 0, '#fff');
  c.restore();
}

export function paintPlane(scene: Phaser.Scene) {
  canvasTex(scene, 'plane_body', 136, 76, (c) => paintPlaneBody(c, 136, 76));
  canvasTex(scene, 'plane_prop', 20, 56, (c) => paintProp(c, 20, 56, false));
  canvasTex(scene, 'plane_prop_far', 20, 56, (c) => paintProp(c, 20, 56, true));
  canvasTex(scene, 'i_plane', 48, 48, (c) => paintPlaneIcon(c, 48), 2);
  canvasTex(scene, 'ic_toy_prop', 48, 48, (c) => paintToyProp(c, 48), 2);
}
