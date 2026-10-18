// The treasure puzzles beyond the lanterns: garden flower pots, windmill bells, moon tiles and
// the lake-shore riddle. Each has a clue sign and reveals a chest with a treasure.
import Phaser from 'phaser';
import { ATLAS, frameScale, S } from './art';
import { POTS, POT_SIGN, POT_CHEST, BELLS, BELL_SIGN, BELL_CHEST, SONGBIRD, TILES, TILE_SIGN, TILE_CHEST, DIG, DIG_SIGN, PSTONES, PSTONE_SIGN, PSTONE_CHEST, TRACKS, TRACK_SIGN } from './layout';
import { sfx } from './audio';
import { save, setPuzzle, addTreasure, hasTreasure, persist } from './save';
import { TREASURES } from './catalog';
import { NumBadge, plate, SeqCard, POT_COLORS, POT_NAMES, RIBBONS, RIBBON_NAMES } from './seq';
import type { WorldScene } from './scenes/World';

const POT_TARGET = [0, 1, 2, 3];
const SONG = [2, 0, 3, 1];

/** A big friendly reset stone next to a puzzle. Tap it to play the puzzle again. */
export function resetStone(w: WorldScene, x: number, y: number, id: string, reset: () => void) {
  w.shadow(x + 2, y - 2, 46, 0.6);
  const rock = w.img(x, y, 'rock1').setDepth(y);
  rock.setScale(rock.scale * 0.8);
  const pl = plate(w, x, y - 34, 'q_reset', 20);
  pl.c.setDepth(8400 + y * 0.001);
  w.tweens.add({ targets: pl.c, y: y - 38, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  w.solidCircle(x, y - 6, 12);
  w.resetStones[id] = { x, y };
  const go = () => {
    const fresh = !save.puzzles[id] && !w.puzzleDirty(id);
    delete save.puzzles[id];
    persist();
    reset();
    sfx.chimes();
    w.tweens.add({ targets: pl.c, angle: { from: 0, to: -360 }, duration: 600, ease: 'Cubic.easeOut' });
    w.burst(x, y - 34, 0x9fd8ff, 22, 'spark');
    w.game.events.emit('toast', fresh ? 'All set. Have fun!' : 'Fresh start! Play again.');
    w.game.events.emit('puzzle-reset', id);
    (window as any).__cozyResets = ((window as any).__cozyResets ?? 0) + 1;
  };
  w.interactables.push({ x, y, r: 50, label: 'Reset', promptY: 82, reach: 240, approach: [0, 30], enabled: () => true, action: go });
}

class Chest {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  revealed = false;
  opened = false;
  constructor(private w: WorldScene, public x: number, public y: number, public treasure: string, private onOpened?: () => void) {
    this.shadow = w.fx(x, y - 2, 'shadow', 70 / 64).setAlpha(0).setDepth(-500);
    this.img = w.add.image(x, y, ATLAS, 'chest_closed').setOrigin(0.5, 1).setScale(1 / (frameScale.chest_closed ?? S)).setDepth(y).setAlpha(0);
    w.interactables.push({
      x, y, r: 62, label: 'Open', promptY: 50, enabled: () => this.revealed && !this.opened,
      action: () => this.open(),
    });
  }
  /** Show instantly (restoring a save). */
  set(revealed: boolean, opened: boolean) {
    this.revealed = revealed; this.opened = opened;
    if (revealed) { this.img.setAlpha(1); this.shadow.setAlpha(0.7); }
    if (opened) this.img.setTexture(ATLAS, 'chest_open');
  }
  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    const w = this.w;
    const glow = w.fx(this.x, this.y - 20, 'glow', 0.25).setBlendMode('ADD').setTint(0xffe08a).setAlpha(0).setDepth(this.y + 2);
    w.tweens.add({ targets: glow, alpha: 0.8, scale: glow.scale * 3, duration: 700, yoyo: true, onComplete: () => glow.destroy() });
    this.img.setAlpha(1).setScale(this.img.scaleX, 0);
    w.tweens.add({ targets: this.img, scaleY: 1 / (frameScale.chest_closed ?? S), duration: 700, ease: 'Back.easeOut' });
    w.tweens.add({ targets: this.shadow, alpha: 0.7, duration: 500 });
    w.burst(this.x, this.y - 20, 0xffe08a, 28, 'spark');
    w.burst(this.x, this.y - 10, 0x9be07a, 14, 'leaf');
    w.cameras.main.shake(200, 0.002);
    sfx.solve();
  }
  /** Hide the chest again for a replay (the treasure stays in your bag). */
  reset() {
    this.revealed = false; this.opened = false;
    this.w.tweens.killTweensOf([this.img, this.shadow]);
    this.img.setTexture(ATLAS, 'chest_closed').setAlpha(0).setScale(1 / (frameScale.chest_closed ?? S));
    this.shadow.setAlpha(0);
  }
  open() {
    if (this.opened) return;
    this.opened = true;
    const w = this.w;
    this.img.setTexture(ATLAS, 'chest_open');
    if (!this.treasure || hasTreasure(this.treasure)) { w.puzzleBonus(this.x, this.y - 40); this.onOpened?.(); return; }
    addTreasure(this.treasure);
    sfx.sparkle();
    w.cameras.main.shake(200, 0.002);
    w.burst(this.x, this.y - 30, 0xffe08a, 40, 'spark');
    const t = TREASURES.find((q) => q.id === this.treasure)!;
    const glow = w.fx(this.x, this.y - 30, 'glow', 0.3).setBlendMode('ADD').setTint(0xffd27a).setDepth(this.y + 30).setAlpha(0);
    const icon = w.add.image(this.x, this.y - 20, ATLAS, t.icon).setScale((t.icon === 'feather' ? 1.1 : 0.9) / (frameScale[t.icon] ?? S)).setDepth(this.y + 31);
    w.tweens.add({ targets: glow, alpha: 0.85, scale: glow.scale * 2.2, duration: 900, ease: 'Sine.easeOut' });
    w.tweens.add({
      targets: [icon, glow], y: this.y - 90, duration: 1300, ease: 'Sine.easeOut',
      onComplete: () => {
        w.tweens.add({ targets: [icon, glow], alpha: 0, delay: 2600, duration: 800, onComplete: () => { icon.destroy(); glow.destroy(); } });
        w.game.events.emit('treasure', this.treasure);
        w.game.events.emit('dialog', [`You found the ${t.name}!`, t.blurb, 'Tap your bag to try it on!']);
        this.onOpened?.();
      },
    });
  }
}

export class Puzzles {
  /** Has the player changed anything since the last reset? */
  dirty(id: string) {
    if (id === 'pots') return this.pots.some((p, i) => p.color !== [4, 2, 0, 1][i]);
    if (id === 'bells') return this.bellInput.length > 0;
    if (id === 'tiles') return this.tiles.some((t, q) => t.rot !== [1, 2, 3, 1][q]);
    if (id === 'stones') return this.stoneNext > 1;
    if (id === 'trail') return this.trailStep > 0;
    return false;
  }
  pots: { img: Phaser.GameObjects.Image; flower: Phaser.GameObjects.Image; color: number; pl: ReturnType<typeof plate>; badge: NumBadge }[] = [];
  potChest: Chest;
  bells: { bell: Phaser.GameObjects.Image; ribbon: Phaser.GameObjects.Image; badge: NumBadge }[] = [];
  bellInput: number[] = [];
  bellChest: Chest;
  bird!: Phaser.GameObjects.Image;
  birdSang = false;
  singing = false;
  tiles: { img: Phaser.GameObjects.Image; rot: number }[] = [];
  tileChest: Chest;
  tileGlow!: Phaser.GameObjects.Image;
  digChest: Chest;
  digImg!: Phaser.GameObjects.Image;
  /** Order 18 pressure stones: step on 1, 2, 3, 4. */
  stones: { x: number; y: number; n: number; g: Phaser.GameObjects.Graphics; badge: NumBadge; down: boolean }[] = [];
  stoneNext = 1;
  stoneOn = -1;
  stoneChest: Chest;
  /** Order 18 footprint trail: deer tracks light up one by one as you follow them. */
  tracks: Phaser.GameObjects.Graphics[] = [];
  trailStep = 0;
  trailChest: Chest;
  trailGlow!: Phaser.GameObjects.Image;

  constructor(private w: WorldScene) {
    this.potChest = new Chest(w, POT_CHEST.x, POT_CHEST.y, 'flower_crown');
    this.bellChest = new Chest(w, BELL_CHEST.x, BELL_CHEST.y, 'rusty_key', () => w.game.events.emit('toast', 'A key! It opens the north gate.'));
    this.tileChest = new Chest(w, TILE_CHEST.x, TILE_CHEST.y, 'fox_hood');
    this.digChest = new Chest(w, DIG.x, DIG.y + 6, 'shell_necklace');
    this.stoneChest = new Chest(w, PSTONE_CHEST.x, PSTONE_CHEST.y, '');
    const end = TRACKS[TRACKS.length - 1];
    this.trailChest = new Chest(w, end[0], end[1] + 8, '');
    this.buildPots();
    this.buildTrail();
    this.buildStones();
    this.buildBells();
    this.buildTiles();
    this.buildDig();
    resetStone(w, POT_CHEST.x + 175, POT_CHEST.y + 10, 'pots', () => this.resetPots());
    resetStone(w, BELL_SIGN.x - 10, BELL_SIGN.y + 80, 'bells', () => this.resetBells());
    resetStone(w, TILE_SIGN.x, TILE_SIGN.y + 70, 'tiles', () => this.resetTiles());
    resetStone(w, DIG_SIGN.x + 70, DIG_SIGN.y + 20, 'dig', () => this.resetDig());
    resetStone(w, PSTONE_SIGN.x, PSTONE_SIGN.y + 70, 'stones', () => this.resetStones());
    resetStone(w, TRACK_SIGN.x + 60, TRACK_SIGN.y + 40, 'trail', () => this.resetTrail());
  }
  resetTrail() {
    this.trailStep = 0;
    this.drawTracks();
    this.trailChest.reset();
  }
  resetStones() {
    this.stoneNext = 1;
    for (const st of this.stones) this.setStone(st, false);
    this.stoneChest.reset();
  }

  // ------------------------------------------------------------ replay: reset stones
  resetPots() {
    const start = [4, 2, 0, 1];
    this.pots.forEach((p, i) => { p.color = start[i]; p.flower.setTint(POT_COLORS[p.color]); p.pl.setFrame(`q_flower${p.color}`); p.badge.set(p.color === POT_TARGET[i] ? 'done' : 'todo'); this.w.burst(p.img.x, p.img.y - 30, 0xbfe3ff, 6, 'spark'); });
    this.potChest.reset();
  }
  resetBells() {
    this.bellInput = []; this.birdSang = false;
    for (const b of this.bells) b.badge.set('todo');
    this.bellChest.reset();
  }
  resetTiles() {
    const start = [1, 2, 3, 1];
    this.tiles.forEach((t, q) => { t.rot = start[q]; this.w.tweens.killTweensOf(t.img); t.img.setAngle(t.rot * 90); });
    this.tileGlow.setAlpha(0);
    this.tileChest.reset();
  }
  resetDig() {
    this.digImg.setTexture(ATLAS, 'digspot');
    this.digChest.reset();
  }

  private sign(x: number, y: number, lines: string[], cards?: () => SeqCard[]) {
    const w = this.w;
    w.shadow(x + 3, y - 2, 44, 0.7);
    w.img(x, y, 'sign').setDepth(y);
    w.solidCircle(x, y - 5, 8);
    w.interactables.push({ x, y, r: 56, label: 'Read', promptY: 70, enabled: () => true, action: () => w.game.events.emit('dialog', lines, cards?.()) });
  }

  // ------------------------------------------------------------ garden flower pots
  buildPots() {
    const w = this.w;
    const solved = !!save.puzzles.pots;
    const start = [4, 2, 0, 1];
    POTS.forEach((p, i) => {
      w.shadow(p.x + 2, p.y - 1, 30, 0.6);
      const img = w.img(p.x, p.y, 'pot').setDepth(p.y);
      const color = solved ? POT_TARGET[i] : start[i];
      const flower = w.img(p.x, p.y - 16, 'potflower').setDepth(p.y + 0.5).setTint(POT_COLORS[color]);
      w.sway(flower, 0.06, 1.5);
      // Big flower plate showing the pot's colour now, and the pot's number (1-4, left to right).
      const pl = plate(w, p.x, p.y - 64, `q_flower${color}`, 17);
      pl.c.setDepth(8400 + p.y * 0.001);
      const badge = new NumBadge(w, p.x, p.y - 98, i + 1, 13).setDepth(8401 + p.y * 0.001);
      if (color === POT_TARGET[i]) badge.set('done', false);
      const pot = { img, flower, color, pl, badge };
      this.pots.push(pot);
      w.solidCircle(p.x, p.y - 4, 9);
      w.interactables.push({
        x: p.x, y: p.y, r: 30, label: 'Change', promptY: 132, reach: 190, approach: [0, 28],
        enabled: () => !save.puzzles.pots,
        action: () => this.cyclePot(i),
      });
    });
    this.sign(POT_SIGN.x, POT_SIGN.y, [
      'Tap a pot to change its flower.',
      'Match the numbers: 1 pink, 2 blue,',
      '3 yellow, 4 white.',
    ], () => POT_TARGET.map((c, i): SeqCard => ({ n: i + 1, icon: `q_flower${c}`, label: POT_NAMES[c], done: this.pots[i]?.color === c })));
    this.potChest.set(solved, hasTreasure('flower_crown'));
  }
  cyclePot(i: number) {
    const p = this.pots[i];
    p.color = (p.color + 1) % POT_COLORS.length;
    p.flower.setTint(POT_COLORS[p.color]);
    p.pl.setFrame(`q_flower${p.color}`);
    p.badge.set(p.color === POT_TARGET[i] ? 'done' : 'todo');
    const sx = p.flower.scaleX, sy = p.flower.scaleY;
    this.w.tweens.add({ targets: p.flower, scaleX: sx * 1.3, scaleY: sy * 1.3, duration: 140, yoyo: true, ease: 'Back.easeOut', onComplete: () => p.flower.setScale(sx, sy) });
    this.w.burst(p.img.x, p.img.y - 26, POT_COLORS[p.color], 8, 'petal');
    sfx.bellNote(p.color % 4, true);
    if (this.pots.every((q, k) => q.color === POT_TARGET[k])) {
      setPuzzle('pots');
      this.w.time.delayedCall(450, () => {
        this.pots.forEach((q, k) => this.w.time.delayedCall(k * 120, () => this.w.burst(q.img.x, q.img.y - 30, POT_COLORS[q.color], 12, 'spark')));
        this.potChest.reveal();
        this.w.game.events.emit('toast', 'The garden blooms! Look!');
      });
    }
  }

  // ------------------------------------------------------------ windmill bells
  buildBells() {
    const w = this.w;
    const solved = !!save.puzzles.bells;
    BELLS.forEach((b, i) => {
      w.shadow(b.x + 3, b.y - 2, 40, 0.6);
      w.img(b.x, b.y, 'bellpost').setDepth(b.y);
      w.solidCircle(b.x, b.y - 4, 7);
      const ribbon = w.add.image(b.x - 9, b.y - 84, ATLAS, 'ribbon').setOrigin(0.5, 0).setScale(1 / S).setTint(RIBBONS[i]).setDepth(b.y + 0.4);
      const bell = w.add.image(b.x + 2, b.y - 88, ATLAS, 'bell').setOrigin(0.5, 0.08).setScale(1 / S).setDepth(b.y + 0.5);
      // The bell's place in the songbird's tune, as a big number with the bell's colour.
      const step = SONG.indexOf(i);
      const badge = new NumBadge(w, b.x + 2, b.y - 128, step + 1, 15).setDepth(8401 + b.y * 0.001);
      if (solved) badge.set('done', false);
      this.bells.push({ bell, ribbon, badge });
      w.interactables.push({
        x: b.x, y: b.y, r: 40, label: 'Ring', promptY: 168, reach: 230, approach: [0, 30],
        enabled: () => !save.puzzles.bells && !this.singing,
        action: () => this.ring(i),
      });
    });
    // The songbird, perched on a fence post.
    w.img(SONGBIRD.x, SONGBIRD.y, 'fence').setDepth(SONGBIRD.y);
    this.bird = w.add.image(SONGBIRD.x - 14, SONGBIRD.y - 30, ATLAS, 'sparrow').setOrigin(0.5, 1).setScale(1.6 / (frameScale.sparrow ?? S)).setDepth(SONGBIRD.y + 1);
    w.interactables.push({
      x: SONGBIRD.x - 14, y: SONGBIRD.y, r: 50, label: 'Listen', promptY: 60, reach: 300, approach: [0, 30],
      enabled: () => !save.puzzles.bells && !this.singing,
      action: () => this.sing(),
    });
    this.sign(BELL_SIGN.x, BELL_SIGN.y, [
      'Tap the songbird. She sings a song.',
      'Ring the bells: 1, 2, 3, 4.',
      'Look for the numbers!',
    ], () => SONG.map((n, k): SeqCard => ({ n: k + 1, icon: `q_bell${n}`, label: RIBBON_NAMES[n], done: !!save.puzzles.bells || this.bellInput.length > k })));
    this.bellChest.set(solved, hasTreasure('rusty_key'));
  }
  sing() {
    if (this.singing) return;
    this.singing = true;
    this.birdSang = true;
    this.bellInput = [];
    const w = this.w;
    SONG.forEach((n, k) => {
      w.time.delayedCall(300 + k * 700, () => {
        sfx.bellNote(n, true);
        this.bells[n]?.badge.pulse();
        w.tweens.add({ targets: this.bird, y: this.bird.y - 5, duration: 110, yoyo: true });
        this.note(this.bird.x, this.bird.y - 22, RIBBONS[n]);
      });
    });
    w.time.delayedCall(300 + SONG.length * 700, () => { this.singing = false; });
  }
  private note(x: number, y: number, tint: number) {
    const g = this.w.fx(x, y, 'glow', 0.07).setBlendMode('ADD').setTint(tint).setDepth(9500);
    const d = this.w.add.image(x, y, ATLAS, 'heart').setScale(0.9 / (frameScale.heart ?? S)).setTint(tint).setDepth(9501);
    this.w.tweens.add({ targets: [g, d], y: y - 40, x: x + (Math.random() * 20 - 10), alpha: 0, duration: 1400, ease: 'Sine.easeOut', onComplete: () => { g.destroy(); d.destroy(); } });
  }
  ring(i: number) {
    const b = this.bells[i];
    sfx.bellNote(i);
    this.w.tweens.add({ targets: b.bell, angle: { from: -24, to: 24 }, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.easeInOut', onComplete: () => b.bell.setAngle(0) });
    this.note(b.bell.x, b.bell.y - 6, RIBBONS[i]);
    if (save.puzzles.bells) return;
    this.bellInput.push(i);
    const k = this.bellInput.length - 1;
    if (this.bellInput[k] !== SONG[k]) {
      this.bellInput = [];
      b.badge.set('wrong');
      this.w.time.delayedCall(600, () => { for (const q of this.bells) q.badge.set('todo'); });
      this.w.time.delayedCall(350, () => {
        sfx.softFail();
        this.w.game.events.emit('toast', this.birdSang ? 'Not quite. Try again!' : 'Tap the songbird first!');
      });
      return;
    }
    b.badge.set('done');
    if (this.bellInput.length === SONG.length) {
      setPuzzle('bells');
      this.w.time.delayedCall(500, () => {
        this.bells.forEach((q, j) => this.w.time.delayedCall(j * 140, () => { sfx.bellNote(j); this.w.tweens.add({ targets: q.bell, angle: { from: -20, to: 20 }, duration: 150, yoyo: true, repeat: 2, onComplete: () => q.bell.setAngle(0) }); }));
        this.w.time.delayedCall(800, () => { this.bellChest.reveal(); this.w.game.events.emit('toast', 'Yay! A chest pops up!'); });
      });
    }
  }

  // ------------------------------------------------------------ moon tiles (2x2 picture)
  buildTiles() {
    const w = this.w;
    const solved = !!save.puzzles.tiles;
    const start = [1, 2, 3, 1];
    const s = TILES.size;
    this.tileGlow = w.fx(TILES.x, TILES.y, 'glow', 0.9).setBlendMode('ADD').setTint(0xbfd8ff).setAlpha(solved ? 0.35 : 0).setDepth(-355);
    for (let q = 0; q < 4; q++) {
      const cx = TILES.x + (q % 2 ? s / 2 + 3 : -s / 2 - 3), cy = TILES.y + (q > 1 ? s / 2 + 3 : -s / 2 - 3);
      w.add.image(cx, cy + 2, ATLAS, 'slab').setDisplaySize(s + 6, s + 6).setDepth(-362);
      const rot = solved ? 0 : start[q];
      const img = w.add.image(cx, cy, ATLAS, `tileq${q}`).setDisplaySize(s - 4, s - 4).setAngle(rot * 90).setDepth(-360);
      this.tiles.push({ img, rot });
      w.interactables.push({
        x: cx, y: cy + 10, r: 34, label: 'Turn', promptY: 50, reach: 260, approach: [0, s / 2 + 20],
        enabled: () => !save.puzzles.tiles,
        action: () => this.turn(q),
      });
    }
    this.sign(TILE_SIGN.x, TILE_SIGN.y, [
      'Tap a stone to turn it.',
      'Moon on top. Stars on the right.',
      'Leaf on the bottom.',
    ]);
    const ref = w.add.image(TILE_SIGN.x, TILE_SIGN.y - 62, ATLAS, 'emblem').setScale(0.26).setDepth(TILE_SIGN.y + 1).setAlpha(0.95);
    void ref;
    this.tileChest.set(solved, hasTreasure('fox_hood'));
  }
  turn(q: number) {
    const t = this.tiles[q];
    t.rot = (t.rot + 1) % 4;
    sfx.tock();
    this.w.tweens.add({ targets: t.img, angle: t.img.angle + 90, duration: 260, ease: 'Back.easeOut', onComplete: () => t.img.setAngle(t.rot * 90) });
    this.w.burst(t.img.x, t.img.y, 0xcfe0ff, 6, 'dot');
    if (this.tiles.every((x) => x.rot === 0)) {
      setPuzzle('tiles');
      this.w.time.delayedCall(450, () => {
        this.w.tweens.add({ targets: this.tileGlow, alpha: 0.5, duration: 800, yoyo: true, hold: 400, onComplete: () => this.tileGlow.setAlpha(0.35) });
        this.w.burst(TILES.x, TILES.y, 0xfff0a8, 36, 'spark');
        sfx.hoot();
        this.w.time.delayedCall(600, () => { this.tileChest.reveal(); this.w.game.events.emit('toast', 'It glows! A chest appears!'); });
      });
    }
  }

  // ------------------------------------------------------------ the lake-shore riddle
  buildDig() {
    const w = this.w;
    const dug = !!save.puzzles.dig;
    this.digImg = w.add.image(DIG.x, DIG.y, ATLAS, dug ? 'hole' : 'digspot').setScale(1 / (frameScale.digspot ?? 2)).setDepth(-360);
    w.interactables.push({
      x: DIG.x, y: DIG.y, r: 44, label: 'Dig', promptY: 40, approach: [0, 26],
      enabled: () => !save.puzzles.dig,
      action: () => this.dig(),
    });
    this.sign(DIG_SIGN.x, DIG_SIGN.y, [
      'Find the three white stones.',
      'Stand in the middle of them.',
      'Then dig!',
    ]);
    this.digChest.set(dug, hasTreasure('shell_necklace'));
    {
      w.time.addEvent({ delay: 1600, loop: true, callback: () => {
        if (save.puzzles.dig || Math.hypot(w.feet.x - DIG.x, w.feet.y - DIG.y) > 260) return;
        const g = w.fx(DIG.x + (Math.random() * 16 - 8), DIG.y - 2, 'spark', 0.2).setBlendMode('ADD').setTint(0xfff3c4).setAlpha(0).setDepth(-350);
        w.tweens.add({ targets: g, alpha: 0.8, yoyo: true, duration: 400, onComplete: () => g.destroy() });
      } });
    }
  }
  dig() {
    if (save.puzzles.dig) return;
    setPuzzle('dig');
    const w = this.w;
    w.locked = true;
    for (let k = 0; k < 3; k++) {
      w.time.delayedCall(k * 380, () => {
        sfx.dig();
        w.burst(DIG.x, DIG.y - 4, 0xe8d3a6, 14, 'dot');
        w.tweens.add({ targets: w.playerImg, scaleY: w.playerImg.scaleY * 0.92, duration: 120, yoyo: true });
      });
    }
    w.time.delayedCall(1200, () => {
      this.digImg.setTexture(ATLAS, 'hole');
      w.locked = false;
      this.digChest.reveal();
      w.game.events.emit('toast', 'Clunk! You found something!');
    });
  }

  // ------------------------------------------------------------ Order 18: footprint trail
  buildTrail() {
    const w = this.w;
    const solved = !!save.puzzles.trail;
    for (let i = 0; i < TRACKS.length; i++) this.tracks.push(w.add.graphics().setDepth(-358));
    const end = TRACKS[TRACKS.length - 1];
    this.trailGlow = w.fx(end[0], end[1] - 6, 'glow', 0.35).setBlendMode('ADD').setTint(0xfff1a8).setAlpha(0).setDepth(-350);
    w.tweens.add({ targets: this.trailGlow, scale: this.trailGlow.scale * 1.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.trailStep = solved ? TRACKS.length : 0;
    this.drawTracks();
    this.sign(TRACK_SIGN.x, TRACK_SIGN.y, [
      'Deer tracks!',
      'Walk on the glowing hoofprint.',
      'Follow them to a surprise!',
    ]);
    this.trailChest.set(solved, solved);
  }
  /** Found prints are golden, the next one glows, later ones are hidden. */
  private drawTracks() {
    const n = TRACKS.length;
    for (let i = 0; i < n - 1; i++) {
      const g = this.tracks[i]; g.clear();
      const [x, y] = TRACKS[i], [nx, ny] = TRACKS[i + 1];
      const a = Math.atan2(ny - y, nx - x);
      const state = i < this.trailStep ? 'found' : i === this.trailStep ? 'next' : 'hidden';
      if (state === 'hidden') continue;
      if (state === 'next') { g.fillStyle(0xfff1a8, 0.55); g.fillCircle(x, y, 26); }
      const col = state === 'found' ? 0xe0a83a : 0x5a3a2a;
      // Two little split-hoof prints, side by side, pointing along the trail.
      for (const side of [-1, 1]) {
        const ox = x + Math.cos(a + Math.PI / 2) * 9 * side + Math.cos(a) * (side * 6), oy = y + Math.sin(a + Math.PI / 2) * 9 * side + Math.sin(a) * (side * 6);
        for (const half of [-1, 1]) {
          const hx = ox + Math.cos(a + Math.PI / 2) * 3.2 * half, hy = oy + Math.sin(a + Math.PI / 2) * 3.2 * half;
          g.fillStyle(col, state === 'found' ? 0.9 : 0.75); g.fillEllipse(hx, hy, 6, 10);
        }
      }
    }
    // The end spot sparkles once every print is found.
    const done = this.trailStep >= n - 1;
    this.trailGlow.setAlpha(done && !save.puzzles.trail ? 0.75 : 0);
  }
  private trailCheck() {
    if (save.puzzles.trail) return;
    const n = TRACKS.length, w = this.w;
    const [x, y] = TRACKS[Math.min(this.trailStep, n - 1)];
    if (Math.hypot(w.feet.x - x, w.feet.y - y) > 38) return;
    if (this.trailStep < n - 1) {
      this.trailStep++;
      sfx.tock();
      w.burst(x, y - 4, 0xffe08a, 8, 'spark');
      this.drawTracks();
      if (this.trailStep === n - 1) w.game.events.emit('toast', 'Something sparkles ahead!');
      return;
    }
    this.trailStep = n;
    setPuzzle('trail');
    this.drawTracks();
    w.time.delayedCall(300, () => { this.trailChest.reveal(); w.game.events.emit('toast', 'The deer left you a present!'); });
  }

  // ------------------------------------------------------------ Order 18: pressure stones
  buildStones() {
    const w = this.w;
    const solved = !!save.puzzles.stones;
    for (const p of PSTONES) {
      const g = w.add.graphics().setDepth(-360);
      const badge = new NumBadge(w, p.x, p.y - 46, p.n, 15).setDepth(8400 + p.y * 0.001);
      const st = { x: p.x, y: p.y, n: p.n, g, badge, down: false };
      this.stones.push(st);
      this.setStone(st, solved, false);
    }
    if (solved) this.stoneNext = 5;
    this.sign(PSTONE_SIGN.x, PSTONE_SIGN.y, [
      'Stepping stones!',
      'Walk on them in order:',
      '1, 2, 3, 4.',
    ], () => [1, 2, 3, 4].map((n): SeqCard => ({ n, icon: 'q_stone', label: `Stone ${n}`, done: this.stoneNext > n })));
    this.stoneChest.set(solved, solved);
  }
  /** Draw a stepping stone up (grey) or pressed down (mossy green glow). */
  private setStone(st: Puzzles['stones'][number], down: boolean, anim = true) {
    st.down = down;
    const g = st.g; g.clear();
    const dy = down ? 3 : 0;
    g.fillStyle(0x2a2030, 0.22); g.fillEllipse(st.x + 3, st.y + 4, 64, 24);
    if (down) { g.fillStyle(0xbff59a, 0.45); g.fillEllipse(st.x, st.y + dy, 74, 32); }
    g.fillStyle(down ? 0x8fc27a : 0xb9b4ae, 1); g.fillEllipse(st.x, st.y + dy, 60, 24);
    g.lineStyle(3, 0x3b2a35, 1); g.strokeEllipse(st.x, st.y + dy, 60, 24);
    g.fillStyle(0xffffff, down ? 0.25 : 0.4); g.fillEllipse(st.x - 10, st.y - 4 + dy, 22, 7);
    st.badge.set(down ? 'done' : 'todo', anim);
  }
  private stepOn(i: number) {
    const w = this.w, st = this.stones[i];
    if (save.puzzles.stones || st.down) return;
    if (st.n === this.stoneNext) {
      this.setStone(st, true);
      this.stoneNext++;
      sfx.tock();
      w.burst(st.x, st.y - 6, 0xbff59a, 10, 'spark');
      if (this.stoneNext > 4) {
        setPuzzle('stones');
        w.time.delayedCall(500, () => { this.stoneChest.reveal(); w.game.events.emit('toast', 'All four! A chest pops up!'); });
      }
      return;
    }
    // Wrong stone: everything pops back up. Gentle, no penalty.
    for (const s of this.stones) if (s.down) this.setStone(s, false);
    this.stoneNext = 1;
    sfx.softFail();
    w.game.events.emit('toast', `That was ${st.n}. Start again at 1!`);
  }

  update(_time: number, _dt: number) {
    // Pressure stones: trigger once each time your feet land on a stone.
    let on = -1;
    for (let i = 0; i < this.stones.length; i++) { const s = this.stones[i]; if (Math.abs(this.w.feet.x - s.x) < 30 && Math.abs(this.w.feet.y - s.y) < 18) { on = i; break; } }
    if (on !== this.stoneOn) { this.stoneOn = on; if (on >= 0) this.stepOn(on); }
    this.trailCheck();
    // The songbird sings once on its own when you first wander close.
    if (!this.birdSang && !save.puzzles.bells && Math.hypot(this.w.feet.x - SONGBIRD.x, this.w.feet.y - SONGBIRD.y) < 260) this.sing();
  }
}
