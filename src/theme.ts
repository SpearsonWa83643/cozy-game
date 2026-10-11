// Theme system. A theme describes the whole look and feel; World, UI, audio and the ground
// painter read the active theme and listen for changes, so a switch happens live.
import Phaser from 'phaser';
import { save, persist, ThemeId } from './save';

export type Theme = {
  id: ThemeId;
  name: string;
  icon: string;                       // atlas2 frame for the toggle
  /** Ground colour transform (HSL in, HSL out) used by the tile painter. */
  ground: (h: number, s: number, l: number) => [number, number, number];
  /** Multiply tint for leafy trees/bushes that are not swapped (null = untouched). */
  foliage: number | null;
  /** Swap round trees for these frames (null = keep). */
  trees: string[] | null;
  /** Camera-space colour wash: gradient frame + alpha (null = none). */
  sky: { frame: string; alpha: number } | null;
  /** Extra soft fog banks (alpha) drifting near the camera. */
  fog: { tint: number; alpha: number } | null;
  /** Particles. */
  particles: { pollen: number[]; firefly: number[]; petal: string; petalTint: number[] | null };
  /** Critter variants. */
  critters: { cat: number | null; bats: boolean; ghosts: boolean; butterflies: number | null };
  /** Seasonal props (pumpkins, candles...) around paths and buildings. */
  props: boolean;
  /** Window/lamp glow colour. */
  glow: number;
  ui: { accent: number; accentDark: number; css: string; tab: number; tabOn: number };
  music: 'classic' | 'spooky';
};

const classic: Theme = {
  id: 'classic', name: 'Classic', icon: 'i_leaf',
  ground: (h, s, l) => [h, s, l],
  foliage: null, trees: null, sky: null, fog: null,
  particles: { pollen: [0xfff3c4, 0xffe8a3, 0xffffff], firefly: [0xe6ff8a, 0xfff07a], petal: 'petal', petalTint: null },
  critters: { cat: null, bats: false, ghosts: false, butterflies: null },
  props: false, glow: 0xffd27a,
  ui: { accent: 0xf2a93b, accentDark: 0xc9802a, css: '#f2a93b', tab: 0xf3e6cc, tabOn: 0xf2a93b },
  music: 'classic',
};

const halloween: Theme = {
  id: 'halloween', name: 'Halloween', icon: 'i_pumpkin',
  // Greens drift to a cool dusky teal; everything a touch darker so orange glows pop.
  ground: (h, s, l) => (h > 48 && h < 190 ? [h + 38, s * 0.78, l * 0.8] : [h - 4, s * 0.9, l * 0.86]),
  foliage: 0xd9b8e8, trees: ['h_tree0', 'h_tree1', 'h_tree2'],
  sky: { frame: 'sky_halloween', alpha: 0.32 },
  fog: { tint: 0xd8c8ff, alpha: 0.22 },
  particles: { pollen: [0xffb347, 0xff8c2e, 0xffe08a], firefly: [0xffb347, 0xffd36b], petal: 'p_leafo', petalTint: [0xffffff, 0xffc89a, 0xe0a0ff] },
  critters: { cat: 0x4a4058, bats: true, ghosts: true, butterflies: 0xffa64d },
  props: true, glow: 0xffa040,
  ui: { accent: 0xb072e0, accentDark: 0x7f4ab0, css: '#b072e0', tab: 0xefe2f7, tabOn: 0xb072e0 },
  music: 'spooky',
};

export const THEMES: Record<ThemeId, Theme> = { classic, halloween };
export const THEME_ORDER: ThemeId[] = ['classic', 'halloween'];

export const themeEvents = new Phaser.Events.EventEmitter();
export let theme: Theme = THEMES[save.theme] ?? classic;

export function setTheme(id: ThemeId) {
  if (theme.id === id) return;
  theme = THEMES[id];
  save.theme = id;
  persist();
  themeEvents.emit('change', theme);
}
