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
// 111–114: little life 4 (same engine):
// 111 Lake swans: white swans glide on Shellwater Lake's south side (clear of the otters, pier and rowboat);
//     tap = wings up + a soft honk + ripple. Hidden in snow (the lake freezes).
// 112 Village piglets: pink piglets on the grass along the village's south-west edge (west of the goats);
//     tap = oink + a happy mud wiggle with mud splats. All themes.
// 113 Meadow bumblebees: fuzzy bumblebees hover over the flowers south of the Sunflower Meadow path
//     (ladybugs are north); tap = a buzzy loop-the-loop + pollen sparkles. Hidden in snow.
// 114 River heron: a tall grey heron on the river's east bank (far from the beaver); tap = beak dip,
//     catches a little fish, gulp + sparkle. Hidden in snow (it flies south).
// 115–118: little life 5 (same engine):
// 115 Grove fox kits: orange fox kits beside the Fairy Grove path; tap = a playful pounce + tail swish + yip. All themes.
// 116 Hillside ponies: small ponies grazing beside the Meadow-to-Hills path; tap = neigh + a prance with hearts. All themes.
// 117 Shore kittens: kittens with yarn balls beside the south shore path; tap = meow + pounce on the yarn. All themes.
// 118 Bay path robins: robins hop north of the Seashell Bay path; tap = hop-hop + chirp song with notes. Hidden in snow.
// 119–122: little life 6 (same engine):
// 119 Lighthouse puffins: puffins on the grass by the lighthouse; tap = wing flap + a happy waddle + chirp. All themes.
// 120 Orchard puppies: puppies beside the orchard path; tap = woof + a happy spin with hearts. All themes.
// 121 Lake path chipmunks: chipmunks beside the Shellwater Lake path; tap = cheeks puff up with an acorn + squeak. Hidden in snow.
// 122 Hills bear cub: a bear cub beside the Hills-to-Bay path; tap = rolls onto its back, feet up, giggly rawr. Hidden in snow.
// Culled off-screen.
import Phaser from 'phaser';
import { Ctx, canvasTex, frameScale, S } from './art';
import { sfx } from './audio';
import { theme, themeEvents } from './theme';
import { PATH_MEADOW, GROVE_RING, VILLAGE, VILLAGE_ENTRY, VILLAGE_SIGN, VILLAGE_BOARD, BAY, PATH_HILLS, LAKE, PIER, GARDEN, COTTAGE, POTS, PATH_ORCHARD_S, WINDMILL, PATH_RIVERSIDE, PATH_FOREST, RIVER_PTS, RIVER_HALF, PATH_GROVE, PATH_MEADOW_HILLS, PATH_SHORE_S, PATH_BAY, PATH_ORCHARD, PATH_LAKE, LIGHTHOUSE, PATH_HILLS_BAY } from './layout';
import { lakeValue, riverXAt, riverHalfAt, onBridge } from './geo';
import type { WorldScene } from './scenes/World';

export type Kind = 'ladybug' | 'snail' | 'hen' | 'turtle' | 'goat' | 'sheep' | 'otter' | 'mole' | 'hedgehog' | 'mouse' | 'beaver' | 'fawn' | 'swan' | 'piglet' | 'bee' | 'heron' | 'fox' | 'pony' | 'kitten' | 'robin' | 'puffin' | 'puppy' | 'chipmunk' | 'bearcub';
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
  swan: { n: 2, size: 1.35, reactS: 2.0, snowHide: true, tw: 48, th: 44 },
  piglet: { n: 2, size: 1.3, reactS: 1.6, snowHide: false, tw: 40, th: 32 },
  bee: { n: 3, size: 1.6, reactS: 2.2, snowHide: true, tw: 28, th: 24 },
  heron: { n: 1, size: 1.4, reactS: 2.4, snowHide: true, tw: 40, th: 64 },
  fox: { n: 2, size: 1.35, reactS: 1.6, snowHide: false, tw: 48, th: 36 },
  pony: { n: 2, size: 1.45, reactS: 1.8, snowHide: false, tw: 52, th: 48 },
  kitten: { n: 2, size: 1.3, reactS: 1.4, snowHide: false, tw: 48, th: 34 },
  robin: { n: 3, size: 1.4, reactS: 1.6, snowHide: true, tw: 28, th: 28 },
  puffin: { n: 2, size: 1.4, reactS: 1.6, snowHide: false, tw: 32, th: 36 },
  puppy: { n: 2, size: 1.35, reactS: 1.4, snowHide: false, tw: 48, th: 38 },
  chipmunk: { n: 2, size: 1.35, reactS: 1.6, snowHide: true, tw: 32, th: 28 },
  bearcub: { n: 1, size: 1.4, reactS: 2.2, snowHide: true, tw: 48, th: 44 },
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

