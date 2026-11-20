// Every sound effect as data: a list of voices that sound.js synthesises on
// the fly with Web Audio, so effects cost no downloads. The voices are the
// same NES-style channels the theme uses: square and triangle tones plus a
// noise channel. Pure and Phaser-free so the table is unit-testable.
//
// A voice:
//   wave    'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise'
//   at      start, in seconds from the trigger
//   dur     length in seconds; the voice fades out over it
//   vol     peak gain (0..1)
//   freq    pitch in Hz (tones only); `to` slides the pitch there over dur
//   filter  optional { type, freq, to, q }: a biquad, `to` sweeps its cutoff
//   flat    true holds the volume to the end instead of fading from the start

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 'E6' / 'F#5' / 'Bb3' -> Hz (A4 = 440)
export function noteFreq(name) {
    const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!match) throw new Error(`bad note ${name}`);
    const [, letter, accidental, octave] = match;
    const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
    const midi = 12 * (Number(octave) + 1) + SEMITONES[letter] + shift;
    return 440 * 2 ** ((midi - 69) / 12);
}

// A run of notes, one every `step` seconds, each ringing for `ring` seconds
function melody(wave, notes, { step, ring = step, vol, at = 0 }) {
    return notes.map((note, i) => ({ wave, at: at + i * step, dur: ring, vol, freq: noteFreq(note) }));
}

