export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.score = 0;
        this.fuel = 100;

        // UI Text Objects
        this.scoreText = this.scene.add.text(10, 44, 'SCORE 000000', {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            color: '#ffd166',
            stroke: '#000000',
            strokeThickness: 6
        }).setDepth(100).setScrollFactor(0);

        this.fuelText = this.scene.add.text(10, 80, 'FUEL 100%', {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            color: '#7eff89',
            stroke: '#000000',
            strokeThickness: 6
        }).setDepth(100).setScrollFactor(0);
    }

    updateScore(amount) {
        this.score += amount;
        this.scoreText.setText(`SCORE ${String(this.score).padStart(6, '0')}`);
    }

    updateFuel(amount) {
        this.fuel += amount;
        if (this.fuel > 100) this.fuel = 100;
        if (this.fuel < 0) this.fuel = 0;

        this.fuelText.setText(`FUEL ${Math.floor(this.fuel)}%`);

        // Color change for low fuel
        if (this.fuel < 20) {
            this.fuelText.setColor('#ff5e5e');
        } else {
            this.fuelText.setColor('#7eff89');
        }
    }

    showGameOver(reason) {
        const { width, height } = this.scene.scale;

        const bg = this.scene.add.rectangle(width / 2, height / 2, 760, 320, 0x120f1f, 0.9);
        bg.setStrokeStyle(6, 0xff5e5e);
        bg.setDepth(199);
        bg.setScrollFactor(0);

        const text = this.scene.add.text(width / 2, height / 2, `GAME OVER\n${reason}\n\nCLICK TO RESTART`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '30px',
            color: '#ff6b6b',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        });
        text.setOrigin(0.5);
        text.setDepth(200);
        text.setScrollFactor(0);
    }
}
