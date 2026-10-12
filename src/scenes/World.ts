import Phaser from 'phaser';
import { S, ATLAS, atlasOf, frameScale, mulberry32, pondValue, distToPaths, pathDist, ALL_PATHS } from '../art';
import { GroundStreamer } from '../ground';
import { waterBlocks, areaAt, waterAt } from '../geo';
import { save, persist, setPuzzle, addTreasure, hasTreasure, visit } from '../save';
import { buildHeroSheet } from '../hero';
import { buildAreas } from '../areas';
import { Village } from '../village/village';
import { ThemeDresser } from '../themeDress';
import { setTheme } from '../theme';
import { NumBadge, plate, SeqCard } from '../seq';
import { Puzzles, resetStone } from '../puzzles';
import { Fishing } from '../fishing';
import { Reacts } from '../react';
import {
  WORLD_W, WORLD_H, GLADE_W, GLADE_H, AREA_NAMES, AreaId, VILLAGE, PLAYER_START, POND, COTTAGE, GARDEN, WALL_Y, GATE, SHRINE, SHRINE_CLEARING, SIGN,
  LANTERNS, LANTERN_ORDER, LanternId,
  TRAILHEAD,
} from '../layout';
import { sfx } from '../audio';
import { DPR } from '../dpr';
import { NavGrid } from '../pathfind';
import { Life } from '../life';

export type Interactable = {
  x: number; y: number; r: number; label: string;
  /** Height above the base where the prompt bubble floats. */
  promptY: number;
  /** Where to stand when walking over to use it (offset from x, y). Default: just below. */
  approach?: [number, number];
  /** Taps within this distance of the player use it directly without walking. */
  reach?: number;
  /** Not selectable by tapping (context prompts that follow the player). */
  noTap?: boolean;
  enabled: () => boolean;
  action: () => void;
};

/** soft: scenery (trees, bushes...) that yields to walking when the tap lands on a path. */
/** feed: an animal that can be fed from your fruit basket (hearts, then it follows you). */
export type Tappable = { x: () => number; y: () => number; r: number; tap: () => void; enabled?: () => boolean; soft?: boolean; feed?: () => void };

/** Hides static decoration far from the camera (cheap on iPad with thousands of props). */
class CullGrid {
  cells = new Map<number, Phaser.GameObjects.Components.Visible[]>();
  last = '';
  add(o: any) {
    const k = Math.floor(o.y / 400) * 100 + Math.floor(o.x / 400);
    let a = this.cells.get(k);
    if (!a) this.cells.set(k, (a = []));
    a.push(o);
  }
  update(v: Phaser.Geom.Rectangle) {
    const x0 = Math.floor((v.x - 260) / 400), x1 = Math.floor((v.right + 260) / 400);
    const y0 = Math.floor((v.y - 200) / 400), y1 = Math.floor((v.bottom + 420) / 400);
    const key = `${x0},${x1},${y0},${y1}`;
    if (key === this.last) return;
    this.last = key;
    for (const [k, objs] of this.cells) {
      const cx = k % 100, cy = Math.floor(k / 100);
      const on = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
      for (const o of objs) o.setVisible(on);
    }
  }
}

export type Swayer = { obj: Phaser.GameObjects.Image; amp: number; speed: number; phase: number; base: number; kick: number; gust: number; shake: number };

type Lantern = {
  id: LanternId; x: number; y: number; lit: boolean;
  img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; sym: Phaser.GameObjects.Image; badge: NumBadge;
};

export type Prompt = { x: number; y: number; label: string } | null;

const SPEED = 175;

export class WorldScene extends Phaser.Scene {
  feet!: Phaser.GameObjects.Zone;
  body!: Phaser.Physics.Arcade.Body;
  playerImg!: Phaser.GameObjects.Image;
  playerShadow!: Phaser.GameObjects.Image;
  solids!: Phaser.Physics.Arcade.StaticGroup;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  swayers: Swayer[] = [];
  /** Trees whose canopy fades when you walk behind them. */
  canopies: Phaser.GameObjects.Image[] = [];
  canopyTick = 0;
  interactables: Interactable[] = [];
  lanterns: Lantern[] = [];
  litOrder: LanternId[] = [];
  solved = false;
  resetStones: Record<string, { x: number; y: number }> = {};
  chestOpened = false;
  gateOpen = false;
  lastSafe: [number, number] = [PLAYER_START.x, PLAYER_START.y];
  locked = false;
  prompt: Prompt = null;
  facing = 0;
  flip = false;
  walkPhase = 0;
  lastStepFrame = 0;
  dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  smokePuff!: Phaser.GameObjects.Particles.ParticleEmitter;
  barrier!: Phaser.GameObjects.Zone;
  brambles!: Phaser.GameObjects.Image;
  chest!: Phaser.GameObjects.Image;
  clouds: Phaser.GameObjects.Image[] = [];
  rays: Phaser.GameObjects.Image[] = [];
  lilies: Phaser.GameObjects.Image[] = [];
  gateGlows: Phaser.GameObjects.Image[] = [];
  windowGlows: Phaser.GameObjects.Image[] = [];
  nextChirp = 4000;
  // Touch / tap-to-move.
  nav!: NavGrid;
  stick: { x: number; y: number } | null = null;
  path: [number, number][] = [];
  pathTarget: Interactable | null = null;
  pathArrive: (() => void) | null = null;
  pathStuck = 0;
  pathLastD = Infinity;
  tapMarker!: Phaser.GameObjects.Image;
  life!: Life;
  catPets = 0;
  ground!: GroundStreamer;
  swayerOf = new Map<Phaser.GameObjects.Image, Swayer>();
  reacts!: Reacts;
  cull = new CullGrid();
  tappables: Tappable[] = [];
  heroKey = '';
  area: AreaId = 'glade';
  areaTimer = 0;
  puzzles!: Puzzles;
  fishing!: Fishing;
  ambient: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  mist: Phaser.GameObjects.Image[] = [];
  fireflies: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  village!: Village;
  dresser!: ThemeDresser;
  buildView = false;
  windmill: { blades: Phaser.GameObjects.Image; speed: number; boost: number } | null = null;

  constructor() { super('world'); }

  // ------------------------------------------------------------ helpers
  img(x: number, y: number, key: string, ox = 0.5, oy = 1, scale = 1) {
    const o = this.add.image(x, y, atlasOf(key), key).setOrigin(ox, oy).setScale(scale / (frameScale[key] ?? S));
    this.cull.add(o);
    return o;
  }

  fx(x: number, y: number, key: string, scale = 1) {
    // FX frames are painted at their own px-per-unit; normalise to world units.
    return this.add.image(x, y, atlasOf(key), key).setScale(scale / (frameScale[key] ?? 1));
  }

  solidRect(x: number, y: number, w: number, h: number) {
    const z = this.add.zone(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(z, true);
    this.solids.add(z);
    return z;
  }

  solidCircle(x: number, y: number, r: number) {
    const z = this.add.zone(x, y, r * 2, r * 2);
    this.physics.add.existing(z, true);
    (z.body as Phaser.Physics.Arcade.StaticBody).setCircle(r);
    this.solids.add(z);
    return z;
  }

  sway(obj: Phaser.GameObjects.Image, amp: number, speed: number) {
    const sw: Swayer = { obj, amp, speed, phase: Math.random() * Math.PI * 2, base: obj.rotation, kick: 0, gust: 0, shake: 0 };
    this.swayers.push(sw);
    this.swayerOf.set(obj, sw);
    return sw;
  }

  shadow(x: number, y: number, w: number, alpha = 1) {
    const o = this.fx(x, y, 'shadow', w / 64).setAlpha(alpha).setDepth(-500);
    this.cull.add(o);
    return o;
  }

  // ------------------------------------------------------------ create
  create() {
    this.reacts = new Reacts(this);
    this.swayers = []; this.interactables = []; this.lanterns = []; this.litOrder = []; this.tappables = []; this.canopies = [];
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.solids = this.physics.add.staticGroup();
    this.ground = new GroundStreamer(this);

    this.buildPond();
    this.buildCottage();
    this.buildNorth();
    this.buildTrees();
    this.buildScatter();
    this.buildLanterns();
    this.buildSign();
    this.buildTrailhead();
    this.buildPlayer();
    this.buildAtmosphere();
    buildAreas(this);
    this.life = new Life(this);
    this.puzzles = new Puzzles(this);
    this.fishing = new Fishing(this);
    this.restoreProgress();
    this.buildNav();
    this.village = new Village(this);
    this.dresser = new ThemeDresser(this);
    this.tapMarker = this.fx(0, 0, 'ripple', 0.5).setBlendMode('ADD').setAlpha(0).setDepth(-300);

    // Camera.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.feet, false, 0.085, 0.085, 0, 18);
    cam.setBackgroundColor('#2b3a2f');
    this.fitCamera();
    cam.centerOn(this.feet.x, this.feet.y + 18);
    this.ground.update(cam.worldView, 99); // paint the first view synchronously
    this.scale.on('resize', this.fitCamera, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitCamera, this));

    // Optional GPU bloom (off by default: it muddied the palette and costs fill-rate).
    if (new URLSearchParams(location.search).get('bloom') === '1') {
      Phaser.Actions.AddEffectBloom(cam, { threshold: 0.8, blurRadius: 3, blurSteps: 4, blendAmount: 0.4 });
    }

    // Input.
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown', (e: KeyboardEvent) => { sfx.unlock(); if (!['KeyE', 'Space', 'Enter'].includes(e.code)) { this.path = []; this.pathTarget = null; } });
    const onInteract = () => this.tryInteract();
    this.keys.E.on('down', onInteract);
    this.keys.SPACE.on('down', onInteract);
    this.keys.ENTER.on('down', onInteract);

    this.exposeDebug();
    this.area = areaAt(this.feet.x, this.feet.y);
    sfx.setArea(this.area);
    this.time.delayedCall(500, () => this.game.events.emit('toast', AREA_NAMES[this.area], 'title'));
  }

