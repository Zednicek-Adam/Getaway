import { describe, it, expect, beforeEach } from 'vitest';
import {
    STRINGS, LANGUAGES, LANG_KEY, t, getLanguage, initLanguage, setLanguage, nextLanguage,
} from '../src/i18n';

function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => { data.set(k, String(v)); },
        removeItem: (k) => { data.delete(k); },
    };
}

const throwingStorage = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
};

describe('i18n', () => {
    beforeEach(() => {
        initLanguage(memoryStorage(), 'en-US');
    });

    describe('string tables', () => {
        it('has a table for every language', () => {
            expect(Object.keys(STRINGS).sort()).toEqual([...LANGUAGES].sort());
        });

        it('every language has exactly the English keys', () => {
            const english = Object.keys(STRINGS.en).sort();
            for (const lang of LANGUAGES) {
                expect(Object.keys(STRINGS[lang]).sort()).toEqual(english);
            }
        });

        it('every language uses the same placeholders per key', () => {
            const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort();
            for (const lang of LANGUAGES) {
                for (const [key, text] of Object.entries(STRINGS.en)) {
                    expect(placeholders(STRINGS[lang][key]), `${lang} ${key}`).toEqual(placeholders(text));
                }
            }
        });

        // Press Start 2P covers Latin-1 but nothing beyond it (em dashes,
        // curly quotes, arrows), and the UI is all capitals
        it('only uses glyphs the pixel font has, in upper case', () => {
            for (const lang of LANGUAGES) {
                for (const [key, text] of Object.entries(STRINGS[lang])) {
                    expect(text, `${lang} ${key}`).toMatch(/^[ -~ -ÿ]+$/);
                    const shown = text.replace(/\{\w+\}/g, '');
                    expect(shown, `${lang} ${key}`).toBe(shown.toUpperCase());
                }
            }
        });

        // The font's accented capitals look like lower case; see i18n.js
        it('drops the acute accent on capital vowels', () => {
            for (const lang of LANGUAGES) {
                for (const [key, text] of Object.entries(STRINGS[lang])) {
                    expect(text, `${lang} ${key}`).not.toMatch(/[ÁÉÍÓÚ]/);
                }
            }
        });
    });

    describe('t', () => {
        it('returns the string for the current language', () => {
            expect(t('menu.start')).toBe('START');
            setLanguage(memoryStorage(), 'es');
            expect(t('menu.start')).toBe('JUGAR');
        });

        it('fills placeholders', () => {
            setLanguage(memoryStorage(), 'es');
            expect(t('toast.banked', { amount: '$300' })).toBe('+$300 AL BANCO');
        });

        it('leaves a placeholder alone when its param is missing', () => {
            expect(t('toast.banked', {})).toBe('+{amount} BANKED');
        });

        it('falls back to the key for an unknown string', () => {
            expect(t('no.such.key')).toBe('no.such.key');
        });
    });

    describe('initLanguage', () => {
        it('prefers a saved choice over the browser language', () => {
            expect(initLanguage(memoryStorage({ [LANG_KEY]: 'en' }), 'es-ES')).toBe('en');
        });

        it('falls back to the browser language, ignoring the region', () => {
            expect(initLanguage(memoryStorage(), 'es-MX')).toBe('es');
            expect(initLanguage(memoryStorage(), 'ES')).toBe('es');
        });

        it('defaults to English for unsupported or missing languages', () => {
            expect(initLanguage(memoryStorage({ [LANG_KEY]: 'xx' }), 'cs-CZ')).toBe('en');
            expect(initLanguage(memoryStorage(), undefined)).toBe('en');
        });

        it('survives storage that throws', () => {
            expect(initLanguage(throwingStorage, 'es')).toBe('es');
        });
    });

    describe('setLanguage', () => {
        it('switches and persists the choice', () => {
            const storage = memoryStorage();
            expect(setLanguage(storage, 'es')).toBe('es');
            expect(getLanguage()).toBe('es');
            expect(storage.getItem(LANG_KEY)).toBe('es');
            expect(initLanguage(storage, 'en')).toBe('es');
        });

        it('ignores unknown languages', () => {
            const storage = memoryStorage();
            expect(setLanguage(storage, 'xx')).toBe('en');
            expect(storage.getItem(LANG_KEY)).toBeNull();
        });

        it('still switches when storage throws', () => {
            expect(setLanguage(throwingStorage, 'es')).toBe('es');
        });
    });

    it('nextLanguage cycles through every language', () => {
        expect(nextLanguage()).toBe('es');
        setLanguage(memoryStorage(), 'es');
        expect(nextLanguage()).toBe('en');
    });
});
