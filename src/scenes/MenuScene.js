import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const { width, height } = this.scale;

        // Container for all menu elements (so we can slide them as one unit)
        this.menuContainer = this.add.container(0, 0);

        // Background panel (solid fill inside the container)
        const bg = this.add.rectangle(0, 0, width, height, 0x1a1a1a).setOrigin(0);
        this.menuContainer.add(bg);

        // Add some "bars" or stripes for a bank robber feel
        for (let i = 0; i < height; i += 40) {
            const bar = this.add.rectangle(0, i, width, 10, 0x000000, 0.3).setOrigin(0);
            this.menuContainer.add(bar);
        }

        // Title text
        const title = this.add.text(width / 2, height / 3, 'THE GETAWAY', {
            fontFamily: '"Press Start 2P"',
            fontSize: '48px',
            fill: '#FFD700', // Gold color
            stroke: '#B22222', // Deep red stroke
            strokeThickness: 8,
            shadow: { offsetX: 4, offsetY: 4, color: '#000000', fill: true }
        }).setOrigin(0.5);
        this.menuContainer.add(title);

        // Subtitle text
        const subtitle = this.add.text(width / 2, height / 3 + 60, 'PIXEL REMAKE', {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.menuContainer.add(subtitle);


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
        this.menuContainer.add(startText);

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
        this.menuContainer.add(leftArrow);

        const rightArrow = this.add.text(width / 2 + arrowOffset, startY, '<', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.menuContainer.add(rightArrow);

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

        // Track whether transition is already in progress
        this.isTransitioning = false;

        // Start Game Action — garage door slide-up transition
        const startGame = () => {
            if (this.isTransitioning) return;
            this.isTransitioning = true;

            // Stop arrow tweens so they don't fight the slide
            this.tweens.killAll();

            // Launch GameScene behind the menu so it's visible as menu slides up
            this.scene.launch('GameScene');
            this.scene.bringToTop('MenuScene');

            // Slide the entire menu container upward off-screen
            this.tweens.add({
                targets: this.menuContainer,
                y: -height,
                duration: 600,
                ease: 'Power2',
                onComplete: () => {
                    this.scene.stop('MenuScene');
                }
            });
        };

        startText.on('pointerdown', startGame);
        this.input.keyboard.once('keydown-ENTER', startGame);
        this.input.keyboard.once('keydown-SPACE', startGame);
    }
}
