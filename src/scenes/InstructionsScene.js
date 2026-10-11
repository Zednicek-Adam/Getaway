import Phaser from 'phaser';
import { TILE_SIZE } from '../constants';
import { COLLECTIBLE_TYPES, createCollectibleIcon } from '../objects/Collectible';
import { label, panel, dim, UI_COLORS, createMenu, townBackdrop } from '../ui/ui';
import { bindPad } from '../gamepad';

// Static "how to play" page reached from the main menu.
//
// The pickup legend is drawn with createCollectibleIcon — the same factory the
// road pickups use — so the icons taught here can never drift from the icons in
// play. Text is kept to plain ASCII: the Press Start 2P webfont has no glyphs
// for em dashes or arrows, which would render as blank boxes.
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

        // The title screen's desert sunset, dimmed behind a big panel
        townBackdrop(this);
        dim(this, 0.55);
        panel(this, 40, 104, width - 80, height - 200);

        label(this, centre, 56, 'HOW TO PLAY', { size: 40, color: UI_COLORS.gold }).setOrigin(0.5);

        // --- The goal -------------------------------------------------------
        this.heading(centre, 146, 'THE JOB');

        const goal = [
            'RUSTLE GOLD OFF THE STREETS AND STASH IT AT YOUR HIDEOUT',
            'LOOT IN YOUR SADDLEBAGS IS LOST IF THE POSSE CATCHES YOU',
            '3 LIVES. LOSE ONE TO 3 TACKLES OR A WORN-OUT HORSE',
        ];
        goal.forEach((line, i) => {
            this.body(centre, 186 + i * 30, line, UI_COLORS.white).setOrigin(0.5);
        });

        // --- Controls (left column) ----------------------------------------
        this.heading(330, 300, 'CONTROLS');

        // Keyboard / gamepad. A D-pad or stick steers too; that one needs no
        // keycap.
        const controls = [
            ['ARROWS/WASD', 'STEER'],
            ['F / A', 'REIN IN/DRINK'],
            ['SPACE / B', 'LIGHT DYNAMITE'],
            ['E / X', 'THROW LASSO'],
            ['G / Y', 'STORE (HIDEOUT)'],
            ['ESC / START', 'PAUSE'],
        ];
        controls.forEach(([key, action], i) => {
            const y = 346 + i * 44;
            this.keycap(300, y, key);
            this.body(320, y, action, UI_COLORS.white);
        });

        // --- Pickups (right column) -----------------------------------------
        this.heading(940, 300, 'PICKUPS');

        const pickups = [
            [COLLECTIBLE_TYPES.MONEY, 'GOLD COIN', '+$100'],
            [COLLECTIBLE_TYPES.REPAIR, 'SNAKE OIL', '+1 GRIT'],
            [COLLECTIBLE_TYPES.NITRO, 'CARROT', '4S GALLOP'],
            [COLLECTIBLE_TYPES.ROCKET, 'LASSO', '+1 ROPE'],
            [COLLECTIBLE_TYPES.BOMB, 'DYNAMITE', '+1 BUNDLE'],
            [COLLECTIBLE_TYPES.LIFE, 'STETSON', '+1 LIFE'],
            [COLLECTIBLE_TYPES.RAIL_PASS, 'RAIL PASS', 'HANDCAR'],
        ];
        pickups.forEach(([type, name, effect], i) => {
            const y = 346 + i * 38;
            const pickup = createCollectibleIcon(this, type, TILE_SIZE);
            pickup.setPosition(770, y);
            this.body(806, y, name, UI_COLORS.white);
            this.body(1000, y, effect, UI_COLORS.dim);
        });

        // --- Things that are not obvious from playing ------------------------
        const notes = [
            ['YOUR HORSE RUNS ON ITS OWN - YOU ONLY CHOOSE THE TURNS', UI_COLORS.cyan],
            ['TURNS QUEUE UP TO 3 AHEAD, SO LINE UP JUNCTIONS EARLY', UI_COLORS.white],
            ['REIN IN TO REST YOUR HORSE - A TROUGH REFILLS IT FAST', UI_COLORS.white],
            ['ROB THE STAGECOACH FOR $1000 - IT COSTS YOU 2 BADGES', UI_COLORS.white],
            ['THE POSSE WAITS AT CROSSING GATES - BEAT THE TRAIN', UI_COLORS.white],
            ['RAIL PASS (STORE UNLOCK): TURN AT A CROSSING TO RIDE', UI_COLORS.purple],
        ];
        notes.forEach(([line, colour], i) => {
            this.body(centre, 614 + i * 25, line, colour).setOrigin(0.5);
        });

        // --- Wanted level ----------------------------------------------------
        this.heading(centre, 776, 'HEAT');
        this.body(centre, 808, 'EVERY PICKUP RAISES YOUR WANTED BADGES', UI_COLORS.white).setOrigin(0.5);
        this.body(centre, 834, '1-3 DEPUTIES   4 MARSHALS + BARRICADES   5 BALLOON', UI_COLORS.red)
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

        createMenu(this, { x, y, width: 280, items: [{ label: 'BACK', action: goBack }] });

        this.input.keyboard.on('keydown-ESC', goBack);
        this.input.keyboard.on('keydown-ENTER', goBack);
        this.input.keyboard.on('keydown-SPACE', goBack);
        bindPad(this, { a: goBack, b: goBack, start: goBack });
    }
}
