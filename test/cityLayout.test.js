import { describe, it, expect } from 'vitest';
import art from '../src/generated/art.json';
import {
    roadMask, cornerMask, roadTileIndex, findBlocks, townDistrict, zoneTown, partitionLots, lotFrontage, dressLots,
    dressTown,
} from '../src/cityLayout';

// Small deterministic PRNG so layouts are reproducible in tests
function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function roadSet(cells) {
    const set = new Set(cells.map(([x, y]) => `${x},${y}`));
    return (x, y) => set.has(`${x},${y}`);
}

describe('road autotiling', () => {
    it('masks the connected sides', () => {
        // A plus-shaped junction centred on (1,1)
        const isRoad = roadSet([[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]);
        expect(roadMask(isRoad, 1, 1)).toBe(15);
        expect(roadMask(isRoad, 1, 0)).toBe(4); // dead end pointing down
    });

    it('wraps the sidewalk only round corners whose diagonal is not road', () => {
        const isRoad = roadSet([[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 0]]);
        // UR diagonal (2,0) is road -> no nub there; the other three need one
        expect(cornerMask(isRoad, 1, 1)).toBe(2 | 4 | 8);
    });

    it('has a tile for every mask/corner combination a map can produce', () => {
        expect(Object.keys(art.city.roads)).toHaveLength(47);
        for (let bits = 0; bits < 256; bits++) {
            // Random 3x3 neighbourhood around a road centre
            const cells = [[1, 1]];
            [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]].forEach((c, i) => {
                if (bits & (1 << i)) cells.push(c);
            });
            const isRoad = roadSet(cells);
            expect(roadTileIndex(isRoad, 1, 1)).toEqual(expect.any(Number));
        }
    });
});

describe('blocks and districts', () => {
    const width = 12, height = 9;
    const isRoad = (x, y) => x === 4 || y === 5;
    const isFree = (x, y) => x >= 0 && y >= 0 && x < width && y < height && !isRoad(x, y);

    it('splits free cells into road-bounded blocks', () => {
        const blocks = findBlocks(width, height, isFree);
        expect(blocks).toHaveLength(4);
        const total = blocks.reduce((n, b) => n + b.length, 0);
        expect(total).toBe(width * height - width - height + 1);
    });

    it('covers every cell of a block exactly once with lots', () => {
        for (const cells of findBlocks(width, height, isFree)) {
            const lots = partitionLots(cells, undefined, seeded(7));
            const inBlock = new Set(cells.map(c => `${c.x},${c.y}`));
            const seen = new Set();
            for (const lot of lots) {
                for (let j = 0; j < lot.h; j++) {
                    for (let i = 0; i < lot.w; i++) {
                        const key = `${lot.x + i},${lot.y + j}`;
                        expect(inBlock.has(key)).toBe(true);
                        expect(seen.has(key)).toBe(false);
                        seen.add(key);
                    }
                }
            }
            expect(seen.size).toBe(cells.length);
        }
    });

    it('has a single-cell piece in every district, so any lot can be dressed', () => {
        const zones = new Set(art.city.pieces.map(p => p.zone));
        for (const zone of zones) {
            expect(art.city.pieces.some(p => p.zone === zone && p.w === 1 && p.h === 1 && !p.faces)).toBe(true);
        }
    });

    it('dresses every cell of every lot with a piece of its district', () => {
        const lots = [{ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 1 },
            { x: 4, y: 0, w: 1, h: 2 }, { x: 5, y: 0, w: 1, h: 1 }];
        // A street along the top of the row of lots only
        const isRoad = (x, y) => y === -1;
        for (const zone of new Set(art.city.pieces.map(p => p.zone))) {
            for (let seed = 1; seed < 15; seed++) {
                const covered = new Set();
                for (const lot of dressLots(lots, zone, seeded(seed), { isRoad })) {
                    expect(lot.piece.zone).toBe(zone);
                    expect(lot.piece.w).toBe(lot.w);
                    expect(lot.piece.h).toBe(lot.h);
                    expect(lot.piece.tiles).toHaveLength(lot.w * lot.h);
                    for (let j = 0; j < lot.h; j++) {
                        for (let i = 0; i < lot.w; i++) covered.add(`${lot.x + i},${lot.y + j}`);
                    }
                }
                expect(covered.size).toBe(4 + 2 + 2 + 1);
            }
        }
    });

    it('turns houses to face their street and keeps gardens off the street', () => {
        // A 3x3 block with streets on its left and bottom: the centre and
        // top-right cells have no street of their own
        const block = [];
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) block.push({ x, y, w: 1, h: 1 });
        const isRoad = (x, y) => x === -1 || y === 3;
        for (let seed = 1; seed < 30; seed++) {
            for (const lot of dressLots(block, 'residential', seeded(seed), { isRoad })) {
                const frontage = lotFrontage(lot, isRoad);
                if (lot.piece.faces) expect(frontage.has(lot.piece.faces)).toBe(true);
                if (frontage.size === 0) expect(lot.piece.back).toBe(true);
                else expect(lot.piece.back).toBeUndefined();
            }
        }
    });

    it('gives a block at most one of each landmark, splitting lots rather than repeating one', () => {
        // A 6x6 common carved into nine 2x2 lots: only the watering hole comes that size
        const lots = [];
        for (let y = 0; y < 6; y += 2) for (let x = 0; x < 6; x += 2) lots.push({ x, y, w: 2, h: 2 });
        for (let seed = 1; seed < 15; seed++) {
            const kinds = dressLots(lots, 'park', seeded(seed)).map(lot => lot.piece.name.split('_')[0]);
            expect(kinds.filter(k => k === 'wateringhole').length).toBeLessThanOrEqual(1);
        }
    });

    it('builds a town only one bank and one jail, however many blocks it has', () => {
        const lots = [];
        for (let x = 0; x < 40; x++) lots.push({ x, y: 0, w: 1, h: 1 });
        const shared = { isRoad: (x, y) => y === 1, uses: new Map(), businesses: new Set() };
        const names = [];
        for (let block = 0; block < 3; block++) {
            names.push(...dressLots(lots, 'downtown', seeded(block + 1), shared).map(l => l.piece.name));
        }
        expect(names.filter(n => n.endsWith('_bank')).length).toBeLessThanOrEqual(1);
        expect(names.filter(n => n.endsWith('_jail')).length).toBeLessThanOrEqual(1);
    });
});

