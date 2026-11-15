// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-15-polish-123-126';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Raccoon kits! They play by the river path. Tap one — peekaboo!' },
  { icon: 'berry', text: 'Seal pups! They swim in Seashell Bay. Tap one — clap, clap, arf!' },
  { icon: 'heart', text: 'Calves! Spotted calves graze by the hills path. Tap one — moo and a happy hop!' },
  { icon: 'fruit', text: 'Hummingbirds! They zip by the cottage garden. Tap one — zoom, hum!' },
];
