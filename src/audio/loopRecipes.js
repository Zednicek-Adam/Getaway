// Looping police sounds: one per unit with its light bar on, plus the
// helicopter's rotor. sound.js builds them with Web Audio; policeSoundscape.js
// sets each one's level and pan from where the unit is. Pure and Phaser-free
// so the table and the mix are unit-testable.
//
// A siren is an oscillator whose pitch an LFO sweeps between `low` and
// `high` Hz, `rate` times a second. The LFO's shape is the siren's pattern: a
// triangle glides (wail, yelp), a square jumps (hi-lo). A rotor is noise
// chopped `chop` times a second, over a low thump at `thump` Hz.

export const LOOPS = {
    // Patrol car: the long rise and fall
    wail: { kind: 'siren', wave: 'square', sweep: 'triangle', low: 650, high: 1350, rate: 0.32, cutoff: 2400, vol: 0.09 },
    // Patrol car: the European two-tone
    hilo: { kind: 'siren', wave: 'square', sweep: 'square', low: 740, high: 988, rate: 0.85, cutoff: 2200, vol: 0.08 },
    // SWAT van: lower, rougher and much faster
    yelp: { kind: 'siren', wave: 'sawtooth', sweep: 'triangle', low: 420, high: 820, rate: 3.4, cutoff: 1500, vol: 0.1 },
    // Helicopter
    rotor: { kind: 'rotor', chop: 10, cutoff: 420, thump: 52, vol: 0.22 },
};

// Patrol cars take turns between these, so two of them on your tail don't
// sound like one
export const PATROL_SIRENS = ['wail', 'hilo'];
export const SWAT_SIREN = 'yelp';

// How far away (in px) a sound fades to nothing, and how far to one side it
// sits fully in that speaker. A tile is 64 px.
export const HEARING = {
    siren: { range: 14 * 64, panWidth: 8 * 64 },
    rotor: { range: 18 * 64, panWidth: 8 * 64 },
};

// Level (0..1) and stereo pan (-1..1) for a sound source dx, dy px from the
// player. The level falls off with the square of the distance, so a unit is
// faint at the edge of hearing and loud when it's on your bumper. Pan stops
// short of hard left/right so nothing goes silent in one ear.
export function spatialMix(dx, dy, { range, panWidth }) {
    const near = Math.max(0, 1 - Math.hypot(dx, dy) / range);
    const side = Math.max(-1, Math.min(1, dx / panWidth));
    return { level: near * near, pan: side * 0.75 };
}
