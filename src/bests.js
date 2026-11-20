// Run summary and personal bests (issue #17, idea 1). Pure and Phaser-free.
//
// GameState counts a run as it goes (newRunStats). When the run ends,
// summarizeRun turns those counters into the whole numbers the game-over
// panel shows, and recordBests folds them into the save's `bests`.

// The order here is the order of the rows on the game-over panel. `kind`
// picks the formatting: dollars, a m:ss time, or a plain count.
export const BEST_STATS = [
    { key: 'banked', kind: 'money' },
    { key: 'biggestDeposit', kind: 'money' },
    { key: 'longestChase', kind: 'time' },
    { key: 'timeAtFiveStars', kind: 'time' },
    { key: 'policeDestroyed', kind: 'count' },
    { key: 'diamondsStolen', kind: 'count' },
    { key: 'timeSurvived', kind: 'time' },
];

// Counters for one run. Times are in ms; summarizeRun rounds them down to
// whole seconds.
export function newRunStats() {
    return {
        banked: 0,          // every deposit this run, added up
        biggestDeposit: 0,  // the largest single deposit
        chaseMs: 0,         // the chase running now (0 when not wanted)
        longestChaseMs: 0,  // longest unbroken stretch at 1 star or more
        fiveStarMs: 0,      // all the time spent at 5 stars
        policeDestroyed: 0, // police and SWAT units blown up
        diamondsStolen: 0,  // diamond cars rammed
        survivedMs: 0,      // time played, pauses and the garage excluded
    };
}

// The run's counters as the whole numbers bests are kept in: dollars, counts
// and seconds. Comparing whole seconds means a record only falls when the
// clock on the panel shows a bigger number.
export function summarizeRun(run) {
    const seconds = (ms) => Math.floor(ms / 1000);
    return {
        banked: run.banked,
        biggestDeposit: run.biggestDeposit,
        longestChase: seconds(run.longestChaseMs),
        timeAtFiveStars: seconds(run.fiveStarMs),
        policeDestroyed: run.policeDestroyed,
        diamondsStolen: run.diamondsStolen,
        timeSurvived: seconds(run.survivedMs),
    };
}

export function defaultBests() {
    return Object.fromEntries(BEST_STATS.map(({ key }) => [key, 0]));
}

// Coerce a raw (possibly untrusted, or missing in an older save) value into
// clean bests: every known key a non-negative whole number, missing → 0,
// unknown keys dropped.
export function sanitizeBests(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const clean = defaultBests();
    for (const { key } of BEST_STATS) {
        const value = Math.floor(Number(source[key]));
        clean[key] = Number.isFinite(value) && value > 0 ? value : 0;
    }
    return clean;
}

// Fold one run's summary into the bests. Returns the updated bests (a new
// object) and the keys whose record this run beat. A record has to be beaten,
// not equalled, and a zero never counts.
export function recordBests(bests, summary) {
    const updated = sanitizeBests(bests);
    const newBests = [];
    for (const { key } of BEST_STATS) {
        if (summary[key] > updated[key]) {
            updated[key] = summary[key];
            newBests.push(key);
        }
    }
    return { bests: updated, newBests };
}

// Seconds as m:ss: 65 → "1:05". Minutes keep counting past an hour.
export function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
