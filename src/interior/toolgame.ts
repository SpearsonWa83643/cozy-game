// 12.2 Workshop tools: tap the tool wall, pick a tool, and play a little fix-it game on a big card.
//   wrench -> tighten 3 bolts on a machine   hammer -> nail a board flat   screwdriver -> unscrew a panel
//   saw -> cut a plank in three              paintbrush -> paint a birdhouse
// Every game is tap-only (no drag), forgiving, and ends with a small thing for the room (or a bit of wood/stone
// if you already have one). Bold outlines, same cozy look as the rest of the interiors.
import Phaser from 'phaser';
import { sfx } from '../audio';
import { DPR } from '../dpr';
import { save, persist } from '../save';
import { theme } from '../theme';
import { FURN, furnTexture } from './furniture';
import type { InteriorScene } from '../scenes/Interior';

export type ToolKind = 'wrench' | 'hammer' | 'screwdriver' | 'saw' | 'paint';
export const TOOLS: { id: ToolKind; name: string; line: string; reward: string; bonus: 'wood' | 'stone' }[] = [
  { id: 'wrench', name: 'Wrench', line: 'Fix the machine', reward: 'cog', bonus: 'stone' },
  { id: 'hammer', name: 'Hammer', line: 'Nail the board', reward: 'sign', bonus: 'wood' },
  { id: 'screwdriver', name: 'Screwdriver', line: 'Open the panel', reward: 'musicbox', bonus: 'stone' },
  { id: 'saw', name: 'Saw', line: 'Cut the plank', reward: 'stool', bonus: 'wood' },
  { id: 'paint', name: 'Paintbrush', line: 'Paint a birdhouse', reward: 'paintedhouse', bonus: 'wood' },
];
/** Live state, exposed for tests as __interior.tool. */
export type ToolState = { kind: ToolKind | 'pick'; done: number; total: number; finished: boolean; alive: boolean };

const OUTC = 0x4a3022;
const INK = '#3d2c20';
const D = 1100;
type Pt = { x: number; y: number };
type G = Phaser.GameObjects.Graphics;

function poly(g: G, pts: Pt[], fill: number, lw = 3) {
  g.fillStyle(fill, 1); g.fillPoints(pts as any, true, true); g.lineStyle(lw, OUTC, 1); g.strokePoints(pts as any, true, true);
}
function rrect(g: G, x: number, y: number, w: number, h: number, r: number, fill: number, lw = 3) {
  g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h, r); g.lineStyle(lw, OUTC, 1); g.strokeRoundedRect(x, y, w, h, r);
}
function circ(g: G, x: number, y: number, r: number, fill: number, lw = 3) {
  g.fillStyle(fill, 1); g.fillCircle(x, y, r); g.lineStyle(lw, OUTC, 1); g.strokeCircle(x, y, r);
}
const hexPts = (r: number): Pt[] => Array.from({ length: 6 }, (_, i) => ({ x: Math.cos(i * Math.PI / 3 + Math.PI / 6) * r, y: Math.sin(i * Math.PI / 3 + Math.PI / 6) * r }));
const cogPts = (r: number, teeth = 8): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth;
    for (const [da, rr] of [[-w * 0.9, r * 0.8], [-w * 0.55, r], [w * 0.55, r], [w * 0.9, r * 0.8]] as [number, number][]) out.push({ x: Math.cos(a + da) * rr, y: Math.sin(a + da) * rr });
  }
  return out;
};

