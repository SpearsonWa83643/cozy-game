// The player character, painted with the equipped cosmetics into its own small sheet.
import Phaser from 'phaser';
import { Ctx, hsl, dab, S } from './art';
import { Look } from './save';

export const HERO_W = 60;
export const HERO_H = 80;

const OUTFITS: Record<string, { a: [number, number, number]; b: [number, number, number]; arm: [number, number, number] }> = {
  teal: { a: [178, 45, 52], b: [190, 50, 36], arm: [185, 45, 42] },
  moss: { a: [95, 34, 50], b: [108, 38, 33], arm: [100, 34, 40] },
  sea: { a: [205, 58, 60], b: [218, 55, 40], arm: [210, 50, 48] },
  koi: { a: [35, 40, 94], b: [28, 30, 80], arm: [30, 35, 86] },
};
const SCARVES: Record<string, [[number, number, number], [number, number, number]] | null> = {
  red: [[10, 78, 56], [18, 85, 66]], sunny: [[44, 90, 56], [50, 95, 72]], petal: [[340, 70, 72], [345, 85, 84]],
  silver: [[210, 14, 76], [210, 25, 92]], none: null,
};

/** Paints one frame. dir: 0 S, 1 SE, 2 E, 3 NE, 4 N; step: 0 idle, 1/2 stride. */
export function paintHero(ctx: Ctx, dir: number, step: number, look: Look) {
  const w = 48, h = 64;
  ctx.save();
  ctx.translate((HERO_W - w) / 2, HERO_H - h);
  const cx = w / 2;
  const facing = [0, 0.55, 1, 0.55, 0][dir];
  const back = dir >= 3;
  const footY = h - 5;
  const o = OUTFITS[look.outfit] ?? OUTFITS.teal;

  const staff = () => {
    const sx = dir === 2 ? cx + 4 : cx + 15 - facing * 4;
    ctx.strokeStyle = hsl(26, 40, 32); ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(sx, h - 6); ctx.lineTo(sx + 1, h - 54); ctx.quadraticCurveTo(sx + 6, h - 60, sx + 9, h - 54); ctx.stroke();
    dab(ctx, sx + 9, h - 49, 6, 6, 0, hsl(45, 100, 70, 0.35));
    ctx.fillStyle = hsl(30, 30, 30); ctx.fillRect(sx + 6, h - 53, 6, 2);
    dab(ctx, sx + 9, h - 48.5, 3, 3.6, 0, hsl(45, 95, 70));
    dab(ctx, sx + 8.4, h - 49.5, 1.2, 1.4, 0, '#fff');
  };
  const pack = (front: boolean) => {
    if (front) {
      ctx.fillStyle = hsl(25, 45, 34);
      ctx.fillRect(cx - 8, h - 33, 2.4, 15); ctx.fillRect(cx + 5.6, h - 33, 2.4, 15);
      return;
    }
    const bx = cx - facing * 9;
    ctx.fillStyle = hsl(25, 45, 38);
    ctx.beginPath(); ctx.roundRect(bx - 9, h - 36, 18, 20, 5); ctx.fill();
    ctx.fillStyle = hsl(28, 50, 50);
    ctx.beginPath(); ctx.roundRect(bx - 8, h - 35, 16, 7, 3); ctx.fill();
    dab(ctx, bx, h - 24, 2, 2, 0, hsl(40, 60, 60));
  };

  if (look.back === 'staff' && back) staff();
  // Feet.
  const fo = step === 0 ? [0, 0] : step === 1 ? [-3, 2] : [2, -3];
  const footDX = dir === 2 ? 3 : 6;
  dab(ctx, cx - footDX + facing * 2, footY + fo[0] * 0.5, 4.5, 3, 0, hsl(20, 35, 26));
  dab(ctx, cx + footDX + facing * 2, footY + fo[1] * 0.5, 4.5, 3, 0, hsl(20, 35, 26));
  if (look.back === 'backpack' && dir >= 2) pack(false);
  // Body / tunic.
  const bodyTop = h - 33;
  const bg = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0);
  bg.addColorStop(0, hsl(...o.a)); bg.addColorStop(1, hsl(...o.b));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(cx - 9, bodyTop);
  const flare = look.outfit === 'sea' ? 4 : 0; // cloak flares a little
  ctx.quadraticCurveTo(cx - 15 - flare, h - 12, cx - 12 - flare, h - 7);
  ctx.quadraticCurveTo(cx, h - 3, cx + 12 + flare, h - 7);
  ctx.quadraticCurveTo(cx + 15 + flare, h - 12, cx + 9, bodyTop);
  ctx.closePath(); ctx.fill();
  if (look.outfit === 'koi') {
    for (const [x, y, r] of [[-5, 8, 4], [4, 13, 3.4], [-2, 19, 3], [7, 5, 2.4]]) dab(ctx, cx + x, bodyTop + y, r, r * 0.8, 0.4, hsl(16, 85, 58));
  }
  if (look.outfit === 'sea') { ctx.fillStyle = hsl(45, 70, 70); ctx.fillRect(cx - 0.8, bodyTop + 3, 1.6, 18); }
  ctx.fillStyle = hsl(30, 40, 30);
  ctx.fillRect(cx - 12, h - 17, 24, 3);
  if (dir < 2 && look.back !== 'backpack') {
    ctx.fillStyle = hsl(28, 50, 30);
    ctx.fillRect(cx - 7, bodyTop + 2, 2.5, 14);
    ctx.fillRect(cx + 4.5, bodyTop + 2, 2.5, 14);
  }
  if (look.back === 'backpack' && dir < 2) pack(true);
  if (look.shells && !back) {
    for (let i = 0; i < 7; i++) {
      const a = 0.3 + (i / 6) * (Math.PI - 0.6);
      dab(ctx, cx + facing * 2 + Math.cos(a) * 7.5, bodyTop + 2 + Math.sin(a) * 6, 1.3, 1.5, 0, hsl(i % 2 ? 20 : 345, 60, 86));
    }
  }
  // Arms swinging.
  const swing = step === 0 ? 0 : step === 1 ? 2.5 : -2.5;
  dab(ctx, cx - 13, h - 18 + swing, 3.4, 4.6, 0.2, hsl(...o.arm));
  dab(ctx, cx + 13, h - 18 - swing, 3.4, 4.6, -0.2, hsl(o.b[0], o.b[1], o.b[2] - 2));
  // Head.
  const hy = h - 42;
  const hx = cx + facing * 2;
  dab(ctx, hx, hy, 12.5, 12, 0, hsl(28, 55, 84));
  dab(ctx, hx + 3, hy + 3, 8, 7, 0, hsl(22, 45, 76, 0.5));
  if (!back) {
    const ex = hx + facing * 5;
    const eyeGap = 5.5 - facing * 2.5;
    dab(ctx, ex - eyeGap, hy + 2, 1.6, 2.1, 0, hsl(250, 30, 18));
    if (facing < 0.95) dab(ctx, ex + eyeGap, hy + 2, 1.6, 2.1, 0, hsl(250, 30, 18));
    else dab(ctx, ex + eyeGap, hy + 2, 1.2, 2, 0, hsl(250, 30, 18));
    dab(ctx, ex - eyeGap - 0.5, hy + 1.2, 0.6, 0.6, 0, '#fff');
    dab(ctx, ex - eyeGap - 3, hy + 5.5, 2.6, 1.6, 0, hsl(350, 80, 75, 0.7));
    if (facing < 0.95) dab(ctx, ex + eyeGap + 3, hy + 5.5, 2.6, 1.6, 0, hsl(350, 80, 75, 0.7));
  } else {
    dab(ctx, hx, hy + 6, 9, 4, 0, hsl(25, 45, 34));
  }
  // Scarf.
  const sc = SCARVES[look.scarf];
  if (sc) {
    ctx.fillStyle = hsl(...sc[0]);
    ctx.beginPath(); ctx.roundRect(cx - 11, bodyTop - 3, 22, 7, 3.5); ctx.fill();
    const tailX = back ? cx + 2 : cx - facing * 10 - 2;
    ctx.beginPath();
    ctx.moveTo(tailX - 3, bodyTop + 2);
    ctx.quadraticCurveTo(tailX - 6 - facing * 4, bodyTop + 10, tailX - 4 - facing * 6, bodyTop + 15);
    ctx.lineTo(tailX + 2 - facing * 6, bodyTop + 14);
    ctx.quadraticCurveTo(tailX, bodyTop + 8, tailX + 3, bodyTop + 2);
    ctx.fill();
    ctx.fillStyle = hsl(...sc[1]);
    ctx.fillRect(cx - 9, bodyTop - 2, 18, 1.6);
  }
  // Headwear.
  const hatY = hy - 7;
  let featherAt: [number, number] = [hx + 8 - facing * 2, hatY - 4];
  if (look.hat === 'straw') {
    dab(ctx, hx, hatY + 2, 19, 7, 0, hsl(36, 50, 46));
    dab(ctx, hx, hatY, 18.5, 6.5, 0, hsl(46, 70, 70));
    dab(ctx, hx - 4, hatY - 1.5, 10, 3, 0, hsl(50, 80, 82, 0.7));
    ctx.fillStyle = hsl(44, 65, 64);
    ctx.beginPath();
    ctx.ellipse(hx, hatY - 4, 9.5, 7.5, 0, Math.PI, 0);
    ctx.lineTo(hx + 9.5, hatY - 1);
    ctx.ellipse(hx, hatY - 1, 9.5, 3, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = hsl(8, 70, 52);
    ctx.fillRect(hx - 9.5, hatY - 3.5, 19, 2.6);
    dab(ctx, hx - 3, hatY - 8, 3.5, 1.8, -0.3, hsl(52, 85, 86, 0.8));
    dab(ctx, hx + 6 - facing * 2, hatY - 2.5, 2, 2, 0, hsl(340, 80, 78));
  } else if (look.hat === 'none' || look.hat === 'crown') {
    // Hair.
    dab(ctx, hx, hy - 6, 12, 7, 0, hsl(25, 45, 34));
    dab(ctx, hx - 3, hy - 8.5, 6, 2.6, -0.2, hsl(28, 50, 46, 0.8));
    if (!back) { dab(ctx, hx - 7 + facing * 3, hy - 3, 4, 3, 0.6, hsl(25, 45, 34)); dab(ctx, hx + 6 + facing * 3, hy - 3.5, 3.5, 2.6, -0.6, hsl(25, 45, 34)); }
    featherAt = [hx + 7 - facing * 2, hy - 9];
    if (look.hat === 'crown') {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        const x = hx + Math.cos(a) * 12, y = hy - 6 + Math.sin(a) * 5;
        dab(ctx, x, y + 1, 2.6, 1.6, a, hsl(110, 45, 38));
        const hue = [340, 48, 0, 270, 20][i % 5];
        dab(ctx, x, y, 2.6, 2.4, 0, hsl(hue, hue === 0 ? 0 : 80, hue === 0 ? 97 : 74));
        dab(ctx, x, y, 0.9, 0.9, 0, hsl(50, 90, 66));
      }
      featherAt = [hx + 10 - facing * 2, hy - 9];
    }
  } else if (look.hat === 'foxhood') {
    const fur = hsl(22, 75, 54);
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(hx - 14, hy + 6); ctx.quadraticCurveTo(hx - 16, hy - 14, hx, hy - 14); ctx.quadraticCurveTo(hx + 16, hy - 14, hx + 14, hy + 6);
    if (!back) { ctx.quadraticCurveTo(hx + 10, hy - 6, hx, hy - 7); ctx.quadraticCurveTo(hx - 10, hy - 6, hx - 14, hy + 6); }
    ctx.closePath(); ctx.fill();
    for (const sx of [-1, 1]) {
      const ex = hx + sx * 8 - facing * 2;
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.moveTo(ex - 4, hy - 11); ctx.lineTo(ex + sx * 3, hy - 24); ctx.lineTo(ex + 5 * sx, hy - 9); ctx.fill();
      ctx.fillStyle = hsl(30, 40, 92);
      ctx.beginPath(); ctx.moveTo(ex - 1.5 * sx, hy - 12); ctx.lineTo(ex + sx * 2.6, hy - 20); ctx.lineTo(ex + 3.4 * sx, hy - 11); ctx.fill();
    }
    dab(ctx, hx - 5, hy - 11, 5, 2, -0.3, hsl(28, 85, 66, 0.6));
    featherAt = [hx + 11 - facing * 2, hy - 8];
  }
  if (look.feather) {
    const [fx, fy] = featherAt;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(0.45);
    const g = ctx.createLinearGradient(0, -12, 0, 4);
    g.addColorStop(0, hsl(48, 100, 80)); g.addColorStop(1, hsl(38, 90, 52));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(-4.5, -4, 0, -13); ctx.quadraticCurveTo(4.5, -4, 0, 4); ctx.fill();
    ctx.strokeStyle = hsl(36, 70, 40, 0.8); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -11); ctx.stroke();
    ctx.restore();
  }
  if (look.back === 'staff' && !back) staff();
  ctx.restore();
}

