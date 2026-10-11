"""The open range: everything past the edge of town.

Ground is a blend of two terrains, sand (desert) and dry grass (prairie),
chosen per tile *corner* so the boundary between them wanders across tiles
instead of following the grid (16 corner tiles, the uniform ones in several
variants). The river is its own autotile, banks and all; wagon trails,
bridges and the scatter of cacti, scrub and boulders are drawn on a
transparent overlay so one trail tile works on either terrain.

Mountains and mesas are big sprites (src/landLayout.js places them over
footprints the map generator kept clear), drawn in the same 3/4 view as the
town: lit from the upper left, faces in shade on the right.
"""
import math

from pixelkit import Art, hexc, shade, mix, with_alpha, rng_for
import art_city as city

T = city.T
OUTLINE = city.OUTLINE
SHADOW = city.SHADOW

SAND, SAND_D, SAND_L = city.SAND, city.SAND_D, city.SAND_L
GRASS, GRASS_D, GRASS_L, TUFT = city.GRASS, city.GRASS_D, city.GRASS_L, city.TUFT
PEBBLE = hexc('#c8ab78')
RIPPLE = hexc('#ecd8a8')
FLOWER = [hexc('#f5d547'), hexc('#e8743c'), hexc('#c88ae0'), hexc('#f2efe2')]

WATER = hexc('#4a90bc')
WATER_D = hexc('#356f98')
WATER_DD = hexc('#2a5a7e')
WATER_L = hexc('#8cc8e4')
FOAM = hexc('#d6eef4')
WET = hexc('#9c8058')
WET_L = hexc('#b49868')
REED = hexc('#4c6a2e')
REED_L = hexc('#7a9a44')
CATTAIL = hexc('#6a4426')

TRAIL = hexc('#c29c64')
TRAIL_D = hexc('#a8844f')
TRAIL_L = hexc('#d4b27c')
HOOF = hexc('#97754a')

PLANK = hexc('#9a6a3c')
PLANK_L = hexc('#b8844e')
PLANK_D = hexc('#6e4628')
PLANK_DD = hexc('#4a2e1a')

CACTUS = hexc('#5a9a4a')
CACTUS_L = hexc('#88c068')
CACTUS_D = hexc('#3a6a34')
CACTUS_DD = hexc('#24442a')

U, R, D, L = 1, 2, 4, 8


# --- Noise -------------------------------------------------------------------------

def smooth_noise(rng, cell, size=T):
    """Tile-local value noise in [0, 1], one lattice value every `cell` pixels."""
    n = size // cell + 2
    g = [[rng.random() for _ in range(n)] for _ in range(n)]

    def f(x, y):
        fx, fy = x / cell, y / cell
        ix, iy = int(math.floor(fx)), int(math.floor(fy))
        tx, ty = fx - ix, fy - iy
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        x0, x1, y0, y1 = ix % n, (ix + 1) % n, iy % n, (iy + 1) % n
        top = g[y0][x0] + (g[y0][x1] - g[y0][x0]) * tx
        bottom = g[y1][x0] + (g[y1][x1] - g[y1][x0]) * tx
        return top + (bottom - top) * ty
    return f


def _pick(rng, choices):
    total = sum(w for _, w in choices)
    r = rng.random() * total
    for c, w in choices:
        r -= w
        if r <= 0:
            return c
    return choices[-1][0]


SAND_MIX = [(SAND, 70), (SAND_D, 16), (SAND_L, 14)]
GRASS_MIX = [(GRASS, 64), (GRASS_D, 18), (GRASS_L, 12), (SAND_D, 6)]


# --- Terrain -----------------------------------------------------------------------

TERRAIN_VARIANTS = 4  # of each uniform tile


def terrain_tile(corners, variant=0):
    """Ground for one cell. corners = (ul, ur, dr, dl), 1 = grass, 0 = sand.

    Grass covers the pixels where the corners' bilinear weight beats a noisy
    threshold. The noise fades out towards the tile's edges, so along a
    shared edge both neighbours put the boundary in exactly the same place."""
    ul, ur, dr, dl = corners
    rng = rng_for('terrain', corners, variant)
    a = Art(T, T)
    n = smooth_noise(rng, 6)
    grass_at = {}
    for y in range(T):
        for x in range(T):
            u, v = (x + 0.5) / T, (y + 0.5) / T
            w = ul * (1 - u) * (1 - v) + ur * u * (1 - v) + dr * u * v + dl * (1 - u) * v
            edge = min(1.0, min(u, 1 - u, v, 1 - v) * 5)
            t = 0.5 + (n(x, y) - 0.5) * 0.8 * edge
            g = w > t
            grass_at[(x, y)] = g
            if g:
                c = _pick(rng, GRASS_MIX)
                if w - t < 0.06:
                    c = GRASS_D if rng.random() < 0.6 else TUFT  # the grass's ragged fringe
            else:
                c = _pick(rng, SAND_MIX)
                if t - w < 0.05:
                    c = SAND_D
            a.put(x, y, c)

    # Wind ripples and pebbles on the sand, tufts and the odd flower in the grass
    for _ in range(5 if sum(corners) == 0 else 2):
        x, y = rng.randint(2, T - 7), rng.randint(2, T - 3)
        if all(not grass_at[(x + k, y)] for k in range(5)):
            for k in range(rng.randint(3, 5)):
                a.put(x + k, y, RIPPLE)
                a.put(x + k, y + 1, SAND_D if k % 2 else SAND)
    for _ in range(6):
        x, y = rng.randint(1, T - 2), rng.randint(1, T - 2)
        if not grass_at[(x, y)]:
            a.put(x, y, PEBBLE)
            a.put(x + 1, y + 1, shade(PEBBLE, 0.8))
    for _ in range(9 if sum(corners) == 4 else 4):
        x, y = rng.randint(1, T - 2), rng.randint(2, T - 2)
        if grass_at[(x, y)] and grass_at[(x - 1, y)] and grass_at[(x + 1, y)]:
            a.put(x, y, TUFT)
            a.put(x - 1, y - 1, TUFT)
            a.put(x + 1, y - 1, TUFT)
            a.put(x, y - 1, GRASS_D)
    if sum(corners) == 4 and variant % 2 == 1:
        for _ in range(3):
            x, y = rng.randint(2, T - 3), rng.randint(2, T - 3)
            a.put(x, y, rng.choice(FLOWER))
    return a


def terrain_keys():
    """Every corner pattern: (ul, ur, dr, dl)."""
    return [((k >> 3) & 1, (k >> 2) & 1, (k >> 1) & 1, k & 1) for k in range(16)]


# --- River -------------------------------------------------------------------------

RIVER_MASKS = (U | D, L | R, U | R, R | D, D | L, L | U)
RIVER_VARIANTS = 3  # of each straight

# A bend's arc is centred on the tile corner between its two open sides
BEND_CENTRE = {U | R: (T, 0), R | D: (T, T), D | L: (0, T), L | U: (0, 0)}


def channel_distance(mask, x, y):
    """Distance from pixel centre (x, y) to the middle of a channel that
    leaves the tile through every side in `mask` (bends follow an arc)."""
    px, py = x + 0.5, y + 0.5
    if mask in BEND_CENTRE:
        cx, cy = BEND_CENTRE[mask]
        return abs(math.hypot(px - cx, py - cy) - T / 2)
    mid = T / 2
    best = None
    for side, (ex, ey) in ((U, (mid, 0)), (R, (T, mid)), (D, (mid, T)), (L, (0, mid))):
        if not mask & side:
            continue
        # distance to the half-segment from the centre out to that side
        vx, vy = ex - mid, ey - mid
        t = max(0.0, min(1.0, ((px - mid) * vx + (py - mid) * vy) / (vx * vx + vy * vy)))
        d = math.hypot(px - (mid + vx * t), py - (mid + vy * t))
        best = d if best is None else min(best, d)
    return math.hypot(px - mid, py - mid) if best is None else best


def _flow(mask, x, y):
    """Unit vector along the current at (x, y)."""
    if mask in BEND_CENTRE:
        cx, cy = BEND_CENTRE[mask]
        dx, dy = x + 0.5 - cx, y + 0.5 - cy
        r = math.hypot(dx, dy) or 1
        return -dy / r, dx / r
    return (0, 1) if mask & U else (1, 0)


WATER_HALF = 8.2
BANK = 10.4


