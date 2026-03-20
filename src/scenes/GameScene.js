import Phaser from 'phaser';
import { TILE_SIZE, COLORS, MAP_WIDTH, MAP_HEIGHT, DIRECTIONS } from '../constants';
import { MapManager } from '../managers/MapManager';
import { Car } from '../objects/Car';
import { InputManager } from '../managers/InputManager';
import { UIManager } from '../managers/UIManager';
import { COLLECTIBLE_TYPES } from '../objects/Collectible';
import { PoliceCar } from '../objects/PoliceCar';

export class GameScene extends Phaser.Scene {


    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.load.image('tiles', 'Tilemap.png');
    }

    create() {
        this.add.text(10, 10, 'Getaway Remake', { font: '16px Arial', fill: '#ffffff', depth: 100 }).setScrollFactor(0);

        // Map System
        this.mapManager = new MapManager(this, MAP_WIDTH, MAP_HEIGHT);
        this.mapManager.generate();

        // Rendering
        this.mapManager.render();

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

        this.mapManager.spawnRandomCollectibles(50);

        // Camera System
        this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
        // CRITICAL FIX: Follow the VISUAL game object, not the wrapper class
        this.cameras.main.startFollow(this.playerCar.visual);

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

        this.inputManager.update();

        if (this.playerCar) {
            // Pass the buffered input to the car
            const inputDir = this.inputManager.getDirection();
            if (inputDir !== null) {
                this.playerCar.setBufferedInput(inputDir);
            }

            this.playerCar.update(time, delta);

            if (this.policeCar) {
                this.policeCar.update(time, delta);

                // Catch Logic
                if (this.policeCar.gridX === this.playerCar.gridX && this.policeCar.gridY === this.playerCar.gridY) {
                    this.handleGameOver("BUSTED!");
                }
            }

            // Check Collisions
            this.checkCollectibles();

            // Fuel Consumption (e.g., 5% per second)
            if (this.playerCar.isMoving) {
                this.uiManager.updateFuel(-5 * (delta / 1000));
            }

            if (this.uiManager.fuel <= 0) {
                this.handleGameOver("OUT OF FUEL!");
            }
        }
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
        if (item) {
            // Logic
            if (item.type === COLLECTIBLE_TYPES.MONEY) {
                this.uiManager.updateScore(100);
                if (this.policeCar) {
                    this.policeCar.chaseTimer = 10000; // Chase for 10 seconds
                }
            } else if (item.type === COLLECTIBLE_TYPES.FUEL) {
                this.uiManager.updateFuel(20);
            }

            this.mapManager.removeCollectible(item);
            this.mapManager.spawnRandomCollectibles(1);
        }
    }
}
