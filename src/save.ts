// Progress persistence (localStorage). Everything the player earns lives here.
export type HatId = 'straw' | 'none' | 'crown' | 'foxhood' | 'acorn';
export type ScarfId = 'red' | 'sunny' | 'petal' | 'silver' | 'moss' | 'sky' | 'abc' | 'none';
export type OutfitId = 'teal' | 'moss' | 'sea' | 'koi' | 'ranger' | 'fawn';
export type BackId = 'none' | 'backpack' | 'staff';
export type Look = { hat: HatId; scarf: ScarfId; outfit: OutfitId; back: BackId; feather: boolean; shells: boolean };

/** Seasonal + holiday themes. 'classic' was the original look; it became Spring (old saves migrate). */
export type ThemeId = 'spring' | 'halloween' | 'fall' | 'christmas' | 'winter' | 'summer';
/** Read any stored theme id (incl. legacy 'classic') as a current ThemeId. */
export const normTheme = (t: unknown): ThemeId => (t === 'halloween' ? 'halloween' : t === 'fall' ? 'fall' : t === 'christmas' ? 'christmas' : t === 'winter' ? 'winter' : t === 'summer' ? 'summer' : 'spring');
export type Res = { food: number; wood: number; stone: number };
export type BuildingType = 'home' | 'garden' | 'kitchen' | 'workshop' | 'fishhut' | 'flowerbed' | 'lamp' | 'well' | 'bench' | 'statue' | 'pantry';
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
  /** Fruit in your basket, for feeding animals (all kinds together, at most 9). */
  snacks: number;
  /** Order 19: how many of those are berries (the rest are tree fruit). */
  berries: number;
  /** Mount you last picked yourself in the mount picker (kept over the theme's default). */
  mountPick?: string;
  /** 40: friends the Mount Thief hid behind puzzles (solve it and open the cell to rescue).
   *  51-53: a list (the thief can take 2 or 3); old single-friend saves are migrated on load. */
  stolen?: Stolen[];
  /** 54: the Thief Jail, by thief kind: times caught, berries shared, and (55) whether it sneaked out. */
  jail?: Record<string, JailCell>;
  /** One-time tips already shown. */
  tips: string[];
  /** Wilderness: trips taken, monsters poofed, rare finds banked at home. */
  wild: WildSave;
  /** 9.36: wardrobe items you've already seen unlocked (newer ones get a "new" glow). */
  seenWardrobe?: string[];
  /** 9.4: each building's room inside (by building id): furniture spots, lamp on/off. */
  interiors?: Record<string, { items: { k: string; x: number; y: number }[]; lampOn?: boolean }>;
};
export type WildSave = { visits: number; poofs: number; loot: Record<string, number> };

const KEY = 'cozy.save.v2';
const OLD_KEYS = ['cozy.save.v1'];
export const DEFAULT_LOOK: Look = { hat: 'straw', scarf: 'red', outfit: 'teal', back: 'none', feather: false, shells: false };

export function freshVillage(): VillageSave {
  return { res: { food: 3, wood: 8, stone: 4 }, buildings: [], villagers: [], nextId: 1, wanderer: 0, events: 0 };
}

function fresh(): SaveData {
  return { v: 2, theme: 'spring', village: freshVillage(), puzzles: {}, treasures: [], fish: {}, minor: {}, look: { ...DEFAULT_LOOK }, visited: ['glade'], chests: [], snacks: 0, berries: 0, tips: [], wild: { visits: 0, poofs: 0, loot: {} } };
}

/** True when this session began with no save at all (a brand-new player). */
export let freshSave = false;

