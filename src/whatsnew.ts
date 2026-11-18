// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-18-polish-139-142';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Penguins! They come out by the lake when it snows. Tap one — wheee, a belly slide!' },
  { icon: 'wood', text: 'An armadillo! It lives by the Fairy Grove path. Tap it — it rolls into a ball!' },
  { icon: 'heart', text: 'A kangaroo! It hops by the hills path. Tap it — a baby peeks out to wave!' },
  { icon: 'berry', text: 'A panda! It munches bamboo by the orchard path. Tap it — roly-poly!' },
];
