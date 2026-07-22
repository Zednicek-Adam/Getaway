import Phaser from 'phaser';
import { TILE_TYPES } from '../constants';

export class Helicopter {
    constructor(scene, target) {
        this.scene = scene;
        this.target = target; // Player car reference

        this.hp = 1;
        this.speed = 180; // Fast flight speed in pixels/sec
        this.spotlightRadius = 80;
        this.fuelTimer = 25000; // 25s fuel capacity
        this.isOutOfFuel = false;

        // Initial position away from player
        this.x = target.visual.x - 300;
        this.y = target.visual.y - 300;

        // Visual components
        this.visual = this.scene.add.container(this.x, this.y).setDepth(150);

        // Body
        this.bodyGfx = this.scene.add.graphics();
        this.bodyGfx.fillStyle(0x222222, 1);
        this.bodyGfx.fillCircle(0, 0, 16);
        this.bodyGfx.fillStyle(0x00E5FF, 1);
        this.bodyGfx.fillCircle(4, 0, 6);
        this.bodyGfx.lineStyle(2, 0xFFFFFF, 0.8);
        this.bodyGfx.strokeCircle(0, 0, 16);

        // Rotor
        this.rotorGfx = this.scene.add.graphics();
        this.rotorAngle = 0;

        this.visual.add([this.bodyGfx, this.rotorGfx]);

        // Spotlight rendered on ground level
        this.spotlight = this.scene.add.graphics().setDepth(5);
        this.isSpottingPlayer = false;
    }

    update(time, delta) {
        if (!this.target || !this.target.visual || this.isOutOfFuel) return;

        // Fuel countdown
        this.fuelTimer -= delta;
        if (this.fuelTimer <= 0) {
            this.isOutOfFuel = true;
            this.spotlight.clear();
            this.scene.tweens.add({
                targets: this.visual,
                x: this.x - 600,
                y: this.y - 600,
                alpha: 0,
                duration: 2000,
                onComplete: () => this.destroy()
            });
            return;
        }

        // Check if player is under Tunnel cover
        const playerTile = this.scene.mapManager.getTile(this.target.gridX, this.target.gridY);
        const isUnderTunnel = playerTile === TILE_TYPES.TUNNEL;

        // Move towards player unless player is under cover
        const targetX = this.target.visual.x;
        const targetY = this.target.visual.y;

        const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
        const dist = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);

        if (dist > 10 && !isUnderTunnel) {
            this.x += Math.cos(angle) * this.speed * (delta / 1000);
            this.y += Math.sin(angle) * this.speed * (delta / 1000);
        }

        this.visual.setPosition(this.x, this.y);
        this.visual.setRotation(angle);

        // Rotate rotor blade
        this.rotorAngle += delta * 0.03;
        this.rotorGfx.clear();
        this.rotorGfx.lineStyle(3, 0xEEEEEE, 0.9);
        const rLen = 30;
        this.rotorGfx.lineBetween(
            Math.cos(this.rotorAngle) * rLen, Math.sin(this.rotorAngle) * rLen,
            -Math.cos(this.rotorAngle) * rLen, -Math.sin(this.rotorAngle) * rLen
        );
        this.rotorGfx.lineBetween(
            Math.cos(this.rotorAngle + Math.PI/2) * rLen, Math.sin(this.rotorAngle + Math.PI/2) * rLen,
            -Math.cos(this.rotorAngle + Math.PI/2) * rLen, -Math.sin(this.rotorAngle + Math.PI/2) * rLen
        );

        // Check if player is caught in spotlight
        this.isSpottingPlayer = !isUnderTunnel && (dist < this.spotlightRadius);

        // Draw Spotlight
        this.spotlight.clear();
        if (isUnderTunnel) {
            // Spotlight is off under tunnel
            this.isSpottingPlayer = false;
        } else if (this.isSpottingPlayer) {
            this.spotlight.fillStyle(0xFF3333, 0.45); // Red when spotting player
            this.spotlight.lineStyle(3, 0xFF0000, 0.8);
            this.spotlight.fillCircle(this.x, this.y, this.spotlightRadius);
            this.spotlight.strokeCircle(this.x, this.y, this.spotlightRadius);
        } else {
            this.spotlight.fillStyle(0xFFFF88, 0.3); // Yellow search cone
            this.spotlight.lineStyle(2, 0xFFFF00, 0.6);
            this.spotlight.fillCircle(this.x, this.y, this.spotlightRadius);
            this.spotlight.strokeCircle(this.x, this.y, this.spotlightRadius);
        }
    }

    takeHit() {
        this.hp--;
        return this.hp <= 0;
    }

    destroy() {
        if (this.spotlight) this.spotlight.destroy();
        if (this.visual) this.visual.destroy();
    }
}
