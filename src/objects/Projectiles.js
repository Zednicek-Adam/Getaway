import Phaser from 'phaser';
import { TILE_SIZE, DIRECTIONS } from '../constants';

export class Rocket {
    constructor(scene, gridX, gridY, direction, mapManager) {
        this.scene = scene;
        this.direction = direction;
        this.mapManager = mapManager;
        this.speed = 600; // pixels per second

        this.x = gridX * TILE_SIZE + TILE_SIZE / 2;
        this.y = gridY * TILE_SIZE + TILE_SIZE / 2;

        this.visual = this.scene.add.graphics().setDepth(30);
        this.render();
        this.visual.setPosition(this.x, this.y);

        // Rotation based on direction
        let rot = 0;
        if (direction === DIRECTIONS.UP) rot = -Math.PI / 2;
        else if (direction === DIRECTIONS.DOWN) rot = Math.PI / 2;
        else if (direction === DIRECTIONS.LEFT) rot = Math.PI;
        else if (direction === DIRECTIONS.RIGHT) rot = 0;

        this.visual.setRotation(rot);
        this.active = true;
    }

    render() {
        this.visual.clear();
        // Rocket cone body
        this.visual.fillStyle(0xFF4500, 1);
        this.visual.fillTriangle(12, 0, -10, -6, -10, 6);
        // Rocket tip
        this.visual.fillStyle(0xFFFF00, 1);
        this.visual.fillTriangle(14, 0, 8, -4, 8, 4);
    }

    update(time, delta) {
        if (!this.active) return;

        let dx = 0;
        let dy = 0;
        if (this.direction === DIRECTIONS.UP) dy = -1;
        else if (this.direction === DIRECTIONS.DOWN) dy = 1;
        else if (this.direction === DIRECTIONS.LEFT) dx = -1;
        else if (this.direction === DIRECTIONS.RIGHT) dx = 1;

        this.x += dx * this.speed * (delta / 1000);
        this.y += dy * this.speed * (delta / 1000);

        this.visual.setPosition(this.x, this.y);

        // Grid coordinates
        const gx = Math.floor(this.x / TILE_SIZE);
        const gy = Math.floor(this.y / TILE_SIZE);

        // Check map boundary or wall collision
        if (!this.mapManager.isRoad(gx, gy)) {
            this.explode();
        }
    }

    explode() {
        if (!this.active) return;
        this.active = false;

        // Visual explosion effect
        const exp = this.scene.add.circle(this.x, this.y, 25, 0xFF6600, 0.9).setDepth(40);
        this.scene.tweens.add({
            targets: exp,
            scale: 1.8,
            alpha: 0,
            duration: 200,
            onComplete: () => exp.destroy()
        });

        this.visual.destroy();
    }
}

export class BombTrap {
    constructor(scene, gridX, gridY) {
        this.scene = scene;
        this.gridX = gridX;
        this.gridY = gridY;

        this.x = gridX * TILE_SIZE + TILE_SIZE / 2;
        this.y = gridY * TILE_SIZE + TILE_SIZE / 2;

        this.visual = this.scene.add.graphics().setDepth(18);
        this.render();
        this.visual.setPosition(this.x, this.y);

        this.active = true;

        // Fuse pulse tween
        this.fuseTween = this.scene.tweens.add({
            targets: this.visual,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 300,
            yoyo: true,
            repeat: -1
        });
    }

    render() {
        this.visual.clear();
        // Bomb body
        this.visual.fillStyle(0x222222, 1);
        this.visual.fillCircle(0, 0, 14);
        // Fuse cap
        this.visual.fillStyle(0xFF8800, 1);
        this.visual.fillCircle(0, -12, 4);
        // Outline
        this.visual.lineStyle(2, 0xFF0000, 0.9);
        this.visual.strokeCircle(0, 0, 14);
    }

    explode() {
        if (!this.active) return;
        this.active = false;

        if (this.fuseTween) this.fuseTween.stop();

        // Big explosion visual effect
        const exp = this.scene.add.circle(this.x, this.y, 35, 0xFF4400, 0.9).setDepth(40);
        this.scene.tweens.add({
            targets: exp,
            scale: 2.2,
            alpha: 0,
            duration: 300,
            onComplete: () => exp.destroy()
        });

        this.visual.destroy();
    }
}
