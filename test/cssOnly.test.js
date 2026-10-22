import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Pure HTML and CSS Getaway Game Verification', () => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    const cssPath = path.resolve(__dirname, '../style.css');

    it('index.html exists and contains ZERO <script> tags (No JavaScript allowed)', () => {
        expect(fs.existsSync(htmlPath)).toBe(true);
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Verify absolutely no script tags exist in index.html
        expect(html.toLowerCase()).not.toContain('<script');
        expect(html.toLowerCase()).not.toContain('</script>');
        expect(html.toLowerCase()).not.toContain('javascript:');
        expect(html.toLowerCase()).not.toContain('onload=');
        expect(html.toLowerCase()).not.toContain('onclick=');
    });

    it('contains all required screens and state management inputs', () => {
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Screens: Menu, Play, Instructions, Garage, GameOver, Victory
        expect(html).toContain('id="screen-menu"');
        expect(html).toContain('id="screen-play"');
        expect(html).toContain('id="screen-instructions"');
        expect(html).toContain('id="screen-garage"');
        expect(html).toContain('id="screen-gameover"');
        expect(html).toContain('id="screen-victory"');

        // Language toggle (EN / ES)
        expect(html).toContain('id="lang-toggle"');

        // Pause toggle
        expect(html).toContain('id="pause-toggle"');

        // 4 steering lanes
        expect(html).toContain('id="lane-1"');
        expect(html).toContain('id="lane-2"');
        expect(html).toContain('id="lane-3"');
        expect(html).toContain('id="lane-4"');

        // Health and damage
        expect(html).toContain('id="damage-1"');
        expect(html).toContain('id="damage-2"');
        expect(html).toContain('id="damage-3"');

        // Action weapons
        expect(html).toContain('id="fire-rocket"');
        expect(html).toContain('id="drop-bomb"');

        // Safehouse and Refuel pads
        expect(html).toContain('id="refuel-action"');
        expect(html).toContain('id="bank-action"');
    });

    it('contains bilingual text for English and Spanish', () => {
        const html = fs.readFileSync(htmlPath, 'utf-8');
        expect(html).toContain('lang-en');
        expect(html).toContain('lang-es');
        expect(html).toContain('PLAY GAME');
        expect(html).toContain('JUGAR');
        expect(html).toContain('GARAGE');
        expect(html).toContain('TALLER');
        expect(html).toContain('BUSTED!');
        expect(html).toContain('¡ATRAPADO!');
        expect(html).toContain('ESCAPED!');
        expect(html).toContain('¡ESCAPASTE!');
    });

    it('style.css defines state machines, CSS counters, and arcade animations', () => {
        expect(fs.existsSync(cssPath)).toBe(true);
        const css = fs.readFileSync(cssPath, 'utf-8');

        // CSS Counters
        expect(css).toContain('counter-reset:');
        expect(css).toContain('counter-increment:');
        expect(css).toContain('counter(carried)');
        expect(css).toContain('counter(banked)');

        // Modern CSS Selectors for state
        expect(css).toContain(':checked');
        expect(css).toContain(':has(');

        // Core animations
        expect(css).toContain('@keyframes roadDrive');
        expect(css).toContain('@keyframes parallaxScroll');
        expect(css).toContain('@keyframes policeSiren');
        expect(css).toContain('@keyframes rotorSpin');
        expect(css).toContain('@keyframes spinCoin');
        expect(css).toContain('@keyframes rocketFly');
    });
});
