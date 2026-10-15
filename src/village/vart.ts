// Village + theme art in a bold, clean style: flat saturated fills, strong dark outlines,
// one simple highlight. Painted once at boot into a second, smaller atlas.
import Phaser from 'phaser';
import { Ctx, canvasTex, atlasTarget, buildAtlas, ATLAS2, ATLAS, mulberry32, rr } from '../art';
import { paintSeqArt } from '../seq';

const INK = '#3b2a35';
const LW = 3;

/** Fill + bold outline for the current path. */
function fo(c: Ctx, fill: string | CanvasGradient, lw = LW, ink = INK) {
  c.fillStyle = fill; c.fill();
  c.lineWidth = lw; c.strokeStyle = ink; c.stroke();
}
function rect(c: Ctx, x: number, y: number, w: number, h: number, r: number | number[], fill: string, lw = LW) {
  c.beginPath(); c.roundRect(x, y, w, h, r as any); fo(c, fill, lw);
}
function circ(c: Ctx, x: number, y: number, r: number, fill: string, lw = LW) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); fo(c, fill, lw);
}
function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, lw = LW, rot = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); fo(c, fill, lw);
}
function hi(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.45) {
  c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.ellipse(x, y, rx, ry, -0.3, 0, Math.PI * 2); c.fill();
}
function poly(c: Ctx, pts: [number, number][], fill: string, lw = LW) {
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); fo(c, fill, lw);
}
function groundShadow(c: Ctx, cx: number, by: number, rx: number) {
  c.fillStyle = 'rgba(30,20,40,0.22)'; c.beginPath(); c.ellipse(cx, by - 3, rx, rx * 0.22, 0, 0, Math.PI * 2); c.fill();
}

