// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-29-snow-angels';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Snow angels! In the snowy Winter and Christmas looks, tap your hero to lie back and make a snow angel.' },
  { icon: 'star', text: 'In the snowy Winter and Christmas looks, your hero leaves little footprints in the snow. They slowly fade away.' },
  { icon: 'star', text: 'Fluffy dandelions grow in the meadow! Tap one to blow its seeds away on the breeze. They grow back after a while.' },
  { icon: 'heart', text: 'Tap your hero! They do a happy hop, a twirl, or a hop with hearts. Tap again for the next one! Stand still for a bit and they hum a happy tune.' },
  { icon: 'heart', text: 'A sleepy kitty naps by the fireplace! Tap it for a purr. Tap the cookie jar in the kitchen and the tool board in the workshop too!' },
];
