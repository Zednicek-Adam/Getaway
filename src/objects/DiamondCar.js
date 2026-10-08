import { Car } from './Car';
import { CONFIG } from '../config';

// The diamond delivery truck: an armoured courier that roams the streets.
// Ramming it awards the diamond (GameScene handles the collision). Police
// and bombs ignore it entirely — it never joins PoliceManager.units.
export class DiamondCar extends Car {
    constructor(scene, gridX, gridY, mapManager) {
        super(scene, gridX, gridY, mapManager, { textureKey: 'diamondTruck' });

        this.moveConfig.duration = CONFIG.DIAMOND_CAR.MOVE_DURATION;

        // A cyan glint pops on the truck every so often so it reads as loot
        this.sparkleTimer = 0;
        this.glint = scene.add.sprite(0, 0, 'spark', 0)
            .setDepth(1.1)
            .setTint(0x9ff6ff)
            .setVisible(false);
        this.glint.on('animationcomplete', () => this.glint.setVisible(false));
    }

    update(time, delta) {
        super.update(time, delta);

        this.sparkleTimer += delta;
        if (this.sparkleTimer >= 700) {
            this.sparkleTimer = 0;
            this.glintOffset = { x: (Math.random() - 0.5) * 24, y: (Math.random() - 0.5) * 24 };
            this.glint.setVisible(true).play('spark-twinkle');
        }
        if (this.glint.visible) {
            // Ride along with the truck while the twinkle plays
            this.glint.setPosition(this.visual.x + this.glintOffset.x, this.visual.y + this.glintOffset.y);
        }
    }

    destroy() {
        this.glint.destroy();
        super.destroy();
    }

    // Re-decide routing at every tile, same pattern as PoliceCar
    tryMove() {
        this.decideNextMove();
        super.tryMove();
    }

    decideNextMove() {
        const moves = this.getValidMoves();
        if (moves.length > 0) {
            this.setBufferedInput(this.pickRoamMove(moves));
        }
    }
}
