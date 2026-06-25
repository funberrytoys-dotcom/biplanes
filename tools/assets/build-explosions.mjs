// Build the three explosion sprite sheets used in-game from the owner-curated frames.
//
// Source: docs/references/explosions-spritesheets-24f-2026-06-25/explosion_{size}_frames_24/
//   24 PNG frames per size (small / medium / large), ~384x341 each.
// Output: apps/web/public/assets/fx/explosion_{size}.webp
//   A clean 4-col x 6-row grid (24 frames), uniform 256x256 cells, WebP (the raw
//   12 MB combined PNG sheets are far too heavy to ship). Code slices it row-major.
//
//   small  = turrets        medium = planes        large = big objects (bridge / prop / guns)
//
// Run: node tools/assets/build-explosions.mjs
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const SRC = 'docs/references/explosions-spritesheets-24f-2026-06-25';
const OUT = 'apps/web/public/assets/fx';
const SIZES = ['small', 'medium', 'large'];
const FRAMES = 24;
const COLS = 4;
const ROWS = 6;
const CELL = 256;

mkdirSync(OUT, { recursive: true });

async function buildSheet(size) {
  const composites = [];
  for (let i = 0; i < FRAMES; i++) {
    const n = String(i + 1).padStart(2, '0');
    const frame = await sharp(join(SRC, `explosion_${size}_frames_24`, `explosion_${size}_${n}.png`))
      .resize({ width: CELL, height: CELL, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    composites.push({ input: frame, left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL });
  }
  const info = await sharp({
    create: { width: COLS * CELL, height: ROWS * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .webp({ quality: 85, alphaQuality: 95, effort: 5 })
    .toFile(join(OUT, `explosion_${size}.webp`));
  console.log(`explosion_${size}.webp  ${COLS * CELL}x${ROWS * CELL}  ${Math.round(info.size / 1024)} KB`);
}

for (const s of SIZES) await buildSheet(s);
console.log('done');