export const SFX = {
    // --- menus ---------------------------------------------------------
    menuMove: [{ wave: 'square', at: 0, dur: 0.04, vol: 0.08, freq: noteFreq('E6') }],
    menuSelect: melody('square', ['B5', 'E6'], { step: 0.05, ring: 0.08, vol: 0.1 }),

    // --- pickups -------------------------------------------------------
    // The classic two-note coin
    coin: [
        { wave: 'square', at: 0, dur: 0.06, vol: 0.1, freq: noteFreq('B5') },
        { wave: 'square', at: 0.06, dur: 0.22, vol: 0.1, freq: noteFreq('E6') },
    ],
    // Bomb, rocket, armor, nitro: a quick rising triad
    powerUp: melody('triangle', ['E5', 'G#5', 'B5', 'E6'], { step: 0.045, ring: 0.09, vol: 0.32 }),
    life: melody('square', ['E5', 'G5', 'E6', 'C6', 'D6', 'G6'], { step: 0.08, ring: 0.1, vol: 0.08 }),
    // Ramming the diamond car: a glittering run with a softer echo behind it
    diamond: [
        ...melody('square', ['E6', 'G6', 'B6', 'E7'], { step: 0.05, ring: 0.12, vol: 0.08 }),
        ...melody('square', ['E6', 'G6', 'B6', 'E7'], { step: 0.05, ring: 0.12, vol: 0.03, at: 0.12 }),
        { wave: 'noise', at: 0, dur: 0.35, vol: 0.05, filter: { type: 'highpass', freq: 7000 } },
    ],
    // Depositing at the safehouse: register bell over a cash-drawer rattle
    bank: [
        { wave: 'noise', at: 0, dur: 0.08, vol: 0.12, filter: { type: 'highpass', freq: 5000 } },
        ...melody('square', ['B5', 'E6', 'G#6', 'B6'], { step: 0.06, ring: 0.1, vol: 0.09 }),
        { wave: 'triangle', at: 0.24, dur: 0.5, vol: 0.3, freq: noteFreq('E6') },
    ],

    // --- heat ------------------------------------------------------------
    // A star gained: a quick hi-lo blip, the music's siren in miniature
    wanted: melody('square', ['D6', 'A5', 'D6', 'A5'], { step: 0.09, ring: 0.08, vol: 0.06 }),
    // Back to 0 stars: lost them
    escaped: melody('triangle', ['D5', 'F5', 'A5', 'D6'], { step: 0.07, ring: 0.16, vol: 0.3 }),

    // --- the police ------------------------------------------------------
    // A roadblock dropping into the road ahead: barriers hitting tarmac
    roadblock: [
        { wave: 'square', at: 0, dur: 0.12, vol: 0.07, freq: 220, to: 160 },
        { wave: 'noise', at: 0, dur: 0.1, vol: 0.2, filter: { type: 'bandpass', freq: 2500, q: 3 } },
        { wave: 'square', at: 0.11, dur: 0.12, vol: 0.06, freq: 200, to: 140 },
        { wave: 'noise', at: 0.11, dur: 0.1, vol: 0.16, filter: { type: 'bandpass', freq: 2200, q: 3 } },
    ],
    // A SWAT van taking a hit and staying up: armour ringing
    clang: [
        { wave: 'square', at: 0, dur: 0.35, vol: 0.06, freq: 1250, to: 1150 },
        { wave: 'triangle', at: 0, dur: 0.45, vol: 0.2, freq: 1870 },
        { wave: 'noise', at: 0, dur: 0.06, vol: 0.2, filter: { type: 'highpass', freq: 3000 } },
    ],

    // --- weapons ---------------------------------------------------------
    bombDrop: [
        { wave: 'triangle', at: 0, dur: 0.09, vol: 0.4, freq: 330, to: 110 },
        { wave: 'noise', at: 0, dur: 0.03, vol: 0.08, filter: { type: 'highpass', freq: 3000 } },
    ],
    explosion: [
        { wave: 'noise', at: 0, dur: 0.7, vol: 0.45, filter: { type: 'lowpass', freq: 3000, to: 120 } },
        { wave: 'sine', at: 0, dur: 0.35, vol: 0.5, freq: 110, to: 35 },
    ],
    // A rocket that ran out of road or range
    fizzle: [{ wave: 'noise', at: 0, dur: 0.18, vol: 0.15, filter: { type: 'bandpass', freq: 1800, to: 600, q: 2 } }],
    rocket: [
        { wave: 'noise', at: 0, dur: 0.4, vol: 0.18, filter: { type: 'bandpass', freq: 700, to: 3500, q: 1.5 } },
        { wave: 'square', at: 0, dur: 0.25, vol: 0.05, freq: 220, to: 880 },
    ],
    nitro: [
        { wave: 'sawtooth', at: 0, dur: 0.5, vol: 0.12, freq: 110, to: 660, filter: { type: 'lowpass', freq: 800, to: 4000 } },
        { wave: 'noise', at: 0, dur: 0.5, vol: 0.12, filter: { type: 'highpass', freq: 1500, to: 6000 } },
    ],

    // --- the car ---------------------------------------------------------
    ram: [
        { wave: 'noise', at: 0, dur: 0.16, vol: 0.35, filter: { type: 'lowpass', freq: 1500, to: 200 } },
        { wave: 'square', at: 0, dur: 0.12, vol: 0.08, freq: 140, to: 60 },
    ],
    crash: [
        { wave: 'noise', at: 0, dur: 0.35, vol: 0.45, filter: { type: 'lowpass', freq: 2500, to: 150 } },
        { wave: 'square', at: 0, dur: 0.2, vol: 0.1, freq: 120, to: 40 },
        { wave: 'noise', at: 0.05, dur: 0.25, vol: 0.08, filter: { type: 'highpass', freq: 4000 } },
    ],
    // Losing a life: a falling square and a crunch
    busted: [
        { wave: 'noise', at: 0, dur: 0.3, vol: 0.35, filter: { type: 'lowpass', freq: 2000, to: 150 } },
        { wave: 'square', at: 0.05, dur: 0.6, vol: 0.09, freq: noteFreq('E5'), to: noteFreq('E3') },
    ],
    // Out of lives, about 3.5 s, in the gameplay track's D minor. A siren
    // right on top of you and screeching tyres; the cell door slams as the
    // GAME OVER panel lands (it bounces in over ~0.5 s); then a falling riff
    // over a walking bass, ending on a long D minor chord whose top note sags.
    gameOver: [
        // The cops pull up
        ...melody('square', ['D6', 'A5', 'D6'], { step: 0.2, ring: 0.18, vol: 0.07 }),
        { wave: 'noise', at: 0, dur: 0.45, vol: 0.08, filter: { type: 'bandpass', freq: 3200, to: 1400, q: 8 } },
        // The door slams
        { wave: 'noise', at: 0.62, dur: 0.32, vol: 0.45, filter: { type: 'lowpass', freq: 900, to: 90 } },
        { wave: 'sine', at: 0.62, dur: 0.3, vol: 0.5, freq: 95, to: 40 },
        // The riff, and the slow sag at its end
        ...melody('square', ['A5', 'G5', 'F5', 'E5'], { step: 0.14, ring: 0.13, vol: 0.09, at: 0.95 }),
        { wave: 'square', at: 1.51, dur: 0.3, vol: 0.09, freq: noteFreq('D5') },
        { wave: 'square', at: 1.85, dur: 0.3, vol: 0.09, freq: noteFreq('C#5') },
        { wave: 'square', at: 2.2, dur: 1.3, vol: 0.09, freq: noteFreq('A5'), to: noteFreq('F5') },
        // Bass: D, Bb, A, then down to the low D
        { wave: 'triangle', at: 0.95, dur: 0.5, vol: 0.4, freq: noteFreq('D3') },
        { wave: 'triangle', at: 1.51, dur: 0.32, vol: 0.4, freq: noteFreq('Bb2') },
        { wave: 'triangle', at: 1.85, dur: 0.32, vol: 0.4, freq: noteFreq('A2') },
        { wave: 'triangle', at: 2.2, dur: 1.3, vol: 0.45, freq: noteFreq('D2') },
        // The final chord under the sagging note
        ...['D4', 'F4', 'A4'].map((note) => ({ wave: 'square', at: 2.2, dur: 1.3, vol: 0.035, freq: noteFreq(note) })),
    ],
    push: [{ wave: 'noise', at: 0, dur: 0.07, vol: 0.18, filter: { type: 'lowpass', freq: 500 } }],
    // The engine coughing out as the tank runs dry
    stall: [
        { wave: 'square', at: 0, dur: 0.08, vol: 0.07, freq: 180, to: 120 },
        { wave: 'square', at: 0.14, dur: 0.08, vol: 0.06, freq: 150, to: 100 },
        { wave: 'square', at: 0.3, dur: 0.22, vol: 0.05, freq: 120, to: 50 },
    ],
    // One tick of the pump counter while gas flows
    pump: [{ wave: 'square', at: 0, dur: 0.02, vol: 0.04, freq: noteFreq('B6') }],
    // Refused: no cash for gas, or not enough for an upgrade
    denied: [
        { wave: 'square', at: 0, dur: 0.09, vol: 0.08, freq: 150, flat: true },
        { wave: 'square', at: 0.12, dur: 0.14, vol: 0.08, freq: 150, flat: true },
    ],
    // An upgrade bought in the garage
    buy: melody('square', ['E6', 'B6', 'E7'], { step: 0.06, ring: 0.14, vol: 0.08 }),
};
