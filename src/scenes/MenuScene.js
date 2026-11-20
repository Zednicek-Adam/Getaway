import Phaser from 'phaser';
import { loadSave, getBrowserStorage } from '../storage';
import { label, panel, icon, money, UI_COLORS, createMenu, cityBackdrop } from '../ui/ui';
import { bindPad } from '../gamepad';
import { t, setLanguage, nextLanguage } from '../i18n';
import { useStage } from '../screen';

// Parallax speeds in texture pixels per millisecond
const SCROLL = { far: 0.012, near: 0.035, street: 0.3 };

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    // Switching language restarts this scene so every label is rebuilt; the
    // restart carries the menu selection over so the cursor stays on the
    // language button.
    init(data) {
        this.initialSelection = (data && data.selected) || 0;
    }

    create() {
        // A size change mid-slide is left alone: the scene is on its way out
        const { width } = useStage(this, () => (this.isTransitioning ? null : { selected: this.menu.selected }),
            { anchor: 'bottom' });

        // Container for all menu elements (so we can slide them as one unit)
        this.menuContainer = this.add.container(0, 0);

        // Night-city backdrop with a chase playing out on the street
        this.layers = cityBackdrop(this, this.menuContainer);
        this.createChase();

        // Title
        const logo = this.add.image(width / 2, 160, 'logo');
        this.menuContainer.add(logo);
        this.tweens.add({ targets: logo, y: 168, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const subtitle = label(this, width / 2, 290, t('menu.subtitle'), { color: UI_COLORS.white }).setOrigin(0.5);
        this.menuContainer.add(subtitle);

        // The score to beat: the best run's takings. Every run starts at $0,
        // so there's no bank to show here. Hidden until a run makes the list.
        const best = loadSave(getBrowserStorage()).topRuns[0];
        if (best) {
            const bestLabel = label(this, 0, 0, t('menu.bestRun', { amount: money(best.banked) }), { color: UI_COLORS.gold }).setOrigin(0, 0.5);
            const bestW = Math.ceil((bestLabel.width + 72) / 2) * 2;
            const bestX = width / 2 - bestW / 2;
            const bestPanel = panel(this, bestX, 700, bestW, 52);
            const coin = icon(this, bestX + 28, 726, 'coin');
            bestLabel.setPosition(bestX + 50, 726);
            this.menuContainer.add([bestPanel, coin, bestLabel]);
        }

        // Track whether transition is already in progress
        this.isTransitioning = false;

        // Start Game Action — garage door slide-up transition
        const startGame = () => {
            if (this.isTransitioning) return;
            this.isTransitioning = true;

            // Stop the idle tweens so they don't fight the slide
            this.tweens.killAll();

            // Launch GameScene behind the menu so it's visible as menu slides up
            this.scene.launch('GameScene');
            this.scene.bringToTop('MenuScene');

            // Slide the entire menu container upward off-screen (the whole
            // canvas, which can be taller than the stage)
            this.tweens.add({
                targets: this.menuContainer,
                y: -this.scale.height,
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

        const showBestRuns = () => {
            if (this.isTransitioning) return;
            this.scene.start('BestRunsScene', { selected: this.menu.selected });
        };

        const showCredits = () => {
            if (this.isTransitioning) return;
            this.scene.start('CreditsScene');
        };

        const switchLanguage = () => {
            if (this.isTransitioning) return;
            document.documentElement.lang = setLanguage(getBrowserStorage(), nextLanguage());
            this.scene.restart({ selected: this.menu.selected });
        };

        this.menu = createMenu(this, {
            x: width / 2,
            y: 380,
            width: 440,
            spacing: 68,
            items: [
                { label: t('menu.start'), action: startGame },
                { label: t('menu.instructions'), action: showInstructions },
                { label: t('menu.bestRuns'), action: showBestRuns },
                { label: t('menu.language', { name: t('lang.name') }), action: switchLanguage },
                { label: t('menu.credits'), action: showCredits },
            ],
            container: this.menuContainer,
        });
        this.menu.select(this.initialSelection);

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
            this.menu.activate();
        };

        this.input.keyboard.on('keydown-ENTER', activate);
        this.input.keyboard.on('keydown-SPACE', activate);
        // Pad presses never repeat, so they skip the guard
        bindPad(this, { a: () => this.menu.activate(), start: () => this.menu.activate() });
    }

    // The getaway car tearing along the street with a patrol car on its tail
    createChase() {
        const roadY = 888;
        const police = this.add.sprite(330, roadY, 'menuCars', 2).play('menu-police');
        const player = this.add.sprite(790, roadY, 'menuCars', 0).play('menu-player');
        this.sirenGlow = this.add.image(330, roadY - 38, 'glow').setBlendMode('ADD').setScale(3).setAlpha(0.7);
        this.menuContainer.add([this.sirenGlow, police, player]);

        // Cars jostle on their suspension, out of step with each other
        this.tweens.add({ targets: player, y: roadY - 4, duration: 180, yoyo: true, repeat: -1 });
        this.tweens.add({ targets: police, y: roadY - 4, duration: 210, yoyo: true, repeat: -1, delay: 90 });
        // The cop surges and drops back as if trying to close the gap
        this.tweens.add({
            targets: [police, this.sirenGlow], x: '+=90', duration: 2200, yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut',
        });
        // Keep the glow in step with the light bar frame (red first, then blue)
        police.on('animationupdate', (anim, frame) => {
            this.sirenGlow.setTint(frame.index === 1 ? 0xff2a3a : 0x2a6aff);
        });
    }

    update(time, delta) {
        const { far, near, street } = this.layers;
        this.scroll = (this.scroll || 0) + delta;
        far.tilePositionX = Math.floor(this.scroll * SCROLL.far);
        near.tilePositionX = Math.floor(this.scroll * SCROLL.near);
        street.tilePositionX = Math.floor(this.scroll * SCROLL.street);
    }
}
