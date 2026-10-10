// Streamed, chunked ground painting. The world is painted on demand in TILE-sized squares
// around the camera (deterministic per tile, so revisits look identical) and far tiles are
// released. Keeps texture memory to roughly a dozen tiles instead of one giant canvas.
import Phaser from 'phaser';
import {
  Ctx, Rng, mulberry32, hsl, rr, dab, softCircle, blob, blobPath, pondValue, ALL_PATHS, pathDist, GS,
} from './art';
import {
  WORLD_W, WORLD_H, GLADE_W, GLADE_H, POND, SHRINE, GARDEN, COTTAGE, LAKE, AreaId, PIER,
} from './layout';
import { RIVER, riverDist, riverHalfAt, lakeValue, areaAt } from './geo';

export const TILE = 512;

type Pal = { base: [number, number, number]; dabH: [number, number]; dabS: [number, number]; dabL: [number, number];
  lightH: [number, number]; darkH: [number, number]; lightL: [number, number]; darkL: [number, number]; blades: number; dabs: number };
const PAL: Record<AreaId, Pal> = {
  glade: { base: [92, 46, 51], dabH: [75, 125], dabS: [35, 60], dabL: [38, 62], lightH: [70, 95], darkH: [110, 140], lightL: [62, 74], darkL: [24, 34], blades: 120, dabs: 88 },
  river: { base: [105, 48, 46], dabH: [85, 135], dabS: [38, 60], dabL: [34, 56], lightH: [80, 105], darkH: [115, 145], lightL: [58, 70], darkL: [22, 32], blades: 130, dabs: 88 },
  forest: { base: [138, 26, 36], dabH: [110, 175], dabS: [18, 38], dabL: [26, 46], lightH: [90, 130], darkH: [150, 180], lightL: [48, 62], darkL: [18, 28], blades: 90, dabs: 100 },
  orchard: { base: [70, 52, 56], dabH: [48, 95], dabS: [40, 62], dabL: [44, 66], lightH: [50, 75], darkH: [90, 115], lightL: [66, 78], darkL: [30, 40], blades: 120, dabs: 88 },
  lake: { base: [96, 42, 54], dabH: [70, 120], dabS: [32, 55], dabL: [40, 62], lightH: [65, 95], darkH: [105, 135], lightL: [62, 74], darkL: [26, 36], blades: 110, dabs: 80 },
};

const hash = (a: number, b: number, c: number) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
};
const cellRng = (cx: number, cy: number, layer: number): Rng => mulberry32(hash(cx + 7, cy + 13, layer));

function biomeColor(x: number, y: number): [number, number, number] {
  const a = areaAt(x, y);
  const b = PAL[a].base;
  // Gentle large-scale variation + darker near the world rim.
  const n = Math.sin(x * 0.0021 + y * 0.0013) * 0.5 + Math.sin(x * 0.0007 - y * 0.0017) * 0.5;
  const rim = Math.min(x, y, WORLD_W - x, WORLD_H - y);
  const dark = rim < 220 ? (220 - rim) / 220 * 12 : 0;
  return [b[0] + n * 6, b[1], b[2] + n * 3 - dark];
}

const sandLimit = 1.32;
function isSand(x: number, y: number) { const v = lakeValue(x, y); return v < sandLimit && v >= 0.97; }

