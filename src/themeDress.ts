// Applies the active theme to the living world, and re-applies it live when it changes.
import Phaser from 'phaser';
import { atlasOf, frameScale, ALL_PATHS, mulberry32 } from './art';
import { theme, themeEvents, Theme } from './theme';
import { sfx } from './audio';
import { COTTAGE, SHRINE, VILLAGE_SIGN, PIER, POND, WINDMILL, BRIDGES, VILLAGE } from './layout';
import { waterAt } from './geo';
import type { WorldScene } from './scenes/World';

type Orig = { frame: string; tex: string; ox: number; oy: number; sx: number; sy: number };

export class ThemeDresser {
  orig = new Map<Phaser.GameObjects.Image, Orig>();
  sky: Phaser.GameObjects.Image;
  fog: { img: Phaser.GameObjects.Image; ox: number; oy: number; v: number }[] = [];
  props: Phaser.GameObjects.Image[] = [];
  glows: { img: Phaser.GameObjects.Image; base: number; ph: number }[] = [];
  ghosts: { img: Phaser.GameObjects.Image; hx: number; hy: number; ph: number; spin: number }[] = [];
  built = false;

  constructor(private w: WorldScene) {
    this.sky = w.add.image(0, 0, atlasOf('sky_halloween'), 'sky_halloween').setScrollFactor(0).setDepth(8700).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    for (let i = 0; i < 7; i++) {
      const img = w.add.image(0, 0, atlasOf('mist'), 'mist').setDepth(8600).setVisible(false).setScale(5 + Math.random() * 3, 2.5 + Math.random());
      this.fog.push({ img, ox: Math.random() * 1400 - 200, oy: Math.random() * 900, v: 6 + Math.random() * 10 });
    }
    themeEvents.on('change', () => this.apply(true));
    this.apply(false);
  }

