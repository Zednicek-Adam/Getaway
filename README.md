# The Getaway

A pixel-art Wild West getaway game. You ride an outlaw's paint horse through a
procedurally generated railroad cow town and the open range around it, with its
river, mountains, mesas, desert and prairie. You grab gold along the streets and
trails and stash it at your hideout before the posse runs you down.

Built with [Phaser 3](https://phaser.io/) and [Vite](https://vite.dev/).

**Play it:** https://zednicek-adam.github.io/Getaway/

| | |
| --- | --- |
| ![Title screen](docs/screenshots/title.png) | ![A five-badge chase](docs/screenshots/chase.png) |
| ![The general store](docs/screenshots/garage.png) | ![How to play](docs/screenshots/instructions.png) |

## The loop

Gold you pick up is **loot** in your saddlebags, not money earned. Loot is lost
when the posse catches you. It only counts once you ride it back to your
hideout (the gold `$` pad) and stash it.

Every pickup raises your **heat**, and heat earns you sheriff's badges on the
WANTED poster:

| Badges | Response |
| ------ | -------- |
| 0 | Nobody's looking for you |
| 1–2 | Deputies ride you down when you're close, otherwise head for where you were last seen |
| 3 | Three deputies riding straight at you |
| 4 | The marshals' prison wagon joins; barricades go up ahead of you |
| 5 | A second wagon and an army observation balloon that pins you in its limelight and slows you down |

Stashing your loot ends the chase immediately. Otherwise the chase runs on a
20-second countdown that refuses to tick below 25% while a deputy can see you.
You have to actually break line of sight, not just outlast it. Once the chase
ends, badges fade one every five seconds. The posse fires warning shots into
the air while they ride; the shots are only for show.

Your stash persists between runs in `localStorage` and is spent at the general
store.

### Losing

You have three lives (the spare hats on the HUD). You lose one when the posse
tackles you down to your last heart of **grit** (three tackles by default) or
when your horse runs out of **stamina**. Either way, your loot is gone.

Your horse tires as it runs. Rein in anywhere and it slowly gets its wind back;
stop at a water trough (the blue pads) and it drinks its fill in a few seconds.

## Controls

| Key | Gamepad | Action |
| --- | ------- | ------ |
| Arrows / WASD | D-pad / left stick | Steer (queues up to 2 turns ahead) |
| `F` | A | Rein in: hold position and rest, or drink when parked at a trough |
| `Space` | B / LT | Light a bundle of dynamite (10s fuse, blows up the posse) |
| `E` | X / RT | Throw a lasso along your facing, up to 6 tiles |
| `G` | Y | Open the general store (only while parked on the hideout pad) |
| `Esc` | Start | Pause |

Gamepad buttons follow the Xbox layout; on a PlayStation pad A is Cross, B
Circle, X Square and Y Triangle. The pad also drives every menu: D-pad or stick
to move, A to pick, B to back out. Any controller the browser exposes through
the standard Gamepad API works, and the browser only reveals it after a button
press, so press one first if it doesn't respond. On-screen prompts switch to pad
buttons once a controller is connected.

Touch devices can swipe to steer. A HOW TO PLAY page shows this same summary
in-game, reachable from both the title screen and the pause menu; opening it
from pause leaves the run paused and returns you there. The pause menu can also
drop you back to the title screen.

Your horse runs on its own and follows the trail round a bend; you only pick
the way at forks. It stops at a fork (or the hideout) until you steer. Because
turns are buffered, you can line up a sequence through a junction before you
reach it.

## Language

The game is in English and Spanish. The LANG / IDIOMA button on the title screen
switches between them. The choice is saved in `localStorage`; on a first visit
the game picks Spanish if the browser's language is Spanish. All on-screen text
lives in `src/i18n.js`. Spanish drops the accent on capital vowels (Á, É, Í, Ó,
Ú), because the pixel font's accented capitals look like lower case. Ñ, ¡ and ¿
are kept.

## Pickups

Gold is the bulk of what turns up on the streets and trails; the rest is rarer.

| Sprite | Pickup | Effect |
| ------ | ------ | ------ |
| spinning gold `$` coin | Gold | +$100 loot, +1 heat |
| green bottle, red cross | Snake oil | Heals one heart of grit |
| carrot | Carrot | Your horse gallops ~1.5× faster for 4 seconds |
| coiled rope | Lasso | +1 lasso |
| red sticks, lit fuse | Dynamite | +1 bundle |
| cowboy hat | Stetson | +1 life, capped at 5 |
| purple ticket token | Rail pass | Ride the rails on a handcar once (only appears after the store unlock) |

There is also a **stagecoach** (red and gold, a strongbox on its roof) rolling
around the map. Ride into it to rob it of $1,000, but it costs you two badges on
the spot.

A lasso that catches a deputy yanks him out of the saddle (his hat goes flying)
and he's out of the chase until a replacement rides in. The marshals' wagon
shrugs off the first rope. A lasso that lands on a barricade pulls it apart.

## The railroad

A railroad loops around the map, about nine tiles in from the edges, and one
steam train runs it nonstop at twice the base speed of your horse. The corners
are cut at 45 degrees, so the loop is an octagon. The town stands inside it,
against the bottom of the loop. Its Front Street runs along the tracks and the
depot faces it. The river runs over the loop on two timber trestles.

Roads only cross the track at **planked crossings**, each marked with a
crossbuck sign. There are no signal lamps; it's the 1880s. Three seconds before
the train reaches a crossing, the engineer blows the whistle, the crossing
keeper runs out waving his red flag, and the gates swing down. They stay down
until the last car has cleared. Anything the moving train runs into is wrecked:

| Hit | Result |
| --- | ------ |
| You | A life and your loot, whatever your grit |
| Deputies / marshals' wagon | Out of the chase, replaced after the usual delay |
| Stagecoach | Smashed; the strongbox is left on the road for you to grab |

The posse never rides through lowered gates, and while they're held on the
other side of the loop they can't see you. Cross just before the train and the
chase countdown keeps running down while they wait or look for another way
round.

**Rail pass.** A one-time store unlock ($3,000) adds rail passes to the pickups.
With one in hand, turn off a crossing onto the track: the pass is spent, the
outlaw jumps onto a pump handcar that follows the rails on its own, and no one
in the posse can follow you. Turn onto the road at any crossing to get off.
Getting back on takes another pass. The train is on the same loop, so watch the
loop map in the top-right corner. The posse waits for you beside the crossings
ahead.

**Express car heist.** The train stops at the depot (the purple pad beside the
track) every lap. Every third lap the vault in its green express car is open for
eight seconds. Park on the platform pad and each second pays $250 loot and adds
1 heat. Staying the whole eight seconds is $2,000 and three badges.

## The general store

Park on the hideout pad and press `G`. Five upgrade tracks, three levels each,
costing $500 / $1,500 / $4,000 out of your stash:

| Track | Level 0 → 3 |
| ----- | ----------- |
| Steed | 300ms → 225ms per tile |
| Stamina | 100 → 200 |
| Grit | 3 → 6 hearts |
| Dynamite | 3 → 6 bundles |
| Lassos | 2 → 5 lassos |

Upgrades apply mid-run and persist across runs. Below the tracks is the one-time
**rail pass** unlock ($3,000), which makes rail passes turn up on the roads.

## Running it locally

Requires Node 20+.

```bash
npm install
npm run dev      # dev server
npm run build    # production build into dist/
npm run preview  # serve the built output
npm test         # vitest unit tests
```

Note that `vite.config.js` sets `base: '/Getaway/'` for GitHub Pages, so the dev
server and preview serve the game at `/Getaway/` rather than `/`. Vite prints the
full URL on startup.

## How the map is built

`FrontierGenerator` lays the map out in order, on top of the railroad loop:

1. **The town**, a surveyed grid against the bottom of the loop. Front Street
   runs along the tracks, the way Dodge City faced the Santa Fe, with parallel
   streets up the hill and cross streets between them. The hideout is a dead-end
   lane off the top street.
2. **The river** runs from one map edge to another. It passes over the loop on
   two trestles, bends north of town, and is routed by A* over a noise field so
   it meanders.
3. **Level crossings.** The town's cross streets carry on over the tracks, and
   each other side of the loop gets a few crossings, clear of the trestles.
4. **Mountain ranges** along one or two map edges, with the big peaks in the
   middle of the range and one kind of rock per range. **Mesas and buttes**
   stand alone out on the range.
5. **Wagon trails.** Waypoints go on a jittered grid over the open range, and a
   Gabriel graph links them with the town's gates and the crossings: the spanning
   edges first, so everything is reached, then most of the rest for loops. Each
   edge is routed by A* that winds round rough ground and mountain feet, never
   runs alongside another trail, and crosses the river only on a bridge, square
   to the current. Trails that came to nothing are pruned, so the hideout lane
   is the only dead end.

`MapManager` then places the hideout, the depot (on Front Street, beside a
straight stretch of track clear of crossings) and three water troughs on
reachable, well-spaced pads. A roll that keeps fewer than five crossings is
re-rolled, up to 50 times.

The logic grid only knows *road* and *not road*. Two Phaser-free modules decide
what it looks like:

- `cityLayout.js` dresses the town. Street cells pick one of 47 autotiles from
  their neighbours, boardwalks included, so the buildings behind them pack wall
  to wall. The blocks between Front Street and Main Street are false fronts:
  saloon, bank, hotel, jail, barber, gunsmith, opera house and the rest, each
  business with its own lettered sign and one bank or jail to a town. Stock pens
  and freight sheds stand at the ends by the railroad. The next blocks up hold
  the trades (smithy, livery, feed store, wagon yards), then homesteads, a
  church and the schoolhouse up the hill, with one block kept as the town
  common.
- `landLayout.js` draws everything past the edge of town. The ground is sand or
  dry grass, chosen per tile *corner* from a broad noise field, so desert and
  prairie drift across the map in natural shapes; the river keeps its banks
  green. Over it lie the trails, the bridges, homesteads and ranches beside the
  trails (a mine at a mountain's foot, Boot Hill near town, an adobe mission in
  the desert), and a scatter of saguaros, prickly pear, sagebrush, cottonwoods
  and boulders. Mountains and mesas are sprites standing on the footprints the
  generator kept clear.

It is all purely cosmetic and never feeds back into gameplay.

## Art

All pixel art is generated by code, so it can be tweaked and reproduced:

```bash
pip install pillow numpy
python tools/generate_art.py
```

This rewrites every PNG in `public/art/`, `public/favicon.png`, and the tile/frame
manifest in `src/generated/art.json`. The output is deterministic. Re-running it
without changes produces byte-identical files, so only real art changes show up
in a diff.

Everything is drawn at 1 art pixel = 1 image pixel from one shared palette, then
scaled with nearest-neighbour: 2× for the world (a 32px art tile is the game's
64px tile) and 4× for the title-screen backdrop. The game runs with Phaser's
`pixelArt` mode on, so nothing is ever smoothed.

| Module | Draws |
| ------ | ----- |
| `pixelkit.py` | canvas helpers: shapes, outlines, bevels, dithering, RotSprite rotation |
| `art_city.py` | the town tileset: dirt streets with boardwalks, homesteads, freight and stock pens, the commons |
| `art_town.py` | Main Street's false fronts with lettered signs, the church, the schoolhouse, the water tower |
| `art_land.py` | the open range: terrain blends, the river, trails and bridges, cacti and scrub, ranches and homesteads, mountain and mesa sprites |
| `art_sprites.py` | riders with a four-phase gallop, wagons, the handcar, the balloon, pickups, props, effects, HUD icons, UI panels |
| `art_menu.py` | the title screen's sunset parallax (sky, mesas, town, trail), side-on galloping riders, the logo |
| `art_rail.py` | track tiles drawn from the loop's geometry, trestles, crossings with their gates and keeper, the steam train, the depot |

Mount sheets hold one row of LEFT / UP / RIGHT / DOWN frames per gait phase, and
a move steps through a whole stride per tile, so the legs keep time with the
speed. The outlaw's sheet also carries the handcar: two pump phases of eight
headings.

## Names in the code

The rules kept the names they were written with, so save files from before the
Western overhaul still load and the tests still read the same. On screen:

| In the code | In the game |
| ----------- | ----------- |
| `Car`, `playerCar` | the outlaw on horseback (a handcar on the rails) |
| `PoliceCar`, police | a deputy of the posse |
| `SwatVan`, SWAT | the marshals' prison wagon |
| `Helicopter` | the army observation balloon and its limelight |
| `DiamondCar`, diamond | the stagecoach and its strongbox |
| `Roadblock` | a posse barricade |
| `Bomb`, bombs, `bombBay` | dynamite |
| `Rocket`, rockets, `rocketRack` | lassos |
| nitro | a carrot gallop |
| fuel, `fuelTank`, fuel stations | stamina, water troughs |
| armor, damage | grit (hearts) |
| engine | steed |
| banked / carried | stash / loot |
| stars | sheriff's badges |
| safehouse, base | the hideout |
| station, bullion | the depot, the express car |
| `GarageScene` | the general store |

## Layout

```
src/
  config.js         all gameplay tunables in one object
  constants.js      tile size, map dimensions, tile/direction enums
  art.js            asset keys, frame indices and shared animations
  cityLayout.js     cosmetic town dressing: street autotiles, districts, lots
  landLayout.js     cosmetic open range: terrain, river, trails, scrub, homesteads, mountains
  fx.js             one-shot effects (explosions, dust, gunsmoke, popups) and tumbleweeds
  gamepad.js        Gamepad API polling, edge detection and per-scene bindings
  i18n.js           every on-screen string in English and Spanish, language switch
  GameState.js      pure run state — money, lives, stamina, badges, grit
  garage.js         upgrade pricing and derived-stat math
  storage.js        versioned localStorage save with sanitising loader
  pathfinding.js    BFS used by the posse AI
  railway.js        the loop's geometry and the train's schedule and occupancy
  turnQueue.js      the buffered-turn queue
  generators/       FrontierGenerator: town, river, mountains, crossings, trails
  managers/         Input, Map, Police, Rail, UI
  objects/          Car, PoliceCar, SwatVan, Helicopter, DiamondCar,
                    Collectible, Bomb, Rocket, Roadblock, Train, LevelCrossing
  scenes/           Boot, Menu, Game, Pause, Garage, Instructions
  ui/               shared look: pixel text, 9-slice plank panels, button menus
  generated/        art.json manifest written by tools/generate_art.py
test/               vitest suites for the Phaser-free modules
tools/              the pixel-art generator (Python)
```

The design splits Phaser-dependent rendering from plain-JS game logic. Anything
holding rules — `GameState`, `garage`, `storage`, `i18n`, `pathfinding`, `turnQueue`, `railway`,
gamepad polling, the collectible weight table, map generation and reachability, town and land layout — imports no Phaser and
is unit tested directly.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs the test
suite, builds, and publishes `dist/` to GitHub Pages. A failing test blocks the
deploy.
