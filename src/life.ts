import Phaser from 'phaser';
import { ATLAS, atlasOf, frameScale, S, pondValue } from './art';
import { theme } from './theme';
import { POND, COTTAGE, WORLD_W, WORLD_H } from './layout';
import { sfx } from './audio';
import type { WorldScene } from './scenes/World';
import { Creatures } from './creatures';
import { pondHit } from './art';

type Fly = {
  img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; landed?: number;
  hx: number; hy: number; x: number; y: number; vx: number; vy: number;
  tx: number; ty: number; retarget: number; phase: number; base: number;
};
type Bird = { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; vx: number; vy: number; phase: number; bat?: boolean };
type Fish = { img: Phaser.GameObjects.Image; x: number; y: number; tx: number; ty: number; heading: number; dart?: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Ambient life: butterflies, birds, a frog, a duck family, fish, a cat on the step, wind gusts
 * and falling leaves. Everything is gentle and sparse on purpose.
 */
export class Life {
  flies: Fly[] = [];
  birds: Bird[] = [];
  fish: Fish[] = [];
  ducks: { img: Phaser.GameObjects.Image; lag: number; baby: boolean; ox: number; oy: number; vx: number; vy: number }[] = [];
  reactions = 0;
  creatures!: Creatures;
  catMood = 0;
  catFollow = 0;
  catHome: [number, number] = [0, 0];
  catRolling = false;
  duckAngle = Math.random() * Math.PI * 2;
  nextWake = 0;
  nextQuack = 9000;
  nextFlock = 7000;
  nextPlip = 6000;
  frog!: Phaser.GameObjects.Image;
  frogSpots: [number, number][] = [];
  frogSpot = 0;
  frogHiddenUntil = 0;
  frogBusy = false;
  nextFrogHop = 8000;
  nextCroak = 5000;
  cat!: Phaser.GameObjects.Image;
  catTail!: Phaser.GameObjects.Image;
  catSwish = 0;
  /** Current gust front x (world), or null when calm. */
  gustX: number | null = null;
  nextGust = 9000;
  gustLeaves!: Phaser.GameObjects.Particles.ParticleEmitter;
  splash!: Phaser.GameObjects.Particles.ParticleEmitter;
  hearts!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private w: WorldScene) {
    this.makeButterflies();
    this.makeDucks();
    this.makeFish();
    this.makeFrog();
    this.makeCat();
    this.makeLeaves();
    this.creatures = new Creatures(w, () => { this.reactions++; });
    this.makeTaps();
  }

  rabbitFrom(x: number, y: number) { this.creatures.rabbitFrom(x, y); }
  sparrowsFrom(x: number, y: number) { this.creatures.sparrowsFrom(x, y); }
  beetleFrom(x: number, y: number) { this.creatures.beetleFrom(x, y); }

  /** Tap reactions for the glade's original residents. */
  makeTaps() {
    const w = this.w;
    // Butterflies come and rest on your hat for a while.
    for (const f of this.flies) {
      w.tappables.push({
        x: () => f.img.x, y: () => f.img.y, r: 30, enabled: () => !f.landed,
        tap: () => { this.reactions++; f.landed = w.time.now + 6500; sfx.blip(); },
      });
    }
    // Ducks quack and scatter, then regroup.
    for (const d of this.ducks) {
      w.tappables.push({
        x: () => d.img.x, y: () => d.img.y - 6, r: 30,
        tap: () => {
          this.reactions++;
          sfx.quack();
          for (const o of this.ducks) {
            const a = Math.atan2(o.img.y - d.img.y, o.img.x - d.img.x) + rand(-0.8, 0.8);
            o.vx = Math.cos(a) * rand(70, 110); o.vy = Math.sin(a) * rand(45, 70);
            this.splash.emitParticleAt(o.img.x, o.img.y, 4);
          }
        },
      });
    }
    // The frog croaks and hops.
    w.tappables.push({
      x: () => this.frog.x, y: () => this.frog.y - 8, r: 26, enabled: () => this.frog.visible && !this.frogBusy,
      tap: () => {
        this.reactions++;
        sfx.croak();
        this.w.tweens.add({ targets: this.frog, scaleX: this.frog.scaleX * 1.15, duration: 100, yoyo: true, repeat: 1 });
        this.w.time.delayedCall(420, () => this.frogHop((this.frogSpot + 1) % this.frogSpots.length, Math.random() < 0.3));
      },
    });
    // Fish dart away with a splash.
    for (const f of this.fish) {
      w.tappables.push({
        x: () => f.x, y: () => f.y, r: 22,
        tap: () => {
          this.reactions++;
          this.splash.emitParticleAt(f.x, f.y, 9);
          this.ripple(f.x, f.y, 0.12, 0.7, 0.6, 1600);
          sfx.splash();
          f.dart = 1.2;
          const a = rand(0, Math.PI * 2);
          f.tx = f.x + Math.cos(a) * 120; f.ty = f.y + Math.sin(a) * 70;
          if (!pondHit(f.tx, f.ty)) [f.tx, f.ty] = this.pondPoint(0.45);
        },
      });
    }
    // Birds overhead: tap to send them climbing with a chirp.
    w.tappables.push({
      x: () => (this.birds[0]?.img.x ?? -9999), y: () => (this.birds[0]?.img.y ?? -9999), r: 60, enabled: () => this.birds.length > 0,
      tap: () => { this.reactions++; sfx.chirp(); for (const b of this.birds) { b.vy = -90; b.vx *= 1.5; } },
    });
    // Cat: purr, roll over, or follow you for a bit.
    w.tappables.push({
      x: () => this.cat.x, y: () => this.cat.y - 14, r: 30,
      tap: () => this.petCat(),
    });
  }

  petCat() {
    const w = this.w;
    w.catPets++;
    this.reactions++;
    const mood = this.catMood++ % 3;
    sfx.purr();
    this.hearts.emitParticleAt(this.cat.x, this.cat.y - 30, 4);
    this.catSwish = 1.5;
    if (mood === 0) {
      const sy = this.cat.scaleY;
      w.tweens.add({ targets: this.cat, scaleY: sy * 0.9, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      w.game.events.emit('toast', 'Purr! The cat is happy.');
    } else if (mood === 1 && !this.catRolling) {
      this.catRolling = true;
      w.tweens.add({ targets: [this.cat], angle: this.cat.flipX ? -85 : 85, duration: 380, ease: 'Back.easeOut', yoyo: true, hold: 1600, onComplete: () => { this.catRolling = false; this.cat.setAngle(0); } });
      w.game.events.emit('toast', 'Belly rubs!');
    } else {
      this.catFollow = 10;
      w.game.events.emit('toast', 'Mrrp! The cat follows you.');
    }
  }

  img(x: number, y: number, key: string, scale = 1) {
    return this.w.add.image(x, y, atlasOf(key), key).setScale(scale / (frameScale[key] ?? S));
  }

  // ------------------------------------------------------------ butterflies
  makeButterflies() {
    const homes: [number, number, number][] = [
      [250, 640, 0xffd36b], [700, 1080, 0xffa6c9], [1600, 960, 0xa6d8ff],
      [1450, 470, 0xffffff], [1000, 230, 0xffc27a], [640, 860, 0xc9b6ff],
    ];
    for (const [hx, hy, tint] of homes) {
      const shadow = this.img(hx, hy, 'shadow', 0.16).setAlpha(0.35).setDepth(-450);
      const img = this.img(hx, hy, 'butterfly', 0.9).setTint(tint).setDepth(7000);
      this.flies.push({ img, shadow, hx, hy, x: hx, y: hy, vx: 0, vy: 0, tx: hx, ty: hy, retarget: 0, phase: Math.random() * 10, base: img.scaleX });
    }
  }

  updateFlies(t: number, dt: number) {
    const px = this.w.feet.x;
    const py = this.w.feet.y;
    for (const f of this.flies) {
      if (f.landed) {
        if (this.w.time.now > f.landed) { f.landed = 0; f.retarget = 0; }
        else {
          const hx = px + (this.w.flip ? 6 : -6), hy = py - 62;
          f.x += (hx - f.x) * Math.min(1, dt * 4); f.y += (hy - f.y) * Math.min(1, dt * 4);
          f.img.setPosition(f.x, f.y);
          f.img.scaleX = f.base * (0.55 + 0.45 * Math.abs(Math.sin(t * 2.5 + f.phase)));
          f.img.rotation = 0;
          f.img.setDepth(py + 8);
          f.shadow.setPosition(f.x + 4, py + 4);
          f.vx = 0; f.vy = 0;
          continue;
        }
      }
      f.img.setDepth(7000);
      f.retarget -= dt;
      const dpx = f.x - px;
      const dpy = f.y - py;
      const near = dpx * dpx + dpy * dpy < 55 * 55;
      if (f.retarget <= 0 || near) {
        const a = near ? Math.atan2(dpy, dpx) + rand(-0.6, 0.6) : rand(0, Math.PI * 2);
        const r = near ? 90 : rand(20, 110);
        f.tx = near ? f.x + Math.cos(a) * r : f.hx + Math.cos(a) * r;
        f.ty = near ? f.y + Math.sin(a) * r * 0.7 : f.hy + Math.sin(a) * r * 0.7;
        f.retarget = rand(1.5, 4);
      }
      const ax = (f.tx - f.x) * 0.9 + Math.sin(t * 3.1 + f.phase) * 40;
      const ay = (f.ty - f.y) * 0.9 + Math.cos(t * 2.3 + f.phase) * 30;
      f.vx += ax * dt; f.vy += ay * dt;
      const sp = Math.hypot(f.vx, f.vy);
      const max = near ? 90 : 42;
      if (sp > max) { f.vx *= max / sp; f.vy *= max / sp; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      const alt = 18 + Math.sin(t * 1.7 + f.phase) * 5;
      f.img.setPosition(f.x, f.y - alt);
      f.img.scaleX = f.base * (0.25 + 0.75 * Math.abs(Math.sin(t * 15 + f.phase)));
      f.img.rotation = Phaser.Math.Clamp(f.vx * 0.012, -0.5, 0.5);
      f.shadow.setPosition(f.x + 4, f.y + 2);
    }
  }

  // ------------------------------------------------------------ birds overhead
  spawnFlock() {
    const v = this.w.cameras.main.worldView;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y0 = rand(v.y + v.height * 0.15, v.y + v.height * 0.7);
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const x = dir > 0 ? v.x - 60 - i * 34 : v.right + 60 + i * 34;
      const y = y0 + (i % 2 ? 22 : -10) * i;
      if (theme.critters.bats && i !== 1) {
        // Halloween: little bats flutter past instead of most birds.
        const img = this.img(x, y, 'h_bat0', 0.85).setDepth(9500).setFlipX(dir < 0);
        const shadow = this.img(x + 60, y + 120, 'h_bat0', 0.85).setTint(0x000000).setAlpha(0.12).setDepth(-450);
        this.birds.push({ img, shadow, vx: dir * rand(90, 120), vy: rand(-12, 12), phase: Math.random() * 6, bat: true });
        continue;
      }
      const img = this.img(x, y, 'bird', 1).setDepth(9500).setFlipY(false).setRotation(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const shadow = this.img(x + 60, y + 120, 'bird', 1).setTint(0x000000).setAlpha(0.12).setDepth(-450).setRotation(img.rotation);
      this.birds.push({ img, shadow, vx: dir * rand(120, 150), vy: rand(-12, 12), phase: Math.random() * 6 });
    }
    sfx.chirp();
  }

  updateBirds(t: number, dt: number) {
    const v = this.w.cameras.main.worldView;
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.img.x += b.vx * dt;
      b.img.y += (b.vy + Math.sin(t * 2 + b.phase) * 10) * dt;
      if (b.bat) {
        const f = Math.sin(t * 16 + b.phase) > 0 ? 'h_bat0' : 'h_bat1';
        if (b.img.frame.name !== f) { b.img.setFrame(f); b.shadow.setFrame(f); }
        b.img.y += Math.sin(t * 5 + b.phase) * 20 * dt;
      } else {
        const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 9 + b.phase));
        b.img.scaleX = flap / frameScale.bird;
      }
      b.shadow.setPosition(b.img.x + 60, b.img.y + 120);
      b.shadow.scaleX = b.img.scaleX;
      if (b.img.x < v.x - 300 || b.img.x > v.right + 300) {
        b.img.destroy(); b.shadow.destroy();
        this.birds.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------ pond: ducks, fish, frog
  makeDucks() {
    const z = { ox: 0, oy: 0, vx: 0, vy: 0 };
    this.ducks.push({ img: this.img(0, 0, 'duck', 1.3).setDepth(-380), lag: 0, baby: false, ...z });
    this.ducks.push({ img: this.img(0, 0, 'duckling', 1.15).setDepth(-381), lag: 0.2, baby: true, ...z });
    this.ducks.push({ img: this.img(0, 0, 'duckling', 1.1).setDepth(-382), lag: 0.36, baby: true, ...z });
  }

  duckPos(a: number): [number, number] {
    return [POND.x + Math.cos(a) * POND.rx * 0.56 + Math.sin(a * 2.3) * 12, POND.y + Math.sin(a) * POND.ry * 0.48];
  }

  updateDucks(time: number, t: number, dt: number) {
    this.duckAngle += dt * 0.055;
    for (const d of this.ducks) {
      const a = this.duckAngle - d.lag;
      const [x, y] = this.duckPos(a);
      const [nx] = this.duckPos(a + 0.01);
      // Scatter offset springs back (regroup).
      d.ox += d.vx * dt; d.oy += d.vy * dt;
      d.vx = d.vx * Math.exp(-dt * 1.6) - d.ox * dt * 0.9; d.vy = d.vy * Math.exp(-dt * 1.6) - d.oy * dt * 0.9;
      if (!pondHit(x + d.ox, y + d.oy)) { d.ox *= 0.9; d.oy *= 0.9; d.vx *= -0.3; d.vy *= -0.3; }
      d.img.setPosition(x + d.ox, y + d.oy + Math.sin(t * 2.2 + d.lag * 9) * 0.7);
      d.img.setFlipX(Math.abs(d.vx) > 15 ? d.vx < 0 : nx < x);
    }
    if (time > this.nextWake) {
      this.nextWake = time + 900;
      for (const d of this.ducks) if (!d.baby || Math.random() < 0.5) this.ripple(d.img.x, d.img.y + 3, 0.1, 0.32, 0.3, 1600);
    }
    if (time > this.nextQuack) { this.nextQuack = time + rand(16000, 30000); this.nearCam(this.ducks[0].img.x, this.ducks[0].img.y) && sfx.quack(); }
  }

  makeFish() {
    for (let i = 0; i < 3; i++) {
      const [x, y] = this.pondPoint(0.45);
      const img = this.img(x, y, 'fish', 0.9 + Math.random() * 0.4).setAlpha(0.2).setDepth(-401);
      this.fish.push({ img, x, y, tx: x, ty: y, heading: 0 });
    }
    this.splash = this.w.add.particles(0, 0, ATLAS, {
      frame: 'dot', speed: { min: 20, max: 60 }, angle: { min: 220, max: 320 }, gravityY: 160,
      lifespan: 600, scale: { start: 0.18, end: 0.05 }, alpha: { start: 0.9, end: 0 }, tint: 0xe8fbff, emitting: false,
    }).setDepth(-370);
  }

  pondPoint(maxV: number): [number, number] {
    for (let k = 0; k < 40; k++) {
      const x = POND.x + rand(-1, 1) * POND.rx;
      const y = POND.y + rand(-1, 1) * POND.ry;
      if (pondValue(x, y) < maxV) return [x, y];
    }
    return [POND.x, POND.y];
  }

  updateFish(time: number, dt: number) {
    for (const f of this.fish) {
      const dx = f.tx - f.x;
      const dy = f.ty - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) { [f.tx, f.ty] = this.pondPoint(0.45); continue; }
      const want = Math.atan2(dy, dx);
      f.heading += Phaser.Math.Angle.Wrap(want - f.heading) * Math.min(1, dt * 1.5);
      const sp = f.dart && f.dart > 0 ? 80 : 16;
      if (f.dart) f.dart -= dt;
      f.x += Math.cos(f.heading) * sp * dt;
      f.y += Math.sin(f.heading) * sp * dt;
      f.img.setPosition(f.x, f.y).setRotation(f.heading + Math.PI);
    }
    if (time > this.nextPlip) {
      this.nextPlip = time + rand(7000, 15000);
      const f = this.fish[Math.floor(Math.random() * this.fish.length)];
      this.splash.emitParticleAt(f.x, f.y, 7);
      this.ripple(f.x, f.y, 0.12, 0.6, 0.55, 1800);
      this.w.time.delayedCall(260, () => this.ripple(f.x, f.y, 0.08, 0.4, 0.4, 1500));
      if (this.nearCam(f.x, f.y)) sfx.plip();
    }
  }

  ripple(x: number, y: number, s0: number, s1: number, alpha: number, dur: number) {
    const r = this.w.add.image(x, y, ATLAS, 'ripple').setScale(s0 / frameScale.ripple * 4).setAlpha(alpha).setBlendMode('ADD').setDepth(-395);
    this.w.tweens.add({ targets: r, scale: (s1 / frameScale.ripple) * 4, alpha: 0, duration: dur, ease: 'Sine.easeOut', onComplete: () => r.destroy() });
  }

  makeFrog() {
    const lily = this.w.lilies[0];
    this.frogSpots = [
      [POND.x - POND.rx + 2, POND.y + 62],
      [POND.x + 60, POND.y + POND.ry + 4],
      lily ? [lily.x, lily.y - 2] : [POND.x, POND.y],
      [POND.x + POND.rx - 10, POND.y - 50],
    ];
    const [x, y] = this.frogSpots[0];
    this.frog = this.img(x, y, 'frog', 0.9).setOrigin(0.5, 1).setDepth(-379);
  }

  frogHop(to: number, intoWater = false) {
    if (this.frogBusy) return;
    this.frogBusy = true;
    const [x, y] = this.frogSpots[to];
    const f = this.frog;
    const sx = f.scaleX;
    this.w.tweens.add({ targets: f, scaleY: f.scaleY * 0.8, duration: 120, yoyo: true });
    this.w.tweens.add({
      targets: f, x: intoWater ? f.x + (x - f.x) * 0.35 : x, y: intoWater ? f.y + (y - f.y) * 0.35 : y,
      duration: 650, delay: 120, ease: 'Sine.easeInOut',
      onUpdate: (tw) => { const p = tw.progress; f.setScale(sx * (1 + Math.sin(p * Math.PI) * 0.25)); f.setFlipX(x < f.x); },
      onComplete: () => {
        f.setScale(sx);
        this.frogBusy = false;
        if (intoWater) {
          this.splash.emitParticleAt(f.x, f.y - 4, 10);
          this.ripple(f.x, f.y - 3, 0.12, 0.7, 0.6, 1800);
          if (this.nearCam(f.x, f.y)) sfx.plip();
          f.setVisible(false);
          this.frogHiddenUntil = this.w.time.now + rand(6000, 10000);
          this.frogSpot = to;
        } else {
          this.frogSpot = to;
        }
      },
    });
  }

  updateFrog(time: number) {
    const f = this.frog;
    if (!f.visible) {
      if (time > this.frogHiddenUntil) {
        // Pop back up somewhere away from the player.
        let best = 0, bestD = -1;
        this.frogSpots.forEach(([x, y], i) => { const d = Math.hypot(x - this.w.feet.x, y - this.w.feet.y); if (d > bestD) { bestD = d; best = i; } });
        this.frogSpot = best;
        f.setPosition(...this.frogSpots[best]).setVisible(true).setAlpha(0);
        this.w.tweens.add({ targets: f, alpha: 1, duration: 500 });
        this.ripple(f.x, f.y - 3, 0.1, 0.4, 0.4, 1400);
      }
      return;
    }
    if (this.frogBusy) return;
    const dp = Math.hypot(f.x - this.w.feet.x, (f.y - this.w.feet.y) * 1.2);
    if (dp < 70) {
      // Shy: plop into the pond.
      let to = (this.frogSpot + 2) % this.frogSpots.length;
      this.frogHop(to, true);
      return;
    }
    if (time > this.nextCroak) { this.nextCroak = time + rand(8000, 16000); if (this.nearCam(f.x, f.y)) sfx.croak(); this.w.tweens.add({ targets: f, scaleX: f.scaleX * 1.12, duration: 110, yoyo: true, repeat: 1 }); }
    if (time > this.nextFrogHop) { this.nextFrogHop = time + rand(9000, 16000); this.frogHop((this.frogSpot + 1 + Math.floor(Math.random() * 3)) % this.frogSpots.length); }
  }

  // ------------------------------------------------------------ the cottage cat
  makeCat() {
    const x = COTTAGE.x + 46;
    const y = COTTAGE.y + 12;
    this.w.shadow(x + 2, y - 2, 40, 0.7);
    this.catTail = this.img(x + 9, y - 5, 'cattail', 1.25).setOrigin(0.08, 0.85).setDepth(y - 0.5);
    this.cat = this.img(x, y, 'cat', 1.25).setOrigin(0.5, 1).setDepth(y);
    this.catHome = [x, y];
    this.w.solidCircle(x, y - 7, 12);
    this.hearts = this.w.add.particles(0, 0, ATLAS, {
      frame: 'heart', speed: { min: 18, max: 45 }, angle: { min: 245, max: 295 }, gravityY: -15,
      lifespan: 1300, scale: { start: 0.55, end: 0.25 }, alpha: { values: [0, 1, 1, 0] } as any, emitting: false,
    } as any).setDepth(9000);
    const lines = [
      'The cat purrs and leans into your hand.',
      'A slow blink. You have been accepted.',
      'Mrrp! The cat seems very pleased with itself.',
      'The cat kneads the warm stone step.',
    ];
    this.w.interactables.push({
      x, y, r: 54, label: 'Pet', promptY: 56, approach: [38, 14], enabled: () => true,
      action: () => { void lines; this.petCat(); },
    });
  }

  updateCat(t: number, dt: number) {
    this.catSwish = Math.max(0, this.catSwish - dt);
    // Following you: trot a little behind, then wander home.
    const [hx, hy] = this.catHome;
    let tx = hx, ty = hy;
    if (this.catFollow > 0) {
      this.catFollow -= dt;
      tx = this.w.feet.x - (this.w.flip ? -34 : 34); ty = this.w.feet.y + 6;
    }
    const dx = tx - this.cat.x, dy = ty - this.cat.y, d = Math.hypot(dx, dy);
    if (d > 6 && !this.catRolling) {
      const sp = Math.min(this.catFollow > 0 ? 190 : 70, d * 3);
      this.cat.x += dx / d * sp * dt; this.cat.y += dy / d * sp * dt;
      this.cat.setFlipX(dx < 0).setDepth(this.cat.y);
      this.cat.y += Math.abs(Math.sin(t * 12)) * 0.6 - 0.3;
    }
    this.catTail.setPosition(this.cat.x + (this.cat.flipX ? -9 : 9), this.cat.y - 5).setFlipX(this.cat.flipX).setDepth(this.cat.y - 0.5).setVisible(!this.catRolling);
    const fast = this.catSwish > 0 ? 1 : 0;
    this.catTail.rotation = -0.15 + Math.sin(t * (1.1 + fast * 4)) * (0.22 + fast * 0.15) + Math.sin(t * 0.37) * 0.1;
  }

  // ------------------------------------------------------------ wind + leaves
  makeLeaves() {
    const tints = [0x9fd36a, 0xc9e27a, 0xf2b45a, 0xe8894a, 0xffd36b];
    this.w.ambient.push(this.w.add.particles(0, 0, ATLAS, {
      frame: 'leafw',
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-200, -200, 1500, 1100) as any },
      lifespan: 7000, frequency: 600,
      speedX: { min: 6, max: 24 }, speedY: { min: 10, max: 22 },
      rotate: { start: 0, end: 540, random: true } as any,
      scale: { min: 0.22, max: 0.32 },
      alpha: { values: [0, 0.95, 0.95, 0] } as any,
      tint: tints,
    } as any).setDepth(8003));
    this.gustLeaves = this.w.add.particles(0, 0, ATLAS, {
      frame: 'leafw', lifespan: 3200, speedX: { min: 130, max: 220 }, speedY: { min: -20, max: 30 },
      rotate: { start: 0, end: 720, random: true } as any, scale: { min: 0.22, max: 0.32 },
      alpha: { values: [0, 1, 1, 0] } as any, tint: tints, emitting: false,
    } as any).setDepth(8004);
  }

  updateWind(time: number, dt: number) {
    if (this.gustX === null && time > this.nextGust) {
      this.gustX = this.w.cameras.main.worldView.x - 300;
      this.nextGust = time + rand(14000, 26000);
      sfx.wind(0.9 + Math.random() * 0.4);
    }
    if (this.gustX !== null) {
      this.gustX += 560 * dt;
      const v = this.w.cameras.main.worldView;
      if (this.gustX > v.x - 100 && this.gustX < v.right + 100 && Math.random() < dt * 14) {
        this.gustLeaves.emitParticleAt(this.gustX - rand(0, 80), rand(v.y, v.bottom), 1);
      }
      if (this.gustX > Math.min(WORLD_W + 250, v.right + 400)) this.gustX = null;
    }
  }

  nearCam(x: number, y: number) {
    const v = this.w.cameras.main.worldView;
    return x > v.x - 150 && x < v.right + 150 && y > v.y - 150 && y < v.bottom + 150;
  }

  update(time: number, dt: number) {
    const t = time / 1000;
    this.updateFlies(t, dt);
    this.updateBirds(t, dt);
    if (this.nearCam(POND.x, POND.y)) {
      this.updateDucks(time, t, dt);
      this.updateFish(time, dt);
      this.updateFrog(time);
    }
    this.updateCat(t, dt);
    this.updateWind(time, dt);
    this.creatures.update(time, dt);
    if (time > this.nextFlock) { this.nextFlock = time + rand(20000, 38000); this.spawnFlock(); }
  }
}
