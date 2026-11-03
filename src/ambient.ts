// 68: the world feels alive across the 4x map. Villagers and critters stroll the trails between
// regions, butterflies flutter over the meadow and hills, soft clouds drift over with their shadows,
// and each region has its own little sounds. Cheap on the iPad: fixed pools (nothing is created per
// frame), anything off-screen is hidden and skips its animation.
import Phaser from 'phaser';
import { atlasOf, frameScale, sampleSpline, S } from './art';
import {
  PATH_MEADOW, PATH_MEADOW_HILLS, PATH_HILLS, PATH_HILLS_BAY, PATH_BAY, PATH_GROVE, PATH_SHORE_S, PATH_FOREST, PATH_ORCHARD_S,
  WORLD_W, WORLD_H, OLD_W, OLD_H,
} from './layout';
import { areaAt, waterAt } from './geo';
import { sfx } from './audio';
import type { WorldScene } from './scenes/World';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Walker = {
  img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image;
  pts: [number, number][]; cum: number[]; len: number; s: number; i: number; dir: 1 | -1; speed: number;
  pause: number; nextPause: number; kind: 'vil' | 'rabbit' | 'hedgehog'; vil: number; frame: number; stepT: number;
  base: number; hop: number; x: number; y: number; on: boolean;
};
type Fly = { img: Phaser.GameObjects.Image; x: number; y: number; tx: number; ty: number; retarget: number; phase: number; base: number; on: boolean };
type Puff = { cloud: Phaser.GameObjects.Image; shade: Phaser.GameObjects.Image; x: number; y: number; on: boolean };

/** Trails the travellers stroll (each walks one end to the other and back, pausing now and then). */
const ROUTES: { path: [number, number][]; kind: Walker['kind']; vil?: number; at: number }[] = [
  { path: PATH_MEADOW, kind: 'vil', vil: 0, at: 0.55 },
  { path: PATH_MEADOW_HILLS, kind: 'vil', vil: 1, at: 0.3 },
  { path: PATH_HILLS, kind: 'vil', vil: 2, at: 0.6 },
  { path: PATH_HILLS_BAY, kind: 'vil', vil: 3, at: 0.5 },
  { path: PATH_BAY, kind: 'vil', vil: 4, at: 0.7 },
  { path: PATH_GROVE, kind: 'vil', vil: 5, at: 0.55 },
  { path: PATH_FOREST, kind: 'vil', vil: 3, at: 0.4 },
  { path: PATH_ORCHARD_S, kind: 'rabbit', at: 0.5 },
  { path: PATH_SHORE_S, kind: 'rabbit', at: 0.4 },
  { path: PATH_HILLS, kind: 'hedgehog', at: 0.25 },
  { path: PATH_MEADOW, kind: 'rabbit', at: 0.2 },
  { path: PATH_BAY, kind: 'hedgehog', at: 0.35 },
];
const FLY_TINTS = [0xffd36b, 0xffa6c9, 0xa6d8ff, 0xffffff, 0xffc27a, 0xc9b6ff, 0xb8f0a0];

/** Region sound palette: [kind, min gap s, max gap s]. */
type Snd = Parameters<typeof sfx.ambience>[0];
const SOUNDS: Partial<Record<string, [Snd, number, number][]>> = {
  glade: [['birds', 9, 18]],
  river: [['drops', 10, 20], ['birds', 12, 22]],
  forest: [['woodpecker', 14, 26], ['owl', 22, 40]],
  orchard: [['birds', 8, 16], ['buzz', 16, 30]],
  lake: [['drops', 12, 22], ['waves', 14, 26]],
  meadow: [['buzz', 7, 14], ['birds', 10, 20], ['crickets', 18, 30]],
  hills: [['breeze', 14, 24], ['cuckoo', 18, 34], ['birds', 16, 28]],
  grove: [['crickets', 6, 11], ['chimes', 16, 28], ['owl', 20, 36]],
  bay: [['waves', 5, 8], ['gull', 9, 18]],
};

