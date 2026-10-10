// World geometry shared by painting, collision, navigation and fishing.
import {
  GLADE_W, GLADE_H, RIVER_PTS, RIVER_HALF, LAKE, RIDGE_X, FOREST_EDGE_Y, BRIDGES, PIER, AreaId,
} from './layout';
import { pondHit, pondValue } from './art';

export function spline(pts: [number, number][], step = 10): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(segLen / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export const RIVER = spline(RIVER_PTS, 8);
const RIVER_END_Y = RIVER[RIVER.length - 1][1];
/** Index table: first river sample with y >= k*20 (river y is monotonic). */
const riverIdx: number[] = [];
for (let k = 0, i = 0; k * 20 <= 3200; k++) {
  while (i < RIVER.length - 1 && RIVER[i][1] < k * 20) i++;
  riverIdx.push(i);
}

export function riverXAt(y: number) {
  if (y <= RIVER[0][1]) return RIVER[0][0];
  if (y >= RIVER_END_Y) return RIVER[RIVER.length - 1][0];
  const i = riverIdx[Math.max(0, Math.min(riverIdx.length - 1, Math.floor(y / 20)))];
  let j = Math.max(1, i);
  while (j < RIVER.length - 1 && RIVER[j][1] < y) j++;
  const a = RIVER[j - 1], b = RIVER[j];
  const t = (y - a[1]) / ((b[1] - a[1]) || 1);
  return a[0] + (b[0] - a[0]) * Math.max(0, Math.min(1, t));
}

/** Distance from (x, y) to the river centre line (approximate beyond 400 units). */
export function riverDist(x: number, y: number) {
  if (y > RIVER_END_Y + 400) return 9999;
  const ax = Math.abs(x - riverXAt(Math.min(y, RIVER_END_Y)));
  if (ax > 420 && y < RIVER_END_Y) return ax;
  const k0 = Math.max(0, Math.floor((y - 420) / 20));
  const k1 = Math.min(riverIdx.length - 1, Math.ceil((y + 420) / 20));
  const i0 = riverIdx[Math.min(k0, riverIdx.length - 1)];
  const i1 = Math.min(RIVER.length - 1, (riverIdx[k1] ?? RIVER.length - 1) + 1);
  let best = Infinity;
  for (let i = Math.max(0, i0 - 1); i <= i1; i++) {
    const d = (RIVER[i][0] - x) ** 2 + (RIVER[i][1] - y) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function riverHalfAt(y: number) {
  return RIVER_HALF + Math.sin(y * 0.006) * 6 + Math.max(0, (y - 1900) / 500) * 22;
}

const lakeWob = (a: number) => 1 + 0.06 * Math.sin(3 * a + 1) + 0.04 * Math.sin(5 * a + 2) + 0.025 * Math.sin(9 * a + 0.5);
/** <1 inside the lake water. */
export function lakeValue(x: number, y: number, pad = 0) {
  const dx = (x - LAKE.x) / (LAKE.rx + pad);
  const dy = (y - LAKE.y) / (LAKE.ry + pad);
  return Math.hypot(dx, dy) / lakeWob(Math.atan2(dy, dx));
}

export function onBridge(x: number, y: number) {
  for (const b of Object.values(BRIDGES)) if (Math.abs(x - b.x) < b.half + 6 && Math.abs(y - b.y) < b.w) return true;
  return false;
}
export function onPier(x: number, y: number) {
  return Math.abs(x - PIER.x) < PIER.w && y > PIER.y0 - 20 && y < PIER.y1;
}

export type WaterId = 'pond' | 'river' | 'lake';
/** Water body at a point (inner area, ignoring bridges / pier decks). */
export function waterAt(x: number, y: number, inset = 0): WaterId | null {
  if (x < GLADE_W && y < GLADE_H && pondValue(x, y, 30) < 1 && (inset ? pondValue(x, y, -inset) < 0.9 : pondHit(x, y))) return 'pond';
  if (lakeValue(x, y) < 1 - inset / LAKE.ry - 0.035) return 'lake';
  if (riverDist(x, y) < riverHalfAt(y) - 8 - inset && y < RIVER_END_Y + 60) return 'river';
  return null;
}

/** Blocks walking: water, except where a bridge or the pier crosses it. */
export function waterBlocks(x: number, y: number) {
  if (onBridge(x, y) || onPier(x, y)) return false;
  return waterAt(x, y) !== null;
}

export function areaAt(x: number, y: number): AreaId {
  if (x < GLADE_W && y < GLADE_H) return 'glade';
  if (y >= RIVER_END_Y) return x < RIDGE_X ? 'lake' : 'orchard';
  const rx = riverXAt(y);
  if (x > rx + 40) return y < FOREST_EDGE_Y ? 'forest' : 'orchard';
  if (y > 1580) return 'lake';
  return 'river';
}

/** Nearest water point to (x, y) within `max` (coarse search), for casting a line. */
export function nearestWater(x: number, y: number, max = 140): [number, number] | null {
  let best: [number, number] | null = null;
  let bd = Infinity;
  for (let r = 20; r <= max; r += 20) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (waterAt(px, py, 10) && !onBridge(px, py) && !onPier(px, py)) {
        const d = Math.hypot(px - x, py - y);
        if (d < bd) { bd = d; best = [px, py]; }
      }
    }
    if (best) return best;
  }
  return best;
}
