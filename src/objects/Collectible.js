import { TILE_SIZE, COLORS } from '../constants';

export const COLLECTIBLE_TYPES = {
    MONEY: 'money',
    FUEL: 'fuel',
    BOMB: 'bomb',
    DIAMOND: 'diamond',
    REPAIR: 'repair',
    NITRO: 'nitro',
    ROCKET: 'rocket',
    LIFE: 'life',
};

// Pure weighted picker: walks the weight entries accumulating a cumulative
// threshold and returns the first bucket the roll (0..1) falls into. Weight
// keys are COLLECTIBLE_TYPES string values. Object.entries preserves the
// insertion order of string keys, so the cumulative walk is deterministic.
export function pickCollectibleType(roll, weights) {
    let cumulative = 0;
    for (const [type, weight] of Object.entries(weights)) {
        cumulative += weight;
        if (roll < cumulative) return type;
    }
    return COLLECTIBLE_TYPES.MONEY; // float-sum fallback
}

export class Collectible {
    constructor(scene, type, gridX, gridY) {
        this.scene = scene;
        this.type = type;
        this.gridX = gridX;
        this.gridY = gridY;

        this.visual = this.createVisual();

        // Position visual
        this.visual.x = gridX * TILE_SIZE + TILE_SIZE / 2;
        this.visual.y = gridY * TILE_SIZE + TILE_SIZE / 2;

        // Add simple tween for "juice"
        this.scene.tweens.add({
            targets: this.visual,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }

    createVisual() {
        // Pixel-font glyphs in the shared "$" money style (green +, cyan N,
        // orange R). Money is gold; the rest reuse the exact same styling.
        const glyphs = {
            [COLLECTIBLE_TYPES.MONEY]: { char: '$', color: '#FFD700' },
            [COLLECTIBLE_TYPES.REPAIR]: { char: '+', color: '#33FF66' },
            [COLLECTIBLE_TYPES.NITRO]: { char: 'N', color: '#66FFFF' },
            [COLLECTIBLE_TYPES.ROCKET]: { char: 'R', color: '#FF8800' },
        };
        const glyph = glyphs[this.type];
        if (glyph) {
            return this.scene.add.text(0, 0, glyph.char, {
                fontFamily: '"Press Start 2P"',
                fontSize: '26px',
                color: glyph.color,
                stroke: '#000000',
                strokeThickness: 5,
            }).setOrigin(0.5);
        }

        // LIFE — a graphics heart (the pixel font has no heart glyph)
        if (this.type === COLLECTIBLE_TYPES.LIFE) {
            const g = this.scene.add.graphics();
            const r = TILE_SIZE * 0.12;
            g.fillStyle(0xFF3344, 1);
            g.fillCircle(-r, -r * 0.6, r);            // left lobe
            g.fillCircle(r, -r * 0.6, r);             // right lobe
            g.fillTriangle(-r * 2, -r * 0.2, r * 2, -r * 0.2, 0, r * 2); // bottom point
            return g;
        }

        // Other collectibles stay as coloured circles (BOMB, legacy FUEL)
        const g = this.scene.add.graphics();
        const radius = TILE_SIZE * 0.25;
        const color = this.type === COLLECTIBLE_TYPES.FUEL ? COLORS.FUEL : COLORS.BOMB;

        g.fillStyle(color, 1);
        g.fillCircle(0, 0, radius);
        g.lineStyle(2, 0xFFFFFF, 0.8);
        g.strokeCircle(0, 0, radius);

        // Small white fuse dot so bombs read as bombs
        if (this.type === COLLECTIBLE_TYPES.BOMB) {
            g.fillStyle(0xFFFFFF, 1);
            g.fillCircle(radius * 0.4, -radius * 0.7, 3);
        }

        return g;
    }

    destroy() {
        this.visual.destroy();
    }
}
