import Phaser from 'phaser';
import { TILE_SIZE, DIRECTIONS } from '../constants';
import { CONFIG } from '../config';
import { smokePuff } from '../fx';

// Sprite art faces right; rotate to the fixed heading
const ANGLE_BY_DIRECTION = {
    [DIRECTIONS.RIGHT]: 0,
    [DIRECTIONS.DOWN]: 90,
    [DIRECTIONS.LEFT]: 180,
    [DIRECTIONS.UP]: -90,
};

// A rocket fired down road tiles along a fixed facing. Steps one tile every
// CONFIG.ROCKET.MS_PER_TILE (leftover timer carries), lerping its visual
// continuously between tiles so it never teleports. Hit resolution lives in
// GameScene (mirrors the Bomb split): update() only reports tile stepping.
export class Rocket {
    constructor(scene, gridX, gridY, direction) {
        this.scene = scene;
        this.gridX = gridX;
        this.gridY = gridY;
        this.direction = direction;

        // Fixed heading — same DIRECTIONS switch idiom as Car.startMove
        this.dx = 0;
        this.dy = 0;
        switch (direction) {
            case DIRECTIONS.UP: this.dy = -1; break;
            case DIRECTIONS.DOWN: this.dy = 1; break;
            case DIRECTIONS.LEFT: this.dx = -1; break;
            case DIRECTIONS.RIGHT: this.dx = 1; break;
        }

        this.tilesTraveled = 0;
        this.moveTimer = 0;
        this.trailTimer = 0;

        // Continuous visual position (also read by GameScene for fizzle bursts)
        this.visualX = gridX * TILE_SIZE + TILE_SIZE / 2;
        this.visualY = gridY * TILE_SIZE + TILE_SIZE / 2;

        // Depth 2: above cars (1). An additive exhaust glow rides behind it.
        this.trail = scene.add.image(this.visualX, this.visualY, 'glow')
            .setBlendMode('ADD').setTint(0xff9a2a).setAlpha(0.85).setDepth(2);
        this.body = scene.add.sprite(this.visualX, this.visualY, 'rocket', 0)
            .setAngle(ANGLE_BY_DIRECTION[direction])
            .setDepth(2.1);
        this.body.play('rocket-fly');

        this.updateVisual();
    }

    // Advance at most one tile per call; carry any leftover timer. Returns
    // 'advanced' on the frame a new tile was entered (GameScene resolves hits
    // only then), else null.
    update(delta) {
        this.moveTimer += delta;

        let stepped = false;
        if (this.moveTimer >= CONFIG.ROCKET.MS_PER_TILE) {
            this.moveTimer -= CONFIG.ROCKET.MS_PER_TILE;
            this.gridX += this.dx;
            this.gridY += this.dy;
            this.tilesTraveled++;
            stepped = true;
        }

        this.updateVisual();

        // Smoke trail
        this.trailTimer += delta;
        if (this.trailTimer >= 28) {
            this.trailTimer = 0;
            smokePuff(this.scene,
                this.visualX - this.dx * 18, this.visualY - this.dy * 18,
                { drift: 6, scale: 0.9, depth: 1.9, tint: 0xd8d8e0 });
        }
        return stepped ? 'advanced' : null;
    }

    // Lerp from the current tile toward the next along the fixed heading
    updateVisual() {
        const t = Math.min(this.moveTimer / CONFIG.ROCKET.MS_PER_TILE, 1);

        const startX = this.gridX * TILE_SIZE + TILE_SIZE / 2;
        const startY = this.gridY * TILE_SIZE + TILE_SIZE / 2;
        const endX = (this.gridX + this.dx) * TILE_SIZE + TILE_SIZE / 2;
        const endY = (this.gridY + this.dy) * TILE_SIZE + TILE_SIZE / 2;

        this.visualX = Phaser.Math.Linear(startX, endX, t);
        this.visualY = Phaser.Math.Linear(startY, endY, t);

        this.body.x = this.visualX;
        this.body.y = this.visualY;

        // Exhaust glow lags a fraction of a tile behind the heading
        this.trail.x = this.visualX - this.dx * TILE_SIZE * 0.25;
        this.trail.y = this.visualY - this.dy * TILE_SIZE * 0.25;
    }

    destroy() {
        this.body.destroy();
        this.trail.destroy();
    }
}
