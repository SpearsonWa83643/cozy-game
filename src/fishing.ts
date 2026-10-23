// Cozy fishing: tap water to cast, wait for a bite, tap to hook, then a gentle timing game.
import Phaser from 'phaser';
import { ATLAS, frameScale, S } from './art';
import { sfx } from './audio';
import { waterAt, waterBlocks, nearestWater, WaterId } from './geo';
import { save, persist } from './save';
import { SPECIES, Species, COSMETICS, isUnlocked } from './catalog';
import type { WorldScene, Interactable } from './scenes/World';

export type FishState = 'idle' | 'cast' | 'wait' | 'bite' | 'reel' | 'land';
export type Reel = { t0: number; speed: number; zone: number; width: number; hits: number; need: number; misses: number; species: Species; flash: number; flashOk: boolean };

const RARITY_W = { common: 62, uncommon: 27, rare: 8, junk: 4 };

export class Fishing {
  state: FishState = 'idle';
  water: WaterId = 'pond';
  bobber: Phaser.GameObjects.Image;
  line: Phaser.GameObjects.Graphics;
  bx = 0; by = 0;
  timer = 0;
  nibble = 0;
  reel: Reel | null = null;
  prompt: Interactable;
  castFrom: [number, number] = [0, 0];
  catches = 0;

  constructor(private w: WorldScene) {
    this.bobber = w.add.image(0, 0, ATLAS, 'bobber').setOrigin(0.5, 0.75).setScale(1.3 / (frameScale.bobber ?? S)).setVisible(false).setDepth(-300);
    this.line = w.add.graphics().setDepth(9000);
    // A context prompt that follows you along any shoreline ("Fish" on the action button / E key).
    this.prompt = {
      x: 0, y: 0, r: 60, label: 'Fish', promptY: 115, noTap: true,
      enabled: () => this.state === 'idle' && !!this.spot && !this.w.boat?.hopping,
      action: () => { if (this.spot) this.cast(this.spot[0], this.spot[1]); },
    };
    w.interactables.push(this.prompt);
  }
  spot: [number, number] | null = null;
  spotTimer = 0;

  get active() { return this.state !== 'idle'; }

  /** Player tapped on water. */
  tapWater(wx: number, wy: number) {
    if (this.state !== 'idle') return;
    const fx = this.w.feet.x, fy = this.w.feet.y;
    const d = Math.hypot(wx - fx, wy - fy);
    if (d < 230) { this.cast(wx, wy); return; }
    // Too far: walk to the nearest dry spot on the way, then cast.
    let sx = wx, sy = wy;
    for (let k = 0; k < 60 && waterBlocks(sx, sy); k++) { sx += (fx - wx) / d * 12; sy += (fy - wy) / d * 12; }
    sx += (fx - wx) / d * 18; sy += (fy - wy) / d * 18;
    this.w.walkTo(sx, sy, null, () => { if (this.state === 'idle' && Math.hypot(wx - this.w.feet.x, wy - this.w.feet.y) < 260) this.cast(wx, wy); });
  }

