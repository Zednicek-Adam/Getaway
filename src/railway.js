import { CONFIG } from './config';

// Pure railway model — no Phaser, so it is unit-testable.
//
// The track is one closed loop of grid cells: a rectangle inset from the map
// edges with each corner cut off by a 45-degree staircase, so it reads as an
// octagon ringing the city. Consecutive cells are orthogonal neighbours, which
// keeps the loop a wall for 4-connected roads: the only way across is a level
// crossing (a loop cell that is also road).
//
// Positions along the loop are measured as arc length in tiles. Cell i's piece
// of track runs from the midpoint of the edge it shares with cell i-1 to the
// midpoint of the edge it shares with cell i+1: straight cells are 1 tile
// long, staircase cells (which the track crosses diagonally) are sqrt(2)/2.
// The train and the player's car both move along that polyline, so they follow
// the drawn rails rather than zigzagging cell to cell.

const STEP = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] };

function moveBetween(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Object.keys(STEP).find(k => STEP[k][0] === dx && STEP[k][1] === dy);
}

// Ordered loop cells, clockwise, starting at the left end of the top side
export function buildLoop(width, height, inset = CONFIG.TRAIN.LOOP_INSET, chamfer = CONFIG.TRAIN.CHAMFER) {
    const x0 = inset;
    const y0 = inset;
    const x1 = width - 1 - inset;
    const y1 = height - 1 - inset;
    const cells = [];
    let x = x0 + chamfer;
    let y = y0;
    const push = () => cells.push({ x, y });

    for (; x < x1 - chamfer; x++) push();                       // top, heading right
    for (let k = 0; k < chamfer; k++) { push(); x++; push(); y++; }
    for (; y < y1 - chamfer; y++) push();                       // right, heading down
    for (let k = 0; k < chamfer; k++) { push(); y++; push(); x--; }
    for (; x > x0 + chamfer; x--) push();                       // bottom, heading left
    for (let k = 0; k < chamfer; k++) { push(); x--; push(); y--; }
    for (; y > y0 + chamfer; y--) push();                       // left, heading up
    for (let k = 0; k < chamfer; k++) { push(); y--; push(); x++; }
    return cells;
}

export class RailLine {
    constructor(width, height, { inset, chamfer } = {}) {
        this.width = width;
        this.height = height;
        this.cells = buildLoop(width, height, inset, chamfer);
        this.length = this.cells.length;
        this.indexByKey = new Map(this.cells.map((c, i) => [`${c.x},${c.y}`, i]));
        // moves[i]: the step from cell i to cell i+1
        this.moves = this.cells.map((c, i) => moveBetween(c, this.cells[this.wrap(i + 1)]));

        // mids[i]: midpoint of the edge between cell i and i+1, in tile units
        this.mids = this.cells.map((c, i) => {
            const n = this.cells[this.wrap(i + 1)];
            return { x: (c.x + n.x) / 2 + 0.5, y: (c.y + n.y) / 2 + 0.5 };
        });
        this.segLen = this.cells.map((_, i) => {
            const a = this.mids[this.wrap(i - 1)];
            const b = this.mids[i];
            return Math.hypot(b.x - a.x, b.y - a.y);
        });
        this.arcStart = [];
        let s = 0;
        for (let i = 0; i < this.length; i++) {
            this.arcStart.push(s);
            s += this.segLen[i];
        }
        this.arcLength = s;

        this.inside = this.floodInside();
    }

    wrap(i) {
        return ((i % this.length) + this.length) % this.length;
    }

    wrapArc(s) {
        return ((s % this.arcLength) + this.arcLength) % this.arcLength;
    }

    indexOf(x, y) {
        return this.indexByKey.get(`${x},${y}`) ?? -1;
    }

    has(x, y) {
        return this.indexByKey.has(`${x},${y}`);
    }

    areNeighbours(i, j) {
        return j === this.wrap(i + 1) || j === this.wrap(i - 1);
    }

    // The track runs straight through cell i (same move in and out)
    isStraight(i) {
        return this.moves[this.wrap(i - 1)] === this.moves[i];
    }

    // 'H' for a left-right straight, 'V' for up-down, null on a diagonal
    axisAt(i) {
        if (!this.isStraight(i)) return null;
        return this.moves[i] === 'L' || this.moves[i] === 'R' ? 'H' : 'V';
    }

    // The four moves around cell i (i-2 -> i+2): enough to know how the rails
    // enter, cross and leave it, so the art pipeline keys track tiles by it
    signature(i) {
        return [-2, -1, 0, 1].map(k => this.moves[this.wrap(i + k)]).join('');
    }

    // Arc length at the middle of cell i's piece of track
    arcMid(i) {
        return this.arcStart[i] + this.segLen[i] / 2;
    }

