// 99–102: little life. Four small tappable critters that share one simple engine:
//  99 Meadow ladybugs: rest along the Sunflower Meadow path (north side, away from the bunnies);
//     tap = wings open, a little looping flight, then they land again. Hidden in snow.
// 100 Glowcap snails: glowing-shell snails on the outer edge of the Glowcap Grove; tap = tuck
//     into the shell, then peek back out. All themes (the grove glows year-round).
// 101 Village hens: hens peck near the village entry; tap = cluck, flap and hop, a feather or two.
//     Hidden in snow.
// 102 Bay turtles: little sea turtles in Seashell Bay shallows (clear of the minnows); tap = a happy
//     swim lap around home with a splash. Hidden in snow.
// 103–106: more little life (same engine):
// 103 Village goats: two little goats on the grass by the village's south edge; tap = a bleat and a playful
//     hop-and-kick with a head bob. All themes.
// 104 Hills sheep: fluffy sheep graze south of the Pinecone Hills path; tap = baa-bounce with wool puffs. All themes.
// 105 Lake otters: otters float on their backs on Shellwater Lake (west side, away from the pier and boat);
//     tap = a playful roll + splash. Hidden in snow (the lake freezes).
// 106 Garden mole: a molehill by the cottage garden; the mole's nose peeks out; tap = it pops up, looks
//     around, then ducks back down. Hidden in snow.
// 107–110: even more little life (same engine):
// 107 Orchard hedgehogs: hedgehogs snuffle beside the southern orchard path; tap = curl into a spiky ball,
//     roll a little, then uncurl. Hidden in snow (they hibernate).
// 108 Windmill mice: field mice by the windmill; tap = squeak + a happy hop with a crumb sparkle. All themes.
// 109 Riverside beaver: a beaver on the riverbank by the riverside path; tap = tail slap + splash. Hidden in snow.
// 110 Forest fawns: little spotted fawns beside the forest path; tap = ears flick and a springy leap with hearts. All themes.
// Culled off-screen.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { PATH_MEADOW, GROVE_RING, VILLAGE, VILLAGE_ENTRY, VILLAGE_SIGN, VILLAGE_BOARD, BAY, PATH_HILLS, LAKE, PIER, GARDEN, COTTAGE, POTS, PATH_ORCHARD_S, WINDMILL, PATH_RIVERSIDE, PATH_FOREST, RIVER_PTS, RIVER_HALF } from './layout';
import { lakeValue } from './geo';
import type { WorldScene } from './scenes/World';

export type Kind = 'ladybug' | 'snail' | 'hen' | 'turtle' | 'goat' | 'sheep' | 'otter' | 'mole' | 'hedgehog' | 'mouse' | 'beaver' | 'fawn';
const SNOWY = new Set(['christmas', 'winter']);
export const LIFE: Record<Kind, { n: number; size: number; reactS: number; snowHide: boolean; tw: number; th: number }> = {
  ladybug: { n: 4, size: 1.4, reactS: 2.2, snowHide: true, tw: 24, th: 20 },
  snail: { n: 3, size: 1.3, reactS: 2.4, snowHide: false, tw: 40, th: 30 },
  hen: { n: 3, size: 1.25, reactS: 1.1, snowHide: true, tw: 40, th: 40 },
  turtle: { n: 2, size: 1.3, reactS: 3.0, snowHide: true, tw: 44, th: 36 },
  goat: { n: 2, size: 1.35, reactS: 1.6, snowHide: false, tw: 48, th: 40 },
  sheep: { n: 3, size: 1.35, reactS: 1.4, snowHide: false, tw: 48, th: 40 },
  otter: { n: 2, size: 1.3, reactS: 2.2, snowHide: true, tw: 48, th: 30 },
  mole: { n: 1, size: 1.35, reactS: 2.8, snowHide: true, tw: 40, th: 40 },
  hedgehog: { n: 2, size: 1.3, reactS: 2.6, snowHide: true, tw: 40, th: 30 },
  mouse: { n: 2, size: 1.3, reactS: 1.2, snowHide: false, tw: 30, th: 24 },
  beaver: { n: 1, size: 1.35, reactS: 1.8, snowHide: true, tw: 48, th: 36 },
  fawn: { n: 2, size: 1.35, reactS: 1.5, snowHide: false, tw: 44, th: 48 },
};
type Critter = {
  kind: Kind; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse;
  hx: number; hy: number; x: number; y: number; base: number; ph: number;
  t: number; on: boolean; i: number;
};

