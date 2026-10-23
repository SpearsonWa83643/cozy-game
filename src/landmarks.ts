// Mount fast travel (9.3): the landmarks you can fly to while riding, and their big bold icons
// (drawn once to canvas textures, crisp at iPad DPR).
import Phaser from 'phaser';
import { COTTAGE, VILLAGE_SIGN, POND, TRAILHEAD } from './layout';

export type LandmarkId = 'home' | 'village' | 'brookside' | 'mistbirch' | 'pond' | 'wild';
export type Landmark = { id: LandmarkId; name: string; x: number; y: number; icon: string };

/** Ground spots on open, walkable land beside each landmark. */
export const LANDMARKS: Landmark[] = [
  { id: 'home', name: 'Home', x: COTTAGE.x, y: COTTAGE.y + 90, icon: 'lm_home' },
  { id: 'village', name: 'Village', x: VILLAGE_SIGN.x, y: VILLAGE_SIGN.y + 80, icon: 'lm_village' },
  { id: 'pond', name: 'Pond', x: POND.x, y: POND.y + POND.ry + 70, icon: 'lm_pond' },
  { id: 'brookside', name: 'Brookside', x: 2140, y: 1000, icon: 'lm_brook' },
  { id: 'mistbirch', name: 'Mistbirch', x: 2900, y: 720, icon: 'lm_birch' },
  { id: 'wild', name: 'Wild Woods', x: TRAILHEAD.x, y: TRAILHEAD.y + 70, icon: 'lm_wild' },
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
