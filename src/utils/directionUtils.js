import { DIRECTIONS } from '../constants';

/**
 * Returns the x and y delta for a given direction.
 * @param {number} dir - One of DIRECTIONS constants.
 * @returns {{dx: number, dy: number}}
 */
export function getDirDelta(dir) {
    switch (dir) {
        case DIRECTIONS.UP: return { dx: 0, dy: -1 };
        case DIRECTIONS.DOWN: return { dx: 0, dy: 1 };
        case DIRECTIONS.LEFT: return { dx: -1, dy: 0 };
        case DIRECTIONS.RIGHT: return { dx: 1, dy: 0 };
        default: return { dx: 0, dy: 0 };
    }
}

/**
 * Returns the rotation angle in radians for a given direction.
 * @param {number} dir - One of DIRECTIONS constants.
 * @returns {number}
 */
export function getDirAngle(dir) {
    switch (dir) {
        case DIRECTIONS.RIGHT: return 0;
        case DIRECTIONS.DOWN: return Math.PI / 2;
        case DIRECTIONS.LEFT: return Math.PI;
        case DIRECTIONS.UP: return -Math.PI / 2;
        default: return 0;
    }
}

/**
 * Checks if two directions are opposites.
 * @param {number} dir1
 * @param {number} dir2
 * @returns {boolean}
 */
export function isOpposite(dir1, dir2) {
    return (dir1 === DIRECTIONS.UP && dir2 === DIRECTIONS.DOWN) ||
           (dir1 === DIRECTIONS.DOWN && dir2 === DIRECTIONS.UP) ||
           (dir1 === DIRECTIONS.LEFT && dir2 === DIRECTIONS.RIGHT) ||
           (dir1 === DIRECTIONS.RIGHT && dir2 === DIRECTIONS.LEFT);
}

/**
 * Returns the direction corresponding to the given dx and dy deltas.
 * @param {number} dx
 * @param {number} dy
 * @returns {number|null}
 */
export function getDirectionFromDelta(dx, dy) {
    if (dx > 0) return DIRECTIONS.RIGHT;
    if (dx < 0) return DIRECTIONS.LEFT;
    if (dy > 0) return DIRECTIONS.DOWN;
    if (dy < 0) return DIRECTIONS.UP;
    return null;
}
