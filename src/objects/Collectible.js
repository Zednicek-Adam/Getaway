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

        let color = 0xFFFFFF;
        let radius = TILE_SIZE * 0.25;

        switch (this.type) {
            case COLLECTIBLE_TYPES.MONEY:
                color = COLORS.MONEY;
                break;
            case COLLECTIBLE_TYPES.FUEL:
                color = COLORS.FUEL;
                break;
            case COLLECTIBLE_TYPES.BOMB:
                color = COLORS.BOMB;
                break;
        }

        this.visual.fillStyle(color, 1);
        this.visual.fillCircle(0, 0, radius);

        // Outline
        this.visual.lineStyle(2, 0xFFFFFF, 0.8);
        this.visual.strokeCircle(0, 0, radius);

        // Small white fuse dot so bombs read as bombs
        if (this.type === COLLECTIBLE_TYPES.BOMB) {
            this.visual.fillStyle(0xFFFFFF, 1);
            this.visual.fillCircle(radius * 0.4, -radius * 0.7, 3);
        }
    }

    destroy() {
        this.visual.destroy();
    }
}
