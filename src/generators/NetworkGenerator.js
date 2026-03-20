import { TILE_TYPES } from '../constants';

/**
 * Growing-tree network generator.
 *
 * Builds a road network outward from the player spawn point, guaranteeing:
 *  - Full connectivity (no isolated islands)
 *  - Balanced quadrant growth (NE/NW/SE/SW)
 *  - Zig-zag / curved roads (not pure orthogonal grids)
 *  - Minimum intersection spacing (≥3 tiles)
 *  - No dead-ends except the player spawn tile
 *  - Good map coverage (no large empty areas)
 */
export class NetworkGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        // Direction vectors: 0=Up, 1=Right, 2=Down, 3=Left
        this.dx = [0, 1, 0, -1];
        this.dy = [-1, 0, 1, 0];

        // Generation parameters
        this.MIN_INTERSECTION_SPACING = 3;
        this.MIN_SEGMENT_LENGTH = 3;
        this.MAX_SEGMENT_LENGTH = 7;
        this.TARGET_ROAD_RATIO = 0.25; // ~25% of usable area should be roads
        this.MARGIN = 2; // Keep roads away from the very edge
    }

    generate(spawnPoint) {
        const { width, height } = this;

        // Initialize grid: 0 = grass, 1 = road
        this.road = new Uint8Array(width * height);
        this.centerX = spawnPoint.x;
        this.centerY = spawnPoint.y;

        // Protected tiles: these must NEVER become road during generation
        // The tile above spawn must always be grass (dead-end)
        this.protectedGrass = new Set();
        this.protectedGrass.add(this._idx(spawnPoint.x, spawnPoint.y - 1));
        // Also protect diagonals above spawn to prevent accidental connections
        if (spawnPoint.y - 1 >= 0) {
            this.protectedGrass.add(this._idx(spawnPoint.x - 1, spawnPoint.y - 1));
            this.protectedGrass.add(this._idx(spawnPoint.x + 1, spawnPoint.y - 1));
        }
        if (spawnPoint.y - 2 >= 0) {
            this.protectedGrass.add(this._idx(spawnPoint.x, spawnPoint.y - 2));
        }
        // Protect tile directly below the T-junction to keep it as T (Top-Right-Left)
        // This prevents network growth from connecting downward into the T-junction
        if (spawnPoint.y + 2 < height) {
            this.protectedGrass.add(this._idx(spawnPoint.x, spawnPoint.y + 2));
        }

        // Place spawn: dead-end at spawn, T-junction below (Top-Right-Left)
        this._setRoad(spawnPoint.x, spawnPoint.y);
        this._setRoad(spawnPoint.x, spawnPoint.y + 1);

        // The T-junction below spawn connects Up (to spawn), Right, and Left ONLY
        const tjX = spawnPoint.x;
        const tjY = spawnPoint.y + 1;

        // Track frontier: tiles that can grow new branches
        this.frontier = [];

        // Grow only Right and Left arms from the T-junction (NOT down)
        this._growArm(tjX, tjY, 1, 5 + Math.floor(Math.random() * 3)); // Right
        this._growArm(tjX, tjY, 3, 5 + Math.floor(Math.random() * 3)); // Left

        // Main growth loop — multiple passes with different strategies
        this._growNetwork();

        // Aggressive fill pass to eliminate large empty areas
        for (let pass = 0; pass < 3; pass++) {
            this._fillEmptyRegions();
        }

        // Create loop connections to eliminate dead-ends naturally
        this._createLoopConnections();

        // Remove any dead-ends (except spawn)
        this._removeDeadEnds(spawnPoint);

        // Ensure connectivity
        this._ensureConnectivity(spawnPoint);

        // Final dead-end cleanup after connectivity bridges
        this._removeDeadEnds(spawnPoint);

        // CRITICAL: Enforce spawn protection — clear protected grass tiles
        for (const idx of this.protectedGrass) {
            this.road[idx] = 0;
        }

        // Convert to result grid
        return this._toGrid();
    }

    // ── Road helpers ──

    _idx(x, y) {
        return y * this.width + x;
    }

    _inBounds(x, y) {
        return x >= this.MARGIN && x < this.width - this.MARGIN &&
            y >= this.MARGIN && y < this.height - this.MARGIN;
    }

    _isRoad(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        return this.road[this._idx(x, y)] === 1;
    }

    _setRoad(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const idx = this._idx(x, y);
            // Never place road on protected grass tiles
            if (this.protectedGrass && this.protectedGrass.has(idx)) return;
            this.road[idx] = 1;
        }
    }

    _roadCount() {
        let c = 0;
        for (let i = 0; i < this.road.length; i++) if (this.road[i]) c++;
        return c;
    }

    _roadNeighborCount(x, y) {
        let c = 0;
        for (let d = 0; d < 4; d++) {
            if (this._isRoad(x + this.dx[d], y + this.dy[d])) c++;
        }
        return c;
    }

    /**
     * Check if placing a road tile at (x,y) would create a new intersection
     * too close to an existing one. Uses Manhattan distance.
     */
    _wouldViolateSpacing(x, y) {
        const futureNeighborCount = this._roadNeighborCount(x, y);

        // Will this tile become an intersection? (≥3 road neighbors)
        if (futureNeighborCount >= 3) {
            if (this._nearbyIntersection(x, y, this.MIN_INTERSECTION_SPACING)) return true;
        }

        // Check if any existing neighbor would become a new intersection
        for (let d = 0; d < 4; d++) {
            const nx = x + this.dx[d];
            const ny = y + this.dy[d];
            if (!this._isRoad(nx, ny)) continue;

            // Current neighbor count + 1 (for the new tile at x,y)
            const nCount = this._roadNeighborCount(nx, ny) + 1;
            if (nCount >= 3) {
                if (this._nearbyIntersection(nx, ny, this.MIN_INTERSECTION_SPACING)) return true;
            }
        }

        return false;
    }

    _nearbyIntersection(x, y, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx === 0 && dy === 0) continue;
                // Use Manhattan distance for more predictable spacing
                if (Math.abs(dx) + Math.abs(dy) > radius) continue;
                const cx = x + dx;
                const cy = y + dy;
                if (!this._isRoad(cx, cy)) continue;
                if (this._roadNeighborCount(cx, cy) >= 3) return true;
            }
        }
        return false;
    }

    // ── Quadrant balancing ──

    _getQuadrant(x, y) {
        // 0=NW, 1=NE, 2=SW, 3=SE
        const right = x >= this.centerX;
        const below = y >= this.centerY;
        return (below ? 2 : 0) + (right ? 1 : 0);
    }

    _quadrantCounts() {
        const counts = [0, 0, 0, 0];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.road[this._idx(x, y)]) {
                    counts[this._getQuadrant(x, y)]++;
                }
            }
        }
        return counts;
    }

    // ── Main growth ──

    _growArm(startX, startY, dir, length) {
        let x = startX;
        let y = startY;

        for (let i = 0; i < length; i++) {
            const nx = x + this.dx[dir];
            const ny = y + this.dy[dir];

            if (!this._inBounds(nx, ny)) break;
            if (i > 0 && this._isRoad(nx, ny)) break;

            this._setRoad(nx, ny);
            x = nx;
            y = ny;
        }

        if (this._inBounds(x, y) && (x !== startX || y !== startY)) {
            this.frontier.push({ x, y });
        }
    }

    _growNetwork() {
        const usableArea = (this.width - 2 * this.MARGIN) * (this.height - 2 * this.MARGIN);
        const targetRoads = Math.floor(usableArea * this.TARGET_ROAD_RATIO);
        let iterations = 0;
        const maxIterations = targetRoads * 20;
        let staleCount = 0;

        while (this._roadCount() < targetRoads && this.frontier.length > 0 && iterations < maxIterations) {
            iterations++;

            const tile = this._pickFrontierTile();
            if (!tile) break;

            const grew = this._tryGrowSegment(tile);

            if (!grew) {
                const idx = this.frontier.indexOf(tile);
                if (idx >= 0) this.frontier.splice(idx, 1);
                staleCount++;

                // If we're stalling, add all road edge tiles back to frontier
                if (staleCount > 50) {
                    this._refreshFrontier();
                    staleCount = 0;
                }
            } else {
                staleCount = 0;
            }
        }
    }

    _refreshFrontier() {
        // Find all road tiles that have at least one non-road in-bounds neighbor
        this.frontier = [];
        for (let y = this.MARGIN; y < this.height - this.MARGIN; y++) {
            for (let x = this.MARGIN; x < this.width - this.MARGIN; x++) {
                if (!this._isRoad(x, y)) continue;
                for (let d = 0; d < 4; d++) {
                    const nx = x + this.dx[d];
                    const ny = y + this.dy[d];
                    if (this._inBounds(nx, ny) && !this._isRoad(nx, ny)) {
                        this.frontier.push({ x, y });
                        break;
                    }
                }
            }
        }
    }

    _pickFrontierTile() {
        if (this.frontier.length === 0) return null;

        const qCounts = this._quadrantCounts();
        const minQ = Math.min(...qCounts);

        // Strongly prefer tiles in the least-populated quadrant
        const underRepresented = [];
        const normal = [];

        for (const tile of this.frontier) {
            const q = this._getQuadrant(tile.x, tile.y);
            if (qCounts[q] <= minQ * 1.3) {
                underRepresented.push(tile);
            } else {
                normal.push(tile);
            }
        }

        // 80% chance to pick from under-represented quadrant
        if (underRepresented.length > 0 && (normal.length === 0 || Math.random() < 0.8)) {
            return underRepresented[Math.floor(Math.random() * underRepresented.length)];
        }
        const pool = normal.length > 0 ? normal : underRepresented;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    _tryGrowSegment(tile) {
        const dirs = this._shuffleArray([0, 1, 2, 3]);

        for (const dir of dirs) {
            const nx = tile.x + this.dx[dir];
            const ny = tile.y + this.dy[dir];

            if (!this._inBounds(nx, ny)) continue;
            if (this._isRoad(nx, ny)) continue;

            const len = this.MIN_SEGMENT_LENGTH +
                Math.floor(Math.random() * (this.MAX_SEGMENT_LENGTH - this.MIN_SEGMENT_LENGTH + 1));

            const placed = this._buildZigZagSegment(tile.x, tile.y, dir, len);

            if (placed > 0) {
                return true;
            }
        }

        return false;
    }

    _buildZigZagSegment(startX, startY, mainDir, targetLength) {
        let x = startX;
        let y = startY;
        let currentDir = mainDir;
        let placed = 0;
        let straightCount = 0;

        // How often to zig-zag: every 2-3 tiles
        const zigInterval = 2 + Math.floor(Math.random() * 2);
        // Decide segment style:
        // 40% straight, 35% zig-zag, 25% curved (gradual direction change)
        const style = Math.random();
        const doZigZag = style < 0.35;
        const doCurve = style >= 0.35 && style < 0.60;

        for (let i = 0; i < targetLength; i++) {
            // Zig-zag: periodically step perpendicular
            if (doZigZag && straightCount >= zigInterval && i < targetLength - 1) {
                const perpDirs = this._getPerpendicularDirs(currentDir);
                const perpDir = perpDirs[Math.floor(Math.random() * perpDirs.length)];

                const px = x + this.dx[perpDir];
                const py = y + this.dy[perpDir];

                if (this._inBounds(px, py) && !this._isRoad(px, py) &&
                    !this._wouldViolateSpacing(px, py) && !this._wouldCreate2x2Block(px, py)) {
                    this._setRoad(px, py);
                    x = px;
                    y = py;
                    placed++;
                    straightCount = 0;
                    continue;
                }
            }

            // Curve: periodically change the main direction to perpendicular
            if (doCurve && straightCount >= zigInterval && i < targetLength - 1) {
                const perpDirs = this._getPerpendicularDirs(currentDir);
                currentDir = perpDirs[Math.floor(Math.random() * perpDirs.length)];
                straightCount = 0;
            }

            const nx = x + this.dx[currentDir];
            const ny = y + this.dy[currentDir];

            if (!this._inBounds(nx, ny)) break;

            // If we hit an existing road, we form a natural loop — great!
            if (this._isRoad(nx, ny)) {
                break;
            }

            if (this._wouldViolateSpacing(nx, ny)) break;
            if (this._wouldCreate2x2Block(nx, ny)) break;

            this._setRoad(nx, ny);
            x = nx;
            y = ny;
            placed++;
            straightCount++;
        }

        // Add endpoint to frontier
        if (placed > 0 && this._inBounds(x, y)) {
            this.frontier.push({ x, y });

            // Try to loop back: connect to a nearby road (60% chance attempt)
            if (Math.random() < 0.6) {
                this._tryLoop(x, y, currentDir);
            }
        }

        return placed;
    }

    _tryLoop(x, y, avoidDir) {
        const dirs = this._shuffleArray([0, 1, 2, 3]);

        for (const dir of dirs) {
            if (dir === ((avoidDir + 2) % 4)) continue; // Don't go back

            for (let dist = 2; dist <= 6; dist++) {
                const tx = x + this.dx[dir] * dist;
                const ty = y + this.dy[dir] * dist;

                if (!this._inBounds(tx, ty)) break;

                if (this._isRoad(tx, ty)) {
                    // Check bridge feasibility
                    let canBridge = true;
                    for (let d = 1; d < dist; d++) {
                        const bx = x + this.dx[dir] * d;
                        const by = y + this.dy[dir] * d;
                        if (!this._inBounds(bx, by)) { canBridge = false; break; }
                        if (this._isRoad(bx, by)) { canBridge = false; break; }
                        if (this._wouldCreate2x2Block(bx, by)) { canBridge = false; break; }
                    }

                    if (canBridge) {
                        // Simulate placing all tiles and check spacing
                        let spacingOk = true;
                        // Temporarily place tiles to check cascading effects
                        const tempTiles = [];
                        for (let d = 1; d < dist; d++) {
                            const bx = x + this.dx[dir] * d;
                            const by = y + this.dy[dir] * d;
                            this._setRoad(bx, by);
                            tempTiles.push({ x: bx, y: by });
                        }

                        // Verify no intersection violations
                        for (const t of tempTiles) {
                            if (this._roadNeighborCount(t.x, t.y) >= 3) {
                                if (this._nearbyIntersection(t.x, t.y, this.MIN_INTERSECTION_SPACING)) {
                                    spacingOk = false;
                                    break;
                                }
                            }
                        }

                        if (!spacingOk) {
                            // Undo
                            for (const t of tempTiles) {
                                this.road[this._idx(t.x, t.y)] = 0;
                            }
                        } else {
                            return true; // Bridge placed successfully
                        }
                    }
                    break;
                }
            }
        }
        return false;
    }

    /**
     * After main growth, scan for dead-end tiles and try to connect them
     * to nearby roads to create loops, rather than just removing them.
     */
    _createLoopConnections() {
        for (let y = this.MARGIN; y < this.height - this.MARGIN; y++) {
            for (let x = this.MARGIN; x < this.width - this.MARGIN; x++) {
                if (!this._isRoad(x, y)) continue;
                if (this._roadNeighborCount(x, y) !== 1) continue; // Dead end

                // Try to loop it into the network
                this._tryLoop(x, y, -1); // -1 = don't avoid any direction
            }
        }
    }

    _wouldCreate2x2Block(x, y) {
        const offsets = [
            [0, 0], [-1, 0], [0, -1], [-1, -1]
        ];
        for (const [ox, oy] of offsets) {
            const bx = x + ox;
            const by = y + oy;
            let count = 0;
            for (let dy = 0; dy <= 1; dy++) {
                for (let dx = 0; dx <= 1; dx++) {
                    const cx = bx + dx;
                    const cy = by + dy;
                    if (cx === x && cy === y) { count++; continue; }
                    if (this._isRoad(cx, cy)) count++;
                }
            }
            if (count >= 4) return true;
        }
        return false;
    }

    // ── Fill empty regions ──

    _fillEmptyRegions() {
        const regionSize = 5;
        const step = 2; // Tight overlapping scan
        const { width, height } = this;

        for (let ry = this.MARGIN; ry < height - this.MARGIN - regionSize; ry += step) {
            for (let rx = this.MARGIN; rx < width - this.MARGIN - regionSize; rx += step) {
                let roadCount = 0;
                for (let y = ry; y < ry + regionSize && y < height; y++) {
                    for (let x = rx; x < rx + regionSize && x < width; x++) {
                        if (this._isRoad(x, y)) roadCount++;
                    }
                }

                // If region has very few roads, extend into it
                if (roadCount < 2) {
                    this._extendRoadIntoRegion(rx, ry, regionSize);
                }
            }
        }
    }

    _extendRoadIntoRegion(rx, ry, size) {
        const regionCenterX = rx + Math.floor(size / 2);
        const regionCenterY = ry + Math.floor(size / 2);

        // Find nearest road tile to region center
        let bestDist = Infinity;
        let bestX = -1, bestY = -1;

        const searchRadius = size + 8;
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                const cx = regionCenterX + dx;
                const cy = regionCenterY + dy;
                if (this._isRoad(cx, cy)) {
                    const dist = Math.abs(dx) + Math.abs(dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestX = cx;
                        bestY = cy;
                    }
                }
            }
        }

        if (bestX < 0) return;

        // Build a path from the nearest road tile toward the region center
        this._buildPath(bestX, bestY, regionCenterX, regionCenterY);

        // Also try to extend further through the region to create throughways
        // (not just stubs that end in the center)
        const farX = regionCenterX + (regionCenterX - bestX);
        const farY = regionCenterY + (regionCenterY - bestY);
        if (this._inBounds(farX, farY)) {
            this._buildPath(regionCenterX, regionCenterY, farX, farY);
        }
    }

    _buildPath(fromX, fromY, toX, toY) {
        let x = fromX;
        let y = fromY;
        let steps = 0;
        const maxSteps = 25;

        while ((x !== toX || y !== toY) && steps < maxSteps) {
            steps++;

            let dir;
            const ddx = toX - x;
            const ddy = toY - y;

            if (Math.random() < 0.65) {
                // Move in the axis with greater distance
                if (Math.abs(ddx) > Math.abs(ddy)) {
                    dir = ddx > 0 ? 1 : 3;
                } else {
                    dir = ddy > 0 ? 2 : 0;
                }
            } else {
                // Perpendicular for variety
                if (Math.abs(ddx) > Math.abs(ddy)) {
                    dir = ddy >= 0 ? 2 : 0;
                } else {
                    dir = ddx >= 0 ? 1 : 3;
                }
            }

            const nx = x + this.dx[dir];
            const ny = y + this.dy[dir];

            if (!this._inBounds(nx, ny)) break;
            if (this._wouldCreate2x2Block(nx, ny)) {
                // Try other direction
                const altDir = (dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
                const anx = x + this.dx[altDir];
                const any = y + this.dy[altDir];
                if (this._inBounds(anx, any) && !this._wouldCreate2x2Block(anx, any)) {
                    if (!this._isRoad(anx, any)) this._setRoad(anx, any);
                    x = anx;
                    y = any;
                    continue;
                }
                break;
            }

            if (!this._isRoad(nx, ny)) {
                this._setRoad(nx, ny);
            }

            x = nx;
            y = ny;
        }

        // Add endpoint to frontier for further growth
        if (this._inBounds(x, y) && (x !== fromX || y !== fromY)) {
            this.frontier.push({ x, y });
        }
    }

    // ── Dead-end removal ──

    _removeDeadEnds(spawnPoint) {
        let changed = true;
        let passes = 0;

        while (changed && passes < 200) {
            changed = false;
            passes++;

            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (!this._isRoad(x, y)) continue;

                    // Protect spawn tile
                    if (x === spawnPoint.x && y === spawnPoint.y) continue;

                    if (this._roadNeighborCount(x, y) <= 1) {
                        this.road[this._idx(x, y)] = 0;
                        changed = true;
                    }
                }
            }
        }
    }

    // ── Connectivity ──

    _ensureConnectivity(spawnPoint) {
        const { width, height } = this;

        // BFS from spawn
        const visited = this._bfsFrom(spawnPoint.x, spawnPoint.y);

        // Find any disconnected road tiles and bridge them
        let bridgeAttempts = 0;

        while (bridgeAttempts < 30) {
            let foundDisconnected = false;

            for (let y = 0; y < height && !foundDisconnected; y++) {
                for (let x = 0; x < width && !foundDisconnected; x++) {
                    if (this._isRoad(x, y) && !visited[this._idx(x, y)]) {
                        foundDisconnected = true;

                        // Find nearest connected road tile
                        let best = null;
                        let bestDist = Infinity;

                        for (let sy = 0; sy < height; sy++) {
                            for (let sx = 0; sx < width; sx++) {
                                if (visited[this._idx(sx, sy)] && this._isRoad(sx, sy)) {
                                    const dist = Math.abs(sx - x) + Math.abs(sy - y);
                                    if (dist < bestDist) {
                                        bestDist = dist;
                                        best = { x: sx, y: sy };
                                    }
                                }
                            }
                        }

                        if (best) {
                            this._buildPath(x, y, best.x, best.y);

                            // Re-run BFS
                            const newVisited = this._bfsFrom(spawnPoint.x, spawnPoint.y);
                            visited.set(newVisited);
                        }
                    }
                }
            }

            if (!foundDisconnected) break;
            bridgeAttempts++;
        }

        // Remove anything still unreachable
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (this._isRoad(x, y) && !visited[this._idx(x, y)]) {
                    this.road[this._idx(x, y)] = 0;
                }
            }
        }
    }

    _bfsFrom(startX, startY) {
        const { width, height } = this;
        const visited = new Uint8Array(width * height);
        const stack = [];

        if (this._isRoad(startX, startY)) {
            const startIdx = this._idx(startX, startY);
            stack.push(startIdx);
            visited[startIdx] = 1;
        }

        while (stack.length > 0) {
            const idx = stack.pop();
            const cx = idx % width;
            const cy = Math.floor(idx / width);

            for (let d = 0; d < 4; d++) {
                const nx = cx + this.dx[d];
                const ny = cy + this.dy[d];
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                const nIdx = this._idx(nx, ny);
                if (this._isRoad(nx, ny) && !visited[nIdx]) {
                    visited[nIdx] = 1;
                    stack.push(nIdx);
                }
            }
        }

        return visited;
    }

    // ── Output ──

    _toGrid() {
        const grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(this.road[this._idx(x, y)] ? TILE_TYPES.ROAD_GENERIC : TILE_TYPES.GRASS);
            }
            grid.push(row);
        }
        return grid;
    }

    // ── Util ──

    _getPerpendicularDirs(dir) {
        if (dir === 0 || dir === 2) return [1, 3];
        return [0, 2];
    }

    _shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
}
