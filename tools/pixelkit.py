"""Tiny pixel-art toolkit used by generate_art.py.

Everything is authored at "art resolution" (1 art pixel = 1 image pixel) and
only scaled up with nearest-neighbour at export time, so every asset in the
game shares the same pixel grid.
"""
import random

import numpy as np
from PIL import Image


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def with_alpha(c, a):
    return (c[0], c[1], c[2], a)


def mix(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(4))


def shade(c, f):
    """Multiply RGB by f (f < 1 darkens, > 1 lightens), keep alpha."""
    return (min(255, int(c[0] * f)), min(255, int(c[1] * f)), min(255, int(c[2] * f)), c[3])


# 4x4 ordered-dither matrix, normalised to 0..1
BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def bayer(x, y):
    return (BAYER4[y % 4][x % 4] + 0.5) / 16.0


class Art:
    def __init__(self, w, h, fill=None):
        self.w = w
        self.h = h
        self.im = Image.new('RGBA', (w, h), fill or (0, 0, 0, 0))
        self.px = self.im.load()

    @classmethod
    def from_image(cls, im):
        a = cls(im.width, im.height)
        a.im = im.convert('RGBA').copy()
        a.px = a.im.load()
        return a

    def copy(self):
        return Art.from_image(self.im)

    def inside(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def get(self, x, y):
        if not self.inside(x, y):
            return (0, 0, 0, 0)
        return self.px[x, y]

    def filled(self, x, y):
        return self.get(x, y)[3] > 0

    def set(self, x, y, c):
        if c is None or not self.inside(x, y):
            return
        if c[3] >= 255:
            self.px[x, y] = c
            return
        if c[3] == 0:
            return
        # Source-over blend
        d = self.px[x, y]
        sa = c[3] / 255.0
        da = d[3] / 255.0
        oa = sa + da * (1 - sa)
        if oa <= 0:
            return
        rgb = [int(round((c[i] * sa + d[i] * da * (1 - sa)) / oa)) for i in range(3)]
        self.px[x, y] = (rgb[0], rgb[1], rgb[2], int(round(oa * 255)))

    def put(self, x, y, c):
        """Overwrite (no blending), including with transparency."""
        if self.inside(x, y):
            self.px[x, y] = c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def hline(self, x0, x1, y, c):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            self.set(x, y, c)

    def vline(self, x, y0, y1, c):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            self.set(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.set(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def disc(self, cx, cy, r, c):
        """Filled circle; (cx, cy) may be fractional (x.5 = pixel-centred)."""
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                    self.set(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    self.set(x, y, c)

    def grid(self, x, y, rows, legend):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in legend and legend[ch] is not None:
                    self.set(x + i, y + j, legend[ch])

    def blit(self, src, x, y):
        im = src.im if isinstance(src, Art) else src
        layer = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        layer.paste(im, (x, y))
        self.im.alpha_composite(layer)
        self.px = self.im.load()

    def mask(self):
        return [[self.filled(x, y) for x in range(self.w)] for y in range(self.h)]

    def outline(self, c, diagonal=False):
        """1px outline around every opaque pixel (on transparent neighbours)."""
        m = self.mask()
        n4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        n8 = n4 + [(-1, -1), (1, -1), (-1, 1), (1, 1)]
        for y in range(self.h):
            for x in range(self.w):
                if m[y][x]:
                    continue
                for dx, dy in (n8 if diagonal else n4):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < self.w and 0 <= yy < self.h and m[yy][xx]:
                        self.put(x, y, c)
                        break
        return self

    def bevel(self, base, light, dark, only=None):
        """Recolour a solid shape: top-left edges light, bottom-right dark.

        `only` restricts recolouring to pixels currently of that colour.
        """
        m = self.mask()

        def f(x, y):
            return 0 <= x < self.w and 0 <= y < self.h and m[y][x]

        out = {}
        for y in range(self.h):
            for x in range(self.w):
                if not m[y][x]:
                    continue
                if only is not None and self.px[x, y] != only:
                    continue
                if not f(x - 1, y) or not f(x, y - 1):
                    out[(x, y)] = light
                elif not f(x + 1, y) or not f(x, y + 1):
                    out[(x, y)] = dark
                else:
                    out[(x, y)] = base
        for (x, y), c in out.items():
            self.put(x, y, c)
        return self

    def drop_shadow(self, dx, dy, c):
        """Composite a flat-colour copy of the silhouette behind the art."""
        sh = Art(self.w, self.h)
        for y in range(self.h):
            for x in range(self.w):
                if self.filled(x, y):
                    sh.put(x + dx, y + dy, c) if sh.inside(x + dx, y + dy) else None
        sh.im.alpha_composite(self.im)
        self.im = sh.im
        self.px = self.im.load()
        return self

    def recolor(self, mapping):
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[x, y]
                if c in mapping:
                    self.px[x, y] = mapping[c]
        return self

    def rotated(self, quarter_turns_ccw):
        ops = {0: None, 1: Image.Transpose.ROTATE_90, 2: Image.Transpose.ROTATE_180,
               3: Image.Transpose.ROTATE_270}
        op = ops[quarter_turns_ccw % 4]
        return Art.from_image(self.im if op is None else self.im.transpose(op))

    def flipped_x(self):
        return Art.from_image(self.im.transpose(Image.Transpose.FLIP_LEFT_RIGHT))

    def scaled(self, s):
        return self.im.resize((self.w * s, self.h * s), Image.Resampling.NEAREST)


def _pack(im):
    a = np.array(im.convert('RGBA'), dtype=np.uint32)
    return (a[..., 0] << 24) | (a[..., 1] << 16) | (a[..., 2] << 8) | a[..., 3]


def _unpack(p):
    out = np.zeros(p.shape + (4,), dtype=np.uint8)
    out[..., 0] = (p >> 24) & 255
    out[..., 1] = (p >> 16) & 255
    out[..., 2] = (p >> 8) & 255
    out[..., 3] = p & 255
    return Image.fromarray(out, 'RGBA')


def scale2x(im):
    """EPX / Scale2x — edge-aware 2x upscale used by rotsprite."""
    p = _pack(im)
    P = np.pad(p, 1, mode='edge')
    A = P[:-2, 1:-1]  # up
    B = P[1:-1, 2:]   # right
    C = P[1:-1, :-2]  # left
    D = P[2:, 1:-1]   # down
    E = p
    e0 = np.where((C == A) & (C != D) & (A != B), A, E)
    e1 = np.where((A == B) & (A != C) & (B != D), B, E)
    e2 = np.where((D == C) & (D != B) & (C != A), C, E)
    e3 = np.where((B == D) & (B != A) & (D != C), D, E)
    h, w = p.shape
    out = np.zeros((h * 2, w * 2), dtype=np.uint32)
    out[0::2, 0::2] = e0
    out[0::2, 1::2] = e1
    out[1::2, 0::2] = e2
    out[1::2, 1::2] = e3
    return _unpack(out)


def rotsprite(art, degrees_ccw):
    """Rotate pixel art by an arbitrary angle without mangling it (RotSprite)."""
    im = art.im
    big = scale2x(scale2x(scale2x(im)))
    rot = big.rotate(degrees_ccw, resample=Image.Resampling.NEAREST, expand=False)
    small = rot.resize((art.w, art.h), Image.Resampling.NEAREST)
    return Art.from_image(small)


def noise_fill(art, x, y, w, h, choices, rng):
    """Fill a rect choosing each pixel from [(colour, weight), ...]."""
    total = sum(wt for _, wt in choices)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            r = rng.random() * total
            for c, wt in choices:
                r -= wt
                if r <= 0:
                    art.set(xx, yy, c)
                    break


def sheet(frames, cols=None):
    """Lay equally sized Art frames out row-major into one Art."""
    fw, fh = frames[0].w, frames[0].h
    cols = cols or len(frames)
    rows = (len(frames) + cols - 1) // cols
    out = Art(fw * cols, fh * rows)
    for i, f in enumerate(frames):
        out.blit(f, (i % cols) * fw, (i // cols) * fh)
    return out


def rng_for(*parts):
    return random.Random('/'.join(str(p) for p in parts))
