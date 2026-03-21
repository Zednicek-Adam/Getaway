import { Car } from './Car';
import { DIRECTIONS, COLORS, TILE_SIZE } from '../constants';
import Phaser from 'phaser';

export class PoliceCar extends Car {
    constructor(scene, gridX, gridY, mapManager, target) {
        super(scene, gridX, gridY, mapManager);
        this.target = target; // The Player Car

        // Slightly slower or faster? 
        // Let's make it same speed for now
        this.moveConfig.duration = 350; // Slower than player (300)

        this.chaseTimer = 0; // Chase timer in ms
        this.sirenTimer = 0;
        this.sirenState = false;

        this.render(); // Re-render with police colors
    }

    // Override update to handle chase timer
    update(time, delta) {
        if (this.chaseTimer > 0) {
            this.chaseTimer -= delta;
            if (this.chaseTimer < 0) this.chaseTimer = 0;
        }

        // Siren animation
        this.sirenTimer += delta;
        if (this.sirenTimer > 150) { // Toggle every 150ms
            this.sirenTimer = 0;
            this.sirenState = !this.sirenState;
            this.render(); // Redraw with new siren state
        }

        super.update(time, delta);
    }

    // Override tryMove to evaluate routing at every tile/intersection
    tryMove() {
        this.decideNextMove();
        super.tryMove();
    }

    decideNextMove() {
        // Simple Chaser Logic
        // 1. Get valid directions from current tile
        const validMoves = this.getValidMoves();

        if (validMoves.length === 0) return; // Stuck?

        // 2. Pick best move towards target or random if not chasing
        let bestMove = null;

        if (this.chaseTimer > 0) {
            const path = this.findPathAStar(this.gridX, this.gridY, this.target.gridX, this.target.gridY);

            if (path && path.length > 1) {
                const nextX = path[1].x;
                const nextY = path[1].y;

                if (nextX > this.gridX) bestMove = DIRECTIONS.RIGHT;
                else if (nextX < this.gridX) bestMove = DIRECTIONS.LEFT;
                else if (nextY > this.gridY) bestMove = DIRECTIONS.DOWN;
                else if (nextY < this.gridY) bestMove = DIRECTIONS.UP;
            } else {
                // Fallback to random if no path found
                const forwardMoves = validMoves.filter(m => !this.isOpposite(m, this.direction));
                if (forwardMoves.length > 0) {
                    bestMove = forwardMoves[Math.floor(Math.random() * forwardMoves.length)];
                } else {
                    bestMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                }
            }
        } else {
            // Random movement when not chasing
            // Try not to U-turn unless it's a dead end
            const forwardMoves = validMoves.filter(m => !this.isOpposite(m, this.direction));
            if (forwardMoves.length > 0) {
                bestMove = forwardMoves[Math.floor(Math.random() * forwardMoves.length)];
            } else {
                bestMove = validMoves[Math.floor(Math.random() * validMoves.length)]; // Dead end
            }
        }

        if (bestMove !== null) {
            this.setBufferedInput(bestMove);
        }
    }

    findPathAStar(startX, startY, endX, endY) {
        const openSet = [];
        const closedSet = new Set();

        const startNode = {
            x: startX,
            y: startY,
            g: 0,
            h: Math.abs(startX - endX) + Math.abs(startY - endY),
            parent: null
        };
        startNode.f = startNode.g + startNode.h;

        openSet.push(startNode);

        let attempts = 0;

        while (openSet.length > 0 && attempts < 1000) {
            attempts++;
            // Sort to get node with lowest f
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();

            if (current.x === endX && current.y === endY) {
                const path = [];
                let curr = current;
                while (curr !== null) {
                    path.push({ x: curr.x, y: curr.y });
                    curr = curr.parent;
                }
                return path.reverse();
            }

            closedSet.add(`${current.x},${current.y}`);

            const neighbors = [
                { x: current.x, y: current.y - 1 },
                { x: current.x, y: current.y + 1 },
                { x: current.x - 1, y: current.y },
                { x: current.x + 1, y: current.y }
            ];

            for (let n of neighbors) {
                if (!this.mapManager.isRoad(n.x, n.y)) continue;

                const neighborKey = `${n.x},${n.y}`;
                if (closedSet.has(neighborKey)) continue;

                const tentativeG = current.g + 1;

                let neighborNode = openSet.find(node => node.x === n.x && node.y === n.y);
                if (!neighborNode) {
                    neighborNode = {
                        x: n.x,
                        y: n.y,
                        parent: current,
                        g: tentativeG,
                        h: Math.abs(n.x - endX) + Math.abs(n.y - endY)
                    };
                    neighborNode.f = neighborNode.g + neighborNode.h;
                    openSet.push(neighborNode);
                } else if (tentativeG < neighborNode.g) {
                    neighborNode.parent = current;
                    neighborNode.g = tentativeG;
                    neighborNode.f = neighborNode.g + neighborNode.h;
                }
            }
        }

        return null; // No path found
    }

