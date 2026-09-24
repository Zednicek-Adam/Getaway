"""Title-screen art: parallax night skyline, side-view chase cars, the logo."""
import math

from pixelkit import Art, hexc, shade, mix, bayer, rng_for, with_alpha

W, H = 320, 240       # art resolution; exported at 4x -> 1280x960
BASE = 196            # street level (building baseline)
OUTLINE = hexc('#0c0b16')

SKY = [(0.00, hexc('#080a1e')), (0.30, hexc('#15173c')), (0.55, hexc('#2c2156')),
       (0.72, hexc('#582966')), (0.84, hexc('#9e3c63')), (0.93, hexc('#dd654f')),
       (1.00, hexc('#f5a55a'))]


def sky():
    a = Art(W, H)
    rng = rng_for('sky')
    for y in range(H):
        f = min(1.0, y / BASE)
        for i in range(len(SKY) - 1):
            if SKY[i][0] <= f <= SKY[i + 1][0]:
                t = (f - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0])
                lo, hi = SKY[i][1], SKY[i + 1][1]
                break
        for x in range(W):
            # two-tone ordered dither between neighbouring stops
            a.put(x, y, hi if bayer(x, y) < t else lo)
    # Stars
    for _ in range(90):
        x, y = rng.randrange(W), rng.randrange(0, 120)
        b = rng.random()
        c = hexc('#ffffff') if b > 0.8 else hexc('#c8d4ff') if b > 0.4 else hexc('#7f86b8')
        a.put(x, y, c)
    for _ in range(7):
        x, y = rng.randrange(8, W - 8), rng.randrange(6, 90)
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            a.put(x + dx, y + dy, hexc('#ffffff') if (dx, dy) == (0, 0) else hexc('#9fb0ff'))
    # Moon with a stepped halo
    mx, my = 262, 40
    for y in range(H):
        for x in range(W):
            d = math.hypot(x + 0.5 - mx, y + 0.5 - my)
            if 14 < d < 24 and bayer(x, y) < (24 - d) / 10 * 0.5:
                a.put(x, y, mix(a.get(x, y), hexc('#6a6aa8'), 0.5))
    a.disc(mx, my, 13, hexc('#f4edcc'))
    a.disc(mx + 2, my + 1, 11.5, hexc('#e8dfb6'))
    a.disc(mx - 1, my - 1, 11, hexc('#f7f1d6'))
    for cx, cy, r in ((mx - 4, my - 3, 2.5), (mx + 4, my + 4, 3), (mx + 5, my - 5, 1.5), (mx - 3, my + 6, 1.5)):
        a.disc(cx, cy, r, hexc('#ddd2a6'))
        a.set(int(cx - r / 2), int(cy - r / 2), hexc('#cfc394'))
    return a


def _wrap_rect(a, x, y, w, h, c):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            a.set(xx % W, yy, c)


