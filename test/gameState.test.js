import { describe, it, expect } from 'vitest';
import { GameState } from '../src/GameState';
import { CONFIG } from '../src/config';

describe('GameState', () => {
    it('starts with plan defaults', () => {
        const state = new GameState();
        expect(state.carried).toBe(0);
        expect(state.banked).toBe(0);
        expect(state.lives).toBe(CONFIG.PLAYER.LIVES);
        expect(state.fuel).toBe(CONFIG.FUEL.MAX);
        expect(state.stars).toBe(0);
        expect(state.gameOver).toBe(false);
    });

    describe('star thresholds', () => {
        it('maps heat 0 / 1 / 3 to stars 0 / 1 / 2', () => {
            const state = new GameState();

            state.heat = 0;
            state.recomputeStars();
            expect(state.stars).toBe(0);

            state.heat = 1;
            state.recomputeStars();
            expect(state.stars).toBe(1);

            state.heat = 3;
            state.recomputeStars();
            expect(state.stars).toBe(2);
        });

        it('addStars caps at 5', () => {
            const state = new GameState();
            state.addStars(3);
            expect(state.stars).toBe(3);
            state.addStars(4);
            expect(state.stars).toBe(5);
        });

        it('pickupMoney at high heat caps stars at 5', () => {
            const state = new GameState();
            state.heat = 100; // Way past the top threshold
            state.pickupMoney();
            expect(state.stars).toBe(5);
        });
    });

    describe('deposit', () => {
        it('moves carried to banked and zeroes the chase countdown', () => {
            const state = new GameState();
            state.pickupMoney();
            state.pickupMoney();
            expect(state.carried).toBe(2 * CONFIG.ECONOMY.MONEY_VALUE);
            expect(state.chaseCountdown).toBeGreaterThan(0);

            const amount = state.deposit();
            expect(amount).toBe(2 * CONFIG.ECONOMY.MONEY_VALUE);
            expect(state.carried).toBe(0);
            expect(state.banked).toBe(2 * CONFIG.ECONOMY.MONEY_VALUE);
            expect(state.chaseCountdown).toBe(0);
            expect(state.isChasing()).toBe(false);
        });
    });

    describe('onCaught', () => {
        it('decrements lives, clears carried, grants invulnerability', () => {
            const state = new GameState();
            state.pickupMoney();

            state.onCaught();
            expect(state.lives).toBe(CONFIG.PLAYER.LIVES - 1);
            expect(state.carried).toBe(0);
            expect(state.stars).toBe(0);
            expect(state.isInvulnerable()).toBe(true);
            expect(state.gameOver).toBe(false);
        });

        it('sets gameOver at 0 lives', () => {
            const state = new GameState();
            for (let i = 0; i < CONFIG.PLAYER.LIVES; i++) {
                state.onCaught();
            }
            expect(state.lives).toBe(0);
            expect(state.gameOver).toBe(true);
            expect(state.gameOverReason).toBe('busted');
        });
    });

    describe('onRammed', () => {
        it('accrues damage and returns "damaged" until the bar fills', () => {
            const state = new GameState();

            expect(state.onRammed()).toBe('damaged');
            expect(state.damage).toBe(1);

            expect(state.onRammed()).toBe('damaged');
            expect(state.damage).toBe(2);

            expect(state.onRammed()).toBe('caught');
        });

        it('resets damage and takes exactly one life on a catch', () => {
            const state = new GameState();
            state.pickupMoney();

            state.onRammed();
            state.onRammed();
            const result = state.onRammed(); // third — caught

            expect(result).toBe('caught');
            expect(state.damage).toBe(0);
            expect(state.lives).toBe(CONFIG.PLAYER.LIVES - 1);
            expect(state.carried).toBe(0);
        });

        it('grants the mercy window on a survivable ram', () => {
            const state = new GameState();
            state.onRammed();
            expect(state.isInvulnerable()).toBe(true);
            expect(state.invulnRemaining).toBe(CONFIG.DAMAGE.MERCY_MS);
        });

        it('grants the longer catch invuln (wins over mercy) on a catch', () => {
            const state = new GameState();
            state.onRammed();
            state.onRammed();
            state.onRammed(); // caught
            expect(state.invulnRemaining).toBe(CONFIG.PLAYER.INVULN_MS);
        });

        it('overkill from partial damage is safe (2 damage + 2 → caught)', () => {
            const state = new GameState();
            state.onRammed(); // damage 1
            state.onRammed(); // damage 2
            expect(state.onRammed(2)).toBe('caught');
            expect(state.damage).toBe(0);
            expect(state.invulnRemaining).toBe(CONFIG.PLAYER.INVULN_MS);
        });
    });

    describe('tick', () => {
        it('steps stars down after the chase ends', () => {
            const state = new GameState();
            state.addStars(2);
            expect(state.chaseCountdown).toBe(0);

            state.tick(CONFIG.CHASE.STAR_DECAY_MS);
            expect(state.stars).toBe(1);

            state.tick(CONFIG.CHASE.STAR_DECAY_MS);
            expect(state.stars).toBe(0);
        });

        it('stops decaying at 0 stars', () => {
            const state = new GameState();
            state.addStars(1);

            state.tick(CONFIG.CHASE.STAR_DECAY_MS * 10);
            expect(state.stars).toBe(0);
            expect(state.heat).toBe(0);

            state.tick(CONFIG.CHASE.STAR_DECAY_MS * 10);
            expect(state.stars).toBe(0);
            expect(state.starDecayTimer).toBe(0);
        });

        it('does not decay stars while the chase countdown is running', () => {
            const state = new GameState();
            state.addStars(2);
            state.refreshChase();

            state.tick(CONFIG.CHASE.STAR_DECAY_MS);
            expect(state.stars).toBe(2);
            expect(state.chaseCountdown).toBe(CONFIG.CHASE.COUNTDOWN_MS - CONFIG.CHASE.STAR_DECAY_MS);
        });

        it('clamps the countdown to the spotted floor', () => {
            const state = new GameState();
            state.refreshChase();

            state.tick(CONFIG.CHASE.COUNTDOWN_MS * 2, { spotted: true });
            expect(state.chaseCountdown).toBe(CONFIG.CHASE.COUNTDOWN_MS * CONFIG.CHASE.SPOTTED_FLOOR);
            expect(state.isChasing()).toBe(true);
        });

        it('counts down invulnerability', () => {
            const state = new GameState();
            state.onCaught();
            state.tick(CONFIG.PLAYER.INVULN_MS);
            expect(state.isInvulnerable()).toBe(false);
        });
    });

    describe('bombs', () => {
        it('caps pickup at maxBombs and leaves the count unchanged when full', () => {
            const state = new GameState();
            for (let i = 0; i < state.maxBombs; i++) {
                expect(state.pickupBomb()).toBe(true);
            }
            expect(state.pickupBomb()).toBe(false);
            expect(state.bombs).toBe(state.maxBombs);
        });

        it('useBomb decrements and returns false at 0', () => {
            const state = new GameState();
            expect(state.useBomb()).toBe(false);
            expect(state.bombs).toBe(0);

            state.pickupBomb();
            expect(state.useBomb()).toBe(true);
            expect(state.bombs).toBe(0);
            expect(state.useBomb()).toBe(false);
        });

        it('onPoliceBombed adds a star and refreshes the chase', () => {
            const state = new GameState();
            state.onPoliceBombed();
            expect(state.stars).toBe(1);
            expect(state.chaseCountdown).toBe(CONFIG.CHASE.COUNTDOWN_MS);
        });
    });

    describe('rockets', () => {
        it('caps pickup at maxRockets and leaves the count unchanged when full', () => {
            const state = new GameState();
            for (let i = 0; i < state.maxRockets; i++) {
                expect(state.pickupRocket()).toBe(true);
            }
            expect(state.pickupRocket()).toBe(false);
            expect(state.rockets).toBe(state.maxRockets);
        });

        it('useRocket decrements and returns false at 0', () => {
            const state = new GameState();
            expect(state.useRocket()).toBe(false);
            expect(state.rockets).toBe(0);

            state.pickupRocket();
            expect(state.useRocket()).toBe(true);
            expect(state.rockets).toBe(0);
            expect(state.useRocket()).toBe(false);
        });
    });

    describe('repair', () => {
        it('returns false and changes nothing at 0 damage', () => {
            const state = new GameState();
            expect(state.damage).toBe(0);
            expect(state.repair()).toBe(false);
            expect(state.damage).toBe(0);
        });

        it('decrements damage and returns true when damaged', () => {
            const state = new GameState();
            state.onRammed(); // damage 1
            expect(state.repair()).toBe(true);
            expect(state.damage).toBe(0);
        });
    });

    describe('addLife', () => {
        it('adds a life below the cap and returns true', () => {
            const state = new GameState();
            state.onCaught(); // lives -> LIVES - 1
            const before = state.lives;
            expect(state.addLife()).toBe(true);
            expect(state.lives).toBe(before + 1);
        });

        it('caps at maxLives and returns false', () => {
            const state = new GameState();
            state.lives = state.maxLives;
            expect(state.addLife()).toBe(false);
            expect(state.lives).toBe(state.maxLives);
        });
    });

    describe('nitro', () => {
        it('pickup sets the timer and isNitroActive', () => {
            const state = new GameState();
            expect(state.isNitroActive()).toBe(false);
            state.pickupNitro();
            expect(state.nitroRemaining).toBe(CONFIG.NITRO.DURATION_MS);
            expect(state.isNitroActive()).toBe(true);
        });

        it('tick expires the timer after the full duration', () => {
            const state = new GameState();
            state.pickupNitro();
            state.tick(CONFIG.NITRO.DURATION_MS);
            expect(state.nitroRemaining).toBe(0);
            expect(state.isNitroActive()).toBe(false);
        });

        it('re-pickup mid-timer refreshes to full (no stacking)', () => {
            const state = new GameState();
            state.pickupNitro();
            state.tick(CONFIG.NITRO.DURATION_MS / 2);
            expect(state.nitroRemaining).toBe(CONFIG.NITRO.DURATION_MS / 2);
            state.pickupNitro();
            expect(state.nitroRemaining).toBe(CONFIG.NITRO.DURATION_MS);
        });

        it('onCaught zeroes the nitro timer', () => {
            const state = new GameState();
            state.pickupNitro();
            state.onCaught();
            expect(state.nitroRemaining).toBe(0);
            expect(state.isNitroActive()).toBe(false);
        });
    });

    describe('pickupDiamond', () => {
        it('adds the diamond value to carried, +2 stars, refreshes the chase', () => {
            const state = new GameState();
            state.pickupDiamond();
            expect(state.carried).toBe(CONFIG.ECONOMY.DIAMOND_VALUE);
            expect(state.stars).toBe(CONFIG.DIAMOND_CAR.STARS_ON_PICKUP);
            expect(state.chaseCountdown).toBe(CONFIG.CHASE.COUNTDOWN_MS);
        });
    });

    describe('fuel', () => {
        it('clamps drain at 0 and refill at maxFuel', () => {
            const state = new GameState();
            state.drainFuel(state.maxFuel + 50);
            expect(state.fuel).toBe(0);

            state.addFuel(state.maxFuel + 50);
            expect(state.fuel).toBe(state.maxFuel);
        });
    });

    describe('upgrades', () => {
        it('constructor applies banked + upgrade-derived stats', () => {
            const state = new GameState({ banked: 5000, upgrades: { fuelTank: 3, armor: 1 } });
            expect(state.banked).toBe(5000);
            expect(state.maxFuel).toBe(200);
            expect(state.fuel).toBe(200);
            expect(state.maxDamage).toBe(4);
            expect(state.moveDuration).toBe(300); // engine still level 0
        });

        it('applyUpgrades raises maxes mid-run without touching current counts', () => {
            const state = new GameState();

            state.damage = 2;
            state.applyUpgrades({ armor: 3 });
            expect(state.maxDamage).toBe(6);
            expect(state.damage).toBe(2); // unchanged

            state.fuel = 10;
            state.applyUpgrades({ armor: 3, fuelTank: 3 });
            expect(state.maxFuel).toBe(200);
            expect(state.fuel).toBe(10); // unchanged
        });
    });

    describe('game over', () => {
        it('a catch chain to 0 lives reports busted', () => {
            const state = new GameState();
            for (let i = 0; i < CONFIG.PLAYER.LIVES; i++) {
                state.onCaught();
            }
            expect(state.gameOver).toBe(true);
            expect(state.gameOverReason).toBe('busted');
        });
    });

    describe('paying for gas', () => {
        const PRICE = CONFIG.FUEL.PRICE;
        const RATE = CONFIG.FUEL.REFUEL_PER_SEC;

        it('charges carried cash first, then the bank', () => {
            const state = new GameState({ banked: 1000 });
            state.carried = 10;
            state.fuel = 0;

            const result = state.refuel(1000); // one second at the pump
            const cost = RATE * PRICE;
            expect(state.fuel).toBeCloseTo(RATE);
            expect(result.paid).toBe(cost);
            expect(state.carried).toBe(0);
            expect(result.fromBank).toBe(cost - 10);
            expect(state.banked).toBe(1000 - (cost - 10));
        });

        it('charges whole dollars and carries the fraction to the next frame', () => {
            const state = new GameState({ banked: 1000 });
            state.fuel = 0;
            let paid = 0;
            for (let i = 0; i < 60; i++) paid += state.refuel(1000 / 60).paid; // 1s at 60fps
            expect(paid).toBe(Math.floor(RATE * PRICE));
            expect(state.banked).toBe(1000 - paid);
        });

        it('a full tank costs nothing and pumps nothing', () => {
            const state = new GameState({ banked: 1000 });
            expect(state.refuel(1000)).toEqual({ pumped: 0, paid: 0, fromBank: 0, broke: false });
            expect(state.banked).toBe(1000);
        });

        it('only fills the room left in the tank', () => {
            const state = new GameState({ banked: 1000 });
            state.fuel = state.maxFuel - 3;
            const result = state.refuel(5000);
            expect(result.pumped).toBeCloseTo(3);
            expect(state.fuel).toBe(state.maxFuel);
            expect(result.paid).toBe(3 * PRICE);
        });

        it('flat broke: no gas at all', () => {
            const state = new GameState();
            state.fuel = 0;
            const result = state.refuel(1000);
            expect(result.pumped).toBe(0);
            expect(result.broke).toBe(true);
            expect(state.fuel).toBe(0);
            expect(state.canAffordFuel()).toBe(false);
        });

        it('only pumps as much as the player can pay for', () => {
            const state = new GameState({ banked: 4 });
            state.fuel = 0;
            const result = state.refuel(1000);
            expect(result.pumped).toBeCloseTo(4 / PRICE);
            expect(result.paid).toBe(4);
            expect(result.broke).toBe(true);
            expect(state.banked).toBe(0);
            expect(state.carried).toBe(0);
            expect(state.pumpOwed).toBeCloseTo(0);

            // Next frame: nothing more comes out
            expect(state.refuel(100).pumped).toBe(0);
        });

        it('cash picked up on the road buys fuel again', () => {
            const state = new GameState();
            state.fuel = 0;
            state.pickupMoney();
            expect(state.canAffordFuel()).toBe(true);
            state.refuel(1000);
            expect(state.fuel).toBeCloseTo(RATE);
            expect(state.carried).toBe(CONFIG.ECONOMY.MONEY_VALUE - RATE * PRICE);
        });
    });

    describe('push', () => {
        it('each tap fills the meter, capped at 1', () => {
            const state = new GameState();
            state.push();
            expect(state.pushMeter).toBe(CONFIG.PUSH.PER_PRESS);
            for (let i = 0; i < 20; i++) state.push();
            expect(state.pushMeter).toBe(1);
            expect(state.isPushing()).toBe(true);
        });

        it('the meter drains over time', () => {
            const state = new GameState();
            for (let i = 0; i < 4; i++) state.push();
            state.tick(500);
            expect(state.pushMeter).toBeCloseTo(1 - CONFIG.PUSH.DECAY_PER_SEC * 0.5);
            state.tick(10000);
            expect(state.pushMeter).toBe(0);
            expect(state.isPushing()).toBe(false);
        });

        it('a full meter speeds the car up, but less than nitro', () => {
            const state = new GameState();
            const base = state.playerMoveDuration();
            expect(base).toBe(state.moveDuration);

            for (let i = 0; i < 4; i++) state.push();
            const pushed = state.playerMoveDuration();
            expect(pushed).toBeCloseTo(base * CONFIG.PUSH.SPEED_FACTOR);

            state.pickupNitro();
            expect(state.playerMoveDuration()).toBeCloseTo(base * CONFIG.NITRO.SPEED_FACTOR);
            expect(CONFIG.NITRO.SPEED_FACTOR).toBeLessThan(CONFIG.PUSH.SPEED_FACTOR);
        });

        it('burns extra fuel in proportion to the meter', () => {
            const state = new GameState();
            state.burnFuel(1000);
            const plain = state.maxFuel - state.fuel;
            expect(plain).toBeCloseTo(CONFIG.FUEL.DRAIN_PER_SEC);

            state.fuel = state.maxFuel;
            for (let i = 0; i < 4; i++) state.push();
            state.burnFuel(1000);
            expect(state.maxFuel - state.fuel).toBeCloseTo(CONFIG.FUEL.DRAIN_PER_SEC + CONFIG.PUSH.FUEL_PER_SEC);
        });

        it('an empty tank crawls at the dry speed, nitro or not', () => {
            const state = new GameState();
            state.fuel = 0;
            state.pickupNitro();
            expect(state.isOutOfFuel()).toBe(true);
            expect(state.playerMoveDuration()).toBe(state.moveDuration * CONFIG.PUSH.DRY_SPEED_FACTOR);
        });

        it('the helicopter slow factor applies on top', () => {
            const state = new GameState();
            expect(state.playerMoveDuration(1.5)).toBe(state.moveDuration * 1.5);
        });

        it('a catch empties the meter', () => {
            const state = new GameState();
            state.push();
            state.onCaught();
            expect(state.pushMeter).toBe(0);
        });
    });
});
