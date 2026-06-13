import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  console.log(`Image size: ${info.width}x${info.height}`);
  
  // Let's print out the row projection of dark pixels (brightness < 60) for a few selected Y rows
  // to get a clear topographic map of where dark elements are!
  function printRowProjection(yCenter, name) {
    const cols = 20;
    const colWidth = Math.floor(info.width / cols);
    const row = [];
    for (let c = 0; c < cols; c++) {
      let darkCount = 0;
      const xStart = c * colWidth;
      const xEnd = (c + 1) * colWidth;
      for (let y = yCenter - 25; y < yCenter + 25; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const idx = (y * info.width + x) * 4;
          if (data[idx + 3] > 150) {
            const b = (data[idx] + data[idx+1] + data[idx+2]) / 3;
            if (b < 60) darkCount++;
          }
        }
      }
      row.push(darkCount.toString().padStart(5, ' '));
    }
    console.log(`${name.padEnd(12, ' ')} | ${row.join(' | ')}`);
  }
  
  console.log('Columns: ' + Array.from({length: 20}, (_, i) => Math.round((i + 0.5) * (info.width / 20)).toString().padStart(5, ' ')).join(' | '));
  console.log('='.repeat(150));
  for (let y = 50; y < info.height; y += 40) {
    printRowProjection(y, `Row Y=${y}`);
  }
}

main().catch(console.error);
