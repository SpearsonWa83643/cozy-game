// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-12-polish-111-114';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Lake swans! Swans glide on Shellwater Lake. Tap one and it lifts its wings — honk!' },
  { icon: 'berry', text: 'Village piglets! Tap a piglet for an oink and a muddy happy wiggle.' },
  { icon: 'star', text: 'Meadow bumblebees! Fuzzy bees buzz over the meadow flowers. Tap one — loop-the-loop!' },
  { icon: 'fruit', text: 'River heron! A tall heron waits by the river. Tap it and it catches a little fish.' },
];
