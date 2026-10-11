import { TILE_TYPES } from '../constants';
import { CONFIG } from '../config';

/**
 * Frontier map generator: a railroad cow town out on the open range.
 *
 * Lays the map out in order:
 *  - the town: a surveyed grid against the bottom of the rail loop, with
 *    Front Street running along the tracks (the way Dodge City faced the
 *    Santa Fe) and the hideout on the north edge of town;
 *  - a river running from one map edge to another, over two trestles on
 *    the loop, never through town;
 *  - level crossings: where the town's cross streets meet the tracks, and a
 *    few more round the rest of the loop;
 *  - mountain ranges along the map edges and lone mesas out on the range;
 *  - wagon trails: a planar graph between the town's gates, the crossings
 *    and a scatter of waypoints, every edge routed by A* around the scenery
 *    and over the river on bridges.
 * Pure (no Phaser) and driven by an injectable rand, so it is unit-testable.
 */

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left

// Footprints (cells) of the scenery sprites the art pipeline draws
export const PEAKS = [{ w: 4, h: 3 }, { w: 3, h: 3 }, { w: 3, h: 2 }, { w: 2, h: 2 }];
export const MESAS = [{ w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }, { w: 2, h: 1 }, { w: 1, h: 1 }];

const TOWN_WIDTH = [17, 21];
const TOWN_TOP_MIN = 24;        // the top street never climbs above this row
const RIVER_CLEARANCE = 3;      // cells kept between the river and town
const TRAIL_COST = {
    noise: 3,        // rough ground the trail winds round
    reuse: 0.35,     // riding an existing trail is cheap: trails merge into trunks
    merge: 1,        // stepping into an existing trail from the side
    scenery: 1.5,    // skirting a mountain's foot
    turn: 0.4,
    bridge: 7,
};

function randInt(rand, min, max) {
    return min + Math.floor(rand() * (max - min + 1));
}

function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function weightedPick(entries, rand) {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = rand() * total;
    for (const [value, w] of entries) {
        roll -= w;
        if (roll < 0) return value;
    }
    return entries[entries.length - 1][0];
}

// Smooth value noise in [0, 1] over the map, one random value every `cell` tiles
export function valueNoise(width, height, cell, rand) {
    const gw = Math.ceil(width / cell) + 2;
    const gh = Math.ceil(height / cell) + 2;
    const g = Array.from({ length: gw * gh }, () => rand());
    const smooth = t => t * t * (3 - 2 * t);
    return (x, y) => {
        const fx = Math.max(0, x) / cell;
        const fy = Math.max(0, y) / cell;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = smooth(fx - ix);
        const ty = smooth(fy - iy);
        const v = (i, j) => g[Math.min(gh - 1, iy + j) * gw + Math.min(gw - 1, ix + i)];
        const top = v(0, 0) + (v(1, 0) - v(0, 0)) * tx;
        const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * tx;
        return top + (bottom - top) * ty;
    };
}

// Binary min-heap of [priority, value]
class Heap {
    constructor() {
        this.items = [];
    }

    get size() {
        return this.items.length;
    }

    push(priority, value) {
        const items = this.items;
        items.push([priority, value]);
        let i = items.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (items[p][0] <= items[i][0]) break;
            [items[p], items[i]] = [items[i], items[p]];
            i = p;
        }
    }

    pop() {
        const items = this.items;
        const top = items[0];
        const last = items.pop();
        if (items.length > 0) {
            items[0] = last;
            let i = 0;
            for (;;) {
                const l = i * 2 + 1;
                const r = l + 1;
                let m = i;
                if (l < items.length && items[l][0] < items[m][0]) m = l;
                if (r < items.length && items[r][0] < items[m][0]) m = r;
                if (m === i) break;
                [items[m], items[i]] = [items[i], items[m]];
                i = m;
            }
        }
        return top;
    }
}

/**
 * Least-cost 4-connected path on a width x height grid.
 *  enter(x, y, dir, px, py): cost of stepping into (x, y) heading dir from
 *    (px, py), or Infinity if the move isn't allowed
 *  leap(px, py, dir): optional special move out of (px, py) — a bridge —
 *    returning { x, y, cost, over: [{x, y}] } or null
 *  turn: extra cost for changing heading
 * Returns the cells from start to goal inclusive, or null.
 */
