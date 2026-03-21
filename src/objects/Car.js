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

        // Pixel art style car, drawn facing right.
        // Base dimensions (relative to center 0,0)
        const carLength = 36;
        const carWidth = 20;
        const halfLen = carLength / 2;
        const halfWidth = carWidth / 2;

        // --- Tires ---
        this.visual.fillStyle(0x111111, 1); // Dark grey/black for tires
        // Top Left
        this.visual.fillRect(-halfLen + 4, -halfWidth - 2, 8, 4);
        // Top Right
        this.visual.fillRect(halfLen - 12, -halfWidth - 2, 8, 4);
        // Bottom Left
        this.visual.fillRect(-halfLen + 4, halfWidth - 2, 8, 4);
        // Bottom Right
        this.visual.fillRect(halfLen - 12, halfWidth - 2, 8, 4);

        // --- Main Body (Bank Robber Red) ---
        this.visual.fillStyle(COLORS.PLAYER, 1);
        // Main rectangle
        this.visual.fillRect(-halfLen, -halfWidth, carLength, carWidth);
        // Tapered front/back slightly
        this.visual.fillRect(-halfLen - 2, -halfWidth + 2, 2, carWidth - 4); // back bumper
        this.visual.fillRect(halfLen, -halfWidth + 2, 4, carWidth - 4); // front hood

        // --- Windows (Dark tint) ---
        this.visual.fillStyle(0x000000, 0.7);
        // Rear window
        this.visual.fillRect(-halfLen + 4, -halfWidth + 2, 4, carWidth - 4);
        // Windshield
        this.visual.fillRect(halfLen - 12, -halfWidth + 2, 6, carWidth - 4);
        // Side windows
        this.visual.fillRect(-halfLen + 10, -halfWidth + 1, 12, 2); // top side
        this.visual.fillRect(-halfLen + 10, halfWidth - 3, 12, 2); // bottom side

        // --- Roof details ---
        this.visual.fillStyle(0x8B0000, 1); // Darker red for roof top to add depth
        this.visual.fillRect(-halfLen + 8, -halfWidth + 3, 16, carWidth - 6);

        // --- Headlights ---
        this.visual.fillStyle(0xFFFFDD, 1); // Bright warm yellow
        this.visual.fillRect(halfLen + 2, -halfWidth + 2, 2, 4); // top light
        this.visual.fillRect(halfLen + 2, halfWidth - 6, 2, 4); // bottom light

        // --- Taillights ---
        this.visual.fillStyle(0xFF5555, 1); // Bright red
        this.visual.fillRect(-halfLen - 2, -halfWidth + 2, 2, 4);
        this.visual.fillRect(-halfLen - 2, halfWidth - 6, 2, 4);
    }
}
