// Shared world layout (world units). Art and gameplay both read from here.
export const WORLD_W = 4400;
export const WORLD_H = 3000;
/** The original glade occupies the top-left of the world. */
export const GLADE_W = 2000;
export const GLADE_H = 1500;

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

// ------------------------------------------------------------------ the wider world
export type AreaId = 'glade' | 'river' | 'forest' | 'orchard' | 'lake' | 'village';
export const AREA_NAMES: Record<AreaId, string> = {
  glade: 'Willowmere Glade', river: 'Brookside', forest: 'Mistbirch Wood', orchard: 'Windmill Orchard', lake: 'Shellwater Shore', village: 'Willow Village',
};

/** River centre line, north to south, flowing into the lake. */
export const RIVER_PTS: [number, number][] = [
  [2330, -80], [2310, 250], [2350, 640], [2300, 1050], [2330, 1420], [2290, 1720], [2150, 2000], [1900, 2230], [1640, 2390],
];
export const RIVER_HALF = 62;
export const LAKE = { x: 1050, y: 2480, rx: 700, ry: 330 };
/** Below the river mouth, the orchard / lake divide is a wooded ridge at this x. */
export const RIDGE_X = 1820;
export const FOREST_EDGE_Y = 1400;

export const BRIDGES = {
  north: { x: 2350, y: 640, half: 128, w: 26 },
  south: { x: 2290, y: 1720, half: 128, w: 26 },
};
export const BRIDGE_GATE = { x: 2210, y: 640 };
export const PIER = { x: 1250, y0: 2120, y1: 2300, w: 22 };

export const WINDMILL = { x: 3760, y: 1930 };
export const BELLS = [
  { x: 3560, y: 2120 }, { x: 3650, y: 2150 }, { x: 3740, y: 2160 }, { x: 3830, y: 2140 },
];
export const BELL_SIGN = { x: 3470, y: 2080 };
export const BELL_CHEST = { x: 3700, y: 2250 };
export const SONGBIRD = { x: 3880, y: 2040 };

export const TILES = { x: 3500, y: 700, size: 60 }; // 2x2 stone picture tiles (centre)
export const TILE_SIGN = { x: 3360, y: 780 };
export const TILE_CHEST = { x: 3500, y: 610 };
export const OWL = { x: 3240, y: 470 };

export const POTS = [{ x: 175, y: 760 }, { x: 220, y: 760 }, { x: 265, y: 760 }, { x: 310, y: 760 }];
export const POT_SIGN = { x: 120, y: 790 };
export const POT_CHEST = { x: 245, y: 830 };

export const TRAILHEAD = { x: 4080, y: 2720 }; // the way into the Wild Woods
export const DIG = { x: 560, y: 2100 };
export const DIG_SIGN = { x: 820, y: 1965 };
export const DIG_STONES: [number, number][] = [[520, 2070], [605, 2075], [560, 2140]];

export const PATH_RIVER_W: [number, number][] = [[1600, 600], [1660, 610], [1850, 640], [2050, 640], [2180, 640], [2228, 640]];
export const PATH_RIVERSIDE: [number, number][] = [[2110, 640], [2140, 900], [2160, 1200], [2150, 1500], [2140, 1720], [2172, 1720]];
export const PATH_FOREST: [number, number][] = [[2474, 640], [2650, 620], [2900, 700], [3150, 690], [3400, 720], [3500, 760], [3700, 820], [3950, 900]];
export const PATH_ORCHARD: [number, number][] = [[2412, 1720], [2650, 1770], [2950, 1860], [3250, 1900], [3500, 1990], [3680, 2040], [3760, 2010]];
export const PATH_ORCHARD_S: [number, number][] = [[3250, 1900], [3280, 2200], [3380, 2500], [3650, 2700], [4000, 2760]];
export const PATH_LAKE: [number, number][] = [[2140, 1720], [2000, 1850], [1750, 1950], [1500, 2030], [1250, 2090], [1000, 2020], [930, 1800], [915, 1560]];

/** The village meadow south of the glade: an 11x5 snap grid of 64-unit cells. */
export const VILLAGE = { x: 130, y: 1600, cols: 11, rows: 5, cell: 64 };
export const VILLAGE_SIGN = { x: 870, y: 1640 };
export const VILLAGE_ENTRY = { x: 880, y: 1760 };
export const MERCHANT_SPOT = { x: 860, y: 1880 };
export const START_AREAS: AreaId[] = ['glade'];