/** Paints the ground for world rect [x0, x0+size)² into ctx (already scaled to world units). */
export function paintGroundTile(ctx: Ctx, x0: number, y0: number, size: number) {
  const x1 = x0 + size, y1 = y0 + size;
  const vis = (ax: number, ay: number, bx: number, by: number) => bx >= x0 && ax <= x1 && by >= y0 && ay <= y1;
  ctx.save();
  ctx.translate(-x0, -y0);
  ctx.beginPath(); ctx.rect(x0 - 2, y0 - 2, size + 4, size + 4); ctx.clip();

  // 1. Biome base: fill + overlapping soft circles sampled on a fixed world grid (blends areas).
  const c0 = biomeColor(x0 + size / 2, y0 + size / 2);
  ctx.fillStyle = hsl(c0[0], c0[1], c0[2]);
  ctx.fillRect(x0 - 2, y0 - 2, size + 4, size + 4);
  const G = 96;
  for (let gy = Math.floor((y0 - 200) / G); gy <= Math.ceil((y1 + 200) / G); gy++) {
    for (let gx = Math.floor((x0 - 200) / G); gx <= Math.ceil((x1 + 200) / G); gx++) {
      const x = gx * G, y = gy * G;
      softCircle(ctx, x, y, 170, biomeColor(x, y), 0.55);
    }
  }
  // 2. Large soft colour patches.
  const PC = 256;
  for (let cy = Math.floor((y0 - 260) / PC); cy <= Math.floor((y1 + 260) / PC); cy++) {
    for (let cx = Math.floor((x0 - 260) / PC); cx <= Math.floor((x1 + 260) / PC); cx++) {
      const rng = cellRng(cx, cy, 1);
      for (let i = 0; i < 6; i++) {
        const x = (cx + rng()) * PC, y = (cy + rng()) * PC, r = rr(rng, 70, 230);
        const warm = rng() < 0.5;
        const a = areaAt(x, y);
        const hh = a === 'forest' ? (warm ? rr(rng, 90, 110) : rr(rng, 150, 175)) : a === 'orchard' ? (warm ? rr(rng, 45, 65) : rr(rng, 85, 110)) : (warm ? rr(rng, 60, 85) : rr(rng, 110, 150));
        const ll = warm ? rr(rng, 56, 66) : rr(rng, 30, 40);
        const aa = rr(rng, 0.1, 0.26);
        if (vis(x - r, y - r, x + r, y + r)) softCircle(ctx, x, y, r, [hh, warm ? 60 : 38, ll], aa);
      }
    }
  }
  // Shrine grove: mossier, darker, cooler.
  if (vis(SHRINE.x - 420, SHRINE.y - 400, SHRINE.x + 420, SHRINE.y + 440)) softCircle(ctx, SHRINE.x, SHRINE.y + 20, 420, [140, 35, 28], 0.45);

  // 3. Sandy lake shore (under everything grassy).
  if (vis(LAKE.x - LAKE.rx * 1.5, LAKE.y - LAKE.ry * 1.5, LAKE.x + LAKE.rx * 1.5, LAKE.y + LAKE.ry * 1.5)) paintLake(ctx, x0, y0, x1, y1);

  // 4. Brush dabs + grass blades in 128-unit cells.
  const C = 128;
  for (let cy = Math.floor((y0 - 12) / C); cy <= Math.floor((y1 + 12) / C); cy++) {
    for (let cx = Math.floor((x0 - 12) / C); cx <= Math.floor((x1 + 12) / C); cx++) {
      const pal = PAL[areaAt((cx + 0.5) * C, (cy + 0.5) * C)];
      let rng = cellRng(cx, cy, 2);
      for (let i = 0; i < pal.dabs; i++) {
        const x = (cx + rng()) * C, y = (cy + rng()) * C;
        const rx = rr(rng, 2.5, 8), ry = rr(rng, 1.2, 3), rot = rr(rng, -0.6, 0.6);
        const h = rr(rng, pal.dabH[0], pal.dabH[1]), sat = rr(rng, pal.dabS[0], pal.dabS[1]), l = rr(rng, pal.dabL[0], pal.dabL[1]), a = rr(rng, 0.18, 0.45);
        if (x < x0 - 9 || x > x1 + 9 || y < y0 - 9 || y > y1 + 9) continue;
        if (isSand(x, y)) dab(ctx, x, y, rx, ry, rot, hsl(rr(rng, 36, 46), 40, rr(rng, 70, 84), a));
        else dab(ctx, x, y, rx, ry, rot, hsl(h, sat, l, a));
      }
      rng = cellRng(cx, cy, 3);
      ctx.lineWidth = 1.1;
      for (let i = 0; i < pal.blades; i++) {
        const x = (cx + rng()) * C, y = (cy + rng()) * C;
        const len = rr(rng, 3, 8), lean = rr(rng, -2.5, 2.5);
        const light = rng() < 0.45;
        const hh = light ? rr(rng, pal.lightH[0], pal.lightH[1]) : rr(rng, pal.darkH[0], pal.darkH[1]);
        const ll = light ? rr(rng, pal.lightL[0], pal.lightL[1]) : rr(rng, pal.darkL[0], pal.darkL[1]);
        if (x < x0 - 9 || x > x1 + 9 || y < y0 - 2 || y > y1 + 10) continue;
        if (isSand(x, y) && lakeValue(x, y) < 1.22) continue;
        ctx.strokeStyle = light ? hsl(hh, 60, ll, 0.5) : hsl(hh, 45, ll, 0.45);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len); ctx.stroke();
      }
      // Forest floor: fallen birch leaves + moss.
      if (areaAt((cx + 0.5) * C, (cy + 0.5) * C) === 'forest') {
        rng = cellRng(cx, cy, 4);
        for (let i = 0; i < 22; i++) {
          const x = (cx + rng()) * C, y = (cy + rng()) * C;
          const col = rng() < 0.6 ? hsl(rr(rng, 42, 52), 70, rr(rng, 58, 70), 0.55) : hsl(rr(rng, 140, 165), 30, rr(rng, 22, 30), 0.5);
          if (x > x0 - 6 && x < x1 + 6 && y > y0 - 6 && y < y1 + 6) dab(ctx, x, y, rr(rng, 2, 4), rr(rng, 1.2, 2.2), rng() * 3, col);
        }
      }
    }
  }

  // 5. River.
  paintRiver(ctx, x0, y0, x1, y1);

  // 6. Glade garden patch.
  if (vis(GARDEN.x - 20, GARDEN.y - 20, GARDEN.x + GARDEN.w + 20, GARDEN.y + GARDEN.h + 20)) {
    const { x, y, w, h } = GARDEN;
    const rng = mulberry32(2024);
    blobPath(ctx, x + w / 2, y + h / 2, w / 2 + 6, h / 2 + 6, rng, 0.05);
    ctx.fillStyle = hsl(25, 40, 30, 0.9);
    ctx.fill();
    for (let r = 0; r < 4; r++) {
      const ry = y + 18 + r * (h - 30) / 3;
      ctx.strokeStyle = hsl(28, 45, 40); ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(x + 10, ry); ctx.lineTo(x + w - 10, ry + rr(rng, -2, 2)); ctx.stroke();
      ctx.strokeStyle = hsl(30, 40, 48, 0.6); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x + 12, ry - 3); ctx.lineTo(x + w - 12, ry - 3); ctx.stroke();
    }
  }

  // 7. Dirt paths (only segments near this tile).
  const near = (p: [number, number][]) => p.filter(([px, py]) => px > x0 - 90 && px < x1 + 90 && py > y0 - 90 && py < y1 + 90);
  const strokeRuns = (width: number, style: string, blur = 0) => {
    ctx.save();
    ctx.strokeStyle = style; ctx.lineWidth = width;
    if (blur) { ctx.shadowColor = style; ctx.shadowBlur = blur; }
    for (const p of ALL_PATHS) {
      let started = false;
      ctx.beginPath();
      for (let i = 0; i < p.length; i++) {
        const [px, py] = p[i];
        const inside = px > x0 - 120 && px < x1 + 120 && py > y0 - 120 && py < y1 + 120;
        if (inside) { if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py); }
        else if (started) { ctx.lineTo(px, py); started = false; ctx.stroke(); ctx.beginPath(); }
      }
      if (started) ctx.stroke();
    }
    ctx.restore();
  };
  if (ALL_PATHS.some((p) => near(p).length)) {
    strokeRuns(78, hsl(90, 30, 34, 0.25), 18);
    strokeRuns(62, hsl(36, 38, 56), 6);
    strokeRuns(50, hsl(40, 46, 68));
    ALL_PATHS.forEach((p, pi) => {
      for (let i = 0; i < p.length; i++) {
        const [px, py] = p[i];
        if (px < x0 - 40 || px > x1 + 40 || py < y0 - 40 || py > y1 + 40) continue;
        const rng = mulberry32(hash(pi, i, 9));
        for (let k = 0; k < 7; k++) {
          dab(ctx, px + rr(rng, -24, 24), py + rr(rng, -24, 24), rr(rng, 2, 7), rr(rng, 1, 3), rng() * 3,
            rng() < 0.5 ? hsl(38, 50, rr(rng, 72, 80), 0.5) : hsl(30, 35, rr(rng, 50, 58), 0.35));
        }
        if (rng() < 0.25) {
          const ox = rr(rng, -20, 20), oy = rr(rng, -20, 20);
          dab(ctx, px + ox, py + oy + 1, 2.6, 1.8, 0, hsl(30, 20, 40, 0.5));
          dab(ctx, px + ox, py + oy, 2.4, 1.6, 0, hsl(35, 15, rr(rng, 72, 84)));
        }
        // Grass creeping over the verge.
        const a0 = p[Math.max(0, i - 1)], a1 = p[Math.min(p.length - 1, i + 1)];
        const tl = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) || 1;
        const nx = -(a1[1] - a0[1]) / tl, ny = (a1[0] - a0[0]) / tl;
        ctx.lineWidth = 1.3;
        for (let k = 0; k < 6; k++) {
          const side = rng() < 0.5 ? -1 : 1;
          const d = rr(rng, 20, 30) * side, along = rr(rng, -5, 5);
          const x = px + nx * d + ny * along, y = py + ny * d - nx * along;
          const hh = rr(rng, 80, 110), ll = rr(rng, 38, 60), lx = rr(rng, -2, 2), ly = rr(rng, 3, 7);
          if (pathDist(x, y) < 19) continue;
          ctx.strokeStyle = hsl(hh, 50, ll, 0.8);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + lx, y - ly); ctx.stroke();
        }
      }
    });
  }

  // 8. Stepping stones to the cottage door.
  if (vis(COTTAGE.x - 40, COTTAGE.y, COTTAGE.x + 40, COTTAGE.y + 90)) {
    for (let i = 0; i < 3; i++) {
      const x = COTTAGE.x - 8 + i * 6, y = COTTAGE.y + 22 + i * 22;
      dab(ctx, x, y + 2, 15, 8, 0, hsl(30, 20, 35, 0.4));
      dab(ctx, x, y, 14, 7.5, 0, hsl(40, 12, 76));
      dab(ctx, x - 3, y - 2, 8, 3, 0, hsl(40, 20, 86, 0.6));
    }
  }
  // 9. Shrine flagstones.
  if (vis(SHRINE.x - 160, SHRINE.y - 120, SHRINE.x + 160, SHRINE.y + 120)) {
    const { x, y, r } = SHRINE;
    const rng = mulberry32(31);
    dab(ctx, x, y + 6, r + 10, (r + 10) * 0.62, 0, hsl(150, 30, 15, 0.35));
    dab(ctx, x, y, r, r * 0.6, 0, hsl(200, 10, 62));
    for (let ring = 0; ring < 3; ring++) {
      const rad = r * (0.25 + ring * 0.3), n = 6 + ring * 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring;
        dab(ctx, x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.6, r * 0.13, r * 0.08, a, hsl(rr(rng, 190, 215), 10, rr(rng, 66, 78)));
      }
    }
    for (let i = 0; i < 60; i++) {
      const a = rng() * Math.PI * 2, d = rr(rng, 0.6, 1.0) * r;
      dab(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, rr(rng, 3, 9), rr(rng, 2, 4), rng() * 3, hsl(rr(rng, 85, 110), 45, rr(rng, 35, 48), 0.7));
    }
  }
  // 10. Pond.
  if (vis(POND.x - POND.rx - 60, POND.y - POND.ry - 60, POND.x + POND.rx + 60, POND.y + POND.ry + 60)) paintPond(ctx);

  // 11. Tiny painted flower clusters (512 cells).
  const FC = 512;
  const flowerHues = [[340, 75, 78], [0, 0, 97], [48, 90, 66], [270, 50, 78], [20, 85, 70], [200, 70, 80]];
  for (let cy = Math.floor((y0 - 80) / FC); cy <= Math.floor((y1 + 80) / FC); cy++) {
    for (let cx = Math.floor((x0 - 80) / FC); cx <= Math.floor((x1 + 80) / FC); cx++) {
      const rng = cellRng(cx, cy, 5);
      const nClusters = areaAt((cx + 0.5) * FC, (cy + 0.5) * FC) === 'forest' ? 2 : 6;
      for (let c = 0; c < nClusters; c++) {
        const ccx = (cx + rng()) * FC, ccy = (cy + rng()) * FC;
        const col = flowerHues[Math.floor(rng() * flowerHues.length)];
        const n = 10 + Math.floor(rng() * 25);
        const skip = !vis(ccx - 50, ccy - 35, ccx + 50, ccy + 35) || pondValue(ccx, ccy, 40) < 1 || pathDist(ccx, ccy) < 45 ||
          lakeValue(ccx, ccy) < 1.4 || riverDist(ccx, ccy) < riverHalfAt(ccy) + 40 || (ccy < 330 && ccx < GLADE_W);
        for (let i = 0; i < n; i++) {
          const x = ccx + rr(rng, -45, 45), y = ccy + rr(rng, -30, 30);
          const dh = rr(rng, -8, 8);
          if (skip) continue;
          dab(ctx, x, y + 1.2, 2.2, 1.4, 0, hsl(120, 40, 25, 0.5));
          dab(ctx, x, y, 1.9, 1.6, 0, hsl(col[0] + dh, col[1], col[2]));
          dab(ctx, x - 0.4, y - 0.5, 0.8, 0.6, 0, hsl(55, 100, 90, 0.9));
        }
      }
    }
  }
  // Pier shadow on the water.
  if (vis(PIER.x - 60, PIER.y0 - 10, PIER.x + 60, PIER.y1 + 30)) dab(ctx, PIER.x + 10, (PIER.y0 + PIER.y1) / 2 + 14, PIER.w + 6, (PIER.y1 - PIER.y0) / 2, 0, 'rgba(10,30,50,0.25)');
  ctx.restore();
}