/** Draw a tool standing up, its working tip at (0, 0). */
export function drawTool(g: G, kind: ToolKind, color = 0xe8604c) {
  g.clear();
  switch (kind) {
    case 'wrench':
      g.lineStyle(28, OUTC, 1); g.strokeCircle(0, 0, 22); g.lineStyle(17, 0xc9d3dc, 1); g.strokeCircle(0, 0, 22);
      rrect(g, -9, -128, 18, 106, 8, 0xc9d3dc, 3.5); circ(g, 0, -118, 5, 0x6f7f8c, 2.5);
      g.lineStyle(3, 0xffffff, 0.7); g.lineBetween(-3, -100, -3, -40);
      break;
    case 'hammer':
      rrect(g, -8, -130, 16, 104, 7, 0xc98a55, 3.5);
      rrect(g, -42, -36, 84, 36, 9, 0xaab6c2, 3.5); g.fillStyle(0x7f8d9a, 1); g.fillRect(-38, -12, 76, 8);
      g.lineStyle(3, 0xffffff, 0.7); g.lineBetween(-30, -28, 10, -28);
      break;
    case 'screwdriver':
      poly(g, [{ x: -5, y: -10 }, { x: 5, y: -10 }, { x: 3, y: 0 }, { x: -3, y: 0 }], 0xcfd6dc, 2.5);
      rrect(g, -4, -76, 8, 68, 2, 0xcfd6dc, 2.5);
      rrect(g, -15, -140, 30, 70, 12, color, 3.5); g.lineStyle(3, 0x4a3022, 0.5); for (const y of [-120, -108, -96, -84]) g.lineBetween(-12, y, 12, y);
      break;
    case 'saw':
      rrect(g, -120, -64, 44, 54, 12, 0xc98a55, 3.5); circ(g, -98, -40, 8, 0xfbf1dc, 3);
      poly(g, [{ x: -78, y: -54 }, { x: 80, y: -54 }, { x: 80, y: -10 }, { x: -78, y: -10 }], 0xc9d3dc, 3.5);
      for (let x = -74; x < 74; x += 12) poly(g, [{ x, y: -10 }, { x: x + 12, y: -10 }, { x: x + 6, y: 2 }], 0xc9d3dc, 2);
      g.lineStyle(3, 0xffffff, 0.7); g.lineBetween(-60, -44, 60, -44);
      break;
    case 'paint':
      poly(g, [{ x: -10, y: -34 }, { x: 10, y: -34 }, { x: 12, y: -16 }, { x: 0, y: 2 }, { x: -12, y: -16 }], color, 3);
      rrect(g, -12, -52, 24, 20, 4, 0xc9d3dc, 3);
      rrect(g, -7, -132, 14, 84, 7, 0xc98a55, 3.5);
      break;
  }
}

type Panel = { objs: Phaser.GameObjects.GameObject[]; px: number; py: number; pw: number; ph: number; close: () => void };

function makePanel(s: InteriorScene, title: string, pw: number, ph: number, onClose?: () => void): Panel {
  const rm = s.room, objs: Phaser.GameObjects.GameObject[] = [];
  const px = rm.x + rm.w / 2 - pw / 2, py = Math.max(rm.y + 2, rm.y + rm.h / 2 - ph / 2);
  const close = () => {
    objs.forEach((o) => o.destroy());
    for (const k of Object.keys(s.rects)) if (k.startsWith('tool')) delete s.rects[k];
    if (s.tool) s.tool.alive = false;
    s.tool = null; s.pickerOpen = false;
    onClose?.();
  };
  const dim = s.add.rectangle(0, 0, s.w, s.h, 0x2a1d14, 0.4).setOrigin(0).setDepth(D).setInteractive(); objs.push(dim);
  const g = s.add.graphics().setDepth(D + 1);
  g.fillStyle(0x2a1d14, 0.25); g.fillRoundedRect(px + 2, py + 6, pw, ph, 28);
  g.fillStyle(0xfbf1dc, 1); g.fillRoundedRect(px, py, pw, ph, 28);
  g.lineStyle(4, 0xd9b98f, 1); g.strokeRoundedRect(px + 5, py + 5, pw - 10, ph - 10, 24);
  objs.push(g);
  objs.push(s.add.zone(px, py, pw, ph).setOrigin(0).setInteractive().setDepth(D + 1));
  objs.push(s.text(px + pw / 2, py + 34, title, 28, INK, 900).setOrigin(0.5).setDepth(D + 2));
  const cx = px + pw - 54, cy = py + 12;
  const r = { x: cx, y: cy, w: 44, h: 44 };
  const bg = s.add.graphics().setDepth(D + 2);
  bg.fillStyle(0x2a1d14, 0.2); bg.fillRoundedRect(r.x + 1, r.y + 3, r.w, r.h, 22);
  bg.fillStyle(0xf3e6cc, 1); bg.fillRoundedRect(r.x, r.y, r.w, r.h, 22); bg.lineStyle(3, 0xd9b98f, 1); bg.strokeRoundedRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 21);
  bg.lineStyle(4.5, 0x6b4a33, 1); bg.lineBetween(cx + 14, cy + 14, cx + 30, cy + 30); bg.lineBetween(cx + 30, cy + 14, cx + 14, cy + 30);
  objs.push(bg);
  s.rects['tool-close'] = r;
  objs.push(zone(s, r, () => { sfx.blip(); close(); }, D + 6));
  return { objs, px, py, pw, ph, close };
}

function zone(s: InteriorScene, r: { x: number; y: number; w: number; h: number }, onTap: () => void, depth = D + 5) {
  const z = s.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive().setDepth(depth);
  z.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 24) onTap(); });
  return z;
}

