// Gamepad support, read straight from the browser Gamepad API.
//
// Polling is split from Phaser on purpose: PadReader turns a plain snapshot
// of buttons + left stick into a list of newly pressed buttons, and is unit
// tested directly. bindPad is the thin Phaser glue that polls once per frame
// and calls a scene's handlers.
//
// Buttons are named after the W3C "standard" mapping (Xbox layout), which
// every major browser applies to common controllers. A PlayStation pad
// reports the same positions: a = Cross, b = Circle, x = Square, y = Triangle.

export const PAD_BUTTONS = {
    a: 0,
    b: 1,
    x: 2,
    y: 3,
    lb: 4,
    rb: 5,
    lt: 6,
    rt: 7,
    select: 8,
    start: 9,
    up: 12,
    down: 13,
    left: 14,
    right: 15,
};

// The stick has to be pushed past PRESS to register a direction, and that
// direction holds until it falls back under RELEASE. The gap stops a stick
// resting near the threshold, or held on a diagonal, from chattering.
const STICK_PRESS = 0.5;
const STICK_RELEASE = 0.3;
// Analog triggers report a value rather than a clean pressed flag on some pads
const TRIGGER_PRESS = 0.5;

const STICK_AXES = {
    up: ['y', -1],
    down: ['y', 1],
    left: ['x', -1],
    right: ['x', 1],
};

// Which way the stick points, or null. `held` is last frame's answer.
export function stickDirection(stick, held) {
    if (held) {
        const [axis, sign] = STICK_AXES[held];
        if (stick[axis] * sign > STICK_RELEASE) return held;
    }
    const { x, y } = stick;
    if (Math.max(Math.abs(x), Math.abs(y)) < STICK_PRESS) return null;
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
    return y > 0 ? 'down' : 'up';
}

// Merges every connected pad into one snapshot, so whichever controller the
// player picks up just works.
export function readPads(pads) {
    const pressed = new Set();
    const stick = { x: 0, y: 0 };
    for (const pad of pads || []) {
        if (!pad || !pad.connected) continue;
        for (const [name, index] of Object.entries(PAD_BUTTONS)) {
            const button = pad.buttons[index];
            if (button && (button.pressed || button.value > TRIGGER_PRESS)) pressed.add(name);
        }
        const x = pad.axes[0] || 0;
        const y = pad.axes[1] || 0;
        if (Math.hypot(x, y) > Math.hypot(stick.x, stick.y)) {
            stick.x = x;
            stick.y = y;
        }
    }
    return { pressed, stick };
}

export class PadReader {
    constructor() {
        this.held = null;
        this.stickHeld = null;
    }

    // Returns the button names that went down since the last poll. The stick
    // reports as up/down/left/right, the same as the D-pad.
    //
    // The first poll only records state. A scene usually opens because a
    // button was pressed, and that button is still down when the new scene
    // starts polling; it must not count as a fresh press there.
    poll({ pressed, stick }) {
        const stickDir = stickDirection(stick, this.stickHeld);
        const first = this.held === null;
        const events = [];

        if (!first) {
            for (const name of pressed) {
                if (!this.held.has(name)) events.push(name);
            }
            // D-pad and stick pushed the same way on one frame is one press
            if (stickDir && stickDir !== this.stickHeld && !events.includes(stickDir)) events.push(stickDir);
        }

        this.held = pressed;
        this.stickHeld = stickDir;
        return events;
    }
}

function browserPads() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    try {
        return navigator.getGamepads();
    } catch {
        // Blocked by a permissions policy, e.g. inside a sandboxed iframe
        return [];
    }
}

export function hasGamepad() {
    return Array.from(browserPads()).some((pad) => pad && pad.connected);
}

// Calls handlers[name]() for each newly pressed button while the scene is
// running. A paused scene gets no update events, so its bindings go quiet
// with it, just like its keyboard listeners. Unbinds itself on shutdown.
export function bindPad(scene, handlers) {
    const reader = new PadReader();
    const poll = () => {
        for (const name of reader.poll(readPads(browserPads()))) {
            if (handlers[name]) handlers[name]();
        }
    };
    scene.events.on('update', poll);
    scene.events.once('shutdown', () => scene.events.off('update', poll));
}
