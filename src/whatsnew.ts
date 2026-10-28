// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-28-dandelions';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Fluffy dandelions grow in the meadow! Tap one to blow its seeds away on the breeze. They grow back after a while.' },
  { icon: 'heart', text: 'Tap your hero! They do a happy hop, a twirl, or a hop with hearts. Tap again for the next one! Stand still for a bit and they hum a happy tune.' },
  { icon: 'heart', text: 'A sleepy kitty naps by the fireplace! Tap it for a purr. Tap the cookie jar in the kitchen and the tool board in the workshop too!' },
  { icon: 'star', text: 'The six newest flying friends leave their own trails: cookie crumbs, chili sparks, carpet glitter, duck bubbles and more. They wiggle while they wait for you, too!' },
  { icon: 'heart', text: 'Poke things inside the rooms! Tap the fireplace, the kettle, the cuckoo clock, the lantern and the fishing net. Each one has a cute reaction and a sound.' },
];
