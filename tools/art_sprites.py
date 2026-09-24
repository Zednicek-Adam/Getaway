"""Vehicles, pickups, props, effects and HUD icons."""
import math

from pixelkit import Art, hexc, shade, mix, with_alpha, bayer, rng_for, rotsprite, noise_fill

OUTLINE = hexc('#161821')
TIRE = hexc('#15161c')
TIRE_L = hexc('#3a3d47')
HEAD = hexc('#fff6c0')
TAIL = hexc('#ff3b3b')
TAIL_D = hexc('#a81c24')
GLASS = hexc('#28395a')
GLASS_M = hexc('#3d5a86')
GLASS_L = hexc('#8fc0ec')
CHROME = hexc('#aab1bc')
SHADOW = (12, 14, 26, 90)
WHITE = hexc('#f4f6f8')
GOLD = hexc('#ffc933')
GOLD_L = hexc('#fff09a')
GOLD_D = hexc('#d88a14')
GOLD_DD = hexc('#9c5a0c')


# --- Vehicles (drawn facing up in a 32x32 frame) -------------------------------------

def _body(a, x0, y0, W, L, body, light, dark):
    for y in range(L):
        for x in range(W):
            if y in (0, L - 1) and x in (0, W - 1):
                continue
            c = body
            if x == 0:
                c = light
            elif x == W - 1:
                c = dark
            a.set(x0 + x, y0 + y, c)


def _glass_rows(a, x0, y0, W, rows, taper_first=True):
    for i, y in enumerate(rows):
        inset = 2 if (i == 0 and taper_first) else 1
        a.hline(x0 + inset, x0 + W - 1 - inset, y, GLASS if i else GLASS_M)
    # diagonal glint
    a.set(x0 + 2, rows[-1], GLASS_L)
    if len(rows) > 1:
        a.set(x0 + 3, rows[-2], GLASS_L)


def _wheels(a, x0, y0, W, rows_front, rows_rear):
    for rows in (rows_front, rows_rear):
        for i, y in enumerate(rows):
            c = TIRE_L if i == 0 else TIRE
            a.set(x0 - 1, y0 + y, c)
            a.set(x0 + W, y0 + y, c)


def player_car():
    a = Art(32, 32)
    W, L = 12, 22
    x0, y0 = 10, 5
    red, red_l, red_d = hexc('#d9303a'), hexc('#ff6a5c'), hexc('#8e1826')
    _body(a, x0, y0, W, L, red, red_l, red_d)
    _wheels(a, x0, y0, W, range(3, 7), range(15, 19))
    # Front: grille + headlights
    a.hline(x0 + 3, x0 + W - 4, y0, hexc('#2a1a1e'))
    for dx in (1, 2, W - 3, W - 2):
        a.set(x0 + dx, y0, HEAD)
    # Hood scoop
    a.rect(x0 + 5, y0 + 3, 2, 2, hexc('#3a1016'))
    # Windshield / roof / rear window
    _glass_rows(a, x0, y0, W, [y0 + 7, y0 + 8, y0 + 9])
    a.rect(x0 + 1, y0 + 10, W - 2, 5, shade(red, 1.07))
    _glass_rows(a, x0, y0, W, [y0 + 15, y0 + 16], taper_first=False)
    # Twin racing stripes (skip the glass)
    for y in list(range(1, 7)) + list(range(10, 15)) + list(range(17, 21)):
        a.set(x0 + 4, y0 + y, WHITE)
        a.set(x0 + 7, y0 + y, WHITE)
    # Mirrors
    a.set(x0 - 1, y0 + 8, red_d)
    a.set(x0 + W, y0 + 8, red_d)
    # Spoiler + tail
    a.hline(x0 - 1, x0 + W, y0 + 19, hexc('#1c1e26'))
    for dx in (1, 2, W - 3, W - 2):
        a.set(x0 + dx, y0 + L - 1, TAIL)
    a.set(x0 + 4, y0 + L, CHROME)
    a.set(x0 + 7, y0 + L, CHROME)
    a.outline(OUTLINE)
    return a


