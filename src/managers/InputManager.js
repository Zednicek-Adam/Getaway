import Phaser from 'phaser';
import { DIRECTIONS } from '../constants';

export class InputManager {
    constructor(scene) {
        this.scene = scene;
        this.queuedDirection = null;

        // Keyboard Keys
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = {
            up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.key1 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.key2 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        this.key3 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
        this.key4 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);

        this.keyB = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
        this.keyR = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.keyF = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.keyX = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);

        // Swipe Handling
        this.scene.input.on('pointerdown', this.onPointerDown, this);
        this.scene.input.on('pointerup', this.onPointerUp, this);

        this.swipeStartX = 0;
        this.swipeStartY = 0;
    }

    isHandbrakePressed() {
        return Phaser.Input.Keyboard.JustDown(this.keyX);
    }

    isNitroPressed() {
        return Phaser.Input.Keyboard.JustDown(this.spaceKey) || Phaser.Input.Keyboard.JustDown(this.key1);
    }

    isBombPressed() {
        return Phaser.Input.Keyboard.JustDown(this.key2) || Phaser.Input.Keyboard.JustDown(this.keyB);
    }

    isRocketPressed() {
        return Phaser.Input.Keyboard.JustDown(this.key3) || Phaser.Input.Keyboard.JustDown(this.keyR);
    }

    isJerryCanPressed() {
        return Phaser.Input.Keyboard.JustDown(this.key4) || Phaser.Input.Keyboard.JustDown(this.keyF);
    }

    update() {
        this.checkKeyboard();
    }

    checkKeyboard() {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.up)) return DIRECTIONS.UP;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.down)) return DIRECTIONS.DOWN;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.left)) return DIRECTIONS.LEFT;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.right)) return DIRECTIONS.RIGHT;

        if (this.cursors.up?.isDown || this.wasd.up?.isDown) return DIRECTIONS.UP;
        if (this.cursors.down?.isDown || this.wasd.down?.isDown) return DIRECTIONS.DOWN;
        if (this.cursors.left?.isDown || this.wasd.left?.isDown) return DIRECTIONS.LEFT;
        if (this.cursors.right?.isDown || this.wasd.right?.isDown) return DIRECTIONS.RIGHT;

        return null;
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
                this.queuedDirection = diffX > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            }
        } else {
            // Vertical
            if (Math.abs(diffY) > minSwipeDist) {
                this.queuedDirection = diffY > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            }
        }
    }

    getDirection() {
        let dir = this.checkKeyboard();
        if (dir !== null) return dir;
        
        if (this.queuedDirection !== null) {
            dir = this.queuedDirection;
            this.queuedDirection = null;
            return dir;
        }
        
        return null;
    }
}
