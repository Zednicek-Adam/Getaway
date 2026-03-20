import Phaser from 'phaser';
import { TILE_SIZE, VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from '../constants';
import { GAME_SCENE_KEY } from './GameScene';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const width = VIEWPORT_WIDTH * TILE_SIZE;
        const height = VIEWPORT_HEIGHT * TILE_SIZE;
        const menuY = height / 2 + 96;

        this.cameras.main.setBackgroundColor('#0f1310');

        const panel = this.add.rectangle(width / 2, height / 2, 640, 420, 0x1b231d, 0.96);
        panel.setStrokeStyle(6, 0x4a5e44);

        this.add.text(width / 2, height / 2 - 120, 'GETAWAY', {
            fontFamily: 'monospace',
            fontSize: '84px',
            color: '#7bf17b',
            stroke: '#000000',
            strokeThickness: 12
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 - 24, 'Bank Robber Escape', {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#ffd166'
        }).setOrigin(0.5);

        const startButton = this.add.rectangle(width / 2, menuY, 320, 96, 0x2f3c2d);
        startButton.setStrokeStyle(6, 0xb7ff6a);
        startButton.setInteractive({ useHandCursor: true });

        const startLabel = this.add.text(width / 2, menuY, 'START', {
            fontFamily: 'monospace',
            fontSize: '44px',
            color: '#f9ffef'
        }).setOrigin(0.5);

        const leftArrow = this.add.text(width / 2 - 126, menuY, '>', {
            fontFamily: 'monospace',
            fontSize: '44px',
            color: '#b7ff6a'
        }).setOrigin(0.5);

        const rightArrow = this.add.text(width / 2 + 126, menuY, '<', {
            fontFamily: 'monospace',
            fontSize: '44px',
            color: '#b7ff6a'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: leftArrow,
            x: leftArrow.x + 12,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.tweens.add({
            targets: rightArrow,
            x: rightArrow.x - 12,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const startGame = () => this.scene.start(GAME_SCENE_KEY);

        startButton.on('pointerdown', startGame);
        this.input.keyboard.once('keydown-ENTER', startGame);

        startButton.on('pointerover', () => {
            startButton.setFillStyle(0x40503d);
        });

        startButton.on('pointerout', () => {
            startButton.setFillStyle(0x2f3c2d);
        });
    }
}
