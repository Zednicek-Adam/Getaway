import Phaser from 'phaser';
import { TILE_SIZE, DIRECTIONS } from '../constants';
import { CONFIG } from '../config';
import { TurnQueue, isOpposite } from '../turnQueue';

export class Car {
    constructor(scene, gridX, gridY, mapManager, options = {}) {
        this.scene = scene;
        this.mapManager = mapManager;

        this.textureKey = options.textureKey ?? 'playerCar';
        this.frameByDirection = options.frameByDirection ?? {
            [DIRECTIONS.LEFT]: 0,
            [DIRECTIONS.UP]: 1,
            [DIRECTIONS.RIGHT]: 2,
            [DIRECTIONS.DOWN]: 3,
        };
        this.displaySize = options.displaySize ?? (TILE_SIZE * 0.6);

        // Grid State
        this.gridX = gridX;
        this.gridY = gridY;
        this.targetX = gridX;
        this.targetY = gridY;

        // Movement State
        this.direction = DIRECTIONS.RIGHT;
        this.turnQueue = new TurnQueue(CONFIG.PLAYER.QUEUE_MAX); // Buffered turns (FIFO)
        this.isMoving = false;
        this.moveConfig = {
            duration: CONFIG.PLAYER.MOVE_DURATION, // ms to cross one tile (Speed)
        };
        this.moveTimer = 0;

        // Visuals — depth 1 keeps cars above roads, collectibles and laid
        // bombs (depth <= 0.6) and below the HUD (99+)
        this.visual = this.scene.add.sprite(0, 0, this.textureKey, 0).setOrigin(0.5, 0.5).setDepth(1);
        this.render();
        this.updatePosition(0); // Set initial visual pos
    }

    update(time, delta) {
        if (this.isMoving) {
            this.moveTimer += delta;

            const t = Math.min(this.moveTimer / this.moveConfig.duration, 1);

            this.updatePosition(t);

            if (t >= 1) {
                this.finishMove();
            }
        } else {
            this.tryMove();
        }
    }

    updatePosition(t) {
        // Lerp logic
        const startX = this.gridX * TILE_SIZE + TILE_SIZE / 2;
        const startY = this.gridY * TILE_SIZE + TILE_SIZE / 2;
        const endX = this.targetX * TILE_SIZE + TILE_SIZE / 2;
        const endY = this.targetY * TILE_SIZE + TILE_SIZE / 2;

        const curX = Phaser.Math.Linear(startX, endX, t);
        const curY = Phaser.Math.Linear(startY, endY, t);

        this.visual.x = curX;
        this.visual.y = curY;

        this.applyDirectionFrame();
        this.visual.rotation = 0;
    }

    getFrameForDirection(direction) {
        return this.frameByDirection?.[direction];
    }

    applyDirectionFrame() {
        // Directional frames (no rotation required)
        const frame = this.getFrameForDirection(this.direction);
        if (frame !== undefined) {
            this.visual.setFrame(frame);
        }
    }

    finishMove() {
        this.gridX = this.targetX;
        this.gridY = this.targetY;
        this.isMoving = false;
        this.moveTimer = 0;

        // Check if we should continue moving
        this.tryMove();
    }

    tryMove() {
        // Logic:
        // 1. Is there a queued turn? If it's legal here, take it (consume it).
        // 2. Else, CAN we go straight? The queued turn is KEPT and retried
        //    at every subsequent tile until legal or cancelled.
        // 3. Else, Stop (blocked/dead-end: the car waits; the player can
        //    queue a valid direction or U-turn out).

        // Don't auto-move if waiting for player's first input
        if (this.waitingForInput) return;

        const front = this.turnQueue.peek();
        if (front !== undefined && this.canMove(front)) {
            this.startMove(front);
            this.turnQueue.shift(); // Turn Consumed
            return;
        }

        if (this.canMove(this.direction)) {
            this.startMove(this.direction); // Queue untouched — front retried at next tile
        }
    }

    canMove(dir) {
        let dx = 0;
        let dy = 0;

        switch (dir) {
            case DIRECTIONS.UP: dy = -1; break;
            case DIRECTIONS.DOWN: dy = 1; break;
            case DIRECTIONS.LEFT: dx = -1; break;
            case DIRECTIONS.RIGHT: dx = 1; break;
        }

        const potentialX = this.gridX + dx;
        const potentialY = this.gridY + dy;

        return this.mapManager.isRoad(potentialX, potentialY);
    }

    startMove(dir) {
        this.direction = dir;

        let dx = 0;
        let dy = 0;
        switch (dir) {
            case DIRECTIONS.UP: dy = -1; break;
            case DIRECTIONS.DOWN: dy = 1; break;
            case DIRECTIONS.LEFT: dx = -1; break;
            case DIRECTIONS.RIGHT: dx = 1; break;
        }

        this.targetX = this.gridX + dx;
        this.targetY = this.gridY + dy;
        this.isMoving = true;
    }

    // Player input path: queue the turn (or U-turn immediately when the
    // queue is empty and the press opposes the direction of travel)
    enqueueTurn(dir) {
        // First input clears the initial wait state
        if (this.waitingForInput) {
            this.waitingForInput = false;
        }

        if (this.turnQueue.length === 0 && isOpposite(dir, this.direction)) {
            this.performUturn(dir);
        } else {
            this.turnQueue.push(dir);
        }
    }

    // Compatibility wrapper for AI cars (PoliceCar re-decides at every tile
    // via decideNextMove, so clear-then-push keeps identical semantics)
    setBufferedInput(newDirection) {
        this.turnQueue.clear();

        // First input clears the initial wait state
        if (this.waitingForInput) {
            this.waitingForInput = false;
        }

        // Check for 180 turn immediately
        if (isOpposite(newDirection, this.direction)) {
            this.performUturn(newDirection);
        } else {
            this.turnQueue.push(newDirection);
        }
    }

    // Face the first open road direction (used right after spawning)
    faceAnyOpenDirection() {
        const order = [DIRECTIONS.RIGHT, DIRECTIONS.LEFT, DIRECTIONS.DOWN, DIRECTIONS.UP];
        for (const dir of order) {
            if (this.canMove(dir)) {
                this.direction = dir;
                break;
            }
        }
        this.updatePosition(0); // Refresh visual frame
    }

    // Random movement for AI cars; try not to U-turn unless it's a dead end
    pickRoamMove(validMoves) {
        const forwardMoves = validMoves.filter(m => !isOpposite(m, this.direction));
        if (forwardMoves.length > 0) {
            return forwardMoves[Math.floor(Math.random() * forwardMoves.length)];
        }
        return validMoves[Math.floor(Math.random() * validMoves.length)]; // Dead end
    }

    getValidMoves() {
        const moves = [];
        [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT].forEach(dir => {
            if (this.canMove(dir)) moves.push(dir);
        });
        return moves;
    }

    performUturn(newDir) {
        if (this.isMoving) {
            // Flip logic
            const tempX = this.gridX;
            const tempY = this.gridY;
            this.gridX = this.targetX;
            this.gridY = this.targetY;
            this.targetX = tempX;
            this.targetY = tempY;

            // Reverse progress
            this.moveTimer = this.moveConfig.duration - this.moveTimer;
        }

        this.direction = newDir;

        // A reversal invalidates any queued plans
        this.turnQueue.clear();
    }

    render() {
        // Ensure sizing is consistent with tile scale
        this.visual.setDisplaySize(this.displaySize, this.displaySize);
    }
}
