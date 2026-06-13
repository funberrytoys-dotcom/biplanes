import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const srcFile = 'C:/Users/serge/.gemini/antigravity-ide/brain/b6863a44-430f-47d0-aa03-545ad2e7fc03/cockpit_panel_white_1780344896674.png';
const outDir = path.join(root, 'apps', 'web', 'public', 'assets', 'biplanes', 'hud');
const outFile = path.join(outDir, 'cockpit_panel.png'); // We overwrite cockpit_panel.png to use the new one directly!

function keyWhiteInPlace(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    
    // Solid white key out
    if (brightness > 245) {
      data[i + 3] = 0;
    } else if (brightness > 220) {
      // Smooth alpha feathering at edges to avoid harsh halo
      const t = (brightness - 220) / (245 - 220);
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
      
      // Pull color towards the background to blend well
      data[i] = Math.round(r * (1 - t) + 255 * t);
      data[i + 1] = Math.round(g * (1 - t) + 255 * t);
      data[i + 2] = Math.round(b * (1 - t) + 255 * t);
    }
  }
}

async function keyedSharp(input) {
  let image = sharp(input).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  keyWhiteInPlace(data);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  console.log(`Processing white-background HUD panel from ${srcFile}...`);

  const keyed = await keyedSharp(srcFile);
  await keyed
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
    .png()
    .toFile(outFile);

  console.log(`Successfully saved processed white-chromakey HUD panel to ${outFile}`);
  
  // Inspecting new trimmed bounds
  const meta = await sharp(outFile).metadata();
  console.log(`Trimmed size: ${meta.width}x${meta.height}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
