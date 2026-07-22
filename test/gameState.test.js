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
            expect(state.gameOverReason).toBe('BUSTED!');
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

    describe('onOutOfFuel', () => {
        it('costs a life and refills the tank when lives remain', () => {
            const state = new GameState();
            state.pickupMoney();
            expect(state.lives).toBeGreaterThan(1);

            state.onOutOfFuel();
            expect(state.lives).toBe(CONFIG.PLAYER.LIVES - 1);
            expect(state.carried).toBe(0);
            expect(state.stars).toBe(0);
            expect(state.fuel).toBe(state.maxFuel);
            expect(state.isInvulnerable()).toBe(true);
            expect(state.gameOver).toBe(false);
        });

        it('at 1 life ends the game with the OUT OF FUEL reason', () => {
            const state = new GameState();
            state.lives = 1;
            state.onOutOfFuel();
            expect(state.gameOver).toBe(true);
            expect(state.gameOverReason).toBe('OUT OF FUEL!');
        });

        it('a normal catch chain to 0 lives still reports BUSTED!', () => {
            const state = new GameState();
            for (let i = 0; i < CONFIG.PLAYER.LIVES; i++) {
                state.onCaught();
            }
            expect(state.gameOver).toBe(true);
            expect(state.gameOverReason).toBe('BUSTED!');
        });
    });
});
