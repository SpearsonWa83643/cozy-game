// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-14-polish-119-122';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Puffins! Little puffins live by the lighthouse. Tap one — flap, waddle!' },
  { icon: 'heart', text: 'Orchard puppies! Puppies play by the orchard path. Tap one — woof, spin!' },
  { icon: 'berry', text: 'Chipmunks! They hide by the lake path. Tap one — puffy cheeks and an acorn!' },
  { icon: 'fruit', text: 'A bear cub! It sits by the path from the hills to the bay. Tap it — it rolls over and giggles.' },
];
