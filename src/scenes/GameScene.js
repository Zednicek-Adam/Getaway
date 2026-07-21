import Phaser from 'phaser';
import { TILE_SIZE, COLORS, MAP_WIDTH, MAP_HEIGHT, DIRECTIONS } from '../constants';
import { MapManager } from '../managers/MapManager';
import { Car } from '../objects/Car';
import { InputManager } from '../managers/InputManager';
import { UIManager } from '../managers/UIManager';
import { COLLECTIBLE_TYPES } from '../objects/Collectible';
import { PoliceCar } from '../objects/PoliceCar';
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
        this.playerCar.nextDirection = null; // Clear buffered input so car stays still
        this.playerCar.waitingForInput = true; // Don't auto-move until player presses a key
        this.playerCar.updatePosition(0);

        // Police Spawn
        let policeSpawn = this.mapManager.getRandomSpawnPoint();
        let attempts = 0;
        // Ensure not on top of player
        while (policeSpawn.x === spawnPoint.x && policeSpawn.y === spawnPoint.y && attempts < 100) {
            policeSpawn = this.mapManager.getRandomSpawnPoint();
            attempts++;
        }
        this.policeCar = new PoliceCar(this, policeSpawn.x, policeSpawn.y, this.mapManager, this.playerCar);
        this.setInitialDirection(this.policeCar);

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

    setInitialDirection(car) {
        if (this.mapManager.isRoad(car.gridX + 1, car.gridY)) car.direction = DIRECTIONS.RIGHT;
        else if (this.mapManager.isRoad(car.gridX - 1, car.gridY)) car.direction = DIRECTIONS.LEFT;
        else if (this.mapManager.isRoad(car.gridX, car.gridY + 1)) car.direction = DIRECTIONS.DOWN;
        else if (this.mapManager.isRoad(car.gridX, car.gridY - 1)) car.direction = DIRECTIONS.UP;

        car.updatePosition(0); // Refresh visual rotation
    }

    update(time, delta) {
        if (this.gameOver) return;
        if (!this.playerCar) return;

        // (a) Input → player update → police update
        this.inputManager.update();
        const inputDir = this.inputManager.getDirection();
        if (inputDir !== null) {
            this.playerCar.setBufferedInput(inputDir);
        }
        this.playerCar.update(time, delta);
        if (this.policeCar) {
            this.policeCar.update(time, delta);
        }

        // (b) Deposit — ordered before the catch check so a catch on the base
        // pad banks the carried money first
        if (this.mapManager.isBasePad(this.playerCar.gridX, this.playerCar.gridY) && this.state.carried > 0) {
            const amount = this.state.deposit();
            this.uiManager.showToast(`+$${amount} BANKED`);
            if (this.policeCar) {
                this.policeCar.chaseTimer = 0; // Legacy chase ends on deposit
            }
            this.pulseBaseMarker();
        }

        // (c) Refuel while stopped on a station pad
        if (!this.playerCar.isMoving &&
            this.mapManager.getFuelStationAt(this.playerCar.gridX, this.playerCar.gridY)) {
            this.state.addFuel(CONFIG.FUEL.REFUEL_PER_SEC * (delta / 1000));
        }

        // (d) Catch check (same tile or swap-through), skipped while invulnerable
        if (this.policeCar && !this.state.isInvulnerable() &&
            this.carsCollide(this.playerCar, this.policeCar)) {
            this.handleCaught();
            if (this.gameOver) return;
        }

        // (e) Collectibles
        this.checkCollectibles();

        // (f) Fuel drain + state tick + out-of-fuel check
        if (this.playerCar.isMoving) {
            this.state.drainFuel(CONFIG.FUEL.DRAIN_PER_SEC * (delta / 1000));
        }
        this.state.tick(delta, { spotted: false });
        if (this.state.fuel <= 0) {
            this.handleGameOver("OUT OF FUEL!");
            return;
        }

        // (g) HUD snapshot
        this.uiManager.update({
            banked: this.state.banked,
            carried: this.state.carried,
            lives: this.state.lives,
            fuel: this.state.fuel,
            fuelMax: CONFIG.FUEL.MAX,
            bombs: this.state.bombs,
        });
    }

    // Same tile, or the two cars swapping tiles mid-move (tunneling)
    carsCollide(a, b) {
        if (a.gridX === b.gridX && a.gridY === b.gridY) return true;
        return a.isMoving && b.isMoving &&
            a.targetX === b.gridX && a.targetY === b.gridY &&
            b.targetX === a.gridX && b.targetY === a.gridY;
    }

    handleCaught() {
        this.state.onCaught();
        this.cameras.main.flash(300, 255, 0, 0);

        if (this.state.gameOver) {
            this.handleGameOver(this.state.gameOverReason || "BUSTED!");
            return;
        }

        this.respawnPlayerAtBase();
        this.respawnPoliceFar();
        this.blinkPlayerDuringInvuln();
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
        car.nextDirection = null;
        car.waitingForInput = true;
        car.updatePosition(0);

        this.state.addFuel(CONFIG.FUEL.MAX); // Full tank on respawn (clamped)
    }

    respawnPoliceFar() {
        if (!this.policeCar) return;

        let spawn = this.mapManager.getRandomSpawnPoint();
        let attempts = 0;
        while (attempts < 50 &&
            Math.abs(spawn.x - this.playerCar.gridX) + Math.abs(spawn.y - this.playerCar.gridY) < CONFIG.POLICE.SPAWN_MIN_DIST) {
            spawn = this.mapManager.getRandomSpawnPoint();
            attempts++;
        }

        const police = this.policeCar;
        police.gridX = spawn.x;
        police.gridY = spawn.y;
        police.targetX = spawn.x;
        police.targetY = spawn.y;
        police.isMoving = false;
        police.moveTimer = 0;
        police.nextDirection = null;
        police.chaseTimer = 0;
        this.setInitialDirection(police);
    }

    blinkPlayerDuringInvuln() {
        const visual = this.playerCar.visual;
        const cycles = Math.max(1, Math.floor(CONFIG.PLAYER.INVULN_MS / 300));

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
            this.state.pickupMoney();
            if (this.policeCar) {
                this.policeCar.chaseTimer = CONFIG.CHASE.LEGACY_CHASE_MS;
            }
        } else if (item.type === COLLECTIBLE_TYPES.BOMB) {
            // Inventory full — leave the bomb on the road (WP5 wires laying/exploding)
            if (!this.state.pickupBomb()) return;
        }

        this.mapManager.removeCollectible(item);
        this.mapManager.spawnRandomCollectibles(1);
    }
}
