import { TILE_SIZE } from '../constants';
import { CONFIG } from '../config';

// A 5-star helicopter. Pixel-space follower (not grid-bound): chases the player
// at a fixed px/s so it lags on straights and cuts corners. Not destroyable —
// pure pressure. Its spotlight overlapping the player counts as "spotted".
export class Helicopter {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;

        const spotRadius = CONFIG.HELICOPTER.SPOT_RADIUS_TILES * TILE_SIZE;

        // Yellow spotlight cast on the ground (under cars, depth 0.8)
        this.spotlight = scene.add.circle(x, y, spotRadius, 0xFFFF66, 0.15).setDepth(0.8);

        // Body + rotor sit above cars (depth 5)
        this.body = scene.add.circle(x, y, 14, 0x222233)
            .setStrokeStyle(2, 0x000000)
            .setDepth(5);
        this.rotor = scene.add.rectangle(x, y, 44, 4, 0x111111).setDepth(5);
    }

    // Move toward (targetX, targetY) at a fixed pixel speed (no naive lerp), then
    // drag every visual to the new position and spin the rotor.
    update(delta, targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.0001) {
            const step = Math.min(CONFIG.HELICOPTER.SPEED_PX_S * (delta / 1000), dist);
            this.x += (dx / dist) * step;
            this.y += (dy / dist) * step;
        }

        this.spotlight.x = this.x;
        this.spotlight.y = this.y;
        this.body.x = this.x;
        this.body.y = this.y;
        this.rotor.x = this.x;
        this.rotor.y = this.y;
        this.rotor.rotation += delta * 0.03;
    }

    // Euclidean overlap of the spotlight with the player position.
    isOverPlayer(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const radius = CONFIG.HELICOPTER.SPOT_RADIUS_TILES * TILE_SIZE;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
    }

    destroy() {
        this.spotlight.destroy();
        this.body.destroy();
        this.rotor.destroy();
    }
}
