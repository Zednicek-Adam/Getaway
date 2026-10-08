import { describe, it, expect } from 'vitest';
import { PadReader, readPads, stickDirection, PAD_BUTTONS } from '../src/gamepad';

// A Gamepad-shaped object with the named buttons held
function fakePad({ down = [], values = {}, axes = [0, 0], connected = true } = {}) {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    for (const name of down) buttons[PAD_BUTTONS[name]] = { pressed: true, value: 1 };
    for (const [name, value] of Object.entries(values)) buttons[PAD_BUTTONS[name]] = { pressed: false, value };
    return { connected, buttons, axes };
}

function snap(down = [], stick = { x: 0, y: 0 }) {
    return { pressed: new Set(down), stick };
}

describe('stickDirection', () => {
    it('ignores a stick resting inside the dead zone', () => {
        expect(stickDirection({ x: 0.2, y: -0.4 }, null)).toBe(null);
    });

    it('picks the dominant axis', () => {
        expect(stickDirection({ x: 0.9, y: 0.6 }, null)).toBe('right');
        expect(stickDirection({ x: -0.3, y: -0.8 }, null)).toBe('up');
        expect(stickDirection({ x: 0.1, y: 0.7 }, null)).toBe('down');
        expect(stickDirection({ x: -0.7, y: 0 }, null)).toBe('left');
    });

    it('keeps the held direction until it drops below the release threshold', () => {
        // Below PRESS but above RELEASE: still held
        expect(stickDirection({ x: 0, y: -0.4 }, 'up')).toBe('up');
        // A diagonal that now leans right does not flip away from up
        expect(stickDirection({ x: 0.8, y: -0.6 }, 'up')).toBe('up');
        // Up fully released
        expect(stickDirection({ x: 0, y: -0.2 }, 'up')).toBe(null);
        expect(stickDirection({ x: 0.8, y: -0.2 }, 'up')).toBe('right');
    });
});

describe('readPads', () => {
    it('handles a missing or empty pad list', () => {
        expect(readPads(null).pressed.size).toBe(0);
        expect(readPads([null, null]).pressed.size).toBe(0);
    });

    it('merges buttons across every connected pad', () => {
        const { pressed } = readPads([fakePad({ down: ['a'] }), null, fakePad({ down: ['start', 'up'] })]);
        expect([...pressed].sort()).toEqual(['a', 'start', 'up']);
    });

    it('skips disconnected pads', () => {
        expect(readPads([fakePad({ down: ['a'], connected: false })]).pressed.size).toBe(0);
    });

    it('counts an analog trigger past halfway as pressed', () => {
        expect(readPads([fakePad({ values: { rt: 0.3 } })]).pressed.has('rt')).toBe(false);
        expect(readPads([fakePad({ values: { rt: 0.8 } })]).pressed.has('rt')).toBe(true);
    });

    it('takes the stick pushed furthest', () => {
        const { stick } = readPads([fakePad({ axes: [0.1, 0.1] }), fakePad({ axes: [0, -0.9] })]);
        expect(stick).toEqual({ x: 0, y: -0.9 });
    });
});

describe('PadReader', () => {
    it('swallows whatever is already held on the first poll', () => {
        const reader = new PadReader();
        expect(reader.poll(snap(['a'], { x: 1, y: 0 }))).toEqual([]);
        // Still held: not a new press
        expect(reader.poll(snap(['a'], { x: 1, y: 0 }))).toEqual([]);
    });

    it('reports a button once per press', () => {
        const reader = new PadReader();
        reader.poll(snap());
        expect(reader.poll(snap(['x']))).toEqual(['x']);
        expect(reader.poll(snap(['x']))).toEqual([]);
        reader.poll(snap());
        expect(reader.poll(snap(['x']))).toEqual(['x']);
    });

    it('reports the stick as a direction once per push', () => {
        const reader = new PadReader();
        reader.poll(snap());
        expect(reader.poll(snap([], { x: 0, y: -1 }))).toEqual(['up']);
        expect(reader.poll(snap([], { x: 0, y: -1 }))).toEqual([]);
        // Swinging straight across to another direction is a new press
        expect(reader.poll(snap([], { x: 1, y: 0 }))).toEqual(['right']);
        reader.poll(snap());
        expect(reader.poll(snap([], { x: 1, y: 0 }))).toEqual(['right']);
    });

    it('counts the D-pad and stick pushed the same way together as one press', () => {
        const reader = new PadReader();
        reader.poll(snap());
        expect(reader.poll(snap(['left'], { x: -1, y: 0 }))).toEqual(['left']);
    });
});
