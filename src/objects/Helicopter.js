import { TILE_SIZE } from '../constants';
import { CONFIG } from '../config';

// Where the airframe is drawn relative to its ground point (the spotlight
// centre). It hangs well above and behind the beam so it never sits on top of
// the player's car; the shadow is thrown down-right like every other shadow.
const BODY_LIFT = 84;
const SHADOW_OFFSET = { x: 40, y: 52 };

// A 5-star helicopter. Pixel-space follower (not grid-bound): chases the player
// at a fixed px/s so it lags on straights and cuts corners. Not destroyable —
// pure pressure. Its spotlight overlapping the player counts as "spotted".
export class Helicopter {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.frame = 4; // facing down, towards the player it spawned above

        // Spotlight cast on the ground (under cars, depth 0.8). The texture's
        // radius is exactly SPOT_RADIUS_TILES, so what you see is what spots you.
        this.spotlight = scene.add.image(x, y, 'spotlight').setDepth(0.8).setBlendMode('ADD');
        this.spotlight.setDisplaySize(CONFIG.HELICOPTER.SPOT_RADIUS_TILES * TILE_SIZE * 2,
            CONFIG.HELICOPTER.SPOT_RADIUS_TILES * TILE_SIZE * 2);

        // Airframe + rotor sit above cars (depth 5); the shadow is on the ground
        this.shadow = scene.add.sprite(x, y, 'heliShadow', this.frame).setDepth(0.85);
        this.body = scene.add.sprite(x, y, 'heli', this.frame).setDepth(5);
        this.rotor = scene.add.sprite(x, y, 'rotor', 0).setDepth(5.1).setAlpha(0.9);
        this.rotor.play('rotor-spin');
        this.time = 0;
    }

    // Move toward (targetX, targetY) at a fixed pixel speed (no naive lerp), then
    // drag every visual to the new position and turn the airframe to face along
    // its flight path.
    update(delta, targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.0001) {
            const step = Math.min(CONFIG.HELICOPTER.SPEED_PX_S * (delta / 1000), dist);
            this.x += (dx / dist) * step;
            this.y += (dy / dist) * step;
        }
        if (dist > 12) {
            // 8 pre-rotated frames, clockwise from "up"
            const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
            this.frame = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
        }

        this.time += delta;
        const hover = Math.round(Math.sin(this.time / 260) * 2);
        this.spotlight.setPosition(this.x, this.y);
        this.spotlight.setAlpha(0.85 + Math.sin(this.time / 90) * 0.08);
        this.shadow.setPosition(this.x + SHADOW_OFFSET.x, this.y + SHADOW_OFFSET.y).setFrame(this.frame);
        this.body.setPosition(this.x, this.y - BODY_LIFT + hover).setFrame(this.frame);
        this.rotor.setPosition(this.x, this.y - BODY_LIFT + hover - 4);
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
        this.shadow.destroy();
        this.body.destroy();
        this.rotor.destroy();
    }
}
