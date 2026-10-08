// UI text in every supported language, plus the current-language switch.
// Pure and Phaser-free; storage is injected (same shape as storage.js) so this
// is unit-testable.
//
// Every string must stay inside Latin-1 (U+0020..U+00FF): Press Start 2P has
// no em dashes, curly quotes or arrows, which would render as blank boxes. Its
// accented capitals (Á É Í Ó Ú) are squashed into the 8px cell and read as
// lower case, so Spanish drops the acute accent on capitals, as arcade-era
// Spanish text did. Ñ, ¡ and ¿ render fine and stay. test/i18n.test.js
// enforces both rules.
//
// Strings are laid out against fixed pixel positions (16px per character at
// size 16, 24px at size 24), so a translation has to fit the same space as the
// English it replaces.

export const LANG_KEY = 'getaway-lang';
export const LANGUAGES = ['en', 'es'];
const DEFAULT_LANGUAGE = 'en';

export const STRINGS = {
    en: {
        'lang.name': 'ENGLISH',
        'boot.loading': 'LOADING',

        'menu.subtitle': 'PIXEL REMAKE',
        'menu.start': 'START',
        'menu.instructions': 'INSTRUCTIONS',
        'menu.language': 'LANG: {name}',
        'menu.bank': 'BANK {amount}',

        'pause.title': 'PAUSED',
        'pause.resume': 'RESUME',
        'pause.restart': 'RESTART',
        'pause.mainMenu': 'MAIN MENU',
        'pause.hintKeys': 'ESC TO RESUME',
        'pause.hintPad': 'START TO RESUME',

        'hud.bank': 'BANK',
        'hud.carry': 'CARRY',
        'hud.nitro': 'NOS',
        'hud.wanted': 'WANTED',
        'hud.next': 'NEXT',

        'toast.garageKeys': 'PRESS G FOR GARAGE',
        'toast.garagePad': 'PRESS Y FOR GARAGE',
        'toast.banked': '+{amount} BANKED',
        'toast.diamond': 'DIAMOND! +{amount}',
        'toast.nitro': 'NITRO!',
        'toast.life': '+1 LIFE',

        'pickup.bomb': '+1 BOMB',
        'pickup.repair': 'REPAIRED',
        'pickup.life': '+1 LIFE',
        'pickup.nitro': 'NITRO!',
        'pickup.rocket': '+1 ROCKET',

        'gameOver.title': 'GAME OVER',
        'gameOver.busted': 'BUSTED!',
        'gameOver.outOfFuel': 'OUT OF FUEL!',
        'gameOver.restart': 'RESTART',
        'gameOver.hintKeys': 'PRESS ENTER',
        'gameOver.hintPad': 'PRESS A',

        'garage.title': 'GARAGE',
        'garage.bank': 'BANK {amount}',
        'garage.max': 'MAX',
        'garage.hintKeys': 'ENTER BUY    ESC CLOSE',
        'garage.hintPad': 'A BUY    B CLOSE',
        'garage.engine': 'ENGINE',
        'garage.fuelTank': 'FUEL TANK',
        'garage.armor': 'ARMOR',
        'garage.bombBay': 'BOMB BAY',
        'garage.rocketRack': 'ROCKETS',

        'help.title': 'HOW TO PLAY',
        'help.back': 'BACK',
        'help.job': 'THE JOB',
        'help.goal1': 'GRAB CASH OFF THE STREETS AND BANK IT AT THE SAFEHOUSE',
        'help.goal2': 'CARRIED CASH IS LOST IF THE COPS BUST YOU - BANK IT OFTEN',
        'help.goal3': '3 LIVES. YOU LOSE ONE TO 3 RAMS OR AN EMPTY TANK',
        'help.controls': 'CONTROLS',
        'help.keySteer': 'ARROWS/WASD',
        'help.keyBomb': 'SPACE / B',
        'help.steer': 'STEER',
        'help.brake': 'BRAKE/REFUEL',
        'help.bomb': 'DROP BOMB',
        'help.rocket': 'FIRE ROCKET',
        'help.garage': 'GARAGE (BASE)',
        'help.pause': 'PAUSE',
        'help.pickups': 'PICKUPS',
        'help.cash': 'CASH',
        'help.repair': 'REPAIR',
        'help.nitro': 'NITRO',
        'help.rocketName': 'ROCKET',
        'help.bombName': 'BOMB',
        'help.life': 'LIFE',
        'help.cashEffect': '+$100',
        'help.repairEffect': '-1 DMG',
        'help.nitroEffect': '4S BOOST',
        'help.ammoEffect': '+1 AMMO',
        'help.lifeEffect': '+1 LIFE',
        'help.note1': 'YOUR CAR DRIVES ITSELF - YOU ONLY CHOOSE THE TURNS',
        'help.note2': 'TURNS QUEUE UP TO 3 AHEAD, SO LINE UP JUNCTIONS EARLY',
        'help.note3': 'RAM THE DIAMOND CAR FOR $1000 - IT COSTS YOU 2 STARS',
        'help.heat': 'HEAT',
        'help.heat1': 'EVERY PICKUP RAISES YOUR WANTED STARS',
        'help.heat2': '1-3 PATROLS   4 SWAT + ROADBLOCKS   5 HELICOPTER',
    },

    es: {
        'lang.name': 'ESPAÑOL',
        'boot.loading': 'CARGANDO',

        'menu.subtitle': 'REMAKE EN PIXELES',
        'menu.start': 'JUGAR',
        'menu.instructions': 'INSTRUCCIONES',
        'menu.language': 'IDIOMA: {name}',
        'menu.bank': 'BANCO {amount}',

        'pause.title': 'PAUSA',
        'pause.resume': 'CONTINUAR',
        'pause.restart': 'REINICIAR',
        'pause.mainMenu': 'MENU PRINCIPAL',
        'pause.hintKeys': 'ESC PARA CONTINUAR',
        'pause.hintPad': 'START PARA CONTINUAR',

        'hud.bank': 'BANCO',
        'hud.carry': 'BOTIN',
        'hud.nitro': 'NOS',
        'hud.wanted': 'BUSCADO',
        'hud.next': 'LUEGO',

        'toast.garageKeys': 'PULSA G PARA IR AL TALLER',
        'toast.garagePad': 'PULSA Y PARA IR AL TALLER',
        'toast.banked': '+{amount} AL BANCO',
        'toast.diamond': '¡DIAMANTE! +{amount}',
        'toast.nitro': '¡NITRO!',
        'toast.life': '+1 VIDA',

        'pickup.bomb': '+1 BOMBA',
        'pickup.repair': 'REPARADO',
        'pickup.life': '+1 VIDA',
        'pickup.nitro': '¡NITRO!',
        'pickup.rocket': '+1 COHETE',

        'gameOver.title': 'FIN DEL JUEGO',
        'gameOver.busted': '¡ATRAPADO!',
        'gameOver.outOfFuel': '¡SIN GASOLINA!',
        'gameOver.restart': 'REINICIAR',
        'gameOver.hintKeys': 'PULSA ENTER',
        'gameOver.hintPad': 'PULSA A',

        'garage.title': 'TALLER',
        'garage.bank': 'BANCO {amount}',
        'garage.max': 'MAX',
        'garage.hintKeys': 'ENTER COMPRAR    ESC CERRAR',
        'garage.hintPad': 'A COMPRAR    B CERRAR',
        'garage.engine': 'MOTOR',
        'garage.fuelTank': 'DEPOSITO',
        'garage.armor': 'BLINDAJE',
        'garage.bombBay': 'BOMBAS',
        'garage.rocketRack': 'COHETES',

        'help.title': 'COMO JUGAR',
        'help.back': 'VOLVER',
        'help.job': 'EL GOLPE',
        'help.goal1': 'RECOGE DINERO EN LAS CALLES Y GUARDALO EN EL ESCONDITE',
        'help.goal2': 'SI LA POLICIA TE ATRAPA, PIERDES LO QUE LLEVAS - GUARDALO',
        'help.goal3': '3 VIDAS. PIERDES UNA CON 3 CHOQUES O SIN GASOLINA',
        'help.controls': 'CONTROLES',
        'help.keySteer': 'FLECHAS/WASD',
        'help.keyBomb': 'ESPACIO / B',
        'help.steer': 'GIRAR',
        'help.brake': 'FRENAR/REPOSTAR',
        'help.bomb': 'SOLTAR BOMBA',
        'help.rocket': 'LANZAR COHETE',
        'help.garage': 'TALLER (BASE)',
        'help.pause': 'PAUSA',
        'help.pickups': 'OBJETOS',
        'help.cash': 'DINERO',
        'help.repair': 'REPARAR',
        'help.nitro': 'NITRO',
        'help.rocketName': 'COHETE',
        'help.bombName': 'BOMBA',
        'help.life': 'VIDA',
        'help.cashEffect': '+$100',
        'help.repairEffect': '-1 DAÑO',
        'help.nitroEffect': 'TURBO 4S',
        'help.ammoEffect': '+1 MUNICION',
        'help.lifeEffect': '+1 VIDA',
        'help.note1': 'TU COCHE AVANZA SOLO - TU SOLO ELIGES LOS GIROS',
        'help.note2': 'PUEDES ENCADENAR 3 GIROS: PREPARA LOS CRUCES ANTES',
        'help.note3': 'CHOCA CON EL COCHE DIAMANTE: +$1000, PERO +2 ESTRELLAS',
        'help.heat': 'NIVEL DE BUSQUEDA',
        'help.heat1': 'CADA OBJETO RECOGIDO SUBE TUS ESTRELLAS',
        'help.heat2': '1-3 PATRULLAS   4 SWAT + BARRICADAS   5 HELICOPTERO',
    },
};

