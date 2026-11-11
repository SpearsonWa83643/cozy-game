// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-11-polish-107-110';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'berry', text: 'Orchard hedgehogs! Tap one and it curls into a spiky ball and rolls.' },
  { icon: 'star', text: 'Windmill mice! Little mice play by the windmill. Tap one — squeak, hop!' },
  { icon: 'fruit', text: 'River beaver! Find the beaver by the river. Tap it for a big tail SPLASH.' },
  { icon: 'heart', text: 'Forest fawns! Baby deer by the forest path. Tap one and it leaps for joy.' },
];
