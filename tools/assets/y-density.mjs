import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  const yDensity = new Array(info.height).fill(0);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * 4;
      if (data[idx + 3] > 50) { // non-transparent
        yDensity[y]++;
      }
    }
  }
  
  console.log('Vertical non-transparent pixel density (Row index: Count):');
  const step = 10;
  for (let y = 0; y < info.height; y += step) {
    let sum = 0;
    for (let i = y; i < Math.min(info.height, y + step); i++) {
      sum += yDensity[i];
    }
    console.log(`Row Y=${y.toString().padStart(3, ' ')}..${Math.min(info.height, y + step).toString().padStart(3, ' ')}: ${sum}`);
  }
}

main().catch(console.error);