// ---------------------------------------------------------------- buildings (150 wide)
function house(c: Ctx, w: number, h: number, wall: string, roof: string, roofHi: string, door: string, extra?: (c: Ctx) => void) {
  const cx = w / 2, by = h - 6;
  groundShadow(c, cx, by + 2, 66);
  rect(c, cx - 52, by - 70, 104, 70, [6, 6, 4, 4], wall);
  // Roof.
  poly(c, [[cx - 66, by - 64], [cx, by - 128], [cx + 66, by - 64]], roof, 3.5);
  c.fillStyle = roofHi; c.beginPath(); c.moveTo(cx - 48, by - 70); c.lineTo(cx, by - 116); c.lineTo(cx - 8, by - 70); c.closePath(); c.fill();
  // Door.
  c.beginPath(); c.roundRect(cx - 14, by - 44, 28, 44, [14, 14, 0, 0]); fo(c, door);
  circ(c, cx + 7, by - 22, 2.2, '#f6d36b', 1.5);
  // Windows.
  for (const dx of [-36, 36]) { rect(c, cx + dx - 11, by - 54, 22, 20, 5, '#ffe9a6'); c.beginPath(); c.moveTo(cx + dx, by - 54); c.lineTo(cx + dx, by - 34); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); }
  extra?.(c);
}
function paintHome(c: Ctx, w: number, h: number) {
  house(c, w, h, '#fff1d6', '#e8604c', '#ff8a6e', '#9a5b3a', (c) => {
    const cx = w / 2, by = h - 6;
    rect(c, cx + 26, by - 128, 14, 30, 2, '#b46a4f');
    ell(c, cx, by - 4, 18, 4, '#d9b48a', 2);
    // Heart on the door.
    c.fillStyle = '#ff8fa3'; c.beginPath(); const x = cx, y = by - 32; c.moveTo(x, y + 4); c.bezierCurveTo(x - 7, y - 2, x - 3, y - 7, x, y - 3); c.bezierCurveTo(x + 3, y - 7, x + 7, y - 2, x, y + 4); c.fill();
  });
}
function paintKitchen(c: Ctx, w: number, h: number) {
  house(c, w, h, '#fde7c8', '#f2a93b', '#ffc96b', '#8a5a3c', (c) => {
    const cx = w / 2, by = h - 6;
    rect(c, cx - 38, by - 128, 16, 36, 2, '#a35f45');
    // Striped awning.
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(cx - 60 + i * 20, by - 72); c.lineTo(cx - 40 + i * 20, by - 72); c.lineTo(cx - 40 + i * 20, by - 62); c.quadraticCurveTo(cx - 50 + i * 20, by - 56, cx - 60 + i * 20, by - 62); c.closePath(); fo(c, i % 2 ? '#ffffff' : '#e8604c', 2); }
    // Pot sign.
    circ(c, cx, by - 96, 15, '#fff6e6', 2.5);
    c.beginPath(); c.roundRect(cx - 9, by - 98, 18, 11, [0, 0, 6, 6]); fo(c, '#5b6b7a', 2);
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 4, by - 102); c.quadraticCurveTo(cx - 6, by - 108, cx - 3, by - 111); c.moveTo(cx + 3, by - 102); c.quadraticCurveTo(cx + 1, by - 108, cx + 4, by - 111); c.stroke();
  });
}
function paintWorkshop(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 6;
  groundShadow(c, cx, by + 2, 68);
  rect(c, cx - 58, by - 66, 116, 66, 4, '#c98f5a');
  c.strokeStyle = 'rgba(59,42,53,0.35)'; c.lineWidth = 2;
  for (let x = cx - 44; x < cx + 58; x += 16) { c.beginPath(); c.moveTo(x, by - 64); c.lineTo(x, by - 2); c.stroke(); }
  poly(c, [[cx - 68, by - 60], [cx - 50, by - 104], [cx + 50, by - 104], [cx + 68, by - 60]], '#6d8f6a', 3.5);
  c.fillStyle = '#8fb88a'; c.fillRect(cx - 46, by - 100, 40, 6);
  // Big open door.
  rect(c, cx - 22, by - 48, 44, 48, [4, 4, 0, 0], '#4a3240');
  // Saw sign.
  rect(c, cx - 26, by - 98, 52, 22, 6, '#fff1d6', 2.5);
  c.beginPath(); c.moveTo(cx - 16, by - 87); c.lineTo(cx + 12, by - 87); c.lineTo(cx + 12, by - 83); c.lineTo(cx - 16, by - 83); c.closePath(); fo(c, '#c9d3dc', 1.5);
  rect(c, cx + 10, by - 91, 8, 12, 2, '#b46a4f', 1.5);
  // Log pile + stones.
  for (const [x, y] of [[cx + 44, by - 8], [cx + 58, by - 8], [cx + 51, by - 20]] as [number, number][]) { circ(c, x, y, 8, '#b07a4a', 2.5); circ(c, x, y, 3.5, '#e2b27a', 1.5); }
  ell(c, cx - 52, by - 8, 10, 7, '#a9b4bf', 2.5); ell(c, cx - 40, by - 6, 7, 5, '#8f9ba6', 2.5);
}
function paintFishHut(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 6;
  groundShadow(c, cx, by + 2, 62);
  for (const dx of [-44, -14, 14, 44]) rect(c, cx + dx - 4, by - 26, 8, 26, 2, '#8a5a3c', 2.5);
  rect(c, cx - 56, by - 34, 112, 10, 3, '#b07a4a');
  rect(c, cx - 46, by - 92, 92, 60, 5, '#7cc0e0');
  c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 3; for (let y = by - 80; y < by - 36; y += 12) { c.beginPath(); c.moveTo(cx - 42, y); c.lineTo(cx + 42, y); c.stroke(); }
  poly(c, [[cx - 58, by - 86], [cx, by - 130], [cx + 58, by - 86]], '#3f7fb5', 3.5);
  rect(c, cx - 12, by - 70, 24, 36, [12, 12, 0, 0], '#4a3240');
  // Fish sign.
  c.beginPath(); c.ellipse(cx, by - 104, 16, 8, 0, 0, Math.PI * 2); fo(c, '#ffb35c', 2.5);
  poly(c, [[cx + 14, by - 104], [cx + 24, by - 111], [cx + 24, by - 97]], '#ffb35c', 2.5);
  circ(c, cx - 8, by - 106, 1.8, INK, 1);
  // Net.
  c.strokeStyle = 'rgba(59,42,53,0.6)'; c.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(cx + 30 + i * 4, by - 84); c.lineTo(cx + 26 + i * 5, by - 44); c.stroke(); }
}
function paintGarden(c: Ctx, w: number, h: number, stage: number) {
  const cx = w / 2, by = h - 6;
  rect(c, cx - 66, by - 76, 132, 72, 14, '#8a5a3c', 3.5);
  for (let r = 0; r < 3; r++) {
    const y = by - 62 + r * 22;
    c.beginPath(); c.roundRect(cx - 58, y - 6, 116, 14, 7); c.fillStyle = '#6e4430'; c.fill();
    for (let i = 0; i < 5; i++) {
      const x = cx - 46 + i * 23;
      if (stage === 0) { circ(c, x, y, 3, '#7cc463', 1.5); continue; }
      if ((r + i) % 3 === 0) { // cabbage
        circ(c, x, y - 2, 8, '#8fd16a', 2.5); circ(c, x, y - 3, 4, '#c3ef9a', 1.5);
      } else if ((r + i) % 3 === 1) { // carrot tops
        for (const a of [-0.5, 0, 0.5]) { c.beginPath(); c.ellipse(x + Math.sin(a) * 6, y - 8, 2.6, 7, a, 0, Math.PI * 2); fo(c, '#5fbf4a', 1.8); }
        c.beginPath(); c.moveTo(x - 4, y - 2); c.lineTo(x + 4, y - 2); c.lineTo(x, y + 5); c.closePath(); fo(c, '#ff9a3c', 1.8);
      } else { // tomato
        c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x, y - 12); c.lineWidth = 2; c.strokeStyle = '#4f9a3a'; c.stroke();
        circ(c, x - 4, y - 6, 4, '#ff5a4f', 1.8); circ(c, x + 4, y - 9, 3.5, '#ff5a4f', 1.8);
      }
    }
  }
  // Little fence posts.
  for (const dx of [-66, 66]) rect(c, cx + dx - 4, by - 84, 8, 18, [4, 4, 1, 1], '#fff1d6', 2.5);
}
// ---------------------------------------------------------------- decor (~80 wide)
function paintFlowerbed(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 6;
  ell(c, cx, by - 12, 34, 13, '#8a5a3c', 3);
  const cols = ['#ff7fa8', '#ffd84d', '#a98bff', '#ff8a5c', '#7fd0ff'];
  const rng = mulberry32(4);
  for (let i = 0; i < 9; i++) {
    const x = cx - 24 + (i % 5) * 12 + rr(rng, -2, 2), y = by - 16 - Math.floor(i / 5) * 9 + rr(rng, -2, 2);
    c.beginPath(); c.moveTo(x, y + 8); c.lineTo(x, y); c.lineWidth = 2; c.strokeStyle = '#4f9a3a'; c.stroke();
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; c.beginPath(); c.arc(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6, 3, 0, Math.PI * 2); fo(c, cols[i % 5], 1.4); }
    circ(c, x, y, 2.2, '#fff3b0', 1.2);
  }
}
function paintLamp(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 6;
  groundShadow(c, cx, by, 16);
  rect(c, cx - 10, by - 8, 20, 8, 3, '#4a5560');
  rect(c, cx - 3.5, by - 70, 7, 64, 3, '#4a5560');
  rect(c, cx - 12, by - 92, 24, 24, 6, '#ffe58a', 3);
  poly(c, [[cx - 15, by - 92], [cx, by - 104], [cx + 15, by - 92]], '#4a5560');
  hi(c, cx - 4, by - 84, 4, 6, 0.6);
}
function paintWell(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 6;
  groundShadow(c, cx, by, 34);
  rect(c, cx - 30, by - 34, 60, 34, [6, 6, 10, 10], '#a9b4bf');
  c.strokeStyle = 'rgba(59,42,53,0.35)'; c.lineWidth = 2;
  for (let y = by - 24; y < by; y += 11) { c.beginPath(); c.moveTo(cx - 28, y); c.lineTo(cx + 28, y); c.stroke(); }
  ell(c, cx, by - 34, 30, 8, '#4a7fa8', 3);
  for (const dx of [-26, 22]) rect(c, cx + dx, by - 78, 5, 46, 2, '#8a5a3c', 2.5);
  poly(c, [[cx - 36, by - 72], [cx, by - 98], [cx + 36, by - 72]], '#e8604c', 3);
  c.beginPath(); c.moveTo(cx, by - 74); c.lineTo(cx, by - 52); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
  rect(c, cx - 7, by - 54, 14, 12, 3, '#b07a4a', 2.5);
}
function paintBench(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 6;
  groundShadow(c, cx, by, 36);
  for (const dx of [-28, 22]) rect(c, cx + dx, by - 22, 6, 22, 2, '#6e4430', 2.5);
  rect(c, cx - 36, by - 28, 72, 9, 3, '#c98f5a');
  rect(c, cx - 34, by - 52, 68, 9, 3, '#c98f5a');
  rect(c, cx - 34, by - 41, 68, 8, 3, '#c98f5a');
  // Shells on the backrest.
  for (const dx of [-18, 0, 18]) { c.beginPath(); c.arc(cx + dx, by - 48, 5, Math.PI, 0); fo(c, '#ffd3c4', 1.6); }
}
function paintStatue(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 6;
  groundShadow(c, cx, by, 26);
  rect(c, cx - 22, by - 20, 44, 20, 4, '#a9b4bf');
  // A sitting fox in warm stone.
  ell(c, cx, by - 38, 16, 18, '#ff9a4f');
  c.beginPath(); c.moveTo(cx + 12, by - 26); c.quadraticCurveTo(cx + 34, by - 32, cx + 24, by - 52); c.quadraticCurveTo(cx + 22, by - 38, cx + 8, by - 34); fo(c, '#ff9a4f');
  circ(c, cx, by - 62, 13, '#ff9a4f');
  poly(c, [[cx - 12, by - 68], [cx - 9, by - 84], [cx - 2, by - 72]], '#ff9a4f', 2.5);
  poly(c, [[cx + 12, by - 68], [cx + 9, by - 84], [cx + 2, by - 72]], '#ff9a4f', 2.5);
  ell(c, cx, by - 56, 7, 5, '#fff1d6', 2);
  circ(c, cx - 5, by - 64, 1.8, INK, 1); circ(c, cx + 5, by - 64, 1.8, INK, 1);
  circ(c, cx, by - 58, 1.8, INK, 1);
}
function paintSign(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 4;
  rect(c, cx - 4, by - 46, 8, 46, 2, '#8a5a3c', 2.5);
  rect(c, cx - 40, by - 70, 80, 32, 8, '#fff1d6', 3);
  // Little house icon on the sign.
  poly(c, [[cx - 12, by - 54], [cx, by - 64], [cx + 12, by - 54]], '#e8604c', 2);
  rect(c, cx - 9, by - 54, 18, 11, 2, '#ffe9a6', 2);
}

