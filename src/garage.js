// Pure upgrade math for the garage economy — imports CONFIG only, no Phaser.
import { CONFIG } from './config';

// Resolve the five derived stats from a per-track upgrade-level map.
// `upgrades` may be undefined or missing keys — treat those as level 0.
export function statsForUpgrades(upgrades) {
    const u = upgrades || {};
    const tracks = CONFIG.GARAGE.TRACKS;
    const at = (track) => tracks[track].values[u[track] || 0];
    return {
        moveDuration: at('engine'),
        maxFuel: at('fuelTank'),
        maxDamage: at('armor'),
        maxBombs: at('bombBay'),
        maxRockets: at('rocketRack'),
    };
}

// Price to go from `level` to `level + 1`; null when already maxed.
export function priceForNextLevel(level) {
    return CONFIG.GARAGE.PRICES[level] ?? null;
}

// { ok, reason, price } — reason is 'maxed' | 'funds' | null
export function canPurchase(save, track) {
    const level = save.upgrades[track] || 0;
    const price = priceForNextLevel(level);
    if (price === null) return { ok: false, reason: 'maxed', price: null };
    if (save.banked < price) return { ok: false, reason: 'funds', price };
    return { ok: true, reason: null, price };
}

// Mutates `save` on success (upgrades[track]++, banked -= price); returns bool.
export function purchase(save, track) {
    const check = canPurchase(save, track);
    if (!check.ok) return false;
    save.upgrades[track] = (save.upgrades[track] || 0) + 1;
    save.banked -= check.price;
    return true;
}
