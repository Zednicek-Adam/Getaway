import Phaser from 'phaser';
import { CONFIG } from '../config';
import { canPurchase, purchase } from '../garage';
import { writeSave } from '../storage';
import { label, panel, icon, dim, money, UI_COLORS } from '../ui/ui';
import { sparkBurst } from '../fx';

// Icon per upgrade track (icons.png)
const TRACK_ICONS = {
    engine: 'gauge',
    fuelTank: 'fuel',
    armor: 'shield',
    bombBay: 'bomb',
    rocketRack: 'rocket',
};

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

        dim(this, 0.72);

        const pw = 1040;
        const ph = 800;
        const left = (width - pw) / 2;
        const top = (height - ph) / 2;
        panel(this, left, top, pw, ph);

        // Title flanked by wrenches
        label(this, width / 2, top + 58, 'GARAGE', { size: 48, color: UI_COLORS.gold }).setOrigin(0.5);
        icon(this, width / 2 - 200, top + 58, 'wrench').setScale(2);
        icon(this, width / 2 + 200, top + 58, 'wrench').setScale(2).setFlipX(true);

        // Bank readout (refreshed after purchases)
        icon(this, width / 2 - 110, top + 118, 'coin');
        this.bankReadout = label(this, width / 2 - 86, top + 118, '', { color: UI_COLORS.gold }).setOrigin(0, 0.5);

        const tracks = Object.entries(CONFIG.GARAGE.TRACKS);
        const rowW = pw - 80;
        const rowH = 92;
        const rowsTop = top + 160;
        const spacing = 106;
        const rowLeft = left + 40;

        this.rows = tracks.map(([key, def], i) => {
            const y = rowsTop + spacing * i + rowH / 2;
            const idle = panel(this, rowLeft, y - rowH / 2, rowW, rowH);
            const lit = panel(this, rowLeft, y - rowH / 2, rowW, rowH, 'gold').setVisible(false);
            icon(this, rowLeft + 52, y, TRACK_ICONS[key]).setScale(2);
            const name = label(this, rowLeft + 100, y, def.label, { size: 24 }).setOrigin(0, 0.5);

            // Level pips — one per purchasable level
            const pips = [];
            const pipsX = rowLeft + 430;
            for (let p = 0; p < CONFIG.GARAGE.MAX_LEVEL; p++) {
                const px = pipsX + p * 40;
                this.add.rectangle(px, y - 16, 32, 32, 0x0a0b11).setOrigin(0);
                const fill = this.add.rectangle(px + 4, y - 12, 24, 24, 0xffc933).setOrigin(0);
                const shine = this.add.rectangle(px + 4, y - 12, 24, 6, 0xfff09a).setOrigin(0);
                pips.push({ fill, shine });
            }

            const value = label(this, rowLeft + 580, y, '', { size: 16 }).setOrigin(0, 0.5);
            const price = label(this, rowLeft + rowW - 32, y, '', { size: 24, color: UI_COLORS.gold }).setOrigin(1, 0.5);

            // Interactive hit-area spanning the row for hover-select + click-buy
            const hit = this.add.zone(rowLeft + rowW / 2, y, rowW, rowH).setInteractive({ useHandCursor: true });
            hit.on('pointerover', () => this.select(i));
            hit.on('pointerdown', () => { this.select(i); this.attemptPurchase(); });

            return { key, def, y, idle, lit, name, pips, value, price, priceX: price.x };
        });

        label(this, width / 2, top + ph - 40, 'ENTER BUY    ESC CLOSE', { color: UI_COLORS.dim }).setOrigin(0.5);

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
        this.rows.forEach((row, i) => {
            const on = i === index;
            row.idle.setVisible(!on);
            row.lit.setVisible(on);
            row.name.setColor(on ? UI_COLORS.gold : UI_COLORS.white);
        });
    }

    attemptPurchase() {
        const row = this.rows[this.selectedIndex];
        if (!purchase(this.save, row.key)) {
            this.flashPriceDenied(this.selectedIndex);
            return;
        }
        this.gameState.banked = this.save.banked;
        this.gameState.applyUpgrades(this.save.upgrades);
        writeSave(this.storage, this.save);
        this.refreshRows();

        // Celebrate the newly lit pip
        const level = this.save.upgrades[row.key] || 0;
        const pip = row.pips[level - 1];
        if (pip) {
            sparkBurst(this, pip.fill.x + 12, pip.fill.y + 12, { count: 8, radius: 48, tint: 0xffd040 });
        }
    }

    // Brief red flash + a shake on a denied purchase, then restore the correct color.
    flashPriceDenied(index) {
        const row = this.rows[index];
        row.price.setColor('#FF2222');
        this.tweens.killTweensOf(row.price);
        row.price.x = row.priceX;
        this.tweens.add({ targets: row.price, x: row.priceX + 6, duration: 40, yoyo: true, repeat: 2 });
        this.time.delayedCall(180, () => this.refreshRows());
    }

    // Fully re-derive every row's texts/pips/colors + the bank readout.
    refreshRows() {
        this.bankReadout.setText(`BANK ${money(this.save.banked)}`);

        this.rows.forEach((row) => {
            const level = this.save.upgrades[row.key] || 0;
            const values = row.def.values;

            // Pips — gold for owned levels, dark otherwise
            row.pips.forEach((pip, p) => {
                const owned = p < level;
                pip.fill.setFillStyle(owned ? 0xffc933 : 0x2a2e3f);
                pip.shine.setFillStyle(owned ? 0xfff09a : 0x353a4e);
            });

            // Value text: `current > next`, or just current at max
            const current = values[level];
            const maxed = level >= CONFIG.GARAGE.MAX_LEVEL;
            if (maxed) {
                row.value.setText(`${current}`).setColor(UI_COLORS.dim);
            } else {
                row.value.setText(`${current} > ${values[level + 1]}`).setColor(UI_COLORS.white);
            }

            // Price text + color
            const check = canPurchase(this.save, row.key);
            if (check.reason === 'maxed') {
                row.price.setText('MAX').setColor(UI_COLORS.green);
            } else if (check.ok) {
                row.price.setText(money(check.price)).setColor(UI_COLORS.gold);
            } else {
                row.price.setText(money(check.price)).setColor(UI_COLORS.faint);
            }
        });
    }
}
