"""Prepare the С.О.В. base island sprite for the «Волчья комета» mission.

The source (Biplanes-godot/pitсhing/ChatGPT Image 24 мая 2026 г., 23_10_37.png) is a
floating island on a flat MAGENTA chroma-key. We remove the background with an EDGE
FLOOD-FILL (not a global colour key) so any island pixel that happens to be pinkish is
kept — only the background region connected to the border is cleared. Then crop to the
content, downscale, and write a transparent PNG into the game assets.
"""
from collections import deque
from PIL import Image
import os

SRC = r"C:\Users\serge\Documents\Playground\Biplanes-godot\pitсhing\ChatGPT Image 24 мая 2026 г., 23_10_37.png"
OUT = r"C:\Users\serge\Documents\Playground\Biplanes\apps\web\public\assets\airships\wolfcomet\island_sov.png"
TARGET_W = 1100        # plenty for ~1 screen of world; keeps file small
TOL = 60               # colour distance from the sampled magenta that still counts as background

img = Image.open(SRC).convert("RGBA")
w, h = img.size
px = img.load()

# Sample the background colour from the four corners (median-ish: just use top-left).
bg = px[0, 0][:3]
print(f"source {w}x{h}, background sample = {bg}")

def is_bg(c):
    return (abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2])) <= TOL

# BFS flood-fill from every border pixel that matches the background.
visited = bytearray(w * h)
q = deque()

def push(x, y):
    if 0 <= x < w and 0 <= y < h and not visited[y * w + x]:
        visited[y * w + x] = 1
        if is_bg(px[x, y][:3]):
            q.append((x, y))
            return True
    return False

for x in range(w):
    push(x, 0)
    push(x, h - 1)
for y in range(h):
    push(0, y)
    push(w - 1, y)

cleared = 0
while q:
    x, y = q.popleft()
    r, g, b, _ = px[x, y]
    px[x, y] = (r, g, b, 0)
    cleared += 1
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        push(x + dx, y + dy)

print(f"cleared {cleared} background pixels ({cleared * 100 // (w * h)}%)")

# Crop to the remaining (opaque) content.
bbox = img.getbbox()
img = img.crop(bbox)
print(f"cropped to {img.size}")

# Downscale to target width.
cw, ch = img.size
scale = TARGET_W / cw
img = img.resize((TARGET_W, max(1, round(ch * scale))), Image.LANCZOS)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT)
print(f"wrote {OUT} ({img.size[0]}x{img.size[1]})")
