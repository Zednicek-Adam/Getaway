import { CONFIG } from '../config';
import { PoliceCar } from '../objects/PoliceCar';
import { SwatVan } from '../objects/SwatVan';

const UNIT_TYPES = ['police', 'swat'];

// Owns the mixed police fleet (regular cars + SWAT vans): reconciles per-type
// unit count and speed to the star table each frame, tracks the player's
// last-known position, and handles despawns and bombed-unit respawns.
export class PoliceManager {
    constructor(scene, mapManager, state, playerCar) {
        this.scene = scene;
        this.mapManager = mapManager;
        this.state = state;
        this.playerCar = playerCar;

        this.units = [];           // PoliceCar / SwatVan instances
        this.pendingRespawns = []; // { time, type } — destroyed units awaiting replacement
        this.lastKnown = null;     // { x, y } — where the player was last seen
    }

    update(time, delta) {
        // (a) Reconcile fleet size per unit type to the star table
        for (const type of UNIT_TYPES) {
            const target = this.targetCount(type);
            while (this.countOf(type) < target) {
                this.spawnUnit(type);
            }
            const surplus = this.countOf(type) - target;
            if (surplus > 0) {
                this.despawnFarthest(surplus, type);
            }
        }

        // (b) Per-star speed applies to regular police only, mid-move included
        // (Car.update clamps t at 1, so a shortened duration is safe). SWAT
        // vans keep their constructor-set duration permanently.
        const duration = CONFIG.POLICE.BY_STARS[this.state.stars].duration;
        for (const unit of this.units) {
            if (unit.unitType === 'police') {
                unit.moveConfig.duration = duration;
            }
        }

        // (c) Drive the units
        for (const unit of this.units) {
            unit.update(time, delta);
        }

        // (d) Track the player's position while any unit has eyes on them
        if (this.isPlayerSpotted()) {
            this.lastKnown = { x: this.playerCar.gridX, y: this.playerCar.gridY };
        }

        // (e) Queued respawns whose time arrived (skip when that type is full).
        // Entries are pushed in time order, so the head is always the earliest.
        while (this.pendingRespawns.length > 0 && this.pendingRespawns[0].time <= time) {
            const entry = this.pendingRespawns.shift();
            if (this.countOf(entry.type) < this.targetCount(entry.type)) {
                this.spawnUnit(entry.type);
            }
        }
    }

    targetCount(type) {
        return CONFIG.POLICE.BY_STARS[this.state.stars].units[type] || 0;
    }

    countOf(type) {
        return this.units.filter(u => u.unitType === type).length;
    }

    spawnUnit(type) {
        const spawn = this.mapManager.getSpawnPointAwayFrom(
            this.playerCar.gridX, this.playerCar.gridY, CONFIG.POLICE.SPAWN_MIN_DIST);

        const unit = type === 'swat'
            ? new SwatVan(this.scene, spawn.x, spawn.y, this.mapManager, this.playerCar, this)
            : new PoliceCar(this.scene, spawn.x, spawn.y, this.mapManager, this.playerCar, this);
        unit.faceAnyOpenDirection();
        this.units.push(unit);
        return unit;
    }

    // Remove the n units of the given type farthest from the player; units
    // within the spot radius never vanish in view (deferred — retried next
    // frame naturally)
    despawnFarthest(n, type) {
        const px = this.playerCar.gridX;
        const py = this.playerCar.gridY;
        const manhattan = (u) => Math.abs(u.gridX - px) + Math.abs(u.gridY - py);

        const candidates = this.units
            .filter(u => u.unitType === type)
            .sort((a, b) => manhattan(b) - manhattan(a));
        for (const unit of candidates) {
            if (n <= 0) break;
            if (manhattan(unit) <= CONFIG.CHASE.SPOT_RADIUS) continue;
            this.removeUnit(unit);
            n--;
        }
    }

    // Bombed/rocketed unit — remove immediately, queue a typed replacement
    destroyUnit(unit) {
        this.removeUnit(unit);
        this.pendingRespawns.push({
            time: this.scene.time.now + CONFIG.POLICE.RESPAWN_AFTER_BOMB_MS,
            type: unit.unitType,
        });
    }

    // Apply damage; destroy at 0 hp (returns true), otherwise stun the survivor
    damageUnit(unit, amount) {
        unit.hp -= amount;
        if (unit.hp <= 0) {
            this.destroyUnit(unit);
            return true; // destroyed
        }
        unit.stun(CONFIG.DAMAGE.POLICE_STUN_MS); // survivor reels
        return false;
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
