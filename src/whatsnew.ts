// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-01-thief';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Watch out for the Mount Thief! Tap the mask button and a sneaky masked critter runs in. Tap it 3 times to catch it, or it hides one of your flying friends behind a puzzle for you to rescue!' },
  { icon: 'star', text: 'Your stable shows every season friend now! Ride the Reindeer, Goose, Owl, Flamingo or Pumpkin and the whole glade turns to its season!' },
  { icon: 'heart', text: 'Super capes! Friends without real wings, like the Cowboy Cookie and the Tamale, now fly with a flowing cape. Birds keep their wings!' },
  { icon: 'heart', text: 'Three new flying friends! A Tamale, a shiny golden H-E-Buddy and a pink Chef Concha. Bop critters in the Wild Woods to find their lunchboxes!' },
  { icon: 'star', text: 'Pinwheels! Colorful pinwheels by the paths spin in the breeze. Tap one or walk past to make it whirl!' },
];
