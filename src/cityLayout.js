import art from './generated/art.json';

// Pure layout for the rendered city — no Phaser, so it is unit-testable.
//
// The logic grid only knows "road" and "not road". This module decides what
// the not-road cells *look* like, roughly the way a real town grows:
//  - districts ring the centre: downtown towers, then shops, then houses,
//    with an industrial side of town picked per map;
//  - a few whole blocks, spread across town, are kept as parks;
//  - buildings need a street, so on the outskirts anything deeper than a lot
//    or two from the nearest road is countryside (woods and farmland);
//  - houses face their street, and plots with no street of their own are
//    back gardens.
// Each district's land is carved into lots dressed with pieces from its set
// in the generated tileset (tools/generate_art.py). Road cells get the
// autotile matching their neighbours, sidewalks included. None of this feeds
// back into gameplay.

const U = 1, R = 2, D = 4, L = 8;
const C_UR = 1, C_DR = 2, C_DL = 4, C_UL = 8;

// Odds of each lot shape per district: towers and warehouses come big,
// houses mostly one plot at a time, farmland in whole fields
const SHAPE_WEIGHTS = {
    downtown: { '2x2': 0.35, '2x1': 0.25, '1x2': 0.2, '1x1': 0.2 },
    commercial: { '2x2': 0.12, '2x1': 0.33, '1x2': 0.2, '1x1': 0.35 },
    residential: { '2x2': 0.04, '2x1': 0.1, '1x2': 0.14, '1x1': 0.72 },
    industrial: { '2x2': 0.4, '2x1': 0.3, '1x2': 0.15, '1x1': 0.15 },
    park: { '2x2': 0.3, '2x1': 0.15, '1x2': 0.15, '1x1': 0.4 },
    forest: { '1x1': 1 },
    farm: { '2x2': 0.5, '2x1': 0.25, '1x1': 0.25 },
};

// Rarer piece kinds within a district (kind = piece name before the first "_")
const KIND_WEIGHTS = {
    parking: 0.3, plaza: 0.35, flats: 0.5, tanks: 0.25, yard: 0.45, playground: 0.4, pond: 0.6, fountain: 0.6,
};

// A lot with streets on several sides prefers to face down: the 3/4 view
// shows the front of a house that faces down
const FACING_WEIGHTS = { D: 3, U: 1.5, L: 1, R: 1 };

// Each earlier use of a piece in the same district halves its odds, so a
// neighbourhood spreads over its whole set instead of repeating favourites
const REPEAT_DECAY = 0.5;

// Landmark kinds that appear at most once per block (per district, where a
// sprawling block spans several)
const ONCE_PER_BLOCK = new Set(['plaza', 'tanks', 'playground', 'pond', 'fountain']);

// Straight-road variants: plain, manhole, street lamps, hydrant
const STRAIGHT_WEIGHTS = [50, 14, 22, 14];

// How far (cells from the nearest road) each district reaches into the
// outskirts before the countryside takes over: a row of houses, shops with
// a yard behind, a deeper industrial estate
const BUILT_DEPTH = { downtown: 3, commercial: 2, residential: 1, industrial: 2 };

// Parks are whole blocks of PARK_MIN..PARK_MAX cells, about PARK_SHARE of the
// land inside the road network, at least PARK_SPACING cells apart
const PARK_MIN = 4, PARK_MAX = 48, PARK_SHARE = 0.08, PARK_SPACING = 10;

// 4-bit neighbour mask: which sides connect to road
export function roadMask(isRoad, x, y) {
    return (isRoad(x, y - 1) ? U : 0) | (isRoad(x + 1, y) ? R : 0) |
        (isRoad(x, y + 1) ? D : 0) | (isRoad(x - 1, y) ? L : 0);
}

