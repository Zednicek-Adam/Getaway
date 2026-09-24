"""City tileset: autotiled streets with sidewalks + zoned city-block pieces.

Streets own their sidewalks (drawn on the road tile's edges that face a
block), so lots can be packed wall to wall like a real city block. Every lot
piece belongs to a district zone — downtown, commercial, residential,
industrial or park — and src/cityLayout.js zones whole blocks at a time.
"""
from pixelkit import Art, hexc, shade, noise_fill, rng_for

T = 32  # art pixels per map tile (exported at 2x -> 64px, the game's TILE_SIZE)

# --- Palette ----------------------------------------------------------------
OUTLINE = hexc('#161821')
ASPH = hexc('#454852')
ASPH_D = hexc('#3e414b')
ASPH_L = hexc('#4d505b')
GUTTER = hexc('#34363e')
CURB_TOP = hexc('#d0d3d8')
MARK = hexc('#ece6cf')
MARK_WORN = hexc('#b9b5a6')
MANHOLE = hexc('#2f3139')
MANHOLE_L = hexc('#5a5d68')
OIL = hexc('#30323a')

WALK = hexc('#b1b4b9')      # sidewalk slabs
WALK_J = hexc('#9ea2a8')
WALK_L = hexc('#bdc0c5')
GROUND = hexc('#8d9096')    # alley / service concrete inside blocks
GROUND_D = hexc('#83868c')
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
POOL = hexc('#4fb6e0')
POOL_L = hexc('#a8e4f6')

GLASS = hexc('#2c3f5e')
GLASS_L = hexc('#6f9fcf')
LIT = hexc('#ffd66b')
LIT_L = hexc('#fff0b0')
DOOR = hexc('#3a2a24')

DOWNTOWN_STYLES = [
    dict(name='blueglass', wall=hexc('#3d5f8f'), roof=hexc('#2f3a4c'), rim=hexc('#7189ab'), glassy=True),
    dict(name='tealglass', wall=hexc('#2f6f78'), roof=hexc('#334350'), rim=hexc('#6aa0a6'), glassy=True),
    dict(name='concrete', wall=hexc('#a3abb5'), roof=hexc('#737a85'), rim=hexc('#c3c9d0')),
    dict(name='granite', wall=hexc('#5e5a66'), roof=hexc('#3f3d48'), rim=hexc('#8a8694')),
    dict(name='sandstone', wall=hexc('#c8b089'), roof=hexc('#7d6d58'), rim=hexc('#dcc9a3')),
]
COMMERCIAL_STYLES = [
    dict(name='brick', wall=hexc('#a4503f'), roof=hexc('#62646f'), rim=hexc('#8f929b')),
    dict(name='sand', wall=hexc('#cfa971'), roof=hexc('#8e7a61'), rim=hexc('#e2c797')),
    dict(name='rose', wall=hexc('#cf8f8b'), roof=hexc('#6f5f70'), rim=hexc('#e2b1ad')),
    dict(name='olive', wall=hexc('#8a8a5a'), roof=hexc('#5d5a4e'), rim=hexc('#adad7c')),
    dict(name='cream', wall=hexc('#d8cdb0'), roof=hexc('#6d6a63'), rim=hexc('#e8dfc6')),
    dict(name='teal', wall=hexc('#44858b'), roof=hexc('#4e5968'), rim=hexc('#72abb0')),
]
AWNINGS = [(hexc('#d8433b'), hexc('#f2ece0')), (hexc('#2f7fc1'), hexc('#f2ece0')),
           (hexc('#3e9a4a'), hexc('#f2ece0')), (hexc('#e0a526'), hexc('#5b3a1e'))]
HOUSE_WALLS = [hexc('#efe6d2'), hexc('#d9e4ec'), hexc('#f0dca0'), hexc('#e8c9b6'), hexc('#c9d9c0'),
               hexc('#b8674f')]
HOUSE_ROOFS = [(hexc('#b85a3c'), hexc('#8a3f2a')), (hexc('#5a6478'), hexc('#3f4757')),
               (hexc('#7a5a44'), hexc('#57402f')), (hexc('#4f7560'), hexc('#385545')),
               (hexc('#a0473f'), hexc('#74302b'))]
CONTAINERS = [hexc('#b8452f'), hexc('#2f6fa8'), hexc('#3e8a4e'), hexc('#d08a2a'), hexc('#6b4f9a'),
              hexc('#c7c9c4')]
CIV_COLOURS = ['#3d7fd1', '#e0c040', '#58a85c', '#8f5bc4', '#e8e8ea', '#2b2e38', '#d98236', '#7fb8c7']

U, R, D, L = 1, 2, 4, 8
C_UR, C_DR, C_DL, C_UL = 1, 2, 4, 8

# Straight-road variants (index order matters: src/cityLayout.js weights them)
STRAIGHT_VARIANTS = ('plain', 'manhole', 'oil', 'lamps', 'hydrant')


# --- Streets --------------------------------------------------------------------

