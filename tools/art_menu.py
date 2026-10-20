"""Title-screen art: a desert sunset in parallax layers (sky, mesas, the
town's silhouette, the trail), side-on galloping riders and the logo."""
import math

from pixelkit import Art, hexc, shade, mix, bayer, rng_for

W, H = 320, 240       # art resolution; exported at 4x -> 1280x960
BASE = 196            # ground level (the town's baseline)
OUTLINE = hexc('#1a0e10')

SKY = [(0.00, hexc('#140c2c')), (0.28, hexc('#2c1844')), (0.50, hexc('#5a2656')),
       (0.66, hexc('#94304e')), (0.80, hexc('#d8543c')), (0.91, hexc('#f28a3a')),
       (1.00, hexc('#fcc25a'))]
SUN = (232, BASE - 44)


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
            a.put(x, y, hi if bayer(x, y) < t else lo)
    # The first stars over the darkening east
    for _ in range(70):
        x, y = rng.randrange(W), rng.randrange(0, 80)
        b = rng.random()
        c = hexc('#ffffff') if b > 0.8 else hexc('#e8d4ff') if b > 0.4 else hexc('#8a76b8')
        a.put(x, y, c)
    # The setting sun: a halo, then the disc banded by heat haze
    sx, sy = SUN
    for y in range(H):
        for x in range(W):
            d = math.hypot(x + 0.5 - sx, (y + 0.5 - sy) * 1.1)
            if 30 < d < 46 and bayer(x, y) < (46 - d) / 16 * 0.55:
                a.put(x, y, mix(a.get(x, y), hexc('#ffd27a'), 0.35))
    for y in range(H):
        for x in range(W):
            d = math.hypot(x + 0.5 - sx, y + 0.5 - sy)
            if d <= 28:
                band = y > sy and (y - sy) % 5 in (0, 1) and (y - sy) > 4
                if band:
                    continue
                t = (y - (sy - 28)) / 56
                c = mix(hexc('#fff3b0'), hexc('#ff9a3c'), max(0.0, min(1.0, t)))
                a.put(x, y, c)
    # Vultures circling on the thermals
    for (vx, vy, s) in ((72, 46, 1), (96, 38, 1), (150, 58, 0)):
        wing = ['#.....#', '.#...#.', '..###..'] if s else ['#...#', '.###.']
        for j, row in enumerate(wing):
            for i, ch in enumerate(row):
                if ch == '#':
                    a.put(vx + i, vy + j, hexc('#1a1020'))
    return a


def _wrap_rect(a, x, y, w, h, c):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            a.set(xx % W, yy, c)


def far_layer():
    """Mesas and buttes on the horizon, their tops catching the last sun."""
    rng = rng_for('mesas')
    a = Art(W, H)
    body, rim, rim2 = hexc('#5c2a46'), hexc('#c8603e'), hexc('#8a3a44')
    x = 0
    while x < W:
        kind = rng.random()
        if kind < 0.45:
            # a broad mesa: flat top, steep crumbling sides
            w = rng.randint(40, 80)
            h = rng.randint(30, 52)
            top = BASE - h
            for i in range(w):
                edge = min(i, w - 1 - i)
                slope = max(0, 6 - edge) * 2 + (rng.randint(0, 1) if edge < 6 else 0)
                for y in range(top + slope, BASE):
                    a.set((x + i) % W, y, body)
                a.set((x + i) % W, top + slope, rim if edge > 2 else rim2)
                if edge > 3 and rng.random() < 0.4:
                    a.set((x + i) % W, top + slope + 1, rim2)
            # strata lines across the face
            for sy in range(top + 8, BASE - 4, 7):
                for i in range(6, w - 6):
                    if rng.random() < 0.7:
                        a.set((x + i) % W, sy, shade(body, 0.86))
            x += w + rng.randint(4, 20)
        else:
            # a butte: a tall narrow tower of rock on a skirt of scree
            w = rng.randint(14, 26)
            h = rng.randint(50, 76)
            top = BASE - h
            for i in range(-8, w + 8):
                skirt = BASE - max(0, 18 - abs(i - w / 2) * 1.2) if (i < 0 or i >= w) else top
                for y in range(int(skirt), BASE):
                    a.set((x + i) % W, y, body)
                if 0 <= i < w:
                    a.set((x + i) % W, top, rim)
                elif skirt < BASE:
                    a.set((x + i) % W, int(skirt), rim2)
            x += w + rng.randint(16, 40)
    return a


