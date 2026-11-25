// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-25-polish-171-178';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'A baby alligator by the river! Tap it — a big CHOMP yawn!' },
  { icon: 'wood', text: 'A baby camel on the hills! Tap it — wiggle wiggle go its humps!' },
  { icon: 'fruit', text: 'A rainbow parrot in the orchard! Tap it — it says hel-lo!' },
  { icon: 'star', text: 'A husky puppy! It comes out when it snows. Tap it — awoo!' },
  { icon: 'heart', text: 'A little seahorse in the bay! Tap it — twirl twirl!' },
  { icon: 'wood', text: 'A fluffy ostrich chick! Tap it — zoom, round and round!' },
  { icon: 'fruit', text: 'A baby gorilla in the grove! Tap it — bum-bum-bum!' },
  { icon: 'berry', text: 'A yak in a red sweater! It comes out when it snows. Tap it — shake shake, jingle!' },
];
