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

### Controls
- **WASD / Arrow keys**: walk (8 directions)
- **E / Space / Enter**: interact, and advance dialog

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
- Font: Nunito (SIL Open Font License 1.1) is bundled in `public/fonts/`.

## Layout
- `src/art.ts`: procedural painters (ground, trees, cottage, player, FX) and the atlas packer
- `src/layout.ts`: world layout (positions of the pond, paths, lanterns and gate)
- `src/audio.ts`: WebAudio synth (bells, fizzle, sparkle, birdsong)
- `src/scenes/World.ts`: gameplay, camera, puzzle and ambience
- `src/scenes/UI.ts`: HUD, prompts, dialog and toasts
