import { describe, it, expect } from 'vitest';
import { GameState } from '../src/GameState';
import { hasUnlock, canUnlock, unlock, collectibleWeights } from '../src/garage';
import { SAVE_VERSION, defaultSave, sanitizeSave, loadSave, writeSave } from '../src/storage';
import { CONFIG } from '../src/config';

function makeFakeStorage() {
    const map = new Map();
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => { map.set(k, String(v)); },
        removeItem: (k) => { map.delete(k); },
    };
}

describe('GameState railway', () => {
    it('holds at most MAX_CARRY rail passes', () => {
        const state = new GameState();
        expect(state.pickupRailPass()).toBe(true);
        expect(state.railPasses).toBe(CONFIG.RAIL_PASS.MAX_CARRY);
        expect(state.pickupRailPass()).toBe(false);
    });

    it('spends the pass on boarding and needs a new one after getting off', () => {
        const state = new GameState();
        expect(state.canBoardRails()).toBe(false);
        expect(state.boardRails()).toBe(false);

        state.pickupRailPass();
        expect(state.boardRails()).toBe(true);
        expect(state.railPasses).toBe(0);
        expect(state.onRails).toBe(true);
        expect(state.canBoardRails()).toBe(true); // still riding

        state.leaveRails();
        expect(state.onRails).toBe(false);
        expect(state.canBoardRails()).toBe(false);
    });

    it('a catch ends the ride', () => {
        const state = new GameState();
        state.pickupRailPass();
        state.boardRails();
        state.onCaught();
        expect(state.onRails).toBe(false);
    });

    it('a train hit costs a life whatever the armor, and names the game over', () => {
        const state = new GameState({ upgrades: { armor: 3 } });
        state.carried = 500;
        state.onTrainHit();
        expect(state.lives).toBe(CONFIG.PLAYER.LIVES - 1);
        expect(state.carried).toBe(0);

        state.lives = 1;
        state.onTrainHit();
        expect(state.gameOver).toBe(true);
        expect(state.gameOverReason).toBe('HIT BY A TRAIN!');
    });

    it('pays the heist once per full second, adding heat and refreshing the chase', () => {
        const state = new GameState();
        expect(state.heistTick(600)).toBe(0);
        expect(state.heistTick(600)).toBe(1);
        expect(state.carried).toBe(CONFIG.TRAIN.HEIST_PER_SEC);
        expect(state.heat).toBe(CONFIG.TRAIN.HEIST_HEAT_PER_SEC);
        expect(state.isChasing()).toBe(true);

        expect(state.heistTick(2000)).toBe(2);
        expect(state.carried).toBe(3 * CONFIG.TRAIN.HEIST_PER_SEC);
        expect(state.stars).toBe(2); // heat 3

        state.resetHeist();
        expect(state.heistTick(900)).toBe(0);
    });
});

describe('garage unlocks', () => {
    it('unlocks the rail pass once, for its price', () => {
        const save = defaultSave();
        const price = CONFIG.GARAGE.UNLOCKS.railPass.price;
        save.banked = price - 1;
        expect(canUnlock(save, 'railPass')).toEqual({ ok: false, reason: 'funds', price });
        expect(unlock(save, 'railPass')).toBe(false);

        save.banked = price + 10;
        expect(unlock(save, 'railPass')).toBe(true);
        expect(save.banked).toBe(10);
        expect(hasUnlock(save, 'railPass')).toBe(true);
        expect(canUnlock(save, 'railPass').reason).toBe('owned');
        expect(unlock(save, 'railPass')).toBe(false);
    });

    it('adds rail passes to the pickup table only once unlocked', () => {
        const save = defaultSave();
        expect(collectibleWeights(save)).toBe(CONFIG.COLLECTIBLES.WEIGHTS);
        expect(collectibleWeights(save).railPass).toBeUndefined();

        save.unlocks.railPass = true;
        const weights = collectibleWeights(save);
        expect(weights.railPass).toBe(CONFIG.RAIL_PASS.SPAWN_WEIGHT);
        expect(weights.money).toBe(CONFIG.COLLECTIBLES.WEIGHTS.money);
    });
});

describe('storage unlocks', () => {
    it('defaults every unlock to false', () => {
        expect(defaultSave().unlocks).toEqual({ railPass: false });
    });

    it('reads a save from before unlocks existed as nothing unlocked', () => {
        const old = { version: SAVE_VERSION, banked: 900, upgrades: { engine: 1 } };
        const clean = sanitizeSave(old);
        expect(clean.banked).toBe(900);
        expect(clean.upgrades.engine).toBe(1);
        expect(clean.unlocks).toEqual({ railPass: false });
    });

    it('only accepts a literal true and drops unknown unlocks', () => {
        const raw = { ...defaultSave(), unlocks: { railPass: 'yes', jetpack: true } };
        expect(sanitizeSave(raw).unlocks).toEqual({ railPass: false });
        raw.unlocks = { railPass: true };
        expect(sanitizeSave(raw).unlocks).toEqual({ railPass: true });
    });

    it('round-trips an unlock', () => {
        const storage = makeFakeStorage();
        const save = defaultSave();
        save.unlocks.railPass = true;
        writeSave(storage, save);
        expect(loadSave(storage).unlocks.railPass).toBe(true);
    });
});
