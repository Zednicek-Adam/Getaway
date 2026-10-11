"""Riders, wagons, the balloon, pickups, props, effects, HUD icons and UI panels.

Mounts are drawn top-down facing up. Horses gallop in four phases (legs
reaching and tucking, the head bobbing, the tail swinging), and every sheet
that carries a mount lays its frames out as rows of [LEFT, UP, RIGHT, DOWN],
one row per gait phase (src/objects/Car.js steps through the rows).
"""
import math

from pixelkit import Art, hexc, shade, mix, with_alpha, bayer, rng_for, rotsprite

OUTLINE = hexc('#1e130f')
SHADOW = (40, 22, 12, 90)
WHITE = hexc('#f6efe0')
GOLD = hexc('#ffc933')
GOLD_L = hexc('#fff09a')
GOLD_D = hexc('#d88a14')
GOLD_DD = hexc('#9c5a0c')
SKIN = hexc('#e2a878')
LEATHER = hexc('#8a5a34')
LEATHER_L = hexc('#b07a48')
LEATHER_D = hexc('#5e3a22')
WOOD = hexc('#9a6a3c')
WOOD_L = hexc('#c08a52')
WOOD_D = hexc('#6a4426')
WOOD_DD = hexc('#4a2e1a')
IRON = hexc('#3e3a3c')
IRON_L = hexc('#6e6a6c')
STEEL = hexc('#b8bcc4')
HOOF = hexc('#22160f')
LAMP = hexc('#ffe9a0')
RED = hexc('#c0392b')
RED_L = hexc('#e5604a')
RED_D = hexc('#842218')
CANVAS = hexc('#efe6cf')
WATER = hexc('#3f8fd0')
WATER_L = hexc('#8fd0f4')
WATER_D = hexc('#2a62a0')

GAIT_PHASES = 4


# --- Horses (top-down, facing up) ---------------------------------------------------

COATS = {
    #            base              light             dark              mane / tail
    'bay': (hexc('#6e3e22'), hexc('#93592f'), hexc('#4a2816'), hexc('#1f1410')),
    'chestnut': (hexc('#b4692e'), hexc('#d68e4e'), hexc('#82481e'), hexc('#5e2c12')),
    'grey': (hexc('#cfc9bd'), hexc('#efe9dd'), hexc('#9c968a'), hexc('#6e685e')),
    'black': (hexc('#3c2e2c'), hexc('#5a4846'), hexc('#251b19'), hexc('#140e0c')),
    'palomino': (hexc('#d9a64e'), hexc('#f2c878'), hexc('#a8782c'), hexc('#f6ecd2')),
    'dun': (hexc('#b89a6a'), hexc('#d6ba86'), hexc('#8a7048'), hexc('#3a2a1e')),
    'white': (hexc('#ece6da'), hexc('#fffaf0'), hexc('#b8b0a2'), hexc('#3a2a22')),
}

# Saddle horse silhouette, facing up: (y, first column, last column).
# Head and ears are added separately so they can bob with the gait.
HORSE_BODY = ([(10, 12, 19), (11, 12, 19), (12, 11, 20), (13, 11, 20)]
              + [(y, 10, 21) for y in range(14, 23)]
              + [(23, 11, 20), (24, 11, 20), (25, 11, 20), (26, 12, 19), (27, 13, 18)])

# Gallop, one entry per phase: head bob, tail swing, and each hoof as
# (x, y, leg) where leg is the direction back to the body. Phase 0 doubles
# as the standing pose.
L_, R_, U_, D_ = (1, 0), (-1, 0), (0, 1), (0, -1)
GALLOP = [
    dict(bob=0, sway=0, legs=((9, 13, L_), (22, 13, R_), (8, 21, L_), (23, 21, R_))),
    dict(bob=-1, sway=-1, legs=((11, 7, U_), (20, 8, U_), (8, 19, L_), (23, 18, R_))),
    dict(bob=0, sway=0, legs=((8, 16, L_), (23, 17, R_), (12, 30, D_), (19, 29, D_))),
    dict(bob=1, sway=1, legs=((9, 11, L_), (22, 12, R_), (8, 24, L_), (23, 25, R_))),
]

# Patches on the outlaw's paint horse: (centre x, centre y, radius)
PAINT_PATCHES = ((13.5, 11.5, 2.8), (19.0, 19.5, 3.8), (12.5, 25.0, 3.2), (11.0, 16.5, 1.8))


def _span_shade(a, y, x0, x1, base, light, dark):
    for x in range(x0, x1 + 1):
        a.set(x, y, light if x == x0 else dark if x == x1 else base)


