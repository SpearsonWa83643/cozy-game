// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-02-chase';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Chase the thief! When a sneaky thief runs off with a friend, tap Chase it!, pick a friend to fly, and slide your finger to steer. Bubble nets fly all by themselves. Catch the thief to bring your friend home!' },
  { icon: 'star', text: 'Jailbreak! Sometimes a sneaky thief digs a tunnel or picks the lock and runs out of the Thief Jail. Watch for it sneaking back, and catch it again!' },
  { icon: 'berry', text: 'The Thief Jail! Open the Stable and tap Thief Jail. Every thief you catch gets a cozy cell. Tap a thief to hear it talk, and share a berry!' },
  { icon: 'heart', text: 'More sneaky thieves! Watch for the Squirrel, Hedgehog, Otter, Skunk, Possum, Badger and Duckling, each in its own colorful mask with its own silly giggles!' },
  { icon: 'star', text: 'Big, easy clues! Tap a missing friend and a big card tells you where it is. It stays until you tap OK.' },
  { icon: 'star', text: 'Sneaky thieves now carry your flying friends away on their backs, and sometimes take two or three! Find each friend waiting in a little cell by a puzzle. Solve the puzzle, tap the cell, and your friend hops home!' },
];