// ---------------------------------------------------------------- villagers (animal folk)
type Kind = { body: string; belly: string; ear: 'bunny' | 'fox' | 'bear' | 'cat' | 'frog' | 'mouse'; shirt: string };
export const KINDS: Kind[] = [
  { body: '#fff4ea', belly: '#ffd6e0', ear: 'bunny', shirt: '#7fb7ff' },
  { body: '#ff9a4f', belly: '#fff1d6', ear: 'fox', shirt: '#6fcf8a' },
  { body: '#b88356', belly: '#ecc79b', ear: 'bear', shirt: '#ff7f7f' },
  { body: '#8c8fa3', belly: '#e6e3ee', ear: 'cat', shirt: '#ffd84d' },
  { body: '#7fd36a', belly: '#e7f7b8', ear: 'frog', shirt: '#b48cff' },
  { body: '#c9b8a8', belly: '#f6e9df', ear: 'mouse', shirt: '#ff9ccf' },
];
function paintVillager(k: Kind, frame: number) {
  return (c: Ctx, w: number, h: number) => {
    const cx = w / 2, by = h - 3;
    const step = frame ? 3 : 0;
    groundShadow(c, cx, by + 1, 13);
    // Feet.
    ell(c, cx - 7, by - 4 - (frame ? 2 : 0), 6, 4, k.body, 2.5);
    ell(c, cx + 7, by - 4 - (frame ? 0 : 2), 6, 4, k.body, 2.5);
    // Body + shirt.
    c.beginPath(); c.roundRect(cx - 13, by - 30 - step * 0.3, 26, 26, 11); fo(c, k.shirt, 2.8);
    ell(c, cx, by - 14, 7, 6, 'rgba(255,255,255,0.35)', 0.01);
    // Arms.
    ell(c, cx - 15, by - 20 + (frame ? -2 : 1), 4.5, 7, k.body, 2.5, 0.3);
    ell(c, cx + 15, by - 20 + (frame ? 1 : -2), 4.5, 7, k.body, 2.5, -0.3);
    // Ears behind head.
    const hy = by - 44;
    const earFill = (f: string) => f;
    if (k.ear === 'bunny') { ell(c, cx - 7, hy - 22, 5, 13, k.body, 2.5, -0.15); ell(c, cx + 7, hy - 22, 5, 13, k.body, 2.5, 0.15); ell(c, cx - 7, hy - 21, 2.2, 8, k.belly, 0.01, -0.15); ell(c, cx + 7, hy - 21, 2.2, 8, k.belly, 0.01, 0.15); }
    if (k.ear === 'fox' || k.ear === 'cat') { poly(c, [[cx - 15, hy - 6], [cx - 12, hy - 24], [cx - 2, hy - 12]], k.body, 2.5); poly(c, [[cx + 15, hy - 6], [cx + 12, hy - 24], [cx + 2, hy - 12]], k.body, 2.5); }
    if (k.ear === 'bear') { circ(c, cx - 12, hy - 12, 6, k.body, 2.5); circ(c, cx + 12, hy - 12, 6, k.body, 2.5); circ(c, cx - 12, hy - 12, 2.6, k.belly, 0.01); circ(c, cx + 12, hy - 12, 2.6, k.belly, 0.01); }
    if (k.ear === 'mouse') { circ(c, cx - 13, hy - 12, 8, k.body, 2.5); circ(c, cx + 13, hy - 12, 8, k.body, 2.5); circ(c, cx - 13, hy - 12, 4.5, k.belly, 0.01); circ(c, cx + 13, hy - 12, 4.5, k.belly, 0.01); }
    // Head.
    ell(c, cx, hy, 17, 15, k.body, 3);
    if (k.ear === 'frog') { circ(c, cx - 9, hy - 13, 6.5, k.body, 2.5); circ(c, cx + 9, hy - 13, 6.5, k.body, 2.5); }
    ell(c, cx, hy + 5, 9, 6, k.belly, 0.01);
    void earFill;
    // Face.
    const ey = k.ear === 'frog' ? hy - 13 : hy - 2;
    circ(c, cx - 6, ey, 2.6, INK, 0.01); circ(c, cx + 6, ey, 2.6, INK, 0.01);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx - 5.2, ey - 1, 0.9, 0, Math.PI * 2); c.arc(cx + 6.8, ey - 1, 0.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,120,150,0.55)'; c.beginPath(); c.ellipse(cx - 11, hy + 3, 3.2, 2, 0, 0, Math.PI * 2); c.ellipse(cx + 11, hy + 3, 3.2, 2, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.arc(cx, hy + 3, 3, 0.2, Math.PI - 0.2); c.stroke();
    if (k.ear === 'fox' || k.ear === 'cat' || k.ear === 'bear' || k.ear === 'mouse' || k.ear === 'bunny') { c.fillStyle = INK; c.beginPath(); c.ellipse(cx, hy + 1, 1.8, 1.3, 0, 0, Math.PI * 2); c.fill(); }
    hi(c, cx - 7, hy - 8, 5, 3, 0.35);
  };
}

