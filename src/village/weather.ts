// 11.85: gentle weather per theme. The village "rainy day" event keeps its timer and garden boost,
// but how it looks follows the theme: Spring rain + rainbow, Summer sun shower + rainbow, Fall
// breezy leaves, Halloween mist, Christmas/Winter big slow snowflakes. Visual only.
import Phaser from 'phaser';
import { atlasOf, frameScale } from '../art';
import { theme } from '../theme';
import type { WorldScene } from '../scenes/World';

export type WeatherKind = 'rain' | 'sunshower' | 'wind' | 'mist' | 'snow';

export function weatherFor(id: string): WeatherKind {
  switch (id) {
    case 'summer': return 'sunshower';
    case 'fall': return 'wind';
    case 'halloween': return 'mist';
    case 'christmas': case 'winter': return 'snow';
    default: return 'rain';
  }
}

/** Toasts at the start and end of each kind (short and simple: kids read these). */
export const WEATHER_TEXT: Record<WeatherKind, [string, string]> = {
  rain: ['Rainy day! Plants love rain.', 'The rain stopped. Look, a rainbow!'],
  sunshower: ['Sun shower! Warm, sparkly rain.', 'A rainbow! Hello, sun!'],
  wind: ['Windy day! The leaves are dancing.', 'The wind settled down.'],
  mist: ['Misty evening! Cozy and spooky.', 'The mist drifted away.'],
  snow: ['Snowy day! Big fluffy flakes.', 'The snow stopped. So sparkly!'],
};

/** Overlay colour + max alpha for each kind. */
const WASH: Record<WeatherKind, [number, number]> = {
  rain: [0x6d7f9e, 0.22], sunshower: [0xffe6a0, 0.14], wind: [0xffd8a8, 0.1], mist: [0x4a3a6a, 0.18], snow: [0xdfe8f5, 0.16],
};

export class Weather {
  kind: WeatherKind | null = null;
  emit: Partial<Record<WeatherKind, Phaser.GameObjects.Particles.ParticleEmitter>> = {};
  mist: { img: Phaser.GameObjects.Image; ox: number; oy: number; v: number }[] = [];
  rainbow: Phaser.GameObjects.Image | null = null;
  /** Rainbows shown (for tests). */
  rainbows = 0;
  constructor(private w: WorldScene, private rainFx: Phaser.GameObjects.Particles.ParticleEmitter, private tint: Phaser.GameObjects.Rectangle) {}

