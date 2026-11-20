// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-20-polish-147-150';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'A baby elephant! It lives by the meadow path. Tap it — toot toot, splish!' },
  { icon: 'heart', text: 'A giraffe! It stands tall by the hills path. Tap it — it bends down to say hi!' },
  { icon: 'wood', text: 'Meerkats! Two live by the bay path. Tap one — it pops up to look around!' },
  { icon: 'berry', text: 'A moose in a scarf! It comes out by the forest path when it snows. Tap it — a big friendly hello!' },
];
