"""Main Street: the false-front buildings, the church and the water tower.

Seen in the same 3/4 view as the rest of the map: the roof from above at the
back of the lot, then the false front rising square over it with the sign
painted on, then the shop front in the shade of the porch roof, posts
standing on the edge of the lot by the boardwalk. Every business has its own
sign, lettered in a 3x5 pixel font, and its own trade on the porch.
"""
from pixelkit import Art, hexc, shade, mix, rng_for

import art_city as city

T = city.T
OUTLINE = city.OUTLINE
SHADOW = city.SHADOW

# --- Lettering ---------------------------------------------------------------------

FONT = {
    'A': ['.#.', '#.#', '###', '#.#', '#.#'], 'B': ['##.', '#.#', '##.', '#.#', '##.'],
    'C': ['.##', '#..', '#..', '#..', '.##'], 'D': ['##.', '#.#', '#.#', '#.#', '##.'],
    'E': ['###', '#..', '##.', '#..', '###'], 'F': ['###', '#..', '##.', '#..', '#..'],
    'G': ['.##', '#..', '#.#', '#.#', '.##'], 'H': ['#.#', '#.#', '###', '#.#', '#.#'],
    'I': ['###', '.#.', '.#.', '.#.', '###'], 'J': ['..#', '..#', '..#', '#.#', '.#.'],
    'K': ['#.#', '#.#', '##.', '#.#', '#.#'], 'L': ['#..', '#..', '#..', '#..', '###'],
    'M': ['#.#', '###', '###', '#.#', '#.#'], 'N': ['##.', '#.#', '#.#', '#.#', '#.#'],
    'O': ['.#.', '#.#', '#.#', '#.#', '.#.'], 'P': ['##.', '#.#', '##.', '#..', '#..'],
    'Q': ['.#.', '#.#', '#.#', '##.', '.##'], 'R': ['##.', '#.#', '##.', '#.#', '#.#'],
    'S': ['.##', '#..', '.#.', '..#', '##.'], 'T': ['###', '.#.', '.#.', '.#.', '.#.'],
    'U': ['#.#', '#.#', '#.#', '#.#', '###'], 'V': ['#.#', '#.#', '#.#', '#.#', '.#.'],
    'W': ['#.#', '#.#', '###', '###', '#.#'], 'X': ['#.#', '#.#', '.#.', '#.#', '#.#'],
    'Y': ['#.#', '#.#', '.#.', '.#.', '.#.'], 'Z': ['###', '..#', '.#.', '#..', '###'],
    '&': ['.#.', '#.#', '.#.', '#.#', '.##'], '.': ['...', '...', '...', '...', '.#.'],
    ' ': ['...', '...', '...', '...', '...'],
}


def text_width(text):
    return len(text) * 4 - 1


def letter(a, x, y, text, colour, shadow=None):
    """Draws `text` with its top-left at (x, y)."""
    for i, ch in enumerate(text):
        for j, row in enumerate(FONT[ch]):
            for k, px in enumerate(row):
                if px == '#':
                    if shadow:
                        a.set(x + i * 4 + k + 1, y + j + 1, shadow)
                    a.set(x + i * 4 + k, y + j, colour)


# --- Materials ---------------------------------------------------------------------

WOOD = city.WOOD
WOOD_L = city.WOOD_L
WOOD_D = city.WOOD_D
WOOD_DD = city.WOOD_DD
GLASS = city.GLASS
GLASS_L = city.GLASS_L
LIT = city.LIT
DOOR = city.DOOR

SHINGLE = (hexc('#8a7058'), hexc('#6a5644'))
GREY_SHINGLE = (hexc('#7c766e'), hexc('#5c5852'))
RED_SHINGLE = (hexc('#8e5a40'), hexc('#6a402e'))
TIN = (hexc('#aaa69e'), hexc('#86827a'))


def _clapboard(a, x0, x1, y0, y1, paint):
    for y in range(y0, y1 + 1):
        c = paint if (y - y0) % 2 == 0 else shade(paint, 0.88)
        a.hline(x0, x1, y, c)
    a.vline(x1, y0, y1, shade(paint, 0.72))


