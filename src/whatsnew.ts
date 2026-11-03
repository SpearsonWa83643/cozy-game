// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-03-thief-hints';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Shh... listen! Before a thief comes, the bushes rustle, leaves fly, and little eyes peek out. Then it pops out and tiptoes by. Catch it!' },
  { icon: 'star', text: 'Chase the thief! When a sneaky thief runs off with a friend, tap Chase it!, pick a friend to fly, and slide your finger to steer. Bubble nets fly all by themselves. Catch the thief to bring your friend home!' },
  { icon: 'heart', text: 'Looks & Moves has a big Apply button! Try styles and moves with the arrows, then tap Apply to use them all over the game. And the Bunny thief has its long ears back!' },
  { icon: 'star', text: 'Jailbreak! Sometimes a sneaky thief digs a tunnel or picks the lock and runs out of the Thief Jail. Watch for it sneaking back, and catch it again!' },
  { icon: 'berry', text: 'The Thief Jail! Open the Stable and tap Thief Jail. Every thief you catch gets a cozy cell. Tap a thief to hear it talk, and share a berry!' },
];
