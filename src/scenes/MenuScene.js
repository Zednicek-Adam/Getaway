import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const { width, height } = this.scale;

        // Background
        this.cameras.main.setBackgroundColor('#1a1a1a');

        // Add some "bars" or stripes for a bank robber feel
        for (let i = 0; i < height; i += 40) {
            this.add.rectangle(0, i, width, 10, 0x000000, 0.3).setOrigin(0);
        }

        // Title text
        this.add.text(width / 2, height / 3, 'THE GETAWAY', {
            fontFamily: '"Press Start 2P"',
            fontSize: '48px',
            fill: '#FFD700', // Gold color
            stroke: '#B22222', // Deep red stroke
            strokeThickness: 8,
            shadow: { offsetX: 4, offsetY: 4, color: '#000000', fill: true }
        }).setOrigin(0.5);

        // Subtitle text
        this.add.text(width / 2, height / 3 + 60, 'PIXEL REMAKE', {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);


        // --- Start Button ---
        const startY = height * 2 / 3;

        // Start Text
        const startText = this.add.text(width / 2, startY, 'START', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // Hover effect for text
        startText.on('pointerover', () => startText.setFill('#FFD700'));
        startText.on('pointerout', () => startText.setFill('#FFFFFF'));

        // Arrows setup
        const arrowOffset = 80;

        const leftArrow = this.add.text(width / 2 - arrowOffset, startY, '>', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const rightArrow = this.add.text(width / 2 + arrowOffset, startY, '<', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Arrow pulsing animation
        this.tweens.add({
            targets: [leftArrow],
            x: width / 2 - arrowOffset + 15,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.tweens.add({
            targets: [rightArrow],
            x: width / 2 + arrowOffset - 15,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Start Game Action
        const startGame = () => {
            this.scene.start('GameScene');
        };

        startText.on('pointerdown', startGame);
        this.input.keyboard.once('keydown-ENTER', startGame);
        this.input.keyboard.once('keydown-SPACE', startGame);
    }
}
