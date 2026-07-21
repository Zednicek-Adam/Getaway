import { CONFIG } from './config';

// Pure game state — no Phaser dependencies, unit-testable.
export class GameState {
    constructor() {
        this.carried = 0;
        this.banked = 0;
        this.lives = CONFIG.PLAYER.LIVES;
        this.fuel = CONFIG.FUEL.MAX;
        this.bombs = 0;
        this.damage = 0;
        this.maxDamage = CONFIG.DAMAGE.MAX_HITS; // instance field — Milestone 3 prep
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
        if (this.bombs >= CONFIG.PLAYER.MAX_BOMBS) return false;
        this.bombs++;
        return true;
    }

    useBomb() {
        if (this.bombs <= 0) return false;
        this.bombs--;
        return true;
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
        this.fuel = Math.min(CONFIG.FUEL.MAX, this.fuel + amount);
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
