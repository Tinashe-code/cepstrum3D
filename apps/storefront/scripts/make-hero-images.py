"""Placeholder hero slide images for the home carousel (replace with real photos/banners).

Usage: python3 scripts/make-hero-images.py public/images/hero
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
W, H = 1400, 1050
INK = (17, 17, 19)


def spool(d, cx, cy, r, rgb):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK)
    ri = int(r * 0.9)
    d.ellipse([cx - ri, cy - ri, cx + ri, cy + ri], fill=rgb)
    shade = tuple(max(0, c - 22) for c in rgb)
    for k in range(int(r * 0.38), ri, max(6, r // 14)):
        d.ellipse([cx - k, cy - k, cx + k, cy + k], outline=shade, width=2)
    hub = int(r * 0.36)
    d.ellipse([cx - hub, cy - hub, cx + hub, cy + hub], fill=INK)
    h = int(r * 0.15)
    d.ellipse([cx - h, cy - h, cx + h, cy + h], fill=(245, 245, 245))


# 1. Sale: fan of colourful spools on a warm background
img = Image.new("RGB", (W, H), (255, 237, 213)); d = ImageDraw.Draw(img)
for i, (x, y, r, c) in enumerate([
    (330, 380, 230, (220, 38, 38)), (700, 300, 250, (37, 99, 235)),
    (1060, 400, 230, (22, 163, 74)), (500, 720, 240, (250, 204, 21)),
    (900, 740, 240, (147, 51, 234)),
]):
    spool(d, x, y, r, c)
img.save(OUT / "hero-sale.jpg", quality=88)

# 2. Pay on delivery: parcel box with a spool peeking out
img = Image.new("RGB", (W, H), (236, 253, 245)); d = ImageDraw.Draw(img)
d.rectangle([0, H - 170, W, H], fill=(209, 250, 229))
spool(d, 700, 360, 250, (249, 115, 22))
d.polygon([(300, 520), (1100, 520), (1040, 900), (360, 900)], fill=(194, 140, 82))
d.polygon([(300, 520), (700, 600), (1100, 520), (700, 460)], fill=(214, 164, 108))
d.rectangle([660, 560, 740, 900], fill=(232, 205, 160))
img.save(OUT / "hero-pod.jpg", quality=88)

# 3. Printer spotlight on dark background
img = Image.new("RGB", (W, H), INK); d = ImageDraw.Draw(img)
d.ellipse([250, 760, 1150, 940], fill=(38, 38, 42))
d.rectangle([360, 180, 1040, 860], outline=(240, 240, 240), width=34)
d.rectangle([460, 690, 940, 740], fill=(249, 115, 22))
d.rectangle([640, 330, 760, 450], fill=(240, 240, 240))
d.polygon([(670, 450), (730, 450), (700, 500)], fill=(240, 240, 240))
for i, c in enumerate([(249, 115, 22), (255, 160, 90), (255, 200, 150)]):
    d.rounded_rectangle([560 + i * 10, 640 - i * 26, 840 - i * 10, 662 - i * 26], 8, fill=c)
img.save(OUT / "hero-printer.jpg", quality=88)
print("ok")
