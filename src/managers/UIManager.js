import { CONFIG } from '../config';
import { DIRECTIONS } from '../constants';
import { ICON } from '../art';
import { label, panel, icon, money, UI_COLORS, dim, createMenu } from '../ui/ui';

const HUD_DEPTH = 100;

// Fuel bar colour by fill level
const FUEL_COLOURS = [
    [0.5, 0x6fe08a],
    [0.2, 0xffc933],
    [0, 0xff4d5a],
];

export class UIManager {
    constructor(scene) {
        this.scene = scene;

        // Dirty-check cache of last rendered HUD values
        this.last = {};
        this.nitroTween = null;
        this.starTween = null;
        this.fuelTween = null;

        const { width, height } = scene.scale;

        // --- Status panel (top-left) -----------------------------------------
        this.fix(panel(scene, 16, 16, 344, 204));

        this.fix(icon(scene, 44, 46, 'coin'));
        this.fix(label(scene, 68, 38, 'BANK', { color: UI_COLORS.dim }));
        this.bankText = this.fix(label(scene, 340, 38, '$0', { color: UI_COLORS.gold }).setOrigin(1, 0));

        this.fix(icon(scene, 44, 82, 'bag'));
        this.fix(label(scene, 68, 74, 'CARRY', { color: UI_COLORS.dim }));
        this.carryText = this.fix(label(scene, 340, 74, '$0').setOrigin(1, 0));

        // Life hearts — built to MAX_LIVES so the extra-life pickup has slots
        this.hearts = [];
        for (let i = 0; i < CONFIG.PLAYER.MAX_LIVES; i++) {
            this.hearts.push(this.fix(icon(scene, 44 + i * 34, 122, 'heart')));
        }

        // Armour pips show REMAINING hits. Pool sized to the highest armor
        // level so upgrades have slots; only the first maxDamage are shown.
        this.shields = [];
        const maxShields = Math.max(...CONFIG.GARAGE.TRACKS.armor.values);
        for (let i = 0; i < maxShields; i++) {
            this.shields.push(this.fix(icon(scene, 44 + i * 30, 158, 'shield')));
        }

        // Fuel gauge: segmented bar
        this.fix(icon(scene, 44, 194, 'fuel'));
        this.gauge = { x: 68, y: 186, w: 192, h: 16 };
        const g = this.gauge;
        this.fix(scene.add.rectangle(g.x - 4, g.y - 4, g.w + 8, g.h + 8, 0x0a0b11).setOrigin(0));
        this.fix(scene.add.rectangle(g.x, g.y, g.w, g.h, 0x2a2e3f).setOrigin(0));
        this.fuelFill = this.fix(scene.add.rectangle(g.x, g.y, g.w, g.h, 0x6fe08a).setOrigin(0));
        this.fuelShine = this.fix(scene.add.rectangle(g.x, g.y, g.w, 4, 0xffffff, 0.35).setOrigin(0));
        for (let sx = g.x + 16; sx < g.x + g.w; sx += 16) {
            this.fix(scene.add.rectangle(sx - 1, g.y, 2, g.h, 0x0a0b11, 0.55).setOrigin(0));
        }
        this.fuelPercentText = this.fix(label(scene, 340, 186, '100%', { color: UI_COLORS.green }).setOrigin(1, 0));

        // --- Arsenal panel (under the status panel) ---------------------------
        this.fix(panel(scene, 16, 228, 344, 56));
        this.fix(icon(scene, 44, 256, 'bomb'));
        this.bombText = this.fix(label(scene, 66, 248, 'x0'));
        this.fix(icon(scene, 142, 256, 'rocket'));
        this.rocketText = this.fix(label(scene, 164, 248, 'x0', { color: UI_COLORS.orange }));
        this.nitroIcon = this.fix(icon(scene, 240, 256, 'bolt'));
        this.nitroText = this.fix(label(scene, 262, 248, 'NOS', { color: UI_COLORS.cyan }));
        this.renderNitro(false);

        // --- Wanted level (top-right) -----------------------------------------
        const wantedW = 5 * 40 + 36;
        const wx = width - 16 - wantedW;
        this.fix(panel(scene, wx, 16, wantedW, 96));
        this.fix(label(scene, wx + wantedW / 2, 28, 'WANTED', { color: UI_COLORS.dim }).setOrigin(0.5, 0));
        this.stars = [];
        for (let i = 0; i < 5; i++) {
            this.stars.push(this.fix(icon(scene, wx + 38 + i * 40, 66, 'starEmpty')));
        }
        this.chaseBar = { x: wx + 18, y: 88, w: wantedW - 36, h: 8 };
        const c = this.chaseBar;
        this.chaseBarBg = this.fix(scene.add.rectangle(c.x, c.y, c.w, c.h, 0x2a2e3f).setOrigin(0).setVisible(false));
        this.chaseBarFill = this.fix(scene.add.rectangle(c.x, c.y, c.w, c.h, 0xff4d5a).setOrigin(0).setVisible(false));

        // --- Turn queue (bottom-centre) ----------------------------------------
        const qW = 96 + CONFIG.PLAYER.QUEUE_MAX * 44;
        const qx = (width - qW) / 2;
        const qy = height - 16 - 56;
        this.fix(panel(scene, qx, qy, qW, 56));
        this.fix(label(scene, qx + 18, qy + 20, 'NEXT', { color: UI_COLORS.dim }));
        this.queueArrows = [];
        for (let i = 0; i < CONFIG.PLAYER.QUEUE_MAX; i++) {
            this.queueArrows.push(this.fix(icon(scene, qx + 118 + i * 44, qy + 28, 'arrow').setAlpha(0.15)));
        }
    }

