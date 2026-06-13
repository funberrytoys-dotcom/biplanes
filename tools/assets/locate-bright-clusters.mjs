import sharp from 'sharp';

async function main() {
  const image = sharp('apps/web/public/assets/biplanes/hud/cockpit_panel.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  // Find pixels that are bright (R > 180, G > 140) to locate bezels, text, and markers.
  const brightPixels = [];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (a > 200 && r > 180 && g > 130) {
        brightPixels.push({ x, y });
      }
    }
  }
  
  console.log(`Found ${brightPixels.length} bright pixels.`);
  
  // Let's do simple 1D K-means or clustering on X coordinates to see where the major components are!
  // We want to find the peaks of bright pixels along X.
  const histX = new Array(info.width).fill(0);
  for (const p of brightPixels) {
    histX[p.x]++;
  }
  
  // Group histX into 20px bins and print densities along X to find elements
  const binSize = 30;
  const bins = [];
  for (let x = 0; x < info.width; x += binSize) {
    let sum = 0;
    for (let i = x; i < Math.min(info.width, x + binSize); i++) {
      sum += histX[i];
    }
    bins.push({ x: x + binSize / 2, count: sum });
  }
  
  console.log('Bright pixel density along X:');
  console.log(bins.map(b => `${Math.round(b.x).toString().padStart(4, ' ')}:${b.count.toString().padStart(4, ' ')}`).join(' | '));
}

main().catch(console.error);
