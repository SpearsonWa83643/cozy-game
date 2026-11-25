// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-25-polish-171-174';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'A baby alligator by the river! Tap it — a big CHOMP yawn!' },
  { icon: 'wood', text: 'A baby camel on the hills! Tap it — wiggle wiggle go its humps!' },
  { icon: 'fruit', text: 'A rainbow parrot in the orchard! Tap it — it says hel-lo!' },
  { icon: 'star', text: 'A husky puppy! It comes out when it snows. Tap it — awoo!' },
];
