import { TILE_SIZE, COLORS } from '../constants';

export const COLLECTIBLE_TYPES = {
    MONEY: 'money',
    FUEL: 'fuel',
    BOMB: 'bomb',
    DIAMOND: 'diamond'
};

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
        // Money reads as a "$" symbol rather than a coin blob
        if (this.type === COLLECTIBLE_TYPES.MONEY) {
            return this.scene.add.text(0, 0, '$', {
                fontFamily: '"Press Start 2P"',
                fontSize: '26px',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 5,
            }).setOrigin(0.5);
        }

        // Other collectibles stay as coloured circles
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
