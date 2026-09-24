import Phaser from 'phaser';
import { TILE_SIZE, DIRECTIONS } from './constants';
import { label } from './ui/ui';

// One-shot visual effects. Everything here is cosmetic and self-destructs.

export const FX_DEPTH = 50;

// Unit vector pointing out of the *back* of a car facing `direction`
export function rearVector(direction) {
    switch (direction) {
        case DIRECTIONS.UP: return { x: 0, y: 1 };
        case DIRECTIONS.DOWN: return { x: 0, y: -1 };
        case DIRECTIONS.LEFT: return { x: 1, y: 0 };
        default: return { x: -1, y: 0 };
    }
}

export function smokePuff(scene, x, y, { drift = 18, scale = 1, depth = 1.5, tint } = {}) {
    const puff = scene.add.sprite(x, y, 'smoke', 0).setDepth(depth).setScale(scale);
    if (tint) puff.setTint(tint);
    puff.play('smoke-puff');
    scene.tweens.add({
        targets: puff,
        x: x + Phaser.Math.Between(-drift, drift) / 2,
        y: y - drift,
        duration: 520,
        ease: 'Sine.easeOut',
    });
    puff.once('animationcomplete', () => puff.destroy());
    return puff;
}

export function sparkBurst(scene, x, y, { count = 7, radius = TILE_SIZE, tint } = {}) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.3, 0.3);
        const dist = radius * Phaser.Math.FloatBetween(0.55, 1);
        const spark = scene.add.sprite(x, y, 'spark', 0).setDepth(FX_DEPTH + 1);
        if (tint) spark.setTint(tint);
        spark.play('spark-twinkle');
        scene.tweens.add({
            targets: spark,
            x: x + Math.cos(angle) * dist,
            y: y + Math.sin(angle) * dist,
            alpha: 0,
            duration: 460,
            ease: 'Cubic.easeOut',
            onComplete: () => spark.destroy(),
        });
    }
}

// Fireball + flying debris + a scorch mark that slowly fades off the asphalt
export function explosion(scene, x, y, { scorch = true } = {}) {
    const flash = scene.add.image(x, y, 'glow').setDepth(FX_DEPTH - 1)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb040).setScale(4);
    scene.tweens.add({ targets: flash, alpha: 0, scale: 5, duration: 260, onComplete: () => flash.destroy() });

    const boom = scene.add.sprite(x, y, 'explosion', 0).setDepth(FX_DEPTH).setScale(1.25);
    boom.play('explode');
    boom.once('animationcomplete', () => boom.destroy());

    sparkBurst(scene, x, y, { count: 9, radius: TILE_SIZE * 1.3, tint: 0xffc060 });
    for (let i = 0; i < 3; i++) {
        scene.time.delayedCall(120 + i * 90, () => {
            smokePuff(scene, x + Phaser.Math.Between(-14, 14), y + Phaser.Math.Between(-10, 10),
                { drift: 30, scale: 1.6, depth: FX_DEPTH - 2 });
        });
    }

    if (scorch) {
        const mark = scene.add.image(x, y, 'scorch').setDepth(0.15).setAngle(Phaser.Math.Between(0, 3) * 90);
        scene.tweens.add({ targets: mark, alpha: 0, delay: 7000, duration: 3000, onComplete: () => mark.destroy() });
    }
}

// World-space popup text ("+$100") that rises and fades
export function floatText(scene, x, y, text, color) {
    const t = label(scene, x, y - 18, text, { size: 16, color }).setOrigin(0.5).setDepth(FX_DEPTH + 5);
    t.setScale(0.6);
    scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    scene.tweens.add({
        targets: t,
        y: y - 64,
        alpha: 0,
        delay: 350,
        duration: 650,
        ease: 'Sine.easeIn',
        onComplete: () => t.destroy(),
    });
}

// Cosmetic extras that trail the player's car: nitro flame, damage smoke and
// tyre puffs when it changes direction. Reads the car/state; never writes.
export class CarTrail {
    constructor(scene, car) {
        this.scene = scene;
        this.car = car;
        this.flame = scene.add.sprite(0, 0, 'flame', 0).setDepth(0.95).setVisible(false);
        this.flame.play('flame-flicker');
        this.flameGlow = scene.add.image(0, 0, 'glow').setDepth(0.94).setBlendMode(Phaser.BlendModes.ADD)
            .setTint(0x3fa8ff).setAlpha(0.8).setVisible(false);
        this.smokeTimer = 0;
        this.lastDirection = car.direction;
    }

    update(delta, { nitro, damage, maxDamage }) {
        const car = this.car;
        const v = car.visual;
        const rear = rearVector(car.direction);
        const moving = car.isMoving;

        // Nitro flame out of the exhaust
        const showFlame = nitro && moving;
        this.flame.setVisible(showFlame);
        this.flameGlow.setVisible(showFlame);
        if (showFlame) {
            const fx = v.x + rear.x * 32;
            const fy = v.y + rear.y * 32;
            this.flame.setPosition(fx, fy);
            // flame art points down; rotate it to point out of the back
            this.flame.setAngle({ 0: 0, 1: 180, 2: -90, 3: 90 }[car.direction]);
            this.flameGlow.setPosition(fx, fy).setScale(0.9 + Math.random() * 0.2);
        }

        // Damage smoke: thicker and darker the closer the car is to wrecked
        this.smokeTimer += delta;
        const interval = damage >= maxDamage - 1 ? 110 : 260;
        if (damage > 0 && this.smokeTimer >= interval) {
            this.smokeTimer = 0;
            const heavy = damage >= maxDamage - 1;
            smokePuff(this.scene, v.x - rear.x * 10 + Phaser.Math.Between(-4, 4),
                v.y - rear.y * 10 + Phaser.Math.Between(-4, 4),
                { drift: 22, scale: heavy ? 1.3 : 1, depth: 1.2, tint: heavy ? 0x55555f : 0xb0b4bc });
        }

        // Tyre puffs on every turn
        if (car.direction !== this.lastDirection) {
            this.lastDirection = car.direction;
            for (const side of [-1, 1]) {
                smokePuff(this.scene, v.x + rear.x * 18 + rear.y * side * 12,
                    v.y + rear.y * 18 + rear.x * side * 12,
                    { drift: 8, scale: 0.8, depth: 0.9, tint: 0xd8dce2 });
            }
        }
    }

    destroy() {
        this.flame.destroy();
        this.flameGlow.destroy();
    }
}
