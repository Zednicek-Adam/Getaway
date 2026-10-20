import art from './generated/art.json';

// Pure layout for the town — no Phaser, so it is unit-testable.
//
// The logic grid only knows "road" and "not road". This module decides what
// the town's not-road cells *look* like, the way a railroad cow town was laid
// out (src/generators/FrontierGenerator.js surveys the streets):
//  - the blocks between Front Street, along the tracks, and Main Street are
//    false fronts (downtown), with stock pens and freight sheds at either end
//    by the railroad (industrial);
//  - the next blocks up are more false fronts in the middle and the trades
//    (commercial) towards the edges, then homesteads (residential) up the
//    hill, with one block kept as the town common (park);
//  - houses face their street, and plots with no street of their own are
//    back gardens.
// Each district's land is carved into lots dressed with pieces from its set
// in the generated tileset (tools/generate_art.py). Street cells get the
// autotile matching their neighbours, boardwalks included. Everything past
// the edge of town is src/landLayout.js. None of this feeds back into gameplay.

const U = 1, R = 2, D = 4, L = 8;
const C_UR = 1, C_DR = 2, C_DL = 4, C_UL = 8;

// Odds of each lot shape per district: Main Street and the freight barns
// come big, homesteads mostly one plot at a time
const SHAPE_WEIGHTS = {
    downtown: { '2x2': 0.35, '2x1': 0.25, '1x2': 0.2, '1x1': 0.2 },
    commercial: { '2x2': 0.12, '2x1': 0.33, '1x2': 0.2, '1x1': 0.35 },
    residential: { '2x2': 0.04, '2x1': 0.1, '1x2': 0.14, '1x1': 0.72 },
    industrial: { '2x2': 0.4, '2x1': 0.3, '1x2': 0.15, '1x1': 0.15 },
    park: { '2x2': 0.3, '2x1': 0.15, '1x2': 0.15, '1x1': 0.4 },
};

// Rarer piece kinds within a district (kind = piece name before the first "_")
const KIND_WEIGHTS = {
    wagons: 0.3, plaza: 0.35, boarding: 0.5, towers: 0.25, stockyard: 0.25, lumber: 0.45, bandstand: 0.4,
    wateringhole: 0.6, church: 0.8, jail: 0.7,
};

// A lot with streets on several sides prefers to face down: the 3/4 view
// shows the front of a house that faces down
const FACING_WEIGHTS = { D: 3, U: 1.5, L: 1, R: 1 };

// Each earlier use of a piece anywhere in town cuts its odds, so the town
// spreads over its whole set instead of repeating favourites
const REPEAT_DECAY = 0.35;

// Landmark kinds that appear at most once per block
const ONCE_PER_BLOCK = new Set(['plaza', 'towers', 'stockyard', 'bandstand', 'wateringhole']);

// Businesses a town has only one of (a piece's business is the last part of
// its name: front_2x1_bank -> bank). Saloons, stores and smithies repeat.
const ONCE_PER_TOWN = new Set(['bank', 'jail', 'sheriff', 'opera', 'gazette', 'post', 'assay', 'undertaker',
    'barber', 'guns', 'drugs', 'cafe', 'bakery', 'laundry', 'saddler', 'church', 'school', 'hotel', 'doctor',
    'dentist', 'land', 'stage', 'baths', 'tailor', 'mercantile', 'store', 'drygoods']);

// Straight-street variants: plain, mud puddle, hitching rails, barrels
const STRAIGHT_WEIGHTS = [54, 8, 22, 16];

// The town common: one block up the hill of about this many cells
const COMMON_SIZE = [4, 16];

// 4-bit neighbour mask: which sides connect to road
export function roadMask(isRoad, x, y) {
    return (isRoad(x, y - 1) ? U : 0) | (isRoad(x + 1, y) ? R : 0) |
        (isRoad(x, y + 1) ? D : 0) | (isRoad(x - 1, y) ? L : 0);
}

// Corners where the boardwalk wraps round: both sides around the corner are
// road but the diagonal cell between them is a block
export function cornerMask(isRoad, x, y) {
    const up = isRoad(x, y - 1), down = isRoad(x, y + 1);
    const left = isRoad(x - 1, y), right = isRoad(x + 1, y);
    let c = 0;
    if (up && right && !isRoad(x + 1, y - 1)) c |= C_UR;
    if (down && right && !isRoad(x + 1, y + 1)) c |= C_DR;
    if (down && left && !isRoad(x - 1, y + 1)) c |= C_DL;
    if (up && left && !isRoad(x - 1, y - 1)) c |= C_UL;
    return c;
}

