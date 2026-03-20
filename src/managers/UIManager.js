export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.score = 0;
        this.fuel = 100;

        // UI Text Objects
        this.scoreText = this.scene.add.text(10, 30, 'Score: 0', {
            font: '20px Arial',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);

        this.fuelText = this.scene.add.text(10, 60, 'Fuel: 100%', {
            font: '20px Arial',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);
    }

    updateScore(amount) {
        this.score += amount;
        this.scoreText.setText(`Score: ${this.score}`);
    }

    updateFuel(amount) {
        this.fuel += amount;
        if (this.fuel > 100) this.fuel = 100;
        if (this.fuel < 0) this.fuel = 0;

        this.fuelText.setText(`Fuel: ${Math.floor(this.fuel)}%`);

        // Color change for low fuel
        if (this.fuel < 20) {
            this.fuelText.setColor('#FF0000');
        } else {
            this.fuelText.setColor('#00FF00');
        }
    }

    showGameOver(reason) {
        const { width, height } = this.scene.scale;

        const text = this.scene.add.text(width / 2, height / 2, `GAME OVER\n${reason}\n\nClick to Restart`, {
            font: '40px Arial',
            fill: '#ff0000',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        });
        text.setOrigin(0.5);
        text.setDepth(200);
        text.setScrollFactor(0);
    }
}
