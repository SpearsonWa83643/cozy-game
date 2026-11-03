// 40 (Walker, Oct 29): the Mount Thief. A button calls a masked thief (a random animal each time).
// Tap it 3 times before it gets away to arrest it. If it escapes, it grabs one of your flying
// friends and hides it behind a random puzzle, which gets mixed up again (even if you'd solved it).
// Solve that puzzle and open its cell to rescue your friend. 51-53 (Walker, Nov 2): you see it carry
// your friend away, the friend waits in a friendly little cell at the puzzle, and sometimes it takes 2-3. Kid-friendly: no scary bits, big
// slow target, and the friend is never lost for good.
import Phaser from 'phaser';
import { Ctx, canvasTex, atlasOf, frameScale } from './art';
import { save, persist, addFruit, jailAdd, jailOut, type Stolen } from './save';
import { looks } from './looks/looks';
import { padOf, setStyled } from './looks/styleFx';
import { MOUNTS, isMountUnlocked, themeDefaultMount, mountById, type MountDef } from './mount/defs';
import { sfx } from './audio';
import type { WorldScene } from './scenes/World';
import { DPR } from './dpr';
import { showClue, clueLine, PLACE } from './clueCard';
import { nickOf } from './jail';

export type Kind = {
  id: string; name: string; fur: string; dark: string; belly: string;
  ear: 'round' | 'point' | 'long' | 'big' | 'tuft' | 'tiny' | 'none';
  tail: 'ring' | 'bush' | 'puff' | 'thin' | 'curl' | 'big' | 'otter' | 'stripe' | 'duck' | 'none';
  /** 56: extra looks. */
  spines?: string; stripe?: string; face?: string; nose?: string; beak?: boolean; legs?: string; mask?: string;
  /** 56: its own giggle lines and voice (giggle pitch in Hz). */
  giggles?: string[]; voice?: number;
};
export const THIEVES: Kind[] = [
  { id: 'raccoon', name: 'Raccoon', fur: '#8f939c', dark: '#4a4d55', belly: '#d9dbe0', ear: 'round', tail: 'ring', voice: 620 },
  { id: 'fox', name: 'Fox', fur: '#e07a32', dark: '#7a3a18', belly: '#fff3e0', ear: 'point', tail: 'bush', voice: 700 },
  { id: 'bunny', name: 'Bunny', fur: '#d8c0a0', dark: '#8a6a4c', belly: '#fff6ea', ear: 'long', tail: 'puff', voice: 880 },
  { id: 'mouse', name: 'Mouse', fur: '#b5a79e', dark: '#6a5c55', belly: '#efe6df', ear: 'big', tail: 'thin', voice: 1180 },
  { id: 'cat', name: 'Kitty', fur: '#5d5966', dark: '#2e2b35', belly: '#f2f0f5', ear: 'point', tail: 'curl', voice: 760 },
  { id: 'pig', name: 'Piglet', fur: '#f2a7b5', dark: '#b8606f', belly: '#ffd8df', ear: 'point', tail: 'curl', voice: 520 },
  // 56 (Walker, Nov 2): more sneaky friends, each with its own look, mask color and giggles.
  { id: 'squirrel', name: 'Squirrel', fur: '#c4703a', dark: '#6e3a1c', belly: '#ffe8cc', ear: 'tuft', tail: 'big', mask: '#3a2a6e', voice: 1040,
    giggles: ['Nutty nut nut!', 'Acorn party!', 'Zoom zoom!', 'Chitter chatter!'] },
  { id: 'hedgehog', name: 'Hedgehog', fur: '#c9a27a', dark: '#5a4030', belly: '#f6e3c8', ear: 'tiny', tail: 'none', spines: '#7a5a40', nose: '#2b2028', mask: '#1f4f3a', voice: 900,
    giggles: ['Prickle tickle!', 'Snuffle snuff!', 'Roll away!', 'Hee hee, pointy!'] },
  { id: 'otter', name: 'Otter', fur: '#8a5a3a', dark: '#4e301c', belly: '#f0d9b5', ear: 'tiny', tail: 'otter', mask: '#1d3f66', voice: 820,
    giggles: ['Splishy splash!', 'Wheee, slide!', 'Bubble bubble!', 'Otterly sneaky!'] },
  { id: 'skunk', name: 'Skunk', fur: '#34303c', dark: '#1d1a22', belly: '#f7f3ea', ear: 'round', tail: 'stripe', stripe: '#fffaf0', mask: '#6a2a5a', voice: 680,
    giggles: ['Pee-yew? Nope, flowers!', 'Sniff sniff!', 'Stripy and speedy!', 'Tee hee!'] },
  { id: 'possum', name: 'Possum', fur: '#a9a6ad', dark: '#5a5660', belly: '#f2eff2', ear: 'round', tail: 'curl', face: '#f7f3ea', nose: '#f29aa8', mask: '#5a3a1a', voice: 740,
    giggles: ['Playing pretend!', 'Hang on tight!', 'Hiss-giggle!', 'Upside down fun!'] },
  { id: 'badger', name: 'Badger', fur: '#7d7a80', dark: '#2a272e', belly: '#e6e3e8', ear: 'tiny', tail: 'puff', stripe: '#fffaf0', mask: '#7a2020', voice: 480,
    giggles: ['Dig dig dig!', 'Grumble giggle!', 'Badger dash!', 'Ho ho!'] },
  { id: 'duckling', name: 'Duckling', fur: '#ffd84d', dark: '#d9a21a', belly: '#fff3b0', ear: 'none', tail: 'duck', beak: true, legs: '#f28c28', mask: '#2a3f7a', voice: 1300,
    giggles: ['Quack quack!', 'Waddle waddle!', 'Peep peep!', 'Splash dash!'] },
];
/** 56: every thief's own giggles (the first six share the classic lines). */
export const gigglesOf = (k: Kind) => k.giggles ?? ['Hee hee!', 'Nope!', 'Too slow!', 'Catch me!', 'Whoopsie!'];
export const thiefById = (id: string) => THIEVES.find((k) => k.id === id);

/** Puzzles a friend can be hidden behind, with a kid-readable place name. */
export const HIDES: Record<string, string> = {
  pots: 'the flower pots', bells: 'the singing bells', tiles: 'the turning tiles',
  dig: 'the digging spot', stones: 'the stepping stones', trail: 'the deer tracks',
};

