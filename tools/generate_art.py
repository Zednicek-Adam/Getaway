#!/usr/bin/env python3
"""Regenerates every pixel-art asset the game loads.

    python tools/generate_art.py

Writes PNGs to public/art/ and the frame/tile manifest the code imports to
src/generated/art.json. Output is deterministic (all randomness is seeded), so
re-running without changes produces identical files.

Art is authored at 1 art pixel = 1 image pixel and exported at 2x for the
world (so a 32px art tile becomes the game's 64px TILE_SIZE) and 4x for the
title-screen backdrop. Requires Pillow and numpy.
"""
import json
from pathlib import Path

from PIL import Image

import art_city
import art_menu
import art_rail
import art_sprites as spr
from pixelkit import Art, hexc, sheet

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'art'
MANIFEST = ROOT / 'src' / 'generated' / 'art.json'

WORLD = 2  # world art scale
MENU = 4   # title-screen art scale


def save(art, name, scale=WORLD):
    im = art.im if isinstance(art, Art) else art
    im = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
    im.save(OUT / name, optimize=True)
    return im.size


def save_sheet(frames, name, cols=None, scale=WORLD):
    return save(sheet(frames, cols), name, scale)


def save_tileset(tiles, name, cols=16):
    """Tiles at 2x with a 1px margin and 2px spacing, edges extruded so the
    tilemap never samples a neighbouring tile at fractional camera offsets."""
    size = art_city.T * WORLD
    rows = (len(tiles) + cols - 1) // cols
    step = size + 2
    # margin + tiles + spacing + margin == cols * step, as Phaser's tileset math expects
    out = Image.new('RGBA', (cols * step, rows * step), (0, 0, 0, 0))
    for i, t in enumerate(tiles):
        im = t.im.resize((size, size), Image.Resampling.NEAREST)
        x = 1 + (i % cols) * step
        y = 1 + (i // cols) * step
        # extrusion: paste the tile shifted by one pixel in each direction first
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)):
            out.paste(im, (x + dx, y + dy))
        out.paste(im, (x, y))
    out.save(OUT / name, optimize=True)
    return {'tileSize': size, 'margin': 1, 'spacing': 2}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    # Start clean so a renamed or dropped asset never lingers
    for old in OUT.glob('*.png'):
        old.unlink()
    manifest = {}

    # Town
    tiles, city = art_city.build_city_tiles()
    city.update(save_tileset(tiles, 'city.png'))
    manifest['city'] = city

    # Railroad: track tiles keyed by the loop's local move signature, plus the
    # planks-over-street overlay for crossings (src/railway.js, MapManager.render)
    sigs = art_rail.all_signatures()
    rail_tiles = [art_rail.track_tile(sig) for sig in sigs]
    rail = {'tiles': {sig: i for i, sig in enumerate(sigs)}}
    rail['crossing'] = {'H': len(rail_tiles), 'V': len(rail_tiles) + 1}
    rail_tiles += [art_rail.crossing_tile('H'), art_rail.crossing_tile('V')]
    rail.update(save_tileset(rail_tiles, 'rail.png', cols=8))
    manifest['rail'] = rail

    # Mounts: rows of LEFT, UP, RIGHT, DOWN, one row per gait phase. The
    # outlaw's sheet goes on with the handcar for riding the rails: two pump
    # phases of eight headings each, clockwise from facing up.
    handcar = [f for phase in range(2) for f in art_rail.eight_ways(spr.handcar(phase))]
    save_sheet(spr.gait_rows(spr.outlaw) + handcar, 'rider_outlaw.png', cols=4)
    save_sheet(spr.gait_rows(spr.deputy), 'rider_deputy.png', cols=4)
    save_sheet(spr.gait_rows(spr.marshal_wagon), 'wagon_marshal.png', cols=4)
    save_sheet(spr.gait_rows(spr.stagecoach), 'stagecoach.png', cols=4)
    manifest['mounts'] = {'gaitPhases': spr.GAIT_PHASES, 'handcar': spr.GAIT_PHASES * 4}

    # The army balloon: pennant streaming left, hanging limp, streaming right
    save_sheet([spr.balloon(-1), spr.balloon(0), spr.balloon(1)], 'balloon.png')
    save(spr.balloon_shadow(), 'balloon_shadow.png')

    # Pickups + HUD icons
    frames, idx = spr.pickup_frames()
    save_sheet(frames, 'pickups.png')
    manifest['pickups'] = idx
    frames, idx = spr.icon_frames()
    save_sheet(frames, 'icons.png')
    manifest['icons'] = idx

    # Effects
    save_sheet(spr.explosion_frames(), 'explosion.png')
    save_sheet(spr.dust_frames(), 'dust.png')
    save_sheet(spr.spark_frames(), 'spark.png')
    save_sheet(spr.lasso_loop_frames(), 'lasso.png')
    save_sheet(spr.tumbleweed_frames(), 'tumbleweed.png')
    save(spr.glow(), 'glow.png')
    save(spr.spotlight(), 'spotlight.png')
    save(spr.scorch(), 'scorch.png')
    save(spr.blob_shadow(), 'shadow.png')

    # Props + landmarks. Barricade frames: vertical street (2 lantern phases), horizontal street (2)
    save_sheet([spr.barricade(True, 0), spr.barricade(True, 1),
                spr.barricade(False, 0), spr.barricade(False, 1)], 'barricade.png')
    save(spr.hideout(), 'hideout.png')
    save(spr.water_stop(), 'water_stop.png')
    save(spr.pad(hexc('#ffc933'), spr.BIG_DOLLAR), 'pad_hideout.png')
    save(spr.pad(hexc('#4fb0f0'), spr.BIG_DROP), 'pad_water.png')

    # Railroad: train cars (8 headings each), crossing gates, the depot
    save_sheet(art_rail.train_frames(), 'train.png', cols=8)
    manifest['train'] = {'cars': list(art_rail.TRAIN_CARS), 'frameSize': art_rail.FRAME * WORLD}
    save_sheet(art_rail.crossing_frames(), 'crossing.png')
    save(art_rail.station(), 'depot.png')
    save(art_rail.station_pad(), 'pad_depot.png')

    # UI: plank panels with brass nails
    save(spr.panel(hexc('#8a5a34'), hexc('#b8824c'), hexc('#5a361e')), 'panel.png')
    save(spr.panel(hexc('#c8932a'), hexc('#ffe07a'), hexc('#7a5214'), fill=(40, 26, 16, 242)), 'panel_gold.png')
    save(spr.panel(hexc('#9c2a22'), hexc('#d85a48'), hexc('#5a1410'), fill=(36, 14, 12, 242)), 'panel_red.png')

    # Title screen
    save(art_menu.sky(), 'menu_sky.png', scale=MENU)
    save(art_menu.far_layer(), 'menu_far.png', scale=MENU)
    save(art_menu.near_layer(), 'menu_near.png', scale=MENU)
    save(art_menu.street_layer(), 'menu_street.png', scale=MENU)
    riders = [art_menu.side_rider(kind, phase) for kind in ('outlaw', 'deputy')
              for phase in range(len(art_menu.GALLOP))]
    save_sheet(riders, 'menu_riders.png', cols=len(art_menu.GALLOP), scale=MENU)
    manifest['menuRiders'] = {'frames': len(art_menu.GALLOP), 'width': riders[0].w * MENU,
                              'height': riders[0].h * MENU}
    lw, lh = save(art_menu.logo(), 'logo.png', scale=MENU)
    manifest['logo'] = {'width': lw, 'height': lh}

    # Browser tab icon: the outlaw's hat
    spr.cowboy_hat().scaled(WORLD).save(ROOT / 'public' / 'favicon.png', optimize=True)

    MANIFEST.write_text(json.dumps(manifest, indent=1) + '\n', encoding='utf-8')
    print(f'wrote {len(list(OUT.glob("*.png")))} images to {OUT} and {MANIFEST}')


if __name__ == '__main__':
    main()
