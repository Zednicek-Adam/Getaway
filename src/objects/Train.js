import { TILE_SIZE } from '../constants';
import { TRAIN_CARS } from '../art';
import { smokePuff } from '../fx';

// heading 0-7, clockwise from facing up, from a direction of travel
export function headingOf(dx, dy) {
    const angle = Math.atan2(dx, -dy);
    return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

// The train's sprites. All the logic lives in TrainRun (src/railway.js); this
// just places one sprite per car along the loop each frame. Depth 1.2 keeps
// the train over cars (1) and under the helicopter (5).
export class Train {
    constructor(scene, run, kinds) {
        this.scene = scene;
        this.run = run;
        this.kinds = kinds;
        this.sprites = kinds.map(() => scene.add.sprite(0, 0, 'train', 0).setDepth(1.2));
        this.smokeTimer = 0;
        this.update(0);
    }

    update(delta) {
        const line = this.run.line;
        this.kinds.forEach((kind, k) => {
            const p = line.pointAtArc(this.run.carArc(k));
            const shown = kind === 'bullion' && this.run.vaultOpen ? 'bullionOpen' : kind;
            this.sprites[k]
                .setPosition(p.x * TILE_SIZE, p.y * TILE_SIZE)
                .setFrame(TRAIN_CARS.indexOf(shown) * 8 + headingOf(p.dx, p.dy));
        });

        // Exhaust from the locomotive's stacks while it's under way
        this.smokeTimer += delta;
        if (this.run.moving && this.smokeTimer >= 260) {
            this.smokeTimer = 0;
            const p = line.pointAtArc(this.run.carArc(0) - 0.2);
            smokePuff(this.scene, p.x * TILE_SIZE, p.y * TILE_SIZE,
                { drift: 18, scale: 1.1, depth: 1.25, tint: 0x9a9aa4 });
        }
    }

    // Pixel position of car k's middle (for effects)
    carPosition(k) {
        const p = this.run.line.pointAtArc(this.run.carArc(k));
        return { x: p.x * TILE_SIZE, y: p.y * TILE_SIZE };
    }

    destroy() {
        this.sprites.forEach(s => s.destroy());
    }
}
