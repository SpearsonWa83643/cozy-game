// "What's new" note shown once on load after each release.
// To ship a new note: bump VERSION and replace the bullets. Leave ITEMS empty for no note.
// Keep each bullet short and simple: kids read these.
// icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart' (a little picture beside the line).

export const VERSION = '2026-10-25-room-taps';

export type WhatsNewItem = { icon: 'wood' | 'fruit' | 'berry' | 'star' | 'heart'; text: string };

export const ITEMS: WhatsNewItem[] = [
  { icon: 'heart', text: 'Poke things inside the rooms! Tap the fireplace, the kettle, the cuckoo clock, the lantern and the fishing net. Each one has a cute reaction and a sound.' },
  { icon: 'heart', text: 'Every room has its own look now! A cozy living room with a crackling fireplace, a bright kitchen with steam and hanging pots, a rustic workshop with sawdust, and a lakeside fishing hut with the water outside the window!' },
  { icon: 'star', text: 'The garden is outside now! Step through the gate into blue sky, flower beds, trees and butterflies. Listen for the birds!' },
  { icon: 'star', text: 'Pinch to zoom keeps your hero right in the middle now! Zoom in and out and let go. The view stays smooth, with no more jumping!' },
  { icon: 'heart', text: 'Six new flying friends to ride! A cowboy cookie, a chili in a poncho, a magic carpet, a rubber duck, a sky jellyfish and a strawberry. Look for the sneaky creature carrying a tiny lunchbox in the Wild Woods, and give it a bop!' },
  { icon: 'wood', text: 'The workshop has real tools now! Tap the tool wall, then use the wrench, hammer, screwdriver, saw or paintbrush to fix, nail, open, cut and paint. Each one makes something new for your room!' },
];
