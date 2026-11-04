// 38 (Walker, Nov 3 8:57 AM CT): Sky View, each flying mount's own view. The top-down art from 74
// (the mount as itself, you riding, flying forward) over the world far below, with high-speed effects
// and the chosen Looks & Moves style. Each mount gets its own sky: a haze colour, a signature trail
// (sparkles, hearts, crumbs, bubbles...) and its own whole-body rhythm (bob, sway, roll).
export type Sky = { haze: number; trail: number[]; key: 'ch_spark' | 'ch_dot' | 'ch_heart' | 'ch_star'; bob: number; sway: number; title: string };
const S = (haze: number, trail: number[], key: Sky['key'], bob: number, sway: number, title: string): Sky => ({ haze, trail, key, bob, sway, title });
export const SKY: Record<string, Sky> = {
  eagle: S(0xcfeaff, [0xffffff, 0xe8f4ff], 'ch_dot', 1, 1, 'Eagle Sky'),
  pterodactyl: S(0xffe2c4, [0xffb36b, 0xfff0c8], 'ch_dot', 1.2, 1.1, 'Dino Sky'),
  goose: S(0xdcefff, [0xffffff, 0xf5f0e0], 'ch_dot', 1, 0.9, 'Goose Sky'),
  snowy_owl: S(0xe8f0ff, [0xffffff, 0xd8e8ff], 'ch_spark', 0.8, 0.8, 'Snowy Night Sky'),
  flamingo: S(0xffd6e6, [0xff8fb8, 0xffd0e0], 'ch_heart', 1, 1.2, 'Pink Sunset Sky'),
  rubber_duck: S(0xd6f2ff, [0xffffff, 0xcdeeff, 0x9fdcf5], 'ch_dot', 1.4, 1.3, 'Bubble Sky'),
  bumblebee: S(0xfff2b8, [0xffd34d, 0xfff3a0], 'ch_spark', 0.6, 1.6, 'Honey Sky'),
  unicorn: S(0xf0dcff, [0xff9ad8, 0x9be0ff, 0xfff38a, 0xb6ff9a], 'ch_star', 1, 1, 'Rainbow Sky'),
  reindeer: S(0xe4eeff, [0xffffff, 0xffe27a], 'ch_spark', 1.1, 1, 'Starry Snow Sky'),
  cloud_puppy: S(0xe6f4ff, [0xffffff, 0xeef6ff], 'ch_dot', 1.3, 1.2, 'Fluffy Sky'),
  snail: S(0xdaf5d0, [0xb8f08a, 0xffffff], 'ch_dot', 0.5, 0.5, 'Slow-and-Steady Sky'),
  teacup: S(0xfbe6f0, [0xffffff, 0xffd0e8], 'ch_dot', 1, 0.8, 'Tea Party Sky'),
  airplane: S(0xcfe6ff, [0xffffff, 0xd0e0f0], 'ch_dot', 0.6, 0.9, 'Jet Sky'),
  pumpkin: S(0xffd9a8, [0xff9b3d, 0xffd34d, 0xb07ad8], 'ch_spark', 1.1, 1, 'Pumpkin Sky'),
  cowboy_cookie: S(0xffe6c0, [0x6b3f1d, 0xa8692e, 0xd9a05a], 'ch_dot', 1.3, 1.1, 'Cookie Sky'),
  chili_poncho: S(0xffd2b8, [0xff3b1f, 0xff9a1f, 0xffd23a], 'ch_spark', 1, 1.2, 'Spicy Sky'),
  magic_carpet: S(0xf3dcff, [0xffd34d, 0xfff1a0, 0xffffff], 'ch_star', 0.9, 1.2, 'Magic Sky'),
  sky_jelly: S(0xf0d6ff, [0xff8fd0, 0xc99bff, 0xffd0f0], 'ch_dot', 1.5, 0.9, 'Glow Jelly Sky'),
  strawberry: S(0xffdce0, [0x3fae49, 0xe8384f, 0xfff1a0], 'ch_heart', 1.2, 1.1, 'Berry Sky'),
  tamale: S(0xfff0c0, [0xf2c14e, 0xffe08a, 0xd99a2b], 'ch_dot', 1.1, 1, 'Corn Sky'),
  he_buddy: S(0xffe8c8, [0xffd34d, 0xfff3b0, 0xe8343a], 'ch_star', 1, 1.1, 'Gold Star Sky'),
  concha: S(0xffe0ec, [0xff9fc4, 0xffffff, 0xffd6e5], 'ch_dot', 1.2, 1, 'Sugar Sky'),
  sushi: S(0xdaf4ee, [0xffffff, 0xff8a2a, 0x2e4a3a], 'ch_dot', 1.1, 1, 'Ocean Breeze Sky'),
};
export const skyOf = (id: string) => SKY[id] ?? SKY.eagle;
