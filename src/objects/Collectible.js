import { TILE_SIZE, COLORS } from '../constants';

export const COLLECTIBLE_TYPES = {
    MONEY: 'money',
    FUEL: 'fuel',
    BOMB: 'bomb',
    DIAMOND: 'diamond'
};

export class Collectible {
    constructor(scene, type, gridX, gridY) {
        this.scene = scene;
        this.type = type;
        this.gridX = gridX;
        this.gridY = gridY;

        this.visual = this.scene.add.graphics();
        this.render();

        // Position visual
        this.visual.x = gridX * TILE_SIZE + TILE_SIZE / 2;
        this.visual.y = gridY * TILE_SIZE + TILE_SIZE / 2;

        // Add simple tween for "juice"
        this.scene.tweens.add({
            targets: this.visual,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }

    render() {
        this.visual.clear();

        if (this.type === COLLECTIBLE_TYPES.MONEY) {
            // True Pixel Art Money Bag
            const scale = 2; // Size of each "pixel"
            const colors = {
                '0': 0x000000, // Black outline
                '1': 0xF5DEB3, // Canvas/Wheat main color
                '2': 0xD2B48C, // Tan shade for depth
                '3': 0x8B4513, // Saddle Brown tie
                '4': 0x228B22  // Forest Green dollar sign
            };
            const grid = [
                "   00000   ",
                "  0111110  ",
                " 011111110 ",
                " 011111110 ",
                "  0033300  ",
                "  0111110  ",
                " 011111110 ",
                "01110401110",
                "01104440110",
                "01110401110",
                "01104440110",
                "01110401110",
                "01111111110",
                " 022222220 ",
                "  0000000  "
            ];
            this.drawPixelArt(grid, colors, scale);

        } else if (this.type === COLLECTIBLE_TYPES.FUEL) {
            // True Pixel Art Jerrycan
            const scale = 2;
            const colors = {
                '0': 0x000000, // Black outline
                '1': 0xDC143C, // Crimson Red main
                '2': 0x8B0000, // Dark Red shade
                '3': 0xAAAAAA, // Grey spout
                '4': 0x555555  // Dark Grey spout outline
            };
            const grid = [
                "   444     ",
                "   434000  ",
                "   4441110 ",
                "  00000000 ",
                " 0111111110",
                " 0111111110",
                " 0122112210",
                " 0122112210",
                " 0122112210",
                " 0122112210",
                " 0122112210",
                " 0111111110",
                " 0222222220",
                "  00000000 "
            ];
            this.drawPixelArt(grid, colors, scale);

        } else {
            // Fallback for others (e.g. BOMB, DIAMOND)
            let color = 0xFFFFFF;
            let radius = TILE_SIZE * 0.25;

            switch (this.type) {
                case COLLECTIBLE_TYPES.BOMB:
                    color = COLORS.BOMB;
                    break;
                case COLLECTIBLE_TYPES.DIAMOND:
                    color = 0x00FFFF;
                    break;
            }

            this.visual.fillStyle(color, 1);
            this.visual.fillCircle(0, 0, radius);

            // Outline
            this.visual.lineStyle(2, 0xFFFFFF, 0.8);
            this.visual.strokeCircle(0, 0, radius);
        }
    }

    drawPixelArt(grid, colors, scale) {
        const height = grid.length;
        const width = grid[0].length;

        // Offset so 0,0 is the center
        const offsetX = - (width * scale) / 2;
        const offsetY = - (height * scale) / 2;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const char = grid[y][x];
                if (char !== ' ') {
                    const color = colors[char];
                    if (color !== undefined) {
                        this.visual.fillStyle(color, 1);
                        this.visual.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
                    }
                }
            }
        }
    }

    destroy() {
        this.visual.destroy();
    }
}
