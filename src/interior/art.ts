// 12.6 Interior art: every building type paints its OWN room (palette, background, ambient motion). Nothing here is shared
// between rooms except the helpers, so each one can keep its own feel. Painted under the furniture (depth < 1).
import Phaser from 'phaser';
import type { Prop } from './props';

export type Rect = { x: number; y: number; w: number; h: number };
export type RoomArt = {
  /** The window / view rect other code reads (null when the room has none, e.g. the open-air garden). */
  window: Rect | null;
  /** Repaint the view for day / night (lamp on = day). */
  redraw: (night: boolean) => void;
  /** Colour of the outer frame stroke. */
  frame: number;
  /** Where the lamp-lit overlay should sit. */
  warm: number;
  /** 12.8: tappable props (fireplace, kettle, clock, lantern, net) with their hit boxes. */
  props: Prop[];
};

type Gfx = Phaser.GameObjects.Graphics;
const seeded = (n: number) => () => (n = (n * 16807) % 2147483647) / 2147483647;
const loop = (s: Phaser.Scene, targets: object | object[], cfg: Record<string, unknown>) =>
  s.tweens.add({ targets, repeat: -1, yoyo: true, ease: 'Sine.easeInOut', ...cfg } as Phaser.Types.Tweens.TweenBuilderConfig);
const glowCircle = (g: Gfx, x: number, y: number, rad: number, color: number, a: number, steps = 6) => {
  for (let i = steps; i >= 1; i--) { g.fillStyle(color, a); g.fillCircle(x, y, (rad * i) / steps); }
};
const rad = 12; // outer corner radius (frame + base fills)
const IN = 8; // keep detail painting this far in from the frame

export function paintRoom(s: Phaser.Scene, type: string, r: Rect, ft: number, lampOn: boolean): RoomArt {
  switch (type) {
    case 'kitchen': return kitchen(s, r, ft, lampOn);
    case 'workshop': return workshop(s, r, ft, lampOn);
    case 'garden': return garden(s, r, ft, lampOn);
    case 'fishhut': return fishhut(s, r, ft, lampOn);
    default: return home(s, r, ft, lampOn);
  }
}

/** The door (or gate) back outside: same spot in every room (left side), its own look. */
export function paintDoor(s: Phaser.Scene, type: string, x: number, y: number, w: number, h: number) {
  const g = s.add.graphics().setDepth(0.7);
  if (type === 'garden') {
    // A gate in the picket fence.
    g.fillStyle(0x6b4a2e, 1); g.fillRect(x - 12, y - 18, 12, h + 18); g.fillRect(x + w, y - 18, 12, h + 18);
    g.fillStyle(0x8c6039, 1); g.fillRect(x - 14, y - 24, 16, 8); g.fillRect(x + w - 2, y - 24, 16, 8);
    g.fillStyle(0xfff4dc, 1);
    for (let i = 0; i < 5; i++) { const px = x + 2 + i * (w - 4) / 5; g.fillRect(px, y + 6, (w - 4) / 5 - 4, h - 6); g.fillTriangle(px, y + 6, px + (w - 4) / 5 - 4, y + 6, px + ((w - 4) / 5 - 4) / 2, y - 4); }
    g.fillStyle(0xd9c6a0, 1); g.fillRect(x, y + h * 0.3, w, 7); g.fillRect(x, y + h * 0.7, w, 7);
    g.fillStyle(0xf2c14e, 1); g.fillCircle(x + w - 10, y + h * 0.5, 5);
    g.lineStyle(2.5, 0x6b4a2e, 1); g.strokeCircle(x + w - 10, y + h * 0.5, 5);
    return;
  }
  const palette: Record<string, [number, number, number, number]> = {
    // [frame, top, bottom, trim]
    home: [0x5a2e1c, 0x3f8f5a, 0x2f7348, 0x24593a],
    kitchen: [0x2f6f6a, 0xffd45e, 0xf2b630, 0xc88a12],
    workshop: [0x3a2a1c, 0x8a6238, 0x6b4a2a, 0x3a2a1c],
    fishhut: [0x24485f, 0x3f7a9a, 0x2f6784, 0x1d4a63],
  };
  const [fr, top, bot, trim] = palette[type] ?? palette.home;
  g.fillStyle(fr, 1); g.fillRoundedRect(x - 7, y - 7, w + 14, h + 7, { tl: type === 'workshop' ? 4 : 48, tr: type === 'workshop' ? 4 : 48, bl: 0, br: 0 });
  const tr = type === 'workshop' ? 3 : 42;
  g.fillGradientStyle(top, top, bot, bot, 1); g.fillRoundedRect(x, y, w, h, { tl: tr, tr: tr, bl: 0, br: 0 });
  g.lineStyle(3, trim, 1);
  if (type === 'workshop') {
    // Barn door: planks with an X brace.
    for (let i = 1; i < 4; i++) g.lineBetween(x + (w * i) / 4, y, x + (w * i) / 4, y + h);
    g.lineStyle(6, trim, 1); g.lineBetween(x + 4, y + 8, x + w - 4, y + h - 8); g.lineBetween(x + w - 4, y + 8, x + 4, y + h - 8);
    g.fillStyle(0xb9c3cc, 1); g.fillRoundedRect(x + w - 22, y + h * 0.5 - 4, 16, 8, 3);
  } else if (type === 'fishhut') {
    for (let i = 1; i < 4; i++) g.lineBetween(x + (w * i) / 4, y + 4, x + (w * i) / 4, y + h);
    g.fillStyle(0x9fdcf5, 1); g.fillCircle(x + w / 2, y + h * 0.3, w * 0.24); g.lineStyle(4, 0xf2c14e, 1); g.strokeCircle(x + w / 2, y + h * 0.3, w * 0.24);
    g.fillStyle(0xffffff, 0.7); g.fillCircle(x + w / 2 - 5, y + h * 0.3 - 5, 4);
    g.fillStyle(0xf2c14e, 1); g.fillCircle(x + w - 14, y + h * 0.58, 5);
  } else if (type === 'kitchen') {
    g.fillStyle(0xdff6ff, 1); g.fillRoundedRect(x + 12, y + 20, w - 24, h * 0.36, 14); g.lineStyle(3, trim, 1); g.strokeRoundedRect(x + 12, y + 20, w - 24, h * 0.36, 14);
    g.strokeRoundedRect(x + 12, y + h * 0.5, w - 24, h * 0.4, 8);
    g.fillStyle(0xe8604c, 1); g.fillCircle(x + w - 16, y + h * 0.56, 6);
  } else {
    g.strokeRoundedRect(x + 12, y + 22, w - 24, h * 0.34, 14); g.strokeRoundedRect(x + 12, y + h * 0.5, w - 24, h * 0.4, 8);
    g.fillStyle(0xf2c14e, 1); g.fillCircle(x + w - 16, y + h * 0.55, 6); g.lineStyle(2.5, 0x4a3022, 1); g.strokeCircle(x + w - 16, y + h * 0.55, 6);
  }
}

