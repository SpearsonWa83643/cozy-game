// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-22-polish-155-158';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Music stones! Five rainbow stones in the glade. Tap them to play notes. Tap all five colors for a song!' },
  { icon: 'heart', text: 'A hot-air balloon! Sometimes it floats by in the sky. Tap it — whoosh! The bunny waves hi!' },
  { icon: 'berry', text: 'A skunk with a flower! It lives by the lake shore. Tap it — a puff of flower petals (no stink!)' },
  { icon: 'wood', text: 'An arctic fox! It comes out when it snows. Tap it — it dives nose-first into the snow!' },
];
