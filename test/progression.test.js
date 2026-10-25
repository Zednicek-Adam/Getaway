import test from "node:test";
import assert from "node:assert/strict";
import { RunProgression } from "../js/progression.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function createClock() {
  let now = 0;
  return {
    now: () => now,
    advance(milliseconds) {
      now += milliseconds;
    },
    set(milliseconds) {
      now = milliseconds;
    }
  };
}

function createProgression() {
  const clock = createClock();
  const storage = new MemoryStorage();
  const progression = new RunProgression({
    storage,
    clock: clock.now,
    documentRef: null
  });

  return { clock, storage, progression };
}

test("records every run metric and preserves a complete summary", () => {
  const { clock, progression } = createProgression();

  progression.startRun();
  progression.recordDeposit(500);
  progression.recordDeposit(1500);
  progression.recordDiamondsStolen(3);
  progression.recordPoliceDestroyed(2);

  progression.setWantedLevel(3);
  clock.advance(4000);
  progression.setWantedLevel(5);
  clock.advance(6000);
  progression.setWantedLevel(0);
  clock.advance(2000);

  const summary = progression.finishRun("BUSTED");

  assert.equal(summary.stats.moneyBanked, 2000);
  assert.equal(summary.stats.biggestDeposit, 1500);
  assert.equal(summary.stats.diamondsStolen, 3);
  assert.equal(summary.stats.policeDestroyed, 2);
  assert.equal(summary.stats.longestChaseMs, 10000);
  assert.equal(summary.stats.fiveStarMs, 6000);
  assert.equal(summary.stats.timeSurvivedMs, 12000);
});

test("marks only strictly higher scores as new bests", () => {
  const { clock, progression } = createProgression();

  progression.startRun();
  progression.recordDeposit(100);
  const first = progression.finishRun();

  assert.deepEqual(first.newBests, ["moneyBanked", "biggestDeposit"]);

  clock.advance(1000);
  progression.startRun();
  progression.recordDeposit(100);
  const tie = progression.finishRun();

  assert.deepEqual(tie.newBests, []);

  clock.advance(1000);
  progression.startRun();
  progression.recordDeposit(101);
  const higher = progression.finishRun();

  assert.deepEqual(higher.newBests, ["moneyBanked", "biggestDeposit"]);
});

test("persists personal bests across new progression instances", () => {
  const clock = createClock();
  const storage = new MemoryStorage();

  const first = new RunProgression({
    storage,
    clock: clock.now,
    documentRef: null
  });

  first.startRun();
  first.recordDiamondsStolen(7);
  first.finishRun();

  const restored = new RunProgression({
    storage,
    clock: clock.now,
    documentRef: null
  });

  assert.equal(restored.getBestScores().diamondsStolen, 7);
});

test("recovers safely from corrupt storage", () => {
  const clock = createClock();
  const storage = new MemoryStorage();

  storage.setItem("getaway.run-progression.v1", "{not-json");

  const progression = new RunProgression({
    storage,
    clock: clock.now,
    documentRef: null
  });

  assert.equal(progression.getBestScores().moneyBanked, 0);
  assert.equal(progression.getBestScores().timeSurvivedMs, 0);
});

test("ignores negative, NaN, and invalid mutation values", () => {
  const { progression } = createProgression();

  progression.startRun();
  progression.recordDeposit(-1);
  progression.recordDeposit(Number.NaN);
  progression.recordDiamondsStolen(-5);
  progression.recordPoliceDestroyed(Infinity);
  progression.setWantedLevel("invalid");

  const summary = progression.finishRun();

  assert.equal(summary.stats.moneyBanked, 0);
  assert.equal(summary.stats.biggestDeposit, 0);
  assert.equal(summary.stats.diamondsStolen, 0);
  assert.equal(summary.stats.policeDestroyed, 0);
  assert.equal(summary.stats.fiveStarMs, 0);
});

test("clamps wanted levels and counts only actual five-star time", () => {
  const { clock, progression } = createProgression();

  progression.startRun();
  progression.setWantedLevel(99);
  clock.advance(2500);
  progression.setWantedLevel(-10);
  clock.advance(1000);

  const summary = progression.finishRun();

  assert.equal(summary.stats.fiveStarMs, 2500);
  assert.equal(summary.stats.longestChaseMs, 2500);
});

test("is idempotent when finishRun is called twice", () => {
  const { progression } = createProgression();

  progression.startRun();
  const first = progression.finishRun("BUSTED");
  const second = progression.finishRun("BUSTED");

  assert.ok(first);
  assert.equal(second, null);
});

test("never creates negative elapsed time when the system clock moves backwards", () => {
  const { clock, progression } = createProgression();

  progression.startRun();
  clock.set(-1000);

  const summary = progression.finishRun();
  assert.equal(summary.stats.timeSurvivedMs, 0);
});