    cellAtArc(s) {
        const t = this.wrapArc(s);
        let lo = 0;
        let hi = this.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (this.arcStart[mid] <= t) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    // { x, y } in tile units plus the unit direction of travel (dx, dy)
    pointAtArc(s) {
        const i = this.cellAtArc(s);
        const a = this.mids[this.wrap(i - 1)];
        const b = this.mids[i];
        const f = (this.wrapArc(s) - this.arcStart[i]) / this.segLen[i];
        const len = this.segLen[i];
        return {
            x: a.x + (b.x - a.x) * f,
            y: a.y + (b.y - a.y) * f,
            dx: (b.x - a.x) / len,
            dy: (b.y - a.y) / len,
        };
    }

    // Arc travelled from the middle of cell i to the middle of neighbour j
    // (negative when j is behind i)
    arcBetween(i, j) {
        const half = (this.segLen[i] + this.segLen[j]) / 2;
        return j === this.wrap(i + 1) ? half : -half;
    }

    // Non-loop cells the outside world can't reach without crossing the loop
    floodInside() {
        const outside = new Set();
        const stack = [];
        for (let x = 0; x < this.width; x++) stack.push([x, 0], [x, this.height - 1]);
        for (let y = 0; y < this.height; y++) stack.push([0, y], [this.width - 1, y]);
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;
            if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
            if (outside.has(key) || this.indexByKey.has(key)) continue;
            outside.add(key);
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        const inside = new Set();
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const key = `${x},${y}`;
                if (!outside.has(key) && !this.indexByKey.has(key)) inside.add(key);
            }
        }
        return inside;
    }

    // 'loop' | 'inside' | 'outside'
    sideOf(x, y) {
        if (this.has(x, y)) return 'loop';
        return this.inside.has(`${x},${y}`) ? 'inside' : 'outside';
    }

    // Straight cells at least `margin` cells from a bend, grouped by side
    crossingCandidates(margin = CONFIG.TRAIN.CORNER_MARGIN) {
        const sides = new Map();
        for (let i = 0; i < this.length; i++) {
            let clear = true;
            for (let k = -margin - 1; k <= margin; k++) {
                if (this.moves[this.wrap(i + k)] !== this.moves[i]) { clear = false; break; }
            }
            if (!clear) continue;
            if (!sides.has(this.moves[i])) sides.set(this.moves[i], []);
            sides.get(this.moves[i]).push(i);
        }
        return [...sides.values()];
    }

    // Loop indices of the level crossings: a few per side, kept apart
    pickCrossings(rand = Math.random, cfg = CONFIG.TRAIN) {
        const [min, max] = cfg.CROSSINGS_PER_SIDE;
        const picked = [];
        for (const side of this.crossingCandidates()) {
            const want = min + Math.floor(rand() * (max - min + 1));
            const pool = [...side];
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            const chosen = [];
            for (const i of pool) {
                if (chosen.length >= want) break;
                if (chosen.every(c => Math.abs(c - i) >= cfg.CROSSING_MIN_SPACING)) chosen.push(i);
            }
            picked.push(...chosen);
        }
        return picked.sort((a, b) => a - b);
    }
}

// One train circling the loop. Pure schedule + occupancy: the head (front of
// the locomotive) is an ever-growing arc length, cars are 1 tile long and
// coupled nose to tail, and the bullion car rides second so it can stop level
// with the station platform.
export class TrainRun {
    constructor(line, { cars, stationIndex = -1, startArc = 0, cfg = CONFIG.TRAIN } = {}) {
        this.line = line;
        this.cars = cars;
        this.cfg = cfg;
        this.head = startArc;
        this.dwellRemaining = 0;
        this.lap = 0;
        this.bullion = false;

        // The head stops 1.5 tiles past the platform cell's middle, which puts
        // the bullion car (second in line) right alongside the platform
        this.stopArc = null;
        if (stationIndex >= 0) {
            this.stopArc = line.arcMid(stationIndex) + 1.5;
            while (this.stopArc <= this.head) this.stopArc += line.arcLength;
        }
    }

    get moving() {
        return this.dwellRemaining <= 0;
    }

    get vaultOpen() {
        return !this.moving && this.bullion;
    }

    dwellFor(bullion) {
        return bullion ? this.cfg.BULLION_DWELL_MS : this.cfg.STATION_DWELL_MS;
    }

    // Advance by delta ms; returns the events that happened this step
    // ('arrived', 'departed', 'bullionLap')
    tick(delta) {
        const events = [];
        if (!this.moving) {
            this.dwellRemaining -= delta;
            if (this.dwellRemaining > 0) return events;
            delta = -this.dwellRemaining;
            this.dwellRemaining = 0;
            this.lap++;
            this.bullion = this.lap % this.cfg.BULLION_EVERY === this.cfg.BULLION_EVERY - 1;
            events.push('departed');
            if (this.bullion) events.push('bullionLap');
        }

        const advance = delta / this.cfg.MS_PER_TILE;
        if (this.stopArc !== null && this.head + advance >= this.stopArc) {
            this.head = this.stopArc;
            this.stopArc += this.line.arcLength;
            this.dwellRemaining = this.dwellFor(this.bullion);
            events.push('arrived');
        } else {
            this.head += advance;
        }
        return events;
    }

    // Arc length at the middle of car k (0 = locomotive)
    carArc(k) {
        return this.head - k - 0.5;
    }

    // Loop indices any part of the train is touching
    occupied() {
        const cells = new Set();
        const tail = this.head - this.cars;
        for (let s = tail; s < this.head; s += 0.25) cells.add(this.line.cellAtArc(s));
        cells.add(this.line.cellAtArc(this.head));
        return cells;
    }

    // ms until the locomotive's nose reaches cell i (station stops included)
    msUntilArrival(i) {
        const dist = this.line.wrapArc(this.line.arcStart[i] - this.head);
        let ms = dist * this.cfg.MS_PER_TILE;
        if (!this.moving) ms += this.dwellRemaining;
        else if (this.stopArc !== null && this.stopArc - this.head <= dist) ms += this.dwellFor(this.bullion);
        return ms;
    }

    // Barriers are down from WARNING_MS before the nose arrives until the tail clears
    isClosed(i) {
        return this.occupied().has(i) || this.msUntilArrival(i) <= this.cfg.WARNING_MS;
    }
}
