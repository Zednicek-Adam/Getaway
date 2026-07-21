import { describe, it, expect } from 'vitest';
import { pickCollectibleType, COLLECTIBLE_TYPES } from '../src/objects/Collectible';
import { CONFIG } from '../src/config';

const WEIGHTS = CONFIG.COLLECTIBLES.WEIGHTS;

// Build [{ type, start, end }] cumulative buckets from the config weights so
// the tests track the table rather than hard-coding boundaries.
function buckets() {
    let cumulative = 0;
    return Object.entries(WEIGHTS).map(([type, weight]) => {
        const start = cumulative;
        cumulative += weight;
        return { type, start, end: cumulative };
    });
}

describe('pickCollectibleType', () => {
    it('roll 0 lands in the first bucket (money)', () => {
        expect(pickCollectibleType(0, WEIGHTS)).toBe(COLLECTIBLE_TYPES.MONEY);
        expect(pickCollectibleType(0, WEIGHTS)).toBe('money');
    });

    it('a roll just inside each cumulative boundary lands in the right bucket', () => {
        for (const bucket of buckets()) {
            // Just past the bucket start (still strictly below its end)
            const roll = bucket.start + (bucket.end - bucket.start) * 0.5;
            expect(pickCollectibleType(roll, WEIGHTS)).toBe(bucket.type);
        }
    });

    it('a roll fractionally below each boundary picks the bucket it closes', () => {
        for (const bucket of buckets()) {
            const roll = bucket.end - 1e-9;
            expect(pickCollectibleType(roll, WEIGHTS)).toBe(bucket.type);
        }
    });

    it('roll 0.9999 lands in the last bucket (life)', () => {
        expect(pickCollectibleType(0.9999, WEIGHTS)).toBe(COLLECTIBLE_TYPES.LIFE);
    });

    it('roll >= 1 falls back to money (float-sum guard)', () => {
        expect(pickCollectibleType(1.5, WEIGHTS)).toBe(COLLECTIBLE_TYPES.MONEY);
        expect(pickCollectibleType(1, WEIGHTS)).toBe(COLLECTIBLE_TYPES.MONEY);
    });

    it('weights sum to approximately 1', () => {
        const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 5);
    });

    it('every weight key is a valid COLLECTIBLE_TYPES value', () => {
        const validTypes = new Set(Object.values(COLLECTIBLE_TYPES));
        for (const key of Object.keys(WEIGHTS)) {
            expect(validTypes.has(key)).toBe(true);
        }
    });
});
