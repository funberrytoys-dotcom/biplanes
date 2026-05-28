import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Slices the green-screen cloud spritesheet into individual transparent cloud
// PNGs and chroma-keys the standalone soft cloud. Run: node tools/assets/prepare-cloud-assets.mjs
//
// Source art lives on the desktop (not in the repo); outputs land in the web
// public assets so the renderer can load them as /assets/biplanes/clouds/*.

const root = process.cwd();
const srcDir = 'C:/Users/serge/Desktop/Biplanes/assets';
const sheetFile = path.join(srcDir, 'clouds_spritesheet_1779974846525.png');
const softFile = path.join(srcDir, 'pure_cloud_1780000557786.png');
const outDir = path.join(root, 'apps', 'web', 'public', 'assets', 'biplanes', 'clouds');

const COLS = 5;
const ROWS = 4;

// Green-screen key with edge feather + green despill, so soft cloud edges don't
// keep a green halo. Operates in-place on a raw RGBA buffer.
function keyGreenInPlace(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const greenness = g - Math.max(r, b);
    if (greenness > 60) {
      data[i + 3] = 0; // solid green background → transparent
    } else if (greenness > 8) {
      // Edge pixel: feather alpha toward transparent and pull the green channel
      // down to kill the halo tint.
      const t = (greenness - 8) / (60 - 8);
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
      data[i + 1] = Math.max(r, b);
    }
  }
}

async function keyedSharp(input, extract) {
  let image = sharp(input).ensureAlpha();
  if (extract) image = image.extract(extract);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  keyGreenInPlace(data);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const { width, height } = await sharp(sheetFile).metadata();

  let index = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      index += 1;
      const left = Math.round((col * width) / COLS);
      const right = Math.round(((col + 1) * width) / COLS);
      const top = Math.round((row * height) / ROWS);
      const bottom = Math.round(((row + 1) * height) / ROWS);
      const extract = { left, top, width: right - left, height: bottom - top };

      const keyed = await keyedSharp(sheetFile, extract);
      await keyed
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
        .resize({ width: 360, withoutEnlargement: true })
        .png()
        .toFile(path.join(outDir, `cloud_${String(index).padStart(2, '0')}.png`));
    }
  }

  // Soft photoreal cloud for foreground "fly-into" banks.
  const soft = await keyedSharp(softFile);
  await soft
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
    .resize({ width: 520, withoutEnlargement: true })
    .png()
    .toFile(path.join(outDir, 'cloud_soft.png'));

  console.log(`Wrote ${index} sheet clouds + cloud_soft.png to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
