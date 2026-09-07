import Phaser from 'phaser';
import { loadSave, getBrowserStorage } from '../storage';

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

        // Persistent bank readout (gold, small) — shows $0 fine when empty
        const banked = loadSave(getBrowserStorage()).banked;
        const bankText = this.add.text(width / 2, height / 3 + 92, `BANK: $${banked}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.menuContainer.add(bankText);


        // --- Menu options ---
        const startY = height * 2 / 3;
        const optionSpacing = 60;

        const makeOption = (label, y) => {
            const text = this.add.text(width / 2, y, label, {
                fontFamily: '"Press Start 2P"',
                fontSize: '24px',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            this.menuContainer.add(text);
            return text;
        };

        const startText = makeOption('START', startY);
        const instructionsText = makeOption('INSTRUCTIONS', startY + optionSpacing);

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

        const showInstructions = () => {
            if (this.isTransitioning) return;
            this.scene.start('InstructionsScene', { returnTo: 'MenuScene' });
        };

        const options = [
            { text: startText, action: startGame },
            { text: instructionsText, action: showInstructions },
        ];

        let selectedIndex = 0;

        // Wide enough to clear INSTRUCTIONS, the longest label
        const arrowOffset = 190;

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

        const updateSelection = () => {
            options.forEach((opt, index) => {
                opt.text.setFill(index === selectedIndex ? '#FFD700' : '#FFFFFF');
            });
            const selectedY = options[selectedIndex].text.y;
            leftArrow.y = selectedY;
            rightArrow.y = selectedY;
        };

        updateSelection();

        options.forEach((opt, index) => {
            opt.text.on('pointerover', () => {
                selectedIndex = index;
                updateSelection();
            });
            opt.text.on('pointerdown', opt.action);
        });

        this.input.keyboard.on('keydown-UP', () => {
            selectedIndex = (selectedIndex - 1 + options.length) % options.length;
            updateSelection();
        });

        this.input.keyboard.on('keydown-DOWN', () => {
            selectedIndex = (selectedIndex + 1) % options.length;
            updateSelection();
        });

        // Held keys repeat, and the repeat can land on the scene we just
        // switched to — holding ENTER on the instructions page would otherwise
        // bounce straight back here and start a run. Ignore the first moment.
        // Date.now() rather than this.time.now: the Scene Clock is seeded from
        // wall-clock at construction but then reassigned to the game loop's
        // performance.now() timebase, so a value read in create() is not
        // comparable to one read in a later callback.
        const armedAt = Date.now();
        const activate = () => {
            if (Date.now() - armedAt < 250) return;
            options[selectedIndex].action();
        };

        this.input.keyboard.on('keydown-ENTER', activate);
        this.input.keyboard.on('keydown-SPACE', activate);
    }
}
