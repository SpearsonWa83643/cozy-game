// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-16-mounts-wave3';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Ride a rainbow Unicorn! Find its horseshoe in the Wild Woods.' },
  { icon: 'star', text: 'Ride a buzzy Bumblebee! Find its honeycomb in the Wild Woods.' },
  { icon: 'star', text: 'More mounts: Lantern Snail, Flying Teacup, Toy Airplane and a Pumpkin!' },
  { icon: 'heart', text: 'Friends who need care now glow brighter.' },
];
