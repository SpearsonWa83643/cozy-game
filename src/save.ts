// Progress persistence (localStorage). Everything the player earns lives here.
export type HatId = 'straw' | 'none' | 'crown' | 'foxhood' | 'acorn';
export type ScarfId = 'red' | 'sunny' | 'petal' | 'silver' | 'moss' | 'none';
export type OutfitId = 'teal' | 'moss' | 'sea' | 'koi' | 'ranger';
export type BackId = 'none' | 'backpack' | 'staff';
export type Look = { hat: HatId; scarf: ScarfId; outfit: OutfitId; back: BackId; feather: boolean; shells: boolean };

/** Seasonal + holiday themes. 'classic' was the original look; it became Spring (old saves migrate). */
export type ThemeId = 'spring' | 'halloween';
/** Read any stored theme id (incl. legacy 'classic') as a current ThemeId. */
export const normTheme = (t: unknown): ThemeId => (t === 'halloween' ? 'halloween' : 'spring');
export type Res = { food: number; wood: number; stone: number };
export type BuildingType = 'home' | 'garden' | 'kitchen' | 'workshop' | 'fishhut' | 'flowerbed' | 'lamp' | 'well' | 'bench' | 'statue';
export type BuildingSave = { id: number; type: BuildingType; gx: number; gy: number };
export type VillagerSave = { id: number; name: string; trait: string; kind: number; job: number | null; food: number; sleep: number; fun: number };
export type VillageSave = { res: Res; buildings: BuildingSave[]; villagers: VillagerSave[]; nextId: number; wanderer: number; events: number };

export type SaveData = {
  v: 2;
  theme: ThemeId;
  village: VillageSave;
  puzzles: Record<string, boolean>;
  treasures: string[];
  fish: Record<string, { n: number; best: number }>;
  minor: Record<string, number>;
  look: Look;
  visited: string[];
  chests: string[];
  /** Fruit in your basket, for feeding animals. */
  snacks: number;
  /** Mount you last picked yourself in the mount picker (kept over the theme's default). */
  mountPick?: string;
  /** One-time tips already shown. */
  tips: string[];
  /** Wilderness: trips taken, monsters poofed, rare finds banked at home. */
  wild: WildSave;
};
export type WildSave = { visits: number; poofs: number; loot: Record<string, number> };

const KEY = 'cozy.save.v2';
const OLD_KEYS = ['cozy.save.v1'];
export const DEFAULT_LOOK: Look = { hat: 'straw', scarf: 'red', outfit: 'teal', back: 'none', feather: false, shells: false };

export function freshVillage(): VillageSave {
  return { res: { food: 3, wood: 8, stone: 4 }, buildings: [], villagers: [], nextId: 1, wanderer: 0, events: 0 };
}

function fresh(): SaveData {
  return { v: 2, theme: 'spring', village: freshVillage(), puzzles: {}, treasures: [], fish: {}, minor: {}, look: { ...DEFAULT_LOOK }, visited: ['glade'], chests: [], snacks: 0, tips: [], wild: { visits: 0, poofs: 0, loot: {} } };
}

export const save: SaveData = (() => {
  try {
    let raw = localStorage.getItem(KEY);
    // Older saves (v1: exploration only) carry over; the village simply starts fresh beside them.
    for (const k of OLD_KEYS) if (!raw) raw = localStorage.getItem(k);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && (d.v === 1 || d.v === 2)) {
        const f = fresh();
        const v = { ...f.village, ...(d.village ?? {}) };
        v.res = { ...f.village.res, ...(v.res ?? {}) };
        return { ...f, ...d, v: 2, snacks: Math.max(0, Math.min(9, Number(d.snacks) || 0)), tips: Array.isArray(d.tips) ? d.tips : [], wild: { ...f.wild, ...(d.wild ?? {}), loot: { ...(d.wild?.loot ?? {}) } }, theme: normTheme(d.theme), village: v, look: { ...DEFAULT_LOOK, ...(d.look ?? {}) } };
      }
    }
  } catch { /* storage unavailable or corrupt */ }
  return fresh();
})();

let timer: number | null = null;
export function persist() {
  if (timer !== null) return;
  timer = window.setTimeout(() => {
    timer = null;
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
  }, 250);
}

export function resetSave() {
  const theme = save.theme;
  try { localStorage.removeItem(KEY); for (const k of OLD_KEYS) localStorage.removeItem(k); } catch { /* ignore */ }
  Object.assign(save, fresh(), { theme });
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

/** Show a tip only once per save. */
export function tipOnce(id: string) { if (save.tips.includes(id)) return false; save.tips.push(id); persist(); return true; }
export const hasTreasure = (id: string) => save.treasures.includes(id);
export function addTreasure(id: string) { if (!hasTreasure(id)) { save.treasures.push(id); persist(); } }
export function addMinor(id: string, n = 1) { save.minor[id] = (save.minor[id] ?? 0) + n; persist(); return save.minor[id]; }
export function setPuzzle(id: string) { save.puzzles[id] = true; persist(); }
export function visit(area: string) { if (!save.visited.includes(area)) { save.visited.push(area); persist(); return true; } return false; }
