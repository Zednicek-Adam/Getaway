import Phaser from 'phaser';
import { loadSave, getBrowserStorage } from '../storage';
import { label, panel, icon, money, UI_COLORS, createMenu, townBackdrop } from '../ui/ui';
import { bindPad } from '../gamepad';
import { dustPuff, gunshot, DUST_TINT } from '../fx';

// Parallax speeds in texture pixels per millisecond
const SCROLL = { far: 0.012, near: 0.035, street: 0.3 };

// The trail the riders gallop along, and where their hooves land on it
const TRAIL_Y = 888;
const RIDER_Y = TRAIL_Y - 68;

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const { width, height } = this.scale;

        // Container for all menu elements (so we can slide them as one unit)
        this.menuContainer = this.add.container(0, 0);

        // Desert sunset with a chase playing out on the trail
        this.layers = townBackdrop(this, this.menuContainer);
        this.createChase();

        // Title
        const logo = this.add.image(width / 2, 170, 'logo');
        this.menuContainer.add(logo);
        this.tweens.add({ targets: logo, y: 178, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const subtitle = label(this, width / 2, 322, 'A WILD WEST PIXEL REMAKE', { color: UI_COLORS.goldLight })
            .setOrigin(0.5);
        this.menuContainer.add(subtitle);

        // The persistent stash — shows $0 fine when empty
        const banked = loadSave(getBrowserStorage()).banked;
        const bankLabel = label(this, 0, 0, `STASH ${money(banked)}`, { color: UI_COLORS.gold }).setOrigin(0, 0.5);
        const bankW = Math.ceil((bankLabel.width + 72) / 2) * 2;
        const bankX = width / 2 - bankW / 2;
        const bankPanel = panel(this, bankX, 598, bankW, 52);
        const coin = icon(this, bankX + 28, 624, 'coin');
        bankLabel.setPosition(bankX + 50, 624);
        this.menuContainer.add([bankPanel, coin, bankLabel]);

        // Track whether transition is already in progress
        this.isTransitioning = false;

        // Saddle up — the whole title slides away to reveal the town
        const startGame = () => {
            if (this.isTransitioning) return;
            this.isTransitioning = true;

            // Stop the idle tweens and timers so they don't fight the slide
            this.tweens.killAll();
            this.time.removeAllEvents();

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

        this.menu = createMenu(this, {
            x: width / 2,
            y: 420,
            items: [
                { label: 'SADDLE UP', action: startGame },
                { label: 'HOW TO PLAY', action: showInstructions },
            ],
            container: this.menuContainer,
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
            this.menu.activate();
        };

        this.input.keyboard.on('keydown-ENTER', activate);
        this.input.keyboard.on('keydown-SPACE', activate);
        // Pad presses never repeat, so they skip the guard
        bindPad(this, { a: () => this.menu.activate(), start: () => this.menu.activate() });
    }

    // The outlaw tearing along the trail with two deputies on his tail,
    // dust flying and the posse firing into the air
    createChase() {
        const outlaw = this.add.sprite(860, RIDER_Y, 'menuRiders', 0).play('menu-outlaw');
        const deputies = [300, 520].map((x, i) => this.add.sprite(x, RIDER_Y, 'menuRiders', 6)
            .play({ key: 'menu-deputy', startFrame: i * 3 }));
        this.menuContainer.add([...deputies, outlaw]);
        this.riders = [outlaw, ...deputies];

        // The deputies surge and drop back as if trying to close the gap
        deputies.forEach((d, i) => {
            this.tweens.add({
                targets: d, x: `+=${90 - i * 30}`, duration: 2200 + i * 500, yoyo: true, repeat: -1,
                ease: 'Sine.easeInOut', delay: i * 400,
            });
        });
        this.tweens.add({ targets: outlaw, x: '+=40', duration: 3100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Dust off every set of hooves
        this.time.addEvent({
            delay: 90, loop: true, callback: () => {
                for (const r of this.riders) {
                    const puff = dustPuff(this, r.x - 60 + Phaser.Math.Between(-10, 10), TRAIL_Y - 8,
                        { drift: 30, scale: 2.4, depth: 0, tint: 0xc08a64 });
                    this.menuContainer.addAt(puff, 4);
                }
            },
        });

        // Warning shots from the posse
        this.time.addEvent({
            delay: 1300, loop: true, callback: () => {
                const d = Phaser.Utils.Array.GetRandom(deputies);
                gunshot(this, d.x + 34, d.y - 78);
            },
        });

        // Now and then a tumbleweed bowls past
        this.time.addEvent({ delay: 4500, loop: true, callback: () => this.rollTumbleweed() });
    }

    rollTumbleweed() {
        const { width } = this.scale;
        const weed = this.add.sprite(width + 40, TRAIL_Y - 24, 'tumbleweed', 0).setScale(2).play('tumble');
        this.menuContainer.add(weed);
        this.tweens.add({ targets: weed, x: -60, duration: 3600, onComplete: () => weed.destroy() });
        this.tweens.add({ targets: weed, y: TRAIL_Y - 64, duration: 300, yoyo: true, repeat: 5, ease: 'Quad.easeOut' });
        dustPuff(this, width - 20, TRAIL_Y - 10, { drift: 10, scale: 2, depth: 0, tint: DUST_TINT });
    }

    update(time, delta) {
        const { far, near, street } = this.layers;
        this.scroll = (this.scroll || 0) + delta;
        far.tilePositionX = Math.floor(this.scroll * SCROLL.far);
        near.tilePositionX = Math.floor(this.scroll * SCROLL.near);
        street.tilePositionX = Math.floor(this.scroll * SCROLL.street);
    }
}
