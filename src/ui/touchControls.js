import { label, panel, icon, UI_COLORS } from './ui';
import { hasGamepad } from '../gamepad';
import { t } from '../i18n';

// On-screen buttons for phones and tablets: everything the keyboard does
// besides steering, which stays on swipes.
//
// They sit in the two bottom corners, under the thumbs of a phone held
// sideways: weapons and nitro on the right, the brake, the stop-at-the-next-
// pump toggle and push on the left, plus the garage while parked on the base
// pad. Pause sits up top beside the wanted panel, out of the way of a stray
// thumb. 144px is about 44 CSS px once FIT shrinks the 1280px-wide canvas
// onto a phone held upright, the usual minimum for a touch target.

const SIZE = 144;
const PAUSE_SIZE = 128;
const GAP = 16;
const WANTED_PANEL_W = 236; // UIManager's wanted panel, top-right
const DEPTH = 110; // over the HUD (100), under toasts (150) and game over (190)

// Corner grid slot: col 0 hugs the side edge, row 0 the bottom
function corner(side, col, row) {
    return ({ width, height }) => {
        const step = SIZE + GAP;
        const left = side === 'left' ? GAP + col * step : width - GAP - SIZE - col * step;
        return { left, top: height - GAP - SIZE - row * step, size: SIZE };
    };
}

const BUTTONS = [
    { action: 'rocket', at: corner('right', 0, 0), icon: 'rocket', color: UI_COLORS.orange },
    { action: 'bomb', at: corner('right', 1, 0), icon: 'bomb', color: UI_COLORS.white },
    { action: 'nitro', at: corner('right', 0, 1), icon: 'bolt', color: UI_COLORS.cyan },
    { action: 'stop', at: corner('left', 0, 0), color: UI_COLORS.red },
    { action: 'push', at: corner('left', 1, 0), color: UI_COLORS.white },
    { action: 'pump', at: corner('left', 0, 1), icon: 'fuel', color: UI_COLORS.green },
    { action: 'garage', at: corner('left', 1, 1), icon: 'wrench', color: UI_COLORS.gold },
    {
        action: 'pause',
        at: ({ width }) => ({ left: width - GAP - WANTED_PANEL_W - GAP - PAUSE_SIZE, top: GAP, size: PAUSE_SIZE }),
        pauseBars: true,
    },
];

// Phones and tablets show the buttons straight away. Anything else shows
// them from its first touch (a laptop with a touch screen), and keeps them
// for the rest of the session, restarts included.
let touchSeen = false;

function primaryInputIsTouch() {
    return typeof window !== 'undefined' && !!window.matchMedia &&
        window.matchMedia('(pointer: coarse)').matches;
}

export function touchControlsActive() {
    return touchSeen || primaryInputIsTouch();
}

// The variant of a control hint that names the buttons in the player's
// hands: `${base}Pad`, `${base}Touch` or `${base}Keys`
export function controlHint(base) {
    if (hasGamepad()) return `${base}Pad`;
    return touchControlsActive() ? `${base}Touch` : `${base}Keys`;
}

export class TouchControls {
    // `actions` maps each button's action name to a handler
    constructor(scene, actions) {
        this.scene = scene;
        this.last = {};
        this.pulses = {};

        this.buttons = {};
        for (const def of BUTTONS) {
            this.buttons[def.action] = this.createButton(def, def.at(scene.scale), actions[def.action]);
        }

        this.setVisible(touchControlsActive());
        if (!this.visible) {
            // A real touch reveals them. Mouse clicks report wasTouch false.
            const reveal = (pointer) => {
                if (!pointer.wasTouch) return;
                touchSeen = true;
                this.setVisible(true);
                scene.input.off('pointerdown', reveal);
            };
            scene.input.on('pointerdown', reveal);
        }
    }