  baseZoom() {
    const w = this.scale.width / DPR;
    const h = this.scale.height / DPR;
    // Landscape: frame ~560 world units tall. Portrait: frame ~560 units wide, so the
    // character stays a comfortable size instead of shrinking to fit the long axis.
    const base = w >= h ? Math.min(h / 560, w / 780) : Math.min(w / 560, h / 640);
    return Math.max(0.6, base) * DPR;
  }

  /** Build mode: frame the whole village above the build tray. */
  buildViewTarget() {
    const w = this.scale.width / DPR, h = this.scale.height / DPR;
    const tray = h > w ? 230 : 190;
    const z = Math.max(0.45, Math.min(w / 800, (h - tray - 70) / 420));
    const cx = VILLAGE.x + VILLAGE.cols * VILLAGE.cell / 2;
    const cy = VILLAGE.y + VILLAGE.rows * VILLAGE.cell / 2 - 30 + (tray - 70) / 2 / z;
    return { z: z * DPR, cx, cy };
  }
  enterBuildView() {
    this.buildView = true;
    this.path = []; this.pathTarget = null; this.stick = null;
    const cam = this.cameras.main;
    cam.stopFollow();
    const t = this.buildViewTarget();
    cam.pan(t.cx, t.cy, 650, 'Sine.easeInOut', true);
    cam.zoomTo(t.z, 650, 'Sine.easeInOut', true);
  }
  exitBuildView() {
    this.buildView = false;
    const cam = this.cameras.main;
    cam.zoomTo(this.baseZoom(), 550, 'Sine.easeInOut', true);
    cam.pan(this.feet.x, this.feet.y + 18, 550, 'Sine.easeInOut', true, (_c: unknown, p: number) => {
      if (p === 1 && !this.buildView) cam.startFollow(this.feet, false, 0.085, 0.085, 0, 18);
    });
  }

  fitCamera() {
    if (this.buildView) { const t = this.buildViewTarget(); this.cameras.main.setZoom(t.z).centerOn(t.cx, t.cy); return; }
    this.cameras.main.setZoom(this.baseZoom());
    // Snap to the player after a resize/rotation instead of lerping in from far away.
    if (this.feet) this.cameras.main.centerOn(this.feet.x, this.feet.y + 18);
  }

