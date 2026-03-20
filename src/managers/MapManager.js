import { TILE_SIZE, COLORS, TILE_TYPES, DIRECTIONS } from '../constants';
import { Collectible, COLLECTIBLE_TYPES } from '../objects/Collectible';
import { NetworkGenerator } from '../generators/NetworkGenerator';

export class MapManager {
    constructor(scene, width, height) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.grid = []; // 2D Array [y][x]
        this.collectibles = []; // Array of Collectible objects
    }

    generate() {
        this.initializeGrid();
        this.generateProceduralMap();
        this.autoTileRoads();
        this.spawnRandomCollectibles(15);
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

            // Check if road and no existing collectible
            if (typeCode !== null && typeCode !== TILE_TYPES.GRASS && typeCode !== TILE_TYPES.BUILDING && !this.getCollectibleAt(x, y)) {
                // Random Type
                const type = Math.random() > 0.5 ? COLLECTIBLE_TYPES.MONEY : COLLECTIBLE_TYPES.FUEL;

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
}
