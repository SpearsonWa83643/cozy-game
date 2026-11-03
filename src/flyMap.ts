// 65: Waypoint fly travel. While riding, one big "Fly!" button opens a paper map of the whole world with big,
// round, tappable site icons (village, stable, jail, every region and puzzle). Tap one and your mount flies there.
import Phaser from 'phaser';
import { DPR } from './dpr';
import { safeInsets } from './device';
import { sfx } from './audio';
import { save } from './save';
import { theme } from './theme';
import { WORLD_W, WORLD_H } from './layout';
import { FLY_SITES, ensureLandmarkIcons, type FlySite } from './landmarks';
import { paintWorldMap } from './worldMap';
import type { VillageUIScene as VillageUI } from './scenes/VillageUI';

type Pin = { site: FlySite; c: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; badge: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Zone; locked: boolean; x: number; y: number; r: number };

export class FlyMap {
  btn!: Phaser.GameObjects.Container;
  btnBg!: Phaser.GameObjects.Graphics;
  btnZone!: Phaser.GameObjects.Zone;
  btnShown = false;
  btnR = 44;
  open = false;
  root?: Phaser.GameObjects.Container;
  pins: Pin[] = [];
  here?: Phaser.GameObjects.Container;
  geom = { x: 0, y: 0, s: 1 };
  lastTarget = '';