  // ------------------------------------------------------------ world building
  buildPond() {
    const rng = mulberry32(5);
    // Reeds along the rim.
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2;
      if (a > Math.PI * 0.15 && a < Math.PI * 0.85 && rng() < 0.6) continue; // fewer on the front edge
      const x = POND.x + Math.cos(a) * (POND.rx + 2);
      const y = POND.y + Math.sin(a) * (POND.ry + 2);
      const r = this.img(x, y, `reeds${i % 2}`, 0.5, 1, 0.9 + rng() * 0.4).setDepth(y);
      this.sway(r, 0.06, 1.3);
    }
    // Lily pads.
    for (let i = 0; i < 14; i++) {
      let x = 0, y = 0;
      do { x = POND.x + (rng() * 2 - 1) * POND.rx; y = POND.y + (rng() * 2 - 1) * POND.ry; } while (pondValue(x, y) > 0.7);
      const l = this.img(x, y, `lily${i % 3}`, 0.5, 0.5, 0.9 + rng() * 0.5).setDepth(-400).setRotation(rng() * 0.6 - 0.3);
      this.lilies.push(l);
    }
    // Glints.
    this.add.particles(0, 0, ATLAS, {
      frame: 'spark',
      emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(POND.x, POND.y, POND.rx * 1.6, POND.ry * 1.5) as any },
      lifespan: { min: 600, max: 1400 },
      frequency: 90,
      scale: { values: [0.05, 0.28, 0.05] },
      alpha: { values: [0, 0.9, 0] },
      blendMode: 'ADD',
      tint: 0xfff6d8,
    } as any).setDepth(-390);
    // Ripples.
    this.time.addEvent({
      delay: 900, loop: true, callback: () => {
        let x = 0, y = 0;
        do { x = POND.x + (Math.random() * 2 - 1) * POND.rx; y = POND.y + (Math.random() * 2 - 1) * POND.ry; } while (pondValue(x, y) > 0.75);
        const r = this.fx(x, y, 'ripple', 0.2).setDepth(-395).setAlpha(0.5).setBlendMode('ADD');
        this.tweens.add({ targets: r, scale: r.scale * 4, alpha: 0, duration: 2200, ease: 'Sine.easeOut', onComplete: () => r.destroy() });
      },
    });
    // Rocks on the bank.
    const rocks: [number, number, number][] = [[POND.x - POND.rx - 20, POND.y + 40, 1], [POND.x + POND.rx + 12, POND.y - 30, 2], [POND.x + 90, POND.y + POND.ry + 22, 0], [POND.x - 140, POND.y - POND.ry - 10, 0]];
    for (const [x, y, v] of rocks) {
      this.reacts.rock(this.img(x, y, `rock${v}`).setDepth(y));
      this.shadow(x, y - 2, 60 + v * 10, 0.7);
      this.solidCircle(x, y - 8, 14 + v * 4);
    }
  }

  buildCottage() {
    const { x, y } = COTTAGE;
    this.shadow(x + 10, y - 6, 340, 0.9);
    this.img(x, y, 'cottage', 0.5, 1, 1.12).setDepth(y);
    this.solidRect(x - 132, y - 66, 264, 60);
    // Warm window glow.
    for (const dx of [-91, 91]) {
      const g = this.fx(x + dx, y - 71, 'glow', 0.38).setBlendMode('ADD').setTint(0xffb060).setAlpha(0.35).setDepth(y + 1);
      this.windowGlows.push(g);
    }
    // Chimney smoke.
    this.add.particles(x + 58, y - 258, ATLAS, {
      frame: 'smoke',
      lifespan: 4200,
      frequency: 260,
      speedY: { min: -26, max: -18 },
      speedX: { min: 4, max: 14 },
      scale: { start: 0.18, end: 0.9 },
      alpha: { values: [0, 0.45, 0.25, 0] } as any,
      rotate: { min: 0, max: 360 },
      tint: 0xf6efe4,
    } as any).setDepth(y + 2);
    // Garden + fence.
    const rng = mulberry32(8);
    const { x: gx, y: gy, w: gw, h: gh } = GARDEN;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        const px = gx + 20 + c * 27 + rng() * 4;
        const py = gy + 22 + r * ((gh - 30) / 3);
        const key = r % 2 ? 'tuft1' : `flower${(c + r) % 5}`;
        const p = this.img(px, py, key, 0.5, 1, 0.8).setDepth(py);
        this.sway(p, 0.08, 1.6);
      }
    }
    for (let i = 0; i < 3; i++) {
      const fx = gx + 26 + i * 50;
      this.img(fx, gy + gh + 14, 'fence').setDepth(gy + gh + 14);
      this.img(fx, gy - 4, 'fence').setDepth(gy - 4);
    }
    this.solidRect(gx, gy + gh - 2, gw, 14);
    this.solidRect(gx, gy - 20, gw, 14);
    this.solidRect(gx - 8, gy - 20, 10, gh + 34);
    // Bushes hugging the cottage.
    const bushes: [number, number, number][] = [[x - 165, y - 4, 1], [x + 165, y - 6, 0], [x + 128, y + 16, 2], [x - 128, y + 18, 0]];
    for (const [bx, by, v] of bushes) {
      const b = this.img(bx, by, `bush${v}`).setDepth(by);
      this.shadow(bx, by - 3, 80, 0.6);
      this.solidCircle(bx, by - 10, 16);
      this.sway(b, 0.02, 0.9);
      this.reacts.bush(b);
    }
    // Wind chime by the door.
    const chime = this.img(x + 52, y - 92, 'chime', 0.5, 0, 0.9).setDepth(y + 3);
    this.sway(chime, 0.05, 1.7);
    this.reacts.chime(chime);
    // Mushrooms + a woodpile hint.
    this.img(x - 165, y - 20, 'mushrooms').setDepth(y - 20);
  }

  buildNorth() {
    // Hedge wall with a gap for the gate.
    const gx0 = GATE.x - GATE.gapHalf;
    const gx1 = GATE.x + GATE.gapHalf;
    this.solidRect(0, WALL_Y - 34, gx0 - 6, 40);
    this.solidRect(gx1 + 6, WALL_Y - 34, GLADE_W - gx1 - 6, 40);
    // Shrine clearing side walls (trees fill the rest of the north band).
    this.solidRect(0, 0, SHRINE_CLEARING.x0, WALL_Y - 30);
    this.solidRect(SHRINE_CLEARING.x1, 0, GLADE_W - SHRINE_CLEARING.x1, WALL_Y - 30);
    this.solidRect(0, 0, GLADE_W, 48);

    // Hedge bushes in front of the clearing so you can peek into the grove.
    const rng = mulberry32(21);
    for (let x = SHRINE_CLEARING.x0 - 10; x <= SHRINE_CLEARING.x1 + 10; x += 34) {
      if (x > gx0 - 30 && x < gx1 + 30) continue;
      const y = WALL_Y + rng() * 8;
      const b = this.img(x, y, `bush${Math.floor(rng() * 3)}`, 0.5, 1, 1.15 + rng() * 0.25).setDepth(y);
      this.sway(b, 0.015, 0.8);
    }

    // Gate pillars + brambles.
    const p0 = this.img(gx0 - 8, GATE.y, 'pillar0').setDepth(GATE.y);
    const p1 = this.img(gx1 + 8, GATE.y, 'pillar1').setDepth(GATE.y);
    this.shadow(gx0 - 8, GATE.y - 4, 60, 0.7);
    this.shadow(gx1 + 8, GATE.y - 4, 60, 0.7);
    this.solidCircle(gx0 - 8, GATE.y - 10, 16);
    this.solidCircle(gx1 + 8, GATE.y - 10, 16);
    for (const p of [p0, p1]) {
      const g = this.fx(p.x, GATE.y - 68, 'glow', 0.25).setBlendMode('ADD').setTint(0x7fe8ff).setAlpha(0).setDepth(GATE.y + 1);
      this.gateGlows.push(g);
    }
    this.brambles = this.img(GATE.x, GATE.y - 2, 'brambles').setDepth(GATE.y - 1);
    this.tweens.add({ targets: this.brambles, scaleX: this.brambles.scaleX * 1.015, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });
    this.barrier = this.solidRect(gx0, GATE.y - 36, gx1 - gx0, 34);

    // Bushes + mushrooms closing the top of the clearing.
    for (let x = SHRINE_CLEARING.x0 + 20; x <= SHRINE_CLEARING.x1 - 20; x += 38) {
      const y = 58 + rng() * 14;
      const b = this.img(x, y, `bush${Math.floor(rng() * 3)}`, 0.5, 1, 1.3 + rng() * 0.3).setDepth(y);
      this.sway(b, 0.015, 0.8);
    }
    // Shrine: chest on the flagstones, a sunbeam, flowers.
    const chest = this.img(SHRINE.x, SHRINE.y + 10, 'chest_closed').setDepth(SHRINE.y + 10);
    this.shadow(SHRINE.x, SHRINE.y + 8, 70, 0.7);
    this.solidRect(SHRINE.x - 24, SHRINE.y - 6, 48, 16);
    this.chest = chest;
    this.interactables.push({
      x: SHRINE.x, y: SHRINE.y + 10, r: 62, label: 'Open', promptY: 50,
      enabled: () => !this.chestOpened,
      action: () => this.openChest(),
    });
    for (let i = 0; i < 18; i++) {
      const a = rng() * Math.PI * 2;
      const d = SHRINE.r + 20 + rng() * 60;
      const x = SHRINE.x + Math.cos(a) * d * 1.4;
      const y = SHRINE.y + Math.sin(a) * d * 0.7;
      if (y > WALL_Y - 30 || y < 60) continue;
      const f = this.img(x, y, rng() < 0.5 ? `flower${Math.floor(rng() * 5)}` : 'mushrooms').setDepth(y);
      this.sway(f, 0.07, 1.4);
    }
  }

  buildTrees() {
    const rng = mulberry32(99);
    const spots: { x: number; y: number; kinds: string[] }[] = [];
    const border = ['tree0', 'tree1', 'tree2', 'tree5', 'pine0', 'pine1'];
    const interior = ['tree0', 'tree1', 'tree3', 'tree4', 'tree2'];
    // North band (behind the wall), skipping the shrine clearing.
    for (let y = 70; y <= WALL_Y + 10; y += 62) {
      for (let x = 20; x <= GLADE_W; x += 64) {
        const inClearing = x > SHRINE_CLEARING.x0 + 30 && x < SHRINE_CLEARING.x1 - 30 && y > 40;
        if (inClearing) continue;
        spots.push({ x: x + rng() * 40 - 20, y: y + rng() * 24, kinds: border });
      }
    }
    // Trees framing the sides of the clearing (the top edge gets bushes, see buildNorth).
    for (const fx of [SHRINE_CLEARING.x0 + 40, SHRINE_CLEARING.x1 - 40]) {
      spots.push({ x: fx, y: 230 + rng() * 20, kinds: ['tree3', 'tree4'] });
      spots.push({ x: fx + (fx < 1000 ? 30 : -30), y: 140 + rng() * 20, kinds: ['tree0', 'tree5'] });
    }
    // Left / right / bottom edges.
    // Left / right / bottom edges, with openings east (to Brookside) and south (to the lake).
    const eastGap = (y: number) => y > 520 && y < 730;
    for (let y = WALL_Y + 70; y < GLADE_H + 40; y += 58) {
      spots.push({ x: 30 + rng() * 50, y, kinds: border });
      const ry = y + 20;
      const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng(), r5 = rng();
      if (!eastGap(ry)) spots.push({ x: GLADE_W - 30 - r1 * 50, y: ry, kinds: border });
      if (r2 < 0.6) spots.push({ x: 100 + r3 * 40, y: y + 25, kinds: border });
      if (r4 < 0.6 && !eastGap(y + 5)) spots.push({ x: GLADE_W - 110 - r5 * 40, y: y + 5, kinds: border });
    }
    for (let x = 120; x < GLADE_W - 100; x += 62) {
      if (Math.abs(x - 915) < 80) continue;
      spots.push({ x: x + rng() * 30, y: GLADE_H + 45 + rng() * 30, kinds: border });
      if (rng() < 0.35 && Math.abs(x - 915) > 200) spots.push({ x: x + rng() * 30, y: GLADE_H - 20 + rng() * 20, kinds: border });
    }
    // Interior groves.
    const groves: [number, number, number][] = [[260, 1020, 4], [300, 1280, 3], [1680, 1170, 4], [1520, 380, 3], [1790, 820, 3], [700, 1080, 2], [1240, 1200, 2], [1290, 420, 2], [640, 420, 2], [180, 760, 2]];
    for (const [gx, gy, n] of groves) {
      for (let i = 0; i < n; i++) spots.push({ x: gx + (rng() * 2 - 1) * 70, y: gy + (rng() * 2 - 1) * 50, kinds: interior });
    }

    for (const s of spots) {
      if (distToPaths(s.x, s.y, ALL_PATHS) < 50 && s.y > WALL_Y + 20) continue;
      if (pondValue(s.x, s.y, 50) < 1) continue;
      if (Math.abs(s.x - COTTAGE.x) < 180 && s.y > COTTAGE.y - 120 && s.y < COTTAGE.y + 60) continue;
      if (LANTERNS.some((l) => Math.hypot(l.x - s.x, l.y - s.y) < 80)) continue;
      if (Math.hypot(SIGN.x - s.x, SIGN.y - s.y) < 60) continue;
      const key = s.kinds[Math.floor(rng() * s.kinds.length)];
      const scale = 0.85 + rng() * 0.35;
      const isPine = key.startsWith('pine');
      const oy = isPine ? (190 - 8) / 190 : (210 - 8) / 210;
      const t = this.img(s.x, s.y, key, 0.5, oy, scale).setDepth(s.y).setFlipX(rng() < 0.5);
      this.shadow(s.x + 14, s.y - 4, (isPine ? 90 : 150) * scale, 0.75);
      this.sway(t, isPine ? 0.008 : 0.014, 0.6 + rng() * 0.4);
      this.reacts.tree(t, key === 'tree3' || key === 'tree4' ? 'blossom' : key === 'tree0' ? 'fruit' : 'leaf');
      if (s.y > WALL_Y - 10) this.solidCircle(s.x, s.y - 6, 15 * scale);
    }
  }

  buildScatter() {
    const rng = mulberry32(314);
    const ok = (x: number, y: number, pathPad = 34) =>
      y > WALL_Y + 25 && y < GLADE_H - 60 && x > 130 && x < GLADE_W - 130 &&
      pondValue(x, y, 26) > 1 && distToPaths(x, y, ALL_PATHS) > pathPad &&
      !(Math.abs(x - COTTAGE.x) < 160 && y > COTTAGE.y - 90 && y < COTTAGE.y + 30) &&
      !(x > GARDEN.x - 20 && x < GARDEN.x + GARDEN.w + 20 && y > GARDEN.y - 30 && y < GARDEN.y + GARDEN.h + 30);
    // Grass tufts.
    for (let i = 0; i < 420; i++) {
      const x = rng() * GLADE_W;
      const y = rng() * GLADE_H;
      if (!ok(x, y, 28)) continue;
      const t = this.img(x, y, `tuft${i % 3}`, 0.5, 1, 0.8 + rng() * 0.6).setDepth(y);
      this.sway(t, 0.09, 1.2 + rng() * 0.8);
    }
    // Flower clumps, clustered.
    for (let c = 0; c < 34; c++) {
      const cx = rng() * GLADE_W;
      const cy = rng() * GLADE_H;
      const kind = Math.floor(rng() * 5);
      for (let i = 0; i < 6; i++) {
        const x = cx + (rng() * 2 - 1) * 50;
        const y = cy + (rng() * 2 - 1) * 34;
        if (!ok(x, y)) continue;
        const f = this.img(x, y, `flower${kind}`, 0.5, 1, 0.85 + rng() * 0.4).setDepth(y);
        this.sway(f, 0.1, 1.4 + rng() * 0.8);
        this.reacts.flower(f);
      }
    }
    // Bushes + rocks dotted around.
    for (let i = 0; i < 26; i++) {
      const x = rng() * GLADE_W;
      const y = rng() * GLADE_H;
      if (!ok(x, y, 60)) continue;
      if (LANTERNS.some((l) => Math.hypot(l.x - x, l.y - y) < 70)) continue;
      if (rng() < 0.65) {
        const b = this.img(x, y, `bush${i % 3}`, 0.5, 1, 0.9 + rng() * 0.3).setDepth(y);
        this.shadow(x + 4, y - 3, 76, 0.6);
        this.solidCircle(x, y - 10, 15);
        this.sway(b, 0.02, 0.8);
        this.reacts.bush(b);
      } else {
        const v = i % 3;
        this.reacts.rock(this.img(x, y, `rock${v}`).setDepth(y));
        this.shadow(x + 3, y - 2, 56 + v * 10, 0.6);
        this.solidCircle(x, y - 8, 13 + v * 4);
      }
    }
  }

  buildLanterns() {
    for (const L of LANTERNS) {
      const glow = this.fx(L.x, L.y - 58, 'glow', 0.9).setBlendMode('ADD').setTint(0xff9636).setAlpha(0).setDepth(L.y + 2);
      this.shadow(L.x + 4, L.y - 3, 50, 0.8);
      const img = this.img(L.x, L.y, 'lantern_off').setDepth(L.y);
      // Big bold symbol plate on the lantern, with its order number beside it.
      const pl = plate(this, L.x, L.y - 30, `q_${L.id}`, 19);
      pl.c.setDepth(8400 + L.y * 0.001);
      const sym = pl.im;
      const badge = new NumBadge(this, L.x + 27, L.y - 52, LANTERN_ORDER.indexOf(L.id) + 1, 13).setDepth(8401 + L.y * 0.001);
      const lantern: Lantern = { id: L.id, x: L.x, y: L.y, lit: false, img, glow, sym, badge };
      this.lanterns.push(lantern);
      this.solidCircle(L.x, L.y - 8, 15);
      this.interactables.push({
        x: L.x, y: L.y, r: 58, label: 'Light', promptY: 100,
        enabled: () => !lantern.lit && !this.solved,
        action: () => this.lightLantern(lantern),
      });
      // A ring of little flowers around each lantern so they read as landmarks.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const fx = L.x + Math.cos(a) * 34;
        const fy = L.y + Math.sin(a) * 16 + 2;
        const f = this.img(fx, fy, `flower${(i + L.x) % 5}`, 0.5, 1, 0.75).setDepth(fy);
        this.sway(f, 0.1, 1.5);
      }
    }
  }

  // ------------------------------------------------------------ Wild Woods trailhead
  inWild = false;
  buildTrailhead() {
    const T = TRAILHEAD;
    this.shadow(T.x, T.y - 2, 120, 0.6);
    const p0 = this.img(T.x - 46, T.y, 'pillar0', 0.5, 1, 0.8).setDepth(T.y);
    const p1 = this.img(T.x + 46, T.y, 'pillar1', 0.5, 1, 0.8).setDepth(T.y);
    void p0; void p1;
    const glow = this.fx(T.x, T.y - 46, 'glow', 2.2).setBlendMode('ADD').setTint(0x9fe0ff).setDepth(T.y - 1);
    this.tweens.add({ targets: glow, alpha: { from: 0.55, to: 1 }, scale: glow.scale * 1.15, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({ delay: 420, loop: true, callback: () => { if (this.cameras.main.worldView.contains(T.x, T.y)) this.burst(T.x + (Math.random() - 0.5) * 60, T.y - 30 - Math.random() * 50, 0xbfe8ff, 2); } });
    const sign = this.img(T.x - 105, T.y + 6, 'sign', 0.5, 1, 0.9).setDepth(T.y + 6);
    const pl = plate(this, T.x - 105, T.y - 64, 'q_wild', 22);
    pl.c.setDepth(8400);
    void sign;
    this.interactables.push({
      x: T.x, y: T.y - 4, r: 70, label: 'Explore!', promptY: 100, reach: 200, approach: [0, 30],
      enabled: () => !this.inWild, action: () => this.enterWild(),
    });
  }

  /** Off into the Wild Woods: a new seeded patch of forest each trip. */
  enterWild(seed?: number) {
    if (this.inWild) return;
    this.inWild = true;
    this.locked = true;
    this.path = []; this.body.setVelocity(0, 0);
    sfx.chimes();
    const cam = this.cameras.main;
    cam.fadeOut(500, 255, 250, 235);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.sleep('ui'); this.scene.sleep('vui');
      this.scene.sleep();
      this.scene.launch('wild', { seed });
    });
  }

  /** Back from the woods: through the portal you pop out at the trailhead, otherwise at home. */
  returnFromWild(why: 'button' | 'portal' | 'faint', banked: { glowmoss: number; starshard: number; found: string[] } = { glowmoss: 0, starshard: 0, found: [] }) {
    this.scene.wake(); this.scene.wake('ui'); this.scene.wake('vui');
    const at = why === 'portal' ? { x: TRAILHEAD.x, y: TRAILHEAD.y + 70 } : { x: COTTAGE.x, y: COTTAGE.y + 70 };
    this.feet.setPosition(at.x, at.y); this.body.reset(at.x, at.y);
    this.lastSafe = [at.x, at.y]; this.path = [];
    this.cameras.main.centerOn(at.x, at.y + 18);
    this.ground.update(this.cameras.main.worldView, 99);
    this.cameras.main.fadeIn(700, 255, 250, 235);
    this.locked = false;
    this.inWild = false;
    persist();
    this.time.delayedCall(500, () => {
      this.game.events.emit('wild-home', why, banked);
      // Wild finds help the village: glow moss makes soup, star shards make strong stone.
      if (banked.glowmoss) this.village.add('food', banked.glowmoss, this.feet.x - 20, this.feet.y - 60);
      if (banked.starshard) this.village.add('stone', banked.starshard * 2, this.feet.x + 20, this.feet.y - 60);
    });
  }

  buildSign() {
    resetStone(this, SIGN.x + 75, SIGN.y + 20, 'lanterns', () => this.resetLanterns());
    this.shadow(SIGN.x + 3, SIGN.y - 2, 44, 0.7);
    this.img(SIGN.x, SIGN.y, 'sign').setDepth(SIGN.y);
    this.solidCircle(SIGN.x, SIGN.y - 5, 8);
    this.interactables.push({
      x: SIGN.x, y: SIGN.y, r: 56, label: 'Read', promptY: 70, enabled: () => true,
      action: () => this.game.events.emit('dialog', [
        'Light the lanterns in order.',
        '1 is dawn. 2 is noon. 3 is dusk.',
        'Then the gate opens!',
      ], LANTERN_ORDER.map((id, i): SeqCard => ({ n: i + 1, icon: `q_${id}`, label: id, done: this.solved || this.litOrder.includes(id) }))),
    });
  }

  buildPlayer() {
    this.feet = this.add.zone(PLAYER_START.x, PLAYER_START.y, 20, 12);
    this.physics.add.existing(this.feet);
    this.body = this.feet.body as Phaser.Physics.Arcade.Body;
    this.body.setCircle(9, 1, -3);
    this.body.setCollideWorldBounds(true);
    this.physics.add.collider(this.feet, this.solids);
    this.playerShadow = this.shadow(PLAYER_START.x, PLAYER_START.y, 34, 0.9);
    this.heroKey = buildHeroSheet(this, save.look);
    this.playerImg = this.add.image(PLAYER_START.x, PLAYER_START.y, this.heroKey, '0_0').setOrigin(0.5, 1).setScale(1 / S);
    this.dust = this.add.particles(0, 0, ATLAS, {
      frame: 'smoke',
      lifespan: 600, speed: { min: 6, max: 22 }, angle: { min: 200, max: 340 },
      scale: { start: 0.12, end: 0.3 }, alpha: { start: 0.45, end: 0 }, tint: 0xe9d8b4, emitting: false,
    }).setDepth(-450);
  }

  buildAtmosphere() {
    // Drifting pollen across the whole glade.
    const viewZone = () => ({ type: 'random', source: new Phaser.Geom.Rectangle(-200, -200, 1500, 1100) as any });
    this.ambient.push(this.add.particles(0, 0, ATLAS, {
      frame: 'dot',
      emitZone: viewZone(),
      lifespan: { min: 5000, max: 9000 },
      frequency: 40,
      speedX: { min: 4, max: 18 },
      speedY: { min: -10, max: 4 },
      scale: { min: 0.09, max: 0.18 },
      alpha: { values: [0, 0.75, 0.6, 0] } as any,
      tint: [0xfff3c4, 0xffe8a3, 0xffffff],
      blendMode: 'ADD',
    } as any).setDepth(8000));
    // Fireflies near the forest edges and the shrine.
    const fireflyZones = [new Phaser.Geom.Rectangle(2600, 200, 1600, 1000), new Phaser.Geom.Rectangle(700, 60, 600, 260), new Phaser.Geom.Rectangle(120, 380, 260, 1000), new Phaser.Geom.Rectangle(1640, 380, 260, 1000), new Phaser.Geom.Rectangle(1100, 1020, 500, 160)];
    for (const z of fireflyZones) {
      this.fireflies.push(this.add.particles(0, 0, ATLAS, {
      frame: 'glow',
        emitZone: { type: 'random', source: z as any },
        lifespan: { min: 3000, max: 6000 },
        frequency: 240,
        speed: { min: 4, max: 14 },
        scale: { min: 0.04, max: 0.07 },
        alpha: { values: [0, 0.9, 0.2, 0.95, 0] } as any,
        tint: [0xe6ff8a, 0xfff07a],
        blendMode: 'ADD',
      } as any).setDepth(8001));
    }
    // Falling petals from the blossom trees region.
    this.ambient.push(this.add.particles(0, 0, ATLAS, {
      frame: 'petal',
      emitZone: viewZone(),
      lifespan: 6000, frequency: 700,
      speedX: { min: 10, max: 30 }, speedY: { min: 8, max: 20 },
      rotate: { min: 0, max: 360 },
      scale: { min: 0.22, max: 0.34 },
      alpha: { values: [0, 0.9, 0.9, 0] } as any,
    } as any).setDepth(8002));
    // Sunbeams.
    const beamSpots: [number, number, number][] = [[2900, 500, 1.2], [3600, 900, 1.0], [3300, 2100, 1.1], [1200, 2000, 1.2], [600, 2300, 1.0], [2150, 1200, 0.9], [600, 300, 1.0], [1150, 650, 1.3], [1000, 160, 0.8], [400, 1000, 1.1], [1600, 900, 1.0], [800, 1300, 0.9]];
    for (const [x, y, s] of beamSpots) {
      const r = this.fx(x, y, 'ray', 1).setBlendMode('ADD').setRotation(-0.55).setAlpha(0.12).setDepth(8500);
      r.setScale(3.2 * s, 2.4 * s);
      this.rays.push(r);
    }
    // Drifting cloud shadows.
    for (let i = 0; i < 10; i++) {
      const c = this.fx(Math.random() * WORLD_W, 200 + Math.random() * (WORLD_H - 300), 'cloud', 4 + Math.random() * 2)
        .setTint(0x1c2a3a).setAlpha(0.13).setDepth(8400);
      this.clouds.push(c);
    }
  }

  // ------------------------------------------------------------ puzzle
  lightLantern(L: Lantern) {
    const expected = LANTERN_ORDER[this.litOrder.length];
    L.lit = true;
    L.img.setTexture(ATLAS, 'lantern_on');
    this.tweens.add({ targets: L.glow, alpha: 0.42, duration: 500, ease: 'Sine.easeOut' });
    this.burst(L.x, L.y - 62, 0xffd27a, 18);
    if (L.id === expected) {
      this.litOrder.push(L.id);
      L.badge.set('done');
      sfx.lantern(this.litOrder.length - 1);
      this.cameras.main.shake(140, 0.0015);
      this.game.events.emit('lanterns', [...this.litOrder]);
      if (this.litOrder.length === LANTERN_ORDER.length) { setPuzzle('lanterns'); this.solve(); }
    } else {
      sfx.lantern(this.litOrder.length);
      L.badge.set('wrong');
      this.locked = true;
      this.time.delayedCall(650, () => {
        sfx.fizzle();
        for (const l of this.lanterns) {
          l.badge.set('todo');
          if (!l.lit) continue;
          l.lit = false;
          l.img.setTexture(ATLAS, 'lantern_off');
          l.badge.set('todo');
          this.tweens.add({ targets: l.glow, alpha: 0, duration: 400 });
          this.smoke(l.x, l.y - 62);
        }
        this.litOrder = [];
        this.game.events.emit('lanterns', []);
        this.game.events.emit('toast', 'Oops! Try a new order.');
        this.locked = false;
      });
    }
  }

  /** Replay reward: a little pile of wood and stone (treasures are never given twice). */
  puzzleBonus(x: number, y: number) {
    sfx.sparkle();
    this.burst(x, y, 0xffe08a, 30, 'spark');
    this.village.add('wood', 3, x - 20, y);
    this.village.add('stone', 2, x + 20, y);
    this.game.events.emit('toast', 'Bonus! You got wood and stone!');
    this.game.events.emit('bonus');
  }
  puzzleDirty(id: string) { return id === 'lanterns' ? this.litOrder.length > 0 : this.puzzles.dirty(id); }
  resetLanterns() {
    this.solved = false;
    this.litOrder = [];
    for (const l of this.lanterns) {
      l.badge.set('todo');
      if (!l.lit) continue;
      l.lit = false;
      l.img.setTexture(ATLAS, 'lantern_off');
      this.tweens.add({ targets: l.glow, alpha: 0, duration: 400 });
      this.smoke(l.x, l.y - 62);
    }
    this.game.events.emit('lanterns', []);
  }

  solve() {
    this.solved = true;
    if (this.gateOpen) { this.time.delayedCall(500, () => { sfx.solve(); this.puzzleBonus(this.feet.x, this.feet.y - 70); }); return; }
    this.locked = true;
    this.body.setVelocity(0, 0);
    const cam = this.cameras.main;
    this.time.delayedCall(700, () => {
      sfx.solve();
      cam.stopFollow();
      cam.pan(GATE.x, GATE.y - 60, 1500, 'Sine.easeInOut', false, (_c: any, p: number) => {
        if (p < 1) return;
        // Brambles unravel.
        this.burst(GATE.x, GATE.y - 40, 0xc59bff, 40, 'spark');
        this.burst(GATE.x, GATE.y - 30, 0x9be07a, 30, 'leaf');
        const flash = this.fx(GATE.x, GATE.y - 50, 'glow', 0.2).setBlendMode('ADD').setTint(0xffe6b0).setDepth(9000).setAlpha(0.9);
        this.tweens.add({ targets: flash, scale: flash.scale * 7, alpha: 0, duration: 1400, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
        this.tweens.add({ targets: this.brambles, scaleY: 0, alpha: 0, duration: 1300, ease: 'Back.easeIn' });
        this.tweens.add({ targets: this.gateGlows, alpha: 0.7, duration: 900 });
        cam.shake(450, 0.0035);
        (this.barrier.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.buildNav();
        this.time.delayedCall(1900, () => {
          cam.pan(this.feet.x, this.feet.y + 18, 1100, 'Sine.easeInOut', false, (_c2: any, p2: number) => {
            if (p2 < 1) return;
            cam.startFollow(this.feet, false, 0.085, 0.085, 0, 18);
            this.locked = false;
            this.gateOpen = true;
            this.game.events.emit('toast', 'The gate is open! Go look!');
          });
        });
      });
    });
  }

  openChest() {
    this.chestOpened = true;
    addTreasure('golden_feather');
    this.chest.setTexture(ATLAS, 'chest_open');
    sfx.sparkle();
    this.cameras.main.shake(200, 0.002);
    this.burst(SHRINE.x, SHRINE.y - 10, 0xffe08a, 40, 'spark');
    const glow = this.fx(SHRINE.x, SHRINE.y - 20, 'glow', 0.3).setBlendMode('ADD').setTint(0xffd27a).setDepth(SHRINE.y + 30).setAlpha(0);
    const feather = this.img(SHRINE.x, SHRINE.y - 6, 'feather', 0.5, 0.5, 1.1).setDepth(SHRINE.y + 31);
    this.tweens.add({ targets: glow, alpha: 0.85, scale: glow.scale * 2.2, duration: 900, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: [feather, glow], y: SHRINE.y - 70, duration: 1400, ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: [feather, glow], y: SHRINE.y - 78, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: feather, angle: 8, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
        this.game.events.emit('feather');
        this.game.events.emit('treasure', 'golden_feather');
        this.game.events.emit('dialog', [
          'You found a Golden Feather!',
          'It is warm and shiny!',
        ]);
      },
    });
  }

  burst(x: number, y: number, tint: number, n: number, key = 'spark') {
    const e = this.add.particles(x, y, ATLAS, {
      frame: key,
      speed: { min: 40, max: 160 },
      lifespan: { min: 700, max: 1400 },
      scale: key === 'spark' ? { start: 0.35, end: 0 } : { start: 0.4, end: 0.2 },
      alpha: { start: 1, end: 0 },
      gravityY: key === 'leaf' ? 60 : -20,
      rotate: { min: 0, max: 360 },
      tint,
      blendMode: key === 'spark' ? 'ADD' : 'NORMAL',
      emitting: false,
    } as any).setDepth(9001);
    e.explode(n);
    this.time.delayedCall(1600, () => e.destroy());
  }

  smoke(x: number, y: number) {
    const e = this.add.particles(x, y, ATLAS, {
      frame: 'smoke',
      speed: { min: 10, max: 40 }, angle: { min: 230, max: 310 },
      lifespan: 1200, scale: { start: 0.15, end: 0.6 }, alpha: { start: 0.6, end: 0 }, tint: 0x9aa0a8, emitting: false,
    }).setDepth(9001);
    e.explode(10);
    this.time.delayedCall(1400, () => e.destroy());
  }

  // ------------------------------------------------------------ interaction
  tryInteract() {
    if (this.registry.get('menuOpen')) return;
    if (this.registry.get('dialogOpen')) { this.game.events.emit('dialog-advance'); return; }
    if (this.locked) return;
    if (this.fishing.active) { this.fishing.tap(); return; }
    const target = this.nearestInteractable();
    if (target) { this.path = []; this.pathTarget = null; target.action(); }
  }

  // ------------------------------------------------------------ touch: tap-to-move + stick
  buildNav() {
    const nav = new NavGrid(WORLD_W, WORLD_H, 20);
    const PAD = 9;
    for (const z of this.solids.getChildren() as Phaser.GameObjects.Zone[]) {
      const b = z.body as Phaser.Physics.Arcade.StaticBody;
      if (!b || !b.enable) continue;
      if (b.isCircle) nav.blockCircle(b.center.x, b.center.y, b.halfWidth, PAD);
      else nav.blockRect(b.x, b.y, b.width, b.height, PAD);
    }
    nav.blockWhere((x, y) => waterBlocks(x, y) || x < 10 || y < 10 || x > WORLD_W - 10 || y > WORLD_H - 10);
    this.nav = nav;
  }

  /** Analog stick from the UI (screen-space, magnitude 0..1), or null when released. */
  setStick(v: { x: number; y: number } | null) {
    this.stick = v;
    if (v) { this.path = []; this.pathTarget = null; }
  }

  /** Tap at a canvas-pixel position: walk there, or to an object and use it. */
  tapScreen(px: number, py: number) {
    const p = this.cameras.main.getWorldPoint(px, py);
    this.tapWorld(p.x, p.y);
  }

  tapWorld(wx: number, wy: number) {
    if (this.locked || this.registry.get('dialogOpen') || this.registry.get('menuOpen')) return;
    if (this.village.building) { this.village.buildTap(wx, wy); return; }
    if (this.fishing.active) { this.fishing.tap(); return; }
    // Creatures and reactive objects respond right away, wherever they are on screen.
    let tb: Tappable | null = null;
    let tbD = Infinity;
    const onPath = pathDist(wx, wy) < 30;
    for (const t of this.tappables) {
      if (t.enabled && !t.enabled()) continue;
      if (t.soft && onPath) continue;
      const d = Math.hypot(wx - t.x(), wy - t.y());
      if (d < t.r && d < tbD) { tbD = d; tb = t; }
    }
    // Objects are drawn above their base, so test against a point partway up the sprite too.
    let target: Interactable | null = null;
    let bestD = 64;
    for (const it of this.interactables) {
      if (it.noTap || !it.enabled()) continue;
      const d = Math.min(Math.hypot(wx - it.x, wy - it.y), Math.hypot(wx - it.x, wy - (it.y - it.promptY * 0.55)));
      if (d < bestD) { bestD = d; target = it; }
    }
    if (tb && (!target || tbD < bestD * 0.8)) {
      if (tb.feed && save.snacks > 0) this.feedTap(tb); else tb.tap();
      return;
    }
    // Already standing next to it (or within its reach): just use it.
    if (target && (this.nearestInteractable() === target || (target.reach && Math.hypot(target.x - this.feet.x, target.y - this.feet.y) < target.reach))) {
      target.action(); this.path = []; this.pathTarget = null; return;
    }
    // Water: cast a line if close enough, otherwise walk to the shore first.
    if (!target && waterAt(wx, wy)) { this.fishing.tapWater(wx, wy); return; }
    const [ax, ay] = target?.approach ?? [0, 26];
    const gx = target ? target.x + ax : wx;
    const gy = target ? target.y + ay : wy;
    this.walkTo(gx, gy, target);
  }

  fed = 0;
  /** Feed an animal: walk over if it is far, toss a fruit, hearts, and it tags along. */
  feedTap(tb: Tappable) {
    const x = tb.x(), y = tb.y();
    if (Math.hypot(x - this.feet.x, y - this.feet.y) > 260) { this.walkTo(x, y + 30, null, () => this.feedAnimal(tb)); return; }
    this.feedAnimal(tb);
  }
  feedAnimal(tb: Tappable) {
    if (save.snacks <= 0 || !tb.feed) { tb.tap(); return; }
    save.snacks--;
    persist();
    this.game.events.emit('snacks', save.snacks);
    const x = tb.x(), y = tb.y();
    const fruit = this.add.image(this.feet.x, this.feet.y - 40, atlasOf('apple'), 'apple').setScale(1 / (frameScale.apple ?? S)).setDepth(9500);
    this.tweens.add({ targets: fruit, x, duration: 380, ease: 'Linear' });
    this.tweens.add({
      targets: fruit, y: { from: this.feet.y - 40, to: y - 6 }, duration: 380, ease: 'Quad.easeOut',
      onComplete: () => {
        fruit.destroy();
        this.life.hearts.emitParticleAt(x, y - 16, 7);
        this.burst(x, y - 10, 0xff9ccf, 10, 'spark');
        this.floatText(x, y - 40, 'Yum!');
        sfx.purr(); sfx.pickup();
        tb.feed!();
        this.fed++;
        this.game.events.emit('fed');
        this.game.events.emit('toast', save.snacks > 0 ? 'Yum! Now you are friends!' : 'Yum! Tap a fruit tree for more.');
      },
    });
  }

  /** Path to a world point; optionally use an interactable or run a callback on arrival. */
  walkTo(gx: number, gy: number, target: Interactable | null = null, onArrive: (() => void) | null = null) {
    const path = this.nav.find(this.feet.x, this.feet.y, gx, gy);
    this.pathArrive = path ? onArrive : null;
    this.pathTarget = target;
    this.path = path ?? [];
    this.pathStuck = 0;
    this.pathLastD = Infinity;
    const end = this.path[this.path.length - 1];
    if (end) {
      this.tapMarker.setPosition(end[0], end[1]).setAlpha(0.8).setScale(0.18 / frameScale.ripple);
      this.tweens.killTweensOf(this.tapMarker);
      this.tweens.add({ targets: this.tapMarker, scale: 0.6 / frameScale.ripple, alpha: 0, duration: 700, ease: 'Sine.easeOut' });
    }
  }

  /** Steering vector towards the next waypoint (magnitude 0..1). */
  followPath(dt: number): [number, number] {
    if (!this.path.length) return [0, 0];
    // Arrived next to the target object? Use it.
    if (this.pathTarget && this.nearestInteractable() === this.pathTarget) {
      const t = this.pathTarget;
      this.path = []; this.pathTarget = null;
      t.action();
      return [0, 0];
    }
    const [wx, wy] = this.path[0];
    const dx = wx - this.feet.x;
    const dy = wy - this.feet.y;
    const d = Math.hypot(dx, dy);
    const last = this.path.length === 1;
    if (d < (last ? 6 : 16)) {
      this.path.shift();
      if (!this.path.length) {
        const t = this.pathTarget;
        this.pathTarget = null;
        const cb = this.pathArrive;
        this.pathArrive = null;
        if (cb) cb();
        if (t && Math.hypot(t.x - this.feet.x, (t.y - this.feet.y) * 1.3) < t.r * 1.4) t.action();
      }
      return this.followPath(dt);
    }
    // Stuck detection: if we stop closing in, give up gracefully.
    if (d > this.pathLastD - 0.5) this.pathStuck += dt; else this.pathStuck = Math.max(0, this.pathStuck - dt);
    this.pathLastD = d;
    if (this.pathStuck > 0.9) { this.path = []; this.pathTarget = null; this.pathArrive = null; return [0, 0]; }
    const ease = last ? Math.min(1, d / 40 + 0.25) : 1;
    return [(dx / d) * ease, (dy / d) * ease];
  }

  nearestInteractable(): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      if (!it.enabled()) continue;
      const d = Math.hypot(it.x - this.feet.x, (it.y - this.feet.y) * 1.3);
      // The roaming "Fish" prompt always yields to a real object nearby.
      const rank = it === this.fishing?.prompt ? d + 1000 : d;
      if (d < it.r && rank < bestD) { best = it; bestD = rank; }
    }
    return best;
  }

  // ------------------------------------------------------------ update
  /** Gently fade any canopy the hero is standing behind so you never lose them in the woods. */
  fadeCanopies() {
    const px = this.feet.x, py = this.feet.y;
    for (const t of this.canopies) {
      if (!t.visible) continue;
      const dx = Math.abs(px - t.x), dy = t.y - py;
      const behind = dx < t.displayWidth * 0.42 && dy > 4 && dy < t.displayHeight * 0.92;
      const target = behind ? 0.5 : 1;
      if (Math.abs(t.alpha - target) > 0.01) t.setAlpha(t.alpha + (target - t.alpha) * 0.35);
    }
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    const k = this.keys;
    const frozen = this.buildView || this.locked || !!this.registry.get('dialogOpen') || !!this.registry.get('menuOpen') || ['cast', 'reel', 'land'].includes(this.fishing?.state);
    let ix = 0, iy = 0;
    if (!frozen) {
      ix = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      iy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    }
    let len = Math.hypot(ix, iy);
    if (len) { ix /= len; iy /= len; len = 1; }
    else if (!frozen && this.stick) {
      const m = Math.min(1, Math.hypot(this.stick.x, this.stick.y));
      if (m > 0.12) {
        const k2 = Math.min(1, (m - 0.12) / 0.6) * 0.75 + 0.25; // analog, with a gentle floor
        ix = (this.stick.x / m) * k2; iy = (this.stick.y / m) * k2; len = k2;
      }
    } else if (!frozen && this.path.length) {
      [ix, iy] = this.followPath(dt);
      len = Math.hypot(ix, iy);
    }
    const v = this.body.velocity;
    const blend = 1 - Math.exp(-dt * (len ? 12 : 16));
    this.body.setVelocity(v.x + (ix * SPEED - v.x) * blend, v.y + (iy * SPEED - v.y) * blend);

    // Pond: collide against the painted shoreline shape, sliding along it.
    if (waterBlocks(this.feet.x, this.feet.y)) {
      const [lx, ly] = this.lastSafe;
      if (!waterBlocks(this.feet.x, ly)) this.feet.setPosition(this.feet.x, ly);
      else if (!waterBlocks(lx, this.feet.y)) this.feet.setPosition(lx, this.feet.y);
      else this.feet.setPosition(lx, ly);
    }
    this.lastSafe = [this.feet.x, this.feet.y];

    // Facing + animation.
    const speed = Math.hypot(v.x, v.y);
    if (speed > 25) {
      const a = Math.atan2(v.y, v.x);
      const sector = (Math.round(a / (Math.PI / 4)) + 8) % 8; // 0=E,1=SE,2=S,3=SW,4=W,5=NW,6=N,7=NE
      const map: [number, boolean][] = [[2, false], [1, false], [0, false], [1, true], [2, true], [3, true], [4, false], [3, false]];
      [this.facing, this.flip] = map[sector];
      this.walkPhase += dt * speed / 22;
    } else {
      this.walkPhase = 0;
    }
    const stepFrame = speed > 25 ? [1, 0, 2, 0][Math.floor(this.walkPhase) % 4] : 0;
    if (stepFrame !== this.lastStepFrame && stepFrame !== 0 && speed > 80) {
      this.dust.emitParticleAt(this.feet.x, this.feet.y + 4, 2);
    }
    this.lastStepFrame = stepFrame;
    this.playerImg.setTexture(this.heroKey, `${this.facing}_${stepFrame}`).setFlipX(this.flip);
    const bob = speed > 25 ? Math.abs(Math.sin(this.walkPhase * Math.PI / 2)) * 2.4 : 0;
    const breathe = speed > 25 ? 0 : Math.sin(time / 420) * 0.018;
    this.playerImg.setPosition(this.feet.x, this.feet.y + 6 - bob);
    this.playerImg.setScale((1 / S) * (1 - breathe * 0.5), (1 / S) * (1 + breathe));
    this.playerImg.setDepth(this.feet.y + 6);
    this.playerShadow.setPosition(this.feet.x, this.feet.y + 5).setScale((34 / 64) * (1 - bob * 0.03) / frameScale.shadow);

    // Sway everything gently; rustle what the player brushes past.
    const t = time / 1000;
    const breeze = 0.85 + 0.3 * Math.sin(t * 0.23) + 0.1 * Math.sin(t * 0.71);
    const gx = this.life?.gustX ?? null;
    for (const s of this.swayers) {
      if (!s.obj.visible) continue;
      if (gx !== null) {
        const d = Math.abs(s.obj.x - gx);
        if (d < 120) s.gust = Math.min(1, s.gust + dt * 5 * (1 - d / 120));
      }
      s.gust *= Math.exp(-dt * 1.1);
      if (speed > 40) {
        const dx = s.obj.x - this.feet.x;
        const dy = s.obj.y - this.feet.y;
        if (dx * dx + dy * dy < 26 * 26) s.kick = Math.min(1, s.kick + dt * 6) * Math.sign(dx || 1);
      }
      s.kick *= Math.exp(-dt * 2.5);
      let sh = 0;
      if (s.shake > 0.01) { s.shake *= Math.exp(-dt * 3); sh = Math.sin(t * 34 + s.phase) * s.shake * 0.06; }
      s.obj.rotation = s.base + Math.sin(t * s.speed + s.phase + s.obj.x * 0.004) * s.amp * breeze + s.kick * 0.35 + s.gust * Math.min(0.25, s.amp * 3) + sh;
    }

    // Ambient motion.
    for (const c of this.clouds) {
      c.x += dt * 14;
      c.y += dt * 4;
      if (c.x - c.displayWidth / 2 > WORLD_W) { c.x = -c.displayWidth / 2; c.y = 200 + Math.random() * (WORLD_H - 300); }
      c.setVisible(Math.abs(c.x - this.feet.x) < 1600 && Math.abs(c.y - this.feet.y) < 1200);
    }
    for (const m of this.mist) {
      m.x += dt * 6;
      if (m.x > WORLD_W - 40) m.x = 2450;
      m.setVisible(Math.abs(m.x - this.feet.x) < 1100 && Math.abs(m.y - this.feet.y) < 800);
    }
    if (this.windmill) {
      const wm = this.windmill;
      wm.boost = Math.max(0, wm.boost - dt * 0.8);
      wm.blades.rotation += dt * (wm.speed + wm.boost * 1.6) * (this.life?.gustX !== null ? 1.4 : 1);
    }
    this.rays.forEach((r, i) => r.setAlpha(0.08 + 0.05 * Math.sin(t * 0.5 + i * 1.7)));
    this.lilies.forEach((l, i) => { l.y += Math.sin(t * 1.1 + i) * 0.03; });
    this.windowGlows.forEach((g, i) => g.setAlpha(0.3 + 0.06 * Math.sin(t * 3 + i * 2) + 0.03 * Math.sin(t * 11 + i)));
    for (const L of this.lanterns) {
      if (L.lit) L.glow.setScale(0.9 + 0.03 * Math.sin(t * 9 + L.x) + 0.02 * Math.sin(t * 23 + L.y));
    }

    this.life.update(time, dt);
    this.puzzles.update(time, dt);
    this.fishing.update(time, dt);
    this.reacts.update(time, dt);
    this.village.update(dt, time);
    this.dresser.update(time, dt);
    const view = this.cameras.main.worldView;
    this.cull.update(view);
    if ((this.canopyTick = (this.canopyTick + 1) % 4) === 0) this.fadeCanopies();
    this.ground.update(view, 1);
    for (const e of this.ambient) e.setPosition(view.x, view.y);
    this.areaTimer -= dt;
    if (this.areaTimer <= 0) {
      this.areaTimer = 0.5;
      const a = areaAt(this.feet.x, this.feet.y);
      if (a !== this.area) {
        this.area = a;
        sfx.setArea(a);
        const first = visit(a);
        this.game.events.emit('toast', AREA_NAMES[a], 'title');
        if (first) this.game.events.emit('area-new', a);
      }
    }

    if (time > this.nextChirp) { sfx.chirp(); this.nextChirp = time + 5000 + Math.random() * 9000; }

    const it = frozen || this.fishing.active ? null : this.nearestInteractable();
    this.prompt = it ? { x: it.x, y: it.y - it.promptY, label: it.label } : null;
  }

  /** Re-apply saved progress (lantern puzzle) when the world is rebuilt. */
  restoreProgress() {
    if (save.puzzles.lanterns) {
      this.solved = true;
      this.gateOpen = true;
      for (const L of this.lanterns) {
        L.lit = true; L.img.setTexture(ATLAS, 'lantern_on'); L.badge.set('done', false); L.glow.setAlpha(0.42);
      }
      this.litOrder = [...LANTERN_ORDER];
      this.brambles.setAlpha(0).setScale(this.brambles.scaleX, 0);
      this.gateGlows.forEach((g) => g.setAlpha(0.7));
      (this.barrier.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.time.delayedCall(0, () => this.game.events.emit('lanterns', [...this.litOrder]));
    }
    if (hasTreasure('golden_feather')) {
      this.chestOpened = true;
      this.chest.setTexture(ATLAS, 'chest_open');
      this.time.delayedCall(0, () => this.game.events.emit('feather'));
    }
  }

  /** Repaint the hero after changing cosmetics. */
  refreshHero() {
    const old = this.heroKey;
    this.heroKey = buildHeroSheet(this, save.look);
    this.playerImg.setTexture(this.heroKey, `${this.facing}_0`);
    if (old && old !== this.heroKey) this.textures.remove(old);
  }

  /** A little floating "+1" label in the world. */
  floatText(x: number, y: number, msg: string, color = '#fff8ea') {
    const t = this.add.text(x, y, msg, { fontFamily: 'Nunito, sans-serif', fontSize: '15px', color, fontStyle: '800', resolution: Math.max(2, DPR * 1.5) } as any)
      .setOrigin(0.5).setDepth(9600).setShadow(0, 1, 'rgba(40,30,20,0.7)', 3);
    this.tweens.add({ targets: t, y: y - 34, alpha: { from: 1, to: 0 }, duration: 1500, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------ test hooks
  exposeDebug() {
    const self = this;
    (window as any).__cozy = {
      ready: true,
      get state() {
        return {
          x: Math.round(self.feet.x), y: Math.round(self.feet.y),
          litOrder: [...self.litOrder], solved: self.solved, gateOpen: self.gateOpen, chestOpened: self.chestOpened, locked: self.locked,
          prompt: self.prompt?.label ?? null, fps: Math.round(self.game.loop.actualFps),
          pathLen: self.path.length, catPets: self.catPets, ducks: self.life?.ducks.length ?? 0,
          area: self.area, fishing: self.fishing.state, tiles: self.ground.tiles.size, paintMs: [...self.ground.paintMs], puzzles: { ...save.puzzles },
          treasures: [...save.treasures], fish: Object.keys(save.fish), look: { ...save.look }, minor: { ...save.minor },
          reactions: self.life?.reactions ?? 0, snacks: save.snacks, fed: self.fed,
          followers: self.life?.followers() ?? 0,
          dialogOpen: !!self.registry.get('dialogOpen'),
        };
      },
      teleport(x: number, y: number) {
        self.feet.setPosition(x, y);
        self.body.reset(x, y);
        self.cameras.main.centerOn(x, y + 18);
        self.lastSafe = [x, y];
        self.path = [];
        self.ground.update(self.cameras.main.worldView, 99);
      },
      lanterns: LANTERNS,
      enterWild: (seed?: number) => self.enterWild(seed),
      wild() {
        const wl = self.scene.get('wild') as any;
        const on = self.scene.isActive('wild') && wl.ready;
        return on ? { on, seed: wl.seed, w: wl.map.w, h: wl.map.h, props: wl.map.props.length, ponds: wl.map.ponds.length, clearings: wl.map.clearings.length,
          player: [Math.round(wl.feet.x), Math.round(wl.feet.y)], exit: [wl.map.exit.x, wl.map.exit.y], ...(wl.testState?.() ?? {}) } : { on: false, inWild: self.inWild };
      },
      wildTap(x: number, y: number) { const wl = self.scene.get('wild') as any; wl.tapAt(x, y); },
      wildTeleport(x: number, y: number) { const wl = self.scene.get('wild') as any; wl.feet.setPosition(x, y); wl.body.reset(x, y); wl.target = null; },
      wildToScreen(x: number, y: number) { const c = (self.scene.get('wild') as any).cameras.main; return { x: (x - c.worldView.x) * c.zoom / DPR, y: (y - c.worldView.y) * c.zoom / DPR }; },
      wildSave: () => JSON.parse(JSON.stringify(save.wild)),
      tapWorld: (x: number, y: number) => self.tapWorld(x, y),
      critters() {
        const c = self.life.creatures;
        const xy = (o: { x: number; y: number }) => [Math.round(o.x), Math.round(o.y)];
        return {
          rabbits: c.rabbits.filter((r) => !r.temp).map(xy), deer: c.deer.map(xy), crabs: c.crabs.filter((k) => k.hidden <= 0).map(xy),
          squirrels: c.squirrels.filter((q) => q.hidden <= 0).map(xy), hedgehogs: c.hedgehogs.map(xy), owl: [c.owl.x, c.owl.y - 14],
          ducks: self.life.ducks.map((d) => [Math.round(d.img.x), Math.round(d.img.y - 6)]), cat: [Math.round(self.life.cat.x), Math.round(self.life.cat.y - 14)],
          frog: self.life.frog.visible ? [Math.round(self.life.frog.x), Math.round(self.life.frog.y - 8)] : null,
        };
      },
      pots: () => self.puzzles.pots.map((p) => p.color),
      resetStones: () => self.resetStones,
      tiles: () => self.puzzles.tiles.map((t) => t.rot),
      chests: () => ({ pots: self.puzzles.potChest.revealed, bells: self.puzzles.bellChest.revealed, tiles: self.puzzles.tileChest.revealed, dig: self.puzzles.digChest.revealed }),
      /** Fruit trees near a point, nearest first: [x, tapY]. */
      fruitTrees(x: number, y: number) {
        return self.reacts.fruitTrees.map((t) => [Math.round(t.x), Math.round(t.y - t.displayHeight * 0.58), Math.round(t.y)])
          .sort((a, b) => Math.hypot(a[0] - x, a[2] - y) - Math.hypot(b[0] - x, b[2] - y)).slice(0, 5);
      },
      pickups: () => self.reacts.pickups.filter((p) => p.img.active && !p.flying).map((p) => [Math.round(p.img.x), Math.round(p.img.y), p.minor]),
      fish() {
        const f = self.fishing;
        return { state: f.state, catches: f.catches, reel: f.reel ? { hits: f.reel.hits, need: f.reel.need, misses: f.reel.misses } : null };
      },
      /** ms until the reel marker crosses the centre of the green zone (for the touch test). */
      fishMsToZone() {
        const f = self.fishing;
        if (!f.reel) return -1;
        const r = f.reel;
        const now = performance.now();
        for (let ms = 60; ms < 4000; ms += 4) {
          const p = f.markerPos(now + ms);
          if (Math.abs(p - r.zone) < r.width * 0.2) return ms;
        }
        return -1;
      },
      /** Epoch ms of the next marker pass through the zone centre, at least `lead` ms ahead. */
      fishZoneEpoch(lead = 250) {
        const f = self.fishing;
        if (!f.reel) return -1;
        const r = f.reel;
        const now = performance.now();
        for (let ms = lead; ms < 5000; ms += 2) {
          if (Math.abs(f.markerPos(now + ms) - r.zone) < r.width * 0.12) return performance.timeOrigin + now + ms;
        }
        return -1;
      },
      village() {
        const v = self.village;
        const xy = (o: { x: number; y: number }) => [Math.round(o.x), Math.round(o.y)];
        return {
          res: { ...save.village.res }, building: v.building, selected: v.selected, ghost: v.ghost ? { gx: v.ghost.gx, gy: v.ghost.gy, ok: v.ghost.ok, check: xy(v.ghost.check) } : null,
          buildings: v.buildings.map((b) => ({ id: b.data.id, type: b.data.type, x: Math.round(b.cx), y: Math.round(b.y - b.img.displayHeight * 0.45), worker: b.worker?.data.id ?? null })),
          villagers: v.villagers.map((q) => ({ id: q.data.id, name: q.data.name, x: Math.round(q.x), y: Math.round(q.y - 26), job: q.data.job, task: q.task, need: { food: q.data.food, sleep: q.data.sleep, fun: q.data.fun }, suggest: q.suggest ? (q.suggest.kind === 'assign' ? { kind: 'assign', b: q.suggest.b.data.id } : { kind: 'build', t: q.suggest.t }) : null, bubble: q.bubble ? [Math.round(q.bubble.x), Math.round(q.bubble.y)] : null })),
          alert: v.alert ? { id: v.alert.id, text: v.alert.text } : null, gifts: v.gifts,
          guest: v.wanderer ? { name: v.wanderer.data.name, x: Math.round(v.wanderer.x), y: Math.round(v.wanderer.y - 26) } : null,
          produced: v.produced, rain: v.rain > 0, festival: v.festival > 0, merchant: !!v.cart, theme: save.theme,
        };
      },
      villageSpeed: (n: number) => { self.village.speed = n; },
      setRes: (r: { food?: number; wood?: number; stone?: number }) => { Object.assign(save.village.res, r); self.game.events.emit('res', null, 0); },
      setNeeds: (id: number, n: { food?: number; sleep?: number; fun?: number }) => { const q = self.village.villagers.find((x) => x.data.id === id); if (q) Object.assign(q.data, n); },
      setTheme: (id: 'classic' | 'halloween') => setTheme(id),
      villageEvent: (e: 'merchant' | 'rain' | 'festival') => self.village.start(e),
      worldToScreen(x: number, y: number) {
        const cam = self.cameras.main;
        return { x: (x - cam.worldView.x) * cam.zoom / DPR, y: (y - cam.worldView.y) * cam.zoom / DPR };
      },
    };
  }
}
