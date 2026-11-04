// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-04-crabs-78';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Little hermit crabs live on the Seashell Bay beach! Watch them scuttle sideways. Tap one and it waves hello. Walk too close and it hides in its shell!' },
  { icon: 'star', text: 'Thief chase is trickier! Every time your net lands, the thief zooms a little faster. Can you still catch it?' },
  { icon: 'heart', text: 'Easier to find a hidden friend! The clue now says where to go, like "the stepping stones in Mistbirch Wood", and a pink heart shows the spot on the map.' },
  { icon: 'heart', text: 'Help! Over here! If the sneaky thief hid a friend in a cell, your friend now calls out and wiggles when you come close. Follow the call to find it!' },
  { icon: 'fruit', text: 'Surprise counting! After you finish a 1 2 3 board, play again to count shells, stars, strawberries and little fish. Something new every time!' },
];