// ---------------------------------------------------------------------------------------------------- picker
/** Tap the tool wall: a card with the five tools. */
export function openToolPicker(s: InteriorScene): string {
  if (s.pickerOpen || s.tool) return 'pick';
  s.pickerOpen = true;
  const rm = s.room;
  const n = TOOLS.length, cw = Math.min(150, (rm.w - 60 - (n - 1) * 12) / n), ch = cw + 52;
  const pw = n * cw + (n - 1) * 12 + 48, ph = ch + 112;
  const p = makePanel(s, 'Pick a tool!', pw, ph);
  s.tool = { kind: 'pick', done: 0, total: 0, finished: false, alive: true };
  TOOLS.forEach((t, i) => {
    const r = { x: p.px + 24 + i * (cw + 12), y: p.py + 66, w: cw, h: ch };
    const g = s.add.graphics().setDepth(D + 2);
    g.fillStyle(0x2a1d14, 0.18); g.fillRoundedRect(r.x + 1, r.y + 4, r.w, r.h, 18);
    g.fillStyle(0xfffaf0, 1); g.fillRoundedRect(r.x, r.y, r.w, r.h, 18);
    g.lineStyle(3.5, theme.ui.accent, 1); g.strokeRoundedRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 16);
    p.objs.push(g);
    const ig = s.add.graphics();
    drawTool(ig, t.id);
    const sc = (cw - 40) / 150;
    const c = s.add.container(r.x + r.w / 2 + (t.id === 'saw' ? 6 : 0), r.y + (t.id === 'saw' ? cw * 0.62 : cw * 0.82), [ig]).setScale(sc).setDepth(D + 3).setAngle(t.id === 'saw' ? 0 : 14);
    p.objs.push(c);
    p.objs.push(s.text(r.x + r.w / 2, r.y + cw + 4, t.name, 19, INK, 900).setOrigin(0.5).setDepth(D + 3));
    p.objs.push(s.text(r.x + r.w / 2, r.y + cw + 28, t.line, 14, '#6b4f3a', 800).setOrigin(0.5).setDepth(D + 3).setWordWrapWidth(cw - 10).setAlign('center'));
    s.rects[`tool:pick:${t.id}`] = r;
    p.objs.push(zone(s, r, () => { sfx.pickup(); p.close(); openStation(s, t.id); }));
  });
  p.objs.push(s.text(p.px + pw / 2, p.py + ph - 26, 'Tap a tool to start!', 19, '#6b4f3a', 800).setOrigin(0.5).setDepth(D + 2));
  s.lastAction = 'toolwall:open';
  return 'tools';
}

// ---------------------------------------------------------------------------------------------------- stations
type Ctx = {
  s: InteriorScene; p: Panel; st: ToolState; stage: Phaser.GameObjects.Container; k: number; cx: number; cy: number;
  sr: (lx: number, ly: number, w: number, h: number) => { x: number; y: number; w: number; h: number };
  add: <T extends Phaser.GameObjects.GameObject>(o: T) => T;
  tapZone: (id: string, lx: number, ly: number, w: number, h: number, fn: () => void) => void;
  tool: Phaser.GameObjects.Container; toolG: G; go: (lx: number, ly: number, ms?: number) => void;
  step: (n?: number) => void; pips: () => void; fx: (lx: number, ly: number, color: number, n?: number) => void;
  finish: (kind: ToolKind, msg: string) => void;
};

