// 40 (Walker, Oct 29): the Mount Thief. A button calls a masked thief (a random animal each time).
// Tap it 3 times before it gets away to arrest it. If it escapes, it grabs one of your flying
// friends and hides it behind a random puzzle, which gets mixed up again (even if you'd solved it).
// Solve that puzzle and open its chest to rescue your friend. Kid-friendly: no scary bits, big
// slow target, and the friend is never lost for good.
import Phaser from 'phaser';
import { Ctx, canvasTex, atlasOf, frameScale } from './art';
import { save, persist, addFruit } from './save';
import { MOUNTS, isMountUnlocked, themeDefaultMount, mountById } from './mount/defs';
import { sfx } from './audio';
import type { WorldScene } from './scenes/World';
import { DPR } from './dpr';

type Kind = { id: string; name: string; fur: string; dark: string; belly: string; ear: 'round' | 'point' | 'long' | 'big'; tail: 'ring' | 'bush' | 'puff' | 'thin' | 'curl' };
export const THIEVES: Kind[] = [
  { id: 'raccoon', name: 'Raccoon', fur: '#8f939c', dark: '#4a4d55', belly: '#d9dbe0', ear: 'round', tail: 'ring' },
  { id: 'fox', name: 'Fox', fur: '#e07a32', dark: '#7a3a18', belly: '#fff3e0', ear: 'point', tail: 'bush' },
  { id: 'bunny', name: 'Bunny', fur: '#d8c0a0', dark: '#8a6a4c', belly: '#fff6ea', ear: 'long', tail: 'puff' },
  { id: 'mouse', name: 'Mouse', fur: '#b5a79e', dark: '#6a5c55', belly: '#efe6df', ear: 'big', tail: 'thin' },
  { id: 'cat', name: 'Kitty', fur: '#5d5966', dark: '#2e2b35', belly: '#f2f0f5', ear: 'point', tail: 'curl' },
  { id: 'pig', name: 'Piglet', fur: '#f2a7b5', dark: '#b8606f', belly: '#ffd8df', ear: 'point', tail: 'curl' },
];

/** Puzzles a friend can be hidden behind, with a kid-readable place name. */
export const HIDES: Record<string, string> = {
  pots: 'the flower pots', bells: 'the singing bells', tiles: 'the turning tiles',
  dig: 'the digging spot', stones: 'the stepping stones', trail: 'the deer tracks',
};