def saddle_horse(a, coat, phase, paint=None):
    """A riding horse. `paint` = (base, light, dark) patches over a white coat."""
    base, light, dark, mane = COATS[coat]
    g = GALLOP[phase]
    bob = g['bob']
    # Legs first, so the body overlaps their roots
    leg = paint[0] if paint else base
    for (x, y, (dx, dy)) in g['legs']:
        a.set(x + dx, y + dy, leg)
        a.set(x + 2 * dx, y + 2 * dy, shade(leg, 0.8))
        a.set(x, y, HOOF)
    # Tail streams out behind, swinging from side to side
    sway = g['sway']
    for i, y in enumerate(range(27, 32)):
        off = (sway * (i + 1)) // 3
        a.set(15 + off, y, mane)
        a.set(16 + off, y, shade(mane, 1.5) if i == 4 else mane)
    # Body, then the head (it bobs as the horse reaches)
    for (y, x0, x1) in HORSE_BODY:
        _span_shade(a, y, x0, x1, base, light, dark)
    for y in range(3 + bob, 10):
        _span_shade(a, y, 13, 18, base, light, dark)
    a.hline(14, 17, 2 + bob, mix(base, dark, 0.5))
    a.hline(13, 18, 3 + bob, mix(base, dark, 0.3))
    a.set(14, 2 + bob, mix(base, HOOF, 0.6))  # nostrils
    a.set(17, 2 + bob, mix(base, HOOF, 0.6))
    if paint:
        p, pl, pd = paint
        for (y, x0, x1) in HORSE_BODY:
            for x in range(x0, x1 + 1):
                if any((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r for cx, cy, r in PAINT_PATCHES):
                    a.put(x, y, pl if x == x0 else pd if x == x1 else p)
    # Ears at the poll, mane down the neck
    a.set(12, 8 + bob, dark)
    a.set(19, 8 + bob, dark)
    a.set(12, 9 + bob, mane)
    a.set(19, 9 + bob, mane)
    for y in range(8 + bob, 14):
        a.set(15, y, mane)
        a.set(16, y, shade(mane, 1.3))


def team_horse(a, x0, y0, coat, phase):
    """A draft horse in harness, 6 wide; the gait drives the forelegs and
    the head, the hind end is tucked against the wagon."""
    base, light, dark, mane = COATS[coat]
    bob = -1 if GALLOP[phase]['bob'] < 0 else 0
    reach = {0: (7, 8), 1: (3, 4), 2: (9, 8), 3: (5, 6)}[phase]
    for x, ry in ((x0 - 1, reach[0]), (x0 + 6, reach[1])):
        a.set(x, y0 + ry, HOOF)
        a.set(x, y0 + ry + 1, base)
    rows = [(y0 + 5, 1, 4), (y0 + 6, 1, 4), (y0 + 7, 0, 5), (y0 + 8, 0, 5), (y0 + 9, 0, 5),
            (y0 + 10, 0, 5), (y0 + 11, 0, 5), (y0 + 12, 0, 5), (y0 + 13, 1, 4)]
    for (y, i0, i1) in rows:
        _span_shade(a, y, x0 + i0, x0 + i1, base, light, dark)
    for y in range(y0 + 1 + bob, y0 + 5):
        _span_shade(a, y, x0 + 1, x0 + 4, base, light, dark)
    a.hline(x0 + 2, x0 + 3, y0 + bob, mix(base, dark, 0.5))
    a.hline(x0 + 1, x0 + 4, y0 + 1 + bob, mix(base, dark, 0.3))
    a.set(x0, y0 + 4 + bob, dark)
    a.set(x0 + 5, y0 + 4 + bob, dark)
    for y in range(y0 + 4 + bob, y0 + 8):
        a.set(x0 + 3, y, mane)
    # Collar and the traces back to the wagon
    a.hline(x0, x0 + 5, y0 + 7, LEATHER_D)
    a.hline(x0 + 1, x0 + 4, y0 + 7, LEATHER)
    a.set(x0, y0 + 11, LEATHER_D)
    a.set(x0 + 5, y0 + 11, LEATHER_D)


# --- Riders ---------------------------------------------------------------------------

OUTLAW = dict(
    hat=hexc('#2e2422'), hat_l=hexc('#54443e'), hat_d=hexc('#170f0e'), band=hexc('#c0c4cc'),
    shirt=hexc('#b8342a'), shirt_l=hexc('#e05a46'), shirt_d=hexc('#7e1e18'),
    coat=hexc('#5e4c3e'), roll=hexc('#8e929a'), roll_stripe=hexc('#b8342a'),
    hands=hexc('#3a2a20'), bags=GOLD, badge=False,
)
DEPUTY = dict(
    hat=hexc('#ddd0b4'), hat_l=hexc('#fbf3e0'), hat_d=hexc('#a89a7e'), band=hexc('#5e3a22'),
    shirt=hexc('#3a5a96'), shirt_l=hexc('#5a7cc0'), shirt_d=hexc('#26406e'),
    coat=hexc('#7a5434'), roll=hexc('#c8b088'), roll_stripe=hexc('#8a6a44'),
    hands=hexc('#c8a070'), bags=None, badge=True,
)
# The outlaw rides a paint horse: brown patches over a white coat
PAINT = (hexc('#7a4426'), hexc('#9a5c34'), hexc('#52301a'))


def cowboy_hat_top(a, cx, cy, look, r=4.6):
    """A wide-brimmed hat seen from above, centred on (cx, cy): the brim lit
    top-left, the crown a lighter oval, its crease down the middle."""
    hat, hat_l, hat_d = look['hat'], look['hat_l'], look['hat_d']
    a.disc(cx, cy, r, hat)
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if not a.inside(x, y) or a.get(x, y) != hat:
                continue
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            if math.hypot(dx, dy) > r - 1.1:
                if dx + dy < -1.5:
                    a.put(x, y, hat_l)
                elif dx + dy > 1.5:
                    a.put(x, y, hat_d)
    a.ellipse(cx + 0.3, cy + 0.4, 2.6, 3.0, look['band'])
    crown = Art(a.w, a.h)
    crown.ellipse(cx, cy - 0.1, 2.4, 2.9, hat)
    for y in range(a.h):
        for x in range(a.w):
            if crown.filled(x, y):
                a.put(x, y, mix(hat_l, WHITE, 0.15) if x + 0.5 < cx else hat_l)
    a.set(int(cx), int(cy), hat)
    a.set(int(cx), int(cy) - 1, hat)


def rider(a, look, lean=0):
    """Rider on a saddle horse: saddlebags, bedroll, coat tails, shoulders,
    arms out to the reins and the hat on top. `lean` shifts the rider
    forward or back a pixel with the gait."""
    # Saddlebags hang either side, the bedroll is tied behind the saddle
    for x in (9, 22):
        a.rect(x, 20, 1, 3, LEATHER_D if x > 16 else LEATHER)
        if look['bags']:
            a.set(x, 20, look['bags'])
    a.rect(12, 20, 8, 2, LEATHER)
    a.hline(12, 19, 20, LEATHER_L)
    a.rect(11, 22, 10, 2, look['roll'])
    a.hline(11, 20, 22, shade(look['roll'], 1.15))
    a.vline(13, 22, 23, look['roll_stripe'])
    a.vline(18, 22, 23, look['roll_stripe'])
    y = 15 + lean
    a.rect(12, y + 3, 8, 2, look['coat'])
    a.hline(12, 19, y + 4, shade(look['coat'], 0.8))
    for x in range(9, 23):
        for yy in range(y - 1, y + 3):
            if x in (9, 22) and yy not in (y, y + 1):
                continue
            if x in (10, 21) and yy == y - 1:
                continue
            c = look['shirt_l'] if x <= 10 else look['shirt_d'] if x >= 21 else look['shirt']
            a.set(x, yy, c)
    a.set(10, y - 2, look['shirt_l'])
    a.set(21, y - 2, look['shirt_d'])
    a.set(11, y - 3, look['hands'])
    a.set(20, y - 3, look['hands'])
    a.set(13, y - 5, LEATHER_D)  # reins
    a.set(18, y - 5, LEATHER_D)
    if look['badge']:
        a.set(10, y, GOLD_L)
        a.set(10, y + 1, GOLD)
    cowboy_hat_top(a, 16, y + 1.5, look)


def mounted(look, coat, phase, paint=None):
    a = Art(32, 32)
    saddle_horse(a, coat, phase, paint)
    rider(a, look, lean=-1 if GALLOP[phase]['bob'] < 0 else 0)
    a.outline(OUTLINE)
    return a


def outlaw(phase):
    return mounted(OUTLAW, 'white', phase, paint=PAINT)


def deputy(phase):
    return mounted(DEPUTY, 'chestnut', phase)


# --- Wagons ---------------------------------------------------------------------------

def _wheel_top(a, x, y0, rim=IRON, hub=IRON_L):
    """A wagon wheel seen edge-on from above, 2 wide and 4 long."""
    a.rect(x, y0, 2, 4, rim)
    a.set(x, y0 + 1, hub)
    a.set(x + 1, y0 + 2, hub)


def _team(a, coats, phase):
    team_horse(a, 9, 1, coats[0], phase)
    team_horse(a, 17, 1, coats[1], (phase + 1) % GAIT_PHASES)
    # wagon tongue between the pair
    a.vline(15, 6, 15, WOOD_D)
    a.vline(16, 6, 15, WOOD_DD)


def marshal_wagon(phase):
    """The marshals' prison wagon: a black barred box behind a dark team,
    a gold star on the roof and a lantern on the driver's corner."""
    a = Art(32, 32)
    box, box_l, box_d = hexc('#2e2826'), hexc('#4a403c'), hexc('#1c1716')
    for wy in (17, 25):
        _wheel_top(a, 7, wy)
        _wheel_top(a, 23, wy)
    x0, x1, y0, y1 = 9, 22, 15, 30
    for y in range(y0, y1 + 1):
        _span_shade(a, y, x0, x1, box, box_l, box_d)
    a.hline(x0, x1, y0, box_l)
    # iron bars down both walls
    for y in range(y0 + 5, y1, 2):
        a.set(x0, y, STEEL)
        a.set(x1, y, IRON_L)
    # roof boards and the star
    for y in range(y0 + 5, y1, 3):
        a.hline(x0 + 2, x1 - 2, y, box_d)
    a.grid(13, 21, ['..#..', '#####', '.###.', '##.##'], {'#': GOLD})
    a.set(15, 21, GOLD_L)
    # driver's bench: a lawman in a bowler hat, a lantern on the corner
    a.rect(x0 + 1, y0 + 1, x1 - x0 - 1, 2, WOOD_D)
    a.rect(13, y0 + 2, 6, 2, hexc('#3a3436'))
    a.disc(16, y0 + 1.5, 1.9, hexc('#4a4446'))
    a.disc(15.6, y0 + 1.1, 1.0, hexc('#6a6466'))
    a.set(x0, y0 + 1, LAMP)
    a.set(x0, y0 + 2, GOLD_D)
    _team(a, ('bay', 'dun'), phase)
    a.outline(OUTLINE)
    return a


def stagecoach(phase):
    """The stagecoach: a red and gold coach behind a light team, a strongbox
    strapped on the roof among the luggage."""
    a = Art(32, 32)
    body, body_l, body_d = hexc('#a8322a'), hexc('#d0503e'), hexc('#6e1c16')
    for wy in (16, 25):
        _wheel_top(a, 7, wy, rim=hexc('#c89a2a'), hub=GOLD_L)
        _wheel_top(a, 23, wy, rim=hexc('#c89a2a'), hub=GOLD_L)
    x0, x1, y0, y1 = 9, 22, 15, 30
    for y in range(y0 + 1, y1 + 1):
        _span_shade(a, y, x0, x1, body, body_l, body_d)
    a.hline(x0 + 1, x1 - 1, y0, body_l)
    # gold trim round the roof
    a.hline(x0 + 1, x1 - 1, y0 + 4, GOLD)
    a.hline(x0 + 1, x1 - 1, y1, GOLD_D)
    a.vline(x0 + 1, y0 + 4, y1, GOLD_L)
    a.vline(x1 - 1, y0 + 4, y1, GOLD_D)
    # luggage rail: carpet bag, trunk and the green strongbox
    a.rect(x0 + 2, y0 + 5, x1 - x0 - 3, y1 - y0 - 6, hexc('#5a3a26'))
    a.rect(12, y0 + 6, 4, 3, hexc('#8a6a44'))
    a.hline(12, 15, y0 + 6, hexc('#a8845a'))
    a.rect(16, y0 + 6, 4, 4, hexc('#3a2a4a'))
    a.hline(16, 19, y0 + 7, hexc('#c8a050'))
    a.rect(12, y0 + 10, 8, 5, hexc('#2f6a46'))
    a.hline(12, 19, y0 + 10, hexc('#4a9a66'))
    for (x, y) in ((12, y0 + 10), (19, y0 + 10), (12, y0 + 14), (19, y0 + 14)):
        a.set(x, y, GOLD)
    a.rect(15, y0 + 11, 2, 2, GOLD)
    a.set(15, y0 + 11, GOLD_L)
    # driver and shotgun guard up on the box
    a.rect(x0 + 1, y0 + 1, x1 - x0 - 1, 3, WOOD_D)
    for cx, hat in ((13, (hexc('#c8a070'), hexc('#e8c898'), hexc('#8a6a44'))),
                    (19, (hexc('#6a6466'), hexc('#8a8486'), hexc('#3e3a3c')))):
        a.disc(cx, y0 + 2, 2.1, hat[0])
        a.set(cx - 1, y0 + 1, hat[1])
        a.set(cx, y0 + 2, hat[2])
    a.set(21, y0 + 3, IRON)  # shotgun barrel
    a.set(22, y0 + 2, IRON)
    _team(a, ('palomino', 'grey'), phase)
    a.outline(OUTLINE)
    return a


def gait_rows(make):
    """[phase 0: L, U, R, D, phase 1: L, U, R, D, ...] for a mount drawn by make(phase)."""
    return [f for p in range(GAIT_PHASES) for f in direction_frames(make(p))]


def direction_frames(up_art):
    """[LEFT, UP, RIGHT, DOWN] with a consistent down-right drop shadow."""
    out = []
    for q in (1, 0, 3, 2):
        f = up_art.rotated(q)
        f.drop_shadow(2, 2, SHADOW)
        out.append(f)
    return out


# --- The handcar the outlaw rides the rails on ------------------------------------------

def handcar(phase):
    """A pump handcar sized to the track gauge (rails at columns 8-9 and
    21-22); the walking beam rocks between the two phases."""
    a = Art(32, 32)
    for x in (8, 21):
        for y in (8, 20):
            a.rect(x, y, 2, 4, IRON)
            a.set(x, y + 1, IRON_L)
    a.rect(9, 9, 14, 14, WOOD)
    for y in range(9, 23):
        a.hline(9, 22, y, WOOD_L if y % 3 == 0 else WOOD if y % 3 == 1 else WOOD_D)
    a.vline(9, 9, 22, WOOD_L)
    a.vline(22, 9, 22, WOOD_DD)
    # pump post and walking beam; the handle at the low end reads darker
    a.rect(15, 14, 2, 3, IRON)
    a.vline(15, 10, 21, IRON_L)
    a.vline(16, 10, 21, IRON)
    front, back = ((STEEL, IRON), (IRON, STEEL))[phase]
    a.hline(12, 19, 10, front)
    a.hline(12, 19, 21, back)
    # the outlaw heaves on the back handle
    lean = 0 if phase == 0 else 1
    look = OUTLAW
    a.rect(12, 21 - lean, 8, 2, look['shirt'])
    a.hline(12, 19, 21 - lean, look['shirt_l'])
    cowboy_hat_top(a, 16, 22.5 - lean, look, r=3.4)
    a.outline(OUTLINE)
    return a


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
TICKET = ['####.##', '#######', '.###.#.', '#######', '####.##']


def coin_full():
    a = shape_from_fn(16, 16, lambda x, y: (x - 8) ** 2 + (y - 8) ** 2 <= 6.6 ** 2, GOLD, GOLD_L, GOLD_D)
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
    gw, gh = len(icon[0]), len(icon)
    glyph(a, 8 - gw // 2, 8 - gh // 2, icon, WHITE, shadow=shade(dark, 0.8))
    return a


# --- Pickups and icons ---------------------------------------------------------------

def dynamite_bundle(spark_phase=0, lit=True):
    """Three red sticks bound with twine, fuse curling up to a spark."""
    a = Art(16, 16)
    for i, x in enumerate((3, 6, 9)):
        top = 6 if i != 1 else 5
        a.rect(x, top, 3, 14 - top, RED)
        a.vline(x, top, 13, RED_L)
        a.vline(x + 2, top, 13, RED_D)
        a.hline(x, x + 2, top, hexc('#f0d8b0'))
    a.hline(3, 11, 9, hexc('#d8b880'))
    a.hline(3, 11, 10, hexc('#a8844e'))
    a.outline(OUTLINE)
    # fuse from the middle stick
    for (x, y) in ((7, 4), (8, 3), (9, 3), (10, 2)):
        a.set(x, y, hexc('#d8c8a0'))
    if lit:
        hot = ((11, 1), (12, 0), (12, 2)) if spark_phase == 0 else ((11, 1), (10, 0), (12, 1))
        a.set(*hot[0], WHITE)
        a.set(*hot[1], GOLD)
        a.set(*hot[2], hexc('#ff8a2a'))
    return a


def dynamite_stick():
    a = Art(16, 16)
    for y in range(4, 15):
        for x in range(5, 10):
            a.set(x, y, RED_L if x == 5 else RED_D if x == 9 else RED)
    a.hline(5, 9, 4, hexc('#f0d8b0'))
    a.hline(5, 9, 8, hexc('#d8b880'))
    a.hline(5, 9, 11, hexc('#d8b880'))
    a.outline(OUTLINE)
    for (x, y) in ((8, 3), (9, 2), (10, 2)):
        a.set(x, y, hexc('#d8c8a0'))
    a.set(11, 1, WHITE)
    a.set(12, 0, GOLD)
    a.set(12, 2, hexc('#ff8a2a'))
    return a


def tonic():
    """Snake oil: a green bottle with a red-cross label and a cork."""
    a = Art(16, 16)
    glass, glass_l, glass_d = hexc('#3e8a52'), hexc('#8ad49a'), hexc('#245a34')

    def fn(x, y):
        return (6.5 <= x <= 9.5 and 2.5 <= y <= 6) or (4 <= x <= 12 and 6 <= y <= 15) or \
            (5 <= x <= 11 and 5.4 <= y <= 6.5)
    body = shape_from_fn(16, 16, fn, glass, glass_l, glass_d, outline=None)
    a.blit(body, 0, 0)
    a.rect(7, 1, 2, 2, hexc('#b88a5a'))
    a.set(7, 1, hexc('#d8aa78'))
    a.rect(5, 8, 6, 5, CANVAS)
    a.hline(5, 10, 8, hexc('#fff8e8'))
    a.vline(7, 9, 11, RED)
    a.vline(8, 9, 11, RED)
    a.hline(6, 9, 10, RED)
    a.set(5, 7, glass_l)
    a.outline(OUTLINE)
    return a


def carrot():
    a = Art(16, 16)
    orange, orange_l, orange_d = hexc('#f08a2a'), hexc('#ffb860'), hexc('#b8561a')
    ax, ay, bx, by = 3.0, 13.5, 10.5, 5.5

    def fn(x, y):
        vx, vy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)))
        cx, cy = ax + vx * t, ay + vy * t
        return math.hypot(x - cx, y - cy) <= 0.6 + 2.3 * t
    body = shape_from_fn(16, 16, fn, orange, orange_l, orange_d, outline=None)
    a.blit(body, 0, 0)
    for (x, y) in ((6, 9), (8, 8), (5, 11), (9, 6)):
        a.set(x, y, orange_d)
    leaf, leaf_l, leaf_d = hexc('#4ea83e'), hexc('#8ad868'), hexc('#2e6a26')
    for (x, y, c) in ((11, 4, leaf), (12, 3, leaf_l), (13, 2, leaf_l), (12, 5, leaf), (13, 6, leaf_d),
                      (14, 5, leaf), (10, 3, leaf_d), (11, 2, leaf), (11, 1, leaf_l), (13, 4, leaf)):
        a.set(x, y, c)
    a.outline(OUTLINE)
    return a


