import { describe, it, expect } from 'vitest';
import {
    SAVE_KEY,
    SAVE_VERSION,
    defaultSave,
    sanitizeSave,
    loadSave,
    writeSave,
} from '../src/storage';

// Map-backed fake storage matching the { getItem, setItem, removeItem } shape.
function makeFakeStorage() {
    const map = new Map();
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => { map.set(k, String(v)); },
        removeItem: (k) => { map.delete(k); },
        _map: map,
    };
}

describe('storage', () => {
    it('write → load round-trips a save', () => {
        const storage = makeFakeStorage();
        const save = defaultSave();
        save.bests.banked = 1234;
        save.topRuns = [{ ...defaultSave().bests, banked: 1234 }];
        writeSave(storage, save);

        const loaded = loadSave(storage);
        expect(loaded).toEqual(save);
    });

    it('missing key → defaults', () => {
        const storage = makeFakeStorage();
        expect(loadSave(storage)).toEqual(defaultSave());
    });

    it('corrupt JSON → defaults', () => {
        const storage = makeFakeStorage();
        storage.setItem(SAVE_KEY, '{not valid json');
        expect(loadSave(storage)).toEqual(defaultSave());
    });

    it('wrong version → defaults', () => {
        const storage = makeFakeStorage();
        storage.setItem(SAVE_KEY, JSON.stringify({
            version: SAVE_VERSION + 1,
            banked: 999,
            upgrades: { engine: 3 },
        }));
        expect(loadSave(storage)).toEqual(defaultSave());
    });

    it('a v1 save from before bests drops its money and upgrades', () => {
        // Every run starts at $0 with a stock car, so neither is kept any more
        const clean = sanitizeSave({ version: SAVE_VERSION, banked: 700, upgrades: { engine: 1 } });
        expect(clean).toEqual(defaultSave());
        expect('banked' in clean).toBe(false);
        expect('upgrades' in clean).toBe(false);
    });

    it('round-trips bests and sanitizes junk in them', () => {
        const storage = makeFakeStorage();
        const save = defaultSave();
        save.bests.banked = 4200;
        save.bests.timeSurvived = 95;
        writeSave(storage, save);
        expect(loadSave(storage).bests).toEqual(save.bests);

        const junk = sanitizeSave({ version: SAVE_VERSION, bests: { banked: -1, longestChase: 12.8 } });
        expect(junk.bests.banked).toBe(0);
        expect(junk.bests.longestChase).toBe(12);
    });

    it('round-trips the top runs; an old save reads an empty list', () => {
        const storage = makeFakeStorage();
        const save = defaultSave();
        save.topRuns = [{ ...defaultSave().bests, banked: 900, timeSurvived: 60 }];
        writeSave(storage, save);
        expect(loadSave(storage).topRuns).toEqual(save.topRuns);
        expect(sanitizeSave({ version: SAVE_VERSION, banked: 5 }).topRuns).toEqual([]);
    });

    it('writeSave with a throwing setItem does not throw', () => {
        const storage = {
            getItem: () => null,
            setItem: () => { throw new Error('quota exceeded'); },
            removeItem: () => {},
        };
        expect(() => writeSave(storage, defaultSave())).not.toThrow();
    });

    it('loadSave with a throwing getItem does not throw and returns defaults', () => {
        const storage = {
            getItem: () => { throw new Error('access denied'); },
            setItem: () => {},
            removeItem: () => {},
        };
        let result;
        expect(() => { result = loadSave(storage); }).not.toThrow();
        expect(result).toEqual(defaultSave());
    });
});
