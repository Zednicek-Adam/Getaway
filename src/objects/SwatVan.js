import { CONFIG } from '../config';
import { PoliceCar } from './PoliceCar';

// The marshals' prison wagon: slower, and survives one hit (hp 2). Reuses
// PoliceCar's chase AI; wagon_marshal.png has the same gait-row layout as
// the deputies' sheet, its team of two galloping in step.
export class SwatVan extends PoliceCar {
    constructor(scene, gridX, gridY, mapManager, target, manager) {
        super(scene, gridX, gridY, mapManager, target, manager, { textureKey: 'marshalWagon' });
        this.unitType = 'swat';
        this.hp = CONFIG.SWAT.HP;
        this.ramDamage = CONFIG.SWAT.RAM_DAMAGE;
        this.moveConfig.duration = CONFIG.SWAT.MOVE_DURATION;
    }
}