// ---------------------------------------------------------------- icons (48x48)
function icon(fn: (c: Ctx, s: number) => void) { return (c: Ctx) => fn(c, 48); }
const ICONS: Record<string, (c: Ctx, s: number) => void> = {
  i_food: (c) => { circ(c, 24, 28, 15, '#ff5a4f', 3); c.beginPath(); c.moveTo(24, 14); c.quadraticCurveTo(25, 8, 29, 6); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); ell(c, 31, 11, 6, 3.5, '#5fbf4a', 2.5, -0.5); hi(c, 18, 22, 4, 6, 0.55); },
  i_wood: (c) => { c.beginPath(); c.roundRect(6, 16, 34, 18, 9); fo(c, '#c98f5a', 3); ell(c, 38, 25, 6, 9, '#f0c48a', 3); ell(c, 38, 25, 2.5, 4, '#c98f5a', 1.5); c.strokeStyle = 'rgba(59,42,53,0.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(12, 22); c.lineTo(28, 22); c.moveTo(14, 28); c.lineTo(30, 28); c.stroke(); },
  i_stone: (c) => { poly(c, [[8, 36], [12, 20], [24, 12], [38, 17], [42, 34], [30, 40], [14, 40]], '#a9b4bf', 3); hi(c, 20, 20, 6, 3, 0.6); c.strokeStyle = 'rgba(59,42,53,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(24, 24); c.lineTo(30, 32); c.stroke(); },
  i_sleep: (c) => {
    circ(c, 24, 25, 16, '#ffe07a', 3);
    c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(32, 17, 13, 0, Math.PI * 2); c.fill(); c.restore();
    c.save(); c.beginPath(); c.arc(24, 25, 17.4, 0, Math.PI * 2); c.clip(); c.beginPath(); c.arc(32, 17, 13, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.restore();
  },
  i_fun: (c) => { const p: [number, number][] = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 8 : 18; p.push([24 + Math.cos(a) * r, 25 + Math.sin(a) * r]); } poly(c, p, '#ffcf3f', 3); },
  /** White halo behind a mood face; tinted amber / coral when a friend needs care. */
  f_ring: (c) => { const g = c.createRadialGradient(24, 24, 12, 24, 24, 24); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.95)'); g.addColorStop(0.8, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 48, 48); },
  f_happy: (c) => { circ(c, 24, 24, 19, '#ffd84d', 3); circ(c, 17, 20, 2.6, INK, 0.01); circ(c, 31, 20, 2.6, INK, 0.01); c.beginPath(); c.arc(24, 26, 9, 0.15, Math.PI - 0.15); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.fillStyle = 'rgba(255,120,150,0.6)'; c.beginPath(); c.arc(13, 28, 3, 0, 7); c.arc(35, 28, 3, 0, 7); c.fill(); },
  f_ok: (c) => { circ(c, 24, 24, 19, '#ffe9a0', 3); circ(c, 17, 21, 2.6, INK, 0.01); circ(c, 31, 21, 2.6, INK, 0.01); c.beginPath(); c.arc(24, 27, 5, 0.3, Math.PI - 0.3); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); },
  f_meh: (c) => { circ(c, 24, 24, 19, '#cfe3ff', 3); c.lineWidth = 3; c.strokeStyle = INK; c.beginPath(); c.moveTo(13, 21); c.lineTo(20, 21); c.moveTo(28, 21); c.lineTo(35, 21); c.moveTo(18, 32); c.lineTo(30, 32); c.stroke(); },
  i_hammer: (c) => { c.save(); c.translate(24, 24); c.rotate(-0.7); rect(c, -3.5, -4, 7, 26, 3, '#c98f5a'); rect(c, -14, -16, 28, 13, 4, '#8f9ba6'); c.restore(); },
  i_pumpkin: (c) => { for (const [x, rx] of [[15, 9], [33, 9], [24, 11]] as [number, number][]) ell(c, x, 28, rx, 14, '#ff8c2e', 3); rect(c, 21, 8, 6, 9, 2, '#5c8a3a', 2.5); hi(c, 19, 22, 3, 6, 0.5); },
  i_leaf: (c) => { c.beginPath(); c.moveTo(10, 38); c.quadraticCurveTo(8, 10, 38, 8); c.quadraticCurveTo(40, 36, 10, 38); fo(c, '#5fbf4a', 3); c.beginPath(); c.moveTo(12, 36); c.quadraticCurveTo(22, 22, 34, 12); c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke(); },
  i_cart: (c) => { rect(c, 6, 14, 36, 18, 4, '#e8604c'); c.fillStyle = '#fff'; c.fillRect(10, 18, 6, 10); c.fillRect(22, 18, 6, 10); circ(c, 14, 36, 6, '#8a5a3c'); circ(c, 34, 36, 6, '#8a5a3c'); },
  i_party: (c) => { poly(c, [[10, 40], [20, 10], [38, 30]], '#b48cff', 3); for (const [x, y, f] of [[30, 10, '#ffd84d'], [38, 18, '#ff7fa8'], [36, 6, '#7fd0ff']] as [number, number, string][]) circ(c, x, y, 3, f, 1.5); },
  i_rain: (c) => { ell(c, 24, 18, 16, 10, '#dfe8f2', 3); for (const x of [14, 24, 34]) { c.beginPath(); c.moveTo(x, 32); c.quadraticCurveTo(x - 4, 38, x, 41); c.quadraticCurveTo(x + 4, 38, x, 32); fo(c, '#6fb6ff', 2); } },
  i_check: (c) => { circ(c, 24, 24, 20, '#7cc463', 3); c.beginPath(); c.moveTo(14, 25); c.lineTo(21, 32); c.lineTo(34, 17); c.lineWidth = 5; c.strokeStyle = '#fff'; c.stroke(); },
  i_cross: (c) => { circ(c, 24, 24, 20, '#f08a7a', 3); c.lineWidth = 5; c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(16, 16); c.lineTo(32, 32); c.moveTo(32, 16); c.lineTo(16, 32); c.stroke(); },
  i_heart: (c) => { c.beginPath(); c.moveTo(24, 40); c.bezierCurveTo(4, 26, 10, 8, 24, 17); c.bezierCurveTo(38, 8, 44, 26, 24, 40); fo(c, '#ff7f9e', 3); hi(c, 16, 18, 3, 5, 0.55); },
};

