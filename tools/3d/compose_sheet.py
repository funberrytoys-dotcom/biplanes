import json, os, sys
from PIL import Image, ImageEnhance

BASE = r"C:\Users\serge\AppData\Local\Temp\claude\C--Users-serge-Documents-Playground-Biplanes\882b20d1-942a-41ff-b96c-218c1c8afa45\scratchpad\3d"
DEST = r"C:\Users\serge\Documents\Playground\Biplanes\apps\web\public\assets\biplanes"
COLS = 5
NAMES = {"sov": "plane_player_sov_3d_sheet.png", "jkl": "plane_enemy_crimson_3d_sheet.png"}

report = {}
for tag in ("sov", "jkl"):
    src = os.path.join(BASE, "bake_%s" % tag)
    files = sorted(f for f in os.listdir(src) if f.startswith("f_") and f.endswith(".png"))
    if not files:
        report[tag] = "NO FRAMES"; continue
    first = Image.open(os.path.join(src, files[0])).convert("RGBA")
    FW, FH = first.size
    N = len(files)
    rows = (N + COLS - 1) // COLS
    atlas = Image.new("RGBA", (FW * COLS, FH * rows), (0, 0, 0, 0))
    bbs = []
    for i, fn in enumerate(files):
        im = Image.open(os.path.join(src, fn)).convert("RGBA")
        atlas.paste(im, ((i % COLS) * FW, (i // COLS) * FH))
        bb = im.getbbox()
        if bb: bbs.append(bb)
    # The painted sheets are punchier than a physically-lit render; nudge the
    # colour back up so the two sit together on screen.
    rgb, alpha = atlas.convert("RGB"), atlas.getchannel("A")
    rgb = ImageEnhance.Color(rgb).enhance(1.12)
    rgb = ImageEnhance.Brightness(rgb).enhance(1.0)
    atlas = Image.merge("RGBA", (*rgb.split(), alpha))

    out = os.path.join(DEST, NAMES[tag])
    # A full-colour RGBA atlas of 50 render frames lands around 5.5 MB, which is
    # heavier than the painted sheet it replaces. Octree-quantising to a palette
    # keeps the flat comic shading intact and cuts it by roughly 4x.
    small = atlas.quantize(colors=200, method=Image.FASTOCTREE, dither=Image.Dither.NONE)
    small.save(out, optimize=True)

    trk = json.load(open(os.path.join(src, "track.json")))
    t = trk["track"]
    ck = [round(t[0][0]), round(t[0][1])]
    bob = [[round(p[0] - t[0][0], 1), round(p[1] - t[0][1], 1)] for p in t]

    report[tag] = {
        "file": NAMES[tag],
        "sheet": list(atlas.size),
        "frame": [FW, FH], "frames": N, "columns": COLS,
        "content_bbox": [min(b[0] for b in bbs), min(b[1] for b in bbs),
                         max(b[2] for b in bbs), max(b[3] for b in bbs)],
        "cockpit_xy": ck,
        "bob": bob,
        "kb": round(os.path.getsize(out) / 1024),
    }
print(json.dumps(report, ensure_ascii=False))
with open(os.path.join(BASE, "sheet_report.json"), "w", encoding="utf-8") as fh:
    json.dump(report, fh, ensure_ascii=False)
