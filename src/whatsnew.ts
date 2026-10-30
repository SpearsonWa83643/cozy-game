// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-29-food-flyers';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Three new flying friends! A Tamale, a shiny golden H-E-Buddy and a pink Chef Concha. Bop critters in the Wild Woods to find their lunchboxes!' },
  { icon: 'star', text: 'Pinwheels! Colorful pinwheels by the paths spin in the breeze. Tap one or walk past to make it whirl!' },
  { icon: 'heart', text: 'Kites! On windy Fall days your hero flies a kite. Tap the kite to make it do a loop-de-loop!' },
  { icon: 'star', text: 'Puddles! On rainy days little puddles fill up by the paths. Walk through one for a big splash!' },
  { icon: 'heart', text: 'Snow angels! In the snowy Winter and Christmas looks, tap your hero to lie back and make a snow angel.' },
  { icon: 'star', text: 'In the snowy Winter and Christmas looks, your hero leaves little footprints in the snow. They slowly fade away.' },
];