def near_layer():
    """The town at dusk: false fronts, a water tower, the church steeple and
    a windmill, lamplight in the windows."""
    rng = rng_for('town')
    a = Art(W, H)
    body, rim = hexc('#28141e'), hexc('#5a2a32')
    lit_colours = [hexc('#ffcf5a'), hexc('#ffe7a0'), hexc('#ffb347')]
    x = 2
    while x < W:
        pick = rng.random()
        if pick < 0.12:
            # water tower on legs
            tx = x
            _wrap_rect(a, tx, BASE - 46, 18, 16, body)
            for k in range(18):
                a.set((tx + k) % W, BASE - 46 - max(0, 4 - abs(k - 9) // 2), body)
            for lx in (tx + 2, tx + 15):
                _wrap_rect(a, lx, BASE - 30, 1, 30, body)
            a.line(tx + 2, BASE - 30, tx + 15, BASE - 6, body)
            for yy in range(BASE - 46, BASE - 30):
                a.set((tx + 17) % W, yy, rim)
            x += 24
            continue
        if pick < 0.22:
            # the church with its steeple
            cw = 26
            _wrap_rect(a, x, BASE - 30, cw, 30, body)
            for k in range(cw):
                a.set((x + k) % W, BASE - 30 - min(k, cw - 1 - k) // 2, body)
            sx = x + cw // 2 - 4
            _wrap_rect(a, sx, BASE - 58, 8, 22, body)
            for k in range(14):
                _wrap_rect(a, sx + k // 3, BASE - 58 - k, 8 - 2 * (k // 3), 1, body)
            a.set((sx + 4) % W, BASE - 74, rim)
            _wrap_rect(a, sx + 4, BASE - 78, 1, 4, rim)
            _wrap_rect(a, sx + 3, BASE - 77, 3, 1, rim)
            _wrap_rect(a, sx + 3, BASE - 50, 2, 3, lit_colours[0])
            for yy in range(BASE - 30, BASE):
                a.set((x + cw - 1) % W, yy, rim)
            x += cw + rng.randint(3, 8)
            continue
        if pick < 0.3:
            # windmill: lattice tower and the wheel
            tx = x + 6
            for yy in range(BASE - 50, BASE):
                spread = (yy - (BASE - 50)) // 8
                a.set((tx - spread) % W, yy, body)
                a.set((tx + spread + 1) % W, yy, body)
            for k in range(16):
                ang = k * math.pi / 8
                for r in range(2, 11):
                    a.set(int(tx + r * math.cos(ang)) % W, int(BASE - 54 + r * math.sin(ang)), body)
            x += 22
            continue
        # a false-front building
        bw = rng.randint(16, 30)
        bh = rng.randint(18, 36)
        top = BASE - bh
        _wrap_rect(a, x, top, bw, bh, body)
        # the false front's top: stepped, or rising to a peak
        if rng.random() < 0.5:
            _wrap_rect(a, x + bw // 4, top - 5, bw - 2 * (bw // 4), 5, body)
            for k in range(x + bw // 4, x + bw - bw // 4):
                a.set(k % W, top - 5, rim)
        else:
            for k in range(bw):
                rise = min(k, bw - 1 - k) // 3
                for yy in range(top - rise, top):
                    a.set((x + k) % W, yy, body)
                a.set((x + k) % W, top - rise, rim)
        for k in range(x, x + bw):
            a.set(k % W, top, rim)
        for yy in range(top, BASE):
            a.set((x + bw - 1) % W, yy, rim)
        # porch roof along the front
        _wrap_rect(a, x - 2, BASE - 12, bw + 4, 2, body)
        for px in range(x, x + bw, 7):
            _wrap_rect(a, px, BASE - 10, 1, 10, body)
        # windows
        wy = top + 5
        while wy < BASE - 16 and wy < top + 16:
            wx = x + 3
            while wx < x + bw - 4:
                if rng.random() < 0.38:
                    c = rng.choice(lit_colours)
                    _wrap_rect(a, wx, wy, 3, 4, c)
                    a.set((wx + 1) % W, wy, shade(c, 0.7))
                wx += 6
            wy += 9
        if rng.random() < 0.5:
            _wrap_rect(a, x + bw // 2 - 2, BASE - 8, 4, 6, lit_colours[2])
        x += bw + rng.randint(1, 10)
    return a


def street_layer():
    """The trail out of town: rutted dirt, a split-rail fence, telegraph
    poles with sagging wires, saguaros in silhouette."""
    a = Art(W, H)
    rng = rng_for('trail')
    # the near side of town: a strip of scrubby ground
    for y in range(BASE, BASE + 10):
        for x in range(W):
            r = rng.random()
            a.put(x, y, hexc('#3e2228') if r < 0.8 else hexc('#4c2a2c'))
    # the trail, lit by the low sun
    for y in range(BASE + 10, H):
        t = (y - BASE - 10) / (H - BASE - 10)
        for x in range(W):
            r = rng.random()
            base = mix(hexc('#8a4e36'), hexc('#5e3428'), t)
            c = base if r < 0.82 else shade(base, 1.1) if r < 0.93 else shade(base, 0.88)
            a.put(x, y, c)
    for ry in (214, 230):
        for x in range(W):
            if rng.random() < 0.85:
                a.put(x, ry, hexc('#4e2a22'))
                a.put(x, ry + 1, hexc('#9a5c40'))
    # split-rail fence along the edge of town
    for x in range(W):
        for ry in (BASE + 2, BASE + 6):
            a.put(x, ry, hexc('#6a3a2a') if (x // 3) % 3 else hexc('#7e4a34'))
    for px in range(0, W, 24):
        for y in range(BASE - 1, BASE + 10):
            a.put(px, y, hexc('#4a2620'))
            a.put(px + 1, y, hexc('#2e1618'))
    # telegraph poles and their wires
    poles = list(range(40, W + 40, 100))
    for px in poles:
        for y in range(BASE - 70, BASE + 10):
            a.put(px % W, y, hexc('#2a161c'))
            a.put((px + 1) % W, y, hexc('#1a0c12'))
        for cy in (BASE - 66, BASE - 60):
            for k in range(-6, 8):
                a.put((px + k) % W, cy, hexc('#2a161c'))
    for i, px in enumerate(poles):
        nx = px + 100
        for wire, cy in enumerate((BASE - 67, BASE - 61)):
            for k in range(100):
                sag = 7 * math.sin(math.pi * k / 100)
                a.put((px + k) % W, int(cy + sag), hexc('#1e1018') if wire == 0 else hexc('#2a161c'))
    # saguaros in silhouette
    for cx in (12, 170):
        h = 48 if cx == 12 else 36
        for y in range(BASE + 8 - h, BASE + 10):
            for k in range(-2, 3):
                a.put((cx + k) % W, y, hexc('#160a10'))
        for side, ay, ah in ((-1, BASE - h // 2, 14), (1, BASE - h // 2 + 6, 10)):
            ax = cx + side * 6
            for y in range(ay - ah, ay + 1):
                for k in range(-1, 2):
                    a.put((ax + k) % W, y, hexc('#160a10'))
            for k in range(0, 6):
                a.put((cx + side * k) % W, ay, hexc('#160a10'))
                a.put((cx + side * k) % W, ay - 1, hexc('#160a10'))
    return a


# --- Side-on riders --------------------------------------------------------------

# A gallop in six beats: each pair of angles is (thigh, fold) for the near
# fore, far fore, near hind and far hind leg, in degrees from straight down
# (positive points forward), plus how far the body rises
GALLOP = [
    dict(legs=((48, 30), (34, 20), (-52, -8), (-36, -2)), rise=1),
    dict(legs=((24, 12), (8, 40), (-30, 22), (-14, 34)), rise=0),
    dict(legs=((-12, 34), (-26, 12), (2, 62), (16, 50)), rise=0),
    dict(legs=((-34, 86), (-18, 74), (26, 72), (40, 58)), rise=2),
    dict(legs=((2, 92), (22, 70), (12, 18), (-4, 8)), rise=1),
    dict(legs=((36, 64), (22, 52), (-22, 2), (-38, -4)), rise=1),
]

RIDERS = {
    'outlaw': dict(coat=hexc('#efe8dc'), coat_d=hexc('#b8b0a2'), patch=hexc('#7a4426'),
                   mane=hexc('#2e2018'), hat=hexc('#2e2422'), hat_l=hexc('#54443e'),
                   shirt=hexc('#b8342a'), shirt_d=hexc('#7e1e18'), pants=hexc('#3a3a4a'),
                   bandana=hexc('#e05a46'), badge=False),
    'deputy': dict(coat=hexc('#b4692e'), coat_d=hexc('#7e451c'), patch=None,
                   mane=hexc('#4e2410'), hat=hexc('#e2d6bc'), hat_l=hexc('#fbf3e0'),
                   shirt=hexc('#3a5a96'), shirt_d=hexc('#26406e'), pants=hexc('#6a5038'),
                   bandana=None, badge=True),
}


def _thick_line(a, x0, y0, x1, y1, c, w=2):
    steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(steps + 1):
        t = i / steps
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        for dx in range(w):
            a.set(int(x + dx - w / 2 + 0.5), int(y), c)


def _leg(a, hip, thigh, fold, front, c, hoof):
    ang = math.radians(thigh)
    kx, ky = hip[0] + 6 * math.sin(ang), hip[1] + 6 * math.cos(ang)
    lower = math.radians(thigh - fold if front else thigh + fold)
    fx, fy = kx + 6 * math.sin(lower), ky + 6 * math.cos(lower)
    _thick_line(a, hip[0], hip[1], kx, ky, c, 3)
    _thick_line(a, kx, ky, fx, fy, c, 2)
    a.set(int(fx), int(fy), hoof)
    a.set(int(fx) + 1, int(fy), hoof)


def side_rider(kind, phase):
    """56x40 rider at full gallop, facing right."""
    p = RIDERS[kind]
    g = GALLOP[phase]
    a = Art(56, 40)
    lift = -g['rise']
    hoof = hexc('#1a1010')
    # far legs first, darker
    fl, ff, hl, hf = g['legs']
    _leg(a, (35, 24 + lift), ff[0], ff[1], True, p['coat_d'], hoof)
    _leg(a, (18, 24 + lift), hf[0], hf[1], False, p['coat_d'], hoof)
    # tail streaming behind
    for i in range(10):
        y = 18 + lift + int(2 * math.sin(i * 0.7 + phase))
        a.set(13 - i, y, p['mane'])
        a.set(13 - i, y + 1, p['mane'])
    # barrel, chest and rump
    a.ellipse(26.5, 21 + lift, 12, 5.6, p['coat'])
    a.ellipse(16.5, 20 + lift, 4.6, 4.6, p['coat'])
    a.ellipse(35.5, 21 + lift, 4.4, 4.8, p['coat'])
    # neck up to the head, head reaching forward
    for i in range(9):
        cx = 36 + i * 0.7
        cy = 18 + lift - i * 1.1
        a.disc(cx, cy, 3.0 - i * 0.12, p['coat'])
    for i in range(7):
        a.disc(42 + i * 0.95, 9 + lift + i * 0.45, 2.3 - i * 0.12, p['coat'])
    a.set(41, 6 + lift, p['coat_d'])  # ear
    a.set(42, 6 + lift, p['coat_d'])
    a.set(44, 9 + lift, hexc('#1a1010'))  # eye
    a.set(48, 12 + lift, shade(p['coat_d'], 0.8))
    # mane along the neck
    for i in range(8):
        a.set(int(35 + i * 0.75), int(16 + lift - i * 1.1), p['mane'])
        a.set(int(34 + i * 0.75), int(17 + lift - i * 1.1), p['mane'])
    if p['patch']:
        a.ellipse(22, 20 + lift, 4, 3, p['patch'])
        a.ellipse(15.5, 19 + lift, 2.5, 2.5, p['patch'])
        a.ellipse(40, 11 + lift, 1.6, 2, p['patch'])
    # belly shading
    for x in range(16, 38):
        for y in range(23 + lift, 28 + lift):
            if a.get(x, y) in (p['coat'], p['patch']):
                a.put(x, y, shade(a.get(x, y), 0.85))
                break
    # near legs in front
    _leg(a, (34, 24 + lift), fl[0], fl[1], True, p['coat'], hoof)
    _leg(a, (19, 24 + lift), hl[0], hl[1], False, p['coat'], hoof)
    # saddle, saddlebag, then the rider leaning into the run
    a.rect(22, 14 + lift, 9, 3, hexc('#6a4426'))
    a.rect(19, 16 + lift, 5, 5, hexc('#8a5a34'))
    a.hline(19, 23, 16 + lift, hexc('#b07a48'))
    a.rect(25, 15 + lift, 5, 6, p['pants'])         # thigh down the flank
    a.rect(27, 20 + lift, 3, 4, p['pants'])
    a.rect(27, 24 + lift, 4, 2, hexc('#3a2418'))    # boot in the stirrup
    torso_x = 26
    for i in range(8):
        a.hline(torso_x + i // 2, torso_x + 4 + i // 2, 14 + lift - i, p['shirt'])
        a.set(torso_x + i // 2, 14 + lift - i, p['shirt_d'])
    a.disc(31.5, 4.5 + lift, 2.3, hexc('#e2a878'))   # head
    if p['bandana']:
        a.hline(30, 33, 6 + lift, p['bandana'])
        a.set(29, 7 + lift, p['bandana'])
    # hat: crown and a wide brim
    a.rect(29, 0 + lift + 1, 5, 2, p['hat'])
    a.hline(27, 36, 3 + lift, p['hat'])
    a.hline(29, 33, 1 + lift, p['hat_l'])
    # arm forward to the reins, or a deputy waving his revolver
    if p['badge']:
        a.set(30, 9 + lift, hexc('#ffc933'))
        _thick_line(a, 31, 8 + lift, 35, 2 + lift, p['shirt'], 2)
        a.rect(35, 0 + lift + 1, 2, 2, hexc('#3a3a3a'))
        a.set(37, 1 + lift, hexc('#3a3a3a'))
    else:
        _thick_line(a, 31, 9 + lift, 37, 13 + lift, p['shirt'], 2)
        a.set(38, 13 + lift, hexc('#3a2a20'))
        a.line(38, 13 + lift, 46, 12 + lift, hexc('#4a2e1a'))  # reins
    a.outline(OUTLINE)
    return a


# --- The logo ------------------------------------------------------------------------

# Slab-serif capitals in the style of a wanted poster
FONT = {
    'T': ['########', '##.##.##', '#..##..#', '...##...', '...##...', '...##...', '...##...', '...##...',
          '..####..'],
    'H': ['###..###', '.##..##.', '.##..##.', '.######.', '.##..##.', '.##..##.', '.##..##.', '.##..##.',
          '###..###'],
    'E': ['#######.', '.##...#.', '.##.....', '.##.#...', '.####...', '.##.#...', '.##.....', '.##...#.',
          '#######.'],
    'G': ['..####..', '.##..##.', '##....#.', '##......', '##..####', '##...##.', '##...##.', '.##..##.',
          '..####..'],
    'A': ['...##...', '..####..', '..#.##..', '.##..##.', '.##..##.', '.######.', '.##..##.', '##...##.',
          '###..###'],
    'W': ['###....###', '.##....##.', '.##.##.##.', '.##.##.##.', '.##.##.##.', '.########.', '..##..##..',
          '..##..##..', '..#....#..'],
    'Y': ['###..###', '.##..##.', '..#..#..', '..####..', '...##...', '...##...', '...##...', '...##...',
          '..####..'],
}


def _word_mask(word, scale, gap):
    widths = [len(FONT[ch][0]) * scale for ch in word]
    w = sum(widths) + gap * (len(word) - 1)
    h = len(FONT['T']) * scale
    m = [[False] * w for _ in range(h)]
    x = 0
    for ch, cw in zip(word, widths):
        for j, row in enumerate(FONT[ch]):
            for i, px in enumerate(row):
                if px == '#':
                    for yy in range(scale):
                        for xx in range(scale):
                            m[j * scale + yy][x + i * scale + xx] = True
        x += cw + gap
    return m, w, h


def logo():
    """THE GETAWAY on a wanted-poster slab face: sun-gold letters with wood
    grain, a dark outline, a deep extrusion, bullet holes, and a ribbon
    carrying THE."""
    scale, gap = 3, 3
    m, ww, wh = _word_mask('GETAWAY', scale, gap)
    pad = 12
    a = Art(ww + pad * 2 + 8, wh + pad * 2 + 22)
    ox, oy = pad, pad + 20
    ramp = [hexc('#fff6c8'), hexc('#ffe27a'), hexc('#ffc23a'), hexc('#f0962a'), hexc('#c8621c')]
    letters = Art(a.w, a.h)
    for y in range(wh):
        for x in range(ww):
            if m[y][x]:
                f = y / (wh - 1)
                i = min(len(ramp) - 1, int(f * (len(ramp) - 1) + bayer(x, y) * 0.9))
                c = ramp[max(1, i)]
                # wood grain streaks across the letters
                if (y + int(3 * math.sin(x * 0.21))) % 7 == 0:
                    c = shade(c, 0.88)
                letters.put(ox + x, oy + y, c)
    for y in range(letters.h):
        for x in range(letters.w):
            if letters.filled(x, y) and not letters.filled(x, y - 1):
                letters.put(x, y, ramp[0])
    # bullet holes
    for (hx, hy) in ((ox + 14, oy + 9), (ox + 74, oy + 16), (ox + 140, oy + 7)):
        if letters.filled(hx, hy):
            letters.put(hx, hy, hexc('#2a1208'))
            letters.put(hx + 1, hy, hexc('#2a1208'))
            letters.put(hx, hy + 1, hexc('#2a1208'))
            letters.put(hx + 1, hy + 1, hexc('#5a2a10'))
            letters.put(hx - 1, hy - 1, hexc('#fff6c8'))
    body = letters.copy()
    body.outline(hexc('#5a1e10'), diagonal=True)
    body.outline(hexc('#2a0e08'), diagonal=False)
    ext = Art(a.w, a.h)
    for d in range(1, 6):
        for y in range(body.h):
            for x in range(body.w):
                if body.filled(x, y):
                    ext.put(x + d, y + d, hexc('#4a1a0e') if d < 5 else hexc('#2a0c06'))
    a.blit(ext, 0, 0)
    a.blit(body, 0, 0)
    a.outline(hexc('#120604'), diagonal=True)
    # THE on a ribbon over the first letters
    tm, tw, th = _word_mask('THE', 2, 2)
    rx0, ry0 = ox + 4, oy - th - 10
    ribbon = Art(a.w, a.h)
    for y in range(ry0 - 3, ry0 + th + 3):
        for x in range(rx0 - 8, rx0 + tw + 8):
            ribbon.put(x, y, hexc('#a8342a') if y < ry0 + th + 1 else hexc('#7e1e18'))
    for k in range(4):  # forked ends
        ribbon.put(rx0 - 8 + k, ry0 + th // 2 - 2 + k, (0, 0, 0, 0))
        ribbon.put(rx0 + tw + 7 - k, ry0 + th // 2 - 2 + k, (0, 0, 0, 0))
    for y in range(th):
        for x in range(tw):
            if tm[y][x]:
                ribbon.put(rx0 + x, ry0 + y, hexc('#fff3d6') if y < th - 2 else hexc('#e8d0a8'))
    ribbon.outline(hexc('#120604'))
    a.blit(ribbon, 0, 0)
    bbox = a.im.getbbox()
    return Art.from_image(a.im.crop(bbox))
