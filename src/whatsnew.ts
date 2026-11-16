// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-16-polish-127-130';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Dolphins! They swim out in Seashell Bay. Tap one — a big leap and a splash!' },
  { icon: 'heart', text: 'A donkey! It stands by the Fairy Grove path. Tap it — hee-haw and a happy kick!' },
  { icon: 'berry', text: 'Tortoises! They walk slowly by the bay path. Tap one — it hides, then peeks out to smile.' },
  { icon: 'fruit', text: 'Caterpillars! They sit on leaves by the path from the hills to the bay. Tap one — wiggle, giggle, rainbow sparkles!' },
];
