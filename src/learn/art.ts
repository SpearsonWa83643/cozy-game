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
  // 75: six more picture words for free play.
  fox(g) {
    blob(g, '#f08a3c', () => { g.moveTo(80, 128); g.lineTo(26, 70); g.lineTo(34, 22); g.lineTo(64, 52); g.lineTo(96, 52); g.lineTo(126, 22); g.lineTo(134, 70); g.closePath(); });
    blob(g, '#3d2c20', () => { g.moveTo(38, 34); g.lineTo(40, 52); g.lineTo(54, 50); g.closePath(); }, 2);
    blob(g, '#3d2c20', () => { g.moveTo(122, 34); g.lineTo(120, 52); g.lineTo(106, 50); g.closePath(); }, 2);
    blob(g, '#fff4e4', () => { g.moveTo(80, 128); g.lineTo(44, 86); g.quadraticCurveTo(62, 78, 80, 96); g.quadraticCurveTo(98, 78, 116, 86); g.closePath(); }, 3);
    dot(g, 62, 76, 6); dot(g, 98, 76, 6); dot(g, 64, 74, 2, '#fff'); dot(g, 100, 74, 2, '#fff');
    dot(g, 80, 118, 7); smile(g, 80, 106, 7); cheeks(g, 50, 110, 92);
  },
  egg(g) {
    blob(g, '#fffaf0', () => { g.moveTo(80, 22); g.bezierCurveTo(124, 22, 132, 96, 124, 112); g.bezierCurveTo(112, 142, 48, 142, 36, 112); g.bezierCurveTo(28, 96, 36, 22, 80, 22); g.closePath(); });
    g.fillStyle = '#ffd1dc'; for (const [x, y, r] of [[56, 56, 6], [104, 64, 5], [96, 118, 6], [52, 116, 4]] as const) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    dot(g, 66, 86, 5.5); dot(g, 94, 86, 5.5); dot(g, 68, 84, 2, '#fff'); dot(g, 96, 84, 2, '#fff');
    smile(g, 80, 96, 10); cheeks(g, 56, 104, 102);
  },
  bug(g) {
    g.lineWidth = 4; g.strokeStyle = INK;
    for (const s of [-1, 1]) for (const dy of [0, 22, 44]) { g.beginPath(); g.moveTo(80 + s * 30, 74 + dy); g.lineTo(80 + s * 54, 66 + dy); g.stroke(); }
    blob(g, '#e8384c', () => g.ellipse(80, 96, 44, 40, 0, 0, Math.PI * 2));
    g.beginPath(); g.moveTo(80, 58); g.lineTo(80, 136); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
    for (const [x, y, r] of [[60, 84, 8], [100, 84, 8], [62, 112, 7], [98, 112, 7]] as const) dot(g, x, y, r);
    blob(g, '#3d2c20', () => g.arc(80, 52, 22, 0, Math.PI * 2), 3);
    dot(g, 72, 48, 5, '#fff'); dot(g, 88, 48, 5, '#fff'); dot(g, 73, 49, 2.5); dot(g, 89, 49, 2.5);
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(72, 32); g.quadraticCurveTo(64, 16, 54, 18); g.moveTo(88, 32); g.quadraticCurveTo(96, 16, 106, 18); g.stroke();
    dot(g, 54, 18, 5); dot(g, 106, 18, 5);
  },
  car(g) {
    blob(g, '#5f8fd8', () => { g.moveTo(14, 112); g.lineTo(14, 82); g.quadraticCurveTo(16, 72, 32, 70); g.lineTo(48, 70); g.lineTo(62, 44); g.lineTo(108, 44); g.lineTo(124, 70); g.quadraticCurveTo(146, 72, 148, 88); g.lineTo(148, 112); g.closePath(); });
    blob(g, '#bfe3ff', () => { g.moveTo(58, 70); g.lineTo(68, 52); g.lineTo(82, 52); g.lineTo(82, 70); g.closePath(); }, 3);
    blob(g, '#bfe3ff', () => { g.moveTo(90, 70); g.lineTo(90, 52); g.lineTo(104, 52); g.lineTo(114, 70); g.closePath(); }, 3);
    blob(g, '#ffd84d', () => g.arc(140, 92, 6, 0, Math.PI * 2), 2);
    blob(g, '#4a4a55', () => g.arc(46, 116, 16, 0, Math.PI * 2)); blob(g, '#4a4a55', () => g.arc(116, 116, 16, 0, Math.PI * 2));
    dot(g, 46, 116, 6, '#ddd'); dot(g, 116, 116, 6, '#ddd');
  },
  owl(g) {
    blob(g, '#a8703f', () => { g.moveTo(40, 40); g.lineTo(58, 50); g.lineTo(102, 50); g.lineTo(120, 40); g.quadraticCurveTo(136, 96, 118, 128); g.quadraticCurveTo(80, 146, 42, 128); g.quadraticCurveTo(24, 96, 40, 40); g.closePath(); });
    blob(g, '#f5dcb4', () => g.ellipse(80, 108, 26, 24, 0, 0, Math.PI * 2), 3);
    for (const x of [62, 98]) { blob(g, '#fff8ea', () => g.arc(x, 74, 17, 0, Math.PI * 2), 4); dot(g, x, 76, 8); dot(g, x + 2, 73, 3, '#fff'); }
    blob(g, '#f5a623', () => { g.moveTo(74, 88); g.lineTo(86, 88); g.lineTo(80, 100); g.closePath(); }, 3);
    g.lineWidth = 3; g.strokeStyle = 'rgba(61,44,32,0.5)'; for (const [x, y] of [[72, 104], [88, 104], [80, 116]] as const) { g.beginPath(); g.arc(x, y, 5, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); }
  },
  pie(g) {
    blob(g, '#d9a35a', () => { g.moveTo(16, 92); g.lineTo(144, 92); g.lineTo(130, 126); g.lineTo(30, 126); g.closePath(); });
    blob(g, '#f2c27a', () => { g.moveTo(16, 92); g.quadraticCurveTo(80, 30, 144, 92); g.closePath(); });
    g.lineWidth = 4; g.strokeStyle = '#b07a3a';
    for (const x of [56, 80, 104]) { g.beginPath(); g.moveTo(x - 6, 70); g.lineTo(x + 6, 78); g.stroke(); }
    g.fillStyle = '#c8475a'; for (const x of [40, 64, 96, 120]) { g.beginPath(); g.arc(x, 92, 5, 0, Math.PI * 2); g.fill(); }
    dot(g, 66, 108, 5); dot(g, 94, 108, 5); smile(g, 80, 112, 8); cheeks(g, 52, 108, 116);
    g.lineWidth = 4; g.strokeStyle = 'rgba(120,100,90,0.6)';
    for (const x of [64, 82, 98]) { g.beginPath(); g.moveTo(x, 44); g.quadraticCurveTo(x - 8, 34, x, 24); g.stroke(); }
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

function easel(g: G, chars: readonly (readonly [string, number, string])[]) {
    g.lineWidth = 5; g.strokeStyle = INK;
    blob(g, '#a8703f', () => { g.moveTo(30, 172); g.lineTo(64, 18); g.lineTo(72, 18); g.lineTo(44, 172); g.closePath(); }, 4);
    blob(g, '#a8703f', () => { g.moveTo(120, 172); g.lineTo(86, 18); g.lineTo(78, 18); g.lineTo(106, 172); g.closePath(); }, 4);
    blob(g, '#c98b5a', () => { g.rect(10, 30, 130, 96); }, 5);
    blob(g, '#3f6b4a', () => { g.rect(20, 40, 110, 76); }, 3);
    blob(g, '#c98b5a', () => { g.rect(14, 124, 122, 10); }, 4);
    g.font = '900 34px Nunito, "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    chars.forEach(([l, x, c]) => { g.fillStyle = c; g.fillText(l, x, 72); });
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(36, 100); g.lineTo(114, 100); g.stroke();
    for (const [x, c] of [[40, '#ff8a9a'], [64, '#fffaf0'], [96, '#9be07a']] as const) blob(g, c, () => g.rect(x, 116, 16, 6), 2);
}

/** The world props, pictures and treasure icons (packed into the atlas at boot, from paintAll2). */
export function paintLearnArt(scene: Phaser.Scene) {
  // Pictures are UI-only and big, so they get their own textures (key = frame) instead of the world atlas.
  for (const k of WORD_PICS) tex(scene, `lw_${k}`, 160, 160, PICS[k], 1.5, true);
  // The letter easel: an A-frame stand with a chalk board full of bright letters.
  tex(scene, 'learn_easel', 150, 176, (g) => easel(g, [['A', 44, '#ff8a9a'], ['B', 75, '#ffd84d'], ['C', 106, '#8fd0ff']]));
  // 67: the counting board: the same easel with 1 + 2 on it.
  tex(scene, 'learn_numboard', 150, 176, (g) => easel(g, [['1', 40, '#ff8a9a'], ['+', 75, '#fffaf0'], ['2', 110, '#ffd84d']]));
  ([['A', '#e8604c'], ['B', '#5f8fd8'], ['C', '#7cc463'], ['1', '#f2a65a'], ['2', '#9372c8'], ['3', '#4fb0a8']] as const).forEach(([l, c]) => tex(scene, `learn_block_${l}`, 64, 64, (g) => block(g, l, c)));
  // 67: things to count (UI only, so standalone textures).
  tex(scene, 'lc_apple', 96, 96, (g) => apple(g, 48, 52, 1), 1.5, true);
  tex(scene, 'lc_stone', 96, 96, (g) => stone(g, 48, 54, 1), 1.5, true);
  // 76: surprise things for free play.
  tex(scene, 'lc_shell', 96, 96, (g) => {
    blob(g, '#ffc9a8', () => { g.moveTo(48, 86); g.lineTo(14, 44); g.quadraticCurveTo(48, -2, 82, 44); g.closePath(); }, 4);
    g.lineWidth = 3; g.strokeStyle = '#d98a6a'; for (const a of [-0.55, -0.27, 0, 0.27, 0.55]) { g.beginPath(); g.moveTo(48, 84); g.lineTo(48 + Math.sin(a) * 40, 84 - Math.cos(a) * 62); g.stroke(); }
    blob(g, '#ffb08a', () => { g.moveTo(36, 90); g.lineTo(48, 78); g.lineTo(60, 90); g.closePath(); }, 3);
  }, 1.5, true);
  tex(scene, 'lc_star', 96, 96, (g) => {
    blob(g, '#ffd84d', () => { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 18 : 40; const x = 48 + Math.cos(a) * r, y = 52 + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); }, 4);
    dot(g, 40, 50, 4); dot(g, 56, 50, 4); smile(g, 48, 56, 6);
  }, 1.5, true);
  tex(scene, 'lc_berry', 96, 96, (g) => {
    blob(g, '#e8384c', () => { g.moveTo(48, 90); g.bezierCurveTo(14, 64, 14, 30, 30, 26); g.quadraticCurveTo(48, 20, 66, 26); g.bezierCurveTo(82, 30, 82, 64, 48, 90); g.closePath(); });
    g.fillStyle = '#ffe9a0'; for (const [x, y] of [[34, 42], [48, 38], [62, 42], [40, 56], [56, 56], [48, 70]] as const) { g.beginPath(); g.ellipse(x, y, 2.2, 3.2, 0, 0, Math.PI * 2); g.fill(); }
    blob(g, '#7cc463', () => { g.moveTo(26, 26); g.lineTo(38, 12); g.lineTo(48, 22); g.lineTo(58, 12); g.lineTo(70, 26); g.quadraticCurveTo(48, 34, 26, 26); g.closePath(); }, 3);
  }, 1.5, true);
  tex(scene, 'lc_fish', 96, 96, (g) => {
    blob(g, '#ffa94d', () => { g.moveTo(70, 50); g.lineTo(90, 32); g.lineTo(90, 70); g.closePath(); }, 4);
    blob(g, '#ffa94d', () => g.ellipse(44, 50, 32, 22, 0, 0, Math.PI * 2));
    g.lineWidth = 3; g.strokeStyle = '#e07a2a'; for (const x of [48, 58]) { g.beginPath(); g.arc(x, 50, 12, -0.9, 0.9); g.stroke(); }
    dot(g, 26, 44, 5); dot(g, 27, 43, 1.8, '#fff'); smile(g, 22, 54, 5);
  }, 1.5, true);
  // Treasure icons (48x48 like the others).
  tex(scene, 'ic_letterblock', 48, 48, (g) => { g.save(); g.translate(6, 6); g.scale(0.58, 0.58); block(g, 'A', '#e8604c'); g.restore(); g.save(); g.translate(18, 14); g.scale(0.5, 0.5); block(g, 'B', '#5f8fd8'); g.restore(); });
  tex(scene, 'ic_storybook', 48, 48, (g) => {
    blob(g, '#e8604c', () => { g.moveTo(6, 12); g.quadraticCurveTo(15, 8, 24, 13); g.quadraticCurveTo(33, 8, 42, 12); g.lineTo(42, 38); g.quadraticCurveTo(33, 34, 24, 39); g.quadraticCurveTo(15, 34, 6, 38); g.closePath(); }, 3);
    blob(g, '#fff8ea', () => { g.moveTo(9, 14); g.quadraticCurveTo(16, 11, 23, 15); g.lineTo(23, 35); g.quadraticCurveTo(16, 32, 9, 35); g.closePath(); }, 2);
    blob(g, '#fff8ea', () => { g.moveTo(39, 14); g.quadraticCurveTo(32, 11, 25, 15); g.lineTo(25, 35); g.quadraticCurveTo(32, 32, 39, 35); g.closePath(); }, 2);
    g.fillStyle = '#5f8fd8'; g.font = '900 11px sans-serif'; g.textAlign = 'center'; g.fillText('A', 16, 28); g.fillStyle = '#7cc463'; g.fillText('b', 32, 28);
  });
  // 67 treasures: a little bead abacus and a smiling counting star.
  tex(scene, 'ic_abacus', 48, 48, (g) => {
    blob(g, '#c98b5a', () => g.rect(5, 6, 38, 36), 3);
    blob(g, '#fff8ea', () => g.rect(10, 11, 28, 26), 2);
    g.strokeStyle = INK; g.lineWidth = 2;
    const cols = ['#e8604c', '#ffd84d', '#5f8fd8'];
    for (let r = 0; r < 3; r++) {
      const y = 16 + r * 8.5; g.beginPath(); g.moveTo(10, y); g.lineTo(38, y); g.stroke();
      for (let b = 0; b < 3; b++) blob(g, cols[r], () => g.arc(14 + b * 6 + (r === 1 ? 8 : 0), y, 3.2, 0, Math.PI * 2), 1.5);
    }
  });
  tex(scene, 'ic_numstar', 48, 48, (g) => {
    blob(g, '#ffd84d', () => { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 9 : 20; const x = 24 + Math.cos(a) * r, y = 25 + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); }, 3);
    g.fillStyle = INK; g.font = '900 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('3', 24, 27);
  });
}

