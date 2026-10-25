// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-24-buildtray';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'wood', text: 'Building is easier to see! The whole village zooms out and the build choices live in a thin little bar at the bottom. Tap the arrow to tuck it away!' },
  { icon: 'star', text: 'Pinch to zoom keeps your hero right in the middle now! Zoom in and out and let go. The view stays smooth, with no more jumping!' },
  { icon: 'star', text: 'Can\'t find the lunchbox creature? After a little while in the Wild Woods, a tiny lunchbox bubble at the edge of the screen points the way!' },
  { icon: 'heart', text: 'Six new flying friends to ride! A cowboy cookie, a chili in a poncho, a magic carpet, a rubber duck, a sky jellyfish and a strawberry. Look for the sneaky creature carrying a tiny lunchbox in the Wild Woods, and give it a bop!' },
  { icon: 'wood', text: 'The workshop has real tools now! Tap the tool wall, then use the wrench, hammer, screwdriver, saw or paintbrush to fix, nail, open, cut and paint. Each one makes something new for your room!' },
];