  cast(wx: number, wy: number) {
    const wa = waterAt(wx, wy);
    if (!wa) return;
    this.water = wa;
    this.state = 'cast';
    this.w.path = []; this.w.pathTarget = null;
    this.w.body.setVelocity(0, 0);
    // Face the water.
    const a = Math.atan2(wy - this.w.feet.y, wx - this.w.feet.x);
    const sector = (Math.round(a / (Math.PI / 4)) + 8) % 8;
    const map: [number, boolean][] = [[2, false], [1, false], [0, false], [1, true], [2, true], [3, true], [4, false], [3, false]];
    [this.w.facing, this.w.flip] = map[sector];
    this.castFrom = [this.w.feet.x, this.w.feet.y];
    sfx.cast();
    const [tx, ty] = this.rodTip();
    this.bobber.setVisible(true).setPosition(tx, ty).setDepth(9000);
    this.w.tweens.addCounter({
      from: 0, to: 1, duration: 520, ease: 'Sine.easeOut',
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        this.bx = tx + (wx - tx) * p; this.by = ty + (wy - ty) * p - Math.sin(p * Math.PI) * 60;
        this.bobber.setPosition(this.bx, this.by);
      },
      onComplete: () => {
        if (this.state !== 'cast') return;
        this.bx = wx; this.by = wy;
        this.bobber.setDepth(-300);
        sfx.splash();
        this.w.life.ripple(wx, wy, 0.1, 0.5, 0.6, 1500);
        this.state = 'wait';
        this.timer = 1.8 + Math.random() * 3.6;
        this.nibble = 0.6 + Math.random();
        this.w.game.events.emit('fish-state', 'wait');
      },
    });
  }

  rodTip(): [number, number] {
    const f = this.w.facing, fl = this.w.flip ? -1 : 1;
    const dx = [10, 22, 30, 20, 8][f] * fl, dy = [-34, -40, -46, -56, -62][f];
    // Sitting up in a boat lifts the rod too.
    return [this.w.feet.x + dx, this.w.feet.y + dy - (this.w.boat?.active ? 34 : 0)];
  }

  /** Any tap / action press while fishing. */
  /** at: the input event's timestamp (performance clock), so a dropped frame never costs a fair tap. */
  tap(at?: number) {
    if (this.state === 'bite') { this.startReel(); return; }
    if (this.state === 'reel') { this.reelTap(at); return; }
    if (this.state === 'wait' || this.state === 'cast') { this.cancel('Line back in.'); return; }
  }

  cancel(msg?: string) {
    this.state = 'idle';
    this.reel = null;
    this.bobber.setVisible(false);
    this.line.clear();
    this.w.game.events.emit('fish-state', 'idle');
    if (msg) this.w.game.events.emit('toast', msg);
  }

  private pickSpecies(): Species {
    const pool = SPECIES.filter((s) => s.where === this.water);
    const firstHere = !pool.some((s) => save.fish[s.id]);
    const cand = firstHere ? pool.filter((s) => s.rarity === 'common') : pool;
    const total = cand.reduce((a, s) => a + RARITY_W[s.rarity], 0);
    let r = Math.random() * total;
    for (const s of cand) { r -= RARITY_W[s.rarity]; if (r <= 0) return s; }
    return cand[0];
  }

  startReel() {
    const sp = this.pickSpecies();
    const lvl = { junk: 0, common: 0, uncommon: 1, rare: 2 }[sp.rarity];
    this.state = 'reel';
    this.reel = {
      t0: performance.now(), speed: 1.7 + lvl * 0.45, zone: 0.3 + Math.random() * 0.4, width: [0.3, 0.24, 0.18][lvl],
      hits: 0, need: 2 + lvl, misses: 0, species: sp, flash: 0, flashOk: true,
    };
    sfx.reel(true);
    this.w.game.events.emit('fish-state', 'reel');
  }

  /** Marker position 0..1, from wall-clock time so taps are judged exactly when they land. */
  markerPos(now = performance.now()) {
    const r = this.reel!;
    return 0.5 + 0.5 * Math.sin((now - r.t0) / 1000 * r.speed * Math.PI);
  }

  reelTap(at?: number) {
    const r = this.reel!;
    const now = performance.now();
    const pos = this.markerPos(at && at > now - 1500 && at <= now + 5 ? at : now);
    const ok = Math.abs(pos - r.zone) <= r.width / 2;
    r.flash = 0.35; r.flashOk = ok;
    sfx.reel(ok);
    if (ok) {
      r.hits++;
      try { navigator.vibrate?.(25); } catch { /* unsupported */ }
      this.w.life.ripple(this.bx, this.by, 0.1, 0.5, 0.6, 900);
      if (r.hits >= r.need) { this.land(); return; }
      r.zone = 0.18 + Math.random() * 0.64;
      r.speed *= 1.08;
    } else {
      r.misses++;
      if (r.misses >= 3) { this.cancel('Splash! It got away. Try again!'); sfx.splash(); return; }
    }
  }

  land() {
    const r = this.reel!;
    const sp = r.species;
    this.state = 'land';
    const size = Math.round(sp.size[0] + Math.random() * (sp.size[1] - sp.size[0]));
    const rec = save.fish[sp.id] ?? { n: 0, best: 0 };
    const isNew = rec.n === 0;
    const unlockBefore = COSMETICS.filter((c) => isUnlocked(c)).map((c) => c.id);
    rec.n++; rec.best = Math.max(rec.best, size);
    save.fish[sp.id] = rec;
    persist();
    this.catches++;
    const unlocked = COSMETICS.filter((c) => isUnlocked(c) && !unlockBefore.includes(c.id));
    // The fish leaps out of the water to you.
    sfx.splash(true);
    sfx.caught(sp.rarity === 'rare');
    const img = this.w.add.image(this.bx, this.by, ATLAS, 'fishicon').setScale((0.2 + size / 300) / (frameScale.fishicon ?? S)).setTint(sp.tint).setDepth(9200);
    const [px, py] = [this.w.feet.x, this.w.feet.y - 50];
    this.bobber.setVisible(false);
    this.w.tweens.addCounter({
      from: 0, to: 1, duration: 700, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        img.setPosition(this.bx + (px - this.bx) * p, this.by + (py - this.by) * p - Math.sin(p * Math.PI) * 70).setRotation(p * Math.PI * 2);
      },
      onComplete: () => {
        this.w.burst(px, py, 0xbff0ff, 16, 'dot');
        this.w.tweens.add({ targets: img, alpha: 0, scale: img.scale * 0.5, duration: 300, onComplete: () => img.destroy() });
        this.w.game.events.emit('fish-caught', { species: sp, size, isNew, unlocked: unlocked.map((c) => c.name) });
        this.state = 'idle';
        this.reel = null;
        this.line.clear();
        this.w.game.events.emit('fish-state', 'idle');
      },
    });
  }

  update(time: number, dt: number) {
    // Shoreline prompt (checked a few times a second).
    this.spotTimer -= dt;
    if (this.spotTimer <= 0) {
      this.spotTimer = 0.25;
      // In a boat: open water off the bow. On foot: the nearest shoreline.
      this.spot = this.state !== 'idle' ? null : this.w.boat?.active ? this.w.boat.castSpot() : nearestWater(this.w.feet.x, this.w.feet.y, 120);
    }
    this.prompt.x = this.w.feet.x; this.prompt.y = this.w.feet.y + 45;
    if (this.state === 'idle') return;
    // Walking away reels the line in.
    if ((this.state === 'wait' || this.state === 'bite') && Math.hypot(this.w.feet.x - this.castFrom[0], this.w.feet.y - this.castFrom[1]) > 30) {
      this.cancel(); return;
    }
    const t = time / 1000;
    if (this.state === 'wait') {
      this.timer -= dt;
      this.nibble -= dt;
      let dip = Math.sin(t * 2.4) * 1.2;
      if (this.nibble < 0 && this.nibble > -0.25) dip += 2.5;
      if (this.nibble < -0.25) this.nibble = 0.8 + Math.random() * 1.4;
      this.bobber.setPosition(this.bx, this.by + dip);
      if (this.timer <= 0) {
        this.state = 'bite';
        this.timer = 1.7;
        sfx.bite();
        try { navigator.vibrate?.([40, 50, 40]); } catch { /* unsupported */ }
        this.w.life.ripple(this.bx, this.by, 0.12, 0.7, 0.7, 1200);
        this.w.floatText(this.w.feet.x, this.w.feet.y - 78, '!', '#ffe27a');
        this.w.game.events.emit('fish-state', 'bite');
      }
    } else if (this.state === 'bite') {
      this.timer -= dt;
      this.bobber.setPosition(this.bx, this.by + 5 + Math.sin(t * 30) * 1.5);
      if (this.timer <= 0) this.cancel('Too slow! Try again.');
    } else if (this.state === 'reel') {
      const r = this.reel!;
      r.flash = Math.max(0, r.flash - dt);
      this.bobber.setPosition(this.bx + Math.sin(t * 13) * 3, this.by + 3 + Math.sin(t * 17) * 2);
    }
    // Rod + line.
    const g = this.line;
    g.clear();
    if (this.state === 'land') return;
    const [rx, ry] = this.rodTip();
    const hx = this.w.feet.x + (this.w.flip ? -8 : 8), hy = this.w.feet.y - 22;
    g.lineStyle(2.2, 0x6b4a2e, 1).beginPath().moveTo(hx, hy).lineTo(rx, ry).strokePath();
    if (this.bobber.visible) {
      const tight = this.state === 'reel' || this.state === 'bite';
      const mx = (rx + this.bobber.x) / 2, my = (ry + this.bobber.y) / 2 + (tight ? 4 : 18);
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(rx, ry), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(this.bobber.x, this.bobber.y - 3));
      g.lineStyle(1, 0xfaf3e0, 0.8);
      curve.draw(g, 16);
    }
  }
}
