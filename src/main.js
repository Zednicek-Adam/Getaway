import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { GarageScene } from './scenes/GarageScene';
import { InstructionsScene } from './scenes/InstructionsScene';
import { CreditsScene } from './scenes/CreditsScene';
import { TILE_SIZE, VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from './constants';
import { getBrowserStorage } from './storage';
import { initLanguage, getLanguage } from './i18n';
import { gameSizeFor, watchScreen } from './screen';
import { touchControlsActive } from './ui/touchControls';

// Phones and tablets fill the page; desktops keep the 4:3 design size
const fillPage = touchControlsActive();
const pageSize = () => {
  const app = document.getElementById('app');
  return { width: app.clientWidth, height: app.clientHeight };
};

const config = {
  type: Phaser.AUTO,
  // The 1280x960 design size. Touch screens swap in the page's own shape at
  // boot (see screen.js).
  width: VIEWPORT_WIDTH * TILE_SIZE,
  height: VIEWPORT_HEIGHT * TILE_SIZE,
  backgroundColor: '#0b0c14',
  parent: 'app',
  // Nearest-neighbour sampling + whole-pixel rendering keeps every sprite crisp
  pixelArt: true,
  scale: {
    // The design resolution (1280x960) is taller than most browser viewports,
    // so centering alone would push the bottom of the canvas off-screen. FIT
    // scales it down to the largest size that fits, preserving aspect ratio,
    // and CENTER_BOTH centers the result. On a touch screen the game size
    // already has the page's shape, so FIT fills the page with no bars.
    // Phaser transforms pointer input to match.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Two thumbs at once: one swiping to steer while the other taps a touch
  // button. Phaser tracks a single touch unless asked for more.
  input: {
    activePointers: 3,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, PauseScene, GarageScene, InstructionsScene, CreditsScene],
};

// Every scene reads the language through t(), so it has to be settled first
initLanguage(getBrowserStorage(), navigator.language);
document.documentElement.lang = getLanguage();

// Wait for the font to load before creating the game
window.addEventListener('load', () => {
  // A small delay to ensure the webfont is processed by the browser
  setTimeout(() => {
    if (fillPage) {
      const { width, height } = pageSize();
      Object.assign(config, gameSizeFor(width, height, true));
    }
    const game = new Phaser.Game(config);
    if (fillPage) watchScreen(game, pageSize);
    // Dev-server only: lets the console (and screenshot scripts) reach scenes
    if (import.meta.env.DEV) window.game = game;
  }, 100);
});
