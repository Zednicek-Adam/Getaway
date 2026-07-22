import { describe, it, expect } from 'vitest';
import {
    statsForUpgrades,
    priceForNextLevel,
    canPurchase,
    purchase,
} from '../src/garage';
import { defaultSave } from '../src/storage';
import { CONFIG } from '../src/config';

describe('garage', () => {
    it('values[0] matches the base CONFIG constant for all five tracks', () => {
        expect(CONFIG.GARAGE.TRACKS.engine.values[0]).toBe(CONFIG.PLAYER.MOVE_DURATION);
        expect(CONFIG.GARAGE.TRACKS.fuelTank.values[0]).toBe(CONFIG.FUEL.MAX);
        expect(CONFIG.GARAGE.TRACKS.armor.values[0]).toBe(CONFIG.DAMAGE.MAX_HITS);
        expect(CONFIG.GARAGE.TRACKS.bombBay.values[0]).toBe(CONFIG.PLAYER.MAX_BOMBS);
        expect(CONFIG.GARAGE.TRACKS.rocketRack.values[0]).toBe(CONFIG.ROCKET.MAX_CARRY);
    });

    it('priceForNextLevel returns 500/1500/4000/null', () => {
        expect(priceForNextLevel(0)).toBe(500);
        expect(priceForNextLevel(1)).toBe(1500);
        expect(priceForNextLevel(2)).toBe(4000);
        expect(priceForNextLevel(3)).toBe(null);
    });

    it('purchase happy path decrements banked and increments level', () => {
        const save = defaultSave();
        save.banked = 1000;
        expect(purchase(save, 'engine')).toBe(true);
        expect(save.upgrades.engine).toBe(1);
        expect(save.banked).toBe(500);
    });

    it('denies purchase at max level with reason "maxed"', () => {
        const save = defaultSave();
        save.banked = 999999;
        save.upgrades.armor = CONFIG.GARAGE.MAX_LEVEL;
        const check = canPurchase(save, 'armor');
        expect(check.ok).toBe(false);
        expect(check.reason).toBe('maxed');
        expect(purchase(save, 'armor')).toBe(false);
        expect(save.upgrades.armor).toBe(CONFIG.GARAGE.MAX_LEVEL);
        expect(save.banked).toBe(999999);
    });

    it('denies purchase on insufficient funds with reason "funds", leaving save untouched', () => {
        const save = defaultSave();
        save.banked = 100;
        const check = canPurchase(save, 'engine');
        expect(check.ok).toBe(false);
        expect(check.reason).toBe('funds');
        expect(check.price).toBe(500);
        expect(purchase(save, 'engine')).toBe(false);
        expect(save.upgrades.engine).toBe(0);
        expect(save.banked).toBe(100);
    });

    it('statsForUpgrades with all tracks at 3 gives the top-tier values', () => {
        const stats = statsForUpgrades({
            engine: 3, fuelTank: 3, armor: 3, bombBay: 3, rocketRack: 3,
        });
        expect(stats).toEqual({
            moveDuration: 225,
            maxFuel: 200,
            maxDamage: 6,
            maxBombs: 6,
            maxRockets: 5,
        });
    });

    it('statsForUpgrades(undefined) gives the base values', () => {
        expect(statsForUpgrades(undefined)).toEqual({
            moveDuration: CONFIG.PLAYER.MOVE_DURATION,
            maxFuel: CONFIG.FUEL.MAX,
            maxDamage: CONFIG.DAMAGE.MAX_HITS,
            maxBombs: CONFIG.PLAYER.MAX_BOMBS,
            maxRockets: CONFIG.ROCKET.MAX_CARRY,
        });
    });
});
