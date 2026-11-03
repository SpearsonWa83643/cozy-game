// 64: the four new regions around the original map (which is the top-left OLD_W x OLD_H quarter).
//   Sunflower Meadow (north-east, past Mistbirch Wood), Pinecone Hills (east of the orchard),
//   Glowcap Grove (south of the orchard + Shellwater beach), Seashell Bay (south-east).
// The meadow sits behind the wood's locked bridge gate (a hedge keeps it apart from the hills), so
// the gate still matters. All placement is deterministic.
import { mulberry32, pathDist } from './art';
import {
  WORLD_W, WORLD_H, OLD_W, OLD_H, FOREST_EDGE_Y, BAY, HIVES, LIGHTHOUSE, CAIRNS, GROVE_RING, PUZZLE_SITES,
} from './layout';
import { lakeValue, lakeValueOf, waterAt } from './geo';
import { sfx } from './audio';
import type { WorldScene } from './scenes/World';

type Rng = () => number;
type TreeKind = Parameters<WorldScene['reacts']['tree']>[1];
export type RegionHelpers = {
  tree: (x: number, y: number, key: string, scale: number, rng: Rng, kind: TreeKind, solid?: boolean) => Phaser.GameObjects.Image;
  bush: (x: number, y: number, rng: Rng) => void;
  rock: (x: number, y: number, v: number) => void;
  tuft: (x: number, y: number, key: string, rng: Rng, amp?: number) => Phaser.GameObjects.Image;
  flowerClump: (x: number, y: number, rng: Rng, n?: number) => void;
  scatter: (rng: Rng, x0: number, y0: number, x1: number, y1: number, n: number, minD: number, pad: number, fn: (x: number, y: number) => void) => void;
  free: (x: number, y: number, pad: number) => boolean;
};

/** A soft bounce + sparkle when a prop is tapped (kid-simple: everything answers a tap). */
function bouncy(w: WorldScene, o: Phaser.GameObjects.Image, sound: () => void, col: number, r = 50) {
  const sx = o.scaleX, sy = o.scaleY;
  w.tappables.push({
    x: () => o.x, y: () => o.y - o.displayHeight * 0.5, r,
    tap: () => {
      sound();
      w.life.reactions++;
      w.tweens.killTweensOf(o);
      o.setScale(sx, sy);
      w.tweens.add({ targets: o, scaleX: sx * 1.12, scaleY: sy * 0.86, duration: 110, yoyo: true, ease: 'Sine.easeOut',
        onComplete: () => w.tweens.add({ targets: o, scaleY: sy * 1.08, duration: 120, yoyo: true }) });
      w.burst(o.x, o.y - o.displayHeight * 0.6, col, 8, 'spark');
    },
  });
}