def _brick(a, x0, x1, y0, y1, brick):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            row = (y - y0) // 2
            c = shade(brick, 1.12) if (y - y0) % 2 == 1 else brick
            if (y - y0) % 2 == 0 and (x + row * 2) % 5 == 0:
                c = shade(brick, 0.78)
            a.put(x, y, c)
    a.vline(x1, y0, y1, shade(brick, 0.7))


def _stone(a, x0, x1, y0, y1, stone):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c = stone if ((x // 4) + (y // 3)) % 2 else shade(stone, 0.92)
            if y % 3 == 2 or (x + (y // 3) * 2) % 4 == 0 and y % 3 != 2 and (x // 4 + y // 3) % 3 == 0:
                c = shade(stone, 0.78)
            a.put(x, y, c)
    a.vline(x1, y0, y1, shade(stone, 0.7))


def _wall(a, x0, x1, y0, y1, spec):
    material = spec.get('material', 'clapboard')
    if material == 'brick':
        _brick(a, x0, x1, y0, y1, spec['wall'])
    elif material == 'stone':
        _stone(a, x0, x1, y0, y1, spec['wall'])
    else:
        _clapboard(a, x0, x1, y0, y1, spec['wall'])


def _roof(a, x0, x1, y0, y1, colours, rng, tin=False):
    """A roof running back from the false front: shingles in courses or tin
    in ridged sheets, the ridge down the middle catching the light."""
    hi, lo = colours
    mid = (x0 + x1) / 2
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c = hi if x + 0.5 < mid else lo
            if tin:
                if (x - x0) % 3 == 0:
                    c = shade(c, 1.12)
            elif (y - y0) % 3 == 2:
                c = shade(c, 0.86)
            elif (x + ((y - y0) // 3) * 3) % 6 == 0:
                c = shade(c, 0.92)
            if rng.random() < 0.03:
                c = shade(c, 1.08)
            a.put(x, y, c)
    a.vline(int(mid), y0, y1, shade(hi, 1.15))


def _chimney(a, x, y, colour=None):
    colour = colour or city.BRICK
    a.rect(x, y, 3, 4, colour)
    a.hline(x, x + 2, y, shade(colour, 1.2))
    a.put(x + 1, y, hexc('#2a1a14'))
    a.vline(x + 3, y + 1, y + 4, SHADOW)


def _window(a, x, y, w, h, trim, lit=False, bars=False):
    a.rect(x - 1, y - 1, w + 2, h + 2, trim)
    a.rect(x, y, w, h, LIT if lit else GLASS)
    a.put(x, y, hexc('#fff0b0') if lit else GLASS_L)
    if w >= 3:
        a.vline(x + w // 2, y, y + h - 1, trim)
    if bars:
        for bx in range(x, x + w, 2):
            a.vline(bx, y, y + h - 1, hexc('#2a2626'))


def _box(a, x0, y0, x1, y1):
    for x in range(x0 - 1, x1 + 2):
        a.put(x, y0 - 1, OUTLINE)
        a.put(x, y1 + 1, OUTLINE)
    for y in range(y0, y1 + 1):
        a.put(x0 - 1, y, OUTLINE)
        a.put(x1 + 1, y, OUTLINE)


def _barrel(a, x, y):
    a.rect(x, y, 3, 4, WOOD)
    a.hline(x, x + 2, y, WOOD_L)
    a.hline(x, x + 2, y + 2, WOOD_DD)
    a.vline(x + 2, y, y + 3, WOOD_D)


def _crate(a, x, y):
    a.rect(x, y, 4, 3, hexc('#c8a070'))
    a.hline(x, x + 3, y, hexc('#e0bc88'))
    a.put(x + 1, y + 1, WOOD_D)
    a.put(x + 2, y + 2, WOOD_D)


# --- The false front ---------------------------------------------------------------

# Parapet shapes: the top edge of the false front over the roof line
def _parapet_profile(kind, w):
    """Height (px above the eave) at each column of a w-wide false front."""
    mid = (w - 1) / 2
    out = []
    for x in range(w):
        d = abs(x - mid) / max(1, mid)
        if kind == 'square':
            h = 4
        elif kind == 'stepped':
            h = 7 if d < 0.34 else 5 if d < 0.67 else 3
        elif kind == 'gable':
            h = 3 + int(round((1 - d) * 5))
        elif kind == 'arched':
            h = 3 + int(round((1 - d * d) * 4))
        else:  # 'flat': a plain eave, no false front over the roof
            h = 1
        out.append(h)
    return out


def false_front(tw, th, spec):
    """A Main Street business filling its lot, front at the bottom.

    spec: sign (text, one or two lines joined by '/'), wall, trim, roof,
    parapet, material, and a `porch` decoration: batwing, bank, jail,
    barber, store, livery, smithy, coffins, guns, hotel, plain."""
    rng = rng_for('front', tw, th, spec['sign'])
    w, h = tw * T, th * T
    a = Art(w, h)
    city._yard(a, rng)
    x0, x1 = 1, w - 3
    porch_h = 5                         # porch roof strip + the shade below it
    ground_h = 9 if th == 1 else 10    # shop front under the porch
    upper_h = 9 if th == 1 else 17     # false front over the porch
    y_bottom = h - 3
    y_ground = y_bottom - ground_h + 1
    y_upper = y_ground - upper_h
    profile = _parapet_profile(spec.get('parapet', 'square'), x1 - x0 + 1)
    top = y_upper - max(profile)
    roof_y0 = 1
    roof_y1 = y_upper + 1

    # shadow cast down-right by the whole building
    for d in (1, 2):
        for y in range(roof_y0 + d, y_bottom + d + 1):
            city._darken(a, x1 + d, y)
        for x in range(x0 + d, x1 + d + 1):
            city._darken(a, x, y_bottom + d)

    # roof behind the false front, and a chimney or stovepipe
    if roof_y1 > roof_y0 + 2:
        _roof(a, x0 + 1, x1 - 1, roof_y0, roof_y1, spec.get('roof', SHINGLE), rng, tin=spec.get('tin', False))
        _box(a, x0 + 1, roof_y0, x1 - 1, roof_y1)
        if roof_y1 - roof_y0 > 8:
            _chimney(a, x1 - 6 if rng.random() < 0.6 else x0 + 4, roof_y0 + 2,
                     city.STONE if spec.get('material') == 'stone' else None)

    # the false front: wall up to its parapet profile
    for i, ph in enumerate(profile):
        x = x0 + i
        for y in range(y_upper - ph, y_upper):
            a.put(x, y, spec['wall'])
    _wall(a, x0, x1, y_upper, y_bottom, spec)
    trim = spec['trim']
    for i, ph in enumerate(profile):
        a.put(x0 + i, y_upper - ph, trim)                  # cornice along the top
        a.put(x0 + i, y_upper - ph - 1, OUTLINE)
    for i in range(1, len(profile)):
        if profile[i] != profile[i - 1]:
            lo, hi = sorted((profile[i], profile[i - 1]))
            xx = x0 + i if profile[i] > profile[i - 1] else x0 + i - 1
            for y in range(y_upper - hi - 1, y_upper - lo):
                a.put(xx, y, OUTLINE)
    a.vline(x0 - 1, y_upper - profile[0] - 1, y_bottom, OUTLINE)
    a.vline(x1 + 1, y_upper - profile[-1] - 1, y_bottom, OUTLINE)
    a.hline(x0 - 1, x1 + 1, y_bottom + 1, OUTLINE)

    # the sign board, lettered
    lines = spec['sign'].split('/')
    board_h = 7 * len(lines) - 1
    board_w = max(text_width(t) for t in lines) + 4
    bx0 = x0 + (x1 - x0 + 1 - board_w) // 2
    by0 = y_upper + (2 if th == 1 else 2)
    board, ink = spec.get('board', hexc('#2e2018')), spec.get('ink', hexc('#f0d890'))
    a.rect(bx0, by0, board_w, board_h, board)
    a.hline(bx0, bx0 + board_w - 1, by0 - 1, shade(board, 0.6))
    a.hline(bx0, bx0 + board_w - 1, by0 + board_h, shade(board, 0.6))
    for k, t in enumerate(lines):
        tx = bx0 + (board_w - text_width(t)) // 2
        letter(a, tx, by0 + 1 + k * 7, t, ink)

    # upstairs windows on the taller fronts, a balcony on the hotel and saloon
    if th >= 2:
        wy = by0 + board_h + 3
        if wy + 4 < y_ground - 1:
            for wx in range(x0 + 4, x1 - 4, 8):
                _window(a, wx, wy, 3, 4, trim, lit=rng.random() < 0.15)
            if spec.get('porch') in ('hotel', 'batwing'):
                a.hline(x0, x1, wy + 5, trim)
                for px in range(x0 + 1, x1, 3):
                    a.put(px, wy + 4, trim)

    # porch roof over the boardwalk, on posts, the shop front in its shade
    py = y_ground
    roof_c = spec.get('porch_roof', shade(spec.get('roof', SHINGLE)[0], 1.1))
    a.rect(x0, py, x1 - x0 + 1, 2, roof_c)
    a.hline(x0, x1, py + 1, shade(roof_c, 0.75))
    a.hline(x0, x1, py - 1, OUTLINE)
    for y in range(py + 2, y_bottom + 1):
        for x in range(x0, x1 + 1):
            a.put(x, y, shade(a.get(x, y), 0.8))   # under the porch roof it's shade
    posts = list(range(x0 + 1, x1, 8 if tw == 1 else 9)) + [x1 - 1]
    for px in posts:
        a.vline(px, py + 2, y_bottom, trim)
    _shop_front(a, rng, x0, x1, py + 2, y_bottom, spec)
    return a


def _shop_front(a, rng, x0, x1, y0, y1, spec):
    """Door, windows and the trade's own furniture under the porch."""
    trim = spec['trim']
    kind = spec.get('porch', 'plain')
    mid = (x0 + x1) // 2
    door_x = mid - 1
    if kind == 'livery':
        a.rect(mid - 4, y0, 9, y1 - y0 + 1, WOOD_DD)
        a.line(mid - 4, y0, mid + 4, y1, WOOD_L)
        a.line(mid + 4, y0, mid - 4, y1, WOOD_L)
        a.rect(x0 + 2, y1 - 3, 3, 3, city.HAY)
        a.put(x0 + 2, y1 - 3, city.HAY_L)
        return
    if kind == 'smithy':
        a.rect(mid - 4, y0, 9, y1 - y0 + 1, hexc('#1a1210'))  # the open forge
        a.rect(mid - 2, y1 - 2, 3, 2, hexc('#e8501e'))
        a.put(mid - 1, y1 - 2, hexc('#ffd66b'))
        a.rect(x1 - 6, y1 - 1, 4, 2, hexc('#3a3638'))  # anvil
        a.hline(x1 - 7, x1 - 2, y1 - 2, hexc('#5a5658'))
        return
    a.rect(door_x, y0 + 1, 3, y1 - y0, DOOR)
    if kind == 'batwing':
        a.vline(door_x, y0 + 2, y0 + 4, trim)
        a.vline(door_x + 2, y0 + 2, y0 + 4, trim)
    for wx in (x0 + 3, x1 - 6):
        if abs(wx + 1 - mid) > 3 and wx > x0 and wx + 3 < x1:
            _window(a, wx, y0 + 2, 3, max(2, y1 - y0 - 3), trim, lit=kind in ('batwing',) or rng.random() < 0.15,
                    bars=kind == 'jail')
    if kind == 'jail':
        a.put(mid + 4, y0 + 1, hexc('#ffc933'))  # the star on the door frame
        a.put(mid + 3, y0 + 2, hexc('#ffc933'))
        a.put(mid + 5, y0 + 2, hexc('#ffc933'))
        a.put(mid + 4, y0 + 2, hexc('#ffe07a'))
    elif kind == 'barber':
        for k, y in enumerate(range(y0, y1)):
            a.put(door_x - 3, y, hexc('#c0392b') if k % 3 == 0 else hexc('#efe6cf') if k % 3 == 1 else hexc('#2f4a8a'))
    elif kind == 'store':
        _barrel(a, x0 + 2, y1 - 3)
        _crate(a, x1 - 5, y1 - 2)
    elif kind == 'coffins':
        for cx in (x0 + 2, x1 - 4):
            a.rect(cx, y0, 3, y1 - y0 + 1, hexc('#5a3a22'))
            a.vline(cx + 1, y0 + 1, y1 - 1, hexc('#7a5434'))
    elif kind == 'bank':
        for cx in (x0 + 2, x1 - 3):
            a.vline(cx, y0, y1, hexc('#ece4d0'))  # columns
    elif kind == 'guns':
        a.line(x1 - 6, y0 + 2, x1 - 3, y0 + 2, hexc('#3a3638'))
        a.put(x1 - 6, y0 + 3, WOOD_D)


# --- Churches, towers ---------------------------------------------------------------

def church(tw, th):
    """The white clapboard church: a steeple over the door, the bell in its
    belfry, the cross on top, and a churchyard."""
    rng = rng_for('church', tw, th)
    w, h = tw * T, th * T
    a = Art(w, h)
    city._grass(a, rng)
    white = hexc('#ece6d6')
    x0, x1 = w // 2 - 11, w // 2 + 9
    y_wall = h - 15
    y_bottom = h - 4
    # nave roof running back from the gable
    for d in (1, 2):
        for y in range(5 + d, y_bottom + d + 1):
            city._darken(a, x1 + d, y)
        for x in range(x0 + d, x1 + d + 1):
            city._darken(a, x, y_bottom + d)
    _roof(a, x0, x1, 6, y_wall - 1, GREY_SHINGLE, rng)
    _box(a, x0, 6, x1, y_wall - 1)
    _clapboard(a, x0, x1, y_wall, y_bottom, white)
    _box(a, x0, y_wall, x1, y_bottom)
    for wx in (x0 + 3, x1 - 5):
        a.rect(wx, y_wall + 3, 3, 6, hexc('#7a9ac0'))
        a.put(wx + 1, y_wall + 2, hexc('#7a9ac0'))
        a.put(wx, y_wall + 3, hexc('#b8d0e8'))
    # the steeple, standing in front of the gable over the door
    sx0, sx1 = w // 2 - 4, w // 2 + 2
    for y in range(y_wall - 12, y_bottom + 1):
        a.hline(sx0, sx1, y, white if (y % 2) else shade(white, 0.92))
    a.vline(sx1, y_wall - 12, y_bottom, shade(white, 0.75))
    a.rect(sx0 + 2, y_wall - 9, 3, 4, hexc('#2a1a14'))   # belfry
    a.put(sx0 + 3, y_wall - 7, hexc('#c8932a'))           # the bell
    for k in range(5):                                    # spire
        a.hline(sx0 + k // 2 + 1, sx1 - k // 2 - 1, y_wall - 13 - k, hexc('#6a6058') if k % 2 else hexc('#7c766e'))
    a.vline(w // 2 - 1, y_wall - 22, y_wall - 18, hexc('#c8932a'))   # the cross
    a.hline(w // 2 - 2, w // 2, y_wall - 21, hexc('#c8932a'))
    _box(a, sx0, y_wall - 12, sx1, y_bottom)
    a.rect(w // 2 - 2, y_bottom - 4, 3, 4, hexc('#6a3a22'))   # door
    # churchyard path and a couple of graves
    for y in range(y_bottom + 2, h):
        a.hline(w // 2 - 2, w // 2, y, city.YARD)
    if tw > 1:
        for gx in (6, w - 8):
            a.vline(gx, h - 12, h - 7, city.WOOD_L)
            a.hline(gx - 1, gx + 1, h - 10, city.WOOD_L)
    return a


def water_tower():
    """The railroad's water tower: a wooden tank on trestle legs, the spout
    swung out and a puddle under it."""
    rng = rng_for('water_tower')
    a = Art(T, T)
    city._yard(a, rng)
    cx = 15
    a.ellipse(cx + 4, 28, 9, 2.5, SHADOW)
    a.ellipse(cx + 6, 29, 3, 1, city.PUDDLE)
    for lx in (cx - 7, cx - 3, cx + 2, cx + 6):
        a.vline(lx, 14, 28, WOOD_DD)
    a.line(cx - 7, 18, cx + 6, 26, WOOD_D)
    a.line(cx + 6, 18, cx - 7, 26, WOOD_D)
    # the tank: staves, hoops, conical lid
    for y in range(5, 15):
        for x in range(cx - 8, cx + 8):
            c = WOOD_L if x < cx - 3 else WOOD if x < cx + 4 else WOOD_D
            if (x - cx) % 3 == 0:
                c = shade(c, 0.9)
            a.put(x, y, c)
    for y in (7, 12):
        a.hline(cx - 8, cx + 7, y, hexc('#3a3638'))
    for k in range(5):
        a.hline(cx - 8 + k * 2, cx + 7 - k * 2, 4 - k, hexc('#6a5644') if k % 2 else hexc('#7c6650'))
    _box(a, cx - 8, 5, cx + 7, 14)
    a.line(cx + 8, 11, cx + 12, 16, hexc('#3a3638'))  # the spout
    a.put(cx + 12, 17, hexc('#7ab0d0'))
    return a


def schoolhouse():
    """The one-room schoolhouse, red, with its bell on the ridge."""
    rng = rng_for('school')
    a = Art(T, T)
    city._grass(a, rng)
    red = hexc('#a8443a')
    x0, x1, y_wall, y_bottom = 4, 26, 15, 27
    for d in (1, 2):
        for y in range(4 + d, y_bottom + d + 1):
            city._darken(a, x1 + d, y)
        for x in range(x0 + d, x1 + d + 1):
            city._darken(a, x, y_bottom + d)
    _roof(a, x0, x1, 4, y_wall - 1, GREY_SHINGLE, rng)
    _box(a, x0, 4, x1, y_wall - 1)
    _clapboard(a, x0, x1, y_wall, y_bottom, red)
    _box(a, x0, y_wall, x1, y_bottom)
    a.rect(13, 1, 4, 4, hexc('#ece6d6'))   # bell cote
    a.put(14, 3, hexc('#c8932a'))
    a.rect(x0 + 3, y_wall + 3, 3, 4, GLASS)
    a.rect(x1 - 6, y_wall + 3, 3, 4, GLASS)
    a.rect(13, y_bottom - 5, 4, 5, hexc('#ece6d6'))
    a.rect(14, y_bottom - 4, 2, 4, DOOR)
    return a


# --- The catalogue ------------------------------------------------------------------

def _spec(sign, wall, trim, roof=SHINGLE, parapet='square', **extra):
    return dict(sign=sign, wall=wall, trim=trim, roof=roof, parapet=parapet, **extra)


PAINT = {
    'oxblood': hexc('#8e3a2c'), 'ochre': hexc('#c8963c'), 'white': hexc('#e2d8c0'),
    'sage': hexc('#8a9a78'), 'wood': hexc('#9a7048'), 'grey': hexc('#9c968a'),
    'brick': hexc('#9a4a36'), 'stone': hexc('#b0a894'), 'adobe': hexc('#d4a070'), 'dusk': hexc('#7e8a92'),
}
CREAM = hexc('#ece4d0')
DARK = hexc('#2e2018')
GOLD = hexc('#ffc933')

# (name, footprint, spec): every downtown false front, each its own business
DOWNTOWN = [
    ('saloon', (2, 1), _spec('SALOON', PAINT['oxblood'], hexc('#ecc878'), parapet='stepped', porch='batwing')),
    ('saloon', (2, 2), _spec('LONG BRANCH/SALOON', PAINT['ochre'], hexc('#6a3a22'), RED_SHINGLE, 'arched',
                             porch='batwing', board=hexc('#6a2a1e'))),
    ('saloon', (1, 1), _spec('BAR', PAINT['wood'], hexc('#ecc878'), parapet='gable', porch='batwing')),
    ('hotel', (2, 2), _spec('GRAND/HOTEL', PAINT['white'], hexc('#5e7e5e'), GREY_SHINGLE, 'stepped',
                            porch='hotel', board=hexc('#4a6a52'), ink=CREAM)),
    ('hotel', (1, 2), _spec('HOTEL', PAINT['sage'], CREAM, RED_SHINGLE, 'arched', porch='hotel')),
    ('bank', (1, 1), _spec('BANK', PAINT['brick'], CREAM, TIN, 'square', material='brick', porch='bank',
                           board=hexc('#1e3a2a'), ink=GOLD, tin=True)),
    ('bank', (2, 1), _spec('CATTLE BANK', PAINT['stone'], hexc('#5e5a56'), GREY_SHINGLE, 'stepped',
                           material='stone', porch='bank', board=hexc('#1e3a2a'), ink=GOLD)),
    ('store', (2, 1), _spec('GENERAL STORE', PAINT['white'], hexc('#8e3a2c'), SHINGLE, 'square', porch='store',
                            board=CREAM, ink=hexc('#6a2a1e'))),
    ('drygoods', (2, 2), _spec('DRY GOODS/& HARDWARE', PAINT['ochre'], hexc('#5a3a22'), TIN, 'gable', porch='store',
                            tin=True)),
    ('jail', (1, 1), _spec('JAIL', PAINT['stone'], hexc('#4a4440'), GREY_SHINGLE, 'square', material='stone',
                           porch='jail', board=hexc('#2a2626'), ink=GOLD)),
    ('sheriff', (1, 2), _spec('SHERIFF', PAINT['wood'], CREAM, SHINGLE, 'stepped', porch='jail', ink=GOLD)),
    ('barber', (1, 1), _spec('BARBER', PAINT['white'], hexc('#b8342a'), GREY_SHINGLE, 'arched', porch='barber',
                             board=hexc('#2f4a7a'), ink=CREAM)),
    ('assay', (1, 1), _spec('ASSAY', PAINT['grey'], DARK, TIN, 'square', porch='plain', tin=True)),
    ('guns', (1, 1), _spec('GUNS', PAINT['oxblood'], CREAM, SHINGLE, 'gable', porch='guns', board=CREAM, ink=DARK)),
    ('post', (1, 1), _spec('POST', PAINT['dusk'], CREAM, GREY_SHINGLE, 'stepped', porch='plain', board=CREAM,
                           ink=hexc('#2f4a7a'))),
    ('undertaker', (1, 1), _spec('COFFINS', PAINT['grey'], DARK, SHINGLE, 'gable', porch='coffins',
                                 board=hexc('#1a1414'), ink=CREAM)),
    ('gazette', (1, 2), _spec('GAZETTE', PAINT['white'], DARK, GREY_SHINGLE, 'square', porch='plain', board=DARK,
                              ink=CREAM)),
    ('opera', (2, 2), _spec('OPERA/HOUSE', PAINT['brick'], CREAM, RED_SHINGLE, 'arched', material='brick',
                            porch='hotel', board=hexc('#5a2a4a'), ink=GOLD)),
    ('cafe', (2, 1), _spec('EATS & BEDS', PAINT['sage'], hexc('#5a3a22'), SHINGLE, 'gable', porch='plain')),
    ('drugs', (1, 1), _spec('DRUGS', PAINT['ochre'], DARK, SHINGLE, 'square', porch='store')),
]

# The trades, a block back from Main Street
COMMERCIAL = [
    ('smithy', (1, 1), _spec('SMITH', PAINT['stone'], hexc('#4a4440'), TIN, 'flat', material='stone',
                             porch='smithy', tin=True, ink=hexc('#e8743c'))),
    ('smithy', (2, 1), _spec('BLACKSMITH', PAINT['wood'], hexc('#3a3638'), TIN, 'square', porch='smithy',
                             tin=True, ink=hexc('#e8743c'))),
    ('livery', (2, 1), _spec('LIVERY', hexc('#9c3428'), CREAM, SHINGLE, 'gable', porch='livery', board=CREAM,
                             ink=hexc('#9c3428'))),
    ('livery', (2, 2), _spec('LIVERY/STABLE', hexc('#8a4a2e'), CREAM, GREY_SHINGLE, 'gable', porch='livery')),
    ('feed', (1, 1), _spec('FEED', PAINT['wood'], hexc('#f0d890'), SHINGLE, 'flat', porch='store')),
    ('feed', (2, 1), _spec('FEED & SEED', PAINT['ochre'], hexc('#6a4426'), SHINGLE, 'stepped', porch='store')),
    ('laundry', (1, 1), _spec('LAUNDRY', PAINT['white'], hexc('#5a7a8a'), GREY_SHINGLE, 'flat', porch='plain',
                              board=hexc('#5a7a8a'), ink=CREAM)),
    ('saddler', (1, 2), _spec('SADDLES', PAINT['wood'], hexc('#ecc878'), SHINGLE, 'arched', porch='store')),
    ('bakery', (1, 1), _spec('BAKERY', PAINT['adobe'], hexc('#6a3a22'), RED_SHINGLE, 'arched', porch='plain',
                             board=CREAM, ink=hexc('#6a3a22'))),
    ('cooper', (1, 1), _spec('COOPER', PAINT['wood'], CREAM, SHINGLE, 'gable', porch='store')),
    ('harness', (1, 1), _spec('HARNESS', PAINT['oxblood'], hexc('#ecc878'), GREY_SHINGLE, 'square', porch='store')),
    ('hay', (2, 1), _spec('HAY & GRAIN', PAINT['ochre'], hexc('#5a3a22'), SHINGLE, 'gable', porch='livery',
                          board=CREAM, ink=hexc('#5a3a22'))),
    ('wagonworks', (2, 1), _spec('WAGON WORKS', PAINT['grey'], hexc('#3a2a20'), TIN, 'square', porch='livery',
                                 tin=True)),
    ('tinsmith', (1, 1), _spec('TINWARE', PAINT['dusk'], CREAM, TIN, 'flat', porch='plain', tin=True)),
    ('boots', (1, 1), _spec('BOOTS', PAINT['wood'], hexc('#ecc878'), RED_SHINGLE, 'stepped', porch='plain')),
    ('doctor', (1, 1), _spec('DOCTOR', PAINT['white'], hexc('#2f4a7a'), GREY_SHINGLE, 'gable', porch='plain',
                             board=CREAM, ink=hexc('#2f4a7a'))),
    ('dentist', (1, 1), _spec('DENTIST', PAINT['sage'], CREAM, SHINGLE, 'square', porch='plain')),
    ('land', (2, 1), _spec('LAND OFFICE', PAINT['stone'], hexc('#4a4440'), GREY_SHINGLE, 'stepped',
                           material='stone', porch='bank', board=hexc('#1e3a2a'), ink=CREAM)),
    ('stage', (2, 1), _spec('STAGE LINE', PAINT['oxblood'], hexc('#ecc878'), RED_SHINGLE, 'arched', porch='plain',
                            board=hexc('#2e2018'), ink=hexc('#ffc933'))),
    ('baths', (1, 1), _spec('BATHS', PAINT['white'], hexc('#5a7a8a'), GREY_SHINGLE, 'arched', porch='plain',
                            board=hexc('#5a7a8a'), ink=CREAM)),
    ('tailor', (1, 1), _spec('TAILOR', PAINT['dusk'], CREAM, SHINGLE, 'stepped', porch='plain', board=CREAM,
                             ink=hexc('#2e2018'))),
    ('tools', (1, 2), _spec('TOOLS', PAINT['wood'], CREAM, TIN, 'square', porch='store', tin=True)),
    ('rooms', (1, 2), _spec('ROOMS', PAINT['white'], hexc('#8e3a2c'), RED_SHINGLE, 'gable', porch='hotel')),
    ('mercantile', (2, 2), _spec('MERCANTILE', PAINT['ochre'], hexc('#5a3a22'), GREY_SHINGLE, 'stepped',
                                 porch='store')),
]
