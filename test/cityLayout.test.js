import { describe, it, expect } from 'vitest';
import art from '../src/generated/art.json';
import {
    roadMask, cornerMask, roadTileIndex, partitionLots, dressLots, buildGroundLayer,
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

    it('puts curb nubs only where the diagonal is not road', () => {
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

describe('lot partitioning', () => {
    it('covers every free cell exactly once and never touches road', () => {
        const width = 12, height = 9;
        const isRoad = (x, y) => x === 4 || y === 5;
        const isFree = (x, y) => x >= 0 && y >= 0 && x < width && y < height && !isRoad(x, y);
        const lots = partitionLots(width, height, isFree, seeded(7));

        const seen = new Map();
        for (const lot of lots) {
            expect([1, 2]).toContain(lot.w);
            expect([1, 2]).toContain(lot.h);
            for (let j = 0; j < lot.h; j++) {
                for (let i = 0; i < lot.w; i++) {
                    const key = `${lot.x + i},${lot.y + j}`;
                    expect(isFree(lot.x + i, lot.y + j)).toBe(true);
                    expect(seen.has(key)).toBe(false);
                    seen.set(key, lot);
                }
            }
        }
        let free = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (isFree(x, y)) free++;
        expect(seen.size).toBe(free);
    });

    it('dresses each lot with a piece of the same footprint', () => {
        const lots = [{ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 1 },
            { x: 4, y: 0, w: 1, h: 2 }, { x: 5, y: 0, w: 1, h: 1 }];
        for (let seed = 1; seed < 30; seed++) {
            for (const lot of dressLots(lots, seeded(seed))) {
                expect(lot.piece.w).toBe(lot.w);
                expect(lot.piece.h).toBe(lot.h);
                expect(lot.piece.tiles).toHaveLength(lot.w * lot.h);
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

        const maxIndex = art.city.pavement;
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
            expect(data[y][x]).toBe(art.city.pavement);
        }
    });
});
