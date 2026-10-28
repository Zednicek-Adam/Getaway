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