ROPE = hexc('#d0a868')
ROPE_L = hexc('#f0d098')
ROPE_D = hexc('#946a34')


def lasso_coil():
    """A coiled lariat with its knot and a loose end."""
    a = Art(16, 16)
    for y in range(16):
        for x in range(16):
            u, v = (x + 0.5 - 8) / 6.2, (y + 0.5 - 8.5) / 5.4
            r = math.sqrt(u * u + v * v)
            if 0.66 <= r <= 1.0:
                twist = (x + y) % 3 == 0
                c = ROPE_D if twist else ROPE_L if (u + v) < -0.4 else ROPE
                a.set(x, y, c)
    # a second coil peeking inside
    for y in range(16):
        for x in range(16):
            u, v = (x + 0.5 - 8.5) / 4.1, (y + 0.5 - 9) / 3.3
            if 0.75 <= math.sqrt(u * u + v * v) <= 1.0 and y > 8:
                a.set(x, y, ROPE_D if (x + y) % 3 == 0 else ROPE)
    a.rect(11, 3, 3, 2, ROPE_D)
    a.set(11, 3, ROPE_L)
    for (x, y) in ((13, 9), (14, 10), (14, 11), (13, 12), (14, 13)):
        a.set(x, y, ROPE)
    a.outline(OUTLINE)
    return a