def police_car(light_state):
    """light_state: 0 off, 1 red phase, 2 blue phase."""
    a = Art(32, 32)
    W, L = 12, 22
    x0, y0 = 10, 5
    white, white_l, white_d = hexc('#e9edf2'), hexc('#ffffff'), hexc('#b0b8c4')
    black, black_l, black_d = hexc('#2a2e38'), hexc('#454a57'), hexc('#1a1d24')
    _body(a, x0, y0, W, L, white, white_l, white_d)
    # Black hood and trunk (classic black & white)
    for y in list(range(0, 7)) + list(range(17, L)):
        for x in range(W):
            if a.filled(x0 + x, y0 + y):
                c = black_l if x == 0 else black_d if x == W - 1 else black
                a.put(x0 + x, y0 + y, c)
    _wheels(a, x0, y0, W, range(3, 7), range(15, 19))
    # Push bar
    a.hline(x0 + 2, x0 + W - 3, y0 - 1, hexc('#5a5f6b'))
    for dx in (1, 2, W - 3, W - 2):
        a.set(x0 + dx, y0, HEAD)
    _glass_rows(a, x0, y0, W, [y0 + 7, y0 + 8, y0 + 9])
    _glass_rows(a, x0, y0, W, [y0 + 15, y0 + 16], taper_first=False)
    # Light bar across the roof
    red_off, blue_off = hexc('#6e1c26'), hexc('#1c2e6e')
    red_on, blue_on = hexc('#ff3346'), hexc('#3f86ff')
    red = red_on if light_state == 1 else red_off
    blue = blue_on if light_state == 2 else blue_off
    for y in (y0 + 11, y0 + 12):
        for x in range(x0 + 1, x0 + W - 1):
            mid = x0 + W // 2
            if x in (mid - 1, mid):
                c = hexc('#c9ced8')
            else:
                c = red if x < mid else blue
            a.set(x, y, c)
    if light_state == 1:
        a.set(x0 + 2, y0 + 11, hexc('#ffc4ca'))
    if light_state == 2:
        a.set(x0 + W - 3, y0 + 11, hexc('#cfe0ff'))
    # Door badges
    a.set(x0 + 1, y0 + 13, GOLD)
    a.set(x0 + W - 2, y0 + 13, GOLD)
    for dx in (1, W - 2):
        a.set(x0 + dx, y0 + L - 1, TAIL)
    a.outline(OUTLINE)
    return a


def swat_van(light_state):
    a = Art(32, 32)
    W, L = 14, 26
    x0, y0 = 9, 3
    navy, navy_l, navy_d = hexc('#2c3549'), hexc('#46526d'), hexc('#1c2232')
    _body(a, x0, y0, W, L, navy, navy_l, navy_d)
    _wheels(a, x0, y0, W, range(3, 7), range(19, 23))
    a.hline(x0 + 1, x0 + W - 2, y0 - 1, hexc('#5a5f6b'))  # ram bar
    for dx in (1, 2, W - 3, W - 2):
        a.set(x0 + dx, y0, HEAD)
    _glass_rows(a, x0, y0, W, [y0 + 4, y0 + 5, y0 + 6])
    # Roof box with panel seams and hatches
    a.rect(x0 + 1, y0 + 8, W - 2, 17, shade(navy, 1.1))
    for y in (y0 + 14, y0 + 20):
        a.hline(x0 + 1, x0 + W - 2, y, navy_d)
    for hy in (y0 + 15, y0 + 21):
        a.rect(x0 + 4, hy + 1, 6, 3, navy_d)
        a.hline(x0 + 4, x0 + 9, hy + 1, navy_l)
    # Yellow side stripes read as "tactical"
    for y in range(y0 + 8, y0 + 25):
        a.set(x0 + 1, y, hexc('#e8c547'))
        a.set(x0 + W - 2, y, hexc('#b8962a'))
    # Light bar
    red_on, blue_on = hexc('#ff3346'), hexc('#3f86ff')
    red = red_on if light_state == 1 else hexc('#6e1c26')
    blue = blue_on if light_state == 2 else hexc('#1c2e6e')
    mid = x0 + W // 2
    for y in (y0 + 9, y0 + 10):
        for x in range(x0 + 2, x0 + W - 2):
            a.set(x, y, hexc('#c9ced8') if x in (mid - 1, mid) else (red if x < mid else blue))
    for dx in (1, 2, W - 3, W - 2):
        a.set(x0 + dx, y0 + L - 1, TAIL)
    a.vline(mid, y0 + 22, y0 + L - 1, navy_d)  # rear doors
    a.outline(OUTLINE)
    return a


def diamond_truck():
    a = Art(32, 32)
    W, L = 14, 26
    x0, y0 = 9, 3
    s, s_l, s_d = hexc('#c9d0da'), hexc('#f1f4f8'), hexc('#8a93a3')
    _body(a, x0, y0, W, L, s, s_l, s_d)
    _wheels(a, x0, y0, W, range(3, 7), range(19, 23))
    a.hline(x0 + 3, x0 + W - 4, y0, hexc('#4a505c'))
    for dx in (1, 2, W - 3, W - 2):
        a.set(x0 + dx, y0, HEAD)
    _glass_rows(a, x0, y0, W, [y0 + 4, y0 + 5, y0 + 6])
    a.hline(x0, x0 + W - 1, y0 + 9, hexc('#5a6070'))  # cab / box seam
    # Armoured cargo box with a gold trim
    bx0, by0, bx1, by1 = x0 + 1, y0 + 10, x0 + W - 2, y0 + L - 2
    a.rect(bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1, hexc('#b3bbc8'))
    a.hline(bx0, bx1, by0, GOLD)
    a.hline(bx0, bx1, by1, GOLD_D)
    a.vline(bx0, by0, by1, GOLD_L)
    a.vline(bx1, by0, by1, GOLD_D)
    for y in range(by0 + 2, by1, 3):
        a.set(bx0 + 1, y, s_d)
        a.set(bx1 - 1, y, s_d)
    gem = ['.ooooo.', 'oWCccco', 'occccco', '.occco.', '..oco..', '...o...']
    a.grid(x0 + 4 - 1 + 1, y0 + 13, gem, {'o': hexc('#1f7f8f'), 'c': hexc('#3fd8e8'),
                                          'C': hexc('#a8f0f8'), 'W': WHITE})
    for dx in (1, W - 2):
        a.set(x0 + dx, y0 + L - 1, TAIL)
    a.outline(OUTLINE)
    return a


