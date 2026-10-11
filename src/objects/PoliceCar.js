import Phaser from 'phaser';
import { Car } from './Car';
import { DIRECTIONS } from '../constants';
import { CONFIG } from '../config';
import { findPath } from '../pathfinding';
import { gunshot, hoofDust } from '../fx';

// A posse deputy on horseback. While the chase is on he rides hard, kicking
// up dust, and fires his revolver into the air every few seconds; the shots
// are only for show.
export class PoliceCar extends Car {
    constructor(scene, gridX, gridY, mapManager, target, manager = null, options = {}) {
        super(scene, gridX, gridY, mapManager, { textureKey: 'deputy', ...options });
        this.target = target;   // The Player Car
        this.manager = manager; // PoliceManager (null-safe: standalone = permanent roam)

        // Baseline speed; PoliceManager re-applies the per-star duration each frame
        this.moveConfig.duration = CONFIG.POLICE.BY_STARS[0].duration;

        // Time to the next warning shot; desynchronised so a posse doesn't
        // fire in volleys
        this.shotTimer = Phaser.Math.Between(400, 2600);
        this.dustTimer = 0;

        // Combat state (ramDamage/unitType consumed by later WPs)
        this.stunRemaining = 0;
        this.ramDamage = 1;
        this.unitType = 'police';
        this.hp = 1; // regular police die to any single hit
    }

    update(time, delta) {
        this.stunRemaining = Math.max(0, this.stunRemaining - delta);
        super.update(time, delta);
        this.updateShots(delta);

        this.dustTimer += delta;
        if (this.isMoving && this.isChaseActive() && this.dustTimer >= 200) {
            this.dustTimer = 0;
            hoofDust(this.scene, this, { scale: this.unitType === 'swat' ? 1.2 : 0.8 });
        }
    }

    isChaseActive() {
        return !!this.manager && this.manager.state.isChasing();
    }

    // Warning shots while chasing, from the rider's gun hand
    updateShots(delta) {
        if (!this.isChaseActive() || this.unitType !== 'police') return;
        this.shotTimer -= delta;
        if (this.shotTimer > 0) return;
        this.shotTimer = Phaser.Math.Between(1800, 3600);
        const side = { [DIRECTIONS.UP]: [12, -6], [DIRECTIONS.DOWN]: [-12, 6],
            [DIRECTIONS.LEFT]: [-6, -12], [DIRECTIONS.RIGHT]: [6, 12] }[this.direction];
        gunshot(this.scene, this.visual.x + side[0], this.visual.y + side[1]);
    }

    // Override tryMove to evaluate routing at every tile/intersection
    tryMove() {
        // Stunned after a ram — hold position. Car.update only calls tryMove
        // when !isMoving, so a mid-move stun lets the current lerp finish.
        if (this.stunRemaining > 0) return;
        if (this.decideNextMove() === 'hold') return;
        super.tryMove();
    }

    // Freeze this unit for ms with a brief alpha flash cue
    stun(ms) {
        this.stunRemaining = ms;
        this.scene.tweens.add({
            targets: this.visual,
            alpha: 0.4,
            duration: 100,
            yoyo: true,
            repeat: 2,
            onComplete: () => this.visual.setAlpha(1),
        });
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
            // Parked beside the crossing the rail-riding player must use: wait
            if (goal && goal.x === this.gridX && goal.y === this.gridY && this.manager.state.onRails) {
                return 'hold';
            }
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

        // The player is on the track where no cop can follow: wait for them
        // beside a crossing instead
        const rail = this.scene.railManager;
        if (rail && this.manager && this.manager.state.onRails) {
            return rail.policeGoal(this, player, mode);
        }

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
            (x, y) => this.mapManager.isRoad(x, y) && !this.mapManager.isBlocked(x, y),
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
