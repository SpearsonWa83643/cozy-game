// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-07-polish-91-94';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Village wind chimes! Tap the chimes by the village path for a twinkly song and sparkles.' },
  { icon: 'berry', text: 'Puff mushrooms! Bouncy mushrooms by the Glowcap fairy ring. Tap one — squish, boing, puff!' },
  { icon: 'heart', text: 'Beach seagulls! Walk up to the gulls in Seashell Bay and they flap away, then glide back.' },
  { icon: 'fruit', text: 'Meadow bunnies! Soft bunnies nibble by the meadow path. Come close and they hop away!' },
];
