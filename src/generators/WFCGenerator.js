import { TILE_TYPES } from '../constants';

export class WFCGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }

    /**
     * Generates an organic grid-based road network centered on spawnPoint.
     *
     * Algorithm:
     *  1. Build a grid of intersection nodes spaced CELL_SIZE tiles apart,
     *     centered exactly on the spawn point so roads grow in all 4 directions.
     *  2. Connect every pair of adjacent nodes with a straight road segment
     *     (full grid = guaranteed coverage, no isolated islands).
     *  3. Remove ~30% of the non-essential connections (only when both
     *     endpoints have degree > 2) to break up the monotony while keeping
     *     every node reachable with ≥ 2 connections.
     *  4. The four connections touching the spawn node are always kept so the
     *     player always has roads in all 4 directions at start.
     */
    generate(spawnPoint) {
        const { width, height } = this;
        const BORDER = 3;       // Minimum tile distance from map edge
        const CELL_SIZE = 7;    // Tiles between adjacent intersection nodes
        const REMOVE_PROB = 0.3; // Chance to remove a non-essential connection

        const roads = new Uint8Array(width * height);

        const setRoad = (x, y) => {
            if (x >= BORDER && x < width - BORDER && y >= BORDER && y < height - BORDER)
                roads[y * width + x] = 1;
        };

        // ── 1. Build axis-aligned grid node positions centered on spawn ──────
        const genAxisPositions = (center, max) => {
            const positions = [];
            for (let k = 0; ; k++) {
                const v = center - k * CELL_SIZE;
                if (v < BORDER) break;
                positions.unshift(v);
            }
            for (let k = 1; ; k++) {
                const v = center + k * CELL_SIZE;
                if (v >= max - BORDER) break;
                positions.push(v);
            }
            return positions;
        };

        const xs = genAxisPositions(spawnPoint.x, width);
        const ys = genAxisPositions(spawnPoint.y, height);
        const nX = xs.length;
        const nY = ys.length;

        // ── 2. Build full connection list and track degree per node ──────────
        const nodeIdx = (cx, cy) => cy * nX + cx;
        const degree = new Int32Array(nY * nX);
        const connections = [];

        // Horizontal connections
        for (let cy = 0; cy < nY; cy++) {
            for (let cx = 0; cx < nX - 1; cx++) {
                connections.push({ cx1: cx, cy1: cy, cx2: cx + 1, cy2: cy });
                degree[nodeIdx(cx, cy)]++;
                degree[nodeIdx(cx + 1, cy)]++;
            }
        }
        // Vertical connections
        for (let cy = 0; cy < nY - 1; cy++) {
            for (let cx = 0; cx < nX; cx++) {
                connections.push({ cx1: cx, cy1: cy, cx2: cx, cy2: cy + 1 });
                degree[nodeIdx(cx, cy)]++;
                degree[nodeIdx(cx, cy + 1)]++;
            }
        }

        // ── 3. Identify spawn node and protect its connections ───────────────
        const spawnCx = xs.indexOf(spawnPoint.x);
        const spawnCy = ys.indexOf(spawnPoint.y);

        const touchesSpawn = (c) =>
            (c.cx1 === spawnCx && c.cy1 === spawnCy) ||
            (c.cx2 === spawnCx && c.cy2 === spawnCy);

        // ── 4. Randomly remove non-essential connections ─────────────────────
        // Shuffle for unbiased removal
        for (let i = connections.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [connections[i], connections[j]] = [connections[j], connections[i]];
        }

        const kept = new Uint8Array(connections.length).fill(1);
        for (let i = 0; i < connections.length; i++) {
            const c = connections[i];
            if (touchesSpawn(c)) continue; // always keep spawn connections

            const i1 = nodeIdx(c.cx1, c.cy1);
            const i2 = nodeIdx(c.cx2, c.cy2);
            if (degree[i1] > 2 && degree[i2] > 2 && Math.random() < REMOVE_PROB) {
                kept[i] = 0;
                degree[i1]--;
                degree[i2]--;
            }
        }

        // ── 5. Draw kept connections as road tiles ───────────────────────────
        for (let i = 0; i < connections.length; i++) {
            if (!kept[i]) continue;
            const { cx1, cy1, cx2, cy2 } = connections[i];
            const x1 = xs[cx1], y1 = ys[cy1];
            const x2 = xs[cx2], y2 = ys[cy2];

            if (y1 === y2) {
                // Horizontal segment
                for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) setRoad(x, y1);
            } else {
                // Vertical segment
                for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) setRoad(x1, y);
            }
        }

        // ── 6. Convert road bitmap to TILE_TYPES grid ────────────────────────
        const resultGrid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push(roads[y * width + x] ? TILE_TYPES.ROAD_GENERIC : TILE_TYPES.GRASS);
            }
            resultGrid.push(row);
        }
        return resultGrid;
    }
}
