import { ICON } from '../art';
import { bindPad } from '../gamepad';
import { stageOffset, STAGE_WIDTH, STAGE_HEIGHT } from '../screen';

// Shared look for every screen: pixel text, 9-slice panels, icons and the
// button list used by the menus. Font sizes stay on multiples of 8 so Press
// Start 2P's glyphs land on whole pixels.

export const FONT = '"Press Start 2P"';

export const INK = '#0a0b11';
export const UI_COLORS = {
    gold: '#ffc933',
    goldLight: '#fff09a',
    red: '#ff4d5a',
    white: '#f4f6f8',
    dim: '#8a90a6',
    faint: '#4a5068',
    cyan: '#5fe0ff',
    green: '#6fe08a',
    orange: '#ff9a3c',
};

const PANEL_KEYS = { steel: 'panel', gold: 'panelGold', red: 'panelRed' };
const SLICE = 10; // corner size of the panel textures (5 art px at 2x)

export function label(scene, x, y, text, opts = {}) {
    const { size = 16, color = UI_COLORS.white, stroke = size >= 24 ? 6 : 4, shadow = true } = opts;
    const drop = size >= 32 ? 4 : 2;
    return scene.add.text(x, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color,
        stroke: INK,
        strokeThickness: stroke,
        padding: { x: 2, y: drop + 2 },
        shadow: shadow ? { offsetX: 0, offsetY: drop, color: INK, fill: true, stroke: true } : undefined,
    });
}

export function panel(scene, x, y, width, height, variant = 'steel') {
    return scene.add.nineslice(x, y, PANEL_KEYS[variant], undefined,
        Math.round(width), Math.round(height), SLICE, SLICE, SLICE, SLICE).setOrigin(0);
}

export function icon(scene, x, y, name) {
    return scene.add.image(x, y, 'icons', ICON[name]);
}

// Money with thousands separators: 12300 -> "$12,300"
export function money(n) {
    return `$${Math.round(n).toLocaleString('en-US')}`;
}

// A dimmed full-screen backdrop for overlays
export function dim(scene, alpha = 0.72) {
    const { width, height } = scene.scale;
    return scene.add.rectangle(0, 0, width, height, 0x05060c, alpha).setOrigin(0).setScrollFactor(0);
}

