import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const srcFile = 'C:/Users/serge/.gemini/antigravity-ide/brain/b6863a44-430f-47d0-aa03-545ad2e7fc03/media__1780344435765.png';
const outDir = path.join(root, 'apps', 'web', 'public', 'assets', 'biplanes', 'hud');
const outFile = path.join(outDir, 'cockpit_panel.png');

function keyGreenInPlace(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const greenness = g - Math.max(r, b);
    if (greenness > 45) {
      data[i + 3] = 0; // solid green background → transparent
    } else if (greenness > 8) {
      // Edge pixel: feather alpha toward transparent and pull the green channel down
      const t = (greenness - 8) / (45 - 8);
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
      data[i + 1] = Math.max(r, b);
    }
  }
}

async function keyedSharp(input) {
  let image = sharp(input).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  keyGreenInPlace(data);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  console.log(`Processing HUD panel from ${srcFile}...`);

  const keyed = await keyedSharp(srcFile);
  await keyed
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
    .png()
    .toFile(outFile);

  console.log(`Successfully saved processed HUD panel to ${outFile}`);
  
  // Inspecting new trimmed bounds
  const meta = await sharp(outFile).metadata();
  console.log(`Trimmed size: ${meta.width}x${meta.height}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
