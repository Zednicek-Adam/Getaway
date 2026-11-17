import { describe, it, expect } from 'vitest';
import { gameSizeFor, viewScales, STAGE_WIDTH, STAGE_HEIGHT } from '../src/screen';

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

describe('viewScales', () => {
    it('leaves a desktop alone', () => {
        expect(viewScales(0.4, false, true)).toEqual({ mapZoom: 1, uiScale: 1 });
    });

    it('zooms the map and grows the HUD less on a phone held sideways', () => {
        // 844x390 page, 2078x960 canvas: 0.406 CSS px per game pixel
        expect(viewScales(390 / 960, true, true)).toEqual({ mapZoom: 1.25, uiScale: 1.125 });
    });

    it('caps both on a phone held upright', () => {
        // 390x844 page, 1280x2770 canvas: 0.305 CSS px per game pixel
        expect(viewScales(390 / 1280, true, false)).toEqual({ mapZoom: 1.5, uiScale: 1.375 });
    });

    it('leaves a tablet alone', () => {
        // 1180x820 iPad held sideways, 1180x820 upright
        expect(viewScales(820 / 960, true, true)).toEqual({ mapZoom: 1, uiScale: 1 });
        expect(viewScales(820 / 1280, true, false)).toEqual({ mapZoom: 1, uiScale: 1 });
    });

    it('keeps the zoom on eighths, so a tile is a whole number of pixels', () => {
        for (let css = 0.2; css < 1; css += 0.01) {
            const { mapZoom } = viewScales(css, true, false);
            expect(Number.isInteger(mapZoom * 64)).toBe(true);
        }
    });

    it('falls back to no scaling for an unmeasured canvas', () => {
        expect(viewScales(0, true, false)).toEqual({ mapZoom: 1, uiScale: 1 });
    });
});