  /** Seasonal props + ghost friends are created the first time they are needed. */
  private buildProps() {
    if (this.built) return;
    this.built = true;
    const w = this.w;
    const rng = mulberry32(1031);
    const add = (x: number, y: number, frame: string, scale: number, glow = false) => {
      if (waterAt(x, y, 10) || w.nav.isBlocked(...w.nav.cellOf(x, y))) return;
      const img = w.add.image(x, y, atlasOf(frame), frame).setOrigin(0.5, 1).setScale(scale / (frameScale[frame] ?? 2.5)).setDepth(y);
      this.props.push(img);
      if (glow) {
        const g = w.fx(x, y - 12, 'glow', 0.32).setBlendMode('ADD').setTint(0xffa040).setAlpha(0.6).setDepth(y + 1);
        this.props.push(g);
        this.glows.push({ img: g, base: 0.55, ph: rng() * 6 });
      }
    };
    // Pumpkins along the paths, alternating sides.
    for (const path of ALL_PATHS) {
      for (let i = 6; i < path.length - 2; i += 20 + Math.floor(rng() * 10)) {
        const [x, y] = path[i], [x2, y2] = path[i + 1];
        const a = Math.atan2(y2 - y, x2 - x) + (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        const jack = rng() < 0.45;
        add(x + Math.cos(a) * 44, y + Math.sin(a) * 30, jack ? 'h_jack' : 'h_pumpkin', 0.6 + rng() * 0.3, jack);
      }
    }
    // Candle clusters at cozy spots.
    const spots: [number, number][] = [[COTTAGE.x - 40, COTTAGE.y + 30], [COTTAGE.x + 44, COTTAGE.y + 28], [SHRINE.x - 70, SHRINE.y + 40], [SHRINE.x + 70, SHRINE.y + 40],
      [VILLAGE_SIGN.x - 36, VILLAGE_SIGN.y + 6], [PIER.x - 40, PIER.y0 - 20], [POND.x - 200, POND.y + 150], [WINDMILL.x - 70, WINDMILL.y + 30],
      [BRIDGES.north.x - 150, BRIDGES.north.y + 30], [BRIDGES.south.x - 150, BRIDGES.south.y + 30]];
    for (const [x, y] of spots) for (let k = 0; k < 3; k++) add(x + (k - 1) * 14 + rng() * 4, y + (k % 2) * 6, 'h_candle', 0.5 + rng() * 0.25, k === 1);
    add(COTTAGE.x - 70, COTTAGE.y + 8, 'h_jack', 0.95, true);
    add(COTTAGE.x + 75, COTTAGE.y + 8, 'h_pumpkin', 0.85);
    // Ghost friends: shy, giggly, and they spin when tapped.
    const homes: [number, number][] = [[POND.x - 120, POND.y + 210], [VILLAGE.x + 300, VILLAGE.y + 380], [3300, 900], [3000, 2000], [700, 2000], [1500, 1200]];
    for (const [hx, hy] of homes) {
      const img = w.add.image(hx, hy, atlasOf('h_ghost'), 'h_ghost').setOrigin(0.5, 1).setScale(0.8 / 2.5).setDepth(hy).setAlpha(0.92);
      const g = { img, hx, hy, ph: rng() * 6, spin: 0 };
      this.ghosts.push(g);
      this.props.push(img);
      w.tappables.push({
        x: () => img.x, y: () => img.y - 22, r: 30, enabled: () => img.visible,
        tap: () => {
          g.spin = 1; w.life.reactions++;
          sfx.chirp();
          w.floatText(img.x, img.y - 60, ['Boo!', 'Hee hee!', 'Peekaboo!'][Math.floor(Math.random() * 3)]);
          w.burst(img.x, img.y - 30, 0xe8dcff, 10, 'spark');
        },
      });
    }
  }

  apply(live: boolean) {
    const t: Theme = theme;
    const w = this.w;
    if (t.props) this.buildProps();
    for (const p of this.props) p.setVisible(t.props);
    // Trees: swap round trees for themed ones, tint the rest.
    let i = 0;
    for (const img of w.canopies) {
      i++;
      let o = this.orig.get(img);
      if (!o) { o = { frame: img.frame.name, tex: img.texture.key, ox: img.originX, oy: img.originY, sx: img.scaleX, sy: img.scaleY }; this.orig.set(img, o); }
      const f = o.frame;
      const round = f.startsWith('tree') || f.startsWith('apple');
      if (t.trees && round) {
        const nf = t.trees[(i * 7 + Math.floor(img.x)) % t.trees.length];
        const dw = (img.width * o.sx);
        img.setTexture(atlasOf(nf), nf).setOrigin(0.5, 0.97);
        img.setScale((dw * 1.05) / img.width).clearTint();
      } else {
        if (img.frame.name !== f) img.setTexture(o.tex, f).setOrigin(o.ox, o.oy).setScale(o.sx, o.sy);
        if (t.id === 'halloween') img.setTint(f.startsWith('pine') ? 0x9c88c0 : f.startsWith('birch') ? 0xffc27a : t.foliage ?? 0xffffff);
        else img.clearTint();
      }
    }
    w.reacts.restyleStumps();
    for (const b of w.reacts.foliage) { if (t.foliage) b.setTint(t.foliage); else b.clearTint(); }
    // Sky wash + fog.
    this.sky.setVisible(!!t.sky);
    if (t.sky) this.sky.setTexture(atlasOf(t.sky.frame), t.sky.frame).setAlpha(t.sky.alpha);
    for (const f of this.fog) f.img.setVisible(!!t.fog).setTint(t.fog?.tint ?? 0xffffff).setAlpha(t.fog?.alpha ?? 0);
    // Particles.
    const [pollen, petals] = w.ambient;
    pollen?.updateConfig({ tint: t.particles.pollen } as any);
    if (petals) {
      (petals as any).setTexture(atlasOf(t.particles.petal), t.particles.petal);
      petals.setEmitterFrame(t.particles.petal);
      petals.updateConfig({ tint: t.particles.petalTint ?? 0xffffff, frequency: t.id === 'halloween' ? 300 : 700 } as any);
    }
    for (const e of w.fireflies) e.updateConfig({ tint: t.particles.firefly } as any);
    // Critters.
    if (t.critters.cat) w.life.cat.setTint(t.critters.cat); else w.life.cat.clearTint();
    if (w.life.catTail) { if (t.critters.cat) w.life.catTail.setTint(t.critters.cat); else w.life.catTail.clearTint(); }
    for (const f of w.life.flies) { if (t.critters.butterflies) f.img.setTint(t.critters.butterflies); else f.img.clearTint(); }
    for (const g of w.windowGlows) g.setTint(t.glow);
    sfx.setTheme(t.music);
    if (live) {
      w.ground.restyle();
      w.cameras.main.flash(400, t.id === 'halloween' ? 120 : 255, t.id === 'halloween' ? 80 : 245, t.id === 'halloween' ? 160 : 220);
      w.burst(w.feet.x, w.feet.y - 30, t.id === 'halloween' ? 0xffa040 : 0x9be07a, 30, t.id === 'halloween' ? 'spark' : 'leaf');
    }
  }

  update(time: number, dt: number) {
    const w = this.w;
    const cam = w.cameras.main;
    if (this.sky.visible) this.sky.setPosition(cam.width / 2, cam.height / 2).setDisplaySize(cam.width / cam.zoom * 1.2, cam.height / cam.zoom * 1.2);
    if (theme.fog) {
      const v = cam.worldView;
      for (const f of this.fog) {
        f.ox += f.v * dt;
        if (f.ox > v.width + 400) f.ox = -400;
        f.img.setPosition(v.x + f.ox, v.y + f.oy * (v.height / 900));
      }
    }
    if (!theme.props) return;
    for (const g of this.glows) g.img.setAlpha(g.base + Math.sin(time / 140 + g.ph) * 0.12 + Math.sin(time / 53 + g.ph) * 0.06);
    for (const g of this.ghosts) {
      const t = time / 1000 + g.ph;
      g.spin = Math.max(0, g.spin - dt * 1.2);
      g.img.setPosition(g.hx + Math.sin(t * 0.4) * 60, g.hy + Math.sin(t * 1.7) * 6 - 6);
      g.img.setAngle(g.spin * 360).setFlipX(Math.cos(t * 0.4) < 0).setDepth(g.img.y);
    }
  }
}
