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
        this.turnQueue = []; // Queue of queued directions
        this.isMoving = false;
        this.moveConfig = {
            duration: 300, // ms to cross one tile (Speed)
        };
        this.speedMultiplier = 1.0;
        this.moveTimer = 0;

        // Visuals
        this.visual = this.scene.add.sprite(0, 0, this.textureKey, 0).setOrigin(0.5, 0.5);
        this.render();
        this.updatePosition(0); // Set initial visual pos
    }

    update(time, delta) {
        if (this.isMoving) {
            this.moveTimer += delta;

            const effectiveDuration = this.moveConfig.duration * (this.speedMultiplier || 1.0);
            const t = Math.min(this.moveTimer / effectiveDuration, 1);

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
        if (this.waitingForInput) return;

        let moved = false;

        // 1. Try to take the next queued turn
        while (this.turnQueue.length > 0) {
            let nextDir = this.turnQueue[0];
            if (this.canMove(nextDir)) {
                this.startMove(nextDir);
                this.turnQueue.shift(); // Turn Consumed
                moved = true;
                break;
            } else {
                // If queued turn is invalid here, we wait until next intersection
                break;
            }
        }

        // 2. If no valid queued turn found, keep going in current direction
        if (!moved) {
            if (this.canMove(this.direction)) {
                this.startMove(this.direction);
                moved = true;
            }
        }

        // 3. Wall / Dead End
        if (!moved) {
            this.isMoving = false;
            this.waitingForInput = true;
            this.turnQueue = []; // clear queued inputs when stopped
        }
        
        if (this.scene && this.scene.uiManager && this === this.scene.playerCar) {
            this.scene.uiManager.updateQueue(this.turnQueue);
        }
    }

    stopImmediately() {
        this.isMoving = false;
        this.waitingForInput = true;
        this.targetX = this.gridX;
        this.targetY = this.gridY;
        this.moveTimer = 0;
        this.turnQueue = [];
        this.updatePosition(0);
        if (this.scene && this.scene.uiManager && this === this.scene.playerCar) {
            this.scene.uiManager.updateQueue(this.turnQueue);
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

    setBufferedInput(newDirection) {
        // First input clears the initial wait state
        if (this.waitingForInput) {
            if (this.canMove(newDirection)) {
                this.direction = newDirection;
                this.waitingForInput = false;
                this.tryMove();
            } else if (this.isOpposite(newDirection, this.direction)) {
                this.performUturn(newDirection);
                this.waitingForInput = false;
                this.tryMove();
            }
            // If they pressed into the wall, do nothing, stay waiting
            return;
        }

        // Check for 180 turn immediately
        if (this.isOpposite(newDirection, this.direction) && this.turnQueue.length === 0) {
            this.performUturn(newDirection);
        } else {
            if (this.turnQueue.length < 3) {
                let lastDir = this.turnQueue.length > 0 ? this.turnQueue[this.turnQueue.length - 1] : this.direction;
                if (newDirection !== lastDir) {
                    this.turnQueue.push(newDirection);
                    if (this.scene && this.scene.uiManager && this === this.scene.playerCar) {
                        this.scene.uiManager.updateQueue(this.turnQueue);
                    }
                }
            }
        }
    }

    isOpposite(dir1, dir2) {
        return (dir1 === DIRECTIONS.UP && dir2 === DIRECTIONS.DOWN) ||
            (dir1 === DIRECTIONS.DOWN && dir2 === DIRECTIONS.UP) ||
            (dir1 === DIRECTIONS.LEFT && dir2 === DIRECTIONS.RIGHT) ||
            (dir1 === DIRECTIONS.RIGHT && dir2 === DIRECTIONS.LEFT);
    }
    
    getOpposite(dir) {
        if (dir === DIRECTIONS.UP) return DIRECTIONS.DOWN;
        if (dir === DIRECTIONS.DOWN) return DIRECTIONS.UP;
        if (dir === DIRECTIONS.LEFT) return DIRECTIONS.RIGHT;
        if (dir === DIRECTIONS.RIGHT) return DIRECTIONS.LEFT;
        return dir;
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
            const effectiveDuration = this.moveConfig.duration * (this.speedMultiplier || 1.0);
            this.moveTimer = effectiveDuration - this.moveTimer;
        }

        this.direction = newDir;
        this.turnQueue = []; // Clear queued turns on U-turn
        if (this.scene && this.scene.uiManager && this === this.scene.playerCar) {
            this.scene.uiManager.updateQueue(this.turnQueue);
        }
    }

    render() {
        // Ensure sizing is consistent with tile scale
        this.visual.setDisplaySize(this.displaySize, this.displaySize);
    }
}
