import { TILE_SIZE } from '../constants';
import { CONFIG } from '../config';

// A bomb laid on a road tile. Blinks faster as the fuse runs down; the scene
// detonates it when a police unit enters the tile (or harmlessly on expiry).
export class Bomb {
    constructor(scene, gridX, gridY) {
        this.scene = scene;
        this.gridX = gridX;
        this.gridY = gridY;

        this.fuseRemaining = CONFIG.BOMB.FUSE_MS;
        this.blinkTimer = 0;
        this.dotOn = true;

        const cx = gridX * TILE_SIZE + TILE_SIZE / 2;
        const cy = gridY * TILE_SIZE + TILE_SIZE / 2;

        // Depth 0.5/0.6: above roads and collectibles (0), below cars (1)
        this.body = scene.add.circle(cx, cy, TILE_SIZE * 0.2, 0x000000)
            .setStrokeStyle(2, 0x444444)
            .setDepth(0.5);
        this.dot = scene.add.circle(cx, cy - TILE_SIZE * 0.12, TILE_SIZE * 0.06, 0xFF2222)
            .setDepth(0.6);
    }

    // Drains the fuse and drives the blink; returns true once the fuse expired
    update(delta) {
        this.fuseRemaining -= delta;

        // Blink interval shrinks as the fuse runs down (500ms → 100ms)
        const fraction = Math.max(0, this.fuseRemaining) / CONFIG.BOMB.FUSE_MS;
        const interval = 100 + 400 * fraction;

        this.blinkTimer += delta;
        if (this.blinkTimer >= interval) {
            this.blinkTimer = 0;
            this.dotOn = !this.dotOn;
            this.dot.setVisible(this.dotOn);
        }

        return this.fuseRemaining <= 0;
    }

    destroy() {
        this.body.destroy();
        this.dot.destroy();
    }
}
