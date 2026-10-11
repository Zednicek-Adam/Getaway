import manifest from './generated/art.json';

// Asset keys, frame indices and animations for the generated pixel art
// (tools/generate_art.py). Loaded once by BootScene; every scene shares the
// textures and the global animation manager.

export const ART = manifest;
export const PICKUP_FRAMES = manifest.pickups;
export const ICON = manifest.icons;
// Train car kinds in train.png order; each kind has 8 frames, clockwise from facing up
export const TRAIN_CARS = manifest.train.cars;

// Mount sheets: rows of LEFT, UP, RIGHT, DOWN, one row per gait phase. The
// outlaw's sheet carries the handcar from frame MOUNTS.handcar on: two pump
// phases of eight headings, clockwise from facing up.
export const MOUNTS = manifest.mounts;

const BASE = 'art/';

const SHEETS = {
    outlaw: ['rider_outlaw.png', 64, 64],
    deputy: ['rider_deputy.png', 64, 64],
    marshalWagon: ['wagon_marshal.png', 64, 64],
    stagecoach: ['stagecoach.png', 64, 64],
    balloon: ['balloon.png', 96, 96],
    pickups: ['pickups.png', 32, 32],
    icons: ['icons.png', 32, 32],
    explosion: ['explosion.png', 80, 80],
    dust: ['dust.png', 24, 24],
    spark: ['spark.png', 16, 16],
    lasso: ['lasso.png', 32, 32],
    tumbleweed: ['tumbleweed.png', 32, 32],
    barricade: ['barricade.png', 64, 64],
    train: ['train.png', manifest.train.frameSize, manifest.train.frameSize],
    crossing: ['crossing.png', 64, 64],
    menuRiders: ['menu_riders.png', manifest.menuRiders.width, manifest.menuRiders.height],
};

const IMAGES = {
    city: 'city.png',
    glow: 'glow.png',
    spotlight: 'spotlight.png',
    scorch: 'scorch.png',
    shadow: 'shadow.png',
    balloonShadow: 'balloon_shadow.png',
    hideout: 'hideout.png',
    waterStop: 'water_stop.png',
    padHideout: 'pad_hideout.png',
    padWater: 'pad_water.png',
    depot: 'depot.png',
    padDepot: 'pad_depot.png',
    rail: 'rail.png',
    panel: 'panel.png',
    panelGold: 'panel_gold.png',
    panelRed: 'panel_red.png',
    menuSky: 'menu_sky.png',
    menuFar: 'menu_far.png',
    menuNear: 'menu_near.png',
    menuStreet: 'menu_street.png',
    logo: 'logo.png',
};

export function loadArt(scene) {
    for (const [key, file] of Object.entries(IMAGES)) {
        scene.load.image(key, BASE + file);
    }
    for (const [key, [file, frameWidth, frameHeight]] of Object.entries(SHEETS)) {
        scene.load.spritesheet(key, BASE + file, { frameWidth, frameHeight });
    }
}

export function createAnims(scene) {
    const anims = scene.anims;
    const range = (key, start, end) => anims.generateFrameNumbers(key, { start, end });
    const add = (key, texture, start, end, frameRate, repeat = -1, extra = {}) => {
        if (!anims.exists(key)) {
            anims.create({ key, frames: range(texture, start, end), frameRate, repeat, ...extra });
        }
    };

    const p = PICKUP_FRAMES;
    add('coin-spin', 'pickups', p.coin, p.coin + 5, 10);
    add('dynamite-fuse', 'pickups', p.bomb, p.bomb + 1, 8);
    add('explode', 'explosion', 0, 7, 22, 0);
    add('dust-puff', 'dust', 0, 5, 12, 0);
    add('spark-twinkle', 'spark', 0, 3, 18, 0, { yoyo: true });
    add('lasso-spin', 'lasso', 0, 3, 18);
    add('tumble', 'tumbleweed', 0, 3, 10);
    add('barricade-v', 'barricade', 0, 1, 4);
    add('barricade-h', 'barricade', 2, 3, 4);
    // Crossing lanterns alternate while the gates are down (frame 0/3 = arms up)
    add('crossing-h', 'crossing', 1, 2, 3);
    add('crossing-v', 'crossing', 4, 5, 3);
    const gallop = manifest.menuRiders.frames;
    add('menu-outlaw', 'menuRiders', 0, gallop - 1, 14);
    add('menu-deputy', 'menuRiders', gallop, gallop * 2 - 1, 14);
}
