// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-27-polish-187-190';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'A smiley quokka! Tap it — the biggest smile ever!' },
  { icon: 'berry', text: 'A pink axolotl in the lake! Tap it — it waves hello!' },
  { icon: 'wood', text: 'A fluffy baby anteater! Tap it — sniff, sniff... achoo!' },
  { icon: 'star', text: 'A lynx kitten in a Christmas hat! It comes out when it snows. Tap it — pounce!' },
];
