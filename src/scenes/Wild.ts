// The Wilderness: a fresh, seeded patch of woods every trip. Reached from the trailhead at the
// south-east edge of the map; the big Home button (WildUI) or the exit portal brings you back.
import Phaser from 'phaser';
import { ATLAS, S, atlasOf, frameScale, TREE_SCALE, PICKUP_BUBBLE, PICKUP_ICON } from '../art';
import { save, addTreasure, hasTreasure, addMinor } from '../save';
import { TREASURES, WILD_SET, WILD_MOUNTS } from '../catalog';
import { sfx } from '../audio';
import { theme, themeEvents } from '../theme';
import { generateWild, inPond, WildMap, WILD_W, WILD_H } from '../wild/gen';
import { paintWildArt, ATLAS3 } from '../wild/wart';
import type { WorldScene } from './World';
import { Monster, SWING_RANGE } from '../wild/monsters';
import { NavGrid } from '../pathfind';
import { stickInput, steerBody, stepPath, pulseTapMarker, slideOutOfWater } from '../controls';

const TREE_FRAMES = ['tree0', 'tree1', 'tree2', 'tree3', 'tree4', 'tree5'];
/** Round tree frame for a variant; Spring swaps the autumn-amber tree4 for its fresh-green twin. */
const treeFrame = (v: number) => { const f = TREE_FRAMES[v % TREE_FRAMES.length]; return theme.id === 'spring' && f === 'tree4' ? 'tree4s' : f; };

/** Gentle monsters, bopping and loot in the Wild Woods. */
export const WILD_COMBAT = true;

