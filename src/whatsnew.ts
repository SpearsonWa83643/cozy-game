// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-09-polish-99-102';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Meadow ladybugs! Tap a ladybug in Sunflower Meadow and it flies a loop, then lands again.' },
  { icon: 'berry', text: 'Glowcap snails! Glowing snails in Glowcap Grove. Tap one and it hides in its shell, then peeks out.' },
  { icon: 'heart', text: 'Village hens! Hens peck by the village. Tap one — cluck! — and it flaps and hops.' },
  { icon: 'fruit', text: 'Bay turtles! Little sea turtles in Seashell Bay. Tap one and it swims a happy lap.' },
];
