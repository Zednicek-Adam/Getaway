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

        this.visual = this.scene.add.graphics();
        this.render();

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

    render() {
        this.visual.clear();

        if (this.type === COLLECTIBLE_TYPES.MONEY) {
            // Pixel art Money Bag
            this.visual.fillStyle(0x000000, 1); // Outline shadow
            this.visual.fillEllipse(0, 4, 22, 18);

            // Main bag body
            this.visual.fillStyle(0xF5DEB3, 1); // Wheat/Canvas color
            this.visual.fillEllipse(0, 4, 20, 16);

            // Bag tie / top
            this.visual.fillStyle(0x8B4513, 1); // Saddle brown tie
            this.visual.fillRect(-4, -6, 8, 4);

            // Bag frill top
            this.visual.fillStyle(0xF5DEB3, 1);
            this.visual.fillTriangle(-6, -10, 6, -10, 0, -6);

            // Dollar Sign ($) using green
            this.visual.fillStyle(0x228B22, 1); // Forest Green
            this.visual.fillRect(-1, -1, 2, 10); // vertical line
            this.visual.fillRect(-3, 0, 6, 2); // top loop
            this.visual.fillRect(-3, 3, 6, 2); // middle loop
            this.visual.fillRect(-3, 6, 6, 2); // bottom loop

        } else if (this.type === COLLECTIBLE_TYPES.FUEL) {
            // Pixel art Jerrycan
            const canWidth = 16;
            const canHeight = 20;
            const halfW = canWidth / 2;
            const halfH = canHeight / 2;

            // Outline shadow
            this.visual.fillStyle(0x000000, 1);
            this.visual.fillRect(-halfW - 2, -halfH - 2, canWidth + 4, canHeight + 4);

            // Main Can Body
            this.visual.fillStyle(0xDC143C, 1); // Crimson Red
            this.visual.fillRect(-halfW, -halfH, canWidth, canHeight);

            // Indents/Details
            this.visual.fillStyle(0x8B0000, 1); // Dark Red
            this.visual.fillRect(-halfW + 4, -halfH + 4, 2, 12);
            this.visual.fillRect(halfW - 6, -halfH + 4, 2, 12);

            // Handle
            this.visual.fillStyle(0xDC143C, 1);
            this.visual.fillRect(-halfW + 2, -halfH - 6, canWidth - 4, 4);
            // Hole in handle
            this.visual.fillStyle(0x222222, 1); // Background color for cutout
            this.visual.fillRect(-halfW + 4, -halfH - 4, canWidth - 8, 2);

            // Spout
            this.visual.fillStyle(0xAAAAAA, 1); // Grey spout
            this.visual.fillRect(-halfW - 4, -halfH, 4, 4);

        } else {
            // Fallback for others (e.g. BOMB, DIAMOND)
            let color = 0xFFFFFF;
            let radius = TILE_SIZE * 0.25;

            switch (this.type) {
                case COLLECTIBLE_TYPES.BOMB:
                    color = COLORS.BOMB;
                    break;
                case COLLECTIBLE_TYPES.DIAMOND:
                    color = 0x00FFFF;
                    break;
            }

            this.visual.fillStyle(color, 1);
            this.visual.fillCircle(0, 0, radius);

            // Outline
            this.visual.lineStyle(2, 0xFFFFFF, 0.8);
            this.visual.strokeCircle(0, 0, radius);
        }
    }

    destroy() {
        this.visual.destroy();
    }
}
