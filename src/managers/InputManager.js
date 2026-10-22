import Phaser from 'phaser';
import { DIRECTIONS } from '../constants';
import { bindPad } from '../gamepad';

export class InputManager {
    constructor(scene) {
        this.scene = scene;

        // Append-only queue of direction presses, drained once per frame
        this.pressQueue = [];

        // Bomb key state (consumed by GameScene in WP5)
        this.bombPressed = false;

        // Rocket key state (E) — consumed by GameScene
        this.rocketPressed = false;

        // Brake/stop toggle state (F) — consumed by GameScene
        this.stopToggled = false;

        // Push taps (Q) since the last drain — a count, since mashing can land
        // two taps in one frame
        this.pushPresses = 0;

        // Nitro key state (R) — consumed by GameScene
        this.nitroPressed = false;

        // Keyboard Keys
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = {
            up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.rocketKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.stopKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        // Q, not SHIFT: five quick SHIFT taps open Windows' Sticky Keys prompt
        this.pushKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.nitroKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

        // Pump stop toggle (touch PUMP button) — consumed by GameScene
        this.pumpStopToggled = false;

        // One handler per action, shared by the gamepad and the touch buttons
        this.actions = {
            bomb: () => { this.bombPressed = true; },
            rocket: () => { this.rocketPressed = true; },
            nitro: () => { this.nitroPressed = true; },
            stop: () => { this.stopToggled = true; },
            // A count, since mashing can land two taps in one frame
            push: () => { this.pushPresses++; },
            pump: () => { this.pumpStopToggled = true; },
        };

        // Gamepad: D-pad or left stick steers. Rocket and bomb sit on both the
        // face buttons and the triggers, so either grip works; nitro is the
        // right bumper, next to the rocket trigger, and push the left one.
        const { bomb, rocket, nitro, stop, push } = this.actions;
        bindPad(this.scene, {
            up: () => this.pressQueue.push(DIRECTIONS.UP),
            down: () => this.pressQueue.push(DIRECTIONS.DOWN),
            left: () => this.pressQueue.push(DIRECTIONS.LEFT),
            right: () => this.pressQueue.push(DIRECTIONS.RIGHT),
            a: stop,
            x: rocket,
            rt: rocket,
            b: bomb,
            lt: bomb,
            rb: nitro,
            lb: push,
        });

        // Swipe Handling. Each finger is tracked on its own, so one thumb can
        // steer while the other works the touch buttons.
        this.swipes = new Map();
        this.scene.input.on('pointerdown', this.onPointerDown, this);
        this.scene.input.on('pointerup', this.onPointerUp, this);
    }

    update() {
        this.checkKeyboard();
    }

    checkKeyboard() {
        // Each press event (Just Down) appends to the queue
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.up)) {
            this.pressQueue.push(DIRECTIONS.UP);
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.down)) {
            this.pressQueue.push(DIRECTIONS.DOWN);
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.left)) {
            this.pressQueue.push(DIRECTIONS.LEFT);
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.right)) {
            this.pressQueue.push(DIRECTIONS.RIGHT);
        }

        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.bombPressed = true;
        }

        if (Phaser.Input.Keyboard.JustDown(this.rocketKey)) {
            this.rocketPressed = true;
        }

        if (Phaser.Input.Keyboard.JustDown(this.stopKey)) {
            this.stopToggled = true;
        }

        if (Phaser.Input.Keyboard.JustDown(this.pushKey)) {
            this.pushPresses++;
        }

        if (Phaser.Input.Keyboard.JustDown(this.nitroKey)) {
            this.nitroPressed = true;
        }
    }

    // A touch that lands on a button is a button press, not the start of a swipe
    onPointerDown(pointer, currentlyOver) {
        if (currentlyOver.length > 0) return;
        this.swipes.set(pointer.id, { x: pointer.x, y: pointer.y });
    }

    onPointerUp(pointer) {
        const start = this.swipes.get(pointer.id);
        if (!start) return;
        this.swipes.delete(pointer.id);

        const diffX = pointer.x - start.x;
        const diffY = pointer.y - start.y;

        // Min Distance for swipe
        const minSwipeDist = 30;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal
            if (Math.abs(diffX) > minSwipeDist) {
                this.pressQueue.push(diffX > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT);
            }
        } else {
            // Vertical
            if (Math.abs(diffY) > minSwipeDist) {
                this.pressQueue.push(diffY > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP);
            }
        }
    }

    // Returns all direction presses since the last drain (in press order)
    drainInputs() {
        const inputs = this.pressQueue;
        this.pressQueue = [];
        return inputs;
    }

    // True once per SPACE (or pad B/LT) press (WP5 wires bomb dropping)
    consumeBombPress() {
        if (!this.bombPressed) return false;
        this.bombPressed = false;
        return true;
    }

    // True once per E (or pad X/RT) press — fires a rocket along the player's facing
    consumeRocketPress() {
        if (!this.rocketPressed) return false;
        this.rocketPressed = false;
        return true;
    }

    // Push taps (Q or pad LB) since the last call
    drainPushPresses() {
        const count = this.pushPresses;
        this.pushPresses = 0;
        return count;
    }

    // True once per F (or pad A) press — toggles the player's brake (stop/refuel)
    consumeStopToggle() {
        if (!this.stopToggled) return false;
        this.stopToggled = false;
        return true;
    }

    // True once per R (or pad RB) press — fires a stored nitro
    consumeNitroPress() {
        if (!this.nitroPressed) return false;
        this.nitroPressed = false;
        return true;
    }

    // True once per PUMP tap — arms or cancels a stop at the next gas station
    consumePumpStopToggle() {
        if (!this.pumpStopToggled) return false;
        this.pumpStopToggled = false;
        return true;
    }
}