def cowboy_hat(base=hexc('#c8986a'), light=hexc('#ecc290'), dark=hexc('#8e643e'),
               band=hexc('#4a2c1a'), spec=True):
    """A cowboy hat side on: pinched crown, band, brim curling up."""
    a = Art(16, 16)
    rows = [
        '.....##..##.....',
        '....###.####....',
        '....########....',
        '....########....',
        '....BBBBBBBB....',
        '#...########...#',
        '##############.#',
        '.##############.',
        '..############..',
    ]
    a.grid(0, 3, rows, {'#': base, 'B': band})
    for y in range(16):
        for x in range(16):
            if a.get(x, y) != base:
                continue
            if not a.filled(x - 1, y) or not a.filled(x, y - 1):
                a.put(x, y, light)
            elif not a.filled(x + 1, y) or not a.filled(x, y + 1):
                a.put(x, y, dark)
    a.vline(7, 4, 6, dark)
    if spec:
        a.set(5, 4, WHITE)
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


def sheriff_badge(base, light, dark, empty=False):
    """Six-pointed tin star with a ball on every point."""
    pts = []
    for i in range(12):
        r = 6.2 if i % 2 == 0 else 3.3
        ang = -math.pi / 2 + i * math.pi / 6
        pts.append((8 + r * math.cos(ang), 8.2 + r * math.sin(ang)))

    def inside(x, y):
        c = False
        j = len(pts) - 1
        for i in range(len(pts)):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                c = not c
            j = i
        if c:
            return True
        for k in range(6):
            ang = -math.pi / 2 + k * math.pi / 3
            if math.hypot(x - (8 + 6.4 * math.cos(ang)), y - (8.2 + 6.4 * math.sin(ang))) <= 1.35:
                return True
        return False
    a = shape_from_fn(16, 16, inside, base, light, dark)
    if not empty:
        for y in range(16):
            for x in range(16):
                d = math.hypot(x + 0.5 - 8, y + 0.5 - 8.2)
                if 2.0 < d <= 2.9:
                    a.put(x, y, dark if x + y > 15 else light)
        a.set(5, 5, WHITE)
    return a


