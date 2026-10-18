// Tap reactions for scenery (trees, flowers, bushes, rocks, chimes) and small pickups.
import Phaser from 'phaser';
import { ATLAS, atlasOf, PICKUP_BUBBLE, PICKUP_ICON } from './art';
import { theme } from './theme';
import { sfx } from './audio';
import { addMinor, save, persist, tipOnce } from './save';
import type { WorldScene } from './scenes/World';

/** How long a stump stays before it fades back into grass (game time, ms). */
export const STUMP_MS = 75_000;
/** Fruit trees: how many fruit hang on a full tree, how long one takes to grow back (game time, ms),
 *  and the shortest gap between two fruit-giving taps. */
export const FRUIT_STOCK = 4, FRUIT_REGROW_MS = 38_000, FRUIT_TAP_MS = 650;
/** Where the fruit hang, as fractions of the canopy: x from the trunk (+ = right), y up from the base. */
const FRUIT_SLOTS: [number, number][] = [[-0.21, 0.6], [0.2, 0.66], [-0.04, 0.47], [0.24, 0.49], [-0.26, 0.45], [0.02, 0.71]];
type FruitDot = { img: Phaser.GameObjects.Image; fx: number; fy: number; size: number; k: number; on: boolean };
export type FruitTree = { t: Phaser.GameObjects.Image; stock: number; dots: FruitDot[]; nextAt: number };
type TreeParts = { shadow?: Phaser.GameObjects.Image; solid?: Phaser.GameObjects.Zone; scale: number };
export type Stump = {
  x: number; y: number; img: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Image; solid?: Phaser.GameObjects.Zone;
  state: 'stump' | 'grass'; timer?: Phaser.Time.TimerEvent;
};
/** Tint for stumps in the Halloween theme (matches the dusky foliage). */
const stumpTint = () => (theme.id === 'halloween' ? 0xc8b0d8 : null);

type Pickup = { img: Phaser.GameObjects.Image; kind: string; minor: string; t0: number; flying: boolean; bub?: Phaser.GameObjects.Image };
const MINOR_LABEL: Record<string, string> = { petal: 'petal', shell: 'shell', apple: 'fruit', acorn: 'acorn', beetle: 'beetle spotted' };

export class Reacts {
  pickups: Pickup[] = [];
  cool = new WeakMap<object, number>();
  /** Trees that drop fruit (for the test hook). */
  fruitTrees: Phaser.GameObjects.Image[] = [];
  /** Leaf / birch trees that yield wood (for the test hook). */
  woodTrees: Phaser.GameObjects.Image[] = [];
  /** Remaining wood hits per tree (default 5). */
  woodStock = new WeakMap<object, number>();
  /** Trees that have been chopped down (no longer tappable). */
  felled = new WeakSet<object>();
  treeParts = new WeakMap<object, TreeParts & { birch: boolean }>();
  stumps: Stump[] = [];
  /** Stump lifetime; tests shorten it through the debug hook. */
  stumpMs = STUMP_MS;
  /** Live fruit on each fruit tree (stock + the fruit sprites hanging in the canopy). */
  fruit = new Map<object, FruitTree>();
  /** Fruit regrow time; tests shorten it through the debug hook. */
  fruitRegrowMs = FRUIT_REGROW_MS;
  constructor(private w: WorldScene) {}

  private ready(o: object, ms: number) {
    const now = this.w.time.now;
    if ((this.cool.get(o) ?? 0) > now) return false;
    this.cool.set(o, now + ms);
    return true;
  }
  matCool = new WeakMap<object, number>();
  /** Rocks out in the world sometimes give building stone. */
  private material(o: object, id: 'wood' | 'stone', x: number, y: number) {
    const now = this.w.time.now;
    if ((this.matCool.get(o) ?? 0) > now || !this.w.village) return;
    this.matCool.set(o, now + 25000);
    if (Math.random() < 0.55) this.w.village.add(id, 1, x, y);
  }
  private count() { if (this.w.life) this.w.life.reactions++; }

