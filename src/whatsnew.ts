// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-03-fly-map';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Fly anywhere! Ride your flying friend and tap the big Fly! map. Tap a picture (the village, the Stable, the Thief Jail, a puzzle) and whoosh, off you go! Visit the new red barn and the Thief Jail too.' },
  { icon: 'star', text: 'The world is 4 times bigger! Walk past the village to find Sunflower Meadow, Pinecone Hills, the glowing Glowcap Grove and Seashell Bay with its lighthouse. Open the Map to see it all!' },
  { icon: 'wood', text: 'The Village Board! Your food, wood, stone, fruit and berries, who needs a home, and the seasons are on a painted board by the village. Look for the red ! and tap the board to see it. The lantern signs only show near the lanterns now.' },
  { icon: 'star', text: 'Shh... listen! Before a thief comes, the bushes rustle, leaves fly, and little eyes peek out. Then it pops out and tiptoes by. Catch it!' },
  { icon: 'star', text: 'Chase the thief! When a sneaky thief runs off with a friend, tap Chase it!, pick a friend to fly, and slide your finger to steer. Bubble nets fly all by themselves. Catch the thief to bring your friend home!' },
];
