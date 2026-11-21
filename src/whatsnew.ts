// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-21-polish-151-154';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'A hippo! It rests by the glade pond. Tap it — a giant yawn and a big smile!' },
  { icon: 'star', text: 'A zebra! It lives by the path to Seashell Bay. Tap it — a happy kick!' },
  { icon: 'fruit', text: 'A lemur! It sits near the orchard. Tap it — hop hop, twirly tail!' },
  { icon: 'berry', text: 'A polar bear cub in a Christmas hat! It comes out by the village when it snows. Tap it — roly-poly!' },
];