export class Ambient {
  walkers: Walker[] = [];
  flies: Fly[] = [];
  puffs: Puff[] = [];
  /** Sounds played so far (per kind), for the test hook. */
  played: Record<string, number> = {};
  /** Sounds due so far (played or not: audio may still be locked), per region. */
  due: Record<string, number> = {};
  lastSound = '';
  private soundAt: Record<string, number> = {};
  private flyActive = false;
  private t = 0;

  constructor(private w: WorldScene) {
    for (const r of ROUTES) this.addWalker(r.path, r.kind, r.vil ?? 0, r.at);
    for (let i = 0; i < 8; i++) this.addFly(i);
    for (let i = 0; i < 4; i++) this.addPuff(i);
  }

  private inView(x: number, y: number, m = 160) {
    const v = this.w.cameras.main.worldView;
    return x > v.x - m && x < v.right + m && y > v.y - m && y < v.bottom + m;
  }

  // ------------------------------------------------------------ travellers
  private addWalker(path: [number, number][], kind: Walker['kind'], vil: number, at: number) {
    const pts = sampleSpline(path, 10), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[cum.length - 1];
    const key = kind === 'vil' ? `vil${vil}_0` : kind === 'rabbit' ? 'rabbit_sit' : 'hedgehog';
    const sc = kind === 'vil' ? 0.62 : kind === 'rabbit' ? 1.1 : 1;
    const img = this.w.add.image(0, 0, atlasOf(key), key).setOrigin(0.5, 1).setScale(sc / (frameScale[key] ?? S)).setVisible(false);
    const shadow = this.w.add.image(0, 0, atlasOf('shadow'), 'shadow').setScale((kind === 'vil' ? 0.45 : 0.36) / (frameScale.shadow ?? 1)).setAlpha(0.45).setDepth(-470).setVisible(false);
    const wk: Walker = {
      img, shadow, pts, cum, len, s: len * at, i: 0, dir: Math.random() < 0.5 ? 1 : -1,
      speed: kind === 'vil' ? rand(38, 48) : kind === 'rabbit' ? rand(50, 62) : rand(18, 24),
      pause: 0, nextPause: rand(12, 30), kind, vil, frame: 0, stepT: 0, base: img.scaleX, hop: 0, x: 0, y: 0, on: false,
    };
    this.place(wk);
    this.walkers.push(wk);
    // Say hello: they stop, hop and giggle (soft, so real interactables win a tap).
    this.w.tappables.push({
      x: () => wk.x, y: () => wk.y - 30, r: 34, soft: true, enabled: () => wk.on,
      tap: () => {
        this.w.life.reactions++; wk.pause = Math.max(wk.pause, 2.5); wk.hop = 1;
        if (wk.kind === 'vil') sfx.giggleSoft(1 + wk.vil * 0.05); else sfx.blip();
        this.w.burst(wk.x, wk.y - 50, 0xffe08a, 6, 'spark');
      },
    });
  }

  private place(wk: Walker) {
    const { pts, cum } = wk;
    let i = Math.min(Math.max(wk.i, 0), pts.length - 2);
    while (i < pts.length - 2 && cum[i + 1] < wk.s) i++;
    while (i > 0 && cum[i] > wk.s) i--;
    wk.i = i;
    const seg = cum[i + 1] - cum[i] || 1, k = (wk.s - cum[i]) / seg;
    wk.x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k;
    wk.y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k + 6; // walk just off the centre line
    return pts[i + 1][0] - pts[i][0];
  }