// 60: headroom on top (the Bunny's long ears, the Squirrel's tufts) and a little room on each side (the Skunk's
// big tail, whiskers) so no thief is ever cut off. The side pads are equal, so the sprite stays centred.
const SIDE = 6, TW = 64 + SIDE * 2, TOP = 12, TH = 58 + TOP;
function paintThief(c: Ctx, k: Kind) {
  c.translate(SIDE, TOP);
  const line = '#3b2a22';
  c.lineWidth = 2;
  // Tail (behind, on the left).
  c.strokeStyle = line;
  if (k.tail === 'ring' || k.tail === 'bush') {
    c.fillStyle = k.fur; c.beginPath(); c.ellipse(11, 30, 10, 6, -0.6, 0, Math.PI * 2); c.fill(); c.stroke();
    if (k.tail === 'ring') { c.fillStyle = k.dark; for (const t of [0.35, 0.65]) { c.beginPath(); c.ellipse(11 + (t - 0.5) * 14, 30 - (t - 0.5) * -10, 2.4, 6, -0.6, 0, Math.PI * 2); c.fill(); } }
    else { c.fillStyle = '#fffaf0'; c.beginPath(); c.ellipse(4, 25, 4, 3.4, -0.6, 0, Math.PI * 2); c.fill(); }
  } else if (k.tail === 'puff') { c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(13, 36, 5, 0, Math.PI * 2); c.fill(); c.stroke(); }
  else if (k.tail === 'big') {
    // A big fluffy tail curling up over its back.
    c.fillStyle = k.fur; c.beginPath(); c.moveTo(18, 40); c.bezierCurveTo(-2, 40, -2, 6, 14, 4); c.bezierCurveTo(24, 3, 26, 14, 18, 16); c.bezierCurveTo(10, 18, 12, 32, 22, 34); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = k.belly; c.beginPath(); c.ellipse(9, 14, 3, 6, -0.3, 0, Math.PI * 2); c.fill();
  } else if (k.tail === 'otter') {
    c.fillStyle = k.fur; c.beginPath(); c.moveTo(16, 33); c.quadraticCurveTo(2, 38, 1, 46); c.quadraticCurveTo(8, 44, 18, 41); c.closePath(); c.fill(); c.stroke();
  } else if (k.tail === 'stripe') {
    c.fillStyle = k.fur; c.beginPath(); c.ellipse(10, 22, 9, 15, -0.35, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = k.stripe ?? '#fff'; c.beginPath(); c.ellipse(10, 21, 3, 12, -0.35, 0, Math.PI * 2); c.fill();
  } else if (k.tail === 'duck') {
    c.fillStyle = k.fur; c.beginPath(); c.moveTo(16, 32); c.lineTo(6, 26); c.lineTo(10, 36); c.closePath(); c.fill(); c.stroke();
  } else if (k.tail === 'none') { /* no tail */ }
  else { c.strokeStyle = k.dark; c.lineWidth = 2.4; c.beginPath(); c.moveTo(16, 38); c.bezierCurveTo(6, 40, 4, 28, 10, 27); if (k.tail === 'curl') c.arc(10, 30, 3, -Math.PI / 2, Math.PI); c.stroke(); c.lineWidth = 2; c.strokeStyle = line; }
  // Legs.
  c.fillStyle = k.legs ?? k.dark;
  if (k.beak) for (const x of [24, 36]) { c.beginPath(); c.roundRect(x - 2, 42, 4, 8, 2); c.fill(); c.beginPath(); c.ellipse(x + 2, 50.5, 5, 2.4, 0, 0, Math.PI * 2); c.fill(); }
  else for (const x of [18, 25, 34, 41]) { c.beginPath(); c.roundRect(x - 2.6, 42, 5.2, 9, 2.4); c.fill(); }
  // Body with a striped robber shirt.
  c.save(); c.beginPath(); c.ellipse(30, 36, 16, 11, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#f7f3ea'; c.fillRect(10, 22, 40, 30);
  c.fillStyle = '#2c2a33'; for (let y = 27; y < 50; y += 6) c.fillRect(10, y, 40, 3);
  c.restore();
  c.strokeStyle = line; c.beginPath(); c.ellipse(30, 36, 16, 11, 0, 0, Math.PI * 2); c.stroke();
  // 56: hedgehog spines (soft, rounded points) over its back, on top of the shirt.
  if (k.spines) {
    c.fillStyle = k.spines; c.strokeStyle = line; c.beginPath(); c.moveTo(13, 36);
    for (let i = 0; i <= 12; i++) { const a = Math.PI * 1.02 + i * Math.PI * 0.62 / 12; const r = i % 2 ? 13 : 19; c.lineTo(30 + Math.cos(a) * r * 1.1, 37 + Math.sin(a) * r * 1.05); }
    c.lineTo(36, 30); c.quadraticCurveTo(24, 26, 13, 36); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#f6e3c8'; for (const [x, y] of [[20, 24], [28, 21], [24, 29]]) { c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill(); }
  }
  // Ears.
  c.fillStyle = k.fur;
  const ear = (x: number) => {
    c.beginPath();
    if (k.ear === 'round') c.arc(x, 11, 4.5, 0, Math.PI * 2);
    else if (k.ear === 'big') c.arc(x, 10, 6.5, 0, Math.PI * 2);
    else if (k.ear === 'tiny') c.arc(x, 13, 3.2, 0, Math.PI * 2);
    else if (k.ear === 'none') return;
    else if (k.ear === 'tuft') { c.moveTo(x - 5, 16); c.lineTo(x - 1, 3); c.lineTo(x + 1, 0); c.lineTo(x + 2, 4); c.lineTo(x + 4, 15); c.closePath(); }
    else if (k.ear === 'long') c.ellipse(x, 5, 3.6, 9, (x - 46) * 0.04, 0, Math.PI * 2);
    else { c.moveTo(x - 5, 16); c.lineTo(x - 1, 4); c.lineTo(x + 4, 15); c.closePath(); }
    c.fill(); c.stroke();
  };
  ear(40); ear(51);
  // Head.
  c.fillStyle = k.fur; c.beginPath(); c.arc(46, 22, 11, 0, Math.PI * 2); c.fill(); c.stroke();
  if (k.face) { c.fillStyle = k.face; c.beginPath(); c.ellipse(50, 24, 8, 7, 0, 0, Math.PI * 2); c.fill(); }
  if (k.stripe && k.tail !== 'stripe') { c.fillStyle = k.stripe; c.beginPath(); c.ellipse(45, 15, 3, 7, -0.5, 0, Math.PI * 2); c.fill(); }
  if (k.tail === 'stripe' && k.stripe) { c.fillStyle = k.stripe; c.beginPath(); c.ellipse(42, 13, 2.4, 5, -0.8, 0, Math.PI * 2); c.fill(); }
  if (k.beak) {
    // A round orange duck bill.
    c.fillStyle = '#f28c28'; c.beginPath(); c.ellipse(57, 26, 6, 3.2, 0.1, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#b8601a'; c.lineWidth = 1; c.beginPath(); c.moveTo(52, 26.4); c.lineTo(62, 26.4); c.stroke(); c.strokeStyle = line; c.lineWidth = 2;
    // A fluffy head tuft.
    c.fillStyle = k.fur; c.beginPath(); c.ellipse(45, 11, 2, 4, -0.3, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(48, 11, 1.6, 3.4, 0.3, 0, Math.PI * 2); c.fill();
  } else {
    c.fillStyle = k.belly; c.beginPath(); c.ellipse(53, 26, 6, 4.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = k.nose ?? (k.id === 'pig' ? '#e07f92' : '#2b2028'); c.beginPath(); c.ellipse(58, 25, k.id === 'pig' ? 3.2 : 2.2, k.id === 'pig' ? 2.6 : 1.8, 0, 0, Math.PI * 2); c.fill();
    if (k.id === 'otter' || k.id === 'cat') { c.strokeStyle = k.dark; c.lineWidth = 0.9; for (const dy of [-1.5, 1.5]) { c.beginPath(); c.moveTo(56, 27 + dy); c.lineTo(63, 26 + dy * 2); c.stroke(); } c.strokeStyle = line; c.lineWidth = 2; }
  }
  // The robber mask: a band (black, or the thief's own color) with two eye holes.
  c.fillStyle = k.mask ?? '#1d1a22'; c.beginPath(); c.roundRect(36, 15.5, 22, 7.5, 3.6); c.fill();
  c.beginPath(); c.moveTo(37, 18); c.lineTo(31, 15); c.lineTo(32, 21); c.closePath(); c.fill();
  c.fillStyle = '#fffaf0'; for (const x of [44, 52]) { c.beginPath(); c.ellipse(x, 19.2, 2.6, 2.2, 0, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#1d1a22'; for (const x of [45, 53]) { c.beginPath(); c.arc(x, 19.4, 1.2, 0, Math.PI * 2); c.fill(); }
  // A cheeky smile (ducklings smile with their bill).
  if (!k.beak) { c.strokeStyle = line; c.lineWidth = 1.4; c.beginPath(); c.arc(53, 28, 3, 0.2, Math.PI - 0.6); c.stroke(); }
}
function paintSack(c: Ctx) {
  c.strokeStyle = '#4a321f'; c.lineWidth = 2;
  c.fillStyle = '#b98a55'; c.beginPath(); c.moveTo(10, 8); c.bezierCurveTo(-2, 14, 0, 30, 14, 30); c.bezierCurveTo(28, 30, 30, 14, 18, 8); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#d8a96c'; c.beginPath(); c.ellipse(14, 7, 6, 3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = '#7a4f2c'; c.beginPath(); c.moveTo(8, 11); c.lineTo(20, 11); c.stroke();
  c.fillStyle = '#ffd34d'; c.strokeStyle = '#a5741d'; c.lineWidth = 1.2;
  c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.2 : 5, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(14 + Math.cos(a) * r, 20 + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
}
function paintCage(c: Ctx) {
  c.strokeStyle = '#6b4a33'; c.lineWidth = 3;
  c.fillStyle = 'rgba(255,240,200,0.18)'; c.beginPath(); c.roundRect(3, 8, 74, 62, 8); c.fill();
  c.fillStyle = '#c99a4e'; c.beginPath(); c.roundRect(1, 64, 78, 8, 3); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(4, 4, 72, 8, 4); c.fill(); c.stroke();
  c.strokeStyle = '#8a6a4c'; c.lineWidth = 3.4;
  for (let x = 10; x <= 70; x += 12) { c.beginPath(); c.moveTo(x, 12); c.lineTo(x, 64); c.stroke(); }
  c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(40, 2.5, 4, 0, Math.PI * 2); c.fill();
}
/** 52: a friendly little cell (rounded wooden roof, bars, a gold padlock) that a stolen friend waits in. */
const CW = 96, CH = 92;
function paintCellBack(c: Ctx) {
  c.fillStyle = 'rgba(255,236,190,0.55)'; c.beginPath(); c.roundRect(8, 16, CW - 16, CH - 26, 10); c.fill();
  c.fillStyle = '#c99a4e'; c.beginPath(); c.ellipse(CW / 2, CH - 10, CW / 2 - 4, 8, 0, 0, Math.PI * 2); c.fill();
}
function paintCell(c: Ctx) {
  c.strokeStyle = '#6b4a33'; c.lineWidth = 2.4;
  // Floor rim and arched roof.
  c.fillStyle = '#d8aa5e'; c.beginPath(); c.roundRect(3, CH - 14, CW - 6, 10, 4); c.fill(); c.stroke();
  c.fillStyle = '#e86a5a'; c.beginPath(); c.moveTo(4, 20); c.quadraticCurveTo(CW / 2, -6, CW - 4, 20); c.lineTo(CW - 4, 24); c.lineTo(4, 24); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#fff3e0'; for (let x = 16; x < CW - 10; x += 16) { c.beginPath(); c.arc(x, 21, 2.4, 0, Math.PI * 2); c.fill(); }
  // Bars (rounded, warm wood, not scary metal).
  for (let x = 12; x <= CW - 12; x += 12) {
    c.strokeStyle = '#6b4a33'; c.lineWidth = 5; c.beginPath(); c.moveTo(x, 24); c.lineTo(x, CH - 13); c.stroke();
    c.strokeStyle = '#c99a4e'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 24); c.lineTo(x, CH - 13); c.stroke();
  }
  // A big gold padlock with a heart keyhole.
  const px = CW / 2, py = CH * 0.6;
  c.strokeStyle = '#a5741d'; c.lineWidth = 3; c.beginPath(); c.arc(px, py - 6, 6, Math.PI, 0); c.stroke();
  c.fillStyle = '#ffd34d'; c.beginPath(); c.roundRect(px - 10, py - 6, 20, 16, 4); c.fill(); c.lineWidth = 1.6; c.stroke();
  c.fillStyle = '#e0587a'; c.beginPath(); c.moveTo(px, py + 6); c.bezierCurveTo(px - 6, py + 1, px - 3, py - 3, px, py); c.bezierCurveTo(px + 3, py - 3, px + 6, py + 1, px, py + 6); c.fill();
  // A twinkle on the roof.
  c.fillStyle = '#ffe9a8'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2 : 5, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(CW / 2 + Math.cos(a) * r, 8 + Math.sin(a) * r); } c.closePath(); c.fill();
}
function paintMask(c: Ctx) {
  c.fillStyle = '#1d1a22'; c.beginPath(); c.roundRect(2, 6, 36, 14, 7); c.fill();
  c.fillStyle = '#fffaf0'; for (const x of [12, 28]) { c.beginPath(); c.ellipse(x, 13, 4.6, 3.6, 0, 0, Math.PI * 2); c.fill(); }
}
/** 60 (test): paint each thief on a roomy canvas and count the inked pixels that fall outside its TW x TH texture
 *  (that is, what would be cut off). Every thief should be 0. Also reports the topmost inked row inside the texture. */
export function thiefFit() {
  const M = 24, out: Record<string, { clipped: number; top: number }> = {};
  for (const k of THIEVES) {
    const cv = document.createElement('canvas'); cv.width = TW + M * 2; cv.height = TH + M * 2;
    const c = cv.getContext('2d')!; c.lineCap = 'round'; c.lineJoin = 'round'; c.translate(M, M); paintThief(c, k);
    const px = c.getImageData(0, 0, cv.width, cv.height).data;
    let clipped = 0, top = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      if (px[(y * cv.width + x) * 4 + 3] < 24) continue;
      const inside = x >= M && x < M + TW && y >= M && y < M + TH;
      if (!inside) clipped++; else if (top < 0) top = y - M;
    }
    out[k.id] = { clipped, top };
  }
  return out;
}
export function paintThieves(scene: Phaser.Scene) {
  for (const k of THIEVES) canvasTex(scene, `thief_${k.id}`, TW, TH, (c) => paintThief(c, k));
  canvasTex(scene, 'thief_sack', 28, 32, paintSack);
  canvasTex(scene, 'thief_cage', 80, 74, paintCage);
  canvasTex(scene, 'thief_mask', 40, 26, paintMask);
  canvasTex(scene, 'thief_cell_back', CW, CH, paintCellBack);
  canvasTex(scene, 'thief_cell', CW, CH, paintCell);
  // 43: a little paw print for the escape trail.
  canvasTex(scene, 'thief_paw', 20, 20, (c) => {
    c.fillStyle = 'rgba(74,50,31,0.75)';
    c.beginPath(); c.ellipse(10, 13, 5, 4.2, 0, 0, Math.PI * 2); c.fill();
    for (const [x, y] of [[4, 6], [8, 3.5], [12, 3.5], [16, 6]]) { c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
  });
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const TAPS = 3;
const SCALE = 2.3;
/** 53: odds the thief takes more than one friend (only when that many can be taken). */
export const MULTI_ODDS = { three: 0.05, two: 0.2 };

const nameOf = (id: string) => mountById(id)?.name ?? 'friend';
const andList = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
/** 51-53: one kid-readable line naming every hidden friend and where it is. */
export function stolenHint(list: Stolen[] = save.stolen ?? []): string {
  if (!list.length) return '';
  // 57: very simple words (early readers).
  if (list.length === 1) return `Help your ${nameOf(list[0].mount)} first! It is at ${PLACE[list[0].puzzle]}.`;
  return `Help your friends first! ${list.map((s) => `The ${nameOf(s.mount)} is at ${PLACE[s.puzzle]}.`).join(' ')}`;
}
/** A body image of a friend in the applied art style (59), sized to `w` world px wide. Origin via setOrg. */
function friendImg(scene: Phaser.Scene, m: MountDef, x: number, y: number, w: number, ox = 0.5, oy = 0.5) {
  const im = setStyled(scene.add.image(x, y, atlasOf(m.body), m.body), scene, m.body, looks.art, ox, oy);
  const pad = padOf[im.texture.key] ?? 0;
  return im.setScale(w / Math.max(1, im.width - pad * 2));
}

/** 55: jailbreaks. After JAILBREAK.firstS seconds of play, and then every JAILBREAK.everyS, roll JAILBREAK.odds;
 *  at most one jailbreak per play session, and only when no thief is about (and none of your friends are hidden).
 *  The escaped thief sneaks back as a normal thief event JAILBREAK.backS seconds later. */
export const JAILBREAK = { firstS: 240, everyS: 240, odds: 0.3, backS: [60, 120] as [number, number] };

export class Thief {
  /** 55: jailbreak state for this play session (tests read it via __cozy.jailbreakInfo). */
  jb = { played: 0, nextCheck: JAILBREAK.firstS, broke: false, kind: '', how: '' as '' | 'tunnel' | 'lock', backAt: -1, checks: 0, returned: 0 };

  state: 'off' | 'sneak' | 'caught' | 'flee' = 'off';
  kind: Kind = THIEVES[0];
  taps = 0;
  spr: Phaser.GameObjects.Image | null = null;
  sack: Phaser.GameObjects.Image | null = null;
  /** 51: friends being carried off on the thief's back (as it runs away). */
  carry: Phaser.GameObjects.Image[] = [];
  carryIds: string[] = [];
  /** 52: one cell per hidden friend, keyed by puzzle id. */
  cells = new Map<string, { c: Phaser.GameObjects.Container; it: { enabled: () => boolean } }>();
  /** 53: forced count for the next escape (tests); 0 = roll the odds. */
  forceCount = 0;
  lastCallHint = '';
  pips: Phaser.GameObjects.Graphics | null = null;
  to = { x: 0, y: 0 };
  speed = 170;
  endAt = 0;
  last = '';
  caughtN = 0; stolenN = 0; rescuedN = 0;
  /** 41: berries the last caught thief left as a thank-you. */
  thanks = 0;
  /** 43: paw prints left on the escape trail (tests). */
  paws = 0;
  /** 46: cheeky giggles when tapped but not caught yet (tests). */
  giggles = 0;
  lastGiggle = '';
  private pawAt: { x: number; y: number } | null = null;
  private pawSide = 1;
  private entering = false;
  private hop: Phaser.Tweens.Tween | null = null;

  constructor(private w: WorldScene) {
    w.game.events.on('puzzle-chest', this.onChest, this);
    w.events.once('shutdown', () => w.game.events.off('puzzle-chest', this.onChest, this));
    this.placeMarker();
  }

  /** Friends the thief could take: unlocked, not the theme's own default (you always keep a ride). */
  stealable() {
    const def = themeDefaultMount();
    return MOUNTS.filter((m) => m.id !== def && isMountUnlocked(m));
  }
  /** Why the button can't start a thief right now (or null when it can). */
  blocked(): string | null {
    const w = this.w;
    if (this.state !== 'off') return 'busy';
    if (save.stolen?.length) return stolenHint();
    if (w.mount?.carrying || w.fishing?.active || w.boat?.active || w.village?.building || w.locked || w.registry.get('dialogOpen') || w.registry.get('menuOpen')) return 'Hop off and get comfy first, then try again!';
    if (!this.stealable().length) return 'No sneaky thieves yet. Find a flying friend first!';
    return null;
  }

  start(kindId?: string, ms = 12000, count = 0) {
    this.forceCount = count;
    const why = this.blocked();
    if (why) {
      // 57: with friends hidden, the clue opens big and centered (no timeout) instead of a toast.
      if (save.stolen?.length) showClue(save.stolen, { title: save.stolen.length === 1 ? 'Help your friend first!' : 'Help your friends first!' });
      else if (why !== 'busy') this.w.game.events.emit('toast', why);
      return false;
    }
    const w = this.w;
    const pool = THIEVES.filter((k) => k.id !== this.last);
    // 55: an escaped jailbird is the next one to come sneaking back.
    const loose = THIEVES.find((k) => save.jail?.[k.id]?.out);
    this.kind = THIEVES.find((k) => k.id === kindId) ?? loose ?? pool[Math.floor(Math.random() * pool.length)];
    const back = !!save.jail?.[this.kind.id]?.out;
    this.last = this.kind.id;
    this.taps = 0;
    const v = w.cameras.main.worldView;
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? v.x - 40 : v.right + 40;
    const y = v.y + v.height * (0.45 + Math.random() * 0.3);
    const key = `thief_${this.kind.id}`;
    this.spr = w.add.image(x, y, atlasOf(key), key).setOrigin(0.5, 0.92).setScale(SCALE / (frameScale[key] ?? 1)).setDepth(y + 8000);
    this.sack = w.add.image(x, y, atlasOf('thief_sack'), 'thief_sack').setOrigin(0.5, 0.9).setScale(1.4 / (frameScale.thief_sack ?? 1)).setDepth(y + 7999);
    this.pips = w.add.graphics().setDepth(9500);
    this.state = 'sneak';
    // It dashes in from the edge, then slows down to sneak (so it doesn't linger under the buttons).
    this.speed = 380; this.entering = true;
    this.endAt = w.time.now + ms;
    this.pickSpot();
    this.startHop();
    sfx.whistle?.();
    w.game.events.emit('toast', back ? `${nickOf(this.kind.id)} the ${this.kind.name} is sneaking back! Tap it ${TAPS} times to catch it!` : `A sneaky ${this.kind.name}! Tap it ${TAPS} times to catch it!`);
    if (back && this.jb.kind === this.kind.id) { this.jb.backAt = -1; this.jb.returned++; }
    w.game.events.emit('thief', 'start');
    return true;
  }

  private startHop() {
    if (!this.spr || reduceMotion()) return;
    this.hop?.stop();
    this.hop = this.w.tweens.add({ targets: this.spr, scaleY: { from: this.spr.scaleY * 0.92, to: this.spr.scaleY }, duration: 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private pickSpot() {
    const v = this.w.cameras.main.worldView;
    // Keep clear of the HUD buttons on the sides and top so taps land on the thief.
    const mx = v.width * 0.2, my = v.height * 0.24;
    let tx = 0, ty = 0;
    for (let i = 0; i < 6; i++) {
      tx = v.x + mx + Math.random() * (v.width - 2 * mx);
      ty = v.y + my + Math.random() * (v.height - 1.6 * my);
      if (!this.spr || Math.hypot(tx - this.spr.x, ty - this.spr.y) > v.width * 0.25) break;
    }
    this.to = { x: tx, y: ty };
  }

  /** World taps land here first. True when the tap hit the thief. */
  onTap(wx: number, wy: number) {
    if (this.state !== 'sneak' || !this.spr) return false;
    const s = this.spr;
    const cy = s.y - 26 * SCALE * 0.5;
    if (Math.hypot(wx - s.x, wy - cy) > 34 * SCALE + 12) return false;
    this.taps++;
    const w = this.w;
    w.burst(s.x, cy, 0xffe08a, 12, 'spark');
    sfx.ting?.();
    if (!reduceMotion()) w.tweens.add({ targets: s, y: s.y - 26, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
    if (this.taps >= TAPS) { this.arrest(); return true; }
    this.speed = 170 + 40 * this.taps; this.entering = false;
    // 46: a cheeky giggle bubble as it scampers away.
    this.giggles++;
    const gl = gigglesOf(this.kind);
    this.lastGiggle = gl[(this.giggles - 1) % gl.length];
    w.floatText(s.x, cy - 46, this.lastGiggle, '#ffe9a8');
    sfx.giggle?.(this.kind.voice ?? 700);
    this.pickSpot();
    w.game.events.emit('toast', this.taps === 1 ? 'Got it once! Again!' : 'One more tap!');
    return true;
  }

  private arrest() {
    const w = this.w, s = this.spr!;
    this.state = 'caught';
    this.hop?.stop(); this.hop = null;
    this.caughtN++;
    save.minor.thief_caught = (save.minor.thief_caught ?? 0) + 1;
    jailAdd(this.kind.id); // 54: off to its cozy cell in the Thief Jail (persists)
    sfx.solve();
    const cage = w.add.image(s.x, s.y - 300, atlasOf('thief_cage'), 'thief_cage').setOrigin(0.5, 1).setScale(2.3 / (frameScale.thief_cage ?? 1)).setDepth(s.depth + 2);
    w.tweens.add({ targets: cage, y: s.y + 10, duration: reduceMotion() ? 1 : 420, ease: 'Bounce.easeOut', onComplete: () => { w.cameras.main.shake(140, 0.002); w.burst(s.x, s.y - 40, 0xffd27a, 26, 'spark'); } });
    this.sack?.setPosition(s.x + 50, s.y + 6);
    // 41: a thank-you snack: it says sorry and leaves you some berries (if your basket has room).
    let got = 0;
    for (let i = 0; i < 2; i++) if (addFruit('berry')) got++;
    if (got) { w.game.events.emit('snacks', save.snacks); w.burst(s.x + 40, s.y - 20, 0xd94a6a, 10, 'spark'); }
    this.thanks = got;
    w.game.events.emit('toast', (got ? `You caught the sneaky ${this.kind.name}! It says sorry and leaves you ${got === 1 ? 'a berry' : `${got} berries`}.` : `You caught the sneaky ${this.kind.name}! It says sorry and gives back the sack.`) + ' Off to the Thief Jail!');
    w.game.events.emit('thief', 'caught');
    // Driven from update() (not a timer chain) so it always finishes, even on a slow frame rate.
    this.cage = cage; this.caughtAt = performance.now(); this.fading = false;
  }

  /** 55: count play time; maybe a jailbreak; bring an escaped thief back later. */
  private jbAt = 0;
  private jailTick(_dt: number) {
    const j = this.jb;
    // Real play time (not the capped frame step), skipping long gaps like a hidden tab.
    const now = performance.now(), gap = this.jbAt ? (now - this.jbAt) / 1000 : 0;
    this.jbAt = now;
    if (gap < 1) j.played += gap;
    // An escaped thief from an earlier session sneaks back a minute or so into this one.
    if (j.backAt < 0 && !j.kind) { const loose = THIEVES.find((k) => save.jail?.[k.id]?.out); if (loose) { j.kind = loose.id; j.backAt = j.played + JAILBREAK.backS[0]; } }
    if (!j.broke && j.played >= j.nextCheck) {
      j.nextCheck = j.played + JAILBREAK.everyS;
      if (this.canBreak()) { j.checks++; if (Math.random() < JAILBREAK.odds) this.jailbreak(); }
    }
    if (j.backAt >= 0 && j.played >= j.backAt && this.state === 'off') {
      if (!save.jail?.[j.kind]?.out) { j.backAt = -1; return; }
      if (this.blocked()) { j.backAt = j.played + 10; return; }
      this.start(j.kind);
    }
  }

  private jailedIn() { return THIEVES.filter((k) => (save.jail?.[k.id]?.n ?? 0) > 0 && !save.jail?.[k.id]?.out).map((k) => k.id); }
  canBreak() { return this.state === 'off' && !this.blocked() && this.jailedIn().length > 0 && !THIEVES.some((k) => save.jail?.[k.id]?.out); }

  /** 55: a jailed thief sneaks out (a dug tunnel or a picked padlock). Once per session; never with a thief about. */
  jailbreak(kindId?: string, how?: 'tunnel' | 'lock', backS?: number) {
    const j = this.jb;
    if (j.broke || !this.canBreak()) return false;
    const ins = this.jailedIn();
    const id = kindId && ins.includes(kindId) ? kindId : ins[Math.floor(Math.random() * ins.length)];
    const h = how ?? (Math.random() < 0.5 ? 'tunnel' : 'lock');
    if (!jailOut(id, h)) return false;
    const k = thiefById(id)!;
    j.broke = true; j.kind = id; j.how = h;
    const [a, b] = JAILBREAK.backS;
    j.backAt = j.played + (backS ?? a + Math.random() * (b - a));
    sfx.giggle(k.voice ?? 700);
    const nick = nickOf(id);
    this.w.game.events.emit('toast', h === 'tunnel'
      ? `Oh no! ${nick} the ${k.name} dug a tiny tunnel out of the Thief Jail! Hee hee! Watch out, it will sneak back!`
      : `Oh no! ${nick} the ${k.name} picked the padlock with a hairpin! Hee hee! Watch out, it will sneak back!`);
    this.w.game.events.emit('thief', 'jailbreak');
    return true;
  }

  /** How many friends this thief takes: usually 1, about 20% 2, about 5% 3 (never more than can be taken). */
  rollCount(avail: number) {
    if (this.forceCount) return Math.max(1, Math.min(this.forceCount, avail, Object.keys(HIDES).length));
    const r = Math.random();
    const n = r < MULTI_ODDS.three ? 3 : r < MULTI_ODDS.three + MULTI_ODDS.two ? 2 : 1;
    return Math.max(1, Math.min(n, avail));
  }

  /** Time ran out: the thief grabs one (sometimes 2 or 3) friends and hides each behind its own puzzle. */
  private escape() {
    const w = this.w, s = this.spr!;
    const list = this.stealable();
    if (!list.length) { this.state = 'flee'; this.runOff(() => this.clear()); return; }
    const n = this.rollCount(list.length);
    const pick = [...list].sort(() => Math.random() - 0.5).slice(0, n);
    // Solved puzzles first (so it mixes one up), then other puzzles (the digging spot last).
    const shuf = <T,>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5);
    const ids = Object.keys(HIDES);
    const solved = shuf(ids.filter((id) => save.puzzles[id]));
    const rest = shuf(ids.filter((id) => !save.puzzles[id] && id !== 'dig'));
    const spots = [...solved, ...rest, ...(save.puzzles.dig ? [] : ['dig'])].slice(0, n);
    const taken: Stolen[] = pick.slice(0, spots.length).map((m, i) => ({ mount: m.id, puzzle: spots[i], kind: this.kind.id }));
    save.stolen = [...(save.stolen ?? []), ...taken];
    for (const t of taken) { delete save.puzzles[t.puzzle]; w.puzzles.resetById(t.puzzle); }
    persist();
    this.stolenN += taken.length;
    this.state = 'flee';
    this.placeMarker();
    sfx.softFail?.();
    w.burst(s.x, s.y - 40, 0xd8c8ff, 14, 'spark');
    // 51: the friends ride off on its back, held up high (cute, waving along with the hop).
    this.sack?.setVisible(false);
    this.carryIds = taken.map((t) => t.mount);
    this.carry = taken.map((t, i) => friendImg(w, mountById(t.mount)!, s.x, s.y, (taken.length === 1 ? 100 : 82) - i * 4, 0.5, 0.85));
    const kn = this.kind.name;
    const names = taken.map((t) => `${nameOf(t.mount)}`);
    const one = taken.length === 1;
    this.runOff(() => {
      this.clear();
      w.game.events.emit('dialog', one ? [
        `Oh no! The sneaky ${kn} ran off with your ${names[0]}!`,
        `It hid your friend in a little cell behind ${HIDES[taken[0].puzzle]}, and that puzzle got all mixed up again.`,
        `Solve it, then tap the cell to let the ${names[0]} out! Look for the cell with the gold padlock.`,
      ] : [
        `Oh no! The sneaky ${kn} ran off with ${taken.length} friends: the ${andList(names)}!`,
        `It hid each one in a little cell: ${andList(taken.map((t) => `the ${nameOf(t.mount)} behind ${HIDES[t.puzzle]}`))}. Those puzzles got all mixed up again.`,
        `Solve each puzzle, then tap its cell to let your friend out! Look for the cells with the gold padlocks.`,
      ]);
    });
    w.game.events.emit('toast', one ? `The ${kn} is carrying off your ${names[0]}!` : `The ${kn} is carrying off your ${andList(names)}!`);
    w.game.events.emit('thief', 'stolen');
  }

  private runOff(done: () => void) {
    const w = this.w, s = this.spr!;
    const v = w.cameras.main.worldView;
    this.to = { x: s.x < v.centerX ? v.x - 120 : v.right + 120, y: s.y };
    this.pawAt = null;
    this.speed = 420;
    // 51: a bit slower (and a bit longer) when carrying friends, so you can see them go.
    if (this.carry.length) this.speed = 300;
    // Timed off the scene clock's `now` in update (not a Clock event), so it still ends on a slow, choppy frame rate.
    this.fleeDone = done;
    this.fleeAt = w.time.now + (reduceMotion() ? 600 : this.carry.length ? 2600 : 1600);
  }
  private fleeDone: (() => void) | null = null;
  private fleeAt = 0;

  private clear() {
    this.fleeDone = null;
    this.hop?.stop(); this.hop = null;
    this.spr?.destroy(); this.sack?.destroy(); this.pips?.destroy();
    for (const c of this.carry) c.destroy();
    this.carry = []; this.carryIds = [];
    this.spr = this.sack = null; this.pips = null;
    this.state = 'off';
    this.w.game.events.emit('thief', 'off');
  }

  private cage: Phaser.GameObjects.Image | null = null;
  private caughtAt = 0;
  private fading = false;

  update(dt: number, paused: boolean) {
    if (!paused) this.jailTick(dt); else this.jbAt = 0;
    if (this.state === 'off' || !this.spr) return;
    if (paused) { if (this.state === 'sneak') this.endAt += dt * 1000; return; }
    const s = this.spr;
    if (this.state === 'caught') {
      const ct = (performance.now() - this.caughtAt) / 1000, fadeAt = 2.6;
      if (!this.fading && ct >= fadeAt) { this.fading = true; this.w.burst(s.x, s.y - 40, 0xbfe3ff, 18, 'spark'); }
      if (this.fading) {
        const a = Math.max(0, 1 - (ct - fadeAt) / 0.6);
        s.setAlpha(a); this.sack?.setAlpha(a); this.cage?.setAlpha(a);
        if (a <= 0) { this.cage?.destroy(); this.cage = null; this.clear(); return; }
      }
    }
    if (this.fleeDone && this.w.time.now >= this.fleeAt) { const d = this.fleeDone; this.fleeDone = null; d(); return; }
    if (this.state === 'sneak' && this.w.time.now > this.endAt) { this.escape(); }
    if (this.state === 'sneak' || this.state === 'flee') {
      const dx = this.to.x - s.x, dy = this.to.y - s.y, d = Math.hypot(dx, dy);
      const step = this.speed * (reduceMotion() ? 0.7 : 1) * dt;
      if (d <= step) { if (this.state === 'sneak') { if (this.entering) { this.entering = false; this.speed = 170 + 40 * this.taps; } this.pickSpot(); } }
      else { s.x += dx / d * step; s.y += dy / d * step; s.setFlipX(dx < 0); }
      s.setDepth(s.y + 8000);
      if (this.state === 'flee') this.dropPaw(s.x, s.y);
      if (this.sack) { this.sack.setPosition(s.x + (s.flipX ? 30 : -30), s.y - 4).setDepth(s.depth - 1); }
      // 51: carried friends sit up on its back, stacked a little (they bob along with each hop).
      const dir = s.flipX ? -1 : 1, bob = (s.scaleY / (SCALE / (frameScale[s.frame.name] ?? 1)) - 1) * 60;
      this.carry.forEach((c, i) => {
        c.setFlipX(s.flipX).setPosition(s.x - dir * (14 + i * 26), s.y - 66 - i * 22 + bob + (reduceMotion() ? 0 : Math.sin(this.w.time.now / 140 + i) * 2))
          .setRotation(dir * (-0.12 + i * 0.1)).setDepth(s.depth + 1 + i);
      });
    }
    // Tap pips above its head: filled ones are your taps so far, and a ring shows the time left.
    const g = this.pips!;
    g.clear();
    if (this.state === 'sneak') {
      const x = s.x, y = s.y - 66 * SCALE - 10; // 60: above the tallest ears
      const left = Math.max(0, (this.endAt - this.w.time.now) / 12000);
      g.fillStyle(0xfffaf0, 0.9); g.fillRoundedRect(x - 40, y - 13, 80, 26, 13);
      for (let i = 0; i < TAPS; i++) {
        g.fillStyle(i < this.taps ? 0xf2c14e : 0xd9cbb5, 1); g.fillCircle(x - 22 + i * 22, y, 8);
        g.lineStyle(2, 0x6b4a33, 1); g.strokeCircle(x - 22 + i * 22, y, 8);
      }
      g.lineStyle(4, 0xe85d3a, 0.9); g.beginPath(); g.arc(x, y + 22, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, left)); g.strokePath();
    }
  }

  /** 43: fading paw prints behind an escaping thief (alternating left/right). */
  private dropPaw(x: number, y: number) {
    if (this.pawAt && Math.hypot(x - this.pawAt.x, y - this.pawAt.y) < 46) return;
    this.pawAt = { x, y };
    this.pawSide = -this.pawSide;
    const w = this.w;
    const p = w.add.image(x, y - 4 + this.pawSide * 9, atlasOf('thief_paw'), 'thief_paw').setScale(1.5 / (frameScale.thief_paw ?? 1)).setDepth(y - 30)
      .setRotation(this.spr?.flipX ? -Math.PI / 2 : Math.PI / 2);
    this.paws++;
    w.tweens.add({ targets: p, alpha: 0, delay: reduceMotion() ? 1500 : 2200, duration: 1200, onComplete: () => p.destroy() });
  }

  /** 52: each hidden friend waits in a little cell next to its puzzle's chest. */
  placeMarker() {
    for (const pid of [...this.cells.keys()]) this.dropCell(pid);
    for (const st of save.stolen ?? []) this.makeCell(st);
  }
  private makeCell(st: Stolen) {
    const w = this.w;
    const ch = w.puzzles.chestById(st.puzzle);
    const m = mountById(st.mount);
    if (!ch || !m || this.cells.has(st.puzzle)) return;
    const k = 1.25;
    const back = w.add.image(0, 0, atlasOf('thief_cell_back'), 'thief_cell_back').setOrigin(0.5, 1).setScale(k / (frameScale.thief_cell_back ?? 1));
    const pet = friendImg(w, m, 0, -14, CW * k * 0.78, 0.5, 1);
    const bars = w.add.image(0, 0, atlasOf('thief_cell'), 'thief_cell').setOrigin(0.5, 1).setScale(k / (frameScale.thief_cell ?? 1));
    const mask = w.add.image(0, -CH * k - 12, atlasOf('thief_mask'), 'thief_mask').setScale(0.8 / (frameScale.thief_mask ?? 1));
    const x = ch.x + 78, y = ch.y + 6;
    const c = w.add.container(x, y, [back, pet, bars, mask]).setDepth(y + 5);
    c.setData('pet', pet);
    if (!reduceMotion()) w.tweens.add({ targets: pet, y: -20, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const pid = st.puzzle;
    const it = {
      x, y: y - 10, r: 64, label: 'Open', promptY: CH * k + 20,
      enabled: () => this.cells.has(pid),
      action: () => this.tapCell(pid),
    };
    w.interactables.push(it);
    this.cells.set(pid, { c, it });
  }
  private dropCell(pid: string) {
    const e = this.cells.get(pid); if (!e) return;
    const i = this.w.interactables.indexOf(e.it as never);
    if (i >= 0) this.w.interactables.splice(i, 1);
    this.w.tweens.killTweensOf(e.c.getData('pet'));
    e.c.destroy();
    this.cells.delete(pid);
  }
  /** Tap a cell: once its puzzle is solved it pops open and your friend hops out. */
  tapCell(pid: string) {
    if (!this.cells.has(pid)) return false;
    const ch = this.w.puzzles.chestById(pid);
    if (!save.puzzles[pid] && !ch?.revealed) {
      const st = save.stolen?.find((s) => s.puzzle === pid);
      // 57: a big, simple clue card (stays until tapped).
      if (st) showClue([st], { here: true, title: 'It is locked!' });
      sfx.blip?.();
      return false;
    }
    this.rescue(pid);
    return true;
  }
  /** Opening the puzzle's chest also lets the friend out (the chest keeps its normal reward). */
  private onChest(pid: string) { this.rescue(pid); }

  private rescue(pid: string) {
    const st = save.stolen?.find((s) => s.puzzle === pid);
    if (!st) return;
    const m = mountById(st.mount);
    save.stolen = save.stolen!.filter((s) => s !== st);
    if (!save.stolen.length) delete save.stolen;
    persist();
    this.rescuedN++;
    const w = this.w;
    const e = this.cells.get(pid);
    const at = e ? { x: e.c.x, y: e.c.y } : { x: w.feet.x, y: w.feet.y };
    // The friend hops out of the cell with a happy burst, then flies off home to the stable.
    if (e && m) {
      const pet = friendImg(w, m, at.x, at.y - 14, CW * 1.25 * 0.78, 0.5, 1).setDepth(at.y + 20);
      if (reduceMotion()) w.time.delayedCall(700, () => pet.destroy());
      else {
        w.tweens.add({ targets: pet, y: at.y - 70, duration: 260, yoyo: true, ease: 'Sine.easeOut' });
        w.tweens.add({ targets: pet, y: at.y - 420, x: at.x + 160, alpha: 0, delay: 620, duration: 1100, ease: 'Sine.easeIn', onComplete: () => pet.destroy() });
      }
    }
    this.dropCell(pid);
    w.burst(at.x, at.y - 60, 0xff9ab8, 24, 'heart');
    w.burst(at.x, at.y - 60, 0xffe08a, 28, 'spark');
    sfx.sparkle();
    const left = save.stolen?.length ?? 0;
    w.time.delayedCall(400, () => w.game.events.emit('toast', `You rescued the ${m?.name ?? 'friend'}! It's back in your stable.${left ? ` ${left === 1 ? 'One more friend' : `${left} more friends`} to find!` : ''}`));
    w.game.events.emit('thief', 'rescued');
  }

  /** 53: Call Mount reminds you where every hidden friend is. */
  callMountHint() {
    const list = save.stolen ?? [];
    if (!list.length) return '';
    // 57: one simple line per friend, on a big centered card with no timeout.
    const msg = list.map((s) => clueLine(s)).join(' ');
    this.lastCallHint = msg;
    showClue(list);
    return msg;
  }

  /** 56: a quick lineup of every thief by the player (screenshots and tests); it fades after `ms`. */
  /** 60 (test): screen (CSS px) foot positions of the lineup's thieves. */
  lineupAt: Record<string, { x: number; y: number }> = {};
  lineup(ms = 9000) {
    const w = this.w, v = w.cameras.main.worldView;
    const n = THIEVES.length, cols = Math.ceil(n / 2), gap = v.width / (cols + 1);
    const items: Phaser.GameObjects.GameObject[] = [];
    THIEVES.forEach((k, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const x = v.x + gap * (col + 1) + (row ? gap / 2 : 0), y = v.y + v.height * (row ? 0.78 : 0.48);
      const key = `thief_${k.id}`;
      items.push(w.add.image(x, y, atlasOf(key), key).setOrigin(0.5, 0.92).setScale(1.9 / (frameScale[key] ?? 1)).setDepth(9400));
      const c = w.cameras.main; this.lineupAt[k.id] = { x: (x - v.x) * c.zoom / DPR, y: (y - v.y) * c.zoom / DPR };
      items.push(w.add.text(x, y + 14, k.name, { fontFamily: 'Fredoka, sans-serif', fontSize: '22px', color: '#4a321f', backgroundColor: '#fff6e3', padding: { x: 8, y: 3 } }).setOrigin(0.5, 0).setDepth(9401));
    });
    w.time.delayedCall(ms, () => items.forEach((o) => o.destroy()));
    return THIEVES.map((k) => k.id);
  }

  snapshot() {
    const s = this.spr;
    const c = this.w.cameras.main;
    return {
      state: this.state, kind: this.kind.id, taps: this.taps, stolen: save.stolen?.length ? save.stolen.map((x) => ({ ...x })) : null, carrying: [...this.carryIds], cells: [...this.cells.keys()], callHint: this.lastCallHint,
      thanks: this.thanks, paws: this.paws, giggles: this.giggles, lastGiggle: this.lastGiggle, kinds: THIEVES.map((k) => k.id), caught: this.caughtN, stolenN: this.stolenN, rescued: this.rescuedN, marker: this.cells.size > 0,
      screen: s ? { x: (s.x - c.worldView.x) * c.zoom / DPR, y: (s.y - 24 * SCALE - c.worldView.y) * c.zoom / DPR } : null,
      blocked: this.blocked(),
    };
  }
}
