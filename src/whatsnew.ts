// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-03-polish-75';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'New words to spell! After you finish a Letter Easel, play again to spell FOX, EGG, BUG, CAR, OWL and PIE. Look at the picture and tap the big letters.' },
  { icon: 'star', text: 'Thief Chase is even more fun! Every bubble net that lands sends a sparkly star up to the Catch! meter. When you need just one more, its ring glows. And if the game closes in the middle of a chase, your friend waits safely in a cell for you to rescue.' },
  { icon: 'heart', text: 'The world is alive! Friends and bunnies walk the trails, butterflies flutter, clouds float by, waves roll up the sand at Seashell Bay, fireflies glow in Glowcap Grove and the lighthouse shines in the evening. Tap a walker to say hi!' },
  { icon: 'fruit', text: 'Counting boards! Find the 1 2 3 boards in Glowcap Grove and Pinecone Hills. Count the apples or stones, then tap the big number for 2 + 3 or 5 - 1. Tap an apple to count it. Get 3 right to find a treasure chest!' },
  { icon: 'star', text: 'Letter easels! Find the ABC easels in Sunflower Meadow and by Seashell Bay. Look at the picture and tap the big letters to spell CAT, SUN, DOG and more. Spell 3 words to find a treasure chest!' },
];
