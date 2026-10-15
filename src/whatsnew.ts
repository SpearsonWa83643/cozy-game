// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-15-mounts';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Ride a bald eagle! Tap Call Mount.' },
  { icon: 'wood', text: 'Tap trees to chop wood! They turn into stumps, then grass.' },
  { icon: 'fruit', text: 'Fruit trees can run out. Wait, and new fruit grows back!' },
  { icon: 'heart', text: 'A new welcome screen. Type your name and birthday!' },
];
