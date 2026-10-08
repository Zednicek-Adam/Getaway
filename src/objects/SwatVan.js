import { CONFIG } from '../config';
import { PoliceCar } from './PoliceCar';

// Heavier police unit: armoured van, slower, and survives one hit (hp 2).
// Reuses PoliceCar's chase AI and light-bar logic — van_swat.png has the same
// off / red / blue row layout as the patrol car sheet.
export class SwatVan extends PoliceCar {
    constructor(scene, gridX, gridY, mapManager, target, manager) {
        super(scene, gridX, gridY, mapManager, target, manager, { textureKey: 'swatVan' });
        this.unitType = 'swat';
        this.hp = CONFIG.SWAT.HP;
        this.ramDamage = CONFIG.SWAT.RAM_DAMAGE;
        this.moveConfig.duration = CONFIG.SWAT.MOVE_DURATION;
        this.glow.setScale(3); // bigger bar, bigger wash
    }
}
