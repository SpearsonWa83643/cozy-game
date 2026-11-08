// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-08-polish-95-98';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Village clothesline! Colorful laundry sways by the cottages. Tap it — whoosh, flutter, sparkles!' },
  { icon: 'heart', text: 'Pond ducks! Little ducks paddle on the pond. Tap one — quack! — and it paddles away, then comes back.' },
  { icon: 'fruit', text: 'Hills squirrels! Squirrels nibble in Pinecone Hills. Come close and they scamper off!' },
  { icon: 'berry', text: 'Bay minnows! A sparkly school of little fish in Seashell Bay. Tap them and they scatter, then swim back!' },
];
