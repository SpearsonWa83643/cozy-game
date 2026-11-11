# Willowmere Glade backlog (single source of truth)

Updated: 2026-11-11 1:00 PM (CT). Live: https://willowmere-glade.pages.dev (see the latest Done row for merge and bundle).
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
| 35 | Mount Style Lab (temporary): Cowboy Cookie + Eagle side by side in 6 art styles (Storybook Watercolor, Bold Cel-Shaded, Painterly Gouache, Soft 3D Clay, Ink and Wash, Hi-Res Pixel Art), big prev/next buttons, swipe, ?stylelab=1&s=<style>. Rapid feedback loop with Walker; never merged to main | Resolved by the in-game picker, 47 (Done/Live Nov 2, 9222d84): the styles are now picked in the game. Was paused (live session ended Oct 30, 12:14 AM CT, by Walker's call). Latest is stylelab dc1a656: cel eagle back to a smooth outline, cookie clean, ink with a subtle pen layer. Open: Walker's style pick, and whether to keep the WG seal on Ink and Wash. Preview https://stylelab.willowmere-glade.pages.dev/?stylelab=1 | 2026-10-29 (preview) | 0.5 + iterations |
| 36 | Wings to capes: remove wings from creatures that aren't naturally winged and give them a flowing cape for the flying effect. Capes: Cowboy Cookie, Chili in a Poncho, Tamale, H-E-Buddy, Chef Concha, Strawberry, Pumpkin, Cloud Puppy, Reindeer, Lantern Snail, Flying Teacup. Keep wings: Bald Eagle, Pterodactyl, Bumblebee, Canada Goose, Snowy Owl, Flamingo, Unicorn (pegasus), Rubber Duck (a bird). No wings and no cape: Magic Carpet (rippling carpet flight), Sky Jellyfish (floating tentacles), Toy Airplane (propeller). Ref: Walker's stable screenshot (Oct 29) | Done/Live 7503511 (2026-10-31). Capes use a gentle built-in ripple + speed lift (reduced motion: still cape); they adopt the 39 motion pick later (reversible, cape.ts) | 2026-10-31 | 1.5 |
| 37 | Mounts page: all mounts on a single page (no paging or scrolling); seasonal mounts are shown like the others (no "???" hiding); riding a seasonal mount forces its theme to load (UX rule) | Done/Live 40a522d (2026-11-01): all 22 stalls on one screen, seasonal friends shown with names + theme badges, riding one switches the glade to its season | 2026-11-01 | 1 |
| 38 | Per-mount view: each flying mount gets its own view with final, very stylized, high-res, high-detail art in the style Walker picks in the Style Lab (35) | Done/Live 2026-11-04 (merge dbfdefb, live index-Vzl54n7p.js). Sky View: wing button while riding opens each mount's own top-down flying view (74 art, Looks & Moves style, own sky, trail, rhythm; tap = whoosh + barrel roll; Land returns to ride) | Live | 6 |
| 39 | Mount Motion Lab (temporary): Cowboy Cookie + Eagle side by side, 7 whole-body animation styles (Gentle Float, Springy Squash & Stretch, Floaty Dreamy Drift, Snappy Cartoon, Natural Physics, Playful Bounce, Storm Jitters), each with its own procedural soundscape (Meadow Lullaby, Boing Pulse, Starlit Pond, Toybox Tick-Tock, Open Sky, Hop Parade, Thunderstorm) that crossfades on flips, with bounces synced to the beat and the storm flinch synced to thunder, plus a Tap for sound/mute chip (Walker, 9:22 PM CT); exaggerated, distinct amplitudes and rhythms; with breathing, blinks/glances, head tilts, hat lag, cape follow-through, tail/talon sway, banking, personality beats, rider-weight dip; any Style Lab skin; Calm (prefers-reduced-motion) fallback; ?motionlab=1&m=<id>. Walker (Oct 29, 9:00 PM CT): keep the Style Lab around. The chosen motion applies to all mounts in 36 and 38. Never merged to main | Resolved by the in-game pickers, 48-49 (Done/Live Nov 2, 9222d84): motions + soundscapes are now picked in the game (or by the weather). Was paused (live session ended Oct 30, 12:14 AM CT). Open: Walker's motion and soundscape pick, and re-recording motionlab video and contact sheet with the smooth cel outline. Preview https://stylelab.willowmere-glade.pages.dev/?motionlab=1 | 2026-10-29 (preview) | 0.5 + iterations |
| 40 | Walker (Oct 29, 9:18 PM CT): Mount Thief event (replayability, re-hides mounts). A button triggers it: a thief animal (random species each time) in a cartoony thief mask enters the screen, big and easy to see. The player can arrest it just in time with a simple, kid-friendly tap/chase mechanic (no combat). If it escapes, it takes one owned mount and runs off to hide it as the prize behind one randomly chosen existing puzzle; even a completed puzzle is reset so the player can rescue the mount | Done/Live ef26685 (2026-11-01): mask button by the camera; 6 masked thieves (Raccoon, Fox, Bunny, Mouse, Kitty, Piglet), never the same twice in a row; 3 taps in ~12 s to catch it (cage drops, it says sorry); if it escapes it takes one owned friend (never the theme's own ride) and hides it behind a random puzzle (solved ones first), which resets; star-sack marker by that chest; open the chest to rescue; stable stall says where it's hidden; survives reload | 2026-11-01 | 2 |

## Walker's Nov 2 request: thief carries mounts, cells, multi-steal (7:49 PM CT)

Walker: "For immediate implementation: When the thief steals a mount you should see the thief 'carrying' away the mount, similarly whe re rescuing the mount, the mount should be visible in a cell instead of the chest, also randomly the thief can take more than one mount"

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 51 | Thief visibly carries the stolen friend(s) on its back as it runs off (bobbing, wobbling, cute) | Done/Live (merge 987f14e, bundle index-87rzwmXe.js) | 2026-11-02 | 0.25 |
| 52 | Stolen friend waits in a friendly cell (red roof, wooden bars, gold heart padlock) beside its hiding puzzle instead of the star sack; locked until the puzzle is solved, then tap the cell (or open the chest, reward kept) for a happy burst and the friend hops home | Done/Live (merge 987f14e, bundle index-87rzwmXe.js) | 2026-11-02 | 0.25 |
| 53 | Multi-steal: 20% two friends, 5% three (when that many are stealable), each behind a different puzzle with its own cell; dialog, toasts, stable hint, Call Mount and the "Rescue ... first!" hint list them all; save.stolen becomes a list (old single saves migrate) | Done/Live (merge 987f14e, bundle index-87rzwmXe.js) | 2026-11-02 | 0.25 |

## Walker's Nov 2 backlog request: thief jail + more thieves (8:09 PM CT)

Walker: "For the backlog: make a jail for the thieves like the stable where the player can see and interact with them, thieves can from time to time escape the jail, also add several more thief characters"

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 54 | Thief Jail page, like the stable: every caught thief gets its own cozy cell on one screen (name, species, times caught); tap a thief to interact (cheeky line, sulk/wave, says sorry, you can hand it a berry); kid-friendly, no scary bits; caught thieves move here instead of vanishing | Done/Live (merge ede56f9, bundle index-CDMrnc7u.js) | 2026-11-04 | 1 |
| 55 | Jailbreaks: from time to time a jailed thief sneaks out (dug tunnel / unlocked padlock, with a cheeky toast); it comes back later as a thief event you can catch again; never more than one escape per play session, and never while another thief is active | Done/Live (merge 21e2523, bundle index-CwO0Aj7D.js) | 2026-11-05 | 0.5 |
| 56 | Several more thief characters (e.g. Squirrel, Hedgehog, Otter, Skunk, Possum, Badger, Duckling) with their own masks, colors, voices and giggle lines; added to the random pick and the jail | Done/Live (merge 4ffc719, bundle index-7KkAxWI3.js) | 2026-11-04 | 0.5 |
| 57 | Big rescue clue card (Walker, 8:18 PM CT: "When tapping the kidnapped mount, the clue has the highest motivation to read it, simplify the clue wording so it is more basic and put the clue big and center in the screen and no timeout for the clue text this helps with reading"): stolen stable stall, locked cell, Call Mount and the mask button's "Help ... first!" all open one big centered card in early-reader words ("Your Unicorn is in a cell. Go to the flower pots. Solve it. Tap the cell."), one line per friend with its picture and a puzzle icon; no timeout, closes with a tap or OK | Done/Live (merge 4ffc719, bundle index-7KkAxWI3.js) | 2026-11-02 | 0.25 |
| 58 | Remove the "ding" bell when village workers deliver resources (Walker, 10:20 PM CT); keep the floating +N pop, no replacement sound | Done/Live (merge cffe2a5, bundle index-BsgJQG_X.js) | 2026-11-03 | 0.1 |
| 59 | Looks & Moves Apply button (Walker, 10:20 PM CT): arrows only preview; a big Apply commits art style + motion/soundscape (or Auto weather) for the whole game (riding, called mount, stable stalls, thief's sack, jail cells, clue card), saved; "Applied!" feedback and an "Applied ✓" state; leaving without Apply keeps the old choice | Done/Live (merge cffe2a5, bundle index-BsgJQG_X.js) | 2026-11-03 | 0.5 |
| 60 | Bunny thief ears cut off (Walker, 10:20 PM CT): give thief art headroom so long ears / tufts are fully drawn in the event, lineup, jail and clue card | Done/Live (merge cffe2a5, bundle index-BsgJQG_X.js) | 2026-11-03 | 0.2 |
| 61 | Thief art + motion polish for all 13 thieves (Walker, 10:22 PM CT): richer detail (fur shading, highlights, mask texture, swag sack, striped shirt, expressive eyes/brows) and livelier motion (tiptoe run cycle, squash/stretch, tail/ear follow-through, over-the-shoulder looks, startled hop on tap, happier sorry pose when caught); cute, iPad-friendly | Done/Live 1cfd985 | 2026-11-03 | 1 |
| 62 | Thief approach anticipation (Walker, 10:22 PM CT): ~4-8 s before a thief appears, nearby bushes rustle with flying leaves, glowing eyes blink in a bush/shadow, a shadow darts; soft leaf rustles, twig snap, tiptoes/giggle; for every thief event (mask button, jailbreak returns); the thief comes out where the hints were; the 12 s catch window starts only once it appears | Done/Live 1cfd985 | 2026-11-03 | 0.5 |
| 63 | Whole-game art style, quick version (Walker, 10:26 PM CT): the applied Looks & Moves style restyles the whole screen (trees, characters, environment) with a per-style full-screen post-process (Cel: bold outlines + flat bands; Watercolor: paper grain + soft bleed; Ink and Wash: pen hatching; Pixel: posterize/pixelate; Gouache, Clay equivalents); iPad-performant. Walker approved the merge Nov 3, 8:57 AM CT; default stays Classic. Merged in 37a9c27 (bundle index-BBBk82BQ.js) | Done/Live | 2026-11-03 | 1-2 days |
| 64 | World expansion (Walker, 10:36 PM CT): at least 4x the play area, with new regions/biomes to explore, linked to the glade and village | Done/Live aaf75af (2026-11-03, bundle index-C4OojZhA.js): world 4x (glade+village plus Sunflower Meadow, Pinecone Hills, Glowcap Grove, Seashell Bay, trails linking them, clearings kept for 66-67) | 2026-11-09 | 4 |
| 65 | Waypoint fast-travel refinement (Walker, 10:36 PM CT): fly your mount back and forth between key sites (village, stable, jail, each puzzle area) from a map | Done/Live aaf75af (2026-11-03, bundle index-C4OojZhA.js): Fly! button while riding opens a paper world map, 19 big pins (landmarks, Stable, Jail, regions, 7 puzzles), smooth zoom-out flight | 2026-11-10 | 1 |
| 66 | New puzzle sites with simple spelling puzzles (Walker, 10:36 PM CT): same easy feel as today's puzzles (e.g. drag letters to spell CAT, pick the missing letter) | Done/Live 4c4d96f (2026-11-03, bundle index-CXXN330Z.js): two Letter Easels (Sunflower Meadow, Seashell Bay) as Fly map pins and thief hiding spots; tap or drag big letter tiles to spell CAT/SUN/DOG and HAT/BEE/CUP from a picture, gentle hint after a wrong try, no fail state, 3 stars then a chest (ABC Block + ABC scarf / Story Book), free play after | 2026-11-12 | 1.5 |
| 67 | Simple number puzzles (Walker, 10:36 PM CT): single-digit addition and subtraction (count the fruit, pick the answer) at new puzzle sites | Done/Live ee789dc (2026-11-03, bundle index-DhBxEWvW.js): two Counting Boards (Glowcap Grove apples 1+2, 2+3, 4-1 -> Little Abacus; Pinecone Hills stones 3+1, 5-2, 2+4 -> Counting Star) as Fly pins Grove 123 / Hills 123; 4 huge number buttons, tap-to-count, wrong = wiggle + count-along + glowing answer, no fail; thief HIDES num1/num2 | 2026-11-13 | 1 |
| 68 | World feels alive (Walker, 10:36 PM CT): roaming critters, moving villagers, birds, butterflies, swaying foliage and ambient life per region; dynamic and fluid | Done/Live 2fe27f7 (2026-11-03, bundle index-h7ePYiJ1.js; stage 1 7712a84) | 2026-11-14 | 1.5 |
| 69 | Thief Chase mini-game (Walker, 10:36 PM CT): when a thief takes off with a mount you can choose "Chase after", then fly a chosen mount in a top-down vertical scroller and throw nets to catch the thief; very simple controls for a young child. Built on branch wip/thief-chase: Chase it!/Not now offer, mount picker, top-down sky scroller, slide/tap steering, auto bubble nets, stars/berries, soft clouds, Catch meter (4 hits) frees the friends and jails the thief, 50 s timeout falls back to cells + 2 berries; `__cozy.startChase(kind?, mountId?)` | Done/Live | 2026-11-05 | 2 |
| 70 | Thief Chase polish and tuning (Walker, 10:36 PM CT): difficulty, feel, rewards and art pass after 69 lands | Done/Live 281b258 (2026-11-03, bundle index-BDf_P09W.js) | 2026-11-06 | 1 |
| 71 | HUD cleanup + village notice board (Walker, Nov 3 12:17 AM CT): top-left first-puzzle icons only when relevant; resources, 'needs a home' list and golden leaf move off the HUD onto a painted notice board in the village that opens a big kid-friendly panel. Lantern sigils now show only near the lanterns/sign/shrine while the puzzle is unsolved (or once a lantern is lit), flash on the win, then hide; resource bar, snack counter, HUD 'needs a home'/wood alerts and the leaf season picker moved to a painted Village Board east of the village path (red ! when someone needs something; tap opens big panel: Our stuff, Friends need + one-tap fix, Season). Urgent hungry/sleepy/bored alerts stay on the HUD. Merge eab9a8d | Done/Live | 2026-11-03 | 1 |
| 72 | HUD shortcuts (Walker, Nov 3 8:57 AM CT): big HUD buttons that take you straight to the Stable and the Thief Jail | Done/Live 7c57761 (bundle index-BJflq6OX.js) | 2026-11-03 | 0.25 |
| 73 | Looks & Moves behind a settings gear (Walker, Nov 3 8:57 AM CT): a gear in the bottom-left of the Menu's Map tab opens a small panel with the Looks & Moves button (the Fly map is unchanged); shipped together with the 63 merge | Done/Live 37a9c27 (bundle index-BBBk82BQ.js) | 2026-11-03 | 0.25 |
| 74 | Thief Chase top-down art + high-speed flight (Walker, Nov 3 8:57 AM CT): each of the 23 mounts drawn from above with you riding it (wings flap, capes flutter, propeller spins, carpet ripples, jelly pulses), speed lines, cloud parallax, wind particles, motion-blur trail, wing-tip and thief contrails, banking, boosts with camera shake and a zoom pulse (HUD stays still); controls unchanged; the chosen whole-game style also paints the chase world. Merge c9c1542 (bundle index-B7TFVzgY.js) | Done/Live | 2026-11-03 | 1 |

## Walker's Nov 2 request: Sushi figurine mount (6:15 PM CT)

Walker: "For immediate implementation : Add this sushi figurine to the mounts" (photo saved as docs/refs/figurine-sushi.jpg).

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 50 | Sushi Roll Buddy mount from Walker's figurine photo: teal nori roll, bumpy rice rim, orange roe ball + cucumber discs, happy face with blush, orange stubby arms/feet; own treasure (Tiny Chopsticks, Wild Woods lunchbox), stable stall, orange cape, rice/roe ride sprinkles, wobble; works with every Looks & Moves art style and motion | Done/Live (merge ecca2fa, bundle index-Bx7AMpvE.js) | 2026-11-02 | 0.5 |

## Walker's Nov 2 request: Looks & Moves in the game (2:45 PM CT)

Walker: "lets bring in the style picker to the game, give me a clean interface where we can use arrow buttons to 'scroll' through the different styles so that we dont have to put all on the screen, similar with the motion/soundscape, also let the weather patterns in the top game loop to also select the motion/soundscape so that weather and motion matches by default". This resolves 35 and 39 (Walker picks in the game instead of in the labs; the lab previews stay up) and unblocks 38.

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 47 | In-game Art Style picker: Stable > "Looks & Moves", big ◀ ▶ arrows cycle one style at a time (Classic Glade + the Style Lab's six), shows the name, a preview, and dots; the pick restyles the flying friend you ride and is saved. WG seal on Ink and Wash unchanged (Walker undecided) | Done/Live (merge 9222d84, bundle index-BWb9fll5.js) | 2026-11-02 | 1 |
| 48 | In-game Motion & Sound picker: same arrow control over the Motion Lab's 7 motions, each with its soundscape (plays while flying or while the picker is open; theme music ducks); the flying friend bobs, sways, squashes and glides in that motion | Done/Live (merge 9222d84, bundle index-BWb9fll5.js) | 2026-11-02 | 1 |
| 49 | Weather picks the motion by default: "Auto (weather)" is the first entry and the default; the village weather picks the matching motion + soundscape (mapping documented in src/looks/looks.ts); a hand pick overrides and is saved; "Match weather" goes back to Auto | Done/Live (merge 9222d84, bundle index-BWb9fll5.js) | 2026-11-02 | 0.5 |

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

## Self-added polish (2026-11-03; only 38 left, which awaits Walker's style pick; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 75 | More words to spell: six new big picture words (fox, egg, bug, car, owl, pie) join the Letter Easels' free play | Done, live 2026-11-03 12:43 PM CT (merge fe51e97, bundle index-DEYm3tZB.js, 200) | 2026-11-03 | 0.25 |
| 76 | Surprise things to count: Counting Board free play counts a different friendly thing each round (shells, stars, strawberries, little fish, apples, stones) | Done, live by 2026-11-03 1:03 PM CT (merge 5f6dc0b, bundle index-CHBtqbxn.js, 200) | 2026-11-03 | 0.25 |
| 77 | "Over here!": a stolen friend waiting in a cell calls out when you come close (hops, a big "Help! Over here!" bubble, a soft call), so little ones can find it | Done/Live (merge 153c59d, 2026-11-03) | 2026-11-03 | 0.25 |
| 78 | Seashell Bay hermit crabs: little crabs scuttle sideways along the beach, duck into their shells when you walk up, and wave their claws when tapped | Done/Live 2026-11-04 12:40 PM CT (merge 559531f, bundle index-D1fM8Srv.js, 200) | 2026-11-04 | 0.5 |
| 79 | Stuck hidden friend fix + "Free my friends" + last-letter glide + harder chase (Walker, Nov 3 ~7:30-8:13 PM CT): clues name the puzzle and area ("the stepping stones in Mistbirch Wood"), a pink heart on the Map/Fly map marks the cell, broken saved hiding places heal on load, a kid-safe "Free my friends" (Yes/No) in the Map tab's settings gear brings every friend home; the Letter Easel's last letter now glides into its slot before the cheer; Thief Chase ramps up (Walker 8:13 PM CT): each net that lands makes the thief +14% faster and a bit dodgier (capped at 1.8x), with a tiny "Faster!" puff. Live: merge e1c7d01, index-c6VLnB4M.js | Done (live) | 2026-11-03 | 0.5 |

## Self-added polish (2026-11-04; only 38 left, which awaits Walker's style pick; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 80 | Sky rings for flying friends: while you ride, a loop of five glowing star rings floats over the glade; fly through one for a chime and sparkles ("2 of 5!"); all five gives a happy cheer and confetti, then they come back | Done/Live 23b114f (2026-11-04, bundle index-BKM2xl4v.js) | 2026-11-04 | 0.5 |
| 81 | Tide-pool starfish in Seashell Bay: tap the starfish one by one and each shows a big number (1, 2, 3 ...) and says it, so little ones count to five; then they all twirl | Done/Live 9c45b4a (2026-11-04, bundle index-DQQNEbsQ.js) | 2026-11-04 | 0.25 |
| 82 | Fall leaf piles you can walk through: the existing Fall leaf piles now crunch when you walk (or ride) through them, not only on a tap; a bigger leaf burst, the pile lies flat, then gently heaps back up | Done/Live 7d8f40c (2026-11-04, bundle index-BpA5S73F.js) | 2026-11-04 | 0.25 |


## Self-added polish (2026-11-05; backlog empty; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 83 | Pond frogs on lily pads: 3–4 cute frogs on the glade pond; idle bob/blink; tap = hop + croak + splash; hop to a nearby pad occasionally; hidden in snowy themes | Done/Live d8c2441 (final bundle index-DcF6pYyJ.js) | 2026-11-05 | 0.25–0.5 |
| 84 | Village bubble wand: a soap-bubble wand by the village path; tap to blow iridescent bubbles; tap/walk into a bubble to pop with chime + sparkles | Done/Live f13c82f (final bundle index-DcF6pYyJ.js) | 2026-11-05 | 0.5 |
| 85 | Meadow petal swirl: walking or riding through Spring (and Summer) wildflower patches kicks up a short swirl of colored petals that drift and fade | Done/Live 8b1644c (final bundle index-DcF6pYyJ.js) | 2026-11-05 | 0.25 |
| 86 | Beach sandcastle: one Seashell Bay sandcastle; tap to build stages 1→2→3 with a waving flag; tide washes it back down; rebuildable | Done/Live 326cfb3 (bundle index-DcF6pYyJ.js) | 2026-11-05 | 0.25–0.5 |



## Self-added polish (2026-11-06; backlog empty; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 87 | Glowcap fireflies: 5–8 soft glowing fireflies drift and blink in Glowcap Grove; tap one for a bright flash + soft chime + sparkles, then it wanders off; culled off-screen; all themes | Done/Live a29dab9 (bundle index-mKutOg-b.js) | 2026-11-06 | 0.25–0.5 |
| 88 | Village birdbath: small stone birdbath by the village path (near bubble wand); 2–3 little birds splash and chirp on approach/tap, hop away and return; hidden in snowy themes | Done/Live a29dab9 (bundle index-mKutOg-b.js) | 2026-11-06 | 0.25–0.5 |
| 89 | Pinecone tumble: 4–6 tappable pinecones on Pinecone Hills slopes; tap = tumble downhill + soft knocks, respawn after a few seconds; culled off-screen; all themes | Done/Live a29dab9 (bundle index-mKutOg-b.js) | 2026-11-06 | 0.25–0.5 |
| 90 | Meadow dragonflies: 3–4 colorful dragonflies zip along Sunflower Meadow paths; idle hover + dart; tap = loop-de-loop + soft wing chime; culled off-screen; hidden in snowy themes | Done/Live a29dab9 (bundle index-mKutOg-b.js) | 2026-11-06 | 0.25–0.5 |

## Self-added polish (2026-11-07; backlog empty; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 91 | Village wind chimes: hanging chimes by the village path (clear of birdbath/bubble wand); gentle idle sway; tap = cascade of soft notes + sparkles; culled off-screen; hidden in snowy themes | Done/Live c32f5cd (bundle index-BGUurnUu.js) | 2026-11-07 | 0.25–0.5 |
| 92 | Glowcap puff mushrooms: 5 bouncy mushrooms around the Glowcap Grove ring (not the fairy-ring centre); tap = squash/bounce + spore puff + soft pop, then settle; all themes | Done/Live c32f5cd (bundle index-BGUurnUu.js) | 2026-11-07 | 0.25–0.5 |
| 93 | Beach seagulls: 3–4 seagulls on the Seashell Bay shore (clear of crabs/starfish/sandcastle); idle peck/bob; approach or tap = flap away then glide back; hidden in snowy themes | Done/Live c32f5cd (bundle index-BGUurnUu.js) | 2026-11-07 | 0.25–0.5 |
| 94 | Meadow bunnies: 3–4 soft bunnies along Sunflower Meadow paths (clear of dragonflies); idle nibble/hop; approach = hop away, return when far; hidden in snowy themes | Done/Live c32f5cd (bundle index-BGUurnUu.js) | 2026-11-07 | 0.25–0.5 |


## Self-added polish (2026-11-08; backlog empty; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 95 | Village clothesline: colorful laundry on a line near the village (clear of chimes/birdbath/bubble wand); gentle idle sway; tap = flutter + rustle + sparkles; culled; hidden in snowy themes | Done/Live 35a6ff3 (bundle index-CSo7H7aW.js) | 2026-11-08 | 0.25–0.5 |
| 96 | Pond ducks: 3–4 ducks paddling on the glade pond (clear of frogs); idle bob/paddle; tap = quack + splash and paddle away, then return; hidden in snowy themes | Done/Live 35a6ff3 (bundle index-CSo7H7aW.js) | 2026-11-08 | 0.25–0.5 |
| 97 | Hills squirrels: 3–4 squirrels along Pinecone Hills (clear of tumbling pinecones); idle nibble; tap = chatter + tail flick; approach = scamper away and return; hidden in snowy themes | Done/Live 35a6ff3 (bundle index-CSo7H7aW.js) | 2026-11-08 | 0.25–0.5 |
| 98 | Bay minnows: a school of colorful little fish in Seashell Bay shallows (clear of crabs/starfish/sandcastle/gulls); idle swim; tap = scatter then regroup; hidden in snowy themes | Done/Live 35a6ff3 (bundle index-CSo7H7aW.js) | 2026-11-08 | 0.25–0.5 |


## Self-added polish (2026-11-09; backlog empty; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 99 | Meadow ladybugs: 4 ladybugs north of the Sunflower Meadow path (clear of bunnies/dragonflies); idle wiggle; tap = wings open, looping flight, land again + ting; hidden in snowy themes | Done/Live d250a3b (bundle index-CbrzXu3L.js) | 2026-11-09 | 0.25 |
| 100 | Glowcap snails: 3 glowing-shell snails outside the Glowcap fairy ring (clear of puff mushrooms); slow idle creep; tap = tuck into shell, then peek out; all themes | Done/Live d250a3b (bundle index-CbrzXu3L.js) | 2026-11-09 | 0.25 |
| 101 | Village hens: 3 hens peck on the village entry lawn (clear of the sign/board); tap = cluck, flap and hop + feathers; hidden in snowy themes | Done/Live d250a3b (bundle index-CbrzXu3L.js) | 2026-11-09 | 0.25 |
| 102 | Bay turtles: 2 little sea turtles in Seashell Bay's eastern shallows (clear of minnows/gulls/crabs/starfish/sandcastle); idle paddle; tap = swim a lap + splash; hidden in snowy themes | Done/Live d250a3b (bundle index-CbrzXu3L.js) | 2026-11-09 | 0.25 |

## Self-added polish (2026-11-10; backlog empty; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 103 | Village goats: 2 little goats on the grass along the village's south edge (west of the entry path, clear of hens/board; the existing step cat is untouched); idle head-bob; tap = bleat + hop-and-kick; all themes | Done/Live 6f02995 (bundle index-DrObJTv2.js) | 2026-11-10 | 0.25 |
| 104 | Hills sheep: 3 fluffy sheep graze south of the Pinecone Hills path (squirrels are north); tap = soft baa + bounce with wool puffs; all themes | Done/Live 6f02995 (bundle index-DrObJTv2.js) | 2026-11-10 | 0.25 |
| 105 | Lake otters: 2 otters float on their backs on Shellwater Lake's west side (clear of pier and rowboat); tap = playful roll + splash + giggle; hidden in snowy themes (lake freezes) | Done/Live 6f02995 (bundle index-DrObJTv2.js) | 2026-11-10 | 0.25 |
| 106 | Garden mole: a molehill on the lawn south of the cottage garden with the mole's nose peeking out; tap = mole pops up, looks around, ducks back; hidden in snowy themes | Done/Live 6f02995 (bundle index-DrObJTv2.js) | 2026-11-10 | 0.25 |

## Self-added polish (2026-11-11; backlog empty; no Walker decision or spending needed)

| Order | Task | Status | ETA live | Estimate (dev days) |
|---|---|---|---|---|
| 107 | Orchard hedgehogs: 2 hedgehogs snuffle beside the southern orchard path; tap = curl into a spiky ball, roll, uncurl; hidden in snowy themes (hibernating) | Shipping (merge to main today) | 2026-11-11 | 0.25 |
| 108 | Windmill mice: 2 field mice on the grass by the windmill; tap = squeak + happy hop with a crumb; all themes | Shipping (merge to main today) | 2026-11-11 | 0.25 |
| 109 | Riverside beaver: a beaver on the riverbank by the riverside path; tap = tail slap + splash; hidden in snowy themes | Shipping (merge to main today) | 2026-11-11 | 0.25 |
| 110 | Forest fawns: 2 spotted fawns south of the forest path; tap = ears flick + springy leap with hearts; all themes | Shipping (merge to main today) | 2026-11-11 | 0.25 |

## Recently done

- 21: Real-iPad FPS check and tuning. Done 2026-10-27, Walker said the playtest went OK.
- 22: Per-theme chimes. Live 497f538.
- 23: Photo mode camera button. Live 592b1af.
- 24: Wild Woods critters cheer when the carrier is found. Live 55c13e6.
- 25: Idle villager stretch/yawn/wave. Live 9dc3d3b.
- Earlier tasks (1 to 20, 11.x to 13.2): shipped, see /workspace/fleet/archive/notion/ (read-only archive) and /workspace/resources/willowmere-glade/log.md.

Session log: /workspace/resources/willowmere-glade/log.md
