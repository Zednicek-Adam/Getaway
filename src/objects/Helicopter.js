import { TILE_SIZE } from '../constants';
import { CONFIG } from '../config';

// Where the balloon is drawn relative to its ground point (the limelight's
// centre). It floats well above and behind the beam so it never sits on top
// of the player; its shadow is thrown down-right like every other shadow.
const BODY_LIFT = 110;
const LAMP_Y = 36;            // the limelight on the basket, below the body's centre
const SHADOW_OFFSET = { x: 44, y: 54 };
const BEAM_COLOUR = 0xffe8a8;

// The 5-star army observation balloon. Pixel-space follower (not grid-bound):
// drifts after the player at a fixed px/s so it lags on straights and cuts
// corners. Not destroyable — pure pressure. Its limelight on the player
// counts as "spotted".
export class Helicopter {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.frame = 1; // pennant hanging limp

        // Limelight cast on the ground (under riders, depth 0.8). The texture's
        // radius is exactly SPOT_RADIUS_TILES, so what you see is what spots you.
        this.spotlight = scene.add.image(x, y, 'spotlight').setDepth(0.8).setBlendMode('ADD');
        this.spotlight.setDisplaySize(CONFIG.HELICOPTER.SPOT_RADIUS_TILES * TILE_SIZE * 2,
            CONFIG.HELICOPTER.SPOT_RADIUS_TILES * TILE_SIZE * 2);

        // The beam from the basket down to the pool of light, then the balloon
        // itself above everything on the ground; its shadow lies on the street
        this.beam = scene.add.graphics().setDepth(4.9).setBlendMode('ADD');
        this.shadow = scene.add.image(x, y, 'balloonShadow').setDepth(0.85);
        this.body = scene.add.sprite(x, y, 'balloon', this.frame).setDepth(5);
        this.time = 0;
    }

    // Drift toward (targetX, targetY) at a fixed pixel speed (no naive lerp),
    // then drag every visual along. The pennant streams back from the way
    // the balloon is drifting.
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
            this.frame = Math.abs(dx) < dist * 0.4 ? 1 : dx > 0 ? 0 : 2;
        }

        this.time += delta;
        const bob = Math.round(Math.sin(this.time / 420) * 3);
        const bodyY = this.y - BODY_LIFT + bob;
        this.spotlight.setPosition(this.x, this.y);
        this.spotlight.setAlpha(0.85 + Math.sin(this.time / 90) * 0.08);
        this.shadow.setPosition(this.x + SHADOW_OFFSET.x, this.y + SHADOW_OFFSET.y);
        this.body.setPosition(this.x, bodyY).setFrame(this.frame)
            .setAngle(Math.sin(this.time / 700) * 2.5);

        // A faint cone of limelight from the lamp to the ground
        const r = CONFIG.HELICOPTER.SPOT_RADIUS_TILES * TILE_SIZE * 0.8;
        this.beam.clear()
            .fillStyle(BEAM_COLOUR, 0.1 + Math.sin(this.time / 90) * 0.02)
            .fillTriangle(this.x, bodyY + LAMP_Y, this.x - r, this.y, this.x + r, this.y);
    }

    // Euclidean overlap of the limelight with the player position.
    isOverPlayer(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const radius = CONFIG.HELICOPTER.SPOT_RADIUS_TILES * TILE_SIZE;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
    }

    destroy() {
        this.spotlight.destroy();
        this.beam.destroy();
        this.shadow.destroy();
        this.body.destroy();
    }
}
