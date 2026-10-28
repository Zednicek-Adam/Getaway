import { describe, it, expect } from 'vitest';
import { gameSizeFor, STAGE_WIDTH, STAGE_HEIGHT } from '../src/screen';

describe('gameSizeFor', () => {
    it('keeps the design size when not filling the page', () => {
        expect(gameSizeFor(844, 390, false)).toEqual({ width: STAGE_WIDTH, height: STAGE_HEIGHT });
    });

    it('widens the canvas for a phone held sideways', () => {
        // 844x390 is about 2.16:1; the height stays 960
        expect(gameSizeFor(844, 390, true)).toEqual({ width: 2078, height: 960 });
    });

    it('lengthens the canvas for a phone held upright', () => {
        expect(gameSizeFor(390, 844, true)).toEqual({ width: 1280, height: 2770 });
    });

    it('matches the page shape on both sides of 4:3', () => {
        for (const [w, h] of [[1024, 768], [768, 1024], [1180, 820], [2400, 1080]]) {
            const size = gameSizeFor(w, h, true);
            expect(size.width).toBeGreaterThanOrEqual(STAGE_WIDTH);
            expect(size.height).toBeGreaterThanOrEqual(STAGE_HEIGHT);
            expect(size.width / size.height).toBeCloseTo(w / h, 2);
            expect(size.width % 2).toBe(0);
            expect(size.height % 2).toBe(0);
        }
    });

    it('falls back to the design size for an unmeasured page', () => {
        expect(gameSizeFor(0, 0, true)).toEqual({ width: STAGE_WIDTH, height: STAGE_HEIGHT });
    });
});
