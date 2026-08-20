import json, os, sys
from PIL import Image, ImageEnhance

BASE = os.environ.get("BIPLANES_3D_BASE", r"C:\Users\serge\Documents\Playground\Biplanes\.3dwork")
DEST = r"C:\Users\serge\Documents\Playground\Biplanes\apps\web\public\assets\biplanes"
COLS = 5
NAMES = {"sov": "plane_player_sov_3d_sheet.png",
         "jkl": "plane_enemy_crimson_3d_sheet.png",
         "jkl2": "plane_enemy_crimson_3d_b_sheet.png"}
# The propeller rides on its own sheet so the game can spin it with the throttle.
# Its frames come off the SAME camera as the airframe, so they are kept at full
# frame size and simply drawn on top — no offsets to get wrong.
PROP_NAMES = {"sov": "prop_player_sov_3d_sheet.png",
              "jkl": "prop_enemy_crimson_3d_sheet.png",
              "jkl2": "prop_enemy_crimson_3d_b_sheet.png"}

report = {}
for tag in ("sov", "jkl", "jkl2"):
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

    # ---- the propeller sheet
    psrc = os.path.join(BASE, "bake_%s_prop" % tag)
    prop_report = None
    if os.path.isdir(psrc):
        pfiles = sorted(f for f in os.listdir(psrc) if f.startswith("p_") and f.endswith(".png"))
        if pfiles:
            pims = [Image.open(os.path.join(psrc, fn)).convert("RGBA") for fn in pfiles]
            FRW, FRH = pims[0].size
            # A propeller fills a sliver of the frame and the rest is empty; a
            # full-frame sheet was 300 KB of transparency. Crop every frame to
            # the union of their content and hand the renderer the origin.
            boxes = [im.getbbox() for im in pims if im.getbbox()]
            ox, oy = min(b[0] for b in boxes), min(b[1] for b in boxes)
            PW = max(b[2] for b in boxes) - ox
            PH = max(b[3] for b in boxes) - oy
            PN = len(pims)
            PCOLS = 4
            prows = (PN + PCOLS - 1) // PCOLS
            patlas = Image.new("RGBA", (PW * PCOLS, PH * prows), (0, 0, 0, 0))
            for i, im in enumerate(pims):
                patlas.paste(im.crop((ox, oy, ox + PW, oy + PH)),
                             ((i % PCOLS) * PW, (i // PCOLS) * PH))
            pout = os.path.join(DEST, PROP_NAMES[tag])
            # Blades over a translucent sweep: quantising would band the fade,
            # so this one stays in full colour.
            patlas.save(pout, optimize=True)
            prop_report = {"file": PROP_NAMES[tag], "sheet": list(patlas.size),
                           "frame": [PW, PH], "origin": [ox, oy], "frames": PN,
                           "columns": PCOLS, "kb": round(os.path.getsize(pout) / 1024)}

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
        "blocks": trk.get("blocks"),
        "prop": prop_report,
        "prop_split": trk.get("prop"),
        "kb": round(os.path.getsize(out) / 1024),
    }
print(json.dumps(report, ensure_ascii=False))
with open(os.path.join(BASE, "sheet_report.json"), "w", encoding="utf-8") as fh:
    json.dump(report, fh, ensure_ascii=False)
