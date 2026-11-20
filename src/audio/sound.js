// Music and sound effects for the whole game. One module-level player: Phaser's
// sound manager belongs to the game, not a scene, so a track keeps playing
// across scene changes and only stops when another one takes over.
//
// The two tracks are loops rendered from the Strudel sources in tools/music
// (see the README there). Effects are synthesised from sfxRecipes.js on the
// fly, routed through Phaser's master output so they pause with the game
// when the tab loses focus.
import { SFX } from './sfxRecipes';
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
