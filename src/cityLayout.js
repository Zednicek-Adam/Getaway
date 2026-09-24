import art from './generated/art.json';

// Pure layout for the rendered city — no Phaser, so it is unit-testable.
//
// The logic grid only knows "road" and "not road". This module decides what
// the not-road cells *look* like. Each connected block of them becomes one
// district (downtown in the middle, shops around it, houses and an industrial
// side of town further out, the odd park), and is carved into lots dressed
// with pieces from that district's set in the generated tileset
// (tools/generate_art.py). Road cells get the autotile matching their
// neighbours, sidewalks included. None of this feeds back into gameplay.

const U = 1, R = 2, D = 4, L = 8;
const C_UR = 1, C_DR = 2, C_DL = 4, C_UL = 8;

// Odds of each lot shape per district: towers and warehouses come big,
// houses mostly one plot at a time
const SHAPE_WEIGHTS = {
    downtown: { '2x2': 0.35, '2x1': 0.25, '1x2': 0.2, '1x1': 0.2 },
    commercial: { '2x2': 0.12, '2x1': 0.33, '1x2': 0.2, '1x1': 0.35 },
    residential: { '2x2': 0.05, '2x1': 0.1, '1x2': 0.12, '1x1': 0.73 },
    industrial: { '2x2': 0.4, '2x1': 0.3, '1x2': 0.15, '1x1': 0.15 },
    park: { '2x2': 0.35, '2x1': 0.2, '1x2': 0.2, '1x1': 0.25 },
};

// Rarer piece kinds within a district (kind = piece name before the first "_")
const KIND_WEIGHTS = { parking: 0.3, plaza: 0.35, pocketpark: 0.4, tanks: 0.25, yard: 0.45 };

// Straight-road variants: plain, manhole, oil stain, street lamps, hydrant
const STRAIGHT_WEIGHTS = [45, 12, 8, 22, 13];

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
                    const key = `${nx},${ny}`;
                    if (!seen.has(key) && isFree(nx, ny)) {
                        seen.add(key);
                        queue.push([nx, ny]);
                    }
                }
            }
            blocks.push(cells);
        }
    }
    return blocks;
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

    if (d > 0.24 && chunkRoll(x, y, map.seed, 2) < 0.13) return 'park';
    if (d < 0.36) return roll < 0.88 ? 'downtown' : 'commercial';
    if (d < 0.58) return roll < 0.6 ? 'commercial' : 'residential';
    if (off < 0.9) return roll < 0.8 ? 'industrial' : 'commercial';
    return roll < 0.78 ? 'residential' : 'commercial';
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

// Split each block into [{ zone, cells }] groups. A compact block is one
// district (judged at its centre); a sprawling one — the road network isn't
// a closed grid, so the outskirts can be one huge block — takes its district
// cell by cell.
export function zoneBlocks(blocks, map) {
    return blocks.map((cells) => {
        if (cells.length <= COMPACT_BLOCK) {
            const mx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
            const my = cells.reduce((s, c) => s + c.y, 0) / cells.length;
            return [{ zone: districtAt(mx, my, map), cells }];
        }
        const groups = new Map();
        for (const c of cells) {
            const zone = districtAt(c.x, c.y, map);
            if (!groups.has(zone)) groups.set(zone, []);
            groups.get(zone).push(c);
        }
        return [...groups].map(([zone, groupCells]) => ({ zone, cells: groupCells }));
    });
}

// Greedy row-major carve of a block's cells into rectangular lots.
// `shapes` maps "WxH" to odds; 1x1 must be present so every cell fits.
export function partitionLots(cells, shapes = SHAPE_WEIGHTS.commercial, rand = Math.random) {
    const free = new Set(cells.map(c => `${c.x},${c.y}`));
    const taken = new Set();
    const lots = [];
    const fits = (x, y, w, h) => {
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const key = `${x + i},${y + j}`;
                if (!free.has(key) || taken.has(key)) return false;
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

// Choose a tileset piece for each lot: its district, its footprint
export function dressLots(lots, zone, rand = Math.random, pieces = art.city.pieces) {
    return lots.map((lot) => {
        const options = pieces.filter(p => p.zone === zone && p.w === lot.w && p.h === lot.h);
        const piece = weightedPick(options.map(p => [p, KIND_WEIGHTS[p.name.split('_')[0]] ?? 1]), rand);
        return { ...lot, zone, piece };
    });
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

    const map = districtMap(width, height, rand);
    for (const groups of zoneBlocks(findBlocks(width, height, isFree), map)) {
        for (const { zone, cells } of groups) {
            const lots = partitionLots(cells, SHAPE_WEIGHTS[zone], rand);
            for (const lot of dressLots(lots, zone, rand)) {
                lot.piece.tiles.forEach((tile, k) => {
                    data[lot.y + Math.floor(k / lot.w)][lot.x + (k % lot.w)] = tile;
                });
            }
        }
    }
    return data;
}
