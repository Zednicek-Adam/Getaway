import art from './generated/art.json';
import { roadMask, cellHash, weightedPick, dressTown } from './cityLayout';
import { valueNoise } from './generators/FrontierGenerator';

// Pure layout for the whole rendered map — no Phaser, so it is unit-testable.
//
// The town is src/cityLayout.js. Everything else is open range:
//  - ground: sand (desert) or dry grass (prairie), decided per tile *corner*
//    from a broad noise field so the two drift across the map in natural
//    shapes; the river keeps its banks green, the town stands on packed dirt
//    and the mountains on bare sand. The river has its own tiles.
//  - overlay (transparent, over the ground): wagon trails on every road cell
//    out of town, bridges where they cross the river, homesteads, ranches and
//    the like beside the trails, and a scatter of cacti, scrub and boulders.
//  - scenery: where the mountain and mesa sprites stand.
// None of this feeds back into gameplay.

const U = 1, R = 2, D = 4, L = 8;
const TERRAIN = art.city.land;

// How much of the open range gets a bush, cactus or rock: by the river,
// in the desert, on the prairie
const DECOR_ODDS = { riverside: 0.55, desert: 0.42, prairie: 0.32 };

// One homestead (or ranch, corral, ...) per this many trail cells out of town
const TRAIL_CELLS_PER_PIECE = 22;
// At most this many of a kind on one map
const KIND_LIMIT = { ranch: 2, field: 2, boothill: 1, mine: 1, mission: 1, camp: 1, homestead: 4, corral: 2, windmill: 2 };

// 1 = grass, 0 = sand, for every tile corner: (width + 1) x (height + 1)
export function biomeCorners(width, height, land, rand = Math.random) {
    const w1 = width + 1;
    const h1 = height + 1;
    const broad = valueNoise(w1, h1, 8, rand);
    const fine = valueNoise(w1, h1, 3, rand);
    const angle = rand() * Math.PI * 2;
    const [cx, cy] = [w1 / 2, h1 / 2];
    const corners = new Uint8Array(w1 * h1);
    for (let y = 0; y < h1; y++) {
        for (let x = 0; x < w1; x++) {
            // a lean towards desert on one side of the map, prairie on the other
            const lean = 0.3 * ((x - cx) * Math.cos(angle) + (y - cy) * Math.sin(angle)) / cx;
            corners[y * w1 + x] = broad(x, y) * 0.75 + fine(x, y) * 0.25 + lean > 0.5 ? 1 : 0;
        }
    }
    const fill = (x0, y0, x1, y1, v) => {
        for (let y = Math.max(0, y0); y <= Math.min(h1 - 1, y1); y++) {
            for (let x = Math.max(0, x0); x <= Math.min(w1 - 1, x1); x++) corners[y * w1 + x] = v;
        }
    };
    for (const s of land?.scenery ?? []) fill(s.x, s.y, s.x + s.w, s.y + s.h, 0);
    for (const c of land?.river ?? []) fill(c.x - 1, c.y - 1, c.x + 2, c.y + 2, 1);
    const town = land?.town;
    if (town) fill(town.x0, town.yN, town.x1 + 1, town.fy + 1, 0);
    return corners;
}

function pickVariant(variants, x, y, salt) {
    return variants[cellHash(x, y, salt) % variants.length];
}

// The river's tile at each of its cells: which sides it flows out of. The
// two ends run off the map edge.
export function riverMasks(river, width, height) {
    const at = new Set(river.map(c => `${c.x},${c.y}`));
    const off = (x, y) => x < 0 || y < 0 || x >= width || y >= height;
    const masks = new Map();
    river.forEach(({ x, y }, k) => {
        const end = k === 0 || k === river.length - 1;
        const side = (nx, ny) => at.has(`${nx},${ny}`) || (end && off(nx, ny));
        masks.set(`${x},${y}`,
            (side(x, y - 1) ? U : 0) | (side(x + 1, y) ? R : 0) | (side(x, y + 1) ? D : 0) | (side(x - 1, y) ? L : 0));
    });
    return masks;
}

/**
 * Every layer of the rendered map:
 *  ground:  [y][x] tileset indices (opaque)
 *  overlay: [y][x] tileset indices, -1 for nothing
 *  scenery: [{ frame, x, y, w, h }] mountain and mesa sprites over their footprints (cells)
 * `land` is the generator's plan (town, river, bridges, scenery); null for
 * the fallback map, which is all open range. `reserved` holds "x,y" cells
 * landmark buildings stand on: they get bare ground.
 */
