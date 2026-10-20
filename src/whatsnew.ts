// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-20-lunchbox';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Look for the glowing lunchbox in the Wild Woods: it always has a new mount!' },
  { icon: 'star', text: 'Fall is here! Crunchy leaf piles, hay bales and a Canada goose ride.' },
  { icon: 'star', text: 'Move your buildings! In build mode, tap a building, then tap a new spot.' },
  { icon: 'wood', text: 'Tap a building and pick Remove. You get all your wood and stone back.' },
];