export function openStation(s: InteriorScene, kind: ToolKind): string {
  if (s.tool) return 'busy';
  const def = TOOLS.find((t) => t.id === kind)!;
  const rm = s.room;
  const pw = Math.min(rm.w - 16, 780), ph = Math.min(rm.h - 4, 500);
  const p = makePanel(s, `${def.name}: ${def.line}!`, pw, ph);
  const st: ToolState = { kind, done: 0, total: 1, finished: false, alive: true };
  s.tool = st; s.pickerOpen = true;
  const k = Math.min(1, (pw - 40) / 600, (ph - 168) / 330);
  const cx = p.px + pw / 2, cy = p.py + 64 + (ph - 64 - 100) / 2;
  const stage = s.add.container(cx, cy).setScale(k).setDepth(D + 3); p.objs.push(stage);
  const pipG = s.add.graphics().setDepth(D + 2); p.objs.push(pipG);
  const toolG = s.add.graphics(); drawTool(toolG, kind);
  const tool = s.add.container(220, 170, [toolG]).setAngle(16).setScale(0.8); // idle in the corner
  const ctx: Ctx = {
    s, p, st, stage, k, cx, cy, tool, toolG,
    sr: (lx, ly, w, h) => ({ x: cx + lx * k, y: cy + ly * k, w: w * k, h: h * k }),
    add: (o) => { stage.add(o); return o; },
    tapZone: (id, lx, ly, w, h, fn) => {
      const r = ctx.sr(lx, ly, w, h); s.rects[id] = r;
      p.objs.push(zone(s, r, () => { if (!st.alive || st.finished) return; fn(); }, D + 5));
    },
    go: (lx, ly, ms = 130) => { s.tweens.killTweensOf(tool); s.tweens.add({ targets: tool, x: lx, y: ly, duration: ms, ease: 'Quad.easeOut' }); },
    step: (n = 1) => { st.done += n; s.actions++; ctx.pips(); },
    pips: () => {
      pipG.clear();
      const gap = 30, x0 = cx - ((st.total - 1) * gap) / 2, y = p.py + ph - 62;
      for (let i = 0; i < st.total; i++) {
        pipG.fillStyle(i < st.done ? 0x7cc463 : 0xe6d6b8, 1); pipG.fillCircle(x0 + i * gap, y, 10);
        pipG.lineStyle(3, OUTC, 1); pipG.strokeCircle(x0 + i * gap, y, 10);
      }
    },
    fx: (lx, ly, color, n = 8) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random(), r = 36 + Math.random() * 36;
        const star = s.add.star(cx + lx * k, cy + ly * k, 4, 3, 9, color).setStrokeStyle(1.5, OUTC, 0.6).setDepth(D + 9);
        s.tweens.add({ targets: star, x: star.x + Math.cos(a) * r * k, y: star.y + Math.sin(a) * r * k, alpha: 0, angle: 90, duration: 560, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
      }
    },
    finish: (kd, msg) => {
      st.finished = true;
      const def2 = TOOLS.find((t) => t.id === kd)!;
      sfx.chimes();
      const banner = s.text(cx, cy, msg, 40, '#fffaf0', 900).setStroke('#4a3022', 9).setOrigin(0.5).setDepth(D + 9).setScale(0.4);
      p.objs.push(banner);
      s.tweens.add({ targets: banner, scale: 1, duration: 360, ease: 'Back.easeOut' });
      ctx.fx(0, 0, 0xfff1c4, 14); ctx.fx(-120, -40, 0xff9fb2, 8); ctx.fx(120, -40, 0x9ad46b, 8);
      s.time.delayedCall(1500, () => {
        if (!st.alive) return;
        p.close();
        reward(s, def2);
      });
    },
  };
  stage.add(tool); tool.setDepth(50);
  p.objs.push(s.text(p.px + pw / 2, p.py + ph - 28, ({
    wrench: 'Tap each bolt to tighten it with the wrench!', hammer: 'Tap each nail to bonk it down flat!', screwdriver: 'Tap each screw to twist it out!',
    saw: 'Tap the plank to saw along the red line!', paint: 'Pick a color, then tap the birdhouse to paint it!',
  } as Record<ToolKind, string>)[kind], 20, '#6b4f3a', 800).setOrigin(0.5).setDepth(D + 2).setWordWrapWidth(pw - 120).setAlign('center'));
  ({ wrench, hammer, screwdriver, saw, paint } as Record<ToolKind, (c: Ctx) => void>)[kind](ctx);
  ctx.pips();
  s.lastAction = `tool:${kind}:start`;
  return kind;
}

/** What you get: a small crafted thing for the room, or a bit of wood/stone if you already have one (or the room is full). */
function reward(s: InteriorScene, def: typeof TOOLS[number]) {
  if (!s.open) return;
  const f = FURN[def.reward];
  const have = s.items.some((i) => i.k === def.reward);
  s.crafted++; s.toolsDone[def.id] = (s.toolsDone[def.id] ?? 0) + 1;
  if (have || s.items.length >= 24) {
    save.village.res[def.bonus] += 1; persist();
    s.hearts(s.room.x + s.room.w / 2, s.room.y + s.room.h / 2, 4);
    s.game.events.emit('res', null, 0);
    s.say(have ? `Nice! You already have a ${f.name}. Here is 1 ${def.bonus}!` : `The room is full, so here is 1 ${def.bonus}!`);
    s.lastAction = `tool:${def.id}:bonus`;
  } else {
    const { x, y } = s.emptiest(f);
    const made = s.spawn(def.reward, x, y, true);
    sfx.pickup();
    s.hearts(made.img.x, made.img.y - f.h * made.sc * (f.layer === 'floor' ? 1 : 0.5), 5);
    s.say(`You made a ${f.name}!`, made.img.x, made.img.y - f.h * made.sc - 20);
    s.store(); s.updateGlow();
    s.lastAction = `tool:${def.id}:done`;
  }
  s.refreshHint();
}

