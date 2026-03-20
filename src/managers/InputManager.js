import Phaser from 'phaser';
import { DIRECTIONS } from '../constants';

export class InputManager {
    constructor(scene) {
        this.scene = scene;
        this.bufferedDirection = null;

        // Keyboard Keys
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = {
            up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };

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
        // Check for single press events (Just Down) to update buffer
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.up)) {
            this.bufferedDirection = DIRECTIONS.UP;
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.down)) {
            this.bufferedDirection = DIRECTIONS.DOWN;
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.left)) {
            this.bufferedDirection = DIRECTIONS.LEFT;
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.right)) {
            this.bufferedDirection = DIRECTIONS.RIGHT;
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
                this.bufferedDirection = diffX > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            }
        } else {
            // Vertical
            if (Math.abs(diffY) > minSwipeDist) {
                this.bufferedDirection = diffY > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            }
        }
    }

    getDirection() {
        // Returns current buffered command and clears it? 
        // Or keeps it? Strategy: "Snake" controls keep the buffer until used or overwritten.
        // But implementation plans said "Turn queueing". 
        // We will expose the current buffer.
        return this.bufferedDirection;
    }
}
