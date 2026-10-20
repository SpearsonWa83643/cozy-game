// Theme system. A theme describes the whole look and feel; World, UI, audio and the ground
// painter read the active theme and listen for changes, so a switch happens live.
import Phaser from 'phaser';
import { save, persist, normTheme, ThemeId } from './save';
import { SPRING, HALLOWEEN, FALL, CHRISTMAS, type Soundscape } from './soundscapes';

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
  /** Fall: multiply tints cycled over leafy trees (red / orange / gold canopies), null = none. */
  autumn?: { tints: number[]; birch: number; pine: number; fruit: number } | null;
  /** Christmas: snow-frosted trees (leafy canopies go frosty pale, pines stay deep green), null = none. */
  frost?: { leafy: number; pine: number; birch: number; fruit: number } | null;
  /** Blossom tint for every few round leafy trees (Spring cherry/apple blossom), null = none. */
  blossom: { tints: number[]; every: number } | null;
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
  /** Fall props: crunchy leaf piles and hay bales (tap to play). */
  fallProps?: boolean;
  /** Tint for the meadow's grass tufts (Fall: dry golden grass). */
  grass?: number;
  /** Window/lamp glow colour. */
  glow: number;
  ui: { accent: number; accentDark: number; css: string; tab: number; tabOn: number };
  /** The theme's own soundscape (music + ambience). Every theme must have its own. */
  soundscape: Soundscape;
  /** Entry (name + birthday) screen look. A new theme just fills this in. */
  entry: EntryLook;
};

/** Colours + drifting decorations for the DOM entry screen (see entry.ts). */
export type EntryLook = {
  sky: [string, string, string];      // backdrop gradient, top -> bottom (CSS colours, may be translucent)
  title: string; titleEdge: string;   // big title letters + their outline/shadow
  card: string; cardEdge: string;     // parchment card + border
  ink: string; soft: string;          // main text + secondary text
  accent: string; accentDark: string; // Play button / steppers
  field: string;                      // input + stepper value background
  drift: { shape: 'leaf' | 'bat' | 'petal' | 'snow'; colors: string[]; count: number };
  glow: { colors: string[]; count: number }; // fireflies / embers
  iconSvg: string;                    // little picture for the theme toggle (inline SVG)
};

const spring: Theme = {
  id: 'spring', name: 'Spring', icon: 'i_leaf',
  // Fresh pastel spring: greens nudge toward a light yellow-green and lift a little; paths stay warm.
  ground: (h, s, l) => (h > 60 && h < 170 ? [h - 8, s * 0.9, Math.min(l * 1.1 + 2, 88)] : [h, s * 0.95, Math.min(l * 1.04, 90)]),
  foliage: null, trees: null,
  blossom: { tints: [0xffc4dc, 0xffe0ec, 0xfff0f4], every: 3 },
  sky: null,
  fog: { tint: 0xf2fff6, alpha: 0.07 }, // a light, rain-fresh haze
  particles: { pollen: [0xfff6c8, 0xffe1ef, 0xffffff, 0xe8ffd8], firefly: [0xe6ff8a, 0xfff07a], petal: 'petal', petalTint: [0xffc4dc, 0xffffff, 0xffdbe8, 0xfff3f7] },
  critters: { cat: null, bats: false, ghosts: false, butterflies: null },
  props: false, glow: 0xffd27a,
  ui: { accent: 0x6fbf62, accentDark: 0x4a9442, css: '#6fbf62', tab: 0xeef6e0, tabOn: 0x6fbf62 },
  soundscape: SPRING,
  entry: {
    sky: ['rgba(170,214,236,0.78)', 'rgba(196,232,170,0.72)', 'rgba(84,140,76,0.84)'],
    title: '#fffaf0', titleEdge: '#5a7a3a',
    card: 'rgba(253,248,236,0.96)', cardEdge: '#c9dca8',
    ink: '#33402a', soft: '#7a8a60',
    accent: '#6fbf62', accentDark: '#4a9442', field: '#fffdf6',
    drift: { shape: 'petal', colors: ['#ffc4dc', '#ffe0ec', '#ffffff', '#fff2a8'], count: 16 },
    glow: { colors: ['#fff6c8', '#ffe1ef'], count: 12 },
    iconSvg: '<svg viewBox="0 0 40 40"><g fill="#ffc4dc" stroke="#e78fb2" stroke-width="1.8"><ellipse cx="20" cy="10" rx="6" ry="8"/><ellipse cx="29.5" cy="17" rx="6" ry="8" transform="rotate(72 29.5 17)"/><ellipse cx="26" cy="28.5" rx="6" ry="8" transform="rotate(144 26 28.5)"/><ellipse cx="14" cy="28.5" rx="6" ry="8" transform="rotate(216 14 28.5)"/><ellipse cx="10.5" cy="17" rx="6" ry="8" transform="rotate(288 10.5 17)"/></g><circle cx="20" cy="20" r="4.5" fill="#ffd84a" stroke="#d9a72a" stroke-width="1.5"/></svg>',
  },
};

