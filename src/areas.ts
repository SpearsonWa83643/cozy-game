// Builds the wider world around the glade: Brookside, Mistbirch Wood, Windmill Orchard and
// Shellwater Shore. All placement is deterministic.
import Phaser from 'phaser';
import { mulberry32, pondValue, pathDist, ATLAS , TREE_SCALE } from './art';
import {
  WORLD_W, WORLD_H, GLADE_W, GLADE_H, LAKE, BRIDGES, BRIDGE_GATE, PIER, WINDMILL, FOREST_EDGE_Y, RIDGE_X,
  TILES, OWL, BELLS, DIG, DIG_STONES, DIG_SIGN, BELL_SIGN, TILE_SIGN, POTS, POT_SIGN, SONGBIRD, VILLAGE, VILLAGE_SIGN, MERCHANT_SPOT,
} from './layout';
import { riverXAt, riverDist, riverHalfAt, lakeValue, waterAt, RIVER } from './geo';
import { sfx } from './audio';
import { hasTreasure, save, setPuzzle } from './save';
import type { WorldScene } from './scenes/World';

type Rng = () => number;

export function buildAreas(w: WorldScene) {
  const keep: [number, number, number][] = [
    [TILES.x, TILES.y, 190], [OWL.x, OWL.y, 40], [WINDMILL.x, WINDMILL.y, 150], [DIG.x, DIG.y, 80],
    [DIG_SIGN.x, DIG_SIGN.y, 50], [BELL_SIGN.x, BELL_SIGN.y, 50], [TILE_SIGN.x, TILE_SIGN.y, 50], [SONGBIRD.x, SONGBIRD.y, 40],
    [POT_SIGN.x, POT_SIGN.y, 40], ...POTS.map((p) => [p.x, p.y, 40] as [number, number, number]),
    ...BELLS.map((b) => [b.x, b.y, 60] as [number, number, number]), [3700, 2250, 60],
    [BRIDGE_GATE.x, BRIDGE_GATE.y, 70], [PIER.x, PIER.y0, 60], [3900, 1050, 160],
    ...Object.values(BRIDGES).map((b) => [b.x, b.y, b.half + 40] as [number, number, number]),
  ];
  const free = (x: number, y: number, pad: number) => {
    if (x < 20 || y < 20 || x > WORLD_W - 20 || y > WORLD_H - 10) return false;
    if (x < GLADE_W && y < GLADE_H + 20) return false; // the glade builds itself
    // The village meadow stays open for building.
    if (x > VILLAGE.x - 60 && x < VILLAGE.x + VILLAGE.cols * VILLAGE.cell + 60 && y > VILLAGE.y - 70 && y < VILLAGE.y + VILLAGE.rows * VILLAGE.cell + 50) return false;
    if (Math.hypot(x - VILLAGE_SIGN.x, y - VILLAGE_SIGN.y) < 60 || Math.hypot(x - MERCHANT_SPOT.x, y - MERCHANT_SPOT.y) < 90) return false;
    if (pathDist(x, y) < pad + 22) return false;
    if (riverDist(x, y) < riverHalfAt(y) + pad + 10) return false;
    if (lakeValue(x, y, pad) < 1.02) return false;
    if (pondValue(x, y, pad) < 1) return false;
    for (const [kx, ky, kr] of keep) if (Math.hypot(kx - x, ky - y) < kr + pad * 0.5) return false;
    return true;
  };

  const tree = (x: number, y: number, key: string, scale0: number, rng: Rng, kind: Parameters<WorldScene['reacts']['tree']>[1], solid = true) => {
    const scale = scale0 * TREE_SCALE;
    const isPine = key.startsWith('pine');
    const isBirch = key.startsWith('birch');
    const h = isPine ? 190 : isBirch ? 230 : key.startsWith('apple') ? 180 : 210;
    const t = w.img(x, y, key, 0.5, (h - 8) / h, scale).setDepth(y).setFlipX(rng() < 0.5);
    w.shadow(x + 12, y - 4, (isPine ? 90 : isBirch ? 80 : 140) * scale, 0.7);
    w.sway(t, isPine ? 0.008 : isBirch ? 0.02 : 0.014, 0.6 + rng() * 0.4);
    w.reacts.tree(t, kind);
    if (solid) w.solidCircle(x, y - 6, (isBirch ? 10 : 15) * scale);
    return t;
  };
  const bush = (x: number, y: number, rng: Rng) => {
    const b = w.img(x, y, `bush${Math.floor(rng() * 3)}`, 0.5, 1, 0.9 + rng() * 0.3).setDepth(y);
    w.shadow(x + 4, y - 3, 76, 0.6);
    w.solidCircle(x, y - 10, 15);
    w.sway(b, 0.02, 0.8);
    w.reacts.bush(b);
  };
  const rock = (x: number, y: number, v: number) => {
    w.reacts.rock(w.img(x, y, `rock${v}`).setDepth(y));
    w.shadow(x + 3, y - 2, 56 + v * 10, 0.6);
    w.solidCircle(x, y - 8, 13 + v * 4);
  };
  const tuft = (x: number, y: number, key: string, rng: Rng, amp = 0.09) => {
    const t = w.img(x, y, key, 0.5, 1, 0.8 + rng() * 0.5).setDepth(y);
    w.sway(t, amp, 1.2 + rng() * 0.8);
    return t;
  };
  const flowerClump = (cx: number, cy: number, rng: Rng, n = 6) => {
    const kind = Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) {
      const x = cx + (rng() * 2 - 1) * 50, y = cy + (rng() * 2 - 1) * 34;
      if (!free(x, y, 6)) continue;
      w.reacts.flower(tuft(x, y, `flower${kind}`, rng, 0.1));
    }
  };
  /** Poisson-ish scatter: up to n accepted points in a rect with min spacing. */
  const scatter = (rng: Rng, x0: number, y0: number, x1: number, y1: number, n: number, minD: number, pad: number, fn: (x: number, y: number) => void) => {
    const pts: [number, number][] = [];
    for (let tries = 0; tries < n * 6 && pts.length < n; tries++) {
      const x = x0 + rng() * (x1 - x0), y = y0 + rng() * (y1 - y0);
      if (!free(x, y, pad)) continue;
      if (pts.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 < minD * minD)) continue;
      pts.push([x, y]);
      fn(x, y);
    }
  };

  // ---------------------------------------------------------------- Brookside (west bank)
  {
    const rng = mulberry32(501);
    // East edge of the river corridor north: woods closing the top.
    for (let x = GLADE_W - 10; x < 2600; x += 60) {
      for (let y = 40; y < 200; y += 60) {
        const tx = x + rng() * 30, ty = y + rng() * 30;
        if (riverDist(tx, ty) < riverHalfAt(ty) + 20) continue;
        tree(tx, ty, rng() < 0.5 ? 'pine0' : 'tree5', 0.9 + rng() * 0.3, rng, 'leaf');
      }
    }
    scatter(rng, GLADE_W, 220, 2260, 1560, 14, 120, 40, (x, y) => tree(x, y, ['tree1', 'tree2', 'tree5'][Math.floor(rng() * 3)], 0.85 + rng() * 0.3, rng, 'leaf'));
    scatter(rng, GLADE_W, 220, 2280, 1600, 10, 80, 30, (x, y) => (rng() < 0.6 ? bush(x, y, rng) : rock(x, y, Math.floor(rng() * 3))));
    scatter(rng, GLADE_W, 220, 2280, 1650, 140, 14, 4, (x, y) => tuft(x, y, `tuft${Math.floor(rng() * 3)}`, rng));
    for (let i = 0; i < 10; i++) flowerClump(GLADE_W + rng() * 260, 300 + rng() * 1300, rng);
  }
  // Reeds and stones along both river banks.
  {
    const rng = mulberry32(502);
    for (let i = 0; i < RIVER.length; i += 3) {
      const [px, py] = RIVER[i];
      if (py < 120 || rng() < 0.45) continue;
      const a = RIVER[Math.max(0, i - 1)], b = RIVER[Math.min(RIVER.length - 1, i + 1)];
      const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / tl, ny = (b[0] - a[0]) / tl;
      const side = rng() < 0.5 ? -1 : 1;
      const o = side * (riverHalfAt(py) + 4 + rng() * 8);
      const x = px + nx * o, y = py + ny * o;
      if (pathDist(x, y) < 40 || Object.values(BRIDGES).some((br) => Math.abs(br.x - x) < br.half + 30 && Math.abs(br.y - y) < 60)) continue;
      if (lakeValue(x, y) < 1.05) continue;
      w.sway(w.img(x, y, `reeds${i % 2}`, 0.5, 1, 0.8 + rng() * 0.4).setDepth(y), 0.06, 1.3);
    }
  }

  // ---------------------------------------------------------------- bridges + the locked gate
  for (const [id, b] of Object.entries(BRIDGES)) {
    w.add.image(b.x, b.y + 2, ATLAS, 'bridge_deck').setDisplaySize(b.half * 2 + 12, 58).setDepth(-350);
    w.img(b.x, b.y - 22, 'bridge_rail', 0.5, 1).setDisplaySize(b.half * 2 + 8, 16).setDepth(b.y - 26);
    w.img(b.x, b.y + 34, 'bridge_rail', 0.5, 1).setDisplaySize(b.half * 2 + 8, 16).setDepth(b.y + 34);
    void id;
  }
  {
    const g = BRIDGE_GATE;
    const open = !!save.puzzles.gate;
    const img = w.img(g.x, g.y + 30, open ? 'gate_open' : 'gate_closed', 0.5, 1, 1).setDepth(g.y + 30);
    const barrier = w.solidRect(g.x - 14, g.y - 34, 26, 70);
    if (open) (barrier.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    w.interactables.push({
      x: g.x - 30, y: g.y + 20, r: 64, label: 'Unlock', promptY: 90, approach: [-20, 0],
      enabled: () => !save.puzzles.gate,
      action: () => {
        if (!hasTreasure('rusty_key')) {
          sfx.tock();
          w.game.events.emit('dialog', [
            'This gate is locked.',
            'Find the key by the windmill!',
          ]);
          return;
        }
        setPuzzle('gate');
        (barrier.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        img.setTexture(ATLAS, 'gate_open');
        sfx.unlockGate();
        w.burst(g.x, g.y - 10, 0xffd27a, 26, 'spark');
        w.burst(g.x, g.y, 0x7cc463, 14, 'leaf');
        w.cameras.main.shake(180, 0.002);
        w.buildNav();
        w.game.events.emit('toast', 'Click! The gate is open!');
      },
    });
  }

  // ---------------------------------------------------------------- Mistbirch Wood
  {
    const rng = mulberry32(601);
    const xr = (y: number) => riverXAt(y) + riverHalfAt(y) + 40;
    scatter(rng, 2380, 40, WORLD_W - 20, FOREST_EDGE_Y - 30, 150, 96, 30, (x, y) => {
      if (x < xr(y)) return;
      tree(x, y, rng() < 0.82 ? `birch${Math.floor(rng() * 2)}` : 'teal' === 'teal' ? 'tree1' : 'pine0', 0.85 + rng() * 0.35, rng, 'birch');
    });
    scatter(rng, 2380, 60, WORLD_W - 20, FOREST_EDGE_Y - 40, 120, 40, 10, (x, y) => {
      if (x < xr(y)) return;
      const f = w.img(x, y, `fern${Math.floor(rng() * 2)}`, 0.5, 1, 0.9 + rng() * 0.5).setDepth(y);
      w.sway(f, 0.05, 1 + rng());
      w.reacts.bush(f);
    });
    scatter(rng, 2380, 60, WORLD_W - 20, FOREST_EDGE_Y - 40, 40, 90, 20, (x, y) => {
      if (x < xr(y)) return;
      const r = rng();
      if (r < 0.4) rock(x, y, Math.floor(rng() * 3));
      else if (r < 0.7) bush(x, y, rng);
      else { const m = w.img(x, y, 'mushrooms', 0.5, 1, 1 + rng() * 0.3).setDepth(y); w.reacts.flower(m); }
    });
    scatter(rng, 2380, 60, WORLD_W - 20, FOREST_EDGE_Y - 40, 120, 16, 4, (x, y) => { if (x > xr(y)) tuft(x, y, `tuft${Math.floor(rng() * 3)}`, rng); });
    for (let i = 0; i < 8; i++) flowerClump(2700 + rng() * 1600, 150 + rng() * 1100, rng, 4);
    // Ring of mushrooms + stones around the tile clearing.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const x = TILES.x + Math.cos(a) * 165, y = TILES.y + 20 + Math.sin(a) * 105;
      if (pathDist(x, y) < 30) continue;
      if (i % 2) w.img(x, y, 'mushrooms', 0.5, 1, 0.9).setDepth(y);
      else rock(x, y, 0);
    }
    // The owl's birch.
    tree(OWL.x, OWL.y + 120, 'birch0', 1.2, rng, 'birch');
    // Divider between wood and orchard: a dense hedge of pines.
    for (let x = 2300; x < WORLD_W + 40; x += 46) {
      const y = FOREST_EDGE_Y + (rng() * 2 - 1) * 14;
      if (riverDist(x, y) < riverHalfAt(y) + 30) continue;
      tree(x, y, rng() < 0.6 ? `pine${Math.floor(rng() * 2)}` : 'tree5', 0.9 + rng() * 0.35, rng, 'leaf', false);
    }
    const x0 = riverXAt(FOREST_EDGE_Y) + riverHalfAt(FOREST_EDGE_Y) + 4;
    w.solidRect(x0, FOREST_EDGE_Y - 30, WORLD_W - x0, 44);
    // Drifting mist.
    for (let i = 0; i < 18; i++) {
      const m = w.add.image(2500 + rng() * 1850, 80 + rng() * 1250, ATLAS, 'mist').setDepth(8100).setAlpha(0.16 + rng() * 0.14)
        .setScale(3 + rng() * 3, 2 + rng() * 2).setTint(0xeef6ff);
      w.mist.push(m);
    }
  }

  // ---------------------------------------------------------------- Windmill Orchard
  {
    const rng = mulberry32(701);
    const xr = (y: number) => (y > 2400 ? RIDGE_X + 120 : riverXAt(y) + riverHalfAt(y) + 50);
    // Orchard rows.
    for (let y = 2260, row = 0; y < 2900; y += 150, row++) {
      for (let x = 2560 + (row % 2) * 80; x < 4300; x += 170) {
        const tx = x + (rng() * 2 - 1) * 14, ty = y + (rng() * 2 - 1) * 10;
        if (tx < xr(ty) || !free(tx, ty, 50)) continue;
        tree(tx, ty, `apple${(row + Math.floor(x / 170)) % 2}`, 0.95 + rng() * 0.15, rng, (row + Math.floor(x / 170)) % 2 ? 'pear' : 'apple');
      }
    }
    // Scattered trees + bushes in the upper meadow.
    scatter(rng, 2450, FOREST_EDGE_Y + 60, WORLD_W - 30, 2200, 16, 160, 50, (x, y) => { if (x > xr(y)) tree(x, y, rng() < 0.5 ? 'tree0' : 'apple0', 0.9 + rng() * 0.2, rng, 'apple'); });
    scatter(rng, 2450, FOREST_EDGE_Y + 60, WORLD_W - 30, WORLD_H - 60, 22, 120, 30, (x, y) => { if (x > xr(y)) (rng() < 0.6 ? bush(x, y, rng) : rock(x, y, Math.floor(rng() * 3))); });
    scatter(rng, 2450, FOREST_EDGE_Y + 60, WORLD_W - 30, WORLD_H - 40, 240, 16, 4, (x, y) => { if (x > xr(y)) tuft(x, y, `tuft${Math.floor(rng() * 3)}`, rng); });
    for (let i = 0; i < 26; i++) flowerClump(2500 + rng() * 1850, 1500 + rng() * 1450, rng);
    // South + east rims.
    for (let x = RIDGE_X; x < WORLD_W + 40; x += 58) tree(x + rng() * 30, WORLD_H - 10 + rng() * 20, rng() < 0.5 ? 'tree0' : 'tree2', 0.95 + rng() * 0.3, rng, 'leaf');
    for (let y = FOREST_EDGE_Y + 40; y < WORLD_H; y += 64) tree(WORLD_W - 30 - rng() * 30, y, rng() < 0.5 ? 'tree0' : 'pine1', 0.95 + rng() * 0.3, rng, 'leaf');
    // Wooded ridge between the orchard and the lake shore, below the river mouth.
    for (let y = 2330; y < WORLD_H + 20; y += 44) {
      for (let k = 0; k < 3; k++) tree(RIDGE_X - 60 + k * 60 + rng() * 26, y + rng() * 20, rng() < 0.5 ? 'pine0' : 'pine1', 0.95 + rng() * 0.3, rng, 'leaf', false);
    }
    w.solidRect(RIDGE_X - 70, 2360, 170, WORLD_H - 2360);
    // Windmill.
    const { x, y } = WINDMILL;
    w.shadow(x + 14, y - 6, 200, 0.8);
    w.img(x, y, 'windmill', 0.5, 1, 1).setDepth(y);
    w.solidRect(x - 52, y - 40, 104, 36);
    const blades = w.add.image(x, y - 138, ATLAS, 'blades').setScale(1 / 2).setDepth(y + 1);
    w.windmill = { blades, speed: 0.6, boost: 0 };
    w.tappables.push({
      x: () => x, y: () => y - 110, r: 95,
      tap: () => {
        w.windmill!.boost = 4;
        sfx.creak();
        w.life.reactions++;
        w.burst(x, y - 138, 0xfff1c8, 10, 'leaf');
      },
    });
    // Fences framing the bell yard.
    for (let i = 0; i < 6; i++) w.img(3500 + i * 52, 2210, 'fence').setDepth(2210);
  }

  // ---------------------------------------------------------------- Shellwater Shore
  {
    const rng = mulberry32(801);
    // West rim + south rim.
    for (let y = GLADE_H + 60; y < WORLD_H + 20; y += 56) {
      tree(30 + rng() * 50, y, rng() < 0.5 ? 'tree1' : 'pine0', 0.95 + rng() * 0.3, rng, 'leaf');
      if (rng() < 0.6) tree(110 + rng() * 40, y + 25, rng() < 0.5 ? 'tree2' : 'tree5', 0.9 + rng() * 0.3, rng, 'leaf');
    }
    for (let x = 140; x < RIDGE_X - 60; x += 60) {
      if (lakeValue(x, WORLD_H - 40) < 1.3) continue;
      tree(x + rng() * 30, WORLD_H - 20 + rng() * 20, rng() < 0.5 ? 'tree1' : 'tree5', 0.95 + rng() * 0.3, rng, 'leaf');
    }
    // Meadow between the glade and the beach.
    scatter(rng, 150, GLADE_H + 90, RIDGE_X, 2150, 16, 150, 50, (x, y) => { if (lakeValue(x, y) > 1.45) tree(x, y, ['tree0', 'tree3', 'tree1'][Math.floor(rng() * 3)], 0.85 + rng() * 0.3, rng, rng() < 0.5 ? 'blossom' : 'fruit'); });
    scatter(rng, 150, GLADE_H + 80, RIDGE_X, WORLD_H - 60, 14, 120, 30, (x, y) => { if (lakeValue(x, y) > 1.45) (rng() < 0.6 ? bush(x, y, rng) : rock(x, y, Math.floor(rng() * 3))); });
    scatter(rng, 150, GLADE_H + 60, RIDGE_X + 300, WORLD_H - 40, 200, 16, 4, (x, y) => { if (lakeValue(x, y) > 1.38) tuft(x, y, `tuft${Math.floor(rng() * 3)}`, rng); });
    for (let i = 0; i < 16; i++) { const fx = 200 + rng() * 1700, fy = 1620 + rng() * 500; if (lakeValue(fx, fy) > 1.5 && free(fx, fy, 10)) flowerClump(fx, fy, rng); }
    // Beach dressing: dune grass, driftwood, starfish.
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2, k = 1.1 + rng() * 0.22;
      const x = LAKE.x + Math.cos(a) * LAKE.rx * k, y = LAKE.y + Math.sin(a) * LAKE.ry * k;
      if (!free(x, y, 6) || lakeValue(x, y) < 1.08) continue;
      if (rng() < 0.8) tuft(x, y, `dune${Math.floor(rng() * 2)}`, rng, 0.07);
      else w.img(x, y, rng() < 0.5 ? 'driftwood' : 'starfish', 0.5, 1, 1).setDepth(y - 6).setRotation(rng() - 0.5);
    }
    // Reeds on the far shores + lily pads.
    for (let i = 0; i < 40; i++) {
      const a = Math.PI * (0.1 + rng() * 0.8) + (rng() < 0.5 ? 0 : Math.PI * 0.95);
      const x = LAKE.x + Math.cos(a) * LAKE.rx * 1.0, y = LAKE.y + Math.sin(a) * LAKE.ry * 1.0 + 4;
      if (pathDist(x, y) < 40 || Math.abs(x - PIER.x) < 60) continue;
      w.sway(w.img(x, y, `reeds${i % 2}`, 0.5, 1, 0.9 + rng() * 0.4).setDepth(y), 0.06, 1.3);
    }
    for (let i = 0; i < 18; i++) {
      const a = rng() * Math.PI * 2, k = 0.62 + rng() * 0.3;
      const x = LAKE.x + Math.cos(a) * LAKE.rx * k, y = LAKE.y + Math.sin(a) * LAKE.ry * k;
      if (waterAt(x, y) !== 'lake' || Math.abs(x - PIER.x) < 50) continue;
      w.img(x, y, `lily${i % 3}`, 0.5, 0.5, 0.9 + rng() * 0.6).setDepth(-400).setRotation(rng() - 0.5);
    }
    // Pier.
    w.add.image(PIER.x, PIER.y0 - 14, ATLAS, 'pier').setOrigin(0.5, 0).setDisplaySize(PIER.w * 2 + 8, PIER.y1 - PIER.y0 + 34).setDepth(-340);
    // Shells to collect (each once per visit).
    const shells = mulberry32(803);
    for (let i = 0; i < 14; i++) {
      const a = shells() * Math.PI * 2, k = 1.05 + shells() * 0.18;
      const x = LAKE.x + Math.cos(a) * LAKE.rx * k, y = LAKE.y + Math.sin(a) * LAKE.ry * k;
      if (!free(x, y, 4) || lakeValue(x, y) < 1.04) continue;
      w.reacts.place(x, y, `shell${i % 2}`, 'shell');
    }
    // The three white stones of the riddle.
    for (const [x, y] of DIG_STONES) w.img(x, y, 'wstone', 0.5, 1, 1.4).setDepth(y);
  }

  // Ambient water life: ripples + glints on any water near the camera.
  w.time.addEvent({
    delay: 380, loop: true, callback: () => {
      const v = w.cameras.main.worldView;
      for (let k = 0; k < 3; k++) {
        const x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height;
        const wa = waterAt(x, y, 14);
        if (!wa || wa === 'pond') continue;
        if (Math.random() < 0.5) {
          const r = w.fx(x, y, 'ripple', 0.2).setDepth(-395).setAlpha(0.45).setBlendMode('ADD');
          w.tweens.add({ targets: r, scale: r.scale * 4, alpha: 0, duration: 2200, ease: 'Sine.easeOut', onComplete: () => r.destroy() });
        } else {
          const g = w.fx(x, y, 'spark', 0.25).setDepth(-390).setBlendMode('ADD').setTint(0xfff6d8).setAlpha(0);
          w.tweens.add({ targets: g, alpha: 0.9, yoyo: true, duration: 500, onComplete: () => g.destroy() });
        }
        break;
      }
    },
  });
}
