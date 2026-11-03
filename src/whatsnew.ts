// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-02-apply';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Looks & Moves has a big Apply button! Try styles and moves with the arrows, then tap Apply to use them all over the game. And the Bunny thief has its long ears back!' },
  { icon: 'star', text: 'Jailbreak! Sometimes a sneaky thief digs a tunnel or picks the lock and runs out of the Thief Jail. Watch for it sneaking back, and catch it again!' },
  { icon: 'berry', text: 'The Thief Jail! Open the Stable and tap Thief Jail. Every thief you catch gets a cozy cell. Tap a thief to hear it talk, and share a berry!' },
  { icon: 'heart', text: 'More sneaky thieves! Watch for the Squirrel, Hedgehog, Otter, Skunk, Possum, Badger and Duckling, each in its own colorful mask with its own silly giggles!' },
  { icon: 'star', text: 'Big, easy clues! Tap a missing friend and a big card tells you where it is. It stays until you tap OK.' },
];
