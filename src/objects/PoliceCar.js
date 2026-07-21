import { Car } from './Car';
import { DIRECTIONS } from '../constants';
import { CONFIG } from '../config';
import { findPath } from '../pathfinding';

export class PoliceCar extends Car {
    constructor(scene, gridX, gridY, mapManager, target) {
        super(scene, gridX, gridY, mapManager, { textureKey: 'policeCar' });
        this.target = target; // The Player Car

        // Slightly slower or faster?
        // Let's make it same speed for now
        this.moveConfig.duration = CONFIG.POLICE.LEGACY_DURATION; // Slower than player

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
            const path = findPath(
                (x, y) => this.mapManager.isRoad(x, y),
                this.gridX, this.gridY,
                this.target.gridX, this.target.gridY
            );

            if (path && path.length > 0) {
                const nextX = path[0].x;
                const nextY = path[0].y;

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

    getValidMoves() {
        const moves = [];
        [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT].forEach(dir => {
            if (this.canMove(dir)) moves.push(dir);
        });
        return moves;
    }

}
