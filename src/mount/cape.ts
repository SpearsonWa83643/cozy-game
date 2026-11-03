// 36 (Walker, Oct 29): friends that aren't naturally winged fly with a flowing cape instead of wings.
// One set of white cape frames (4 ripple phases) plus a little collar bow, tinted per mount, so the
// atlas cost stays tiny. The cape is drawn behind the body and streams back; the bow sits in front.
import Phaser from 'phaser';
import { Ctx, canvasTex } from '../art';

/** Cape tint per mount (multiplied onto the white frames). */
export const CAPE: Record<string, number> = {
  cowboy_cookie: 0xd8402f, // red bandana cape
  chili_poncho: 0x2fae7a,
  tamale: 0xe0533a,
  he_buddy: 0xe8302a,
  concha: 0x7cc8ff,
  sushi: 0xff8a2a, // orange like its roe topping
  strawberry: 0x46b34f,
  pumpkin: 0x8a4fd0,
  cloud_puppy: 0x6fb6ff,
  reindeer: 0xc8202a,
  snail: 0x3fd0c0,
  teacup: 0xff8fbf,
};
/** No wings and no cape: they fly their own way (carpet ripples, jellyfish floats). */
export const NO_WINGS = new Set(['magic_carpet', 'sky_jelly']);

export const CAPE_FRAMES = ['cape0', 'cape1', 'cape2', 'cape3'];
export const CAPE_W = 96, CAPE_H = 60;
/** Attach point (neck) inside the cape frame, as an origin fraction. */
export const CAPE_OX = 88 / CAPE_W, CAPE_OY = 9 / CAPE_H;

/** Where the cape hangs on each body (body units from the body origin, facing right). */
export const CAPE_AT: Record<string, [number, number]> = {
  cowboy_cookie: [2, -24], chili_poncho: [2, -22], tamale: [2, -22], he_buddy: [2, -22], concha: [2, -22], sushi: [2, -18],
  strawberry: [0, -22], pumpkin: [0, -18], cloud_puppy: [4, -14], reindeer: [10, -12], snail: [4, -20], teacup: [-6, -12],
};

/** Multiply two 0xRRGGBB colours (cape colour x theme tint). */
export function mulTint(a: number, b: number) {
  const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255, g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255, bl = ((a & 255) * (b & 255)) / 255;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

function paintCape(c: Ctx, phase: number) {
  const ph = phase * Math.PI / 2;
  const tipTop = 12 + Math.sin(ph) * 4, tipBot = 44 + Math.sin(ph + 1.1) * 5;
  const hem: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, x = 4 + t * 80;
    const y = tipBot + (24 - tipBot) * t + Math.sin(t * 9 + ph) * 3.2 * (1 - t * 0.7);
    hem.push([x, y]);
  }
  const shape = () => {
    c.beginPath();
    c.moveTo(92, 6);
    c.quadraticCurveTo(52, 1 + Math.sin(ph + 0.6) * 2.5, 8, tipTop);
    c.quadraticCurveTo(1, (tipTop + tipBot) / 2, hem[0][0], hem[0][1]);
    for (const [x, y] of hem) c.lineTo(x, y);
    c.quadraticCurveTo(90, 18, 92, 6);
    c.closePath();
  };
  shape();
  const g = c.createLinearGradient(92, 0, 4, 0);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#f0f0f0'); g.addColorStop(1, '#c9c9c9');
  c.fillStyle = g; c.fill();
  // Folds: soft darker ribbons that follow the ripple.
  c.save(); shape(); c.clip();
  for (let k = 0; k < 3; k++) {
    c.strokeStyle = `rgba(90,90,90,${0.16 - k * 0.03})`; c.lineWidth = 5 - k;
    c.beginPath();
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, x = 88 - t * 82;
      const y = 10 + k * 9 + t * (14 + k * 6) + Math.sin(t * 8 + ph + k) * 2.4 * t;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }
  // Shine along the top edge.
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(86, 8); c.quadraticCurveTo(52, 4 + Math.sin(ph + 0.6) * 2.5, 14, tipTop + 2.5); c.stroke();
  c.restore();
  shape(); c.strokeStyle = '#4a4a4a'; c.lineWidth = 1.7; c.stroke();
}

/** The little collar bow that ties the cape on (front layer). */
function paintBow(c: Ctx) {
  c.fillStyle = '#ffffff'; c.strokeStyle = '#4a4a4a'; c.lineWidth = 1.4;
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(12, 8); c.quadraticCurveTo(12 + s * 10, -1 + 8, 12 + s * 10, 4 + 8); c.quadraticCurveTo(12 + s * 9, 14, 12, 8); c.closePath(); c.fill(); c.stroke();
  }
  c.beginPath(); c.ellipse(12, 8, 3.6, 3.2, 0, 0, Math.PI * 2); c.fillStyle = '#e8e8e8'; c.fill(); c.stroke();
}

export function paintCapes(scene: Phaser.Scene) {
  CAPE_FRAMES.forEach((k, i) => canvasTex(scene, k, CAPE_W, CAPE_H, (c) => paintCape(c, i)));
  canvasTex(scene, 'cape_bow', 24, 16, paintBow);
}

/** Which ripple frame to show now (faster when whooshing). */
export function capeFrame(time: number, fast = false) {
  return CAPE_FRAMES[Math.floor(time / (fast ? 70 : 125)) % 4];
}
