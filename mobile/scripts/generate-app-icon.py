"""Render the app icon from the approved 512 px layout and dog cutout.

Run from the repository root: python mobile/scripts/generate-app-icon.py
"""

from pathlib import Path
import math

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


ASSETS = Path(__file__).resolve().parents[1] / "assets"
SIZE = 512
SCALE = 2
BLUE = (1, 122, 244)


def gradient_card(width, height, radius, angle, stops):
    """Build a rounded CSS-style linear gradient before element rotation."""
    w, h = round(width * SCALE), round(height * SCALE)
    yy, xx = np.mgrid[0:h, 0:w]
    theta = math.radians(angle)
    dx, dy = math.sin(theta), -math.cos(theta)
    line = abs(dx) * w + abs(dy) * h
    t = ((xx - (w - 1) / 2) * dx + (yy - (h - 1) / 2) * dy) / line + 0.5
    positions = [stop[0] for stop in stops]
    channels = [np.interp(t, positions, [stop[1][i] for stop in stops]) for i in range(4)]
    pixels = np.clip(np.stack(channels, axis=-1), 0, 255).astype(np.uint8)
    card = Image.fromarray(pixels, "RGBA")
    mask = Image.new("L", (w, h))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=round(radius * SCALE), fill=255)
    card.putalpha(ImageChops.multiply(card.getchannel("A"), mask))
    return card


def paste_rotated(base, layer, left, top, rotation):
    center_x = (left + layer.width / SCALE / 2) * SCALE
    center_y = (top + layer.height / SCALE / 2) * SCALE
    rotated = layer.rotate(-rotation, resample=Image.Resampling.BICUBIC, expand=True)
    base.alpha_composite(rotated, (round(center_x - rotated.width / 2), round(center_y - rotated.height / 2)))


def draw_art():
    art = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE))

    cyan = gradient_card(315.19, 184, 9, 267.27, [
        (0.0, (95, 212, 255, 255)),
        (0.3084, (95, 212, 255, 255)),
        (0.5396, (167, 232, 255, 140)),
        (0.73, (255, 255, 255, 0)),
        (1.0, (255, 255, 255, 0)),
    ])
    paste_rotated(art, cyan, 77.89, 168, -17)

    gold = gradient_card(362, 184, 9, 238.98, [
        (0.0, (249, 180, 61, 176)),
        (0.1654, (249, 180, 61, 176)),
        (0.6975, (158, 205, 252, 87)),
        (0.7901, (255, 255, 255, 0)),
        (1.0, (255, 255, 255, 0)),
    ])
    paste_rotated(art, gold, 86, 181.3, -12)
    # The source design repeats this card layer, making the gold edge more vivid.
    paste_rotated(art, gold, 86, 181.3, -12)

    front = gradient_card(432, 214, 29, 250.28, [
        (0.0, (96, 219, 244, 204)),
        (0.1922, (96, 219, 244, 204)),
        (0.8685, (1, 122, 244, 255)),
        (1.0, (1, 122, 244, 255)),
    ])
    art.alpha_composite(front, (46 * SCALE, round(196.3 * SCALE)))

    # Rounded strokes preserve the supplied yen mark at launcher-icon sizes.
    symbol_layer = Image.new("RGBA", art.size)
    symbol_mask = Image.new("L", art.size)
    draw = ImageDraw.Draw(symbol_mask)
    strokes = [
        ((238, 251), (272, 305)),
        ((306, 251), (272, 305)),
        ((236, 307), (308, 307)),
        ((236, 330), (308, 330)),
        ((272, 307), (272, 351)),
    ]
    radius = 7.5 * SCALE
    for start, end in strokes:
        points = [tuple(round(v * SCALE) for v in point) for point in (start, end)]
        draw.line(points, fill=74, width=round(15 * SCALE))
        for x, y in points:
            draw.ellipse((round(x - radius), round(y - radius), round(x + radius), round(y + radius)), fill=74)
    symbol_layer.paste((255, 255, 255, 0), (0, 0, *art.size))
    symbol_layer.putalpha(symbol_mask)
    art.alpha_composite(symbol_layer)

    dog = Image.open(ASSETS / "onboarding" / "peeking-dog-photoreal.png").convert("RGBA")
    dog = dog.resize((445 * SCALE, 233 * SCALE), Image.Resampling.LANCZOS)
    art.alpha_composite(dog, (33 * SCALE, 293 * SCALE))
    return art


def save_assets():
    art = draw_art()
    production = Image.new("RGBA", art.size, BLUE + (255,))
    production.alpha_composite(art)
    production.convert("RGB").save(ASSETS / "icon.png", optimize=True)

    # The preview shows the art as a 512 px rounded tile with a soft shadow.
    margin = 20
    preview_size = SIZE * SCALE + 2 * margin
    preview = Image.new("RGBA", (preview_size, preview_size))
    shadow = Image.new("RGBA", preview.size)
    shadow_box = (margin, margin + 4, preview_size - margin, preview_size - margin + 4)
    ImageDraw.Draw(shadow).rounded_rectangle(shadow_box, radius=68 * SCALE, fill=(0, 0, 0, 60))
    preview.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(9)))
    tile_mask = Image.new("L", production.size)
    ImageDraw.Draw(tile_mask).rounded_rectangle((0, 0, SIZE * SCALE - 1, SIZE * SCALE - 1), radius=68 * SCALE, fill=255)
    tile = production.copy()
    tile.putalpha(tile_mask)
    preview.alpha_composite(tile, (margin, margin))
    preview.save(ASSETS / "icon-preview.png", optimize=True)

    # Android supplies the same graphic over its solid blue adaptive-icon background.
    foreground = art.resize((512, 512), Image.Resampling.LANCZOS)
    foreground.save(ASSETS / "android-icon-foreground.png", optimize=True)
    alpha = foreground.getchannel("A").resize((432, 432), Image.Resampling.LANCZOS)
    monochrome = Image.new("RGBA", (432, 432), (255, 255, 255, 0))
    monochrome.putalpha(alpha)
    monochrome.save(ASSETS / "android-icon-monochrome.png", optimize=True)


if __name__ == "__main__":
    save_assets()
