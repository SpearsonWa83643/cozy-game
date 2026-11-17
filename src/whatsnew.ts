// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-17-polish-135-138';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'A peacock! It walks by the orchard path. Tap it — its big tail opens wide!' },
  { icon: 'berry', text: 'Quail! They scurry by the Sunflower Meadow path. Tap one — chi-ca-go!' },
  { icon: 'heart', text: 'Baby chicks! They hop by the path to the hills. Tap one — peep peep!' },
  { icon: 'fruit', text: 'A porcupine! It waddles by the river path. Tap it — its soft quills puff out!' },
];