let current = DEFAULT_LANGUAGE;

export function getLanguage() {
    return current;
}

// Look up `key` in the current language, falling back to English, then to the
// key itself so a missing string shows up on screen instead of crashing.
// `{name}` placeholders are filled from `params`.
export function t(key, params) {
    const text = STRINGS[current][key] ?? STRINGS[DEFAULT_LANGUAGE][key] ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

// Pick the starting language: a saved choice wins, then the browser's own
// language ("es-MX" -> "es"), then English.
export function initLanguage(storage, browserLanguage) {
    let saved = null;
    try {
        saved = storage.getItem(LANG_KEY);
    } catch {
        // unreadable storage — fall through to the browser language
    }
    const browser = String(browserLanguage || '').toLowerCase().split('-')[0];
    current = [saved, browser].find((lang) => LANGUAGES.includes(lang)) || DEFAULT_LANGUAGE;
    return current;
}

// Switch language and remember the choice. Unknown codes are ignored.
export function setLanguage(storage, lang) {
    if (!LANGUAGES.includes(lang)) return current;
    current = lang;
    try {
        storage.setItem(LANG_KEY, lang);
    } catch {
        // quota exceeded / private mode — persistence best-effort, swallow
    }
    return current;
}

// The language after the current one, wrapping round (drives the menu toggle)
export function nextLanguage() {
    return LANGUAGES[(LANGUAGES.indexOf(current) + 1) % LANGUAGES.length];
}
