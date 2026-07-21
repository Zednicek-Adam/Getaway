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
        it('caps pickup at MAX_BOMBS and leaves the count unchanged when full', () => {
            const state = new GameState();
            for (let i = 0; i < CONFIG.PLAYER.MAX_BOMBS; i++) {
                expect(state.pickupBomb()).toBe(true);
            }
            expect(state.pickupBomb()).toBe(false);
            expect(state.bombs).toBe(CONFIG.PLAYER.MAX_BOMBS);
        });
    });

    describe('fuel', () => {
        it('clamps drain at 0 and refill at MAX', () => {
            const state = new GameState();
            state.drainFuel(CONFIG.FUEL.MAX + 50);
            expect(state.fuel).toBe(0);

            state.addFuel(CONFIG.FUEL.MAX + 50);
            expect(state.fuel).toBe(CONFIG.FUEL.MAX);
        });
    });
});
