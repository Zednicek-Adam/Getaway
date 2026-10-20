"""Town tileset: autotiled dirt streets with boardwalks + zoned frontier lots.

Streets own their boardwalks (drawn on the street tile's edges that face a
block), so lots can be packed wall to wall like a real frontier main street.
Every lot piece belongs to a zone — downtown (Main Street's false fronts,
drawn by art_town.py), commercial (the trades: smithy, livery, wagon yards),
residential (homesteads, the church, the schoolhouse), industrial (freight
barns, lumber, water towers, stockyards) or park (the town common) — and
src/cityLayout.js zones whole blocks at a time. Each piece is a distinct
design (no recoloured or re-rolled twins), and identical tiles are stored once
in the tileset. Everything past the edge of town is art_land.py.
"""
import math

from pixelkit import Art, hexc, shade, mix, noise_fill, rng_for

T = 32  # art pixels per map tile (exported at 2x -> 64px, the game's TILE_SIZE)

# --- Palette ----------------------------------------------------------------
OUTLINE = hexc('#1e130f')
SHADOW = (40, 22, 12, 80)

DIRT = hexc('#c9a46a')       # the street
DIRT_D = hexc('#bb975f')
DIRT_L = hexc('#d4b17a')
RUT = hexc('#a5814e')
RUT_L = hexc('#dcbf8a')
PEBBLE = hexc('#e6d0a2')
HOOFPRINT = hexc('#a27e4b')
MUD = hexc('#8e6c44')
PUDDLE = hexc('#7a8486')
PUDDLE_L = hexc('#b4c2c2')

BOARD = hexc('#a87a4a')      # boardwalk planks
BOARD_L = hexc('#c09058')
BOARD_D = hexc('#946640')
BOARD_SEAM = hexc('#6a4428')
BOARD_EDGE = hexc('#4e321e')  # the boardwalk's front face
YARD = hexc('#c0a06c')       # packed dirt inside blocks
YARD_D = hexc('#b3935f')

GRASS = hexc('#a7a65c')      # dry prairie grass
GRASS_D = hexc('#929249')
GRASS_L = hexc('#bdb96e')
TUFT = hexc('#7c7e42')
SAND = hexc('#dec38c')
SAND_D = hexc('#cdb07a')
SAND_L = hexc('#ead2a0')
LEAF_O = hexc('#2c3a1c')
LEAF_D = hexc('#4c6a2e')
LEAF = hexc('#6e8e3c')
LEAF_L = hexc('#92b052')
LEAF_H = hexc('#b8d06e')
SAGE = hexc('#8a9a72')
SAGE_D = hexc('#66765a')
CACTUS = hexc('#5c9a4c')
CACTUS_L = hexc('#86c06a')
CACTUS_D = hexc('#3a6c36')
ROCK = hexc('#b67a5a')
ROCK_L = hexc('#d49a78')
ROCK_D = hexc('#86523c')
WATER = hexc('#3f8fd0')
WATER_D = hexc('#2d6aa8')
WATER_L = hexc('#8fd0f4')
FLOWERS = [hexc('#f5d547'), hexc('#f2efe2'), hexc('#e8743c'), hexc('#c88ae0')]

WOOD = hexc('#9a6a3c')
WOOD_L = hexc('#c08a52')
WOOD_D = hexc('#6a4426')
WOOD_DD = hexc('#4a2e1a')
CANVAS = hexc('#efe6cf')
CANVAS_D = hexc('#cfc2a2')
IRON = hexc('#3e3a3c')
GLASS = hexc('#2e3640')
GLASS_L = hexc('#9ab4c0')
LIT = hexc('#ffd66b')
DOOR = hexc('#3a2418')
BRICK = hexc('#9a4a36')
STONE = hexc('#a8a294')
STONE_D = hexc('#7e786c')
HAY = hexc('#d8b456')
HAY_D = hexc('#b08a36')
HAY_L = hexc('#f0d27c')
COW = hexc('#5e3a24')

HOUSE_PAINTS = [hexc('#efe6d2'), hexc('#d8c49a'), hexc('#b8c4a8'), hexc('#c48a6a'), hexc('#a8b4c0')]
HOUSE_ROOFS = [(hexc('#8a6a52'), hexc('#644a38')), (hexc('#6e6a64'), hexc('#4e4a46')),
               (hexc('#9a5a3e'), hexc('#6e3e2a')), (hexc('#7a7058'), hexc('#58503e'))]
CANVAS_COLOURS = [CANVAS, hexc('#e6dcc0'), hexc('#d8ccb0')]

U, R, D, L = 1, 2, 4, 8
C_UR, C_DR, C_DL, C_UL = 1, 2, 4, 8

# Straight-street variants (index order matters: src/cityLayout.js weights them)
STRAIGHT_VARIANTS = ('plain', 'puddle', 'hitching', 'barrels')


# --- Streets --------------------------------------------------------------------

