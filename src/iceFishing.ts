// 11.5b Winter frozen pond + ice fishing (Walker, Oct 23: "yes on the ice fishing").
// In Winter the pond and the lake freeze over: a bold, crisp sheet of ice with cracks, snow drifts on
// the edges and twinkles. The rowboats are put away for the season. Tap the ice (or press Fish on the
// shore) and the hero chips a little round hole, then fishes through it with the usual fishing flow.
// The river keeps flowing, so normal fishing still works there. Other themes are unchanged.
import Phaser from 'phaser';
import { ATLAS, blobPath, mulberry32, type Ctx, type Rng } from './art';
import { sfx } from './audio';
import { waterAt, type WaterId } from './geo';
import { POND, LAKE } from './layout';
import { theme, themeEvents } from './theme';
import type { WorldScene } from './scenes/World';

export type IceWater = Extract<WaterId, 'pond' | 'lake'>;
type Hole = { water: IceWater; x: number; y: number; img: Phaser.GameObjects.Image; t: number };

const RES = 1.5;            // texture pixels per world unit (crisp on iPad)
const PAD = 46;             // room around the water for the snow drifts
const INK = '#3f7fae';      // bold outline / crack colour
const MAX_HOLES = 5;
const HOLE_SNAP = 34;       // a tap this close to a hole fishes in it instead of cutting a new one

const lakeWob = (a: number) => 1 + 0.06 * Math.sin(3 * a + 1) + 0.04 * Math.sin(5 * a + 2) + 0.025 * Math.sin(9 * a + 0.5);

/** The water outline in texture space (same shape as the painted pond / lake). */
function shape(ctx: Ctx, water: IceWater, ox: number, oy: number, grow = 0) {
  if (water === 'pond') { blobPath(ctx, POND.x - ox, POND.y - oy, POND.rx + grow, POND.ry + grow, mulberry32(77), 0.08); return; }
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2, w = lakeWob(a);
    const x = LAKE.x - ox + Math.cos(a) * (LAKE.rx * w + grow), y = LAKE.y - oy + Math.sin(a) * (LAKE.ry * w + grow);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
/** A point on the rim at angle a (texture space). */
function rim(water: IceWater, a: number, ox: number, oy: number): [number, number] {
  if (water === 'lake') { const w = lakeWob(a); return [LAKE.x - ox + Math.cos(a) * LAKE.rx * w, LAKE.y - oy + Math.sin(a) * LAKE.ry * w]; }
  return [POND.x - ox + Math.cos(a) * POND.rx * 1.02, POND.y - oy + Math.sin(a) * POND.ry * 1.02];
}

function star(g: Ctx, x: number, y: number, r: number) {
  g.beginPath();
  g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

function crack(g: Ctx, rng: Rng, x: number, y: number, a: number, len: number, depth: number) {
  const pts: [number, number][] = [[x, y]];
  let cx = x, cy = y;
  const n = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) { a += (rng() - 0.5) * 0.9; cx += Math.cos(a) * len / n; cy += Math.sin(a) * len / n * 0.7; pts.push([cx, cy]); }
  const line = (w: number, col: string, dx: number, dy: number) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy))); g.stroke();
  };
  line(3.2 * RES * (depth ? 0.7 : 1), INK, 0, 0);
  line(1.3 * RES, 'rgba(255,255,255,0.95)', 1.2 * RES, 1.2 * RES);
  if (depth < 1) for (let i = 1; i < pts.length - 1; i++) if (rng() < 0.35) crack(g, rng, pts[i][0], pts[i][1], a + (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.6), len * 0.45, depth + 1);
}

