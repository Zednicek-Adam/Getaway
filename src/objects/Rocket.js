import Phaser from 'phaser';
import { TILE_SIZE, DIRECTIONS } from '../constants';
import { CONFIG } from '../config';

const ROPE = 0xd0a868;
const ROPE_DARK = 0x1e130f;

// A thrown lasso, flying down road tiles along a fixed facing. Steps one tile
// every CONFIG.ROCKET.MS_PER_TILE (leftover timer carries), lerping the loop
// continuously between tiles so it never teleports, the rope paying out
// behind it back to the rider's hand. Hit resolution lives in GameScene
// (mirrors the Bomb split): update() only reports tile stepping.
export class Rocket {
    // `anchor` is the thrower's sprite: the rope stays tied to it in flight
    constructor(scene, gridX, gridY, direction, anchor = null) {
        this.scene = scene;
        this.gridX = gridX;
        this.gridY = gridY;
        this.direction = direction;
        this.anchor = anchor;

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

        // Continuous visual position (also read by GameScene for the miss puff)
        this.visualX = gridX * TILE_SIZE + TILE_SIZE / 2;
        this.visualY = gridY * TILE_SIZE + TILE_SIZE / 2;

        // Depth 2: above riders (1). The rope is drawn under the loop.
        this.rope = scene.add.graphics().setDepth(1.95);
        this.body = scene.add.sprite(this.visualX, this.visualY, 'lasso', 0).setDepth(2.1);
        this.body.play('lasso-spin');

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

        // The rope back to the rider, with a little sag across the throw
        this.rope.clear();
        if (!this.anchor) return;
        const ax = this.anchor.x;
        const ay = this.anchor.y;
        const mx = (ax + this.visualX) / 2 + this.dy * 6;
        const my = (ay + this.visualY) / 2 + Math.abs(this.dx) * 6;
        const curve = new Phaser.Curves.QuadraticBezier(
            new Phaser.Math.Vector2(ax, ay), new Phaser.Math.Vector2(mx, my),
            new Phaser.Math.Vector2(this.visualX - this.dx * 12, this.visualY - this.dy * 12));
        this.rope.lineStyle(4, ROPE_DARK, 1);
        curve.draw(this.rope, 16);
        this.rope.lineStyle(2, ROPE, 1);
        curve.draw(this.rope, 16);
    }

    destroy() {
        this.body.destroy();
        this.rope.destroy();
    }
}
