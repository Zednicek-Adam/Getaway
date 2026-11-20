// Music and sound effects for the whole game. One module-level player: Phaser's
// sound manager belongs to the game, not a scene, so a track keeps playing
// across scene changes and only stops when another one takes over.
//
// The two tracks are loops rendered from the Strudel sources in tools/music
// (see the README there). Effects are synthesised from sfxRecipes.js on the
// fly, routed through Phaser's master output so they pause with the game
// when the tab loses focus. Sirens and the helicopter rotor are endless
// loops built from loopRecipes.js (see createLoop).
import { SFX } from './sfxRecipes';
import { LOOPS } from './loopRecipes';
import { loadAudioMode, saveAudioMode, nextAudioMode, musicAllowed, sfxAllowed } from './audioSettings';
import { getBrowserStorage } from '../storage';

// The title theme plays on the menu screens, the gameplay loop during a run
export const MUSIC = {
    theme: { key: 'music-theme', volume: 0.5 },
    gameplay: { key: 'music-gameplay', volume: 0.45 },
};

const SFX_VOLUME = 0.9;
const DUCKED = 0.35;     // share of the music volume left under the pause menu and garage
const FADE_IN_S = 0.3;
const FADE_OUT_S = 0.6;
const REPEAT_GUARD_S = 0.03; // the same effect twice inside this window plays once

let game = null;
let mode = 'on';
let wanted = null;   // the track the current screen asked for, even while music is off
let current = null;  // { name, sound } actually playing
let ducked = false;
let sfxBus = null;
let loopBus = null;  // sirens and rotor, on their own gain so a pause can mute them
let noiseBuffer = null;
const lastPlayed = {};

// BootScene: queue both tracks. Browsers without Ogg Vorbis (Safari) take the
// AAC copy.
export function loadMusic(loader) {
    for (const [name, { key }] of Object.entries(MUSIC)) {
        loader.audio(key, [`audio/${name}.ogg`, `audio/${name}.m4a`]);
    }
}

// BootScene, once: remember the game and read the saved setting
export function initSound(phaserGame) {
    game = phaserGame;
    mode = loadAudioMode(getBrowserStorage());
}

export function getAudioMode() {
    return mode;
}

// The menu toggle: on -> effects only -> off -> on. Returns the new mode.
export function cycleAudioMode() {
    mode = nextAudioMode(mode);
    saveAudioMode(getBrowserStorage(), mode);
    if (!musicAllowed(mode)) {
        fadeOut(0.2);
    } else if (wanted && !current) {
        start(wanted);
    }
    return mode;
}

// Ask for a track. Already playing, it carries on (un-ducked) unless
// `restart` asks for it from the top; otherwise the old track fades out under
// the new one.
export function playMusic(name, { restart = false } = {}) {
    wanted = name;
    ducked = false;
    if (!musicAllowed(mode)) return;
    if (current && current.name === name && !restart) {
        ramp(current.sound, level(name), FADE_IN_S);
        return;
    }
    fadeOut(FADE_OUT_S);
    start(name);
}

// Fade the music out and forget it (the run is over)
export function stopMusic(seconds = FADE_OUT_S) {
    wanted = null;
    fadeOut(seconds);
}

// Pull the music down under an overlay, or bring it back
export function duckMusic(on) {
    ducked = on;
    if (current) ramp(current.sound, level(current.name), 0.15);
}

// Fire a named effect from SFX. Skipped while the audio context is still
// locked (before the first click or key press) so effects don't pile up and
// burst out all at once on unlock.
export function sfx(name) {
    if (!sfxAllowed(mode)) return;
    const ctx = webAudio();
    const voices = SFX[name];
    if (!ctx || ctx.state !== 'running' || !voices) return;

    const now = ctx.currentTime;
    if (now - (lastPlayed[name] ?? -1) < REPEAT_GUARD_S) return;
    lastPlayed[name] = now;

    const bus = getBus(ctx);
    for (const voice of voices) playVoice(ctx, bus, voice, now + 0.005);
}

export function effectsOn() {
    return sfxAllowed(mode);
}

// Start a looping sound from LOOPS (sirens, the rotor). Returns a handle:
// set(level, pan) moves it, stop() fades it out and frees it. null when
// effects are off or there's no Web Audio. `detune` scales the pitch and
// `pace` the sweep speed, so each unit sounds a little different.
export function createLoop(name, { detune = 1, pace = 1 } = {}) {
    const recipe = LOOPS[name];
    const ctx = webAudio();
    if (!recipe || !ctx || !sfxAllowed(mode)) return null;

    const level = ctx.createGain();
    level.gain.value = 0;
    const panner = ctx.createStereoPanner();
    level.connect(panner);
    panner.connect(getLoopBus(ctx));

    const sources = recipe.kind === 'rotor'
        ? buildRotor(ctx, recipe, level, pace)
        : buildSiren(ctx, recipe, level, detune, pace);
    const now = ctx.currentTime;
    for (const source of sources) source.start(now);

    let stopped = false;
    return {
        set(amount, pan) {
            if (stopped) return;
            const t = ctx.currentTime;
            level.gain.setTargetAtTime(recipe.vol * amount, t, 0.05);
            panner.pan.setTargetAtTime(pan, t, 0.05);
        },
        stop() {
            if (stopped) return;
            stopped = true;
            const t = ctx.currentTime;
            level.gain.cancelScheduledValues(t);
            level.gain.setTargetAtTime(0, t, 0.06);
            for (const source of sources) source.stop(t + 0.4);
            sources[0].onended = () => panner.disconnect();
        },
    };
}

