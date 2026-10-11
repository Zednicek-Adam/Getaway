import { TILE_SIZE } from '../constants';
import { CONFIG } from '../config';
import { PICKUP_FRAMES } from '../art';

// A bundle of dynamite laid on a street tile. Its fuse sputters faster as it
// burns down; the scene sets it off when a police unit enters the tile (or
// harmlessly when the fuse runs out).
export class Bomb {
    constructor(scene, gridX, gridY) {
        this.scene = scene;
        this.gridX = gridX;
        this.gridY = gridY;

        this.fuseRemaining = CONFIG.BOMB.FUSE_MS;
        this.blinkTimer = 0;
        this.sparkOn = true;

        const cx = gridX * TILE_SIZE + TILE_SIZE / 2;
        const cy = gridY * TILE_SIZE + TILE_SIZE / 2;

        // Depth 0.5/0.6: above streets and pickups, below riders (1). The
        // spark's glow sits on the fuse tip, top-right of the bundle.
        this.shadow = scene.add.image(cx, cy + 12, 'shadow').setDepth(0.45);
        this.body = scene.add.sprite(cx, cy, 'pickups', PICKUP_FRAMES.planted).setDepth(0.5);
        this.spark = scene.add.image(cx + 9, cy - 14, 'glow')
            .setBlendMode('ADD').setTint(0xff9a2a).setScale(0.8).setAlpha(0.9).setDepth(0.6);

        // Drop onto the street with a little bounce
        this.body.setScale(1.6).setAlpha(0);
        scene.tweens.add({ targets: this.body, scale: 1, alpha: 1, duration: 220, ease: 'Bounce.easeOut' });
    }

    // Burns the fuse and drives the sputter; returns true once the fuse is spent
    update(delta) {
        this.fuseRemaining -= delta;

        // Sputter interval shrinks as the fuse runs down (500ms → 100ms)
        const fraction = Math.max(0, this.fuseRemaining) / CONFIG.BOMB.FUSE_MS;
        const interval = 100 + 400 * fraction;

        this.blinkTimer += delta;
        if (this.blinkTimer >= interval) {
            this.blinkTimer = 0;
            this.sparkOn = !this.sparkOn;
            this.spark.setScale(this.sparkOn ? 0.9 : 0.55);
            this.body.setFrame(PICKUP_FRAMES.planted + (this.sparkOn ? 0 : 1));
        }

        return this.fuseRemaining <= 0;
    }

    destroy() {
        this.body.destroy();
        this.spark.destroy();
        this.shadow.destroy();
    }
}
