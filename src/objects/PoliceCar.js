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
        this.sirenTimer += delta;
        if (this.sirenTimer >= 180) {
            this.sirenTimer = 0;
            this.sirenState = !this.sirenState;
            this.render();
        }

        if (this.chaseTimer > 0) {
            this.chaseTimer -= delta;
            if (this.chaseTimer < 0) this.chaseTimer = 0;
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
        const pixel = Math.round(TILE_SIZE / 16);
        const bodyLength = pixel * 10;
        const bodyWidth = pixel * 6;
        const halfLength = bodyLength / 2;
        const halfWidth = bodyWidth / 2;

        this.visual.fillStyle(0x0F244F, 1);
        this.visual.fillRect(-halfLength, -halfWidth, bodyLength, bodyWidth);

        this.visual.fillStyle(COLORS.POLICE, 1);
        this.visual.fillRect(-halfLength + pixel, -halfWidth + pixel, bodyLength - pixel * 2, bodyWidth - pixel * 2);

        this.visual.fillStyle(0xE8E8E8, 1);
        this.visual.fillRect(-halfLength + pixel * 3, -pixel, bodyLength - pixel * 6, pixel * 2);

        const activeRed = this.sirenState ? 0xFF3A3A : 0x5A1616;
        const activeBlue = this.sirenState ? 0x163A8C : 0x4FA2FF;
        this.visual.fillStyle(activeRed, 1);
        this.visual.fillRect(-pixel, -halfWidth, pixel * 2, pixel);
        this.visual.fillStyle(activeBlue, 1);
        this.visual.fillRect(-pixel, halfWidth - pixel, pixel * 2, pixel);

        this.visual.fillStyle(0xFFD88A, 1);
        this.visual.fillRect(halfLength - pixel, -halfWidth + pixel, pixel, pixel * 2);
        this.visual.fillRect(halfLength - pixel, halfWidth - pixel * 3, pixel, pixel * 2);
    }
}
