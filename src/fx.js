import Phaser from 'phaser';
import { TILE_SIZE, DIRECTIONS } from './constants';
import { label, UI_COLORS } from './ui/ui';
import { ICON } from './art';

// One-shot visual effects. Everything here is cosmetic and self-destructs.

export const FX_DEPTH = 50;

// Dust the colour of the street, kicked up by hooves and wheels
export const DUST_TINT = 0xd8c09a;

// Unit vector pointing out of the *back* of a rider facing `direction`
export function rearVector(direction) {
    switch (direction) {
        case DIRECTIONS.UP: return { x: 0, y: 1 };
        case DIRECTIONS.DOWN: return { x: 0, y: -1 };
        case DIRECTIONS.LEFT: return { x: 1, y: 0 };
        default: return { x: -1, y: 0 };
    }
}

// A puff that rises and thins out. Untinted it's pale dust; tinted it does
// for gunsmoke and coal smoke too.
export function dustPuff(scene, x, y, { drift = 18, scale = 1, depth = 1.5, tint } = {}) {
    const puff = scene.add.sprite(x, y, 'dust', 0).setDepth(depth).setScale(scale);
    if (tint) puff.setTint(tint);
    puff.play('dust-puff');
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

// One puff of hoof dust behind a rider
export function hoofDust(scene, car, { scale = 0.9, spread = 8 } = {}) {
    const rear = rearVector(car.direction);
    const side = Phaser.Math.Between(-spread, spread);
    dustPuff(scene, car.visual.x + rear.x * 24 + rear.y * side, car.visual.y + rear.y * 24 + rear.x * side,
        { drift: 10, scale, depth: 0.9, tint: DUST_TINT });
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

// Fireball + flying debris + a scorch mark that slowly fades off the dirt
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
            dustPuff(scene, x + Phaser.Math.Between(-14, 14), y + Phaser.Math.Between(-10, 10),
                { drift: 30, scale: 1.6, depth: FX_DEPTH - 2, tint: 0x7a6e66 });
        });
    }

    if (scorch) {
        const mark = scene.add.image(x, y, 'scorch').setDepth(0.15).setAngle(Phaser.Math.Between(0, 3) * 90);
        scene.tweens.add({ targets: mark, alpha: 0, delay: 7000, duration: 3000, onComplete: () => mark.destroy() });
    }
}

// A revolver fired into the air: a muzzle flash and a wisp of gunsmoke
export function gunshot(scene, x, y) {
    const flash = scene.add.image(x, y, 'glow').setDepth(FX_DEPTH - 1)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe090).setScale(0.9);
    scene.tweens.add({ targets: flash, alpha: 0, scale: 1.5, duration: 140, onComplete: () => flash.destroy() });
    const spark = scene.add.sprite(x, y, 'spark', 2).setDepth(FX_DEPTH).setTint(0xfff0c0);
    spark.play('spark-twinkle');
    spark.once('animationcomplete', () => spark.destroy());
    dustPuff(scene, x, y - 4, { drift: 14, scale: 0.8, depth: 1.6, tint: 0xe0dcd4 });
}