// ---------------------------------------------------------------- art
function ladybug(c: Ctx, open: boolean) {
  if (open) {
    c.fillStyle = 'rgba(230,245,255,0.75)'; c.strokeStyle = 'rgba(120,150,180,0.8)'; c.lineWidth = 0.8;
    c.beginPath(); c.ellipse(6, 7, 6, 3.5, -0.6, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(18, 7, 6, 3.5, 0.6, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.fillStyle = '#e8302a'; c.strokeStyle = '#4a1010'; c.lineWidth = 1.2;
  if (open) { c.beginPath(); c.ellipse(8.5, 12, 4.5, 6, -0.35, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.ellipse(15.5, 12, 4.5, 6, 0.35, 0, Math.PI * 2); c.fill(); c.stroke(); }
  else { c.beginPath(); c.ellipse(12, 12, 8, 6.5, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.moveTo(12, 6); c.lineTo(12, 18); c.stroke(); }
  c.fillStyle = '#1a1a1a';
  for (const [x, y] of [[8, 10], [16, 10], [9, 15], [15, 15]] as const) { c.beginPath(); c.arc(x, y, 1.5, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.arc(12, 5, 3.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(10.8, 4.4, 0.8, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(13.2, 4.4, 0.8, 0, Math.PI * 2); c.fill();
}
function snail(c: Ctx, out: boolean) {
  if (out) {
    c.fillStyle = '#d8f0c0'; c.strokeStyle = '#5a7a4a'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(4, 27); c.quadraticCurveTo(4, 22, 12, 22); c.lineTo(32, 22); c.quadraticCurveTo(36, 18, 35, 11); c.quadraticCurveTo(38, 10, 39, 14); c.quadraticCurveTo(39, 27, 30, 27); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(34, 12); c.lineTo(32, 4); c.moveTo(37, 12); c.lineTo(38, 4); c.stroke();
    c.fillStyle = '#3a3a3a'; c.beginPath(); c.arc(32, 4, 1.6, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(38, 4, 1.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3a3a3a'; c.lineWidth = 1; c.beginPath(); c.arc(36, 17, 1.8, 0.2, Math.PI - 0.2); c.stroke();
  } else {
    c.fillStyle = '#d8f0c0'; c.strokeStyle = '#5a7a4a'; c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(19, 26, 12, 2.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  const g = c.createRadialGradient(18, 15, 2, 18, 15, 12);
  g.addColorStop(0, '#fff6a0'); g.addColorStop(0.5, '#b0f0ff'); g.addColorStop(1, '#9a70e0');
  c.fillStyle = g; c.strokeStyle = '#5a3a8a'; c.lineWidth = 1.6;
  c.beginPath(); c.arc(18, 15, 11, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); for (let a = 0; a < 9; a += 0.2) { const r = 1 + a * 1.05; const x = 18 + Math.cos(a) * r, y = 15 + Math.sin(a) * r; if (a === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
}
function hen(c: Ctx, flap: boolean) {
  c.fillStyle = '#fffaf0'; c.strokeStyle = '#8a6a4a'; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(18, 26, 12, 9, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(7, 24); c.lineTo(3, 15); c.lineTo(10, 20); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.arc(29, 15, 6, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#e83a3a'; c.beginPath(); c.arc(28, 8.5, 2.2, 0, Math.PI * 2); c.arc(31, 9, 2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(34.5, 19, 1.4, 2.4, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffb020'; c.beginPath(); c.moveTo(34, 14); c.lineTo(39, 16); c.lineTo(34, 17); c.closePath(); c.fill();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(30.5, 14, 1.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f0e6d0'; c.strokeStyle = '#8a6a4a';
  if (flap) { c.beginPath(); c.moveTo(14, 22); c.lineTo(8, 8); c.lineTo(22, 18); c.closePath(); c.fill(); c.stroke(); }
  else { c.beginPath(); c.ellipse(17, 26, 7, 4.5, -0.2, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.strokeStyle = '#e09020'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(15, 34); c.lineTo(15, 39); c.moveTo(21, 34); c.lineTo(21, 39); c.stroke();
}
function turtle(c: Ctx) {
  c.fillStyle = '#9ad8a0'; c.strokeStyle = '#3a6a4a'; c.lineWidth = 1.4;
  for (const [x, y, a] of [[10, 9, -0.8], [34, 9, 0.8], [11, 28, 0.6], [33, 28, -0.6]] as const) { c.beginPath(); c.ellipse(x, y, 7, 3.5, a, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.beginPath(); c.ellipse(22, 4, 5, 4.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(20, 3, 1.1, 0, Math.PI * 2); c.arc(24, 3, 1.1, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#4aa070'; c.strokeStyle = '#2a5a3a'; c.lineWidth = 1.8;
  c.beginPath(); c.ellipse(22, 19, 13, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#7acb90';
  for (const [x, y, r] of [[22, 19, 4.5], [15, 14, 3], [29, 14, 3], [15, 24, 3], [29, 24, 3]] as const) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
}

function goat(c: Ctx, hop: boolean) {
  c.strokeStyle = '#5a4a3a'; c.lineWidth = 2;
  for (const x of [13, 18, 29, 34]) { c.beginPath(); c.moveTo(x, 28); c.lineTo(x + (hop ? (x < 24 ? -3 : 3) : 0), 38); c.stroke(); }
  c.fillStyle = '#f4ead8'; c.strokeStyle = '#8a7050'; c.lineWidth = 1.4;
  c.beginPath(); c.ellipse(23, 23, 14, 8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#c89a68'; c.beginPath(); c.ellipse(20, 21, 6, 4, 0.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f4ead8'; c.beginPath(); c.moveTo(9, 20); c.lineTo(5, 15); c.lineTo(10, 17); c.closePath(); c.fill(); c.stroke();
  const hy = hop ? 9 : 13;
  c.beginPath(); c.ellipse(39, hy + 3, 6, 7, 0.4, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = '#7a6a5a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(36, hy - 3); c.quadraticCurveTo(33, hy - 9, 30, hy - 8); c.moveTo(39, hy - 3); c.quadraticCurveTo(38, hy - 10, 35, hy - 10); c.stroke();
  c.fillStyle = '#f4ead8'; c.strokeStyle = '#8a7050'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(33, hy + 1, 4, 1.8, -0.4, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#e8dcc4'; c.beginPath(); c.moveTo(40, hy + 9); c.lineTo(42, hy + 15); c.lineTo(44, hy + 8); c.closePath(); c.fill();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(41, hy + 1, 1.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffb0b8'; c.beginPath(); c.arc(44, hy + 6, 1.2, 0, Math.PI * 2); c.fill();
}
function sheep(c: Ctx, happy: boolean) {
  c.strokeStyle = '#3a3a3a'; c.lineWidth = 2;
  for (const x of [14, 20, 28, 34]) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x + (happy ? (x < 24 ? -2 : 2) : 0), 38); c.stroke(); }
  c.fillStyle = '#fbfaf4'; c.strokeStyle = '#a09a8a'; c.lineWidth = 1.3;
  for (const [x, y, r] of [[14, 22, 7], [22, 17, 8], [31, 19, 7], [35, 26, 6], [24, 28, 8], [13, 29, 6]] as const) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.fillStyle = '#4a4040'; c.beginPath(); c.ellipse(41, 20, 5, 6.5, 0.3, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(36, 15, 3.5, 1.8, -0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fbfaf4'; c.beginPath(); c.arc(40, 14, 3.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(42.5, 19, 1.4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111'; c.beginPath(); c.arc(42.8, 19, 0.7, 0, Math.PI * 2); c.fill();
  if (happy) { c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.arc(42, 23, 1.6, 0.2, Math.PI - 0.2); c.stroke(); }
}
function otter(c: Ctx, roll: boolean) {
  c.fillStyle = roll ? '#6a4a30' : '#8a6040'; c.strokeStyle = '#4a3020'; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(22, 17, 17, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(6, 17); c.quadraticCurveTo(0, 14, 2, 10); c.lineWidth = 4; c.stroke(); c.lineWidth = 1.5;
  c.beginPath(); c.arc(40, 14, 7, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#e8d0b0'; c.beginPath(); c.ellipse(42, 17, 4, 3, 0, 0, Math.PI * 2); c.fill();
  if (!roll) {
    c.fillStyle = '#e8d0b0'; c.beginPath(); c.ellipse(22, 14, 12, 3.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8a6040'; c.strokeStyle = '#4a3020'; c.beginPath(); c.arc(30, 10, 3, 0, Math.PI * 2); c.arc(34, 9, 3, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(39, 11.5, 1.2, 0, Math.PI * 2); c.arc(43.5, 11.5, 1.2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(43, 15.5, 1.3, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(200,240,255,0.9)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(22, 24, 20, 3.5, 0, 0, Math.PI); c.stroke();
}
function mole(c: Ctx, up: boolean) {
  // molehill
  c.fillStyle = '#8a5a34'; c.strokeStyle = '#5a3a1c'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(3, 38); c.quadraticCurveTo(20, 18, 37, 38); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#a0704a'; for (const [x, y] of [[12, 34], [20, 30], [27, 35], [17, 37]] as const) { c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill(); }
  const top = up ? 6 : 22;
  c.fillStyle = '#5a5060'; c.strokeStyle = '#2a2430';
  c.beginPath(); c.ellipse(20, top + 9, 8, up ? 12 : 6, 0, Math.PI, 0); c.lineTo(28, top + 14); c.lineTo(12, top + 14); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ff9ab0'; c.beginPath(); c.arc(20, top + 7, 2.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111'; c.beginPath(); c.arc(16.5, top + 3, 1, 0, Math.PI * 2); c.arc(23.5, top + 3, 1, 0, Math.PI * 2); c.fill();
  if (up) {
    c.fillStyle = '#ffb0c0'; c.strokeStyle = '#2a2430';
    c.beginPath(); c.ellipse(9, top + 12, 4, 2.6, -0.6, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(31, top + 12, 4, 2.6, 0.6, 0, Math.PI * 2); c.fill(); c.stroke();
  }
}

function hedgehog(c: Ctx, ball: boolean) {
  if (ball) {
    c.fillStyle = '#7a5a3a'; c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.4;
    for (let a = 0; a < Math.PI * 2; a += 0.35) { c.beginPath(); c.moveTo(20 + Math.cos(a) * 9, 16 + Math.sin(a) * 9); c.lineTo(20 + Math.cos(a + 0.17) * 14, 16 + Math.sin(a + 0.17) * 14); c.lineTo(20 + Math.cos(a + 0.35) * 9, 16 + Math.sin(a + 0.35) * 9); c.fill(); c.stroke(); }
    c.beginPath(); c.arc(20, 16, 10, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#e8c8a0'; c.beginPath(); c.arc(25, 19, 3, 0, Math.PI * 2); c.fill();
    return;
  }
  c.fillStyle = '#e8c8a0'; c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.3;
  c.beginPath(); c.ellipse(20, 21, 14, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#7a5a3a'; c.strokeStyle = '#3a2a1a';
  c.beginPath(); c.moveTo(6, 22);
  for (let i = 0; i <= 10; i++) { const x = 6 + i * 2.6, y = 18 - Math.sin((i / 10) * Math.PI) * 9; c.lineTo(x, y - (i % 2 ? 4 : 0)); }
  c.lineTo(32, 20); c.quadraticCurveTo(20, 24, 6, 22); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#e8c8a0'; c.strokeStyle = '#6a4a2a'; c.beginPath(); c.moveTo(30, 16); c.quadraticCurveTo(38, 18, 39, 22); c.quadraticCurveTo(34, 25, 29, 23); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(39, 22, 1.5, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(33.5, 19, 1.1, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffb0b8'; c.beginPath(); c.arc(31, 21.5, 1.2, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(13, 27); c.lineTo(13, 29); c.moveTo(27, 27); c.lineTo(27, 29); c.stroke();
}
function mouse(c: Ctx, hop: boolean) {
  c.strokeStyle = '#c08a8a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(5, 18); c.quadraticCurveTo(0, hop ? 6 : 12, 4, 6); c.stroke();
  c.fillStyle = '#b8a89a'; c.strokeStyle = '#6a5a4a'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(14, 17, 9, 6, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(23, 15, 5, 4, 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#f0c8c8'; c.beginPath(); c.arc(20, hop ? 7 : 9, 3.4, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#ff9ab0'; c.beginPath(); c.arc(28, 16, 1.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111'; c.beginPath(); c.arc(24.5, 13.5, 1, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#6a5a4a'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(27, 16); c.lineTo(30, 14); c.moveTo(27, 17); c.lineTo(30, 18); c.stroke();
  if (hop) { c.fillStyle = '#f0c040'; c.beginPath(); c.arc(29, 20, 2, 0, Math.PI * 2); c.fill(); }
}
function beaver(c: Ctx, slap: boolean) {
  c.fillStyle = '#6a5040'; c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.4;
  c.save(); c.translate(9, slap ? 14 : 26); c.rotate(slap ? -1.0 : -0.15); c.beginPath(); c.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(30,20,10,0.5)'; c.lineWidth = 0.6; for (let x = -6; x <= 6; x += 3) { c.beginPath(); c.moveTo(x, -3.5); c.lineTo(x, 3.5); c.stroke(); } c.restore();
  c.fillStyle = '#9a6a40'; c.strokeStyle = '#4a3020'; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(25, 23, 12, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(36, 15, 7, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(33, 8.5, 2, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#c89a70'; c.beginPath(); c.ellipse(40, 18, 4, 3, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.fillRect(39, 20, 3, 3.5); c.strokeStyle = '#4a3020'; c.lineWidth = 0.6; c.strokeRect(39, 20, 3, 3.5);
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(37.5, 13, 1.2, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(42.5, 16.5, 1.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3a2a1a'; c.beginPath(); c.ellipse(20, 33, 4, 2, 0, 0, Math.PI * 2); c.ellipse(31, 33, 4, 2, 0, 0, Math.PI * 2); c.fill();
}
function fawn(c: Ctx, leap: boolean) {
  c.strokeStyle = '#8a5a30'; c.lineWidth = 2.2;
  const legs: [number, number][] = leap ? [[12, 6], [16, 4], [28, -4], [32, -6]] : [[12, 0], [16, 0], [28, 0], [32, 0]];
  for (const [x, d] of legs) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x + d, 45); c.stroke(); }
  c.fillStyle = '#c88a50'; c.strokeStyle = '#7a4a20'; c.lineWidth = 1.4;
  c.beginPath(); c.ellipse(22, 26, 13, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#fff4e0'; c.beginPath(); c.ellipse(9.5, 22, 2.5, 3.5, -0.4, 0, Math.PI * 2); c.fill();
  for (const [x, y] of [[17, 23], [22, 21.5], [27, 23], [20, 27], [25, 27]] as const) { c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#c88a50'; c.strokeStyle = '#7a4a20';
  c.beginPath(); c.moveTo(31, 22); c.lineTo(34, 12); c.lineTo(38, 14); c.lineTo(36, 24); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(37, 11, 5, 4.5, 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(42, 12.5, 3, 2.4, 0.3, 0, Math.PI * 2); c.fill(); c.stroke();
  const ea = leap ? -0.9 : -0.4;
  c.save(); c.translate(34, 7); c.rotate(ea); c.beginPath(); c.ellipse(-3, 0, 4.5, 2, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
  c.save(); c.translate(38, 6); c.rotate(-ea - 2.4); c.beginPath(); c.ellipse(-3, 0, 4.5, 2, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(38.5, 10, 1.3, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(44.5, 12.5, 1, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(38.9, 9.6, 0.45, 0, Math.PI * 2); c.fill();
}

const TEX: [string, Kind, (c: Ctx) => void][] = [
  ['ll_lady', 'ladybug', (c) => ladybug(c, false)], ['ll_lady_fly', 'ladybug', (c) => ladybug(c, true)],
  ['ll_snail', 'snail', (c) => snail(c, true)], ['ll_snail_in', 'snail', (c) => snail(c, false)],
  ['ll_hen', 'hen', (c) => hen(c, false)], ['ll_hen_flap', 'hen', (c) => hen(c, true)],
  ['ll_turtle', 'turtle', (c) => turtle(c)],
  ['ll_goat', 'goat', (c) => goat(c, false)], ['ll_goat_hop', 'goat', (c) => goat(c, true)],
  ['ll_sheep', 'sheep', (c) => sheep(c, false)], ['ll_sheep_baa', 'sheep', (c) => sheep(c, true)],
  ['ll_otter', 'otter', (c) => otter(c, false)], ['ll_otter_roll', 'otter', (c) => otter(c, true)],
  ['ll_mole', 'mole', (c) => mole(c, false)], ['ll_mole_up', 'mole', (c) => mole(c, true)],
  ['ll_hog', 'hedgehog', (c) => hedgehog(c, false)], ['ll_hog_ball', 'hedgehog', (c) => hedgehog(c, true)],
  ['ll_mouse', 'mouse', (c) => mouse(c, false)], ['ll_mouse_hop', 'mouse', (c) => mouse(c, true)],
  ['ll_beaver', 'beaver', (c) => beaver(c, false)], ['ll_beaver_slap', 'beaver', (c) => beaver(c, true)],
  ['ll_fawn', 'fawn', (c) => fawn(c, false)], ['ll_fawn_leap', 'fawn', (c) => fawn(c, true)],
];
const KEY: Record<Kind, [string, string]> = { ladybug: ['ll_lady', 'll_lady_fly'], snail: ['ll_snail', 'll_snail_in'], hen: ['ll_hen', 'll_hen_flap'], turtle: ['ll_turtle', 'll_turtle'],
  goat: ['ll_goat', 'll_goat_hop'], sheep: ['ll_sheep', 'll_sheep_baa'], otter: ['ll_otter', 'll_otter_roll'], mole: ['ll_mole', 'll_mole_up'],
  hedgehog: ['ll_hog', 'll_hog_ball'], mouse: ['ll_mouse', 'll_mouse_hop'], beaver: ['ll_beaver', 'll_beaver_slap'], fawn: ['ll_fawn', 'll_fawn_leap'] };

export class LittleLife {
  list: Critter[] = [];
  /** Test hooks. */
  taps: Record<Kind, number> = { ladybug: 0, snail: 0, hen: 0, turtle: 0, goat: 0, sheep: 0, otter: 0, mole: 0, hedgehog: 0, mouse: 0, beaver: 0, fawn: 0 };
  constructor(private w: WorldScene) {
    for (const [key, kind, draw] of TEX) if (!w.textures.exists(key)) canvasTex(w, key, LIFE[kind].tw, LIFE[kind].th, draw, S, true);
    const busy: number[][] = [...w.interactables.map((it) => [it.x, it.y]), ...w.tappables.map((t) => [t.x(), t.y()])];
    const ws = w as any;
    if (ws.minnows) busy.push([ws.minnows.cx, ws.minnows.cy]);
    if (ws.seagulls) busy.push([ws.seagulls.cx, ws.seagulls.cy]);
    if (ws.sandcastle) busy.push([ws.sandcastle.x, ws.sandcastle.y]);
    if (ws.starfish) busy.push([ws.starfish.cx, ws.starfish.cy]);
    const land = (x: number, y: number) => { const [c, r] = w.nav.cellOf(x, y); return !w.nav.isBlocked(c, r); };
    const pick = (kind: Kind, cands: [number, number][], ok: (x: number, y: number) => boolean, clearD: number, gap: number) => {
      const homes: [number, number][] = [];
      for (const [x, y] of cands) {
        if (homes.length >= LIFE[kind].n) break;
        if (!ok(x, y) || !busy.every(([bx, by]) => Math.hypot(bx - x, by - y) > clearD)) continue;
        if (homes.some(([hx, hy]) => Math.hypot(hx - x, hy - y) < gap)) continue;
        homes.push([x, y]);
      }
      homes.forEach(([x, y]) => { this.add(kind, x, y); busy.push([x, y]); });
    };
    // 99: north of the meadow path, on alternate segments from the dragonflies' hover.
    const lady: [number, number][] = [];
    for (let s = 0; s < PATH_MEADOW.length - 1; s++) for (const t of [0.5, 0.3, 0.7]) for (const dy of [-150, -190, -120, -230]) {
      const [ax, ay] = PATH_MEADOW[s], [bx, by] = PATH_MEADOW[s + 1]; lady.push([ax + (bx - ax) * t, ay + (by - ay) * t + dy]);
    }
    pick('ladybug', lady, land, 90, 420);
    // 100: well outside the fairy ring (puff mushrooms sit on its rim).
    const sn: [number, number][] = [];
    for (let i = 0; i < 90; i++) { const a = 1.1 + i * 2.39996, k = 1.55 + (i % 4) * 0.12; sn.push([GROVE_RING.x + Math.cos(a) * GROVE_RING.r * k, GROVE_RING.y + Math.sin(a) * GROVE_RING.r * k * 0.75]); }
    pick('snail', sn, land, 85, 150);
    // 101: village entry lawn.
    const hn: [number, number][] = [];
    for (let i = 0; i < 90; i++) { const a = 0.3 + i * 2.39996, r = 110 + (i % 6) * 30; hn.push([VILLAGE_ENTRY.x + Math.cos(a) * r, VILLAGE_ENTRY.y + 40 + Math.sin(a) * r * 0.6]); }
    pick('hen', hn, (x, y) => land(x, y) && Math.hypot(x - VILLAGE_SIGN.x, y - VILLAGE_SIGN.y) > 80, 85, 90);
    // 102: bay shallows, eastern side (minnows prefer the west).
    const tu: [number, number][] = [];
    for (const a of [0, 0.3, -0.3, 0.6, -0.6, 0.9, 5.0, 1.2]) for (const k of [0.55, 0.45, 0.65, 0.35, 0.75]) tu.push([BAY.x + Math.cos(a) * BAY.rx * k, BAY.y + Math.sin(a) * BAY.ry * k]);
    pick('turtle', tu, (x, y) => lakeValue(x, y) < 0.8 && lakeValue(x + 60, y) < 0.9 && lakeValue(x - 60, y) < 0.9, 220, 200);
    // 103: on the grass along the village's south edge, west of the entry path (hens sit by the entry; the
    //     village cat naps on the cottage step).
    const ct: [number, number][] = [];
    for (let i = 0; i < 120; i++) { const a = 1.9 + i * 2.39996, r = 40 + (i % 8) * 28; ct.push([VILLAGE_ENTRY.x - 330 + Math.cos(a) * r, VILLAGE.y + VILLAGE.rows * VILLAGE.cell + 50 + Math.sin(a) * r * 0.5]); }
    pick('goat', ct, (x, y) => land(x, y) && x < VILLAGE_ENTRY.x - 140 && Math.hypot(x - VILLAGE_BOARD.x, y - VILLAGE_BOARD.y) > 200, 90, 120);
    // 104: south of the Pinecone Hills path (squirrels live on the north side).
    const sh: [number, number][] = [];
    for (let s = 1; s < PATH_HILLS.length - 1; s++) for (const t of [0.5, 0.25, 0.75]) for (const dy of [170, 210, 250, 140]) {
      const [ax, ay] = PATH_HILLS[s], [bx, by] = PATH_HILLS[s + 1]; sh.push([ax + (bx - ax) * t, ay + (by - ay) * t + dy]);
    }
    pick('sheep', sh, land, 100, 150);
    // 105: Shellwater Lake, west side (the pier and rowboat are on the east).
    const ot: [number, number][] = [];
    for (const a of [Math.PI, Math.PI - 0.3, Math.PI + 0.3, Math.PI - 0.6, Math.PI + 0.6, -Math.PI / 2, Math.PI / 2]) for (const k of [0.5, 0.4, 0.6, 0.3, 0.7]) ot.push([LAKE.x + Math.cos(a) * LAKE.rx * k, LAKE.y + Math.sin(a) * LAKE.ry * k]);
    pick('otter', ot, (x, y) => lakeValue(x, y) < 0.8 && lakeValue(x + 60, y) < 0.9 && lakeValue(x - 60, y) < 0.9 && Math.hypot(x - PIER.x, y - PIER.y1) > 350, 160, 170);
    // 106: on the lawn just south of the cottage garden (clear of the flower pots, their sign and chest).
    const ml: [number, number][] = [];
    for (let i = 0; i < 120; i++) { const a = 0.5 + i * 2.39996, r = 60 + (i % 8) * 30; ml.push([GARDEN.x + 160 + Math.cos(a) * r, GARDEN.y + 320 + Math.sin(a) * r * 0.7]); }
    pick('mole', ml, (x, y) => land(x, y) && y > GARDEN.y + GARDEN.h + 20 && POTS.every((q) => Math.hypot(q.x - x, q.y - y) > 70) && Math.hypot(x - COTTAGE.x, y - COTTAGE.y) > 120, 70, 100);
    // 107: beside the southern orchard path.
    const hg: [number, number][] = [];
    for (let s = 0; s < PATH_ORCHARD_S.length - 1; s++) for (const t of [0.5, 0.3, 0.7]) for (const dx of [-140, 140, -180, 180, -110, 110]) {
      const [ax, ay] = PATH_ORCHARD_S[s], [bx, by] = PATH_ORCHARD_S[s + 1]; hg.push([ax + (bx - ax) * t + dx, ay + (by - ay) * t + 30]);
    }
    pick('hedgehog', hg, land, 90, 260);
    // 108: on the grass around the windmill (east side; the songbird and bells sit nearby).
    const mo: [number, number][] = [];
    for (let i = 0; i < 120; i++) { const a = 0.2 + i * 2.39996, r = 150 + (i % 6) * 26; mo.push([WINDMILL.x + Math.cos(a) * r, WINDMILL.y + 90 + Math.sin(a) * r * 0.55]); }
    pick('mouse', mo, land, 80, 70);
    // 109: riverbank beside the riverside path, as close to the river as walkable land allows.
    const rv = (x: number, y: number) => Math.min(...RIVER_PTS.slice(0, -1).map(([ax, ay], k) => { const [bx, by] = RIVER_PTS[k + 1]; const L = (bx - ax) ** 2 + (by - ay) ** 2 || 1; const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L)); return Math.hypot(x - ax - (bx - ax) * t, y - ay - (by - ay) * t); }));
    const bv: [number, number][] = [];
    for (let s = 1; s < PATH_RIVERSIDE.length - 1; s++) for (const t of [0.5, 0.3, 0.7]) for (const dx of [-90, -120, -150, 90, 120, 150, -180, 180]) {
      const [ax, ay] = PATH_RIVERSIDE[s], [bx, by] = PATH_RIVERSIDE[s + 1]; bv.push([ax + (bx - ax) * t + dx, ay + (by - ay) * t]);
    }
    bv.sort((a, b) => rv(a[0], a[1]) - rv(b[0], b[1]));
    pick('beaver', bv, (x, y) => land(x, y) && rv(x, y) > RIVER_HALF + 25, 90, 100);
    // 110: south of the forest path.
    const fw: [number, number][] = [];
    for (let s = 1; s < PATH_FOREST.length - 1; s++) for (const t of [0.5, 0.3, 0.7]) for (const dy of [160, 200, 240, 130]) {
      const [ax, ay] = PATH_FOREST[s], [bx, by] = PATH_FOREST[s + 1]; fw.push([ax + (bx - ax) * t, ay + (by - ay) * t + dy]);
    }
    pick('fawn', fw, land, 100, 220);
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private add(kind: Kind, x: number, y: number) {
    const w = this.w, key = KEY[kind][0], i = this.list.filter((c) => c.kind === kind).length;
    const base = LIFE[kind].size / (frameScale[key] ?? S);
    const shadow = w.add.ellipse(x, y, LIFE[kind].tw * 0.8, 7, 0x2a3a1a, kind === 'turtle' || kind === 'otter' ? 0 : 0.16).setDepth(y - 2).setVisible(false);
    const img = w.add.image(x, y, key).setOrigin(0.5, 0.9).setScale(base).setFlipX(i % 2 === 1).setDepth(y).setVisible(false);
    const c: Critter = { kind, img, shadow, hx: x, hy: y, x, y, base, ph: i * 1.7 + x * 0.001, t: 0, on: false, i };
    this.list.push(c);
    w.tappables.push({ x: () => c.x, y: () => c.y - 14, r: 40, soft: true, enabled: () => c.on && c.t <= 0, tap: () => this.tap(c) });
  }

  shown(kind: Kind) { return !(LIFE[kind].snowHide && SNOWY.has(theme.id)); }
  of(kind: Kind) { return this.list.filter((c) => c.kind === kind); }

  tap(c: Critter) {
    if (!this.shown(c.kind) || c.t > 0) return false;
    this.taps[c.kind]++;
    c.t = LIFE[c.kind].reactS;
    c.img.setTexture(KEY[c.kind][1]);
    const w = this.w;
    switch (c.kind) {
      case 'ladybug': sfx.ting(); w.burst(c.x, c.y - 10, 0xff8080, 6, 'spark'); break;
      case 'snail': sfx.blip(); w.burst(c.x, c.y - 16, 0xc0f0ff, 8, 'spark'); break;
      case 'hen': sfx.chirp(); sfx.rustle(); w.burst(c.x, c.y - 24, 0xfff6e0, 7); break;
      case 'turtle': sfx.splash(false); w.burst(c.x, c.y, 0xb0f0ff, 10, 'spark'); break;
      case 'goat': sfx.baa(1.35); w.burst(c.x, c.y - 20, 0xfff0c0, 7, 'spark'); break;
      case 'sheep': sfx.baa(); w.burst(c.x, c.y - 20, 0xffffff, 8); break;
      case 'otter': sfx.splash(false); sfx.giggleSoft(); w.burst(c.x, c.y, 0xb0f0ff, 10, 'spark'); break;
      case 'mole': sfx.dig(); w.burst(c.x, c.y - 8, 0xa0704a, 7); break;
      case 'hedgehog': sfx.rustle(); sfx.blip(); w.burst(c.x, c.y - 10, 0xe8c8a0, 6); break;
      case 'mouse': sfx.squeak(); w.burst(c.x, c.y - 8, 0xf0c040, 6, 'spark'); break;
      case 'beaver': sfx.thump(); sfx.splash(false); w.burst(c.x - 14, c.y - 6, 0xb0f0ff, 10, 'spark'); break;
      case 'fawn': sfx.giggleSoft(980); w.burst(c.x, c.y - 34, 0xff9ab0, 6, 'heart'); break;
    }
    if (w.life) w.life.reactions++;
    return true;
  }

  private retheme() {
    for (const c of this.list) if (!this.shown(c.kind)) { c.on = false; c.t = 0; c.img.setVisible(false); c.shadow.setVisible(false); }
  }

  update(dt: number) {
    const v = this.w.cameras.main.worldView, now = this.w.time.now / 1000;
    for (const c of this.list) {
      if (!this.shown(c.kind)) continue;
      const vis = c.hx > v.x - 120 && c.hx < v.right + 120 && c.hy > v.y - 60 && c.hy - 120 < v.bottom;
      if (!vis) { if (c.on) { c.on = false; c.img.setVisible(false); c.shadow.setVisible(false); } if (c.t > 0) { c.t = 0; c.x = c.hx; c.y = c.hy; c.img.setTexture(KEY[c.kind][0]); } continue; }
      if (!c.on) { c.on = true; c.img.setVisible(true); c.shadow.setVisible(true); }
      const R = LIFE[c.kind].reactS;
      if (c.t > 0) c.t = Math.max(0, c.t - dt);
      const p = c.t > 0 ? 1 - c.t / R : 0; // reaction progress 0..1
      let dx = 0, lift = 0, sx = 1, sy = 1, rot = 0;
      switch (c.kind) {
        case 'ladybug':
          if (c.t > 0) { const a = p * Math.PI * 2; dx = Math.sin(a) * 50; lift = Math.sin(p * Math.PI) * 70 + (1 - Math.cos(a)) * 8; rot = Math.cos(a) * 0.4; }
          else { dx = Math.sin(now * 0.5 + c.ph) * 3; rot = Math.sin(now * 0.7 + c.ph) * 0.15; }
          break;
        case 'snail':
          if (c.t > 0) { sy = p < 0.15 ? 1 - p * 1.2 : p > 0.8 ? 1 + Math.sin((p - 0.8) * 5 * Math.PI) * 0.08 : 0.85; sx = 1 / Math.sqrt(sy); if (p > 0.75 && c.img.texture.key !== KEY.snail[0]) c.img.setTexture(KEY.snail[0]); }
          else { dx = Math.sin(now * 0.25 + c.ph) * 10; sx = 1 + Math.sin(now * 2 + c.ph) * 0.03; c.img.setFlipX(Math.cos(now * 0.25 + c.ph) < 0); }
          break;
        case 'hen':
          if (c.t > 0) { lift = Math.sin(p * Math.PI) * 26; if (Math.floor(p * 8) % 2 === 1) c.img.setTexture(KEY.hen[0]); else c.img.setTexture(KEY.hen[1]); }
          else { const peck = Math.max(0, Math.sin(now * 2.2 + c.ph)); rot = (c.img.flipX ? -1 : 1) * peck * peck * 0.35; dx = Math.sin(now * 0.3 + c.ph) * 14; }
          break;
        case 'turtle': {
          if (c.t > 0) { const a = p * Math.PI * 2; dx = Math.sin(a) * 60; lift = -(1 - Math.cos(a)) * 22; rot = -Math.cos(a) * 0.9; }
          else { dx = Math.sin(now * 0.4 + c.ph) * 8; lift = Math.sin(now * 0.6 + c.ph) * 4; rot = Math.sin(now * 0.4 + c.ph) * 0.2; }
          break;
        }
        case 'goat':
          if (c.t > 0) { lift = Math.abs(Math.sin(p * Math.PI * 2)) * 22; rot = (c.img.flipX ? 1 : -1) * Math.sin(p * Math.PI * 2) * 0.25; if (p > 0.85) c.img.setTexture(KEY.goat[0]); }
          else { const bob = Math.max(0, Math.sin(now * 1.1 + c.ph)); rot = (c.img.flipX ? -1 : 1) * bob * bob * 0.18; dx = Math.sin(now * 0.22 + c.ph) * 12; }
          break;
        case 'sheep':
          if (c.t > 0) { lift = Math.abs(Math.sin(p * Math.PI * 2)) * 18; rot = Math.sin(p * Math.PI * 4) * 0.12; }
          else { const graze = Math.max(0, Math.sin(now * 0.9 + c.ph)); rot = (c.img.flipX ? -1 : 1) * graze * 0.12; dx = Math.sin(now * 0.15 + c.ph) * 16; }
          break;
        case 'otter':
          if (c.t > 0) { rot = p * Math.PI * 2 * (c.i % 2 ? -1 : 1); lift = Math.sin(p * Math.PI) * 10; }
          else { dx = Math.sin(now * 0.3 + c.ph) * 14; lift = Math.sin(now * 1.1 + c.ph) * 3; rot = Math.sin(now * 0.8 + c.ph) * 0.08; }
          break;
        case 'mole':
          if (c.t > 0) { lift = 0; rot = p > 0.2 && p < 0.8 ? Math.sin((p - 0.2) * 3 * Math.PI * 2) * 0.12 : 0; sy = p < 0.12 ? 0.85 + p * 1.25 : 1; if (p > 0.82) c.img.setTexture(KEY.mole[0]); }
          else { sy = 1 + Math.max(0, Math.sin(now * 0.7 + c.ph)) ** 8 * 0.08; }
          break;
        case 'hedgehog':
          if (c.t > 0) { const roll = p < 0.15 ? 0 : p > 0.8 ? 1 : (p - 0.15) / 0.65; dx = Math.sin(roll * Math.PI) * 26 * (c.img.flipX ? -1 : 1); rot = roll * Math.PI * 2 * (c.img.flipX ? -1 : 1); lift = 4; if (p > 0.85) c.img.setTexture(KEY.hedgehog[0]); }
          else { dx = Math.sin(now * 0.35 + c.ph) * 10; sx = 1 + Math.sin(now * 3 + c.ph) * 0.03; c.img.setFlipX(Math.cos(now * 0.35 + c.ph) < 0); }
          break;
        case 'mouse':
          if (c.t > 0) { lift = Math.abs(Math.sin(p * Math.PI * 3)) * 16 * (1 - p * 0.5); }
          else { const sn = Math.max(0, Math.sin(now * 3 + c.ph)); rot = (c.img.flipX ? -1 : 1) * sn * 0.08; dx = Math.sin(now * 0.5 + c.ph) * 8; }
          break;
        case 'beaver':
          if (c.t > 0) { if (p > 0.45) c.img.setTexture(KEY.beaver[0]); lift = p < 0.45 ? Math.sin(p / 0.45 * Math.PI) * 6 : 0; sy = p > 0.45 && p < 0.6 ? 0.92 : 1; }
          else { sy = 1 + Math.sin(now * 1.6 + c.ph) * 0.02; rot = Math.sin(now * 0.5 + c.ph) * 0.05; }
          break;
        case 'fawn':
          if (c.t > 0) { const q = Math.min(1, p / 0.7); lift = Math.sin(q * Math.PI) * 34; dx = Math.sin(q * Math.PI) * 14 * (c.img.flipX ? -1 : 1); rot = (c.img.flipX ? 1 : -1) * Math.cos(q * Math.PI) * 0.2; if (p > 0.7) c.img.setTexture(KEY.fawn[0]); }
          else { const bob = Math.max(0, Math.sin(now * 0.8 + c.ph)); rot = (c.img.flipX ? -1 : 1) * bob * 0.08; dx = Math.sin(now * 0.18 + c.ph) * 10; }
          break;
      }
      if (c.t <= 0 && c.img.texture.key !== KEY[c.kind][0]) c.img.setTexture(KEY[c.kind][0]);
      c.x = c.hx + dx; c.y = c.hy - lift;
      c.img.setPosition(c.x, c.y).setScale(c.base * sx, c.base * sy).setRotation(rot).setDepth(c.kind === 'ladybug' && lift > 5 ? c.hy + 200 : c.hy);
      c.shadow.setPosition(c.hx + dx, c.hy).setScale(1 - Math.min(0.6, Math.max(0, lift) / 120));
    }
  }

  stats(kind: Kind) {
    return {
      taps: this.taps[kind], shown: this.shown(kind),
      list: this.of(kind).map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), hx: Math.round(c.hx), hy: Math.round(c.hy), on: c.on, busy: c.t > 0, visible: c.img.visible })),
    };
  }
}
