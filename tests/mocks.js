export class MockText {
    constructor(text) {
        this.text = text;
        this.color = '';
        this.depth = 0;
        this.scrollFactor = 0;
    }
    setText(t) { this.text = t; return this; }
    setColor(c) { this.color = c; return this; }
    setDepth(d) { this.depth = d; return this; }
    setScrollFactor(s) { this.scrollFactor = s; return this; }
    setOrigin(o) { return this; }
    on(event, callback) { return this; }
    setInteractive(options) { return this; }
}

export class MockRectangle {
    constructor() {
        this.origin = 0;
        this.depth = 0;
        this.scrollFactor = 0;
        this.strokeWidth = 0;
        this.strokeColor = 0;
    }
    setOrigin(o) { this.origin = o; return this; }
    setDepth(d) { this.depth = d; return this; }
    setScrollFactor(s) { this.scrollFactor = s; return this; }
    setStrokeStyle(w, c) { this.strokeWidth = w; this.strokeColor = c; return this; }
}

export class MockScene {
    constructor() {
        this.add = {
            rectangle: () => new MockRectangle(),
            text: (x, y, text) => new MockText(text)
        };
        this.scale = {
            width: 800,
            height: 600
        };
        this.tweens = {
            add: () => {}
        };
    }
}