// A rider caught by the lasso: a cloud of dust and, if he's yanked out of
// the saddle, his hat goes flying. `roped` false is a glancing loop on the
// marshals' wagon, which shrugs it off.
export function lassoed(scene, x, y, roped) {
    for (let i = 0; i < 3; i++) {
        dustPuff(scene, x + (i - 1) * 14, y + Phaser.Math.Between(-6, 6),
            { drift: 22, scale: 1.7, depth: FX_DEPTH - 2, tint: DUST_TINT });
    }
    sparkBurst(scene, x, y, { count: 6, radius: TILE_SIZE * 0.8, tint: 0xf0d098 });
    scene.cameras.main.shake(140, 0.005);
    if (!roped) {
        floatText(scene, x, y, 'WHOA!', UI_COLORS.goldLight);
        return;
    }
    floatText(scene, x, y, 'ROPED!', UI_COLORS.gold);
    const hat = scene.add.image(x, y, 'icons', ICON.hat).setDepth(FX_DEPTH + 2);
    const dir = Math.random() < 0.5 ? -1 : 1;
    scene.tweens.add({ targets: hat, x: x + dir * 70, duration: 800, ease: 'Sine.easeOut' });
    scene.tweens.add({ targets: hat, y: y - 60, duration: 360, ease: 'Quad.easeOut', yoyo: true });
    scene.tweens.add({
        targets: hat, angle: dir * 540, alpha: 0, delay: 200, duration: 600,
        onComplete: () => hat.destroy(),
    });
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

// Cosmetic extras around the player's horse: hoof dust while it runs (a
// cloud of it at full gallop, none on the handcar), dust thrown up on every
// turn, and a red flush when one more tackle would end the run. Reads the
// car/state; never writes.
export class CarTrail {
    constructor(scene, car) {
        this.scene = scene;
        this.car = car;
        this.dustTimer = 0;
        this.flushTimer = 0;
        this.lastDirection = car.direction;
    }

    update(delta, { nitro, damage, maxDamage, onRails }) {
        const car = this.car;
        const v = car.visual;
        const rear = rearVector(car.direction);

        this.dustTimer += delta;
        if (car.isMoving && !onRails && this.dustTimer >= (nitro ? 50 : 120)) {
            this.dustTimer = 0;
            hoofDust(this.scene, car, nitro ? { scale: 1.4, spread: 14 } : {});
        }

        // One hit from capture: the rider flushes red now and then
        this.flushTimer += delta;
        if (damage > 0 && damage >= maxDamage - 1 && this.flushTimer >= 900) {
            this.flushTimer = 0;
            v.setTint(0xff8070);
            this.scene.time.delayedCall(140, () => v.clearTint());
        }

        // A spray of dust on every turn
        if (car.direction !== this.lastDirection) {
            this.lastDirection = car.direction;
            for (const side of [-1, 1]) {
                dustPuff(this.scene, v.x + rear.x * 18 + rear.y * side * 12,
                    v.y + rear.y * 18 + rear.x * side * 12,
                    { drift: 8, scale: 1, depth: 0.9, tint: DUST_TINT });
            }
        }
    }
}

// Tumbleweeds bowling across the street on the wind every so often. They roll
// in from the windward edge of the view, hop over the ruts and roll on out.
export class Tumbleweeds {
    constructor(scene) {
        this.scene = scene;
        this.wind = Math.random() < 0.5 ? -1 : 1;
        this.weeds = [];
        this.timer = Phaser.Math.Between(2000, 5000);
    }

    update(delta) {
        this.timer -= delta;
        if (this.timer <= 0) {
            this.timer = Phaser.Math.Between(6000, 13000);
            this.spawn();
        }
        const view = this.scene.cameras.main.worldView;
        for (let i = this.weeds.length - 1; i >= 0; i--) {
            const w = this.weeds[i];
            w.t += delta;
            w.x += w.speed * this.wind * (delta / 1000);
            w.y += w.drift * (delta / 1000);
            const hop = Math.abs(Math.sin(w.t / 230)) * 14;
            w.sprite.setPosition(w.x, w.y - hop);
            w.shadow.setPosition(w.x + 4, w.y + 10).setScale(1 - hop / 40);
            const gone = this.wind > 0 ? w.x > view.right + 80 : w.x < view.x - 80;
            if (gone) {
                w.sprite.destroy();
                w.shadow.destroy();
                this.weeds.splice(i, 1);
            }
        }
    }

    spawn() {
        const view = this.scene.cameras.main.worldView;
        const x = this.wind > 0 ? view.x - 40 : view.right + 40;
        const y = Phaser.Math.Between(view.y + 120, view.bottom - 120);
        const sprite = this.scene.add.sprite(x, y, 'tumbleweed', 0).setDepth(1.3);
        sprite.play({ key: 'tumble', frameRate: 10 });
        if (this.wind < 0) sprite.setFlipX(true);
        const shadow = this.scene.add.image(x, y, 'shadow').setDepth(0.25).setAlpha(0.7);
        this.weeds.push({ sprite, shadow, x, y, t: 0,
            speed: Phaser.Math.Between(110, 170), drift: Phaser.Math.Between(-20, 20) });
    }
}
