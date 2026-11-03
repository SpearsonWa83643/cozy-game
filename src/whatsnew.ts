// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-03-polish-77';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Help! Over here! If the sneaky thief hid a friend in a cell, your friend now calls out and wiggles when you come close. Follow the call to find it!' },
  { icon: 'fruit', text: 'Surprise counting! After you finish a 1 2 3 board, play again to count shells, stars, strawberries and little fish. Something new every time!' },
  { icon: 'star', text: 'New words to spell! After you finish a Letter Easel, play again to spell FOX, EGG, BUG, CAR, OWL and PIE. Look at the picture and tap the big letters.' },
  { icon: 'star', text: 'Thief Chase is even more fun! Every bubble net that lands sends a sparkly star up to the Catch! meter. When you need just one more, its ring glows. And if the game closes in the middle of a chase, your friend waits safely in a cell for you to rescue.' },
  { icon: 'heart', text: 'The world is alive! Friends and bunnies walk the trails, butterflies flutter, clouds float by, waves roll up the sand at Seashell Bay, fireflies glow in Glowcap Grove and the lighthouse shines in the evening. Tap a walker to say hi!' },
];
