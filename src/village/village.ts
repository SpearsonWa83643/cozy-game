// Willow Village: friendly villagers, snap-grid building, simple jobs and gentle events.
// Rules for a young audience: no fail states, few numbers, big obvious feedback.
import Phaser from 'phaser';
import { atlasOf, frameScale, mulberry32 } from '../art';
import { VILLAGE, VILLAGE_SIGN, VILLAGE_ENTRY, MERCHANT_SPOT, COTTAGE } from '../layout';
import { save, persist, hasTreasure, tipOnce, takeFruit, BuildingType, BuildingSave, VillagerSave, Res } from '../save';
import { sfx } from '../audio';
import { theme, themeEvents } from '../theme';
import { KINDS } from './vart';
import type { WorldScene } from '../scenes/World';

export type ResId = keyof Res;
export type BuildDef = {
  name: string; frame: string; w: number; h: number; cost: Partial<Res>;
  job: string | null; makes: ResId | 'woodstone' | null; every: number; amount: number;
  beds: number; fun: boolean; unlock: { treasure?: string; fish?: boolean } | null; blurb: string; hint: string;
};
export const BUILD: Record<BuildingType, BuildDef> = {
  home: { name: 'Home', frame: 'b_home', w: 2, h: 2, cost: { wood: 4 }, job: null, makes: null, every: 0, amount: 0, beds: 2, fun: false, unlock: null, blurb: 'A cozy home. Room for 2 friends.', hint: '' },
  garden: { name: 'Garden', frame: 'b_garden', w: 2, h: 2, cost: { wood: 2 }, job: 'Gardener', makes: 'food', every: 9, amount: 1, beds: 0, fun: false, unlock: null, blurb: 'Grows yummy veggies.', hint: '' },
  kitchen: { name: 'Kitchen', frame: 'b_kitchen', w: 2, h: 2, cost: { wood: 3, stone: 2 }, job: 'Cook', makes: 'food', every: 12, amount: 2, beds: 0, fun: false, unlock: null, blurb: 'Friends eat here. A cook makes food.', hint: '' },
  workshop: { name: 'Workshop', frame: 'b_workshop', w: 2, h: 2, cost: { wood: 3, stone: 1 }, job: 'Builder', makes: 'woodstone', every: 10, amount: 1, beds: 0, fun: false, unlock: null, blurb: 'Makes wood and stone.', hint: '' },
  fishhut: { name: 'Fishing Hut', frame: 'b_fishhut', w: 2, h: 2, cost: { wood: 4 }, job: 'Fisher', makes: 'food', every: 11, amount: 1, beds: 0, fun: false, unlock: { fish: true }, blurb: 'Catches fish for food.', hint: 'Catch your first fish.' },
  flowerbed: { name: 'Flowers', frame: 'd_flowerbed', w: 1, h: 1, cost: { wood: 1 }, job: null, makes: null, every: 0, amount: 0, beds: 0, fun: true, unlock: { treasure: 'flower_crown' }, blurb: 'Pretty! Friends love it.', hint: 'Find the Flower Crown.' },
  lamp: { name: 'Lamp', frame: 'd_lamp', w: 1, h: 1, cost: { stone: 1 }, job: null, makes: null, every: 0, amount: 0, beds: 0, fun: true, unlock: { treasure: 'golden_feather' }, blurb: 'A warm, happy light.', hint: 'Find the Golden Feather.' },
  well: { name: 'Well', frame: 'd_well', w: 1, h: 1, cost: { stone: 3 }, job: null, makes: null, every: 0, amount: 0, beds: 0, fun: true, unlock: { treasure: 'rusty_key' }, blurb: 'Make a wish!', hint: 'Find the Rusty Key.' },
  bench: { name: 'Bench', frame: 'd_bench', w: 1, h: 1, cost: { wood: 2 }, job: null, makes: null, every: 0, amount: 0, beds: 0, fun: true, unlock: { treasure: 'shell_necklace' }, blurb: 'A comfy seat.', hint: 'Find the Shell Necklace.' },
  pantry: { name: 'Snack Crate', frame: 'd_pantry', w: 1, h: 1, cost: { wood: 2 }, job: null, makes: null, every: 0, amount: 0, beds: 0, fun: false, unlock: null, blurb: 'Snacks close to home! Hungry friends eat here.', hint: '' },
  statue: { name: 'Fox Statue', frame: 'd_statue', w: 1, h: 1, cost: { stone: 2 }, job: null, makes: null, every: 0, amount: 0, beds: 0, fun: true, unlock: { treasure: 'fox_hood' }, blurb: 'A brave little fox.', hint: 'Find the Fox-ear Hood.' },
};
/** 9.4: buildings you can step inside (the 2x2 ones; little decor stays outside). */
export const HAS_INTERIOR = new Set<BuildingType>(['home', 'kitchen', 'workshop', 'garden', 'fishhut']);
export const BUILD_ORDER: BuildingType[] = ['home', 'garden', 'kitchen', 'pantry', 'workshop', 'fishhut', 'flowerbed', 'lamp', 'well', 'bench', 'statue'];

const NAMES = ['Pip', 'Mo', 'Bea', 'Juniper', 'Tuck', 'Hazel', 'Olive', 'Bram', 'Poppy', 'Wren', 'Fig', 'Clover', 'Moss', 'Tilly', 'Basil', 'Daisy', 'Pebble', 'Sunny'];
const TRAITS = ['Loves naps', 'Always humming', 'Tells silly jokes', 'Loves flowers', 'Super speedy', 'Bakes the best pie', 'Collects shiny pebbles', 'Counts the stars', 'Gives big hugs', 'Brave explorer'];

export const isUnlockedB = (t: BuildingType) => {
  const u = BUILD[t].unlock;
  if (!u) return true;
  if (u.treasure) return hasTreasure(u.treasure);
  if (u.fish) return Object.keys(save.fish).some((k) => k !== 'old_boot');
  return true;
};
export const canAfford = (cost: Partial<Res>) => (Object.keys(cost) as ResId[]).every((k) => save.village.res[k] >= (cost[k] ?? 0));

/** A job that fits each trait (used by the idle-friend bubble). */
const TRAIT_JOB: Record<string, BuildingType> = {
  'Loves naps': 'garden', 'Always humming': 'kitchen', 'Tells silly jokes': 'kitchen', 'Loves flowers': 'garden', 'Super speedy': 'workshop',
  'Bakes the best pie': 'kitchen', 'Collects shiny pebbles': 'workshop', 'Counts the stars': 'fishhut', 'Gives big hugs': 'garden', 'Brave explorer': 'fishhut',
};
export type Suggest = { kind: 'assign'; b: Building } | { kind: 'build'; t: BuildingType };
export type Alert = { id: string; icon: string; text: string; fix: string; fixIcon: string; urgent: boolean; run: () => void };

