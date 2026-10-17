// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-17-spring';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Spring is here! Blossoms, birdsong and fresh green trees.' },
  { icon: 'star', text: 'The Call Mount button now shows the right ride after you switch themes.' },
];