function waterGradientFill(ctx: Ctx, x: number, y: number, r: number) {
  const wg = ctx.createRadialGradient(x + 20, y + 20, 10, x, y, r);
  wg.addColorStop(0, hsl(205, 58, 34));
  wg.addColorStop(0.55, hsl(190, 55, 44));
  wg.addColorStop(1, hsl(170, 48, 58));
  return wg;
}

function paintPond(ctx: Ctx) {
  const { x, y, rx, ry } = POND;
  const prng = mulberry32(77);
  ctx.save();
  ctx.shadowColor = hsl(100, 40, 20, 0.6); ctx.shadowBlur = 20;
  blob(ctx, x, y + 6, rx + 22, ry + 18, hsl(80, 35, 38), prng, 0.08);
  ctx.restore();
  blob(ctx, x, y + 2, rx + 9, ry + 7, hsl(42, 40, 66), mulberry32(77), 0.08);
  blob(ctx, x, y + 2, rx + 4, ry + 4, hsl(35, 32, 46), mulberry32(77), 0.08);
  ctx.save();
  blobPath(ctx, x, y, rx, ry, mulberry32(77), 0.08);
  ctx.clip();
  ctx.fillStyle = waterGradientFill(ctx, x, y, rx);
  ctx.fillRect(x - rx - 20, y - ry - 20, rx * 2 + 40, ry * 2 + 40);
  softCircle(ctx, x - rx * 0.35, y - ry * 0.25, rx * 0.6, [45, 80, 85], 0.25);
  softCircle(ctx, x + rx * 0.3, y + ry * 0.2, rx * 0.5, [190, 70, 75], 0.2);
  ctx.lineWidth = 26; ctx.strokeStyle = hsl(200, 50, 20, 0.35); ctx.filter = 'blur(6px)';
  blobPath(ctx, x, y + 12, rx, ry, mulberry32(77), 0.08);
  ctx.stroke(); ctx.filter = 'none';
  for (let i = 0; i < 260; i++) {
    const px = x + rr(prng, -rx, rx), py = y + rr(prng, -ry, ry);
    const len = rr(prng, 6, 22), light = prng() < 0.6, ll = rr(prng, 62, 80), aa = rr(prng, 0.15, 0.4), lw = rr(prng, 1, 2.5);
    if (pondValue(px, py) > 0.9) continue;
    ctx.strokeStyle = light ? hsl(185, 60, ll, aa) : hsl(210, 55, 28, 0.25);
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(px - len, py); ctx.quadraticCurveTo(px, py - 2, px + len, py); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = hsl(50, 60, 88, 0.55);
  blobPath(ctx, x, y, rx, ry, mulberry32(77), 0.08);
  ctx.stroke();
  for (let i = 0; i < 900; i++) {
    const a = prng() * Math.PI * 2, k = 1.02 + prng() * 0.1;
    const wob = 1 + Math.sin(a * 3 + 1.3) * 0.05 + Math.sin(a * 5 + 0.4) * 0.03;
    const gx = x + Math.cos(a) * (rx + 4) * k * wob, gy = y + 3 + Math.sin(a) * (ry + 4) * k * wob;
    if (prng() < 0.35) dab(ctx, gx, gy, rr(prng, 2, 6), rr(prng, 1.2, 3), prng() * 3, hsl(rr(prng, 85, 120), 45, rr(prng, 32, 52), 0.85));
    else {
      ctx.strokeStyle = hsl(rr(prng, 80, 115), 50, rr(prng, 36, 62), 0.9); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + rr(prng, -2, 2), gy - rr(prng, 3, 8)); ctx.stroke();
    }
  }
}

