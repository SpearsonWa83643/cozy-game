// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-11-23-polish-159-162';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };
export const ITEMS: WhatsNewItem[] = [
  { icon: 'star', text: 'A baby rhino! It lives on the grassy hills. Tap it — stomp stomp, a happy snort!' },
  { icon: 'fruit', text: 'A toucan with a rainbow beak! It sits near Fairy Grove. Tap it — tok-tok!' },
  { icon: 'heart', text: 'A platypus! It plays by the river. Tap it — splash goes its tail!' },
  { icon: 'berry', text: 'Two red cardinals! They come out when it snows. Tap them — they hop and sing!' },
];
