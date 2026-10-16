// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-16-pumpkin-carriage';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Halloween ride: Call Mount brings the Pumpkin carriage!' },
  { icon: 'heart', text: 'Halloween has its own music: music box, soft wind and sleepy owls.' },
  { icon: 'wood', text: 'Fixed: no more tiny trees floating in the wind.' },
  { icon: 'star', text: 'New mounts to find: Unicorn, Bumblebee, Snail, Teacup and Airplane!' },
];
