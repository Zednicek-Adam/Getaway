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

// Pixel-font glyphs in the shared "$" money style (green +, cyan N, orange R).
// Money is gold; the rest reuse the exact same styling.
export const COLLECTIBLE_GLYPHS = {
    [COLLECTIBLE_TYPES.MONEY]: { char: '$', color: '#FFD700' },
    [COLLECTIBLE_TYPES.REPAIR]: { char: '+', color: '#33FF66' },
    [COLLECTIBLE_TYPES.NITRO]: { char: 'N', color: '#66FFFF' },
    [COLLECTIBLE_TYPES.ROCKET]: { char: 'R', color: '#FF8800' },
};

// Builds a collectible's visual centred on (0, 0), unpositioned.
//
// Shared by the road pickups and the instructions screen so the icons the
// player is taught are literally the ones they'll see — `size` stands in for
// TILE_SIZE so the legend can draw them smaller without redefining geometry.
export function createCollectibleIcon(scene, type, size = TILE_SIZE) {
    const glyph = COLLECTIBLE_GLYPHS[type];
    if (glyph) {
        return scene.add.text(0, 0, glyph.char, {
            fontFamily: '"Press Start 2P"',
            fontSize: `${Math.round(size * 0.4)}px`,
            color: glyph.color,
            stroke: '#000000',
            strokeThickness: 5,
        }).setOrigin(0.5);
    }

    // LIFE — a graphics heart (the pixel font has no heart glyph)
    if (type === COLLECTIBLE_TYPES.LIFE) {
        const g = scene.add.graphics();
        const r = size * 0.12;
        g.fillStyle(0xFF3344, 1);
        g.fillCircle(-r, -r * 0.6, r);            // left lobe
        g.fillCircle(r, -r * 0.6, r);             // right lobe
        g.fillTriangle(-r * 2, -r * 0.2, r * 2, -r * 0.2, 0, r * 2); // bottom point
        return g;
    }

    // Other collectibles stay as coloured circles (BOMB, legacy FUEL)
    const g = scene.add.graphics();
    const radius = size * 0.25;
    const color = type === COLLECTIBLE_TYPES.FUEL ? COLORS.FUEL : COLORS.BOMB;

    g.fillStyle(color, 1);
    g.fillCircle(0, 0, radius);
    g.lineStyle(2, 0xFFFFFF, 0.8);
    g.strokeCircle(0, 0, radius);

    // Small white fuse dot so bombs read as bombs
    if (type === COLLECTIBLE_TYPES.BOMB) {
        g.fillStyle(0xFFFFFF, 1);
        g.fillCircle(radius * 0.4, -radius * 0.7, 3);
    }

    return g;
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
        return createCollectibleIcon(this.scene, this.type);
    }

    destroy() {
        this.visual.destroy();
    }
}