// Stable per-cell hash so variant choice doesn't shimmer between renders
export function cellHash(x, y, salt = 0) {
    let h = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
}

export function roadTileIndex(isRoad, x, y, roads = art.city.roads) {
    const variants = roads[`${roadMask(isRoad, x, y)},${cornerMask(isRoad, x, y)}`];
    if (variants.length === 1) return variants[0];
    let roll = cellHash(x, y) % STRAIGHT_WEIGHTS.reduce((a, b) => a + b, 0);
    for (let i = 0; i < variants.length; i++) {
        roll -= STRAIGHT_WEIGHTS[i] ?? 0;
        if (roll < 0) return variants[i];
    }
    return variants[0];
}

export function weightedPick(entries, rand) {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = rand() * total;
    for (const [value, w] of entries) {
        roll -= w;
        if (roll < 0) return value;
    }
    return entries[entries.length - 1][0];
}

const key = (c) => `${c.x},${c.y}`;

// Connected groups (4-neighbour) of free cells — the city blocks
export function findBlocks(width, height, isFree) {
    const seen = new Set();
    const blocks = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!isFree(x, y) || seen.has(`${x},${y}`)) continue;
            const cells = [];
            const queue = [[x, y]];
            seen.add(`${x},${y}`);
            while (queue.length > 0) {
                const [cx, cy] = queue.pop();
                cells.push({ x: cx, y: cy });
                for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
                    const k = `${nx},${ny}`;
                    if (!seen.has(k) && isFree(nx, ny)) {
                        seen.add(k);
                        queue.push([nx, ny]);
                    }
                }
            }
            blocks.push(cells);
        }
    }
    return blocks;
}

// The district of one town block (a list of cells). Bands are the strips
// between consecutive streets, counted up from Front Street; the row of lots
// north of the top street is homesteads.
export function townDistrict(cells, town) {
    const minX = Math.min(...cells.map(c => c.x));
    const maxX = Math.max(...cells.map(c => c.x));
    const y = cells.reduce((s, c) => s + c.y, 0) / cells.length;
    const edge = minX <= town.x0 || maxX >= town.x1;
    if (y < town.y0) return 'residential';            // the row north of the top street
    const band = town.rows.findIndex(r => r < y) - 1; // rows run from Front Street up
    if (band === 0) return edge ? 'industrial' : 'downtown';
    if (band === 1) return edge ? 'commercial' : 'downtown';
    if (band === 2) return edge ? 'residential' : 'commercial';
    return 'residential';
}

// The town's free land as [{ zone, cells }]: one group per block, plus the
// common, a mid-sized block up the hill away from the edges of town
export function zoneTown(town, isFree, rand = Math.random) {
    const width = town.x1 + 1;
    const height = town.fy + 1;
    const inTown = (x, y) => x >= town.x0 && x <= town.x1 && y >= town.yN && y <= town.fy && isFree(x, y);
    // A block whose cross street was left out spans more than one band:
    // each band of it takes its own district
    const groups = [];
    for (const block of findBlocks(width, height, inTown)) {
        const minX = Math.min(...block.map(c => c.x));
        const maxX = Math.max(...block.map(c => c.x));
        const byBand = new Map();
        for (const c of block) {
            const band = c.y < town.y0 ? -1 : town.rows.findIndex(r => r < c.y);
            if (!byBand.has(band)) byBand.set(band, []);
            byBand.get(band).push(c);
        }
        for (const cells of byBand.values()) {
            // the edge test looks at the whole block: a band of a block on
            // the edge of town is on the edge too
            const span = [{ x: minX, y: cells[0].y }, { x: maxX, y: cells[0].y }];
            groups.push({ zone: townDistrict([...cells, ...span], town), cells });
        }
    }
    const common = groups.filter(g => g.zone === 'residential' && g.cells.length >= COMMON_SIZE[0] &&
        g.cells.length <= COMMON_SIZE[1] && g.cells.every(c => c.x > town.x0 && c.x < town.x1 && c.y >= town.y0));
    if (common.length > 0) common[Math.floor(rand() * common.length)].zone = 'park';
    return groups;
}

// Greedy row-major carve of a block's cells into rectangular lots.
// `shapes` maps "WxH" to odds; 1x1 must be present so every cell fits.
export function partitionLots(cells, shapes = SHAPE_WEIGHTS.commercial, rand = Math.random) {
    const free = new Set(cells.map(key));
    const taken = new Set();
    const lots = [];
    const fits = (x, y, w, h) => {
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const k = `${x + i},${y + j}`;
                if (!free.has(k) || taken.has(k)) return false;
            }
        }
        return true;
    };

    const ordered = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const { x, y } of ordered) {
        if (taken.has(`${x},${y}`)) continue;
        const options = Object.entries(shapes)
            .map(([size, w]) => [size.split('x').map(Number), w])
            .filter(([[w, h]]) => fits(x, y, w, h));
        const [w, h] = weightedPick(options, rand);
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) taken.add(`${x + i},${y + j}`);
        }
        lots.push({ x, y, w, h });
    }
    return lots;
}