function lakeShape(ctx: Ctx | Path2D, scale: number, dy = 0) {
  const n = 96;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 + 0.06 * Math.sin(3 * a + 1) + 0.04 * Math.sin(5 * a + 2) + 0.025 * Math.sin(9 * a + 0.5);
    const x = LAKE.x + Math.cos(a) * LAKE.rx * w * scale, y = LAKE.y + dy + Math.sin(a) * LAKE.ry * w * scale;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}

function paintLake(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  // Sand beach ring.
  ctx.save();
  ctx.globalAlpha = 0.35; ctx.beginPath(); lakeShape(ctx, sandLimit + 0.03); ctx.fillStyle = hsl(42, 45, 74); ctx.fill();
  ctx.globalAlpha = 0.6; ctx.beginPath(); lakeShape(ctx, sandLimit - 0.02); ctx.fill();
  ctx.globalAlpha = 1; ctx.beginPath(); lakeShape(ctx, sandLimit - 0.08); ctx.fill();
  ctx.beginPath(); lakeShape(ctx, 1.12);
  ctx.fillStyle = hsl(40, 42, 70); ctx.fill();
  ctx.beginPath(); lakeShape(ctx, 1.03);
  ctx.fillStyle = hsl(36, 32, 58); ctx.fill(); // wet sand
  ctx.restore();
  // Water.
  ctx.save();
  ctx.beginPath(); lakeShape(ctx, 1);
  ctx.clip();
  const g = ctx.createRadialGradient(LAKE.x, LAKE.y + 40, 30, LAKE.x, LAKE.y, LAKE.rx);
  g.addColorStop(0, hsl(208, 60, 30)); g.addColorStop(0.6, hsl(195, 56, 42)); g.addColorStop(1, hsl(175, 50, 60));
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  softCircle(ctx, LAKE.x - 220, LAKE.y - 100, 300, [45, 80, 85], 0.18);
  softCircle(ctx, LAKE.x + 260, LAKE.y + 60, 260, [200, 70, 78], 0.18);
  // Shallow lighter rim.
  for (const [lw, a] of [[56, 0.12], [36, 0.16], [18, 0.2]]) {
    ctx.lineWidth = lw; ctx.strokeStyle = hsl(170, 50, 66, a);
    ctx.beginPath(); lakeShape(ctx, 1); ctx.stroke();
  }
  // Ripple strokes (cell based).
  const C = 128;
  for (let cy = Math.floor(y0 / C); cy <= Math.floor(y1 / C); cy++) for (let cx = Math.floor(x0 / C); cx <= Math.floor(x1 / C); cx++) {
    const rng = cellRng(cx, cy, 11);
    for (let i = 0; i < 9; i++) {
      const px = (cx + rng()) * C, py = (cy + rng()) * C, len = rr(rng, 8, 26), light = rng() < 0.6, ll = rr(rng, 62, 80), aa = rr(rng, 0.15, 0.35);
      if (lakeValue(px, py) > 0.95) continue;
      ctx.strokeStyle = light ? hsl(185, 60, ll, aa) : hsl(210, 55, 26, 0.22); ctx.lineWidth = rr(rng, 1, 2.5);
      ctx.beginPath(); ctx.moveTo(px - len, py); ctx.quadraticCurveTo(px, py - 2, px + len, py); ctx.stroke();
    }
  }
  ctx.restore();
  // Foam line.
  ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,252,240,0.6)';
  ctx.beginPath(); lakeShape(ctx, 1.005); ctx.stroke();
}

