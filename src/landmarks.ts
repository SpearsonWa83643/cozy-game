// Mount fast travel (9.3): the landmarks you can fly to while riding, and their big bold icons
// (drawn once to canvas textures, crisp at iPad DPR).
import Phaser from 'phaser';
import { PUZZLE_SITES } from './layout';
import { COTTAGE, VILLAGE_SIGN, POND, TRAILHEAD, HUBS, STABLE_SPOT, JAIL_SPOT, LIGHTHOUSE, SHRINE, POT_CHEST, BELL_SIGN, TILE_SIGN, DIG_SIGN, PSTONE_SIGN, TRACK_SIGN } from './layout';

export type LandmarkId = 'home' | 'village' | 'brookside' | 'mistbirch' | 'pond' | 'wild'
  | 'stable' | 'jail' | 'meadow' | 'hills' | 'grove' | 'bay';
export type Landmark = { id: LandmarkId; name: string; x: number; y: number; icon: string };
/** 65: a place on the fly-travel map: a landmark, or a puzzle (with its save.puzzles key). */
export type FlySite = { id: string; name: string; x: number; y: number; icon: string; puzzle?: string; big?: boolean };

/** Ground spots on open, walkable land beside each landmark. */
export const LANDMARKS: Landmark[] = [
  { id: 'home', name: 'Home', x: COTTAGE.x, y: COTTAGE.y + 90, icon: 'lm_home' },
  { id: 'village', name: 'Village', x: VILLAGE_SIGN.x, y: VILLAGE_SIGN.y + 80, icon: 'lm_village' },
  { id: 'pond', name: 'Pond', x: POND.x, y: POND.y + POND.ry + 70, icon: 'lm_pond' },
  { id: 'brookside', name: 'Brookside', x: 2140, y: 1000, icon: 'lm_brook' },
  { id: 'mistbirch', name: 'Mistbirch', x: 2900, y: 720, icon: 'lm_birch' },
  { id: 'wild', name: 'Wild Woods', x: TRAILHEAD.x, y: TRAILHEAD.y + 70, icon: 'lm_wild' },
  // 64-65: the new regions, plus the Stable barn and the Thief Jail.
  { id: 'stable', name: 'Stable', x: STABLE_SPOT.x, y: STABLE_SPOT.y + 110, icon: 'lm_stable' },
  { id: 'jail', name: 'Jail', x: JAIL_SPOT.x, y: JAIL_SPOT.y + 100, icon: 'lm_jail' },
  { id: 'meadow', name: 'Sunflowers', x: HUBS.meadow.x, y: HUBS.meadow.y, icon: 'lm_meadow' },
  { id: 'hills', name: 'Pine Hills', x: HUBS.hills.x, y: HUBS.hills.y, icon: 'lm_hills' },
  { id: 'grove', name: 'Glowcaps', x: HUBS.grove.x, y: HUBS.grove.y, icon: 'lm_grove' },
  { id: 'bay', name: 'Seashell Bay', x: LIGHTHOUSE.x - 300, y: LIGHTHOUSE.y + 120, icon: 'lm_bay' },
];