  tree(t: Phaser.GameObjects.Image, kind: 'fruit' | 'blossom' | 'leaf' | 'pear' | 'apple' | 'birch', parts: TreeParts = { scale: 1 }) {
    this.w.canopies.push(t);
    if (kind === 'apple' || kind === 'pear' || kind === 'fruit') { this.fruitTrees.push(t); this.hangFruit(t, kind === 'pear' ? 'pear' : 'apple'); }
    if (kind === 'leaf' || kind === 'birch') this.woodTrees.push(t);
    this.treeParts.set(t, { ...parts, birch: t.frame.name.startsWith('birch') });
    this.w.tappables.push({
      x: () => t.x, y: () => t.y - t.displayHeight * 0.58, r: Math.max(34, t.displayWidth * 0.32), soft: true,
      enabled: () => !this.felled.has(t),
      tap: () => {
        const sw = this.w.swayerOf.get(t);
        if (sw) sw.shake = 1;
        sfx.rustle();
        this.count();
        const cy = t.y - t.displayHeight * 0.55;
        const tint = kind === 'blossom' ? 0xffc6dc : kind === 'birch' ? 0xf0d36a : 0x8fcf6a;
        this.w.burst(t.x, cy, tint, 10, kind === 'blossom' ? 'petal' : 'leaf');
        if ((kind === 'leaf' || kind === 'birch') && this.w.village) {
          const left = this.woodStock.get(t) ?? 5;
          if (left > 0) {
            this.woodStock.set(t, left - 1);
            this.w.village.add('wood', 1, t.x, cy);
            if (left - 1 <= 0) this.fell(t, kind);
            else if (tipOnce('harvest')) this.w.game.events.emit('toast', 'Wood! Keep tapping to get more.');
          }
        }
        if (kind === 'apple' || kind === 'pear' || kind === 'fruit') { this.pickFruit(t, kind === 'pear' ? 'pear' : 'apple'); return; }
        if (!this.ready(t, 6000)) return;
        if (kind === 'birch' && Math.random() < 0.3) {
          this.drop(t.x + (Math.random() * 2 - 1) * 30, cy, t.y + 14, 'acorn', 'acorn');
        }
      },
    });
  }

  /** Hang FRUIT_STOCK fruit sprites in a fruit tree's canopy (they follow its sway, fade and theme swaps). */
  private hangFruit(t: Phaser.GameObjects.Image, frame: 'apple' | 'pear') {
    const w = this.w;
    // Deterministic per tree, so the fruit sit in the same places every visit.
    let seed = (Math.floor(t.x) * 73856093) ^ (Math.floor(t.y) * 19349663);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const start = Math.floor(rnd() * FRUIT_SLOTS.length);
    const dots: FruitDot[] = [];
    for (let i = 0; i < FRUIT_STOCK; i++) {
      const [sx, sy] = FRUIT_SLOTS[(start + i) % FRUIT_SLOTS.length];
      const img = w.add.image(t.x, t.y, atlasOf(frame), frame).setOrigin(0.5, 0.5).setVisible(false);
      dots.push({ img, fx: sx + (rnd() - 0.5) * 0.06, fy: sy + (rnd() - 0.5) * 0.05, size: 0.098 + rnd() * 0.012, k: 1, on: true });
    }
    this.fruit.set(t, { t, stock: FRUIT_STOCK, dots, nextAt: 0 });
  }

  /** A fruit-giving tap: the newest fruit drops from the canopy as a pickup; an empty tree just rustles. */
  private pickFruit(t: Phaser.GameObjects.Image, frame: 'apple' | 'pear') {
    const rec = this.fruit.get(t);
    if (!rec || !this.ready(rec, FRUIT_TAP_MS)) return;
    if (rec.stock <= 0) {
      if (tipOnce('fruitwait')) this.w.game.events.emit('toast', 'This tree needs time to grow more fruit.');
      return;
    }
    if (rec.stock >= FRUIT_STOCK) rec.nextAt = this.w.time.now + this.fruitRegrowMs;
    rec.stock--;
    const d = rec.dots[rec.stock];
    d.on = false;
    const p = this.dotPos(t, d);
    d.img.setVisible(false);
    this.drop(p.x, p.y, t.y + 8 + Math.random() * 22, frame, 'apple');
  }

  /** World position of a hanging fruit, following the canopy's sway and flip. */
  private dotPos(t: Phaser.GameObjects.Image, d: FruitDot) {
    const dx = d.fx * t.displayWidth * (t.flipX ? -1 : 1);
    const dy = -(d.fy * t.displayHeight - t.displayHeight * (1 - t.originY));
    const c = Math.cos(t.rotation), s = Math.sin(t.rotation);
    return { x: t.x + dx * c - dy * s, y: t.y + dx * s + dy * c };
  }