def money_bag():
    sack, sack_l, sack_d = hexc('#c9a46b'), hexc('#ead09a'), hexc('#8f6a3a')

    def fn(x, y):
        return ((x - 8) ** 2 + (y - 10.2) ** 2 <= 5.3 ** 2 or (5.5 <= x <= 10.5 and 3 <= y <= 6)
                or (4.5 <= x <= 11.5 and 1.5 <= y <= 3))
    a = shape_from_fn(16, 16, fn, sack, sack_l, sack_d)
    a.hline(6, 9, 5, hexc('#5a3a1e'))
    glyph(a, 6, 7, ['.##.', '#...', '.##.', '...#', '.##.'], hexc('#6a4220'))
    a.vline(7, 6, 12, hexc('#6a4220'))
    return a


def canteen():
    """Stamina: a felt-covered canteen with its cork and strap."""
    felt, felt_l, felt_d = hexc('#5a82a8'), hexc('#8ab0d0'), hexc('#36587a')
    a = shape_from_fn(16, 16, lambda x, y: (x - 8) ** 2 + (y - 9.5) ** 2 <= 5.4 ** 2, felt, felt_l, felt_d,
                      outline=None)
    for y in range(16):
        for x in range(16):
            d = math.hypot(x + 0.5 - 8, y + 0.5 - 9.5)
            if 4.4 < d <= 5.4:
                a.put(x, y, hexc('#c8ccd4') if x + y < 17 else hexc('#7a808c'))
    a.rect(7, 2, 2, 3, hexc('#b88a5a'))
    a.set(7, 2, hexc('#d8aa78'))
    a.line(2, 4, 4, 7, LEATHER)
    a.line(14, 4, 12, 7, LEATHER_D)
    a.set(6, 7, felt_l)
    a.outline(OUTLINE)
    return a


def arrow_up():
    def fn(x, y):
        return (6 <= x <= 10 and 7 <= y <= 14) or (y >= 1.5 and y < 8 and abs(x - 8) <= (y - 1.5) + 0.6)
    return shape_from_fn(16, 16, fn, hexc('#efe0bc'), hexc('#fff8e4'), hexc('#b49a6a'))


def horse_head():
    """Steed upgrade: a horse's head in profile."""
    rows = [
        '......mm........',
        '.....mm#........',
        '....mm####......',
        '...mm#o#####....',
        '..mm#########...',
        '..m###########..',
        '..m####...#####.',
        '.mm###.....###..',
        '.m####..........',
        '.m####..........',
        'mm####..........',
        'm#####..........',
    ]
    base, light, dark, mane = COATS['chestnut']
    a = Art(16, 16)
    a.grid(0, 2, rows, {'#': base, 'm': mane, 'o': hexc('#1a1010')})
    for y in range(16):
        for x in range(16):
            if a.get(x, y) != base:
                continue
            if not a.filled(x, y - 1):
                a.put(x, y, light)
            elif not a.filled(x, y + 1) or not a.filled(x + 1, y):
                a.put(x, y, dark)
    a.set(14, 8, hexc('#1a1010'))
    a.outline(OUTLINE)
    return a


def horseshoe(base=hexc('#9aa0aa'), light=hexc('#dfe3ea'), dark=hexc('#5a606a')):
    def fn(x, y):
        d = math.hypot(x - 8, y - 9)
        ring = 3.4 <= d <= 6.6 and not (y < 9 and abs(x - 8) < 3.6)
        return ring and y > 2
    a = shape_from_fn(16, 16, fn, base, light, dark, outline=None)
    for (x, y) in ((3, 8), (3, 11), (12, 8), (12, 11), (6, 14), (9, 14)):
        a.set(x, y, dark)
    a.outline(OUTLINE)
    return a


