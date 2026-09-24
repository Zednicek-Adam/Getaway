import Phaser from 'phaser';
import { TILE_SIZE } from '../constants';
import { COLLECTIBLE_TYPES, createCollectibleIcon } from '../objects/Collectible';
import { label, panel, dim, UI_COLORS, createMenu, cityBackdrop } from '../ui/ui';

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

        // The title screen's city, dimmed behind a big panel
        cityBackdrop(this);
        dim(this, 0.55);
        panel(this, 40, 104, width - 80, height - 224);

        label(this, centre, 56, 'HOW TO PLAY', { size: 40, color: UI_COLORS.gold }).setOrigin(0.5);

        // --- The goal -------------------------------------------------------
        this.heading(centre, 146, 'THE JOB');

        const goal = [
            'GRAB CASH OFF THE STREETS AND BANK IT AT THE SAFEHOUSE',
            'CARRIED CASH IS LOST IF THE COPS BUST YOU - BANK IT OFTEN',
            '3 LIVES. YOU LOSE ONE TO 3 RAMS OR AN EMPTY TANK',
        ];
        goal.forEach((line, i) => {
            this.body(centre, 186 + i * 30, line, UI_COLORS.white).setOrigin(0.5);
        });

        // --- Controls (left column) ----------------------------------------
        this.heading(330, 300, 'CONTROLS');

        const controls = [
            ['ARROWS/WASD', 'STEER'],
            ['F', 'BRAKE/REFUEL'],
            ['SPACE', 'DROP BOMB'],
            ['E', 'FIRE ROCKET'],
            ['G', 'GARAGE (BASE)'],
            ['ESC', 'PAUSE'],
        ];
        controls.forEach(([key, action], i) => {
            const y = 346 + i * 44;
            this.keycap(300, y, key);
            this.body(320, y, action, UI_COLORS.white);
        });

        // --- Pickups (right column) -----------------------------------------
        this.heading(940, 300, 'PICKUPS');

        const pickups = [
            [COLLECTIBLE_TYPES.MONEY, 'CASH', '+$100'],
            [COLLECTIBLE_TYPES.REPAIR, 'REPAIR', '-1 DMG'],
            [COLLECTIBLE_TYPES.NITRO, 'NITRO', '4S BOOST'],
            [COLLECTIBLE_TYPES.ROCKET, 'ROCKET', '+1 AMMO'],
            [COLLECTIBLE_TYPES.BOMB, 'BOMB', '+1 AMMO'],
            [COLLECTIBLE_TYPES.LIFE, 'LIFE', '+1 LIFE'],
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
            ['YOUR CAR DRIVES ITSELF - YOU ONLY CHOOSE THE TURNS', UI_COLORS.cyan],
            ['TURNS QUEUE UP TO 3 AHEAD, SO LINE UP JUNCTIONS EARLY', UI_COLORS.white],
            ['RAM THE DIAMOND CAR FOR $1000 - IT COSTS YOU 2 STARS', UI_COLORS.white],
        ];
        notes.forEach(([line, colour], i) => {
            this.body(centre, 626 + i * 30, line, colour).setOrigin(0.5);
        });

        // --- Wanted level ----------------------------------------------------
        this.heading(centre, 740, 'HEAT');
        this.body(centre, 776, 'EVERY PICKUP RAISES YOUR WANTED STARS', UI_COLORS.white).setOrigin(0.5);
        this.body(centre, 806, '1-3 PATROLS   4 SWAT + ROADBLOCKS   5 HELICOPTER', UI_COLORS.red)
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
    }
}
