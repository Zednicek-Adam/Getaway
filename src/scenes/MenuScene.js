import Phaser from 'phaser';
import { TILE_SIZE, VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from '../constants';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const width = VIEWPORT_WIDTH * TILE_SIZE;
        const height = VIEWPORT_HEIGHT * TILE_SIZE;

        this.cameras.main.setBackgroundColor('#1a1f2b');

        const panel = this.add.rectangle(width / 2, height / 2, 640, 420, 0x22283a, 0.96);
        panel.setStrokeStyle(6, 0x7fd6ff);

        this.add.text(width / 2, height / 2 - 120, 'GETAWAY', {
            fontFamily: 'monospace',
            fontSize: '84px',
            color: '#ffe066',
            stroke: '#000000',
            strokeThickness: 12
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 - 24, 'Pixel Night Chase', {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#b6c2ff'
        }).setOrigin(0.5);

        const startButton = this.add.rectangle(width / 2, height / 2 + 96, 320, 96, 0x3f5eff);
        startButton.setStrokeStyle(6, 0xffffff);
        startButton.setInteractive({ useHandCursor: true });

        const startLabel = this.add.text(width / 2, height / 2 + 96, 'START', {
            fontFamily: 'monospace',
            fontSize: '44px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const startGame = () => this.scene.start('GameScene');

        startButton.on('pointerdown', startGame);
        this.input.keyboard.once('keydown-ENTER', startGame);

        startButton.on('pointerover', () => {
            startButton.setFillStyle(0x5f7aff);
            startLabel.setScale(1.05);
        });

        startButton.on('pointerout', () => {
            startButton.setFillStyle(0x3f5eff);
            startLabel.setScale(1);
        });
    }
}
