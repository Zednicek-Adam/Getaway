import { Car } from './Car';
import { DIRECTIONS } from '../constants';
import { CONFIG } from '../config';
import { findPath } from '../pathfinding';

export class PoliceCar extends Car {
    constructor(scene, gridX, gridY, mapManager, target, manager = null) {
        super(scene, gridX, gridY, mapManager, { textureKey: 'policeCar' });
        this.target = target;   // The Player Car
        this.manager = manager; // PoliceManager (null-safe: standalone = permanent roam)

        // Baseline speed; PoliceManager re-applies the per-star duration each frame
        this.moveConfig.duration = CONFIG.POLICE.BY_STARS[0].duration;

        // Siren animation (policeblue.png is a 4x2 sheet)
        this.sirenOn = false;
        this.sirenBlinkTimer = 0;
        this.sirenBlinkInterval = 150; // ms
    }

    update(time, delta) {
        this.updateSiren(delta);

        super.update(time, delta);

        // Keep siren updating even if not moving
        this.applyDirectionFrame();
    }

    isChaseActive() {
        return !!this.manager && this.manager.state.isChasing();
    }

    updateSiren(delta) {
        if (this.isChaseActive()) {
            this.sirenBlinkTimer += delta;
            if (this.sirenBlinkTimer >= this.sirenBlinkInterval) {
                this.sirenBlinkTimer = 0;
                this.sirenOn = !this.sirenOn;
            }
        } else {
            this.sirenOn = false;
            this.sirenBlinkTimer = 0;
        }
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
        const validMoves = this.getValidMoves();
        if (validMoves.length === 0) return; // Stuck?

        const mode = this.isChaseActive()
            ? CONFIG.POLICE.BY_STARS[this.manager.state.stars].ai
            : 'roam';

        let bestMove = null;
        if (mode !== 'roam') {
            const goal = this.pickChaseGoal(mode);
            if (goal) {
                bestMove = this.stepTowards(goal.x, goal.y);
            }
        }

        // No goal or no path — fall back to roaming
        if (bestMove === null) {
            bestMove = this.pickRoamMove(validMoves);
        }

        if (bestMove !== null) {
            this.setBufferedInput(bestMove);
        }
    }

    // Chase target tile for the current AI mode; null means roam instead
    pickChaseGoal(mode) {
        const player = this.target;

        if (mode === 'direct') {
            return { x: player.gridX, y: player.gridY };
        }

        if (mode === 'intercept') {
            return this.projectInterceptTile();
        }

        if (mode === 'near') {
            const dist = Math.abs(player.gridX - this.gridX) + Math.abs(player.gridY - this.gridY);
            if (dist <= CONFIG.POLICE.AWARE_RADIUS) {
                return { x: player.gridX, y: player.gridY };
            }
            const lastKnown = this.manager?.lastKnown;
            if (lastKnown && !(lastKnown.x === this.gridX && lastKnown.y === this.gridY)) {
                return lastKnown;
            }
            return null; // Already at last-known (or none) — roam
        }

        return null;
    }

    // Player position projected forward along their facing, walking tile by
    // tile and stopping at the last road tile (falls back to the player tile)
    projectInterceptTile() {
        const player = this.target;

        let dx = 0;
        let dy = 0;
        switch (player.direction) {
            case DIRECTIONS.UP: dy = -1; break;
            case DIRECTIONS.DOWN: dy = 1; break;
            case DIRECTIONS.LEFT: dx = -1; break;
            case DIRECTIONS.RIGHT: dx = 1; break;
        }

        let x = player.gridX;
        let y = player.gridY;
        for (let i = 0; i < CONFIG.POLICE.INTERCEPT_LOOKAHEAD; i++) {
            if (!this.mapManager.isRoad(x + dx, y + dy)) break;
            x += dx;
            y += dy;
        }
        return { x, y };
    }

    // First step of the A* path towards (goalX, goalY); null when unreachable
    stepTowards(goalX, goalY) {
        const path = findPath(
            (x, y) => this.mapManager.isRoad(x, y),
            this.gridX, this.gridY,
            goalX, goalY
        );
        if (!path || path.length === 0) return null;

        const next = path[0];
        if (next.x > this.gridX) return DIRECTIONS.RIGHT;
        if (next.x < this.gridX) return DIRECTIONS.LEFT;
        if (next.y > this.gridY) return DIRECTIONS.DOWN;
        if (next.y < this.gridY) return DIRECTIONS.UP;
        return null;
    }

    // pickRoamMove / getValidMoves are inherited from Car
}
