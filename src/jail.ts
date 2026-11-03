// 54 (Walker, Nov 2): the Thief Jail. Every caught thief gets a cozy cell (no scary bits): a bed,
// a rug, a flower. Tap one and it talks to you, waves, sulks or says sorry; you can share a berry.
import { THIEVES, gigglesOf, type Kind } from './thief';
import { save, persist, takeFruit, type JailCell } from './save';

/** Each thief's own name and species (shown on its cell's name board). */
export const JAIL_INFO: Record<string, { nick: string; species: string; line: string }> = {
  raccoon: { nick: 'Rascal', species: 'Raccoon', line: 'I only wanted a shiny ride!' },
  fox: { nick: 'Ginger', species: 'Fox', line: 'I was just borrowing it. Honest!' },
  bunny: { nick: 'Hopsy', species: 'Bunny', line: 'Can I hop out for a carrot?' },
  mouse: { nick: 'Squeak', species: 'Mouse', line: 'This bed is just my size!' },
  cat: { nick: 'Whiskers', species: 'Cat', line: 'I will nap here. Purr...' },
  pig: { nick: 'Truffle', species: 'Piglet', line: 'Oink! Is it snack time?' },
  squirrel: { nick: 'Nutmeg', species: 'Squirrel', line: 'Got any acorns in there?' },
  hedgehog: { nick: 'Pokey', species: 'Hedgehog', line: 'I am a soft hedgehog. Mostly!' },
  otter: { nick: 'Splash', species: 'Otter', line: 'Is there a bathtub in here?' },
  skunk: { nick: 'Petal', species: 'Skunk', line: 'I smell like flowers today!' },
  possum: { nick: 'Pippa', species: 'Possum', line: 'I can hang upside down. Watch!' },
  badger: { nick: 'Bramble', species: 'Badger', line: 'No digging? Okay, okay.' },
  duckling: { nick: 'Puddles', species: 'Duckling', line: 'Quack! I want a pond!' },
};
export const nickOf = (id: string) => JAIL_INFO[id]?.nick ?? THIEVES.find((k) => k.id === id)?.name ?? 'Thief';
export const speciesOf = (id: string) => JAIL_INFO[id]?.species ?? THIEVES.find((k) => k.id === id)?.name ?? 'Thief';

/** What a thief does when you tap it (in turn). */
export type JailAct = 'cheeky' | 'wave' | 'sorry' | 'sulk';
export const JAIL_ACTS: JailAct[] = ['cheeky', 'wave', 'sorry', 'sulk'];
const SORRY = ['Sorry I took your friend!', 'I am sorry. I will be good!', 'Sorry! Can we be friends?'];
const SULK = ['Hmph. I wanted to fly...', 'Pout pout.', 'No fair! ...okay, fair.'];
const WAVE = ['Hi hi! *waves*', 'Hello! *waves*', 'Yoo-hoo! *waves*'];

/** The line for an act (n: how many times you've tapped it, so the words change). */
export function jailLine(k: Kind, act: JailAct, n: number) {
  if (act === 'cheeky') { const gl = [JAIL_INFO[k.id]?.line ?? 'Hee hee!', ...gigglesOf(k)]; return gl[n % gl.length]; }
  const set = act === 'sorry' ? SORRY : act === 'sulk' ? SULK : WAVE;
  return set[n % set.length];
}

/** Jailed thieves (caught at least once), in the usual thief order. */
export const jailed = () => THIEVES.filter((k) => (save.jail?.[k.id]?.n ?? 0) > 0);
export const cellOf = (id: string): JailCell | undefined => save.jail?.[id];

/** Share a fruit from your basket with a jailed thief. Returns what it got, or null (empty basket). */
export function shareFruit(id: string) {
  const c = save.jail?.[id];
  if (!c || c.out) return null;
  const f = takeFruit();
  if (!f) return null;
  c.fed = (c.fed ?? 0) + 1;
  persist();
  return f;
}