// Vertical list of pixel buttons with a gold selection state and bouncing
// chevrons. Handles hover, click and UP/DOWN (+W/S, D-pad, stick); confirm
// and back keys are left to the owning scene so it can apply its own
// key-repeat guards.
export function createMenu(scene, { x, y, items, width = 400, height = 56, spacing = 72, size = 24, container }) {
    const buttons = items.map((item, i) => {
        const by = y + i * spacing;
        const idle = panel(scene, x - width / 2, by - height / 2, width, height, 'steel');
        const lit = panel(scene, x - width / 2, by - height / 2, width, height, item.tone === 'danger' ? 'red' : 'gold')
            .setVisible(false);
        const text = label(scene, x, by, item.label, { size }).setOrigin(0.5);
        const hit = scene.add.zone(x, by, width, height).setInteractive({ useHandCursor: true });
        if (container) container.add([idle, lit, text, hit]);
        return { item, idle, lit, text, hit, y: by };
    });

    const chevronL = label(scene, x - width / 2 - 28, y, '>', { size, color: UI_COLORS.gold }).setOrigin(0.5);
    const chevronR = label(scene, x + width / 2 + 28, y, '<', { size, color: UI_COLORS.gold }).setOrigin(0.5);
    if (container) container.add([chevronL, chevronR]);
    scene.tweens.add({ targets: chevronL, x: chevronL.x + 10, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: chevronR, x: chevronR.x - 10, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    let selected = 0;
    const menu = {
        buttons,
        get selected() { return selected; },
        select(i) {
            selected = (i + buttons.length) % buttons.length;
            buttons.forEach((b, j) => {
                const on = j === selected;
                b.idle.setVisible(!on);
                b.lit.setVisible(on);
                const tone = b.item.tone === 'danger' ? UI_COLORS.red : UI_COLORS.gold;
                b.text.setColor(on ? tone : UI_COLORS.white);
            });
            const tone = buttons[selected].item.tone === 'danger' ? UI_COLORS.red : UI_COLORS.gold;
            [chevronL, chevronR].forEach((c) => c.setY(buttons[selected].y).setColor(tone));
        },
        activate() {
            buttons[selected].item.action();
        },
    };

    buttons.forEach((b, i) => {
        b.hit.on('pointerover', () => menu.select(i));
        b.hit.on('pointerdown', () => { menu.select(i); b.item.action(); });
    });
    const up = () => menu.select(selected - 1);
    const down = () => menu.select(selected + 1);
    scene.input.keyboard.on('keydown-UP', up);
    scene.input.keyboard.on('keydown-W', up);
    scene.input.keyboard.on('keydown-DOWN', down);
    scene.input.keyboard.on('keydown-S', down);
    bindPad(scene, { up, down });

    menu.select(0);
    return menu;
}

// Parallax night-city backdrop shared by the title and instructions screens.
// Returns the layers so the caller can scroll them.
//
// Drawn on the 1280x960 stage (see useStage) but stretched to the canvas
// edges. On a wide screen the city layers repeat sideways and the sky's
// moonless left half fills the sides (a repeat of the whole sky would put a
// second moon up). On a tall one, starry night sky fills the space above.
export function cityBackdrop(scene, container) {
    const { width, height } = scene.scale;
    const { x: ox, y: oy } = stageOffset(scene);
    const left = -ox;
    // Created back to front: without a container, creation order is draw order
    const pieces = [];
    if (oy > 0) pieces.push(starfield(scene, left, -oy, width, oy));
    // Road below the stage, for a stage centred on a tall canvas
    const below = height - oy - STAGE_HEIGHT;
    if (below > 0) {
        pieces.push(scene.add.rectangle(left, STAGE_HEIGHT, width, below, 0x312d36).setOrigin(0));
    }
    if (ox > 0) {
        const sky = scene.textures.get('menuSky');
        if (!sky.has('moonless')) sky.add('moonless', 0, 0, 0, 640, STAGE_HEIGHT);
        const leftSide = scene.add.tileSprite(left, 0, ox, STAGE_HEIGHT, 'menuSky', 'moonless').setOrigin(0);
        leftSide.tilePositionX = left; // meets the sky's left edge without a seam
        const rightSide = scene.add.tileSprite(STAGE_WIDTH, 0, ox, STAGE_HEIGHT, 'menuSky', 'moonless').setOrigin(0);
        pieces.push(leftSide, rightSide);
    }

    const strip = (key) => scene.add.tileSprite(left, 0, width, STAGE_HEIGHT, key).setOrigin(0);
    const layers = {
        sky: scene.add.image(0, 0, 'menuSky').setOrigin(0),
        far: strip('menuFar'),
        near: strip('menuNear'),
        street: strip('menuStreet'),
    };
    pieces.push(...Object.values(layers));

    if (container) container.add(pieces);
    return layers;
}

// Night sky in the colour of the sky texture's top rows, with stars on the
// 2px art grid. Seeded, so a rebuilt screen gets the same sky.
function starfield(scene, x, y, width, height) {
    const g = scene.add.graphics();
    g.fillStyle(0x080a1e).fillRect(x, y, width, height);
    let seed = 7;
    const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const count = Math.round((width * height) / 9000);
    for (let i = 0; i < count; i++) {
        const sx = x + Math.floor((rand() * width) / 2) * 2;
        const sy = y + Math.floor((rand() * height) / 2) * 2;
        const roll = rand();
        g.fillStyle(roll < 0.15 ? 0xffffff : roll < 0.5 ? 0xb8bce8 : 0x5a5e96);
        g.fillRect(sx, sy, roll < 0.08 ? 4 : 2, roll < 0.08 ? 4 : 2);
    }
    return g;
}
