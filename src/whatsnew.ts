// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-23-travel';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Fly anywhere! While riding your mount, tap Home, Village, Pond and more to zoom straight there.' },
  { icon: 'heart', text: 'Each time you come back, you start somewhere new in the glade. Where will you pop up?' },
  { icon: 'star', text: 'New look button! Tap the round button at the top to pick Spring, Fall, Halloween or Christmas.' },
  { icon: 'heart', text: 'Pinch to zoom in and out, or tap the big + and - buttons.' },
];