def river_tile(mask, variant=0):
    """A stretch of river with muddy banks, on prairie grass (the map keeps
    the grass up to the water's edge on both sides)."""
    rng = rng_for('river', mask, variant)
    a = terrain_tile((1, 1, 1, 1), 100 + variant)
    n = smooth_noise(rng, 5)
    for y in range(T):
        for x in range(T):
            d = channel_distance(mask, x, y) + (n(x, y) - 0.5) * 1.6
            if d <= WATER_HALF:
                c = WATER
                if d > WATER_HALF - 1.4:
                    c = WATER_DD if d > WATER_HALF - 0.6 else WATER_D
                elif d < 2.5 and rng.random() < 0.08:
                    c = WATER_L
                a.put(x, y, c)
            elif d <= BANK:
                a.put(x, y, WET if d < BANK - 0.8 or rng.random() < 0.5 else WET_L)
            elif d <= BANK + 1:
                a.put(x, y, shade(a.get(x, y), 0.88))
    # Glints running with the current
    for _ in range(7):
        x, y = rng.randint(2, T - 3), rng.randint(2, T - 3)
        if channel_distance(mask, x, y) > WATER_HALF - 2.5:
            continue
        fx, fy = _flow(mask, x, y)
        length = rng.randint(2, 4)
        for k in range(length):
            a.put(int(x + fx * k), int(y + fy * k), FOAM if k == 0 else WATER_L)
    # Reeds and the odd rock along the banks
    for _ in range(rng.randint(2, 4)):
        x, y = rng.randint(1, T - 2), rng.randint(3, T - 2)
        d = channel_distance(mask, x, y)
        if BANK - 0.5 <= d <= BANK + 2.5:
            for k in range(3):
                h = rng.randint(2, 4)
                rx = x + k - 1
                a.vline(rx, y - h, y, REED if k != 1 else REED_L)
                if k == 1:
                    a.put(rx, y - h - 1, CATTAIL)
                    a.put(rx, y - h - 2, CATTAIL)
    if variant == 2:
        for _ in range(2):
            x, y = rng.randint(3, T - 4), rng.randint(3, T - 4)
            if WATER_HALF - 3 < channel_distance(mask, x, y) < WATER_HALF - 1:
                a.disc(x + 0.5, y + 0.5, 1.6, hexc('#7c7064'))
                a.put(x, y, hexc('#a89c8c'))
                a.put(x + 1, y + 2, FOAM)
    return a


# --- Wagon trails (overlay) --------------------------------------------------------

TRAIL_HALF = 8.0
TRAIL_VARIANTS = 3  # of each straight


def trail_tile(mask, variant=0):
    """Two wheel ruts worn into the ground, grass hanging on between them,
    on a transparent tile so it lies on sand or grass alike."""
    rng = rng_for('trail', mask, variant)
    a = Art(T, T)
    n = smooth_noise(rng, 4)
    junction = bin(mask).count('1') >= 3
    for y in range(T):
        for x in range(T):
            d = channel_distance(mask, x, y)
            edge = TRAIL_HALF + (n(x, y) - 0.5) * 2.2
            if d > edge + 0.8:
                continue
            if d > edge:
                if (x + y) % 2 == 0:
                    a.put(x, y, TRAIL_D)  # dithered, crumbling verge
                continue
            c = _pick(rng, [(TRAIL, 70), (TRAIL_L, 18), (TRAIL_D, 12)])
            if not junction and 3.4 <= d <= 5.0 and rng.random() < 0.85:
                c = TRAIL_D if rng.random() < 0.8 else HOOF  # the ruts
            elif d > edge - 1:
                c = TRAIL_D
            a.put(x, y, c)
            if not junction and d < 1.6 and n(x * 2 % T, y) > 0.6 and rng.random() < 0.55:
                a.put(x, y, mix(GRASS_D, TRAIL, 0.35))  # grass between the ruts
    if junction:
        for _ in range(12):
            x, y = rng.randint(11, 20), rng.randint(11, 20)
            a.put(x, y, rng.choice((TRAIL_D, HOOF)))
    # Hoofprints in the dust
    for _ in range(3 + variant):
        x, y = rng.randint(4, T - 5), rng.randint(4, T - 5)
        if channel_distance(mask, x, y) < 2.2:
            a.put(x, y, HOOF)
            a.put(x + 1, y + 1, HOOF)
    if variant == 2 and mask in (U | D, L | R):
        # a stone kicked to the verge
        x, y = (21, 9) if mask == U | D else (9, 21)
        a.disc(x + 0.5, y + 0.5, 1.5, hexc('#8c7a64'))
        a.put(x, y, hexc('#b8a68e'))
    return a


def trail_masks():
    return list(range(1, 16))


# --- Bridges (overlay) -------------------------------------------------------------

