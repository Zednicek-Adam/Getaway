import { Car } from './Car';
import { CONFIG } from '../config';

// The diamond delivery car: a cyan-tinted civilian that roams the streets.
// Ramming it awards the diamond (GameScene handles the collision). Police
// and bombs ignore it entirely — it never joins PoliceManager.units.
export class DiamondCar extends Car {
    constructor(scene, gridX, gridY, mapManager) {
        super(scene, gridX, gridY, mapManager, { textureKey: 'playerCar' });

        this.visual.setTint(0x66ffff);
        this.moveConfig.duration = CONFIG.DIAMOND_CAR.MOVE_DURATION;

        // Subtle sparkle so it reads as special (cleaned up when the visual
        // is destroyed — same pattern as Collectible's idle tween)
        scene.tweens.add({
            targets: this.visual,
            alpha: 0.85,
            duration: 400,
            yoyo: true,
            repeat: -1,
        });
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
