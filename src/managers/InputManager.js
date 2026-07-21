import Phaser from 'phaser';
import { DIRECTIONS } from '../constants';

export class InputManager {
    constructor(scene) {
        this.scene = scene;

        // Append-only queue of direction presses, drained once per frame
        this.pressQueue = [];

        // Bomb key state (consumed by GameScene in WP5)
        this.bombPressed = false;

        // Keyboard Keys
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = {
            up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Swipe Handling
        this.scene.input.on('pointerdown', this.onPointerDown, this);
        this.scene.input.on('pointerup', this.onPointerUp, this);

        this.swipeStartX = 0;
        this.swipeStartY = 0;
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
    }

    onPointerDown(pointer) {
        this.swipeStartX = pointer.x;
        this.swipeStartY = pointer.y;
    }

    onPointerUp(pointer) {
        const diffX = pointer.x - this.swipeStartX;
        const diffY = pointer.y - this.swipeStartY;

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

    // True once per SPACE press (WP5 wires bomb dropping)
    consumeBombPress() {
        if (!this.bombPressed) return false;
        this.bombPressed = false;
        return true;
    }
}