// Silence every loop at once (the game paused under a menu), or bring them back
export function setLoopsMuted(on) {
    const ctx = webAudio();
    if (!ctx) return;
    const bus = getLoopBus(ctx);
    bus.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.04);
}

// Oscillator -> lowpass -> level, its pitch swept by an LFO
function buildSiren(ctx, recipe, out, detune, pace) {
    const low = recipe.low * detune;
    const high = recipe.high * detune;
    const tone = ctx.createOscillator();
    tone.type = recipe.wave;
    tone.frequency.value = (low + high) / 2;

    const lfo = ctx.createOscillator();
    lfo.type = recipe.sweep;
    lfo.frequency.value = recipe.rate * pace;
    const depth = ctx.createGain();
    depth.gain.value = (high - low) / 2;
    lfo.connect(depth);
    depth.connect(tone.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = recipe.cutoff;
    tone.connect(filter);
    filter.connect(out);
    return [tone, lfo];
}

// Lowpassed noise and a low sine, both chopped by a sawtooth LFO: one blade
// pass per LFO cycle
function buildRotor(ctx, recipe, out, pace) {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoise(ctx);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = recipe.cutoff;
    noise.connect(filter);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.value = recipe.thump;
    const thumpLevel = ctx.createGain();
    thumpLevel.gain.value = 0.6;
    thump.connect(thumpLevel);

    // The chop gain swings 0..1: a 0.5 base plus an LFO of depth 0.5
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = recipe.chop * pace;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth);
    depth.connect(chop.gain);

    filter.connect(chop);
    thumpLevel.connect(chop);
    chop.connect(out);
    return [noise, thump, lfo];
}

function getLoopBus(ctx) {
    if (!loopBus || loopBus.context !== ctx) {
        loopBus = ctx.createGain();
        loopBus.connect(getBus(ctx));
    }
    return loopBus;
}

// --- music internals ---------------------------------------------------

function level(name) {
    return MUSIC[name].volume * (ducked ? DUCKED : 1);
}

function start(name) {
    const { key } = MUSIC[name];
    // A track that failed to load is skipped; the game plays on in silence
    if (!game || !game.cache.audio.exists(key)) return;
    const sound = game.sound.add(key, { loop: true, volume: 0 });
    sound.play();
    current = { name, sound };
    ramp(sound, level(name), FADE_IN_S);
}

function fadeOut(seconds) {
    if (!current) return;
    const { sound } = current;
    current = null;
    if (seconds <= 0 || !sound.volumeNode) {
        sound.destroy();
        return;
    }
    ramp(sound, 0, seconds);
    setTimeout(() => sound.destroy(), seconds * 1000 + 50);
}

// Glide a track's volume. Web Audio ramps its gain node directly; the HTML5
// audio fallback just jumps.
function ramp(sound, to, seconds) {
    const ctx = webAudio();
    const node = sound.volumeNode;
    if (!ctx || !node) {
        sound.setVolume(to);
        return;
    }
    const now = ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(to, now + seconds);
}

// --- effect internals --------------------------------------------------

function webAudio() {
    return game && game.sound && game.sound.context ? game.sound.context : null;
}

function getBus(ctx) {
    if (!sfxBus || sfxBus.context !== ctx) {
        sfxBus = ctx.createGain();
        sfxBus.gain.value = SFX_VOLUME;
        sfxBus.connect(game.sound.destination);
    }
    return sfxBus;
}

// One second of white noise, looped by every noise voice
function getNoise(ctx) {
    if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

function playVoice(ctx, bus, voice, base) {
    const t0 = base + voice.at;
    const t1 = t0 + voice.dur;

    let source;
    if (voice.wave === 'noise') {
        source = ctx.createBufferSource();
        source.buffer = getNoise(ctx);
        source.loop = true;
    } else {
        source = ctx.createOscillator();
        source.type = voice.wave;
        source.frequency.setValueAtTime(voice.freq, t0);
        if (voice.to) source.frequency.exponentialRampToValueAtTime(voice.to, t1);
    }

    let out = source;
    if (voice.filter) {
        const { type, freq, to, q } = voice.filter;
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.setValueAtTime(freq, t0);
        if (to) filter.frequency.exponentialRampToValueAtTime(to, t1);
        if (q) filter.Q.value = q;
        source.connect(filter);
        out = filter;
    }

    // A 4 ms attack keeps the start click-free; then hold or fade
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(voice.vol, t0 + 0.004);
    if (voice.flat) {
        gain.gain.setValueAtTime(voice.vol, t1 - 0.01);
        gain.gain.linearRampToValueAtTime(0, t1);
    } else {
        gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    }
    out.connect(gain);
    gain.connect(bus);

    source.start(t0);
    source.stop(t1 + 0.02);
    source.onended = () => gain.disconnect();
}
