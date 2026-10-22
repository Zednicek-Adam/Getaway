import { describe, it, expect } from 'vitest';
import { findPath, MinHeap, nextStep } from '../src/pathfinding';

// 1 = walkable, 0 = blocked
function walkabilityOf(grid) {
    return (x, y) => grid[y]?.[x] === 1;
}

describe('MinHeap', () => {
    it('pops nodes in ascending f order', () => {
        const heap = new MinHeap();
        const values = [5, 3, 8, 1, 9, 2, 7];
        values.forEach(f => heap.push({ f }));

        const popped = [];
        while (heap.size > 0) {
            popped.push(heap.pop().f);
        }
        expect(popped).toEqual([1, 2, 3, 5, 7, 8, 9]);
    });

    it('returns null when empty', () => {
        const heap = new MinHeap();
        expect(heap.pop()).toBeNull();
    });
});

describe('findPath', () => {
    it('finds the shortest path with correct endpoints', () => {
        const grid = [
            [1, 1, 1, 1],
            [1, 0, 0, 1],
            [1, 1, 1, 1],
        ];
        const path = findPath(walkabilityOf(grid), 0, 0, 3, 2);

        // Manhattan distance is 5 and the grid allows it — path excludes start
        expect(path).not.toBeNull();
        expect(path.length).toBe(5);
        expect(path[path.length - 1]).toEqual({ x: 3, y: 2 });

        // First step must be adjacent to the start tile
        const first = path[0];
        expect(Math.abs(first.x - 0) + Math.abs(first.y - 0)).toBe(1);

        // Every step must be walkable and adjacent to the previous one
        let prev = { x: 0, y: 0 };
        for (const step of path) {
            expect(grid[step.y][step.x]).toBe(1);
            expect(Math.abs(step.x - prev.x) + Math.abs(step.y - prev.y)).toBe(1);
            prev = step;
        }
    });

    it('routes around obstacles (longer than manhattan distance)', () => {
        const grid = [
            [1, 0, 1],
            [1, 0, 1],
            [1, 1, 1],
        ];
        const path = findPath(walkabilityOf(grid), 0, 0, 2, 0);
        expect(path).not.toBeNull();
        expect(path.length).toBe(6); // down 2, right 2, up 2
        expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
    });

    it('returns an empty path when start equals end', () => {
        const grid = [[1]];
        const path = findPath(walkabilityOf(grid), 0, 0, 0, 0);
        expect(path).toEqual([]);
    });

    it('returns null when the target is unreachable', () => {
        const grid = [
            [1, 0, 1],
            [1, 0, 1],
            [1, 0, 1],
        ];
        const path = findPath(walkabilityOf(grid), 0, 0, 2, 0);
        expect(path).toBeNull();
    });

    it('returns null when the maxNodes cap is exhausted', () => {
        // Large open grid, corner to corner, tiny node budget
        const size = 20;
        const grid = Array.from({ length: size }, () => Array(size).fill(1));
        const path = findPath(walkabilityOf(grid), 0, 0, size - 1, size - 1, { maxNodes: 3 });
        expect(path).toBeNull();
    });
});

describe('nextStep', () => {
    // 3x3 ring round a single building
    const smallRing = [
        [1, 1, 1],
        [1, 0, 1],
        [1, 1, 1],
    ];
    // 5x5 ring round a 3x3 block
    const bigRing = [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1],
    ];

    it('takes the shortest route when it does not turn back', () => {
        const step = nextStep(walkabilityOf(bigRing), 2, 0, { x: 1, y: 0 }, 4, 2, { uturnPenalty: 6 });
        expect(step).toEqual({ x: 3, y: 0 });
    });

    it('drives round the block when that costs no more than the penalty', () => {
        // Back via (0,0) is 2 tiles, round the block is 6
        const step = nextStep(walkabilityOf(smallRing), 1, 0, { x: 0, y: 0 }, 0, 1, { uturnPenalty: 6 });
        expect(step).toEqual({ x: 2, y: 0 });
    });

    it('turns back when the way round is longer than the penalty', () => {
        // Back is 2 tiles, round the block is 14
        const step = nextStep(walkabilityOf(bigRing), 2, 0, { x: 1, y: 0 }, 0, 0, { uturnPenalty: 6 });
        expect(step).toEqual({ x: 1, y: 0 });
    });

    it('turns back out of a dead end', () => {
        const corridor = [[1, 1, 1]];
        const step = nextStep(walkabilityOf(corridor), 2, 0, { x: 1, y: 0 }, 0, 0, { uturnPenalty: 6 });
        expect(step).toEqual({ x: 1, y: 0 });
    });

    it('returns null when already at the goal or the goal is unreachable', () => {
        expect(nextStep(walkabilityOf(smallRing), 0, 0, null, 0, 0)).toBeNull();
        expect(nextStep(walkabilityOf(smallRing), 0, 0, null, 1, 1)).toBeNull();
    });

    it('replanning every tile reaches the goal without revisiting a tile', () => {
        // Roads on rows and columns 0, 3 and 6: a 2x2 grid of blocks
        const grid = Array.from({ length: 7 }, (_, y) =>
            Array.from({ length: 7 }, (_, x) => (x % 3 === 0 || y % 3 === 0 ? 1 : 0)));
        const walkable = walkabilityOf(grid);

        let pos = { x: 3, y: 0 };
        let behind = { x: 2, y: 0 };
        const goal = { x: 0, y: 3 };
        const visited = new Set([`${pos.x},${pos.y}`]);

        for (let i = 0; i < 30 && !(pos.x === goal.x && pos.y === goal.y); i++) {
            const step = nextStep(walkable, pos.x, pos.y, behind, goal.x, goal.y, { uturnPenalty: 6 });
            expect(step).not.toBeNull();
            const key = `${step.x},${step.y}`;
            expect(visited.has(key)).toBe(false);
            visited.add(key);
            behind = pos;
            pos = step;
        }
        expect(pos).toEqual(goal);
    });
});