const halloween: Theme = {
  id: 'halloween', name: 'Halloween', icon: 'i_pumpkin',
  // Greens drift to a cool dusky teal; everything a touch darker so orange glows pop.
  ground: (h, s, l) => (h > 48 && h < 190 ? [h + 58, s * 0.62, l * 0.84] : [h - 6, s * 0.9, l * 0.86]),
  foliage: 0xd9b8e8, trees: ['h_tree0', 'h_tree1', 'h_tree2'], blossom: null,
  sky: { frame: 'sky_halloween', alpha: 0.42 },
  fog: { tint: 0xd8c8ff, alpha: 0.22 },
  particles: { pollen: [0xffb347, 0xff8c2e, 0xffe08a], firefly: [0xffb347, 0xffd36b], petal: 'p_leafo', petalTint: [0xffffff, 0xffc89a, 0xe0a0ff] },
  critters: { cat: 0x4a4058, bats: true, ghosts: true, butterflies: 0xffa64d },
  props: true, glow: 0xffa040,
  ui: { accent: 0xb072e0, accentDark: 0x7f4ab0, css: '#b072e0', tab: 0xefe2f7, tabOn: 0xb072e0 },
  soundscape: HALLOWEEN,
  entry: {
    sky: ['rgba(38,24,64,0.86)', 'rgba(84,48,104,0.78)', 'rgba(28,20,36,0.92)'],
    title: '#ffcf7a', titleEdge: '#3a1d4a',
    card: 'rgba(246,234,250,0.96)', cardEdge: '#b98fd9',
    ink: '#2f2140', soft: '#7a5a92',
    accent: '#ff9a3c', accentDark: '#c8641c', field: '#fff8f0',
    drift: { shape: 'bat', colors: ['#2a1f36', '#3d2c52', '#1e1628'], count: 9 },
    glow: { colors: ['#ffb347', '#ffd36b', '#ff8c2e'], count: 18 },
    iconSvg: '<svg viewBox="0 0 40 40"><path d="M20 10 C20 6 23 4 25 4" stroke="#4f7d2e" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="20" cy="23" rx="15" ry="12" fill="#ff8c2e" stroke="#b5521a" stroke-width="2.5"/><path d="M13 21 l3 -3 l3 3z M21 21 l3 -3 l3 3z M13 27 q7 5 14 0" fill="#3a1d1a" stroke="#3a1d1a" stroke-width="1.5"/></svg>',
  },
};

const fall: Theme = {
  id: 'fall', name: 'Fall', icon: 'i_maple',
  // Cozy autumn: greens turn to warm golden-olive grass and dry a little; paths go a touch toastier.
  ground: (h, s, l) => (h > 60 && h < 170 ? [Math.max(48, h - 38), s * 0.78, Math.min(l * 1.02, 84)] : [h - 3, s * 1.02, l * 0.98]),
  foliage: 0xf2b060, trees: null, blossom: null,
  // Tints multiply the amber autumn tree4 that Fall puts on every leafy round tree: amber, red, gold, rust, honey.
  autumn: { tints: [0xffffff, 0xff9a86, 0xfff0a0, 0xffb894, 0xffe0b0], birch: 0xffd04a, pine: 0xd8d0a0, fruit: 0xffd8a0 },
  sky: null,
  fog: { tint: 0xffe6c4, alpha: 0.08 }, // a soft golden haze
  particles: { pollen: [0xffd9a0, 0xffc070, 0xfff0d0], firefly: [0xffc04a, 0xffe08a], petal: 'p_maple', petalTint: [0xf2603a, 0xff9a4a, 0xffc24a, 0xd8482a, 0xffd870] },
  critters: { cat: null, bats: false, ghosts: false, butterflies: 0xffb060 },
  props: false, fallProps: true, grass: 0xf2d07c, glow: 0xffb04a,
  ui: { accent: 0xe0803a, accentDark: 0xb05a24, css: '#e0803a', tab: 0xf8e8d4, tabOn: 0xe0803a },
  soundscape: FALL,
  entry: {
    sky: ['rgba(250,206,150,0.78)', 'rgba(232,150,90,0.72)', 'rgba(120,70,40,0.86)'],
    title: '#fff6e8', titleEdge: '#8a4a1e',
    card: 'rgba(253,244,230,0.96)', cardEdge: '#e8b888',
    ink: '#4a2e1a', soft: '#8a6440',
    accent: '#e0803a', accentDark: '#b05a24', field: '#fffaf2',
    drift: { shape: 'leaf', colors: ['#f2603a', '#ff9a4a', '#ffc24a', '#d8482a'], count: 16 },
    glow: { colors: ['#ffc04a', '#ffe08a'], count: 10 },
    iconSvg: '<svg viewBox="0 0 40 40"><path d="M20 4 L23 12 L30 9 L28 17 L36 18 L29 23 L32 30 L23 27 L21 35 L19 35 L17 27 L8 30 L11 23 L4 18 L12 17 L10 9 L17 12 Z" fill="#ff8a3a" stroke="#b5481a" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 14 L20 37" stroke="#9a3a14" stroke-width="1.6" stroke-linecap="round"/></svg>',
  },
};