/** 65: everything on the fly-travel map: the landmarks (big pins) and each puzzle (smaller pins, green when solved). */
export const FLY_SITES: FlySite[] = [
  ...LANDMARKS.map((l) => ({ ...l, big: true })),
  { id: 'p:lanterns', name: 'Lanterns', x: SHRINE.x, y: 470, icon: 'pz_lantern', puzzle: 'lanterns' },
  { id: 'p:pots', name: 'Flower Pots', x: POT_CHEST.x, y: POT_CHEST.y + 70, icon: 'pz_pots', puzzle: 'pots' },
  { id: 'p:bells', name: 'Bells', x: BELL_SIGN.x, y: BELL_SIGN.y + 70, icon: 'pz_bells', puzzle: 'bells' },
  { id: 'p:tiles', name: 'Tiles', x: TILE_SIGN.x, y: TILE_SIGN.y + 60, icon: 'pz_tiles', puzzle: 'tiles' },
  { id: 'p:dig', name: 'Dig Spot', x: DIG_SIGN.x, y: DIG_SIGN.y + 70, icon: 'pz_dig', puzzle: 'dig' },
  { id: 'p:stones', name: 'Stones', x: PSTONE_SIGN.x, y: PSTONE_SIGN.y + 60, icon: 'pz_stones', puzzle: 'stones' },
  { id: 'p:trail', name: 'Tracks', x: TRACK_SIGN.x, y: TRACK_SIGN.y + 60, icon: 'pz_trail', puzzle: 'trail' },
  // 66: letter easels (spelling). Land just below the easel.
  ...PUZZLE_SITES.filter((p) => p.kind === 'spelling').map((p, i) => ({ id: `p:${p.id}`, name: i ? 'Seaside ABC' : 'Meadow ABC', x: p.x, y: p.y + 120, icon: 'pz_spell', puzzle: p.id })),
];

const SZ = 128;
const INK = '#3d2c20';

function house(g: CanvasRenderingContext2D, x: number, y: number, s: number, wall: string, roof: string) {
  g.lineWidth = 5 * s; g.strokeStyle = INK; g.lineJoin = 'round';
  g.fillStyle = wall; g.beginPath(); g.rect(x - 26 * s, y - 34 * s, 52 * s, 34 * s); g.fill(); g.stroke();
  g.fillStyle = roof; g.beginPath(); g.moveTo(x - 36 * s, y - 32 * s); g.lineTo(x, y - 62 * s); g.lineTo(x + 36 * s, y - 32 * s); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#8a5a34'; g.beginPath(); g.rect(x - 8 * s, y - 20 * s, 16 * s, 20 * s); g.fill(); g.stroke();
  g.fillStyle = '#ffe9a8'; g.beginPath(); g.rect(x + 11 * s, y - 27 * s, 10 * s, 10 * s); g.fill(); g.stroke();
}

