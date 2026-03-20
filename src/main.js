import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
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
  scene: [GameScene],
};

const game = new Phaser.Game(config);
