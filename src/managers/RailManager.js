import { CONFIG } from '../config';
import { TILE_SIZE, DIRECTIONS } from '../constants';
import { TrainRun } from '../railway';
import { Train, headingOf } from '../objects/Train';
import { LevelCrossing } from '../objects/LevelCrossing';

const WAGON_KINDS = ['boxcar', 'flatcar', 'tankcar'];

const DIRECTION_STEP = {
    [DIRECTIONS.UP]: [0, -1],
    [DIRECTIONS.DOWN]: [0, 1],
    [DIRECTIONS.LEFT]: [-1, 0],
    [DIRECTIONS.RIGHT]: [1, 0],
};

function directionTo(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Number(Object.keys(DIRECTION_STEP).find(d =>
        DIRECTION_STEP[d][0] === dx && DIRECTION_STEP[d][1] === dy));
}

// Runtime side of the railway: drives the TrainRun, mirrors lowered barriers
// into MapManager's blocked overlay, and answers the questions the scene, the
// police and the player's car ask about the track.
export class RailManager {
    constructor(scene, mapManager) {
        this.scene = scene;
        this.map = mapManager;
        this.line = mapManager.rail.line;
        this.station = mapManager.rail.station;
        this.crossingIndices = mapManager.rail.crossings;

        const [min, max] = CONFIG.TRAIN.WAGONS;
        const wagons = min + Math.floor(Math.random() * (max - min + 1));
        const kinds = ['loco', 'bullion'];
        for (let i = 0; i < wagons; i++) kinds.push(WAGON_KINDS[Math.floor(Math.random() * WAGON_KINDS.length)]);

        // Start on the far side of the loop from the station, so the first
        // stop is half a lap away
        const stationIndex = this.station ? this.station.index : -1;
        const startArc = this.station
            ? this.line.arcMid(stationIndex) + 1.5 + this.line.arcLength / 2
            : 0;
        this.run = new TrainRun(this.line, { cars: kinds.length, stationIndex, startArc });
        this.train = new Train(scene, this.run, kinds);
        this.crossings = this.crossingIndices.map(i =>
            new LevelCrossing(scene, this.line.cells[i], this.line.axisAt(i)));

        this.occupied = this.run.occupied();
    }

    // Returns the TrainRun events ('arrived', 'departed', 'bullionLap')
    update(delta) {
        const events = this.run.tick(delta);
        this.occupied = this.run.occupied();
        this.crossingIndices.forEach((i, k) => {
            const closed = this.isCrossingIndexClosed(i);
            const { x, y } = this.line.cells[i];
            this.crossings[k].setClosed(closed);
            this.map.setTrainBlocked(x, y, closed);
        });
        this.train.update(delta);
        return events;
    }

    isCrossingIndexClosed(i) {
        return this.occupied.has(i) || this.run.msUntilArrival(i) <= CONFIG.TRAIN.WARNING_MS;
    }

    isTrainAt(x, y) {
        const i = this.line.indexOf(x, y);
        return i >= 0 && this.occupied.has(i);
    }

    // Only a moving train hurts; a standing one is just in the way
    isMovingTrainAt(x, y) {
        return this.run.moving && this.isTrainAt(x, y);
    }

    isStoppedTrainAt(x, y) {
        return !this.run.moving && this.isTrainAt(x, y);
    }

    get vaultOpen() {
        return this.run.vaultOpen;
    }

    areLoopNeighbours(ax, ay, bx, by) {
        const a = this.line.indexOf(ax, ay);
        const b = this.line.indexOf(bx, by);
        return a >= 0 && b >= 0 && this.line.areNeighbours(a, b);
    }

    // +1 when the car runs with the loop's cell order, -1 against it
    travelSign(car) {
        const a = this.line.indexOf(car.gridX, car.gridY);
        if (car.isMoving) {
            const b = this.line.indexOf(car.targetX, car.targetY);
            if (b >= 0 && this.line.areNeighbours(a, b)) return b === this.line.wrap(a + 1) ? 1 : -1;
        }
        const p = this.line.pointAtArc(this.line.arcMid(a));
        const [dx, dy] = DIRECTION_STEP[car.direction];
        return p.dx * dx + p.dy * dy >= 0 ? 1 : -1;
    }