type Task = 'idle' | 'walk' | 'work' | 'eat' | 'sleep' | 'play' | 'drag' | 'wander';
export class Villager {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  face: Phaser.GameObjects.Image;
  /** Urgency halo behind the face (Order 15): hidden when happy, amber when so-so, pulsing coral when they need care. */
  ring: Phaser.GameObjects.Image;
  x: number; y: number;
  task: Task = 'idle';
  next: Task = 'idle';
  path: [number, number][] = [];
  timer = 0;
  think = 0;
  progress = 0;
  stepT = 0;
  frame = 0;
  hop = 0;
  idleT = 0;
  walkT = 0;
  suggest: Suggest | null = null;
  bubble: Phaser.GameObjects.Container | null = null;
  constructor(public v: Village, public data: VillagerSave, x: number, y: number, public guest = false) {
    const w = v.w;
    this.x = x; this.y = y;
    this.shadow = w.fx(x, y, 'shadow', 0.45).setAlpha(0.5).setDepth(-480);
    this.img = w.add.image(x, y, atlasOf(this.key()), this.key()).setOrigin(0.5, 1).setScale(0.62 / (frameScale[this.key()] ?? 3)).setDepth(y);
    this.face = w.add.image(x, y - 54, atlasOf('f_happy'), 'f_happy').setScale(0.42 / (frameScale.f_happy ?? 2.5)).setDepth(9000);
    this.ring = w.add.image(x, y - 54, atlasOf('f_ring'), 'f_ring').setScale(0.72 / (frameScale.f_ring ?? 2.5)).setDepth(8999).setVisible(false);
    if (guest) this.face.setTexture(atlasOf('i_heart'), 'i_heart');
  }
  /** 0 = fine, 1 = getting low, 2 = needs care now. */
  urgency(): 0 | 1 | 2 {
    if (this.guest || this.task === 'sleep') return 0;
    const m = this.mood();
    return m === 'f_meh' ? 2 : m === 'f_ok' ? 1 : 0;
  }
  key() { return `vil${this.data.kind}_${this.frame}`; }
  mood(): 'f_happy' | 'f_ok' | 'f_meh' {
    const m = Math.min(this.data.food, this.data.sleep, this.data.fun);
    return m > 0.55 ? 'f_happy' : m > 0.25 ? 'f_ok' : 'f_meh';
  }
  speed() { return this.data.trait === 'Super speedy' ? 78 : 56; }
  /** Order 17 care hint: a bobbing food / bed icon over where a hungry or sleepy friend is heading. */
  mark: Phaser.GameObjects.Image | null = null;
  markAt: [number, number] = [0, 0];
  goTo(x: number, y: number, then: Task) {
    const p = this.v.w.nav.find(this.x, this.y, x, y);
    this.path = p && p.length ? p : [[x, y]];
    this.task = 'walk'; this.next = then; this.walkT = 0;
    this.clearMark();
    if (then === 'eat' || then === 'sleep') {
      const k = then === 'eat' ? 'i_food' : 'i_sleep';
      this.markAt = [x, y];
      this.mark = this.v.w.add.image(x, y - 70, atlasOf(k), k).setScale(0.62 / (frameScale[k] ?? 2.5)).setDepth(8990).setAlpha(0.95);
    }
  }
  clearMark() { this.mark?.destroy(); this.mark = null; }
  destroy() { this.img.destroy(); this.shadow.destroy(); this.face.destroy(); this.ring.destroy(); this.bubble?.destroy(); this.clearMark(); }
}

export type Building = { data: BuildingSave; img: Phaser.GameObjects.Image; x: number; y: number; cx: number; cy: number; worker: Villager | null; prog: number; alt: number; bar: Phaser.GameObjects.Graphics; solid: Phaser.GameObjects.Zone; gone?: boolean };

/** 11.7: where theme dressing sits on each building painting (art units from the bottom-centre). */
type DressSpot = { eave: number; hw: number; roof?: { kind: 'tri' | 'trap'; top: number; base: number; hw: number }; wreath?: [number, number]; gourd: number; corn: number };
const DRESS_SPOTS: Record<string, DressSpot> = {
  b_home: { eave: -64, hw: 64, roof: { kind: 'tri', top: -128, base: -64, hw: 66 }, wreath: [0, -88], gourd: 42, corn: -60 },
  b_kitchen: { eave: -64, hw: 64, roof: { kind: 'tri', top: -128, base: -64, hw: 66 }, wreath: [0, -26], gourd: 42, corn: -60 },
  b_workshop: { eave: -60, hw: 66, roof: { kind: 'trap', top: -104, base: -60, hw: 68 }, wreath: [0, -30], gourd: -42, corn: 72 },
  b_fishhut: { eave: -86, hw: 56, roof: { kind: 'tri', top: -130, base: -86, hw: 58 }, wreath: [0, -54], gourd: 44, corn: -54 },
  b_garden: { eave: -84, hw: 64, gourd: 48, corn: -70 },
  b_garden0: { eave: -84, hw: 64, gourd: 48, corn: -70 },
};

export class Village {
  villagers: Villager[] = [];
  buildings: Building[] = [];
  wanderer: Villager | null = null;
  wanderTimer = 3;
  building = false;           // build mode
  selected: BuildingType | null = null;
  /** Order 19: the building being moved in build mode (its ghost follows the finger; the real one waits, faded). */
  moving: Building | null = null;
  moved = 0; removed = 0; // test counters
  ghost: { img: Phaser.GameObjects.Image; gx: number; gy: number; ok: boolean; check: Phaser.GameObjects.Image; cross: Phaser.GameObjects.Image } | null = null;
  grid: Phaser.GameObjects.Graphics;
  rain = 0; festival = 0; merchant = 0;
  eventTimer = 75;
  cart: Phaser.GameObjects.Image | null = null;
  bunting: Phaser.GameObjects.Image[] = [];
  rainFx: Phaser.GameObjects.Particles.ParticleEmitter;
  rainTint: Phaser.GameObjects.Rectangle;
  produced = 0;
  speed = 1; // test hook only

