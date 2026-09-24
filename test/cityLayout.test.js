import { describe, it, expect } from 'vitest';
import art from '../src/generated/art.json';
import {
    roadMask, cornerMask, roadTileIndex, findBlocks, districtMap, zoneBlocks, partitionLots, dressLots,
    buildGroundLayer,
} from '../src/cityLayout';
import { MapManager } from '../src/managers/MapManager';

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

    it('puts downtown in the middle of the map', () => {
        const centre = [{ x: 25, y: 25 }, { x: 26, y: 25 }];
        const edge = [{ x: 2, y: 2 }, { x: 3, y: 2 }];
        let downtownCentre = 0, downtownEdge = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const [[c], [e]] = zoneBlocks([centre, edge], districtMap(50, 50, seeded(seed)));
            if (c.zone === 'downtown') downtownCentre++;
            if (e.zone === 'downtown') downtownEdge++;
        }
        expect(downtownCentre).toBeGreaterThan(30);
        expect(downtownEdge).toBe(0);
    });

    it('zones a sprawling block cell by cell, keeping every cell', () => {
        // The whole border ring of a 50x50 map: centred on the middle, but
        // it must not all turn into downtown
        const ring = [];
        for (let y = 0; y < 50; y++) {
            for (let x = 0; x < 50; x++) {
                if (x < 3 || y < 3 || x > 46 || y > 46) ring.push({ x, y });
            }
        }
        const [groups] = zoneBlocks([ring], districtMap(50, 50, seeded(5)));
        expect(groups.reduce((n, g) => n + g.cells.length, 0)).toBe(ring.length);
        expect(groups.some(g => g.zone === 'downtown')).toBe(false);
    });

    it('dresses each lot with a piece of its district and footprint', () => {
        const lots = [{ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 1 },
            { x: 4, y: 0, w: 1, h: 2 }, { x: 5, y: 0, w: 1, h: 1 }];
        for (const zone of ['downtown', 'commercial', 'residential', 'industrial', 'park']) {
            for (let seed = 1; seed < 15; seed++) {
                for (const lot of dressLots(lots, zone, seeded(seed))) {
                    expect(lot.piece.zone).toBe(zone);
                    expect(lot.piece.w).toBe(lot.w);
                    expect(lot.piece.h).toBe(lot.h);
                    expect(lot.piece.tiles).toHaveLength(lot.w * lot.h);
                }
            }
        }
    });
});

describe('buildGroundLayer on a generated map', () => {
    it('fills every cell with a valid tileset index', () => {
        const manager = new MapManager(null, 50, 50);
        manager.generate();
        const reserved = new Set([manager.base.building, ...manager.fuelStations.map(s => s.building)]
            .map(b => `${b.x},${b.y}`));
        const data = buildGroundLayer(50, 50, (x, y) => manager.isRoad(x, y), reserved, seeded(3));

        const maxIndex = art.city.ground;
        expect(data).toHaveLength(50);
        for (let y = 0; y < 50; y++) {
            expect(data[y]).toHaveLength(50);
            for (let x = 0; x < 50; x++) {
                expect(Number.isInteger(data[y][x])).toBe(true);
                expect(data[y][x]).toBeGreaterThanOrEqual(0);
                expect(data[y][x]).toBeLessThanOrEqual(maxIndex);
            }
        }
        for (const key of reserved) {
            const [x, y] = key.split(',').map(Number);
            expect(data[y][x]).toBe(art.city.ground);
        }
    });
});