def strongbox():
    """The stagecoach's strongbox, dropped when the train wrecks the coach."""
    a = Art(16, 16)
    green, green_l, green_d = hexc('#2f6a46'), hexc('#5aa070'), hexc('#1c4430')
    a.rect(2, 7, 12, 7, green)
    a.rect(2, 3, 12, 4, green_l)
    a.hline(3, 12, 3, hexc('#8ad0a0'))
    a.hline(2, 13, 7, green_d)
    a.vline(13, 7, 13, green_d)
    for (x, y) in ((2, 3), (13, 3), (2, 13), (13, 13), (2, 7), (13, 7)):
        a.set(x, y, GOLD)
    a.rect(7, 7, 2, 3, GOLD)
    a.set(7, 7, GOLD_L)
    a.set(8, 9, GOLD_DD)
    a.hline(2, 13, 10, shade(green, 0.85))
    a.outline(OUTLINE)
    a.drop_shadow(1, 1, SHADOW)
    return a


def pickup_frames():
    """Pickup sheet (16x16 frames). Returns (frames, index map)."""
    frames = []
    idx = {}
    idx['coin'] = len(frames)
    frames += coin_frames()
    idx['repair'] = len(frames)
    frames.append(tonic())
    idx['nitro'] = len(frames)
    frames.append(carrot())
    idx['rocket'] = len(frames)
    frames.append(lasso_coil())
    idx['bomb'] = len(frames)
    frames += [dynamite_bundle(0), dynamite_bundle(1)]
    idx['life'] = len(frames)
    frames.append(cowboy_hat())
    idx['planted'] = len(frames)
    frames += [dynamite_bundle(0), dynamite_bundle(1, lit=False)]
    idx['railPass'] = len(frames)
    frames.append(token(hexc('#8a4fd0'), hexc('#b98af0'), hexc('#5a2c94'), TICKET))
    idx['diamond'] = len(frames)
    frames.append(strongbox())
    return frames, idx


def ticket_icon():
    a = Art(16, 16)
    base, light, dark = hexc('#8a4fd0'), hexc('#b98af0'), hexc('#5a2c94')
    for y in range(4, 13):
        for x in range(1, 15):
            if not (x in (1, 14) and y in (7, 8, 9)):
                a.set(x, y, base)
    a.hline(2, 13, 4, light)
    a.vline(1, 4, 6, light)
    a.hline(2, 13, 12, dark)
    for y in range(5, 12, 2):
        a.set(10, y, hexc('#d8c2f8'))
    for x in range(3, 9):
        a.set(x, 7, WHITE)
    for x in range(3, 7):
        a.set(x, 9, hexc('#d8c2f8'))
    a.outline(OUTLINE)
    return a


def icon_frames():
    frames = []
    idx = {}

    def add(name, art):
        idx[name] = len(frames)
        frames.append(art)
    add('coin', coin_full())
    add('bag', money_bag())
    add('hat', cowboy_hat())
    add('hatEmpty', cowboy_hat(hexc('#3a2e2a'), hexc('#4e403a'), hexc('#2a201c'), hexc('#241a16'), spec=False))
    add('heart', heart())
    add('heartEmpty', heart(hexc('#3e3030'), hexc('#54423e'), hexc('#2a201e'), spec=False))
    add('stamina', canteen())
    add('dynamite', dynamite_stick())
    add('lasso', lasso_coil())
    add('badge', sheriff_badge(GOLD, GOLD_L, GOLD_D))
    add('badgeEmpty', sheriff_badge(hexc('#4a3a30'), hexc('#5e4c40'), hexc('#33281f'), empty=True))
    add('arrow', arrow_up())
    add('horse', horse_head())
    add('horseshoe', horseshoe())
    add('carrot', carrot())
    add('ticket', ticket_icon())
    return frames, idx


# --- Props -------------------------------------------------------------------------

def _barrel_top(a, cx, cy, r=3.2):
    a.disc(cx, cy, r, WOOD_D)
    a.disc(cx, cy, r - 0.9, WOOD)
    a.disc(cx - 0.6, cy - 0.6, r - 2.0, WOOD_L)
    for k in range(8):
        ang = k * math.pi / 4
        a.set(int(cx + (r - 0.4) * math.cos(ang)), int(cy + (r - 0.4) * math.sin(ang)), IRON)


