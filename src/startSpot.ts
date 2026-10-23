// Random start spot: each new session drops the player somewhere new in the glade.
// Only cells that are walkable, roomy (no solid/water within a small radius) and
// reachable on foot from the usual start are allowed, so you can never spawn inside
// a building, in the pond or behind a locked gate.
import type { NavGrid } from './pathfind';

/** Small seeded PRNG (mulberry32). */
export function rng32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type StartOpts = {
  /** Where the player normally starts; also the fallback. */
  from: { x: number; y: number };
  /** Keep to this world rectangle (the glade itself, not the far woods). */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  /** Free cells required around the spot, in grid cells. */
  clearance?: number;
  /** Extra veto (e.g. too close to a puzzle). */
  reject?: (x: number, y: number) => boolean;
};

/** All roomy cells reachable from `from` inside `bounds` (computed once per nav). */
export function startCandidates(nav: NavGrid, o: StartOpts): [number, number][] {
  const k = o.clearance ?? 2;
  const start = nav.nearestFree(o.from.x, o.from.y, 6);
  if (!start) return [];
  const seen = new Uint8Array(nav.cols * nav.rows);
  const q: number[] = [nav.idx(start[0], start[1])];
  seen[q[0]] = 1;
  const out: [number, number][] = [];
  const roomy = (c: number, r: number) => {
    for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) if (nav.isBlocked(c + dc, r + dr)) return false;
    return true;
  };
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const c = i % nav.cols, r = (i / nav.cols) | 0;
    const [x, y] = nav.center(c, r);
    if (x >= o.bounds.x0 && x <= o.bounds.x1 && y >= o.bounds.y0 && y <= o.bounds.y1 && roomy(c, r) && !o.reject?.(x, y)) out.push([x, y]);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nav.isBlocked(nc, nr)) continue;
      const ni = nav.idx(nc, nr);
      if (seen[ni]) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  return out;
}

/** Pick a random safe start; falls back to `from` when nothing qualifies. */
export function pickStart(cands: [number, number][], o: StartOpts, rand: () => number): { x: number; y: number; fallback: boolean } {
  if (!cands.length) return { x: o.from.x, y: o.from.y, fallback: true };
  const [x, y] = cands[Math.floor(rand() * cands.length) % cands.length];
  return { x, y, fallback: false };
}