def skyline(seed, body, rim, lit_colours, lit_chance, hmin, hmax, wmin, wmax, detail=True, gap=(0, 3)):
    rng = rng_for('skyline', seed)
    a = Art(W, H)
    x = 0
    while x < W:
        bw = rng.randint(wmin, wmax)
        bh = rng.randint(hmin, hmax)
        top = BASE - bh
        _wrap_rect(a, x, top, bw, bh, body)
        # rim light on the moon side
        for yy in range(top, BASE):
            a.set((x + bw - 1) % W, yy, rim)
        for xx in range(x, x + bw):
            a.set(xx % W, top, rim)
        # stepped crown / setbacks
        if detail and rng.random() < 0.5 and bw > 10:
            sw = bw // 2
            sh = rng.randint(4, 12)
            _wrap_rect(a, x + (bw - sw) // 2, top - sh, sw, sh, body)
            for yy in range(top - sh, top):
                a.set((x + (bw - sw) // 2 + sw - 1) % W, yy, rim)
            top -= sh
            if rng.random() < 0.6:
                ax = x + bw // 2
                ah = rng.randint(5, 14)
                for yy in range(top - ah, top):
                    a.set(ax % W, yy, body)
                a.set(ax % W, top - ah - 1, hexc('#ff4050'))
        elif detail and rng.random() < 0.35:
            # water tower
            tx = x + rng.randint(2, max(2, bw - 7))
            _wrap_rect(a, tx, top - 7, 5, 5, body)
            _wrap_rect(a, tx + 1, top - 2, 1, 2, body)
            _wrap_rect(a, tx + 3, top - 2, 1, 2, body)
            a.set((tx + 1) % W, top - 8, body)
            a.set((tx + 2) % W, top - 9, body)
            a.set((tx + 3) % W, top - 8, body)
        # windows
        wy = BASE - bh + 4
        pattern = rng.choice(('grid', 'bands', 'sparse'))
        while wy < BASE - 5:
            wx = x + 2
            while wx < x + bw - 3:
                lit = rng.random() < (lit_chance * (1.8 if pattern == 'bands' and wy % 8 < 4 else 1))
                if pattern == 'sparse' and rng.random() < 0.6:
                    lit = False
                if lit:
                    c = rng.choice(lit_colours)
                    a.set(wx % W, wy, c)
                    a.set((wx + 1) % W, wy, c)
                    a.set(wx % W, wy + 1, shade(c, 0.8))
                    a.set((wx + 1) % W, wy + 1, shade(c, 0.8))
                wx += 4
            wy += 4
        # vertical neon sign
        if detail and rng.random() < 0.18 and bh > 60:
            col = rng.choice((hexc('#ff4fa3'), hexc('#3fe0ff'), hexc('#7dff6a')))
            sx = x + 1
            for k in range(6):
                sy = BASE - bh + 10 + k * 5
                _wrap_rect(a, sx, sy, 3, 4, shade(col, 0.35))
                _wrap_rect(a, sx + 1, sy + 1, 1, 2, col)
        x += bw + rng.randint(*gap)
    return a


def far_layer():
    return skyline('far', hexc('#231e4a'), hexc('#3a3470'), [hexc('#7a6ab8'), hexc('#9a88d8'), hexc('#ffcf6b')],
                   0.12, 60, 132, 14, 30, detail=False)


def near_layer():
    return skyline('near', hexc('#110e24'), hexc('#2b2552'), [hexc('#ffcf5a'), hexc('#ffe7a0'), hexc('#ffb347')],
                   0.3, 38, 112, 16, 34, gap=(4, 16))


def street_layer():
    a = Art(W, H)
    rng = rng_for('street')
    # sidewalk + curb
    a.rect(0, BASE, W, 7, hexc('#3b3552'))
    a.hline(0, W - 1, BASE, hexc('#5f5880'))
    for x in range(0, W, 12):
        a.vline(x, BASE + 1, BASE + 6, hexc('#332d48'))
    a.rect(0, BASE + 7, W, 3, hexc('#26213b'))
    # road
    for y in range(BASE + 10, H):
        for x in range(W):
            r = rng.random()
            a.put(x, y, hexc('#1e1c2e') if r < 0.85 else hexc('#242236') if r < 0.95 else hexc('#19172a'))
    for x in range(W):
        if x % 32 < 16:
            a.put(x, 222, hexc('#d8cf9a'))
            a.put(x, 223, hexc('#b8af7e'))
    # lamp posts with light pools
    for lx in range(24, W, 80):
        for y in range(BASE - 44, BASE + 1):
            a.put(lx, y, hexc('#2c2745'))
            a.put(lx + 1, y, hexc('#1a1630'))
        a.hline(lx, lx + 8, BASE - 44, hexc('#2c2745'))
        a.rect(lx + 6, BASE - 43, 5, 2, hexc('#2c2745'))
        a.hline(lx + 7, lx + 9, BASE - 41, hexc('#fff0b0'))
        for y in range(BASE - 40, H):
            spread = (y - (BASE - 40)) * 0.42
            for x in range(int(lx + 8 - spread), int(lx + 9 + spread) + 1):
                if 0 <= x < W:
                    a.set(x, y, (255, 226, 140, 22))
    return a


def _wheel(a, cx, cy, frame):
    a.disc(cx, cy, 4.2, hexc('#0e0d18'))
    a.disc(cx, cy, 3.6, hexc('#1a1a22'))
    a.disc(cx, cy, 2.1, hexc('#9aa1ad'))
    if frame == 0:
        a.set(int(cx), int(cy - 1.5), hexc('#e0e4ea'))
        a.set(int(cx), int(cy + 1.5), hexc('#5a606c'))
    else:
        a.set(int(cx - 1.5), int(cy), hexc('#e0e4ea'))
        a.set(int(cx + 1.5), int(cy), hexc('#5a606c'))
    a.set(int(cx), int(cy), hexc('#3a3f4a'))


def side_car(kind, frame):
    """52x20 side-view car facing right. kind: 'player' | 'police'."""
    a = Art(52, 20)
    if kind == 'player':
        body, light, dark = hexc('#d9303a'), hexc('#ff6a5c'), hexc('#8e1826')
    else:
        body, light, dark = hexc('#eef1f5'), hexc('#ffffff'), hexc('#aab2be')
    # cabin
    for i, y in enumerate(range(3, 8)):
        a.hline(19 - i, 34 + i, y, body)
    a.rect(3, 8, 46, 7, body)
    a.rect(1, 10, 50, 5, body)
    a.hline(3, 48, 8, light)
    a.hline(1, 50, 14, dark)
    # glass
    for i, y in enumerate(range(4, 8)):
        a.hline(20 - i, 33 + i, y, hexc('#3d5a86'))
    a.vline(27, 4, 7, body)
    a.set(22, 4, hexc('#8fc0ec'))
    a.set(21, 5, hexc('#8fc0ec'))
    if kind == 'player':
        a.hline(3, 49, 11, hexc('#f4f6f8'))
        a.rect(1, 6, 4, 2, hexc('#1c1e26'))     # spoiler
        a.set(0, 13, hexc('#aab1bc'))
    else:
        a.rect(1, 12, 12, 3, hexc('#2a2e38'))
        a.rect(39, 12, 12, 3, hexc('#2a2e38'))
        a.rect(1, 10, 8, 2, hexc('#2a2e38'))
        a.rect(43, 10, 8, 2, hexc('#2a2e38'))
        a.hline(13, 38, 11, hexc('#2f6fd6'))
        red_on = frame == 0
        a.hline(22, 25, 2, hexc('#ff3346') if red_on else hexc('#6e1c26'))
        a.hline(26, 29, 2, hexc('#3f86ff') if not red_on else hexc('#1c2e6e'))
        a.hline(22, 29, 1, hexc('#c9ced8'))
    a.set(50, 10, hexc('#fff6c0'))
    a.set(50, 11, hexc('#fff6c0'))
    a.set(1, 10, hexc('#ff3b3b'))
    a.outline(OUTLINE)
    for cx in (12, 40):
        _wheel(a, cx + 0.5, 15.5, frame)
    return a


FONT = {
    'G': ['.####.', '##..##', '##....', '##.###', '##..##', '##..##', '.#####'],
    'E': ['######', '##....', '##....', '#####.', '##....', '##....', '######'],
    'T': ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
    'A': ['.####.', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
    'W': ['##...##', '##...##', '##...##', '##.#.##', '#######', '###.###', '##...##'],
    'Y': ['##..##', '##..##', '##..##', '.####.', '..##..', '..##..', '..##..'],
    'H': ['##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
}


def _word_mask(word, scale, gap):
    widths = [len(FONT[ch][0]) * scale for ch in word]
    w = sum(widths) + gap * (len(word) - 1)
    h = 7 * scale
    m = [[False] * w for _ in range(h)]
    x = 0
    for ch, cw in zip(word, widths):
        for j, row in enumerate(FONT[ch]):
            for i, px in enumerate(row):
                if px == '#':
                    for yy in range(scale):
                        for xx in range(scale):
                            # slight italic: shift rows right towards the top
                            m[j * scale + yy][x + i * scale + xx] = True
        x += cw + gap
    return m, w, h


def logo():
    scale, gap = 3, 2
    m, ww, wh = _word_mask('GETAWAY', scale, gap)
    pad = 10
    italic = 5
    a = Art(ww + pad * 2 + italic + 30, wh + pad * 2 + 18)
    ox, oy = pad + 30, pad + 16
    ramp = [hexc('#fffbe0'), hexc('#ffe46a'), hexc('#ffc933'), hexc('#ffa928'), hexc('#f07a1c')]
    letters = Art(a.w, a.h)
    for y in range(wh):
        shift = int((wh - 1 - y) / wh * italic)
        for x in range(ww):
            if m[y][x]:
                f = y / (wh - 1)
                i = min(len(ramp) - 1, int(f * (len(ramp) - 1) + bayer(x, y) * 0.9))
                letters.put(ox + x + shift, oy + y, ramp[max(1, i)])
    # glossy top edges
    for y in range(letters.h):
        for x in range(letters.w):
            if letters.filled(x, y) and not letters.filled(x, y - 1):
                letters.put(x, y, ramp[0])
    # a horizontal shine band
    for x in range(letters.w):
        y = oy + wh // 2 - 1
        if letters.filled(x, y):
            letters.put(x, y, mix(letters.get(x, y), hexc('#ffffff'), 0.35))
    body = letters.copy()
    body.outline(hexc('#8a1424'), diagonal=True)
    body.outline(hexc('#5a0c18'), diagonal=False)
    # extrusion
    ext = Art(a.w, a.h)
    for d in range(1, 5):
        for y in range(body.h):
            for x in range(body.w):
                if body.filled(x, y):
                    ext.put(x + d, y + d, hexc('#3a0a14') if d < 4 else hexc('#24060d'))
    a.blit(ext, 0, 0)
    a.blit(body, 0, 0)
    a.outline(hexc('#07060c'), diagonal=True)
    # speed streaks
    for i, (y, ln) in enumerate(((oy + 3, 22), (oy + 9, 28), (oy + 15, 18))):
        for x in range(ox - ln - 4, ox - 4):
            if x >= 0:
                a.put(x, y, hexc('#ffc933') if i != 1 else hexc('#ff6a3c'))
                a.put(x, y + 1, hexc('#8a1424'))
    # "THE" above the first letters
    tm, tw, th = _word_mask('THE', 2, 2)
    tl = Art(a.w, a.h)
    tx, ty = ox + 2, oy - th - 5
    for y in range(th):
        for x in range(tw):
            if tm[y][x]:
                tl.put(tx + x, ty + y, hexc('#ffffff') if y < th - 3 else hexc('#c9d2e6'))
    tl.outline(hexc('#b8203a'), diagonal=True)
    tl.outline(hexc('#07060c'))
    a.blit(tl, 0, 0)
    # crop to content
    bbox = a.im.getbbox()
    return Art.from_image(a.im.crop(bbox))
