import Phaser from 'phaser';
import { loadSave, getBrowserStorage } from '../storage';
import { TOP_RUNS, formatDuration } from '../bests';
import { label, panel, dim, money, UI_COLORS, createMenu, cityBackdrop } from '../ui/ui';
import { bindPad } from '../gamepad';
import { t } from '../i18n';
import { useStage } from '../screen';

// The table's columns after the place number: which run stat each shows, its
// heading, and how to print it. Biggest deposit is left out: it never beats
// the banked total beside it, and the Spanish headings need the room.
const COLUMNS = [
    { key: 'banked', heading: 'runs.banked', format: money },
    { key: 'longestChase', heading: 'runs.chase', format: formatDuration },
    { key: 'timeAtFiveStars', heading: 'runs.fiveStars', format: formatDuration },
    { key: 'policeDestroyed', heading: 'runs.police', format: String },
    { key: 'diamondsStolen', heading: 'runs.diamonds', format: String },
    { key: 'timeSurvived', heading: 'runs.time', format: formatDuration },
];

const TABLE_LEFT = 96;
const TABLE_RIGHT = 1184;
const HEADER_Y = 244;
const ROW_Y = 316;
const ROW_H = 80;

// The five best runs, ranked by money banked, reached from the main menu.
// Read-only: GameScene.recordRunBests fills the list when a run ends.
export class BestRunsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BestRunsScene' });
    }

    // `selected` is the main-menu button that opened this page, handed back
    // so the cursor is still on it after BACK
    init(data) {
        this.menuSelection = (data && data.selected) || 0;
    }

    create() {
        const { width } = useStage(this, () => ({ selected: this.menuSelection }), { anchor: 'bottom' });
        const centre = width / 2;

        cityBackdrop(this);
        dim(this, 0.55);
        panel(this, 40, 104, width - 80, 696);

        label(this, centre, 56, t('runs.title'), { size: 40, color: UI_COLORS.gold }).setOrigin(0.5);
        label(this, centre, 150, t('runs.ranking'), { color: UI_COLORS.dim }).setOrigin(0.5);

        const runs = loadSave(getBrowserStorage()).topRuns;
        this.drawTable(runs);
        if (runs.length === 0) {
            label(this, centre, 712, t('runs.empty'), { size: 24, color: UI_COLORS.white }).setOrigin(0.5);
            label(this, centre, 756, t('runs.emptyHint'), { color: UI_COLORS.dim }).setOrigin(0.5);
        }

        this.createButtons(centre, 872);
    }

    // Headings, then one row per place. Places nobody has reached yet show
    // dashes, so the table keeps its shape from the first run. Each column is
    // as wide as its widest text and the spare width is shared out between
    // them, so the layout holds in either language.
    drawTable(runs) {
        const rows = [];
        for (let i = 0; i < TOP_RUNS; i++) {
            const run = runs[i];
            rows.push(COLUMNS.map(({ key, format }) => (run ? format(run[key]) : '-')));
        }

        // Every cell built right-aligned at x 0; laid out once all are measured
        const headings = COLUMNS.map(({ heading }) =>
            label(this, 0, HEADER_Y, t(heading), { color: UI_COLORS.dim }).setOrigin(1, 0));
        const cells = rows.map((row, i) => {
            const y = ROW_Y + i * ROW_H;
            const run = runs[i];
            const colour = !run ? UI_COLORS.faint : i === 0 ? UI_COLORS.gold : UI_COLORS.white;
            label(this, TABLE_LEFT, y, String(i + 1), { size: 24, color: run ? UI_COLORS.red : UI_COLORS.faint })
                .setOrigin(0, 0.25);
            return row.map((text) => label(this, 0, y, text, { color: colour }).setOrigin(1, 0));
        });

        const placeW = 48;
        const widths = COLUMNS.map((_, c) =>
            Math.max(headings[c].width, ...cells.map((row) => row[c].width)));
        const spare = TABLE_RIGHT - TABLE_LEFT - placeW - widths.reduce((a, b) => a + b, 0);
        const gap = Math.max(16, Math.floor(spare / COLUMNS.length));
        let x = TABLE_LEFT + placeW;
        widths.forEach((w, c) => {
            x += gap + w;
            headings[c].setX(x);
            cells.forEach((row) => row[c].setX(x));
        });

        // Rules under the headings and between the rows
        const ruleW = TABLE_RIGHT - TABLE_LEFT;
        this.add.rectangle(TABLE_LEFT, HEADER_Y + 36, ruleW, 2, 0x8a90a6, 0.6).setOrigin(0);
        for (let i = 1; i < TOP_RUNS; i++) {
            this.add.rectangle(TABLE_LEFT, ROW_Y + i * ROW_H - ROW_H / 2 + 12, ruleW, 2, 0x4a5068, 0.5).setOrigin(0);
        }
    }

    createButtons(x, y) {
        // Same key-repeat guard as the other menu pages: a held ENTER can land
        // on this scene the instant it opens. Date.now(), not this.time.now;
        // see the note in MenuScene.
        const armedAt = Date.now();
        const armed = () => Date.now() - armedAt >= 250;
        const goBack = () => {
            if (armed()) this.scene.start('MenuScene', { selected: this.menuSelection });
        };

        const menu = createMenu(this, {
            x, y, width: 440, height: 52,
            items: [{ label: t('help.back'), action: goBack }],
        });

        const activate = () => {
            if (armed()) menu.activate();
        };
        this.input.keyboard.on('keydown-ESC', goBack);
        this.input.keyboard.on('keydown-ENTER', activate);
        this.input.keyboard.on('keydown-SPACE', activate);
        bindPad(this, { a: activate, b: goBack, start: activate });
    }
}