  private updateWalkers(dt: number) {
    for (const wk of this.walkers) {
      let moving = false, dx = 0;
      if (wk.pause > 0) wk.pause -= dt;
      else {
        wk.s += wk.dir * wk.speed * dt;
        if (wk.s <= 0 || wk.s >= wk.len) { wk.s = Phaser.Math.Clamp(wk.s, 0, wk.len); wk.dir = wk.dir > 0 ? -1 : 1; wk.pause = rand(3, 6); }
        wk.nextPause -= dt;
        if (wk.nextPause <= 0) { wk.nextPause = rand(14, 34); wk.pause = rand(1.5, 3.5); }
        dx = this.place(wk) * wk.dir; moving = true;
      }
      const on = this.inView(wk.x, wk.y);
      if (on !== wk.on) { wk.on = on; wk.img.setVisible(on); wk.shadow.setVisible(on); }
      if (!on) continue;
      let lift = 0;
      if (wk.hop > 0) { wk.hop = Math.max(0, wk.hop - dt * 2.2); lift = Math.sin(wk.hop * Math.PI) * 16; }
      if (moving) {
        wk.stepT += dt;
        if (wk.kind === 'vil') {
          if (wk.stepT > 0.2) { wk.stepT = 0; wk.frame ^= 1; wk.img.setFrame(`vil${wk.vil}_${wk.frame}`); }
          if (dx) wk.img.setFlipX(dx < 0);
          lift += Math.abs(Math.sin(this.t * 9 + wk.vil)) * 1.5;
        } else if (wk.kind === 'rabbit') {
          // Hop, hop, pause-ish rhythm.
          const ph = (this.t * 2.2 + wk.vil) % 1;
          const up = ph < 0.45;
          if (up !== (wk.frame === 1)) { wk.frame = up ? 1 : 0; wk.img.setFrame(up ? 'rabbit_hop' : 'rabbit_sit'); }
          if (up) lift += Math.sin((ph / 0.45) * Math.PI) * 12;
          if (dx) wk.img.setFlipX(dx > 0);
        } else {
          if (dx) wk.img.setFlipX(dx > 0);
          wk.img.scaleY = wk.base * (1 + Math.sin(this.t * 14) * 0.04);
        }
      } else if (wk.kind === 'rabbit' && wk.frame === 1) { wk.frame = 0; wk.img.setFrame('rabbit_sit'); }
      wk.img.setPosition(wk.x, wk.y - lift).setDepth(wk.y);
      wk.shadow.setPosition(wk.x, wk.y + 1).setAlpha(0.45 - lift * 0.01);
    }
  }

  // ------------------------------------------------------------ butterflies (meadow, hills, orchard)
  private addFly(i: number) {
    const img = this.w.fx(0, 0, 'butterfly', 1.4).setTint(FLY_TINTS[i % FLY_TINTS.length]).setDepth(7000).setVisible(false);
    this.flies.push({ img, x: 0, y: 0, tx: 0, ty: 0, retarget: 0, phase: Math.random() * 10, base: img.scaleX, on: false });
  }
  private flyHere(x: number, y: number) {
    const a = areaAt(x, y);
    return (a === 'meadow' || a === 'hills' || a === 'orchard' || a === 'bay' || a === 'grove') && !waterAt(x, y);
  }
  private updateFlies(dt: number) {
    const v = this.w.cameras.main.worldView;
    const cx = v.centerX, cy = v.centerY;
    const active = this.flyHere(cx, cy) && (cx > OLD_W - 600 || cy > OLD_H - 400 || areaAt(cx, cy) === 'orchard');
    if (!active && this.flyActive) for (const f of this.flies) { f.on = false; f.img.setVisible(false); }
    this.flyActive = active;
    if (!active) return;
    for (const f of this.flies) {
      if (!f.on || !this.inView(f.x, f.y, 300)) {
        // (Re)spawn somewhere on screen that suits butterflies.
        const x = rand(v.x + 40, v.right - 40), y = rand(v.y + 60, v.bottom - 40);
        if (!this.flyHere(x, y)) { f.on = false; f.img.setVisible(false); continue; }
        f.x = x; f.y = y; f.tx = x; f.ty = y; f.retarget = 0; f.on = true; f.img.setVisible(true).setAlpha(0);
      }
      f.retarget -= dt;
      if (f.retarget <= 0) {
        f.retarget = rand(1.2, 3);
        f.tx = Phaser.Math.Clamp(f.x + rand(-160, 160), 20, WORLD_W - 20);
        f.ty = Phaser.Math.Clamp(f.y + rand(-110, 110), 20, WORLD_H - 20);
      }
      const k = Math.min(1, dt * 0.9);
      f.x += (f.tx - f.x) * k; f.y += (f.ty - f.y) * k;
      const flap = Math.abs(Math.sin(this.t * 13 + f.phase));
      f.img.setPosition(f.x + Math.sin(this.t * 2.1 + f.phase) * 10, f.y + Math.sin(this.t * 3.3 + f.phase) * 8);
      f.img.scaleX = f.base * (0.3 + 0.7 * flap);
      f.img.setFlipX(f.tx < f.x);
      if (f.img.alpha < 1) f.img.setAlpha(Math.min(1, f.img.alpha + dt * 1.5));
    }
  }

