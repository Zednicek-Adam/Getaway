export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.score = 0;
        this.fuel = 100;

        // UI Panel Background
        this.panel = this.scene.add.rectangle(10, 10, 260, 90, 0x1a1a1a, 0.8)
            .setOrigin(0)
            .setStrokeStyle(4, 0xB22222)
            .setDepth(99)
            .setScrollFactor(0);

        // Striped pattern for panel background (simulated using small lines)
        for (let i = 10; i < 100; i += 20) {
            this.scene.add.rectangle(10, i, 260, 5, 0x000000, 0.4)
                .setOrigin(0)
                .setDepth(99)
                .setScrollFactor(0);
        }

        // UI Text Objects
        this.scoreText = this.scene.add.text(25, 25, 'SCORE: 0', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);

        this.fuelLabel = this.scene.add.text(25, 60, 'FUEL:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);

        // Fuel Gauge Settings
        this.gaugeX = 100;
        this.gaugeY = 60;
        this.gaugeWidth = 90;
        this.gaugeHeight = 14;

        // Fuel Gauge Background
        this.fuelGaugeBg = this.scene.add.rectangle(this.gaugeX, this.gaugeY, this.gaugeWidth, this.gaugeHeight, 0x333333)
            .setOrigin(0, 0)
            .setStrokeStyle(4, 0x888888)
            .setDepth(100)
            .setScrollFactor(0);

        // Fuel Gauge Fill
        this.fuelGaugeFill = this.scene.add.rectangle(this.gaugeX, this.gaugeY, this.gaugeWidth, this.gaugeHeight, 0x00FF00)
            .setOrigin(0, 0)
            .setDepth(101)
            .setScrollFactor(0);

        this.fuelPercentText = this.scene.add.text(this.gaugeX + this.gaugeWidth + 10, 62, '100%', {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);
    }

    updateScore(amount) {
        this.score += amount;
        this.scoreText.setText(`SCORE: ${this.score}`);
    }

    updateFuel(amount) {
        this.fuel += amount;
        if (this.fuel > 100) this.fuel = 100;
        if (this.fuel < 0) this.fuel = 0;

        // Update Gauge Fill Width
        const fillWidth = (this.fuel / 100) * this.gaugeWidth;
        this.fuelGaugeFill.setSize(fillWidth, this.gaugeHeight);

        // Update Percentage Text
        this.fuelPercentText.setText(`${Math.floor(this.fuel)}%`);

        // Color change based on fuel level
        let colorHex = 0x00FF00;
        let colorStr = '#00FF00';

        if (this.fuel < 20) {
            colorHex = 0xFF0000;
            colorStr = '#FF0000';
        } else if (this.fuel < 50) {
            colorHex = 0xFFFF00;
            colorStr = '#FFFF00';
        }

        this.fuelGaugeFill.setFillStyle(colorHex);
        this.fuelPercentText.setColor(colorStr);
    }

    showGameOver(reason) {
        const { width, height } = this.scene.scale;

        // Overlay background
        this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setDepth(190)
            .setScrollFactor(0);

        // Bank Robber Theme Panel
        const panelWidth = width * 0.8;
        const panelHeight = height * 0.6;
        const panelX = width / 2;
        const panelY = height / 2;

        this.scene.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x1a1a1a)
            .setOrigin(0.5)
            .setStrokeStyle(6, 0xB22222)
            .setDepth(195)
            .setScrollFactor(0);

        // Subdued stripes for panel
        for (let i = panelY - panelHeight / 2; i < panelY + panelHeight / 2; i += 40) {
            this.scene.add.rectangle(panelX - panelWidth / 2, i, panelWidth, 10, 0x000000, 0.3)
                .setOrigin(0)
                .setDepth(195)
                .setScrollFactor(0);
        }

        // Game Over Text
        this.scene.add.text(width / 2, panelY - 60, `GAME OVER`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '32px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
            shadow: { offsetX: 3, offsetY: 3, color: '#000000', fill: true }
        }).setOrigin(0.5).setDepth(200).setScrollFactor(0);

        // Reason Text
        this.scene.add.text(width / 2, panelY, reason, {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(200).setScrollFactor(0);

        // --- Restart Button ---
        const restartY = panelY + 80;

        const restartText = this.scene.add.text(width / 2, restartY, 'RESTART', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(200).setScrollFactor(0).setInteractive({ useHandCursor: true });

        // Hover effect for text
        restartText.on('pointerover', () => restartText.setFill('#FFD700'));
        restartText.on('pointerout', () => restartText.setFill('#FFFFFF'));

        // Arrows setup
        const arrowOffset = 90;

        const leftArrow = this.scene.add.text(width / 2 - arrowOffset, restartY, '>', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(200).setScrollFactor(0);

        const rightArrow = this.scene.add.text(width / 2 + arrowOffset, restartY, '<', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(200).setScrollFactor(0);

        // Arrow pulsing animation
        this.scene.tweens.add({
            targets: [leftArrow],
            x: width / 2 - arrowOffset + 15,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.scene.tweens.add({
            targets: [rightArrow],
            x: width / 2 + arrowOffset - 15,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Click to Restart is handled in GameScene.js, but we update text to look active
        restartText.on('pointerdown', () => {
            this.scene.scene.restart();
        });
    }
}