  private emitter(k: WeatherKind) {
    if (k === 'rain') return this.rainFx;
    if (k === 'mist') return null;
    let e = this.emit[k];
    if (e) return e;
    const w = this.w;
    const zone = { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, 10, 10) as any };
    if (k === 'sunshower') e = w.add.particles(0, 0, atlasOf('p_drop'), {
      frame: 'p_drop', emitZone: zone, lifespan: 1000, speedY: { min: 440, max: 540 }, speedX: { min: -40, max: -20 },
      quantity: 3, frequency: 40, scale: { min: 0.5, max: 0.75 }, alpha: { min: 0.5, max: 0.85 }, tint: [0xfff2b0, 0xffffff, 0xffe080], emitting: false,
    } as any);
    else if (k === 'wind') e = w.add.particles(0, 0, atlasOf('p_maple'), {
      frame: 'p_maple', emitZone: zone, lifespan: 3600, speedX: { min: 360, max: 520 }, speedY: { min: -50, max: 70 },
      rotate: { start: 0, end: 720 }, quantity: 2, frequency: 70, scale: { min: 0.3, max: 0.5 }, alpha: { values: [0, 1, 1, 0.6] },
      tint: [0xf2603a, 0xff9a4a, 0xffc24a, 0xd8482a, 0xffd870], emitting: false,
    } as any);
    else e = w.add.particles(0, 0, atlasOf('p_snow'), {
      frame: 'p_snow', emitZone: zone, lifespan: 9000, speedY: { min: 70, max: 120 }, speedX: { min: -25, max: 15 },
      rotate: { min: 0, max: 360 }, quantity: 2, frequency: 90, scale: { min: 0.4, max: 0.75 }, alpha: { values: [0, 0.95, 0.95, 0] }, emitting: false,
    } as any);
    e.setDepth(8900);
    this.emit[k] = e;
    return e;
  }

  /** Start (or switch to) the current theme's weather. */
  begin() {
    const k = weatherFor(theme.id);
    if (this.kind === k) return k;
    this.stopFx();
    this.kind = k;
    this.emitter(k)?.start();
    if (k === 'mist') this.showMist(true);
    return k;
  }
  /** Theme changed while the weather is on: swap its look live. */
  retheme() { if (this.kind) this.begin(); }

  private showMist(on: boolean) {
    if (on && !this.mist.length) {
      for (let i = 0; i < 6; i++) {
        const img = this.w.add.image(0, 0, atlasOf('mist'), 'mist').setDepth(8850).setTint(0xcab8ff).setAlpha(0).setScale(6 + Math.random() * 3, 2.6 + Math.random());
        this.mist.push({ img, ox: Math.random() * 1400 - 200, oy: 120 + Math.random() * 700, v: 10 + Math.random() * 14 });
      }
    }
    for (const m of this.mist) { this.w.tweens.killTweensOf(m.img); this.w.tweens.add({ targets: m.img, alpha: on ? 0.34 : 0, duration: on ? 1800 : 1400 }); }
  }
  private stopFx() {
    if (!this.kind) return;
    this.emitter(this.kind)?.stop();
    if (this.kind === 'mist') this.showMist(false);
  }

  /** Per frame while the event runs; `left` is seconds remaining. */
  update(left: number, dt: number) {
    if (!this.kind) return;
    const v = this.w.cameras.main.worldView;
    const e = this.emitter(this.kind);
    if (e) {
      const z = e.emitZones[0] as any;
      if (this.kind === 'wind') { e.setPosition(v.x - 60, v.y - 40); z.source.setTo(0, 0, 20, v.height + 80); }
      else if (this.kind === 'snow') { e.setPosition(v.x - 100, v.y - 30); z.source.setTo(0, 0, v.width + 260, 20); }
      else { e.setPosition(v.x, v.y - 40); z.source.setTo(0, 0, v.width + 200, 20); }
    }
    if (this.kind === 'mist') for (const m of this.mist) {
      m.ox += m.v * dt; if (m.ox > 1400) m.ox = -300;
      m.img.setPosition(v.x + (m.ox / 1180) * v.width, v.y + (m.oy / 820) * v.height);
    }
    const [col, max] = WASH[this.kind];
    this.tint.setSize(this.w.scale.width, this.w.scale.height).setFillStyle(col, Math.min(max, left * 0.1));
  }

  /** The event ended: stop, and finish with a rainbow after rain or a sun shower. */
  end() {
    const k = this.kind;
    this.stopFx();
    this.kind = null;
    this.tint.setFillStyle(0x6d7f9e, 0);
    if (k === 'rain' || k === 'sunshower') this.showRainbow();
    return k;
  }

  showRainbow() {
    const w = this.w, v = w.cameras.main.worldView;
    this.rainbow?.destroy();
    const r = w.add.image(v.centerX + v.width * 0.12, v.y + v.height * 0.46, atlasOf('w_rainbow'), 'w_rainbow').setOrigin(0.5, 1).setDepth(8840).setAlpha(0);
    r.setScale((v.width * 0.62) / (r.width || 1));
    this.rainbow = r;
    this.rainbows++;
    w.tweens.add({ targets: r, alpha: 0.6, duration: 1600, yoyo: true, hold: 7000, onComplete: () => { r.destroy(); if (this.rainbow === r) this.rainbow = null; } });
    void frameScale;
  }
}