let heroGen = 0;
/** (Re)builds the hero sheet for `look`, returns its texture key (frames `${dir}_${step}`). */
export function buildHeroSheet(scene: Phaser.Scene, look: Look) {
  const key = `hero${heroGen++ % 2}`;
  const fw = Math.ceil(HERO_W * S), fh = Math.ceil(HERO_H * S);
  const canvas = document.createElement('canvas');
  canvas.width = fw * 5; canvas.height = fh * 3;
  const ctx = canvas.getContext('2d')!;
  for (let d = 0; d < 5; d++) for (let s = 0; s < 3; s++) {
    ctx.save(); ctx.translate(d * fw, s * fh); ctx.scale(S, S); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    paintHero(ctx, d, s, look); ctx.restore();
  }
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addImage(key, canvas as unknown as HTMLImageElement)!;
  for (let d = 0; d < 5; d++) for (let s = 0; s < 3; s++) tex.add(`${d}_${s}`, 0, d * fw, s * fh, fw, fh);
  canvas.width = 1; canvas.height = 1;
  return key;
}

/** Front-facing previews for the wardrobe: one frame per entry. */
export function buildPreviewSheet(scene: Phaser.Scene, key: string, looks: { id: string; look: Look }[], scale = 2) {
  const fw = Math.ceil(HERO_W * scale), fh = Math.ceil(HERO_H * scale);
  const cols = 8;
  const canvas = document.createElement('canvas');
  canvas.width = fw * cols; canvas.height = fh * Math.ceil(looks.length / cols);
  const ctx = canvas.getContext('2d')!;
  looks.forEach((l, i) => {
    ctx.save(); ctx.translate((i % cols) * fw, Math.floor(i / cols) * fh); ctx.scale(scale, scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    paintHero(ctx, l.id === 'back:backpack' ? 1 : 0, 0, l.look); ctx.restore();
  });
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addImage(key, canvas as unknown as HTMLImageElement)!;
  looks.forEach((l, i) => tex.add(l.id, 0, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh));
  canvas.width = 1; canvas.height = 1;
}
