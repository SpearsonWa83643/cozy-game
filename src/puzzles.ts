// The treasure puzzles beyond the lanterns: garden flower pots, windmill bells, moon tiles and
// the lake-shore riddle. Each has a clue sign and reveals a chest with a treasure.
import Phaser from 'phaser';
import { ATLAS, frameScale, S } from './art';
import { POTS, POT_SIGN, POT_CHEST, BELLS, BELL_SIGN, BELL_CHEST, SONGBIRD, TILES, TILE_SIGN, TILE_CHEST, DIG, DIG_SIGN } from './layout';
import { sfx } from './audio';
import { save, setPuzzle, addTreasure, hasTreasure } from './save';
import { TREASURES } from './catalog';
import type { WorldScene } from './scenes/World';

const POT_COLORS = [0xff9ec4, 0x8fc8ff, 0xffd75e, 0xffffff, 0xc59bff];
const POT_TARGET = [0, 1, 2, 3];
const RIBBONS = [0xe85d5d, 0xf2c14e, 0x7cc463, 0x6fa8ff];
const SONG = [2, 0, 3, 1];

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
  open() {
    if (this.opened) return;
    this.opened = true;
    const w = this.w;
    this.img.setTexture(ATLAS, 'chest_open');
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
        w.game.events.emit('dialog', [`You found the ${t.name}!`, t.blurb, 'It is in your bag now \u2014 tap the satchel to try things on.']);
        this.onOpened?.();
      },
    });
  }
}

export class Puzzles {
  pots: { img: Phaser.GameObjects.Image; flower: Phaser.GameObjects.Image; color: number }[] = [];
  potChest: Chest;
  bells: { bell: Phaser.GameObjects.Image; ribbon: Phaser.GameObjects.Image }[] = [];
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

  constructor(private w: WorldScene) {
    this.potChest = new Chest(w, POT_CHEST.x, POT_CHEST.y, 'flower_crown');
    this.bellChest = new Chest(w, BELL_CHEST.x, BELL_CHEST.y, 'rusty_key', () => w.game.events.emit('toast', 'A rusty key\u2026 the old gate on the north bridge!'));
    this.tileChest = new Chest(w, TILE_CHEST.x, TILE_CHEST.y, 'fox_hood');
    this.digChest = new Chest(w, DIG.x, DIG.y + 6, 'shell_necklace');
    this.buildPots();
    this.buildBells();
    this.buildTiles();
    this.buildDig();
  }

  private sign(x: number, y: number, lines: string[]) {
    const w = this.w;
    w.shadow(x + 3, y - 2, 44, 0.7);
    w.img(x, y, 'sign').setDepth(y);
    w.solidCircle(x, y - 5, 8);
    w.interactables.push({ x, y, r: 56, label: 'Read', promptY: 70, enabled: () => true, action: () => w.game.events.emit('dialog', lines) });
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
      const pot = { img, flower, color };
      this.pots.push(pot);
      w.solidCircle(p.x, p.y - 4, 9);
      w.interactables.push({
        x: p.x, y: p.y, r: 30, label: 'Change', promptY: 52, reach: 190, approach: [0, 28],
        enabled: () => !save.puzzles.pots,
        action: () => this.cyclePot(i),
      });
    });
    this.sign(POT_SIGN.x, POT_SIGN.y, [
      'A little painted sign by the garden, in Grandmother\u2019s curly writing:',
      '\u201cRose for the morning, sky for the day,\nsun for the evening, snow for the moon\u2019s way.\u201d',
      '(Tap a pot to change its flower. Left to right.)',
    ]);
    this.potChest.set(solved, hasTreasure('flower_crown'));
  }
  cyclePot(i: number) {
    const p = this.pots[i];
    p.color = (p.color + 1) % POT_COLORS.length;
    p.flower.setTint(POT_COLORS[p.color]);
    const sx = p.flower.scaleX, sy = p.flower.scaleY;
    this.w.tweens.add({ targets: p.flower, scaleX: sx * 1.3, scaleY: sy * 1.3, duration: 140, yoyo: true, ease: 'Back.easeOut', onComplete: () => p.flower.setScale(sx, sy) });
    this.w.burst(p.img.x, p.img.y - 26, POT_COLORS[p.color], 8, 'petal');
    sfx.bellNote(p.color % 4, true);
    if (this.pots.every((q, k) => q.color === POT_TARGET[k])) {
      setPuzzle('pots');
      this.w.time.delayedCall(450, () => {
        this.pots.forEach((q, k) => this.w.time.delayedCall(k * 120, () => this.w.burst(q.img.x, q.img.y - 30, POT_COLORS[q.color], 12, 'spark')));
        this.potChest.reveal();
        this.w.game.events.emit('toast', 'The garden blooms all at once \u2014 something appears!');
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
      this.bells.push({ bell, ribbon });
      w.interactables.push({
        x: b.x, y: b.y, r: 40, label: 'Ring', promptY: 110, reach: 230, approach: [0, 30],
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
      'A note pinned to the post, signed \u201cthe windmill keeper\u201d:',
      '\u201cMy little songbird knows the tune that opens my strongbox. Ask her to sing, then ring the bells to match.\u201d',
      '\u201cListen for the high and low notes \u2014 and watch the ribbon colours!\u201d',
    ]);
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
      this.w.time.delayedCall(350, () => {
        sfx.softFail();
        this.w.game.events.emit('toast', this.birdSang ? 'The songbird tilts her head. That wasn\u2019t quite her tune\u2026' : 'Maybe the songbird knows the right tune?');
      });
      return;
    }
    if (this.bellInput.length === SONG.length) {
      setPuzzle('bells');
      this.w.time.delayedCall(500, () => {
        this.bells.forEach((q, j) => this.w.time.delayedCall(j * 140, () => { sfx.bellNote(j); this.w.tweens.add({ targets: q.bell, angle: { from: -20, to: 20 }, duration: 150, yoyo: true, repeat: 2, onComplete: () => q.bell.setAngle(0) }); }));
        this.w.time.delayedCall(800, () => { this.bellChest.reveal(); this.w.game.events.emit('toast', 'The songbird trills happily. The strongbox rises from the grass!'); });
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
      'Words carved into a mossy stone, beside a faded picture of a moon among stars:',
      '\u201cTurn the four stones until the moon sits high, the stars shine right, and the leaf rests low.\u201d',
      '(Tap a stone to turn it.)',
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
        this.w.time.delayedCall(600, () => { this.tileChest.reveal(); this.w.game.events.emit('toast', 'The moon picture glows. Somewhere, an owl hoots approvingly.'); });
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
      'A driftwood sign, half-buried in the sand. A riddle is scratched into it:',
      '\u201cThree white stones keep watch by the water,\nand what they guard sleeps in the sand between them.\nStand right in the middle, and dig.\u201d',
    ]);
    this.digChest.set(dug, hasTreasure('shell_necklace'));
    if (!dug) {
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
      w.game.events.emit('toast', 'Clunk! Your hands find something under the sand\u2026');
    });
  }

  update(_time: number, _dt: number) {
    // The songbird sings once on its own when you first wander close.
    if (!this.birdSang && !save.puzzles.bells && Math.hypot(this.w.feet.x - SONGBIRD.x, this.w.feet.y - SONGBIRD.y) < 260) this.sing();
  }
}
