import Phaser from 'phaser';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, DIRECTIONS, TILE_TYPES } from '../constants';
import { MapManager } from '../managers/MapManager';
import { Car } from '../objects/Car';
import { InputManager } from '../managers/InputManager';
import { UIManager } from '../managers/UIManager';
import { COLLECTIBLE_TYPES } from '../objects/Collectible';
import { PoliceCar } from '../objects/PoliceCar';
import { SwatVan } from '../objects/SwatVan';
import { Roadblock } from '../objects/Roadblock';
import { Helicopter } from '../objects/Helicopter';
import { Rocket, BombTrap } from '../objects/Projectiles';

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
        this.playerCar.direction = DIRECTIONS.UP;
        this.playerCar.turnQueue = []; // Clear buffered input
        this.playerCar.waitingForInput = true; // Don't auto-move until player presses a key
        this.playerCar.updatePosition(0);

        this.playerHealth = 3;
        this.maxPlayerHealth = 5;
        this.isInvulnerable = false;

        // Cash State
        this.carriedCash = 0;
        this.uiManager.updateCarriedCash(0);

        // Heat System State
        this.heatLevel = 1;
        this.heatPoints = 0;
        this.passiveHeatTimer = 0;

        // Inventory System State (Multi-Slot Hotbar)
        this.inventory = {
            nitro: 0,
            bomb: 0,
            rocket: 0,
            jerry_can: 0
        };
        this.maxStacks = {
            nitro: 3,
            bomb: 3,
            rocket: 3,
            jerry_can: 2
        };
        this.uiManager.updateMultiInventory(this.inventory);

        this.nitroTimer = 0;
        this.gasRefuelTimer = 0;

        // Entities Lists
        this.policeUnits = [];
        this.roadblocks = [];
        this.helicopter = null;
        this.rockets = [];
        this.bombs = [];

        this.policeSpawnTimer = 0;
        this.roadblockSpawnTimer = 0;

        // Initial Police Spawn
        let policeSpawn = this.mapManager.getRandomSpawnPoint();
        let attempts = 0;
        while (policeSpawn.x === spawnPoint.x && policeSpawn.y === spawnPoint.y && attempts < 100) {
            policeSpawn = this.mapManager.getRandomSpawnPoint();
            attempts++;
        }
        const initialPolice = new PoliceCar(this, policeSpawn.x, policeSpawn.y, this.mapManager, this.playerCar);
        this.setInitialDirection(initialPolice);
        this.policeUnits.push(initialPolice);
        this.policeCar = initialPolice; // Legacy reference safeguard

        this.mapManager.spawnRandomCollectibles(50);

        // Camera System
        this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
        this.cameras.main.startFollow(this.playerCar.visual, false, 0.15, 0.15);

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

        car.updatePosition(0);
    }

    addHeat(amount) {
        this.heatPoints = Math.max(0, this.heatPoints + amount);
        const oldLevel = this.heatLevel;

        if (this.heatPoints < 100) this.heatLevel = 1;
        else if (this.heatPoints < 250) this.heatLevel = 2;
        else if (this.heatPoints < 500) this.heatLevel = 3;
        else if (this.heatPoints < 900) this.heatLevel = 4;
        else this.heatLevel = 5;

        if (this.heatLevel !== oldLevel) {
            this.uiManager.updateHeat(this.heatLevel);
            this.showHeatPopup(this.heatLevel);
        }
    }

    showHeatPopup(level) {
        const { width, height } = this.scale;
        const popup = this.add.text(width / 2, height / 3, `HEAT LEVEL ${level}!`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: level >= 4 ? '#FF0000' : '#FFD700',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(200).setScrollFactor(0);

        this.tweens.add({
            targets: popup,
            y: height / 3 - 30,
            alpha: 0,
            duration: 1500,
            onComplete: () => popup.destroy()
        });
    }

    update(time, delta) {
        if (this.gameOver) return;

        this.inputManager.update();

        // Passive heat gain while carrying cash, or Heat cooldown when safe
        const isChased = this.policeUnits.some(p => p.chaseTimer > 0);
        if (this.carriedCash > 0) {
            this.passiveHeatTimer += delta;
            if (this.passiveHeatTimer >= 1500) {
                this.passiveHeatTimer = 0;
                this.addHeat(3);
            }
        } else if (!isChased && this.heatPoints > 0) {
            // Passive Heat Cooldown when not carrying cash and lost police
            this.passiveHeatTimer += delta;
            if (this.passiveHeatTimer >= 2000) {
                this.passiveHeatTimer = 0;
                this.addHeat(-15);
            }
        }

        // Multi-slot hotbar item activations (1/SPACE, 2/B, 3/R, 4/F)
        if (this.inputManager.isNitroPressed()) this.useItem('nitro');
        if (this.inputManager.isBombPressed()) this.useItem('bomb');
        if (this.inputManager.isRocketPressed()) this.useItem('rocket');
        if (this.inputManager.isJerryCanPressed()) this.useItem('jerry_can');

        // Handbrake stop control (X key)
        if (this.inputManager.isHandbrakePressed() && this.playerCar) {
            this.playerCar.stopImmediately();
        }

        // Speed Multipliers (Nitro & Helicopter Spotlight)
        let speedMult = 1.0;

        if (this.nitroTimer > 0) {
            this.nitroTimer -= delta;
            speedMult *= 0.5; // Nitro speed boost
        }

        if (this.helicopter && this.helicopter.isSpottingPlayer) {
            speedMult *= 1.5; // Spotlight slowdown
        }

        if (this.playerCar) {
            this.playerCar.speedMultiplier = speedMult;

            const inputDir = this.inputManager.getDirection();
            if (inputDir !== null) {
                this.playerCar.setBufferedInput(inputDir);
            }

            this.playerCar.update(time, delta);

            // Base / Safehouse Deposit Check
            if (this.mapManager.baseLocation &&
                this.playerCar.gridX === this.mapManager.baseLocation.x &&
                this.playerCar.gridY === this.mapManager.baseLocation.y) {
                if (this.carriedCash > 0) {
                    const banked = this.carriedCash;
                    this.uiManager.updateScore(banked);
                    this.carriedCash = 0;
                    this.uiManager.updateCarriedCash(0);
                    this.showHeatPopup(`BANKED $${banked}!`);
                    this.addHeat(-50);
                    for (let police of this.policeUnits) {
                        police.chaseTimer = 0;
                    }
                }
            }

            // Gas Station "Stop to Refuel" Check (Must be stopped for 1.5s)
            const isOnGasTile = this.mapManager.getTile(this.playerCar.gridX, this.playerCar.gridY) === TILE_TYPES.GAS_STATION;
            if (isOnGasTile && !this.playerCar.isMoving) {
                this.gasRefuelTimer += delta;
                if (this.gasRefuelTimer >= 1500) {
                    this.uiManager.updateFuel(100);
                    this.gasRefuelTimer = 0;
                    this.showHeatPopup("+FULL TANK!");
                }
            } else {
                this.gasRefuelTimer = 0;
            }

            // Update Police Units
            for (let i = this.policeUnits.length - 1; i >= 0; i--) {
                const police = this.policeUnits[i];
                police.update(time, delta);

                // Catch logic
                if (!this.isInvulnerable && police.gridX === this.playerCar.gridX && police.gridY === this.playerCar.gridY) {
                    this.takeDamage();
                }
            }

            // Update Roadblocks
            for (let i = this.roadblocks.length - 1; i >= 0; i--) {
                const roadblock = this.roadblocks[i];
                if (!this.isInvulnerable && roadblock.gridX === this.playerCar.gridX && roadblock.gridY === this.playerCar.gridY) {
                    this.takeDamage();
                    this.createExplosion(roadblock.visual.x, roadblock.visual.y);
                    roadblock.destroy();
                    this.roadblocks.splice(i, 1);
                }
            }

            // Update Helicopter
            if (this.helicopter) {
                this.helicopter.update(time, delta);
            }

            // Update Rockets
            this.updateRockets(time, delta);

            // Update Bombs
            this.updateBombs(time, delta);

            // Check Collectibles
            this.checkCollectibles();

            // Update HUD Compass
            const nearestMoney = this.getNearestMoneyCollectible();
            if (this.mapManager.baseLocation) {
                this.uiManager.updateCompass(
                    this.playerCar.gridX,
                    this.playerCar.gridY,
                    this.mapManager.baseLocation.x,
                    this.mapManager.baseLocation.y,
                    nearestMoney
                );
            }

            // Update HUD Chase Status Badge
            let maxChase = 0;
            let isAnyLOS = false;
            for (let police of this.policeUnits) {
                if (police.chaseTimer > maxChase) maxChase = police.chaseTimer;
                if (police.hasLineOfSight && police.hasLineOfSight()) isAnyLOS = true;
            }
            if (this.helicopter && this.helicopter.isSpottingPlayer) isAnyLOS = true;

            if (maxChase > 0 || (this.helicopter && !this.helicopter.isOutOfFuel)) {
                if (isAnyLOS) {
                    this.uiManager.updateChaseStatus('chase');
                } else {
                    const searchSec = Math.ceil(maxChase / 1000);
                    this.uiManager.updateChaseStatus('searching', searchSec);
                }
            } else {
                this.uiManager.updateChaseStatus('safe');
            }

            // Police Unit Spawner
            this.updatePoliceManager(delta);

            // Fuel Consumption
            if (this.playerCar.isMoving) {
                this.uiManager.updateFuel(-5 * (delta / 5000));
            }

            if (this.uiManager.fuel <= 0) {
                this.handleGameOver("OUT OF FUEL!");
            }
        }
    }

    useItem(type) {
        if (!this.inventory || !this.inventory[type] || this.inventory[type] <= 0) return;

        if (type === 'nitro') {
            this.nitroTimer = 5000;
            this.tweens.add({
                targets: this.playerCar.visual,
                tint: 0x00FFFF,
                duration: 200,
                yoyo: true,
                repeat: 5,
                onComplete: () => this.playerCar.visual.clearTint()
            });
            this.inventory.nitro--;
        } else if (type === 'bomb') {
            let bx = this.playerCar.gridX;
            let by = this.playerCar.gridY;
            const opp = this.playerCar.getOpposite(this.playerCar.direction);
            if (opp === DIRECTIONS.UP) by -= 1;
            else if (opp === DIRECTIONS.DOWN) by += 1;
            else if (opp === DIRECTIONS.LEFT) bx -= 1;
            else if (opp === DIRECTIONS.RIGHT) bx += 1;

            if (!this.mapManager.isRoad(bx, by)) {
                bx = this.playerCar.gridX;
                by = this.playerCar.gridY;
            }
            const bomb = new BombTrap(this, bx, by);
            this.bombs.push(bomb);
            this.inventory.bomb--;
        } else if (type === 'rocket') {
            const rocket = new Rocket(this, this.playerCar.gridX, this.playerCar.gridY, this.playerCar.direction, this.mapManager);
            this.rockets.push(rocket);
            this.inventory.rocket--;
        } else if (type === 'jerry_can') {
            this.uiManager.updateFuel(40);
            this.showHeatPopup("+40% FUEL!");
            this.inventory.jerry_can--;
        }

        this.uiManager.updateMultiInventory(this.inventory);
    }

    useActiveItem() {
        if (this.inventory.nitro > 0) this.useItem('nitro');
        else if (this.inventory.bomb > 0) this.useItem('bomb');
        else if (this.inventory.rocket > 0) this.useItem('rocket');
        else if (this.inventory.jerry_can > 0) this.useItem('jerry_can');
    }

    updateRockets(time, delta) {
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const rocket = this.rockets[i];
            rocket.update(time, delta);

            if (!rocket.active) {
                this.rockets.splice(i, 1);
                continue;
            }

            // Check collision with Police Units
            let hitTarget = false;
            for (let j = this.policeUnits.length - 1; j >= 0; j--) {
                const unit = this.policeUnits[j];
                const dist = Phaser.Math.Distance.Between(rocket.x, rocket.y, unit.visual.x, unit.visual.y);
                if (dist < 30) {
                    rocket.explode();
                    hitTarget = true;

                    const isDestroyed = unit.takeHit();
                    if (isDestroyed) {
                        this.createExplosion(unit.visual.x, unit.visual.y);
                        unit.visual.destroy();
                        this.policeUnits.splice(j, 1);
                        this.addHeat(150); // Aggressive heat gain
                        this.uiManager.updateScore(200);
                    }
                    break;
                }
            }

            if (hitTarget) {
                this.rockets.splice(i, 1);
                continue;
            }

            // Check collision with Roadblocks
            for (let j = this.roadblocks.length - 1; j >= 0; j--) {
                const roadblock = this.roadblocks[j];
                const dist = Phaser.Math.Distance.Between(rocket.x, rocket.y, roadblock.visual.x, roadblock.visual.y);
                if (dist < 30) {
                    rocket.explode();
                    this.createExplosion(roadblock.visual.x, roadblock.visual.y);
                    roadblock.destroy();
                    this.roadblocks.splice(j, 1);
                    this.addHeat(150);
                    this.uiManager.updateScore(200);
                    hitTarget = true;
                    break;
                }
            }

            if (hitTarget) {
                this.rockets.splice(i, 1);
                continue;
            }

            // Check collision with Helicopter
            if (!hitTarget && this.helicopter && this.helicopter.visual && !this.helicopter.isOutOfFuel) {
                const distH = Phaser.Math.Distance.Between(rocket.x, rocket.y, this.helicopter.x, this.helicopter.y);
                if (distH < 40) {
                    rocket.explode();
                    this.createExplosion(this.helicopter.x, this.helicopter.y);
                    this.helicopter.destroy();
                    this.helicopter = null;
                    this.addHeat(100);
                    this.uiManager.updateScore(300);
                    this.showHeatPopup("+300 HELICOPTER DOWN!");
                    hitTarget = true;
                }
            }

            if (hitTarget) {
                this.rockets.splice(i, 1);
            }
        }
    }

    updateBombs(time, delta) {
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            if (!bomb.active) {
                this.bombs.splice(i, 1);
                continue;
            }

            let triggered = false;
            // Check collision with police units
            for (let j = this.policeUnits.length - 1; j >= 0; j--) {
                const unit = this.policeUnits[j];
                if (unit.gridX === bomb.gridX && unit.gridY === bomb.gridY) {
                    bomb.explode();
                    triggered = true;

                    const isDestroyed = unit.takeHit();
                    if (isDestroyed) {
                        this.createExplosion(unit.visual.x, unit.visual.y);
                        unit.visual.destroy();
                        this.policeUnits.splice(j, 1);
                        this.addHeat(150);
                        this.uiManager.updateScore(200);
                    }
                    break;
                }
            }

            if (triggered) {
                this.bombs.splice(i, 1);
                continue;
            }

            // Check collision with roadblocks
            for (let j = this.roadblocks.length - 1; j >= 0; j--) {
                const roadblock = this.roadblocks[j];
                if (roadblock.gridX === bomb.gridX && roadblock.gridY === bomb.gridY) {
                    bomb.explode();
                    this.createExplosion(roadblock.visual.x, roadblock.visual.y);
                    roadblock.destroy();
                    this.roadblocks.splice(j, 1);
                    this.addHeat(150);
                    this.uiManager.updateScore(200);
                    triggered = true;
                    break;
                }
            }

            if (triggered) {
                this.bombs.splice(i, 1);
            }
        }
    }

    updatePoliceManager(delta) {
        this.policeSpawnTimer += delta;

        // Desired unit counts based on Heat Level
        let targetStandard = 1;
        let targetSwat = 0;

        if (this.heatLevel === 2) {
            targetStandard = 2;
        } else if (this.heatLevel === 3) {
            targetStandard = 2;
            targetSwat = 1;
        } else if (this.heatLevel >= 4) {
            targetStandard = 2;
            targetSwat = 2;
        }

        if (this.policeSpawnTimer >= 3000) {
            this.policeSpawnTimer = 0;

            let stdCount = this.policeUnits.filter(u => !(u instanceof SwatVan)).length;
            let swatCount = this.policeUnits.filter(u => u instanceof SwatVan).length;

            if (stdCount < targetStandard) {
                const spawn = this.getFarSpawnPoint();
                if (spawn) {
                    const police = new PoliceCar(this, spawn.x, spawn.y, this.mapManager, this.playerCar);
                    police.chaseTimer = 15000;
                    this.setInitialDirection(police);
                    this.policeUnits.push(police);
                }
            }

            if (swatCount < targetSwat) {
                const spawn = this.getFarSpawnPoint();
                if (spawn) {
                    const swat = new SwatVan(this, spawn.x, spawn.y, this.mapManager, this.playerCar);
                    swat.chaseTimer = 15000;
                    this.setInitialDirection(swat);
                    this.policeUnits.push(swat);
                }
            }
        }

        // Roadblocks at Heat 4+
        if (this.heatLevel >= 4) {
            this.roadblockSpawnTimer += delta;
            if (this.roadblockSpawnTimer >= 8000 && this.roadblocks.length < 3) {
                this.roadblockSpawnTimer = 0;
                this.spawnRoadblockAhead();
            }
        }

        // Helicopter at Heat 5
        if (this.heatLevel === 5) {
            if (!this.helicopter) {
                this.helicopter = new Helicopter(this, this.playerCar);
            }
        } else if (this.helicopter) {
            this.helicopter.destroy();
            this.helicopter = null;
        }
    }

    spawnRoadblockAhead() {
        let dx = 0;
        let dy = 0;
        if (this.playerCar.direction === DIRECTIONS.UP) dy = -1;
        else if (this.playerCar.direction === DIRECTIONS.DOWN) dy = 1;
        else if (this.playerCar.direction === DIRECTIONS.LEFT) dx = -1;
        else if (this.playerCar.direction === DIRECTIONS.RIGHT) dx = 1;

        for (let dist = 5; dist <= 9; dist++) {
            const rx = this.playerCar.gridX + dx * dist;
            const ry = this.playerCar.gridY + dy * dist;

            if (this.mapManager.isRoad(rx, ry) && !this.roadblocks.some(r => r.gridX === rx && r.gridY === ry)) {
                const roadblock = new Roadblock(this, rx, ry);
                this.roadblocks.push(roadblock);
                break;
            }
        }
    }

    getFarSpawnPoint() {
        let attempts = 0;
        while (attempts < 50) {
            attempts++;
            const pt = this.mapManager.getRandomSpawnPoint();
            const dist = Math.abs(pt.x - this.playerCar.gridX) + Math.abs(pt.y - this.playerCar.gridY);
            if (dist > 8) {
                return pt;
            }
        }
        return this.mapManager.getRandomSpawnPoint();
    }

    createExplosion(x, y) {
        const exp = this.add.circle(x, y, 30, 0xFF5500, 0.9).setDepth(50);
        this.tweens.add({
            targets: exp,
            scale: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => exp.destroy()
        });
        this.cameras.main.shake(150, 0.01);
    }

    takeDamage() {
        this.playerHealth--;
        this.uiManager.updateHealth(this.playerHealth);

        // Reset carried cash on getting rammed
        if (this.carriedCash > 0) {
            this.showHeatPopup(`LOST $${this.carriedCash}!`);
            this.carriedCash = 0;
            this.uiManager.updateCarriedCash(0);
        }

        if (this.playerHealth <= 0) {
            this.handleGameOver("BUSTED!");
        } else {
            this.isInvulnerable = true;
            this.tweens.add({
                targets: this.playerCar.visual,
                alpha: 0.2,
                duration: 100,
                yoyo: true,
                repeat: 10,
                onComplete: () => {
                    this.playerCar.visual.alpha = 1;
                    this.isInvulnerable = false;
                }
            });

            // Scatter police to prevent instant re-ramming
            for (let police of this.policeUnits) {
                police.chaseTimer = 0;
                const far = this.getFarSpawnPoint();
                police.gridX = far.x;
                police.gridY = far.y;
                police.targetX = far.x;
                police.targetY = far.y;
                police.updatePosition(0);
            }
        }
    }

    handleGameOver(reason) {
        this.gameOver = true;
        this.uiManager.showGameOver(reason);

        this.input.once('pointerdown', () => {
            this.scene.restart();
        });
        this.input.keyboard.once('keydown-ENTER', () => {
            this.scene.restart();
        });
    }

    checkCollectibles() {
        const item = this.mapManager.getCollectibleAt(this.playerCar.gridX, this.playerCar.gridY);
        if (item) {
            if (item.type === COLLECTIBLE_TYPES.MONEY) {
                this.carriedCash += 100;
                this.uiManager.updateCarriedCash(this.carriedCash);
                this.addHeat(25);
                for (let police of this.policeUnits) {
                    police.chaseTimer = 12000;
                }
            } else if (item.type === COLLECTIBLE_TYPES.REPAIR || item.type === COLLECTIBLE_TYPES.LIFE) {
                if (this.playerHealth < this.maxPlayerHealth) {
                    this.playerHealth++;
                    this.uiManager.updateHealth(this.playerHealth);
                }
            } else if (this.inventory[item.type] !== undefined) {
                if (this.inventory[item.type] < this.maxStacks[item.type]) {
                    this.inventory[item.type]++;
                    this.uiManager.updateMultiInventory(this.inventory);
                }
            }

            this.mapManager.removeCollectible(item);
            this.mapManager.spawnRandomCollectibles(1);
        }
    }

    getNearestMoneyCollectible() {
        if (!this.mapManager.collectibles || this.mapManager.collectibles.length === 0) return null;

        let nearest = null;
        let minDist = Infinity;

        for (let item of this.mapManager.collectibles) {
            if (item.type === COLLECTIBLE_TYPES.MONEY) {
                const dist = Math.abs(item.gridX - this.playerCar.gridX) + Math.abs(item.gridY - this.playerCar.gridY);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = item;
                }
            }
        }

        return nearest;
    }
}
