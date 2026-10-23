// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-23-interiors1';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Step inside your Home! Tap your house in the village, then Go inside! Tap things to play: the lamp, the bed, the plant. Tap Decorate to add, move and bin furniture.' },
  { icon: 'star', text: 'A stable for your mounts! Open the menu and tap Stable. Tap or stroke a friend to pet it and watch the hearts fly, then tap Ride! to fly off on it. Tap a dark one for a hint about how to find it.' },
  { icon: 'fruit', text: 'A fish tank! Open the menu and tap Fish. Every fish you catch swims in your tank. Tap one to say hi!' },
  { icon: 'heart', text: 'A treasure cabinet! Open the menu and tap Treasures. Your finds shine under glass. Tap a dark one for a hint about where to look.' },
];
