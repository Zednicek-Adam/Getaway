// Versioned persistent save — personal bests and the top runs.
// Pure and Phaser-free; storage is injected so this is unit-testable.
//
// Money and garage upgrades used to live here too. Every run now starts at
// $0 with a stock car (see newWallet in garage.js), so a v1 save's `banked`
// and `upgrades` are simply dropped on load.
import { defaultBests, sanitizeBests, sanitizeTopRuns } from './bests';

export const SAVE_KEY = 'getaway-save';
export const SAVE_VERSION = 1;

export function defaultSave() {
    return {
        version: SAVE_VERSION,
        bests: defaultBests(),
        topRuns: [],
    };
}

// Coerce a raw (possibly untrusted / older) value into a clean save.
export function sanitizeSave(raw) {
    // v1 policy: discard on any version mismatch or malformed root.
    // A future v2 adds a `raw.version === 1` migration branch here instead of discarding.
    if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION) {
        return defaultSave();
    }

    // Bests and top runs came after v1 shipped: a save without them reads as
    // zeroes and an empty list, with no version bump
    return {
        version: SAVE_VERSION,
        bests: sanitizeBests(raw.bests),
        topRuns: sanitizeTopRuns(raw.topRuns),
    };
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
