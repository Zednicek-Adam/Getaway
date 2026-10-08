import { TILE_SIZE } from '../constants';

// Barrier arms and flashing lamps on one level crossing. Purely visual — the
// routing side is MapManager.trainBlocked (set by RailManager). Depth 0.7
// matches roadblocks: above the road and pickups, below cars.
export class LevelCrossing {
    // axis: the track's direction through the crossing ('H' or 'V')
    constructor(scene, cell, axis) {
        this.cell = cell;
        this.axis = axis;
        this.closed = false;
        this.upFrame = axis === 'H' ? 0 : 3;
        this.sprite = scene.add.sprite(
            cell.x * TILE_SIZE + TILE_SIZE / 2, cell.y * TILE_SIZE + TILE_SIZE / 2, 'crossing', this.upFrame)
            .setDepth(0.7);
    }

    setClosed(closed) {
        if (closed === this.closed) return;
        this.closed = closed;
        if (closed) {
            this.sprite.play(this.axis === 'H' ? 'crossing-h' : 'crossing-v');
        } else {
            this.sprite.stop();
            this.sprite.setFrame(this.upFrame);
        }
    }

    destroy() {
        this.sprite.destroy();
    }
}
