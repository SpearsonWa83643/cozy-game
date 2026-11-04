// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-04-leafpiles-82';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'fruit', text: 'Crunchy leaf piles in Fall! Walk or tap through a leaf pile and the leaves fly up. Crunch! Then they pile up again.' },
  { icon: 'star', text: 'Count the starfish! Five starfish sleep by a tide pool in Seashell Bay. Tap each one: 1, 2, 3, 4, 5!' },
  { icon: 'star', text: 'Star rings in the sky! When you ride a flying friend, golden rings float ahead. Fly through all 5 for a big hooray!' },
  { icon: 'star', text: 'Little hermit crabs live on the Seashell Bay beach! Watch them scuttle sideways. Tap one and it waves hello. Walk too close and it hides in its shell!' },
  { icon: 'star', text: 'Thief chase is trickier! Every time your net lands, the thief zooms a little faster. Can you still catch it?' },
];
