// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-24-polish-163-166';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'A red panda! It lives by the woods. Tap it — it stands up tall: surprise!' },
  { icon: 'fruit', text: 'A pelican on the beach! Tap it — scoop, a fish, gulp!' },
  { icon: 'wood', text: 'A round wombat on the hills! Tap it — dig dig dig!' },
  { icon: 'star', text: 'A tiny white ermine! It hides in the snow. Tap it — pop! Peek-a-boo!' },
];