// ---------------------------------------------------------------- Halloween
function paintPumpkin(face: boolean) {
  return (c: Ctx, w: number, h: number) => {
    const cx = w / 2, by = h - 4;
    groundShadow(c, cx, by + 2, 18);
    for (const [dx, rx] of [[-9, 10], [9, 10], [0, 12]] as [number, number][]) ell(c, cx + dx, by - 14, rx, 13, '#ff8c2e', 2.8);
    rect(c, cx - 3, by - 34, 6, 8, 2, '#5c8a3a', 2.2);
    if (face) {
      c.fillStyle = '#ffe36b';
      poly(c, [[cx - 9, by - 18], [cx - 4, by - 18], [cx - 6.5, by - 23]], '#ffe36b', 1.2);
      poly(c, [[cx + 9, by - 18], [cx + 4, by - 18], [cx + 6.5, by - 23]], '#ffe36b', 1.2);
      c.beginPath(); c.moveTo(cx - 9, by - 12); c.quadraticCurveTo(cx, by - 4, cx + 9, by - 12); c.quadraticCurveTo(cx, by - 8, cx - 9, by - 12); fo(c, '#ffe36b', 1.2);
    } else hi(c, cx - 6, by - 20, 3, 5, 0.45);
  };
}
function paintCandle(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 3;
  ell(c, cx, by - 3, 9, 3.5, '#8f9ba6', 2);
  rect(c, cx - 4.5, by - 24, 9, 21, 3, '#fff4dc', 2.2);
  c.beginPath(); c.moveTo(cx, by - 36); c.quadraticCurveTo(cx + 5, by - 29, cx, by - 25); c.quadraticCurveTo(cx - 5, by - 29, cx, by - 36); fo(c, '#ffc23d', 1.6);
}
function paintBat(frame: number) {
  return (c: Ctx, w: number, h: number) => {
    const cx = w / 2, cy = h / 2 + 2;
    const up = frame ? -10 : 6;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * 5, cy); c.quadraticCurveTo(cx + s * 14, cy + up - 6, cx + s * 22, cy + up); c.quadraticCurveTo(cx + s * 16, cy + up + 2, cx + s * 14, cy + 4 + up * 0.3); c.quadraticCurveTo(cx + s * 10, cy + 2, cx + s * 5, cy + 4); c.closePath(); fo(c, '#5a3f78', 2.2); }
    ell(c, cx, cy + 1, 7, 7, '#5a3f78', 2.2);
    poly(c, [[cx - 6, cy - 3], [cx - 5, cy - 11], [cx - 1, cy - 5]], '#5a3f78', 1.8);
    poly(c, [[cx + 6, cy - 3], [cx + 5, cy - 11], [cx + 1, cy - 5]], '#5a3f78', 1.8);
    circ(c, cx - 2.6, cy, 1.4, '#ffe36b', 0.01); circ(c, cx + 2.6, cy, 1.4, '#ffe36b', 0.01);
  };
}
function paintGhost(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 4;
  c.beginPath(); c.moveTo(cx - 16, by - 6); c.lineTo(cx - 16, by - 30); c.arc(cx, by - 30, 16, Math.PI, 0); c.lineTo(cx + 16, by - 6);
  for (let i = 0; i < 4; i++) c.quadraticCurveTo(cx + 12 - i * 8, by + 2 * (i % 2 ? -1 : 1) + 1, cx + 8 - i * 8, by - 6);
  c.closePath(); fo(c, '#fbf7ff', 2.8);
  circ(c, cx - 6, by - 30, 2.6, INK, 0.01); circ(c, cx + 6, by - 30, 2.6, INK, 0.01);
  c.fillStyle = 'rgba(255,120,150,0.5)'; c.beginPath(); c.arc(cx - 10, by - 25, 2.6, 0, 7); c.arc(cx + 10, by - 25, 2.6, 0, 7); c.fill();
  c.beginPath(); c.ellipse(cx, by - 24, 2.6, 3, 0, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
}
/** Spooky-cute trees: a round autumn tree and a curly bare tree with a sleepy face. */
function paintSpooky(kind: number) {
  return (c: Ctx, w: number, h: number) => {
    const cx = w / 2, by = h - 8;
    const rng = mulberry32(900 + kind);
    if (kind < 2) {
      c.beginPath(); c.moveTo(cx - 12, by); c.quadraticCurveTo(cx - 8, by - 50, cx - 6, by - 80); c.lineTo(cx + 6, by - 80); c.quadraticCurveTo(cx + 8, by - 50, cx + 12, by); c.closePath(); fo(c, '#7a4a5a', 3.5);
      const cols = kind ? ['#ff8c2e', '#ffb347', '#e8604c'] : ['#c46be0', '#ff8c2e', '#ffb347'];
      const blobs: [number, number, number][] = [[cx, by - 120, 46], [cx - 36, by - 96, 32], [cx + 36, by - 96, 32], [cx - 18, by - 146, 28], [cx + 20, by - 144, 28]];
      for (const [x, y, r] of blobs) circ(c, x, y, r, cols[0], 4);
      for (const [x, y, r] of blobs) { c.fillStyle = cols[0]; c.beginPath(); c.arc(x, y, r - 2, 0, Math.PI * 2); c.fill(); }
      for (const [x, y, r] of blobs) { c.fillStyle = cols[1]; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, Math.PI * 2); c.fill(); }
      for (let i = 0; i < 14; i++) { const [x, y, r] = blobs[Math.floor(rng() * blobs.length)]; const a = rng() * 6.28, d = rng() * r * 0.8; circ(c, x + Math.cos(a) * d, y + Math.sin(a) * d, 3, cols[2], 1.4); }
    } else {
      c.lineCap = 'round';
      const branch = (x: number, y: number, a: number, len: number, wd: number, depth: number) => {
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo((x + x2) / 2 + Math.sin(a) * 10, (y + y2) / 2, x2, y2);
        c.lineWidth = wd + 4; c.strokeStyle = INK; c.stroke(); c.lineWidth = wd; c.strokeStyle = '#6a5a7a'; c.stroke();
        if (depth > 0) { branch(x2, y2, a - 0.55 + rr(rng, -0.1, 0.1), len * 0.68, wd * 0.62, depth - 1); branch(x2, y2, a + 0.5 + rr(rng, -0.1, 0.1), len * 0.66, wd * 0.6, depth - 1); }
        else { c.beginPath(); c.arc(x2 + 4, y2, 5, Math.PI, Math.PI * 2.6); c.lineWidth = 3; c.strokeStyle = '#6a5a7a'; c.stroke(); if (rng() < 0.6) circ(c, x2, y2 + 4, 4, rng() < 0.5 ? '#ff8c2e' : '#c46be0', 1.6); }
      };
      branch(cx, by, -Math.PI / 2, 70, 16, 3);
      // Sleepy face on the trunk.
      c.strokeStyle = INK; c.lineWidth = 2.2; c.beginPath(); c.arc(cx - 5, by - 34, 3, 0.2, Math.PI - 0.2); c.moveTo(cx + 8, by - 34); c.arc(cx + 5, by - 34, 3, 0.2, Math.PI - 0.2); c.stroke();
      c.beginPath(); c.ellipse(cx, by - 25, 3, 2.2, 0, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
    }
  };
}
function paintBunting(c: Ctx, w: number, h: number) {
  c.beginPath(); c.moveTo(4, 8); c.quadraticCurveTo(w / 2, 26, w - 4, 8); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  const cols = ['#ff7fa8', '#ffd84d', '#7fd0ff', '#7cc463', '#b48cff'];
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9, x = 4 + t * (w - 8), y = 8 + Math.sin(t * Math.PI) * 16;
    poly(c, [[x - 7, y], [x + 7, y], [x, y + 16]], cols[i % 5], 2);
  }
}
function paintCart(c: Ctx, w: number, h: number) {
  const cx = w / 2, by = h - 6;
  groundShadow(c, cx, by + 2, 52);
  rect(c, cx - 50, by - 50, 100, 34, 6, '#c98f5a');
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(cx - 56 + i * 24, by - 86); c.lineTo(cx - 32 + i * 24, by - 86); c.lineTo(cx - 32 + i * 24, by - 74); c.quadraticCurveTo(cx - 44 + i * 24, by - 66, cx - 56 + i * 24, by - 74); c.closePath(); fo(c, i % 2 ? '#fff' : '#b48cff', 2); }
  for (const dx of [-46, 44]) rect(c, cx + dx, by - 86, 5, 38, 2, '#8a5a3c', 2);
  // Goods.
  circ(c, cx - 28, by - 56, 8, '#ff5a4f', 2.2); circ(c, cx - 12, by - 58, 9, '#ffd84d', 2.2); ell(c, cx + 10, by - 56, 11, 7, '#a9b4bf', 2.2); c.beginPath(); c.roundRect(cx + 22, by - 62, 22, 10, 5); fo(c, '#c98f5a', 2.2);
  circ(c, cx - 30, by - 12, 12, '#8a5a3c', 3); circ(c, cx - 30, by - 12, 4, '#e2b27a', 1.5);
  circ(c, cx + 30, by - 12, 12, '#8a5a3c', 3); circ(c, cx + 30, by - 12, 4, '#e2b27a', 1.5);
}
function paintDrop(c: Ctx) { c.fillStyle = 'rgba(200,225,255,0.9)'; c.beginPath(); c.roundRect(1, 0, 2, 12, 1); c.fill(); }
function paintLeafO(c: Ctx) { c.beginPath(); c.ellipse(6, 4, 5.5, 3, 0.4, 0, Math.PI * 2); c.fillStyle = '#ff9a3c'; c.fill(); c.strokeStyle = 'rgba(80,40,30,0.6)'; c.lineWidth = 0.8; c.stroke(); }
function paintSkyGrad(c: Ctx, w: number, h: number) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6a4ab0'); g.addColorStop(0.55, '#b07ab8'); g.addColorStop(1, '#ff9a5c');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}

