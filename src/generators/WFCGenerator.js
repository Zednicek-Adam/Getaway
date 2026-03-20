import { TILE_TYPES } from '../constants';

export class WFCGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        // Definition of all possible tiles and their adjacency sockets [Top, Right, Bottom, Left]
        this.WFC_MODULES = [
            { sockets: ['G', 'G', 'G', 'G'], weight: 400 }, // 0: GRASS - Hodně velká váha pro otevřené prostory
            { sockets: ['G', 'R', 'G', 'R'], weight: 25 },  // Horizontal - Preferujeme dlouhé rovinky
            { sockets: ['R', 'G', 'R', 'G'], weight: 25 },  // Vertical - Preferujeme dlouhé rovinky
            { sockets: ['R', 'R', 'R', 'R'], weight: 1 },   // All 4 ways - Velmi malá šance na křižovatku
            { sockets: ['G', 'R', 'R', 'G'], weight: 5 },  // Turn B-R
            { sockets: ['G', 'G', 'R', 'R'], weight: 5 },  // Turn B-L
            { sockets: ['R', 'R', 'G', 'G'], weight: 5 },  // Turn T-R
            { sockets: ['R', 'G', 'G', 'R'], weight: 5 },  // Turn T-L
            { sockets: ['G', 'R', 'R', 'R'], weight: 3 },   // T-junction B-R-L
            { sockets: ['R', 'R', 'G', 'R'], weight: 3 },   // T-junction T-R-L
            { sockets: ['R', 'G', 'R', 'R'], weight: 3 },   // T-junction T-B-L
            { sockets: ['R', 'R', 'R', 'G'], weight: 3 },   // T-junction T-B-R
            { sockets: ['R', 'G', 'G', 'G'], weight: 1 },   // Top dead-end
            { sockets: ['G', 'R', 'G', 'G'], weight: 1 },   // Right dead-end
            { sockets: ['G', 'G', 'R', 'G'], weight: 1 },   // Bottom dead-end
            { sockets: ['G', 'G', 'G', 'R'], weight: 1 }    // Left dead-end
        ];

        this.numModules = this.WFC_MODULES.length;
        this.validNeighbors = [[], [], [], []];

        // Precompute valid neighbors only once
        for (let d = 0; d < 4; d++) {
            this.validNeighbors[d] = new Uint16Array(this.numModules);
            const opposite = (d + 2) % 4;
            for (let m1 = 0; m1 < this.numModules; m1++) {
                let mask = 0;
                for (let m2 = 0; m2 < this.numModules; m2++) {
                    if (this.WFC_MODULES[m1].sockets[d] === this.WFC_MODULES[m2].sockets[opposite]) {
                        mask |= (1 << m2);
                    }
                }
                this.validNeighbors[d][m1] = mask;
            }
        }
    }

    generate(spawnPoint) {
        const { width, height, numModules, WFC_MODULES, validNeighbors } = this;
        const domains = new Uint16Array(width * height);
        const FULL_MASK = (1 << numModules) - 1;

        let stack = [];
        let inQueue = new Uint8Array(width * height);

        const pushToStack = (idx) => {
            if (!inQueue[idx]) {
                stack.push(idx);
                inQueue[idx] = 1;
            }
        };

        for (let i = 0; i < domains.length; i++) domains[i] = FULL_MASK;

        // Apply constraints
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (x <= 2 || x >= width - 3 || y <= 2 || y >= height - 3) {
                    if (x === spawnPoint.x && y === spawnPoint.y) {
                        continue;
                    }
                    const idx = y * width + x;
                    domains[idx] = (1 << 0); // GRASS
                    pushToStack(idx);
                }
            }
        }

        const sx = spawnPoint.x;
        const sy = spawnPoint.y;
        const sIdx = sy * width + sx;
        const sIdxB = (sy + 1) * width + sx;
        domains[sIdx] = (1 << 14); // DEADEND_BOTTOM (Index 14)
        domains[sIdxB] = (1 << 9); // T turn top left right (Index 11)
        pushToStack(sIdx);
        pushToStack(sIdxB);

        const dx = [0, 1, 0, -1];
        const dy = [-1, 0, 1, 0];

        const propagate = () => {
            while (stack.length > 0) {
                const idx = stack.shift();
                inQueue[idx] = 0;

                const cx = idx % width;
                const cy = Math.floor(idx / width);
                const currentDomain = domains[idx];

                for (let d = 0; d < 4; d++) {
                    const nx = cx + dx[d];
                    const ny = cy + dy[d];
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

                    const nIdx = ny * width + nx;
                    const neighborDomain = domains[nIdx];

                    let allowedMask = 0;
                    for (let m = 0; m < numModules; m++) {
                        if (currentDomain & (1 << m)) {
                            allowedMask |= validNeighbors[d][m];
                        }
                    }

                    const newDomain = neighborDomain & allowedMask;
                    if (newDomain !== neighborDomain) {
                        domains[nIdx] = newDomain;
                        pushToStack(nIdx);
                    }
                }
            }
        };

        propagate();

        while (true) {
            let minEntropy = 9999;
            let minIdx = -1;

            for (let i = 0; i < domains.length; i++) {
                const dom = domains[i];
                let count = 0;
                for (let m = 0; m < numModules; m++) if (dom & (1 << m)) count++;

                if (count > 1) {
                    const noise = Math.random() * 0.1;
                    const entropy = count + noise;
                    if (entropy < minEntropy) {
                        minEntropy = entropy;
                        minIdx = i;
                    }
                }
            }

            if (minIdx === -1) break;

            const dom = domains[minIdx];
            let possible = [];
            for (let m = 0; m < numModules; m++) {
                if (dom & (1 << m)) possible.push(m);
            }

            let totalWeight = 0;
            for (let m of possible) totalWeight += WFC_MODULES[m].weight;

            let r = Math.random() * totalWeight;
            let chosen = possible[possible.length - 1];
            for (let m of possible) {
                r -= WFC_MODULES[m].weight;
                if (r <= 0) {
                    chosen = m;
                    break;
                }
            }

            domains[minIdx] = (1 << chosen);
            pushToStack(minIdx);
            propagate();
        }

        // Apply generated map to grid array structure
        const resultGrid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                const dom = domains[y * width + x];
                let chosen = 0;
                for (let m = 0; m < numModules; m++) {
                    if (dom & (1 << m)) {
                        chosen = m;
                        break;
                    }
                }
                row.push(chosen === 0 ? TILE_TYPES.GRASS : TILE_TYPES.ROAD_GENERIC);
            }
            resultGrid.push(row);
        }

        return resultGrid;
    }
}
