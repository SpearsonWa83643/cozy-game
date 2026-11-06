// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-06-polish-87-90';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Glowcap fireflies! Soft glowing bugs drift in Glowcap Grove. Tap one — flash, chime, sparkles!' },
  { icon: 'fruit', text: 'Village birdbath! Little birds splash and chirp when you come close or tap the bath.' },
  { icon: 'wood', text: 'Pinecone tumble! Tap a pinecone on the hills — it rolls downhill with soft knocks, then grows back.' },
  { icon: 'berry', text: 'Meadow dragonflies! Colorful dragonflies zip over the sunflowers. Tap one for a loop-de-loop!' },
];
