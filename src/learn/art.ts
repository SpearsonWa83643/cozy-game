// 66-67: bold, friendly pictures for the learning puzzles (spelling words, counting fruit), the world props
// (the letter easel, the counting table, ABC blocks) and the treasure icons. All painted once to canvas textures.
import Phaser from 'phaser';
import { canvasTex, frameScale } from '../art';

const INK = '#3d2c20';
type G = CanvasRenderingContext2D;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void, scale = 2, standalone = false) {
  if (frameScale[key]) return;
  canvasTex(scene, key, w, h, draw, scale, standalone);
}
const blob = (g: G, fill: string, f: () => void, lw = 5) => { g.beginPath(); f(); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); };
const dot = (g: G, x: number, y: number, r: number, fill = INK) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };
const smile = (g: G, x: number, y: number, r: number) => { g.beginPath(); g.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); };
const cheeks = (g: G, x1: number, x2: number, y: number) => { for (const x of [x1, x2]) { g.beginPath(); g.ellipse(x, y, 8, 5, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,120,130,0.55)'; g.fill(); } };

/** 160x160 pictures, one per word. */
export const PICS: Record<string, (g: G) => void> = {
  cat(g) {
    blob(g, '#f2a65a', () => { g.moveTo(38, 70); g.lineTo(44, 26); g.lineTo(70, 52); g.lineTo(90, 52); g.lineTo(116, 26); g.lineTo(122, 70); g.ellipse(80, 92, 48, 42, 0, 0.08 * Math.PI, 0.92 * Math.PI); g.closePath(); });
    blob(g, '#ffd1dc', () => { g.moveTo(50, 50); g.lineTo(52, 36); g.lineTo(62, 50); g.closePath(); }, 3);
    blob(g, '#ffd1dc', () => { g.moveTo(110, 50); g.lineTo(108, 36); g.lineTo(98, 50); g.closePath(); }, 3);
    dot(g, 64, 84, 6); dot(g, 96, 84, 6); dot(g, 66, 82, 2, '#fff'); dot(g, 98, 82, 2, '#fff');
    blob(g, '#e8607a', () => { g.moveTo(74, 98); g.lineTo(86, 98); g.lineTo(80, 105); g.closePath(); }, 3);
    smile(g, 74, 104, 6); smile(g, 86, 104, 6); cheeks(g, 54, 106, 100);
    g.lineWidth = 3; g.strokeStyle = INK;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(80 + s * 22, 100); g.lineTo(80 + s * 46, 94); g.moveTo(80 + s * 22, 106); g.lineTo(80 + s * 46, 108); g.stroke(); }
  },
  sun(g) {
    g.lineWidth = 8; g.strokeStyle = '#f5a623';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(80 + Math.cos(a) * 50, 80 + Math.sin(a) * 50); g.lineTo(80 + Math.cos(a) * 72, 80 + Math.sin(a) * 72); g.stroke(); }
    blob(g, '#ffd84d', () => g.arc(80, 80, 42, 0, Math.PI * 2));
    dot(g, 66, 74, 5.5); dot(g, 94, 74, 5.5); smile(g, 80, 84, 14); cheeks(g, 58, 102, 90);
  },
  dog(g) {
    blob(g, '#c98b5a', () => g.ellipse(80, 86, 44, 42, 0, 0, Math.PI * 2));
    blob(g, '#7a4f2c', () => g.ellipse(38, 80, 16, 32, 0.35, 0, Math.PI * 2));
    blob(g, '#7a4f2c', () => g.ellipse(122, 80, 16, 32, -0.35, 0, Math.PI * 2));
    blob(g, '#f5dcb4', () => g.ellipse(80, 104, 24, 18, 0, 0, Math.PI * 2), 4);
    dot(g, 64, 78, 6); dot(g, 96, 78, 6); dot(g, 66, 76, 2, '#fff'); dot(g, 98, 76, 2, '#fff');
    blob(g, INK, () => g.ellipse(80, 96, 9, 6, 0, 0, Math.PI * 2), 2);
    blob(g, '#ff8a9a', () => g.ellipse(80, 118, 8, 9, 0, 0, Math.PI * 2), 3);
    smile(g, 80, 104, 8);
  },
  hat(g) {
    blob(g, '#5f8fd8', () => g.ellipse(80, 112, 66, 16, 0, 0, Math.PI * 2));
    blob(g, '#5f8fd8', () => { g.moveTo(46, 110); g.bezierCurveTo(44, 50, 116, 50, 114, 110); g.closePath(); });
    blob(g, '#e8604c', () => { g.rect(46, 92, 68, 14); }, 4);
    blob(g, '#ffd84d', () => g.arc(100, 84, 9, 0, Math.PI * 2), 3);
  },
  bee(g) {
    blob(g, 'rgba(220,240,255,0.95)', () => g.ellipse(62, 50, 20, 28, -0.5, 0, Math.PI * 2), 4);
    blob(g, 'rgba(220,240,255,0.95)', () => g.ellipse(98, 50, 20, 28, 0.5, 0, Math.PI * 2), 4);
    blob(g, '#ffd84d', () => g.ellipse(80, 94, 48, 36, 0, 0, Math.PI * 2));
    g.save(); g.beginPath(); g.ellipse(80, 94, 46, 34, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = INK; g.fillRect(84, 56, 14, 80); g.fillRect(108, 56, 14, 80); g.restore();
    dot(g, 50, 88, 5.5); dot(g, 68, 88, 5.5); smile(g, 59, 96, 8); cheeks(g, 44, 74, 102);
    g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.moveTo(50, 64); g.quadraticCurveTo(40, 44, 30, 44); g.moveTo(64, 62); g.quadraticCurveTo(64, 42, 56, 36); g.stroke();
  },
  cup(g) {
    blob(g, '#fff4d6', () => g.ellipse(132, 90, 16, 20, 0, 0, Math.PI * 2), 6);
    blob(g, '#ff9ab8', () => { g.moveTo(36, 54); g.lineTo(124, 54); g.lineTo(114, 126); g.quadraticCurveTo(80, 136, 46, 126); g.closePath(); });
    blob(g, '#c98b5a', () => g.ellipse(80, 56, 44, 10, 0, 0, Math.PI * 2), 4);
    dot(g, 66, 86, 5); dot(g, 94, 86, 5); smile(g, 80, 94, 10); cheeks(g, 56, 104, 100);
    g.lineWidth = 4; g.strokeStyle = 'rgba(120,100,90,0.6)';
    for (const x of [64, 82, 98]) { g.beginPath(); g.moveTo(x, 40); g.quadraticCurveTo(x - 8, 30, x, 20); g.stroke(); }
  },
  pig(g) {
    blob(g, '#ffb3c6', () => g.ellipse(80, 86, 48, 42, 0, 0, Math.PI * 2));
    blob(g, '#ff9ab8', () => { g.moveTo(42, 56); g.lineTo(40, 30); g.lineTo(64, 46); g.closePath(); }, 4);
    blob(g, '#ff9ab8', () => { g.moveTo(118, 56); g.lineTo(120, 30); g.lineTo(96, 46); g.closePath(); }, 4);
    dot(g, 62, 74, 6); dot(g, 98, 74, 6);
    blob(g, '#ff8aa8', () => g.ellipse(80, 98, 20, 14, 0, 0, Math.PI * 2), 4);
    dot(g, 73, 98, 4); dot(g, 87, 98, 4); smile(g, 80, 110, 10);
  },
  bus(g) {
    blob(g, '#ffd84d', () => { g.moveTo(20, 116); g.lineTo(20, 54); g.quadraticCurveTo(20, 40, 34, 40); g.lineTo(132, 40); g.quadraticCurveTo(144, 40, 144, 56); g.lineTo(144, 116); g.closePath(); });
    for (const x of [30, 62, 94]) blob(g, '#bfe3ff', () => g.rect(x, 52, 26, 24), 4);
    blob(g, '#bfe3ff', () => g.rect(124, 52, 14, 30), 4);
    blob(g, '#e8604c', () => g.rect(20, 90, 124, 8), 3);
    blob(g, '#4a4a55', () => g.arc(48, 118, 14, 0, Math.PI * 2)); blob(g, '#4a4a55', () => g.arc(116, 118, 14, 0, Math.PI * 2));
    dot(g, 48, 118, 5, '#ddd'); dot(g, 116, 118, 5, '#ddd');
  },
};
export const WORD_PICS = Object.keys(PICS);

/** One wooden letter block (world prop), with a big letter. */
function block(g: G, letter: string, fill: string) {
  blob(g, fill, () => { g.moveTo(6, 14); g.lineTo(34, 6); g.lineTo(58, 14); g.lineTo(58, 50); g.lineTo(30, 58); g.lineTo(6, 50); g.closePath(); }, 3.5);
  g.beginPath(); g.moveTo(6, 14); g.lineTo(30, 22); g.lineTo(58, 14); g.moveTo(30, 22); g.lineTo(30, 58); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(6, 14); g.lineTo(34, 6); g.lineTo(58, 14); g.lineTo(30, 22); g.closePath(); g.fill();
  g.font = '900 26px Nunito, "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fffaf0'; g.strokeStyle = INK; g.lineWidth = 4; g.strokeText(letter, 18, 38); g.fillText(letter, 18, 38);
}

/** The world props, pictures and treasure icons (packed into the atlas at boot, from paintAll2). */
export function paintLearnArt(scene: Phaser.Scene) {
  // Pictures are UI-only and big, so they get their own textures (key = frame) instead of the world atlas.
  for (const k of WORD_PICS) tex(scene, `lw_${k}`, 160, 160, PICS[k], 1.5, true);
  // The letter easel: an A-frame stand with a chalk board full of bright letters.
  tex(scene, 'learn_easel', 150, 176, (g) => {
    g.lineWidth = 5; g.strokeStyle = INK;
    blob(g, '#a8703f', () => { g.moveTo(30, 172); g.lineTo(64, 18); g.lineTo(72, 18); g.lineTo(44, 172); g.closePath(); }, 4);
    blob(g, '#a8703f', () => { g.moveTo(120, 172); g.lineTo(86, 18); g.lineTo(78, 18); g.lineTo(106, 172); g.closePath(); }, 4);
    blob(g, '#c98b5a', () => { g.rect(10, 30, 130, 96); }, 5);
    blob(g, '#3f6b4a', () => { g.rect(20, 40, 110, 76); }, 3);
    blob(g, '#c98b5a', () => { g.rect(14, 124, 122, 10); }, 4);
    g.font = '900 34px Nunito, "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ([['A', 44, '#ff8a9a'], ['B', 75, '#ffd84d'], ['C', 106, '#8fd0ff']] as const).forEach(([l, x, c]) => { g.fillStyle = c; g.fillText(l, x, 72); });
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(36, 100); g.lineTo(114, 100); g.stroke();
    for (const [x, c] of [[40, '#ff8a9a'], [64, '#fffaf0'], [96, '#9be07a']] as const) blob(g, c, () => g.rect(x, 116, 16, 6), 2);
  });
  ([['A', '#e8604c'], ['B', '#5f8fd8'], ['C', '#7cc463']] as const).forEach(([l, c]) => tex(scene, `learn_block_${l}`, 64, 64, (g) => block(g, l, c)));
  // Treasure icons (48x48 like the others).
  tex(scene, 'ic_letterblock', 48, 48, (g) => { g.save(); g.translate(6, 6); g.scale(0.58, 0.58); block(g, 'A', '#e8604c'); g.restore(); g.save(); g.translate(18, 14); g.scale(0.5, 0.5); block(g, 'B', '#5f8fd8'); g.restore(); });
  tex(scene, 'ic_storybook', 48, 48, (g) => {
    blob(g, '#e8604c', () => { g.moveTo(6, 12); g.quadraticCurveTo(15, 8, 24, 13); g.quadraticCurveTo(33, 8, 42, 12); g.lineTo(42, 38); g.quadraticCurveTo(33, 34, 24, 39); g.quadraticCurveTo(15, 34, 6, 38); g.closePath(); }, 3);
    blob(g, '#fff8ea', () => { g.moveTo(9, 14); g.quadraticCurveTo(16, 11, 23, 15); g.lineTo(23, 35); g.quadraticCurveTo(16, 32, 9, 35); g.closePath(); }, 2);
    blob(g, '#fff8ea', () => { g.moveTo(39, 14); g.quadraticCurveTo(32, 11, 25, 15); g.lineTo(25, 35); g.quadraticCurveTo(32, 32, 39, 35); g.closePath(); }, 2);
    g.fillStyle = '#5f8fd8'; g.font = '900 11px sans-serif'; g.textAlign = 'center'; g.fillText('A', 16, 28); g.fillStyle = '#7cc463'; g.fillText('b', 32, 28);
  });
}
