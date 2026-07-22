import { TILE_SIZE, COLORS } from '../constants';

export const COLLECTIBLE_TYPES = {
    MONEY: 'money',
    JERRY_CAN: 'jerry_can',
    REPAIR: 'repair',
    LIFE: 'life',
    NITRO: 'nitro',
    BOMB: 'bomb',
    ROCKET: 'rocket',
};

export class Collectible {
    constructor(scene, type, gridX, gridY) {
        this.scene = scene;
        this.type = type;
        this.gridX = gridX;
        this.gridY = gridY;

        const posX = gridX * TILE_SIZE + TILE_SIZE / 2;
        const posY = gridY * TILE_SIZE + TILE_SIZE / 2;

        this.visual = this.scene.add.graphics();
        this.render();

        this.visual.x = posX;
        this.visual.y = posY;
        this.visual.setDepth(15);

        let symbol = '';
        if (type === COLLECTIBLE_TYPES.MONEY) symbol = '$';
        else if (type === COLLECTIBLE_TYPES.JERRY_CAN) symbol = 'J';
        else if (type === COLLECTIBLE_TYPES.REPAIR) symbol = '+';
        else if (type === COLLECTIBLE_TYPES.LIFE) symbol = '♥';
        else if (type === COLLECTIBLE_TYPES.NITRO) symbol = 'N';
        else if (type === COLLECTIBLE_TYPES.BOMB) symbol = 'B';
        else if (type === COLLECTIBLE_TYPES.ROCKET) symbol = 'R';

        this.label = this.scene.add.text(posX, posY, symbol, {
            fontFamily: 'Arial',
            fontSize: '14px',
            fontStyle: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(16);

        // Add simple tween for "juice"
        this.tween = this.scene.tweens.add({
            targets: [this.visual, this.label],
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
            case COLLECTIBLE_TYPES.JERRY_CAN:
                color = 0xFF8800; // Jerry Can Amber/Orange
                break;
            case COLLECTIBLE_TYPES.REPAIR:
                color = COLORS.REPAIR;
                break;
            case COLLECTIBLE_TYPES.LIFE:
                color = COLORS.LIFE;
                break;
            case COLLECTIBLE_TYPES.NITRO:
                color = COLORS.NITRO;
                break;
            case COLLECTIBLE_TYPES.BOMB:
                color = COLORS.BOMB;
                break;
            case COLLECTIBLE_TYPES.ROCKET:
                color = COLORS.ROCKET;
                break;
        }

        this.visual.fillStyle(color, 1);
        this.visual.fillCircle(0, 0, radius);

        // Outline
        this.visual.lineStyle(2, 0xFFFFFF, 0.9);
        this.visual.strokeCircle(0, 0, radius);
    }

    destroy() {
        if (this.tween) this.tween.stop();
        if (this.label) this.label.destroy();
        this.visual.destroy();
    }
}