// Sides of a lot ('U', 'R', 'D', 'L') that run along a street
export function lotFrontage(lot, isRoad) {
    const sides = new Set();
    for (let i = 0; i < lot.w; i++) {
        if (isRoad(lot.x + i, lot.y - 1)) sides.add('U');
        if (isRoad(lot.x + i, lot.y + lot.h)) sides.add('D');
    }
    for (let j = 0; j < lot.h; j++) {
        if (isRoad(lot.x - 1, lot.y + j)) sides.add('L');
        if (isRoad(lot.x + lot.w, lot.y + j)) sides.add('R');
    }
    return sides;
}

// A piece that `faces` a side needs a street there; a `back` piece (a back
// garden) is only for lots with no street at all; anything else goes anywhere
function suits(piece, frontage) {
    if (piece.faces) return frontage.has(piece.faces);
    if (piece.back) return frontage.size === 0;
    return true;
}

// Choose a tileset piece for each lot: its district, its footprint, and
// facing its street. A lot no piece suits (or only a landmark the block
// already has) is split into single cells.
export function dressLots(lots, zone, rand = Math.random,
    { isRoad = () => false, pieces = art.city.pieces, uses = new Map(), businesses = new Set() } = {}) {
    // uses (piece name -> times placed) and businesses (one-per-town kinds
    // already built) may be shared between calls, so they span the whole town
    const zonePieces = pieces.filter(p => p.zone === zone);
    const kind = p => p.name.split('_')[0];
    const business = (p) => {
        const parts = p.name.split('_');
        return parts.length > 2 && /^\d+x\d+$/.test(parts[1]) ? parts.slice(2).join('_') : kind(p);
    };
    const kindsUsed = new Set();
    const dressed = [];
    const queue = [...lots];
    while (queue.length > 0) {
        const lot = queue.shift();
        const frontage = lotFrontage(lot, isRoad);
        const sized = zonePieces.filter(p => p.w === lot.w && p.h === lot.h);
        const spent = p => (ONCE_PER_BLOCK.has(kind(p)) && kindsUsed.has(kind(p))) ||
            (ONCE_PER_TOWN.has(business(p)) && businesses.has(business(p)));
        let options = sized.filter(p => suits(p, frontage) && !spent(p));
        if (options.length === 0 && lot.w * lot.h > 1) {
            const cells = [];
            for (let j = 0; j < lot.h; j++) {
                for (let i = 0; i < lot.w; i++) cells.push({ x: lot.x + i, y: lot.y + j, w: 1, h: 1 });
            }
            queue.unshift(...cells);
            continue;
        }
        if (options.length === 0) options = sized;
        const piece = weightedPick(options.map(p => [p,
            (KIND_WEIGHTS[kind(p)] ?? 1) * (FACING_WEIGHTS[p.faces] ?? 1) * REPEAT_DECAY ** (uses.get(p.name) ?? 0)]),
        rand);
        uses.set(piece.name, (uses.get(piece.name) ?? 0) + 1);
        kindsUsed.add(kind(piece));
        if (ONCE_PER_TOWN.has(business(piece))) businesses.add(business(piece));
        dressed.push({ ...lot, zone, piece });
    }
    return dressed;
}

// Dress the town into `data` (a [y][x] array of tileset indices): streets
// autotiled, every block carved into lots and dressed by its district.
// `isFree` says which town cells are open lots (not road, not reserved for a
// landmark, which gets plain ground).
export function dressTown(data, town, isRoad, isFree, rand = Math.random) {
    for (let y = town.yN; y <= town.fy; y++) {
        for (let x = town.x0; x <= town.x1; x++) {
            data[y][x] = isRoad(x, y) ? roadTileIndex(isRoad, x, y) : art.city.ground;
        }
    }
    const shared = { isRoad, uses: new Map(), businesses: new Set() };
    for (const { zone, cells } of zoneTown(town, isFree, rand)) {
        const lots = partitionLots(cells, SHAPE_WEIGHTS[zone], rand);
        for (const lot of dressLots(lots, zone, rand, shared)) {
            lot.piece.tiles.forEach((tile, k) => {
                data[lot.y + Math.floor(k / lot.w)][lot.x + (k % lot.w)] = tile;
            });
        }
    }
    return data;
}