function paintRiver(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const pts = RIVER.filter(([x, y]) => x > x0 - 160 && x < x1 + 160 && y > y0 - 160 && y < y1 + 160);
  if (!pts.length) return;
  const i0 = Math.max(0, RIVER.indexOf(pts[0]) - 2);
  const i1 = Math.min(RIVER.length - 1, RIVER.indexOf(pts[pts.length - 1]) + 2);
  const seg = RIVER.slice(i0, i1 + 1);
  // Chunked polylines (width sampled per chunk); no canvas filters, they are very slow per tile.
  const stroke = (w: (y: number) => number, style: string, soft = 0) => {
    ctx.save();
    ctx.strokeStyle = style; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const passes = soft ? [[soft, 0.35], [soft * 0.5, 0.5], [0, 1]] : [[0, 1]];
    for (const [extra, alpha] of passes) {
      ctx.globalAlpha = alpha;
      for (let i = 0; i < seg.length - 1; i += 6) {
        const end = Math.min(seg.length - 1, i + 7);
        ctx.lineWidth = (w(seg[Math.floor((i + end) / 2)][1]) + extra) * 2;
        ctx.beginPath(); ctx.moveTo(seg[i][0], seg[i][1]);
        for (let k = i + 1; k <= end; k++) ctx.lineTo(seg[k][0], seg[k][1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  stroke((y) => riverHalfAt(y) + 30, hsl(95, 40, 30, 0.6), 8); // lush bank shadow
  stroke((y) => riverHalfAt(y) + 10, hsl(40, 38, 62)); // pebbly bank
  stroke((y) => riverHalfAt(y) + 3, hsl(34, 30, 46));
  stroke((y) => riverHalfAt(y) - 2, hsl(178, 46, 54));
  stroke((y) => riverHalfAt(y) - 16, hsl(192, 54, 42), 4);
  stroke((y) => riverHalfAt(y) * 0.45, hsl(205, 58, 34), 6);
  // Flow strokes + bank pebbles.
  for (let i = i0; i <= i1; i++) {
    const [px, py] = RIVER[i];
    const a = RIVER[Math.max(0, i - 1)], b = RIVER[Math.min(RIVER.length - 1, i + 1)];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / tl, ty = (b[1] - a[1]) / tl, nx = -ty, ny = tx;
    const rng = mulberry32(hash(i, 3, 17));
    const half = riverHalfAt(py);
    for (let k = 0; k < 3; k++) {
      const o = rr(rng, -half + 12, half - 12), len = rr(rng, 8, 22), light = rng() < 0.6, ll = rr(rng, 62, 82), aa = rr(rng, 0.2, 0.45);
      const cx = px + nx * o, cy = py + ny * o;
      ctx.strokeStyle = light ? hsl(185, 60, ll, aa) : hsl(210, 55, 26, 0.25); ctx.lineWidth = rr(rng, 1, 2.2);
      ctx.beginPath(); ctx.moveTo(cx - tx * len, cy - ty * len); ctx.quadraticCurveTo(cx + nx * 2, cy + ny * 2, cx + tx * len, cy + ty * len); ctx.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const side = rng() < 0.5 ? -1 : 1, o = side * (half + rr(rng, 2, 12));
      dab(ctx, px + nx * o, py + ny * o, rr(rng, 1.6, 3.6), rr(rng, 1.2, 2.4), rng() * 3, hsl(35, rr(rng, 5, 20), rr(rng, 62, 84)));
    }
  }
}

// ------------------------------------------------------------------ streaming manager
export class GroundStreamer {
  tiles = new Map<string, { img: Phaser.GameObjects.Image; key: string }>();
  painted = 0;
  constructor(private scene: Phaser.Scene) {}

  paintMs: number[] = [];
  private paint(tx: number, ty: number) {
    const t0 = performance.now();
    const key = `ground_${tx}_${ty}`;
    const px = Math.ceil(TILE * GS) + 2; // 1px overlap on each side hides seams
    const canvas = document.createElement('canvas');
    canvas.width = px; canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.translate(1, 1);
    ctx.scale(GS, GS);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    paintGroundTile(ctx, tx * TILE, ty * TILE, TILE);
    ctx.restore();
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.textures.addImage(key, canvas as unknown as HTMLImageElement);
    canvas.width = 1; canvas.height = 1; // release the CPU copy (Safari counts canvas memory)
    const img = this.scene.add.image(tx * TILE - 1 / GS, ty * TILE - 1 / GS, key).setOrigin(0, 0).setScale(1 / GS).setDepth(-1000);
    this.tiles.set(`${tx},${ty}`, { img, key });
    this.painted++;
    this.paintMs.push(Math.round(performance.now() - t0));
    if (this.paintMs.length > 40) this.paintMs.shift();
  }

  /** Ensure tiles around the view exist (painting at most `budget` per call); free distant ones. */
  update(view: Phaser.Geom.Rectangle, budget = 1) {
    const m = 160;
    const tx0 = Math.max(0, Math.floor((view.x - m) / TILE)), tx1 = Math.min(Math.ceil(WORLD_W / TILE) - 1, Math.floor((view.right + m) / TILE));
    const ty0 = Math.max(0, Math.floor((view.y - m) / TILE)), ty1 = Math.min(Math.ceil(WORLD_H / TILE) - 1, Math.floor((view.bottom + m) / TILE));
    const cx = view.centerX / TILE, cy = view.centerY / TILE;
    const need: [number, number, number][] = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!this.tiles.has(`${tx},${ty}`)) need.push([tx, ty, (tx + 0.5 - cx) ** 2 + (ty + 0.5 - cy) ** 2]);
    }
    need.sort((a, b) => a[2] - b[2]);
    for (let i = 0; i < Math.min(budget, need.length); i++) this.paint(need[i][0], need[i][1]);
    // Free tiles well outside the view (hysteresis of one extra tile).
    for (const [k, t] of this.tiles) {
      const [tx, ty] = k.split(',').map(Number);
      if (tx < tx0 - 1 || tx > tx1 + 1 || ty < ty0 - 1 || ty > ty1 + 1) {
        t.img.destroy();
        this.scene.textures.remove(t.key);
        this.tiles.delete(k);
      }
    }
    return need.length - Math.min(budget, need.length);
  }
}
