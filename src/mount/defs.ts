// Data-driven mount definitions. Eagle is free; others unlock via treasures.
import { hasTreasure } from '../save';

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
];

export function mountById(id: string): MountDef {
  return MOUNTS.find((m) => m.id === id) ?? MOUNTS[0];
}

export function isMountUnlocked(m: MountDef): boolean {
  return m.treasure === null || hasTreasure(m.treasure);
}

export function unlockedMounts(): MountDef[] {
  return MOUNTS.filter(isMountUnlocked);
}