export function findPath(width, height, start, goal, { enter, leap = null, turn = 0, minStep = 0 }) {
    const states = width * height * 5;
    const best = new Float64Array(states).fill(Infinity);
    const from = new Int32Array(states).fill(-1);
    const via = new Map(); // state -> cells leapt over to reach it
    const key = (x, y, d) => (y * width + x) * 5 + d;
    const h = (x, y) => (Math.abs(x - goal.x) + Math.abs(y - goal.y)) * minStep;
    const heap = new Heap();
    const s0 = key(start.x, start.y, 4);
    best[s0] = 0;
    heap.push(h(start.x, start.y), s0);

    while (heap.size > 0) {
        const [f, s] = heap.pop();
        const d0 = s % 5;
        const cell = (s - d0) / 5;
        const x = cell % width;
        const y = (cell - x) / width;
        const g = best[s];
        if (f - h(x, y) > g + 1e-9) continue; // stale entry
        if (x === goal.x && y === goal.y) {
            const path = [];
            let cur = s;
            while (cur !== -1) {
                const c = (cur - (cur % 5)) / 5;
                path.push({ x: c % width, y: Math.floor(c / width) });
                const over = via.get(cur);
                if (over) for (let i = over.length - 1; i >= 0; i--) path.push(over[i]);
                cur = from[cur];
            }
            return path.reverse();
        }
        for (let d = 0; d < 4; d++) {
            if (d0 !== 4 && d === (d0 + 2) % 4) continue; // no doubling back
            const turnCost = d0 !== 4 && d !== d0 ? turn : 0;
            const nx = x + DIRS[d][0];
            const ny = y + DIRS[d][1];
            if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
                const c = enter(nx, ny, d, x, y);
                if (c !== Infinity) {
                    const ns = key(nx, ny, d);
                    const ng = g + c + turnCost;
                    if (ng < best[ns]) {
                        best[ns] = ng;
                        from[ns] = s;
                        via.delete(ns);
                        heap.push(ng + h(nx, ny), ns);
                    }
                }
            }
            const jump = leap && leap(x, y, d);
            if (jump) {
                const ns = key(jump.x, jump.y, d);
                const ng = g + jump.cost + turnCost;
                if (ng < best[ns]) {
                    best[ns] = ng;
                    from[ns] = s;
                    via.set(ns, jump.over);
                    heap.push(ng + h(jump.x, jump.y), ns);
                }
            }
        }
    }
    return null;
}

// Chebyshev distance from every cell to the nearest cell in `sources`
function distanceField(width, height, sources) {
    const dist = new Float64Array(width * height).fill(Infinity);
    let frontier = [];
    for (const { x, y } of sources) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        dist[y * width + x] = 0;
        frontier.push([x, y]);
    }
    for (let d = 1; frontier.length > 0; d++) {
        const next = [];
        for (const [x, y] of frontier) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    if (dist[ny * width + nx] <= d) continue;
                    dist[ny * width + nx] = d;
                    next.push([nx, ny]);
                }
            }
        }
        frontier = next;
    }
    return dist;
}

export class FrontierGenerator {
    constructor(width, height, line, { rand = Math.random } = {}) {
        this.width = width;
        this.height = height;
        this.line = line;
        this.rand = rand;
    }

