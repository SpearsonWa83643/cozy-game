// Creatures of the wider world: rabbits, squirrels, hedgehogs, deer, crabs, an owl, sparrows,
// beetles. Each one reacts to taps. Updates are skipped when far from the camera.
import Phaser from 'phaser';
import { ATLAS, frameScale, S } from './art';
import { LAKE, OWL } from './layout';
import { sfx } from './audio';
import { waterBlocks, lakeValue } from './geo';
import type { WorldScene } from './scenes/World';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Base = { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; hx: number; hy: number; x: number; y: number; t: number; busy: boolean; follow?: number; slot?: number };
type Rabbit = Base & { temp?: boolean; life?: number };
type Squirrel = Base & { tx: number; ty: number; hidden: number };
type Hedgehog = Base & { ball: number; tx: number; ty: number };
type Deer = Base & { state: 'graze' | 'alert' | 'flee'; vx: number; vy: number };
type Crab = Base & { dir: number; hidden: number };
type Sparrow = Base & { flying: boolean; vx: number; vy: number; respawn: number };

export class Creatures {
  rabbits: Rabbit[] = [];
  squirrels: Squirrel[] = [];
  hedgehogs: Hedgehog[] = [];
  deer: Deer[] = [];
  crabs: Crab[] = [];
  sparrows: Sparrow[] = [];
  owl!: Phaser.GameObjects.Image;
  owlBlink = 3000;
  beetles: { img: Phaser.GameObjects.Image; vx: number; vy: number; life: number }[] = [];

