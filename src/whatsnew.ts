// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-24-mounts1';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Six new flying friends to ride! A cowboy cookie, a chili in a poncho, a magic carpet, a rubber duck, a sky jellyfish and a strawberry. Look for the sneaky creature carrying a tiny lunchbox in the Wild Woods, and give it a bop!' },
  { icon: 'wood', text: 'The workshop has real tools now! Tap the tool wall, then use the wrench, hammer, screwdriver, saw or paintbrush to fix, nail, open, cut and paint. Each one makes something new for your room!' },
  { icon: 'star', text: 'Holiday decorations run smoother! Things far away rest until you walk near them, so the island stays nice and quick.' },
  { icon: 'heart', text: 'Your village friends notice the decorations! Change the season and watch them hop and cheer. Sometimes they say nice things about the houses too.' },
  { icon: 'star', text: 'Rainy days change with the season! Snow in Winter, falling leaves in Fall, spooky mist at Halloween, and a sunny rainbow after Summer showers.' },
];
