import { CONFIG } from './config';
import { statsForUpgrades } from './garage';

// Pure game state — no Phaser dependencies, unit-testable.
export class GameState {
    constructor({ banked = 0, upgrades } = {}) {
        const stats = statsForUpgrades(upgrades);
        this.carried = 0;
        this.banked = banked;
        this.lives = CONFIG.PLAYER.LIVES;
        this.moveDuration = stats.moveDuration; // derived from engine upgrade
        this.maxFuel = stats.maxFuel;           // derived from fuelTank upgrade
        this.fuel = this.maxFuel;
        this.bombs = 0;
        this.maxBombs = stats.maxBombs;         // derived from bombBay upgrade
        this.rockets = 0;
        this.maxRockets = stats.maxRockets;     // derived from rocketRack upgrade
        this.damage = 0;
        this.maxDamage = stats.maxDamage;       // derived from armor upgrade
        this.maxLives = CONFIG.PLAYER.MAX_LIVES;
        this.nitroRemaining = 0;
        this.stars = 0;
        this.heat = 0;
        this.chaseCountdown = 0;
        this.starDecayTimer = 0;
        this.invulnRemaining = 0;
        this.gameOver = false;
        this.gameOverReason = null;
    }

    pickupMoney() {
        this.carried += CONFIG.ECONOMY.MONEY_VALUE;
        this.heat += 1;
        this.recomputeStars();
        this.refreshChase();
    }

    pickupDiamond() {
        this.carried += CONFIG.ECONOMY.DIAMOND_VALUE;
        this.addStars(CONFIG.DIAMOND_CAR.STARS_ON_PICKUP);
        this.refreshChase();
    }

    pickupBomb() {
        if (this.bombs >= this.maxBombs) return false;
        this.bombs++;
        return true;
    }

    useBomb() {
        if (this.bombs <= 0) return false;
        this.bombs--;
        return true;
    }

    pickupRocket() {
        if (this.rockets >= this.maxRockets) return false;
        this.rockets++;
        return true;
    }

    useRocket() {
        if (this.rockets <= 0) return false;
        this.rockets--;
        return true;
    }

    // Repair one point of damage; false (leave the pickup) when undamaged.
    repair() {
        if (this.damage <= 0) return false;
        this.damage--;
        return true;
    }

    // Grant an extra life; false (leave the pickup) when already at the cap.
    addLife() {
        if (this.lives >= this.maxLives) return false;
        this.lives++;
        return true;
    }

    // Nitro refreshes to full on re-pickup (no stacking).
    pickupNitro() {
        this.nitroRemaining = CONFIG.NITRO.DURATION_MS;
    }

    isNitroActive() {
        return this.nitroRemaining > 0;
    }

    onPoliceBombed() {
        this.addStars(1);
        this.refreshChase();
    }

    deposit() {
        const amount = this.carried;
        this.banked += amount;
        this.carried = 0;
        this.chaseCountdown = 0; // Chase ends; stars decay via tick()
        return amount;
    }

    // A police ram: accrue damage; a full bar delegates to onCaught (which
    // resets damage and grants the longer catch invuln — set AFTER this call,
    // so it wins). A survivable ram grants the shorter mercy window instead.
    onRammed(amount = 1) {
        this.damage += amount;
        if (this.damage >= this.maxDamage) {
            this.onCaught();
            return 'caught';
        }
        this.invulnRemaining = CONFIG.DAMAGE.MERCY_MS;
        return 'damaged';
    }

    onCaught() {
        this.carried = 0;
        this.damage = 0;
        this.lives--;
        this.stars = 0;
        this.heat = 0;
        this.chaseCountdown = 0;
        this.starDecayTimer = 0;
        this.nitroRemaining = 0;
        this.invulnRemaining = CONFIG.PLAYER.INVULN_MS;
        if (this.lives <= 0) {
            this.gameOver = true;
            this.gameOverReason = 'BUSTED!';
        }
    }

    tick(delta, { spotted = false } = {}) {
        if (this.invulnRemaining > 0) {
            this.invulnRemaining = Math.max(0, this.invulnRemaining - delta);
        }

        if (this.nitroRemaining > 0) {
            this.nitroRemaining = Math.max(0, this.nitroRemaining - delta);
        }

        if (this.chaseCountdown > 0) {
            this.chaseCountdown -= delta;

            // While spotted the countdown can't drop below its floor
            const floor = CONFIG.CHASE.COUNTDOWN_MS * CONFIG.CHASE.SPOTTED_FLOOR;
            if (spotted && this.chaseCountdown < floor) {
                this.chaseCountdown = floor;
            }
            if (this.chaseCountdown < 0) this.chaseCountdown = 0;

            this.starDecayTimer = 0;
        } else if (this.stars > 0) {
            // Chase over — stars decay stepwise
            this.starDecayTimer += delta;
            while (this.starDecayTimer >= CONFIG.CHASE.STAR_DECAY_MS && this.stars > 0) {
                this.starDecayTimer -= CONFIG.CHASE.STAR_DECAY_MS;
                this.stars--;
                this.heat = CONFIG.CHASE.STAR_THRESHOLDS[this.stars];
            }
        } else {
            this.starDecayTimer = 0;
        }
    }

    drainFuel(amount) {
        this.fuel = Math.max(0, this.fuel - amount);
    }

    addFuel(amount) {
        this.fuel = Math.min(this.maxFuel, this.fuel + amount);
    }

    // Recompute the five derived stats after a garage purchase mid-run.
    // Deliberately does NOT touch current fuel/damage/bombs/rockets counts:
    // maxes only grow, so existing counts stay valid (buying armor while
    // damaged just increases remaining hits).
    applyUpgrades(upgrades) {
        const stats = statsForUpgrades(upgrades);
        this.moveDuration = stats.moveDuration;
        this.maxFuel = stats.maxFuel;
        this.maxDamage = stats.maxDamage;
        this.maxBombs = stats.maxBombs;
        this.maxRockets = stats.maxRockets;
    }

    // Running dry costs a life (same as a catch), then refills the tank so the
    // respawn doesn't immediately re-trigger the out-of-fuel check.
    onOutOfFuel() {
        this.onCaught();          // lose carried, a life, stars/heat reset, invuln, maybe gameOver
        this.fuel = this.maxFuel; // full tank on respawn; prevents immediate re-trigger
        if (this.gameOver) this.gameOverReason = 'OUT OF FUEL!';
    }

    addStars(count) {
        this.stars = Math.min(5, this.stars + count);
        // Keep heat consistent so a later recompute can't drop the stars
        this.heat = Math.max(this.heat, CONFIG.CHASE.STAR_THRESHOLDS[this.stars]);
    }

    recomputeStars() {
        const thresholds = CONFIG.CHASE.STAR_THRESHOLDS;
        let stars = 0;
        for (let i = thresholds.length - 1; i >= 0; i--) {
            if (this.heat >= thresholds[i]) {
                stars = i;
                break;
            }
        }
        this.stars = Math.min(5, stars);
    }

    refreshChase() {
        this.chaseCountdown = CONFIG.CHASE.COUNTDOWN_MS;
        this.starDecayTimer = 0;
    }

    isChasing() {
        return this.chaseCountdown > 0;
    }

    isInvulnerable() {
        return this.invulnRemaining > 0;
    }
}
