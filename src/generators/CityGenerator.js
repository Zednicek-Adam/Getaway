import { TILE_TYPES } from '../constants';

export class CityGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }

    generate(spawnPoint) {
        // Initialize grid with GRASS
        const grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(TILE_TYPES.GRASS);
            }
            grid.push(row);
        }

        const MIN_SPACING = 4;
        const MAX_SPACING = 8;
        const MARGIN = 3;

        // Use a branching random walk to create organic blocks
        const startNode = { x: spawnPoint.x, y: spawnPoint.y };

        const nodes = [startNode];
        const edges = [];

        // Queue of active ends (node, direction vector, generation)
        const frontier = [];

        // Initial 4 directions
        frontier.push({ from: startNode, dir: {dx: 0, dy: -1}, gen: 0 });
        frontier.push({ from: startNode, dir: {dx: 0, dy: 1}, gen: 0 });
        frontier.push({ from: startNode, dir: {dx: -1, dy: 0}, gen: 0 });
        frontier.push({ from: startNode, dir: {dx: 1, dy: 0}, gen: 0 });

        const MAX_NODES = 150; // Controls density/coverage

        while (frontier.length > 0 && nodes.length < MAX_NODES) {
            // Pick a random active end (BFS-like but random order to grow organically)
            const idx = Math.floor(Math.random() * frontier.length);
            const activeEnd = frontier.splice(idx, 1)[0];
            const { from, dir, gen } = activeEnd;

            // Decide road segment length
            const length = Math.floor(Math.random() * (MAX_SPACING - MIN_SPACING + 1)) + MIN_SPACING;

            const toX = from.x + dir.dx * length;
            const toY = from.y + dir.dy * length;

            // Check bounds
            if (toX < MARGIN || toX >= this.width - MARGIN || toY < MARGIN || toY >= this.height - MARGIN) {
                continue; // Too close to edge, stop this branch
            }

            const toNode = { x: toX, y: toY };

            // Check collision with existing nodes
            // We want to avoid creating intersections too close to each other
            let collision = false;
            let mergeNode = null;

            for (const existingNode of nodes) {
                const dist = Math.abs(existingNode.x - toNode.x) + Math.abs(existingNode.y - toNode.y);
                if (dist === 0) {
                    // Exact hit, perfectly fine to merge
                    mergeNode = existingNode;
                    break;
                } else if (dist < MIN_SPACING) {
                    // Too close, abort this branch entirely to keep constraints
                    collision = true;
                    break;
                }
            }

            if (collision) continue;

            // Also check if the new edge crosses existing edges illegally
            // Simple check: we just draw it and see if it intersects existing nodes perpendicularly
            // A more robust way is to just allow it and let the grid rendering handle intersections,
            // but we want to avoid messy clusters. We'll rely on the node distance check above.

            if (mergeNode) {
                // Connect and stop branching
                edges.push({ from, to: mergeNode });
            } else {
                // New node
                nodes.push(toNode);
                edges.push({ from, to: toNode });

                // Branching logic
                // Typically branch left, right, or straight.
                // Decrease probability as generation increases to thin out edges
                const branchProb = Math.max(0.2, 0.9 - (gen * 0.05));

                // Straight
                if (Math.random() < branchProb) {
                    frontier.push({ from: toNode, dir: {dx: dir.dx, dy: dir.dy}, gen: gen + 1 });
                }

                // Left turn
                if (Math.random() < branchProb) {
                    frontier.push({ from: toNode, dir: {dx: dir.dy, dy: -dir.dx}, gen: gen + 1 });
                }

                // Right turn
                if (Math.random() < branchProb) {
                    frontier.push({ from: toNode, dir: {dx: -dir.dy, dy: dir.dx}, gen: gen + 1 });
                }

                // Occasional T-junctions or cross intersections are naturally formed by multiple branches
            }
        }

        // Render edges to grid
        for (const edge of edges) {
            const minX = Math.min(edge.from.x, edge.to.x);
            const maxX = Math.max(edge.from.x, edge.to.x);
            const minY = Math.min(edge.from.y, edge.to.y);
            const maxY = Math.max(edge.from.y, edge.to.y);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    grid[y][x] = TILE_TYPES.ROAD_GENERIC;
                }
            }
        }

        return grid;
    }
}
