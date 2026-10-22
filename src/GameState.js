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
        this.nitros = 0;          // stored charges
        this.nitroRemaining = 0;  // ms left on the running boost
        this.pushMeter = 0;       // 0..1, filled by tapping push, drains over time
        this.pumpOwed = 0;        // fractional dollars pumped but not yet charged
        this.stars = 0;
        this.heat = 0;
        this.chaseCountdown = 0;
        this.starDecayTimer = 0;
        this.invulnRemaining = 0;
        this.railPasses = 0;
        this.onRails = false;   // riding the track on a spent rail pass
        this.heistTimer = 0;    // ms accumulated towards the next heist payout
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

    // False (leave the pickup) while already holding the most allowed.
    pickupRailPass() {
        if (this.railPasses >= CONFIG.RAIL_PASS.MAX_CARRY) return false;
        this.railPasses++;
        return true;
    }

    canBoardRails() {
        return this.onRails || this.railPasses > 0;
    }

    // Turning off a crossing onto the track spends the pass for the whole ride
    boardRails() {
        if (this.onRails) return true;
        if (this.railPasses <= 0) return false;
        this.railPasses--;
        this.onRails = true;
        return true;
    }

    // Back on the road: getting on again takes another pass
    leaveRails() {
        this.onRails = false;
    }

    // Parked on the platform while the vault is open: every full second pays
    // out and adds heat. Returns how many payouts landed this tick.
    heistTick(delta) {
        this.heistTimer += delta;
        let payouts = 0;
        while (this.heistTimer >= 1000) {
            this.heistTimer -= 1000;
            this.carried += CONFIG.TRAIN.HEIST_PER_SEC;
            this.heat += CONFIG.TRAIN.HEIST_HEAT_PER_SEC;
            payouts++;
        }
        if (payouts > 0) {
            this.recomputeStars();
            this.refreshChase();
        }
        return payouts;
    }

    resetHeist() {
        this.heistTimer = 0;
    }

    // A train costs a life outright, armor or not
    onTrainHit() {
        this.onCaught();
        if (this.gameOver) this.gameOverReason = 'hitByTrain';
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

    // A nitro pickup is stored; the player fires it later with useNitro.
    pickupNitro() {
        if (this.nitros >= CONFIG.NITRO.MAX_CARRY) return false;
        this.nitros++;
        return true;
    }

    // Burn one stored charge. Refused while a boost is already running, so
    // a double press can't waste a charge, and on an empty tank, where the
    // car only crawls and the boost would do nothing.
    useNitro() {
        if (this.nitros <= 0 || this.isNitroActive() || this.isOutOfFuel()) return false;
        this.nitros--;
        this.nitroRemaining = CONFIG.NITRO.DURATION_MS;
        return true;
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
        this.onRails = false;
        this.heistTimer = 0;
        this.pushMeter = 0;
        this.invulnRemaining = CONFIG.PLAYER.INVULN_MS;
        if (this.lives <= 0) {
            this.gameOver = true;
            this.gameOverReason = 'busted';
        }
    }

    tick(delta, { spotted = false } = {}) {
        if (this.invulnRemaining > 0) {
            this.invulnRemaining = Math.max(0, this.invulnRemaining - delta);
        }

        if (this.nitroRemaining > 0) {
            this.nitroRemaining = Math.max(0, this.nitroRemaining - delta);
        }

        if (this.pushMeter > 0) {
            this.pushMeter = Math.max(0, this.pushMeter - CONFIG.PUSH.DECAY_PER_SEC * (delta / 1000));
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

    isOutOfFuel() {
        return this.fuel <= 0;
    }

    // One tap of the push key. Only an empty tank can be pushed; false
    // otherwise.
    push() {
        if (!this.isOutOfFuel()) return false;
        this.pushMeter = Math.min(1, this.pushMeter + CONFIG.PUSH.PER_PRESS);
        return true;
    }

    isPushing() {
        return this.pushMeter > 0;
    }

    // Per-tile move duration for the player this frame. An empty tank crawls
    // (and only moves while pushed, see GameScene), nitro or not. Otherwise
    // nitro speeds it up. `slowFactor` is the helicopter spotlight.
    playerMoveDuration(slowFactor = 1) {
        let factor = 1;
        if (this.isOutOfFuel()) {
            factor = CONFIG.PUSH.DRY_SPEED_FACTOR;
        } else if (this.isNitroActive()) {
            factor = CONFIG.NITRO.SPEED_FACTOR;
        }
        return this.moveDuration * factor * slowFactor;
    }

    // Take `amount` dollars, carried cash first, then the bank. Never more
    // than the player has. Returns the split so the caller knows whether the
    // persistent bank changed.
    pay(amount) {
        const fromCarried = Math.min(this.carried, amount);
        this.carried -= fromCarried;
        const fromBank = Math.min(this.banked, amount - fromCarried);
        this.banked -= fromBank;
        return { fromCarried, fromBank };
    }

    // Any money at all, carried or banked, to buy fuel with
    canAffordFuel() {
        return this.carried + this.banked > this.pumpOwed;
    }

    // Pump for `delta` ms at a station. Fuel is charged as it flows, in whole
    // dollars (the fraction carries over to the next fill), and the pump only
    // gives what the player can pay for: no cash, no gas. A broke player on an
    // empty tank pushes the car to cash on the road, then to a pump.
    // Returns { pumped, paid, fromBank, broke }; broke means the money ran out
    // with room still left in the tank.
    refuel(delta) {
        const room = this.maxFuel - this.fuel;
        if (room <= 0) return { pumped: 0, paid: 0, fromBank: 0, broke: false };

        const affordable = (this.carried + this.banked - this.pumpOwed) / CONFIG.FUEL.PRICE;
        const pumped = Math.max(0, Math.min(room, affordable, CONFIG.FUEL.REFUEL_PER_SEC * (delta / 1000)));
        this.fuel += pumped;
        this.pumpOwed += pumped * CONFIG.FUEL.PRICE;
        const due = Math.floor(this.pumpOwed + 1e-9); // float sums land a hair under whole dollars
        const { fromCarried, fromBank } = this.pay(due);
        this.pumpOwed -= due;
        const broke = this.fuel < this.maxFuel && !this.canAffordFuel();
        return { pumped, paid: fromCarried + fromBank, fromBank, broke };
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
