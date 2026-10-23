// Applies the active theme to the living world, and re-applies it live when it changes.
import Phaser from 'phaser';
import { atlasOf, frameScale, ALL_PATHS, mulberry32 } from './art';
import { theme, themeEvents, Theme } from './theme';
import { TREE_BULBS } from './mount/xmasArt';
import { sfx } from './audio';
import { COTTAGE, SHRINE, VILLAGE_SIGN, PIER, POND, WINDMILL, BRIDGES, VILLAGE, PLAYER_START } from './layout';
import { waterAt } from './geo';
import type { WorldScene } from './scenes/World';

type Jack = { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; gs: number; flare: number };
type FlyBat = { img: Phaser.GameObjects.Image; t: number; a: number; spin: number; r: number };
type BatTree = { tree: Phaser.GameObjects.Image; x: number; y: number; nap: Phaser.GameObjects.Image[]; fly: FlyBat[]; until: number };
type Peek = { ghost: Phaser.GameObjects.Image; x: number; y: number; up: number; target: number; next: number; wave: number };
const CANDY = [0xff7fa8, 0xffd84d, 0x7fd0ff, 0xb48cff, 0x9be07a];

type Orig = { frame: string; tex: string; ox: number; oy: number; sx: number; sy: number };

export class ThemeDresser {
  orig = new Map<Phaser.GameObjects.Image, Orig>();
  /** Spring blossom clusters painted over some round canopies (made once, shown per theme). */
  blooms = new Map<Phaser.GameObjects.Image, Phaser.GameObjects.Image[]>();
  /** Christmas snow caps sitting on round canopies (made once, shown per theme). */
  snowcaps = new Map<Phaser.GameObjects.Image, Phaser.GameObjects.Image>();
  sky: Phaser.GameObjects.Image;
  fog: { img: Phaser.GameObjects.Image; ox: number; oy: number; v: number }[] = [];
  props: Phaser.GameObjects.Image[] = [];
  glows: { img: Phaser.GameObjects.Image; base: number; ph: number }[] = [];
  ghosts: { img: Phaser.GameObjects.Image; hx: number; hy: number; ph: number; spin: number }[] = [];
  built = false;
  /** Interactive Halloween decorations (preview). */
  jacks: Jack[] = [];
  pumpkins: Phaser.GameObjects.Image[] = [];
  batTrees: BatTree[] = [];
  peeks: Peek[] = [];
  orchardBats: { img: Phaser.GameObjects.Image; ph: number }[] = [];
  wisps: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  taps = { jack: 0, pumpkin: 0, bats: 0, peek: 0, candy: 0, leaves: 0, hay: 0, presents: 0, snowman: 0, lights: 0 };
  /** Christmas: presents, snowmen and lit trees to tap (made once, shown only in Christmas). */
  xmasProps: Phaser.GameObjects.Image[] = [];
  presents: Phaser.GameObjects.Image[] = [];
  snowmen: Phaser.GameObjects.Image[] = [];
  litTrees: { tree: Phaser.GameObjects.Image; bulbs: Phaser.GameObjects.Image[]; glow: Phaser.GameObjects.Image; until: number }[] = [];
  xmasBuilt = false;
  /** Fall: leaf piles + hay bales (made once, shown only in Fall). */
  fallProps: Phaser.GameObjects.Image[] = [];
  leafPiles: Phaser.GameObjects.Image[] = [];
  hay: Phaser.GameObjects.Image[] = [];
  fallBuilt = false;
  tufts: Phaser.GameObjects.Image[] | null = null;
  /** Each meadow tuft's own (Spring) frame, so Christmas can swap in its snowy twin and back. */
  tuftFrame = new Map<Phaser.GameObjects.Image, string>();

  constructor(private w: WorldScene) {
    this.sky = w.add.image(0, 0, atlasOf('sky_halloween'), 'sky_halloween').setScrollFactor(0).setDepth(8700).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    for (let i = 0; i < 7; i++) {
      const img = w.add.image(0, 0, atlasOf('mist'), 'mist').setDepth(8600).setVisible(false).setScale(5 + Math.random() * 3, 2.5 + Math.random());
      this.fog.push({ img, ox: Math.random() * 1400 - 200, oy: Math.random() * 900, v: 6 + Math.random() * 10 });
    }
    themeEvents.on('change', () => this.apply(true));
    this.apply(false);
  }

