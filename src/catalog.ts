// What can be found and what it unlocks.
import { save, Look, hasTreasure } from './save';

export type Treasure = { id: string; name: string; icon: string; blurb: string; hint: string };
export const TREASURES: Treasure[] = [
  { id: 'golden_feather', name: 'Golden Feather', icon: 'feather', blurb: 'Warm as a sunny afternoon. Tuck it in your hat!', hint: 'The shrine beyond the bramble gate.' },
  { id: 'flower_crown', name: 'Flower Crown', icon: 'ic_crown', blurb: "Grandmother's garden, woven into a crown.", hint: 'The flower pots by the cottage garden.' },
  { id: 'rusty_key', name: 'Rusty Key', icon: 'ic_key', blurb: 'Opens the old gate on the north bridge.', hint: 'The bells by the windmill.' },
  { id: 'shell_necklace', name: 'Seashell Necklace', icon: 'ic_shells', blurb: 'The lake kept it safe under the sand.', hint: 'A riddle on the lake shore.' },
  { id: 'fox_hood', name: 'Fox-ear Hood', icon: 'ic_hood', blurb: 'Snug, orange and very sneaky.', hint: 'Stone tiles deep in Mistbirch Wood.' },
];

export type MinorId = 'petal' | 'shell' | 'apple' | 'acorn' | 'beetle';
export const MINORS: { id: MinorId; name: string; icon: string }[] = [
  { id: 'petal', name: 'Petals', icon: 'petal' }, { id: 'shell', name: 'Shells', icon: 'shell0' },
  { id: 'apple', name: 'Fruit', icon: 'apple' }, { id: 'acorn', name: 'Acorns', icon: 'acorn' }, { id: 'beetle', name: 'Beetles spotted', icon: 'beetle' },
];

export type Slot = 'hat' | 'scarf' | 'outfit' | 'back' | 'feather' | 'shells';
type Unlock = { treasure?: string; fish?: string; minor?: [string, number] } | null;
export type Cosmetic = { id: string; slot: Slot; value: any; name: string; unlock: Unlock; hint: string };
export const COSMETICS: Cosmetic[] = [
  { id: 'hat:straw', slot: 'hat', value: 'straw', name: 'Straw hat', unlock: null, hint: '' },
  { id: 'hat:none', slot: 'hat', value: 'none', name: 'No hat', unlock: null, hint: '' },
  { id: 'hat:crown', slot: 'hat', value: 'crown', name: 'Flower crown', unlock: { treasure: 'flower_crown' }, hint: 'Solve the garden flower pots.' },
  { id: 'hat:foxhood', slot: 'hat', value: 'foxhood', name: 'Fox-ear hood', unlock: { treasure: 'fox_hood' }, hint: 'Somewhere in Mistbirch Wood.' },
  { id: 'scarf:red', slot: 'scarf', value: 'red', name: 'Red scarf', unlock: null, hint: '' },
  { id: 'scarf:sunny', slot: 'scarf', value: 'sunny', name: 'Sunflower scarf', unlock: { treasure: 'rusty_key' }, hint: 'Ring the windmill bells.' },
  { id: 'scarf:petal', slot: 'scarf', value: 'petal', name: 'Petal scarf', unlock: { minor: ['petal', 10] }, hint: 'Collect 10 petals from flowers.' },
  { id: 'scarf:silver', slot: 'scarf', value: 'silver', name: 'Silver scarf', unlock: { fish: 'silver_eel' }, hint: 'Catch a rare river fish.' },
  { id: 'scarf:none', slot: 'scarf', value: 'none', name: 'No scarf', unlock: null, hint: '' },
  { id: 'outfit:teal', slot: 'outfit', value: 'teal', name: 'Teal tunic', unlock: null, hint: '' },
  { id: 'outfit:moss', slot: 'outfit', value: 'moss', name: 'Moss tunic', unlock: null, hint: '' },
  { id: 'outfit:sea', slot: 'outfit', value: 'sea', name: 'Sea cloak', unlock: { treasure: 'shell_necklace' }, hint: 'Dig up the lake shore secret.' },
  { id: 'outfit:koi', slot: 'outfit', value: 'koi', name: 'Koi coat', unlock: { fish: 'lily_koi' }, hint: 'Catch the rare pond koi.' },
  { id: 'back:none', slot: 'back', value: 'none', name: 'Nothing', unlock: null, hint: '' },
  { id: 'back:backpack', slot: 'back', value: 'backpack', name: 'Backpack', unlock: { minor: ['shell', 6] }, hint: 'Collect 6 shells on the shore.' },
  { id: 'back:staff', slot: 'back', value: 'staff', name: 'Lantern staff', unlock: { fish: 'moonfish' }, hint: 'Catch the rare lake moonfish.' },
  { id: 'feather:on', slot: 'feather', value: true, name: 'Golden feather', unlock: { treasure: 'golden_feather' }, hint: 'Find the shrine treasure.' },
  { id: 'shells:on', slot: 'shells', value: true, name: 'Shell necklace', unlock: { treasure: 'shell_necklace' }, hint: 'Dig up the lake shore secret.' },
];

