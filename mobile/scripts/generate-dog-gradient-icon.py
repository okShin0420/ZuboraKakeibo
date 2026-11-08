"""Build the iOS icon from the original dog cutout and exact brand colors."""

from pathlib import Path

from PIL import Image, ImageDraw


ASSETS = Path(__file__).resolve().parents[1] / "assets"
SIZE = 1024
TOP = (0x0D, 0x93, 0xFC)
BOTTOM = (0x01, 0x56, 0xF4)

canvas = Image.new("RGB", (SIZE, SIZE), "#9FC7D9")
circle = Image.new("L", (SIZE, SIZE))
ImageDraw.Draw(circle).ellipse((32, 32, 992, 992), fill=255)

gradient = Image.new("RGB", (SIZE, SIZE))
for y in range(SIZE):
    t = min(1, max(0, (y - 32) / 960))
    color = tuple(round(a * (1 - t) + b * t) for a, b in zip(TOP, BOTTOM))
    ImageDraw.Draw(gradient).line((0, y, SIZE, y), fill=color)
canvas.paste(gradient, (0, 0), circle)

dog = Image.open(ASSETS / "jikkun.png").convert("RGBA")
# Keep the head prominent; the circle naturally masks the paws at the bottom.
dog = dog.resize((960, round(dog.height * 960 / dog.width)), Image.Resampling.LANCZOS)
dog_layer = Image.new("RGBA", (SIZE, SIZE))
dog_layer.alpha_composite(dog, ((SIZE - dog.width) // 2, 100))
dog_alpha = Image.composite(dog_layer.getchannel("A"), Image.new("L", (SIZE, SIZE)), circle)
canvas.paste(dog_layer.convert("RGB"), (0, 0), dog_alpha)

canvas.save(ASSETS / "app-icon-dog-gradient.png", format="PNG")
