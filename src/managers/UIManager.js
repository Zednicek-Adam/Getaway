import { CONFIG } from '../config';
import { DIRECTIONS } from '../constants';

export class UIManager {
    constructor(scene) {
        this.scene = scene;

        // Dirty-check cache of last rendered HUD values
        this.lastBanked = null;
        this.lastCarried = null;
        this.lastLives = null;
        this.lastFuel = null;
        this.lastBombs = null;
        this.lastQueueKey = null;
        this.lastStars = null;
        this.lastChaseActive = null;
        this.lastChaseWidth = null;

        // UI Panel Background
        this.panel = this.scene.add.rectangle(10, 10, 260, 230, 0x1a1a1a, 0.8)
            .setOrigin(0)
            .setStrokeStyle(4, 0xB22222)
            .setDepth(99)
            .setScrollFactor(0);

        // Striped pattern for panel background (simulated using small lines)
        for (let i = 10; i < 240; i += 20) {
            this.scene.add.rectangle(10, i, 260, 5, 0x000000, 0.4)
                .setOrigin(0)
                .setDepth(99)
                .setScrollFactor(0);
        }

        // UI Text Objects
        this.bankText = this.scene.add.text(25, 25, 'BANK: $0', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);

        this.carryText = this.scene.add.text(25, 50, 'CARRY: $0', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            fill: '#888888',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);

        this.livesLabel = this.scene.add.text(25, 75, 'LIVES:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);

        // Life pips — small red squares (the pixel font has no heart glyph)
        this.lifePips = [];
        for (let i = 0; i < CONFIG.PLAYER.LIVES; i++) {
            const pip = this.scene.add.rectangle(125 + i * 24, 75, 16, 16, 0xFF3344)
                .setOrigin(0)
                .setStrokeStyle(2, 0x000000)
                .setDepth(100)
                .setScrollFactor(0);
            this.lifePips.push(pip);
        }

        this.fuelLabel = this.scene.add.text(25, 100, 'FUEL:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);

        // Fuel Gauge Settings
        this.gaugeX = 100;
        this.gaugeY = 100;
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

        this.fuelPercentText = this.scene.add.text(this.gaugeX + this.gaugeWidth + 10, 102, '100%', {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);

        this.bombText = this.scene.add.text(25, 128, 'BOMBS: 0', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);

        this.queueLabel = this.scene.add.text(25, 153, 'NEXT:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(100).setScrollFactor(0);

        // Queued-turn arrows — white triangles rotated per direction
        // (shapes, not text: the pixel font lacks arrow glyphs)
        this.queueArrows = [];
        for (let i = 0; i < CONFIG.PLAYER.QUEUE_MAX; i++) {
            const arrow = this.scene.add.triangle(
                133 + i * 26, 161,   // center position
                8, 0, 0, 16, 16, 16, // points up by default
                0xFFFFFF
            )
                .setStrokeStyle(2, 0x000000)
                .setDepth(100)
                .setScrollFactor(0)
                .setAlpha(0.12);
            this.queueArrows.push(arrow);
        }

        // Wanted stars — filled gold while active, dark gray otherwise
        this.starShapes = [];
        for (let i = 0; i < 5; i++) {
            const star = this.scene.add.star(40 + i * 28, 192, 5, 5, 11, 0x555555)
                .setStrokeStyle(2, 0x000000)
                .setDepth(100)
                .setScrollFactor(0)
                .setAlpha(0.35);
            this.starShapes.push(star);
        }

        // Chase countdown bar (hidden while no chase is running)
        this.chaseBarX = 25;
        this.chaseBarY = 210;
        this.chaseBarWidth = 230;
        this.chaseBarHeight = 10;

        this.chaseBarBg = this.scene.add.rectangle(this.chaseBarX, this.chaseBarY, this.chaseBarWidth, this.chaseBarHeight, 0x333333)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x000000)
            .setDepth(100)
            .setScrollFactor(0)
            .setVisible(false);

        this.chaseBarFill = this.scene.add.rectangle(this.chaseBarX, this.chaseBarY, this.chaseBarWidth, this.chaseBarHeight, 0xFF2222)
            .setOrigin(0, 0)
            .setDepth(101)
            .setScrollFactor(0)
            .setVisible(false);
    }

    // Pure renderer: called every frame with a HUD snapshot
    // { banked, carried, lives, fuel, fuelMax, bombs, queue,
    //   stars, chaseCountdown, chaseCountdownMax }
    update(hud) {
        if (hud.banked !== this.lastBanked) {
            this.lastBanked = hud.banked;
            this.bankText.setText(`BANK: $${hud.banked}`);
        }

        if (hud.carried !== this.lastCarried) {
            this.lastCarried = hud.carried;
            this.carryText.setText(`CARRY: $${hud.carried}`);
            // Brighter while money is at risk
            this.carryText.setColor(hud.carried > 0 ? '#FFFFFF' : '#888888');
        }

        if (hud.lives !== this.lastLives) {
            this.lastLives = hud.lives;
            this.lifePips.forEach((pip, i) => pip.setAlpha(i < hud.lives ? 1 : 0.15));
        }

        if (hud.fuel !== this.lastFuel) {
            this.lastFuel = hud.fuel;
            this.renderFuel(hud.fuel, hud.fuelMax);
        }

        if (hud.bombs !== this.lastBombs) {
            this.lastBombs = hud.bombs;
            this.bombText.setText(`BOMBS: ${hud.bombs}`);
        }

        const queue = hud.queue || [];
        const queueKey = queue.join(',');
        if (queueKey !== this.lastQueueKey) {
            this.lastQueueKey = queueKey;
            this.renderQueue(queue);
        }

        if (hud.stars !== this.lastStars) {
            this.lastStars = hud.stars;
            this.renderStars(hud.stars);
        }

        this.renderChaseBar(hud.chaseCountdown, hud.chaseCountdownMax);
    }

    renderStars(stars) {
        this.starShapes.forEach((shape, i) => {
            if (i < stars) {
                shape.setFillStyle(0xFFD700).setAlpha(1);
            } else {
                shape.setFillStyle(0x555555).setAlpha(0.35);
            }
        });
    }

    renderChaseBar(countdown, countdownMax) {
        const active = countdown > 0;
        if (active !== this.lastChaseActive) {
            this.lastChaseActive = active;
            this.chaseBarBg.setVisible(active);
            this.chaseBarFill.setVisible(active);
        }
        if (!active) return;

        const fraction = Math.max(0, Math.min(1, countdown / countdownMax));
        const width = fraction * this.chaseBarWidth;
        if (width !== this.lastChaseWidth) {
            this.lastChaseWidth = width;
            this.chaseBarFill.setSize(width, this.chaseBarHeight);
        }
    }

    renderQueue(queue) {
        const angleByDirection = {
            [DIRECTIONS.UP]: 0,
            [DIRECTIONS.RIGHT]: 90,
            [DIRECTIONS.DOWN]: 180,
            [DIRECTIONS.LEFT]: 270,
        };

        this.queueArrows.forEach((arrow, i) => {
            if (i < queue.length) {
                arrow.setAngle(angleByDirection[queue[i]]);
                arrow.setAlpha(1);
            } else {
                arrow.setAlpha(0.12); // Dim unused slot
            }
        });
    }

    renderFuel(fuel, fuelMax) {
        const percent = (fuel / fuelMax) * 100;

        // Update Gauge Fill Width
        const fillWidth = (fuel / fuelMax) * this.gaugeWidth;
        this.fuelGaugeFill.setSize(fillWidth, this.gaugeHeight);

        // Update Percentage Text
        this.fuelPercentText.setText(`${Math.floor(percent)}%`);

        // Color change based on fuel level
        let colorHex = 0x00FF00;
        let colorStr = '#00FF00';

        if (percent < 20) {
            colorHex = 0xFF0000;
            colorStr = '#FF0000';
        } else if (percent < 50) {
            colorHex = 0xFFFF00;
            colorStr = '#FFFF00';
        }

        this.fuelGaugeFill.setFillStyle(colorHex);
        this.fuelPercentText.setColor(colorStr);
    }

    showToast(text) {
        const { width } = this.scene.scale;

        const toast = this.scene.add.text(width / 2, 120, text, {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(150).setScrollFactor(0);

        this.scene.tweens.add({
            targets: toast,
            y: 90,
            alpha: 0,
            duration: 1500,
            ease: 'Sine.easeIn',
            onComplete: () => toast.destroy()
        });
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
