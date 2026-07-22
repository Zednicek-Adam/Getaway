import Phaser from 'phaser';
import { CONFIG } from '../config';
import { canPurchase, purchase } from '../garage';
import { writeSave } from '../storage';

// Overlay scene over the paused GameScene — mirrors PauseScene: owns its
// keyboard listeners, closes by resuming + stopping itself. Renders the
// persistent upgrade shop; purchases mutate this.save and re-derive gameState.
export class GarageScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GarageScene' });
    }

    init(data) {
        this.gameState = data.gameState;
        this.save = data.save;
        this.storage = data.storage;
    }

    create() {
        const { width, height } = this.scale;

        // Full-screen dim
        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0).setScrollFactor(0);

        // Centered panel
        const panelWidth = width * 0.85;
        const panelHeight = height * 0.8;
        const panelX = width / 2;
        const panelY = height / 2;
        const panelTop = panelY - panelHeight / 2;
        const panelLeft = panelX - panelWidth / 2;

        this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x1a1a1a)
            .setOrigin(0.5)
            .setStrokeStyle(6, 0xB22222)
            .setScrollFactor(0);

        // Subdued stripes
        for (let i = panelTop; i < panelY + panelHeight / 2; i += 40) {
            this.add.rectangle(panelLeft, i, panelWidth, 10, 0x000000, 0.3)
                .setOrigin(0)
                .setScrollFactor(0);
        }

        // Title
        this.add.text(panelX, panelTop + 34, 'GARAGE', {
            fontFamily: '"Press Start 2P"',
            fontSize: '28px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 6,
            shadow: { offsetX: 3, offsetY: 3, color: '#000000', fill: true }
        }).setOrigin(0.5).setScrollFactor(0);

        // Bank readout (refreshed after purchases)
        this.bankReadout = this.add.text(panelX, panelTop + 70, '', {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);

        // Column x positions inside the panel
        const labelX = panelLeft + 30;
        const pipsX = panelLeft + panelWidth * 0.40;
        const valueX = panelLeft + panelWidth * 0.60;
        const priceX = panelLeft + panelWidth - 30; // right-aligned

        // Rows
        const tracks = Object.entries(CONFIG.GARAGE.TRACKS);
        const rowsTop = panelTop + 108;
        const rowSpacing = (panelHeight - 108 - 40) / tracks.length;

        this.rows = tracks.map(([key, def], i) => {
            const y = rowsTop + rowSpacing * i + rowSpacing / 2;

            const label = this.add.text(labelX, y, def.label, {
                fontFamily: '"Press Start 2P"',
                fontSize: '14px',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0, 0.5).setScrollFactor(0);

            // Level pips — clone lifePips pattern; one per level (MAX_LEVEL)
            const pips = [];
            const pipSize = 14;
            const pipGap = 22;
            for (let p = 0; p < CONFIG.GARAGE.MAX_LEVEL; p++) {
                const pip = this.add.rectangle(pipsX + p * pipGap, y, pipSize, pipSize, 0xFFD700)
                    .setOrigin(0, 0.5)
                    .setStrokeStyle(2, 0x000000)
                    .setScrollFactor(0);
                pips.push(pip);
            }

            const value = this.add.text(valueX, y, '', {
                fontFamily: '"Press Start 2P"',
                fontSize: '11px',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0, 0.5).setScrollFactor(0);

            const price = this.add.text(priceX, y, '', {
                fontFamily: '"Press Start 2P"',
                fontSize: '14px',
                fill: '#FFD700',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(1, 0.5).setScrollFactor(0);

            // Interactive hit-area spanning the row for hover-select + click-buy
            const hit = this.add.rectangle(panelX, y, panelWidth - 20, rowSpacing * 0.9, 0xffffff, 0.001)
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setInteractive({ useHandCursor: true });
            hit.on('pointerover', () => this.select(i));
            hit.on('pointerdown', () => { this.select(i); this.attemptPurchase(); });

            return { key, def, y, label, pips, value, price };
        });

        // Selection arrows (pulsing), flanking the selected row
        this.selectedIndex = 0;
        this.arrowLeftBaseX = labelX - 22;
        this.arrowRightBaseX = priceX + 22;

        this.leftArrow = this.add.text(this.arrowLeftBaseX, this.rows[0].y, '>', {
            fontFamily: '"Press Start 2P"',
            fontSize: '18px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);

        this.rightArrow = this.add.text(this.arrowRightBaseX, this.rows[0].y, '<', {
            fontFamily: '"Press Start 2P"',
            fontSize: '18px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);

        this.tweens.add({
            targets: [this.leftArrow],
            x: this.arrowLeftBaseX + 12,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.tweens.add({
            targets: [this.rightArrow],
            x: this.arrowRightBaseX - 12,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.select(0);
        this.refreshRows();

        // Keyboard
        this.input.keyboard.on('keydown-UP', () => {
            this.select((this.selectedIndex - 1 + this.rows.length) % this.rows.length);
        });
        this.input.keyboard.on('keydown-DOWN', () => {
            this.select((this.selectedIndex + 1) % this.rows.length);
        });
        this.input.keyboard.on('keydown-ENTER', () => this.attemptPurchase());
        this.input.keyboard.on('keydown-SPACE', () => this.attemptPurchase());

        const close = () => {
            this.scene.resume('GameScene');
            this.scene.stop();
        };
        this.input.keyboard.on('keydown-ESC', close);
        this.input.keyboard.on('keydown-G', close);
    }

    select(index) {
        this.selectedIndex = index;
        const y = this.rows[index].y;
        this.leftArrow.y = y;
        this.rightArrow.y = y;
    }

    attemptPurchase() {
        const track = this.rows[this.selectedIndex].key;
        if (!purchase(this.save, track)) {
            this.flashPriceDenied(this.selectedIndex);
            return;
        }
        this.gameState.banked = this.save.banked;
        this.gameState.applyUpgrades(this.save.upgrades);
        writeSave(this.storage, this.save);
        this.refreshRows();
    }

    // Brief red flash on a denied purchase, then restore the correct color.
    flashPriceDenied(index) {
        const price = this.rows[index].price;
        price.setColor('#FF2222');
        this.time.delayedCall(180, () => this.refreshRows());
    }

    // Fully re-derive every row's texts/pips/colors + the bank readout.
    refreshRows() {
        this.bankReadout.setText(`BANK: $${this.save.banked}`);

        this.rows.forEach((row) => {
            const level = this.save.upgrades[row.key] || 0;
            const values = row.def.values;

            // Pips — gold for owned levels, dim gray otherwise
            row.pips.forEach((pip, p) => {
                if (p < level) {
                    pip.setFillStyle(0xFFD700).setAlpha(1);
                } else {
                    pip.setFillStyle(0x888888).setAlpha(0.35);
                }
            });

            // Value text: `current > next`, or just current at max
            const current = values[level];
            const maxed = level >= CONFIG.GARAGE.MAX_LEVEL;
            if (maxed) {
                row.value.setText(`${current}`).setColor('#888888');
            } else {
                row.value.setText(`${current} > ${values[level + 1]}`).setColor('#FFFFFF');
            }

            // Price text + color
            const check = canPurchase(this.save, row.key);
            if (check.reason === 'maxed') {
                row.price.setText('MAX').setColor('#888888');
            } else if (check.ok) {
                row.price.setText(`$${check.price}`).setColor('#FFD700');
            } else {
                row.price.setText(`$${check.price}`).setColor('#888888');
            }
        });
    }
}
