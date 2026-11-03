// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-02-sushi';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Meet the Sushi Roll Buddy! Find the Tiny Chopsticks in a lunchbox in the Wild Woods, then call Mount to fly on a happy sushi roll with a cape!' },
  { icon: 'star', text: 'Looks & Moves! Open the Stable and tap Looks & Moves. Use the big arrows to pick how your flying friends look, and how they fly with their own music. Rain, wind and snow pick a matching flight unless you choose one!' },
  { icon: 'heart', text: 'Loop-de-loops! Tap your flying friend for a whoosh and it does a happy loop. When you hop off, it waves bye bye with hearts. And sneaky thieves giggle when you tap them!' },
  { icon: 'star', text: 'Watch out for the Mount Thief! Tap the mask button and a sneaky masked critter runs in. Tap it 3 times to catch it and get thank-you berries, or it dashes off leaving little paw prints and hides one of your flying friends behind a puzzle for you to rescue!' },
  { icon: 'star', text: 'Your stable shows every season friend now! Ride the Reindeer, Goose, Owl, Flamingo or Pumpkin and the whole glade turns to its season!' },
];