    // Plain track steers the car: the way on is the loop neighbour it didn't
    // come from. Null off the track and on crossings (where turns are allowed).
    trackDirection(car) {
        const { gridX: x, gridY: y } = car;
        if (!this.map.isRail(x, y) || this.map.isRoad(x, y)) return null;
        const a = this.line.indexOf(x, y);
        const next = this.line.cells[this.line.wrap(a + this.travelSign(car))];
        return directionTo({ x, y }, next);
    }

    // Where the car is drawn while it moves between two loop cells: on the
    // rails, not on the straight line between cell centres
    railPose(car, t) {
        const a = this.line.indexOf(car.gridX, car.gridY);
        if (a < 0) return null;
        const moving = car.targetX !== car.gridX || car.targetY !== car.gridY;
        let s;
        let sign;
        if (moving) {
            const b = this.line.indexOf(car.targetX, car.targetY);
            if (b < 0 || !this.line.areNeighbours(a, b)) return null;
            s = this.line.arcMid(a) + this.line.arcBetween(a, b) * t;
            sign = b === this.line.wrap(a + 1) ? 1 : -1;
        } else {
            if (this.map.isRoad(car.gridX, car.gridY)) return null; // crossing: plain centre
            s = this.line.arcMid(a);
            sign = this.travelSign(car);
        }
        const p = this.line.pointAtArc(s);
        return { x: p.x * TILE_SIZE, y: p.y * TILE_SIZE, heading: headingOf(p.dx * sign, p.dy * sign) };
    }

    nearestCrossing(x, y) {
        let best = null;
        let bestDist = Infinity;
        for (const i of this.crossingIndices) {
            const c = this.line.cells[i];
            const d = Math.abs(c.x - x) + Math.abs(c.y - y);
            if (d < bestDist) {
                bestDist = d;
                best = i;
            }
        }
        return best;
    }

    // Police behind lowered barriers on the other side of the loop can't see
    // the player: the train (or the wait for it) is between them
    blocksView(unit, player) {
        const su = this.line.sideOf(unit.gridX, unit.gridY);
        const sp = this.line.sideOf(player.gridX, player.gridY);
        if (su === 'loop' || sp === 'loop' || su === sp) return false;
        const i = this.nearestCrossing(unit.gridX, unit.gridY);
        return i !== null && this.isCrossingIndexClosed(i);
    }

    // The first crossing the riding car will reach
    nextCrossingAhead(car) {
        const a = this.line.indexOf(car.gridX, car.gridY);
        if (a < 0 || this.crossingIndices.length === 0) return null;
        const sign = this.travelSign(car);
        for (let k = 1; k <= this.line.length; k++) {
            const i = this.line.wrap(a + sign * k);
            if (this.crossingIndices.includes(i)) return i;
        }
        return null;
    }

    // Road cell beside crossing i on the unit's side of the loop: where a cop
    // waits for a player who has to come off the track there
    crossingApproach(i, unit) {
        const { x, y } = this.line.cells[i];
        const sides = this.line.axisAt(i) === 'H' ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]];
        const side = this.line.sideOf(unit.gridX, unit.gridY);
        const pick = sides.find(([sx, sy]) => this.line.sideOf(sx, sy) === side) || sides[0];
        return { x: pick[0], y: pick[1] };
    }

    // Chase goal while the player rides the rails: interceptors head for the
    // next crossing ahead of them, everyone else for the one nearest them
    policeGoal(unit, player, mode) {
        const i = mode === 'intercept'
            ? this.nextCrossingAhead(player)
            : this.nearestCrossing(player.gridX, player.gridY);
        return i === null ? null : this.crossingApproach(i, unit);
    }

    // Car positions in tile units, locomotive first (for the HUD loop map)
    carPositions() {
        const out = [];
        for (let k = 0; k < this.run.cars; k++) {
            const p = this.line.pointAtArc(this.run.carArc(k));
            out.push({ x: p.x, y: p.y });
        }
        return out;
    }

    destroy() {
        this.train.destroy();
        this.crossings.forEach(c => c.destroy());
    }
}
