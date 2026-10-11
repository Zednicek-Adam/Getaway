import { describe, it, expect } from 'vitest';
import art from '../src/generated/art.json';
import { biomeCorners, riverMasks, buildMapLayers } from '../src/landLayout';
import { MapManager } from '../src/managers/MapManager';

function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

// Full generation runs without a scene; quiet its progress logging
function generated() {
    const log = console.log;
    console.log = () => {};
    try {
        const manager = new MapManager(null, 50, 50);
        manager.generate();
        return manager;
    } finally {
        console.log = log;
    }
}

const MANAGERS = Array.from({ length: 4 }, generated);
const land = art.city.land;
const TILES = Math.max(...Object.values(art.city.roads).flat(), ...art.city.pieces.flatMap(p => p.tiles),
    ...Object.values(land.terrain).flat(), ...Object.values(land.river).flat(), ...Object.values(land.trails).flat(),
    ...Object.values(land.decor).flat(), ...land.pieces.flatMap(p => p.tiles), ...Object.values(land.bridge)) + 1;

function layers(manager, seed = 1) {
    const landmarks = [manager.base, ...manager.fuelStations, manager.rail.station].filter(Boolean);
    const reserved = new Set(landmarks.map(l => `${l.building.x},${l.building.y}`));
    return {
        reserved,
        ...buildMapLayers(50, 50, {
            isRoad: (x, y) => manager.isRoad(x, y),
            isRail: (x, y) => manager.isRail(x, y),
            land: manager.land,
            reserved,
            rand: seeded(seed),
        }),
    };
}

describe('the open range', () => {
    it('keeps the river banks green and the town on bare ground', () => {
        for (const m of MANAGERS) {
            const corners = biomeCorners(50, 50, m.land, seeded(3));
            const at = (x, y) => corners[y * 51 + x];
            for (const { x, y } of m.land.river) {
                for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) expect(at(cx, cy)).toBe(1);
            }
            const t = m.land.town;
            for (let y = t.yN; y <= t.fy + 1; y++) for (let x = t.x0; x <= t.x1 + 1; x++) expect(at(x, y)).toBe(0);
        }
    });

    it('has a tile for every bend and stretch of river', () => {
        for (const m of MANAGERS) {
            for (const mask of riverMasks(m.land.river, 50, 50).values()) {
                expect(land.river[mask]).toBeDefined();
            }
        }
    });

    it('fills the ground everywhere and lays valid tiles over it', () => {
        for (const m of MANAGERS) {
            const { ground, overlay } = layers(m);
            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    expect(Number.isInteger(ground[y][x])).toBe(true);
                    expect(ground[y][x]).toBeGreaterThanOrEqual(0);
                    expect(ground[y][x]).toBeLessThan(TILES);
                    expect(overlay[y][x]).toBeGreaterThanOrEqual(-1);
                    expect(overlay[y][x]).toBeLessThan(TILES);
                }
            }
        }
    });

    it('draws a trail on every road out of town, and a bridge where it meets the river', () => {
        const trails = new Set(Object.values(land.trails).flat());
        const bridges = new Set(Object.values(land.bridge));
        for (const m of MANAGERS) {
            const { overlay } = layers(m);
            const t = m.land.town;
            const river = new Set(m.land.river.map(c => `${c.x},${c.y}`));
            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    if (!m.isRoad(x, y) || (x >= t.x0 && x <= t.x1 && y >= t.yN && y <= t.fy)) continue;
                    expect((river.has(`${x},${y}`) ? bridges : trails).has(overlay[y][x])).toBe(true);
                }
            }
        }
    });

    it('builds homesteads beside a trail, and nothing on the track, the river or a landmark', () => {
        const pieceTiles = new Map();
        land.pieces.forEach(p => p.tiles.forEach(t => pieceTiles.set(t, p)));
        for (const m of MANAGERS) {
            const { overlay, reserved } = layers(m, 5);
            const river = new Set(m.land.river.map(c => `${c.x},${c.y}`));
            let homesteads = 0;
            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    const tile = overlay[y][x];
                    if (m.isRoad(x, y)) continue;
                    if (m.isRail(x, y) || river.has(`${x},${y}`) || reserved.has(`${x},${y}`)) {
                        expect(tile).toBe(-1);
                    }
                    if (pieceTiles.has(tile)) homesteads++;
                }
            }
            expect(homesteads).toBeGreaterThan(0);
        }
    });

    it('stands every mountain and mesa on a sprite frame of its footprint', () => {
        for (const m of MANAGERS) {
            const { scenery } = layers(m);
            expect(scenery.length).toBe(m.land.scenery.length);
            for (const s of scenery) {
                expect(art.scenery[s.kind][`${s.w}x${s.h}`]).toContain(s.frame);
            }
        }
    });
});