const christmas: Theme = {
  id: 'christmas', name: 'Christmas', icon: 'i_xmas',
  // Snowy Christmas: grass is buried under soft, slightly blue-white snow; paths stay as warm
  // trodden earth so the way home still reads clearly.
  ground: (h, s, l) => (h > 60 && h < 170 ? [206, Math.min(30, s * 0.4 + 8), Math.min(l * 0.3 + 66, 95)] : [h - 4, s * 0.8, Math.min(l * 1.02, 88)]),
  foliage: 0xe4f2f4, trees: null, blossom: null,
  frost: { leafy: 0xcfe6e0, pine: 0x6fa888, birch: 0xf2f6f8, fruit: 0xf4f0ea },
  grass: 0xcfe4e8, // frosty, snow-dusted grass tufts
  sky: null,
  fog: { tint: 0xeaf4ff, alpha: 0.1 }, // a cold, soft snowy haze
  // Falling snowflakes; the fireflies become twinkly red/green/gold fairy lights.
  particles: { pollen: [0xffffff, 0xeaf4ff, 0xdcecff], firefly: [0xff5a5a, 0x6ad86a, 0xffd04a], petal: 'p_snow', petalTint: [0xffffff, 0xf2f8ff, 0xe4f0ff] },
  critters: { cat: null, bats: false, ghosts: false, butterflies: 0xffffff },
  props: false, glow: 0xffc860,
  ui: { accent: 0xd0423a, accentDark: 0x9a2a26, css: '#d0423a', tab: 0xf6ece6, tabOn: 0xd0423a },
  soundscape: CHRISTMAS,
  entry: {
    sky: ['rgba(150,180,220,0.80)', 'rgba(196,214,236,0.74)', 'rgba(40,82,64,0.88)'],
    title: '#ffffff', titleEdge: '#9a2a26',
    card: 'rgba(252,250,246,0.97)', cardEdge: '#d8b0a8',
    ink: '#3a2a26', soft: '#7a6058',
    accent: '#d0423a', accentDark: '#9a2a26', field: '#fffdfa',
    drift: { shape: 'snow', colors: ['#ffffff', '#f2f8ff', '#e4f0ff'], count: 22 },
    glow: { colors: ['#ff6a6a', '#7ae07a', '#ffd04a'], count: 12 },
    iconSvg: '<svg viewBox="0 0 40 40"><rect x="17.5" y="30" width="5" height="6" rx="1" fill="#8a5a34"/><path d="M20 6 L30 19 L25 19 L33 30 L7 30 L15 19 L10 19 Z" fill="#3a9a5a" stroke="#1f6a3a" stroke-width="1.8" stroke-linejoin="round"/><circle cx="16" cy="23" r="1.9" fill="#ff4a4a"/><circle cx="24" cy="25" r="1.9" fill="#ffd04a"/><circle cx="21" cy="16" r="1.7" fill="#4ab0ff"/><path d="M20 1.5 L21.4 5 L25 5.2 L22.2 7.4 L23.2 11 L20 9 L16.8 11 L17.8 7.4 L15 5.2 L18.6 5 Z" fill="#ffd84a" stroke="#c99a1a" stroke-width="1"/></svg>',
  },
};

// Ready for more: Summer, Winter and holiday themes each add one entry here + a soundscape.
export const THEMES: Record<ThemeId, Theme> = { spring, halloween, fall, christmas };
export const THEME_ORDER: ThemeId[] = ['spring', 'fall', 'halloween', 'christmas'];

export const themeEvents = new Phaser.Events.EventEmitter();
export let theme: Theme = THEMES[normTheme(save.theme)] ?? spring;

/** Switch theme live. Accepts the legacy id 'classic' (now Spring). */
export function setTheme(raw: ThemeId | 'classic') {
  const id = normTheme(raw);
  if (theme.id === id) return;
  theme = THEMES[id];
  save.theme = id;
  persist();
  themeEvents.emit('change', theme);
}