function swan(c: Ctx, wings: boolean) {
  c.fillStyle = 'rgba(160,210,240,0.55)'; c.beginPath(); c.ellipse(24, 40, 20, 3.5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff'; c.strokeStyle = '#8a9aaa'; c.lineWidth = 1.4;
  if (wings) {
    c.beginPath(); c.moveTo(18, 30); c.quadraticCurveTo(4, 14, 8, 4); c.quadraticCurveTo(16, 14, 26, 26); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(22, 30); c.quadraticCurveTo(14, 12, 22, 6); c.quadraticCurveTo(26, 18, 30, 27); c.closePath(); c.fill(); c.stroke();
  }
  c.beginPath(); c.moveTo(6, 30); c.quadraticCurveTo(4, 40, 22, 40); c.quadraticCurveTo(34, 40, 36, 31); c.quadraticCurveTo(22, 26, 6, 30); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(6, 30); c.lineTo(2, 25); c.lineTo(10, 29); c.fill(); c.stroke();
  c.lineWidth = 4.5; c.strokeStyle = '#8a9aaa'; c.beginPath(); c.moveTo(33, 32); c.quadraticCurveTo(40, 22, 34, 16); c.quadraticCurveTo(30, 10, 36, 7); c.stroke();
  c.lineWidth = 3; c.strokeStyle = '#ffffff'; c.beginPath(); c.moveTo(33, 32); c.quadraticCurveTo(40, 22, 34, 16); c.quadraticCurveTo(30, 10, 36, 7); c.stroke();
  c.fillStyle = '#ffffff'; c.strokeStyle = '#8a9aaa'; c.lineWidth = 1; c.beginPath(); c.arc(37, 7.5, 3.6, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#f08a30'; c.strokeStyle = '#a0501a'; c.beginPath(); c.moveTo(39.5, 6); c.lineTo(46, 9); c.lineTo(39.5, 10); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(38.3, 6.6, 1, 0, Math.PI * 2); c.fill();
}
function piglet(c: Ctx, wiggle: boolean) {
  if (wiggle) { c.fillStyle = '#8a6040'; c.beginPath(); c.ellipse(20, 29, 17, 3, 0, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#d07890'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(6, 15); c.bezierCurveTo(0, 13, 2, 7, 5, 10); c.bezierCurveTo(7, 12, 4, 14, 3, 12); c.stroke();
  c.fillStyle = '#ffb8c8'; c.strokeStyle = '#c06880'; c.lineWidth = 1.4;
  for (const x of [11, 16, 24, 29]) { c.fillRect(x - 1.6, 21, 3.2, 7); c.strokeRect(x - 1.6, 21, 3.2, 7); }
  c.beginPath(); c.ellipse(19, 18, 13, 8.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(30, 14, 7, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(26, 9); c.lineTo(25, 3); c.lineTo(30, 7); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(31, 8); c.lineTo(33, 2); c.lineTo(35, 8); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ff98b0'; c.beginPath(); c.ellipse(36.5, 16, 3, 3.6, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#a04060'; c.beginPath(); c.arc(35.6, 15, 0.7, 0, Math.PI * 2); c.arc(37.4, 15, 0.7, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1a1a1a'; c.fillStyle = '#1a1a1a'; c.lineWidth = 1.1;
  if (wiggle) { c.beginPath(); c.arc(31, 12.5, 1.6, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  else { c.beginPath(); c.arc(31.5, 12, 1.2, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = 'rgba(255,120,150,0.5)'; c.beginPath(); c.arc(29, 17, 1.8, 0, Math.PI * 2); c.fill();
  if (wiggle) { c.fillStyle = '#8a6040'; for (const [x, y, r] of [[14, 16, 2.2], [21, 21, 1.8], [24, 14, 1.4], [10, 21, 1.5]] as const) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); } }
}
function bee(c: Ctx, buzz: boolean) {
  c.fillStyle = buzz ? 'rgba(230,245,255,0.55)' : 'rgba(230,245,255,0.8)'; c.strokeStyle = 'rgba(120,150,180,0.8)'; c.lineWidth = 0.8;
  const wl = buzz ? 7.5 : 6;
  c.beginPath(); c.ellipse(11, 6, wl, 3.6, -0.5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(16, 5.5, wl, 3.6, 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#f6c21c'; c.strokeStyle = '#4a3010'; c.lineWidth = 1.3;
  c.beginPath(); c.ellipse(13, 14, 9, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.save(); c.beginPath(); c.ellipse(13, 14, 9, 7, 0, 0, Math.PI * 2); c.clip(); c.fillStyle = '#2a2018'; c.fillRect(8, 6, 3, 16); c.fillRect(14, 6, 3, 16); c.restore();
  c.fillStyle = '#2a2018'; c.beginPath(); c.moveTo(4, 14); c.lineTo(1, 15); c.lineTo(4, 16); c.fill();
  c.beginPath(); c.arc(22, 13, 4.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(23.5, 11.8, 1.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111'; c.beginPath(); c.arc(23.9, 11.9, 0.7, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#2a2018'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(21, 9); c.quadraticCurveTo(21, 4, 19, 3); c.moveTo(23, 9); c.quadraticCurveTo(25, 4, 26, 3.5); c.stroke();
  c.fillStyle = 'rgba(255,140,160,0.6)'; c.beginPath(); c.arc(24.5, 15, 1.2, 0, Math.PI * 2); c.fill();
}
function heron(c: Ctx, dip: boolean) {
  c.strokeStyle = '#c8a040'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(17, 40); c.lineTo(16, 62); c.moveTo(21, 40); c.lineTo(23, 62); c.moveTo(16, 62); c.lineTo(12, 63); c.moveTo(23, 62); c.lineTo(27, 63); c.stroke();
  c.fillStyle = '#9aa8b8'; c.strokeStyle = '#4a5868'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(6, 30); c.quadraticCurveTo(10, 22, 22, 24); c.quadraticCurveTo(30, 28, 27, 38); c.quadraticCurveTo(18, 44, 10, 38); c.lineTo(3, 40); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#6a7888'; c.beginPath(); c.moveTo(9, 30); c.quadraticCurveTo(16, 27, 24, 31); c.quadraticCurveTo(18, 36, 9, 34); c.closePath(); c.fill();
  if (dip) {
    c.strokeStyle = '#4a5868'; c.lineWidth = 5; c.beginPath(); c.moveTo(25, 28); c.quadraticCurveTo(32, 30, 33, 42); c.stroke();
    c.strokeStyle = '#d8e0e8'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(25, 28); c.quadraticCurveTo(32, 30, 33, 42); c.stroke();
    c.fillStyle = '#d8e0e8'; c.strokeStyle = '#4a5868'; c.lineWidth = 1.2; c.beginPath(); c.arc(33, 45, 4, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#e8b040'; c.strokeStyle = '#8a6010'; c.beginPath(); c.moveTo(35, 46); c.lineTo(38, 57); c.lineTo(32, 48); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#8ad0f0'; c.strokeStyle = '#3a7090'; c.beginPath(); c.ellipse(37, 54, 4.5, 2, 0.4, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(33.5, 52); c.lineTo(31, 50); c.lineTo(32, 54); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(34.5, 44, 0.9, 0, Math.PI * 2); c.fill();
  } else {
    c.strokeStyle = '#4a5868'; c.lineWidth = 5; c.beginPath(); c.moveTo(24, 27); c.quadraticCurveTo(30, 20, 25, 14); c.quadraticCurveTo(21, 9, 26, 6); c.stroke();
    c.strokeStyle = '#d8e0e8'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(24, 27); c.quadraticCurveTo(30, 20, 25, 14); c.quadraticCurveTo(21, 9, 26, 6); c.stroke();
    c.fillStyle = '#d8e0e8'; c.strokeStyle = '#4a5868'; c.lineWidth = 1.2; c.beginPath(); c.arc(27, 6, 4, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#2a3848'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(25, 3.5); c.lineTo(17, 2); c.stroke();
    c.fillStyle = '#e8b040'; c.strokeStyle = '#8a6010'; c.beginPath(); c.moveTo(30, 5); c.lineTo(39, 7); c.lineTo(30, 8); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(28, 5.2, 0.9, 0, Math.PI * 2); c.fill();
  }
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
  ['ll_swan', 'swan', (c) => swan(c, false)], ['ll_swan_wings', 'swan', (c) => swan(c, true)],
  ['ll_piglet', 'piglet', (c) => piglet(c, false)], ['ll_piglet_mud', 'piglet', (c) => piglet(c, true)],
  ['ll_bee', 'bee', (c) => bee(c, false)], ['ll_bee_buzz', 'bee', (c) => bee(c, true)],
  ['ll_heron', 'heron', (c) => heron(c, false)], ['ll_heron_dip', 'heron', (c) => heron(c, true)],
  ['ll_fox', 'fox', (c) => fox(c, false)], ['ll_fox_pounce', 'fox', (c) => fox(c, true)],
  ['ll_pony', 'pony', (c) => pony(c, false)], ['ll_pony_prance', 'pony', (c) => pony(c, true)],
  ['ll_kitten', 'kitten', (c) => kitten(c, false)], ['ll_kitten_pounce', 'kitten', (c) => kitten(c, true)],
  ['ll_robin', 'robin', (c) => robin(c, false)], ['ll_robin_sing', 'robin', (c) => robin(c, true)],
  ['ll_puffin', 'puffin', (c) => puffin(c, false)], ['ll_puffin_flap', 'puffin', (c) => puffin(c, true)],
  ['ll_puppy', 'puppy', (c) => puppy(c, false)], ['ll_puppy_happy', 'puppy', (c) => puppy(c, true)],
  ['ll_chip', 'chipmunk', (c) => chipmunk(c, false)], ['ll_chip_puff', 'chipmunk', (c) => chipmunk(c, true)],
  ['ll_bear', 'bearcub', (c) => bearcub(c, false)], ['ll_bear_roll', 'bearcub', (c) => bearcub(c, true)],
];
const KEY: Record<Kind, [string, string]> = { ladybug: ['ll_lady', 'll_lady_fly'], snail: ['ll_snail', 'll_snail_in'], hen: ['ll_hen', 'll_hen_flap'], turtle: ['ll_turtle', 'll_turtle'],
  goat: ['ll_goat', 'll_goat_hop'], sheep: ['ll_sheep', 'll_sheep_baa'], otter: ['ll_otter', 'll_otter_roll'], mole: ['ll_mole', 'll_mole_up'],
  hedgehog: ['ll_hog', 'll_hog_ball'], mouse: ['ll_mouse', 'll_mouse_hop'], beaver: ['ll_beaver', 'll_beaver_slap'], fawn: ['ll_fawn', 'll_fawn_leap'],
  swan: ['ll_swan', 'll_swan_wings'], piglet: ['ll_piglet', 'll_piglet_mud'], bee: ['ll_bee', 'll_bee_buzz'], heron: ['ll_heron', 'll_heron_dip'],
  fox: ['ll_fox', 'll_fox_pounce'], pony: ['ll_pony', 'll_pony_prance'], kitten: ['ll_kitten', 'll_kitten_pounce'], robin: ['ll_robin', 'll_robin_sing'],
  puffin: ['ll_puffin', 'll_puffin_flap'], puppy: ['ll_puppy', 'll_puppy_happy'], chipmunk: ['ll_chip', 'll_chip_puff'], bearcub: ['ll_bear', 'll_bear_roll'] };

function fox(c: Ctx, pounce: boolean) {
  // bushy tail (up when pouncing)
  c.fillStyle = '#e8762a'; c.strokeStyle = '#8a3e10'; c.lineWidth = 1.4;
  c.beginPath();
  if (pounce) { c.moveTo(14, 22); c.quadraticCurveTo(2, 18, 4, 4); c.quadraticCurveTo(12, 8, 18, 20); }
  else { c.moveTo(14, 24); c.quadraticCurveTo(0, 26, 2, 14); c.quadraticCurveTo(10, 14, 18, 22); }
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#fffaf0'; c.beginPath(); if (pounce) c.arc(4.5, 6, 3, 0, Math.PI * 2); else c.arc(3, 15.5, 3, 0, Math.PI * 2); c.fill();
  const by = pounce ? 22 : 21;
  c.strokeStyle = '#3a2010'; c.lineWidth = 2.2;
  for (const [x, dx] of [[16, pounce ? -4 : 0], [21, pounce ? -3 : 0], [30, pounce ? 4 : 0], [34, pounce ? 5 : 0]] as const) { c.beginPath(); c.moveTo(x, by + 4); c.lineTo(x + dx, 34); c.stroke(); }
  c.fillStyle = '#e8762a'; c.strokeStyle = '#8a3e10'; c.lineWidth = 1.4;
  c.beginPath(); c.ellipse(25, by, 12, pounce ? 6 : 7, pounce ? 0.12 : 0, 0, Math.PI * 2); c.fill(); c.stroke();
  const hx = 38, hy = pounce ? 19 : 14;
  c.beginPath(); c.moveTo(hx - 6, hy - 3); c.lineTo(hx - 5, hy - 12); c.lineTo(hx - 1, hy - 5); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(hx + 1, hy - 5); c.lineTo(hx + 4, hy - 13); c.lineTo(hx + 6, hy - 3); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.arc(hx, hy, 7, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#fffaf0'; c.beginPath(); c.moveTo(hx - 2, hy + 1); c.quadraticCurveTo(hx + 6, hy + 8, hx + 10, hy + 2); c.quadraticCurveTo(hx + 4, hy - 1, hx - 2, hy + 1); c.fill();
  c.beginPath(); c.ellipse(28, by + 3, 5, 3, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(hx + 10, hy + 2, 1.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(hx + 2, hy - 2, 1.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 2.4, hy - 2.4, 0.45, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,130,150,0.5)'; c.beginPath(); c.arc(hx + 3, hy + 3, 1.6, 0, Math.PI * 2); c.fill();
}
function pony(c: Ctx, prance: boolean) {
  c.strokeStyle = '#6a4a30'; c.lineWidth = 3;
  const legs: [number, number, number][] = prance ? [[14, 0, 44], [20, 0, 44], [33, 6, 36], [38, 8, 34]] : [[14, 0, 45], [20, 0, 45], [33, 0, 45], [38, 0, 45]];
  for (const [x, dx, y2] of legs) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x + dx, y2); c.stroke(); }
  c.fillStyle = '#5a3a20'; for (const [x, dx, y2] of legs) c.fillRect(x + dx - 2, y2 - 2, 4, 3);
  // tail
  c.strokeStyle = '#f4e0b0'; c.lineWidth = 4; c.beginPath(); c.moveTo(9, 24); c.quadraticCurveTo(2, 28, 4, 38); c.stroke();
  c.fillStyle = '#c88a58'; c.strokeStyle = '#7a4a28'; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(25, 26, 16, 9, prance ? -0.12 : 0, 0, Math.PI * 2); c.fill(); c.stroke();
  const hx = prance ? 42 : 43, hy = prance ? 10 : (14);
  c.beginPath(); c.moveTo(34, 22); c.lineTo(hx - 4, hy + 2); c.lineTo(hx + 2, hy + 4); c.lineTo(40, 26); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(hx, hy + 3, 5.5, 8, prance ? -0.7 : -0.9, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(hx - 4, hy - 3); c.lineTo(hx - 4, hy - 9); c.lineTo(hx - 1, hy - 4); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#f4e0b0'; c.strokeStyle = '#c0a070'; c.lineWidth = 1;
  for (const [x, y] of [[hx - 5, hy - 2], [hx - 7, hy + 3], [36, 17], [33, 20]] as const) { c.beginPath(); c.ellipse(x, y, 3, 4.5, 0.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(hx + 1, hy, 1.4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 1.4, hy - 0.4, 0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#5a3a20'; c.beginPath(); c.arc(hx + 4.5, hy + 7, 0.9, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,130,150,0.55)'; c.beginPath(); c.arc(hx - 1, hy + 4, 1.8, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(hx + 2, hy - 3, 1.2, 2, -0.7, 0, Math.PI * 2); c.fill();
}
function kitten(c: Ctx, pounce: boolean) {
  // yarn ball
  const yx = pounce ? 38 : 40, yy = 26;
  c.fillStyle = '#ff7aa8'; c.strokeStyle = '#b03a6a'; c.lineWidth = 1.2;
  c.beginPath(); c.arc(yx, yy, 6, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(yx - 1, yy, 4, -1.2, 1.4); c.moveTo(yx - 5, yy - 2); c.quadraticCurveTo(yx, yy + 2, yx + 4, yy - 4); c.stroke();
  c.beginPath(); c.moveTo(yx - 6, yy + 3); c.quadraticCurveTo(yx - 10, yy + 7, yx - 14, yy + 6); c.stroke();
  c.fillStyle = '#b8b8c8'; c.strokeStyle = '#5a5a6a'; c.lineWidth = 1.4;
  const hx = pounce ? 27 : 20, hy = pounce ? 16 : 13;
  if (pounce) {
    c.beginPath(); c.moveTo(6, 24); c.quadraticCurveTo(0, 12, 6, 6); c.lineWidth = 3.2; c.stroke(); c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(18, 23, 11, 6, -0.15, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(31, 25, 3.5, 2.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(27, 16, 6.5, 0, Math.PI * 2); c.fill(); c.stroke();
  } else {
    c.lineWidth = 3.2; c.beginPath(); c.moveTo(10, 30); c.quadraticCurveTo(2, 30, 4, 22); c.stroke(); c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(16, 24, 9, 8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(21, 30, 3.5, 2.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(20, 13, 7, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.beginPath(); c.moveTo(hx - 6, hy - 3); c.lineTo(hx - 5, hy - 11); c.lineTo(hx - 1, hy - 6); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(hx + 1, hy - 6); c.lineTo(hx + 5, hy - 11); c.lineTo(hx + 6, hy - 3); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#7a7a8a'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(hx - 2, hy - 6.5); c.lineTo(hx - 2, hy - 3.5); c.moveTo(hx + 1, hy - 6.5); c.lineTo(hx + 1, hy - 3.5); c.stroke();
  c.fillStyle = '#ffb0c0'; c.beginPath(); c.moveTo(hx - 4.5, hy - 5); c.lineTo(hx - 4.5, hy - 8.5); c.lineTo(hx - 2.5, hy - 6); c.fill();
  c.fillStyle = '#1a1a1a';
  if (pounce) { c.beginPath(); c.arc(hx - 2.5, hy, 1.6, 0, Math.PI * 2); c.arc(hx + 3, hy, 1.6, 0, Math.PI * 2); c.fill(); }
  else { c.strokeStyle = '#1a1a1a'; c.lineWidth = 1.1; c.beginPath(); c.arc(hx - 2.5, hy, 1.5, Math.PI * 1.1, Math.PI * 1.9); c.moveTo(hx + 4.5, hy); c.arc(hx + 3, hy, 1.5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  c.fillStyle = '#ff8aa0'; c.beginPath(); c.moveTo(hx - 0.8, hy + 2.5); c.lineTo(hx + 1.6, hy + 2.5); c.lineTo(hx + 0.4, hy + 3.8); c.fill();
  c.strokeStyle = '#ffffff'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(hx + 4, hy + 3); c.lineTo(hx + 10, hy + 2); c.moveTo(hx + 4, hy + 4); c.lineTo(hx + 10, hy + 5); c.moveTo(hx - 3, hy + 3); c.lineTo(hx - 9, hy + 2); c.stroke();
  c.fillStyle = 'rgba(255,130,150,0.5)'; c.beginPath(); c.arc(hx - 4, hy + 3.5, 1.5, 0, Math.PI * 2); c.arc(hx + 5, hy + 3.5, 1.5, 0, Math.PI * 2); c.fill();
}
function robin(c: Ctx, sing: boolean) {
  c.strokeStyle = '#a07040'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(12, 21); c.lineTo(11, 27); c.moveTo(16, 21); c.lineTo(17, 27); c.stroke();
  c.fillStyle = '#7a5a40'; c.strokeStyle = '#3a2818'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(6, 15); c.lineTo(0, 11); c.lineTo(1, 16); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(13, 15, 8.5, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#f06a2a'; c.beginPath(); c.ellipse(16, 16.5, 5.5, 5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#6a4a30'; c.beginPath(); c.ellipse(10, 14, 5, 3.2, 0.3, 0, Math.PI * 2); c.fill();
  const hy = sing ? 6 : 8;
  c.fillStyle = '#7a5a40'; c.strokeStyle = '#3a2818'; c.beginPath(); c.arc(19, hy, 5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#f06a2a'; c.beginPath(); c.arc(20, hy + 3.5, 2.5, 0, Math.PI); c.fill();
  c.fillStyle = '#f0c040'; c.strokeStyle = '#8a6010'; c.lineWidth = 0.8;
  if (sing) { c.beginPath(); c.moveTo(23, hy - 1.5); c.lineTo(28, hy - 3.5); c.lineTo(23.5, hy); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(23, hy + 0.5); c.lineTo(27.5, hy + 2.5); c.lineTo(23, hy + 1.8); c.closePath(); c.fill(); c.stroke(); }
  else { c.beginPath(); c.moveTo(23, hy - 1); c.lineTo(27.5, hy); c.lineTo(23, hy + 1.2); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(20.5, hy - 1, 1.1, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(20.8, hy - 1.3, 0.4, 0, Math.PI * 2); c.fill();
}

const TAU = Math.PI * 2;
function puffin(c: Ctx, flap: boolean) {
  c.strokeStyle = '#d0601a'; c.lineWidth = 2; c.beginPath(); c.moveTo(13, 30); c.lineTo(12, 34); c.moveTo(19, 30); c.lineTo(20, 34); c.stroke();
  c.fillStyle = '#ff8a2a'; c.beginPath(); c.ellipse(11, 34.5, 3, 1.2, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(21, 34.5, 3, 1.2, 0, 0, TAU); c.fill();
  c.fillStyle = '#22242c'; c.strokeStyle = '#0a0a10'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(16, 22, 9, 10, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#fbfbf6'; c.beginPath(); c.ellipse(17.5, 24, 6, 7.5, 0, 0, TAU); c.fill();
  c.fillStyle = '#22242c';
  if (flap) {
    c.beginPath(); c.moveTo(9, 18); c.lineTo(1, 7); c.lineTo(8, 23); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(23, 18); c.lineTo(31, 7); c.lineTo(24, 23); c.closePath(); c.fill(); c.stroke();
  } else { c.beginPath(); c.ellipse(9.5, 23, 3, 7, 0.15, 0, TAU); c.fill(); c.stroke(); }
  c.beginPath(); c.arc(16, 10, 7, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#e8e8e2'; c.beginPath(); c.ellipse(17, 11, 4.5, 4, 0, 0, TAU); c.fill();
  c.fillStyle = '#ff6a1a'; c.strokeStyle = '#9a3a10'; c.lineWidth = 0.9;
  if (flap) {
    c.beginPath(); c.moveTo(20, 8.5); c.quadraticCurveTo(27, 8, 27, 11); c.lineTo(20, 11.5); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(20, 12.5); c.lineTo(26, 14); c.lineTo(20, 14.5); c.closePath(); c.fill(); c.stroke();
  } else { c.beginPath(); c.moveTo(20, 8.5); c.quadraticCurveTo(27, 10, 26, 13.5); c.lineTo(20, 13.5); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = '#f0c040'; c.fillRect(20, 9, 1.6, 4.5);
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(17.5, 10, 1.2, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,130,150,0.55)'; c.beginPath(); c.arc(17, 13.5, 1.4, 0, TAU); c.fill();
}
function puppy(c: Ctx, happy: boolean) {
  c.strokeStyle = '#8a6030'; c.lineWidth = 3.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(11, 22); if (happy) c.quadraticCurveTo(3, 14, 6, 6); else c.quadraticCurveTo(3, 22, 4, 29); c.stroke();
  c.strokeStyle = '#e8c890'; c.lineWidth = 1.8; c.stroke();
  c.fillStyle = '#e8c890'; c.strokeStyle = '#8a6030'; c.lineWidth = 1.3;
  for (const x of [14, 19, 28, 33]) { c.fillRect(x - 2, 26, 4, 9); c.strokeRect(x - 2, 26, 4, 9); }
  c.beginPath(); c.ellipse(23, 24, 13, 8, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#b07a40'; c.beginPath(); c.ellipse(20, 21, 5, 3.5, 0.2, 0, TAU); c.fill();
  const hx = 36, hy = happy ? 12 : 13;
  c.strokeStyle = '#e83a3a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(hx - 7, hy + 4); c.quadraticCurveTo(hx - 3, hy + 9, hx + 2, hy + 7); c.stroke();
  c.fillStyle = '#f0c040'; c.beginPath(); c.arc(hx - 2, hy + 9, 1.6, 0, TAU); c.fill();
  c.fillStyle = '#e8c890'; c.strokeStyle = '#8a6030'; c.lineWidth = 1.3;
  c.beginPath(); c.arc(hx, hy, 8, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#fff4e0'; c.beginPath(); c.ellipse(hx + 4, hy + 3.5, 4.5, 3.2, 0, 0, TAU); c.fill();
  c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(hx + 7.5, hy + 2, 1.7, 0, TAU); c.fill();
  c.fillStyle = '#8a5a2a'; c.beginPath(); c.ellipse(hx - 5, hy + (happy ? -3 : 2), 3, 6.5, happy ? -1.0 : 0.25, 0, TAU); c.fill(); c.stroke();
  if (happy) {
    c.fillStyle = '#ff7a90'; c.beginPath(); c.ellipse(hx + 4, hy + 8, 1.8, 2.6, 0, 0, TAU); c.fill();
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 1.1; c.beginPath(); c.arc(hx + 2.5, hy - 1, 1.6, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  } else {
    c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(hx + 2.5, hy - 1.5, 1.5, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 3, hy - 2, 0.5, 0, TAU); c.fill();
  }
  c.fillStyle = 'rgba(255,130,150,0.5)'; c.beginPath(); c.arc(hx + 1, hy + 4, 1.5, 0, TAU); c.fill();
}
function chipmunk(c: Ctx, puff: boolean) {
  c.fillStyle = '#a0683a'; c.strokeStyle = '#5a3418'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(10, 22); c.quadraticCurveTo(0, 20, 3, 5); c.quadraticCurveTo(9, 7, 13, 19); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#c08850'; c.beginPath(); c.ellipse(16, 20, 8, 7, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#f6e6c8'; c.beginPath(); c.ellipse(18.5, 21.5, 4, 5, 0, 0, TAU); c.fill();
  c.strokeStyle = '#3a2010'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(10, 16); c.quadraticCurveTo(12, 19, 11, 24); c.moveTo(13, 14); c.quadraticCurveTo(15.5, 18, 14.5, 23); c.stroke();
  const hx = 21, hy = 11;
  c.fillStyle = '#c08850'; c.strokeStyle = '#5a3418'; c.lineWidth = 1.2;
  c.beginPath(); c.arc(hx - 3, hy - 6, 2.2, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.arc(hx, hy, 6, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#f6e6c8'; c.beginPath(); c.ellipse(hx + 2, hy + 2.5, puff ? 4.6 : 2.8, puff ? 3.8 : 2.2, 0, 0, TAU); c.fill(); if (puff) c.stroke();
  c.strokeStyle = '#3a2010'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx - 4, hy - 1); c.lineTo(hx + 4, hy - 2.5); c.stroke();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(hx + 1.5, hy - 1.8, 1.3, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 1.9, hy - 2.2, 0.45, 0, TAU); c.fill();
  c.fillStyle = '#3a2010'; c.beginPath(); c.arc(hx + 6, hy + 0.5, 0.9, 0, TAU); c.fill();
  if (puff) {
    c.fillStyle = '#b07a30'; c.strokeStyle = '#5a3418'; c.beginPath(); c.ellipse(25.5, 23, 2.6, 3.2, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#6a4420'; c.beginPath(); c.ellipse(25.5, 20, 3, 1.6, 0, 0, TAU); c.fill();
    c.fillStyle = '#c08850'; c.beginPath(); c.arc(23.2, 22, 1.6, 0, TAU); c.arc(27.8, 22, 1.6, 0, TAU); c.fill();
  }
}
function bearcub(c: Ctx, roll: boolean) {
  const fur = '#7a4e2a', line = '#3a2210', tan = '#c89a6a';
  c.fillStyle = fur; c.strokeStyle = line; c.lineWidth = 1.6;
  const blob = (x: number, y: number, rx: number, ry: number, r = 0, col = fur, st = true) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, r, 0, TAU); c.fill(); if (st) c.stroke(); };
  if (!roll) {
    blob(24, 30, 12, 11); blob(24, 32, 7, 7, 0, tan, false);
    blob(13, 30, 3.5, 6, 0.3); blob(35, 30, 3.5, 6, -0.3);
    blob(16, 40, 5, 3.5); blob(32, 40, 5, 3.5); blob(16, 40, 2.5, 1.8, 0, tan, false); blob(32, 40, 2.5, 1.8, 0, tan, false);
    const hx = 24, hy = 14;
    blob(hx - 8, hy - 7, 4, 4); blob(hx + 8, hy - 7, 4, 4); blob(hx - 8, hy - 7, 2, 2, 0, tan, false); blob(hx + 8, hy - 7, 2, 2, 0, tan, false);
    blob(hx, hy, 10, 9.5);
    blob(hx, hy + 4, 4.5, 3.5, 0, '#d8b080', false); blob(hx, hy + 2.5, 2, 1.4, 0, '#2a1a10', false);
    c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(hx - 4, hy - 1.5, 1.5, 0, TAU); c.arc(hx + 4, hy - 1.5, 1.5, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,130,150,0.5)'; c.beginPath(); c.arc(hx - 6.5, hy + 3, 1.8, 0, TAU); c.arc(hx + 6.5, hy + 3, 1.8, 0, TAU); c.fill();
  } else {
    blob(15, 22, 3.5, 7, -0.4); blob(32, 22, 3.5, 7, 0.4);
    blob(13, 15.5, 3, 2.2, 0, tan); blob(34, 15.5, 3, 2.2, 0, tan);
    blob(26, 33, 15, 9); blob(26, 31, 9, 5, 0, tan, false);
    blob(41, 28, 3, 5, -0.6);
    const hx = 11, hy = 32;
    blob(hx - 5, hy - 7, 3.5, 3.5); blob(hx - 5, hy + 7, 3.5, 3.5);
    blob(hx, hy, 9, 8.5);
    blob(hx - 3, hy, 3.5, 4, 0, '#d8b080', false); blob(hx - 4, hy, 1.4, 1.9, 0, '#2a1a10', false);
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 1.1;
    c.beginPath(); c.arc(hx + 2, hy - 3.5, 1.5, Math.PI * 0.6, Math.PI * 1.4); c.stroke();
    c.beginPath(); c.arc(hx + 2, hy + 3.5, 1.5, Math.PI * 0.6, Math.PI * 1.4); c.stroke();
    c.fillStyle = 'rgba(255,130,150,0.55)'; c.beginPath(); c.arc(hx + 3.5, hy - 6, 1.6, 0, TAU); c.arc(hx + 3.5, hy + 6, 1.6, 0, TAU); c.fill();
  }
}

export class LittleLife {
  list: Critter[] = [];
  /** Test hooks. */
  taps: Record<Kind, number> = { ladybug: 0, snail: 0, hen: 0, turtle: 0, goat: 0, sheep: 0, otter: 0, mole: 0, hedgehog: 0, mouse: 0, beaver: 0, fawn: 0, swan: 0, piglet: 0, bee: 0, heron: 0, fox: 0, pony: 0, kitten: 0, robin: 0, puffin: 0, puppy: 0, chipmunk: 0, bearcub: 0 };
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
    // 111: Shellwater Lake, south side (otters are west; the pier and rowboat are north-east).
    const sw: [number, number][] = [];
    for (const a of [Math.PI / 2, Math.PI / 2 - 0.3, Math.PI / 2 + 0.3, Math.PI / 2 - 0.6, Math.PI / 2 + 0.6]) for (const k of [0.55, 0.45, 0.65, 0.35]) sw.push([LAKE.x + Math.cos(a) * LAKE.rx * k, LAKE.y + Math.sin(a) * LAKE.ry * k]);
    pick('swan', sw, (x, y) => lakeValue(x, y) < 0.8 && lakeValue(x + 60, y) < 0.9 && lakeValue(x - 60, y) < 0.9 && Math.hypot(x - PIER.x, y - PIER.y1) > 350, 160, 170);
    // 112: on the grass along the village's south-west edge (the goats play a little further east).
    const pg: [number, number][] = [];
    for (let i = 0; i < 160; i++) { const a = 0.7 + i * 2.39996, r = 30 + (i % 10) * 26; pg.push([VILLAGE.x + 190 + Math.cos(a) * r, VILLAGE.y + VILLAGE.rows * VILLAGE.cell + 60 + Math.sin(a) * r * 0.5]); }
    pick('piglet', pg, (x, y) => land(x, y) && y > VILLAGE.y + VILLAGE.rows * VILLAGE.cell + 15 && Math.hypot(x - VILLAGE_BOARD.x, y - VILLAGE_BOARD.y) > 200, 90, 70);
    // 113: over the flowers south of the meadow path (ladybugs rest on the north side).
    const be: [number, number][] = [];
    for (let s = 1; s < PATH_MEADOW.length - 1; s++) for (const t of [0.5, 0.3, 0.7]) for (const dy of [170, 210, 140, 250]) {
      const [ax, ay] = PATH_MEADOW[s], [bx, by] = PATH_MEADOW[s + 1]; be.push([ax + (bx - ax) * t, ay + (by - ay) * t + dy]);
    }
    // Keep clear of tree trunks and bushes: open grass all around the hover spot.
    pick('bee', be, (x, y) => [[0, 0], [-50, 0], [50, 0], [0, -40], [0, -80], [-40, -60], [40, -60], [0, 40]].every(([ox, oy]) => land(x + ox, y + oy)), 90, 380);
    // 114: the river's east bank, well away from the beaver (west bank) and the bridges.
    const hr: [number, number][] = [];
    for (const d of [45, 65, 85, 110]) for (let y = 1000; y <= 1560; y += 70) hr.push([riverXAt(y) + riverHalfAt(y) + d, y]);
    const bvs = this.of('beaver');
    pick('heron', hr, (x, y) => land(x, y) && !onBridge(x, y) && bvs.every((b) => Math.hypot(b.hx - x, b.hy - y) > 450), 90, 100);
    // 115–118 helper: spots beside a path, offset sideways (dy) at a few points along each segment.
    const along = (path: [number, number][], offs: [number, number][], from = 1): [number, number][] => {
      const out: [number, number][] = [];
      for (let s = from; s < path.length - 1; s++) for (const t of [0.5, 0.3, 0.7]) for (const [ox, oy] of offs) {
        const [ax, ay] = path[s], [bx, by] = path[s + 1]; out.push([ax + (bx - ax) * t + ox, ay + (by - ay) * t + oy]);
      }
      return out;
    };
    const open = (x: number, y: number) => [[0, 0], [-40, 0], [40, 0], [0, -30], [0, 30]].every(([ox, oy]) => land(x + ox, y + oy));
    // 115: beside the Fairy Grove path, on its south side.
    pick('fox', along(PATH_GROVE, [[0, 160], [0, 200], [0, 130], [0, 240]]), open, 100, 300);
    // 116: beside the Meadow-to-Hills path, east side.
    pick('pony', along(PATH_MEADOW_HILLS, [[170, 0], [170, -80], [170, 80], [170, -160], [170, 160], [210, 0], [210, -80], [210, 80], [210, -160], [210, 160], [140, 0], [140, -80], [140, 80], [140, -160], [140, 160], [250, 0], [250, -80], [250, 80], [250, -160], [250, 160], [300, 0], [300, -80], [300, 80], [300, -160], [300, 160], [-170, 0], [-170, -80], [-170, 80], [-170, -160], [-170, 160], [-210, 0], [-210, -80], [-210, 80], [-210, -160], [-210, 160], [-140, 0], [-140, -80], [-140, 80], [-140, -160], [-140, 160], [-250, 0], [-250, -80], [-250, 80], [-250, -160], [-250, 160], [-300, 0], [-300, -80], [-300, 80], [-300, -160], [-300, 160]], 0), (x, y) => land(x, y) && land(x - 30, y) && land(x + 30, y), 90, 220);
    // 117: beside the south shore path, east side (the lake is to the north-west).
    pick('kitten', along(PATH_SHORE_S, [[150, 0], [190, 0], [120, 0], [230, 0], [-150, 0], [-190, 0], [280, 0]], 0), (x, y) => open(x, y) && lakeValue(x, y) > 1.3, 100, 240);
    // 118: north of the Seashell Bay path.
    pick('robin', along(PATH_BAY, [[0, -150], [0, -190], [0, -120], [0, -230], [0, -280]]), (x, y) => land(x, y) && land(x - 30, y) && land(x + 30, y), 90, 380);
    // 119: on the grass around the lighthouse.
    const pf: [number, number][] = [];
    for (const r of [200, 250, 300, 350, 420]) for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8 + r * 0.01; pf.push([LIGHTHOUSE.x + Math.cos(a) * r, LIGHTHOUSE.y + 40 + Math.sin(a) * r * 0.7]); }
    pick('puffin', pf, open, 100, 140);
    // 120: beside the orchard path (hedgehogs are on the southern orchard path).
    pick('puppy', along(PATH_ORCHARD, [[0, -150], [0, -190], [0, -120], [0, -230], [0, 150], [0, 190], [0, 230]], 0), open, 100, 320);
    // 121: beside the Shellwater Lake path, on the land side.
    pick('chipmunk', along(PATH_LAKE, [[0, -140], [0, -180], [0, -110], [0, -220], [-150, 0], [150, 0], [-190, 0], [190, 0]], 0), (x, y) => open(x, y) && lakeValue(x, y) > 1.3, 100, 300);
    // 122: beside the Hills-to-Bay path (the woods are too thick for a cosy spot clear of the puzzles).
    pick('bearcub', along(PATH_HILLS_BAY, [[170, 0], [-170, 0], [210, 0], [-210, 0], [250, 0], [-250, 0], [140, 0], [-140, 0], [170, -80], [-170, -80], [170, 80], [-170, 80]], 0), (x, y) => land(x, y) && land(x - 30, y) && land(x + 30, y) && land(x, y - 40), 110, 300);
    const onTheme = () => this.retheme();
    themeEvents.on('change', onTheme);
    w.events.once('shutdown', () => themeEvents.off('change', onTheme));
    this.retheme();
  }

  private add(kind: Kind, x: number, y: number) {
    const w = this.w, key = KEY[kind][0], i = this.list.filter((c) => c.kind === kind).length;
    const base = LIFE[kind].size / (frameScale[key] ?? S);
    const shadow = w.add.ellipse(x, y, LIFE[kind].tw * 0.8, 7, 0x2a3a1a, kind === 'turtle' || kind === 'otter' || kind === 'swan' ? 0 : 0.16).setDepth(y - 2).setVisible(false);
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
      case 'swan': sfx.honk(); sfx.splash(false); w.burst(c.x, c.y, 0xb0f0ff, 9, 'spark'); break;
      case 'piglet': sfx.oink(); w.burst(c.x, c.y - 6, 0x8a6040, 8); break;
      case 'bee': sfx.bzz(); w.burst(c.x, c.y - 30, 0xffe060, 8, 'spark'); break;
      case 'heron': sfx.splash(false); sfx.ting(); w.burst(c.x + 8, c.y - 4, 0xb0f0ff, 8, 'spark'); break;
      case 'fox': sfx.yip(); w.burst(c.x, c.y - 16, 0xffb060, 7, 'spark'); break;
      case 'pony': sfx.neigh(); w.burst(c.x, c.y - 40, 0xff9ab0, 6, 'heart'); break;
      case 'kitten': sfx.meow(); w.burst(c.x + 16, c.y - 10, 0xff9ac0, 7, 'spark'); break;
      case 'robin': sfx.chirp(); w.burst(c.x, c.y - 30, 0xffd080, 5, 'note'); break;
      case 'puffin': sfx.chirp(); sfx.blip(); w.burst(c.x, c.y - 30, 0xffffff, 6, 'spark'); break;
      case 'puppy': sfx.woof(); w.burst(c.x, c.y - 34, 0xff9ab0, 6, 'heart'); break;
      case 'chipmunk': sfx.squeak(); w.burst(c.x + 8, c.y - 16, 0xe0b070, 6, 'spark'); break;
      case 'bearcub': sfx.rawr(); w.burst(c.x, c.y - 30, 0xffc040, 8, 'spark'); break;
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
        case 'swan':
          if (c.t > 0) { lift = Math.sin(p * Math.PI) * 6; sy = 1 + Math.sin(p * Math.PI * 4) * 0.04 * (1 - p); if (p > 0.75) c.img.setTexture(KEY.swan[0]); }
          else { dx = Math.sin(now * 0.25 + c.ph) * 18; lift = Math.sin(now * 1.0 + c.ph) * 2; rot = Math.sin(now * 0.7 + c.ph) * 0.04; c.img.setFlipX(Math.cos(now * 0.25 + c.ph) < 0); }
          break;
        case 'piglet':
          if (c.t > 0) { rot = Math.sin(p * Math.PI * 8) * 0.2 * (1 - p * 0.5); lift = Math.abs(Math.sin(p * Math.PI * 4)) * 8; if (p > 0.85) c.img.setTexture(KEY.piglet[0]); }
          else { const sn = Math.max(0, Math.sin(now * 1.4 + c.ph)); rot = (c.img.flipX ? -1 : 1) * sn * 0.08; dx = Math.sin(now * 0.3 + c.ph) * 8; }
          break;
        case 'bee':
          if (c.t > 0) { const a = p * Math.PI * 2; dx = Math.sin(a) * 40; lift = 22 + Math.sin(p * Math.PI) * 50 + (1 - Math.cos(a)) * 10; rot = Math.cos(a) * 0.4; }
          else { dx = Math.sin(now * 0.8 + c.ph) * 14; lift = 22 + Math.sin(now * 3 + c.ph) * 4; rot = Math.sin(now * 1.6 + c.ph) * 0.1; c.img.setFlipX(Math.cos(now * 0.8 + c.ph) < 0); }
          break;
        case 'heron':
          if (c.t > 0) { if (p > 0.55) c.img.setTexture(KEY.heron[0]); sx = p > 0.55 && p < 0.8 ? 1 + Math.sin((p - 0.55) / 0.25 * Math.PI * 2) * 0.04 : 1; sy = p < 0.1 ? 1 - p * 0.6 : 1; }
          else { sy = 1 + Math.sin(now * 1.2 + c.ph) * 0.015; rot = Math.max(0, Math.sin(now * 0.4 + c.ph)) ** 6 * 0.06; }
          break;
        case 'fox':
          if (c.t > 0) { const q = Math.max(0, Math.min(1, (p - 0.15) / 0.55)); sy = p < 0.15 ? 1 - p * 0.8 : 1; lift = Math.sin(q * Math.PI) * 20; dx = q * 22 * (c.img.flipX ? -1 : 1) * (1 - Math.max(0, p - 0.7) / 0.3); if (p > 0.75) c.img.setTexture(KEY.fox[0]); }
          else { dx = Math.sin(now * 0.3 + c.ph) * 12; sy = 1 + Math.sin(now * 2 + c.ph) * 0.02; rot = Math.sin(now * 1.1 + c.ph) * 0.03; c.img.setFlipX(Math.cos(now * 0.3 + c.ph) < 0); }
          break;
        case 'pony':
          if (c.t > 0) { lift = Math.abs(Math.sin(p * Math.PI * 3)) * 12 * (1 - p * 0.4); rot = (c.img.flipX ? 1 : -1) * Math.sin(p * Math.PI * 3) * 0.08; if (p > 0.8) c.img.setTexture(KEY.pony[0]); }
          else { dx = Math.sin(now * 0.15 + c.ph) * 14; sy = 1 + Math.sin(now * 1.3 + c.ph) * 0.015; rot = (c.img.flipX ? -1 : 1) * Math.max(0, Math.sin(now * 0.6 + c.ph)) ** 4 * 0.06; c.img.setFlipX(Math.cos(now * 0.15 + c.ph) < 0); }
          break;
        case 'kitten':
          if (c.t > 0) { const q = Math.min(1, p / 0.5); lift = Math.sin(q * Math.PI) * 14; dx = Math.sin(q * Math.PI * 0.5) * 10 * (1 - Math.max(0, p - 0.5) * 2) * (c.img.flipX ? -1 : 1); rot = Math.sin(p * Math.PI * 6) * 0.06 * (1 - p); }
          else { sx = 1 + Math.sin(now * 1.8 + c.ph) * 0.025; rot = Math.sin(now * 0.5 + c.ph) * 0.04; }
          break;
        case 'robin':
          if (c.t > 0) { lift = Math.abs(Math.sin(p * Math.PI * 4)) * 12 * (1 - p * 0.5); dx = Math.sin(p * Math.PI) * 10 * (c.img.flipX ? -1 : 1); if (p > 0.8) c.img.setTexture(KEY.robin[0]); }
          else { const hop = Math.max(0, Math.sin(now * 2.2 + c.ph)) ** 8; lift = hop * 5; dx = Math.sin(now * 0.35 + c.ph) * 16; rot = Math.sin(now * 0.9 + c.ph) * 0.06; c.img.setFlipX(Math.cos(now * 0.35 + c.ph) < 0); }
          break;
        case 'puffin':
          if (c.t > 0) { rot = Math.sin(p * Math.PI * 6) * 0.18 * (1 - p); lift = Math.abs(Math.sin(p * Math.PI * 3)) * 6; dx = Math.sin(p * Math.PI) * 10 * (c.img.flipX ? -1 : 1); c.img.setTexture(p < 0.8 && Math.floor(p * 10) % 2 === 0 ? KEY.puffin[1] : KEY.puffin[0]); }
          else { rot = Math.sin(now * 1.1 + c.ph) * 0.05; sy = 1 + Math.sin(now * 1.6 + c.ph) * 0.02; }
          break;
        case 'puppy':
          if (c.t > 0) { sx = Math.cos(p * Math.PI * 4); if (Math.abs(sx) < 0.2) sx = sx < 0 ? -0.2 : 0.2; lift = Math.sin(p * Math.PI) * 14; }
          else { rot = Math.sin(now * 3 + c.ph) * 0.03; dx = Math.sin(now * 0.3 + c.ph) * 12; c.img.setFlipX(Math.cos(now * 0.3 + c.ph) < 0); }
          break;
        case 'chipmunk':
          if (c.t > 0) { sy = 1 + Math.sin(p * Math.PI * 8) * 0.06 * (1 - p); lift = p < 0.2 ? Math.sin((p / 0.2) * Math.PI) * 10 : 0; }
          else { const dart = Math.sin(now * 0.5 + c.ph); dx = Math.sign(dart) * Math.min(1, Math.abs(dart) * 3) * 8; rot = Math.sin(now * 4 + c.ph) * 0.03; c.img.setFlipX(Math.cos(now * 0.5 + c.ph) < 0); }
          break;
        case 'bearcub':
          if (c.t > 0) { rot = Math.sin(p * Math.PI * 4) * 0.15 * (1 - p); if (p > 0.85) c.img.setTexture(KEY.bearcub[0]); }
          else { sy = 1 + Math.sin(now * 1.2 + c.ph) * 0.02; rot = Math.sin(now * 0.6 + c.ph) * 0.04; }
          break;
      }
      if (c.t <= 0 && c.img.texture.key !== KEY[c.kind][0]) c.img.setTexture(KEY[c.kind][0]);
      c.x = c.hx + dx; c.y = c.hy - lift;
      c.img.setPosition(c.x, c.y).setScale(c.base * sx, c.base * sy).setRotation(rot).setDepth((c.kind === 'ladybug' || c.kind === 'bee') && lift > 5 ? c.hy + 200 : c.hy);
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
