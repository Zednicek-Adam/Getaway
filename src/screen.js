// Game canvas size, and the fixed-layout "stage" the menus are drawn on.
//
// On a desktop the canvas is always the 1280x960 design size, letterboxed by
// Phaser's FIT. A phone screen is a very different shape (about 2.2:1 held
// sideways, 1:2.2 upright), so there the canvas takes the screen's shape
// instead: the design size is kept on the short side and the long side grows
// until it fills the page. The map simply shows more road; the HUD lays itself
// out from the live size. Menus stay laid out at 1280x960, centred, with
// their backdrop stretched to the edges (useStage).

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 960;

// Fired on game.events after the canvas changes size (a phone rotating).
// Phaser's own scale 'resize' also fires on every window refit, even when the
// game size stays the same.
export const SCREEN_RESIZE = 'screen-resize';

// The canvas size for a page of pageWidth x pageHeight. Pure, so it's tested.
// Both sides stay even so centring lands on whole pixels.
export function gameSizeFor(pageWidth, pageHeight, fill) {
    if (!fill || !(pageWidth > 0) || !(pageHeight > 0)) {
        return { width: STAGE_WIDTH, height: STAGE_HEIGHT };
    }
    const even = (n) => Math.round(n / 2) * 2;
    const aspect = pageWidth / pageHeight;
    if (aspect >= STAGE_WIDTH / STAGE_HEIGHT) {
        return { width: even(STAGE_HEIGHT * aspect), height: STAGE_HEIGHT };
    }
    return { width: STAGE_WIDTH, height: even(STAGE_WIDTH / aspect) };
}

// How far a touch screen zooms the map, and how much bigger it draws the
// HUD and buttons, given how many CSS pixels one game pixel covers. FIT shrinks
// the canvas a long way onto a phone (0.3 to 0.4 CSS px per game pixel), which
// leaves the streets and the HUD text tiny. The map zooms until a tile is about
// 32 CSS px and the HUD grows until one of its pixels is about 0.55 CSS px,
// each up to a cap. A phone held sideways caps the HUD lower: the screen is
// short, and a bigger HUD would crowd the road. A tablet already meets both
// and is left alone. Steps of an eighth keep a 64px tile a whole number of
// pixels on screen.
export function viewScales(cssPerPixel, touch, sideways) {
    if (!touch || !(cssPerPixel > 0)) return { mapZoom: 1, uiScale: 1 };
    const scale = (wanted, max) => Math.min(max, Math.max(1, Math.round(wanted * 8) / 8));
    return {
        mapZoom: scale(0.5 / cssPerPixel, 1.5),
        uiScale: scale(0.55 / cssPerPixel, sideways ? 1.125 : 1.375),
    };
}

// Keeps a filling canvas the shape of the page as it rotates or resizes.
// `pageSize` returns the current { width, height } of the page.
export function watchScreen(game, pageSize) {
    let pending = null;
    const apply = () => {
        pending = null;
        const { width, height } = pageSize();
        const size = gameSizeFor(width, height, true);
        if (size.width === game.scale.width && size.height === game.scale.height) return;
        game.scale.setGameSize(size.width, size.height);
        game.events.emit(SCREEN_RESIZE, size);
    };
    // A rotation fires a burst of resize events while the browser settles
    window.addEventListener('resize', () => {
        clearTimeout(pending);
        pending = setTimeout(apply, 150);
    });
}

// Calls fn after every canvas size change while the scene is alive
export function onScreenResize(scene, fn) {
    scene.game.events.on(SCREEN_RESIZE, fn);
    scene.events.once('shutdown', () => scene.game.events.off(SCREEN_RESIZE, fn));
}

// For a scene laid out on the fixed 1280x960 stage: scrolls its camera so the
// stage sits in the middle of the canvas, and rebuilds the scene (restart
// with restartData(), or not at all if that returns null) when the canvas
// changes size. Returns the stage size to lay out against. Full-screen
// pieces (dim, cityBackdrop) cover the whole canvas themselves.
//
// anchor 'bottom' sits the stage on the bottom edge of a tall canvas instead
// (the city-backdrop screens: the street meets the bottom of the phone and
// night sky fills the rest).
export function useStage(scene, restartData = () => undefined, { anchor = 'centre' } = {}) {
    scene.stageAnchor = anchor;
    const { x, y } = stageOffset(scene);
    scene.cameras.main.setScroll(-x, -y);
    onScreenResize(scene, () => {
        const data = restartData();
        if (data !== null) scene.scene.restart(data);
    });
    return { width: STAGE_WIDTH, height: STAGE_HEIGHT };
}

// How far the stage's top-left corner sits from the canvas's
export function stageOffset(scene) {
    const spareY = scene.scale.height - STAGE_HEIGHT;
    return {
        x: (scene.scale.width - STAGE_WIDTH) / 2,
        y: scene.stageAnchor === 'bottom' ? spareY : spareY / 2,
    };
}

// The HUD's coordinate space in a scene whose camera zooms (GameScene on a
// touch screen). Objects pinned to the screen with scroll factor 0 still zoom
// with the camera, about the canvas centre, so each HUD layer is a container
// that undoes the map zoom and applies the HUD's own scale instead: a child at
// (x, y) lands at uiScale * (x, y) on the canvas. Lay out against width x
// height, the canvas size in HUD pixels. Children keep scroll factor 0, which
// is what input hit-testing reads.
export class HudSpace {
    constructor(scene) {
        this.scene = scene;
        this.layers = [];
        this.setScale(1);
    }

    // Call after the camera zoom or the canvas size changes
    setScale(uiScale) {
        this.uiScale = uiScale;
        this.width = this.scene.scale.width / uiScale;
        this.height = this.scene.scale.height / uiScale;
        this.layers.forEach((layer) => this.fit(layer));
    }

    // A container for HUD objects, drawn at `depth`
    layer(depth) {
        const layer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
        this.layers.push(layer);
        this.fit(layer);
        return layer;
    }

    fit(layer) {
        const zoom = this.scene.cameras.main.zoom;
        const { width, height } = this.scene.scale;
        const pull = 1 - 1 / zoom;
        layer.setPosition((width / 2) * pull, (height / 2) * pull).setScale(this.uiScale / zoom);
    }
}
