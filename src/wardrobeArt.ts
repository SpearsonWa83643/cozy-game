// Wardrobe item art (9.36): each cosmetic on its own (a hat on the shelf, a scarf on a hook, a coat on
// a hanger), cut out of the hero painter by painting the hero with and without the item and keeping
// only the pixels that change. One source of truth: items always match what the hero wears.
import Phaser from 'phaser';
import { paintHero, HERO_W, HERO_H } from './hero';
import { DEFAULT_LOOK, type Look } from './save';
import { COSMETICS, type Cosmetic } from './catalog';

const SC = 3;

/** The look to compare against: the same outfit with this slot taken off (or swapped for a very different colour). */
function without(c: Cosmetic): Look {
  const l: Look = { ...DEFAULT_LOOK, hat: 'none', scarf: 'none', back: 'none', feather: false, shells: false } as Look;
  if (c.slot === 'outfit') (l as any).outfit = c.value === 'koi' ? 'ranger' : 'koi';
  return l;
}
function withItem(c: Cosmetic): Look {
  const l = without(c);
  if (c.slot === 'outfit') (l as any).outfit = c.value;
  else (l as any)[c.slot] = c.value;
  return l;
}

function paint(look: Look, dir: number) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(HERO_W * SC); cv.height = Math.ceil(HERO_H * SC);
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.scale(SC, SC); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  paintHero(ctx as any, dir, 0, look);
  return ctx.getImageData(0, 0, cv.width, cv.height);
}

/** Is this the "take it off" entry (no hat, no scarf, nothing on the back)? */
export const isNoneItem = (c: Cosmetic) => c.value === 'none';

/** Builds the 'wardrobe-items' texture: one trimmed frame per cosmetic (none-items get an empty frame). */
export function buildWardrobeItems(scene: Phaser.Scene, key = 'wardrobe-items') {
  if (scene.textures.exists(key)) return key;
  const cuts: { id: string; data: ImageData | null }[] = [];
  for (const c of COSMETICS) {
    if (isNoneItem(c)) { cuts.push({ id: c.id, data: null }); continue; }
    const dir = c.id === 'back:backpack' ? 2 : 0;
    const a = paint(withItem(c), dir), b = paint(without(c), dir);
    const W = a.width, H = a.height;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    const out = new ImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const p = i * 4;
      const d = Math.abs(a.data[p] - b.data[p]) + Math.abs(a.data[p + 1] - b.data[p + 1]) + Math.abs(a.data[p + 2] - b.data[p + 2]) + Math.abs(a.data[p + 3] - b.data[p + 3]) * 2;
      if (d < 40 || a.data[p + 3] < 20) continue;
      out.data[p] = a.data[p]; out.data[p + 1] = a.data[p + 1]; out.data[p + 2] = a.data[p + 2]; out.data[p + 3] = a.data[p + 3];
      const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) { cuts.push({ id: c.id, data: null }); continue; }
    const tw = x1 - x0 + 1, th = y1 - y0 + 1;
    const t = document.createElement('canvas'); t.width = W; t.height = H;
    t.getContext('2d')!.putImageData(out, 0, 0);
    const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
    tc.getContext('2d')!.drawImage(t, x0, y0, tw, th, 0, 0, tw, th);
    cuts.push({ id: c.id, data: tc.getContext('2d')!.getImageData(0, 0, tw, th) });
  }
  // Pack in a row (sizes are small).
  const pad = 2;
  const sheetW = cuts.reduce((s, c) => s + (c.data?.width ?? 8) + pad, 0);
  const sheetH = Math.max(8, ...cuts.map((c) => c.data?.height ?? 8));
  const sheet = document.createElement('canvas'); sheet.width = sheetW; sheet.height = sheetH;
  const sctx = sheet.getContext('2d')!;
  const frames: [string, number, number, number, number][] = [];
  let x = 0;
  for (const c of cuts) {
    const w = c.data?.width ?? 8, h = c.data?.height ?? 8;
    if (c.data) sctx.putImageData(c.data, x, 0);
    frames.push([c.id, x, 0, w, h]);
    x += w + pad;
  }
  const tex = scene.textures.addImage(key, sheet as unknown as HTMLImageElement)!;
  for (const [id, fx, fy, fw, fh] of frames) tex.add(id, 0, fx, fy, fw, fh);
  return key;
}
