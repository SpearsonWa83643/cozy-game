// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-05-petals-85';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'fruit', text: 'Petal swirl! In Spring and Summer, walk through the little flower patches. Soft petals dance up and drift away.' },
  { icon: 'star', text: 'Bubble wand! By the village path, tap the wand to blow shiny soap bubbles. Tap a bubble or walk into it — pop!' },
  { icon: 'berry', text: 'Pond frogs! Cute frogs sit on lily pads in the glade pond. Tap one: hop, croak, splash!' },
  { icon: 'heart', text: 'Sky View! When you ride a flying friend, tap the wing button. Soar high over the island with your friend.' },
];
