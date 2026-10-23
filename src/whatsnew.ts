// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-23-treasures';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'A treasure cabinet! Open the menu and tap Treasures. Your finds shine under glass. Tap a dark one for a hint about where to look.' },
  { icon: 'berry', text: 'A real paper map! Open the menu and tap Map to see your world on an old map with pins. Tap a pin to learn about that place.' },
  { icon: 'star', text: 'A brand-new wardrobe! Open the menu and tap Wardrobe. Drag a hat, scarf or outfit onto your hero to try it on, and watch them hop, wiggle and twirl! New finds glow, and the wardrobe dresses up for each season.' },
  { icon: 'fruit', text: 'Fish from your boat! Row out on the water, then tap your boat to cast a line. Each season paints the boat a new color.' },
];