  // ------------------------------------------------------------ sky: a few soft clouds overhead, with their shadows
  private addPuff(i: number) {
    const sc = rand(2.2, 3.2);
    const cloud = this.w.fx(0, 0, 'cloud', sc).setTint(0xffffff).setTintMode(Phaser.TintModes.FILL).setAlpha(0.2).setDepth(9700).setVisible(false);
    const shade = this.w.fx(0, 0, 'cloud', sc * 0.9).setTint(0x1c2a3a).setAlpha(0.12).setDepth(8400).setVisible(false);
    const v = this.w.cameras.main.worldView;
    this.puffs.push({ cloud, shade, x: v.x + (i / 4) * v.width * 1.6 - v.width * 0.3, y: v.y + rand(0, v.height), on: false });
  }
  private updatePuffs(dt: number) {
    const v = this.w.cameras.main.worldView;
    for (const p of this.puffs) {
      p.x += dt * 16; p.y += dt * 4;
      const r = 260 * p.cloud.scaleX / 2.5;
      // Wrap around the view so there's always a cloud or two drifting through, never a crowd.
      if (p.x - r > v.right + 300 || p.x + r < v.x - 900 || p.y - r > v.bottom + 300 || p.y + r < v.y - 700) {
        p.x = v.x - r - rand(100, 700); p.y = rand(v.y - 100, v.bottom - 100);
      }
      // The shadow lands below-right of the cloud (sun high in the north-west).
      const on = this.inView(p.x, p.y, r + 300);
      if (on !== p.on) { p.on = on; p.cloud.setVisible(on); p.shade.setVisible(on); }
      if (!on) continue;
      p.cloud.setPosition(p.x, p.y);
      p.shade.setPosition(p.x + 140, p.y + 260);
    }
  }

  // ------------------------------------------------------------ sounds per region
  private updateSounds() {
    const area = this.w.area;
    const set = SOUNDS[area];
    if (!set) return;
    const now = this.t;
    for (const [kind, a, b] of set) {
      const key = `${area}:${kind}`;
      if (this.soundAt[key] === undefined) { this.soundAt[key] = now + rand(1, a); continue; }
      if (now < this.soundAt[key]) continue;
      this.soundAt[key] = now + rand(a, b);
      this.due[area] = (this.due[area] ?? 0) + 1;
      if (sfx.ambience(kind)) { this.played[kind] = (this.played[kind] ?? 0) + 1; this.lastSound = kind; }
    }
  }

  update(_time: number, dt: number) {
    this.t += dt;
    this.updateWalkers(dt);
    this.updateFlies(dt);
    this.updatePuffs(dt);
    this.updateSounds();
  }

  /** Test hook: what's out and about right now. */
  stats() {
    return {
      walkers: this.walkers.length,
      walkersOnScreen: this.walkers.filter((w) => w.on).length,
      walkerPos: this.walkers.map((w) => [Math.round(w.x), Math.round(w.y), w.kind, w.on ? 1 : 0] as const),
      flies: this.flies.filter((f) => f.on).length,
      puffs: this.puffs.filter((p) => p.on).length,
      played: { ...this.played }, due: { ...this.due }, lastSound: this.lastSound,
      objects: this.walkers.length * 2 + this.flies.length + this.puffs.length * 2,
    };
  }
}
