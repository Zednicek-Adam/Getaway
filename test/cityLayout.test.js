import { describe, it, expect } from 'vitest';
import art from '../src/generated/art.json';
import {
    roadMask, cornerMask, roadTileIndex, findBlocks, roadDistance, districtMap, zoneBlocks, pickParks, zoneCity,
    partitionLots, lotFrontage, dressLots, buildGroundLayer,
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
        // A 6x6 park carved into nine 2x2 lots: only a pond and a fountain come that size
        const lots = [];
        for (let y = 0; y < 6; y += 2) for (let x = 0; x < 6; x += 2) lots.push({ x, y, w: 2, h: 2 });
        for (let seed = 1; seed < 15; seed++) {
            const kinds = dressLots(lots, 'park', seeded(seed)).map(lot => lot.piece.name.split('_')[0]);
            for (const landmark of ['pond', 'fountain', 'playground']) {
                expect(kinds.filter(k => k === landmark).length).toBeLessThanOrEqual(1);
            }
        }
    });

    it('measures distance to the nearest road, corners included', () => {
        const isRoad = (x, y) => y === 0;
        const isFree = (x, y) => x >= 0 && x < 3 && y >= 1 && y < 5;
        const dist = roadDistance(3, 5, isRoad, isFree);
        expect(dist.get('1,1')).toBe(1);
        expect(dist.get('1,4')).toBe(4);

        const inGrid = (x, y) => x >= 0 && y >= 0 && x < 3 && y < 3;
        const corner = roadDistance(3, 3, (x, y) => x === 0 && y === 0, (x, y) => inGrid(x, y) && !(x === 0 && y === 0));
        expect(corner.get('1,1')).toBe(1);
        expect(corner.get('2,2')).toBe(2);
    });
});

describe('zoning a whole map', () => {
    // A ring road in the middle of a 16x16 map: an enclosed 4x4 block
    // inside, and outskirts reaching five cells out to the map edge
    const size = 16;
    const ring = (v) => v >= 5 && v <= 10;
    const isRoad = (x, y) => (x === 5 || x === 10) && ring(y) || (y === 5 || y === 10) && ring(x);
    const isFree = (x, y) => x >= 0 && y >= 0 && x < size && y < size && !isRoad(x, y);

    it('builds the outskirts only near a street and turns the rest to countryside', () => {
        const dist = roadDistance(size, size, isRoad, isFree);
        for (let seed = 1; seed < 20; seed++) {
            for (const { zone, cells } of zoneCity(size, size, isRoad, isFree, seeded(seed))) {
                for (const c of cells) {
                    const inside = c.x > 5 && c.x < 10 && c.y > 5 && c.y < 10;
                    const country = zone === 'forest' || zone === 'farm';
                    if (inside) expect(country).toBe(false);
                    if (!inside && dist.get(`${c.x},${c.y}`) > 3) expect(country).toBe(true);
                }
            }
        }
    });

    it('keeps every free cell exactly once', () => {
        const groups = zoneCity(size, size, isRoad, isFree, seeded(4));
        const keys = groups.flatMap(g => g.cells.map(c => `${c.x},${c.y}`));
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).toHaveLength(size * size - 20);
    });

    it('makes parks out of whole enclosed blocks, spread apart', () => {
        const manager = new MapManager(null, 50, 50);
        manager.generate();
        const free = (x, y) => x >= 0 && y >= 0 && x < 50 && y < 50 && !manager.isRoad(x, y);
        const blocks = findBlocks(50, 50, free);
        const parks = [...pickParks(blocks, districtMap(50, 50, seeded(2)), 50, 50, seeded(2))];
        expect(parks.length).toBeGreaterThan(0);
        const centres = parks.map(cells => ({
            x: cells.reduce((s, c) => s + c.x, 0) / cells.length,
            y: cells.reduce((s, c) => s + c.y, 0) / cells.length,
        }));
        for (const cells of parks) {
            expect(blocks).toContain(cells);
            expect(cells.some(c => c.x === 0 || c.y === 0 || c.x === 49 || c.y === 49)).toBe(false);
        }
        for (let i = 0; i < centres.length; i++) {
            for (let j = i + 1; j < centres.length; j++) {
                expect(Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y)).toBeGreaterThanOrEqual(10);
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