/** 54: one thief's cozy cell in the jail. */
export type JailCell = { n: number; fed?: number; out?: boolean; how?: 'tunnel' | 'lock' };
/** 54: the first six thieves (seed for old saves that only kept a caught count). */
const JAIL_SEED = ['raccoon', 'fox', 'bunny', 'mouse', 'cat', 'pig'];
/** 54: clean a stored jail; old saves without one are seeded from minor.thief_caught (spread over the classic six). */
export function normJail(v: unknown, caught: unknown): Record<string, JailCell> | undefined {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const out: Record<string, JailCell> = {};
    for (const [id, c] of Object.entries(v as Record<string, any>)) {
      const n = Math.max(0, Math.floor(Number(c?.n) || 0));
      if (!n) continue;
      out[id] = { n, ...(Number(c?.fed) > 0 ? { fed: Math.floor(Number(c.fed)) } : {}), ...(c?.out ? { out: true, how: c.how === 'lock' ? 'lock' : 'tunnel' } : {}) };
    }
    return Object.keys(out).length ? out : undefined;
  }
  const k = Math.max(0, Math.floor(Number(caught) || 0));
  if (!k) return undefined;
  const out: Record<string, JailCell> = {};
  for (let i = 0; i < k; i++) { const id = JAIL_SEED[i % JAIL_SEED.length]; (out[id] ??= { n: 0 }).n++; }
  return out;
}
/** 54: a caught thief goes to (or back to) its jail cell. */
export function jailAdd(id: string) {
  save.jail ??= {};
  const c = (save.jail[id] ??= { n: 0 });
  c.n++; delete c.out; delete c.how;
  persist();
  return c;
}
/** 55: a jailed thief sneaks out (its cell shows the tunnel or the open padlock until it is caught again). */
export function jailOut(id: string, how: 'tunnel' | 'lock') {
  const c = save.jail?.[id];
  if (!c || c.out) return null;
  c.out = true; c.how = how;
  persist();
  return c;
}

/** chase: 70, taken during a Thief Chase that hasn't ended yet (its puzzle isn't mixed up yet). */
export type Stolen = { mount: string; puzzle: string; kind: string; chase?: boolean };
/** 53: old saves stored one stolen friend as an object; newer ones a list. Empty lists are dropped. */
export function normStolen(v: unknown): Stolen[] | undefined {
  const arr = Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : [];
  const ok = arr.filter((x): x is Stolen => !!x && typeof (x as Stolen).mount === 'string' && typeof (x as Stolen).puzzle === 'string')
    .map((x) => ({ mount: x.mount, puzzle: x.puzzle, kind: typeof x.kind === 'string' ? x.kind : 'raccoon', ...(x.chase === true ? { chase: true } : {}) }));
  return ok.length ? ok : undefined;
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
        const snacks = Math.max(0, Math.min(9, Number(d.snacks) || 0));
        return { ...f, ...d, v: 2, snacks, berries: Math.max(0, Math.min(snacks, Number(d.berries) || 0)), tips: Array.isArray(d.tips) ? d.tips : [], wild: { ...f.wild, ...(d.wild ?? {}), loot: { ...(d.wild?.loot ?? {}) } }, theme: normTheme(d.theme), village: v, look: { ...DEFAULT_LOOK, ...(d.look ?? {}) }, stolen: normStolen(d.stolen), jail: normJail(d.jail, d.minor?.thief_caught) };
      }
    }
  } catch { /* storage unavailable or corrupt */ }
  freshSave = true;
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
/** Fruit kinds in the basket: tree fruit (apples, pears) and berries from berry bushes. */
export type FruitKind = 'apple' | 'berry';
export const BASKET_MAX = 9;
/** Put one fruit in the basket (false when it is already full). */
export function addFruit(kind: FruitKind) {
  if (save.snacks >= BASKET_MAX) return false;
  save.snacks++;
  if (kind === 'berry') save.berries++;
  persist();
  return true;
}
/** Take one fruit out of the basket for feeding: berries first, then tree fruit (null when empty). */
export function takeFruit(): FruitKind | null {
  if (save.snacks <= 0) return null;
  save.snacks--;
  const kind: FruitKind = save.berries > 0 ? 'berry' : 'apple';
  if (kind === 'berry') save.berries--;
  save.berries = Math.min(save.berries, save.snacks);
  persist();
  return kind;
}
export function addMinor(id: string, n = 1) { save.minor[id] = (save.minor[id] ?? 0) + n; persist(); return save.minor[id]; }
export function setPuzzle(id: string) { save.puzzles[id] = true; persist(); }
export function visit(area: string) { if (!save.visited.includes(area)) { save.visited.push(area); persist(); return true; } return false; }