const DRAW: Record<string, (g: CanvasRenderingContext2D) => void> = {
  lm_home(g) {
    g.fillStyle = '#7cc463'; g.beginPath(); g.ellipse(64, 100, 50, 14, 0, 0, Math.PI * 2); g.fill();
    house(g, 64, 100, 1.25, '#fbe3c0', '#d9604c');
  },
  lm_village(g) {
    g.fillStyle = '#7cc463'; g.beginPath(); g.ellipse(64, 104, 56, 14, 0, 0, Math.PI * 2); g.fill();
    house(g, 40, 98, 0.85, '#f5dcb4', '#5f8fd8');
    house(g, 88, 98, 0.85, '#f5dcb4', '#e0a03a');
    house(g, 64, 108, 0.95, '#fff1d6', '#d9604c');
  },
  lm_pond(g) {
    g.lineWidth = 5; g.strokeStyle = INK;
    g.fillStyle = '#5cb8e6'; g.beginPath(); g.ellipse(64, 76, 52, 32, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#e6f7ff'; g.lineWidth = 4; g.beginPath(); g.arc(40, 70, 10, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
    // A jumping fish.
    g.save(); g.translate(68, 58); g.rotate(-0.5);
    g.fillStyle = '#ff9a3c'; g.strokeStyle = INK; g.lineWidth = 4.5;
    g.beginPath(); g.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(18, 0); g.lineTo(34, -12); g.lineTo(34, 12); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(-11, -3, 3, 0, 7); g.fill();
    g.restore();
  },
  lm_brook(g) {
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    g.fillStyle = '#5cb8e6'; g.beginPath(); g.moveTo(44, 10); g.bezierCurveTo(20, 50, 100, 70, 74, 118); g.lineTo(104, 118); g.bezierCurveTo(128, 70, 50, 50, 74, 10); g.closePath(); g.fill(); g.stroke();
    // A little wooden bridge across.
    g.fillStyle = '#c98d55'; g.beginPath(); g.rect(14, 54, 100, 22); g.fill(); g.stroke();
    g.beginPath(); for (const x of [36, 58, 80]) { g.moveTo(x, 54); g.lineTo(x, 76); } g.stroke();
    g.fillStyle = '#8a5a34'; g.beginPath(); g.rect(14, 42, 8, 34); g.rect(106, 42, 8, 34); g.fill(); g.stroke();
  },
  lm_birch(g) {
    g.lineWidth = 5; g.strokeStyle = INK;
    const tree = (x: number, s: number) => {
      g.fillStyle = '#f4f1ea'; g.beginPath(); g.rect(x - 6 * s, 50, 12 * s, 66); g.fill(); g.stroke();
      g.fillStyle = INK; g.fillRect(x - 6 * s, 70, 7 * s, 4); g.fillRect(x, 92, 6 * s, 4);
      g.fillStyle = '#9ed36a'; g.beginPath(); g.ellipse(x, 40, 26 * s, 34 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    };
    tree(40, 0.85); tree(88, 0.85); tree(64, 1);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(64, 112, 54, 9, 0, 0, Math.PI * 2); g.fill();
  },
  lm_wild(g) {
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    // A stone arch with a glowing swirl: the way into the Wild Woods.
    g.fillStyle = '#9aa3ad'; g.beginPath(); g.moveTo(18, 116); g.lineTo(18, 54); g.arc(64, 54, 46, Math.PI, 0); g.lineTo(110, 116); g.lineTo(90, 116); g.lineTo(90, 56); g.arc(64, 56, 26, 0, Math.PI, true); g.lineTo(38, 116); g.closePath(); g.fill(); g.stroke();
    const grd = g.createRadialGradient(64, 82, 4, 64, 82, 30);
    grd.addColorStop(0, '#fff6c4'); grd.addColorStop(0.5, '#b78cff'); grd.addColorStop(1, '#6a4cc4');
    g.fillStyle = grd; g.beginPath(); g.moveTo(38, 116); g.lineTo(38, 56); g.arc(64, 56, 26, Math.PI, 0); g.lineTo(90, 116); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#fffaf0'; g.lineWidth = 3.5; g.beginPath(); for (let a = 0; a < 9; a += 0.2) { const r = a * 2.4; const px = 64 + Math.cos(a) * r, py = 84 + Math.sin(a) * r; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke();
  },
  lm_stable(g) {
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    g.fillStyle = '#7cc463'; g.beginPath(); g.ellipse(64, 112, 54, 10, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d9473c'; g.beginPath(); g.moveTo(22, 112); g.lineTo(22, 60); g.lineTo(34, 36); g.lineTo(64, 20); g.lineTo(94, 36); g.lineTo(106, 60); g.lineTo(106, 112); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#a8322a'; g.beginPath(); g.rect(46, 74, 36, 38); g.fill(); g.stroke();
    g.strokeStyle = '#fffaf0'; g.lineWidth = 4; g.beginPath(); g.moveTo(48, 76); g.lineTo(80, 110); g.moveTo(80, 76); g.lineTo(48, 110); g.stroke();
    g.fillStyle = '#ffd36a'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.rect(54, 42, 20, 18); g.fill(); g.stroke();
  },
  lm_jail(g) {
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    g.fillStyle = '#9aa3ad'; g.beginPath(); g.rect(20, 46, 88, 70); g.fill(); g.stroke();
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fffaf0' : '#4f7fd8'; g.beginPath(); g.moveTo(64, 10); g.lineTo(12 + i * 17.3, 48); g.lineTo(12 + (i + 1) * 17.3, 48); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(64, 10); g.lineTo(12, 48); g.lineTo(116, 48); g.closePath(); g.stroke();
    g.fillStyle = '#2c3446'; g.beginPath(); g.rect(36, 60, 56, 40); g.fill(); g.stroke();
    // A masked face peeking through the bars.
    g.fillStyle = '#c98d55'; g.beginPath(); g.arc(64, 82, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK; g.beginPath(); g.ellipse(64, 78, 16, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(58, 78, 2.6, 0, 7); g.arc(70, 78, 2.6, 0, 7); g.fill();
    g.strokeStyle = '#e8eef5'; g.lineWidth = 4; g.beginPath(); for (const x of [46, 58, 70, 82]) { g.moveTo(x, 61); g.lineTo(x, 99); } g.stroke();
  },
  lm_meadow(g) {
    g.lineWidth = 5; g.strokeStyle = INK;
    g.strokeStyle = '#4f8a3a'; g.lineWidth = 7; g.beginPath(); g.moveTo(64, 120); g.quadraticCurveTo(58, 90, 64, 62); g.stroke();
    g.fillStyle = '#6cb64e'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.ellipse(46, 96, 16, 7, 0.5, 0, 7); g.fill(); g.stroke();
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.fillStyle = '#ffc93c'; g.beginPath(); g.ellipse(64 + Math.cos(a) * 26, 46 + Math.sin(a) * 26, 13, 7, a, 0, 7); g.fill(); g.lineWidth = 3; g.stroke(); }
    g.fillStyle = '#7a4a24'; g.lineWidth = 4.5; g.beginPath(); g.arc(64, 46, 18, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#a8703c'; g.beginPath(); g.arc(59, 41, 3, 0, 7); g.arc(69, 50, 3, 0, 7); g.arc(66, 39, 2.5, 0, 7); g.fill();
  },
  lm_hills(g) {
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    g.fillStyle = '#8fbf6a'; g.beginPath(); g.moveTo(4, 116); g.quadraticCurveTo(40, 40, 76, 116); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#a6cf7a'; g.beginPath(); g.moveTo(46, 116); g.quadraticCurveTo(88, 56, 124, 116); g.closePath(); g.fill(); g.stroke();
    const pine = (x: number, y: number, s: number) => { g.fillStyle = '#2f6b45'; g.beginPath(); g.moveTo(x, y - 40 * s); g.lineTo(x + 16 * s, y); g.lineTo(x - 16 * s, y); g.closePath(); g.fill(); g.stroke(); };
    pine(38, 74, 1); pine(92, 88, 0.9);
    g.fillStyle = '#b7bcc4'; for (const [x, y, r] of [[64, 108, 10], [64, 92, 8], [64, 79, 6]]) { g.beginPath(); g.ellipse(x, y, r * 1.4, r, 0, 0, 7); g.fill(); g.stroke(); }
  },
  lm_grove(g) {
    g.lineWidth = 5; g.strokeStyle = INK;
    const grd = g.createRadialGradient(64, 56, 6, 64, 56, 60); grd.addColorStop(0, 'rgba(200,255,240,0.9)'); grd.addColorStop(1, 'rgba(120,220,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(64, 56, 60, 0, 7); g.fill();
    g.fillStyle = '#f4ead6'; g.beginPath(); g.rect(54, 62, 20, 50); g.fill(); g.stroke();
    g.fillStyle = '#b06ad8'; g.beginPath(); g.moveTo(14, 66); g.quadraticCurveTo(64, -6, 114, 66); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff6c4'; for (const [x, y, r] of [[44, 46, 7], [74, 34, 6], [90, 54, 5], [60, 58, 4]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = '#5ed1c0'; g.beginPath(); g.moveTo(84, 112); g.quadraticCurveTo(102, 78, 120, 112); g.closePath(); g.fill(); g.lineWidth = 4; g.stroke();
  },
  lm_bay(g) {
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    g.fillStyle = '#5cb8e6'; g.beginPath(); g.ellipse(64, 108, 58, 16, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fffaf0'; g.beginPath(); g.moveTo(48, 104); g.lineTo(54, 30); g.lineTo(74, 30); g.lineTo(80, 104); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e0503c'; g.beginPath(); g.moveTo(52, 82); g.lineTo(76, 82); g.lineTo(78, 94); g.lineTo(50, 94); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(54, 52); g.lineTo(74, 52); g.lineTo(75, 62); g.lineTo(53, 62); g.closePath(); g.fill();
    g.fillStyle = '#ffe27a'; g.beginPath(); g.rect(52, 14, 24, 16); g.fill(); g.stroke();
    g.fillStyle = '#e0503c'; g.beginPath(); g.moveTo(48, 14); g.lineTo(64, 2); g.lineTo(80, 14); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,226,122,0.9)'; g.lineWidth = 6; g.beginPath(); g.moveTo(80, 22); g.lineTo(120, 12); g.moveTo(48, 22); g.lineTo(8, 12); g.stroke();
  },
  pz_lantern(g) {
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    const grd = g.createRadialGradient(64, 70, 4, 64, 70, 52); grd.addColorStop(0, 'rgba(255,236,150,0.95)'); grd.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(64, 70, 52, 0, 7); g.fill();
    g.beginPath(); g.arc(64, 22, 10, Math.PI, 0); g.stroke();
    g.fillStyle = '#5a3d28'; g.beginPath(); g.rect(40, 30, 48, 10); g.fill(); g.stroke();
    g.fillStyle = '#ffd36a'; g.beginPath(); g.rect(44, 40, 40, 50); g.fill(); g.stroke();
    g.fillStyle = '#5a3d28'; g.beginPath(); g.rect(40, 90, 48, 12); g.fill(); g.stroke();
    g.fillStyle = '#ff8a3c'; g.beginPath(); g.ellipse(64, 68, 8, 14, 0, 0, 7); g.fill();
  },
  pz_pots(g) {
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    for (const [x, c] of [[40, '#ff6f91'], [88, '#ffd36a']] as [number, string][]) {
      g.fillStyle = '#4f8a3a'; g.beginPath(); g.rect(x - 3, 40, 6, 30); g.fill();
      g.fillStyle = c; g.beginPath(); g.arc(x, 38, 14, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#fff6c4'; g.beginPath(); g.arc(x, 38, 5, 0, 7); g.fill();
      g.fillStyle = '#d0763c'; g.beginPath(); g.moveTo(x - 24, 70); g.lineTo(x + 24, 70); g.lineTo(x + 17, 114); g.lineTo(x - 17, 114); g.closePath(); g.fill(); g.stroke();
    }
  },
  pz_bells(g) {
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    g.fillStyle = '#ffc93c'; g.beginPath(); g.moveTo(24, 98); g.quadraticCurveTo(30, 88, 34, 60); g.quadraticCurveTo(40, 22, 64, 22); g.quadraticCurveTo(88, 22, 94, 60); g.quadraticCurveTo(98, 88, 104, 98); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e09a28'; g.beginPath(); g.arc(64, 106, 10, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(64, 16, 7, 0, 7); g.stroke();
    g.strokeStyle = '#fffaf0'; g.lineWidth = 4; g.beginPath(); g.moveTo(44, 46); g.quadraticCurveTo(46, 34, 56, 30); g.stroke();
  },
  pz_tiles(g) {
    g.lineWidth = 5; g.strokeStyle = INK;
    const cs = ['#ff8a5c', '#5cb8e6', '#8fd06a', '#ffd36a'];
    for (let i = 0; i < 4; i++) { g.fillStyle = cs[i]; g.beginPath(); g.rect(20 + (i % 2) * 46, 20 + Math.floor(i / 2) * 46, 42, 42); g.fill(); g.stroke(); }
    g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(41, 41, 8, 0, 7); g.moveTo(87 + 9, 41); g.arc(87, 41, 9, 0, 7); g.fill();
    g.beginPath(); g.moveTo(32, 98); g.lineTo(50, 98); g.lineTo(41, 80); g.closePath(); g.fill();
    g.beginPath(); g.rect(79, 79, 16, 16); g.fill();
  },
  pz_dig(g) {
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    g.fillStyle = '#a8703c'; g.beginPath(); g.ellipse(64, 104, 48, 14, 0, 0, 7); g.fill(); g.stroke();
    g.save(); g.translate(70, 64); g.rotate(0.5);
    g.fillStyle = '#c98d55'; g.beginPath(); g.rect(-5, -56, 10, 56); g.fill(); g.stroke();
    g.fillStyle = '#b7bcc4'; g.beginPath(); g.moveTo(-18, 0); g.lineTo(18, 0); g.lineTo(14, 26); g.quadraticCurveTo(0, 40, -14, 26); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = '#ffd36a'; g.beginPath(); g.moveTo(30, 66); g.lineTo(34, 76); g.lineTo(44, 76); g.lineTo(36, 82); g.lineTo(40, 92); g.lineTo(30, 86); g.lineTo(20, 92); g.lineTo(24, 82); g.lineTo(16, 76); g.lineTo(26, 76); g.closePath(); g.fill(); g.lineWidth = 3; g.stroke();
  },
  pz_stones(g) {
    g.lineWidth = 5; g.strokeStyle = INK;
    const st: [number, number, string][] = [[30, 92, '1'], [56, 62, '2'], [86, 84, '3'], [100, 46, '4']];
    for (const [x, y, n] of st) {
      g.fillStyle = '#b7bcc4'; g.beginPath(); g.ellipse(x, y, 22, 15, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = INK; g.font = '900 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, x, y + 1);
    }
  },
  pz_trail(g) {
    g.fillStyle = INK;
    const paw = (x: number, y: number, r: number) => {
      g.beginPath(); g.ellipse(x, y + 4, r * 0.55, r * 0.75, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x - r * 0.42, y - r * 0.6, r * 0.2, r * 0.32, 0, 0, 7); g.ellipse(x + r * 0.42, y - r * 0.6, r * 0.2, r * 0.32, 0, 0, 7); g.fill();
    };
    paw(34, 98, 20); paw(62, 70, 20); paw(94, 46, 20);
  },
  pz_spell(g) {
    // A little easel with bright A B C.
    g.lineWidth = 6; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(40, 116); g.lineTo(58, 22); g.moveTo(88, 116); g.lineTo(70, 22); g.stroke();
    g.fillStyle = '#3f6b4a'; g.beginPath(); g.rect(14, 30, 100, 62); g.fill(); g.stroke();
    g.font = '900 34px Nunito, "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ([['A', 36, '#ff8a9a'], ['B', 64, '#ffd84d'], ['C', 92, '#8fd0ff']] as const).forEach(([l, x, c]) => { g.fillStyle = c; g.fillText(l, x, 62); });
  },
  lm_fly(g) {
    // A folded paper map with a little flying wing: "Fly!".
    g.lineWidth = 5; g.strokeStyle = INK; g.lineJoin = 'round';
    g.fillStyle = '#f6e6be'; g.beginPath(); g.moveTo(14, 40); g.lineTo(48, 28); g.lineTo(80, 40); g.lineTo(114, 28); g.lineTo(114, 100); g.lineTo(80, 112); g.lineTo(48, 100); g.lineTo(14, 112); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(48, 28); g.lineTo(48, 100); g.moveTo(80, 40); g.lineTo(80, 112); g.stroke();
    g.strokeStyle = '#d9604c'; g.lineWidth = 4; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(28, 92); g.quadraticCurveTo(50, 50, 96, 58); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#d9604c'; g.beginPath(); g.arc(96, 58, 7, 0, 7); g.fill();
    g.fillStyle = '#5fae4a'; g.beginPath(); g.arc(28, 92, 6, 0, 7); g.fill();
  },
};

/** Make the landmark icon textures (once per game). */
export function ensureLandmarkIcons(scene: Phaser.Scene) {
  for (const [key, draw] of Object.entries(DRAW)) {
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, SZ, SZ);
    if (!tex) continue;
    const g = tex.getContext();
    g.clearRect(0, 0, SZ, SZ);
    draw(g);
    tex.refresh();
  }
}
