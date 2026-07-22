// Versioned persistent save — banked money + garage upgrade levels.
// Pure and Phaser-free; storage is injected so this is unit-testable.
import { CONFIG } from './config';

export const SAVE_KEY = 'getaway-save';
export const SAVE_VERSION = 1;

const TRACK_KEYS = ['engine', 'fuelTank', 'armor', 'bombBay', 'rocketRack'];

export function defaultSave() {
    return {
        version: SAVE_VERSION,
        banked: 0,
        upgrades: { engine: 0, fuelTank: 0, armor: 0, bombBay: 0, rocketRack: 0 },
    };
}

// Coerce a raw (possibly untrusted / older) value into a clean save.
export function sanitizeSave(raw) {
    // v1 policy: discard on any version mismatch or malformed root.
    // A future v2 adds a `raw.version === 1` migration branch here instead of discarding.
    if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION) {
        return defaultSave();
    }

    const clean = defaultSave();

    // banked → non-negative finite integer (floor); invalid → 0
    const banked = Math.floor(Number(raw.banked));
    clean.banked = Number.isFinite(banked) && banked > 0 ? banked : 0;

    // Known track levels → integer clamped 0..MAX_LEVEL; unknown keys dropped; missing → 0
    const rawUpgrades = raw.upgrades && typeof raw.upgrades === 'object' ? raw.upgrades : {};
    for (const key of TRACK_KEYS) {
        const level = Math.floor(Number(rawUpgrades[key]));
        clean.upgrades[key] = Number.isFinite(level)
            ? Math.max(0, Math.min(CONFIG.GARAGE.MAX_LEVEL, level))
            : 0;
    }

    return clean;
}

export function loadSave(storage) {
    let rawStr;
    try {
        rawStr = storage.getItem(SAVE_KEY);
    } catch {
        return defaultSave();
    }
    if (rawStr == null) return defaultSave();
    try {
        return sanitizeSave(JSON.parse(rawStr));
    } catch {
        return defaultSave();
    }
}

export function writeSave(storage, save) {
    try {
        storage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
        // quota exceeded / private mode — persistence best-effort, swallow
    }
}

// Production wiring only — tests never call this.
export function getBrowserStorage() {
    if (typeof localStorage !== 'undefined') {
        try {
            const probe = '__getaway_probe__';
            localStorage.setItem(probe, '1');
            localStorage.removeItem(probe);
            return localStorage;
        } catch {
            // localStorage present but unusable (e.g. Safari private mode)
        }
    }
    // In-memory fallback so the game runs without persistence
    const mem = new Map();
    return {
        getItem: (k) => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => { mem.set(k, String(v)); },
        removeItem: (k) => { mem.delete(k); },
    };
}
