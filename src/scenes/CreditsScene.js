import Phaser from 'phaser';
import { label, panel, dim, UI_COLORS, INK, createMenu, cityBackdrop } from '../ui/ui';
import { bindPad } from '../gamepad';
import { t } from '../i18n';
import { useStage } from '../screen';

const REPO_URL = 'https://github.com/Zednicek-Adam/Getaway';
// Shown on screen in the font's capitals; GitHub paths are case-insensitive
const REPO_LABEL = 'GITHUB.COM/ZEDNICEK-ADAM/GETAWAY';

const NAME = 'ADAM ZEDNÍČEK';

// Press Start 2P does have Í and Č, but squeezes them into the same 8px cell
// as the plain capitals, so they read as lower case. accented() draws the
// bare letter and adds the mark as pixels above it instead. Each mark is a
// list of [col, row] font pixels; row 0 is the top of a capital, so negative
// rows sit above it, leaving row -1 as a gap.
const MARKS = {
    '́': [[4, -3], [5, -3], [3, -2], [4, -2]], // acute
    '̌': [[1, -3], [2, -3], [4, -3], [5, -3], [2, -2], [3, -2], [4, -2]], // caron
};

// Static credits page reached from the main menu. Headings come from i18n.js;
// names and product names are the same in every language, so they live here.
export class CreditsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CreditsScene' });
    }

    create() {
        const { width } = useStage(this, undefined, { anchor: 'bottom' });
        const centre = width / 2;

        cityBackdrop(this);
        dim(this, 0.55);
        panel(this, 40, 104, width - 80, 696);

        label(this, centre, 56, t('credits.title'), { size: 40, color: UI_COLORS.gold }).setOrigin(0.5);

        // --- Headliner -------------------------------------------------------
        this.accented(centre, 136, t('credits.by'), { color: UI_COLORS.dim });
        this.accented(centre, 186, NAME, { size: 32, color: UI_COLORS.gold });

        // --- The roll --------------------------------------------------------
        const blocks = this.column(centre, [
            [t('credits.design'), [NAME]],
            [t('credits.engine'), ['PHASER 3', 'PHASER.IO']],
            [t('credits.languages'), ['ENGLISH, ESPAÑOL']],
            [t('credits.thanks'), [t('credits.thanksWho')]],
            [t('credits.source'), [REPO_LABEL]],
        ]);
        this.linkify(blocks[blocks.length - 1][0]);

        // --- Small print -----------------------------------------------------
        this.accented(centre, 738, t('credits.disclaimer'), { color: UI_COLORS.dim });
        this.accented(centre, 770, `© 2026 ${NAME}`, { color: UI_COLORS.faint });

        this.createButtons(centre, 846);
    }

    // Stacks [heading, lines] blocks down the page, centred on x. Returns each
    // block's line labels so callers can dress individual lines.
    column(x, blocks) {
        let y = 246;
        return blocks.map(([heading, lines]) => {
            label(this, x, y, heading, { size: 24, color: UI_COLORS.red }).setOrigin(0.5);
            const shown = lines.map((line, j) => this.accented(x, y + 36 + j * 24, line, { color: UI_COLORS.white }));
            y += 36 + (lines.length - 1) * 24 + 58;
            return shown;
        });
    }

    // A label centred on (x, y) whose acute and caron letters are rebuilt
    // from the bare letter plus a drawn mark (see MARKS). Every other
    // character, Ñ included, is left to the font.
    accented(x, y, text, opts) {
        const size = opts.size || 16;
        let plain = '';
        const marks = [];
        for (const ch of text) {
            const [base, mark] = ch.normalize('NFD');
            if (MARKS[mark]) marks.push([plain.length, MARKS[mark]]);
            plain += MARKS[mark] ? base : ch;
        }

        const shown = label(this, x, y, plain, { ...opts, size }).setOrigin(0.5);
        if (!marks.length) return shown;

        // Where Phaser draws each glyph: inside the padding, half a stroke in,
        // one em per character (the font is monospaced), baseline at the
        // ascent. A capital is 7 font pixels tall and sits one pixel above the
        // baseline, so its top is a full em above it.
        const px = size / 8;
        const stroke = shown.style.strokeThickness;
        const left = shown.x - shown.displayWidth / 2 + shown.padding.left + stroke / 2;
        const top = shown.y - shown.displayHeight / 2 + shown.padding.top + stroke / 2
            + shown.getTextMetrics().ascent - size;

        // Same three layers as the label: drop shadow, ink outline, fill
        const ink = Phaser.Display.Color.HexStringToColor(INK).color;
        const layers = [
            [ink, stroke / 2, shown.style.shadowOffsetY],
            [ink, stroke / 2, 0],
            [Phaser.Display.Color.HexStringToColor(opts.color).color, 0, 0],
        ];
        const g = this.add.graphics();
        for (const [colour, grow, drop] of layers) {
            g.fillStyle(colour);
            for (const [i, pixels] of marks) {
                for (const [col, row] of pixels) {
                    g.fillRect(left + i * size + col * px - grow, top + row * px - grow + drop,
                        px + grow * 2, px + grow * 2);
                }
            }
        }
        // Under the letters, so a mark's shadow never paints over a capital
        this.children.moveBelow(g, shown);
        return shown;
    }

    // Turns a label into a clickable link to the repo
    linkify(text) {
        text.setColor(UI_COLORS.cyan).setInteractive({ useHandCursor: true });
        text.on('pointerover', () => text.setColor(UI_COLORS.goldLight));
        text.on('pointerout', () => text.setColor(UI_COLORS.cyan));
        text.on('pointerdown', openRepo);
    }

    createButtons(x, y) {
        // Mirrors InstructionsScene: a held ENTER/SPACE repeats, and the
        // repeat can land on this scene the instant it opens. Date.now(), not
        // this.time.now — see the note in MenuScene.
        const armedAt = Date.now();
        const armed = () => Date.now() - armedAt >= 250;
        const goBack = () => {
            if (armed()) this.scene.start('MenuScene');
        };

        const menu = createMenu(this, {
            x, y, width: 440, height: 52, spacing: 64,
            items: [
                { label: t('credits.github'), action: openRepo },
                { label: t('help.back'), action: goBack },
            ],
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

// A new tab, so the game stays open on the credits page. Browsers
// only allow this from a click or key press; a gamepad press does not count as
// one, so from a pad the tab may be blocked. The address is on screen anyway.
function openRepo() {
    window.open(REPO_URL, '_blank', 'noopener');
}
