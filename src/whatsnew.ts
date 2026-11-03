// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-02-thief-crew-clues';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'More sneaky thieves! Watch for the Squirrel, Hedgehog, Otter, Skunk, Possum, Badger and Duckling, each in its own colorful mask with its own silly giggles!' },
  { icon: 'star', text: 'Big, easy clues! Tap a missing friend and a big card tells you where it is. It stays until you tap OK.' },
  { icon: 'star', text: 'Sneaky thieves now carry your flying friends away on their backs, and sometimes take two or three! Find each friend waiting in a little cell by a puzzle. Solve the puzzle, tap the cell, and your friend hops home!' },
  { icon: 'heart', text: 'Meet the Sushi Roll Buddy! Find the Tiny Chopsticks in a lunchbox in the Wild Woods, then call Mount to fly on a happy sushi roll with a cape!' },
  { icon: 'star', text: 'Looks & Moves! Open the Stable and tap Looks & Moves. Use the big arrows to pick how your flying friends look, and how they fly with their own music. Rain, wind and snow pick a matching flight unless you choose one!' },
];
