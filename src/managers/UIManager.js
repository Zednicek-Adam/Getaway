import { DIRECTIONS } from '../constants';

export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.score = 0;
        this.fuel = 100;

        // UI Panel Background
        this.panel = this.scene.add.rectangle(10, 10, 280, 260, 0x1a1a1a, 0.85)
            .setOrigin(0)
            .setStrokeStyle(4, 0xB22222)
            .setDepth(99)
            .setScrollFactor(0);

        // Striped pattern for panel background (simulated using small lines)
        for (let i = 10; i < 260; i += 20) {
            this.scene.add.rectangle(10, i, 280, 5, 0x000000, 0.4)
                .setOrigin(0)
                .setDepth(99)
                .setScrollFactor(0);
        }

        // UI Text Objects
        this.scoreText = this.scene.add.text(25, 20, 'BANK: $0', {
            fontFamily: '"Press Start 2P"',
            fontSize: '11px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        }).setDepth(100).setScrollFactor(0);

        this.carriedText = this.scene.add.text(145, 20, 'CASH: $0', {
            fontFamily: '"Press Start 2P"',
            fontSize: '11px',
            fill: '#00FF88',
            stroke: '#000000',
            strokeThickness: 3
        }).setDepth(100).setScrollFactor(0);

        this.createHeatUI();

        this.fuelLabel = this.scene.add.text(25, 82, 'FUEL:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setDepth(100).setScrollFactor(0);

        // Fuel Gauge Settings
        this.gaugeX = 100;
        this.gaugeY = 82;
        this.gaugeWidth = 90;
        this.gaugeHeight = 14;

        // Fuel Gauge Background
        this.fuelGaugeBg = this.scene.add.rectangle(this.gaugeX, this.gaugeY, this.gaugeWidth, this.gaugeHeight, 0x333333)
            .setOrigin(0, 0)
            .setStrokeStyle(3, 0x888888)
            .setDepth(100)
            .setScrollFactor(0);

        // Fuel Gauge Fill
        this.fuelGaugeFill = this.scene.add.rectangle(this.gaugeX, this.gaugeY, this.gaugeWidth, this.gaugeHeight, 0x00FF00)
            .setOrigin(0, 0)
            .setDepth(101)
            .setScrollFactor(0);

        this.fuelPercentText = this.scene.add.text(this.gaugeX + this.gaugeWidth + 10, 84, '100%', {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 3
        }).setDepth(100).setScrollFactor(0);

        this.createQueueUI();
        this.createHealthUI();
        this.createInventoryUI();
        this.createChaseStatusUI();
    }

    createHeatUI() {
        this.heatLabel = this.scene.add.text(25, 52, 'HEAT:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setDepth(100).setScrollFactor(0);

        this.starTexts = [];
        for (let i = 0; i < 5; i++) {
            let star = this.scene.add.text(100 + i * 22, 50, '★', {
                fontFamily: 'Arial',
                fontSize: '18px',
                fill: '#FFD700',
                stroke: '#000000',
                strokeThickness: 2
            }).setDepth(100).setScrollFactor(0);
            this.starTexts.push(star);
        }
        this.updateHeat(1);
    }

    updateHeat(level) {
        for (let i = 0; i < 5; i++) {
            if (i < level) {
                this.starTexts[i].setFill(level >= 4 ? '#FF2222' : '#FFD700');
                this.starTexts[i].setAlpha(1);
            } else {
                this.starTexts[i].setFill('#444444');
                this.starTexts[i].setAlpha(0.5);
            }
        }
    }

    createQueueUI() {
        this.queueLabel = this.scene.add.text(25, 114, 'QUEUE:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setDepth(100).setScrollFactor(0);

        this.queueIcons = [];
        for(let i = 0; i < 3; i++) {
            let bg = this.scene.add.rectangle(100 + i * 30, 108, 24, 24, 0x333333)
                .setOrigin(0)
                .setStrokeStyle(2, 0x888888)
                .setDepth(100)
                .setScrollFactor(0);
            let text = this.scene.add.text(100 + i * 30 + 12, 108 + 12, '', {
                fontFamily: '"Press Start 2P"',
                fontSize: '14px',
                fill: '#FFFFFF',
            }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
            this.queueIcons.push({bg, text});
        }
    }

    updateQueue(queue) {
        for(let i = 0; i < 3; i++) {
            if (i < queue.length) {
                this.queueIcons[i].bg.setFillStyle(0x555555);
                let dir = queue[i];
                let symbol = '';
                if (dir === DIRECTIONS.UP) symbol = '^';
                if (dir === DIRECTIONS.DOWN) symbol = 'v';
                if (dir === DIRECTIONS.LEFT) symbol = '<';
                if (dir === DIRECTIONS.RIGHT) symbol = '>';
                this.queueIcons[i].text.setText(symbol);
            } else {
                this.queueIcons[i].bg.setFillStyle(0x333333);
                this.queueIcons[i].text.setText('');
            }
        }
    }

    createHealthUI() {
        this.healthLabel = this.scene.add.text(25, 150, 'LIVES:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setDepth(100).setScrollFactor(0);

        this.hearts = [];
        for(let i=0; i<5; i++) {
            let heart = this.scene.add.text(100 + i * 22, 146, '♥', {
                fontFamily: 'Arial',
                fontSize: '18px',
                fill: '#FF0000',
                stroke: '#000000',
                strokeThickness: 2
            }).setDepth(100).setScrollFactor(0);
            this.hearts.push(heart);
        }
        this.updateHealth(3);
    }

    updateHealth(health) {
        for(let i=0; i<5; i++) {
            if (i < health) {
                this.hearts[i].setAlpha(1);
            } else {
                this.hearts[i].setAlpha(0.2);
            }
        }
    }

    createInventoryUI() {
        this.itemLabel = this.scene.add.text(25, 184, 'ITEMS:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '11px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setDepth(100).setScrollFactor(0);

        this.hotbarSlots = [];
        const slotData = [
            { key: '1', label: 'NITRO', code: 'nitro', color: 0x00E5FF },
            { key: '2', label: 'BOMB', code: 'bomb', color: 0xFF0055 },
            { key: '3', label: 'RCKT', code: 'rocket', color: 0xFF6600 },
            { key: '4', label: 'GAS', code: 'jerry_can', color: 0xFF8800 }
        ];

        for (let i = 0; i < slotData.length; i++) {
            const data = slotData[i];
            const sx = 25 + (i % 2) * 125;
            const sy = 202 + Math.floor(i / 2) * 24;

            const bg = this.scene.add.rectangle(sx, sy, 118, 20, 0x222222)
                .setOrigin(0)
                .setStrokeStyle(1, 0x555555)
                .setDepth(100)
                .setScrollFactor(0);

            const txt = this.scene.add.text(sx + 4, sy + 10, `[${data.key}] ${data.label}:0`, {
                fontFamily: '"Press Start 2P"',
                fontSize: '8px',
                fill: '#888888'
            }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0);

            this.hotbarSlots.push({ data, bg, txt });
        }
    }

    updateMultiInventory(inventory) {
        if (!this.hotbarSlots) return;

        for (let slot of this.hotbarSlots) {
            const count = inventory[slot.data.code] || 0;
            slot.txt.setText(`[${slot.data.key}] ${slot.data.label}:${count}`);

            if (count > 0) {
                slot.bg.setStrokeStyle(2, slot.data.color);
                slot.bg.setFillStyle(0x333333);
                slot.txt.setFill('#FFFFFF');
            } else {
                slot.bg.setStrokeStyle(1, 0x555555);
                slot.bg.setFillStyle(0x1a1a1a);
                slot.txt.setFill('#777777');
            }
        }
    }

    updateInventory(inventory) {
        if (typeof inventory === 'object') {
            this.updateMultiInventory(inventory);
        }
    }

    updateScore(amount) {
        this.score += amount;
        this.scoreText.setText(`BANK: $${this.score}`);
    }

    updateCarriedCash(cash) {
        this.carriedText.setText(`CASH: $${cash}`);
        if (cash > 0) {
            this.carriedText.setFill('#FFD700');
        } else {
            this.carriedText.setFill('#00FF88');
        }
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

    createCompassUI() {
        this.baseCompass = this.scene.add.text(this.scene.scale.width - 130, 20, 'BASE: ⯅ 0m', {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            fill: '#00FF88',
            stroke: '#000000',
            strokeThickness: 3
        }).setDepth(100).setScrollFactor(0);

        this.moneyCompass = this.scene.add.text(this.scene.scale.width - 130, 40, 'CASH: ⯅ 0m', {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        }).setDepth(100).setScrollFactor(0);
    }

    updateCompass(playerX, playerY, baseX, baseY, nearestMoney) {
        if (!this.baseCompass) this.createCompassUI();

        // Base Distance & Direction
        const dxBase = baseX - playerX;
        const dyBase = baseY - playerY;
        const distBase = Math.floor(Math.sqrt(dxBase * dxBase + dyBase * dyBase));
        const angleBase = Math.atan2(dyBase, dxBase) * (180 / Math.PI);
        const arrowBase = this.getArrowSymbol(angleBase);

        this.baseCompass.setText(`BASE: ${arrowBase} ${distBase}m`);

        // Nearest Money Distance & Direction
        if (nearestMoney) {
            const dxM = nearestMoney.gridX - playerX;
            const dyM = nearestMoney.gridY - playerY;
            const distM = Math.floor(Math.sqrt(dxM * dxM + dyM * dyM));
            const angleM = Math.atan2(dyM, dxM) * (180 / Math.PI);
            const arrowM = this.getArrowSymbol(angleM);

            this.moneyCompass.setText(`CASH: ${arrowM} ${distM}m`);
            this.moneyCompass.setVisible(true);
        } else {
            this.moneyCompass.setVisible(false);
        }
    }

    getArrowSymbol(angle) {
        if (angle >= -22.5 && angle < 22.5) return '➔';
        if (angle >= 22.5 && angle < 67.5) return '➘';
        if (angle >= 67.5 && angle < 112.5) return '⬇';
        if (angle >= 112.5 && angle < 157.5) return '⤦';
        if (angle >= 157.5 || angle < -157.5) return '⬅';
        if (angle >= -157.5 && angle < -112.5) return '⯁';
        if (angle >= -112.5 && angle < -67.5) return '⬆';
        if (angle >= -67.5 && angle < -22.5) return '➚';
        return '•';
    }

    createChaseStatusUI() {
        const { width } = this.scene.scale;

        this.chaseBadge = this.scene.add.text(width / 2, 22, '🟢 SAFE', {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            fill: '#00FF88',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(105).setScrollFactor(0);

        // Flashing Siren Vignette for Active Chase
        this.sirenVignette = this.scene.add.rectangle(0, 0, width, 12, 0xFF0000, 0)
            .setOrigin(0).setDepth(98).setScrollFactor(0);
    }

    updateChaseStatus(state, searchSec = 0) {
        if (!this.chaseBadge) return;

        if (state === 'chase') {
            this.chaseBadge.setText('🔴 GETAWAY!');
            this.chaseBadge.setFill('#FF2222');

            // Flashing siren effect on top border
            const isRed = (Math.floor(Date.now() / 250) % 2 === 0);
            this.sirenVignette.setFillStyle(isRed ? 0xFF0000 : 0x0066FF, 0.4);
            this.sirenVignette.setVisible(true);
        } else if (state === 'searching') {
            this.chaseBadge.setText(`🟡 SEARCHING... ${searchSec}s`);
            this.chaseBadge.setFill('#FFFF00');
            this.sirenVignette.setVisible(false);
        } else {
            this.chaseBadge.setText('🟢 SAFE');
            this.chaseBadge.setFill('#00FF88');
            this.sirenVignette.setVisible(false);
        }
    }
}
