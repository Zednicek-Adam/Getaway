// The player's sound setting: everything on, sound effects without music, or
// silence. Pure and Phaser-free; storage is injected (same shape as
// storage.js) so this is unit-testable.

export const AUDIO_KEY = 'getaway-audio';
export const AUDIO_MODES = ['on', 'sfx', 'off'];

export function musicAllowed(mode) {
    return mode === 'on';
}

export function sfxAllowed(mode) {
    return mode !== 'off';
}

// A saved mode wins; anything unreadable or unknown means everything on
export function loadAudioMode(storage) {
    try {
        const saved = storage.getItem(AUDIO_KEY);
        if (AUDIO_MODES.includes(saved)) return saved;
    } catch {
        // unreadable storage: fall through to the default
    }
    return AUDIO_MODES[0];
}

export function saveAudioMode(storage, mode) {
    try {
        storage.setItem(AUDIO_KEY, mode);
    } catch {
        // quota exceeded / private mode: persistence best-effort, swallow
    }
}

// The mode after `mode`, wrapping round (drives the menu toggle)
export function nextAudioMode(mode) {
    const i = AUDIO_MODES.indexOf(mode);
    return AUDIO_MODES[(i + 1) % AUDIO_MODES.length];
}
