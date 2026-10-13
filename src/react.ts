// Tap reactions for scenery (trees, flowers, bushes, rocks, chimes) and small pickups.
import Phaser from 'phaser';
import { ATLAS, atlasOf, PICKUP_BUBBLE, PICKUP_ICON } from './art';
import { sfx } from './audio';
import { addMinor, save, persist, tipOnce } from './save';
import type { WorldScene } from './scenes/World';

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

  tree(t: Phaser.GameObjects.Image, kind: 'fruit' | 'blossom' | 'leaf' | 'pear' | 'apple' | 'birch') {
    this.w.canopies.push(t);
    if (kind === 'apple' || kind === 'pear' || kind === 'fruit') this.fruitTrees.push(t);
    if (kind === 'leaf' || kind === 'birch') this.woodTrees.push(t);
    this.w.tappables.push({
      x: () => t.x, y: () => t.y - t.displayHeight * 0.58, r: Math.max(34, t.displayWidth * 0.32), soft: true,
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
            if (tipOnce('harvest')) this.w.game.events.emit('toast', 'Wood! Keep tapping to get more.');
          }
        }
        if (!this.ready(t, 6000)) return;
        if (kind === 'apple' || kind === 'pear' || kind === 'fruit') {
          const n = 1 + (Math.random() < 0.4 ? 1 : 0);
          for (let i = 0; i < n; i++) this.drop(t.x + (Math.random() * 2 - 1) * t.displayWidth * 0.3, cy + 10, t.y + 8 + Math.random() * 22, kind === 'pear' ? 'pear' : 'apple', 'apple');
        } else if (kind === 'birch' && Math.random() < 0.3) {
          this.drop(t.x + (Math.random() * 2 - 1) * 30, cy, t.y + 14, 'acorn', 'acorn');
        }
      },
    });
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
    const fx = this.w.feet.x, fy = this.w.feet.y;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (!p.img.active) { this.pickups.splice(i, 1); continue; }
      if (p.bub) { p.bub.setPosition(p.img.x, p.img.y + 6); if (p.flying) p.bub.setVisible(false); }
      if (!p.flying && this.w.time.now - p.t0 > 600 && Math.abs(p.img.x - fx) < 26 && Math.abs(p.img.y - fy) < 22) this.collect(p);
    }
  }
}
