import { DIRECTIONS } from './constants';

// Shared direction helper (moved from Car.isOpposite)
export function isOpposite(dir1, dir2) {
    return (dir1 === DIRECTIONS.UP && dir2 === DIRECTIONS.DOWN) ||
        (dir1 === DIRECTIONS.DOWN && dir2 === DIRECTIONS.UP) ||
        (dir1 === DIRECTIONS.LEFT && dir2 === DIRECTIONS.RIGHT) ||
        (dir1 === DIRECTIONS.RIGHT && dir2 === DIRECTIONS.LEFT);
}

// Reverse of a direction (UP↔DOWN, LEFT↔RIGHT). Pure helper.
export function oppositeOf(dir) {
    switch (dir) {
        case DIRECTIONS.UP: return DIRECTIONS.DOWN;
        case DIRECTIONS.DOWN: return DIRECTIONS.UP;
        case DIRECTIONS.LEFT: return DIRECTIONS.RIGHT;
        case DIRECTIONS.RIGHT: return DIRECTIONS.LEFT;
        default: return dir;
    }
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

// Direction a car takes when it stands on a tile boundary. `canMove(dir)`
// reports whether the neighbouring tile that way is open.
//   - The front queued turn fires as soon as the road allows it (consumed).
//   - If it can't be taken here but straight ahead is open, the car carries
//     on and the turn waits for a junction that has that road — side roads
//     going the other way don't cancel it.
//   - Only when straight ahead is closed as well (the car would stop) is an
//     untakeable turn discarded, so a stale press can't swallow the next key;
//     the following queued turn is then tried.
//   - A turn that now points back the way the car came (the rails or a trail
//     bend swung it round since the press) is discarded too: reversing takes
//     a direct press.
// Returns the direction to move, or null to stay put. Mutates `queue`.
export function pickMove(queue, direction, canMove) {
    while (queue.length > 0) {
        const front = queue.peek();
        if (isOpposite(front, direction)) {
            queue.shift();
            continue;
        }
        if (canMove(front)) {
            queue.shift();
            return front;
        }
        if (canMove(direction)) return direction;
        queue.shift();
    }
    return canMove(direction) ? direction : null;
}
