import { TILE_SIZE } from '../constants';
import { CONFIG } from '../config';
import { PICKUP_FRAMES } from '../art';

// A bomb laid on a road tile. Its LED blinks faster as the fuse runs down; the
// scene detonates it when a police unit enters the tile (or harmlessly on expiry).
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

        // Depth 0.5/0.6: above roads and collectibles, below cars (1)
        this.shadow = scene.add.image(cx, cy + 12, 'shadow').setDepth(0.45);
        this.body = scene.add.sprite(cx, cy, 'pickups', PICKUP_FRAMES.planted).setDepth(0.5);
        this.dot = scene.add.image(cx, cy + 4, 'glow')
            .setBlendMode('ADD').setTint(0xff2233).setScale(0.9).setAlpha(0.8).setDepth(0.6);

        // Drop onto the road with a little bounce
        this.body.setScale(1.6).setAlpha(0);
        scene.tweens.add({ targets: this.body, scale: 1, alpha: 1, duration: 220, ease: 'Bounce.easeOut' });
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
            this.body.setFrame(PICKUP_FRAMES.planted + (this.dotOn ? 0 : 1));
        }

        return this.fuseRemaining <= 0;
    }

    destroy() {
        this.body.destroy();
        this.dot.destroy();
        this.shadow.destroy();
    }
}
