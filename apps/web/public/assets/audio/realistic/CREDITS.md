# Realistic combat SFX — sources & licenses

All files below are cleared for commercial use. Only `engine_prop.ogg` requires
attribution (CC-BY); the rest are public domain. Keep this file with the assets.

| File | Source | License | Attribution |
|------|--------|---------|-------------|
| `engine_prop.ogg` | [Airplane Prop Loop](https://opengameart.org/content/airplane-prop-loop) (OpenGameArt) | CC-BY 3.0 | **jakobthiesen** |
| `gunshot.ogg` | [Gunshots 8](https://commons.wikimedia.org/wiki/File:Gunshots_8.ogg) (Wikimedia Commons), trimmed to a single shot | Public domain | — |
| `heavygun.ogg` | Derived from `gunshot.ogg` (pitched down + low body) | Public domain | — |
| `explosion_small.ogg` | [Explosion-LS100155](https://commons.wikimedia.org/wiki/File:Explosion-LS100155.ogg) (Wikimedia Commons) | Public domain | — |
| `explosion_big.ogg` | Derived from `explosion_small.ogg` (pitched down + echo tail) | Public domain | — |

## Required attribution line (CC-BY)

> Airplane engine loop by **jakobthiesen** (opengameart.org), licensed under CC-BY 3.0.

Surface this in an in-game credits/about screen before release.

## Regenerating the derived files

`heavygun.ogg` and `explosion_big.ogg` are produced from the public-domain
sources with ffmpeg (pitch/echo/low-pass). The exact filters are recorded in the
git commit that introduced these assets.
