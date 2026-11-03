// The painted paper map of the whole world (Map tab, and 65's fly-travel map). Unvisited areas stay misty.
import { WORLD_W, WORLD_H, AreaId, BRIDGES, PIER } from './layout';
import { areaAt, waterAt, lakeValue } from './geo';
import { ALL_PATHS } from './art';
import { save } from './save';

/** Paint the world into a px x ph canvas context. */
export function paintWorldMap(c: CanvasRenderingContext2D, px: number, ph: number) {
  const k = px / WORLD_W;
  const cols: Record<AreaId, string> = { glade: '#a3c26e', river: '#9cc47f', forest: '#83a57c', orchard: '#c8c477', lake: '#a9c77e', village: '#b3cf7c',
    meadow: '#cfcf6e', hills: '#9db07a', grove: '#6f9a86', bay: '#b2cc86' };
  // Sample the world coarsely into a tiny canvas, then upscale with smoothing for soft painted edges.
  const cell = 40; // 64: the world is 4x bigger, so sample coarser (same cost as before)
  const cw = Math.ceil(WORLD_W / cell), chh = Math.ceil(WORLD_H / cell);
  const lo = document.createElement('canvas'); lo.width = cw; lo.height = chh;
  const lc = lo.getContext('2d')!;
  const fog = document.createElement('canvas'); fog.width = cw; fog.height = chh;
  const fc = fog.getContext('2d')!;
  fc.fillStyle = 'rgba(236,220,186,0.94)';
  for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
    const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
    const ar = areaAt(cx, cy);
    const wa = waterAt(cx, cy);
    const lake = (ar === 'lake' || ar === 'bay' || ar === 'grove') && !wa ? lakeValue(cx, cy) : 9;
    lc.fillStyle = wa ? '#6fb0c8' : lake < 1.3 ? '#e8d6a6' : cols[ar];
    lc.fillRect(i, j, 1, 1);
    if (!save.visited.includes(ar)) fc.fillRect(i, j, 1, 1);
  }
  // Parchment base so the painted land sits on paper.
  c.fillStyle = '#efdfb8'; c.fillRect(0, 0, px, ph);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  const blur = Math.max(2, Math.round((cell * k) / 2.2));
  c.filter = `blur(${blur}px)`; c.globalAlpha = 0.92; c.drawImage(lo, 0, 0, px, ph); c.globalAlpha = 1; c.filter = 'none';
  // Inked coast lines: a darker halo just inside the water.
  c.strokeStyle = '#e9d3a6'; c.lineWidth = 26 * k; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const p of ALL_PATHS) { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k))); c.stroke(); }
  // Dotted trail ink down the middle of each path.
  c.strokeStyle = 'rgba(122,82,48,0.55)'; c.lineWidth = Math.max(1.5, 5 * k); c.setLineDash([10 * k * 2, 14 * k * 2]);
  for (const p of ALL_PATHS) { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k))); c.stroke(); }
  c.setLineDash([]);
  c.fillStyle = '#9b7146';
  for (const b of Object.values(BRIDGES)) c.fillRect((b.x - b.half) * k, (b.y - 20) * k, b.half * 2 * k, 40 * k);
  c.fillRect((PIER.x - 20) * k, PIER.y0 * k, 40 * k, (PIER.y1 - PIER.y0) * k);
  // Little inked trees in the forest and orchard, waves on the water (deterministic scatter).
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let n = 0; n < 2400; n++) {
    const wx = rnd() * WORLD_W, wy = rnd() * WORLD_H, ar = areaAt(wx, wy);
    if (!save.visited.includes(ar)) continue;
    if (waterAt(wx, wy)) {
      if (rnd() < 0.25) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = Math.max(1.2, 4 * k); c.beginPath(); c.arc(wx * k, wy * k, 14 * k * 2, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    } else if ((ar === 'forest' && rnd() < 0.5) || (ar === 'orchard' && rnd() < 0.18) || (ar === 'hills' && rnd() < 0.3) || (ar === 'grove' && rnd() < 0.35) || (ar === 'meadow' && rnd() < 0.12)) {
      const r = (ar === 'forest' || ar === 'hills' || ar === 'grove' ? 26 : 20) * k * 2;
      c.fillStyle = ar === 'forest' || ar === 'hills' ? 'rgba(74,112,72,0.75)' : ar === 'grove' ? 'rgba(150,96,170,0.7)' : ar === 'meadow' ? 'rgba(232,190,50,0.8)' : 'rgba(150,150,70,0.7)';
      c.beginPath(); c.arc(wx * k, wy * k, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(70,50,32,0.5)'; c.lineWidth = Math.max(1, 2.5 * k); c.stroke();
    }
  }
  // Unvisited areas stay misty.
  c.filter = `blur(${blur}px)`; c.drawImage(fog, 0, 0, px, ph); c.filter = 'none';
  // Aged paper: burnt, darker edges.
  const vg = c.createRadialGradient(px / 2, ph / 2, Math.min(px, ph) * 0.35, px / 2, ph / 2, Math.hypot(px, ph) * 0.56);
  vg.addColorStop(0, 'rgba(120,80,40,0)'); vg.addColorStop(1, 'rgba(120,76,36,0.42)');
  c.fillStyle = vg; c.fillRect(0, 0, px, ph);
  lo.width = lo.height = fog.width = fog.height = 1;
}
