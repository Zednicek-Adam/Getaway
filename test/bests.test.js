import { describe, it, expect } from 'vitest';
import {
    BEST_STATS, newRunStats, summarizeRun, defaultBests, sanitizeBests, recordBests, formatDuration,
    TOP_RUNS, sanitizeTopRuns, recordTopRun,
} from '../src/bests';

describe('bests', () => {
    it('keeps a best for every stat on the summary panel', () => {
        expect(Object.keys(defaultBests())).toEqual(BEST_STATS.map(s => s.key));
        expect(Object.values(defaultBests()).every(v => v === 0)).toBe(true);
    });

    it('summarizes a run in dollars, counts and whole seconds', () => {
        const run = {
            ...newRunStats(),
            banked: 2500, biggestDeposit: 1500,
            longestChaseMs: 61999, fiveStarMs: 999,
            policeDestroyed: 4, diamondsStolen: 1, survivedMs: 125400,
        };
        expect(summarizeRun(run)).toEqual({
            banked: 2500, biggestDeposit: 1500,
            longestChase: 61, timeAtFiveStars: 0,
            policeDestroyed: 4, diamondsStolen: 1, timeSurvived: 125,
        });
    });

    it('a fresh run summarizes to all zeroes', () => {
        expect(summarizeRun(newRunStats())).toEqual(defaultBests());
    });

    describe('sanitizeBests', () => {
        it('missing or malformed → all zeroes', () => {
            expect(sanitizeBests(undefined)).toEqual(defaultBests());
            expect(sanitizeBests('nope')).toEqual(defaultBests());
            expect(sanitizeBests(null)).toEqual(defaultBests());
        });

        it('floors, drops negatives / junk, fills gaps, drops unknown keys', () => {
            const clean = sanitizeBests({ banked: 99.9, biggestDeposit: -5, longestChase: 'x', bogus: 7 });
            expect(clean).toEqual({ ...defaultBests(), banked: 99 });
            expect('bogus' in clean).toBe(false);
        });
    });

    describe('recordBests', () => {
        it('raises only the records the run beat and names them', () => {
            const bests = { ...defaultBests(), banked: 1000, policeDestroyed: 3, timeSurvived: 200 };
            const summary = { ...defaultBests(), banked: 1500, policeDestroyed: 2, timeSurvived: 90 };
            const result = recordBests(bests, summary);
            expect(result.bests).toEqual({ ...bests, banked: 1500 });
            expect(result.newBests).toEqual(['banked']);
        });

        it('a tie is not a new best', () => {
            const bests = { ...defaultBests(), diamondsStolen: 2 };
            const result = recordBests(bests, { ...defaultBests(), diamondsStolen: 2 });
            expect(result.newBests).toEqual([]);
        });

        it('on a first run every non-zero stat is a new best', () => {
            const result = recordBests(defaultBests(), { ...defaultBests(), timeSurvived: 42 });
            expect(result.newBests).toEqual(['timeSurvived']);
        });

        it('does not mutate the bests it was given', () => {
            const bests = defaultBests();
            recordBests(bests, { ...defaultBests(), banked: 500 });
            expect(bests.banked).toBe(0);
        });

        it('reads bests missing from an old save as zero', () => {
            const result = recordBests(undefined, { ...defaultBests(), banked: 10 });
            expect(result.bests.banked).toBe(10);
            expect(result.newBests).toEqual(['banked']);
        });
    });

    it('formats seconds as m:ss', () => {
        expect(formatDuration(0)).toBe('0:00');
        expect(formatDuration(9)).toBe('0:09');
        expect(formatDuration(65)).toBe('1:05');
        expect(formatDuration(3725)).toBe('62:05');
        expect(formatDuration(-3)).toBe('0:00');
    });
});

describe('top runs', () => {
    const run = (banked, extra = {}) => ({ ...defaultBests(), banked, ...extra });

    it('files runs best first and says where each landed', () => {
        let list = [];
        let rank;
        ({ topRuns: list, rank } = recordTopRun(list, run(500)));
        expect(rank).toBe(1);
        ({ topRuns: list, rank } = recordTopRun(list, run(2000)));
        expect(rank).toBe(1);
        ({ topRuns: list, rank } = recordTopRun(list, run(800)));
        expect(rank).toBe(2);
        expect(list.map(r => r.banked)).toEqual([2000, 800, 500]);
    });

    it('keeps the whole run, not just the money', () => {
        const { topRuns } = recordTopRun([], run(900, { policeDestroyed: 4, timeSurvived: 75 }));
        expect(topRuns[0]).toEqual(run(900, { policeDestroyed: 4, timeSurvived: 75 }));
    });

    it('keeps only the top five and turns away a run below them', () => {
        const full = [900, 800, 700, 600, 500].map(b => run(b));
        const pushed = recordTopRun(full, run(650));
        expect(pushed.rank).toBe(4);
        expect(pushed.topRuns.map(r => r.banked)).toEqual([900, 800, 700, 650, 600]);

        const missed = recordTopRun(full, run(400));
        expect(missed.rank).toBeNull();
        expect(missed.topRuns.map(r => r.banked)).toEqual([900, 800, 700, 600, 500]);
    });

    it('a tie goes to the run that set it first', () => {
        const first = run(700, { timeSurvived: 1 });
        const { topRuns, rank } = recordTopRun([first], run(700, { timeSurvived: 2 }));
        expect(rank).toBe(2);
        expect(topRuns[0].timeSurvived).toBe(1);
    });

    it('a run that banked nothing never makes the list', () => {
        const { topRuns, rank } = recordTopRun([], run(0, { timeSurvived: 300 }));
        expect(rank).toBeNull();
        expect(topRuns).toEqual([]);
    });

    it('does not mutate the list it was given', () => {
        const list = [run(100)];
        recordTopRun(list, run(200));
        expect(list).toHaveLength(1);
    });

    it('sanitizes a stored list: junk out, sorted, capped', () => {
        expect(sanitizeTopRuns(undefined)).toEqual([]);
        expect(sanitizeTopRuns({ banked: 5 })).toEqual([]);
        const clean = sanitizeTopRuns([run(100), 'junk', null, run(0), run(300), run(200),
            run(50), run(400), run(250)]);
        expect(clean.map(r => r.banked)).toEqual([400, 300, 250, 200, 100]);
        expect(clean.length).toBe(TOP_RUNS);
    });
});
