// Progress persistence (localStorage). Everything the player earns lives here.
export type HatId = 'straw' | 'none' | 'crown' | 'foxhood';
export type ScarfId = 'red' | 'sunny' | 'petal' | 'silver' | 'none';
export type OutfitId = 'teal' | 'moss' | 'sea' | 'koi';
export type BackId = 'none' | 'backpack' | 'staff';
export type Look = { hat: HatId; scarf: ScarfId; outfit: OutfitId; back: BackId; feather: boolean; shells: boolean };

export type SaveData = {
  v: 1;
  puzzles: Record<string, boolean>;
  treasures: string[];
  fish: Record<string, { n: number; best: number }>;
  minor: Record<string, number>;
  look: Look;
  visited: string[];
  chests: string[];
};

const KEY = 'cozy.save.v1';
export const DEFAULT_LOOK: Look = { hat: 'straw', scarf: 'red', outfit: 'teal', back: 'none', feather: false, shells: false };

function fresh(): SaveData {
  return { v: 1, puzzles: {}, treasures: [], fish: {}, minor: {}, look: { ...DEFAULT_LOOK }, visited: ['glade'], chests: [] };
}

export const save: SaveData = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 1) return { ...fresh(), ...d, look: { ...DEFAULT_LOOK, ...(d.look ?? {}) } };
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
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  Object.assign(save, fresh());
}

export const hasTreasure = (id: string) => save.treasures.includes(id);
export function addTreasure(id: string) { if (!hasTreasure(id)) { save.treasures.push(id); persist(); } }
export function addMinor(id: string, n = 1) { save.minor[id] = (save.minor[id] ?? 0) + n; persist(); return save.minor[id]; }
export function setPuzzle(id: string) { save.puzzles[id] = true; persist(); }
export function visit(area: string) { if (!save.visited.includes(area)) { save.visited.push(area); persist(); return true; } return false; }
