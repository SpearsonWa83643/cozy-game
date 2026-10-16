// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-16-halloween-polish';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Halloween is here! Tap pumpkins, bats and jack-o\'-lanterns.' },
  { icon: 'heart', text: 'Halloween has its own music: music box, soft wind and sleepy owls.' },
  { icon: 'wood', text: 'Spooky trees now stand firmly on the ground.' },
  { icon: 'star', text: 'New mounts to find: Unicorn, Bumblebee, Snail, Teacup and Airplane!' },
];
