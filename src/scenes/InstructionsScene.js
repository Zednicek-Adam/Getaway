import Phaser from 'phaser';
import { COLLECTIBLE_TYPES, createCollectibleIcon } from '../objects/Collectible';

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

        // Background + stripes, matching MenuScene's bank-robber look
        this.add.rectangle(0, 0, width, height, 0x1a1a1a).setOrigin(0);
        for (let i = 0; i < height; i += 40) {
            this.add.rectangle(0, i, width, 10, 0x000000, 0.3).setOrigin(0);
        }

        this.add.text(centre, 62, 'HOW TO PLAY', {
            fontFamily: '"Press Start 2P"',
            fontSize: '34px',
            fill: '#FFD700',
            stroke: '#B22222',
            strokeThickness: 7,
            shadow: { offsetX: 3, offsetY: 3, color: '#000000', fill: true },
        }).setOrigin(0.5);

        // --- The goal -------------------------------------------------------
        this.heading(centre, 122, 'THE JOB');

        const goal = [
            'GRAB CASH OFF THE STREETS AND BANK IT AT THE SAFEHOUSE',
            'CARRIED CASH IS LOST IF THE COPS BUST YOU - BANK IT OFTEN',
            '3 LIVES. YOU LOSE ONE TO 3 RAMS OR AN EMPTY TANK',
        ];
        goal.forEach((line, i) => {
            this.body(centre, 162 + i * 28, line, '#FFFFFF', 14).setOrigin(0.5);
        });

        // --- Controls (left column) ----------------------------------------
        this.heading(340, 268, 'CONTROLS');

        const controls = [
            ['ARROWS / WASD', 'STEER'],
            ['F', 'BRAKE / REFUEL'],
            ['SPACE', 'DROP BOMB'],
            ['E', 'FIRE ROCKET'],
            ['G', 'GARAGE (AT BASE)'],
            ['ESC', 'PAUSE'],
        ];
        controls.forEach(([key, action], i) => {
            const y = 312 + i * 40;
            this.body(120, y, key, '#FFD700', 14);
            this.body(350, y, action, '#FFFFFF', 14);
        });

        // --- Pickups (right column) -----------------------------------------
        this.heading(940, 268, 'PICKUPS');

        const pickups = [
            [COLLECTIBLE_TYPES.MONEY, 'CASH', '+$100'],
            [COLLECTIBLE_TYPES.REPAIR, 'REPAIR', '-1 DMG'],
            [COLLECTIBLE_TYPES.NITRO, 'NITRO', '4S BOOST'],
            [COLLECTIBLE_TYPES.ROCKET, 'ROCKET', '+1 AMMO'],
            [COLLECTIBLE_TYPES.BOMB, 'BOMB', '+1 AMMO'],
            [COLLECTIBLE_TYPES.LIFE, 'LIFE', '+1 LIFE'],
        ];
        pickups.forEach(([type, name, effect], i) => {
            const y = 312 + i * 40;
            const icon = createCollectibleIcon(this, type, 46);
            icon.x = 760;
            icon.y = y + 7; // body text is top-aligned; nudge the centred icon to match
            this.body(810, y, name, '#FFFFFF', 14);
            this.body(1010, y + 2, effect, '#AAAAAA', 12);
        });

        // --- Things that are not obvious from playing ------------------------
        const notes = [
            ['YOUR CAR DRIVES ITSELF - YOU ONLY CHOOSE THE TURNS', '#66FFFF'],
            ['TURNS QUEUE UP TO 3 AHEAD, SO LINE UP JUNCTIONS EARLY', '#FFFFFF'],
            ['RAM THE DIAMOND CAR FOR $1000 - IT COSTS YOU 2 STARS', '#FFFFFF'],
        ];
        notes.forEach(([line, colour], i) => {
            this.body(centre, 576 + i * 30, line, colour, 13).setOrigin(0.5);
        });

        // --- Wanted level ----------------------------------------------------
        this.heading(centre, 692, 'HEAT');
        this.body(centre, 730, 'EVERY PICKUP RAISES YOUR WANTED STARS', '#FFFFFF', 13)
            .setOrigin(0.5);
        this.body(centre, 758, '1-3 PATROLS    4 SWAT + ROADBLOCKS    5 HELICOPTER', '#B22222', 13)
            .setOrigin(0.5);

        this.createBackButton(centre, height - 90);
    }

    // Section label
    heading(x, y, text) {
        return this.add.text(x, y, text, {
            fontFamily: '"Press Start 2P"',
            fontSize: '18px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 5,
        }).setOrigin(0.5);
    }

    // Left-aligned by default; callers centre it with setOrigin where needed
    body(x, y, text, fill, size) {
        return this.add.text(x, y, text, {
            fontFamily: '"Press Start 2P"',
            fontSize: `${size}px`,
            fill,
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0, 0.5);
    }

    createBackButton(x, y) {
        const back = this.add.text(x, y, 'BACK', {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // Mirrors MenuScene: a held ENTER/SPACE repeats, and the repeat can
        // land on this scene the instant it opens, snapping straight back.
        // Date.now(), not this.time.now — see the note in MenuScene.
        const armedAt = Date.now();
        const goBack = () => {
            if (Date.now() - armedAt < 250) return;
            this.scene.start(this.returnTo);
        };

        back.on('pointerover', () => back.setFill('#FFD700'));
        back.on('pointerout', () => back.setFill('#FFFFFF'));
        back.on('pointerdown', goBack);

        // Same pulsing chevrons the other menus use
        const offset = 110;
        const left = this.chevron(x - offset, y, '>');
        const right = this.chevron(x + offset, y, '<');
        this.tweens.add({
            targets: left, x: x - offset + 15, duration: 500, yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut',
        });
        this.tweens.add({
            targets: right, x: x + offset - 15, duration: 500, yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut',
        });

        this.input.keyboard.on('keydown-ESC', goBack);
        this.input.keyboard.on('keydown-ENTER', goBack);
        this.input.keyboard.on('keydown-SPACE', goBack);
    }

    chevron(x, y, char) {
        return this.add.text(x, y, char, {
            fontFamily: '"Press Start 2P"',
            fontSize: '24px',
            fill: '#B22222',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5);
    }
}