def direction_frames(up_art):
    """[LEFT, UP, RIGHT, DOWN] with a consistent down-right drop shadow."""
    out = []
    for q in (1, 0, 3, 2):
        f = up_art.rotated(q)
        f.drop_shadow(2, 2, SHADOW)
        out.append(f)
    return out


# --- Shared shape helpers ------------------------------------------------------------

def shape_from_fn(w, h, fn, base, light, dark, outline=OUTLINE):
    a = Art(w, h)
    for y in range(h):
        for x in range(w):
            if fn(x + 0.5, y + 0.5):
                a.set(x, y, base)
    a.bevel(base, light, dark)
    if outline:
        a.outline(outline)
    return a


def glyph(a, x, y, rows, c, shadow=None):
    if shadow:
        a.grid(x + 1, y + 1, rows, {'#': shadow})
    a.grid(x, y, rows, {'#': c})


DOLLAR = ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..']
CROSS = ['.##.', '.##.', '####', '####', '.##.', '.##.']
CROSS = ['..##..', '..##..', '######', '######', '..##..', '..##..']
BOLT = ['...##', '..##.', '.##..', '#####', '..##.', '.##..', '##...']
MISSILE = ['..#..', '.###.', '.###.', '.###.', '.###.', '#####', '#.#.#']


def coin_full():
    a = shape_from_fn(16, 16, lambda x, y: (x - 8) ** 2 + (y - 8) ** 2 <= 6.6 ** 2, GOLD, GOLD_L, GOLD_D)
    # inner rim ring
    for y in range(16):
        for x in range(16):
            d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
            if 4.6 < d <= 5.4:
                a.put(x, y, GOLD_D if x + y > 15 else hexc('#ffe070'))
    glyph(a, 6, 5, DOLLAR, GOLD_DD)
    a.set(4, 4, WHITE)
    return a


