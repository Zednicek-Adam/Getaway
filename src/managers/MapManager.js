import { TILE_SIZE, TILE_TYPES } from '../constants';
import { Collectible, pickCollectibleType } from '../objects/Collectible';
import { NetworkGenerator } from '../generators/NetworkGenerator';
import { CONFIG } from '../config';
import { buildGroundLayer } from '../cityLayout';
import { RailLine } from '../railway';
import { ART } from '../art';

// Inclusive integer in [min, max] — replaces Phaser.Math.Between so this
// module stays importable in plain node (tests import it directly).
function randomIntBetween(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

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
        this.trainBlocked = new Set(); // "x,y" keys — crossings with the barriers down
        // { line: RailLine, crossings: [loop index], station: { index, pad, building } | null }
        this.rail = null;
    }

    generate() {
        this.blocked = new Set(); // fresh overlay on every (re)generate
        this.trainBlocked = new Set();
        this.initializeGrid();
        this.rail = { line: new RailLine(this.width, this.height), crossings: [], station: null };
        this.generateProceduralMap();
        this.placeBase();
        this.placeStation();
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
            // The loop is a wall to the generator except at the crossings,
            // which are seeded as road stubs straight through the track
            const line = this.rail.line;
            const planned = line.pickCrossings();
            const barrier = new Set(line.cells
                .filter((_, i) => !planned.includes(i))
                .map(c => `${c.x},${c.y}`));
            const crossings = planned.map(i => ({
                ...line.cells[i],
                axis: line.axisAt(i) === 'H' ? 'V' : 'H',
            }));
            const generator = new NetworkGenerator(this.width, this.height, { barrier, crossings });
            this.grid = generator.generate(this.playerSpawnPoint);

            // Clean up any remaining dead-ends (safety net)
            this.removeDeadEnds();

            // A crossing the network never linked up on both sides was pruned
            // back to track; too few left over and the loop barely matters
            this.rail.crossings = planned.filter(i => this.isRoad(line.cells[i].x, line.cells[i].y));

            // Verify spawn is still connected to a valid road
            if (this.isRoad(this.playerSpawnPoint.x, this.playerSpawnPoint.y + 1) &&
                this.rail.crossings.length >= CONFIG.TRAIN.MIN_CROSSINGS) {
                success = true;
                console.log(`Map successfully generated after ${attempts} attempts.`);
            }
        }

        if (!success) {
            console.warn("NetworkGenerator failed after 50 attempts. Generating fallback.");
            this.generateFallbackMap();
        }
    }



    // A ring road outside the railway (no crossings: the train just circles)
    generateFallbackMap() {
        this.initializeGrid();
        this.rail.crossings = [];
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

    // Any loop cell: plain track, or a level crossing (track that is also road)
    isRail(x, y) {
        return !!this.rail && this.rail.line.has(x, y);
    }

    isCrossing(x, y) {
        return this.isRail(x, y) && this.isRoad(x, y);
    }

    // Free ground for a landmark building: neither road nor track
    isLot(x, y) {
        return this.getTile(x, y) !== null && !this.isRoad(x, y) && !this.isRail(x, y);
    }

    getRandomSpawnPoint() {
        // 1. Try Random Sampling
        for (let i = 0; i < 500; i++) {
            const x = randomIntBetween(2, this.width - 3);
            const y = randomIntBetween(2, this.height - 3);
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
                    reach.has(`${point.x},${point.y}`) && !this.isCrossing(point.x, point.y)) {
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
        const lot = inBounds.find(n => this.isLot(n.x, n.y));

        // Edge case: all in-bounds neighbors are road — overwrite one anyway
        // (never the track, which would cut the loop)
        return lot || inBounds.find(n => !this.isRail(n.x, n.y)) || inBounds[0];
    }

    // The station sits beside a straight stretch of track, its platform pad on
    // the road next to it. The bullion car stops level with the pad, so the
    // whole stopped train has to be clear of crossings.
    placeStation() {
        // Strict pass first; if no platform fits, accept a train that blocks
        // a crossing while it stands at the station
        const behind = 2 + CONFIG.TRAIN.WAGONS[1] + 1; // cells the stopped train trails back
        let candidates = this.stationCandidates(3, behind);
        if (candidates.length === 0) candidates = this.stationCandidates(0, 0);
        if (candidates.length === 0) {
            this.rail.station = null; // no platform this map: the train never stops
            return;
        }

        // The top of the loop if possible, so the station is easy to find
        const top = candidates.filter(c => c.top);
        const pool = top.length > 0 ? top : candidates;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const building = this.pickAdjacentBuildingTile(pick.pad);
        this.setTile(building.x, building.y, TILE_TYPES.BUILDING);
        this.rail.station = { index: pick.index, pad: pick.pad, building };
    }

    // Straight track cells with a road pad beside them (and a lot for the
    // building), at least `ahead` / `behind` cells from any crossing
    stationCandidates(ahead, behind) {
        const line = this.rail.line;
        const candidates = [];
        for (let i = 0; i < line.length; i++) {
            const axis = line.axisAt(i);
            if (!axis || this.isRoad(line.cells[i].x, line.cells[i].y)) continue;
            const nearCrossing = this.rail.crossings.some((c) => {
                const dist = line.wrap(c - i);
                return dist <= ahead || line.length - dist <= behind;
            });
            if (nearCrossing) continue;

            const { x, y } = line.cells[i];
            const sides = axis === 'H' ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]];
            for (const [px, py] of sides) {
                if (!this.isRoad(px, py) || this.isRail(px, py) || this.isBasePad(px, py)) continue;
                const near = [[px, py - 1], [px, py + 1], [px - 1, py], [px + 1, py]];
                if (!near.some(([nx, ny]) => this.isLot(nx, ny))) continue;
                candidates.push({ index: i, pad: { x: px, y: py }, top: line.moves[i] === 'R' });
            }
        }
        return candidates;
    }

    isStationPad(x, y) {
        const station = this.rail && this.rail.station;
        return !!station && station.pad.x === x && station.pad.y === y;
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
            if (this.isStationPad(x, y) || this.isCrossing(x, y)) continue;
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
        return neighbors.some(([nx, ny]) => this.isLot(nx, ny));
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

    // Roadblocks and lowered crossing barriers live in separate sets so
    // clearing one can never lift the other
    isBlocked(x, y) {
        const key = `${x},${y}`;
        return this.blocked.has(key) || this.trainBlocked.has(key);
    }

    setTrainBlocked(x, y, on) {
        const key = `${x},${y}`;
        if (on) this.trainBlocked.add(key);
        else this.trainBlocked.delete(key);
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
            const x = randomIntBetween(1, this.width - 2);
            const y = randomIntBetween(1, this.height - 2);

            const typeCode = this.getTile(x, y);

            // Check if road, no existing collectible, and keep base/station pads clear
            if (typeCode !== null && typeCode !== TILE_TYPES.GRASS && typeCode !== TILE_TYPES.BUILDING &&
                !this.getCollectibleAt(x, y) && !this.isBasePad(x, y) && !this.getFuelStationAt(x, y) &&
                !this.isStationPad(x, y) && !this.isBlocked(x, y)) {
                // Weighted type from the spawn table (fuel no longer spawns —
                // stations are the fuel source). The rail pass only joins the
                // table once it's unlocked, so the weights may not sum to 1.
                const weights = this.collectibleWeights();
                const total = Object.values(weights).reduce((a, b) => a + b, 0);
                const type = pickCollectibleType(Math.random() * total, weights);

                const item = new Collectible(this.scene, type, x, y);
                this.collectibles.push(item);
                spawned++;
            }
        }
    }

    // GameScene swaps this for one that knows the garage unlocks
    collectibleWeights() {
        return CONFIG.COLLECTIBLES.WEIGHTS;
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

    // The logic grid only knows road / not road; cityLayout turns that into
    // autotiled streets and dressed city blocks (purely cosmetic).
    render() {
        const landmarks = [this.base, ...this.fuelStations];
        if (this.rail.station) landmarks.push(this.rail.station);
        const reserved = new Set(landmarks.map(l => `${l.building.x},${l.building.y}`));
        // Track cells get plain ground; the rail layer draws over them
        for (const { x, y } of this.rail.line.cells) {
            if (!this.isRoad(x, y)) reserved.add(`${x},${y}`);
        }
        const data = buildGroundLayer(this.width, this.height, (x, y) => this.isRoad(x, y), reserved);

        const map = this.scene.make.tilemap({
            data,
            tileWidth: TILE_SIZE,
            tileHeight: TILE_SIZE
        });
        const tiles = map.addTilesetImage('city', 'city', TILE_SIZE, TILE_SIZE, ART.city.margin, ART.city.spacing);
        const tileLayer = map.createLayer(0, tiles, 0, 0);
        tileLayer.setDepth(0); // Ground layer

        this.renderRails();
    }

    // Second tilemap over the ground: track pieces keyed by the loop's local
    // shape (tools/art_rail.py), and rails across the road on crossings
    renderRails() {
        const line = this.rail.line;
        const data = [];
        for (let y = 0; y < this.height; y++) data.push(new Array(this.width).fill(-1));
        line.cells.forEach(({ x, y }, i) => {
            data[y][x] = this.isRoad(x, y)
                ? ART.rail.crossing[line.axisAt(i)]
                : ART.rail.tiles[line.signature(i)];
        });

        const map = this.scene.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
        const tiles = map.addTilesetImage('rail', 'rail', TILE_SIZE, TILE_SIZE, ART.rail.margin, ART.rail.spacing);
        map.createLayer(0, tiles, 0, 0).setDepth(0.05);
    }

    // The tilemap is static after render() — post-render grid edits don't show,
    // so landmarks are separate game objects. Must be called after render() and
    // before the cars are created (depth keeps them below cars regardless).
    renderLandmarks() {
        this.baseMarker = this.createLandmark(this.base, 'safehouse', 'padBase');
        for (const station of this.fuelStations) {
            this.createLandmark(station, 'fuelStation', 'padFuel');
        }
        if (this.rail.station) {
            this.createLandmark(this.rail.station, 'station', 'padStation');
        }
    }

    createLandmark(landmark, buildingKey, padKey) {
        const bx = landmark.building.x * TILE_SIZE + TILE_SIZE / 2;
        const by = landmark.building.y * TILE_SIZE + TILE_SIZE / 2;
        const building = this.scene.add.image(bx, by, buildingKey).setDepth(0.12);

        // Painted bay on the pad tile so the player knows where to stop; it
        // breathes gently so it reads as a place to go, not road decoration
        const px = landmark.pad.x * TILE_SIZE + TILE_SIZE / 2;
        const py = landmark.pad.y * TILE_SIZE + TILE_SIZE / 2;
        const pad = this.scene.add.image(px, py, padKey).setDepth(0.1);
        this.scene.tweens.add({
            targets: pad, alpha: 0.55, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        return building;
    }
}
