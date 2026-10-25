/*
 * Getaway run progression and personal-best system.
 * Requires a modern browser with localStorage and DOM support.
 *
 * Game integration:
 *   const progression = new RunProgression();
 *   progression.startRun();
 *   progression.recordDeposit(amount);
 *   progression.setWantedLevel(stars);
 *   progression.recordPoliceDestroyed();
 *   progression.recordDiamondsStolen(count);
 *   progression.finishRun(reason);
 */

const STORAGE_KEY = "getaway.run-progression.v1";
const STORAGE_VERSION = 1;

export const STAT_DEFINITIONS = Object.freeze([
  { key: "moneyBanked", label: "Money banked", format: "money" },
  { key: "biggestDeposit", label: "Biggest deposit", format: "money" },
  { key: "longestChaseMs", label: "Longest chase", format: "duration" },
  { key: "fiveStarMs", label: "Time at 5 stars", format: "duration" },
  { key: "policeDestroyed", label: "Police destroyed", format: "number" },
  { key: "diamondsStolen", label: "Diamonds stolen", format: "number" },
  { key: "timeSurvivedMs", label: "Time survived", format: "duration" }
]);

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function numberOrZero(value) {
  return isFiniteNonNegative(value) ? value : 0;
}

function safeNow(clock) {
  const value = Number(clock());
  return Number.isFinite(value) ? value : Date.now();
}

function formatMoney(value) {
  return `$${Math.floor(numberOrZero(value)).toLocaleString("en-US")}`;
}

