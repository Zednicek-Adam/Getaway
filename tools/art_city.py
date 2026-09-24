"""City tileset: autotiled roads + multi-tile city-block pieces (3/4 view)."""
from pixelkit import Art, hexc, shade, mix, noise_fill, rng_for, with_alpha

T = 32  # art pixels per map tile (exported at 2x -> 64px, the game's TILE_SIZE)

# --- Palette ----------------------------------------------------------------
OUTLINE = hexc('#161821')
ASPH = hexc('#454852')
ASPH_D = hexc('#3e414b')
ASPH_L = hexc('#4d505b')
GUTTER = hexc('#33353e')
CURB_TOP = hexc('#c3c6cc')
CURB_FACE = hexc('#8b9098')
MARK = hexc('#ece6cf')
MARK_WORN = hexc('#b9b5a6')
MANHOLE = hexc('#2f3139')
MANHOLE_L = hexc('#5a5d68')
OIL = hexc('#30323a')

PAVE = hexc('#a9adb3')
PAVE_J = hexc('#979ba2')
PAVE_L = hexc('#b6babf')
SHADOW = (18, 20, 34, 80)

GRASS = hexc('#5c9e46')
GRASS_D = hexc('#4f8c3d')
GRASS_L = hexc('#6cb052')
TUFT = hexc('#437a35')
LEAF_O = hexc('#1d3f26')
LEAF_D = hexc('#2c6a35')
LEAF = hexc('#3b8a3f')
LEAF_L = hexc('#5cae4a')
LEAF_H = hexc('#86cc62')
DIRT = hexc('#c9b389')
DIRT_D = hexc('#b39d74')
WATER = hexc('#3b7cc4')
WATER_D = hexc('#2d62a6')
WATER_L = hexc('#7bb8ea')
SAND = hexc('#dcc88f')

GLASS = hexc('#2c3f5e')
GLASS_L = hexc('#6f9fcf')
LIT = hexc('#ffd66b')
LIT_L = hexc('#fff0b0')

BUILDING_STYLES = [
    # wall, roof, rim
    dict(name='brick', wall=hexc('#a4503f'), roof=hexc('#62646f'), rim=hexc('#8f929b')),
    dict(name='concrete', wall=hexc('#9ca5b0'), roof=hexc('#737a85'), rim=hexc('#bcc3cb')),
    dict(name='sand', wall=hexc('#cfa971'), roof=hexc('#8e7a61'), rim=hexc('#e2c797')),
    dict(name='teal', wall=hexc('#44858b'), roof=hexc('#4e5968'), rim=hexc('#72abb0')),
    dict(name='office', wall=hexc('#40608a'), roof=hexc('#343f53'), rim=hexc('#7189ab'), glassy=True),
    dict(name='rose', wall=hexc('#cf8f8b'), roof=hexc('#6f5f70'), rim=hexc('#e2b1ad')),
    dict(name='olive', wall=hexc('#8a8a5a'), roof=hexc('#5d5a4e'), rim=hexc('#adad7c')),
]
AWNINGS = [(hexc('#d8433b'), hexc('#f2ece0')), (hexc('#2f7fc1'), hexc('#f2ece0')),
           (hexc('#3e9a4a'), hexc('#f2ece0')), (hexc('#e0a526'), hexc('#5b3a1e'))]

CIV_COLOURS = ['#3d7fd1', '#e0c040', '#58a85c', '#8f5bc4', '#e8e8ea', '#2b2e38', '#d98236', '#7fb8c7']

U, R, D, L = 1, 2, 4, 8
C_UR, C_DR, C_DL, C_UL = 1, 2, 4, 8


# --- Roads ----------------------------------------------------------------------

def road_combos():
    """Every (mask, corners) pair that can appear on the map (47 blob tiles).

    A corner bit is only meaningful when both orthogonal neighbours around
    that corner are road (it marks the diagonal as *not* road, i.e. a curb nub
    is needed there).
    """
    need = {C_UR: U | R, C_DR: D | R, C_DL: D | L, C_UL: U | L}
    out = []
    for mask in range(16):
        possible = [c for c, n in need.items() if mask & n == n]
        for sub in range(1 << len(possible)):
            corners = 0
            for i, c in enumerate(possible):
                if sub & (1 << i):
                    corners |= c
            out.append((mask, corners))
    return out