def road_combos():
    """Every (mask, corners) pair that can appear on the map (47 blob tiles).

    A corner bit is only meaningful when both orthogonal neighbours around
    that corner are road (it marks the diagonal as *not* road, i.e. the
    boardwalk has to wrap around that corner).
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


RUT_LINES = (10, 21)  # wheel ruts, measured across the street


def _ruts(a, mask, rng):
    """Wagon-wheel ruts worn along every connected side. On a bend a rut
    that doesn't carry straight on stops at the far rut, so the wheels read
    as turning the corner; where three or four streets meet, the middle is
    churned up instead."""
    junction = bin(mask).count('1') >= 3
    lo, hi = RUT_LINES

    def rut(x, y):
        if junction and lo <= x <= hi and lo <= y <= hi:
            return
        if rng.random() < 0.15:
            return
        a.put(x, y, RUT if rng.random() < 0.75 else shade(RUT, 1.08))

    for side, vertical in ((U, True), (D, True), (L, False), (R, False)):
        if not mask & side:
            continue
        opposite = {U: D, D: U, L: R, R: L}[side]
        through = mask & opposite
        for line in RUT_LINES:
            if side in (U, L):
                span = range(0, T if through else hi + 1)
            else:
                span = range(0 if through else lo, T)
            for v in span:
                rut(line, v) if vertical else rut(v, line)
    if junction:
        for _ in range(14):
            x, y = rng.randint(lo, hi), rng.randint(lo, hi)
            a.put(x, y, rng.choice((RUT, HOOFPRINT, DIRT_D)))


def _boardwalk_pixel(a, x, y, depth, along, rng):
    """Planks run along the street, two boards deep, butt joints staggered."""
    board = depth // 2
    joint = (along + board * 5) % 11 == 0
    if joint:
        c = BOARD_SEAM
    elif depth % 2 == 0:
        c = BOARD_L if rng.random() < 0.7 else BOARD
    else:
        c = BOARD if rng.random() < 0.8 else BOARD_D
    a.put(x, y, c)


def _furniture(a, vertical, kind, rng):
    """Street furniture along the two boardwalks of a straight street.

    u runs across the street from the first boardwalk (0) to the second (31),
    v runs along it.
    """
    def put(u, v, c):
        a.put(u, v, c) if vertical else a.put(v, u, c)

    def disc(cu, cv, r, c):
        for du in range(-3, 4):
            for dv in range(-3, 4):
                if (du + 0.5 - (cu % 1)) ** 2 + (dv + 0.5 - (cv % 1)) ** 2 <= r * r:
                    put(int(cu) + du, int(cv) + dv, c)

    if kind == 'hitching':
        # a rail on posts in front of each boardwalk
        for u in (6, T - 7):
            for v in range(5, 27):
                put(u, v, WOOD_L if v % 6 else WOOD)
            for v in (5, 16, 26):
                put(u, v, WOOD_DD)
                put(u + (1 if u < 16 else -1), v, shade(DIRT, 0.8))
    elif kind == 'barrels':
        disc(1.5, 7.5, 2.0, WOOD_D)
        disc(1.5, 7.5, 1.2, WOOD_L)
        disc(1.5, 12.0, 2.0, WOOD_D)
        disc(1.5, 12.0, 1.2, WOOD)
        for du in range(0, 4):
            for dv in range(16, 20):
                put(du, dv, WOOD_L if (du + dv) % 3 else WOOD_D)
        # a bench across the street
        for v in range(9, 22):
            put(T - 3, v, WOOD_L)
            put(T - 2, v, WOOD)
        put(T - 2, 9, WOOD_DD)
        put(T - 2, 21, WOOD_DD)


def road_tile(mask, corners, variant):
    rng = rng_for('road', mask, corners, variant)
    a = Art(T, T)
    noise_fill(a, 0, 0, T, T, [(DIRT, 76), (DIRT_D, 14), (DIRT_L, 10)], rng)
    # broad dusty blotches so a long street doesn't read as flat colour
    for _ in range(3):
        bx, by, br = rng.uniform(4, 28), rng.uniform(4, 28), rng.uniform(2.5, 5)
        for y in range(T):
            for x in range(T):
                if (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 <= br * br and rng.random() < 0.55:
                    a.put(x, y, DIRT_D if rng.random() < 0.6 else shade(DIRT_D, 0.96))
    for _ in range(10):
        a.put(rng.randrange(T), rng.randrange(T), PEBBLE)

    vertical = mask == U | D
    horizontal = mask == L | R
    kind = STRAIGHT_VARIANTS[variant] if (vertical or horizontal) else 'plain'

    _ruts(a, mask, rng)
    # hoofprints between the ruts
    for _ in range(4):
        hx, hy = rng.randint(12, 19), rng.randint(6, 25)
        if not vertical and not horizontal and rng.random() < 0.5:
            hx, hy = hy, hx
        a.put(hx, hy, HOOFPRINT)
        a.put(hx + 1, hy, HOOFPRINT)
        a.put(hx, hy + 1, DIRT_D)

    if kind == 'puddle':
        cx, cy = (13.5, 22.0) if vertical else (22.0, 13.5)
        a.ellipse(cx, cy, 4.2 if vertical else 5.6, 5.6 if vertical else 4.2, MUD)
        a.ellipse(cx - 0.3, cy - 0.3, 3.0 if vertical else 4.4, 4.4 if vertical else 3.0, PUDDLE)
        a.put(int(cx) - 1, int(cy) - 1, PUDDLE_L)
        a.put(int(cx), int(cy) - 2, PUDDLE_L)

    # Boardwalks on every side facing a block, plus wrapped inner corners
    open_sides = [s for s in (U, R, D, L) if not mask & s]
    nubs = [c for c in (C_UR, C_DR, C_DL, C_UL) if corners & c]
    for y in range(T):
        for x in range(T):
            best = None
            for s in open_sides:
                d = _edge_depth(x, y, s)
                if best is None or d < best[0]:
                    best = (d, x if s in (U, D) else y)
            for c in nubs:
                d = _corner_depth(x, y, c)
                if best is None or d < best[0]:
                    best = (d, x + y)
            if best is None:
                continue
            d, along = best
            if d <= 3:
                _boardwalk_pixel(a, x, y, d, along, rng)
            elif d == 4:
                a.put(x, y, BOARD_EDGE)
            elif d == 5:
                a.put(x, y, shade(a.get(x, y), 0.86))

    if kind in ('hitching', 'barrels'):
        _furniture(a, vertical, kind, rng)
    return a


# --- Shared lot helpers ---------------------------------------------------------------

def _yard(a, rng, colour=YARD, dark=YARD_D):
    noise_fill(a, 0, 0, a.w, a.h, [(colour, 20), (dark, 4), (shade(colour, 1.05), 2)], rng)


def _darken(a, x, y, f=0.74):
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


def _barrel(a, cx, cy, r=2.2):
    a.disc(cx + 0.8, cy + 0.8, r, SHADOW)
    a.disc(cx, cy, r, WOOD_DD)
    a.disc(cx, cy, r - 0.7, WOOD)
    a.set(int(cx - 0.5), int(cy - 0.5), WOOD_L)


def _crate(a, x, y, s=4):
    _cast_shadow(a, x, y, x + s - 1, y + s - 1, 1)
    a.rect(x, y, s, s, WOOD_L)
    a.line(x, y, x + s - 1, y + s - 1, WOOD_D)
    a.hline(x, x + s - 1, y + s - 1, WOOD_D)
    a.vline(x + s - 1, y, y + s - 1, WOOD_D)


def _chimney(a, x, y, brick=BRICK):
    a.rect(x, y, 3, 3, brick)
    a.hline(x, x + 2, y, shade(brick, 1.2))
    a.set(x + 1, y + 1, hexc('#2a1a14'))
    _cast_shadow(a, x, y, x + 2, y + 2, 1)


def _stovepipe(a, x, y):
    a.rect(x, y, 2, 2, IRON)
    a.set(x, y, hexc('#6e6a6c'))
    _cast_shadow(a, x, y, x + 1, y + 1, 1)


def draw_tree(a, cx, cy, r, rng):
    """A cottonwood: round, a little yellow in the sun."""
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


def _sage(a, cx, cy):
    """A sagebrush clump."""
    a.disc(cx + 1, cy + 1, 2.2, SHADOW)
    a.disc(cx, cy, 2.4, SAGE_D)
    a.disc(cx - 0.4, cy - 0.4, 1.6, SAGE)
    a.set(int(cx) - 1, int(cy) - 1, hexc('#b0bc98'))


def _saguaro(a, cx, cy, arms, rng):
    """A saguaro from above: the trunk's crown with arms reaching out."""
    a.ellipse(cx + 2.5, cy + 3, 3.2, 2.2, SHADOW)
    for (dx, dy) in arms:
        a.line(int(cx), int(cy), int(cx + dx), int(cy + dy), CACTUS_D)
        a.disc(cx + dx, cy + dy, 1.5, CACTUS)
        a.set(int(cx + dx) - 1 if dx < 0 else int(cx + dx), int(cy + dy) - 1, CACTUS_L)
    a.disc(cx, cy, 2.6, CACTUS_D)
    a.disc(cx - 0.3, cy - 0.3, 2.0, CACTUS)
    a.set(int(cx) - 1, int(cy) - 1, CACTUS_L)
    a.set(int(cx), int(cy), hexc('#f2e6a0'))  # a flower on top


def _prickly_pear(a, cx, cy):
    for (dx, dy, r) in ((0, 0, 1.8), (2.5, -1.5, 1.5), (-2.2, -1.2, 1.4)):
        a.disc(cx + dx, cy + dy, r + 0.6, CACTUS_D)
        a.disc(cx + dx - 0.3, cy + dy - 0.3, r, CACTUS)
    a.set(int(cx + 2.5), int(cy - 3), hexc('#e8505a'))


def _rock(a, cx, cy, r):
    a.ellipse(cx + 1.5, cy + 1.5, r, r * 0.8, SHADOW)
    a.ellipse(cx, cy, r + 0.6, r * 0.85 + 0.6, ROCK_D)
    a.ellipse(cx - 0.3, cy - 0.3, r, r * 0.85, ROCK)
    a.ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.5, r * 0.4, ROCK_L)


