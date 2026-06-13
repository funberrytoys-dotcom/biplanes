import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  const outData = Buffer.from(data);
  
  // Draw grid lines
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const isGridX = x % 50 === 0;
      const isGridY = y % 50 === 0;
      if (isGridX || isGridY) {
        const idx = (y * info.width + x) * 4;
        // Make grid line red
        outData[idx] = 255;
        outData[idx + 1] = 0;
        outData[idx + 2] = 0;
        outData[idx + 3] = 255;
      }
    }
  }
  
  await sharp(outData, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile('docs/references/hud_grid.png');
    
  console.log('Saved grid verification image to docs/references/hud_grid.png');
}

main().catch(console.error);
