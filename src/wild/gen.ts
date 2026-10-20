// Seeded wilderness generator. Pure data (no Phaser), so tests can check it directly.
import { mulberry32 } from '../art';

export const WILD_W = 2400;
export const WILD_H = 1700;

export type WildProp = { x: number; y: number; kind: 'tree' | 'pine' | 'rock' | 'bush' | 'fern' | 'shroom' | 'flower'; v: number };
export type WildPond = { x: number; y: number; rx: number; ry: number };
export type WildClearing = { x: number; y: number; r: number };
export type WildMonsterSpawn = { x: number; y: number; kind: 'slime' | 'bramble'; home: WildClearing };
export type WildMap = {
  seed: number;
  w: number; h: number;
  start: { x: number; y: number };
  exit: { x: number; y: number };
  paths: [number, number][][];
  ponds: WildPond[];
  clearings: WildClearing[];
  props: WildProp[];
  monsters: WildMonsterSpawn[];
  chests: { x: number; y: number }[];
  /** The glowing mount lunchbox: a short, easy walk from the arrival point, just off the trail. */
  lunchbox: { x: number; y: number };
};

/** Distance from a point to a polyline. */
export function polyDist(x: number, y: number, pts: [number, number][]) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
  }
  return best;
}

export function inPond(ponds: WildPond[], x: number, y: number, pad = 0) {
  return ponds.some((p) => ((x - p.x) / (p.rx + pad)) ** 2 + ((y - p.y) / (p.ry + pad)) ** 2 < 1);
}