def barricade(vertical_road, phase):
    """A posse barricade across the street: sawhorse planks painted red and
    cream, a barrel at each end and two lanterns flickering on the rail."""
    a = Art(32, 32)
    for by in (11, 18):
        for x in range(4, 28):
            c = RED if ((x + by) // 4) % 2 == 0 else CANVAS
            a.set(x, by, c)
            a.set(x, by + 1, shade(c, 0.78))
        # crossed sawhorse legs at each end
        for lx in (6, 25):
            a.set(lx - 1, by - 1, WOOD_D)
            a.set(lx + 1, by - 1, WOOD_D)
            a.set(lx - 1, by + 2, WOOD_DD)
            a.set(lx + 1, by + 2, WOOD_DD)
    _barrel_top(a, 3.5, 15.5)
    _barrel_top(a, 28.5, 15.5)
    lit, dim = LAMP, hexc('#8a5a1a')
    for i, lx in enumerate((11, 21)):
        on = (i % 2 == phase)
        a.rect(lx, 14, 2, 3, IRON)
        a.set(lx, 15, lit if on else dim)
        a.set(lx + 1, 15, GOLD if on else dim)
    a.outline(OUTLINE)
    a.drop_shadow(1, 2, SHADOW)
    return a.rotated(1) if not vertical_road else a


def _frontier_building(roof, roof_d, wall, wall_d, paint, glyph_rows, trim=None):
    """A one-tile landmark in the town's 3/4 view: a pitched plank roof
    carrying a painted sign, a clapboard front with a porch underneath."""
    a = Art(32, 32)
    x0, y0, x1, y1 = 3, 2, 28, 28
    fy = y1 - 8 + 1
    # clapboard front
    for y in range(fy, y1 + 1):
        a.hline(x0, x1, y, wall if (y - fy) % 2 else wall_d)
    a.vline(x0, fy, y1, shade(wall, 1.15))
    a.vline(x1, fy, y1, shade(wall, 0.75))
    # roof planks run down the slope; ridge across the middle
    for y in range(y0, fy):
        for x in range(x0, x1 + 1):
            c = roof if (x - x0) % 4 else roof_d
            if (y + (x - x0) // 4 * 3) % 7 == 0:
                c = shade(c, 0.85)
            a.put(x, y, c)
    ridge = (y0 + fy) // 2
    a.hline(x0, x1, y0, shade(roof, 1.2))
    a.hline(x0, x1, fy - 1, shade(roof_d, 0.7))
    gw, gh = len(glyph_rows[0]), len(glyph_rows)
    gx = (x0 + x1 + 1) // 2 - gw // 2
    gy = ridge - gh // 2 + 1
    a.grid(gx + 1, gy + 1, glyph_rows, {'#': shade(roof_d, 0.6)})
    a.grid(gx, gy, glyph_rows, {'#': paint})
    if trim:
        a.hline(x0, x1, fy, trim)
    return a, (x0, y0, x1, y1, fy)


BIG_DOLLAR = ['...##...', '.######.', '##.##...', '##.##...', '.######.', '...##.##',
              '...##.##', '.######.', '...##...']
BIG_DROP = ['...##...', '...##...', '..####..', '.######.', '########', '#####.##', '####.###',
            '.######.', '..####..']


def hideout():
    """The outlaw's hideout: a ramshackle plank shack with a gold dollar
    daubed on the roof, a lantern by the door and loot sacks piled up."""
    a, (x0, y0, x1, y1, fy) = _frontier_building(
        hexc('#6e5a48'), hexc('#54443a'), hexc('#8a6a4a'), hexc('#76583c'), GOLD, BIG_DOLLAR,
        trim=hexc('#4a3a2e'))
    # dark doorway, boarded window, lantern
    a.rect(14, fy + 2, 5, 6, hexc('#1e1410'))
    a.vline(14, fy + 2, y1, WOOD_D)
    a.rect(x0 + 3, fy + 2, 5, 3, hexc('#2a1e18'))
    a.line(x0 + 3, fy + 2, x0 + 7, fy + 4, WOOD_L)
    a.set(x1 - 4, fy + 2, LAMP)
    a.set(x1 - 4, fy + 3, GOLD_D)
    # sacks of loot by the door
    for sx in (20, 23):
        a.disc(sx + 0.5, y1 - 1.5, 1.8, hexc('#c9a46b'))
        a.set(sx, y1 - 3, hexc('#8f6a3a'))
    a.set(21, y1 - 2, GOLD_DD)
    full = Art(32, 32)
    full.blit(a, 0, 0)
    full.outline(OUTLINE)
    full.drop_shadow(2, 2, SHADOW)
    return full


def water_stop():
    """Where the horse drinks: a plank water tank under a windmill, the
    trough along the front."""
    a = Art(32, 32)
    # trough along the bottom
    a.rect(4, 22, 24, 6, WOOD_D)
    a.rect(5, 23, 22, 4, WATER)
    a.hline(5, 26, 23, WATER_L)
    for x in (9, 15, 21):
        a.set(x, 25, WATER_L)
    a.hline(4, 27, 22, WOOD_L)
    # round tank: staves and water on top
    a.disc(11.5, 11.5, 8.5, WOOD_DD)
    a.disc(11.5, 11.5, 7.6, WOOD)
    for k in range(16):
        ang = k * math.pi / 8
        a.set(int(11.5 + 7.2 * math.cos(ang)), int(11.5 + 7.2 * math.sin(ang)), WOOD_D)
    a.disc(11.5, 11.5, 6.2, WATER_D)
    a.disc(11.0, 11.0, 5.2, WATER)
    a.hline(8, 11, 9, WATER_L)
    a.hline(12, 14, 12, WATER_L)
    # windmill wheel on its tower, blades fanned round the hub
    cx, cy = 24.5, 8.5
    for k in range(12):
        ang = k * math.pi / 6
        for r in range(2, 8):
            c = CANVAS if k % 2 == 0 else hexc('#c8bca4')
            a.set(int(cx + r * math.cos(ang)), int(cy + r * math.sin(ang)), c)
    a.disc(cx, cy, 1.6, IRON)
    a.line(24, 9, 28, 16, IRON_L)  # tail vane
    a.rect(27, 15, 3, 3, RED)
    a.outline(OUTLINE)
    a.drop_shadow(2, 2, SHADOW)
    return a


def pad(colour, glyph_rows):
    """Where to stop on the street: corner stakes strung with coloured
    bunting, and the sign scratched into the dirt."""
    a = Art(32, 32)
    paint = with_alpha(colour, 230)
    pale = with_alpha(colour, 150)
    for i in range(5, 27):
        if (i // 2) % 2 == 0:
            for t in (4,):
                a.set(i, t, paint)
                a.set(i, 31 - t, paint)
                a.set(t, i, paint)
                a.set(31 - t, i, paint)
        else:
            a.set(i, 5, pale)
            a.set(i, 26, pale)
            a.set(5, i, pale)
            a.set(26, i, pale)
    for (cx, cy) in ((4, 4), (27, 4), (4, 27), (27, 27)):
        a.rect(cx - 1, cy - 1, 2, 2, WOOD_D)
        a.set(cx - 1, cy - 1, WOOD_L)
    gw, gh = len(glyph_rows[0]), len(glyph_rows)
    a.grid(16 - gw // 2, 16 - gh // 2, glyph_rows, {'#': with_alpha(colour, 170)})
    return a


# --- The army balloon ------------------------------------------------------------------

def balloon(flag):
    """An army observation balloon in 3/4 view with a limelight on the
    basket. flag: -1 streams left, 1 right, 0 hangs limp."""
    a = Art(48, 48)
    cx, cy, rx, ry = 24.0, 17.0, 14.0, 15.0
    red, red_l, red_d = hexc('#b8382c'), hexc('#e0604c'), hexc('#7a2018')
    cream, cream_l, cream_d = hexc('#e8dcc0'), hexc('#fff6e2'), hexc('#b0a284')
    for y in range(48):
        for x in range(48):
            v = (y + 0.5 - cy) / ry
            if abs(v) > 1:
                continue
            half = rx * math.sqrt(1 - v * v) * (1 - 0.32 * max(0.0, v))
            u = (x + 0.5 - cx) / half if half > 0 else 9
            if abs(u) > 1:
                continue
            gore = int((math.asin(u) / math.pi + 0.5) * 8)
            striped = gore % 2 == 0
            lit = u < -0.45 or (v < -0.6 and u < 0.2)
            dark = u > 0.55 or v > 0.7
            if striped:
                c = red_l if lit else red_d if dark else red
            else:
                c = cream_l if lit else cream_d if dark else cream
            a.set(x, y, c)
    # load ring and the rigging down to the basket
    for x in range(17, 32):
        a.set(x, 30, hexc('#6a4a2a'))
    for (sx, ex) in ((18, 21), (24, 24), (30, 27)):
        a.line(sx, 31, ex, 37, hexc('#8a6a44'))
    # wicker basket with a limelight on the front
    a.rect(20, 37, 9, 6, hexc('#b8925a'))
    for y in range(38, 43):
        for x in range(20, 29):
            if (x + y) % 2 == 0:
                a.set(x, y, hexc('#94703e'))
    a.hline(20, 28, 37, hexc('#d8b880'))
    a.rect(23, 41, 3, 2, IRON)
    a.set(24, 41, WHITE)
    a.set(24, 42, LAMP)
    # pennant on top
    a.vline(24, 0, 2, IRON)
    if flag:
        for k in range(5):
            x = 24 - flag * (k + 1)
            a.set(x, 0, RED)
            if k < 3:
                a.set(x, 1, RED_D)
    else:
        a.vline(25, 0, 2, RED)
    a.outline(OUTLINE)
    return a


def balloon_shadow():
    a = Art(32, 14)
    a.ellipse(16, 7, 15, 6, (36, 20, 12, 70))
    a.ellipse(16, 7, 11, 4.2, (36, 20, 12, 40))
    return a


# --- Effects ------------------------------------------------------------------------

def _hash(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
    return (n & 0xffff) / 65535.0


def explosion_frames(n=8, size=40):
    """Cartoon fireball: a union of puffs that swell, cool and break apart."""
    ramp = [hexc('#ffffff'), hexc('#fff3a8'), hexc('#ffd23f'), hexc('#ff9a2a'), hexc('#f0521f'),
            hexc('#b82626'), hexc('#6a5248'), hexc('#4a3a34')]
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


def dust_frames(n=6, size=12):
    """A dust puff that swells and thins out. Light and nearly neutral so the
    game can tint it (hoof dust, gunsmoke, coal smoke)."""
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
                c = hexc('#d6cdbd')
                if x + y < 10 and d > r - 1.6:
                    c = hexc('#f2ebdf')
                elif x + y > 12 and d > r - 1.6:
                    c = hexc('#ada291')
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
    """The balloon's limelight on the ground: warm, with a brighter rim."""
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
            a.set(x, y, (255, 238, 180, int(al * 255)))
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
                a.set(x, y, (34, 22, 16, al))
    return a


def lasso_loop_frames():
    """The thrown loop in flight, spinning (16x16 frames)."""
    out = []
    for k in range(4):
        a = Art(16, 16)
        ang = k * math.pi / 4
        ca, sa = math.cos(ang), math.sin(ang)
        for y in range(16):
            for x in range(16):
                px, py = x + 0.5 - 8, y + 0.5 - 8
                u = (px * ca + py * sa) / 6.4
                v = (-px * sa + py * ca) / 4.6
                r = math.sqrt(u * u + v * v)
                if 0.72 <= r <= 1.0:
                    a.set(x, y, ROPE_D if (x + y + k) % 3 == 0 else ROPE_L if u < 0 else ROPE)
        a.outline(OUTLINE)
        out.append(a)
    return out


def tumbleweed_frames():
    """A tumbleweed rolling over (16x16 frames)."""
    out = []
    rng = rng_for('tumbleweed')
    twigs = [(rng.uniform(0, math.tau), rng.uniform(0, math.tau), rng.uniform(2.5, 6.2)) for _ in range(26)]
    for k in range(4):
        a = Art(16, 16)
        a.disc(8, 8, 6.6, hexc('#7a5a34'))
        a.disc(8, 8, 5.4, (0, 0, 0, 0))
        spin = k * math.pi / 8
        for a0, a1, r in twigs:
            x0 = 8 + r * math.cos(a0 + spin)
            y0 = 8 + r * 0.92 * math.sin(a0 + spin)
            x1 = 8 + (r * 0.4) * math.cos(a1 + spin)
            y1 = 8 + (r * 0.4) * math.sin(a1 + spin)
            c = hexc('#c8a464') if math.sin(a0 + spin) < 0 else hexc('#9a7a46')
            a.line(int(x0), int(y0), int(x1), int(y1), c)
        out_ring = Art(16, 16)
        for y in range(16):
            for x in range(16):
                d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
                if d <= 6.8 and a.filled(x, y):
                    out_ring.put(x, y, a.get(x, y))
        for y in range(16):
            for x in range(16):
                d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
                if 5.6 < d <= 6.8 and (x * 3 + y + k) % 4 == 0:
                    out_ring.put(x, y, hexc('#b08a52'))
        out_ring.outline(with_alpha(OUTLINE, 200))
        out.append(out_ring)
    return out


def blob_shadow(w=14, h=6):
    a = Art(w, h)
    a.ellipse(w / 2, h / 2, w / 2, h / 2, (36, 20, 12, 80))
    return a


# --- UI -----------------------------------------------------------------------------

def panel(border, border_l, border_d, fill=(32, 21, 15, 238)):
    """9-slice panel: a plank frame with brass nail heads in the corners."""
    a = Art(16, 16)
    o = hexc('#120a07')
    for y in range(16):
        for x in range(16):
            edge = min(x, y, 15 - x, 15 - y)
            if edge == 0:
                c = o
            elif edge == 1:
                c = border_d if (x == 14 or y == 14) else border_l
            elif edge == 2:
                c = border if not (x == 2 or y == 2) else shade(border, 1.12)
            elif edge == 3:
                c = shade(border, 0.86)
            elif edge == 4:
                c = o
            else:
                c = fill
            a.put(x, y, c)
    for (x, y) in ((0, 0), (15, 0), (0, 15), (15, 15)):
        a.put(x, y, (0, 0, 0, 0))
    for (x, y) in ((2, 2), (13, 2), (2, 13), (13, 13)):
        a.put(x, y, hexc('#ffe9a8'))
    for (x, y) in ((3, 3), (12, 3), (3, 12), (12, 12)):
        a.put(x, y, hexc('#8a6420'))
    return a
