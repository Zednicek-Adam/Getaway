import Phaser from 'phaser';
import { label, panel, dim, UI_COLORS, createMenu } from '../ui/ui';

export class PauseScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PauseScene' });
    }

    create() {
        const { width, height } = this.scale;

        // Dim the frozen run underneath, then a centred panel
        dim(this, 0.7);
        const pw = 560;
        const ph = 520;
        const top = (height - ph) / 2;
        panel(this, (width - pw) / 2, top, pw, ph);
        label(this, width / 2, top + 64, 'PAUSED', { size: 48 }).setOrigin(0.5);

        const resumeAction = () => {
            this.scene.resume('GameScene');
            this.scene.stop();
        };

        const restartAction = () => {
            this.scene.stop('GameScene');
            this.scene.start('GameScene');
            this.scene.stop();
        };

        // Swaps this overlay for the instructions page and comes back here.
        // GameScene stays paused underneath the whole time, so the run is
        // exactly where it was left.
        const instructionsAction = () => {
            this.scene.start('InstructionsScene', { returnTo: 'PauseScene' });
        };

        // Abandons the run: carried cash is lost, exactly as it would be on a
        // bust. Banked cash and upgrades were already written to storage when
        // they were earned, so quitting here costs nothing that was safe.
        const mainMenuAction = () => {
            this.scene.stop('GameScene');
            this.scene.start('MenuScene');
            this.scene.stop();
        };

        // Run-ending choices light up red instead of gold
        const menu = createMenu(this, {
            x: width / 2,
            y: top + 170,
            width: 420,
            spacing: 76,
            items: [
                { label: 'RESUME', action: resumeAction },
                { label: 'RESTART', action: restartAction, tone: 'danger' },
                { label: 'INSTRUCTIONS', action: instructionsAction },
                { label: 'MAIN MENU', action: mainMenuAction, tone: 'danger' },
            ],
        });

        label(this, width / 2, top + ph - 36, 'ESC TO RESUME', { color: UI_COLORS.dim }).setOrigin(0.5);

        // A held key repeats, and the repeat lands on whichever scene was just
        // switched to — without this, holding ENTER on INSTRUCTIONS would
        // bounce between this menu and the instructions page. Date.now()
        // rather than this.time.now; see the note in MenuScene.
        const armedAt = Date.now();
        const guard = (fn) => () => {
            if (Date.now() - armedAt < 250) return;
            fn();
        };

        this.input.keyboard.on('keydown-ENTER', guard(() => menu.activate()));
        this.input.keyboard.on('keydown-SPACE', guard(() => menu.activate()));

        // Escape to resume
        this.input.keyboard.on('keydown-ESC', guard(resumeAction));
    }
}