def _asphalt(a, rng):
    noise_fill(a, 0, 0, T, T, [(ASPH, 78), (ASPH_D, 12), (ASPH_L, 10)], rng)


def _curb_edge(a, side):
    """3px curb band along one tile edge: top highlight, curb face, gutter."""
    for i in range(T):
        for depth, c in enumerate((CURB_TOP, CURB_FACE, GUTTER)):
            if side == U:
                a.set(i, depth, c)
            elif side == D:
                a.set(i, T - 1 - depth, c)
            elif side == L:
                a.set(depth, i, c)
            elif side == R:
                a.set(T - 1 - depth, i, c)


def _curb_nub(a, corner):
    # Rounded inner-corner curb (diagonal neighbour is not road)
    for j in range(4):
        for i in range(4):
            d = i + j
            c = CURB_TOP if d <= 1 else CURB_FACE if d == 2 else GUTTER if d == 3 else None
            if c is None:
                continue
            x = T - 1 - i if corner in (C_UR, C_DR) else i
            y = j if corner in (C_UR, C_UL) else T - 1 - j
            a.put(x, y, c)


def _dash_v(a, y0, y1):
    for y in range(y0, y1 + 1):
        a.put(15, y, MARK)
        a.put(16, y, MARK_WORN if y % 5 == 0 else MARK)


def _dash_h(a, x0, x1):
    for x in range(x0, x1 + 1):
        a.put(x, 15, MARK)
        a.put(x, 16, MARK_WORN if x % 5 == 0 else MARK)


def _crosswalk(a, side):
    # Zebra bars on a connected edge of an intersection
    for k in range(5):
        p = 5 + k * 5
        for w in range(3):
            for depth in range(1, 6):
                c = MARK if (p + w + depth) % 7 else MARK_WORN
                if side == U:
                    a.put(p + w, depth, c)
                elif side == D:
                    a.put(p + w, T - 1 - depth, c)
                elif side == L:
                    a.put(depth, p + w, c)
                elif side == R:
                    a.put(T - 1 - depth, p + w, c)


def road_tile(mask, corners, variant):
    rng = rng_for('road', mask, corners, variant)
    a = Art(T, T)
    _asphalt(a, rng)

    n = bin(mask).count('1')
    vertical = mask & (U | D) == (U | D) and n == 2
    horizontal = mask & (L | R) == (L | R) and n == 2

    # Wear decals on variants (drawn under markings)
    if variant == 1:
        cx, cy = (8, 24) if vertical else (24, 8) if horizontal else (24, 24)
        a.disc(cx, cy, 3.2, MANHOLE)
        a.disc(cx, cy, 2.2, MANHOLE_L)
        a.hline(cx - 2, cx + 1, cy - 1, MANHOLE)
        a.hline(cx - 2, cx + 1, cy + 1, MANHOLE)
    elif variant == 2:
        # Oil stain: a soft irregular blob
        cx, cy = (22, 9) if vertical else (9, 22)
        a.ellipse(cx, cy, 3.5, 2.5, OIL)
        for _ in range(8):
            a.set(cx + rng.randint(-4, 4), cy + rng.randint(-3, 3), OIL)
        a.set(cx - 1, cy - 1, ASPH_L)

    # Lane markings
    if n == 2 and vertical:
        _dash_v(a, 4, 11)
        _dash_v(a, 20, 27)
    elif n == 2 and horizontal:
        _dash_h(a, 4, 11)
        _dash_h(a, 20, 27)
    elif n <= 2:
        # Bends and dead ends: dashes only on the connected halves
        if mask & U:
            _dash_v(a, 4, 11)
        if mask & D:
            _dash_v(a, 20, 27)
        if mask & L:
            _dash_h(a, 4, 11)
        if mask & R:
            _dash_h(a, 20, 27)
    elif n == 4:
        # Zebra crossings on full crossroads only; T-junctions stay clean so
        # the street grid doesn't turn to noise
        for side in (U, R, D, L):
            _crosswalk(a, side)

    for side in (U, R, D, L):
        if not mask & side:
            _curb_edge(a, side)
    for c in (C_UR, C_DR, C_DL, C_UL):
        if corners & c:
            _curb_nub(a, c)
    return a


# --- Lots --------------------------------------------------------------------------

M = 3  # pavement margin around every lot