// Corners where the sidewalk wraps round: both sides around the corner are
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
function cellHash(x, y) {
    let h = (x * 374761393 + y * 668265263) >>> 0;
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

function weightedPick(entries, rand) {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = rand() * total;
    for (const [value, w] of entries) {
        roll -= w;
        if (roll < 0) return value;
    }
    return entries[entries.length - 1][0];
}

const key = (c) => `${c.x},${c.y}`;
const NEIGHBOURS_8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

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

// Distance in cells from each free cell to the nearest road ("x,y" -> n).
// A cell touching a road, even only at a corner, is 1; free land no road
// reaches at all is left out.
export function roadDistance(width, height, isRoad, isFree) {
    const dist = new Map();
    let frontier = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isFree(x, y) && NEIGHBOURS_8.some(([dx, dy]) => isRoad(x + dx, y + dy))) {
                dist.set(`${x},${y}`, 1);
                frontier.push({ x, y });
            }
        }
    }
    for (let d = 2; frontier.length > 0; d++) {
        const next = [];
        for (const c of frontier) {
            for (const [dx, dy] of NEIGHBOURS_8) {
                const n = { x: c.x + dx, y: c.y + dy };
                if (isFree(n.x, n.y) && !dist.has(key(n))) {
                    dist.set(key(n), d);
                    next.push(n);
                }
            }
        }
        frontier = next;
    }
    return dist;
}

// Districts come from a coarse map: downtown in the middle, shops ringing
// it, and further out houses, except on one side of town (picked per map)
// which is industrial. The random part of the choice is shared by every cell
// in the same CHUNK x CHUNK patch, so neighbourhoods come out coherent.
const CHUNK = 6;
const COMPACT_BLOCK = 40; // cells; bigger blocks are zoned cell by cell

function chunkRoll(x, y, seed, salt) {
    return cellHash(Math.floor(x / CHUNK) * 7919 + salt, Math.floor(y / CHUNK) * 104729 + seed) / 4294967296;
}

export function districtAt(x, y, map) {
    const d = Math.hypot(x + 0.5 - map.cx, y + 0.5 - map.cy) / map.radius;
    const angle = Math.atan2(y + 0.5 - map.cy, x + 0.5 - map.cx);
    const off = Math.abs(Math.atan2(Math.sin(angle - map.industrialAngle), Math.cos(angle - map.industrialAngle)));
    const roll = chunkRoll(x, y, map.seed, 1);

    if (d < 0.36) return roll < 0.88 ? 'downtown' : 'commercial';
    if (d < 0.58) return roll < 0.6 ? 'commercial' : 'residential';
    if (off < 0.9) return roll < 0.8 ? 'industrial' : 'commercial';
    return roll < 0.78 ? 'residential' : 'commercial';
}

// Past the last street: patches of woodland between the farms
export function countrysideAt(x, y, map) {
    return chunkRoll(x, y, map.seed, 3) < 0.45 ? 'forest' : 'farm';
}

export function districtMap(width, height, rand = Math.random) {
    return {
        cx: width / 2,
        cy: height / 2,
        radius: Math.min(width, height) / 2,
        industrialAngle: rand() * Math.PI * 2,
        seed: Math.floor(rand() * 1e6),
    };
}

function centroid(cells) {
    return {
        x: cells.reduce((s, c) => s + c.x, 0) / cells.length,
        y: cells.reduce((s, c) => s + c.y, 0) / cells.length,
    };
}

function touchesEdge(cells, width, height) {
    return cells.some(c => c.x === 0 || c.y === 0 || c.x === width - 1 || c.y === height - 1);
}

function groupBy(cells, zoneOf) {
    const groups = new Map();
    for (const c of cells) {
        const zone = zoneOf(c);
        if (!groups.has(zone)) groups.set(zone, []);
        groups.get(zone).push(c);
    }
    return [...groups].map(([zone, groupCells]) => ({ zone, cells: groupCells }));
}

// Split each block into [{ zone, cells }] groups. A compact block is one
// district (judged at its centre); a sprawling one — the road network isn't
// a closed grid, so the outskirts can be one huge block — takes its district
// cell by cell.
export function zoneBlocks(blocks, map) {
    return blocks.map((cells) => {
        if (cells.length <= COMPACT_BLOCK) {
            const c = centroid(cells);
            return [{ zone: districtAt(c.x, c.y, map), cells }];
        }
        return groupBy(cells, c => districtAt(c.x, c.y, map));
    });
}

