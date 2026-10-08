import Phaser from 'phaser';
import { TILE_SIZE } from '../constants';
import { COLLECTIBLE_TYPES, createCollectibleIcon } from '../objects/Collectible';
import { label, panel, dim, UI_COLORS, createMenu, cityBackdrop } from '../ui/ui';
import { bindPad } from '../gamepad';
import { t } from '../i18n';

// Static "how to play" page reached from the main menu.
//
// The pickup legend is drawn with createCollectibleIcon — the same factory the
// road pickups use — so the icons taught here can never drift from the icons in
// play. Text comes from i18n.js, which keeps it inside the glyphs Press Start
// 2P actually has.
export class InstructionsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'InstructionsScene' });
    }

    // Reached from the main menu and from the pause menu, so BACK has to know
    // where it came from. Opening from pause leaves GameScene paused and
    // untouched underneath, so the run survives the detour.
    init(data) {
        this.returnTo = (data && data.returnTo) || 'MenuScene';
    }

    create() {
        const { width, height } = this.scale;
        const centre = width / 2;

        // The title screen's city, dimmed behind a big panel
        cityBackdrop(this);
        dim(this, 0.55);
        panel(this, 40, 104, width - 80, height - 224);

        label(this, centre, 56, t('help.title'), { size: 40, color: UI_COLORS.gold }).setOrigin(0.5);

        // --- The goal -------------------------------------------------------
        this.heading(centre, 146, t('help.job'));

        const goal = [t('help.goal1'), t('help.goal2'), t('help.goal3')];
        goal.forEach((line, i) => {
            this.body(centre, 186 + i * 30, line, UI_COLORS.white).setOrigin(0.5);
        });

        // --- Controls (left column) ----------------------------------------
        this.heading(330, 300, t('help.controls'));

        // Keyboard / gamepad. A D-pad or stick steers too; that one needs no
        // keycap.
        const controls = [
            [t('help.keySteer'), t('help.steer')],
            ['F / A', t('help.brake')],
            [t('help.keyBomb'), t('help.bomb')],
            ['E / X', t('help.rocket')],
            ['G / Y', t('help.garage')],
            ['ESC / START', t('help.pause')],
        ];
        controls.forEach(([key, action], i) => {
            const y = 346 + i * 44;
            this.keycap(300, y, key);
            this.body(320, y, action, UI_COLORS.white);
        });

        // --- Pickups (right column) -----------------------------------------
        this.heading(940, 300, t('help.pickups'));

        const pickups = [
            [COLLECTIBLE_TYPES.MONEY, t('help.cash'), t('help.cashEffect')],
            [COLLECTIBLE_TYPES.REPAIR, t('help.repair'), t('help.repairEffect')],
            [COLLECTIBLE_TYPES.NITRO, t('help.nitro'), t('help.nitroEffect')],
            [COLLECTIBLE_TYPES.ROCKET, t('help.rocketName'), t('help.ammoEffect')],
            [COLLECTIBLE_TYPES.BOMB, t('help.bombName'), t('help.ammoEffect')],
            [COLLECTIBLE_TYPES.LIFE, t('help.life'), t('help.lifeEffect')],
        ];
        pickups.forEach(([type, name, effect], i) => {
            const y = 346 + i * 44;
            const pickup = createCollectibleIcon(this, type, TILE_SIZE);
            pickup.setPosition(770, y);
            this.body(806, y, name, UI_COLORS.white);
            this.body(1000, y, effect, UI_COLORS.dim);
        });

        // --- Things that are not obvious from playing ------------------------
        const notes = [
            [t('help.note1'), UI_COLORS.cyan],
            [t('help.note2'), UI_COLORS.white],
            [t('help.note3'), UI_COLORS.white],
        ];
        notes.forEach(([line, colour], i) => {
            this.body(centre, 626 + i * 30, line, colour).setOrigin(0.5);
        });

        // --- Wanted level ----------------------------------------------------
        this.heading(centre, 740, t('help.heat'));
        this.body(centre, 776, t('help.heat1'), UI_COLORS.white).setOrigin(0.5);
        this.body(centre, 806, t('help.heat2'), UI_COLORS.red)
            .setOrigin(0.5);

        this.createBackButton(centre, height - 60);
    }

    // Section label
    heading(x, y, text) {
        return label(this, x, y, text, { size: 24, color: UI_COLORS.red }).setOrigin(0.5);
    }

    // Left-aligned by default; callers centre it with setOrigin where needed
    body(x, y, text, color) {
        return label(this, x, y, text, { size: 16, color }).setOrigin(0, 0.5);
    }

    // A key drawn as a little raised keycap, right-aligned to x
    keycap(x, y, text) {
        const t = label(this, 0, y, text, { size: 16, color: UI_COLORS.gold }).setOrigin(0.5);
        const w = Math.ceil((t.width + 20) / 2) * 2;
        panel(this, x - w, y - 20, w, 40);
        t.setX(x - w / 2).setDepth(1);
        return t;
    }

    createBackButton(x, y) {
        // Mirrors MenuScene: a held ENTER/SPACE repeats, and the repeat can
        // land on this scene the instant it opens, snapping straight back.
        // Date.now(), not this.time.now — see the note in MenuScene.
        const armedAt = Date.now();
        const goBack = () => {
            if (Date.now() - armedAt < 250) return;
            this.scene.start(this.returnTo);
        };

        createMenu(this, { x, y, width: 280, items: [{ label: t('help.back'), action: goBack }] });

        this.input.keyboard.on('keydown-ESC', goBack);
        this.input.keyboard.on('keydown-ENTER', goBack);
        this.input.keyboard.on('keydown-SPACE', goBack);
        bindPad(this, { a: goBack, b: goBack, start: goBack });
    }
}
