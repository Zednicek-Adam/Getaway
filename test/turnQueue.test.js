import { describe, it, expect } from 'vitest';
import { TurnQueue, isOpposite, oppositeOf } from '../src/turnQueue';
import { DIRECTIONS } from '../src/constants';

describe('isOpposite', () => {
    it('matches the four opposite pairs and nothing else', () => {
        const { UP, DOWN, LEFT, RIGHT } = DIRECTIONS;
        const all = [UP, DOWN, LEFT, RIGHT];
        const opposite = { [UP]: DOWN, [DOWN]: UP, [LEFT]: RIGHT, [RIGHT]: LEFT };

        for (const d1 of all) {
            for (const d2 of all) {
                expect(isOpposite(d1, d2)).toBe(opposite[d1] === d2);
            }
        }
    });
});

describe('oppositeOf', () => {
    it('maps each direction to its reverse', () => {
        const { UP, DOWN, LEFT, RIGHT } = DIRECTIONS;
        expect(oppositeOf(UP)).toBe(DOWN);
        expect(oppositeOf(DOWN)).toBe(UP);
        expect(oppositeOf(LEFT)).toBe(RIGHT);
        expect(oppositeOf(RIGHT)).toBe(LEFT);
    });

    it('is consistent with isOpposite for every direction', () => {
        const all = Object.values(DIRECTIONS);
        for (const d of all) {
            expect(isOpposite(d, oppositeOf(d))).toBe(true);
        }
    });
});

describe('TurnQueue', () => {
    it('queues in FIFO order via peek/shift', () => {
        const q = new TurnQueue(3);
        expect(q.push(DIRECTIONS.UP)).toBe('queued');
        expect(q.push(DIRECTIONS.LEFT)).toBe('queued');

        expect(q.peek()).toBe(DIRECTIONS.UP);
        expect(q.shift()).toBe(DIRECTIONS.UP);
        expect(q.peek()).toBe(DIRECTIONS.LEFT);
        expect(q.shift()).toBe(DIRECTIONS.LEFT);
        expect(q.peek()).toBeUndefined();
        expect(q.length).toBe(0);
    });

    it('dedupes a consecutive repeat of the last queued direction', () => {
        const q = new TurnQueue(3);
        q.push(DIRECTIONS.UP);
        expect(q.push(DIRECTIONS.UP)).toBe('ignored');
        expect(q.toArray()).toEqual([DIRECTIONS.UP]);

        // Non-consecutive repeats are allowed (UP, LEFT, UP)
        q.push(DIRECTIONS.LEFT);
        expect(q.push(DIRECTIONS.UP)).toBe('queued');
        expect(q.toArray()).toEqual([DIRECTIONS.UP, DIRECTIONS.LEFT, DIRECTIONS.UP]);
    });

    it('pops the last entry when the opposite direction is pushed (undo)', () => {
        const q = new TurnQueue(3);
        q.push(DIRECTIONS.UP);
        expect(q.push(DIRECTIONS.DOWN)).toBe('cancelled');
        expect(q.length).toBe(0);

        // Undo only removes the last item, earlier entries stay
        q.push(DIRECTIONS.LEFT);
        q.push(DIRECTIONS.UP);
        expect(q.push(DIRECTIONS.DOWN)).toBe('cancelled');
        expect(q.toArray()).toEqual([DIRECTIONS.LEFT]);
    });

    it('caps at max and reports full', () => {
        const q = new TurnQueue(3);
        q.push(DIRECTIONS.UP);
        q.push(DIRECTIONS.LEFT);
        q.push(DIRECTIONS.DOWN);
        expect(q.length).toBe(3);
        expect(q.push(DIRECTIONS.RIGHT)).toBe('full');
        expect(q.toArray()).toEqual([DIRECTIONS.UP, DIRECTIONS.LEFT, DIRECTIONS.DOWN]);
    });

    it('clear empties the queue', () => {
        const q = new TurnQueue(3);
        q.push(DIRECTIONS.UP);
        q.push(DIRECTIONS.LEFT);
        q.clear();
        expect(q.length).toBe(0);
        expect(q.peek()).toBeUndefined();
        expect(q.toArray()).toEqual([]);
    });

    it('toArray returns a copy, not the internal array', () => {
        const q = new TurnQueue(3);
        q.push(DIRECTIONS.UP);
        const arr = q.toArray();
        arr.push(DIRECTIONS.DOWN);
        expect(q.length).toBe(1);
    });
});