    createButton(def, { left, top, size }, handler) {
        const scene = this.scene;
        const cx = left + size / 2;
        const cy = top + size / 2;
        const idle = panel(scene, left, top, size, size, 'steel');
        const lit = panel(scene, left, top, size, size, 'gold');
        const parts = [idle, lit];

        if (def.icon) {
            parts.push(icon(scene, cx, top + 58, def.icon).setScale(2));
        }
        if (def.pauseBars) {
            for (const dx of [-14, 14]) {
                parts.push(scene.add.rectangle(cx + dx, cy, 16, 48, 0xf4f6f8).setStrokeStyle(4, 0x0a0b11));
            }
        }
        // Buttons with an icon show a count or short word under it; the rest
        // are just the word, centred
        const text = label(scene, cx, def.icon ? top + 112 : cy, '', { size: def.icon ? 16 : 24, color: def.color })
            .setOrigin(0.5);
        parts.push(text);

        const hit = scene.add.zone(cx, cy, size, size).setInteractive();
        hit.on('pointerdown', () => {
            handler();
            // A quick press-in so the tap registers under the thumb
            parts.forEach((p) => p.setY(p.y + 4));
            scene.time.delayedCall(80, () => parts.forEach((p) => p.setY(p.y - 4)));
        });

        parts.forEach((p) => p.setScrollFactor(0).setDepth(DEPTH).setVisible(false));
        hit.setScrollFactor(0).setDepth(DEPTH);
        hit.input.enabled = false;
        return { def, size, idle, lit, text, hit, parts };
    }

    // Shows or hides the whole set; update() draws each button from the next frame
    setVisible(visible) {
        this.visible = visible;
        this.last = {};
        if (!visible) {
            for (const action of Object.keys(this.buttons)) this.render(action, { shown: false });
        }
    }

    // Called every frame with { bombs, rockets, nitros, nitroActive, halted,
    // pumpStopArmed, outOfFuel, lowFuel, atBase }
    update(state) {
        if (!this.visible) return;

        this.render('rocket', { text: `x${state.rockets}`, enabled: state.rockets > 0 });
        this.render('bomb', { text: `x${state.bombs}`, enabled: state.bombs > 0 });
        this.render('nitro', {
            text: `x${state.nitros}`, enabled: state.nitros > 0 || state.nitroActive, lit: state.nitroActive,
        });
        this.render('stop', { text: t(state.halted ? 'touch.go' : 'touch.stop'), lit: state.halted });
        // Push only does anything on an empty tank, and then it's the only way on
        this.render('push', { text: t('touch.push'), enabled: state.outOfFuel, pulse: state.outOfFuel });
        // Armed, the pump button stays lit until the car stops at a station.
        // Running low, it blinks to say where the fix is.
        this.render('pump', {
            text: t('touch.pump'), lit: state.pumpStopArmed, pulse: state.lowFuel && !state.pumpStopArmed,
        });
        // The garage only opens on the base pad, so the button only exists there
        this.render('garage', { text: t('touch.garage'), shown: state.atBase, pulse: true });
        this.render('pause', {});
    }

    // `enabled` dims a button that would do nothing; `lit` swaps in the gold
    // panel for a toggle that's on; `pulse` blinks it for attention; a button
    // that isn't `shown` is hidden and can't be tapped
    render(action, { text = '', enabled = true, lit = false, pulse = false, shown = true }) {
        shown = shown && this.visible;
        const key = `${text}|${enabled}|${lit}|${pulse}|${shown}`;
        if (this.last[action] === key) return;
        this.last[action] = key;

        const b = this.buttons[action];
        if (this.pulses[action]) {
            this.pulses[action].stop();
            this.pulses[action] = null;
        }
        b.hit.input.enabled = shown;
        b.parts.forEach((p) => p.setVisible(shown));
        if (!shown) return;

        b.text.setText(text);
        // Word-only buttons use big type, dropping a size for longer words
        // (Spanish EMPUJAR would overrun at 24px)
        if (!b.def.icon) {
            b.text.setFontSize(24);
            if (b.text.width > b.size - 16) b.text.setFontSize(16);
        }
        b.idle.setVisible(!lit);
        b.lit.setVisible(lit);

        const alpha = enabled ? 0.9 : 0.4;
        b.parts.forEach((p) => p.setAlpha(alpha));
        if (pulse) {
            this.pulses[action] = this.scene.tweens.add({
                targets: b.parts, alpha: 0.45, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }
    }
}