def road_combos():
    """Every (mask, corners) pair that can appear on the map (47 blob tiles).

    A corner bit is only meaningful when both orthogonal neighbours around
    that corner are road (it marks the diagonal as *not* road, i.e. the
    sidewalk has to wrap around that corner).
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


def _edge_depth(x, y, side):
    return {U: y, D: T - 1 - y, L: x, R: T - 1 - x}[side]


def _corner_depth(x, y, corner):
    dx = T - 1 - x if corner in (C_UR, C_DR) else x
    dy = y if corner in (C_UR, C_UL) else T - 1 - y
    return max(dx, dy)


def _dash_v(a, y0, y1):
    for y in range(y0, y1 + 1):
        a.put(15, y, MARK)
        a.put(16, y, MARK_WORN if y % 5 == 0 else MARK)


def _dash_h(a, x0, x1):
    for x in range(x0, x1 + 1):
        a.put(x, 15, MARK)
        a.put(x, 16, MARK_WORN if x % 5 == 0 else MARK)


def _crosswalk(a, side):
    # Zebra bars just inside a connected edge of a crossroads
    for p in range(8, 25, 4):
        for w in range(2):
            for depth in range(1, 6):
                c = MARK if (p + w + depth) % 7 else MARK_WORN
                x, y = {U: (p + w, depth), D: (p + w, T - 1 - depth),
                        L: (depth, p + w), R: (T - 1 - depth, p + w)}[side]
                a.put(x, y, c)


def _furniture(a, vertical, kind):
    """Street furniture on the two sidewalks of a straight road.

    u runs across the road from the first sidewalk (0) to the second (31),
    v runs along it.
    """
    def put(u, v, c):
        a.put(u, v, c) if vertical else a.put(v, u, c)

    if kind == 'lamps':
        for u_base, v, arm in ((1, 7, 1), (T - 3, 23, -1)):
            # pole (seen from above) with an arm reaching over the kerb
            for du in range(2):
                for dv in range(2):
                    put(u_base + du, v + dv, hexc('#3a3d47'))
            put(u_base, v, hexc('#6a6e79'))
            for k in range(2, 6):
                put(u_base + (k if arm > 0 else 1 - k), v, hexc('#4a4e59'))
            tip = u_base + (6 if arm > 0 else -5)
            put(tip, v, hexc('#fff0b0'))
            put(tip, v + 1, hexc('#e8d890'))
    elif kind == 'hydrant':
        for du, dv, c in ((1, 19, hexc('#d8433b')), (2, 19, hexc('#b8352e')), (1, 20, hexc('#b8352e')),
                          (2, 20, hexc('#8e2622'))):
            put(du, dv, c)
        put(1, 19, hexc('#ff7a6a'))
        # a bin on the far side
        for du in range(2):
            for dv in range(3):
                put(T - 3 + du, 6 + dv, hexc('#3f6a4a') if dv else hexc('#5a8a66'))


def road_tile(mask, corners, variant):
    rng = rng_for('road', mask, corners, variant)
    a = Art(T, T)
    noise_fill(a, 0, 0, T, T, [(ASPH, 78), (ASPH_D, 12), (ASPH_L, 10)], rng)

    n = bin(mask).count('1')
    vertical = mask == U | D
    horizontal = mask == L | R
    kind = STRAIGHT_VARIANTS[variant] if (vertical or horizontal) else 'plain'

    # Wear decals (under markings)
    if kind == 'manhole':
        cx, cy = (11, 24) if vertical else (24, 11)
        a.disc(cx, cy, 3.2, MANHOLE)
        a.disc(cx, cy, 2.2, MANHOLE_L)
        a.hline(cx - 2, cx + 1, cy - 1, MANHOLE)
        a.hline(cx - 2, cx + 1, cy + 1, MANHOLE)
    elif kind == 'oil':
        cx, cy = (20, 9) if vertical else (9, 20)
        a.ellipse(cx, cy, 3.5, 2.5, OIL)
        for _ in range(8):
            a.set(cx + rng.randint(-4, 4), cy + rng.randint(-3, 3), OIL)
        a.set(cx - 1, cy - 1, ASPH_L)

    # Lane markings
    if vertical:
        _dash_v(a, 4, 11)
        _dash_v(a, 20, 27)
    elif horizontal:
        _dash_h(a, 4, 11)
        _dash_h(a, 20, 27)
    elif n <= 2:
        if mask & U:
            _dash_v(a, 4, 11)
        if mask & D:
            _dash_v(a, 20, 27)
        if mask & L:
            _dash_h(a, 4, 11)
        if mask & R:
            _dash_h(a, 20, 27)
    elif n == 4:
        for side in (U, R, D, L):
            _crosswalk(a, side)

    # Sidewalks: on every side facing a block, plus wrapped inner corners
    open_sides = [s for s in (U, R, D, L) if not mask & s]
    nubs = [c for c in (C_UR, C_DR, C_DL, C_UL) if corners & c]
    for y in range(T):
        for x in range(T):
            depths = [_edge_depth(x, y, s) for s in open_sides] + [_corner_depth(x, y, c) for c in nubs]
            if not depths:
                continue
            d = min(depths)
            if d <= 3:
                if x % 8 == 7 or y % 8 == 7:
                    c = WALK_J
                else:
                    r = rng.random()
                    c = WALK_L if r < 0.06 else WALK_J if r < 0.09 else WALK
                a.put(x, y, c)
            elif d == 4:
                a.put(x, y, CURB_TOP)
            elif d == 5:
                a.put(x, y, GUTTER)

    if kind in ('lamps', 'hydrant'):
        _furniture(a, vertical, kind)
    return a


# --- Shared lot helpers ---------------------------------------------------------------

def _ground(a, rng, colour=GROUND, dark=GROUND_D):
    noise_fill(a, 0, 0, a.w, a.h, [(colour, 20), (dark, 3), (shade(colour, 1.05), 2)], rng)


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


def _box_outline(a, x0, y0, x1, y1):
    for x in range(x0 - 1, x1 + 2):
        a.put(x, y0 - 1, OUTLINE)
        a.put(x, y1 + 1, OUTLINE)
    for y in range(y0, y1 + 1):
        a.put(x0 - 1, y, OUTLINE)
        a.put(x1 + 1, y, OUTLINE)


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
        a.set(x + 2 + i, y + 1 + i, GLASS_L)


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
    a.grid(int(cx) - 2, int(cy) - 2, ['#...#', '#...#', '#####', '#...#', '#...#'], {'#': hexc('#f2f2f2')})


def _solar(a, x, y, cols, rows):
    for j in range(rows):
        for i in range(cols):
            px, py = x + i * 5, y + j * 4
            a.rect(px, py, 4, 3, hexc('#2b4a7a'))
            a.set(px, py, hexc('#5a82b8'))
            a.set(px + 3, py + 2, hexc('#1f3558'))
    _cast_shadow(a, x, y, x + cols * 5 - 2, y + rows * 4 - 2, 1)


def draw_tree(a, cx, cy, r, rng):
    a.ellipse(cx + 2, cy + 2.5, r, r * 0.85, SHADOW)
    a.disc(cx, cy, r + 1, LEAF_O)
    a.disc(cx, cy, r, LEAF_D)
    a.disc(cx - 0.6, cy - 0.6, r - 1, LEAF)
    a.disc(cx - r * 0.35, cy - r * 0.35, r * 0.45, LEAF_L)
    a.set(int(cx - r * 0.45), int(cy - r * 0.5), LEAF_H)
    for _ in range(int(r * 2)):
        ox = rng.uniform(-r + 1, r - 1)
        oy = rng.uniform(-r + 1, r - 1)
        if ox ** 2 + oy ** 2 < (r - 1) ** 2:
            a.set(int(cx + ox), int(cy + oy), LEAF_D if ox + oy > 0 else LEAF_L)


def _bush(a, cx, cy):
    a.disc(cx + 1, cy + 1, 2.2, SHADOW)
    a.disc(cx, cy, 2.4, LEAF_O)
    a.disc(cx, cy, 1.8, LEAF)
    a.set(int(cx) - 1, int(cy) - 1, LEAF_L)


def _grass(a, rng, x0=0, y0=0, w=None, h=None):
    w = a.w if w is None else w
    h = a.h if h is None else h
    noise_fill(a, x0, y0, w, h, [(GRASS, 70), (GRASS_D, 18), (GRASS_L, 12)], rng)
    for _ in range(w * h // 45):
        x, y = x0 + rng.randint(1, w - 2), y0 + rng.randint(1, h - 2)
        a.set(x, y, TUFT)
        a.set(x - 1, y - 1, TUFT)
        a.set(x + 1, y - 1, TUFT)


def _scatter_trees(a, rng, box, count, radii=(4, 5, 5, 6), avoid=()):
    x0, y0, x1, y1 = box
    placed = []
    for _ in range(60):
        if len(placed) >= count:
            break
        r = rng.choice(radii)
        if x1 - x0 < 2 * r + 4 or y1 - y0 < 2 * r + 4:
            continue
        tx = rng.randint(x0 + r + 1, x1 - r - 2)
        ty = rng.randint(y0 + r + 1, y1 - r - 2)
        if any(ax0 - r <= tx <= ax1 + r and ay0 - r <= ty <= ay1 + r for ax0, ay0, ax1, ay1 in avoid):
            continue
        if all((tx - px) ** 2 + (ty - py) ** 2 > (r + pr) ** 2 * 0.8 for px, py, pr in placed):
            placed.append((tx, ty, r))
    for tx, ty, r in sorted(placed, key=lambda p: p[1]):
        draw_tree(a, tx, ty, r, rng)


def civ_car_top(rng, colour=None, facing_up=True):
    """Small parked civilian car (11 x 18 with outline), facing up or down."""
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


# --- Downtown + commercial: flat-roofed blocks packed wall to wall ------------------------

def _facade(a, rng, x0, x1, fy, y1, wall, glassy, shopfront, storey_h=3):
    a.rect(x0, fy, x1 - x0 + 1, y1 - fy + 1, wall)
    a.hline(x0, x1, fy, shade(wall, 0.78))
    a.hline(x0, x1, y1, shade(wall, 0.6))
    a.vline(x0, fy, y1, shade(wall, 1.12))
    a.vline(x1, fy, y1, shade(wall, 0.8))
    top = fy + 2
    bottom = y1 - (5 if shopfront else 2)
    wy = top
    while wy + 1 <= bottom:
        if glassy:
            # curtain wall: continuous glass bands with thin mullions
            for x in range(x0 + 1, x1):
                c = GLASS_L if (x + wy) % 9 == 0 else GLASS
                if (x - x0) % 4 == 0:
                    c = shade(wall, 0.85)
                a.set(x, wy, c)
                a.set(x, wy + 1, GLASS if (x - x0) % 4 else shade(wall, 0.85))
        else:
            wx = x0 + 2
            while wx + 1 < x1 - 1:
                lit = rng.random() < 0.15
                a.rect(wx, wy, 2, 2, LIT if lit else GLASS)
                a.set(wx, wy, LIT_L if lit else GLASS_L)
                wx += 4
        wy += storey_h
    if shopfront:
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
        dx = (x0 + x1) // 2 - 1
        a.rect(dx, y1 - 3, 3, 3, DOOR)
        a.set(dx + 1, y1 - 3, hexc('#5a4234'))


def _flat_roof(a, x0, y0, x1, y1, roof, rim, rng):
    a.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, roof)
    noise_fill(a, x0 + 1, y0 + 1, x1 - x0 - 1, y1 - y0 - 1,
               [(roof, 20), (shade(roof, 0.94), 3), (shade(roof, 1.06), 2)], rng)
    a.hline(x0, x1, y0, shade(rim, 1.1))
    a.vline(x0, y0, y1, shade(rim, 1.05))
    a.hline(x0, x1, y1, shade(rim, 0.82))
    a.vline(x1, y0, y1, shade(rim, 0.86))
    a.hline(x0 + 1, x1 - 1, y0 + 1, shade(roof, 0.8))
    a.vline(x0 + 1, y0 + 1, y1 - 1, shade(roof, 0.84))


def _roof_clutter(a, rng, ix0, iy0, ix1, iy1, wall, roof, count):
    slots = []
    for _ in range(count * 3):
        if len(slots) >= count:
            break
        sx, sy = rng.randint(ix0, max(ix0, ix1 - 6)), rng.randint(iy0, max(iy0, iy1 - 5))
        if all(abs(sx - px) > 6 or abs(sy - py) > 5 for px, py in slots):
            slots.append((sx, sy))
    for sx, sy in slots:
        pick = rng.random()
        if pick < 0.45:
            _ac_unit(a, sx, sy)
        elif pick < 0.7:
            _skylight(a, sx, sy)
        else:
            _vent(a, sx + 1, sy + 1)


def city_building(tw, th, style, rng, tall):
    """A flat-roofed building filling its lot, 3/4 view (facade at the bottom).

    It leaves a 1px seam on the top/left and a 2px strip on the bottom/right
    for its own shadow, so neighbours read as separate buildings sharing a
    block rather than floating boxes.
    """
    w, h = tw * T, th * T
    a = Art(w, h)
    _ground(a, rng)
    x0, y0, x1, y1 = 1, 1, w - 3, h - 3
    if tall:
        facade_h = 12 if th == 1 else 16
    else:
        facade_h = 8 if th == 1 else 11
    fy = y1 - facade_h + 1
    _cast_shadow(a, x0, y0, x1, y1, 2)
    _facade(a, rng, x0, x1, fy, y1, style['wall'], style.get('glassy'), shopfront=not tall,
            storey_h=3 if style.get('glassy') else 4 if tall else 3)
    ry0, ry1 = y0, fy - 1
    _flat_roof(a, x0, ry0, x1, ry1, style['roof'], style['rim'], rng)

    ix0, iy0, ix1, iy1 = x0 + 3, ry0 + 3, x1 - 3, ry1 - 2
    iw, ih = ix1 - ix0, iy1 - iy0
    roll = rng.random()
    if tall and tw == 2 and th == 2 and roll < 0.35:
        # Stepped skyscraper: a setback tower rising out of the podium roof
        sx0, sy0, sx1, sy1 = x0 + 10, ry0 + 5, x1 - 10, ry1 - 3
        sf = 6
        _cast_shadow(a, sx0, sy0, sx1, sy1, 2)
        _facade(a, rng, sx0, sx1, sy1 - sf + 1, sy1, shade(style['wall'], 1.06), style.get('glassy'), False)
        _flat_roof(a, sx0, sy0, sx1, sy1 - sf, shade(style['roof'], 1.1), style['rim'], rng)
        if rng.random() < 0.5:
            _helipad(a, (sx0 + sx1 + 1) / 2, (sy0 + sy1 - sf + 1) / 2)
        else:
            _ac_unit(a, sx0 + 3, sy0 + 3)
        _box_outline(a, sx0, sy0, sx1, sy1)
    elif tall and tw * th >= 4 and roll < 0.55:
        _helipad(a, (x0 + x1 + 1) / 2, (ry0 + ry1 + 1) / 2)
    elif tw * th >= 2 and roll > 0.82:
        _solar(a, ix0, iy0, max(1, iw // 5), max(1, ih // 4))
    else:
        if tw * th >= 2 and rng.random() < 0.5:
            _water_tank(a, ix1 - 3, iy0 + 3)
            ix1 -= 9
        _roof_clutter(a, rng, ix0, iy0, ix1, iy1, style['wall'], style['roof'], 1 + tw * th)
    _box_outline(a, x0, y0, x1, y1)
    return a


def plaza_piece(variant):
    rng = rng_for('plaza', variant)
    a = Art(T, T)
    stone_a, stone_b = hexc('#c2ad8e'), hexc('#b09a7b')
    for y in range(T):
        for x in range(T):
            c = stone_a if ((x // 4) + (y // 4)) % 2 == 0 else stone_b
            if rng.random() < 0.05:
                c = shade(c, 0.93)
            a.set(x, y, c)
    cx, cy = T / 2, T / 2
    if variant % 2 == 0:
        a.disc(cx, cy + 1, 8, hexc('#7d8288'))
        a.disc(cx, cy + 1, 7, hexc('#6b4e36'))
        draw_tree(a, cx, cy, 6, rng)
    else:
        a.disc(cx, cy, 8, hexc('#8f949c'))
        a.disc(cx, cy, 7, hexc('#b8bdc4'))
        a.disc(cx, cy, 6, WATER)
        a.disc(cx - 1, cy - 1, 2.5, WATER_L)
        a.set(int(cx), int(cy), hexc('#ffffff'))
    for bx in (3, T - 9):
        a.rect(bx, T - 5, 6, 2, hexc('#8a5a3a'))
        a.hline(bx, bx + 5, T - 5, hexc('#b27a52'))
    return a


def parking_piece(tw, th, variant):
    rng = rng_for('parking', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    noise_fill(a, 0, 0, w, h, [(hexc('#4b4e58'), 20), (hexc('#44474f'), 4), (hexc('#53565f'), 3)], rng)
    # low kerb around the lot
    a.hline(0, w - 1, 0, hexc('#8b9098'))
    a.vline(0, 0, h - 1, hexc('#8b9098'))
    stall = 13
    rows = 1 if th == 1 else 2
    row_h = (h - 2) // rows
    for r in range(rows):
        ry = 1 + r * row_h
        for sx in range(2, w - stall + 1, stall):
            a.vline(sx, ry + 2, ry + row_h - 3, MARK_WORN)
            if rng.random() < 0.72:
                car = civ_car_top(rng, facing_up=(r % 2 == 0))
                a.blit(car, sx + 1, ry + (row_h - 18) // 2)
            elif rng.random() < 0.5:
                a.set(sx + 6, ry + row_h // 2, OIL)
                a.set(sx + 7, ry + row_h // 2 + 1, OIL)
        a.vline(w - 3, ry + 2, ry + row_h - 3, MARK_WORN)
    if rows == 2:
        # planted median between the two rows
        a.rect(2, h // 2 - 1, w - 4, 3, hexc('#8b9098'))
        a.rect(3, h // 2, w - 6, 1, GRASS_D)
        for tx in range(10, w - 6, 22):
            draw_tree(a, tx, h // 2, 4, rng)
    return a


# --- Residential -------------------------------------------------------------------

def _fence(a, gate_x=None, style='picket', gap=None):
    """Plot boundary. style: picket fence, hedge, or none (open lawn).

    gate_x leaves a 5px opening in the bottom edge; gap=(x0, x1) leaves a
    wider one (a driveway).
    """
    if style == 'none':
        return
    open_at = set()
    if gate_x is not None:
        open_at.update(range(gate_x - 2, gate_x + 3))
    if gap is not None:
        open_at.update(range(gap[0], gap[1] + 1))

    def mark(x, y, along):
        if style == 'picket':
            a.put(x, y, hexc('#8a8272') if along % 4 == 0 else hexc('#e8e2d2'))
        else:
            a.put(x, y, LEAF_D if (x + y) % 3 else LEAF)

    for x in range(a.w):
        mark(x, 0, x)
        if x not in open_at:
            mark(x, a.h - 1, x)
    for y in range(a.h):
        mark(0, y, y)
        mark(a.w - 1, y, y)


def _house(a, rng, x0, y0, hw, roof_h, wall_h, walls=None, roofs=None, hip=None):
    """Pitched-roof house; (x0, y0) is the roof's top-left. Returns its box."""
    wall = walls or rng.choice(HOUSE_WALLS)
    roof_l, roof_d = roofs or rng.choice(HOUSE_ROOFS)
    hip = rng.random() < 0.4 if hip is None else hip
    x1 = x0 + hw - 1
    ry1 = y0 + roof_h - 1
    wy1 = ry1 + wall_h
    _cast_shadow(a, x0, y0, x1, wy1, 2)
    # front wall with door and windows
    a.rect(x0 + 1, ry1 + 1, hw - 2, wall_h, wall)
    a.hline(x0 + 1, x1 - 1, wy1, shade(wall, 0.7))
    a.vline(x1 - 1, ry1 + 1, wy1, shade(wall, 0.85))
    door_x = x0 + hw // 2 - 1
    a.rect(door_x, wy1 - 3, 3, 3, hexc('#6a4430'))
    a.set(door_x + 2, wy1 - 2, hexc('#d8b060'))
    for wx in (x0 + 3, x1 - 5):
        if wall_h >= 4:
            a.rect(wx, ry1 + 2, 3, 2, GLASS)
            a.set(wx, ry1 + 2, GLASS_L)
            a.hline(wx, wx + 2, ry1 + 4, hexc('#f4f4f0'))
    # roof: lit upper slope, shaded lower slope, bright ridge
    mid = y0 + roof_h // 2
    for y in range(y0, ry1 + 1):
        for x in range(x0, x1 + 1):
            upper = y < mid
            c = roof_l if upper else roof_d
            if hip:
                inset = mid - y if upper else y - mid
                if x - x0 < inset or x1 - x < inset:
                    c = shade(roof_l, 0.92) if x - x0 < inset else shade(roof_d, 1.08)
            if (y - y0) % 2 == 1 and (x + (y // 2)) % 4 == 0:
                c = shade(c, 0.88)  # tile courses
            a.put(x, y, c)
    ridge_inset = roof_h // 2 if hip else 0
    a.hline(x0 + ridge_inset, x1 - ridge_inset, mid, shade(roof_l, 1.18))
    a.hline(x0, x1, ry1, shade(roof_d, 0.8))  # eave shadow
    if rng.random() < 0.6:
        cx = x1 - 5 if rng.random() < 0.5 else x0 + 3
        a.rect(cx, y0 + 1, 2, 3, hexc('#8a4a3a'))
        a.set(cx, y0 + 1, hexc('#b86a5a'))
        a.set(cx + 1, y0 + 1, hexc('#3a2a24'))
    _box_outline(a, x0, y0, x1, wy1)
    return (x0, y0, x1, wy1), door_x + 1


def house_piece(tw, th, variant):
    rng = rng_for('house', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    _grass(a, rng)
    boxes = []
    fence = ('picket', 'hedge', 'none')[variant % 3]
    if tw == 1 and th == 1:
        layout = (variant // 3) % 3
        if layout == 1:
            # narrow house to one side, driveway with the family car
            flip = variant % 2 == 1
            hx = 13 if flip else 2
            box, door = _house(a, rng, hx, 3, 17, 10, 6)
            boxes.append(box)
            dx0 = 2 if flip else 19
            a.rect(dx0, 12, 11, h - 13, hexc('#9a9a94'))
            a.blit(civ_car_top(rng, facing_up=False), dx0, 13)
            for y in range(box[3] + 1, h - 1):
                a.put(door, y, DIRT)
            _fence(a, gate_x=door, style=fence, gap=(dx0, dx0 + 10))
            _bush(a, box[0] + 3, box[3] + 3)
        elif layout == 2:
            # house set back with a big shade tree out front
            hw = rng.choice((18, 20))
            hx = (w - hw) // 2 + rng.choice((-3, 3))
            box, door = _house(a, rng, hx, 3, hw, 11, 5)
            boxes.append(box)
            for y in range(box[3] + 1, h - 1):
                a.put(door, y, DIRT)
                a.put(door + 1, y, DIRT_D)
            _fence(a, gate_x=door, style=fence)
            tree_x = 7 if door > w // 2 else w - 8
            draw_tree(a, tree_x, h - 8, 5, rng)
            boxes.append((tree_x - 6, h - 14, tree_x + 6, h - 2))
        else:
            hw = rng.choice((18, 20, 22))
            hx = (w - hw) // 2 + rng.randint(-2, 2)
            box, door = _house(a, rng, hx, 4, hw, 10, 6)
            boxes.append(box)
            for y in range(box[3] + 1, h - 1):
                a.put(door, y, DIRT)
                a.put(door + 1, y, DIRT_D)
            _fence(a, gate_x=door, style=fence)
            _bush(a, box[0] + 2, box[3] + 3)
            _bush(a, box[2] - 1, box[3] + 3)
            if rng.random() < 0.6:
                side = 5 if hx > 7 else w - 6
                draw_tree(a, side, h - 7, 4, rng)
    elif tw == 2 and th == 1:
        # wide house with an attached garage, pool out the side
        box, door = _house(a, rng, 3, 4, 26, 10, 6)
        boxes.append(box)
        gx0, gy0, gx1, gy1 = box[2] + 1, 8, box[2] + 10, box[3]
        _cast_shadow(a, gx0, gy0, gx1, gy1, 2)
        a.rect(gx0, gy0, gx1 - gx0 + 1, gy1 - gy0 - 4, hexc('#8f949c'))
        a.hline(gx0, gx1, gy0, hexc('#b8bdc4'))
        a.rect(gx0, gy1 - 4, gx1 - gx0 + 1, 5, hexc('#d8d4c8'))
        for y in range(gy1 - 3, gy1 + 1, 2):
            a.hline(gx0 + 1, gx1 - 1, y, hexc('#b0aca0'))
        _box_outline(a, gx0, gy0, gx1, gy1)
        # driveway with the family car
        a.rect(gx0, gy1 + 2, gx1 - gx0 + 1, h - gy1 - 3, hexc('#9a9a94'))
        _pool(a, 44, 6, 15, 10)
        for y in range(box[3] + 1, h - 1):
            a.put(door, y, DIRT)
        _fence(a, gate_x=door, style=fence, gap=(gx0, gx1))
        draw_tree(a, w - 7, h - 8, 4, rng)
    elif tw == 1 and th == 2:
        # house at the front, long back garden with a pool and a shed
        box, door = _house(a, rng, 5, 36, 22, 10, 6)
        boxes.append(box)
        _pool(a, 7, 6, 12, 14)
        a.rect(22, 5, 7, 6, hexc('#8a6a4a'))
        a.hline(22, 28, 5, hexc('#a8845c'))
        _box_outline(a, 22, 5, 28, 10)
        for y in range(box[3] + 1, h - 1):
            a.put(door, y, DIRT)
        _fence(a, gate_x=door, style=fence)
        draw_tree(a, 24, 22, 5, rng)
    else:
        # small apartment block on a lawn
        x0, y0, x1, y1 = 6, 5, w - 8, 40
        _cast_shadow(a, x0, y0, x1, y1, 2)
        wall = rng.choice((hexc('#d8cdb0'), hexc('#c9b8a6'), hexc('#b8c4cc')))
        _facade(a, rng, x0, x1, y1 - 11 + 1, y1, wall, False, False, storey_h=4)
        # balconies
        for bx in range(x0 + 3, x1 - 3, 8):
            for by in (y1 - 8, y1 - 4):
                a.hline(bx, bx + 4, by, hexc('#f4f4f0'))
        _flat_roof(a, x0, y0, x1, y1 - 11, hexc('#6d6a63'), hexc('#a8a498'), rng)
        _ac_unit(a, x0 + 5, y0 + 4)
        _ac_unit(a, x1 - 10, y0 + 4)
        _box_outline(a, x0, y0, x1, y1)
        boxes.append((x0, y0, x1, y1))
        a.rect(w // 2 - 1, y1 + 1, 3, h - y1 - 2, DIRT)
        for tx in (10, w - 12):
            draw_tree(a, tx, 52, 5, rng)
        _fence(a, gate_x=w // 2)
    # flowers dotted around the lawn, clear of the buildings
    for _ in range(tw * th * 4):
        fx, fy = rng.randint(2, w - 3), rng.randint(2, h - 3)
        if not any(bx0 - 1 <= fx <= bx1 + 3 and by0 - 1 <= fy <= by1 + 3 for bx0, by0, bx1, by1 in boxes):
            if a.get(fx, fy) in (GRASS, GRASS_D, GRASS_L):
                a.set(fx, fy, rng.choice([hexc('#f5d547'), hexc('#f2f2f2'), hexc('#f07ab0')]))
    return a


def _pool(a, x, y, w, h):
    a.rect(x - 1, y - 1, w + 2, h + 2, hexc('#e8e4dc'))
    a.rect(x, y, w, h, POOL)
    a.hline(x, x + w - 1, y, hexc('#2f8ab8'))
    for i in range(3):
        a.hline(x + 2 + i * 3, x + 4 + i * 3, y + 2 + (i % 2) * 3, POOL_L)


def pocket_park_piece(variant):
    rng = rng_for('pocketpark', variant)
    a = Art(T, T)
    _grass(a, rng)
    if variant % 2 == 0:
        # playground: sandpit, slide, swings
        a.rect(5, 6, 18, 14, SAND)
        a.rect(6, 8, 3, 9, hexc('#e8413f'))
        a.hline(6, 8, 8, hexc('#ff8a80'))
        a.hline(13, 21, 9, hexc('#5a5f6b'))
        for sx in (14, 18):
            a.vline(sx, 10, 13, hexc('#8a8f99'))
            a.rect(sx - 1, 14, 3, 1, hexc('#2f7fc1'))
        draw_tree(a, 26, 25, 4, rng)
        a.rect(4, 25, 8, 2, hexc('#8a5a3a'))
    else:
        a.rect(0, 14, T, 3, DIRT)
        _scatter_trees(a, rng, (0, 0, T, 14), 2, radii=(4, 5))
        _scatter_trees(a, rng, (0, 17, T, T), 2, radii=(4, 5))
    return a


# --- Industrial -------------------------------------------------------------------

def _concrete_yard(a, rng):
    _ground(a, rng, hexc('#8f8e88'), hexc('#84837d'))


def warehouse_piece(tw, th, variant):
    rng = rng_for('warehouse', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    _concrete_yard(a, rng)
    roof = rng.choice((hexc('#a9b3bd'), hexc('#a0594a'), hexc('#6f8f78'), hexc('#c9c7bd')))
    wall = hexc('#b8b3a6')
    x0, y0, x1, y1 = 2, 2, w - 4, h - 8
    facade_h = 6
    fy = y1 - facade_h + 1
    _cast_shadow(a, x0, y0, x1, y1, 2)
    # corrugated wall with roller doors
    for x in range(x0, x1 + 1):
        a.vline(x, fy, y1, wall if x % 2 else shade(wall, 0.9))
    a.hline(x0, x1, y1, shade(wall, 0.6))
    doors = max(1, (x1 - x0) // 16)
    for i in range(doors):
        dx = x0 + 4 + i * ((x1 - x0 - 8) // doors)
        a.rect(dx, fy + 1, 9, facade_h - 1, hexc('#6f747e'))
        for y in range(fy + 1, y1 + 1, 2):
            a.hline(dx, dx + 8, y, hexc('#5a5f68'))
        # yellow dock bollards
        a.set(dx - 1, y1 + 2, hexc('#e8c547'))
        a.set(dx + 9, y1 + 2, hexc('#e8c547'))
    # ribbed metal roof with skylight strips
    ry1 = fy - 1
    for y in range(y0, ry1 + 1):
        for x in range(x0, x1 + 1):
            a.put(x, y, shade(roof, 1.08) if (x - x0) % 3 == 0 else roof if (x - x0) % 3 == 1 else shade(roof, 0.9))
    a.hline(x0, x1, y0, shade(roof, 1.2))
    a.hline(x0, x1, ry1, shade(roof, 0.75))
    for sy in range(y0 + 4, ry1 - 3, 9):
        for x in range(x0 + 4, x1 - 3):
            if (x - x0) % 12 < 8:
                a.put(x, sy, hexc('#c8e0ee'))
                a.put(x, sy + 1, hexc('#9ab8cc'))
    for vx in range(x0 + 6, x1 - 4, 14):
        _vent(a, vx, ry1 - 3)
    _box_outline(a, x0, y0, x1, y1)
    # painted bay lines in the yard
    for x in range(x0, x1, 12):
        a.vline(x, y1 + 3, h - 2, hexc('#e8c547'))
    return a


def _container(a, x, y, horizontal, colour):
    w, h = (15, 6) if horizontal else (6, 15)
    _cast_shadow(a, x, y, x + w - 1, y + h - 1, 1)
    a.rect(x, y, w, h, colour)
    for i in range(1, (w if horizontal else h) - 1, 2):
        if horizontal:
            a.vline(x + i, y + 1, y + h - 2, shade(colour, 0.85))
        else:
            a.hline(x + 1, x + w - 2, y + i, shade(colour, 0.85))
    a.hline(x, x + w - 1, y, shade(colour, 1.2))
    _box_outline(a, x, y, x + w - 1, y + h - 1)


def yard_piece(tw, th, variant):
    rng = rng_for('yard', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    _concrete_yard(a, rng)
    for y in range(4, h - 3, 10):
        a.hline(2, w - 3, y, hexc('#b8a44a'))
    # stacked shipping containers, pallets and drums
    y = 3
    while y + 7 < h - 3:
        x = 3
        while x + 16 < w - 2:
            if rng.random() < 0.75:
                _container(a, x, y, True, rng.choice(CONTAINERS))
            x += 17
        y += 9
    for _ in range(tw * 2):
        px, py = rng.randint(2, w - 7), rng.randint(2, h - 7)
        a.rect(px, py, 4, 4, hexc('#9a7048'))
        a.hline(px, px + 3, py + 1, hexc('#6a4a30'))
        a.hline(px, px + 3, py + 3, hexc('#6a4a30'))
    for _ in range(3):
        dx, dy = rng.randint(2, w - 4), rng.randint(2, h - 4)
        a.disc(dx + 0.5, dy + 0.5, 1.4, rng.choice((hexc('#2f6fa8'), hexc('#e8c547'), hexc('#b8452f'))))
    return a


def tanks_piece(variant):
    rng = rng_for('tanks', variant)
    a = Art(2 * T, 2 * T)
    _concrete_yard(a, rng)
    centres = [(16, 16), (47, 16), (16, 47), (47, 47)] if variant == 0 else [(20, 20), (46, 44)]
    r = 11 if variant == 0 else 15
    # pipework first so tanks sit on top of it
    for (ax, ay), (bx, by) in zip(centres, centres[1:]):
        a.hline(min(ax, bx), max(ax, bx), ay, hexc('#6a6f79'))
        a.vline(bx, min(ay, by), max(ay, by), hexc('#6a6f79'))
    for cx, cy in centres:
        a.disc(cx + 2.5, cy + 2.5, r, SHADOW)
        a.disc(cx, cy, r + 1, OUTLINE)
        a.disc(cx, cy, r, hexc('#c9ced6'))
        a.disc(cx - 1, cy - 1, r - 2, hexc('#dfe3e8'))
        a.disc(cx - r * 0.35, cy - r * 0.35, r * 0.35, hexc('#f2f4f6'))
        a.disc(cx, cy, 2.5, hexc('#8a8f99'))
        for k in range(int(r)):
            a.set(int(cx + r - 1 - k * 0.1), int(cy - k * 0.6), hexc('#8a8f99'))
    return a


def workshop_piece(variant):
    rng = rng_for('workshop', variant)
    a = Art(T, T)
    _concrete_yard(a, rng)
    x0, y0, x1, y1 = 2, 2, T - 4, T - 7
    fy = y1 - 5
    _cast_shadow(a, x0, y0, x1, y1, 2)
    wall = hexc('#a8745a') if variant % 2 else hexc('#9aa3ad')
    a.rect(x0, fy, x1 - x0 + 1, y1 - fy + 1, wall)
    a.hline(x0, x1, y1, shade(wall, 0.6))
    a.rect(x0 + 4, fy + 1, 8, y1 - fy, hexc('#6f747e'))
    for y in range(fy + 1, y1 + 1, 2):
        a.hline(x0 + 4, x0 + 11, y, hexc('#5a5f68'))
    # sawtooth roof: glazed strip, then a sloping metal band
    for y in range(y0, fy):
        k = (y - y0) % 6
        c = hexc('#c8e0ee') if k == 0 else shade(hexc('#8f98a6'), 1.15 - k * 0.06)
        a.hline(x0, x1, y, c)
    a.rect(x1 - 5, y0 - 1, 3, 6, hexc('#7a5a4a'))
    a.set(x1 - 4, y0 - 1, hexc('#3a2a24'))
    _box_outline(a, x0, y0, x1, y1)
    for _ in range(2):
        px = rng.randint(3, T - 8)
        a.rect(px, T - 5, 4, 3, hexc('#9a7048'))
    return a


# --- Parks ----------------------------------------------------------------------

def park_piece(tw, th, variant):
    """Grass runs to every edge so neighbouring park lots merge into one park."""
    rng = rng_for('park', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    _grass(a, rng)
    if tw == 2 and th == 2 and variant == 0:
        cx, cy = w / 2, h / 2 + 1
        a.ellipse(cx, cy, 19, 14, SAND)
        a.ellipse(cx, cy, 17, 12, WATER_D)
        a.ellipse(cx - 1, cy - 1, 15, 10, WATER)
        for i in range(6):
            a.hline(int(cx - 8 + i * 3), int(cx - 6 + i * 3), int(cy - 5 + (i % 3) * 4), WATER_L)
        for (px, py) in [(cx + 6, cy + 3), (cx - 9, cy + 4)]:
            a.disc(px, py, 1.8, hexc('#4f9a43'))
            a.set(int(px), int(py) - 1, hexc('#f2a2c2'))
        for (tx, ty, tr) in [(8, 9, 5), (w - 9, 10, 6), (9, h - 9, 5), (w - 8, h - 8, 4)]:
            draw_tree(a, tx, ty, tr, rng)
    elif tw == 2 and th == 2 and variant == 1:
        a.rect(w // 2 - 2, 0, 4, h, DIRT)
        a.rect(0, h // 2 - 2, w, 4, DIRT)
        cx, cy = w / 2, h / 2
        a.disc(cx, cy, 8, hexc('#8f949c'))
        a.disc(cx, cy, 7, hexc('#b8bdc4'))
        a.disc(cx, cy, 5.5, WATER)
        a.disc(cx - 1, cy - 1, 2, WATER_L)
        a.set(int(cx), int(cy), hexc('#ffffff'))
        for (tx, ty) in [(12, 12), (w - 12, 12), (12, h - 12), (w - 12, h - 12)]:
            draw_tree(a, tx, ty, 6, rng)
    else:
        # Scattered trees and flower beds; no paths, since they'd dead-end at
        # the lot edge wherever park lots join up into one bigger park
        for _ in range(tw * th * 5):
            fx, fy = rng.randint(2, w - 3), rng.randint(2, h - 3)
            a.set(fx, fy, rng.choice([hexc('#f5d547'), hexc('#f2f2f2'), hexc('#f07ab0')]))
        if rng.random() < 0.5:
            bx, by = rng.randint(4, w - 12), rng.randint(4, h - 8)
            a.ellipse(bx + 4, by + 2, 4.5, 2.5, hexc('#6b4e36'))
            for k in range(6):
                a.set(bx + 1 + k, by + 1 + (k % 2), rng.choice([hexc('#f07ab0'), hexc('#f5d547'), hexc('#e8413f')]))
            avoid = [(bx - 1, by - 1, bx + 9, by + 5)]
        else:
            avoid = []
        _scatter_trees(a, rng, (0, 0, w, h), tw * th * 2 + 1, avoid=avoid)
    return a


def ground_piece():
    rng = rng_for('ground')
    a = Art(T, T)
    _ground(a, rng)
    return a


# --- Catalogue -------------------------------------------------------------------

def city_pieces():
    """[(name, zone, tw, th, Art)] — every lot piece, grouped by district zone."""
    pieces = []

    def add(name, zone, tw, th, art):
        pieces.append((name, zone, tw, th, art))

    # Downtown: towers wall to wall, the odd plaza
    for i, style in enumerate(DOWNTOWN_STYLES):
        for v in range(2):
            add(f'tower_1x1_{style["name"]}_{v}', 'downtown', 1, 1,
                city_building(1, 1, style, rng_for('tower11', i, v), True))
        add(f'tower_2x1_{style["name"]}', 'downtown', 2, 1, city_building(2, 1, style, rng_for('tower21', i), True))
        add(f'tower_1x2_{style["name"]}', 'downtown', 1, 2, city_building(1, 2, style, rng_for('tower12', i), True))
        add(f'tower_2x2_{style["name"]}', 'downtown', 2, 2, city_building(2, 2, style, rng_for('tower22', i), True))
    for v in range(2):
        add(f'plaza_{v}', 'downtown', 1, 1, plaza_piece(v))

    # Commercial: low shops with awnings, car parks
    for i, style in enumerate(COMMERCIAL_STYLES):
        add(f'shop_1x1_{style["name"]}', 'commercial', 1, 1, city_building(1, 1, style, rng_for('shop11', i), False))
        add(f'shop_2x1_{style["name"]}', 'commercial', 2, 1, city_building(2, 1, style, rng_for('shop21', i), False))
        if i % 2 == 0:
            add(f'shop_1x2_{style["name"]}', 'commercial', 1, 2, city_building(1, 2, style, rng_for('shop12', i), False))
            add(f'shop_2x2_{style["name"]}', 'commercial', 2, 2, city_building(2, 2, style, rng_for('shop22', i), False))
    for v in range(3):
        add(f'parking_2x1_{v}', 'commercial', 2, 1, parking_piece(2, 1, v))
    for v in range(2):
        add(f'parking_2x2_{v}', 'commercial', 2, 2, parking_piece(2, 2, v))

    # Residential: houses in fenced gardens, a few flats, pocket parks
    for v in range(18):
        add(f'house_1x1_{v}', 'residential', 1, 1, house_piece(1, 1, v))
    for v in range(3):
        add(f'house_2x1_{v}', 'residential', 2, 1, house_piece(2, 1, v))
        add(f'house_1x2_{v}', 'residential', 1, 2, house_piece(1, 2, v))
    for v in range(2):
        add(f'flats_2x2_{v}', 'residential', 2, 2, house_piece(2, 2, v))
        add(f'pocketpark_{v}', 'residential', 1, 1, pocket_park_piece(v))

    # Industrial: warehouses, container yards, tank farms, workshops
    for v in range(3):
        add(f'warehouse_2x1_{v}', 'industrial', 2, 1, warehouse_piece(2, 1, v))
        add(f'warehouse_1x2_{v}', 'industrial', 1, 2, warehouse_piece(1, 2, v))
        add(f'warehouse_2x2_{v}', 'industrial', 2, 2, warehouse_piece(2, 2, v))
        add(f'workshop_{v}', 'industrial', 1, 1, workshop_piece(v))
        add(f'yard_1x1_{v}', 'industrial', 1, 1, yard_piece(1, 1, v))
    for v in range(2):
        add(f'yard_2x1_{v}', 'industrial', 2, 1, yard_piece(2, 1, v))
        add(f'tanks_{v}', 'industrial', 2, 2, tanks_piece(v))

    # Parks
    for v in range(4):
        add(f'park_1x1_{v}', 'park', 1, 1, park_piece(1, 1, v))
    for v in range(2):
        add(f'park_2x1_{v}', 'park', 2, 1, park_piece(2, 1, v))
        add(f'park_1x2_{v}', 'park', 1, 2, park_piece(1, 2, v))
    for v in range(3):
        add(f'park_2x2_{v}', 'park', 2, 2, park_piece(2, 2, v))
    return pieces


def build_city_tiles():
    """Returns (tiles: [Art 32x32], manifest dict)."""
    tiles = []
    roads = {}
    for mask, corners in road_combos():
        straight = mask in (U | D, L | R)
        variants = len(STRAIGHT_VARIANTS) if straight else 1
        idx = []
        for v in range(variants):
            idx.append(len(tiles))
            tiles.append(road_tile(mask, corners, v))
        roads[f'{mask},{corners}'] = idx

    pieces = []
    for name, zone, tw, th, art in city_pieces():
        ids = []
        for ty in range(th):
            for tx in range(tw):
                tile = Art(T, T)
                tile.blit(art.im.crop((tx * T, ty * T, tx * T + T, ty * T + T)), 0, 0)
                ids.append(len(tiles))
                tiles.append(tile)
        pieces.append({'name': name, 'zone': zone, 'w': tw, 'h': th, 'tiles': ids})

    ground = len(tiles)
    tiles.append(ground_piece())
    return tiles, {'roads': roads, 'pieces': pieces, 'ground': ground}
