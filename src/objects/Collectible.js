import { TILE_SIZE } from '../constants';
import { PICKUP_FRAMES, ICON } from '../art';

export const COLLECTIBLE_TYPES = {
    MONEY: 'money',
    FUEL: 'fuel',
    BOMB: 'bomb',
    DIAMOND: 'diamond',
    REPAIR: 'repair',
    NITRO: 'nitro',
    ROCKET: 'rocket',
    LIFE: 'life',
};

// Pure weighted picker: walks the weight entries accumulating a cumulative
// threshold and returns the first bucket the roll (0..1) falls into. Weight
// keys are COLLECTIBLE_TYPES string values. Object.entries preserves the
// insertion order of string keys, so the cumulative walk is deterministic.
export function pickCollectibleType(roll, weights) {
    let cumulative = 0;
    for (const [type, weight] of Object.entries(weights)) {
        cumulative += weight;
        if (roll < cumulative) return type;
    }
    return COLLECTIBLE_TYPES.MONEY; // float-sum fallback
}

// Sprite frame + idle animation per pickup (pickups.png, see tools/art_sprites.py)
// `glow` tints the soft halo that lifts the pickup off the busy city ground
const PICKUP_ART = {
    [COLLECTIBLE_TYPES.MONEY]: { frame: PICKUP_FRAMES.coin, anim: 'coin-spin', glow: 0xffc933 },
    [COLLECTIBLE_TYPES.REPAIR]: { frame: PICKUP_FRAMES.repair, glow: 0x6fe08a },
    [COLLECTIBLE_TYPES.NITRO]: { frame: PICKUP_FRAMES.nitro, glow: 0x5fe0ff },
    [COLLECTIBLE_TYPES.ROCKET]: { frame: PICKUP_FRAMES.rocket, glow: 0xff9a3c },
    [COLLECTIBLE_TYPES.BOMB]: { frame: PICKUP_FRAMES.bomb, anim: 'bomb-fuse', glow: 0xff5040 },
    [COLLECTIBLE_TYPES.LIFE]: { frame: PICKUP_FRAMES.life, glow: 0xff6070 },
};

// Builds a collectible's sprite centred on (0, 0), unpositioned.
//
// Shared by the road pickups and the instructions screen so the icons the
// player is taught are literally the ones they'll see. `size` is the tile
// size the icon is drawn for: TILE_SIZE gives the in-game 32px sprite, and
// multiples of it keep the pixel art on whole-pixel scales.
export function createCollectibleIcon(scene, type, size = TILE_SIZE) {
    const art = PICKUP_ART[type];
    const sprite = art
        ? scene.add.sprite(0, 0, 'pickups', art.frame)
        : scene.add.sprite(0, 0, 'icons', ICON.fuel); // legacy FUEL pickup
    sprite.setScale(size / TILE_SIZE);
    if (art && art.anim) {
        // Desynchronise so a street full of coins doesn't spin in lockstep
        const frames = scene.anims.get(art.anim).frames.length;
        sprite.play({ key: art.anim, startFrame: Math.floor(Math.random() * frames) });
    }
    return sprite;
}

export class Collectible {
    constructor(scene, type, gridX, gridY) {
        this.scene = scene;
        this.type = type;
        this.gridX = gridX;
        this.gridY = gridY;

        const cx = gridX * TILE_SIZE + TILE_SIZE / 2;
        const cy = gridY * TILE_SIZE + TILE_SIZE / 2;

        // Contact shadow stays on the road while the pickup floats above it,
        // and a pulsing halo makes it pop against the streets
        this.shadow = scene.add.image(cx, cy + 14, 'shadow').setDepth(0.2);
        const tint = (PICKUP_ART[type] && PICKUP_ART[type].glow) || 0xffffff;
        this.halo = scene.add.image(cx, cy - 2, 'glow')
            .setBlendMode('ADD').setTint(tint).setScale(1.6).setAlpha(0.55).setDepth(0.25);
        this.visual = this.createVisual();
        this.visual.setPosition(cx, cy - 2).setDepth(0.3);

        // Pop in, then bob gently (shadow breathes in sync)
        this.visual.setScale(0);
        scene.tweens.add({ targets: this.visual, scale: 1, duration: 260, ease: 'Back.easeOut' });
        const phase = Math.random() * 600;
        scene.tweens.add({
            targets: this.visual, y: cy - 8, duration: 600, delay: phase,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        scene.tweens.add({
            targets: this.shadow, scaleX: 0.75, alpha: 0.6, duration: 600, delay: phase,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        scene.tweens.add({
            targets: this.halo, alpha: 0.25, scale: 1.3, duration: 600, delay: phase,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    createVisual() {
        return createCollectibleIcon(this.scene, this.type);
    }

    destroy() {
        this.visual.destroy();
        this.shadow.destroy();
        this.halo.destroy();
    }
}
