# Willowmere Glade (Milestone 1 vertical slice)

A cozy top-down exploration slice with a light puzzle. It runs in the browser and is built with
**Phaser 4.2.1**, **TypeScript** and **Vite**. All art is painted procedurally in code at startup
(Canvas 2D brush dabs, soft gradients and shading, packed into one mipmapped atlas). All audio is
synthesized with WebAudio. There are no paid or external assets.

## Run

```bash
npm install
npm run dev        # dev server with HMR → http://localhost:5173
# or a production build:
npm run build      # typecheck + build into dist/
npm run preview    # serves dist/ → http://localhost:4173
```

`dist/` is fully static (relative paths), so any static file server works, e.g. `npx serve dist`.

### Single-file build (play from disk)
```bash
npm run build:single   # → dist-single/index.html (JS, CSS, font all inlined)
```
A prebuilt copy lives at `share/WillowmereGlade.html`. Double-click it to open it in Chrome,
Safari or Firefox; it needs no server and makes no network requests.

### Controls
- **WASD / Arrow keys**: walk (8 directions)
- **E / Space / Enter**: interact, and advance dialog
- **F**: toggle the FPS readout (top-right: current, 10 s rolling average, and the worst recent frame as "low"). It is on by default.

### Debug URL flags
- `?bloom=1` turns on the optional GPU bloom (Phaser 4 filters). It is off by default.
- `?tex=N` sets the WebGL texture units per batch. The default is 1 (see notes).
- `?mip=0` disables mipmaps.
- `window.__cozy` exposes `state`, `teleport(x, y)` and `lanterns`. The tests use it.

## What's in the slice
- A meadow clearing with a cottage (chimney smoke, glowing windows), a garden, a pond (lily pads,
  reeds, glints, ripples) and mixed trees (oak, teal, blossom, amber, pine). There are also
  flowers, grass tufts, rocks and mushrooms.
- Atmosphere: everything sways gently, and grass rustles when you brush past it. Pollen, fireflies
  and petals drift, sunbeams and cloud shadows move across the ground, and there is a warm
  sun-glow and vignette.
- The player is a little straw-hat traveller with 5 painted facings plus mirroring (8 directions)
  and 3-frame walk cycles. Movement has smoothed acceleration, a bob and breathing, and dust puffs.
  The player collides with props, and the pond collision follows the painted shoreline.
- A follow camera with world bounds. Rendering is high-DPI (the canvas renders at
  devicePixelRatio, capped at 2) and responsive to window size.
- **Puzzle:** a worn sign says the lanterns must be lit "when the sun first wakes, then climbs to
  its height, then sinks to sleep". The three stone lanterns are marked dawn, noon and dusk, and
  they are spread around the glade out of order. Lighting the wrong one makes all flames gutter
  out. Lighting them in the right order makes the camera pan to the bramble gate, which unravels
  with particles, a glow, a gentle shake and a chime arpeggio. A chest in the shrine beyond holds
  a **Golden Feather**.
- UI: interact prompt bubbles, a parchment dialog with a typewriter effect, toasts, a lantern HUD
  and a feather slot.

## Tests

```bash
npx playwright install chromium   # once
npm run build && npm test
```

- `tests/smoke.spec.ts` loads the built game, fails on any console error, and walks with the
  keyboard (straight and diagonal). It reads the sign, tries a wrong order, solves the puzzle,
  walks through the gate and opens the chest. Screenshots go to `screenshots/01-…08-*.png`.
- `tests/hero.spec.ts` takes 2× DPI beauty shots, saved as `screenshots/hd-*.png`.

Headless Chromium uses SwiftShader (software GL), so frame rates in tests are very low. The tests
wait on game state rather than on time.

## Notes
- Phaser 4 ships agent skill docs. They are copied to `docs/phaser-skills/` for reference.
- Everything is drawn from one atlas, and `maxTextures` defaults to 1. On SwiftShader, Phaser's
  multi-texture batching dropped triangles from sprites. With the atlas, the single-unit batch
  costs almost nothing.
- Font: Nunito (SIL Open Font License 1.1) is bundled in `src/assets/`.

## Layout
- `src/art.ts`: procedural painters (ground, trees, cottage, player, FX) and the atlas packer
- `src/layout.ts`: world layout (positions of the pond, paths, lanterns and gate)
- `src/audio.ts`: WebAudio synth (bells, fizzle, sparkle, birdsong)
- `src/scenes/World.ts`: gameplay, camera, puzzle and ambience
- `src/scenes/UI.ts`: HUD, prompts, dialog and toasts

## iPad / touch (v0.3)

