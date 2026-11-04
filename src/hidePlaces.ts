// 78 (Walker, Nov 3): "the stones" was too easy to mix up with the counting boards (their pebbles and stones),
// so every hiding place is named with its puzzle AND its area: "the stepping stones in Mistbirch Wood".
import { POT_CHEST, BELL_SIGN, TILE_SIGN, DIG_SIGN, PSTONE_SIGN, TRACK_SIGN, PUZZLE_SITES, AREA_NAMES } from './layout';
import { areaAt } from './geo';

/** The puzzle part of each hiding place's name (kid-readable). */
export const HIDE_BASE: Record<string, string> = {
  pots: 'the flower pots', bells: 'the singing bells', tiles: 'the turning tiles',
  dig: 'the digging spot', stones: 'the stepping stones', trail: 'the deer tracks',
  spell1: 'the letter easel', spell2: 'the letter easel',
  num1: 'the counting board', num2: 'the counting board',
};

/** Where each hiding place's puzzle is in the world (its sign or board). */
export function hideSpot(pid: string): { x: number; y: number } | null {
  const fixed: Record<string, { x: number; y: number }> = { pots: POT_CHEST, bells: BELL_SIGN, tiles: TILE_SIGN, dig: DIG_SIGN, stones: PSTONE_SIGN, trail: TRACK_SIGN };
  if (fixed[pid]) return fixed[pid];
  const s = PUZZLE_SITES.find((p) => p.id === pid);
  return s ? { x: s.x, y: s.y } : null;
}
/** The area a hiding place is in ("Mistbirch Wood"). */
export function hideArea(pid: string) {
  const p = hideSpot(pid);
  return p ? AREA_NAMES[areaAt(p.x, p.y)] : '';
}
/** Full name: "the stepping stones in Mistbirch Wood". */
export function hidePlace(pid: string) {
  const base = HIDE_BASE[pid];
  if (!base) return 'a puzzle';
  const a = hideArea(pid);
  return a ? `${base} in ${a}` : base;
}
