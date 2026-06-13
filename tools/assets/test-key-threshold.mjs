import sharp from 'sharp';

async function main() {
  const srcFile = 'C:/Users/serge/.gemini/antigravity-ide/brain/b6863a44-430f-47d0-aa03-545ad2e7fc03/cockpit_panel_white_1780344896674.png';
  const image = sharp(srcFile).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  // Clean anything with brightness > 175.
  // The panel itself has very dark metal, so it will not be affected at all!
  // This will completely eliminate soft shadows on the white background.
  const outData = Buffer.from(data);
  for (let i = 0; i < outData.length; i += 4) {
    const r = outData[i];
    const g = outData[i + 1];
    const b = outData[i + 2];
    const brightness = (r + g + b) / 3;
    
    if (brightness > 190) {
      outData[i + 3] = 0; // make transparent
    } else if (brightness > 165) {
      const t = (brightness - 165) / (190 - 165);
      outData[i + 3] = Math.round(outData[i + 3] * (1 - t));
    }
  }
  
  const tempFile = 'apps/web/public/assets/biplanes/hud/cockpit_panel_temp.png';
  await sharp(outData, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
    .png()
    .toFile(tempFile);
    
  const meta = await sharp(tempFile).metadata();
  console.log(`With aggressive key, trimmed size: ${meta.width}x${meta.height}`);
}

main().catch(console.error);
