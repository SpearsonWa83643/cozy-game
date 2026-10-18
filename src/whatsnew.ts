// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-18-berries';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'berry', text: 'Berry bushes! Tap one by your house to pick berries. They grow back.' },
  { icon: 'fruit', text: 'Feed your village friends! Pick fruit, then tap a hungry friend.' },
  { icon: 'heart', text: 'Fruit fills them right up and makes them a little happier.' },
];
