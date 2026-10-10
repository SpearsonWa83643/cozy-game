// Shared world layout (world units). Art and gameplay both read from here.
export const WORLD_W = 2000;
export const WORLD_H = 1500;

export const PLAYER_START = { x: 905, y: 1330 };

export const POND = { x: 1310, y: 870, rx: 245, ry: 150 };

export const COTTAGE = { x: 470, y: 600 }; // bottom-centre of the cottage art
export const GARDEN = { x: 175, y: 560, w: 150, h: 110 };

// North hedge line with a single gap where the bramble gate sits.
export const WALL_Y = 330;
export const GATE = { x: 1000, y: 352, gapHalf: 62 };
export const SHRINE = { x: 1000, y: 175, r: 95 };
export const SHRINE_CLEARING = { x0: 720, x1: 1280 };

export const SIGN = { x: 905, y: 430 };

export type LanternId = 'dawn' | 'noon' | 'dusk';
export const LANTERNS: { id: LanternId; x: number; y: number }[] = [
  { id: 'noon', x: 640, y: 845 },
  { id: 'dusk', x: 1010, y: 1175 },
  { id: 'dawn', x: 1660, y: 590 },
];
export const LANTERN_ORDER: LanternId[] = ['dawn', 'noon', 'dusk'];

// Centre line of the dirt paths (Catmull-Rom control points).
export const PATH_MAIN: [number, number][] = [
  [915, 1560], [895, 1380], [935, 1200], [905, 1020], [860, 900], [760, 790], [610, 700], [500, 640], [470, 610],
];
export const PATH_NORTH: [number, number][] = [
  [860, 900], [930, 760], [990, 600], [1000, 460], [1000, 330], [1000, 230], [1000, 175],
];
export const PATH_EAST: [number, number][] = [
  [990, 600], [1180, 580], [1400, 560], [1600, 600], [1660, 610],
];
export const PATH_SOUTH: [number, number][] = [
  [935, 1200], [985, 1190], [1010, 1190],
];
