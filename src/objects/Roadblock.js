import { TILE_SIZE } from '../constants';

export class Roadblock {
    constructor(scene, gridX, gridY) {
        this.scene = scene;
        this.gridX = gridX;
        this.gridY = gridY;
        this.hp = 1;

        const posX = gridX * TILE_SIZE + TILE_SIZE / 2;
        const posY = gridY * TILE_SIZE + TILE_SIZE / 2;

        this.visual = this.scene.add.graphics();
        this.render();

        this.visual.x = posX;
        this.visual.y = posY;
        this.visual.setDepth(20);

        // Flashing hazard light on roadblock
        this.light = this.scene.add.circle(posX, posY - 10, 5, 0xFF0000).setDepth(21);
        this.lightTween = this.scene.tweens.add({
            targets: this.light,
            alpha: 0.1,
            duration: 250,
            yoyo: true,
            repeat: -1
        });
    }

    render() {
        this.visual.clear();

        const w = TILE_SIZE * 0.7;
        const h = TILE_SIZE * 0.35;

        // Wooden/Metal Barrier base
        this.visual.fillStyle(0xDD8800, 1);
        this.visual.fillRect(-w / 2, -h / 2, w, h);

        // Striped pattern (yellow/black)
        this.visual.fillStyle(0x000000, 1);
        for (let x = -w / 2; x < w / 2; x += 12) {
            this.visual.beginPath();
            this.visual.moveTo(x, -h / 2);
            this.visual.lineTo(x + 6, -h / 2);
            this.visual.lineTo(x - 2, h / 2);
            this.visual.lineTo(x - 8, h / 2);
            this.visual.closePath();
            this.visual.fill();
        }

        // Outer border
        this.visual.lineStyle(2, 0xFFFFFF, 1);
        this.visual.strokeRect(-w / 2, -h / 2, w, h);
    }

    takeHit() {
        this.hp--;
        return this.hp <= 0;
    }

    destroy() {
        if (this.lightTween) this.lightTween.stop();
        if (this.light) this.light.destroy();
        if (this.visual) this.visual.destroy();
    }
}