  constructor(public w: WorldScene) {
    this.grid = w.add.graphics().setDepth(-340).setVisible(false);
    // Village sign + a picnic blanket where friends eat and nap before there are buildings.
    w.img(VILLAGE_SIGN.x, VILLAGE_SIGN.y, 'v_sign', 0.5, 1, 1).setDepth(VILLAGE_SIGN.y);
    w.solidCircle(VILLAGE_SIGN.x, VILLAGE_SIGN.y - 4, 8);
    w.interactables.push({ x: VILLAGE_SIGN.x, y: VILLAGE_SIGN.y, r: 56, label: 'Read', promptY: 80, enabled: () => true,
      action: () => w.game.events.emit('dialog', ['Willow Village!', 'Tap the hammer to build.', 'Tap a new friend to invite them.', 'Drag a friend to a building.', 'Now they have a job!']) });
    this.rainFx = w.add.particles(0, 0, atlasOf('p_drop'), {
      frame: 'p_drop', emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, 10, 10) as any },
      lifespan: 900, speedY: { min: 520, max: 640 }, speedX: { min: -60, max: -30 }, quantity: 6, frequency: 30,
      scale: { min: 0.5, max: 0.8 }, alpha: { min: 0.4, max: 0.75 }, emitting: false,
    } as any).setDepth(8900);
    this.rainTint = w.add.rectangle(0, 0, 10, 10, 0x6d7f9e, 0).setOrigin(0).setScrollFactor(0).setDepth(8800);
    for (const b of save.village.buildings) this.spawnBuilding(b, false);
    for (const d of save.village.villagers) {
      const [x, y] = this.homeSpot(d.id);
      const v = new Villager(this, d, x, y);
      this.villagers.push(v);
      this.addTap(v);
    }
    for (const b of this.buildings) {
      const id = save.village.villagers.find((v) => v.job === b.data.id);
      if (id) b.worker = this.villagers.find((v) => v.data.id === id.id) ?? null;
    }
    w.game.events.on('fish-caught', (d: { species: { rarity: string } }) => {
      const n = { junk: 0, common: 1, uncommon: 2, rare: 3 }[d.species.rarity as 'common'] ?? 1;
      if (n) this.add('food', n, w.feet.x, w.feet.y - 60);
    });
    themeEvents.on('change', () => this.restyle());
  }

  // ------------------------------------------------------------ grid helpers
  cellXY(gx: number, gy: number) { return [VILLAGE.x + gx * VILLAGE.cell, VILLAGE.y + gy * VILLAGE.cell] as const; }
  footprint(t: BuildingType, gx: number, gy: number) {
    const d = BUILD[t]; const [x, y] = this.cellXY(gx, gy);
    return { x, y, w: d.w * VILLAGE.cell, h: d.h * VILLAGE.cell, cx: x + d.w * VILLAGE.cell / 2, by: y + d.h * VILLAGE.cell - 4 };
  }
  occupied(gx: number, gy: number) {
    return this.buildings.some((b) => { if (b === this.moving) return false; const d = BUILD[b.data.type]; return gx >= b.data.gx && gx < b.data.gx + d.w && gy >= b.data.gy && gy < b.data.gy + d.h; });
  }
  canPlace(t: BuildingType, gx: number, gy: number) {
    const d = BUILD[t];
    if (gx < 0 || gy < 0 || gx + d.w > VILLAGE.cols || gy + d.h > VILLAGE.rows) return false;
    for (let y = gy; y < gy + d.h; y++) for (let x = gx; x < gx + d.w; x++) if (this.occupied(x, y)) return false;
    // Keep friends and the player out from under new walls.
    const f = this.footprint(t, gx, gy);
    if (this.w.feet.x > f.x - 8 && this.w.feet.x < f.x + f.w + 8 && this.w.feet.y > f.y + f.h * 0.35 && this.w.feet.y < f.y + f.h + 10) return false;
    return true;
  }
  firstFree(t: BuildingType): [number, number] | null {
    const d = BUILD[t];
    // Order 17: a Snack Crate starts right next to the homes, so food is close to beds.
    const homes = this.buildings.filter((b) => b.data.type === 'home');
    if (t === 'pantry' && homes.length) {
      let best: [number, number] | null = null, bd = Infinity;
      for (let gy = 0; gy <= VILLAGE.rows - d.h; gy++) for (let gx = 0; gx <= VILLAGE.cols - d.w; gx++) {
        if (!this.canPlace(t, gx, gy)) continue;
        const f = this.footprint(t, gx, gy);
        const dist = Math.min(...homes.map((h) => Math.hypot(h.cx - f.cx, h.y - f.by)));
        if (dist < bd) { bd = dist; best = [gx, gy]; }
      }
      return best;
    }
    for (let gy = 0; gy <= VILLAGE.rows - d.h; gy++) for (let gx = 0; gx <= VILLAGE.cols - d.w; gx++) if (this.canPlace(t, gx, gy)) return [gx, gy];
    return null;
  }
  beds() { return 2 + this.buildings.reduce((n, b) => n + BUILD[b.data.type].beds, 0); }
  homeSpot(id: number): [number, number] {
    const homes = this.buildings.filter((b) => b.data.type === 'home');
    const h = homes[id % Math.max(1, homes.length)];
    if (h) return [h.cx + ((id % 3) - 1) * 18, h.y + 16];
    const r = mulberry32(id * 31)();
    return [VILLAGE.x + 120 + r * 420, VILLAGE.y + VILLAGE.rows * VILLAGE.cell + 20];
  }

  /** Nearest place to eat (Kitchen or Snack Crate), else the picnic spot by the sign. */
  foodSpot(v: Villager): { x: number; y: number; b: Building | null } {
    const spots = this.buildings.filter((b) => b.data.type === 'kitchen' || b.data.type === 'pantry');
    let b: Building | null = null, bd = Infinity;
    for (const s of spots) { const dd = Math.hypot(s.cx - v.x, s.y - v.y); if (dd < bd) { bd = dd; b = s; } }
    if (!b) return { x: VILLAGE_SIGN.x - 50, y: VILLAGE_SIGN.y + 30, b: null };
    return { x: b.cx + (Math.random() - 0.5) * (BUILD[b.data.type].w * 20), y: b.y + 16, b };
  }
  /** Nearest home for a nap, else the friend's usual spot. */
  bedSpot(v: Villager): [number, number] {
    const homes = this.buildings.filter((b) => b.data.type === 'home');
    if (!homes.length) return this.homeSpot(v.data.id);
    const h = homes.reduce((a, b) => (Math.hypot(b.cx - v.x, b.y - v.y) < Math.hypot(a.cx - v.x, a.y - v.y) ? b : a));
    return [h.cx + ((v.data.id % 3) - 1) * 18, h.y + 16];
  }

  // ------------------------------------------------------------ resources
  add(id: ResId, n: number, x?: number, y?: number) {
    save.village.res[id] += n;
    persist();
    this.w.game.events.emit('res', id, n, x, y);
  }
  pay(cost: Partial<Res>) {
    for (const k of Object.keys(cost) as ResId[]) save.village.res[k] -= cost[k] ?? 0;
    persist();
    this.w.game.events.emit('res', null, 0);
  }

  // ------------------------------------------------------------ buildings
  spawnBuilding(b: BuildingSave, fresh: boolean, moved = false) {
    const d = BUILD[b.type];
    const f = this.footprint(b.type, b.gx, b.gy);
    const frame = b.type === 'garden' && fresh && !moved ? 'b_garden0' : d.frame;
    const img = this.w.add.image(f.cx, f.by, atlasOf(frame), frame).setOrigin(0.5, 1).setDepth(f.by);
    const fw = this.w.textures.getFrame(atlasOf(frame), frame).width;
    img.setScale((f.w * (d.w === 1 ? 1.1 : 1.08)) / fw);
    const bar = this.w.add.graphics().setDepth(9001);
    // Solid lower part (the roof overhangs), blocked for walking.
    const sh = f.h * (d.w === 1 ? 0.45 : 0.55);
    const solid = this.w.solidRect(f.x + 6, f.y + f.h - sh - 4, f.w - 12, sh);
    const bld: Building = { data: b, img, x: f.x, y: f.y + f.h, cx: f.cx, cy: f.y + f.h / 2, worker: null, prog: 0, alt: 0, bar, solid };
    this.buildings.push(bld);
    this.w.nav.blockRect(f.x + 6, f.y + f.h - sh - 4, f.w - 12, sh, 6);
    this.w.tappables.push({ x: () => f.cx, y: () => f.y + f.h * 0.5, r: f.w * 0.45, enabled: () => !this.building && !bld.gone, tap: () => this.w.game.events.emit('card', { kind: 'building', b: bld }) });
    // 9.4: walk up to a building with a room inside and tap "Go in".
    if (HAS_INTERIOR.has(b.type)) this.w.interactables.push({ x: f.cx, y: f.by, r: 70, label: 'Go in', promptY: f.h * 0.9, approach: [0, 26], noTap: true,
      enabled: () => !this.building && !bld.gone, action: () => this.goInside(bld) });
    if (fresh) {
      const s = img.scaleX;
      img.setScale(s * 0.2, s * 0.2);
      this.w.tweens.add({ targets: img, scaleX: s, scaleY: s, duration: 520, ease: 'Back.easeOut' });
      this.w.burst(f.cx, f.by - 20, 0xfff1c4, 26, 'spark');
      this.w.burst(f.cx, f.by - 6, 0xd9b48a, 14, 'leaf');
      this.w.cameras.main.shake(160, 0.002);
      sfx.solve();
      if (b.type === 'garden' && !moved) this.w.time.delayedCall(2500, () => { if (!bld.gone) img.setTexture(atlasOf('b_garden'), 'b_garden'); });
    }
    this.dress(bld);
    return bld;
  }
  goInside(b: Building) { this.w.game.events.emit('interior', { id: b.data.id, type: b.data.type, name: BUILD[b.data.type].name }); }
  /** 11.7: the village dresses up for the theme (bunting, gourds, lanterns, wreaths, icicles). */
  dressings: Phaser.GameObjects.Image[] = [];
  /** Building id -> dressing frame keys currently shown (for tests). */
  dressKeys = new Map<number, string[]>();
  dress(b: Building) {
    if (b.gone) return;
    const t = BUILD[b.data.type];
    if (t.w === 1) return;
    const keys: string[] = [];
    const add = (key: string, x: number, y: number, ox: number, oy: number) => {
      const d = this.w.add.image(x, y, atlasOf(key), key).setOrigin(ox, oy).setDepth(b.y + 1);
      this.dressings.push(d); keys.push(key);
      d.setAlpha(0); this.w.tweens.add({ targets: d, alpha: 1, duration: 260 });
      return d;
    };
    // Old Halloween ground props (unchanged): a jack-o'-lantern and a candle by the door.
    if (theme.props) {
      add('h_jack', b.cx - 44, b.y - 2, 0.5, 1).setScale(0.55 / 2.5);
      add('h_candle', b.cx + 46, b.y - 4, 0.5, 1).setScale(0.6 / 2.5);
    }
    const s = DRESS_SPOTS[b.img.frame.name] ?? DRESS_SPOTS[t.frame];
    if (!s) { this.dressKeys.set(b.data.id, keys); return; }
    // Art units (the 150-wide building painting) -> world.
    const k = (t.w * VILLAGE.cell * 1.08) / 150;
    const P = (dx: number, dy: number): [number, number] => [b.cx + dx * k, b.y - 4 + (dy - 6) * k];
    const strip = (key: string, artH: number, dy = 0, inset = 4) => {
      const [x, y] = P(0, s.eave - 1 + dy);
      add(key, x, y, 0.5, 0).setDisplaySize((2 * s.hw - inset) * k, artH * k);
    };
    switch (theme.id) {
      case 'summer': {
        const [x, y] = P(0, s.eave - 2); const w = 2 * s.hw * k;
        add('f_bunting', x, y, 0.5, 0.2).setDisplaySize(w, w * 0.2);
        break;
      }
      case 'fall': {
        let [x, y] = P(s.gourd, 0); add('vd_gourds', x, y, 0.5, 1).setDisplaySize(56 * k * 0.9, 30 * k * 0.9);
        [x, y] = P(s.corn, 0); add('vd_corn', x, y, 0.5, 1).setDisplaySize(24 * k, 50 * k);
        break;
      }
      case 'halloween': strip('vd_lanterns', 34, 0, 10); break;
      case 'christmas': {
        strip('vd_lights', 22);
        if (s.wreath) { const [x, y] = P(s.wreath[0], s.wreath[1]); add('vd_wreath', x, y, 0.5, 0.5).setDisplaySize(26 * k, 30 * k); }
        break;
      }
      case 'winter': {
        if (s.roof) {
          const r = s.roof; const [x, y] = P(0, r.top - 3);
          add(r.kind === 'tri' ? 'vd_snowtri' : 'vd_snowtrap', x, y, 0.5, 0).setDisplaySize((2 * r.hw + 6) * k, (r.base - r.top + 6) * k);
          strip('vd_icicles', 30, 0, 2);
        } else {
          for (const dx of [-58, 58]) { const [x, y] = P(dx, 2); add('vd_snowpile', x, y, 0.5, 1).setDisplaySize(40 * k, 18 * k).setFlipX(dx > 0); }
        }
        break;
      }
    }
    this.dressKeys.set(b.data.id, keys);
  }
  restyle() {
    for (const d of this.dressings) d.destroy();
    this.dressings = [];
    this.dressKeys.clear();
    for (const b of this.buildings) this.dress(b);
  }

  // ------------------------------------------------------------ build mode
  enterBuild() {
    this.w.boat?.forceOut();
    if (this.building) return;
    if (this.w.mount?.carrying) this.w.mount.dropNow(); // hop off first: build mode needs feet on the ground
    this.building = true;
    this.grid.setVisible(true);
    this.drawGrid();
    this.w.enterBuildView();
    this.w.game.events.emit('build-mode', true);
  }
  exitBuild() {
    if (!this.building) return;
    this.building = false;
    this.select(null);
    this.grid.setVisible(false);
    this.w.exitBuildView();
    this.w.game.events.emit('build-mode', false);
  }
  drawGrid() {
    const g = this.grid; g.clear();
    const c = VILLAGE.cell;
    g.fillStyle(0xffffff, 0.12); g.fillRoundedRect(VILLAGE.x - 6, VILLAGE.y - 6, VILLAGE.cols * c + 12, VILLAGE.rows * c + 12, 16);
    for (let y = 0; y < VILLAGE.rows; y++) for (let x = 0; x < VILLAGE.cols; x++) {
      const [px, py] = this.cellXY(x, y);
      if (this.occupied(x, y)) continue;
      g.lineStyle(2, 0xffffff, 0.55); g.strokeRoundedRect(px + 4, py + 4, c - 8, c - 8, 10);
    }
  }
  select(t: BuildingType | null, at?: [number, number]) {
    this.selected = t;
    if (this.ghost) { this.ghost.img.destroy(); this.ghost.check.destroy(); this.ghost.cross.destroy(); this.ghost = null; }
    if (this.moving && !at) { this.moving.img.setAlpha(1); this.moving = null; this.drawGrid(); }
    if (!t) return;
    const spot = at ?? this.firstFree(t);
    if (!spot) { this.w.game.events.emit('toast', 'No room left! The village is full.'); this.selected = null; return; }
    const d = BUILD[t];
    const img = this.w.add.image(0, 0, atlasOf(d.frame), d.frame).setOrigin(0.5, 1).setAlpha(0.8).setDepth(9100);
    const check = this.w.add.image(0, 0, atlasOf('i_check'), 'i_check').setScale(1.15 / 2.5).setDepth(9102);
    const cross = this.w.add.image(0, 0, atlasOf('i_cross'), 'i_cross').setScale(0.95 / 2.5).setDepth(9102);
    this.ghost = { img, gx: spot[0], gy: spot[1], ok: true, check, cross };
    this.moveGhost(spot[0], spot[1]);
  }
  moveGhost(gx: number, gy: number) {
    const g = this.ghost; if (!g || !this.selected) return;
    const t = this.selected, d = BUILD[t];
    gx = Phaser.Math.Clamp(gx, 0, VILLAGE.cols - d.w); gy = Phaser.Math.Clamp(gy, 0, VILLAGE.rows - d.h);
    g.gx = gx; g.gy = gy; g.ok = this.canPlace(t, gx, gy);
    const f = this.footprint(t, gx, gy);
    const fw = this.w.textures.getFrame(atlasOf(d.frame), d.frame).width;
    g.img.setPosition(f.cx, f.by).setScale((f.w * (d.w === 1 ? 1.1 : 1.08)) / fw).setTint(g.ok ? 0xffffff : 0xff9a9a);
    const top = f.by - g.img.displayHeight;
    g.check.setPosition(f.cx + 30, top - 24).setVisible(g.ok);
    g.cross.setPosition(f.cx - 30, top - 24);
    this.drawGrid();
    this.grid.fillStyle(g.ok ? 0x7cc463 : 0xf08a7a, 0.35); this.grid.fillRoundedRect(f.x + 3, f.y + 3, f.w - 6, f.h - 6, 12);
  }
  /** Dragging a finger in build mode slides the ghost along the grid. */
  dragGhost(wx: number, wy: number) {
    if (!this.ghost || !this.selected) return;
    const d = BUILD[this.selected];
    const gx = Math.floor((wx - VILLAGE.x) / VILLAGE.cell - (d.w - 1) / 2), gy = Math.floor((wy - VILLAGE.y) / VILLAGE.cell - (d.h - 1) / 2);
    if (gx !== this.ghost.gx || gy !== this.ghost.gy) { this.moveGhost(gx, gy); sfx.tock(); }
  }
  /** A tap in build mode: buttons first, then move the ghost to the tapped cell. */
  buildTap(wx: number, wy: number) {
    const g = this.ghost;
    // Order 19: nothing picked yet, so a tap on a building picks it up to move it.
    if (!g) { const b = this.buildingAt(wx, wy); if (b) this.startMove(b); return; }
    if (g) {
      if (g.check.visible && Math.hypot(wx - g.check.x, wy - g.check.y) < 34) { this.confirm(); return; }
      if (Math.hypot(wx - g.cross.x, wy - g.cross.y) < 30) { this.select(null); sfx.blip(); this.drawGrid(); return; }
      const d = BUILD[this.selected!];
      const gx = Math.floor((wx - VILLAGE.x) / VILLAGE.cell - (d.w - 1) / 2), gy = Math.floor((wy - VILLAGE.y) / VILLAGE.cell - (d.h - 1) / 2);
      if (wx > VILLAGE.x - 40 && wx < VILLAGE.x + VILLAGE.cols * VILLAGE.cell + 40 && wy > VILLAGE.y - 60 && wy < VILLAGE.y + VILLAGE.rows * VILLAGE.cell + 40) { this.moveGhost(gx, gy); sfx.tock(); }
    }
  }
  confirm() {
    const g = this.ghost, t = this.selected;
    if (!g || !t || !g.ok) return;
    if (this.moving) { this.finishMove(g.gx, g.gy); return; }
    const d = BUILD[t];
    if (!canAfford(d.cost)) { this.w.game.events.emit('toast', 'Not enough yet. Gather more!'); sfx.softFail(); return; }
    this.pay(d.cost);
    const b: BuildingSave = { id: save.village.nextId++, type: t, gx: g.gx, gy: g.gy };
    save.village.buildings.push(b);
    persist();
    this.spawnBuilding(b, true);
    this.select(null);
    this.drawGrid();
    this.w.game.events.emit('built', t);
    this.w.game.events.emit('toast', `You built a ${d.name}!`);
  }

  // ------------------------------------------------------------ move / remove (Order 19)
  /** Pick a building up: it fades, and a ghost of it slides to a new spot (free, no cost). */
  startMove(b: Building) {
    if (b.gone) return;
    this.enterBuild();
    this.select(null);
    this.moving = b;
    b.img.setAlpha(0.3);
    this.select(b.data.type, [b.data.gx, b.data.gy]);
    sfx.blip();
    this.w.game.events.emit('build-moving', b.data.type);
  }
  /** Take the building's sprite, wall and tap spot out of the world (its save entry is handled by the caller). */
  private takeDown(b: Building) {
    b.gone = true;
    b.img.destroy(); b.bar.destroy(); b.solid.destroy();
    this.buildings = this.buildings.filter((o) => o !== b);
    for (const v of this.villagers) if (v.suggest?.kind === 'assign' && v.suggest.b === b) this.setBubble(v, null);
  }
  private finishMove(gx: number, gy: number) {
    const b = this.moving!;
    const same = gx === b.data.gx && gy === b.data.gy;
    this.moving = null;
    this.select(null);
    if (same) { b.img.setAlpha(1); this.drawGrid(); return; }
    const worker = b.worker;
    this.takeDown(b);
    b.data.gx = gx; b.data.gy = gy;
    persist();
    const nb = this.spawnBuilding(b.data, true, true);
    nb.worker = worker;
    this.w.buildNav();
    this.restyle();
    // Friends heading to the old spot pick a new path.
    for (const v of this.villagers) if (v.task === 'walk' || v.task === 'work' || v.task === 'eat' || v.task === 'sleep') { v.path = []; v.clearMark(); v.task = 'idle'; v.think = 0.3; }
    this.moved++;
    this.drawGrid();
    this.w.game.events.emit('built', b.data.type);
    this.w.game.events.emit('toast', `Your ${BUILD[b.data.type].name} moved!`);
  }
  /** Can this building go away without leaving a friend with no bed? */
  canRemove(b: Building) {
    return BUILD[b.data.type].beds === 0 || save.village.villagers.length <= this.beds() - BUILD[b.data.type].beds;
  }
  /** Remove a building: everything it cost comes back, and its worker is free again. */
  removeBuilding(b: Building) {
    if (b.gone) return false;
    if (!this.canRemove(b)) { this.w.game.events.emit('toast', 'Friends sleep here! Build another Home first.'); sfx.softFail(); return false; }
    const d = BUILD[b.data.type];
    if (b.worker) { b.worker.data.job = null; b.worker.task = 'idle'; b.worker.path = []; b.worker.think = 0.3; }
    for (const v of this.villagers) if (v.data.job === b.data.id) v.data.job = null;
    const fx = b.cx, fy = b.y;
    this.takeDown(b);
    save.village.buildings = save.village.buildings.filter((o) => o !== b.data);
    for (const k of Object.keys(d.cost) as ResId[]) if (d.cost[k]) this.add(k, d.cost[k]!, fx, fy - 70);
    persist();
    this.w.buildNav();
    this.restyle();
    for (const v of this.villagers) if (v.task === 'walk' || v.task === 'eat' || v.task === 'sleep' || v.task === 'play') { v.path = []; v.clearMark(); v.task = 'idle'; v.think = 0.3; }
    this.w.burst(fx, fy - 30, 0xfff1c4, 22, 'spark');
    this.w.burst(fx, fy - 10, 0xd9b48a, 16, 'leaf');
    sfx.thump();
    this.removed++;
    if (this.building) this.drawGrid();
    this.w.game.events.emit('toast', `Bye-bye, ${d.name}! Your ${(Object.keys(d.cost) as ResId[]).join(' and ')} came back.`);
    return true;
  }

  // ------------------------------------------------------------ villagers
  newGuest() {
    const r = Math.random;
    const used = new Set(save.village.villagers.map((v) => v.name));
    const names = NAMES.filter((n) => !used.has(n));
    const d: VillagerSave = { id: 0, name: names[Math.floor(r() * names.length)] ?? 'Pip', trait: TRAITS[Math.floor(r() * TRAITS.length)], kind: Math.floor(r() * KINDS.length), job: null, food: 1, sleep: 1, fun: 1 };
    const g = new Villager(this, d, VILLAGE_ENTRY.x + 60, VILLAGE_ENTRY.y + 30, true);
    g.task = 'wander';
    this.wanderer = g;
    this.w.tappables.push({ x: () => g.x, y: () => g.y - 26, r: 34, enabled: () => this.wanderer === g && !this.building, tap: () => this.w.game.events.emit('card', { kind: 'guest', v: g }) });
    this.w.game.events.emit('toast', `${d.name} is visiting! Tap to say hi.`);
    sfx.chirp();
  }
  invite(): boolean {
    const g = this.wanderer;
    if (!g) return false;
    if (save.village.villagers.length >= this.beds()) return false;
    g.data.id = save.village.nextId++;
    save.village.villagers.push(g.data);
    persist();
    g.guest = false;
    this.wanderer = null;
    this.wanderTimer = 30;
    this.villagers.push(g);
    this.addTap(g);
    g.task = 'idle'; g.think = 0.5;
    g.face.setTexture(atlasOf('f_happy'), 'f_happy');
    this.w.burst(g.x, g.y - 30, 0xff9ccf, 18, 'spark');
    this.w.life.hearts.emitParticleAt(g.x, g.y - 50, 5);
    sfx.sparkle();
    this.w.game.events.emit('invited', g.data.name);
    return true;
  }
  addTap(v: Villager) {
    this.w.tappables.push({ x: () => v.x, y: () => v.y - 108, r: 34, enabled: () => !!v.bubble && this.villagers.includes(v) && !this.building, tap: () => this.acceptSuggestion(v) });
    // Order 19: with fruit in the basket, tapping a friend who isn't full feeds them (same toss as animals);
    // a full (or sleeping) friend opens their card as before.
    this.w.tappables.push({ x: () => v.x, y: () => v.y - 26, r: 32, enabled: () => this.villagers.includes(v) && !this.building,
      tap: () => this.w.game.events.emit('card', { kind: 'villager', v }),
      canFeed: () => v.data.food < 0.9 && v.task !== 'sleep' && v.task !== 'drag', feed: () => this.feedFruit(v), fedMsg: `Yum! Thank you, ${v.data.name}!` });
  }
  /** Fruit from your basket: a friend is full again (and a little happier), and stops walking off to eat. */
  fruitFed = 0;
  feedFruit(v: Villager) {
    const d = v.data;
    d.food = 1; d.fun = Math.min(1, d.fun + 0.15);
    if (v.task === 'eat' || (v.task === 'walk' && v.next === 'eat')) { v.path = []; v.task = 'idle'; v.think = 1.2; v.clearMark(); }
    v.hop = 0;
    this.fruitFed++;
    persist();
    this.checkT = 0;
  }
  villagerAt(wx: number, wy: number): Villager | null {
    let best: Villager | null = null, bd = 38;
    for (const v of this.villagers) { const d = Math.hypot(wx - v.x, wy - (v.y - 26)); if (d < bd) { bd = d; best = v; } }
    return best;
  }
  buildingAt(wx: number, wy: number): Building | null {
    for (const b of this.buildings) {
      const d = BUILD[b.data.type];
      const top = b.y - b.img.displayHeight;
      if (wx > b.cx - d.w * VILLAGE.cell / 2 && wx < b.cx + d.w * VILLAGE.cell / 2 && wy > top && wy < b.y + 10) return b;
    }
    return null;
  }
  startDrag(v: Villager) { v.task = 'drag'; v.path = []; v.hop = 0; sfx.blip(); }
  dragTo(v: Villager, wx: number, wy: number) {
    v.x = wx; v.y = wy + 34;
    const b = this.buildingAt(wx, wy);
    for (const o of this.buildings) o.img.setTint(o === b && BUILD[o.data.type].job ? 0xfff2b0 : 0xffffff);
  }
  drop(v: Villager, wx: number, wy: number) {
    for (const o of this.buildings) o.img.setTint(0xffffff);
    const b = this.buildingAt(wx, wy);
    v.task = 'idle'; v.think = 0.3;
    if (!b) { const [x, y] = this.w.nav.isBlocked(...this.w.nav.cellOf(v.x, v.y)) ? this.homeSpot(v.data.id) : [v.x, v.y]; v.x = x; v.y = y; return false; }
    const d = BUILD[b.data.type];
    if (!d.job) { this.w.game.events.emit('toast', d.beds ? `${v.data.name} likes this home!` : `${v.data.name} loves it here!`); v.x = b.cx; v.y = b.y + 18; return false; }
    this.assign(v, b);
    return true;
  }
  assign(v: Villager, b: Building) {
    const d = BUILD[b.data.type];
    if (b.worker && b.worker !== v) { b.worker.data.job = null; }
    for (const o of this.buildings) if (o.worker === v) o.worker = null;
    b.worker = v; v.data.job = b.data.id;
    persist();
    v.x = b.cx; v.y = b.y + 18;
    v.task = 'idle'; v.think = 0;
    this.w.burst(b.cx, b.y - 40, 0xfff1c4, 16, 'spark');
    sfx.pickup();
    this.w.game.events.emit('toast', `${v.data.name} is now a ${d.job}!`);
    this.w.game.events.emit('assigned', v.data.id, b.data.type);
  }

  // ------------------------------------------------------------ simulation
  update(dt: number, time: number) {
    dt *= this.speed;
    // Guests.
    if (!this.wanderer && save.village.villagers.length < 8) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) this.newGuest();
    }
    if (this.wanderer) this.tick(this.wanderer, dt, time);
    for (const v of this.villagers) this.tick(v, dt, time);
    for (const b of this.buildings) this.work(b, dt);
    this.events(dt, time);
    this.checkT -= dt;
    if (this.checkT <= 0) { this.checkT = 1; this.think(); }
  }

  // ------------------------------------------------------------ friendly helpers (no fail states)
  checkT = 0.5;
  alert: Alert | null = null;
  gifts = 0;
  /** What job would make this friend happy? A free building that fits, any free one, or a new one to build. */
  suggestFor(v: Villager): Suggest | null {
    const want = TRAIT_JOB[v.data.trait] ?? 'garden';
    const free = this.buildings.filter((b) => BUILD[b.data.type].job && !b.worker);
    const fit = free.find((b) => b.data.type === want) ?? free[0];
    if (fit) return { kind: 'assign', b: fit };
    if (this.building) return null;
    for (const t of [want, 'garden', 'workshop'] as BuildingType[]) if (isUnlockedB(t) && canAfford(BUILD[t].cost) && this.firstFree(t)) return { kind: 'build', t };
    return null;
  }
  private think() {
    for (const v of this.villagers) {
      const s = v.data.job === null && v.idleT > 5 && !this.building ? this.suggestFor(v) : null;
      const same = s && v.suggest && s.kind === v.suggest.kind && (s.kind === 'assign' ? s.b === (v.suggest as any).b : s.t === (v.suggest as any).t);
      if (!same) this.setBubble(v, s);
    }
    const a = this.findAlert();
    if ((a?.id ?? null) !== (this.alert?.id ?? null)) { this.alert = a; this.w.game.events.emit('alert', a); }
    else this.alert = a;
  }
  private setBubble(v: Villager, s: Suggest | null) {
    v.suggest = s;
    v.bubble?.destroy(); v.bubble = null;
    if (!s) return;
    const w = this.w;
    const g = w.add.graphics();
    g.fillStyle(0x2a1d14, 0.25); g.fillCircle(1, 3, 27);
    g.fillStyle(0xffffff, 1); g.fillCircle(0, 0, 27);
    g.fillTriangle(-7, 22, 7, 22, 0, 34);
    g.lineStyle(3, theme.ui.accent, 1); g.strokeCircle(0, 0, 25.5);
    const frame = s.kind === 'assign' ? BUILD[s.b.data.type].frame : BUILD[s.t].frame;
    const im = w.add.image(0, 2, atlasOf(frame), frame);
    im.setScale(Math.min(38 / im.width, 34 / im.height));
    const parts: Phaser.GameObjects.GameObject[] = [g, im];
    if (s.kind === 'build') parts.push(w.add.image(17, -17, atlasOf('i_hammer'), 'i_hammer').setDisplaySize(22, 22));
    else parts.push(w.add.image(17, -17, atlasOf('i_check'), 'i_check').setDisplaySize(20, 20));
    const c = w.add.container(v.x, v.y - 108, parts).setDepth(9050).setScale(0.2);
    w.tweens.add({ targets: c, scale: 1, duration: 360, ease: 'Back.easeOut' });
    v.bubble = c;
    sfx.blip();
  }
  /** One tap on the bubble: take the job (undoable) or start building the right place. */
  acceptSuggestion(v: Villager) {
    const s = v.suggest;
    if (!s) return;
    this.setBubble(v, null);
    v.idleT = -20;
    if (s.kind === 'assign') {
      const prev = v.data.job;
      this.assign(v, s.b);
      this.w.game.events.emit('undo', {
        label: `Undo`, run: () => {
          if (s.b.worker === v) s.b.worker = null;
          v.data.job = prev;
          const pb = prev !== null ? this.buildings.find((b) => b.data.id === prev) : null;
          if (pb) pb.worker = v;
          persist();
          v.task = 'idle'; v.think = 0.3;
          this.w.game.events.emit('toast', `Okay! ${v.data.name} is free.`);
        },
      });
    } else {
      this.enterBuild();
      this.w.game.events.emit('build-pick', s.t);
    }
  }
  private findAlert(): Alert | null {
    const w = this.w, res = save.village.res;
    if (this.building) return null;
    // 1. A visitor wants to stay but there is no bed.
    if (this.wanderer && save.village.villagers.length >= this.beds()) {
      const name = this.wanderer.data.name;
      return { id: 'home', icon: 'b_home', text: `${name} needs a home!`, fix: 'Build', fixIcon: 'i_hammer', urgent: false, run: () => {
        if (!canAfford(BUILD.home.cost)) this.gift();
        this.enterBuild(); w.game.events.emit('build-pick', 'home');
      } };
    }
    // 2. A friend who really needs something right now.
    for (const v of this.villagers) {
      const d = v.data;
      if (v.task === 'drag' || v.task === 'eat' || v.task === 'sleep' || v.task === 'play') continue;
      // Friends look after themselves; only call for help when they can't (no food left) or it takes too long.
      if (d.food < 0.25 && res.food <= 0) return { id: `food${d.id}`, icon: 'i_food', text: `${d.name} is hungry!`, fix: 'Snack', fixIcon: 'i_food', urgent: true, run: () => this.care(v, 'food') };
      if (d.sleep < 0.1) return { id: `sleep${d.id}`, icon: 'i_sleep', text: `${d.name} is sleepy!`, fix: 'Nap', fixIcon: 'i_sleep', urgent: true, run: () => this.care(v, 'sleep') };
      if (d.fun < 0.1) return { id: `fun${d.id}`, icon: 'i_fun', text: `${d.name} is bored!`, fix: 'Play', fixIcon: 'i_fun', urgent: true, run: () => this.care(v, 'fun') };
    }
    // 3. Out of things to build with and nothing makes more: friends bring a gift.
    const core: BuildingType[] = ['home', 'garden', 'kitchen', 'workshop', 'fishhut'];
    const stuck = !core.some((t) => isUnlockedB(t) && canAfford(BUILD[t].cost));
    if (stuck && !this.cart && !this.buildings.some((b) => b.data.type === 'workshop' && b.worker)) {
      return { id: 'wood', icon: 'i_wood', text: 'Need more wood?', fix: 'Get some', fixIcon: 'i_wood', urgent: false, run: () => this.gift() };
    }
    return null;
  }
  /** Friends find a little pile of wood and stone. Always works, so building never gets stuck. */
  gift() {
    this.gifts++;
    this.add('wood', 4, VILLAGE_SIGN.x, VILLAGE_SIGN.y - 90);
    this.add('stone', 2, VILLAGE_SIGN.x + 40, VILLAGE_SIGN.y - 90);
    this.w.burst(VILLAGE_SIGN.x, VILLAGE_SIGN.y - 60, 0xfff1c4, 18, 'spark');
    sfx.sparkle();
    this.w.game.events.emit('toast', 'Friends found wood and stone!');
  }
  /** The one-tap fix on a need alert. */
  care(v: Villager, need: 'food' | 'sleep' | 'fun') {
    const d = v.data;
    v.path = [];
    if (need === 'food') {
      if (save.village.res.food > 0) { save.village.res.food--; this.w.game.events.emit('res', null, 0); }
      else if (save.snacks > 0) { const k = takeFruit(); if (k === 'berry') this.w.berriesFed++; this.w.game.events.emit('snacks', save.snacks); }
      d.food = 1; this.w.floatText(v.x, v.y - 70, 'Yum!'); v.task = 'idle'; v.think = 1; }
    if (need === 'sleep') { v.task = 'sleep'; v.timer = 3; this.w.floatText(v.x, v.y - 60, 'Zzz'); }
    if (need === 'fun') { v.task = 'play'; v.timer = 3; d.fun = Math.max(d.fun, 0.5); this.w.floatText(v.x, v.y - 70, 'Wheee!'); }
    this.w.life.hearts.emitParticleAt(v.x, v.y - 50, 4);
    sfx.sparkle();
    persist();
    this.checkT = 0;
  }

  private tick(v: Villager, dt: number, time: number) {
    const d = v.data;
    if (!v.guest) {
      const nap = d.trait === 'Loves naps' ? 1.4 : 1;
      d.food = Math.max(0, d.food - dt / 160);
      d.sleep = Math.max(0, d.sleep - dt * nap / 220);
      d.fun = this.festival > 0 ? 1 : Math.max(0, d.fun - dt / 180);
    }
    let moving = false;
    const free = v.task === 'idle' || v.task === 'wander' || (v.task === 'walk' && v.next === 'idle');
    v.idleT = free ? v.idleT + dt : Math.min(v.idleT, 0);
    if (v.task === 'walk') {
      v.walkT += dt;
      // Never stuck: if a walk takes far too long, hop straight to the end.
      if (v.walkT > 30 && v.path.length) { const [ex, ey] = v.path[v.path.length - 1]; v.x = ex; v.y = ey; v.path = [[ex, ey]]; }
      if (!v.path.length) { v.task = v.next; v.timer = 3; }
    }
    if (v.task === 'walk' && v.path.length) {
      const [tx, ty] = v.path[0];
      const dx = tx - v.x, dy = ty - v.y, dist = Math.hypot(dx, dy);
      const step = v.speed() * dt;
      if (dist <= step) { v.x = tx; v.y = ty; v.path.shift(); }
      else { v.x += dx / dist * step; v.y += dy / dist * step; v.img.setFlipX(dx < 0); }
      moving = true;
      if (!v.path.length) { v.task = v.next; v.timer = v.task === 'sleep' ? 7 : v.task === 'eat' ? 4 : v.task === 'play' ? 5 : 0; this.arrive(v); }
    } else if (v.task === 'wander') {
      v.think -= dt;
      if (v.think <= 0) { v.think = 2 + Math.random() * 3; v.path = [[VILLAGE_ENTRY.x + (Math.random() - 0.3) * 120, VILLAGE_ENTRY.y + (Math.random() - 0.5) * 160]]; }
      if (v.path.length) {
        const [tx, ty] = v.path[0]; const dx = tx - v.x, dy = ty - v.y, dist = Math.hypot(dx, dy);
        if (dist < 2) v.path = []; else { v.x += dx / dist * 30 * dt; v.y += dy / dist * 30 * dt; v.img.setFlipX(dx < 0); moving = true; }
      }
    } else if (v.task === 'eat' || v.task === 'sleep' || v.task === 'play') {
      v.timer -= dt;
      if (v.task === 'play') v.hop += dt * 9;
      if (v.timer <= 0) {
        if (v.task === 'eat') { if (save.village.res.food > 0) { save.village.res.food--; d.food = 1; this.w.game.events.emit('res', null, 0); } else d.food = 0.7; }
        if (v.task === 'sleep') d.sleep = 1;
        if (v.task === 'play') d.fun = 1;
        persist();
        v.task = 'idle'; v.think = 0.4; v.hop = 0;
      }
    } else if (v.task === 'idle' || v.task === 'work') {
      v.think -= dt;
      if (v.think <= 0) { v.think = 1.5; this.decide(v); }
    }
    // Draw.
    if (v.task === 'drag') { v.hop += dt * 14; }
    if (moving) { v.stepT += dt; if (v.stepT > 0.17) { v.stepT = 0; v.frame ^= 1; v.img.setFrame(v.key()); } }
    else if (v.frame) { v.frame = 0; v.img.setFrame(v.key()); }
    const festive = this.festival > 0 && v.task !== 'drag' && !v.guest;
    const bob = v.task === 'drag' ? -10 + Math.sin(v.hop) * 3 : v.task === 'work' ? -Math.abs(Math.sin(time / 180 + d.id)) * 4 : (v.task === 'play' || festive) ? -Math.abs(Math.sin(v.hop + time / 160 + d.id)) * 9 : moving ? -Math.abs(Math.sin(v.stepT * 18)) * 2 : 0;
    v.img.setPosition(v.x, v.y + bob).setDepth(v.task === 'drag' ? 9200 : v.y);
    v.img.setAngle(v.task === 'sleep' ? (v.img.flipX ? -80 : 80) : v.task === 'drag' ? Math.sin(v.hop * 0.7) * 10 : 0);
    v.shadow.setPosition(v.x, v.y - 2).setVisible(v.task !== 'sleep');
    if (!v.guest) { const m = v.task === 'sleep' ? 'i_sleep' : v.mood(); if (v.face.frame.name !== m) v.face.setTexture(atlasOf(m), m); }
    const fy = v.y + bob - 58 + Math.sin(time / 300 + d.id) * 1.5;
    v.face.setPosition(v.x, fy).setVisible(v.task !== 'drag');
    // Urgency colours: amber halo when so-so, a soft coral pulse when they really need care.
    const urg = v.urgency();
    const fs = 0.42 / (frameScale.f_happy ?? 2.5), rs = 1.0 / (frameScale.f_ring ?? 2.5);
    if (urg === 0 || v.task === 'drag') { v.ring.setVisible(false); v.face.setScale(fs); }
    else {
      const p = urg === 2 ? 0.5 + 0.5 * Math.sin(time / 220 + d.id) : 0.5;
      v.ring.setVisible(true).setPosition(v.x, fy).setTint(urg === 2 ? 0xff6a5a : 0xffc04d)
        .setAlpha(urg === 2 ? 0.75 + 0.25 * p : 0.8).setScale(rs * (urg === 2 ? 1 + 0.22 * p : 1));
      v.face.setScale(fs * (urg === 2 ? 1.08 + 0.1 * p : 1.04));
    }
    if (v.mark) {
      if (v.task !== 'walk' || (v.next !== 'eat' && v.next !== 'sleep')) v.clearMark();
      else v.mark.setPosition(v.markAt[0], v.markAt[1] - 70 - Math.abs(Math.sin(time / 240 + d.id)) * 10).setVisible(!this.building);
    }
    if (v.bubble) v.bubble.setPosition(v.x, v.y + bob - 108 + Math.sin(time / 260 + d.id) * 3).setVisible(v.task !== 'drag' && !this.building);
  }

  private arrive(v: Villager) {
    if (v.task === 'eat') this.w.floatText(v.x, v.y - 70, 'Yum!');
    if (v.task === 'sleep') this.w.floatText(v.x, v.y - 60, 'Zzz');
    if (v.task === 'play') this.w.floatText(v.x, v.y - 70, 'Wheee!');
  }

  private decide(v: Villager) {
    const d = v.data;
    const low = Math.min(d.food, d.sleep, d.fun);
    if (low < 0.3) {
      if (d.food === low) {
        const f = this.foodSpot(v);
        v.goTo(f.x, f.y, 'eat');
        // A far walk for a snack: suggest a Snack Crate near the homes (once).
        if (Math.hypot(f.x - v.x, f.y - v.y) > 380 && !this.buildings.some((b) => b.data.type === 'pantry') && tipOnce('pantry')) {
          this.w.game.events.emit('toast', `${d.name} walks far to eat. Build a Snack Crate near the homes!`);
        }
        return;
      }
      if (d.sleep === low) {
        const [x, y] = this.bedSpot(v); v.goTo(x, y, 'sleep');
        if (Math.hypot(x - v.x, y - v.y) > 520 && tipOnce('nearbed')) this.w.game.events.emit('toast', `${d.name} walks far to nap. More homes = closer beds!`);
        return;
      }
      const decor = this.buildings.filter((b) => BUILD[b.data.type].fun);
      const p = decor.length ? decor[Math.floor(Math.random() * decor.length)] : null;
      const [x, y] = p ? [p.cx + (Math.random() - 0.5) * 40, p.y + 14] : [VILLAGE.x + Math.random() * VILLAGE.cols * VILLAGE.cell, VILLAGE.y + VILLAGE.rows * VILLAGE.cell + 24];
      v.goTo(x, y, 'play'); return;
    }
    const job = d.job !== null ? this.buildings.find((b) => b.data.id === d.job) : null;
    if (job) {
      const wx = job.cx + ((d.id % 3) - 1) * 14, wy = job.y + 16;
      if (Math.hypot(v.x - wx, v.y - wy) > 10) { v.goTo(wx, wy, 'work'); return; }
      v.task = 'work'; return;
    }
    // Free time: wander a little around the village.
    if (Math.random() < 0.5) {
      const x = VILLAGE.x + 20 + Math.random() * (VILLAGE.cols * VILLAGE.cell - 40);
      const y = VILLAGE.y + VILLAGE.rows * VILLAGE.cell + 12 + Math.random() * 40;
      v.goTo(x, y, 'idle');
    }
  }

  private work(b: Building, dt: number) {
    const d = BUILD[b.data.type];
    const v = b.worker;
    b.bar.clear();
    if (!d.makes || !v || v.task !== 'work') return;
    const boost = this.rain > 0 && b.data.type === 'garden' ? 2 : 1;
    b.prog += dt * boost / d.every;
    // A tiny progress ring over the door.
    const x = b.cx, y = b.y - b.img.displayHeight - 8;
    b.bar.fillStyle(0xffffff, 0.85); b.bar.fillCircle(x, y, 9);
    b.bar.lineStyle(4, 0x7cc463, 1); b.bar.beginPath(); b.bar.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, b.prog), false); b.bar.strokePath();
    if (b.prog >= 1) {
      b.prog = 0;
      const id: ResId = d.makes === 'woodstone' ? (b.alt++ % 2 ? 'stone' : 'wood') : d.makes;
      this.add(id, d.amount, b.cx, y - 10);
      this.produced++;
      sfx.pickup();
    }
  }

  // ------------------------------------------------------------ gentle events
  private events(dt: number, time: number) {
    const w = this.w;
    if (this.rain > 0) {
      this.rain -= dt;
      const v = w.cameras.main.worldView;
      (this.rainFx as any).emitZone?.length; // keep type quiet
      this.rainFx.setPosition(v.x, v.y - 40);
      (this.rainFx.emitZones[0] as any).source.setTo(0, 0, v.width + 200, 20);
      this.rainTint.setSize(this.w.scale.width, this.w.scale.height).setFillStyle(0x6d7f9e, Math.min(0.22, this.rain * 0.1));
      if (this.rain <= 0) { this.rainFx.stop(); this.rainTint.setFillStyle(0x6d7f9e, 0); w.game.events.emit('toast', 'The rain stopped. Hello, sun!'); }
    }
    if (this.festival > 0) {
      this.festival -= dt;
      if (Math.random() < dt * 3) { const b = this.bunting[Math.floor(Math.random() * this.bunting.length)]; if (b) w.burst(b.x + (Math.random() - 0.5) * 160, b.y + 10, [0xff7fa8, 0xffd84d, 0x7fd0ff, 0x7cc463][Math.floor(Math.random() * 4)], 3, 'petal'); }
      if (this.festival <= 0) { sfx.festival = false; for (const b of this.bunting) w.tweens.add({ targets: b, alpha: 0, duration: 800, onComplete: () => b.destroy() }); this.bunting = []; w.game.events.emit('toast', 'What a fun festival!'); }
    }
    if (this.merchant > 0) {
      this.merchant -= dt;
      if (this.merchant <= 0 && this.cart) { const c = this.cart; this.cart = null; w.tweens.add({ targets: c, x: c.x + 300, alpha: 0, duration: 1500, onComplete: () => c.destroy() }); w.game.events.emit('toast', 'The merchant waves goodbye!'); }
    }
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.eventTimer = 150 + Math.random() * 90;
      const opts: ('merchant' | 'rain' | 'festival')[] = ['merchant', 'rain'];
      if (save.village.villagers.length >= 2) opts.push('festival');
      this.start(opts[Math.floor(Math.random() * opts.length)]);
    }
    void time;
  }

  start(e: 'merchant' | 'rain' | 'festival') {
    const w = this.w;
    save.village.events++;
    if (e === 'rain' && this.rain <= 0) {
      this.rain = 70;
      this.rainFx.start();
      w.game.events.emit('toast', 'Rainy day! Plants love rain.');
    } else if (e === 'festival' && this.festival <= 0) {
      this.festival = 50;
      sfx.festival = true;
      for (let i = 0; i < 3; i++) {
        const b = w.add.image(VILLAGE.x + 120 + i * 230, VILLAGE.y - 10 + (i % 2) * 14, atlasOf('f_bunting'), 'f_bunting').setScale(1.1 / 2).setDepth(VILLAGE.y + 400).setAlpha(0);
        w.tweens.add({ targets: b, alpha: 1, duration: 600 });
        this.bunting.push(b);
      }
      for (const v of this.villagers) v.data.fun = 1;
      sfx.chimes();
      w.game.events.emit('toast', 'Festival time! Everyone dances!');
    } else if (e === 'merchant' && !this.cart) {
      this.merchant = 120;
      const c = w.add.image(MERCHANT_SPOT.x + 300, MERCHANT_SPOT.y, atlasOf('v_cart'), 'v_cart').setOrigin(0.5, 1).setScale(1 / 2.4).setDepth(MERCHANT_SPOT.y).setAlpha(0);
      w.tweens.add({ targets: c, x: MERCHANT_SPOT.x, alpha: 1, duration: 1600, ease: 'Sine.easeOut' });
      this.cart = c;
      w.tappables.push({ x: () => c.x, y: () => c.y - 40, r: 60, enabled: () => this.cart === c && !this.building, tap: () => w.game.events.emit('card', { kind: 'merchant' }) });
      sfx.chimes();
      w.game.events.emit('toast', 'A merchant came to trade!');
    }
    persist();
  }
  /** Merchant trades: give some of one thing, get more of another. */
  static TRADES: { give: Partial<Res>; get: Partial<Res> }[] = [
    { give: { food: 3 }, get: { wood: 4 } },
    { give: { food: 3 }, get: { stone: 3 } },
    { give: { wood: 3 }, get: { food: 4 } },
  ];
  trade(i: number) {
    const t = Village.TRADES[i];
    if (!t || !canAfford(t.give)) return false;
    this.pay(t.give);
    for (const k of Object.keys(t.get) as ResId[]) this.add(k, t.get[k] ?? 0, MERCHANT_SPOT.x, MERCHANT_SPOT.y - 80);
    sfx.sparkle();
    return true;
  }
  /** Cottage coordinates are re-exported for the picnic fallback when Grandma's home is used. */
  static COTTAGE = COTTAGE;
}
