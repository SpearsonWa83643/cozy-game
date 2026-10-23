// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-23-spring1';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'berry', text: 'Spring dresses up too! Look for blossom garlands and little flower boxes on the village houses.' },
  { icon: 'heart', text: 'The village dresses up for every season! Look for bunting in Summer, pumpkins in Fall, lanterns at Halloween, wreaths and lights at Christmas, and icicles in Winter.' },
  { icon: 'star', text: 'Ice fishing! In Winter the pond and lake freeze over. Tap the ice to chip a little hole, then fish through it. The boats are tucked away until spring.' },
  { icon: 'heart', text: 'A new Summer theme! Tap the sun to make the glade bright and sunny. Tap the sunflowers to dance, bounce a beach ball, and ride the pink Flamingo!' },
  { icon: 'star', text: 'A new Winter theme! Tap the snowflake to make the whole glade snowy and quiet. Tap the snowball piles to go poof, say hi to the snowmen and ride the fluffy Snowy Owl!' },
];
