import { describe, it, expect } from 'vitest';
import { MapManager } from '../src/managers/MapManager';
import { TILE_TYPES } from '../src/constants';
import { CONFIG } from '../src/config';

// Full generation runs without a scene (MapManager only needs one to render);
// quiet its progress logging
function generateQuietly() {
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

const RUNS = 8;

describe('MapManager railway', () => {
    it('only lets roads cross the loop at crossings, straight across the track', () => {
        for (let run = 0; run < RUNS; run++) {
            const manager = generateQuietly();
            const { line, crossings } = manager.rail;
            expect(crossings.length).toBeGreaterThanOrEqual(CONFIG.TRAIN.MIN_CROSSINGS);
            line.cells.forEach(({ x, y }, i) => {
                expect(manager.isRoad(x, y)).toBe(crossings.includes(i));
            });
            for (const i of crossings) {
                const { x, y } = line.cells[i];
                const across = line.axisAt(i) === 'H' ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]];
                for (const [ax, ay] of across) expect(manager.isRoad(ax, ay)).toBe(true);
            }
        }
    });

    it('keeps every road reachable from spawn, on both sides of the loop', () => {
        for (let run = 0; run < RUNS; run++) {
            const manager = generateQuietly();
            const { x, y } = manager.playerSpawnPoint;
            const reachable = manager.computeReachable(x, y);
            let outside = 0;
            for (let ty = 0; ty < 50; ty++) {
                for (let tx = 0; tx < 50; tx++) {
                    if (!manager.isRoad(tx, ty)) continue;
                    expect(reachable.has(`${tx},${ty}`)).toBe(true);
                    if (manager.rail.line.sideOf(tx, ty) === 'outside') outside++;
                }
            }
            expect(outside).toBeGreaterThan(0);
        }
    });

    it('builds the station beside straight track, with its pad on the road', () => {
        for (let run = 0; run < RUNS; run++) {
            const manager = generateQuietly();
            const { line, station } = manager.rail;
            expect(station).not.toBeNull();
            const track = line.cells[station.index];
            expect(line.axisAt(station.index)).not.toBeNull();
            expect(Math.abs(track.x - station.pad.x) + Math.abs(track.y - station.pad.y)).toBe(1);
            expect(manager.isRoad(station.pad.x, station.pad.y)).toBe(true);
            expect(manager.isStationPad(station.pad.x, station.pad.y)).toBe(true);
            expect(manager.getTile(station.building.x, station.building.y)).toBe(TILE_TYPES.BUILDING);
        }
    });

    it('never puts a landmark building on the track', () => {
        for (let run = 0; run < RUNS; run++) {
            const manager = generateQuietly();
            const landmarks = [manager.base, ...manager.fuelStations, manager.rail.station].filter(Boolean);
            for (const { building } of landmarks) {
                expect(manager.isRail(building.x, building.y)).toBe(false);
            }
        }
    });

    it('keeps roadblocks and lowered barriers in separate overlays', () => {
        const manager = new MapManager(null, 10, 10);
        manager.initializeGrid();
        manager.setBlocked(3, 3, true);
        manager.setTrainBlocked(3, 3, true);
        manager.setBlocked(3, 3, false);
        expect(manager.isBlocked(3, 3)).toBe(true);
        manager.setTrainBlocked(3, 3, false);
        expect(manager.isBlocked(3, 3)).toBe(false);
    });
});