// ---- 1. wrench: three loose bolts
function wrench(c: Ctx) {
  const { s } = c;
  c.st.total = 9;
  const gl = c.add(s.add.graphics()), gr = c.add(s.add.graphics());
  const gearL = c.add(s.add.container(-215, -112, [gl])), gearR = c.add(s.add.container(205, -122, [gr]));
  poly(gl, cogPts(60), 0xf0b030, 4); circ(gl, 0, 0, 22, 0xfff1c4, 3.5);
  poly(gr, cogPts(46, 7), 0xe8875c, 4); circ(gr, 0, 0, 17, 0xfff1c4, 3.5);
  const body = c.add(s.add.graphics());
  rrect(body, -250, -118, 500, 236, 28, 0x6f93b0, 5); rrect(body, -230, -98, 460, 196, 20, 0x9cc0d8, 3.5);
  circ(body, 0, -64, 24, 0xfff8e8, 3.5); body.lineStyle(4, 0xe8604c, 1); body.lineBetween(0, -64, -10, -78); body.fillStyle(OUTC, 1); body.fillCircle(0, -64, 4);
  for (const x of [-190, 190]) { circ(body, x, 80, 7, 0x6f93b0, 2.5); circ(body, x, -80, 7, 0x6f93b0, 2.5); }
  const bolts: { box: Phaser.GameObjects.Container; g: G; taps: number }[] = [];
  const draw = (b: typeof bolts[number]) => {
    const lift = 3 - b.taps, tight = b.taps >= 3;
    b.g.clear();
    b.g.fillStyle(0x2a1d14, 0.3); b.g.fillEllipse(0, 14 + lift * 3, 80 + lift * 4, 26);
    poly(b.g, hexPts(36 + lift * 2), tight ? 0x7cc463 : 0xe8604c, 4.5);
    b.g.fillStyle(0xffffff, 0.35); b.g.fillCircle(-10, -12, 8);
    circ(b.g, 0, 0, 14, tight ? 0x9ad46b : 0xf08a74, 3); b.g.lineStyle(4, OUTC, 0.7); b.g.lineBetween(-8, 0, 8, 0);
    if (tight) { b.g.lineStyle(4, 0xfff1c4, 0.9); b.g.strokeCircle(0, 0, 44); }
  };
  [-140, 0, 140].forEach((x, i) => {
    const g = s.add.graphics(), box = c.add(s.add.container(x, 18, [g]));
    const b = { box, g, taps: 0 }; bolts.push(b); draw(b);
    box.setAngle(-24);
    c.tapZone(`tool:bolt:${i}`, x - 56, 18 - 56, 112, 112, () => {
      c.go(x + 4, 18 + 6, 100);
      if (b.taps >= 3) { sfx.tock(); s.tweens.add({ targets: box, scale: { from: 1.1, to: 1 }, duration: 160 }); return; }
      b.taps++;
      s.tweens.add({ targets: c.tool, angle: { from: 4, to: 40 }, duration: 110, yoyo: true, delay: 110 });
      s.time.delayedCall(120, () => {
        if (!c.st.alive) return;
        s.tweens.add({ targets: box, angle: box.angle + 60, duration: 160, ease: 'Back.easeOut' });
        sfx.clank(); if (b.taps >= 3) sfx.pickup();
        draw(b); c.fx(x, 18, b.taps >= 3 ? 0x9ad46b : 0xfff1c4, b.taps >= 3 ? 12 : 6);
        s.tweens.add({ targets: c.stage, y: c.cy + 3, duration: 50, yoyo: true });
        const t = s.text(c.cx + x * c.k, c.cy + (18 - 56) * c.k, b.taps >= 3 ? 'Tight!' : 'Clank!', 26, '#fffaf0', 900).setStroke('#4a3022', 6).setOrigin(0.5).setDepth(D + 9).setScale(0.5);
        c.p.objs.push(t);
        s.tweens.add({ targets: t, scale: 1.1, y: t.y - 30, alpha: { from: 1, to: 0 }, duration: 650, ease: 'Back.easeOut', onComplete: () => t.destroy() });
        c.step();
        if (bolts.every((q) => q.taps >= 3)) {
          s.tweens.add({ targets: gearL, angle: 360, duration: 1500, repeat: -1 }); s.tweens.add({ targets: gearR, angle: -360, duration: 1200, repeat: -1 });
          s.tweens.add({ targets: body, y: { from: -2, to: 2 }, duration: 60, yoyo: true, repeat: 8 });
          c.go(200, 160, 200);
          c.finish('wrench', 'Brrrm! All tight!');
        }
      });
    });
  });
  c.go(200, 150, 10);
}