  constructor(private w: WorldScene, private onReact: () => void) {
    for (const [x, y] of [[330, 1110], [1520, 1320], [2800, 1700], [3380, 2420], [620, 1760], [4000, 2600]]) this.addRabbit(x, y);
    for (const [x, y] of [[2700, 420], [3050, 980], [3700, 300], [4100, 760], [1500, 420]]) this.addSquirrel(x, y);
    for (const [x, y] of [[420, 1020], [3100, 2620], [2120, 1300]]) this.addHedgehog(x, y);
    for (const [x, y] of [[3900, 1060], [3820, 1130], [4150, 1720]]) this.addDeer(x, y);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.1 + i * 0.17);
      this.addCrab(LAKE.x + Math.cos(a) * LAKE.rx * 1.08, LAKE.y + Math.sin(a) * LAKE.ry * 1.08);
    }
    for (const [x, y] of [[1200, 1050], [600, 1300], [2900, 1600], [3600, 2650], [1400, 1750], [2110, 900]]) for (let k = 0; k < 3; k++) this.addSparrow(x + rand(-30, 30), y + rand(-20, 20));
    this.addOwl();
  }

  private sprite(x: number, y: number, key: string, scale = 1) {
    return this.w.add.image(x, y, ATLAS, key).setOrigin(0.5, 1).setScale(scale / (frameScale[key] ?? S)).setDepth(y);
  }
  private shadowAt(x: number, y: number, w: number) {
    return this.w.add.image(x, y, ATLAS, 'shadow').setScale(w / 64 / (frameScale.shadow ?? 1)).setAlpha(0.6).setDepth(-450);
  }
  private near(x: number, y: number, m = 200) {
    const v = this.w.cameras.main.worldView;
    return x > v.x - m && x < v.right + m && y > v.y - m && y < v.bottom + m;
  }
  private player() { return [this.w.feet.x, this.w.feet.y] as const; }
  /** Fed animals become friends and trot after you for a little while. */
  friends = 0;
  befriend(c: Base, secs = 10) { c.follow = secs; c.slot = this.friends++ % 4; }
  followers() { return [...this.rabbits, ...this.squirrels, ...this.hedgehogs, ...this.deer].filter((c) => (c.follow ?? 0) > 0).length; }
  private following(c: Base, dt: number, speed = 120, hop = 6) {
    if (!c.follow || c.follow <= 0) return false;
    c.follow -= dt;
    if (c.busy) return true;
    if (c.follow <= 0) { c.hx = c.x; c.hy = c.y; return false; }  // settle where they are
    const [px, py] = this.player();
    const side = (c.slot ?? 0) % 2 ? 1 : -1, back = 1 + Math.floor((c.slot ?? 0) / 2);
    const tx = px + side * 44 * back, ty = py + 18 + back * 6;
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    if (d > 8) {
      const sp = Math.min(speed, d * 3) * dt;
      const nx = c.x + dx / d * sp, ny = c.y + dy / d * sp;
      if (!waterBlocks(nx, ny)) { c.x = nx; c.y = ny; }
      c.img.setFlipX(dx > 0);
      this.place(c);
      c.img.y -= Math.abs(Math.sin(this.w.time.now / 110)) * hop;
    }
    return true;
  }
  private place(c: Base) {
    c.img.setPosition(c.x, c.y).setDepth(c.y);
    c.shadow.setPosition(c.x, c.y - 1);
  }
  private hopTo(c: Base, x: number, y: number, dur: number, frameHop: string, frameRest: string, height = 8, then?: () => void) {
    if (waterBlocks(x, y)) { x = c.x; y = c.y; }
    c.busy = true;
    c.img.setTexture(ATLAS, frameHop).setFlipX(x > c.x);
    const x0 = c.x, y0 = c.y;
    this.w.tweens.addCounter({
      from: 0, to: 1, duration: dur, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        c.x = x0 + (x - x0) * p; c.y = y0 + (y - y0) * p;
        this.place(c);
        c.img.y -= Math.sin(p * Math.PI) * height;
      },
      onComplete: () => { c.busy = false; c.img.setTexture(ATLAS, frameRest); if (then) then(); },
    });
  }

  // ------------------------------------------------------------ rabbits
  addRabbit(x: number, y: number, temp = false) {
    const r: Rabbit = { img: this.sprite(x, y, 'rabbit_sit', 1.1), shadow: this.shadowAt(x, y, 22), hx: x, hy: y, x, y, t: rand(1000, 4000), busy: false, temp, life: temp ? 3.2 : undefined };
    this.rabbits.push(r);
    if (!temp) {
      this.w.tappables.push({
        x: () => r.x, y: () => r.y - 10, r: 26, enabled: () => !r.busy,
        tap: () => { sfx.thump(); this.onReact(); this.w.floatText(r.x, r.y - 30, '!'); this.flee(r, 3); },
        feed: () => { this.onReact(); r.img.setTexture(ATLAS, 'rabbit_sit'); this.befriend(r); },
      });
    }
    return r;
  }
  rabbitFrom(x: number, y: number) {
    const r = this.addRabbit(x, y + 6, true);
    r.img.setAlpha(0);
    this.w.tweens.add({ targets: r.img, alpha: 1, duration: 150 });
    sfx.thump();
    this.flee(r, 3);
  }
  private flee(r: Rabbit, hops: number) {
    const [px, py] = this.player();
    let a = Math.atan2(r.y - py, r.x - px) + rand(-0.5, 0.5);
    if (Math.hypot(r.x - px, r.y - py) < 1) a = rand(0, Math.PI * 2);
    const step = (n: number) => {
      if (n <= 0) return;
      const nx = r.x + Math.cos(a) * 42, ny = r.y + Math.sin(a) * 30;
      this.hopTo(r, nx, ny, 300, 'rabbit_hop', 'rabbit_sit', 10, () => step(n - 1));
    };
    step(hops);
  }
  private updateRabbits(dt: number) {
    const [px, py] = this.player();
    for (let i = this.rabbits.length - 1; i >= 0; i--) {
      const r = this.rabbits[i];
      if (r.temp) {
        r.life! -= dt;
        if (r.life! < 0.5) r.img.setAlpha(Math.max(0, r.life! * 2)), r.shadow.setAlpha(Math.max(0, r.life!));
        if (r.life! <= 0) { r.img.destroy(); r.shadow.destroy(); this.rabbits.splice(i, 1); }
        continue;
      }
      if (this.following(r, dt, 150, 9)) continue;
      if (r.busy || !this.near(r.x, r.y)) continue;
      if (Math.hypot(r.x - px, r.y - py) < 75) { this.flee(r, 2); continue; }
      r.t -= dt * 1000;
      if (r.t <= 0) {
        r.t = rand(1800, 5000);
        const home = Math.hypot(r.x - r.hx, r.y - r.hy) > 140;
        const a = home ? Math.atan2(r.hy - r.y, r.hx - r.x) : rand(0, Math.PI * 2);
        this.hopTo(r, r.x + Math.cos(a) * 34, r.y + Math.sin(a) * 24, 320, 'rabbit_hop', 'rabbit_sit', 8);
      } else if (Math.random() < dt * 0.6) {
        this.w.tweens.add({ targets: r.img, scaleY: r.img.scaleY * 0.94, duration: 90, yoyo: true });
      }
    }
  }

  // ------------------------------------------------------------ squirrels
  addSquirrel(x: number, y: number) {
    const s: Squirrel = { img: this.sprite(x, y, 'squirrel', 1), shadow: this.shadowAt(x, y, 18), hx: x, hy: y, x, y, t: rand(500, 2500), busy: false, tx: x, ty: y, hidden: 0 };
    this.squirrels.push(s);
    this.w.tappables.push({
      x: () => s.x, y: () => s.y - 10, r: 26, enabled: () => !s.busy && s.hidden <= 0,
      feed: () => { this.onReact(); sfx.chirp(); this.befriend(s); },
      tap: () => {
        this.onReact();
        sfx.chirp();
        s.busy = true;
        // Scamper up into the canopy, maybe dropping an acorn.
        this.w.tweens.add({
          targets: s.img, y: s.y - 90, alpha: 0, duration: 650, ease: 'Sine.easeIn',
          onComplete: () => {
            s.hidden = rand(5, 9); s.busy = false;
            if (Math.random() < 0.7) this.w.reacts.drop(s.x + rand(-10, 10), s.y - 60, s.y + 6, 'acorn', 'acorn');
          },
        });
        s.shadow.setAlpha(0);
      },
    });
  }
  private updateSquirrels(dt: number) {
    for (const s of this.squirrels) {
      if (s.hidden > 0) {
        s.hidden -= dt;
        if (s.hidden <= 0) {
          s.x = s.hx + rand(-60, 60); s.y = s.hy + rand(-40, 40);
          if (waterBlocks(s.x, s.y)) { s.x = s.hx; s.y = s.hy; }
          this.place(s); s.img.setAlpha(0); s.shadow.setAlpha(0.6);
          this.w.tweens.add({ targets: s.img, alpha: 1, duration: 300 });
        }
        continue;
      }
      if (this.following(s, dt, 140, 5)) continue;
      if (s.busy || !this.near(s.x, s.y)) continue;
      s.t -= dt * 1000;
      if (s.t <= 0) {
        s.t = rand(900, 3200);
        const a = rand(0, Math.PI * 2);
        let nx = s.x + Math.cos(a) * rand(30, 80), ny = s.y + Math.sin(a) * rand(20, 50);
        if (Math.hypot(nx - s.hx, ny - s.hy) > 150) { nx = s.hx; ny = s.hy; }
        this.hopTo(s, nx, ny, 380, 'squirrel', 'squirrel', 4);
      }
    }
  }

  // ------------------------------------------------------------ hedgehogs
  addHedgehog(x: number, y: number) {
    const h: Hedgehog = { img: this.sprite(x, y, 'hedgehog', 1), shadow: this.shadowAt(x, y, 24), hx: x, hy: y, x, y, t: 0, busy: false, ball: 0, tx: x, ty: y };
    this.hedgehogs.push(h);
    this.w.tappables.push({
      x: () => h.x, y: () => h.y - 6, r: 26,
      feed: () => { this.onReact(); h.ball = 0; h.img.setTexture(ATLAS, 'hedgehog'); this.befriend(h); },
      tap: () => {
        this.onReact();
        sfx.tock();
        h.ball = 3.5;
        h.img.setTexture(ATLAS, 'hedgeball');
        this.w.tweens.add({ targets: h.img, y: h.y - 10, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
        this.w.floatText(h.x, h.y - 26, '\u2022\u2022\u2022');
      },
    });
  }
  private updateHedgehogs(dt: number) {
    const [px, py] = this.player();
    for (const h of this.hedgehogs) {
      if (this.following(h, dt, 100, 2)) { h.tx = h.x; h.ty = h.y; continue; }
      if (!this.near(h.x, h.y)) continue;
      if (h.ball > 0) {
        h.ball -= dt;
        if (h.ball <= 0) h.img.setTexture(ATLAS, 'hedgehog');
        continue;
      }
      if (Math.hypot(h.x - px, h.y - py) < 40) { h.ball = 2.5; h.img.setTexture(ATLAS, 'hedgeball'); continue; }
      const d = Math.hypot(h.tx - h.x, h.ty - h.y);
      if (d < 4) { h.tx = h.hx + rand(-80, 80); h.ty = h.hy + rand(-50, 50); if (waterBlocks(h.tx, h.ty)) { h.tx = h.hx; h.ty = h.hy; } continue; }
      h.x += (h.tx - h.x) / d * 14 * dt; h.y += (h.ty - h.y) / d * 14 * dt;
      h.img.setFlipX(h.tx > h.x);
      this.place(h);
      h.img.y -= Math.abs(Math.sin(this.w.time.now / 90)) * 0.8;
    }
  }

  // ------------------------------------------------------------ deer
  addDeer(x: number, y: number) {
    const d: Deer = { img: this.sprite(x, y, 'deer_graze', 1.15), shadow: this.shadowAt(x, y, 56), hx: x, hy: y, x, y, t: rand(0, 3), busy: false, state: 'graze', vx: 0, vy: 0 };
    this.deer.push(d);
    this.w.tappables.push({
      x: () => d.x, y: () => d.y - 26, r: 40,
      feed: () => { this.onReact(); d.state = 'graze'; d.img.setTexture(ATLAS, 'deer_graze'); this.befriend(d); },
      tap: () => {
        this.onReact();
        d.state = 'alert'; d.t = 3.5;
        d.img.setTexture(ATLAS, 'deer_alert');
        this.w.tweens.add({ targets: d.img, scaleX: d.img.scaleX * 1.04, duration: 120, yoyo: true, repeat: 1 });
        if (Math.hypot(d.x - this.w.feet.x, d.y - this.w.feet.y) < 200) this.deerFlee(d);
        else this.w.floatText(d.x, d.y - 66, '?');
      },
    });
  }
  private deerFlee(d: Deer) {
    const [px, py] = this.player();
    const a = Math.atan2(d.y - py, d.x - px) + rand(-0.4, 0.4);
    d.state = 'flee'; d.t = 1.6;
    d.vx = Math.cos(a) * 190; d.vy = Math.sin(a) * 130;
    d.img.setTexture(ATLAS, 'deer_alert').setFlipX(d.vx > 0);
    sfx.thump();
  }
  private updateDeer(dt: number, t: number) {
    const [px, py] = this.player();
    for (const d of this.deer) {
      if (this.following(d, dt, 160, 4)) { d.state = 'graze'; if (!d.follow || d.follow <= 0) { d.hx = d.x; d.hy = d.y; } continue; }
      if (!this.near(d.x, d.y, 300)) continue;
      const dist = Math.hypot(d.x - px, d.y - py);
      if (d.state === 'flee') {
        d.t -= dt;
        const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
        if (!waterBlocks(nx, ny) && Math.hypot(nx - d.hx, ny - d.hy) < 420) { d.x = nx; d.y = ny; } else { d.vx *= -0.5; d.vy *= -0.5; }
        this.place(d);
        d.img.y -= Math.abs(Math.sin(t * 9)) * 9;
        if (d.t <= 0) { d.state = 'alert'; d.t = 2.5; }
        continue;
      }
      if (dist < 110) { this.deerFlee(d); continue; }
      if (dist < 230 && d.state === 'graze') { d.state = 'alert'; d.t = 2.5; d.img.setTexture(ATLAS, 'deer_alert').setFlipX(px > d.x); }
      d.t -= dt;
      if (d.state === 'alert' && d.t <= 0 && dist > 230) { d.state = 'graze'; d.img.setTexture(ATLAS, 'deer_graze'); }
      if (d.state === 'graze') {
        // Drift slowly back home while grazing.
        const hd = Math.hypot(d.hx - d.x, d.hy - d.y);
        if (hd > 30) { d.x += (d.hx - d.x) / hd * 10 * dt; d.y += (d.hy - d.y) / hd * 10 * dt; d.img.setFlipX(d.hx > d.x); this.place(d); }
        d.img.y = d.y + Math.sin(t * 2 + d.hx) * 0.6;
      }
    }
  }

  // ------------------------------------------------------------ crabs
  addCrab(x: number, y: number) {
    const c: Crab = { img: this.sprite(x, y, 'crab', 1), shadow: this.shadowAt(x, y, 20), hx: x, hy: y, x, y, t: rand(0, 3), busy: false, dir: Math.random() < 0.5 ? -1 : 1, hidden: 0 };
    this.crabs.push(c);
    this.w.tappables.push({
      x: () => c.x, y: () => c.y - 6, r: 24, enabled: () => c.hidden <= 0 && !c.busy,
      feed: () => { this.onReact(); this.w.tweens.add({ targets: c.img, angle: { from: -12, to: 12 }, duration: 120, yoyo: true, repeat: 3, onComplete: () => c.img.setAngle(0) }); },
      tap: () => {
        this.onReact();
        sfx.dig();
        c.busy = true;
        this.w.burst(c.x, c.y - 2, 0xe8d3a6, 10, 'dot');
        this.w.tweens.add({ targets: c.img, scaleY: 0, duration: 380, ease: 'Back.easeIn', onComplete: () => { c.busy = false; c.hidden = rand(3, 6); c.img.setAlpha(0); c.shadow.setAlpha(0); } });
      },
    });
  }
  private updateCrabs(dt: number, t: number) {
    for (const c of this.crabs) {
      if (!this.near(c.x, c.y)) continue;
      if (c.hidden > 0) {
        c.hidden -= dt;
        if (c.hidden <= 0) {
          const a = rand(Math.PI * 1.05, Math.PI * 1.95);
          c.x = LAKE.x + Math.cos(a) * LAKE.rx * 1.08; c.y = LAKE.y + Math.sin(a) * LAKE.ry * 1.08;
          c.hx = c.x; c.hy = c.y;
          c.img.setAlpha(1).setScale(1 / (frameScale.crab ?? S)); c.shadow.setAlpha(0.6);
          this.place(c);
          this.w.burst(c.x, c.y - 2, 0xe8d3a6, 6, 'dot');
        }
        continue;
      }
      if (c.busy) continue;
      c.t -= dt;
      if (c.t <= 0) { c.t = rand(1.5, 4); c.dir = Math.random() < 0.5 ? -1 : 1; }
      const nx = c.x + c.dir * 22 * dt * (Math.sin(t * 3 + c.hx) > -0.3 ? 1 : 0);
      if (Math.abs(nx - c.hx) < 60 && lakeValue(nx, c.y) > 1.03) c.x = nx; else c.dir *= -1;
      this.place(c);
      c.img.rotation = Math.sin(t * 22) * 0.06;
    }
  }

  // ------------------------------------------------------------ the owl
  addOwl() {
    this.owl = this.sprite(OWL.x, OWL.y, 'owl', 1.1).setDepth(OWL.y + 130);
    this.w.tappables.push({
      x: () => this.owl.x, y: () => this.owl.y - 14, r: 30,
      feed: () => { this.onReact(); sfx.hoot(); this.w.floatText(this.owl.x, this.owl.y - 60, 'hoo! thank you!'); },
      tap: () => {
        this.onReact();
        sfx.hoot();
        this.owl.setFlipX(!this.owl.flipX);
        this.w.tweens.add({ targets: this.owl, angle: this.owl.flipX ? 14 : -14, duration: 220, yoyo: true, ease: 'Sine.easeInOut' });
        this.w.floatText(this.owl.x, this.owl.y - 40, 'hoo-hoo!');
      },
    });
  }
  private updateOwl(dtMs: number) {
    this.owlBlink -= dtMs;
    if (this.owlBlink <= 0) {
      this.owl.setTexture(ATLAS, 'owl_blink');
      this.w.time.delayedCall(160, () => this.owl.setTexture(ATLAS, 'owl'));
      this.owlBlink = rand(2500, 6000);
    }
  }

  // ------------------------------------------------------------ sparrows
  addSparrow(x: number, y: number) {
    const s: Sparrow = { img: this.sprite(x, y, 'sparrow', 1.1), shadow: this.shadowAt(x, y, 12), hx: x, hy: y, x, y, t: rand(0, 2), busy: false, flying: false, vx: 0, vy: 0, respawn: 0 };
    this.sparrows.push(s);
    this.w.tappables.push({
      x: () => s.x, y: () => s.y - 6, r: 30, enabled: () => !s.flying && s.respawn <= 0,
      tap: () => { this.onReact(); this.scare(s.hx, s.hy); },
    });
  }
  sparrowsFrom(x: number, y: number) {
    for (let i = 0; i < 2; i++) {
      const s: Sparrow = { img: this.sprite(x, y, 'sparrow', 1.1), shadow: this.shadowAt(x, y, 12), hx: x, hy: y, x: x + rand(-8, 8), y, t: 0, busy: false, flying: false, vx: 0, vy: 0, respawn: -99 };
      this.sparrows.push(s);
      this.takeOff(s);
    }
    sfx.chirp();
  }
  private scare(hx: number, hy: number) {
    let any = false;
    for (const s of this.sparrows) if (!s.flying && s.respawn <= 0 && Math.hypot(s.hx - hx, s.hy - hy) < 80) { this.takeOff(s); any = true; }
    if (any) sfx.chirp();
  }
  private takeOff(s: Sparrow) {
    s.flying = true;
    const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
    s.vx = Math.cos(a) * rand(120, 170); s.vy = Math.sin(a) * rand(90, 140);
    s.img.setTexture(ATLAS, 'bird').setFlipX(false).setRotation(s.vx > 0 ? Math.PI / 2 : -Math.PI / 2).setDepth(9400);
  }
  private updateSparrows(dt: number, t: number) {
    const [px, py] = this.player();
    for (let i = this.sparrows.length - 1; i >= 0; i--) {
      const s = this.sparrows[i];
      if (s.flying) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy -= 30 * dt;
        s.img.setPosition(s.x, s.y);
        s.img.scaleX = (0.35 + 0.65 * Math.abs(Math.sin(t * 16 + i))) / (frameScale.bird ?? S);
        s.shadow.setPosition(s.x + 20, s.hy).setAlpha(Math.max(0, 0.5 - (s.hy - s.y) / 300));
        if (s.hy - s.y > 600 || !this.near(s.x, s.y, 300)) {
          if (s.respawn === -99) { s.img.destroy(); s.shadow.destroy(); this.sparrows.splice(i, 1); continue; }
          s.flying = false; s.respawn = rand(14, 24); s.img.setVisible(false); s.shadow.setVisible(false);
        }
        continue;
      }
      if (s.respawn > 0) {
        s.respawn -= dt;
        if (s.respawn <= 0) {
          s.x = s.hx; s.y = s.hy;
          s.img.setTexture(ATLAS, 'sparrow').setRotation(0).setScale(1.1 / (frameScale.sparrow ?? S)).setVisible(true).setAlpha(0);
          s.shadow.setVisible(true).setAlpha(0.6);
          this.place(s);
          this.w.tweens.add({ targets: s.img, alpha: 1, duration: 400 });
        }
        continue;
      }
      if (!this.near(s.x, s.y)) continue;
      if (Math.hypot(s.x - px, s.y - py) < 60) { this.scare(s.hx, s.hy); continue; }
      s.t -= dt;
      if (s.t <= 0) {
        s.t = rand(0.4, 1.6);
        if (Math.random() < 0.5) {
          const nx = s.hx + rand(-26, 26), ny = s.hy + rand(-16, 16);
          s.img.setFlipX(nx > s.x);
          this.w.tweens.add({ targets: s, x: nx, y: ny, duration: 180, onUpdate: () => this.place(s) });
        } else {
          this.w.tweens.add({ targets: s.img, angle: s.img.flipX ? 25 : -25, duration: 110, yoyo: true });
        }
      }
    }
  }

  // ------------------------------------------------------------ beetles (from under rocks)
  beetleFrom(x: number, y: number) {
    const img = this.w.add.image(x, y, ATLAS, 'beetle').setScale(1.2 / (frameScale.beetle ?? S)).setDepth(y + 1);
    const a = rand(0, Math.PI * 2);
    this.beetles.push({ img, vx: Math.cos(a) * 38, vy: Math.sin(a) * 26, life: 2.4 });
    img.setRotation(a + Math.PI);
  }
  private updateBeetles(dt: number, t: number) {
    for (let i = this.beetles.length - 1; i >= 0; i--) {
      const b = this.beetles[i];
      b.life -= dt;
      b.img.x += b.vx * dt * (Math.sin(t * 20 + i) > -0.5 ? 1 : 0.2); b.img.y += b.vy * dt;
      b.img.setDepth(b.img.y);
      if (b.life < 0.5) b.img.setAlpha(b.life * 2);
      if (b.life <= 0) { b.img.destroy(); this.beetles.splice(i, 1); }
    }
  }

  update(time: number, dt: number) {
    const t = time / 1000;
    this.updateRabbits(dt);
    this.updateSquirrels(dt);
    this.updateHedgehogs(dt);
    this.updateDeer(dt, t);
    this.updateCrabs(dt, t);
    this.updateSparrows(dt, t);
    this.updateBeetles(dt, t);
    if (this.near(OWL.x, OWL.y)) this.updateOwl(dt * 1000);
  }
}