// ---------------------------------------------------------------------------------------------------- HOME
// A cozy living room: terracotta damask walls, dark wood panelling, a stone fireplace with a living flame, lamplight and a sunbeam.
function home(s: Phaser.Scene, r: Rect, ft: number, lampOn: boolean): RoomArt {
  const g = s.add.graphics().setDepth(0);
  const rnd = seeded(11);
  g.fillStyle(0xf2c99b, 1); g.fillRoundedRect(r.x, r.y, r.w, ft - r.y + 20, { tl: rad, tr: rad, bl: 0, br: 0 });
  // Damask-ish stripes + little diamond flowers.
  for (let x = r.x + IN + 14; x < r.x + r.w - IN - 20; x += 60) { g.fillStyle(0xe9b27c, 1); g.fillRect(x, r.y + IN, 26, ft - r.y - IN - 50); }
  for (let x = r.x + IN + 42; x < r.x + r.w - IN - 20; x += 60) for (let y = r.y + 34; y < ft - 70; y += 56) {
    g.fillStyle(0xc9784a, 1); g.fillTriangle(x, y - 8, x + 7, y, x, y + 8); g.fillTriangle(x, y - 8, x - 7, y, x, y + 8);
  }
  // Ceiling cornice.
  g.fillStyle(0x7a4228, 1); g.fillRoundedRect(r.x, r.y, r.w, 16, { tl: rad, tr: rad, bl: 0, br: 0 }); g.fillStyle(0xb8744a, 1); g.fillRect(r.x, r.y + 16, r.w, 5);
  // Dark walnut panelling with raised panels.
  g.fillStyle(0x7a4228, 1); g.fillRect(r.x, ft - 56, r.w, 56);
  g.fillStyle(0x93532f, 1); for (let x = r.x + 14; x < r.x + r.w - 50; x += 78) g.fillRoundedRect(x, ft - 46, 64, 36, 6);
  g.fillStyle(0xd08a52, 1); g.fillRect(r.x, ft - 60, r.w, 8);
  // Floor: warm honey planks, rich and glossy.
  const fh = r.y + r.h - ft;
  g.fillGradientStyle(0xc9803f, 0xc9803f, 0x9a5a2c, 0x9a5a2c, 1); g.fillRect(r.x, ft, r.w, fh - rad);
  g.fillStyle(0x9a5a2c, 1); g.fillRoundedRect(r.x, r.y + r.h - 40, r.w, 40, { tl: 0, tr: 0, bl: rad, br: rad });
  g.lineStyle(2, 0x6b3a1c, 0.6);
  for (let i = 1; i <= 6; i++) { const y = ft + (fh * i) / 6.5; g.lineBetween(r.x + IN, y, r.x + r.w - IN, y); }
  for (let i = 0; i <= 6; i++) { const y0 = ft + (fh * i) / 6.5, y1 = ft + (fh * (i + 1)) / 6.5; for (let x = r.x + ((i * 97) % 160) + 40; x < r.x + r.w - IN; x += 190) g.lineBetween(x, y0, x, Math.min(y1, r.y + r.h - IN)); }
  g.fillStyle(0xffe6b0, 0.12); for (let i = 0; i < 7; i++) g.fillEllipse(r.x + rnd() * r.w, ft + rnd() * fh * 0.7, 90, 8);
  g.fillStyle(0x4a2810, 1); g.fillRect(r.x, ft, r.w, 6);
  // Fireplace (right of the window).
  const fw = Math.min(190, r.w * 0.17), fx = r.x + r.w * 0.76 - fw / 2, fhh = Math.min(150, ft - r.y - 70), fy = ft - fhh;
  const fp = s.add.graphics().setDepth(0.3);
  fp.fillStyle(0x6e6259, 1); fp.fillRoundedRect(fx - 16, fy - 10, fw + 32, fhh + 10, { tl: 10, tr: 10, bl: 0, br: 0 });
  fp.fillStyle(0xa09285, 1); fp.fillRoundedRect(fx - 8, fy - 2, fw + 16, fhh + 2, { tl: 8, tr: 8, bl: 0, br: 0 });
  fp.lineStyle(2, 0x6e6259, 1);
  for (let y = fy; y < ft; y += 18) fp.lineBetween(fx - 8, y, fx + fw + 8, y);
  for (let y = fy, row = 0; y < ft; y += 18, row++) for (let x = fx - 8 + (row % 2) * 18; x < fx + fw + 8; x += 36) fp.lineBetween(x, y, x, y + 18);
  fp.fillStyle(0x2a1208, 1); fp.fillRoundedRect(fx + 20, fy + 26, fw - 40, fhh - 26, { tl: 38, tr: 38, bl: 0, br: 0 });
  fp.fillStyle(0x5a3416, 1); fp.fillRoundedRect(fx + 28, ft - 20, fw - 56, 14, 6); fp.fillRoundedRect(fx + 36, ft - 32, fw - 72, 14, 6);
  fp.fillStyle(0x8c4a22, 1); fp.fillRoundedRect(fx - 24, fy - 22, fw + 48, 16, 5); // mantle
  fp.fillStyle(0xfff1c4, 1); fp.fillRoundedRect(fx + 6, fy - 46, 10, 24, 3); fp.fillRoundedRect(fx + fw - 18, fy - 40, 10, 18, 3); // candles
  fp.fillStyle(0xe8604c, 1); fp.fillRoundedRect(fx + fw * 0.4, fy - 44, 36, 22, 4); fp.fillStyle(0xffd34d, 1); fp.fillRect(fx + fw * 0.4 + 4, fy - 40, 28, 14); // little picture
  const flame = s.add.graphics().setDepth(0.35);
  const fcx = fx + fw / 2, fby = ft - 24;
  const flameShape = (sc: number) => {
    flame.clear();
    flame.fillStyle(0xff7a1a, 1); flame.fillTriangle(fcx - 30 * sc, fby, fcx + 30 * sc, fby, fcx, fby - 62 * sc); flame.fillEllipse(fcx, fby - 12, 66 * sc, 36);
    flame.fillStyle(0xffc23a, 1); flame.fillTriangle(fcx - 18 * sc, fby, fcx + 18 * sc, fby, fcx + 3, fby - 40 * sc); flame.fillEllipse(fcx, fby - 8, 40 * sc, 24);
    flame.fillStyle(0xfff3b0, 1); flame.fillEllipse(fcx, fby - 6, 18 * sc, 16);
  };
  flameShape(1);
  const f = { v: 1 };
  s.tweens.add({ targets: f, v: 1.22, duration: 220, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', onUpdate: () => flameShape(0.9 + (f.v - 1) * 0.9) });
  const fglow = s.add.graphics().setDepth(0.4).setBlendMode(Phaser.BlendModes.ADD);
  glowCircle(fglow, fcx, ft - 10, 150, 0xff8a2a, 0.045, 6);
  loop(s, fglow, { alpha: { from: 0.65, to: 1 }, duration: 380 });
  // Sparks rising from the logs.
  for (let i = 0; i < 4; i++) {
    const sp = s.add.circle(fcx + (rnd() - 0.5) * 40, fby - 20, 2.5, 0xffd34d).setDepth(0.36);
    s.tweens.add({ targets: sp, y: fby - 110 - rnd() * 40, x: sp.x + (rnd() - 0.5) * 50, alpha: { from: 1, to: 0 }, duration: 1400 + rnd() * 900, repeat: -1, delay: i * 420 });
  }
  // Lamp-lit warmth over everything.
  const warm = s.add.rectangle(r.x, r.y, r.w, r.h, 0xff9a3c, 0.07).setOrigin(0).setDepth(498).setBlendMode(Phaser.BlendModes.ADD);
  void warm;
  // Window with sunbeam + drifting dust.
  const ww = Math.min(200, r.w * 0.22), wh = Math.min(140, (ft - r.y) * 0.62);
  const win: Rect = { x: r.x + r.w * 0.4 - ww / 2, y: r.y + (ft - 50 - r.y - wh) / 2 + 4, w: ww, h: wh };
  const wg = s.add.graphics().setDepth(0.5);
  const beam = s.add.graphics().setDepth(0.42).setBlendMode(Phaser.BlendModes.ADD);
  const draw = (night: boolean) => {
    wg.clear(); beam.clear();
    sky(wg, win, night);
    wg.fillStyle(night ? 0x2f6a3a : 0x7cc463, 1); wg.fillEllipse(win.x + win.w * 0.3, win.y + win.h, win.w * 0.9, win.h * 0.5); wg.fillStyle(night ? 0x24552e : 0x5fa84c, 1); wg.fillEllipse(win.x + win.w * 0.85, win.y + win.h, win.w * 0.7, win.h * 0.4);
    wg.lineStyle(7, 0xfff2d8, 1); wg.strokeRect(win.x, win.y, win.w, win.h); wg.lineBetween(win.x + win.w / 2, win.y, win.x + win.w / 2, win.y + win.h); wg.lineBetween(win.x, win.y + win.h / 2, win.x + win.w, win.y + win.h / 2);
    wg.lineStyle(3.5, 0x5a2e1c, 1); wg.strokeRect(win.x - 4, win.y - 4, win.w + 8, win.h + 8);
    if (!night) { beam.fillStyle(0xfff0b0, 0.1); beam.fillPoints([new Phaser.Math.Vector2(win.x, win.y + win.h), new Phaser.Math.Vector2(win.x + win.w, win.y + win.h), new Phaser.Math.Vector2(win.x + win.w + 150, ft + 150), new Phaser.Math.Vector2(win.x + 40, ft + 150)], true); }
  };
  draw(!lampOn);
  const cg = s.add.graphics().setDepth(0.6);
  cg.fillStyle(0xd8443a, 1); cg.fillRoundedRect(win.x - 26, win.y - 14, 34, win.h + 28, 12); cg.fillRoundedRect(win.x + win.w - 8, win.y - 14, 34, win.h + 28, 12);
  cg.fillStyle(0xffffff, 0.25); cg.fillRect(win.x - 18, win.y - 10, 6, win.h + 20); cg.fillRect(win.x + win.w, win.y - 10, 6, win.h + 20);
  cg.lineStyle(3.5, 0x5a2e1c, 1); cg.strokeRoundedRect(win.x - 26, win.y - 14, 34, win.h + 28, 12); cg.strokeRoundedRect(win.x + win.w - 8, win.y - 14, 34, win.h + 28, 12);
  cg.fillStyle(0x93532f, 1); cg.fillRoundedRect(win.x - 36, win.y - 22, win.w + 72, 12, 6); cg.strokeRoundedRect(win.x - 36, win.y - 22, win.w + 72, 12, 6);
  for (let i = 0; i < 5; i++) {
    const m = s.add.circle(win.x + win.w * (0.2 + 0.15 * i), win.y + win.h + 20 + i * 12, 2, 0xfff6d0, 0.8).setDepth(0.43);
    s.tweens.add({ targets: m, x: m.x + 26, y: m.y + 40, alpha: { from: 0.9, to: 0 }, duration: 3200 + i * 500, repeat: -1, delay: i * 700 });
  }
  return { window: win, redraw: draw, frame: 0x4a2810, warm: 0xff9a3c, props: [{ id: 'fire', x: fx - 24, y: fy - 22, w: fw + 48, h: fhh + 22 }] };
}

function sky(g: Gfx, win: Rect, night: boolean, top = 0x7cc8ff, bottom = 0xe3f6ff) {
  g.fillGradientStyle(night ? 0x14204a : top, night ? 0x14204a : top, night ? 0x3a4a85 : bottom, night ? 0x3a4a85 : bottom, 1);
  g.fillRect(win.x, win.y, win.w, win.h);
  if (night) {
    g.fillStyle(0xfff6c8, 1); g.fillCircle(win.x + win.w * 0.72, win.y + win.h * 0.3, 14); g.fillStyle(0x14204a, 1); g.fillCircle(win.x + win.w * 0.72 + 7, win.y + win.h * 0.3 - 4, 12);
    g.fillStyle(0xffffff, 0.9); for (const [a, b] of [[0.2, 0.25], [0.4, 0.15], [0.3, 0.55], [0.55, 0.4], [0.85, 0.65]]) g.fillCircle(win.x + win.w * a, win.y + win.h * b, 2);
  } else {
    g.fillStyle(0xffd34d, 1); g.fillCircle(win.x + win.w * 0.78, win.y + win.h * 0.28, 15);
    g.fillStyle(0xffffff, 0.95); g.fillEllipse(win.x + win.w * 0.3, win.y + win.h * 0.35, 54, 20); g.fillEllipse(win.x + win.w * 0.38, win.y + win.h * 0.3, 34, 22);
  }
}

// -------------------------------------------------------------------------------------------------- KITCHEN
// Bright and homey: white subway tile, sunny yellow band, teal backsplash, cabinets and counters, hanging pots, a gingham window.
function kitchen(s: Phaser.Scene, r: Rect, ft: number, lampOn: boolean): RoomArt {
  const g = s.add.graphics().setDepth(0);
  g.fillStyle(0xfdfaf0, 1); g.fillRoundedRect(r.x, r.y, r.w, ft - r.y + 20, { tl: rad, tr: rad, bl: 0, br: 0 });
  // Subway tiles.
  g.lineStyle(2, 0xc8dfe6, 1);
  for (let y = r.y + 22 + IN; y < ft - 76; y += 24) g.lineBetween(r.x + IN, y, r.x + r.w - IN, y);
  for (let y = r.y + 22 + IN, row = 0; y < ft - 76; y += 24, row++) for (let x = r.x + IN + (row % 2) * 30; x < r.x + r.w - IN; x += 60) g.lineBetween(x, y, x, Math.min(y + 24, ft - 76));
  g.fillStyle(0xffffff, 0.7); for (let x = r.x + 30; x < r.x + r.w - 30; x += 120) for (let y = r.y + 40; y < ft - 90; y += 72) g.fillRoundedRect(x, y, 14, 4, 2);
  // Sunny yellow band with white dots at the top.
  g.fillStyle(0xffc93c, 1); g.fillRoundedRect(r.x, r.y, r.w, 22, { tl: rad, tr: rad, bl: 0, br: 0 });
  g.fillStyle(0xffffff, 0.9); for (let x = r.x + 24; x < r.x + r.w - 10; x += 36) g.fillCircle(x, r.y + 11, 4);
  // Teal backsplash behind the counter, countertop, cabinet doors with knobs.
  g.fillStyle(0x2fb5a8, 1); g.fillRect(r.x, ft - 76, r.w, 24);
  g.fillStyle(0x66d3c6, 1); for (let x = r.x + 6; x < r.x + r.w; x += 24) g.fillRect(x, ft - 74, 12, 8);
  g.fillStyle(0xf4f7f8, 1); g.fillRect(r.x, ft - 54, r.w, 10); g.fillStyle(0xcdd8dc, 1); g.fillRect(r.x, ft - 46, r.w, 3);
  g.fillStyle(0xffe08a, 1); g.fillRect(r.x, ft - 43, r.w, 43);
  g.lineStyle(3, 0xd89a2c, 1);
  for (let x = r.x + 8; x < r.x + r.w - 60; x += 86) { g.strokeRoundedRect(x, ft - 38, 78, 32, 5); }
  g.fillStyle(0xe8604c, 1); for (let x = r.x + 8; x < r.x + r.w - 60; x += 86) g.fillCircle(x + 39, ft - 22, 4);
  // Floor: red + cream checkerboard.
  const fb = r.y + r.h - 26, rows = 6, cw = 64, rh = (fb - ft) / rows;
  g.fillStyle(0xfff6e2, 1); g.fillRect(r.x, ft, r.w, fb - ft);
  g.fillStyle(0xe8604c, 1);
  for (let i = 0; i < rows; i++) { const y0 = ft + i * rh; for (let x = r.x + (i % 2) * cw; x < r.x + r.w; x += cw * 2) g.fillRect(x, y0, Math.min(cw, r.x + r.w - x), rh); }
  g.fillStyle(0xb8402c, 1); g.fillRoundedRect(r.x, fb, r.w, r.y + r.h - fb, { tl: 0, tr: 0, bl: rad, br: rad });
  g.fillStyle(0x8a3a28, 1); g.fillRect(r.x, ft, r.w, 6);
  // Hanging pot rail with swaying pots.
  const ry = r.y + 44;
  const rail = s.add.graphics().setDepth(0.3);
  const rx0 = r.x + r.w * 0.16, rx1 = r.x + r.w * 0.6;
  rail.lineStyle(5, 0x4a4a4e, 1); rail.lineBetween(rx0, ry, rx1, ry); rail.fillStyle(0x4a4a4e, 1); rail.fillCircle(rx0, ry, 6); rail.fillCircle(rx1, ry, 6);
  const potDefs: [number, number, number][] = [[0.08, 0xd9d9de, 0], [0.34, 0xe8604c, 1], [0.58, 0xb48a58, 2], [0.82, 0x3a9fbf, 0]];
  potDefs.forEach(([t, col, kind], i) => {
    const hx = rx0 + (rx1 - rx0) * t;
    const c = s.add.container(hx, ry).setDepth(0.31);
    const p = s.add.graphics();
    p.lineStyle(3, 0x4a4a4e, 1); p.lineBetween(0, 0, 0, 18);
    if (kind === 2) { p.fillStyle(col, 1); p.fillRoundedRect(-4, 16, 8, 38, 3); p.fillEllipse(0, 62, 30, 24); p.lineStyle(2.5, 0x6a4a2a, 1); p.strokeEllipse(0, 62, 30, 24); }
    else { p.fillStyle(col, 1); p.fillRoundedRect(-17, 18, 34, 26, { tl: 3, tr: 3, bl: 10, br: 10 }); p.fillRect(-20, 16, 40, 5); p.lineStyle(2.5, 0x3a2a1c, 1); p.strokeRoundedRect(-17, 18, 34, 26, { tl: 3, tr: 3, bl: 10, br: 10 }); p.fillStyle(0xffffff, 0.45); p.fillRect(-12, 24, 6, 14); if (kind === 1) { p.fillStyle(col, 1); p.fillRect(17, 22, 22, 6); } }
    c.add(p);
    c.setAngle(-2.5);
    s.tweens.add({ targets: c, angle: 2.5, duration: 1700 + i * 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 200 });
  });
  // Open shelf of jars, right side.
  const shx = r.x + r.w * 0.8, shy = r.y + 70;
  const sh = s.add.graphics().setDepth(0.3);
  sh.fillStyle(0xb8744a, 1); sh.fillRoundedRect(shx, shy + 44, r.w * 0.14, 9, 3);
  const jar = (x: number, h: number, col: number) => { sh.fillStyle(col, 1); sh.fillRoundedRect(x, shy + 44 - h, 22, h, 5); sh.fillStyle(0xffffff, 0.5); sh.fillRect(x + 3, shy + 44 - h + 4, 4, h - 8); sh.fillStyle(0xe8604c, 1); sh.fillRect(x - 1, shy + 44 - h - 5, 24, 6); };
  jar(shx + 10, 32, 0xffd34d); jar(shx + 40, 40, 0x9bd16a); jar(shx + 70, 28, 0xff9fb2); if (r.w > 700) jar(shx + 100, 36, 0xffffff);
  // Gingham window.
  const ww = Math.min(200, r.w * 0.22), wh = Math.min(140, (ft - r.y) * 0.62);
  const win: Rect = { x: r.x + r.w * 0.4 - ww / 2, y: r.y + (ft - 76 - r.y - wh) / 2 + 14, w: ww, h: wh };
  const wg = s.add.graphics().setDepth(0.5);
  const draw = (night: boolean) => {
    wg.clear(); sky(wg, win, night);
    wg.fillStyle(night ? 0x2f6a3a : 0x8ed36a, 1); wg.fillEllipse(win.x + win.w * 0.3, win.y + win.h, win.w * 0.9, win.h * 0.5);
    wg.fillStyle(night ? 0x8a3a3a : 0xff5a5a, 1); for (const a of [0.2, 0.4, 0.62]) wg.fillCircle(win.x + win.w * a, win.y + win.h * 0.86, 5);
    wg.lineStyle(7, 0xffffff, 1); wg.strokeRect(win.x, win.y, win.w, win.h); wg.lineBetween(win.x + win.w / 2, win.y, win.x + win.w / 2, win.y + win.h);
    wg.lineStyle(3.5, 0x2f6f6a, 1); wg.strokeRect(win.x - 4, win.y - 4, win.w + 8, win.h + 8);
  };
  draw(!lampOn);
  const cg = s.add.graphics().setDepth(0.6);
  const gingham = (x: number, y: number, w: number, h: number) => {
    cg.fillStyle(0xffffff, 1); cg.fillRect(x, y, w, h);
    cg.fillStyle(0xe8604c, 0.8); for (let yy = 0; yy < h; yy += 14) cg.fillRect(x, y + yy, w, 7);
    for (let xx = 0; xx < w; xx += 14) cg.fillRect(x + xx, y, 7, h);
  };
  gingham(win.x - 20, win.y - 6, 28, win.h * 0.42); gingham(win.x + win.w - 8, win.y - 6, 28, win.h * 0.42);
  cg.lineStyle(3, 0xb8402c, 1); cg.strokeRect(win.x - 20, win.y - 6, 28, win.h * 0.42); cg.strokeRect(win.x + win.w - 8, win.y - 6, 28, win.h * 0.42);
  cg.fillStyle(0xb48a58, 1); cg.fillRoundedRect(win.x - 30, win.y - 14, win.w + 60, 9, 4); // rod
  cg.fillStyle(0xe8604c, 1); cg.fillRoundedRect(win.x + 10, win.y + win.h + 2, 30, 18, { tl: 2, tr: 2, bl: 8, br: 8 }); cg.fillStyle(0x4e9a3c, 1); cg.fillCircle(win.x + 25, win.y + win.h - 4, 10); cg.fillCircle(win.x + 16, win.y + win.h, 7); // sill pot
  // Sunny glints.
  for (let i = 0; i < 4; i++) { const sp = s.add.star(win.x + win.w * (0.2 + 0.2 * i), win.y + win.h * 0.3, 4, 1.5, 5, 0xffffff, 0.9).setDepth(0.55); loop(s, sp, { alpha: { from: 0.1, to: 1 }, scale: { from: 0.6, to: 1.3 }, duration: 900 + i * 220, delay: i * 250 }); }
  // 12.8 Kettle on the counter (tap: it whistles).
  const kx = r.x + r.w * 0.95, ky = ft - 54;
  const kc = s.add.container(kx, ky).setDepth(0.32);
  const kg = s.add.graphics();
  kg.fillStyle(0x2a1d14, 0.2); kg.fillEllipse(0, 0, 48, 8);
  kg.fillStyle(0xe8604c, 1); kg.fillRoundedRect(-19, -34, 38, 32, { tl: 14, tr: 14, bl: 8, br: 8 }); kg.fillTriangle(16, -22, 30, -34, 18, -12);
  kg.lineStyle(3, 0x4a3022, 1); kg.strokeRoundedRect(-19, -34, 38, 32, { tl: 14, tr: 14, bl: 8, br: 8 }); kg.lineBetween(16, -22, 30, -34);
  kg.lineStyle(4, 0x4a3022, 1); kg.beginPath(); kg.arc(-4, -34, 14, Math.PI * 1.05, Math.PI * 1.95); kg.strokePath();
  kg.fillStyle(0xffd45e, 1); kg.fillCircle(0, -38, 4); kg.fillStyle(0xffffff, 0.5); kg.fillEllipse(-9, -22, 6, 14);
  kc.add(kg);
  const kprop: Prop = { id: 'kettle', x: kx - 34, y: ky - 56, w: 68, h: 60, obj: kc };
  return { window: win, redraw: draw, frame: 0x2f6f6a, warm: 0xffe08a, props: [kprop] };
}

// -------------------------------------------------------------------------------------------------- WORKSHOP
// A rustic tool shop: weathered plank walls, a pegboard of tools, corrugated steel panelling, sawdust on the boards, a hanging bulb.
function workshop(s: Phaser.Scene, r: Rect, ft: number, lampOn: boolean): RoomArt {
  const g = s.add.graphics().setDepth(0);
  const rnd = seeded(7);
  g.fillStyle(0x9a6b3e, 1); g.fillRoundedRect(r.x, r.y, r.w, ft - r.y + 20, { tl: rad, tr: rad, bl: 0, br: 0 });
  // Vertical planks with grain, knots and nail heads.
  const pw = 54;
  for (let x = r.x, i = 0; x < r.x + r.w; x += pw, i++) {
    g.fillStyle(i % 2 ? 0x8d5f35 : 0xa6784a, 1); g.fillRect(x, r.y + IN, Math.min(pw, r.x + r.w - x), ft - r.y - IN);
    g.lineStyle(1.5, 0x6e4724, 0.55); for (let k = 0; k < 3; k++) g.lineBetween(x + 10 + k * 14, r.y + IN, x + 12 + k * 14, ft - 50);
    g.fillStyle(0x5a3a1c, 1); g.fillEllipse(x + 12 + rnd() * 28, r.y + 40 + rnd() * (ft - r.y - 150), 9, 13);
    g.fillStyle(0x3a2a1c, 1); g.fillCircle(x + 5, r.y + 28, 1.8); g.fillCircle(x + 5, ft - 70, 1.8);
  }
  g.lineStyle(3, 0x4a2e16, 1); for (let x = r.x + pw; x < r.x + r.w; x += pw) g.lineBetween(x, r.y + IN, x, ft - 50);
  g.fillStyle(0x4a2e16, 1); g.fillRoundedRect(r.x, r.y, r.w, 14, { tl: rad, tr: rad, bl: 0, br: 0 }); // ceiling beam
  // Corrugated steel lower wall.
  g.fillStyle(0x7d8c98, 1); g.fillRect(r.x, ft - 56, r.w, 56);
  for (let x = r.x; x < r.x + r.w; x += 12) { g.fillStyle(x % 24 ? 0x96a5b1 : 0x6a7885, 1); g.fillRect(x, ft - 52, 6, 52); }
  g.fillStyle(0x4a5560, 1); g.fillRect(r.x, ft - 60, r.w, 8); g.fillStyle(0xb9c5cf, 1); g.fillRect(r.x, ft - 60, r.w, 2);
  g.fillStyle(0xc65a3a, 0.35); for (let i = 0; i < 6; i++) g.fillEllipse(r.x + rnd() * r.w, ft - 8 - rnd() * 30, 40, 10); // rust
  // Floor: dark worn boards with oil stain and sawdust.
  const fh = r.y + r.h - ft;
  g.fillGradientStyle(0x7e5a3a, 0x7e5a3a, 0x5d4028, 0x5d4028, 1); g.fillRect(r.x, ft, r.w, fh - rad);
  g.fillStyle(0x5d4028, 1); g.fillRoundedRect(r.x, r.y + r.h - 40, r.w, 40, { tl: 0, tr: 0, bl: rad, br: rad });
  g.lineStyle(2.5, 0x3a2614, 0.8);
  for (let i = 1; i <= 6; i++) { const y = ft + (fh * i) / 6.5; g.lineBetween(r.x + IN, y, r.x + r.w - IN, y); }
  g.fillStyle(0x2a1c10, 0.4); g.fillEllipse(r.x + r.w * 0.3, ft + fh * 0.55, 110, 26);
  g.fillStyle(0xf0d79a, 0.75); for (let i = 0; i < 80; i++) g.fillCircle(r.x + IN + rnd() * (r.w - 2 * IN), ft + 6 + rnd() * (fh - 30), 1 + rnd() * 1.6);
  g.fillStyle(0xe2c27a, 0.7); for (let i = 0; i < 5; i++) g.fillEllipse(r.x + r.w * (0.2 + 0.15 * i), ft + fh * (0.3 + 0.12 * (i % 3)), 46, 9);
  g.fillStyle(0x2a1c10, 1); g.fillRect(r.x, ft, r.w, 6);
  // Pegboard of tools (left-centre), outlined tools hung on pegs.
  const pbw = Math.min(240, r.w * 0.2), pbx = r.x + r.w * 0.16, pby = r.y + 40, pbh = Math.min(110, ft - r.y - 150);
  const pg = s.add.graphics().setDepth(0.3);
  pg.fillStyle(0xd2b27a, 1); pg.fillRoundedRect(pbx, pby, pbw, pbh, 6); pg.lineStyle(4, 0x5a3a1c, 1); pg.strokeRoundedRect(pbx, pby, pbw, pbh, 6);
  pg.fillStyle(0x8a6a3a, 1); for (let x = pbx + 12; x < pbx + pbw - 6; x += 16) for (let y = pby + 12; y < pby + pbh - 6; y += 16) pg.fillCircle(x, y, 1.6);
  pg.fillStyle(0xe0a458, 0.55); pg.fillRect(pbx + 8, pby + pbh * 0.5 - 14, 38, 28); // outline patch
  const metal = 0xaab6c2, dk = 0x3a2a1c;
  pg.fillStyle(0xb8744a, 1); pg.fillRoundedRect(pbx + 20, pby + 22, 8, 40, 3); pg.fillStyle(metal, 1); pg.fillRoundedRect(pbx + 10, pby + 14, 28, 12, 3); pg.lineStyle(2, dk, 1); pg.strokeRoundedRect(pbx + 10, pby + 14, 28, 12, 3); // hammer
  pg.fillStyle(metal, 1); pg.fillTriangle(pbx + 60, pby + 20, pbx + 100, pby + 20, pbx + 100, pby + 56); pg.fillStyle(0xc9803f, 1); pg.fillRoundedRect(pbx + 100, pby + 20, 20, 12, 3); pg.lineStyle(2, dk, 1); pg.strokeTriangle(pbx + 60, pby + 20, pbx + 100, pby + 20, pbx + 100, pby + 56); // saw
  pg.lineStyle(7, 0xe8604c, 1); pg.beginPath(); pg.arc(pbx + 142, pby + 38, 14, 0.4, 5.9); pg.strokePath(); pg.fillStyle(0xe8604c, 1); pg.fillRoundedRect(pbx + 150, pby + 52, 8, 30, 3); // wrench
  pg.fillStyle(0xffd34d, 1); pg.fillRoundedRect(pbx + 180, pby + 18, 12, 44, 3); pg.fillStyle(metal, 1); pg.fillTriangle(pbx + 180, pby + 62, pbx + 192, pby + 62, pbx + 186, pby + 76); // screwdriver
  pg.fillStyle(0x3a9fbf, 1); pg.fillRoundedRect(pbx + 24, pby + pbh - 34, 30, 20, 3); pg.fillStyle(0xe8604c, 1); pg.fillRect(pbx + 24, pby + pbh - 34, 30, 6); // tape/paint tin
  pg.fillStyle(0xaab6c2, 1); pg.fillCircle(pbx + 86, pby + pbh - 24, 10); pg.fillCircle(pbx + 108, pby + pbh - 24, 10); pg.lineStyle(2, dk, 1); pg.strokeCircle(pbx + 86, pby + pbh - 24, 10); pg.strokeCircle(pbx + 108, pby + pbh - 24, 10); // pliers
  // Small shuttered window.
  const ww = Math.min(150, r.w * 0.16), wh = Math.min(100, (ft - r.y) * 0.46);
  const win: Rect = { x: r.x + r.w * 0.5 - ww / 2, y: r.y + 50, w: ww, h: wh };
  const wg = s.add.graphics().setDepth(0.5);
  const draw = (night: boolean) => {
    wg.clear(); sky(wg, win, night, 0xa8d8f0, 0xf0e2c0);
    wg.fillStyle(night ? 0x1c3a24 : 0x5fa84c, 1); wg.fillEllipse(win.x + win.w * 0.5, win.y + win.h, win.w * 1.1, win.h * 0.5);
    wg.fillStyle(0xffffff, night ? 0.1 : 0.22); wg.fillRect(win.x, win.y, win.w, win.h); // dusty glass
    wg.lineStyle(6, 0x3a2a1c, 1); wg.strokeRect(win.x, win.y, win.w, win.h); wg.lineBetween(win.x + win.w / 2, win.y, win.x + win.w / 2, win.y + win.h);
    wg.fillStyle(0x6b4a2a, 1); wg.fillRect(win.x - 24, win.y - 4, 20, win.h + 8); wg.fillRect(win.x + win.w + 4, win.y - 4, 20, win.h + 8);
    wg.lineStyle(2, 0x3a2a1c, 1); for (let i = 1; i < 4; i++) { wg.lineBetween(win.x - 24, win.y - 4 + (i * (win.h + 8)) / 4, win.x - 4, win.y - 4 + (i * (win.h + 8)) / 4); wg.lineBetween(win.x + win.w + 4, win.y - 4 + (i * (win.h + 8)) / 4, win.x + win.w + 24, win.y - 4 + (i * (win.h + 8)) / 4); }
    wg.lineStyle(3.5, 0x3a2a1c, 1); wg.strokeRect(win.x - 24, win.y - 4, 20, win.h + 8); wg.strokeRect(win.x + win.w + 4, win.y - 4, 20, win.h + 8);
  };
  draw(!lampOn);
  // Hanging bulb: cord, warm glow, a gentle swing; sawdust motes drift down through its light.
  const bx = r.x + r.w * 0.62, bulb = s.add.container(bx, r.y + 14).setDepth(0.45);
  const bg2 = s.add.graphics();
  bg2.lineStyle(3, 0x1a1a1a, 1); bg2.lineBetween(0, 0, 0, 52); bg2.fillStyle(0x4a4a4e, 1); bg2.fillRoundedRect(-7, 50, 14, 12, 3);
  bg2.fillStyle(0xfff0a0, 1); bg2.fillCircle(0, 74, 12); bg2.fillStyle(0xffffff, 0.9); bg2.fillCircle(-3, 70, 4);
  const glow = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  glowCircle(glow, 0, 74, 120, 0xffb84a, 0.05, 6);
  glow.fillStyle(0xffd27a, 0.045); glow.fillTriangle(-10, 80, 10, 80, 120, ft - r.y + 120); glow.fillTriangle(-10, 80, 10, 80, -120, ft - r.y + 120);
  bulb.add([glow, bg2]); bulb.setAngle(-2.5);
  s.tweens.add({ targets: bulb, angle: 2.5, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  loop(s, glow, { alpha: { from: 0.75, to: 1 }, duration: 430 });
  for (let i = 0; i < 9; i++) {
    const m = s.add.circle(bx - 70 + rnd() * 140, r.y + 90, 1.8 + rnd() * 1.4, 0xf4dc9a, 0.8).setDepth(0.46);
    s.tweens.add({ targets: m, y: ft + 40, x: m.x + (rnd() - 0.5) * 40, alpha: { from: 0.9, to: 0.1 }, duration: 5200 + rnd() * 2600, repeat: -1, delay: i * 550 });
  }
  // 12.8 Wall clock (tap: the cuckoo pops out).
  const wcx = r.x + r.w * 0.83, wcy = r.y + 100;
  const wc = s.add.container(wcx, wcy).setDepth(0.32);
  const wcg = s.add.graphics();
  wcg.fillStyle(0xb8744a, 1); wcg.fillTriangle(-30, -26, 0, -52, 30, -26); wcg.lineStyle(3, 0x3a2a1c, 1); wcg.strokeTriangle(-30, -26, 0, -52, 30, -26);
  wcg.fillStyle(0xfff4dc, 1); wcg.fillCircle(0, 0, 28); wcg.lineStyle(4, 0x3a2a1c, 1); wcg.strokeCircle(0, 0, 28);
  wcg.lineStyle(3, 0x3a2a1c, 1); wcg.lineBetween(0, 0, 0, -17); wcg.lineBetween(0, 0, 11, 6); wcg.fillStyle(0x3a2a1c, 1); wcg.fillCircle(0, 0, 3);
  for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6; wcg.fillCircle(Math.sin(a) * 22, -Math.cos(a) * 22, 1.6); }
  wcg.fillStyle(0x9aa6b2, 1); wcg.fillCircle(-12, 44, 6); wcg.fillCircle(12, 50, 6); wcg.lineStyle(2, 0x3a2a1c, 1); wcg.lineBetween(-12, 28, -12, 38); wcg.lineBetween(12, 28, 12, 44);
  wc.add(wcg);
  const wprop: Prop = { id: 'clock', x: wcx - 34, y: wcy - 54, w: 68, h: 110, obj: wc };
  return { window: win, redraw: draw, frame: 0x3a2614, warm: 0xffb84a, props: [wprop] };
}

// ---------------------------------------------------------------------------------------------------- GARDEN
// Fully outdoors: sky, drifting clouds, hills, trees, a picket fence, flower beds, butterflies and soft golden light. Not a room.
function garden(s: Phaser.Scene, r: Rect, ft: number, lampOn: boolean): RoomArt {
  const rnd = seeded(23);
  const night = !lampOn;
  const g = s.add.graphics().setDepth(0);
  const hz = ft - 8; // horizon (the fence line)
  // Sky.
  g.fillGradientStyle(0x4fb4ff, 0x4fb4ff, 0xcdf0ff, 0xcdf0ff, 1); g.fillRect(r.x, r.y, r.w, hz - r.y + 4);
  // Sun with soft halo.
  const sx = r.x + r.w * 0.82, sy = r.y + 70;
  g.fillStyle(0xfff2a0, 0.25); g.fillCircle(sx, sy, 78); g.fillStyle(0xfff2a0, 0.4); g.fillCircle(sx, sy, 54); g.fillStyle(0xffd23a, 1); g.fillCircle(sx, sy, 32);
  // Distant hills + tree line.
  g.fillStyle(0xa8dc8e, 1); g.fillEllipse(r.x + r.w * 0.25, hz + 6, r.w * 0.7, 150); g.fillEllipse(r.x + r.w * 0.8, hz + 6, r.w * 0.8, 120);
  g.fillStyle(0x7cc463, 1); g.fillEllipse(r.x + r.w * 0.55, hz + 12, r.w * 0.9, 90);
  for (let i = 0; i < 9; i++) {
    const tx = r.x + 40 + (i + rnd() * 0.5) * ((r.w - 80) / 9), th = 54 + rnd() * 40, tr = 26 + rnd() * 12;
    g.fillStyle(0x6b4a2e, 1); g.fillRect(tx - 4, hz - th * 0.5, 8, th * 0.5 + 6);
    g.fillStyle(i % 2 ? 0x3f9a4a : 0x4fae54, 1); g.fillCircle(tx, hz - th * 0.6, tr); g.fillCircle(tx - tr * 0.7, hz - th * 0.4, tr * 0.7); g.fillCircle(tx + tr * 0.7, hz - th * 0.4, tr * 0.7);
    g.fillStyle(0xffffff, 0.14); g.fillCircle(tx - tr * 0.3, hz - th * 0.7, tr * 0.45);
  }
  // Lawn: soft mowed stripes sloping toward the viewer.
  const fh = r.y + r.h - hz;
  g.fillGradientStyle(0x86d45e, 0x86d45e, 0x56a843, 0x56a843, 1); g.fillRect(r.x, hz, r.w, fh - rad);
  g.fillStyle(0x56a843, 1); g.fillRoundedRect(r.x, r.y + r.h - 40, r.w, 40, { tl: 0, tr: 0, bl: rad, br: rad });
  g.fillStyle(0xffffff, 0.06); for (let x = r.x; x < r.x + r.w; x += 120) g.fillRect(x, hz, 60, fh - rad);
  // Stepping-stone path from the gate.
  g.fillStyle(0xd9cbb0, 1); for (let i = 0; i < 6; i++) g.fillEllipse(r.x + 80 + i * (r.w * 0.06), ft + 40 + (i % 2) * 14 + i * 6, 52, 24);
  g.fillStyle(0xb8a888, 1); for (let i = 0; i < 6; i++) g.fillEllipse(r.x + 80 + i * (r.w * 0.06), ft + 44 + (i % 2) * 14 + i * 6, 52, 14);
  // Flower beds: soil strips with rows of blooms.
  const beds: [number, number, number][] = [[0.3, 0.2, 0xff6f91], [0.62, 0.26, 0xffd23a], [0.88, 0.2, 0xb084f2]];
  const blooms: { x: number; y: number; c: number }[] = [];
  for (const [bx, by, col] of beds) {
    const x0 = r.x + r.w * bx - r.w * 0.09, y0 = hz + fh * by, w = r.w * 0.18;
    g.fillStyle(0x6b4428, 1); g.fillRoundedRect(x0, y0, w, 30, 12); g.fillStyle(0x84583a, 1); g.fillRoundedRect(x0 + 4, y0 + 3, w - 8, 12, 8);
    g.fillStyle(0x4e9a3c, 1); for (let x = x0 + 12; x < x0 + w - 8; x += 18) g.fillTriangle(x - 6, y0 + 8, x + 6, y0 + 8, x, y0 - 12);
    for (let x = x0 + 14; x < x0 + w - 8; x += 22) blooms.push({ x, y: y0 - 6 - ((x / 22) % 2) * 6, c: col });
  }
  blooms.forEach((b, i) => {
    const c = s.add.container(b.x, b.y + 14).setDepth(0.3);
    const f = s.add.graphics();
    f.lineStyle(3, 0x3f8a3a, 1); f.lineBetween(0, 0, 0, -22);
    f.fillStyle(b.c, 1); for (let k = 0; k < 6; k++) f.fillCircle(Math.cos(k * 1.047) * 7, -26 + Math.sin(k * 1.047) * 7, 5.5);
    f.fillStyle(0xfff4a0, 1); f.fillCircle(0, -26, 4.5);
    c.add(f); c.setAngle(-4);
    s.tweens.add({ targets: c, angle: 4, duration: 1500 + (i % 5) * 220, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (i % 4) * 160 });
  });
  // White picket fence along the horizon.
  const fg = s.add.graphics().setDepth(0.25);
  fg.fillStyle(0xe8dcc0, 1); fg.fillRect(r.x + IN, hz - 26, r.w - 2 * IN, 6); fg.fillRect(r.x + IN, hz - 8, r.w - 2 * IN, 6);
  fg.fillStyle(0xfffaf0, 1);
  for (let x = r.x + IN + 4; x < r.x + r.w - IN - 20; x += 26) { fg.fillRect(x, hz - 44, 16, 52); fg.fillTriangle(x, hz - 44, x + 16, hz - 44, x + 8, hz - 54); }
  fg.fillStyle(0x000000, 0.08); for (let x = r.x + IN + 4; x < r.x + r.w - IN - 20; x += 26) fg.fillRect(x + 11, hz - 44, 5, 52);
  // Drifting clouds.
  for (let i = 0; i < 4; i++) {
    const c = s.add.container(r.x + rnd() * r.w, r.y + 30 + rnd() * 70).setDepth(0.05);
    const cg = s.add.graphics(); cg.fillStyle(0xffffff, 0.95); cg.fillEllipse(0, 0, 90, 28); cg.fillEllipse(-26, -10, 50, 26); cg.fillEllipse(20, -14, 56, 30);
    c.add(cg); c.setScale(0.8 + rnd() * 0.6);
    s.tweens.add({ targets: c, x: c.x + 90 + rnd() * 60, duration: 9000 + rnd() * 5000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  // Soft light shafts from the sun + a golden wash.
  const rays = s.add.graphics().setDepth(0.04).setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 3; i++) { rays.fillStyle(0xfff4b0, 0.08); const bx = sx - 60 - i * 200; rays.fillTriangle(sx - 14, sy + 10, bx - 70, hz + 150, bx + 70, hz + 150); }
  loop(s, rays, { alpha: { from: 0.5, to: 1 }, duration: 3400 });
  s.add.rectangle(r.x, r.y, r.w, r.h, 0xffe9a8, 0.06).setOrigin(0).setDepth(498).setBlendMode(Phaser.BlendModes.ADD);
  // Butterflies and a bee, wandering.
  const wander = (c: Phaser.GameObjects.Container, minY: number, maxY: number) => {
    const go = () => {
      if (!c.scene) return;
      const nx = Phaser.Math.Clamp(c.x + (Math.random() - 0.5) * 320, r.x + 40, r.x + r.w - 40), ny = Phaser.Math.Clamp(c.y + (Math.random() - 0.5) * 120, minY, maxY);
      s.tweens.add({ targets: c, x: nx, y: ny, duration: 1800 + Math.random() * 1600, ease: 'Sine.easeInOut', onComplete: go });
    };
    go();
  };
  const bfly = (x: number, y: number, col: number, d: number) => {
    const c = s.add.container(x, y).setDepth(2.5);
    const wg = s.add.graphics(); wg.fillStyle(col, 1); wg.fillEllipse(-6, -3, 12, 14); wg.fillEllipse(6, -3, 12, 14); wg.fillStyle(0xffffff, 0.8); wg.fillCircle(-6, -4, 2.5); wg.fillCircle(6, -4, 2.5);
    wg.fillStyle(0x3a2a1c, 1); wg.fillRoundedRect(-1.5, -7, 3, 15, 1.5);
    c.add(wg); s.tweens.add({ targets: wg, scaleX: { from: 1, to: 0.35 }, duration: 140 + d * 20, yoyo: true, repeat: -1 });
    wander(c, hz + 20, r.y + r.h - 90);
  };
  bfly(r.x + r.w * 0.35, hz + 90, 0xff9f43, 1); bfly(r.x + r.w * 0.6, hz + 70, 0x6fb8e8, 3); bfly(r.x + r.w * 0.8, hz + 110, 0xff7aa8, 5);
  if (night) s.add.rectangle(r.x, r.y, r.w, r.h, 0x0b1440, 0.2).setOrigin(0).setDepth(497);
  // 12.8 Lantern post by the path (tap: it swings and glows).
  const glx = r.x + r.w * 0.87, gly = hz + 34;
  const gp = s.add.graphics().setDepth(0.33);
  gp.fillStyle(0x2a1d14, 0.2); gp.fillEllipse(glx, gly, 40, 9);
  gp.fillStyle(0x4a3c2c, 1); gp.fillRoundedRect(glx - 5, gly - 130, 10, 130, 3); gp.fillRoundedRect(glx - 5, gly - 130, 54, 8, 3);
  const gc = s.add.container(glx + 44, gly - 122).setDepth(0.34);
  const gg = s.add.graphics();
  gg.lineStyle(3, 0x3a2a1c, 1); gg.lineBetween(0, 0, 0, 10); gg.fillStyle(0x3a2a1c, 1); gg.fillRoundedRect(-11, 8, 22, 6, 3); gg.fillRoundedRect(-11, 44, 22, 6, 3);
  gg.fillStyle(0xffe08a, 1); gg.fillRoundedRect(-9, 14, 18, 30, 5); gg.lineStyle(3, 0x3a2a1c, 1); gg.strokeRoundedRect(-9, 14, 18, 30, 5); gg.fillStyle(0xfff6c8, 1); gg.fillEllipse(0, 30, 8, 14);
  gc.add(gg); s.tweens.add({ targets: gc, angle: { from: -2, to: 2 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const gprop: Prop = { id: 'lantern', x: glx + 20, y: gly - 136, w: 50, h: 70, obj: gc };
  return { window: null, redraw: () => {}, frame: 0x3f7a3a, warm: 0xffe9a8, props: [gprop] };
}

// --------------------------------------------------------------------------------------------------- FISH HUT
// A lakeside cabin: honey log walls, a big open window onto the water (shimmer, boat, mountains), nets, floats and a lantern.
function fishhut(s: Phaser.Scene, r: Rect, ft: number, lampOn: boolean): RoomArt {
  const g = s.add.graphics().setDepth(0);
  const rnd = seeded(31);
  g.fillStyle(0xc8934f, 1); g.fillRoundedRect(r.x, r.y, r.w, ft - r.y + 20, { tl: rad, tr: rad, bl: 0, br: 0 });
  // Horizontal logs.
  const lh = 34;
  for (let y = r.y + IN, i = 0; y < ft - 52; y += lh, i++) {
    g.fillStyle(i % 2 ? 0xb9833f : 0xd19c58, 1); g.fillRoundedRect(r.x + IN, y, r.w - 2 * IN, lh - 3, 12);
    g.fillStyle(0xffffff, 0.12); g.fillRect(r.x + IN + 10, y + 4, r.w - 2 * IN - 20, 4);
    g.lineStyle(1.5, 0x7a4d1e, 0.5); for (let k = 0; k < 5; k++) { const lx = r.x + IN + 30 + ((k * 211 + i * 97) % (r.w - 80)); g.lineBetween(lx, y + 12, lx + 40, y + 12); }
    g.fillStyle(0x7a4d1e, 1); g.fillCircle(r.x + IN + 6, y + lh / 2 - 1, 4); g.fillCircle(r.x + r.w - IN - 6, y + lh / 2 - 1, 4);
  }
  // Painted navy wainscot with a rope trim.
  g.fillStyle(0x1f5f86, 1); g.fillRect(r.x, ft - 56, r.w, 56);
  g.fillStyle(0x2b7aa8, 1); for (let x = r.x + 6; x < r.x + r.w - 6; x += 22) g.fillRect(x, ft - 50, 10, 50);
  g.lineStyle(5, 0xf0dca8, 1); g.beginPath(); g.moveTo(r.x, ft - 58); for (let x = r.x; x <= r.x + r.w; x += 14) g.lineTo(x, ft - 58 + (((x - r.x) / 14) % 2 ? 4 : -4)); g.strokePath();
  // Floor: grey weathered planks with gaps.
  const fh = r.y + r.h - ft;
  g.fillGradientStyle(0xb7a58a, 0xb7a58a, 0x8d7a60, 0x8d7a60, 1); g.fillRect(r.x, ft, r.w, fh - rad);
  g.fillStyle(0x8d7a60, 1); g.fillRoundedRect(r.x, r.y + r.h - 40, r.w, 40, { tl: 0, tr: 0, bl: rad, br: rad });
  g.lineStyle(3, 0x4a3c2c, 0.85); for (let i = 1; i <= 6; i++) { const y = ft + (fh * i) / 6.5; g.lineBetween(r.x + IN, y, r.x + r.w - IN, y); }
  g.fillStyle(0xffffff, 0.12); for (let i = 0; i < 8; i++) g.fillEllipse(r.x + rnd() * r.w, ft + 10 + rnd() * fh * 0.8, 70, 6);
  g.fillStyle(0x4a3c2c, 1); g.fillRect(r.x, ft, r.w, 6);
  // Fishing net hung on the wall with orange floats (left-centre) + a little buoy.
  const nx = r.x + r.w * 0.2, ny = r.y + 34, nw = Math.min(210, r.w * 0.18), nh = Math.min(120, ft - r.y - 120);
  const ng = s.add.graphics().setDepth(0.3);
  ng.lineStyle(2, 0xf0e4c0, 0.95);
  for (let i = -nh; i < nw; i += 18) { ng.lineBetween(nx + Math.max(0, i), ny + Math.max(0, -i), nx + Math.min(nw, i + nh), ny + Math.min(nh, nw - i)); }
  for (let i = 0; i < nw + nh; i += 18) { ng.lineBetween(nx + Math.min(nw, i), ny + Math.max(0, i - nw), nx + Math.max(0, i - nh), ny + Math.min(nh, i)); }
  ng.lineStyle(5, 0x6b4a2a, 1); ng.lineBetween(nx - 6, ny, nx + nw + 6, ny);
  ng.fillStyle(0xff7a2a, 1); for (let x = nx + 14; x < nx + nw; x += 46) { ng.fillCircle(x, ny + 4, 8); ng.lineStyle(2, 0x6b2a0a, 1); ng.strokeCircle(x, ny + 4, 8); }
  ng.fillStyle(0xfff4dc, 1); for (let x = nx + 14; x < nx + nw; x += 46) ng.fillRect(x - 8, ny - 1, 16, 4);
  // Big open window onto the lake.
  const ww = Math.min(330, r.w * 0.3), wh = Math.min(150, (ft - r.y) * 0.64);
  const win: Rect = { x: r.x + r.w * 0.5 - ww / 2 + r.w * 0.04, y: r.y + (ft - 58 - r.y - wh) / 2, w: ww, h: wh };
  const wg = s.add.graphics().setDepth(0.5);
  const shim: Phaser.GameObjects.Ellipse[] = [];
  const draw = (night: boolean) => {
    wg.clear();
    wg.fillGradientStyle(night ? 0x14204a : 0x58b6ff, night ? 0x14204a : 0x58b6ff, night ? 0x3a4a85 : 0xcdefff, night ? 0x3a4a85 : 0xcdefff, 1); wg.fillRect(win.x, win.y, win.w, win.h * 0.55);
    const wy = win.y + win.h * 0.55;
    wg.fillStyle(night ? 0x2b3a66 : 0x8aa6c8, 1); wg.fillTriangle(win.x, wy, win.x + win.w * 0.3, win.y + win.h * 0.2, win.x + win.w * 0.6, wy); wg.fillTriangle(win.x + win.w * 0.4, wy, win.x + win.w * 0.72, win.y + win.h * 0.12, win.x + win.w, wy);
    wg.fillStyle(night ? 0x1c2a52 : 0xeaf2fb, 1); wg.fillTriangle(win.x + win.w * 0.72 - 14, win.y + win.h * 0.12 + 22, win.x + win.w * 0.72, win.y + win.h * 0.12, win.x + win.w * 0.72 + 14, win.y + win.h * 0.12 + 22);
    if (night) { wg.fillStyle(0xfff6c8, 1); wg.fillCircle(win.x + win.w * 0.18, win.y + win.h * 0.2, 12); } else { wg.fillStyle(0xffd34d, 1); wg.fillCircle(win.x + win.w * 0.15, win.y + win.h * 0.2, 14); wg.fillStyle(0xffffff, 0.95); wg.fillEllipse(win.x + win.w * 0.42, win.y + win.h * 0.22, 50, 16); }
    wg.fillGradientStyle(night ? 0x1b3f6a : 0x3fa0d8, night ? 0x1b3f6a : 0x3fa0d8, night ? 0x0f2a4a : 0x1f78b0, night ? 0x0f2a4a : 0x1f78b0, 1); wg.fillRect(win.x, wy, win.w, win.h * 0.45);
    wg.fillStyle(night ? 0x2e4a2e : 0x4fae54, 1); wg.fillEllipse(win.x + win.w * 0.05, wy, win.w * 0.3, 20); wg.fillEllipse(win.x + win.w * 0.97, wy, win.w * 0.3, 22);
    wg.fillStyle(0xfff7e0, 1); wg.fillTriangle(win.x + win.w * 0.55, wy + 10, win.x + win.w * 0.55, wy - 26, win.x + win.w * 0.55 + 22, wy + 10); wg.fillStyle(0xe8604c, 1); wg.fillRoundedRect(win.x + win.w * 0.55 - 20, wy + 8, 48, 9, { tl: 0, tr: 0, bl: 8, br: 8 }); // sailboat
    wg.lineStyle(7, 0x6b4a2a, 1); wg.strokeRect(win.x, win.y, win.w, win.h); wg.lineBetween(win.x + win.w / 2, win.y, win.x + win.w / 2, win.y + win.h);
    wg.lineStyle(3.5, 0x3a2412, 1); wg.strokeRect(win.x - 4, win.y - 4, win.w + 8, win.h + 8);
    wg.fillStyle(0x6b4a2a, 1); wg.fillRoundedRect(win.x - 12, win.y + win.h + 4, win.w + 24, 12, 4);
    wg.fillStyle(0xf0f8ff, night ? 0.18 : 0.12); wg.fillRect(win.x + 6, win.y + 6, 16, win.h - 12); // glass glint
  };
  draw(!lampOn);
  // Water shimmer (animated lines in the lake part) + the boat bobbing.
  const wy0 = win.y + win.h * 0.55;
  for (let i = 0; i < 9; i++) {
    const e = s.add.ellipse(win.x + 14 + rnd() * (win.w - 28), wy0 + 10 + rnd() * (win.h * 0.45 - 24), 18 + rnd() * 20, 3, 0xffffff, 0.85).setDepth(0.55);
    shim.push(e); s.tweens.add({ targets: e, x: e.x + 16, alpha: { from: 0.15, to: 0.9 }, duration: 1200 + rnd() * 1200, yoyo: true, repeat: -1, delay: i * 180 });
  }
  // Open shutters + curtains of rope: little hanging lantern with flicker, right.
  const lx = r.x + r.w * 0.84, lc = s.add.container(lx, r.y + 12).setDepth(0.45);
  const lg = s.add.graphics();
  lg.lineStyle(3, 0x3a2a1c, 1); lg.lineBetween(0, 0, 0, 40); lg.fillStyle(0x3a2a1c, 1); lg.fillRoundedRect(-14, 38, 28, 7, 3); lg.fillRoundedRect(-14, 80, 28, 7, 3);
  lg.fillStyle(0xffd27a, 1); lg.fillRoundedRect(-11, 45, 22, 35, 5); lg.lineStyle(3, 0x3a2a1c, 1); lg.strokeRoundedRect(-11, 45, 22, 35, 5); lg.lineBetween(0, 45, 0, 80);
  lg.fillStyle(0xfff4c0, 1); lg.fillEllipse(0, 64, 10, 18);
  const lglow = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD); glowCircle(lglow, 0, 64, 110, 0xffa83a, 0.05, 6);
  lc.add([lglow, lg]); lc.setAngle(-3); s.tweens.add({ targets: lc, angle: 3, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  loop(s, lglow, { alpha: { from: 0.7, to: 1 }, duration: 520 });
  // Cool lake light drifting over the floor from the window (ripples).
  const rip = s.add.graphics().setDepth(0.42).setBlendMode(Phaser.BlendModes.ADD);
  rip.fillStyle(0x8ad8ff, 0.07); rip.fillPoints([new Phaser.Math.Vector2(win.x, win.y + win.h), new Phaser.Math.Vector2(win.x + win.w, win.y + win.h), new Phaser.Math.Vector2(win.x + win.w + 120, ft + 140), new Phaser.Math.Vector2(win.x - 40, ft + 140)], true);
  loop(s, rip, { alpha: { from: 0.45, to: 1 }, duration: 2200 });
  return { window: win, redraw: draw, frame: 0x24485f, warm: 0xffa83a, props: [{ id: 'net', x: nx - 6, y: ny - 6, w: nw + 12, h: nh + 12, obj: ng }, { id: 'lantern', x: lx - 24, y: r.y + 6, w: 40, h: 54, obj: lc }] };
}
