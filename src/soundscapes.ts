// Per-theme soundscapes. Every theme names its own soundscape; the synth crossfades between
// them when the theme changes. A new theme (Spring, Fall, Christmas...) adds one entry here.

export type Chord = { bass: number; pad: number[]; mel: number[] };
/** An occasional ambient sound and how often it plays (seconds between, random in range). */
export type Extra = { kind: 'owl' | 'creak' | 'chimes' | 'birds' | 'cuckoo' | 'drops'; every: [number, number]; vol: number };
export type Soundscape = {
  id: string;
  chords: Chord[];
  /** Melody instrument: warm kalimba (Classic), twinkly music box / celesta (Halloween), airy flute (Spring). */
  lead: 'kalimba' | 'musicbox' | 'flute';
  /** Melody density multiplier (1 = the area's normal density). */
  dens: number;
  /** Pad level multiplier and low-pass brightness multiplier. */
  pad: number; bright: number;
  /** Continuous soft wind bed (0 = none). */
  wind: number;
  extras: Extra[];
};

/** Classic: the original F-major glade music (kept for reference / a future theme; Spring replaced it). */
export const CLASSIC: Soundscape = {
  id: 'classic', lead: 'kalimba', dens: 1, pad: 1, bright: 1, wind: 0, extras: [],
  chords: [
    { bass: 41, pad: [53, 57, 60, 64, 67], mel: [72, 74, 76, 79, 81, 84] },          // Fmaj9
    { bass: 38, pad: [50, 53, 57, 60, 64], mel: [72, 74, 77, 79, 81] },              // Dm9
    { bass: 46, pad: [50, 53, 57, 62, 64], mel: [74, 76, 77, 81, 82] },              // Bbmaj7(9)
    { bass: 36, pad: [48, 52, 55, 57, 62], mel: [72, 74, 76, 79, 84] },              // C6/9
    { bass: 45, pad: [52, 57, 60, 64, 67], mel: [72, 76, 79, 81, 84] },              // Am7
    { bass: 46, pad: [50, 53, 57, 60, 65], mel: [72, 74, 77, 81] },                  // Bbmaj9
    { bass: 43, pad: [50, 55, 58, 62, 65], mel: [74, 77, 79, 82] },                  // Gm9
    { bass: 36, pad: [48, 53, 55, 58, 62], mel: [72, 74, 77, 79] },                  // C9sus
  ],
};

/** Halloween: gentle D-minor music box, soft wind, far-off owls, friendly creaks and chimes. */
export const HALLOWEEN: Soundscape = {
  id: 'halloween', lead: 'musicbox', dens: 1.15, pad: 0.8, bright: 0.75, wind: 1,
  extras: [
    { kind: 'owl', every: [14, 28], vol: 0.5 },
    { kind: 'creak', every: [22, 40], vol: 0.45 },
    { kind: 'chimes', every: [18, 34], vol: 0.5 },
  ],
  chords: [
    { bass: 38, pad: [50, 53, 57, 64], mel: [74, 77, 81, 76, 69] },                 // Dm(add9)
    { bass: 46, pad: [50, 53, 58, 62], mel: [74, 77, 82, 81] },                     // Bb
    { bass: 43, pad: [50, 55, 58, 64], mel: [74, 76, 79, 82] },                     // Gm6
    { bass: 45, pad: [49, 52, 55, 57, 61], mel: [73, 76, 79, 81] },                 // A7
    { bass: 38, pad: [50, 53, 57, 60], mel: [72, 74, 77, 81] },                     // Dm7
    { bass: 44, pad: [48, 51, 56, 60], mel: [72, 75, 80, 79] },                     // Ab (a cheeky twist)
    { bass: 43, pad: [50, 55, 58, 62], mel: [74, 79, 82, 77] },                     // Gm
    { bass: 45, pad: [52, 55, 57, 61], mel: [76, 73, 79, 81] },                     // A7sus->A
  ],
};

/** Spring (replaces Classic): bright G-major, an airy little flute over soft pads, songbirds
 *  trilling, a far-off cuckoo and the odd fresh raindrop. Lighter and more open than Classic. */
export const SPRING: Soundscape = {
  id: 'spring', lead: 'flute', dens: 1.1, pad: 0.85, bright: 1.25, wind: 0.25,
  extras: [
    { kind: 'birds', every: [5, 12], vol: 0.6 },
    { kind: 'birds', every: [9, 20], vol: 0.4 },
    { kind: 'cuckoo', every: [26, 48], vol: 0.45 },
    { kind: 'drops', every: [16, 30], vol: 0.5 },
  ],
  chords: [
    { bass: 43, pad: [55, 59, 62, 66, 69], mel: [74, 76, 78, 79, 81, 83] },          // Gmaj9
    { bass: 40, pad: [52, 55, 59, 62, 66], mel: [74, 76, 79, 81, 83] },              // Em9
    { bass: 36, pad: [52, 55, 59, 62, 64], mel: [72, 74, 76, 79, 81] },              // Cmaj7(9)
    { bass: 38, pad: [50, 54, 57, 60, 64], mel: [74, 76, 78, 81] },                  // D9
    { bass: 47, pad: [54, 59, 62, 66], mel: [74, 78, 79, 83] },                      // Bm7
    { bass: 36, pad: [52, 55, 60, 64, 67], mel: [72, 76, 79, 84] },                  // C6/9
    { bass: 45, pad: [52, 57, 60, 64, 67], mel: [72, 76, 79, 81] },                  // Am9
    { bass: 38, pad: [50, 55, 57, 60, 66], mel: [74, 76, 78, 81] },                  // Dsus -> D
  ],
};
