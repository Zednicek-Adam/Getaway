// Central game configuration — all tunables live here.
// Keys not yet consumed by the game are reserved for upcoming work packages.
export const CONFIG = {
    PLAYER: {
        MOVE_DURATION: 300,   // ms per tile
        LIVES: 3,
        INVULN_MS: 3000,      // invulnerability after being caught
        MAX_BOMBS: 3,
        QUEUE_MAX: 3,         // max buffered turns
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
        BOMB_CHANCE: 0.15,
    },

    MAP: {
        FUEL_STATIONS: 3,
        STATION_MIN_SPACING: 12, // Manhattan distance
    },

    CHASE: {
        LEGACY_CHASE_MS: 10000,  // pre-star-system fixed chase duration
        COUNTDOWN_MS: 20000,     // chase countdown once stars are active
        SPOT_RADIUS: 6,          // tiles within which police "spot" the player
        SPOTTED_FLOOR: 0.25,     // countdown can't drop below this fraction while spotted
        STAR_DECAY_MS: 5000,     // one star lost per this interval after chase ends
        STAR_THRESHOLDS: [0, 1, 3, 6, 10, 15], // heat required for stars 0..5
    },

    POLICE: {
        LEGACY_DURATION: 350,    // ms per tile (pre-star-system speed)
        SPAWN_MIN_DIST: 15,      // Manhattan distance from player
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
};
