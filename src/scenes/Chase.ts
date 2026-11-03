// 69 (Walker, Nov 2): the Thief Chase. When a thief runs off with your friends you can chase it:
// a bright top-down sky scroller. Your mount flies at the bottom; the thief zigzags near the top
// with your friends on its back. Controls are made for a 4-7 year old:
//   - put a finger anywhere and slide: your mount flies to it (tap a side to hop there),
//   - bubble nets fly up by themselves on a gentle beat (a tap throws one more),
//   - nets curve a little towards the thief, so near is good enough.
// Bumping a soft cloud or balloon only makes you wobble (no lives, no damage). Each net that lands
// slows the thief and fills the Catch meter; CHASE.hits nets and it is caught in a big net, your
// friends fly home and it goes to the Thief Jail. If time runs out, it hides your friends in their
// cells like before, and you get a small "thanks for trying" berry gift.
import Phaser from 'phaser';
import { atlasOf, frameScale, uploadTex } from '../art';
import { DPR } from '../dpr';
import { theme } from '../theme';
import { sfx } from '../audio';
import { addFruit, save, persist } from '../save';
import { mountById, type MountDef } from '../mount/defs';
import { CAPE_AT, CAPE_OX, CAPE_OY } from '../mount/cape';
import { looks } from '../looks/looks';
import { setStyled } from '../looks/styleFx';
import { chaseAudio } from '../chase/chaseAudio';

/** Tuning (design px = CSS px on an iPad; everything scales with the screen). */
export const CHASE = {
  hits: 4,          // nets that must land to catch the thief
  timeS: 50,        // seconds before it gets away
  autoMs: 850,      // a bubble net flies up by itself this often
  tapGapMs: 260,    // a tap throws an extra net (at most this often)
  netSpeed: 900,    // px/s up the screen
  netCurve: 230,    // px/s sideways help towards the thief
  hitR: 92,         // how close a net must get to the thief (generous)
  thiefSpeed: 1.25, // zigzag speed (radians/s); each hit slows it by slowPerHit
  slowPerHit: 0.14,
  invulnS: 1.1,     // after a hit the thief wriggles free for a moment (nets bounce off)
  scrollPx: 260,    // items/obstacles fall at this speed
  bumpS: 0.9,       // wobble time after bumping a cloud or balloon (nets pause for netPauseS)
  netPauseS: 0.55,
  consolation: 2,   // berries for trying when it gets away
};

export type ChaseResult = 'caught' | 'escaped' | 'quit';
export type ChaseStats = { result: ChaseResult; hits: number; stars: number; berries: number; bumps: number; nets: number; secs: number };
export type ChaseData = { kind: string; kindName: string; voice: number; taken: string[]; mountId: string; onEnd: (s: ChaseStats) => void };

const FONT = 'Nunito, "Trebuchet MS", sans-serif';
const R = 2; // textures are painted at 2x design px
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

type Item = { img: Phaser.GameObjects.Image; kind: 'star' | 'berry' | 'cloud' | 'balloon'; r: number; vy: number; ph: number; dead: boolean; hit?: boolean };
type Net = { img: Phaser.GameObjects.Image; vx: number; dead: boolean; t: number };

