// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-26-polish-179-186';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'wood', text: 'A baby bison with a leafy harvest necklace! Tap it — boing, boing, boing!' },
  { icon: 'star', text: 'A tiger cub in the grove! Tap it — peekaboo!' },
  { icon: 'berry', text: 'A fuzzy kiwi bird! Tap it — it finds a berry. Kee-wee!' },
  { icon: 'heart', text: 'A snow monkey in a warm pool! It comes out when it snows. Tap it — splash!' },
  { icon: 'star', text: 'A little chameleon on a twig! Tap it — rainbow colors!' },
  { icon: 'heart', text: 'A round guinea pig! Tap it — hop hop, wheek wheek!' },
  { icon: 'berry', text: 'A pufferfish in the bay! Tap it — it puffs up big and round!' },
  { icon: 'wood', text: 'A pika in a green scarf! It comes out when it snows. Tap it — eep!' },
];
