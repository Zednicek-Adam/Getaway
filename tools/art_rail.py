"""The railroad: track tiles, plank crossings, the steam train and the depot.

Track tiles are drawn from geometry rather than by hand. The game's loop is a
cycle of grid cells (src/railway.js) and the rails run through the midpoints
of the edges between consecutive cells, so a straight cell carries a straight
piece and a staircase cell carries a 45-degree piece. Each tile is rendered
from the four moves around its cell (two in, two out), which is enough to
draw the joins to its neighbours seamlessly. The game looks tiles up by that
same signature.
"""
import math

from pixelkit import Art, hexc, shade, with_alpha, rng_for, rotsprite
import art_sprites as spr

T = 32
OUTLINE = spr.OUTLINE
SHADOW = spr.SHADOW

BALLAST = [hexc('#9a8268'), hexc('#8a735a'), hexc('#a89074')]
BALLAST_EDGE = hexc('#7a6650')
SLEEPER = hexc('#4e3424')
SLEEPER_L = hexc('#6a4a32')
RAIL = hexc('#b8bcc4')
RAIL_D = hexc('#5e5a5a')
PLANK = hexc('#9a6a3c')
PLANK_SEAM = hexc('#5e3e24')

STEP = {'U': (0, -1), 'R': (1, 0), 'D': (0, 1), 'L': (-1, 0)}

# Half-widths across the track, in art pixels
BED = 10.5        # ballast
TIE = 9.5         # sleeper ends
RAIL_IN = 5.5     # inner edge of each rail
RAIL_OUT = 7.5    # outer edge


# --- Loop geometry (mirrors buildLoop in src/railway.js) ----------------------------

def build_loop(size, inset, chamfer):
    x0 = y0 = inset
    x1 = y1 = size - 1 - inset
    cells = []
    x, y = x0 + chamfer, y0

    def push():
        cells.append((x, y))
    while x < x1 - chamfer:
        push(); x += 1
    for _ in range(chamfer):
        push(); x += 1; push(); y += 1
    while y < y1 - chamfer:
        push(); y += 1
    for _ in range(chamfer):
        push(); y += 1; push(); x -= 1
    while x > x0 + chamfer:
        push(); x -= 1
    for _ in range(chamfer):
        push(); x -= 1; push(); y -= 1
    while y > y0 + chamfer:
        push(); y -= 1
    for _ in range(chamfer):
        push(); y -= 1; push(); x += 1
    return cells


def loop_moves(cells):
    out = []
    for i, (x, y) in enumerate(cells):
        nx, ny = cells[(i + 1) % len(cells)]
        out.append(next(k for k, (dx, dy) in STEP.items() if (dx, dy) == (nx - x, ny - y)))
    return out


def all_signatures():
    """Every 4-move window that appears on an octagon loop of any corner size."""
    sigs = set()
    for chamfer in range(1, 7):
        moves = loop_moves(build_loop(50, 8, chamfer))
        n = len(moves)
        for i in range(n):
            sigs.add(''.join(moves[(i + k) % n] for k in (-2, -1, 0, 1)))
    return sorted(sigs)


# --- Track tiles ----------------------------------------------------------------------

def _polyline(sig):
    """Edge midpoints around cell (0, 0) in art pixels, from the move signature."""
    m2, m1, m0, p1 = sig
    c0 = (0, 0)
    cm1 = (c0[0] - STEP[m1][0], c0[1] - STEP[m1][1])
    cm2 = (cm1[0] - STEP[m2][0], cm1[1] - STEP[m2][1])
    cp1 = (c0[0] + STEP[m0][0], c0[1] + STEP[m0][1])
    cp2 = (cp1[0] + STEP[p1][0], cp1[1] + STEP[p1][1])
    chain = [cm2, cm1, c0, cp1, cp2]
    return [((a[0] + b[0]) / 2 * T + T / 2, (a[1] + b[1]) / 2 * T + T / 2)
            for a, b in zip(chain, chain[1:])]


def _nearest(points, px, py):
    """(distance, signed side, segment index, distance along segment, segment length)."""
    best = None
    for k, ((ax, ay), (bx, by)) in enumerate(zip(points, points[1:])):
        vx, vy = bx - ax, by - ay
        length = math.hypot(vx, vy)
        t = max(0.0, min(length, ((px - ax) * vx + (py - ay) * vy) / length))
        cx, cy = ax + vx * t / length, ay + vy * t / length
        d = math.hypot(px - cx, py - cy)
        side = (vx * (py - ay) - vy * (px - ax)) / length
        if best is None or d < best[0]:
            best = (d, side, k, t, length)
    return best