def _pavement(a, rng, x0=0, y0=0, w=None, h=None):
    w = w if w is not None else a.w
    h = h if h is not None else a.h
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if x % 8 == 7 or y % 8 == 7:
                c = PAVE_J
            else:
                r = rng.random()
                c = PAVE_L if r < 0.07 else PAVE_J if r < 0.1 else PAVE
            a.set(x, y, c)


def _darken(a, x, y, f=0.72):
    if a.inside(x, y):
        a.put(x, y, shade(a.get(x, y), f))


def _cast_shadow(a, x0, y0, x1, y1, depth=2):
    """Shadow of a box (inclusive coords) cast to the lower right."""
    for d in range(1, depth + 1):
        for y in range(y0 + d + 1, y1 + d + 1):
            _darken(a, x1 + d, y)
        for x in range(x0 + d + 1, x1 + d + 1):
            _darken(a, x, y1 + d)


def _ac_unit(a, x, y):
    a.rect(x, y, 5, 4, hexc('#c7ccd4'))
    a.hline(x, x + 4, y, hexc('#e9ecf0'))
    a.hline(x, x + 4, y + 3, hexc('#8a8f99'))
    a.set(x + 2, y + 1, hexc('#3b404b'))
    a.set(x + 2, y + 2, hexc('#3b404b'))
    a.set(x + 1, y + 1, hexc('#6b707b'))
    a.set(x + 3, y + 2, hexc('#6b707b'))
    _cast_shadow(a, x, y, x + 4, y + 3, 1)


def _vent(a, x, y):
    a.rect(x, y, 2, 2, hexc('#7a7f8a'))
    a.set(x, y, hexc('#a2a7b0'))
    a.set(x + 1, y + 1, hexc('#3b404b'))
    _cast_shadow(a, x, y, x + 1, y + 1, 1)


def _skylight(a, x, y, w=6, h=4):
    a.rect(x, y, w, h, hexc('#9ea5ae'))
    a.rect(x + 1, y + 1, w - 2, h - 2, GLASS)
    for i in range(min(w, h) - 2):
        a.set(x + 1 + i + 1, y + 1 + i, GLASS_L)


def _water_tank(a, cx, cy):
    a.disc(cx + 1.5, cy + 1.5, 4.5, SHADOW)
    a.disc(cx, cy, 4.5, hexc('#6e4630'))
    a.disc(cx, cy, 3.5, hexc('#8f5c3c'))
    a.disc(cx - 0.8, cy - 0.8, 1.6, hexc('#b27a52'))
    a.set(int(cx), int(cy), hexc('#5a3824'))


def _helipad(a, cx, cy):
    a.disc(cx, cy, 9, hexc('#3b3f4a'))
    a.disc(cx, cy, 8, hexc('#e8c547'))
    a.disc(cx, cy, 7, hexc('#3b3f4a'))
    x, y = int(cx) - 3, int(cy) - 3
    a.grid(x - 0, y, ['#...#', '#...#', '#####', '#...#', '#...#'], {'#': hexc('#f2f2f2')})


def _solar(a, x, y, cols, rows):
    for j in range(rows):
        for i in range(cols):
            px, py = x + i * 5, y + j * 4
            a.rect(px, py, 4, 3, hexc('#2b4a7a'))
            a.set(px, py, hexc('#5a82b8'))
            a.set(px + 3, py + 2, hexc('#1f3558'))
    _cast_shadow(a, x, y, x + cols * 5 - 2, y + rows * 4 - 2, 1)


def _access_hut(a, x, y, wall, roof):
    # A little stair-access box: roof on top, facade with a door below
    a.rect(x, y, 6, 3, shade(roof, 1.25))
    a.hline(x, x + 5, y, shade(roof, 1.45))
    a.rect(x, y + 3, 6, 3, wall)
    a.rect(x + 2, y + 3, 2, 3, hexc('#3a2a24'))
    _cast_shadow(a, x, y, x + 5, y + 5, 1)


