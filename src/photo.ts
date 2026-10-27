import Phaser from 'phaser';
import { sfx } from './audio';

type HudScene = Phaser.Scene & {
  w: number; h: number;
  text(x: number, y: number, str: string, size: number, color?: string, weight?: number): Phaser.GameObjects.Text;
};

/**
 * 23: cozy photo snapshot. Hides the HUD for a beat, grabs the game canvas, flashes softly and
 * shows a little polaroid with Save (a local download, nothing is uploaded) and Close.
 */
export class PhotoMode {
  open = false;
  busy = false;
  saved = 0;
  private c?: Phaser.GameObjects.Container;
  private key = '';
  private dataUrl = '';
  readonly zones: Phaser.GameObjects.Zone[] = [];
  rects: Record<string, { x: number; y: number; w: number; h: number }> = {};
  constructor(private s: HudScene, private hide: string[] = ['ui', 'vui']) {}

  snap() {
    if (this.open || this.busy) return false;
    this.busy = true;
    const mgr = this.s.scene;
    for (const k of this.hide) if (mgr.isActive(k)) mgr.setVisible(false, k);
    this.s.game.renderer.snapshot((img) => {
      for (const k of this.hide) if (mgr.get(k)) mgr.setVisible(true, k);
      this.busy = false;
      if (img instanceof HTMLImageElement) this.show(img);
    });
    return true;
  }

  private flash() {
    const f = this.s.add.rectangle(0, 0, this.s.w * 2, this.s.h * 2, 0xfffaf0, 0.85).setOrigin(0).setDepth(300);
    this.s.tweens.add({ targets: f, alpha: 0, duration: 420, onComplete: () => f.destroy() });
  }

  private show(img: HTMLImageElement) {
    const s = this.s;
    this.dataUrl = img.src;
    this.key = 'photo-' + Date.now();
    s.textures.addImage(this.key, img);
    sfx.shutter();
    this.flash();
    const ratio = img.width / img.height;
    let pw = Math.min(s.w * 0.62, (s.h * 0.62) * ratio), ph = pw / ratio;
    const pad = 16, foot = 54;
    const fw = pw + pad * 2, fh = ph + pad + foot;
    const cx = s.w / 2, cy = s.h / 2 - 8;
    const dim = s.add.rectangle(0, 0, s.w * 2, s.h * 2, 0x1e140d, 0.55).setOrigin(0).setInteractive();
    const card = s.add.container(0, 0);
    const frame = s.add.graphics();
    frame.fillStyle(0x2a1d14, 0.3); frame.fillRoundedRect(-fw / 2 + 3, -fh / 2 + 7, fw, fh, 8);
    frame.fillStyle(0xfffaf0, 1); frame.fillRoundedRect(-fw / 2, -fh / 2, fw, fh, 8);
    const pic = s.add.image(0, -fh / 2 + pad + ph / 2, this.key).setDisplaySize(pw, ph);
    const d = new Date();
    const cap = s.text(0, fh / 2 - foot / 2 - 2, `Willowmere Glade · ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, 18, '#6b4326', 700).setOrigin(0.5);
    card.add([frame, pic, cap]).setPosition(cx, cy).setAngle(-2).setScale(0.6).setAlpha(0);
    s.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });

    const btn = (x: number, label: string, fill: number, fn: () => void, name: string) => {
      const y = cy + fh / 2 + 44;
      const g = s.add.graphics();
      g.fillStyle(fill, 1); g.fillRoundedRect(x - 80, y - 28, 160, 56, 28);
      g.lineStyle(3, 0xfffaf0, 1); g.strokeRoundedRect(x - 80, y - 28, 160, 56, 28);
      const t = s.text(x, y, label, 22, '#fff8ea', 800).setOrigin(0.5);
      const z = s.add.zone(x, y, 160, 56).setInteractive();
      z.on('pointerdown', () => { sfx.unlock(); fn(); });
      this.rects[name] = { x: x - 80, y: y - 28, w: 160, h: 56 };
      this.zones.push(z);
      return [g, t, z];
    };
    const items = [
      ...btn(cx - 92, 'Save', 0x4f9a5a, () => this.save(), 'save'),
      ...btn(cx + 92, 'Close', 0xa8743f, () => this.close(), 'close'),
    ];
    dim.on('pointerdown', () => this.close());
    this.c = s.add.container(0, 0, [dim, card, ...items]).setDepth(250);
    this.open = true;
  }

  save() {
    if (!this.open) return;
    try {
      const a = document.createElement('a');
      a.href = this.dataUrl;
      const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
      a.download = `willowmere-glade-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      this.saved++;
      sfx.pickup();
    } catch { /* a blocked download just does nothing */ }
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.zones.length = 0; this.rects = {};
    const c = this.c, key = this.key;
    this.c = undefined;
    if (c) this.s.tweens.add({ targets: c, alpha: 0, duration: 180, onComplete: () => { c.destroy(); if (this.s.textures.exists(key)) this.s.textures.remove(key); } });
    sfx.tock();
  }
}