// A small town: Front Street along the bottom (y 12), Main Street (y 9), a
// top street (y 5) with a row of lots north of it, cross streets at x 4 and 9
const TOWN = { x0: 0, x1: 13, yN: 3, y0: 5, fy: 12, rows: [12, 9, 5], cols: [4, 9], north: [], main: 9 };
const townRoad = (x, y) => (TOWN.rows.includes(y) && x >= TOWN.x0 && x <= TOWN.x1) ||
    (TOWN.cols.includes(x) && y >= TOWN.y0 && y <= TOWN.fy);

describe('the town', () => {
    it('puts the false fronts between Front Street and Main Street, stock pens at the ends', () => {
        expect(townDistrict([{ x: 6, y: 10 }, { x: 7, y: 11 }], TOWN)).toBe('downtown');
        expect(townDistrict([{ x: 0, y: 10 }, { x: 1, y: 11 }], TOWN)).toBe('industrial');
        expect(townDistrict([{ x: 6, y: 7 }], TOWN)).toBe('downtown');
        expect(townDistrict([{ x: 13, y: 7 }], TOWN)).toBe('commercial');
        expect(townDistrict([{ x: 6, y: 3 }, { x: 6, y: 4 }], TOWN)).toBe('residential');
    });

    it('zones every free town cell exactly once', () => {
        const free = (x, y) => !townRoad(x, y);
        const groups = zoneTown(TOWN, free, seeded(2));
        const keys = groups.flatMap(g => g.cells.map(c => `${c.x},${c.y}`));
        expect(new Set(keys).size).toBe(keys.length);
        let expected = 0;
        for (let y = TOWN.yN; y <= TOWN.fy; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) if (free(x, y)) expected++;
        expect(keys).toHaveLength(expected);
    });

    it('dresses every town cell with a street, a lot piece or bare ground for a landmark', () => {
        const valid = new Set([art.city.ground, ...Object.values(art.city.roads).flat(),
            ...art.city.pieces.flatMap(p => p.tiles)]);
        for (let seed = 1; seed < 10; seed++) {
            const data = Array.from({ length: 13 }, () => new Array(14).fill(-1));
            const reserved = new Set(['6,4']);
            dressTown(data, TOWN, townRoad, (x, y) => !townRoad(x, y) && !reserved.has(`${x},${y}`), seeded(seed));
            for (let y = TOWN.yN; y <= TOWN.fy; y++) {
                for (let x = TOWN.x0; x <= TOWN.x1; x++) expect(valid.has(data[y][x])).toBe(true);
            }
            expect(data[4][6]).toBe(art.city.ground);
        }
    });
});