- **Walk:** drag anywhere — a floating joystick appears under your thumb (analog; the base follows your thumb).
- **Go somewhere:** tap a spot; the hero walks there with grid A* pathing around trees, the pond and walls.
- **Use things:** tap an object (sign, lantern, chest, cat) to walk over and use it, or press the big
  contextual button (bottom-right, 96 px) that appears with the action name ("Light", "Read", "Pet", "Next").
  Tap anywhere to advance dialog.
- **Sound:** the speaker button (top-right) cycles on / quiet / off (also `V`); the choice is remembered.
- Safe-area insets respected; landscape-first, portrait reframes the camera. Page scroll, pinch/double-tap
  zoom, selection and callouts are suppressed. Audio unlocks on the first touch (iOS-safe, plays through the
  mute switch on Safari 17+).
- "Add to Home Screen": apple-mobile-web-app meta, inlined icon and data-URL manifest. Note Safari can only
  install it from an http(s) URL (opening the .html from the Files app shows a preview), so host the single
  file anywhere static (or `npx vite preview --host` on your LAN) and add it from Safari.
- Memory: painted canvases are uploaded as plain textures and their backing stores released; the ground is
  painted at 1.5x on touch devices (was 2x) — ~27 MB instead of 48 MB, no duplicate ImageData copies.

Ambient: generative WebAudio score (Fmaj9–Dm9–Bbmaj7–C6/9–Am7–Bbmaj9–Gm9–C9sus pads, soft bass, sparse
kalimba), plus butterflies, a passing flock, a duck family, fish and splash rings, a shy frog, a cat on the
cottage step (pet it), wind gusts that ripple through grass and trees with drifting leaves, falling leaves,
and a slow light-colour drift. Touch test: `npm run test:touch` (iPad 1180x820 @2x, hasTouch, file://).

## Hosting (GitHub Pages)

Live: https://spearsonwa83643.github.io/cozy-game/ — repo: https://github.com/SpearsonWa83643/cozy-game

- `.github/workflows/deploy.yml` builds on every push to `main` (or manual dispatch): Node 20, `npm ci`,
  `npm run build`, then uploads `dist/` with `configure-pages@v5` / `upload-pages-artifact@v3` / `deploy-pages@v4`.
  Pages is set to `build_type=workflow`.
- `vite.config.ts` uses `base: './'`, so the build works under the `/cozy-game/` subpath.
- `dist/` ships `manifest.webmanifest` + `icon-180.png` (relative `start_url`/`scope`) alongside the
  apple-mobile-web-app meta, so **on iPad: open the live URL in Safari → Share → Add to Home Screen** for a
  full-screen app icon.
- `npm run test:subpath` serves `dist/` under `/cozy-game/` (`tests/subpath-server.mjs`) and checks boot,
  install metadata, touch and console. Point it at the live site with
  `BASE_URL=https://spearsonwa83643.github.io/cozy-game/ npx playwright test -c playwright.subpath.config.ts`.

## The wider world (v0.4)

**Areas:** Willowmere Glade, **Brookside** (river, two bridges), **Mistbirch Wood** (misty birches, owl,
deer; behind the locked gate on the north bridge), **Windmill Orchard** (apple and pear rows, windmill,
bells) and **Shellwater Shore** (lake, sand, pier, crabs, shells). The ground is painted in 512 px tiles
streamed around the camera, so no single giant texture is needed. Each area has its own palette and a
subtle music mood, and a title card appears the first time you arrive.

**Puzzles and treasures** (each has a sign or clue):
| Puzzle | Where | Treasure |
|---|---|---|
| Light the lanterns dawn, then noon, then dusk | glade | Golden Feather |
| Match the flower pots to Grandmother's rhyme | cottage garden | Flower Crown |
| Ring the bells in the songbird's order | windmill | Rusty Key (opens the north bridge gate) |
| Rotate the moon tiles to complete the picture | Mistbirch Wood | Fox-ear Hood |
| Solve the riddle sign and dig in the right spot | lake shore | Seashell Necklace |

**Fishing:** tap water near you, or press "Fish". Wait for the bobber to dip (you get a sound and,
where supported, a vibration), then tap "Hook!". In the timing bar, tap whenever the line is in the
green zone. Pond, river and lake each have their own species, rated common, uncommon or rare (plus
junk). The journal records how many of each you caught and your best size. Taps are judged at the
moment of the touch event, so a dropped frame never costs you a fish.

**Satchel** (bag/map buttons at top right; keyboard `B` wardrobe, `M` map, `I` treasures, `V` sound):
- **Map:** areas you haven't visited are hidden in mist. It shows puzzle markers (orange = unsolved,
  green = solved) and your position.