export function isUnlocked(c: Cosmetic) {
  const u = c.unlock;
  if (!u) return true;
  if (u.treasure) return hasTreasure(u.treasure);
  if (u.fish) return (save.fish[u.fish]?.n ?? 0) > 0;
  if (u.minor) return (save.minor[u.minor[0]] ?? 0) >= u.minor[1];
  return false;
}

export function isEquipped(c: Cosmetic, look: Look) {
  return (look as any)[c.slot] === c.value;
}

export function equip(c: Cosmetic, look: Look) {
  if (c.slot === 'feather' || c.slot === 'shells') (look as any)[c.slot] = !(look as any)[c.slot];
  else (look as any)[c.slot] = c.value;
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'junk';
export type Species = { id: string; name: string; where: 'pond' | 'river' | 'lake'; rarity: Rarity; tint: number; size: [number, number]; blurb: string };
export const SPECIES: Species[] = [
  { id: 'bluegill', name: 'Bluegill', where: 'pond', rarity: 'common', tint: 0x7fb6d8, size: [10, 22], blurb: 'A friendly little pond regular.' },
  { id: 'golden_carp', name: 'Golden Carp', where: 'pond', rarity: 'uncommon', tint: 0xf2b13b, size: [25, 48], blurb: 'Glints like a dropped coin.' },
  { id: 'lily_koi', name: 'Lily Koi', where: 'pond', rarity: 'rare', tint: 0xff8a5c, size: [35, 60], blurb: 'Naps under lily pads. Unlocks the Koi coat!' },
  { id: 'minnow', name: 'River Minnow', where: 'river', rarity: 'common', tint: 0xc6d8df, size: [5, 11], blurb: 'Tiny, quick, and very shiny.' },
  { id: 'brook_trout', name: 'Brook Trout', where: 'river', rarity: 'common', tint: 0x9bbf7a, size: [20, 38], blurb: 'Speckled like a mossy stone.' },
  { id: 'salmon', name: 'Speckled Salmon', where: 'river', rarity: 'uncommon', tint: 0xe88c74, size: [45, 80], blurb: 'Swims upstream with great determination.' },
  { id: 'silver_eel', name: 'Silver Eel', where: 'river', rarity: 'rare', tint: 0xe2ecf4, size: [60, 110], blurb: 'Slips like moonlight. Unlocks the Silver scarf!' },
  { id: 'perch', name: 'Yellow Perch', where: 'lake', rarity: 'common', tint: 0xc9c45a, size: [15, 30], blurb: 'Striped and cheerful.' },
  { id: 'sunfish', name: 'Sunfish', where: 'lake', rarity: 'common', tint: 0xf6c65b, size: [10, 24], blurb: 'Basks near the warm shallows.' },
  { id: 'pike', name: 'Lake Pike', where: 'lake', rarity: 'uncommon', tint: 0x7f9a6a, size: [50, 95], blurb: 'Long, toothy, secretly shy.' },
  { id: 'moonfish', name: 'Moonfish', where: 'lake', rarity: 'rare', tint: 0xcbc4ff, size: [30, 55], blurb: 'Glows faintly. Unlocks the Lantern staff!' },
  { id: 'old_boot', name: 'Old Boot', where: 'lake', rarity: 'junk', tint: 0x8a6a50, size: [26, 30], blurb: 'Someone lost this. Still comfy?' },
];
export const RARITY_STARS: Record<Rarity, number> = { junk: 0, common: 1, uncommon: 2, rare: 3 };
