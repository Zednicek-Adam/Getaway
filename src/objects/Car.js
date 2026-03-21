import Phaser from 'phaser';
import { TILE_SIZE, COLORS, DIRECTIONS } from '../constants';

export class Car {
    constructor(scene, gridX, gridY, mapManager) {
        this.scene = scene;
        this.mapManager = mapManager;

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
        this.visual = this.scene.add.graphics();
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

        // Rotate visual to face direction
        // 0 = Up, 1 = Down, 2 = Left, 3 = Right
        // Phaser rotation is in radians. 0 is Right.
        let angle = 0;
        switch (this.direction) {
            case DIRECTIONS.RIGHT: angle = 0; break;
            case DIRECTIONS.DOWN: angle = Math.PI / 2; break;
            case DIRECTIONS.LEFT: angle = Math.PI; break;
            case DIRECTIONS.UP: angle = -Math.PI / 2; break;
        }
        this.visual.rotation = angle;
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
        this.visual.clear();
        const pixel = Math.max(1, Math.round(TILE_SIZE / 32));
        const bodyLength = pixel * 20;
        const bodyWidth = pixel * 12;
        const halfLength = bodyLength / 2;
        const halfWidth = bodyWidth / 2;

        // Higher-detail pixel body in robber palette
        this.visual.fillStyle(0x111111, 1);
        this.visual.fillRect(-halfLength, -halfWidth, bodyLength, bodyWidth);

        // Wheels
        this.visual.fillStyle(0x050505, 1);
        this.visual.fillRect(-halfLength + pixel * 2, -halfWidth - pixel, pixel * 3, pixel);
        this.visual.fillRect(halfLength - pixel * 5, -halfWidth - pixel, pixel * 3, pixel);
        this.visual.fillRect(-halfLength + pixel * 2, halfWidth, pixel * 3, pixel);
        this.visual.fillRect(halfLength - pixel * 5, halfWidth, pixel * 3, pixel);

        // Side stripe
        this.visual.fillStyle(0xF2F2F2, 1);
        this.visual.fillRect(-halfLength + pixel * 3, -pixel, bodyLength - pixel * 6, pixel * 2);

        // Robber red accent
        this.visual.fillStyle(0xA61616, 1);
        this.visual.fillRect(-halfLength + pixel * 2, -halfWidth + pixel * 2, pixel * 2, bodyWidth - pixel * 4);

        // Cabin shadow
        this.visual.fillStyle(0x2A2A2A, 1);
        this.visual.fillRect(-halfLength + pixel * 6, -halfWidth + pixel * 2, bodyLength - pixel * 10, bodyWidth - pixel * 4);

        // Rear dark bumper
        this.visual.fillStyle(0x1A1A1A, 1);
        this.visual.fillRect(-halfLength, -halfWidth + pixel * 2, pixel * 2, bodyWidth - pixel * 4);

        // Headlights
        this.visual.fillStyle(0xFFFFFF, 1);
        this.visual.fillRect(halfLength - pixel, -halfWidth + pixel * 2, pixel, pixel * 2);
        this.visual.fillRect(halfLength - pixel, halfWidth - pixel * 4, pixel, pixel * 2);
    }
}
