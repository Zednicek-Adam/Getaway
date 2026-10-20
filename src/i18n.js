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
        'boot.loading': 'SADDLING UP',

        'menu.subtitle': 'A WILD WEST PIXEL REMAKE',
        'menu.start': 'SADDLE UP',
        'menu.instructions': 'HOW TO PLAY',
        'menu.language': 'LANG: {name}',
        'menu.bank': 'STASH {amount}',

        'pause.title': 'HOLD YER HORSES',
        'pause.resume': 'RESUME',
        'pause.restart': 'RESTART',
        'pause.mainMenu': 'MAIN MENU',
        'pause.hintKeys': 'ESC TO RESUME',
        'pause.hintPad': 'START TO RESUME',

        'hud.bank': 'STASH',
        'hud.carry': 'LOOT',
        'hud.nitro': 'RUN',
        'hud.wanted': 'WANTED',
        'hud.next': 'NEXT',

        'toast.garageKeys': 'PRESS G FOR THE STORE',
        'toast.garagePad': 'PRESS Y FOR THE STORE',
        'toast.banked': '+{amount} STASHED',
        'toast.diamond': 'STAGECOACH ROBBED!',
        'toast.strongbox': 'STRONGBOX!',
        'toast.nitro': 'GIDDY UP!',
        'toast.life': '+1 LIFE',
        'toast.onRails': 'ALL ABOARD THE HANDCAR!',
        'toast.bullionTrain': "GOLD TRAIN COMIN' ROUND!",
        'toast.vaultOpen': 'EXPRESS CAR OPEN AT THE DEPOT',
        'toast.hitByTrain': 'RUN DOWN BY THE TRAIN',
        'toast.railPass': 'TURN AT A CROSSING TO RIDE',

        'pickup.bomb': '+1 DYNAMITE',
        'pickup.repair': 'PATCHED UP',
        'pickup.life': '+1 LIFE',
        'pickup.nitro': 'GIDDY UP!',
        'pickup.rocket': '+1 LASSO',
        'pickup.railPass': 'RAIL PASS',

        'fx.whoa': 'WHOA!',
        'fx.roped': 'ROPED!',
        'fx.yanked': 'YANKED!',
        'fx.snap': 'SNAP!',
        'fx.toot': 'TOOT TOOT!',

        'gameOver.title': 'GAME OVER',
        'gameOver.busted': 'CAUGHT BY THE POSSE!',
        'gameOver.outOfFuel': 'YOUR HORSE GAVE OUT!',
        'gameOver.hitByTrain': 'RUN DOWN BY THE TRAIN!',
        'gameOver.theEnd': 'THE END',
        'gameOver.restart': 'RESTART',
        'gameOver.hintKeys': 'PRESS ENTER',
        'gameOver.hintPad': 'PRESS A',

        'garage.title': 'GENERAL STORE',
        'garage.bank': 'STASH {amount}',
        'garage.max': 'MAX',
        'garage.hintKeys': 'ENTER BUY    ESC CLOSE',
        'garage.hintPad': 'A BUY    B CLOSE',
        'garage.engine': 'STEED',
        'garage.fuelTank': 'STAMINA',
        'garage.armor': 'GRIT',
        'garage.bombBay': 'DYNAMITE',
        'garage.rocketRack': 'LASSOS',
        'garage.railPass': 'RAIL PASS',
        'garage.passesSpawn': 'PASSES IN TOWN',
        'garage.rideTracks': 'RIDE THE RAILS',
        'garage.owned': 'OWNED',

        'help.title': 'HOW TO PLAY',
        'help.back': 'BACK',
        'help.job': 'THE JOB',
        'help.goal1': 'GRAB GOLD ALONG THE TRAILS AND STASH IT AT YOUR HIDEOUT',
        'help.goal2': 'LOOT IN YOUR SADDLEBAGS IS LOST IF THE POSSE CATCHES YOU',
        'help.goal3': '3 LIVES. LOSE ONE TO 3 TACKLES OR A WORN-OUT HORSE',
        'help.controls': 'CONTROLS',
        'help.keySteer': 'ARROWS/WASD',
        'help.keyBomb': 'SPACE / B',
        'help.steer': 'STEER',
        'help.brake': 'REIN IN/DRINK',
        'help.bomb': 'LIGHT DYNAMITE',
        'help.rocket': 'THROW LASSO',
        'help.garage': 'STORE (HIDEOUT)',
        'help.pause': 'PAUSE',
        'help.pickups': 'PICKUPS',
        'help.cash': 'GOLD COIN',
        'help.repair': 'SNAKE OIL',
        'help.nitro': 'CARROT',
        'help.rocketName': 'LASSO',
        'help.bombName': 'DYNAMITE',
        'help.life': 'STETSON',
        'help.railPass': 'RAIL PASS',
        'help.cashEffect': '+$100',
        'help.repairEffect': '+1 GRIT',
        'help.nitroEffect': '4S GALLOP',
        'help.rocketEffect': '+1 ROPE',
        'help.bombEffect': '+1 BUNDLE',
        'help.lifeEffect': '+1 LIFE',
        'help.railPassEffect': 'HANDCAR',
        'help.note1': 'YOUR HORSE FOLLOWS THE TRAIL - YOU ONLY PICK THE FORKS',
        'help.note2': 'TURNS QUEUE UP TO 2 AHEAD, SO LINE UP JUNCTIONS EARLY',
        'help.note3': 'REIN IN TO REST YOUR HORSE - A TROUGH REFILLS IT FAST',
        'help.note4': 'ROB THE STAGECOACH FOR $1000 - IT COSTS YOU 2 BADGES',
        'help.note5': 'THE POSSE WAITS AT CROSSING GATES - BEAT THE TRAIN',
        'help.note6': 'RAIL PASS (STORE UNLOCK): TURN AT A CROSSING TO RIDE',
        'help.heat': 'HEAT',
        'help.heat1': 'EVERY PICKUP RAISES YOUR WANTED BADGES',
        'help.heat2': '1-3 DEPUTIES   4 MARSHALS + BARRICADES   5 BALLOON',
    },

    es: {
        'lang.name': 'ESPAÑOL',
        'boot.loading': 'ENSILLANDO',

        'menu.subtitle': 'REMAKE DEL LEJANO OESTE',
        'menu.start': '¡A CABALLO!',
        'menu.instructions': 'COMO JUGAR',
        'menu.language': 'IDIOMA: {name}',
        'menu.bank': 'ALIJO {amount}',

        'pause.title': '¡SO, CABALLO!',
        'pause.resume': 'CONTINUAR',
        'pause.restart': 'REINICIAR',
        'pause.mainMenu': 'MENU PRINCIPAL',
        'pause.hintKeys': 'ESC PARA CONTINUAR',
        'pause.hintPad': 'START PARA CONTINUAR',

        'hud.bank': 'ALIJO',
        'hud.carry': 'BOTIN',
        'hud.nitro': 'ARRE',
        'hud.wanted': 'BUSCADO',
        'hud.next': 'LUEGO',

        'toast.garageKeys': 'PULSA G PARA IR AL ALMACEN',
        'toast.garagePad': 'PULSA Y PARA IR AL ALMACEN',
        'toast.banked': '+{amount} AL ALIJO',
        'toast.diamond': '¡DILIGENCIA ASALTADA!',
        'toast.strongbox': '¡CAJA FUERTE!',
        'toast.nitro': '¡ARRE!',
        'toast.life': '+1 VIDA',
        'toast.onRails': '¡TODOS A LA DRESINA!',
        'toast.bullionTrain': '¡AHI VIENE EL TREN DEL ORO!',
        'toast.vaultOpen': 'EL VAGON DEL ORO ESTA ABIERTO',
        'toast.hitByTrain': '¡ARROLLADO POR EL TREN!',
        'toast.railPass': 'GIRA EN UN CRUCE PARA SUBIR',

        'pickup.bomb': '+1 DINAMITA',
        'pickup.repair': 'REMENDADO',
        'pickup.life': '+1 VIDA',
        'pickup.nitro': '¡ARRE!',
        'pickup.rocket': '+1 LAZO',
        'pickup.railPass': 'PASE TREN',

        'fx.whoa': '¡SO!',
        'fx.roped': '¡ENLAZADO!',
        'fx.yanked': '¡TIRON!',
        'fx.snap': '¡CHAS!',
        'fx.toot': '¡CHU CHU!',

        'gameOver.title': '¡SE ACABO!',
        'gameOver.busted': '¡TE ATRAPO LA PATRULLA!',
        'gameOver.outOfFuel': '¡TU CABALLO NO PUDO MAS!',
        'gameOver.hitByTrain': '¡ARROLLADO POR EL TREN!',
        'gameOver.theEnd': 'FIN',
        'gameOver.restart': 'REINICIAR',
        'gameOver.hintKeys': 'PULSA ENTER',
        'gameOver.hintPad': 'PULSA A',

        'garage.title': 'EL ALMACEN',
        'garage.bank': 'ALIJO {amount}',
        'garage.max': 'MAX',
        'garage.hintKeys': 'ENTER COMPRAR    ESC CERRAR',
        'garage.hintPad': 'A COMPRAR    B CERRAR',
        'garage.engine': 'CORCEL',
        'garage.fuelTank': 'AGUANTE',
        'garage.armor': 'CORAJE',
        'garage.bombBay': 'DINAMITA',
        'garage.rocketRack': 'LAZOS',
        'garage.railPass': 'PASE TREN',
        'garage.passesSpawn': 'YA HAY PASES',
        'garage.rideTracks': 'RECORRE LA VIA',
        'garage.owned': 'TUYO',

        'help.title': 'COMO JUGAR',
        'help.back': 'VOLVER',
        'help.job': 'EL GOLPE',
        'help.goal1': 'RECOGE ORO POR LOS CAMINOS Y GUARDALO EN TU GUARIDA',
        'help.goal2': 'SI LA PATRULLA TE ATRAPA, PIERDES LO DE TUS ALFORJAS',
        'help.goal3': '3 VIDAS. PIERDES UNA CON 3 GOLPES O SI TU CABALLO CAE',
        'help.controls': 'CONTROLES',
        'help.keySteer': 'FLECHAS/WASD',
        'help.keyBomb': 'ESPACIO / B',
        'help.steer': 'GIRAR',
        'help.brake': 'PARAR/BEBER',
        'help.bomb': 'ENCENDER DINAMITA',
        'help.rocket': 'LANZAR LAZO',
        'help.garage': 'ALMACEN (GUARIDA)',
        'help.pause': 'PAUSA',
        'help.pickups': 'OBJETOS',
        'help.cash': 'MONEDA',
        'help.repair': 'ELIXIR',
        'help.nitro': 'ZANAHORIA',
        'help.rocketName': 'LAZO',
        'help.bombName': 'DINAMITA',
        'help.life': 'SOMBRERO',
        'help.railPass': 'PASE TREN',
        'help.cashEffect': '+$100',
        'help.repairEffect': '+1 CORAJE',
        'help.nitroEffect': 'GALOPE 4S',
        'help.rocketEffect': '+1 CUERDA',
        'help.bombEffect': '+1 CARGA',
        'help.lifeEffect': '+1 VIDA',
        'help.railPassEffect': 'DRESINA',
        'help.note1': 'TU CABALLO SIGUE EL CAMINO - TU ELIGES EN CADA CRUCE',
        'help.note2': 'PUEDES ENCADENAR 2 GIROS: PREPARA LOS CRUCES ANTES',
        'help.note3': 'PARA Y TU CABALLO DESCANSA - UN ABREVADERO LO RECUPERA YA',
        'help.note4': 'ASALTA LA DILIGENCIA: +$1000, PERO +2 PLACAS',
        'help.note5': 'LA PATRULLA ESPERA EN LAS BARRERAS - GANALE AL TREN',
        'help.note6': 'PASE TREN (ALMACEN): GIRA EN UN CRUCE PARA SUBIR',
        'help.heat': 'NIVEL DE BUSQUEDA',
        'help.heat1': 'CADA OBJETO RECOGIDO SUBE TUS PLACAS',
        'help.heat2': '1-3 AYUDANTES   4 ALGUACILES + BARRICADAS   5 GLOBO',
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
