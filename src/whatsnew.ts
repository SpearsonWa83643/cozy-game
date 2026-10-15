// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-15-cloud-puppy';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Ride a Cloud Puppy! Find its tuft in the Wild Woods.' },
  { icon: 'star', text: 'Find a Pterodactyl Egg in the Wild Woods!' },
  { icon: 'star', text: 'Pick your mount! Tap Call Mount.' },
  { icon: 'heart', text: 'Ride a bald eagle! Tap Call Mount.' },
];
