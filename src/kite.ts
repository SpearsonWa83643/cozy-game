// 32: windy-day kite. On Fall windy days your hero flies a little kite on a string; tap it for a
// loop-de-loop with sparkles. It flutters down and away when the wind settles. Visual only.
import Phaser from 'phaser';
import { atlasOf, frameScale } from './art';
import { sfx } from './audio';
import type { WorldScene } from './scenes/World';

/** Where the kite flies, relative to the hero's hand (downwind is +x), and the loop length (s). */
const OFF_X = 95, OFF_Y = -150, LOOP_S = 1.1;

export class Kite {
  img: Phaser.GameObjects.Image;
  string: Phaser.GameObjects.Graphics;
  /** Loops so far (test hook). */
  loops = 0;
  /** 0 hidden .. 1 flying. */
  show = 0;
  loopT = -1;
  private x = 0; private y = 0; private t = 0;
  constructor(private w: WorldScene) {
    this.img = w.add.image(0, 0, atlasOf('kite'), 'kite').setOrigin(0.5, 0.3).setScale(1.5 / (frameScale.kite ?? 1)).setDepth(9350).setVisible(false);
    this.string = w.add.graphics().setDepth(9340);
    w.tappables.push({
      x: () => this.img.x, y: () => this.img.y + 8, r: 46,
      enabled: () => this.show > 0.6,
      tap: () => this.loop(),
    });
  }

  /** Flying when the Fall wind blows and the hero is on foot (not riding, boating, fishing or building). */
  get windy() {
    const w = this.w, v = w.village;
    if (!v || v.rain <= 0 || v.weather.kind !== 'wind') return false;
    return !(w.mount?.riding || w.mount?.carrying || w.boat?.active || w.boat?.hopping || w.fishing?.active || v.building);
  }

  loop() {
    if (this.loopT >= 0 && this.loopT < 0.8) return;
    this.loopT = 0; this.loops++;
    sfx.whistle(); sfx.giggle();
    this.w.burst(this.img.x, this.img.y, 0xffd36e, 10, 'spark');
    if (this.w.life) this.w.life.reactions++;
  }

  update(dt: number) {
    const w = this.w, want = this.windy ? 1 : 0;
    const hx = w.feet.x + 8, hy = w.feet.y - 34;
    if (this.show === 0 && want) { this.x = hx + 20; this.y = hy - 10; } // launch from the hand
    this.show = want ? Math.min(1, this.show + dt / 1.2) : Math.max(0, this.show - dt / 1.5);
    const vis = this.show > 0;
    this.img.setVisible(vis);
    this.string.clear();
    if (!vis) { this.loopT = -1; return; }
    this.t += dt;
    // Climb in when the wind starts; drift down and away (downwind) when it stops.
    const up = want ? Phaser.Math.Easing.Sine.Out(this.show) : 1;
    const away = want ? 0 : (1 - this.show);
    let tx = hx + OFF_X * up + away * 160 + Math.sin(this.t * 1.3) * 14;
    let ty = hy + OFF_Y * up + away * 90 + Math.sin(this.t * 2.1) * 9;
    let rot = Math.sin(this.t * 2.4) * 0.22 + 0.25;
    if (this.loopT >= 0) {
      this.loopT += dt / LOOP_S;
      const a = Math.min(1, this.loopT) * Math.PI * 2;
      tx += Math.sin(a) * 34; ty -= (1 - Math.cos(a)) * 34; rot += a;
      if (this.loopT >= 1) this.loopT = -1;
    }
    const k = Math.min(1, dt * 6);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    this.img.setPosition(this.x, this.y).setRotation(rot).setAlpha(Math.min(1, this.show * 1.5));
    // A gently sagging string from the hand to the kite.
    const g = this.string;
    g.lineStyle(1.4, 0xfdf6e3, 0.85 * this.img.alpha);
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(hx, hy), new Phaser.Math.Vector2((hx + this.x) / 2 + 20, (hy + this.y) / 2 + 30), new Phaser.Math.Vector2(this.x, this.y));
    curve.draw(g, 16);
  }
}