function formatNumber(value) {
  return Math.floor(numberOrZero(value)).toLocaleString("en-US");
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(numberOrZero(milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, "0")}s`
    : `${seconds}s`;
}

function formatValue(value, format) {
  if (format === "money") return formatMoney(value);
  if (format === "duration") return formatDuration(value);
  return formatNumber(value);
}

function emptyBestScores() {
  return Object.fromEntries(STAT_DEFINITIONS.map(({ key }) => [key, 0]));
}

function normaliseBestScores(candidate) {
  const defaults = emptyBestScores();

  if (!candidate || typeof candidate !== "object") {
    return defaults;
  }

  for (const { key } of STAT_DEFINITIONS) {
    defaults[key] = numberOrZero(Number(candidate[key]));
  }

  return defaults;
}

function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: STORAGE_VERSION, bests: emptyBestScores() };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== STORAGE_VERSION) {
      return { version: STORAGE_VERSION, bests: emptyBestScores() };
    }

    return {
      version: STORAGE_VERSION,
      bests: normaliseBestScores(parsed.bests)
    };
  } catch {
    return { version: STORAGE_VERSION, bests: emptyBestScores() };
  }
}

function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Private browsing or quota failure must never prevent a run from ending.
    return false;
  }
}

function createRun(startedAt) {
  return {
    startedAt,
    lastUpdatedAt: startedAt,
    wantedLevel: 0,
    chaseStartedAt: null,
    longestChaseMs: 0,
    fiveStarMs: 0,
    moneyBanked: 0,
    biggestDeposit: 0,
    policeDestroyed: 0,
    diamondsStolen: 0,
    finished: false
  };
}

export class RunProgression {
  constructor({
    storage = window.localStorage,
    clock = () => Date.now(),
    documentRef = document
  } = {}) {
    if (!storage || typeof storage.getItem !== "function") {
      throw new TypeError("RunProgression requires a Storage-compatible object.");
    }

    this.storage = storage;
    this.clock = clock;
    this.document = documentRef;
    this.state = loadState(storage);
    this.run = null;
  }

  getBestScores() {
    return { ...this.state.bests };
  }

  startRun() {
    const now = safeNow(this.clock);
    this.run = createRun(now);
    return this.getCurrentRun();
  }

  getCurrentRun() {
    if (!this.run) return null;

    return {
      moneyBanked: this.run.moneyBanked,
      biggestDeposit: this.run.biggestDeposit,
      longestChaseMs: this.run.longestChaseMs,
      fiveStarMs: this.run.fiveStarMs,
      policeDestroyed: this.run.policeDestroyed,
      diamondsStolen: this.run.diamondsStolen,
      timeSurvivedMs: Math.max(0, safeNow(this.clock) - this.run.startedAt)
    };
  }

  ensureActiveRun() {
    if (!this.run || this.run.finished) {
      return false;
    }
    return true;
  }

  advanceClock() {
    if (!this.ensureActiveRun()) return;

    const now = Math.max(this.run.lastUpdatedAt, safeNow(this.clock));
    const elapsed = now - this.run.lastUpdatedAt;

    if (this.run.wantedLevel === 5) {
      this.run.fiveStarMs += elapsed;
    }

    if (this.run.chaseStartedAt !== null) {
      this.run.longestChaseMs = Math.max(
        this.run.longestChaseMs,
        now - this.run.chaseStartedAt
      );
    }

    this.run.lastUpdatedAt = now;
  }

  setWantedLevel(level) {
    if (!this.ensureActiveRun()) return;

    const parsed = Math.floor(Number(level));
    const nextLevel = Number.isFinite(parsed)
      ? Math.min(5, Math.max(0, parsed))
      : 0;

    this.advanceClock();

    if (nextLevel > 0 && this.run.chaseStartedAt === null) {
      this.run.chaseStartedAt = this.run.lastUpdatedAt;
    }

    if (nextLevel === 0 && this.run.chaseStartedAt !== null) {
      this.run.longestChaseMs = Math.max(
        this.run.longestChaseMs,
        this.run.lastUpdatedAt - this.run.chaseStartedAt
      );
      this.run.chaseStartedAt = null;
    }

    this.run.wantedLevel = nextLevel;
  }

  recordDeposit(amount) {
    if (!this.ensureActiveRun()) return;

    const deposited = Number(amount);
    if (!isFiniteNonNegative(deposited) || deposited === 0) return;

    this.run.moneyBanked += deposited;
    this.run.biggestDeposit = Math.max(this.run.biggestDeposit, deposited);
  }

  recordPoliceDestroyed(count = 1) {
    if (!this.ensureActiveRun()) return;

    const parsed = Math.floor(Number(count));
    if (Number.isFinite(parsed) && parsed > 0) {
      this.run.policeDestroyed += parsed;
    }
  }

  recordDiamondsStolen(count = 1) {
    if (!this.ensureActiveRun()) return;

    const parsed = Math.floor(Number(count));
    if (Number.isFinite(parsed) && parsed > 0) {
      this.run.diamondsStolen += parsed;
    }
  }

  finishRun(reason = "BUSTED") {
    if (!this.ensureActiveRun()) return null;

    this.advanceClock();

    const endedAt = this.run.lastUpdatedAt;
    const stats = {
      moneyBanked: this.run.moneyBanked,
      biggestDeposit: this.run.biggestDeposit,
      longestChaseMs: this.run.longestChaseMs,
      fiveStarMs: this.run.fiveStarMs,
      policeDestroyed: this.run.policeDestroyed,
      diamondsStolen: this.run.diamondsStolen,
      timeSurvivedMs: Math.max(0, endedAt - this.run.startedAt)
    };

    const newBests = [];

    for (const { key } of STAT_DEFINITIONS) {
      if (stats[key] > this.state.bests[key]) {
        this.state.bests[key] = stats[key];
        newBests.push(key);
      }
    }

    saveState(this.storage, this.state);
    this.run.finished = true;

    const summary = {
      reason: String(reason || "BUSTED"),
      stats,
      bests: this.getBestScores(),
      newBests
    };

    this.renderSummary(summary);
    return summary;
  }

  renderSummary(summary) {
    if (!this.document || !this.document.body) return;

    const existing = this.document.getElementById("run-summary");
    if (existing) existing.remove();

    const panel = this.document.createElement("section");
    panel.id = "run-summary";
    panel.className = "run-summary";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-live", "assertive");
    panel.setAttribute("aria-labelledby", "run-summary-title");

    const title = this.document.createElement("h2");
    title.id = "run-summary-title";
    title.textContent = summary.reason;
    panel.appendChild(title);

    const subtitle = this.document.createElement("p");
    subtitle.className = "run-summary__subtitle";
    subtitle.textContent = "Run summary";
    panel.appendChild(subtitle);

    const list = this.document.createElement("dl");
    list.className = "run-summary__stats";

    for (const definition of STAT_DEFINITIONS) {
      const term = this.document.createElement("dt");
      term.textContent = definition.label;

      const description = this.document.createElement("dd");
      description.textContent = formatValue(
        summary.stats[definition.key],
        definition.format
      );

      if (summary.newBests.includes(definition.key)) {
        const badge = this.document.createElement("span");
        badge.className = "run-summary__new-best";
        badge.textContent = "NEW BEST";
        description.append(" ", badge);
      }

      list.append(term, description);
    }

    panel.appendChild(list);
    this.document.body.appendChild(panel);
  }
}
