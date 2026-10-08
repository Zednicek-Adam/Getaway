"""The railway: track tiles, level crossings, the train and the station.

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

BALLAST = [hexc('#7d7468'), hexc('#6e665b'), hexc('#8a8174')]
BALLAST_EDGE = hexc('#5f584f')
SLEEPER = hexc('#5b3f2c')
SLEEPER_L = hexc('#74533a')
RAIL = hexc('#aab1bc')
RAIL_D = hexc('#5a5d68')
RUBBER = hexc('#2f3139')
RUBBER_SEAM = hexc('#26282e')

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
    """Rails over a road: drawn over the road tile on a crossing cell.

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
                c = RUBBER_SEAM if x % 7 == 0 or d > BED - 1 else RUBBER
                if RAIL_IN <= abs(side) < RAIL_OUT:
                    c = RAIL if abs(side) < RAIL_IN + 1 else RAIL_D
                a.set(x, y, c)
            else:
                _track_pixel(a, x, y, rng, d, side, x + 0.5, T)
    return a if axis == 'H' else a.rotated(1)


def barrier_frame(axis, down, lamp):
    """Both barrier arms for one crossing cell. lamp: which red lamp is lit."""
    a = Art(T, T)
    red, white = hexc('#e8413f'), hexc('#f4f6f8')
    lit, dark = hexc('#ff5a4a'), hexc('#5a1c22')
    # Two posts on opposite sidewalks; the arms reach across the road towards
    # each other, one on each side of the track
    for post_x, arm_y, sign in ((2, 3, 1), (T - 4, T - 5, -1)):
        a.rect(post_x, arm_y - 1, 3, 3, hexc('#2a2c34'))
        a.set(post_x + 1, arm_y, hexc('#6a6e79'))
        if down:
            for k in range(3, 24):
                ax = post_x + 1 + sign * k
                c = red if (k // 3) % 2 else white
                a.set(ax, arm_y, c)
                a.set(ax, arm_y + 1, shade(c, 0.78))
        else:
            # raised arm, seen end-on from above: a short stub
            a.set(post_x + 1 + sign * 2, arm_y, red)
            a.set(post_x + 1 + sign * 3, arm_y, white)
        a.set(post_x, arm_y - 1, lit if (down and lamp == 0) else dark)
        a.set(post_x + 2, arm_y - 1, lit if (down and lamp == 1) else dark)
    a.outline(OUTLINE)
    a.drop_shadow(1, 1, SHADOW)
    return a if axis == 'H' else a.rotated(1)


def crossing_frames():
    """[H up, H lamp A, H lamp B, V up, V lamp A, V lamp B]."""
    return [barrier_frame(axis, down, lamp)
            for axis in ('H', 'V')
            for down, lamp in ((False, 0), (True, 0), (True, 1))]


# --- The train ------------------------------------------------------------------------

BASE = {
    'Y': spr.GOLD, 'y': spr.GOLD_D, 'K': hexc('#22242c'), 'W': spr.HEAD, 'T': spr.TAIL,
    'g': spr.GLASS, 'G': spr.GLASS_L, 'w': hexc('#8a8f99'), 'c': spr.CHROME,
    'F': hexc('#1c1e26'), 'f': hexc('#5a5d68'),
}

LOCO = [
    "..YYYYYYYYYY..",
    ".YWYYKYYKYYWY.",
    "YYYYKYYYYKYYYY",
    "YYYKYYYYYYKYYY",
    "LBBBBBBBBBBBBD",
    "LGgggggggggggD",
    "Lggggggggggggd",
    "LBBBBBBBBBBBBD",
    "LBRRRRRRRRRRBD",
    "LBRrrrrrrrrRBD",
    "LBRRRRRRRRRRBD",
    "LwBBBBBBBBBBwD",
    "LwBFfFfFfFfBwD",
    "LwBfFfFfFfFBwD",
    "LwBFfFfFfFfBwD",
    "LwBBBBBBBBBBwD",
    "LwBB.FFFF.BBwD",
    "LwBBFffffFBBwD",
    "LwBBFfFFfFBBwD",
    "LwBBFffffFBBwD",
    "LwBB.FFFF.BBwD",
    "LwBBBBBBBBBBwD",
    "LwBBKKBBKKBBwD",
    "LwBBKKBBKKBBwD",
    "LwBBBBBBBBBBwD",
    "LCCCCCCCCCCCCD",
    "LTBBBBBBBBBBTD",
    ".DDDDDDDDDDDD.",
]
LOCO_PAL = {'B': hexc('#2f7a4f'), 'L': hexc('#4fa86a'), 'D': hexc('#1d4f33'),
            'd': hexc('#1d2a44'), 'R': hexc('#3b8a5c'), 'r': hexc('#2a6643'),
            'C': hexc('#efe6c8')}

BOXCAR = ([".LBBBBBBBBBBD.", "LBBBBBBBBBBBBD", "LBwwwwwwwwwwBD", "LBBBBBBBBBBBBD", "LbbbbbbbbbbbbD"]
          + [("LbbbbbwwbbbbbD" if i % 3 == 0 else "LBBBBBwwBBBBBD") for i in range(1, 18)]
          + ["LbbbbbbbbbbbbD", "LBBBBBBBBBBBBD", "LBwwwwwwwwwwBD", "LBBBBBBBBBBBBD", "LBBBBBBBBBBBBD",
             ".LBBBBBBBBBBD."])
BOX_PAL = {'B': hexc('#a0472e'), 'b': hexc('#8a3b26'), 'L': hexc('#c4643f'), 'D': hexc('#5e2618')}


def _container_rows(ch, cl):
    rows = ["KKKKKKKKKKKKKK", "K" + ch * 12 + "K"]
    for i in range(9):
        rows.append("K" + "".join(ch if (j + i) % 2 == 0 else cl for j in range(12)) + "K")
    rows.append("K" + ch * 12 + "K")
    return rows


FLATCAR = (_container_rows('A', 'a') + ["KKKKKKKKKKKKKK", "KffffffffffffK"]
           + _container_rows('E', 'e') + ["KKKKKKKKKKKKKK", ".KKKKKKKKKKKK."])
FLAT_PAL = {'A': hexc('#2f6fb3'), 'a': hexc('#285f9a'), 'E': hexc('#d8892a'), 'e': hexc('#bb7322')}


def _tank_rows():
    rows = ["....KKKKKK....", "..KKssssssKK..", ".KSSSSSSSSSSK.", ".LSSSHSSSSSSD."]
    for i in range(20):
        if i in (8, 11):
            rows.append("LSSSHSSccSSSSD")
        elif i in (9, 10):
            rows.append("LSSSHScffcSSSD")
        elif i in (3, 16):
            rows.append("LsssHssssssssD")
        else:
            rows.append("LSSSHSSSSSSSSD")
    return rows + [".LSSSHSSSSSSD.", ".KSSSSSSSSSSK.", "..KKssssssKK..", "....KKKKKK...."]


TANKCAR = _tank_rows()
TANK_PAL = {'S': hexc('#3a3d47'), 's': hexc('#30323a'), 'L': hexc('#5a5d68'), 'D': hexc('#22242c'),
            'H': hexc('#6c707c')}

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
BULL_PAL = {'S': hexc('#5a6070'), 's': hexc('#4a505c'), 'V': spr.GOLD, 'v': spr.GOLD_D, 'W': spr.GOLD_L}
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
BULL_OPEN_PAL = {**BULL_PAL, 'O': hexc('#14151b')}

FRAME = 40  # train frames have room to turn 45 degrees without clipping


def _car(rows, pal):
    assert len(rows) == 28 and all(len(r) == 14 for r in rows), rows
    a = Art(FRAME, FRAME)
    a.grid((FRAME - 14) // 2, (FRAME - 28) // 2, rows, {**BASE, **pal})
    a.outline(OUTLINE)
    return a


def eight_ways(up_art):
    """Clockwise from facing up: U, UR, R, DR, D, DL, L, UL (the heli's order)."""
    out = []
    for i in range(8):
        f = rotsprite(up_art, -45 * i) if i % 2 else up_art.rotated((-i // 2) % 4)
        f.drop_shadow(2, 2, SHADOW)
        out.append(f)
    return out


# Car kinds in sheet order; each takes 8 frames (src/art.js TRAIN_CARS)
TRAIN_CARS = ('loco', 'bullion', 'bullionOpen', 'boxcar', 'flatcar', 'tankcar')


def train_frames():
    arts = {
        'loco': _car(LOCO, LOCO_PAL),
        'bullion': _car(BULLION, BULL_PAL),
        'bullionOpen': _car(BULL_OPEN, BULL_OPEN_PAL),
        'boxcar': _car(BOXCAR, BOX_PAL),
        'flatcar': _car(FLATCAR, FLAT_PAL),
        'tankcar': _car(TANKCAR, TANK_PAL),
    }
    return [f for kind in TRAIN_CARS for f in eight_ways(arts[kind])]


# --- Station --------------------------------------------------------------------------

BIG_TRAIN = ['..####..', '.######.', '.#....#.', '.#....#.', '.######.', '.##..##.', '.######.',
             '..#..#..', '.##..##.']
STATION_PURPLE = hexc('#9f6bf0')


def station():
    a, (x0, y0, x1, y1, fy) = spr._landmark_building(
        hexc('#3f5a48'), hexc('#efe6c8'), hexc('#8a4a3a'), hexc('#efe6c8'), BIG_TRAIN,
        awning=(hexc('#2f7a4f'), hexc('#efe6c8')))
    # Clock over the door
    a.disc(16, fy + 4, 2.2, hexc('#efe6c8'))
    a.set(16, fy + 3, hexc('#22242c'))
    a.set(16, fy + 4, hexc('#22242c'))
    a.set(17, fy + 4, hexc('#22242c'))
    full = Art(32, 32)
    full.blit(a, 0, 0)
    full.outline(OUTLINE)
    full.drop_shadow(2, 2, SHADOW)
    return full


def station_pad():
    return spr.pad(STATION_PURPLE, BIG_TRAIN)


# --- Pickups and icons ----------------------------------------------------------------

TICKET = ['####.##', '#######', '.###.#.', '#######', '####.##']
PASS_BASE, PASS_LIGHT, PASS_DARK = hexc('#8a4fd0'), hexc('#b98af0'), hexc('#5a2c94')


def rail_pass_token():
    return spr.token(PASS_BASE, PASS_LIGHT, PASS_DARK, TICKET)


def ticket_icon():
    a = Art(16, 16)
    for y in range(4, 13):
        for x in range(1, 15):
            notch = x in (1, 14) and y in (7, 8, 9)
            if not notch:
                a.set(x, y, PASS_BASE)
    a.hline(2, 13, 4, PASS_LIGHT)
    a.vline(1, 4, 6, PASS_LIGHT)
    a.hline(2, 13, 12, PASS_DARK)
    for y in range(5, 12, 2):
        a.set(10, y, hexc('#d8c2f8'))
    for x in range(3, 9):
        a.set(x, 7, spr.WHITE)
    for x in range(3, 7):
        a.set(x, 9, hexc('#d8c2f8'))
    a.outline(OUTLINE)
    return a


def diamond_pickup():
    a = Art(16, 16)
    rows = ['..oooooooo..', '.oWCCcccccco', 'oCCCccccccco', '.occcccccco.', '..occccco...',
            '...occco....', '....oco.....', '.....o......']
    pal = {'o': hexc('#1f7f8f'), 'c': hexc('#3fd8e8'), 'C': hexc('#a8f0f8'), 'W': spr.WHITE}
    a.grid(2, 4, rows, pal)
    a.outline(OUTLINE)
    a.drop_shadow(1, 1, SHADOW)
    return a
