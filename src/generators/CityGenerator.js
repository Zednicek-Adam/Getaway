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

        const SPACING = 5;
        const START_OFFSET_X = 2;
        const START_OFFSET_Y = 2;
        // Make sure we don't go out of bounds
        const END_OFFSET_X = this.width - 3;
        const END_OFFSET_Y = this.height - 3;

        const nodes = [];
        for(let y = START_OFFSET_Y; y <= END_OFFSET_Y; y += SPACING) {
            for(let x = START_OFFSET_X; x <= END_OFFSET_X; x += SPACING) {
                nodes.push({x, y});
            }
        }

        // Find center node closest to spawnPoint
        let startNode = nodes.reduce((prev, curr) => {
            const distPrev = Math.abs(prev.x - spawnPoint.x) + Math.abs(prev.y - spawnPoint.y);
            const distCurr = Math.abs(curr.x - spawnPoint.x) + Math.abs(curr.y - spawnPoint.y);
            return distCurr < distPrev ? curr : prev;
        });

        // Snap spawnPoint to the startNode so the player spawns on a valid road intersection
        spawnPoint.x = startNode.x;
        spawnPoint.y = startNode.y;

        const visited = new Set();
        visited.add(`${startNode.x},${startNode.y}`);

        const final_edges = [];
        const frontier = [];

        const addNeighborsToFrontier = (node) => {
            const dirs = [[0, SPACING], [0, -SPACING], [SPACING, 0], [-SPACING, 0]];
            for (const [dx, dy] of dirs) {
                const nx = node.x + dx;
                const ny = node.y + dy;
                if (nx >= START_OFFSET_X && nx <= END_OFFSET_X && ny >= START_OFFSET_Y && ny <= END_OFFSET_Y) {
                    if (!visited.has(`${nx},${ny}`)) {
                        frontier.push({ from: node, to: { x: nx, y: ny } });
                    }
                }
            }
        };

        addNeighborsToFrontier(startNode);

        // Randomized BFS to build a Spanning Tree
        // This naturally expands outwards from the startNode in all directions
        while (frontier.length > 0) {
            // Pick a random edge from the frontier
            const idx = Math.floor(Math.random() * frontier.length);
            const edge = frontier.splice(idx, 1)[0];

            const toKey = `${edge.to.x},${edge.to.y}`;
            if (!visited.has(toKey)) {
                visited.add(toKey);
                final_edges.push(edge);
                addNeighborsToFrontier(edge.to);
            }
        }

        // Add loops to convert the spanning tree into a city network
        const all_possible_edges = [];
        for (const n1 of visited) {
            const [x1, y1] = n1.split(',').map(Number);
            const dirs = [[SPACING, 0], [0, SPACING]]; // Right and Down only to avoid duplicate edges
            for (const [dx, dy] of dirs) {
                const nx = x1 + dx;
                const ny = y1 + dy;
                if (nx >= START_OFFSET_X && nx <= END_OFFSET_X && ny >= START_OFFSET_Y && ny <= END_OFFSET_Y) {
                    all_possible_edges.push({ from: {x: x1, y: y1}, to: {x: nx, y: ny} });
                }
            }
        }

        const isEdgeInFinal = (e1) => {
            return final_edges.some(e2 =>
                (e1.from.x === e2.from.x && e1.from.y === e2.from.y && e1.to.x === e2.to.x && e1.to.y === e2.to.y) ||
                (e1.from.x === e2.to.x && e1.from.y === e2.to.y && e1.to.x === e2.from.x && e1.to.y === e2.from.y)
            );
        };

        for (const edge of all_possible_edges) {
            if (!isEdgeInFinal(edge)) {
                if (Math.random() < 0.35) { // 35% chance to create a loop (cross street)
                    final_edges.push(edge);
                }
            }
        }

        // Render the roads onto the grid
        for (const edge of final_edges) {
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
