"""Generate simple placeholder product renders for the Layerline seed catalogue.

Real product photos should replace these once vendors upload their own images.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
S = 800
BG = (244, 245, 247)

COLORS = {
    "black": (35, 35, 38), "white": (250, 250, 250), "grey": (140, 144, 150),
    "red": (210, 45, 45), "blue": (40, 95, 210), "green": (45, 160, 85),
    "yellow": (245, 205, 40), "orange": (240, 130, 30), "purple": (130, 70, 190),
    "transparent": (200, 225, 235), "clear": (205, 228, 238), "natural": (235, 225, 200),
}


def canvas():
    img = Image.new("RGB", (S, S), BG)
    return img, ImageDraw.Draw(img)


def spool(name, rgb):
    img, d = canvas()
    c = S // 2
    d.ellipse([c - 330, c - 330, c + 330, c + 330], fill=(30, 30, 34))  # flange
    d.ellipse([c - 300, c - 300, c + 300, c + 300], fill=rgb, outline=(0, 0, 0, 40), width=3)
    for r in range(120, 300, 22):  # winding lines
        shade = tuple(max(0, v - 18) for v in rgb)
        d.ellipse([c - r, c - r, c + r, c + r], outline=shade, width=2)
    d.ellipse([c - 120, c - 120, c + 120, c + 120], fill=(30, 30, 34))
    d.ellipse([c - 55, c - 55, c + 55, c + 55], fill=BG)
    img.save(OUT / f"{name}.png")


def bottle(name, rgb):
    img, d = canvas()
    d.rounded_rectangle([250, 230, 550, 700], 40, fill=(30, 30, 34))
    d.rectangle([330, 140, 470, 240], fill=(50, 50, 55))
    d.rounded_rectangle([280, 360, 520, 620], 20, fill=rgb)
    img.save(OUT / f"{name}.png")


def printer(name, rgb):
    img, d = canvas()
    d.rectangle([180, 150, 620, 640], outline=(30, 30, 34), width=28)
    d.rectangle([260, 520, 540, 560], fill=rgb)
    d.rectangle([370, 300, 430, 380], fill=(30, 30, 34))
    d.rectangle([150, 640, 650, 690], fill=(30, 30, 34))
    img.save(OUT / f"{name}.png")


def resin_printer(name, rgb):
    img, d = canvas()
    d.rectangle([230, 520, 570, 680], fill=(30, 30, 34))
    d.rounded_rectangle([250, 140, 550, 520], 16, fill=rgb)
    img.save(OUT / f"{name}.png")


def part(name, rgb):
    img, d = canvas()
    d.polygon([(400, 160), (560, 300), (500, 640), (300, 640), (240, 300)], fill=rgb)
    d.ellipse([370, 580, 430, 640], fill=(30, 30, 34))
    img.save(OUT / f"{name}.png")


def tool(name, rgb):
    img, d = canvas()
    d.rounded_rectangle([180, 260, 620, 540], 30, fill=rgb)
    d.rectangle([240, 320, 560, 480], outline=(30, 30, 34), width=10)
    img.save(OUT / f"{name}.png")


for cname, rgb in COLORS.items():
    spool(f"filament-{cname}", rgb)
    bottle(f"resin-{cname}", rgb)

printer("printer-fdm", (59, 130, 246))
resin_printer("printer-resin", (240, 130, 30))
part("part-brass", (200, 160, 60))
part("part-steel", (150, 155, 160))
tool("accessory-dryer", (230, 232, 236))
tool("accessory-plate", (40, 40, 44))
tool("accessory-tools", (59, 130, 246))
tool("accessory-misc", (180, 185, 190))
print("ok", len(list(OUT.glob("*.png"))))
