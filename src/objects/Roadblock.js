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

        this.shapes = [];

        // Gray base barrier
        const base = scene.add.rectangle(cx, cy, TILE_SIZE * 0.8, TILE_SIZE * 0.5, 0x555555)
            .setStrokeStyle(2, 0x222222)
            .setDepth(0.7);
        this.shapes.push(base);

        // Orange diagonal warning stripes
        const stripeCount = 3;
        const spacing = TILE_SIZE * 0.22;
        for (let i = 0; i < stripeCount; i++) {
            const offset = (i - (stripeCount - 1) / 2) * spacing;
            const stripe = scene.add.rectangle(cx + offset, cy, TILE_SIZE * 0.1, TILE_SIZE * 0.5, 0xFF8800)
                .setDepth(0.71);
            stripe.rotation = Math.PI / 4;
            this.shapes.push(stripe);
        }
    }

    destroy() {
        for (const shape of this.shapes) shape.destroy();
        this.shapes = [];
    }
}