def bridge_tile(axis):
    """A plank bridge carrying a trail over the river. axis 'V': the trail
    runs up-down over a river flowing left-right."""
    a = Art(T, T)
    rng = rng_for('bridge')
    x0, x1 = 8, 23
    top, bottom = 4, 27
    # the trail running onto and off the bridge
    for y in list(range(0, top)) + list(range(bottom + 1, T)):
        for x in range(x0, x1 + 1):
            a.put(x, y, _pick(rng, [(TRAIL, 70), (TRAIL_L, 15), (TRAIL_D, 15)]))
    # shadow on the water off the downstream side
    for y in range(top + 2, bottom):
        for x in (x1 + 2, x1 + 3):
            a.put(x, y, with_alpha(WATER_DD, 150))
    # stringers and the deck: planks laid across the way
    for y in range(top, bottom + 1):
        for x in range(x0 - 1, x1 + 2):
            if x in (x0 - 1, x1 + 1):
                c = PLANK_DD
            else:
                c = PLANK_D if (y - top) % 3 == 2 else (PLANK_L if (y - top) % 3 == 0 else PLANK)
                if (x + (y // 3) * 4) % 9 == 0:
                    c = PLANK_D
            a.put(x, y, c)
    # handrails on posts
    for x in (x0 - 2, x1 + 2):
        a.vline(x, top, bottom, PLANK_L if x < 16 else PLANK_D)
        for y in range(top, bottom + 1, 5):
            a.put(x, y, PLANK_DD)
            a.put(x, y + 1, PLANK_DD)
    # stone abutments where the bridge meets each bank
    for y in (top - 1, bottom + 1):
        for x in range(x0 - 2, x1 + 3):
            a.put(x, y, hexc('#8c8478') if (x + y) % 3 else hexc('#6c645a'))
    return a if axis == 'V' else a.rotated(1)


# --- Scrub, cacti and boulders (overlay) -------------------------------------------
#
# Each piece is its own little sprite, outlined, standing on its base point;
# a decor tile is a few of them set down in depth order with their shadows.

def _finish(s):
    s.outline(OUTLINE)
    return s


def saguaro(h, arms):
    """The giant cactus side on: a ribbed trunk h tall and arms that elbow
    out and turn skyward. arms: [(side -1/1, height up the trunk, reach)]."""
    w = 15
    s = Art(w, h + 2)
    cx = w // 2
    rib = [CACTUS_L, CACTUS, CACTUS, CACTUS_D]

    def column(x0, y0, y1, cols=4):
        for y in range(y0, y1 + 1):
            for k in range(cols):
                s.put(x0 + k, y, rib[k] if cols == 4 else (CACTUS_L, CACTUS, CACTUS_D)[k])
        s.put(x0, y0, (0, 0, 0, 0))  # rounded crown
        s.put(x0 + cols - 1, y0, (0, 0, 0, 0))

    column(cx - 2, 1, h + 1)
    for side, up, reach in arms:
        ay = h + 1 - up
        xs = range(cx - 2 - reach, cx - 1) if side < 0 else range(cx + 2, cx + 3 + reach)
        for x in xs:
            s.put(x, ay - 1, CACTUS_L)
            s.put(x, ay, CACTUS)
            s.put(x, ay + 1, CACTUS_D)
        top = max(1, ay - 2 - reach * 2)
        column(cx - 2 - reach - 1 if side < 0 else cx + 2 + reach, top, ay + 1, 3)
    s.put(cx, 1, hexc('#f2e6a0'))  # a bloom on the crown
    return _finish(s), (cx, h + 1)


def prickly_pear(rng):
    s = Art(13, 11)
    pads = [(6, 7, 3.0, 2.4), (3.5, 4.5, 2.2, 2.0), (9, 4, 2.3, 2.1), (6.5, 2.5, 1.8, 1.6)]
    for (x, y, rx, ry) in pads[:rng.randint(3, 4)]:
        s.ellipse(x, y, rx, ry, CACTUS_D)
        s.ellipse(x - 0.4, y - 0.4, rx - 0.6, ry - 0.6, CACTUS)
        s.put(int(x - rx * 0.4), int(y - ry * 0.4), CACTUS_L)
        s.put(int(x + rx * 0.3), int(y), CACTUS_DD)
    for _ in range(2):
        s.put(rng.randint(3, 9), rng.randint(1, 3), hexc('#d8405a'))  # the fruit
    return _finish(s), (6, 10)


def barrel_cactus():
    s = Art(8, 8)
    s.ellipse(3.5, 4.5, 3.2, 3.2, CACTUS_D)
    for x in range(1, 7):
        for y in range(2, 8):
            if s.filled(x, y) and x % 2 == 1:
                s.put(x, y, CACTUS if x < 4 else CACTUS_D)
    s.put(2, 3, CACTUS_L)
    s.put(3, 1, hexc('#f5c842'))
    s.put(4, 1, hexc('#e8743c'))
    return _finish(s), (4, 7)


def ocotillo(rng):
    s = Art(13, 16)
    base = (6, 15)
    for k in range(5):
        ang = -math.pi / 2 + (k - 2) * 0.32 + rng.uniform(-0.08, 0.08)
        length = rng.randint(10, 14)
        for t in range(length):
            x = base[0] + math.cos(ang) * t + math.sin(t * 0.9 + k) * 0.6
            y = base[1] + math.sin(ang) * t
            s.put(int(round(x)), int(round(y)), hexc('#6a5a36') if t < length - 2 else hexc('#d8442a'))
    return _finish(s), base


def yucca(rng):
    s = Art(11, 14)
    cx, cy = 5, 12
    for k in range(9):
        ang = math.pi + k * math.pi / 8
        for t in range(2, 6):
            s.put(int(round(cx + math.cos(ang) * t)), int(round(cy + math.sin(ang) * t * 0.8)),
                  hexc('#6e8a4a') if t < 4 else hexc('#94ac62'))
    if rng.random() < 0.6:
        s.vline(cx, 1, cy - 3, hexc('#8a7a4a'))
        for y in range(1, 5):
            s.put(cx - 1 + y % 2 * 2, y, hexc('#f2efe2'))
    return _finish(s), (cx, cy)


def boulder(w, h, colour=None):
    base = colour or hexc('#a8846a')
    s = Art(w + 2, h + 2)
    s.ellipse(w / 2 + 1, h / 2 + 1, w / 2, h / 2, shade(base, 0.72))
    s.ellipse(w / 2 + 0.6, h / 2 + 0.4, max(1.0, w / 2 - 1), max(1.0, h / 2 - 1), base)
    s.ellipse(w / 2 - w * 0.12, h / 2 - h * 0.15, w * 0.26, h * 0.2, shade(base, 1.18))
    s.hline(2, w - 1, h, shade(base, 0.6))
    return _finish(s), ((w + 2) // 2, h + 1)


def skull():
    s = Art(11, 5)
    bone, bone_d = hexc('#f2ead8'), hexc('#c8bca4')
    s.rect(4, 1, 3, 3, bone)
    s.put(5, 3, bone_d)
    s.put(4, 2, hexc('#3a2a20'))
    s.put(6, 2, hexc('#3a2a20'))
    for k, (x, y) in enumerate(((3, 1), (2, 1), (1, 0), (0, 0), (7, 1), (8, 1), (9, 0), (10, 0))):
        s.put(x, y, bone if k % 4 < 2 else bone_d)
    return _finish(s), (5, 4)


def dead_bush(rng):
    s = Art(10, 8)
    for _ in range(9):
        x, y = 5, 7
        ang = rng.uniform(math.pi * 1.05, math.pi * 1.95)
        for t in range(rng.randint(3, 5)):
            x += math.cos(ang)
            y += math.sin(ang) * 0.8
            s.put(int(round(x)), int(round(y)), hexc('#8a6a42') if t < 3 else hexc('#a88a5c'))
            ang += rng.uniform(-0.5, 0.5)
    return _finish(s), (5, 7)


def sagebrush(rng, big=False):
    w, h = (12, 8) if big else (9, 6)
    s = Art(w, h)
    for _ in range(4 if big else 3):
        cx = rng.uniform(2.5, w - 3.5)
        cy = rng.uniform(h * 0.45, h - 2.5)
        r = rng.uniform(1.8, 2.6)
        s.disc(cx, cy, r + 0.5, hexc('#5e6e52'))
        s.disc(cx - 0.4, cy - 0.5, r - 0.2, hexc('#8a9a74'))
        s.put(int(cx - 1), int(cy - 1), hexc('#b0bc98'))
    return _finish(s), (w // 2, h - 1)


def tuft(rng):
    s = Art(7, 5)
    for x in range(1, 6):
        h = rng.randint(2, 4)
        s.vline(x, 4 - h, 4, GRASS_D if x % 2 else hexc('#c0b468'))
    return s, (3, 4)


def juniper(rng):
    s = Art(11, 14)
    s.vline(5, 10, 13, hexc('#5a3a22'))
    for (cx, cy, r) in ((5.5, 8, 4.2), (5, 5, 3.4), (5.5, 2.8, 2.2)):
        s.disc(cx, cy, r, hexc('#2e4a2a'))
        s.disc(cx - 0.6, cy - 0.6, r - 1, hexc('#3e6436'))
        s.put(int(cx - r * 0.5), int(cy - r * 0.4), hexc('#5e8a48'))
    for _ in range(4):
        s.put(rng.randint(2, 8), rng.randint(3, 10), hexc('#6a8ab0'))  # berries
    return _finish(s), (5, 13)


def cottonwood(rng, r=7.0):
    w = int(r * 2 + 5)
    h = int(r * 2 + 8)
    s = Art(w, h)
    cx = w / 2
    s.rect(int(cx) - 1, h - 7, 3, 7, hexc('#6a4a32'))
    s.vline(int(cx) - 1, h - 7, h - 1, hexc('#8a6a48'))
    cy = r + 1.5
    s.disc(cx, cy, r, city.LEAF_D)
    s.disc(cx - 0.8, cy - 0.8, r - 1.2, city.LEAF)
    s.disc(cx - r * 0.35, cy - r * 0.4, r * 0.45, city.LEAF_L)
    for _ in range(int(r * 3)):
        ox, oy = rng.uniform(-r + 1, r - 1), rng.uniform(-r + 1, r - 1)
        if ox * ox + oy * oy < (r - 1) ** 2:
            s.put(int(cx + ox), int(cy + oy), city.LEAF_D if ox + oy > 1 else city.LEAF_L)
    s.put(int(cx - r * 0.5), int(cy - r * 0.6), city.LEAF_H)
    return _finish(s), (int(cx), h - 1)


def reeds(rng):
    s = Art(8, 10)
    for x in range(1, 7):
        h = rng.randint(4, 8)
        s.vline(x, 9 - h, 9, REED if x % 2 else REED_L)
        if rng.random() < 0.4:
            s.put(x, 9 - h - 1, CATTAIL)
            s.put(x, 9 - h, CATTAIL)
    return s, (4, 9)


def longhorn(rng, facing=1):
    """A Texas longhorn grazing, side on."""
    coat = rng.choice([hexc('#8a4a2a'), hexc('#c8a070'), hexc('#5e3a24'), hexc('#e8dcc8')])
    s = Art(15, 9)
    s.rect(3, 2, 7, 4, coat)
    s.hline(3, 9, 2, shade(coat, 1.15))
    s.hline(3, 9, 5, shade(coat, 0.8))
    if rng.random() < 0.5:
        s.rect(5, 3, 2, 2, hexc('#efe6d6'))  # a patch
    for x in (3, 5, 8, 9):
        s.vline(x, 6, 7, shade(coat, 0.7))
    s.rect(10, 4, 2, 3, shade(coat, 0.9))  # head down, grazing
    s.put(11, 6, hexc('#2a1a14'))
    for x, y in ((9, 3), (8, 2), (12, 3), (13, 2), (14, 1)):
        s.put(x, y, hexc('#efe6cf'))  # the horns
    s.put(2, 3, shade(coat, 0.7))  # tail
    s.put(2, 4, shade(coat, 0.7))
    s = _finish(s)
    if facing < 0:
        s = s.flipped_x()
    return s, (7, 8)


def dead_tree(rng):
    s = Art(15, 18)
    wood, wood_l = hexc('#7a6250'), hexc('#a08a74')

    def branch(x, y, ang, length, width):
        for t in range(length):
            x += math.cos(ang)
            y += math.sin(ang)
            s.put(int(round(x)), int(round(y)), wood_l if width > 1 and t % 2 else wood)
            if width > 1:
                s.put(int(round(x)) + 1, int(round(y)), wood)
        return x, y

    x, y = branch(7, 17, -math.pi / 2, 9, 2)
    for ang, length in ((-math.pi * 0.8, 6), (-math.pi * 0.25, 6), (-math.pi * 0.55, 5)):
        bx, by = branch(x, y + rng.randint(0, 3), ang + rng.uniform(-0.15, 0.15), length, 1)
        branch(bx, by, ang + 0.6, 2, 1)
    return _finish(s), (7, 17)


def flowers(rng):
    s = Art(8, 5)
    for _ in range(5):
        x, y = rng.randint(0, 7), rng.randint(1, 4)
        s.put(x, y, GRASS_D)
        s.put(x, y - 1, rng.choice(FLOWER))
    return s, (4, 4)


def decor_tile(items):
    """items: [(maker, x, y)] base points in tile pixels; drawn back to front,
    each with a soft shadow cast down-right of its base."""
    a = Art(T, T)
    placed = []
    for make, x, y in items:
        sprite, (ax, ay) = make()
        ox = max(0, min(T - sprite.w, int(x - ax)))
        oy = max(0, min(T - sprite.h, int(y - ay)))
        placed.append((oy + ay, sprite, ox, oy, ax, ay))
    placed.sort(key=lambda p: p[0])
    for _, sprite, ox, oy, ax, ay in placed:
        a.ellipse(ox + ax + 2, oy + ay + 0.5, max(2.0, sprite.w * 0.42), max(1.2, sprite.w * 0.14), SHADOW)
    for _, sprite, ox, oy, ax, ay in placed:
        a.blit(sprite, ox, oy)
    return a


def decor_sets():
    """{'desert': [Art], 'prairie': [Art], 'riverside': [Art]}: overlay tiles."""
    def r(*parts):
        return rng_for('decor', *parts)

    def sag(h, arms):
        return lambda: saguaro(h, arms)

    rock = hexc('#9c907c')
    desert = [
        [(sag(22, [(-1, 9, 2), (1, 13, 2)]), 15, 27)],
        [(sag(18, [(1, 8, 2)]), 11, 24), (lambda: boulder(6, 4), 24, 28)],
        [(lambda: prickly_pear(r('d', 2)), 10, 20), (barrel_cactus, 23, 27)],
        [(lambda: ocotillo(r('d', 3)), 19, 22), (lambda: boulder(5, 3), 8, 29), (lambda: boulder(4, 3), 13, 30)],
        [(skull, 12, 18), (lambda: dead_bush(r('d', 4)), 22, 26)],
        [(sag(14, [(-1, 6, 1)]), 9, 19), (sag(20, [(-1, 11, 2), (1, 8, 1)]), 22, 29)],
        [(lambda: yucca(r('d', 6)), 14, 21), (lambda: tuft(r('d', 6)), 25, 28)],
        [(lambda: boulder(9, 6), 13, 18), (lambda: boulder(5, 4), 21, 22), (lambda: boulder(4, 3), 9, 27)],
        [(barrel_cactus, 9, 14), (barrel_cactus, 14, 18), (lambda: tuft(r('d', 8)), 24, 27)],
        [(lambda: dead_tree(r('d', 9)), 16, 26), (lambda: boulder(4, 3), 24, 29)],
        [(lambda: prickly_pear(r('d', 10)), 18, 26)],
        [(sag(20, [(1, 10, 2)]), 21, 23), (lambda: prickly_pear(r('d', 11)), 9, 29)],
        [(lambda: dead_bush(r('d', 12)), 10, 14), (lambda: boulder(6, 4), 21, 27)],
        [(lambda: ocotillo(r('d', 13)), 9, 21), (sag(16, [(-1, 7, 2)]), 23, 29)],
    ]
    prairie = [
        [(lambda: sagebrush(r('p', 0), True), 12, 15), (lambda: sagebrush(r('p', 0, 1)), 23, 26)],
        [(lambda: sagebrush(r('p', 1)), 9, 22), (lambda: tuft(r('p', 1)), 22, 15)],
        [(lambda: juniper(r('p', 2)), 15, 24)],
        [(lambda: juniper(r('p', 3)), 10, 18), (lambda: boulder(6, 4, rock), 22, 27)],
        [(lambda: flowers(r('p', 4)), 10, 12), (lambda: tuft(r('p', 4)), 20, 22), (lambda: flowers(r('p', 4, 1)), 14, 28)],
        [(lambda: longhorn(r('p', 5)), 15, 20)],
        [(lambda: longhorn(r('p', 6), -1), 18, 24), (lambda: tuft(r('p', 6)), 8, 12)],
        [(lambda: yucca(r('p', 7)), 18, 20), (lambda: tuft(r('p', 7)), 7, 27)],
        [(lambda: boulder(7, 5, rock), 12, 22), (lambda: sagebrush(r('p', 8)), 23, 25)],
        [(lambda: tuft(r('p', 9)), 9, 10), (lambda: tuft(r('p', 9, 1)), 21, 19), (lambda: tuft(r('p', 9, 2)), 12, 28)],
        [(lambda: dead_tree(r('p', 10)), 14, 22), (lambda: sagebrush(r('p', 10)), 25, 28)],
        [(lambda: sagebrush(r('p', 11)), 8, 12), (lambda: sagebrush(r('p', 11, 1), True), 18, 22), (lambda: flowers(r('p', 11)), 10, 28)],
        [(lambda: juniper(r('p', 12)), 9, 16), (lambda: juniper(r('p', 12, 1)), 21, 27)],
    ]
    riverside = [
        [(lambda: cottonwood(r('r', 0), 8.0), 15, 27)],
        [(lambda: cottonwood(r('r', 1), 6.0), 11, 22), (lambda: reeds(r('r', 1)), 24, 28)],
        [(lambda: reeds(r('r', 2)), 9, 18), (lambda: reeds(r('r', 2, 1)), 20, 26)],
        [(lambda: cottonwood(r('r', 3), 5.0), 9, 16), (lambda: cottonwood(r('r', 3, 1), 6.0), 21, 28)],
        [(lambda: boulder(6, 4, rock), 12, 20), (lambda: reeds(r('r', 4)), 22, 27)],
        [(lambda: cottonwood(r('r', 5), 7.0), 18, 25), (lambda: tuft(r('r', 5)), 6, 28)],
    ]
    return {name: [decor_tile(items) for items in group]
            for name, group in (('desert', desert), ('prairie', prairie), ('riverside', riverside))}


# --- Mountains and mesas (sprites) -------------------------------------------------

def _fill_poly(a, pts, colour):
    """Scanline fill of a closed polygon; colour may be a function (x, y)."""
    ys = [p[1] for p in pts]
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
        yc = y + 0.5
        xs = []
        for i in range(len(pts)):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            for x in range(int(math.ceil(xs[k] - 0.5)), int(math.floor(xs[k + 1] - 0.5)) + 1):
                if a.inside(x, y):
                    a.put(x, y, colour(x, y) if callable(colour) else colour)


def _jagged(p0, p1, rng, rough, depth=4):
    """Midpoint-displaced line from p0 to p1 (displaced sideways)."""
    pts = [p0, p1]
    for _ in range(depth):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            nx, ny = -(b[1] - a[1]) / (length or 1), (b[0] - a[0]) / (length or 1)
            off = rng.uniform(-1, 1) * length * rough
            out += [(mx + nx * off, my + ny * off), b]
        pts = out
    return pts


ROCK_PALETTES = {
    # light, mid, dark, deepest, strata
    'red': (hexc('#d49a72'), hexc('#b0704c'), hexc('#844c34'), hexc('#5a3022'), hexc('#c4805a')),
    'tan': (hexc('#d8b088'), hexc('#b48c64'), hexc('#86664a'), hexc('#5c4432'), hexc('#c89c72')),
    'grey': (hexc('#b8b0a6'), hexc('#90887e'), hexc('#68605a'), hexc('#46403c'), hexc('#a49c92')),
}
SNOW, SNOW_D = hexc('#f4f4f0'), hexc('#c4ccd8')
SCRUB = hexc('#4e5e3a')


def _peak(a, rng, apex, left, right, palette, snow, behind=False):
    """One mountain seen from the south: spurs run down from the summit and
    split it into facets, sunlit west of the main ridge and in shade east of
    it, each with its own grain of crags."""
    light, mid, dark, deep, strata = ROCK_PALETTES[palette]
    if behind:
        light, mid, dark, deep, strata = (mix(c, hexc('#8890b0'), 0.25) for c in (light, mid, dark, deep, strata))
    ax, ay = apex
    base = left[1]
    width = right[0] - left[0]
    west = _jagged(left, apex, rng, 0.13, 5)
    east = _jagged(apex, right, rng, 0.13, 5)
    # spur feet across the base; the main ridge lands a little east of the summit
    main = ax + width * rng.uniform(0.06, 0.14)
    feet = sorted({left[0] + (ax - left[0]) * rng.uniform(0.3, 0.6), main,
                   main + (right[0] - main) * rng.uniform(0.45, 0.7)})
    spurs = []
    for fx in feet:
        t0 = 0 if fx == main else rng.uniform(0.15, 0.35)
        sx, sy = ax + (fx - ax) * t0, ay + (base - ay) * t0
        spurs.append(_jagged((sx, sy), (fx, base), rng, 0.06, 3))
    snow_line = ay + (base - ay) * rng.uniform(0.2, 0.3)
    n = smooth_noise(rng, 4, max(a.w, a.h) + 8)
    tones = []
    for k, fx in enumerate([left[0]] + feet):
        if fx < main:
            tones.append((light, mid) if k % 2 == 0 else (mid, strata))
        else:
            tones.append((dark, deep) if k % 2 == 0 else (deep, dark))

    def facet_colour(k):
        hi, lo = tones[k]
        sunny = hi in (light, mid, strata)

        def f(x, y):
            t = (y - ay) / max(1, base - ay)
            c = hi if n(x, y) * 0.8 + (1 - t) * 0.5 > 0.62 else lo
            if snow and y < snow_line + (n(x * 2, y) - 0.5) * 6:
                c = SNOW if sunny else SNOW_D
            return c
        return f

    # The silhouette in the westmost facet's colour, then each facet east of
    # a spur painted over it, clipped back to the silhouette
    shape = Art(a.w, a.h)
    _fill_poly(shape, west + east[1:], hexc('#ffffff'))
    layer = Art(a.w, a.h)
    _fill_poly(layer, west + east[1:], facet_colour(0))
    for k, spur in enumerate(spurs):
        far = max(right[0], a.w)
        _fill_poly(layer, spur + [(far, base), (far, spur[0][1])], facet_colour(k + 1))
    for y in range(a.h):
        for x in range(a.w):
            if shape.filled(x, y):
                a.put(x, y, layer.get(x, y))
    # crags: short dark strokes across the slopes, a lit lip above each
    for _ in range(int(width * 0.3)):
        x = int(rng.uniform(left[0] + 3, right[0] - 3))
        y = int(rng.uniform(ay + 4, base - 3))
        if not (shape.filled(x, y) and shape.filled(x + 3, y)) or a.get(x, y) in (SNOW, SNOW_D):
            continue
        for k in range(rng.randint(2, 4)):
            a.put(x + k, y + (k > 1), deep)
            a.put(x + k, y - 1, light if x < main else mid)
    # scrub clinging to the lower slopes
    for _ in range(int(width * 0.3)):
        x = int(rng.uniform(left[0] + 2, right[0] - 2))
        y = int(rng.uniform(ay + (base - ay) * 0.6, base - 2))
        if shape.filled(x, y) and shape.filled(x + 1, y):
            a.put(x, y, SCRUB)
            a.put(x + 1, y, shade(SCRUB, 1.25))


def mountain(tw, th, variant):
    """A mountain filling a tw x th footprint: the main peak with a shoulder
    or two behind it, scree at the foot. Big grey peaks wear snow."""
    w, h = tw * T, th * T
    rng = rng_for('mountain', tw, th, variant)
    palette = ('red', 'tan', 'grey')[variant % 3]
    a = Art(w, h)
    base = h - 3
    snow = palette == 'grey' and th >= 3
    for side in rng.sample([-1, 1], rng.randint(1, 2)):
        sx = w * (0.5 + side * rng.uniform(0.18, 0.3))
        top = h * rng.uniform(0.16, 0.34)
        half = w * rng.uniform(0.3, 0.42)
        _peak(a, rng, (sx, top), (max(1, sx - half), base - 1), (min(w - 2, sx + half), base - 1),
              palette, snow and top < h * 0.3, behind=True)
    mx = w * rng.uniform(0.4, 0.56)
    _peak(a, rng, (mx, h * rng.uniform(0.04, 0.1)), (2, base), (w - 3, base), palette, snow)
    light, mid, dark, deep, _ = ROCK_PALETTES[palette]
    for _ in range(w):
        x, y = rng.randint(2, w - 3), rng.randint(base - 3, base + 1)
        if a.filled(x, y - 2) or (y <= base and a.filled(x, y)):
            a.put(x, y, rng.choice((mid, dark, light)))
    a.outline(shade(deep, 0.6))
    return a


MESA_STRATA = [hexc('#d4865a'), hexc('#b8653e'), hexc('#e4a874'), hexc('#a2553a'), hexc('#c8764c')]


def mesa(tw, th, variant):
    """A flat-topped mesa (or, on one tile, a lone butte): a scrubby cap
    seen from above, banded red cliffs below with the strata following the
    rim, and a fan of rubble spilling out at the foot."""
    w, h = tw * T, th * T
    rng = rng_for('mesa', tw, th, variant)
    a = Art(w, h)
    narrow = tw == 1
    margin = 8 if narrow else 9
    x0, x1 = margin + rng.randint(-1, 1), w - margin - 1 - rng.randint(-1, 1)
    top = max(2, int(h * 0.1))
    cap = max(5, int(h * (0.18 if narrow else 0.22)))  # depth of the flat top
    cliff = int(h * (0.48 if narrow else 0.46))       # height of the cliff face
    base = h - 2
    wob = smooth_noise(rng, 5, w + h + 8)
    # eroded side walls: x of the left and right wall on each row
    # (slightly narrower at the cap than at the foot)
    wall_l = {y: x0 + int((wob(3, y) - 0.5) * 5) + max(0, (top + cap - y) // 3) for y in range(h)}
    wall_r = {y: x1 + int((wob(17, y) - 0.5) * 5) - max(0, (top + cap - y) // 3) for y in range(h)}
    rim_y = {x: top + cap + (wob(x, 9) - 0.5) * 4 for x in range(w)}
    back_y = {x: top + (wob(x, 23) - 0.5) * 3 for x in range(w)}
    foot = {x: int(rim_y[x] + cliff + (wob(x, 31) - 0.5) * 5) for x in range(w)}
    # round off the cap's corners
    corner = 4 if not narrow else 2

    def inside_cap(x, y):
        l, r = wall_l[y], wall_r[y]
        if not (l <= x <= r and back_y[x] <= y <= rim_y[x]):
            return False
        for cx, cy in ((l + corner, back_y[x] + corner), (r - corner, back_y[x] + corner)):
            if (x < l + corner or x > r - corner) and y < back_y[x] + corner:
                if (x - cx) ** 2 + (y - cy) ** 2 > corner ** 2:
                    return False
        return True

    # rubble fan from the cliff foot to the ground, widening as it falls
    fan_top = min(foot[x] for x in range(x0, x1 + 1)) - 1
    for y in range(fan_top, base + 1):
        spread = max(0.0, (y - fan_top) * (0.45 if not narrow else 0.4))
        lx = wall_l[min(y, h - 1)] - spread
        rx = wall_r[min(y, h - 1)] + spread
        for x in range(int(lx), int(rx) + 1):
            if not a.inside(x, y) or y < foot.get(x, base):
                continue
            c = hexc('#b4805a') if rng.random() < 0.8 else hexc('#9a6644')
            if x > rx - (rx - lx) * 0.3:
                c = shade(c, 0.84)
            a.put(x, y, c)
    for _ in range(w // 2):
        x, y = rng.randint(2, w - 3), rng.randint(fan_top + 2, base)
        if a.filled(x, y) and a.filled(x, y - 1) and a.filled(x + 1, y):
            a.put(x, y, hexc('#74462e'))
            a.put(x, y - 1, hexc('#d09a70'))
    # the cliff: strata follow the rim down to the foot
    bands = []
    y = 0
    while y < cliff + 8:
        bands.append((y, rng.choice(MESA_STRATA)))
        y += rng.randint(2, 4)
    for x in range(w):
        for y in range(int(rim_y[x]), foot[x] + 1):
            if not (wall_l[y] <= x <= wall_r[y]):
                continue
            colour = [c for by, c in bands if by <= max(0, y - rim_y[x])][-1]
            f = (x - wall_l[y]) / max(1, wall_r[y] - wall_l[y])
            if f > 0.7:
                colour = shade(colour, 0.76)
            elif f < 0.1:
                colour = shade(colour, 1.1)
            a.put(x, y, colour)
    # cracks and alcoves down the face
    for _ in range(max(2, tw * 2)):
        cx = rng.randint(x0 + 3, x1 - 3)
        for y in range(int(rim_y[cx]) + rng.randint(2, 4), foot[cx] - rng.randint(1, 5)):
            if a.filled(cx, y):
                a.put(cx, y, hexc('#6e3a24'))
                a.put(cx - 1, y, shade(a.get(cx - 1, y), 1.08))
            if rng.random() < 0.3:
                cx += rng.choice((-1, 1))
    # the flat cap with its sunlit rim
    for y in range(top - 2, top + cap + 3):
        for x in range(w):
            if inside_cap(x, y):
                a.put(x, y, hexc('#d4a470') if (x * 5 + y * 11) % 7 else hexc('#bc8c5c'))
    for x in range(w):
        y = int(rim_y[x])
        if a.filled(x, y) and wall_l[y] <= x <= wall_r[y]:
            a.put(x, y, hexc('#f0c894'))
    for _ in range(tw * th * 5):
        x, y = rng.randint(x0 + 2, x1 - 2), rng.randint(top + 1, top + cap - 2)
        if a.filled(x, y) and a.filled(x + 1, y) and inside_cap(x, y):
            a.put(x, y, SCRUB)
            a.put(x + 1, y, hexc('#6e7e52'))
    a.outline(hexc('#3e2216'))
    return a


SCENERY_VARIANTS = 3


def scenery_frames():
    """{frame name: Art}: mountains (peak_WxH_v) and mesas (mesa_WxH_v) for
    every footprint the map generator places (src/generators/FrontierGenerator.js)."""
    frames = {}
    for tw, th in ((4, 3), (3, 3), (3, 2), (2, 2)):
        for v in range(SCENERY_VARIANTS):
            frames[f'peak_{tw}x{th}_{v}'] = mountain(tw, th, v)
    for tw, th in ((4, 2), (3, 2), (2, 2), (2, 1), (1, 1)):
        for v in range(SCENERY_VARIANTS):
            frames[f'mesa_{tw}x{th}_{v}'] = mesa(tw, th, v)
    return frames


# --- Out on the range: homesteads, ranches and the like (overlay pieces) -----------
#
# Drawn on transparent tiles so the terrain shows round them. Every piece is
# for open country beside a trail; src/landLayout.js picks by biome.

WOOD, WOOD_L, WOOD_D, WOOD_DD = city.WOOD, city.WOOD_L, city.WOOD_D, city.WOOD_DD
BARN_RED, BARN_RED_D = hexc('#a83a2a'), hexc('#7a2a1e')
WHITEWASH = hexc('#ece4d0')
HAY, HAY_D, HAY_L = city.HAY, city.HAY_D, city.HAY_L


def _shadow_box(a, x0, y0, x1, y1, depth=2):
    """A box's shadow cast down-right onto whatever is there (or nothing)."""
    for d in range(1, depth + 1):
        for y in range(y0 + d, y1 + d + 1):
            _shade_px(a, x1 + d, y)
        for x in range(x0 + d, x1 + d + 1):
            _shade_px(a, x, y1 + d)


def _shade_px(a, x, y):
    if not a.inside(x, y):
        return
    c = a.get(x, y)
    a.put(x, y, SHADOW if c[3] == 0 else shade(c, 0.74))


def _dirt_patch(a, rng, x0, y0, x1, y1, colour=None):
    """Trampled ground round a homestead, ragged at the edge."""
    colour = colour or hexc('#c0a06c')
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rx, ry = (x1 - x0) / 2, (y1 - y0) / 2
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d < 0.8 or (d < 1 and rng.random() < 0.5):
                a.put(x, y, colour if rng.random() < 0.8 else shade(colour, 0.93))


def _rail_fence(a, x0, y0, x1, y1, gap=None):
    """Split-rail fence round a box; gap = (side, from, to) left open."""
    def open_(side, k):
        return gap and gap[0] == side and gap[1] <= k <= gap[2]
    for x in range(x0, x1 + 1):
        for y, side in ((y0, 'U'), (y1, 'D')):
            if not open_(side, x):
                a.put(x, y, WOOD_DD if (x - x0) % 5 == 0 else WOOD_L if side == 'U' else WOOD)
    for y in range(y0, y1 + 1):
        for x, side in ((x0, 'L'), (x1, 'R')):
            if not open_(side, y):
                a.put(x, y, WOOD_DD if (y - y0) % 5 == 0 else WOOD)


def _horse(a, x, y, coat, facing=1):
    """A horse standing side on (9 x 7), (x, y) its top-left."""
    s = Art(10, 7)
    s.rect(2, 2, 6, 3, coat)
    s.hline(2, 7, 2, shade(coat, 1.15))
    for lx in (2, 3, 6, 7):
        s.vline(lx, 5, 6, shade(coat, 0.7))
    s.rect(7, 0, 2, 3, coat)  # neck and head
    s.put(9, 1, coat)
    s.put(8, 0, shade(coat, 0.7))
    s.vline(6, 0, 2, shade(coat, 0.55))  # mane
    s.vline(1, 2, 4, shade(coat, 0.55))  # tail
    s.outline(OUTLINE)
    if facing < 0:
        s = s.flipped_x()
    a.ellipse(x + 6, y + 7, 4, 1.2, SHADOW)
    a.blit(s, x, y)


def _trough(a, x, y, w=8):
    a.rect(x, y, w, 3, WOOD_D)
    a.hline(x + 1, x + w - 2, y + 1, WATER)
    a.put(x + 1, y + 1, WATER_L)
    _box_outline_px(a, x, y, x + w - 1, y + 2)


def _box_outline_px(a, x0, y0, x1, y1):
    for x in range(x0 - 1, x1 + 2):
        a.put(x, y0 - 1, OUTLINE)
        a.put(x, y1 + 1, OUTLINE)
    for y in range(y0, y1 + 1):
        a.put(x0 - 1, y, OUTLINE)
        a.put(x1 + 1, y, OUTLINE)


def _barn(a, x0, y0, w, h):
    """A red barn, 3/4 view: shingled roof, then the gable end with its big
    braced doors and the hayloft hatch."""
    roof_h = h * 5 // 9
    _shadow_box(a, x0, y0, x0 + w - 1, y0 + h - 1, 2)
    mid = y0 + roof_h // 2
    for y in range(y0, y0 + roof_h):
        for x in range(x0, x0 + w):
            c = hexc('#7a6a5a') if y < mid else hexc('#5e5044')
            if (y - y0) % 2 and (x + y) % 4 == 0:
                c = shade(c, 0.85)
            a.put(x, y, c)
    a.hline(x0, x0 + w - 1, mid, hexc('#9a8a78'))
    for y in range(y0 + roof_h, y0 + h):
        for x in range(x0, x0 + w):
            a.put(x, y, BARN_RED if (x - x0) % 3 else BARN_RED_D)
    dx0 = x0 + w // 2 - 4
    dy0 = y0 + roof_h + 2
    a.rect(dx0, dy0, 8, y0 + h - dy0, WHITEWASH)
    a.rect(dx0 + 1, dy0 + 1, 6, y0 + h - dy0 - 1, BARN_RED_D)
    a.line(dx0 + 1, dy0 + 1, dx0 + 6, y0 + h - 1, WHITEWASH)
    a.line(dx0 + 6, dy0 + 1, dx0 + 1, y0 + h - 1, WHITEWASH)
    a.rect(x0 + w // 2 - 1, y0 + roof_h - 1, 3, 2, hexc('#2a1a14'))  # hayloft hatch
    _box_outline_px(a, x0, y0, x0 + w - 1, y0 + h - 1)


def _windmill(a, cx, base):
    """A wind pump: a lattice tower with the fan wheel and tail vane on top."""
    top = base - 22
    a.ellipse(cx + 5, base, 6, 1.6, SHADOW)
    for y in range(top + 6, base + 1):
        spread = (y - top - 6) * 0.22
        a.put(int(cx - 1 - spread), y, WOOD_D)
        a.put(int(cx + 1 + spread), y, WOOD_D)
        if (y - top) % 4 == 0:
            a.hline(int(cx - 1 - spread), int(cx + 1 + spread), y, WOOD)
    a.vline(int(cx), top + 4, base, WOOD_DD)  # the pump rod
    # tail vane, then the wheel of blades
    a.hline(int(cx), int(cx) + 7, top + 4, WOOD_D)
    a.rect(int(cx) + 6, top + 2, 3, 4, hexc('#c8bca4'))
    for k in range(12):
        ang = k * math.pi / 6
        for t in range(2, 7):
            x = cx + math.cos(ang) * t
            y = top + 4 + math.sin(ang) * t
            a.put(int(round(x)), int(round(y)), hexc('#d8d0c0') if t > 3 else hexc('#8a8478'))
    a.disc(cx + 0.5, top + 4.5, 1.3, hexc('#4a4440'))


def _stock_tank(a, cx, cy, r=5.0):
    a.ellipse(cx + 1, cy + 1.5, r, r * 0.55, SHADOW)
    a.ellipse(cx, cy, r, r * 0.55, hexc('#6e6a6c'))
    a.ellipse(cx, cy - 0.3, r - 1, r * 0.55 - 1, WATER)
    a.put(int(cx - r * 0.4), int(cy - 1), FOAM)


def _campfire(a, cx, cy):
    for k in range(6):
        ang = k * math.pi / 3
        a.put(int(round(cx + math.cos(ang) * 2.5)), int(round(cy + math.sin(ang) * 1.6)), hexc('#8a8478'))
    a.put(int(cx), int(cy), hexc('#ffd66b'))
    a.put(int(cx), int(cy) - 1, hexc('#ff9a2a'))
    a.put(int(cx) - 1, int(cy), hexc('#e8501e'))
    a.put(int(cx) + 1, int(cy), hexc('#e8501e'))
    a.put(int(cx), int(cy) - 2, hexc('#c8c0b8'))
    a.put(int(cx) + 1, int(cy) - 4, hexc('#a8a098'))


def homestead(variant):
    """A homestead by the trail: a log cabin with its woodpile and privy, a
    painted frame house with a vegetable patch and well, or an adobe with a
    beehive oven and chickens."""
    rng = rng_for('homestead', variant)
    a = Art(T, T)
    _dirt_patch(a, rng, 2, 4, T - 3, T - 2)
    kind = ('cabin', 'frame', 'adobe')[variant % 3]
    city._house(a, rng, 4, 4, 18, 9, 7, kind)
    if kind == 'cabin':
        _woodpile(a, 6, 24)
        city._outhouse(a, 24, 6)
        _rail_fence(a, 1, 22, 14, 30)
    elif kind == 'frame':
        city._veg_patch(a, 4, 23, 16, 29)
        city._well(a, 25, 25)
        a.vline(1, 3, 29, WHITEWASH)
    else:
        a.disc(26, 24, 3.5, hexc('#c89468'))  # the horno
        a.disc(25.5, 23.5, 2.4, hexc('#dcb084'))
        a.rect(25, 25, 2, 2, hexc('#3a2418'))
        city._coop(a, 5, 22)
    return a


def _woodpile(a, x, y):
    city._woodpile(a, x, y)


def ranch(variant):
    """A 2x2 ranch: house, red barn and a corral of horses round a trough."""
    rng = rng_for('ranch', variant)
    a = Art(2 * T, 2 * T)
    _dirt_patch(a, rng, 2, 2, 2 * T - 3, 2 * T - 3)
    if variant == 0:
        city._house(a, rng, 4, 5, 20, 9, 7, 'frame')
        _barn(a, 34, 3, 26, 22)
        _rail_fence(a, 6, 32, 58, 60, gap=('U', 40, 46))
        _trough(a, 30, 42)
        for (hx, hy, f) in ((12, 38, 1), (40, 48, -1), (20, 50, 1)):
            _horse(a, hx, hy, rng.choice([hexc('#7a4a2a'), hexc('#3a2a20'), hexc('#c8a070')]), f)
        a.disc(52.5, 40.5, 3.4, HAY_D)
        a.disc(52, 40, 2.6, HAY)
    else:
        _barn(a, 4, 4, 28, 24)
        city._house(a, rng, 38, 6, 20, 9, 7, 'cabin')
        _rail_fence(a, 3, 34, 40, 60, gap=('R', 44, 50))
        _windmill(a, 52, 52)
        _stock_tank(a, 52, 57, 4.5)
        for (hx, hy, f) in ((8, 40, 1), (22, 46, -1)):
            _horse(a, hx, hy, rng.choice([hexc('#7a4a2a'), hexc('#5a3a2a'), hexc('#e8dcc8')]), f)
        for k in range(3):
            a.disc(10.5 + k * 6, 54.5, 2.6, HAY_D)
            a.disc(10 + k * 6, 54, 2.0, HAY)
    return a


def corral(variant):
    """A 2x1 corral of horses with a trough and a hay rick."""
    rng = rng_for('corral', variant)
    a = Art(2 * T, T)
    _dirt_patch(a, rng, 3, 3, 2 * T - 4, T - 3, hexc('#b8966a'))
    _rail_fence(a, 4, 4, 2 * T - 5, T - 4, gap=('D', 28, 34))
    _trough(a, 10, 9)
    coats = [hexc('#7a4a2a'), hexc('#3a2a20'), hexc('#c8a070'), hexc('#e8dcc8'), hexc('#8a5a3a')]
    for k, (hx, hy) in enumerate(((24, 8), (40, 12), (14, 16), (46, 18))[:3 + variant]):
        _horse(a, hx, hy, coats[(k + variant) % len(coats)], 1 if k % 2 else -1)
    a.disc(56.5, 10.5, 3.2, HAY_D)
    a.disc(56, 10, 2.5, HAY)
    return a


def windmill_lot(variant):
    """A wind pump filling a stock tank, cattle come to drink."""
    rng = rng_for('windmill', variant)
    a = Art(T, T)
    _dirt_patch(a, rng, 3, 14, T - 3, T - 2, hexc('#b8966a'))
    _windmill(a, 12, 26)
    _stock_tank(a, 22, 25, 5.5)
    sprite, (ax, ay) = longhorn(rng, -1)
    a.ellipse(6 + ax + 2, 24 + 0.5, 5, 1.5, SHADOW)
    a.blit(sprite, 26 - ax if variant else 4, 24 - ay + 4)
    return a


def wagon_camp(variant):
    """Emigrant wagons drawn up in an arc round the campfire."""
    rng = rng_for('camp', variant)
    a = Art(2 * T, T)
    _dirt_patch(a, rng, 4, 6, 2 * T - 5, T - 3, hexc('#b8966a'))
    for k, (wx, wy) in enumerate(((6, 6), (24, 3), (44, 6))):
        wagon = city.wagon_top(rng, covered=True).rotated(1 if k != 1 else 3)
        a.ellipse(wx + wagon.w / 2 + 2, wy + wagon.h + 0.5, wagon.w / 2, 1.5, SHADOW)
        a.blit(wagon, wx, wy)
    _campfire(a, 32, 22)
    for bx in (25, 37):
        a.rect(bx, 24, 4, 2, hexc('#7a5a8a') if bx < 30 else hexc('#5a7a8a'))  # bedrolls
    _horse(a, 6, 22, hexc('#7a4a2a'), 1)
    _horse(a, 48, 21, hexc('#c8a070'), -1)
    return a


def mine(variant):
    """A mine adit at the mountain's foot: the timbered portal, an ore cart
    on its rails and the spoil heap."""
    rng = rng_for('mine', variant)
    a = Art(T, T)
    # rock face the adit is cut into
    for y in range(2, 16):
        for x in range(3, T - 3):
            if ((x - 16) / 13.5) ** 2 + ((y - 15) / 13) ** 2 <= 1:
                a.put(x, y, hexc('#94603e') if rng.random() < 0.7 else hexc('#7a4a30'))
    a.rect(10, 6, 12, 11, WOOD_DD)
    a.rect(12, 8, 8, 9, hexc('#120c0a'))  # the dark mouth
    a.hline(9, 22, 6, WOOD_L)
    a.vline(10, 7, 16, WOOD)
    a.vline(21, 7, 16, WOOD)
    # rails out of the mouth
    for y in range(17, T - 1):
        a.put(13, y, hexc('#8a8486'))
        a.put(18, y, hexc('#8a8486'))
        if y % 3 == 0:
            a.hline(12, 19, y, WOOD_D)
    a.rect(13, 21, 6, 4, hexc('#5a5654'))  # ore cart
    a.hline(13, 18, 21, hexc('#8a8486'))
    a.rect(14, 20, 4, 1, hexc('#c8a050'))
    _box_outline_px(a, 13, 20, 18, 24)
    # the spoil heap
    a.ellipse(26, 25, 5, 3.5, hexc('#7c7064'))
    a.ellipse(25.5, 24, 3.5, 2.2, hexc('#9c907c'))
    return a


def boot_hill():
    """Boot Hill: wooden crosses and headboards behind a picket fence."""
    rng = rng_for('boothill')
    a = Art(2 * T, 2 * T)
    _dirt_patch(a, rng, 3, 3, 2 * T - 4, 2 * T - 4, hexc('#b49a6a'))
    for x in range(4, 2 * T - 4):
        for y in (4, 2 * T - 5):
            if not (y == 2 * T - 5 and 28 <= x <= 35):
                a.put(x, y, WHITEWASH if x % 3 else hexc('#8a7e6a'))
    for y in range(4, 2 * T - 4):
        for x in (4, 2 * T - 5):
            a.put(x, y, WHITEWASH if y % 3 else hexc('#8a7e6a'))
    for gy in range(12, 2 * T - 12, 11):
        for gx in range(10, 2 * T - 10, 9):
            if rng.random() < 0.18:
                continue
            gx2 = gx + rng.randint(-1, 1)
            a.rect(gx2 - 2, gy + 3, 5, 3, hexc('#8a7058'))  # the mound
            a.hline(gx2 - 2, gx2 + 2, gy + 3, hexc('#a08a70'))
            if rng.random() < 0.7:
                a.vline(gx2, gy - 3, gy + 2, WOOD_L)
                a.hline(gx2 - 2, gx2 + 2, gy - 1, WOOD_L)
                a.put(gx2 + 1, gy + 2, WOOD_DD)
            else:
                a.rect(gx2 - 1, gy - 2, 3, 4, hexc('#c8bca4'))
                a.put(gx2, gy - 1, hexc('#6a5a4a'))
    tree, (ax, ay) = dead_tree(rng)
    a.blit(tree, 2 * T - 20, 8)
    return a


def mission():
    """An adobe mission: the bell gable over the door, a walled yard."""
    rng = rng_for('mission')
    a = Art(2 * T, T)
    clay, clay_l, clay_d = hexc('#d8a878'), hexc('#ecc49a'), hexc('#a87a52')
    _dirt_patch(a, rng, 2, 4, 2 * T - 3, T - 2, hexc('#c8a878'))
    # the church: flat roof, then the front wall
    x0, x1 = 6, 38
    _shadow_box(a, x0, 9, x1, 27, 2)
    for y in range(9, 18):
        for x in range(x0, x1 + 1):
            a.put(x, y, clay_l if y == 9 else (clay if (x + y) % 5 else clay_d))
    for y in range(18, 28):
        for x in range(x0, x1 + 1):
            a.put(x, y, clay if (x * 3 + y) % 7 else shade(clay, 0.94))
    # bell gable rising over the door, curved like a bell
    gx = (x0 + x1) // 2
    for y in range(2, 18):
        half = 7 - max(0, (6 - y)) if y < 6 else 7
        for x in range(gx - half, gx + half + 1):
            a.put(x, y, clay_l if x < gx else clay)
    a.rect(gx - 2, 6, 5, 5, hexc('#2a1a14'))
    a.disc(gx + 0.5, 9, 1.6, hexc('#c8932a'))  # the bell
    a.vline(gx, 0, 2, WOOD_DD)
    a.hline(gx - 1, gx + 1, 1, WOOD_DD)
    a.rect(gx - 3, 21, 7, 7, hexc('#5a3a22'))  # the door
    a.vline(gx, 21, 27, hexc('#3a2418'))
    _box_outline_px(a, x0, 9, x1, 27)
    # the yard wall and a well
    for x in range(40, 2 * T - 3):
        a.put(x, 27, clay_d)
        a.put(x, 26, clay)
    a.vline(2 * T - 4, 12, 27, clay_d)
    city._well(a, 50, 18)
    return a


def field(tw, th, crop):
    """Fenced crops by the trail: corn rows or ripe wheat."""
    rng = rng_for('field', tw, th, crop)
    a = Art(tw * T, th * T)
    w, h = a.w, a.h
    for y in range(3, h - 3):
        for x in range(3, w - 3):
            if crop == 'corn':
                row = (y - 3) % 4
                c = (hexc('#5a7a34'), hexc('#7a9a44'), hexc('#8a6440'), hexc('#8a6440'))[row]
                if row < 2 and rng.random() < 0.1:
                    c = hexc('#e8c050')
            else:
                c = HAY if rng.random() < 0.7 else (HAY_L if rng.random() < 0.6 else HAY_D)
                if (x + y * 2) % 9 == 0:
                    c = HAY_D
            a.put(x, y, c)
    _rail_fence(a, 2, 2, w - 3, h - 3, gap=('D', w // 2 - 3, w // 2 + 3))
    if crop == 'wheat':
        # a scarecrow keeping watch
        sx, sy = w - 12, 8
        a.vline(sx, sy, sy + 9, WOOD_D)
        a.hline(sx - 3, sx + 3, sy + 3, WOOD_D)
        a.rect(sx - 1, sy + 2, 3, 4, hexc('#4a6a8a'))
        a.rect(sx - 1, sy, 3, 2, hexc('#e8c890'))
        a.hline(sx - 2, sx + 2, sy - 1, hexc('#8a6440'))
    return a


def country_pieces():
    """[{name, zone, art, near?}]: zone is the biome a piece belongs to
    ('prairie', 'desert' or 'any'); near: 'peaks' for the mine, 'town' for
    Boot Hill."""
    out = []

    def add(name, zone, art, **extra):
        out.append({'name': name, 'zone': zone, 'art': art, **extra})

    for v in range(3):
        add(f'homestead_{v}', 'desert' if v == 2 else 'any', homestead(v))
    for v in range(2):
        add(f'ranch_{v}', 'prairie', ranch(v))
        add(f'corral_{v}', 'any', corral(v))
        add(f'windmill_{v}', 'any', windmill_lot(v))
    add('camp_0', 'any', wagon_camp(0))
    add('mine_0', 'any', mine(0), near='peaks')
    add('boothill_0', 'any', boot_hill(), near='town')
    add('mission_0', 'desert', mission())
    add('field_corn', 'prairie', field(2, 2, 'corn'))
    add('field_wheat', 'prairie', field(2, 1, 'wheat'))
    return out


# --- Catalogue ---------------------------------------------------------------------

def build_land_tiles(tiles):
    """Appends the open range's tiles to the town tileset `tiles` (sharing
    its de-duplication) and returns the manifest's `land` section:

    terrain: {'UL UR DR DL' bits as '0110': [variants]}  ground, opaque
    river:   {mask: [variants]}                            ground, opaque
    trails:  {mask: [variants]}                            overlay
    bridge:  {'H' | 'V': index}  (the trail's axis)       overlay
    decor:   {'desert' | 'prairie' | 'riverside': [...]}  overlay
    pieces:  [{name, zone, near?, w, h, tiles}]            overlay
    """
    index = {t.im.tobytes(): i for i, t in enumerate(tiles)}

    def add_tile(tile):
        key = tile.im.tobytes()
        if key not in index:
            index[key] = len(tiles)
            tiles.append(tile)
        return index[key]

    land = {'terrain': {}, 'river': {}, 'trails': {}, 'decor': {}, 'pieces': []}
    for corners in terrain_keys():
        uniform = len(set(corners)) == 1
        land['terrain'][''.join(map(str, corners))] = [
            add_tile(terrain_tile(corners, v)) for v in range(TERRAIN_VARIANTS if uniform else 1)]
    for mask in RIVER_MASKS:
        straight = mask in (U | D, L | R)
        land['river'][str(mask)] = [add_tile(river_tile(mask, v)) for v in range(RIVER_VARIANTS if straight else 1)]
    for mask in trail_masks():
        straight = mask in (U | D, L | R)
        land['trails'][str(mask)] = [add_tile(trail_tile(mask, v)) for v in range(TRAIL_VARIANTS if straight else 1)]
    land['bridge'] = {axis: add_tile(bridge_tile(axis)) for axis in ('H', 'V')}
    for name, group in decor_sets().items():
        land['decor'][name] = [add_tile(t) for t in group]
    for p in country_pieces():
        art = p.pop('art')
        tw, th = art.w // T, art.h // T
        ids = []
        for ty in range(th):
            for tx in range(tw):
                tile = Art(T, T)
                tile.blit(art.im.crop((tx * T, ty * T, tx * T + T, ty * T + T)), 0, 0)
                ids.append(add_tile(tile))
        land['pieces'].append({**p, 'w': tw, 'h': th, 'tiles': ids})
    return land
