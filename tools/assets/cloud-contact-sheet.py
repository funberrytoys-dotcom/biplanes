"""Compose a labeled contact sheet of every cloud sprite so the owner can pick which
ones to use for the «вечная ночь» cloud floor. White transparent PNGs are shown on a
sky-blue tile with their short pick-name underneath."""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = r"C:\Users\serge\Documents\Playground\Biplanes\apps\web\public\assets\biplanes"
OUT = r"C:\Users\serge\Documents\Playground\Biplanes\tools\assets\_cloud_contact_sheet.png"

# (pick-label, relative path) — grouped: thick/cumulus first (best for a dense floor), then
# the volumetric highres set, then wispy cirrus.
items = []
for n in ['bank_01', 'cumulus_01', 'cumulus_02', 'cumulus_03', 'cumulus_04', 'cumulus_05']:
    items.append((f"thick:{n}", f"arena/day/clouds/cloud_{n}.png"))
for i in range(1, 29):
    items.append((f"hi_{i:02d}", f"clouds/cloud_highres_transparent_{i:02d}.png"))
for i in range(1, 8):
    items.append((f"cirrus_{i:02d}", f"arena/day/cirrus/cloud_cirrus_{i:02d}.png"))

COLS = 6
TILE = 340
PAD = 12
LABEL_H = 34
rows = (len(items) + COLS - 1) // COLS
W = COLS * TILE
H = rows * (TILE + LABEL_H)

sheet = Image.new("RGB", (W, H), (74, 104, 150))  # sky blue so white clouds read
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("arialbd.ttf", 22)
except Exception:
    font = ImageFont.load_default()

for idx, (label, rel) in enumerate(items):
    r, c = divmod(idx, COLS)
    x0 = c * TILE
    y0 = r * (TILE + LABEL_H)
    # alternating tile shade for separation
    shade = (66, 95, 138) if (r + c) % 2 == 0 else (82, 112, 160)
    draw.rectangle([x0, y0, x0 + TILE, y0 + TILE], fill=shade)
    p = os.path.join(BASE, rel.replace('/', os.sep))
    if os.path.exists(p):
        im = Image.open(p).convert("RGBA")
        scale = min((TILE - 2 * PAD) / im.width, (TILE - 2 * PAD) / im.height)
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
        sheet.paste(im, (x0 + (TILE - im.width) // 2, y0 + (TILE - im.height) // 2), im)
    else:
        draw.text((x0 + 10, y0 + 10), "missing", fill=(255, 120, 120), font=font)
    # label bar
    draw.rectangle([x0, y0 + TILE, x0 + TILE, y0 + TILE + LABEL_H], fill=(18, 26, 40))
    draw.text((x0 + 10, y0 + TILE + 5), label, fill=(255, 224, 120), font=font)

sheet.save(OUT)
print(f"wrote {OUT} ({W}x{H}, {len(items)} clouds)")
