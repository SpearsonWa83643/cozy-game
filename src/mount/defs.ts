// Data-driven mount definitions. Eagle is free; others unlock via treasures.
import { hasTreasure, save } from '../save';
import { theme } from '../theme';

export type MountDef = {
  id: string;
  name: string;
  /** Treasure that unlocks this mount; null = always free (bald eagle). */
  treasure: string | null;
  body: string;
  wing: string;
  wingFar: string;
  icon: string;
  /** Overall draw scale (eagle is 0.85). */
  scale: number;
  blurb: string;
  /** Wing beat speed multiplier (bee buzzes fast). Default 1. */
  flapRate?: number;
  /** 'prop' = no flapping wings: `wing` is a propeller spun at the nose (propAt, body units from centre). */
  style?: 'wings' | 'prop';
  propAt?: [number, number];
};

export const MOUNTS: MountDef[] = [
  {
    id: 'eagle',
    name: 'Bald Eagle',
    treasure: null,
    body: 'eagle_body', wing: 'eagle_wing', wingFar: 'eagle_wing_far', icon: 'i_eagle',
    scale: 0.85,
    blurb: 'Your first flying friend!',
  },
  {
    id: 'pterodactyl',
    name: 'Pterodactyl',
    treasure: 'pterodactyl_egg',
    body: 'ptero_body', wing: 'ptero_wing', wingFar: 'ptero_wing_far', icon: 'i_ptero',
    scale: 0.92,
    blurb: 'A big friendly flyer from long ago!',
  },
  {
    id: 'cloud_puppy',
    name: 'Cloud Puppy',
    treasure: 'cloud_puppy_tuft',
    body: 'cloud_body', wing: 'cloud_wing', wingFar: 'cloud_wing_far', icon: 'i_cloud',
    scale: 0.9,
    blurb: 'A soft puppy made of clouds!',
  },
  {
    id: 'unicorn',
    name: 'Unicorn',
    treasure: 'rainbow_horseshoe',
    body: 'uni_body', wing: 'uni_wing', wingFar: 'uni_wing_far', icon: 'i_unicorn',
    scale: 0.9,
    blurb: 'A sparkly flying unicorn!',
  },
  {
    id: 'bumblebee',
    name: 'Bumblebee',
    treasure: 'golden_honeycomb',
    body: 'bee_body', wing: 'bee_wing', wingFar: 'bee_wing_far', icon: 'i_bee',
    scale: 0.85,
    blurb: 'A fuzzy buzzy bumblebee!',
    flapRate: 4,
  },
  {
    id: 'snail',
    name: 'Lantern Snail',
    treasure: 'glow_pearl',
    body: 'snail_body', wing: 'snail_wing', wingFar: 'snail_wing_far', icon: 'i_snail',
    scale: 0.85,
    blurb: 'A slow, glowy lantern snail that can fly!',
    flapRate: 0.8,
  },
  {
    id: 'teacup',
    name: 'Flying Teacup',
    treasure: 'sugar_cube',
    body: 'cup_body', wing: 'cup_wing', wingFar: 'cup_wing_far', icon: 'i_teacup',
    scale: 0.85,
    blurb: 'Hop in the teacup and fly!',
  },
  {
    id: 'airplane',
    name: 'Toy Airplane',
    treasure: 'toy_propeller',
    body: 'plane_body', wing: 'plane_prop', wingFar: 'plane_prop_far', icon: 'i_plane',
    scale: 0.85,
    blurb: 'Zoom! A little red airplane!',
    style: 'prop', propAt: [61, 5],
  },
  {
    id: 'pumpkin',
    name: 'Pumpkin',
    treasure: 'pumpkin_seed',
    body: 'pump_body', wing: 'pump_wing', wingFar: 'pump_wing_far', icon: 'i_pumpkin',
    scale: 0.85,
    blurb: 'A happy flying jack-o\'-lantern!',
    flapRate: 1.3,
  },
];

export function mountById(id: string): MountDef {
  return MOUNTS.find((m) => m.id === id) ?? MOUNTS[0];
}

/** The theme's own default mount: the pumpkin carriage in Halloween, the bald eagle otherwise. */
export function themeDefaultMount(): string {
  return theme.id === 'halloween' ? 'pumpkin' : 'eagle';
}

export function isMountUnlocked(m: MountDef): boolean {
  return m.treasure === null || hasTreasure(m.treasure) || m.id === themeDefaultMount();
}

/** Unlocked mounts, the theme's default first. */
export function unlockedMounts(): MountDef[] {
  const def = themeDefaultMount();
  const list = MOUNTS.filter(isMountUnlocked);
  return [...list.filter((m) => m.id === def), ...list.filter((m) => m.id !== def)];
}

/**
 * What Call Mount summons straight away, or null to open the picker. With no treasure mounts
 * (beyond the free eagle and the theme's default) it is your own last pick if you made one,
 * otherwise the theme's default. With treasure mounts the picker opens (your pick is marked).
 */
export function directMount(): string | null {
  const def = themeDefaultMount();
  const list = unlockedMounts();
  const extras = list.filter((m) => m.id !== def && m.id !== 'eagle');
  if (extras.length) return null;
  const pick = save.mountPick;
  if (pick && list.some((m) => m.id === pick)) return pick;
  return def;
}
