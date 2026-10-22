import Phaser from 'phaser';
import { TILE_SIZE, DIRECTIONS } from '../constants';
import { CONFIG } from '../config';
import { TurnQueue, DoubleTap, isOpposite, pickMove, steer } from '../turnQueue';

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
        // Vehicle sheets are drawn on a full-tile 64px frame (car + drop shadow)
        this.displaySize = options.displaySize ?? TILE_SIZE;
        // AI cars route around roadblocks (getValidMoves excludes blocked tiles);
        // the player is constructed with false so only they can crash into one.
        this.avoidsBlocked = options.avoidsBlocked ?? true;

        // Rail riding (player only). `passable(x, y, car)` replaces the plain road
        // check; `trackFollow(car)` returns the direction the track forces on a
        // plain rail cell (null elsewhere); `railPath(t, car)` places the car on the
        // drawn rails mid-move ({ x, y, heading } with heading 0-7 clockwise
        // from up) or returns null for an ordinary road move.
        this.passable = options.passable ?? null;
        this.trackFollow = options.trackFollow ?? null;
        this.railPath = options.railPath ?? null;
        // Frames for the four diagonal headings: UR, DR, DL, UL
        this.diagonalFrames = options.diagonalFrames ?? null;

        // Grid State
        this.gridX = gridX;
        this.gridY = gridY;
        this.targetX = gridX;
        this.targetY = gridY;

        // Movement State
        this.direction = DIRECTIONS.RIGHT;
        this.turnQueue = new TurnQueue(CONFIG.PLAYER.QUEUE_MAX); // Buffered turns (FIFO)
        this.reverseTap = new DoubleTap(CONFIG.PLAYER.DOUBLE_TAP_MS); // Back pressed twice
        this.isMoving = false;
        this.halted = false; // Player brake toggle (stop to refuel / wait)
        this.stalled = false; // Player out of fuel and not being pushed (set by GameScene)
        // Optional (x, y) => bool, asked on arriving at each tile: true brakes
        // there (sets halted). GameScene uses it to stop a dry car at a pump.
        this.brakeAt = options.brakeAt ?? null;
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
        const onRail = this.railPath && this.railPath(t, this);
        if (onRail) {
            this.visual.x = onRail.x;
            this.visual.y = onRail.y;
            this.visual.rotation = 0;
            this.applyHeadingFrame(onRail.heading);
            return;
        }

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

    // heading 0-7 clockwise from up; odd headings are the diagonals
    applyHeadingFrame(heading) {
        if (heading % 2 === 1 && this.diagonalFrames) {
            this.visual.setFrame(this.diagonalFrames[(heading - 1) / 2]);
            return;
        }
        const byHeading = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];
        const frame = this.getFrameForDirection(byHeading[Math.round(heading / 2) % 4]);
        if (frame !== undefined) this.visual.setFrame(frame);
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

        if (this.brakeAt && this.brakeAt(this.gridX, this.gridY)) {
            this.halted = true;
            return;
        }

        // Check if we should continue moving
        this.tryMove();
    }

    tryMove() {
        // Don't auto-move if waiting for first input, braked by the player, or
        // stalled on an empty tank. Checked only between tiles, so a stall
        // finishes the current tile first.
        if (this.waitingForInput || this.halted || this.stalled) return;

        // On plain track the rails steer: queued turns wait for a crossing
        const forced = this.trackFollow && this.trackFollow(this);
        if (forced !== null && forced !== undefined) {
            if (this.canMove(forced)) this.startMove(forced);
            return;
        }

        // Queued turns fire at the first junction that allows them (see pickMove)
        const dir = pickMove(this.turnQueue, this.direction, (d) => this.canMove(d));
        if (dir !== null) {
            this.startMove(dir);
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

        const open = this.passable
            ? this.passable(potentialX, potentialY, this)
            : this.mapManager.isRoad(potentialX, potentialY);
        if (!open) return false;
        return !(this.avoidsBlocked && this.mapManager.isBlocked(potentialX, potentialY));
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

    // Player input path: queue the turn, or U-turn (see steer)
    enqueueTurn(dir) {
        // First input clears the initial wait state; steering also releases the brake
        if (this.waitingForInput) {
            this.waitingForInput = false;
        }
        this.halted = false;

        const now = this.scene.time.now;
        if (steer(this.turnQueue, this.reverseTap, this.direction, dir, now) === 'uturn') {
            this.performUturn(dir);
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

    // Subclasses with extra display objects (siren glow, sparkles) extend this
    destroy() {
        this.visual.destroy();
    }
}