    getValidMoves() {
        const moves = [];
        [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT].forEach(dir => {
            if (this.canMove(dir)) moves.push(dir);
        });
        return moves;
    }

    render() {
        this.visual.clear();

        // Base dimensions
        const carLength = 36;
        const carWidth = 20;
        const halfLen = carLength / 2;
        const halfWidth = carWidth / 2;

        // --- Tires ---
        this.visual.fillStyle(0x111111, 1);
        this.visual.fillRect(-halfLen + 4, -halfWidth - 2, 8, 4); // Top Left
        this.visual.fillRect(halfLen - 12, -halfWidth - 2, 8, 4); // Top Right
        this.visual.fillRect(-halfLen + 4, halfWidth - 2, 8, 4); // Bottom Left
        this.visual.fillRect(halfLen - 12, halfWidth - 2, 8, 4); // Bottom Right

        // --- Main Body ---
        this.visual.fillStyle(0xFFFFFF, 1); // White base for police car
        this.visual.fillRect(-halfLen, -halfWidth, carLength, carWidth);
        // Tapered front/back
        this.visual.fillRect(-halfLen - 2, -halfWidth + 2, 2, carWidth - 4); // back bumper
        this.visual.fillRect(halfLen, -halfWidth + 2, 4, carWidth - 4); // front hood

        // --- Police Blue Highlights ---
        this.visual.fillStyle(COLORS.POLICE, 1);
        // Paint the middle section blue (doors)
        this.visual.fillRect(-halfLen + 8, -halfWidth, 16, carWidth);

        // --- Windows (Dark tint) ---
        this.visual.fillStyle(0x000000, 0.8);
        this.visual.fillRect(-halfLen + 4, -halfWidth + 2, 4, carWidth - 4); // Rear
        this.visual.fillRect(halfLen - 12, -halfWidth + 2, 6, carWidth - 4); // Front
        this.visual.fillRect(-halfLen + 10, -halfWidth + 1, 12, 2); // top side
        this.visual.fillRect(-halfLen + 10, halfWidth - 3, 12, 2); // bottom side

        // --- Roof details ---
        this.visual.fillStyle(0xDDDDDD, 1); // Light grey roof
        this.visual.fillRect(-halfLen + 8, -halfWidth + 3, 16, carWidth - 6);

        // --- Siren Lightbar ---
        // Base bar
        this.visual.fillStyle(0x333333, 1);
        this.visual.fillRect(-halfLen + 14, -halfWidth + 2, 4, carWidth - 4);

        // Siren lights (animated)
        if (this.sirenState) {
            // State 1: Red Top, Blue Bottom
            this.visual.fillStyle(0xFF0000, 1); // Red
            this.visual.fillRect(-halfLen + 14, -halfWidth + 2, 4, 6);
            this.visual.fillStyle(0x0000FF, 1); // Blue
            this.visual.fillRect(-halfLen + 14, halfWidth - 8, 4, 6);
        } else {
            // State 2: Blue Top, Red Bottom
            this.visual.fillStyle(0x0000FF, 1); // Blue
            this.visual.fillRect(-halfLen + 14, -halfWidth + 2, 4, 6);
            this.visual.fillStyle(0xFF0000, 1); // Red
            this.visual.fillRect(-halfLen + 14, halfWidth - 8, 4, 6);
        }

        // --- Headlights & Taillights ---
        this.visual.fillStyle(0xFFFFDD, 1);
        this.visual.fillRect(halfLen + 2, -halfWidth + 2, 2, 4); // top light
        this.visual.fillRect(halfLen + 2, halfWidth - 6, 2, 4); // bottom light

        this.visual.fillStyle(0xFF5555, 1);
        this.visual.fillRect(-halfLen - 2, -halfWidth + 2, 2, 4); // top tail
        this.visual.fillRect(-halfLen - 2, halfWidth - 6, 2, 4); // bottom tail
    }
}
