// 66-67: learning puzzle sites for young kids. A painted letter easel sits in a reserved clearing;
// tap Play to open a big picture-and-letters board (see learn/panel.ts). Spell all three words and a
// chest pops up with a treasure. No typing, no fail state, and replays are always free.
// The sites also work as Mount Thief hiding spots (HIDES in thief.ts).
import type Phaser from 'phaser';
import { PUZZLE_SITES } from '../layout';
import { save, setPuzzle, hasTreasure } from '../save';
import { Chest, resetStone } from '../puzzles';
import type { WorldScene } from '../scenes/World';

export type LearnKind = 'spelling' | 'numbers';
export type LearnDef = { id: string; kind: LearnKind; name: string; words: string[]; treasure: string };

/** The spelling sites (3-letter words, each with a painted picture in learn/art.ts). */
export const LEARN_DEFS: LearnDef[] = [
  { id: 'spell1', kind: 'spelling', name: 'Letter Easel', words: ['cat', 'sun', 'dog'], treasure: 'letter_block' },
  { id: 'spell2', kind: 'spelling', name: 'Seaside Easel', words: ['hat', 'bee', 'cup'], treasure: 'story_book' },
  // 67: counting boards. Each "word" is a sum to count out with fruit (grove) or stones (hills).
  { id: 'num1', kind: 'numbers', name: 'Counting Board', words: ['1+2', '2+3', '4-1'], treasure: 'abacus' },
  { id: 'num2', kind: 'numbers', name: 'Pebble Board', words: ['3+1', '5-2', '2+4'], treasure: 'number_star' },
];
/** What each counting board counts. */
export type CountThing = 'apple' | 'stone' | 'shell' | 'star' | 'berry' | 'fish';
export const COUNT_THING: Record<string, CountThing> = { num1: 'apple', num2: 'stone' };
/** 76: free play counts a surprise thing each round. */
export const FREE_THINGS: CountThing[] = ['apple', 'stone', 'shell', 'star', 'berry', 'fish'];
export const THING_NAMES: Record<CountThing, string> = { apple: 'apples', stone: 'stones', shell: 'shells', star: 'stars', berry: 'strawberries', fish: 'fish' };
/** Extra words for free play once a site is solved. */
export const BONUS_WORDS = ['pig', 'bus', 'cat', 'sun', 'dog', 'hat', 'bee', 'cup', 'fox', 'egg', 'bug', 'car', 'owl', 'pie']; // 75: +6

type Site = { def: LearnDef; x: number; y: number; chest: Chest; done: number; glow: Phaser.GameObjects.Image };

export class LearnSites {
  sites: Record<string, Site> = {};
  constructor(private w: WorldScene) {
    for (const def of LEARN_DEFS) {
      const at = PUZZLE_SITES.find((p) => p.id === def.id);
      if (at) this.build(def, at.x, at.y);
    }
  }
  private build(def: LearnDef, x: number, y: number) {
    const w = this.w;
    const solved = !!save.puzzles[def.id];
    // A soft warm glow behind the easel invites a tap until it's solved.
    const glow = w.fx(x, y - 60, 'glow', 0.5).setBlendMode('ADD').setTint(0xfff0a8).setAlpha(solved ? 0 : 0.45).setDepth(y - 1);
    w.tweens.add({ targets: glow, scale: glow.scale * 1.25, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    w.shadow(x + 2, y - 2, 110, 0.6);
    const num = def.kind === 'numbers';
    const easel = w.img(x, y, num ? 'learn_numboard' : 'learn_easel', 0.5, 1, 0.72).setDepth(y);
    w.tweens.add({ targets: easel, angle: { from: -1.2, to: 1.2 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    w.solidCircle(x, y - 10, 30);
    // A few big ABC (or 1 2 3) blocks scattered on the grass.
    (num ? ([['1', -74, -22], ['2', -50, -2], ['3', 70, -26]] as const) : ([['A', -74, -22], ['B', -50, -2], ['C', 70, -26]] as const)).forEach(([l, dx, dy]) => {
      w.shadow(x + dx, y + dy - 2, 30, 0.5);
      w.img(x + dx, y + dy, `learn_block_${l}`, 0.5, 1, 0.5).setDepth(y + dy);
    });
    const chest = new Chest(w, x + 112, y + 34, def.treasure);
    chest.pid = def.id;
    chest.set(solved, solved && hasTreasure(def.treasure));
    const site: Site = { def, x, y, chest, done: 0, glow };
    this.sites[def.id] = site;
    w.interactables.push({ x, y, r: 84, label: 'Play', promptY: 150, reach: 260, approach: [0, 44], enabled: () => true, action: () => this.open(def.id) });
    resetStone(w, x - 108, y + 46, def.id, () => this.resetById(def.id));
  }
  open(id: string) {
    if (!this.sites[id]) return;
    this.w.game.events.emit('learn-open', id);
  }
  def(id: string) { return this.sites[id]?.def; }
  /** Words spelled so far this round (kept across closing the board). */
  progress(id: string) { return this.sites[id]?.done ?? 0; }
  setProgress(id: string, n: number) { const s = this.sites[id]; if (s) s.done = n; }
  dirty(id: string) { return (this.sites[id]?.done ?? 0) > 0; }
  chestById(id: string) { return this.sites[id]?.chest ?? null; }
  resetById(id: string) {
    const s = this.sites[id];
    if (!s) return;
    s.done = 0;
    s.chest.reset();
    this.w.tweens.add({ targets: s.glow, alpha: 0.45, duration: 400 });
  }
  /** All words spelled: mark solved and pop the chest up. */
  solve(id: string) {
    const s = this.sites[id];
    if (!s) return;
    s.done = 0;
    const first = !save.puzzles[id];
    setPuzzle(id);
    this.w.tweens.add({ targets: s.glow, alpha: 0, duration: 600 });
    this.w.burst(s.x, s.y - 80, 0xffe08a, 24, 'spark');
    if (s.chest.revealed) { if (!s.chest.opened) this.w.game.events.emit('toast', 'Your chest is waiting!'); else this.w.game.events.emit('toast', s.def.kind === 'numbers' ? 'Wonderful counting!' : 'Wonderful spelling!'); return; }
    this.w.time.delayedCall(450, () => { s.chest.reveal(); this.w.game.events.emit('toast', first ? 'A chest appeared!' : 'The chest is back!'); });
  }
  /** Debug/test view. */
  state() {
    const out: Record<string, { x: number; y: number; done: number; solved: boolean; revealed: boolean; opened: boolean; chest: [number, number] }> = {};
    for (const [id, s] of Object.entries(this.sites)) out[id] = { x: s.x, y: s.y, done: s.done, solved: !!save.puzzles[id], revealed: s.chest.revealed, opened: s.chest.opened, chest: [s.chest.x, s.chest.y] };
    return out;
  }
}
