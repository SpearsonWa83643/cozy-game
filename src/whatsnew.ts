// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-03-friends-79';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Thief chase is trickier! Every time your net lands, the thief zooms a little faster. Can you still catch it?' },
  { icon: 'heart', text: 'Easier to find a hidden friend! The clue now says where to go, like "the stepping stones in Mistbirch Wood", and a pink heart shows the spot on the map.' },
  { icon: 'heart', text: 'Help! Over here! If the sneaky thief hid a friend in a cell, your friend now calls out and wiggles when you come close. Follow the call to find it!' },
  { icon: 'fruit', text: 'Surprise counting! After you finish a 1 2 3 board, play again to count shells, stars, strawberries and little fish. Something new every time!' },
  { icon: 'star', text: 'New words to spell! After you finish a Letter Easel, play again to spell FOX, EGG, BUG, CAR, OWL and PIE. Look at the picture and tap the big letters.' },
];
