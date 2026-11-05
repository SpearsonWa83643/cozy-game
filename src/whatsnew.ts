// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-05-bubbles-84';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Bubble wand! By the village path, tap the wand to blow shiny soap bubbles. Tap a bubble or walk into it — pop!' },
  { icon: 'berry', text: 'Pond frogs! Cute frogs sit on lily pads in the glade pond. Tap one: hop, croak, splash!' },
  { icon: 'heart', text: 'Sky View! When you ride a flying friend, tap the wing button. Soar high over the island with your friend.' },
  { icon: 'fruit', text: 'Crunchy leaf piles in Fall! Walk right through a leaf pile. Crunch! The leaves fly up, then they pile up again.' },
];
