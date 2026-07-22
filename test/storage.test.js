import { describe, it, expect } from 'vitest';
import {
    SAVE_KEY,
    SAVE_VERSION,
    defaultSave,
    sanitizeSave,
    loadSave,
    writeSave,
} from '../src/storage';
import { CONFIG } from '../src/config';

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
        save.banked = 1234;
        save.upgrades.engine = 2;
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

    it('sanitizes negative / NaN / float banked', () => {
        expect(sanitizeSave({ version: SAVE_VERSION, banked: -50 }).banked).toBe(0);
        expect(sanitizeSave({ version: SAVE_VERSION, banked: NaN }).banked).toBe(0);
        expect(sanitizeSave({ version: SAVE_VERSION, banked: 'oops' }).banked).toBe(0);
        expect(sanitizeSave({ version: SAVE_VERSION, banked: 123.9 }).banked).toBe(123);
    });

    it('clamps levels to 0..MAX_LEVEL and coerces non-numeric to 0', () => {
        const clean = sanitizeSave({
            version: SAVE_VERSION,
            upgrades: { engine: 99, fuelTank: -3, armor: 'x', bombBay: 2.7 },
        });
        expect(clean.upgrades.engine).toBe(CONFIG.GARAGE.MAX_LEVEL);
        expect(clean.upgrades.fuelTank).toBe(0);
        expect(clean.upgrades.armor).toBe(0);
        expect(clean.upgrades.bombBay).toBe(2);
    });

    it('drops unknown track keys and fills missing tracks with 0', () => {
        const clean = sanitizeSave({
            version: SAVE_VERSION,
            upgrades: { engine: 1, bogus: 5 },
        });
        expect(clean.upgrades).toEqual({
            engine: 1, fuelTank: 0, armor: 0, bombBay: 0, rocketRack: 0,
        });
        expect('bogus' in clean.upgrades).toBe(false);
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