  /** One fruit grows back: a little pop and sparkle (and a soft blip if you are close). */
  private regrow(rec: FruitTree) {
    const w = this.w;
    const d = rec.dots[rec.stock];
    rec.stock++;
    d.on = true;
    d.k = 0;
    w.tweens.add({ targets: d, k: 1, duration: 520, ease: 'Back.easeOut' });
    rec.nextAt = rec.stock < FRUIT_STOCK ? w.time.now + this.fruitRegrowMs : 0;
    if (!rec.t.visible) return;
    const p = this.dotPos(rec.t, d);
    w.burst(p.x, p.y, 0xfff2a8, 6, 'spark');
    if (Math.hypot(p.x - w.feet.x, p.y - w.feet.y) < 420) sfx.blip();
  }

  /** Keep hanging fruit glued to their (swaying, fading, culled) trees and grow fruit back over time. */
  private updateFruit(now: number) {
    for (const rec of this.fruit.values()) {
      if (rec.stock < FRUIT_STOCK && rec.nextAt && now >= rec.nextAt) this.regrow(rec);
      const t = rec.t;
      const show = t.visible && t.active;
      for (const d of rec.dots) {
        const vis = show && d.on;
        if (d.img.visible !== vis) d.img.setVisible(vis);
        if (!vis) continue;
        const p = this.dotPos(t, d);
        const px = (t.displayWidth * d.size * d.k) / Math.max(d.img.width, d.img.height);
        d.img.setPosition(p.x, p.y).setRotation(t.rotation).setScale(px).setAlpha(t.alpha).setDepth(t.depth + 0.05);
      }
    }
  }

  /** Tests: shorten (or restore) fruit regrow time; fruit already growing come back no later than that. */
  setFruitRegrowMs(ms: number) {
    this.fruitRegrowMs = ms;
    const now = this.w.time.now;
    for (const rec of this.fruit.values()) if (rec.nextAt) rec.nextAt = Math.min(rec.nextAt, now + ms);
  }