- **Wardrobe:** large tiles for hats, scarves, outfits, and back items or extras. Each tile previews
  the hero wearing that item. Locked tiles show how to unlock them: treasures, rare fish (Koi coat,
  Silver scarf, Lantern staff) or little finds (10 petals for the Petal scarf, 6 shells for the
  Backpack).
- **Treasures:** what you've found, with hints for the rest, and counts of little finds. "Reset
  progress" needs a second tap to confirm.
- Progress (treasures, puzzles, fish, look, visited areas, little finds) is saved in `localStorage`.

**Tap anything:** cat (purrs, rolls over, or follows you), ducks (quack, scatter, regroup), frog, fish,
butterflies (they land on you), birds, trees (shake, leaves, fruit or acorn drops), flowers (pop,
petals), bushes (rustle, sometimes a rabbit or sparrows), rocks (beetles), chimes, windmill (spins
faster), rabbits, squirrels, hedgehogs, deer, crabs and the owl. When you walk behind a tree, its
canopy fades so you can still see the hero.

Tests: `tests/world.spec.ts` runs on an iPad 1180x820 @2x with touch. It walks between areas, solves
the pots, equips the crown, catches a fish, taps six creatures and checks the console. Screenshots go
to `screenshots/hd-ipad-v4-*.png`.

## Willow Village (v0.5)
The glade grows into a little village you build and run. Rules for a young audience: simple taps,
short sentences, big icons, few numbers, no combat and no fail states.

- **Themes:** the satchel has a live Classic / Halloween (spooky-cute) toggle. It is saved, and
  the ground, trees, sky, fog, particles, critters, props, UI accents and music all follow it.
  New themes are one entry in `src/theme.ts` (`THEMES` + `THEME_ORDER`).
- **Friends:** visitors wander in. Tap one, then tap Invite. Each has a name, one cute trait and a
  mood face (food, sleep, fun). Tap a friend for their tiny card.
- **Build:** tap the hammer. Pick Home, Garden, Kitchen, Workshop or Fishing Hut (plus decorations),
  tap a spot on the snap grid, then tap the green check. Costs are small (wood / stone).
- **Jobs:** drag a friend onto a building. Gardeners and cooks make food, builders make wood and
  stone, fishers catch fish. The resource bar shows food, wood and stone.
- **Links to exploring:** fish you catch add food; treasures unlock decorations; the first fish
  unlocks the Fishing Hut. Trees and rocks sometimes give wood and stone.
- **Events:** a merchant (simple trades), rainy days (gardens grow faster) and festivals (everyone dances).
- **Fruit and feeding:** tap a fruit tree and fruit drops. Pick it up and it goes in your basket
  (shown next to the bar). Tap an animal while you have fruit to feed it: hearts, and it follows
  you for a bit (cat, rabbits, squirrels, hedgehogs, deer; ducks, frog, crabs and the owl say thanks).
- **Helpers (from Gamer's RimWorld notes):** an idle friend shows a bubble with a job that suits
  them; one tap takes it (Undo button) or opens build mode on the right building. Alerts only
  appear when something needs you, and each one has a one-tap fix (Snack, Nap, Play, Build, Get
  some). Friends always recover, and if you run out of wood with no workshop, friends bring some.
- **Save:** `localStorage` key `cozy.save.v2`; v1 saves are migrated (exploration progress kept,
  village starts fresh).

Test: `npx playwright test -c playwright.touch.config.ts tests/village.spec.ts` (iPad viewport,
touch) invites a friend, builds, takes and undoes a job bubble, drags to assign, waits for food,
fixes an alert, drops fruit and feeds the cat, toggles both themes and reloads.

## Numbered sequences (v0.5.1)
For kids learning numbers, every ordered puzzle shows its order with big numbers.
- Bold, thick-outlined symbol art (`src/seq.ts`: dawn / noon / dusk, five flower colours, four
  ribboned bells) on round white plates, readable at iPad size in Classic and Halloween.
- Each puzzle object carries a big number badge: lanterns 1-2-3, flower pots 1-4 (left to right),
  bells numbered by the songbird's tune (they pulse as she sings). A badge turns green with a check
  when its step is done, shakes red on a wrong step, and resets with the puzzle.
- Clue signs open with a row of big icon + number cards above the text (e.g. 1 dawn, 2 noon,
  3 dusk); cards already done show green with a check. The lantern HUD shows 1-2-3 too.
- The moon tiles and the dig spot are not ordered puzzles, so they have no numbers.
- Test: `tests/seq.spec.ts` (part of `playwright.touch.config.ts`).