// ---- 2. hammer: four nails to bonk flat (two bonks each)
function hammer(c: Ctx) {
  const { s } = c;
  c.st.total = 8;
  const board = c.add(s.add.graphics());
  rrect(board, -270, -6, 540, 96, 14, 0xe2a466, 5);
  board.lineStyle(3, 0x9a6238, 0.45); for (const y of [20, 44, 68]) { board.beginPath(); board.moveTo(-250, y); board.lineTo(-90, y - 4); board.lineTo(60, y + 4); board.lineTo(250, y); board.strokePath(); }
  for (const x of [-170, 170]) { circ(board, x, 78, 5, 0x9a6238, 2); }
  const xs = [-170, -57, 57, 170];
  const nails = xs.map((x) => ({ x, h: 44, g: c.add(s.add.graphics()), taps: 0 }));
  const draw = (n: typeof nails[number]) => {
    n.g.clear();
    n.g.fillStyle(0x2a1d14, 0.25); n.g.fillEllipse(n.x, 10, 36, 10);
    if (n.h > 0) rrect(n.g, n.x - 5, -6 - n.h, 10, n.h + 4, 2, 0xcfd6dc, 2.5);
    n.g.fillStyle(0xaab6c2, 1); n.g.fillEllipse(n.x, -6 - n.h, 34, 12); n.g.lineStyle(3, OUTC, 1); n.g.strokeEllipse(n.x, -6 - n.h, 34, 12);
    n.g.fillStyle(0xffffff, 0.6); n.g.fillEllipse(n.x - 5, -8 - n.h, 10, 3);
  };
  nails.forEach(draw);
  let doneN = 0;
  nails.forEach((n, i) => {
    c.tapZone(`tool:nail:${i}`, n.x - 50, -100, 100, 190, () => {
      if (n.h <= 0) { sfx.tock(); return; }
      n.taps++;
      const top = -6 - n.h;
      s.tweens.killTweensOf(c.tool);
      c.tool.setPosition(n.x + 34, top - 66).setAngle(-6);
      s.tweens.add({ targets: c.tool, y: top - 2, duration: 110, ease: 'Quad.easeIn' });
      s.time.delayedCall(180, () => {
        if (!c.st.alive) return;
        n.h = n.taps >= 2 ? 0 : 20; draw(n);
        sfx.thump(); s.time.delayedCall(50, () => sfx.clank());
        c.fx(n.x, -8, 0xfff1c4, 6);
        const t = s.text(c.cx + n.x * c.k, c.cy + (-80) * c.k, 'Bonk!', 26, '#fffaf0', 900).setStroke('#4a3022', 6).setOrigin(0.5).setDepth(D + 9).setScale(0.5);
        c.p.objs.push(t);
        s.tweens.add({ targets: t, scale: 1.1, y: t.y - 30, alpha: { from: 1, to: 0 }, duration: 600, ease: 'Back.easeOut', onComplete: () => t.destroy() });
        s.tweens.add({ targets: board, y: { from: 3, to: 0 }, duration: 120 });
        c.step();
        if (n.h <= 0) { doneN++; sfx.pickup(); }
        if (doneN >= nails.length) c.finish('hammer', 'Nice and flat!');
      });
    });
  });
  c.go(220, 120, 10);
}

// ---- 3. screwdriver: four screws, three twists each, then the panel drops open
function screwdriver(c: Ctx) {
  const { s } = c;
  c.st.total = 12;
  const inner = c.add(s.add.graphics());
  rrect(inner, -180, -116, 360, 232, 18, 0x4a3a30, 5);
  inner.fillStyle(0x6b5546, 1); inner.fillRoundedRect(-166, -102, 332, 204, 12);
  const mb = c.add(s.add.image(0, 38, furnTexture(s, 'musicbox', Math.max(2, Math.ceil(DPR)))).setOrigin(0.5, 1));
  mb.setScale(1.7 / Math.max(2, Math.ceil(DPR)));
  const lid = c.add(s.add.container(0, 0));
  const lg = s.add.graphics(); lid.add(lg);
  rrect(lg, -184, -120, 368, 240, 22, 0xb7c2cc, 5); rrect(lg, -170, -106, 340, 212, 14, 0xcfd9e2, 3);
  lg.lineStyle(4, 0x8c99a6, 0.8); for (const y of [-30, -6, 18, 42]) lg.lineBetween(-80, y, 80, y);
  const screws: { box: Phaser.GameObjects.Container; taps: number; x: number; y: number }[] = [];
  [[-140, -78], [140, -78], [-140, 78], [140, 78]].forEach(([x, y], i) => {
    const g = s.add.graphics();
    g.fillStyle(0x2a1d14, 0.3); g.fillEllipse(0, 5, 52, 18);
    circ(g, 0, 0, 24, 0xe0b04a, 4); g.fillStyle(0xffffff, 0.4); g.fillCircle(-8, -9, 6);
    g.lineStyle(7, OUTC, 1); g.lineBetween(-15, 0, 15, 0);
    const box = s.add.container(x, y, [g]); lid.add(box);
    const sc = { box, taps: 0, x, y }; screws.push(sc);
    c.tapZone(`tool:screw:${i}`, x - 42, y - 42, 84, 84, () => {
      if (sc.taps >= 3) { sfx.tock(); return; }
      sc.taps++;
      c.go(x + 2, y + 2, 100); c.tool.setAngle(0);
      s.tweens.add({ targets: c.tool, angle: { from: -22, to: 22 }, duration: 130, yoyo: true, delay: 100 });
      s.time.delayedCall(110, () => {
        if (!c.st.alive) return;
        sfx.ratchet(); s.time.delayedCall(90, () => sfx.tock());
        c.fx(x, y, 0xfff1c4, 4);
        if (sc.taps < 3) s.tweens.add({ targets: box, angle: box.angle + 120, scale: 1 + sc.taps * 0.12, duration: 170, ease: 'Back.easeOut' });
        else {
          sfx.pickup();
          s.tweens.add({ targets: box, angle: box.angle + 300, y: y - 90, scale: 1.7, alpha: 0, duration: 520, ease: 'Quad.easeOut' });
          const hole = s.add.graphics(); hole.fillStyle(0x6f7d8a, 1); hole.fillCircle(x, y, 11); hole.lineStyle(3, OUTC, 1); hole.strokeCircle(x, y, 11); lid.add(hole);
        }
        c.step();
        if (screws.every((q) => q.taps >= 3)) {
          s.time.delayedCall(260, () => {
            if (!c.st.alive) return;
            sfx.thump(); sfx.creak();
            s.tweens.add({ targets: lid, y: 330, angle: 14, duration: 650, ease: 'Quad.easeIn' });
            s.tweens.add({ targets: mb, y: { from: 38, to: 28 }, duration: 160, yoyo: true, delay: 700 });
            [988, 784, 880, 1175].forEach((f, j) => sfx.bell(f, 0.7 + j * 0.2, 0.07, 1.4));
            c.finish('screwdriver', 'The panel popped open!');
          });
        }
      });
    });
  });
  c.go(240, 120, 10);
}

