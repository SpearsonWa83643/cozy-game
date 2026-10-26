// 12.8 / 13.2 Room props: tappable things in every room with a cute little reaction + sound. Pure fun: no saves, no mechanics.
import Phaser from 'phaser';
import { sfx } from '../audio';
import type { Rect } from './art';

export type PropKind = 'fire' | 'kettle' | 'clock' | 'lantern' | 'net' | 'bench' | 'cat' | 'jars' | 'pegboard';
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
    case 'bench': {
      sfx.ting(); sfx.pickup(); s.tweens.killTweensOf(p.obj as any);
      s.tweens.add({ targets: p.obj, y: (p.obj as any).y - 9, duration: 110, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
      puffs(s, cx - 20, p.y + 26, 8, { color: 0x7a5232, r: 4, dy: -40, dx: 70, ms: 700, grow: 0.4 });
      return 'Clink-clonk! The pots hop.';
    }
    case 'cat': {
      // 13.2: wakes for a moment, stretches, purrs; little hearts float up.
      sfx.purr(); const o = p.obj as any;
      if (o) { s.tweens.killTweensOf(o); o.setScale(1); o.y = 0; s.tweens.add({ targets: o, scaleX: 1.14, scaleY: 0.9, y: -3, duration: 260, yoyo: true, repeat: 1, ease: 'Sine.easeInOut', onComplete: () => { o.setScale(1); o.y = 0; } }); }
      for (let i = 0; i < 4; i++) {
        const h = s.add.text(cx + 14 + (Math.random() - 0.5) * 30, p.y + 16, '\u2665', { fontFamily: 'Nunito, system-ui, sans-serif', fontSize: '22px', color: '#ff6f91', stroke: '#b83a5c', strokeThickness: 3 }).setOrigin(0.5).setDepth(31).setAlpha(0);
        s.tweens.add({ targets: h, y: h.y - 60 - Math.random() * 30, x: h.x + (Math.random() - 0.5) * 30, alpha: { from: 1, to: 0 }, scale: { from: 0.6, to: 1.2 }, duration: 1200, delay: i * 160, ease: 'Sine.easeOut', onComplete: () => h.destroy() });
      }
      return 'Purrrr... the kitty stretches and goes back to sleep.';
    }
    case 'jars': {
      // 13.2: cookie jar. The lid pops up and a cookie hops out, crumbs fly.
      sfx.ting(); sfx.plip(); const o = p.obj as any;
      if (o) { s.tweens.killTweensOf(o); o.y = 0; o.setAngle?.(0); s.tweens.add({ targets: o, y: -16, angle: -12, duration: 160, yoyo: true, hold: 260, ease: 'Back.easeOut', onComplete: () => { o.y = 0; o.setAngle?.(0); } }); }
      const ck = s.add.circle(cx, p.y + 22, 9, 0xc98a4a).setStrokeStyle(2.5, 0x5a3416).setDepth(31);
      s.tweens.chain({ targets: ck, tweens: [
        { y: p.y - 30, x: cx - 10, duration: 260, ease: 'Quad.easeOut' },
        { angle: 360, duration: 380 },
        { y: p.y + 22, x: cx, alpha: 0, duration: 260, ease: 'Quad.easeIn', onComplete: () => ck.destroy() },
      ] });
      puffs(s, cx, p.y + 12, 6, { color: 0xc98a4a, r: 2.5, dy: -40, dx: 50, ms: 700, grow: 0.5 });
      return 'Pop! A cookie hops out to say hi.';
    }
    case 'pegboard': {
      // 13.2: the tools rattle on their pegs and sawdust trickles down.
      sfx.clank(); sfx.ratchet(); const o = p.obj as any;
      if (o) { s.tweens.killTweensOf(o); o.x = 0; s.tweens.add({ targets: o, x: { from: -3, to: 3 }, duration: 55, yoyo: true, repeat: 4, ease: 'Sine.easeInOut', onComplete: () => { o.x = 0; } }); }
      puffs(s, cx, p.y + p.h - 6, 10, { color: 0xf4dc9a, r: 2.5, dy: 110, dx: p.w * 0.8, ms: 1200, grow: 0.6 });
      return 'Rattle-rattle! The tools jiggle on their pegs.';
    }
    default: {
      sfx.splash(); sfx.rustle(); wobble(s, p.obj, 3, 80);
      puffs(s, cx, p.y + p.h * 0.7, 8, { color: 0x9fdcf5, r: 4, dy: 50, dx: 60, ms: 700, grow: 0.5 });
      return 'Splish! The net drips.';
    }
  }
}
