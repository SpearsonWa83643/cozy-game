// Cute wilderness monsters: slimes and bramble critters (spooky-cute in Halloween). They wander
// their glade, hop after you when you come close, and poof into sparkles when bopped.
import Phaser from 'phaser';
import { ATLAS, frameScale } from '../art';
import { theme } from '../theme';
import { sfx } from '../audio';
import { ATLAS3 } from './wart';
import type { WildMonsterSpawn, WildClearing } from './gen';
import { inPond } from './gen';
import type { WildScene } from '../scenes/Wild';

export const SWING_RANGE = 86;
const SIGHT = 190;

export class Monster {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  x: number; y: number;
  hp = 2;
  alive = true;
  t = Math.random() * 1000;
  goal: { x: number; y: number } | null = null;
  wait = Math.random() * 1500;
  hurtT = 0;
  kx = 0; ky = 0;
  home: WildClearing;
  constructor(private s: WildScene, public kind: 'slime' | 'bramble', sp: WildMonsterSpawn, public id: number) {
    this.x = sp.x; this.y = sp.y; this.home = sp.home;
    this.shadow = s.add.image(this.x, this.y, ATLAS, 'shadow').setScale(44 / 64 / (frameScale.shadow ?? 1)).setDepth(-500).setAlpha(0.75);
    this.img = s.add.image(this.x, this.y, ATLAS3, this.frame(0)).setOrigin(0.5, 1).setScale(0.82 / (frameScale[this.frame(0)] ?? 3)).setDepth(this.y);
  }
  frame(f: number) { return `m_${this.kind === 'slime' ? 'slime' : 'bram'}_${theme.id === 'halloween' ? 'h' : 'c'}${f}`; }
  get name() {
    const h = theme.id === 'halloween';
    return this.kind === 'slime' ? (h ? 'Ghosty Slime' : 'Slime') : (h ? 'Pumpkin Puff' : 'Bramble Puff');
  }

  update(dt: number, px: number, py: number) {
    if (!this.alive) return;
    this.t += dt;
    const d = Math.hypot(px - this.x, py - this.y);
    let vx = 0, vy = 0;
    const speed = this.kind === 'slime' ? 52 : 44;
    if (this.hurtT > 0) {
      this.hurtT -= dt;
      vx = this.kx; vy = this.ky; this.kx *= 0.9; this.ky *= 0.9;
    } else if (d < SIGHT && d > 26 && !this.s.leaving && this.s.invulnT <= 0) {
      vx = (px - this.x) / d * speed; vy = (py - this.y) / d * speed;
    } else {
      if (!this.goal) {
        this.wait -= dt;
        if (this.wait <= 0) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * this.home.r * 0.8;
          this.goal = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r };
        }
      } else {
        const gd = Math.hypot(this.goal.x - this.x, this.goal.y - this.y);
        if (gd < 6) { this.goal = null; this.wait = 800 + Math.random() * 2000; }
        else { vx = (this.goal.x - this.x) / gd * speed * 0.6; vy = (this.goal.y - this.y) / gd * speed * 0.6; }
      }
    }
    const nx = this.x + vx * dt / 1000, ny = this.y + vy * dt / 1000;
    if (!inPond(this.s.map.ponds, nx, ny, 10) && nx > 40 && nx < this.s.map.w - 40 && ny > 60 && ny < this.s.map.h - 20) { this.x = nx; this.y = ny; }
    else this.goal = null;
    // Bouncy hop.
    const moving = Math.abs(vx) + Math.abs(vy) > 5;
    const ph = (this.t / (this.kind === 'slime' ? 420 : 300)) % 1;
    const hop = moving ? Math.abs(Math.sin(ph * Math.PI)) * (this.kind === 'slime' ? 10 : 4) : Math.sin(this.t / 500) * 1.2;
    this.img.setFrame(this.frame(moving && ph < 0.15 ? 1 : this.kind === 'bramble' && moving && ph > 0.5 ? 1 : 0));
    this.img.setPosition(this.x, this.y - hop).setDepth(this.y);
    if (vx !== 0) this.img.setFlipX(vx < 0);
    this.shadow.setPosition(this.x, this.y + 2).setAlpha(0.75 - hop * 0.02);
  }

  /** A bop from the stick: a little knock back, a white flash, and after two bops, a poof. */
  hit(fromX: number, fromY: number) {
    if (!this.alive) return false;
    this.hp--;
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    this.kx = (this.x - fromX) / d * 260; this.ky = (this.y - fromY) / d * 260; this.hurtT = 260;
    this.img.setTint(0xff9aa8);
    this.s.time.delayedCall(110, () => this.img.clearTint());
    this.s.tweens.add({ targets: this.img, scaleX: this.img.scaleX * 1.25, scaleY: this.img.scaleY * 0.8, duration: 90, yoyo: true });
    sfx.tock();
    if (this.hp <= 0) { this.poof(); return true; }
    return false;
  }

  poof() {
    this.alive = false;
    sfx.sparkle();
    const tint = theme.id === 'halloween' ? [0xffb347, 0xd9a0ff, 0xffffff] : [0xfff27a, 0x9ff0c0, 0xffffff];
    const e = this.s.add.particles(this.x, this.y - 22, ATLAS3, {
      frame: 'w_star', speed: { min: 60, max: 190 }, lifespan: { min: 500, max: 1000 },
      scale: { start: 0.55 / 3, end: 0 }, rotate: { min: 0, max: 360 }, gravityY: -40, tint, emitting: false,
    } as any).setDepth(9001);
    e.explode(18);
    this.s.time.delayedCall(1200, () => e.destroy());
    const puff = this.s.add.image(this.x, this.y - 20, ATLAS, 'smoke').setScale(0.3).setDepth(9000).setTint(0xffffff).setAlpha(0.8);
    this.s.tweens.add({ targets: puff, scale: 0.9, alpha: 0, duration: 500, onComplete: () => puff.destroy() });
    this.s.tweens.add({ targets: [this.img, this.shadow], scale: 0, alpha: 0, duration: 220, onComplete: () => { this.img.destroy(); this.shadow.destroy(); } });
    this.s.onPoof(this);
  }

  retheme() { if (this.alive) this.img.setFrame(this.frame(0)); }
}
