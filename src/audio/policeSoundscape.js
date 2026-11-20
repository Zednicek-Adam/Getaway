// The police you can hear: a siren on every unit whose light bar is on, and
// the helicopter's rotor while it's up. GameScene calls update() every frame
// with where everything is; each loop's level and pan follow its unit, so you
// hear a patrol closing in before it's on screen.
import { createLoop, effectsOn } from './sound';
import { PATROL_SIREN, SWAT_SIREN, HEARING, spatialMix } from './loopRecipes';

export class PoliceSoundscape {
    constructor() {
        this.sirens = new Map(); // unit -> loop handle
        this.rotor = null;
    }

    // units: PoliceCar / SwatVan list; helicopter: Helicopter or null;
    // x, y: the player, in px
    update({ units, helicopter, x, y }) {
        if (!effectsOn()) {
            this.stopAll();
            return;
        }

        const live = new Set();
        for (const unit of units) {
            if (!unit.sirenOn) continue;
            live.add(unit);
            let loop = this.sirens.get(unit);
            if (!loop) {
                loop = this.sirenFor(unit);
                if (!loop) continue;
                this.sirens.set(unit, loop);
            }
            const { level, pan } = spatialMix(unit.visual.x - x, unit.visual.y - y, HEARING.siren);
            loop.set(level, pan);
        }
        // Destroyed, despawned, or the chase is over
        for (const [unit, loop] of this.sirens) {
            if (live.has(unit)) continue;
            loop.stop();
            this.sirens.delete(unit);
        }

        if (helicopter) {
            if (!this.rotor) this.rotor = createLoop('rotor');
            if (this.rotor) {
                const { level, pan } = spatialMix(helicopter.x - x, helicopter.y - y, HEARING.rotor);
                this.rotor.set(level, pan);
            }
        } else if (this.rotor) {
            this.rotor.stop();
            this.rotor = null;
        }
    }

    // Every patrol car wails and every SWAT van yelps. A slight random nudge
    // to pitch and sweep speed (a couple of percent) keeps two of the same
    // siren from locking in step and sounding like one loud siren.
    sirenFor(unit) {
        const name = unit.unitType === 'swat' ? SWAT_SIREN : PATROL_SIREN;
        return createLoop(name, { detune: 0.98 + Math.random() * 0.04, pace: 0.95 + Math.random() * 0.1 });
    }

    stopAll() {
        for (const loop of this.sirens.values()) loop.stop();
        this.sirens.clear();
        if (this.rotor) this.rotor.stop();
        this.rotor = null;
    }
}