  /** Seasonal props + ghost friends are created the first time they are needed. */
  private buildProps() {
    if (this.built) return;
    this.built = true;
    const w = this.w;
    const rng = mulberry32(1031);
    const add = (x: number, y: number, frame: string, scale: number, glow = false): Phaser.GameObjects.Image | null => {
      if (waterAt(x, y, 10) || w.nav.isBlocked(...w.nav.cellOf(x, y))) return null;
      const img = w.add.image(x, y, atlasOf(frame), frame).setOrigin(0.5, 1).setScale(scale / (frameScale[frame] ?? 2.5)).setDepth(y);
      this.props.push(img);
      if (glow) {
        const gs = 0.32 * (scale / 0.75);
        const g = w.fx(x, y - 12 * scale / 0.75, 'glow', gs).setBlendMode('ADD').setTint(0xffa040).setAlpha(0.6).setDepth(y + 1);
        this.props.push(g);
        this.glows.push({ img: g, base: 0.55, ph: rng() * 6 });
        if (frame === 'h_jack') this.jack(img, g);
      } else if (frame === 'h_pumpkin') this.pumpkin(img);
      return img;
    };
    // Pumpkins along the paths, alternating sides.
    for (const path of ALL_PATHS) {
      for (let i = 6; i < path.length - 2; i += 20 + Math.floor(rng() * 10)) {
        const [x, y] = path[i], [x2, y2] = path[i + 1];
        const a = Math.atan2(y2 - y, x2 - x) + (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        const jack = rng() < 0.45;
        add(x + Math.cos(a) * 44, y + Math.sin(a) * 30, jack ? 'h_jack' : 'h_pumpkin', 0.6 + rng() * 0.3, jack);
      }
    }
    // Candle clusters at cozy spots.
    const spots: [number, number][] = [[COTTAGE.x - 40, COTTAGE.y + 30], [COTTAGE.x + 44, COTTAGE.y + 28], [SHRINE.x - 70, SHRINE.y + 40], [SHRINE.x + 70, SHRINE.y + 40],
      [VILLAGE_SIGN.x - 36, VILLAGE_SIGN.y + 6], [PIER.x - 40, PIER.y0 - 20], [POND.x - 200, POND.y + 150], [WINDMILL.x - 70, WINDMILL.y + 30],
      [BRIDGES.north.x - 150, BRIDGES.north.y + 30], [BRIDGES.south.x - 150, BRIDGES.south.y + 30]];
    for (const [x, y] of spots) for (let k = 0; k < 3; k++) add(x + (k - 1) * 14 + rng() * 4, y + (k % 2) * 6, 'h_candle', 0.5 + rng() * 0.25, k === 1);
    add(COTTAGE.x - 70, COTTAGE.y + 8, 'h_jack', 0.95, true);
    add(COTTAGE.x + 75, COTTAGE.y + 8, 'h_pumpkin', 0.85);
    // Bat trees: bare curly trees with snoozing bats; tap and they flutter out, then come home.
    const batSpots: [number, number][][] = [
      [[PLAYER_START.x + 150, PLAYER_START.y - 40], [PLAYER_START.x - 150, PLAYER_START.y - 30], [PLAYER_START.x + 170, PLAYER_START.y + 60]],
      [[COTTAGE.x + 190, COTTAGE.y + 60], [COTTAGE.x - 170, COTTAGE.y + 80]],
      [[3050, 1980], [3420, 2140], [2800, 1930]],
    ];
    for (const cands of batSpots) {
      const at = cands.find(([x, y]) => !waterAt(x, y, 30) && !w.nav.isBlocked(...w.nav.cellOf(x, y)) && !w.nav.isBlocked(...w.nav.cellOf(x, y - 40)));
      if (at) this.batTree(at[0], at[1], 1.15);
    }
    // Peekaboo pumpkin patch near the start: a shy ghost hides behind it and pops up to wave.
    const peekSpots: [number, number][] = [[PLAYER_START.x - 75, PLAYER_START.y - 70], [PLAYER_START.x - 120, PLAYER_START.y + 70], [PLAYER_START.x + 120, PLAYER_START.y + 90], [PLAYER_START.x - 140, PLAYER_START.y - 120]];
    const ps = peekSpots.find(([x, y]) => !waterAt(x, y, 30) && !w.nav.isBlocked(...w.nav.cellOf(x, y)));
    if (ps) this.peekPatch(ps[0], ps[1]);
    // Orchard: spooky-cute touches (mini jack-o'-lanterns at the trunks, a few snoozing bats).
    w.reacts.fruitTrees.forEach((t, k) => {
      if (k % 4 === 0) add(t.x + (k % 8 ? 26 : -26), t.y + 10, 'h_jack', 0.42, true);
      if (k % 6 === 1) {
        const b = w.add.image(t.x + t.displayWidth * (k % 2 ? 0.22 : -0.24), t.y - t.displayHeight * 0.42, atlasOf('h_batnap'), 'h_batnap')
          .setOrigin(0.5, 0).setScale(0.55 / 2.5).setDepth(t.depth + 2);
        this.props.push(b);
        this.orchardBats.push({ img: b, ph: rng() * 6 });
      }
    });
    // Ghost friends: shy, giggly, and they spin when tapped.
    const homes: [number, number][] = [[POND.x - 120, POND.y + 210], [VILLAGE.x + 300, VILLAGE.y + 380], [3300, 900], [3000, 2000], [700, 2000], [1500, 1200]];
    for (const [hx, hy] of homes) {
      const img = w.add.image(hx, hy, atlasOf('h_ghost'), 'h_ghost').setOrigin(0.5, 1).setScale(0.8 / 2.5).setDepth(hy).setAlpha(0.92);
      const g = { img, hx, hy, ph: rng() * 6, spin: 0 };
      this.ghosts.push(g);
      this.props.push(img);
      w.tappables.push({
        x: () => img.x, y: () => img.y - 22, r: 30, enabled: () => img.visible,
        tap: () => {
          g.spin = 1; w.life.reactions++;
          sfx.chirp();
          w.floatText(img.x, img.y - 60, ['Boo!', 'Hee hee!', 'Peekaboo!'][Math.floor(Math.random() * 3)]);
          w.burst(img.x, img.y - 30, 0xe8dcff, 10, 'spark');
        },
      });
    }
  }

  /** Fall props: crunchy leaf piles along the paths and under trees, hay bales (with pumpkins) at cozy spots. */
  private buildFallProps() {
    if (this.fallBuilt) return;
    this.fallBuilt = true;
    const w = this.w;
    const rng = mulberry32(2207);
    const free = (x: number, y: number) => !waterAt(x, y, 12) && !w.nav.isBlocked(...w.nav.cellOf(x, y));
    const put = (x: number, y: number, frame: string, scale: number) => {
      const img = w.add.image(x, y, atlasOf(frame), frame).setOrigin(0.5, 1).setScale(scale / (frameScale[frame] ?? 2.5)).setDepth(y);
      this.fallProps.push(img);
      return img;
    };
    const pile = (x: number, y: number, scale: number) => {
      if (!free(x, y)) return;
      const img = put(x, y, 'f_leafpile', scale);
      this.leafPiles.push(img);
      const sx = img.scaleX, sy = img.scaleY;
      w.tappables.push({
        x: () => img.x, y: () => img.y - 10, r: 38, enabled: () => img.visible,
        tap: () => {
          this.taps.leaves++; w.life.reactions++;
          sfx.rustle();
          w.floatText(img.x, img.y - 44, ['Crunch!', 'Wheee!', 'Swish!'][Math.floor(Math.random() * 3)], '#ffd27a');
          w.burst(img.x, img.y - 12, 0xf2603a, 9, 'p_maple');
          w.burst(img.x, img.y - 12, 0xffc24a, 9, 'p_maple');
          w.tweens.killTweensOf(img);
          img.setScale(sx * 1.25, sy * 0.55);
          w.tweens.add({ targets: img, scaleX: sx, scaleY: sy, duration: 900, ease: 'Back.easeOut' });
        },
      });
    };
    // Leaf piles along the paths, alternating sides.
    for (const path of ALL_PATHS) {
      for (let i = 10; i < path.length - 2; i += 24 + Math.floor(rng() * 12)) {
        const [x, y] = path[i], [x2, y2] = path[i + 1];
        const a = Math.atan2(y2 - y, x2 - x) + (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        pile(x + Math.cos(a) * 62, y + Math.sin(a) * 40, 0.85 + rng() * 0.35);
      }
    }
    // A few under the leafy trees near the start, the cottage and the pond.
    for (const [x, y] of [[PLAYER_START.x + 110, PLAYER_START.y + 40], [PLAYER_START.x - 120, PLAYER_START.y - 20], [COTTAGE.x + 150, COTTAGE.y + 50], [POND.x - 160, POND.y + 170], [VILLAGE_SIGN.x + 70, VILLAGE_SIGN.y + 20]] as [number, number][]) pile(x, y, 1.05);
    // Hay bales with a pumpkin or two at cozy spots.
    const hay = (x: number, y: number) => {
      if (!free(x, y)) return;
      const img = put(x, y, 'f_hay', 0.95);
      this.hay.push(img);
      if (free(x + 34, y + 6)) put(x + 34, y + 6, 'h_pumpkin', 0.6);
      const sx = img.scaleX, sy = img.scaleY;
      w.tappables.push({
        x: () => img.x, y: () => img.y - 16, r: 36, enabled: () => img.visible,
        tap: () => {
          this.taps.hay++; w.life.reactions++;
          sfx.thump();
          w.floatText(img.x, img.y - 50, ['Boing!', 'Hay there!', 'Soft!'][Math.floor(Math.random() * 3)], '#fff1c4');
          w.burst(img.x, img.y - 20, 0xf2d07c, 10, 'spark');
          w.tweens.killTweensOf(img);
          img.setScale(sx * 1.12, sy * 0.86);
          w.tweens.add({ targets: img, scaleX: sx, scaleY: sy, duration: 700, ease: 'Elastic.easeOut' });
        },
      });
    };
    for (const [x, y] of [[COTTAGE.x - 92, COTTAGE.y + 22], [WINDMILL.x + 80, WINDMILL.y + 34], [VILLAGE_SIGN.x - 70, VILLAGE_SIGN.y + 12], [PIER.x + 70, PIER.y0 - 24], [BRIDGES.north.x + 150, BRIDGES.north.y + 30]] as [number, number][]) hay(x, y);
  }


  /** Christmas props: wrapped presents to pop open, snowmen to wobble and little lit trees whose
   *  lights twinkle brighter when tapped. Made the first time Christmas is shown. */
  private buildXmasProps() {
    if (this.xmasBuilt) return;
    this.xmasBuilt = true;
    const w = this.w;
    const rng = mulberry32(1225);
    const free = (x: number, y: number) => !waterAt(x, y, 12) && !w.nav.isBlocked(...w.nav.cellOf(x, y));
    const put = (x: number, y: number, frame: string, scale: number) => {
      const img = w.add.image(x, y, atlasOf(frame), frame).setOrigin(0.5, 1).setScale(scale / (frameScale[frame] ?? 2.5)).setDepth(y);
      this.xmasProps.push(img);
      return img;
    };
    const BULB = [0xff4a4a, 0x5ad85a, 0xffd04a, 0x4ab0ff];
    const present = (x: number, y: number, scale: number) => {
      if (!free(x, y)) return;
      const img = put(x, y, `xm_present${Math.floor(rng() * 4)}`, scale);
      this.presents.push(img);
      const sx = img.scaleX, sy = img.scaleY;
      w.tappables.push({
        x: () => img.x, y: () => img.y - 16, r: 36, enabled: () => img.visible,
        tap: () => {
          this.taps.presents++; w.life.reactions++;
          sfx.chimes();
          w.floatText(img.x, img.y - 52, ['A present!', 'Ho ho ho!', 'For you!', 'Surprise!'][Math.floor(Math.random() * 4)], '#fff1c4');
          w.burst(img.x, img.y - 30, 0xffd04a, 10, 'spark');
          w.burst(img.x, img.y - 30, 0xff6a6a, 6, 'spark');
          w.burst(img.x, img.y - 24, 0xffffff, 8, 'p_snow');
          w.tweens.killTweensOf(img);
          img.setScale(sx * 0.82, sy * 1.28);
          w.tweens.add({ targets: img, scaleX: sx, scaleY: sy, duration: 800, ease: 'Elastic.easeOut' });
        },
      });
    };
    const snowman = (x: number, y: number) => {
      if (!free(x, y)) return;
      const img = put(x, y, 'xm_snowman', 1.0);
      this.snowmen.push(img);
      w.tappables.push({
        x: () => img.x, y: () => img.y - 34, r: 42, enabled: () => img.visible,
        tap: () => {
          this.taps.snowman++; w.life.reactions++;
          sfx.giggle();
          w.floatText(img.x, img.y - 100, ['Brrr!', 'Hello friend!', 'Snow day!', 'Hee hee!'][Math.floor(Math.random() * 4)], '#eaf4ff');
          w.burst(img.x, img.y - 50, 0xffffff, 14, 'p_snow');
          w.tweens.killTweensOf(img);
          img.setAngle(0);
          w.tweens.add({ targets: img, angle: { from: -12, to: 12 }, duration: 160, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => img.setAngle(0) });
        },
      });
    };
    const litTree = (x: number, y: number) => {
      if (!free(x, y)) return;
      const tree = put(x, y, 'xm_tree', 1.05);
      const glow = w.fx(x, y - 50 * 1.05, 'glow', 0.7).setBlendMode('ADD').setTint(0xffd27a).setAlpha(0.22).setDepth(y + 1);
      this.xmasProps.push(glow);
      const bulbs = TREE_BULBS.map(([bx, by], i) => {
        const b = w.add.image(x + (bx - 32) * 1.05, y - (92 - by) * 1.05, atlasOf('xm_bulb'), 'xm_bulb')
          .setScale(1.05 / (frameScale['xm_bulb'] ?? 3) * 0.72).setTint(BULB[i % 4]).setDepth(y + 2).setBlendMode('ADD');
        this.xmasProps.push(b);
        return b;
      });
      const lt = { tree, bulbs, glow, until: 0 };
      this.litTrees.push(lt);
      w.tappables.push({
        x: () => x, y: () => y - 46, r: 48, enabled: () => tree.visible,
        tap: () => {
          this.taps.lights++; w.life.reactions++;
          sfx.sparkle();
          lt.until = w.time.now + 4000;
          w.floatText(x, y - 110, ['Sparkle!', 'So bright!', 'Twinkle twinkle!'][Math.floor(Math.random() * 3)], '#ffe8a0');
          w.burst(x, y - 92, 0xffd84a, 12, 'spark');
          bulbs.forEach((b, i) => b.setTint(BULB[(i + 1 + this.taps.lights) % 4]));
        },
      });
    };
    // Presents in little piles at cozy spots, a snowman or two, and lit trees by home and the village.
    const pile = (x: number, y: number) => { present(x, y, 0.95); present(x + 34, y + 8, 0.8); if (rng() < 0.6) present(x - 30, y + 10, 0.72); };
    pile(PLAYER_START.x + 120, PLAYER_START.y - 60);
    pile(COTTAGE.x + 110, COTTAGE.y + 40);
    pile(VILLAGE_SIGN.x + 90, VILLAGE_SIGN.y - 20);
    pile(WINDMILL.x - 110, WINDMILL.y + 40);
    snowman(PLAYER_START.x - 130, PLAYER_START.y + 30);
    snowman(POND.x + 190, POND.y - 150);
    snowman(VILLAGE_SIGN.x - 40, VILLAGE_SIGN.y + 120);
    litTree(COTTAGE.x - 120, COTTAGE.y + 60);
    litTree(PLAYER_START.x + 170, PLAYER_START.y - 170);
    litTree(VILLAGE_SIGN.x - 110, VILLAGE_SIGN.y + 30);
    litTree(PIER.x - 90, PIER.y0 - 30);
  }

  /** Christmas: twinkle the tree lights (brighter for a few seconds after a tap). */
  tickXmas(time: number) {
    for (const lt of this.litTrees) {
      if (!lt.tree.visible) continue;
      const hot = time < lt.until;
      lt.bulbs.forEach((b, i) => b.setAlpha(hot ? 0.75 + 0.25 * Math.sin(time / 90 + i * 1.7) : 0.55 + 0.4 * Math.max(0, Math.sin(time / 420 + i * 2.1))));
      lt.glow.setAlpha(hot ? 0.5 + 0.1 * Math.sin(time / 120) : 0.2);
    }
  }

  private jack(img: Phaser.GameObjects.Image, glow: Phaser.GameObjects.Image) {
    const w = this.w;
    const j: Jack = { img, glow, gs: glow.scaleX, flare: 0 };
    this.jacks.push(j);
    const sx = img.scaleX, sy = img.scaleY;
    w.tappables.push({
      x: () => img.x, y: () => img.y - 14, r: 34, enabled: () => img.visible,
      tap: () => {
        j.flare = 1; this.taps.jack++; w.life.reactions++;
        sfx.giggle();
        w.floatText(img.x, img.y - 44, ['Hee hee!', 'Tee hee!', 'Happy Halloween!'][Math.floor(Math.random() * 3)], '#ffd27a');
        w.burst(img.x, img.y - 18, 0xffb347, 8, 'spark');
        w.tweens.killTweensOf(img);
        img.setScale(sx * 1.18, sy * 0.82);
        w.tweens.add({ targets: img, scaleX: sx, scaleY: sy, duration: 650, ease: 'Elastic.easeOut' });
      },
    });
  }

  private pumpkin(img: Phaser.GameObjects.Image) {
    const w = this.w;
    this.pumpkins.push(img);
    let cool = 0;
    w.tappables.push({
      x: () => img.x, y: () => img.y - 14, r: 34, enabled: () => img.visible,
      tap: () => {
        this.taps.pumpkin++; w.life.reactions++;
        w.tweens.killTweensOf(img);
        img.setAngle(-16);
        w.tweens.add({ targets: img, angle: 0, duration: 900, ease: 'Elastic.easeOut' });
        if (w.time.now < cool) { sfx.tock(); return; }
        cool = w.time.now + 700;
        sfx.pickup();
        this.popCandy(img.x, img.y - 30);
      },
    });
  }

  /** A wrapped sweet hops out of a pumpkin with a sparkle (just for fun, nothing to collect). */
  private popCandy(x: number, y: number) {
    const w = this.w;
    this.taps.candy++;
    const tint = CANDY[Math.floor(Math.random() * CANDY.length)];
    const c = w.add.image(x, y, atlasOf('h_candy'), 'h_candy').setScale(0.9 / 2.5).setTint(tint).setDepth(9550);
    const dx = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 16);
    w.tweens.add({ targets: c, x: x + dx, angle: dx * 8, duration: 900, ease: 'Linear' });
    w.tweens.add({ targets: c, y: { from: y, to: y - 46 }, duration: 420, ease: 'Quad.easeOut', yoyo: true, hold: 60 });
    w.tweens.add({ targets: c, alpha: 0, delay: 1000, duration: 350, onComplete: () => c.destroy() });
    w.burst(x, y, tint, 8, 'spark');
    w.floatText(x, y - 30, ['Treat!', 'Candy!', 'Yay!'][Math.floor(Math.random() * 3)], '#ffe6f2');
  }

  private batTree(x: number, y: number, scale: number) {
    const w = this.w;
    const tree = w.add.image(x, y, atlasOf('h_tree2'), 'h_tree2').setOrigin(0.5, 192 / 200).setScale(scale / (frameScale.h_tree2 ?? 2)).setDepth(y);
    this.props.push(tree);
    const sh = w.fx(x, y, 'shadow', 70 / 64).setAlpha(0.5).setDepth(-500);
    this.props.push(sh);
    const s = scale;
    const tips: [number, number][] = [[-30, -66], [26, -72], [-6, -88]];
    const nap = tips.map(([dx, dy]) => {
      const b = w.add.image(x + dx * s, y + dy * s, atlasOf('h_batnap'), 'h_batnap').setOrigin(0.5, 0).setScale(0.7 / 2.5).setDepth(y + 2);
      this.props.push(b);
      return b;
    });
    const fly: FlyBat[] = [];
    for (let i = 0; i < 5; i++) {
      const img = w.add.image(x, y, atlasOf('h_bat0'), 'h_bat0').setScale(0.7 / 2.5).setDepth(9500).setVisible(false);
      fly.push({ img, t: -1, a: 0, spin: 1, r: 0 });
    }
    const bt: BatTree = { tree, x, y, nap, fly, until: 0 };
    this.batTrees.push(bt);
    w.tappables.push({
      x: () => x, y: () => y - 60 * s, r: 56, enabled: () => tree.visible,
      tap: () => this.releaseBats(bt),
    });
  }

  private releaseBats(bt: BatTree) {
    const w = this.w;
    this.taps.bats++; w.life.reactions++;
    const sw = w.tweens;
    sw.killTweensOf(bt.tree);
    bt.tree.setAngle(-3);
    sw.add({ targets: bt.tree, angle: 0, duration: 700, ease: 'Elastic.easeOut' });
    if (bt.fly.some((f) => f.t >= 0)) { sfx.rustle(); return; }
    sfx.rustle(); sfx.chirp();
    w.time.delayedCall(260, () => sfx.chirp());
    for (const n of bt.nap) n.setVisible(false);
    bt.fly.forEach((f, i) => {
      f.t = -i * 0.08; f.a = (i / bt.fly.length) * Math.PI * 2 + Math.random() * 0.6; f.spin = Math.random() < 0.5 ? -1 : 1; f.r = 70 + Math.random() * 50;
      f.img.setPosition(bt.x, bt.y - 75).setAlpha(0).setVisible(true);
    });
    w.floatText(bt.x, bt.y - 120, 'Flap flap!', '#e8dcff');
  }

  private peekPatch(x: number, y: number) {
    const w = this.w;
    const ghost = w.add.image(x, y - 6, atlasOf('h_ghost'), 'h_ghost').setOrigin(0.5, 1).setScale(0.8 / 2.5).setDepth(y - 3).setAlpha(0);
    this.props.push(ghost);
    const big = w.add.image(x, y, atlasOf('h_pumpkin'), 'h_pumpkin').setOrigin(0.5, 1).setScale(1.3 / 2.5).setDepth(y);
    const l = w.add.image(x - 30, y + 8, atlasOf('h_pumpkin'), 'h_pumpkin').setOrigin(0.5, 1).setScale(0.75 / 2.5).setDepth(y + 8);
    const r = w.add.image(x + 32, y + 6, atlasOf('h_jack'), 'h_jack').setOrigin(0.5, 1).setScale(0.7 / 2.5).setDepth(y + 6);
    this.props.push(big, l, r);
    const p: Peek = { ghost, x, y, up: 0, target: 0, next: 2.5, wave: 0 }; // next: seconds until the ghost changes its mind
    this.peeks.push(p);
    w.tappables.push({
      x: () => x, y: () => y - 28, r: 46, enabled: () => big.visible,
      tap: () => {
        this.taps.peek++; w.life.reactions++;
        p.target = 1; p.wave = 1.6; p.next = 2.6;
        sfx.giggle();
        w.floatText(x, y - 92, ['Peekaboo!', 'Hi there!', 'You found me!'][Math.floor(Math.random() * 3)], '#efe6ff');
        w.burst(x, y - 60, 0xe8dcff, 10, 'spark');
      },
    });
  }

  apply(live: boolean) {
    const t: Theme = theme;
    const w = this.w;
    const fp = !!t.fallProps;
    if (fp) this.buildFallProps();
    for (const p of this.fallProps) p.setVisible(fp);
    const xp = t.id === 'christmas';
    if (xp) this.buildXmasProps();
    for (const p of this.xmasProps) p.setVisible(xp);
    // Grass tufts: Fall dries the meadow grass to gold; Christmas swaps in frosty tufts poking out
    // of little snow drifts (same size and base point, so nothing shifts).
    if (!this.tufts) this.tufts = (w.children.list as Phaser.GameObjects.Image[]).filter((o) => o.type === 'Image' && /^tuft\d$/.test(o.frame?.name ?? ''));
    for (const tf of this.tufts) {
      let k = this.tuftFrame.get(tf);
      if (k === undefined) { k = tf.frame.name; this.tuftFrame.set(tf, k); }
      const want = t.frost ? `x_${k}` : k;
      if (tf.frame.name !== want) {
        const { scaleX, scaleY, originX, originY } = tf;
        tf.setTexture(atlasOf(want), want).setOrigin(originX, originY).setScale(scaleX, scaleY);
      }
      if (t.frost) tf.clearTint(); else if (t.grass) tf.setTint(t.grass); else tf.clearTint();
    }
    if (t.props) this.buildProps();
    for (const p of this.props) p.setVisible(t.props);
    for (const b of this.batTrees) for (const f of b.fly) { f.t = -1; f.img.setVisible(false); }
    if (t.props && !this.wisps) {
      // Dusk wisps: a handful of soft glowing motes drifting up around the view (kept small for iPad).
      this.wisps = w.add.particles(0, 0, atlasOf('glow'), {
        frame: 'glow', emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-100, 100, 1400, 900) as any },
        lifespan: { min: 5000, max: 8000 }, frequency: 650, maxAliveParticles: 12,
        speedX: { min: -8, max: 8 }, speedY: { min: -18, max: -6 },
        scale: { min: 0.05, max: 0.09 }, alpha: { values: [0, 0.7, 0.4, 0.75, 0] } as any,
        tint: [0xffb347, 0xffd36b, 0xd8b0ff], blendMode: 'ADD',
      } as any).setDepth(8003);
    }
    if (this.wisps) { this.wisps.setVisible(t.props); if (t.props) this.wisps.start(); else this.wisps.stop(true); }
    // Trees: swap round trees for themed ones, tint the rest.
    let i = 0;
    for (const img of w.canopies) {
      i++;
      let o = this.orig.get(img);
      if (!o) { o = { frame: img.frame.name, tex: img.texture.key, ox: img.originX, oy: img.originY, sx: img.scaleX, sy: img.scaleY }; this.orig.set(img, o); }
      const f = o.frame;
      // Fruit trees keep their own bare canopy (tinted below) so their live fruit read clearly
      // and an empty tree really looks empty (the spooky canopies have berries painted in).
      const fruity = w.reacts.fruit.has(img);
      const round = (f.startsWith('tree') || f.startsWith('apple')) && !fruity;
      if (t.trees && round) {
        const nf = t.trees[(i * 7 + Math.floor(img.x)) % t.trees.length];
        const dw = (img.width * o.sx);
        img.setTexture(atlasOf(nf), nf).setOrigin(0.5, 192 / 200); // trunk base = ground point
        img.setScale((dw * 1.05) / img.width).clearTint();
      } else {
        // Spring has no autumn trees: the amber tree4 becomes its fresh-green twin (same silhouette).
        // Fall turns every leafy round tree into the amber autumn tree4 (tinted red/orange/gold below).
        const want = t.id === 'spring' && f === 'tree4' ? 'tree4s' : t.autumn && round && f.startsWith('tree') ? 'tree4' : t.frost && round && (f === 'tree3' || f === 'tree4') ? 'tree4s' : f;
        if (img.frame.name !== want) {
          if (want === f) img.setTexture(o.tex, f).setOrigin(o.ox, o.oy).setScale(o.sx, o.sy);
          else img.setTexture(atlasOf(want), want).setOrigin(o.ox, o.oy).setScale(o.sx, o.sy);
        }
        if (t.id === 'halloween') img.setTint(fruity ? 0xf7c0a0 : f.startsWith('pine') ? 0x9c88c0 : f.startsWith('birch') ? 0xffc27a : t.foliage ?? 0xffffff);
        else if (t.autumn) img.setTint(fruity ? t.autumn.fruit : f.startsWith('pine') ? t.autumn.pine : f.startsWith('birch') ? t.autumn.birch : t.autumn.tints[(i * 7 + Math.floor(img.x)) % t.autumn.tints.length]);
        else if (t.frost) img.setTint(fruity ? t.frost.fruit : f.startsWith('pine') ? t.frost.pine : f.startsWith('birch') ? t.frost.birch : t.frost.leafy);
        else if (t.blossom && round && i % t.blossom.every === 0) img.setTint(0xfff2f4);
        else img.clearTint();
      }
      // Spring blossoms: soft pink/white flower clusters dotted over every few round canopies.
      const bloom = !!t.blossom && round && !t.trees && i % (t.blossom?.every ?? 3) === 0;
      let bl = this.blooms.get(img);
      if (bloom && !bl && t.blossom) {
        bl = [];
        const rnd = mulberry32(Math.floor(img.x * 13 + img.y * 7));
        const b = img.getBounds();
        // Finer blossoms: many small 5-petal flowers instead of a few big petal blobs.
        const n = 26 + Math.floor(rnd() * 10);
        for (let k = 0; k < n; k++) {
          const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.42;
          const x = b.centerX + Math.cos(a) * r * b.width, y = b.y + b.height * 0.34 + Math.sin(a) * r * b.height * 0.5;
          const sz = (0.045 + rnd() * 0.035) * b.width;
          const p = w.add.image(x, y, atlasOf('bloom'), 'bloom').setDisplaySize(sz, sz).setRotation(rnd() * 6.3)
            .setTint(t.blossom.tints[k % t.blossom.tints.length]).setAlpha(0.92).setDepth(img.depth + 0.01);
          bl.push(p);
        }
        this.blooms.set(img, bl);
      }
      if (bl) for (const p of bl) p.setVisible(bloom);
      // Christmas: a soft white snow cap on top of every round leafy canopy, fruit trees included
      // (theirs sits a little higher and slimmer so the hanging fruit still pop out in front).
      const fruitTree = fruity && w.reacts.fruit.get(img)?.minor !== 'berry';
      const capOn = !!t.frost && (round || fruitTree) && !t.trees;
      let cap = this.snowcaps.get(img);
      if (capOn && !cap) {
        const b = img.getBounds();
        cap = w.add.image(b.centerX, b.y + b.height * (fruity ? 0.17 : 0.2), atlasOf('x_snowcap'), 'x_snowcap')
          .setDisplaySize(b.width * (fruity ? 0.8 : 0.84), b.height * (fruity ? 0.28 : 0.34)).setFlipX((Math.floor(img.x) & 1) === 1).setDepth(img.depth + 0.02);
        this.snowcaps.set(img, cap);
      }
      if (cap) cap.setVisible(capOn);
    }
    w.reacts.restyleStumps();
    for (const b of w.reacts.foliage) { if (t.foliage) b.setTint(t.foliage); else b.clearTint(); }
    // Sky wash + fog.
    this.sky.setVisible(!!t.sky);
    if (t.sky) this.sky.setTexture(atlasOf(t.sky.frame), t.sky.frame).setAlpha(t.sky.alpha);
    for (const f of this.fog) f.img.setVisible(!!t.fog).setTint(t.fog?.tint ?? 0xffffff).setAlpha(t.fog?.alpha ?? 0);
    // Particles.
    const [pollen] = w.ambient;
    pollen?.updateConfig({ tint: t.particles.pollen } as any);
    // Each theme's petal/leaf frame has its own emitter on the right atlas page; only one runs.
    const petals = w.makePetals(t.particles.petal, t.particles.petalTint, t.id === 'halloween' ? 300 : t.id === 'spring' ? 380 : t.id === 'fall' ? 260 : t.id === 'christmas' ? 140 : 700);
    for (const [f, e] of w.petalBy) { const on = e === petals; e.emitting = on; if (!on) e.killAll(); e.setVisible(on); }
    w.petals = petals;
    for (const e of w.fireflies) e.updateConfig({ tint: t.particles.firefly } as any);
    // Critters.
    if (t.critters.cat) w.life.cat.setTint(t.critters.cat); else w.life.cat.clearTint();
    if (w.life.catTail) { if (t.critters.cat) w.life.catTail.setTint(t.critters.cat); else w.life.catTail.clearTint(); }
    for (const f of w.life.flies) { if (t.critters.butterflies) f.img.setTint(t.critters.butterflies); else f.img.clearTint(); }
    for (const g of w.windowGlows) g.setTint(t.glow);
    sfx.setSoundscape(t.soundscape);
    if (live) {
      w.ground.restyle();
      w.cameras.main.flash(400, t.id === 'halloween' ? 120 : 255, t.id === 'halloween' ? 80 : t.id === 'fall' ? 200 : 245, t.id === 'halloween' ? 160 : t.id === 'fall' ? 140 : t.id === 'christmas' ? 255 : 220);
      w.burst(w.feet.x, w.feet.y - 30, t.id === 'halloween' ? 0xffa040 : t.id === 'spring' ? 0xffc4dc : t.id === 'fall' ? 0xff9a4a : t.id === 'christmas' ? 0xffffff : 0x9be07a, 30, t.id === 'halloween' ? 'spark' : t.id === 'christmas' ? 'p_snow' : 'leaf');
    }
  }

  update(time: number, dt: number) {
    const w = this.w;
    if (this.litTrees.length) this.tickXmas(time);
    const cam = w.cameras.main;
    if (this.sky.visible) this.sky.setPosition(cam.width / 2, cam.height / 2).setDisplaySize(cam.width / cam.zoom * 1.2, cam.height / cam.zoom * 1.2);
    // Blossoms follow their canopy (chopped trees lose them, see-through fades carry over).
    if (theme.blossom) for (const [img, bl] of this.blooms) {
      const on = img.active && img.visible && bl[0]?.visible !== undefined;
      const a = on ? 0.92 * img.alpha : 0;
      if (bl[0] && bl[0].alpha !== a) for (const p of bl) p.setAlpha(a);
    }
    // Snow caps follow their canopy too (chopped trees lose them, see-through fades carry over).
    if (theme.frost) for (const [img, cap] of this.snowcaps) {
      const a = img.active && img.visible ? img.alpha : 0;
      if (cap.alpha !== a) cap.setAlpha(a);
    }
    if (theme.fog) {
      const v = cam.worldView;
      for (const f of this.fog) {
        f.ox += f.v * dt;
        if (f.ox > v.width + 400) f.ox = -400;
        f.img.setPosition(v.x + f.ox, v.y + f.oy * (v.height / 900));
      }
    }
    if (!theme.props) return;
    if (this.wisps) this.wisps.setPosition(cam.worldView.x, cam.worldView.y);
    for (const g of this.glows) g.img.setAlpha(g.base + Math.sin(time / 140 + g.ph) * 0.12 + Math.sin(time / 53 + g.ph) * 0.06);
    for (const j of this.jacks) {
      if (j.flare <= 0) continue;
      j.flare = Math.max(0, j.flare - dt * 0.7);
      const f = Math.sin(j.flare * Math.PI * 0.5);
      j.glow.setAlpha(Math.min(1, j.glow.alpha + f * 0.5) * (0.92 + Math.random() * 0.08)).setScale(j.gs * (1 + f * 0.9));
      j.img.setTint(Phaser.Display.Color.GetColor(255, 255, Math.round(255 - f * 60)));
      if (j.flare === 0) { j.glow.setScale(j.gs); j.img.clearTint(); }
    }
    for (const b of this.batTrees) {
      let flying = false;
      for (const f of b.fly) {
        if (f.t === -1 && !f.img.visible) continue;
        f.t += dt;
        if (f.t < 0) continue;
        const k = f.t / 2.6;
        if (k >= 1) { f.t = -1; f.img.setVisible(false); continue; }
        flying = true;
        // Out in a loopy circle and back home.
        const out = Math.sin(k * Math.PI);
        const a = f.a + f.spin * k * Math.PI * 2.2;
        const px = b.x + Math.cos(a) * f.r * out, py = b.y - 75 + Math.sin(a) * f.r * 0.55 * out - out * 40 + Math.sin(f.t * 9) * 4;
        f.img.setFlipX(px < f.img.x).setPosition(px, py).setAlpha(Math.min(1, k * 8, (1 - k) * 6));
        const fr = Math.sin(time / 45 + f.a * 3) > 0 ? 'h_bat0' : 'h_bat1';
        if (f.img.frame.name !== fr) f.img.setFrame(fr);
      }
      if (!flying && !b.nap[0].visible) {
        for (const n of b.nap) { n.setVisible(true).setAlpha(0); this.w.tweens.add({ targets: n, alpha: 1, duration: 400 }); }
      }
      for (let i = 0; i < b.nap.length; i++) b.nap[i].setAngle(Math.sin(time / 700 + i * 1.7) * 6);
    }
    for (const o of this.orchardBats) o.img.setAngle(Math.sin(time / 800 + o.ph) * 7);
    for (const p of this.peeks) {
      p.next -= dt;
      if (p.next <= 0 && p.target === 0 && w.cameras.main.worldView.contains(p.x, p.y)) { p.target = 0.55; p.wave = 1.2; p.next = 1.8; }
      else if (p.next <= 0) { p.target = 0; p.next = 4 + Math.random() * 3; }
      p.up += (p.target - p.up) * Math.min(1, dt * 9);
      p.wave = Math.max(0, p.wave - dt * 0.6);
      p.ghost.setAlpha(Math.min(0.95, p.up * 5)).setPosition(p.x + Math.sin(time / 400) * 2, p.y - 6 - p.up * 46).setAngle(p.wave > 0 ? Math.sin(time / 110) * 12 * Math.min(1, p.wave) : 0);
    }
    for (const g of this.ghosts) {
      const t = time / 1000 + g.ph;
      g.spin = Math.max(0, g.spin - dt * 1.2);
      g.img.setPosition(g.hx + Math.sin(t * 0.4) * 60, g.hy + Math.sin(t * 1.7) * 6 - 6);
      g.img.setAngle(g.spin * 360).setFlipX(Math.cos(t * 0.4) < 0).setDepth(g.img.y);
    }
  }
}