/** Paint the ice sheet for one body of water into a canvas texture. Coordinates are world units * RES. */
function paintIce(scene: Phaser.Scene, water: IceWater) {
  const key = `ice_${water}`;
  if (scene.textures.exists(key)) return key;
  const B = water === 'pond' ? POND : LAKE;
  const ow = (B.rx * 1.12 + PAD) * 2, oh = (B.ry * 1.12 + PAD) * 2;
  const tex = scene.textures.createCanvas(key, Math.ceil(ow * RES), Math.ceil(oh * RES))!;
  const g = tex.getContext();
  g.scale(RES, RES);
  const ox = B.x - ow / 2, oy = B.y - oh / 2;
  const cx = B.x - ox, cy = B.y - oy;
  const rng = mulberry32(water === 'pond' ? 1105 : 2205);
  // Soft blue shadow just outside the edge so the ice sits down into the bank.
  g.save(); g.shadowColor = 'rgba(40,90,140,0.45)'; g.shadowBlur = 16; g.shadowOffsetY = 5;
  shape(g, water, ox, oy, 3); g.fillStyle = '#cfe9f8'; g.fill(); g.restore();
  // The ice: a cool gradient with lighter patches.
  g.save(); shape(g, water, ox, oy); g.clip();
  const lg = g.createLinearGradient(0, cy - B.ry, 0, cy + B.ry);
  lg.addColorStop(0, '#eefaff'); lg.addColorStop(0.45, '#c6e8fa'); lg.addColorStop(1, '#93c9ea');
  g.fillStyle = lg; g.fillRect(0, 0, ow, oh);
  for (let i = 0; i < 9; i++) {
    const px = cx + (rng() * 2 - 1) * B.rx * 0.8, py = cy + (rng() * 2 - 1) * B.ry * 0.7, r = (0.18 + rng() * 0.22) * B.rx;
    const rg = g.createRadialGradient(px, py, 0, px, py, r);
    const c = rng() < 0.5 ? '255,255,255' : '160,210,240';
    rg.addColorStop(0, `rgba(${c},0.45)`); rg.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = rg; g.beginPath(); g.ellipse(px, py, r, r * 0.6, 0, 0, Math.PI * 2); g.fill();
  }
  // Inner rim shade for depth.
  g.lineWidth = 22; g.strokeStyle = 'rgba(70,130,185,0.28)'; g.filter = 'blur(7px)';
  shape(g, water, ox, oy - 8); g.stroke(); g.filter = 'none';
  // Glossy diagonal shine bands.
  g.save(); g.rotate(-0.5);
  for (let i = 0; i < (water === 'pond' ? 3 : 6); i++) {
    const bx = (cx * 0.6) + (i - 1) * (water === 'pond' ? 150 : 260) + rng() * 30, w0 = 14 + rng() * 18;
    g.fillStyle = 'rgba(255,255,255,0.34)'; g.fillRect(bx, -oh, w0, oh * 3);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(bx + w0 + 8, -oh, w0 * 0.4, oh * 3);
  }
  g.restore();
  // Frozen bubbles.
  for (let i = 0; i < (water === 'pond' ? 18 : 40); i++) {
    const px = cx + (rng() * 2 - 1) * B.rx * 0.85, py = cy + (rng() * 2 - 1) * B.ry * 0.75, r = 2 + rng() * 4;
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px - r * 0.35, py - r * 0.35, r * 0.3, 0, Math.PI * 2); g.fill();
  }
  // Bold cracks fanning out from a few spots.
  g.save(); g.scale(1 / RES, 1 / RES);
  const nC = water === 'pond' ? 3 : 6;
  for (let i = 0; i < nC; i++) {
    const px = (cx + (rng() * 2 - 1) * B.rx * 0.55) * RES, py = (cy + (rng() * 2 - 1) * B.ry * 0.45) * RES;
    const arms = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < arms; k++) crack(g, rng, px, py, (k / arms) * Math.PI * 2 + rng() * 0.6, (55 + rng() * 60) * RES, 0);
  }
  g.restore();
  // Painted sparkles.
  g.fillStyle = '#ffffff';
  for (let i = 0; i < (water === 'pond' ? 14 : 30); i++) star(g, cx + (rng() * 2 - 1) * B.rx * 0.85, cy + (rng() * 2 - 1) * B.ry * 0.75, 3 + rng() * 6);
  g.restore();
  // Crisp outline.
  g.lineWidth = 3.5; g.strokeStyle = INK; shape(g, water, ox, oy); g.stroke();
  g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,255,255,0.9)'; shape(g, water, ox, oy, -4); g.stroke();
  // Snow drifts heaped along the edge (thicker on the far bank so the front stays readable).
  const n = water === 'pond' ? 46 : 110;
  const drifts: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.08;
    if (Math.sin(a) > 0.25 && rng() < 0.55) continue; // fewer on the near edge
    const [px, py] = rim(water, a, ox, oy);
    const r = (water === 'pond' ? 13 : 18) + rng() * 14;
    drifts.push([px + Math.cos(a) * r * 0.25, py + Math.sin(a) * r * 0.2, r, r * (0.48 + rng() * 0.15)]);
  }
  for (const [px, py, rx, ry] of drifts) { g.fillStyle = 'rgba(70,120,170,0.35)'; g.beginPath(); g.ellipse(px + 2, py + 4, rx + 2, ry + 1, 0, 0, Math.PI * 2); g.fill(); }
  for (const [px, py, rx, ry] of drifts) { g.fillStyle = '#d6ebf8'; g.beginPath(); g.ellipse(px, py + 1.5, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  for (const [px, py, rx, ry] of drifts) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(px - rx * 0.08, py - ry * 0.15, rx * 0.88, ry * 0.78, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ffffff';
  for (let i = 0; i < drifts.length; i += 3) { const [px, py, rx, ry] = drifts[i]; star(g, px + rx * 0.3, py - ry * 0.5, 3.2); }
  tex.refresh();
  return key;
}

/** A round ice-fishing hole: snowy rim, chunky chips, deep blue water. */
function paintHole(scene: Phaser.Scene) {
  if (scene.textures.exists('ice_hole')) return;
  const W = 84, H = 50, k = 2;
  const tex = scene.textures.createCanvas('ice_hole', W * k, H * k)!;
  const g = tex.getContext();
  g.scale(k, k);
  const cx = W / 2, cy = H / 2;
  g.fillStyle = 'rgba(60,110,160,0.35)'; g.beginPath(); g.ellipse(cx + 1, cy + 4, 36, 18, 0, 0, Math.PI * 2); g.fill();
  // Chips around the rim.
  const rng = mulberry32(42);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng() * 0.3, r = 31 + rng() * 5;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.5;
    g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(px - 5, py + 2); g.lineTo(px - 1, py - 4); g.lineTo(px + 5, py - 1); g.lineTo(px + 3, py + 3); g.closePath(); g.fill(); g.stroke();
  }
  g.fillStyle = '#f4fbff'; g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.ellipse(cx, cy, 30, 15, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  const wg = g.createRadialGradient(cx, cy + 3, 2, cx, cy, 22);
  wg.addColorStop(0, '#0f3a66'); wg.addColorStop(0.7, '#1d5f96'); wg.addColorStop(1, '#3d8cc4');
  g.fillStyle = wg; g.beginPath(); g.ellipse(cx, cy + 1.5, 21, 10, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 2; g.strokeStyle = '#2a5f8a'; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.6;
  g.beginPath(); g.ellipse(cx - 4, cy - 1, 11, 3.5, 0, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
  tex.refresh();
}

export class FrozenWater {
  frozen = false;
  ice: Partial<Record<IceWater, Phaser.GameObjects.Image>> = {};
  twinkles: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  holes: Hole[] = [];
  cuts = 0;
  catches = 0;
  cutting = false;

  constructor(private w: WorldScene) {
    const on = () => this.apply();
    themeEvents.on('change', on);
    w.events.once('shutdown', () => themeEvents.off('change', on));
    this.apply();
  }

  /** Is this body of water frozen right now? (Winter pond and lake; the river keeps flowing.) */
  isFrozen(wa: WaterId | null): wa is IceWater { return this.frozen && (wa === 'pond' || wa === 'lake'); }

  private build() {
    if (this.ice.pond) return;
    const w = this.w;
    paintHole(w);
    for (const water of ['pond', 'lake'] as IceWater[]) {
      const B = water === 'pond' ? POND : LAKE;
      const key = paintIce(w, water);
      this.ice[water] = w.add.image(B.x, B.y, key).setScale(1 / RES).setDepth(-386).setVisible(false);
      const tw = w.add.particles(0, 0, ATLAS, {
        frame: 'spark',
        emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(B.x, B.y, B.rx * 1.5, B.ry * 1.4) as any },
        lifespan: { min: 700, max: 1500 }, frequency: water === 'pond' ? 140 : 90,
        scale: { values: [0.04, 0.32, 0.04] }, alpha: { values: [0, 1, 0] }, tint: [0xffffff, 0xdff4ff, 0xbfe8ff],
      } as any).setDepth(-383);
      tw.stop();
      this.twinkles.push(tw);
    }
  }

  apply() {
    const was = this.frozen;
    this.frozen = theme.id === 'winter';
    if (this.frozen) this.build();
    for (const img of Object.values(this.ice)) img?.setVisible(this.frozen);
    for (const t of this.twinkles) { if (this.frozen) t.start(); else t.stop(); }
    for (const l of this.w.lilies ?? []) l.setVisible(!this.frozen);
    this.w.pondGlints?.setVisible(!this.frozen);
    if (was && !this.frozen) {
      // Thawed: holes melt away, and a line through the ice comes back in.
      for (const h of this.holes) h.img.destroy();
      this.holes = [];
      if (this.w.fishing?.iceHole) this.w.fishing.cancel();
    }
    this.w.boat?.setSeason(!this.frozen);
  }

  holeNear(x: number, y: number, r = HOLE_SNAP) {
    let best: Hole | null = null, bd = r;
    for (const h of this.holes) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } }
    return best;
  }

  /** Nudge a point on the ice in from the edge so a hole fits (toward the middle of that water). */
  snapInside(water: IceWater, x: number, y: number): [number, number] {
    const B = water === 'pond' ? POND : LAKE;
    const d = Math.hypot(B.x - x, B.y - y) || 1;
    for (let k = 0; k < 30 && waterAt(x, y, 22) !== water; k++) { x += (B.x - x) / d * 6; y += (B.y - y) / d * 6; }
    return [x, y];
  }

  /** Chip a new hole at (x, y): chip-chip sounds and flying ice, then a plink as it opens. */
  cutHole(water: IceWater, x: number, y: number, done: () => void) {
    const w = this.w;
    this.cutting = true;
    const img = w.add.image(x, y, 'ice_hole').setScale(0).setDepth(-384);
    const hole: Hole = { water, x, y, img, t: w.time.now };
    w.floatText(x, y - 30, 'Chip, chip!', '#e6f4ff');
    for (let i = 0; i < 3; i++) {
      w.time.delayedCall(i * 150, () => {
        sfx.iceChip();
        w.burst(x + (Math.random() - 0.5) * 20, y - 4, 0xe6f6ff, 7, 'dot');
        img.setScale(0.5 * (0.25 + i * 0.22));
      });
    }
    w.time.delayedCall(470, () => {
      this.cutting = false;
      w.tweens.add({ targets: img, scale: 0.5, duration: 260, ease: 'Back.easeOut' });
      sfx.icePlink();
      w.burst(x, y - 6, 0xffffff, 10, 'p_snow');
      w.life.ripple(x, y + 1, 0.06, 0.3, 0.6, 700);
      this.holes.push(hole);
      this.cuts++;
      // Only a few at a time: the oldest one freezes over again.
      while (this.holes.length > MAX_HOLES) {
        const old = this.holes.shift()!;
        w.tweens.add({ targets: old.img, alpha: 0, scale: 0.2, duration: 600, onComplete: () => old.img.destroy() });
      }
      done();
    });
  }

  snapshot() {
    const r = Math.round;
    return {
      frozen: this.frozen, cuts: this.cuts, catches: this.catches, cutting: this.cutting,
      ice: Object.fromEntries(Object.entries(this.ice).map(([k, v]) => [k, !!v?.visible])),
      lilies: (this.w.lilies ?? []).filter((l) => l.visible).length,
      holes: this.holes.map((h) => ({ water: h.water, x: r(h.x), y: r(h.y) })),
    };
  }
}
