import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    AUDIO_KEY, AUDIO_MODES, loadAudioMode, saveAudioMode, nextAudioMode, musicAllowed, sfxAllowed,
} from '../src/audio/audioSettings';
import { SFX, noteFreq } from '../src/audio/sfxRecipes';
import { LOOPS, PATROL_SIREN, SWAT_SIREN, HEARING, spatialMix } from '../src/audio/loopRecipes';

function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => { data.set(k, String(v)); },
    };
}

const throwingStorage = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
};

describe('audio settings', () => {
    it('defaults to everything on', () => {
        expect(loadAudioMode(memoryStorage())).toBe('on');
        expect(loadAudioMode(memoryStorage({ [AUDIO_KEY]: 'loud' }))).toBe('on');
        expect(loadAudioMode(throwingStorage)).toBe('on');
    });

    it('round-trips a saved mode', () => {
        const storage = memoryStorage();
        saveAudioMode(storage, 'sfx');
        expect(loadAudioMode(storage)).toBe('sfx');
        expect(() => saveAudioMode(throwingStorage, 'off')).not.toThrow();
    });

    it('cycles on -> sfx -> off -> on', () => {
        expect(AUDIO_MODES.map(nextAudioMode)).toEqual(['sfx', 'off', 'on']);
    });

    it('plays music only when on, effects unless off', () => {
        expect(AUDIO_MODES.map(musicAllowed)).toEqual([true, false, false]);
        expect(AUDIO_MODES.map(sfxAllowed)).toEqual([true, true, false]);
    });
});

describe('sound effect recipes', () => {
    it('converts note names to Hz', () => {
        expect(noteFreq('A4')).toBeCloseTo(440);
        expect(noteFreq('A5')).toBeCloseTo(880);
        expect(noteFreq('C4')).toBeCloseTo(261.63, 1);
        expect(noteFreq('F#5')).toBeCloseTo(noteFreq('Gb5'));
        expect(() => noteFreq('H2')).toThrow();
    });

    // Web Audio's exponential ramps throw on a zero or negative target
    it('every voice is playable', () => {
        const waves = ['square', 'triangle', 'sawtooth', 'sine', 'noise'];
        for (const [name, voices] of Object.entries(SFX)) {
            expect(voices.length, name).toBeGreaterThan(0);
            for (const v of voices) {
                expect(waves, name).toContain(v.wave);
                expect(v.at, name).toBeGreaterThanOrEqual(0);
                expect(v.dur, name).toBeGreaterThan(0.01);
                expect(v.vol, name).toBeGreaterThan(0);
                expect(v.vol, name).toBeLessThanOrEqual(1);
                if (v.wave !== 'noise') expect(v.freq, name).toBeGreaterThan(0);
                if ('to' in v) expect(v.to, name).toBeGreaterThan(0);
                if (v.filter) {
                    expect(v.filter.freq, name).toBeGreaterThan(0);
                    if ('to' in v.filter) expect(v.filter.to, name).toBeGreaterThan(0);
                }
            }
        }
    });

    // sfx('name') with a typo would fail silently in the game
    it('every effect the game fires exists', () => {
        const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []);
        const fired = new Set();
        for (const file of files('src')) {
            const source = readFileSync(file, 'utf8');
            for (const [, name] of source.matchAll(/\bsfx\('(\w+)'\)/g)) fired.add(name);
            for (const [, name] of source.matchAll(/\bsound: '(\w+)'/g)) fired.add(name);
        }
        expect(fired.size).toBeGreaterThan(10);
        for (const name of fired) expect(SFX, name).toHaveProperty(name);
    });
});

describe('police loops', () => {
    it('every siren the soundscape picks, and the rotor, exists', () => {
        for (const name of [PATROL_SIREN, SWAT_SIREN, 'rotor']) expect(LOOPS, name).toHaveProperty(name);
    });

    it('patrol cars wail; SWAT vans sound different', () => {
        expect(PATROL_SIREN).toBe('wail');
        expect(SWAT_SIREN).not.toBe(PATROL_SIREN);
    });

    it('every loop is playable', () => {
        for (const [name, loop] of Object.entries(LOOPS)) {
            expect(['siren', 'rotor'], name).toContain(loop.kind);
            expect(loop.vol, name).toBeGreaterThan(0);
            expect(loop.vol, name).toBeLessThanOrEqual(0.3);
            expect(loop.cutoff, name).toBeGreaterThan(0);
            if (loop.kind === 'siren') {
                expect(loop.low, name).toBeGreaterThan(0);
                expect(loop.high, name).toBeGreaterThan(loop.low);
                expect(loop.rate, name).toBeGreaterThan(0);
            }
        }
    });

    it('is loudest on top of the player and silent out of range', () => {
        const ear = HEARING.siren;
        expect(spatialMix(0, 0, ear)).toEqual({ level: 1, pan: 0 });
        expect(spatialMix(ear.range, 0, ear).level).toBe(0);
        expect(spatialMix(0, ear.range * 2, ear).level).toBe(0);
        const near = spatialMix(100, 0, ear).level;
        const far = spatialMix(400, 0, ear).level;
        expect(near).toBeGreaterThan(far);
        expect(far).toBeGreaterThan(0);
    });

    it('pans toward the side the unit is on, never fully', () => {
        const ear = HEARING.siren;
        expect(spatialMix(-200, 0, ear).pan).toBeLessThan(0);
        expect(spatialMix(200, 0, ear).pan).toBeGreaterThan(0);
        expect(spatialMix(0, 300, ear).pan).toBe(0);
        expect(spatialMix(ear.panWidth * 3, 0, ear).pan).toBe(0.75);
    });
});
