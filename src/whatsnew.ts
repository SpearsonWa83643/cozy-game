// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-13-polish-115-118';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'berry', text: 'Fox kits! Baby foxes play by the Fairy Grove path. Tap one — pounce, yip!' },
  { icon: 'heart', text: 'Hillside ponies! Little ponies graze on the way to the hills. Tap one for a happy neigh.' },
  { icon: 'star', text: 'Shore kittens! Kittens play with yarn by the south shore. Tap one — meow, pounce!' },
  { icon: 'fruit', text: 'Bay path robins! Robins hop by the Seashell Bay path. Tap one and it sings a song.' },
];
