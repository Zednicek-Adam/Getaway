import Phaser from 'phaser';
import { TILE_SIZE, DIRECTIONS } from '../constants';

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
        this.nextDirection = DIRECTIONS.RIGHT; // Buffered Input
        this.isMoving = false;
        this.moveConfig = {
            duration: 300, // ms to cross one tile (Speed)
        };
        this.moveTimer = 0;

        // Visuals
        this.visual = this.scene.add.sprite(0, 0, this.textureKey, 0).setOrigin(0.5, 0.5);
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
        // 1. Is there a buffered turn? If yes, CAN we turn there?
        // 2. If no buffered turn or invalid turn, CAN we go straight?
        // 3. Else, Stop.

        // Don't auto-move if waiting for player's first input
        if (this.waitingForInput) return;

        let attempts = [];

        // If we have a buffered next direction
        if (this.nextDirection !== null) {
            attempts.push(this.nextDirection);
        }

        // Always try current direction as fallback (unless we just did a 180, handled separately)
        if (this.nextDirection !== this.direction) {
            attempts.push(this.direction);
        }

        for (let dir of attempts) {
            if (this.canMove(dir)) {
                this.startMove(dir);
                // Clear buffer if we used it
                if (dir === this.nextDirection) {
                    this.nextDirection = null; // Turn Consumed
                }
                return;
            }
        }

        // If we are here, we are blocked.
        // Maybe Stop?
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

    setBufferedInput(newDirection) {
        // First input clears the initial wait state
        if (this.waitingForInput) {
            this.waitingForInput = false;
        }

        // Check for 180 turn immediately
        if (this.isOpposite(newDirection, this.direction)) {
            this.performUturn(newDirection);
            this.nextDirection = null; // Consumed
        } else {
            this.nextDirection = newDirection;
        }
    }

    isOpposite(dir1, dir2) {
        return (dir1 === DIRECTIONS.UP && dir2 === DIRECTIONS.DOWN) ||
            (dir1 === DIRECTIONS.DOWN && dir2 === DIRECTIONS.UP) ||
            (dir1 === DIRECTIONS.LEFT && dir2 === DIRECTIONS.RIGHT) ||
            (dir1 === DIRECTIONS.RIGHT && dir2 === DIRECTIONS.LEFT);
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
    }

    render() {
        // Ensure sizing is consistent with tile scale
        this.visual.setDisplaySize(this.displaySize, this.displaySize);
    }
}
