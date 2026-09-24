import art from './generated/art.json';

// Pure layout for the rendered city — no Phaser, so it is unit-testable.
//
// The logic grid only knows "road" and "not road". This module decides what
// the not-road cells *look* like: it carves them into 1x1 / 2x1 / 1x2 / 2x2
// lots and dresses each lot with a building, park, parking lot or plaza piece
// from the generated tileset (tools/generate_art.py). Road cells get the
// autotile matching their neighbours. None of this feeds back into gameplay.

const U = 1, R = 2, D = 4, L = 8;
const C_UR = 1, C_DR = 2, C_DL = 4, C_UL = 8;

// Which lot kinds a shape may become, weighted
const KIND_WEIGHTS = {
    '2x2': { building: 0.55, park: 0.3, parking: 0.15 },
    '2x1': { building: 0.76, park: 0.14, parking: 0.1 },
    '1x2': { building: 0.84, park: 0.16 },
    '1x1': { building: 0.76, park: 0.16, plaza: 0.08 },
};

// Relative odds of trying each lot shape at a free cell (1x1 always fits)
const SHAPE_WEIGHTS = [[2, 2, 0.3], [2, 1, 0.25], [1, 2, 0.2], [1, 1, 0.25]];

// 4-bit neighbour mask: which sides connect to road
export function roadMask(isRoad, x, y) {
    return (isRoad(x, y - 1) ? U : 0) | (isRoad(x + 1, y) ? R : 0) |
        (isRoad(x, y + 1) ? D : 0) | (isRoad(x - 1, y) ? L : 0);
}

// Corners that need a curb nub: both sides around the corner are road but the
// diagonal cell between them is not
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
    return h ^ (h >>> 16);
}

export function roadTileIndex(isRoad, x, y, roads = art.city.roads) {
    const variants = roads[`${roadMask(isRoad, x, y)},${cornerMask(isRoad, x, y)}`];
    // Straight roads have wear variants; mostly show the clean one
    const h = cellHash(x, y) % 10;
    const pick = variants.length > 1 ? (h < 6 ? 0 : h < 8 ? 1 : 2) : 0;
    return variants[Math.min(pick, variants.length - 1)];
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

// Greedy row-major carve of every free cell into rectangular lots.
// isFree(x, y) must be false out of bounds.
export function partitionLots(width, height, isFree, rand = Math.random) {
    const taken = new Set();
    const lots = [];
    const fits = (x, y, w, h) => {
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                if (!isFree(x + i, y + j) || taken.has(`${x + i},${y + j}`)) return false;
            }
        }
        return true;
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!isFree(x, y) || taken.has(`${x},${y}`)) continue;
            const shapes = SHAPE_WEIGHTS.filter(([w, h]) => fits(x, y, w, h));
            const [w, h] = weightedPick(shapes.map(s => [s, s[2]]), rand);
            for (let j = 0; j < h; j++) {
                for (let i = 0; i < w; i++) taken.add(`${x + i},${y + j}`);
            }
            lots.push({ x, y, w, h });
        }
    }
    return lots;
}

// Choose a tileset piece for each lot (matching size, weighted kind)
export function dressLots(lots, rand = Math.random, pieces = art.city.pieces) {
    return lots.map((lot) => {
        const size = `${lot.w}x${lot.h}`;
        const available = pieces.filter(p => p.w === lot.w && p.h === lot.h);
        const kinds = Object.entries(KIND_WEIGHTS[size])
            .filter(([kind]) => available.some(p => p.kind === kind));
        const kind = weightedPick(kinds, rand);
        const options = available.filter(p => p.kind === kind);
        return { ...lot, piece: options[Math.floor(rand() * options.length)] };
    });
}

// Full ground layer: a [y][x] array of tileset indices.
// `reserved` is a Set of "x,y" cells that get plain pavement (landmarks draw
// their own building sprite on top).
export function buildGroundLayer(width, height, isRoad, reserved = new Set(), rand = Math.random) {
    const data = [];
    for (let y = 0; y < height; y++) data.push(new Array(width).fill(art.city.pavement));

    const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
    const isFree = (x, y) => inBounds(x, y) && !isRoad(x, y) && !reserved.has(`${x},${y}`);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isRoad(x, y)) data[y][x] = roadTileIndex(isRoad, x, y);
        }
    }

    for (const lot of dressLots(partitionLots(width, height, isFree, rand), rand)) {
        lot.piece.tiles.forEach((tile, i) => {
            data[lot.y + Math.floor(i / lot.w)][lot.x + (i % lot.w)] = tile;
        });
    }
    return data;
}
