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
        const pixel = Math.round(TILE_SIZE / 16);
        const size = pixel * 6;
        const half = size / 2;

        switch (this.type) {
            case COLLECTIBLE_TYPES.MONEY:
                // Pixel money stack in robber palette
                this.visual.fillStyle(0x0D3B24, 1);
                this.visual.fillRect(-half, -half, size, size);
                this.visual.fillStyle(COLORS.MONEY, 1);
                this.visual.fillRect(-half + pixel, -half + pixel, size - pixel * 2, size - pixel * 2);
                this.visual.fillStyle(0x1B5E20, 1);
                this.visual.fillRect(-half + pixel * 2, -half + pixel * 2, size - pixel * 4, size - pixel * 4);
                this.visual.fillStyle(0xFFF7B1, 1);
                this.visual.fillRect(-pixel, -pixel / 2, pixel * 2, pixel);
                break;
            case COLLECTIBLE_TYPES.FUEL:
                // Pixel jerrycan
                this.visual.fillStyle(0x7A0E0E, 1);
                this.visual.fillRect(-half + pixel, -half + pixel, size - pixel * 2, size - pixel);
                this.visual.fillStyle(0xB51D1D, 1);
                this.visual.fillRect(-half + pixel * 2, -half + pixel * 2, size - pixel * 4, size - pixel * 3);
                this.visual.fillStyle(0xD6D6D6, 1);
                this.visual.fillRect(half - pixel * 2, -half, pixel, pixel * 2);
                this.visual.fillStyle(0x232323, 1);
                this.visual.fillRect(-pixel / 2, -pixel / 2, pixel, pixel);
                break;
            case COLLECTIBLE_TYPES.BOMB:
                this.visual.fillStyle(COLORS.BOMB, 1);
                this.visual.fillCircle(0, 0, TILE_SIZE * 0.25);
                break;
        }
    }

    destroy() {
        this.visual.destroy();
    }
}
