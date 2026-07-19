from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(r"C:/Users/serge/Documents/Playground/Biplanes")
ASSETS = ROOT / "WOLF COMET ASSETS"
COMFY = Path(r"C:/Comnfy/v14/ComfyUI/comfyui/ComfyUI/output/upscaler")
OUT = ASSETS / "wolf-comet-dirigible-composite.png"
CACHE = ROOT / "tmp" / "wolf-comet-cutouts"


def is_bg(rgb):
    r, g, b = rgb
    return r > 232 and g > 232 and b > 232 and max(rgb) - min(rgb) < 18


def cutout(path):
    CACHE.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE / f"{path.stem}.png"
    if cache_path.exists():
        return Image.open(cache_path).convert("RGBA")

    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()

    def push(x, y):
        i = y * w + x
        if seen[i]:
            return
        if is_bg(px[x, y][:3]):
            seen[i] = 1
            q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                push(nx, ny)

    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    for y in range(h):
        row = y * w
        for x in range(w):
            if seen[row + x]:
                ap[x, y] = 0

    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.35))
    im.putalpha(alpha)
    bbox = im.getbbox()
    im = im.crop(bbox) if bbox else im
    im.save(cache_path)
    return im


def fit_width(im, width):
    height = round(im.height * width / im.width)
    return im.resize((width, height), Image.Resampling.LANCZOS)


def fit_height(im, height):
    width = round(im.width * height / im.height)
    return im.resize((width, height), Image.Resampling.LANCZOS)


def paste(canvas, im, xy):
    canvas.alpha_composite(im, xy)


def draw_rope(draw, p1, p2, width=3):
    x1, y1 = p1
    x2, y2 = p2
    draw.line((x1, y1, x2, y2), fill=(21, 17, 13, 230), width=width + 2)
    draw.line((x1, y1, x2, y2), fill=(128, 85, 43, 225), width=width)
    draw.line((x1, y1, x2, y2), fill=(238, 176, 82, 120), width=1)


def add_shadow(canvas, bbox, blur=16):
    x, y, w, h = bbox
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((x, y, x + w, y + h), fill=(0, 0, 0, 65))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(layer)


def main():
    canvas = Image.new("RGBA", (2600, 1240), (0, 0, 0, 0))

    balloon = fit_width(cutout(ASSETS / "upscaler_00059_.png"), 2240)
    balloon = balloon.resize((balloon.width, 515), Image.Resampling.LANCZOS)
    gondola = fit_width(cutout(ASSETS / "upscaler_00060_.png"), 2220)
    gondola = gondola.resize((gondola.width, 405), Image.Resampling.LANCZOS)
    bridge = fit_width(cutout(ASSETS / "upscaler_00061_.png"), 460)
    plane = fit_width(cutout(COMFY / "upscaler_00032_.png"), 155)
    prop = fit_height(cutout(ASSETS / "upscaler_00068_.png"), 245).rotate(90, expand=True)
    banner = fit_height(cutout(ASSETS / "upscaler_00065_.png"), 185)
    flag = fit_width(cutout(ASSETS / "upscaler_00067_.png"), 165)

    add_shadow(canvas, (280, 1110, 2030, 95), blur=26)

    paste(canvas, balloon, (185, 38))

    cables = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(cables)
    top_points = [
        (345, 420), (485, 480), (635, 520), (825, 538), (1015, 548),
        (1215, 552), (1410, 552), (1610, 548), (1810, 535), (2000, 510),
        (2180, 475), (2300, 430),
    ]
    deck_points = [
        (310, 640), (470, 654), (655, 656), (850, 654), (1045, 648),
        (1240, 645), (1435, 646), (1635, 652), (1835, 656),
        (2035, 652), (2245, 635),
    ]
    for tp, dp in zip(top_points[1:-1], deck_points[1:-1]):
        draw_rope(d, tp, dp, 2)
    for tp, dp in [
        ((290, 390), (295, 655)), ((340, 430), (335, 650)), ((395, 480), (405, 650)),
        ((430, 500), (475, 654)), ((2135, 480), (2035, 652)), ((2195, 445), (2145, 642)),
        ((2265, 430), (2245, 635)), ((2315, 410), (2285, 635)),
    ]:
        draw_rope(d, tp, dp, 2)
    for x, y in ((470, 654), (655, 656), (850, 654), (1045, 648), (1240, 645), (1435, 646), (1635, 652), (1835, 656), (2035, 652)):
        d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(58, 39, 22, 210), outline=(238, 161, 72, 190), width=1)
    canvas.alpha_composite(cables)

    paste(canvas, gondola, (190, 650))
    paste(canvas, bridge, (575, 445))
    paste(canvas, flag, (1260, 40))

    plane_y = 610
    for idx, x in enumerate((1010, 1245, 1480, 1715)):
        small = plane.rotate(-2 + idx, expand=True, resample=Image.Resampling.BICUBIC)
        paste(canvas, small, (x, plane_y + (idx % 2) * 6))

    paste(canvas, prop.resize((prop.width * 3 // 4, prop.height * 3 // 4), Image.Resampling.LANCZOS), (2268, 195))
    paste(canvas, prop.resize((prop.width * 3 // 4, prop.height * 3 // 4), Image.Resampling.LANCZOS), (2268, 760))
    paste(canvas, banner, (700, 732))

    detail = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    dd = ImageDraw.Draw(detail)
    for x, y, side in (
        (450, 780, 1), (710, 765, 1), (1000, 775, 1),
        (1290, 775, 1), (1580, 770, 1), (1870, 760, -1),
        (640, 895, 1), (960, 915, 1), (1280, 915, 1),
        (1600, 905, 1), (1940, 880, -1),
    ):
        dd.ellipse((x - 13, y - 13, x + 13, y + 13), fill=(24, 22, 20, 235), outline=(196, 118, 48, 225), width=4)
        dd.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(226, 120, 42, 170))
        dd.line((x + side * 6, y - 2, x + side * 55, y - 9), fill=(25, 20, 16, 235), width=5)
        dd.line((x + side * 6, y - 2, x + side * 55, y - 9), fill=(184, 109, 42, 190), width=2)
    canvas.alpha_composite(detail)

    # Tighten the final frame around the assembled dirigible while keeping useful padding.
    bbox = canvas.getbbox()
    if bbox:
        x1, y1, x2, y2 = bbox
        pad = 38
        x1 = max(0, x1 - pad)
        y1 = max(0, y1 - pad)
        x2 = min(canvas.width, x2 + pad)
        y2 = min(canvas.height, y2 + pad)
        canvas = canvas.crop((x1, y1, x2, y2))

    canvas.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
