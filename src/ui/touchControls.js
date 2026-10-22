import { label, panel, icon, UI_COLORS } from './ui';
import { t } from '../i18n';

// On-screen buttons for phones and tablets: everything the keyboard does
// besides steering, which stays on swipes.
//
// They sit in the two bottom corners, under the thumbs of a phone held
// sideways: weapons and nitro on the right, the brake, the stop-at-the-next-
// pump toggle and push on the left. 144px is about 44 CSS px once FIT shrinks
// the 1280px-wide canvas onto a phone held upright, the usual minimum for a
// touch target.

const SIZE = 144;
const GAP = 16;
const DEPTH = 110; // over the HUD (100), under toasts (150) and game over (190)

// Grid slots counted from the corner: col 0 hugs the side edge, row 0 the bottom
const BUTTONS = [
    { action: 'rocket', side: 'right', col: 0, row: 0, icon: 'rocket', color: UI_COLORS.orange },
    { action: 'bomb', side: 'right', col: 1, row: 0, icon: 'bomb', color: UI_COLORS.white },
    { action: 'nitro', side: 'right', col: 0, row: 1, icon: 'bolt', color: UI_COLORS.cyan },
    { action: 'stop', side: 'left', col: 0, row: 0, icon: null, color: UI_COLORS.red },
    { action: 'push', side: 'left', col: 1, row: 0, icon: null, color: UI_COLORS.white },
    { action: 'pump', side: 'left', col: 0, row: 1, icon: 'fuel', color: UI_COLORS.green },
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

export class TouchControls {
    // `actions` maps each button's action name to a handler (InputManager.actions)
    constructor(scene, actions) {
        this.scene = scene;
        this.last = {};
        this.pulses = {};

        const { width, height } = scene.scale;
        this.buttons = {};
        for (const def of BUTTONS) {
            const step = SIZE + GAP;
            const left = def.side === 'left'
                ? GAP + def.col * step
                : width - GAP - SIZE - def.col * step;
            const top = height - GAP - SIZE - def.row * step;
            this.buttons[def.action] = this.createButton(def, left, top, actions[def.action]);
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

    createButton(def, left, top, handler) {
        const scene = this.scene;
        const cx = left + SIZE / 2;
        const idle = panel(scene, left, top, SIZE, SIZE, 'steel');
        const lit = panel(scene, left, top, SIZE, SIZE, 'gold').setVisible(false);
        const parts = [idle, lit];

        let art = null;
        if (def.icon) {
            art = icon(scene, cx, top + 58, def.icon).setScale(2);
            parts.push(art);
        }
        // Buttons with an icon show a count or short word under it; the rest
        // are just the word, centred
        const textY = def.icon ? top + 112 : top + SIZE / 2;
        const text = label(scene, cx, textY, '', { size: def.icon ? 16 : 24, color: def.color }).setOrigin(0.5);
        parts.push(text);

        const hit = scene.add.zone(cx, top + SIZE / 2, SIZE, SIZE).setInteractive();
        hit.on('pointerdown', () => {
            if (!this.visible) return;
            handler();
            // A quick press-in so the tap registers under the thumb
            parts.forEach((p) => p.setY(p.y + 4));
            scene.time.delayedCall(80, () => parts.forEach((p) => p.setY(p.y - 4)));
        });

        parts.forEach((p) => p.setScrollFactor(0).setDepth(DEPTH));
        hit.setScrollFactor(0).setDepth(DEPTH);
        return { def, idle, lit, art, text, hit, parts };
    }

    setVisible(visible) {
        this.visible = visible;
        for (const b of Object.values(this.buttons)) {
            b.parts.forEach((p) => p.setVisible(visible));
            b.hit.input.enabled = visible;
            if (visible) this.last[b.def.action] = null; // re-render on show
        }
    }

    // Called every frame with { bombs, rockets, nitros, nitroActive, halted,
    // pumpStopArmed, outOfFuel, lowFuel }
    update(state) {
        if (!this.visible) return;

        this.render('rocket', `x${state.rockets}`, state.rockets > 0, false);
        this.render('bomb', `x${state.bombs}`, state.bombs > 0, false);
        this.render('nitro', `x${state.nitros}`, state.nitros > 0 || state.nitroActive, state.nitroActive);
        this.render('stop', t(state.halted ? 'touch.go' : 'touch.stop'), true, state.halted);
        // Push only does anything on an empty tank, and then it's the only way on
        this.render('push', t('touch.push'), state.outOfFuel, false, state.outOfFuel);
        // Armed, the pump button stays lit until the car stops at a station.
        // Running low, it blinks to say where the fix is.
        this.render('pump', t('touch.pump'), true, state.pumpStopArmed,
            state.lowFuel && !state.pumpStopArmed);
    }

    // `enabled` dims a button that would do nothing; `lit` swaps in the gold
    // panel for a toggle that's on; `pulse` blinks it for attention
    render(action, text, enabled, lit, pulse = false) {
        const key = `${text}|${enabled}|${lit}|${pulse}`;
        if (this.last[action] === key) return;
        this.last[action] = key;

        const b = this.buttons[action];
        b.text.setText(text);
        // Word-only buttons use big type, dropping a size for longer words
        // (Spanish EMPUJAR would overrun at 24px)
        if (!b.def.icon) {
            b.text.setFontSize(24);
            if (b.text.width > SIZE - 16) b.text.setFontSize(16);
        }
        b.idle.setVisible(!lit);
        b.lit.setVisible(lit);

        if (this.pulses[action]) {
            this.pulses[action].stop();
            this.pulses[action] = null;
        }
        const alpha = enabled ? 0.9 : 0.4;
        b.parts.forEach((p) => p.setAlpha(alpha));
        if (pulse) {
            this.pulses[action] = this.scene.tweens.add({
                targets: b.parts, alpha: 0.45, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }
    }
}
