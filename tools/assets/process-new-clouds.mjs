import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Список сгенерированных файлов и их целевых индексов
const files = [
  { src: 'cloud_green_14_1780243199089.png', index: 14 },
  { src: 'cloud_green_15_1780243224244.png', index: 15 },
  { src: 'cloud_green_16_1780243237558.png', index: 16 },
  { src: 'cloud_green_17_1780243250024.png', index: 17 },
  { src: 'cloud_green_18_1780243262151.png', index: 18 },
  { src: 'cloud_green_19_1780243277541.png', index: 19 },
  { src: 'cloud_green_20_1780243289709.png', index: 20 },
  { src: 'cloud_green_21_1780243301776.png', index: 21 },
  { src: 'cloud_green_22_1780243314177.png', index: 22 },
  { src: 'cloud_green_23_1780243329702.png', index: 23 },
  { src: 'cloud_green_24_1780243345118.png', index: 24 },
  { src: 'cloud_green_25_1780243357740.png', index: 25 },
  { src: 'cloud_green_26_1780243370081.png', index: 26 },
  { src: 'cloud_green_27_1780243385371.png', index: 27 },
  { src: 'cloud_green_28_1780243400774.png', index: 28 },
];

const brainDir = 'C:/Users/serge/.gemini/antigravity-ide/brain/db5d105b-d703-4d4f-b76f-2e6fa9b8cd60';
const targetDir = 'C:/Users/serge/Documents/Playground/Biplanes/docs/references/new-clouds';

// Green-screen key with edge feather + green despill
function keyGreenInPlace(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const greenness = g - Math.max(r, b);
    if (greenness > 60) {
      data[i + 3] = 0; // solid green background → transparent
    } else if (greenness > 8) {
      // Edge pixel: feather alpha toward transparent and pull the green channel down
      const t = (greenness - 8) / (60 - 8);
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
      data[i + 1] = Math.max(r, b);
    }
  }
}

async function keyedSharp(inputPath) {
  let image = sharp(inputPath).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  keyGreenInPlace(data);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function main() {
  await fs.mkdir(targetDir, { recursive: true });

  for (const item of files) {
    const srcPath = path.join(brainDir, item.src);
    const indexStr = String(item.index).padStart(2, '0');
    
    const greenDestName = `cloud_highres_green_${indexStr}.png`;
    const transparentDestName = `cloud_highres_transparent_${indexStr}.png`;
    
    const greenDestPath = path.join(targetDir, greenDestName);
    const transparentDestPath = path.join(targetDir, transparentDestName);

    console.log(`Processing cloud ${item.index}...`);

    // 1. Copy green background file
    await fs.copyFile(srcPath, greenDestPath);
    console.log(`  Copied green to ${greenDestName}`);

    // 2. Generate and save keyed transparent version
    const keyed = await keyedSharp(srcPath);
    await keyed
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
      .png()
      .toFile(transparentDestPath);
    console.log(`  Saved transparent to ${transparentDestName}`);
  }

  console.log('All 15 cloud assets successfully processed and saved!');
}

main().catch((err) => {
  console.error('Error processing assets:', err);
  process.exitCode = 1;
});
