// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-19-polish-143-146';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'A koala! It hugs a little tree by the bay path. Tap it — a big sleepy hug!' },
  { icon: 'wood', text: 'A sloth! It hangs from a branch by the Fairy Grove path. Tap it — it waves hello!' },
  { icon: 'fruit', text: 'A capybara! It rests by the lake with an orange on its head. Tap it — boing!' },
  { icon: 'star', text: 'A walrus! It comes out by the bay when it snows. Tap it — honk honk, wiggle!' },
];
