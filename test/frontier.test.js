import { describe, it, expect } from 'vitest';
import { RailLine } from '../src/railway';
import { FrontierGenerator, findPath } from '../src/generators/FrontierGenerator';

// Small deterministic PRNG so maps are reproducible in tests
function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const SIZE = 50;
const line = new RailLine(SIZE, SIZE);

function plan(seed) {
    const rand = seeded(seed);
    for (let i = 0; i < 20; i++) {
        const p = new FrontierGenerator(SIZE, SIZE, line, { rand }).generate();
        if (p) return p;
    }
    throw new Error(`seed ${seed} never produced a map`);
}

const PLANS = Array.from({ length: 12 }, (_, i) => plan(i * 101 + 7));
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function roadAt(p) {
    return (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && p.grid[y][x] !== 0;
}

describe('findPath', () => {
    it('finds the cheapest way round a wall', () => {
        const wall = (x, y) => x === 3 && y < 4;
        const path = findPath(6, 6, { x: 1, y: 1 }, { x: 5, y: 1 }, {
            enter: (x, y) => (wall(x, y) ? Infinity : 1), minStep: 1,
        });
        expect(path[0]).toEqual({ x: 1, y: 1 });
        expect(path[path.length - 1]).toEqual({ x: 5, y: 1 });
        expect(path.some(c => wall(c.x, c.y))).toBe(false);
        path.slice(1).forEach((c, k) => {
            expect(Math.abs(c.x - path[k].x) + Math.abs(c.y - path[k].y)).toBe(1);
        });
    });

    it('returns null when the goal is walled off', () => {
        expect(findPath(4, 4, { x: 0, y: 0 }, { x: 3, y: 3 }, { enter: (x) => (x === 2 ? Infinity : 1) })).toBeNull();
    });
});

describe('FrontierGenerator', () => {
    it('lays one connected network with the hideout lane as its only dead end', () => {
        for (const p of PLANS) {
            const isRoad = roadAt(p);
            expect(isRoad(p.spawn.x, p.spawn.y)).toBe(true);
            const seen = new Set([`${p.spawn.x},${p.spawn.y}`]);
            const stack = [p.spawn];
            while (stack.length) {
                const { x, y } = stack.pop();
                for (const [dx, dy] of DIRS) {
                    const k = `${x + dx},${y + dy}`;
                    if (isRoad(x + dx, y + dy) && !seen.has(k)) {
                        seen.add(k);
                        stack.push({ x: x + dx, y: y + dy });
                    }
                }
            }
            for (let y = 0; y < SIZE; y++) {
                for (let x = 0; x < SIZE; x++) {
                    if (!isRoad(x, y)) continue;
                    expect(seen.has(`${x},${y}`)).toBe(true);
                    const n = DIRS.filter(([dx, dy]) => isRoad(x + dx, y + dy)).length;
                    if (x !== p.spawn.x || y !== p.spawn.y) expect(n).toBeGreaterThanOrEqual(2);
                }
            }
        }
    });

    it('puts the town against the bottom of the loop, Front Street along the tracks', () => {
        for (const p of PLANS) {
            const isRoad = roadAt(p);
            const { town } = p;
            const bottom = Math.max(...line.cells.map(c => c.y));
            expect(town.fy).toBe(bottom - 1);
            for (let x = town.x0; x <= town.x1; x++) expect(line.has(x, town.fy + 1)).toBe(true);
            expect(town.rows[0]).toBe(town.fy);
            // the hideout lane comes off the top street, its lot behind it
            expect(p.spawn.y).toBe(town.y0 - 1);
            expect(isRoad(p.spawn.x, town.y0)).toBe(true);
            expect(isRoad(p.spawn.x, p.spawn.y - 1)).toBe(false);
        }
    });

    it('runs the river edge to edge, over trestles on the loop and never through town', () => {
        for (const p of PLANS) {
            const { river, town } = p;
            const first = river[0];
            const last = river[river.length - 1];
            const onEdge = c => c.x === 0 || c.y === 0 || c.x === SIZE - 1 || c.y === SIZE - 1;
            expect(onEdge(first) && onEdge(last)).toBe(true);
            const at = new Map(river.map((c, k) => [`${c.x},${c.y}`, k]));
            expect(at.size).toBe(river.length);
            river.forEach((c, k) => {
                if (k > 0) expect(Math.abs(c.x - river[k - 1].x) + Math.abs(c.y - river[k - 1].y)).toBe(1);
                // the river never touches itself except where it flows on
                for (const [dx, dy] of DIRS) {
                    const j = at.get(`${c.x + dx},${c.y + dy}`);
                    if (j !== undefined) expect(Math.abs(j - k)).toBe(1);
                }
                expect(c.x >= town.x0 && c.x <= town.x1 && c.y >= town.yN && c.y <= town.fy).toBe(false);
            });
            const onTrack = river.filter(c => line.has(c.x, c.y)).map(c => line.indexOf(c.x, c.y));
            expect(onTrack.sort()).toEqual([...p.trestles].sort());
            for (const i of p.trestles) expect(line.axisAt(i)).not.toBeNull();
        }
    });

    it('bridges the river square on, and keeps roads off it everywhere else', () => {
        for (const p of PLANS) {
            const isRoad = roadAt(p);
            const bridges = new Set(p.bridges.map(b => `${b.x},${b.y}`));
            for (const c of p.river) {
                expect(isRoad(c.x, c.y)).toBe(bridges.has(`${c.x},${c.y}`));
            }
            for (const b of p.bridges) {
                const across = b.axis === 'V' ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
                const along = b.axis === 'V' ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
                for (const [dx, dy] of across) expect(isRoad(b.x + dx, b.y + dy)).toBe(true);
                for (const [dx, dy] of along) expect(isRoad(b.x + dx, b.y + dy)).toBe(false);
            }
        }
    });

    it('keeps roads off the mountains and mesas, and mountains off the track', () => {
        for (const p of PLANS) {
            const isRoad = roadAt(p);
            for (const s of p.scenery) {
                for (let y = s.y; y < s.y + s.h; y++) {
                    for (let x = s.x; x < s.x + s.w; x++) {
                        expect(isRoad(x, y)).toBe(false);
                        expect(line.has(x, y)).toBe(false);
                    }
                }
            }
            expect(p.scenery.some(s => s.kind === 'peak')).toBe(true);
        }
    });

    it('only crosses the track at level crossings, square across it', () => {
        for (const p of PLANS) {
            const isRoad = roadAt(p);
            expect(p.crossings.length).toBeGreaterThanOrEqual(5);
            line.cells.forEach(({ x, y }, i) => expect(isRoad(x, y)).toBe(p.crossings.includes(i)));
            for (const i of p.crossings) {
                const { x, y } = line.cells[i];
                const across = line.axisAt(i) === 'H' ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]];
                for (const [ax, ay] of across) expect(isRoad(ax, ay)).toBe(true);
                expect(p.trestles.includes(i)).toBe(false);
            }
        }
    });

    it('never paves a 2x2 square', () => {
        for (const p of PLANS) {
            const isRoad = roadAt(p);
            for (let y = 0; y < SIZE - 1; y++) {
                for (let x = 0; x < SIZE - 1; x++) {
                    expect(isRoad(x, y) && isRoad(x + 1, y) && isRoad(x, y + 1) && isRoad(x + 1, y + 1)).toBe(false);
                }
            }
        }
    });

    it('reaches out into the range on both sides of the loop', () => {
        for (const p of PLANS) {
            const isRoad = roadAt(p);
            let inside = 0;
            let outside = 0;
            for (let y = 0; y < SIZE; y++) {
                for (let x = 0; x < SIZE; x++) {
                    if (!isRoad(x, y)) continue;
                    const t = p.town;
                    if (x >= t.x0 && x <= t.x1 && y >= t.yN && y <= t.fy) continue;
                    if (line.sideOf(x, y) === 'inside') inside++;
                    else if (line.sideOf(x, y) === 'outside') outside++;
                }
            }
            expect(inside).toBeGreaterThan(30);
            expect(outside).toBeGreaterThan(80);
        }
    });
});
