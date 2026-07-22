import { PoliceCar } from './PoliceCar';

export class SwatVan extends PoliceCar {
    constructor(scene, gridX, gridY, mapManager, target) {
        super(scene, gridX, gridY, mapManager, target);

        // SWAT Van is slower than standard police (350 -> 450)
        this.moveConfig.duration = 450;
        this.hp = 2;
        this.maxHp = 2;

        // Dark heavy armor styling
        this.visual.setTint(0x556677);
        this.visual.setScale(1.2);
    }

    takeHit() {
        this.hp--;
        if (this.hp === 1) {
            // Flash red & add smoke indicator
            this.scene.tweens.add({
                targets: this.visual,
                alpha: 0.3,
                duration: 100,
                yoyo: true,
                repeat: 3
            });
            this.visual.setTint(0x884444);
            return false; // Not destroyed yet
        }
        return true; // Destroyed!
    }
}