// ---- 4. saw: two cuts, three taps each, and the plank falls into three pieces
function saw(c: Ctx) {
  const { s } = c;
  c.st.total = 6;
  const legs = c.add(s.add.graphics());
  for (const x of [-170, 170]) { rrect(legs, x - 12, 30, 24, 120, 6, 0x9a6238, 4); }
  rrect(legs, -210, 24, 420, 18, 6, 0x7d5232, 4);
  const edges = [-240, -80, 80, 240];
  const pieces = [0, 1, 2].map((i) => {
    const w = edges[i + 1] - edges[i], g = s.add.graphics();
    rrect(g, 0, -34, w, 68, 12, 0xf0c48a, 4.5);
    g.lineStyle(3, 0xb8794a, 0.45); for (const y of [-14, 4, 20]) { g.beginPath(); g.moveTo(10, y); g.lineTo(w * 0.5, y - 3); g.lineTo(w - 10, y + 2); g.strokePath(); }
    return c.add(s.add.container(edges[i], -10, [g]));
  });
  const guide = c.add(s.add.graphics());
  const arrow = c.add(s.add.text(0, -64, '\u25BC', { fontFamily: 'Nunito', fontSize: '34px', color: '#e8604c', fontStyle: '900', resolution: 3 } as any).setOrigin(0.5).setStroke('#4a3022', 5));
  const lines = [-80, 80], cuts = [0, 0];
  const drawGuide = () => {
    guide.clear();
    lines.forEach((x, i) => {
      if (cuts[i] >= 3) return;
      guide.lineStyle(5, i === (cuts[0] >= 3 ? 1 : 0) ? 0xe8604c : 0xd6a590, 1);
      for (let y = -42; y < 28; y += 14) guide.lineBetween(x, y - 10, x, y - 2);
    });
    const active = cuts[0] >= 3 ? 1 : 0;
    arrow.setX(lines[active]);
  };
  drawGuide();
  s.tweens.add({ targets: arrow, y: { from: -66, to: -54 }, duration: 380, yoyo: true, repeat: -1 });
  const layout = () => {
    const g1 = Math.min(cuts[0], 3), g2 = Math.min(cuts[1], 3);
    const open1 = g1 >= 3 ? 26 : g1 * 4, open2 = g2 >= 3 ? 26 : g2 * 4;
    pieces[0].x = edges[0] - open1 / 2; pieces[1].x = edges[1] + open1 / 2 - open2 / 2; pieces[2].x = edges[2] + open2 / 2;
  };
  c.tapZone('tool:plank', -250, -60, 500, 110, () => {
    const i = cuts[0] >= 3 ? 1 : 0;
    if (cuts[i] >= 3) return;
    const x = lines[i];
    c.go(x + 62, -4, 100); c.tool.setAngle(0);
    s.tweens.add({ targets: c.tool, x: { from: x + 62, to: x + 108 }, duration: 110, yoyo: true, repeat: 1, delay: 100 });
    s.time.delayedCall(120, () => {
      if (!c.st.alive) return;
      cuts[i]++; sfx.saw(); layout(); drawGuide(); c.step();
      for (let j = 0; j < 7; j++) {
        const d = s.add.rectangle(c.cx + x * c.k, c.cy - 10 * c.k, 5, 4, 0xf6dba0).setStrokeStyle(1, OUTC).setDepth(D + 9);
        s.tweens.add({ targets: d, x: d.x + Phaser.Math.Between(-40, 40) * c.k, y: d.y + (30 + Math.random() * 60) * c.k, angle: 200, alpha: 0, duration: 600, ease: 'Quad.easeIn', onComplete: () => d.destroy() });
        c.p.objs.push(d);
      }
      if (cuts[i] >= 3) {
        sfx.thump(); sfx.pickup();
        s.tweens.add({ targets: pieces[i === 0 ? 0 : 2], y: -4, duration: 100, yoyo: true });
        if (cuts[0] >= 3 && cuts[1] >= 3) {
          c.go(240, 130, 200);
          pieces.forEach((pc, j) => s.tweens.add({ targets: pc, y: -10 - 12, duration: 180, yoyo: true, delay: j * 90, ease: 'Quad.easeOut' }));
          c.finish('saw', 'Three neat pieces!');
        }
      }
    });
  });
  c.go(240, 130, 10);
}

