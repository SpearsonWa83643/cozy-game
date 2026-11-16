// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-16-polish-131-134';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Lambs! Little lambs play by the path to the hills. Tap one — baa and boing!' },
  { icon: 'berry', text: 'Geckos! They sit on warm rocks by the south shore path. Tap one — blep! It changes color.' },
  { icon: 'star', text: 'A llama! It stands by the path from the hills to the bay. Tap it — hmm-hmm, a happy hum.' },
  { icon: 'fruit', text: 'A turkey! It walks by the forest path, near the river bridge. Tap it — gobble gobble, big tail!' },
];
