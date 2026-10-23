// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-23-christmas';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'Christmas is here! Pick the Christmas theme for snow and twinkly lights.' },
  { icon: 'heart', text: 'Ride a flying reindeer! Tap the presents, the snowmen and the light-up trees.' },
  { icon: 'star', text: 'The Wild Woods get snowy too, with soft snowflakes falling.' },
  { icon: 'star', text: 'Steer your mount! Drag to fly where you want; let go and it keeps touring.' },
];
