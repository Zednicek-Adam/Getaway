// Central game configuration — all tunables live here.
// Keys not yet consumed by the game are reserved for upcoming work packages.
export const CONFIG = {
    PLAYER: {
        MOVE_DURATION: 300,   // ms per tile
        LIVES: 3,
        INVULN_MS: 3000,      // invulnerability after being caught
        MAX_BOMBS: 3,
        QUEUE_MAX: 3,         // max buffered turns
        MAX_LIVES: 5,         // reserved for WP2 (extra-life pickup cap)
    },

    DAMAGE: {
        MAX_HITS: 3,          // rams to a full catch
        MERCY_MS: 1500,       // player invuln window after a survivable ram
        POLICE_STUN_MS: 1000, // ramming unit freezes this long
    },

    FUEL: {
        MAX: 100,
        DRAIN_PER_SEC: 1,     // % per second while moving
        PICKUP_AMOUNT: 35,    // fuel collectible refill
        REFUEL_PER_SEC: 25,   // station refuel rate
    },

    ECONOMY: {
        MONEY_VALUE: 100,
        DIAMOND_VALUE: 1000,
    },

    COLLECTIBLES: {
        INITIAL_COUNT: 50,
        WEIGHTS: { money: 0.70, bomb: 0.12, repair: 0.08, nitro: 0.06, rocket: 0.03, life: 0.01 },
    },

    NITRO: {
        SPEED_FACTOR: 0.65,   // move-duration multiplier while active (300ms → 195ms/tile ≈ 1.54× speed)
        DURATION_MS: 4000,
    },

    MAP: {
        FUEL_STATIONS: 3,
        STATION_MIN_SPACING: 12, // Manhattan distance
    },

    CHASE: {
        COUNTDOWN_MS: 20000,     // chase countdown once stars are active
        SPOT_RADIUS: 6,          // tiles within which police "spot" the player
        SPOTTED_FLOOR: 0.25,     // countdown can't drop below this fraction while spotted
        STAR_DECAY_MS: 5000,     // one star lost per this interval after chase ends
        STAR_THRESHOLDS: [0, 1, 3, 6, 10, 15], // heat required for stars 0..5
    },

    POLICE: {
        SPAWN_MIN_DIST: 15,      // Manhattan distance from player
        AWARE_RADIUS: 10,        // 'near' AI chases the live player inside this range
        INTERCEPT_LOOKAHEAD: 3,  // 'intercept' AI aims this many tiles ahead of the player
        RESPAWN_AFTER_BOMB_MS: 8000, // delay before a bombed unit is replaced
        BY_STARS: {
            0: { units: { police: 0 }, duration: 380, ai: 'roam' },
            1: { units: { police: 1 }, duration: 380, ai: 'near' },
            2: { units: { police: 2 }, duration: 360, ai: 'near' },
            3: { units: { police: 3 }, duration: 340, ai: 'direct' },
            4: { units: { police: 4 }, duration: 320, ai: 'intercept' },
            5: { units: { police: 5 }, duration: 300, ai: 'intercept' },
        },
    },

    DIAMOND_CAR: {
        MOVE_DURATION: 420,
        SPAWN_MIN_DIST: 15,
        RESPAWN_MS: 45000,
        STARS_ON_PICKUP: 2,
    },

    BOMB: {
        FUSE_MS: 10000,
    },

    ROCKET: {
        MAX_CARRY: 2,
        RANGE_TILES: 8,
        MS_PER_TILE: 60,
    },
};