def _track_pixel(a, x, y, rng, d, side, t, length, sleepers=True):
    if d > BED:
        return
    c = BALLAST_EDGE if d > BED - 1 else BALLAST[rng.randrange(3)]
    # Sleepers: a whole number per segment so they line up across tile joins
    period = length / max(1, round(length / 4.5))
    if sleepers and d <= TIE and ((t + period / 2) % period) < 1.9:
        c = SLEEPER_L if ((t + period / 2) % period) < 0.9 else SLEEPER
    if RAIL_IN <= abs(side) < RAIL_OUT:
        c = RAIL if abs(side) < RAIL_IN + 1 else RAIL_D
    a.set(x, y, c)


def track_tile(sig):
    rng = rng_for('rail', sig)
    a = Art(T, T)
    pts = _polyline(sig)
    for y in range(T):
        for x in range(T):
            d, side, _, t, length = _nearest(pts, x + 0.5, y + 0.5)
            _track_pixel(a, x, y, rng, d, side, t, length)
    return a


def crossing_tile(axis):
    """Rails over a street, planked level with the rails so wagons can
    roll across: drawn over the street tile on a crossing cell.

    axis 'H' is track running left-right (so the road runs up-down)."""
    rng = rng_for('crossing')
    a = Art(T, T)
    mid = T / 2
    for y in range(T):
        for x in range(T):
            d = abs(y + 0.5 - mid)
            side = y + 0.5 - mid
            on_road = 6 <= x <= 25
            if on_road:
                if d > BED:
                    continue
                c = PLANK_SEAM if (y + 0.5 - mid + BED) % 4 < 1 or d > BED - 1 else PLANK
                if x % 9 == 0 and c == PLANK:
                    c = shade(PLANK, 0.85)
                if RAIL_IN <= abs(side) < RAIL_OUT:
                    c = RAIL if abs(side) < RAIL_IN + 1 else RAIL_D
                a.set(x, y, c)
            else:
                _track_pixel(a, x, y, rng, d, side, x + 0.5, T)
    return a if axis == 'H' else a.rotated(1)


def trestle_tile(axis):
    """Track carried over the river on a timber trestle: sleepers on two
    stringers, open water showing between them, the bents standing in the
    stream below. Drawn over the river tile. axis 'H': track left-right."""
    a = Art(T, T)
    mid = T / 2
    wood, wood_d, wood_dd = hexc('#7a5434'), hexc('#5a3a22'), hexc('#3a2414')
    # the bents: posts and cross-braces down into the water, then their shadow
    for px in (5, 21):
        for x in (px, px + 4):
            a.vline(x, int(mid + TIE), int(mid + TIE) + 6, wood_d)
        a.line(px, int(mid + TIE) + 1, px + 4, int(mid + TIE) + 5, wood_dd)
        a.hline(px - 1, px + 5, int(mid + TIE) + 6, with_alpha(hexc('#1e3a50'), 150))
    for x in range(T):
        for y in range(int(mid + TIE) + 1, int(mid + TIE) + 3):
            if not a.filled(x, y):
                a.set(x, y, with_alpha(hexc('#1e3a50'), 110))
    period = T / round(T / 4.5)
    for y in range(T):
        for x in range(T):
            side = y + 0.5 - mid
            d = abs(side)
            if d > TIE:
                continue
            on_sleeper = ((x + 0.5 + period / 2) % period) < 1.9
            c = None
            if 2.5 <= d <= 4.0:
                c = wood if side < 0 else wood_d  # the stringers
            if on_sleeper:
                c = SLEEPER_L if ((x + 0.5 + period / 2) % period) < 0.9 else SLEEPER
            if RAIL_IN <= d < RAIL_OUT:
                c = RAIL if d < RAIL_IN + 1 else RAIL_D
            if c:
                a.set(x, y, c)
    return a if axis == 'H' else a.rotated(1)


