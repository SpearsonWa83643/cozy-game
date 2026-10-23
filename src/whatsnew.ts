// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-23-rooms1';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'berry', text: 'Go inside the Garden shed and the Fishing Hut! Water the flower pots and pick the blooms, or tap the fishing hole to cast your line and catch a fish.' },
  { icon: 'wood', text: 'Build toys in the Workshop! Tap your Workshop, then Go inside! Tap the workbench, pick a toy boat, birdhouse, frog or horsey, then tap tap tap to hammer it. Uses your wood and stone.' },
  { icon: 'fruit', text: 'Cook in the Kitchen! Build a Kitchen, tap it, then Go inside! Tap the stove to make pancakes or eggs, and tap the coffee maker to brew a hot cup.' },
  { icon: 'heart', text: 'Step inside your Home! Tap your house in the village, then Go inside! Tap things to play: the lamp, the bed, the plant. Tap Decorate to add, move and bin furniture.' },
];
