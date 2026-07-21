import { CONFIG } from '../config';
import { PoliceCar } from '../objects/PoliceCar';

// Owns the police fleet: reconciles unit count and speed to the star table
// each frame, tracks the player's last-known position, and handles despawns
// and (WP5) bombed-unit respawns.
export class PoliceManager {
    constructor(scene, mapManager, state, playerCar) {
        this.scene = scene;
        this.mapManager = mapManager;
        this.state = state;
        this.playerCar = playerCar;

        this.units = [];           // PoliceCar instances
        this.pendingRespawns = []; // scene.time.now timestamps (bombed units, WP5)
        this.lastKnown = null;     // { x, y } — where the player was last seen
    }

    update(time, delta) {
        // (a) Reconcile fleet size to the star table
        const target = this.targetCount();
        while (this.units.length < target) {
            this.spawnUnit();
        }
        if (this.units.length > target) {
            this.despawnFarthest(this.units.length - target);
        }

        // (b) Per-star speed applies to every unit, mid-move included
        // (Car.update clamps t at 1, so a shortened duration is safe)
        const duration = CONFIG.POLICE.BY_STARS[this.state.stars].duration;
        for (const unit of this.units) {
            unit.moveConfig.duration = duration;
        }

        // (c) Drive the units
        for (const unit of this.units) {
            unit.update(time, delta);
        }

        // (d) Track the player's position while any unit has eyes on them
        if (this.isPlayerSpotted()) {
            this.lastKnown = { x: this.playerCar.gridX, y: this.playerCar.gridY };
        }

        // (e) Queued respawns whose time arrived (skip when the fleet is full)
        while (this.pendingRespawns.length > 0 && this.pendingRespawns[0] <= time) {
            this.pendingRespawns.shift();
            if (this.units.length < this.targetCount()) {
                this.spawnUnit();
            }
        }
    }

    targetCount() {
        return CONFIG.POLICE.BY_STARS[this.state.stars].units.police;
    }

    spawnUnit() {
        const spawn = this.mapManager.getSpawnPointAwayFrom(
            this.playerCar.gridX, this.playerCar.gridY, CONFIG.POLICE.SPAWN_MIN_DIST);

        const unit = new PoliceCar(this.scene, spawn.x, spawn.y, this.mapManager, this.playerCar, this);
        unit.faceAnyOpenDirection();
        this.units.push(unit);
        return unit;
    }

    // Remove the n units farthest from the player; units within the spot
    // radius never vanish in view (deferred — retried next frame naturally)
    despawnFarthest(n) {
        const px = this.playerCar.gridX;
        const py = this.playerCar.gridY;
        const manhattan = (u) => Math.abs(u.gridX - px) + Math.abs(u.gridY - py);

        const byDistanceDesc = [...this.units].sort((a, b) => manhattan(b) - manhattan(a));
        for (const unit of byDistanceDesc) {
            if (n <= 0) break;
            if (manhattan(unit) <= CONFIG.CHASE.SPOT_RADIUS) continue;
            this.removeUnit(unit);
            n--;
        }
    }

    // WP5: bombed unit — remove immediately, queue a delayed replacement
    destroyUnit(unit) {
        this.removeUnit(unit);
        this.pendingRespawns.push(this.scene.time.now + CONFIG.POLICE.RESPAWN_AFTER_BOMB_MS);
    }

    removeUnit(unit) {
        const index = this.units.indexOf(unit);
        if (index > -1) {
            this.units.splice(index, 1);
        }
        unit.visual.destroy();
    }

    despawnAll() {
        for (const unit of this.units) {
            unit.visual.destroy();
        }
        this.units = [];
        this.pendingRespawns = [];
        this.lastKnown = null;
    }

    isPlayerSpotted() {
        if (!this.state.isChasing()) return false;

        const px = this.playerCar.gridX;
        const py = this.playerCar.gridY;
        return this.units.some(u =>
            Math.abs(u.gridX - px) + Math.abs(u.gridY - py) <= CONFIG.CHASE.SPOT_RADIUS);
    }

    // A chase (re)started or refreshed — the cops know where it happened
    onChaseEvent() {
        this.lastKnown = { x: this.playerCar.gridX, y: this.playerCar.gridY };
    }

    getCollidingUnit(carsCollide, playerCar) {
        return this.units.find(unit => carsCollide(playerCar, unit)) || null;
    }
}
