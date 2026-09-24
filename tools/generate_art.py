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
    manifest = {}

    # City
    tiles, city = art_city.build_city_tiles()
    city.update(save_tileset(tiles, 'city.png'))
    manifest['city'] = city

    # Vehicles: frames ordered LEFT, UP, RIGHT, DOWN (police/SWAT: 3 light rows)
    save_sheet(spr.direction_frames(spr.player_car()), 'car_player.png')
    save_sheet([f for s in range(3) for f in spr.direction_frames(spr.police_car(s))], 'car_police.png', cols=4)
    save_sheet([f for s in range(3) for f in spr.direction_frames(spr.swat_van(s))], 'van_swat.png', cols=4)
    save_sheet(spr.direction_frames(spr.diamond_truck()), 'truck_diamond.png')

    heli, heli_shadow = spr.heli_frames()
    save_sheet(heli, 'heli.png')
    save_sheet(heli_shadow, 'heli_shadow.png')
    save_sheet(spr.rotor_frames(), 'rotor.png')

    # Pickups + HUD icons
    frames, idx = spr.pickup_frames()
    save_sheet(frames, 'pickups.png')
    manifest['pickups'] = idx
    frames, idx = spr.icon_frames()
    save_sheet(frames, 'icons.png')
    manifest['icons'] = idx

    # Effects
    save_sheet(spr.explosion_frames(), 'explosion.png')
    save_sheet(spr.smoke_frames(), 'smoke.png')
    save_sheet(spr.spark_frames(), 'spark.png')
    save_sheet(spr.flame_frames(), 'flame.png')
    save_sheet(spr.rocket_frames(), 'rocket.png')
    save(spr.glow(), 'glow.png')
    save(spr.spotlight(), 'spotlight.png')
    save(spr.scorch(), 'scorch.png')
    save(spr.blob_shadow(), 'shadow.png')

    # Props + landmarks. Roadblock frames: vertical road (2 blink phases), horizontal road (2)
    save_sheet([spr.roadblock(True, 0), spr.roadblock(True, 1),
                spr.roadblock(False, 0), spr.roadblock(False, 1)], 'roadblock.png')
    save(spr.safehouse(), 'safehouse.png')
    save(spr.fuel_station(), 'fuelstation.png')
    save(spr.pad(hexc('#ffc933'), spr.BIG_DOLLAR), 'pad_base.png')
    save(spr.pad(hexc('#3fdf6a'), spr.BIG_DROP), 'pad_fuel.png')

    # UI
    save(spr.panel(hexc('#454b63'), hexc('#6a7190'), hexc('#2a2e3f')), 'panel.png')
    save(spr.panel(hexc('#c8932a'), hexc('#ffe07a'), hexc('#7a5214'), fill=(34, 28, 22, 242)), 'panel_gold.png')
    save(spr.panel(hexc('#9c2a2a'), hexc('#e0605a'), hexc('#5a1414'), fill=(30, 16, 22, 242)), 'panel_red.png')
    save(spr.vignette(), 'vignette.png', scale=MENU)

    # Title screen
    save(art_menu.sky(), 'menu_sky.png', scale=MENU)
    save(art_menu.far_layer(), 'menu_far.png', scale=MENU)
    save(art_menu.near_layer(), 'menu_near.png', scale=MENU)
    save(art_menu.street_layer(), 'menu_street.png', scale=MENU)
    save_sheet([art_menu.side_car('player', 0), art_menu.side_car('player', 1),
                art_menu.side_car('police', 0), art_menu.side_car('police', 1)], 'menu_cars.png', scale=MENU)
    lw, lh = save(art_menu.logo(), 'logo.png', scale=MENU)
    manifest['logo'] = {'width': lw, 'height': lh}

    # Browser tab icon: the getaway car, nose up
    spr.direction_frames(spr.player_car())[1].scaled(WORLD).save(ROOT / 'public' / 'favicon.png', optimize=True)

    MANIFEST.write_text(json.dumps(manifest, indent=1) + '\n', encoding='utf-8')
    print(f'wrote {len(list(OUT.glob("*.png")))} images to {OUT} and {MANIFEST}')


if __name__ == '__main__':
    main()
