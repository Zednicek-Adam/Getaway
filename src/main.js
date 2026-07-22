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
