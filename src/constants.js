export const TILE_SIZE = 64;
// Viewport / Screen Size (in tiles)
export const VIEWPORT_WIDTH = 20;
export const VIEWPORT_HEIGHT = 15;

// Total Map Size (in tiles)
export const MAP_WIDTH = 50;
export const MAP_HEIGHT = 50;

export const DIRECTIONS = {
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3,
};

export const COLORS = {
  PLAYER: 0xFF0000,    // Bright Red
  POLICE: 0x0000FF,    // Blue
  ROAD: 0x333333,      // Dark Gray
  GRASS: 0x008800,     // Green
  BUILDING: 0x888888,  // Light Gray
  MONEY: 0xFFD700,     // Gold
  FUEL: 0x00FF00,      // Green (Bright)
  BOMB: 0x000000,      // Black
};

export const TILE_TYPES = {
  GRASS: 0,
  ROAD_HORIZONTAL: 1,
  ROAD_VERTICAL: 2,
  ROAD_INT_ALL: 3,
  ROAD_TURN_B_R: 4,
  ROAD_TURN_B_L: 5,
  ROAD_TURN_T_R: 6,
  ROAD_TURN_T_L: 7,
  ROAD_INT_B_R_L: 8,
  ROAD_INT_T_R_L: 9,
  ROAD_INT_T_B_L: 10,
  ROAD_INT_T_B_R: 11,
  BUILDING: 12,
  ROAD_GENERIC: 1, // Fallback to horizontal
};