// ---------- textures ----------
function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement('canvas'); cv.width = Math.ceil(w * R); cv.height = Math.ceil(h * R);
  const c = cv.getContext('2d')!; c.scale(R, R); c.lineCap = 'round'; c.lineJoin = 'round';
  draw(c);
  uploadTex(scene, key, cv);
}
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function groundCols() {
  switch (theme.id) {
    case 'winter': case 'christmas': return { base: '#eaf3fb', dark: '#d2e2ef', tree: '#5f9a78', treeDark: '#3f7458', path: '#c9d8e6', flower: ['#ff7b8a', '#ffd34d', '#ffffff'] };
    case 'fall': return { base: '#d9b860', dark: '#c49d48', tree: '#e07a32', treeDark: '#a8521e', path: '#e8d3a0', flower: ['#ffd34d', '#c94a2a', '#fff3c4'] };
    case 'halloween': return { base: '#9bb565', dark: '#86a052', tree: '#e8892e', treeDark: '#8a4a22', path: '#d8c48c', flower: ['#ff9b3d', '#b07ad8', '#fff3c4'] };
    case 'summer': return { base: '#86d062', dark: '#6fbd50', tree: '#3f9a4a', treeDark: '#2a7436', path: '#f0dca0', flower: ['#ff6f91', '#ffd34d', '#8fd0ff'] };
    default: return { base: '#97d775', dark: '#80c562', tree: '#4fa457', treeDark: '#357f3f', path: '#efd9a6', flower: ['#ff9ab8', '#ffd34d', '#ffffff'] };
  }
}
function paintAll(scene: Phaser.Scene) {
  const g = groundCols();
  const gk = `ch_ground_${theme.id}`;
  paint(scene, gk, 512, 512, (c) => {
    c.fillStyle = g.base; c.fillRect(0, 0, 512, 512);
    const r = rng(7);
    // soft grass patches
    for (let i = 0; i < 26; i++) { const x = r() * 512, y = r() * 512, s = 30 + r() * 60; for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) { c.fillStyle = g.dark; c.globalAlpha = 0.45; c.beginPath(); c.ellipse(x + dx, y + dy, s, s * 0.6, 0, 0, Math.PI * 2); c.fill(); } }
    c.globalAlpha = 1;
    // a winding path that tiles top to bottom
    c.strokeStyle = g.path; c.lineWidth = 30; c.beginPath();
    for (let y = -10; y <= 522; y += 8) { const x = 300 + 90 * Math.sin((y / 512) * Math.PI * 2); if (y === -10) c.moveTo(x, y); else c.lineTo(x, y); }
    c.stroke();
    // a little pond
    c.fillStyle = '#8fd0ff'; c.beginPath(); c.ellipse(110, 380, 60, 38, 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(95, 368, 22, 8, 0.3, 0, Math.PI * 2); c.fill();
    // flowers
    for (let i = 0; i < 70; i++) { const x = r() * 512, y = r() * 512; c.fillStyle = g.flower[i % 3]; c.beginPath(); c.arc(x, y, 3 + r() * 2, 0, Math.PI * 2); c.fill(); }
    // trees seen from above (with wrap copies so the tile is seamless)
    const trees: [number, number, number][] = [];
    for (let i = 0; i < 16; i++) trees.push([r() * 512, r() * 512, 22 + r() * 18]);
    for (const [x, y, s] of trees) for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
      const X = x + dx, Y = y + dy;
      if (X < -60 || X > 572 || Y < -60 || Y > 572) continue;
      c.fillStyle = 'rgba(0,40,0,.18)'; c.beginPath(); c.arc(X + 8, Y + 8, s, 0, Math.PI * 2); c.fill();
      c.fillStyle = g.treeDark; c.beginPath(); c.arc(X, Y, s, 0, Math.PI * 2); c.fill();
      c.fillStyle = g.tree; c.beginPath(); c.arc(X - s * 0.18, Y - s * 0.2, s * 0.78, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(X - s * 0.35, Y - s * 0.4, s * 0.3, 0, Math.PI * 2); c.fill();
    }
  });
  const cloud = (c: CanvasRenderingContext2D, w: number, h: number, fill: string, edge: string) => {
    const bumps: [number, number, number][] = [[0.28, 0.62, 0.26], [0.5, 0.45, 0.32], [0.72, 0.6, 0.25], [0.4, 0.7, 0.22], [0.62, 0.72, 0.22]];
    c.fillStyle = edge; for (const [x, y, r] of bumps) { c.beginPath(); c.arc(x * w, y * h + 4, r * h + 3, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = fill; for (const [x, y, r] of bumps) { c.beginPath(); c.arc(x * w, y * h, r * h, 0, Math.PI * 2); c.fill(); }
  };
  paint(scene, 'ch_cloud', 260, 150, (c) => cloud(c, 260, 150, '#ffffff', 'rgba(170,200,230,.5)'));
  // An obstacle cloud: puffy and soft blue-grey, with a sleepy smile (bumping it is just funny).
  paint(scene, 'ch_puff', 220, 150, (c) => {
    cloud(c, 220, 150, '#e6eefc', '#9fb3d6');
    c.strokeStyle = '#5a6a8a'; c.lineWidth = 4;
    c.beginPath(); c.arc(88, 78, 8, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.beginPath(); c.arc(132, 78, 8, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.beginPath(); c.arc(110, 96, 10, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke();
    c.fillStyle = 'rgba(255,140,170,.5)'; c.beginPath(); c.arc(70, 94, 9, 0, Math.PI * 2); c.arc(150, 94, 9, 0, Math.PI * 2); c.fill();
  });
  ['#ff6f91', '#ffcf3f', '#6fc3ff', '#9be07a'].forEach((col, i) => paint(scene, `ch_balloon${i}`, 90, 160, (c) => {
    c.strokeStyle = '#8a7a6a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(45, 104); c.quadraticCurveTo(36, 130, 48, 156); c.stroke();
    c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(45, 54, 36, 46, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(40, 100); c.lineTo(50, 100); c.lineTo(45, 108); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(32, 36, 9, 15, -0.4, 0, Math.PI * 2); c.fill();
  }));
  const starPath = (c: CanvasRenderingContext2D, cx: number, cy: number, r1: number, r2: number) => {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? r2 : r1; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    c.closePath();
  };
  paint(scene, 'ch_star', 64, 64, (c) => { c.fillStyle = '#ffd34d'; c.strokeStyle = '#c9902a'; c.lineWidth = 4; starPath(c, 32, 33, 28, 13); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(24, 24, 5, 3, -0.5, 0, Math.PI * 2); c.fill(); });
  paint(scene, 'ch_berry', 64, 64, (c) => {
    c.fillStyle = '#79b84a'; c.beginPath(); c.ellipse(38, 12, 11, 6, -0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e0306f'; c.strokeStyle = '#8f1f48'; c.lineWidth = 3;
    for (const [x, y] of [[32, 26], [20, 44], [44, 44]]) { c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill(); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.6)'; for (const [x, y] of [[27, 21], [15, 39], [39, 39]]) { c.beginPath(); c.ellipse(x, y, 4, 3, 0, 0, Math.PI * 2); c.fill(); }
  });
  const net = (c: CanvasRenderingContext2D, s: number) => {
    const m = s / 2, r = s * 0.44;
    const gr = c.createRadialGradient(m - r * 0.3, m - r * 0.3, r * 0.1, m, m, r);
    gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(0.55, 'rgba(170,225,255,.45)'); gr.addColorStop(1, 'rgba(200,160,255,.6)');
    c.fillStyle = gr; c.beginPath(); c.arc(m, m, r, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(m, m, r, 0, Math.PI * 2); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = s * 0.035;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(m + i * r * 0.32 - r, m - r); c.lineTo(m + i * r * 0.32 + r, m + r); c.stroke(); c.beginPath(); c.moveTo(m + i * r * 0.32 + r, m - r); c.lineTo(m + i * r * 0.32 - r, m + r); c.stroke(); }
    c.restore();
    c.strokeStyle = '#ffffff'; c.lineWidth = s * 0.06; c.beginPath(); c.arc(m, m, r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,170,220,.9)'; c.lineWidth = s * 0.025; c.beginPath(); c.arc(m, m, r * 0.92, -2.6, -1.2); c.stroke();
  };
  paint(scene, 'ch_net', 96, 96, (c) => net(c, 96));
  paint(scene, 'ch_bignet', 320, 320, (c) => net(c, 320));
  paint(scene, 'ch_streak', 10, 140, (c) => { const gr = c.createLinearGradient(0, 0, 0, 140); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(2, 0, 6, 140); });
  paint(scene, 'ch_spark', 32, 32, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(16, 0); c.quadraticCurveTo(18, 14, 32, 16); c.quadraticCurveTo(18, 18, 16, 32); c.quadraticCurveTo(14, 18, 0, 16); c.quadraticCurveTo(14, 14, 16, 0); c.fill(); });
  paint(scene, 'ch_heart', 48, 44, (c) => { c.fillStyle = '#ff6f91'; c.strokeStyle = '#b83a5c'; c.lineWidth = 3; c.beginPath(); c.moveTo(24, 40); c.bezierCurveTo(4, 28, 2, 14, 10, 7); c.bezierCurveTo(16, 2, 22, 6, 24, 11); c.bezierCurveTo(26, 6, 32, 2, 38, 7); c.bezierCurveTo(46, 14, 44, 28, 24, 40); c.closePath(); c.fill(); c.stroke(); });
  paint(scene, 'ch_shadow', 120, 40, (c) => { c.translate(60, 20); c.scale(1, 1 / 3); const gr = c.createRadialGradient(0, 0, 2, 0, 0, 58); gr.addColorStop(0, 'rgba(0,30,0,.32)'); gr.addColorStop(0.6, 'rgba(0,30,0,.16)'); gr.addColorStop(1, 'rgba(0,30,0,0)'); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 58, 0, Math.PI * 2); c.fill(); });
  return gk;
}

// ---------- the scene ----------
export class ChaseScene extends Phaser.Scene {
  constructor() { super('chase'); }
  d!: ChaseData;
  U = 2;
  W = 0; H = 0;
  def!: MountDef;
  // state
  phase: 'intro' | 'play' | 'caught' | 'escaped' | 'done' = 'intro';
  paused = false;
  t = 0; hits = 0; stars = 0; berries = 0; bumps = 0; nets = 0;
  px = 0; tx = 0; pvx = 0; face = 1; flap = 0; wobble = 0; netPause = 0;
  lastThrow = -9; autoT = 0; spawnT = 0; invul = 0;
  thx = 0; thy = 0; thPh = 0; thPh2 = 0; thFace = 1; thBaseY = 0; thSpin = 0;
  autopilot = false;
  // objects
  ground!: Phaser.GameObjects.TileSprite;
  far: Phaser.GameObjects.Image[] = [];
  streaks: Phaser.GameObjects.Image[] = [];
  items: Item[] = [];
  netsL: Net[] = [];
  body!: Phaser.GameObjects.Image; wing!: Phaser.GameObjects.Image; wingFar!: Phaser.GameObjects.Image; shadow!: Phaser.GameObjects.Image;
  SC = 1;
  thief!: Phaser.GameObjects.Image; thShadow!: Phaser.GameObjects.Image; carry: Phaser.GameObjects.Image[] = [];
  meter: { ring: Phaser.GameObjects.Image; fill: Phaser.GameObjects.Image }[] = [];
  meterLabel: Phaser.GameObjects.Text | null = null;
  meterBox = { x: 0, w: 0 };
  /** 70: the last empty ring glows and bobs ("one more!"). */
  lastPulse: Phaser.Tweens.Tween | null = null;
  timeBar!: Phaser.GameObjects.Graphics;
  starTxt!: Phaser.GameObjects.Text; berryTxt!: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.GameObject[] = [];
  panel: Phaser.GameObjects.Container | null = null;
  pauseBtn!: Phaser.GameObjects.Container;
  sparks: Phaser.GameObjects.Image[] = [];
  private offVis = () => { if (document.hidden && this.phase === 'play' && !this.paused) this.setPaused(true); };

  init(d: ChaseData) {
    this.d = d;
    this.phase = 'intro'; this.paused = false;
    this.t = 0; this.hits = 0; this.stars = 0; this.berries = 0; this.bumps = 0; this.nets = 0;
    this.items = []; this.netsL = []; this.far = []; this.streaks = []; this.carry = []; this.meter = []; this.sparks = []; this.hint = []; this.panel = null; this.floats = []; this.lastPulse = null; this.meterLabel = null;
    this.wobble = 0; this.netPause = 0; this.lastThrow = -9; this.autoT = 0.6; this.spawnT = 1.2; this.invul = 0; this.thSpin = 0; this.autopilot = false;
  }

  create() {
    const W = (this.W = this.scale.width), H = (this.H = this.scale.height);
    const U = (this.U = Math.min(H / 820, W / 560));
    const gk = paintAll(this);
    this.cameras.main.setBackgroundColor(groundCols().base);
    this.ground = this.add.tileSprite(0, 0, W, H, gk).setOrigin(0).setTileScale(U / R * 1.1).setDepth(0);
    // altitude haze, so the meadow reads as far below
    this.add.rectangle(0, 0, W, H, 0xcfeaff, 0.3).setOrigin(0).setDepth(1);
    for (let i = 0; i < 5; i++) {
      const im = this.add.image(Math.random() * W, Math.random() * H, 'ch_cloud').setDepth(2).setAlpha(0.5);
      im.setScale((U / R) * (0.8 + Math.random() * 0.6)); this.far.push(im);
    }
    for (let i = 0; i < 9; i++) this.streaks.push(this.add.image(Math.random() * W, Math.random() * H, 'ch_streak').setDepth(40).setAlpha(0).setScale(U / R * 1.2, U / R * (1 + Math.random())));

    // the mount (its own sprite, in the Looks & Moves art style)
    this.def = mountById(this.d.mountId) ?? mountById('eagle')!;
    const def = this.def, art = looks.art;
    const fr = this.textures.getFrame(atlasOf(def.body), def.body);
    const bodyW = (fr?.realWidth ?? 128) / (frameScale[def.body] ?? 1);
    this.SC = (170 * U) / bodyW;
    this.px = this.tx = W / 2;
    this.shadow = this.add.image(this.px, H * 0.8 + 70 * U, 'ch_shadow').setDepth(9).setScale(U / R * 1.4);
    const prop = def.style === 'prop', cape = def.style === 'cape';
    this.wingFar = setStyled(this.add.image(0, 0, atlasOf(def.wingFar), def.wingFar), this, def.wingFar, art, cape ? CAPE_OX : 0.5, cape ? CAPE_OY : prop ? 0.5 : 0.96).setDepth(19);
    this.body = setStyled(this.add.image(0, 0, atlasOf(def.body), def.body), this, def.body, art, 0.5, 0.52).setDepth(20);
    this.wing = setStyled(this.add.image(0, 0, atlasOf(def.wing), def.wing), this, def.wing, art, 0.5, prop || cape ? 0.5 : 0.96).setDepth(prop ? 20.2 : 20.5);
    if (cape && def.cape !== undefined) { this.wing.setTint(def.cape); this.wingFar.setTint(def.cape); }
    if (def.style === 'none') { this.wing.setVisible(false); this.wingFar.setVisible(false); }

    // the thief, with your friends held up on its back
    const tk = `thief_${this.d.kind}`;
    this.thx = W / 2; this.thBaseY = this.thy = H * 0.2;
    this.thShadow = this.add.image(this.thx, this.thy + 80 * U, 'ch_shadow').setDepth(9).setScale(U / R * 1.1);
    this.thief = this.add.image(this.thx, this.thy, atlasOf(tk), tk).setOrigin(0.5, 0.6).setDepth(30);
    this.thief.setScale((140 * U) / 64 / (frameScale[tk] ?? 1));
    this.d.taken.forEach((id) => {
      const m = mountById(id); if (!m) return;
      const im = this.add.image(this.thx, this.thy, atlasOf(m.body), m.body).setOrigin(0.5, 0.85).setDepth(29);
      im.setScale(((this.d.taken.length === 1 ? 100 : 80) * U) / Math.max(1, im.width));
      this.carry.push(im);
    });

    this.buildHud();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (over.length || this.panel || this.phase !== 'play' && this.phase !== 'intro') return;
      this.tx = p.x;
      if (this.phase === 'play') this.throwNet(true);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown && !this.panel) this.tx = p.x; });
    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => { if (this.phase === 'play' && !this.paused) this.throwNet(true); });
    kb?.on('keydown-ESC', () => { if (this.phase === 'play') this.setPaused(!this.paused); });
    this.keys = kb?.addKeys('LEFT,RIGHT,A,D') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    document.addEventListener('visibilitychange', this.offVis);
    this.events.once('shutdown', () => { document.removeEventListener('visibilitychange', this.offVis); chaseAudio.stop(); const last = { ...this.snapshot(), on: false }; Object.defineProperty(window, '__chase', { configurable: true, writable: true, value: last }); });

    this.cameras.main.fadeIn(reduceMotion() ? 1 : 450, 255, 255, 255);
    chaseAudio.start();
    sfx.giggle?.(this.d.voice);
    // A short, big "how to play" (also spoken by the pictures: a finger and arrows by the mount).
    const hint = this.txt(W / 2, H * 0.52, 'Slide your finger to fly!\nThe bubble nets fly by themselves!', 40, '#ffffff', 900).setOrigin(0.5).setDepth(200).setStroke('#2a4a7a', 10 * U / 2).setAlign('center');
    const la = this.txt(this.px - 130 * U, H * 0.8, '◀', 64, '#ffffff', 900).setOrigin(0.5).setDepth(200).setStroke('#2a4a7a', 6 * U);
    const ra = this.txt(this.px + 130 * U, H * 0.8, '▶', 64, '#ffffff', 900).setOrigin(0.5).setDepth(200).setStroke('#2a4a7a', 6 * U);
    this.hint = [hint, la, ra];
    if (!reduceMotion()) this.tweens.add({ targets: [la, ra], scale: 1.15, duration: 380, yoyo: true, repeat: -1 });
    this.time.delayedCall(1400, () => { if (this.phase === 'intro') this.phase = 'play'; });
    this.time.delayedCall(3600, () => this.tweens.add({ targets: this.hint, alpha: 0, duration: 500, onComplete: () => { for (const h of this.hint) h.destroy(); this.hint = []; } }));
    // Live read for tests / the console (a getter, so it never goes stale).
    Object.defineProperty(window, '__chase', { configurable: true, get: () => this.snapshot() });
    (window as any).__chaseScene = this;
  }
  keys?: Record<string, Phaser.Input.Keyboard.Key>;

  txt(x: number, y: number, s: string, size: number, color = '#2a1d14', weight = 900) {
    return this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${Math.round(size * this.U)}px`, color, fontStyle: `${weight}`, resolution: 1 });
  }

  // ---------- HUD ----------
  buildHud() {
    const U = this.U, W = this.W;
    const D = 100;
    // Pause button (top left, big and round).
    const pb = this.add.container(64 * U, 64 * U).setDepth(D + 5);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.15).fillCircle(0, 5 * U, 44 * U);
    g.fillStyle(0xfffaf0, 1).fillCircle(0, 0, 44 * U);
    g.lineStyle(5 * U, 0x2a4a7a, 1).strokeCircle(0, 0, 44 * U);
    g.fillStyle(0x2a4a7a, 1).fillRoundedRect(-15 * U, -17 * U, 10 * U, 34 * U, 3 * U).fillRoundedRect(5 * U, -17 * U, 10 * U, 34 * U, 3 * U);
    pb.add(g);
    pb.setSize(110 * U, 110 * U).setInteractive({ useHandCursor: true });
    pb.on('pointerdown', () => { if (this.phase === 'play' || this.phase === 'intro') this.setPaused(true); });
    this.pauseBtn = pb;
    // Catch meter: one ring per net needed (fills with a bubble net), with a big "Catch!" word and
    // the thief's little net-count, so it's clear what the rings are for (70).
    const n = CHASE.hits, gap = 92 * U, x0 = W / 2 - ((n - 1) * gap) / 2 + 50 * U;
    const back = this.add.graphics().setDepth(D);
    const bx = x0 - 170 * U, bw = (n - 1) * gap + 240 * U;
    back.fillStyle(0xfffaf0, 0.92).fillRoundedRect(bx, 18 * U, bw, 96 * U, 40 * U);
    back.lineStyle(4 * U, 0x2a4a7a, 0.9).strokeRoundedRect(bx, 18 * U, bw, 96 * U, 40 * U);
    this.meterLabel = this.txt(x0 - 110 * U, 60 * U, 'Catch!', 32, '#2a4a7a', 900).setOrigin(0.5).setDepth(D + 1);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * gap, y = 58 * U;
      const ring = this.add.image(x, y, 'ch_net').setDepth(D + 1).setScale((U / R) * 0.78).setAlpha(0.28).setTint(0x8899bb);
      const fill = this.add.image(x, y, 'ch_net').setDepth(D + 2).setScale(0).setAlpha(1);
      this.meter.push({ ring, fill });
    }
    this.meterBox = { x: bx, w: bw };
    this.timeBar = this.add.graphics().setDepth(D + 1);
    // Stars and berries collected (top right).
    const sx = W - 190 * U;
    const box = this.add.graphics().setDepth(D);
    box.fillStyle(0xfffaf0, 0.92).fillRoundedRect(sx - 20 * U, 18 * U, 196 * U, 96 * U, 34 * U);
    box.lineStyle(4 * U, 0x2a4a7a, 0.9).strokeRoundedRect(sx - 20 * U, 18 * U, 196 * U, 96 * U, 34 * U);
    this.add.image(sx + 14 * U, 66 * U, 'ch_star').setDepth(D + 1).setScale((U / R) * 0.8);
    this.starTxt = this.txt(sx + 40 * U, 66 * U, '0', 36).setOrigin(0, 0.5).setDepth(D + 1);
    this.add.image(sx + 100 * U, 66 * U, 'ch_berry').setDepth(D + 1).setScale((U / R) * 0.75);
    this.berryTxt = this.txt(sx + 126 * U, 66 * U, '0', 36).setOrigin(0, 0.5).setDepth(D + 1);
    this.drawTime();
  }
  drawTime() {
    const U = this.U, W = this.W, g = this.timeBar;
    const w = 300 * U, x = W / 2 - w / 2, y = 124 * U, h = 18 * U;
    const k = Phaser.Math.Clamp(1 - this.t / CHASE.timeS, 0, 1);
    g.clear();
    g.fillStyle(0x000000, 0.18).fillRoundedRect(x, y, w, h, h / 2);
    if (k > 0.02) g.fillStyle(k > 0.3 ? 0x7fd35a : 0xffb347, 1).fillRoundedRect(x, y, Math.max(h, w * k), h, h / 2);
  }
  setMeter(i: number) {
    const m = this.meter[i]; if (!m) return;
    m.ring.setAlpha(0);
    const s = (this.U / R) * 0.85, rm = reduceMotion();
    if (rm) m.fill.setScale(s);
    else this.tweens.add({ targets: m.fill, scale: { from: s * 1.8, to: s }, duration: 420, ease: 'Back.easeOut' });
    // 70: a little sparkle pop on the ring, the word "Catch!" gives a happy bounce.
    this.spark(m.fill.x, m.fill.y, rm ? 3 : 8, 0xffe27a, 'ch_spark', 50, 110);
    if (this.meterLabel && !rm) this.tweens.add({ targets: this.meterLabel, scale: { from: 1.25, to: 1 }, duration: 360, ease: 'Back.easeOut' });
    // The last empty ring glows and bobs so you can see you need just one more.
    this.lastPulse?.stop(); this.lastPulse = null;
    const empty = this.meter.filter((q) => q.ring.alpha > 0);
    if (empty.length === 1) {
      const r = empty[0].ring;
      r.setAlpha(0.7).setTint(0xffe27a);
      if (!rm) this.lastPulse = this.tweens.add({ targets: r, scale: r.scale * 1.18, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ---------- cards (pause / end) ----------
  card(title: string, lines: string[], buttons: { label: string; primary?: boolean; cb: () => void; id: string }[]) {
    this.panel?.destroy();
    const U = this.U, W = this.W, H = this.H;
    const c = this.add.container(0, 0).setDepth(300);
    const dim = this.add.rectangle(0, 0, W, H, 0x14203c, 0.42).setOrigin(0).setInteractive();
    c.add(dim);
    const cw = Math.min(720 * U, W * 0.92), lh = 46 * U;
    const ch = 130 * U + lines.length * lh + buttons.length * 116 * U;
    const cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.16).fillRoundedRect(cx, cy + 12 * U, cw, ch, 34 * U);
    g.fillStyle(0xfffaf0, 1).fillRoundedRect(cx, cy, cw, ch, 34 * U);
    g.lineStyle(6 * U, Phaser.Display.Color.HexStringToColor(theme.entry.cardEdge).color, 1).strokeRoundedRect(cx, cy, cw, ch, 34 * U);
    c.add(g);
    c.add(this.txt(W / 2, cy + 58 * U, title, 52).setOrigin(0.5));
    lines.forEach((l, i) => c.add(this.txt(W / 2, cy + 120 * U + i * lh, l, 32, '#3a2a1e', 800).setOrigin(0.5).setAlign('center').setWordWrapWidth(cw - 50 * U)));
    const acc = Phaser.Display.Color.HexStringToColor(theme.entry.accent).color, accD = Phaser.Display.Color.HexStringToColor(theme.entry.accentDark).color;
    buttons.forEach((b, i) => {
      const bw = cw - 70 * U, bh = (b.primary ? 96 : 80) * U, by = cy + 104 * U + lines.length * lh + i * 116 * U + 20 * U;
      const bc = this.add.container(W / 2, by + bh / 2);
      const bg = this.add.graphics();
      bg.fillStyle(b.primary ? accD : 0xc9b796, 1).fillRoundedRect(-bw / 2, -bh / 2 + 7 * U, bw, bh, 28 * U);
      bg.fillStyle(b.primary ? acc : 0xefe3cc, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 28 * U);
      bc.add(bg);
      bc.add(this.txt(0, 0, b.label, b.primary ? 46 : 34, b.primary ? '#fffaf0' : '#5a4636').setOrigin(0.5));
      bc.setSize(bw, bh + 14 * U).setInteractive({ useHandCursor: true });
      bc.on('pointerdown', () => bc.setScale(0.97));
      bc.on('pointerout', () => bc.setScale(1));
      bc.on('pointerup', () => { bc.setScale(1); sfx.blip?.(); b.cb(); });
      (bc as any).btnId = b.id;
      c.add(bc);
    });
    if (!reduceMotion()) { c.setScale(0.94); c.setPosition(W * 0.03, H * 0.03); this.tweens.add({ targets: c, scale: 1, x: 0, y: 0, duration: 260, ease: 'Back.easeOut' }); }
    this.panel = c;
    this.cardInfo = { title, lines, buttons: buttons.map((b) => b.id) };
    return c;
  }
  cardInfo: { title: string; lines: string[]; buttons: string[] } | null = null;
  /** Where a card button is, in CSS px (tests tap it). */
  buttonAt(id: string) {
    const c = this.panel; if (!c) return null;
    for (const o of c.list as any[]) if (o.btnId === id) return { x: o.x / DPR, y: o.y / DPR };
    return null;
  }
  closeCard() { this.panel?.destroy(); this.panel = null; this.cardInfo = null; }

  setPaused(on: boolean) {
    if (on === this.paused) return;
    this.paused = on;
    chaseAudio.pause(on);
    if (on) {
      this.tweens.pauseAll();
      this.card('Paused', ['Take a little rest!'], [
        { id: 'resume', label: 'Keep flying!', primary: true, cb: () => this.setPaused(false) },
        { id: 'stop', label: 'Stop the chase', cb: () => { this.closeCard(); this.paused = false; this.tweens.resumeAll(); this.escape(true); } },
      ]);
    } else { this.closeCard(); this.tweens.resumeAll(); }
  }

  // ---------- play ----------
  throwNet(tap: boolean) {
    const now = this.t;
    if (this.netPause > 0 || this.phase !== 'play') return;
    if (tap && now - this.lastThrow < CHASE.tapGapMs / 1000) return;
    this.lastThrow = now; this.autoT = CHASE.autoMs / 1000;
    const U = this.U;
    const img = this.add.image(this.px, this.H * 0.8 - 70 * U, 'ch_net').setDepth(25).setScale((U / R) * 0.55);
    this.netsL.push({ img, vx: 0, dead: false, t: 0 });
    this.nets++;
    chaseAudio.throw();
  }

  spawn() {
    const U = this.U, W = this.W;
    const r = Math.random();
    const x = 90 * U + Math.random() * (W - 180 * U);
    const obstacles = this.items.filter((i) => !i.dead && (i.kind === 'cloud' || i.kind === 'balloon')).length;
    if (r < 0.14) {
      // a happy little line of stars
      for (let i = 0; i < 4; i++) this.addItem('star', Phaser.Math.Clamp(x + Math.sin(i * 0.9) * 60 * U, 60 * U, W - 60 * U), -40 * U - i * 70 * U);
    } else if (r < 0.46) this.addItem('star', x, -40 * U);
    else if (r < 0.62) this.addItem('berry', x, -40 * U);
    else if (obstacles < 3) this.addItem(Math.random() < 0.55 ? 'cloud' : 'balloon', x, -100 * U);
    else this.addItem('star', x, -40 * U);
  }
  addItem(kind: Item['kind'], x: number, y: number) {
    const U = this.U;
    const key = kind === 'star' ? 'ch_star' : kind === 'berry' ? 'ch_berry' : kind === 'cloud' ? 'ch_puff' : `ch_balloon${Math.floor(Math.random() * 4)}`;
    const sc = kind === 'cloud' ? 0.85 : kind === 'balloon' ? 0.75 : 0.75;
    const img = this.add.image(x, y, key).setDepth(kind === 'cloud' ? 24 : 22).setScale((U / R) * sc);
    if (kind === 'balloon') img.setOrigin(0.5, 0.35);
    const rr = (kind === 'cloud' ? 72 : kind === 'balloon' ? 42 : 30) * U;
    this.items.push({ img, kind, r: rr, vy: CHASE.scrollPx * U * (kind === 'balloon' ? 0.8 : 1), ph: Math.random() * 6, dead: false });
  }

  spark(x: number, y: number, n: number, tint: number, key = 'ch_spark', spread = 90, depth = 60) {
    if (reduceMotion()) n = Math.ceil(n / 3);
    const U = this.U;
    for (let i = 0; i < n; i++) {
      if (this.sparks.length > 70) break;
      const im = this.add.image(x, y, key).setDepth(depth).setTint(tint).setScale((U / R) * (0.5 + Math.random() * 0.6));
      this.sparks.push(im);
      const a = Math.random() * Math.PI * 2, d = (spread * 0.4 + Math.random() * spread) * U;
      this.tweens.add({ targets: im, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: im.scale * 0.4, angle: Math.random() * 180, duration: 500 + Math.random() * 400, ease: 'Cubic.easeOut',
        onComplete: () => { im.destroy(); this.sparks = this.sparks.filter((s) => s !== im); } });
    }
  }
  float(x: number, y: number, s: string, color = '#ffffff') {
    const t = this.txt(x, y, s, 40, color).setOrigin(0.5).setDepth(80).setStroke('#2a4a7a', 7 * this.U);
    // 70: keep it clear of the pause button and the meter / stars boxes (it floats up 80 px).
    const U = this.U, hw = t.width / 2 + 16 * U;
    const cx = Phaser.Math.Clamp(x, hw + 12 * U, this.W - hw - 12 * U);
    const cy = Math.max(y, 170 * U + 80 * U + t.height / 2);
    t.setPosition(cx, cy);
    this.floats.push(t);
    this.tweens.add({ targets: t, y: cy - 80 * this.U, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => { this.floats = this.floats.filter((q) => q !== t); t.destroy(); } });
  }
  floats: Phaser.GameObjects.Text[] = [];

  update(_time: number, delta: number) {
    if (this.paused || this.phase === 'done') return;
    const dt = Math.min(delta / 1000, 1 / 20);
    const U = this.U, W = this.W, H = this.H, rm = reduceMotion();
    const playing = this.phase === 'play';
    if (playing) this.t += dt;
    // Backdrop: the meadow far below, slow clouds, quick wind streaks.
    const sp = this.phase === 'caught' ? 0.35 : 1;
    this.ground.tilePositionY -= (rm ? 25 : 70) * sp * dt / (U / R * 1.1) * U;
    for (const c of this.far) { c.y += (rm ? 50 : 150) * sp * U * dt; if (c.y > H + 120 * U) { c.y = -120 * U; c.x = Math.random() * W; } }
    for (const s of this.streaks) {
      s.y += (rm ? 0 : 1100) * sp * U * dt;
      if (s.y > H + 150 * U || s.alpha === 0) { s.y = -Math.random() * H * 0.6; s.x = Math.random() * W; s.setAlpha(rm ? 0 : 0.25 + Math.random() * 0.25); }
    }

    // Steering: the mount glides to your finger (or the arrow keys / autopilot for tests).
    const k = this.keys;
    if (k && (k.LEFT.isDown || k.A.isDown)) this.tx = this.px - 200 * U;
    if (k && (k.RIGHT.isDown || k.D.isDown)) this.tx = this.px + 200 * U;
    if (this.autopilot && playing) this.tx = this.thx;
    const lo = 80 * U, hi = W - 80 * U;
    this.tx = Phaser.Math.Clamp(this.tx, lo, hi);
    const prev = this.px;
    this.px += (this.tx - this.px) * (1 - Math.exp(-dt * 7));
    this.pvx = (this.px - prev) / Math.max(dt, 1e-3);
    if (Math.abs(this.pvx) > 60 * U) this.face = this.pvx > 0 ? 1 : -1;
    this.drawMount(dt);

    // The thief: a big lazy zigzag (slower with every net), bobbing, friends waving on its back.
    if (this.phase === 'play' || this.phase === 'intro') {
      const slow = Math.max(0.35, 1 - CHASE.slowPerHit * this.hits);
      this.thPh += dt * CHASE.thiefSpeed * slow;
      this.thPh2 += dt * CHASE.thiefSpeed * 0.53 * slow;
      const A = Math.min(W * 0.34, 380 * U);
      const nx = W / 2 + A * Math.sin(this.thPh) + A * 0.3 * Math.sin(this.thPh2 * 1.7 + 1);
      if (Math.abs(nx - this.thx) > 0.5) this.thFace = nx > this.thx ? 1 : -1;
      this.thx = nx;
      const ty = this.thBaseY + this.hits * 0.035 * H;
      this.thy += (ty - this.thy) * (1 - Math.exp(-dt * 3));
    }
    const bob = rm ? 0 : Math.sin(this.time.now / 140) * 8 * U;
    this.thSpin = Math.max(0, this.thSpin - dt);
    const wig = this.thSpin > 0 && !rm ? Math.sin(this.thSpin * 40) * 0.25 : 0;
    this.thief.setPosition(this.thx, this.thy + bob).setFlipX(this.thFace < 0).setRotation(wig);
    if (this.invul > 0) { this.invul -= dt; this.thief.setAlpha(Math.floor(this.invul * 10) % 2 ? 0.55 : 1); } else this.thief.setAlpha(1);
    this.thShadow.setPosition(this.thx, this.thy + 90 * U);
    this.carry.forEach((c, i) => {
      if ((c as any).freed) return;
      const n = this.carry.length, off = (i - (n - 1) / 2) * 54 * U;
      c.setPosition(this.thx + off - this.thFace * 14 * U, this.thy - 40 * U + bob * 0.6 - Math.abs(off) * 0.15).setRotation(rm ? 0 : Math.sin(this.time.now / 260 + i) * 0.12);
    });

    if (!playing) return;

    // Nets: on a gentle beat by themselves (taps add more); paused for a moment after a bump.
    this.netPause = Math.max(0, this.netPause - dt);
    this.autoT = Math.min(this.autoT, CHASE.autoMs / 1000) - dt;
    if (this.autoT <= 0) this.throwNet(false);
    for (const n of this.netsL) {
      if (n.dead) continue;
      n.t += dt;
      const want = Phaser.Math.Clamp((this.thx - n.img.x) * 2.2, -CHASE.netCurve * U, CHASE.netCurve * U);
      n.vx += (want - n.vx) * Math.min(1, dt * 4);
      n.img.x += n.vx * dt; n.img.y -= CHASE.netSpeed * U * dt;
      n.img.setScale((U / R) * (0.55 + Math.min(0.45, n.t * 0.9))).setRotation(rm ? 0 : n.t * 3);
      if (Math.hypot(n.img.x - this.thx, n.img.y - (this.thy - 10 * U)) < CHASE.hitR * U) {
        n.dead = true;
        if (this.invul > 0) { this.spark(n.img.x, n.img.y, 6, 0xbfe6ff); n.img.destroy(); continue; }
        this.netHit(n.img);
      } else if (n.img.y < -80 * U) { n.dead = true; n.img.destroy(); }
    }
    this.netsL = this.netsL.filter((n) => !n.dead);
    if (this.phase !== 'play') return;

    // Stars, berries and soft obstacles drift down past you.
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 0.8 + Math.random() * 0.4; this.spawn(); }
    const my = H * 0.8;
    for (const it of this.items) {
      if (it.dead) continue;
      it.img.y += it.vy * dt;
      if (it.kind === 'balloon' && !rm) it.img.x += Math.sin(this.t * 2 + it.ph) * 30 * U * dt;
      if (it.kind === 'star' && !rm) it.img.setRotation(Math.sin(this.t * 3 + it.ph) * 0.3);
      const dx = this.px - it.img.x, dy = my - it.img.y, dist = Math.hypot(dx, dy);
      // A friendly magnet pulls nearby stars and berries in.
      if ((it.kind === 'star' || it.kind === 'berry') && dist < 170 * U) { it.img.x += dx * dt * 5; it.img.y += dy * dt * 5; }
      if (!it.hit && dist < 55 * U + it.r) {
        it.hit = true;
        if (it.kind === 'star') { this.stars++; this.starTxt.setText(String(this.stars)); chaseAudio.star(); this.spark(it.img.x, it.img.y, 6, 0xffe27a); it.dead = true; it.img.destroy(); }
        else if (it.kind === 'berry') {
          this.berries++; this.berryTxt.setText(String(this.berries)); chaseAudio.berry(); this.spark(it.img.x, it.img.y, 6, 0xff7aa8); it.dead = true; it.img.destroy();
          if (addFruit('berry')) this.game.events.emit('snacks', save.snacks);
        } else this.bump(it);
      }
      if (it.img.y > H + 160 * U) { it.dead = true; it.img.destroy(); }
    }
    this.items = this.items.filter((i) => !i.dead);
    this.drawTime();
    if (this.t >= CHASE.timeS) this.escape(false);
  }

  drawMount(dt: number) {
    const def = this.def, U = this.U, H = this.H, rm = reduceMotion(), SC = this.SC;
    const d = this.face;
    this.wobble = Math.max(0, this.wobble - dt);
    const w = this.wobble > 0 && !rm ? Math.sin(this.wobble * 26) * 0.35 * (this.wobble / CHASE.bumpS) : 0;
    const tilt = Phaser.Math.Clamp(this.pvx / (1600 * U), -0.3, 0.3) - d * 0.12 + w;
    this.flap += dt * Math.PI * 2 * Phaser.Math.Clamp(0.7 * (def.flapRate ?? 2), 1.2, 3.2);
    const lift = rm ? 0.6 : Math.cos(this.flap);
    const x = this.px, y = H * 0.8 + (rm ? 0 : Math.sin(this.flap) * 5 * U + Math.sin(this.time.now / 600) * 6 * U);
    this.shadow.setPosition(x, H * 0.8 + 80 * U);
    const bs = SC / (frameScale[def.body] ?? 1);
    this.body.setPosition(x, y).setFlipX(d < 0).setRotation(tilt).setScale(bs);
    const cos = Math.cos(tilt), sin = Math.sin(tilt);
    const at = (ox: number, oy: number) => [x + (ox * d) * cos - oy * sin, y + (ox * d) * sin + oy * cos];
    const ws = SC / (frameScale[def.wing] ?? 1);
    if (def.style === 'wings') {
      const sy = ws * (lift >= 0 ? 0.35 + 0.65 * lift : 0.35 + 0.95 * lift);
      const sweep = d * (0.32 + 0.08 * Math.sin(this.flap));
      const [nx, ny] = at(-4 * SC, -7 * SC);
      this.wing.setPosition(nx, ny).setScale(ws, sy).setRotation(-sweep + tilt).setFlipX(d < 0);
      const [fx, fy] = at(3 * SC, -10 * SC);
      this.wingFar.setPosition(fx, fy).setScale(ws * 0.9, sy * 0.88).setRotation(-sweep * 1.15 + tilt).setFlipX(d < 0);
    } else if (def.style === 'prop') {
      const [pa, pb] = def.propAt ?? [60, 0];
      const [px, py] = at(pa * SC, pb * SC);
      const spin = this.time.now / 22;
      this.wing.setPosition(px, py).setScale(ws * 0.6, ws * (0.15 + 0.85 * Math.abs(Math.cos(spin)))).setRotation(tilt).setFlipX(d < 0);
      this.wingFar.setPosition(px, py).setScale(ws * 0.9, ws).setRotation(tilt).setFlipX(d < 0);
    } else if (def.style === 'cape') {
      const [ca, cb] = CAPE_AT[def.id] ?? [2, -20];
      const [cx, cy] = at(ca * SC, cb * SC);
      const cs = SC / (frameScale[def.wingFar] ?? 1);
      this.wingFar.setOrigin(d < 0 ? 1 - CAPE_OX : CAPE_OX, CAPE_OY).setPosition(cx, cy).setScale(cs * 1.12, cs * (0.95 + (rm ? 0 : Math.sin(this.time.now / 160) * 0.06))).setRotation(tilt + d * 0.18).setFlipX(d < 0);
      const [bx, by] = at((ca + 4) * SC, (cb + 2) * SC);
      this.wing.setPosition(bx, by).setScale(ws).setRotation(tilt).setFlipX(d < 0);
    }
  }

  netHit(net: Phaser.GameObjects.Image) {
    const U = this.U;
    this.hits++;
    this.invul = CHASE.invulnS; this.thSpin = 0.7;
    // The net wraps the thief for a moment, then it wriggles free (a bit slower now).
    net.setDepth(31).setPosition(this.thx, this.thy - 10 * U);
    this.tweens.add({ targets: net, scale: (U / R) * 1.7, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => net.destroy() });
    this.spark(this.thx, this.thy, 12, 0xbfe6ff);
    this.spark(this.thx, this.thy, 6, 0xffe27a);
    chaseAudio.hit(this.hits);
    sfx.giggle?.(this.d.voice * 1.1);
    const ring = this.meter[this.hits - 1], hi = this.hits - 1;
    if (ring && !reduceMotion()) {
      // 70: a star zooms from the thief up into its ring on the Catch meter, then the ring fills.
      const st = this.add.image(this.thx, this.thy, 'ch_star').setDepth(104).setScale((U / R) * 0.9);
      this.tweens.add({ targets: st, x: ring.ring.x, y: ring.ring.y, scale: (U / R) * 0.5, angle: 200, duration: 420, ease: 'Cubic.easeIn',
        onComplete: () => { st.destroy(); this.setMeter(hi); } });
    } else this.setMeter(hi);
    const left = CHASE.hits - this.hits;
    if (left > 0) this.float(this.thx, this.thy - 90 * U, left === 1 ? 'One more!' : `Got it! ${left} more!`, '#fff3a8');
    if (this.hits >= CHASE.hits) this.caught();
  }

  bump(it: Item) {
    const U = this.U;
    this.bumps++;
    this.wobble = CHASE.bumpS; this.netPause = CHASE.netPauseS;
    chaseAudio.bump();
    // A soft boing: you bounce a little to the side; the cloud squishes away, the balloon floats off.
    const away = this.px >= it.img.x ? 1 : -1;
    this.tx = Phaser.Math.Clamp(this.px + away * 90 * U, 80 * U, this.W - 80 * U);
    it.dead = true;
    const img = it.img;
    this.tweens.add({ targets: img, scaleX: img.scaleX * 1.3, scaleY: img.scaleY * 0.7, alpha: 0, y: img.y - (it.kind === 'balloon' ? 220 : 40) * U, x: img.x - away * 60 * U, duration: 600, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
    this.spark(this.px, this.H * 0.8 - 30 * U, 5, 0xffffff);
    this.float(this.px, this.H * 0.8 - 110 * U, 'Boing!', '#ffffff');
  }

  caught() {
    const U = this.U, W = this.W, H = this.H, rm = reduceMotion();
    this.phase = 'caught';
    this.tweens.killTweensOf(this.hint);
    for (const n of this.netsL) n.img.destroy();
    this.netsL = [];
    for (const it of this.items) if (!it.dead && (it.kind === 'cloud' || it.kind === 'balloon')) { it.dead = true; const im = it.img; this.tweens.add({ targets: im, alpha: 0, duration: 400, onComplete: () => im.destroy() }); }
    // A big bubble net drops over the thief.
    const big = this.add.image(this.thx, this.thy - 10 * U, 'ch_bignet').setDepth(32).setScale((U / R) * 2.2).setAlpha(0);
    this.tweens.add({ targets: big, scale: (U / R) * 0.62, alpha: 1, duration: rm ? 1 : 520, ease: 'Bounce.easeOut' });
    chaseAudio.fanfare();
    sfx.solve?.();
    this.spark(this.thx, this.thy, 20, 0xffe27a);
    // Your friends hop off its back and fly to you, with hearts.
    this.time.delayedCall(rm ? 100 : 700, () => {
      this.carry.forEach((c, i) => {
        (c as any).freed = true;
        this.tweens.add({ targets: c, x: W / 2 + (i - (this.carry.length - 1) / 2) * 150 * U, y: H * 0.5, scale: c.scale * 1.5, rotation: 0, duration: rm ? 1 : 900, ease: 'Back.easeOut',
          onComplete: () => { this.spark(c.x, c.y, 8, 0xffffff, 'ch_heart', 110); } });
      });
      for (let i = 0; i < (rm ? 8 : 36); i++) this.time.delayedCall(i * 40, () => this.spark(Math.random() * W, Math.random() * H * 0.6, 1, [0xffe27a, 0xff9ab8, 0x8fd0ff, 0x9be07a][i % 4], i % 3 ? 'ch_spark' : 'ch_star', 60));
      sfx.sparkle?.();
    });
    this.time.delayedCall(rm ? 400 : 2000, () => {
      const names = this.d.taken.map((id) => mountById(id)?.name ?? 'friend');
      this.card(`You caught the ${this.d.kindName}!`, [
        names.length === 1 ? `Your ${names[0]} is free!` : `Your ${names.length} friends are free!`,
        `Off to the Thief Jail it goes!`,
        `You got ${this.stars} ${this.stars === 1 ? 'star' : 'stars'}${this.berries ? ` and ${this.berries} ${this.berries === 1 ? 'berry' : 'berries'}` : ''}!`,
      ], [{ id: 'home', label: 'Fly home!', primary: true, cb: () => this.finish('caught') }]);
    });
  }

  /** Time ran out (or you stopped): it hides your friends in their cells, gently. */
  escape(quit: boolean) {
    if (this.phase !== 'play' && this.phase !== 'intro') return;
    const U = this.U, rm = reduceMotion();
    this.phase = 'escaped';
    for (const n of this.netsL) n.img.destroy();
    this.netsL = [];
    sfx.giggle?.(this.d.voice);
    chaseAudio.aww();
    this.tweens.add({ targets: [this.thief, this.thShadow, ...this.carry], y: `-=${this.H * 0.45}`, alpha: 0, duration: rm ? 1 : 900, ease: 'Cubic.easeIn' });
    let got = 0;
    if (!quit) for (let i = 0; i < CHASE.consolation; i++) if (addFruit('berry')) got++;
    if (got) this.game.events.emit('snacks', save.snacks);
    this.consolation = got;
    this.time.delayedCall(rm ? 200 : 1000, () => {
      const one = this.d.taken.length === 1;
      const hid = [`The ${this.d.kindName} hid your ${one ? 'friend' : 'friends'}.`, `You can find ${one ? 'it' : 'them'} by the ${one ? 'puzzle' : 'puzzles'}!`];
      const lines = quit ? hid : [...hid, got ? `Here ${got === 1 ? 'is a berry' : `are ${got} berries`} for trying so hard!` : `You tried so hard!`];
      this.card(quit ? 'Okay!' : 'So close!', lines, [{ id: 'ok', label: 'OK!', primary: true, cb: () => this.finish(quit ? 'quit' : 'escaped') }]);
      void U;
    });
  }
  consolation = 0;

  finish(result: ChaseResult) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.closeCard();
    const stats: ChaseStats = { result, hits: this.hits, stars: this.stars, berries: this.berries, bumps: this.bumps, nets: this.nets, secs: Math.round(this.t * 10) / 10 };
    save.minor.chase_stars = (save.minor.chase_stars ?? 0) + this.stars;
    persist();
    chaseAudio.stop();
    const cam = this.cameras.main;
    const go = () => { const d = this.d; (window as any).__chaseLast = stats; this.scene.stop(); d.onEnd(stats); };
    if (reduceMotion()) go();
    else { cam.fadeOut(350, 255, 255, 255); cam.once('camerafadeoutcomplete', go); }
  }

  snapshot() {
    return {
      on: this.phase !== 'done', phase: this.phase, paused: this.paused, t: Math.round(this.t * 10) / 10, hits: this.hits, need: CHASE.hits,
      stars: this.stars, berries: this.berries, bumps: this.bumps, nets: this.nets, mount: this.d?.mountId, kind: this.d?.kind, taken: this.d?.taken,
      px: Math.round(this.px / DPR), thx: Math.round(this.thx / DPR), thy: Math.round(this.thy / DPR), card: this.cardInfo, consolation: this.consolation,
      floats: this.floats.map((t) => ({ x: Math.round(t.x / DPR), y: Math.round(t.y / DPR), w: Math.round(t.width / DPR), h: Math.round(t.height / DPR), s: t.text })),
      meter: { x: Math.round(this.meterBox.x / DPR), w: Math.round(this.meterBox.w / DPR), bottom: Math.round(114 * this.U / DPR), filled: this.meter.filter((m) => m.ring.alpha === 0).length, label: this.meterLabel?.text ?? null },
      art: looks.art, pause: { x: Math.round(64 * this.U / DPR), y: Math.round(64 * this.U / DPR) },
    };
  }
}
