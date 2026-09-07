import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { GarageScene } from './scenes/GarageScene';
import { TILE_SIZE, VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from './constants';

const config = {
  type: Phaser.AUTO,
  width: VIEWPORT_WIDTH * TILE_SIZE,
  height: VIEWPORT_HEIGHT * TILE_SIZE,
  backgroundColor: '#222222',
  parent: 'app',
  scale: {
    // The design resolution (1280x960) is taller than most browser viewports,
    // so centering alone would push the bottom of the canvas off-screen. FIT
    // scales it down to the largest size that fits, preserving aspect ratio,
    // and CENTER_BOTH centers the result. The game still thinks in 1280x960
    // coordinates; Phaser transforms pointer input to match.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: [MenuScene, GameScene, PauseScene, GarageScene],
};

// Wait for the font to load before creating the game
window.addEventListener('load', () => {
  // A small delay to ensure the webfont is processed by the browser
  setTimeout(() => {
    const game = new Phaser.Game(config);
  }, 100);
});