export class WildScene extends Phaser.Scene {
  map!: WildMap;
  seed = 1;
  feet!: Phaser.GameObjects.Zone;
  body!: Phaser.Physics.Arcade.Body;
  playerImg!: Phaser.GameObjects.Image;
  playerShadow!: Phaser.GameObjects.Image;
  solids!: Phaser.Physics.Arcade.StaticGroup;
  groundTS!: Phaser.GameObjects.TileSprite;
  deco!: Phaser.GameObjects.Graphics;
  trees: { img: Phaser.GameObjects.Image; v: number; pine: boolean }[] = [];
  portal!: Phaser.GameObjects.Container;
  // Movement: the exact same model as the glade (shared src/controls.ts).
  nav!: NavGrid;
  path: [number, number][] = [];
  pathStuck = 0;
  pathLastD = Infinity;
  stick: { x: number; y: number } | null = null;
  tapMarker!: Phaser.GameObjects.Image;
  lastSafe: [number, number] = [0, 0];
  chaseT = 0;
  facing = 0; flip = false; stepT = 0;
  leaving = false;
  ready = false;
  onTheme = () => this.applyTheme();
  monsters: Monster[] = [];
  hearts = 3;
  maxHearts = 3;
  invulnT = 0;
  swingCd = 0;
  chase: Monster | null = null;
  runPoofs = 0;
  /** Finds from this trip; banked at home (always kept, even after a nap). */
  bag: Record<string, number> = { glowmoss: 0, starshard: 0 };
  found: string[] = [];
  pickups: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; bub: Phaser.GameObjects.Image; kind: string; x: number; y: number; taken: boolean }[] = [];
  chests: { img: Phaser.GameObjects.Image; x: number; y: number; opened: boolean }[] = [];
  swings = 0;

  constructor() { super('wild'); }
  init(data: { seed?: number }) { this.seed = data.seed ?? ((Date.now() ^ (save.wild.visits * 2654435761)) >>> 0); }
  get world() { return this.scene.get('world') as WorldScene; }

  img(x: number, y: number, key: string, scale = 1) {
    return this.add.image(x, y, atlasOf(key), key).setOrigin(0.5, 1).setScale(scale / (frameScale[key] ?? S));
  }
  a3(x: number, y: number, key: string, scale = 1) {
    return this.add.image(x, y, ATLAS3, key).setScale(scale / (frameScale[key] ?? S));
  }

  create() {
    paintWildArt(this);
    this.leaving = false; this.trees = []; this.path = []; this.stick = null; this.monsters = []; this.hearts = this.maxHearts; this.invulnT = 0; this.chase = null; this.runPoofs = 0; this.swings = 0; this.bag = { glowmoss: 0, starshard: 0 }; this.found = []; this.pickups = []; this.chests = [];
    this.map = generateWild(this.seed);
    const m = this.map;
    this.physics.world.setBounds(0, 0, WILD_W, WILD_H);
    this.solids = this.physics.add.staticGroup();

    this.groundTS = this.add.tileSprite(0, 0, WILD_W, WILD_H, 'wg_classic').setOrigin(0).setDepth(-1000).setTileScale(1 / 2);
    this.deco = this.add.graphics().setDepth(-900);

    // Props: trees, rocks, bushes, little plants.
    for (const p of m.props) {
      if (p.kind === 'tree' || p.kind === 'pine') {
        const pine = p.kind === 'pine';
        const f = pine ? `pine${p.v % 2}` : treeFrame(p.v);
        const im = this.img(p.x, p.y, f, (pine ? 0.95 : 0.9 + (p.v % 3) * 0.08) * TREE_SCALE).setDepth(p.y).setOrigin(0.5, pine ? 182 / 190 : 202 / 210);
        this.trees.push({ img: im, v: p.v, pine });
        this.add.image(p.x, p.y - 2, ATLAS, 'shadow').setScale(70 * TREE_SCALE / 64 / (frameScale.shadow ?? 1)).setDepth(-500).setAlpha(0.8);
        this.solid(p.x, p.y - 6, 16 * TREE_SCALE);
      } else if (p.kind === 'rock') { this.img(p.x, p.y, `rock${p.v}`).setDepth(p.y); this.solid(p.x, p.y - 8, 18); }
      else if (p.kind === 'bush') { this.img(p.x, p.y, `bush${p.v}`).setDepth(p.y); this.solid(p.x, p.y - 8, 16); }
      else if (p.kind === 'shroom') this.img(p.x, p.y, 'mushrooms').setDepth(p.y);
      else if (p.kind === 'fern') this.img(p.x, p.y, `fern${p.v % 2}`, 0.9).setDepth(p.y);
      else this.img(p.x, p.y, `flower${p.v % 4}`, 0.9).setDepth(p.y);
    }
    // Entrance arch (where you arrive) and the exit portal.
    this.buildPortal(m.start.x - 70, m.start.y + 10, false);
    this.portal = this.buildPortal(m.exit.x, m.exit.y, true);

    if (WILD_COMBAT) m.monsters.forEach((sp, i) => this.monsters.push(new Monster(this, sp.kind, sp, i)));
    for (const c of WILD_COMBAT ? m.chests : []) {
      this.add.image(c.x, c.y, ATLAS, 'shadow').setScale(60 / 64 / (frameScale.shadow ?? 1)).setDepth(-500).setAlpha(0.8);
      const img = this.img(c.x, c.y, 'chest_closed').setDepth(c.y);
      const glow = this.add.image(c.x, c.y - 20, ATLAS, 'glow').setBlendMode('ADD').setTint(0xffe08a).setDepth(c.y - 1).setScale(1.4 / (frameScale.glow ?? 1));
      this.tweens.add({ targets: glow, alpha: { from: 0.4, to: 0.9 }, duration: 900, yoyo: true, repeat: -1 });
      this.chests.push({ img, x: c.x, y: c.y, opened: false });
      this.solid(c.x, c.y - 8, 16);
    }

    // Player.
    this.feet = this.add.zone(m.start.x, m.start.y, 20, 12);
    this.physics.add.existing(this.feet);
    this.body = this.feet.body as Phaser.Physics.Arcade.Body;
    this.body.setCircle(9, 1, -3).setCollideWorldBounds(true);
    this.physics.add.collider(this.feet, this.solids);
    this.lastSafe = [m.start.x, m.start.y];
    this.buildNav();
    this.tapMarker = this.add.image(0, 0, atlasOf('ripple'), 'ripple').setBlendMode('ADD').setAlpha(0).setDepth(-300);
    this.playerShadow = this.add.image(m.start.x, m.start.y, ATLAS, 'shadow').setScale(34 / 64 / (frameScale.shadow ?? 1)).setDepth(-500).setAlpha(0.9);
    this.playerImg = this.add.image(m.start.x, m.start.y, this.world.heroKey, '0_0').setOrigin(0.5, 1).setScale(1 / S);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WILD_W, WILD_H);
    cam.setZoom(this.world.baseZoom());
    cam.startFollow(this.feet, true, 0.1, 0.1, 0, 18);
    cam.fadeIn(500, 255, 250, 235);
    this.scale.on('resize', this.onResize, this);

    // Touch: handled by WildUI's shared TouchStick (tap to walk, drag to steer), same as the glade.

    themeEvents.on('change', this.onTheme);
    this.events.once('shutdown', () => { themeEvents.off('change', this.onTheme); this.scale.off('resize', this.onResize, this); });
    this.applyTheme();
    save.wild.visits++;
    this.scene.launch('wildui');
    this.ready = true;
    sfx.chimes();
  }

  onResize() { this.cameras.main.setZoom(this.world.baseZoom()); }

  solid(x: number, y: number, r: number) {
    const z = this.add.zone(x, y, r * 2, r * 2);
    this.physics.add.existing(z, true);
    (z.body as Phaser.Physics.Arcade.StaticBody).setCircle(r);
    this.solids.add(z);
  }

  buildPortal(x: number, y: number, exit: boolean) {
    const c = this.add.container(x, y).setDepth(y);
    const sw = this.a3(0, -62, 'w_swirl', 0.9).setBlendMode(Phaser.BlendModes.ADD);
    const arch = this.a3(0, 0, 'w_portal', 0.9).setOrigin(0.5, 1);
    c.add([sw, arch]);
    this.tweens.add({ targets: sw, angle: 360, duration: 3200, repeat: -1 });
    this.tweens.add({ targets: sw, alpha: { from: 0.65, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
    if (exit) {
      // Walk in to go home (a bit of slack so a tap on the arch counts too).
      this.time.addEvent({ delay: 150, loop: true, callback: () => {
        if (!this.leaving && Math.hypot(this.feet.x - x, this.feet.y - (y - 10)) < 46) this.goHome('portal');
      } });
    }
    this.solid(x - 40, y - 8, 12); this.solid(x + 40, y - 8, 12);
    return c;
  }

  /** Paints trails, glades and ponds for the current theme. */
  applyTheme() {
    const hal = theme.id === 'halloween';
    this.groundTS.setTexture(hal ? 'wg_halloween' : 'wg_classic');
    const g = this.deco; g.clear();
    const m = this.map;
    for (const c of m.clearings) {
      g.fillStyle(hal ? 0x4f6f64 : 0xa9d36b, 0.55); g.fillEllipse(c.x, c.y, c.r * 2.1, c.r * 1.7);
      g.fillStyle(hal ? 0x5a7a6c : 0xb9de7c, 0.5); g.fillEllipse(c.x, c.y, c.r * 1.6, c.r * 1.25);
    }
    for (const path of m.paths) {
      for (const [w, col] of [[64, hal ? 0x5a4a3e : 0xb08a58], [48, hal ? 0x7a6450 : 0xdcc08a]] as const) {
        g.lineStyle(w, col, 1);
        g.beginPath(); g.moveTo(path[0][0], path[0][1]);
        for (const [x, y] of path.slice(1)) g.lineTo(x, y);
        g.strokePath();
        for (const [x, y] of path) { g.fillStyle(col, 1); g.fillCircle(x, y, w / 2); }
      }
    }
    for (const p of m.ponds) {
      g.fillStyle(hal ? 0x2c3b30 : 0x6c8f45, 1); g.fillEllipse(p.x, p.y + 4, p.rx * 2 + 22, p.ry * 2 + 18);
      g.fillStyle(hal ? 0x3d3a6e : 0x4aa6d8, 1); g.fillEllipse(p.x, p.y, p.rx * 2, p.ry * 2);
      g.fillStyle(hal ? 0x6b62a8 : 0x8fd3f5, 0.6); g.fillEllipse(p.x - p.rx * 0.2, p.y - p.ry * 0.25, p.rx * 1.1, p.ry * 0.7);
    }
    const tf = theme.trees;
    for (const t of this.trees) {
      if (!t.pine && tf) { const f = tf[t.v % tf.length]; t.img.setTexture(atlasOf(f), f).setOrigin(0.5, 192 / 200).setScale(TREE_SCALE / (frameScale[f] ?? S)); }
      else if (!t.pine) { const f = treeFrame(t.v); t.img.setTexture(atlasOf(f), f).setOrigin(0.5, 202 / 210).setScale((0.9 + (t.v % 3) * 0.08) * TREE_SCALE / (frameScale[f] ?? S)); }
      if (theme.foliage !== null && t.pine) t.img.setTint(theme.foliage); else t.img.clearTint();
    }
    this.cameras.main.setBackgroundColor(hal ? '#20262a' : '#3c5a32');
    for (const mo of this.monsters) mo.retheme();
    this.events.emit('theme');
  }

  /** Nav grid over the woods: every solid collider plus the ponds, exactly like the glade. */
  buildNav() {
    const nav = new NavGrid(WILD_W, WILD_H, 20);
    const PAD = 9;
    for (const z of this.solids.getChildren() as Phaser.GameObjects.Zone[]) {
      const b = z.body as Phaser.Physics.Arcade.StaticBody;
      if (!b || !b.enable) continue;
      if (b.isCircle) nav.blockCircle(b.center.x, b.center.y, b.halfWidth, PAD);
      else nav.blockRect(b.x, b.y, b.width, b.height, PAD);
    }
    nav.blockWhere((x, y) => this.waterBlocks(x, y) || x < 10 || y < 10 || x > WILD_W - 10 || y > WILD_H - 10);
    this.nav = nav;
  }

  waterBlocks(x: number, y: number) { return inPond(this.map.ponds, x, y, 8); }

  /** Joystick from WildUI (screen-space, magnitude 0..1), or null when released. */
  setStick(v: { x: number; y: number } | null) {
    if (this.leaving) v = null;
    this.stick = v;
    if (v) { this.path = []; this.chase = null; }
  }

  tapScreen(px: number, py: number) {
    const p = this.cameras.main.getWorldPoint(px, py);
    this.tapAt(p.x, p.y);
  }

  walkTo(gx: number, gy: number, marker = true) {
    const path = this.nav.find(this.feet.x, this.feet.y, gx, gy);
    this.path = path ?? [];
    this.pathStuck = 0;
    this.pathLastD = Infinity;
    const end = this.path[this.path.length - 1];
    if (end && marker) pulseTapMarker(this, this.tapMarker, end[0], end[1]);
  }

  /** The live monster whose sprite is actually under the tap (a little padding for fingers). */
  monsterAt(x: number, y: number): Monster | null {
    let best: Monster | null = null, bd = Infinity;
    for (const mo of this.monsters) {
      if (!mo.alive) continue;
      const b = mo.img.getBounds();
      const pad = 10;
      if (x < b.left - pad || x > b.right + pad || y < b.top - pad || y > b.bottom + pad) continue;
      const d = Math.hypot(b.centerX - x, b.centerY - y);
      if (d < bd) { bd = d; best = mo; }
    }
    return best;
  }

  tapAt(x: number, y: number) {
    if (this.leaving) return;
    this.chase = null;
    // Tapped a monster (its sprite, not just nearby ground)? Walk over and give it a bop.
    const mo = this.monsterAt(x, y);
    if (mo) {
      this.chase = mo; this.chaseT = 0;
      if (Math.hypot(mo.x - this.feet.x, mo.y - this.feet.y) < SWING_RANGE) { this.path = []; this.swing(); }
      else this.walkTo(mo.x, mo.y + 10);
      return;
    }
    const ch = this.chests.find((c) => !c.opened && Math.hypot(c.x - x, c.y - 20 - y) < 50);
    if (ch) { if (Math.hypot(ch.x - this.feet.x, ch.y + 20 - this.feet.y) < 130) { this.path = []; this.openChest(ch); } else this.walkTo(ch.x, ch.y + 30); return; }
    this.walkTo(x, y);
  }

  /** Swing the stick (or wand, in Halloween): bops every monster in a clear circle around you. */
  swing() {
    if (this.leaving || this.swingCd > 0) return;
    this.swingCd = 380;
    this.swings++;
    // Face the nearest monster, if any.
    const near = this.monsters.filter((mo) => mo.alive).sort((a, b) => Math.hypot(a.x - this.feet.x, a.y - this.feet.y) - Math.hypot(b.x - this.feet.x, b.y - this.feet.y))[0];
    let ang = this.flip ? Math.PI : 0;
    if (near && Math.hypot(near.x - this.feet.x, near.y - this.feet.y) < SWING_RANGE * 1.6) { ang = Math.atan2(near.y - this.feet.y, near.x - this.feet.x); this.flip = Math.cos(ang) < 0; }
    const cx = this.feet.x, cy = this.feet.y - 20;
    // Range ring + swoosh so the reach is easy to see.
    const ring = this.add.graphics().setDepth(this.feet.y - 1);
    ring.lineStyle(4, 0xffffff, 0.55).strokeEllipse(cx, this.feet.y, SWING_RANGE * 2, SWING_RANGE * 1.3);
    this.tweens.add({ targets: ring, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    const sw = this.a3(cx + Math.cos(ang) * 30, cy + Math.sin(ang) * 22, 'w_swoosh', 1.1).setRotation(ang + Math.PI / 2).setDepth(9000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: sw, alpha: { from: 1, to: 0 }, scale: sw.scale * 1.25, duration: 260, onComplete: () => sw.destroy() });
    const wand = this.a3(cx, cy, 'w_wand', 0.7).setDepth(this.feet.y + 1).setRotation(ang - 1.3);
    this.tweens.add({ targets: wand, rotation: ang + 1.0, x: cx + Math.cos(ang) * 26, y: cy + Math.sin(ang) * 16, duration: 200, ease: 'Cubic.easeOut', onComplete: () => this.tweens.add({ targets: wand, alpha: 0, duration: 140, onComplete: () => wand.destroy() }) });
    sfx.rustle();
    for (const mo of this.monsters) if (mo.alive && Math.hypot(mo.x - this.feet.x, (mo.y - this.feet.y) * 1.4) < SWING_RANGE + 14) mo.hit(this.feet.x, this.feet.y);
  }

  /** A little treasure pops out where a monster poofed. */
  drop(x: number, y: number, kind: string) {
    const glow = this.add.image(x, y - 10, ATLAS, 'glow').setBlendMode('ADD').setTint(kind === 'heart' ? 0xff9ab0 : kind === 'starshard' ? 0x9fe0ff : 0xb8ffb0).setDepth(y - 1).setScale(0.9 / (frameScale.glow ?? 1));
    const img = this.add.image(x, y, atlasOf(kind === 'heart' ? 'heart' : `l_${kind}`), kind === 'heart' ? 'heart' : `l_${kind}`).setOrigin(0.5, 1).setDepth(y);
    img.setScale(PICKUP_ICON / Math.max(img.width, img.height)).setY(y - 8);
    const sz = PICKUP_BUBBLE * 64 / 52;
    const bub = this.add.image(x, y, atlasOf('pk_bubble'), 'pk_bubble').setOrigin(0.5, 1).setDepth(y - 0.5).setDisplaySize(sz, sz);
    img.once('destroy', () => bub.destroy());
    this.tweens.add({ targets: img, y: { from: y - 38, to: y - 8 }, duration: 420, ease: 'Bounce.easeOut' });
    this.tweens.add({ targets: bub, y: { from: y - 30, to: y }, duration: 420, ease: 'Bounce.easeOut' });
    this.tweens.add({ targets: [img, bub], scaleX: '*=1.1', scaleY: '*=1.1', duration: 600, yoyo: true, repeat: -1, delay: 420 });
    this.pickups.push({ img, glow, bub, kind, x, y, taken: false });
  }

  pickUp(p: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; bub: Phaser.GameObjects.Image; kind: string; taken: boolean; x: number; y: number }) {
    p.taken = true;
    this.tweens.killTweensOf(p.img); this.tweens.killTweensOf(p.bub); p.bub.setVisible(false);
    this.tweens.add({ targets: [p.img, p.glow], y: this.feet.y - 70, alpha: 0, duration: 380, ease: 'Cubic.easeIn', onComplete: () => { p.img.destroy(); p.glow.destroy(); } });
    sfx.pickup();
    if (p.kind === 'heart') {
      this.hearts = Math.min(this.maxHearts, this.hearts + 1);
      this.events.emit('hearts', this.hearts);
      this.events.emit('toast', 'A heart! Feeling better!');
    } else {
      this.bag[p.kind] = (this.bag[p.kind] ?? 0) + 1;
      this.events.emit('bag', this.bag);
      if (this.bag[p.kind] === 1) this.events.emit('toast', p.kind === 'glowmoss' ? 'Glow moss! Only in the Wild!' : 'A star shard! So rare!');
    }
  }

  openChest(c: { img: Phaser.GameObjects.Image; x: number; y: number; opened: boolean }) {
    if (c.opened) return;
    c.opened = true;
    c.img.setTexture(atlasOf('chest_open'), 'chest_open');
    sfx.sparkle();
    this.tweens.add({ targets: c.img, scaleY: c.img.scaleY * 1.12, duration: 120, yoyo: true });
    const next = WILD_SET.find((id) => !hasTreasure(id) && !this.found.includes(id))
      ?? WILD_MOUNTS.find((id) => !hasTreasure(id) && !this.found.includes(id));
    const burst = this.add.particles(c.x, c.y - 30, ATLAS3, { frame: 'w_star', speed: { min: 60, max: 180 }, lifespan: 900, scale: { start: 0.2, end: 0 }, gravityY: 80, emitting: false } as any).setDepth(9001);
    burst.explode(20); this.time.delayedCall(1200, () => burst.destroy());
    if (next) {
      this.found.push(next);
      addTreasure(next);
      const t = TREASURES.find((x) => x.id === next)!;
      const ic = this.add.image(c.x, c.y - 40, atlasOf(t.icon), t.icon).setDepth(9002).setScale(1 / (frameScale[t.icon] ?? 2));
      this.tweens.add({ targets: ic, y: c.y - 110, scale: ic.scale * 1.6, duration: 700, ease: 'Back.easeOut', onComplete: () => this.tweens.add({ targets: ic, alpha: 0, delay: 1400, duration: 400, onComplete: () => ic.destroy() }) });
      const mountLoot = WILD_MOUNTS.includes(next);
      this.events.emit('toast', mountLoot ? `${t.name}! Tap Call Mount to ride!` : `${t.name}! Try it on at home!`);
      this.events.emit('treasure', next);
    } else {
      this.bag.starshard += 3;
      this.events.emit('bag', this.bag);
      this.events.emit('toast', 'Three star shards! Wow!');
    }
  }

  /** Bring this trip's finds home: they go in your satchel and help the village. */
  bank() {
    const moss = this.bag.glowmoss, shards = this.bag.starshard;
    if (moss) addMinor('glowmoss', moss);
    if (shards) addMinor('starshard', shards);
    for (const k of Object.keys(this.bag)) save.wild.loot[k] = (save.wild.loot[k] ?? 0) + this.bag[k];
    const out = { glowmoss: moss, starshard: shards, found: [...this.found] };
    this.bag = { glowmoss: 0, starshard: 0 };
    return out;
  }

  onPoof(mo: Monster) {
    this.runPoofs++;
    // Kind loot: something nice from nearly every poof.
    const r = Math.random();
    if (this.hearts < this.maxHearts && r < 0.3) this.drop(mo.x, mo.y, 'heart');
    else if (mo.kind === 'slime') this.drop(mo.x, mo.y, r < 0.85 ? 'glowmoss' : 'starshard');
    else this.drop(mo.x, mo.y, r < 0.6 ? 'starshard' : 'glowmoss');
    save.wild.poofs++;
    if (this.chase === mo) this.chase = null;
    this.events.emit('poof', mo);
    if (this.monsters.every((x) => !x.alive)) this.events.emit('toast', 'All poofed! Super job!');
  }

  hurt(from: Monster) {
    if (this.invulnT > 0 || this.leaving) return;
    this.hearts = Math.max(0, this.hearts - 1);
    this.invulnT = 2400; // a gentle, long safe moment after a bump
    sfx.softFail();
    this.cameras.main.shake(160, 0.004);
    const d = Math.hypot(this.feet.x - from.x, this.feet.y - from.y) || 1;
    this.body.reset(this.feet.x + (this.feet.x - from.x) / d * 26, this.feet.y + (this.feet.y - from.y) / d * 26);
    this.events.emit('hearts', this.hearts);
    if (this.hearts <= 0) {
      this.events.emit('toast', 'So sleepy... time for a nap!');
      this.leaving = false;
      this.time.delayedCall(900, () => this.goHome('faint'));
    } else this.events.emit('toast', this.hearts === 1 ? 'Careful! One heart left.' : 'Ouch! Bop them first!');
  }

  testState() {
    return {
      path: this.path.length, chasing: !!this.chase, speed: Math.round(Math.hypot(this.body.velocity.x, this.body.velocity.y)), stick: !!this.stick,
      hearts: this.hearts, bag: { ...this.bag }, found: [...this.found], pickups: this.pickups.filter((p) => !p.taken).map((p) => ({ kind: p.kind, x: Math.round(p.x), y: Math.round(p.y) })), chests: this.chests.map((c) => ({ x: c.x, y: c.y, opened: c.opened })), monsters: this.monsters.filter((m) => m.alive).length, total: this.monsters.length, poofs: this.runPoofs, swings: this.swings,
      mons: this.monsters.filter((m) => m.alive).map((m) => ({ id: m.id, x: Math.round(m.x), y: Math.round(m.y), kind: m.kind, hp: m.hp })),
    };
  }

  goHome(why: 'button' | 'portal' | 'faint') {
    if (this.leaving) return;
    this.leaving = true;
    this.path = []; this.stick = null; this.chase = null; this.body.setVelocity(0, 0);
    sfx.chimes();
    this.events.emit('leaving', why);
    this.cameras.main.fadeOut(600, 255, 250, 235);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.ready = false;
      this.scene.stop('wildui');
      this.world.returnFromWild(why, this.bank());
      this.scene.stop();
    });
  }

  update(_t: number, dt: number) {
    if (!this.ready) return;
    this.swingCd = Math.max(0, this.swingCd - dt);
    if (this.invulnT > 0) { this.invulnT -= dt; this.playerImg.setAlpha(this.invulnT > 0 && Math.floor(this.invulnT / 120) % 2 ? 0.45 : 1); }
    if (this.chase) {
      // Only ever set by tapping a monster; walking/steering cancels it.
      if (!this.chase.alive) this.chase = null;
      else if (Math.hypot(this.chase.x - this.feet.x, this.chase.y - this.feet.y) < SWING_RANGE - 10) { this.path = []; this.swing(); }
      else if ((this.chaseT -= dt) <= 0 || !this.path.length) { this.chaseT = 250; this.walkTo(this.chase.x, this.chase.y + 10, false); }
    }
    for (const mo of this.monsters) {
      mo.update(dt, this.feet.x, this.feet.y);
      if (mo.alive && mo.hurtT <= 0 && Math.hypot(mo.x - this.feet.x, mo.y - this.feet.y) < 28) this.hurt(mo);
    }
    for (const p of this.pickups) {
      if (p.taken) continue;
      const d = Math.hypot(p.x - this.feet.x, p.y - this.feet.y);
      if (d < 34) this.pickUp(p);
      else if (d < 90 && p.kind !== 'heart') { p.x += (this.feet.x - p.x) * 0.08; p.y += (this.feet.y - p.y) * 0.08; p.img.setPosition(p.x, p.y - 8); p.bub.setPosition(p.x, p.y); p.glow.setPosition(p.x, p.y - 10); }
    }
    for (const c of this.chests) if (!c.opened && Math.hypot(c.x - this.feet.x, c.y + 20 - this.feet.y) < 60) this.openChest(c);
    // Same steering as the glade: joystick, else path following; same speed + acceleration blend.
    const sec = Math.min(dt, 50) / 1000;
    let ix = 0, iy = 0, len = 0;
    if (!this.leaving && this.stick) [ix, iy, len] = stickInput(this.stick);
    else if (!this.leaving && this.path.length) {
      [ix, iy] = stepPath(this, this.feet.x, this.feet.y, sec).dir;
      len = Math.hypot(ix, iy);
    }
    steerBody(this.body, ix, iy, len, sec);
    // Ponds: slide along the shore instead of stopping dead.
    slideOutOfWater(this.feet, this.lastSafe, (x, y) => this.waterBlocks(x, y));
    const moving = Math.hypot(this.body.velocity.x, this.body.velocity.y) > 25;
    if (moving) {
      const a = Math.atan2(this.body.velocity.y, this.body.velocity.x);
      const sector = (Math.round(a / (Math.PI / 4)) + 8) % 8;
      const map: [number, boolean][] = [[2, false], [1, false], [0, false], [1, true], [2, true], [3, true], [4, false], [3, false]];
      [this.facing, this.flip] = map[sector];
      this.stepT += dt;
    } else this.stepT = 0;
    const step = moving ? 1 + (Math.floor(this.stepT / 160) % 2) : 0;
    this.playerImg.setTexture(this.world.heroKey, `${this.facing}_${step}`).setFlipX(this.flip);
    this.playerImg.setPosition(this.feet.x, this.feet.y + 6).setDepth(this.feet.y);
    this.playerShadow.setPosition(this.feet.x, this.feet.y + 4);
  }
}
