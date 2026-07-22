import { CONFIG } from '../config';
import { PoliceCar } from '../objects/PoliceCar';
import { SwatVan } from '../objects/SwatVan';
import { Roadblock } from '../objects/Roadblock';
import { Helicopter } from '../objects/Helicopter';
import { DIRECTIONS } from '../constants';

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

        // Escalation props — roadblocks (4+ stars) + helicopter (5 stars)
        this.roadblocks = [];      // Roadblock instances (blocked tiles mirrored in mapManager)
        this.roadblockTimer = 0;   // ms accumulator for the spawn cadence
        this.helicopter = null;    // Helicopter instance while active
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

        // (f) Escalation — roadblocks + helicopter, gated on the star flags
        const cfg = CONFIG.POLICE.BY_STARS[this.state.stars];

        // Roadblocks: drop one every INTERVAL_MS while chasing at 4+, capped
        if (cfg.roadblocks && this.state.isChasing()) {
            this.roadblockTimer += delta;
            if (this.roadblockTimer >= CONFIG.ROADBLOCK.INTERVAL_MS) {
                this.roadblockTimer = 0;
                if (this.roadblocks.length < CONFIG.ROADBLOCK.MAX_ACTIVE) {
                    this.trySpawnRoadblock();
                }
            }
        } else {
            // No-op when already empty; only clears when the flag/chase is off
            this.despawnRoadblocks();
            this.roadblockTimer = 0;
        }

        // Helicopter: exists only at 5★ while chasing; follows the player in px space
        if (cfg.heli && this.state.isChasing()) {
            if (!this.helicopter) {
                this.helicopter = new Helicopter(
                    this.scene, this.playerCar.visual.x, this.playerCar.visual.y - 400);
            }
            this.helicopter.update(delta, this.playerCar.visual.x, this.playerCar.visual.y);
        } else if (this.helicopter) {
            this.helicopter.destroy();
            this.helicopter = null;
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

        // Tear down roadblocks (also clears the blocked overlay) and the heli
        this.despawnRoadblocks();
        this.roadblockTimer = 0;
        if (this.helicopter) {
            this.helicopter.destroy();
            this.helicopter = null;
        }
    }

    isPlayerSpotted() {
        if (!this.state.isChasing()) return false;

        // The helicopter spotlight sees the player regardless of ground units —
        // this OR keeps the countdown floor pinned indefinitely while overhead.
        if (this.isHeliOverhead()) return true;

        const px = this.playerCar.gridX;
        const py = this.playerCar.gridY;
        return this.units.some(u =>
            Math.abs(u.gridX - px) + Math.abs(u.gridY - py) <= CONFIG.CHASE.SPOT_RADIUS);
    }

    isHeliOverhead() {
        return !!this.helicopter &&
            this.helicopter.isOverPlayer(this.playerCar.visual.x, this.playerCar.visual.y);
    }

    // Walk from the player's tile along their facing over road tiles, up to
    // MAX_AHEAD steps; the final tile reached is the candidate. Reject on any
    // of six conditions (see inline). The cadence timer is already reset by the
    // caller, so a rejection simply means "no block this interval".
    trySpawnRoadblock() {
        const player = this.playerCar;

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
        let steps = 0;
        for (let i = 0; i < CONFIG.ROADBLOCK.MAX_AHEAD; i++) {
            if (!this.mapManager.isRoad(x + dx, y + dy)) break;
            x += dx;
            y += dy;
            steps++;
        }

        // Rejection conditions
        if (steps < CONFIG.ROADBLOCK.MIN_AHEAD) return;                 // too close / road too short
        if (this.mapManager.isBasePad(x, y)) return;                    // never on the safehouse pad
        if (this.mapManager.getFuelStationAt(x, y)) return;            // never on a fuel pad
        if (this.mapManager.isBlocked(x, y)) return;                    // already blocked
        if (this.mapManager.getCollectibleAt(x, y)) return;            // don't bury a pickup
        if (x === player.gridX && y === player.gridY) return;          // player's current tile
        if (x === player.targetX && y === player.targetY) return;      // player's target tile
        // Never bury a laid bomb — it could never detonate (cops route around
        // blocked tiles, so nothing would ever trigger its collision).
        if ((this.scene.bombs || []).some(b => b.gridX === x && b.gridY === y)) return;

        this.mapManager.setBlocked(x, y, true);
        this.roadblocks.push(new Roadblock(this.scene, x, y));
    }

    getRoadblockAt(x, y) {
        return this.roadblocks.find(rb => rb.gridX === x && rb.gridY === y) || null;
    }

    destroyRoadblock(rb) {
        const index = this.roadblocks.indexOf(rb);
        if (index > -1) {
            this.roadblocks.splice(index, 1);
        }
        this.mapManager.setBlocked(rb.gridX, rb.gridY, false);
        rb.destroy();
    }

    despawnRoadblocks() {
        for (const rb of this.roadblocks) {
            this.mapManager.setBlocked(rb.gridX, rb.gridY, false);
            rb.destroy();
        }
        this.roadblocks = [];
    }

    // A chase (re)started or refreshed — the cops know where it happened
    onChaseEvent() {
        this.lastKnown = { x: this.playerCar.gridX, y: this.playerCar.gridY };
    }

    getCollidingUnit(carsCollide, playerCar) {
        return this.units.find(unit => carsCollide(playerCar, unit)) || null;
    }
}
