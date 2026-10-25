// 12.8 Room props: one tappable thing per room with a cute little reaction + sound. Pure fun: no saves, no mechanics.
import Phaser from 'phaser';
import { sfx } from '../audio';
import type { Rect } from './art';

export type PropKind = 'fire' | 'kettle' | 'clock' | 'lantern' | 'net';
export type Prop = Rect & { id: PropKind; obj?: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject };

/** Little round puffs (steam, embers, drops). Capped so rapid taps never pile up. */
function puffs(s: Phaser.Scene, x: number, y: number, n: number, o: { color: number; r: number; dy: number; dx: number; ms: number; grow?: number; add?: boolean }) {
  for (let i = 0; i < n; i++) {
    const px = x + (Math.random() - 0.5) * 24;
    const c = s.add.circle(px, y, o.r * (0.7 + Math.random() * 0.6), o.color, 0.9).setDepth(30);
    if (o.add) c.setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: c, y: y + o.dy * (0.7 + Math.random() * 0.6), x: px + (Math.random() - 0.5) * o.dx, scale: o.grow ?? 0.3, alpha: 0, duration: o.ms * (0.8 + Math.random() * 0.4), delay: i * 50, ease: 'Sine.easeOut', onComplete: () => c.destroy() });
  }
}
const wobble = (s: Phaser.Scene, o: Prop['obj'] | undefined, deg: number, ms = 110) => {
  if (!o) return;
  s.tweens.killTweensOf(o); (o as any).setAngle?.(0);
  s.tweens.add({ targets: o, angle: { from: -deg, to: deg }, duration: ms, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => (o as any).setAngle?.(0) });
};

export function react(s: Phaser.Scene, p: Prop): string {
  const cx = p.x + p.w / 2;
  switch (p.id) {
    case 'fire': {
      sfx.crackle();
      const g = s.add.graphics().setDepth(0.5).setBlendMode(Phaser.BlendModes.ADD);
      for (let i = 4; i >= 1; i--) { g.fillStyle(0xff9a3a, 0.14); g.fillCircle(cx, p.y + p.h - 40, 40 * i); }
      s.tweens.add({ targets: g, alpha: 0, duration: 700, onComplete: () => g.destroy() });
      puffs(s, cx, p.y + p.h - 50, 10, { color: 0xffb347, r: 4, dy: -110, dx: 80, ms: 900, add: true });
      return 'Whoosh! The fire flares up.';
    }
    case 'kettle': {
      sfx.whistle(); wobble(s, p.obj, 6);
      puffs(s, cx + 6, p.y + 4, 8, { color: 0xffffff, r: 7, dy: -70, dx: 30, ms: 1300, grow: 2.4 });
      return 'Tweeeee! The kettle sings.';
    }
    case 'clock': {
      sfx.cuckoo(); wobble(s, p.obj, 4, 90);
      const b = s.add.container(cx, p.y + 6).setDepth(31);
      const body = s.add.circle(0, 0, 11, 0xffd34d).setStrokeStyle(3, 0x4a3022);
      const beak = s.add.triangle(12, 1, 0, -4, 10, 0, 0, 4, 0xe8604c).setStrokeStyle(2, 0x4a3022);
      const eye = s.add.circle(3, -3, 2, 0x4a3022);
      b.add([body, beak, eye]); b.setScale(0.1).setAlpha(0);
      s.tweens.chain({ targets: b, tweens: [
        { scale: 1, alpha: 1, y: p.y - 18, duration: 180, ease: 'Back.easeOut' },
        { y: p.y - 22, duration: 140, yoyo: true, repeat: 2 },
        { scale: 0.1, alpha: 0, y: p.y + 6, duration: 200, delay: 150, onComplete: () => b.destroy() },
      ] });
      return 'Cuckoo! Cuckoo!';
    }
    case 'lantern': {
      sfx.ting(); wobble(s, p.obj, 12, 160);
      const g = s.add.graphics().setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
      for (let i = 4; i >= 1; i--) { g.fillStyle(0xffd27a, 0.12); g.fillCircle(cx, p.y + p.h * 0.6, 22 * i); }
      s.tweens.add({ targets: g, alpha: 0, duration: 900, onComplete: () => g.destroy() });
      puffs(s, cx, p.y + p.h * 0.6, 6, { color: 0xfff1a0, r: 3, dy: -50, dx: 60, ms: 1000, add: true });
      return 'The lantern glows and sways.';
    }
    default: {
      sfx.splash(); sfx.rustle(); wobble(s, p.obj, 3, 80);
      puffs(s, cx, p.y + p.h * 0.7, 8, { color: 0x9fdcf5, r: 4, dy: 50, dx: 60, ms: 700, grow: 0.5 });
      return 'Splish! The net drips.';
    }
  }
}