    // Pin a display object to the screen above the world
    fix(obj) {
        return obj.setScrollFactor(0).setDepth(HUD_DEPTH);
    }

    changed(key, value) {
        if (this.last[key] === value) return false;
        this.last[key] = value;
        return true;
    }

    // A quick scale "punch" so changing numbers catch the eye
    punch(obj) {
        obj.setScale(1.25);
        this.scene.tweens.add({ targets: obj, scale: 1, duration: 180, ease: 'Back.easeOut' });
    }

    // Pure renderer: called every frame with a HUD snapshot
    // { banked, carried, lives, fuel, fuelMax, bombs, rockets, damage, maxDamage,
    //   nitroActive, queue, stars, chaseCountdown, chaseCountdownMax }
    update(hud) {
        if (this.changed('banked', hud.banked)) {
            this.bankText.setText(money(hud.banked));
            if (hud.banked > 0) this.punch(this.bankText);
        }

        if (this.changed('carried', hud.carried)) {
            this.carryText.setText(money(hud.carried));
            // Brighter while money is at risk
            this.carryText.setColor(hud.carried > 0 ? UI_COLORS.white : UI_COLORS.faint);
            if (hud.carried > 0) this.punch(this.carryText);
        }

        if (this.changed('lives', `${hud.lives}/${hud.maxLives}`)) {
            this.hearts.forEach((heart, i) => {
                heart.setVisible(i < hud.maxLives);
                heart.setFrame(i < hud.lives ? ICON.heart : ICON.heartEmpty);
            });
        }

        if (this.changed('fuel', `${hud.fuel}/${hud.fuelMax}`)) {
            this.renderFuel(hud.fuel, hud.fuelMax);
        }

        if (this.changed('bombs', hud.bombs)) {
            this.bombText.setText(`x${hud.bombs}`).setColor(hud.bombs > 0 ? UI_COLORS.white : UI_COLORS.faint);
        }

        if (this.changed('rockets', hud.rockets)) {
            this.rocketText.setText(`x${hud.rockets}`).setColor(hud.rockets > 0 ? UI_COLORS.orange : UI_COLORS.faint);
        }

        if (this.changed('damage', `${hud.damage}/${hud.maxDamage}`)) {
            this.renderDamage(hud.damage, hud.maxDamage);
        }

        if (this.changed('nitro', hud.nitroActive)) {
            this.renderNitro(hud.nitroActive);
        }

        const queue = hud.queue || [];
        if (this.changed('queue', queue.join(','))) {
            this.renderQueue(queue);
        }

        if (this.changed('stars', hud.stars)) {
            this.renderStars(hud.stars);
        }

        this.renderChaseBar(hud.chaseCountdown, hud.chaseCountdownMax);
    }

    // Shields show remaining hits: lit while intact, hollow once spent
    renderDamage(damage, maxDamage) {
        const remaining = maxDamage - damage;
        this.shields.forEach((s, i) => {
            s.setVisible(i < maxDamage);
            s.setFrame(i < remaining ? ICON.shield : ICON.shieldEmpty);
        });
    }

