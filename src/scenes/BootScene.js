import Phaser from 'phaser';
import { loadArt, createAnims } from '../art';
import { FONT } from '../ui/ui';

// Loads every texture once (with a pixel progress bar), registers the shared
// animations, then hands over to the title screen.
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        const { width, height } = this.scale;
        const barW = 480;
        const barH = 24;
        const x = (width - barW) / 2;
        const y = height / 2;

        this.add.text(width / 2, y - 48, 'LOADING', {
            fontFamily: FONT, fontSize: '16px', color: '#ffc933',
        }).setOrigin(0.5);
        this.add.rectangle(x - 6, y - 6, barW + 12, barH + 12, 0x0a0b11).setOrigin(0);
        this.add.rectangle(x - 4, y - 4, barW + 8, barH + 8, 0x454b63).setOrigin(0);
        this.add.rectangle(x - 2, y - 2, barW + 4, barH + 4, 0x0a0b11).setOrigin(0);
        const fill = this.add.rectangle(x, y, 0, barH, 0xffc933).setOrigin(0);
        const shine = this.add.rectangle(x, y, 0, 4, 0xfff09a).setOrigin(0);

        this.load.on('progress', (v) => {
            // Snap to 8px steps so the bar fills in chunky pixel blocks
            const w = Math.floor((barW * v) / 8) * 8;
            fill.width = w;
            shine.width = w;
        });

        loadArt(this);
    }

    create() {
        createAnims(this);
        this.scene.start('MenuScene');
    }
}