def building_piece(tw, th, style, variant):
    """A building on a tw x th tile lot, drawn in 3/4 view."""
    rng = rng_for('bldg', tw, th, style['name'], variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    _pavement(a, rng)

    wall = style['wall']
    roof = style['roof']
    rim = style['rim']
    x0, y0, x1, y1 = M, M - 1, w - M - 1, h - M - 2
    facade_h = 7 if th == 1 else 10
    fy = y1 - facade_h + 1  # first facade row

    # Ground shadow first so the building sits on it
    _cast_shadow(a, x0, y0, x1, y1, 2)

    # Facade
    a.rect(x0, fy, x1 - x0 + 1, facade_h, wall)
    a.hline(x0, x1, fy, shade(wall, 0.78))                 # cornice shadow
    a.hline(x0, x1, y1, shade(wall, 0.62))                 # ground line
    a.vline(x0, fy, y1, shade(wall, 1.12))                 # lit left edge
    a.vline(x1, fy, y1, shade(wall, 0.8))

    glassy = style.get('glassy')
    storeys = [fy + 2] if facade_h == 7 else [fy + 2, fy + 5]
    shop = th > 1 and not glassy and rng.random() < 0.55
    for si, wy in enumerate(storeys):
        if shop and si == len(storeys) - 1:
            break
        step = 3 if glassy else 4
        wx = x0 + 2
        while wx + 1 < x1 - 1:
            lit = rng.random() < 0.18
            c = LIT if lit else GLASS
            a.rect(wx, wy, 2, 2, c)
            a.set(wx, wy, LIT_L if lit else GLASS_L)
            if glassy:
                a.set(wx + 2, wy, shade(wall, 0.8))
                a.set(wx + 2, wy + 1, shade(wall, 0.8))
            wx += step
    if shop:
        # Street-level shop with a striped awning
        awn, awn2 = AWNINGS[rng.randrange(len(AWNINGS))]
        ay = y1 - 4
        for x in range(x0 + 1, x1):
            c = awn if ((x - x0) // 2) % 2 == 0 else awn2
            a.set(x, ay, c)
            a.set(x, ay + 1, shade(c, 0.85))
        a.rect(x0 + 2, ay + 2, x1 - x0 - 3, 2, GLASS)
        for x in range(x0 + 3, x1 - 1, 5):
            a.set(x, ay + 2, GLASS_L)
    else:
        # Door, centred
        dx = (x0 + x1) // 2 - 1
        a.rect(dx, y1 - 3, 3, 3, hexc('#3a2a24'))
        a.set(dx + 1, y1 - 3, hexc('#5a4234'))

    # Roof
    ry0, ry1 = y0, fy - 1
    a.rect(x0, ry0, x1 - x0 + 1, ry1 - ry0 + 1, roof)
    noise_fill(a, x0 + 1, ry0 + 1, x1 - x0 - 1, ry1 - ry0 - 1,
               [(roof, 20), (shade(roof, 0.94), 3), (shade(roof, 1.06), 2)], rng)
    # Parapet: bevelled rim, recessed inner shadow
    a.hline(x0, x1, ry0, shade(rim, 1.1))
    a.vline(x0, ry0, ry1, shade(rim, 1.05))
    a.hline(x0, x1, ry1, shade(rim, 0.82))
    a.vline(x1, ry0, ry1, shade(rim, 0.86))
    a.hline(x0 + 1, x1 - 1, ry0 + 1, shade(roof, 0.8))
    a.vline(x0 + 1, ry0 + 1, ry1 - 1, shade(roof, 0.84))

    # Rooftop furniture
    ix0, iy0, ix1, iy1 = x0 + 3, ry0 + 3, x1 - 3, ry1 - 2
    iw, ih = ix1 - ix0, iy1 - iy0
    roll = rng.random()
    big = tw * th >= 4
    wide = tw * th == 2
    if big and roll < 0.15:
        _helipad(a, (x0 + x1 + 1) / 2, (ry0 + ry1 + 1) / 2)
        _vent(a, ix0, iy0)
        _vent(a, ix1 - 1, iy0)
    elif (big or wide) and roll > 0.78:
        _solar(a, ix0, iy0, max(1, iw // 5), max(1, ih // 4))
    else:
        slots = []
        for _ in range(3 + tw * th * 2):
            sx, sy = rng.randint(ix0, max(ix0, ix1 - 6)), rng.randint(iy0, max(iy0, iy1 - 5))
            if all(abs(sx - px) > 6 or abs(sy - py) > 5 for px, py in slots):
                slots.append((sx, sy))
        for i, (sx, sy) in enumerate(slots):
            pick = rng.random()
            if i == 0 and tw * th >= 2:
                _water_tank(a, sx + 3, sy + 3)
            elif pick < 0.35:
                _ac_unit(a, sx, sy)
            elif pick < 0.55 and sx + 6 <= ix1 and sy + 6 <= iy1 + 2:
                _access_hut(a, sx, sy, wall, roof)
            elif pick < 0.75:
                _skylight(a, sx, sy)
            else:
                _vent(a, sx + 1, sy + 1)

    # Crisp silhouette: dark line around the whole block
    for x in range(x0 - 1, x1 + 2):
        a.put(x, y0 - 1, OUTLINE) if y0 - 1 >= 0 else None
        a.put(x, y1 + 1, OUTLINE)
    for y in range(y0, y1 + 1):
        a.put(x0 - 1, y, OUTLINE)
        a.put(x1 + 1, y, OUTLINE)
    return a


def draw_tree(a, cx, cy, r, rng):
    a.ellipse(cx + 2, cy + 2.5, r, r * 0.85, SHADOW)
    a.disc(cx, cy, r + 1, LEAF_O)
    a.disc(cx, cy, r, LEAF_D)
    a.disc(cx - 0.6, cy - 0.6, r - 1, LEAF)
    a.disc(cx - r * 0.35, cy - r * 0.35, r * 0.45, LEAF_L)
    a.set(int(cx - r * 0.45), int(cy - r * 0.5), LEAF_H)
    for _ in range(int(r * 2)):
        ang_x = rng.uniform(-r + 1, r - 1)
        ang_y = rng.uniform(-r + 1, r - 1)
        if ang_x ** 2 + ang_y ** 2 < (r - 1) ** 2:
            a.set(int(cx + ang_x), int(cy + ang_y), LEAF_D if ang_x + ang_y > 0 else LEAF_L)


def _grass(a, rng, x0, y0, w, h):
    noise_fill(a, x0, y0, w, h, [(GRASS, 70), (GRASS_D, 18), (GRASS_L, 12)], rng)
    for _ in range(w * h // 40):
        x, y = x0 + rng.randint(1, w - 2), y0 + rng.randint(1, h - 2)
        a.set(x, y, TUFT)
        a.set(x - 1, y - 1, TUFT)
        a.set(x + 1, y - 1, TUFT)


def park_piece(tw, th, variant):
    rng = rng_for('park', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    _pavement(a, rng)
    gx0, gy0, gx1, gy1 = M, M, w - M - 1, h - M - 1
    # Low hedge/kerb frame
    a.rect(gx0, gy0, gx1 - gx0 + 1, gy1 - gy0 + 1, hexc('#7d8288'))
    _grass(a, rng, gx0 + 1, gy0 + 1, gx1 - gx0 - 1, gy1 - gy0 - 1)

    if tw == 2 and th == 2 and variant % 2 == 0:
        # Pond with a sandy shore
        cx, cy = w / 2, h / 2 + 1
        a.ellipse(cx, cy, 19, 14, SAND)
        a.ellipse(cx, cy, 17, 12, WATER_D)
        a.ellipse(cx - 1, cy - 1, 15, 10, WATER)
        for i in range(6):
            a.hline(int(cx - 8 + i * 3), int(cx - 6 + i * 3), int(cy - 5 + (i % 3) * 4), WATER_L)
        for (px, py) in [(cx + 6, cy + 3), (cx - 9, cy + 4)]:
            a.disc(px, py, 1.8, hexc('#4f9a43'))
            a.set(int(px), int(py) - 1, hexc('#f2a2c2'))
        for (tx, ty, tr) in [(9, 10, 5), (w - 10, 11, 6), (10, h - 10, 5), (w - 9, h - 9, 4)]:
            draw_tree(a, tx, ty, tr, rng)
    elif tw == 2 and th == 2:
        # Crossing paths with a fountain in the middle
        a.rect(w // 2 - 2, gy0 + 1, 4, gy1 - gy0 - 1, DIRT)
        a.rect(gx0 + 1, h // 2 - 2, gx1 - gx0 - 1, 4, DIRT)
        cx, cy = w / 2, h / 2
        a.disc(cx, cy, 7, hexc('#8f949c'))
        a.disc(cx, cy, 6, hexc('#b8bdc4'))
        a.disc(cx, cy, 5, WATER)
        a.disc(cx - 1, cy - 1, 2, WATER_L)
        a.set(int(cx), int(cy), hexc('#ffffff'))
        for (tx, ty) in [(12, 12), (w - 12, 12), (12, h - 12), (w - 12, h - 12)]:
            draw_tree(a, tx, ty, 6, rng)
    else:
        # Scattered trees, bushes and flowers
        if rng.random() < 0.5:
            if w >= h:
                a.rect(gx0 + 1, h // 2 - 1, gx1 - gx0 - 1, 3, DIRT)
                a.hline(gx0 + 1, gx1 - 1, h // 2 + 1, DIRT_D)
            else:
                a.rect(w // 2 - 1, gy0 + 1, 3, gy1 - gy0 - 1, DIRT)
                a.vline(w // 2 + 1, gy0 + 1, gy1 - 1, DIRT_D)
        for _ in range(tw * th * 5):
            fx, fy = rng.randint(gx0 + 2, gx1 - 2), rng.randint(gy0 + 2, gy1 - 2)
            a.set(fx, fy, rng.choice([hexc('#f5d547'), hexc('#f2f2f2'), hexc('#f07ab0')]))
        trees = tw * th * 2 + rng.randint(-1, 1)
        placed = []
        for _ in range(40):
            if len(placed) >= trees:
                break
            r = rng.choice((4, 5, 5, 6))
            tx = rng.randint(gx0 + r + 1, gx1 - r - 2)
            ty = rng.randint(gy0 + r + 1, gy1 - r - 2)
            if all((tx - px) ** 2 + (ty - py) ** 2 > (r + pr) ** 2 * 0.8 for px, py, pr in placed):
                placed.append((tx, ty, r))
        for tx, ty, r in sorted(placed, key=lambda p: p[1]):
            draw_tree(a, tx, ty, r, rng)
    return a


def civ_car_top(rng, colour=None, facing_up=True):
    """Small parked civilian car (9 x 16), facing up or down."""
    body = hexc(colour or rng.choice(CIV_COLOURS))
    c = Art(11, 18)
    c.rect(1, 1, 9, 16, body)
    c.vline(1, 1, 16, shade(body, 1.18))
    c.vline(9, 1, 16, shade(body, 0.78))
    c.rect(2, 5, 7, 3, GLASS)
    c.hline(3, 7, 5, GLASS_L)
    c.rect(2, 12, 7, 2, GLASS)
    c.rect(2, 8, 7, 4, shade(body, 1.08))
    c.set(2, 1, hexc('#fff4b0'))
    c.set(8, 1, hexc('#fff4b0'))
    c.set(2, 16, hexc('#ff4b4b'))
    c.set(8, 16, hexc('#ff4b4b'))
    for (x, y) in [(1, 1), (9, 1), (1, 16), (9, 16)]:
        c.put(x, y, (0, 0, 0, 0))
    c.outline(OUTLINE)
    return c if facing_up else c.rotated(2)


def parking_piece(tw, th, variant):
    rng = rng_for('parking', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    _pavement(a, rng)
    x0, y0, x1, y1 = M, M, w - M - 1, h - M - 1
    a.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, hexc('#4b4e58'))
    noise_fill(a, x0 + 1, y0 + 1, x1 - x0 - 1, y1 - y0 - 1,
               [(hexc('#4b4e58'), 20), (hexc('#44474f'), 4), (hexc('#53565f'), 3)], rng)
    a.hline(x0, x1, y0, CURB_FACE)
    a.vline(x0, y0, y1, CURB_FACE)
    stall = 13
    rows = 1 if th == 1 else 2
    row_h = (y1 - y0 - 1) // rows
    for r in range(rows):
        ry = y0 + 1 + r * row_h
        for sx in range(x0 + 2, x1 - stall + 2, stall):
            a.vline(sx, ry + 1, ry + row_h - 2, MARK_WORN)
            if rng.random() < 0.72:
                car = civ_car_top(rng, facing_up=(r % 2 == 0))
                a.blit(car, sx + 1, ry + (row_h - 18) // 2)
            elif rng.random() < 0.5:
                a.set(sx + 6, ry + row_h // 2, OIL)
                a.set(sx + 7, ry + row_h // 2 + 1, OIL)
        a.vline(x1 - 2, ry + 1, ry + row_h - 2, MARK_WORN)
    return a


def plaza_piece(tw, th, variant):
    rng = rng_for('plaza', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    stone_a, stone_b = hexc('#c2ad8e'), hexc('#b09a7b')
    for y in range(h):
        for x in range(w):
            c = stone_a if ((x // 4) + (y // 4)) % 2 == 0 else stone_b
            if rng.random() < 0.05:
                c = shade(c, 0.93)
            a.set(x, y, c)
    for x in range(w):
        a.set(x, 0, PAVE_J)
        a.set(x, h - 1, PAVE_J)
    for y in range(h):
        a.set(0, y, PAVE_J)
        a.set(w - 1, y, PAVE_J)
    cx, cy = w / 2, h / 2
    if variant % 2 == 0:
        # Round planter with a tree
        a.disc(cx, cy + 1, 8, hexc('#7d8288'))
        a.disc(cx, cy + 1, 7, hexc('#6b4e36'))
        draw_tree(a, cx, cy, 6, rng)
    else:
        # Statue on a plinth
        a.rect(int(cx) - 5, int(cy) - 3, 10, 9, hexc('#8f949c'))
        a.rect(int(cx) - 4, int(cy) - 2, 8, 7, hexc('#b8bdc4'))
        a.disc(cx, cy - 3, 2.5, hexc('#5f8f7c'))
        a.rect(int(cx) - 2, int(cy) - 2, 4, 5, hexc('#4f7f6c'))
        a.set(int(cx) - 1, int(cy) - 5, hexc('#8fc0a8'))
        _cast_shadow(a, int(cx) - 5, int(cy) - 3, int(cx) + 4, int(cy) + 5, 2)
    # Benches
    for bx in (4, w - 10):
        a.rect(bx, h - 7, 6, 2, hexc('#8a5a3a'))
        a.hline(bx, bx + 5, h - 7, hexc('#b27a52'))
    return a


def pavement_piece():
    rng = rng_for('pavement')
    a = Art(T, T)
    _pavement(a, rng)
    return a


def city_pieces():
    """[(name, kind, tw, th, Art)] — every multi-tile lot piece."""
    pieces = []
    for si, style in enumerate(BUILDING_STYLES):
        for v in range(2):
            pieces.append((f'bldg_1x1_{style["name"]}_{v}', 'building', 1, 1,
                           building_piece(1, 1, style, v + si)))
        pieces.append((f'bldg_2x1_{style["name"]}', 'building', 2, 1, building_piece(2, 1, style, si)))
        pieces.append((f'bldg_1x2_{style["name"]}', 'building', 1, 2, building_piece(1, 2, style, si + 1)))
        pieces.append((f'bldg_2x2_{style["name"]}', 'building', 2, 2, building_piece(2, 2, style, si)))
    for v in range(4):
        pieces.append((f'park_1x1_{v}', 'park', 1, 1, park_piece(1, 1, v)))
    pieces.append(('park_2x1_0', 'park', 2, 1, park_piece(2, 1, 0)))
    pieces.append(('park_1x2_0', 'park', 1, 2, park_piece(1, 2, 0)))
    for v in range(2):
        pieces.append((f'park_2x2_{v}', 'park', 2, 2, park_piece(2, 2, v)))
    for v in range(5):
        pieces.append((f'parking_2x1_{v}', 'parking', 2, 1, parking_piece(2, 1, v)))
    for v in range(3):
        pieces.append((f'parking_2x2_{v}', 'parking', 2, 2, parking_piece(2, 2, v)))
    for v in range(2):
        pieces.append((f'plaza_1x1_{v}', 'plaza', 1, 1, plaza_piece(1, 1, v)))
    return pieces


def build_city_tiles():
    """Returns (tiles: [Art 32x32], manifest dict)."""
    tiles = []
    roads = {}
    for mask, corners in road_combos():
        n = bin(mask).count('1')
        straight = n == 2 and mask in (U | D, L | R)
        variants = 3 if straight else 1
        idx = []
        for v in range(variants):
            idx.append(len(tiles))
            tiles.append(road_tile(mask, corners, v))
        roads[f'{mask},{corners}'] = idx

    pieces = []
    for name, kind, tw, th, art in city_pieces():
        ids = []
        for ty in range(th):
            for tx in range(tw):
                tile = Art(T, T)
                tile.blit(art.im.crop((tx * T, ty * T, tx * T + T, ty * T + T)), 0, 0)
                ids.append(len(tiles))
                tiles.append(tile)
        pieces.append({'name': name, 'kind': kind, 'w': tw, 'h': th, 'tiles': ids})

    pavement = len(tiles)
    tiles.append(pavement_piece())
    return tiles, {'roads': roads, 'pieces': pieces, 'pavement': pavement}
