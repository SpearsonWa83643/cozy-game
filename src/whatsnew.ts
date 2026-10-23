// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-24-smooth1';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Holiday decorations run smoother! Things far away rest until you walk near them, so the island stays nice and quick.' },
  { icon: 'heart', text: 'Your village friends notice the decorations! Change the season and watch them hop and cheer. Sometimes they say nice things about the houses too.' },
  { icon: 'star', text: 'Rainy days change with the season! Snow in Winter, falling leaves in Fall, spooky mist at Halloween, and a sunny rainbow after Summer showers.' },
  { icon: 'berry', text: 'Spring dresses up too! Look for blossom garlands and little flower boxes on the village houses.' },
  { icon: 'heart', text: 'The village dresses up for every season! Look for bunting in Summer, pumpkins in Fall, lanterns at Halloween, wreaths and lights at Christmas, and icicles in Winter.' },
];