def coin_frames():
    full = coin_full()
    frames = [full]
    for w in (11, 6):
        f = Art(16, 16)
        squashed = full.im.crop((1, 0, 15, 16)).resize((w, 16), 0)
        f.blit(squashed, (16 - w) // 2, 0)
        frames.append(f)
    edge = Art(16, 16)
    edge.rect(7, 2, 2, 12, GOLD_D)
    edge.vline(7, 2, 13, GOLD)
    edge.outline(OUTLINE)
    frames.append(edge)
    frames.append(frames[2])
    frames.append(frames[1])
    return frames


def token(base, light, dark, icon):
    a = shape_from_fn(16, 16, lambda x, y: (x - 8) ** 2 + (y - 8) ** 2 <= 6.8 ** 2, base, light, dark)
    rows = icon
    gw = len(rows[0])
    gh = len(rows)
    glyph(a, 8 - gw // 2, 8 - gh // 2, rows, WHITE, shadow=shade(dark, 0.8))
    return a


def bomb(spark_phase=0, led=None):
    a = shape_from_fn(16, 16, lambda x, y: (x - 7.5) ** 2 + (y - 9.5) ** 2 <= 5.4 ** 2,
                      hexc('#2c303c'), hexc('#5a6278'), hexc('#171920'))
    a.set(5, 7, hexc('#9aa3bd'))
    a.set(6, 6, hexc('#9aa3bd'))
    # Fuse cap + fuse
    a.rect(9, 3, 3, 2, hexc('#8a8f99'))
    a.set(9, 3, hexc('#c0c5cd'))
    a.set(11, 4, hexc('#5a5f6b'))
    a.set(12, 2, hexc('#c8a878'))
    a.set(13, 1, hexc('#c8a878'))
    if spark_phase == 0:
        a.set(14, 0, hexc('#ffffff'))
        a.set(13, 0, GOLD)
        a.set(14, 1, hexc('#ff8a2a'))
    else:
        a.set(14, 0, GOLD)
        a.set(15, 1, hexc('#ff8a2a'))
        a.set(13, 0, hexc('#ff8a2a'))
    if led is not None:
        a.rect(6, 9, 3, 2, hexc('#101218'))
        a.set(7, 9, hexc('#ff3b3b') if led else hexc('#4a1a1e'))
    a.outline(OUTLINE)
    return a


def heart(base=hexc('#e8413f'), light=hexc('#ff8a80'), dark=hexc('#a8202a'), spec=True):
    def fn(x, y):
        return ((x - 4.9) ** 2 + (y - 5.6) ** 2 <= 3.3 ** 2 or (x - 11.1) ** 2 + (y - 5.6) ** 2 <= 3.3 ** 2
                or (y >= 5.6 and abs(x - 8) <= (13.8 - y) * 0.78))
    a = shape_from_fn(16, 16, fn, base, light, dark)
    if spec:
        a.set(4, 4, WHITE)
        a.set(5, 4, hexc('#ffd0cc'))
    return a


def star(base, light, dark):
    pts = []
    for i in range(10):
        r = 7.4 if i % 2 == 0 else 3.2
        ang = -math.pi / 2 + i * math.pi / 5
        pts.append((8 + r * math.cos(ang), 8.6 + r * math.sin(ang)))

    def inside(x, y):
        c = False
        j = len(pts) - 1
        for i in range(len(pts)):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                c = not c
            j = i
        return c
    return shape_from_fn(16, 16, inside, base, light, dark)


def shield(base, light, dark):
    half = {2: 5, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 5, 9: 5, 10: 4, 11: 3, 12: 2, 13: 1}

    def fn(x, y):
        yi = int(y)
        return yi in half and abs(x - 8) <= half[yi]
    a = shape_from_fn(16, 16, fn, base, light, dark)
    a.vline(8, 4, 11, light)
    return a


def money_bag():
    tan, tan_l, tan_d = hexc('#c99a5b'), hexc('#ebc58c'), hexc('#8f6532')

    def fn(x, y):
        return ((x - 8) ** 2 + (y - 10.2) ** 2 <= 5.3 ** 2 or (5.5 <= x <= 10.5 and 3 <= y <= 6)
                or (4.5 <= x <= 11.5 and 1.5 <= y <= 3))
    a = shape_from_fn(16, 16, fn, tan, tan_l, tan_d)
    a.hline(6, 9, 5, hexc('#5a3a1e'))
    glyph(a, 6, 7, ['.##.', '#...', '.##.', '...#', '.##.'][:5], hexc('#3e8a3e'))
    a.vline(7, 6, 12, hexc('#3e8a3e'))
    return a


def fuel_can():
    red, red_l, red_d = hexc('#d83b3b'), hexc('#ff7a6a'), hexc('#8e1c24')

    def fn(x, y):
        return 3 <= x <= 13 and 4 <= y <= 14.5 or (10 <= x <= 13 and 1.5 <= y <= 4)
    a = shape_from_fn(16, 16, fn, red, red_l, red_d)
    a.rect(4, 5, 4, 2, hexc('#1a1c26'))  # handle hole
    a.line(5, 9, 10, 13, red_d)
    a.line(10, 9, 5, 13, red_d)
    a.rect(11, 1, 2, 1, hexc('#c0c5cd'))
    return a


def rocket_icon():
    a = Art(16, 16)
    a.rect(7, 3, 3, 9, hexc('#e8ecf2'))
    a.vline(7, 3, 11, WHITE)
    a.vline(9, 3, 11, hexc('#a8b0bc'))
    a.rect(7, 1, 3, 2, hexc('#e8413f'))
    a.set(8, 0, hexc('#e8413f'))
    for dx, c in ((5, hexc('#b82830')), (6, hexc('#e8413f')), (10, hexc('#e8413f')), (11, hexc('#b82830'))):
        a.vline(dx, 10 if dx in (6, 10) else 11, 12, c)
    a.outline(OUTLINE)
    a.set(8, 13, GOLD)
    a.set(8, 14, hexc('#ff8a2a'))
    a.set(7, 13, hexc('#ff8a2a'))
    a.set(9, 13, hexc('#ff8a2a'))
    return a


def arrow_up():
    def fn(x, y):
        return (6 <= x <= 10 and 7 <= y <= 14) or (y >= 1.5 and y < 8 and abs(x - 8) <= (y - 1.5) + 0.6)
    return shape_from_fn(16, 16, fn, hexc('#e8ecf2'), WHITE, hexc('#9aa3b3'))


def gauge():
    a = shape_from_fn(16, 16, lambda x, y: (x - 8) ** 2 + (y - 8.5) ** 2 <= 6.6 ** 2,
                      hexc('#e8ecf2'), WHITE, hexc('#8f97a6'))
    for ang in range(180, 361, 45):
        r = math.radians(ang)
        a.set(int(8 + 4.8 * math.cos(r)), int(8.5 + 4.8 * math.sin(r)), hexc('#3a3f4e'))
    a.line(8, 8, 11, 5, hexc('#e8413f'))
    a.set(8, 8, hexc('#2a2e3a'))
    a.hline(6, 10, 12, hexc('#8f97a6'))
    return a


def wrench():
    a = Art(16, 16)
    steel, steel_l, steel_d = hexc('#b8c0cc'), hexc('#eef2f6'), hexc('#6f7888')
    for i in range(8):
        a.rect(3 + i, 11 - i, 2, 2, steel)
    a.disc(11.5, 4.5, 3.4, steel)
    for y in range(1, 5):
        for x in range(11, 13):
            a.put(x, y, (0, 0, 0, 0))  # jaw opening
    a.bevel(steel, steel_l, steel_d)
    a.outline(OUTLINE)
    return a


def bolt_icon():
    a = Art(16, 16)
    a.grid(4, 2, ['....###', '...###.', '..###..', '.######', '...###.', '..###..', '.###...',
                  '.##....', '##.....', '#......'][:10],
           {'#': hexc('#5fe0ff')})
    a.bevel(hexc('#5fe0ff'), hexc('#d8fbff'), hexc('#2a8fcf'))
    a.outline(OUTLINE)
    return a


def pickup_frames():
    """Pickup sheet (16x16 frames). Returns (frames, index map)."""
    frames = []
    idx = {}
    idx['coin'] = len(frames)
    frames += coin_frames()
    idx['repair'] = len(frames)
    frames.append(token(hexc('#3fbf5f'), hexc('#9af0aa'), hexc('#237a3b'), CROSS))
    idx['nitro'] = len(frames)
    frames.append(token(hexc('#2f9ee8'), hexc('#9ae0ff'), hexc('#1a5fa8'), BOLT))
    idx['rocket'] = len(frames)
    frames.append(token(hexc('#f08a24'), hexc('#ffc680'), hexc('#a8520e'), MISSILE))
    idx['bomb'] = len(frames)
    frames += [bomb(0), bomb(1)]
    idx['life'] = len(frames)
    frames.append(heart())
    idx['planted'] = len(frames)
    frames += [bomb(0, led=True), bomb(1, led=False)]
    return frames, idx


def icon_frames():
    frames = []
    idx = {}

    def add(name, art):
        idx[name] = len(frames)
        frames.append(art)
    add('coin', coin_full())
    add('bag', money_bag())
    add('heart', heart())
    add('heartEmpty', heart(hexc('#3a3f52'), hexc('#50566e'), hexc('#272a38'), spec=False))
    add('fuel', fuel_can())
    add('bomb', bomb(0))
    add('rocket', rocket_icon())
    add('shield', shield(hexc('#3fbf5f'), hexc('#9af0aa'), hexc('#237a3b')))
    add('shieldEmpty', shield(hexc('#3a3f52'), hexc('#50566e'), hexc('#272a38')))
    add('star', star(GOLD, GOLD_L, GOLD_D))
    add('starEmpty', star(hexc('#343849'), hexc('#4a4f66'), hexc('#24273a')))
    add('arrow', arrow_up())
    add('gauge', gauge())
    add('wrench', wrench())
    add('bolt', bolt_icon())
    return frames, idx


# --- Props -------------------------------------------------------------------------

def roadblock(vertical_road, phase):
    """Barricade across the road. vertical_road: the road runs up/down."""
    a = Art(32, 32)
    red, white = hexc('#e03a3a'), hexc('#f2f2f2')
    # Two striped sawhorse boards spanning the lane
    for by in (11, 18):
        for x in range(3, 29):
            c = red if ((x + by) // 3) % 2 == 0 else white
            a.set(x, by, c)
            a.set(x, by + 1, shade(c, 0.8))
        for lx in (5, 26):
            a.set(lx, by + 2, hexc('#5a5f6b'))
            a.set(lx, by - 1, hexc('#5a5f6b'))
    # Amber lamps blink alternately
    on, off = hexc('#ffcf3a'), hexc('#7a5a1a')
    for i, lx in enumerate((4, 16, 27)):
        lit = (i % 2 == phase)
        a.rect(lx - 1, 9, 2, 2, on if lit else off)
        if lit:
            a.set(lx - 1, 9, hexc('#fff6c0'))
    # Cones at the ends
    for cx in (2, 29):
        a.rect(cx - 1, 22, 3, 2, hexc('#f07a24'))
        a.set(cx, 21, hexc('#f07a24'))
        a.hline(cx - 1, cx + 1, 23, white)
        a.hline(cx - 2, cx + 2, 24, hexc('#3a3d47'))
    a.outline(OUTLINE)
    a.drop_shadow(1, 2, SHADOW)
    return a.rotated(1) if not vertical_road else a


def _landmark_building(roof, rim, wall, paint, glyph_rows, awning=None):
    a = Art(32, 32)
    x0, y0, x1, y1 = 3, 2, 28, 28
    fy = y1 - 7 + 1
    # facade
    a.rect(x0, fy, x1 - x0 + 1, 7, wall)
    a.hline(x0, x1, fy, shade(wall, 0.75))
    a.hline(x0, x1, y1, shade(wall, 0.6))
    # roof
    a.rect(x0, y0, x1 - x0 + 1, fy - y0, roof)
    a.hline(x0, x1, y0, shade(rim, 1.1))
    a.vline(x0, y0, fy - 1, shade(rim, 1.05))
    a.hline(x0, x1, fy - 1, shade(rim, 0.82))
    a.vline(x1, y0, fy - 1, shade(rim, 0.86))
    a.hline(x0 + 1, x1 - 1, y0 + 1, shade(roof, 0.8))
    gw, gh = len(glyph_rows[0]), len(glyph_rows)
    gx = (x0 + x1 + 1) // 2 - gw // 2
    gy = (y0 + fy) // 2 - gh // 2 + 1
    a.grid(gx + 1, gy + 1, glyph_rows, {'#': shade(roof, 0.7)})
    a.grid(gx, gy, glyph_rows, {'#': paint})
    if awning:
        for x in range(x0 + 1, x1):
            c = awning[0] if ((x - x0) // 2) % 2 == 0 else awning[1]
            a.set(x, fy + 1, c)
            a.set(x, fy + 2, shade(c, 0.85))
    return a, (x0, y0, x1, y1, fy)


BIG_DOLLAR = ['...##...', '.######.', '##.##...', '##.##...', '.######.', '...##.##',
              '...##.##', '.######.', '...##...']
BIG_DROP = ['...##...', '...##...', '..####..', '.######.', '########', '#####.##', '####.###',
            '.######.', '..####..']


def safehouse():
    a, (x0, y0, x1, y1, fy) = _landmark_building(
        hexc('#4a3b35'), hexc('#c8932a'), hexc('#7a4a36'), GOLD, BIG_DOLLAR)
    # Roller door
    a.rect(x0 + 6, fy + 2, 14, 5, hexc('#8a8f99'))
    for y in range(fy + 2, y1 + 1, 2):
        a.hline(x0 + 6, x0 + 19, y, hexc('#6a6f79'))
    a.hline(x0 + 6, x0 + 19, fy + 1, hexc('#ffc933'))
    a.set(x0 + 3, fy + 3, hexc('#ffd66b'))
    a.set(x1 - 3, fy + 3, hexc('#ffd66b'))
    full = Art(32, 32)
    full.blit(a, 0, 0)
    full.outline(OUTLINE)
    full.drop_shadow(2, 2, SHADOW)
    return full


def fuel_station():
    a, (x0, y0, x1, y1, fy) = _landmark_building(
        hexc('#e8ecef'), hexc('#3fbf5f'), hexc('#d8dde2'), hexc('#2f9e4a'), BIG_DROP,
        awning=(hexc('#3fbf5f'), hexc('#f2f2f2')))
    # pumps under the canopy edge
    for px in (x0 + 5, x1 - 6):
        a.rect(px, fy + 3, 3, 4, hexc('#e03a3a'))
        a.set(px + 1, fy + 4, hexc('#fff6c0'))
    full = Art(32, 32)
    full.blit(a, 0, 0)
    full.outline(OUTLINE)
    full.drop_shadow(2, 2, SHADOW)
    return full


def pad(colour, glyph_rows):
    """Painted bay marking on a road tile."""
    a = Art(32, 32)
    paint = with_alpha(colour, 230)
    for i in range(4, 28):
        for t in (4, 5):
            a.set(i, t, paint)
            a.set(i, 31 - t, paint)
            a.set(t, i, paint)
            a.set(31 - t, i, paint)
    # hatched corners
    for k in range(6):
        for (cx, cy, sx, sy) in ((6, 6, 1, 1), (25, 6, -1, 1), (6, 25, 1, -1), (25, 25, -1, -1)):
            if k < 4:
                a.set(cx + sx * k, cy + sy * (3 - k), with_alpha(colour, 150))
                a.set(cx + sx * k, cy + sy * (2 - k), with_alpha(colour, 150)) if k < 3 else None
    gw, gh = len(glyph_rows[0]), len(glyph_rows)
    a.grid(16 - gw // 2, 16 - gh // 2, glyph_rows, {'#': with_alpha(colour, 170)})
    return a


# --- Helicopter ------------------------------------------------------------------------

def heli_body():
    a = Art(48, 48)
    navy, navy_l, navy_d = hexc('#2a3650'), hexc('#4a5a7c'), hexc('#1a2236')
    # skids
    for sx in (15, 32):
        a.vline(sx, 12, 30, hexc('#8a919e'))
        a.set(sx, 11, hexc('#8a919e'))
    for sy in (16, 26):
        a.hline(16, 31, sy, hexc('#5a616e'))
    # tail boom + stabiliser + tail rotor
    a.rect(22, 28, 4, 14, navy)
    a.vline(22, 28, 41, navy_l)
    a.vline(25, 28, 41, navy_d)
    a.rect(18, 38, 12, 2, navy)
    a.hline(18, 29, 38, navy_l)
    a.rect(26, 40, 2, 6, hexc('#9aa3b3'))
    # cabin
    a.ellipse(24, 20, 8, 11, navy)
    b = Art(48, 48)
    b.ellipse(24, 20, 8, 11, navy)
    b.bevel(navy, navy_l, navy_d)
    a.blit(b, 0, 0)
    # canopy glass
    for y in range(10, 18):
        for x in range(16, 33):
            if ((x + 0.5 - 24) / 7) ** 2 + ((y + 0.5 - 18) / 8.5) ** 2 <= 1 and y < 17:
                a.set(x, y, GLASS_M if y < 13 else GLASS)
    a.set(20, 12, GLASS_L)
    a.set(21, 11, GLASS_L)
    a.set(19, 13, GLASS_L)
    # POLICE band
    a.hline(17, 31, 23, WHITE)
    a.hline(17, 31, 24, hexc('#c9ced8'))
    # nav lights
    a.set(16, 21, hexc('#ff3346'))
    a.set(31, 21, hexc('#3fdf5f'))
    a.set(24, 9, hexc('#fff6c0'))
    a.outline(OUTLINE)
    return a


def heli_frames():
    body = heli_body()
    frames, shadows = [], []
    for i in range(8):
        f = rotsprite(body, -45 * i) if i % 2 else body.rotated((-i // 2) % 4)
        frames.append(f)
        s = Art(48, 48)
        for y in range(48):
            for x in range(48):
                if f.filled(x, y):
                    s.put(x, y, (8, 10, 20, 95))
        shadows.append(s)
    return frames, shadows


def rotor_frames():
    frames = []
    for k in range(4):
        a = Art(48, 48)
        # faint motion disc
        for y in range(48):
            for x in range(48):
                d = math.hypot(x + 0.5 - 24, y + 0.5 - 24)
                if 20.5 < d <= 22 and (x + y) % 2 == 0:
                    a.set(x, y, (200, 210, 225, 60))
        for base in (0, 90):
            ang = math.radians(base + k * 22.5)
            dx, dy = math.cos(ang), math.sin(ang)
            for y in range(48):
                for x in range(48):
                    px, py = x + 0.5 - 24, y + 0.5 - 24
                    along = px * dx + py * dy
                    perp = abs(-px * dy + py * dx)
                    if abs(along) <= 21.5 and perp <= 0.95:
                        tip = abs(along) > 18
                        a.set(x, y, (26, 28, 36, 235) if not tip else (230, 200, 60, 235))
        a.disc(24, 24, 2.4, hexc('#8a919e'))
        a.set(23, 23, hexc('#c9ced8'))
        frames.append(a)
    return frames


# --- Effects ------------------------------------------------------------------------

def _hash(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
    return (n & 0xffff) / 65535.0


def explosion_frames(n=8, size=40):
    """Cartoon fireball: a union of puffs that swell, cool and break apart."""
    ramp = [hexc('#ffffff'), hexc('#fff3a8'), hexc('#ffd23f'), hexc('#ff9a2a'), hexc('#f0521f'),
            hexc('#b82626'), hexc('#6a5a5a'), hexc('#3e3a40')]
    rng = rng_for('explosion')
    puffs = [(rng.uniform(0, math.tau), rng.uniform(0.2, 1.0), rng.uniform(0.45, 0.75)) for _ in range(8)]
    puffs.append((0, 0, 0.8))
    frames = []
    c = size / 2
    for k in range(n):
        t = k / (n - 1)
        R = 6 + 13 * (1 - (1 - t) ** 2)
        a = Art(size, size)
        for y in range(size):
            for x in range(size):
                best = 9.0
                for ang, df, rf in puffs:
                    px = c + math.cos(ang) * df * R * 0.55
                    py = c + math.sin(ang) * df * R * 0.55 - t * 3
                    r = rf * R * 0.62
                    d = math.hypot(x + 0.5 - px, y + 0.5 - py) / r
                    best = min(best, d)
                if best > 1:
                    continue
                if t > 0.5 and _hash(x // 2, y // 2, k + 50) < (t - 0.5) * 1.5 and best > 0.3:
                    continue  # smoke breaking up
                v = best * 0.5 + t * 1.05 + (_hash(x, y, k) - 0.5) * 0.18
                i = max(0, min(len(ramp) - 1, int(v * 5.2)))
                a.set(x, y, ramp[i])
        frames.append(a)
    return frames


def smoke_frames(n=6, size=12):
    frames = []
    for k in range(n):
        t = k / (n - 1)
        r = 2.5 + 3 * t
        a = Art(size, size)
        for y in range(size):
            for x in range(size):
                d = math.hypot(x + 0.5 - 6, y + 0.5 - 6)
                if d > r:
                    continue
                if bayer(x, y) < t * 0.85:
                    continue
                c = hexc('#9aa0aa')
                if x + y < 10 and d > r - 1.6:
                    c = hexc('#c5cad2')
                elif x + y > 12 and d > r - 1.6:
                    c = hexc('#6a707c')
                a.set(x, y, c)
        frames.append(a)
    return frames


def spark_frames():
    shapes = [
        ['....', '.##.', '.##.', '....'],
        ['.#..', '###.', '.#..', '....'],
        ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'],
        ['.#.', '###', '.#.'],
    ]
    frames = []
    for s in shapes:
        a = Art(8, 8)
        ox = (8 - len(s[0])) // 2
        oy = (8 - len(s)) // 2
        a.grid(ox, oy, s, {'#': hexc('#fffbe0')})
        frames.append(a)
    return frames


def glow(size=32):
    a = Art(size, size)
    c = size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x + 0.5 - c, y + 0.5 - c) / c
            if d >= 1:
                continue
            level = 1 - d
            q = [0, 0.12, 0.25, 0.45, 0.7][min(4, int(level * 5) + (1 if bayer(x, y) < (level * 5) % 1 else 0))]
            a.set(x, y, (255, 255, 255, int(q * 255)))
    return a


def spotlight(r=64):
    size = r * 2
    a = Art(size, size)
    for y in range(size):
        for x in range(size):
            d = math.hypot(x + 0.5 - r, y + 0.5 - r)
            if d > r:
                continue
            f = d / r
            if f > 0.94:
                al = 0.42
            elif f > 0.88:
                al = 0.2
            else:
                al = 0.26 - 0.14 * f + (0.03 if bayer(x, y) < 0.5 and f > 0.7 else 0)
            a.set(x, y, (255, 246, 200, int(al * 255)))
    return a


def scorch():
    a = Art(28, 28)
    rng = rng_for('scorch')
    for y in range(28):
        for x in range(28):
            d = math.hypot(x + 0.5 - 14, y + 0.5 - 14)
            ang = math.atan2(y - 14, x - 14)
            edge = 9 + 3 * math.sin(ang * 7) + 2 * math.sin(ang * 3 + 1)
            if d < edge:
                al = 150 if d < edge * 0.55 else 95
                if rng.random() < 0.15:
                    al -= 40
                a.set(x, y, (20, 18, 22, al))
    return a


def flame_frames():
    out = []
    for length in (6, 9, 7):
        a = Art(8, 12)
        for y in range(length):
            half = 2.6 * (1 - y / (length + 1)) + 0.4
            for x in range(8):
                dx = abs(x + 0.5 - 4)
                if dx <= half:
                    t = dx / half
                    c = hexc('#f2ffff') if t < 0.35 and y < length * 0.6 else hexc('#5fe0ff') if t < 0.75 else hexc('#2a7fff')
                    a.set(x, y, c)
        out.append(a)
    return out


def rocket_frames():
    out = []
    for phase in range(2):
        a = Art(16, 8)
        a.rect(5, 3, 8, 3, hexc('#e8ecf2'))
        a.hline(5, 12, 3, WHITE)
        a.hline(5, 12, 5, hexc('#a8b0bc'))
        a.rect(13, 3, 2, 3, hexc('#e8413f'))
        a.set(15, 4, hexc('#e8413f'))
        for x in (5, 6):
            a.set(x, 2, hexc('#b82830'))
            a.set(x, 6, hexc('#b82830'))
        a.outline(OUTLINE)
        fl = 4 if phase == 0 else 3
        for x in range(0, fl):
            a.set(4 - x, 4, GOLD if x < 2 else hexc('#ff8a2a'))
        a.set(3, 3 + phase, hexc('#ff8a2a'))
        a.set(4, 4, WHITE)
        out.append(a)
    return out


def blob_shadow(w=14, h=6):
    a = Art(w, h)
    a.ellipse(w / 2, h / 2, w / 2, h / 2, (10, 12, 24, 80))
    return a


# --- UI -----------------------------------------------------------------------------

def panel(border, border_l, border_d, fill=(20, 23, 34, 238)):
    a = Art(16, 16)
    o = hexc('#0a0b11')
    for y in range(16):
        for x in range(16):
            edge = min(x, y, 15 - x, 15 - y)
            if edge == 0:
                c = o
            elif edge == 1:
                c = border_l if (x < 15 - y and (x == 1 or y == 1)) else border_d if (x == 14 or y == 14) else border_l
            elif edge in (2, 3):
                c = border if not (x == 2 or y == 2) else shade(border, 1.15)
            elif edge == 4:
                c = o
            else:
                c = fill
            a.put(x, y, c)
    # corners stay square-ish: knock out the very corner pixels
    for (x, y) in ((0, 0), (15, 0), (0, 15), (15, 15)):
        a.put(x, y, (0, 0, 0, 0))
    for (x, y) in ((2, 2), (13, 2), (2, 13), (13, 13)):
        a.put(x, y, shade(border_l, 1.2))
    return a


def vignette(w=320, h=240):
    a = Art(w, h)
    for y in range(h):
        for x in range(w):
            nx = (x + 0.5 - w / 2) / (w / 2)
            ny = (y + 0.5 - h / 2) / (h / 2)
            d = math.sqrt(nx * nx * 0.9 + ny * ny)
            v = max(0.0, d - 0.72) / 0.6
            v = min(1.0, v)
            steps = int(v * 4 + bayer(x, y) * 0.999)
            al = [0, 40, 75, 110, 140][min(4, steps)]
            if al:
                a.set(x, y, (6, 6, 16, al))
    return a
