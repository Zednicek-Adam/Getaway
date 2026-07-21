import Phaser from 'phaser';
import { TILE_SIZE, COLORS, MAP_WIDTH, MAP_HEIGHT, DIRECTIONS } from '../constants';
import { MapManager } from '../managers/MapManager';
import { Car } from '../objects/Car';
import { InputManager } from '../managers/InputManager';
import { UIManager } from '../managers/UIManager';
import { COLLECTIBLE_TYPES } from '../objects/Collectible';
import { PoliceManager } from '../managers/PoliceManager';
import { Bomb } from '../objects/Bomb';
import { Rocket } from '../objects/Rocket';
import { DiamondCar } from '../objects/DiamondCar';
import { CONFIG } from '../config';
import { GameState } from '../GameState';

export class GameScene extends Phaser.Scene {


    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.load.image('tiles', 'Tilemap.png');

        // Car sprites
        this.load.spritesheet('playerCar', 'char.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('policeCar', 'policeblue.png', { frameWidth: 32, frameHeight: 32 });
    }

    create() {
        // Game State (recreated on every restart)
        this.state = new GameState();

        // Map System
        this.mapManager = new MapManager(this, MAP_WIDTH, MAP_HEIGHT);
        this.mapManager.generate();

        // Rendering (landmarks are separate objects — the tilemap is static after render)
        this.mapManager.render();
        this.mapManager.renderLandmarks();

        // Input
        this.inputManager = new InputManager(this);

        // UI
        this.uiManager = new UIManager(this);

        // Car Spawn - Start at center (Generation Seed) to guarantee Road
        const spawnPoint = this.mapManager.playerSpawnPoint || { x: Math.floor(MAP_WIDTH / 2), y: Math.floor(MAP_HEIGHT / 2) };

        this.playerCar = new Car(this, spawnPoint.x, spawnPoint.y, this.mapManager);
        // Force player to face UP (towards the dead end) as requested
        this.playerCar.direction = DIRECTIONS.UP;
        this.playerCar.turnQueue.clear(); // Clear buffered turns so car stays still
        this.playerCar.waitingForInput = true; // Don't auto-move until player presses a key
        this.playerCar.updatePosition(0);

        // Police fleet — 0 units at 0 stars; the manager reconciles the
        // count/speed/AI to the star table every frame
        this.policeManager = new PoliceManager(this, this.mapManager, this.state, this.playerCar);

        // Laid bombs + the diamond delivery car (recreated fresh on restart;
        // any pending respawn delayedCall is cleared by the scene shutdown)
        this.bombs = [];
        this.rockets = [];
        this.diamondCar = null;
        this.spawnDiamondCar();

        this.mapManager.spawnRandomCollectibles(CONFIG.COLLECTIBLES.INITIAL_COUNT);

        // Camera System
        this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
        // CRITICAL FIX: Follow the VISUAL game object, not the wrapper class
        this.cameras.main.startFollow( this.playerCar.visual, false, 0.15, 0.15);

        // Pause menu logic
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.pause('GameScene');
            this.scene.launch('PauseScene');
        });

        this.gameOver = false;
    }

    update(time, delta) {
        if (this.gameOver) return;
        if (!this.playerCar) return;

        // (a) Input → player update → police/diamond update
        this.inputManager.update();
        for (const dir of this.inputManager.drainInputs()) {
            this.playerCar.enqueueTurn(dir);
        }
        if (this.inputManager.consumeBombPress()) {
            this.tryDropBomb();
        }
        if (this.inputManager.consumeRocketPress()) {
            this.tryFireRocket();
        }
        if (this.inputManager.consumeStopToggle()) {
            // Brake toggle — stop to refuel at a station, or wait; steering resumes
            this.playerCar.halted = !this.playerCar.halted;
        }
        // Per-frame player speed: nitro shortens the per-tile move duration.
        // Car.update clamps t = min(moveTimer/duration, 1), so changing the
        // duration mid-move is safe; nitro expiring mid-move eases the visual
        // backward by at most one frame (accepted). WP5 multiplies a helicopter
        // slow factor into this same line.
        const nitroFactor = this.state.isNitroActive() ? CONFIG.NITRO.SPEED_FACTOR : 1;
        this.playerCar.moveConfig.duration = CONFIG.PLAYER.MOVE_DURATION * nitroFactor;

        this.playerCar.update(time, delta);
        this.policeManager.update(time, delta);
        if (this.diamondCar) {
            this.diamondCar.update(time, delta);
        }

        // (b) Deposit — ordered before the catch check so a catch on the base
        // pad banks the carried money first
        if (this.mapManager.isBasePad(this.playerCar.gridX, this.playerCar.gridY) && this.state.carried > 0) {
            const amount = this.state.deposit();
            this.uiManager.showToast(`+$${amount} BANKED`);
            // deposit() zeroed the countdown — stars decay via tick() and the
            // manager thins the fleet as they drop
            this.pulseBaseMarker();
        }

        // (c) Refuel while stopped on a station pad
        if (!this.playerCar.isMoving &&
            this.mapManager.getFuelStationAt(this.playerCar.gridX, this.playerCar.gridY)) {
            this.state.addFuel(CONFIG.FUEL.REFUEL_PER_SEC * (delta / 1000));
        }

        // (d) Diamond delivery car — ramming it steals the diamond
        // (not guarded by invulnerability: that only covers the police catch)
        if (this.diamondCar && this.carsCollide(this.playerCar, this.diamondCar)) {
            this.collectDiamondCar();
        }

        // (e) Catch check (same tile or swap-through). Skipped while invulnerable
        // or while parked on the base pad — the safehouse is a safe zone.
        const atSafehouse = this.mapManager.isBasePad(this.playerCar.gridX, this.playerCar.gridY);
        const rammingUnit = this.policeManager.getCollidingUnit(this.carsCollide.bind(this), this.playerCar);
        if (rammingUnit && !this.state.isInvulnerable() && !atSafehouse) {
            const result = this.state.onRammed(rammingUnit.ramDamage);
            if (result === 'caught') {
                this.handleCaught();
                if (this.gameOver) return;
            } else {
                this.onPlayerRammed(rammingUnit);
            }
        }

        // (f) Laid bombs — fuse ticks; police entering the tile detonate them
        this.updateBombs(delta);
        this.updateRockets(delta);

        // (g) Collectibles
        this.checkCollectibles();

        // (h) Fuel drain + state tick + out-of-fuel check
        if (this.playerCar.isMoving) {
            this.state.drainFuel(CONFIG.FUEL.DRAIN_PER_SEC * (delta / 1000));
        }
        this.state.tick(delta, { spotted: this.policeManager.isPlayerSpotted() });
        if (this.state.fuel <= 0) {
            this.handleGameOver("OUT OF FUEL!");
            return;
        }

        // (i) HUD snapshot
        this.uiManager.update({
            banked: this.state.banked,
            carried: this.state.carried,
            lives: this.state.lives,
            fuel: this.state.fuel,
            fuelMax: CONFIG.FUEL.MAX,
            bombs: this.state.bombs,
            rockets: this.state.rockets,
            damage: this.state.damage,
            maxDamage: this.state.maxDamage,
            nitroActive: this.state.isNitroActive(),
            queue: this.playerCar.turnQueue.toArray(),
            stars: this.state.stars,
            chaseCountdown: this.state.chaseCountdown,
            chaseCountdownMax: CONFIG.CHASE.COUNTDOWN_MS,
        });
    }

    // SPACE: lay a bomb on the player's current tile
    tryDropBomb() {
        const x = this.playerCar.gridX;
        const y = this.playerCar.gridY;

        // Occupancy check BEFORE consuming inventory — a second press on the
        // same tile must not waste a bomb
        if (this.bombs.some(b => b.gridX === x && b.gridY === y)) return;
        if (!this.state.useBomb()) return;

        this.bombs.push(new Bomb(this, x, y));
    }

    // Fuse ticks; any police unit on a bomb tile detonates it (every unit on
    // the tile is destroyed, +1 star once). Expiry without a trigger is a
    // harmless flash. The player and the diamond car are never affected.
    updateBombs(delta) {
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            const expired = bomb.update(delta);

            const unitsOnTile = this.policeManager.units.filter(
                u => u.gridX === bomb.gridX && u.gridY === bomb.gridY);

            if (unitsOnTile.length > 0) {
                this.explodeAt(bomb.gridX, bomb.gridY);
                for (const unit of unitsOnTile) {
                    this.policeManager.destroyUnit(unit); // Queues an 8s respawn
                }
                this.state.onPoliceBombed(); // Once per detonation (+1 star, chase refresh)
            } else if (!expired) {
                continue;
            } else {
                this.explodeAt(bomb.gridX, bomb.gridY); // Harmless fizzle
            }

            bomb.destroy();
            this.bombs.splice(i, 1);
        }
    }

    // E: fire a rocket from the player's standing tile along current facing.
    // Works while moving, braked, halted or waiting for input (no precondition).
    tryFireRocket() {
        if (!this.state.useRocket()) return;

        this.rockets.push(new Rocket(
            this, this.playerCar.gridX, this.playerCar.gridY, this.playerCar.direction));
    }

    // Rockets fly a tile at a time; hits resolve ONLY on frames where the
    // projectile stepped onto a new tile (mirrors the Bomb split). Reverse
    // iterate so splices are safe.
    updateRockets(delta) {
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const r = this.rockets[i];
            const advanced = r.update(delta) === 'advanced';
            if (!advanced) continue;

            // (1) Off-road (first off-road step) or out of range → harmless fizzle
            if (!this.mapManager.isRoad(r.gridX, r.gridY) ||
                r.tilesTraveled > CONFIG.ROCKET.RANGE_TILES) {
                this.sparkleBurst(r.visualX, r.visualY);
                r.destroy();
                this.rockets.splice(i, 1);
                continue;
            }

            // (2) Roadblock — WP5 provides getRoadblockAt/destroyRoadblock;
            // guard with existence checks since they don't exist yet.
            if (this.policeManager.getRoadblockAt) {
                const rb = this.policeManager.getRoadblockAt(r.gridX, r.gridY);
                if (rb) {
                    this.policeManager.destroyRoadblock(rb);
                    this.explodeAt(r.gridX, r.gridY);
                    r.destroy();
                    this.rockets.splice(i, 1);
                    continue;
                }
            }

            // (3) Police/SWAT on the tile, or mid-move INTO it (the target-tile
            // clause prevents tunneling past a unit that's entering the tile).
            const unit = this.policeManager.units.find(u =>
                (u.gridX === r.gridX && u.gridY === r.gridY) ||
                (u.isMoving && u.targetX === r.gridX && u.targetY === r.gridY));
            if (unit) {
                this.policeManager.destroyUnit(unit); // WP4 swaps to damageUnit(unit, 1)
                this.explodeAt(r.gridX, r.gridY);
                this.state.onPoliceBombed(); // +1 star, chase refresh (same as bombs)
                r.destroy();
                this.rockets.splice(i, 1);
            }
        }
    }

    // Expanding orange/white flash + a small camera shake
    explodeAt(gridX, gridY) {
        const cx = gridX * TILE_SIZE + TILE_SIZE / 2;
        const cy = gridY * TILE_SIZE + TILE_SIZE / 2;

        const outer = this.add.circle(cx, cy, TILE_SIZE * 0.25, 0xFF8800, 0.9).setDepth(50);
        const inner = this.add.circle(cx, cy, TILE_SIZE * 0.12, 0xFFFFFF, 0.9).setDepth(51);

        this.tweens.add({
            targets: [outer, inner],
            scale: 4,
            alpha: 0,
            duration: 300,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                outer.destroy();
                inner.destroy();
            },
        });

        this.cameras.main.shake(150, 0.005);
    }

    spawnDiamondCar() {
        const spawn = this.mapManager.getSpawnPointAwayFrom(
            this.playerCar.gridX, this.playerCar.gridY, CONFIG.DIAMOND_CAR.SPAWN_MIN_DIST);

        this.diamondCar = new DiamondCar(this, spawn.x, spawn.y, this.mapManager);
        this.diamondCar.faceAnyOpenDirection();
    }

    collectDiamondCar() {
        this.state.pickupDiamond(); // +$1000 carried, +2 stars, chase refresh
        this.policeManager.onChaseEvent();
        this.uiManager.showToast(`DIAMOND! +$${CONFIG.ECONOMY.DIAMOND_VALUE}`);
        this.sparkleBurst(this.diamondCar.visual.x, this.diamondCar.visual.y);

        this.diamondCar.visual.destroy();
        this.diamondCar = null;

        // Safe across restarts: scene shutdown clears pending clock events
        this.time.delayedCall(CONFIG.DIAMOND_CAR.RESPAWN_MS, () => {
            if (!this.gameOver) this.spawnDiamondCar();
        });
    }

    // A few white sparks flying outward
    sparkleBurst(x, y) {
        const count = 6;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const spark = this.add.circle(x, y, 4, 0xFFFFFF).setDepth(50);

            this.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * TILE_SIZE,
                y: y + Math.sin(angle) * TILE_SIZE,
                alpha: 0,
                duration: 400,
                ease: 'Cubic.easeOut',
                onComplete: () => spark.destroy(),
            });
        }
    }

    // Same tile, or the two cars swapping tiles mid-move (tunneling)
    carsCollide(a, b) {
        if (a.gridX === b.gridX && a.gridY === b.gridY) return true;
        return a.isMoving && b.isMoving &&
            a.targetX === b.gridX && a.targetY === b.gridY &&
            b.targetX === a.gridX && b.targetY === a.gridY;
    }

    // Visual/respawn side of a catch. The state transition (onCaught) already
    // happened via state.onRammed('caught') at the call site — this must NOT
    // touch state, so onCaught fires exactly once per catch (no double life loss).
    handleCaught() {
        this.cameras.main.flash(300, 255, 0, 0);

        if (this.state.gameOver) {
            this.handleGameOver(this.state.gameOverReason || "BUSTED!");
            return;
        }

        this.respawnPlayerAtBase();
        // onCaught() reset stars to 0 — the fleet stays empty until the next pickup
        this.policeManager.despawnAll();
        this.blinkPlayer(CONFIG.PLAYER.INVULN_MS);
    }

    // Survivable ram: stun the cop, shake, and blink the player through mercy.
    // The player's turn queue is deliberately kept (only catch/respawn clears it).
    onPlayerRammed(unit) {
        unit.stun(CONFIG.DAMAGE.POLICE_STUN_MS);
        this.cameras.main.shake(120, 0.004);
        this.blinkPlayer(CONFIG.DAMAGE.MERCY_MS);
    }

    respawnPlayerAtBase() {
        const pad = this.mapManager.base.pad;
        const car = this.playerCar;

        car.gridX = pad.x;
        car.gridY = pad.y;
        car.targetX = pad.x;
        car.targetY = pad.y;
        car.isMoving = false;
        car.moveTimer = 0;
        car.direction = DIRECTIONS.UP;
        car.turnQueue.clear();
        car.halted = false;
        car.waitingForInput = true;
        car.updatePosition(0);

        this.state.addFuel(CONFIG.FUEL.MAX); // Full tank on respawn (clamped)
    }

    // Blink the player for durationMs. Kills any running blink first so a
    // ram-blink followed by a catch-blink doesn't stack (restore alpha, then
    // restart with the new duration's cycle count — 300ms per yoyo cycle).
    blinkPlayer(durationMs) {
        const visual = this.playerCar.visual;
        this.tweens.killTweensOf(visual);
        visual.setAlpha(1);

        const cycles = Math.max(1, Math.floor(durationMs / 300));

        this.tweens.add({
            targets: visual,
            alpha: 0.2,
            duration: 150,
            yoyo: true,
            repeat: cycles - 1,
            onComplete: () => visual.setAlpha(1),
        });
    }

    pulseBaseMarker() {
        const marker = this.mapManager.baseMarker;
        if (!marker) return;

        this.tweens.add({
            targets: marker,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 120,
            yoyo: true,
            ease: 'Sine.easeInOut',
        });
    }

    handleGameOver(reason) {
        this.gameOver = true;
        this.uiManager.showGameOver(reason);

        // Simple click to restart
        this.input.once('pointerdown', () => {
            this.scene.restart();
        });
        // Also enter key
        this.input.keyboard.once('keydown-ENTER', () => {
            this.scene.restart();
        });
    }

    checkCollectibles() {
        const item = this.mapManager.getCollectibleAt(this.playerCar.gridX, this.playerCar.gridY);
        if (!item) return;

        if (item.type === COLLECTIBLE_TYPES.MONEY) {
            this.state.pickupMoney(); // Refreshes the chase countdown
            this.policeManager.onChaseEvent();
        } else if (item.type === COLLECTIBLE_TYPES.BOMB) {
            // Inventory full — leave the bomb on the road (WP5 wires laying/exploding)
            if (!this.state.pickupBomb()) return;
        } else if (item.type === COLLECTIBLE_TYPES.REPAIR) {
            // Undamaged — leave the repair on the road for later
            if (!this.state.repair()) return;
        } else if (item.type === COLLECTIBLE_TYPES.LIFE) {
            // At max lives — leave the extra life on the road
            if (!this.state.addLife()) return;
            this.uiManager.showToast('+1 LIFE');
        } else if (item.type === COLLECTIBLE_TYPES.NITRO) {
            this.state.pickupNitro(); // Refresh-to-full speed boost
            this.uiManager.showToast('NITRO!');
        } else if (item.type === COLLECTIBLE_TYPES.ROCKET) {
            // Inventory full — leave the rocket on the road for later
            if (!this.state.pickupRocket()) return;
        }

        this.mapManager.removeCollectible(item);
        this.mapManager.spawnRandomCollectibles(1);
    }
}