const TW = 64, TH = 58;
function paintThief(c: Ctx, k: Kind) {
  const line = '#3b2a22';
  c.lineWidth = 2;
  // Tail (behind, on the left).
  c.strokeStyle = line;
  if (k.tail === 'ring' || k.tail === 'bush') {
    c.fillStyle = k.fur; c.beginPath(); c.ellipse(11, 30, 10, 6, -0.6, 0, Math.PI * 2); c.fill(); c.stroke();
    if (k.tail === 'ring') { c.fillStyle = k.dark; for (const t of [0.35, 0.65]) { c.beginPath(); c.ellipse(11 + (t - 0.5) * 14, 30 - (t - 0.5) * -10, 2.4, 6, -0.6, 0, Math.PI * 2); c.fill(); } }
    else { c.fillStyle = '#fffaf0'; c.beginPath(); c.ellipse(4, 25, 4, 3.4, -0.6, 0, Math.PI * 2); c.fill(); }
  } else if (k.tail === 'puff') { c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(13, 36, 5, 0, Math.PI * 2); c.fill(); c.stroke(); }
  else { c.strokeStyle = k.dark; c.lineWidth = 2.4; c.beginPath(); c.moveTo(16, 38); c.bezierCurveTo(6, 40, 4, 28, 10, 27); if (k.tail === 'curl') c.arc(10, 30, 3, -Math.PI / 2, Math.PI); c.stroke(); c.lineWidth = 2; c.strokeStyle = line; }
  // Legs.
  c.fillStyle = k.dark;
  for (const x of [18, 25, 34, 41]) { c.beginPath(); c.roundRect(x - 2.6, 42, 5.2, 9, 2.4); c.fill(); }
  // Body with a striped robber shirt.
  c.save(); c.beginPath(); c.ellipse(30, 36, 16, 11, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#f7f3ea'; c.fillRect(10, 22, 40, 30);
  c.fillStyle = '#2c2a33'; for (let y = 27; y < 50; y += 6) c.fillRect(10, y, 40, 3);
  c.restore();
  c.strokeStyle = line; c.beginPath(); c.ellipse(30, 36, 16, 11, 0, 0, Math.PI * 2); c.stroke();
  // Ears.
  c.fillStyle = k.fur;
  const ear = (x: number) => {
    c.beginPath();
    if (k.ear === 'round') c.arc(x, 11, 4.5, 0, Math.PI * 2);
    else if (k.ear === 'big') c.arc(x, 10, 6.5, 0, Math.PI * 2);
    else if (k.ear === 'long') c.ellipse(x, 5, 3.6, 9, (x - 46) * 0.04, 0, Math.PI * 2);
    else { c.moveTo(x - 5, 16); c.lineTo(x - 1, 4); c.lineTo(x + 4, 15); c.closePath(); }
    c.fill(); c.stroke();
  };
  ear(40); ear(51);
  // Head.
  c.fillStyle = k.fur; c.beginPath(); c.arc(46, 22, 11, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = k.belly; c.beginPath(); c.ellipse(53, 26, 6, 4.6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = k.id === 'pig' ? '#e07f92' : '#2b2028'; c.beginPath(); c.ellipse(58, 25, k.id === 'pig' ? 3.2 : 2.2, k.id === 'pig' ? 2.6 : 1.8, 0, 0, Math.PI * 2); c.fill();
  // The robber mask: a black band with two eye holes.
  c.fillStyle = '#1d1a22'; c.beginPath(); c.roundRect(36, 15.5, 22, 7.5, 3.6); c.fill();
  c.beginPath(); c.moveTo(37, 18); c.lineTo(31, 15); c.lineTo(32, 21); c.closePath(); c.fill();
  c.fillStyle = '#fffaf0'; for (const x of [44, 52]) { c.beginPath(); c.ellipse(x, 19.2, 2.6, 2.2, 0, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#1d1a22'; for (const x of [45, 53]) { c.beginPath(); c.arc(x, 19.4, 1.2, 0, Math.PI * 2); c.fill(); }
  // A cheeky smile.
  c.strokeStyle = line; c.lineWidth = 1.4; c.beginPath(); c.arc(53, 28, 3, 0.2, Math.PI - 0.6); c.stroke();
}
function paintSack(c: Ctx) {
  c.strokeStyle = '#4a321f'; c.lineWidth = 2;
  c.fillStyle = '#b98a55'; c.beginPath(); c.moveTo(10, 8); c.bezierCurveTo(-2, 14, 0, 30, 14, 30); c.bezierCurveTo(28, 30, 30, 14, 18, 8); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#d8a96c'; c.beginPath(); c.ellipse(14, 7, 6, 3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = '#7a4f2c'; c.beginPath(); c.moveTo(8, 11); c.lineTo(20, 11); c.stroke();
  c.fillStyle = '#ffd34d'; c.strokeStyle = '#a5741d'; c.lineWidth = 1.2;
  c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.2 : 5, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(14 + Math.cos(a) * r, 20 + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
}
function paintCage(c: Ctx) {
  c.strokeStyle = '#6b4a33'; c.lineWidth = 3;
  c.fillStyle = 'rgba(255,240,200,0.18)'; c.beginPath(); c.roundRect(3, 8, 74, 62, 8); c.fill();
  c.fillStyle = '#c99a4e'; c.beginPath(); c.roundRect(1, 64, 78, 8, 3); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(4, 4, 72, 8, 4); c.fill(); c.stroke();
  c.strokeStyle = '#8a6a4c'; c.lineWidth = 3.4;
  for (let x = 10; x <= 70; x += 12) { c.beginPath(); c.moveTo(x, 12); c.lineTo(x, 64); c.stroke(); }
  c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(40, 2.5, 4, 0, Math.PI * 2); c.fill();
}
function paintMask(c: Ctx) {
  c.fillStyle = '#1d1a22'; c.beginPath(); c.roundRect(2, 6, 36, 14, 7); c.fill();
  c.fillStyle = '#fffaf0'; for (const x of [12, 28]) { c.beginPath(); c.ellipse(x, 13, 4.6, 3.6, 0, 0, Math.PI * 2); c.fill(); }
}
export function paintThieves(scene: Phaser.Scene) {
  for (const k of THIEVES) canvasTex(scene, `thief_${k.id}`, TW, TH, (c) => paintThief(c, k));
  canvasTex(scene, 'thief_sack', 28, 32, paintSack);
  canvasTex(scene, 'thief_cage', 80, 74, paintCage);
  canvasTex(scene, 'thief_mask', 40, 26, paintMask);
  // 43: a little paw print for the escape trail.
  canvasTex(scene, 'thief_paw', 20, 20, (c) => {
    c.fillStyle = 'rgba(74,50,31,0.75)';
    c.beginPath(); c.ellipse(10, 13, 5, 4.2, 0, 0, Math.PI * 2); c.fill();
    for (const [x, y] of [[4, 6], [8, 3.5], [12, 3.5], [16, 6]]) { c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
  });
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const TAPS = 3;
const SCALE = 2.3;

export class Thief {
  state: 'off' | 'sneak' | 'caught' | 'flee' = 'off';
  kind: Kind = THIEVES[0];
  taps = 0;
  spr: Phaser.GameObjects.Image | null = null;
  sack: Phaser.GameObjects.Image | null = null;
  pips: Phaser.GameObjects.Graphics | null = null;
  to = { x: 0, y: 0 };
  speed = 170;
  endAt = 0;
  last = '';
  marker: Phaser.GameObjects.Container | null = null;
  caughtN = 0; stolenN = 0; rescuedN = 0;
  /** 41: berries the last caught thief left as a thank-you. */
  thanks = 0;
  /** 43: paw prints left on the escape trail (tests). */
  paws = 0;
  private pawAt: { x: number; y: number } | null = null;
  private pawSide = 1;
  private entering = false;
  private hop: Phaser.Tweens.Tween | null = null;

  constructor(private w: WorldScene) {
    w.game.events.on('puzzle-chest', this.onChest, this);
    w.events.once('shutdown', () => w.game.events.off('puzzle-chest', this.onChest, this));
    this.placeMarker();
  }

  /** Friends the thief could take: unlocked, not the theme's own default (you always keep a ride). */
  stealable() {
    const def = themeDefaultMount();
    return MOUNTS.filter((m) => m.id !== def && isMountUnlocked(m));
  }
  /** Why the button can't start a thief right now (or null when it can). */
  blocked(): string | null {
    const w = this.w;
    if (this.state !== 'off') return 'busy';
    if (save.stolen) return `Rescue the ${mountById(save.stolen.mount)?.name ?? 'friend'} first! It's hidden behind ${HIDES[save.stolen.puzzle]}.`;
    if (w.mount?.carrying || w.fishing?.active || w.boat?.active || w.village?.building || w.locked || w.registry.get('dialogOpen') || w.registry.get('menuOpen')) return 'Hop off and get comfy first, then try again!';
    if (!this.stealable().length) return 'No sneaky thieves yet. Find a flying friend first!';
    return null;
  }

  start(kindId?: string, ms = 12000) {
    const why = this.blocked();
    if (why) { if (why !== 'busy') this.w.game.events.emit('toast', why); return false; }
    const w = this.w;
    const pool = THIEVES.filter((k) => k.id !== this.last);
    this.kind = THIEVES.find((k) => k.id === kindId) ?? pool[Math.floor(Math.random() * pool.length)];
    this.last = this.kind.id;
    this.taps = 0;
    const v = w.cameras.main.worldView;
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? v.x - 40 : v.right + 40;
    const y = v.y + v.height * (0.45 + Math.random() * 0.3);
    const key = `thief_${this.kind.id}`;
    this.spr = w.add.image(x, y, atlasOf(key), key).setOrigin(0.5, 0.92).setScale(SCALE / (frameScale[key] ?? 1)).setDepth(y + 8000);
    this.sack = w.add.image(x, y, atlasOf('thief_sack'), 'thief_sack').setOrigin(0.5, 0.9).setScale(1.4 / (frameScale.thief_sack ?? 1)).setDepth(y + 7999);
    this.pips = w.add.graphics().setDepth(9500);
    this.state = 'sneak';
    // It dashes in from the edge, then slows down to sneak (so it doesn't linger under the buttons).
    this.speed = 380; this.entering = true;
    this.endAt = w.time.now + ms;
    this.pickSpot();
    this.startHop();
    sfx.whistle?.();
    w.game.events.emit('toast', `A sneaky ${this.kind.name}! Tap it ${TAPS} times to catch it!`);
    w.game.events.emit('thief', 'start');
    return true;
  }

  private startHop() {
    if (!this.spr || reduceMotion()) return;
    this.hop?.stop();
    this.hop = this.w.tweens.add({ targets: this.spr, scaleY: { from: this.spr.scaleY * 0.92, to: this.spr.scaleY }, duration: 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private pickSpot() {
    const v = this.w.cameras.main.worldView;
    // Keep clear of the HUD buttons on the sides and top so taps land on the thief.
    const mx = v.width * 0.2, my = v.height * 0.24;
    let tx = 0, ty = 0;
    for (let i = 0; i < 6; i++) {
      tx = v.x + mx + Math.random() * (v.width - 2 * mx);
      ty = v.y + my + Math.random() * (v.height - 1.6 * my);
      if (!this.spr || Math.hypot(tx - this.spr.x, ty - this.spr.y) > v.width * 0.25) break;
    }
    this.to = { x: tx, y: ty };
  }

  /** World taps land here first. True when the tap hit the thief. */
  onTap(wx: number, wy: number) {
    if (this.state !== 'sneak' || !this.spr) return false;
    const s = this.spr;
    const cy = s.y - 26 * SCALE * 0.5;
    if (Math.hypot(wx - s.x, wy - cy) > 34 * SCALE + 12) return false;
    this.taps++;
    const w = this.w;
    w.burst(s.x, cy, 0xffe08a, 12, 'spark');
    sfx.ting?.();
    if (!reduceMotion()) w.tweens.add({ targets: s, y: s.y - 26, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
    if (this.taps >= TAPS) { this.arrest(); return true; }
    this.speed = 170 + 40 * this.taps; this.entering = false;
    this.pickSpot();
    w.game.events.emit('toast', this.taps === 1 ? 'Got it once! Again!' : 'One more tap!');
    return true;
  }

  private arrest() {
    const w = this.w, s = this.spr!;
    this.state = 'caught';
    this.hop?.stop(); this.hop = null;
    this.caughtN++;
    save.minor.thief_caught = (save.minor.thief_caught ?? 0) + 1;
    persist();
    sfx.solve();
    const cage = w.add.image(s.x, s.y - 300, atlasOf('thief_cage'), 'thief_cage').setOrigin(0.5, 1).setScale(2.3 / (frameScale.thief_cage ?? 1)).setDepth(s.depth + 2);
    w.tweens.add({ targets: cage, y: s.y + 10, duration: reduceMotion() ? 1 : 420, ease: 'Bounce.easeOut', onComplete: () => { w.cameras.main.shake(140, 0.002); w.burst(s.x, s.y - 40, 0xffd27a, 26, 'spark'); } });
    this.sack?.setPosition(s.x + 50, s.y + 6);
    // 41: a thank-you snack: it says sorry and leaves you some berries (if your basket has room).
    let got = 0;
    for (let i = 0; i < 2; i++) if (addFruit('berry')) got++;
    if (got) { w.game.events.emit('snacks', save.snacks); w.burst(s.x + 40, s.y - 20, 0xd94a6a, 10, 'spark'); }
    this.thanks = got;
    w.game.events.emit('toast', got ? `You caught the sneaky ${this.kind.name}! It says sorry and leaves you ${got === 1 ? 'a berry' : `${got} berries`}.` : `You caught the sneaky ${this.kind.name}! It says sorry and gives back the sack.`);
    w.game.events.emit('thief', 'caught');
    // Driven from update() (not a timer chain) so it always finishes, even on a slow frame rate.
    this.cage = cage; this.caughtAt = performance.now(); this.fading = false;
  }

  /** Time ran out: the thief grabs a friend and hides it behind a puzzle. */
  private escape() {
    const w = this.w, s = this.spr!;
    const list = this.stealable();
    if (!list.length) { this.state = 'flee'; this.runOff(() => this.clear()); return; }
    const m = list[Math.floor(Math.random() * list.length)];
    const solved = Object.keys(HIDES).filter((id) => save.puzzles[id]);
    const pool = solved.length ? solved : Object.keys(HIDES).filter((id) => id !== 'dig');
    const pid = pool[Math.floor(Math.random() * pool.length)];
    save.stolen = { mount: m.id, puzzle: pid, kind: this.kind.id };
    delete save.puzzles[pid];
    persist();
    w.puzzles.resetById(pid);
    this.stolenN++;
    this.state = 'flee';
    this.placeMarker();
    sfx.softFail?.();
    w.burst(s.x, s.y - 40, 0xd8c8ff, 14, 'spark');
    const n = this.kind.name;
    this.runOff(() => {
      this.clear();
      w.game.events.emit('dialog', [
        `Oh no! The sneaky ${n} ran off with your ${m.name}!`,
        `It hid your friend behind ${HIDES[pid]}, and that puzzle got all mixed up again.`,
        `Solve it and open the chest to rescue the ${m.name}! Look for the sack with the star.`,
      ]);
    });
    w.game.events.emit('thief', 'stolen');
  }

  private runOff(done: () => void) {
    const w = this.w, s = this.spr!;
    const v = w.cameras.main.worldView;
    this.to = { x: s.x < v.centerX ? v.x - 120 : v.right + 120, y: s.y };
    this.pawAt = null;
    this.speed = 420;
    w.time.delayedCall(reduceMotion() ? 200 : 1600, done);
  }

  private clear() {
    this.hop?.stop(); this.hop = null;
    this.spr?.destroy(); this.sack?.destroy(); this.pips?.destroy();
    this.spr = this.sack = null; this.pips = null;
    this.state = 'off';
    this.w.game.events.emit('thief', 'off');
  }

  private cage: Phaser.GameObjects.Image | null = null;
  private caughtAt = 0;
  private fading = false;

  update(dt: number, paused: boolean) {
    if (this.state === 'off' || !this.spr) return;
    if (paused) { if (this.state === 'sneak') this.endAt += dt * 1000; return; }
    const s = this.spr;
    if (this.state === 'caught') {
      const ct = (performance.now() - this.caughtAt) / 1000, fadeAt = 2.6;
      if (!this.fading && ct >= fadeAt) { this.fading = true; this.w.burst(s.x, s.y - 40, 0xbfe3ff, 18, 'spark'); }
      if (this.fading) {
        const a = Math.max(0, 1 - (ct - fadeAt) / 0.6);
        s.setAlpha(a); this.sack?.setAlpha(a); this.cage?.setAlpha(a);
        if (a <= 0) { this.cage?.destroy(); this.cage = null; this.clear(); return; }
      }
    }
    if (this.state === 'sneak' && this.w.time.now > this.endAt) { this.escape(); }
    if (this.state === 'sneak' || this.state === 'flee') {
      const dx = this.to.x - s.x, dy = this.to.y - s.y, d = Math.hypot(dx, dy);
      const step = this.speed * (reduceMotion() ? 0.7 : 1) * dt;
      if (d <= step) { if (this.state === 'sneak') { if (this.entering) { this.entering = false; this.speed = 170 + 40 * this.taps; } this.pickSpot(); } }
      else { s.x += dx / d * step; s.y += dy / d * step; s.setFlipX(dx < 0); }
      s.setDepth(s.y + 8000);
      if (this.state === 'flee') this.dropPaw(s.x, s.y);
      if (this.sack) { this.sack.setPosition(s.x + (s.flipX ? 30 : -30), s.y - 4).setDepth(s.depth - 1); }
    }
    // Tap pips above its head: filled ones are your taps so far, and a ring shows the time left.
    const g = this.pips!;
    g.clear();
    if (this.state === 'sneak') {
      const x = s.x, y = s.y - 58 * SCALE - 10;
      const left = Math.max(0, (this.endAt - this.w.time.now) / 12000);
      g.fillStyle(0xfffaf0, 0.9); g.fillRoundedRect(x - 40, y - 13, 80, 26, 13);
      for (let i = 0; i < TAPS; i++) {
        g.fillStyle(i < this.taps ? 0xf2c14e : 0xd9cbb5, 1); g.fillCircle(x - 22 + i * 22, y, 8);
        g.lineStyle(2, 0x6b4a33, 1); g.strokeCircle(x - 22 + i * 22, y, 8);
      }
      g.lineStyle(4, 0xe85d3a, 0.9); g.beginPath(); g.arc(x, y + 22, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, left)); g.strokePath();
    }
  }

  /** 43: fading paw prints behind an escaping thief (alternating left/right). */
  private dropPaw(x: number, y: number) {
    if (this.pawAt && Math.hypot(x - this.pawAt.x, y - this.pawAt.y) < 46) return;
    this.pawAt = { x, y };
    this.pawSide = -this.pawSide;
    const w = this.w;
    const p = w.add.image(x, y - 4 + this.pawSide * 9, atlasOf('thief_paw'), 'thief_paw').setScale(1.5 / (frameScale.thief_paw ?? 1)).setDepth(y - 30)
      .setRotation(this.spr?.flipX ? -Math.PI / 2 : Math.PI / 2);
    this.paws++;
    w.tweens.add({ targets: p, alpha: 0, delay: reduceMotion() ? 1500 : 2200, duration: 1200, onComplete: () => p.destroy() });
  }

  /** A star sack bobs where the stolen friend is hiding. */
  placeMarker() {
    this.marker?.destroy(); this.marker = null;
    const st = save.stolen;
    if (!st) return;
    const ch = this.w.puzzles.chestById(st.puzzle);
    if (!ch) return;
    const w = this.w;
    const sack = w.add.image(0, 0, atlasOf('thief_sack'), 'thief_sack').setOrigin(0.5, 1).setScale(1.5 / (frameScale.thief_sack ?? 1));
    const mask = w.add.image(0, -50, atlasOf('thief_mask'), 'thief_mask').setScale(0.9 / (frameScale.thief_mask ?? 1));
    this.marker = w.add.container(ch.x + 46, ch.y - 4, [sack, mask]).setDepth(ch.y + 5);
    if (!reduceMotion()) w.tweens.add({ targets: this.marker, y: ch.y - 12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private onChest(pid: string) {
    const st = save.stolen;
    if (!st || st.puzzle !== pid) return;
    const m = mountById(st.mount);
    delete save.stolen;
    persist();
    this.rescuedN++;
    const w = this.w;
    const at = this.marker ? { x: this.marker.x, y: this.marker.y } : { x: w.feet.x, y: w.feet.y };
    this.marker?.destroy(); this.marker = null;
    w.burst(at.x, at.y - 40, 0xff9ab8, 24, 'heart');
    w.burst(at.x, at.y - 40, 0xffe08a, 24, 'spark');
    sfx.sparkle();
    w.time.delayedCall(400, () => w.game.events.emit('toast', `You rescued the ${m?.name ?? 'friend'}! It's back in your stable.`));
    w.game.events.emit('thief', 'rescued');
  }

  snapshot() {
    const s = this.spr;
    const c = this.w.cameras.main;
    return {
      state: this.state, kind: this.kind.id, taps: this.taps, stolen: save.stolen ? { ...save.stolen } : null,
      thanks: this.thanks, paws: this.paws, caught: this.caughtN, stolenN: this.stolenN, rescued: this.rescuedN, marker: !!this.marker,
      screen: s ? { x: (s.x - c.worldView.x) * c.zoom / DPR, y: (s.y - 24 * SCALE - c.worldView.y) * c.zoom / DPR } : null,
      blocked: this.blocked(),
    };
  }
}
