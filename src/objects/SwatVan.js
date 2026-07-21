import { TILE_SIZE } from '../constants';
import { CONFIG } from '../config';
import { PoliceCar } from './PoliceCar';

// Heavier police unit: bigger, darker, slower, and survives one hit (hp 2).
// Reuses PoliceCar's chase AI + siren frames; the tint persists over frame
// swaps since nothing in PoliceCar clears it.
export class SwatVan extends PoliceCar {
    constructor(scene, gridX, gridY, mapManager, target, manager) {
        super(scene, gridX, gridY, mapManager, target, manager, { displaySize: TILE_SIZE * 0.8 });
        this.unitType = 'swat';
        this.hp = CONFIG.SWAT.HP;
        this.ramDamage = CONFIG.SWAT.RAM_DAMAGE;
        this.moveConfig.duration = CONFIG.SWAT.MOVE_DURATION;
        this.visual.setTint(0x223344); // dark navy over the police sheet
    }
}
