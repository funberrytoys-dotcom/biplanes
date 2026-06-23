"""Procedural explosion sprite-sheet generator (clean frames, transparent, even grid).
AI image-gen makes inconsistent sprite sheets; explosions are particle/gradient-based so we
draw them in code: a bold orange-red fireball (small white-hot core) -> drifting smoke ->
flying sparks, cooling over time. Two sheets: small (planes/turrets) + large (bridge/hull)."""
import math, random
import numpy as np
from PIL import Image, ImageFilter


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def comp(dst, r, g, b, a):
    """'over' composite of source (r,g,b,a) onto dst, straight-alpha float RGBA."""
    a = np.clip(a, 0.0, 1.0)
    dr, dg, db, da = dst[..., 0], dst[..., 1], dst[..., 2], dst[..., 3]
    na = a + da * (1 - a)
    safe = np.where(na > 1e-6, na, 1.0)
    nr = (r * a + dr * da * (1 - a)) / safe
    ng = (g * a + dg * da * (1 - a)) / safe
    nb = (b * a + db * da * (1 - a)) / safe
    return np.stack([nr, ng, nb, na], axis=-1)


def render_frame(size, t, seed, big):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    cx = cy = size / 2.0
    out = np.zeros((size, size, 4), np.float32)
    maxR = size * 0.44
    cool = smoothstep(0.0, 1.0, t)
    rng = random.Random(seed)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    ang = np.arctan2(yy - cy, xx - cx)

    # ---- FIREBALL: bold solid orange-red ball, small white-hot core, organic rim ----
    grow = min(1.0, t / 0.32)
    R = maxR * (0.22 + 0.78 * grow)
    fa = (t / 0.05) if t < 0.05 else (1.0 if t < 0.45 else max(0.0, 1 - (t - 0.45) / 0.43))
    fa = min(1.0, fa)
    if fa > 0.002:
        p1, p2, p3 = rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28)
        # gentle rim irregularity (rounded billowing ball, not a sharp star)
        Rmod = R * (1 + 0.08 * np.sin(3 * ang + p1) + 0.06 * np.sin(5 * ang + p2) + 0.05 * np.sin(9 * ang + p3))
        heat = np.clip(1 - d / Rmod, 0, 1) ** 1.25
        # billowing hot pockets so it reads as roiling fire, not a smooth dome
        for _ in range(4 if big else 3):
            ox, oy = rng.uniform(-R * 0.34, R * 0.34), rng.uniform(-R * 0.34, R * 0.34)
            lr = R * rng.uniform(0.42, 0.68)
            dl = np.sqrt((xx - cx - ox) ** 2 + (yy - cy - oy) ** 2)
            heat = np.maximum(heat, np.clip(1 - dl / lr, 0, 1) ** 1.3 * 0.95)
        h = np.clip(heat, 0, 1)
        xs = [0.0, 0.30, 0.50, 0.72, 0.90, 1.0]
        r = np.interp(h, xs, [150, 225, 245, 255, 255, 255])
        g = np.interp(h, xs, [22, 55, 95, 150, 215, 250])
        b = np.interp(h, xs, [8, 14, 24, 45, 110, 225])
        g = g * (1 - 0.40 * cool)
        b = b * (1 - 0.55 * cool)
        bri = 1 - 0.28 * cool
        r, g, b = r * bri, g * bri, b * bri
        a = np.clip(h * 1.5, 0, 1) * fa  # solid body, fades at rim
        out = comp(out, r, np.clip(g, 0, 255), np.clip(b, 0, 255), a)

    # ---- SMOKE: later + lighter so it doesn't wash out the fire ----
    sa = smoothstep(0.40, 0.65, t) * (1 - smoothstep(0.85, 1.08, t))
    if sa > 0.002:
        srng = random.Random(seed + 999)
        smoke = np.zeros((size, size), np.float32)
        for _ in range(9 if big else 6):
            a2 = srng.uniform(0, 6.28)
            dist = srng.uniform(0, maxR * 0.6) * (0.5 + t)
            lx = cx + math.cos(a2) * dist
            ly = cy + math.sin(a2) * dist - maxR * 1.1 * t
            lr = maxR * srng.uniform(0.45, 0.9) * (0.7 + 0.7 * t)
            dd = np.sqrt((xx - lx) ** 2 + (yy - ly) ** 2)
            smoke += np.clip(1 - dd / lr, 0, 1) ** 1.6
        smoke = np.clip(smoke, 0, 1)
        gy = 60 + 40 * smoke
        out = comp(out, gy, gy * 0.95, gy * 0.9, smoke * 0.45 * sa)

    # ---- SPARKS: subtle ----
    if t < 0.55:
        prng = random.Random(seed + 555)
        spa = max(0.0, 1 - t / 0.55)
        for _ in range(14 if big else 9):
            a3 = prng.uniform(0, 6.28)
            spd = prng.uniform(0.4, 1.05) * maxR * 1.7
            px = cx + math.cos(a3) * spd * t
            py = cy + math.sin(a3) * spd * t
            rad = (2.4 if big else 1.7) * prng.uniform(0.7, 1.3)
            dd = np.sqrt((xx - px) ** 2 + (yy - py) ** 2)
            dot = np.clip(1 - dd / rad, 0, 1) ** 1.6
            out = comp(out, 255, 225, 150, np.clip(dot * spa * 1.2, 0, 1))

    rgb = np.clip(out[..., :3], 0, 255).astype(np.uint8)
    alpha = np.clip(out[..., 3] * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, alpha]), "RGBA").filter(ImageFilter.GaussianBlur(0.7))


def build_sheet(path, frame, cols, rows, big, seed=1234):
    n = cols * rows
    sheet = Image.new("RGBA", (frame * cols, frame * rows), (0, 0, 0, 0))
    for i in range(n):
        t = (i + 0.55) / n
        f = render_frame(frame, t, seed + i * 17, big)
        sheet.paste(f, ((i % cols) * frame, (i // cols) * frame), f)
    sheet.save(path)
    print(f"{path}  {sheet.size}  {n} frames ({cols}x{rows} @ {frame}px)")


if __name__ == "__main__":
    base = "apps/web/public/assets/fx"
    build_sheet(f"{base}/explosion_small.png", 128, 4, 2, big=False, seed=7000)
    build_sheet(f"{base}/explosion_large.png", 256, 4, 4, big=True, seed=4200)
