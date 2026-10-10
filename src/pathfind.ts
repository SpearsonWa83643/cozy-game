// Tiny grid A* for tap-to-move. The grid is rebuilt when the world changes (e.g. the gate opens).
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  blocked: Uint8Array;

  constructor(readonly worldW: number, readonly worldH: number, readonly cell = 20) {
    this.cols = Math.ceil(worldW / cell);
    this.rows = Math.ceil(worldH / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  clear() { this.blocked.fill(0); }

  idx(c: number, r: number) { return r * this.cols + c; }
  cellOf(x: number, y: number): [number, number] {
    return [Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell))), Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell)))];
  }
  center(c: number, r: number): [number, number] { return [(c + 0.5) * this.cell, (r + 0.5) * this.cell]; }
  isBlocked(c: number, r: number) {
    return c < 0 || r < 0 || c >= this.cols || r >= this.rows || this.blocked[this.idx(c, r)] === 1;
  }

  blockRect(x: number, y: number, w: number, h: number, pad: number) {
    const [c0, r0] = this.cellOf(x - pad, y - pad);
    const [c1, r1] = this.cellOf(x + w + pad, y + h + pad);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.blocked[this.idx(c, r)] = 1;
  }

  blockCircle(cx: number, cy: number, rad: number, pad: number) {
    const R = rad + pad;
    const [c0, r0] = this.cellOf(cx - R, cy - R);
    const [c1, r1] = this.cellOf(cx + R, cy + R);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const [x, y] = this.center(c, r);
      if (Math.hypot(x - cx, y - cy) <= R) this.blocked[this.idx(c, r)] = 1;
    }
  }

  blockWhere(test: (x: number, y: number) => boolean) {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const [x, y] = this.center(c, r);
      if (test(x, y)) this.blocked[this.idx(c, r)] = 1;
    }
  }

  /** Nearest walkable cell to (x, y), searching outward in rings. */
  nearestFree(x: number, y: number, maxRing = 12): [number, number] | null {
    const [c, r] = this.cellOf(x, y);
    if (!this.isBlocked(c, r)) return [c, r];
    for (let k = 1; k <= maxRing; k++) {
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
        if (this.isBlocked(c + dc, r + dr)) continue;
        const [cx, cy] = this.center(c + dc, r + dr);
        const d = Math.hypot(cx - x, cy - y);
        if (d < bestD) { bestD = d; best = [c + dc, r + dr]; }
      }
      if (best) return best;
    }
    return null;
  }

  /** Grid line-of-sight (supercover-ish sampling). */
  clearLine(x0: number, y0: number, x1: number, y1: number) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / (this.cell * 0.35));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      const [c, r] = this.cellOf(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      if (this.isBlocked(c, r)) return false;
    }
    return true;
  }

  /** A* from world point to world point. Returns smoothed world waypoints (excluding start) or null. */
  find(sx: number, sy: number, tx: number, ty: number): [number, number][] | null {
    const start = this.nearestFree(sx, sy, 3);
    const goal = this.nearestFree(tx, ty);
    if (!start || !goal) return null;
    const N = this.cols * this.rows;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const si = this.idx(start[0], start[1]);
    const gi = this.idx(goal[0], goal[1]);
    const h = (i: number) => {
      const dc = Math.abs((i % this.cols) - goal[0]);
      const dr = Math.abs(Math.floor(i / this.cols) - goal[1]);
      return Math.max(dc, dr) + 0.4142 * Math.min(dc, dr);
    };
    // Binary min-heap keyed on f.
    const hf: number[] = [];
    const hi: number[] = [];
    const swap = (a: number, b: number) => {
      [hf[a], hf[b]] = [hf[b], hf[a]];
      [hi[a], hi[b]] = [hi[b], hi[a]];
    };
    const push = (f: number, i: number) => {
      hf.push(f); hi.push(i);
      let k = hf.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (hf[p] <= hf[k]) break;
        swap(p, k);
        k = p;
      }
    };
    const pop = () => {
      const top = hi[0];
      const lf = hf.pop()!;
      const li = hi.pop()!;
      if (hf.length) {
        hf[0] = lf; hi[0] = li;
        let k = 0;
        const n = hf.length;
        for (;;) {
          const l = k * 2 + 1;
          const r = l + 1;
          let m = k;
          if (l < n && hf[l] < hf[m]) m = l;
          if (r < n && hf[r] < hf[m]) m = r;
          if (m === k) break;
          swap(m, k);
          k = m;
        }
      }
      return top;
    };
    g[si] = 0;
    push(h(si), si);
    let expanded = 0;
    while (hf.length) {
      const cur = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === gi) break;
      if (++expanded > 20000) return null;
      const cc = cur % this.cols;
      const cr = Math.floor(cur / this.cols);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = cc + dc;
        const nr = cr + dr;
        if (this.isBlocked(nc, nr)) continue;
        if (dr && dc && (this.isBlocked(cc + dc, cr) || this.isBlocked(cc, cr + dr))) continue; // no corner cutting
        const ni = this.idx(nc, nr);
        const ng = g[cur] + (dr && dc ? 1.4142 : 1);
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ng + h(ni), ni); }
      }
    }
    if (came[gi] === -1 && gi !== si) return null;
    const cells: [number, number][] = [];
    for (let i = gi; i !== -1 && i !== si; i = came[i]) cells.push(this.center(i % this.cols, Math.floor(i / this.cols)));
    cells.reverse();
    // The last waypoint is the exact tap point when it is walkable.
    const [tc, tr] = this.cellOf(tx, ty);
    if (!this.isBlocked(tc, tr) && cells.length) cells[cells.length - 1] = [tx, ty];
    // String-pull: keep only waypoints needed for line of sight.
    const out: [number, number][] = [];
    let ax = sx, ay = sy;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.clearLine(ax, ay, cells[j][0], cells[j][1])) j--;
      out.push(cells[j]);
      [ax, ay] = cells[j];
      i = j + 1;
    }
    return out;
  }
}
