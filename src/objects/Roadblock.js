import { TILE_SIZE } from '../constants';

// A police roadblock sitting on a road tile. Purely visual — the routing logic
// lives in MapManager.blocked (set/cleared by PoliceManager). Depth 0.7 keeps
// it above laid bombs (<= 0.6) and below cars (1).
export class Roadblock {
    constructor(scene, gridX, gridY) {
        this.scene = scene;
        this.gridX = gridX;
        this.gridY = gridY;

        const cx = gridX * TILE_SIZE + TILE_SIZE / 2;
        const cy = gridY * TILE_SIZE + TILE_SIZE / 2;

        // Barricade spans across the road: pick the orientation from the road
        // the tile belongs to (roadblocks always sit on straights ahead of the
        // player, but fall back to "across a vertical road" at junctions)
        const map = scene.mapManager;
        const horizontalRoad = !!map &&
            (map.isRoad(gridX - 1, gridY) || map.isRoad(gridX + 1, gridY)) &&
            !(map.isRoad(gridX, gridY - 1) || map.isRoad(gridX, gridY + 1));

        this.glow = scene.add.image(cx, cy, 'glow')
            .setBlendMode('ADD').setTint(0xffb020).setScale(2.4).setAlpha(0.35).setDepth(0.69);
        this.sprite = scene.add.sprite(cx, cy, 'roadblock', horizontalRoad ? 2 : 0).setDepth(0.7);
        this.sprite.play(horizontalRoad ? 'roadblock-h' : 'roadblock-v');

        // Slam down into place
        this.sprite.setScale(1.5).setAlpha(0);
        scene.tweens.add({ targets: this.sprite, scale: 1, alpha: 1, duration: 260, ease: 'Bounce.easeOut' });
        this.pulse = scene.tweens.add({
            targets: this.glow, alpha: 0.12, duration: 330, yoyo: true, repeat: -1,
        });
    }

    destroy() {
        this.pulse.stop();
        this.sprite.destroy();
        this.glow.destroy();
    }
}
