import { Car } from './Car';
import { DIRECTIONS } from '../constants';

export class PoliceCar extends Car {
    constructor(scene, gridX, gridY, mapManager, target) {
        super(scene, gridX, gridY, mapManager, { textureKey: 'policeCar' });
        this.target = target; // The Player Car

        // Slightly slower or faster? 
        // Let's make it same speed for now
        this.moveConfig.duration = 350; // Slower than player (300)

        this.chaseTimer = 0; // Chase timer in ms

        // Siren animation (policeblue.png is a 4x2 sheet)
        this.sirenOn = false;
        this.sirenBlinkTimer = 0;
        this.sirenBlinkInterval = 150; // ms
    }

    // Override update to handle chase timer
    update(time, delta) {
        if (this.chaseTimer > 0) {
            this.chaseTimer -= delta;
            if (this.chaseTimer < 0) this.chaseTimer = 0;

            this.sirenBlinkTimer += delta;
            if (this.sirenBlinkTimer >= this.sirenBlinkInterval) {
                this.sirenBlinkTimer = 0;
                this.sirenOn = !this.sirenOn;
            }
        } else {
            this.sirenOn = false;
            this.sirenBlinkTimer = 0;
        }

        super.update(time, delta);

        // Keep siren updating even if not moving
        this.applyDirectionFrame();
    }

    getFrameForDirection(direction) {
        const baseFrame = super.getFrameForDirection(direction);
        if (baseFrame === undefined) return undefined;

        // Row 0: normal (0-3), Row 1: siren on (4-7)
        return baseFrame + (this.sirenOn ? 4 : 0);
    }

    hasLineOfSight() {
        if (!this.target) return false;

        // Straight line check (orthogonal or diagonal raycast)
        const dx = Math.sign(this.target.gridX - this.gridX);
        const dy = Math.sign(this.target.gridY - this.gridY);

        let cx = this.gridX + dx;
        let cy = this.gridY + dy;

        while (cx !== this.target.gridX || cy !== this.target.gridY) {
            if (!this.mapManager.isRoad(cx, cy)) {
                return false; // Building blocked vision!
            }
            if (cx !== this.target.gridX) cx += dx;
            if (cy !== this.target.gridY) cy += dy;
        }
        return true;
    }

    // Override tryMove to evaluate routing at every tile/intersection
    tryMove() {
        this.decideNextMove();
        super.tryMove();
    }

    decideNextMove() {
        const validMoves = this.getValidMoves();
        if (validMoves.length === 0) return;

        const hasLOS = this.hasLineOfSight();
        if (hasLOS) {
            this.lastKnownTarget = { x: this.target.gridX, y: this.target.gridY };
        }

        let bestMove = null;

        if (this.chaseTimer > 0) {
            const destX = hasLOS ? this.target.gridX : (this.lastKnownTarget ? this.lastKnownTarget.x : this.target.gridX);
            const destY = hasLOS ? this.target.gridY : (this.lastKnownTarget ? this.lastKnownTarget.y : this.target.gridY);

            const path = this.findPathAStar(this.gridX, this.gridY, destX, destY);

            if (path && path.length > 1) {
                const nextX = path[1].x;
                const nextY = path[1].y;

                if (nextX > this.gridX) bestMove = DIRECTIONS.RIGHT;
                else if (nextX < this.gridX) bestMove = DIRECTIONS.LEFT;
                else if (nextY > this.gridY) bestMove = DIRECTIONS.DOWN;
                else if (nextY < this.gridY) bestMove = DIRECTIONS.UP;
            } else {
                const forwardMoves = validMoves.filter(m => !this.isOpposite(m, this.direction));
                if (forwardMoves.length > 0) {
                    bestMove = forwardMoves[Math.floor(Math.random() * forwardMoves.length)];
                } else {
                    bestMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                }
            }
        } else {
            const forwardMoves = validMoves.filter(m => !this.isOpposite(m, this.direction));
            if (forwardMoves.length > 0) {
                bestMove = forwardMoves[Math.floor(Math.random() * forwardMoves.length)];
            } else {
                bestMove = validMoves[Math.floor(Math.random() * validMoves.length)];
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

    takeHit() {
        return true; // Standard police are destroyed in 1 hit
    }
}
