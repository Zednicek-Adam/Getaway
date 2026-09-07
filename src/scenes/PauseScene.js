import Phaser from 'phaser';

export class PauseScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PauseScene' });
    }

    create() {
        const { width, height } = this.scale;

        // Semi-transparent background
        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);

        // Pause Title
        this.add.text(width / 2, height / 3, 'PAUSED', {
            fontFamily: '"Press Start 2P"',
            fontSize: '48px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 6,
            shadow: { offsetX: 3, offsetY: 3, color: '#000000', fill: true }
        }).setOrigin(0.5);

        const startY = height * 2 / 3;
        const spacing = 60;

        // Resume Button
        const resumeText = this.add.text(width / 2, startY, 'RESUME', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const resumeAction = () => {
            this.scene.resume('GameScene');
            this.scene.stop();
        };
        resumeText.on('pointerdown', resumeAction);

        // Restart Button
        const restartText = this.add.text(width / 2, startY + spacing, 'RESTART', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const restartAction = () => {
            this.scene.stop('GameScene');
            this.scene.start('GameScene');
            this.scene.stop();
        };
        restartText.on('pointerdown', restartAction);

        // Instructions Button
        const instructionsText = this.add.text(width / 2, startY + spacing * 2, 'INSTRUCTIONS', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // Swaps this overlay for the instructions page and comes back here.
        // GameScene stays paused underneath the whole time, so the run is
        // exactly where it was left.
        const instructionsAction = () => {
            this.scene.start('InstructionsScene', { returnTo: 'PauseScene' });
        };
        instructionsText.on('pointerdown', instructionsAction);

        // Main Menu Button
        const mainMenuText = this.add.text(width / 2, startY + spacing * 3, 'MAIN MENU', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // Abandons the run: carried cash is lost, exactly as it would be on a
        // bust. Banked cash and upgrades were already written to storage when
        // they were earned, so quitting here costs nothing that was safe.
        const mainMenuAction = () => {
            this.scene.stop('GameScene');
            this.scene.start('MenuScene');
            this.scene.stop();
        };
        mainMenuText.on('pointerdown', mainMenuAction);

        const options = [
            { text: resumeText, action: resumeAction },
            { text: restartText, action: restartAction },
            { text: instructionsText, action: instructionsAction },
            { text: mainMenuText, action: mainMenuAction }
        ];

        let selectedIndex = 0;

        // Arrows setup
        const arrowOffset = 190; // clears INSTRUCTIONS, the widest label

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

        const updateSelection = () => {
            options.forEach((opt, index) => {
                if (index === selectedIndex) {
                    opt.text.setFill(index === 0 ? '#FFD700' : '#B22222');
                } else {
                    opt.text.setFill('#FFFFFF');
                }
            });

            const selectedY = options[selectedIndex].text.y;
            leftArrow.y = selectedY;
            rightArrow.y = selectedY;
        };

        // Initialize selection
        updateSelection();

        // Mouse hover interactions
        options.forEach((opt, index) => {
            opt.text.on('pointerover', () => {
                selectedIndex = index;
                updateSelection();
            });
        });

        // Keyboard interactions
        this.input.keyboard.on('keydown-UP', () => {
            selectedIndex = (selectedIndex - 1 + options.length) % options.length;
            updateSelection();
        });

        this.input.keyboard.on('keydown-DOWN', () => {
            selectedIndex = (selectedIndex + 1) % options.length;
            updateSelection();
        });

        // A held key repeats, and the repeat lands on whichever scene was just
        // switched to — without this, holding ENTER on INSTRUCTIONS would
        // bounce between this menu and the instructions page. Date.now()
        // rather than this.time.now; see the note in MenuScene.
        const armedAt = Date.now();
        const guard = (fn) => () => {
            if (Date.now() - armedAt < 250) return;
            fn();
        };

        this.input.keyboard.on('keydown-ENTER', guard(() => options[selectedIndex].action()));
        this.input.keyboard.on('keydown-SPACE', guard(() => options[selectedIndex].action()));

        // Escape to resume
        this.input.keyboard.on('keydown-ESC', guard(resumeAction));
    }
}