    // Nitro reads as dim/hollow until active, then flashes
    renderNitro(active) {
        if (this.nitroTween) {
            this.nitroTween.stop();
            this.nitroTween = null;
        }
        const targets = [this.nitroIcon, this.nitroText];
        targets.forEach(t => t.setAlpha(active ? 1 : 0.25));
        if (active) {
            this.nitroTween = this.scene.tweens.add({
                targets, alpha: 0.35, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }
    }

    renderStars(stars) {
        if (this.starTween) {
            this.starTween.stop();
            this.starTween = null;
        }
        this.stars.forEach((s, i) => {
            s.setAlpha(1).setFrame(i < stars ? ICON.star : ICON.starEmpty);
            if (i === stars - 1) this.punch(s);
        });
        if (stars > 0) {
            // Earned stars flash like a light bar
            this.starTween = this.scene.tweens.add({
                targets: this.stars.slice(0, stars), alpha: 0.45, duration: 280, yoyo: true, repeat: -1,
            });
        }
    }

    renderChaseBar(countdown, countdownMax) {
        const active = countdown > 0;
        if (this.changed('chaseActive', active)) {
            this.chaseBarBg.setVisible(active);
            this.chaseBarFill.setVisible(active);
        }
        if (!active) return;

        const fraction = Math.max(0, Math.min(1, countdown / countdownMax));
        // Snap to 2px steps so the bar shrinks on the pixel grid
        const w = Math.round((fraction * this.chaseBar.w) / 2) * 2;
        if (this.changed('chaseWidth', w)) {
            this.chaseBarFill.width = w;
        }
    }

    renderQueue(queue) {
        const angleByDirection = {
            [DIRECTIONS.UP]: 0,
            [DIRECTIONS.RIGHT]: 90,
            [DIRECTIONS.DOWN]: 180,
            [DIRECTIONS.LEFT]: 270,
        };

        this.queueArrows.forEach((arrow, i) => {
            if (i < queue.length) {
                arrow.setAngle(angleByDirection[queue[i]]).setAlpha(1);
            } else {
                arrow.setAngle(0).setAlpha(0.15); // Dim unused slot
            }
        });
    }

    renderFuel(fuel, fuelMax) {
        const fraction = Math.max(0, Math.min(1, fuel / fuelMax));
        const w = Math.round((fraction * this.gauge.w) / 2) * 2;
        this.fuelFill.width = w;
        this.fuelShine.width = w;

        const colour = FUEL_COLOURS.find(([min]) => fraction > min || min === 0)[1];
        this.fuelFill.setFillStyle(colour);
        const css = `#${colour.toString(16).padStart(6, '0')}`;
        this.fuelPercentText.setText(`${Math.floor(fraction * 100)}%`).setColor(css);

        // Low fuel: the gauge blinks
        const low = fraction < 0.2;
        if (low && !this.fuelTween) {
            this.fuelTween = this.scene.tweens.add({
                targets: [this.fuelFill, this.fuelPercentText], alpha: 0.3, duration: 260, yoyo: true, repeat: -1,
            });
        } else if (!low && this.fuelTween) {
            this.fuelTween.stop();
            this.fuelTween = null;
            this.fuelFill.setAlpha(1);
            this.fuelPercentText.setAlpha(1);
        }
    }

    showToast(text) {
        const { width } = this.scene.scale;
        const t = label(this.scene, 0, 0, text, { size: 16, color: UI_COLORS.gold }).setOrigin(0.5);
        const w = Math.ceil((t.width + 48) / 2) * 2;
        const bg = panel(this.scene, -w / 2, -26, w, 52, 'gold');
        const toast = this.scene.add.container(width / 2, 150, [bg, t])
            .setScrollFactor(0).setDepth(150).setScale(0.4).setAlpha(0);

        this.scene.tweens.add({ targets: toast, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
        this.scene.tweens.add({
            targets: toast,
            y: 118,
            alpha: 0,
            delay: 900,
            duration: 600,
            ease: 'Sine.easeIn',
            onComplete: () => toast.destroy()
        });
    }

    showGameOver(reason) {
        const scene = this.scene;
        const { width, height } = scene.scale;

        dim(scene, 0.75).setDepth(190);

        const pw = 720;
        const ph = 420;
        const box = scene.add.container(width / 2, height / 2).setScrollFactor(0).setDepth(195);
        box.add(panel(scene, -pw / 2, -ph / 2, pw, ph, 'red'));

        // Hazard stripes along the top edge
        for (let x = -pw / 2 + 20; x < pw / 2 - 30; x += 32) {
            box.add(scene.add.rectangle(x, -ph / 2 + 22, 16, 8, 0xffc933).setOrigin(0));
        }

        box.add(label(scene, 0, -100, 'GAME OVER', { size: 48, color: UI_COLORS.red }).setOrigin(0.5));
        box.add(label(scene, 0, -24, reason, { size: 24, color: UI_COLORS.gold }).setOrigin(0.5));

        // Drop-in entrance
        box.y = -ph;
        scene.tweens.add({ targets: box, y: height / 2, duration: 520, ease: 'Bounce.easeOut' });

        // Visual cue only: GameScene.handleGameOver already restarts on any
        // click or ENTER, so the button itself must not restart a second time.
        createMenu(scene, {
            x: 0, y: 86, width: 320, items: [{ label: 'RESTART', action: () => {} }],
            container: box,
        });
        box.add(label(scene, 0, 150, 'PRESS ENTER', { size: 16, color: UI_COLORS.dim }).setOrigin(0.5));
    }
}