// ---- 5. paintbrush: pick a color, paint the roof, the walls and the door
function paint(c: Ctx) {
  const { s } = c;
  c.st.total = 3;
  const PAL = [0xe8604c, 0xf6c453, 0x4aa8d0, 0x7cc463, 0xff8fb4];
  let cur = 0;
  const RAW = 0xf6ead0;
  const col = { roof: RAW, body: RAW, door: RAW };
  const painted = new Set<string>();
  const house = c.add(s.add.graphics());
  const hx = -90;
  const draw = () => {
    house.clear();
    house.fillStyle(0x2a1d14, 0.25); house.fillEllipse(hx, 150, 150, 22);
    rrect(house, hx - 9, 70, 18, 80, 5, 0xc98a55, 4);
    rrect(house, hx - 78, -34, 156, 112, 10, col.body, 5);
    poly(house, [{ x: hx - 100, y: -30 }, { x: hx, y: -118 }, { x: hx + 100, y: -30 }], col.roof, 5);
    circ(house, hx, 26, 25, col.door, 4.5); circ(house, hx, 26, 14, 0x4a3022, 3);
    rrect(house, hx - 18, 56, 36, 8, 4, 0xc98a55, 3);
    house.fillStyle(0xffffff, 0.35); house.fillRect(hx - 66, -22, 8, 70);
  };
  draw();
  const ring = c.add(s.add.graphics());
  const drawPal = () => {
    ring.clear();
    PAL.forEach((cl, i) => {
      const y = -112 + i * 56;
      if (i === cur) { ring.lineStyle(7, 0xfff1c4, 1); ring.strokeCircle(190, y, 34); ring.lineStyle(3, OUTC, 1); ring.strokeCircle(190, y, 37); }
      ring.fillStyle(0x2a1d14, 0.2); ring.fillEllipse(190, y + 14, 56, 14);
      circ(ring, 190, y, 26, cl, 4); ring.fillStyle(0xffffff, 0.45); ring.fillCircle(181, y - 8, 7);
    });
  };
  drawPal();
  PAL.forEach((_, i) => c.tapZone(`tool:swatch:${i}`, 190 - 30, -112 + i * 56 - 28, 60, 56, () => {
    cur = i; drawPal(); c.toolG.clear(); drawTool(c.toolG, 'paint', PAL[cur]); sfx.blip(); sfx.plip();
    c.go(190 - 56, -112 + i * 56 + 10, 110);
  }));
  drawTool(c.toolG, 'paint', PAL[cur]);
  const part = (name: 'roof' | 'body' | 'door', lx: number, ly: number, w: number, h: number, depth: number) => {
    c.tapZone(`tool:part:${name}`, lx, ly, w, h, () => {
      c.go(lx + w / 2 + 6, ly + h / 2, 110); c.tool.setAngle(8);
      s.tweens.add({ targets: c.tool, x: { from: lx + w / 2 - 22, to: lx + w / 2 + 26 }, duration: 160, yoyo: true, delay: 100 });
      s.time.delayedCall(140, () => {
        if (!c.st.alive) return;
        col[name] = PAL[cur]; draw(); sfx.swish();
        c.fx(lx + w / 2, ly + h / 2, PAL[cur], 10);
        if (!painted.has(name)) { painted.add(name); c.step(); sfx.pickup(); }
        if (painted.size >= 3) { c.go(140, 140, 200); c.finish('paint', 'So colorful!'); }
      });
    });
    void depth;
  };
  // Door last so it sits on top of the walls' zone.
  part('roof', hx - 100, -118, 200, 86, 0);
  part('body', hx - 78, -30, 156, 108, 0);
  part('door', hx - 30, -4, 60, 60, 1);
  c.go(130, 140, 10);
}