def _grass(a, rng, x0=0, y0=0, w=None, h=None):
    w = a.w if w is None else w
    h = a.h if h is None else h
    noise_fill(a, x0, y0, w, h, [(GRASS, 66), (GRASS_D, 18), (GRASS_L, 10), (SAND_D, 6)], rng)
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


def wagon_top(rng, covered=None, facing_up=True):
    """A parked wagon seen from above (11 x 18 with outline): a canvas-topped
    prairie schooner or an open buckboard, shafts forward."""
    covered = rng.random() < 0.5 if covered is None else covered
    c = Art(11, 18)
    # the tongue dropped on the ground, off to one side
    c.line(5, 3, 2, 0, WOOD_D)
    # four wheels standing clear of the bed at the corners
    for (x, y) in ((0, 3), (10, 3), (0, 14), (10, 14)):
        c.vline(x, y, y + 3, IRON)
        c.set(x, y + 1, hexc('#8a8486'))
    c.rect(1, 3, 9, 15, WOOD)
    c.vline(1, 3, 17, WOOD_L)
    c.vline(9, 3, 17, WOOD_D)
    c.hline(1, 9, 17, WOOD_DD)
    c.hline(2, 8, 4, WOOD_DD)  # the seat
    if covered:
        # the canvas bonnet bulges past the bed, ribbed by its hoops
        canvas = rng.choice(CANVAS_COLOURS)
        for y in range(6, 16):
            inset = 1 if y in (6, 15) else 0
            for x in range(1 + inset, 10 - inset):
                rib = (y - 6) % 3 == 2
                col = shade(canvas, 1.06) if x <= 3 else CANVAS_D if x >= 8 else canvas
                c.set(x, y, shade(col, 0.88) if rib else col)
        c.hline(4, 6, 15, hexc('#3a2a20'))  # the puckered opening at the back
        c.hline(4, 6, 6, hexc('#5a4030'))
    else:
        for x in (3, 5, 7):
            c.vline(x, 6, 16, WOOD_D)
        c.rect(2, 8, 3, 3, HAY)
        c.set(2, 8, HAY_L)
        c.rect(6, 12, 3, 3, hexc('#c9a46b'))  # sacks
        c.set(6, 12, hexc('#e6c890'))
        c.disc(4.5, 14.5, 1.4, WOOD_DD)  # a barrel
    c.outline(OUTLINE)
    return c if facing_up else c.rotated(2)


def _cow(a, x, y, facing=1, colour=COW):
    """A grazing cow, side on from above (7 x 4)."""
    a.ellipse(x + 3.5 + 1, y + 2.5, 3.6, 1.8, SHADOW)
    a.rect(x + 1, y, 5, 3, colour)
    a.hline(x + 1, x + 5, y, shade(colour, 1.25))
    hx = x + 6 if facing > 0 else x - 1
    a.rect(hx, y, 1, 2, shade(colour, 0.8))
    a.set(hx, y, hexc('#e8dcc8'))
    a.set(x + 3, y + 1, hexc('#efe6d6'))


# --- Shopfront helpers (the boarding house), the town well, wagon yards -----------------