/** A shiny red apple with a leaf (size 1 = about 80px). */
function apple(g: G, x: number, y: number, k: number) {
  g.save(); g.translate(x, y); g.scale(k, k);
  g.lineWidth = 5; g.strokeStyle = INK; g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(2, -36, 8, -40); g.stroke();
  blob(g, '#7cc463', () => { g.moveTo(4, -30); g.quadraticCurveTo(20, -44, 30, -34); g.quadraticCurveTo(18, -22, 4, -30); }, 3);
  blob(g, '#e8604c', () => { g.moveTo(0, -22); g.bezierCurveTo(-22, -36, -42, -14, -32, 10); g.bezierCurveTo(-24, 30, -8, 34, 0, 28); g.bezierCurveTo(8, 34, 24, 30, 32, 10); g.bezierCurveTo(42, -14, 22, -36, 0, -22); g.closePath(); });
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-16, -8, 6, 11, 0.4, 0, Math.PI * 2); g.fill();
  g.restore();
}
/** A smooth round river stone with a little shine. */
function stone(g: G, x: number, y: number, k: number) {
  g.save(); g.translate(x, y); g.scale(k, k);
  blob(g, '#9aa7b4', () => { g.moveTo(-34, 6); g.bezierCurveTo(-36, -22, -8, -30, 10, -26); g.bezierCurveTo(32, -22, 40, -2, 34, 14); g.bezierCurveTo(28, 30, -28, 30, -34, 6); g.closePath(); });
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-10, -14, 12, 5, -0.25, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(61,44,32,0.18)'; g.beginPath(); g.ellipse(6, 16, 20, 5, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}
