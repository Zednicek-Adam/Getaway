# The Getaway

A pixel-art arcade getaway game. You drive a car through a procedurally
generated city, grab money off the streets, and bank it at your safehouse
before the police shut you down.

Built with [Phaser 3](https://phaser.io/) and [Vite](https://vite.dev/).

**Play it:** https://zednicek-adam.github.io/Getaway/

| | |
| --- | --- |
| ![Title screen](docs/screenshots/title.png) | ![A five-star chase](docs/screenshots/chase.png) |
| ![The garage](docs/screenshots/garage.png) | ![How to play](docs/screenshots/instructions.png) |

## The loop

Money you pick up is **carried**, not earned. Carried money is lost when the
police catch you — it only counts once you drive it back to the safehouse (the
gold `$` pad) and deposit it.

Every pickup raises your **heat**, and heat buys the police stars:

| Stars | Response |
| ----- | -------- |
| 0 | One patrol roaming aimlessly |
| 1–2 | Patrols actively home in on you |
| 3 | Three cars driving straight at you |
| 4 | SWAT van joins; roadblocks start dropping ahead of you |
| 5 | Second SWAT van and a helicopter that slows you from overhead |

Depositing ends the chase immediately. Otherwise the chase runs on a 20-second
countdown that refuses to tick below 25% while a patrol can see you — you have
to actually break line of sight, not just outlast it. Once the chase ends, stars
decay one every five seconds.

Banked money persists between runs in `localStorage` and is spent in the garage.

### Losing

You have three lives. You lose one by taking a full damage bar (three rams by
default) or by running the tank dry. Either way, carried money is gone.

## Controls

| Key | Gamepad | Action |
| --- | ------- | ------ |
| Arrows / WASD | D-pad / left stick | Steer (queues up to 3 turns ahead) |
| `F` | A | Brake — hold position, and refuel when parked on a station pad |
| `Space` | B / LT | Drop a bomb (10s fuse, destroys police) |
| `E` | X / RT | Fire a rocket along your facing, up to 8 tiles |
| `G` | Y | Open the garage (only while parked on the safehouse pad) |
| `Esc` | Start | Pause |

Gamepad buttons follow the Xbox layout; on a PlayStation pad A is Cross, B
Circle, X Square and Y Triangle. The pad also drives every menu: D-pad or stick
to move, A to pick, B to back out. Any controller the browser exposes through
the standard Gamepad API works, and the browser only reveals it after a button
press, so press one first if it doesn't respond. On-screen prompts switch to pad
buttons once a controller is connected.

Touch devices can swipe to steer. An INSTRUCTIONS page shows this same summary
in-game, reachable from both the main menu and the pause menu; opening it from
pause leaves the run paused and returns you there. The pause menu can also drop
you back to the main menu.

The car drives itself forward; you only choose turns. Because turns are buffered,
you can line up a sequence through an intersection before you reach it.

## Pickups

Money is the bulk of what spawns; the rest is weighted rarer.

| Sprite | Pickup | Effect |
| ------ | ------ | ------ |
| spinning gold `$` coin | Money | +$100 carried, +1 heat |
| green `+` token | Repair | Removes one point of damage |
| blue lightning token | Nitro | ~1.5× speed for 4 seconds |
| orange missile token | Rocket | +1 rocket |
| black bomb, lit fuse | Bomb | +1 bomb |
| red heart | Extra life | +1 life, capped at 5 |
| purple ticket token | Rail pass | Ride the train tracks once (only spawns after the garage unlock) |

There is also a **diamond truck** (a silver armoured courier with a cyan gem on
the roof) roaming the map. Ram it to steal a $1,000 diamond — but it costs you
two stars instantly.

## The railway

A railway loops around the city, about nine tiles in from the map edges, and one
train drives it nonstop at twice the base speed of your car. The corners are cut
at 45 degrees, so the loop is an octagon. Downtown and the safehouse sit inside
it and the outskirts outside it.

Roads only cross the track at **level crossings**. Three seconds before the train
reaches a crossing, the lamps flash and the barriers drop. They stay down until
the last wagon has cleared. Anything the moving train runs into is wrecked:

| Hit | Result |
| --- | ------ |
| You | A life and your carried money, whatever your armor |
| Police / SWAT | Destroyed, replaced after the usual respawn delay |
| Diamond truck | Destroyed; the diamond is left on the road for you to grab |

Police never drive through lowered barriers, and while they're held on the other
side of the loop they can't see you. Cross just before the train and the chase
timer keeps running down while the cops wait or look for another way round.

**Rail pass.** A one-time garage unlock ($3,000) adds rail passes to the pickups.
With one in hand, turn off a crossing onto the track: the pass is spent, the car
follows the rails on its own, and no police car can follow you. Turn onto the
road at any crossing to get off. Getting back on takes another pass. The train
is on the same loop, so watch the loop map in the top-right corner. Police wait
for you beside the crossings ahead.

**Bullion heist.** The train stops at the station (the purple pad beside the
track) every lap. Every third lap the vault on its gold car is open for eight
seconds. Park on the platform pad and each second pays $250 carried and adds 1
heat. Staying the whole eight seconds is $2,000 and three stars.

## The garage

Park on the safehouse pad and press `G`. Five upgrade tracks, three levels each,
costing $500 / $1,500 / $4,000 out of banked money:

| Track | Level 0 → 3 |
| ----- | ----------- |
| Engine | 300ms → 225ms per tile |
| Fuel tank | 100 → 200 |
| Armor | 3 → 6 hits |
| Bomb bay | 3 → 6 bombs |
| Rockets | 2 → 5 rockets |

Upgrades apply mid-run and persist across runs. Below the tracks is the one-time
**rail pass** unlock ($3,000), which makes rail passes spawn on the streets.

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

The railway loop is laid out first, with a few crossing points picked on each
straight side. `NetworkGenerator` treats the rest of the track as a wall and
seeds every crossing as a short road stub straight through it. Then it grows a
road network outward from the player's spawn using a growing-tree walk, rather
than stamping a grid. It guarantees full connectivity,
balanced growth across all four quadrants, intersections at least 3 tiles apart,
and no dead ends except the spawn tile — so every road you can turn onto actually
goes somewhere. Crossings the network never connected on both sides are pruned
back to track. `MapManager` then places the safehouse, the station (beside a
straight stretch of track, clear of crossings) and three fuel stations on
reachable, well-spaced pads and auto-tiles the roads.

Generation retries (up to 50 attempts) if a layout fails its reachability check
or keeps fewer than five crossings.

The logic grid only knows *road* and *not road*. `cityLayout.js` decides what
that looks like. Road cells pick one of 47 autotiles from their neighbours, and
the streets carry their own sidewalks (lamps and hydrants included), so the
buildings behind them pack wall to wall. Each block of non-road cells becomes a
district: downtown towers in the middle, shops around them, then houses in
fenced gardens, with an industrial quarter of warehouses and container yards on
one side of town. A few whole blocks, spread across town, are parks. Buildings
need a street, so on the outskirts the town only reaches a lot or two back from
the road and the rest is woods and farmland. Blocks are carved into 1×1 / 2×1 /
1×2 / 2×2 lots and dressed from that district's pieces: houses turn to face
their street, and plots with no street of their own become back gardens. It is
purely cosmetic and never feeds back into gameplay.

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
| `art_city.py` | the city tileset: streets with sidewalks, and lot pieces for each district |
| `art_sprites.py` | vehicles, helicopter, pickups, props, effects, HUD icons, UI panels |
| `art_menu.py` | title-screen parallax skyline, side-view chase cars, the logo |
| `art_rail.py` | track tiles drawn from the loop's geometry, crossings, the train, the station |

## Layout

```
src/
  config.js         all gameplay tunables in one object
  constants.js      tile size, map dimensions, tile/direction enums
  art.js            asset keys, frame indices and shared animations
  cityLayout.js     cosmetic city dressing: road autotiles, districts, lots
  fx.js             one-shot effects (explosions, smoke, sparks, popups)
  gamepad.js        Gamepad API polling, edge detection and per-scene bindings
  GameState.js      pure run state — money, lives, fuel, stars, damage
  garage.js         upgrade pricing and derived-stat math
  storage.js        versioned localStorage save with sanitising loader
  pathfinding.js    BFS used by police AI
  railway.js        the loop's geometry and the train's schedule and occupancy
  turnQueue.js      the buffered-turn queue
  generators/       NetworkGenerator — procedural road layout
  managers/         Input, Map, Police, Rail, UI
  objects/          Car, PoliceCar, SwatVan, Helicopter, DiamondCar,
                    Collectible, Bomb, Rocket, Roadblock, Train, LevelCrossing
  scenes/           Boot, Menu, Game, Pause, Garage, Instructions
  ui/               shared look: pixel text, 9-slice panels, button menus
  generated/        art.json manifest written by tools/generate_art.py
test/               vitest suites for the Phaser-free modules
tools/              the pixel-art generator (Python)
```

The design splits Phaser-dependent rendering from plain-JS game logic. Anything
holding rules — `GameState`, `garage`, `storage`, `pathfinding`, `turnQueue`, `railway`, gamepad
polling, the collectible weight table, map reachability, city layout — imports no Phaser and
is unit tested directly.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs the test
suite, builds, and publishes `dist/` to GitHub Pages. A failing test blocks the
deploy.
