// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-10-polish-103-106';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Village goats! Two little goats play by the village. Tap one and it hops and kicks — meh-eh!' },
  { icon: 'star', text: 'Hills sheep! Fluffy sheep in Pinecone Hills. Tap one and it does a happy bounce.' },
  { icon: 'fruit', text: 'Lake otters! Otters float on Shellwater Lake. Tap one and it rolls over — splash!' },
  { icon: 'berry', text: 'Garden mole! Find the molehill by the cottage garden. Tap it and the mole pops up to say hi.' },
];
