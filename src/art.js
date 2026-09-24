import manifest from './generated/art.json';

// Asset keys, frame indices and animations for the generated pixel art
// (tools/generate_art.py). Loaded once by BootScene; every scene shares the
// textures and the global animation manager.

export const ART = manifest;
export const PICKUP_FRAMES = manifest.pickups;
export const ICON = manifest.icons;

const BASE = 'art/';

const SHEETS = {
    playerCar: ['car_player.png', 64, 64],
    policeCar: ['car_police.png', 64, 64],
    swatVan: ['van_swat.png', 64, 64],
    diamondTruck: ['truck_diamond.png', 64, 64],
    heli: ['heli.png', 96, 96],
    heliShadow: ['heli_shadow.png', 96, 96],
    rotor: ['rotor.png', 96, 96],
    pickups: ['pickups.png', 32, 32],
    icons: ['icons.png', 32, 32],
    explosion: ['explosion.png', 80, 80],
    smoke: ['smoke.png', 24, 24],
    spark: ['spark.png', 16, 16],
    flame: ['flame.png', 16, 24],
    rocket: ['rocket.png', 32, 16],
    roadblock: ['roadblock.png', 64, 64],
    menuCars: ['menu_cars.png', 208, 80],
};

const IMAGES = {
    city: 'city.png',
    glow: 'glow.png',
    spotlight: 'spotlight.png',
    scorch: 'scorch.png',
    shadow: 'shadow.png',
    safehouse: 'safehouse.png',
    fuelStation: 'fuelstation.png',
    padBase: 'pad_base.png',
    padFuel: 'pad_fuel.png',
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
    add('bomb-fuse', 'pickups', p.bomb, p.bomb + 1, 8);
    add('explode', 'explosion', 0, 7, 22, 0);
    add('smoke-puff', 'smoke', 0, 5, 12, 0);
    add('spark-twinkle', 'spark', 0, 3, 18, 0, { yoyo: true });
    add('flame-flicker', 'flame', 0, 2, 20);
    add('rocket-fly', 'rocket', 0, 1, 16);
    add('rotor-spin', 'rotor', 0, 3, 30);
    add('roadblock-v', 'roadblock', 0, 1, 3);
    add('roadblock-h', 'roadblock', 2, 3, 3);
    add('menu-player', 'menuCars', 0, 1, 12);
    add('menu-police', 'menuCars', 2, 3, 6);
}
