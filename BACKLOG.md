# Willowmere Glade backlog (single source of truth)

Updated: 2026-11-02 1:05 PM (CT). Live: main 5175ad6, https://willowmere-glade.pages.dev (bundle index-Dvyv-eXw.js).
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
| 35 | Mount Style Lab (temporary): Cowboy Cookie + Eagle side by side in 6 art styles (Storybook Watercolor, Bold Cel-Shaded, Painterly Gouache, Soft 3D Clay, Ink and Wash, Hi-Res Pixel Art), big prev/next buttons, swipe, ?stylelab=1&s=<style>. Rapid feedback loop with Walker; never merged to main | Resolved by 47 (Nov 2): the styles are now picked in the game. Was paused (live session ended Oct 30, 12:14 AM CT, by Walker's call). Latest is stylelab dc1a656: cel eagle back to a smooth outline, cookie clean, ink with a subtle pen layer. Open: Walker's style pick, and whether to keep the WG seal on Ink and Wash. Preview https://stylelab.willowmere-glade.pages.dev/?stylelab=1 | 2026-10-29 (preview) | 0.5 + iterations |
| 36 | Wings to capes: remove wings from creatures that aren't naturally winged and give them a flowing cape for the flying effect. Capes: Cowboy Cookie, Chili in a Poncho, Tamale, H-E-Buddy, Chef Concha, Strawberry, Pumpkin, Cloud Puppy, Reindeer, Lantern Snail, Flying Teacup. Keep wings: Bald Eagle, Pterodactyl, Bumblebee, Canada Goose, Snowy Owl, Flamingo, Unicorn (pegasus), Rubber Duck (a bird). No wings and no cape: Magic Carpet (rippling carpet flight), Sky Jellyfish (floating tentacles), Toy Airplane (propeller). Ref: Walker's stable screenshot (Oct 29) | Done/Live 7503511 (2026-10-31). Capes use a gentle built-in ripple + speed lift (reduced motion: still cape); they adopt the 39 motion pick later (reversible, cape.ts) | 2026-10-31 | 1.5 |
| 37 | Mounts page: all mounts on a single page (no paging or scrolling); seasonal mounts are shown like the others (no "???" hiding); riding a seasonal mount forces its theme to load (UX rule) | Done/Live 40a522d (2026-11-01): all 22 stalls on one screen, seasonal friends shown with names + theme badges, riding one switches the glade to its season | 2026-11-01 | 1 |
| 38 | Per-mount view: each flying mount gets its own view with final, very stylized, high-res, high-detail art in the style Walker picks in the Style Lab (35) | Unblocked (Nov 2): 35 and 39 resolved by 47-49; final art follows whatever style Walker settles on in the in-game picker | ~2026-11-09 (after style pick) | 6 |
| 39 | Mount Motion Lab (temporary): Cowboy Cookie + Eagle side by side, 7 whole-body animation styles (Gentle Float, Springy Squash & Stretch, Floaty Dreamy Drift, Snappy Cartoon, Natural Physics, Playful Bounce, Storm Jitters), each with its own procedural soundscape (Meadow Lullaby, Boing Pulse, Starlit Pond, Toybox Tick-Tock, Open Sky, Hop Parade, Thunderstorm) that crossfades on flips, with bounces synced to the beat and the storm flinch synced to thunder, plus a Tap for sound/mute chip (Walker, 9:22 PM CT); exaggerated, distinct amplitudes and rhythms; with breathing, blinks/glances, head tilts, hat lag, cape follow-through, tail/talon sway, banking, personality beats, rider-weight dip; any Style Lab skin; Calm (prefers-reduced-motion) fallback; ?motionlab=1&m=<id>. Walker (Oct 29, 9:00 PM CT): keep the Style Lab around. The chosen motion applies to all mounts in 36 and 38. Never merged to main | Resolved by 48-49 (Nov 2): motions + soundscapes are now picked in the game (or by the weather). Was paused (live session ended Oct 30, 12:14 AM CT). Open: Walker's motion and soundscape pick, and re-recording motionlab video and contact sheet with the smooth cel outline. Preview https://stylelab.willowmere-glade.pages.dev/?motionlab=1 | 2026-10-29 (preview) | 0.5 + iterations |
| 40 | Walker (Oct 29, 9:18 PM CT): Mount Thief event (replayability, re-hides mounts). A button triggers it: a thief animal (random species each time) in a cartoony thief mask enters the screen, big and easy to see. The player can arrest it just in time with a simple, kid-friendly tap/chase mechanic (no combat). If it escapes, it takes one owned mount and runs off to hide it as the prize behind one randomly chosen existing puzzle; even a completed puzzle is reset so the player can rescue the mount | Done/Live ef26685 (2026-11-01): mask button by the camera; 6 masked thieves (Raccoon, Fox, Bunny, Mouse, Kitty, Piglet), never the same twice in a row; 3 taps in ~12 s to catch it (cage drops, it says sorry); if it escapes it takes one owned friend (never the theme's own ride) and hides it behind a random puzzle (solved ones first), which resets; star-sack marker by that chest; open the chest to rescue; stable stall says where it's hidden; survives reload | 2026-11-01 | 2 |

## Walker's Nov 2 request: Looks & Moves in the game (2:45 PM CT)

Walker: "lets bring in the style picker to the game, give me a clean interface where we can use arrow buttons to 'scroll' through the different styles so that we dont have to put all on the screen, similar with the motion/soundscape, also let the weather patterns in the top game loop to also select the motion/soundscape so that weather and motion matches by default". This resolves 35 and 39 (Walker picks in the game instead of in the labs; the lab previews stay up) and unblocks 38.

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 47 | In-game Art Style picker: Stable > "Looks & Moves", big ◀ ▶ arrows cycle one style at a time (Classic Glade + the Style Lab's six), shows the name, a preview, and dots; the pick restyles the flying friend you ride and is saved. WG seal on Ink and Wash unchanged (Walker undecided) | In progress (wip/pickers) | 2026-11-02 | 1 |
| 48 | In-game Motion & Sound picker: same arrow control over the Motion Lab's 7 motions, each with its soundscape (plays while flying or while the picker is open; theme music ducks); the flying friend bobs, sways, glides and ripples its cape in that motion | In progress (wip/pickers) | 2026-11-02 | 1 |
| 49 | Weather picks the motion by default: "Auto (weather)" is the first entry and the default; the village weather picks the matching motion + soundscape (mapping documented in src/looks/looks.ts); a hand pick overrides and is saved; "Match weather" goes back to Auto | In progress (wip/pickers) | 2026-11-02 | 0.5 |

## Self-added polish (2026-11-01; backlog had only Walker-blocked items left; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 41 | Thief thank-you: a caught thief leaves a little thank-you snack (berries) before it goes | Done/Live 35ec13e (2026-11-01; verified in live bundle 2026-11-02) | 2026-11-01 | 0.25 |
| 42 | Thieves caught tally: the stable header shows how many sneaky thieves you've caught | Done/Live 3985950 (2026-11-01; verified in live bundle 2026-11-02) | 2026-11-01 | 0.25 |
| 43 | Paw-print trail: a thief that escapes leaves fading paw prints as it runs off | Done/Live 275245d (2026-11-02, bundle index-DMUwkfFH.js) | 2026-11-02 | 0.25 |

## Self-added polish (2026-11-02; only Walker-blocked items left; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 44 | Whoosh loop-de-loop: tapping your flying friend for a whoosh starts with a happy full loop (rider spins too; skipped under reduced motion) | Done/Live 5175ad6 | 2026-11-02 | 0.25 |
| 45 | Goodbye hearts: when you hop off, your flying friend says "Bye bye!" with a puff of hearts | Done/Live 5175ad6 | 2026-11-02 | 0.25 |
| 46 | Thief giggles: a not-yet-caught thief giggles a cheeky line ("Hee hee!", "Nope!", "Too slow!") as it scampers off | Done/Live 5175ad6 | 2026-11-02 | 0.25 |

## Recently done

- 21: Real-iPad FPS check and tuning. Done 2026-10-27, Walker said the playtest went OK.
- 22: Per-theme chimes. Live 497f538.
- 23: Photo mode camera button. Live 592b1af.
- 24: Wild Woods critters cheer when the carrier is found. Live 55c13e6.
- 25: Idle villager stretch/yawn/wave. Live 9dc3d3b.
- Earlier tasks (1 to 20, 11.x to 13.2): shipped, see /workspace/fleet/archive/notion/ (read-only archive) and /workspace/resources/willowmere-glade/log.md.

Session log: /workspace/resources/willowmere-glade/log.md