def _watchman(a, x, y, flag):
    """The crossing keeper (5 x 10, feet at y) waving his red flag; flag 0
    or 1 is the swing of the wave."""
    coat, hat, skin = hexc('#2e3a5a'), hexc('#1e1a18'), hexc('#e0b08a')
    a.rect(x + 1, y - 5, 3, 4, coat)
    a.vline(x + 1, y - 1, y, hexc('#3a2a20'))
    a.vline(x + 3, y - 1, y, hexc('#3a2a20'))
    a.rect(x + 1, y - 7, 3, 2, skin)
    a.hline(x, x + 4, y - 8, hat)
    a.rect(x + 1, y - 9, 3, 1, hat)
    # the arm up and the flag on its stick
    ax = x + 4 if flag == 0 else x
    a.put(ax, y - 6, coat)
    a.put(ax, y - 7, skin)
    sx = ax + (1 if flag == 0 else -1)
    a.line(ax, y - 8, sx + (1 if flag == 0 else -1), y - 11, hexc('#8a6440'))
    fx = sx + (1 if flag == 0 else -3)
    a.rect(fx, y - 12, 3, 2, hexc('#d83a2a'))
    a.put(fx, y - 12, hexc('#f05a46'))


def barrier_frame(axis, down, flag):
    """One crossing in the days before signal lamps: a crossbuck on a post
    each side, hand-worked gate arms, and, while the gates are down, the
    crossing keeper out with his red flag."""
    a = Art(T, T)
    red, white = hexc('#b8342a'), hexc('#efe6cf')
    # Two posts on opposite corners; the arms swing across the road
    # towards each other, one on each side of the track
    for post_x, arm_y, sign in ((2, 3, 1), (T - 4, T - 5, -1)):
        # crossbuck: an X of white boards over the post
        for k in range(-2, 3):
            a.set(post_x + 1 + k, arm_y - 1 + k, white)
            a.set(post_x + 1 + k, arm_y - 1 - k, white)
        a.rect(post_x, arm_y - 1, 3, 3, hexc('#4a2e1a'))
        a.set(post_x + 1, arm_y, hexc('#8a6440'))
        if down:
            for k in range(3, 24):
                ax = post_x + 1 + sign * k
                c = red if (k // 4) % 2 else white
                a.set(ax, arm_y, c)
                a.set(ax, arm_y + 1, shade(c, 0.78))
        else:
            # raised: the arm stands up beside its post
            for k in range(1, 6):
                a.set(post_x + 1 + sign * 2, arm_y - k, red if k % 2 else white)
    if down:
        _watchman(a, 3, T - 3, flag)
    a.outline(OUTLINE)
    a.drop_shadow(1, 1, SHADOW)
    return a if axis == 'H' else a.rotated(1)


def crossing_frames():
    """[H up, H flag A, H flag B, V up, V flag A, V flag B]."""
    return [barrier_frame(axis, down, flag)
            for axis in ('H', 'V')
            for down, flag in ((False, 0), (True, 0), (True, 1))]


# --- The train ------------------------------------------------------------------------

BASE = {
    'Y': spr.GOLD, 'y': spr.GOLD_D, 'W': spr.GOLD_L, 'K': hexc('#221a18'), 'k': hexc('#3a3230'),
}

# A 4-4-0 tank engine, front at the top: red cowcatcher, brass headlamp,
# the big balloon stack, the banded boiler with its brass dome, the maroon
# cab roof and the coal bunker behind
LOCO = [
    ".....RRRR.....",
    "....RrRRrR....",
    "...RrRrrRrR...",
    "..RrRrRrrRrR..",
    "..kkkkkkkkkk..",
    "..kgYYLLYYgk..",
    "..gkkKKKKkkg..",
    "..gkKSSSSKkg..",
    "..gKSSSSSSKg..",
    "..gKSSSSSSKg..",
    "..gkKSSSSKkg..",
    "RgkHBBBBBBDkgR",
    "RgkHBBBBBBDkgR",
    "rgkYYYYYYYYkgr",
    "RgkHBYYYYBDkgR",
    "RgkHYYLYYyDkgR",
    "RgkHByyyyBDkgR",
    "rgkHBBBBBBDkgr",
    "RgkYYYYYYYYkgR",
    "RgkHBBBBBBDkgR",
    "rgkHBBBBBBDkgr",
    "MMMMMMMMMMMMMc",
    "MCCCCCCCCCCCCc",
    "MCCCCmmmmCCCCc",
    "MCCCCCCCCCCCCc",
    "cccccccccccccc",
    "KOoOOoOOoOOoOK",
    ".KKKKKKKKKKKK.",
]
LOCO_PAL = {'R': hexc('#c0392b'), 'r': hexc('#842218'), 'g': hexc('#6e6a6c'), 'L': hexc('#fff6c0'),
            'S': hexc('#120c0a'), 'H': hexc('#54504e'), 'B': hexc('#302a28'), 'D': hexc('#1a1514'),
            'M': hexc('#b0503a'), 'C': hexc('#8a3424'), 'c': hexc('#5a1e14'), 'm': hexc('#a8a4a0'),
            'O': hexc('#2a2626'), 'o': hexc('#5a5654')}

# A red boxcar with the brakeman's walkway down the roof
BOXCAR = ([".LBBBBBBBBBBD.", "LBBBBBBBBBBBBD", "LBBBBBwwBBBBBD", "LBBBBBwwBBBBBD", "LbbbbbwwbbbbbD"]
          + [("LbbbbbwwbbbbbD" if i % 3 == 0 else "LBBBBBwwBBBBBD") for i in range(1, 18)]
          + ["LbbbbbwwbbbbbD", "LBBBBBwwBBBBBD", "LBBBBBwwBBBBBD", "LBBBBBBBBBBBBD", "LBBBBBBBBBBBBD",
             ".LBBBBBBBBBBD."])
BOX_PAL = {'B': hexc('#a0472e'), 'b': hexc('#8a3b26'), 'L': hexc('#c4643f'), 'D': hexc('#5e2618'),
           'w': hexc('#c8a070')}

# A flatcar of logs chained down between stakes, cut ends at both ends
LUMBER = ([".KKKKKKKKKKKK.", "KddddddddddddK", "KdeEeEeeEeEedK"]
          + [("s" if i % 7 == 3 else "d") + "LlmDLlmDLlmD" + ("s" if i % 7 == 3 else "d") for i in range(22)]
          + ["KdeEeEeeEeEedK", "KddddddddddddK", ".KKKKKKKKKKKK."])
for _row in (9, 18):
    LUMBER[_row] = "d" + "c" * 12 + "d"
LUMBER_PAL = {'d': hexc('#6a4426'), 'L': hexc('#b0825a'), 'l': hexc('#8a5a34'), 'm': hexc('#7a4e2c'),
              'D': hexc('#4e301c'), 'e': hexc('#e0b47a'), 'E': hexc('#c0945a'), 's': hexc('#c8a070'),
              'c': hexc('#5e5a5a')}

# A passenger coach: clerestory roof with its row of vents, an open
# platform with a railing at each end
COACH = (["..kkkkkkkkkk..", "..kPPPPPPPPk..", "KKKKKKKKKKKKKK"]
         + [("KBrrrVllVrrrBK" if i % 4 == 1 else "KBrrrlllLrrrBK") for i in range(22)]
         + ["KKKKKKKKKKKKKK", "..kPPPPPPPPk..", "..kkkkkkkkkk.."])
COACH_PAL = {'B': hexc('#7a2a24'), 'r': hexc('#5e4c42'), 'l': hexc('#8a7666'), 'L': hexc('#6a5648'),
             'V': hexc('#3a2e28'), 'P': hexc('#8a6440')}

BULLION = [
    ".YYYYYYYYYYYY.",
    "YSSSSSSSSSSSSy",
    "YSssssssssssSy",
    "YSsSSSSSSSSsSy",
    "YSsSccccccSsSy",
    "YSsSc....cSsSy",
    "YSsSc....cSsSy",
    "YSsSccccccSsSy",
    "YSsSSSSSSSSsSy",
    "YSssssssssssSy",
    "YSSSSSSSSSSSSy",
    "YSSSyyyyyySSSy",
    "YSSyVVVVVVySSy",
    "YSSyVvvvvVySSy",
    "YSSyVvWWvVySSy",
    "YSSyVvWWvVySSy",
    "YSSyVvvvvVySSy",
    "YSSyVVVVVVySSy",
    "YSSSyyyyyySSSy",
    "YSSSSSSSSSSSSy",
    "YSssssssssssSy",
    "YSsSSSSSSSSsSy",
    "YSsSccccccSsSy",
    "YSsSccccccSsSy",
    "YSsSSSSSSSSsSy",
    "YSssssssssssSy",
    "YSSSSSSSSSSSSy",
    ".yyyyyyyyyyyy.",
]
# The express car: dark green steel, gold trim, the vault hatch amidships
BULL_PAL = {'S': hexc('#2f5a40'), 's': hexc('#244a34'), 'c': hexc('#4a7a5a'),
            'V': spr.GOLD, 'v': spr.GOLD_D, 'W': spr.GOLD_L}
# Vault open: the hatch slides back on a dark hold stacked with gold bars
BULL_OPEN_ROWS = {
    11: "YSSSKKKKKKSSSy",
    12: "YSSKOOOOOOKSSy",
    13: "YSSKOVvVvOKSSy",
    14: "YSSKOWVWVOKSSy",
    15: "YSSKOVvVvOKSSy",
    16: "YSSKOWVWVOKSSy",
    17: "YSSKOOOOOOKSSy",
    18: "YSSSKKKKKKSSSy",
}
BULL_OPEN = [BULL_OPEN_ROWS.get(i, row) for i, row in enumerate(BULLION)]
BULL_OPEN_PAL = {**BULL_PAL, 'O': hexc('#14100e')}

FRAME = 40  # train frames have room to turn 45 degrees without clipping


def _car(rows, pal):
    assert len(rows) == 28 and all(len(r) == 14 for r in rows), rows
    a = Art(FRAME, FRAME)
    a.grid((FRAME - 14) // 2, (FRAME - 28) // 2, rows, {**BASE, **pal})
    a.outline(OUTLINE)
    return a


def eight_ways(up_art):
    """Clockwise from facing up: U, UR, R, DR, D, DL, L, UL."""
    out = []
    for i in range(8):
        f = rotsprite(up_art, -45 * i) if i % 2 else up_art.rotated((-i // 2) % 4)
        f.drop_shadow(2, 2, SHADOW)
        out.append(f)
    return out


# Car kinds in sheet order; each takes 8 frames (src/art.js TRAIN_CARS)
TRAIN_CARS = ('loco', 'bullion', 'bullionOpen', 'boxcar', 'lumber', 'coach')


def train_frames():
    arts = {
        'loco': _car(LOCO, LOCO_PAL),
        'bullion': _car(BULLION, BULL_PAL),
        'bullionOpen': _car(BULL_OPEN, BULL_OPEN_PAL),
        'boxcar': _car(BOXCAR, BOX_PAL),
        'lumber': _car(LUMBER, LUMBER_PAL),
        'coach': _car(COACH, COACH_PAL),
    }
    return [f for kind in TRAIN_CARS for f in eight_ways(arts[kind])]


# --- The depot ------------------------------------------------------------------------

BIG_TRAIN = ['..####..', '.######.', '.#....#.', '.#....#.', '.######.', '.##..##.', '.######.',
             '..#..#..', '.##..##.']
STATION_PURPLE = hexc('#9f6bf0')


def station():
    """The depot: mustard board-and-batten under a green roof, a clock over
    the door and the station sign on the roof."""
    a, (x0, y0, x1, y1, fy) = spr._frontier_building(
        hexc('#5e7a5a'), hexc('#46604a'), hexc('#d8b050'), hexc('#c09a40'), hexc('#efe6cf'), BIG_TRAIN,
        trim=hexc('#6a4426'))
    for x in range(x0 + 2, x1, 3):
        a.vline(x, fy + 1, y1, hexc('#b08a3a'))  # battens
    a.rect(14, fy + 3, 4, 5, hexc('#3a2418'))
    a.disc(16, fy + 1.5, 1.8, hexc('#efe6cf'))
    a.set(16, fy + 1, hexc('#221a18'))
    a.set(16, fy + 2, hexc('#221a18'))
    for wx in (x0 + 3, x1 - 6):
        a.rect(wx, fy + 3, 3, 3, spr.IRON)
        a.set(wx, fy + 3, hexc('#9ab4c0'))
    full = Art(32, 32)
    full.blit(a, 0, 0)
    full.outline(OUTLINE)
    full.drop_shadow(2, 2, SHADOW)
    return full


def station_pad():
    return spr.pad(STATION_PURPLE, BIG_TRAIN)
