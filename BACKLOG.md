# Willowmere Glade backlog (single source of truth)

Updated: 2026-10-29 8:55 PM (CT). Live: main ae971fc, https://willowmere-glade.pages.dev (bundle index-C62BSV5A.js).
Rules: each open task has Status, ETA live and Estimate (dev days). Walker's real-device iPad tests never block work (he gives play feedback voluntarily).

## Open tasks

Task 34 is Walker's request (Oct 29, 7:46 PM CT). Self-added polish tasks (26-29 on 2026-10-28, 30-33 on 2026-10-29; backlog was empty; no Walker decision or spending needed).

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 26 | Tap your hero: a happy hop / twirl / hearts with sparkles and a giggle | Done/Live 80fd110 | 2026-10-28 | 0.25 |
| 27 | Idle hum: stand still a while and little music notes float up from your hero | Done/Live be806f0 | 2026-10-28 | 0.25 |
| 28 | Dandelion puffs in the meadows: tap to blow seeds away on the breeze (they grow back; not in Winter) | Done/Live af05273 | 2026-10-28 | 0.5 |
| 29 | Winter snow footprints: your hero leaves little prints in the snow that slowly fade | Done/Live 17ba132 | 2026-10-28 | 0.25 |
| 30 | Snow angels: in Winter/Christmas, tapping your hero adds a snow angel to the joy moves (lie back, flap, a fading angel shape) | Done/Live cff0a3a | 2026-10-29 | 0.25 |
| 31 | Rain puddles: on rainy days (Spring rain, Summer sun shower) little puddles appear in the glade; walk through for a splash; they dry up after | Done/Live ff6632a | 2026-10-29 | 0.5 |
| 32 | Windy-day kite: on Fall windy days your hero flies a little kite; tap it for a loop-de-loop | Done/Live 186e93d | 2026-10-29 | 0.5 |
| 34 | Walker: three new flying figurine mounts (Tamale, H-E-Buddy, Chef Concha) with stable stalls, picker tiles, lunchbox treasures and ride effects | Done/Live ae971fc | 2026-10-29 | 0.5 |
| 33 | Garden pinwheels: colorful pinwheels in the glade spin in the breeze, faster when you walk past or tap them (not in snowy themes) | Done/Live 080ebfa | 2026-10-29 | 0.25 |

## Walker's Oct 29 mount requests (t75u, 8:35 PM CT)

Walker: flying mounts, and finding them, score high on engagement; wardrobe-style treasures score low. Lean on the flying mounts for now.

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 35 | Mount Style Lab (temporary): Cowboy Cookie + Eagle side by side in 6 art styles (Storybook Watercolor, Bold Cel-Shaded, Painterly Gouache, Soft 3D Clay, Ink and Wash, Hi-Res Pixel Art), big prev/next buttons, swipe, ?stylelab=1&s=<style>. Rapid feedback loop with Walker; never merged to main | In progress, live on branch preview https://stylelab.willowmere-glade.pages.dev/?stylelab=1 | 2026-10-29 (preview) | 0.5 + iterations |
| 36 | Wings to capes: remove wings from creatures that aren't naturally winged and give them a flowing cape for the flying effect. Capes: Cowboy Cookie, Chili in a Poncho, Tamale, H-E-Buddy, Chef Concha, Strawberry, Pumpkin, Cloud Puppy, Reindeer, Lantern Snail, Flying Teacup. Keep wings: Bald Eagle, Pterodactyl, Bumblebee, Canada Goose, Snowy Owl, Flamingo, Unicorn (pegasus), Rubber Duck (a bird). No wings and no cape: Magic Carpet (rippling carpet flight), Sky Jellyfish (floating tentacles), Toy Airplane (propeller). Ref: Walker's stable screenshot (Oct 29) | Not started | 2026-10-31 | 1.5 |
| 37 | Mounts page: all mounts on a single page (no paging or scrolling); seasonal mounts are shown like the others (no "???" hiding); riding a seasonal mount forces its theme to load (UX rule) | Not started | 2026-10-31 | 1 |
| 38 | Per-mount view: each flying mount gets its own view with final, very stylized, high-res, high-detail art in the style Walker picks in the Style Lab (35) | Blocked on 35 (style choice) | ~2026-11-09 (after style pick) | 6 |

## Recently done

- 21: Real-iPad FPS check and tuning. Done 2026-10-27, Walker said the playtest went OK.
- 22: Per-theme chimes. Live 497f538.
- 23: Photo mode camera button. Live 592b1af.
- 24: Wild Woods critters cheer when the carrier is found. Live 55c13e6.
- 25: Idle villager stretch/yawn/wave. Live 9dc3d3b.
- Earlier tasks (1 to 20, 11.x to 13.2): shipped, see /workspace/fleet/archive/notion/ (read-only archive) and /workspace/resources/willowmere-glade/log.md.

Session log: /workspace/resources/willowmere-glade/log.md