  constructor(private ui: VillageUI) {
    ensureLandmarkIcons(ui);
    const bg = ui.add.graphics();
    const ic = ui.add.image(0, -8, 'lm_fly').setDisplaySize(60, 60);
    const label = ui.text(0, 30, 'Fly!', 17, '#fffaf0', 900).setOrigin(0.5).setStroke('#5a3d28', 5);
    this.btnBg = bg;
    this.btn = ui.add.container(0, 0, [bg, ic, label]).setVisible(false).setDepth(5);
    this.btnZone = ui.add.zone(0, 0, 100, 100).setOrigin(0.5).setInteractive(new Phaser.Geom.Circle(50, 50, 50), Phaser.Geom.Circle.Contains);
    this.btnZone.input!.enabled = false;
    this.btnZone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.getDistance() > 30 || !this.btnShown || this.open) return;
      sfx.unlock(); sfx.blip();
      this.ui.tweens.add({ targets: this.btn, scale: { from: 0.85, to: 1 }, duration: 220, ease: 'Back.easeOut' });
      this.show();
    });
    this.drawBtn();
  }

  drawBtn() {
    const g = this.btnBg; g.clear();
    g.fillStyle(0x2a1d14, 0.3); g.fillCircle(0, 5, 46);
    g.fillStyle(theme.ui.accent, 1); g.fillCircle(0, 0, 46);
    g.fillStyle(0xfbf1dc, 1); g.fillCircle(0, 0, 39);
    g.lineStyle(4, theme.ui.accentDark, 1); g.strokeCircle(0, 0, 46);
  }

  layout() {
    const si = safeInsets(), ui = this.ui;
    const x = ui.w - 22 - si.right - 46, y = Math.round(ui.h * 0.5);
    this.btn.setPosition(x, y); this.btnZone.setPosition(x, y);
    ui.rects.flymap = { x: x - 46, y: y - 46, w: 92, h: 92 };
    if (this.open) this.build();
  }

  /** Per frame: the Fly! button shows while riding; the map closes if the ride ends. */
  update(hidden: boolean) {
    const m = this.ui.world?.mount;
    const riding = !hidden && !!m && m.riderOn && (m.phase === 'ride' || m.phase === 'travel') && !this.ui.mountPicker && !this.ui.card;
    const show = riding && !this.open;
    if (show && !this.btnShown) {
      this.drawBtn();
      this.btn.setScale(0.5); this.ui.tweens.add({ targets: this.btn, scale: 1, duration: 320, ease: 'Back.easeOut' });
    }
    this.btnShown = show;
    this.btn.setVisible(show); this.btnZone.input!.enabled = show;
    if (!riding && this.open) this.hide();
    if (this.open && this.here && m) {
      const g = this.geom;
      this.here.setPosition(g.x + m.gx * g.s, g.y + m.gy * g.s);
    }
  }

  show() {
    const m = this.ui.world.mount;
    this.open = true;
    this.build();
    const target = m.phase === 'travel' ? m.travelName : '';
    this.lastTarget = target;
    this.root!.setAlpha(0); this.ui.tweens.add({ targets: this.root, alpha: 1, duration: 200 });
    this.pins.forEach((p, i) => { p.c.setScale(0.4); this.ui.tweens.add({ targets: p.c, scale: 1, duration: 300, delay: 60 + i * 18, ease: 'Back.easeOut' }); });
    this.ui.game.events.emit('flymap', true);
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    const r = this.root; this.root = undefined; this.here = undefined;
    for (const k of Object.keys(this.ui.rects)) if (k.startsWith('travel:') || k === 'flyclose' || k === 'flysheet') delete this.ui.rects[k];
    this.pins = [];
    if (r) this.ui.tweens.add({ targets: r, alpha: 0, duration: 180, onComplete: () => r.destroy() });
    this.ui.game.events.emit('flymap', false);
  }

  build() {
    const ui = this.ui, m = ui.world.mount, si = safeInsets();
    this.root?.destroy(); this.pins = [];
    const W = ui.w, H = ui.h;
    const root = ui.add.container(0, 0).setDepth(60);
    this.root = root;
    // Dim the world; a tap on the dim (outside the paper) closes the map.
    const dim = ui.add.rectangle(0, 0, W, H, 0x1e140c, 0.55).setOrigin(0).setInteractive();
    dim.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 30) { sfx.blip(); this.hide(); } });
    root.add(dim);
    // The paper map, as big as fits under a ribbon title.
    const top = 70 + si.top, pad = 18;
    const aw = W - pad * 2 - si.left - si.right, ah = H - top - pad - si.bottom;
    const s = Math.min(aw / WORLD_W, ah / WORLD_H);
    const mw = WORLD_W * s, mh = WORLD_H * s;
    const mx = si.left + pad + (aw - mw) / 2, my = top + (ah - mh) / 2;
    this.geom = { x: mx, y: my, s };
    const paper = ui.add.graphics();
    paper.fillStyle(0x000000, 0.28); paper.fillRoundedRect(mx - 8, my - 4, mw + 16, mh + 16, 18);
    paper.fillStyle(0xf3e4bf, 1); paper.fillRoundedRect(mx - 10, my - 10, mw + 20, mh + 20, 18);
    paper.lineStyle(3, 0x8a6a48, 1); paper.strokeRoundedRect(mx - 10, my - 10, mw + 20, mh + 20, 18);
    root.add(paper);
    // The sheet swallows taps so only the dim around it closes.
    const sheet = ui.add.zone(mx - 10, my - 10, mw + 20, mh + 20).setOrigin(0).setInteractive();
    root.add(sheet);
    ui.rects.flysheet = { x: mx, y: my, w: mw, h: mh };
    const key = 'flymap';
    const px = Math.ceil(mw * DPR), ph = Math.ceil(mh * DPR);
    const cv = document.createElement('canvas'); cv.width = px; cv.height = ph;
    paintWorldMap(cv.getContext('2d')!, px, ph);
    if (ui.textures.exists(key)) ui.textures.remove(key);
    ui.textures.addCanvas(key, cv);
    root.add(ui.add.image(mx, my, key).setOrigin(0).setDisplaySize(mw, mh));
    // Ribbon title.
    const rib = ui.add.graphics();
    const rw = Math.min(360, W - 140), rx = W / 2 - rw / 2, ry = 14 + si.top;
    rib.fillStyle(theme.ui.accentDark, 1); rib.fillTriangle(rx - 18, ry + 8, rx + 4, ry + 8, rx + 4, ry + 44); rib.fillTriangle(rx + rw + 18, ry + 8, rx + rw - 4, ry + 8, rx + rw - 4, ry + 44);
    rib.fillStyle(theme.ui.accent, 1); rib.fillRoundedRect(rx, ry, rw, 46, 14);
    root.add(rib);
    root.add(ui.text(W / 2, ry + 23, 'Where shall we fly?', 22, '#fffaf0', 900).setOrigin(0.5).setStroke('#5a3d28', 5));
    // Big close X, top right.
    const cx = W - 22 - si.right - 30, cy = ry + 23;
    const xb = ui.add.graphics();
    xb.fillStyle(0x2a1d14, 0.3); xb.fillCircle(0, 4, 30); xb.fillStyle(0xfbf1dc, 1); xb.fillCircle(0, 0, 30);
    xb.lineStyle(4, theme.ui.accent, 1); xb.strokeCircle(0, 0, 27);
    xb.lineStyle(7, 0x5a3d28, 1); xb.beginPath(); xb.moveTo(-10, -10); xb.lineTo(10, 10); xb.moveTo(10, -10); xb.lineTo(-10, 10); xb.strokePath();
    xb.setPosition(cx, cy);
    const xz = ui.add.zone(cx, cy, 72, 72).setOrigin(0.5).setInteractive();
    xz.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 30) { sfx.blip(); this.hide(); } });
    root.add([xb, xz]);
    ui.rects.flyclose = { x: cx - 36, y: cy - 36, w: 72, h: 72 };

    // Pins: big round icons (landmarks bigger than puzzles), nudged apart so none overlap, with a leader line if moved.
    const sc = Phaser.Math.Clamp(mw / 1000, 0.72, 1.1);
    const pins = FLY_SITES.map((site) => {
      const r = (site.big ? 33 : 26) * sc;
      return { site, x: mx + site.x * s, y: my + site.y * s, ox: mx + site.x * s, oy: my + site.y * s, r };
    });
    for (let it = 0; it < 60; it++) {
      for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i], b = pins[j];
        const need = a.r + b.r + 18 * sc; // room for the name labels
        let dx = b.x - a.x, dy = b.y - a.y; let d = Math.hypot(dx, dy);
        if (d >= need) continue;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        const push = (need - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
      for (const p of pins) {
        p.x += (p.ox - p.x) * 0.04; p.y += (p.oy - p.y) * 0.04; // springs back toward the true spot
        p.x = Phaser.Math.Clamp(p.x, mx + p.r, mx + mw - p.r); p.y = Phaser.Math.Clamp(p.y, my + p.r, my + mh - p.r - 12);
      }
    }
    const lines = ui.add.graphics(); root.add(lines);
    const target = m.phase === 'travel' ? m.travelName : '';
    for (const q of pins) {
      const { site, r } = q;
      const locked = !m.travelSpot(site.x, site.y);
      const solved = !!(site.puzzle && save.puzzles[site.puzzle]);
      if (Math.hypot(q.x - q.ox, q.y - q.oy) > r * 0.6) {
        lines.lineStyle(3, 0x5a3d28, 0.7); lines.lineBetween(q.ox, q.oy, q.x, q.y);
        lines.fillStyle(0x5a3d28, 0.9); lines.fillCircle(q.ox, q.oy, 4);
      }
      const bg = ui.add.graphics();
      const isT = site.name === target;
      bg.fillStyle(0x2a1d14, 0.32); bg.fillCircle(0, 4, r + 3);
      bg.fillStyle(isT ? theme.ui.accent : solved ? 0xd8f2c4 : 0xfbf1dc, 1); bg.fillCircle(0, 0, r + 3);
      bg.lineStyle(4, isT ? theme.ui.accentDark : solved ? 0x4f9a3a : theme.ui.accent, 1); bg.strokeCircle(0, 0, r);
      const ic = ui.add.image(0, -2, site.icon).setDisplaySize(r * 1.45, r * 1.45);
      const label = ui.text(0, r + 6, site.name, Math.round((site.big ? 14 : 12) * Math.max(0.9, sc)), '#fffaf0', 900).setOrigin(0.5).setStroke('#5a3d28', 4);
      const badge = ui.add.graphics();
      if (locked) {
        badge.fillStyle(0x5a3d28, 1); badge.fillCircle(r * 0.72, -r * 0.72, 13);
        badge.lineStyle(3, 0xfff1c4, 1); badge.beginPath(); badge.arc(r * 0.72, -r * 0.72 - 4, 4.5, Math.PI, 0); badge.strokePath();
        badge.fillStyle(0xfff1c4, 1); badge.fillRoundedRect(r * 0.72 - 6, -r * 0.72 - 4, 12, 10, 3);
      } else if (solved) {
        badge.fillStyle(0x4f9a3a, 1); badge.fillCircle(r * 0.72, -r * 0.72, 13);
        badge.lineStyle(4, 0xffffff, 1); badge.beginPath(); badge.moveTo(r * 0.72 - 6, -r * 0.72); badge.lineTo(r * 0.72 - 1, -r * 0.72 + 5); badge.lineTo(r * 0.72 + 7, -r * 0.72 - 5); badge.strokePath();
      }
      const c = ui.add.container(q.x, q.y, [bg, ic, label, badge]).setAlpha(locked ? 0.6 : 1);
      // Touch target: at least 64 px across, a bit bigger than the drawn pin.
      const hit = Math.max(32, r + 6);
      const zone = ui.add.zone(q.x, q.y, hit * 2, hit * 2).setOrigin(0.5).setInteractive(new Phaser.Geom.Circle(hit, hit, hit), Phaser.Geom.Circle.Contains);
      const pin: Pin = { site, c, bg, badge, zone, locked, x: q.x, y: q.y, r };
      zone.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 30) { sfx.unlock(); this.tap(pin); } });
      root.add([c, zone]);
      ui.rects[`travel:${site.id}`] = { x: q.x - hit, y: q.y - hit, w: hit * 2, h: hit * 2 };
      this.pins.push(pin);
    }
    // You are here: a bobbing red marker with a pulsing ring.
    const ring = ui.add.graphics(); ring.lineStyle(4, 0xe0503c, 1); ring.strokeCircle(0, 0, 16);
    const dot = ui.add.graphics();
    dot.fillStyle(0xe0503c, 1); dot.fillCircle(0, -18, 11); dot.fillTriangle(-9, -13, 9, -13, 0, 2);
    dot.fillStyle(0xffffff, 1); dot.fillCircle(0, -18, 4.5);
    const here = ui.add.container(mx + m.gx * s, my + m.gy * s, [ring, dot]);
    ui.tweens.add({ targets: ring, scale: { from: 0.6, to: 1.5 }, alpha: { from: 1, to: 0 }, duration: 1100, repeat: -1 });
    ui.tweens.add({ targets: dot, y: -6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    root.add(here);
    this.here = here;
  }

  tap(pin: Pin) {
    const m = this.ui.world.mount;
    if (pin.locked) {
      sfx.tock();
      this.ui.tweens.add({ targets: pin.c, angle: { from: -10, to: 10 }, duration: 90, yoyo: true, repeat: 1, onComplete: () => pin.c.setAngle(0) });
      this.ui.game.events.emit('toast', `Find the way to ${pin.site.name} on foot first!`);
      return;
    }
    sfx.sparkle();
    this.ui.tweens.add({ targets: pin.c, scale: 1.25, duration: 160, yoyo: true, ease: 'Sine.easeOut' });
    this.ui.time.delayedCall(220, () => {
      this.hide();
      m.travelTo(pin.site.x, pin.site.y, pin.site.name);
    });
  }
}
