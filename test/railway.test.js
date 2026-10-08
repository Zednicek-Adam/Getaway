import { describe, it, expect } from 'vitest';
import { buildLoop, RailLine, TrainRun } from '../src/railway';
import { CONFIG } from '../src/config';

const cfg = CONFIG.TRAIN;

// Seeded LCG so crossing picks are reproducible
function seeded(seed = 1) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

describe('buildLoop', () => {
    it('is a closed cycle of orthogonal steps with no repeated cell', () => {
        const cells = buildLoop(50, 50, 9, 5);
        const keys = new Set(cells.map(c => `${c.x},${c.y}`));
        expect(keys.size).toBe(cells.length);
        cells.forEach((c, i) => {
            const n = cells[(i + 1) % cells.length];
            expect(Math.abs(n.x - c.x) + Math.abs(n.y - c.y)).toBe(1);
        });
    });

    it('stays inside the inset box', () => {
        for (const { x, y } of buildLoop(50, 50, 9, 5)) {
            expect(x).toBeGreaterThanOrEqual(9);
            expect(y).toBeGreaterThanOrEqual(9);
            expect(x).toBeLessThanOrEqual(40);
            expect(y).toBeLessThanOrEqual(40);
        }
    });
});

describe('RailLine', () => {
    const line = new RailLine(50, 50);

    it('measures straights as 1 tile and corner staircase cells as half a diagonal', () => {
        const straight = line.cells.findIndex((_, i) => line.isStraight(i));
        const diagonal = line.cells.findIndex((_, i) => !line.isStraight(i));
        expect(line.segLen[straight]).toBeCloseTo(1);
        expect(line.segLen[diagonal]).toBeCloseTo(Math.SQRT2 / 2);
        expect(line.arcLength).toBeCloseTo(line.segLen.reduce((a, b) => a + b, 0));
    });

    it('splits the map into inside and outside, with the spawn inside', () => {
        expect(line.sideOf(25, 25)).toBe('inside');
        expect(line.sideOf(0, 0)).toBe('outside');
        expect(line.sideOf(49, 25)).toBe('outside');
        const c = line.cells[0];
        expect(line.sideOf(c.x, c.y)).toBe('loop');
    });

    it('finds the cell at any arc length, wrapping round the loop', () => {
        for (let i = 0; i < line.length; i += 7) {
            expect(line.cellAtArc(line.arcMid(i))).toBe(i);
            expect(line.cellAtArc(line.arcMid(i) + line.arcLength * 3)).toBe(i);
            expect(line.cellAtArc(line.arcMid(i) - line.arcLength)).toBe(i);
        }
    });

    it('places the middle of a straight cell at the cell centre', () => {
        const i = line.cells.findIndex((_, k) => line.isStraight(k));
        const p = line.pointAtArc(line.arcMid(i));
        expect(p.x).toBeCloseTo(line.cells[i].x + 0.5);
        expect(p.y).toBeCloseTo(line.cells[i].y + 0.5);
    });

    it('moves continuously along the rails (no jumps between cells)', () => {
        let prev = line.pointAtArc(0);
        for (let s = 0.05; s <= line.arcLength; s += 0.05) {
            const p = line.pointAtArc(s);
            expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(0.051);
            prev = p;
        }
    });

    it('picks crossings on straights, clear of corners and spaced apart', () => {
        const crossings = line.pickCrossings(seeded(3));
        const [min, max] = cfg.CROSSINGS_PER_SIDE;
        expect(crossings.length).toBeGreaterThanOrEqual(min * 4);
        expect(crossings.length).toBeLessThanOrEqual(max * 4);
        for (const i of crossings) {
            for (let k = -cfg.CORNER_MARGIN; k <= cfg.CORNER_MARGIN; k++) {
                expect(line.isStraight(line.wrap(i + k))).toBe(true);
            }
        }
        const bySide = {};
        for (const i of crossings) (bySide[line.moves[i]] ||= []).push(i);
        for (const side of Object.values(bySide)) {
            for (let a = 0; a < side.length; a++) {
                for (let b = a + 1; b < side.length; b++) {
                    expect(Math.abs(side[a] - side[b])).toBeGreaterThanOrEqual(cfg.CROSSING_MIN_SPACING);
                }
            }
        }
    });

    it('gives every loop cell a 4-move signature', () => {
        for (let i = 0; i < line.length; i++) {
            expect(line.signature(i)).toMatch(/^[URDL]{4}$/);
        }
    });
});

describe('TrainRun', () => {
    const line = new RailLine(50, 50);
    const station = line.cells.findIndex((_, i) => line.axisAt(i) === 'H');

    it('advances one tile per MS_PER_TILE', () => {
        const run = new TrainRun(line, { cars: 6 });
        run.tick(cfg.MS_PER_TILE * 4);
        expect(run.head).toBeCloseTo(4);
    });

    it('stops with the bullion car (second) level with the platform cell', () => {
        const run = new TrainRun(line, { cars: 6, stationIndex: station, startArc: line.arcMid(station) - 5 });
        const events = run.tick(cfg.MS_PER_TILE * 20);
        expect(events).toContain('arrived');
        expect(run.moving).toBe(false);
        expect(line.cellAtArc(run.carArc(1))).toBe(station);
        expect(run.dwellRemaining).toBe(cfg.STATION_DWELL_MS);
    });

    it('opens the vault on every BULLION_EVERY-th lap', () => {
        const run = new TrainRun(line, { cars: 6, stationIndex: station, startArc: line.arcMid(station) - 1 });
        const lapMs = line.arcLength * cfg.MS_PER_TILE;
        const bullionLaps = [];
        for (let lap = 0; lap < 7; lap++) {
            // run to the next stop, then through the dwell
            run.tick(lapMs + 1);
            if (run.vaultOpen) bullionLaps.push(run.lap);
            const events = run.tick(run.dwellRemaining + 1);
            expect(events).toContain('departed');
        }
        expect(bullionLaps).toEqual([2, 5]);
        expect(cfg.BULLION_EVERY).toBe(3);
    });

    it('occupies a run of cells as long as the train', () => {
        const run = new TrainRun(line, { cars: 6, startArc: line.arcStart[40] + 0.5 });
        const cells = [...run.occupied()].sort((a, b) => a - b);
        expect(cells.length).toBeGreaterThanOrEqual(6);
        expect(cells.length).toBeLessThanOrEqual(9);
        expect(cells).toContain(40);
    });

    it('closes a crossing WARNING_MS before the nose arrives and opens it after the tail', () => {
        const i = 60;
        const run = new TrainRun(line, { cars: 6, startArc: line.arcStart[i] - 30 });
        expect(run.isClosed(i)).toBe(false);
        run.tick((30 - cfg.WARNING_MS / cfg.MS_PER_TILE + 0.5) * cfg.MS_PER_TILE);
        expect(run.isClosed(i)).toBe(true);
        run.tick(cfg.WARNING_MS);                       // nose on the crossing
        expect(run.occupied().has(i)).toBe(true);
        run.tick((6 + 2) * cfg.MS_PER_TILE);            // tail well past
        expect(run.isClosed(i)).toBe(false);
    });

    it('counts a station stop into the time until it reaches a crossing', () => {
        const run = new TrainRun(line, { cars: 6, stationIndex: station, startArc: line.arcMid(station) - 2 });
        const beyond = line.wrap(station + 10);
        const plain = new TrainRun(line, { cars: 6, startArc: line.arcMid(station) - 2 });
        expect(run.msUntilArrival(beyond) - plain.msUntilArrival(beyond)).toBeCloseTo(cfg.STATION_DWELL_MS);
    });
});
