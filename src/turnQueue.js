import { DIRECTIONS } from './constants';

// Shared direction helper (moved from Car.isOpposite)
export function isOpposite(dir1, dir2) {
    return (dir1 === DIRECTIONS.UP && dir2 === DIRECTIONS.DOWN) ||
        (dir1 === DIRECTIONS.DOWN && dir2 === DIRECTIONS.UP) ||
        (dir1 === DIRECTIONS.LEFT && dir2 === DIRECTIONS.RIGHT) ||
        (dir1 === DIRECTIONS.RIGHT && dir2 === DIRECTIONS.LEFT);
}

// FIFO queue of upcoming turns (pure JS, no Phaser — unit-testable).
// Push rules:
//   - same direction as the last queued item → ignored (dedupe)
//   - opposite of the last queued item → pops it (undo semantics)
//   - queue at capacity → rejected
export class TurnQueue {
    constructor(max) {
        this.max = max;
        this.items = [];
    }

    push(dir) {
        const last = this.items[this.items.length - 1];

        if (last !== undefined) {
            if (dir === last) return 'ignored';
            if (isOpposite(dir, last)) {
                this.items.pop();
                return 'cancelled';
            }
        }

        if (this.items.length < this.max) {
            this.items.push(dir);
            return 'queued';
        }

        return 'full';
    }

    peek() {
        return this.items[0];
    }

    shift() {
        return this.items.shift();
    }

    clear() {
        this.items.length = 0;
    }

    get length() {
        return this.items.length;
    }

    toArray() {
        return this.items.slice();
    }
}
