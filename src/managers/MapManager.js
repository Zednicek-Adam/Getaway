import { TILE_SIZE, COLORS, TILE_TYPES, DIRECTIONS } from '../constants';
import { Collectible, pickCollectibleType } from '../objects/Collectible';
import { NetworkGenerator } from '../generators/NetworkGenerator';
import { CONFIG } from '../config';

export class MapManager {
    constructor(scene, width, height) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.grid = []; // 2D Array [y][x]
        this.collectibles = []; // Array of Collectible objects
        this.base = null; // { building: {x,y}, pad: {x,y} }
        this.fuelStations = []; // Array of { building: {x,y}, pad: {x,y} }
        this.blocked = new Set(); // "x,y" keys — roadblock overlay
    }

    generate() {
        this.blocked = new Set(); // fresh overlay on every (re)generate
        this.initializeGrid();
        this.generateProceduralMap();
        this.placeBase();
        this.placeFuelStations();
        this.autoTileRoads();
    }

    generateProceduralMap() {
        this.playerSpawnPoint = { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };

        let success = false;
        let attempts = 0;

        while (!success && attempts < 50) {
            attempts++;

            this.initializeGrid();
            const generator = new NetworkGenerator(this.width, this.height);
            this.grid = generator.generate(this.playerSpawnPoint);

            // Clean up any remaining dead-ends (safety net)
            this.removeDeadEnds();

            // Verify spawn is still connected to a valid road
            if (this.isRoad(this.playerSpawnPoint.x, this.playerSpawnPoint.y + 1)) {
                success = true;
                console.log(`Map successfully generated after ${attempts} attempts.`);
            }
        }

        if (!success) {
            console.warn("NetworkGenerator failed after 50 attempts. Generating fallback.");
            this.generateFallbackMap();
        }
    }



    generateFallbackMap() {
        this.initializeGrid();
        for (let y = 5; y < this.height - 5; y++) {
            for (let x = 5; x < this.width - 5; x++) {
                if (x === 5 || x === this.width - 6 || y === 5 || y === this.height - 6) {
                    this.grid[y][x] = TILE_TYPES.ROAD_GENERIC;
                }
            }
        }
        for (let y = 2; y <= 5; y++) {
            this.grid[y][this.playerSpawnPoint.x] = TILE_TYPES.ROAD_GENERIC;
        }
    }

    removeDeadEnds() {
        let changed = true;
        let passes = 0;

        while (changed && passes < 100) {
            changed = false;
            passes++;
            for (let y = 1; y < this.height - 1; y++) {
                for (let x = 1; x < this.width - 1; x++) {
                    if (!this.isRoad(x, y)) continue;

                    // Protect the spawn point
                    if (x === this.playerSpawnPoint.x && y === this.playerSpawnPoint.y) continue;

                    let neighbors = 0;
                    if (this.isRoad(x, y - 1)) neighbors++;
                    if (this.isRoad(x, y + 1)) neighbors++;
                    if (this.isRoad(x - 1, y)) neighbors++;
                    if (this.isRoad(x + 1, y)) neighbors++;

                    if (neighbors <= 1) { // Dead end
                        this.setTile(x, y, TILE_TYPES.GRASS);
                        changed = true;
                    }
                }
            }
        }
    }

    // Removed old walker legacy methods

    autoTileRoads() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const type = this.grid[y][x];
                if (type !== TILE_TYPES.GRASS && type !== TILE_TYPES.BUILDING) {
                    this.calculateRoadType(x, y);
                }
            }
        }
    }

    calculateRoadType(x, y) {
        // Check 4 neighbors
        const nU = this.isRoad(x, y - 1);
        const nD = this.isRoad(x, y + 1);
        const nL = this.isRoad(x - 1, y);
        const nR = this.isRoad(x + 1, y);

        let type = TILE_TYPES.ROAD_GENERIC;

        if (nU && nD && nL && nR) type = TILE_TYPES.ROAD_INT_ALL;
        else if (nU && nD && nR) type = TILE_TYPES.ROAD_INT_T_B_R;
        else if (nU && nD && nL) type = TILE_TYPES.ROAD_INT_T_B_L;
        else if (nU && nR && nL) type = TILE_TYPES.ROAD_INT_T_R_L;
        else if (nD && nR && nL) type = TILE_TYPES.ROAD_INT_B_R_L;
        else if (nU && nR) type = TILE_TYPES.ROAD_TURN_T_R;
        else if (nU && nL) type = TILE_TYPES.ROAD_TURN_T_L;
        else if (nD && nR) type = TILE_TYPES.ROAD_TURN_B_R;
        else if (nD && nL) type = TILE_TYPES.ROAD_TURN_B_L;
        else if (nU || nD) type = TILE_TYPES.ROAD_VERTICAL;
        else if (nL || nR) type = TILE_TYPES.ROAD_HORIZONTAL;

        this.setTile(x, y, type);
    }

    isRoad(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        const type = this.grid[y][x];
        return type !== TILE_TYPES.GRASS && type !== TILE_TYPES.BUILDING;
    }

    getRandomSpawnPoint() {
        // 1. Try Random Sampling
        for (let i = 0; i < 500; i++) {
            const x = Phaser.Math.Between(2, this.width - 3);
            const y = Phaser.Math.Between(2, this.height - 3);
            if (this.isRoad(x, y)) {
                return { x, y };
            }
        }

        // 2. Linear Scan Fallback (Guaranteed if map has road)
        for (let y = 2; y < this.height - 2; y++) {
            for (let x = 2; x < this.width - 2; x++) {
                if (this.isRoad(x, y)) {
                    return { x, y };
                }
            }
        }

        // 3. Absolute Fallback (Center)
        return { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
    }

    // Random reachable road tile at least minDist Manhattan from (x, y).
    // Bounded retries per round, then the distance requirement relaxes so a
    // point is always found on small maps. Pass a precomputed reachable set
    // to skip the BFS.
    getSpawnPointAwayFrom(x, y, minDist, reachable = null) {
        let reach = reachable || this.computeReachable(x, y);
        if (reach.size === 0) {
            // (x, y) isn't road — fall back to the player spawn's road network
            reach = this.computeReachable(this.playerSpawnPoint.x, this.playerSpawnPoint.y);
        }

        for (let dist = minDist; dist >= 0; dist -= 3) {
            for (let i = 0; i < 30; i++) {
                const point = this.getRandomSpawnPoint();
                if (Math.abs(point.x - x) + Math.abs(point.y - y) >= dist &&
                    reach.has(`${point.x},${point.y}`)) {
                    return point;
                }
            }
        }

        // Absolute fallback (unreachable-island edge case)
        return this.getRandomSpawnPoint();
    }

    // BFS flood-fill over road tiles; returns a Set of "x,y" keys.
    computeReachable(fromX, fromY) {
        const reachable = new Set();
        if (!this.isRoad(fromX, fromY)) return reachable;

        const queue = [{ x: fromX, y: fromY }];
        reachable.add(`${fromX},${fromY}`);

        while (queue.length > 0) {
            const { x, y } = queue.shift();
            const neighbors = [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]];
            for (const [nx, ny] of neighbors) {
                const key = `${nx},${ny}`;
                if (!reachable.has(key) && this.isRoad(nx, ny)) {
                    reachable.add(key);
                    queue.push({ x: nx, y: ny });
                }
            }
        }

        return reachable;
    }

    placeBase() {
        let pad = { x: this.playerSpawnPoint.x, y: this.playerSpawnPoint.y };

        // Fallback maps don't guarantee road at the spawn point — relocate the
        // pad (and the player spawn with it) onto an actual road tile.
        if (!this.isRoad(pad.x, pad.y)) {
            pad = this.getRandomSpawnPoint();
            this.playerSpawnPoint = { x: pad.x, y: pad.y };
        }

        // Verify the pad is reachable from the player spawn; re-pick if not (bounded)
        let retries = 0;
        while (retries < 10) {
            const reachable = this.computeReachable(this.playerSpawnPoint.x, this.playerSpawnPoint.y);
            if (reachable.has(`${pad.x},${pad.y}`)) break;
            pad = this.getRandomSpawnPoint();
            this.playerSpawnPoint = { x: pad.x, y: pad.y };
            retries++;
        }

        const building = this.pickAdjacentBuildingTile(pad);
        this.setTile(building.x, building.y, TILE_TYPES.BUILDING);
        this.base = { building, pad };
    }

    pickAdjacentBuildingTile(pad) {
        const neighbors = [
            { x: pad.x, y: pad.y - 1 },
            { x: pad.x, y: pad.y + 1 },
            { x: pad.x - 1, y: pad.y },
            { x: pad.x + 1, y: pad.y },
        ];
        const inBounds = neighbors.filter(n => this.getTile(n.x, n.y) !== null);
        const nonRoad = inBounds.find(n => !this.isRoad(n.x, n.y));

        // Edge case: all in-bounds neighbors are road — overwrite one anyway
        return nonRoad || inBounds[0];
    }

    placeFuelStations() {
        this.fuelStations = [];

        const spawn = this.playerSpawnPoint;
        const reachable = this.computeReachable(spawn.x, spawn.y);
        const basePad = this.base.pad;

        // Greedy placement; halve the spacing and retry if not enough fit (floor 2)
        let spacing = CONFIG.MAP.STATION_MIN_SPACING;
        let accepted = this.pickStationPads(reachable, basePad, spacing);
        while (accepted.length < CONFIG.MAP.FUEL_STATIONS && spacing > 2) {
            spacing = Math.max(2, Math.floor(spacing / 2));
            accepted = this.pickStationPads(reachable, basePad, spacing);
        }

        for (const pad of accepted) {
            const building = this.pickAdjacentBuildingTile(pad);
            this.setTile(building.x, building.y, TILE_TYPES.BUILDING);
            this.fuelStations.push({ building, pad });
        }
    }

    pickStationPads(reachable, basePad, spacing) {
        const candidates = [];
        for (const key of reachable) {
            const [x, y] = key.split(',').map(Number);
            if (x === basePad.x && y === basePad.y) continue;
            if (Math.abs(x - basePad.x) + Math.abs(y - basePad.y) < spacing) continue;
            if (!this.hasNonRoadNeighborInBounds(x, y)) continue;
            candidates.push({ x, y });
        }

        this.shuffleInPlace(candidates);

        const accepted = [];
        for (const candidate of candidates) {
            if (accepted.length >= CONFIG.MAP.FUEL_STATIONS) break;
            const tooClose = accepted.some(a =>
                Math.abs(a.x - candidate.x) + Math.abs(a.y - candidate.y) < spacing);
            if (!tooClose) accepted.push(candidate);
        }
        return accepted;
    }

    hasNonRoadNeighborInBounds(x, y) {
        const neighbors = [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]];
        return neighbors.some(([nx, ny]) => this.getTile(nx, ny) !== null && !this.isRoad(nx, ny));
    }

    shuffleInPlace(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    getFuelStationAt(x, y) {
        return this.fuelStations.find(s => s.pad.x === x && s.pad.y === y);
    }

    isBasePad(x, y) {
        return !!this.base && this.base.pad.x === x && this.base.pad.y === y;
    }

    // Roadblock overlay — a blocked road tile stays road (renders normally) but
    // cars that avoid blocks won't path through it.
    setBlocked(x, y, on) {
        const key = `${x},${y}`;
        if (on) this.blocked.add(key);
        else this.blocked.delete(key);
    }

    isBlocked(x, y) {
        return this.blocked.has(`${x},${y}`);
    }

    initializeGrid() {
        this.grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(TILE_TYPES.GRASS);
            }
            this.grid.push(row);
        }
    }

    // Removed generateSimpleRoadNetwork

    setTile(x, y, type) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.grid[y][x] = type;
        }
    }

    getTile(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            return this.grid[y][x];
        }
        return null;
    }

    spawnRandomCollectibles(count) {
        let spawned = 0;
        let attempts = 0;
        while (spawned < count && attempts < 100) {
            attempts++;
            const x = Phaser.Math.Between(1, this.width - 2);
            const y = Phaser.Math.Between(1, this.height - 2);

            const typeCode = this.getTile(x, y);

            // Check if road, no existing collectible, and keep base/station pads clear
            if (typeCode !== null && typeCode !== TILE_TYPES.GRASS && typeCode !== TILE_TYPES.BUILDING &&
                !this.getCollectibleAt(x, y) && !this.isBasePad(x, y) && !this.getFuelStationAt(x, y)) {
                // Weighted type from the spawn table (fuel no longer spawns —
                // stations are the fuel source)
                const type = pickCollectibleType(Math.random(), CONFIG.COLLECTIBLES.WEIGHTS);

                const item = new Collectible(this.scene, type, x, y);
                this.collectibles.push(item);
                spawned++;
            }
        }
    }

    getCollectibleAt(x, y) {
        return this.collectibles.find(c => c.gridX === x && c.gridY === y);
    }

    removeCollectible(collectible) {
        const index = this.collectibles.indexOf(collectible);
        if (index > -1) {
            this.collectibles.splice(index, 1);
            collectible.destroy();
        }
    }

    render(layer) {
        const map = this.scene.make.tilemap({
            data: this.grid,
            tileWidth: TILE_SIZE,
            tileHeight: TILE_SIZE
        });
        const tiles = map.addTilesetImage('tiles', 'tiles', TILE_SIZE, TILE_SIZE, 1, 2);
        const tileLayer = map.createLayer(0, tiles, 0, 0);
        tileLayer.setDepth(0); // Ground layer
    }

    // The tilemap is static after render() — post-render grid edits don't show,
    // so landmarks are separate game objects. Must be called after render() and
    // before the cars are created (same depth, add order keeps them below cars).
    renderLandmarks() {
        this.baseMarker = this.createLandmarkMarker(this.base, 0xFFD700, '$', '#FFD700');
        for (const station of this.fuelStations) {
            this.createLandmarkMarker(station, 0x00FF00, 'F', '#00FF00');
        }
    }

    createLandmarkMarker(landmark, color, label, labelColor) {
        const bx = landmark.building.x * TILE_SIZE + TILE_SIZE / 2;
        const by = landmark.building.y * TILE_SIZE + TILE_SIZE / 2;

        // Building marker
        const rect = this.scene.add.rectangle(bx, by, TILE_SIZE - 6, TILE_SIZE - 6, 0x2a2a2a)
            .setStrokeStyle(3, color);
        const text = this.scene.add.text(bx, by, label, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: labelColor,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Subtle highlight on the pad tile so the player knows where to stop
        const px = landmark.pad.x * TILE_SIZE + TILE_SIZE / 2;
        const py = landmark.pad.y * TILE_SIZE + TILE_SIZE / 2;
        this.scene.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, color, 0.25);

        return [rect, text];
    }
}