def _wall(a, x0, x1, ya, yb, style):
    wall = style['wall']
    for y in range(ya, yb + 1):
        for x in range(x0, x1 + 1):
            if style.get('brick'):
                c = shade(wall, 1.15) if (y - ya) % 3 == 2 else wall
                if (y - ya) % 3 != 2 and (x + ((y - ya) // 3) * 2) % 5 == 0:
                    c = shade(wall, 0.85)
            elif style.get('stone'):
                c = wall if (x // 3 + y // 2) % 2 else shade(wall, 0.9)
                if (y - ya) % 2 == 1 and (x + y) % 3 == 0:
                    c = STONE_D
            else:
                c = wall if (y - ya) % 2 == 0 else shade(wall, 0.86)
            a.set(x, y, c)
    a.vline(x0, ya, yb, shade(wall, 1.1))
    a.vline(x1, ya, yb, shade(wall, 0.78))


def _window(a, x, y, w=3, h=3, trim=None, lit=False):
    if trim:
        a.rect(x - 1, y - 1, w + 2, h + 2, trim)
    a.rect(x, y, w, h, LIT if lit else GLASS)
    a.set(x, y, hexc('#fff0b0') if lit else GLASS_L)
    if w >= 3:
        a.vline(x + w // 2, y, y + h - 1, trim or WOOD_D)


def _storefront(a, rng, x0, x1, fy, y1, style, tall):
    """The false front: cornice, sign board, upper windows, the porch roof
    over the boardwalk, then the shop windows and the door."""
    trim = style['trim']
    _wall(a, x0, x1, fy, y1, style)
    a.hline(x0, x1, fy, trim)
    a.hline(x0, x1, y1, shade(style['wall'], 0.55))
    # sign board with a line of lettering
    sx0, sx1 = x0 + 2, x1 - 2
    a.rect(sx0, fy + 1, sx1 - sx0 + 1, 3, style['sign'])
    a.hline(sx0, sx1, fy + 1, shade(style['sign'], 1.25))
    lx = sx0 + 2
    while lx < sx1 - 1:
        if rng.random() < 0.8:
            a.set(lx, fy + 2, style['letters'])
        lx += 1 if rng.random() < 0.7 else 2
    y = fy + 5
    if tall:
        wx = x0 + 3
        while wx + 2 < x1 - 1:
            _window(a, wx, y, 3, 3, trim, lit=rng.random() < 0.12)
            wx += 7
        if style.get('doors') == 'batwing':
            a.hline(x0 + 1, x1 - 1, y + 4, trim)  # balcony rail
            for px in range(x0 + 1, x1, 3):
                a.set(px, y + 3, trim)
        y += 5
    # porch roof over the boardwalk, on posts
    a.rect(x0, y, x1 - x0 + 1, 2, shade(style['roof'], 1.25))
    a.hline(x0, x1, y + 1, shade(style['roof'], 0.9))
    gy = y + 2
    for px in range(x0 + 1, x1, 8):
        a.vline(px, gy, y1 - 1, trim)
    # shop windows and the door
    mid = (x0 + x1) // 2
    if style.get('doors') == 'barn':
        a.rect(mid - 3, gy, 7, y1 - gy, WOOD_D)
        a.line(mid - 3, gy, mid + 3, y1 - 1, WOOD_L)
        a.line(mid + 3, gy, mid - 3, y1 - 1, WOOD_L)
    else:
        a.rect(mid - 1, gy, 3, y1 - gy, DOOR)
        if style.get('doors') == 'batwing':
            a.rect(mid - 1, gy + 1, 1, 2, style['trim'])
            a.rect(mid + 1, gy + 1, 1, 2, style['trim'])
    for wx in range(x0 + 3, x1 - 3, 7):
        if abs(wx + 1 - mid) > 3:
            _window(a, wx, gy + 1, 3, max(2, y1 - gy - 2), None, lit=rng.random() < 0.1)


def _gable(a, x0, y0, x1, y1, roof, rng, tin=False):
    """A pitched roof seen from above, the ridge running front to back: the
    left slope in the sun, the right in shade."""
    mid = (x0 + x1) / 2
    dark = shade(roof, 0.8)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            left = x + 0.5 < mid
            c = roof if left else dark
            if tin:
                if (x - x0) % 2 == 0:
                    c = shade(c, 1.12)
            elif (y - y0) % 3 == 2:
                c = shade(c, 0.88)
            elif (x + ((y - y0) // 3) * 2) % 5 == 0:
                c = shade(c, 0.93)
            if rng.random() < 0.04:
                c = shade(c, 1.07)
            a.put(x, y, c)
    a.vline(int(mid), y0, y1, shade(roof, 1.2))
    a.hline(x0, x1, y0, shade(roof, 1.1))


def plaza_piece(variant):
    """Town square: the well with its little roof, or the flagpole."""
    rng = rng_for('plaza', variant)
    a = Art(T, T)
    _yard(a, rng, hexc('#ccae7a'), hexc('#bc9e6a'))
    cx, cy = T / 2, T / 2
    if variant == 0:
        a.disc(cx + 1.5, cy + 1.5, 7, SHADOW)
        a.disc(cx, cy, 7, STONE_D)
        a.disc(cx, cy, 6, STONE)
        a.disc(cx, cy, 4, hexc('#24303a'))
        a.disc(cx - 1, cy - 1, 1.5, WATER_D)
        # roof frame and windlass over the well
        a.vline(int(cx) - 6, int(cy) - 5, int(cy) + 5, WOOD_D)
        a.vline(int(cx) + 5, int(cy) - 5, int(cy) + 5, WOOD_D)
        a.hline(int(cx) - 6, int(cx) + 5, int(cy) - 1, WOOD)
        a.rect(int(cx) - 1, int(cy) - 3, 2, 3, WOOD_L)
    else:
        a.disc(cx, cy, 3, STONE)
        a.disc(cx, cy, 1.5, IRON)
        # the flag streams out from the pole
        for y in range(4):
            for x in range(9):
                c = hexc('#b8342a') if y % 2 == 0 else hexc('#efe6cf')
                if x < 4 and y < 2:
                    c = hexc('#2f4a8a')
                a.set(int(cx) + 1 + x, int(cy) - 8 + y, c)
        a.line(int(cx), int(cy) - 9, int(cx), int(cy), IRON)
        a.blit(wagon_top(rng, covered=False), 4, 12)
    for bx in (3, T - 9):
        a.rect(bx, T - 4, 6, 2, WOOD)
        a.hline(bx, bx + 5, T - 4, WOOD_L)
    return a


def wagon_yard(tw, th, variant):
    """A wagon yard: wagons parked in rows, straw underfoot."""
    rng = rng_for('wagons', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    _yard(a, rng, hexc('#bfa070'), hexc('#ae8f60'))
    for _ in range(w * h // 60):
        x, y = rng.randrange(w), rng.randrange(h)
        a.set(x, y, HAY_D)
    a.hline(0, w - 1, 0, WOOD)
    a.vline(0, 0, h - 1, WOOD)
    rows = 1 if th == 1 else 2
    row_h = (h - 2) // rows
    for r in range(rows):
        ry = 1 + r * row_h
        for sx in range(3, w - 12, 14):
            pick = rng.random()
            jitter = rng.randint(-2, 2)
            if pick < 0.72:
                a.blit(wagon_top(rng, facing_up=(r % 2 == 0)), sx, ry + (row_h - 18) // 2 + jitter)
            elif pick < 0.86:
                a.disc(sx + 5, ry + row_h // 2, 3.5, HAY_D)
                a.disc(sx + 4.5, ry + row_h // 2 - 0.5, 2.8, HAY)
            else:
                _barrel(a, sx + 3, ry + row_h // 2 - 3)
                _barrel(a, sx + 7, ry + row_h // 2 + 1)
                _crate(a, sx + 2, ry + row_h // 2 + 3, 4)
    return a


# --- Homesteads --------------------------------------------------------------------
#
# A house faces its street: the gate, front path and the parked wagon open
# onto that side. The 3/4 view only ever shows a house's south wall, so a
# plot facing up, left or right is told apart by where the house sits on it
# and where the path runs.

FACINGS = ('D', 'U', 'L', 'R')
HOUSE_LAYOUTS = ('lawn', 'driveway', 'tree')


def _fence(a, style='rail', side='D', openings=()):
    """Plot boundary: split-rail fence, whitewashed pickets, or none, left
    open at `openings` (positions along `side`) for the gate and the wagon."""
    if style == 'none':
        return
    open_at = set(openings)

    def mark(x, y, along, front):
        if style == 'picket' and front:
            a.put(x, y, hexc('#8a7e6a') if along % 3 == 0 else hexc('#ece4d0'))
        elif along % 2 == 0:
            a.put(x, y, WOOD_DD if along % 6 == 0 else WOOD)

    for x in range(a.w):
        if not (side == 'U' and x in open_at):
            mark(x, 0, x, side == 'U')
        if not (side == 'D' and x in open_at):
            mark(x, a.h - 1, x, side == 'D')
    for y in range(a.h):
        if not (side == 'L' and y in open_at):
            mark(0, y, y, side == 'L')
        if not (side == 'R' and y in open_at):
            mark(a.w - 1, y, y, side == 'R')


def _gate(x):
    return range(x - 2, x + 3)


def _path_v(a, x, y0, y1, wide=True):
    for y in range(y0, y1 + 1):
        a.put(x, y, YARD)
        if wide:
            a.put(x + 1, y, YARD_D)


def _path_h(a, y, x0, x1):
    for x in range(x0, x1 + 1):
        a.put(x, y, YARD)
        a.put(x, y + 1, YARD_D)


def _flowers(a, rng, count, boxes=()):
    for _ in range(count):
        fx, fy = rng.randint(2, a.w - 3), rng.randint(2, a.h - 3)
        if not any(bx0 - 1 <= fx <= bx1 + 3 and by0 - 1 <= fy <= by1 + 3 for bx0, by0, bx1, by1 in boxes):
            if a.get(fx, fy) in (GRASS, GRASS_D, GRASS_L):
                a.set(fx, fy, rng.choice(FLOWERS))


def _logs(a, x0, x1, y0, y1):
    """A log wall: rounded courses with dark chinking between."""
    for y in range(y0, y1 + 1):
        k = (y - y0) % 3
        for x in range(x0, x1 + 1):
            a.put(x, y, WOOD_L if k == 0 else WOOD if k == 1 else WOOD_DD)
        if k != 2:
            a.put(x0, y, hexc('#d8a870'))
            a.put(x1, y, hexc('#d8a870'))


def _house(a, rng, x0, y0, hw, roof_h, wall_h, kind=None):
    """A homestead house; (x0, y0) is the roof's top-left. kind: cabin (log
    walls, shake roof), frame (painted clapboard with a porch) or adobe (flat
    roof, beam ends). Returns its box and the door's column."""
    kind = kind or rng.choice(('cabin', 'frame', 'frame', 'frame'))
    x1 = x0 + hw - 1
    ry1 = y0 + roof_h - 1
    wy1 = ry1 + wall_h
    _cast_shadow(a, x0, y0, x1, wy1, 2)
    if kind == 'adobe':
        clay = rng.choice((hexc('#d4a070'), hexc('#c89468'), hexc('#dcb084')))
        # flat roof sunk inside a rounded parapet
        for y in range(y0, ry1 + 1):
            for x in range(x0, x1 + 1):
                rim = y in (y0, y0 + 1) or x in (x0, x0 + 1, x1 - 1, x1)
                a.put(x, y, shade(clay, 1.12) if rim else shade(clay, 0.86))
        a.hline(x0 + 2, x1 - 2, y0 + 2, shade(clay, 0.74))
        a.vline(x0 + 2, y0 + 2, ry1, shade(clay, 0.78))
        for y in range(ry1 + 1, wy1 + 1):
            a.hline(x0, x1, y, clay if (y + x0) % 3 else shade(clay, 0.95))
        a.hline(x0, x1, ry1 + 1, shade(clay, 0.8))
        a.hline(x0, x1, wy1, shade(clay, 0.7))
        # vigas poking out under the parapet
        for vx in range(x0 + 2, x1 - 1, 3):
            a.set(vx, ry1 + 1, WOOD_DD)
            a.set(vx, ry1 + 2, WOOD_D)
        door_x = x1 - 6
        a.rect(door_x, wy1 - 3, 3, 3, hexc('#2e6a8a'))  # turquoise door
        a.set(door_x + 2, wy1 - 2, hexc('#d8b060'))
        a.rect(x0 + 3, ry1 + 3, 4, 2, GLASS)
        a.set(x0 + 3, ry1 + 3, GLASS_L)
        for k in range(3):  # ristra of chilies by the door
            a.set(door_x - 2, ry1 + 2 + k, hexc('#b8342a'))
        a.line(x1 - 2, y0 + 3, x1 - 4, ry1 - 1, WOOD_L)  # ladder to the roof
        a.line(x1 - 1, y0 + 4, x1 - 3, ry1, WOOD_L)
    else:
        if kind == 'cabin':
            _logs(a, x0 + 1, x1 - 1, ry1 + 1, wy1)
            roof_l, roof_d = hexc('#8a7258'), hexc('#5e4e3c')
        else:
            paint = rng.choice(HOUSE_PAINTS)
            for y in range(ry1 + 1, wy1 + 1):
                a.hline(x0 + 1, x1 - 1, y, paint if (y - ry1) % 2 else shade(paint, 0.88))
            a.vline(x1 - 1, ry1 + 1, wy1, shade(paint, 0.8))
            roof_l, roof_d = rng.choice(HOUSE_ROOFS)
        a.hline(x0 + 1, x1 - 1, wy1, shade(a.get(x0 + 2, wy1 - 1), 0.7))
        door_x = x0 + 3 if kind == 'frame' else x1 - 6
        a.rect(door_x, wy1 - 3, 3, 3, DOOR if kind == 'frame' else hexc('#4a2e1e'))
        a.set(door_x + 2, wy1 - 2, hexc('#d8b060'))
        windows = (door_x + 6, x1 - 5) if kind == 'frame' else (x0 + 3,)
        for wx in windows:
            if wall_h >= 4 and wx + 3 < x1:
                a.rect(wx, ry1 + 2, 3, 2, GLASS)
                a.set(wx, ry1 + 2, GLASS_L)
        # roof: lit upper slope, shaded lower slope, bright ridge; shakes in courses
        mid = y0 + roof_h // 2
        for y in range(y0, ry1 + 1):
            for x in range(x0, x1 + 1):
                upper = y < mid
                c = roof_l if upper else roof_d
                if (y - y0) % 2 == 1 and (x + (y // 2) * 2) % 4 == 0:
                    c = shade(c, 0.85)
                a.put(x, y, c)
        a.hline(x0, x1, mid, shade(roof_l, 1.2))
        a.hline(x0, x1, ry1, shade(roof_d, 0.78))
        if kind == 'frame':
            # porch roof along the front, on posts
            a.hline(x0, x1, ry1 + 1, shade(roof_d, 1.1))
            for px in range(x0 + 1, x1, 6):
                a.vline(px, ry1 + 2, wy1, hexc('#ece4d0'))
        cx = x1 - 5 if rng.random() < 0.5 else x0 + 3
        _chimney(a, cx, y0 + 1, STONE if kind == 'cabin' else BRICK)
    _box_outline(a, x0, y0, x1, wy1)
    return (x0, y0, x1, wy1), door_x + 1


def _outhouse(a, x, y):
    a.rect(x, y, 5, 6, WOOD)
    a.rect(x, y, 5, 3, hexc('#7a6a5a'))
    a.hline(x, x + 4, y, hexc('#9a8a7a'))
    a.set(x + 2, y + 4, hexc('#ffd66b'))  # the moon cut in the door
    _box_outline(a, x, y, x + 4, y + 5)
    _cast_shadow(a, x, y, x + 4, y + 5, 1)


def _woodpile(a, x, y, w=7):
    for i in range(w):
        a.disc(x + i + 0.5, y + 0.5 + (i % 2), 1.1, hexc('#c89a60'))
        a.set(x + i, y + (i % 2), hexc('#8a6440'))


def _veg_patch(a, x0, y0, x1, y1):
    for row in range(y0, y1, 3):
        a.hline(x0, x1, row, hexc('#8a6440'))
        a.hline(x0, x1, row + 1, hexc('#a07a50'))
        for x in range(x0 + 1, x1, 3):
            a.set(x, row, LEAF_L)


def _well(a, cx, cy):
    a.disc(cx + 1, cy + 1, 3.4, SHADOW)
    a.disc(cx, cy, 3.4, STONE_D)
    a.disc(cx, cy, 2.6, STONE)
    a.disc(cx, cy, 1.6, hexc('#24303a'))
    a.hline(int(cx) - 3, int(cx) + 2, int(cy) - 3, WOOD_D)


def _coop(a, x, y):
    a.rect(x, y, 7, 5, hexc('#a8603e'))
    a.hline(x, x + 6, y, hexc('#c8805a'))
    _box_outline(a, x, y, x + 6, y + 4)
    for (cx, cy) in ((x + 1, y + 7), (x + 4, y + 8), (x + 7, y + 6)):
        a.set(cx, cy, hexc('#f2efe2'))
        a.set(cx + 1, cy, hexc('#e8a030'))


def house_lot(facing, layout, variant):
    """1x1 homestead facing its street. layout: lawn (sage by the door),
    driveway (narrow house beside the family wagon) or tree (a shade tree)."""
    rng = rng_for('house', facing, layout, variant)
    a = Art(T, T)
    _grass(a, rng)
    fence = ('picket', 'rail', 'none')[variant % 3]
    openings = []
    if facing in ('D', 'U'):
        down = facing == 'D'
        if layout == 'driveway':
            flip = variant % 2 == 1
            box, door = _house(a, rng, 13 if flip else 2, 3 if down else 8, 17, 10, 6)
            dx0 = 2 if flip else 19
            if down:
                a.rect(dx0, 12, 11, T - 12, YARD)
                a.blit(wagon_top(rng, facing_up=False), dx0, 13)
            else:
                a.rect(dx0, 0, 11, 21, YARD)
                a.blit(wagon_top(rng, facing_up=True), dx0, 2)
            openings += range(dx0, dx0 + 11)
        else:
            hw = rng.choice((18, 20)) if layout == 'tree' else rng.choice((18, 20, 22))
            hx = (T - hw) // 2 + (rng.choice((-3, 3)) if layout == 'tree' else rng.randint(-2, 2))
            roof_h, wall_h = (11, 5) if layout == 'tree' else (10, 6)
            box, door = _house(a, rng, hx, (3 if layout == 'tree' else 4) if down else 6, hw, roof_h, wall_h)
        if down:
            _path_v(a, door, box[3] + 1, T - 1, wide=layout != 'driveway')
        else:
            _path_v(a, door, 0, box[1] - 1, wide=layout != 'driveway')
        openings += _gate(door)
        _fence(a, fence, facing, openings)
        far = 7 if door > T // 2 else T - 8
        if layout == 'driveway':
            _sage(a, box[0] + 3, box[3] + 3)
        elif layout == 'tree':
            if down:
                draw_tree(a, far, T - 8, 5, rng)
            else:
                draw_tree(a, far, T - 6, 4, rng)
        elif down:
            _sage(a, box[0] + 2, box[3] + 3)
            _barrel(a, box[2] - 1, box[3] + 3)
            if rng.random() < 0.6:
                draw_tree(a, 5 if box[0] > 7 else T - 6, T - 7, 4, rng)
        else:
            _veg_patch(a, box[0] + 2, 25, box[0] + 11, 29)
            _woodpile(a, box[2] - 7, T - 4)
    else:
        left = facing == 'L'
        hw = 18
        box, door = _house(a, rng, 5 if left else T - 5 - hw, 3, hw, 10, 6)
        py = box[3] - 2
        if left:
            _path_h(a, py, 0, box[0] - 1)
        else:
            _path_h(a, py, box[2] + 1, T - 1)
        openings += range(py - 1, py + 3)
        if layout == 'driveway':
            a.rect(0 if left else T - 21, 20, 21, 11, YARD)
            a.blit(wagon_top(rng).rotated(1 if left else 3), 1 if left else T - 19, 20)
            openings += range(20, 31)
        _fence(a, fence, facing, openings)
        back = T - 7 if left else 6
        if layout == 'tree':
            draw_tree(a, back, T - 7, 5, rng)
        elif layout == 'lawn':
            _sage(a, box[0] + 3, box[3] + 4)
            _well(a, box[2] - 2, box[3] + 5)
            draw_tree(a, back + (1 if left else -1), T - 6, 4, rng)
    _flowers(a, rng, 4, [box])
    return a


def tall_house_lot(facing):
    """1x2: the house at the street end, a long garden behind with the
    vegetable rows, a chicken coop and the outhouse."""
    rng = rng_for('house12', facing)
    a = Art(T, 2 * T)
    _grass(a, rng)
    down = facing == 'D'
    box, door = _house(a, rng, 5, 36 if down else 6, 22, 10, 6, kind='frame')
    if down:
        _path_v(a, door, box[3] + 1, a.h - 1, wide=False)
    else:
        _path_v(a, door, 0, box[1] - 1, wide=False)
    _fence(a, 'picket' if down else 'rail', facing, _gate(door))
    gy = 0 if down else 34
    _veg_patch(a, 4, 5 + gy, 18, 20 + gy)
    _outhouse(a, 23, 4 + gy)
    _coop(a, 20, 19 + gy)
    _flowers(a, rng, 8, [box])
    return a


def wide_house_lot(facing):
    """2x1: a ranch house with a barn beside it, or with a corral out back."""
    rng = rng_for('house21', facing)
    a = Art(2 * T, T)
    _grass(a, rng)
    w, h = a.w, a.h
    if facing == 'D':
        box, door = _house(a, rng, 3, 4, 26, 10, 6, kind='frame')
        # a red barn with its hayloft door
        gx0, gy0, gx1, gy1 = box[2] + 3, 3, box[2] + 18, box[3]
        _cast_shadow(a, gx0, gy0, gx1, gy1, 2)
        _gable(a, gx0, gy0, gx1, gy1 - 6, hexc('#7a6a5a'), rng, tin=True)
        a.rect(gx0, gy1 - 5, gx1 - gx0 + 1, 6, hexc('#9c3428'))
        a.rect(gx0 + 5, gy1 - 4, 6, 5, WOOD_DD)
        a.line(gx0 + 5, gy1 - 4, gx0 + 10, gy1, hexc('#efe6cf'))
        a.line(gx0 + 10, gy1 - 4, gx0 + 5, gy1, hexc('#efe6cf'))
        _box_outline(a, gx0, gy0, gx1, gy1)
        a.rect(gx0 + 4, gy1 + 2, 8, h - gy1 - 2, YARD)
        _path_v(a, door, box[3] + 1, h - 1, wide=False)
        _fence(a, 'picket', facing, [*_gate(door), *range(gx0 + 4, gx0 + 12)])
        a.disc(w - 4, 8, 2.6, HAY_D)
        a.disc(w - 4.5, 7.5, 2.0, HAY)
    else:
        box, door = _house(a, rng, 4, 6, 26, 10, 6, kind='cabin')
        _path_v(a, door, 0, box[1] - 1, wide=False)
        # corral: rails round a dirt pen with a pair of cows
        cx0, cy0, cx1, cy1 = 36, 4, w - 4, h - 5
        a.rect(cx0, cy0, cx1 - cx0 + 1, cy1 - cy0 + 1, YARD)
        for x in range(cx0, cx1 + 1):
            a.put(x, cy0, WOOD_L if x % 2 else WOOD)
            a.put(x, cy1, WOOD if x % 2 else WOOD_D)
        for y in range(cy0, cy1 + 1):
            a.put(cx0, y, WOOD_L if y % 2 else WOOD)
            a.put(cx1, y, WOOD if y % 2 else WOOD_D)
        _cow(a, cx0 + 4, cy0 + 5, 1)
        _cow(a, cx0 + 12, cy0 + 13, -1, hexc('#2e2420'))
        _fence(a, 'rail', facing, [*_gate(door)])
        _sage(a, box[0] + 4, h - 5)
    _flowers(a, rng, 8, [box])
    return a


def boarding_lot():
    """2x2: a two-storey boarding house with a long porch."""
    rng = rng_for('boarding')
    a = Art(2 * T, 2 * T)
    _grass(a, rng)
    w = a.w
    x0, y0, x1, y1 = 6, 5, w - 8, 40
    _cast_shadow(a, x0, y0, x1, y1, 2)
    style = dict(wall=hexc('#d8c8a8'), trim=hexc('#7a4a36'), roof=hexc('#6e5a4a'),
                 sign=hexc('#7a4a36'), letters=hexc('#efe6cf'))
    _gable(a, x0, y0, x1, y1 - 15, style['roof'], rng)
    _chimney(a, x0 + 4, y0 + 3)
    _chimney(a, x1 - 7, y0 + 3)
    _box_outline(a, x0, y0, x1, y1 - 15)
    _storefront(a, rng, x0, x1, y1 - 14, y1, style, True)
    _box_outline(a, x0, y1 - 14, x1, y1)
    a.rect(w // 2 - 1, y1 + 1, 3, a.h - y1 - 1, YARD)
    _fence(a, 'picket', 'D', _gate(w // 2))
    for tx in (10, w - 12):
        draw_tree(a, tx, 52, 5, rng)
    _flowers(a, rng, 16, [(x0, y0, x1, y1)])
    return a


def garden_lot(variant):
    """Back garden for a plot with no street of its own (deep in a block)."""
    rng = rng_for('garden', variant)
    a = Art(T, T)
    _grass(a, rng)
    _fence(a, ('rail', 'picket')[variant])
    if variant == 0:
        _veg_patch(a, 4, 5, 18, 20)
        _outhouse(a, 22, 5)
        draw_tree(a, 23, 23, 5, rng)
        _woodpile(a, 4, 25)
    else:
        _coop(a, 4, 4)
        _well(a, 8, 21)
        # washing on the line
        a.hline(16, 28, 9, hexc('#8a8478'))
        for x, c in ((18, hexc('#efe6cf')), (21, hexc('#b8342a')), (25, hexc('#5a7cc0'))):
            a.rect(x, 10, 2, 3, c)
        draw_tree(a, 23, 22, 4, rng)
    _flowers(a, rng, 6)
    return a


# --- Freight & stock: the industrial side of town -----------------------------------

def _work_yard(a, rng):
    _yard(a, rng, hexc('#b89a68'), hexc('#a88a5a'))


def freight_barn(tw, th, variant):
    """A big plank freight barn with a ribbed tin roof and sliding doors
    onto the loading dock."""
    rng = rng_for('freight', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    _work_yard(a, rng)
    roofs = (hexc('#9a948a'), hexc('#8a5a44'), hexc('#7a6a58'))
    shape = {(2, 1): 0, (1, 2): 1, (2, 2): 2}[(tw, th)]
    roof = roofs[(shape + variant) % len(roofs)]
    wall = (hexc('#9a6a44'), hexc('#a84a34'))[variant % 2]
    x0, y0, x1, y1 = 2, 2, w - 4, h - 8
    fy = y1 - 6 + 1
    _cast_shadow(a, x0, y0, x1, y1, 2)
    for x in range(x0, x1 + 1):
        a.vline(x, fy, y1, wall if x % 3 else shade(wall, 0.84))
    a.hline(x0, x1, y1, shade(wall, 0.6))
    doors = max(1, (x1 - x0) // 16)
    for i in range(doors):
        dx = x0 + 4 + i * ((x1 - x0 - 8) // doors)
        a.rect(dx, fy + 1, 9, 5, WOOD_DD)
        a.line(dx, fy + 1, dx + 8, y1, WOOD_D)
        a.line(dx + 8, fy + 1, dx, y1, WOOD_D)
        _crate(a, dx - 1, y1 + 2, 3)
    _gable(a, x0, y0, x1, fy - 1, roof, rng, tin=True)
    _box_outline(a, x0, y0, x1, y1)
    for x in range(x0, x1, 9):
        _barrel(a, x + 6, h - 3, 1.6)
    return a


def lumber_yard(tw, th, variant):
    """Stacked logs with their ends showing, plank piles, crates and barrels."""
    rng = rng_for('lumber', tw, th, variant)
    w, h = tw * T, th * T
    a = Art(w, h)
    _work_yard(a, rng)
    for _ in range(w * h // 40):
        a.set(rng.randrange(w), rng.randrange(h), hexc('#d8b880'))  # sawdust
    y = 3
    while y + 8 < h - 2:
        x = 3
        while x + 14 < w - 2:
            if rng.random() < 0.7:
                # a log stack: long logs side by side, ends towards us
                _cast_shadow(a, x, y, x + 13, y + 6, 1)
                for k in range(4):
                    a.rect(x, y + k * 2, 14, 2, hexc('#8a5a34') if k % 2 else hexc('#7a4e2c'))
                    a.set(x + 13, y + k * 2, hexc('#e0b47a'))
                    a.set(x + 13, y + k * 2 + 1, hexc('#c0945a'))
            else:
                _cast_shadow(a, x, y, x + 11, y + 5, 1)
                for k in range(6):
                    a.hline(x, x + 11, y + k, WOOD_L if k % 2 == 0 else hexc('#d8aa70'))
            x += 16
        y += 10
    for _ in range(tw * 2):
        _crate(a, rng.randint(2, w - 7), rng.randint(2, h - 7), 4)
    for _ in range(2):
        _barrel(a, rng.randint(3, w - 4) + 0.5, rng.randint(3, h - 4) + 0.5)
    return a


def _water_tower(a, cx, cy, r):
    a.disc(cx + 3, cy + 3, r, SHADOW)
    for (dx, dy) in ((-r + 1, -r + 1), (r - 1, -r + 1), (-r + 1, r - 1), (r - 1, r - 1)):
        a.rect(int(cx + dx), int(cy + dy), 2, 2, WOOD_DD)  # legs
    a.disc(cx, cy, r + 1, OUTLINE)
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > r:
                continue
            # conical roof: lit on the upper-left, plank seams radiating
            ang = math.atan2(dy, dx)
            seam = int((ang + math.pi) / (math.pi / 8)) % 2
            c = hexc('#8a7a64') if dx + dy < 0 else hexc('#5e5244')
            if seam:
                c = shade(c, 0.9)
            a.put(x, y, c)
    a.disc(cx, cy, 1.3, IRON)


def tower_piece(variant):
    """2x2: water towers on stilts with pipes between them, or the stockyard:
    rail pens full of cattle."""
    rng = rng_for('towers', variant)
    a = Art(2 * T, 2 * T)
    _work_yard(a, rng)
    if variant == 0:
        a.hline(16, 47, 20, IRON)
        a.vline(47, 20, 46, IRON)
        _water_tower(a, 18, 18, 11)
        _water_tower(a, 45, 44, 13)
        _barrel(a, 50, 12)
        _crate(a, 8, 48, 5)
    else:
        for x in range(2, 62):
            for y in (2, 31, 61):
                a.put(x, y, WOOD_L if x % 2 else WOOD)
        for y in range(2, 62):
            for x in (2, 31, 61):
                a.put(x, y, WOOD_L if y % 2 else WOOD)
        for _ in range(9):
            _cow(a, rng.randint(5, 50), rng.randint(5, 56), rng.choice((-1, 1)),
                 rng.choice((COW, hexc('#2e2420'), hexc('#a8603e'), hexc('#d8ccb8'))))
        a.rect(36, 40, 18, 3, WOOD_D)  # feed trough
        a.hline(37, 52, 41, HAY)
    return a


def sawmill_piece(variant):
    """A smithy or sawmill shed open to the yard, smoke stack on the roof."""
    rng = rng_for('sawmill', variant)
    a = Art(T, T)
    _work_yard(a, rng)
    x0, y0, x1, y1 = 2, 2, T - 4, T - 9
    fy = y1 - 5
    _cast_shadow(a, x0, y0, x1, y1, 2)
    wall = hexc('#9a6a44') if variant % 2 else STONE
    a.rect(x0, fy, x1 - x0 + 1, y1 - fy + 1, wall)
    a.rect(x0 + 3, fy + 1, 10, y1 - fy, hexc('#2a1e18'))
    if variant % 2:
        a.disc(x0 + 8, fy + 3, 2.2, hexc('#c8ccd4'))  # saw blade
        a.set(x0 + 8, fy + 3, IRON)
    else:
        a.rect(x0 + 5, fy + 3, 3, 2, hexc('#ff8a2a'))  # forge glow
        a.set(x0 + 6, fy + 3, hexc('#ffe070'))
    _gable(a, x0, y0, x1, fy - 1, hexc('#7a7068'), rng, tin=True)
    a.rect(x1 - 5, y0 + 1, 3, 4, IRON)
    a.set(x1 - 4, y0 + 1, hexc('#1a1414'))
    _box_outline(a, x0, y0, x1, y1)
    if variant % 2:
        a.rect(4, T - 6, 18, 3, hexc('#7a4e2c'))
        a.set(21, T - 6, hexc('#e0b47a'))
        a.set(21, T - 5, hexc('#c0945a'))
    else:
        a.rect(20, T - 7, 4, 2, IRON)  # anvil
        a.rect(21, T - 5, 2, 2, IRON)
        _barrel(a, 8, T - 5)
    return a


# --- The town common ------------------------------------------------------------------

def _scrub(a, rng, w, h, trees):
    """Cottonwoods, sage and wildflowers. No paths: they'd dead-end at the
    lot edge wherever park lots join up into one bigger common."""
    for _ in range(w * h // 180):
        fx, fy = rng.randint(2, w - 3), rng.randint(2, h - 3)
        a.set(fx, fy, rng.choice(FLOWERS))
    for _ in range(w * h // 260):
        _sage(a, rng.randint(4, w - 5), rng.randint(4, h - 5))
    _scatter_trees(a, rng, (0, 0, w, h), trees)


def park_piece(tw, th, kind):
    """Grass runs to every edge so neighbouring park lots merge into one
    common. kind: scrub, bandstand (1x1) or wateringhole (2x2)."""
    rng = rng_for('park', tw, th, kind)
    w, h = tw * T, th * T
    a = Art(w, h)
    _grass(a, rng)
    if kind == 'wateringhole':
        cx, cy = w / 2, h / 2 + 1
        a.ellipse(cx, cy, 19, 14, hexc('#a8885a'))
        a.ellipse(cx, cy, 17, 12, WATER_D)
        a.ellipse(cx - 1, cy - 1, 15, 10, WATER)
        for i in range(6):
            a.hline(int(cx - 8 + i * 3), int(cx - 6 + i * 3), int(cy - 5 + (i % 3) * 4), WATER_L)
        for (px, py) in [(cx + 13, cy + 5), (cx - 15, cy + 4), (cx - 12, cy - 8)]:
            for k in range(3):
                a.vline(int(px) + k, int(py) - 2 - k % 2, int(py), hexc('#6e8a3c'))  # reeds
        for (tx, ty, tr) in [(8, 9, 5), (w - 9, 10, 6), (9, h - 9, 5), (w - 8, h - 8, 4)]:
            draw_tree(a, tx, ty, tr, rng)
    elif kind == 'bandstand':
        cx, cy = T / 2, T / 2
        a.disc(cx + 2, cy + 2, 10, SHADOW)
        for y in range(T):
            for x in range(T):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                if max(abs(dx), abs(dy), (abs(dx) + abs(dy)) / 1.35) > 10:
                    continue
                # a white-painted gazebo: shingled roof panels, ribs between
                ang = math.atan2(dy, dx)
                rib = abs(((ang + math.pi) / (math.pi / 4)) % 1 - 0.5) > 0.42
                c = hexc('#5e7a5a') if not rib else hexc('#efe6cf')
                if dx + dy > 0:
                    c = shade(c, 0.82)
                a.put(x, y, c)
        a.disc(cx, cy, 1.5, hexc('#ffc933'))
        a.blit(_octagon_outline(T, cx, cy, 10), 0, 0)
    else:
        _scrub(a, rng, w, h, tw * th * 2 + 1)
    return a


def _octagon_outline(size, cx, cy, r):
    o = Art(size, size)
    for y in range(size):
        for x in range(size):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            m = max(abs(dx), abs(dy), (abs(dx) + abs(dy)) / 1.35)
            if r < m <= r + 1:
                o.put(x, y, OUTLINE)
    return o


# --- Bare ground (under the landmarks) -----------------------------------------------

def ground_piece():
    rng = rng_for('ground')
    a = Art(T, T)
    _yard(a, rng)
    return a


# --- Catalogue -------------------------------------------------------------------

FOOTPRINTS = ((1, 1), (2, 1), (1, 2), (2, 2))


def city_pieces():
    """[{name, zone, art, faces?, back?}] — every lot piece, by district zone.

    faces: the side ('U', 'R', 'D', 'L') a piece must have a street on.
    back: the piece is only for lots with no street at all.
    """
    pieces = []

    def add(name, zone, art, **extra):
        pieces.append({'name': name, 'zone': zone, 'art': art, **extra})

    import art_town

    # Main Street: every business its own false front, and the town well
    for name, (tw, th), spec in art_town.DOWNTOWN:
        add(f'front_{tw}x{th}_{name}', 'downtown', art_town.false_front(tw, th, spec))
    for v in range(2):
        add(f'plaza_{v}', 'downtown', plaza_piece(v))

    # The trades, a block back: smithy, livery, feed store, wagon yards
    for name, (tw, th), spec in art_town.COMMERCIAL:
        add(f'trade_{tw}x{th}_{name}', 'commercial', art_town.false_front(tw, th, spec))
    for v in range(2):
        add(f'wagons_2x1_{v}', 'commercial', wagon_yard(2, 1, v))
    add('wagons_2x2', 'commercial', wagon_yard(2, 2, 0))

    # Homesteads facing their street, back gardens, a boarding house
    for facing in FACINGS:
        for i, layout in enumerate(HOUSE_LAYOUTS):
            add(f'house_1x1_{facing}_{layout}', 'residential', house_lot(facing, layout, FACINGS.index(facing) + i),
                faces=facing)
    for facing in ('D', 'U'):
        add(f'house_2x1_{facing}', 'residential', wide_house_lot(facing), faces=facing)
        add(f'house_1x2_{facing}', 'residential', tall_house_lot(facing), faces=facing)
    add('boarding_2x2', 'residential', boarding_lot())
    add('church_1x2', 'residential', art_town.church(1, 2), faces='D')
    add('church_2x2', 'residential', art_town.church(2, 2), faces='D')
    add('school_1x1', 'residential', art_town.schoolhouse(), faces='D')
    for v in range(2):
        add(f'garden_{v}', 'residential', garden_lot(v), back=True)

    # Freight barns, lumber yards, water towers and the stockyard
    for v in range(2):
        for tw, th in FOOTPRINTS[1:]:
            add(f'freight_{tw}x{th}_{v}', 'industrial', freight_barn(tw, th, v))
        add(f'sawmill_{v}', 'industrial', sawmill_piece(v))
        add(f'lumber_1x1_{v}', 'industrial', lumber_yard(1, 1, v))
        add(f'lumber_2x1_{v}', 'industrial', lumber_yard(2, 1, v))
    add('towers_2x2', 'industrial', tower_piece(0))
    add('towers_1x1', 'industrial', art_town.water_tower())
    add('stockyard_2x2', 'industrial', tower_piece(1))

    # The commons fill whole blocks
    add('park_1x1_scrub', 'park', park_piece(1, 1, 'scrub'))
    add('bandstand', 'park', park_piece(1, 1, 'bandstand'))
    add('park_2x1_scrub', 'park', park_piece(2, 1, 'scrub'))
    add('park_1x2_scrub', 'park', park_piece(1, 2, 'scrub'))
    add('wateringhole', 'park', park_piece(2, 2, 'wateringhole'))

    return pieces


def build_city_tiles():
    """Returns (tiles: [Art 32x32], manifest dict).

    Identical tiles are stored once, however many pieces use them.
    """
    tiles = []
    index = {}

    def add_tile(tile):
        key = tile.im.tobytes()
        if key not in index:
            index[key] = len(tiles)
            tiles.append(tile)
        return index[key]

    roads = {}
    for mask, corners in road_combos():
        straight = mask in (U | D, L | R)
        variants = len(STRAIGHT_VARIANTS) if straight else 1
        roads[f'{mask},{corners}'] = [add_tile(road_tile(mask, corners, v)) for v in range(variants)]

    pieces = []
    for p in city_pieces():
        art = p.pop('art')
        tw, th = art.w // T, art.h // T
        ids = []
        for ty in range(th):
            for tx in range(tw):
                tile = Art(T, T)
                tile.blit(art.im.crop((tx * T, ty * T, tx * T + T, ty * T + T)), 0, 0)
                ids.append(add_tile(tile))
        pieces.append({**p, 'w': tw, 'h': th, 'tiles': ids})

    ground = add_tile(ground_piece())
    return tiles, {'roads': roads, 'pieces': pieces, 'ground': ground}