export const BUILD_FRAMES = ['b_home', 'b_garden', 'b_garden0', 'b_kitchen', 'b_workshop', 'b_fishhut', 'd_flowerbed', 'd_lamp', 'd_well', 'd_bench', 'd_statue'];

export function paintVillageArt(scene: Phaser.Scene) {
  atlasTarget(ATLAS2);
  const B = 2.4;
  const T = (key: string, w: number, h: number, fn: (c: Ctx, w: number, h: number) => void, sc: number) => canvasTex(scene, key, w, h, (c) => fn(c, w, h), sc);
  T('b_home', 150, 140, (c, w, h) => paintHome(c, w, h), B);
  T('b_kitchen', 150, 140, (c, w, h) => paintKitchen(c, w, h), B);
  T('b_workshop', 150, 116, (c, w, h) => paintWorkshop(c, w, h), B);
  T('b_fishhut', 150, 140, (c, w, h) => paintFishHut(c, w, h), B);
  T('b_garden', 150, 96, (c, w, h) => paintGarden(c, w, h, 1), B);
  T('b_garden0', 150, 96, (c, w, h) => paintGarden(c, w, h, 0), B);
  T('d_flowerbed', 80, 50, (c, w, h) => paintFlowerbed(c, w, h), B);
  T('d_lamp', 40, 110, (c, w, h) => paintLamp(c, w, h), B);
  T('d_well', 80, 104, (c, w, h) => paintWell(c, w, h), B);
  T('d_bench', 80, 62, (c, w, h) => paintBench(c, w, h), B);
  T('d_statue', 80, 92, (c, w, h) => paintStatue(c, w, h), B);
  T('v_sign', 90, 76, (c, w, h) => paintSign(c, w, h), B);
  T('v_cart', 120, 96, (c, w, h) => paintCart(c, w, h), B);
  KINDS.forEach((k, i) => { for (let f = 0; f < 2; f++) T(`vil${i}_${f}`, 44, 76, paintVillager(k, f), 3); });
  for (const [k, fn] of Object.entries(ICONS)) canvasTex(scene, k, 48, 48, icon(fn), 2.5);
  T('h_pumpkin', 46, 40, paintPumpkin(false), 2.5);
  T('h_jack', 46, 40, paintPumpkin(true), 2.5);
  T('h_candle', 24, 40, paintCandle, 2.5);
  T('h_bat0', 48, 30, paintBat(0), 2.5);
  T('h_bat1', 48, 30, paintBat(1), 2.5);
  T('h_ghost', 40, 54, paintGhost, 2.5);
  for (let i = 0; i < 3; i++) T(`h_tree${i}`, 160, 200, paintSpooky(i), 2);
  T('f_bunting', 200, 40, paintBunting, 2);
  T('p_drop', 4, 12, paintDrop, 2);
  T('p_leafo', 12, 8, paintLeafO, 3);
  T('sky_halloween', 8, 64, (c, w, h) => paintSkyGrad(c, w, h), 2);
  paintSeqArt(scene);
  buildAtlas(scene, ATLAS2);
  atlasTarget(ATLAS);
}