/** Builds one wilderness from a seed. Same seed, same woods. */
export function generateWild(seed: number): WildMap {
  const rng = mulberry32(seed >>> 0);
  const r = (a: number, b: number) => a + (b - a) * rng();
  const W = WILD_W, H = WILD_H;
  const start = { x: 170, y: r(650, 1050) };
  const exit = { x: W - 200, y: r(400, 1300) };

  // Clearings: 4 to 5 open glades spread across the woods.
  const clearings: WildClearing[] = [];
  const nC = 4 + Math.floor(rng() * 2);
  for (let i = 0; i < nC; i++) {
    const fx = (i + 0.6) / (nC + 0.2);
    clearings.push({ x: 350 + fx * (W - 700), y: r(330, H - 330), r: r(150, 210) });
  }

  // A winding trail: start -> each clearing (left to right) -> exit.
  const stops: [number, number][] = [[start.x, start.y], ...clearings.map((c) => [c.x, c.y] as [number, number]), [exit.x, exit.y]];
  const main: [number, number][] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const [ax, ay] = stops[i], [bx, by] = stops[i + 1];
    const mx = (ax + bx) / 2 + r(-60, 60), my = (ay + by) / 2 + r(-140, 140);
    for (let t = 0; t < 1; t += 0.125) {
      const u = 1 - t;
      main.push([u * u * ax + 2 * u * t * mx + t * t * bx, u * u * ay + 2 * u * t * my + t * t * by]);
    }
  }
  main.push([exit.x, exit.y]);
  const paths = [main];
  // One side trail to a far corner clearing for a hidden chest.
  const sideFrom = clearings[1 + Math.floor(rng() * (nC - 2))];
  const corner = { x: sideFrom.x + r(-150, 150), y: sideFrom.y < H / 2 ? H - 190 : 190, r: 120 };
  paths.push([[sideFrom.x, sideFrom.y], [(sideFrom.x + corner.x) / 2 + r(-50, 50), (sideFrom.y + corner.y) / 2], [corner.x, corner.y]]);
  const pathDist = (x: number, y: number) => Math.min(...paths.map((p) => polyDist(x, y, p)));

  // Ponds: in the gaps away from trails and clearings.
  const ponds: WildPond[] = [];
  for (let tries = 0; tries < 60 && ponds.length < 3; tries++) {
    const p = { x: r(250, W - 250), y: r(200, H - 200), rx: r(90, 150), ry: r(60, 95) };
    if (pathDist(p.x, p.y) < p.rx + 70) continue;
    if ([...clearings, corner].some((c) => Math.hypot(c.x - p.x, c.y - p.y) < c.r + p.rx + 40)) continue;
    if (inPond(ponds, p.x, p.y, 200)) continue;
    ponds.push(p);
  }

  // Scatter: trees and rocks on a jittered grid, leaving trails, glades, ponds and the portals open.
  const props: WildProp[] = [];
  const open = (x: number, y: number, pad: number) =>
    pathDist(x, y) < 60 + pad || inPond(ponds, x, y, 30 + pad) ||
    [...clearings, corner].some((c) => Math.hypot(c.x - x, c.y - y) < c.r + pad) ||
    Math.hypot(start.x - x, start.y - y) < 150 || Math.hypot(exit.x - x, exit.y - y) < 160;
  const STEP = 92;
  for (let gy = 40; gy < H; gy += STEP) for (let gx = 30; gx < W; gx += STEP) {
    const x = gx + r(-34, 34), y = gy + r(-34, 34);
    const roll = rng();
    const edge = x < 80 || x > W - 80 || y < 90 || y > H - 40;
    if (open(x, y, edge ? -40 : 10)) {
      // Small cheer near trails and in glades.
      if (roll < 0.16 && !inPond(ponds, x, y, 10) && pathDist(x, y) > 40) props.push({ x, y, kind: roll < 0.08 ? 'flower' : 'fern', v: Math.floor(rng() * 4) });
      continue;
    }
    if (roll < 0.52 || edge) props.push({ x, y, kind: rng() < 0.3 ? 'pine' : 'tree', v: Math.floor(rng() * 6) });
    else if (roll < 0.66) props.push({ x, y, kind: 'rock', v: Math.floor(rng() * 3) });
    else if (roll < 0.8) props.push({ x, y, kind: 'bush', v: Math.floor(rng() * 3) });
    else if (roll < 0.88) props.push({ x, y, kind: 'shroom', v: 0 });
    else props.push({ x, y, kind: 'fern', v: Math.floor(rng() * 4) });
  }
  props.sort((a, b) => a.y - b.y);

  // Monsters: 2 or 3 per glade (not the first one, so the start is calm).
  const monsters: WildMonsterSpawn[] = [];
  clearings.forEach((c, i) => {
    const n = i === 0 ? 1 : 2 + Math.floor(rng() * 2);
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2, d = r(0.2, 0.7) * c.r;
      monsters.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, kind: rng() < 0.55 ? 'slime' : 'bramble', home: c });
    }
  });
  const chests = [{ x: corner.x, y: corner.y }];
  const lunchbox = placeLunchbox(start, main, ponds, props);
  return { seed, w: W, h: H, start, exit, paths, ponds, clearings: [...clearings, corner], props, monsters, chests, lunchbox };
}

/** First trail point ~170px from the start, nudged just off the trail onto open, dry ground. */
function placeLunchbox(start: { x: number; y: number }, main: [number, number][], ponds: WildPond[], props: WildProp[]) {
  const solid = (x: number, y: number) => props.some((p) => p.kind !== 'fern' && p.kind !== 'flower' && p.kind !== 'shroom' && Math.hypot(p.x - x, p.y - y) < 56);
  const ok = (x: number, y: number) => x > 80 && y > 120 && x < WILD_W - 80 && y < WILD_H - 80 && !inPond(ponds, x, y, 50) && !solid(x, y);
  for (let i = 1; i < main.length; i++) {
    const [x, y] = main[i];
    const d = Math.hypot(x - start.x, y - start.y);
    if (d < 165) continue;
    const [px, py] = main[i - 1];
    const len = Math.hypot(x - px, y - py) || 1;
    const nx = -(y - py) / len, ny = (x - px) / len;
    for (const off of [-46, 46, -30, 30, 0]) {
      const cx = Math.round(x + nx * off), cy = Math.round(y + ny * off);
      if (ok(cx, cy)) return { x: cx, y: cy };
    }
    if (d > 320) break;
  }
  return { x: Math.round(start.x + 170), y: Math.round(start.y) };
}