export function buildMapLayers(width, height, { isRoad, isRail = () => false, land = null, reserved = new Set(), rand = Math.random }) {
    const ground = Array.from({ length: height }, () => new Array(width).fill(-1));
    const overlay = Array.from({ length: height }, () => new Array(width).fill(-1));
    const town = land?.town ?? null;
    const inTown = (x, y) => !!town && x >= town.x0 && x <= town.x1 && y >= town.yN && y <= town.fy;
    const river = riverMasks(land?.river ?? [], width, height);
    const isRiver = (x, y) => river.has(`${x},${y}`);
    const sceneryAt = new Map();
    for (const s of land?.scenery ?? []) {
        for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) sceneryAt.set(`${x},${y}`, s);
    }
    const corners = biomeCorners(width, height, land, rand);
    const corner = (x, y) => corners[y * (width + 1) + x];
    const grassShare = (x, y, w = 1, h = 1) => {
        let n = 0;
        for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) n += corner(x + i, y + j);
        return n / ((w + 1) * (h + 1));
    };

    // Ground
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (inTown(x, y)) continue;
            if (isRiver(x, y)) {
                ground[y][x] = pickVariant(TERRAIN.river[river.get(`${x},${y}`)], x, y, 1);
                continue;
            }
            const k = `${corner(x, y)}${corner(x + 1, y)}${corner(x + 1, y + 1)}${corner(x, y + 1)}`;
            ground[y][x] = pickVariant(TERRAIN.terrain[k], x, y, 2);
        }
    }
    if (town) {
        dressTown(ground, town, isRoad, (x, y) => !isRoad(x, y) && !reserved.has(`${x},${y}`), rand);
    }

    // Trails and bridges out of town
    let trailCells = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!isRoad(x, y) || inTown(x, y)) continue;
            trailCells++;
            if (isRiver(x, y)) {
                overlay[y][x] = TERRAIN.bridge[(river.get(`${x},${y}`) & (L | R)) ? 'V' : 'H'];
                continue;
            }
            overlay[y][x] = pickVariant(TERRAIN.trails[roadMask(isRoad, x, y)], x, y, 3);
        }
    }

    // Open ground: neither road, river, track, mountain, town nor a landmark
    const taken = new Set();
    const open = (x, y) => x >= 0 && y >= 0 && x < width && y < height && !isRoad(x, y) && !isRiver(x, y) &&
        !isRail(x, y) && !sceneryAt.has(`${x},${y}`) && !inTown(x, y) && !reserved.has(`${x},${y}`) &&
        !taken.has(`${x},${y}`);
    placeHomesteads({ width, height, isRoad, open, taken, overlay, sceneryAt, town, grassShare, rand,
        count: Math.round(trailCells / TRAIL_CELLS_PER_PIECE) });

    // Scrub, cacti and boulders
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!open(x, y)) continue;
            const byRiver = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
                .some(([dx, dy]) => isRiver(x + dx, y + dy));
            const set = byRiver ? 'riverside' : grassShare(x, y) >= 0.5 ? 'prairie' : 'desert';
            if ((cellHash(x, y, 4) % 1000) / 1000 >= DECOR_ODDS[set]) continue;
            overlay[y][x] = pickVariant(TERRAIN.decor[set], x, y, 5);
        }
    }

    // Mountains and mesas
    const scenery = (land?.scenery ?? []).map((s) => {
        const frames = art.scenery[s.kind][`${s.w}x${s.h}`];
        return { ...s, frame: frames[(s.tone ?? cellHash(s.x, s.y, 6)) % frames.length] };
    });
    return { ground, overlay, scenery };
}

// Homesteads, ranches, corrals and the like, each beside a trail and with
// open range all round it. A piece belongs to a biome (or 'any'), and some
// want a neighbour: the mine a mountain, Boot Hill the town.
function placeHomesteads({ width, height, isRoad, open, taken, overlay, sceneryAt, town, grassShare, rand, count }) {
    const pieces = TERRAIN.pieces;
    const kind = p => p.name.split('_')[0];
    const used = new Map();
    const anchors = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (open(x, y) && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => isRoad(x + dx, y + dy))) {
                anchors.push({ x, y });
            }
        }
    }
    for (let i = anchors.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [anchors[i], anchors[j]] = [anchors[j], anchors[i]];
    }
    const near = (x, y, w, h, test, reach) => {
        for (let j = -reach; j < h + reach; j++) {
            for (let i = -reach; i < w + reach; i++) if (test(x + i, y + j)) return true;
        }
        return false;
    };
    const nearTown = (x, y, w, h) => !!town && x + w + 3 >= town.x0 && x - 3 <= town.x1 && y + h + 3 >= town.yN && y - 3 <= town.fy;

    let placed = 0;
    for (const a of anchors) {
        if (placed >= count) break;
        if (!open(a.x, a.y)) continue;
        const options = [];
        for (const p of pieces) {
            if ((used.get(kind(p)) ?? 0) >= (KIND_LIMIT[kind(p)] ?? 2)) continue;
            // every placement of the footprint that covers the anchor cell
            for (let j = 0; j < p.h; j++) {
                for (let i = 0; i < p.w; i++) {
                    const x = a.x - i;
                    const y = a.y - j;
                    let fits = true;
                    for (let jj = 0; jj < p.h && fits; jj++) {
                        for (let ii = 0; ii < p.w && fits; ii++) fits = open(x + ii, y + jj);
                    }
                    if (!fits) continue;
                    // keep homesteads apart: nothing else built within two cells
                    if (near(x, y, p.w, p.h, (cx, cy) => taken.has(`${cx},${cy}`), 2)) continue;
                    const desert = grassShare(x, y, p.w, p.h) < 0.5;
                    if (p.zone === 'desert' && !desert) continue;
                    if (p.zone === 'prairie' && desert) continue;
                    if (p.near === 'peaks' && !near(x, y, p.w, p.h, (cx, cy) => sceneryAt.get(`${cx},${cy}`)?.kind === 'peak', 1)) continue;
                    if (p.near === 'town' && !nearTown(x, y, p.w, p.h)) continue;
                    const weight = (p.near ? 6 : 1) * (p.w * p.h > 1 ? 1.5 : 1) / (1 + (used.get(kind(p)) ?? 0));
                    options.push([{ p, x, y }, weight]);
                }
            }
        }
        if (options.length === 0) continue;
        const { p, x, y } = weightedPick(options, rand);
        p.tiles.forEach((tile, k) => {
            const tx = x + (k % p.w);
            const ty = y + Math.floor(k / p.w);
            overlay[ty][tx] = tile;
            taken.add(`${tx},${ty}`);
        });
        used.set(kind(p), (used.get(kind(p)) ?? 0) + 1);
        placed++;
    }
}