  /** The last bit of wood is gone: the tree shrinks away in a puff of leaves and leaves a stump. */
  fell(t: Phaser.GameObjects.Image, kind: string) {
    const w = this.w;
    if (this.felled.has(t)) return;
    this.felled.add(t);
    const p = this.treeParts.get(t) ?? { scale: 1, birch: false };
    const x = t.x, y = t.y;
    const st = w.img(x, y, p.birch ? 'stump_birch' : 'stump', 0.5, 35 / 40, p.scale * 1.15).setDepth(y - 1).setFlipX(t.flipX);
    const tint = stumpTint();
    if (tint) st.setTint(tint);
    const sx = st.scaleX, sy = st.scaleY;
    st.setScale(sx * 0.6, sy * 0.3).setAlpha(0);
    const rec: Stump = { x, y, img: st, shadow: p.shadow, solid: p.solid, state: 'stump' };
    this.stumps.push(rec);
    // Tree: a short wobble, then it shrinks down into the stump while fading out.
    w.retire(t);
    const cy = y - t.displayHeight * 0.55;
    const leafTint = theme.id === 'halloween' ? 0xffa64d : theme.id === 'fall' ? 0xff8a3a : kind === 'birch' ? 0xf0d36a : 0x8fcf6a;
    w.time.delayedCall(260, () => {
      sfx.rustle(); sfx.tock();
      w.burst(x, cy, leafTint, 24, 'leaf');
      w.burst(x, cy - 20, 0xffffff, 6, 'spark');
      const puff = w.fx(x, y - 10, 'smoke', 0.5).setDepth(y + 2).setAlpha(0.55).setTint(0xf4ecd8);
      w.tweens.add({ targets: puff, scale: 1.4, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => puff.destroy() });
      w.tweens.add({
        targets: t, scaleY: t.scaleY * 0.12, scaleX: t.scaleX * 0.75, alpha: 0, angle: (Math.random() < 0.5 ? -1 : 1) * 6,
        duration: 620, ease: 'Cubic.easeIn', onComplete: () => t.setVisible(false).setActive(false),
      });
      w.tweens.add({ targets: st, scaleX: sx, scaleY: sy, alpha: 1, delay: 260, duration: 520, ease: 'Back.easeOut' });
      if (p.shadow) w.tweens.add({ targets: p.shadow, scaleX: p.shadow.scaleX * 0.38, scaleY: p.shadow.scaleY * 0.5, duration: 700, ease: 'Sine.easeInOut' });
      // A stump is small: swap the trunk's collider for a little one.
      if (p.solid) {
        (p.solid.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        rec.solid = w.solidCircle(x, y - 5, Math.max(6, 11 * p.scale));
      }
      w.buildNav();
      if (tipOnce('stump')) w.game.events.emit('toast', 'Timber! The tree is all used up.');
    });
    w.tappables.push({
      x: () => st.x, y: () => st.y - 12, r: 26, soft: true, enabled: () => rec.state === 'stump',
      tap: () => {
        sfx.tock();
        this.count();
        w.tweens.add({ targets: st, scaleY: sy * 0.88, scaleX: sx * 1.08, duration: 90, yoyo: true, ease: 'Sine.easeOut', onComplete: () => st.setScale(sx, sy) });
        w.burst(x, y - 16, 0x9be07a, 5, 'leaf');
      },
    });
    rec.timer = w.time.delayedCall(this.stumpMs + 900, () => this.toGrass(rec));
  }

  /** After a while the stump softens away and the spot is just grass again. */
  toGrass(rec: Stump) {
    const w = this.w;
    if (rec.state !== 'stump') return;
    rec.state = 'grass';
    rec.timer?.remove(false);
    const st = rec.img;
    w.tweens.add({ targets: st, alpha: 0, scaleY: st.scaleY * 0.5, duration: 1600, ease: 'Sine.easeIn', onComplete: () => { w.cull.remove(st); st.destroy(); } });
    if (rec.shadow) w.tweens.add({ targets: rec.shadow, alpha: 0, duration: 1600, onComplete: () => rec.shadow?.setVisible(false) });
    // Fresh grass springs up where the stump was.
    for (let i = 0; i < 3; i++) {
      const g = w.img(rec.x + (i - 1) * 11 + (Math.random() * 4 - 2), rec.y + (i % 2) * 4 - 2, `tuft${i}`, 0.5, 1, 0.9 + Math.random() * 0.3).setDepth(rec.y);
      const gs = g.scaleX;
      g.setScale(gs, 0.01).setAlpha(0);
      w.tweens.add({ targets: g, scaleY: gs, alpha: 1, delay: 700 + i * 160, duration: 700, ease: 'Back.easeOut' });
      w.sway(g, 0.09, 1.2 + Math.random() * 0.8);
    }
    w.time.delayedCall(800, () => w.burst(rec.x, rec.y - 6, 0x9be07a, 8, 'leaf'));
    if (rec.solid) { (rec.solid.body as Phaser.Physics.Arcade.StaticBody).enable = false; rec.solid = undefined; }
    w.buildNav();
  }

  /** Re-tint stumps when the theme changes. */
  restyleStumps() {
    const tint = stumpTint();
    for (const s of this.stumps) {
      if (s.state !== 'stump') continue;
      if (tint) s.img.setTint(tint); else s.img.clearTint();
    }
  }

  flower(f: Phaser.GameObjects.Image) {
    this.w.tappables.push({
      x: () => f.x, y: () => f.y - 8, r: 20, soft: true,
      tap: () => {
        const sx = f.scaleX, sy = f.scaleY;
        this.w.tweens.add({ targets: f, scaleX: sx * 1.35, scaleY: sy * 1.35, duration: 160, yoyo: true, ease: 'Back.easeOut', onComplete: () => f.setScale(sx, sy) });
        const sw = this.w.swayerOf.get(f);
        if (sw) sw.kick = 1;
        this.w.burst(f.x, f.y - 10, 0xffe0ee, 6, 'petal');
        sfx.blip();
        this.count();
        if (this.ready(f, 15000) && Math.random() < 0.4) this.give(f.x, f.y - 16, 'petal');
      },
    });
  }

  foliage: Phaser.GameObjects.Image[] = [];
  bush(b: Phaser.GameObjects.Image) {
    this.foliage.push(b);
    this.w.tappables.push({
      x: () => b.x, y: () => b.y - b.displayHeight * 0.45, r: Math.max(26, b.displayWidth * 0.42), soft: true,
      tap: () => {
        const sw = this.w.swayerOf.get(b);
        if (sw) sw.shake = 1.4;
        sfx.rustle();
        this.count();
        this.w.burst(b.x, b.y - 14, 0x7cc463, 8, 'leaf');
        if (this.ready(b, 9000)) {
          const r = Math.random();
          if (r < 0.3) this.w.life.rabbitFrom(b.x, b.y + 4);
          else if (r < 0.55) this.w.life.sparrowsFrom(b.x, b.y - 10);
        }
      },
    });
  }

  rock(r: Phaser.GameObjects.Image) {
    this.w.tappables.push({
      x: () => r.x, y: () => r.y - 10, r: 26, soft: true,
      tap: () => {
        const x0 = r.x;
        this.w.tweens.add({ targets: r, x: x0 + 2.5, duration: 50, yoyo: true, repeat: 3, onComplete: () => r.setX(x0) });
        sfx.tock();
        this.count();
        this.material(r, 'stone', r.x, r.y - 30);
        if (this.ready(r, 8000) && Math.random() < 0.55) {
          this.w.life.beetleFrom(r.x, r.y + 2);
          this.give(r.x, r.y - 24, 'beetle', false);
        }
      },
    });
  }

  chime(c: Phaser.GameObjects.Image) {
    this.w.tappables.push({
      x: () => c.x, y: () => c.y + 14, r: 26,
      tap: () => {
        const sw = this.w.swayerOf.get(c);
        if (sw) sw.shake = 2;
        sfx.chimes();
        this.count();
        this.w.burst(c.x, c.y + 20, 0xcff6ff, 6, 'spark');
      },
    });
  }

  /** Award a minor collectible immediately with a floating label. */
  give(x: number, y: number, minor: string, sound = true) {
    const n = addMinor(minor);
    this.w.floatText(x, y, `+1 ${MINOR_LABEL[minor] ?? minor}`);
    if (sound) sfx.pickup();
    this.w.game.events.emit('minor', minor, n);
  }

  /** A pickup falls from (x, y0) to the ground at y1; walk over or tap to collect. */
  drop(x: number, y0: number, y1: number, kind: string, minor: string) {
    const img = this.w.add.image(x, y0, ATLAS, kind).setOrigin(0.5, 1).setDepth(y1);
    const p: Pickup = { img, kind, minor, t0: this.w.time.now, flying: false };
    this.bubble(p);
    this.pickups.push(p);
    this.w.tweens.add({ targets: img, y: y1, duration: 520, ease: 'Bounce.easeOut' });
    this.addPickupTap(p);
    return p;
  }

  /** A pickup already resting on the ground (shells on the beach). */
  place(x: number, y: number, kind: string, minor: string) {
    const img = this.w.add.image(x, y, ATLAS, kind).setOrigin(0.5, 1).setDepth(y - 4).setRotation((Math.random() - 0.5) * 0.5);
    const p: Pickup = { img, kind, minor, t0: 0, flying: false };
    this.bubble(p);
    this.pickups.push(p);
    this.addPickupTap(p);
    return p;
  }

  /** Big bold bubble behind a ground collectible; the icon is sized to fill it. */
  private bubble(p: Pickup) {
    const img = p.img;
    img.setScale(PICKUP_ICON / Math.max(img.width, img.height));
    const sz = PICKUP_BUBBLE * 64 / 52; // the bubble disc is 52 of its 64 px
    p.bub = this.w.add.image(img.x, img.y + 6, atlasOf('pk_bubble'), 'pk_bubble').setOrigin(0.5, 1).setDepth(img.depth - 0.5).setDisplaySize(sz, sz);
    img.once('destroy', () => p.bub?.destroy());
  }

  private addPickupTap(p: Pickup) {
    this.w.tappables.push({
      x: () => p.img.x, y: () => p.img.y - 14, r: 34, enabled: () => p.img.active && !p.flying,
      tap: () => {
        const d = Math.hypot(p.img.x - this.w.feet.x, p.img.y - this.w.feet.y);
        if (d < 170) this.collect(p);
        else this.w.walkTo(p.img.x, p.img.y + 4);
      },
    });
  }

  collect(p: Pickup) {
    if (p.flying || !p.img.active) return;
    p.flying = true;
    this.w.tweens.add({
      targets: p.img, x: this.w.feet.x, y: this.w.feet.y - 30, scale: p.img.scale * 0.6, duration: 320, ease: 'Sine.easeIn',
      onComplete: () => {
        this.give(p.img.x, p.img.y - 10, p.minor);
        if (p.minor === 'apple') {
          save.snacks = Math.min(9, save.snacks + 1);
          persist();
          this.w.game.events.emit('snacks', save.snacks);
          if (tipOnce('feed')) this.w.game.events.emit('toast', 'Yum! Tap an animal to feed it.');
        }
        p.img.destroy();
      },
    });
  }

  update(_time: number, _dt: number) {
    this.updateFruit(this.w.time.now);
    const fx = this.w.feet.x, fy = this.w.feet.y;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (!p.img.active) { this.pickups.splice(i, 1); continue; }
      if (p.bub) { p.bub.setPosition(p.img.x, p.img.y + 6); if (p.flying) p.bub.setVisible(false); }
      if (!p.flying && this.w.time.now - p.t0 > 600 && Math.abs(p.img.x - fx) < 26 && Math.abs(p.img.y - fy) < 22) this.collect(p);
    }
  }
}