// A few whole blocks become parks: mid-sized, enclosed by streets, spread
// out across town and never in the industrial quarter. Returns the chosen
// blocks (the same arrays as in `blocks`).
export function pickParks(blocks, map, width, height, rand = Math.random) {
    const enclosed = blocks.filter(cells => !touchesEdge(cells, width, height));
    let budget = PARK_SHARE * enclosed.reduce((n, cells) => n + cells.length, 0);
    const candidates = enclosed.filter(cells => cells.length >= PARK_MIN && cells.length <= PARK_MAX);
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const parks = new Set();
    const centres = [];
    for (const cells of candidates) {
        if (budget <= 0) break;
        const c = centroid(cells);
        if (districtAt(c.x, c.y, map) === 'industrial') continue;
        if (centres.some(p => Math.hypot(p.x - c.x, p.y - c.y) < PARK_SPACING)) continue;
        parks.add(cells);
        centres.push(c);
        budget -= cells.length;
    }
    return parks;
}

// All the free land as [{ zone, cells }] groups: parks, districts, and the
// countryside beyond the town's reach on the outskirts
export function zoneCity(width, height, isRoad, isFree, rand = Math.random) {
    const map = districtMap(width, height, rand);
    const dist = roadDistance(width, height, isRoad, isFree);
    const blocks = findBlocks(width, height, isFree);
    const parks = pickParks(blocks, map, width, height, rand);
    const zoned = zoneBlocks(blocks, map);

    const groups = [];
    blocks.forEach((cells, i) => {
        if (parks.has(cells)) {
            groups.push({ zone: 'park', cells });
            return;
        }
        // Only the outskirts reach beyond the streets; a block the roads
        // enclose is built up all the way through
        const outskirts = touchesEdge(cells, width, height);
        for (const group of zoned[i]) {
            if (!outskirts) {
                groups.push(group);
                continue;
            }
            const depth = BUILT_DEPTH[group.zone];
            groups.push(...groupBy(group.cells, c =>
                (dist.get(key(c)) ?? Infinity) <= depth ? group.zone : countrysideAt(c.x, c.y, map)));
        }
    });
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
export function dressLots(lots, zone, rand = Math.random, { isRoad = () => false, pieces = art.city.pieces } = {}) {
    const zonePieces = pieces.filter(p => p.zone === zone);
    const kind = p => p.name.split('_')[0];
    const uses = new Map(); // piece name -> times placed
    const kindsUsed = new Set();
    const dressed = [];
    const queue = [...lots];
    while (queue.length > 0) {
        const lot = queue.shift();
        const frontage = lotFrontage(lot, isRoad);
        const sized = zonePieces.filter(p => p.w === lot.w && p.h === lot.h);
        const spent = p => ONCE_PER_BLOCK.has(kind(p)) && kindsUsed.has(kind(p));
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
        dressed.push({ ...lot, zone, piece });
    }
    return dressed;
}

// Full ground layer: a [y][x] array of tileset indices.
// `reserved` is a Set of "x,y" cells that get plain ground (landmarks draw
// their own building sprite on top).
export function buildGroundLayer(width, height, isRoad, reserved = new Set(), rand = Math.random) {
    const data = [];
    for (let y = 0; y < height; y++) data.push(new Array(width).fill(art.city.ground));

    const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
    const isFree = (x, y) => inBounds(x, y) && !isRoad(x, y) && !reserved.has(`${x},${y}`);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isRoad(x, y)) data[y][x] = roadTileIndex(isRoad, x, y);
        }
    }

    for (const { zone, cells } of zoneCity(width, height, isRoad, isFree, rand)) {
        const lots = partitionLots(cells, SHAPE_WEIGHTS[zone], rand);
        for (const lot of dressLots(lots, zone, rand, { isRoad })) {
            lot.piece.tiles.forEach((tile, k) => {
                data[lot.y + Math.floor(k / lot.w)][lot.x + (k % lot.w)] = tile;
            });
        }
    }
    return data;
}