export function buildRegions(w: WorldScene, H: RegionHelpers) {
  const { tree, bush, rock, tuft, flowerClump, scatter, free } = H;
  const E = OLD_W, S0 = OLD_H;
  const glows: Phaser.GameObjects.Image[] = [];

  // ---------------------------------------------------------------- world rims (east + south + the new north/west stretches)
  {
    const rng = mulberry32(1501);
    for (let x = E - 40; x < WORLD_W + 40; x += 62) tree(x + rng() * 30, 14 + rng() * 16, rng() < 0.5 ? 'tree0' : 'pine1', 0.95 + rng() * 0.3, rng, 'leaf');
    for (let y = 40; y < WORLD_H; y += 64) tree(WORLD_W - 30 - rng() * 30, y, rng() < 0.6 ? 'pine0' : 'tree2', 0.95 + rng() * 0.3, rng, 'leaf');
    for (let x = 20; x < WORLD_W; x += 60) {
      const tx = x + rng() * 30, ty = WORLD_H - 14 + rng() * 16, key = rng() < 0.5 ? 'tree1' : 'tree5', sc = 0.95 + rng() * 0.3;
      if (lakeValue(tx, ty - 40) < 1.3) { rng(); rng(); continue; }
      tree(tx, ty, key, sc, rng, 'leaf');
    }
    for (let y = S0 + 20; y < WORLD_H; y += 56) tree(30 + rng() * 50, y, rng() < 0.5 ? 'tree1' : 'pine0', 0.95 + rng() * 0.3, rng, 'leaf');
  }

  // ---------------------------------------------------------------- Sunflower Meadow
  {
    const rng = mulberry32(1601);
    // The pine hedge that already divides wood from orchard runs on east, between meadow and hills.
    // One gap where the meadow trail runs down into the hills.
    const gap0 = 6170, gap1 = 6370;
    for (let x = E + 40; x < WORLD_W + 40; x += 46) {
      const y = FOREST_EDGE_Y + (rng() * 2 - 1) * 14;
      const key = rng() < 0.6 ? `pine${Math.floor(rng() * 2)}` : 'tree5', sc = 0.9 + rng() * 0.35;
      if (x > gap0 - 20 && x < gap1 + 20) continue;
      tree(x, y, key, sc, rng, 'leaf', false);
    }
    w.solidRect(E, FOREST_EDGE_Y - 30, gap0 - E, 44);
    w.solidRect(gap1, FOREST_EDGE_Y - 30, WORLD_W - gap1, 44);
    // Sunflower patches (sway in the breeze, nod when tapped).
    for (let i = 0; i < 22; i++) {
      const cx = E + 300 + rng() * (WORLD_W - E - 600), cy = 160 + rng() * (FOREST_EDGE_Y - 360);
      const n = 6 + Math.floor(rng() * 7);
      for (let k = 0; k < n; k++) {
        const x = cx + (rng() * 2 - 1) * 90, y = cy + (rng() * 2 - 1) * 50;
        if (!free(x, y, 8)) continue;
        const f = tuft(x, y, `sunflower${Math.floor(rng() * 2)}`, rng, 0.05).setScale((0.9 + rng() * 0.35) / 2.5);
        w.reacts.flower(f);
      }
    }
    // Beehives with bees (the bees themselves are ambient life, see regionLife below).
    for (const [x, y] of HIVES) {
      const hv = w.img(x, y, 'beehive', 0.5, 1, 1.1).setDepth(y);
      w.shadow(x + 4, y - 3, 60, 0.6);
      w.solidCircle(x, y - 10, 18);
      bouncy(w, hv, () => sfx.giggle(1.4), 0xffd84a);
      for (let i = 0; i < 6; i++) { const a = rng() * Math.PI * 2; const fx = x + Math.cos(a) * 110, fy = y + Math.sin(a) * 60; if (free(fx, fy, 10)) flowerClump(fx, fy, rng, 5); }
    }
    // Hay bales, trees, bushes, wildflowers, grass.
    scatter(rng, E + 100, 120, WORLD_W - 120, FOREST_EDGE_Y - 120, 12, 300, 40, (x, y) => {
      const hb = w.img(x, y, 'haybale', 0.5, 1, 1).setDepth(y).setFlipX(rng() < 0.5);
      w.shadow(x + 6, y - 3, 76, 0.6); w.solidCircle(x, y - 12, 22);
      bouncy(w, hb, () => sfx.thump(), 0xf3d27a);
    });
    scatter(rng, E + 60, 100, WORLD_W - 80, FOREST_EDGE_Y - 80, 34, 220, 50, (x, y) => tree(x, y, rng() < 0.5 ? 'apple0' : rng() < 0.5 ? 'tree0' : 'tree3', 0.9 + rng() * 0.25, rng, rng() < 0.5 ? 'apple' : 'blossom'));
    scatter(rng, E + 60, 100, WORLD_W - 80, FOREST_EDGE_Y - 60, 30, 140, 30, (x, y) => (rng() < 0.7 ? bush(x, y, rng) : rock(x, y, Math.floor(rng() * 3))));
    for (let i = 0; i < 60; i++) { const fx = E + 100 + rng() * (WORLD_W - E - 200), fy = 120 + rng() * (FOREST_EDGE_Y - 200); if (free(fx, fy, 10)) flowerClump(fx, fy, rng, 5); }
    scatter(rng, E, 60, WORLD_W - 40, FOREST_EDGE_Y - 40, 520, 16, 4, (x, y) => tuft(x, y, `tuft${Math.floor(rng() * 3)}`, rng));
  }

  // ---------------------------------------------------------------- Pinecone Hills
  {
    const rng = mulberry32(1701);
    scatter(rng, E + 60, FOREST_EDGE_Y + 80, WORLD_W - 80, S0 + 60, 190, 110, 34, (x, y) => {
      const r = rng();
      tree(x, y, r < 0.7 ? `pine${Math.floor(rng() * 2)}` : r < 0.85 ? 'tree5' : 'tree2', 0.95 + rng() * 0.45, rng, 'leaf');
    });
    scatter(rng, E + 60, FOREST_EDGE_Y + 80, WORLD_W - 80, S0 + 60, 70, 90, 24, (x, y) => {
      const v = Math.floor(rng() * 3);
      if (rng() < 0.35) { // big boulders
        const b = w.img(x, y, `rock${v}`, 0.5, 1, 1.9 + rng() * 0.6).setDepth(y);
        w.shadow(x + 6, y - 3, 110, 0.6); w.solidCircle(x, y - 14, 30); w.reacts.rock(b);
      } else rock(x, y, v);
    });
    scatter(rng, E + 60, FOREST_EDGE_Y + 80, WORLD_W - 80, S0 + 60, 110, 50, 10, (x, y) => {
      const f = w.img(x, y, `fern${Math.floor(rng() * 2)}`, 0.5, 1, 0.9 + rng() * 0.5).setDepth(y);
      w.sway(f, 0.05, 1 + rng()); w.reacts.bush(f);
    });
    for (const [i, [x, y]] of CAIRNS.entries()) {
      const c = w.img(x, y, `cairn${i % 2}`, 0.5, 1, 1.2).setDepth(y);
      w.shadow(x + 3, y - 2, 50, 0.6); w.solidCircle(x, y - 8, 14);
      bouncy(w, c, () => sfx.tock(), 0xe8e4dc);
    }
    for (let i = 0; i < 22; i++) { const fx = E + 200 + rng() * (WORLD_W - E - 400), fy = FOREST_EDGE_Y + 200 + rng() * (S0 - FOREST_EDGE_Y - 200); if (free(fx, fy, 10)) flowerClump(fx, fy, rng, 4); }
    scatter(rng, E, FOREST_EDGE_Y + 60, WORLD_W - 40, S0 + 40, 380, 16, 4, (x, y) => tuft(x, y, `tuft${Math.floor(rng() * 3)}`, rng));
  }

  // ---------------------------------------------------------------- Glowcap Grove
  {
    const rng = mulberry32(1801);
    const gx1 = E + 100; // the grove fades into the bay's woods around here
    scatter(rng, 120, S0 + 80, gx1, WORLD_H - 80, 230, 120, 36, (x, y) => {
      if (lakeValueOf(BAY, x, y) < 1.5) return;
      tree(x, y, rng() < 0.45 ? 'tree1' : rng() < 0.5 ? 'tree5' : 'pine0', 0.95 + rng() * 0.4, rng, 'leaf');
    });
    const cap = (x: number, y: number, big: boolean) => {
      const v = big ? 1 : rng() < 0.5 ? 0 : 2;
      const m = w.img(x, y, `glowcap${v}`, 0.5, 1, (0.9 + rng() * 0.5) * (big ? 1.2 : 1)).setDepth(y);
      w.sway(m, 0.015, 0.5 + rng() * 0.4);
      const col = [0x7af5e6, 0xc8a0ff, 0xff9ad8][v];
      const g = w.fx(x, y - m.displayHeight * 0.55, 'glow', (big ? 0.9 : 0.55) * (0.8 + rng() * 0.4)).setDepth(y - 1)
        .setBlendMode('ADD').setTint(col).setAlpha(0.22);
      g.setData('base', 0.16 + rng() * 0.12); g.setData('ph', rng() * 6.28);
      glows.push(g);
      if (big) { w.solidCircle(x, y - 8, 16); bouncy(w, m, () => sfx.chimes(), col, 60); } else w.reacts.flower(m);
    };
    scatter(rng, 120, S0 + 80, gx1, WORLD_H - 80, 160, 70, 14, (x, y) => cap(x, y, rng() < 0.3));
    scatter(rng, 120, S0 + 80, gx1, WORLD_H - 80, 150, 50, 10, (x, y) => {
      const f = w.img(x, y, `fern${Math.floor(rng() * 2)}`, 0.5, 1, 1 + rng() * 0.6).setDepth(y);
      w.sway(f, 0.05, 1 + rng()); w.reacts.bush(f);
    });
    // The fairy ring where the grove trails meet: a circle of glowcaps.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = GROVE_RING.x + Math.cos(a) * GROVE_RING.r, y = GROVE_RING.y + Math.sin(a) * GROVE_RING.r * 0.62;
      if (pathDist(x, y) < 34) continue;
      cap(x, y, i % 4 === 0);
    }
    scatter(rng, 60, S0, gx1, WORLD_H - 40, 420, 16, 4, (x, y) => tuft(x, y, `tuft${Math.floor(rng() * 3)}`, rng));
  }

  // ---------------------------------------------------------------- Seashell Bay
  {
    const rng = mulberry32(1901);
    const L = BAY;
    scatter(rng, E + 60, S0 + 80, WORLD_W - 80, WORLD_H - 80, 120, 150, 40, (x, y) => {
      if (lakeValueOf(L, x, y) < 1.45) return;
      tree(x, y, rng() < 0.5 ? 'tree0' : rng() < 0.5 ? 'tree2' : 'pine1', 0.95 + rng() * 0.3, rng, 'leaf');
    });
    scatter(rng, E + 60, S0 + 80, WORLD_W - 80, WORLD_H - 80, 40, 140, 30, (x, y) => { if (lakeValueOf(L, x, y) > 1.45) (rng() < 0.6 ? bush(x, y, rng) : rock(x, y, Math.floor(rng() * 3))); });
    for (let i = 0; i < 24; i++) { const fx = E + 200 + rng() * (WORLD_W - E - 400), fy = S0 + 200 + rng() * (WORLD_H - S0 - 400); if (lakeValueOf(L, fx, fy) > 1.5 && free(fx, fy, 10)) flowerClump(fx, fy, rng, 5); }
    scatter(rng, E, S0, WORLD_W - 40, WORLD_H - 40, 380, 16, 4, (x, y) => { if (lakeValueOf(L, x, y) > 1.38) tuft(x, y, `tuft${Math.floor(rng() * 3)}`, rng); });
    // Beach: dune grass, driftwood, starfish.
    for (let i = 0; i < 110; i++) {
      const a = rng() * Math.PI * 2, k = 1.08 + rng() * 0.22;
      const x = L.x + Math.cos(a) * L.rx * k, y = L.y + Math.sin(a) * L.ry * k;
      if (!free(x, y, 6) || lakeValue(x, y) < 1.08) continue;
      if (rng() < 0.75) tuft(x, y, `dune${Math.floor(rng() * 2)}`, rng, 0.07);
      else w.img(x, y, rng() < 0.5 ? 'driftwood' : 'starfish', 0.5, 1, 1).setDepth(y - 6).setRotation(rng() - 0.5);
    }
    // Reeds in the quieter coves + lily pads.
    for (let i = 0; i < 30; i++) {
      const a = Math.PI * (0.15 + rng() * 0.7) + (rng() < 0.5 ? 0 : Math.PI);
      const x = L.x + Math.cos(a) * L.rx, y = L.y + Math.sin(a) * L.ry + 4;
      if (pathDist(x, y) < 40) continue;
      w.sway(w.img(x, y, `reeds${i % 2}`, 0.5, 1, 0.9 + rng() * 0.4).setDepth(y), 0.06, 1.3);
    }
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2, k = 0.6 + rng() * 0.3;
      const x = L.x + Math.cos(a) * L.rx * k, y = L.y + Math.sin(a) * L.ry * k;
      if (waterAt(x, y) !== 'lake') continue;
      w.img(x, y, `lily${i % 3}`, 0.5, 0.5, 0.9 + rng() * 0.6).setDepth(-400).setRotation(rng() - 0.5);
    }
    // Shells to collect.
    const shells = mulberry32(1903);
    for (let i = 0; i < 12; i++) {
      const a = shells() * Math.PI * 2, k = 1.05 + shells() * 0.18;
      const x = L.x + Math.cos(a) * L.rx * k, y = L.y + Math.sin(a) * L.ry * k;
      if (!free(x, y, 4) || lakeValue(x, y) < 1.04) continue;
      w.reacts.place(x, y, `shell${i % 2}`, 'shell');
    }
    // The lighthouse on its rocks, with a slow sweeping glow; a tap makes it flash.
    {
      const { x, y } = LIGHTHOUSE;
      const lh = w.img(x, y, 'lighthouse', 0.5, 1, 1.15).setDepth(y);
      w.shadow(x + 16, y - 6, 140, 0.8);
      w.solidRect(x - 34, y - 40, 68, 36);
      const lampY = y - (236 - 52 + 15) * 1.15;
      const beam = w.fx(x, lampY, 'glow', 1.2).setDepth(9000).setBlendMode('ADD').setTint(0xfff2b0).setAlpha(0.3);
      w.tweens.add({ targets: beam, alpha: 0.65, scale: beam.scale * 1.35, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      w.tappables.push({
        x: () => x, y: () => y - 120, r: 90,
        tap: () => {
          sfx.ting(); w.life.reactions++;
          w.tweens.add({ targets: beam, scale: beam.scale * 1.8, duration: 260, yoyo: true });
          w.burst(x, lampY, 0xfff2b0, 12, 'spark');
        },
      });
      void lh;
    }
    // A little sailboat drifting around the bay (gently bobbing).
    {
      const boat = w.add.image(L.x, L.y, 'atlas', 'sailboat').setScale(1.1 / 2.5).setDepth(-300);
      const st = { t: 0 };
      w.tweens.add({
        targets: st, t: Math.PI * 2, duration: 90000, repeat: -1,
        onUpdate: () => {
          const a = st.t;
          boat.setPosition(L.x + Math.cos(a) * L.rx * 0.55, L.y + Math.sin(a) * L.ry * 0.5 + Math.sin(a * 9) * 3);
          boat.setFlipX(Math.sin(a) > 0);
          boat.setDepth(boat.y - 200);
          boat.setRotation(Math.sin(a * 7) * 0.04);
        },
      });
      w.tappables.push({ x: () => boat.x, y: () => boat.y - 20, r: 60, tap: () => { sfx.splash(false); w.life.reactions++; w.burst(boat.x, boat.y, 0xffffff, 8, 'spark'); } });
    }
  }

  // ---------------------------------------------------------------- future puzzle sites (66-67): a ring of stones marks each clearing
  for (const p of PUZZLE_SITES) {
    const rng = mulberry32(2000 + p.x);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng() * 0.2;
      const x = p.x + Math.cos(a) * 150, y = p.y + Math.sin(a) * 95;
      if (pathDist(x, y) < 36) continue;
      w.img(x, y, 'wstone', 0.5, 1, 1.5 + rng() * 0.6).setDepth(y);
    }
  }

  // ---------------------------------------------------------------- region life: glowcap pulse, fireflies, bees, gulls
  w.time.addEvent({
    delay: 120, loop: true, callback: () => {
      const v = w.cameras.main.worldView;
      const t = w.time.now / 1000;
      for (const g of glows) {
        if (!v.contains(g.x, g.y) && !v.contains(g.x, g.y + 200)) continue;
        g.setAlpha(g.getData('base') + Math.sin(t * 1.4 + g.getData('ph')) * 0.08);
      }
    },
  });
  w.time.addEvent({
    delay: 450, loop: true, callback: () => {
      const v = w.cameras.main.worldView;
      if (v.right < E - 400 && v.bottom < S0 - 400) return; // still in the old map
      const x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height;
      if (waterAt(x, y)) return;
      const near = (px: number, py: number, r: number) => Math.hypot(px - x, py - y) < r;
      if (y > S0 && x < E + 100) {
        // Firefly: a soft glowing dot that wanders and fades.
        const f = w.fx(x, y, 'dot', 0.6).setDepth(8200).setBlendMode('ADD').setTint(Math.random() < 0.5 ? 0xd8ff8a : 0x9af5ff).setAlpha(0);
        w.tweens.add({ targets: f, x: x + (Math.random() * 2 - 1) * 80, y: y - 30 - Math.random() * 60, duration: 4200, ease: 'Sine.easeInOut' });
        w.tweens.add({ targets: f, alpha: 0.95, duration: 900, yoyo: true, hold: 1800, onComplete: () => f.destroy() });
      } else if (y < FOREST_EDGE_Y && x > E) {
        // Bees buzzing around the nearest hive.
        const hv = HIVES.find(([hx, hy]) => near(hx, hy, 900));
        if (!hv) return;
        const b = w.fx(hv[0], hv[1] - 30, 'honeybee', 1).setDepth(hv[1] + 40);
        const tx = hv[0] + (Math.random() * 2 - 1) * 260, ty = hv[1] + (Math.random() * 2 - 1) * 150;
        b.setFlipX(tx < hv[0]);
        w.tweens.add({ targets: b, x: tx, duration: 3000, ease: 'Sine.easeInOut', yoyo: true, onYoyo: () => b.setFlipX(!b.flipX), onComplete: () => b.destroy() });
        w.tweens.add({ targets: b, y: ty, duration: 700, ease: 'Sine.easeInOut', yoyo: true, repeat: 3 });
      } else if (y > S0 && lakeValueOf(BAY, x, y) < 2.2) {
        // Gulls gliding over the bay.
        const gl = w.fx(x - 400, y - 200, 'gull', 1.4).setDepth(9100).setAlpha(0.9);
        w.tweens.add({ targets: gl, x: x + 500, y: y - 260 + Math.random() * 120, duration: 9000, onComplete: () => gl.destroy() });
        w.tweens.add({ targets: gl, scaleY: gl.scaleY * 0.6, duration: 400, yoyo: true, repeat: 10 });
      }
    },
  });
}
