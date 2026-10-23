// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-23-wardrobereact';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'A brand-new wardrobe! Open the menu and tap Wardrobe. Drag a hat, scarf or outfit onto your hero to try it on, and watch them hop, wiggle and twirl!' },
  { icon: 'fruit', text: 'Fish from your boat! Row out on the water, then tap your boat to cast a line. Each season paints the boat a new color.' },
  { icon: 'heart', text: 'Row, row, row your boat! Tap the little red boat at the pond or the lake to climb in. Tap the shore to hop out.' },
  { icon: 'star', text: 'Fly anywhere! While riding your mount, tap Home, Village, Pond and more to zoom straight there.' },
];