    idx(x, y) {
        return y * this.width + x;
    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    isRoad(x, y) {
        return this.inBounds(x, y) && this.road[this.idx(x, y)] === 1;
    }

    setRoad(x, y, on = true) {
        if (this.inBounds(x, y)) this.road[this.idx(x, y)] = on ? 1 : 0;
    }

    inTown(x, y) {
        const t = this.town;
        return !!t && x >= t.x0 && x <= t.x1 && y >= t.yN && y <= t.fy;
    }

    isRiver(x, y) {
        return this.inBounds(x, y) && this.riverAt[this.idx(x, y)] >= 0;
    }

    // Returns the plan, or null if this roll didn't work out (the caller re-rolls)
    generate() {
        const { width, height } = this;
        this.road = new Uint8Array(width * height);
        this.reserved = new Uint8Array(width * height);  // stub and spawn cells routing must not touch
        this.scenery = new Uint8Array(width * height);
        this.riverAt = new Int16Array(width * height).fill(-1);
        this.noise = valueNoise(width, height, 4, this.rand);

        this.layTown();
        if (!this.layRiver()) return null;
        this.layCrossings();
        this.placeScenery();
        this.layTrails();
        this.breakSquares();
        this.pruneDeadEnds();
        this.dropUnreachable();

        const bridges = [];
        this.river.forEach(({ x, y }) => {
            if (this.isRoad(x, y)) bridges.push({ x, y, axis: this.riverAxis(x, y) === 'H' ? 'V' : 'H' });
        });
        const grid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) row.push(this.isRoad(x, y) ? TILE_TYPES.ROAD_GENERIC : TILE_TYPES.GRASS);
            grid.push(row);
        }
        return {
            grid,
            spawn: this.spawn,
            town: this.town,
            river: this.river,
            bridges,
            trestles: this.trestles,
            scenery: this.sceneryItems,
            crossings: this.crossings.filter(i => this.isRoad(this.line.cells[i].x, this.line.cells[i].y)),
        };
    }

    // --- Town ------------------------------------------------------------------

    // A grid of streets: Front Street along the bottom of the loop, then
    // parallel streets up the hill with cross streets between them, and a row
    // of lots north of the top street where the hideout stands
    layTown() {
        const { rand, line } = this;
        const bottom = Math.max(...line.cells.map(c => c.y));
        const run = line.cells.filter((c, i) => c.y === bottom && line.axisAt(i) === 'H').map(c => c.x);
        const lo = Math.min(...run) + 1;
        const hi = Math.max(...run) - 1;
        const tw = Math.min(randInt(rand, TOWN_WIDTH[0], TOWN_WIDTH[1]), hi - lo + 1);
        const x0 = Math.max(lo, Math.min(hi - tw + 1,
            Math.round((lo + hi - tw + 1) / 2) + randInt(rand, -2, 2)));
        const x1 = x0 + tw - 1;
        const fy = bottom - 1;

        const rows = [fy];
        const blocks = randInt(rand, 3, 4);
        let y = fy;
        for (let k = 0; k < blocks; k++) {
            const depth = k === 0 ? 2 : randInt(rand, 2, 3);
            if (y - depth - 1 < TOWN_TOP_MIN) break;
            y -= depth + 1;
            rows.push(y);
        }
        const y0 = rows[rows.length - 1];

        const cols = [];
        for (let c = x0 + randInt(rand, 3, 4); c <= x1 - 3; c += randInt(rand, 4, 6)) cols.push(c);

        for (const r of rows) for (let x = x0; x <= x1; x++) this.setRoad(x, r);
        // Cross streets between each pair of streets. Above Main Street a few
        // are left out, so the blocks up the hill come in different sizes,
        // but every pair of streets keeps at least two links
        for (let k = 0; k < rows.length - 1; k++) {
            const lower = rows[k];
            const upper = rows[k + 1];
            const keep = new Set(cols);
            if (k > 0) {
                for (const c of shuffle([...cols], rand)) {
                    if (keep.size > 2 && rand() < 0.3) keep.delete(c);
                }
            }
            for (const c of keep) for (let yy = upper + 1; yy < lower; yy++) this.setRoad(c, yy);
        }

        // The hideout: a dead-end lane off the top street, as near the middle
        // of town as the cross streets allow
        const mid = (x0 + x1) / 2;
        const spawnX = [];
        for (let x = x0 + 1; x <= x1 - 1; x++) if (!cols.includes(x)) spawnX.push(x);
        spawnX.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
        const sx = spawnX[0];
        this.spawn = { x: sx, y: y0 - 1 };
        this.setRoad(sx, y0 - 1);

        // Cross streets that carry on north out of town, clear of the hideout
        const north = shuffle(cols.filter(c => Math.abs(c - sx) >= 2), rand).slice(0, 2);
        for (const c of north) {
            this.setRoad(c, y0 - 1);
            this.setRoad(c, y0 - 2);
        }

        this.town = { x0, x1, yN: y0 - 2, y0, fy, rows, cols, north, main: rows[1] };
        // The hideout's lot and its neighbours stay clear of trails
        for (let dy = -3; dy <= -1; dy++) {
            for (let dx = -1; dx <= 1; dx++) this.reserved[this.idx(sx + dx, y0 + dy)] = 1;
        }
    }

    // --- River -----------------------------------------------------------------

    // The loop's straight sides other than the town's, as { move, cells }
    loopSides(margin) {
        return this.line.crossingCandidates(margin).map(cells => ({ move: this.line.moves[cells[0]], cells }));
    }

    // Track axis at loop cell i, and the step from it out of the loop
    outward(i) {
        const { x, y } = this.line.cells[i];
        const axis = this.line.axisAt(i);
        const steps = axis === 'H' ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        return steps.find(([dx, dy]) => this.line.sideOf(x + dx, y + dy) === 'outside');
    }

    layRiver() {
        const { rand, line, width, height, town } = this;
        const sides = this.loopSides(3).filter(s => s.move !== 'L').map(s => ({
            ...s,
            cells: s.cells.filter((i) => {
                const { y } = line.cells[i];
                return s.move === 'R' || y <= town.yN - 4;
            }),
        })).filter(s => s.cells.length > 0);
        if (sides.length < 2) return false;
        const [sa, sb] = shuffle(sides, rand);

        // Five cells straight across the track at each trestle
        const stubs = [sa, sb].map((side) => {
            const i = side.cells[Math.floor(rand() * side.cells.length)];
            const { x, y } = line.cells[i];
            const [ox, oy] = this.outward(i);
            const cells = [2, 1, 0, -1, -2].map(k => ({ x: x + ox * k, y: y + oy * k }));
            // Out to the map edge, bending a little on the way
            const edge = ox !== 0
                ? { x: ox < 0 ? 0 : width - 1, y: Math.max(3, Math.min(height - 4, y + randInt(rand, -5, 5))) }
                : { x: Math.max(3, Math.min(width - 4, x + randInt(rand, -6, 6))), y: oy < 0 ? 0 : height - 1 };
            return { index: i, cells, outer: cells[0], inner: cells[4], edge };
        });

        const river = new Set();
        const take = cells => cells.forEach(c => river.add(this.idx(c.x, c.y)));
        stubs.forEach(s => take(s.cells));

        const townGap = distanceField(width, height, this.townCells());
        const trackGap = distanceField(width, height, line.cells);
        const spawnGap = distanceField(width, height, [this.spawn]);
        const routeRiver = (start, goal, inside) => findPath(width, height, start, goal, {
            turn: 0.8,
            minStep: 1,
            enter: (x, y) => {
                const i = this.idx(x, y);
                const isGoal = x === goal.x && y === goal.y;
                if (isGoal) return 1;
                if (river.has(i)) return Infinity;
                if (line.has(x, y)) return Infinity;
                if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return Infinity;
                if ((line.sideOf(x, y) === 'inside') !== inside) return Infinity;
                for (const [dx, dy] of DIRS) {
                    const n = this.idx(x + dx, y + dy);
                    const touching = this.inBounds(x + dx, y + dy) && river.has(n);
                    if (touching && !(x + dx === start.x && y + dy === start.y) &&
                        !(x + dx === goal.x && y + dy === goal.y)) return Infinity;
                }
                if (inside && (townGap[i] < RIVER_CLEARANCE || spawnGap[i] < 3)) return Infinity;
                return 1 + this.noise(x * 1.7, y * 1.7) * 4 + (trackGap[i] <= 1 ? 3 : 0);
            },
        });

        // Inside the loop: trestle to trestle by way of a bend north of town
        const waypoint = this.riverWaypoint(townGap, trackGap);
        const legs = waypoint
            ? [[stubs[0].inner, waypoint], [waypoint, stubs[1].inner]]
            : [[stubs[0].inner, stubs[1].inner]];
        const interior = [stubs[0].inner];
        for (const [a, b] of legs) {
            if (b === waypoint) river.add(this.idx(b.x, b.y));
            const path = routeRiver(a, b, true);
            if (!path) return false;
            take(path);
            interior.push(...path.slice(1));
        }

        // Outside: from each trestle out to the map edge
        const outer = [];
        for (const s of stubs) {
            const path = routeRiver(s.outer, s.edge, false);
            if (!path) return false;
            take(path);
            outer.push(path);
        }

        // One ordered chain, map edge to map edge
        this.river = [
            ...outer[0].slice().reverse(),
            ...stubs[0].cells.slice(1, 4),
            ...interior,
            ...stubs[1].cells.slice(0, 4).reverse(),
            ...outer[1].slice(1),
        ];
        if (!this.isSimpleChain(this.river)) return false;
        this.river.forEach((c, k) => { this.riverAt[this.idx(c.x, c.y)] = k; });
        this.trestles = stubs.map(s => s.index);
        return true;
    }

    // A bend for the river somewhere north of town, or null
    riverWaypoint(townGap, trackGap) {
        for (let tries = 0; tries < 30; tries++) {
            const x = randInt(this.rand, 12, this.width - 13);
            const y = randInt(this.rand, 12, this.town.yN - 3);
            const i = this.idx(x, y);
            if (this.line.sideOf(x, y) !== 'inside') continue;
            if (townGap[i] < RIVER_CLEARANCE + 1 || trackGap[i] < 3) continue;
            return { x, y };
        }
        return null;
    }

    // Consecutive cells are neighbours, and no cell touches any but those
    isSimpleChain(cells) {
        const at = new Map(cells.map((c, k) => [`${c.x},${c.y}`, k]));
        if (at.size !== cells.length) return false;
        return cells.every((c, k) => DIRS.every(([dx, dy]) => {
            const j = at.get(`${c.x + dx},${c.y + dy}`);
            return j === undefined || Math.abs(j - k) === 1;
        })) && cells.every((c, k) => k === 0 ||
            Math.abs(c.x - cells[k - 1].x) + Math.abs(c.y - cells[k - 1].y) === 1);
    }

    // 'H' if the river flows left-right through (x, y), 'V' up-down, null on a bend
    riverAxis(x, y) {
        const k = this.riverAt[this.idx(x, y)];
        if (k < 0) return null;
        const prev = this.river[k - 1];
        const next = this.river[k + 1];
        // The ends run off the map edge, straight on
        const a = prev || { x: 2 * x - next.x, y: 2 * y - next.y };
        const b = next || { x: 2 * x - prev.x, y: 2 * y - prev.y };
        if (a.y === y && b.y === y) return 'H';
        if (a.x === x && b.x === x) return 'V';
        return null;
    }

    townCells() {
        const t = this.town;
        const cells = [];
        for (let y = t.yN; y <= t.fy; y++) for (let x = t.x0; x <= t.x1; x++) cells.push({ x, y });
        return cells;
    }

    // --- Level crossings -------------------------------------------------------

    // The town's cross streets run on over the tracks; the other sides get a
    // few crossings each, clear of the trestles and the river
    layCrossings() {
        const { line, rand, town } = this;
        const [min, max] = CONFIG.TRAIN.CROSSINGS_PER_SIDE;
        const spacing = CONFIG.TRAIN.CROSSING_MIN_SPACING;
        this.crossings = [];
        this.stubEnds = []; // { x, y, side: 'inside' | 'outside' }
        const nearTrestle = i => this.trestles.some(t => Math.min(line.wrap(t - i), line.wrap(i - t)) < 4);

        for (const { move, cells } of this.loopSides()) {
            let pool;
            let want;
            if (move === 'L') {
                // Town side: prefer the cross streets, else any spot on Front Street
                const streets = cells.filter(i => town.cols.includes(line.cells[i].x));
                const front = cells.filter(i => line.cells[i].x > town.x0 && line.cells[i].x < town.x1);
                pool = [...shuffle(streets, rand), ...shuffle(front.filter(i => !streets.includes(i)), rand)];
                want = 2;
            } else {
                pool = shuffle(cells.filter(i => !nearTrestle(i) && this.stubClear(i)), rand);
                want = randInt(rand, min, max);
            }
            const chosen = [];
            for (const i of pool) {
                if (chosen.length >= want) break;
                if (chosen.every(c => Math.abs(c - i) >= spacing)) chosen.push(i);
            }
            for (const i of chosen) this.layCrossing(i, move === 'L');
        }
        this.crossings.sort((a, b) => a - b);
    }

    // Five cells straight across the track at loop cell i, from outside in
    stubCells(i) {
        const { x, y } = this.line.cells[i];
        const [ox, oy] = this.outward(i);
        return [2, 1, 0, -1, -2].map(k => ({ x: x + ox * k, y: y + oy * k }));
    }

    stubClear(i) {
        return this.stubCells(i).every(({ x, y }) => this.inBounds(x, y) && !this.isRiver(x, y) &&
            DIRS.every(([dx, dy]) => !this.isRiver(x + dx, y + dy)));
    }

    layCrossing(i, townSide) {
        const cells = this.stubCells(i);
        this.crossings.push(i);
        // On the town side the inner end is Front Street itself
        const used = townSide ? cells.slice(0, 4) : cells;
        for (const c of used) {
            this.setRoad(c.x, c.y);
            this.reserved[this.idx(c.x, c.y)] = 1;
        }
        this.stubEnds.push({ ...cells[0], side: 'outside' });
        if (!townSide) this.stubEnds.push({ ...cells[4], side: 'inside' });
    }

    // --- Scenery -----------------------------------------------------------------

    placeScenery() {
        const { width, height, line, rand } = this;
        this.sceneryItems = [];
        const trackGap = distanceField(width, height, line.cells);
        const riverGap = distanceField(width, height, this.river);
        const townGap = distanceField(width, height, this.townCells());
        const stubGap = distanceField(width, height,
            this.crossings.flatMap(i => this.stubCells(i)).concat([this.spawn]));

        const fits = (x, y, w, h, { overlap, inside }) => {
            for (let yy = y; yy < y + h; yy++) {
                for (let xx = x; xx < x + w; xx++) {
                    if (!this.inBounds(xx, yy)) return false;
                    const i = this.idx(xx, yy);
                    if ((line.sideOf(xx, yy) === 'inside') !== inside) return false;
                    if (trackGap[i] < 3 || riverGap[i] < 2 || stubGap[i] < 3 || townGap[i] < 4) return false;
                    if (!overlap && this.scenery[i]) return false;
                }
            }
            return true;
        };
        const add = (kind, x, y, w, h, tone) => {
            this.sceneryItems.push({ kind, x, y, w, h, tone });
            for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.scenery[this.idx(xx, yy)] = 1;
        };

        // Mountain ranges hug one or two map edges, peaks overlapping, the
        // big ones in the middle of the range
        const edges = shuffle(['top', 'left', 'right', 'bottom'], rand).slice(0, randInt(rand, 1, 2));
        for (const edge of edges) {
            const along = edge === 'top' || edge === 'bottom' ? width : height;
            const span = randInt(rand, 16, 28);
            const start = randInt(rand, 0, along - span);
            const tone = randInt(rand, 0, 2); // one kind of rock for the whole range
            for (let p = start; p < start + span; p += randInt(rand, 1, 2)) {
                const t = (p - start) / span;
                const big = Math.sin(t * Math.PI);
                const size = weightedPick([[PEAKS[0], big * 2], [PEAKS[1], 1 + big], [PEAKS[2], 1], [PEAKS[3], 1.5 - big]], rand);
                for (const depth of [randInt(rand, 0, 1), randInt(rand, 2, 3)]) {
                    const w = depth > 1 ? Math.min(size.w, 3) : size.w;
                    const h = depth > 1 ? 2 : size.h;
                    let x, y;
                    if (edge === 'top') [x, y] = [p, depth];
                    else if (edge === 'bottom') [x, y] = [p, height - h - depth];
                    else if (edge === 'left') [x, y] = [depth, p];
                    else [x, y] = [width - w - depth, p];
                    if (depth > 1 && rand() < 0.3) continue;
                    if (fits(x, y, w, h, { overlap: true, inside: false })) add('peak', x, y, w, h, tone);
                }
            }
        }

        // Lone mesas and buttes out on the range, a couple inside the loop,
        // each with open ground all round
        const crowded = (x, y, w, h) => {
            for (let yy = y - 2; yy < y + h + 2; yy++) {
                for (let xx = x - 2; xx < x + w + 2; xx++) {
                    if (this.inBounds(xx, yy) && this.scenery[this.idx(xx, yy)]) return true;
                }
            }
            return false;
        };
        for (const [inside, count] of [[true, randInt(rand, 1, 2)], [false, randInt(rand, 3, 5)]]) {
            let placed = 0;
            for (let tries = 0; tries < 80 && placed < count; tries++) {
                const { w, h } = MESAS[Math.floor(rand() * MESAS.length)];
                const x = randInt(rand, 1, width - w - 1);
                const y = randInt(rand, 1, height - h - 1);
                if (!fits(x, y, w, h, { overlap: false, inside }) || crowded(x, y, w, h)) continue;
                add('mesa', x, y, w, h, randInt(rand, 0, 2));
                placed++;
            }
        }
    }

    // --- Trails ------------------------------------------------------------------

    layTrails() {
        const { width, height, rand, town } = this;
        const nodes = { inside: [], outside: [] };
        const all = [];
        const addNode = (node) => {
            nodes[node.side].push(node);
            all.push(node);
        };

        // Town gates: both ends of every street, and the cross streets that carry on north
        for (const r of town.rows) {
            addNode({ x: town.x0, y: r, side: 'inside', town: true });
            addNode({ x: town.x1, y: r, side: 'inside', town: true });
        }
        for (const c of town.north) addNode({ x: c, y: town.yN, side: 'inside', town: true });
        for (const end of this.stubEnds) addNode({ ...end });

        // Waypoints: a few homesteads' worth of open range to ride through
        const trackGap = distanceField(width, height, this.line.cells);
        const riverGap = distanceField(width, height, this.river);
        const townGap = distanceField(width, height, this.townCells());
        const sceneryCells = [];
        for (let i = 0; i < this.scenery.length; i++) {
            if (this.scenery[i]) sceneryCells.push({ x: i % width, y: Math.floor(i / width) });
        }
        const sceneryGap = distanceField(width, height, sceneryCells);
        // One waypoint per patch of a jittered grid, wherever the patch has
        // open ground: inside the loop the patches are smaller, so the range
        // between town and track gets its share
        for (const [side, patch] of [['inside', 7], ['outside', 8]]) {
            for (let py = 0; py < height; py += patch) {
                for (let px = 0; px < width; px += patch) {
                    for (let tries = 0; tries < 12; tries++) {
                        const x = px + Math.floor(rand() * patch);
                        const y = py + Math.floor(rand() * patch);
                        if (x < 2 || y < 2 || x > width - 3 || y > height - 3) continue;
                        const i = this.idx(x, y);
                        if (this.line.sideOf(x, y) !== side || this.reserved[i]) continue;
                        if (trackGap[i] < 2 || riverGap[i] < 2 || townGap[i] < 3 || sceneryGap[i] < 2) continue;
                        if (all.some(n => Math.hypot(n.x - x, n.y - y) < 5)) continue;
                        addNode({ x, y, side });
                        break;
                    }
                }
            }
        }

        // Gabriel graph per side of the loop: the planar web of nearest
        // neighbours. The town's gates are already joined through town.
        const edges = [];
        for (const side of ['inside', 'outside']) {
            const list = nodes[side];
            for (let a = 0; a < list.length; a++) {
                for (let b = a + 1; b < list.length; b++) {
                    const p = list[a];
                    const q = list[b];
                    if (p.town && q.town) continue;
                    const len = Math.hypot(p.x - q.x, p.y - q.y);
                    if (len > 20 || !this.openBetween(p, q, side)) continue;
                    const mx = (p.x + q.x) / 2;
                    const my = (p.y + q.y) / 2;
                    const r2 = (len / 2) ** 2;
                    if (list.some(n => n !== p && n !== q && (n.x - mx) ** 2 + (n.y - my) ** 2 < r2)) continue;
                    edges.push({ p, q, len });
                }
            }
        }
        edges.sort((e, f) => e.len - f.len);

        // Spanning edges first so every node is reached, then the rest for loops
        const parent = new Map(all.map(n => [n, n]));
        const find = (n) => {
            while (parent.get(n) !== n) n = parent.get(n);
            return n;
        };
        const townNodes = all.filter(n => n.town);
        townNodes.forEach(n => parent.set(n, townNodes[0]));
        const spanning = [];
        const extra = [];
        for (const e of edges) {
            const a = find(e.p);
            const b = find(e.q);
            if (a !== b) {
                parent.set(a, b);
                spanning.push(e);
            } else {
                extra.push(e);
            }
        }
        for (const e of [...spanning, ...extra.filter(() => rand() < 0.6)]) this.routeTrail(e.p, e.q);

        // Every street that reaches the edge of town carries on out of it:
        // a gate the web left unconnected gets a spur to the nearest trail
        for (const gate of nodes.inside.filter(n => n.town)) {
            const outside = DIRS.some(([dx, dy]) => this.isRoad(gate.x + dx, gate.y + dy) && !this.inTown(gate.x + dx, gate.y + dy));
            if (outside) continue;
            const targets = [];
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    if (this.isRoad(x, y) && !this.inTown(x, y) && !this.reserved[this.idx(x, y)] &&
                        this.line.sideOf(x, y) === 'inside') {
                        targets.push({ x, y, d: Math.abs(x - gate.x) + Math.abs(y - gate.y) });
                    }
                }
            }
            targets.sort((a, b) => a.d - b.d);
            for (const t of targets.slice(0, 6)) {
                if (this.routeTrail(gate, t)) break;
            }
        }
    }

    // The straight line between two nodes stays on their side of the loop and
    // out of town (a trail that has to go all the way round isn't worth laying)
    openBetween(p, q, side) {
        const steps = Math.ceil(Math.hypot(p.x - q.x, p.y - q.y) * 2);
        for (let s = 1; s < steps; s++) {
            const x = Math.round(p.x + (q.x - p.x) * s / steps);
            const y = Math.round(p.y + (q.y - p.y) * s / steps);
            if (this.line.sideOf(x, y) !== side && !(x === p.x && y === p.y) && !(x === q.x && y === q.y)) return false;
            if (this.inTown(x, y) && !(x === p.x && y === p.y) && !(x === q.x && y === q.y)) return false;
        }
        return true;
    }

    // Lay one trail between two road cells
    routeTrail(a, b) {
        const { width, height } = this;
        const path = findPath(width, height, a, b, {
            turn: TRAIL_COST.turn,
            minStep: TRAIL_COST.reuse,
            enter: (x, y, dir, px, py) => this.trailStep(x, y, px, py, b),
            leap: (px, py, dir) => this.bridgeLeap(px, py, dir, b),
        });
        if (!path) return false;
        for (const c of path) this.setRoad(c.x, c.y);
        return true;
    }

    trailStep(x, y, px, py, goal) {
        const { width, height } = this;
        if (x === goal.x && y === goal.y) return 1;
        if (x < 1 || y < 1 || x > width - 2 || y > height - 2) return Infinity;
        const i = this.idx(x, y);
        if (this.reserved[i] || this.scenery[i] || this.riverAt[i] >= 0) return Infinity;
        if (this.line.has(x, y) || this.inTown(x, y)) return Infinity;
        if (this.road[i]) return TRAIL_COST.reuse;
        if (this.makesSquare(x, y)) return Infinity;
        let cost = 1 + this.noise(x, y) * TRAIL_COST.noise;
        // Trails never run side by side: the only road a new stretch may
        // touch is the one it came from, the one dead ahead it is about to
        // join, or its goal
        const ax = 2 * x - px;
        const ay = 2 * y - py;
        for (const [dx, dy] of DIRS) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx === px && ny === py) continue;
            if (this.isRoad(nx, ny) && !(nx === goal.x && ny === goal.y)) {
                if (nx !== ax || ny !== ay) return Infinity;
                cost += TRAIL_COST.merge;
            }
            if (this.inBounds(nx, ny) && this.scenery[this.idx(nx, ny)]) cost += TRAIL_COST.scenery;
        }
        return cost;
    }

    // Would road at (x, y) complete a 2x2 square of road?
    makesSquare(x, y) {
        for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
            let n = 0;
            for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
                const cx = x + ox + dx;
                const cy = y + oy + dy;
                if ((cx === x && cy === y) || this.isRoad(cx, cy)) n++;
            }
            if (n === 4) return true;
        }
        return false;
    }

    // A bridge: straight over a straight stretch of river, square to the
    // current, landing on open ground; never right by another bridge or a trestle
    bridgeLeap(px, py, dir, goal) {
        const [dx, dy] = DIRS[dir];
        const rx = px + dx;
        const ry = py + dy;
        if (!this.isRiver(rx, ry) || this.isRoad(rx, ry)) return null;
        const axis = this.riverAxis(rx, ry);
        if (!axis || (axis === 'H') === (dy === 0)) return null;
        const k = this.riverAt[this.idx(rx, ry)];
        for (let j = Math.max(0, k - 3); j <= Math.min(this.river.length - 1, k + 3); j++) {
            const c = this.river[j];
            if (this.isRoad(c.x, c.y) || this.line.has(c.x, c.y)) return null;
        }
        const qx = rx + dx;
        const qy = ry + dy;
        if (!this.inBounds(qx, qy)) return null;
        const land = this.trailStep(qx, qy, rx, ry, goal);
        if (land === Infinity) return null;
        return { x: qx, y: qy, cost: 2 + TRAIL_COST.bridge + land, over: [{ x: rx, y: ry }] };
    }

    // --- Clean-up ----------------------------------------------------------------

    roadNeighbours(x, y) {
        return DIRS.reduce((n, [dx, dy]) => n + (this.isRoad(x + dx, y + dy) ? 1 : 0), 0);
    }

    // A trail that doubled back beside itself can still pave a 2x2 square;
    // lift one corner of it (one that isn't town, a stub or a bridge)
    breakSquares() {
        for (let y = 0; y < this.height - 1; y++) {
            for (let x = 0; x < this.width - 1; x++) {
                const square = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
                if (!square.every(([cx, cy]) => this.isRoad(cx, cy))) continue;
                const free = square.filter(([cx, cy]) => !this.reserved[this.idx(cx, cy)] && !this.inTown(cx, cy) &&
                    !this.isRiver(cx, cy) && !(cx === this.spawn.x && cy === this.spawn.y));
                free.sort((a, b) => this.roadNeighbours(...a) - this.roadNeighbours(...b));
                if (free.length > 0) this.setRoad(free[0][0], free[0][1], false);
            }
        }
    }

    // Trails that came to nothing are ploughed back; only the hideout lane may end
    pruneDeadEnds() {
        let changed = true;
        while (changed) {
            changed = false;
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (!this.isRoad(x, y) || (x === this.spawn.x && y === this.spawn.y)) continue;
                    if (this.roadNeighbours(x, y) <= 1) {
                        this.setRoad(x, y, false);
                        changed = true;
                    }
                }
            }
        }
    }

    dropUnreachable() {
        const seen = new Uint8Array(this.width * this.height);
        const stack = [this.spawn];
        seen[this.idx(this.spawn.x, this.spawn.y)] = 1;
        while (stack.length > 0) {
            const { x, y } = stack.pop();
            for (const [dx, dy] of DIRS) {
                const nx = x + dx;
                const ny = y + dy;
                if (!this.isRoad(nx, ny) || seen[this.idx(nx, ny)]) continue;
                seen[this.idx(nx, ny)] = 1;
                stack.push({ x: nx, y: ny });
            }
        }
        for (let i = 0; i < this.road.length; i++) if (!seen[i]) this.road[i] = 0;
    }
}

