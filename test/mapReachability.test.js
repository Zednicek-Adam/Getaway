import { describe, it, expect } from 'vitest';
import { MapManager } from '../src/managers/MapManager';
import { TILE_TYPES } from '../src/constants';
import { CONFIG } from '../src/config';

// MapManager only touches the scene (and the Phaser global) in render/spawn
// helpers, so pure grid logic is testable with a null scene.
function makeManager(width, height) {
    const manager = new MapManager(null, width, height);
    manager.initializeGrid();
    return manager;
}

function addRoad(manager, x, y) {
    manager.setTile(x, y, TILE_TYPES.ROAD_GENERIC);
}

describe('MapManager.computeReachable', () => {
    it('flood-fills connected road and ignores islands', () => {
        const manager = makeManager(10, 10);
        // Connected L shape
        for (let y = 1; y <= 4; y++) addRoad(manager, 1, y);
        for (let x = 2; x <= 4; x++) addRoad(manager, x, 4);
        // Disconnected island
        addRoad(manager, 7, 7);
        addRoad(manager, 7, 8);

        const reachable = manager.computeReachable(1, 1);
        expect(reachable.has('1,1')).toBe(true);
        expect(reachable.has('4,4')).toBe(true);
        expect(reachable.has('7,7')).toBe(false);
        expect(reachable.size).toBe(7);
    });

    it('returns an empty set when the start tile is not road', () => {
        const manager = makeManager(10, 10);
        expect(manager.computeReachable(5, 5).size).toBe(0);
    });
});

describe('MapManager.placeBase', () => {
    it('uses the spawn road tile as pad and the tile above as building', () => {
        const manager = makeManager(10, 10);
        manager.playerSpawnPoint = { x: 5, y: 5 };
        // Spawn dead-end: road below, grass above (mirrors NetworkGenerator)
        addRoad(manager, 5, 5);
        addRoad(manager, 5, 6);
        addRoad(manager, 4, 6);
        addRoad(manager, 6, 6);

        manager.placeBase();

        expect(manager.base.pad).toEqual({ x: 5, y: 5 });
        expect(manager.base.building).toEqual({ x: 5, y: 4 });
        expect(manager.getTile(5, 4)).toBe(TILE_TYPES.BUILDING);
        expect(manager.isBasePad(5, 5)).toBe(true);
        expect(manager.isBasePad(5, 6)).toBe(false);
    });
});

describe('MapManager.placeFuelStations', () => {
    it('places stations on reachable road with pad lookups and building tiles', () => {
        const manager = makeManager(50, 50);
        manager.playerSpawnPoint = { x: 2, y: 25 };
        // Long horizontal road — every tile has grass neighbors above/below
        for (let x = 2; x <= 47; x++) addRoad(manager, x, 25);

        manager.placeBase();
        manager.placeFuelStations();

        expect(manager.fuelStations.length).toBe(CONFIG.MAP.FUEL_STATIONS);

        const reachable = manager.computeReachable(2, 25);
        for (const station of manager.fuelStations) {
            expect(manager.getTile(station.building.x, station.building.y)).toBe(TILE_TYPES.BUILDING);
            expect(manager.getFuelStationAt(station.pad.x, station.pad.y)).toBe(station);
            expect(manager.isBasePad(station.pad.x, station.pad.y)).toBe(false);
            expect(reachable.has(`${station.pad.x},${station.pad.y}`)).toBe(true);
            const baseDist = Math.abs(station.pad.x - 2) + Math.abs(station.pad.y - 25);
            expect(baseDist).toBeGreaterThanOrEqual(2);
        }

        // Pairwise spacing never drops below the floor of 2
        const pads = manager.fuelStations.map(s => s.pad);
        for (let i = 0; i < pads.length; i++) {
            for (let j = i + 1; j < pads.length; j++) {
                const dist = Math.abs(pads[i].x - pads[j].x) + Math.abs(pads[i].y - pads[j].y);
                expect(dist).toBeGreaterThanOrEqual(2);
            }
        }
    });
});
